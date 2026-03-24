"use server";

import { revalidatePath } from "next/cache";
import { type AdminContext } from "@/lib/admin/guards";
import { ok, fail, type ActionResult } from "@/lib/action-result";
import { isValidUuid, normalizeUuid } from "@/lib/uuid";
import {
  getDocumentAdminContextOrProvided,
  resolveDocumentsDeps,
  type DocumentsActionDeps,
} from "./document-manage-action-shared";

import { validateDocumentForPublish } from "@/lib/domain/documents/services/document-lifecycle";

export async function deleteDocument(
  input: {
    documentId: string;
    hardDelete?: boolean;
  },
  context?: AdminContext,
  deps?: Partial<DocumentsActionDeps>
): Promise<ActionResult<void>> {
  const guard = await getDocumentAdminContextOrProvided(context);
  if (!guard.ok) return fail(guard.error);
  const documentId = normalizeUuid(input.documentId);
  if (!isValidUuid(documentId)) return fail("documentId không hợp lệ.");
  if (Boolean(input.hardDelete) && guard.data!.adminRole !== "super_admin") {
    return fail("Chỉ super_admin được phép hard delete.");
  }

  try {
    const { repository } = resolveDocumentsDeps(deps);
    const result = await repository.deleteDocumentAdmin({
      documentId,
      hardDelete: Boolean(input.hardDelete),
    });
    if (!result.deleted) return fail("Không tìm thấy tài liệu để xóa.");
    revalidatePath("/admin/documents");
    return ok();
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Xóa tài liệu thất bại.");
  }
}

export async function setDocumentStatus(
  input: {
    documentId: string;
    targetStatus: "ready" | "archived" | "deleted" | "processing";
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
    if (input.targetStatus === "ready") {
      const doc = await repository.getDocumentPublishGate(documentId);
      if (!doc) return fail("Không tìm thấy tài liệu.");

      const validation = validateDocumentForPublish(doc);
      if (!validation.ok) return fail(validation.error);
    }

    const result = await repository.updateDocumentAdmin({
      documentId,
      status: input.targetStatus,
    });
    if (!result.updated) return fail("Không cập nhật được trạng thái tài liệu.");
    revalidatePath("/admin/documents");
    return ok();
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Đổi trạng thái thất bại.");
  }
}

export async function retryDocumentProcessing(
  input: { documentId: string },
  context?: AdminContext,
  deps?: Partial<DocumentsActionDeps>
): Promise<ActionResult<void>> {
  const guard = await getDocumentAdminContextOrProvided(context);
  if (!guard.ok) return fail(guard.error);
  const documentId = normalizeUuid(input.documentId);
  if (!isValidUuid(documentId)) return fail("documentId không hợp lệ.");

  try {
    const { repository } = resolveDocumentsDeps(deps);
    const doc = await repository.getDocumentRetryContext(documentId);
    if (!doc) return fail("Không tìm thấy tài liệu.");

    await repository.queueDocumentPostprocessJob({
      documentId,
      uploadSessionId: doc.upload_session_id,
    });
    const statusResult = await repository.updateDocumentAdmin({
      documentId,
      status: "processing",
    });
    if (!statusResult.updated) return fail("Không cập nhật được trạng thái xử lý tài liệu.");

    revalidatePath("/admin/documents");
    return ok();
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Retry processing thất bại.");
  }
}
