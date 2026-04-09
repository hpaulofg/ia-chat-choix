"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function SettingsOverviewPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    void fetch("/api/auth/me")
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) {
          setIsAdmin(false);
          return;
        }
        setIsAdmin(Boolean(d.isAdmin));
      })
      .catch(() => setIsAdmin(false));
  }, []);

  return (
    <div className="space-y-10">
      <header className="space-y-2 text-center sm:text-left">
        <h2 className="text-2xl font-semibold tracking-tight text-[var(--app-text)] sm:text-3xl">
          Definições
        </h2>
        <p className="mx-auto max-w-xl text-sm font-medium leading-relaxed text-[var(--app-text-secondary)] sm:mx-0">
          Memória, projetos e conta. Administradores gerem também custos, utilizadores e chaves das IAs. O tema claro/escuro
          está no menu do perfil no chat.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
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
        <SettingsCard href="/settings/account" footer="Abrir →" icon={<IconTile glyph={<UserCircleCardGlyph />} />}>
          <h3 className="text-sm font-bold text-[var(--app-text)]">Minha conta</h3>
          <p className="mt-1 text-xs font-medium leading-relaxed text-[var(--app-text-secondary)]">
            Alterar a palavra-passe da sua conta no ficheiro de dados.
          </p>
        </SettingsCard>
        {isAdmin === true ? (
          <SettingsCard href="/settings/usage" footer="Abrir →" icon={<IconTile glyph={<ChartCardGlyph />} />}>
            <h3 className="text-sm font-bold text-[var(--app-text)]">Uso e custos</h3>
            <p className="mt-1 text-xs font-medium leading-relaxed text-[var(--app-text-secondary)]">
              Tokens, custos estimados e gráficos por modelo (dados neste navegador).
            </p>
          </SettingsCard>
        ) : null}
        {isAdmin === true ? (
          <SettingsCard href="/settings/users" footer="Abrir →" icon={<IconTile glyph={<UsersCardGlyph />} />}>
            <h3 className="text-sm font-bold text-[var(--app-text)]">Usuários</h3>
            <p className="mt-1 text-xs font-medium leading-relaxed text-[var(--app-text-secondary)]">
              Contas, senhas e níveis de acesso (admin, modelos completos ou limitados).
            </p>
          </SettingsCard>
        ) : null}
        {isAdmin === true ? (
          <SettingsCard href="/settings/api-keys" footer="Abrir →" icon={<IconTile glyph={<KeyCardGlyph />} />}>
            <h3 className="text-sm font-bold text-[var(--app-text)]">Chaves e modelos</h3>
            <p className="mt-1 text-xs font-medium leading-relaxed text-[var(--app-text-secondary)]">
              Anthropic, OpenAI, Gemini e Groq; modelos visíveis no seletor.
            </p>
          </SettingsCard>
        ) : null}
      </div>
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
  icon,
  children,
}: {
  href: string;
  footer: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
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

function UserCircleCardGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="8" r="3.25" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M5.5 19.5c.84-3.1 3.6-5 6.5-5s5.66 1.9 6.5 5"
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
