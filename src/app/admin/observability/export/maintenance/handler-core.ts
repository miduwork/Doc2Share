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

export type MaintenanceExportDeps = {
  parseExportRequest: (_reqUrl: string) => {
    payload: { window: string };
    shareSig: string;
    limit: number;
    sinceIso: string | null;
  };
  authorize: (_args: { supabase: any; payload: any; shareSig: string }) => Promise<Response | null>;
  buildCsvResponse: (_args: { csv: string; filename: string }) => Response;
  csvEscape: (_value: string | number) => string;
};

export function createMaintenanceExportHandler(deps: MaintenanceExportDeps) {
  return async function handleMaintenanceExportRequest(req: Request, supabase: any): Promise<Response> {
    const exportRequest = deps.parseExportRequest(req.url);
    const authError = await deps.authorize({
      supabase,
      payload: exportRequest.payload,
      shareSig: exportRequest.shareSig,
    });
    if (authError) return authError;

    let query = supabase
      .from("backend_maintenance_runs")
      .select(
        "id, started_at, finished_at, triggered_by, success, alerts_count, access_deleted, security_deleted, observability_deleted, webhook_deleted"
      )
      .order("started_at", { ascending: false })
      .limit(exportRequest.limit);
    if (exportRequest.sinceIso) query = query.gte("started_at", exportRequest.sinceIso);

    const { data, error } = await query;
    if (error) return new Response(`Query failed: ${error.message}`, { status: 500 });

    const rows = (data as RunRow[] | null) ?? [];
    const csv = toCsv(rows, deps.csvEscape);
    const filename = `maintenance-runs-${exportRequest.payload.window}-${new Date().toISOString().slice(0, 10)}.csv`;
    return deps.buildCsvResponse({ csv, filename });
  };
}

function toCsv(rows: RunRow[], escape: (_value: string | number) => string): string {
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
      .map(escape)
      .join(",")
  );
  return [header.join(","), ...body].join("\n");
}
