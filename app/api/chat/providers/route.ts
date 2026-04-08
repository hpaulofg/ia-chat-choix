import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth-cookie";
import { loadAppData } from "@/lib/app-data";
import { effectiveModelsForProvider } from "@/lib/model-allowlist";
import {
  DEFAULT_ANTHROPIC_MODEL_ID,
  type ProviderId,
  PROVIDER_LABELS,
} from "@/lib/provider-config";
import { resolveApiKey } from "@/lib/resolve-api-keys";
import { getSessionAppUser, sessionEmailLinkedInactiveUser } from "@/lib/session-user";
import {
  effectiveModelAllowlistForChat,
  providerIdsForUser,
} from "@/lib/user-access";

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  if (await sessionEmailLinkedInactiveUser()) {
    return NextResponse.json(
      { error: "Conta inativa ou pendente." },
      { status: 403 }
    );
  }

  const { role, user } = await getSessionAppUser();
  const data = loadAppData();
  const allow = effectiveModelAllowlistForChat(data, role, user);
  const providerFilter = providerIdsForUser(role, user);
  const order: ProviderId[] = ["anthropic", "openai", "google", "groq"];
  const base = order.map((id) => ({
    id,
    label: PROVIDER_LABELS[id],
    models: effectiveModelsForProvider(id, allow),
    configured: Boolean(resolveApiKey(id)),
  }));
  const providers =
    providerFilter === null
      ? base
      : base.filter((p) => providerFilter.includes(p.id));

  const first = providers.find((p) => p.configured && p.models.length > 0);
  const defaultProvider = (first?.id ?? "anthropic") as ProviderId;
  const models = effectiveModelsForProvider(defaultProvider, allow);
  const defaultModel =
    models[0]?.id ?? process.env.ANTHROPIC_MODEL ?? DEFAULT_ANTHROPIC_MODEL_ID;

  return NextResponse.json({ providers, defaultProvider, defaultModel });
}
