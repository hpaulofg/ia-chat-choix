import { NextRequest, NextResponse } from "next/server";
import { resolveApiKey } from "@/lib/resolve-api-keys";

export async function POST(req: NextRequest) {
  try {
    const { prompt, size = "1024x1024" } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: "Prompt obrigatório" }, { status: 400 });
    }

    const apiKey = resolveApiKey("openai");
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "Chave OpenAI não configurada. Adicione em Definições → Chaves e modelos.",
        },
        { status: 500 },
      );
    }

    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt,
        n: 1,
        size,
      }),
    });

    if (!response.ok) {
      const error = (await response.json().catch(() => ({}))) as {
        error?: { message?: string };
      };
      return NextResponse.json(
        { error: error.error?.message || "Erro na API OpenAI" },
        { status: response.status },
      );
    }

    const data = (await response.json()) as { data: Array<{ url: string }> };
    return NextResponse.json({ url: data.data[0].url, provider: "openai" });
  } catch {
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
