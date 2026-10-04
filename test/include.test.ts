import { describe, expect, it } from "vitest";

import { RamlParseError } from "../src/errors.js";
import { loadSpecTree } from "../src/include.js";
import { createVfs } from "../src/vfs.js";

describe("loadSpecTree", () => {
  it("resolves YAML includes into the tree", () => {
    const vfs = createVfs([
      ["spec.raml", "title: T\nfrag: !include fragments/frag.yaml\n"],
      ["fragments/frag.yaml", "a: 1\nb: 2\n"],
    ]);
    const { value, diagnostics } = loadSpecTree(vfs, "spec.raml");
    expect(value).toEqual({ title: "T", frag: { a: 1, b: 2 } });
    expect(diagnostics).toEqual([]);
  });

  it("returns plain-text includes as raw strings", () => {
    const vfs = createVfs([
      ["spec.raml", "description: !include docs/ov.md\n"],
      ["docs/ov.md", "# Hello\n\nSome prose.\n"],
    ]);
    const { value } = loadSpecTree(vfs, "spec.raml");
    expect(value).toEqual({ description: "# Hello\n\nSome prose.\n" });
  });

  it("parses JSON includes as objects", () => {
    const vfs = createVfs([
      ["spec.raml", "example: !include examples/x.json\n"],
      ["examples/x.json", '{"k": [1, 2]}'],
    ]);
    const { value } = loadSpecTree(vfs, "spec.raml");
    expect(value).toEqual({ example: { k: [1, 2] } });
  });

  it("resolves root-relative includes against the spec root", () => {
    const vfs = createVfs([
      ["api/spec.raml", "description: !include /overview_files/ov.md\n"],
      ["overview_files/ov.md", "prose"],
    ]);
    const { value, diagnostics } = loadSpecTree(vfs, "api/spec.raml");
    expect(value).toEqual({ description: "prose" });
    expect(diagnostics).toEqual([]);
  });

  it("resolves nested includes relative to the including file", () => {
    const vfs = createVfs([
      ["api/spec.raml", "f: !include fragments/f.yaml\n"],
      ["api/fragments/f.yaml", "inner: !include inner.yaml\n"],
      ["api/fragments/inner.yaml", "v: 42\n"],
    ]);
    const { value, diagnostics } = loadSpecTree(vfs, "api/spec.raml");
    expect(value).toEqual({ f: { inner: { v: 42 } } });
    expect(diagnostics).toEqual([]);
  });

  it("resolves includes inside sequences", () => {
    const vfs = createVfs([
      ["spec.raml", "list:\n  - !include one.yaml\n  - two\n"],
      ["one.yaml", "k: 1\n"],
    ]);
    const { value } = loadSpecTree(vfs, "spec.raml");
    expect(value).toEqual({ list: [{ k: 1 }, "two"] });
  });

  it("replaces missing includes with a placeholder and records a diagnostic", () => {
    const vfs = createVfs([
      ["spec.raml", "title: T\nx: !include missing.yaml\n"],
    ]);
    const { value, diagnostics } = loadSpecTree(vfs, "spec.raml");
    expect(value).toEqual({
      title: "T",
      x: "[Include not found: missing.yaml]",
    });
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({
      code: "include-not-found",
      severity: "error",
      path: "spec.raml",
      line: 2,
      includePath: "missing.yaml",
    });
  });

  it("breaks circular includes with a placeholder and diagnostic", () => {
    const vfs = createVfs([
      ["a.raml", "x: !include b.yaml\n"],
      ["b.yaml", "y: !include a.raml\n"],
    ]);
    const { value, diagnostics } = loadSpecTree(vfs, "a.raml");
    expect(value).toEqual({ x: { y: "[Include cycle: a.raml]" } });
    expect(diagnostics[0]).toMatchObject({
      code: "include-cycle",
      includePath: "a.raml",
    });
  });

  it("replaces unparseable includes with a placeholder and diagnostic", () => {
    const vfs = createVfs([
      ["spec.raml", "x: !include bad.yaml\n"],
      ["bad.yaml", "a: [1, 2\n"],
    ]);
    const { value, diagnostics } = loadSpecTree(vfs, "spec.raml");
    expect(value).toEqual({ x: "[Include error: bad.yaml]" });
    expect(diagnostics[0]).toMatchObject({
      code: "include-error",
      includePath: "bad.yaml",
    });
  });

  it("falls back to root-relative resolution with a warning diagnostic", () => {
    // MuleSoft exports write root-relative includes without a leading "/".
    const vfs = createVfs([
      ["api.raml", "x: !include libs/frag.yaml\n"],
      ["libs/frag.yaml", "inner: !include exchange_modules/mods/deep.yaml\n"],
      ["exchange_modules/mods/deep.yaml", "v: 1\n"],
    ]);
    const { value, diagnostics } = loadSpecTree(vfs, "api.raml");
    expect(value).toEqual({ x: { inner: { v: 1 } } });
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({
      code: "include-fallback",
      severity: "warning",
      path: "libs/frag.yaml",
    });
  });

  it("throws file-not-found when the root file is missing", () => {
    const vfs = createVfs([]);
    expect(() => loadSpecTree(vfs, "spec.raml")).toThrow(RamlParseError);
    try {
      loadSpecTree(vfs, "spec.raml");
    } catch (e) {
      expect((e as RamlParseError).code).toBe("file-not-found");
    }
  });

  it("throws invalid-yaml when the root file does not parse", () => {
    const vfs = createVfs([["spec.raml", "a: [1, 2"]]);
    try {
      loadSpecTree(vfs, "spec.raml");
      expect.unreachable("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(RamlParseError);
      expect((e as RamlParseError).code).toBe("invalid-yaml");
      expect((e as RamlParseError).details?.path).toBe("spec.raml");
      expect((e as RamlParseError).details?.line).toBe(1);
    }
  });
});
