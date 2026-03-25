import { strict as assert } from "node:assert";
import { test } from "node:test";
import { getObservabilityDashboardData } from "@/lib/admin/observability-dashboard.service";

function createSupabaseMock() {
  const now = Date.now();
  const isoFromHoursAgo = (hoursAgo: number) => new Date(now - hoursAgo * 60 * 60 * 1000).toISOString();
  const tableData = {
    observability_metrics_24h: [
      {
        events_24h: 100,
        errors_24h: 5,
        webhook_events_24h: 20,
        webhook_errors_24h: 2,
        secure_link_events_24h: 30,
        secure_link_blocked_24h: 1,
        webhook_avg_latency_ms_24h: 123,
        secure_link_avg_latency_ms_24h: 45,
        payment_webhook_access_logs_24h: 15,
      },
    ],
    backend_capacity_overview: [{ table_name: "observability_events", total_bytes: 1024, est_live_rows: 10, est_dead_rows: 0 }],
    backend_maintenance_runs: [
      {
        id: "run-1",
        started_at: "2026-03-24T10:00:00.000Z",
        finished_at: null,
        triggered_by: "manual",
        success: true,
        alerts_count: 1,
        access_deleted: 1,
        security_deleted: 2,
        observability_deleted: 3,
        webhook_deleted: 4,
        details: { alerts: [{ alert_key: "pipeline_backlog" }] },
      },
    ],
    observability_events: [
      {
        id: "e3",
        created_at: isoFromHoursAgo(2),
        severity: "warn",
        source: "next.reader",
        event_type: "watermark_degraded_fallback",
        metadata: null,
      },
      {
        id: "e2",
        created_at: isoFromHoursAgo(3),
        severity: "error",
        source: "edge.payment_webhook",
        event_type: "incident",
        metadata: null,
      },
      { id: "e1", created_at: isoFromHoursAgo(30), severity: "warn", source: "db.alerts", event_type: "threshold", metadata: null },
    ],
    document_processing_jobs: [],
  } as Record<string, any[]>;

  const statusCounts: Record<string, number> = { queued: 2, processing: 3, failed: 1 };

  function builder(table: string) {
    const state: any = { filters: [], orders: [], maybeSingle: false };
    return {
      select(_columns?: string, options?: { count?: "exact"; head?: boolean }) {
        state.count = options?.count;
        state.head = options?.head;
        return this;
      },
      order(column: string, opts: { ascending: boolean }) {
        state.orders.push({ column, ascending: opts.ascending });
        return this;
      },
      limit(value: number) {
        state.limit = value;
        return this;
      },
      range(from: number, to: number) {
        state.range = { from, to };
        return this;
      },
      eq(column: string, value: unknown) {
        state.filters.push({ type: "eq", column, value });
        return this;
      },
      gte(column: string, value: unknown) {
        state.filters.push({ type: "gte", column, value });
        return this;
      },
      or() {
        return this;
      },
      maybeSingle() {
        state.maybeSingle = true;
        return this;
      },
      then(resolve: (_value: unknown) => void) {
        let rows = [...(tableData[table] ?? [])];
        for (const f of state.filters) {
          if (f.type === "eq") rows = rows.filter((row) => row[f.column] === f.value);
          if (f.type === "gte") rows = rows.filter((row) => String(row[f.column]) >= String(f.value));
        }
        for (const order of [...state.orders].reverse()) {
          rows.sort((a, b) => {
            const av = a[order.column];
            const bv = b[order.column];
            if (av === bv) return 0;
            return order.ascending ? (av > bv ? 1 : -1) : av > bv ? -1 : 1;
          });
        }
        const count = rows.length;
        if (state.range) rows = rows.slice(state.range.from, state.range.to + 1);
        if (typeof state.limit === "number") rows = rows.slice(0, state.limit);

        if (table === "document_processing_jobs" && state.head && state.count === "exact") {
          const status = state.filters.find((x: any) => x.column === "status")?.value as string;
          return Promise.resolve(resolve({ data: null, error: null, count: statusCounts[status] ?? 0 }));
        }
        if (state.maybeSingle) return Promise.resolve(resolve({ data: rows[0] ?? null, error: null }));
        if (state.count === "exact") return Promise.resolve(resolve({ data: rows, error: null, count }));
        return Promise.resolve(resolve({ data: rows, error: null }));
      },
    };
  }

  return { from: (table: string) => builder(table) } as any;
}

test("getObservabilityDashboardData builds page blocks and section data", async () => {
  const data = await getObservabilityDashboardData({
    supabase: createSupabaseMock(),
    searchParams: {
      preset: "webhook-errors",
      window: "24h",
      severity: "error",
      source: "edge.payment_webhook",
      event_type: "all",
      runs_page: "1",
      alerts_page_size: "20",
      runs_page_size: "20",
      export_limit: "2000",
      alerts_cursor: "",
      alerts_dir: "next",
    },
  });

  assert.equal(data.header.selectedPreset, "webhook-errors");
  assert.equal(data.sections.kpi.pipeline.queued, 2);
  assert.equal(data.sections.kpi.watermarkDegraded24h, 1);
  assert.equal(data.sections.kpi.pipeline.processing, 3);
  assert.equal(data.sections.kpi.pipeline.failed, 1);
  assert.equal(data.sections.alerts.alertEvents.length > 0, true);
  assert.equal(data.sections.capacity.capacityRows.length, 1);
  assert.equal(data.sections.runs.runs.length, 1);
  assert.equal(data.sections.alerts.alertsExportHref.includes("/admin/observability/export/alerts"), true);
  assert.equal(data.sections.runs.runsExportHref.includes("/admin/observability/export/maintenance"), true);
});
