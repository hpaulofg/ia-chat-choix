"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  allCatalogModelIds,
  ensureEnabledModelsDefaults,
  getClientApiKey,
  getEnabledModelIds,
  isClientProviderConfigured,
  removeClientApiKey,
  setClientApiKey,
  setEnabledModelIds,
  storageKeyForProvider,
} from "@/lib/client-api-storage";
import { modelsForProvider, type ProviderId } from "@/lib/provider-config";

const PROVIDER_ORDER: ProviderId[] = ["anthropic", "openai", "google", "groq"];

const PROVIDER_TITLES: Record<ProviderId, string> = {
  anthropic: "Anthropic (Claude)",
  openai: "OpenAI (GPT)",
  google: "Google Gemini",
  groq: "Groq",
};

function dispatchLsUpdate() {
  window.dispatchEvent(new Event("ai-chat-ls-update"));
}

export default function SettingsApiKeysPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [lsBump, setLsBump] = useState(0);
  const refresh = useCallback(() => setLsBump((n) => n + 1), []);

  const [draftAnthropic, setDraftAnthropic] = useState("");
  const [draftOpenai, setDraftOpenai] = useState("");
  const [draftGoogle, setDraftGoogle] = useState("");
  const [draftGroq, setDraftGroq] = useState("");

  const [editAnthropic, setEditAnthropic] = useState(false);
  const [editOpenai, setEditOpenai] = useState(false);
  const [editGoogle, setEditGoogle] = useState(false);
  const [editGroq, setEditGroq] = useState(false);

  const [showAnthropic, setShowAnthropic] = useState(false);
  const [showOpenai, setShowOpenai] = useState(false);
  const [showGoogle, setShowGoogle] = useState(false);
  const [showGroq, setShowGroq] = useState(false);

  const [geminiListBusy, setGeminiListBusy] = useState(false);
  const [geminiListNames, setGeminiListNames] = useState<string[] | null>(null);
  const [geminiListIds, setGeminiListIds] = useState<string[] | null>(null);
  const [geminiListErr, setGeminiListErr] = useState("");

  useEffect(() => {
    void fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setIsAdmin(Boolean(d.isAdmin)))
      .catch(() => setIsAdmin(false));
  }, []);

  const enabledIds = useMemo(() => {
    void lsBump;
    if (typeof window === "undefined" || isAdmin !== true) {
      return new Set<string>();
    }
    ensureEnabledModelsDefaults();
    const ids = getEnabledModelIds();
    return new Set(ids ?? allCatalogModelIds());
  }, [isAdmin, lsBump]);

  function toggleModel(modelId: string, on: boolean) {
    const next = new Set(enabledIds);
    if (on) next.add(modelId);
    else next.delete(modelId);
    setEnabledModelIds([...next]);
    setLsBump((n) => n + 1);
    dispatchLsUpdate();
  }

  function resetProviderModels(pid: ProviderId) {
    const next = new Set(enabledIds);
    for (const m of modelsForProvider(pid)) {
      next.add(m.id);
    }
    setEnabledModelIds([...next]);
    setLsBump((n) => n + 1);
    dispatchLsUpdate();
  }

  function draftFor(pid: ProviderId): [string, (s: string) => void] {
    switch (pid) {
      case "anthropic":
        return [draftAnthropic, setDraftAnthropic];
      case "openai":
        return [draftOpenai, setDraftOpenai];
      case "google":
        return [draftGoogle, setDraftGoogle];
      case "groq":
        return [draftGroq, setDraftGroq];
    }
  }

  function editFor(pid: ProviderId): [boolean, (v: boolean) => void] {
    switch (pid) {
      case "anthropic":
        return [editAnthropic, setEditAnthropic];
      case "openai":
        return [editOpenai, setEditOpenai];
      case "google":
        return [editGoogle, setEditGoogle];
      case "groq":
        return [editGroq, setEditGroq];
    }
  }

  function showFor(pid: ProviderId): [boolean, (v: boolean) => void] {
    switch (pid) {
      case "anthropic":
        return [showAnthropic, setShowAnthropic];
      case "openai":
        return [showOpenai, setShowOpenai];
      case "google":
        return [showGoogle, setShowGoogle];
      case "groq":
        return [showGroq, setShowGroq];
    }
  }

  function saveKey(pid: ProviderId) {
    setMsg("");
    setErr("");
    const [draft, setDraft] = draftFor(pid);
    const t = draft.trim();
    if (!t) {
      setErr("Cole ou escreva uma chave antes de guardar.");
      return;
    }
    setClientApiKey(pid, t);
    setDraft("");
    const [, setEdit] = editFor(pid);
    setEdit(false);
    const [, setShow] = showFor(pid);
    setShow(false);
    refresh();
    dispatchLsUpdate();
    setMsg("Chave guardada neste navegador.");
  }

  async function listGeminiModelsDiagnostic() {
    setGeminiListErr("");
    setGeminiListNames(null);
    setGeminiListIds(null);
    setGeminiListBusy(true);
    try {
      const key = getClientApiKey("google")?.trim() ?? "";
      const r = await fetch("/api/settings/gemini-list-models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: key }),
      });
      const j = (await r.json()) as {
        names?: string[];
        ids?: string[];
        error?: string;
      };
      if (!r.ok) {
        throw new Error(j.error || `HTTP ${r.status}`);
      }
      setGeminiListNames(j.names ?? []);
      setGeminiListIds(j.ids ?? []);
    } catch (e) {
      setGeminiListErr(e instanceof Error ? e.message : String(e));
    } finally {
      setGeminiListBusy(false);
    }
  }

  function onRemoveKeyChecked(pid: ProviderId, checked: boolean) {
    if (!checked) return;
    removeClientApiKey(pid);
    const [, setDraft] = draftFor(pid);
    setDraft("");
    const [, setEdit] = editFor(pid);
    setEdit(false);
    const [, setShow] = showFor(pid);
    setShow(false);
    refresh();
    dispatchLsUpdate();
    setMsg("Chave removida do navegador.");
  }

  const field =
    "w-full rounded-xl border border-[#ccc6bc] bg-white px-3 py-2.5 text-sm text-[#141413] placeholder:text-[#6b6b66] dark:border-[#3a3a34] dark:bg-[#22221e] dark:text-[#f2f0ea] dark:placeholder:text-[#8a8680]";

  if (isAdmin === false) {
    return (
      <div className="rounded-2xl border border-[var(--app-border-strong)] bg-[var(--app-surface)] p-8 text-center shadow-sm dark:bg-[#2b2b2b]">
        <p className="text-sm font-semibold text-[var(--app-text)]">Acesso restrito</p>
        <p className="mt-2 text-sm leading-relaxed text-[var(--app-text-secondary)]">
          Apenas administradores podem ver e editar chaves API e a lista de modelos.
        </p>
        <Link
          href="/settings"
          className="mt-6 inline-flex rounded-full bg-[#141413] px-5 py-2.5 text-sm font-bold text-white dark:bg-[#ececec] dark:text-[#141413]"
        >
          Voltar à visão geral
        </Link>
      </div>
    );
  }

  if (isAdmin === null) {
    return (
      <p className="text-sm text-[#5c5c58] dark:text-[#9a9890]">A carregar…</p>
    );
  }

  return (
    <div>
      <h2 className="mb-1 text-xl font-bold text-[#141413] dark:text-[#f2f0ea]">
        Chaves de API e modelos
      </h2>
      <p className="mb-2 text-sm leading-relaxed text-[#3d3d38] dark:text-[#b8b4a8]">
        As chaves ficam apenas no <strong className="font-semibold">localStorage</strong> deste
        navegador (<code className="rounded bg-[#ebe8e2] px-1 text-xs dark:bg-[#2a2a26]">
          {storageKeyForProvider("anthropic")}
        </code>
        , <code className="rounded bg-[#ebe8e2] px-1 text-xs dark:bg-[#2a2a26]">api_key_openai</code>
        , <code className="rounded bg-[#ebe8e2] px-1 text-xs dark:bg-[#2a2a26]">api_key_gemini</code>
        , <code className="rounded bg-[#ebe8e2] px-1 text-xs dark:bg-[#2a2a26]">api_key_groq</code>
        ). O servidor pode ainda usar chaves em ficheiro ou{" "}
        <code className="rounded bg-[#ebe8e2] px-1 text-xs dark:bg-[#2a2a26]">.env</code> se não
        enviar chave a partir deste browser.
      </p>
      <p className="mb-6 text-sm leading-relaxed text-[#3d3d38] dark:text-[#b8b4a8]">
        Os modelos visíveis no chat seguem a lista guardada em{" "}
        <code className="rounded bg-[#ebe8e2] px-1 text-xs dark:bg-[#2a2a26]">enabled_models</code>{" "}
        (IDs ativos).
      </p>

      {err ? (
        <p className="mb-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {err}
        </p>
      ) : null}
      {msg ? (
        <p className="mb-4 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
          {msg}
        </p>
      ) : null}

      <div className="space-y-8">
        {PROVIDER_ORDER.map((pid) => {
          const configured = isClientProviderConfigured(pid);
          const [draft, setDraft] = draftFor(pid);
          const [editing, setEditing] = editFor(pid);
          const [revealed, setRevealed] = showFor(pid);
          const stored = getClientApiKey(pid);
          const showInput = !configured || editing;

          return (
            <div
              key={pid}
              className="rounded-xl border border-[#ddd8cf] bg-[#faf9f5] p-4 dark:border-[#3a3a34] dark:bg-[#22221e]"
            >
              <h3 className="mb-1 text-sm font-semibold text-[#141413] dark:text-[#f2f0ea]">
                {PROVIDER_TITLES[pid]}
              </h3>
              <p className="mb-2 text-xs text-[#3d3d38] dark:text-[#9a9890]">
                Estado:{" "}
                <span className="font-medium text-[#141413] dark:text-[#f2f0ea]">
                  {configured ? "configurado" : "não configurado"}
                </span>
              </p>

              {!showInput && stored ? (
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span
                    className="rounded-lg border border-[#ccc6bc] bg-white px-3 py-2 font-mono text-sm tracking-widest dark:border-[#3a3a34] dark:bg-[#1a1a18]"
                    aria-hidden
                  >
                    {revealed ? stored : "••••••••"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setRevealed(!revealed)}
                    className="rounded-lg border border-[#ccc6bc] px-3 py-2 text-xs font-semibold text-[#141413] dark:border-[#3a3a34] dark:text-[#f2f0ea]"
                  >
                    {revealed ? "Ocultar" : "Revelar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(true);
                      setDraft("");
                      setRevealed(false);
                    }}
                    className="rounded-lg bg-[#1a1a18] px-3 py-2 text-xs font-semibold text-[#faf9f5] dark:bg-[#e8a87c] dark:text-[#1a1a18]"
                  >
                    Alterar chave
                  </button>
                </div>
              ) : (
                <input
                  type="password"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Cole a chave API"
                  className={`${field} mb-3`}
                  autoComplete="off"
                />
              )}

              {(showInput || draft.trim().length > 0) && (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => saveKey(pid)}
                    className="rounded-xl bg-[#1a1a18] px-4 py-2 text-sm font-semibold text-[#faf9f5] transition hover:bg-[#333] dark:bg-[#e8a87c] dark:text-[#1a1a18] dark:hover:bg-[#d4956a]"
                  >
                    Salvar chave
                  </button>
                </div>
              )}

              <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-[#3d3d38] dark:text-[#b8b4a8]">
                <input
                  key={`rm-${pid}-${configured}`}
                  type="checkbox"
                  onChange={(e) => onRemoveKeyChecked(pid, e.target.checked)}
                  className="h-4 w-4 accent-[#c45c2a] dark:accent-[#e8a87c]"
                />
                Remover chave
              </label>

              {pid === "google" ? (
                <div className="mt-4 rounded-xl border border-dashed border-[#c45c2a]/40 bg-[#faf9f5] p-3 dark:border-[#e8a87c]/35 dark:bg-[#1a1a18]">
                  <p className="mb-2 text-xs leading-relaxed text-[#3d3d38] dark:text-[#b8b4a8]">
                    Diagnóstico temporário: o mesmo pedido que{" "}
                    <code className="rounded bg-[#ebe8e2] px-1 text-[10px] dark:bg-[#2a2a26]">
                      GET …/v1beta/models?key=…
                    </code>{" "}
                    (executado no servidor por CORS). Usa a chave guardada neste navegador; se estiver vazia, tenta a
                    chave do servidor.
                  </p>
                  <button
                    type="button"
                    disabled={geminiListBusy}
                    onClick={() => void listGeminiModelsDiagnostic()}
                    className="rounded-lg border border-[#ccc6bc] bg-white px-3 py-2 text-xs font-semibold text-[#141413] disabled:opacity-50 dark:border-[#3a3a34] dark:bg-[#22221e] dark:text-[#f2f0ea]"
                  >
                    {geminiListBusy ? "A listar…" : "Listar modelos Gemini"}
                  </button>
                  {geminiListErr ? (
                    <p className="mt-2 text-xs text-red-700 dark:text-red-300">{geminiListErr}</p>
                  ) : null}
                  {geminiListNames && geminiListNames.length > 0 ? (
                    <div className="mt-3 space-y-2">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-[#5c5c58] dark:text-[#9a9890]">
                        name (resposta API)
                      </p>
                      <pre className="max-h-48 overflow-auto rounded-lg border border-[#ddd8cf] bg-white p-2 font-mono text-[10px] leading-relaxed text-[#141413] dark:border-[#3a3a34] dark:bg-[#0d0d0c] dark:text-[#e8e4dc]">
                        {JSON.stringify(geminiListNames, null, 2)}
                      </pre>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-[#5c5c58] dark:text-[#9a9890]">
                        IDs para o path (sem prefixo models/)
                      </p>
                      <pre className="max-h-48 overflow-auto rounded-lg border border-[#ddd8cf] bg-white p-2 font-mono text-[10px] leading-relaxed text-[#141413] dark:border-[#3a3a34] dark:bg-[#0d0d0c] dark:text-[#e8e4dc]">
                        {JSON.stringify(geminiListIds ?? [], null, 2)}
                      </pre>
                    </div>
                  ) : null}
                  {geminiListNames && geminiListNames.length === 0 && !geminiListErr ? (
                    <p className="mt-2 text-xs text-[#6b6b66] dark:text-[#9a9890]">
                      Nenhum modelo com generateContent / streamGenerateContent na resposta.
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div className="mt-4 border-t border-[#ddd8cf] pt-4 dark:border-[#3a3a34]">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#5c5c58] dark:text-[#9a9890]">
                  Modelos visíveis no chat
                </p>
                <ul className="space-y-2">
                  {modelsForProvider(pid).map((m) => (
                    <li key={m.id}>
                      <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-transparent px-1 py-1 transition hover:border-[#ccc6bc] hover:bg-white/60 dark:hover:border-[#3a3a34] dark:hover:bg-black/20">
                        <input
                          type="checkbox"
                          checked={enabledIds.has(m.id)}
                          onChange={(e) => toggleModel(m.id, e.target.checked)}
                          className="h-4 w-4 shrink-0 accent-[#c45c2a] dark:accent-[#e8a87c]"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-[#141413] dark:text-[#f2f0ea]">
                            {m.label}
                          </span>
                          {m.description ? (
                            <span className="mt-0.5 block text-xs leading-snug text-[#6b6b66] dark:text-[#9a9890]">
                              {m.description}
                            </span>
                          ) : null}
                        </span>
                        <code className="ml-auto hidden max-w-[40%] truncate text-[10px] text-[#6b6b66] sm:inline dark:text-[#8a8680]">
                          {m.id}
                        </code>
                      </label>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => resetProviderModels(pid)}
                  className="mt-3 text-xs font-semibold text-[#b45309] underline-offset-2 hover:underline dark:text-[#e8a87c]"
                >
                  Repor todos os modelos deste provedor
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
