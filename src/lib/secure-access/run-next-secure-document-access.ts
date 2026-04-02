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
  parsePositiveIntEnv,
  SECURE_ACCESS_DEFAULTS,
  wouldExceedHighFreqDistinctDocs,
  wouldExceedHourlySuccessLimit,
} from "@/lib/secure-access/secure-access-core";
import {
  evaluateApiSessionBinding,
  toSessionBindingErrorMessage,
} from "@/lib/auth/session-binding-adapter";
import { persistDeviceLogRow } from "@/lib/auth/single-session/persistDeviceLogRow";
import { issueWatermark } from "@/lib/watermark/watermark-issuer";
import type { WatermarkDisplayPayload } from "@/lib/watermark/watermark-contract";

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
  watermark: WatermarkDisplayPayload;
  isHighValue: boolean;
  isDownloadable: boolean;
  numPages: number;
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
      correlationId: requestId,
      latencyMs: Date.now() - startedAt,
    }).catch(() => { });
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

  // Đọc profile bằng service role, luôn .eq("id", user.id) sau khi getUser() — tránh RLS/cookie trong Route Handler
  // khiến client anon trả 0 dòng dù hàng profiles tồn tại (mọi user đều thấy profile_missing).
  const { data: profile, error: profileLoadError } = await service
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (profileLoadError) {
    console.error("secure-access: profile load", profileLoadError.message);
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Không thể tải hồ sơ tài khoản. Vui lòng thử lại sau.", code: "profile_load_error" },
        { status: 503 }
      ),
    };
  }

  // Trước đây dùng isProfileActive(null) → false và trả cùng câu "đã bị khóa" — gây nhầm khi thiếu dòng profiles.
  if (!profile) {
    return {
      ok: false,
      response: logBlocked(
        "profile_missing",
        NextResponse.json(
          {
            error:
              "Không tìm thấy hồ sơ tài khoản. Vui lòng đăng xuất và đăng nhập lại, hoặc liên hệ hỗ trợ (cần đồng bộ bảng profiles với Auth).",
            code: "profile_missing",
          },
          { status: 403 }
        )
      ),
    };
  }

  if (profile.is_locked) {
    return {
      ok: false,
      response: logBlocked(
        "account_locked",
        NextResponse.json(
          { error: profile.lock_reason || "Tài khoản bị khóa do nghi ngờ vi phạm chính sách bảo mật.", is_locked: true },
          { status: 403 }
        )
      ),
    };
  }

  if (profile.is_active === false) {
    return {
      ok: false,
      response: logBlocked(
        "inactive_profile",
        NextResponse.json({ error: "Tài khoản đã bị vô hiệu hóa.", code: "inactive" }, { status: 403 })
      ),
    };
  }

  if (profile.banned_until) {
    const untilMs = Date.parse(profile.banned_until);
    if (Number.isFinite(untilMs) && untilMs > Date.now()) {
      return {
        ok: false,
        response: logBlocked(
          "temp_banned",
          NextResponse.json(
            {
              error: `Tài khoản đang bị khóa tạm thời. Thử lại sau ${new Date(untilMs).toLocaleString("vi-VN")}.`,
              code: "banned_until",
            },
            { status: 403 }
          )
        ),
      };
    }
  }

  const isSuperAdmin = computeIsSuperAdmin(profile);
  const isAdminCanReadAny = computeIsAdminCanReadAny(profile);

  if (!isSuperAdmin) {
    // Current low-risk policy: bind by latest active session row via user_id + device_id.
    // Phase-3 optimization (cookie-first by doc2share_sid) is intentionally deferred
    // because it changes secure-access contract across Next/Edge paths.
    const [{ data: devices }, { data: activeSession }] = await Promise.all([
      supabase.from("device_logs").select("device_id, hardware_hash").eq("user_id", user.id),
      service
        .from("active_sessions")
        .select("device_id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const hardwareHash = body?.hardware_hash;
    const deviceIds = (devices ?? []).map((d: { device_id: string }) => d.device_id);

    // Hardware hash check: log mismatch for monitoring but do NOT hard-block.
    // Legitimate reasons for hash changes: GPU driver update, OS upgrade, browser update.
    // Hard-blocking here caused false-positive lockouts for valid users.
    if (hardwareHash) {
      const match = (devices ?? []).find(d => d.device_id === deviceId);
      if (match && match.hardware_hash && match.hardware_hash !== hardwareHash) {
        // Log the mismatch for forensic review (fire-and-forget)
        void service.from("security_logs").insert({
          user_id: user.id,
          event_type: "hardware_hash_changed",
          severity: "medium",
          ip_address: ip,
          device_id: deviceId,
          metadata: {
            old_hash: match.hardware_hash.slice(0, 8) + "…",
            new_hash: hardwareHash.slice(0, 8) + "…",
            request_id: requestId,
          },
        });

        // Update stored hash to the new legitimate value (fire-and-forget)
        void supabase.from("device_logs")
          .update({ hardware_hash: hardwareHash })
          .eq("user_id", user.id)
          .eq("device_id", deviceId);
      }
    }

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
      await persistDeviceLogRow(supabase, {
        user_id: user.id,
        device_id: deviceId,
        device_info: { userAgent: req.headers.get("user-agent"), ip },
        hardware_hash: hardwareHash || null,
        hardware_fingerprint: body?.hardware_fingerprint || null,
        last_login: new Date().toISOString(),
      });
    }

    const sessionGate = evaluateApiSessionBinding(activeSession?.device_id, deviceId, isSuperAdmin);
    if (!sessionGate.ok) {
      if (sessionGate.reason === "no_active_session") {
        return {
          ok: false,
          response: logBlocked(
            "no_active_session",
              NextResponse.json(
                {
                  error: toSessionBindingErrorMessage("no_active_session"),
                  code: "SESSION_BINDING_FAILED",
                  reason: sessionGate.reason,
                },
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
                error: toSessionBindingErrorMessage("device_mismatch"),
                code: "SESSION_BINDING_FAILED",
                reason: sessionGate.reason,
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
      .select("file_path, is_high_value, num_pages, is_downloadable")
      .eq("id", documentId)
      .maybeSingle(),
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

  if (docError) {
    console.error("secure-access: document row load", docError.message);
    return {
      ok: false,
      response: logBlocked(
        "document_load_error",
        NextResponse.json(
          { error: "Không thể tải thông tin tài liệu. Vui lòng thử lại sau.", code: "document_load_error" },
          { status: 503 }
        ),
        documentId
      ),
    };
  }

  if (!doc) {
    return {
      ok: false,
      response: logBlocked("not_found", NextResponse.json({ error: "Tài liệu không tồn tại." }, { status: 404 }), null),
    };
  }

  const filePath = typeof doc.file_path === "string" ? doc.file_path.trim() : "";
  if (!filePath) {
    return {
      ok: false,
      response: logBlocked(
        "document_file_missing",
        NextResponse.json(
          {
            error:
              "Tài liệu chưa có file trên hệ thống (đang xử lý hoặc lỗi pipeline). Vui lòng thử lại sau hoặc liên hệ hỗ trợ.",
            code: "document_file_missing",
          },
          { status: 503 }
        ),
        documentId
      ),
    };
  }

  const watermarkIssued = issueWatermark(documentId);

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
      filePath,
      watermark: {
        wmShort: watermarkIssued.wmShort,
        wmDocShort: watermarkIssued.wmDocShort,
        wmIssuedAtBucket: watermarkIssued.wmIssuedAtBucket,
        wmVersion: watermarkIssued.wmVersion,
      },
      isHighValue: !!doc.is_high_value,
      isDownloadable: !!doc.is_downloadable,
      numPages: Number(doc.num_pages || 0),
      logBlocked,
      logSuccess: async () => {
        await logSecurePdfAccess({
          userId: user.id,
          documentId,
          status: "success",
          ipAddress: ip,
          deviceId,
          requestId,
          correlationId: requestId,
          latencyMs: Date.now() - startedAt,
          watermark: watermarkIssued,
        }).catch(() => { });
      },
    },
  };
}
