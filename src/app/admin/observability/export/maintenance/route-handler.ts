import {
  authorizeObservabilityExportAccess,
  buildCsvResponse,
  csvEscape,
  parseObservabilityExportRequest,
} from "../../../../../lib/admin/observability-export-core.ts";
import { createMaintenanceExportHandler } from "@/features/admin/observability/maintenance/export/maintenance-export.handler";

export const handleMaintenanceExportRequest = createMaintenanceExportHandler({
  parseExportRequest: parseObservabilityExportRequest,
  authorize: authorizeObservabilityExportAccess,
  buildCsvResponse,
  csvEscape,
});
