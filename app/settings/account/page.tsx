"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PasswordFieldWithEye } from "@/components/PasswordFieldWithEye";
import {
  readAccountFullNameFromLocalStorage,
  writeAccountFullNameToLocalStorage,
} from "@/lib/account-display-name-local";

export default function SettingsAccountPage() {
  const [sessionLoading, setSessionLoading] = useState(true);
  const [sessionAuthed, setSessionAuthed] = useState(false);
  const [sessionEmail, setSessionEmail] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [nameMsg, setNameMsg] = useState("");
  const [nameErr, setNameErr] = useState("");
  const [namePending, setNamePending] = useState(false);
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [pwdMsg, setPwdMsg] = useState("");
  const [pwdErr, setPwdErr] = useState("");
  const [pwdPending, setPwdPending] = useState(false);
  const [showCurrentPwd, setShowCurrentPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);

  const loadMe = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSessionAuthed(false);
        setSessionEmail("");
        setUserId(null);
        setFullName("");
        return;
      }
      setSessionAuthed(true);
      const email =
        typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
      setSessionEmail(email);
      setUserId(typeof data.id === "string" ? data.id : null);
      let name = typeof data.fullName === "string" ? data.fullName.trim() : "";
      if (!name && email) {
        const fromLs = readAccountFullNameFromLocalStorage(email);
        if (fromLs) name = fromLs;
      }
      setFullName(name);
    } catch {
      setSessionAuthed(false);
      setSessionEmail("");
      setUserId(null);
      setFullName("");
    } finally {
      setSessionLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMe();
  }, [loadMe]);

  async function onSaveName(e: React.FormEvent) {
    e.preventDefault();
    setNameMsg("");
    setNameErr("");
    setNamePending(true);
    try {
      if (userId) {
        const res = await fetch("/api/users", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: userId, fullName }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(typeof data.error === "string" ? data.error : "Não foi possível salvar.");
        }
        setNameMsg("Nome atualizado.");
        if (data.user && typeof data.user.fullName === "string") {
          setFullName(data.user.fullName);
        }
        window.dispatchEvent(new Event("ai-chat-ls-update"));
        return;
      }
      const email = sessionEmail.trim().toLowerCase();
      if (!email) {
        setNameErr("Não foi possível identificar a sessão. Faça login novamente.");
        return;
      }
      writeAccountFullNameToLocalStorage(email, fullName);
      setNameMsg("Nome salvo localmente.");
      window.dispatchEvent(new Event("ai-chat-ls-update"));
    } catch (e) {
      setNameErr(e instanceof Error ? e.message : "Erro");
    } finally {
      setNamePending(false);
    }
  }

  async function onChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwdMsg("");
    setPwdErr("");
    if (newPwd !== confirmPwd) {
      setPwdErr("As novas senhas não coincidem.");
      return;
    }
    if (newPwd.length < 6) {
      setPwdErr("A nova senha deve ter pelo menos 6 caracteres.");
      return;
    }
    setPwdPending(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: currentPwd, newPassword: newPwd }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Falha");
      setPwdMsg("Senha atualizada.");
      setCurrentPwd("");
      setNewPwd("");
      setConfirmPwd("");
    } catch (e) {
      setPwdErr(e instanceof Error ? e.message : "Erro");
    } finally {
      setPwdPending(false);
    }
  }

  if (sessionLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm font-medium text-[var(--app-text-muted)]">Carregando…</p>
      </div>
    );
  }

  if (!sessionAuthed) {
    return (
      <div className="rounded-2xl border border-[var(--app-border-strong)] bg-[var(--app-surface)] p-8 text-center shadow-sm dark:bg-[#2b2b2b]">
        <p className="text-sm font-semibold text-[var(--app-text)]">Sessão necessária</p>
        <p className="mt-2 text-sm leading-relaxed text-[var(--app-text-secondary)]">
          Faça login para gerenciar sua conta.
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

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight text-[var(--app-text)] sm:text-3xl">
          Minha conta
        </h2>
        <p className="max-w-2xl text-sm font-medium leading-relaxed text-[var(--app-text-secondary)]">
          Usuários cadastrados podem atualizar suas informações aqui.
        </p>
      </header>

      <section className="rounded-[28px] border border-[var(--app-border-strong)] bg-[var(--app-surface)] p-5 shadow-sm dark:bg-[#303030] sm:p-6">
        <h3 className="text-xs font-bold uppercase tracking-wide text-[#c45c2a] dark:text-[#e8a87c]">
          Informações pessoais
        </h3>
        <p className="mt-1 text-xs font-medium text-[var(--app-text-muted)]">
          Nome usado na interface quando disponível.
        </p>
        {nameErr ? (
          <p className="mt-4 rounded-xl border border-red-300/60 bg-red-50 px-4 py-3 text-sm font-medium text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
            {nameErr}
          </p>
        ) : null}
        {nameMsg ? (
          <p className="mt-4 rounded-xl border border-emerald-300/60 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200">
            {nameMsg}
          </p>
        ) : null}
        <form onSubmit={(e) => void onSaveName(e)} className="mt-4 space-y-4">
          <div>
            <label htmlFor="account-full-name" className="block text-xs font-bold uppercase tracking-wide text-[var(--app-text-secondary)]">
              Nome completo
            </label>
            <input
              id="account-full-name"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={namePending}
              autoComplete="name"
              className="mt-2 w-full max-w-md rounded-xl border border-[var(--app-border-strong)] bg-[#fafafa] px-3 py-2.5 text-sm text-[var(--app-text)] outline-none transition focus:border-[#c45c2a]/50 focus:ring-2 focus:ring-[#c45c2a]/20 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-[#1f1f1f]"
            />
          </div>
          <button
            type="submit"
            disabled={namePending}
            className="rounded-full bg-[#141413] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#2d2d2d] disabled:opacity-50 dark:bg-[#ececec] dark:text-[#141413] dark:hover:bg-white"
          >
            {namePending ? "Salvando…" : "Salvar nome"}
          </button>
        </form>
      </section>

      <section className="rounded-[28px] border border-[var(--app-border-strong)] bg-[var(--app-surface)] p-5 shadow-sm dark:bg-[#303030] sm:p-6">
        <h3 className="text-xs font-bold uppercase tracking-wide text-[#c45c2a] dark:text-[#e8a87c]">
          Senha
        </h3>
        <p className="mt-1 text-xs font-medium text-[var(--app-text-muted)]">
          Use uma senha forte e não reutilize em outros serviços.
        </p>
        {pwdErr ? (
          <p className="mt-4 rounded-xl border border-red-300/60 bg-red-50 px-4 py-3 text-sm font-medium text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
            {pwdErr}
          </p>
        ) : null}
        {pwdMsg ? (
          <p className="mt-4 rounded-xl border border-emerald-300/60 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200">
            {pwdMsg}
          </p>
        ) : null}
        <form onSubmit={(e) => void onChangePassword(e)} className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <PasswordFieldWithEye
              label="Senha atual"
              labelClassName="block sm:col-span-2"
              value={currentPwd}
              onValueChange={setCurrentPwd}
              show={showCurrentPwd}
              onToggleShow={() => setShowCurrentPwd((s) => !s)}
              autoComplete="current-password"
              required
            />
            <PasswordFieldWithEye
              label="Nova senha"
              labelClassName="block"
              value={newPwd}
              onValueChange={setNewPwd}
              show={showNewPwd}
              onToggleShow={() => setShowNewPwd((s) => !s)}
              autoComplete="new-password"
              placeholder="Mín. 6 caracteres"
              required
            />
            <PasswordFieldWithEye
              label="Confirmar nova senha"
              labelClassName="block"
              value={confirmPwd}
              onValueChange={setConfirmPwd}
              show={showConfirmPwd}
              onToggleShow={() => setShowConfirmPwd((s) => !s)}
              autoComplete="new-password"
              required
            />
          </div>
          <button
            type="submit"
            disabled={pwdPending}
            className="rounded-full bg-[#141413] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#2d2d2d] disabled:opacity-50 dark:bg-[#ececec] dark:text-[#141413] dark:hover:bg-white"
          >
            {pwdPending ? "Salvando…" : "Salvar senha"}
          </button>
        </form>
      </section>
    </div>
  );
}
