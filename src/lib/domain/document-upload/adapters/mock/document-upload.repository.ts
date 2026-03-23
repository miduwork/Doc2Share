import type {
  CreateUploadSessionInput,
  DocumentUploadPayload,
  DocumentUploadRepository,
  FinalizeUploadResult,
  ManualInsertFromSessionInput,
  UploadedCover,
  UploadedPath,
  UploadedPreview,
} from "@/lib/domain/document-upload/ports";

type MockDocumentUploadState = {
  mainUpload?: UploadedPath;
  coverUpload?: UploadedCover;
  previewUpload?: UploadedPreview;
  sessionId?: string | null;
  finalizeResult?: FinalizeUploadResult;
  fallbackDocumentId?: string | null;
  calls: {
    removed: UploadedPath[];
    queue: { documentId: string; sessionId: string }[];
    finalizedSessions: string[];
    failedSessions: { sessionId: string; errorMessage: string }[];
    failedDocuments: { documentId: string }[];
    createSession: CreateUploadSessionInput[];
    fallback: ManualInsertFromSessionInput[];
  };
};

export function createMockDocumentUploadRepository(input?: {
  overrides?: Partial<DocumentUploadRepository>;
  seed?: Partial<MockDocumentUploadState>;
}) {
  const state: MockDocumentUploadState = {
    mainUpload: input?.seed?.mainUpload ?? { bucket: "private_documents", path: "documents/0/mock-main.pdf" },
    coverUpload:
      input?.seed?.coverUpload ??
      { bucket: "public_assets", path: "covers/mock-cover.jpg", publicUrl: "https://example.test/mock-cover.jpg" },
    previewUpload:
      input?.seed?.previewUpload ??
      { bucket: "public_assets", path: "previews/mock-preview.pdf", publicUrl: "https://example.test/mock-preview.pdf" },
    sessionId: input?.seed?.sessionId ?? "session-mock-1",
    finalizeResult: input?.seed?.finalizeResult ?? { ok: true },
    fallbackDocumentId: input?.seed?.fallbackDocumentId ?? "doc-mock-1",
    calls: input?.seed?.calls ?? {
      removed: [],
      queue: [],
      finalizedSessions: [],
      failedSessions: [],
      failedDocuments: [],
      createSession: [],
      fallback: [],
    },
  };

  const repository: DocumentUploadRepository = {
    async uploadMainPdf() {
      return state.mainUpload as UploadedPath;
    },
    async uploadCoverImage() {
      return state.coverUpload as UploadedCover;
    },
    async uploadPreviewPdf() {
      return state.previewUpload as UploadedPreview;
    },
    async removeUploaded(paths: UploadedPath[]) {
      state.calls.removed.push(...paths);
    },
    async createUploadSession(params: CreateUploadSessionInput) {
      state.calls.createSession.push(params);
      return state.sessionId ?? null;
    },
    async finalizeFromSession() {
      return state.finalizeResult as FinalizeUploadResult;
    },
    async insertDocumentFallback(params: ManualInsertFromSessionInput) {
      state.calls.fallback.push(params);
      return state.fallbackDocumentId ?? null;
    },
    async enqueuePostprocessJob(job: { documentId: string; sessionId: string }) {
      state.calls.queue.push(job);
    },
    async markSessionFinalized(sessionId: string) {
      state.calls.finalizedSessions.push(sessionId);
    },
    async markSessionFailed(inputFailure: { sessionId: string; errorMessage: string }) {
      state.calls.failedSessions.push(inputFailure);
    },
    async markDocumentFailed(inputFailure: { documentId: string }) {
      state.calls.failedDocuments.push(inputFailure);
    },
    ...(input?.overrides ?? {}),
  };

  return { repository, state };
}

export function createMockUploadPayload(): DocumentUploadPayload {
  return {
    title: "Mock Upload",
    description: "Mock description",
    price: 10000,
    subjectId: 1,
    gradeId: 12,
    examId: 2,
    isDownloadable: true,
    mainFile: new File(["main"], "main.pdf", { type: "application/pdf" }),
    coverFile: new File(["cover"], "cover.jpg", { type: "image/jpeg" }),
    previewFile: new File(["preview"], "preview.pdf", { type: "application/pdf" }),
  };
}
