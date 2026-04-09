import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth-cookie";
import { sessionIsAdmin } from "@/lib/session-user";
import { getSupabaseAdmin } from "@/lib/supabase";

type AdminUsageRow = {
  userEmail: string;
  totalTokens: number;
  totalCostUsd: number;
  messageCount: number;
  conversationCount: number;
};

function statsFromConversationData(data: unknown): {
  tokens: number;
  cost: number;
  messagesWithUsage: number;
} {
  let tokens = 0;
  let cost = 0;
  let messagesWithUsage = 0;
  if (!data || typeof data !== "object") return { tokens, cost, messagesWithUsage };
  const messages = (data as { messages?: unknown }).messages;
  if (!Array.isArray(messages)) return { tokens, cost, messagesWithUsage };
  for (const m of messages) {
    if (!m || typeof m !== "object") continue;
    const usage = (m as { usage?: { input?: number; output?: number; costUsd?: number } }).usage;
    if (!usage) continue;
    const inp = Number(usage.input) || 0;
    const out = Number(usage.output) || 0;
    tokens += inp + out;
    cost += Number(usage.costUsd) || 0;
    messagesWithUsage += 1;
  }
  return { tokens, cost, messagesWithUsage };
}

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  if (!(await sessionIsAdmin())) {
    return NextResponse.json({ error: "Apenas administradores." }, { status: 403 });
  }

  const { data, error } = await getSupabaseAdmin()
    .from("conversations")
    .select("user_email, data");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const byEmail = new Map<
    string,
    {
      totalTokens: number;
      totalCostUsd: number;
      messageCount: number;
      conversationCount: number;
    }
  >();

  for (const row of data ?? []) {
    const email = String((row as { user_email?: string }).user_email ?? "")
      .trim()
      .toLowerCase();
    if (!email) continue;
    const s = statsFromConversationData((row as { data: unknown }).data);
    const cur = byEmail.get(email) ?? {
      totalTokens: 0,
      totalCostUsd: 0,
      messageCount: 0,
      conversationCount: 0,
    };
    cur.conversationCount += 1;
    cur.totalTokens += s.tokens;
    cur.totalCostUsd += s.cost;
    cur.messageCount += s.messagesWithUsage;
    byEmail.set(email, cur);
  }

  const rows: AdminUsageRow[] = [...byEmail.entries()]
    .map(([userEmail, v]) => ({ userEmail, ...v }))
    .sort((a, b) => b.totalTokens - a.totalTokens);

  const grandTotalTokens = rows.reduce((a, r) => a + r.totalTokens, 0);
  const grandTotalCostUsd = rows.reduce((a, r) => a + r.totalCostUsd, 0);

  return NextResponse.json({
    rows,
    grandTotalTokens,
    grandTotalCostUsd,
  });
}
