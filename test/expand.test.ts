import { describe, expect, it } from "vitest";

import { resolveSpec } from "../src/resolve.js";
import { createVfs } from "../src/vfs.js";

const HEADER = "#%RAML 1.0\n";

describe("RAML expansion", () => {
  it("merges a simple trait into the method and consumes is:", () => {
    const vfs = createVfs([
      [
        "api.raml",
        HEADER +
          "traits:\n" +
          "  deprecated:\n" +
          "    description: Old endpoint\n" +
          "/ping:\n" +
          "  get:\n" +
          "    is: [deprecated]\n" +
          "    displayName: Ping\n",
      ],
    ]);
    const { tree } = resolveSpec(vfs, "api.raml");
    const get = ((tree["/ping"] as Record<string, unknown>)["get"] ??
      {}) as Record<string, unknown>;
    expect(get["description"]).toBe("Old endpoint");
    expect(get["displayName"]).toBe("Ping");
    expect(get["is"]).toBeUndefined();
  });

  it("substitutes parameters, including object-valued nodes and mapping keys", () => {
    const vfs = createVfs([
      [
        "api.raml",
        HEADER +
          "traits:\n" +
          "  resp:\n" +
          "    responses:\n" +
          "      201:\n" +
          "        body:\n" +
          "          <<responseType>>:\n" +
          "            type: <<recordType>>\n" +
          "            example: <<recordExample>>\n" +
          "/ping:\n" +
          "  post:\n" +
          "    is:\n" +
          "      - resp:\n" +
          "          responseType: application/json\n" +
          "          recordType: commonOutputDataType\n" +
          "          recordExample:\n" +
          "            message: ok\n",
      ],
    ]);
    const { tree, diagnostics } = resolveSpec(vfs, "api.raml");
    const post = ((tree["/ping"] as Record<string, unknown>)["post"] ??
      {}) as Record<string, unknown>;
    const body = ((
      (post["responses"] as Record<string, unknown>)["201"] as Record<
        string,
        unknown
      >
    )["body"] ?? {}) as Record<string, unknown>;
    expect(body["application/json"]).toEqual({
      type: "commonOutputDataType",
      example: { message: "ok" },
    });
    expect(diagnostics).toEqual([]);
  });

  it("interpolates embedded placeholders and falls back to defaults", () => {
    const vfs = createVfs([
      [
        "api.raml",
        HEADER +
          "traits:\n" +
          "  note:\n" +
          "    description: Returns <<name>> data (see <<doc | none>>)\n" +
          "/ping:\n" +
          "  get:\n" +
          "    is:\n" +
          "      - note:\n" +
          "          name: sample\n",
      ],
    ]);
    const { tree } = resolveSpec(vfs, "api.raml");
    const get = ((tree["/ping"] as Record<string, unknown>)["get"] ??
      {}) as Record<string, unknown>;
    expect(get["description"]).toBe("Returns sample data (see none)");
  });

  it("leaves unresolved placeholders and records a diagnostic", () => {
    const vfs = createVfs([
      [
        "api.raml",
        HEADER +
          "traits:\n" +
          "  note:\n" +
          "    description: Has <<missing>> inside\n" +
          "/ping:\n" +
          "  get:\n" +
          "    is: [note]\n",
      ],
    ]);
    const { tree, diagnostics } = resolveSpec(vfs, "api.raml");
    const get = ((tree["/ping"] as Record<string, unknown>)["get"] ??
      {}) as Record<string, unknown>;
    expect(get["description"]).toBe("Has <<missing>> inside");
    expect(diagnostics).toContainEqual(
      expect.objectContaining({ code: "missing-parameter" }),
    );
  });

  it("applies resource-level is: to every method", () => {
    const vfs = createVfs([
      [
        "api.raml",
        HEADER +
          "traits:\n" +
          "  tagged:\n" +
          "    description: Tagged\n" +
          "/res:\n" +
          "  is: [tagged]\n" +
          "  get:\n" +
          "    displayName: G\n" +
          "  post:\n" +
          "    displayName: P\n",
      ],
    ]);
    const { tree } = resolveSpec(vfs, "api.raml");
    const res = tree["/res"] as Record<string, unknown>;
    expect((res["get"] as Record<string, unknown>)["description"]).toBe(
      "Tagged",
    );
    expect((res["post"] as Record<string, unknown>)["description"]).toBe(
      "Tagged",
    );
    expect(res["is"]).toBeUndefined();
  });

  it("expands parameterised resource types, with implicit method/path params", () => {
    const vfs = createVfs([
      [
        "api.raml",
        HEADER +
          "resourceTypes:\n" +
          "  check:\n" +
          "    get:\n" +
          "      displayName: Check\n" +
          "      description: Health of <<resourcePathName>> via <<methodName>>\n" +
          "/ping:\n" +
          "  type: check\n",
      ],
    ]);
    const { tree } = resolveSpec(vfs, "api.raml");
    const res = tree["/ping"] as Record<string, unknown>;
    const get = (res["get"] ?? {}) as Record<string, unknown>;
    expect(get["displayName"]).toBe("Check");
    expect(get["description"]).toBe("Health of ping via get");
    expect(res["type"]).toBeUndefined();
  });

  it("resolves namespaced traits and resource types via uses:", () => {
    const vfs = createVfs([
      [
        "api.raml",
        HEADER +
          "uses:\n" +
          "  Lib: libs/lib.raml\n" +
          "  resourceMethods: libs/rt.raml\n" +
          "/:\n" +
          "  type:\n" +
          "    resourceMethods.check:\n" +
          "      recordExample:\n" +
          "        status: up\n" +
          "/ping:\n" +
          "  get:\n" +
          "    is: [Lib.tagged]\n",
      ],
      [
        "libs/lib.raml",
        "#%RAML 1.0 Library\n" +
          "traits:\n" +
          "  tagged:\n" +
          "    description: From lib\n",
      ],
      [
        "libs/rt.raml",
        "#%RAML 1.0 Library\n" +
          "resourceTypes:\n" +
          "  check:\n" +
          "    get:\n" +
          "      responses:\n" +
          "        200:\n" +
          "          body:\n" +
          "            application/json:\n" +
          "              example: <<recordExample>>\n",
      ],
    ]);
    const { tree, diagnostics } = resolveSpec(vfs, "api.raml");
    const ping = tree["/ping"] as Record<string, unknown>;
    expect((ping["get"] as Record<string, unknown>)["description"]).toBe(
      "From lib",
    );
    const root = tree["/"] as Record<string, unknown>;
    const body = (
      (
        ((root["get"] ?? {}) as Record<string, unknown>)["responses"] as Record<
          string,
          unknown
        >
      )["200"] as Record<string, unknown>
    )["body"] as Record<string, unknown>;
    expect(
      (body["application/json"] as Record<string, unknown>)["example"],
    ).toEqual({
      status: "up",
    });
    expect(diagnostics).toEqual([]);
    // uses: values are inlined library trees, not paths
    expect(typeof tree["uses"]).toBe("object");
  });

  it("gives method traits precedence over resource traits and resource types", () => {
    const vfs = createVfs([
      [
        "api.raml",
        HEADER +
          "traits:\n" +
          "  fromMethod:\n" +
          "    description: method-level\n" +
          "  fromResource:\n" +
          "    description: resource-level\n" +
          "resourceTypes:\n" +
          "  rt:\n" +
          "    get:\n" +
          "      description: type-level\n" +
          "      displayName: from type\n" +
          "/p:\n" +
          "  type: rt\n" +
          "  is: [fromResource]\n" +
          "  get:\n" +
          "    is: [fromMethod]\n",
      ],
    ]);
    const { tree } = resolveSpec(vfs, "api.raml");
    const get = ((tree["/p"] as Record<string, unknown>)["get"] ??
      {}) as Record<string, unknown>;
    expect(get["description"]).toBe("method-level");
    expect(get["displayName"]).toBe("from type");
  });

  it("keeps explicit method properties above everything", () => {
    const vfs = createVfs([
      [
        "api.raml",
        HEADER +
          "traits:\n" +
          "  t:\n" +
          "    description: from trait\n" +
          "    displayName: trait display\n" +
          "/p:\n" +
          "  get:\n" +
          "    is: [t]\n" +
          "    description: explicit\n",
      ],
    ]);
    const { tree } = resolveSpec(vfs, "api.raml");
    const get = ((tree["/p"] as Record<string, unknown>)["get"] ??
      {}) as Record<string, unknown>;
    expect(get["description"]).toBe("explicit");
    expect(get["displayName"]).toBe("trait display");
  });
});
