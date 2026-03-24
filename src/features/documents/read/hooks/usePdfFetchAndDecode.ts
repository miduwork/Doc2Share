"use client";

import { useCallback, useEffect, useState } from "react";
import { registerDeviceAndSession } from "@/lib/auth/single-session/registerDeviceAndSession";
import type { PDFDocumentProxy } from "@/features/documents/read/pdfTypes";

type ErrBody = { error?: string; retry_after_seconds?: number };

export default function usePdfFetchAndDecode({ documentId, deviceId }: { documentId: string; deviceId: string }) {
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [loading, setLoading] = useState(() => !!deviceId);
  const [error, setError] = useState("");

  const fetchPdf = useCallback(async () => {
    if (!deviceId) return;

    setLoading(true);
    setError("");
    setPdfDoc(null);
    setNumPages(0);

    try {
      const reg = await registerDeviceAndSession(deviceId);
      if (!reg.ok) {
        setError(reg.error);
        setLoading(false);
        return;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      const res = await fetch("/api/secure-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document_id: documentId, device_id: deviceId }),
        signal: controller.signal,
        credentials: "same-origin",
      });

      clearTimeout(timeoutId);

      const contentType = res.headers.get("content-type") ?? "";
      if (!res.ok) {
        const body = (contentType.includes("application/json") ? ((await res.json().catch(() => ({}))) as ErrBody) : {}) as ErrBody;
        const serverMessage = body.error ?? "";
        const retrySec = body.retry_after_seconds;

        const retryHint =
          res.status === 429 && typeof retrySec === "number" && retrySec > 0
            ? ` Thử lại sau ${retrySec >= 60 ? `${Math.ceil(retrySec / 60)} phút.` : `${retrySec} giây.`}`
            : "";

        const fallback =
          res.status === 401
            ? "Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại."
            : res.status === 403
              ? serverMessage || "Bạn không có quyền xem tài liệu này."
              : res.status === 429
                ? serverMessage || "Thao tác quá nhiều. Vui lòng thử lại sau."
                : `Không thể tải tài liệu (lỗi ${res.status}).`;

        setError((serverMessage.trim() || fallback) + retryHint);
        setLoading(false);
        return;
      }

      const arrayBuffer = await res.arrayBuffer();

      // pdfjs-dist được load động để giảm bundle.
      const pdfjsLib = await import("pdfjs-dist");
      if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = "https://unpkg.com/pdfjs-dist@5.3.93/build/pdf.worker.min.mjs";
      }

      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const doc = await loadingTask.promise;

      setPdfDoc(doc as unknown as PDFDocumentProxy);
      setNumPages(doc.numPages);
      setLoading(false);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.name === "AbortError"
            ? "Tải quá lâu. Kiểm tra mạng và thử lại."
            : err.message === "Failed to fetch"
              ? "Không kết nối được server. Kiểm tra mạng và thử lại."
              : err.message || "Không thể tải tài liệu."
          : "Không thể tải tài liệu. Thử lại sau.";

      setError(msg);
      setLoading(false);
    }
  }, [deviceId, documentId]);

  useEffect(() => {
    if (!deviceId) return;
    fetchPdf();
  }, [deviceId, fetchPdf]);

  return { pdfDoc, numPages, loading, error, refetch: fetchPdf };
}

