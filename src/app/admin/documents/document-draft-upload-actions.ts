"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { createSupabaseDocumentUploadRepository } from "@/lib/domain/document-upload";
import { requireDocumentManagerContext } from "@/lib/admin/guards";
import { revalidatePath } from "next/cache";
import { ok, fail, type ActionResult } from "@/lib/action-result";
import { parseUploadFormData } from "./parse-upload-form-data";

export type SaveDraftInput = {
  title: string;
  description?: string | null;
  price?: number;
  subject_id?: number | null;
  grade_id?: number | null;
  exam_id?: number | null;
  is_downloadable?: boolean;
  session_id?: string | null;
};

/**
 * Lưu nháp metadata (không cần file). Tạo mới hoặc cập nhật session draft.
 * Trả về session_id để sau này có thể gắn file và finalize.
 */
export async function saveDocumentDraft(input: SaveDraftInput): Promise<ActionResult<{ session_id: string }>> {
  const guard = await requireDocumentManagerContext();
  if (!guard.ok) return fail(guard.error);

  const title = (input.title ?? "").trim();
  if (!title) return fail("Nhập tiêu đề để lưu nháp.");

  const serviceRole = createServiceRoleClient();
  const userId = guard.context.userId;

  if (input.session_id?.trim()) {
    const { data: upd, error: err } = await serviceRole.rpc("update_document_upload_session_metadata", {
      p_session_id: input.session_id.trim(),
      p_created_by: userId,
      p_title: title,
      p_description: input.description ?? null,
      p_price: input.price ?? 0,
      p_subject_id: input.subject_id ?? null,
      p_grade_id: input.grade_id ?? null,
      p_exam_id: input.exam_id ?? null,
      p_is_downloadable: input.is_downloadable ?? false,
    });
    if (err) return fail(err.message);
    const row = Array.isArray(upd) ? upd[0] : upd;
    if (!(row as { updated?: boolean })?.updated) return fail("Không tìm thấy nháp hoặc không có quyền sửa.");
    revalidatePath("/admin/documents");
    return ok({ session_id: input.session_id.trim() });
  }

  const { data: created, error } = await serviceRole.rpc("create_document_upload_session", {
    p_created_by: userId,
    p_title: title,
    p_description: input.description ?? null,
    p_price: input.price ?? 0,
    p_subject_id: input.subject_id ?? null,
    p_grade_id: input.grade_id ?? null,
    p_exam_id: input.exam_id ?? null,
    p_is_downloadable: input.is_downloadable ?? false,
    p_main_file_path: null,
    p_cover_file_path: null,
    p_preview_file_path: null,
    p_idempotency_key: null,
  });
  if (error) return fail(error.message);
  const row = Array.isArray(created) ? created[0] : created;
  const sessionId = (row as { session_id?: string })?.session_id;
  if (!sessionId) return fail("Không tạo được phiên nháp.");
  revalidatePath("/admin/documents");
  return ok({ session_id: sessionId });
}

export type DraftSessionRow = {
  id: string;
  title: string;
  description: string | null;
  price: number;
  subject_id: number | null;
  grade_id: number | null;
  exam_id: number | null;
  is_downloadable: boolean;
  created_at: string;
};

/**
 * Lấy danh sách nháp (draft sessions) của user hiện tại.
 */
export async function getDocumentDrafts(): Promise<ActionResult<DraftSessionRow[]>> {
  const guard = await requireDocumentManagerContext();
  if (!guard.ok) return fail(guard.error);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("document_upload_sessions")
    .select("id, title, description, price, subject_id, grade_id, exam_id, is_downloadable, created_at")
    .eq("status", "draft")
    .eq("created_by", guard.context.userId)
    .order("created_at", { ascending: false });

  if (error) return fail(error.message);
  return ok((data ?? []) as DraftSessionRow[]);
}

/**
 * Gắn file cho nháp rồi finalize: upload file → set_document_upload_session_files → create_document_from_upload_session.
 * FormData phải có session_id (hidden), mainFile, coverFile, previewFile (optional).
 */
export async function uploadDocumentFromDraft(formData: FormData): Promise<ActionResult<void>> {
  const guard = await requireDocumentManagerContext();
  if (!guard.ok) return fail(guard.error);

  const sessionId = (formData.get("session_id") as string)?.trim();
  if (!sessionId) return fail("Thiếu session_id nháp.");

  const payload = parseUploadFormData(formData);
  if (!payload.mainFile || !payload.coverFile) return fail("Thiếu file chính hoặc ảnh bìa.");

  const supabase = await createClient();
  const serviceRole = createServiceRoleClient();
  const repository = createSupabaseDocumentUploadRepository({ supabase, serviceRole });
  const userId = guard.context.userId;

  const uploadedPaths: { bucket: string; path: string }[] = [];
  try {
    const main = await repository.uploadMainPdf({
      file: payload.mainFile,
      gradeId: payload.grade_id,
    });
    uploadedPaths.push(main);

    const cover = await repository.uploadCoverImage(payload.coverFile);
    uploadedPaths.push({ bucket: cover.bucket, path: cover.path });

    let previewPublicUrl: string | null = null;
    if (payload.previewFile && payload.previewFile.size > 0) {
      const preview = await repository.uploadPreviewPdf(payload.previewFile);
      uploadedPaths.push({ bucket: preview.bucket, path: preview.path });
      previewPublicUrl = preview.publicUrl;
    }

    const { data: setRows, error: setErr } = await serviceRole.rpc("set_document_upload_session_files", {
      p_session_id: sessionId,
      p_created_by: userId,
      p_main_file_path: main.path,
      p_cover_file_path: cover.publicUrl,
      p_preview_file_path: previewPublicUrl,
    });
    if (setErr) {
      await repository.removeUploaded(uploadedPaths);
      return fail(`Gắn file thất bại: ${setErr.message}`);
    }
    const setRow = Array.isArray(setRows) ? setRows[0] : setRows;
    if (!(setRow as { updated?: boolean })?.updated) {
      await repository.removeUploaded(uploadedPaths);
      return fail("Không tìm thấy nháp hoặc nháp đã có file.");
    }

    const { error: finalizeErr } = await serviceRole.rpc("create_document_from_upload_session", {
      p_session_id: sessionId,
    });
    if (finalizeErr) {
      return fail(`Hoàn tất thất bại: ${finalizeErr.message}`);
    }

    revalidatePath("/admin/documents");
    return ok();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Lỗi gắn file";
    try {
      await repository.removeUploaded(uploadedPaths);
    } catch {
      // ignore
    }
    return fail(msg);
  }
}
