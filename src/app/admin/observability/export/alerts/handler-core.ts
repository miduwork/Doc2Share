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

export type AlertsExportDeps = {
  parseExportRequest: (_reqUrl: string) => {
    payload: {
      window: string;
      severity: string;
      source: string;
      event_type: string;
    };
    shareSig: string;
    limit: number;
    sinceIso: string | null;
  };
  authorize: (_args: { supabase: any; payload: any; shareSig: string }) => Promise<Response | null>;
  buildCsvResponse: (_args: { csv: string; filename: string }) => Response;
  csvEscape: (_value: string | number) => string;
};

export function createAlertsExportHandler(deps: AlertsExportDeps) {
  return async function handleAlertsExportRequest(req: Request, supabase: any): Promise<Response> {
    const exportRequest = deps.parseExportRequest(req.url);
    const authError = await deps.authorize({
      supabase,
      payload: exportRequest.payload,
      shareSig: exportRequest.shareSig,
    });
    if (authError) return authError;

    let query = supabase
      .from("observability_events")
      .select("created_at, source, event_type, severity, status_code, request_id, latency_ms, metadata")
      .order("created_at", { ascending: false })
      .limit(exportRequest.limit);

    if (exportRequest.sinceIso) query = query.gte("created_at", exportRequest.sinceIso);
    if (exportRequest.payload.severity !== "all") query = query.eq("severity", exportRequest.payload.severity);
    if (exportRequest.payload.source !== "all") query = query.eq("source", exportRequest.payload.source);
    if (exportRequest.payload.event_type !== "all") query = query.eq("event_type", exportRequest.payload.event_type);

    const { data, error } = await query;
    if (error) return new Response(`Query failed: ${error.message}`, { status: 500 });

    const rows = (data as AlertExportRow[] | null) ?? [];
    const csv = toCsv(rows, deps.csvEscape);
    const filename = `alerts-${exportRequest.payload.window}-${exportRequest.payload.severity}-${exportRequest.payload.source}-${exportRequest.payload.event_type}-${new Date().toISOString().slice(0, 10)}.csv`;
    return deps.buildCsvResponse({ csv, filename });
  };
}

function toCsv(rows: AlertExportRow[], escape: (_value: string | number) => string): string {
  const header = ["created_at", "source", "event_type", "severity", "status_code", "request_id", "latency_ms", "metadata_json"];
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
      .map(escape)
      .join(",")
  );
  return [header.join(","), ...body].join("\n");
}
