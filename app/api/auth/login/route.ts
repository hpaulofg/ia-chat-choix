import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { authCookieValue, COOKIE_NAME } from "@/lib/auth-cookie";
import { effectiveUserStatus, loadAppData } from "@/lib/app-data";
import { verifyPassword } from "@/lib/password";
import { SESSION_EMAIL_COOKIE } from "@/lib/session-email";

const MAX_AGE = 60 * 60 * 24 * 7;

function normalizeEmail(s: string | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

export async function POST(req: Request) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Servidor não configurado (SESSION_SECRET)." },
      { status: 500 }
    );
  }

  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const email = normalizeEmail(body.email);
  const password = body.password ?? "";
  if (!email || !password) {
    return NextResponse.json({ error: "Email e senha são obrigatórios." }, { status: 400 });
  }

  const data = loadAppData();
  const fileUser = data.users.find((u) => u.email.toLowerCase() === email);

  let ok = false;
  if (fileUser) {
    ok = verifyPassword(password, fileUser.passwordHash);
    if (ok) {
      const st = effectiveUserStatus(fileUser);
      if (st === "pending") {
        return NextResponse.json(
          {
            code: "pending",
            error:
              "O seu pedido de acesso ainda aguarda aprovação por um administrador.",
          },
          { status: 403 }
        );
      }
      if (st === "rejected") {
        return NextResponse.json(
          {
            code: "rejected",
            error:
              "Seu acesso foi negado. Entre em contato com o administrador.",
          },
          { status: 403 }
        );
      }
    }
  }

  if (!ok) {
    const appPassword = process.env.APP_PASSWORD;
    if (appPassword) {
      const emailOk =
        !process.env.APP_EMAIL ||
        email === normalizeEmail(process.env.APP_EMAIL);
      if (emailOk && password === appPassword) ok = true;
    }
  }

  if (!ok) {
    if (data.users.length === 0 && !process.env.APP_PASSWORD) {
      return NextResponse.json(
        {
          error:
            "Sem credenciais de acesso: defina APP_PASSWORD no .env para o primeiro login. Depois pode criar mais utilizadores em Definições.",
        },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: "Email ou senha incorretos." }, { status: 401 });
  }

  const token = authCookieValue(secret);
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    maxAge: MAX_AGE,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  store.set(SESSION_EMAIL_COOKIE, email, {
    httpOnly: true,
    maxAge: MAX_AGE,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return NextResponse.json({ ok: true });
}
