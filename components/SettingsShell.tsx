"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const NAV = [
  { href: "/settings", label: "Visão geral", Icon: LayoutGridIcon },
  { href: "/settings/usage", label: "Uso e custos", Icon: ChartIcon },
  { href: "/settings/users", label: "Usuários", Icon: UsersIcon, adminOnly: true },
  { href: "/settings/api-keys", label: "Chaves e modelos", Icon: KeyIcon, adminOnly: true },
  { href: "/settings/memory", label: "Memória", Icon: MemoryIcon },
  { href: "/settings/projects", label: "Projetos", Icon: FolderIcon },
] as const;

export function SettingsShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    void fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setIsAdmin(Boolean(d.isAdmin)))
      .catch(() => setIsAdmin(false));
  }, []);

  const navItems = useMemo(() => {
    return NAV.filter((item) => {
      const adminOnly = "adminOnly" in item && item.adminOnly;
      return !adminOnly || isAdmin !== false;
    });
  }, [isAdmin]);

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-[#fafafa] text-[var(--app-text)] transition-colors duration-200 dark:bg-[#212121]">
      <aside className="flex w-[260px] shrink-0 flex-col border-r border-[var(--app-border)] bg-[#f4f4f4] transition-colors dark:bg-[#171717] sm:w-[280px]">
        <div className="flex shrink-0 flex-col gap-1 border-b border-[var(--app-border)] px-3 py-3 dark:border-white/[0.08]">
          <Link
            href="/chat"
            className="inline-flex w-fit items-center gap-2 rounded-xl px-2 py-2 text-sm font-semibold text-[var(--app-text-secondary)] transition hover:bg-[var(--app-hover)] hover:text-[var(--app-text)]"
          >
            <ChevronLeftIcon className="text-[var(--app-text-muted)]" />
            Voltar ao chat
          </Link>
          <div className="flex items-center gap-2.5 px-1 pt-1">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-black/[0.06] dark:bg-white/[0.08]">
              <SettingsGlyph className="text-[var(--app-text)]" />
            </span>
            <div>
              <h1 className="text-base font-bold leading-tight tracking-tight text-[var(--app-text)]">
                Definições
              </h1>
              <p className="text-[11px] font-medium text-[var(--app-text-muted)]">
                Esta instância
              </p>
            </div>
          </div>
        </div>
        <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto p-2">
          {navItems.map((item) => {
            const active =
              item.href === "/settings"
                ? path === "/settings"
                : path.startsWith(item.href);
            const Icon = item.Icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-black/[0.07] font-semibold text-[var(--app-text)] shadow-sm dark:bg-white/[0.1]"
                    : "text-[var(--app-text-secondary)] hover:bg-[var(--app-hover)] hover:text-[var(--app-text)]"
                }`}
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
                    active
                      ? "bg-[#c45c2a]/12 text-[#b45309] dark:bg-[#e8a87c]/15 dark:text-[#e8a87c]"
                      : "bg-black/[0.04] text-[var(--app-text-muted)] group-hover:bg-black/[0.06] group-hover:text-[var(--app-text-secondary)] dark:bg-white/[0.05] dark:group-hover:bg-white/[0.08]"
                  }`}
                >
                  <Icon />
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8 md:px-8">{children}</div>
      </main>
    </div>
  );
}

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <path
        d="M15 6l-6 6 6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SettingsGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 15a3 3 0 100-6 3 3 0 000 6z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 19h16M7 15l3-6 4 5 4-9"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M7 19V9M14 19v-5M18 19V5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function LayoutGridIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="9" cy="7" r="3.25" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function KeyIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="7.5" cy="15.5" r="3.25" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M10.5 12.5L21 2M21 2h-4M21 2v4M16 7l1.5 1.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MemoryIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 19.5v-15A2.5 2.5 0 016.5 2H20v20H6.5a2.5 2.5 0 010-5H20"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 7h8M8 11h6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 8a2 2 0 012-2h3.5l1.5 2H19a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}
