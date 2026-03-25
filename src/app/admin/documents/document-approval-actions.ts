"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { type AdminContext } from "@/lib/admin/guards";
import { ok, fail, type ActionResult } from "@/lib/action-result";
import { isValidUuid, normalizeUuid } from "@/lib/uuid";
import {
  getDocumentAdminContextOrProvided,
  resolveDocumentsDeps,
  sanitizeOptionalText,
  type DocumentsActionDeps,
} from "./document-manage-action-shared";

export async function submitDocumentForApproval(
  input: {
    documentId: string;
    note?: string;
  },
  context?: AdminContext,
  deps?: Partial<DocumentsActionDeps>
): Promise<ActionResult<void>> {
  const guard = await getDocumentAdminContextOrProvided(context);
  if (!guard.ok) return fail(guard.error);
  const documentId = normalizeUuid(input.documentId);
  if (!isValidUuid(documentId)) return fail("documentId không hợp lệ.");
  try {
    const { repository } = resolveDocumentsDeps(deps);
    const result = await repository.submitDocumentForApprovalAdmin({
      documentId,
      actorId: guard.data!.userId,
      note: sanitizeOptionalText(input.note, 500) ?? null,
    });
    if (!result.submitted) return fail("Không thể gửi duyệt tài liệu.");
    revalidatePath("/admin/documents");
    revalidatePath("/");
    revalidatePath("/cua-hang");
    revalidateTag("documents");
    revalidateTag("reviews");
    revalidateTag("permissions");
    return ok();
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Submit approval thất bại.");
  }
}

export async function approveDocument(
  input: {
    documentId: string;
    note?: string;
  },
  context?: AdminContext,
  deps?: Partial<DocumentsActionDeps>
): Promise<ActionResult<void>> {
  const guard = await getDocumentAdminContextOrProvided(context);
  if (!guard.ok) return fail(guard.error);
  if (guard.data!.adminRole !== "super_admin") return fail("Chỉ super_admin được duyệt publish.");
  const documentId = normalizeUuid(input.documentId);
  if (!isValidUuid(documentId)) return fail("documentId không hợp lệ.");
  try {
    const { repository } = resolveDocumentsDeps(deps);
    const result = await repository.approveDocumentPublishAdmin({
      documentId,
      actorId: guard.data!.userId,
      note: sanitizeOptionalText(input.note, 500) ?? null,
    });
    if (!result.approved) return fail("Không thể duyệt publish tài liệu.");
    revalidatePath("/admin/documents");
    revalidatePath("/");
    revalidatePath("/cua-hang");
    revalidateTag("documents");
    revalidateTag("reviews");
    revalidateTag("permissions");
    return ok();
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Approve thất bại.");
  }
}

export async function rejectDocument(
  input: {
    documentId: string;
    note?: string;
  },
  context?: AdminContext,
  deps?: Partial<DocumentsActionDeps>
): Promise<ActionResult<void>> {
  const guard = await getDocumentAdminContextOrProvided(context);
  if (!guard.ok) return fail(guard.error);
  if (guard.data!.adminRole !== "super_admin") return fail("Chỉ super_admin được reject publish.");
  const documentId = normalizeUuid(input.documentId);
  if (!isValidUuid(documentId)) return fail("documentId không hợp lệ.");
  if (!input.note || !input.note.trim()) return fail("Bắt buộc nhập lý do khi reject.");
  try {
    const { repository } = resolveDocumentsDeps(deps);
    const result = await repository.rejectDocumentPublishAdmin({
      documentId,
      actorId: guard.data!.userId,
      note: sanitizeOptionalText(input.note, 1000) ?? "",
    });
    if (!result.rejected) return fail("Không thể reject tài liệu.");
    revalidatePath("/admin/documents");
    revalidatePath("/");
    revalidatePath("/cua-hang");
    revalidateTag("documents");
    revalidateTag("reviews");
    revalidateTag("permissions");
    return ok();
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Reject thất bại.");
  }
}
