import { test } from "node:test";
import { strict as assert } from "node:assert";
import { bandFromScore, normalizeAccessAction, ratioPoints, thresholdPoints } from "./security-risk.scoring.ts";

test("normalizeAccessAction maps secure endpoints", () => {
  assert.equal(normalizeAccessAction("secure_pdf"), "secure_read");
  assert.equal(normalizeAccessAction("get_secure_link"), "secure_read");
  assert.equal(normalizeAccessAction("other"), "other");
});

test("thresholdPoints and ratioPoints follow expected bands", () => {
  assert.equal(thresholdPoints(0, 20, 2, 4), 0);
  assert.equal(thresholdPoints(2, 20, 2, 4), 12);
  assert.equal(thresholdPoints(4, 20, 2, 4), 20);
  assert.equal(ratioPoints(1, 2), 9);
  assert.equal(ratioPoints(2, 1), 25);
});

test("bandFromScore returns deterministic risk band", () => {
  assert.equal(bandFromScore(39), "low");
  assert.equal(bandFromScore(40), "medium");
  assert.equal(bandFromScore(70), "high");
  assert.equal(bandFromScore(85), "critical");
});
