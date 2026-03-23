export type DocumentUploadPayload = {
  title: string;
  description: string | null;
  price: number;
  subjectId: number | null;
  gradeId: number | null;
  examId: number | null;
  isDownloadable: boolean;
  mainFile: File;
  coverFile: File;
  previewFile: File | null;
};

export type UploadedPath = { bucket: string; path: string };

export type UploadedCover = {
  bucket: string;
  path: string;
  publicUrl: string;
};

export type UploadedPreview = {
  bucket: string;
  path: string;
  publicUrl: string;
};

export type CreateUploadSessionInput = {
  userId: string;
  payload: DocumentUploadPayload;
  mainPath: string;
  coverPublicUrl: string;
  previewPublicUrl: string | null;
  idempotencyKey: string;
};

export type FinalizeUploadResult = {
  ok: boolean;
  error?: string;
  isAmbiguousFinalize?: boolean;
};

export type ManualInsertFromSessionInput = {
  payload: DocumentUploadPayload;
  mainPath: string;
  coverPublicUrl: string;
  previewPublicUrl: string | null;
  sessionId: string;
};

export interface DocumentUploadRepository {
  uploadMainPdf(_input: { file: File; gradeId: number | null }): Promise<UploadedPath>;
  uploadCoverImage(_file: File): Promise<UploadedCover>;
  uploadPreviewPdf(_file: File): Promise<UploadedPreview>;
  removeUploaded(_paths: UploadedPath[]): Promise<void>;
  createUploadSession(_input: CreateUploadSessionInput): Promise<string | null>;
  finalizeFromSession(_sessionId: string): Promise<FinalizeUploadResult>;
  insertDocumentFallback(_input: ManualInsertFromSessionInput): Promise<string | null>;
  enqueuePostprocessJob(_input: { documentId: string; sessionId: string }): Promise<void>;
  markSessionFinalized(_sessionId: string): Promise<void>;
  markSessionFailed(_input: { sessionId: string; errorMessage: string }): Promise<void>;
  markDocumentFailed(_input: { documentId: string }): Promise<void>;
}
