"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { ok, fail, type ActionResult } from "@/lib/action-result";
import { isValidUuid, normalizeUuid } from "@/lib/uuid";
import {
  getDocumentAdminContext,
  sanitizeOptionalText,
  type DocumentsActionDeps,
} from "./document-manage-action-shared";

export type BulkDocumentAction =
  | "publish"
  | "archive"
  | "delete"
  | "retry_processing"
  | "submit_approval"
  | "approve"
  | "reject";

export async function bulkManageDocuments(
  input: {
    documentIds: string[];
    action: BulkDocumentAction;
    note?: string;
  },
  _deps?: Partial<DocumentsActionDeps>
): Promise<ActionResult<{ summary: string }>> {
  const guard = await getDocumentAdminContext();
  if (!guard.ok) return fail(guard.error);
  const dedupedIds = Array.from(new Set(input.documentIds.map(normalizeUuid))).filter(Boolean);
  if (!dedupedIds.length) return fail("Vui lòng chọn ít nhất 1 tài liệu.");
  if (dedupedIds.length > 100) return fail("Tối đa 100 tài liệu mỗi lần thao tác bulk.");
  if (!dedupedIds.every(isValidUuid)) return fail("Danh sách documentIds chứa giá trị không hợp lệ.");
  if (input.action === "reject" && (!input.note || !input.note.trim())) {
    return fail("Bắt buộc nhập lý do khi reject.");
  }
  if ((input.action === "approve" || input.action === "reject") && guard.data!.adminRole !== "super_admin") {
    return fail("Chỉ super_admin được duyệt/từ chối publish.");
  }

  try {
    const serviceRole = createServiceRoleClient();
    let success: number;
    let failed: number;

    switch (input.action) {
      case "publish": {
        const { data: r, error } = await serviceRole.rpc("bulk_set_document_status", {
          p_document_ids: dedupedIds,
          p_target_status: "ready",
          p_actor_id: guard.data!.userId,
        });
        if (error) return fail(error.message);
        const row = Array.isArray(r) ? r[0] : r;
        const count = Number((row as { updated_count?: number })?.updated_count ?? 0);
        success = count;
        failed = dedupedIds.length - count;
        break;
      }
      case "archive": {
        const { data: r, error } = await serviceRole.rpc("bulk_set_document_status", {
          p_document_ids: dedupedIds,
          p_target_status: "archived",
          p_actor_id: guard.data!.userId,
        });
        if (error) return fail(error.message);
        const row = Array.isArray(r) ? r[0] : r;
        const count = Number((row as { updated_count?: number })?.updated_count ?? 0);
        success = count;
        failed = dedupedIds.length - count;
        break;
      }
      case "delete": {
        const { data: r, error } = await serviceRole.rpc("bulk_delete_document_soft", {
          p_document_ids: dedupedIds,
          p_actor_id: guard.data!.userId,
        });
        if (error) return fail(error.message);
        const row = Array.isArray(r) ? r[0] : r;
        const count = Number((row as { updated_count?: number })?.updated_count ?? 0);
        success = count;
        failed = dedupedIds.length - count;
        break;
      }
      case "retry_processing": {
        const { data: r, error } = await serviceRole.rpc("bulk_retry_document_processing", {
          p_document_ids: dedupedIds,
          p_actor_id: guard.data!.userId,
        });
        if (error) return fail(error.message);
        const row = Array.isArray(r) ? r[0] : r;
        const count = Number((row as { updated_count?: number })?.updated_count ?? 0);
        success = count;
        failed = dedupedIds.length - count;
        break;
      }
      case "submit_approval": {
        const { data: r, error } = await serviceRole.rpc("bulk_submit_document_for_approval", {
          p_document_ids: dedupedIds,
          p_actor_id: guard.data!.userId,
          p_note: sanitizeOptionalText(input.note, 500) ?? null,
        });
        if (error) return fail(error.message);
        const row = Array.isArray(r) ? r[0] : r;
        success = Number((row as { success_count?: number })?.success_count ?? 0);
        failed = Number((row as { failed_count?: number })?.failed_count ?? 0);
        break;
      }
      case "approve": {
        const { data: r, error } = await serviceRole.rpc("bulk_approve_document_publish", {
          p_document_ids: dedupedIds,
          p_actor_id: guard.data!.userId,
          p_note: sanitizeOptionalText(input.note, 500) ?? null,
        });
        if (error) return fail(error.message);
        const row = Array.isArray(r) ? r[0] : r;
        success = Number((row as { success_count?: number })?.success_count ?? 0);
        failed = Number((row as { failed_count?: number })?.failed_count ?? 0);
        break;
      }
      case "reject": {
        const { data: r, error } = await serviceRole.rpc("bulk_reject_document_publish", {
          p_document_ids: dedupedIds,
          p_actor_id: guard.data!.userId,
          p_note: (input.note ?? "").trim().slice(0, 1000),
        });
        if (error) return fail(error.message);
        const row = Array.isArray(r) ? r[0] : r;
        success = Number((row as { success_count?: number })?.success_count ?? 0);
        failed = Number((row as { failed_count?: number })?.failed_count ?? 0);
        break;
      }
      default: {
        const _: never = input.action;
        return fail("Hành động bulk không hỗ trợ.");
      }
    }

    revalidatePath("/admin/documents");
    return ok({ summary: `Hoàn tất ${input.action}: thành công ${success}, lỗi ${failed}.` });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Bulk thao tác thất bại.");
  }
}
