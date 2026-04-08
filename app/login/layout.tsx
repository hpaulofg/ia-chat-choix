import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth-cookie";
import { effectiveUserStatus, loadAppData } from "@/lib/app-data";
import { SESSION_EMAIL_COOKIE } from "@/lib/session-email";

export default async function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (await isAuthenticated()) {
    const store = await cookies();
    const email = store.get(SESSION_EMAIL_COOKIE)?.value?.trim().toLowerCase();
    const u = email
      ? loadAppData().users.find((x) => x.email.toLowerCase() === email)
      : null;
    if (!u || effectiveUserStatus(u) === "active") {
      redirect("/chat");
    }
  }
  return children;
}
