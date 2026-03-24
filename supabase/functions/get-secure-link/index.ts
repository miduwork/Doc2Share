// get-secure-link (Backend Overview: get-secure-document)
// Auth → session adapter (Edge) → Validation (shared secure-access-core) → Signing → Logging
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  computeIsAdminCanReadAny,
  computeIsSuperAdmin,
  evaluateDeviceGate,
  evaluateDocumentPermission,
  isProfileActive,
  parsePositiveIntEnv,
  SECURE_ACCESS_DEFAULTS,
  wouldExceedHighFreqDistinctDocs,
  wouldExceedHourlySuccessLimit,
} from "./secure-access-core.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function rateLimitViewsPerHour(): number {
  return parsePositiveIntEnv(Deno.env.get("RATE_LIMIT_VIEWS_PER_HOUR"), SECURE_ACCESS_DEFAULTS.RATE_LIMIT_VIEWS_PER_HOUR);
}

function highFreqDocs10Min(): number {
  return parsePositiveIntEnv(
    Deno.env.get("RATE_LIMIT_HIGH_FREQ_DOCS_10MIN"),
    SECURE_ACCESS_DEFAULTS.HIGH_FREQ_DOCS_IN_10MIN
  );
}

function bruteBlocked10Min(): number {
  return parsePositiveIntEnv(
    Deno.env.get("BRUTE_FORCE_BLOCKED_IN_10MIN"),
    SECURE_ACCESS_DEFAULTS.BRUTE_FORCE_BLOCKED_IN_10MIN
  );
}

