#!/usr/bin/env node
import { lstatSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";

const repoRoot = process.cwd();
const sourceExtensions = new Set([".cjs", ".js", ".jsx", ".mjs", ".ts", ".tsx"]);
const skippedDirs = new Set([".git", ".next", "node_modules"]);
const allowedOutsideSrc = new Set([
  "eslint.config.mjs",
  "next-env.d.ts",
  "next.config.mjs",
  "postcss.config.mjs",
  "tailwind.config.ts",
  "scripts/verify-lint-scope.mjs"
]);

function extensionOf(path) {
  const match = path.match(/\.(?:d\.)?(mjs|cjs|js|jsx|ts|tsx)$/);
  if (!match) return "";
  if (path.endsWith(".d.ts")) return ".ts";
  return `.${match[1]}`;
}

function walk(dir, results = []) {
  for (const name of readdirSync(dir)) {
    if (skippedDirs.has(name)) continue;
    const absolutePath = join(dir, name);
    const stats = lstatSync(absolutePath);
    if (stats.isSymbolicLink()) continue;
    if (stats.isDirectory()) {
      walk(absolutePath, results);
      continue;
    }
    const relativePath = relative(repoRoot, absolutePath).split(sep).join("/");
    if (sourceExtensions.has(extensionOf(relativePath))) {
      results.push(relativePath);
    }
  }
  return results;
}

const sourceFiles = walk(repoRoot).sort();
const outsideSrc = sourceFiles.filter((path) => !path.startsWith("src/"));
const unexpected = outsideSrc.filter((path) => !allowedOutsideSrc.has(path));

if (unexpected.length) {
  console.error("LINT_SCOPE_BLOCKED: source files outside src are not covered by npm run lint.");
  for (const path of unexpected) {
    console.error(`- ${path}`);
  }
  process.exitCode = 1;
} else {
  console.log(`LINT_SCOPE_OK: ${sourceFiles.length} source/config file(s) checked; app/runtime lint surface remains under src/.`);
}
