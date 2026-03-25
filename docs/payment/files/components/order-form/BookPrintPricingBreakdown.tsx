"use client";

import { useEffect, useState } from "react";
import { publicConfig } from "@/lib/config/public";
import type { PublicAppConfigV1 } from "@/lib/config/publicAppConfig";
import { isOrderSpecV1 } from "@/lib/orders/printJobSpec";
import type { Order } from "@/lib/orders/types";
import {
  type BookOrderSpec,
  computeBookPrintBreakdown,
} from "@/lib/payments/printSubtotal";

function formatVnd(n: number): string {
  return `${n.toLocaleString("vi-VN")} VNĐ`;
}

type Props = {
  order: Order;
  /** `list`: thẻ `<li>` (đặt trong `<ul>`). `rows`: `<div>` giống dòng dl trên trang thanh toán. */
  variant?: "list" | "rows";
  /** CSS cho phần ghi chú nhỏ */
  footnoteClassName?: string;
};

/**
 * Đơn sách: hiển thị phân bổ tiền in ruột / bìa (theo bảng giá hiện tại từ GET /api/public/config).
 * Tổng đơn đã chốt vẫn là `order.total_price` (có thể lệch nếu đổi giá sau khi tạo đơn).
 */
export function BookPrintPricingBreakdown({
  order,
  variant = "list",
  footnoteClassName = "mt-1 text-xs text-placeholder",
}: Props) {
  const [parts, setParts] = useState<{
    body: number;
    cover: number;
    binding: number;
  } | null>(null);
  const [error, setError] = useState(false);

  const isBook =
    order.order_spec != null &&
    isOrderSpecV1(order.order_spec) &&
    order.order_spec.kind === "book";

  useEffect(() => {
    if (!isBook) {
      setParts(null);
      return;
    }
    let cancelled = false;
    setError(false);
    (async () => {
      try {
        const res = await fetch("/api/public/config", { cache: "no-store" });
        if (!res.ok) throw new Error("config");
        const data = (await res.json()) as PublicAppConfigV1;
        if (cancelled || data.v !== 1) return;
        const copies = order.copies ?? 1;
        const breakdown = computeBookPrintBreakdown({
          orderSpec: order.order_spec as BookOrderSpec,
          copies,
          pricing: data.pricing,
          fallbackPricePerPage: publicConfig.pricePerPage,
        });
        if (!cancelled) {
          setParts({
            body: breakdown.bodySubtotal,
            cover: breakdown.coverSubtotal,
            binding: breakdown.bindingSubtotal,
          });
        }
      } catch {
        if (!cancelled) {
          setParts(null);
          setError(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isBook, order]);

  if (!isBook) return null;

  const footnoteText = `Tổng đơn đã chốt: ${formatVnd(order.total_price ?? 0)}. Chi tiết trên là ước tính theo bảng giá lúc xem trang; có thể khác nếu giá đã đổi sau khi tạo đơn.`;

  if (error) {
    const msg = "Không tải được phân bổ tiền in (cấu hình giá).";
    if (variant === "rows") {
      return (
        <div className="flex flex-col gap-1 border-t border-border pt-3 text-sm">
          <p className="text-placeholder">{msg}</p>
        </div>
      );
    }
    return <li className="text-xs text-placeholder">{msg}</li>;
  }

  if (parts == null) {
    const msg = "Phân bổ tiền in: đang tải…";
    if (variant === "rows") {
      return (
        <div className="flex flex-col gap-1 border-t border-border pt-3 text-sm">
          <p className="text-placeholder">{msg}</p>
        </div>
      );
    }
    return <li className="text-xs text-placeholder">{msg}</li>;
  }

  if (variant === "rows") {
    return (
      <div className="flex flex-col gap-2 border-t border-border pt-3 text-sm">
        <div className="flex justify-between gap-2">
          <dt className="text-placeholder">Tiền in ruột (theo giá hiện tại)</dt>
          <dd className="font-medium text-foreground">{formatVnd(parts.body)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-placeholder">Tiền in bìa (theo giá hiện tại)</dt>
          <dd className="text-right font-medium text-foreground">
            {formatVnd(parts.cover)}
            <span className="ml-1 text-xs font-normal text-placeholder">
              (lookup 2 mặt)
            </span>
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-placeholder">Phí đóng gáy (theo giá hiện tại)</dt>
          <dd className="font-medium text-foreground">{formatVnd(parts.binding)}</dd>
        </div>
        <p className={footnoteClassName}>{footnoteText}</p>
      </div>
    );
  }

  return (
    <>
      <li>
        Tiền in ruột (theo giá hiện tại):{" "}
        <span className="text-foreground">{formatVnd(parts.body)}</span>
      </li>
      <li>
        Tiền in bìa (theo giá hiện tại):{" "}
        <span className="text-foreground">{formatVnd(parts.cover)}</span>
        <span className="ml-1 text-xs text-placeholder">
          (lookup 2 mặt)
        </span>
      </li>
      <li>
        Phí đóng gáy (theo giá hiện tại):{" "}
        <span className="text-foreground">{formatVnd(parts.binding)}</span>
      </li>
      <li className={footnoteClassName}>{footnoteText}</li>
    </>
  );
}
