import { describe, expect, it } from "vitest";

import { RamlParseError } from "../src/errors.js";

describe("RamlParseError", () => {
  it("is an Error with a code and message", () => {
    const err = new RamlParseError("invalid-yaml", "bad indentation");
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("RamlParseError");
    expect(err.code).toBe("invalid-yaml");
    expect(err.message).toBe("bad indentation");
  });

  it("carries optional structured details", () => {
    const err = new RamlParseError("file-not-found", "missing", {
      path: "/x/y.raml",
      line: 3,
    });
    expect(err.details).toEqual({ path: "/x/y.raml", line: 3 });
  });

  it("formats as [code] message", () => {
    const err = new RamlParseError("unsupported-format", "Swagger 2.0");
    expect(String(err)).toContain("unsupported-format");
    expect(String(err)).toContain("Swagger 2.0");
  });
});
