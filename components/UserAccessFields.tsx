"use client";

import { USER_ROLE_LABELS, type UserRole } from "@/lib/user-role";
import type { ProviderId } from "@/lib/provider-config";

export const PROVIDER_ORDER: ProviderId[] = ["anthropic", "openai", "google", "groq"];

/** Rótulos curtos para lista em cascata (controlo por provedor). */
const PROVIDER_CASCADE_LABELS: Record<ProviderId, string> = {
  anthropic: "Claude",
  openai: "OpenAI (GPT)",
  google: "Gemini",
  groq: "Groq",
};

export function setFromAllowedProviders(allowed: ProviderId[] | null): Set<ProviderId> {
  if (allowed === null) {
    return new Set(PROVIDER_ORDER);
  }
  return new Set(allowed);
}

/** Todos marcados → `null` (equivale a todos os provedores no servidor). */
export function allowedProvidersFromSet(selected: Set<ProviderId>): ProviderId[] | null {
  if (PROVIDER_ORDER.every((id) => selected.has(id))) {
    return null;
  }
  return PROVIDER_ORDER.filter((id) => selected.has(id));
}

type CascadeProps = {
  selectedProviders: Set<ProviderId>;
  onToggle: (id: ProviderId) => void;
  disabled?: boolean;
  /** rótulo visível acima da lista */
  label?: string;
  className?: string;
};

export function ProviderCascadeCheckboxes({
  selectedProviders,
  onToggle,
  disabled,
  label = "Provedores",
  className = "",
}: CascadeProps) {
  return (
    <div className={className}>
      <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--app-text-muted)]">
        {label}
      </p>
      <ul
        role="group"
        aria-label={label}
        className="mt-1.5 overflow-hidden rounded-xl border border-[var(--app-border-strong)] bg-[var(--app-surface-2)] dark:bg-[#262626]"
      >
        {PROVIDER_ORDER.map((pid, i) => (
          <li
            key={pid}
            className={
              i > 0 ? "border-t border-[var(--app-border)] dark:border-white/[0.08]" : ""
            }
          >
            <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm font-medium text-[var(--app-text)] hover:bg-black/[0.03] dark:hover:bg-white/[0.04]">
              <input
                type="checkbox"
                checked={selectedProviders.has(pid)}
                disabled={disabled}
                onChange={() => onToggle(pid)}
                className="h-4 w-4 shrink-0 rounded accent-[#c45c2a] disabled:opacity-50"
              />
              <span>{PROVIDER_CASCADE_LABELS[pid]}</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}

type Props = {
  role: UserRole;
  onRoleChange: (r: UserRole) => void;
  selectedProviders: Set<ProviderId>;
  onToggleProvider: (id: ProviderId) => void;
  showRole?: boolean;
  /** quando false, nível e provedores ficam lado a lado em ecrãs largos */
  compactToolbar?: boolean;
  providerCascadeDisabled?: boolean;
};

export function UserAccessFields({
  role,
  onRoleChange,
  selectedProviders,
  onToggleProvider,
  showRole = true,
  compactToolbar = false,
  providerCascadeDisabled = false,
}: Props) {
  const field =
    "w-full rounded-xl border border-[var(--app-border-strong)] bg-[#fafafa] px-3 py-2.5 text-sm text-[var(--app-text)] outline-none dark:bg-[#1f1f1f]";

  const toolbar =
    compactToolbar && showRole
      ? "flex flex-col gap-4 border-t border-[var(--app-border)] pt-4 sm:flex-row sm:items-start sm:gap-6 dark:border-white/[0.08]"
      : "space-y-4 border-t border-[var(--app-border)] pt-4 dark:border-white/[0.08]";

  return (
    <div className={toolbar}>
      {showRole ? (
        <label className={`block shrink-0 ${compactToolbar ? "sm:w-[200px]" : ""}`}>
          <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--app-text-muted)]">
            Nível
          </span>
          <select
            value={role}
            onChange={(e) => onRoleChange(e.target.value as UserRole)}
            className={`${field} mt-1.5`}
          >
            {(Object.keys(USER_ROLE_LABELS) as UserRole[]).map((r) => (
              <option key={r} value={r}>
                {USER_ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {role === "user" ? (
        <ProviderCascadeCheckboxes
          className={compactToolbar ? "min-w-0 flex-1 sm:max-w-xs" : ""}
          selectedProviders={selectedProviders}
          onToggle={onToggleProvider}
          disabled={providerCascadeDisabled}
        />
      ) : null}
    </div>
  );
}

export function buildAccessPayload(
  role: UserRole,
  selectedProviders: Set<ProviderId>
): {
  allowedProviders: ProviderId[] | null;
  userModelAllowlist: null;
} {
  if (role === "admin") {
    return { allowedProviders: null, userModelAllowlist: null };
  }
  return {
    allowedProviders: allowedProvidersFromSet(selectedProviders),
    userModelAllowlist: null,
  };
}
