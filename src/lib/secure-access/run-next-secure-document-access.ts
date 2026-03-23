/**
 * Shared Next.js secure-access helper for /api/secure-pdf and /api/secure-link.
 * Keep this aligned with Edge handler differences documented in docs/SECURE-ACCESS-SYNC.md.
 */
import { NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { ACTION_SECURE_PDF, logSecurePdfAccess } from "@/lib/access-log";
import { isValidUuid } from "@/lib/uuid";
import {
  computeIsAdminCanReadAny,
  computeIsSuperAdmin,
  evaluateDeviceGate,
  evaluateDocumentPermission,
  evaluateSessionDevice,
  isProfileActive,
  parsePositiveIntEnv,
  SECURE_ACCESS_DEFAULTS,
  wouldExceedHighFreqDistinctDocs,
  wouldExceedHourlySuccessLimit,
} from "@/lib/secure-access/secure-access-core";

const RATE_LIMIT_VIEWS_PER_HOUR = parsePositiveIntEnv(
  process.env.RATE_LIMIT_VIEWS_PER_HOUR,
  SECURE_ACCESS_DEFAULTS.RATE_LIMIT_VIEWS_PER_HOUR
);
const RATE_LIMIT_PER_IP_PER_HOUR = parsePositiveIntEnv(
  process.env.RATE_LIMIT_PER_IP_PER_HOUR,
  SECURE_ACCESS_DEFAULTS.RATE_LIMIT_PER_IP_PER_HOUR
);
const HIGH_FREQ_DOCS_IN_10MIN = parsePositiveIntEnv(
  process.env.RATE_LIMIT_HIGH_FREQ_DOCS_10MIN,
  SECURE_ACCESS_DEFAULTS.HIGH_FREQ_DOCS_IN_10MIN
);
const BRUTE_FORCE_BLOCKED_IN_10MIN = parsePositiveIntEnv(
  process.env.BRUTE_FORCE_BLOCKED_IN_10MIN,
  SECURE_ACCESS_DEFAULTS.BRUTE_FORCE_BLOCKED_IN_10MIN
);

export const MSG_429_TOO_MANY_REQUESTS = "Thao tác quá nhiều. Vui lòng thử lại sau.";
export const MSG_429_BRUTE = "Quá nhiều lần truy cập bị từ chối. Vui lòng thử lại sau 10 phút.";
export const RETRY_AFTER_10MIN = 600;
export const RETRY_AFTER_1H = 3600;

export function getClientIpFromRequest(req: Request): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first ?? req.headers.get("x-real-ip") ?? null;
}

export function isValidDocumentId(value: string): boolean {
  return isValidUuid(value);
}

export type RunNextSecureDocumentAccessParams = {
  req: Request;
  supabase: SupabaseClient;
  requestId: string;
  startedAt: number;
};

type SecureAccessContext = {
  user: User;
  supabase: SupabaseClient;
  service: SupabaseClient;
  documentId: string;
  deviceId: string;
  ip: string | null;
  requestId: string;
  startedAt: number;
  filePath: string;
  logBlocked: (_reason: string, _res: NextResponse, _docId?: string | null) => NextResponse;
  logSuccess: () => Promise<void>;
};

export type RunNextSecureDocumentAccessResult =
  | { ok: true; ctx: SecureAccessContext }
  | { ok: false; response: NextResponse };

