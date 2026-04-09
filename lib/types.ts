export type ChatRole = "user" | "assistant";

/** Metadados da última resposta da API (custo estimado, tokens). */
export type MessageUsageMeta = {
  input: number;
  output: number;
  model: string;
  costUsd: number;
};

/** Anexo persistido no histórico (base64 sem prefixo data:) */
export type MessageAttachment = {
  id: string;
  name: string;
  type: string;
  size: number;
  base64: string;
};

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  attachments?: MessageAttachment[];
  usage?: MessageUsageMeta;
  /** Epoch ms — hora de envio/receção na UI */
  createdAt?: number;
};

export type ConversationGroup = {
  id: string;
  name: string;
};

/** Pasta para organizar conversas (UI: Projetos). */
export type ConversationProject = {
  id: string;
  name: string;
};

export type Conversation = {
  id: string;
  title: string;
  updatedAt: number;
  messages: ChatMessage[];
  pinned?: boolean;
  /** Conversas do chat Dev (persistidas à parte no Supabase). */
  kind?: "dev";
  /** Marca conversas só do modo Dev (filtro API `type=dev`). */
  devMode?: boolean;
  /** @deprecated use projectId — mantido para migração */
  groupId?: string | null;
  projectId?: string | null;
};
