"use client";

import type { BulkActionOption } from "./admin-documents.types";

type Props = {
  activeTab: "crud" | "ops";
  setActiveTab: (_tab: "crud" | "ops") => void;
  bulkAction: BulkActionOption;
  setBulkAction: (_action: BulkActionOption) => void;
  bulkRejectNote: string;
  setBulkRejectNote: (_value: string) => void;
  selectedCount: number;
  onRunBulk: (_action: BulkActionOption) => void;
};

export default function BulkActionsBar({
  activeTab,
  setActiveTab,
  bulkAction,
  setBulkAction,
  bulkRejectNote,
  setBulkRejectNote,
  selectedCount,
  onRunBulk,
}: Props) {
  return (
    <div className="premium-panel rounded-xl p-2.5">
      <div className="mb-2 inline-flex rounded-lg border border-line p-0.5">
        <button
          type="button"
          onClick={() => setActiveTab("crud")}
          className={`rounded px-2.5 py-1 text-xs ${activeTab === "crud" ? "bg-primary text-white" : "text-slate-600 dark:text-slate-300"}`}
        >
          CRUD
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("ops")}
          className={`rounded px-2.5 py-1 text-xs ${activeTab === "ops" ? "bg-primary text-white" : "text-slate-600 dark:text-slate-300"}`}
        >
          Ops
        </button>
      </div>
      {activeTab === "ops" && (
        <div className="grid gap-2 md:grid-cols-4">
          <label className="text-xs text-slate-600 dark:text-slate-300">
            1) Hành động
            <select
              value={bulkAction}
              onChange={(e) => setBulkAction(e.target.value as BulkActionOption)}
              className="input-premium mt-0.5 w-full py-1.5 text-xs"
            >
              <option value="publish">Publish (ready)</option>
              <option value="submit_approval">Gửi duyệt</option>
              <option value="approve">Duyệt publish</option>
              <option value="reject">Từ chối duyệt</option>
              <option value="archive">Lưu trữ</option>
              <option value="retry_processing">Xử lý lại pipeline</option>
              <option value="delete">Xóa mềm</option>
            </select>
          </label>
          {bulkAction === "reject" && (
            <label className="text-xs text-slate-600 dark:text-slate-300 md:col-span-2">
              2) Lý do reject
              <input
                value={bulkRejectNote}
                onChange={(e) => setBulkRejectNote(e.target.value)}
                className="input-premium mt-0.5 w-full py-1.5 text-xs"
                placeholder="Thiếu metadata, cần bổ sung preview..."
              />
            </label>
          )}
          <div className="flex items-end gap-1.5">
            <button type="button" className="btn-primary px-3 py-1.5 text-xs" onClick={() => onRunBulk(bulkAction)}>
              3) Chạy ({selectedCount})
            </button>
          </div>
          <p className="text-[11px] text-slate-500 md:col-span-4">
            Mẹo: thao tác nâng cao như diff/rollback chi tiết nằm trong trang `Chi tiết` để giao diện danh sách luôn gọn.
          </p>
        </div>
      )}
    </div>
  );
}
