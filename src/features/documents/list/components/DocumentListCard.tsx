"use client";

import type { ReactNode } from "react";
import { Eye, Star } from "lucide-react";
import Link from "next/link";
import ImageCard from "@/features/documents/shared/components/ImageCard";
import PriceCtaBlock from "@/features/documents/shared/components/PriceCtaBlock";
import { slugify } from "@/lib/seo";
import type { DocumentListCardProps } from "./document-card-types";

/**
 * Hàng danh sách tài liệu (Kho): không tilt / modal xem nhanh — bundle nhẹ hơn DocumentCard.
 */
export default function DocumentListCard({
  doc,
  categories,
  viewCount,
  soldCount = 0,
  ratingCount = 0,
  avgRating = null,
  topBadge = "premium",
  isPurchased = false,
}: DocumentListCardProps) {
  const subject = categories.find((c) => c.id === doc.subject_id);
  const grade = categories.find((c) => c.id === doc.grade_id);
  const exam = categories.find((c) => c.id === doc.exam_id);
  const slug = slugify(doc.title);
  const href = `/cua-hang/${doc.id}/${slug}`;

  const resolvedTopBadgeDefault =
    topBadge === false
      ? undefined
      : topBadge === "free"
        ? "Miễn phí"
        : topBadge === "premium"
          ? "Nổi bật"
          : (topBadge as ReactNode);

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

  return (
    <article className="premium-card group relative flex flex-col overflow-hidden rounded-2xl transition duration-200 hover:bg-surface-muted/30 focus-within:bg-surface-muted/30 active:scale-[0.995] active:bg-surface-muted/50 xl:flex-row">
      <Link href={href} className="flex min-w-0 flex-1 flex-row sm:flex-row">
        <ImageCard
          imageUrl={doc.thumbnail_url ?? null}
          alt={doc.title}
          topBadge={topBadgeForImage}
          topBadgeTone={isPurchased ? "purchased" : "default"}
          bottomBadge={bottomBadgeNode}
          aspectClass="aspect-[4/3] w-36 shrink-0 sm:w-44"
          shimmer={false}
        />
        <div className="flex min-w-0 flex-1 flex-col justify-center py-3 pl-4 sm:py-4 sm:pl-5">
          <h3 className="line-clamp-1 font-display text-base font-bold leading-snug text-fg sm:text-lg">
            {doc.title}
          </h3>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {grade && (
              <span className="rounded-md border border-primary-100 bg-primary-50 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-primary-600 dark:border-primary-800 dark:bg-primary-900/30 dark:text-primary-400">
                {grade.name}
              </span>
            )}
            {subject && (
              <span className="rounded-md border border-line bg-surface-muted px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-muted">
                {subject.name}
              </span>
            )}
            {exam && (
              <span className="rounded-md border border-emerald-100 bg-emerald-50 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                {exam.name}
              </span>
            )}
          </div>
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
            <span>{soldCount > 0 ? `${soldCount} lượt mua` : "Mới"}</span>
            <span aria-hidden className="select-none text-border-strong">·</span>
            <span>{doc.is_downloadable ? "Tải được" : "Chỉ xem online"}</span>
          </div>
        </div>
      </Link>
      <div className="flex shrink-0 flex-col items-start justify-center gap-2.5 border-t border-line px-4 py-3 sm:px-5 xl:border-l xl:border-t-0 xl:p-4">
        <PriceCtaBlock price={doc.price} variant="compact" href={href} ctaAriaLabel={`Xem chi tiết: ${doc.title}`} />
        <div className="hidden max-w-44 text-xs leading-relaxed text-muted xl:block">
          Thanh toán bảo mật • Truy cập ngay sau mua • Hỗ trợ khi gặp lỗi
        </div>
      </div>
    </article>
  );
}
