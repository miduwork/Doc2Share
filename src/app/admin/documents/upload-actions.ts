/**
 * Barrel: các action upload / nháp — import từ `@/app/admin/documents/upload-actions` như cũ.
 * `"use server"` nằm trong từng file action (`upload-document-with-metadata-action`, `document-draft-upload-actions`).
 */

export { uploadDocumentWithMetadata } from "./upload-document-with-metadata-action";

export {
  saveDocumentDraft,
  getDocumentDrafts,
  uploadDocumentFromDraft,
  type SaveDraftInput,
  type DraftSessionRow,
} from "./document-draft-upload-actions";
