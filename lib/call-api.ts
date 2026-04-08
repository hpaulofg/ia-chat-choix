"use client";

import { mapFetchFailureToUiMessage, mapHttpErrorToUiMessage } from "@/lib/api-ui-errors";
import { getClientApiKey } from "@/lib/client-api-storage";
import type { ProviderId } from "@/lib/provider-config";

export type CallAPIMessage = { role: "user" | "assistant"; content: string };

/**
 * Chamada central não-streaming: usa chave do localStorage (ou fallback no servidor)
 * via `/api/chat/complete`.
 */
export async function callAPI(
  messages: CallAPIMessage[],
  model: string,
  provider: ProviderId,
  systemPrompt: string
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const clientApiKey = getClientApiKey(provider) ?? undefined;
  try {
    console.log("Calling model:", model, "provider:", provider);
    const res = await fetch("/api/chat/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages,
        model,
        provider,
        system: systemPrompt,
        clientApiKey,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      text?: string;
      inputTokens?: number;
      outputTokens?: number;
    };
    if (!res.ok) {
      const err =
        typeof data.error === "string" && data.error
          ? data.error
          : mapHttpErrorToUiMessage(res.status, JSON.stringify(data));
      throw new Error(err);
    }
    return {
      text: String(data.text ?? ""),
      inputTokens: Number(data.inputTokens) || 0,
      outputTokens: Number(data.outputTokens) || 0,
    };
  } catch (e) {
    if (e instanceof Error) {
      const m = e.message.toLowerCase();
      if (!m.includes("failed to fetch") && !m.includes("networkerror")) {
        throw e;
      }
    }
    throw new Error(mapFetchFailureToUiMessage(e));
  }
}
