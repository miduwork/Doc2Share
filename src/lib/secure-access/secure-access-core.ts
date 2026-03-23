/**
 * Pure rules for document access (device limit, session binding, permission, rate math).
 * Used by Next API routes and synced to Edge get-secure-link — no I/O, no Supabase imports.
 */

export const SECURE_ACCESS_DEFAULTS = {
  SIGNED_URL_EXPIRY_SECONDS: 60,
  MAX_DEVICES_PER_USER: 2,
  RATE_LIMIT_VIEWS_PER_HOUR: 20,
  RATE_LIMIT_PER_IP_PER_HOUR: 40,
  HIGH_FREQ_DOCS_IN_10MIN: 15,
  BRUTE_FORCE_BLOCKED_IN_10MIN: 5,
} as const;

export type SecureAccessProfile = {
  role: string;
  admin_role: string | null;
  is_active?: boolean | null;
};

export function isProfileActive(profile: SecureAccessProfile | null): boolean {
  return !!(profile && profile.is_active !== false);
}

export function computeIsSuperAdmin(profile: SecureAccessProfile | null): boolean {
  return profile?.role === "admin" && profile?.admin_role === "super_admin";
}

export function computeIsAdminCanReadAny(profile: SecureAccessProfile | null): boolean {
  return (
    profile?.role === "admin" &&
    (profile?.admin_role === "super_admin" || profile?.admin_role === "content_manager")
  );
}

export type DeviceGateResult = { ok: true } | { ok: false; reason: "device_limit" };

export function evaluateDeviceGate(
  deviceIds: string[],
  currentDeviceId: string,
  isSuperAdmin: boolean,
  maxDevices: number = SECURE_ACCESS_DEFAULTS.MAX_DEVICES_PER_USER
): DeviceGateResult {
  if (isSuperAdmin) return { ok: true };
  const isNew = !deviceIds.some((id) => id === currentDeviceId);
  if (isNew && deviceIds.length >= maxDevices) {
    return { ok: false, reason: "device_limit" };
  }
  return { ok: true };
}

export type SessionGateResult =
  | { ok: true }
  | { ok: false; reason: "no_active_session" | "device_mismatch" };

/**
 * @param activeSessionDeviceId device_id on current active_sessions row (null/undefined if no row)
 */
export function evaluateSessionDevice(
  activeSessionDeviceId: string | null | undefined,
  requestDeviceId: string,
  isSuperAdmin: boolean
): SessionGateResult {
  if (isSuperAdmin) return { ok: true };
  if (activeSessionDeviceId == null || activeSessionDeviceId === "") {
    return { ok: false, reason: "no_active_session" };
  }
  if (activeSessionDeviceId !== requestDeviceId) {
    return { ok: false, reason: "device_mismatch" };
  }
  return { ok: true };
}

export type PermissionGateResult =
  | { ok: true }
  | { ok: false; reason: "no_permission" | "expired" };

export function evaluateDocumentPermission(
  isAdminCanReadAny: boolean,
  permission: { expires_at: string | null } | null
): PermissionGateResult {
  if (isAdminCanReadAny) return { ok: true };
  if (!permission) return { ok: false, reason: "no_permission" };
  if (permission.expires_at && new Date(permission.expires_at) < new Date()) {
    return { ok: false, reason: "expired" };
  }
  return { ok: true };
}

export function wouldExceedHourlySuccessLimit(successCountLastHour: number, limit: number): boolean {
  return successCountLastHour >= limit;
}

/**
 * Distinct document_ids from recent successful views; includes whether adding current doc exceeds cap.
 */
export function wouldExceedHighFreqDistinctDocs(
  recentDocumentIds: (string | null)[],
  currentDocumentId: string,
  limit: number
): boolean {
  const distinct = new Set(
    recentDocumentIds.filter((id): id is string => typeof id === "string" && id.length > 0)
  );
  const wouldBe = distinct.has(currentDocumentId) ? distinct.size : distinct.size + 1;
  return wouldBe > limit;
}

export function parsePositiveIntEnv(value: string | undefined, fallback: number): number {
  const n = parseInt(value ?? "", 10);
  return Number.isFinite(n) && n >= 1 ? n : fallback;
}