serve(async (req) => {
  const startedAt = Date.now();
  const requestId = req.headers.get("x-request-id") || crypto.randomUUID();

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { ...corsHeaders, "x-request-id": requestId } });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Unauthorized", request_id: requestId }, 401, requestId);
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return jsonResponse({ error: "Unauthorized", request_id: requestId }, 401, requestId);
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_active, role, admin_role, banned_until")
      .eq("id", user.id)
      .maybeSingle();
    if (!isProfileActive(profile)) {
      await insertSecurityLog(supabase, user.id, "file_access", "high", req, undefined, { reason: "inactive_profile" }, requestId);
      await logObservability(supabase, {
        requestId,
        source: "edge.get_secure_link",
        eventType: "blocked",
        severity: "error",
        statusCode: 403,
        latencyMs: Date.now() - startedAt,
        userId: user.id,
        metadata: { reason: "inactive_profile" },
      });
      return jsonResponse({ error: "Tài khoản đã bị khóa.", request_id: requestId }, 403, requestId);
    }

    const body = await req.json().catch(() => ({}));
    const { document_id, device_id } = body;

    if (!document_id || !device_id) {
      return jsonResponse({ error: "document_id and device_id are required", request_id: requestId }, 400, requestId);
    }

    let { data: activeSession } = await supabase
      .from("active_sessions")
      .select("session_id, device_id, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!activeSession) {
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || null;
      const userAgent = req.headers.get("user-agent") ?? null;
      const newSessionId = crypto.randomUUID();
      const { error: insertErr } = await supabase.from("active_sessions").insert({
        session_id: newSessionId,
        user_id: user.id,
        ip_address: ip,
        user_agent: userAgent,
        device_id: device_id,
      });
      if (!insertErr) {
        activeSession = { session_id: newSessionId, device_id: device_id, created_at: new Date().toISOString() };
      } else {
        console.error("get-secure-link: active_sessions insert failed", insertErr.message, insertErr.code);
        activeSession = { session_id: newSessionId, device_id: device_id, created_at: new Date().toISOString() };
      }
    }

    if (!activeSession) {
      await logAccess(supabase, user.id, document_id, "get_secure_link", "blocked", req, device_id, "no_active_session", requestId, Date.now() - startedAt);
      await insertSecurityLog(
        supabase,
        user.id,
        "file_access",
        "medium",
        req,
        device_id,
        { reason: "no_active_session" },
        requestId
      );
      await logObservability(supabase, {
        requestId, source: "edge.get_secure_link", eventType: "blocked", severity: "warn",
        statusCode: 401, latencyMs: Date.now() - startedAt, userId: user.id, documentId: document_id, deviceId: device_id,
        metadata: { reason: "no_active_session" },
      });
      return jsonResponse({
        error: "Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.",
        reason: "no_active_session",
        request_id: requestId,
      }, 401, requestId);
    }

    const isSuperAdmin = computeIsSuperAdmin(profile);
    if (activeSession.device_id && activeSession.device_id !== device_id) {
      if (isSuperAdmin) {
        activeSession = { ...activeSession, device_id: device_id };
      } else {
        await supabase.from("active_sessions").update({ device_id: device_id }).eq("user_id", user.id);
        activeSession = { ...activeSession, device_id: device_id };
      }
    }

    const { data: devices } = await supabase
      .from("device_logs")
      .select("device_id")
      .eq("user_id", user.id);

    const deviceIds = (devices ?? []).map((d: { device_id: string }) => d.device_id);
    const deviceGate = evaluateDeviceGate(deviceIds, device_id, isSuperAdmin);
    if (!deviceGate.ok) {
      await logAccess(supabase, user.id, document_id, "get_secure_link", "blocked", req, device_id, "device_limit", requestId, Date.now() - startedAt);
      await logObservability(supabase, {
        requestId, source: "edge.get_secure_link", eventType: "blocked", severity: "warn",
        statusCode: 403, latencyMs: Date.now() - startedAt, userId: user.id, documentId: document_id, deviceId: device_id,
        metadata: { reason: "device_limit" },
      });
      return jsonResponse({ error: "Vượt quá giới hạn 2 thiết bị.", request_id: requestId }, 403, requestId);
    }
    const isNewDevice = !deviceIds.some((id) => id === device_id);
    if (isNewDevice) {
      await supabase.from("device_logs").upsert(
        {
          user_id: user.id,
          device_id,
          device_info: { user_agent: req.headers.get("user-agent") ?? "" },
          last_login: new Date().toISOString(),
        },
        { onConflict: "user_id,device_id" }
      );
    }

    const isAdminCanReadAny = computeIsAdminCanReadAny(profile);
    let permission: { id: string; expires_at: string | null } | null = null;
    if (!isAdminCanReadAny) {
      const { data: perm } = await supabase
        .from("permissions")
        .select("id, expires_at")
        .eq("user_id", user.id)
        .eq("document_id", document_id)
        .maybeSingle();
      permission = perm ?? null;
    }

    const permGate = evaluateDocumentPermission(isAdminCanReadAny, permission);
    if (!permGate.ok) {
      if (permGate.reason === "no_permission") {
        await logAccess(supabase, user.id, document_id, "get_secure_link", "blocked", req, device_id, "no_permission", requestId, Date.now() - startedAt);
        const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
        const { count: bruteCount } = await supabase
          .from("access_logs")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("action", "get_secure_link")
          .eq("status", "blocked")
          .gte("created_at", tenMinAgo);
        const severity = (bruteCount != null && bruteCount >= bruteBlocked10Min()) ? "high" : "medium";
        await insertSecurityLog(
          supabase,
          user.id,
          "file_access",
          severity,
          req,
          device_id,
          { reason: "permissions_bypass", document_id },
          requestId
        );
        await logObservability(supabase, {
          requestId, source: "edge.get_secure_link", eventType: "blocked", severity: "warn",
          statusCode: 403, latencyMs: Date.now() - startedAt, userId: user.id, documentId: document_id, deviceId: device_id,
          metadata: { reason: "no_permission" },
        });
        return jsonResponse({ error: "Bạn chưa mua tài liệu này.", request_id: requestId }, 403, requestId);
      }
      await logAccess(supabase, user.id, document_id, "get_secure_link", "blocked", req, device_id, "expired", requestId, Date.now() - startedAt);
      return jsonResponse({ error: "Quyền xem tài liệu đã hết hạn.", request_id: requestId }, 403, requestId);
    }

    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
    const { count: countHour } = await supabase
      .from("access_logs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("action", "get_secure_link")
      .eq("status", "success")
      .gte("created_at", oneHourAgo);
    if (wouldExceedHourlySuccessLimit(countHour ?? 0, rateLimitViewsPerHour())) {
      await logAccess(supabase, user.id, document_id, "get_secure_link", "blocked", req, device_id, "rate_limit", requestId, Date.now() - startedAt);
      await insertSecurityLog(supabase, user.id, "file_access", "medium", req, device_id, { reason: "rate_limit" }, requestId);
      return jsonResponse({ error: "Thao tác quá nhanh, vui lòng thử lại sau.", request_id: requestId }, 429, requestId);
    }

    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: recentSuccess } = await supabase
      .from("access_logs")
      .select("document_id")
      .eq("user_id", user.id)
      .eq("action", "get_secure_link")
      .eq("status", "success")
      .gte("created_at", tenMinAgo);
    const recentIds = (recentSuccess ?? []).map((r: { document_id: string | null }) => r.document_id);
    if (wouldExceedHighFreqDistinctDocs(recentIds, document_id, highFreqDocs10Min())) {
      await logAccess(supabase, user.id, document_id, "get_secure_link", "blocked", req, device_id, "high_frequency", requestId, Date.now() - startedAt);
      await insertSecurityLog(
        supabase,
        user.id,
        "file_access",
        "medium",
        req,
        device_id,
        { reason: "high_frequency" },
        requestId
      );
      return jsonResponse({ error: "Thao tác quá nhanh, vui lòng thử lại sau.", request_id: requestId }, 429, requestId);
    }

    const { data: doc, error: docError } = await supabase
      .from("documents")
      .select("file_path")
      .eq("id", document_id)
      .single();

    if (docError || !doc?.file_path) {
      return jsonResponse({ error: "Tài liệu không tồn tại.", request_id: requestId }, 404, requestId);
    }

    const { data: signedData, error: signError } = await supabase.storage
      .from("private_documents")
      .createSignedUrl(doc.file_path, SECURE_ACCESS_DEFAULTS.SIGNED_URL_EXPIRY_SECONDS);

    if (signError) {
      console.error("Signed URL error:", signError);
      await logObservability(supabase, {
        requestId, source: "edge.get_secure_link", eventType: "error", severity: "error",
        statusCode: 500, latencyMs: Date.now() - startedAt, userId: user.id, documentId: document_id, deviceId: device_id,
        metadata: { reason: "signed_url_error", message: signError.message },
      });
      return jsonResponse({ error: "Không thể tạo link xem tài liệu.", request_id: requestId }, 500, requestId);
    }

    await logAccess(supabase, user.id, document_id, "get_secure_link", "success", req, device_id, undefined, requestId, Date.now() - startedAt);
    await logObservability(supabase, {
      requestId, source: "edge.get_secure_link", eventType: "success", severity: "info",
      statusCode: 200, latencyMs: Date.now() - startedAt, userId: user.id, documentId: document_id, deviceId: device_id,
    });

    const { data: usage } = await supabase
      .from("usage_stats")
      .select("view_count")
      .eq("user_id", user.id)
      .eq("document_id", document_id)
      .maybeSingle();
    if (usage) {
      await supabase
        .from("usage_stats")
        .update({ view_count: (usage.view_count || 0) + 1, last_view_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .eq("document_id", document_id);
    } else {
      await supabase.from("usage_stats").insert({
        user_id: user.id,
        document_id,
        view_count: 1,
        last_view_at: new Date().toISOString(),
      });
    }

    return jsonResponse({ url: signedData.signedUrl, request_id: requestId }, 200, requestId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return jsonResponse({ error: message, request_id: requestId }, 400, requestId);
  }
});

