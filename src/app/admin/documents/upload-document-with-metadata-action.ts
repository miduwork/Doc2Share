"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { createSupabaseDocumentUploadRepository, runDocumentUploadOrchestrator } from "@/lib/domain/document-upload";
import { requireDocumentManagerContext } from "@/lib/admin/guards";
import { revalidatePath, revalidateTag } from "next/cache";
import { ok, fail, type ActionResult } from "@/lib/action-result";
import { parseUploadFormData } from "./parse-upload-form-data";

/**
 * Upload main PDF to private_documents, cover + preview to public_assets.
 * Insert document row; on insert failure, delete uploaded files (rollback).
 * Accepts FormData so File objects are passed correctly to the Server Action.
 */
export async function uploadDocumentWithMetadata(formData: FormData): Promise<ActionResult<void>> {
  const payload = parseUploadFormData(formData);
  if (!payload.mainFile || !payload.coverFile) return fail("Thiếu file chính hoặc ảnh bìa.");

  const guard = await requireDocumentManagerContext();
  if (!guard.ok) return fail(guard.error);

  const supabase = await createClient();

  const serviceRole = createServiceRoleClient();

  const repository = createSupabaseDocumentUploadRepository({
    supabase,
    serviceRole,
  });
  const result = await runDocumentUploadOrchestrator({
    repository,
    userId: guard.context.userId,
    payload: {
      title: payload.title,
      description: payload.description,
      price: payload.price,
      subjectId: payload.subject_id,
      gradeId: payload.grade_id,
      examId: payload.exam_id,
      isDownloadable: payload.is_downloadable,
      mainFile: payload.mainFile,
      coverFile: payload.coverFile,
      previewFile: payload.previewFile,
    },
  });

  if (!result.ok) return fail(result.error);
  revalidatePath("/admin/documents");
  revalidatePath("/");
  revalidatePath("/cua-hang");
  revalidateTag("documents");
  revalidateTag("reviews");
  revalidateTag("permissions");
  return ok();
}
