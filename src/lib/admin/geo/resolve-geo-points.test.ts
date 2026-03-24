import { test } from "node:test";
import { strict as assert } from "node:assert";
import { resolveGeoPoints } from "./resolve-geo-points.ts";

test("resolveGeoPoints keeps cache hits and batch-upserts misses", async () => {
  const upserts: any[] = [];
  const supabaseMock = {
    from(table: string) {
      if (table !== "ip_geo_cache") throw new Error("unexpected table");
      return {
        select() {
          return this;
        },
        in() {
          return Promise.resolve({
            data: [
              {
                ip: "1.1.1.1",
                country_code: "US",
                country_name: "United States",
                city: "Austin",
                lat: 30,
                lng: -97,
                status: "resolved",
                provider: "primary",
                expires_at: new Date(Date.now() + 60_000).toISOString(),
              },
            ],
          });
        },
        upsert(rows: any[]) {
          upserts.push(rows);
          return Promise.resolve({ error: null });
        },
      };
    },
  } as any;

  const oldFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    ({
      ok: true,
      async json() {
        return { country_code: "VN", country_name: "Vietnam", city: "Ho Chi Minh", lat: 10.8, lng: 106.6 };
      },
    }) as any) as any;
  process.env.GEO_PRIMARY_URL = "https://geo.local";

  try {
    const points = await resolveGeoPoints({
      supabase: supabaseMock,
      ips: ["1.1.1.1", "8.8.8.8", "192.168.1.1"],
      concurrency: 2,
    });
    assert.equal(points.length, 3);
    assert.equal(points.some((p) => p.ip === "1.1.1.1" && p.status === "resolved"), true);
    assert.equal(points.some((p) => p.ip === "8.8.8.8" && p.status === "resolved"), true);
    assert.equal(points.some((p) => p.ip === "192.168.1.1" && p.status === "unknown"), true);
    assert.equal(upserts.length, 1);
    assert.equal(Array.isArray(upserts[0]), true);
    assert.equal(upserts[0].length, 1);
    assert.equal(upserts[0][0]?.ip, "8.8.8.8");
  } finally {
    globalThis.fetch = oldFetch;
    delete process.env.GEO_PRIMARY_URL;
  }
});
