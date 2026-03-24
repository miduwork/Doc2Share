"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import type { Category } from "@/lib/types";
import type { AdminRoleOption, DocRow, JobRow } from "./admin-documents.types";
import { STATUS_LABELS, APPROVAL_LABELS, QUALITY_LABELS, statusClass } from "./document-status-labels";
import { slugify } from "@/lib/seo";

type Props = {
  docs: DocRow[];
  jobByDoc: Record<string, JobRow>;
  subjects: Category[];
  grades: Category[];
  exams: Category[];
  activeTab: "crud" | "ops";
  adminRole: AdminRoleOption;
  selectedDocIds: string[];
  onToggleDoc: (_id: string, _checked: boolean) => void;
  onSelectAll: (_checked: boolean) => void;
  onUpdateDoc: (_id: string, _field: string, _value: unknown) => void;
  onRemoveDoc: (_id: string) => void;
  onHardDeleteDoc: (_id: string) => void;
  onChangeStatus: (_docId: string, _targetStatus: "ready" | "archived" | "deleted" | "processing") => void;
  onRetryProcessing: (_docId: string) => void;
  onSubmitApproval: (_docId: string) => void;
  onApprove: (_docId: string) => void;
  onReject: (_docId: string) => void;
  onOpenEditModal: (_doc: DocRow) => void;
};

