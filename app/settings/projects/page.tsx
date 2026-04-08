"use client";

import { useCallback, useEffect, useState } from "react";
import type { Conversation, ConversationProject } from "@/lib/types";
import {
  CONVERSATIONS_STORAGE_KEY,
  PROJECTS_STORAGE_KEY,
} from "@/lib/chat-storage-keys";

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function SettingsProjectsPage() {
  const [projects, setProjects] = useState<ConversationProject[]>([]);
  const [name, setName] = useState("");
  const [ready, setReady] = useState(false);
  const [removeConfirmId, setRemoveConfirmId] = useState<string | null>(null);

  const load = useCallback(() => {
    try {
      const raw = localStorage.getItem(PROJECTS_STORAGE_KEY);
      if (raw) {
        const p = JSON.parse(raw) as ConversationProject[];
        if (Array.isArray(p)) {
          setProjects(p);
          setReady(true);
          return;
        }
      }
    } catch {
      /* ignore */
    }
    setProjects([]);
    setReady(true);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- dados só no cliente
    load();
  }, [load]);

  function persist(next: ConversationProject[]) {
    setProjects(next);
    try {
      localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  function stripProjectFromConversations(projectId: string) {
    try {
      const raw = localStorage.getItem(CONVERSATIONS_STORAGE_KEY);
      if (!raw) return;
      const list = JSON.parse(raw) as Conversation[];
      if (!Array.isArray(list)) return;
      const next = list.map((c) =>
        c.projectId === projectId || c.groupId === projectId
          ? { ...c, projectId: null, groupId: null }
          : c
      );
      localStorage.setItem(CONVERSATIONS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  function onAdd(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    persist([...projects, { id: uid(), name: n }]);
    setName("");
  }

  function executeRemoveProject(id: string) {
    stripProjectFromConversations(id);
    persist(projects.filter((p) => p.id !== id));
    setRemoveConfirmId(null);
  }

  if (!ready) {
    return <p className="text-sm text-[var(--app-text-muted)]">A carregar…</p>;
  }

  return (
    <div>
      <h2 className="mb-1 text-xl font-bold text-[var(--app-text)]">Projetos</h2>
      <p className="mb-6 text-sm leading-relaxed text-[var(--app-text-secondary)]">
        Pastas para organizar conversas no painel do chat. Os dados ficam neste navegador.
      </p>

      <form onSubmit={onAdd} className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <label className="mb-1 block text-xs font-semibold text-[var(--app-text-secondary)]">
            Nome do projeto
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: Trabalho, Estudos…"
            className="w-full rounded-xl border border-[var(--app-border-strong)] bg-[var(--app-surface-2)] px-3 py-2.5 text-sm font-medium text-[var(--app-text)] placeholder:text-[var(--app-placeholder)]"
          />
        </div>
        <button
          type="submit"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#141413] px-4 py-2.5 text-sm font-semibold text-white dark:bg-[#ececec] dark:text-[#141413]"
        >
          Criar projeto
        </button>
      </form>

      <h3 className="mb-2 text-sm font-semibold text-[var(--app-text)]">Lista</h3>
      {projects.length === 0 ? (
        <p className="text-sm text-[var(--app-text-secondary)]">Ainda não há projetos.</p>
      ) : (
        <ul className="space-y-2">
          {projects.map((p) => (
            <li
              key={p.id}
              className="flex flex-col gap-2 rounded-xl border border-[var(--app-border-strong)] bg-[var(--app-surface-2)] px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="truncate text-sm font-semibold text-[var(--app-text)]">{p.name}</span>
              {removeConfirmId === p.id ? (
                <div className="flex shrink-0 flex-col gap-2 rounded-lg border border-red-200/70 bg-red-50/90 px-2.5 py-2 dark:border-red-900/50 dark:bg-red-950/40 sm:max-w-[280px]">
                  <span className="text-xs font-medium text-red-800 dark:text-red-200">
                    Apagar este projeto? As conversas ficam sem pasta.
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => executeRemoveProject(p.id)}
                      className="rounded-md bg-red-700 px-2.5 py-1 text-xs font-bold text-white dark:bg-red-600"
                    >
                      Apagar
                    </button>
                    <button
                      type="button"
                      onClick={() => setRemoveConfirmId(null)}
                      className="rounded-md border border-[var(--app-border-strong)] px-2.5 py-1 text-xs font-semibold text-[var(--app-text-secondary)]"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setRemoveConfirmId(p.id)}
                  className="shrink-0 self-start rounded-lg border border-[var(--app-border)] px-2 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/30 sm:self-center"
                >
                  Excluir
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
