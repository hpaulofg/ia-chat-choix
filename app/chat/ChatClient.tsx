"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";
import { ChatAccountMenu } from "@/components/ChatAccountMenu";
import { MarkdownMessage } from "@/components/MarkdownMessage";
import { ProviderBrandIcon } from "@/components/ProviderBrandIcon";
import { ProviderModelPicker } from "@/components/ProviderModelPicker";
import { useSpeechDictation } from "@/hooks/use-speech-recognition";
import {
  ACTIVE_CONVERSATION_KEY,
  GROUPS_STORAGE_KEY,
  MODEL_STORAGE_KEY,
  PROJECTS_STORAGE_KEY,
  PROVIDER_STORAGE_KEY,
  EXPANDED_PROJECTS_KEY,
} from "@/lib/chat-storage-keys";
import { parseChatCommand, docUserPrompt, type DocKind } from "@/lib/chat-commands";
import {
  readConversationsFromSupabase,
  readConversationsJsonFromStorage,
  writeConversationsToSupabase,
} from "@/lib/conversations-storage";
import {
  appendCoworkInstruction,
  buildSystemPrompt,
  loadCoworkMemory,
  saveCoworkMemoryPatch,
} from "@/lib/cowork-memory";
import { pushCoworkDoc } from "@/lib/cowork-docs";
import {
  approximateBytesFromBase64,
  validateAttachmentsForSend,
} from "@/lib/attachment-provider-limits";
import {
  mapFetchFailureToUiMessage,
  mapHttpErrorToUiMessage,
  mapStreamErrorToUiMessage,
} from "@/lib/api-ui-errors";
import { compressImageToJpegBase64 } from "@/lib/compress-image";
import { getClientApiKey } from "@/lib/client-api-storage";
import { mergeChatProviderRows } from "@/lib/merge-chat-providers";
import {
  PROVIDER_SHORT_LABEL,
  type ProviderId,
} from "@/lib/provider-config";
import { timeOfDayGreeting } from "@/lib/time-greeting";
import { estimateCostUsd, TokenTracker } from "@/lib/token-tracker";
import type {
  ChatMessage,
  Conversation,
  ConversationProject,
  MessageAttachment,
} from "@/lib/types";
import { parseUserFromEmail } from "@/lib/user-display";

type ProviderRow = {
  id: string;
  label: string;
  models: { id: string; label: string; description?: string }[];
  configured: boolean;
};

type PendingAttachment = {
  id: string;
  name: string;
  type: string;
  size: number;
  /** Base64 cru (sem prefixo data:) */
  base64: string;
  /** Só imagens: blob URL para pré-visualização */
  previewUrl?: string;
};

const MAX_ATTACHMENT_FILE_BYTES = 20 * 1024 * 1024;
/** Filtro do diálogo do botão + (colar no compositor continua a aceitar mais tipos). */
const COMPOSER_FILE_PICKER_ACCEPT = "image/*,application/pdf,.txt,text/plain";

function fileAllowedAsAttachment(file: File): boolean {
  const t = file.type.toLowerCase();
  if (t === "application/pdf") return true;
  if (t.startsWith("text/")) return true;
  if (t === "application/json" || t === "application/xml" || t === "application/javascript") return true;
  const ext = file.name.includes(".") ? (file.name.split(".").pop() ?? "").toLowerCase() : "";
  const exts = new Set([
    "txt",
    "md",
    "markdown",
    "json",
    "csv",
    "ts",
    "tsx",
    "js",
    "jsx",
    "mjs",
    "cjs",
    "html",
    "htm",
    "css",
    "scss",
    "less",
    "xml",
    "yaml",
    "yml",
    "sh",
    "bash",
    "py",
    "rb",
    "go",
    "rs",
    "java",
    "kt",
    "swift",
    "vue",
    "svelte",
    "log",
    "sql",
    "graphql",
    "toml",
    "ini",
    "env",
    "c",
    "h",
    "cpp",
    "hpp",
    "cs",
    "php",
    "pdf",
  ]);
  return exts.has(ext);
}

function isImageAttachmentFile(file: File): boolean {
  return file.type.toLowerCase().startsWith("image/");
}

function shouldCompressAsRasterImage(file: File): boolean {
  const t = file.type.toLowerCase();
  if (t === "image/gif" || t === "image/svg+xml") return false;
  return (
    t === "image/jpeg" ||
    t === "image/jpg" ||
    t === "image/png" ||
    t === "image/webp" ||
    t === "image/bmp" ||
    t === "image/avif" ||
    t === "image/pjpeg"
  );
}

