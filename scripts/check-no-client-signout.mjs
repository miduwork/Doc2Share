import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.cwd(), "src");
const CLIENT_EXTS = new Set([".ts", ".tsx", ".js", ".jsx"]);

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walk(full));
      continue;
    }
    if (CLIENT_EXTS.has(path.extname(entry.name))) files.push(full);
  }
  return files;
}

function hasUseClientDirective(source) {
  const trimmed = source.trimStart();
  return trimmed.startsWith("\"use client\"") || trimmed.startsWith("'use client'");
}

function hasDirectSignOut(source) {
  return /supabase\s*\.\s*auth\s*\.\s*signOut\s*\(/.test(source);
}

async function main() {
  const files = await walk(ROOT);
  const violations = [];

  for (const file of files) {
    const source = await fs.readFile(file, "utf8");
    if (!hasUseClientDirective(source)) continue;
    if (!hasDirectSignOut(source)) continue;
    violations.push(path.relative(process.cwd(), file));
  }

  if (violations.length === 0) {
    console.log("No direct supabase.auth.signOut() in client files.");
    return;
  }

  console.error("Found forbidden supabase.auth.signOut() usage in client files:");
  for (const file of violations) console.error(`- ${file}`);
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

