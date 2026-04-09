import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isAuthenticated } from "@/lib/auth-cookie";
import { SESSION_EMAIL_COOKIE } from "@/lib/session-email";
import { effectiveUserStatus, loadAppData, saveAppData } from "@/lib/app-data";
import { hashPassword, verifyPassword } from "@/lib/password";

export async function POST(req: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const store = await cookies();
  const email = store.get(SESSION_EMAIL_COOKIE)?.value?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "Sessão inválida." }, { status: 400 });
  }

  let body: { currentPassword?: string; newPassword?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const currentPassword = body.currentPassword ?? "";
  const newPassword = body.newPassword ?? "";
  if (!currentPassword || !newPassword) {
    return NextResponse.json(
      { error: "Senha atual e nova senha são obrigatórias." },
      { status: 400 }
    );
  }
  if (newPassword.length < 6) {
    return NextResponse.json(
      { error: "A nova senha deve ter pelo menos 6 caracteres." },
      { status: 400 }
    );
  }

  const data = loadAppData();
  const idx = data.users.findIndex((u) => u.email.toLowerCase() === email);
  if (idx < 0) {
    return NextResponse.json(
      { error: "Esta sessão não está associada a um utilizador no ficheiro de dados." },
      { status: 404 }
    );
  }

  const user = data.users[idx];
  if (effectiveUserStatus(user) !== "active") {
    return NextResponse.json({ error: "Conta inativa." }, { status: 403 });
  }

  if (!verifyPassword(currentPassword, user.passwordHash)) {
    return NextResponse.json({ error: "Senha atual incorreta." }, { status: 401 });
  }

  data.users[idx] = { ...user, passwordHash: hashPassword(newPassword) };
  saveAppData(data);

  return NextResponse.json({ ok: true });
}
