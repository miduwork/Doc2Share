import "server-only";

import { getCurrentUserWithProfile } from "@/lib/auth/current-user-context";
import {
  canManageDocuments,
  canManageUsers,
  computeAdminContext,
  type AdminContextProfile,
  type GuardResult,
} from "./guards-core";

export type { AdminContext, AdminRole, GuardResult, AdminContextUser, AdminContextProfile } from "./guards-core";
export { canManageDocuments, canManageUsers, computeAdminContext };

export async function requireAdminContext(): Promise<GuardResult> {
  const { user, profile } = await getCurrentUserWithProfile();
  return computeAdminContext(user ?? null, profile as AdminContextProfile);
}

export async function requireSuperAdminContext(): Promise<GuardResult> {
  const base = await requireAdminContext();
  if (!base.ok) return base;
  if (base.context.adminRole !== "super_admin") {
    return { ok: false, error: "Bạn không có quyền thực hiện thao tác này." };
  }
  return base;
}

export async function requireDocumentManagerContext(): Promise<GuardResult> {
  const base = await requireAdminContext();
  if (!base.ok) return base;
  if (!canManageDocuments(base.context.adminRole)) {
    return { ok: false, error: "Bạn không có quyền quản lý tài liệu." };
  }
  return base;
}

export async function requireUserManagerContext(): Promise<GuardResult> {
  const base = await requireAdminContext();
  if (!base.ok) return base;
  if (!canManageUsers(base.context.adminRole)) {
    return { ok: false, error: "Bạn không có quyền quản lý người dùng." };
  }
  return base;
}
