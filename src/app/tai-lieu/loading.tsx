import Header from "@/components/Header";
import DocumentCardSkeleton from "@/components/DocumentCardSkeleton";

export default function TaiLieuLoading() {
  return (
    <div className="app-shell flex flex-col">
      <Header />
      <main id="main-content" className="flex-1" tabIndex={-1}>
        <section className="reveal-section border-b border-line bg-gradient-to-b from-white to-slate-50/70 py-8 dark:from-slate-950 dark:to-slate-900/30">
          <div className="section-container">
            <div className="h-9 w-48 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
            <div className="mt-2 h-4 w-72 animate-pulse rounded bg-slate-100 dark:bg-slate-700/80" />
          </div>
        </section>
        <div className="section-container flex gap-8 py-8">
          <aside className="hidden w-64 shrink-0 md:block">
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-10 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
              ))}
            </div>
          </aside>
          <section className="min-w-0 flex-1">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="h-4 w-24 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
              <div className="h-10 w-48 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
            </div>
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <DocumentCardSkeleton key={i} />
              ))}
            </div>
          </section>
        </div>
      </main>
      <footer className="border-t border-line py-6 text-center text-sm text-slate-500">
        © Doc2Share
      </footer>
    </div>
  );
}
