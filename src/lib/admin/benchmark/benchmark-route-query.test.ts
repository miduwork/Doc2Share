import { test } from "node:test";
import { strict as assert } from "node:assert";
import { parseBenchmarkRouteQuery } from "./benchmark-route-query.ts";

test("parseBenchmarkRouteQuery clamps and floors threshold", () => {
  assert.equal(parseBenchmarkRouteQuery("http://x?a=1&threshold=101").threshold, 100);
  assert.equal(parseBenchmarkRouteQuery("http://x?a=1&threshold=-1").threshold, 0);
  assert.equal(parseBenchmarkRouteQuery("http://x?a=1&threshold=74.9").threshold, 74);
  assert.equal(parseBenchmarkRouteQuery("http://x?a=1&threshold=abc").threshold, 70);
});

test("parseBenchmarkRouteQuery preserves explicit from/to", () => {
  const parsed = parseBenchmarkRouteQuery("http://x?from=2026-01-01T00:00:00.000Z&to=2026-01-10T00:00:00.000Z");
  assert.equal(parsed.fromIso, "2026-01-01T00:00:00.000Z");
  assert.equal(parsed.toIso, "2026-01-10T00:00:00.000Z");
});
