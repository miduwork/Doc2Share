#!/usr/bin/env node
/**
 * Discovers all *.test.ts files under src/ (excluding src/test-integration) and runs node --test.
 * Requires Node.js 22+ (fs.globSync).
 */
import { spawnSync } from "node:child_process";
import { globSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const srcDir = join(root, "src");
const aliasLoaderUrl = pathToFileURL(
  join(root, "scripts", "test-esm-alias-loader.mjs")
).href;

function isUnderTestIntegration(relPath) {
  const n = relPath.replaceAll("\\", "/");
  return n.startsWith("test-integration/") || n === "test-integration";
}

const relFiles = globSync("**/*.test.ts", {
  cwd: srcDir,
  exclude: (p) => isUnderTestIntegration(p),
}).sort();

const files = relFiles.map((rel) => join(srcDir, rel));

if (files.length === 0) {
  console.error("No unit test files found under src/ (excluding test-integration).");
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  [
    "--experimental-strip-types",
    "--loader",
    aliasLoaderUrl,
    "--experimental-test-coverage",
    "--test",
    ...files
  ],
  { stdio: "inherit", shell: false }
);

process.exit(result.status ?? 1);
