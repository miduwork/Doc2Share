import {
  evaluateSessionDevice,
  type SessionGateResult,
} from "../secure-access/secure-access-core.ts";

export type SessionBindingReason =
  | "no_active_session"
  | "device_mismatch"
  | "session_replaced";

export type SessionBindingResult =
  | { ok: true }
  | { ok: false; reason: SessionBindingReason };

/**
 * Adapter for API secure-access gate.
 * Reuses secure-access core rule to avoid policy drift.
 */
export function evaluateApiSessionBinding(
  activeSessionDeviceId: string | null | undefined,
  requestDeviceId: string,
  isSuperAdmin: boolean
): SessionGateResult {
  return evaluateSessionDevice(activeSessionDeviceId, requestDeviceId, isSuperAdmin);
}

/**
 * Adapter for page-level single-session gate.
 * When no session cookie exists, keep backward-compatible pass-through behavior.
 */
export function evaluatePageSessionBinding(
  hasSessionCookie: boolean,
  hasMatchingActiveSession: boolean
): SessionBindingResult {
  if (!hasSessionCookie) return { ok: true };
  if (hasMatchingActiveSession) return { ok: true };
  return { ok: false, reason: "session_replaced" };
}

export function toSessionBindingErrorMessage(reason: SessionBindingReason): string {
  if (reason === "no_active_session") {
    return "Không tìm thấy thiết bị hợp lệ. Tự động phục hồi thất bại. Vui lòng đăng nhập lại.";
  }
  if (reason === "device_mismatch") {
    return "Phiên đăng nhập đang được sử dụng trên thiết bị khác. Vui lòng đăng xuất trên thiết bị kia hoặc đăng nhập lại trên thiết bị này.";
  }
  return "Phiên đăng nhập đã được thay thế bởi thiết bị khác.";
}

