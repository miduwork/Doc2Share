"use client";

import { useEffect, useRef } from "react";
import type { AdminOrdersColumnVisibility } from "@/lib/admin/adminOrdersColumnConfig";
import {
  adminTableTheadCellClass,
  adminTableTheadStickyLeftClass,
  adminTableTheadStickyRightClass,
} from "@/components/admin/adminStyles";

type BulkProps = {
  allSelected: boolean;
  someSelected: boolean;
  onToggleAll: (checked: boolean) => void;
};

type Props = {
  visible: AdminOrdersColumnVisibility;
  bulkSelect?: BulkProps;
};

export function AdminOrdersTableHead({ visible, bulkSelect }: Props) {
  const selectAllRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = selectAllRef.current;
    if (!el) return;
    el.indeterminate = Boolean(
      bulkSelect?.someSelected && !bulkSelect.allSelected,
    );
  }, [bulkSelect?.someSelected, bulkSelect?.allSelected]);

  return (
    <thead>
      <tr>
        {bulkSelect && (
          <th
            scope="col"
            className={`${adminTableTheadCellClass} w-[1%] px-2 py-3`}
          >
            <input
              ref={selectAllRef}
              type="checkbox"
              checked={bulkSelect.allSelected}
              onChange={(e) => bulkSelect.onToggleAll(e.target.checked)}
              className="h-4 w-4 rounded border-border"
              aria-label="Chọn tất cả đơn trên trang này"
            />
          </th>
        )}
        {visible.timestamps && (
          <>
            <th
              scope="col"
              className={`${adminTableTheadCellClass} w-[1%] whitespace-nowrap px-3 py-3`}
            >
              Tạo đơn
            </th>
            <th
              scope="col"
              className={`${adminTableTheadCellClass} w-[1%] whitespace-nowrap px-3 py-3`}
            >
              Hoàn thành
            </th>
            <th
              scope="col"
              className={`${adminTableTheadCellClass} w-[1%] whitespace-nowrap px-3 py-3`}
            >
              Giao hàng
            </th>
          </>
        )}
        <th
          scope="col"
          className={`${adminTableTheadStickyLeftClass} whitespace-nowrap px-3 py-3`}
        >
          Khách hàng
        </th>
        {visible.print && (
          <th
            scope="col"
            className={`${adminTableTheadCellClass} whitespace-nowrap px-3 py-3`}
          >
            In
          </th>
        )}
        {visible.note && (
          <th
            scope="col"
            className={`${adminTableTheadCellClass} min-w-[200px] px-4 py-3`}
          >
            Ghi chú
          </th>
        )}
        {visible.phone && (
          <th
            scope="col"
            className={`${adminTableTheadCellClass} px-4 py-3`}
          >
            SĐT
          </th>
        )}
        {visible.file && (
          <th scope="col" className={`${adminTableTheadCellClass} px-4 py-3`}>
            File
          </th>
        )}
        {visible.pages && (
          <th
            scope="col"
            className={`${adminTableTheadCellClass} w-[1%] whitespace-nowrap px-3 py-3`}
          >
            Trang × Bản
          </th>
        )}
        {visible.delivery && (
          <th
            scope="col"
            className={`${adminTableTheadCellClass} px-4 py-3`}
          >
            Nhận hàng
          </th>
        )}
        {visible.priority && (
          <th
            scope="col"
            className={`${adminTableTheadCellClass} px-4 py-3`}
          >
            Ưu tiên
          </th>
        )}
        {visible.status && (
          <th
            scope="col"
            className={`${adminTableTheadCellClass} px-4 py-3`}
          >
            Trạng thái
          </th>
        )}
        <th
          scope="col"
          className={`${adminTableTheadStickyRightClass} px-4 py-3`}
        >
          Thao tác
        </th>
      </tr>
    </thead>
  );
}
