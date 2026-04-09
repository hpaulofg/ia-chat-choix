"use client";

import { useCallback, useEffect, useState, type ReactElement } from "react";
import { ToolPageShell } from "@/components/ToolPageShell";

const IMAGE_ERROR_FRIENDLY_MSG =
  "O prompt foi recusado ou a OpenAI está instável. Tente simplificar a descrição, evitar nomes próprios ou mudar o formato.";

function normalizeImageErrorMessage(message: string): string {
  const lower = message.toLowerCase();
  if (
    lower.includes("server had an error") ||
    lower.includes("processing your request") ||
    lower.includes("safety system")
  ) {
    return IMAGE_ERROR_FRIENDLY_MSG;
  }
  return message;
}

type SizeId = "1024x1024" | "1792x1024" | "1024x1792";

function IconSquare() {
  return (
    <svg width="28" height="28" viewBox="0 0 40 40" fill="none" aria-hidden>
      <rect x="8" y="8" width="24" height="24" rx="3" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function IconLandscape() {
  return (
    <svg width="32" height="26" viewBox="0 0 48 40" fill="none" aria-hidden>
      <rect x="4" y="12" width="40" height="16" rx="2" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function IconPortrait() {
  return (
    <svg width="26" height="32" viewBox="0 0 40 48" fill="none" aria-hidden>
      <rect x="12" y="4" width="16" height="40" rx="2" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

const SIZES: {
  id: SizeId;
  name: string;
  dims: string;
  Icon: () => ReactElement;
}[] = [
  { id: "1024x1024", name: "Quadrado", dims: "1024²", Icon: IconSquare },
  { id: "1792x1024", name: "Paisagem", dims: "1792×1024", Icon: IconLandscape },
  { id: "1024x1792", name: "Retrato", dims: "1024×1792", Icon: IconPortrait },
];

type HistoryItem = {
  id: string;
  url: string;
  prompt: string;
  provider?: string;
};

async function downloadImageFile(url: string, filename: string) {
  if (url.startsWith("data:")) {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    return;
  }
  try {
    const r = await fetch(url);
    const blob = await r.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

const downloadBtnMainClass =
  "flex items-center gap-2 rounded-xl border border-white/20 bg-[#141413]/90 px-3 py-2 text-xs font-semibold text-white shadow-lg backdrop-blur-sm transition hover:bg-[#2d2d2d] dark:bg-[#ececec]/95 dark:text-[#141413] dark:hover:bg-white";

const downloadBtnThumbClass =
  "flex items-center gap-1 rounded-lg border border-white/20 bg-[#141413]/90 px-2 py-1.5 text-[10px] font-semibold text-white shadow-md backdrop-blur-sm transition hover:bg-[#2d2d2d] dark:bg-[#ececec]/95 dark:text-[#141413] dark:hover:bg-white";

export default function ImagePage() {
  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState<SizeId>("1024x1024");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    url: string;
    provider?: string;
  } | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  useEffect(() => {
    if (lightboxUrl == null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setLightboxUrl(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxUrl]);

  const generate = useCallback(async () => {
    const p = prompt.trim();
    if (!p || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/image/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: p, size }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        url?: string;
        provider?: string;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || `Erro ${res.status}`);
      }
      if (!data.url) throw new Error("Resposta sem imagem");
      setResult({ url: data.url, provider: data.provider });
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      setHistory((h) => {
        const next = [{ id, url: data.url!, prompt: p, provider: data.provider }, ...h];
        return next.slice(0, 6);
      });
    } catch (e) {
      const raw = e instanceof Error ? e.message : "Falha ao gerar";
      setError(normalizeImageErrorMessage(raw));
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [prompt, size, loading]);

  const showImage = !loading && result;

  return (
    <ToolPageShell>
      <>
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 pb-12 pt-1">
          <header className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--app-text)] sm:text-3xl">
              Gerar imagem
            </h1>
            <p className="text-sm leading-relaxed text-[var(--app-text-secondary)]">
              Descreva a cena e escolha o formato.{" "}
              <span className="font-medium text-[var(--app-text)]">DALL·E 3</span>
            </p>
          </header>

          <div className="flex flex-col gap-2">
            <label
              htmlFor="img-prompt"
              className="text-xs font-semibold uppercase tracking-wide text-[var(--app-text-muted)]"
            >
              Prompt
            </label>
            <div className="chat-composer-glass">
              <textarea
                id="img-prompt"
                rows={5}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Estilo, iluminação, cores, composição e o que deve aparecer em primeiro plano."
                className="chat-composer-textarea min-h-[120px] w-full resize-y py-1 text-[15px] leading-relaxed text-[var(--app-text)] placeholder:text-[var(--app-placeholder)]"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--app-text-muted)]">
              Formato
            </span>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {SIZES.map((s) => {
                const selected = size === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSize(s.id)}
                    className={`flex flex-col items-center gap-2 rounded-2xl border px-2 py-3 text-center transition-all sm:px-3 sm:py-3.5 ${
                      selected
                        ? "border-[#c45c2a]/80 bg-[#c45c2a]/[0.07] shadow-sm ring-1 ring-[#c45c2a]/25 dark:bg-[#c45c2a]/[0.1]"
                        : "border-[var(--app-border-strong)] bg-[var(--app-surface)]/80 hover:border-[var(--app-border)] hover:bg-[var(--app-hover)] dark:border-white/[0.08] dark:bg-[#262626]/80"
                    }`}
                  >
                    <div
                      className={`flex h-11 w-full items-center justify-center rounded-xl text-[#c45c2a] ${
                        selected ? "bg-[#c45c2a]/10 dark:bg-[#c45c2a]/15" : "bg-[var(--app-surface-2)] dark:bg-[#1f1f1f]"
                      }`}
                    >
                      <s.Icon />
                    </div>
                    <div className="flex flex-col gap-0">
                      <span className="text-xs font-semibold text-[var(--app-text)] sm:text-sm">{s.name}</span>
                      <span className="text-[10px] text-[var(--app-text-muted)] sm:text-[11px]">{s.dims}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-center sm:justify-start">
            <button
              type="button"
              onClick={() => void generate()}
              disabled={loading || !prompt.trim()}
              className="inline-flex w-full max-w-md items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-bold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-35 sm:w-auto sm:min-w-[200px] sm:px-8 sm:py-2.5 bg-[#141413] text-white hover:bg-[#2d2d2d] dark:bg-[#ececec] dark:text-[#141413] dark:hover:bg-white"
            >
              {loading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white dark:border-[#141413]/30 dark:border-t-[#141413]" />
                  A gerar…
                </>
              ) : (
                "Gerar imagem"
              )}
            </button>
          </div>

          {error ? (
            <p className="rounded-2xl border border-red-500/35 bg-red-500/[0.08] px-4 py-3 text-sm text-red-800 dark:text-red-200">
              {error}
            </p>
          ) : null}

          <div
            className={`relative overflow-hidden rounded-3xl transition-shadow ${
              showImage
                ? "border border-[var(--app-border-strong)] bg-[var(--app-surface)] p-4 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.18)] dark:border-white/[0.08] dark:bg-[#1c1c1c] dark:shadow-[0_16px_48px_-12px_rgba(0,0,0,0.55)]"
                : "flex min-h-[260px] flex-col items-center justify-center border border-dashed border-[var(--app-border)] bg-[var(--app-surface)]/50 sm:min-h-[300px] dark:border-white/[0.1] dark:bg-[#262626]/40"
            }`}
          >
            {loading ? (
              <div className="flex flex-col items-center justify-center gap-4 py-16">
                <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-[var(--app-border)] border-t-[#c45c2a]" />
                <p className="text-sm font-medium text-[var(--app-text-secondary)]">A criar a sua imagem…</p>
              </div>
            ) : null}

            {!loading && !showImage ? (
              <p className="px-6 text-center text-sm text-[var(--app-text-muted)]">A pré-visualização aparece aqui</p>
            ) : null}

            {showImage ? (
              <div className="group relative mx-auto w-full max-w-lg">
                <button
                  type="button"
                  onClick={() => setLightboxUrl(result!.url)}
                  className="block w-full rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-[#c45c2a]/50"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={result!.url}
                    alt={prompt.slice(0, 120) || "Imagem gerada"}
                    className="w-full cursor-zoom-in rounded-2xl object-contain shadow-lg"
                  />
                </button>
                <div className="pointer-events-none absolute inset-0 flex items-start justify-end rounded-2xl bg-gradient-to-b from-black/35 via-transparent to-transparent p-3 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void downloadImageFile(result!.url, `imagem-${Date.now()}.png`);
                    }}
                    className={`pointer-events-auto ${downloadBtnMainClass}`}
                  >
                    <DownloadIcon className="h-4 w-4" />
                    Descarregar
                  </button>
                </div>
                <p className="mt-3 text-center text-[11px] text-[var(--app-text-muted)]">
                  {result!.provider === "openai"
                    ? "OpenAI · DALL·E 3"
                    : result!.provider === "google"
                      ? "Google · Imagen"
                      : ""}
                </p>
              </div>
            ) : null}
          </div>

          {history.length > 0 ? (
            <div className="flex flex-col gap-4 border-t border-[var(--app-border)] pt-10 dark:border-white/[0.08]">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--app-text-muted)]">
                Sessão recente
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {history.map((item) => (
                  <div key={item.id} className="group flex flex-col gap-2">
                    <div className="relative aspect-square overflow-hidden rounded-2xl ring-1 ring-black/[0.06] dark:ring-white/[0.08]">
                      <button
                        type="button"
                        onClick={() => {
                          setResult({ url: item.url, provider: item.provider });
                          setLightboxUrl(item.url);
                        }}
                        className="absolute inset-0 block outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#c45c2a]/60"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.url}
                          alt=""
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                        />
                      </button>
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent opacity-0 transition-opacity duration-200 group-hover:pointer-events-auto group-hover:opacity-100">
                        <div className="absolute bottom-0 right-0 flex w-full justify-end p-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              void downloadImageFile(item.url, `imagem-${item.id}.png`);
                            }}
                            className={`pointer-events-auto ${downloadBtnThumbClass}`}
                          >
                            <DownloadIcon className="h-3.5 w-3.5" />
                            Descarregar
                          </button>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setResult({ url: item.url, provider: item.provider })}
                      className="w-full text-left"
                    >
                      <p className="line-clamp-2 text-[11px] leading-snug text-[var(--app-text-secondary)] transition group-hover:text-[var(--app-text)]">
                        {item.prompt}
                      </p>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {lightboxUrl ? (
          <div
            role="presentation"
            className="fixed inset-0 z-[300] flex items-center justify-center bg-black/[0.85] p-4"
            onClick={() => setLightboxUrl(null)}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setLightboxUrl(null);
              }}
              className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-[#141413]/90 text-white shadow-lg backdrop-blur-sm transition hover:bg-[#2d2d2d] dark:bg-[#ececec]/95 dark:text-[#141413] dark:hover:bg-white"
              aria-label="Fechar"
            >
              <CloseIcon className="h-5 w-5" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightboxUrl}
              alt=""
              className="max-h-[90vh] max-w-[90vw] object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        ) : null}
      </>
    </ToolPageShell>
  );
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 4v12m0 0l4-4m-4 4L8 12M5 20h14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M18 6L6 18M6 6l12 12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
