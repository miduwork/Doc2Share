export default function DocumentCardSkeleton() {
  return (
    <article className="premium-card flex flex-col overflow-hidden">
      <div className="doc-card-cover aspect-[4/3] animate-pulse rounded-t-3xl bg-slate-200 dark:bg-slate-700" />
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <div className="h-5 w-2/3 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
        <div className="mt-2 h-4 w-1/2 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
        <div className="mt-3 flex gap-2">
          <span className="h-6 w-16 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
          <span className="h-6 w-20 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
        </div>
        <div className="mt-5 flex items-end justify-between gap-3">
          <div className="h-4 w-16 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
          <span className="h-9 w-24 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-700" />
        </div>
      </div>
    </article>
  );
}
