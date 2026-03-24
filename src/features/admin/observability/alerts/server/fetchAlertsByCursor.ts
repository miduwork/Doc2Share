import type { SupabaseClient } from "@supabase/supabase-js";
import type { AlertEventRow } from "@/features/admin/observability/dashboard/model/dashboard.types";

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
