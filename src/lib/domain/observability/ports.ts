import "server-only";

export interface ObservabilityAdminRepository {
  runBackendMaintenanceManual(): Promise<{ runId: string | null; alertsCount: number; deletedTotal: number }>;
  getMaintenanceRunDetails(_runId: string): Promise<{ details: { alerts?: unknown[] } | null }>;
}
