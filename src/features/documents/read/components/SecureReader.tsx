"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X, ZoomIn, ZoomOut, List, StickyNote, ChevronLeft, ChevronRight } from "lucide-react";
import usePersistentDeviceId from "@/features/documents/read/hooks/usePersistentDeviceId";
import usePdfFetchAndDecode from "@/features/documents/read/hooks/usePdfFetchAndDecode";
import useReaderSecurityGuards from "@/features/documents/read/hooks/useReaderSecurityGuards";
import PdfCanvasRenderer from "@/features/documents/read/components/PdfCanvasRenderer";

const DESKTOP_BREAKPOINT_PX = 768;

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

  const pagesPerView = usePagesPerView();
  const deviceId = usePersistentDeviceId();

  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.2);

  const { pdfDoc, numPages, loading, error, refetch } = usePdfFetchAndDecode({ documentId, deviceId });
  const { contentHidden, mouseInView, setContentHidden } = useReaderSecurityGuards();

  const handleRefetch = useCallback(async () => {
    setCurrentPage(1);
    await refetch();
  }, [refetch]);

  const close = () => router.push("/tu-sach");

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
          <button
            type="button"
            onClick={() => {
              void handleRefetch();
            }}
            className="btn-secondary !border-white/40 !bg-white/20 !text-white hover:!bg-white/30"
          >
            Thử lại
          </button>
          <button type="button" onClick={() => router.push("/tu-sach")} className="btn-primary">
            Về Tủ sách
          </button>
          <a
            href={loginRedirect}
            className="btn-secondary !border-white/40 !bg-white/10 !text-white hover:!bg-white/20 no-underline"
          >
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
                {pagesPerView === 2 && currentPage + 1 <= numPages ? `${currentPage}-${currentPage + 1} / ${numPages}` : `${currentPage} / ${numPages}`}
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
        {!mouseInView && <div className="absolute inset-0 z-10 bg-black" aria-hidden />}

        {pdfDoc && (
          <PdfCanvasRenderer
            pdfDoc={pdfDoc}
            numPages={numPages}
            currentPage={currentPage}
            scale={scale}
            pagesPerView={pagesPerView}
            userEmail={userEmail}
          />
        )}
      </div>
    </div>
  );
}

