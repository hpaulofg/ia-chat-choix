"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { ToolPageShell } from "@/components/ToolPageShell";

const MAX = 4000;

const VOICES: { id: string; name: string; tag: string; desc: string }[] = [
  {
    id: "alloy",
    name: "Equilibrada",
    tag: "Neutro",
    desc: "Voz versátil, funciona bem em qualquer tipo de conteúdo",
  },
  {
    id: "echo",
    name: "Profissional",
    tag: "Masculino",
    desc: "Tom direto e claro, ideal para apresentações e relatórios",
  },
  {
    id: "fable",
    name: "Narrativa",
    tag: "Expressivo",
    desc: "Dinâmica e envolvente, ótima para histórias e roteiros",
  },
  {
    id: "onyx",
    name: "Autoridade",
    tag: "Masculino grave",
    desc: "Tom profundo e imponente, transmite credibilidade",
  },
  {
    id: "nova",
    name: "Acolhedora",
    tag: "Feminina",
    desc: "Calorosa e agradável, perfeita para conteúdo educativo",
  },
  {
    id: "shimmer",
    name: "Suave",
    tag: "Feminina delicada",
    desc: "Clara e tranquila, ideal para meditação e conteúdo relaxante",
  },
];

type SessionItem = {
  id: string;
  src: string;
  textPreview: string;
  voice: string;
};

function revokeUrl(url: string, registry: Set<string>) {
  try {
    URL.revokeObjectURL(url);
  } catch {
    /* ignore */
  }
  registry.delete(url);
}

function formatAudioTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function TtsAudioPlayer({ src, className = "" }: { src: string; className?: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    setPlaying(false);
    setCurrent(0);
    setDuration(0);
    const a = audioRef.current;
    if (a) {
      a.pause();
      a.currentTime = 0;
    }
  }, [src]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => {
      setPlaying(false);
      setCurrent(0);
    };
    const onTime = () => setCurrent(a.currentTime);
    const onMeta = () => setDuration(Number.isFinite(a.duration) ? a.duration : 0);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("ended", onEnded);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onMeta);
    return () => {
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("ended", onEnded);
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onMeta);
    };
  }, [src]);

  const toggle = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
    } else {
      void a.play().catch(() => setPlaying(false));
    }
  }, [playing]);

  const onBarPointer = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      const a = audioRef.current;
      const bar = barRef.current;
      if (!a || !bar || !duration) return;
      const r = bar.getBoundingClientRect();
      const x = e.clientX - r.left;
      const p = Math.min(1, Math.max(0, x / r.width));
      a.currentTime = p * duration;
      setCurrent(a.currentTime);
    },
    [duration],
  );

  const pct = duration > 0 ? Math.min(100, (current / duration) * 100) : 0;

  return (
    <div
      className={`flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--app-border-strong)] bg-[var(--app-surface)] px-3 py-3 dark:border-white/[0.1] dark:bg-[#262626] ${className}`}
    >
      <audio ref={audioRef} src={src} preload="metadata" className="hidden" />
      <button
        type="button"
        onClick={toggle}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--app-border-strong)] bg-[#141413] text-white shadow-sm transition hover:bg-[#2d2d2d] dark:border-white/[0.12] dark:bg-[#ececec] dark:text-[#141413] dark:hover:bg-white"
        aria-label={playing ? "Pausar" : "Reproduzir"}
      >
        {playing ? <PauseIcon /> : <PlayIcon />}
      </button>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div
          ref={barRef}
          role="slider"
          tabIndex={0}
          aria-valuenow={Math.round(pct)}
          aria-valuemin={0}
          aria-valuemax={100}
          className="group relative h-2 w-full cursor-pointer rounded-full bg-[var(--app-border)] dark:bg-white/10"
          onClick={onBarPointer}
          onKeyDown={(e) => {
            if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
            const a = audioRef.current;
            if (!a || !duration) return;
            e.preventDefault();
            const step = duration * 0.05;
            a.currentTime = Math.min(
              duration,
              Math.max(0, a.currentTime + (e.key === "ArrowRight" ? step : -step)),
            );
            setCurrent(a.currentTime);
          }}
        >
          <div
            className="h-full rounded-full bg-[#c45c2a] transition-[width] duration-100"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex justify-between font-mono text-[11px] tabular-nums text-[var(--app-text-muted)]">
          <span>{formatAudioTime(current)}</span>
          <span>{formatAudioTime(duration)}</span>
        </div>
      </div>
    </div>
  );
}

