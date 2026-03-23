"use client";

import { useState } from "react";
import UploadDocument from "./UploadDocument";
import DocumentFilters from "./DocumentFilters";
import BulkActionsBar from "./BulkActionsBar";
import DocumentTable from "./DocumentTable";
import EditDocumentModal from "./EditDocumentModal";
import type { Category } from "@/lib/types";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  approveDocument,
  bulkManageDocuments,
  deleteDocument,
  exportDocumentsCsv,
  rejectDocument,
  retryDocumentProcessing,
  setDocumentStatus,
  submitDocumentForApproval,
  updateDocumentMetadata,
} from "@/app/admin/documents/manage-actions";
import type { BulkActionOption, DocRow, EditFormState, FiltersState, JobRow } from "./admin-documents.types";

type Props = {
  initialDocs: DocRow[];
  categories: Category[];
  jobs: JobRow[];
  adminRole: "super_admin" | "content_manager" | "support_agent" | null;
  filters: FiltersState;
};

export default function AdminDocumentsClient({ initialDocs, categories, jobs, adminRole, filters }: Props) {
  const [docs, setDocs] = useState(initialDocs);
  const [activeTab, setActiveTab] = useState<"crud" | "ops">("crud");
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditFormState | null>(null);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState<BulkActionOption>("publish");
  const [bulkRejectNote, setBulkRejectNote] = useState("");
  const [rejectDocId, setRejectDocId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [exporting, setExporting] = useState(false);
  const router = useRouter();

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

  async function updateDoc(id: string, field: string, value: unknown) {
    const payload: { documentId: string; price?: number | null; subject_id?: number | null; grade_id?: number | null; exam_id?: number | null; is_downloadable?: boolean | null } = { documentId: id };
    if (field === "price") payload.price = Number(value ?? 0);
    if (field === "subject_id") payload.subject_id = (value as number | null) ?? null;
    if (field === "grade_id") payload.grade_id = (value as number | null) ?? null;
    if (field === "exam_id") payload.exam_id = (value as number | null) ?? null;
    if (field === "is_downloadable") payload.is_downloadable = Boolean(value);
    const result = await updateDocumentMetadata(payload);
    if (!result.ok) toast.error(result.error);
    else {
      setDocs((d) => d.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
      toast.success("Đã cập nhật");
    }
  }

  async function removeDoc(id: string) {
    if (!window.confirm("Bạn có chắc muốn ẩn tài liệu này khỏi hệ thống?")) return;
    const result = await deleteDocument({ documentId: id, hardDelete: false });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setDocs((d) => d.filter((row) => row.id !== id));
    toast.success("Đã chuyển tài liệu sang trạng thái deleted.");
    router.refresh();
  }

  async function hardDeleteDoc(id: string) {
    if (adminRole !== "super_admin") {
      toast.error("Chỉ super_admin được hard delete.");
      return;
    }
    if (!window.confirm("Hard delete sẽ xóa vĩnh viễn record tài liệu. Tiếp tục?")) return;
    if (window.prompt("Xác nhận bước 2: nhập DELETE để tiếp tục.") !== "DELETE") {
      toast.error("Hủy hard delete do xác nhận không hợp lệ.");
      return;
    }
    const result = await deleteDocument({ documentId: id, hardDelete: true });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setDocs((d) => d.filter((row) => row.id !== id));
    toast.success("Đã hard delete tài liệu.");
    router.refresh();
  }

  async function changeStatus(docId: string, targetStatus: "ready" | "archived" | "deleted" | "processing") {
    const result = await setDocumentStatus({ documentId: docId, targetStatus });
    if (!result.ok) toast.error(result.error);
    else {
      toast.success("Đã cập nhật trạng thái.");
      router.refresh();
    }
  }

  async function retryProcessing(docId: string) {
    const result = await retryDocumentProcessing({ documentId: docId });
    if (!result.ok) toast.error(result.error);
    else {
      toast.success("Đã đưa tài liệu vào hàng đợi xử lý lại.");
      router.refresh();
    }
  }

  async function runBulk(action: BulkActionOption) {
    if (!selectedDocIds.length) {
      toast.error("Vui lòng chọn ít nhất 1 tài liệu.");
      return;
    }
    const note = action === "reject" ? bulkRejectNote.trim() : undefined;
    if (action === "reject" && !note) {
      toast.error("Bắt buộc nhập lý do khi reject.");
      return;
    }
    const result = await bulkManageDocuments({ documentIds: selectedDocIds, action, note });
    if (!result.ok) toast.error(result.error);
    else {
      toast.success(result.data?.summary ?? "Hoàn tất.");
      setSelectedDocIds([]);
      setBulkRejectNote("");
      router.refresh();
    }
  }

  async function submitApproval(docId: string) {
    const result = await submitDocumentForApproval({ documentId: docId });
    if (!result.ok) toast.error(result.error);
    else {
      toast.success("Đã gửi duyệt.");
      router.refresh();
    }
  }

  async function approve(docId: string) {
    const result = await approveDocument({ documentId: docId });
    if (!result.ok) toast.error(result.error);
    else {
      toast.success("Đã duyệt publish.");
      router.refresh();
    }
  }

  function openRejectModal(docId: string) {
    setRejectDocId(docId);
    setRejectNote("");
  }

  async function confirmReject() {
    if (!rejectDocId) return;
    const note = rejectNote.trim();
    if (!note) {
      toast.error("Bắt buộc nhập lý do khi từ chối.");
      return;
    }
    const result = await rejectDocument({ documentId: rejectDocId, note });
    setRejectDocId(null);
    setRejectNote("");
    if (!result.ok) toast.error(result.error);
    else {
      toast.success("Đã từ chối duyệt.");
      router.refresh();
    }
  }

  function openEditModal(doc: DocRow) {
    setEditingDocId(doc.id);
    setEditForm({
      title: doc.title,
      description: doc.description ?? "",
      price: Number(doc.price ?? 0),
      subject_id: doc.subject_id ?? null,
      grade_id: doc.grade_id ?? null,
      exam_id: doc.exam_id ?? null,
      is_downloadable: doc.is_downloadable,
      status: (doc.status ?? "ready") as EditFormState["status"],
    });
  }

  async function saveEditModal() {
    if (!editingDocId || !editForm) return;
    const result = await updateDocumentMetadata({
      documentId: editingDocId,
      title: editForm.title,
      description: editForm.description,
      price: editForm.price,
      subject_id: editForm.subject_id,
      grade_id: editForm.grade_id,
      exam_id: editForm.exam_id,
      is_downloadable: editForm.is_downloadable,
      status: editForm.status,
    });
    if (!result.ok) toast.error(result.error);
    else {
      toast.success("Đã lưu cập nhật tài liệu.");
      setEditingDocId(null);
      setEditForm(null);
      router.refresh();
    }
  }

  function toggleDoc(id: string, checked: boolean) {
    setSelectedDocIds((prev) => (checked ? Array.from(new Set([...prev, id])) : prev.filter((x) => x !== id)));
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="rounded-lg border border-primary-200 bg-primary-50/50 p-2.5 text-xs text-primary-800 dark:border-primary-800 dark:bg-primary-900/20 dark:text-primary-200">
        <strong>Luồng:</strong> Nháp → Gửi duyệt → Chờ duyệt → Duyệt/Từ chối → Ready hoặc Archived.
      </div>
      <UploadDocument categories={categories} onSuccess={() => router.refresh()} />
      <p className="text-xs text-muted">Tạo: form trên. Sửa/Xóa: cột CRUD hoặc Ops bên dưới.</p>

      <DocumentFilters
        filters={filters}
        buildQuery={buildQuery}
        subjects={subjects}
        grades={grades}
        exams={exams}
        onExportCsv={async () => {
          setExporting(true);
          const result = await exportDocumentsCsv({
            q: filters.q,
            status: filters.status,
            subject_id: filters.subject_id,
            grade_id: filters.grade_id,
            exam_id: filters.exam_id,
            sort: filters.sort,
            preset: filters.preset,
          });
          setExporting(false);
          if (!result.ok) toast.error(result.error);
          else if (result.data?.csv) {
            const blob = new Blob([result.data.csv], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `documents-${new Date().toISOString().slice(0, 10)}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            toast.success("Đã xuất CSV.");
          }
        }}
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
        onSelectAll={(checked) => setSelectedDocIds(checked ? docs.map((d) => d.id) : [])}
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

      {editingDocId && editForm && (
        <EditDocumentModal
          editForm={editForm}
          setEditForm={setEditForm}
          onClose={() => { setEditingDocId(null); setEditForm(null); }}
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
              <button type="button" onClick={() => { setRejectDocId(null); setRejectNote(""); }} className="btn-secondary px-3 py-1.5 text-xs">
                Hủy
              </button>
              <button type="button" onClick={confirmReject} className="rounded-md bg-orange-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-700">
                Từ chối
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
