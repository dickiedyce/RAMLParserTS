import { describe, expect, it } from "vitest";

import { resolveSpec } from "../src/resolve.js";
import { createVfs } from "../src/vfs.js";

const OAS = 'openapi: 3.0.3\ninfo: {title: T, version: "1"}\n';

describe("OpenAPI $ref resolution", () => {
  it("resolves internal component refs", () => {
    const vfs = createVfs([
      [
        "api.yaml",
        OAS +
          "paths:\n" +
          "  /ping:\n" +
          "    get:\n" +
          "      parameters:\n" +
          "        - $ref: '#/components/parameters/Limit'\n" +
          "components:\n" +
          "  parameters:\n" +
          "    Limit:\n" +
          "      name: limit\n" +
          "      in: query\n",
      ],
    ]);
    const { tree, diagnostics } = resolveSpec(vfs, "api.yaml");
    const params = (
      ((
        (tree["paths"] as Record<string, unknown>)["/ping"] as Record<
          string,
          unknown
        >
      )["get"] ?? {}) as Record<string, unknown>
    )["parameters"] as unknown[];
    expect(params[0]).toEqual({ name: "limit", in: "query" });
    expect(diagnostics).toEqual([]);
  });

  it("resolves external file refs with JSON pointers", () => {
    const vfs = createVfs([
      [
        "api.yaml",
        OAS +
          "paths:\n" +
          "  /ping:\n" +
          "    get:\n" +
          "      responses:\n" +
          "        '200':\n" +
          "          content:\n" +
          "            application/json:\n" +
          "              schema:\n" +
          "                $ref: 'defs.yaml#/components/schemas/Item'\n",
      ],
      [
        "defs.yaml",
        "components:\n" +
          "  schemas:\n" +
          "    Item:\n" +
          "      type: object\n" +
          "      properties:\n" +
          "        id: {type: string}\n",
      ],
    ]);
    const { tree, diagnostics } = resolveSpec(vfs, "api.yaml");
    const schema = (
      (
        (
          (
            (tree["paths"] as Record<string, unknown>)["/ping"] as Record<
              string,
              unknown
            >
          )["get"] as Record<string, unknown>
        )["responses"] as Record<string, unknown>
      )["200"] as Record<string, unknown>
    )["content"] as Record<string, unknown>;
    expect(
      ((schema["application/json"] as Record<string, unknown>)["schema"] ??
        {}) as Record<string, unknown>,
    ).toEqual({
      type: "object",
      properties: { id: { type: "string" } },
    });
    expect(diagnostics).toEqual([]);
  });

  it("breaks circular refs with a diagnostic instead of recursing forever", () => {
    const vfs = createVfs([
      [
        "api.yaml",
        OAS +
          "paths:\n" +
          "  /node:\n" +
          "    get:\n" +
          "      responses:\n" +
          "        '200':\n" +
          "          content:\n" +
          "            application/json:\n" +
          "              schema:\n" +
          "                $ref: '#/components/schemas/Node'\n" +
          "components:\n" +
          "  schemas:\n" +
          "    Node:\n" +
          "      type: object\n" +
          "      properties:\n" +
          "        next:\n" +
          "          $ref: '#/components/schemas/Node'\n",
      ],
    ]);
    const { tree, diagnostics } = resolveSpec(vfs, "api.yaml");
    const schemas = (tree["components"] as Record<string, unknown>)[
      "schemas"
    ] as Record<string, unknown>;
    const props = ((schemas["Node"] as Record<string, unknown>)["properties"] ??
      {}) as Record<string, unknown>;
    // The inner circular ref stays as a $ref node...
    expect(props["next"]).toEqual({ $ref: "#/components/schemas/Node" });
    // ...and the outer ref still expanded the schema once.
    expect((schemas["Node"] as Record<string, unknown>)["type"]).toBe("object");
    expect(diagnostics).toContainEqual(
      expect.objectContaining({ code: "ref-cycle" }),
    );
  });

  it("resolves refs appearing at any depth", () => {
    const vfs = createVfs([
      [
        "api.yaml",
        OAS +
          "paths:\n" +
          "  /a:\n" +
          "    get:\n" +
          "      responses:\n" +
          "        '200':\n" +
          "          $ref: '#/components/responses/Ok'\n" +
          "components:\n" +
          "  responses:\n" +
          "    Ok:\n" +
          "      description: fine\n",
      ],
    ]);
    const { tree } = resolveSpec(vfs, "api.yaml");
    const responses = (
      ((
        (tree["paths"] as Record<string, unknown>)["/a"] as Record<
          string,
          unknown
        >
      )["get"] ?? {}) as Record<string, unknown>
    )["responses"] as Record<string, unknown>;
    expect(responses["200"]).toEqual({ description: "fine" });
  });
});
