"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ProviderCascadeCheckboxes,
  UserAccessFields,
  allowedProvidersFromSet,
  buildAccessPayload,
  setFromAllowedProviders,
} from "@/components/UserAccessFields";
import type { ProviderId } from "@/lib/provider-config";
import {
  USER_ROLE_DESCRIPTIONS,
  USER_ROLE_LABELS,
  type UserRole,
} from "@/lib/user-role";

type Row = {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  allowedProviders: ProviderId[] | null;
  approvedAt: string | null;
};

type PendingRow = { id: string; email: string; fullName: string; requestedAt: string };

const ROLES: UserRole[] = ["admin", "user"];

const fieldClass =
  "w-full rounded-xl border border-[var(--app-border-strong)] bg-[#fafafa] px-3 py-2.5 text-sm text-[var(--app-text)] placeholder:text-[var(--app-placeholder)] outline-none transition focus:border-[#c45c2a]/50 focus:ring-2 focus:ring-[#c45c2a]/20 dark:bg-[#1f1f1f]";

export default function SettingsUsersPage() {
  const [sessionLoading, setSessionLoading] = useState(true);
  const [sessionAuthed, setSessionAuthed] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [users, setUsers] = useState<Row[]>([]);
  const [pendingList, setPendingList] = useState<PendingRow[]>([]);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [newRole, setNewRole] = useState<UserRole>("user");
  const [newProviderSet, setNewProviderSet] = useState(
    () => new Set<ProviderId>(["anthropic", "openai", "google", "groq"])
  );
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [roleSavingId, setRoleSavingId] = useState<string | null>(null);
  const [provSavingId, setProvSavingId] = useState<string | null>(null);

  const [approveForId, setApproveForId] = useState<string | null>(null);
  const [rejectConfirmId, setRejectConfirmId] = useState<string | null>(null);
  const [revokeUserConfirmId, setRevokeUserConfirmId] = useState<string | null>(null);
  const [apRole, setApRole] = useState<UserRole>("user");
  const [apProvSet, setApProvSet] = useState(
    () => new Set<ProviderId>(["anthropic", "openai", "google", "groq"])
  );

  const checkSession = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSessionAuthed(false);
        setIsAdmin(false);
        return;
      }
      setSessionAuthed(true);
      setIsAdmin(Boolean(data.isAdmin));
    } catch {
      setSessionAuthed(false);
      setIsAdmin(false);
    } finally {
      setSessionLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const uRes = await fetch("/api/users");
      const uData = await uRes.json().catch(() => ({}));
      if (uRes.status === 403) {
        setUsers([]);
        setPendingList([]);
      } else if (!uRes.ok) {
        throw new Error(typeof uData.error === "string" ? uData.error : "Erro ao carregar");
      } else {
        const raw = Array.isArray(uData.users) ? uData.users : [];
        setUsers(
          raw.map((x: Row & { userModelAllowlist?: unknown }) => ({
            id: x.id,
            email: x.email,
            fullName: typeof x.fullName === "string" ? x.fullName : "",
            role: x.role,
            allowedProviders: x.allowedProviders ?? null,
            approvedAt: x.approvedAt ?? null,
          }))
        );
        const pend = Array.isArray(uData.pending) ? uData.pending : [];
        setPendingList(
          pend.map((p: PendingRow) => ({
            id: p.id,
            email: p.email,
            fullName: p.fullName ?? "",
            requestedAt: p.requestedAt ?? "",
          }))
        );
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void checkSession();
  }, [checkSession]);

  useEffect(() => {
    if (isAdmin !== true) return;
    void load();
  }, [isAdmin, load]);

  function toggleProv(set: React.Dispatch<React.SetStateAction<Set<ProviderId>>>, id: ProviderId) {
    set((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function openApprove(p: PendingRow) {
    setApproveForId(p.id);
    setApRole("user");
    setApProvSet(new Set<ProviderId>(["anthropic", "openai", "google", "groq"]));
  }

  async function submitApprove() {
    if (!approveForId) return;
    if (apProvSet.size === 0) {
      setErr("Selecione pelo menos um provedor.");
      return;
    }
    setErr("");
    setPending(true);
    try {
      const { allowedProviders, userModelAllowlist } = buildAccessPayload(apRole, apProvSet);
      const res = await fetch("/api/users/pending", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pendingId: approveForId,
          role: apRole,
          allowedProviders,
          userModelAllowlist,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Falha");
      setMsg("Usuário aprovado.");
      setApproveForId(null);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro");
    } finally {
      setPending(false);
    }
  }

  async function executeRejectPending(id: string) {
    setErr("");
    setRejectConfirmId(null);
    try {
      const res = await fetch(`/api/users/pending?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Falha");
      if (approveForId === id) setApproveForId(null);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro");
    }
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    setErr("");
    if (newRole === "user" && newProviderSet.size === 0) {
      setErr("Selecione pelo menos um provedor.");
      return;
    }
    setPending(true);
    try {
      const { allowedProviders, userModelAllowlist } = buildAccessPayload(newRole, newProviderSet);
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          fullName,
          password,
          role: newRole,
          allowedProviders,
          userModelAllowlist,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Falha");
      setMsg("Usuário criado.");
      setEmail("");
      setFullName("");
      setPassword("");
      setNewRole("user");
      setNewProviderSet(new Set(["anthropic", "openai", "google", "groq"]));
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro");
    } finally {
      setPending(false);
    }
  }

  async function onRoleChange(id: string, role: UserRole) {
    setErr("");
    setRoleSavingId(id);
    try {
      const res = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, role }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Falha");
      const updated = data.user as Row | undefined;
      if (updated && updated.id === id) {
        setUsers((prev) =>
          prev.map((u) =>
            u.id === id
              ? {
                  id: updated.id,
                  email: updated.email,
                  fullName: updated.fullName ?? u.fullName,
                  role: updated.role,
                  allowedProviders: updated.allowedProviders ?? null,
                  approvedAt: updated.approvedAt ?? u.approvedAt,
                }
              : u
          )
        );
      } else {
        setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, role } : u)));
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro");
      await load();
    } finally {
      setRoleSavingId(null);
    }
  }

  async function onToggleUserProvider(u: Row, pid: ProviderId) {
    if (u.role !== "user") return;
    const next = setFromAllowedProviders(u.allowedProviders);
    if (next.has(pid)) next.delete(pid);
    else next.add(pid);
    if (next.size === 0) {
      setErr("Tem de manter pelo menos um provedor ativo.");
      return;
    }
    setErr("");
    const allowedProviders = allowedProvidersFromSet(next);
    setProvSavingId(u.id);
    try {
      const res = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: u.id, allowedProviders }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Falha");
      const updated = data.user as Row | undefined;
      if (updated && updated.id === u.id) {
        setUsers((prev) =>
          prev.map((row) =>
            row.id === u.id
              ? {
                  id: updated.id,
                  email: updated.email,
                  fullName: updated.fullName ?? row.fullName,
                  role: updated.role,
                  allowedProviders: updated.allowedProviders ?? null,
                  approvedAt: updated.approvedAt ?? row.approvedAt,
                }
              : row
          )
        );
      } else {
        setUsers((prev) =>
          prev.map((row) => (row.id === u.id ? { ...row, allowedProviders } : row))
        );
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro");
      await load();
    } finally {
      setProvSavingId(null);
    }
  }

  async function executeRevokeUser(id: string) {
    setErr("");
    setRevokeUserConfirmId(null);
    try {
      const res = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: "rejected" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Falha");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro");
    }
  }

  function providerSummary(u: Row): string {
    if (u.role === "admin") return "—";
    if (u.allowedProviders === null) return "Todos";
    if (!u.allowedProviders.length) return "Nenhum";
    return u.allowedProviders.join(", ");
  }

  if (sessionLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm font-medium text-[var(--app-text-muted)]">A carregar…</p>
      </div>
    );
  }

  if (!sessionAuthed) {
    return (
      <div className="rounded-2xl border border-[var(--app-border-strong)] bg-[var(--app-surface)] p-8 text-center shadow-sm dark:bg-[#2b2b2b]">
        <p className="text-sm font-semibold text-[var(--app-text)]">Sessão necessária</p>
        <p className="mt-2 text-sm leading-relaxed text-[var(--app-text-secondary)]">
          Inicie sessão para aceder a esta página.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex rounded-full bg-[#141413] px-5 py-2.5 text-sm font-bold text-white dark:bg-[#ececec] dark:text-[#141413]"
        >
          Ir para o login
        </Link>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="rounded-2xl border border-[var(--app-border-strong)] bg-[var(--app-surface)] p-8 text-center shadow-sm dark:bg-[#2b2b2b]">
        <p className="text-sm font-semibold text-[var(--app-text)]">Acesso restrito</p>
        <p className="mt-2 text-sm leading-relaxed text-[var(--app-text-secondary)]">
          Apenas administradores podem gerir utilizadores. Para a sua palavra-passe, use{" "}
          <strong className="font-semibold text-[var(--app-text)]">Minha conta</strong>.
        </p>
        <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/settings/account"
            className="inline-flex rounded-full bg-[#141413] px-5 py-2.5 text-sm font-bold text-white dark:bg-[#ececec] dark:text-[#141413]"
          >
            Ir a Minha conta
          </Link>
          <Link
            href="/settings"
            className="inline-flex rounded-full border border-[var(--app-border-strong)] px-5 py-2.5 text-sm font-bold text-[var(--app-text-secondary)]"
          >
            Visão geral
          </Link>
        </div>
      </div>
    );
  }

  const busyUser = (id: string) => roleSavingId === id || provSavingId === id;

  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight text-[var(--app-text)] sm:text-3xl">
          Usuários
        </h2>
        <p className="max-w-2xl text-sm font-medium leading-relaxed text-[var(--app-text-secondary)]">
          Pedidos criados na página de login aparecem abaixo até serem aprovados. Cada conta tem nível{" "}
          <strong className="font-semibold text-[var(--app-text)]">Administrador</strong> ou{" "}
          <strong className="font-semibold text-[var(--app-text)]">Usuário</strong>; para utilizadores, os
          modelos seguem a lista global em Definições → Chaves e modelos.
        </p>
      </header>

      {err ? (
        <p className="rounded-xl border border-red-300/60 bg-red-50 px-4 py-3 text-sm font-medium text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          {err}
        </p>
      ) : null}
      {msg ? (
        <p className="rounded-xl border border-emerald-300/60 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200">
          {msg}
        </p>
      ) : null}

      <section className="rounded-[28px] border border-[var(--app-border-strong)] bg-[var(--app-surface)] p-5 shadow-sm dark:bg-[#303030] sm:p-6">
        <h3 className="text-xs font-bold uppercase tracking-wide text-[#c45c2a] dark:text-[#e8a87c]">
          Pedidos pendentes ({pendingList.length})
        </h3>
        <p className="mt-1 text-xs font-medium text-[var(--app-text-muted)]">
          Cadastros com status pendente. Aprove com nível e provedores ou rejeite o pedido.
        </p>
        {pendingList.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--app-text-muted)]">Nenhum pedido em espera.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {pendingList.map((p) => (
              <li
                key={p.id}
                className="rounded-2xl border border-black/[0.08] bg-white p-4 dark:border-white/[0.1] dark:bg-[#2b2b2b]"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-semibold text-[var(--app-text)]">
                      {p.fullName || "—"}{" "}
                      <span className="font-normal text-[var(--app-text-secondary)]">· {p.email}</span>
                    </p>
                    <p className="text-xs text-[var(--app-text-muted)]">
                      Pedido em {new Date(p.requestedAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex w-full min-w-0 flex-col items-stretch gap-2 sm:w-auto sm:items-end">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => openApprove(p)}
                        className="rounded-full bg-[#141413] px-4 py-2 text-xs font-bold text-white dark:bg-[#ececec] dark:text-[#141413]"
                      >
                        Aprovar
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setRejectConfirmId((cur) => (cur === p.id ? null : p.id))
                        }
                        className="rounded-full border border-[var(--app-border-strong)] px-4 py-2 text-xs font-bold text-[var(--app-text-secondary)]"
                      >
                        Rejeitar
                      </button>
                    </div>
                    {rejectConfirmId === p.id ? (
                      <div className="flex max-w-full flex-col gap-2 rounded-xl border border-red-200/70 bg-red-50/90 px-3 py-2.5 dark:border-red-900/50 dark:bg-red-950/40">
                        <span className="text-xs font-medium text-red-800 dark:text-red-200">
                          Rejeitar e remover este pedido?
                        </span>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => void executeRejectPending(p.id)}
                            className="rounded-lg bg-red-700 px-3 py-1.5 text-xs font-bold text-white dark:bg-red-600"
                          >
                            Confirmar
                          </button>
                          <button
                            type="button"
                            onClick={() => setRejectConfirmId(null)}
                            className="rounded-lg border border-[var(--app-border-strong)] px-3 py-1.5 text-xs font-semibold text-[var(--app-text-secondary)]"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
                {approveForId === p.id ? (
                  <div className="mt-4">
                    <UserAccessFields
                      compactToolbar
                      role={apRole}
                      onRoleChange={setApRole}
                      selectedProviders={apProvSet}
                      onToggleProvider={(id) => toggleProv(setApProvSet, id)}
                      providerCascadeDisabled={pending}
                    />
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => void submitApprove()}
                        className="rounded-full bg-[#c45c2a] px-5 py-2 text-sm font-bold text-white disabled:opacity-50 dark:bg-[#e8a87c] dark:text-[#141413]"
                      >
                        Confirmar aprovação
                      </button>
                      <button
                        type="button"
                        onClick={() => setApproveForId(null)}
                        className="rounded-full px-4 py-2 text-sm font-semibold text-[var(--app-text-muted)]"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-[28px] border border-[var(--app-border-strong)] bg-[var(--app-surface)] p-5 shadow-sm dark:bg-[#303030] sm:p-6">
        <h3 className="text-xs font-bold uppercase tracking-wide text-[var(--app-text-muted)]">
          Novo usuário
        </h3>
        <form onSubmit={(e) => void onCreate(e)} className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="text-xs font-bold uppercase tracking-wide text-[var(--app-text-muted)]">
                Email
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nome@empresa.com"
                autoComplete="off"
                className={`${fieldClass} mt-1.5`}
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-xs font-bold uppercase tracking-wide text-[var(--app-text-muted)]">
                Nome completo
              </span>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Nome do usuário"
                autoComplete="off"
                className={`${fieldClass} mt-1.5`}
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-[var(--app-text-muted)]">
                Senha
              </span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mín. 6 caracteres"
                autoComplete="new-password"
                className={`${fieldClass} mt-1.5`}
              />
            </label>
          </div>
          <UserAccessFields
            compactToolbar
            role={newRole}
            onRoleChange={setNewRole}
            selectedProviders={newProviderSet}
            onToggleProvider={(id) => toggleProv(setNewProviderSet, id)}
            providerCascadeDisabled={pending}
          />
          <p className="text-xs text-[var(--app-text-muted)]">{USER_ROLE_DESCRIPTIONS[newRole]}</p>
          <button
            type="submit"
            disabled={pending}
            className="rounded-full bg-[#141413] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#2d2d2d] disabled:opacity-50 dark:bg-[#ececec] dark:text-[#141413] dark:hover:bg-white"
          >
            {pending ? "A criar…" : "Criar usuário"}
          </button>
        </form>
      </section>

      <section>
        <h3 className="text-xs font-bold uppercase tracking-wide text-[var(--app-text-muted)]">
          Contas ativas ({users.length})
        </h3>
        {loading ? (
          <p className="mt-4 text-sm font-medium text-[var(--app-text-muted)]">A carregar…</p>
        ) : users.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-dashed border-[var(--app-border-strong)] px-4 py-10 text-center text-sm text-[var(--app-text-muted)]">
            Nenhum usuário no ficheiro.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {users.map((u) => (
              <li
                key={u.id}
                className="rounded-2xl border border-black/[0.08] bg-white p-4 dark:border-white/[0.1] dark:bg-[#2b2b2b]"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-[var(--app-text)]">
                      {u.fullName || "—"}{" "}
                      <span className="font-normal text-[var(--app-text-secondary)]">· {u.email}</span>
                    </p>
                    <p className="mt-1 text-xs text-[var(--app-text-muted)]">
                      Aprovado em{" "}
                      {u.approvedAt
                        ? new Date(u.approvedAt).toLocaleString()
                        : "—"}{" "}
                      · Resumo: {providerSummary(u)}
                    </p>
                    <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
                      <div className="shrink-0 sm:w-[200px]">
                        <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--app-text-muted)]">
                          Nível
                        </span>
                        <select
                          value={u.role}
                          disabled={busyUser(u.id)}
                          onChange={(e) => void onRoleChange(u.id, e.target.value as UserRole)}
                          className={`${fieldClass} mt-1.5 max-w-full py-2 text-sm disabled:opacity-60`}
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>
                              {USER_ROLE_LABELS[r]}
                            </option>
                          ))}
                        </select>
                      </div>
                      {u.role === "user" ? (
                        <ProviderCascadeCheckboxes
                          className="min-w-0 flex-1 sm:max-w-xs"
                          selectedProviders={setFromAllowedProviders(u.allowedProviders)}
                          onToggle={(pid) => void onToggleUserProvider(u, pid)}
                          disabled={busyUser(u.id)}
                        />
                      ) : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end sm:pt-1">
                    {revokeUserConfirmId === u.id ? (
                      <div className="flex max-w-[240px] flex-col gap-2 rounded-xl border border-red-200/70 bg-red-50/90 px-3 py-2.5 dark:border-red-900/50 dark:bg-red-950/40">
                        <span className="text-xs font-medium text-red-800 dark:text-red-200">
                          Revogar acesso? O utilizador será desligado e não poderá entrar.
                        </span>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => void executeRevokeUser(u.id)}
                            className="rounded-lg bg-red-700 px-3 py-1.5 text-xs font-bold text-white dark:bg-red-600"
                          >
                            Revogar
                          </button>
                          <button
                            type="button"
                            onClick={() => setRevokeUserConfirmId(null)}
                            className="rounded-lg border border-[var(--app-border-strong)] px-3 py-1.5 text-xs font-semibold text-[var(--app-text-secondary)]"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setRevokeUserConfirmId(u.id)}
                        className="rounded-xl border border-red-300/50 px-3 py-2 text-xs font-bold text-red-700 dark:text-red-300"
                      >
                        Revogar acesso
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
