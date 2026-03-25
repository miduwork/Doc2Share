"use server";

import { revalidatePath } from "next/cache";
import { ok, fail, type ActionResult } from "@/lib/action-result";
import { isValidUuid, normalizeUuid } from "@/lib/uuid";
import {
  EDITABLE_STATUSES,
  getDocumentAdminContext,
  resolveDocumentsDeps,
  sanitizeOptionalText,
  type DocumentsActionDeps,
} from "./document-manage-action-shared";

export async function updateDocumentMetadata(
  input: {
    documentId: string;
    title?: string | null;
    description?: string | null;
    price?: number | null;
    subject_id?: number | null;
    grade_id?: number | null;
    exam_id?: number | null;
    is_downloadable?: boolean | null;
    is_high_value?: boolean | null;
    status?: "draft" | "processing" | "ready" | "failed" | "archived" | "deleted" | null;
  },
  deps?: Partial<DocumentsActionDeps>
): Promise<ActionResult<void>> {
  const guard = await getDocumentAdminContext();
  if (!guard.ok) return fail(guard.error);
  const documentId = normalizeUuid(input.documentId);
  if (!isValidUuid(documentId)) return fail("documentId không hợp lệ.");
  if (input.status && !EDITABLE_STATUSES.has(input.status)) return fail("status không hợp lệ.");
  if (input.price != null && (!Number.isFinite(input.price) || input.price < 0 || input.price > 1_000_000_000)) {
    return fail("price không hợp lệ.");
  }

  try {
    const { repository } = resolveDocumentsDeps(deps);
    const result = await repository.updateDocumentAdmin({
      documentId,
      title: sanitizeOptionalText(input.title),
      description: sanitizeOptionalText(input.description, 10000),
      price: input.price ?? null,
      subjectId: input.subject_id ?? null,
      gradeId: input.grade_id ?? null,
      examId: input.exam_id ?? null,
      isDownloadable: input.is_downloadable ?? null,
      isHighValue: input.is_high_value ?? null,
      status: input.status ?? null,
    });
    if (!result.updated) return fail("Không tìm thấy tài liệu để cập nhật.");
    revalidatePath("/admin/documents");
    return ok();
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Cập nhật thất bại.");
  }
}
