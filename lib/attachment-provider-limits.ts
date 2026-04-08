/** Tamanho aproximado em bytes do binário representado por base64 cru (sem prefixo data:). */
export function approximateBytesFromBase64(b64: string): number {
  let padding = 0;
  if (b64.endsWith("==")) padding = 2;
  else if (b64.endsWith("=")) padding = 1;
  return Math.max(0, Math.floor((b64.length * 3) / 4) - padding);
}

const MB = 1024 * 1024;

/** Anthropic: até 5 MB por imagem, máx. 20 imagens. OpenAI/Gemini: 20 MB por imagem. Groq: sem anexos. */
export function validateAttachmentsForSend(
  provider: string,
  attachments: { type: string; name: string; base64: string }[]
): string | null {
  if (provider === "groq") {
    if (attachments.length > 0) return "Este modelo não suporta anexos";
    return null;
  }

  const imageMaxBytes = provider === "anthropic" ? 5 * MB : 20 * MB;
  const maxImages = provider === "anthropic" ? 20 : Number.POSITIVE_INFINITY;
  let imageCount = 0;

  for (const a of attachments) {
    const bytes = approximateBytesFromBase64(a.base64);
    const isImage = a.type.toLowerCase().startsWith("image/");
    if (isImage) {
      imageCount += 1;
      if (imageCount > maxImages) {
        return "No máximo 20 imagens por mensagem (Anthropic).";
      }
      if (bytes > imageMaxBytes) {
        return provider === "anthropic"
          ? `Cada imagem deve ter no máximo 5 MB («${a.name}»).`
          : `Cada imagem deve ter no máximo 20 MB («${a.name}»).`;
      }
    } else if (bytes > 20 * MB) {
      return `O ficheiro «${a.name}» excede 20 MB.`;
    }
  }
  return null;
}
