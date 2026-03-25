"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Order } from "@/lib/orders/types";
import { subscribeOrderUpdates } from "@/lib/orders/realtime";
import { PICKUP_ADDRESS_DISPLAY } from "@/lib/config/business";
import { buildVietQRUrl } from "@/lib/payments/vietqr";
import { DELIVERY_METHOD_LABEL } from "@/lib/orders/delivery";
import {
  formatOrderSpecSummary,
  isOrderSpecV1,
} from "@/lib/orders/printJobSpec";
import { PRINT_COLOR_LABEL, PRINT_SIDES_LABEL } from "@/lib/orders/printOptions";
import { BookPrintPricingBreakdown } from "@/components/order-form/BookPrintPricingBreakdown";
import { PaymentPageSkeleton } from "@/components/feedback/PaymentPageSkeleton";
import {
  authTitleClass,
  formPageContentMaxMdClass,
  formPageShellClass,
  formPageSubtitleClass,
  formPageTitleClass,
  formErrorAlertClass,
  formPrimaryButtonInlineClass,
  formSecondaryButtonBlockClass,
  formSectionCardClass,
  formSectionCardMbClass,
  formSectionOverlineClass,
  linkAccentClass,
} from "@/components/order-form/formStyles";

const PAYMENT_STATUS_PAID = "Đã thanh toán";

function isPaidStatus(status: string | null | undefined): boolean {
  if (status == null) return false;
  return status.trim() === PAYMENT_STATUS_PAID;
}

/** Dự phòng nếu Realtime chưa bắt được UPDATE — poll ngắn để sau webhook vài giây vẫn thấy đã thanh toán. */
const FALLBACK_POLL_MS = 5_000;

