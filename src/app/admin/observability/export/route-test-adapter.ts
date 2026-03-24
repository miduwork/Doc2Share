import { createAlertsExportHandler } from "./alerts/handler-core.ts";
import { createMaintenanceExportHandler } from "./maintenance/handler-core.ts";

function csvEscape(value: string | number): string {
  const raw = String(value ?? "");
  if (raw.includes(",") || raw.includes('"') || raw.includes("\n")) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

function buildCsvResponse({ csv, filename }: { csv: string; filename: string }): Response {
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

export function createRouteTestAdapter(args: {
  parseExportRequest: (_reqUrl: string) => any;
  authorize: (_input: { supabase: any; payload: any; shareSig: string }) => Promise<Response | null>;
}) {
  return {
    alerts: createAlertsExportHandler({
      parseExportRequest: args.parseExportRequest,
      authorize: args.authorize,
      buildCsvResponse,
      csvEscape,
    }),
    maintenance: createMaintenanceExportHandler({
      parseExportRequest: args.parseExportRequest,
      authorize: args.authorize,
      buildCsvResponse,
      csvEscape,
    }),
  };
}
