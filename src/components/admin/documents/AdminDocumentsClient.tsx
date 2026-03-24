"use client";

import { useEffect, useState } from "react";
import UploadDocument from "./UploadDocument";
import DocumentFilters from "./DocumentFilters";
import BulkActionsBar from "./BulkActionsBar";
import DocumentTable from "./DocumentTable";
import EditDocumentModal from "./EditDocumentModal";
import BulkHistoryPanel from "./BulkHistoryPanel";
import type { Category } from "@/lib/types";
import { toast } from "sonner";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { BulkHistoryRow, DocRow, FiltersState, JobRow } from "./admin-documents.types";
import { useDocumentsSelectionAndBulk } from "./hooks/useDocumentsSelectionAndBulk";
import { useAdminDocumentsActions } from "./hooks/useAdminDocumentsActions";
import { useAdminDocumentsModals } from "./hooks/useAdminDocumentsModals";

function parseWorkspaceParam(value: string | null): "upload" | "manage" | "bulk-history" {
  if (value === "manage" || value === "bulk-history") return value;
  return "upload";
}

type Props = {
  initialDocs: DocRow[];
  categories: Category[];
  jobs: JobRow[];
  bulkLogs: BulkHistoryRow[];
  initialWorkspace: "upload" | "manage" | "bulk-history";
  adminRole: "super_admin" | "content_manager" | "support_agent" | null;
  filters: FiltersState;
};

