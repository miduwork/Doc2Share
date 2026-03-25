"use client";

import {
  formSecondaryButtonClass,
  inputClass,
  labelClass,
  selectClass,
} from "@/components/admin/adminStyles";
import {
  ADMIN_ORDER_PAGE_SIZE_OPTIONS,
} from "@/lib/admin/adminOrdersListContract";
import { ORDER_PRIORITY, ORDER_STATUS } from "@/lib/orders/types";

const statusOptions = [
  ORDER_STATUS.PENDING,
  ORDER_STATUS.COMPLETED,
  ORDER_STATUS.DELIVERED,
];

const priorityOptions = [
  ORDER_PRIORITY.HIGH,
  ORDER_PRIORITY.NORMAL,
  ORDER_PRIORITY.LOW,
];

type AdminOrdersFiltersSectionProps = {
  searchInput: string;
  onSearchInputChange: (value: string) => void;
  paymentFilter: "" | "paid" | "unpaid";
  onPaymentFilterChange: (v: "" | "paid" | "unpaid") => void;
  statusFilter: string;
  onStatusFilterChange: (v: string) => void;
  priorityFilter: string;
  onPriorityFilterChange: (v: string) => void;
  dateFromUrl: string;
  dateToUrl: string;
  onDateFromChange: (v: string) => void;
  onDateToChange: (v: string) => void;
  presetAllActive: boolean;
  presetTodayActive: boolean;
  preset7dActive: boolean;
  onDatePreset: (preset: "all" | "today" | "7d") => void;
  pageSize: number;
  onPageSizeChange: (size: number) => void;
};

export function AdminOrdersFiltersSection({
  searchInput,
  onSearchInputChange,
  paymentFilter,
  onPaymentFilterChange,
  statusFilter,
  onStatusFilterChange,
  priorityFilter,
  onPriorityFilterChange,
  dateFromUrl,
  dateToUrl,
  onDateFromChange,
  onDateToChange,
  presetAllActive,
  presetTodayActive,
  preset7dActive,
  onDatePreset,
  pageSize,
  onPageSizeChange,
}: AdminOrdersFiltersSectionProps) {
  return (
    <section aria-labelledby="admin-orders-filters-heading">
      <h3 id="admin-orders-filters-heading" className="sr-only">
        Lọc và tìm kiếm đơn hàng
      </h3>
      <div className="grid w-full gap-3 sm:max-w-4xl sm:grid-cols-2 xl:grid-cols-4">
        <div>
          <label htmlFor="admin-order-search" className={labelClass}>
            Tìm kiếm
          </label>
          <input
            id="admin-order-search"
            type="search"
            value={searchInput}
            onChange={(e) => onSearchInputChange(e.target.value)}
            placeholder="SĐT, tên, hoặc 8 ký tự đầu mã đơn"
            className={inputClass}
            autoComplete="off"
          />
        </div>
        <div>
          <label htmlFor="admin-filter-payment" className={labelClass}>
            Thanh toán
          </label>
          <select
            id="admin-filter-payment"
            value={paymentFilter}
            onChange={(e) =>
              onPaymentFilterChange(e.target.value as "" | "paid" | "unpaid")
            }
            className={selectClass}
          >
            <option value="">Tất cả</option>
            <option value="paid">Đã thanh toán</option>
            <option value="unpaid">Chưa thanh toán</option>
          </select>
        </div>
        <div>
          <label htmlFor="admin-filter-status" className={labelClass}>
            Trạng thái in
          </label>
          <select
            id="admin-filter-status"
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
            className={selectClass}
          >
            <option value="">Tất cả</option>
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="admin-filter-priority" className={labelClass}>
            Ưu tiên
          </label>
          <select
            id="admin-filter-priority"
            value={priorityFilter}
            onChange={(e) => onPriorityFilterChange(e.target.value)}
            className={selectClass}
          >
            <option value="">Tất cả</option>
            {priorityOptions.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div
        className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:flex-wrap sm:items-end"
        role="group"
        aria-label="Lọc theo ngày tạo đơn và số dòng mỗi trang"
      >
        <div className="flex min-w-0 flex-col gap-2">
          <span className={labelClass}>Ngày tạo đơn</span>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onDatePreset("all")}
              className={
                presetAllActive
                  ? `${formSecondaryButtonClass} border-primary ring-1 ring-primary`
                  : formSecondaryButtonClass
              }
            >
              Tất cả
            </button>
            <button
              type="button"
              onClick={() => onDatePreset("today")}
              className={
                presetTodayActive
                  ? `${formSecondaryButtonClass} border-primary ring-1 ring-primary`
                  : formSecondaryButtonClass
              }
            >
              Hôm nay
            </button>
            <button
              type="button"
              onClick={() => onDatePreset("7d")}
              className={
                preset7dActive
                  ? `${formSecondaryButtonClass} border-primary ring-1 ring-primary`
                  : formSecondaryButtonClass
              }
            >
              7 ngày
            </button>
          </div>
        </div>
        <div>
          <label htmlFor="admin-filter-date-from" className={labelClass}>
            Từ ngày
          </label>
          <input
            id="admin-filter-date-from"
            type="date"
            value={dateFromUrl}
            onChange={(e) => onDateFromChange(e.target.value)}
            className={`${inputClass} mt-1 block min-h-[2.5rem]`}
          />
        </div>
        <div>
          <label htmlFor="admin-filter-date-to" className={labelClass}>
            Đến ngày
          </label>
          <input
            id="admin-filter-date-to"
            type="date"
            value={dateToUrl}
            onChange={(e) => onDateToChange(e.target.value)}
            className={`${inputClass} mt-1 block min-h-[2.5rem]`}
          />
        </div>
        <div className="sm:ml-auto">
          <label htmlFor="admin-order-page-size" className={labelClass}>
            Số đơn mỗi trang
          </label>
          <select
            id="admin-order-page-size"
            value={String(pageSize)}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className={`${selectClass} mt-1 block min-w-[5rem]`}
          >
            {ADMIN_ORDER_PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={String(n)}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>
    </section>
  );
}
