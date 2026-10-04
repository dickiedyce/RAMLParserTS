import { describe, expect, it } from "vitest";

import { RamlParseError } from "../src/errors.js";
import { createVfs, normalizePath, resolveIncludePath } from "../src/vfs.js";

describe("normalizePath", () => {
  it("strips leading slashes and resolves . and .. segments", () => {
    expect(normalizePath("/a/b.raml")).toBe("a/b.raml");
    expect(normalizePath("a/./b.raml")).toBe("a/b.raml");
    expect(normalizePath("a/x/../b.raml")).toBe("a/b.raml");
    expect(normalizePath("a//b.raml")).toBe("a/b.raml");
  });

  it("keeps unresolved leading .. segments", () => {
    expect(normalizePath("../x.raml")).toBe("../x.raml");
    expect(normalizePath("a/../../x.raml")).toBe("../x.raml");
  });

  it("normalises backslashes", () => {
    expect(normalizePath("a\\b.raml")).toBe("a/b.raml");
  });
});

describe("resolveIncludePath", () => {
  it("resolves relative includes against the including file's directory", () => {
    expect(resolveIncludePath("api/spec.raml", "fragments/p.raml")).toBe(
      "api/fragments/p.raml",
    );
    expect(resolveIncludePath("spec.raml", "docs/api_doc.raml")).toBe(
      "docs/api_doc.raml",
    );
    expect(resolveIncludePath("a/b/c.raml", "../d.yaml")).toBe("a/d.yaml");
  });

  it("resolves root-relative includes (leading /) against the spec root", () => {
    expect(
      resolveIncludePath("api/deep/spec.raml", "/overview_files/ov.md"),
    ).toBe("overview_files/ov.md");
    expect(resolveIncludePath("spec.raml", "/x.raml")).toBe("x.raml");
  });
});

describe("createVfs", () => {
  it("normalises keys and serves reads", () => {
    const vfs = createVfs([["/a/b.raml", "x: 1"]]);
    expect(vfs.has("a/b.raml")).toBe(true);
    expect(vfs.read("a/b.raml")).toBe("x: 1");
    expect(vfs.paths).toEqual(["a/b.raml"]);
  });

  it("accepts a plain object of paths to content", () => {
    const vfs = createVfs({ "spec.raml": "a: 1" });
    expect(vfs.read("spec.raml")).toBe("a: 1");
  });

  it("throws file-not-found for missing reads", () => {
    const vfs = createVfs([]);
    expect(() => vfs.read("nope.raml")).toThrow(RamlParseError);
    try {
      vfs.read("nope.raml");
    } catch (e) {
      expect(e).toBeInstanceOf(RamlParseError);
      expect((e as RamlParseError).code).toBe("file-not-found");
    }
  });
});
