"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { AuthCard, AuthLogo, authInputClass } from "@/components/AuthCard";

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (searchParams.get("denied") === "1") {
      setError("Seu acesso foi negado. Entre em contato com o administrador.");
    }
  }, [searchParams]);

  const checkEmailHint = useCallback(async (em: string) => {
    const trimmed = em.trim().toLowerCase();
    if (!trimmed.includes("@")) return;
    try {
      const res = await fetch("/api/auth/account-hint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.hint === "pending") {
        try {
          sessionStorage.setItem("ai-chat-pending-registration", "1");
        } catch {
          /* ignore */
        }
        router.replace("/signup/waiting");
      }
    } catch {
      /* ignore */
    }
  }, [router]);

  useEffect(() => {
    const t = window.setTimeout(() => void checkEmailHint(email), 400);
    return () => window.clearTimeout(t);
  }, [email, checkEmailHint]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setPending(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.code === "pending") {
        try {
          sessionStorage.setItem("ai-chat-pending-registration", "1");
        } catch {
          /* ignore */
        }
        router.replace("/signup/waiting");
        return;
      }
      if (data.code === "rejected") {
        setError(
          typeof data.error === "string"
            ? data.error
            : "Seu acesso foi negado. Entre em contato com o administrador."
        );
        return;
      }
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Falha no login.");
        return;
      }
      router.push("/chat");
      router.refresh();
    } catch {
      setError("Não foi possível conectar ao servidor.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#fafafa] px-4 py-12 dark:bg-[#212121]">
      <AuthCard>
        <div className="mb-8 text-center">
          <AuthLogo />
          <h1 className="text-xl font-semibold text-[var(--app-text)]">Entrar</h1>
          <p className="mt-1 text-sm font-medium text-[var(--app-text-secondary)]">
            Acesse o assistente de IA
          </p>
        </div>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div>
            <label
              htmlFor="email"
              className="mb-1.5 block text-sm font-semibold text-[var(--app-text)]"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={authInputClass}
              placeholder="voce@exemplo.com"
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block text-sm font-semibold text-[var(--app-text)]"
            >
              Senha
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={authInputClass}
              placeholder="••••••••"
            />
          </div>
          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-900 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-200">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={pending}
            className="mt-1 rounded-xl bg-[#c45c2a] py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#9a3412] disabled:opacity-50 dark:bg-[#e8a87c] dark:text-[#1a1a18] dark:hover:bg-[#d4956a]"
          >
            {pending ? "Entrando…" : "Entrar"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-[var(--app-text-secondary)]">
          <Link
            href="/signup"
            className="font-semibold text-[#c45c2a] underline-offset-2 hover:underline dark:text-[#e8a87c]"
          >
            Não tem conta? Cadastrar
          </Link>
        </p>
      </AuthCard>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[100dvh] items-center justify-center bg-[#fafafa] dark:bg-[#212121]">
          <AuthCard>
            <div className="h-40 animate-pulse rounded-xl bg-[var(--app-surface-2)] dark:bg-[#333]" />
          </AuthCard>
        </div>
      }
    >
      <LoginPageInner />
    </Suspense>
  );
}
