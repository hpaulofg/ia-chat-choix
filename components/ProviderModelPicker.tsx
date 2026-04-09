"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { ProviderBrandIcon } from "@/components/ProviderBrandIcon";
import { PROVIDER_SHORT_LABEL, type ProviderId } from "@/lib/provider-config";

/** Itens de modelo: hover só background (.model-item); padding 8px 12px; um único <button> por linha. */
const modelOptionBtnBase =
  "model-item flex w-full cursor-pointer items-start gap-2 px-3 py-2 text-left outline-none select-none";

const DROPDOWN_EDGE_MARGIN = 4;

type Row = {
  id: string;
  label: string;
  models: { id: string; label: string; description?: string }[];
  configured: boolean;
};

function providerShortName(row: Row | undefined, pid: string): string {
  if (!row) return pid;
  return PROVIDER_SHORT_LABEL[row.id as ProviderId] ?? row.label;
}

export function ProviderModelPicker({
  providers,
  provider,
  model,
  onProviderChange,
  onModelChange,
  disabled,
  variant = "default",
  className = "",
}: {
  providers: Row[];
  provider: string;
  model: string;
  onProviderChange: (id: string) => void;
  onModelChange: (id: string) => void;
  disabled: boolean;
  variant?: "default" | "cascade";
  className?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const cascadeTriggerRef = useRef<HTMLButtonElement>(null);
  const cascadeMenuRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [highlightPid, setHighlightPid] = useState(provider);
  const [openFlyout, setOpenFlyout] = useState<string | null>(null);
  const [flyoutOpensDownward, setFlyoutOpensDownward] = useState(false);
  /** fixed + bottom/left em px — menu abre sempre para cima, portado em document.body */
  const [cascadeMenuStyle, setCascadeMenuStyle] = useState<CSSProperties | null>(null);
  const flyoutTriggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const flyoutPanelRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
  }, []);
  const closeFlyout = useCallback(() => setOpenFlyout(null), []);

  // Fechar ao clicar fora: bubble (não capture) + atraso para não colidir com o clique que abre.
  useEffect(() => {
    if (!menuOpen) return;
    let remove: (() => void) | undefined;
    const timer = window.setTimeout(() => {
      function onPointerDown(e: PointerEvent) {
        const n = e.target as Node;
        if (cascadeTriggerRef.current?.contains(n)) return;
        if (cascadeMenuRef.current?.contains(n)) return;
        closeMenu();
      }
      document.addEventListener("pointerdown", onPointerDown);
      remove = () => document.removeEventListener("pointerdown", onPointerDown);
    }, 0);
    return () => {
      clearTimeout(timer);
      remove?.();
    };
  }, [menuOpen, closeMenu]);

  useEffect(() => {
    if (!openFlyout) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) closeFlyout();
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [openFlyout, closeFlyout]);

  useLayoutEffect(() => {
    if (!menuOpen) {
      setCascadeMenuStyle(null);
      return;
    }

    function updateCascadePosition() {
      const trigger = cascadeTriggerRef.current;
      if (!trigger) return;
      const tr = trigger.getBoundingClientRect();
      const margin = DROPDOWN_EDGE_MARGIN;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const menuWidth = Math.min(380, vw - 2 * margin);
      let left = tr.left;
      left = Math.max(margin, Math.min(left, vw - menuWidth - margin));
      const bottom = vh - tr.top + margin;
      const spaceAbove = Math.max(0, tr.top - margin * 2);
      const maxH = Math.max(160, Math.min(420, vh * 0.7, spaceAbove));

      setCascadeMenuStyle({
        left,
        bottom,
        width: menuWidth,
        maxHeight: maxH,
      });
    }

    updateCascadePosition();
    const raf = window.requestAnimationFrame(() => updateCascadePosition());

    const ro = new ResizeObserver(() => updateCascadePosition());
    const triggerEl = cascadeTriggerRef.current;
    if (triggerEl) ro.observe(triggerEl);

    window.addEventListener("resize", updateCascadePosition);
    window.addEventListener("scroll", updateCascadePosition, true);

    return () => {
      window.cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("resize", updateCascadePosition);
      window.removeEventListener("scroll", updateCascadePosition, true);
      setCascadeMenuStyle(null);
    };
  }, [menuOpen, providers, highlightPid, provider, model]);

  useLayoutEffect(() => {
    if (openFlyout == null) return;
    const flyoutPid = openFlyout;
    function measure() {
      const btn = flyoutTriggerRefs.current[flyoutPid];
      const panel = flyoutPanelRefs.current[flyoutPid];
      if (!btn || !panel) return;
      const tr = btn.getBoundingClientRect();
      const h = panel.offsetHeight;
      const spaceBelow = window.innerHeight - tr.bottom;
      setFlyoutOpensDownward(spaceBelow >= h + DROPDOWN_EDGE_MARGIN);
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [openFlyout, provider, model, providers]);

  const currentRow = providers.find((p) => p.id === provider);
  const currentModel = currentRow?.models.find((m) => m.id === model);
  const currentLabel = currentModel?.label ?? model;
  const triggerProviderName = providerShortName(currentRow, provider);

  const highlighted =
    providers.find((p) => p.id === highlightPid) ?? providers[0] ?? null;

  const pickModel = (pid: string, mid: string) => {
    onProviderChange(pid);
    onModelChange(mid);
    closeMenu();
  };

  const cascadeMenuNode =
    menuOpen && typeof document !== "undefined" ? (
      <div
        ref={cascadeMenuRef}
        role="listbox"
        aria-label="Escolher modelo"
        style={
          cascadeMenuStyle ?? { position: "fixed", left: 0, bottom: 0, visibility: "hidden", zIndex: 200 }
        }
        className="pointer-events-auto fixed z-[200] flex min-w-0 max-w-[calc(100vw-1.5rem)] flex-row overflow-hidden overscroll-contain [isolation:isolate] select-none sm:min-w-[320px]"
      >
        <div className="grid max-h-full min-h-0 w-full min-w-0 max-w-full grid-cols-[minmax(88px,110px)_minmax(0,1fr)] overflow-hidden rounded-xl border border-[var(--app-border-strong)] bg-[var(--app-surface)] shadow-2xl select-none sm:w-max sm:min-w-[320px] sm:max-w-[380px] sm:grid-cols-[110px_minmax(210px,270px)] dark:border-[#3f3f3f] dark:bg-[#2b2b2b]">
        <div className="flex min-h-0 flex-col gap-0 overflow-y-auto overflow-x-hidden border-r border-[var(--app-border)] px-1 py-2 dark:border-white/[0.08]">
          <p className="mb-1 px-2 text-[10px] font-bold uppercase tracking-wide text-[var(--app-text-muted)]">
            Provedor
          </p>
          {providers.map((p) => {
            const activeP = p.id === highlightPid;
            const hasModels = p.models.length > 0;
            return (
              <button
                key={p.id}
                type="button"
                disabled={disabled || !hasModels}
                data-active={activeP ? "true" : undefined}
                onFocus={() => {
                  if (hasModels) setHighlightPid(p.id);
                }}
                onClick={() => {
                  if (hasModels) setHighlightPid(p.id);
                }}
                className={`provider-cascade-item w-full shrink-0 rounded-lg border border-transparent px-3 py-2 text-left text-[13px] font-medium text-[var(--app-text-secondary)] data-[active=true]:border-[var(--app-border-strong)] ${
                  !hasModels ? "opacity-40" : ""
                }`}
              >
                <span className="pointer-events-none flex min-w-0 flex-row items-center gap-1.5 whitespace-nowrap">
                  <ProviderBrandIcon providerId={p.id} />
                  <span className="min-w-0 truncate">
                    {PROVIDER_SHORT_LABEL[p.id as ProviderId] ?? p.label}
                  </span>
                  {!p.configured ? (
                    <span className="shrink-0 rounded bg-amber-500/20 px-0.5 text-[8px] font-bold text-amber-800 dark:text-amber-100">
                      !
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex min-h-0 min-w-0 flex-col overflow-hidden">
          <p className="shrink-0 border-b border-[var(--app-border)] px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-[var(--app-text-muted)] dark:border-white/[0.08]">
            Modelos
          </p>
          {highlighted && highlighted.models.length > 0 ? (
            <ul className="m-0 min-h-0 flex-1 list-none overflow-y-auto p-0">
              {highlighted.models.map((m) => {
                const sel = highlighted.id === provider && m.id === model;
                return (
                  <li key={m.id} className="m-0 list-none p-0">
                    <button
                      type="button"
                      role="option"
                      aria-selected={sel}
                      data-selected={sel ? "true" : undefined}
                      disabled={disabled || !highlighted.configured}
                      onClick={() => pickModel(highlighted.id, m.id)}
                      className={modelOptionBtnBase}
                    >
                      {sel ? (
                        <span className="pointer-events-none shrink-0 text-[#2563eb] dark:text-[#60a5fa]" aria-hidden>
                          <CheckIconSm />
                        </span>
                      ) : (
                        <span className="pointer-events-none w-4 shrink-0" aria-hidden />
                      )}
                      <span className="pointer-events-none flex min-w-0 flex-1 flex-col text-left">
                        <span className="min-w-0 text-[13px] font-medium leading-snug">
                          {m.label}
                        </span>
                        {m.description ? (
                          <span className="mt-0.5 text-[11px] font-normal leading-snug opacity-[0.55]">
                            {m.description}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-3 py-3 text-center text-xs text-[var(--app-text-muted)]">
              Sem modelos ou chave em falta.
            </p>
          )}
        </div>
      </div>
    </div>
    ) : null;

  const cascadeMenu =
    cascadeMenuNode && typeof document !== "undefined"
      ? createPortal(cascadeMenuNode, document.body)
      : null;

  if (variant === "cascade") {
    return (
      <div className={`min-w-0 ${className}`}>
        <button
          ref={cascadeTriggerRef}
          type="button"
          disabled={disabled}
          onClick={() =>
            setMenuOpen((o) => {
              const next = !o;
              if (next) {
                setHighlightPid(provider);
              }
              return next;
            })
          }
          aria-expanded={menuOpen}
          aria-haspopup="listbox"
          aria-label={`Modelo: ${triggerProviderName} — ${currentLabel}`}
          className="inline-flex w-full max-w-full min-w-0 items-center gap-1.5 rounded-lg border border-black/10 bg-[#141413] px-2 py-2 text-left shadow-sm transition hover:bg-[#2a2a2a] disabled:opacity-50 sm:w-auto sm:max-w-full sm:gap-2 sm:px-3 dark:border-white/10 dark:bg-[#1a1a1a] dark:hover:bg-[#262626]"
        >
          <span className="flex min-w-0 flex-1 flex-nowrap items-baseline gap-x-1.5 overflow-hidden text-left sm:flex-wrap sm:gap-y-0.5 sm:overflow-visible">
            <span className="shrink-0 rounded-md bg-[#c45c2a]/25 px-1 py-0.5 text-[11px] font-bold tracking-tight text-[#fbbf24] sm:px-1.5 sm:text-[12px] dark:bg-[#c45c2a]/35 dark:text-[#fcd34d]">
              {triggerProviderName}
            </span>
            <span className="shrink-0 text-[12px] font-semibold text-white/45 dark:text-white/40 sm:text-[13px]" aria-hidden>
              —
            </span>
            <span className="min-w-0 flex-1 truncate text-[12px] font-medium leading-snug text-[#fafafa] sm:text-[13px] dark:text-[#f5f5f5]">
              {currentLabel}
            </span>
          </span>
          <ChevronDownIcon className={`h-4 w-4 shrink-0 opacity-80 ${menuOpen ? "rotate-180" : ""}`} />
        </button>
        {cascadeMenu}
      </div>
    );
  }

  const inner = (
    <div className="flex flex-wrap gap-1.5">
      {providers.map((p) => {
        const active = p.id === provider;
        const flyoutOpen = openFlyout === p.id;
        return (
          <div
            key={p.id}
            className="group relative"
            onMouseEnter={() => {
              if (typeof window !== "undefined" && window.matchMedia("(hover: hover)").matches) {
                setOpenFlyout(p.id);
              }
            }}
            onMouseLeave={() => {
              if (typeof window !== "undefined" && window.matchMedia("(hover: hover)").matches) {
                setOpenFlyout((cur) => (cur === p.id ? null : cur));
              }
            }}
          >
            <button
              ref={(el) => {
                flyoutTriggerRefs.current[p.id] = el;
              }}
              type="button"
              disabled={disabled || p.models.length === 0}
              onClick={() => setOpenFlyout((id) => (id === p.id ? null : p.id))}
              className={`relative z-10 inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-semibold transition ${
                active || flyoutOpen
                  ? "border-[#141413] bg-[#141413] text-white dark:border-[#ececec] dark:bg-[#ececec] dark:text-[#141413]"
                  : "border-[var(--app-border-strong)] bg-[var(--app-surface)] text-[var(--app-text)] hover:border-[var(--app-text-muted)]"
              } ${disabled || p.models.length === 0 ? "opacity-50" : ""}`}
              aria-expanded={flyoutOpen}
              aria-haspopup="listbox"
            >
              <ProviderBrandIcon providerId={p.id} />
              <span className="max-w-[88px] truncate sm:max-w-[120px]">{p.label}</span>
              {!p.configured ? (
                <span className="rounded bg-amber-500/25 px-1 text-[9px] font-bold text-amber-900 dark:text-amber-100">
                  chave
                </span>
              ) : null}
              <ChevronMini className={flyoutOpen ? "rotate-180" : ""} />
            </button>

            <div
              ref={(el) => {
                flyoutPanelRefs.current[p.id] = el;
              }}
              className={`absolute left-0 z-[60] w-max min-w-[320px] max-w-[380px] select-none transition-opacity duration-150 ${
                flyoutOpensDownward ? "top-full pt-1" : "bottom-full pb-1"
              } ${
                flyoutOpen
                  ? "visible pointer-events-auto opacity-100"
                  : "pointer-events-none invisible opacity-0 md:group-hover:pointer-events-auto md:group-hover:visible md:group-hover:opacity-100"
              }`}
              role="listbox"
              aria-label={`Modelos ${p.label}`}
            >
              <div className="flex max-h-[min(70vh,420px)] w-max min-w-[320px] max-w-[380px] flex-col overflow-hidden rounded-xl border border-[var(--app-border-strong)] bg-[var(--app-surface)] shadow-xl select-none dark:bg-[#2b2b2b]">
              <p className="shrink-0 border-b border-[var(--app-border)] px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-[var(--app-text-muted)]">
                Modelos · {p.label}
              </p>
              <ul className="m-0 min-h-0 flex-1 list-none overflow-y-auto p-0">
                {p.models.map((m) => {
                  const sel = p.id === provider && m.id === model;
                  return (
                    <li key={m.id} className="m-0 list-none p-0">
                      <button
                        type="button"
                        role="option"
                        aria-selected={sel}
                        data-selected={sel ? "true" : undefined}
                        disabled={disabled || !p.configured}
                        onClick={() => {
                          onProviderChange(p.id);
                          onModelChange(m.id);
                          setOpenFlyout(null);
                        }}
                        className={modelOptionBtnBase}
                      >
                        {sel ? (
                          <span className="pointer-events-none mt-0.5 shrink-0">
                            <CheckIcon />
                          </span>
                        ) : (
                          <span className="pointer-events-none mt-0.5 w-4 shrink-0" />
                        )}
                        <span className="pointer-events-none flex min-w-0 flex-1 flex-col text-left">
                          <span className="min-w-0 text-[13px] font-medium leading-snug">
                            {m.label}
                          </span>
                          {m.description ? (
                            <span className="mt-0.5 text-[11px] font-normal leading-snug opacity-[0.55]">
                              {m.description}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div ref={rootRef} className={`select-none rounded-xl border border-[var(--app-border-strong)] bg-[var(--app-surface-2)] p-2.5 ${className}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-[var(--app-text-muted)]">
          <SparklesIcon />
          Modelo de IA
        </span>
        <span className="truncate text-[11px] font-semibold text-[var(--app-text-secondary)]">
          {currentLabel}
        </span>
      </div>
      {inner}
      <p className="mt-2 text-[10px] font-medium text-[var(--app-text-muted)]">
        No computador: passe o rato sobre o provedor para ver os modelos. No telemóvel: toque no provedor.
      </p>
    </div>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function CheckIconSm() {
  return (
    <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronMini({ className }: { className?: string }) {
  return (
    <svg
      className={`h-3.5 w-3.5 shrink-0 transition-transform ${className ?? ""}`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SparklesIcon() {
  return (
    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2l1.2 4.2L17 8l-3.8 1.8L12 14l-1.2-4.2L7 8l3.8-1.8L12 2zm8 8l.6 2.1L22 12l-2.4 1.1L18 15l-.6-2.1L15 12l2.4-1.1L20 10z" />
    </svg>
  );
}
