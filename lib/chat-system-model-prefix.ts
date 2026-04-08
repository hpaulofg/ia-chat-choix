import { PROVIDER_LABELS, type ProviderId } from "@/lib/provider-config";

const MAX_SYSTEM_CHARS = 12_000;

/**
 * Prefixo obrigatório com ID do modelo e provedor; o restante do system fica dentro do limite total.
 */
export function prependModelIdentityToSystem(
  systemRaw: string,
  model: string,
  provider: ProviderId
): string {
  const providerLabel = PROVIDER_LABELS[provider] ?? provider;
  const prefix =
    `Você está rodando como ${model} via ${providerLabel}. ` +
    `Quando perguntado qual modelo você é, responda com esse ID exato.\n\n`;
  const restBudget = Math.max(0, MAX_SYSTEM_CHARS - prefix.length);
  const rest = systemRaw.trim().slice(0, restBudget);
  return prefix + rest;
}
