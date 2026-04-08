"use client";

import { getClientApiKey, getEnabledModelIds } from "@/lib/client-api-storage";
import type { ProviderId } from "@/lib/provider-config";

export type ProviderRowMerged = {
  id: string;
  label: string;
  models: { id: string; label: string; description?: string }[];
  configured: boolean;
};

/**
 * Aplica chaves do localStorage e filtro `enabled_models` à resposta de `/api/chat/providers`.
 */
export function mergeChatProviderRows(serverRows: ProviderRowMerged[]): ProviderRowMerged[] {
  const enabled = getEnabledModelIds();

  return serverRows.map((row) => {
    const pid = row.id as ProviderId;
    let models = row.models;
    if (enabled !== null && enabled.length > 0) {
      const allow = new Set(enabled);
      models = models.filter((m) => allow.has(m.id));
    }
    const configured = Boolean(getClientApiKey(pid) || row.configured);
    return { ...row, models, configured };
  });
}
