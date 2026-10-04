import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { describe, expect, it } from "vitest";

import {
  classify,
  diffSpecs,
  formatDelta,
  type AllowlistEntry,
} from "../parity/diff.js";
import { projectToSwift, type SwiftSpec } from "../parity/project.js";
import {
  createVfs,
  discoverRoots,
  parseSpec,
  type ParsedSpec,
} from "../src/index.js";

const allowlist = JSON.parse(
  readFileSync("parity/allowlist.json", "utf8"),
) as AllowlistEntry[];

function walk(dir: string): string[] {
  const files: string[] = [];
  for (const name of readdirSync(dir).sort()) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) files.push(...walk(full));
    else files.push(full);
  }
  return files;
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

function loadFixture(dir: string): ParsedSpec {
  const entries = walk(dir)
    .filter((file) => !file.endsWith("golden.swift.json"))
    .map((file) => {
      const rel = relative(dir, file).split(sep).join("/");
      return [rel, readFileSync(file, "utf8")] as const;
    });
  const vfs = createVfs(entries);
  const roots = discoverRoots(vfs);
  expect(roots).toHaveLength(1);
  return parseSpec(vfs, roots[0] as string);
}

function goldenOf(dir: string): SwiftSpec {
  return JSON.parse(
    readFileSync(join(dir, "golden.swift.json"), "utf8"),
  ) as SwiftSpec;
}

describe("golden parity (TS vs RAMLParserKit)", () => {
  for (const dir of fixtureDirs()) {
    const hasGolden = existsSync(join(dir, "golden.swift.json"));
    const isLocal = dir.split(sep).includes("local");

    it(`${dir.split(sep).join("/")} matches the Swift golden within the allowlist`, () => {
      if (!hasGolden) {
        if (isLocal) {
          // Private corpora are optional; generate goldens locally first.
          console.warn(`skipping ${dir}: run npm run goldens`);
          return;
        }
        throw new Error(
          `missing ${join(dir, "golden.swift.json")} — run npm run goldens`,
        );
      }
      const projected = projectToSwift(loadFixture(dir));
      const deltas = diffSpecs(projected, goldenOf(dir));
      const { unmatched, unused } = classify(deltas, allowlist);
      for (const entry of unused) {
        console.warn(`stale allowlist entry (parity #${entry.parity})`);
      }
      expect(unmatched.map(formatDelta)).toEqual([]);
    });
  }

  it("keeps additive C-hybrid fields out of the Swift projection", () => {
    const dir = "fixtures/leap-style-raml";
    const spec = loadFixture(dir);
    // Additive model fields are present in the TS output...
    const post = spec.endpoints.find((e) => e.method === "POST");
    expect(post?.requestBody?.type).toBe("localDataTypes.item");
    expect(Object.keys(post?.requestBody?.examples ?? {})).toEqual(["example"]);
    const req = spec.requirements.find((r) => r.reqId === "FR-L-01");
    expect(req?.scope).toBe("resource");
    expect(req?.source?.file).toBe("overview_files/ov_items.md");
    expect(post?.securitySchemeIds).toEqual(["clientIdEnforcement"]);
    // ...and stripped by the projection (A1-A9).
    const projected = JSON.stringify(projectToSwift(spec));
    for (const key of [
      "requestBody",
      "resourceDescription",
      "scope",
      "source",
      "baseUri",
      "protocols",
      "mediaType",
      "documentation",
    ]) {
      expect(projected).not.toContain(`"${key}"`);
    }
    expect(projected).not.toContain("securitySchemeIds");
    expect(projected).toContain("schemaType");
  });
});
