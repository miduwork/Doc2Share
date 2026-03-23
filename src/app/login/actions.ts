"use server";

import { cookies, headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { logLoginAttempt, ACTION_LOGIN_ATTEMPT } from "@/lib/access-log";
import { ok, fail, type ActionResult } from "@/lib/action-result";

const SESSION_COOKIE = "doc2share_sid";

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
 * Đăng nhập bằng email/password với rate limit theo IP và audit log.
 */
export async function loginWithPassword(email: string, password: string): Promise<ActionResult<void>> {
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
    await logLoginAttempt({ userId: null, status: "blocked", ipAddress: ip }).catch(() => {});
    const msg = authError.message || "Đăng nhập thất bại.";
    return fail(msg);
  }
  await logLoginAttempt({ userId: user?.id ?? null, status: "success", ipAddress: ip }).catch(() => {});
  return ok();
}

/**
 * Sau khi đăng nhập: xác thực thiết bị (tối đa 2), ghi device_logs,
 * single session (tạo session mới, xóa session cũ), set cookie.
 * Ghi IP vào active_sessions; nếu phát hiện IP khác trong 30 phút → security_log (ip_change, medium).
 */
export async function registerDeviceAndSession(deviceId: string): Promise<ActionResult<void>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail("Unauthorized");

  let clientIp = "unknown";
  let userAgent = "";
  try {
    const hd = await headers();
    clientIp = getClientIp(hd);
    userAgent = hd.get("user-agent") ?? "";
  } catch {
    // headers() may throw in some runtimes
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, admin_role")
    .eq("id", user.id)
    .maybeSingle();
  const isSuperAdmin = profile?.role === "admin" && profile?.admin_role === "super_admin";

  const { data: devices } = await supabase
    .from("device_logs")
    .select("device_id")
    .eq("user_id", user.id);

  const isNewDevice = !devices?.some((d: { device_id: string }) => d.device_id === deviceId);
  if (!isSuperAdmin && isNewDevice && devices && devices.length >= 2) {
    return fail("Tối đa 2 thiết bị. Vui lòng gỡ thiết bị cũ trong Tủ sách.");
  }

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

  const _thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { data: oldSessions } = await supabase
    .from("active_sessions")
    .select("ip_address")
    .eq("user_id", user.id);
  const otherIps = (oldSessions ?? [])
    .map((s: { ip_address: string | null }) => s?.ip_address)
    .filter((ip): ip is string => !!ip && ip !== clientIp);
  if (otherIps.length > 0) {
    await supabase.from("security_logs").insert({
      user_id: user.id,
      event_type: "ip_change",
      severity: "medium",
      ip_address: clientIp,
      device_id: deviceId,
      metadata: { reason: "ip_shifting_30min", other_ips: otherIps.slice(0, 5) },
    });
  }

  const sessionId = crypto.randomUUID();
  const { error: delErr } = await supabase.from("active_sessions").delete().eq("user_id", user.id);
  if (delErr) {
    console.error("registerDeviceAndSession: delete active_sessions failed", delErr);
  }
  const { error: insertErr } = await supabase.from("active_sessions").insert({
    session_id: sessionId,
    user_id: user.id,
    ip_address: clientIp,
    user_agent: userAgent,
    device_id: deviceId,
  });
  if (insertErr) {
    console.error("registerDeviceAndSession: insert active_sessions failed", insertErr);
    return fail("Không thể đăng ký phiên. Vui lòng thử lại hoặc đăng nhập lại.");
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return ok();
}

export async function getSessionCookieName() {
  return SESSION_COOKIE;
}
