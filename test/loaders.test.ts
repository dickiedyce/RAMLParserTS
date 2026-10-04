import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";

import { entriesFromFileList, loadFiles, loadZip } from "../src/loaders.js";

describe("loadZip", () => {
  it("loads entries with normalised paths", () => {
    const bytes = zipSync({
      "spec.raml": strToU8("#%RAML 1.0\n"),
      "fragments/p.raml": strToU8("x: 1"),
    });
    const vfs = loadZip(bytes);
    expect([...vfs.paths].sort()).toEqual(["fragments/p.raml", "spec.raml"]);
    expect(vfs.read("fragments/p.raml")).toBe("x: 1");
  });

  it("skips directory entries and unsafe (zip-slip) paths", () => {
    const bytes = zipSync({
      "dir/": new Uint8Array(0),
      "../evil.raml": strToU8("bad"),
      "ok.raml": strToU8("good"),
    });
    const vfs = loadZip(bytes);
    expect(vfs.paths).toEqual(["ok.raml"]);
  });
});

describe("loadFiles", () => {
  it("builds a vfs from file entries", async () => {
    const vfs = await loadFiles([
      { path: "spec.raml", text: async () => "a: 1" },
      { path: "sub/one.yaml", text: async () => "b: 2" },
    ]);
    expect(vfs.read("sub/one.yaml")).toBe("b: 2");
    expect([...vfs.paths].sort()).toEqual(["spec.raml", "sub/one.yaml"]);
  });

  it("skips unsafe paths", async () => {
    const vfs = await loadFiles([
      { path: "../x.raml", text: async () => "bad" },
    ]);
    expect(vfs.paths).toEqual([]);
  });
});

describe("entriesFromFileList", () => {
  it("uses webkitRelativePath when present, falling back to name", () => {
    const plain = new File(["a: 1"], "spec.raml");
    const nested = new File(["b: 2"], "one.yaml");
    Object.defineProperty(nested, "webkitRelativePath", {
      value: "sub/one.yaml",
    });
    expect(entriesFromFileList([plain, nested]).map((e) => e.path)).toEqual([
      "spec.raml",
      "sub/one.yaml",
    ]);
  });
});
