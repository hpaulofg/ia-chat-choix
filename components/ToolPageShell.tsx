"use client";

import { useCallback, useEffect, useState } from "react";
import AppNav from "@/components/AppNav";
import { ChatAccountMenu } from "@/components/ChatAccountMenu";
import { readAccountFullNameFromLocalStorage } from "@/lib/account-display-name-local";

export function ToolPageShell({ children }: { children: React.ReactNode }) {
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [accountFullName, setAccountFullName] = useState<string | null>(null);
  const [accountProfileLoaded, setAccountProfileLoaded] = useState(false);

  const refreshAccount = useCallback(() => {
    void fetch("/api/auth/me")
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) return;
        if (typeof d.email === "string" && d.email) setAccountEmail(d.email);
        let fn = typeof d.fullName === "string" ? d.fullName.trim() : "";
        if (!fn && typeof d.email === "string" && d.email.trim()) {
          const fromLs = readAccountFullNameFromLocalStorage(d.email);
          if (fromLs) fn = fromLs;
        }
        if (fn) setAccountFullName(fn);
        else setAccountFullName(null);
      })
      .catch(() => {})
      .finally(() => setAccountProfileLoaded(true));
  }, []);

  useEffect(() => {
    refreshAccount();
  }, [refreshAccount]);

  useEffect(() => {
    function onLs() {
      refreshAccount();
    }
    window.addEventListener("ai-chat-ls-update", onLs);
    return () => window.removeEventListener("ai-chat-ls-update", onLs);
  }, [refreshAccount]);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  };

  return (
    <div className="flex h-[100dvh] w-full min-w-0 max-w-full flex-col overflow-hidden overflow-x-hidden bg-[#fafafa] text-[var(--app-text)] transition-colors duration-200 dark:bg-[#212121]">
      <header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-[var(--app-border)] bg-transparent px-3 sm:px-4">
        <ChatAccountMenu
          email={accountEmail}
          fullName={accountFullName}
          profileLoading={!accountProfileLoaded}
          onLogout={logout}
        />
        <div className="min-w-0 shrink-0 overflow-x-auto py-0.5">
          <AppNav />
        </div>
      </header>
      <main className="chat-app-scroll relative z-0 min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-5 sm:px-6 sm:py-6">
        {children}
      </main>
    </div>
  );
}
