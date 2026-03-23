import type { DocumentUploadPayload, DocumentUploadRepository, UploadedPath } from "@/lib/domain/document-upload/ports";

export type UploadOrchestratorResult = { ok: true } | { ok: false; error: string };

function buildIdempotencyKey(payload: DocumentUploadPayload): string {
  const previewPart = payload.previewFile
    ? `${payload.previewFile.name}:${payload.previewFile.size}:${payload.previewFile.lastModified}`
    : "nopreview";
  return `${payload.title.trim()}|${payload.mainFile.name}:${payload.mainFile.size}:${payload.mainFile.lastModified}|${payload.coverFile.name}:${payload.coverFile.size}:${payload.coverFile.lastModified}|${previewPart}`.slice(
    0,
    500
  );
}

export async function runDocumentUploadOrchestrator(input: {
  repository: DocumentUploadRepository;
  userId: string;
  payload: DocumentUploadPayload;
}): Promise<UploadOrchestratorResult> {
  const uploadedPaths: UploadedPath[] = [];
  let hasPersistedDocumentRow = false;
  let currentSessionId: string | null = null;
  let persistedDocumentId: string | null = null;

  try {
    const main = await input.repository.uploadMainPdf({
      file: input.payload.mainFile,
      gradeId: input.payload.gradeId,
    });
    uploadedPaths.push(main);

    const cover = await input.repository.uploadCoverImage(input.payload.coverFile);
    uploadedPaths.push({ bucket: cover.bucket, path: cover.path });

    let previewPublicUrl: string | null = null;
    if (input.payload.previewFile && input.payload.previewFile.size > 0) {
      const preview = await input.repository.uploadPreviewPdf(input.payload.previewFile);
      uploadedPaths.push({ bucket: preview.bucket, path: preview.path });
      previewPublicUrl = preview.publicUrl;
    }

    const sessionId = await input.repository.createUploadSession({
      userId: input.userId,
      payload: input.payload,
      mainPath: main.path,
      coverPublicUrl: cover.publicUrl,
      previewPublicUrl,
      idempotencyKey: buildIdempotencyKey(input.payload),
    });
    currentSessionId = sessionId;

    if (!sessionId) {
      await input.repository.removeUploaded(uploadedPaths);
      return { ok: false, error: "Không thể khởi tạo upload session." };
    }

    const finalized = await input.repository.finalizeFromSession(sessionId);
    if (finalized.ok) return { ok: true };
    if (!finalized.isAmbiguousFinalize) {
      return { ok: false, error: `Finalize document: ${finalized.error ?? "unknown error"}` };
    }

    const documentId = await input.repository.insertDocumentFallback({
      payload: input.payload,
      mainPath: main.path,
      coverPublicUrl: cover.publicUrl,
      previewPublicUrl,
      sessionId,
    });

    if (!documentId) {
      return {
        ok: false,
        error: `Finalize document: ${finalized.error ?? "unknown error"}. Manual fallback failed: insert error`,
      };
    }
    hasPersistedDocumentRow = true;
    persistedDocumentId = documentId;

    await input.repository.enqueuePostprocessJob({ documentId, sessionId });
    await input.repository.markSessionFinalized(sessionId);
    return { ok: true };
  } catch (error) {
    // Never delete files once a document row exists; keep assets for recovery/repair.
    if (!hasPersistedDocumentRow) {
      await input.repository.removeUploaded(uploadedPaths);
    } else {
      const errorMessage = error instanceof Error ? error.message : "Upload failed";
      try {
        if (persistedDocumentId) {
          await input.repository.markDocumentFailed({ documentId: persistedDocumentId });
        }
        if (currentSessionId) {
          await input.repository.markSessionFailed({
            sessionId: currentSessionId,
            errorMessage: `needs_repair: ${errorMessage}`,
          });
        }
      } catch {
        // best-effort remediation markers; do not mask original error
      }
    }
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Upload failed",
    };
  }
}
