import { loadAppData } from "@/lib/app-data";
import type { ProviderId } from "@/lib/provider-config";

/** Ordem: variáveis de ambiente (produção) → app-data.json (UI / dev). */
export function resolveApiKey(provider: ProviderId): string | null {
  const file = loadAppData().apiKeys;
  switch (provider) {
    case "anthropic":
      return (
        process.env.ANTHROPIC_API_KEY?.trim() ||
        file.anthropic?.trim() ||
        null
      );
    case "openai":
      return (
        process.env.OPENAI_API_KEY?.trim() ||
        file.openai?.trim() ||
        null
      );
    case "google":
      return (
        process.env.GOOGLE_API_KEY?.trim() ||
        process.env.GEMINI_API_KEY?.trim() ||
        file.google?.trim() ||
        null
      );
    case "groq":
      return (
        process.env.GROQ_API_KEY?.trim() ||
        file.groq?.trim() ||
        null
      );
    default:
      return null;
  }
}
