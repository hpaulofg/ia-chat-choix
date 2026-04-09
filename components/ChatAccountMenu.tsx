"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useChatTheme } from "@/hooks/use-chat-theme";
import { parseUserFromEmail } from "@/lib/user-display";

export function ChatAccountMenu({
  email,
  profileLoading = false,
  onLogout,
}: {
  email: string | null;
  /** Enquanto true, mostra skeleton em vez de derivar nome/email do perfil (evita flash "Utilizador / Sem email"). */
  profileLoading?: boolean;
  onLogout: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const { theme, setTheme, ready } = useChatTheme();
  const { displayName, initials } = parseUserFromEmail(email);
  const isDark = theme === "dark";

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) close();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => {
          if (profileLoading) return;
          setOpen((o) => !o);
        }}
        disabled={profileLoading}
        aria-expanded={open}
        aria-busy={profileLoading}
        aria-haspopup="menu"
        className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-[var(--app-hover)] disabled:cursor-default disabled:opacity-100"
      >
        {profileLoading ? (
          <>
            <span
              className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-[var(--app-surface-2)] dark:bg-white/[0.12]"
              aria-hidden
            />
            <div className="min-w-0 flex-1 space-y-2 py-0.5">
              <div className="h-3.5 w-[7.5rem] max-w-[70%] animate-pulse rounded-md bg-[var(--app-surface-2)] dark:bg-white/[0.12]" />
              <div className="h-3 w-[10rem] max-w-[85%] animate-pulse rounded-md bg-[var(--app-surface-2)] dark:bg-white/[0.12]" />
            </div>
            <ChevronIcon className="shrink-0 text-[var(--app-text-muted)] opacity-40" open={false} />
          </>
        ) : (
          <>
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#c45c2a] text-[11px] font-bold text-white dark:bg-[#3b82f6]"
              aria-hidden
            >
              {initials}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-[var(--app-text)]">{displayName}</p>
              <p className="truncate text-xs font-medium text-[var(--app-text-muted)]">
                {email ?? "Sem email"}
              </p>
            </div>
            <ChevronIcon className="shrink-0 text-[var(--app-text-muted)]" open={open} />
          </>
        )}
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute bottom-full left-0 right-0 z-[100] mb-2 overflow-hidden rounded-2xl border border-[var(--app-border-strong)] bg-[var(--app-surface)] py-1.5 shadow-2xl dark:border-white/[0.08] dark:bg-[#1f1f1f]"
        >
          <div className="px-3.5 pb-2 pt-1">
            {email ? (
              <p className="truncate text-[13px] font-medium leading-snug text-[var(--app-text-muted)]">
                {email}
              </p>
            ) : (
              <p className="truncate text-[13px] font-semibold text-[var(--app-text)]">{displayName}</p>
            )}
          </div>

          <div className="mx-2 border-t border-[var(--app-border)] dark:border-white/[0.06]" />

          <div className="px-2 py-1.5">
            <div className="flex items-center justify-between gap-3 rounded-lg px-2.5 py-2">
              <span className="flex min-w-0 items-center gap-2.5 text-sm font-medium text-[var(--app-text)]">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-black/[0.04] text-[var(--app-text-secondary)] dark:bg-white/[0.06]">
                  <ThemeGlyph />
                </span>
                <span className="truncate">Tema escuro</span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={isDark}
                aria-label={isDark ? "Mudar para tema claro" : "Mudar para tema escuro"}
                disabled={!ready}
                onClick={() => setTheme(isDark ? "light" : "dark")}
                className="relative h-7 w-12 shrink-0 rounded-full border border-[var(--app-border-strong)] bg-[var(--app-surface-2)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c45c2a]/40 disabled:opacity-50 dark:border-white/[0.1] dark:bg-[#2a2a2a]"
              >
                <span
                  className={`absolute top-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-md transition-transform duration-200 ease-out dark:bg-[#f4f4f4] ${
                    isDark ? "translate-x-[1.375rem]" : "translate-x-0.5"
                  }`}
                  aria-hidden
                >
                  {isDark ? <MoonTiny /> : <SunTiny />}
                </span>
              </button>
            </div>
          </div>

          <div className="mx-2 border-t border-[var(--app-border)] dark:border-white/[0.06]" />

          <div className="px-1.5 py-1">
            <Link
              href="/settings"
              role="menuitem"
              onClick={close}
              className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-2.5 text-sm font-medium text-[var(--app-text)] transition hover:bg-[var(--app-hover)]"
            >
              <span className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center text-[var(--app-text-muted)]">
                  <GearSm />
                </span>
                Configurações
              </span>
              <kbd className="hidden shrink-0 rounded-md border border-[var(--app-border-strong)] bg-[var(--app-surface-2)] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[var(--app-text-muted)] sm:inline dark:border-white/[0.1] dark:bg-[#2a2a2a]">
                Ctrl+,
              </kbd>
            </Link>
          </div>

          <div className="mx-2 border-t border-[var(--app-border)] dark:border-white/[0.06]" />

          <div className="px-1.5 pb-0.5 pt-1">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                close();
                void onLogout();
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left text-sm font-semibold text-[#c45c2a] transition hover:bg-[#c45c2a]/10 dark:text-[#e8a87c] dark:hover:bg-[#e8a87c]/10"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center">
                <LogoutSm />
              </span>
              Sair
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ChevronIcon({ className, open }: { className?: string; open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      className={`transition-transform ${open ? "rotate-180" : ""} ${className ?? ""}`}
      aria-hidden
    >
      <path
        d="M6 9l6 6 6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ThemeGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3v2M12 19v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M3 12h2M19 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function SunTiny() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-amber-600" aria-hidden>
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
      <path
        d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MoonTiny() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-slate-600" aria-hidden>
      <path
        d="M21 14.5A8.5 8.5 0 0110.5 4a8.44 8.44 0 014.35 7.79 4 4 0 006.15 2.71z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function GearSm() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 15a3 3 0 100-6 3 3 0 000 6z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LogoutSm() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
