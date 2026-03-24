import type { BulkActionOption } from "./admin-documents.types";

type PresetQueryPatch = Partial<{
  preset: string;
  status: string;
  page: number;
}>;

export type BulkActionConfig = {
  value: BulkActionOption;
  label: string;
  requiresNote: boolean;
  noteLabel?: string;
  notePlaceholder?: string;
};

export const BULK_ACTIONS_CONFIG: BulkActionConfig[] = [
  { value: "publish", label: "Publish (ready)", requiresNote: false },
  { value: "submit_approval", label: "Gửi duyệt", requiresNote: false },
  { value: "approve", label: "Duyệt publish", requiresNote: false },
  {
    value: "reject",
    label: "Từ chối duyệt",
    requiresNote: true,
    noteLabel: "Lý do từ chối",
    notePlaceholder: "Thiếu metadata, cần bổ sung preview...",
  },
  { value: "archive", label: "Lưu trữ", requiresNote: false },
  { value: "retry_processing", label: "Xử lý lại pipeline", requiresNote: false },
  { value: "delete", label: "Xóa mềm", requiresNote: false },
];

export const BULK_REJECT_REQUIRED_MESSAGE = "Bắt buộc nhập lý do khi reject.";

export type DocumentPresetConfig = {
  id: string;
  label: string;
  queryPatch: PresetQueryPatch;
};

export const DOCUMENT_PRESETS_CONFIG: DocumentPresetConfig[] = [
  { id: "all", label: "Tất cả", queryPatch: { preset: "all", page: 1 } },
  { id: "failed", label: "Lỗi xử lý", queryPatch: { preset: "failed", status: "failed", page: 1 } },
  { id: "pending-approval", label: "Chờ duyệt", queryPatch: { preset: "pending-approval", status: "all", page: 1 } },
  { id: "low-quality", label: "Chất lượng thấp", queryPatch: { preset: "low-quality", status: "all", page: 1 } },
  { id: "missing-thumbnail", label: "Thiếu thumbnail", queryPatch: { preset: "missing-thumbnail", status: "all", page: 1 } },
  { id: "missing-preview", label: "Thiếu preview", queryPatch: { preset: "missing-preview", status: "all", page: 1 } },
  { id: "deleted", label: "Đã xóa", queryPatch: { preset: "deleted", status: "deleted", page: 1 } },
];

export function getBulkActionConfig(action: BulkActionOption): BulkActionConfig {
  return BULK_ACTIONS_CONFIG.find((item) => item.value === action) ?? BULK_ACTIONS_CONFIG[0];
}

export function requiresBulkActionNote(action: BulkActionOption): boolean {
  return getBulkActionConfig(action).requiresNote;
}

export function getPresetStatusDefault(preset: string): string {
  if (preset === "failed") return "failed";
  if (preset === "deleted") return "deleted";
  return "all";
}