export default function DocumentTable({
  docs,
  jobByDoc,
  subjects,
  grades,
  exams,
  activeTab,
  adminRole,
  selectedDocIds,
  onToggleDoc,
  onSelectAll,
  onUpdateDoc,
  onRemoveDoc,
  onHardDeleteDoc,
  onChangeStatus,
  onRetryProcessing,
  onSubmitApproval,
  onApprove,
  onReject,
  onOpenEditModal,
}: Props) {
  const [dirtyPrices, setDirtyPrices] = useState<Record<string, number>>({});

  const displayPrice = useCallback((doc: DocRow) => dirtyPrices[doc.id] ?? doc.price, [dirtyPrices]);
  const isPriceDirty = useCallback((doc: DocRow) => dirtyPrices[doc.id] != null && dirtyPrices[doc.id] !== doc.price, [dirtyPrices]);
  const savePrice = useCallback((docId: string) => {
    const v = dirtyPrices[docId];
    if (v == null) return;
    onUpdateDoc(docId, "price", v);
    setDirtyPrices((prev) => { const next = { ...prev }; delete next[docId]; return next; });
  }, [dirtyPrices, onUpdateDoc]);

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      <table className="w-full text-xs" role="grid" aria-label="Danh sách tài liệu">
        <thead className="bg-surface-muted/50">
          <tr>
            <th scope="col" className="w-8 px-3 py-2">
              <input
                type="checkbox"
                checked={docs.length > 0 && selectedDocIds.length === docs.length}
                onChange={(e) => onSelectAll(e.target.checked)}
                aria-label="Chọn tất cả tài liệu trên trang"
              />
            </th>
            <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-semantic-heading">Tiêu đề</th>
            <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-semantic-heading">Trạng thái</th>
            <th scope="col" className="px-3 py-2 text-right text-xs font-medium text-semantic-heading">Giá (₫)</th>
            <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-semantic-heading">Môn / Lớp / Kỳ</th>
            <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-semantic-heading">Quyền</th>
            <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-semantic-heading">{activeTab === "crud" ? "CRUD" : "Ops"}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {docs.map((doc) => (
            <tr key={doc.id} className="hover:bg-surface-muted/30">
              <td className="px-3 py-1.5">
                <input
                  type="checkbox"
                  checked={selectedDocIds.includes(doc.id)}
                  onChange={(e) => onToggleDoc(doc.id, e.target.checked)}
                  aria-label={`Chọn tài liệu: ${doc.title}`}
                />
              </td>
              <td className="max-w-[200px] truncate px-3 py-1.5 font-medium" title={doc.title}>{doc.title}</td>
              <td className="px-3 py-1.5">
                <div className="flex flex-wrap items-center gap-1">
                  <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium ${statusClass(doc.status ?? "ready")}`}>
                    {STATUS_LABELS[doc.status ?? "ready"] ?? doc.status}
                  </span>
                  <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium ${statusClass(doc.approval_status ?? "draft")}`}>
                    {APPROVAL_LABELS[doc.approval_status ?? "draft"] ?? doc.approval_status}
                  </span>
                  <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] ${statusClass(doc.data_quality_status ?? "needs_review")}`}>
                    {QUALITY_LABELS[doc.data_quality_status ?? "needs_review"] ?? doc.data_quality_status} ({doc.quality_score ?? 0})
                  </span>
                  {jobByDoc[doc.id]?.status === "failed" && (
                    <p className="max-w-48 truncate text-xs text-red-600 dark:text-red-400" title={jobByDoc[doc.id]?.last_error ?? ""}>
                      Lỗi pipeline: {jobByDoc[doc.id]?.last_error ?? "unknown"}
                    </p>
                  )}
                </div>
              </td>
              <td className="px-3 py-1.5 text-right">
                <div className="flex items-center justify-end gap-1">
                  <input
                    type="number"
                    min={0}
                    step={1000}
                    value={displayPrice(doc)}
                    onChange={(e) => setDirtyPrices((prev) => ({ ...prev, [doc.id]: e.target.value ? Number(e.target.value) : 0 }))}
                    className="w-20 rounded border border-line bg-surface px-1.5 py-0.5 text-right text-xs text-fg"
                  />
                  {isPriceDirty(doc) && (
                    <button type="button" onClick={() => savePrice(doc.id)} className="admin-btn-sm rounded-md bg-primary-600 text-white hover:bg-primary-700">
                      Lưu
                    </button>
                  )}
                </div>
              </td>
              <td className="max-w-[120px] truncate px-3 py-1.5 text-xs">
                {[grades.find((g) => g.id === doc.grade_id)?.name, subjects.find((s) => s.id === doc.subject_id)?.name, exams.find((e) => e.id === doc.exam_id)?.name]
                  .filter(Boolean)
                  .join(" · ") || "—"}
              </td>
              <td className="px-3 py-1.5 text-xs">{doc.is_downloadable ? "Có" : "Không"}</td>
              <td className="px-3 py-1.5">
                <div className="flex flex-wrap gap-1">
                  {activeTab === "crud" ? (
                    <>
                      <button type="button" onClick={() => onOpenEditModal(doc)} className="admin-btn-sm bg-action-muted text-action-muted-foreground hover:bg-action hover:text-action-foreground">Sửa</button>
                      <button type="button" onClick={() => onRemoveDoc(doc.id)} className="admin-btn-sm bg-red-600 text-white hover:bg-red-700">Xóa mềm</button>
                      {adminRole === "super_admin" && (
                        <button type="button" onClick={() => onHardDeleteDoc(doc.id)} className="admin-btn-sm bg-red-800 text-white hover:bg-red-900">Xóa cứng</button>
                      )}
                      <Link href={`/cua-hang/${doc.id}/${slugify(doc.title || doc.id)}`} className="admin-btn-sm bg-sky-600 text-white hover:bg-sky-700" target="_blank" rel="noopener noreferrer">Xem trang bán</Link>
                      <Link href={`/admin/documents/${doc.id}`} className="admin-btn-sm bg-indigo-600 text-white hover:bg-indigo-700">Chi tiết</Link>
                    </>
                  ) : (
                    <>
                      {doc.approval_status === "pending" && adminRole === "super_admin" ? (
                        <>
                          <button type="button" onClick={() => onApprove(doc.id)} className="admin-btn-sm bg-emerald-700 text-white hover:bg-emerald-800">Duyệt</button>
                          <button type="button" onClick={() => onReject(doc.id)} className="admin-btn-sm bg-orange-600 text-white hover:bg-orange-700">Từ chối</button>
                        </>
                      ) : doc.status === "failed" || jobByDoc[doc.id]?.status === "failed" ? (
                        <button type="button" onClick={() => onRetryProcessing(doc.id)} className="admin-btn-sm bg-indigo-600 text-white hover:bg-indigo-700">Retry xử lý</button>
                      ) : doc.status === "archived" ? (
                        <button type="button" onClick={() => onChangeStatus(doc.id, "ready")} className="admin-btn-sm bg-emerald-600 text-white hover:bg-emerald-700">Publish</button>
                      ) : doc.status === "ready" ? (
                        <button type="button" onClick={() => onChangeStatus(doc.id, "archived")} className="admin-btn-sm bg-action-muted text-action-muted-foreground hover:bg-action hover:text-action-foreground">Archive</button>
                      ) : (
                        <button type="button" onClick={() => onSubmitApproval(doc.id)} className="admin-btn-sm bg-fuchsia-600 text-white hover:bg-fuchsia-700">Gửi duyệt</button>
                      )}
                      <Link href={`/cua-hang/${doc.id}/${slugify(doc.title || doc.id)}`} className="admin-btn-sm bg-sky-600 text-white hover:bg-sky-700" target="_blank" rel="noopener noreferrer">Xem trang bán</Link>
                      <Link href={`/admin/documents/${doc.id}`} className="admin-btn-sm bg-indigo-600 text-white hover:bg-indigo-700">Chi tiết</Link>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {docs.length === 0 && <p className="py-6 text-center text-xs text-muted" role="status">Chưa có tài liệu. Tải PDF lên ở trên.</p>}
    </div>
  );
}
