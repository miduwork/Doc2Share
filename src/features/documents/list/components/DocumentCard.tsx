"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { Category } from "@/lib/types";
import { slugify } from "@/lib/seo";
import { Eye, Star, X } from "lucide-react";
import ImageCard from "@/features/documents/shared/components/ImageCard";
import PriceCtaBlock from "@/features/documents/shared/components/PriceCtaBlock";
import Link from "next/link";
import type { QuickPreviewVariant } from "@/features/documents/list/experiments/quick-preview-experiment";
import { trackExperimentEvent } from "@/features/documents/list/experiments/track-experiment-event";
import type { DocumentCardDoc } from "./document-card-types";
import { useMicroInteraction } from "../hooks/useMicroInteraction";

interface Props {
  doc: DocumentCardDoc;
  categories: Category[];
  viewCount?: number | null;
  ratingCount?: number;
  avgRating?: number | null;
  soldCount?: number;
  /** default: đầy đủ; compact: ảnh nhỏ, bỏ mô tả, CTA gọn */
  variant?: "default" | "compact";
  /** Badge góc trên ảnh: 'premium' | 'free' | false (ẩn) | ReactNode (tùy chỉnh). Mặc định 'premium'. */
  topBadge?: "premium" | "free" | false | ReactNode;
  /**
   * Tilt 3D + micro-card hover. Mặc định true.
   * Có thể truyền false cho grid đầu trang trên Kho để giảm tải tương tác.
   */
  enableMicroInteraction?: boolean;
  /** Bật/tắt nút xem nhanh. Mặc định true. */
  enableQuickPreview?: boolean;
  quickPreviewVariant?: QuickPreviewVariant;
  /** User đã có quyền đọc (đã mua) — hiển thị tag Đã mua */
  isPurchased?: boolean;
}

