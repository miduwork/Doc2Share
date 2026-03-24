import { test } from "node:test";
import { strict as assert } from "node:assert";
import { syncSecurityIncidentsFromHighRiskUsers } from "./security-incident-sync.ts";

test("syncSecurityIncidentsFromHighRiskUsers inserts only non-duplicate incidents", async () => {
  const inserted: { user_id: string; correlation_id: string | null }[] = [];
  const supabaseMock = {
    from() {
      return {
        select() {
          return this;
        },
        gte() {
          return Promise.resolve({
            data: [{ id: "1", user_id: "u1", correlation_id: "c1" }],
          });
        },
        insert(row: { user_id: string; correlation_id: string | null }) {
          inserted.push(row);
          return Promise.resolve({ error: null });
        },
      };
    },
  } as any;

  await syncSecurityIncidentsFromHighRiskUsers({
    service: supabaseMock,
    highRiskUsers: [
      { userId: "u1", correlationId: "c1", score: 80, band: "high", factors: [] },
      { userId: "u2", correlationId: "c2", score: 82, band: "high", factors: [] },
    ],
  });

  assert.equal(inserted.length, 1);
  assert.equal(inserted[0]?.user_id, "u2");
});
