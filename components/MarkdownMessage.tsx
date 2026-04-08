"use client";

import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

type Props = { content: string; className?: string };

export function MarkdownMessage({ content, className = "" }: Props) {
  return (
    <div
      className={`markdown-msg text-[15px] leading-relaxed text-[var(--app-text)] ${className}`}
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
            <blockquote className="my-3 border-l-2 border-[#c45c2a] pl-4 text-[var(--app-text-secondary)] dark:border-[#e8a87c]">
              {children}
            </blockquote>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              className="font-medium text-[#b45309] underline decoration-[#e8b89a] underline-offset-2 hover:text-[#92400e] dark:text-[#f0b090] dark:decoration-[#8a5a40] dark:hover:text-[#ffd4b8]"
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto rounded-lg border border-[#ddd8cf] dark:border-[#3a3a34]">
              <table className="w-full border-collapse text-sm">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border-b border-[#ddd8cf] bg-[#ebe8e2] px-3 py-2 text-left font-semibold text-[#141413] dark:border-[#3a3a34] dark:bg-[#2a2a26] dark:text-[#f2f0ea]">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-b border-[#ebe8e2] px-3 py-2 text-[var(--app-text)] dark:border-[#2a2a26]">
              {children}
            </td>
          ),
          hr: () => <hr className="my-6 border-[#ddd8cf] dark:border-[#3a3a34]" />,
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
                className="rounded bg-[#ebe8e2] px-1.5 py-0.5 font-mono text-[0.9em] text-[var(--app-text)] dark:bg-[#2d2d28]"
                {...props}
              >
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="my-3 overflow-x-auto rounded-xl bg-[#1a1a18] p-4 font-mono text-sm text-[#f5f2eb] dark:bg-[#0d0d0c] [&_code]:bg-transparent [&_code]:p-0">
              {children}
            </pre>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
