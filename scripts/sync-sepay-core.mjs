#!/usr/bin/env node
/**
 * Syncs src/lib/payments/sepay-webhook-core.ts to
 * supabase/functions/payment-webhook/providers/sepay-core.ts for Edge (Deno).
 * Run: node scripts/sync-sepay-core.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const src = join(root, "src/lib/payments/sepay-webhook-core.ts");
const dest = join(root, "supabase/functions/payment-webhook/providers/sepay-core.ts");

const content = readFileSync(src, "utf8");
const header = `// AUTO-GENERATED from src/lib/payments/sepay-webhook-core.ts — do not edit here. Run: node scripts/sync-sepay-core.mjs\n\n`;
writeFileSync(dest, header + content, "utf8");
console.log("Synced sepay-webhook-core.ts -> providers/sepay-core.ts");
