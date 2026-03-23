"use client";

import Link from "next/link";

const OPTIONS = [
  { value: 7, label: "7 ngày" },
  { value: 30, label: "30 ngày" },
  { value: 90, label: "90 ngày" },
] as const;

export type OverviewRange = 7 | 30 | 90;

export default function OverviewRangeSelect({ currentRange }: { currentRange: OverviewRange }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Khoảng thời gian tổng quan">
      <span className="text-xs text-muted">Khoảng:</span>
      {OPTIONS.map(({ value, label }) => {
        const href = value === 30 ? "/admin" : `/admin?range=${value}`;
        const isActive = currentRange === value;
        return (
          <Link
            key={value}
            href={href}
            className={`inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              isActive
                ? "border border-primary-200 bg-primary-50 text-primary-700 shadow-sm dark:border-primary-700 dark:bg-primary-900/30 dark:text-primary-300"
                : "border border-line bg-surface text-muted hover:bg-muted/50 hover:text-semantic-heading"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}
