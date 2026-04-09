import DOMPurify from "dompurify";
import hljs from "highlight.js";
import { Marked, type Tokens } from "marked";

export function closeOpenCodeBlocks(raw: string): string {
  const count = (raw.match(/```/g) || []).length;
  return count % 2 !== 0 ? `${raw}\n\`\`\`` : raw;
}

const streamMarked = new Marked();

streamMarked.setOptions({ breaks: true, gfm: true });

streamMarked.use({
  renderer: {
    code({ text, lang }: Tokens.Code): string {
      const body = text.replace(/\n$/, "") + "\n";
      let highlighted: string;
      const language = lang?.trim();
      if (language && hljs.getLanguage(language)) {
        highlighted = hljs.highlight(body, { language }).value;
      } else {
        highlighted = hljs.highlightAuto(body).value;
      }
      const safeLang = language?.replace(/[^a-z0-9_-]/gi, "") ?? "";
      const cls = safeLang ? `hljs language-${safeLang}` : "hljs";
      return `<pre><code class="${cls}">${highlighted}</code></pre>\n`;
    },
  },
});

export function parseStreamingMarkdownToHtml(markdown: string): string {
  const safeRaw = closeOpenCodeBlocks(markdown);
  return streamMarked.parse(safeRaw, { async: false }) as string;
}

const PURIFY = {
  ALLOWED_TAGS: [
    "a",
    "blockquote",
    "br",
    "code",
    "del",
    "em",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "hr",
    "input",
    "li",
    "ol",
    "p",
    "pre",
    "span",
    "strong",
    "table",
    "tbody",
    "td",
    "th",
    "thead",
    "tr",
    "ul",
  ],
  ALLOWED_ATTR: [
    "href",
    "title",
    "target",
    "rel",
    "class",
    "align",
    "checked",
    "disabled",
    "type",
    "start",
  ],
  ALLOW_DATA_ATTR: false,
};

export function sanitizeStreamingHtml(html: string): string {
  if (typeof window === "undefined") return "";
  return DOMPurify.sanitize(html, PURIFY);
}
