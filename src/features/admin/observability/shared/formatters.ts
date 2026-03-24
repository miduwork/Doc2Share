import type { ObservabilityWindow } from "@/features/admin/observability/filters/model/filters.types";

export function getSinceIso(windowValue: ObservabilityWindow): string | null {
  const now = Date.now();
  const map: Record<string, number> = {
    "1h": 1,
    "6h": 6,
    "24h": 24,
  };
  if (windowValue in map) {
    return new Date(now - map[windowValue] * 60 * 60 * 1000).toISOString();
  }
  if (windowValue === "7d") {
    return new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  }
  return new Date(now - 24 * 60 * 60 * 1000).toISOString();
}

export function formatBytes(input: number | null | undefined): string {
  const bytes = Number(input ?? 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const exp = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exp;
  return `${value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2)} ${units[exp]}`;
}

export function formatCount(input: number | null | undefined): string {
  return Number(input ?? 0).toLocaleString("vi-VN");
}

export function formatTime(input: string | null | undefined): string {
  if (!input) return "—";
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("vi-VN");
}

export function severityClass(severity: string): string {
  if (severity === "error") return "text-red-600 dark:text-red-400";
  if (severity === "warn") return "text-amber-600 dark:text-amber-400";
  return "text-slate-600 dark:text-slate-400";
}
