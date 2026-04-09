import Anthropic from "@anthropic-ai/sdk";
import type {
  ContentBlockParam,
  MessageParam,
} from "@anthropic-ai/sdk/resources/messages";
import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth-cookie";
import {
  base64ToUtf8,
  messageHasImageAttachment,
  normalizeChatMessages,
  type IncomingMsg,
  type NormalizedChatMsg,
} from "@/lib/chat-messages";
import { loadAppData } from "@/lib/app-data";
import { effectiveModelsForProvider } from "@/lib/model-allowlist";
import { prependModelIdentityToSystem } from "@/lib/chat-system-model-prefix";
import { normalizeGeminiModelId } from "@/lib/llm-complete";
import { DEFAULT_ANTHROPIC_MODEL_ID, type ProviderId } from "@/lib/provider-config";
import { resolveApiKey } from "@/lib/resolve-api-keys";
import { getSessionAppUser, sessionEmailLinkedInactiveUser } from "@/lib/session-user";
import {
  effectiveModelAllowlistForChat,
  userMayUseProvider,
} from "@/lib/user-access";

/** Evita cache e bufferização agressiva de proxies (nginx, CDN) em produção. */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SSE_RESPONSE_HEADERS: Record<string, string> = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control":
    "no-store, no-cache, no-transform, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
};

/**
 * Comentário SSE grande: alguns proxies só repassam o corpo após ~4KB.
 * Não é mostrado ao cliente (linhas `:` são ignoradas em event-stream).
 */
function sseAntiBufferPreamble(encoder: TextEncoder): Uint8Array {
  return encoder.encode(`:${" ".repeat(4096)}\n\n`);
}

function anthropicImageMediaType(
  mime: string
): "image/jpeg" | "image/png" | "image/gif" | "image/webp" | null {
  const m = mime.toLowerCase();
  if (m === "image/jpeg" || m === "image/jpg") return "image/jpeg";
  if (m === "image/png") return "image/png";
  if (m === "image/gif") return "image/gif";
  if (m === "image/webp") return "image/webp";
  return null;
}

function toAnthropicMessageParam(m: NormalizedChatMsg): MessageParam {
  if (m.role === "assistant") {
    return { role: "assistant", content: m.content };
  }
  const blocks: ContentBlockParam[] = [];
  for (const a of m.attachments ?? []) {
    const mt = a.type.toLowerCase();
    if (mt.startsWith("image/")) {
      const im = anthropicImageMediaType(mt);
      if (im) {
        blocks.push({
          type: "image",
          source: { type: "base64", media_type: im, data: a.base64 },
        });
      }
    } else if (mt === "application/pdf") {
      blocks.push({
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: a.base64 },
        title: a.name,
      });
    } else {
      const decoded = base64ToUtf8(a.base64);
      blocks.push({
        type: "text",
        text: decoded.trim()
          ? `--- ${a.name} ---\n${decoded}`
          : `--- ${a.name} ---`,
      });
    }
  }
  const t = m.content.trim();
  if (t) blocks.push({ type: "text", text: t });
  if (blocks.length === 0) {
    return { role: "user", content: "" };
  }
  if (blocks.length === 1 && blocks[0].type === "text") {
    return { role: "user", content: (blocks[0] as { type: "text"; text: string }).text };
  }
  return { role: "user", content: blocks };
}

function toAnthropicMessages(msgs: NormalizedChatMsg[]): MessageParam[] {
  return msgs.map(toAnthropicMessageParam);
}

type OpenAIContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string; detail?: "auto" | "low" | "high" } };

type OpenAIChatMessage = {
  role: "system" | "user" | "assistant";
  content: string | OpenAIContentPart[];
};

function toOpenAIUserMessage(m: NormalizedChatMsg): OpenAIChatMessage {
  const parts: OpenAIContentPart[] = [];
  for (const a of m.attachments ?? []) {
    const mt = a.type.toLowerCase();
    if (mt.startsWith("image/")) {
      parts.push({
        type: "image_url",
        image_url: {
          url: `data:${a.type};base64,${a.base64}`,
          detail: "auto",
        },
      });
    } else if (mt === "application/pdf") {
      parts.push({
        type: "text",
        text: `[PDF "${a.name}" não é enviado a modelos OpenAI/Groq neste chat; use Anthropic ou Gemini, ou descreva o documento.]`,
      });
    } else {
      const decoded = base64ToUtf8(a.base64);
      parts.push({
        type: "text",
        text: decoded.trim()
          ? `--- ${a.name} ---\n${decoded}`
          : `--- ${a.name} ---`,
      });
    }
  }
  const t = m.content.trim();
  if (t) parts.push({ type: "text", text: t });
  if (parts.length === 0) return { role: "user", content: "" };
  if (parts.length === 1 && parts[0].type === "text") {
    return { role: "user", content: parts[0].text };
  }
  return { role: "user", content: parts };
}

