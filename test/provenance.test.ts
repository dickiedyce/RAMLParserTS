/**
 * Key-level provenance (DESIGN.md §18): extraction attributes every model
 * entity to the source line of its own key, including keys contributed by
 * traits, resource types and library files.
 */
import { describe, expect, it } from "vitest";

import { parseSpec } from "../src/parse.js";
import { createVfs } from "../src/vfs.js";

const HEADER = "#%RAML 1.0\n";

describe("provenance", () => {
  it("records the format and the source line of each entity's own key", () => {
    const vfs = createVfs([
      [
        "api.raml",
        HEADER +
          "title: T\n" + // 2
          "/ping:\n" + // 3
          "  get:\n" + // 4
          "    description: Ping\n" + // 5
          "    queryParameters:\n" + // 6
          "      q:\n" + // 7
          "        description: Q\n" + // 8
          "      r: string\n" + // 9
          "    responses:\n" + // 10
          "      200:\n" + // 11
          "        description: OK\n", // 12
      ],
    ]);
    const spec = parseSpec(vfs, "api.raml");
    expect(spec.format).toBe("raml1");
    expect(spec.apiInfo.source).toEqual({ file: "api.raml", line: 2 });
    const endpoint = spec.endpoints[0];
    expect(endpoint?.source).toEqual({ file: "api.raml", line: 4 });
    expect(endpoint?.parameters[0]?.source).toEqual({
      file: "api.raml",
      line: 7,
    });
    // A bare-type parameter has no node of its own: its key line is used.
    expect(endpoint?.parameters[1]?.source).toEqual({
      file: "api.raml",
      line: 9,
    });
    expect(endpoint?.responses[0]?.source).toEqual({
      file: "api.raml",
      line: 11,
    });
  });

  it("attributes resource-type contributions to the library file", () => {
    const vfs = createVfs([
      [
        "api.raml",
        HEADER +
          "title: T\n" + // 2
          "uses:\n" + // 3
          "  lib: libs/lib.raml\n" + // 4
          "/status:\n" + // 5
          "  type: lib.collection\n", // 6
      ],
      [
        "libs/lib.raml",
        "#%RAML 1.0 Library\n" +
          "resourceTypes:\n" + // 2
          "  collection:\n" + // 3
          "    get:\n" + // 4
          "      description: Lists records.\n" + // 5
          "      queryParameters:\n" + // 6
          "        limit:\n" + // 7
          "          type: integer\n", // 8
      ],
    ]);
    const spec = parseSpec(vfs, "api.raml");
    const endpoint = spec.endpoints[0];
    expect(endpoint?.method).toBe("GET");
    expect(endpoint?.source).toEqual({ file: "libs/lib.raml", line: 4 });
    expect(endpoint?.parameters[0]?.source).toEqual({
      file: "libs/lib.raml",
      line: 7,
    });
  });

  it("attributes trait contributions to the library file", () => {
    const vfs = createVfs([
      [
        "api.raml",
        HEADER +
          "title: T\n" + // 2
          "uses:\n" + // 3
          "  lib: libs/lib.raml\n" + // 4
          "/ping:\n" + // 5
          "  get:\n" + // 6
          "    description: Ping\n" + // 7
          "    is: [ lib.hasQ ]\n", // 8
      ],
      [
        "libs/lib.raml",
        "#%RAML 1.0 Library\n" +
          "traits:\n" + // 2
          "  hasQ:\n" + // 3
          "    queryParameters:\n" + // 4
          "      q:\n" + // 5
          "        description: Q\n", // 6
      ],
    ]);
    const spec = parseSpec(vfs, "api.raml");
    const endpoint = spec.endpoints[0];
    expect(endpoint?.source).toEqual({ file: "api.raml", line: 6 });
    expect(endpoint?.parameters[0]?.source).toEqual({
      file: "libs/lib.raml",
      line: 5,
    });
  });

  it("attributes OpenAPI entities to their keys in YAML documents", () => {
    const vfs = createVfs([
      [
        "openapi.yaml",
        "openapi: 3.0.0\n" + // 1
          "info:\n" + // 2
          "  title: T\n" + // 3
          '  version: "1"\n' + // 4
          "paths:\n" + // 5
          "  /ping:\n" + // 6
          "    get:\n" + // 7
          "      description: Ping\n" + // 8
          "      parameters:\n" + // 9
          "        - name: q\n" + // 10
          "          in: query\n" + // 11
          "          description: Q\n" + // 12
          "      responses:\n" + // 13
          '        "200":\n' + // 14
          "          description: OK\n", // 15
      ],
    ]);
    const spec = parseSpec(vfs, "openapi.yaml");
    expect(spec.format).toBe("openapi3");
    expect(spec.apiInfo.source).toEqual({ file: "openapi.yaml", line: 3 });
    const endpoint = spec.endpoints[0];
    expect(endpoint?.source).toEqual({ file: "openapi.yaml", line: 7 });
    expect(endpoint?.parameters[0]?.source).toEqual({
      file: "openapi.yaml",
      line: 10,
    });
    expect(endpoint?.responses[0]?.source).toEqual({
      file: "openapi.yaml",
      line: 14,
    });
  });

  it("attributes OpenAPI entities to their keys in JSON documents", () => {
    const vfs = createVfs([
      [
        "openapi.json",
        "{\n" + // 1
          '  "openapi": "3.0.0",\n' + // 2
          '  "info": { "title": "T", "version": "1" },\n' + // 3
          '  "paths": {\n' + // 4
          '    "/ping": {\n' + // 5
          '      "get": {\n' + // 6
          '        "description": "Ping",\n' + // 7
          '        "responses": { "200": { "description": "OK" } }\n' + // 8
          "      }\n" + // 9
          "    }\n" + // 10
          "  }\n" + // 11
          "}\n", // 12
      ],
    ]);
    const spec = parseSpec(vfs, "openapi.json");
    expect(spec.format).toBe("openapi3");
    expect(spec.apiInfo.source).toEqual({ file: "openapi.json", line: 3 });
    const endpoint = spec.endpoints[0];
    expect(endpoint?.source).toEqual({ file: "openapi.json", line: 6 });
    expect(endpoint?.responses[0]?.source).toEqual({
      file: "openapi.json",
      line: 8,
    });
  });
});
