import { useCallback, useEffect, useState } from "react";
import { THEME_KEY } from "../utils/config";
import { writeString } from "../utils/storage";

/**
 * Dark-mode state mirrored onto `<html class="dark">`. The initial class is
 * set by the inline boot script in index.html; this hook owns the toggle,
 * the smooth transition class, and cross-tab changes.
 */
export function useTheme(): { isDark: boolean; toggleTheme: () => void } {
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains("dark"));

  const toggleTheme = useCallback(() => {
    const html = document.documentElement;
    html.classList.add("theme-transitioning");
    const next = !isDark;
    if (next) {
      html.classList.add("dark");
    } else {
      html.classList.remove("dark");
    }
    writeString(THEME_KEY, next ? "dark" : "light");
    setIsDark(next);
    window.setTimeout(() => html.classList.remove("theme-transitioning"), 500);
  }, [isDark]);

  // A theme change in another tab updates this one.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.storageArea !== localStorage || e.key !== THEME_KEY) return;
      const dark = e.newValue === "dark";
      document.documentElement.classList.toggle("dark", dark);
      setIsDark(dark);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return { isDark, toggleTheme };
}
