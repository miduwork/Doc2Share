import { test } from "node:test";
import { strict as assert } from "node:assert";
import { computeHighRiskUsers, normalizeAccessAction } from "./security-risk.ts";

function makeSupabaseMock() {
  return {
    from(table: string) {
      return {
        select() {
          return this;
        },
        gte() {
          if (table === "device_logs") {
            return Promise.resolve({
              data: [
                { user_id: "u1", device_id: "d1", created_at: new Date().toISOString() },
                { user_id: "u1", device_id: "d2", created_at: new Date().toISOString() },
                { user_id: "u1", device_id: "d3", created_at: new Date().toISOString() },
              ],
            });
          }
          if (table === "access_logs") {
            return Promise.resolve({
              data: [
                {
                  user_id: "u1",
                  status: "blocked",
                  action: "secure_pdf",
                  ip_address: "1.1.1.1",
                  correlation_id: "c1",
                  document_id: "doc1",
                  metadata: { reason: "rate_limit" },
                },
                {
                  user_id: "u1",
                  status: "blocked",
                  action: "get_secure_link",
                  ip_address: "2.2.2.2",
                  correlation_id: "c1",
                  document_id: "doc2",
                  metadata: { reason: "rate_limit" },
                },
              ],
            });
          }
          return Promise.resolve({ data: [] });
        },
      };
    },
  } as any;
}

test("computeHighRiskUsers returns high score user", async () => {
  const users = await computeHighRiskUsers({ supabase: makeSupabaseMock(), threshold: 10, limit: 10 });
  assert.equal(users.length, 1);
  assert.equal(users[0]?.userId, "u1");
  assert.ok((users[0]?.score ?? 0) >= 10);
});

test("normalizeAccessAction maps secure actions consistently", () => {
  assert.equal(normalizeAccessAction("secure_pdf"), "secure_read");
  assert.equal(normalizeAccessAction("get_secure_link"), "secure_read");
  assert.equal(normalizeAccessAction("login_attempt"), "other");
});
