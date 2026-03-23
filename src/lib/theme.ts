export const THEME_STORAGE_KEY = "doc2share-theme";

export type Theme = "light" | "dark" | "system";

export function getTheme(): Theme {
  if (typeof window === "undefined") return "system";
  const v = localStorage.getItem(THEME_STORAGE_KEY);
  if (v === "light" || v === "dark" || v === "system") return v;
  return "system";
}

export function setTheme(theme: Theme): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(THEME_STORAGE_KEY, theme);
  applyTheme(theme);
}

/** Trả về true nếu giao diện nên là dark (để set class "dark" lên html). */
export function getResolvedDark(theme: Theme): boolean {
  if (theme === "light") return false;
  if (theme === "dark") return true;
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/** Áp theme lên document: set/remove class "dark" trên html. */
export function applyTheme(theme: Theme): void {
  if (typeof document === "undefined") return;
  const dark = getResolvedDark(theme);
  document.documentElement.classList.toggle("dark", dark);
}
