import { test } from "node:test";
import { strict as assert } from "node:assert";

import { applyDiscoveryFilterUpdate } from "./discovery-filters-url.ts";

test("sets grade and preserves sort, strips page", () => {
  const { search } = applyDiscoveryFilterUpdate(
    "sort=price_asc&page=3",
    "grade",
    "1"
  );
  assert.ok(search.includes("grade=1"));
  assert.ok(search.includes("sort=price_asc"));
  assert.ok(!search.includes("page="));
});

test("clears grade and strips page", () => {
  const { search } = applyDiscoveryFilterUpdate("grade=1&page=3", "grade", null);
  assert.ok(!search.includes("grade="));
  assert.ok(!search.includes("page="));
});

test("any filter change removes page from initial query", () => {
  const { search } = applyDiscoveryFilterUpdate(
    "grade=1&subject=2&page=2&sort=price_asc",
    "subject",
    "9"
  );
  assert.ok(search.includes("grade=1"));
  assert.ok(search.includes("subject=9"));
  assert.ok(search.includes("sort=price_asc"));
  assert.ok(!search.includes("page="));
});

test("empty search string when all filter keys cleared", () => {
  const { search } = applyDiscoveryFilterUpdate("grade=1", "grade", null);
  assert.equal(search, "");
});

test("accepts URLSearchParams input", () => {
  const params = new URLSearchParams("sort=newest&page=5");
  const { search } = applyDiscoveryFilterUpdate(params, "exam", "3");
  assert.ok(search.includes("exam=3"));
  assert.ok(search.includes("sort=newest"));
  assert.ok(!search.includes("page="));
});

test("strips leading question mark from string input", () => {
  const { search } = applyDiscoveryFilterUpdate("?grade=2&page=1", "grade", null);
  assert.equal(search, "");
});
