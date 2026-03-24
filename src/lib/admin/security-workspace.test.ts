import { test } from "node:test";
import { strict as assert } from "node:assert";
import { parseSecurityWorkspace } from "./security-workspace.ts";

test("parseSecurityWorkspace returns overview by default", () => {
  assert.equal(parseSecurityWorkspace(undefined), "overview");
  assert.equal(parseSecurityWorkspace(null), "overview");
  assert.equal(parseSecurityWorkspace(""), "overview");
  assert.equal(parseSecurityWorkspace("invalid"), "overview");
});

test("parseSecurityWorkspace accepts known values", () => {
  assert.equal(parseSecurityWorkspace("overview"), "overview");
  assert.equal(parseSecurityWorkspace("logs"), "logs");
  assert.equal(parseSecurityWorkspace("geo"), "geo");
  assert.equal(parseSecurityWorkspace("benchmark"), "benchmark");
});
