"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Code2, Image, MessageSquare, Mic } from "lucide-react";

const items = [
  { label: "Chat", href: "/chat", icon: MessageSquare },
  { label: "Código", href: "/dev", icon: Code2 },
  { label: "Imagem", href: "/imagem", icon: Image },
  { label: "Voz", href: "/voz", icon: Mic },
] as const;

export default function AppNav({ className = "" }: { className?: string }) {
  const pathname = usePathname() || "";

  return (
    <nav
      role="navigation"
      aria-label="Modos da aplicação"
      className={`flex w-max max-w-full shrink-0 items-center gap-1 rounded-full bg-[var(--app-surface-2)] px-1 py-1 ${className}`}
    >
      {items.map(({ label, href, icon: Icon }) => {
        const isActive =
          href === "/chat"
            ? pathname === "/" || pathname.startsWith("/chat")
            : pathname === href || pathname.startsWith(`${href}/`);

        return (
          <Link
            key={href}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-all ${
              isActive
                ? "bg-[#141413] text-white dark:bg-[#ececec] dark:text-[#141413]"
                : "text-[var(--app-text-secondary)] hover:bg-[var(--app-hover)]"
            }`}
          >
            <Icon size={14} aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
