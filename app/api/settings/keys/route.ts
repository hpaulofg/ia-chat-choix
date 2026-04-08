import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth-cookie";
import { loadAppData, saveAppData, maskKey, type AppApiKeys } from "@/lib/app-data";
import { sanitizeModelAllowlist } from "@/lib/model-allowlist";
import { sessionIsAdmin } from "@/lib/session-user";

type KeysBody = {
  anthropic?: string;
  openai?: string;
  google?: string;
  groq?: string;
  modelAllowlist?: unknown;
};

function trimOrUndef(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t.length ? t : undefined;
}

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  if (!(await sessionIsAdmin())) {
    return NextResponse.json({ error: "Apenas administradores." }, { status: 403 });
  }

  const data = loadAppData();
  const keys = data.apiKeys;
  const envAnthropic = process.env.ANTHROPIC_API_KEY?.trim();
  const envOpenai = process.env.OPENAI_API_KEY?.trim();
  const envGoogle =
    process.env.GOOGLE_API_KEY?.trim() || process.env.GEMINI_API_KEY?.trim();
  const envGroq = process.env.GROQ_API_KEY?.trim();

  return NextResponse.json({
    modelAllowlist: data.modelAllowlist ?? {},
    anthropic: {
      configured: Boolean(keys.anthropic || envAnthropic),
      masked: maskKey(envAnthropic) ?? maskKey(keys.anthropic),
      source: envAnthropic ? "env" : keys.anthropic ? "app" : null,
    },
    openai: {
      configured: Boolean(keys.openai || envOpenai),
      masked: maskKey(envOpenai) ?? maskKey(keys.openai),
      source: envOpenai ? "env" : keys.openai ? "app" : null,
    },
    google: {
      configured: Boolean(keys.google || envGoogle),
      masked: maskKey(envGoogle) ?? maskKey(keys.google),
      source: envGoogle ? "env" : keys.google ? "app" : null,
    },
    groq: {
      configured: Boolean(keys.groq || envGroq),
      masked: maskKey(envGroq) ?? maskKey(keys.groq),
      source: envGroq ? "env" : keys.groq ? "app" : null,
    },
  });
}

export async function PUT(req: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  if (!(await sessionIsAdmin())) {
    return NextResponse.json({ error: "Apenas administradores." }, { status: 403 });
  }

  let body: KeysBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const data = loadAppData();
  const next: AppApiKeys = { ...data.apiKeys };

  const fields: (keyof AppApiKeys)[] = ["anthropic", "openai", "google", "groq"];
  for (const k of fields) {
    if (!(k in body)) continue;
    const v = trimOrUndef(body[k]);
    if (v === undefined) {
      delete next[k];
    } else {
      next[k] = v;
    }
  }

  data.apiKeys = next;
  if ("modelAllowlist" in body) {
    data.modelAllowlist = sanitizeModelAllowlist(body.modelAllowlist);
  }
  saveAppData(data);

  return NextResponse.json({ ok: true });
}
