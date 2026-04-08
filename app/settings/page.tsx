"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useChatTheme } from "@/hooks/use-chat-theme";

export default function SettingsOverviewPage() {
  const { theme, setTheme, ready } = useChatTheme();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    void fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setIsAdmin(Boolean(d.isAdmin)))
      .catch(() => setIsAdmin(false));
  }, []);

  return (
    <div className="space-y-10">
      <header className="space-y-2 text-center sm:text-left">
        <h2 className="text-2xl font-semibold tracking-tight text-[var(--app-text)] sm:text-3xl">
          Definições
        </h2>
        <p className="mx-auto max-w-xl text-sm font-medium leading-relaxed text-[var(--app-text-secondary)] sm:mx-0">
          Contas, chaves das IAs, memória global e pastas de conversas — o mesmo aspeto visual do chat.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        <SettingsCard href="/settings" footer="Está aqui" samePage icon={<IconTile glyph={<SunMoonGlyph />} />}>
          <h3 className="text-sm font-bold text-[var(--app-text)]">Aparência</h3>
          <p className="mt-1 text-xs font-medium leading-relaxed text-[var(--app-text-secondary)]">
            Tema claro ou escuro; sincronizado com o menu do perfil no chat.
          </p>
        </SettingsCard>
        {isAdmin !== false ? (
          <SettingsCard href="/settings/users" footer="Abrir →" icon={<IconTile glyph={<UsersCardGlyph />} />}>
            <h3 className="text-sm font-bold text-[var(--app-text)]">Usuários</h3>
            <p className="mt-1 text-xs font-medium leading-relaxed text-[var(--app-text-secondary)]">
              Contas, senhas e níveis de acesso (admin, modelos completos ou limitados).
            </p>
          </SettingsCard>
        ) : null}
        {isAdmin !== false ? (
          <SettingsCard href="/settings/api-keys" footer="Abrir →" icon={<IconTile glyph={<KeyCardGlyph />} />}>
            <h3 className="text-sm font-bold text-[var(--app-text)]">Chaves e modelos</h3>
            <p className="mt-1 text-xs font-medium leading-relaxed text-[var(--app-text-secondary)]">
              Anthropic, OpenAI, Gemini e Groq; modelos visíveis no seletor.
            </p>
          </SettingsCard>
        ) : null}
        <SettingsCard href="/settings/usage" footer="Abrir →" icon={<IconTile glyph={<ChartCardGlyph />} />}>
          <h3 className="text-sm font-bold text-[var(--app-text)]">Uso e custos</h3>
          <p className="mt-1 text-xs font-medium leading-relaxed text-[var(--app-text-secondary)]">
            Tokens, custos estimados e gráficos por modelo (dados neste navegador).
          </p>
        </SettingsCard>
        <SettingsCard href="/settings/memory" footer="Abrir →" icon={<IconTile glyph={<MemoryCardGlyph />} />}>
          <h3 className="text-sm font-bold text-[var(--app-text)]">Memória</h3>
          <p className="mt-1 text-xs font-medium leading-relaxed text-[var(--app-text-secondary)]">
            Texto injetado no system prompt de todas as conversas e documentos /doc.
          </p>
        </SettingsCard>
        <SettingsCard href="/settings/projects" footer="Abrir →" icon={<IconTile glyph={<FolderCardGlyph />} />}>
          <h3 className="text-sm font-bold text-[var(--app-text)]">Projetos</h3>
          <p className="mt-1 text-xs font-medium leading-relaxed text-[var(--app-text-secondary)]">
            Pastas na barra lateral do chat para organizar conversas.
          </p>
        </SettingsCard>
      </div>

      <section>
        <h3 className="text-lg font-semibold text-[var(--app-text)]">Tema</h3>
        <p className="mt-1 text-sm font-medium leading-relaxed text-[var(--app-text-secondary)]">
          O mesmo controlo está no menu do seu perfil no chat; aqui pode ajustar sem sair desta página.
        </p>
        <div className="mt-4 rounded-[28px] border border-[var(--app-border-strong)] bg-[var(--app-surface)] p-4 shadow-sm dark:bg-[#303030] sm:p-5">
          {!ready ? (
            <p className="text-sm font-medium text-[var(--app-text-muted)]">A carregar…</p>
          ) : (
            <fieldset>
              <legend className="sr-only">Escolher tema</legend>
              <div className="flex flex-col gap-2">
                <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-2)] px-4 py-3.5 transition hover:border-[#c45c2a]/30 dark:bg-[#262626] dark:hover:border-[#e8a87c]/25">
                  <input
                    type="radio"
                    name="theme"
                    checked={theme === "light"}
                    onChange={() => setTheme("light")}
                    className="h-4 w-4 shrink-0 accent-[#c45c2a]"
                  />
                  <span className="flex flex-1 items-center gap-2 text-sm font-semibold text-[var(--app-text)]">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200">
                      <SunGlyph />
                    </span>
                    Claro
                  </span>
                </label>
                <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-2)] px-4 py-3.5 transition hover:border-[#c45c2a]/30 dark:bg-[#262626] dark:hover:border-[#e8a87c]/25">
                  <input
                    type="radio"
                    name="theme"
                    checked={theme === "dark"}
                    onChange={() => setTheme("dark")}
                    className="h-4 w-4 shrink-0 accent-[#e8a87c]"
                  />
                  <span className="flex flex-1 items-center gap-2 text-sm font-semibold text-[var(--app-text)]">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-700 text-slate-100 dark:bg-slate-800 dark:text-slate-200">
                      <MoonGlyph />
                    </span>
                    Escuro
                  </span>
                </label>
              </div>
            </fieldset>
          )}
        </div>
      </section>
    </div>
  );
}

function IconTile({ glyph }: { glyph: ReactNode }) {
  return (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#c45c2a]/10 text-[#b45309] dark:bg-[#e8a87c]/12 dark:text-[#e8a87c]">
      {glyph}
    </span>
  );
}

function SettingsCard({
  href,
  footer,
  samePage,
  icon,
  children,
}: {
  href: string;
  footer: string;
  samePage?: boolean;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={samePage ? "page" : undefined}
      className="group flex flex-col rounded-2xl border border-black/[0.08] bg-white p-4 shadow-sm transition hover:border-[#c45c2a]/35 hover:shadow-md dark:border-white/[0.1] dark:bg-[#2b2b2b] dark:hover:border-[#e8a87c]/30"
    >
      <div className="mb-3 flex items-start gap-3">
        {icon}
        <div className="min-w-0 flex-1">{children}</div>
      </div>
      <span className="text-xs font-bold text-[#b45309] dark:text-[#e8a87c]">{footer}</span>
    </Link>
  );
}

function SunMoonGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function UsersCardGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
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

function ChartCardGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
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

function KeyCardGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
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

function MemoryCardGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 19.5v-15A2.5 2.5 0 016.5 2H20v20H6.5a2.5 2.5 0 010-5H20"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M8 7h8M8 11h6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function FolderCardGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 8a2 2 0 012-2h3.5l1.5 2H19a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SunGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MoonGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M21 14.5A8.5 8.5 0 0110.5 4a8.44 8.44 0 014.35 7.79 4 4 0 006.15 2.71z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
