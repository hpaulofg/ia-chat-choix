"use client";

import { memo, useCallback, useRef, useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

function tableToTsv(table: HTMLTableElement): string {
  const rows = Array.from(table.querySelectorAll("tr"));
  return rows
    .map((tr) =>
      Array.from(tr.querySelectorAll("th, td"))
        .map((cell) =>
          (cell as HTMLElement).innerText
            .replace(/\r?\n/g, " ")
            .replace(/\t/g, " ")
            .trim(),
        )
        .join("\t"),
    )
    .join("\n");
}

function MarkdownTableBlock({
  isCode,
  children,
}: {
  isCode: boolean;
  children: ReactNode;
}) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  const copyTable = useCallback(() => {
    const table = innerRef.current?.querySelector("table");
    if (!table) return;
    const tsv = tableToTsv(table);
    void navigator.clipboard.writeText(tsv).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    });
  }, []);

  return (
    <div className="group/mdtable relative my-3 flex w-full max-w-full min-w-0 items-stretch gap-2">
      <div
        ref={innerRef}
        className={`min-w-0 flex-1 overflow-x-auto rounded-lg border ${isCode ? "border-[#30363d] bg-[#161b22]" : "border-[#ddd8cf] bg-[var(--app-surface)] dark:border-[#3a3a34] dark:bg-[#1e1e1e]"}`}
      >
        <table className="markdown-msg-table w-full min-w-max border-collapse text-sm">
          {children}
        </table>
      </div>
      <div className="flex shrink-0 flex-col justify-center self-stretch pl-0 opacity-100 sm:opacity-0 sm:transition-opacity sm:duration-150 sm:group-hover/mdtable:opacity-100">
        <button
          type="button"
          onClick={copyTable}
          title={copied ? "Copiado" : "Copiar tabela (TSV)"}
          className={`pointer-events-auto flex h-8 w-8 items-center justify-center rounded-lg border text-[var(--app-text-secondary)] shadow-sm transition hover:bg-[var(--app-hover)] hover:text-[var(--app-text)] sm:mt-1 ${
            isCode
              ? "border-[#30363d] bg-[#21262d] hover:border-[#22c55e]/40 hover:text-[#22c55e]"
              : "border-[var(--app-border-strong)] bg-[var(--app-surface-2)] dark:border-white/[0.12] dark:bg-[#2a2a2a]"
          } ${copied ? "border-[#22c55e]/50 text-[#22c55e]" : ""}`}
          aria-label={copied ? "Tabela copiada" : "Copiar tabela"}
        >
          {copied ? (
            <CheckIcon className="h-4 w-4" />
          ) : (
            <CopyTableIcon className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );
}

function CopyTableIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8 8V6a2 2 0 012-2h8a2 2 0 012 2v10a2 2 0 01-2 2h-2M8 8H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2M8 8h8a2 2 0 012 2v2"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M20 6L9 17l-5-5"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type Props = {
  content: string;
  className?: string;
  variant?: "default" | "codeStudio";
  streaming?: boolean;
};

export const MarkdownMessage = memo(
  function MarkdownMessage({
    content,
    className = "",
    variant = "default",
    streaming = false,
  }: Props) {
    const isCode = variant === "codeStudio";

    if (streaming) {
      return (
        <div
          className={`markdown-streaming markdown-msg font-sans text-[15px] leading-relaxed text-[var(--app-text)] ${className}`}
        >
          <p className="mb-0 max-w-full whitespace-pre-wrap leading-relaxed">{content}</p>
        </div>
      );
    }

    return (
      <div
        className={`markdown-msg markdown-msg-rendered font-sans text-[15px] leading-relaxed text-[var(--app-text)] ${className}`}
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkBreaks]}
          components={{
            p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
            ul: ({ children }) => (
              <ul className="mb-3 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>
            ),
            ol: ({ children }) => (
              <ol className="mb-3 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>
            ),
            li: ({ children }) => <li className="leading-relaxed">{children}</li>,
            h1: ({ children }) => (
              <h1 className="mb-2 mt-4 text-xl font-semibold text-[var(--app-text)] first:mt-0">
                {children}
              </h1>
            ),
            h2: ({ children }) => (
              <h2 className="mb-2 mt-4 text-lg font-semibold text-[var(--app-text)] first:mt-0">
                {children}
              </h2>
            ),
            h3: ({ children }) => (
              <h3 className="mb-2 mt-3 text-base font-semibold text-[var(--app-text)] first:mt-0">
                {children}
              </h3>
            ),
            blockquote: ({ children }) => (
              <blockquote
                className={`my-3 border-l-2 pl-4 text-[var(--app-text-secondary)] ${isCode ? "border-[#22c55e] text-[#8b949e]" : "border-[#c45c2a] dark:border-[#e8a87c]"}`}
              >
                {children}
              </blockquote>
            ),
            a: ({ href, children }) => (
              <a
                href={href}
                className={
                  isCode
                    ? "font-medium text-[#22c55e] underline decoration-[#22c55e]/50 underline-offset-2 hover:text-[#4ade80]"
                    : "font-medium text-[#b45309] underline decoration-[#e8b89a] underline-offset-2 hover:text-[#92400e] dark:text-[#f0b090] dark:decoration-[#8a5a40] dark:hover:text-[#ffd4b8]"
                }
                target="_blank"
                rel="noopener noreferrer"
              >
                {children}
              </a>
            ),
            table: ({ children }) => (
              <MarkdownTableBlock isCode={isCode}>{children}</MarkdownTableBlock>
            ),
            th: ({ children }) => (
              <th
                className={`min-w-[9rem] max-w-[min(28rem,45vw)] border px-4 py-2.5 text-left align-top text-xs font-semibold uppercase tracking-wide ${isCode ? "border-[#30363d] bg-[#21262d] text-[#e6edf3]" : "border-[#ddd8cf] bg-[#ebe8e2] text-[#141413] dark:border-[#3a3a34] dark:bg-[#2a2a26] dark:text-[#f2f0ea]"}`}
              >
                {children}
              </th>
            ),
            td: ({ children }) => (
              <td
                className={`min-w-[9rem] max-w-[min(28rem,45vw)] border px-4 py-2.5 align-top text-[var(--app-text)] ${isCode ? "border-[#30363d] bg-[#161b22]/80" : "border-[#ebe8e2] dark:border-[#2a2a26] dark:bg-transparent"}`}
              >
                {children}
              </td>
            ),
            hr: () => (
              <hr
                className={
                  isCode ? "my-6 border-[#30363d]" : "my-6 border-[#ddd8cf] dark:border-[#3a3a34]"
                }
              />
            ),
            code: ({ className, children, ...props }) => {
              const isBlock = Boolean(className?.includes("language-"));
              if (isBlock) {
                return (
                  <code className={`${className} block`} {...props}>
                    {children}
                  </code>
                );
              }
              return (
                <code
                  className={
                    isCode
                      ? "rounded bg-[#21262d] px-1.5 py-0.5 font-mono text-[0.9em] text-[#79c0ff]"
                      : "rounded bg-[#ebe8e2] px-1.5 py-0.5 font-mono text-[0.9em] text-[var(--app-text)] dark:bg-[#2d2d28]"
                  }
                  {...props}
                >
                  {children}
                </code>
              );
            },
            pre: ({ children }) => (
              <pre
                className={
                  isCode
                    ? "my-3 overflow-x-auto rounded-lg border border-[#22c55e]/35 bg-[#010409] p-4 font-mono text-[13px] leading-relaxed text-[#e6edf3] shadow-inner shadow-black/40 ring-1 ring-[#22c55e]/20 [&_code]:bg-transparent [&_code]:p-0"
                    : "my-3 overflow-x-auto rounded-xl bg-[#1a1a18] p-4 font-mono text-sm text-[#f5f2eb] dark:bg-[#0d0d0c] [&_code]:bg-transparent [&_code]:p-0"
                }
              >
                {children}
              </pre>
            ),
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    );
  },
  (prev, next) => {
    if (prev.streaming !== next.streaming) return false;
    if (prev.variant !== next.variant) return false;
    if (prev.className !== next.className) return false;
    return prev.content === next.content;
  },
);
