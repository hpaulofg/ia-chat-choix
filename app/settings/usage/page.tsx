"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import {
  readModelUsageStats,
  readTokenDayHistory,
  TokenTracker,
  type ModelUsageStat,
  type TokenDayEntry,
} from "@/lib/token-tracker";
import { modelsForProvider, type ProviderId } from "@/lib/provider-config";

function labelForModelId(id: string): string {
  for (const p of ["anthropic", "openai", "google", "groq"] as ProviderId[]) {
    const m = modelsForProvider(p).find((x) => x.id === id);
    if (m) return m.label;
  }
  return id;
}

function monthPrefix(): string {
  return new Date().toISOString().slice(0, 7);
}

function sumMonth(history: TokenDayEntry[]): { cost: number; tokens: number } {
  const m = monthPrefix();
  return history
    .filter((d) => d.date.startsWith(m))
    .reduce(
      (acc, d) => ({
        cost: acc.cost + d.cost,
        tokens: acc.tokens + d.input + d.output,
      }),
      { cost: 0, tokens: 0 }
    );
}

function last14DaysSeries(history: TokenDayEntry[]): {
  date: string;
  short: string;
  tokens: number;
  cost: number;
}[] {
  const map = new Map(history.map((d) => [d.date, d]));
  const out: { date: string; short: string; tokens: number; cost: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const dt = new Date();
    dt.setDate(dt.getDate() - i);
    const date = dt.toISOString().split("T")[0]!;
    const e = map.get(date);
    out.push({
      date,
      short: `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}`,
      tokens: e ? e.input + e.output : 0,
      cost: e?.cost ?? 0,
    });
  }
  return out;
}

const EMPTY_SESSION = {
  input: 0,
  output: 0,
  cost: 0,
  requests: 0,
  totalTokens: 0,
  costFormatted: "$0.0000",
} as const;

function subscribeNoop() {
  return () => {};
}

