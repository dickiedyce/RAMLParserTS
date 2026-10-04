/**
 * Regenerates Swift goldens (fixtures/<name>/golden.swift.json) using the
 * RAMLParserKit-based runner in parity/swift-runner (macOS, local).
 *
 * Usage: npm run goldens
 *
 * Covers committed fixtures and private corpora under fixtures/local/ (which
 * is git-ignored). Run this whenever a fixture or the pinned RAMLParserKit
 * version changes; the regenerated goldens are what `npm run test` diffs
 * against.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const runnerDir = "parity/swift-runner";
const binary = join(runnerDir, ".build", "release", "swift-golden");

function walk(dir: string): string[] {
  const files: string[] = [];
  for (const name of readdirSync(dir).sort()) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) files.push(...walk(full));
    else files.push(full);
  }
  return files;
}

function findRoot(dir: string): string | null {
  for (const file of walk(dir)) {
    if (file.endsWith("golden.swift.json")) continue;
    const content = readFileSync(file, "utf8");
    const firstLine = content.split(/\r?\n/, 1)[0] ?? "";
    if (/^#%RAML\s+1\.0\s*$/.test(firstLine)) return file;
    if (firstLine.startsWith("{")) {
      try {
        const parsed = JSON.parse(content) as { openapi?: unknown };
        if (
          typeof parsed.openapi === "string" &&
          parsed.openapi.startsWith("3")
        ) {
          return file;
        }
      } catch {
        // Not JSON after all.
      }
    }
  }
  return null;
}

function fixtureDirs(): string[] {
  const dirs: string[] = [];
  for (const name of readdirSync("fixtures").sort()) {
    const dir = join("fixtures", name);
    if (statSync(dir).isDirectory() && name !== "local") dirs.push(dir);
  }
  const local = "fixtures/local";
  if (existsSync(local)) {
    for (const name of readdirSync(local).sort()) {
      const dir = join(local, name);
      if (statSync(dir).isDirectory()) dirs.push(dir);
    }
  }
  return dirs;
}

if (!existsSync(binary)) {
  execFileSync(
    "swift",
    ["build", "-c", "release", "--package-path", runnerDir],
    { stdio: "inherit" },
  );
}

for (const dir of fixtureDirs()) {
  const root = findRoot(dir);
  if (root === null) {
    console.warn(`skip ${dir}: no root spec found`);
    continue;
  }
  const out = join(dir, "golden.swift.json");
  execFileSync(binary, [root, out], {
    stdio: ["ignore", "ignore", "inherit"],
  });
  console.log(
    `${relative(".", root).split(sep).join("/")} -> ${relative(".", out).split(sep).join("/")}`,
  );
}
