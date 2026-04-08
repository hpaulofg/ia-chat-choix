import {
  DEFAULT_ENABLED_MODEL_IDS,
  modelsForProvider,
  type ProviderId,
} from "@/lib/provider-config";

/** localStorage keys for API keys (por pedido do produto). */
export const LS_API_KEY_ANTHROPIC = "api_key_anthropic";
export const LS_API_KEY_OPENAI = "api_key_openai";
export const LS_API_KEY_GEMINI = "api_key_gemini";
export const LS_API_KEY_GROQ = "api_key_groq";

export const LS_ENABLED_MODELS = "enabled_models";

export function storageKeyForProvider(p: ProviderId): string {
  switch (p) {
    case "anthropic":
      return LS_API_KEY_ANTHROPIC;
    case "openai":
      return LS_API_KEY_OPENAI;
    case "google":
      return LS_API_KEY_GEMINI;
    case "groq":
      return LS_API_KEY_GROQ;
    default:
      return LS_API_KEY_ANTHROPIC;
  }
}

export function getClientApiKey(provider: ProviderId): string | null {
  if (typeof window === "undefined") return null;
  try {
    const k = storageKeyForProvider(provider);
    const v = window.localStorage.getItem(k)?.trim();
    return v && v.length > 0 ? v : null;
  } catch {
    return null;
  }
}

export function setClientApiKey(provider: ProviderId, value: string): void {
  const k = storageKeyForProvider(provider);
  window.localStorage.setItem(k, value.trim());
}

export function removeClientApiKey(provider: ProviderId): void {
  window.localStorage.removeItem(storageKeyForProvider(provider));
}

export function isClientProviderConfigured(provider: ProviderId): boolean {
  return Boolean(getClientApiKey(provider));
}

/** Todos os IDs de modelo conhecidos (catálogo completo). */
export function allCatalogModelIds(): string[] {
  const ids: string[] = [];
  for (const p of ["anthropic", "openai", "google", "groq"] as ProviderId[]) {
    ids.push(...modelsForProvider(p).map((m) => m.id));
  }
  return ids;
}

/**
 * IDs ativos no chat (após normalizar `enabled_models` com {@link ensureEnabledModelsDefaults}).
 * No servidor devolve `null`. No cliente devolve sempre um array (nunca `null`).
 */
export function getEnabledModelIds(): string[] | null {
  if (typeof window === "undefined") return null;
  ensureEnabledModelsDefaults();
  try {
    const raw = window.localStorage.getItem(LS_ENABLED_MODELS);
    if (raw === null) {
      return [...DEFAULT_ENABLED_MODEL_IDS];
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [...DEFAULT_ENABLED_MODEL_IDS];
    }
    return parsed.filter((x): x is string => typeof x === "string");
  } catch {
    return [...DEFAULT_ENABLED_MODEL_IDS];
  }
}

export function setEnabledModelIds(ids: string[]): void {
  window.localStorage.setItem(LS_ENABLED_MODELS, JSON.stringify(ids));
}

/**
 * Garante `enabled_models` válido: chave em falta, JSON inválido, `[]` ou só IDs obsoletos
 * → repõe {@link DEFAULT_ENABLED_MODEL_IDS}. Remove IDs que já não estão no catálogo.
 */
export function ensureEnabledModelsDefaults(): void {
  if (typeof window === "undefined") return;
  const cat = new Set(allCatalogModelIds());
  const writeDefault = () =>
    window.localStorage.setItem(LS_ENABLED_MODELS, JSON.stringify([...DEFAULT_ENABLED_MODEL_IDS]));

  const raw = window.localStorage.getItem(LS_ENABLED_MODELS);
  if (raw === null) {
    writeDefault();
    return;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    writeDefault();
    return;
  }
  if (!Array.isArray(parsed)) {
    writeDefault();
    return;
  }
  const strings = parsed.filter((x): x is string => typeof x === "string");
  const cleaned = strings.filter((id) => cat.has(id));
  if (cleaned.length === 0) {
    writeDefault();
    return;
  }
  if (cleaned.length !== strings.length) {
    const merged = [...new Set([...cleaned, ...DEFAULT_ENABLED_MODEL_IDS])];
    window.localStorage.setItem(LS_ENABLED_MODELS, JSON.stringify(merged));
  }
}
