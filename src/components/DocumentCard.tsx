"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { ReactNode } from "react";
import type { Category } from "@/lib/types";
import { slugify } from "@/lib/seo";
import { Eye, Star, X } from "lucide-react";
import ImageCard from "@/components/ImageCard";
import PriceCtaBlock from "@/components/PriceCtaBlock";

interface Doc {
  id: string;
  title: string;
  description?: string | null;
  price: number;
  preview_url: string | null;
  thumbnail_url?: string | null;
  is_downloadable?: boolean;
  subject_id: number | null;
  grade_id: number | null;
  exam_id: number | null;
}

interface Props {
  doc: Doc;
  categories: Category[];
  viewCount?: number | null;
  ratingCount?: number;
  avgRating?: number | null;
  soldCount?: number;
  /** default: đầy đủ; compact: ảnh nhỏ, bỏ mô tả, CTA gọn; list: một dòng (thumb trái, nội dung + CTA phải) cho trang Kho */
  variant?: "default" | "compact" | "list";
  /** Badge góc trên ảnh: 'premium' | 'free' | false (ẩn) | ReactNode (tùy chỉnh). Mặc định 'premium'. */
  topBadge?: "premium" | "free" | false | ReactNode;
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
}: Props) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const cardRef = useRef<HTMLElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const pending = useRef<{ rx: number; ry: number } | null>(null);
  const previewOpenButtonRef = useRef<HTMLButtonElement | null>(null);
  const previewModalRef = useRef<HTMLDivElement | null>(null);

  const subject = categories.find((c) => c.id === doc.subject_id);
  const grade = categories.find((c) => c.id === doc.grade_id);
  const exam = categories.find((c) => c.id === doc.exam_id);
  const slug = slugify(doc.title);
  const href = `/tai-lieu/${doc.id}/${slug}`;

  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  useEffect(() => {
    if (!previewOpen || !previewModalRef.current) return;
    const focusables = previewModalRef.current.querySelectorAll<HTMLElement>("button, [href], [tabindex]:not([tabindex=\"-1\"])");
    (focusables[0] as HTMLElement | undefined)?.focus();
  }, [previewOpen]);

  const flushTransform = () => {
    const el = cardRef.current;
    const value = pending.current;
    if (!el || !value) return;
    el.style.setProperty("--card-rx", `${value.rx}deg`);
    el.style.setProperty("--card-ry", `${value.ry}deg`);
    pending.current = null;
    rafRef.current = null;
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    if (e.pointerType !== "mouse") return;
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const rx = (0.5 - y) * 4;
    const ry = (x - 0.5) * 4;
    pending.current = { rx, ry };
    if (rafRef.current == null) {
      rafRef.current = requestAnimationFrame(flushTransform);
    }
  };

  const handlePointerLeave = () => {
    const el = cardRef.current;
    if (!el) return;
    el.style.setProperty("--card-rx", "0deg");
    el.style.setProperty("--card-ry", "0deg");
  };

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

  const isCompact = variant === "compact";
  const isList = variant === "list";
  const topBadgeNode =
    topBadge === false
      ? undefined
      : topBadge === "free"
        ? "Free"
        : topBadge === "premium"
          ? "Premium"
          : (topBadge as ReactNode);
  const bottomBadgeNode = (
    <>
      <Eye className="h-3.5 w-3.5" />
      {viewCount != null ? viewCount.toLocaleString("vi-VN") : soldCount > 0 ? soldCount.toLocaleString("vi-VN") : "Mới"}
    </>
  );

  const cardContent = (
    <>
      <ImageCard
        imageUrl={doc.thumbnail_url ?? null}
        alt={doc.title}
        topBadge={topBadgeNode}
        bottomBadge={bottomBadgeNode}
        aspectClass={isList ? "aspect-[4/3] w-36 shrink-0 sm:w-44" : isCompact ? "aspect-[3/2]" : "aspect-[4/3]"}
        shimmer
      />
      <div className={`flex min-w-0 flex-1 flex-col ${isList ? "justify-center py-3 pl-4 sm:py-4 sm:pl-5" : isCompact ? "p-3" : "p-4 sm:p-5"}`}>
        <h3 className={`font-display font-bold leading-snug text-semantic-heading ${isList ? "line-clamp-1 text-base sm:text-lg" : isCompact ? "line-clamp-1 text-base" : "line-clamp-2 text-lg"}`}>
          {doc.title}
        </h3>
        <div className={`flex flex-wrap gap-1.5 ${isList ? "mt-1.5" : isCompact ? "mt-1.5" : "mt-2.5"}`}>
          {grade && <span className="rounded-md border border-primary-200 bg-primary-50/80 px-2 py-0.5 text-[11px] font-medium text-primary-700 dark:border-primary-700 dark:bg-primary-900/40 dark:text-primary-300">{grade.name}</span>}
          {subject && <span className="rounded-md border border-line bg-surface-muted px-2 py-0.5 text-[11px] font-medium text-fg">{subject.name}</span>}
          {exam && <span className="rounded-md border border-emerald-200 bg-emerald-50/80 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">{exam.name}</span>}
        </div>
        {!isCompact && !isList && doc.description && (
          <p className="mt-2.5 line-clamp-2 text-sm leading-relaxed text-muted">
            {doc.description}
          </p>
        )}
        {!isCompact && !isList && (
          <p className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
            {ratingCount > 0 && avgRating != null ? (
              <span className="inline-flex items-center gap-1 font-medium text-amber-600 dark:text-amber-400">
                <Star className="h-3.5 w-3.5 fill-current" />
                {avgRating.toFixed(1)} ({ratingCount})
              </span>
            ) : (
              <span>Mới cập nhật</span>
            )}
            <span aria-hidden className="select-none text-border-subtle">·</span>
            <span>{soldCount > 0 ? `${soldCount} lượt mua` : "Đang có người xem"}</span>
            <span aria-hidden className="select-none text-border-subtle">·</span>
            <span>{doc.is_downloadable ? "Tải được" : "Chỉ xem online"}</span>
          </p>
        )}
        {isList && (
          <p className="mt-1.5 text-xs text-muted">
            {soldCount > 0 ? `${soldCount} lượt mua` : "Mới"} · {doc.is_downloadable ? "Tải được" : "Chỉ xem online"}
          </p>
        )}
      </div>
    </>
  );

  return (
    <article
      ref={cardRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className={`premium-card premium-card-hover micro-card group overflow-hidden rounded-2xl ${isList ? "flex flex-row hover:bg-surface-muted/30 focus-within:bg-surface-muted/30 active:bg-surface-muted/50 active:scale-[0.995] transition duration-200" : "flex flex-col"}`}
    >
      {doc.preview_url ? (
        <button
          ref={previewOpenButtonRef}
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setPreviewOpen(true);
          }}
          className="absolute right-3 top-3 z-20 rounded-full border border-white/70 bg-surface px-2.5 py-1 text-[11px] font-semibold text-fg shadow-sm backdrop-blur transition hover:opacity-90"
          aria-label="Xem nhanh bản xem trước"
        >
          Xem nhanh
        </button>
      ) : null}
      <Link href={href} className={`flex flex-1 flex-col ${isList ? "min-w-0 flex-row sm:flex-row" : ""}`}>
        {cardContent}
      </Link>
      {isList ? (
        <div className="flex shrink-0 items-center border-l border-line p-4">
          <PriceCtaBlock
            price={doc.price}
            variant="compact"
            href={href}
            ctaAriaLabel={`Xem chi tiết: ${doc.title}`}
          />
        </div>
      ) : (
        <div className={isCompact ? "mt-3 px-4 pb-4 sm:px-5 sm:pb-5" : "mt-4 px-4 pb-4 sm:px-5 sm:pb-5"}>
          <PriceCtaBlock price={doc.price} variant={variant} href={href} />
        </div>
      )}
      {previewOpen && doc.preview_url ? (
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
              <p id="preview-title" className="truncate pr-4 text-sm font-semibold text-fg">{doc.title}</p>
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
              {doc.preview_url.toLowerCase().includes(".pdf") ? (
                <iframe
                  src={doc.preview_url}
                  title={`Xem nhanh ${doc.title}`}
                  loading="lazy"
                  className="h-full w-full border-0"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element -- preview URL; modal layout
                <img src={doc.preview_url} alt={doc.title} loading="lazy" decoding="async" className="h-full w-full object-contain" />
              )}
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-line bg-surface-muted px-4 py-3">
              <button type="button" onClick={() => closePreview()} className="btn-secondary">
                Đóng
              </button>
              <Link href={href} className="btn-primary" onClick={() => closePreview()}>
                Xem chi tiết
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </article>
  );
}
