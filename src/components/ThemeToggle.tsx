"use client";

import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import type { Theme } from "@/lib/theme";

const labels: Record<Theme, string> = {
  light: "Sáng",
  dark: "Tối",
  system: "Theo hệ thống",
};

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const cycle = () => {
    const next: Theme = theme === "system" ? "light" : theme === "light" ? "dark" : "system";
    setTheme(next);
  };

  const Icon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;

  return (
    <button
      type="button"
      onClick={cycle}
      className="rounded-xl p-2.5 text-muted transition hover:bg-surface-muted hover:text-fg"
      aria-label={`Giao diện: ${labels[theme]}. Nhấn để chuyển (Sáng / Tối / Theo hệ thống).`}
    >
      <Icon className="h-5 w-5" />
    </button>
  );
}
