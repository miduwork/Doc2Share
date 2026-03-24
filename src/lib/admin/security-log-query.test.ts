import { test } from "node:test";
import { strict as assert } from "node:assert";
import { encodeCursor, parseSecurityLogFilters, toCsv } from "./security-log-query.ts";

test("parseSecurityLogFilters applies defaults", () => {
  const parsed = parseSecurityLogFilters({});
  assert.equal(parsed.severity, "all");
  assert.equal(parsed.status, "all");
  assert.equal(parsed.pageSize, 50);
  assert.equal(parsed.accessDir, "next");
  assert.equal(parsed.securityDir, "next");
  assert.ok(parsed.from.length > 0);
  assert.ok(parsed.to.length > 0);
});

test("parseSecurityLogFilters normalizes and clamps values", () => {
  const parsed = parseSecurityLogFilters({
    severity: "high",
    status: "blocked",
    page_size: "1000",
    access_dir: "prev",
    security_dir: "prev",
    user_id: " u1 ",
  });
  assert.equal(parsed.severity, "high");
  assert.equal(parsed.status, "blocked");
  assert.equal(parsed.pageSize, 200);
  assert.equal(parsed.accessDir, "prev");
  assert.equal(parsed.securityDir, "prev");
  assert.equal(parsed.userId, "u1");
});

test("encodeCursor combines created_at and id", () => {
  const cursor = encodeCursor({ created_at: "2026-01-01T00:00:00.000Z", id: "abc" });
  assert.equal(cursor, "2026-01-01T00:00:00.000Z|abc");
});

test("toCsv escapes quotes and commas", () => {
  const csv = toCsv(
    [
      {
        id: "1",
        text: 'hello, "world"',
      },
    ],
    ["id", "text"]
  );
  assert.ok(csv.startsWith("\uFEFF"));
  assert.ok(csv.includes('"hello, ""world"""'));
});
