import "server-only";

import type {
  DocumentPublishGate,
  DocumentRetryContext,
  DocumentsAdminRepository,
  UpdateDocumentAdminInput,
} from "@/lib/domain/documents/ports";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

type UpdateDocumentRow = { updated?: boolean } | null;
type DeleteDocumentRow = { deleted?: boolean } | null;
type SubmitApprovalRow = { submitted?: boolean } | null;
type ApproveRow = { approved?: boolean } | null;
type RejectRow = { rejected?: boolean } | null;

export function createSupabaseDocumentsAdminRepository(): DocumentsAdminRepository {
  const serviceRole = createServiceRoleClient();

  return {
    async updateDocumentAdmin(input: UpdateDocumentAdminInput) {
      const { data, error } = await serviceRole.rpc("update_document_admin", {
        p_document_id: input.documentId,
        p_title: input.title ?? null,
        p_description: input.description ?? null,
        p_price: input.price ?? null,
        p_subject_id: input.subjectId ?? null,
        p_grade_id: input.gradeId ?? null,
        p_exam_id: input.examId ?? null,
        p_is_downloadable: input.isDownloadable ?? null,
        p_is_high_value: input.isHighValue ?? null,
        p_status: input.status ?? null,
      });
      if (error) throw new Error(error.message);
      const row = (Array.isArray(data) ? data[0] : data) as UpdateDocumentRow;
      return { updated: Boolean(row?.updated) };
    },
    async deleteDocumentAdmin(input: { documentId: string; hardDelete: boolean }) {
      const { data, error } = await serviceRole.rpc("delete_document_admin", {
        p_document_id: input.documentId,
        p_hard_delete: input.hardDelete,
      });
      if (error) throw new Error(error.message);
      const row = (Array.isArray(data) ? data[0] : data) as DeleteDocumentRow;
      return { deleted: Boolean(row?.deleted) };
    },
    async getDocumentPublishGate(documentId: string): Promise<DocumentPublishGate | null> {
      const { data, error } = await serviceRole
        .from("documents")
        .select("id, title, file_path, thumbnail_url, status, approval_status")
        .eq("id", documentId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return null;

      return {
        id: String(data.id),
        title: (data.title as string | null | undefined) ?? null,
        file_path: (data.file_path as string | null | undefined) ?? null,
        thumbnail_url: (data.thumbnail_url as string | null | undefined) ?? null,
        status: (data.status as string | null | undefined) ?? null,
        approval_status: (data.approval_status as string | null | undefined) ?? null,
      };
    },
    async getDocumentRetryContext(documentId: string): Promise<DocumentRetryContext | null> {
      const { data, error } = await serviceRole
        .from("documents")
        .select("id, upload_session_id")
        .eq("id", documentId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return null;

      return {
        id: String(data.id),
        upload_session_id: (data.upload_session_id as string | null | undefined) ?? null,
      };
    },
    async queueDocumentPostprocessJob(input: { documentId: string; uploadSessionId: string | null }) {
      const { error } = await serviceRole.from("document_processing_jobs").upsert(
        {
          document_id: input.documentId,
          upload_session_id: input.uploadSessionId,
          job_type: "document_postprocess",
          status: "queued",
          run_after: new Date().toISOString(),
          last_error: null,
        },
        { onConflict: "document_id,job_type" }
      );
      if (error) throw new Error(error.message);
    },
    async submitDocumentForApprovalAdmin(input: { documentId: string; actorId: string; note?: string | null }) {
      const { data, error } = await serviceRole.rpc("submit_document_for_approval", {
        p_document_id: input.documentId,
        p_actor_id: input.actorId,
        p_note: input.note ?? null,
      });
      if (error) throw new Error(error.message);
      const row = (Array.isArray(data) ? data[0] : data) as SubmitApprovalRow;
      return { submitted: Boolean(row?.submitted) };
    },
    async approveDocumentPublishAdmin(input: { documentId: string; actorId: string; note?: string | null }) {
      const { data, error } = await serviceRole.rpc("approve_document_publish", {
        p_document_id: input.documentId,
        p_actor_id: input.actorId,
        p_note: input.note ?? null,
      });
      if (error) throw new Error(error.message);
      const row = (Array.isArray(data) ? data[0] : data) as ApproveRow;
      return { approved: Boolean(row?.approved) };
    },
    async rejectDocumentPublishAdmin(input: { documentId: string; actorId: string; note: string }) {
      const { data, error } = await serviceRole.rpc("reject_document_publish", {
        p_document_id: input.documentId,
        p_actor_id: input.actorId,
        p_note: input.note,
      });
      if (error) throw new Error(error.message);
      const row = (Array.isArray(data) ? data[0] : data) as RejectRow;
      return { rejected: Boolean(row?.rejected) };
    },
  };
}
