import path from "node:path";
import fs from "node:fs";
import { pathToFileURL } from "node:url";

const projectRoot = process.cwd();
const srcRoot = path.resolve(projectRoot, "src");
const serverOnlyStubUrl = pathToFileURL(path.resolve(projectRoot, "scripts/test-server-only-stub.mjs")).href;

function resolveAliasToUrl(aliasPath) {
  const clean = aliasPath.replace(/^@\//, "");
  const base = path.resolve(srcRoot, clean);
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    `${base}.mjs`,
    path.join(base, "index.ts"),
    path.join(base, "index.tsx"),
    path.join(base, "index.js"),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return pathToFileURL(candidate).href;
    }
  }
  return pathToFileURL(`${base}.ts`).href;
}

export async function resolve(specifier, context, defaultResolve) {
  if (specifier === "server-only") {
    return { url: serverOnlyStubUrl, shortCircuit: true };
  }
  if (specifier.startsWith("@/")) {
    const url = resolveAliasToUrl(specifier);
    return defaultResolve(url, context, defaultResolve);
  }
  return defaultResolve(specifier, context, defaultResolve);
}
