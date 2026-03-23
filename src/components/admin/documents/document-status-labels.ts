export const STATUS_LABELS: Record<string, string> = {
  draft: "Nháp",
  processing: "Đang xử lý",
  ready: "Đang bán",
  failed: "Lỗi",
  archived: "Lưu trữ",
  deleted: "Đã xóa",
};

export const APPROVAL_LABELS: Record<string, string> = {
  draft: "Nháp",
  pending: "Chờ duyệt",
  approved: "Đã duyệt",
  rejected: "Từ chối",
};

export const QUALITY_LABELS: Record<string, string> = {
  good: "Tốt",
  review: "Xem lại",
  needs_review: "Cần kiểm tra",
};

export function statusClass(s: string): string {
  if (s === "pending" || s === "processing") return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300";
  if (s === "approved" || s === "ready" || s === "good") return "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300";
  if (s === "rejected" || s === "failed") return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300";
  return "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400";
}
