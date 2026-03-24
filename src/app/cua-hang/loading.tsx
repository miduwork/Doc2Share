import PublicLayout from "@/features/layout/components/PublicLayout";
import DocumentCardSkeleton from "@/features/documents/list/components/DocumentCardSkeleton";

const pulseBar = "animate-pulse bg-surface-muted";

export default function TaiLieuLoading() {
  return (
    <PublicLayout>
      <section className="reveal-section section-spacing border-b border-line bg-gradient-to-b from-surface to-surface-muted/50">
        <div className="section-container">
          <div className={`h-9 w-48 rounded ${pulseBar}`} />
          <div className={`mt-2 h-4 w-72 rounded ${pulseBar}`} />
          <div className="mt-4 lg:hidden">
            <div className={`h-12 w-full rounded-xl ${pulseBar}`} />
          </div>
        </div>
      </section>
      <div className="reveal-section reveal-delay-1 section-container section-spacing flex gap-6 lg:gap-8">
        <aside className="hidden w-64 shrink-0 lg:block">
          <div className="premium-panel space-y-6 p-4">
            <div className="flex items-center justify-between">
              <div className={`h-4 w-24 rounded ${pulseBar}`} />
              <div className={`h-4 w-14 rounded-md ${pulseBar}`} />
            </div>
            {[1, 2, 3].map((section) => (
              <div key={section}>
                <div className={`mb-2 h-3 w-20 rounded ${pulseBar}`} />
                <div className="flex flex-wrap gap-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className={`h-8 w-20 rounded-full ${pulseBar}`} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </aside>
        <section className="min-w-0 flex-1">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className={`h-4 w-16 rounded ${pulseBar}`} />
            <div className="premium-panel flex items-center gap-2 px-3 py-2">
              <div className={`h-4 w-14 rounded ${pulseBar}`} />
              <div className={`h-8 w-16 rounded-lg ${pulseBar}`} />
              <div className={`h-8 w-16 rounded-lg ${pulseBar}`} />
              <div className={`h-8 w-16 rounded-lg ${pulseBar}`} />
            </div>
          </div>
          <div className="mb-8">
            <div className={`mb-4 h-3 w-56 rounded ${pulseBar}`} />
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <DocumentCardSkeleton key={i} />
              ))}
            </div>
          </div>
          <div>
            <div className={`mb-4 h-3 w-56 rounded ${pulseBar}`} />
            <div className="flex flex-col gap-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <DocumentCardSkeleton key={i} variant="list" />
              ))}
            </div>
          </div>
        </section>
      </div>
    </PublicLayout>
  );
}