function dedupeFiles(files: File[]): File[] {
  const seen = new Set<string>();
  const out: File[] = [];
  for (const f of files) {
    const k = `${f.name}:${f.size}:${f.lastModified}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(f);
  }
  return out;
}

function readFileAsDataUrl(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(typeof r.result === "string" ? r.result : null);
    r.onerror = () => resolve(null);
    r.readAsDataURL(file);
  });
}

function dataUrlToRawBase64(dataUrl: string): string | null {
  const i = dataUrl.indexOf(",");
  return i >= 0 ? dataUrl.slice(i + 1) : null;
}

function revokePendingPreview(a: PendingAttachment) {
  if (a.previewUrl) {
    try {
      URL.revokeObjectURL(a.previewUrl);
    } catch {
      /* ignore */
    }
  }
}

function messageAttachmentsToPending(list: MessageAttachment[]): PendingAttachment[] {
  return list.map((a) => ({
    id: a.id,
    name: a.name,
    type: a.type,
    size: a.size,
    base64: a.base64,
    previewUrl: a.type.toLowerCase().startsWith("image/")
      ? `data:${a.type};base64,${a.base64}`
      : undefined,
  }));
}

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

async function fileToPendingAttachment(
  file: File,
  reportError: (message: string) => void
): Promise<PendingAttachment | null> {
  const name =
    file.name?.trim() ||
    (isImageAttachmentFile(file) ? `imagem-${Date.now()}.png` : "ficheiro");
  if (file.size > MAX_ATTACHMENT_FILE_BYTES) {
    reportError(`«${name}» excede 20 MB.`);
    return null;
  }
  if (isImageAttachmentFile(file) || fileAllowedAsAttachment(file)) {
    if (isImageAttachmentFile(file) && shouldCompressAsRasterImage(file)) {
      const out = await compressImageToJpegBase64(file);
      if (!out) {
        reportError(`Não foi possível processar a imagem «${name}».`);
        return null;
      }
      const jpegName = /\.[a-z0-9]+$/i.test(name)
        ? name.replace(/\.[^.]+$/, ".jpg")
        : `${name}.jpg`;
      const bytes = approximateBytesFromBase64(out.base64);
      return {
        id: uid(),
        name: jpegName,
        type: "image/jpeg",
        size: bytes,
        base64: out.base64,
        previewUrl: out.dataUrl,
      };
    }

    if (isImageAttachmentFile(file)) {
      const dataUrl = await readFileAsDataUrl(file);
      if (!dataUrl) {
        reportError(`Não foi possível ler «${name}».`);
        return null;
      }
      const base64 = dataUrlToRawBase64(dataUrl);
      if (!base64) {
        reportError(`Não foi possível codificar «${name}».`);
        return null;
      }
      const mime =
        file.type ||
        (isImageAttachmentFile(file) ? "application/octet-stream" : "text/plain");
      return {
        id: uid(),
        name,
        type: mime,
        size: file.size,
        base64,
        previewUrl: URL.createObjectURL(file),
      };
    }

    const dataUrl = await readFileAsDataUrl(file);
    if (!dataUrl) {
      reportError(`Não foi possível ler «${name}».`);
      return null;
    }
    const base64 = dataUrlToRawBase64(dataUrl);
    if (!base64) {
      reportError(`Não foi possível codificar «${name}».`);
      return null;
    }
    const mime =
      file.type ||
      (isImageAttachmentFile(file) ? "application/octet-stream" : "text/plain");
    return {
      id: uid(),
      name,
      type: mime,
      size: file.size,
      base64,
      previewUrl: undefined,
    };
  }
  reportError(
    `«${name}» não é um tipo suportado. Use texto, código, PDF ou imagem (PNG, JPEG, WebP, GIF).`
  );
  return null;
}

function titleFromMessages(messages: ChatMessage[]): string {
  const first = messages.find((m) => m.role === "user");
  if (!first) return "Nova conversa";
  const raw = first.content.replace(/\s+/g, " ").trim();
  const fromAttach = first.attachments?.[0]?.name;
  const t = (raw || fromAttach || "").slice(0, 48);
  const fullLen = raw.length || fromAttach?.length || 0;
  return t.length < fullLen ? `${t}…` : t || "Nova conversa";
}

function normalizeConv(c: Conversation): Conversation {
  const projectId = c.projectId ?? c.groupId ?? null;
  const messages = Array.isArray(c.messages) ? c.messages : [];
  return {
    id: c.id,
    title: c.title,
    updatedAt: c.updatedAt,
    pinned: Boolean(c.pinned),
    projectId,
    groupId: projectId,
    messages,
  };
}

function convProjectId(c: Conversation): string | null {
  return c.projectId ?? c.groupId ?? null;
}

function loadProjectsFromStorage(): ConversationProject[] {
  try {
    const p = localStorage.getItem(PROJECTS_STORAGE_KEY);
    if (p) {
      const arr = JSON.parse(p) as ConversationProject[];
      if (Array.isArray(arr)) return arr;
    }
    const g = localStorage.getItem(GROUPS_STORAGE_KEY);
    if (g) {
      const arr = JSON.parse(g) as ConversationProject[];
      if (Array.isArray(arr) && arr.length) {
        localStorage.setItem(PROJECTS_STORAGE_KEY, g);
        return arr;
      }
    }
  } catch {
    /* ignore */
  }
  return [];
}

function sortUpdated(a: Conversation, b: Conversation) {
  return b.updatedAt - a.updatedAt;
}

/** Converte mensagem guardada no histórico para o formato enviado à API (ex.: /doc → prompt expandido). */
function chatMessageToApiTurn(m: ChatMessage): {
  role: "user" | "assistant";
  content: string;
  attachments?: MessageAttachment[];
} {
  if (m.role === "assistant") {
    return { role: "assistant", content: m.content };
  }
  const cmd = parseChatCommand(m.content);
  if (cmd.kind === "doc") {
    const docContextHint =
      cmd.context.trim() ||
      (m.attachments?.length
        ? "Use o histórico acima e o conteúdo dos anexos."
        : "conforme o pedido.");
    return {
      role: "user",
      content: docUserPrompt(cmd.docType, docContextHint),
      attachments: m.attachments,
    };
  }
  return {
    role: "user",
    content: m.content,
    attachments: m.attachments,
  };
}

export default function ChatClient({
  defaultModel,
}: {
  defaultModel: string;
}) {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [projects, setProjects] = useState<ConversationProject[]>([]);
  const [addingProject, setAddingProject] = useState(false);
  const [projectDraft, setProjectDraft] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [provider, setProvider] = useState("anthropic");
  const [model, setModel] = useState(defaultModel);
  const [providerRows, setProviderRows] = useState<ProviderRow[]>([]);
  const [providersLoaded, setProvidersLoaded] = useState(false);
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [mediaLightbox, setMediaLightbox] = useState<{ url: string; name: string } | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [openConvMenuId, setOpenConvMenuId] = useState<string | null>(null);
  const [composerError, setComposerError] = useState<string | null>(null);
  const [renamingConvId, setRenamingConvId] = useState<string | null>(null);
  const [renameDraftTitle, setRenameDraftTitle] = useState("");
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [projectsPanelOpen, setProjectsPanelOpen] = useState(true);
  const trackerRef = useRef(new TokenTracker());
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const composerErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const composerFileInputId = useId();
  const hydrated = useRef(false);
  const active = conversations.find((c) => c.id === activeId) ?? null;
  const conversationsRef = useRef(conversations);
  conversationsRef.current = conversations;
  const activeIdRef = useRef<string | null>(activeId);
  activeIdRef.current = activeId;

  const flushConversationsPersist = useCallback(() => {
    if (!hydrated.current) return;
    try {
      const all = conversationsRef.current;
      void writeConversationsToSupabase(all);
      const aid = activeIdRef.current;
      if (aid && all.some((c) => c.id === aid)) {
        localStorage.setItem(ACTIVE_CONVERSATION_KEY, aid);
      } else {
        localStorage.removeItem(ACTIVE_CONVERSATION_KEY);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const composerFooterProviderModel = useMemo(() => {
    const row = providerRows.find((p) => p.id === provider);
    const mod = row?.models.find((m) => m.id === model);
    return {
      providerShort: PROVIDER_SHORT_LABEL[provider as ProviderId] ?? row?.label ?? "IA",
      modelLabel: mod?.label ?? model,
      row,
    };
  }, [providerRows, provider, model]);

  const headerProviderName = useMemo(() => {
    const row = providerRows.find((p) => p.id === provider);
    return PROVIDER_SHORT_LABEL[provider as ProviderId] ?? row?.label ?? "IA";
  }, [providerRows, provider]);

  const loadProviders = useCallback(() => {
    void fetch("/api/chat/providers")
      .then((r) => r.json())
      .then((data) => {
        const rawRows = Array.isArray(data.providers) ? data.providers : [];
        const rows = mergeChatProviderRows(rawRows as ProviderRow[]);
        let p = "anthropic";
        let m = defaultModel;
        try {
          const sp = localStorage.getItem(PROVIDER_STORAGE_KEY);
          const sm = localStorage.getItem(MODEL_STORAGE_KEY);
          const bySaved = rows.find((x: ProviderRow) => x.id === sp);
          if (bySaved && bySaved.models.length > 0) {
            p = sp!;
            const hasModel = bySaved.models.some((mod: { id: string }) => mod.id === sm);
            m = hasModel ? sm! : bySaved.models[0]?.id ?? data.defaultModel;
          } else {
            const first = rows.find((x: ProviderRow) => x.configured && x.models.length > 0);
            if (first) {
              p = first.id;
              m = first.models[0]?.id ?? data.defaultModel;
            }
          }
        } catch {
          const first = rows.find((x: ProviderRow) => x.configured && x.models.length > 0);
          if (first) {
            p = first.id;
            m = first.models[0]?.id ?? data.defaultModel;
          }
        }
        setProviderRows(rows);
        setProvider(p);
        setModel(m);
        setProvidersLoaded(true);
      })
      .catch(() => setProvidersLoaded(true));
  }, [defaultModel]);

  const speech = useSpeechDictation(setInput);

  useEffect(() => {
    void fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (typeof d.email === "string" && d.email) setAccountEmail(d.email);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "," || !(e.ctrlKey || e.metaKey) || e.altKey) return;
      const el = e.target;
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return;
      if (el instanceof HTMLElement && el.isContentEditable) return;
      e.preventDefault();
      router.push("/settings");
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router]);

  useEffect(() => {
    if (!accountEmail) return;
    const mem = loadCoworkMemory();
    if (mem.userName?.trim()) return;
    const { firstName, displayName } = parseUserFromEmail(accountEmail);
    const n =
      displayName && displayName !== "Utilizador"
        ? displayName
        : firstName
          ? firstName
          : "";
    if (n) saveCoworkMemoryPatch({ userName: n });
  }, [accountEmail]);

  useEffect(() => {
    loadProviders();
  }, [loadProviders]);

  useEffect(() => {
    if (!providersLoaded) return;
    try {
      localStorage.setItem(PROVIDER_STORAGE_KEY, provider);
      localStorage.setItem(MODEL_STORAGE_KEY, model);
    } catch {
      /* ignore */
    }
  }, [provider, model, providersLoaded]);

  useEffect(() => {
    function onFocus() {
      setProjects(loadProjectsFromStorage());
      loadProviders();
    }
    function onLsUpdate() {
      loadProviders();
    }
    window.addEventListener("focus", onFocus);
    window.addEventListener("storage", onLsUpdate);
    window.addEventListener("ai-chat-ls-update", onLsUpdate);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("storage", onLsUpdate);
      window.removeEventListener("ai-chat-ls-update", onLsUpdate);
    };
  }, [loadProviders]);

  useLayoutEffect(() => {
    try {
      const ex = localStorage.getItem(EXPANDED_PROJECTS_KEY);
      if (ex) {
        const arr = JSON.parse(ex) as string[];
        if (Array.isArray(arr)) setExpandedProjects(new Set(arr));
      }
    } catch {
      /* ignore */
    }
    setProjects(loadProjectsFromStorage());
    void (async () => {
      let raw: string | null = null;
      let aidLs: string | null = null;
      try {
        raw = readConversationsJsonFromStorage();
        aidLs = localStorage.getItem(ACTIVE_CONVERSATION_KEY);
      } catch {
        /* ignore */
      }
      try {
        const remote = await readConversationsFromSupabase();
        if (remote && Array.isArray(remote) && remote.length) {
          const persistent = remote.map((c) => normalizeConv(c as Conversation));
          setConversations(persistent);
          const pick =
            (aidLs && persistent.some((c) => c.id === aidLs) && aidLs) || persistent[0].id;
          setActiveId(pick);
          hydrated.current = true;
          return;
        }
      } catch { /* ignore */ }
      // Fallback localStorage
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as Conversation[];
          if (Array.isArray(parsed) && parsed.length) {
            const persistent = parsed.map((c) => normalizeConv(c));
            setConversations(persistent);
            const pick =
              (aidLs && persistent.some((c) => c.id === aidLs) && aidLs) || persistent[0].id;
            setActiveId(pick);
            hydrated.current = true;
            return;
          }
        } catch { /* ignore */ }
      }
      const id = uid();
      const empty: Conversation = {
        id,
        title: "Nova conversa",
        updatedAt: Date.now(),
        messages: [],
        pinned: false,
        projectId: null,
        groupId: null,
      };
      setConversations([empty]);
      setActiveId(id);
      hydrated.current = true;
    })();
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    void writeConversationsToSupabase(conversations);
    if (activeId) {
      try {
        if (conversations.some((c) => c.id === activeId)) {
          localStorage.setItem(ACTIVE_CONVERSATION_KEY, activeId);
        } else {
          localStorage.removeItem(ACTIVE_CONVERSATION_KEY);
        }
      } catch {
        /* ignore */
      }
    }
  }, [conversations, activeId]);

  useEffect(() => {
    function onBeforeUnload() {
      flushConversationsPersist();
    }
    function onVisibility() {
      if (document.visibilityState === "hidden") flushConversationsPersist();
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [flushConversationsPersist]);

  useEffect(() => {
    return () => {
      flushConversationsPersist();
    };
  }, [flushConversationsPersist]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [active?.messages, loading]);

  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const max = 280;
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 52), max)}px`;
  }, [input]);

  useEffect(() => {
    if (!openConvMenuId) return;
    function onDoc(e: MouseEvent) {
      const el = e.target;
      if (!(el instanceof Element)) return;
      if (el.closest("[data-conv-menu]") || el.closest("[data-conv-trigger]")) return;
      setOpenConvMenuId(null);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [openConvMenuId]);

  const updateActiveMessages = useCallback(
    (updater: (prev: ChatMessage[]) => ChatMessage[]) => {
      if (!activeId) return;
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== activeId) return c;
          const messages = updater(c.messages);
          return {
            ...c,
            messages,
            title: titleFromMessages(messages),
            updatedAt: Date.now(),
          };
        })
      );
    },
    [activeId]
  );

  const runChatStream = useCallback(
    async (opts: {
      asstId: string;
      history: {
        role: "user" | "assistant";
        content: string;
        attachments?: MessageAttachment[];
      }[];
      docSaveMeta: { type: DocKind; title: string } | null;
      signal: AbortSignal;
    }) => {
      const { asstId, history, docSaveMeta, signal } = opts;
      const system = buildSystemPrompt(loadCoworkMemory(), provider);
      let streamed = "";

      try {
        const clientApiKey = getClientApiKey(provider as ProviderId) ?? undefined;
        console.log("Calling model:", model, "provider:", provider);
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: history,
            model,
            provider,
            system,
            clientApiKey,
          }),
          signal,
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          const raw =
            typeof (err as { error?: string })?.error === "string"
              ? (err as { error: string }).error
              : "";
          const msg = mapHttpErrorToUiMessage(
            res.status,
            raw || JSON.stringify(err)
          );
          updateActiveMessages((m) =>
            m.map((x) =>
              x.id === asstId ? { ...x, content: `**Erro:** ${msg}`, usage: undefined } : x
            )
          );
          return;
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("Resposta sem corpo.");

        const decoder = new TextDecoder();
        let buf = "";
        let streamError: string | null = null;

        outer: while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const parts = buf.split("\n\n");
          buf = parts.pop() ?? "";
          for (const block of parts) {
            const line = block.startsWith("data: ") ? block.slice(6) : block;
            try {
              const data = JSON.parse(line) as {
                text?: string;
                error?: string;
                usage?: { input?: number; output?: number };
              };
              if (data.error) {
                const friendly = mapStreamErrorToUiMessage(data.error);
                streamError = friendly;
                updateActiveMessages((m) =>
                  m.map((x) =>
                    x.id === asstId
                      ? { ...x, content: `**Erro:** ${friendly}`, usage: undefined }
                      : x
                  )
                );
                break outer;
              }
              if (data.usage) {
                const inp = Number(data.usage.input) || 0;
                const out = Number(data.usage.output) || 0;
                trackerRef.current.track(model, inp, out);
                const costUsd = estimateCostUsd(model, inp, out);
                updateActiveMessages((m) =>
                  m.map((x) =>
                    x.id === asstId
                      ? {
                          ...x,
                          usage: { input: inp, output: out, model, costUsd },
                        }
                      : x
                  )
                );
              }
              if (data.text) {
                streamed += data.text;
                updateActiveMessages((m) =>
                  m.map((x) =>
                    x.id === asstId
                      ? { ...x, content: x.content + data.text }
                      : x
                  )
                );
              }
            } catch {
              /* ignore partial json */
            }
          }
        }

        if (!streamError && docSaveMeta && streamed.trim()) {
          pushCoworkDoc({
            type: docSaveMeta.type,
            title: docSaveMeta.title,
            content: streamed,
          });
        }
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") {
          updateActiveMessages((m) =>
            m.map((x) =>
              x.id === asstId && !x.content.trim()
                ? { ...x, content: "_Geração interrompida._", usage: undefined }
                : x
            )
          );
        } else {
          const raw = e instanceof Error ? e.message : String(e);
          const low = raw.toLowerCase();
          const display =
            low.includes("failed to fetch") || low.includes("networkerror")
              ? mapFetchFailureToUiMessage(e)
              : mapStreamErrorToUiMessage(raw);
          updateActiveMessages((m) =>
            m.map((x) =>
              x.id === asstId
                ? { ...x, content: `**Erro:** ${display}`, usage: undefined }
                : x
            )
          );
        }
      } finally {
        abortRef.current = null;
        setLoading(false);
      }
    },
    [model, provider, updateActiveMessages]
  );

  const copyMessageContent = useCallback((messageId: string, text: string) => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopiedMsgId(messageId);
      window.setTimeout(() => {
        setCopiedMsgId((id) => (id === messageId ? null : id));
      }, 2000);
    });
  }, []);

  const editUserMessage = useCallback(
    (messageId: string) => {
      if (!activeId || loading) return;
      abortRef.current?.abort();
      abortRef.current = null;
      setLoading(false);

      const conv = conversationsRef.current.find((c) => c.id === activeId);
      if (!conv) return;
      const idx = conv.messages.findIndex((m) => m.id === messageId);
      if (idx < 0 || conv.messages[idx]?.role !== "user") return;
      const msg = conv.messages[idx];
      const content = msg.content;
      const truncated = conv.messages.slice(0, idx);

      setPendingAttachments((prev) => {
        prev.forEach(revokePendingPreview);
        return msg.attachments?.length ? messageAttachmentsToPending(msg.attachments) : [];
      });

      flushSync(() => {
        setConversations((prev) =>
          prev.map((c) => {
            if (c.id !== activeId) return c;
            return {
              ...c,
              messages: truncated,
              title: titleFromMessages(truncated),
              updatedAt: Date.now(),
            };
          })
        );
      });

      setInput(content);
      queueMicrotask(() => textareaRef.current?.focus());
    },
    [activeId, loading]
  );

  const regenerateAssistant = useCallback(
    (assistantId: string) => {
      if (!activeId || loading) return;
      const conv = conversationsRef.current.find((c) => c.id === activeId);
      if (!conv) return;
      const idx = conv.messages.findIndex((m) => m.id === assistantId);
      if (idx <= 0 || conv.messages[idx]?.role !== "assistant") return;
      const prev = conv.messages[idx - 1];
      if (prev?.role !== "user") return;

      const newAsstId = uid();
      const truncated = conv.messages.slice(0, idx);
      setConversations((prevList) =>
        prevList.map((c) =>
          c.id === activeId
            ? {
                ...c,
                messages: [
                  ...truncated,
                  { id: newAsstId, role: "assistant", content: "" },
                ],
                updatedAt: Date.now(),
                title: titleFromMessages(truncated),
              }
            : c
        )
      );

      setLoading(true);
      const ac = new AbortController();
      abortRef.current = ac;
      const history = truncated.map(chatMessageToApiTurn);
      void runChatStream({
        asstId: newAsstId,
        history,
        docSaveMeta: null,
        signal: ac.signal,
      });
    },
    [activeId, loading, runChatStream]
  );

  const newChat = useCallback(() => {
    const id = uid();
    const conv: Conversation = {
      id,
      title: "Nova conversa",
      updatedAt: Date.now(),
      messages: [],
      pinned: false,
      projectId: null,
      groupId: null,
    };
    setConversations((prev) => [conv, ...prev]);
    setActiveId(id);
    setOpenConvMenuId(null);
  }, []);

  const startRenameConversation = useCallback((id: string) => {
    const c = conversationsRef.current.find((x) => x.id === id);
    setRenameDraftTitle(c?.title ?? "");
    setRenamingConvId(id);
    setOpenConvMenuId(null);
  }, []);

  const commitRenameConversation = useCallback(() => {
    const id = renamingConvId;
    if (!id) return;
    const trimmed = renameDraftTitle.replace(/\s+/g, " ").trim();
    if (!trimmed) {
      setRenamingConvId(null);
      return;
    }
    setConversations((prev) =>
      prev.map((x) => (x.id === id ? { ...x, title: trimmed, updatedAt: Date.now() } : x))
    );
    setRenamingConvId(null);
  }, [renamingConvId, renameDraftTitle]);

  const deleteChat = useCallback((id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setOpenConvMenuId(null);
    setConversations((prev) => {
      const next = prev.filter((c) => c.id !== id);
      if (!next.length) {
        const nid = uid();
        return [
          {
            id: nid,
            title: "Nova conversa",
            updatedAt: Date.now(),
            messages: [],
            pinned: false,
            projectId: null,
            groupId: null,
          },
        ];
      }
      return next;
    });
  }, []);

  const togglePin = useCallback((id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, pinned: !c.pinned } : c))
    );
  }, []);

  const setConversationProject = useCallback((id: string, projectId: string) => {
    const pid = projectId === "" ? null : projectId;
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, projectId: pid, groupId: pid } : c))
    );
  }, []);

  const persistProjects = useCallback((next: ConversationProject[]) => {
    setProjects(next);
    try {
      localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  const submitNewProject = useCallback(() => {
    const n = projectDraft.trim();
    if (!n) return;
    const nid = uid();
    persistProjects([...projects, { id: nid, name: n }]);
    setExpandedProjects((prev) => {
      const next = new Set(prev).add(nid);
      try {
        localStorage.setItem(EXPANDED_PROJECTS_KEY, JSON.stringify([...next]));
      } catch {
        /* ignore */
      }
      return next;
    });
    setProjectDraft("");
    setAddingProject(false);
  }, [projectDraft, projects, persistProjects]);

  const toggleProjectExpanded = useCallback((projectId: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      try {
        localStorage.setItem(EXPANDED_PROJECTS_KEY, JSON.stringify([...next]));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!conversations.length) return;
    if (!activeId || !conversations.some((c) => c.id === activeId)) {
      setActiveId(conversations[0].id);
    }
  }, [conversations, activeId]);

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setPendingAttachments((p) => {
      const x = p.find((a) => a.id === id);
      if (x) revokePendingPreview(x);
      return p.filter((a) => a.id !== id);
    });
  }, []);

  useEffect(() => {
    if (!mediaLightbox) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMediaLightbox(null);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [mediaLightbox]);

  const showComposerError = useCallback((msg: string) => {
    if (composerErrorTimerRef.current) {
      clearTimeout(composerErrorTimerRef.current);
      composerErrorTimerRef.current = null;
    }
    setComposerError(msg);
    composerErrorTimerRef.current = setTimeout(() => {
      setComposerError(null);
      composerErrorTimerRef.current = null;
    }, 3000);
  }, []);

  useEffect(
    () => () => {
      if (composerErrorTimerRef.current) clearTimeout(composerErrorTimerRef.current);
    },
    []
  );

  useLayoutEffect(() => {
    if (!renamingConvId) return;
    const el = renameInputRef.current;
    if (!el) return;
    el.focus();
    el.select();
  }, [renamingConvId]);

  const addFilesToAttachments = useCallback(
    async (fileList: File[]) => {
      const files = dedupeFiles(fileList);
      if (!files.length) return;
      const added: PendingAttachment[] = [];
      for (const file of files) {
        const row = await fileToPendingAttachment(file, showComposerError);
        if (row) added.push(row);
      }
      if (!added.length) return;
      setPendingAttachments((prev) => [...prev, ...added]);
    },
    [showComposerError]
  );

  const onFilesSelected = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const el = e.target;
      const list = el.files;
      try {
        if (!list?.length) return;
        await addFilesToAttachments(Array.from(list));
      } finally {
        el.value = "";
      }
    },
    [addFilesToAttachments]
  );

  const onComposerPaste = useCallback(
    async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const dt = e.clipboardData;
      if (!dt) return;
      const raw: File[] = [];
      for (let i = 0; i < dt.files.length; i++) {
        const f = dt.files.item(i);
        if (f) raw.push(f);
      }
      if (raw.length === 0) {
        for (const item of Array.from(dt.items)) {
          if (item.kind !== "file") continue;
          const f = item.getAsFile();
          if (f) raw.push(f);
        }
      }
      const files = dedupeFiles(raw);
      if (!files.length) return;
      e.preventDefault();
      await addFilesToAttachments(files);
    },
    [addFilesToAttachments]
  );

  const sendMessage = useCallback(async () => {
    const userText = input.trim();
    const atSnapshot = pendingAttachments;
    if ((!userText && !atSnapshot.length) || loading || !activeId) return;

    const cmd = parseChatCommand(userText);

    if (cmd.kind === "salvar") {
      if (atSnapshot.length) {
        showComposerError("Remova anexos para usar /salvar.");
        return;
      }
      const payload = cmd.payload.trim();
      const userMsg: ChatMessage = { id: uid(), role: "user", content: userText };
      const asstId = uid();
      let feedback: string;
      if (payload) {
        appendCoworkInstruction(payload);
        feedback = "_Instrução guardada na memória._";
      } else {
        feedback = "_Nada para guardar._";
      }
      updateActiveMessages((m) => [
        ...m,
        userMsg,
        { id: asstId, role: "assistant", content: feedback },
      ]);
      setInput("");
      return;
    }

    const attachErr = validateAttachmentsForSend(provider, atSnapshot);
    if (attachErr) {
      showComposerError(attachErr);
      return;
    }

    const persisted: MessageAttachment[] = atSnapshot.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      size: a.size,
      base64: a.base64,
    }));

    const displayContent =
      userText ||
      (atSnapshot.length ? `📎 ${atSnapshot.map((a) => a.name).join(", ")}` : "");

    const docContextHint =
      cmd.kind === "doc"
        ? cmd.context.trim() ||
          (atSnapshot.length
            ? "Use o histórico acima e o conteúdo dos anexos."
            : "conforme o pedido.")
        : "";

    const lastApiUser = {
      role: "user" as const,
      content:
        cmd.kind === "doc"
          ? docUserPrompt(cmd.docType, docContextHint)
          : userText,
      attachments: persisted.length ? persisted : undefined,
    };

    const docSaveMeta =
      cmd.kind === "doc"
        ? {
            type: cmd.docType,
            title: (cmd.context.trim() || "documento").replace(/\s+/g, " ").slice(0, 50),
          }
        : null;

    const userMsg: ChatMessage = {
      id: uid(),
      role: "user",
      content: displayContent,
      attachments: persisted.length ? persisted : undefined,
    };
    const asstId = uid();
    const asstPlaceholder: ChatMessage = {
      id: asstId,
      role: "assistant",
      content: "",
    };

    updateActiveMessages((m) => [...m, userMsg, asstPlaceholder]);
    atSnapshot.forEach(revokePendingPreview);
    speech.stop();
    setInput("");
    setPendingAttachments([]);
    setLoading(true);

    const ac = new AbortController();
    abortRef.current = ac;

    const conv = conversationsRef.current.find((c) => c.id === activeId);
    const prior = conv?.messages ?? [];
    const history = [...prior.map(chatMessageToApiTurn), lastApiUser];

    await runChatStream({
      asstId,
      history,
      docSaveMeta,
      signal: ac.signal,
    });
  }, [
    input,
    pendingAttachments,
    loading,
    activeId,
    provider,
    runChatStream,
    updateActiveMessages,
    showComposerError,
    speech,
  ]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  };

  const onProviderChange = (pid: string) => {
    setProvider(pid);
    const row = providerRows.find((p) => p.id === pid);
    const first = row?.models[0]?.id;
    if (first) setModel(first);
  };

  const pinned = useMemo(
    () => conversations.filter((c) => c.pinned).sort(sortUpdated),
    [conversations]
  );
  const unpinned = useMemo(
    () => conversations.filter((c) => !c.pinned).sort(sortUpdated),
    [conversations]
  );

  const q = searchQuery.trim().toLowerCase();
  const matchConv = useCallback(
    (c: Conversation) => !q || c.title.toLowerCase().includes(q),
    [q]
  );

  const pinnedF = useMemo(() => pinned.filter(matchConv), [pinned, matchConv]);
  const unpinnedF = useMemo(() => unpinned.filter(matchConv), [unpinned, matchConv]);

  const { displayName, firstName, initials } = parseUserFromEmail(accountEmail);
  const emptyChat = !active?.messages.length;
  const greetingName =
    displayName && displayName !== "Utilizador"
      ? displayName
      : firstName
        ? firstName
        : initials && initials !== "?"
          ? initials
          : "";
  const greetingHeadline = greetingName
    ? `${timeOfDayGreeting()}, ${greetingName}`
    : `${timeOfDayGreeting()}!`;
  const composerPlaceholder = emptyChat
    ? "Como posso ajudar você hoje?"
    : "Responder...";

  function renderConvRow(c: Conversation) {
    const isActive = c.id === activeId;
    const isRenaming = renamingConvId === c.id;
    return (
      <div
        key={c.id}
        className={`relative rounded-xl transition-colors ${
          isActive
            ? "bg-black/[0.07] dark:bg-white/[0.1]"
            : "hover:bg-black/[0.04] dark:hover:bg-white/[0.05]"
        }`}
      >
        {isRenaming ? (
          <div
            className="px-2 py-2"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <input
              ref={renameInputRef}
              value={renameDraftTitle}
              onChange={(e) => setRenameDraftTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitRenameConversation();
                }
                if (e.key === "Escape") setRenamingConvId(null);
              }}
              className="w-full rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-surface)] px-2.5 py-2 text-[13px] font-medium text-[var(--app-text)] outline-none focus-visible:ring-2 focus-visible:ring-[#c45c2a]/35 dark:bg-[#1f1f1f]"
              aria-label="Novo nome da conversa"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => commitRenameConversation()}
                className="rounded-lg bg-[#141413] px-3 py-1.5 text-xs font-bold text-white dark:bg-[#ececec] dark:text-[#141413]"
              >
                Guardar
              </button>
              <button
                type="button"
                onClick={() => setRenamingConvId(null)}
                className="rounded-lg border border-[var(--app-border-strong)] px-3 py-1.5 text-xs font-semibold text-[var(--app-text-secondary)]"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <>
            <div
              role="button"
              tabIndex={0}
              onClick={() => {
                setActiveId(c.id);
                setOpenConvMenuId(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setActiveId(c.id);
                  setOpenConvMenuId(null);
                }
              }}
              className="flex cursor-pointer items-center gap-1 px-2 py-2.5 pr-1 text-left"
            >
              <span
                className="min-w-0 flex-1 truncate text-[13px] font-medium leading-snug text-[var(--app-text)]"
                title={c.title}
              >
                {c.title}
              </span>
              <button
                type="button"
                data-conv-trigger
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenConvMenuId((id) => (id === c.id ? null : c.id));
                }}
                className="ml-0.5 shrink-0 rounded-full p-1.5 text-[var(--app-text-secondary)] transition-colors hover:bg-black/[0.08] dark:hover:bg-white/[0.1]"
                aria-label="Mais opções"
                aria-expanded={openConvMenuId === c.id}
                aria-haspopup="menu"
              >
                <MoreVerticalIcon />
              </button>
            </div>
          </>
        )}
        {!isRenaming && openConvMenuId === c.id ? (
          <div
            data-conv-menu
            role="menu"
            aria-label="Opções da conversa"
            className="absolute right-1 top-full z-[80] mt-1 min-w-[min(260px,calc(100%-4px))] max-w-[calc(100vw-2rem)] rounded-xl border border-[var(--app-border-strong)] bg-[var(--app-surface)] py-1.5 shadow-xl dark:border-[#3a3a3a] dark:bg-[#2a2a2a]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              role="menuitem"
              onClick={(e) => {
                e.stopPropagation();
                togglePin(c.id, e);
                setOpenConvMenuId(null);
              }}
              className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-[13px] font-medium text-[var(--app-text)] transition hover:bg-black/[0.06] dark:hover:bg-white/[0.06]"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center text-[var(--app-text-secondary)]">
                <PinIcon filled={Boolean(c.pinned)} />
              </span>
              {c.pinned ? "Desafixar" : "Fixar"}
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={(e) => {
                e.stopPropagation();
                startRenameConversation(c.id);
              }}
              className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-[13px] font-medium text-[var(--app-text)] transition hover:bg-black/[0.06] dark:hover:bg-white/[0.06]"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center text-[var(--app-text-secondary)]">
                <PencilEditIcon className="h-[17px] w-[17px]" />
              </span>
              Renomear
            </button>
            <div className="my-1.5 border-t border-[var(--app-border)] dark:border-white/[0.08]" />
            <p className="px-3 pb-1.5 pt-0.5 text-[10px] font-bold uppercase tracking-wide text-[#c45c2a]/90 dark:text-[#e8a87c]/90">
              Colocar no grupo
            </p>
            <select
              aria-label="Grupo ou pasta da conversa"
              value={convProjectId(c) ?? ""}
              onChange={(e) => {
                setConversationProject(c.id, e.target.value);
                setOpenConvMenuId(null);
              }}
              onClick={(e) => e.stopPropagation()}
              className="mx-2 mb-1 w-[calc(100%-16px)] cursor-pointer rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-surface-2)] px-2.5 py-2 text-xs font-medium text-[var(--app-text)] outline-none transition focus-visible:ring-2 focus-visible:ring-[#c45c2a]/35 dark:bg-[#1f1f1f]"
            >
              <option value="">Fora de grupos</option>
              {projects.map((proj) => (
                <option key={proj.id} value={proj.id}>
                  {proj.name}
                </option>
              ))}
            </select>
            <div className="my-1.5 border-t border-[var(--app-border)] dark:border-white/[0.08]" />
            <button
              type="button"
              role="menuitem"
              onClick={(e) => {
                e.stopPropagation();
                deleteChat(c.id, e);
              }}
              className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-[13px] font-semibold text-[#b91c1c] transition hover:bg-red-50 dark:text-[#fca5a5] dark:hover:bg-red-950/25"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center text-[#b91c1c] dark:text-[#fca5a5]">
                <TrashIcon />
              </span>
              Apagar
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  function sectionTitle(t: string) {
    return (
      <div className="px-2 pb-1 pt-3 text-[11px] font-bold uppercase tracking-wider text-[var(--app-text-muted)] first:pt-1">
        {t}
      </div>
    );
  }

  return (
    <>
    <div className="flex h-[100dvh] w-full overflow-hidden bg-[#fafafa] text-[var(--app-text)] transition-colors duration-200 dark:bg-[#212121]">
      <aside
        className={`flex min-h-0 shrink-0 flex-col border-r border-[var(--app-border)] bg-[#f4f4f4] transition-[width,opacity,transform] duration-300 ease-out dark:bg-[#171717] ${
          sidebarOpen ? "w-[280px] translate-x-0 opacity-100" : "w-0 translate-x-[-4px] overflow-hidden opacity-0"
        }`}
      >
        <div className="flex items-center justify-between gap-2 border-b border-[var(--app-border)] px-3 py-2 dark:border-white/[0.08]">
          <span className="flex items-center gap-2 truncate text-sm font-bold tracking-tight text-[var(--app-text)]">
            <ChatBubbleIcon />
            Conversas
          </span>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="rounded-lg p-2 text-[var(--app-text-secondary)] transition hover:bg-[var(--app-hover)]"
            aria-label="Fechar menu"
          >
            <ChevronLeftIcon />
          </button>
        </div>
        <div className="space-y-2 px-2 pb-2">
          <button
            type="button"
            onClick={newChat}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--app-border-strong)] bg-[#141413] py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#2d2d2d] dark:bg-[#ececec] dark:text-[#141413] dark:hover:bg-white"
          >
            <PlusIcon />
            Nova conversa
          </button>
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--app-text-muted)]" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Procurar conversas…"
              className="w-full rounded-xl border border-[var(--app-border-strong)] bg-[var(--app-surface)] py-2.5 pl-9 pr-3 text-sm font-medium text-[var(--app-text)] placeholder:text-[var(--app-placeholder)] outline-none transition focus:border-[#c45c2a]/50 focus:ring-2 focus:ring-[#c45c2a]/20 dark:bg-[#262626]"
            />
          </div>
        </div>

        <div className="shrink-0 border-b border-[var(--app-border)] px-2 pb-2 pt-1 dark:border-white/[0.08]">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setProjectsPanelOpen((v) => !v)}
              className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-2 text-left transition hover:bg-[var(--app-hover)]"
              aria-expanded={projectsPanelOpen}
            >
              <ChevronRightIcon
                className={`h-4 w-4 shrink-0 text-[var(--app-text-muted)] transition-transform ${projectsPanelOpen ? "rotate-90" : ""}`}
              />
              <FolderOutlineIcon className="h-4 w-4 shrink-0 text-[var(--app-text-secondary)]" />
              <span className="truncate text-[12px] font-bold uppercase tracking-wide text-[var(--app-text)]">
                Projetos
              </span>
              <span className="ml-auto shrink-0 rounded-md bg-black/[0.06] px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-[var(--app-text-muted)] dark:bg-white/[0.08]">
                {projects.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setAddingProject((v) => !v)}
              className="shrink-0 rounded-lg p-2 text-[var(--app-text-secondary)] transition hover:bg-[var(--app-hover)]"
              aria-label={addingProject ? "Fechar novo projeto" : "Novo projeto"}
            >
              {addingProject ? <CloseSmIcon /> : <PlusSmIcon />}
            </button>
          </div>
          {projectsPanelOpen ? (
            <div className="chat-app-scroll max-h-[min(40vh,320px)] space-y-2 overflow-y-auto pt-1">
              {addingProject ? (
                <div className="flex gap-1 rounded-xl border border-[var(--app-border-strong)] bg-[var(--app-surface-2)] p-2 dark:bg-[#262626]">
                  <input
                    value={projectDraft}
                    onChange={(e) => setProjectDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") submitNewProject();
                    }}
                    placeholder="Nome da pasta…"
                    className="min-w-0 flex-1 rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-surface)] px-2 py-2 text-xs font-medium text-[var(--app-text)] placeholder:text-[var(--app-placeholder)] dark:bg-[#1f1f1f]"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={submitNewProject}
                    className="shrink-0 rounded-lg bg-[var(--app-text)] px-3 py-2 text-xs font-bold text-[var(--app-surface)] dark:bg-[#ececec] dark:text-[#141413]"
                  >
                    OK
                  </button>
                </div>
              ) : null}
              {projects.length === 0 && !addingProject ? (
                <p className="rounded-xl border border-dashed border-[var(--app-border-strong)] px-3 py-4 text-center text-[11px] font-medium leading-relaxed text-[var(--app-text-muted)]">
                  Nenhuma pasta. Use + para criar e depois mova conversas pelo menu ⋯.
                </p>
              ) : (
                projects.map((proj) => {
                  const inside = unpinnedF.filter((c) => convProjectId(c) === proj.id);
                  const open = expandedProjects.has(proj.id);
                  return (
                    <div
                      key={proj.id}
                      className="overflow-hidden rounded-xl border border-[var(--app-border-strong)] bg-[var(--app-surface)] shadow-sm dark:bg-[#262626]"
                    >
                      <button
                        type="button"
                        onClick={() => toggleProjectExpanded(proj.id)}
                        className="flex w-full items-center gap-2 px-2.5 py-2.5 text-left transition hover:bg-[var(--app-hover)]"
                        aria-expanded={open}
                      >
                        <ChevronRightIcon
                          className={`h-3.5 w-3.5 shrink-0 text-[var(--app-text-muted)] transition-transform ${open ? "rotate-90" : ""}`}
                        />
                        <FolderOutlineIcon className="h-3.5 w-3.5 shrink-0 opacity-80" />
                        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-[var(--app-text)]">
                          {proj.name}
                        </span>
                        <span className="shrink-0 rounded-md bg-black/[0.06] px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-[var(--app-text-muted)] dark:bg-white/[0.08]">
                          {inside.length}
                        </span>
                      </button>
                      {open ? (
                        <div className="border-t border-[var(--app-border)] px-1 py-1 dark:border-white/[0.08]">
                          {inside.length ? (
                            inside.map(renderConvRow)
                          ) : (
                            <p className="px-2 py-3 text-center text-[11px] font-medium text-[var(--app-text-muted)]">
                              Sem conversas nesta pasta.
                            </p>
                          )}
                        </div>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          ) : null}
        </div>

        <nav className="chat-app-scroll flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overflow-x-hidden px-2 pb-2 pt-1">
          {pinnedF.length > 0 ? (
            <>
              {sectionTitle("Fixadas")}
              {pinnedF.map(renderConvRow)}
            </>
          ) : null}
          {(() => {
            const rest = unpinnedF.filter((c) => !convProjectId(c));
            if (!rest.length) return null;
            return (
              <>
                {sectionTitle("Geral")}
                {rest.map(renderConvRow)}
              </>
            );
          })()}
          {q && !pinnedF.length && !unpinnedF.some(matchConv) ? (
            <p className="px-2 py-6 text-center text-sm font-medium text-[var(--app-text-muted)]">
              Nenhuma conversa corresponde à pesquisa.
            </p>
          ) : null}
        </nav>

        <div className="shrink-0 border-t border-[var(--app-border)] p-2 dark:border-white/[0.08]">
          <ChatAccountMenu email={accountEmail} onLogout={logout} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col bg-transparent">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-[var(--app-border)] bg-transparent px-2 sm:px-3">
          {!sidebarOpen && (
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg p-2 text-[var(--app-text-secondary)] transition hover:bg-[var(--app-hover)]"
              aria-label="Abrir menu"
            >
              <MenuIcon />
            </button>
          )}
          <span
            className="flex min-w-0 flex-1 items-center justify-center gap-2 text-center text-sm font-semibold text-[var(--app-text)] sm:justify-start"
            title={`${composerFooterProviderModel.providerShort} — ${composerFooterProviderModel.modelLabel}`}
          >
            <ProviderBrandIcon
              providerId={provider}
              className="h-5 w-5 shrink-0 text-[var(--app-text)]"
            />
            <span className="truncate">{headerProviderName}</span>
          </span>
        </header>

        <main className="relative z-0 flex min-h-0 flex-1 flex-col bg-transparent">
          <div
            className={`chat-app-scroll relative z-0 flex-1 overflow-y-auto bg-transparent px-4 py-6 sm:px-6 ${emptyChat ? "flex flex-col" : ""}`}
          >
            <div
              className={`mx-auto flex w-full max-w-3xl flex-col gap-6 ${emptyChat ? "min-h-0 flex-1 justify-center" : ""}`}
            >
              {emptyChat ? (
                <div className="px-2 text-center">
                  <p className="text-2xl font-semibold tracking-tight text-[var(--app-text)] sm:text-3xl">
                    {greetingHeadline}
                    <br />
                    <span className="text-[var(--app-text-secondary)]">
                      Como posso ajudar você hoje?
                    </span>
                  </p>
                  <p className="mx-auto mt-3 max-w-md text-sm font-medium leading-relaxed text-[var(--app-text-secondary)]">
                    Pergunte, peça código ou documentação.{" "}
                    <kbd className="rounded-md border border-black/[0.1] bg-black/[0.04] px-1.5 py-0.5 font-mono text-xs dark:border-white/[0.12] dark:bg-white/[0.08]">
                      Enter
                    </kbd>{" "}
                    envia;{" "}
                    <kbd className="rounded-md border border-black/[0.1] bg-black/[0.04] px-1.5 py-0.5 font-mono text-xs dark:border-white/[0.12] dark:bg-white/[0.08]">
                      Shift+Enter
                    </kbd>{" "}
                    nova linha.
                  </p>
                </div>
              ) : null}
              {(active?.messages ?? []).map((m) => {
                const thread = active?.messages ?? [];
                const lastId = thread[thread.length - 1]?.id;
                const streamingDots =
                  loading &&
                  m.role === "assistant" &&
                  m.id === lastId &&
                  !m.content.trim();
                const userHoverActions =
                  "pointer-events-none opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 max-md:pointer-events-auto max-md:opacity-100";

                return (
                  <div
                    key={m.id}
                    className={`group flex flex-col gap-1 transition-opacity duration-200 ${
                      m.role === "user" ? "items-end" : "items-start"
                    }`}
                  >
                    {m.role === "user" ? (
                      <div className="flex w-full max-w-full justify-end">
                        <div className="flex max-w-full items-end gap-1.5">
                          <div
                            className={`flex shrink-0 flex-row items-center gap-0.5 rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-surface-2)] px-1 py-1 shadow-sm dark:border-white/[0.12] dark:bg-[#2a2a2a] ${userHoverActions}`}
                          >
                            <button
                              type="button"
                              onClick={() => copyMessageContent(m.id, m.content)}
                              title={copiedMsgId === m.id ? "Copiado" : "Copiar"}
                              aria-label={copiedMsgId === m.id ? "Copiado" : "Copiar mensagem"}
                              className="rounded-md p-1.5 text-[var(--app-text-muted)] transition hover:bg-[var(--app-hover)] hover:text-[var(--app-text)] dark:text-white/75 dark:hover:bg-white/10 dark:hover:text-white"
                            >
                              {copiedMsgId === m.id ? (
                                <MessageActionCheckIcon className="h-[17px] w-[17px]" />
                              ) : (
                                <CopyMessageIcon className="h-[17px] w-[17px]" />
                              )}
                            </button>
                            <button
                              type="button"
                              disabled={loading}
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                editUserMessage(m.id);
                              }}
                              title="Editar pergunta"
                              aria-label="Editar pergunta"
                              className="rounded-md p-1.5 text-[var(--app-text-muted)] transition hover:bg-[var(--app-hover)] hover:text-[var(--app-text)] disabled:opacity-40 dark:text-white/75 dark:hover:bg-white/10 dark:hover:text-white"
                            >
                              <PencilEditIcon className="h-[17px] w-[17px]" />
                            </button>
                          </div>
                          <div
                            className={`min-w-0 max-w-[min(100%,42rem)] rounded-2xl px-4 py-3 shadow-sm ${
                              "bg-[#141413] text-[#fafafa] dark:bg-[#303030] dark:text-[#ececec]"
                            }`}
                          >
                            {m.attachments && m.attachments.length > 0 ? (
                              <div className="mb-2 flex flex-wrap gap-2">
                                {m.attachments.map((att) =>
                                  att.type.toLowerCase().startsWith("image/") ? (
                                    <button
                                      key={att.id}
                                      type="button"
                                      onClick={() =>
                                        setMediaLightbox({
                                          url: `data:${att.type};base64,${att.base64}`,
                                          name: att.name,
                                        })
                                      }
                                      className="overflow-hidden rounded-lg border border-white/15 outline-none transition hover:ring-2 hover:ring-[#c45c2a]/40 focus-visible:ring-2 focus-visible:ring-[#c45c2a]/50"
                                    >
                                      {/* eslint-disable-next-line @next/next/no-img-element -- base64 do histórico */}
                                      <img
                                        src={`data:${att.type};base64,${att.base64}`}
                                        alt=""
                                        className="max-h-32 max-w-[220px] object-cover"
                                      />
                                    </button>
                                  ) : (
                                    <span
                                      key={att.id}
                                      className="inline-flex max-w-full items-center gap-1 rounded-lg bg-white/10 px-2 py-1 text-left text-xs font-medium"
                                    >
                                      <span aria-hidden>📄</span>
                                      <span className="truncate">{att.name}</span>
                                    </span>
                                  )
                                )}
                              </div>
                            ) : null}
                            {m.content.trim() ? (
                              <p className="whitespace-pre-wrap text-[15px] leading-relaxed">
                                {m.content}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        {streamingDots ? (
                          <div
                            className="chat-loading-dots w-full max-w-[min(100%,42rem)] text-[var(--app-text-muted)] dark:text-white/45"
                            aria-label="A gerar resposta"
                            aria-live="polite"
                          >
                            <span />
                            <span />
                            <span />
                          </div>
                        ) : (
                          <div className="w-full max-w-[min(100%,42rem)] px-0.5 sm:px-1">
                            <MarkdownMessage
                              content={m.content}
                              className={
                                m.content ? "" : "italic text-[#737373] dark:text-[#a3a3a3]"
                              }
                            />
                          </div>
                        )}
                        {!streamingDots ? (
                          <div className="mt-1.5 flex w-full max-w-[min(100%,42rem)] items-center justify-start gap-1 px-0.5 sm:px-1">
                            <button
                              type="button"
                              onClick={() => copyMessageContent(m.id, m.content)}
                              title={copiedMsgId === m.id ? "Copiado" : "Copiar"}
                              aria-label={copiedMsgId === m.id ? "Copiado" : "Copiar mensagem"}
                              className="rounded-lg p-1.5 text-[var(--app-text-muted)] transition hover:bg-[var(--app-hover)] hover:text-[var(--app-text)] dark:text-white/55 dark:hover:bg-white/[0.08] dark:hover:text-white/90"
                            >
                              {copiedMsgId === m.id ? (
                                <MessageActionCheckIcon className="h-[17px] w-[17px]" />
                              ) : (
                                <CopyMessageIcon className="h-[17px] w-[17px]" />
                              )}
                            </button>
                            <button
                              type="button"
                              disabled={loading || !m.content.trim()}
                              onClick={() => regenerateAssistant(m.id)}
                              title="Regenerar resposta"
                              aria-label="Regenerar resposta"
                              className="rounded-lg p-1.5 text-[var(--app-text-muted)] transition hover:bg-[var(--app-hover)] hover:text-[var(--app-text)] disabled:opacity-40 dark:text-white/55 dark:hover:bg-white/[0.08] dark:hover:text-white/90"
                            >
                              <RegenerateIcon className="h-[17px] w-[17px]" />
                            </button>
                          </div>
                        ) : null}
                      </>
                    )}
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>
          </div>

          <div className="chat-composer-dock z-30 shrink-0 px-4 pb-5 pt-1 sm:px-6">
            <div className="chat-composer-dock-inner mx-auto max-w-3xl">
              <div className="chat-composer-glass">
                {pendingAttachments.length > 0 ? (
                  <div className="mb-2 flex flex-wrap gap-2 border-b border-[var(--app-border)] pb-2 dark:border-white/[0.12]">
                    {pendingAttachments.map((a) =>
                      a.previewUrl ? (
                        <div key={a.id} className="relative shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              setMediaLightbox({ url: a.previewUrl!, name: a.name })
                            }
                            disabled={loading}
                            title={a.name}
                            aria-label={`Ampliar pré-visualização: ${a.name}`}
                            className="block h-[72px] w-[96px] overflow-hidden rounded-xl border border-[var(--app-border-strong)] bg-[var(--app-surface-2)] outline-none transition hover:ring-2 hover:ring-[#c45c2a]/35 focus-visible:ring-2 focus-visible:ring-[#c45c2a]/50 disabled:pointer-events-none disabled:opacity-40 dark:bg-black/30"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element -- blob URL do utilizador */}
                            <img
                              src={a.previewUrl}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeAttachment(a.id)}
                            disabled={loading}
                            className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full border border-[var(--app-border-strong)] bg-[var(--app-surface)] text-[var(--app-text-muted)] shadow-sm transition hover:bg-[var(--app-hover)] hover:text-[var(--app-text)] disabled:opacity-40 dark:bg-[#2b2b2b]"
                            aria-label={`Remover ${a.name}`}
                          >
                            <CloseSmIcon />
                          </button>
                        </div>
                      ) : (
                        <span
                          key={a.id}
                          className="inline-flex max-w-full items-center gap-1 rounded-full border border-[var(--app-border-strong)] bg-[var(--app-surface-2)] px-2.5 py-1 text-xs font-medium text-[var(--app-text)] dark:bg-black/25"
                        >
                          <span aria-hidden className="shrink-0">
                            {a.type === "application/pdf" ? "📄" : "📎"}
                          </span>
                          <span className="truncate">{a.name}</span>
                          <button
                            type="button"
                            onClick={() => removeAttachment(a.id)}
                            disabled={loading}
                            className="shrink-0 rounded-full p-0.5 text-[var(--app-text-muted)] hover:bg-black/10 hover:text-[var(--app-text)] disabled:opacity-40 dark:hover:bg-white/10"
                            aria-label={`Remover ${a.name}`}
                          >
                            <CloseSmIcon />
                          </button>
                        </span>
                      )
                    )}
                  </div>
                ) : null}
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => {
                    const v = e.target.value;
                    setInput(v);
                    if (speech.listening) {
                      speech.notifyUserEditedTranscript(v);
                    }
                  }}
                  onPaste={(e) => void onComposerPaste(e)}
                  onKeyDown={onKeyDown}
                  placeholder={composerPlaceholder}
                  rows={1}
                  disabled={loading}
                  className="chat-composer-textarea chat-app-scroll max-h-[280px] min-h-[52px] w-full resize-none overflow-y-auto py-0.5 text-[15px] leading-relaxed text-[var(--app-text)] placeholder:text-[var(--app-placeholder)]"
                />
                <div className="mt-2 flex w-full min-w-0 flex-row flex-wrap items-center gap-2">
                  <label
                    htmlFor={composerFileInputId}
                    title="Anexar ficheiro, imagem ou colar com Ctrl+V na caixa de texto"
                    className={`relative z-[35] flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-transparent bg-transparent text-[var(--app-text-secondary)] transition-colors hover:border-[var(--app-border-strong)] hover:bg-black/[0.06] dark:hover:border-white/[0.14] dark:hover:bg-white/[0.08] focus-within:outline-none focus-within:ring-2 focus-within:ring-[#c45c2a]/35 ${
                      loading ? "pointer-events-none opacity-40" : ""
                    }`}
                  >
                    <input
                      id={composerFileInputId}
                      ref={fileInputRef}
                      type="file"
                      multiple
                      className="sr-only"
                      accept={COMPOSER_FILE_PICKER_ACCEPT}
                      disabled={loading}
                      onChange={(e) => void onFilesSelected(e)}
                      aria-label="Anexar ficheiro"
                    />
                    <span className="pointer-events-none flex items-center justify-center" aria-hidden>
                      <PlusIcon />
                    </span>
                  </label>
                  <ProviderModelPicker
                    variant="cascade"
                    className="min-w-0 flex-1"
                    providers={providerRows}
                    provider={provider}
                    model={model}
                    onProviderChange={onProviderChange}
                    onModelChange={setModel}
                    disabled={loading || !providersLoaded}
                  />
                  {speech.supported ? (
                    <button
                      type="button"
                      onClick={() =>
                        speech.listening ? speech.stop() : speech.start(input)
                      }
                      disabled={loading}
                      title={speech.listening ? "Parar ditado" : "Falar para escrever (pt-BR)"}
                      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--app-border-strong)] px-3 py-2 text-xs font-bold transition hover:bg-[var(--app-hover)] ${
                        speech.listening
                          ? "border-red-400/50 text-red-600 dark:text-red-300"
                          : "text-[var(--app-text-secondary)]"
                      }`}
                    >
                      <MicIcon />
                      {speech.listening ? "A ouvir…" : "Voz"}
                    </button>
                  ) : null}
                  {loading && (
                    <button
                      type="button"
                      onClick={stopGeneration}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--app-border-strong)] px-3 py-2 text-xs font-bold text-[var(--app-text-secondary)] transition hover:bg-[var(--app-hover)]"
                    >
                      <StopIcon />
                      Parar
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void sendMessage()}
                    disabled={loading || (!input.trim() && pendingAttachments.length === 0)}
                    className="ml-auto inline-flex shrink-0 items-center gap-2 rounded-full bg-[#141413] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#2d2d2d] disabled:cursor-not-allowed disabled:opacity-35 dark:bg-[#ececec] dark:text-[#141413] dark:hover:bg-white"
                  >
                    <SendIcon />
                    Enviar
                  </button>
                </div>
              </div>
              {composerError ? (
                <p
                  role="alert"
                  className="mt-2 text-center text-sm font-medium text-red-600/85 dark:text-red-300/90"
                >
                  {composerError}
                </p>
              ) : null}
              <p className="mt-2 text-center text-[11px] font-semibold text-[var(--app-text-muted)]">
                <span className="inline-flex flex-wrap items-center justify-center gap-x-1 gap-y-0.5">
                  <span className="rounded-md bg-[var(--app-surface-2)] px-1.5 py-0.5 text-[11px] font-bold text-[var(--app-text)] dark:bg-white/10">
                    {composerFooterProviderModel.providerShort}
                  </span>
                  <span className="font-normal text-[var(--app-text-muted)]" aria-hidden>
                    —
                  </span>
                  <span className="text-[11px] font-semibold text-[var(--app-text-secondary)]">
                    {composerFooterProviderModel.modelLabel}
                  </span>
                </span>
                {composerFooterProviderModel.row && !composerFooterProviderModel.row.configured
                  ? " · Adicione a chave em Definições para enviar mensagens."
                  : " · Verifique informações críticas."}
                {" · "}
                <Link
                  href="/settings/usage"
                  className="underline-offset-2 hover:text-[var(--app-text-secondary)] hover:underline"
                >
                  Uso e custos
                </Link>
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
    {mediaLightbox ? (
      <div
        role="dialog"
        aria-modal="true"
        aria-label={mediaLightbox.name}
        className="fixed inset-0 z-[200] flex cursor-pointer items-center justify-center bg-black/85 p-4 backdrop-blur-[2px]"
        onClick={() => setMediaLightbox(null)}
      >
        <button
          type="button"
          onClick={() => setMediaLightbox(null)}
          className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition hover:bg-white/20"
          aria-label="Fechar visualização"
        >
          <CloseSmIcon />
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element -- data URL local do anexo */}
        <img
          src={mediaLightbox.url}
          alt={mediaLightbox.name}
          className="max-h-[min(90dvh,900px)] max-w-full rounded-lg object-contain shadow-2xl ring-1 ring-white/10"
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    ) : null}
    </>
  );
}

/** Folha de trás: L (esquerda + base); frente: retângulo completo — traço fino como referência. */
function CopyMessageIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 8.5v9.5h9.5" />
      <rect x="10" y="5.5" width="10.5" height="12.5" rx="1.75" ry="1.75" />
    </svg>
  );
}

function PencilEditIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}

function RegenerateIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4.5 9.5 A8 8 0 0 1 18.35 5.35 M19.5 14.5 a8 8 0 0 1 -13.85 4.15" />
      <path d="M19.5 5.5 V10 h-4.5 M4.5 18.5 V14 h4.5" />
    </svg>
  );
}

function MessageActionCheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function FolderOutlineIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <path
        d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PlusSmIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function CloseSmIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ChatBubbleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M21 15a4 4 0 01-4 4H8l-5 4V7a4 4 0 014-4h10a4 4 0 014 4v8z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 14a3 3 0 003-3V5a3 3 0 10-6 0v6a3 3 0 003 3zM19 10a7 7 0 01-14 0M12 18v4M8 22h8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <rect x="6" y="6" width="12" height="12" rx="1" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 7h16M4 12h16M4 17h16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M15 6l-6 6 6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <path
        d="M9 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 7h16M10 11v6M14 11v6M6 7l1 12h10l1-12M9 7V5h6v2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PinIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
      {filled ? (
        <path
          fill="currentColor"
          d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14 2 9.27l6.91-1.01L12 2z"
        />
      ) : (
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
          d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14 2 9.27l6.91-1.01L12 2z"
        />
      )}
    </svg>
  );
}

function MoreVerticalIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <circle cx="12" cy="5" r="1.75" />
      <circle cx="12" cy="12" r="1.75" />
      <circle cx="12" cy="19" r="1.75" />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.35-4.35"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
