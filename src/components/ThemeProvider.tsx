"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { getTheme, setTheme as persistTheme, applyTheme, getResolvedDark, type Theme } from "@/lib/theme";

type ThemeContextValue = {
  theme: Theme;
  setTheme: (_t: Theme) => void;
  resolvedDark: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [resolvedDark, setResolvedDark] = useState(false);

  const setTheme = useCallback((theme: Theme) => {
    persistTheme(theme);
    setThemeState(theme);
    setResolvedDark(getResolvedDark(theme));
  }, []);

  useEffect(() => {
    const t = getTheme();
    setThemeState(t);
    applyTheme(t);
    setResolvedDark(getResolvedDark(t));
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      if (theme !== "system") return;
      applyTheme("system");
      setResolvedDark(media.matches);
    };
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedDark }}>
      {children}
    </ThemeContext.Provider>
  );
}
