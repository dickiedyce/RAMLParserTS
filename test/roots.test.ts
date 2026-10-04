import { describe, expect, it } from "vitest";

import { discoverRoots } from "../src/resolve.js";
import { createVfs } from "../src/vfs.js";

describe("discoverRoots", () => {
  it("lists only valid root candidates (fragments and old formats filtered)", () => {
    const vfs = createVfs([
      ["api.raml", "#%RAML 1.0\ntitle: A\n"],
      ["deep/api2.raml", "#%RAML 1.0\ntitle: B\n"],
      ["libs/lib.raml", "#%RAML 1.0 Library\ntypes: {}\n"],
      ["libs/trait.raml", "#%RAML 1.0 Trait\nx: 1\n"],
      ["libs/type.raml", "#%RAML 1.0 ResourceType\nget: {}\n"],
      ["libs/doc.raml", "#%RAML 1.0 DocumentationItem\ntitle: D\ncontent: c\n"],
      ["old.raml", "#%RAML 0.8\ntitle: O\n"],
      [
        "api.yaml",
        'openapi: 3.1.0\ninfo: {title: T, version: "1"}\npaths: {}\n',
      ],
      ["swagger.yaml", 'swagger: "2.0"\ninfo: {title: S}\n'],
      ["readme.md", "# hi\n"],
    ]);
    expect(discoverRoots(vfs)).toEqual([
      "api.raml",
      "api.yaml",
      "deep/api2.raml",
    ]);
  });

  it("returns an empty list when no candidates exist", () => {
    const vfs = createVfs([
      ["libs/lib.raml", "#%RAML 1.0 Library\ntypes: {}\n"],
    ]);
    expect(discoverRoots(vfs)).toEqual([]);
  });
});
