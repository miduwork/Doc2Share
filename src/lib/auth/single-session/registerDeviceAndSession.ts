"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { ok, fail, type ActionResult } from "@/lib/action-result";
import { setSessionCookieId } from "./cookie";
import { evaluateRegisterDevicePolicy } from "./registerDeviceAndSession.logic";

function getClientIp(hd: Headers): string {
  const forwarded = hd.get("x-forwarded-for") ?? hd.get("x-real-ip") ?? "";
  const first = forwarded.split(",")[0]?.trim();
  return first || "unknown";
}

/**
 * Sau khi đăng nhập: xác thực thiết bị (tối đa 2), ghi device_logs,
 * single session (tạo session mới, xóa session cũ), set cookie `doc2share_sid`.
 */
export async function registerDeviceAndSession(
  deviceId: string,
  existingUser?: { id: string } | null,
  existingSupabaseClient?: any
): Promise<ActionResult<void>> {
  const supabase = existingSupabaseClient || (await createClient());
  let user = existingUser;
  if (!user) {
    const { data: userData } = await supabase.auth.getUser();
    user = userData.user;
  }

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

  const existingDeviceIds = (devices ?? []).map((d: { device_id: string }) => d.device_id);
  const devicePolicy = evaluateRegisterDevicePolicy({
    isSuperAdmin,
    existingDeviceIds,
    currentDeviceId: deviceId,
  });
  if (!devicePolicy.ok) return fail(devicePolicy.error);
  const isNewDevice = devicePolicy.isNewDevice;

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

  const { data: oldSessions } = await supabase
    .from("active_sessions")
    .select("ip_address")
    .eq("user_id", user.id);

  const otherIps = (oldSessions ?? [])
    .map((s: { ip_address: string | null }) => s?.ip_address)
    .filter((ip: string | null): ip is string => !!ip && ip !== clientIp);

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

  await setSessionCookieId(sessionId);
  return ok();
}

