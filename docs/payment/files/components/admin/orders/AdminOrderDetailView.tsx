import { AdminOrderCopyActions } from "@/components/admin/orders/AdminOrderCopyActions";
import { AdminOrderNotePaymentEdit } from "@/components/admin/orders/AdminOrderNotePaymentEdit";
import { OrderFileLinks } from "@/components/admin/orders/OrderFileLinks";
import { OrderPrintSpec } from "@/components/admin/orders/OrderPrintSpec";
import { OrderStatusBadge } from "@/components/admin/orders/OrderStatusBadge";
import { OrderTimestampStack } from "@/components/admin/orders/OrderTimestampStack";
import { adminDeliveryShortLabel } from "@/components/admin/orders/adminOrderDisplay";
import { BookPrintPricingBreakdown } from "@/components/order-form/BookPrintPricingBreakdown";
import {
  formNestedPanelClass,
  formSectionOverlineClass,
  linkAccentClass,
} from "@/components/admin/adminStyles";
import { DELIVERY_METHOD_LABEL } from "@/lib/orders/delivery";
import { isPaidPaymentStatus } from "@/lib/orders/adminOrderFilters";
import { orderShortCode } from "@/lib/orders/orderShortCode";
import type { Order } from "@/lib/orders/types";

function formatVnd(n: number | null | undefined): string {
  if (n == null) return "—";
  return `${n.toLocaleString("vi-VN")} VNĐ`;
}

function deliveryDetailLabel(order: Order): string {
  if (order.delivery_method === "delivery") {
    const base = DELIVERY_METHOD_LABEL.delivery;
    const addr = order.delivery_address?.trim();
    return addr ? `${base} · ${addr}` : base;
  }
  return DELIVERY_METHOD_LABEL.pickup;
}

type Props = {
  order: Order;
  /** Sau khi PATCH ghi chú/thanh toán thành công (làm mới chi tiết + danh sách). */
  onAfterInlinePatch?: () => void;
};

export function AdminOrderDetailView({ order, onAfterInlinePatch }: Props) {
  const paid = isPaidPaymentStatus(order.payment_status);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className={`${formSectionOverlineClass} mb-1`}>Mã đơn</p>
          <p className="break-all font-mono text-sm text-foreground">{order.id}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-xs text-muted-foreground">Mã ngắn</span>
            <span className="font-mono text-sm text-foreground">
              {orderShortCode(order.id)}
            </span>
            <AdminOrderCopyActions orderId={order.id} variant="detail" />
          </div>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      <section className={formNestedPanelClass}>
        <h3 className={`${formSectionOverlineClass} mb-3`}>Khách hàng</h3>
        <p className="text-lg font-semibold text-foreground">{order.customer_name}</p>
        <p className="mt-1">
          <a href={`tel:${order.phone_number}`} className={linkAccentClass}>
            {order.phone_number}
          </a>
        </p>
      </section>

      <section className={formNestedPanelClass}>
        <h3 className={`${formSectionOverlineClass} mb-3`}>Ghi chú</h3>
        {order.note?.trim() ? (
          <p className="whitespace-pre-wrap text-sm text-foreground-muted">{order.note}</p>
        ) : (
          <p className="text-sm text-placeholder">—</p>
        )}
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <section className={formNestedPanelClass}>
          <h3 className={`${formSectionOverlineClass} mb-3`}>In và đặc tả</h3>
          <div className="text-sm text-foreground-muted">
            <OrderPrintSpec order={order} />
          </div>
        </section>
        <section className={formNestedPanelClass}>
          <h3 className={`${formSectionOverlineClass} mb-3`}>Khối lượng và giá</h3>
          <ul className="space-y-1 text-sm text-foreground-muted">
            <li>
              Số trang (ước tính):{" "}
              <span className="text-foreground">{order.page_count ?? "—"}</span>
            </li>
            <li>
              Tổng trang in:{" "}
              <span className="text-foreground">{order.total_pages ?? "—"}</span>
            </li>
            <li>
              Số bản:{" "}
              <span className="text-foreground">{order.copies ?? "—"}</span>
            </li>
            <BookPrintPricingBreakdown order={order} />
            <li className="pt-1 font-medium text-foreground">
              Thành tiền: {formatVnd(order.total_price)}
            </li>
          </ul>
        </section>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <section className={formNestedPanelClass}>
          <h3 className={`${formSectionOverlineClass} mb-3`}>Thanh toán</h3>
          <p className="text-sm text-foreground-muted">
            {order.payment_status?.trim() ? (
              <>
                <span className="font-medium text-foreground">{order.payment_status}</span>
                {paid && (
                  <span className="ml-2 rounded-md bg-primary-muted px-2 py-0.5 text-xs text-primary-foreground">
                    Đã nhận tiền
                  </span>
                )}
              </>
            ) : (
              "—"
            )}
          </p>
        </section>
        <section className={formNestedPanelClass}>
          <h3 className={`${formSectionOverlineClass} mb-3`}>Nhận hàng</h3>
          <p className="text-sm text-foreground-muted">{deliveryDetailLabel(order)}</p>
          <p className="mt-1 text-xs text-placeholder">
            Rút gọn: {adminDeliveryShortLabel(order)}
            {order.delivery_method === "delivery" && (
              <> · Phí ship: {formatVnd(order.shipping_fee)}</>
            )}
          </p>
        </section>
      </div>

      <section className={formNestedPanelClass}>
        <h3 className={`${formSectionOverlineClass} mb-3`}>Mốc thời gian</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="mb-1 text-xs font-medium text-placeholder">Tạo đơn</p>
            <OrderTimestampStack at={order.created_at} />
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-placeholder">Hoàn thành in</p>
            <OrderTimestampStack at={order.completed_at} />
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-placeholder">Giao hàng</p>
            <OrderTimestampStack at={order.delivered_at} />
          </div>
        </div>
      </section>

      {onAfterInlinePatch && (
        <AdminOrderNotePaymentEdit order={order} onAfterSave={onAfterInlinePatch} />
      )}

      <section className={formNestedPanelClass}>
        <h3 className={`${formSectionOverlineClass} mb-3`}>File</h3>
        <OrderFileLinks
          fileUrl={order.file_url}
          fileName={order.file_name}
          variant="verbose"
          linkClassName={`text-sm ${linkAccentClass}`}
          wrapperClassName="flex flex-wrap gap-2"
        />
      </section>
    </div>
  );
}
