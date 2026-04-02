"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { registerDeviceAndSession } from "@/lib/auth/single-session/registerDeviceAndSession";
import type { PDFDocumentProxy } from "@/features/documents/read/pdfTypes";
import {
  buildDegradedWatermarkDisplayPayload,
  type WatermarkDisplayPayload,
} from "@/lib/watermark/watermark-contract";
import { collectHardwareFingerprint } from "@/lib/auth/fingerprint";

type ErrBody = {
  error?: string;
  code?: string;
  reason?: string;
  retry_after_seconds?: number;
  is_high_value?: boolean;
  is_downloadable?: boolean;
  num_pages?: number;
  is_locked?: boolean;
};
const PDF_WORKER_SRC = "/pdf.worker.min.mjs";

export default function usePdfFetchAndDecode({ documentId, deviceId }: { documentId: string; deviceId: string }) {
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [loading, setLoading] = useState(() => !!deviceId);
  const [error, setError] = useState("");
  const [watermark, setWatermark] = useState<WatermarkDisplayPayload | null>(null);
  const [watermarkDegraded, setWatermarkDegraded] = useState(false);
  const [isHighValueDoc, setIsHighValueDoc] = useState(false);
  const [isDownloadable, setIsDownloadable] = useState(false);
  const [rawPdfBlob, setRawPdfBlob] = useState<Blob | null>(null);
  const degradedEventSentRef = useRef(false);

  const fetchPdf = useCallback(async () => {
    if (!deviceId) return;

    setLoading(true);
    setError("");
    setPdfDoc(null);
    setRawPdfBlob(null);
    setNumPages(0);
    setWatermark(null);
    setWatermarkDegraded(false);
    setIsHighValueDoc(false);
    setIsDownloadable(false);
    degradedEventSentRef.current = false;

    try {
      const { signalsSummary, hardwareHash } = await collectHardwareFingerprint();

      const fetchDoc = async (isRetry = false, overrideDeviceId?: string) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000);

        const res = await fetch("/api/secure-pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            document_id: documentId,
            device_id: overrideDeviceId || deviceId,
            hardware_hash: hardwareHash,
            hardware_fingerprint: isRetry ? undefined : signalsSummary
          }),
          signal: controller.signal,
          credentials: "same-origin",
        });

        clearTimeout(timeoutId);
        return res;
      };

      let res = await fetchDoc();
      let contentType = res.headers.get("content-type") ?? "";
      let isHighValueHeader = res.headers.get("X-D2S-Is-High-Value") === "true";
      let isDownloadableHeader = res.headers.get("X-D2S-Is-Downloadable") === "true";
      let numPagesHeader = parseInt(res.headers.get("X-D2S-Num-Pages") || "0", 10);

      if (!res.ok) {
        let body = (contentType.includes("application/json")
          ? await res.json().catch(() => ({}))
          : {}) as ErrBody;

        // Optimistic Auto-Heal: If the backend complains about no active session for this device
        // we intercept it and auto-register the device instead of failing immediately.
        if (
          res.status === 403 &&
          body.code === "SESSION_BINDING_FAILED" &&
          body.reason === "no_active_session"
        ) {
          const reg = await registerDeviceAndSession(deviceId, signalsSummary, hardwareHash);
          if (reg.ok) {
            let fetchDeviceId = deviceId;
            if (reg.data?.recoveredDeviceId) {
              try { localStorage.setItem("doc2share_device_id", reg.data.recoveredDeviceId); } catch (_) { }
              fetchDeviceId = reg.data.recoveredDeviceId;
            }
            res = await fetchDoc(true, fetchDeviceId);
            contentType = res.headers.get("content-type") ?? "";
            isHighValueHeader = res.headers.get("X-D2S-Is-High-Value") === "true";
            isDownloadableHeader = res.headers.get("X-D2S-Is-Downloadable") === "true";
            numPagesHeader = parseInt(res.headers.get("X-D2S-Num-Pages") || "0", 10);

            if (!res.ok) {
              body = (contentType.includes("application/json")
                ? await res.json().catch(() => ({}))
                : {}) as ErrBody;
            }
          } else {
            setError(reg.error);
            setLoading(false);
            return;
          }
        }

        if (res.status === 403 && (isHighValueHeader || body.is_high_value)) {
          // Chế độ SSW (Server-side Watermarking)
          setIsHighValueDoc(true);
          setIsDownloadable(isDownloadableHeader || !!body.is_downloadable);
          setNumPages(numPagesHeader || body.num_pages || 0);

          const wmShort = res.headers.get("X-D2S-WM-Short");
          if (wmShort) {
            setWatermark({
              wmShort,
              wmDocShort: res.headers.get("X-D2S-WM-Doc-Short") || "",
              wmIssuedAtBucket: res.headers.get("X-D2S-WM-Issued-At-Bucket") || "",
              wmVersion: (res.headers.get("X-D2S-WM-Version") as "v1") || "v1",
            });
          } else {
            setWatermark(buildDegradedWatermarkDisplayPayload({ documentId, deviceId }));
          }
          setLoading(false);
          return;
        }

        const serverMessage = body.error ?? "";
        const retrySec = body.retry_after_seconds;
        const retryHint = res.status === 429 && typeof retrySec === "number" && retrySec > 0
          ? ` Thử lại sau ${retrySec >= 60 ? `${Math.ceil(retrySec / 60)} phút.` : `${retrySec} giây.`}`
          : "";

        const fallback = res.status === 401
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

      // Normal PDF path
      setIsDownloadable(isDownloadableHeader);
      const blob = await res.blob();
      setRawPdfBlob(blob);

      const wmShort = res.headers.get("X-D2S-WM-Short");
      const wmDocShort = res.headers.get("X-D2S-WM-Doc-Short");
      const wmIssuedAtBucket = res.headers.get("X-D2S-WM-Issued-At-Bucket");
      const wmVersion = res.headers.get("X-D2S-WM-Version");

      if (wmShort && wmDocShort && wmIssuedAtBucket && wmVersion === "v1") {
        setWatermark({
          wmShort,
          wmDocShort,
          wmIssuedAtBucket,
          wmVersion: "v1",
        });
        setWatermarkDegraded(false);
      } else {
        const fallback = buildDegradedWatermarkDisplayPayload({ documentId, deviceId });
        setWatermark(fallback);
        setWatermarkDegraded(true);
        if (!degradedEventSentRef.current) {
          degradedEventSentRef.current = true;
          fetch("/api/reader-observability", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({
              event_type: "watermark_degraded_fallback",
              document_id: documentId,
              device_id: deviceId
            }),
          }).catch(() => { });
        }
      }

      const pdfjsLib = await import("pdfjs-dist");
      if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_WORKER_SRC;
      }

      // Use a fresh arrayBuffer from the blob to avoid potential transfer issues
      const arrayBuffer = await blob.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const doc = await loadingTask.promise;

      setPdfDoc(doc as unknown as PDFDocumentProxy);
      setNumPages(doc.numPages);
      setLoading(false);
    } catch (err) {
      const msg = err instanceof Error
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

  useLayoutEffect(() => {
    if (!deviceId) return;
    void fetchPdf();
  }, [deviceId, fetchPdf]);

  return {
    pdfDoc,
    rawPdfBlob,
    numPages,
    loading,
    error,
    watermark,
    watermarkDegraded,
    isHighValueDoc,
    isDownloadable,
    refetch: fetchPdf
  };
}
