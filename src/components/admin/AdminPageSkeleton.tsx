"use client";

/**
 * Skeleton placeholder for admin pages while loading.
 * Used by loading.tsx in admin route segments.
 */
export default function AdminPageSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="h-6 w-48 rounded bg-slate-200 dark:bg-slate-700" />
        <div className="h-4 w-64 rounded bg-slate-100 dark:bg-slate-800" />
      </div>
      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        <div className="border-b border-line bg-muted/50 px-3 py-2">
          <div className="flex gap-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-4 w-20 rounded bg-slate-200 dark:bg-slate-700" />
            ))}
          </div>
        </div>
        <div className="divide-y divide-line">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="flex gap-4 px-3 py-2">
              <div className="h-4 flex-1 max-w-[120px] rounded bg-slate-100 dark:bg-slate-800" />
              <div className="h-4 w-16 rounded bg-slate-100 dark:bg-slate-800" />
              <div className="h-4 w-24 rounded bg-slate-100 dark:bg-slate-800" />
              <div className="h-4 w-20 rounded bg-slate-100 dark:bg-slate-800" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
