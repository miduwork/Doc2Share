"use client";

import Link from "next/link";
import { ShoppingCart, Clock, CheckCircle, XCircle, Ban } from "lucide-react";
import { formatDate } from "@/lib/date";
import AdminTable, { type AdminTableColumn } from "@/components/admin/AdminTable";

type OrderStatus = "pending" | "completed" | "expired" | "canceled" | "all";

type OrderRow = {
  id: string;
  user_id: string;
  customerName: string;
  total_amount: number;
  status: string;
  external_id: string | null;
  created_at: string;
  updated_at: string;
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Chờ thanh toán",
  completed: "Hoàn thành",
  expired: "Hết hạn",
  canceled: "Đã hủy",
};

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  completed: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  expired: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400",
  canceled: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

const FILTERS: { value: OrderStatus; label: string; icon: React.ReactNode }[] = [
  { value: "all", label: "Tất cả", icon: <ShoppingCart className="h-4 w-4" /> },
  { value: "pending", label: "Chờ thanh toán", icon: <Clock className="h-4 w-4" /> },
  { value: "completed", label: "Hoàn thành", icon: <CheckCircle className="h-4 w-4" /> },
  { value: "expired", label: "Hết hạn", icon: <XCircle className="h-4 w-4" /> },
  { value: "canceled", label: "Đã hủy", icon: <Ban className="h-4 w-4" /> },
];

export default function AdminOrdersClient({
  orders,
  totalCount,
  currentStatus,
}: {
  orders: OrderRow[];
  totalCount: number;
  currentStatus: OrderStatus;
}) {
  const columns: AdminTableColumn<OrderRow>[] = [
    { id: "created_at", header: "Ngày tạo", cell: (r) => <span className="tabular-nums text-muted">{formatDate(r.created_at)}</span> },
    {
      id: "status",
      header: "Trạng thái",
      cell: (r) => (
        <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium ${STATUS_STYLES[r.status] ?? "bg-muted text-muted"}`}>
          {STATUS_LABELS[r.status] ?? r.status}
        </span>
      ),
    },
    { id: "customerName", header: "Khách hàng", cell: (r) => <span className="font-medium text-semantic-heading">{r.customerName}</span> },
    { id: "total_amount", header: "Số tiền", headerClassName: "text-right", cellClassName: "text-right tabular-nums", cell: (r) => `${r.total_amount.toLocaleString("vi-VN")} ₫` },
    { id: "external_id", header: "Mã đơn / Tham chiếu", cell: (r) => <span className="max-w-[140px] truncate font-mono text-muted" title={r.external_id ?? undefined}>{r.external_id ?? "—"}</span> },
  ];

  const emptyMsg = currentStatus === "all" ? "Chưa có đơn hàng nào." : `Không có đơn ở trạng thái "${STATUS_LABELS[currentStatus] ?? currentStatus}".`;

  return (
    <>
      <div className="mt-4 flex flex-wrap gap-1.5" role="tablist" aria-label="Lọc theo trạng thái đơn hàng">
        {FILTERS.map((f) => {
          const href = f.value === "all" ? "/admin/orders" : `/admin/orders?status=${f.value}`;
          const isActive = currentStatus === f.value;
          return (
            <Link
              key={f.value}
              href={href}
              role="tab"
              aria-selected={isActive}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                isActive
                  ? "border border-primary-200 bg-primary-50 text-primary-700 shadow-sm dark:border-primary-700 dark:bg-primary-900/30 dark:text-primary-300"
                  : "border border-line bg-surface text-muted hover:bg-muted/50 hover:text-semantic-heading"
              }`}
            >
              {f.icon}
              {f.label}
            </Link>
          );
        })}
      </div>

      <div className="mt-4">
        <AdminTable
          columns={columns}
          data={orders}
          emptyMessage={emptyMsg}
          getRowId={(r) => r.id}
        />
      </div>

      {orders.length > 0 && (
        <p className="mt-3 text-xs text-muted">
          Hiển thị {orders.length} đơn
          {totalCount > orders.length ? ` (tối đa 100, tổng ${totalCount})` : ""}
        </p>
      )}
    </>
  );
}
