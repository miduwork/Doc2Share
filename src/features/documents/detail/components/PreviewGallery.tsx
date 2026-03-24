"use client";

import { useCallback, useState } from "react";
import { ChevronLeft, ChevronRight, FileText } from "lucide-react";

function PreviewSkeleton({ className = "", isPdf = false }: { className?: string; isPdf?: boolean }) {
  return (
    <div
      className={`relative flex flex-col items-center justify-center gap-3 rounded-2xl bg-surface-muted ${className}`}
      aria-hidden
    >
      <div className="preview-skeleton-shimmer absolute inset-0 h-full w-full rounded-2xl bg-surface-muted opacity-80" />
      {isPdf && (
        <>
          <FileText className="h-12 w-12 text-muted opacity-50 relative z-10" strokeWidth={1.5} />
          <span className="text-sm text-muted relative z-10">Đang tải tài liệu…</span>
        </>
      )}
    </div>
  );
}

export type PreviewSlide = { type: "pdf"; url: string } | { type: "image"; url: string };

interface PreviewGalleryProps {
  /** PDF = một slide iframe; image = một hoặc nhiều slide ảnh */
  slides: PreviewSlide[];
  title?: string;
  className?: string;
  /** Chiều cao container (vd. h-[56vh] min-h-[320px]) */
  containerClass?: string;
}

export default function PreviewGallery({
  slides,
  title = "Bản xem thử",
  className = "",
  containerClass = "h-[56vh] min-h-[320px] sm:h-[68vh] sm:min-h-[540px] lg:h-[78vh] lg:min-h-[680px] lg:max-h-[960px]",
}: PreviewGalleryProps) {
  const [current, setCurrent] = useState(0);
  const [loaded, setLoaded] = useState<Record<number, boolean>>({});

  const setLoadedAt = useCallback((i: number) => {
    setLoaded((prev) => ({ ...prev, [i]: true }));
  }, []);

  if (slides.length === 0) return null;

  const slide = slides[current];
  const hasMultiple = slides.length > 1;
  const isPdf = slide.type === "pdf";

  return (
    <div className={`relative flex flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-[inset_0_2px_8px_rgba(0,0,0,0.04)] ${containerClass} ${className}`}>
      {/* Viewer chrome – chỉ PDF: thanh nhỏ phía trên iframe */}
      {isPdf && (
        <div className="flex shrink-0 items-center gap-2 border-b border-line bg-surface-muted/80 px-4 py-2.5">
          <FileText className="h-4 w-4 shrink-0 text-primary" />
          <span className="text-sm font-medium text-fg">{title}</span>
          <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">PDF</span>
        </div>
      )}

      {/* Vùng nội dung (iframe / ảnh) */}
      <div className="relative flex-1 min-h-0">
        {!loaded[current] && (
          <div className="absolute inset-0 z-10">
            <PreviewSkeleton className={`absolute inset-0 ${isPdf ? "rounded-b-2xl" : "rounded-2xl"}`} isPdf={isPdf} />
          </div>
        )}

        <div className="relative h-full w-full">
          {isPdf ? (
            <iframe
              src={`${slide.url.split("#")[0]}#toolbar=0&navpanes=0`}
              title={title}
              loading="lazy"
              className="h-full w-full border-0 bg-surface"
              onLoad={() => setLoadedAt(current)}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- preview URL; gallery
            <img
              src={slide.url}
              alt={`${title} ${current + 1}/${slides.length}`}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-contain transition-opacity duration-300"
              style={{ opacity: loaded[current] ? 1 : 0 }}
              onLoad={() => setLoadedAt(current)}
            />
          )}
        </div>
      </div>

      {/* Nút prev/next – chỉ khi nhiều slide */}
      {hasMultiple && (
        <>
          <button
            type="button"
            onClick={() => setCurrent((i) => (i === 0 ? slides.length - 1 : i - 1))}
            className="absolute left-2 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow-md transition hover:bg-white dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            aria-label="Ảnh trước"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => setCurrent((i) => (i === slides.length - 1 ? 0 : i + 1))}
            className="absolute right-2 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow-md transition hover:bg-white dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            aria-label="Ảnh sau"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </>
      )}

      {/* Dots */}
      {hasMultiple && (
        <div className="absolute bottom-3 left-0 right-0 z-20 flex justify-center gap-1.5">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setCurrent(i)}
              className={`h-2 rounded-full transition-all ${
                i === current ? "w-6 bg-primary" : "w-2 bg-white/60 hover:bg-white/80"
              }`}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>
      )}

      {/* Caption số thứ tự – chỉ khi nhiều slide */}
      {hasMultiple && (
        <p className="absolute right-3 top-3 z-20 rounded bg-black/50 px-2 py-1 text-xs text-white backdrop-blur-sm">
          {current + 1} / {slides.length}
        </p>
      )}
    </div>
  );
}

