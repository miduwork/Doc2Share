"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import PublicLayout from "@/components/layout/PublicLayout";
import { createCheckoutVietQr, getCheckoutOrderStatus } from "./actions";

function CheckoutForm() {
  const searchParams = useSearchParams();
  const documentId = searchParams.get("document_id");
  const [order, setOrder] = useState<{
    orderId: string;
    externalId: string | null;
    paymentLink: string | null;
    amount: number;
    documentTitle: string;
    transferContent: string;
    status: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [justCheckedPending, setJustCheckedPending] = useState(false);

  const loadCheckout = useCallback(async () => {
    if (!documentId) {
      setError("Thiếu document_id");
      setLoading(false);
      return;
    }
    setError("");
    setLoading(true);
    const result = await createCheckoutVietQr(documentId);
    if (!result.ok) {
      setError(result.error ?? "Có lỗi xảy ra");
      setLoading(false);
      return;
    }
    const d = result.data!;
    setOrder({
      orderId: d.orderId,
      externalId: d.externalId,
      paymentLink: d.paymentLink,
      amount: d.amount,
      documentTitle: d.documentTitle,
      transferContent: d.transferContent,
      status: d.status,
    });
    setLoading(false);
  }, [documentId]);

  useEffect(() => {
    loadCheckout();
  }, [loadCheckout]);

  useEffect(() => {
    if (!order || order.status === "completed") return;
    const id = window.setInterval(async () => {
      const statusRes = await getCheckoutOrderStatus(order.orderId);
      if (!statusRes.ok || !statusRes.data) return;
      if (statusRes.data.status !== order.status) {
        setOrder((prev) => (prev ? { ...prev, status: statusRes.data!.status } : prev));
      }
    }, 12000);
    return () => window.clearInterval(id);
  }, [order]);

  async function checkPaymentNow() {
    if (!order) return;
    setJustCheckedPending(false);
    setChecking(true);
    const statusRes = await getCheckoutOrderStatus(order.orderId);
    setChecking(false);
    if (!statusRes.ok) {
      setError(statusRes.error);
      return;
    }
    if (statusRes.data) {
      const newStatus = statusRes.data.status;
      setOrder((prev) => (prev ? { ...prev, status: newStatus } : prev));
      if (newStatus === "pending") setJustCheckedPending(true);
    }
  }

  async function copyTransferContent() {
    if (!order) return;
    try {
      await navigator.clipboard.writeText(order.transferContent);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setError("Không thể sao chép nội dung chuyển khoản.");
    }
  }

  async function downloadQrCode() {
    if (!order?.paymentLink) return;
    try {
      const res = await fetch(order.paymentLink);
      if (!res.ok) throw new Error("download_failed");
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `vietqr-${order.orderId.slice(0, 8).toUpperCase()}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      setError("Không thể tải mã QR. Vui lòng thử lại.");
    }
  }

  return (
    <PublicLayout>
      <div className="flex flex-1 items-center justify-center px-4 py-8">
        <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-card">
          <h1 className="text-xl font-bold text-semantic-heading">Thanh toán VietQR</h1>
          {loading && <p className="mt-4 text-muted">Đang tạo đơn hàng...</p>}
          {error && !order && (
            <div className="mt-4 space-y-3">
              <p className="text-red-600 dark:text-red-400">{error}</p>
              <button type="button" className="btn-primary" onClick={() => loadCheckout()}>
                Thử lại
              </button>
            </div>
          )}
          {order && !error && (
            <div className="mt-4 space-y-4">
              <div className="rounded-xl border border-line bg-surface-muted p-4 text-sm">
                <p className="font-medium text-fg">{order.documentTitle}</p>
                <p className="mt-1 text-muted">
                  Mã đơn: <span className="font-mono">{order.orderId.slice(0, 8).toUpperCase()}</span>
                </p>
                {order.externalId ? (
                  <p className="text-muted">
                    Mã đối soát: <span className="font-mono">{order.externalId}</span>
                  </p>
                ) : null}
                <p className="text-muted">
                  Số tiền: <strong className="text-fg">{order.amount.toLocaleString("vi-VN")} ₫</strong>
                </p>
                <p className="text-muted">
                  Nội dung CK: <span className="font-mono">{order.transferContent}</span>
                </p>
                <div className="mt-4 flex flex-col gap-2">
                  <button type="button" className="btn-secondary w-full" onClick={copyTransferContent}>
                    {copied ? "Đã sao chép" : "Copy nội dung CK"}
                  </button>
                  <button type="button" className="btn-primary w-full" onClick={checkPaymentNow} disabled={checking}>
                    {checking ? "Đang kiểm tra..." : "Đã chuyển khoản – Kiểm tra ngay"}
                  </button>
                </div>
                <p className="mt-3 text-xs text-muted">
                  Trạng thái đơn:{" "}
                  <span
                    data-testid="checkout-order-status"
                    className={order.status === "completed" ? "text-emerald-600 font-semibold" : "font-medium text-fg"}
                  >
                    {order.status}
                  </span>
                </p>
                {justCheckedPending && order.status === "pending" && (
                  <p className="mt-2 text-xs text-amber-600 dark:text-amber-400" role="status">
                    Chưa nhận được thanh toán. Vui lòng chuyển khoản đúng số tiền và nội dung CK rồi bấm kiểm tra lại.
                  </p>
                )}
                <div aria-live="polite" aria-atomic="true" className="sr-only">
                  {order.status === "completed"
                    ? "Đơn hàng đã thanh toán thành công. Quyền truy cập tài liệu đã được cấp."
                    : `Trạng thái đơn hàng: ${order.status}.`}
                </div>
                {order.status === "completed" ? (
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                      Thanh toán đã xác nhận. Quyền truy cập tài liệu đã được cấp.
                    </p>
                    <Link
                      href="/dashboard"
                      className="inline-block rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-card transition hover:bg-primary-700"
                    >
                      Về Tủ sách
                    </Link>
                  </div>
                ) : null}
              </div>

              {order.paymentLink ? (
                <div className="space-y-3">
                  {/* eslint-disable-next-line @next/next/no-img-element -- VietQR data URL; next/image not suited */}
                  <img
                    src={order.paymentLink}
                    alt="VietQR thanh toán"
                    className="mx-auto block w-full max-w-[280px] rounded-xl border border-line bg-surface p-2"
                  />
                  <p className="text-xs text-muted">
                    Quét mã VietQR bằng app ngân hàng để thanh toán. Hệ thống sẽ mở quyền sau khi webhook xác nhận giao dịch.
                  </p>
                  <button type="button" className="btn-secondary w-full" onClick={downloadQrCode}>
                    Tải mã QR
                  </button>
                </div>
              ) : (
                <p className="text-sm text-amber-600">
                  Chưa cấu hình VietQR (VIETQR_BANK_BIN / VIETQR_ACCOUNT_NO / VIETQR_ACCOUNT_NAME). Vui lòng liên hệ admin.
                </p>
              )}
            </div>
          )}
          <div className="content-prose mt-6 border-t border-line pt-4">
            <Link href="/tai-lieu" className="text-sm text-muted transition hover:text-primary">
              ← Quay lại tài liệu
            </Link>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <PublicLayout>
          <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center">
            <p className="text-slate-500">Đang tải...</p>
          </div>
        </PublicLayout>
      }
    >
      <CheckoutForm />
    </Suspense>
  );
}
