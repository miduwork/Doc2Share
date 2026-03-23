#!/usr/bin/env node
/**
 * Discovers all *.test.ts files under src/test-integration/ and runs node --test.
 * Requires Node.js 22+ (fs.globSync).
 */
import { spawnSync } from "node:child_process";
import { globSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const integrationDir = join(root, "src", "test-integration");

const relFiles = globSync("**/*.test.ts", { cwd: integrationDir }).sort();
const files = relFiles.map((rel) => join(integrationDir, rel));

if (files.length === 0) {
  console.error("No integration test files found under src/test-integration/.");
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  ["--experimental-strip-types", "--test", ...files],
  { stdio: "inherit", shell: false }
);

process.exit(result.status ?? 1);
