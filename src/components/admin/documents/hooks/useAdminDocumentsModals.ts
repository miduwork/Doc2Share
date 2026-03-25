"use client";

import { useCallback, useState } from "react";
import type { DocRow, EditFormState } from "../admin-documents.types";

export function useAdminDocumentsModals() {
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditFormState | null>(null);
  const [rejectDocId, setRejectDocId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  const closeEditModal = useCallback(() => {
    setEditingDocId(null);
    setEditForm(null);
  }, []);

  const closeRejectModal = useCallback(() => {
    setRejectDocId(null);
    setRejectNote("");
  }, []);

  const openRejectModal = useCallback((docId: string) => {
    setRejectDocId(docId);
    setRejectNote("");
  }, []);

  const openEditModal = useCallback((doc: DocRow) => {
    setEditingDocId(doc.id);
    setEditForm({
      title: doc.title,
      description: doc.description ?? "",
      price: Number(doc.price ?? 0),
      subject_id: doc.subject_id ?? null,
      grade_id: doc.grade_id ?? null,
      exam_id: doc.exam_id ?? null,
      is_downloadable: doc.is_downloadable,
      is_high_value: doc.is_high_value ?? false,
      status: (doc.status ?? "ready") as EditFormState["status"],
    });
  }, []);

  const getValidatedRejectNote = useCallback(() => {
    const note = rejectNote.trim();
    if (!note) return { ok: false as const, error: "Bắt buộc nhập lý do khi từ chối." };
    return { ok: true as const, note };
  }, [rejectNote]);

  return {
    editingDocId,
    setEditingDocId,
    editForm,
    setEditForm,
    rejectDocId,
    setRejectDocId,
    rejectNote,
    setRejectNote,
    getValidatedRejectNote,
    openRejectModal,
    openEditModal,
    closeEditModal,
    closeRejectModal,
  };
}

