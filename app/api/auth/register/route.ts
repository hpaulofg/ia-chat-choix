import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { loadAppData, saveAppData, type AppUser } from "@/lib/app-data";
import { hashPassword } from "@/lib/password";

function normEmail(s: string): string {
  return s.trim().toLowerCase();
}

export async function POST(req: Request) {
  let body: { email?: string; password?: string; fullName?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const email = normEmail(body.email ?? "");
  const password = body.password ?? "";
  const fullName = (body.fullName ?? "").replace(/\s+/g, " ").trim();
  if (!email || !password) {
    return NextResponse.json(
      { error: "Email e senha são obrigatórios." },
      { status: 400 }
    );
  }
  if (!fullName) {
    return NextResponse.json({ error: "Indique o nome completo." }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json(
      { error: "A senha deve ter pelo menos 6 caracteres." },
      { status: 400 }
    );
  }

  const data = loadAppData();
  if (data.users.some((u) => u.email.toLowerCase() === email)) {
    return NextResponse.json(
      { error: "Este email já está registado ou tem pedido em análise." },
      { status: 409 }
    );
  }

  const id = randomBytes(12).toString("hex");
  const row: AppUser = {
    id,
    email,
    passwordHash: hashPassword(password),
    status: "pending",
    fullName,
    requestedAt: new Date().toISOString(),
    role: "user",
    allowedProviders: null,
    userModelAllowlist: null,
  };
  data.users.push(row);
  saveAppData(data);

  return NextResponse.json({ ok: true });
}
