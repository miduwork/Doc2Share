#!/usr/bin/env node
/**
 * Syncs src/lib/secure-access/secure-access-db-helpers.ts to
 * supabase/functions/get-secure-link/secure-access-db-helpers.ts for Edge (Deno).
 * Run: node scripts/sync-secure-access-db.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const src = join(root, "src/lib/secure-access/secure-access-db-helpers.ts");
const dest = join(root, "supabase/functions/get-secure-link/secure-access-db-helpers.ts");

const content = readFileSync(src, "utf8");
const header = `// AUTO-GENERATED from src/lib/secure-access/secure-access-db-helpers.ts — do not edit here. Run: node scripts/sync-secure-access-db.mjs\n\n`;
writeFileSync(dest, header + content, "utf8");
console.log("Synced secure-access-db-helpers.ts -> get-secure-link/secure-access-db-helpers.ts");
