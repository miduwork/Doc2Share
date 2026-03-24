type Variant = "grid" | "list";

const pulse = "animate-pulse bg-surface-muted";

export default function DocumentCardSkeleton({ variant = "grid" }: { variant?: Variant }) {
  if (variant === "list") {
    return (
      <article className="premium-card flex flex-row overflow-hidden rounded-2xl">
        <div className={`doc-card-cover aspect-[4/3] w-36 shrink-0 rounded-none rounded-l-2xl sm:w-44 ${pulse}`} />
        <div className="flex min-w-0 flex-1 flex-col justify-center py-3 pl-4 sm:py-4 sm:pl-5">
          <div className={`h-5 w-4/5 max-w-sm rounded ${pulse}`} />
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className={`h-5 w-14 rounded-md ${pulse}`} />
            <span className={`h-5 w-20 rounded-md ${pulse}`} />
          </div>
          <div className={`mt-2 h-3 w-40 rounded ${pulse}`} />
        </div>
        <div className="flex shrink-0 items-center border-l border-line p-4">
          <div className={`h-10 w-24 rounded-xl ${pulse}`} />
        </div>
      </article>
    );
  }

  return (
    <article className="premium-card flex flex-col overflow-hidden">
      <div className={`doc-card-cover aspect-[4/3] rounded-t-3xl ${pulse}`} />
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <div className={`h-5 w-2/3 rounded ${pulse}`} />
        <div className={`mt-2 h-4 w-1/2 rounded ${pulse}`} />
        <div className="mt-3 flex gap-2">
          <span className={`h-6 w-16 rounded-full ${pulse}`} />
          <span className={`h-6 w-20 rounded-full ${pulse}`} />
        </div>
        <div className="mt-5 flex items-end justify-between gap-3">
          <div className={`h-4 w-16 rounded ${pulse}`} />
          <span className={`h-9 w-24 rounded-xl ${pulse}`} />
        </div>
      </div>
    </article>
  );
}