export default function VoicePage() {
  const [text, setText] = useState("");
  const [voice, setVoice] = useState("alloy");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<SessionItem[]>([]);
  const blobRegistry = useRef<Set<string>>(new Set());

  const count = text.length;

  useEffect(() => {
    const reg = blobRegistry.current;
    return () => {
      reg.forEach((u) => {
        try {
          URL.revokeObjectURL(u);
        } catch {
          /* ignore */
        }
      });
      reg.clear();
    };
  }, []);

  const generate = useCallback(async () => {
    const t = text.trim();
    if (!t || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/voice/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: t, voice }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        audio?: string;
        audioBase64?: string;
        mimeType?: string;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || `Erro ${res.status}`);
      }
      const b64 = data.audioBase64 ?? data.audio;
      if (!b64) throw new Error("Resposta sem áudio");
      const mime = data.mimeType || "audio/mpeg";
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: mime });
      const url = URL.createObjectURL(blob);
      blobRegistry.current.add(url);

      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const preview = t.length > 120 ? `${t.slice(0, 120)}…` : t;

      setItems((prev) => {
        const next = [{ id, src: url, textPreview: preview, voice }, ...prev].slice(0, 3);
        const keep = new Set(next.map((x) => x.src));
        for (const x of prev) {
          if (!keep.has(x.src)) {
            revokeUrl(x.src, blobRegistry.current);
          }
        }
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao gerar");
    } finally {
      setLoading(false);
    }
  }, [text, voice, loading]);

  const downloadBlob = useCallback((src: string, filename: string) => {
    const a = document.createElement("a");
    a.href = src;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, []);

  return (
    <ToolPageShell>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 pb-8">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--app-text)] sm:text-3xl">
            Gerar Narração
          </h1>
          <p className="text-sm text-[var(--app-text-secondary)]">
            Powered by{" "}
            <span className="font-medium text-[var(--app-text)]">OpenAI TTS</span>
          </p>
        </header>

        <div className="flex flex-col gap-2">
          <label
            htmlFor="tts-text"
            className="text-sm font-semibold text-[var(--app-text)]"
          >
            Texto para narração
          </label>
          <div className="relative">
            <textarea
              id="tts-text"
              rows={9}
              value={text}
              maxLength={MAX}
              onChange={(e) => setText(e.target.value.slice(0, MAX))}
              placeholder="Cole ou escreva o texto que deseja ouvir em voz alta. Funciona bem com artigos, roteiros e documentação."
              className="w-full resize-y rounded-2xl border border-[var(--app-border-strong)] bg-[var(--app-surface)] pb-9 pl-4 pr-4 pt-3.5 text-[15px] leading-relaxed text-[var(--app-text)] placeholder:text-[var(--app-placeholder)] outline-none transition focus:border-[#c45c2a]/55 focus:ring-2 focus:ring-[#c45c2a]/20 dark:bg-[#262626]"
            />
            <span
              className={`pointer-events-none absolute bottom-3 right-4 text-xs font-medium tabular-nums ${
                count >= MAX * 0.95
                  ? "text-[#c45c2a]"
                  : "text-[var(--app-text-muted)]"
              }`}
            >
              {count} / {MAX}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <span className="text-sm font-semibold text-[var(--app-text)]">Voz</span>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {VOICES.map((v) => {
              const selected = voice === v.id;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setVoice(v.id)}
                  className={`flex flex-col gap-2 rounded-2xl border p-3.5 text-left transition-all ${
                    selected
                      ? "border-[#c45c2a] bg-[#c45c2a]/[0.08] shadow-md ring-1 ring-[#c45c2a]/30 dark:bg-[#c45c2a]/[0.12]"
                      : "border-[var(--app-border-strong)] bg-[var(--app-surface)] hover:border-[var(--app-border)] hover:bg-[var(--app-hover)] dark:border-white/[0.1] dark:bg-[#262626]"
                  }`}
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--app-surface-2)] text-[var(--app-text-secondary)] dark:bg-[#1f1f1f]">
                    <MicIcon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <span className="block text-sm font-bold text-[var(--app-text)]">{v.name}</span>
                    <span className="mt-0.5 block text-[11px] font-semibold uppercase tracking-wide text-[#c45c2a]">
                      {v.tag}
                    </span>
                    <span className="mt-1 block text-[11px] leading-snug text-[var(--app-text-muted)]">
                      {v.desc}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          onClick={() => void generate()}
          disabled={loading || !text.trim()}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-[var(--app-border-strong)] bg-[#141413] text-sm font-semibold text-white shadow-sm transition hover:bg-[#2d2d2d] disabled:cursor-not-allowed disabled:opacity-45 dark:border-white/[0.12] dark:bg-[#ececec] dark:text-[#141413] dark:hover:bg-white"
        >
          {loading ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white dark:border-[#141413]/30 dark:border-t-[#141413]" />
              A gerar áudio…
            </>
          ) : (
            "Gerar narração"
          )}
        </button>

        {error ? (
          <p className="rounded-2xl border border-red-500/35 bg-red-500/[0.08] px-4 py-3 text-sm text-red-800 dark:text-red-200">
            {error}
          </p>
        ) : null}

        {items.length > 0 ? (
          <div className="flex flex-col gap-6 border-t border-[var(--app-border)] pt-8 dark:border-white/[0.08]">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-[var(--app-text-muted)]">
              Sessão (até 3)
            </h2>
            <ul className="flex flex-col gap-5">
              {items.map((item, idx) => {
                const vMeta = VOICES.find((x) => x.id === item.voice);
                return (
                  <li
                    key={item.id}
                    className="flex flex-col gap-3 rounded-2xl border border-[var(--app-border-strong)] bg-[var(--app-surface)] p-4 shadow-sm dark:border-white/[0.08] dark:bg-[#1e1e1e]"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wide text-[#c45c2a]">
                        {idx === 0 ? "Mais recente" : `Anterior ${idx}`}
                      </span>
                      <span className="text-xs text-[var(--app-text-muted)]">
                        {vMeta ? `${vMeta.name} · ${vMeta.tag}` : item.voice}
                      </span>
                    </div>
                    <p className="line-clamp-3 text-sm leading-relaxed text-[var(--app-text)]">
                      {item.textPreview}
                    </p>
                    <TtsAudioPlayer src={item.src} />
                    <button
                      type="button"
                      onClick={() => downloadBlob(item.src, `narracao-${item.id}.mp3`)}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--app-border-strong)] bg-[var(--app-surface-2)] py-2.5 text-sm font-semibold text-[var(--app-text)] transition hover:bg-[var(--app-hover)] dark:border-white/[0.1] dark:bg-[#2a2a2a]"
                    >
                      <DownloadIcon className="h-4 w-4" />
                      Descarregar MP3
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </div>
    </ToolPageShell>
  );
}

function PlayIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
    </svg>
  );
}

function MicIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 14a3 3 0 003-3V5a3 3 0 10-6 0v6a3 3 0 003 3zm5-3a5 5 0 01-10 0M12 19v3M8 22h8"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
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
