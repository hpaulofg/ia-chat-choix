import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { loadAppData, saveAppData, effectiveUserStatus } from "@/lib/app-data";
import type { ModelAllowlist } from "@/lib/model-allowlist";
import { sanitizeModelAllowlist } from "@/lib/model-allowlist";
import type { ProviderId } from "@/lib/provider-config";
import { isAuthenticated } from "@/lib/auth-cookie";
import { sessionIsAdmin } from "@/lib/session-user";
import { parseUserRole, type UserRole } from "@/lib/user-role";

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  if (!(await sessionIsAdmin())) {
    return NextResponse.json({ error: "Apenas administradores." }, { status: 403 });
  }
  const data = loadAppData();
  const list = data.users.filter((u) => effectiveUserStatus(u) === "pending");
  return NextResponse.json({
    pending: list.map((p) => ({
      id: p.id,
      email: p.email,
      fullName: p.fullName ?? "",
      requestedAt: p.requestedAt ?? "",
    })),
  });
}

type ApproveBody = {
  pendingId?: string;
  role?: UserRole;
  /** null = todos os provedores */
  allowedProviders?: ProviderId[] | null;
  /** null = usar lista global da app */
  userModelAllowlist?: ModelAllowlist | null;
};

export async function POST(req: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  if (!(await sessionIsAdmin())) {
    return NextResponse.json({ error: "Apenas administradores." }, { status: 403 });
  }

  let body: ApproveBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const pendingId = body.pendingId?.trim();
  if (!pendingId) {
    return NextResponse.json({ error: "pendingId em falta." }, { status: 400 });
  }

  const role = parseUserRole(body.role);
  const data = loadAppData();
  const idx = data.users.findIndex((u) => u.id === pendingId);
  if (idx < 0) {
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  }
  const pend = data.users[idx];
  if (effectiveUserStatus(pend) !== "pending") {
    return NextResponse.json({ error: "Este pedido já foi processado." }, { status: 409 });
  }

  let allowedProviders: ProviderId[] | null | undefined;
  if (body.allowedProviders === null) {
    allowedProviders = null;
  } else if (Array.isArray(body.allowedProviders)) {
    const order: ProviderId[] = ["anthropic", "openai", "google", "groq"];
    allowedProviders = body.allowedProviders.filter((id): id is ProviderId =>
      order.includes(id as ProviderId)
    );
  } else {
    allowedProviders = null;
  }

  let userModelAllowlist: ModelAllowlist | null | undefined;
  if (body.userModelAllowlist === null || body.userModelAllowlist === undefined) {
    userModelAllowlist = null;
  } else {
    userModelAllowlist = sanitizeModelAllowlist(body.userModelAllowlist);
  }

  const dup = data.users.some(
    (u, i) =>
      i !== idx &&
      u.email.toLowerCase() === pend.email.toLowerCase() &&
      effectiveUserStatus(u) === "active"
  );
  if (dup) {
    return NextResponse.json({ error: "Este email já está registado." }, { status: 409 });
  }

  const approvedAt = new Date().toISOString();
  const newUser = {
    ...pend,
    id: randomBytes(12).toString("hex"),
    status: "active" as const,
    approvedAt,
    role,
    allowedProviders: role === "admin" ? null : allowedProviders,
    userModelAllowlist: role === "admin" ? null : userModelAllowlist,
  };

  data.users[idx] = newUser;
  saveAppData(data);

  return NextResponse.json({
    ok: true,
    user: {
      id: newUser.id,
      email: newUser.email,
      fullName: newUser.fullName ?? "",
      role,
      allowedProviders: newUser.allowedProviders,
      userModelAllowlist: newUser.userModelAllowlist,
      approvedAt: newUser.approvedAt,
      status: "active",
    },
  });
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
  const idx = data.users.findIndex((u) => u.id === id);
  if (idx < 0) {
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  }
  if (effectiveUserStatus(data.users[idx]) !== "pending") {
    return NextResponse.json({ error: "Não é um pedido pendente." }, { status: 400 });
  }
  data.users.splice(idx, 1);
  saveAppData(data);
  return NextResponse.json({ ok: true });
}
