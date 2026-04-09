import {
  CONVERSATIONS_DEV_STORAGE_KEY,
  CONVERSATIONS_STORAGE_KEY,
  LEGACY_CONVERSATIONS_STORAGE_KEY,
} from "@/lib/chat-storage-keys";

export type ConversationPersistScope = "chat" | "dev";

/** Lê conversas do Supabase via API. Fallback para localStorage se offline. */
export async function readConversationsFromSupabase(
  scope: ConversationPersistScope = "chat",
): Promise<unknown[] | null> {
  try {
    const q = scope === "dev" ? "?type=dev" : "";
    const res = await fetch(`/api/conversations${q}`, { credentials: "include" });
    if (!res.ok) return null;
    const data = await res.json();
    return data.conversations ?? null;
  } catch {
    return null;
  }
}

/** Salva todas as conversas no Supabase via API. */
export async function writeConversationsToSupabase(
  conversations: unknown[],
  scope: ConversationPersistScope = "chat",
): Promise<void> {
  try {
    await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ conversations, type: scope === "dev" ? "dev" : "chat" }),
    });
  } catch {
    /* ignore */
  }
}

/** Legado — mantido para compatibilidade durante migração */
export function readConversationsJsonFromStorage(
  scope: ConversationPersistScope = "chat",
): string | null {
  if (typeof window === "undefined") return null;
  try {
    if (scope === "dev") {
      const dev = localStorage.getItem(CONVERSATIONS_DEV_STORAGE_KEY);
      if (dev !== null) return dev;
    }
    const cur = localStorage.getItem(CONVERSATIONS_STORAGE_KEY);
    if (cur !== null) return cur;
    const leg = localStorage.getItem(LEGACY_CONVERSATIONS_STORAGE_KEY);
    if (leg !== null) {
      localStorage.setItem(CONVERSATIONS_STORAGE_KEY, leg);
      return leg;
    }
    return null;
  } catch {
    return null;
  }
}

/** Legado — mantido para compatibilidade durante migração */
export function writeConversationsToStorage(
  conversations: unknown,
  scope: ConversationPersistScope = "chat",
): void {
  if (typeof window === "undefined") return;
  try {
    const key =
      scope === "dev" ? CONVERSATIONS_DEV_STORAGE_KEY : CONVERSATIONS_STORAGE_KEY;
    localStorage.setItem(key, JSON.stringify(conversations));
  } catch {
    /* quota / private mode */
  }
}
