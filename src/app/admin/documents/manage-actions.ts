/**
 * Barrel: quản lý tài liệu admin — import từ `@/app/admin/documents/manage-actions` như cũ.
 * `"use server"` nằm trong từng file action tương ứng.
 */

/** Metadata / CRUD */
export { updateDocumentMetadata } from "./update-document-metadata-action";

/** Vòng đời: xóa, trạng thái, retry pipeline */
export { deleteDocument, setDocumentStatus, retryDocumentProcessing } from "./document-lifecycle-actions";

/** Duyệt publish */
export {
  submitDocumentForApproval,
  approveDocument,
  rejectDocument,
} from "./document-approval-actions";

/** Bulk */
export { bulkManageDocuments, type BulkDocumentAction } from "./bulk-manage-documents-action";

/** Export CSV */
export { exportDocumentsCsv } from "./export-documents-csv-action";

/** Super-admin */
export { rollbackDocumentToVersion } from "./rollback-document-version-action";

/** Dùng khi test / override repository */
export type { DocumentsActionDeps } from "./document-manage-action-shared";
