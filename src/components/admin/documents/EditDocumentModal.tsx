"use client";

import { useRef, useEffect, useCallback } from "react";
import type { Category } from "@/lib/types";
import type { DocumentStatusOption, EditFormState } from "./admin-documents.types";

type Props = {
  editForm: EditFormState;
  setEditForm: (_updater: (_prev: EditFormState | null) => EditFormState | null) => void;
  onClose: () => void;
  onSave: () => void;
  subjects: Category[];
  grades: Category[];
  exams: Category[];
};

const STATUS_OPTIONS: DocumentStatusOption[] = ["draft", "processing", "ready", "failed", "archived", "deleted"];

function getFocusables(root: HTMLElement): HTMLElement[] {
  const sel = "button, [href], input, select, textarea, [tabindex]:not([tabindex=\"-1\"])";
  return Array.from(root.querySelectorAll<HTMLElement>(sel)).filter((el) => !el.hasAttribute("disabled"));
}

export default function EditDocumentModal({ editForm, setEditForm, onClose, onSave, subjects, grades, exams }: Props) {
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const firstInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    firstInputRef.current?.focus();
  }, []);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  useEffect(() => {
    return () => {
      returnFocusRef.current?.focus();
    };
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== "Tab" || !modalRef.current) return;
    const focusables = getFocusables(modalRef.current);
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      ref={modalRef}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-doc-title"
    >
      <div className="w-full max-w-2xl rounded-xl border border-line bg-surface p-4 shadow-xl">
        <h3 id="edit-doc-title" className="text-base font-semibold text-semantic-heading">Sửa tài liệu</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <label htmlFor="edit-doc-title-input" className="sm:col-span-2 text-sm">
            <span className="mb-1 block text-muted">Tiêu đề</span>
            <input
              id="edit-doc-title-input"
              ref={firstInputRef}
              className="input-premium w-full"
              value={editForm.title}
              onChange={(e) => setEditForm((prev) => (prev ? { ...prev, title: e.target.value } : prev))}
            />
          </label>
          <label htmlFor="edit-doc-description" className="sm:col-span-2 text-sm">
            <span className="mb-1 block text-muted">Mô tả</span>
            <textarea
              id="edit-doc-description"
              rows={3}
              className="input-premium w-full"
              value={editForm.description}
              onChange={(e) => setEditForm((prev) => (prev ? { ...prev, description: e.target.value } : prev))}
            />
          </label>
          <label htmlFor="edit-doc-price" className="text-sm">
            <span className="mb-1 block text-muted">Giá</span>
            <input
              id="edit-doc-price"
              type="number"
              min={0}
              className="input-premium w-full"
              value={editForm.price}
              onChange={(e) => setEditForm((prev) => (prev ? { ...prev, price: e.target.value ? Number(e.target.value) : 0 } : prev))}
            />
          </label>
          <label htmlFor="edit-doc-status" className="text-sm">
            <span className="mb-1 block text-muted">Trạng thái</span>
            <select
              id="edit-doc-status"
              className="input-premium w-full"
              value={editForm.status}
              onChange={(e) => setEditForm((prev) => (prev ? { ...prev, status: e.target.value as DocumentStatusOption } : prev))}
            >
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label htmlFor="edit-doc-subject" className="text-sm">
            <span className="mb-1 block text-muted">Môn học</span>
            <select
              id="edit-doc-subject"
              className="input-premium w-full"
              value={editForm.subject_id ?? ""}
              onChange={(e) => setEditForm((prev) => (prev ? { ...prev, subject_id: e.target.value ? Number(e.target.value) : null } : prev))}
            >
              <option value="">— Chọn —</option>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label htmlFor="edit-doc-grade" className="text-sm">
            <span className="mb-1 block text-muted">Khối lớp</span>
            <select
              id="edit-doc-grade"
              className="input-premium w-full"
              value={editForm.grade_id ?? ""}
              onChange={(e) => setEditForm((prev) => (prev ? { ...prev, grade_id: e.target.value ? Number(e.target.value) : null } : prev))}
            >
              <option value="">— Chọn —</option>
              {grades.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </label>
          <label htmlFor="edit-doc-exam" className="text-sm">
            <span className="mb-1 block text-muted">Kỳ thi</span>
            <select
              id="edit-doc-exam"
              className="input-premium w-full"
              value={editForm.exam_id ?? ""}
              onChange={(e) => setEditForm((prev) => (prev ? { ...prev, exam_id: e.target.value ? Number(e.target.value) : null } : prev))}
            >
              <option value="">— Chọn —</option>
              {exams.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          </label>
          <label className="sm:col-span-2 flex items-center gap-2 text-sm text-semantic-heading">
            <input
              id="edit-doc-downloadable"
              type="checkbox"
              checked={editForm.is_downloadable}
              onChange={(e) => setEditForm((prev) => (prev ? { ...prev, is_downloadable: e.target.checked } : prev))}
              aria-describedby="edit-doc-downloadable-desc"
            />
            <span id="edit-doc-downloadable-desc">Cho phép tải/in</span>
          </label>
          <label className="sm:col-span-2 flex items-center gap-2 text-sm text-amber-600 font-medium">
            <input
              id="edit-doc-high-value"
              type="checkbox"
              checked={editForm.is_high_value}
              onChange={(e) => setEditForm((prev) => (prev ? { ...prev, is_high_value: e.target.checked } : prev))}
              aria-describedby="edit-doc-high-value-desc"
            />
            <span id="edit-doc-high-value-desc">Tài liệu nhạy cảm (High-Value SSW)</span>
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={handleClose}>Hủy</button>
          <button type="button" className="btn-primary" onClick={onSave}>Lưu thay đổi</button>
        </div>
      </div>
    </div>
  );
}
