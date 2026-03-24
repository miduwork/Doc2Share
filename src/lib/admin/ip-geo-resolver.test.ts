import { test } from "node:test";
import { strict as assert } from "node:assert";
import { resolveGeoPoints } from "./ip-geo-resolver.ts";

function makeSupabaseMock() {
  return {
    from() {
      return {
        select() {
          return this;
        },
        in() {
          return Promise.resolve({ data: [] });
        },
        upsert() {
          return Promise.resolve({ error: null });
        },
      };
    },
  } as any;
}

test("resolveGeoPoints returns unknown for private ip", async () => {
  const points = await resolveGeoPoints({
    supabase: makeSupabaseMock(),
    ips: ["192.168.1.1", "unknown"],
  });
  assert.equal(points.length, 2);
  assert.equal(points[0]?.status, "unknown");
  assert.equal(points[1]?.status, "unknown");
});
