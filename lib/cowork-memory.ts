import { COWORK_MEMORY_KEY } from "@/lib/chat-storage-keys";

export type CoworkMemory = {
  userName?: string;
  company?: string;
  area?: string;
  instructions?: string;
  projects?: string;
  style?: string;
};

const MAX_SYSTEM = 12_000;
/** Groq: TPM baixo; ~200 tokens no system (~750 chars em PT). */
const GROQ_SYSTEM_MAX_CHARS = 750;

export function loadCoworkMemory(): CoworkMemory {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(COWORK_MEMORY_KEY);
    if (!raw) return {};
    const o = JSON.parse(raw) as Record<string, unknown>;
    if (!o || typeof o !== "object") return {};
    const out: CoworkMemory = {};
    for (const k of ["userName", "company", "area", "instructions", "projects", "style"] as const) {
      const v = o[k];
      if (typeof v === "string") out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

export function saveCoworkMemoryPatch(patch: Partial<CoworkMemory>): void {
  if (typeof window === "undefined") return;
  const prev = loadCoworkMemory();
  const next = { ...prev, ...patch };
  try {
    localStorage.setItem(COWORK_MEMORY_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function appendCoworkInstruction(line: string): void {
  const m = loadCoworkMemory();
  const cur = (m.instructions ?? "").trim();
  const add = line.trim();
  if (!add) return;
  saveCoworkMemoryPatch({
    instructions: cur ? `${cur}\n${add}` : add,
  });
}

export function buildSystemPrompt(memory: CoworkMemory, provider?: string): string {
  const text = `
Você é um assistente de trabalho personalizado.

## Sobre o usuário
Nome: ${memory.userName?.trim() || "não definido"}
Empresa: ${memory.company?.trim() || "não definido"}
Área: ${memory.area?.trim() || "não definido"}

## Memória global (definições — todas as conversas)
${(memory.instructions?.trim() || "nenhuma ainda").slice(0, 8000)}

## Contexto de projetos ativos
${(memory.projects?.trim() || "nenhum ainda").slice(0, 4000)}

## Tom e estilo
${memory.style?.trim() || "profissional e direto"}
`.trim();

  let out = text.length > MAX_SYSTEM ? text.slice(0, MAX_SYSTEM) : text;
  if (provider === "groq" && out.length > GROQ_SYSTEM_MAX_CHARS) {
    out = out.slice(0, GROQ_SYSTEM_MAX_CHARS);
  }
  return out;
}
