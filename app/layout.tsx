import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { HtmlThemeClass } from "@/components/HtmlThemeClass";
import { THEME_STORAGE_KEY } from "@/lib/chat-storage-keys";
import "./globals.css";

/** Antes de CSS/JS: aplica tema guardado; default escuro se não existir ou não for "light". */
const themeBootstrapScript = `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)};var v=localStorage.getItem(k);document.documentElement.classList.toggle("dark",v!=="light");}catch(e){document.documentElement.classList.add("dark");}})();`;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Assistente — Claude",
  description: "Chat e programação com a API Claude (Anthropic).",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} flex min-h-full flex-col antialiased`}
      >
        <Script
          id="theme-bootstrap"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: themeBootstrapScript }}
        />
        <HtmlThemeClass />
        {children}
      </body>
    </html>
  );
}
