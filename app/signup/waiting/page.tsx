"use client";

import { AuthCard, AuthLogo } from "@/components/AuthCard";

function ClockGlyph({ className = "h-14 w-14" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v6l3 2" />
    </svg>
  );
}

export default function SignupWaitingPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#fafafa] px-4 py-12 dark:bg-[#212121]">
      <AuthCard>
        <div className="mb-6 flex flex-col items-center text-center">
          <AuthLogo />
          <div className="mt-4 text-[#c45c2a] dark:text-[#e8a87c]">
            <ClockGlyph />
          </div>
          <h1 className="mt-4 text-xl font-semibold text-[var(--app-text)]">Pedido enviado!</h1>
          <p className="mt-3 text-sm leading-relaxed text-[var(--app-text-secondary)]">
            Seu cadastro foi recebido. Aguarde a aprovação do administrador. Você receberá acesso em
            breve.
          </p>
        </div>
      </AuthCard>
    </div>
  );
}