export default function SettingsUsagePage() {
  const [tick, setTick] = useState(0);
  const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false);
  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!mounted) return;
    function onUpd() {
      refresh();
    }
    window.addEventListener("ai-token-usage-update", onUpd);
    window.addEventListener("storage", onUpd);
    window.addEventListener("focus", onUpd);
    return () => {
      window.removeEventListener("ai-token-usage-update", onUpd);
      window.removeEventListener("storage", onUpd);
      window.removeEventListener("focus", onUpd);
    };
  }, [mounted, refresh]);

  const history = useMemo(() => {
    void tick;
    if (!mounted) return [];
    return readTokenDayHistory();
  }, [tick, mounted]);
  const modelStats = useMemo(() => {
    void tick;
    if (!mounted) return {};
    return readModelUsageStats();
  }, [tick, mounted]);
  const session = useMemo(() => {
    void tick;
    if (!mounted) return { ...EMPTY_SESSION };
    return new TokenTracker().getSessionSummary();
  }, [tick, mounted]);

  const month = useMemo(() => sumMonth(history), [history]);
  const series = useMemo(() => {
    if (!mounted) return [];
    return last14DaysSeries(history);
  }, [history, mounted]);

  const modelRows = useMemo(() => {
    const entries = Object.entries(modelStats) as [string, ModelUsageStat][];
    entries.sort((a, b) => {
      const ta = a[1].input + a[1].output;
      const tb = b[1].input + b[1].output;
      return tb - ta;
    });
    return entries;
  }, [modelStats]);

  const maxModelTokens = useMemo(() => {
    if (!modelRows.length) return 1;
    return Math.max(
      1,
      ...modelRows.map(([, s]) => s.input + s.output)
    );
  }, [modelRows]);

  const maxDayTokens = useMemo(() => {
    if (!series.length) return 1;
    return Math.max(1, ...series.map((d) => d.tokens));
  }, [series]);

  const totalAllTimeCost = useMemo(
    () => modelRows.reduce((a, [, s]) => a + s.cost, 0),
    [modelRows]
  );
  const totalAllTimeTok = useMemo(
    () => modelRows.reduce((a, [, s]) => a + s.input + s.output, 0),
    [modelRows]
  );

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight text-[var(--app-text)] sm:text-3xl">
          Uso e custos
        </h2>
        <p className="max-w-2xl text-sm font-medium leading-relaxed text-[var(--app-text-secondary)]">
          Tokens e custos estimados (USD) por modelo, agregados neste navegador. Os valores usam as mesmas
          tarifas aproximadas da app; consulte o seu fornecedor para faturação real.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Sessão atual"
          value={`${session.totalTokens.toLocaleString()} tok`}
          sub={`~${session.costFormatted} · ${session.requests} pedidos`}
        />
        <StatCard
          title="Mês (calendário)"
          value={`${month.tokens.toLocaleString()} tok`}
          sub={`~$${month.cost.toFixed(4)} USD`}
        />
        <StatCard
          title="Total acumulado (modelos)"
          value={`${totalAllTimeTok.toLocaleString()} tok`}
          sub={`~$${totalAllTimeCost.toFixed(4)} USD`}
        />
        <StatCard
          title="Modelos com uso"
          value={String(modelRows.length)}
          sub="Por ID de modelo no chat"
        />
      </div>

      <section className="rounded-[28px] border border-[var(--app-border-strong)] bg-[var(--app-surface)] p-5 shadow-sm dark:bg-[#303030] sm:p-6">
        <h3 className="text-xs font-bold uppercase tracking-wide text-[#c45c2a] dark:text-[#e8a87c]">
          Últimos 14 dias · tokens por dia
        </h3>
        <p className="mt-1 text-xs text-[var(--app-text-muted)]">
          Soma de entrada + saída guardada no histórico diário.
        </p>
        <div className="mt-4 flex h-40 items-end gap-1 sm:gap-1.5">
          {mounted ? (
            series.map((d) => {
              const h = Math.round((d.tokens / maxDayTokens) * 100);
              return (
                <div
                  key={d.date}
                  className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1"
                  title={`${d.date}: ${d.tokens.toLocaleString()} tok · ~$${d.cost.toFixed(5)}`}
                >
                  <div
                    className="w-full max-w-[28px] rounded-t-md bg-[#c45c2a]/80 dark:bg-[#e8a87c]/70"
                    style={{ height: `${Math.max(h, d.tokens > 0 ? 8 : 2)}%` }}
                  />
                  <span className="hidden text-[9px] font-medium text-[var(--app-text-muted)] sm:inline">
                    {d.short}
                  </span>
                </div>
              );
            })
          ) : (
            <div className="flex h-full w-full items-center justify-center rounded-lg border border-dashed border-[var(--app-border-strong)] text-xs font-medium text-[var(--app-text-muted)]">
              A carregar…
            </div>
          )}
        </div>
      </section>

      <section className="rounded-[28px] border border-[var(--app-border-strong)] bg-[var(--app-surface)] p-5 shadow-sm dark:bg-[#303030] sm:p-6">
        <h3 className="text-xs font-bold uppercase tracking-wide text-[var(--app-text-muted)]">
          Por modelo · tokens e custo
        </h3>
        {modelRows.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--app-text-muted)]">
            Ainda não há dados. Envie mensagens no chat para preencher esta vista.
          </p>
        ) : (
          <ul className="mt-4 space-y-4">
            {modelRows.map(([id, s]) => {
              const total = s.input + s.output;
              const w = Math.round((total / maxModelTokens) * 100);
              return (
                <li key={id}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-sm font-semibold text-[var(--app-text)]">
                      {labelForModelId(id)}
                    </span>
                    <span className="text-xs tabular-nums text-[var(--app-text-muted)]">
                      {total.toLocaleString()} tok · ~${s.cost.toFixed(4)} · {s.requests}×
                    </span>
                  </div>
                  <code className="mt-0.5 block truncate text-[10px] text-[var(--app-text-muted)]">
                    {id}
                  </code>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/[0.08]">
                    <div
                      className="h-full rounded-full bg-[#c45c2a]/85 dark:bg-[#e8a87c]/80"
                      style={{ width: `${w}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[11px] tabular-nums text-[var(--app-text-muted)]">
                    {s.input.toLocaleString()} in · {s.output.toLocaleString()} out
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="overflow-hidden rounded-[28px] border border-[var(--app-border-strong)] bg-[var(--app-surface)] shadow-sm dark:bg-[#303030]">
        <div className="border-b border-[var(--app-border)] px-5 py-3 dark:border-white/[0.08] sm:px-6">
          <h3 className="text-xs font-bold uppercase tracking-wide text-[var(--app-text-muted)]">
            Tabela detalhada
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--app-border)] text-[11px] font-bold uppercase tracking-wide text-[var(--app-text-muted)] dark:border-white/[0.08]">
                <th className="px-4 py-3 sm:px-6">Modelo</th>
                <th className="px-2 py-3 text-right">Pedidos</th>
                <th className="px-2 py-3 text-right">Entrada</th>
                <th className="px-2 py-3 text-right">Saída</th>
                <th className="px-4 py-3 text-right sm:px-6">Custo ~USD</th>
              </tr>
            </thead>
            <tbody>
              {modelRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-[var(--app-text-muted)] sm:px-6">
                    Sem linhas.
                  </td>
                </tr>
              ) : (
                modelRows.map(([id, s]) => (
                  <tr
                    key={id}
                    className="border-b border-[var(--app-border)] last:border-0 dark:border-white/[0.06]"
                  >
                    <td className="max-w-[220px] px-4 py-3 sm:px-6">
                      <div className="font-medium text-[var(--app-text)]">{labelForModelId(id)}</div>
                      <div className="truncate font-mono text-[10px] text-[var(--app-text-muted)]">
                        {id}
                      </div>
                    </td>
                    <td className="px-2 py-3 text-right tabular-nums">{s.requests}</td>
                    <td className="px-2 py-3 text-right tabular-nums">
                      {s.input.toLocaleString()}
                    </td>
                    <td className="px-2 py-3 text-right tabular-nums">
                      {s.output.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium sm:px-6">
                      ${s.cost.toFixed(4)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-center text-xs text-[var(--app-text-muted)]">
        <Link
          href="/chat"
          className="font-semibold text-[#b45309] underline-offset-2 hover:underline dark:text-[#e8a87c]"
        >
          Voltar ao chat
        </Link>
      </p>
    </div>
  );
}

function StatCard({
  title,
  value,
  sub,
}: {
  title: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--app-border-strong)] bg-[var(--app-surface-2)] p-4 dark:bg-[#262626]">
      <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--app-text-muted)]">
        {title}
      </p>
      <p className="mt-2 text-lg font-bold tabular-nums text-[var(--app-text)]">{value}</p>
      <p className="mt-1 text-xs font-medium text-[var(--app-text-secondary)]">{sub}</p>
    </div>
  );
}