function toOpenAIMessages(
  msgs: NormalizedChatMsg[],
  systemPrompt: string
): OpenAIChatMessage[] {
  const openaiMsgs: OpenAIChatMessage[] = msgs.map((m) =>
    m.role === "assistant"
      ? { role: "assistant", content: m.content }
      : toOpenAIUserMessage(m)
  );
  return systemPrompt
    ? [{ role: "system", content: systemPrompt }, ...openaiMsgs]
    : openaiMsgs;
}

type GeminiPart =
  | { text: string }
  | { inline_data: { mime_type: string; data: string } };

function toGeminiTurn(m: NormalizedChatMsg): { role: string; parts: GeminiPart[] } {
  if (m.role === "assistant") {
    return { role: "model", parts: [{ text: m.content }] };
  }
  const parts: GeminiPart[] = [];
  for (const a of m.attachments ?? []) {
    const mt = a.type.toLowerCase();
    if (mt.startsWith("image/") || mt === "application/pdf") {
      parts.push({
        inline_data: {
          mime_type: a.type || "application/octet-stream",
          data: a.base64,
        },
      });
    } else {
      const decoded = base64ToUtf8(a.base64);
      parts.push({
        text: decoded.trim()
          ? `--- ${a.name} ---\n${decoded}`
          : `--- ${a.name} ---`,
      });
    }
  }
  const t = m.content.trim();
  if (t) parts.push({ text: t });
  if (!parts.length) parts.push({ text: "" });
  return { role: "user", parts };
}

function extractGeminiText(obj: unknown): string {
  if (!obj || typeof obj !== "object") return "";
  const o = obj as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const parts = o.candidates?.[0]?.content?.parts;
  if (!parts?.length) return "";
  return parts.map((p) => p.text ?? "").join("");
}

function extractGeminiUsage(obj: unknown): { input: number; output: number } | null {
  if (!obj || typeof obj !== "object") return null;
  const u = (obj as { usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number } })
    .usageMetadata;
  if (!u) return null;
  const input = Number(u.promptTokenCount) || 0;
  const output = Number(u.candidatesTokenCount) || 0;
  if (!input && !output) return null;
  return { input, output };
}

function streamSse(
  encoder: TextEncoder,
  run: (send: (obj: object) => void) => Promise<void>
): ReadableStream {
  return new ReadableStream({
    async start(controller) {
      controller.enqueue(sseAntiBufferPreamble(encoder));
      const send = (obj: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      };
      try {
        await run(send);
        send({ done: true });
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        send({ error: message });
      } finally {
        controller.close();
      }
    },
  });
}

