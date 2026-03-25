import Link from "next/link";
import { AdminOrderCopyActions } from "@/components/admin/orders/AdminOrderCopyActions";
import { OrderFileLinks } from "@/components/admin/orders/OrderFileLinks";
import { OrderPrintSpec } from "@/components/admin/orders/OrderPrintSpec";
import { OrderPrioritySelect } from "@/components/admin/orders/OrderPrioritySelect";
import { OrderRowActions } from "@/components/admin/orders/OrderRowActions";
import { OrderStatusBadge } from "@/components/admin/orders/OrderStatusBadge";
import { OrderTimestampStack } from "@/components/admin/orders/OrderTimestampStack";
import { adminDeliveryShortLabel } from "@/components/admin/orders/adminOrderDisplay";
import {
  adminTableBodyStickyLeftClass,
  adminTableBodyStickyRightClass,
  linkAccentClass,
  tableRowClass,
} from "@/components/admin/adminStyles";
import type { AdminOrdersColumnVisibility } from "@/lib/admin/adminOrdersColumnConfig";
import { adminOrderDetailPath, orderShortCode } from "@/lib/orders/orderShortCode";
import type { Order } from "@/lib/orders/types";

const detailLinkClass = `${linkAccentClass} font-medium underline-offset-2 hover:underline`;

type Props = {
  order: Order;
  updatingId: string | null;
  onPriorityChange: (orderId: string, priority: string) => void;
  onUpdateStatus: (
    id: string,
    status: string,
    completed_at?: string | null,
    delivered_at?: string | null,
  ) => void | Promise<void>;
  visible: AdminOrdersColumnVisibility;
  bulkSelect?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string, checked: boolean) => void;
};

export function AdminOrderTableRow({
  order,
  updatingId,
  onPriorityChange,
  onUpdateStatus,
  visible,
  bulkSelect,
  selected,
  onToggleSelect,
}: Props) {
  return (
    <tr className={tableRowClass}>
      {bulkSelect && (
        <td className="w-[1%] px-2 py-3 align-middle">
          <input
            type="checkbox"
            checked={selected ?? false}
            onChange={(e) => onToggleSelect?.(order.id, e.target.checked)}
            className="h-4 w-4 rounded border-border"
            aria-label={`Chọn đơn ${order.customer_name}`}
          />
        </td>
      )}
      {visible.timestamps && (
        <>
          <td className="w-[1%] whitespace-nowrap px-3 py-3 text-muted-foreground">
            <OrderTimestampStack at={order.created_at} />
          </td>
          <td className="w-[1%] whitespace-nowrap px-3 py-3 text-muted-foreground">
            <OrderTimestampStack at={order.completed_at} />
          </td>
          <td className="w-[1%] whitespace-nowrap px-3 py-3 text-muted-foreground">
            <OrderTimestampStack at={order.delivered_at} />
          </td>
        </>
      )}
      <td className={`px-3 py-3 ${adminTableBodyStickyLeftClass}`}>
        <div className="flex min-w-0 max-w-[16rem] flex-col gap-1">
          <Link
            href={adminOrderDetailPath(order.id)}
            className={`${detailLinkClass} truncate`}
          >
            {order.customer_name}
          </Link>
          <div className="flex min-w-0 flex-wrap items-center gap-1">
            <span className="font-mono text-xs text-muted-foreground">
              {orderShortCode(order.id)}
            </span>
            <AdminOrderCopyActions orderId={order.id} />
          </div>
        </div>
      </td>
      {visible.print && (
        <td className="whitespace-nowrap px-3 py-3 text-xs text-muted-foreground">
          <OrderPrintSpec order={order} />
        </td>
      )}
      {visible.note && (
        <td className="min-w-[200px] px-4 py-3">
          {order.note ? (
            <p className="text-xs text-muted-foreground" title={order.note}>
              {order.note}
            </p>
          ) : (
            <span className="text-placeholder">—</span>
          )}
        </td>
      )}
      {visible.phone && (
        <td className="whitespace-nowrap px-4 py-3">
          <a href={`tel:${order.phone_number}`} className={linkAccentClass}>
            {order.phone_number}
          </a>
        </td>
      )}
      {visible.file && (
        <td className="px-4 py-3">
          <OrderFileLinks
            fileUrl={order.file_url}
            fileName={order.file_name}
            variant="compact"
          />
        </td>
      )}
      {visible.pages && (
        <td className="w-[1%] whitespace-nowrap px-3 py-3 text-center text-muted-foreground">
          {order.page_count != null ? (
            <span className="text-xs">
              {order.page_count} × {order.copies ?? 1}
            </span>
          ) : (
            <span className="text-placeholder">—</span>
          )}
        </td>
      )}
      {visible.delivery && (
        <td className="px-4 py-3 text-muted-foreground">
          <span className="text-xs">{adminDeliveryShortLabel(order)}</span>
        </td>
      )}
      {visible.priority && (
        <td className="px-4 py-3">
          <OrderPrioritySelect
            order={order}
            updatingId={updatingId}
            onPriorityChange={onPriorityChange}
            variant="table"
          />
        </td>
      )}
      {visible.status && (
        <td className="px-4 py-3">
          <OrderStatusBadge status={order.status} />
        </td>
      )}
      <td className={`px-4 py-3 ${adminTableBodyStickyRightClass}`}>
        <div className="flex flex-wrap gap-1">
          <OrderRowActions
            order={order}
            updatingId={updatingId}
            onUpdateStatus={onUpdateStatus}
            size="table"
          />
        </div>
      </td>
    </tr>
  );
}
