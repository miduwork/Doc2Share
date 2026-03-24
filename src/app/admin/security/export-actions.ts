"use server";

import { ok, fail, type ActionResult } from "@/lib/action-result";
import { requireSuperAdminContext } from "@/lib/admin/guards";
import { createClient } from "@/lib/supabase/server";
import {
  fetchAccessLogsForExport,
  fetchSecurityLogsForExport,
  parseSecurityLogFilters,
  toCsv,
  type SearchParamsLike,
} from "@/lib/admin/security-log-query";

const EXPORT_LIMIT = 5000;

export async function exportAccessLogsCsv(
  filters: SearchParamsLike
): Promise<ActionResult<{ csv: string; filename: string }>> {
  const guard = await requireSuperAdminContext();
  if (!guard.ok) return fail(guard.error ?? "Bạn không có quyền thực hiện thao tác này.");
  const supabase = await createClient();
  const parsed = parseSecurityLogFilters(filters);
  const rows = await fetchAccessLogsForExport({ supabase, filters: parsed, limit: EXPORT_LIMIT });
  const csv = toCsv(rows, [
    "created_at",
    "correlation_id",
    "user_id",
    "document_id",
    "action",
    "status",
    "ip_address",
    "device_id",
  ]);
  return ok({
    csv,
    filename: `access-logs-${new Date().toISOString().slice(0, 10)}.csv`,
  });
}

export async function exportSecurityLogsCsv(
  filters: SearchParamsLike
): Promise<ActionResult<{ csv: string; filename: string }>> {
  const guard = await requireSuperAdminContext();
  if (!guard.ok) return fail(guard.error ?? "Bạn không có quyền thực hiện thao tác này.");
  const supabase = await createClient();
  const parsed = parseSecurityLogFilters(filters);
  const rows = await fetchSecurityLogsForExport({ supabase, filters: parsed, limit: EXPORT_LIMIT });
  const csv = toCsv(rows, [
    "created_at",
    "correlation_id",
    "user_id",
    "event_type",
    "severity",
    "ip_address",
    "device_id",
    "user_agent",
  ]);
  return ok({
    csv,
    filename: `security-logs-${new Date().toISOString().slice(0, 10)}.csv`,
  });
}
