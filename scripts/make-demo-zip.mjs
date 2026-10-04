#!/usr/bin/env node
/**
 * Regenerates the committed synthetic demo zip from examples/demo/.
 *
 * Usage: node scripts/make-demo-zip.mjs
 *
 * The demo zip is invented content (DESIGN.md §8) — safe to commit and
 * distribute. Regenerate it whenever examples/demo/ changes.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { strToU8, zipSync } from "fflate";

const root = "examples/demo";
const out = "examples/demo-inventory-api-1.0.0-raml.zip";

function walk(dir) {
  const files = [];
  for (const name of readdirSync(dir).sort()) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) files.push(...walk(full));
    else files.push(full);
  }
  return files;
}

const entries = {};
for (const file of walk(root)) {
  const rel = relative(root, file).split(sep).join("/");
  entries[rel] = strToU8(readFileSync(file, "utf8"));
}
writeFileSync(out, zipSync(entries, { level: 6 }));
console.log(`Wrote ${out} (${Object.keys(entries).length} files)`);
