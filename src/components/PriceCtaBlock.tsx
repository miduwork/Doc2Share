"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

export interface PriceCtaBlockProps {
  /** Giá (VNĐ) */
  price: number;
  /** Nhãn trên giá, mặc định "Giá bán" */
  priceLabel?: string;
  /** Text CTA, mặc định "Xem chi tiết" */
  ctaText?: string;
  /** default: khối lớn; compact: padding và chữ nhỏ hơn */
  variant?: "default" | "compact";
  /** Class thêm cho wrapper */
  className?: string;
  /**
   * Khi có href: CTA render là Link (dùng cho sticky bar, trang chi tiết…).
   * Khi không có: CTA render là span (dùng bên trong parent Link, ví dụ DocumentCard).
   */
  href?: string;
  /** Cho CTA Link: aria-label (vd. "Xem chi tiết: Tên tài liệu") — hữu ích khi title bị truncate (variant list). */
  ctaAriaLabel?: string;
}

/**
 * Khối giá + CTA dùng chung (card, sticky bar…).
 * Dùng semantic token --color-action qua class .doc-card-cta hoặc bg-action.
 * Tránh nested link: chỉ truyền href khi block này không nằm trong một Link khác.
 */
export default function PriceCtaBlock({
  price,
  priceLabel = "Giá bán",
  ctaText = "Xem chi tiết",
  variant = "default",
  className = "",
  href,
  ctaAriaLabel,
}: PriceCtaBlockProps) {
  const isCompact = variant === "compact";
  const wrapperClass = isCompact
    ? "rounded-lg bg-surface-muted p-2.5"
    : "rounded-xl bg-surface-muted p-3";
  const labelClass = isCompact ? "text-[9px] font-semibold uppercase tracking-wider text-muted" : "text-[10px] font-semibold uppercase tracking-wider text-muted";
  const priceClass = isCompact ? "text-lg font-bold tracking-tight text-primary dark:text-primary-400" : "text-xl font-bold tracking-tight text-primary dark:text-primary-400";
  const ctaClass = isCompact ? "doc-card-cta inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-lg px-3.5 py-2.5 text-sm font-semibold" : "doc-card-cta shrink-0";

  const ctaContent = (
    <>
      {ctaText}
      <ArrowUpRight className={isCompact ? "h-4 w-4" : "h-5 w-5"} />
    </>
  );

  return (
    <div className={`${wrapperClass} ${className}`.trim()}>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className={labelClass}>{priceLabel}</p>
          <p className={priceClass}>{Number(price).toLocaleString("vi-VN")} ₫</p>
        </div>
        {href ? (
          <Link href={href} className={ctaClass} aria-label={ctaAriaLabel}>
            {ctaContent}
          </Link>
        ) : (
          <span className={ctaClass}>{ctaContent}</span>
        )}
      </div>
    </div>
  );
}
