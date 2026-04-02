#!/usr/bin/env node
/**
 * CI guard: ensures synced Edge files match their Node source.
 * Compares content after stripping the AUTO-GENERATED header line from dest.
 * Exit code 1 if any pair has drifted.
 *
 * Usage: node scripts/check-sync-drift.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const PAIRS = [
    {
        src: "src/lib/secure-access/secure-access-core.ts",
        dest: "supabase/functions/get-secure-link/secure-access-core.ts",
        syncCmd: "npm run sync:secure-access",
    },
    {
        src: "src/lib/secure-access/secure-access-db-helpers.ts",
        dest: "supabase/functions/get-secure-link/secure-access-db-helpers.ts",
        syncCmd: "npm run sync:secure-access-db",
    },
];

let drifted = false;

for (const { src, dest, syncCmd } of PAIRS) {
    const srcPath = join(root, src);
    const destPath = join(root, dest);

    let srcContent, destContent;
    try {
        srcContent = readFileSync(srcPath, "utf8");
    } catch {
        console.error(`❌ Source not found: ${relative(root, srcPath)}`);
        drifted = true;
        continue;
    }
    try {
        destContent = readFileSync(destPath, "utf8");
    } catch {
        console.error(`❌ Destination not found: ${relative(root, destPath)}`);
        console.error(`   Run: ${syncCmd}`);
        drifted = true;
        continue;
    }

    // Strip the AUTO-GENERATED header (first line + blank line) from dest
    const headerEnd = destContent.indexOf("\n\n");
    const destBody = headerEnd >= 0 ? destContent.slice(headerEnd + 2) : destContent;

    if (srcContent !== destBody) {
        console.error(`❌ DRIFT detected:`);
        console.error(`   Source: ${relative(root, srcPath)}`);
        console.error(`   Dest:   ${relative(root, destPath)}`);
        console.error(`   Fix:    ${syncCmd}`);
        drifted = true;
    } else {
        console.log(`✅ In sync: ${relative(root, srcPath)}`);
    }
}

if (drifted) {
    console.error("\n⚠️  Sync drift detected. Run the sync commands above, then commit.");
    process.exit(1);
} else {
    console.log("\n✅ All Node ↔ Edge files are in sync.");
}
