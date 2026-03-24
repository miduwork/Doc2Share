#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const loaderPath = pathToFileURL(join(root, "scripts", "test-esm-alias-loader.mjs")).href;

const files = [
  "src/app/admin/observability/admin-observability.types.test.ts",
  "src/app/admin/observability/utils.test.ts",
  "src/app/admin/observability/export/route-test-adapter.test.ts",
  "src/lib/admin/observability-dashboard.service.test.ts",
  "src/lib/admin/observability-maintenance.command.test.ts",
  "src/lib/search-params.test.ts",
];

const args = [
  "--experimental-strip-types",
  "--experimental-loader",
  loaderPath,
  "--test",
  ...files,
];

const result = spawnSync(process.execPath, args, {
  stdio: "inherit",
  shell: false,
  cwd: root,
});

process.exit(result.status ?? 1);
