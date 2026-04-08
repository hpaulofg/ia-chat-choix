"use client";

import { useLayoutEffect } from "react";
import {
  THEME_CHANGE_EVENT,
  THEME_STORAGE_KEY,
} from "@/lib/chat-storage-keys";

function applyThemeFromStorage() {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    document.documentElement.classList.toggle("dark", v !== "light");
  } catch {
    document.documentElement.classList.add("dark");
  }
}

export function HtmlThemeClass() {
  useLayoutEffect(() => {
    applyThemeFromStorage();
    window.addEventListener(THEME_CHANGE_EVENT, applyThemeFromStorage);
    window.addEventListener("storage", applyThemeFromStorage);
    return () => {
      window.removeEventListener(THEME_CHANGE_EVENT, applyThemeFromStorage);
      window.removeEventListener("storage", applyThemeFromStorage);
    };
  }, []);

  return null;
}
