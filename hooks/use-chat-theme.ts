"use client";

import { useCallback, useEffect, useState } from "react";
import { THEME_CHANGE_EVENT, THEME_STORAGE_KEY } from "@/lib/chat-storage-keys";

export type ThemeChoice = "light" | "dark";

export function useChatTheme() {
  const [theme, setThemeState] = useState<ThemeChoice>("dark");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem(THEME_STORAGE_KEY) as ThemeChoice | null;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- evita mismatch SSR; tema só existe no cliente
      setThemeState(v === "light" ? "light" : "dark");
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  const setTheme = useCallback((t: ThemeChoice) => {
    setThemeState(t);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, t);
    } catch {
      /* ignore */
    }
    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("dark", t === "dark");
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
    }
  }, []);

  return { theme, setTheme, ready };
}
