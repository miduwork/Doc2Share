import type {
  CreateUploadSessionInput,
  DocumentUploadRepository,
  FinalizeUploadResult,
  ManualInsertFromSessionInput,
  UploadedCover,
  UploadedPath,
  UploadedPreview,
} from "@/lib/domain/document-upload/ports";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

type UserSupabaseClient = Awaited<ReturnType<typeof createClient>>;
type ServiceRoleClient = ReturnType<typeof createServiceRoleClient>;

type CreateSupabaseDocumentUploadRepositoryInput = {
  supabase: UserSupabaseClient;
  serviceRole: ServiceRoleClient;
  mainBucket?: string;
  publicBucket?: string;
};

export function createSupabaseDocumentUploadRepository(
  input: CreateSupabaseDocumentUploadRepositoryInput
): DocumentUploadRepository {
  const mainBucket = input.mainBucket ?? "private_documents";
  const publicBucket = input.publicBucket ?? "public_assets";

  return {
    async uploadMainPdf({ file, gradeId }) {
      const ext = file.name.toLowerCase().endsWith(".pdf") ? "pdf" : "pdf";
      const path = `documents/${gradeId ?? 0}/${crypto.randomUUID()}.${ext}`;
      const { error } = await input.supabase.storage
        .from(mainBucket)
        .upload(path, file, { upsert: false, contentType: "application/pdf" });
      if (error) throw new Error(`Main PDF: ${error.message}`);
      return { bucket: mainBucket, path };
    },
    async uploadCoverImage(file: File): Promise<UploadedCover> {
      const ext = file.name.toLowerCase().endsWith(".png") ? "png" : "jpg";
      const path = `covers/${crypto.randomUUID()}.${ext}`;
      const contentType = file.type || (ext === "png" ? "image/png" : "image/jpeg");
      const { error } = await input.supabase.storage
        .from(publicBucket)
        .upload(path, file, { upsert: false, contentType });
      if (error) throw new Error(`Cover image: ${error.message}`);
      const { data: urlData } = input.supabase.storage.from(publicBucket).getPublicUrl(path);
      return { bucket: publicBucket, path, publicUrl: urlData.publicUrl };
    },
    async uploadPreviewPdf(file: File): Promise<UploadedPreview> {
      const path = `previews/${crypto.randomUUID()}.pdf`;
      const { error } = await input.supabase.storage
        .from(publicBucket)
        .upload(path, file, { upsert: false, contentType: "application/pdf" });
      if (error) throw new Error(`Preview PDF: ${error.message}`);
      const { data: urlData } = input.supabase.storage.from(publicBucket).getPublicUrl(path);
      return { bucket: publicBucket, path, publicUrl: urlData.publicUrl };
    },
    async removeUploaded(paths: UploadedPath[]) {
      for (const { bucket, path } of paths) {
        await input.supabase.storage.from(bucket).remove([path]);
      }
    },
    async createUploadSession(params: CreateUploadSessionInput): Promise<string | null> {
      const { data, error } = await input.serviceRole.rpc("create_document_upload_session", {
        p_created_by: params.userId,
        p_title: params.payload.title,
        p_description: params.payload.description || null,
        p_price: params.payload.price,
        p_subject_id: params.payload.subjectId,
        p_grade_id: params.payload.gradeId,
        p_exam_id: params.payload.examId,
        p_is_downloadable: params.payload.isDownloadable,
        p_main_file_path: params.mainPath,
        p_cover_file_path: params.coverPublicUrl,
        p_preview_file_path: params.previewPublicUrl,
        p_idempotency_key: params.idempotencyKey,
      });
      if (error) throw new Error(`Upload session: ${error.message}`);
      const row = Array.isArray(data) ? data[0] : data;
      return ((row as { session_id?: string } | null)?.session_id ?? null) as string | null;
    },
    async finalizeFromSession(sessionId: string): Promise<FinalizeUploadResult> {
      const { error } = await input.serviceRole.rpc("create_document_from_upload_session", {
        p_session_id: sessionId,
      });
      if (!error) return { ok: true };
      const isAmbiguousFinalize = /document_id/i.test(error.message) && /ambiguous/i.test(error.message);
      return { ok: false, error: error.message, isAmbiguousFinalize };
    },
    async insertDocumentFallback(params: ManualInsertFromSessionInput): Promise<string | null> {
      const { data, error } = await input.serviceRole
        .from("documents")
        .insert({
          title: params.payload.title,
          description: params.payload.description || null,
          price: params.payload.price,
          subject_id: params.payload.subjectId,
          grade_id: params.payload.gradeId,
          exam_id: params.payload.examId,
          is_downloadable: params.payload.isDownloadable,
          file_path: params.mainPath,
          preview_url: params.previewPublicUrl,
          preview_text: null,
          thumbnail_url: params.coverPublicUrl,
          status: "processing",
          upload_session_id: params.sessionId,
        })
        .select("id")
        .limit(1);
      if (error) throw new Error(error.message);
      return (data?.[0]?.id as string | undefined) ?? null;
    },
    async enqueuePostprocessJob(inputJob: { documentId: string; sessionId: string }) {
      const { error } = await input.serviceRole.from("document_processing_jobs").upsert(
        {
          document_id: inputJob.documentId,
          upload_session_id: inputJob.sessionId,
          job_type: "document_postprocess",
          status: "queued",
          run_after: new Date().toISOString(),
        },
        { onConflict: "document_id,job_type" }
      );
      if (error) throw new Error(error.message);
    },
    async markSessionFinalized(sessionId: string) {
      const { error } = await input.serviceRole
        .from("document_upload_sessions")
        .update({ status: "finalized", finalized_at: new Date().toISOString(), error_message: null })
        .eq("id", sessionId);
      if (error) throw new Error(error.message);
    },
    async markSessionFailed({ sessionId, errorMessage }: { sessionId: string; errorMessage: string }) {
      const { error } = await input.serviceRole
        .from("document_upload_sessions")
        .update({
          status: "failed",
          error_message: errorMessage.slice(0, 1000),
        })
        .eq("id", sessionId);
      if (error) throw new Error(error.message);
    },
    async markDocumentFailed({ documentId }: { documentId: string }) {
      const { error } = await input.serviceRole
        .from("documents")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", documentId);
      if (error) throw new Error(error.message);
    },
  };
}
