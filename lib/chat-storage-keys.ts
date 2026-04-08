/** Disparado após `localStorage` do tema ser atualizado (várias instâncias do hook). */
export const THEME_CHANGE_EVENT = "ai-chat-theme-change";

/** Persistência principal das conversas (histórico completo por conversa). */
export const CONVERSATIONS_STORAGE_KEY = "conversations";
/** Chave antiga — lida uma vez para migração se `conversations` ainda não existir. */
export const LEGACY_CONVERSATIONS_STORAGE_KEY = "ai-chat-platform-conversations";
export const ACTIVE_CONVERSATION_KEY = "ai-chat-platform-active-id";
export const GROUPS_STORAGE_KEY = "ai-chat-platform-groups";
export const PROJECTS_STORAGE_KEY = "ai-chat-platform-projects";
export const THEME_STORAGE_KEY = "ai-chat-theme";
export const PROVIDER_STORAGE_KEY = "ai-chat-platform-provider";
export const MODEL_STORAGE_KEY = "ai-chat-platform-model-choice";
export const EXPANDED_PROJECTS_KEY = "ai-chat-platform-expanded-projects";

/** Memória persistente (system prompt dinâmico). */
export const COWORK_MEMORY_KEY = "ai-chat-platform-cowork-memory";
/** Documentos gerados via /doc. */
export const COWORK_DOCS_KEY = "ai-chat-platform-cowork-docs";
/** Histórico diário de tokens (custo). */
export const TOKEN_HISTORY_KEY = "ai-chat-platform-token-history";
/** Totais da sessão (separado por separador de browser). */
export const TOKEN_SESSION_KEY = "ai-chat-platform-token-session";
/** Agregado global por modelo (input, output, custo, pedidos). */
export const TOKEN_MODEL_STATS_KEY = "ai-chat-platform-token-model-stats";
