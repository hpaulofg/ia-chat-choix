/**
 * Texto mostrado enquanto a resposta faz stream: remove marcadores Markdown
 * para não exibir **, #, `, tabelas GFM, ---, etc.
 */

function isTableSeparatorLine(line: string): boolean {
  const t = line.trim();
  if (!t.includes("|") || !/-/.test(t)) return false;
  return /^[\s|:\-+]+$/.test(t);
}

/** Converte linhas de tabela GFM em texto corrido (células separadas por " · "). */
function flattenGfmTablesAndHorizontalRules(text: string): string {
  const lines = text.split("\n");
  const out: string[] = [];

  for (const line of lines) {
    const trimmedEnd = line.trimEnd();
    const trimmed = trimmedEnd.trim();

    // HR sozinha na linha: ---, ***, ___
    if (/^(\*{3,}|-{3,}|_{3,})\s*$/.test(trimmed)) {
      continue;
    }

    if (isTableSeparatorLine(trimmedEnd)) {
      continue;
    }

    // Linha de tabela: começa com | ou tem padrão | ... | ... |
    const pipeRow =
      /^\s*\|/.test(line) &&
      trimmed.includes("|") &&
      trimmed.split("|").filter((c) => c.trim().length > 0).length >= 2;

    if (pipeRow) {
      const cells = trimmed
        .split("|")
        .map((c) => c.trim())
        .filter((c) => c.length > 0);
      if (cells.length >= 2) {
        out.push(cells.join(" · "));
        continue;
      }
      if (cells.length === 1) {
        out.push(cells[0]!);
        continue;
      }
      const inner = trimmed.replace(/^\|+|\|+$/g, "").trim();
      if (inner) {
        out.push(inner);
        continue;
      }
    }

    out.push(line);
  }

  return out.join("\n");
}

export function stripMarkdownSyntaxForStream(text: string): string {
  let s = text;

  s = flattenGfmTablesAndHorizontalRules(s);

  // Blocos de código fence (mantém o interior, sem os delimitadores)
  s = s.replace(/```(?:\w+)?\n?([\s\S]*?)```/g, "$1");

  // Código inline
  s = s.replace(/`([^`]+)`/g, "$1");

  // Negrito / itálico GFM comuns
  s = s.replace(/\*\*([^*]+)\*\*/g, "$1");
  s = s.replace(/__([^_]+)__/g, "$1");
  s = s.replace(/\*([^*\n]+)\*/g, "$1");
  s = s.replace(/_([^_\n]+)_/g, "$1");

  // Links [texto](url) e imagens ![alt](url)
  s = s.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1");
  s = s.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");

  // Cabeçalhos no início de linha
  s = s.replace(/^#{1,6}\s+/gm, "");

  // Riscado
  s = s.replace(/~~([^~]+)~~/g, "$1");

  // Listas: traço ou número no início de linha (mantém o texto)
  s = s.replace(/^\s*[-*+]\s+/gm, "");
  s = s.replace(/^\s*\d+\.\s+/gm, "");

  // Marcadores partidos no fim do chunk (streaming)
  s = s.replace(/\*\*([^*]*)$/g, "$1");
  s = s.replace(/\*([^*]*)$/g, "$1");
  s = s.replace(/__([^_]*)$/g, "$1");
  s = s.replace(/`([^`]*)$/g, "$1");

  // Pipes soltos no fim (tabela a meio)
  s = s.replace(/\|+\s*$/g, "");
  s = s.replace(/^\s*\|+/g, "");

  return s;
}
