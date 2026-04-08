import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth-cookie";
import { resolveApiKey } from "@/lib/resolve-api-keys";
import { sessionIsAdmin } from "@/lib/session-user";

type GeminiListModel = {
  name?: string;
  supportedGenerationMethods?: string[];
};

type GeminiListResponse = {
  models?: GeminiListModel[];
  nextPageToken?: string;
  error?: { message?: string };
};

function supportsChat(m: GeminiListModel): boolean {
  const methods = m.supportedGenerationMethods ?? [];
  return (
    methods.includes("generateContent") ||
    methods.includes("streamGenerateContent")
  );
}

export async function POST(req: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  if (!(await sessionIsAdmin())) {
    return NextResponse.json({ error: "Apenas administradores." }, { status: 403 });
  }

  let body: { apiKey?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const fromBody =
    typeof body.apiKey === "string" ? body.apiKey.trim() : "";
  const apiKey = fromBody.length > 0 ? fromBody : resolveApiKey("google");

  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Sem chave Gemini: guarde a chave neste navegador ou configure em app-data / servidor.",
      },
      { status: 400 }
    );
  }

  const allNames: string[] = [];
  let pageToken: string | undefined;

  for (let page = 0; page < 20; page++) {
    const url = new URL("https://generativelanguage.googleapis.com/v1beta/models");
    url.searchParams.set("key", apiKey);
    url.searchParams.set("pageSize", "100");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetch(url.toString(), { method: "GET" });
    const text = await res.text();
    let data: GeminiListResponse;
    try {
      data = JSON.parse(text) as GeminiListResponse;
    } catch {
      return NextResponse.json(
        { error: text || `HTTP ${res.status}` },
        { status: res.ok ? 500 : res.status }
      );
    }

    if (!res.ok) {
      let msg = data.error?.message?.trim();
      if (!msg && text.length > 0 && text.length < 800) msg = text.trim();
      if (!msg) msg = `Erro HTTP ${res.status}`;
      return NextResponse.json({ error: msg }, { status: res.status });
    }

    const models = data.models ?? [];
    for (const m of models) {
      if (!supportsChat(m)) continue;
      const name = m.name;
      if (typeof name === "string" && name.length) allNames.push(name);
    }

    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }

  allNames.sort();

  const idsForGenerate = allNames.map((n) =>
    n.startsWith("models/") ? n.slice("models/".length) : n
  );

  return NextResponse.json({
    names: allNames,
    ids: idsForGenerate,
  });
}
