import {
  CONVERSATIONS_STORAGE_KEY,
  LEGACY_CONVERSATIONS_STORAGE_KEY,
} from "@/lib/chat-storage-keys";

/** Lê conversas do Supabase via API. Fallback para localStorage se offline. */
export async function readConversationsFromSupabase(): Promise<unknown[] | null> {
  try {
    const res = await fetch("/api/conversations", { credentials: "include" });
    if (!res.ok) return null;
    const data = await res.json();
    return data.conversations ?? null;
  } catch {
    return null;
  }
}

/** Salva todas as conversas no Supabase via API. */
export async function writeConversationsToSupabase(conversations: unknown[]): Promise<void> {
  try {
    await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ conversations }),
    });
  } catch {
    /* ignore */
  }
}

/** Legado — mantido para compatibilidade durante migração */
export function readConversationsJsonFromStorage(): string | null {
  if (typeof window === "undefined") return null;
  try {
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
export function writeConversationsToStorage(conversations: unknown): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CONVERSATIONS_STORAGE_KEY, JSON.stringify(conversations));
  } catch {
    /* quota / private mode */
  }
}
