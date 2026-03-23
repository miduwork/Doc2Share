import { test } from "node:test";
import { strict as assert } from "node:assert";

import { formatDate } from "./date.ts";

test("formatDate formats valid ISO date in vi-VN locale", () => {
  const result = formatDate("2025-02-20T14:30:00.000Z");
  assert.match(result, /\d{2}\/\d{2}\/\d{4}/);
  assert.match(result, /\d{2}:\d{2}/);
});

test("formatDate returns Invalid Date string for invalid date input", () => {
  const result = formatDate("not-a-date");
  assert.equal(result, "Invalid Date");
});

test("formatDate returns Invalid Date string for empty string", () => {
  assert.equal(formatDate(""), "Invalid Date");
});

test("formatDate handles date-only string", () => {
  const result = formatDate("2025-02-20");
  assert.match(result, /20\/02\/2025|2\/20\/2025|\d{2}\/\d{2}\/\d{4}/);
});
