import { strict as assert } from "node:assert";
import { test } from "node:test";
import { fetchAlertsByCursor } from "@/app/admin/observability/utils";

type AlertRow = {
  id: string;
  created_at: string;
  severity: string;
  source: string;
  event_type: string;
  metadata: Record<string, unknown> | null;
};

function createCursorSupabaseMock(rows: AlertRow[]) {
  const calls = { orClauses: [] as string[], orderCalls: [] as Array<{ column: string; ascending: boolean }> };
  const query = {
    select() {
      return this;
    },
    order(column: string, options: { ascending: boolean }) {
      calls.orderCalls.push({ column, ascending: options.ascending });
      return this;
    },
    limit() {
      return this;
    },
    gte() {
      return this;
    },
    eq() {
      return this;
    },
    or(clause: string) {
      calls.orClauses.push(clause);
      return this;
    },
    then(resolve: (_value: unknown) => void) {
      return Promise.resolve(resolve({ data: rows, error: null }));
    },
  };
  const supabase = {
    from() {
      return query;
    },
  } as any;
  return { supabase, calls };
}

test("fetchAlertsByCursor next direction computes next cursor", async () => {
  const rows: AlertRow[] = [
    { id: "3", created_at: "2026-03-24T11:00:00.000Z", severity: "error", source: "db.alerts", event_type: "incident", metadata: null },
    { id: "2", created_at: "2026-03-24T10:00:00.000Z", severity: "warn", source: "db.alerts", event_type: "incident", metadata: null },
    { id: "1", created_at: "2026-03-24T09:00:00.000Z", severity: "info", source: "db.alerts", event_type: "incident", metadata: null },
  ];
  const { supabase } = createCursorSupabaseMock(rows);
  const result = await fetchAlertsByCursor({
    supabase,
    sinceIso: null,
    severity: "all",
    source: "all",
    eventType: "all",
    pageSize: 2,
    cursor: "",
    direction: "next",
  });

  assert.equal(result.items.length, 2);
  assert.equal(result.items[0].id, "3");
  assert.equal(result.nextCursor, "2026-03-24T10:00:00.000Z|2");
  assert.equal(result.prevCursor, null);
});

test("fetchAlertsByCursor prev direction reverses rows and sets prev cursor", async () => {
  const rows: AlertRow[] = [
    { id: "1", created_at: "2026-03-24T09:00:00.000Z", severity: "warn", source: "db.alerts", event_type: "incident", metadata: null },
    { id: "2", created_at: "2026-03-24T10:00:00.000Z", severity: "warn", source: "db.alerts", event_type: "incident", metadata: null },
    { id: "3", created_at: "2026-03-24T11:00:00.000Z", severity: "warn", source: "db.alerts", event_type: "incident", metadata: null },
  ];
  const { supabase } = createCursorSupabaseMock(rows);
  const result = await fetchAlertsByCursor({
    supabase,
    sinceIso: null,
    severity: "all",
    source: "all",
    eventType: "all",
    pageSize: 2,
    cursor: "2026-03-24T08:00:00.000Z|0",
    direction: "prev",
  });

  assert.equal(result.items[0].id, "2");
  assert.equal(result.items[1].id, "1");
  assert.equal(result.prevCursor, "2026-03-24T10:00:00.000Z|2");
});
