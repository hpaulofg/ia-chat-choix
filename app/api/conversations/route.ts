import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isAuthenticated } from "@/lib/auth-cookie";
import { SESSION_EMAIL_COOKIE } from "@/lib/session-email";
import { getSupabaseAdmin } from "@/lib/supabase";

async function getUserEmail(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_EMAIL_COOKIE)?.value?.trim().toLowerCase() ?? null;
}

/** Dev: devMode === true ou legado kind === "dev" */
function isDevConversationData(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const o = data as { devMode?: unknown; kind?: unknown };
  if (o.devMode === true) return true;
  if (o.kind === "dev") return true;
  return false;
}

function wantsDevList(req: Request): boolean {
  const { searchParams } = new URL(req.url);
  return (
    searchParams.get("type") === "dev" || searchParams.get("scope") === "dev"
  );
}

export async function GET(req: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const email = await getUserEmail();
  if (!email) return NextResponse.json({ conversations: [] });

  const devList = wantsDevList(req);

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ conversations: [] });
  }

  const { data, error } = await supabase
    .from("conversations")
    .select("id, data, updated_at")
    .eq("user_email", email)
    .order("updated_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const list = (data ?? []).map((row) => row.data);
  const conversations = devList
    ? list.filter((c) => isDevConversationData(c))
    : list.filter((c) => !isDevConversationData(c));

  return NextResponse.json({ conversations });
}

export async function POST(req: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const email = await getUserEmail();
  if (!email) return NextResponse.json({ error: "No session" }, { status: 401 });

  const body = await req.json();
  const type =
    body.type === "dev" || body.scope === "dev" ? "dev" : "chat";
  const conversations: Array<Record<string, unknown> & { id: string }> =
    body.conversations ?? [];

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase não configurado (SUPABASE_URL / SERVICE_ROLE_KEY)." },
      { status: 503 },
    );
  }

  const { data: existingRows, error: selErr } = await supabase
    .from("conversations")
    .select("id, data")
    .eq("user_email", email);

  if (selErr) return NextResponse.json({ error: selErr.message }, { status: 500 });

  const idsToDelete = (existingRows ?? [])
    .filter((row) => {
      const dev = isDevConversationData(row.data);
      if (type === "dev") return dev;
      return !dev;
    })
    .map((r) => r.id);

  if (idsToDelete.length > 0) {
    const { error: delErr } = await supabase
      .from("conversations")
      .delete()
      .eq("user_email", email)
      .in("id", idsToDelete);
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  if (conversations.length === 0) {
    return NextResponse.json({ ok: true });
  }

  const rows = conversations.map((c) => {
    const { kind, devMode, ...rest } = c;
    void kind;
    void devMode;
    const data =
      type === "dev"
        ? { ...rest, devMode: true, kind: "dev" }
        : { ...rest };
    return {
      id: c.id,
      user_email: email,
      data,
      updated_at: new Date().toISOString(),
    };
  });

  const { error } = await supabase
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

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase não configurado (SUPABASE_URL / SERVICE_ROLE_KEY)." },
      { status: 503 },
    );
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (id) {
    const { error } = await supabase
      .from("conversations")
      .delete()
      .eq("id", id)
      .eq("user_email", email);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await supabase.from("conversations").delete().eq("user_email", email);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
