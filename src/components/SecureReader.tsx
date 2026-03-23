"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X, ZoomIn, ZoomOut, List, StickyNote, ChevronLeft, ChevronRight } from "lucide-react";
import { registerDeviceAndSession } from "@/app/login/actions";

type PDFDocumentProxy = { getPage: (_n: number) => Promise<{ getViewport: (_o: { scale: number }) => { width: number; height: number }; render: (_ctx: unknown) => { promise: Promise<void>; cancel: () => void } }>; numPages: number };

const DESKTOP_BREAKPOINT_PX = 768;

/** Delay (ms) trước khi che nội dung khi window mất focus — tránh che nhấp nháy khi user click nhầm ra ngoài. */
const BLUR_HIDE_DELAY_MS = 400;

function usePagesPerView(): 1 | 2 {
  const [pagesPerView, setPagesPerView] = useState<1 | 2>(() =>
    typeof window !== "undefined" && window.matchMedia(`(min-width: ${DESKTOP_BREAKPOINT_PX}px)`).matches ? 2 : 1
  );
  useEffect(() => {
    const mql = window.matchMedia(`(min-width: ${DESKTOP_BREAKPOINT_PX}px)`);
    const handler = () => setPagesPerView(mql.matches ? 2 : 1);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);
  return pagesPerView;
}

export default function SecureReader({
  documentId,
  documentTitle,
  userEmail,
}: {
  documentId: string;
  documentTitle: string;
  userEmail: string;
}) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasRef2 = useRef<HTMLCanvasElement>(null);
  const pagesPerView = usePagesPerView();
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [scale, setScale] = useState(1.2);
  const [mouseInView, setMouseInView] = useState(true);
  const [contentHidden, setContentHidden] = useState(false);
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);
  const renderTaskRef2 = useRef<{ cancel: () => void } | null>(null);
  const renderRunIdRef = useRef(0);
  const blurHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getDeviceId = useCallback(() => {
    let id = localStorage.getItem("doc2share_device_id");
    if (!id) {
      id = "fp_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem("doc2share_device_id", id);
    }
    return id;
  }, []);

  // Tải PDF qua API proxy (same-origin, tránh CORS) rồi render bằng PDF.js
  const fetchPdf = useCallback(async () => {
    const deviceId = getDeviceId();
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
        type ErrBody = { error?: string; retry_after_seconds?: number };
        const body = (contentType.includes("application/json")
          ? (await res.json().catch(() => ({}))) as ErrBody
          : {}) as ErrBody;
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
      const pdfjsLib = await import("pdfjs-dist");
      if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = "https://unpkg.com/pdfjs-dist@5.3.93/build/pdf.worker.min.mjs";
      }
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const doc = await loadingTask.promise;
      setPdfDoc(doc as unknown as PDFDocumentProxy);
      setNumPages(doc.numPages);
      setCurrentPage(1);
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
  }, [documentId, getDeviceId]);

  useEffect(() => {
    fetchPdf();
  }, [fetchPdf]);

  // Render trang hiện tại (và trang kế khi 2 trang) lên canvas — dùng runId để bỏ qua callback cũ
  useEffect(() => {
    if (!pdfDoc) return;
    const runId = ++renderRunIdRef.current;
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;

    const renderOne = (pageNum: number, canvas: HTMLCanvasElement | null, taskRef: React.MutableRefObject<{ cancel: () => void } | null>) => {
      if (!canvas || pageNum < 1 || pageNum > numPages) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      if (taskRef.current) {
        taskRef.current.cancel();
        taskRef.current = null;
      }
      pdfDoc.getPage(pageNum).then((page) => {
        if (renderRunIdRef.current !== runId) return;
        const viewport = page.getViewport({ scale });
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);
        const task = page.render({
          canvasContext: ctx,
          canvas,
          viewport,
          intent: "display",
        });
        taskRef.current = task as { cancel: () => void };
        task.promise.then(() => { taskRef.current = null; }).catch(() => {});
      }).catch(() => {});
    };

    if (pagesPerView === 1) {
      renderOne(currentPage, canvasRef.current, renderTaskRef);
      if (renderTaskRef2.current) {
        renderTaskRef2.current.cancel();
        renderTaskRef2.current = null;
      }
    } else {
      renderOne(currentPage, canvasRef.current, renderTaskRef);
      renderOne(currentPage + 1, canvasRef2.current, renderTaskRef2);
    }

    return () => {
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }
      if (renderTaskRef2.current) {
        renderTaskRef2.current.cancel();
        renderTaskRef2.current = null;
      }
    };
  }, [pdfDoc, currentPage, scale, numPages, pagesPerView]);

  // Chặn sao chép, in, lưu, cắt, kéo thả, phím tắt chụp màn hình, F12; khi bấm Print Screen → che đen toàn màn hình ngay
  useEffect(() => {
    const prevent = (e: Event) => e.preventDefault();
    const preventKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && (e.key === "c" || e.key === "p" || e.key === "s" || e.key === "x")) e.preventDefault();
      if (e.metaKey && (e.key === "c" || e.key === "p" || e.key === "s" || e.key === "x")) e.preventDefault();
      if (e.key === "F12") e.preventDefault();
      // Print Screen / Snapshot: chặn và che đen toàn màn hình ngay — chụp màn hình chỉ thấy đen
      const isPrintScreen =
        e.key === "PrintScreen" || e.key === "Snapshot" || e.keyCode === 44 || e.code === "PrintScreen";
      if (isPrintScreen) {
        e.preventDefault();
        e.stopPropagation();
        setContentHidden(true);
      }
      // Cmd+Shift+3/4/5 (macOS screenshot): chặn và che đen
      if (e.shiftKey && (e.metaKey || e.ctrlKey) && ["3", "4", "5"].includes(e.key)) {
        e.preventDefault();
        setContentHidden(true);
      }
    };
    document.addEventListener("contextmenu", prevent);
    document.addEventListener("copy", prevent);
    document.addEventListener("cut", prevent);
    document.addEventListener("dragstart", prevent);
    document.addEventListener("keydown", preventKey, true);
    return () => {
      document.removeEventListener("contextmenu", prevent);
      document.removeEventListener("copy", prevent);
      document.removeEventListener("cut", prevent);
      document.removeEventListener("dragstart", prevent);
      document.removeEventListener("keydown", preventKey, true);
    };
  }, []);

  // Mouse leave viewport -> blur
  useEffect(() => {
    const onLeave = () => setMouseInView(false);
    const onEnter = () => setMouseInView(true);
    document.documentElement.addEventListener("mouseleave", onLeave);
    document.documentElement.addEventListener("mouseenter", onEnter);
    return () => {
      document.documentElement.removeEventListener("mouseleave", onLeave);
      document.documentElement.removeEventListener("mouseenter", onEnter);
    };
  }, []);

  // Chống chụp màn hình: che khi tab ẩn (ngay) hoặc mất focus (sau delay để tránh che nhấp nháy)
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        if (blurHideTimerRef.current) {
          clearTimeout(blurHideTimerRef.current);
          blurHideTimerRef.current = null;
        }
        setContentHidden(true);
      }
    };
    const onBlur = () => {
      if (blurHideTimerRef.current) clearTimeout(blurHideTimerRef.current);
      blurHideTimerRef.current = setTimeout(() => {
        blurHideTimerRef.current = null;
        setContentHidden(true);
      }, BLUR_HIDE_DELAY_MS);
    };
    const onFocus = () => {
      if (blurHideTimerRef.current) {
        clearTimeout(blurHideTimerRef.current);
        blurHideTimerRef.current = null;
      }
      setContentHidden(false);
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      if (blurHideTimerRef.current) {
        clearTimeout(blurHideTimerRef.current);
        blurHideTimerRef.current = null;
      }
    };
  }, []);

  const close = () => router.push("/dashboard");

  if (loading) {
    return (
      <div className="reader-fullscreen flex items-center justify-center text-white">
        <p>Đang tải tài liệu...</p>
      </div>
    );
  }
  if (error) {
    const loginRedirect = `/login?redirect=${encodeURIComponent(`/doc/${documentId}/read`)}`;
    return (
      <div className="reader-fullscreen flex flex-col items-center justify-center gap-4 text-white">
        <p className="text-center max-w-md">{error}</p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button type="button" onClick={() => { setError(""); setLoading(true); fetchPdf(); }} className="btn-secondary !border-white/40 !bg-white/20 !text-white hover:!bg-white/30">
            Thử lại
          </button>
          <button type="button" onClick={() => router.push("/dashboard")} className="btn-primary">
            Về Tủ sách
          </button>
          <a href={loginRedirect} className="btn-secondary !border-white/40 !bg-white/10 !text-white hover:!bg-white/20 no-underline">
            Đăng nhập lại
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="reader-fullscreen flex flex-col select-none">
      {/* Thanh công cụ: Phóng to / Thu nhỏ, Trang trước/sau, Đóng — không có Tải về / In */}
      <div className="flex items-center justify-between border-b border-slate-600 bg-slate-800 px-4 py-2.5">
        <span className="truncate text-sm font-medium text-white">{documentTitle}</span>
        <div className="flex items-center gap-1">
          {numPages > 0 && (
            <>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - pagesPerView))}
                disabled={currentPage <= 1}
                className="rounded-lg p-2 text-slate-300 transition hover:bg-slate-700 hover:text-white disabled:opacity-40"
                aria-label="Trang trước"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <span className="min-w-[5rem] text-center text-xs text-slate-400">
                {pagesPerView === 2 && currentPage + 1 <= numPages
                  ? `${currentPage}-${currentPage + 1} / ${numPages}`
                  : `${currentPage} / ${numPages}`}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(numPages, p + pagesPerView))}
                disabled={currentPage + pagesPerView > numPages}
                className="rounded-lg p-2 text-slate-300 transition hover:bg-slate-700 hover:text-white disabled:opacity-40"
                aria-label="Trang sau"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
              <span className="mx-1 h-6 w-px bg-slate-600" />
            </>
          )}
          <button
            type="button"
            onClick={() => setScale((s) => Math.min(2, s + 0.2))}
            className="rounded-lg p-2 text-slate-300 transition hover:bg-slate-700 hover:text-white"
            aria-label="Phóng to"
          >
            <ZoomIn className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => setScale((s) => Math.max(0.6, s - 0.2))}
            className="rounded-lg p-2 text-slate-300 transition hover:bg-slate-700 hover:text-white"
            aria-label="Thu nhỏ"
          >
            <ZoomOut className="h-5 w-5" />
          </button>
          <span className="mx-1 h-6 w-px bg-slate-600" />
          <button
            type="button"
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-700 hover:text-slate-200"
            aria-label="Mục lục"
            title="Mục lục (sắp có)"
          >
            <List className="h-5 w-5" />
          </button>
          <button
            type="button"
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-700 hover:text-slate-200"
            aria-label="Ghi chú"
            title="Ghi chú (sắp có)"
          >
            <StickyNote className="h-5 w-5" />
          </button>
          <span className="mx-1 h-6 w-px bg-slate-600" />
          <button
            type="button"
            onClick={close}
            className="rounded-lg p-2 text-slate-300 transition hover:bg-slate-700 hover:text-white"
            aria-label="Đóng"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* PDF area with overlay */}
      <div className="relative flex-1 overflow-auto bg-slate-900">
        {/* Che đen toàn màn hình khi mất focus/chuyển tab — chụp cửa sổ chỉ thấy đen */}
        {contentHidden && (
          <div
            className="absolute inset-0 z-30 flex cursor-pointer items-center justify-center bg-black"
            role="button"
            tabIndex={0}
            onClick={() => document.visibilityState === "visible" && setContentHidden(false)}
            onKeyDown={(e) => e.key === "Enter" && document.visibilityState === "visible" && setContentHidden(false)}
            aria-label="Click để tiếp tục xem"
          >
            <p className="text-center text-sm text-white/70">Nhấn vào đây để tiếp tục xem tài liệu</p>
          </div>
        )}
        {/* Đen hoàn toàn khi chuột ra khỏi viewport — không làm mờ, chụp màn hình chỉ thấy đen */}
        {!mouseInView && (
          <div className="absolute inset-0 z-10 bg-black" aria-hidden />
        )}
        {pdfDoc && (
          <div className="flex justify-center overflow-auto p-4" style={{ minHeight: "100%" }}>
            <div className={pagesPerView === 2 ? "flex flex-wrap justify-center gap-4 items-start" : "relative inline-block"}>
              <div className="relative inline-block">
                <canvas ref={canvasRef} className="bg-white shadow-lg block" />
                <div
                  className="reader-watermark-doc absolute inset-0 z-20 overflow-hidden pointer-events-none select-none"
                  aria-hidden
                >
                  {[
                    [15, 20], [50, 15], [85, 25],
                    [10, 50], [50, 50], [90, 48],
                    [18, 78], [52, 82], [88, 75],
                  ].map(([x, y], i) => (
                    <div
                      key={i}
                      className="absolute text-base font-semibold text-slate-500 whitespace-nowrap"
                      style={{
                        left: `${x}%`,
                        top: `${y}%`,
                        transform: "translate(-50%, -50%) rotate(-25deg)",
                        opacity: 0.28,
                      }}
                    >
                      {userEmail} · Doc2Share
                    </div>
                  ))}
                </div>
              </div>
              {pagesPerView === 2 && currentPage + 1 <= numPages && (
                <div className="relative inline-block">
                  <canvas ref={canvasRef2} className="bg-white shadow-lg block" />
                  <div
                    className="reader-watermark-doc absolute inset-0 z-20 overflow-hidden pointer-events-none select-none"
                    aria-hidden
                  >
                    {[
                      [15, 20], [50, 15], [85, 25],
                      [10, 50], [50, 50], [90, 48],
                      [18, 78], [52, 82], [88, 75],
                    ].map(([x, y], i) => (
                      <div
                        key={i}
                        className="absolute text-base font-semibold text-slate-500 whitespace-nowrap"
                        style={{
                          left: `${x}%`,
                          top: `${y}%`,
                          transform: "translate(-50%, -50%) rotate(-25deg)",
                          opacity: 0.28,
                        }}
                      >
                        {userEmail} · Doc2Share
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
