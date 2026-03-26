"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { ok, fail, type ActionResult } from "@/lib/action-result";
import { setSessionCookieId } from "./cookie";
import { evaluateRegisterDevicePolicy } from "./registerDeviceAndSession.logic";
import { isLikelyMissingHardwareColumnError, persistDeviceLogRow } from "./persistDeviceLogRow";

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
  hardwareFingerprint?: any,
  hardwareHash?: string,
  existingUser?: { id: string } | null,
  existingSupabaseClient?: any
): Promise<ActionResult<{ recoveredDeviceId?: string }>> {
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
    .select("device_id, hardware_hash")
    .eq("user_id", user.id);

  const devicePolicy = evaluateRegisterDevicePolicy({
    isSuperAdmin,
    existingDevices: devices ?? [],
    currentDeviceId: deviceId,
    currentHardwareHash: hardwareHash,
  });
  if (!devicePolicy.ok) return fail(devicePolicy.error);

  const isNewDevice = devicePolicy.isNewDevice;
  const recoveredDeviceId = devicePolicy.recoveredDeviceId;
  const effectiveDeviceId = recoveredDeviceId || deviceId;

  if (isNewDevice) {
    const { error: persistErr } = await persistDeviceLogRow(supabase, {
      user_id: user.id,
      device_id: effectiveDeviceId,
      device_info: { userAgent, clientIp },
      hardware_fingerprint: hardwareFingerprint || null,
      hardware_hash: hardwareHash || null,
      last_login: new Date().toISOString(),
    });
    if (persistErr) {
      console.error(
        "registerDeviceAndSession: device_logs persist failed",
        persistErr.code,
        persistErr.message,
        persistErr
      );
      return fail("Không thể ghi thiết bị. Vui lòng thử lại.");
    }
  } else if (hardwareHash) {
    const lastLogin = new Date().toISOString();
    const payloadWithHw = {
      hardware_fingerprint: hardwareFingerprint || null,
      hardware_hash: hardwareHash,
      last_login: lastLogin,
    };
    const payloadNoHw = { last_login: lastLogin };
    let { error: updateErr } = await supabase
      .from("device_logs")
      .update(payloadWithHw)
      .eq("user_id", user.id)
      .eq("device_id", effectiveDeviceId);
    if (updateErr && isLikelyMissingHardwareColumnError(updateErr)) {
      ({ error: updateErr } = await supabase
        .from("device_logs")
        .update(payloadNoHw)
        .eq("user_id", user.id)
        .eq("device_id", effectiveDeviceId));
    }
    if (updateErr) {
      console.error("registerDeviceAndSession: device_logs update failed", updateErr);
      return fail("Không thể cập nhật thiết bị. Vui lòng thử lại.");
    }
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
      device_id: effectiveDeviceId,
      metadata: { reason: "ip_shifting_30min", other_ips: otherIps.slice(0, 5) },
    });
  }

  // Idempotent session handling: only replace session when the device actually changes.
  // Previously, this unconditionally deleted ALL sessions and inserted a new one on every
  // doc open — breaking multi-tab usage and causing retry domino effects.
  const { data: existingSession } = await supabase
    .from("active_sessions")
    .select("session_id, device_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingSession?.device_id === effectiveDeviceId) {
    // Same device already has an active session — reuse it, no churn.
    await setSessionCookieId(existingSession.session_id);
    return ok({ recoveredDeviceId });
  }

  // Different device or no session at all — replace with a new session.
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
    device_id: effectiveDeviceId,
  });

  if (insertErr) {
    console.error("registerDeviceAndSession: insert active_sessions failed", insertErr);
    return fail("Không thể đăng ký phiên. Vui lòng thử lại hoặc đăng nhập lại.");
  }

  await setSessionCookieId(sessionId);
  return ok({ recoveredDeviceId });
}