export default function AdminDocumentsClient({
  initialDocs,
  categories,
  jobs,
  bulkLogs,
  initialWorkspace,
  adminRole,
  filters,
}: Props) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [docs, setDocs] = useState(initialDocs);
  const [workspace, setWorkspace] = useState<"upload" | "manage" | "bulk-history">(initialWorkspace);
  const {
    activeTab,
    setActiveTab,
    selectedDocIds,
    setSelectedDocIds,
    bulkAction,
    setBulkAction,
    bulkRejectNote,
    setBulkRejectNote,
    toggleDoc,
    selectAllFromDocs,
  } = useDocumentsSelectionAndBulk();
  const [exporting, setExporting] = useState(false);
  const router = useRouter();
  const {
    editingDocId,
    openEditModal,
    editForm,
    setEditForm,
    rejectDocId,
    openRejectModal,
    rejectNote,
    setRejectNote,
    getValidatedRejectNote,
    closeEditModal,
    closeRejectModal,
  } = useAdminDocumentsModals();

  const subjects = categories.filter((c) => c.type === "subject");
  const grades = categories.filter((c) => c.type === "grade");
  const exams = categories.filter((c) => c.type === "exam");
  const jobByDoc = jobs.reduce<Record<string, JobRow>>((acc, j) => {
    acc[j.document_id] = j;
    return acc;
  }, {});

  function buildQuery(next: Partial<Record<string, string | number>>) {
    const q = new URLSearchParams({
      q: filters.q,
      status: filters.status,
      subject_id: filters.subject_id,
      grade_id: filters.grade_id,
      exam_id: filters.exam_id,
      sort: filters.sort,
      page: String(filters.page),
      page_size: String(filters.pageSize),
      preset: filters.preset,
    });
    for (const [k, v] of Object.entries(next)) q.set(k, String(v));
    return `/admin/documents?${q.toString()}`;
  }
  const {
    updateDoc,
    removeDoc,
    hardDeleteDoc,
    changeStatus,
    retryProcessing,
    runBulk,
    submitApproval,
    approve,
    confirmReject,
    saveEditModal,
    exportCsv,
  } = useAdminDocumentsActions({
    adminRole,
    filters,
    router,
    selectedDocIds,
    bulkRejectNote,
    rejectDocId,
    editingDocId,
    editForm,
    closeEditModal,
    closeRejectModal,
    setDocs,
    setSelectedDocIds,
    setBulkRejectNote,
    setExporting,
  });

  async function handleConfirmReject() {
    const validated = getValidatedRejectNote();
    if (!validated.ok) {
      toast.error(validated.error);
      return;
    }
    await confirmReject(validated.note);
  }

  useEffect(() => {
    setWorkspace(parseWorkspaceParam(searchParams.get("workspace")));
  }, [searchParams]);

  function handleWorkspaceChange(next: "upload" | "manage" | "bulk-history") {
    setWorkspace(next);
    const params = new URLSearchParams(searchParams.toString());
    params.set("workspace", next);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="premium-panel flex flex-wrap items-center gap-2 rounded-xl p-2">
        <button
          type="button"
          onClick={() => handleWorkspaceChange("upload")}
          className={`admin-btn-sm ${
            workspace === "upload"
              ? "bg-primary text-white"
              : "border border-line bg-surface text-fg hover:bg-surface-muted"
          }`}
        >
          Tải tài liệu mới
        </button>
        <button
          type="button"
          onClick={() => handleWorkspaceChange("manage")}
          className={`admin-btn-sm ${
            workspace === "manage"
              ? "bg-primary text-white"
              : "border border-line bg-surface text-fg hover:bg-surface-muted"
          }`}
        >
          Quản lý tài liệu
        </button>
        <button
          type="button"
          onClick={() => handleWorkspaceChange("bulk-history")}
          className={`admin-btn-sm ${
            workspace === "bulk-history"
              ? "bg-primary text-white"
              : "border border-line bg-surface text-fg hover:bg-surface-muted"
          }`}
        >
          Lịch sử bulk
        </button>
      </div>
      {workspace === "upload" ? (
        <section className="space-y-3" aria-label="Khu tải tài liệu mới">
          <div className="rounded-lg border border-primary-200 bg-primary-50/50 p-2.5 text-xs text-primary-800 dark:border-primary-800 dark:bg-primary-900/20 dark:text-primary-200">
            <strong>Luồng tải mới:</strong> tạo nháp hoặc tải trực tiếp, sau đó chuyển sang khu quản lý để duyệt và vận hành.
          </div>
          <UploadDocument categories={categories} onSuccess={() => router.refresh()} />
        </section>
      ) : workspace === "manage" ? (
        <section className="space-y-3" aria-label="Khu quản lý tài liệu">
          <div className="rounded-lg border border-primary-200 bg-primary-50/50 p-2.5 text-xs text-primary-800 dark:border-primary-800 dark:bg-primary-900/20 dark:text-primary-200">
            <strong>Luồng quản lý:</strong> Nháp → Gửi duyệt → Chờ duyệt → Duyệt/Từ chối → Ready hoặc Archived.
          </div>
          <DocumentFilters
            filters={filters}
            buildQuery={buildQuery}
            subjects={subjects}
            grades={grades}
            exams={exams}
            onExportCsv={exportCsv}
            exporting={exporting}
          />

          <BulkActionsBar
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            bulkAction={bulkAction}
            setBulkAction={setBulkAction}
            bulkRejectNote={bulkRejectNote}
            setBulkRejectNote={setBulkRejectNote}
            selectedCount={selectedDocIds.length}
            onRunBulk={runBulk}
          />

          <DocumentTable
            docs={docs}
            jobByDoc={jobByDoc}
            subjects={subjects}
            grades={grades}
            exams={exams}
            activeTab={activeTab}
            adminRole={adminRole}
            selectedDocIds={selectedDocIds}
            onToggleDoc={toggleDoc}
            onSelectAll={(checked) => selectAllFromDocs(docs, checked)}
            onUpdateDoc={updateDoc}
            onRemoveDoc={removeDoc}
            onHardDeleteDoc={hardDeleteDoc}
            onChangeStatus={changeStatus}
            onRetryProcessing={retryProcessing}
            onSubmitApproval={submitApproval}
            onApprove={approve}
            onReject={openRejectModal}
            onOpenEditModal={openEditModal}
          />
        </section>
      ) : (
        <BulkHistoryPanel logs={bulkLogs} pageSize={50} />
      )}

      {editingDocId && editForm && (
        <EditDocumentModal
          editForm={editForm}
          setEditForm={setEditForm}
          onClose={closeEditModal}
          onSave={saveEditModal}
          subjects={subjects}
          grades={grades}
          exams={exams}
        />
      )}

      {rejectDocId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="reject-modal-title" aria-describedby="reject-modal-desc">
          <div className="w-full max-w-md rounded-xl border border-line bg-surface p-4 shadow-lg">
            <h2 id="reject-modal-title" className="text-base font-semibold text-semantic-heading">Từ chối duyệt tài liệu</h2>
            <p id="reject-modal-desc" className="mt-0.5 text-xs text-muted">Lý do từ chối (bắt buộc):</p>
            <label htmlFor="reject-note-textarea" className="sr-only">Lý do từ chối</label>
            <textarea
              id="reject-note-textarea"
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              placeholder="Ví dụ: thiếu metadata, cần bổ sung preview..."
              className="input-premium mt-1.5 w-full py-1.5 text-sm"
              rows={3}
              aria-required="true"
              aria-describedby="reject-modal-desc"
            />
            <div className="mt-3 flex justify-end gap-1.5">
              <button type="button" onClick={closeRejectModal} className="admin-btn-md border border-line bg-surface text-fg hover:bg-surface-muted">
                Hủy
              </button>
              <button type="button" onClick={handleConfirmReject} className="admin-btn-md bg-orange-600 text-white hover:bg-orange-700">
                Từ chối
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
