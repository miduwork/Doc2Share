import { test } from "node:test";
import { strict as assert } from "node:assert";
import { createRouteTestAdapter } from "./route-test-adapter.ts";

function createSupabaseMock(table: "observability_events" | "backend_maintenance_runs", rows: Array<Record<string, unknown>>) {
  return {
    from(name: string) {
      if (name !== table) throw new Error(`Unsupported table: ${name}`);
      return {
        select() {
          return this;
        },
        order() {
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
        then(resolve: (_value: unknown) => void) {
          return Promise.resolve(resolve({ data: rows, error: null }));
        },
      };
    },
  } as any;
}

test("test adapter alerts handler returns 401 from authorize", async () => {
  const adapter = createRouteTestAdapter({
    parseExportRequest: () => ({
      payload: { window: "24h", severity: "all", source: "all", event_type: "all" },
      shareSig: "bad",
      limit: 100,
      sinceIso: null,
    }),
    authorize: async () => new Response("Unauthorized", { status: 401 }),
  });
  const res = await adapter.alerts(new Request("https://example.test"), createSupabaseMock("observability_events", []));
  assert.equal(res.status, 401);
});

test("test adapter maintenance handler returns csv on success", async () => {
  const adapter = createRouteTestAdapter({
    parseExportRequest: () => ({
      payload: { window: "24h", severity: "all", source: "all", event_type: "all" },
      shareSig: "",
      limit: 100,
      sinceIso: null,
    }),
    authorize: async () => null,
  });
  const res = await adapter.maintenance(
    new Request("https://example.test"),
    createSupabaseMock("backend_maintenance_runs", [
      {
        id: "r1",
        started_at: "2026-01-01T00:00:00.000Z",
        finished_at: null,
        triggered_by: "manual",
        success: true,
        alerts_count: 0,
        access_deleted: 1,
        security_deleted: 2,
        observability_deleted: 3,
        webhook_deleted: 4,
      },
    ])
  );
  assert.equal(res.status, 200);
  const csv = await res.text();
  assert.equal(csv.includes("deleted_total"), true);
});

test("test adapter alerts handler returns 200 when signed share is authorized", async () => {
  const adapter = createRouteTestAdapter({
    parseExportRequest: () => ({
      payload: { window: "24h", severity: "error", source: "edge.payment_webhook", event_type: "all", share_exp: "9999999999" },
      shareSig: "signed-ok",
      limit: 50,
      sinceIso: "2026-01-01T00:00:00.000Z",
    }),
    authorize: async ({ shareSig }) => (shareSig === "signed-ok" ? null : new Response("Forbidden", { status: 403 })),
  });
  const res = await adapter.alerts(
    new Request("https://example.test"),
    createSupabaseMock("observability_events", [
      {
        created_at: "2026-01-01T00:00:00.000Z",
        source: "edge.payment_webhook",
        event_type: "failed",
        severity: "error",
        status_code: 500,
        request_id: "req-2",
        latency_ms: 42,
        metadata: {},
      },
    ])
  );
  assert.equal(res.status, 200);
});

test("test adapter alerts handler denies expired signed share", async () => {
  const adapter = createRouteTestAdapter({
    parseExportRequest: () => ({
      payload: { window: "24h", severity: "all", source: "all", event_type: "all", share_exp: "1" },
      shareSig: "expired",
      limit: 100,
      sinceIso: null,
    }),
    authorize: async () => new Response("Unauthorized", { status: 401 }),
  });
  const res = await adapter.alerts(new Request("https://example.test"), createSupabaseMock("observability_events", []));
  assert.equal(res.status, 401);
});

test("test adapter alerts handler returns 403 from authorize", async () => {
  const adapter = createRouteTestAdapter({
    parseExportRequest: () => ({
      payload: { window: "24h", severity: "all", source: "all", event_type: "all" },
      shareSig: "invalid",
      limit: 100,
      sinceIso: null,
    }),
    authorize: async () => new Response("Forbidden", { status: 403 }),
  });
  const res = await adapter.alerts(new Request("https://example.test"), createSupabaseMock("observability_events", []));
  assert.equal(res.status, 403);
});

test("test adapter alerts handler returns 500 when query fails", async () => {
  const adapter = createRouteTestAdapter({
    parseExportRequest: () => ({
      payload: { window: "24h", severity: "all", source: "all", event_type: "all" },
      shareSig: "",
      limit: 100,
      sinceIso: null,
    }),
    authorize: async () => null,
  });
  const supabase = {
    from() {
      return {
        select() {
          return this;
        },
        order() {
          return this;
        },
        limit() {
          return this;
        },
        then(resolve: (_value: unknown) => void) {
          return Promise.resolve(resolve({ data: null, error: { message: "db failed" } }));
        },
      };
    },
  } as any;
  const res = await adapter.alerts(new Request("https://example.test"), supabase);
  assert.equal(res.status, 500);
  assert.equal((await res.text()).includes("db failed"), true);
});

test("test adapter alerts csv escapes commas and quotes", async () => {
  const adapter = createRouteTestAdapter({
    parseExportRequest: () => ({
      payload: { window: "24h", severity: "all", source: "all", event_type: "all" },
      shareSig: "",
      limit: 100,
      sinceIso: null,
    }),
    authorize: async () => null,
  });
  const res = await adapter.alerts(
    new Request("https://example.test"),
    createSupabaseMock("observability_events", [
      {
        created_at: "2026-01-01T00:00:00.000Z",
        source: "edge.payment_webhook",
        event_type: 'evt,"x"',
        severity: "error",
        status_code: 500,
        request_id: "req-1",
        latency_ms: 10,
        metadata: { message: 'hello, "world"' },
      },
    ])
  );
  assert.equal(res.status, 200);
  const csv = await res.text();
  assert.equal(csv.includes('"evt,""x"""'), true);
  assert.equal(csv.includes('"{""message"":""hello, \\""world\\""""}"'), true);
});

test("test adapter maintenance handler returns 500 when query fails", async () => {
  const adapter = createRouteTestAdapter({
    parseExportRequest: () => ({
      payload: { window: "24h", severity: "all", source: "all", event_type: "all" },
      shareSig: "",
      limit: 100,
      sinceIso: null,
    }),
    authorize: async () => null,
  });
  const supabase = {
    from() {
      return {
        select() {
          return this;
        },
        order() {
          return this;
        },
        limit() {
          return this;
        },
        then(resolve: (_value: unknown) => void) {
          return Promise.resolve(resolve({ data: null, error: { message: "runs query failed" } }));
        },
      };
    },
  } as any;
  const res = await adapter.maintenance(new Request("https://example.test"), supabase);
  assert.equal(res.status, 500);
  assert.equal((await res.text()).includes("runs query failed"), true);
});
