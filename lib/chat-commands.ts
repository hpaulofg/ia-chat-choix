export type DocKind = "brief" | "code" | "plan";

export type ParsedChatCommand =
  | { kind: "none" }
  | { kind: "salvar"; payload: string }
  | { kind: "doc"; docType: DocKind; context: string };

const DOC_PROMPTS: Record<DocKind, (ctx: string) => string> = {
  brief: (ctx) =>
    `Crie um brief completo de projeto em português, bem estruturado (objetivos, público, entregáveis, cronograma sugerido), para: ${ctx}`,
  code: (ctx) =>
    `Gere código com documentação inline comentada, em português onde fizer sentido, para: ${ctx}`,
  plan: (ctx) =>
    `Monte um plano de execução detalhado em português (fases, tarefas, riscos, métricas) para: ${ctx}`,
};

export function docUserPrompt(docType: DocKind, context: string): string {
  return DOC_PROMPTS[docType](context.trim() || "o pedido do utilizador");
}

/**
 * /salvar [instrução:] texto — acrescenta às instruções permanentes.
 * /doc [brief|code|plan] contexto — gera documento (tipo opcional, default code).
 */
export function parseChatCommand(raw: string): ParsedChatCommand {
  const t = raw.trim();
  if (!t.startsWith("/")) return { kind: "none" };

  if (t.startsWith("/salvar")) {
    let rest = t.slice("/salvar".length).trim();
    const low = rest.toLowerCase();
    if (low.startsWith("instrução:")) rest = rest.slice(11).trim();
    else if (low.startsWith("instrucao:")) rest = rest.slice(10).trim();
    return { kind: "salvar", payload: rest };
  }

  if (t.startsWith("/doc")) {
    let rest = t.slice(4).trim();
    let docType: DocKind = "code";
    const first = rest.split(/\s+/)[0]?.toLowerCase();
    if (first === "brief" || first === "code" || first === "plan") {
      docType = first;
      rest = rest.slice(first.length).trim();
    }
    return { kind: "doc", docType, context: rest };
  }

  return { kind: "none" };
}
