import { NextResponse } from "next/server";
import { effectiveUserStatus, loadAppData } from "@/lib/app-data";

function normEmail(s: string): string {
  return s.trim().toLowerCase();
}

/** Indica se o email tem pedido pendente ou foi rejeitado (para redirecionar na página de login). */
export async function POST(req: Request) {
  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }
  const email = normEmail(body.email ?? "");
  if (!email || !email.includes("@")) {
    return NextResponse.json({ hint: "unknown" as const });
  }
  const u = loadAppData().users.find((x) => x.email.toLowerCase() === email);
  if (!u) {
    return NextResponse.json({ hint: "unknown" as const });
  }
  const st = effectiveUserStatus(u);
  if (st === "pending") return NextResponse.json({ hint: "pending" as const });
  if (st === "rejected") return NextResponse.json({ hint: "rejected" as const });
  return NextResponse.json({ hint: "ok" as const });
}
