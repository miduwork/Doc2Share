import { strict as assert } from "node:assert";
import { test } from "node:test";
import { clampInt, pickSingle } from "./search-params.ts";

test("pickSingle returns first string from array and fallback for empty", () => {
  assert.equal(pickSingle(["a", "b"], "x"), "a");
  assert.equal(pickSingle([], "x"), "x");
  assert.equal(pickSingle(undefined, "x"), "x");
  assert.equal(pickSingle("value", "x"), "value");
});

test("clampInt clamps by min/max and uses fallback for invalid", () => {
  assert.equal(clampInt("20", 10, 100, 50), 20);
  assert.equal(clampInt("-1", 10, 100, 50), 10);
  assert.equal(clampInt("999", 10, 100, 50), 100);
  assert.equal(clampInt("bad", 10, 100, 50), 50);
});
