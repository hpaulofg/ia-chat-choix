export type UserRole = "admin" | "user";

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  admin: "Administrador",
  user: "Usuário",
};

export const USER_ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  admin:
    "Acesso total: gestão de usuários, chaves API, lista de modelos e demais definições.",
  user:
    "Sem painel admin. Provedores escolhidos pelo administrador; modelos seguem a lista global em Definições → Chaves e modelos.",
};

export function parseUserRole(v: unknown): UserRole {
  if (v === "admin" || v === "user") return v;
  if (v === "all_models") return "user";
  return "admin";
}

export function isAdminRole(role: UserRole): boolean {
  return role === "admin";
}

/** Administrador: catálogo completo. Usuário: respeita lista global ou lista própria. */
export function roleUsesFullModelCatalog(role: UserRole): boolean {
  return role === "admin";
}
