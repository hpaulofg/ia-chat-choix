import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth-cookie";
import {
  flattenMessagesForLegacyComplete,
  normalizeChatMessages,
  type IncomingMsg,
} from "@/lib/chat-messages";
import { loadAppData } from "@/lib/app-data";
import { mapHttpErrorToUiMessage } from "@/lib/api-ui-errors";
import { effectiveModelsForProvider } from "@/lib/model-allowlist";
import { completeForProvider } from "@/lib/llm-complete";
import { prependModelIdentityToSystem } from "@/lib/chat-system-model-prefix";
import { DEFAULT_ANTHROPIC_MODEL_ID, type ProviderId } from "@/lib/provider-config";
import { resolveApiKey } from "@/lib/resolve-api-keys";
import { getSessionAppUser, sessionEmailLinkedInactiveUser } from "@/lib/session-user";
import {
  effectiveModelAllowlistForChat,
  userMayUseProvider,
} from "@/lib/user-access";

function pickApiKey(provider: ProviderId, clientKey: string | undefined): string | null {
  const trimmed = typeof clientKey === "string" ? clientKey.trim() : "";
  if (trimmed.length > 0) return trimmed;
  return resolveApiKey(provider);
}

export async function POST(req: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  if (await sessionEmailLinkedInactiveUser()) {
    return NextResponse.json(
      { error: "Conta inativa ou pendente." },
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

  const normalized = normalizeChatMessages(body.messages ?? []);
  if (!normalized.length) {
    return NextResponse.json({ error: "Nenhuma mensagem válida." }, { status: 400 });
  }
  const messages = flattenMessagesForLegacyComplete(normalized);

  const provider = (body.provider?.trim() || "anthropic") as ProviderId;
  const validProviders: ProviderId[] = ["anthropic", "openai", "google", "groq"];
  if (!validProviders.includes(provider)) {
    return NextResponse.json({ error: "Provedor inválido." }, { status: 400 });
  }

  const apiKey = pickApiKey(provider, body.clientApiKey);
  if (!apiKey) {
    return NextResponse.json(
      { error: "Chave API não configurada. Defina-a em Definições → Chaves e modelos." },
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

  const allowForUser = effectiveModelAllowlistForChat(appData, sessionRole, sessionUser);
  const modelList = effectiveModelsForProvider(provider, allowForUser);
  if (!modelList.length) {
    return NextResponse.json(
      { error: "Nenhum modelo disponível para este provedor." },
      { status: 400 }
    );
  }

  const defaultModel = modelList[0]?.id ?? DEFAULT_ANTHROPIC_MODEL_ID;
  let model = body.model?.trim() || defaultModel;
  if (!modelList.some((m) => m.id === model)) {
    model = defaultModel;
  }

  console.log("Calling model:", model, "provider:", provider);

  const systemRaw = typeof body.system === "string" ? body.system.trim() : "";
  const systemPrompt = prependModelIdentityToSystem(systemRaw, model, provider);

  try {
    const result = await completeForProvider(
      provider,
      apiKey,
      model,
      messages,
      systemPrompt
    );
    return NextResponse.json({
      text: result.text,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
    });
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    const statusMatch = raw.match(/HTTP (\d+)/);
    const status = statusMatch ? parseInt(statusMatch[1], 10) : 500;
    const colon = raw.indexOf(":");
    const bodyText = colon >= 0 ? raw.slice(colon + 1).trim() : raw;
    const ui = status >= 400 && status < 600 ? mapHttpErrorToUiMessage(status, bodyText) : raw;
    return NextResponse.json({ error: ui }, { status: 502 });
  }
}
