"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { logLoginAttempt, ACTION_LOGIN_ATTEMPT } from "@/lib/access-log";
import { ok, fail, type ActionResult } from "@/lib/action-result";
import { registerDeviceAndSession } from "@/lib/auth/single-session/registerDeviceAndSession";

/** Số lần thử đăng nhập tối đa theo IP trong 15 phút. Cấu hình qua env LOGIN_RATE_LIMIT_PER_15MIN (mặc định 10). */
const LOGIN_RATE_LIMIT_PER_15MIN = Math.max(
  1,
  parseInt(process.env.LOGIN_RATE_LIMIT_PER_15MIN ?? "10", 10) || 10
);

function getClientIp(hd: Headers): string {
  const forwarded = hd.get("x-forwarded-for") ?? hd.get("x-real-ip") ?? "";
  const first = forwarded.split(",")[0]?.trim();
  return first || "unknown";
}

/**
 * Đăng nhập bằng email/password với rate limit theo IP, hỗ trợ đăng ký thiết bị/phiên tập trung.
 */
export async function loginWithPassword(
  email: string,
  password: string,
  deviceId?: string,
  hardwareFingerprint?: any,
  hardwareHash?: string
): Promise<ActionResult<void>> {
  let ip = "unknown";
  try {
    const hd = await headers();
    ip = getClientIp(hd);
  } catch {
    // headers() may throw
  }

  const service = createServiceRoleClient();
  const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { count } = await service
    .from("access_logs")
    .select("id", { count: "exact", head: true })
    .eq("action", ACTION_LOGIN_ATTEMPT)
    .eq("ip_address", ip)
    .gte("created_at", fifteenMinAgo);
  if (count != null && count >= LOGIN_RATE_LIMIT_PER_15MIN) {
    return fail("Quá nhiều lần thử đăng nhập. Vui lòng thử lại sau 15 phút.");
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.signInWithPassword({ email, password });
  if (authError) {
    await logLoginAttempt({ userId: null, status: "blocked", ipAddress: ip }).catch(() => { });
    const msg = authError.message || "Đăng nhập thất bại.";
    return fail(msg);
  }
  await logLoginAttempt({ userId: user?.id ?? null, status: "success", ipAddress: ip }).catch(() => { });

  if (deviceId && user) {
    const regResult = await registerDeviceAndSession(deviceId, hardwareFingerprint, hardwareHash, user, supabase);
    if (!regResult.ok) return regResult;
  }

  return ok();
}
