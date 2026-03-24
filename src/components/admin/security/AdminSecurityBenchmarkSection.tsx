import type { RiskBenchmarkStats } from "@/lib/admin/security-dashboard.types";

export default function AdminSecurityBenchmarkSection({
  benchmark,
}: {
  benchmark:
    | {
        stats: RiskBenchmarkStats;
        interpretation: { proxyPrecisionDelta: number; manualPrecisionDelta: number; candidateDelta: number };
      }
    | null;
}) {
  if (!benchmark) {
    return (
      <section className="rounded-xl border border-line bg-white p-4 dark:bg-slate-900">
        <h2 className="text-sm font-semibold text-semantic-heading">Benchmark rủi ro</h2>
        <p className="mt-2 text-xs text-slate-500">Chưa có dữ liệu benchmark.</p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-line bg-white p-4 dark:bg-slate-900">
      <h2 className="text-sm font-semibold text-semantic-heading">Benchmark rủi ro</h2>
      <div className="mt-3 grid grid-cols-1 gap-2 text-xs md:grid-cols-3">
        <div className="rounded border border-line p-2">
          <div className="text-slate-500">Proxy precision delta</div>
          <div>{benchmark.interpretation.proxyPrecisionDelta}</div>
        </div>
        <div className="rounded border border-line p-2">
          <div className="text-slate-500">Manual precision delta</div>
          <div>{benchmark.interpretation.manualPrecisionDelta}</div>
        </div>
        <div className="rounded border border-line p-2">
          <div className="text-slate-500">Candidate delta</div>
          <div>{benchmark.interpretation.candidateDelta}</div>
        </div>
      </div>
    </section>
  );
}
