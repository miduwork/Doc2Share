import {
  authorizeObservabilityExportAccess,
  buildCsvResponse,
  csvEscape,
  parseObservabilityExportRequest,
} from "../../../../../lib/admin/observability-export-core.ts";
import { createAlertsExportHandler } from "@/features/admin/observability/alerts/export/alerts-export.handler";

export const handleAlertsExportRequest = createAlertsExportHandler({
  parseExportRequest: parseObservabilityExportRequest,
  authorize: authorizeObservabilityExportAccess,
  buildCsvResponse,
  csvEscape,
});
