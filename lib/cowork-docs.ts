import { COWORK_DOCS_KEY } from "@/lib/chat-storage-keys";
import type { DocKind } from "@/lib/chat-commands";

export type CoworkDoc = {
  id: string;
  type: DocKind;
  title: string;
  content: string;
  createdAt: string;
};

export function loadCoworkDocs(): CoworkDoc[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(COWORK_DOCS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (x): x is CoworkDoc =>
        x &&
        typeof x === "object" &&
        typeof (x as CoworkDoc).id === "string" &&
        typeof (x as CoworkDoc).content === "string"
    );
  } catch {
    return [];
  }
}

export function removeCoworkDoc(id: string): void {
  const list = loadCoworkDocs().filter((d) => d.id !== id);
  try {
    localStorage.setItem(COWORK_DOCS_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

export function pushCoworkDoc(doc: Omit<CoworkDoc, "id" | "createdAt"> & { id?: string }): CoworkDoc {
  const full: CoworkDoc = {
    id: doc.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    type: doc.type,
    title: doc.title,
    content: doc.content,
    createdAt: new Date().toISOString(),
  };
  const list = loadCoworkDocs();
  list.unshift(full);
  try {
    localStorage.setItem(COWORK_DOCS_KEY, JSON.stringify(list.slice(0, 200)));
  } catch {
    /* ignore */
  }
  return full;
}
