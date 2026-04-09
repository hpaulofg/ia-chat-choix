import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isAuthenticated } from "@/lib/auth-cookie";
import { SESSION_EMAIL_COOKIE } from "@/lib/session-email";
import { getSupabaseAdmin } from "@/lib/supabase";

async function getUserEmail(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_EMAIL_COOKIE)?.value?.trim().toLowerCase() ?? null;
}

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const email = await getUserEmail();
  if (!email) return NextResponse.json({ conversations: [] });

  const { data, error } = await getSupabaseAdmin()
    .from("conversations")
    .select("id, data, updated_at")
    .eq("user_email", email)
    .order("updated_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const conversations = (data ?? []).map((row) => row.data);
  return NextResponse.json({ conversations });
}

export async function POST(req: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const email = await getUserEmail();
  if (!email) return NextResponse.json({ error: "No session" }, { status: 401 });

  const body = await req.json();
  const conversations: Array<{ id: string }> = body.conversations ?? [];

  if (conversations.length === 0) {
    await getSupabaseAdmin().from("conversations").delete().eq("user_email", email);
    return NextResponse.json({ ok: true });
  }

  const rows = conversations.map((c) => ({
    id: c.id,
    user_email: email,
    data: c,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await getSupabaseAdmin()
    .from("conversations")
    .upsert(rows, { onConflict: "id,user_email" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const email = await getUserEmail();
  if (!email) return NextResponse.json({ error: "No session" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (id) {
    await getSupabaseAdmin().from("conversations").delete().eq("id", id).eq("user_email", email);
  } else {
    await getSupabaseAdmin().from("conversations").delete().eq("user_email", email);
  }

  return NextResponse.json({ ok: true });
}