function jsonResponse(body: object, status: number, requestId?: string) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...(requestId ? { "x-request-id": requestId } : {}) },
  });
}

const ipFromReq = (req: Request) =>
  req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";

async function logAccess(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  documentId: string,
  action: string,
  status: string,
  req: Request,
  deviceId?: string,
  reason?: string,
  requestId?: string,
  latencyMs?: number
) {
  await supabase.from("access_logs").insert({
    user_id: userId,
    document_id: documentId,
    action,
    status,
    ip_address: ipFromReq(req),
    device_id: deviceId ?? null,
    correlation_id: requestId ?? null,
    metadata: {
      ...(reason ? { reason } : {}),
      ...(requestId ? { request_id: requestId, correlation_id: requestId } : {}),
      ...(latencyMs != null ? { latency_ms: latencyMs } : {}),
    },
  });
}

async function insertSecurityLog(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  eventType: "login" | "file_access" | "multiple_devices" | "ip_change" | "print_attempt",
  severity: "low" | "medium" | "high",
  req: Request,
  deviceId?: string,
  metadata?: Record<string, unknown>,
  correlationId?: string
) {
  await supabase.from("security_logs").insert({
    user_id: userId,
    event_type: eventType,
    severity,
    ip_address: ipFromReq(req),
    user_agent: req.headers.get("user-agent") ?? null,
    device_id: deviceId ?? null,
    correlation_id: correlationId ?? null,
    metadata: {
      ...(metadata ?? {}),
      ...(correlationId ? { correlation_id: correlationId } : {}),
    },
  });
}

async function logObservability(
  supabase: ReturnType<typeof createClient>,
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
