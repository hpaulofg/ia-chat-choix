import {
  CONVERSATIONS_STORAGE_KEY,
  LEGACY_CONVERSATIONS_STORAGE_KEY,
} from "@/lib/chat-storage-keys";

/**
 * Lê o JSON guardado: primeiro `conversations`, senão migra de `ai-chat-platform-conversations`.
 */
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

/** Grava o array completo de conversas (inclui `messages` de cada uma). */
export function writeConversationsToStorage(conversations: unknown): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CONVERSATIONS_STORAGE_KEY, JSON.stringify(conversations));
  } catch {
    /* quota / private mode */
  }
}
