"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdminContext } from "@/lib/admin/guards";
import { ok, fail, type ActionResult } from "@/lib/action-result";
import { runObservabilityMaintenanceCommand } from "@/lib/admin/observability-maintenance.command";
import { resolveObservabilityDeps, type ObservabilityActionDeps } from "./action-shared";

export async function runMaintenanceNow(deps?: Partial<ObservabilityActionDeps>): Promise<ActionResult<{ message: string }>> {
  try {
    const adminCheck = await requireSuperAdminContext();
    if (!adminCheck.ok) return fail(adminCheck.error);

    const { repository } = resolveObservabilityDeps(deps);
    const result = await runObservabilityMaintenanceCommand({
      repository,
      revalidate: (path) => revalidatePath(path),
      readConfig: () => ({
        webhookUrl: process.env.ALERT_WEBHOOK_URL,
        webhookSecret: process.env.ALERT_WEBHOOK_SECRET,
      }),
      postWebhook: async ({ url, secret, body }) => {
        const webhookHeaders: Record<string, string> = {
          "Content-Type": "application/json",
          "User-Agent": "Doc2Share-Alerts/1.0",
        };
        if (secret) webhookHeaders["X-Webhook-Secret"] = secret;
        const res = await fetch(url, {
          method: "POST",
          headers: webhookHeaders,
          body,
          signal: AbortSignal.timeout(15000),
        });
        return { ok: res.ok, responseText: await res.text().catch(() => "") };
      },
      nowIso: () => new Date().toISOString(),
      logWarn: (...args) => console.warn(...args),
    });

    return ok({ message: result.message });
  } catch (error) {
    console.error("runMaintenanceNow failed:", error);
    return fail("Có lỗi hệ thống khi chạy maintenance.");
  }
}
