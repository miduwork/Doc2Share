import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseSecurityLogFilters, fetchAccessLogsForExport, toCsv } from "@/lib/admin/security-log-query";

const EXPORT_LIMIT = 5000;

export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, admin_role, is_active")
    .eq("id", user.id)
    .single();
  if (!profile || profile.role !== "admin" || profile.admin_role !== "super_admin" || !profile.is_active) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const url = new URL(req.url);
  const filters = parseSecurityLogFilters(Object.fromEntries(url.searchParams.entries()));
  const rows = await fetchAccessLogsForExport({ supabase, filters, limit: EXPORT_LIMIT });
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

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="access-logs-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
