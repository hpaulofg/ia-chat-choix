import type { ReactNode } from "react";

/** Cartão centralizado (max 400px) para login / cadastro — alinhado ao tema da app. */
export function AuthCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`w-full max-w-[400px] rounded-2xl border border-[var(--app-border-strong)] bg-[var(--app-surface)] p-8 shadow-sm dark:bg-[#2b2b2b] ${className}`}
    >
      {children}
    </div>
  );
}

export function AuthLogo() {
  return (
    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#c45c2a] text-lg font-bold text-white dark:bg-[#e8a87c] dark:text-[#1a1a18]">
      AI
    </div>
  );
}

export const authInputClass =
  "w-full rounded-xl border border-[var(--app-border-strong)] bg-[var(--app-surface-2)] px-3 py-2.5 text-[15px] text-[var(--app-text)] placeholder:text-[var(--app-placeholder)] outline-none transition focus:border-[#c45c2a]/50 focus:ring-2 focus:ring-[#c45c2a]/20 dark:bg-[#1f1f1f]";
