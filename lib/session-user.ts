import { cookies } from "next/headers";
import type { AppUser } from "@/lib/app-data";
import { effectiveUserStatus, loadAppData } from "@/lib/app-data";
import { SESSION_EMAIL_COOKIE } from "@/lib/session-email";
import { isAdminRole, parseUserRole, type UserRole } from "@/lib/user-role";

export async function getSessionEmail(): Promise<string | null> {
  const store = await cookies();
  const v = store.get(SESSION_EMAIL_COOKIE)?.value?.trim();
  return v ? v.toLowerCase() : null;
}

export async function getSessionAppUser(): Promise<{
  email: string | null;
  user: AppUser | null;
  role: UserRole;
}> {
  const email = await getSessionEmail();
  if (!email) return { email: null, user: null, role: "admin" };
  const u = loadAppData().users.find((x) => x.email.toLowerCase() === email);
  if (!u) return { email, user: null, role: "admin" };
  if (effectiveUserStatus(u) !== "active") {
    return { email, user: null, role: "user" };
  }
  return { email, user: u, role: parseUserRole(u.role) };
}

/** Sessão com cookie de email associado a conta não ativa (pendente ou revogada). */
export async function sessionEmailLinkedInactiveUser(): Promise<boolean> {
  const email = await getSessionEmail();
  if (!email) return false;
  const u = loadAppData().users.find((x) => x.email.toLowerCase() === email);
  if (!u) return false;
  return effectiveUserStatus(u) !== "active";
}

/**
 * Papel da sessão atual. Login só com APP_PASSWORD (sem linha em users) ⇒ administrador.
 */
export async function getSessionRole(): Promise<UserRole> {
  const { role } = await getSessionAppUser();
  return role;
}

export async function sessionIsAdmin(): Promise<boolean> {
  return isAdminRole(await getSessionRole());
}
