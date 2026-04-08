import {
  modelsForProvider,
  type ModelOption,
  type ProviderId,
} from "@/lib/provider-config";

export type ModelAllowlist = Partial<Record<ProviderId, string[]>>;

export function sanitizeModelAllowlist(raw: unknown): ModelAllowlist {
  if (!raw || typeof raw !== "object") return {};
  const ids: ProviderId[] = ["anthropic", "openai", "google", "groq"];
  const out: ModelAllowlist = {};
  const o = raw as Record<string, unknown>;
  for (const id of ids) {
    const v = o[id];
    if (Array.isArray(v)) {
      const idsOnly = v.filter((x): x is string => typeof x === "string");
      out[id] = idsOnly;
    }
  }
  return out;
}

/** Lista efetiva: provedor em falta na allowlist ⇒ catálogo completo; array vazio ⇒ nenhum modelo. */
export function effectiveModelsForProvider(
  provider: ProviderId,
  allowlist: ModelAllowlist | undefined
): ModelOption[] {
  const all = modelsForProvider(provider);
  const picked = allowlist?.[provider];
  if (picked === undefined) return all;
  if (picked.length === 0) return [];
  const set = new Set(picked);
  return all.filter((m) => set.has(m.id));
}
