import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { sanitizeModelAllowlist, type ModelAllowlist } from "@/lib/model-allowlist";
import type { ProviderId } from "@/lib/provider-config";
import { parseUserRole, type UserRole } from "@/lib/user-role";

const PROVIDER_IDS: ProviderId[] = ["anthropic", "openai", "google", "groq"];

/** Equivalente a `users.status` em Supabase: pedido / ativo / acesso negado ou revogado. */
export type UserStatus = "pending" | "active" | "rejected";

export type PendingRegistration = {
  id: string;
  email: string;
  passwordHash: string;
  requestedAt: string;
  fullName?: string;
};

export type AppUser = {
  id: string;
  email: string;
  passwordHash: string;
  status?: UserStatus;
  fullName?: string;
  requestedAt?: string;
  approvedAt?: string;
  role?: UserRole;
  /**
   * Provedores permitidos no chat. `undefined` ou `null` = todos.
   * Array vazio = nenhum (até o admin corrigir).
   */
  allowedProviders?: ProviderId[] | null;
  /**
   * Lista de modelos por provedor só para este utilizador.
   * `null` ou ausente = usar a lista global da app (Chaves e modelos).
   */
  userModelAllowlist?: ModelAllowlist | null;
};

export type AppApiKeys = {
  anthropic?: string;
  openai?: string;
  google?: string;
  groq?: string;
};

export type AppDataFile = {
  users: AppUser[];
  /** Legado: migrado para `users` com status `pending` ao carregar. */
  pendingRegistrations?: PendingRegistration[];
  apiKeys: AppApiKeys;
  modelAllowlist?: ModelAllowlist;
};

const defaultData: AppDataFile = {
  users: [],
  pendingRegistrations: [],
  apiKeys: {},
};

function dataPath(): string {
  return join(process.cwd(), "data", "app-data.json");
}

export function effectiveUserStatus(u: AppUser): UserStatus {
  return u.status ?? "active";
}

function normalizeAllowedProviders(v: unknown): ProviderId[] | null | undefined {
  if (v === null) return null;
  if (v === undefined) return undefined;
  if (!Array.isArray(v)) return undefined;
  return v.filter((x): x is ProviderId =>
    typeof x === "string" && PROVIDER_IDS.includes(x as ProviderId)
  );
}

function normalizeUser(u: AppUser): AppUser {
  const status: UserStatus =
    u.status === "pending" || u.status === "rejected" ? u.status : (u.status ?? "active");
  return {
    ...u,
    status,
    role: parseUserRole(u.role),
    allowedProviders: normalizeAllowedProviders(u.allowedProviders),
    userModelAllowlist:
      u.userModelAllowlist === null
        ? null
        : u.userModelAllowlist === undefined
          ? undefined
          : sanitizeModelAllowlist(u.userModelAllowlist),
  };
}

function sanitizePending(raw: unknown): PendingRegistration[] {
  if (!Array.isArray(raw)) return [];
  const out: PendingRegistration[] = [];
  for (const p of raw) {
    if (!p || typeof p !== "object") continue;
    const o = p as Record<string, unknown>;
    if (
      typeof o.id === "string" &&
      typeof o.email === "string" &&
      typeof o.passwordHash === "string" &&
      typeof o.requestedAt === "string"
    ) {
      const fn = o.fullName;
      out.push({
        id: o.id,
        email: o.email.trim().toLowerCase(),
        passwordHash: o.passwordHash,
        requestedAt: o.requestedAt,
        fullName: typeof fn === "string" ? fn.trim() : undefined,
      });
    }
  }
  return out;
}

/** Migra `pendingRegistrations` legado para `users` com status `pending`. */
function migrateLegacyPending(data: AppDataFile): AppDataFile {
  const users = data.users.map((u) => normalizeUser(u));
  const emails = new Set(users.map((u) => u.email.toLowerCase()));
  const legacy = data.pendingRegistrations ?? [];
  for (const p of legacy) {
    const em = p.email.toLowerCase();
    if (emails.has(em)) continue;
    emails.add(em);
    users.push(
      normalizeUser({
        id: p.id,
        email: em,
        passwordHash: p.passwordHash,
        status: "pending",
        fullName: p.fullName?.trim() || undefined,
        requestedAt: p.requestedAt,
        role: "user",
        allowedProviders: null,
        userModelAllowlist: null,
      })
    );
  }
  return {
    ...data,
    users,
    pendingRegistrations: [],
  };
}

export function loadAppData(): AppDataFile {
  const p = dataPath();
  if (!existsSync(p)) return structuredClone(defaultData);
  try {
    const raw = readFileSync(p, "utf8");
    const parsed = JSON.parse(raw) as Partial<AppDataFile>;
    const usersRaw: AppUser[] = Array.isArray(parsed.users)
      ? parsed.users.filter(
          (u): u is AppUser =>
            u != null &&
            typeof u === "object" &&
            typeof (u as AppUser).id === "string" &&
            typeof (u as AppUser).email === "string" &&
            typeof (u as AppUser).passwordHash === "string"
        )
      : [];
    const users: AppUser[] = usersRaw.map((u) =>
      normalizeUser({ ...u, status: u.status ?? "active" })
    );
    const base: AppDataFile = {
      users,
      pendingRegistrations: sanitizePending(parsed.pendingRegistrations),
      apiKeys:
        parsed.apiKeys && typeof parsed.apiKeys === "object"
          ? parsed.apiKeys
          : {},
      modelAllowlist: sanitizeModelAllowlist(parsed.modelAllowlist),
    };
    const migrated = migrateLegacyPending(base);
    if (
      (parsed.pendingRegistrations?.length ?? 0) > 0 &&
      migrated.pendingRegistrations?.length === 0
    ) {
      try {
        saveAppData(migrated);
      } catch {
        /* ignore persist failure */
      }
    }
    return migrated;
  } catch {
    return structuredClone(defaultData);
  }
}

export function saveAppData(data: AppDataFile): void {
  const dir = join(process.cwd(), "data");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const toSave: AppDataFile = {
    ...data,
    users: data.users.map((u) => normalizeUser(u)),
    pendingRegistrations: [],
  };
  writeFileSync(dataPath(), JSON.stringify(toSave, null, 2), "utf8");
}

export function maskKey(key: string | undefined): string | null {
  if (!key || key.length < 8) return key ? "********" : null;
  return `…${key.slice(-4)}`;
}
