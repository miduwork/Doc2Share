import type { SupabaseClient } from "@supabase/supabase-js";
import { clampInt, pickSingle } from "@/lib/search-params";
import { fetchAlertsByCursor as fetchAlertsByCursorFeature } from "@/features/admin/observability/alerts/server/fetchAlertsByCursor";
import { formatBytes, formatCount, formatTime, getSinceIso, severityClass } from "@/features/admin/observability/shared/formatters";
import { toQueryString } from "@/features/admin/observability/shared/query-string";
import type { AlertEventRow } from "@/features/admin/observability/dashboard/model/dashboard.types";

export { clampInt, pickSingle };
export { formatBytes, formatCount, formatTime, getSinceIso, severityClass, toQueryString };

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
  return fetchAlertsByCursorFeature({ supabase, sinceIso, severity, source, eventType, pageSize, cursor, direction });
}
