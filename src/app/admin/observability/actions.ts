"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { signDiagnosticsPayload } from "@/lib/diagnostics-signature";
import { requireSuperAdminContext } from "@/lib/admin/guards";
import {
  createObservabilityAdminRepository,
  type ObservabilityAdminRepository,
} from "@/lib/domain/observability";
import { ok, fail, type ActionResult } from "@/lib/action-result";

export type SignedLinkInput = {
  preset: string;
  window: string;
  severity: string;
  source: string;
  event_type: string;
  alerts_cursor: string;
  alerts_dir: string;
  alerts_page: string;
  runs_page: string;
  alerts_page_size: string;
  runs_page_size: string;
  export_limit: string;
};

type ObservabilityActionDeps = {
  repository: ObservabilityAdminRepository;
};

function resolveObservabilityDeps(overrides?: Partial<ObservabilityActionDeps>): ObservabilityActionDeps {
  return {
    repository: overrides?.repository ?? createObservabilityAdminRepository(),
  };
}

export async function runMaintenanceNow(deps?: Partial<ObservabilityActionDeps>): Promise<ActionResult<{ message: string }>> {
  try {
    const adminCheck = await requireSuperAdminContext();
    if (!adminCheck.ok) return fail(adminCheck.error);

    const { repository } = resolveObservabilityDeps(deps);
    const { runId, alertsCount, deletedTotal } = await repository.runBackendMaintenanceManual();

    const webhookUrl = process.env.ALERT_WEBHOOK_URL;
    if (alertsCount > 0 && webhookUrl && webhookUrl.startsWith("http")) {
      try {
        const { details } = runId ? await repository.getMaintenanceRunDetails(runId) : { details: null };
        const alerts = details?.alerts ?? [];
        const secret = process.env.ALERT_WEBHOOK_SECRET;
        const body = JSON.stringify({
          source: "doc2share",
          event: "observability_alerts",
          run_id: runId ?? null,
          alerts_count: alertsCount,
          alerts,
          timestamp: new Date().toISOString(),
        });
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          "User-Agent": "Doc2Share-Alerts/1.0",
        };
        if (secret) headers["X-Webhook-Secret"] = secret;
        const res = await fetch(webhookUrl, {
          method: "POST",
          headers,
          body,
          signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) {
          console.warn("Alert webhook failed:", res.status, await res.text().catch(() => ""));
        }
      } catch (webhookErr) {
        console.warn("Alert webhook error:", webhookErr);
      }
    }

    revalidatePath("/admin/observability");
    return ok({ message: `Maintenance hoàn tất. Deleted: ${deletedTotal} rows, Alerts: ${alertsCount}.` });
  } catch (error) {
    console.error("runMaintenanceNow failed:", error);
    return fail("Có lỗi hệ thống khi chạy maintenance.");
  }
}

export async function createSignedDiagnosticsLink(input: SignedLinkInput): Promise<ActionResult<{ message: string; link: string }>> {
  try {
    const adminCheck = await requireSuperAdminContext();
    if (!adminCheck.ok) return fail(adminCheck.error);

    const secret = process.env.DIAGNOSTICS_SHARE_SECRET;
    if (!secret) return fail("Thiếu DIAGNOSTICS_SHARE_SECRET trên server.");

    const normalized = {
      preset: input.preset || "custom",
      window: input.window || "24h",
      severity: input.severity || "all",
      source: input.source || "all",
      event_type: input.event_type || "all",
      alerts_cursor: input.alerts_cursor || "",
      alerts_dir: input.alerts_dir || "next",
      alerts_page: input.alerts_page || "1",
      runs_page: input.runs_page || "1",
      alerts_page_size: input.alerts_page_size || "20",
      runs_page_size: input.runs_page_size || "20",
      export_limit: input.export_limit || "2000",
    };
    const shareExp = String(Math.floor(Date.now() / 1000) + 2 * 60 * 60);
    const signature = signDiagnosticsPayload({ ...normalized, share_exp: shareExp }, secret);

    const h = headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    const proto = h.get("x-forwarded-proto") ?? "https";
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (host ? `${proto}://${host}` : "");
    if (!baseUrl) return fail("Không xác định được base URL để tạo link.");

    const qs = new URLSearchParams({
      ...normalized,
      share_exp: shareExp,
      share_sig: signature,
    });
    const hash = normalized.preset === "custom" ? "" : "#alerts-panel";
    const link = `${baseUrl}/admin/observability?${qs.toString()}${hash}`;
    return ok({ message: "Đã tạo signed link.", link });
  } catch (error) {
    console.error("createSignedDiagnosticsLink failed:", error);
    return fail("Không thể tạo signed diagnostics link.");
  }
}
