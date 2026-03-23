import Header from "@/components/Header";
import Footer from "@/components/Footer";
import DocumentCardSkeleton from "@/components/DocumentCardSkeleton";

/**
 * Skeleton khi loading route gốc (trang chủ /).
 * Cấu trúc gần với page: hero + section gợi ý tài liệu.
 */
export default function RootLoading() {
  return (
    <div className="app-shell flex min-h-screen flex-col">
      <Header />
      <main id="main-content" className="flex-1" tabIndex={-1}>
        {/* Hero skeleton */}
        <section className="reveal-section relative overflow-hidden border-b border-line py-16 sm:py-20">
          <div className="section-container relative z-10 text-center">
            <div className="mx-auto h-6 w-32 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
            <div className="mx-auto mt-4 h-10 w-3/4 max-w-2xl animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700" />
            <div className="mx-auto mt-2 h-6 max-w-xl animate-pulse rounded bg-slate-100 dark:bg-slate-700/80" />
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <div className="h-12 w-48 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-700" />
            </div>
            <div className="mx-auto mt-8 flex flex-wrap justify-center gap-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-10 w-24 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
              ))}
            </div>
          </div>
        </section>

        {/* Gợi ý tài liệu skeleton */}
        <section className="reveal-section section-container section-spacing-lg">
          <div className="flex items-center justify-between gap-4">
            <div className="h-7 w-40 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
            <div className="h-10 w-28 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
          </div>
          <div className="mt-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <DocumentCardSkeleton key={i} />
            ))}
          </div>
        </section>

        {/* Trust strip skeleton */}
        <section className="reveal-section border-t border-line bg-slate-50/70 py-8 dark:bg-slate-900/40">
          <div className="section-container">
            <div className="flex flex-wrap items-center justify-center gap-6 gap-y-4 p-5 sm:gap-8">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-5 w-32 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
