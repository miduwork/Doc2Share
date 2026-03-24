"use client";

import type { BulkActionOption } from "./admin-documents.types";
import { BULK_ACTIONS_CONFIG, getBulkActionConfig, requiresBulkActionNote } from "./admin-documents.config";

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
  const activeActionConfig = getBulkActionConfig(bulkAction);
  const showRejectNote = requiresBulkActionNote(bulkAction);

  return (
    <div className="premium-panel rounded-xl p-2.5">
      <div className="mb-2 inline-flex rounded-lg border border-line p-0.5">
        <button
          type="button"
          onClick={() => setActiveTab("crud")}
          className={`admin-btn-sm ${activeTab === "crud" ? "bg-primary text-white" : "text-slate-600 dark:text-slate-300"}`}
        >
          CRUD
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("ops")}
          className={`admin-btn-sm ${activeTab === "ops" ? "bg-primary text-white" : "text-slate-600 dark:text-slate-300"}`}
        >
          Ops
        </button>
      </div>
      {activeTab === "ops" && (
        <div className="grid gap-2 md:grid-cols-12">
          <label className="text-xs text-slate-600 dark:text-slate-300 md:col-span-4">
            Hành động
            <select
              value={bulkAction}
              onChange={(e) => setBulkAction(e.target.value as BulkActionOption)}
              className="input-premium mt-0.5 w-full py-1.5 text-xs"
            >
              {BULK_ACTIONS_CONFIG.map((action) => (
                <option key={action.value} value={action.value}>{action.label}</option>
              ))}
            </select>
          </label>
          {showRejectNote && (
            <label className="text-xs text-slate-600 dark:text-slate-300 md:col-span-5">
              {activeActionConfig.noteLabel ?? "Lý do từ chối"}
              <input
                value={bulkRejectNote}
                onChange={(e) => setBulkRejectNote(e.target.value)}
                className="input-premium mt-0.5 w-full py-1.5 text-xs"
                placeholder={activeActionConfig.notePlaceholder ?? "Thiếu metadata, cần bổ sung preview..."}
              />
            </label>
          )}
          <div className={`flex items-end gap-1.5 ${showRejectNote ? "md:col-span-3" : "md:col-span-8"}`}>
            <button
              type="button"
              className="admin-btn-md bg-primary text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => onRunBulk(bulkAction)}
              disabled={selectedCount === 0}
            >
              {selectedCount === 0 ? "Chưa chọn tài liệu" : `Chạy (${selectedCount})`}
            </button>
          </div>
          <p className="text-[11px] text-slate-500 md:col-span-12">
            Mẹo: thao tác nâng cao như diff/rollback chi tiết nằm trong trang `Chi tiết` để giao diện danh sách luôn gọn.
          </p>
        </div>
      )}
    </div>
  );
}
