"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createCheckoutVietQr } from "@/app/checkout/actions";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";

function orderRowToUiStatus(row: { status: string | null; payment_status: string | null }): string {
  const paid =
    row.status === "completed" || row.payment_status === "Đã thanh toán";
  return paid ? "completed" : String(row.status ?? "pending");
}

export default function CheckoutForm() {
  const searchParams = useSearchParams();
  const documentId = searchParams.get("document_id");
  const router = useRouter();

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
  const [redirecting, setRedirecting] = useState(false);

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
    void loadCheckout();
  }, [loadCheckout]);

  // Đọc trạng thái trực tiếp từ Supabase (RLS = user chỉ thấy đơn của mình), không qua Server Action
  // lặp lại — tránh lỗi cookie/cache khi poll. Bổ sung Realtime + poll + refetch khi quay lại tab.
  useEffect(() => {
    if (!order || order.status === "completed") return;

    const orderId = order.orderId;
    const supabase = createBrowserSupabaseClient();

    const applyRow = (row: { status: string | null; payment_status: string | null } | null) => {
      if (!row) return;
      const next = orderRowToUiStatus(row);
      setOrder((prev) => {
        if (!prev || prev.status === next) return prev;
        return { ...prev, status: next };
      });
    };

    const fetchOnce = async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("status, payment_status")
        .eq("id", orderId)
        .maybeSingle();
      if (error) return;
      applyRow(data);
    };

    void fetchOnce();
    const tick = window.setInterval(() => void fetchOnce(), 3000);

    const channel = supabase
      .channel(`checkout-order-${orderId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `id=eq.${orderId}`,
        },
        (payload) => {
          const row = payload.new as { status?: string | null; payment_status?: string | null };
          applyRow({
            status: row.status ?? null,
            payment_status: row.payment_status ?? null,
          });
        },
      )
      .subscribe();

    const onVisible = () => {
      if (document.visibilityState === "visible") void fetchOnce();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearInterval(tick);
      document.removeEventListener("visibilitychange", onVisible);
      void supabase.removeChannel(channel);
    };
  }, [order]);

  // Do not put `redirecting` in the dependency array: after setRedirecting(true) the effect
  // would re-run, cleanup would clear the timeout, and the early return would skip scheduling again.
  useEffect(() => {
    if (order?.status !== "completed") return;

    setRedirecting(true);
    const t = window.setTimeout(() => {
      router.push("/tu-sach");
    }, 3000);

    return () => window.clearTimeout(t);
  }, [order?.status, router]);

  async function downloadQrCode() {
    if (!order) return;
    try {
      const url = `/api/qr?amount=${order.amount}&addInfo=${encodeURIComponent(order.transferContent)}`;
      const res = await fetch(url);
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
              <p className="mt-3 text-xs text-muted">
                Trạng thái đơn:{" "}
                <span
                  data-testid="checkout-order-status"
                  className={order.status === "completed" ? "text-emerald-600 font-semibold" : "font-medium text-fg"}
                >
                  {order.status}
                </span>
              </p>
              <div aria-live="polite" aria-atomic="true" className="sr-only">
                {order.status === "completed"
                  ? redirecting
                    ? "Đơn hàng đã thanh toán thành công. Quyền truy cập tài liệu đã được cấp. Đang chuyển tới Tủ sách."
                    : "Đơn hàng đã thanh toán thành công. Quyền truy cập tài liệu đã được cấp."
                  : `Trạng thái đơn hàng: ${order.status}.`}
              </div>
              {order.status === "completed" ? (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                    Thanh toán đã xác nhận. Quyền truy cập tài liệu đã được cấp.
                  </p>
                  <p className="text-xs text-muted">Tự động chuyển tới Tủ sách trong 3 giây...</p>
                  <Link
                    href="/tu-sach"
                    className="inline-block rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-card transition hover:bg-primary-700"
                  >
                    Về Tủ sách
                  </Link>
                </div>
              ) : null}
            </div>

            <div className="space-y-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- Proxy API; next/image not suited */}
              <img
                src={`/api/qr?amount=${order.amount}&addInfo=${encodeURIComponent(order.transferContent)}`}
                alt="VietQR thanh toán"
                loading="eager"
                decoding="async"
                fetchPriority="high"
                width={280}
                height={280}
                className="mx-auto block w-full max-w-[280px] rounded-xl border border-line bg-surface p-2"
              />
              <button type="button" className="btn-secondary w-full" onClick={downloadQrCode}>
                Tải mã QR
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

