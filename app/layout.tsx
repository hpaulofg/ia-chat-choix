import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { HtmlThemeClass } from "@/components/HtmlThemeClass";
import ThemeScript from "./ThemeScript";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "IA - Studio Choix",
  description: "Plataforma de IA do Studio Choix.",
  icons: {
    icon: [{ url: "/favicon.png", type: "image/png" }],
    apple: "/favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} flex min-h-full flex-col antialiased`}
      >
        <ThemeScript />
        <HtmlThemeClass />
        {children}
      </body>
    </html>
  );
}
