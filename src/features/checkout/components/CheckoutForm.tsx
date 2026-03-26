"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle, ArrowRight, Loader2, QrCode, Download } from "lucide-react";
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
  const [countdown, setCountdown] = useState(3);

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

  // Sync state from Supabase
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

  // Handle redirect and countdown
  useEffect(() => {
    if (order?.status !== "completed") return;

    setRedirecting(true);
    const interval = window.setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    const t = window.setTimeout(() => {
      router.push("/tu-sach");
    }, 3000);

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(t);
    };
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

  const isCompleted = order?.status === "completed";

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-8">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-line bg-surface shadow-card transition-all duration-500">

        {/* Header / Brand */}
        <div className={`p-6 text-center ${isCompleted ? "bg-emerald-50 dark:bg-emerald-950/20" : "bg-slate-50 dark:bg-slate-900/40"}`}>
          <h1 className={`text-xl font-bold ${isCompleted ? "text-emerald-700 dark:text-emerald-400" : "text-fg"}`}>
            {isCompleted ? "Thanh toán thành công" : "Quét mã VietQR"}
          </h1>
          {!isCompleted && <p className="mt-1 text-sm text-muted">Vui lòng sử dụng App Ngân hàng để quét mã</p>}
        </div>

        <div className="p-8">
          {loading && (
            <div className="flex flex-col items-center justify-center space-y-4 py-8">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-muted">Đang tạo đơn hàng...</p>
            </div>
          )}

          {error && !order && (
            <div className="space-y-4 py-4 text-center">
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-600 dark:border-red-900/30 dark:bg-red-900/20 dark:text-red-400">
                {error}
              </div>
              <button type="button" className="btn-primary w-full" onClick={() => loadCheckout()}>
                Thử lại
              </button>
            </div>
          )}

          {order && !error && (
            <div className="space-y-6">
              {/* STATUS & INFO */}
              {!isCompleted ? (
                <>
                  <div className="rounded-2xl border border-dashed border-line bg-surface-muted p-5 text-sm">
                    <p className="font-bold text-fg line-clamp-1 mb-3">{order.documentTitle}</p>

                    <div className="grid grid-cols-2 gap-y-2 text-xs">
                      <span className="text-muted">Mã đơn hàng:</span>
                      <span className="text-right font-mono font-bold">{order.orderId.slice(0, 8).toUpperCase()}</span>

                      <span className="text-muted">Số tiền:</span>
                      <span className="text-right font-bold text-primary">{order.amount.toLocaleString("vi-VN")} ₫</span>

                      <span className="text-muted">Nội dung CK:</span>
                      <span className="text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">{order.transferContent}</span>
                    </div>
                  </div>

                  <div className="relative group cursor-pointer" onClick={downloadQrCode}>
                    <div className="relative z-10 mx-auto w-64 h-64 rounded-2xl border-2 border-line bg-white p-3 shadow-inner transition group-hover:border-primary/50">
                      <img
                        src={`/api/qr?amount=${order.amount}&addInfo=${encodeURIComponent(order.transferContent)}`}
                        alt="VietQR thanh toán"
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition duration-300 pointer-events-none">
                      <div className="bg-primary/90 text-white px-4 py-2 rounded-full text-xs font-bold shadow-glow flex items-center gap-2">
                        <Download className="h-4 w-4" /> Tải về
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-center gap-3 py-2">
                    <div className="h-2 w-2 animate-pulse rounded-full bg-primary"></div>
                    <span className="text-xs font-medium text-muted">Chờ thanh toán...</span>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center space-y-6 py-4 animate-in fade-in zoom-in duration-500">
                  <div className="rounded-full bg-emerald-100 p-4 dark:bg-emerald-900/30">
                    <CheckCircle className="h-16 w-16 text-emerald-600 dark:text-emerald-400 animate-bounce-slow" />
                  </div>

                  <div className="text-center space-y-2">
                    <p className="text-lg font-bold text-fg">Xác nhận thanh toán !</p>
                    <p className="text-sm text-muted">Quyền truy cập tài liệu đã được cấp.</p>
                  </div>

                  <div className="w-full space-y-3">
                    <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden dark:bg-slate-800">
                      <div
                        className="h-full bg-emerald-500 transition-all duration-1000 ease-linear"
                        style={{ width: `${(3 - countdown) * 33.33}%` }}
                      ></div>
                    </div>
                    <p className="text-center text-xs text-muted">
                      Tự động chuyển tới Tủ sách sau <span className="font-bold text-fg">{countdown}</span> giây...
                    </p>
                  </div>

                  <Link
                    href="/tu-sach"
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-3.5 text-sm font-bold text-white shadow-glow transition hover:bg-primary-600 active:scale-95"
                  >
                    Về Tủ sách của tôi <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


