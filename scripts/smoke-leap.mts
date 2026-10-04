/**
 * Local smoke check against a real MuleSoft export (not part of the npm run
 * check pipeline). Build first: npm run build. Usage: node scripts/smoke-leap.mts [zipPath]
 */
import { readFileSync } from "node:fs";

import { discoverRoots, loadZip, parseSpec } from "../dist/index.js";

const zipPath =
  process.argv[2] ?? "examples/leap-inventory-experience-api-1.1.3-raml.zip";
const vfs = loadZip(new Uint8Array(readFileSync(zipPath)));

const roots = discoverRoots(vfs);
console.log("files in vfs:", vfs.paths.length);
console.log("root candidates:", roots);

for (const root of roots) {
  const spec = parseSpec(vfs, root);
  console.log(`\n=== ${root} ===`);
  console.log("apiInfo:", {
    title: spec.apiInfo.title,
    version: spec.apiInfo.version,
    baseUri: spec.apiInfo.baseUri,
    mediaType: spec.apiInfo.mediaType,
    protocols: spec.apiInfo.protocols,
    docCount: spec.apiInfo.documentation.length,
    schemes: Object.keys(spec.apiInfo.securitySchemes),
  });

  for (const ep of spec.endpoints) {
    const params = ep.parameters
      .map((p) => `${p.location}:${p.name}`)
      .join(", ");
    const resps = ep.responses
      .map((r) => `${r.statusCode}${r.body ? `(${r.body.contentType})` : ""}`)
      .join(", ");
    console.log(
      `  ${ep.method} ${ep.path}` +
        ` | params=[${params}]` +
        ` | resp=[${resps}]` +
        ` | body=${ep.requestBody ? ep.requestBody.type : "-"}` +
        ` | sec=[${ep.securitySchemeIds.join(",")}]` +
        ` | reqs=${ep.requirements.length}`,
    );
  }
  console.log("endpoints:", spec.endpoints.length);
  console.log(
    "requirements:",
    spec.requirements.map((r) => `${r.reqType}:${r.reqId}@${r.scope}`),
  );
  console.log(
    "req sources:",
    spec.requirements.map((r) => r.source?.file ?? "(inline)"),
  );

  const byCode = new Map<string, number>();
  for (const d of spec.diagnostics) {
    byCode.set(d.code, (byCode.get(d.code) ?? 0) + 1);
  }
  console.log("diagnostics:", Object.fromEntries(byCode));
}
