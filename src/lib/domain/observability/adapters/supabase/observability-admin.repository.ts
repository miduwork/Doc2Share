import "server-only";

import type { ObservabilityAdminRepository } from "@/lib/domain/observability/ports";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

type MaintenanceRow = {
  run_id?: string;
  alerts_count?: number;
  access_deleted?: number;
  security_deleted?: number;
  observability_deleted?: number;
  webhook_deleted?: number;
} | null;

export function createSupabaseObservabilityAdminRepository(): ObservabilityAdminRepository {
  const serviceRole = createServiceRoleClient();

  return {
    async runBackendMaintenanceManual() {
      const { data, error } = await serviceRole.rpc("run_backend_maintenance", { p_triggered_by: "manual" });
      if (error) throw new Error(error.message);

      const row = (Array.isArray(data) ? data[0] : data) as MaintenanceRow;
      const runId = row?.run_id ?? null;
      const alertsCount = Number(row?.alerts_count ?? 0);
      const deletedTotal =
        Number(row?.access_deleted ?? 0) +
        Number(row?.security_deleted ?? 0) +
        Number(row?.observability_deleted ?? 0) +
        Number(row?.webhook_deleted ?? 0);

      return { runId, alertsCount, deletedTotal };
    },
    async getMaintenanceRunDetails(runId: string) {
      const { data, error } = await serviceRole
        .from("backend_maintenance_runs")
        .select("details")
        .eq("id", runId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      const details = (data as { details?: { alerts?: unknown[] } } | null)?.details ?? null;
      return { details };
    },
  };
}