export default function DocumentCard({
  doc,
  categories,
  viewCount,
  ratingCount = 0,
  avgRating = null,
  soldCount = 0,
  variant = "default",
  topBadge = "premium",
  enableMicroInteraction = true,
  enableQuickPreview = true,
  quickPreviewVariant = "A",
  isPurchased = false,
}: Props) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const previewOpenButtonRef = useRef<HTMLButtonElement | null>(null);
  const previewModalRef = useRef<HTMLDivElement | null>(null);

  const subject = categories.find((c) => c.id === doc.subject_id);
  const grade = categories.find((c) => c.id === doc.grade_id);
  const exam = categories.find((c) => c.id === doc.exam_id);
  const slug = slugify(doc.title);
  const href = `/cua-hang/${doc.id}/${slug}`;
  const isCompact = variant === "compact";
  const previewUrl = typeof doc.preview_url === "string" && doc.preview_url.trim() ? doc.preview_url : null;
  const allowsTilt = enableMicroInteraction;
  const allowsQuickPreview = Boolean(previewUrl) && enableQuickPreview;
  const quickPreviewLabel = quickPreviewVariant === "B" ? "Xem mẫu ngay" : "Xem nhanh";

  const { cardRef, handlePointerMove, handlePointerLeave } = useMicroInteraction(allowsTilt);

  useEffect(() => {
    if (!previewOpen || !previewModalRef.current) return;
    const focusables = previewModalRef.current.querySelectorAll<HTMLElement>("button, [href], [tabindex]:not([tabindex=\"-1\"])");
    (focusables[0] as HTMLElement | undefined)?.focus();
  }, [previewOpen]);

  useEffect(() => {
    if (!allowsQuickPreview || !doc.id) return;
    trackExperimentEvent("quick_preview_impression", {
      variant: quickPreviewVariant,
      doc_id: doc.id,
      surface: "document_card",
    });
  }, [allowsQuickPreview, quickPreviewVariant, doc.id]);

  const getFocusables = (root: HTMLElement) => {
    const sel = "button, [href], input, select, textarea, [tabindex]:not([tabindex=\"-1\"])";
    return Array.from(root.querySelectorAll<HTMLElement>(sel)).filter((el) => !el.hasAttribute("disabled"));
  };

  const handlePreviewKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      closePreview();
      return;
    }
    if (e.key !== "Tab" || !previewModalRef.current) return;
    const focusables = getFocusables(previewModalRef.current);
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  const closePreview = () => {
    setPreviewOpen(false);
    requestAnimationFrame(() => previewOpenButtonRef.current?.focus());
  };

  const resolvedTopBadgeDefault =
    topBadge === false
      ? undefined
      : topBadge === "free"
        ? "Miễn phí"
        : topBadge === "premium"
          ? "Nổi bật"
          : (topBadge as ReactNode);

  /** Đã mua: ưu tiên tag góc trên ảnh (thay Nổi bật) để dễ nhìn */
  const topBadgeForImage = isPurchased ? "Đã mua" : resolvedTopBadgeDefault;

  const bottomBadgeNode = (
    <>
      <Eye className="h-3.5 w-3.5" />
      {viewCount != null && viewCount > 0
        ? viewCount.toLocaleString("vi-VN")
        : soldCount > 0
          ? soldCount.toLocaleString("vi-VN")
          : "Mới"}
    </>
  );

  const cardContent = (
    <>
      <ImageCard
        imageUrl={doc.thumbnail_url ?? null}
        alt={doc.title}
        topBadge={topBadgeForImage}
        topBadgeTone={isPurchased ? "purchased" : "default"}
        bottomBadge={bottomBadgeNode}
        aspectClass={isCompact ? "aspect-[3/2]" : "aspect-[4/3]"}
        shimmer
      />
      <div className={`flex min-w-0 flex-1 flex-col ${isCompact ? "p-3" : "p-4 sm:p-5"}`}>
        <h3 className={`font-display font-bold leading-snug text-fg ${isCompact ? "line-clamp-1 text-base" : "line-clamp-2 text-lg"}`}>
          {doc.title}
        </h3>
        <div className={`flex flex-wrap gap-1.5 ${isCompact ? "mt-1.5" : "mt-2"}`}>
          {grade && <span className="rounded-md border border-primary-100 bg-primary-50 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-primary-600 dark:border-primary-800 dark:bg-primary-900/30 dark:text-primary-400">{grade.name}</span>}
          {subject && <span className="rounded-md border border-line bg-surface-muted px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-muted">{subject.name}</span>}
          {exam && <span className="rounded-md border border-emerald-100 bg-emerald-50 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">{exam.name}</span>}
        </div>
        {!isCompact && doc.description && (
          <div className="mt-2.5 line-clamp-2 text-sm leading-relaxed text-muted">
            {doc.description}
          </div>
        )}
        {!isCompact && (
          <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs font-medium text-muted">
            {ratingCount > 0 && avgRating != null ? (
              <span className="inline-flex items-center gap-1 font-bold text-amber-500">
                <Star className="h-3.5 w-3.5 fill-current" />
                {avgRating.toFixed(1)} ({ratingCount})
              </span>
            ) : (
              <span>Mới cập nhật</span>
            )}
            <span aria-hidden className="select-none text-border-strong">·</span>
            <span>{soldCount > 0 ? `${soldCount} lượt mua` : "Đang có người xem"}</span>
            <span aria-hidden className="select-none text-border-strong">·</span>
            <span>{doc.is_downloadable ? "Tải được" : "Chỉ xem online"}</span>
          </div>
        )}
      </div>
    </>
  );

  const surfaceClasses = [
    "relative",
    "premium-card",
    "group",
    "overflow-hidden",
    "rounded-2xl",
    allowsTilt ? "premium-card-hover micro-card" : "",
    "flex flex-col",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <article
      ref={cardRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className={surfaceClasses}
    >
      {allowsQuickPreview ? (
        <button
          ref={previewOpenButtonRef}
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            trackExperimentEvent("quick_preview_click", {
              variant: quickPreviewVariant,
              doc_id: doc.id,
              surface: "document_card",
            });
            trackExperimentEvent("quick_preview_open", {
              variant: quickPreviewVariant,
              doc_id: doc.id,
              surface: "document_card",
            });
            setPreviewOpen(true);
          }}
          className={`z-20 rounded-full border border-white/70 bg-surface px-2.5 py-1 text-xs font-medium text-muted shadow-sm backdrop-blur transition hover:bg-surface-muted hover:text-fg ${quickPreviewVariant === "B" ? "absolute bottom-20 right-3" : "absolute right-3 top-3"
            }`}
          aria-label="Xem nhanh bản xem trước"
        >
          {quickPreviewLabel}
        </button>
      ) : null}
      <Link href={href} className="flex flex-1 flex-col">
        {cardContent}
      </Link>
      <div className={isCompact ? "mt-3 px-4 pb-4 sm:px-5 sm:pb-5" : "mt-4 px-4 pb-4 sm:px-5 sm:pb-5"}>
        <PriceCtaBlock price={doc.price} variant={variant} href={href} />
      </div>
      {previewOpen && allowsQuickPreview && previewUrl ? (
        <div
          ref={previewModalRef}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-surface-overlay p-4 backdrop-blur-sm"
          onClick={() => closePreview()}
          onKeyDown={handlePreviewKeyDown}
          role="dialog"
          aria-modal="true"
          aria-labelledby="preview-title"
        >
          <div
            className="w-full max-w-4xl overflow-hidden rounded-2xl border border-line bg-surface shadow-premium"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <div id="preview-title" className="truncate pr-4 text-sm font-semibold text-fg">{doc.title}</div>
              <button
                type="button"
                onClick={() => closePreview()}
                className="rounded-lg p-2 text-muted hover:bg-surface-muted hover:text-fg"
                aria-label="Đóng xem nhanh"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="h-[70vh] min-h-[420px] bg-surface-muted">
              {previewUrl.toLowerCase().includes(".pdf") ? (
                <iframe
                  src={previewUrl}
                  title={`Xem nhanh ${doc.title}`}
                  loading="lazy"
                  className="h-full w-full border-0"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element -- preview URL; modal layout
                <img src={previewUrl} alt={doc.title} loading="lazy" decoding="async" className="h-full w-full object-contain" />
              )}
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-line bg-surface-muted px-4 py-3">
              <button type="button" onClick={() => closePreview()} className="btn-secondary">
                Đóng
              </button>
              <Link
                href={href}
                className="btn-primary"
                onClick={() => {
                  trackExperimentEvent("quick_preview_to_detail_click", {
                    variant: quickPreviewVariant,
                    doc_id: doc.id,
                    surface: "document_card",
                  });
                  closePreview();
                }}
              >
                Xem chi tiết
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </article>
  );
}
