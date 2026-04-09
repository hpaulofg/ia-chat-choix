"use client";

import { useCallback, useState } from "react";
import { ToolPageShell } from "@/components/ToolPageShell";

type SizeId = "1024x1024" | "1792x1024" | "1024x1792";

function IconSquare() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden>
      <rect x="8" y="8" width="24" height="24" rx="3" stroke="#c45c2a" strokeWidth="2" />
    </svg>
  );
}

function IconLandscape() {
  return (
    <svg width="48" height="40" viewBox="0 0 48 40" fill="none" aria-hidden>
      <rect
        x="4"
        y="12"
        width="40"
        height="16"
        rx="2"
        stroke="#c45c2a"
        strokeWidth="2"
      />
    </svg>
  );
}

function IconPortrait() {
  return (
    <svg width="40" height="48" viewBox="0 0 40 48" fill="none" aria-hidden>
      <rect
        x="12"
        y="4"
        width="16"
        height="40"
        rx="2"
        stroke="#c45c2a"
        strokeWidth="2"
      />
    </svg>
  );
}

const SIZES: {
  id: SizeId;
  name: string;
  dims: string;
  Icon: () => React.ReactElement;
}[] = [
  {
    id: "1024x1024",
    name: "Quadrado",
    dims: "1024 × 1024",
    Icon: IconSquare,
  },
  {
    id: "1792x1024",
    name: "Paisagem",
    dims: "1792 × 1024",
    Icon: IconLandscape,
  },
  {
    id: "1024x1792",
    name: "Retrato",
    dims: "1024 × 1792",
    Icon: IconPortrait,
  },
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
      setError(e instanceof Error ? e.message : "Falha ao gerar");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [prompt, size, loading]);

  const showImage = !loading && result;

  return (
    <ToolPageShell>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 pb-8">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--app-text)] sm:text-3xl">
            Gerar Imagem
          </h1>
          <p className="text-sm text-[var(--app-text-secondary)]">
            Powered by{" "}
            <span className="font-medium text-[var(--app-text)]">DALL·E 3</span>
          </p>
        </header>

        <div className="flex flex-col gap-2">
          <label
            htmlFor="img-prompt"
            className="text-sm font-semibold text-[var(--app-text)]"
          >
            Descreva sua imagem
          </label>
          <textarea
            id="img-prompt"
            rows={5}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Seja específico: estilo (foto, ilustração, 3D), iluminação, cores, composição e o que deve aparecer em primeiro plano. Quanto mais detalhes, melhor o resultado."
            className="w-full resize-y rounded-2xl border border-[var(--app-border-strong)] bg-[var(--app-surface)] px-4 py-3.5 text-[15px] leading-relaxed text-[var(--app-text)] placeholder:text-[var(--app-placeholder)] outline-none transition focus:border-[#c45c2a]/55 focus:ring-2 focus:ring-[#c45c2a]/20 dark:bg-[#262626]"
          />
        </div>

        <div className="flex flex-col gap-3">
          <span className="text-sm font-semibold text-[var(--app-text)]">Formato</span>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {SIZES.map((s) => {
              const selected = size === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSize(s.id)}
                  className={`flex flex-col items-center gap-3 rounded-2xl border p-4 text-center transition-all ${
                    selected
                      ? "border-[#c45c2a] bg-[#c45c2a]/[0.08] shadow-md ring-1 ring-[#c45c2a]/30 dark:bg-[#c45c2a]/[0.12]"
                      : "border-[var(--app-border-strong)] bg-[var(--app-surface)] hover:border-[var(--app-border)] hover:bg-[var(--app-hover)] dark:border-white/[0.1] dark:bg-[#262626]"
                  }`}
                >
                  <div
                    className={`flex h-14 w-full items-center justify-center rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-2)] dark:bg-[#1f1f1f] ${selected ? "border-[#c45c2a]/40" : ""}`}
                  >
                    <s.Icon />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-bold text-[var(--app-text)]">{s.name}</span>
                    <span className="text-xs text-[var(--app-text-muted)]">{s.dims}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          onClick={() => void generate()}
          disabled={loading || !prompt.trim()}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-[var(--app-border-strong)] bg-[#141413] text-sm font-semibold text-white shadow-sm transition hover:bg-[#2d2d2d] disabled:cursor-not-allowed disabled:opacity-45 dark:border-white/[0.12] dark:bg-[#ececec] dark:text-[#141413] dark:hover:bg-white"
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

        {error ? (
          <p className="rounded-2xl border border-red-500/35 bg-red-500/[0.08] px-4 py-3 text-sm text-red-800 dark:text-red-200">
            {error}
          </p>
        ) : null}

        <div
          className={`relative min-h-[280px] overflow-hidden rounded-2xl sm:min-h-[320px] ${
            showImage
              ? "border border-[var(--app-border-strong)] bg-[var(--app-surface)] p-3 shadow-inner dark:border-white/[0.08] dark:bg-[#1a1a1a]"
              : "flex flex-col items-center justify-center border-2 border-dashed border-[var(--app-border)] bg-[var(--app-surface)]/60 dark:border-white/[0.12] dark:bg-[#262626]/50"
          }`}
        >
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-4 py-16">
              <div className="h-11 w-11 animate-spin rounded-full border-[3px] border-[var(--app-border)] border-t-[#c45c2a]" />
              <p className="text-sm font-medium text-[var(--app-text-secondary)]">
                A criar a sua imagem…
              </p>
            </div>
          ) : null}

          {!loading && !showImage ? (
            <p className="px-6 text-center text-sm font-medium text-[var(--app-text-muted)]">
              Sua imagem aparecerá aqui
            </p>
          ) : null}

          {showImage ? (
            <div className="group relative mx-auto w-full max-w-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={result!.url}
                alt={prompt.slice(0, 120) || "Imagem gerada"}
                className="w-full rounded-2xl object-contain shadow-xl"
              />
              <div className="pointer-events-none absolute inset-0 flex items-start justify-end rounded-2xl bg-gradient-to-b from-black/40 via-transparent to-transparent p-3 opacity-0 transition-opacity duration-200 group-hover:pointer-events-auto group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() =>
                    void downloadImageFile(result!.url, `imagem-${Date.now()}.png`)
                  }
                  className="pointer-events-auto flex items-center gap-2 rounded-xl border border-white/20 bg-[#141413]/90 px-3 py-2 text-xs font-semibold text-white shadow-lg backdrop-blur-sm transition hover:bg-[#2d2d2d] dark:bg-[#ececec]/95 dark:text-[#141413] dark:hover:bg-white"
                >
                  <DownloadIcon className="h-4 w-4" />
                  Descarregar
                </button>
              </div>
              <p className="mt-3 text-center text-xs text-[var(--app-text-muted)]">
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
          <div className="flex flex-col gap-3 border-t border-[var(--app-border)] pt-8 dark:border-white/[0.08]">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-[var(--app-text-muted)]">
              Sessão recente
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {history.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setResult({ url: item.url, provider: item.provider })}
                  className="group overflow-hidden rounded-2xl border border-[var(--app-border-strong)] bg-[var(--app-surface)] text-left shadow-sm transition hover:border-[#c45c2a]/45 hover:shadow-md dark:border-white/[0.08] dark:bg-[#262626]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.url}
                    alt=""
                    className="aspect-square w-full object-cover transition group-hover:opacity-95"
                  />
                  <p className="line-clamp-2 p-2.5 text-[11px] leading-snug text-[var(--app-text-secondary)] group-hover:text-[var(--app-text)]">
                    {item.prompt}
                  </p>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
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
