// AUTO-GENERATED from src/lib/secure-access/secure-access-db-helpers.ts — do not edit here. Run: node scripts/sync-secure-access-db.mjs

/**
 * Shared database helpers for secure document access.
 * Co-maintained for Next.js (Node) and Supabase Edge Functions (Deno).
 * 
 * Rules:
 * 1. No environment-specific global imports (e.g. no "next/server").
 * 2. Use generic types for Supabase client.
 */

/** Helper to extract IP from common headers. */
export const ipFromReq = (req: Request) =>
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";

/** Insert or update device_logs - atomic logic shared across environments. */
export async function persistDeviceLogRowShared(
    supabase: any,
    row: {
        user_id: string;
        device_id: string;
        device_info: Record<string, unknown>;
        last_login: string;
    }
) {
    const { data: existing } = await supabase
        .from("device_logs")
        .select("id")
        .eq("user_id", row.user_id)
        .eq("device_id", row.device_id)
        .maybeSingle();

    if (existing?.id) {
        return supabase
            .from("device_logs")
            .update({ device_info: row.device_info, last_login: row.last_login })
            .eq("id", existing.id);
    }
    return supabase.from("device_logs").insert(row);
}

/** Log document access attempt. */
export async function logAccessShared(
    supabase: any,
    params: {
        userId: string;
        documentId: string;
        action: string;
        status: string;
        req: Request;
        deviceId?: string;
        reason?: string;
        requestId?: string;
        latencyMs?: number;
    }
) {
    await supabase.from("access_logs").insert({
        user_id: params.userId,
        document_id: params.documentId,
        action: params.action,
        status: params.status,
        ip_address: ipFromReq(params.req),
        device_id: params.deviceId ?? null,
        correlation_id: params.requestId ?? null,
        metadata: {
            ...(params.reason ? { reason: params.reason } : {}),
            ...(params.requestId ? { request_id: params.requestId, correlation_id: params.requestId } : {}),
            ...(params.latencyMs != null ? { latency_ms: params.latencyMs } : {}),
        },
    });
}

/** Log high-level security event. */
export async function insertSecurityLogShared(
    supabase: any,
    params: {
        userId: string;
        eventType: "login" | "file_access" | "multiple_devices" | "ip_change" | "print_attempt";
        severity: "low" | "medium" | "high";
        req: Request;
        deviceId?: string;
        metadata?: Record<string, unknown>;
        correlationId?: string;
    }
) {
    await supabase.from("security_logs").insert({
        user_id: params.userId,
        event_type: params.eventType,
        severity: params.severity,
        ip_address: ipFromReq(params.req),
        user_agent: params.req.headers.get("user-agent") ?? null,
        device_id: params.deviceId ?? null,
        correlation_id: params.correlationId ?? null,
        metadata: {
            ...(params.metadata ?? {}),
            ...(params.correlationId ? { correlation_id: params.correlationId } : {}),
        },
    });
}

/** Log observability events for system monitoring. */
export async function logObservabilityShared(
    supabase: any,
    params: {
        requestId: string;
        source: string;
        eventType: string;
        severity: "info" | "warn" | "error";
        statusCode: number;
        latencyMs: number;
        userId?: string;
        documentId?: string;
        deviceId?: string;
        metadata?: Record<string, unknown>;
    }
) {
    try {
        await supabase.from("observability_events").insert({
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
        // observability should not break primary flow
    }
}
