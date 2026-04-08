/**
 * Mensagens de erro amigáveis para a UI (chat e chamadas API).
 */
export const UI_MSG_INVALID_KEY = "Chave incorreta, verifique nas Definições";
export const UI_MSG_RATE_LIMIT = "Limite de uso atingido";
export const UI_MSG_NO_CONNECTION = "Sem conexão";

function isRateLimitStatus(status: number, body: string): boolean {
  if (status === 429) return true;
  const t = body.toLowerCase();
  return (
    t.includes("rate_limit") ||
    t.includes("rate limit") ||
    t.includes("too many requests") ||
    t.includes("resource_exhausted")
  );
}

function isAuthError(status: number, body: string): boolean {
  if (status === 401) return true;
  const t = body.toLowerCase();
  return (
    t.includes("invalid api key") ||
    t.includes("incorrect api key") ||
    t.includes("invalid_api_key") ||
    t.includes("api key not valid") ||
    t.includes("api_key_invalid") ||
    t.includes("permission_denied") ||
    (status === 403 && t.includes("unauthorized"))
  );
}

/** Mapeia falha de fetch/resposta HTTP para mensagem de UI. */
export function mapHttpErrorToUiMessage(status: number, body: string): string {
  if (isRateLimitStatus(status, body)) return UI_MSG_RATE_LIMIT;
  if (isAuthError(status, body)) return UI_MSG_INVALID_KEY;
  return body.trim().slice(0, 200) || `Erro HTTP ${status}`;
}

export function mapFetchFailureToUiMessage(err: unknown): string {
  if (err instanceof TypeError && err.message.toLowerCase().includes("fetch")) {
    return UI_MSG_NO_CONNECTION;
  }
  if (err instanceof DOMException && err.name === "AbortError") {
    return "Pedido cancelado.";
  }
  return err instanceof Error ? err.message : UI_MSG_NO_CONNECTION;
}

/** Erros vindos do SSE ou de `throw new Error("HTTP n: ...")` no servidor. */
export function mapStreamErrorToUiMessage(msg: string): string {
  const m = msg.match(/HTTP (\d+)/);
  if (m) {
    const status = parseInt(m[1], 10);
    const idx = msg.indexOf(":");
    const rest = idx >= 0 ? msg.slice(idx + 1).trim() : msg;
    return mapHttpErrorToUiMessage(status, rest);
  }
  const low = msg.toLowerCase();
  if (low.includes("failed to fetch") || low.includes("networkerror")) {
    return UI_MSG_NO_CONNECTION;
  }
  return msg;
}
