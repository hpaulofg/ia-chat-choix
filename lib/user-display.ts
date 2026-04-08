function capitalize(w: string): string {
  if (!w) return "";
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
}

/** Extrai primeiro e segundo nome a partir da parte local do email (espaço, ponto, _ ou -). */
export function parseUserFromEmail(email: string | null): {
  displayName: string;
  initials: string;
  firstName: string;
} {
  if (!email) {
    return { displayName: "Utilizador", initials: "?", firstName: "" };
  }
  const local = email.split("@")[0]?.trim() ?? "";
  if (!local) {
    return { displayName: email, initials: "?", firstName: "" };
  }

  const rawParts = local.split(/[\s._-]+/).filter(Boolean);
  const parts = rawParts.map((p) => p.replace(/[^a-zA-ZÀ-ÿ0-9]/g, "")).filter(Boolean);

  if (parts.length >= 2) {
    const first = capitalize(parts[0]);
    const second = capitalize(parts[1]);
    return {
      displayName: `${first} ${second}`,
      initials: (parts[0][0] + parts[1][0]).toUpperCase(),
      firstName: first,
    };
  }

  if (parts.length === 1) {
    const w = parts[0];
    const display = capitalize(w);
    const initials =
      w.length >= 2 ? w.slice(0, 2).toUpperCase() : `${(w[0] ?? "?").toUpperCase()}${(w[0] ?? "?").toUpperCase()}`;
    return {
      displayName: display,
      initials,
      firstName: display,
    };
  }

  return { displayName: local, initials: local.slice(0, 2).toUpperCase(), firstName: local };
}
