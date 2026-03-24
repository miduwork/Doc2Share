import PublicLayout from "@/features/layout/components/PublicLayout";

function LibraryItemSkeleton() {
  return (
    <div className="premium-card flex flex-wrap items-center gap-4 p-4">
      <div className="h-16 w-16 shrink-0 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-700" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="h-4 w-3/4 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
        <div className="h-3 w-24 animate-pulse rounded bg-slate-100 dark:bg-slate-700/80" />
      </div>
      <div className="h-10 w-20 shrink-0 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-700" />
    </div>
  );
}

export default function TuSachLoading() {
  return (
    <PublicLayout>
      <div className="section-container py-8">
        <div className="h-9 w-56 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
        <div className="mt-2 h-4 max-w-md animate-pulse rounded bg-slate-100 dark:bg-slate-700/80" />
        <div className="mt-10 grid gap-8 lg:grid-cols-3">
          <section className="lg:col-span-2">
            <div className="mb-4 h-6 w-44 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
            <div className="premium-panel p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="h-5 w-5 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
                  <div className="h-10 flex-1 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
                </div>
                <div className="flex flex-wrap items-center justify-end gap-3">
                  <div className="h-4 w-28 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-16 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
                    <div className="h-10 w-44 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-3 md:hidden h-10 w-28 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
            <div className="mt-3 hidden md:block h-12 w-full animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <LibraryItemSkeleton key={i} />
              ))}
            </div>
          </section>
          <section className="lg:col-span-1">
            <div className="mb-2 h-6 w-44 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
            <div className="mb-4 h-4 w-full animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="premium-panel flex justify-between gap-4 rounded-2xl px-5 py-4">
                  <div className="space-y-2">
                    <div className="h-4 w-32 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                    <div className="h-3 w-24 animate-pulse rounded bg-slate-100 dark:bg-slate-700/80" />
                  </div>
                  <div className="h-10 w-10 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </PublicLayout>
  );
}