export async function runNextSecureDocumentAccess({
  req,
  supabase,
  requestId,
  startedAt,
}: RunNextSecureDocumentAccessParams): Promise<RunNextSecureDocumentAccessResult> {
  const ip = getClientIpFromRequest(req);
  const service = createServiceRoleClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const body = await req.json().catch(() => ({}));
  const documentId = body?.document_id;
  const deviceId = body?.device_id;
  if (!documentId) {
    return { ok: false, response: NextResponse.json({ error: "document_id is required" }, { status: 400 }) };
  }
  if (!deviceId) {
    return { ok: false, response: NextResponse.json({ error: "device_id is required" }, { status: 400 }) };
  }
  if (!isValidDocumentId(documentId)) {
    return { ok: false, response: NextResponse.json({ error: "document_id không hợp lệ." }, { status: 400 }) };
  }

  const logBlocked = (reason: string, res: NextResponse, docId: string | null = documentId) => {
    logSecurePdfAccess({
      userId: user.id,
      documentId: docId,
      status: "blocked",
      ipAddress: ip,
      deviceId,
      reason,
      requestId,
      latencyMs: Date.now() - startedAt,
    }).catch(() => {});
    return res;
  };

  const tenMinAgoBrute = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { count: blockedCount } = await service
    .from("access_logs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("action", ACTION_SECURE_PDF)
    .eq("status", "blocked")
    .gte("created_at", tenMinAgoBrute);
  if (blockedCount != null && blockedCount >= BRUTE_FORCE_BLOCKED_IN_10MIN) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: MSG_429_BRUTE, code: "RATE_LIMIT", retry_after_seconds: RETRY_AFTER_10MIN },
        { status: 429, headers: { "Retry-After": String(RETRY_AFTER_10MIN) } }
      ),
    };
  }

  if (ip) {
    const oneHourAgoIp = new Date(Date.now() - 3600000).toISOString();
    const { count: countByIp } = await service
      .from("access_logs")
      .select("id", { count: "exact", head: true })
      .eq("action", ACTION_SECURE_PDF)
      .eq("ip_address", ip)
      .gte("created_at", oneHourAgoIp);
    if (countByIp != null && countByIp >= RATE_LIMIT_PER_IP_PER_HOUR) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: MSG_429_TOO_MANY_REQUESTS, code: "RATE_LIMIT_IP", retry_after_seconds: RETRY_AFTER_1H },
          { status: 429, headers: { "Retry-After": String(RETRY_AFTER_1H) } }
        ),
      };
    }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, admin_role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (!isProfileActive(profile)) {
    return {
      ok: false,
      response: logBlocked("inactive_profile", NextResponse.json({ error: "Tài khoản đã bị khóa." }, { status: 403 })),
    };
  }

  const isSuperAdmin = computeIsSuperAdmin(profile);
  const isAdminCanReadAny = computeIsAdminCanReadAny(profile);

  if (!isSuperAdmin) {
    const [{ data: devices }, { data: activeSession }] = await Promise.all([
      supabase.from("device_logs").select("device_id").eq("user_id", user.id),
      service
        .from("active_sessions")
        .select("device_id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const deviceIds = (devices ?? []).map((d: { device_id: string }) => d.device_id);
    const deviceGate = evaluateDeviceGate(deviceIds, deviceId, isSuperAdmin);
    if (!deviceGate.ok) {
      return {
        ok: false,
        response: logBlocked(
          "device_limit",
          NextResponse.json(
            { error: "Vượt quá giới hạn 2 thiết bị. Vui lòng gỡ thiết bị cũ trong Tủ sách." },
            { status: 403 }
          )
        ),
      };
    }
    const isNewDevice = !deviceIds.some((id) => id === deviceId);
    if (isNewDevice) {
      await supabase.from("device_logs").upsert(
        {
          user_id: user.id,
          device_id: deviceId,
          device_info: {},
          last_login: new Date().toISOString(),
        },
        { onConflict: "user_id,device_id" }
      );
    }

    const sessionGate = evaluateSessionDevice(activeSession?.device_id, deviceId, isSuperAdmin);
    if (!sessionGate.ok) {
      if (sessionGate.reason === "no_active_session") {
        return {
          ok: false,
          response: logBlocked(
            "no_active_session",
            NextResponse.json(
              { error: "Phiên chưa được đăng ký. Vui lòng vào Tủ sách rồi mở Đọc." },
              { status: 403 }
            )
          ),
        };
      }
      return {
        ok: false,
        response: logBlocked(
          "device_mismatch",
          NextResponse.json(
            {
              error:
                "Phiên đăng nhập đang được sử dụng trên thiết bị khác. Vui lòng đăng xuất trên thiết bị kia hoặc đăng nhập lại trên thiết bị này.",
            },
            { status: 403 }
          )
        ),
      };
    }
  }

  if (!isAdminCanReadAny) {
    const { data: perm } = await supabase
      .from("permissions")
      .select("id, expires_at")
      .eq("user_id", user.id)
      .eq("document_id", documentId)
      .maybeSingle();
    const permGate = evaluateDocumentPermission(isAdminCanReadAny, perm);
    if (!permGate.ok) {
      if (permGate.reason === "no_permission") {
        return {
          ok: false,
          response: logBlocked("no_permission", NextResponse.json({ error: "Bạn chưa mua tài liệu này." }, { status: 403 })),
        };
      }
      return {
        ok: false,
        response: logBlocked("expired", NextResponse.json({ error: "Quyền xem tài liệu đã hết hạn." }, { status: 403 })),
      };
    }
  }

  const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const [{ count: countHour }, { data: recentSuccess }, { data: doc, error: docError }] = await Promise.all([
    service
      .from("access_logs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("action", ACTION_SECURE_PDF)
      .eq("status", "success")
      .gte("created_at", oneHourAgo),
    service
      .from("access_logs")
      .select("document_id")
      .eq("user_id", user.id)
      .eq("action", ACTION_SECURE_PDF)
      .eq("status", "success")
      .gte("created_at", tenMinAgo),
    service
      .from("documents")
      .select("file_path")
      .eq("id", documentId)
      .single(),
  ]);

  if (wouldExceedHourlySuccessLimit(countHour ?? 0, RATE_LIMIT_VIEWS_PER_HOUR)) {
    return {
      ok: false,
      response: logBlocked(
        "rate_limit",
        NextResponse.json(
          { error: MSG_429_TOO_MANY_REQUESTS, code: "RATE_LIMIT", retry_after_seconds: RETRY_AFTER_1H },
          { status: 429, headers: { "Retry-After": String(RETRY_AFTER_1H) } }
        )
      ),
    };
  }

  const recentIds = (recentSuccess ?? []).map((r: { document_id: string | null }) => r.document_id);
  if (wouldExceedHighFreqDistinctDocs(recentIds, documentId, HIGH_FREQ_DOCS_IN_10MIN)) {
    return {
      ok: false,
      response: logBlocked(
        "high_frequency",
        NextResponse.json(
          { error: MSG_429_TOO_MANY_REQUESTS, code: "RATE_LIMIT_HIGH_FREQ", retry_after_seconds: RETRY_AFTER_10MIN },
          { status: 429, headers: { "Retry-After": String(RETRY_AFTER_10MIN) } }
        )
      ),
    };
  }

  if (docError || !doc?.file_path) {
    return {
      ok: false,
      response: logBlocked("not_found", NextResponse.json({ error: "Tài liệu không tồn tại." }, { status: 404 }), null),
    };
  }

  return {
    ok: true,
    ctx: {
      user,
      supabase,
      service,
      documentId,
      deviceId,
      ip,
      requestId,
      startedAt,
      filePath: doc.file_path,
      logBlocked,
      logSuccess: async () => {
        await logSecurePdfAccess({
          userId: user.id,
          documentId,
          status: "success",
          ipAddress: ip,
          deviceId,
          requestId,
          latencyMs: Date.now() - startedAt,
        }).catch(() => {});
      },
    },
  };
}
