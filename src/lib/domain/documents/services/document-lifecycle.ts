import type { DocumentPublishGate } from "../ports";

/**
 * Validates if a document meets all criteria to be published (ready status).
 * This is the "Publish Gate" logic extracted for unit testing.
 */
export function validateDocumentForPublish(doc: DocumentPublishGate): { ok: true } | { ok: false; error: string } {
  const missing: string[] = [];
  if (!doc.title) missing.push("title");
  if (!doc.file_path) missing.push("file_path");
  if (!doc.thumbnail_url) missing.push("thumbnail_url");

  if (missing.length > 0) {
    return { ok: false, error: `Không thể publish. Thiếu: ${missing.join(", ")}.` };
  }

  if (doc.approval_status !== "approved") {
    return { ok: false, error: "Không thể publish. Tài liệu chưa được duyệt (approval_status=approved)." };
  }

  return { ok: true };
}
