import type { MessageAttachment } from "@/lib/types";

export type IncomingAttachment = {
  id?: string;
  name?: string;
  type?: string;
  size?: number;
  base64?: string;
};

export type IncomingMsg = {
  role: string;
  content?: string;
  attachments?: IncomingAttachment[];
};

export type NormalizedChatMsg = {
  role: "user" | "assistant";
  content: string;
  attachments?: MessageAttachment[];
};

function sanitizeAttachment(a: IncomingAttachment): MessageAttachment | null {
  const base64 = typeof a.base64 === "string" ? a.base64.trim() : "";
  if (!base64) return null;
  const name = typeof a.name === "string" && a.name.trim() ? a.name.trim() : "anexo";
  const type = typeof a.type === "string" && a.type.trim() ? a.type.trim() : "application/octet-stream";
  const size = typeof a.size === "number" && a.size >= 0 ? a.size : 0;
  const id =
    typeof a.id === "string" && a.id.trim()
      ? a.id.trim()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  return { id, name, type, size, base64 };
}

/**
 * Normaliza mensagens do cliente para a API. Preserva anexos; só funde mensagens
 * consecutivas do mesmo papel quando **ambas** não têm anexos.
 */
export function normalizeChatMessages(raw: IncomingMsg[]): NormalizedChatMsg[] {
  const out: NormalizedChatMsg[] = [];
  for (const m of raw) {
    if (m.role !== "user" && m.role !== "assistant") continue;
    const content = typeof m.content === "string" ? m.content : "";
    const attachments = Array.isArray(m.attachments)
      ? m.attachments.map(sanitizeAttachment).filter(Boolean) as MessageAttachment[]
      : [];
    const trimmed = content.trim();
    if (m.role === "assistant") {
      if (!trimmed) continue;
      const last = out[out.length - 1];
      if (last && last.role === "assistant" && !last.attachments?.length) {
        last.content = `${last.content}\n\n${trimmed}`;
      } else {
        out.push({ role: "assistant", content: trimmed });
      }
      continue;
    }
    if (!trimmed && attachments.length === 0) continue;
    const last = out[out.length - 1];
    if (
      last &&
      last.role === "user" &&
      !last.attachments?.length &&
      attachments.length === 0
    ) {
      last.content = last.content.trim()
        ? `${last.content.trim()}\n\n${trimmed}`
        : trimmed;
    } else {
      out.push({
        role: "user",
        content: trimmed,
        attachments: attachments.length ? attachments : undefined,
      });
    }
  }
  while (out.length && out[0].role === "assistant") out.shift();
  return out;
}

export function messageHasImageAttachment(m: NormalizedChatMsg): boolean {
  return Boolean(m.attachments?.some((a) => a.type.toLowerCase().startsWith("image/")));
}

export function base64ToUtf8(b64: string): string {
  try {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  } catch {
    return "";
  }
}

/** Para `/api/chat/complete` (não-multimodal): texto + ficheiros como texto; imagens como aviso. */
export function flattenMessagesForLegacyComplete(
  messages: NormalizedChatMsg[]
): { role: "user" | "assistant"; content: string }[] {
  return messages.map((m) => {
    if (m.role === "assistant") return { role: "assistant", content: m.content };
    const bits: string[] = [];
    if (m.content.trim()) bits.push(m.content.trim());
    for (const a of m.attachments ?? []) {
      if (a.type.toLowerCase().startsWith("image/")) {
        bits.push(
          `[Imagem anexada: "${a.name}". O endpoint completo não envia binários ao modelo; use o chat normal ou descreva a imagem.]`
        );
      } else if (a.type.toLowerCase() === "application/pdf") {
        bits.push(
          `[PDF "${a.name}": o endpoint completo não envia o ficheiro ao modelo; use o chat em streaming.]`
        );
      } else {
        const d = base64ToUtf8(a.base64);
        bits.push(d.trim() ? `--- ${a.name} ---\n${d}` : `--- ${a.name} ---`);
      }
    }
    return { role: "user", content: bits.join("\n\n").trim() || "(vazio)" };
  });
}
