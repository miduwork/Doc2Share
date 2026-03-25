"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireSuperAdminContext, requireDocumentManagerContext, requireUserManagerContext } from "@/lib/admin/guards";
import { revalidatePath } from "next/cache";
import { ok, fail, type ActionResult } from "@/lib/action-result";
import type { AdminRole, ProfileRole } from "@/lib/types";

const PROFILE_ROLES: ProfileRole[] = ["student", "teacher", "admin"];
const ADMIN_ROLES: AdminRole[] = ["super_admin", "content_manager", "support_agent"];

export type { AdminRole, ProfileRole };

export async function updateUserRole(
  userId: string,
  role: ProfileRole,
  adminRole: AdminRole | null
): Promise<ActionResult<void>> {
  const guard = await requireSuperAdminContext();
  if (!guard.ok) return fail(guard.error);

  if (!userId || !PROFILE_ROLES.includes(role)) return fail("Dữ liệu không hợp lệ.");
  if (role === "admin" && !adminRole) return fail("Admin cần chọn Admin role.");
  if (role !== "admin" && adminRole) return fail("Chỉ khi Role = Admin mới được chọn Admin role.");
  if (adminRole && !ADMIN_ROLES.includes(adminRole)) return fail("Admin role không hợp lệ.");

  const supabase = await createClient();
  const updates: { role: string; admin_role: AdminRole | null; updated_at: string } = {
    role,
    admin_role: role === "admin" ? adminRole : null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("profiles").update(updates).eq("id", userId);

  if (error) return fail(error.message);
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
  return ok();
}

/** Cấp quyền xem tài liệu cho user (sau khi đã nhận tiền). Dùng service role để bypass RLS. */
export async function grantDocumentPermission(
  userId: string,
  documentId: string
): Promise<ActionResult<void>> {
  const guard = await requireDocumentManagerContext();
  if (!guard.ok) return fail(guard.error);

  const trimmedUserId = userId?.trim();
  const trimmedDocId = documentId?.trim();
  if (!trimmedUserId || !trimmedDocId) return fail("User ID và Document ID không được để trống.");

  const service = createServiceRoleClient();
  const { error } = await service.from("permissions").upsert(
    {
      user_id: trimmedUserId,
      document_id: trimmedDocId,
      granted_at: new Date().toISOString(),
      expires_at: null,
    },
    { onConflict: "user_id,document_id" }
  );

  if (error) return fail(error.message);
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${trimmedUserId}`);
  return ok();
}

/** Gỡ khóa bảo mật (is_locked) — không đổi is_active. Dùng khi risk engine khóa nhưng cần mở lại đọc tài liệu. */
export async function clearUserSecurityLock(userId: string): Promise<ActionResult<void>> {
  const guard = await requireUserManagerContext();
  if (!guard.ok) return fail(guard.error);

  const trimmed = userId?.trim();
  if (!trimmed) return fail("User ID không hợp lệ.");

  const service = createServiceRoleClient();
  const { error } = await service
    .from("profiles")
    .update({
      is_locked: false,
      lock_reason: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", trimmed);

  if (error) return fail(error.message);
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${trimmed}`);
  return ok();
}

/** Tạo dòng profiles thiếu cho mọi user trong auth.users (cần migration fn_backfill_missing_profiles). */
export async function backfillMissingProfilesFromAuth(): Promise<ActionResult<{ inserted: number }>> {
  const guard = await requireUserManagerContext();
  if (!guard.ok) return fail(guard.error);

  const service = createServiceRoleClient();
  const { data, error } = await service.rpc("backfill_missing_profiles");
  if (error) return fail(error.message);
  const inserted = typeof data === "number" ? data : Number(data ?? 0);
  revalidatePath("/admin/users");
  return ok({ inserted: Number.isFinite(inserted) ? inserted : 0 });
}
