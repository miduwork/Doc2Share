import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logObservabilityEvent } from "@/lib/observability/log-observability-event";
import { isValidUuid } from "@/lib/uuid";

const EVENT_WATERMARK_DEGRADED = "watermark_degraded_fallback";
const EVENT_SUSPICIOUS_BEHAVIOR = "suspicious_behavior";

// In-memory rate limiting to prevent score inflation abuse.
// Keyed by user_id (not IP) to avoid bypass by changing x-forwarded-for.
// NOTE: Rate limiting is per Node instance; we still keep it lightweight and eviction-based.
const rateLimits = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_EVENTS_PER_WINDOW = 10;

export async function POST(req: Request) {
  const startedAt = Date.now();
  const requestId = crypto.randomUUID();

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      event_type?: string;
      document_id?: string;
      device_id?: string;
      metadata?: Record<string, any>;
    };

    const allowedEvents = [EVENT_WATERMARK_DEGRADED, EVENT_SUSPICIOUS_BEHAVIOR];
    if (!body.event_type || !allowedEvents.includes(body.event_type)) {
      return NextResponse.json({ error: "Unsupported event_type" }, { status: 400 });
    }

    if (!body.document_id || !isValidUuid(body.document_id)) {
      return NextResponse.json({ error: "document_id invalid" }, { status: 400 });
    }

    if (!body.device_id || typeof body.device_id !== "string") {
      return NextResponse.json({ error: "device_id required" }, { status: 400 });
    }

    // Throttling: prevent abuse of the observability API
    const ip = req.headers.get("x-forwarded-for") || "unknown";
    const now = Date.now();

    // Eviction: remove expired keys to avoid Map growing over time.
    // Avoid `for..of rateLimits.entries()` to keep TS compatible with lower targets.
    const keysToDelete: string[] = [];
    rateLimits.forEach((v, key) => {
      if (now > v.resetAt) keysToDelete.push(key);
    });
    for (let i = 0; i < keysToDelete.length; i += 1) {
      rateLimits.delete(keysToDelete[i]);
    }

    // Key by user_id so changing IP headers can't bypass.
    const userKey = String(user.id);
    const rateLimit = rateLimits.get(userKey) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    if (now > rateLimit.resetAt) {
      rateLimit.count = 1;
      rateLimit.resetAt = now + RATE_LIMIT_WINDOW_MS;
    } else {
      rateLimit.count++;
    }
    rateLimits.set(userKey, rateLimit);

    // Hard cap: if something goes wrong and we still keep growing (rare), prune oldest buckets.
    if (rateLimits.size > 2000) {
      const buckets: Array<{ key: string; resetAt: number }> = [];
      rateLimits.forEach((v, key) => {
        buckets.push({ key, resetAt: v.resetAt });
      });
      buckets.sort((a, b) => a.resetAt - b.resetAt);
      const pruneCount = rateLimits.size - 1500;
      for (let i = 0; i < pruneCount; i += 1) {
        rateLimits.delete(buckets[i].key);
      }
    }

    if (rateLimit.count > MAX_EVENTS_PER_WINDOW) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    // Phân tích rủi ro nếu là hành vi đáng ngờ
    if (body.event_type === EVENT_SUSPICIOUS_BEHAVIOR) {
      let riskIncrement = 0.5; // Mặc định mỗi lần phát hiện tăng 0.5
      const anomalyType = body.metadata?.anomaly_type;

      if (anomalyType === "robotic_regularity") riskIncrement = 2.0; // Pattern bot rất rõ ràng
      if (anomalyType === "high_frequency_flipping") riskIncrement = 1.0;

      // Update risk_score trong profile (Trigger DB sẽ tự khóa nếu >= 8.0)
      const { error: updateError } = await supabase.rpc("increment_profile_risk_score", {
        p_user_id: user.id,
        p_increment: riskIncrement,
        p_reason: `Phát hiện hành vi: ${anomalyType}`
      });

      if (updateError) console.error("Failed to increment risk score", updateError);

      // Log into security_logs for forensic tracking (fire-and-forget)
      void supabase.from("security_logs").insert({
        user_id: user.id,
        event_type: "suspicious_reader_behavior",
        severity: riskIncrement >= 1.0 ? "high" : "medium",
        ip_address: ip,
        device_id: body.device_id,
        metadata: {
          anomaly_type: anomalyType,
          risk_increment: riskIncrement,
          document_id: body.document_id,
        }
      });
    }

    await logObservabilityEvent({
      requestId,
      source: "next.reader",
      eventType: body.event_type,
      severity: body.event_type === EVENT_SUSPICIOUS_BEHAVIOR ? "error" : "warn",
      statusCode: 200,
      latencyMs: Date.now() - startedAt,
      userId: user.id,
      documentId: body.document_id,
      deviceId: body.device_id,
      metadata: {
        ...(body.metadata ?? {}),
        event_context: body.event_type === EVENT_WATERMARK_DEGRADED
          ? "secure_pdf_missing_watermark_headers"
          : "behavioral_anomaly_detected",
      },
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("reader-observability:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
