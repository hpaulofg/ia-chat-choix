export type ProviderId = "anthropic" | "openai" | "google" | "groq";

export type ModelOption = { id: string; label: string; description?: string };

/** IDs enviados tal qual à API Anthropic (aliases sem data no sufixo). */
export const DEFAULT_ANTHROPIC_MODEL_ID = "claude-sonnet-4-5";

export const ANTHROPIC_MODELS: ModelOption[] = [
  {
    id: "claude-opus-4-5",
    label: "Claude Opus 4.5",
    description: "Máxima inteligência, tarefas complexas",
  },
  {
    id: "claude-sonnet-4-5",
    label: "Claude Sonnet 4.5",
    description: "Equilíbrio ideal entre qualidade e custo",
  },
  {
    id: "claude-haiku-4-5",
    label: "Claude Haiku 4.5",
    description: "Rápido e econômico para tarefas simples",
  },
];

export const OPENAI_MODELS: ModelOption[] = [
  {
    id: "gpt-4o",
    label: "GPT-4o",
    description: "Melhor modelo GPT, multimodal",
  },
  {
    id: "gpt-4o-mini",
    label: "GPT-4o mini",
    description: "GPT rápido e barato para uso geral",
  },
];

export const GROQ_MODELS: ModelOption[] = [
  {
    id: "llama-3.3-70b-versatile",
    label: "Llama 3.3 70B",
    description: "LLaMA potente, resposta rápida",
  },
  {
    id: "meta-llama/llama-4-scout-17b-16e-instruct",
    label: "Llama 4 Scout 17B",
    description: "LLaMA 4, multimodal e capaz",
  },
  {
    id: "moonshotai/kimi-k2-instruct",
    label: "Kimi K2",
    description: "Contexto longo, ótimo para documentos",
  },
];

/** IDs estáveis v1beta (sem sufixos -latest); path `models/{id}:generateContent`. */
export const GOOGLE_MODELS: ModelOption[] = [
  {
    id: "gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    description: "Rápido, multimodal, mais recente",
  },
  {
    id: "gemini-2.5-pro",
    label: "Gemini 2.5 Pro",
    description: "Máxima capacidade Google",
  },
];

/** Ordem padrão ao semear `enabled_models` no localStorage. */
export const DEFAULT_ENABLED_MODEL_IDS: readonly string[] = [
  ...ANTHROPIC_MODELS.map((m) => m.id),
  ...OPENAI_MODELS.map((m) => m.id),
  ...GROQ_MODELS.map((m) => m.id),
  ...GOOGLE_MODELS.map((m) => m.id),
];

export const PROVIDER_LABELS: Record<ProviderId, string> = {
  anthropic: "Claude (Anthropic)",
  openai: "OpenAI",
  google: "Google Gemini",
  groq: "Groq",
};

/** Nome curto para cabeçalhos e UI compacta. */
export const PROVIDER_SHORT_LABEL: Record<ProviderId, string> = {
  anthropic: "Claude",
  openai: "OpenAI",
  google: "Gemini",
  groq: "Groq",
};

export function modelsForProvider(p: ProviderId): ModelOption[] {
  switch (p) {
    case "anthropic":
      return ANTHROPIC_MODELS;
    case "openai":
      return OPENAI_MODELS;
    case "google":
      return GOOGLE_MODELS;
    case "groq":
      return GROQ_MODELS;
    default:
      return [];
  }
}
