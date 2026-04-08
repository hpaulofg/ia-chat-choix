import {
  TOKEN_HISTORY_KEY,
  TOKEN_MODEL_STATS_KEY,
  TOKEN_SESSION_KEY,
} from "@/lib/chat-storage-keys";

export type TokenDayEntry = {
  date: string;
  input: number;
  output: number;
  cost: number;
};

export type TokenSession = {
  input: number;
  output: number;
  cost: number;
  requests: number;
};

export type ModelUsageStat = {
  input: number;
  output: number;
  cost: number;
  requests: number;
};

/**
 * USD por 1M tokens (input / output). Catálogo atual + entradas legadas para histórico antigo.
 */
const PRICES: Record<string, { in: number; out: number }> = {
  "claude-sonnet-4-5": { in: 3.0, out: 15.0 },
  "claude-haiku-4-5": { in: 0.8, out: 4.0 },
  "claude-opus-4-5": { in: 15.0, out: 75.0 },
  "gpt-4o": { in: 2.5, out: 10.0 },
  "gpt-4o-mini": { in: 0.15, out: 0.6 },
  "llama-3.3-70b-versatile": { in: 0.59, out: 0.79 },
  "llama-3.1-8b-instant": { in: 0.05, out: 0.08 },
  "meta-llama/llama-4-scout-17b-16e-instruct": { in: 0.11, out: 0.34 },
  "moonshotai/kimi-k2-instruct": { in: 1.0, out: 3.0 },
  "llama-3.1-70b-versatile": { in: 0.55, out: 0.75 },
  "gemini-2.5-pro": { in: 1.25, out: 5.0 },
  "gemini-2.5-flash": { in: 0.075, out: 0.3 },
  "gemini-2.5-flash-lite": { in: 0.05, out: 0.2 },
  "gemini-1.5-pro-latest": { in: 1.25, out: 5.0 },
  "gemini-1.5-flash-latest": { in: 0.075, out: 0.3 },
  "gemini-1.5-pro": { in: 1.25, out: 5.0 },
  "gemini-1.5-flash": { in: 0.075, out: 0.3 },
  "gemini-2.0-flash-lite": { in: 0.05, out: 0.2 },
  "gemini-2.5-flash-preview-04-17": { in: 0.15, out: 0.6 },
  "gemini-1.5-flash-002": { in: 0.075, out: 0.3 },
  "claude-sonnet-4-5-20251022": { in: 3.0, out: 15.0 },
  "claude-haiku-4-5-20251001": { in: 0.8, out: 4.0 },
  "claude-sonnet-4-20250514": { in: 3.0, out: 15.0 },
  "claude-opus-4-20250514": { in: 15.0, out: 75.0 },
  "claude-3-5-haiku-20241022": { in: 0.8, out: 4.0 },
  "gpt-4-turbo": { in: 10, out: 30 },
  "mixtral-8x7b-32768": { in: 0.24, out: 0.24 },
  "gemini-2.0-flash-001": { in: 0.1, out: 0.4 },
  "gemini-2.0-flash": { in: 0.1, out: 0.4 },
};

const DEFAULT_PRICE = { in: 3, out: 15 };

export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const price = PRICES[model] ?? DEFAULT_PRICE;
  return (
    (inputTokens / 1_000_000) * price.in + (outputTokens / 1_000_000) * price.out
  );
}

function loadSession(): TokenSession {
  if (typeof window === "undefined") {
    return { input: 0, output: 0, cost: 0, requests: 0 };
  }
  try {
    const raw = sessionStorage.getItem(TOKEN_SESSION_KEY);
    if (!raw) return { input: 0, output: 0, cost: 0, requests: 0 };
    const o = JSON.parse(raw) as Partial<TokenSession>;
    return {
      input: Number(o.input) || 0,
      output: Number(o.output) || 0,
      cost: Number(o.cost) || 0,
      requests: Number(o.requests) || 0,
    };
  } catch {
    return { input: 0, output: 0, cost: 0, requests: 0 };
  }
}

function saveSession(s: TokenSession): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(TOKEN_SESSION_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

function loadHistory(): TokenDayEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(TOKEN_HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (x): x is TokenDayEntry =>
        x &&
        typeof x === "object" &&
        typeof (x as TokenDayEntry).date === "string" &&
        typeof (x as TokenDayEntry).input === "number"
    );
  } catch {
    return [];
  }
}

function saveHistory(h: TokenDayEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(TOKEN_HISTORY_KEY, JSON.stringify(h.slice(-400)));
  } catch {
    /* ignore */
  }
}

function loadModelStats(): Record<string, ModelUsageStat> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(TOKEN_MODEL_STATS_KEY);
    if (!raw) return {};
    const o = JSON.parse(raw) as unknown;
    if (!o || typeof o !== "object") return {};
    const out: Record<string, ModelUsageStat> = {};
    for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
      if (!v || typeof v !== "object") continue;
      const x = v as Partial<ModelUsageStat>;
      out[k] = {
        input: Number(x.input) || 0,
        output: Number(x.output) || 0,
        cost: Number(x.cost) || 0,
        requests: Number(x.requests) || 0,
      };
    }
    return out;
  } catch {
    return {};
  }
}

function saveModelStats(stats: Record<string, ModelUsageStat>): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(TOKEN_MODEL_STATS_KEY, JSON.stringify(stats));
  } catch {
    /* ignore */
  }
}

/** Histórico diário (últimos dias) para gráficos na dashboard. */
export function readTokenDayHistory(): TokenDayEntry[] {
  return loadHistory();
}

/** Totais acumulados por ID de modelo (todas as sessões neste navegador). */
export function readModelUsageStats(): Record<string, ModelUsageStat> {
  return loadModelStats();
}

function dispatchUsageUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("ai-token-usage-update"));
}

export class TokenTracker {
  track(model: string, inputTokens: number, outputTokens: number): void {
    if (inputTokens <= 0 && outputTokens <= 0) return;
    const cost = estimateCostUsd(model, inputTokens, outputTokens);

    const session = loadSession();
    session.input += inputTokens;
    session.output += outputTokens;
    session.cost += cost;
    session.requests += 1;
    saveSession(session);

    const today = new Date().toISOString().split("T")[0]!;
    const history = loadHistory();
    const dayEntry = history.find((d) => d.date === today);
    if (dayEntry) {
      dayEntry.input += inputTokens;
      dayEntry.output += outputTokens;
      dayEntry.cost += cost;
    } else {
      history.push({ date: today, input: inputTokens, output: outputTokens, cost });
    }
    saveHistory(history);

    const stats = loadModelStats();
    const prev = stats[model] ?? { input: 0, output: 0, cost: 0, requests: 0 };
    stats[model] = {
      input: prev.input + inputTokens,
      output: prev.output + outputTokens,
      cost: prev.cost + cost,
      requests: prev.requests + 1,
    };
    saveModelStats(stats);
    dispatchUsageUpdated();
  }

  getSessionSummary(): TokenSession & { totalTokens: number; costFormatted: string } {
    const s = loadSession();
    return {
      ...s,
      totalTokens: s.input + s.output,
      costFormatted: `$${s.cost.toFixed(4)}`,
    };
  }

  getMonthCost(): string {
    const month = new Date().toISOString().slice(0, 7);
    const sum = loadHistory()
      .filter((d) => d.date.startsWith(month))
      .reduce((acc, d) => acc + d.cost, 0);
    return sum.toFixed(4);
  }

  /** Para forçar re-render após track (React). */
  static readSession(): TokenSession {
    return loadSession();
  }
}
