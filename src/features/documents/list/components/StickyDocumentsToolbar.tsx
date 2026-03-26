"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type SortOption = { id: string; label: string; href: string };

interface Props {
  activeFilterCount: number;
  sort: string;
  sortOptions: SortOption[];
  clearAllHref: string;
}

export default function StickyDocumentsToolbar({
  activeFilterCount,
  sort,
  sortOptions,
  clearAllHref,
}: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > 240);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <div className="sticky top-2 z-30 mb-4 rounded-2xl border border-line bg-surface/95 p-2 shadow-card backdrop-blur">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex min-h-10 items-center rounded-full bg-surface-muted px-3 text-xs font-semibold tracking-wide text-fg sm:text-sm sm:tracking-normal">
          Bộ lọc: {activeFilterCount}
        </span>
        <div className="flex flex-wrap items-center gap-1">
          {sortOptions.map((opt) => (
            <Link
              key={opt.id}
              href={opt.href}
              className={`inline-flex min-h-10 items-center rounded-full px-3 text-xs font-medium tracking-wide transition sm:text-sm sm:tracking-normal ${
                sort === opt.id
                  ? "bg-surface-muted font-semibold text-fg"
                  : "text-muted hover:bg-surface-muted hover:text-fg"
              }`}
            >
              {opt.label}
            </Link>
          ))}
        </div>
        {activeFilterCount > 0 ? (
          <Link
            href={clearAllHref}
            className="ml-auto inline-flex min-h-10 items-center rounded-lg border border-line px-3 text-sm font-semibold text-fg transition hover:bg-surface-muted"
          >
            Xóa lọc
          </Link>
        ) : null}
      </div>
    </div>
  );
}
