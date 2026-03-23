import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

const ACTION_SECURE_PDF = "secure_pdf";
export const ACTION_LOGIN_ATTEMPT = "login_attempt";

export type AccessLogParams = {
  userId: string | null;
  documentId: string | null;
  status: "success" | "blocked";
  ipAddress: string | null;
  deviceId?: string | null;
  reason?: string;
  requestId?: string;
  latencyMs?: number;
};

/**
 * Ghi audit log truy cập tài liệu (access_logs). Dùng service role để insert.
 * Không throw — lỗi chỉ log console để không ảnh hưởng luồng chính.
 */
export async function logSecurePdfAccess(params: AccessLogParams): Promise<void> {
  try {
    const service = createServiceRoleClient();
    await service.from("access_logs").insert({
      user_id: params.userId,
      document_id: params.documentId ?? null,
      action: ACTION_SECURE_PDF,
      status: params.status,
      ip_address: params.ipAddress,
      device_id: params.deviceId ?? null,
      metadata: {
        ...(params.reason ? { reason: params.reason } : {}),
        ...(params.requestId ? { request_id: params.requestId } : {}),
        ...(params.latencyMs != null ? { latency_ms: params.latencyMs } : {}),
      },
    });
  } catch (e) {
    console.error("access-log: insert failed", e);
  }
}

/**
 * Ghi log thử đăng nhập (để rate limit theo IP và audit).
 * userId = null khi thất bại, set khi thành công.
 */
export async function logLoginAttempt(params: {
  userId: string | null;
  status: "success" | "blocked";
  ipAddress: string | null;
}): Promise<void> {
  try {
    const service = createServiceRoleClient();
    await service.from("access_logs").insert({
      user_id: params.userId,
      document_id: null,
      action: ACTION_LOGIN_ATTEMPT,
      status: params.status,
      ip_address: params.ipAddress,
      device_id: null,
      metadata: {},
    });
  } catch (e) {
    console.error("access-log: login insert failed", e);
  }
}

export { ACTION_SECURE_PDF };
