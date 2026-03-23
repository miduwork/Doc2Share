"use client";

import { useState, useEffect, useRef } from "react";
import { FileText } from "lucide-react";
import type { ReactNode } from "react";

export interface ImageCardProps {
  imageUrl: string | null;
  alt: string;
  topBadge?: ReactNode;
  bottomBadge?: ReactNode;
  aspectClass?: string;
  className?: string;
  shimmer?: boolean;
}

/**
 * Khối ảnh bìa dùng chung: thumbnail + overlay + badges.
 * Skeleton hiển thị khi ảnh đang load để tránh nháy.
 */
export default function ImageCard({
  imageUrl,
  alt,
  topBadge,
  bottomBadge,
  aspectClass = "aspect-[4/3]",
  className = "",
  shimmer = true,
}: ImageCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    setImageLoaded(false);
  }, [imageUrl]);

  useEffect(() => {
    if (!imageUrl) return;
    const img = imgRef.current;
    if (img?.complete) setImageLoaded(true);
  }, [imageUrl]);

  const baseCover = "doc-card-cover overflow-hidden rounded-t-2xl bg-gradient-to-br from-primary-50 via-white to-emerald-50/80 dark:from-slate-800 dark:to-slate-800/80";
  const shimmerClass = shimmer ? " card-shimmer" : "";
  const showSkeleton = imageUrl && !imageLoaded;

  return (
    <div className={`${baseCover} ${aspectClass} ${shimmerClass} relative ${className}`.trim()}>
      {imageUrl ? (
        <>
          {showSkeleton && (
            <div
              className="absolute inset-0 z-[1] rounded-t-2xl bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800"
              aria-hidden
            />
          )}
          {/* eslint-disable-next-line @next/next/no-img-element -- thumbnail URL; fixed layout */}
          <img
            ref={imgRef}
            src={imageUrl}
            alt={alt}
            loading="lazy"
            decoding="async"
            onLoad={() => setImageLoaded(true)}
            className={`h-full w-full object-cover transition duration-500 group-hover:scale-[1.05] ${showSkeleton ? "opacity-0" : "opacity-100"}`}
          />
        </>
      ) : (
        <div className="flex h-full items-center justify-center text-slate-400">
          <FileText className="h-16 w-16 opacity-50" />
        </div>
      )}
      <div className="doc-card-cover-inner" aria-hidden />
      <div className="doc-card-cover-hover-overlay" aria-hidden />
      <div className="absolute inset-0 rounded-t-2xl bg-gradient-to-t from-black/60 via-black/15 to-transparent" />
      {topBadge != null ? (
        <span className="absolute left-3 top-3 rounded-lg border border-white/40 bg-white/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary shadow-sm backdrop-blur dark:border-white/20 dark:bg-slate-900/90 dark:text-primary-300">
          {topBadge}
        </span>
      ) : null}
      {bottomBadge != null ? (
        <span className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-lg bg-black/50 px-2.5 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
          {bottomBadge}
        </span>
      ) : null}
    </div>
  );
}
