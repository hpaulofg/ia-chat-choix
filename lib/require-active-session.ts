import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_NAME, isAuthenticated } from "@/lib/auth-cookie";
import { effectiveUserStatus, loadAppData } from "@/lib/app-data";
import { SESSION_EMAIL_COOKIE } from "@/lib/session-email";

/** Garante sessão válida e utilizador `active`; caso contrário limpa cookies e redireciona. */
export async function requireAuthAndActiveUser() {
  if (!(await isAuthenticated())) {
    redirect("/login");
  }
  const store = await cookies();
  const email = store.get(SESSION_EMAIL_COOKIE)?.value?.trim().toLowerCase();
  if (!email) {
    return;
  }
  const u = loadAppData().users.find((x) => x.email.toLowerCase() === email);
  if (!u) {
    return;
  }
  const st = effectiveUserStatus(u);
  if (st === "active") {
    return;
  }
  store.delete(COOKIE_NAME);
  store.delete(SESSION_EMAIL_COOKIE);
  if (st === "pending") {
    redirect("/signup/waiting");
  }
  redirect("/login?denied=1");
}
