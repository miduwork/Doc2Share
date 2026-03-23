import "server-only";

import { createClient } from "@/lib/supabase/server";
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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase
        .from("profiles")
        .select("role, admin_role, is_active")
        .eq("id", user.id)
        .single()
    : { data: null };
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