export default function PaymentPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [qrImageFailed, setQrImageFailed] = useState(false);
  const isPaidRef = useRef(false);

  useEffect(() => {
    setQrImageFailed(false);
  }, [id]);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setError("Thiếu mã đơn hàng.");
      return;
    }

    let cancelled = false;
    let unsubscribeRealtime: (() => void) | undefined;
    let fallbackPoll: ReturnType<typeof setInterval> | undefined;
    let visibilityHandler: (() => void) | undefined;

    function clearTimersAndRealtime() {
      if (unsubscribeRealtime) {
        unsubscribeRealtime();
        unsubscribeRealtime = undefined;
      }
      if (fallbackPoll) {
        clearInterval(fallbackPoll);
        fallbackPoll = undefined;
      }
    }

    async function fetchOrder(showLoading = false): Promise<Order | null> {
      if (showLoading) setLoading(true);
      try {
        const res = await fetch(`/api/orders/${id}`, {
          cache: "no-store",
          headers: {
            "Cache-Control": "no-cache",
            Pragma: "no-cache",
          },
        });
        if (!res.ok) {
          if (res.status === 404) {
            if (!cancelled) {
              setError("Đơn hàng không tồn tại.");
              setOrder(null);
              setLoading(false);
            }
            return null;
          }
          const body = await res.json().catch(() => null);
          throw new Error(body?.error || "Không tải được đơn hàng.");
        }
        const json = (await res.json()) as { order: Order };
        if (!cancelled) {
          setOrder(json.order);
          setError("");
          setLoading(false);
          if (isPaidStatus(json.order.payment_status)) {
            isPaidRef.current = true;
            clearTimersAndRealtime();
          }
          return json.order;
        }
        return null;
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : "Không tải được đơn hàng.",
          );
          setLoading(false);
        }
        return null;
      }
    }

    void (async () => {
      const initial = await fetchOrder(true);
      if (cancelled || !initial) return;

      if (isPaidStatus(initial.payment_status)) {
        return;
      }

      unsubscribeRealtime = subscribeOrderUpdates(id, (next) => {
        if (cancelled) return;
        setOrder((prev) => {
          const p = prev ?? ({} as Order);
          const merged = { ...p, ...next } as Order;
          if (next.payment_status === undefined && p.payment_status != null) {
            merged.payment_status = p.payment_status;
          }
          return merged;
        });
        if (isPaidStatus(next.payment_status)) {
          isPaidRef.current = true;
          clearTimersAndRealtime();
        }
      });

      fallbackPoll = setInterval(() => {
        if (cancelled || isPaidRef.current) return;
        void fetchOrder(false);
      }, FALLBACK_POLL_MS);

      visibilityHandler = () => {
        if (
          document.visibilityState === "visible" &&
          !isPaidRef.current &&
          !cancelled
        ) {
          void fetchOrder(false);
        }
      };
      document.addEventListener("visibilitychange", visibilityHandler);
    })();

    return () => {
      cancelled = true;
      clearTimersAndRealtime();
      if (visibilityHandler) {
        document.removeEventListener("visibilitychange", visibilityHandler);
      }
    };
  }, [id]);

  if (loading) {
    return <PaymentPageSkeleton />;
  }

  if (error || !order) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-muted px-4">
        <p className="text-red-600">{error || "Đơn hàng không tồn tại."}</p>
        <Link href="/" className={`font-medium ${linkAccentClass}`}>
          ← Về trang chủ
        </Link>
      </main>
    );
  }

  const totalPrice = order.total_price ?? 0;
  const shortId = order.id.slice(0, 8);
  const { url: qrUrl, addInfo } = buildVietQRUrl(totalPrice, shortId);
  const downloadUrl = `/api/qr?amount=${encodeURIComponent(
    String(totalPrice || 0),
  )}&addInfo=${encodeURIComponent(addInfo)}`;
  const isPaid = isPaidStatus(order.payment_status);

  if (isPaid) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-primary-muted to-muted-elevated px-4 pb-safe">
        <div className="mx-auto w-full max-w-md text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary-muted text-primary">
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className={authTitleClass}>Thanh toán thành công</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Cảm ơn bạn! Tiệm đang kiểm tra và sẽ in ngay cho bạn.
          </p>
          <p className="mt-1 text-sm text-placeholder">Mã đơn: {order.id.slice(0, 8)}</p>
          <Link href="/" className={`${formPrimaryButtonInlineClass} mt-8`}>
            Về trang chủ
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className={formPageShellClass}>
      <div className={formPageContentMaxMdClass}>
        <header className="mb-6 text-center">
          <h1 className={formPageTitleClass}>Thanh toán đơn in</h1>
          <p className={formPageSubtitleClass}>Quét mã QR để chuyển khoản</p>
        </header>

        <section className={formSectionCardMbClass}>
          <h2 className={formSectionOverlineClass}>Hóa đơn</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-placeholder">Mã đơn hàng</dt>
              <dd className="font-mono font-medium text-foreground">
                {order.id.slice(0, 8)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-placeholder">Khách hàng</dt>
              <dd className="font-medium text-foreground">{order.customer_name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-placeholder">Số trang</dt>
              <dd className="font-medium text-foreground">
                {order.total_pages ?? order.page_count ?? "—"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-placeholder">Số bản in</dt>
              <dd className="font-medium text-foreground">
                {order.copies ?? 1}
              </dd>
            </div>
            {order.order_spec != null && isOrderSpecV1(order.order_spec) ? (
              <div className="flex flex-col gap-1 border-t border-border pt-3 sm:flex-row sm:justify-between">
                <dt className="text-placeholder">Chi tiết in</dt>
                <dd className="max-w-[min(100%,240px)] text-right text-sm font-medium leading-snug text-foreground">
                  {formatOrderSpecSummary(order.order_spec, {
                    printColor: order.print_color,
                    printSides: order.print_sides,
                  })}
                </dd>
              </div>
            ) : (
              <>
                <div className="flex justify-between">
                  <dt className="text-placeholder">Loại in</dt>
                  <dd className="font-medium text-foreground">
                    {PRINT_COLOR_LABEL[(order.print_color ?? "bw") as keyof typeof PRINT_COLOR_LABEL]}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-placeholder">In 2 mặt / 1 mặt</dt>
                  <dd className="font-medium text-foreground">
                    {PRINT_SIDES_LABEL[(order.print_sides ?? "double") as keyof typeof PRINT_SIDES_LABEL]}
                  </dd>
                </div>
              </>
            )}
            {order.order_spec != null &&
              isOrderSpecV1(order.order_spec) &&
              order.order_spec.kind === "book" && (
                <BookPrintPricingBreakdown order={order} variant="rows" />
              )}
            <div className="flex justify-between">
              <dt className="text-placeholder">Hình thức giao hàng</dt>
              <dd className="font-medium text-foreground">
                {DELIVERY_METHOD_LABEL[
                  (order.delivery_method as "pickup" | "delivery") ?? "pickup"
                ]}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-placeholder">Địa chỉ</dt>
              <dd className="max-w-[60%] text-right font-medium text-foreground">
                {order.delivery_method === "delivery"
                  ? order.delivery_address || "—"
                  : PICKUP_ADDRESS_DISPLAY}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-placeholder">Phí vận chuyển</dt>
              <dd className="font-medium text-foreground">
                {(order.shipping_fee ?? 0).toLocaleString("vi-VN")} VNĐ
              </dd>
            </div>
            <div className="flex justify-between border-t border-border pt-3">
              <dt className="font-medium text-foreground-muted">Tổng tiền</dt>
              <dd className="text-lg font-bold text-primary-foreground">
                {(totalPrice || 0).toLocaleString("vi-VN")} VNĐ
              </dd>
            </div>
          </dl>
        </section>

        <section className={`${formSectionCardClass} mb-6 flex flex-col items-center`}>
          <p className="mb-4 text-sm text-muted-foreground">Quét mã QR để chuyển đúng số tiền</p>
          {qrImageFailed && (
            <div role="alert" className={`${formErrorAlertClass} mb-4 w-full text-left`}>
              <p className="font-medium">Không tải được ảnh QR từ VietQR.</p>
              <p className="mt-2 text-sm opacity-90">
                Thường do <strong>NEXT_PUBLIC_VIETQR_BANK_ID</strong> hoặc{" "}
                <strong>NEXT_PUBLIC_VIETQR_ACCOUNT_NO</strong> chưa đúng với STK thật (giá trị mẫu{" "}
                <code className="rounded bg-danger-foreground/10 px-1">123456789</code> sẽ bị VietQR từ chối).
                Đối chiếu mã ngân hàng với{" "}
                <a
                  href="https://api.vietqr.io/v2/banks"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  danh sách VietQR
                </a>
                , sửa <code className="rounded bg-danger-foreground/10 px-1">.env.local</code>, khởi động lại app
                và tải lại trang. Trong DevTools → Network, request tới <code className="break-all">img.vietqr.io</code>{" "}
                thường trả 4xx/5xx khi STK không hợp lệ.
              </p>
            </div>
          )}
          <Image
            src={qrUrl}
            alt="Mã QR thanh toán"
            width={192}
            height={192}
            className="h-48 w-48 rounded-lg bg-surface object-contain"
            onError={() => setQrImageFailed(true)}
          />
          <p className="mt-3 text-xs text-placeholder">
            Nội dung CK: {addInfo}
          </p>

          <a href={downloadUrl} className={formSecondaryButtonBlockClass}>
            Tải mã QR về máy
          </a>
          <p className="mt-2 text-center text-xs text-placeholder">
            Sau khi chuyển khoản, trang này sẽ tự chuyển sang trạng thái &quot;Thanh toán thành công&quot; trong vài giây.
          </p>
        </section>

        <p className="text-center">
          <Link href="/" className={`text-sm font-medium ${linkAccentClass}`}>
            ← Về trang chủ
          </Link>
        </p>
      </div>
    </main>
  );
}
