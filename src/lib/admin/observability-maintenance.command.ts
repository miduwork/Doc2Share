import type { ObservabilityAdminRepository } from "@/lib/domain/observability";

export type RunObservabilityMaintenanceDeps = {
  repository: ObservabilityAdminRepository;
  revalidate: (_path: string) => void | Promise<void>;
  readConfig: () => { webhookUrl?: string; webhookSecret?: string };
  postWebhook: (_input: { url: string; secret?: string; body: string }) => Promise<{ ok: boolean; responseText?: string }>;
  nowIso: () => string;
  logWarn: (..._args: unknown[]) => void;
};

export type RunObservabilityMaintenanceResult = {
  message: string;
};

export async function runObservabilityMaintenanceCommand(
  deps: RunObservabilityMaintenanceDeps
): Promise<RunObservabilityMaintenanceResult> {
  const { runId, alertsCount, deletedTotal } = await deps.repository.runBackendMaintenanceManual();
  const { webhookUrl, webhookSecret } = deps.readConfig();

  if (alertsCount > 0 && webhookUrl && webhookUrl.startsWith("http")) {
    try {
      const { details } = runId ? await deps.repository.getMaintenanceRunDetails(runId) : { details: null };
      const alerts = details?.alerts ?? [];
      const body = JSON.stringify({
        source: "doc2share",
        event: "observability_alerts",
        run_id: runId ?? null,
        alerts_count: alertsCount,
        alerts,
        timestamp: deps.nowIso(),
      });
      const webhookRes = await deps.postWebhook({ url: webhookUrl, secret: webhookSecret, body });
      if (!webhookRes.ok) {
        deps.logWarn("Alert webhook failed:", webhookRes.responseText ?? "");
      }
    } catch (webhookErr) {
      deps.logWarn("Alert webhook error:", webhookErr);
    }
  }

  await deps.revalidate("/admin/observability");
  return {
    message: `Maintenance hoàn tất. Deleted: ${deletedTotal} rows, Alerts: ${alertsCount}.`,
  };
}
