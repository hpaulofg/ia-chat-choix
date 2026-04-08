import type { AppDataFile, AppUser } from "@/lib/app-data";
import type { ModelAllowlist } from "@/lib/model-allowlist";
import { sanitizeModelAllowlist } from "@/lib/model-allowlist";
import type { ProviderId } from "@/lib/provider-config";
import { isAdminRole, type UserRole } from "@/lib/user-role";

const ALL_PROVIDERS: ProviderId[] = ["anthropic", "openai", "google", "groq"];

/**
 * Lista efetiva de modelos para o chat.
 * Admin: undefined (catálogo completo).
 * Usuário com userModelAllowlist definido: essa lista; senão a global da app.
 */
export function effectiveModelAllowlistForChat(
  data: AppDataFile,
  role: UserRole,
  user: AppUser | null
): ModelAllowlist | undefined {
  if (isAdminRole(role)) return undefined;
  if (user?.userModelAllowlist != null) {
    return sanitizeModelAllowlist(user.userModelAllowlist);
  }
  return data.modelAllowlist;
}

/**
 * null = todos os provedores. Array vazio = nenhum. Subconjunto = só esses.
 */
export function providerIdsForUser(role: UserRole, user: AppUser | null): ProviderId[] | null {
  if (isAdminRole(role)) return null;
  const list = user?.allowedProviders;
  if (list === undefined || list === null) return null;
  const filtered = list.filter((id): id is ProviderId =>
    ALL_PROVIDERS.includes(id as ProviderId)
  );
  return filtered;
}

export function userMayUseProvider(
  role: UserRole,
  user: AppUser | null,
  provider: ProviderId
): boolean {
  const ids = providerIdsForUser(role, user);
  if (ids === null) return true;
  return ids.includes(provider);
}
