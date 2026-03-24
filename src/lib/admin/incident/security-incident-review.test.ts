import { test } from "node:test";
import { strict as assert } from "node:assert";
import { updateSecurityIncidentReview } from "./security-incident-review.ts";

test("updateSecurityIncidentReview writes expected payload fields", async () => {
  let updatedPayload: Record<string, unknown> | null = null;
  let updatedId: string | null = null;
  const supabaseMock = {
    from() {
      return {
        update(payload: Record<string, unknown>) {
          updatedPayload = payload;
          return {
            eq(_column: string, id: string) {
              updatedId = id;
              return Promise.resolve({ error: null });
            },
          };
        },
      };
    },
  } as any;

  await updateSecurityIncidentReview({
    supabase: supabaseMock,
    incidentId: "incident-1",
    reviewStatus: "false_positive",
    notes: "checked",
    actorUserId: "admin-1",
  });

  assert.equal(updatedId, "incident-1");
  assert.equal(updatedPayload?.review_status, "false_positive");
  assert.equal(updatedPayload?.notes, "checked");
  assert.equal(updatedPayload?.reviewed_by, "admin-1");
  assert.equal(typeof updatedPayload?.reviewed_at, "string");
});

test("updateSecurityIncidentReview throws on db errors", async () => {
  const supabaseMock = {
    from() {
      return {
        update() {
          return {
            eq() {
              return Promise.resolve({ error: { message: "db failed" } });
            },
          };
        },
      };
    },
  } as any;

  await assert.rejects(
    async () =>
      updateSecurityIncidentReview({
        supabase: supabaseMock,
        incidentId: "incident-2",
        reviewStatus: "confirmed_risk",
      }),
    /db failed/
  );
});
