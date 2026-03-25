import "server-only";

export type DocumentPublishGate = {
  id: string;
  title: string | null;
  file_path: string | null;
  thumbnail_url: string | null;
  status: string | null;
  approval_status: string | null;
};

export type DocumentRetryContext = {
  id: string;
  upload_session_id: string | null;
};

export type UpdateDocumentAdminInput = {
  documentId: string;
  title?: string | null;
  description?: string | null;
  price?: number | null;
  subjectId?: number | null;
  gradeId?: number | null;
  examId?: number | null;
  isDownloadable?: boolean | null;
  isHighValue?: boolean | null;
  status?: "draft" | "processing" | "ready" | "failed" | "archived" | "deleted" | null;
};

export interface DocumentsAdminRepository {
  updateDocumentAdmin(_input: UpdateDocumentAdminInput): Promise<{ updated: boolean }>;
  deleteDocumentAdmin(_input: { documentId: string; hardDelete: boolean }): Promise<{ deleted: boolean }>;
  getDocumentPublishGate(_documentId: string): Promise<DocumentPublishGate | null>;
  getDocumentRetryContext(_documentId: string): Promise<DocumentRetryContext | null>;
  queueDocumentPostprocessJob(_input: { documentId: string; uploadSessionId: string | null }): Promise<void>;
  submitDocumentForApprovalAdmin(_input: { documentId: string; actorId: string; note?: string | null }): Promise<{ submitted: boolean }>;
  approveDocumentPublishAdmin(_input: { documentId: string; actorId: string; note?: string | null }): Promise<{ approved: boolean }>;
  rejectDocumentPublishAdmin(_input: { documentId: string; actorId: string; note: string }): Promise<{ rejected: boolean }>;
}
