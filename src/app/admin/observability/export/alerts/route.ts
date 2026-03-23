import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { clampInt } from "@/lib/search-params";
import { verifyDiagnosticsPayload } from "@/lib/diagnostics-signature";

type AlertExportRow = {
  created_at: string;
  source: string;
  event_type: string;
  severity: string;
  status_code: number | null;
  request_id: string | null;
  latency_ms: number | null;
  metadata: Record<string, unknown> | null;
};

export async function GET(req: Request) {
  const supabase = await createClient();

  const url = new URL(req.url);
  const selectedWindow = url.searchParams.get("window") ?? "24h";
  const selectedSeverity = url.searchParams.get("severity") ?? "all";
  const selectedSource = url.searchParams.get("source") ?? "all";
  const selectedEventType = url.searchParams.get("event_type") ?? "all";
  const selectedLimit = clampInt(url.searchParams.get("limit") ?? "2000", 100, 10000, 2000);
  const shareExp = url.searchParams.get("share_exp") ?? "";
  const shareSig = url.searchParams.get("share_sig") ?? "";
  const sinceIso = getSinceIso(selectedWindow);
  const signedPayload = {
    preset: url.searchParams.get("preset") ?? "custom",
    window: selectedWindow,
    severity: selectedSeverity,
    source: selectedSource,
    event_type: selectedEventType,
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
    .from("observability_events")
    .select("created_at, source, event_type, severity, status_code, request_id, latency_ms, metadata")
    .order("created_at", { ascending: false })
    .limit(selectedLimit);

  if (sinceIso) query = query.gte("created_at", sinceIso);
  if (selectedSeverity !== "all") query = query.eq("severity", selectedSeverity);
  if (selectedSource !== "all") query = query.eq("source", selectedSource);
  if (selectedEventType !== "all") query = query.eq("event_type", selectedEventType);

  const { data, error } = await query;
  if (error) {
    return new NextResponse(`Query failed: ${error.message}`, { status: 500 });
  }

  const rows = (data as AlertExportRow[] | null) ?? [];
  const csv = toCsv(rows);
  const filename = `alerts-${selectedWindow}-${selectedSeverity}-${selectedSource}-${selectedEventType}-${new Date().toISOString().slice(0, 10)}.csv`;

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

function toCsv(rows: AlertExportRow[]): string {
  const header = [
    "created_at",
    "source",
    "event_type",
    "severity",
    "status_code",
    "request_id",
    "latency_ms",
    "metadata_json",
  ];
  const body = rows.map((r) =>
    [
      r.created_at,
      r.source,
      r.event_type,
      r.severity,
      r.status_code ?? "",
      r.request_id ?? "",
      r.latency_ms ?? "",
      JSON.stringify(r.metadata ?? {}),
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
