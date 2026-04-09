import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { isAuthenticated } from "@/lib/auth-cookie";
import type { AppUser } from "@/lib/app-data";
import { effectiveUserStatus, loadAppData, saveAppData } from "@/lib/app-data";
import type { ModelAllowlist } from "@/lib/model-allowlist";
import { sanitizeModelAllowlist } from "@/lib/model-allowlist";
import type { ProviderId } from "@/lib/provider-config";
import { hashPassword } from "@/lib/password";
import { sessionIsAdmin } from "@/lib/session-user";
import { parseUserRole, type UserRole } from "@/lib/user-role";

function normEmail(s: string): string {
  return s.trim().toLowerCase();
}

function serializeActiveUser(u: AppUser) {
  return {
    id: u.id,
    email: u.email,
    fullName: u.fullName ?? "",
    role: parseUserRole(u.role),
    allowedProviders: u.allowedProviders ?? null,
    userModelAllowlist: u.userModelAllowlist ?? null,
    approvedAt: u.approvedAt ?? null,
    status: effectiveUserStatus(u),
  };
}

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  if (!(await sessionIsAdmin())) {
    return NextResponse.json({ error: "Apenas administradores." }, { status: 403 });
  }
  const data = loadAppData();
  const pending = data.users
    .filter((u) => effectiveUserStatus(u) === "pending")
    .map((p) => ({
      id: p.id,
      email: p.email,
      fullName: p.fullName ?? "",
      requestedAt: p.requestedAt ?? "",
    }));
  const active = data.users
    .filter((u) => effectiveUserStatus(u) === "active")
    .map(serializeActiveUser);
  return NextResponse.json({ pending, users: active });
}

type CreateBody = {
  email?: string;
  password?: string;
  fullName?: string;
  role?: UserRole;
  allowedProviders?: ProviderId[] | null;
  userModelAllowlist?: ModelAllowlist | null;
};

export async function POST(req: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  if (!(await sessionIsAdmin())) {
    return NextResponse.json({ error: "Apenas administradores." }, { status: 403 });
  }

  let body: CreateBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const email = normEmail(body.email ?? "");
  const password = body.password ?? "";
  const role = parseUserRole(body.role);
  if (!email || !password) {
    return NextResponse.json(
      { error: "Email e senha são obrigatórios." },
      { status: 400 }
    );
  }
  if (password.length < 6) {
    return NextResponse.json(
      { error: "A senha deve ter pelo menos 6 caracteres." },
      { status: 400 }
    );
  }

  const data = loadAppData();
  if (data.users.some((u) => u.email.toLowerCase() === email)) {
    return NextResponse.json({ error: "Este email já está registado." }, { status: 409 });
  }

  const order: ProviderId[] = ["anthropic", "openai", "google", "groq"];
  const allowedProviders: ProviderId[] | null =
    body.allowedProviders === null || body.allowedProviders === undefined
      ? null
      : body.allowedProviders.filter((id): id is ProviderId => order.includes(id as ProviderId));

  const userModelAllowlist =
    body.userModelAllowlist === null || body.userModelAllowlist === undefined
      ? null
      : sanitizeModelAllowlist(body.userModelAllowlist);

  const fullNameTrim =
    typeof body.fullName === "string" ? body.fullName.trim() : "";

  const id = randomBytes(12).toString("hex");
  const now = new Date().toISOString();
  const row: AppUser = {
    id,
    email,
    passwordHash: hashPassword(password),
    status: "active",
    approvedAt: now,
    fullName: fullNameTrim || email.split("@")[0],
    role,
    allowedProviders: role === "admin" ? null : allowedProviders,
    userModelAllowlist: role === "admin" ? null : userModelAllowlist,
  };
  data.users.push(row);
  saveAppData(data);

  return NextResponse.json({ ok: true, user: serializeActiveUser(row) });
}

type PatchBody = {
  id?: string;
  role?: UserRole;
  allowedProviders?: ProviderId[] | null;
  userModelAllowlist?: ModelAllowlist | null;
  status?: "rejected";
};

export async function PATCH(req: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  if (!(await sessionIsAdmin())) {
    return NextResponse.json({ error: "Apenas administradores." }, { status: 403 });
  }

  let body: PatchBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const id = body.id?.trim();
  if (!id) {
    return NextResponse.json({ error: "Campo id em falta." }, { status: 400 });
  }

  const data = loadAppData();
  const idx = data.users.findIndex((u) => u.id === id);
  if (idx < 0) {
    return NextResponse.json({ error: "Utilizador não encontrado." }, { status: 404 });
  }

  const cur = data.users[idx];
  const next: AppUser = { ...cur };

  if (body.status === "rejected") {
    if (effectiveUserStatus(cur) !== "active") {
      return NextResponse.json(
        { error: "Só é possível revogar contas ativas." },
        { status: 400 }
      );
    }
    next.status = "rejected";
    data.users[idx] = next;
    saveAppData(data);
    return NextResponse.json({ ok: true, user: serializeActiveUser(next) });
  }

  if (body.role !== undefined) {
    const role = parseUserRole(body.role);
    next.role = role;
    if (role === "admin") {
      next.allowedProviders = null;
      next.userModelAllowlist = null;
    }
  }

  const roleEff = parseUserRole(next.role);
  if (roleEff === "user") {
    if (body.allowedProviders !== undefined) {
      const order: ProviderId[] = ["anthropic", "openai", "google", "groq"];
      next.allowedProviders =
        body.allowedProviders === null
          ? null
          : body.allowedProviders.filter((pid): pid is ProviderId =>
              order.includes(pid as ProviderId)
            );
    }
    if (body.userModelAllowlist !== undefined) {
      next.userModelAllowlist =
        body.userModelAllowlist === null
          ? null
          : sanitizeModelAllowlist(body.userModelAllowlist);
    }
  }

  data.users[idx] = next;
  saveAppData(data);

  return NextResponse.json({ ok: true, user: serializeActiveUser(next) });
}

export async function DELETE(req: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  if (!(await sessionIsAdmin())) {
    return NextResponse.json({ error: "Apenas administradores." }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Parâmetro id em falta." }, { status: 400 });
  }

  const data = loadAppData();
  const next = data.users.filter((u) => u.id !== id);
  if (next.length === data.users.length) {
    return NextResponse.json({ error: "Utilizador não encontrado." }, { status: 404 });
  }

  data.users = next;
  saveAppData(data);
  return NextResponse.json({ ok: true });
}
