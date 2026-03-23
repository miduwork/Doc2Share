import Header from "@/components/Header";

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

export default function DashboardLoading() {
  return (
    <div className="app-shell flex flex-col">
      <Header />
      <main id="main-content" className="flex-1" tabIndex={-1}>
        <div className="section-container py-8">
          <div className="h-9 w-56 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
          <div className="mt-2 h-4 max-w-md animate-pulse rounded bg-slate-100 dark:bg-slate-700/80" />
          <section className="mt-10">
            <div className="mb-4 h-6 w-40 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
            <div className="grid gap-4 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <LibraryItemSkeleton key={i} />
              ))}
            </div>
          </section>
          <section className="mt-12">
            <div className="mb-4 h-6 w-44 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="premium-panel flex justify-between gap-4 rounded-2xl px-5 py-4"
                >
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
      </main>
      <footer className="border-t border-line py-4 text-center text-sm text-slate-500">
        © Doc2Share
      </footer>
    </div>
  );
}
