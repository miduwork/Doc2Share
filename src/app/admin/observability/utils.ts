import type { SupabaseClient } from "@supabase/supabase-js";
import { clampInt, pickSingle } from "@/lib/search-params";
import type { AlertEventRow } from "./types";

export { clampInt, pickSingle };

export function getSinceIso(windowValue: string): string | null {
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

export function toQueryString(params: Record<string, string>): string {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    q.set(key, value);
  }
  return q.toString();
}

export function getPresetDefaults(preset: string): {
  window: string;
  severity: string;
  source: string;
  eventType: string;
} {
  if (preset === "incident") {
    return { window: "24h", severity: "error", source: "all", eventType: "all" };
  }
  if (preset === "webhook-errors") {
    return { window: "24h", severity: "error", source: "edge.payment_webhook", eventType: "all" };
  }
  if (preset === "secure-link-blocked") {
    return { window: "24h", severity: "all", source: "edge.get_secure_link", eventType: "blocked" };
  }
  if (preset === "document-pipeline") {
    return { window: "24h", severity: "all", source: "db.document_lifecycle", eventType: "all" };
  }
  return { window: "24h", severity: "all", source: "all", eventType: "all" };
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

function parseCursor(cursor: string): { createdAt: string; id: string } | null {
  const [createdAt, id] = cursor.split("|");
  if (!createdAt || !id) return null;
  return { createdAt, id };
}

function encodeCursor(row: AlertEventRow): string {
  return `${row.created_at}|${row.id}`;
}

export async function fetchAlertsByCursor({
  supabase,
  sinceIso,
  severity,
  source,
  eventType,
  pageSize,
  cursor,
  direction,
}: {
  supabase: SupabaseClient;
  sinceIso: string | null;
  severity: string;
  source: string;
  eventType: string;
  pageSize: number;
  cursor: string;
  direction: "next" | "prev";
}): Promise<{ items: AlertEventRow[]; nextCursor: string | null; prevCursor: string | null }> {
  const parsedCursor = parseCursor(cursor);
  const ascending = direction === "prev";
  let query = supabase
    .from("observability_events")
    .select("id, created_at, severity, source, event_type, metadata")
    .order("created_at", { ascending })
    .order("id", { ascending })
    .limit(pageSize + 1);
  if (sinceIso) query = query.gte("created_at", sinceIso);
  if (severity !== "all") query = query.eq("severity", severity);
  if (source !== "all") query = query.eq("source", source);
  if (eventType !== "all") query = query.eq("event_type", eventType);
  if (parsedCursor) {
    if (direction === "next") {
      query = query.or(`created_at.lt.${parsedCursor.createdAt},and(created_at.eq.${parsedCursor.createdAt},id.lt.${parsedCursor.id})`);
    } else {
      query = query.or(`created_at.gt.${parsedCursor.createdAt},and(created_at.eq.${parsedCursor.createdAt},id.gt.${parsedCursor.id})`);
    }
  }

  const { data } = await query;
  const rows = ((data ?? []) as AlertEventRow[]).slice(0, pageSize);
  const hasExtra = ((data ?? []) as AlertEventRow[]).length > pageSize;
  const normalizedRows = direction === "prev" ? [...rows].reverse() : rows;

  const nextCursor = hasExtra && normalizedRows.length > 0 ? encodeCursor(normalizedRows[normalizedRows.length - 1]) : null;
  const prevCursor =
    (parsedCursor && normalizedRows.length > 0) || (direction === "prev" && hasExtra && normalizedRows.length > 0)
      ? encodeCursor(normalizedRows[0])
      : null;

  return { items: normalizedRows, nextCursor, prevCursor };
}
