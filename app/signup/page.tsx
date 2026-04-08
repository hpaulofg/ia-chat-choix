"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AuthCard, AuthLogo, authInputClass } from "@/components/AuthCard";

function validEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [serverError, setServerError] = useState("");
  const [pending, setPending] = useState(false);

  const fieldErrors = useMemo(() => {
    const e: Record<string, string> = {};
    if (email.trim() && !validEmail(email)) e.email = "Email inválido.";
    if (password && password.length < 6) e.password = "Mínimo 6 caracteres.";
    if (confirm && password !== confirm) e.confirm = "As senhas não coincidem.";
    return e;
  }, [email, password, confirm]);

  async function onSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setServerError("");
    if (!fullName.trim()) {
      setServerError("Indique o nome completo.");
      return;
    }
    if (!validEmail(email)) {
      setServerError("Email inválido.");
      return;
    }
    if (password.length < 6) {
      setServerError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      setServerError("As senhas não coincidem.");
      return;
    }
    setPending(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim(),
          password,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setServerError(typeof data.error === "string" ? data.error : "Não foi possível enviar o pedido.");
        return;
      }
      try {
        sessionStorage.setItem("ai-chat-pending-registration", "1");
      } catch {
        /* ignore */
      }
      router.push("/signup/waiting");
    } catch {
      setServerError("Não foi possível conectar ao servidor.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#fafafa] px-4 py-12 dark:bg-[#212121]">
      <AuthCard>
        <div className="mb-8 text-center">
          <AuthLogo />
          <h1 className="text-xl font-semibold text-[var(--app-text)]">Criar conta</h1>
          <p className="mt-1 text-sm font-medium text-[var(--app-text-secondary)]">
            Envie um pedido de acesso ao administrador
          </p>
        </div>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-[var(--app-text)]">
              Nome completo
            </label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className={authInputClass}
              placeholder="Seu nome"
              autoComplete="name"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-[var(--app-text)]">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={authInputClass}
              placeholder="voce@exemplo.com"
              autoComplete="email"
            />
            {fieldErrors.email ? (
              <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-300">{fieldErrors.email}</p>
            ) : null}
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-[var(--app-text)]">Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={authInputClass}
              placeholder="Mínimo 6 caracteres"
              autoComplete="new-password"
            />
            {fieldErrors.password ? (
              <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-300">{fieldErrors.password}</p>
            ) : null}
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-[var(--app-text)]">
              Confirmar senha
            </label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={authInputClass}
              placeholder="Repita a senha"
              autoComplete="new-password"
            />
            {fieldErrors.confirm ? (
              <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-300">{fieldErrors.confirm}</p>
            ) : null}
          </div>
          {serverError ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-900 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-200">
              {serverError}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={pending}
            className="mt-1 rounded-xl bg-[#c45c2a] py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#9a3412] disabled:opacity-50 dark:bg-[#e8a87c] dark:text-[#1a1a18] dark:hover:bg-[#d4956a]"
          >
            {pending ? "A enviar…" : "Enviar pedido de acesso"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-[var(--app-text-secondary)]">
          <Link
            href="/login"
            className="font-semibold text-[#c45c2a] underline-offset-2 hover:underline dark:text-[#e8a87c]"
          >
            Já tem conta? Entrar
          </Link>
        </p>
      </AuthCard>
    </div>
  );
}
