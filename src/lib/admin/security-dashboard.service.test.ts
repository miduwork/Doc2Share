import { test } from "node:test";
import { strict as assert } from "node:assert";
import { getAdminSecurityDashboardData } from "./security-dashboard.service.ts";

type InsertRow = {
  correlation_id: string | null;
  user_id: string;
  risk_score: number;
  risk_band: string;
};

function makeUserClientMock() {
  const incidents = [
    {
      id: "i1",
      correlation_id: "existing-correlation",
      user_id: "existing-user",
      risk_score: 90,
      risk_band: "high",
      review_status: "pending",
      detected_at: new Date().toISOString(),
      notes: null,
    },
  ];
  const activeSessions = [
    {
      session_id: "s1",
      user_id: "user-1",
      ip_address: "1.1.1.1",
      user_agent: "ua",
      device_id: "d1",
      created_at: new Date().toISOString(),
    },
  ];

  return {
    from(table: string) {
      if (table === "active_sessions") {
        return {
          select() {
            return this;
          },
          order() {
            return Promise.resolve({ data: activeSessions });
          },
        };
      }
      if (table === "security_incidents") {
        return {
          select() {
            return this;
          },
          order() {
            return this;
          },
          limit() {
            return Promise.resolve({ data: incidents });
          },
        };
      }
      throw new Error(`Unsupported table in user client mock: ${table}`);
    },
  } as any;
}

function makeAdminClientMock(state: { inserts: InsertRow[] }) {
  const existing = [{ id: "ei1", user_id: "existing-user", correlation_id: "existing-correlation" }];
  return {
    from(table: string) {
      if (table === "security_incidents") {
        return {
          select() {
            return this;
          },
          gte() {
            return Promise.resolve({ data: existing });
          },
          insert(row: InsertRow) {
            state.inserts.push(row);
            return Promise.resolve({ data: null, error: null });
          },
        };
      }
      throw new Error(`Unsupported table in admin client mock: ${table}`);
    },
  } as any;
}

test("getAdminSecurityDashboardData returns dashboard shape and export urls", async () => {
  const insertState = { inserts: [] as InsertRow[] };
  const result = await getAdminSecurityDashboardData({
    searchParams: {
      from: "2026-01-01T00:00:00.000Z",
      to: "2026-01-02T00:00:00.000Z",
      user_id: "user-1",
      page_size: "25",
      severity: "high",
      status: "blocked",
      ip: "1.1.1.1",
      correlation_id: "corr-1",
      document_id: "doc-1",
    },
    dependencies: {
      createUserClient: async () => makeUserClientMock(),
      createAdminClient: () => makeAdminClientMock(insertState),
      fetchSecurityLogsPage: async () => ({ items: [], nextCursor: null, prevCursor: null }),
      fetchAccessLogsPage: async () => ({ items: [], nextCursor: null, prevCursor: null }),
      computeHighRiskUsers: async () => [],
      getWeeklyFalsePositiveStats: async () => ({
        weekStartIso: new Date().toISOString(),
        totalIncidents: 0,
        confirmedRisk: 0,
        manualFalsePositive: 0,
        proxyFalsePositive: 0,
      }),
      resolveGeoPoints: async () => [],
    },
  });

  assert.equal(Array.isArray(result.data.activeSessions), true);
  assert.equal(result.data.exportUrls.access.includes("/admin/security/export/access-logs?"), true);
  assert.equal(result.data.exportUrls.security.includes("/admin/security/export/security-logs?"), true);
  assert.equal(result.data.exportUrls.access.includes("user_id=user-1"), true);
  assert.equal(result.data.exportUrls.access.includes("page_size=25"), true);
  assert.equal(insertState.inserts.length, 0);
});

test("getAdminSecurityDashboardData deduplicates incidents in 24h window", async () => {
  const insertState = { inserts: [] as InsertRow[] };
  await getAdminSecurityDashboardData({
    dependencies: {
      createUserClient: async () => makeUserClientMock(),
      createAdminClient: () => makeAdminClientMock(insertState),
      fetchSecurityLogsPage: async () => ({ items: [], nextCursor: null, prevCursor: null }),
      fetchAccessLogsPage: async () => ({ items: [], nextCursor: null, prevCursor: null }),
      computeHighRiskUsers: async () => [
        {
          userId: "existing-user",
          score: 90,
          band: "high",
          factors: [],
          correlationId: "existing-correlation",
        },
        {
          userId: "new-user",
          score: 88,
          band: "high",
          factors: [],
          correlationId: "new-correlation",
        },
      ],
      getWeeklyFalsePositiveStats: async () => ({
        weekStartIso: new Date().toISOString(),
        totalIncidents: 0,
        confirmedRisk: 0,
        manualFalsePositive: 0,
        proxyFalsePositive: 0,
      }),
      resolveGeoPoints: async () => [],
    },
  });

  assert.equal(insertState.inserts.length, 1);
  assert.equal(insertState.inserts[0]?.user_id, "new-user");
  assert.equal(insertState.inserts[0]?.correlation_id, "new-correlation");
});
