import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { clampInt } from "@/lib/search-params";
import { verifyDiagnosticsPayload } from "@/lib/diagnostics-signature";

type RunRow = {
  id: string;
  started_at: string;
  finished_at: string | null;
  triggered_by: string;
  success: boolean;
  alerts_count: number;
  access_deleted: number;
  security_deleted: number;
  observability_deleted: number;
  webhook_deleted: number;
};

export async function GET(req: Request) {
  const supabase = await createClient();
  const url = new URL(req.url);
  const selectedLimit = clampInt(url.searchParams.get("limit") ?? "2000", 100, 10000, 2000);
  const selectedWindow = url.searchParams.get("window") ?? "24h";
  const sinceIso = getSinceIso(selectedWindow);
  const shareExp = url.searchParams.get("share_exp") ?? "";
  const shareSig = url.searchParams.get("share_sig") ?? "";
  const signedPayload = {
    preset: url.searchParams.get("preset") ?? "custom",
    window: selectedWindow,
    severity: url.searchParams.get("severity") ?? "all",
    source: url.searchParams.get("source") ?? "all",
    event_type: url.searchParams.get("event_type") ?? "all",
    alerts_cursor: url.searchParams.get("alerts_cursor") ?? "",
    alerts_dir: url.searchParams.get("alerts_dir") ?? "next",
    alerts_page: url.searchParams.get("alerts_page") ?? "1",
    runs_page: url.searchParams.get("runs_page") ?? "1",
    alerts_page_size: url.searchParams.get("alerts_page_size") ?? "20",
    runs_page_size: url.searchParams.get("runs_page_size") ?? "20",
    export_limit: url.searchParams.get("export_limit") ?? String(selectedLimit),
    share_exp: shareExp,
  };

  const hasValidShareSignature = Boolean(
    process.env.DIAGNOSTICS_SHARE_SECRET &&
      shareExp &&
      shareSig &&
      Number(shareExp) > Math.floor(Date.now() / 1000) &&
      verifyDiagnosticsPayload(signedPayload, shareSig, process.env.DIAGNOSTICS_SHARE_SECRET)
  );
  if (!hasValidShareSignature) {
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
  }

  let query = supabase
    .from("backend_maintenance_runs")
    .select(
      "id, started_at, finished_at, triggered_by, success, alerts_count, access_deleted, security_deleted, observability_deleted, webhook_deleted"
    )
    .order("started_at", { ascending: false })
    .limit(selectedLimit);
  if (sinceIso) query = query.gte("started_at", sinceIso);

  const { data, error } = await query;

  if (error) {
    return new NextResponse(`Query failed: ${error.message}`, { status: 500 });
  }

  const rows = (data as RunRow[] | null) ?? [];
  const csv = toCsv(rows);
  const filename = `maintenance-runs-${selectedWindow}-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

function getSinceIso(windowValue: string): string | null {
  const now = Date.now();
  const map: Record<string, number> = { "1h": 1, "6h": 6, "24h": 24 };
  if (windowValue in map) return new Date(now - map[windowValue] * 60 * 60 * 1000).toISOString();
  if (windowValue === "7d") return new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  return new Date(now - 24 * 60 * 60 * 1000).toISOString();
}

function toCsv(rows: RunRow[]): string {
  const header = [
    "id",
    "started_at",
    "finished_at",
    "triggered_by",
    "success",
    "alerts_count",
    "access_deleted",
    "security_deleted",
    "observability_deleted",
    "webhook_deleted",
    "deleted_total",
  ];
  const body = rows.map((r) =>
    [
      r.id,
      r.started_at,
      r.finished_at ?? "",
      r.triggered_by,
      r.success ? "true" : "false",
      r.alerts_count,
      r.access_deleted,
      r.security_deleted,
      r.observability_deleted,
      r.webhook_deleted,
      Number(r.access_deleted ?? 0) +
        Number(r.security_deleted ?? 0) +
        Number(r.observability_deleted ?? 0) +
        Number(r.webhook_deleted ?? 0),
    ]
      .map(csvEscape)
      .join(",")
  );
  return [header.join(","), ...body].join("\n");
}

function csvEscape(value: string | number): string {
  const raw = String(value ?? "");
  if (raw.includes(",") || raw.includes('"') || raw.includes("\n")) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}
