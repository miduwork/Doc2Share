"use client";

import { useCallback } from "react";
import { toast } from "sonner";
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
import { BULK_REJECT_REQUIRED_MESSAGE, requiresBulkActionNote } from "../admin-documents.config";
import type {
  AdminRoleOption,
  BulkActionOption,
  DocRow,
  EditFormState,
  FiltersState,
} from "../admin-documents.types";

type RouterLike = {
  refresh: () => void;
};

type UseAdminDocumentsActionsParams = {
  adminRole: AdminRoleOption;
  filters: FiltersState;
  router: RouterLike;
  selectedDocIds: string[];
  bulkRejectNote: string;
  rejectDocId: string | null;
  editingDocId: string | null;
  editForm: EditFormState | null;
  closeEditModal: () => void;
  closeRejectModal: () => void;
  setDocs: React.Dispatch<React.SetStateAction<DocRow[]>>;
  setSelectedDocIds: React.Dispatch<React.SetStateAction<string[]>>;
  setBulkRejectNote: React.Dispatch<React.SetStateAction<string>>;
  setExporting: React.Dispatch<React.SetStateAction<boolean>>;
};

export function useAdminDocumentsActions({
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
}: UseAdminDocumentsActionsParams) {
  const updateDoc = useCallback(async (id: string, field: string, value: unknown) => {
    const payload: {
      documentId: string;
      price?: number | null;
      subject_id?: number | null;
      grade_id?: number | null;
      exam_id?: number | null;
      is_downloadable?: boolean | null;
    } = { documentId: id };
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
  }, [setDocs]);

  const removeDoc = useCallback(async (id: string) => {
    if (!window.confirm("Bạn có chắc muốn ẩn tài liệu này khỏi hệ thống?")) return;
    const result = await deleteDocument({ documentId: id, hardDelete: false });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setDocs((d) => d.filter((row) => row.id !== id));
    toast.success("Đã chuyển tài liệu sang trạng thái deleted.");
    router.refresh();
  }, [router, setDocs]);

  const hardDeleteDoc = useCallback(async (id: string) => {
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
  }, [adminRole, router, setDocs]);

  const changeStatus = useCallback(async (docId: string, targetStatus: "ready" | "archived" | "deleted" | "processing") => {
    const result = await setDocumentStatus({ documentId: docId, targetStatus });
    if (!result.ok) toast.error(result.error);
    else {
      toast.success("Đã cập nhật trạng thái.");
      router.refresh();
    }
  }, [router]);

  const retryProcessing = useCallback(async (docId: string) => {
    const result = await retryDocumentProcessing({ documentId: docId });
    if (!result.ok) toast.error(result.error);
    else {
      toast.success("Đã đưa tài liệu vào hàng đợi xử lý lại.");
      router.refresh();
    }
  }, [router]);

  const runBulk = useCallback(async (action: BulkActionOption) => {
    if (!selectedDocIds.length) {
      toast.error("Vui lòng chọn ít nhất 1 tài liệu.");
      return;
    }
    const note = requiresBulkActionNote(action) ? bulkRejectNote.trim() : undefined;
    if (requiresBulkActionNote(action) && !note) {
      toast.error(BULK_REJECT_REQUIRED_MESSAGE);
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
  }, [bulkRejectNote, router, selectedDocIds, setBulkRejectNote, setSelectedDocIds]);

  const submitApproval = useCallback(async (docId: string) => {
    const result = await submitDocumentForApproval({ documentId: docId });
    if (!result.ok) toast.error(result.error);
    else {
      toast.success("Đã gửi duyệt.");
      router.refresh();
    }
  }, [router]);

  const approve = useCallback(async (docId: string) => {
    const result = await approveDocument({ documentId: docId });
    if (!result.ok) toast.error(result.error);
    else {
      toast.success("Đã duyệt publish.");
      router.refresh();
    }
  }, [router]);

  const confirmReject = useCallback(async (note: string) => {
    if (!rejectDocId) return;
    const result = await rejectDocument({ documentId: rejectDocId, note });
    closeRejectModal();
    if (!result.ok) toast.error(result.error);
    else {
      toast.success("Đã từ chối duyệt.");
      router.refresh();
    }
  }, [closeRejectModal, rejectDocId, router]);

  const saveEditModal = useCallback(async () => {
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
      closeEditModal();
      router.refresh();
    }
  }, [closeEditModal, editForm, editingDocId, router]);

  const exportCsv = useCallback(async () => {
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
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    if (result.data?.csv) {
      const blob = new Blob([result.data.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `documents-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Đã xuất CSV.");
    }
  }, [filters, setExporting]);

  return {
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
  };
}

