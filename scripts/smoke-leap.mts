/**
 * Local smoke check against a real MuleSoft export (not part of the npm run
 * check pipeline). Build first: npm run build. Usage: node scripts/smoke-leap.mts [zipPath]
 */
import { readFileSync } from "node:fs";

import { discoverRoots, loadZip, resolveSpec } from "../dist/index.js";

const zipPath =
  process.argv[2] ?? "examples/leap-inventory-experience-api-1.1.3-raml.zip";
const vfs = loadZip(new Uint8Array(readFileSync(zipPath)));

const roots = discoverRoots(vfs);
console.log("files in vfs:", vfs.paths.length);
console.log("root candidates:", roots);

for (const root of roots) {
  const { format, tree, diagnostics } = resolveSpec(vfs, root);
  console.log(`\n=== ${root} (format: ${format}) ===`);
  console.log("title:", (tree as Record<string, unknown>)["title"]);
  const resources = Object.keys(tree).filter((k) => k.startsWith("/"));
  console.log("top-level resources:", resources);
  let methodCount = 0;
  const count = (node: Record<string, unknown>, base: string) => {
    for (const [key, value] of Object.entries(node)) {
      if (!key.startsWith("/") || typeof value !== "object" || value === null)
        continue;
      const res = value as Record<string, unknown>;
      for (const m of ["get", "post", "put", "delete", "patch"]) {
        if (res[m] !== undefined) {
          methodCount++;
          console.log(`  ${m.toUpperCase()} ${base}${key}`);
        }
      }
      count(res, base + key);
    }
  };
  count(tree as Record<string, unknown>, "");
  console.log("endpoints found:", methodCount);
  const byCode = new Map<string, number>();
  for (const d of diagnostics) {
    byCode.set(d.code, (byCode.get(d.code) ?? 0) + 1);
  }
  console.log("diagnostics:", Object.fromEntries(byCode));
}
