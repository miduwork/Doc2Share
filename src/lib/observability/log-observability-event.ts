import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export type ObservabilitySeverity = "info" | "warn" | "error";

export async function logObservabilityEvent(params: {
  requestId: string;
  source: string;
  eventType: string;
  severity: ObservabilitySeverity;
  statusCode: number;
  latencyMs: number;
  userId?: string | null;
  documentId?: string | null;
  deviceId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const service = createServiceRoleClient();
    await service.from("observability_events").insert({
      request_id: params.requestId,
      source: params.source,
      event_type: params.eventType,
      severity: params.severity,
      user_id: params.userId ?? null,
      document_id: params.documentId ?? null,
      device_id: params.deviceId ?? null,
      status_code: params.statusCode,
      latency_ms: params.latencyMs,
      metadata: params.metadata ?? {},
    });
  } catch {
    // observability must not break primary flow
  }
}
