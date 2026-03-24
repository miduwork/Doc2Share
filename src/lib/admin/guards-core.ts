/**
 * Pure guard logic: no I/O, no server-only. Used by guards.ts and by tests.
 * AdminRole is the single source from @/lib/types; re-exported here for backward compatibility.
 */

import type { AdminRole } from "../types";

export type { AdminRole };

export type AdminContext = {
  userId: string;
  adminRole: AdminRole | null;
};

export type GuardResult = { ok: true; context: AdminContext } | { ok: false; error: string };

/** Minimal shape used by computeAdminContext (avoids pulling in full Supabase User type). */
export type AdminContextUser = { id: string };

/** Minimal profile shape from profiles (role, admin_role, is_active). */
export type AdminContextProfile = {
  role: string;
  admin_role: string | null;
  is_active: boolean;
  banned_until?: string | null;
} | null;

function isNotBannedNow(bannedUntil: string | null | undefined): boolean {
  if (!bannedUntil) return true;
  const untilMs = Date.parse(bannedUntil);
  if (!Number.isFinite(untilMs)) return true;
  return untilMs <= Date.now();
}

/** Capability map: add new admin roles here and extend AdminRole in lib/types.ts. */
export const ADMIN_ROLE_CAPABILITIES: Record<
  AdminRole,
  { canManageDocuments: boolean; canManageUsers: boolean }
> = {
  super_admin: { canManageDocuments: true, canManageUsers: true },
  content_manager: { canManageDocuments: true, canManageUsers: false },
  support_agent: { canManageDocuments: false, canManageUsers: true },
};

export function canManageDocuments(adminRole: AdminRole | null): boolean {
  if (!adminRole) return false;
  return ADMIN_ROLE_CAPABILITIES[adminRole]?.canManageDocuments ?? false;
}

export function canManageUsers(adminRole: AdminRole | null): boolean {
  if (!adminRole) return false;
  return ADMIN_ROLE_CAPABILITIES[adminRole]?.canManageUsers ?? false;
}

/**
 * Pure: compute guard result from user and profile. Used by requireAdminContext and by tests.
 */
export function computeAdminContext(
  user: AdminContextUser | null,
  profile: AdminContextProfile
): GuardResult {
  if (!user) return { ok: false, error: "Bạn chưa đăng nhập." };
  if (!profile || profile.role !== "admin" || !profile.is_active || !isNotBannedNow(profile.banned_until)) {
    return { ok: false, error: "Bạn không có quyền thực hiện thao tác này." };
  }
  return {
    ok: true,
    context: {
      userId: user.id,
      adminRole: (profile.admin_role as AdminRole | null) ?? null,
    },
  };
}
