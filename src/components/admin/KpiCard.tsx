import type { ReactNode } from "react";
import { Info } from "lucide-react";

type Props = {
  icon: ReactNode;
  label: string;
  value: string;
  sub: string;
  tooltip?: string;
};

export default function KpiCard({ icon, label, value, sub, tooltip }: Props) {
  return (
    <article className="premium-card rounded-xl p-3">
      <div className="mb-1 flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
        {icon}
        <span className="text-[10px] uppercase tracking-wide">{label}</span>
        {tooltip ? (
          <span title={tooltip} aria-label={tooltip} className="inline-flex shrink-0 rounded-full p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
            <Info className="h-3 w-3" />
          </span>
        ) : null}
      </div>
      <p className="text-lg font-bold text-semantic-heading">{value}</p>
      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{sub}</p>
    </article>
  );
}
