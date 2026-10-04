import { describe, expect, it } from "vitest";

import { RamlParseError } from "../src/errors.js";
import { resolveSpec } from "../src/resolve.js";
import { createVfs } from "../src/vfs.js";

describe("resolveSpec format detection", () => {
  it("accepts a RAML 1.0 root", () => {
    const vfs = createVfs([["api.raml", "#%RAML 1.0\ntitle: T\n"]]);
    const spec = resolveSpec(vfs, "api.raml");
    expect(spec.format).toBe("raml1");
    expect(spec.tree).toMatchObject({ title: "T" });
    expect(spec.diagnostics).toEqual([]);
  });

  it("rejects RAML 0.8 loudly", () => {
    const vfs = createVfs([["api.raml", "#%RAML 0.8\ntitle: T\n"]]);
    try {
      resolveSpec(vfs, "api.raml");
      expect.unreachable("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(RamlParseError);
      expect((e as RamlParseError).code).toBe("unsupported-format");
      expect((e as RamlParseError).message).toContain("RAML 0.8");
    }
  });

  it("rejects Swagger 2.0 loudly", () => {
    const vfs = createVfs([
      ["api.yaml", 'swagger: "2.0"\ninfo:\n  title: T\n'],
    ]);
    try {
      resolveSpec(vfs, "api.yaml");
      expect.unreachable("should have thrown");
    } catch (e) {
      expect((e as RamlParseError).code).toBe("unsupported-format");
      expect((e as RamlParseError).message).toContain("Swagger");
    }
  });

  it("rejects unknown OpenAPI major versions loudly", () => {
    const vfs = createVfs([["api.yaml", "openapi: 4.0.0\ninfo: {}\n"]]);
    try {
      resolveSpec(vfs, "api.yaml");
      expect.unreachable("should have thrown");
    } catch (e) {
      expect((e as RamlParseError).code).toBe("unsupported-format");
      expect((e as RamlParseError).message).toContain("OpenAPI");
    }
  });

  it("accepts OpenAPI 3.x", () => {
    const vfs = createVfs([
      [
        "api.yaml",
        'openapi: 3.0.3\ninfo: {title: T, version: "1"}\npaths: {}\n',
      ],
    ]);
    const spec = resolveSpec(vfs, "api.yaml");
    expect(spec.format).toBe("openapi3");
    expect(spec.diagnostics).toEqual([]);
  });

  it("assumes RAML for headerless docs, with a warning diagnostic", () => {
    const vfs = createVfs([
      ["api.yaml", "title: T\n/foo:\n  get:\n    displayName: G\n"],
    ]);
    const spec = resolveSpec(vfs, "api.yaml");
    expect(spec.format).toBe("raml1");
    expect(spec.diagnostics).toHaveLength(1);
    expect(spec.diagnostics[0]).toMatchObject({
      code: "missing-raml-header",
      severity: "warning",
    });
  });
});
