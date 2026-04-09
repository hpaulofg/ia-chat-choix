import { NextRequest, NextResponse } from "next/server";
import { resolveApiKey } from "@/lib/resolve-api-keys";

export async function POST(req: NextRequest) {
  try {
    const { text, voice = "alloy" } = await req.json();

    if (!text) {
      return NextResponse.json({ error: "Texto obrigatório" }, { status: 400 });
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

    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "tts-1-hd",
        input: text,
        voice,
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

    const audioBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(audioBuffer).toString("base64");

    return NextResponse.json({ audio: base64, format: "mp3" });
  } catch {
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