async function streamOpenAICompatible(
  send: (obj: object) => void,
  baseUrl: string,
  apiKey: string,
  model: string,
  messages: OpenAIChatMessage[]
) {
  const url = `${baseUrl.replace(/\/$/, "")}/chat/completions`;
  const baseBody = {
    model,
    messages,
    stream: true,
    max_tokens: 8192,
  };

  let res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ...baseBody, stream_options: { include_usage: true } }),
  });

  if (!res.ok && res.status === 400) {
    res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(baseBody),
    });
  }

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(t || `Erro HTTP ${res.status}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("Resposta sem corpo.");

  const decoder = new TextDecoder();
  let buf = "";
  let lastUsage: { prompt_tokens?: number; completion_tokens?: number } | null = null;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith("data: ")) continue;
      const json = t.slice(6);
      if (json === "[DONE]") continue;
      try {
        const parsed = JSON.parse(json) as {
          choices?: { delta?: { content?: string | null } }[];
          usage?: { prompt_tokens?: number; completion_tokens?: number };
        };
        if (parsed.usage) lastUsage = parsed.usage;
        const delta = parsed.choices?.[0]?.delta?.content;
        if (typeof delta === "string" && delta.length) send({ text: delta });
      } catch {
        /* partial */
      }
    }
  }

  if (lastUsage) {
    const input = Number(lastUsage.prompt_tokens) || 0;
    const output = Number(lastUsage.completion_tokens) || 0;
    if (input || output) send({ usage: { input, output } });
  }
}

async function streamGemini(
  send: (obj: object) => void,
  apiKey: string,
  model: string,
  contents: { role: string; parts: GeminiPart[] }[],
  systemPrompt: string
) {
  const modelId = normalizeGeminiModelId(model);
  console.log("Gemini model ID:", modelId);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:streamGenerateContent?key=${encodeURIComponent(apiKey)}&alt=sse`;
  const body: Record<string, unknown> = { contents };
  if (systemPrompt) {
    body.systemInstruction = { parts: [{ text: systemPrompt }] };
  }
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(t || `Erro HTTP ${res.status}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("Resposta sem corpo.");

  const decoder = new TextDecoder();
  let buf = "";
  let prevFull = "";
  let lastUsage: { input: number; output: number } | null = null;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const raw = line.slice(6).trim();
      if (!raw) continue;
      try {
        const j = JSON.parse(raw) as unknown;
        const u = extractGeminiUsage(j);
        if (u) lastUsage = u;
        const full = extractGeminiText(j);
        if (!full) continue;
        if (full.length >= prevFull.length && full.startsWith(prevFull)) {
          const delta = full.slice(prevFull.length);
          prevFull = full;
          if (delta) send({ text: delta });
        } else {
          prevFull = full;
          send({ text: full });
        }
      } catch {
        /* ignore */
      }
    }
  }
  if (lastUsage) send({ usage: { input: lastUsage.input, output: lastUsage.output } });
}

export async function POST(req: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  if (await sessionEmailLinkedInactiveUser()) {
    return NextResponse.json(
      { error: "Conta inativa ou pendente. Inicie sessão com uma conta ativa." },
      { status: 403 }
    );
  }

  let body: {
    messages?: IncomingMsg[];
    model?: string;
    provider?: string;
    system?: string;
    clientApiKey?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const messages = normalizeChatMessages(body.messages ?? []);
  if (!messages.length) {
    return NextResponse.json({ error: "Nenhuma mensagem válida." }, { status: 400 });
  }

  const provider = (body.provider?.trim() || "anthropic") as ProviderId;

  if (provider === "groq" && messages.some(messageHasImageAttachment)) {
    return NextResponse.json(
      {
        error:
          "Este modelo (Groq) não suporta imagens. Escolha OpenAI, Anthropic ou Gemini, ou remova o anexo.",
      },
      { status: 400 }
    );
  }
  const validProviders: ProviderId[] = ["anthropic", "openai", "google", "groq"];
  if (!validProviders.includes(provider)) {
    return NextResponse.json({ error: "Provedor inválido." }, { status: 400 });
  }

  // Chave enviada pelo browser (localStorage) só se não for vazia; senão resolveApiKey (ficheiro + .env).
  // Anthropic em streaming usa esta `apiKey` no SDK abaixo — não passa por lib/llm-complete.ts
  // (llm-complete só serve a POST /api/chat/complete).
  const clientTrim =
    typeof body.clientApiKey === "string" ? body.clientApiKey.trim() : "";
  const apiKey = clientTrim.length > 0 ? clientTrim : resolveApiKey(provider);
  if (!apiKey) {
    return NextResponse.json(
      { error: `Chave API não configurada para ${provider}. Configure em Definições → APIs.` },
      { status: 400 }
    );
  }

  const { role: sessionRole, user: sessionUser } = await getSessionAppUser();
  const appData = loadAppData();
  if (!userMayUseProvider(sessionRole, sessionUser, provider)) {
    return NextResponse.json(
      { error: "Este provedor não está permitido para a sua conta." },
      { status: 403 }
    );
  }
  const allowForUser = effectiveModelAllowlistForChat(
    appData,
    sessionRole,
    sessionUser
  );
  const modelList = effectiveModelsForProvider(provider, allowForUser);
  if (!modelList.length) {
    return NextResponse.json(
      { error: "Nenhum modelo disponível para este provedor. Ajuste a lista em Definições → Chaves de API." },
      { status: 400 }
    );
  }
  const defaultModel =
    modelList[0]?.id ??
    (provider === "anthropic"
      ? process.env.ANTHROPIC_MODEL || DEFAULT_ANTHROPIC_MODEL_ID
      : "");

  let model = body.model?.trim() || defaultModel;
  if (!modelList.some((m) => m.id === model)) {
    model = defaultModel;
  }

  console.log("Calling model:", model, "provider:", provider);

  const systemRaw = typeof body.system === "string" ? body.system.trim() : "";
  const systemPrompt = prependModelIdentityToSystem(systemRaw, model, provider);

  const encoder = new TextEncoder();

  if (provider === "anthropic") {
    const anthropic = new Anthropic({ apiKey });
    const stream = anthropic.messages.stream({
      model,
      max_tokens: 8192,
      system: systemPrompt || undefined,
      messages: toAnthropicMessages(messages),
    });

    const readable = new ReadableStream({
      async start(controller) {
        controller.enqueue(sseAntiBufferPreamble(encoder));
        const send = (obj: object) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        };
        try {
          for await (const event of stream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              send({ text: event.delta.text });
            }
          }
          const final = await stream.finalMessage();
          const u = final.usage;
          if (u && (u.input_tokens || u.output_tokens)) {
            send({
              usage: { input: u.input_tokens ?? 0, output: u.output_tokens ?? 0 },
            });
          }
          send({ done: true });
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          send({ error: message });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, { headers: SSE_RESPONSE_HEADERS });
  }

  if (provider === "openai" || provider === "groq") {
    const baseUrl =
      provider === "groq"
        ? "https://api.groq.com/openai/v1"
        : "https://api.openai.com/v1";
    const withSystem = toOpenAIMessages(messages, systemPrompt);

    const readable = streamSse(encoder, (send) =>
      streamOpenAICompatible(send, baseUrl, apiKey, model, withSystem)
    );

    return new Response(readable, { headers: SSE_RESPONSE_HEADERS });
  }

  if (provider === "google") {
    const contents = messages.map((m) => toGeminiTurn(m));

    const readable = streamSse(encoder, (send) =>
      streamGemini(send, apiKey, model, contents, systemPrompt)
    );

    return new Response(readable, { headers: SSE_RESPONSE_HEADERS });
  }

  return NextResponse.json({ error: "Provedor não suportado." }, { status: 400 });
}
