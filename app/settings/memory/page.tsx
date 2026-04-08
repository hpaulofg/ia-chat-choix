"use client";

import { useCallback, useEffect, useState } from "react";
import type { CoworkMemory } from "@/lib/cowork-memory";
import { loadCoworkMemory, saveCoworkMemoryPatch } from "@/lib/cowork-memory";
import type { CoworkDoc } from "@/lib/cowork-docs";
import { loadCoworkDocs, removeCoworkDoc } from "@/lib/cowork-docs";

export default function MemorySettingsPage() {
  const [mem, setMem] = useState<CoworkMemory>(() => loadCoworkMemory());
  const [docs, setDocs] = useState<CoworkDoc[]>(() => loadCoworkDocs());
  const [showExtras, setShowExtras] = useState(false);

  const refreshFromStorage = useCallback(() => {
    setMem(loadCoworkMemory());
    setDocs(loadCoworkDocs());
  }, []);

  useEffect(() => {
    function onFocus() {
      refreshFromStorage();
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refreshFromStorage]);

  function persistInstructions(value: string) {
    saveCoworkMemoryPatch({ instructions: value.trim() });
    setMem(loadCoworkMemory());
  }

  function persistField<K extends keyof CoworkMemory>(key: K, value: string) {
    saveCoworkMemoryPatch({ [key]: value } as Partial<CoworkMemory>);
    setMem(loadCoworkMemory());
  }

  return (
    <div className="space-y-10">
      <div className="text-center sm:text-left">
        <h2 className="text-2xl font-semibold tracking-tight text-[var(--app-text)] sm:text-3xl">
          Memória global
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-sm font-medium leading-relaxed text-[var(--app-text-secondary)] sm:mx-0">
          O texto abaixo é injetado no system prompt de{" "}
          <strong className="font-semibold text-[var(--app-text)]">todas</strong> as conversas. No
          chat, <kbd className="rounded-md border border-black/[0.1] bg-black/[0.04] px-1.5 py-0.5 font-mono text-[11px] dark:border-white/[0.12] dark:bg-white/[0.08]">/salvar</kbd> acrescenta linhas a esta memória e{" "}
          <kbd className="rounded-md border border-black/[0.1] bg-black/[0.04] px-1.5 py-0.5 font-mono text-[11px] dark:border-white/[0.12] dark:bg-white/[0.08]">/doc</kbd> gera documentos listados em baixo.
        </p>
      </div>

      <div className="rounded-[28px] border border-[var(--app-border-strong)] bg-[var(--app-surface)] shadow-sm transition-shadow focus-within:border-[#c45c2a]/40 focus-within:shadow-md dark:bg-[#303030]">
        <label className="block px-4 pb-4 pt-4 sm:px-5 sm:pt-5">
          <span className="text-xs font-bold uppercase tracking-wide text-[var(--app-text-muted)]">
            Texto para o modelo (system prompt)
          </span>
          <textarea
            rows={10}
            className="mt-2 min-h-[200px] w-full resize-y bg-transparent text-[15px] leading-relaxed text-[var(--app-text)] placeholder:text-[var(--app-placeholder)] outline-none"
            value={mem.instructions ?? ""}
            placeholder="Ex.: Responde sempre em português de Portugal. Prioriza bullet points. …"
            onChange={(e) => setMem((m) => ({ ...m, instructions: e.target.value }))}
            onBlur={(e) => persistInstructions(e.currentTarget.value)}
          />
        </label>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--app-border)] px-4 py-3 dark:border-white/[0.08] sm:px-5">
          <button
            type="button"
            onClick={() => persistInstructions(mem.instructions ?? "")}
            className="rounded-full bg-[#141413] px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#2d2d2d] dark:bg-[#ececec] dark:text-[#141413] dark:hover:bg-white"
          >
            Guardar memória
          </button>
        </div>
      </div>

      <div>
        <button
          type="button"
          onClick={() => setShowExtras((v) => !v)}
          className="flex w-full items-center justify-between rounded-xl border border-[var(--app-border-strong)] bg-[var(--app-surface-2)] px-4 py-3 text-left text-sm font-bold text-[var(--app-text)] transition hover:bg-[var(--app-hover)] dark:bg-[#262626]"
        >
          <span>Perfil e contexto adicional</span>
          <span className="text-[var(--app-text-muted)]">{showExtras ? "▲" : "▼"}</span>
        </button>
        {showExtras ? (
          <div className="mt-3 space-y-4 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 dark:border-white/[0.08] dark:bg-[#2b2b2b]">
            {(
              [
                ["userName", "Nome"],
                ["company", "Empresa"],
                ["area", "Área"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-[var(--app-text-muted)]">
                  {label}
                </span>
                <input
                  className="mt-1.5 w-full rounded-xl border border-[var(--app-border-strong)] bg-[#fafafa] px-3 py-2.5 text-sm text-[var(--app-text)] outline-none transition focus:border-[#c45c2a]/50 focus:ring-2 focus:ring-[#c45c2a]/20 dark:bg-[#1f1f1f]"
                  value={mem[key] ?? ""}
                  onChange={(e) => setMem((m) => ({ ...m, [key]: e.target.value }))}
                  onBlur={(e) => persistField(key, e.currentTarget.value.trim())}
                />
              </label>
            ))}
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-[var(--app-text-muted)]">
                Projetos ativos
              </span>
              <textarea
                rows={3}
                className="mt-1.5 w-full resize-y rounded-xl border border-[var(--app-border-strong)] bg-[#fafafa] px-3 py-2.5 text-sm text-[var(--app-text)] outline-none transition focus:border-[#c45c2a]/50 focus:ring-2 focus:ring-[#c45c2a]/20 dark:bg-[#1f1f1f]"
                value={mem.projects ?? ""}
                onChange={(e) => setMem((m) => ({ ...m, projects: e.target.value }))}
                onBlur={(e) => persistField("projects", e.currentTarget.value.trim())}
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-[var(--app-text-muted)]">
                Tom e estilo
              </span>
              <input
                className="mt-1.5 w-full rounded-xl border border-[var(--app-border-strong)] bg-[#fafafa] px-3 py-2.5 text-sm text-[var(--app-text)] outline-none transition focus:border-[#c45c2a]/50 focus:ring-2 focus:ring-[#c45c2a]/20 dark:bg-[#1f1f1f]"
                value={mem.style ?? ""}
                placeholder="profissional e direto"
                onChange={(e) => setMem((m) => ({ ...m, style: e.target.value }))}
                onBlur={(e) => persistField("style", e.currentTarget.value.trim())}
              />
            </label>
          </div>
        ) : null}
      </div>

      <section>
        <h3 className="text-lg font-semibold text-[var(--app-text)]">Documentos</h3>
        <p className="mt-1 text-sm text-[var(--app-text-secondary)]">
          Gerados com <code className="text-xs">/doc</code> no chat.
        </p>
        {docs.length === 0 ? (
          <p className="mt-6 rounded-2xl border border-dashed border-[var(--app-border-strong)] px-4 py-8 text-center text-sm font-medium text-[var(--app-text-muted)]">
            Ainda não há documentos.
          </p>
        ) : (
          <ul className="mt-4 space-y-4">
            {docs.map((d) => (
              <li
                key={d.id}
                className="max-w-[42rem] rounded-2xl border border-black/[0.08] bg-white px-4 py-3 shadow-sm dark:border-white/[0.1] dark:bg-[#2b2b2b]"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-semibold text-[var(--app-text)]">{d.title}</p>
                    <p className="text-[11px] font-medium text-[var(--app-text-muted)]">
                      {d.type} · {new Date(d.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-lg border border-[var(--app-border-strong)] px-3 py-1.5 text-[11px] font-bold transition hover:bg-[var(--app-hover)]"
                      onClick={() => {
                        void navigator.clipboard.writeText(d.content);
                      }}
                    >
                      Copiar
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-red-300/50 px-3 py-1.5 text-[11px] font-bold text-red-700 transition hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/40"
                      onClick={() => {
                        removeCoworkDoc(d.id);
                        setDocs(loadCoworkDocs());
                      }}
                    >
                      Remover
                    </button>
                  </div>
                </div>
                <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap break-words text-xs leading-relaxed text-[var(--app-text-secondary)]">
                  {d.content.slice(0, 1200)}
                  {d.content.length > 1200 ? "…" : ""}
                </pre>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
