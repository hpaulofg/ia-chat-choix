import type { ProviderId } from "@/lib/provider-config";

export type ChatMsg = { role: "user" | "assistant"; content: string };

export type CompleteResult = {
  text: string;
  inputTokens: number;
  outputTokens: number;
};

function extractGeminiText(obj: unknown): string {
  if (!obj || typeof obj !== "object") return "";
  const o = obj as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const parts = o.candidates?.[0]?.content?.parts;
  if (!parts?.length) return "";
  return parts.map((p) => p.text ?? "").join("");
}

export async function completeAnthropic(
  apiKey: string,
  model: string,
  messages: ChatMsg[],
  systemPrompt: string
): Promise<CompleteResult> {
  const body: Record<string, unknown> = {
    model,
    max_tokens: 8192,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  };
  if (systemPrompt) body.system = systemPrompt;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${raw}`);
  }
  const data = JSON.parse(raw) as {
    content?: { type: string; text?: string }[];
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  const text =
    data.content?.find((c) => c.type === "text")?.text?.trim() ?? "";
  return {
    text,
    inputTokens: Number(data.usage?.input_tokens) || 0,
    outputTokens: Number(data.usage?.output_tokens) || 0,
  };
}

export async function completeOpenAICompatible(
  baseUrl: string,
  apiKey: string,
  model: string,
  messages: ChatMsg[],
  systemPrompt: string
): Promise<CompleteResult> {
  const url = `${baseUrl.replace(/\/$/, "")}/chat/completions`;
  const openaiMsgs = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));
  const withSystem: { role: string; content: string }[] = systemPrompt
    ? [{ role: "system", content: systemPrompt }, ...openaiMsgs]
    : openaiMsgs;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: withSystem,
      stream: false,
      max_tokens: 8192,
    }),
  });

  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${raw}`);
  }
  const data = JSON.parse(raw) as {
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const text = data.choices?.[0]?.message?.content?.trim() ?? "";
  return {
    text,
    inputTokens: Number(data.usage?.prompt_tokens) || 0,
    outputTokens: Number(data.usage?.completion_tokens) || 0,
  };
}

/** ID usado no path REST (sem prefixo `models/`). */
export function normalizeGeminiModelId(model: string): string {
  let m = model.trim();
  if (m.startsWith("models/")) m = m.slice("models/".length);
  return m;
}

export async function completeGemini(
  apiKey: string,
  model: string,
  messages: ChatMsg[],
  systemPrompt: string
): Promise<CompleteResult> {
  const modelId = normalizeGeminiModelId(model);
  console.log("Gemini model ID:", modelId);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  const body: Record<string, unknown> = { contents };
  if (systemPrompt) {
    body.systemInstruction = { parts: [{ text: systemPrompt }] };
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${raw}`);
  }
  const data = JSON.parse(raw) as unknown;
  const text = extractGeminiText(data).trim();
  const u = (data as { usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number } })
    .usageMetadata;
  return {
    text,
    inputTokens: Number(u?.promptTokenCount) || 0,
    outputTokens: Number(u?.candidatesTokenCount) || 0,
  };
}

export async function completeForProvider(
  provider: ProviderId,
  apiKey: string,
  model: string,
  messages: ChatMsg[],
  systemPrompt: string
): Promise<CompleteResult> {
  switch (provider) {
    case "anthropic":
      return completeAnthropic(apiKey, model, messages, systemPrompt);
    case "openai":
      return completeOpenAICompatible(
        "https://api.openai.com/v1",
        apiKey,
        model,
        messages,
        systemPrompt
      );
    case "groq":
      return completeOpenAICompatible(
        "https://api.groq.com/openai/v1",
        apiKey,
        model,
        messages,
        systemPrompt
      );
    case "google":
      return completeGemini(apiKey, model, messages, systemPrompt);
    default:
      throw new Error("Provedor não suportado.");
  }
}
