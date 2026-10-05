import { describe, expect, it } from "vitest";

import { parseSpec } from "../src/parse.js";
import { createVfs } from "../src/vfs.js";

const HEADER = "#%RAML 1.0\n";

describe("RAML extraction", () => {
  it("extracts APIInfo from top-level keys", () => {
    const vfs = createVfs([
      [
        "api.raml",
        HEADER +
          "title: Test API\n" +
          "version: v1\n" +
          "description: A test API\n" +
          "baseUri: https://api.example.com\n" +
          "protocols: [ HTTPS ]\n" +
          "mediaType: application/json\n" +
          "documentation:\n" +
          "  - title: Guide\n" +
          "    content: Welcome\n" +
          "/ping:\n" +
          "  get:\n" +
          "    description: Ping\n",
      ],
    ]);
    const spec = parseSpec(vfs, "api.raml");
    expect(spec.apiInfo).toMatchObject({
      title: "Test API",
      version: "v1",
      description: "A test API",
      baseUri: "https://api.example.com",
      protocols: ["HTTPS"],
      mediaType: "application/json",
      documentation: [{ title: "Guide", content: "Welcome" }],
    });
  });

  it("extracts endpoints with path, uppercase method, summary and descriptions", () => {
    const vfs = createVfs([
      [
        "api.raml",
        HEADER +
          "title: T\n" +
          "/ping:\n" +
          "  description: Ping resource\n" +
          "  get:\n" +
          "    displayName: Ping it\n" +
          "    description: Do ping\n",
      ],
    ]);
    const spec = parseSpec(vfs, "api.raml");
    expect(spec.endpoints).toHaveLength(1);
    expect(spec.endpoints[0]).toMatchObject({
      path: "/ping",
      method: "GET",
      summary: "Ping it",
      description: "Do ping",
      resourceDescription: "Ping resource",
    });
  });

  it("builds path params from the resource node and query params from the method", () => {
    const vfs = createVfs([
      [
        "api.raml",
        HEADER +
          "title: T\n" +
          "/ping/{id}:\n" +
          "  uriParameters:\n" +
          "    id:\n" +
          "      type: string\n" +
          "      description: The id\n" +
          "      example: abc\n" +
          "  get:\n" +
          "    queryParameters:\n" +
          "      q:\n" +
          "        type: string\n" +
          "        required: true\n" +
          "        example: hello\n" +
          "      opt:\n" +
          "        type: integer\n" +
          "        minimum: 1\n" +
          "        maximum: 10\n",
      ],
    ]);
    const spec = parseSpec(vfs, "api.raml");
    const params = spec.endpoints[0]?.parameters ?? [];
    const byName = Object.fromEntries(params.map((p) => [p.name, p]));
    expect(byName["id"]).toMatchObject({
      location: "path",
      required: true,
      type: "string",
      description: "The id",
      example: "abc",
    });
    expect(byName["q"]).toMatchObject({
      location: "query",
      required: true,
      example: "hello",
    });
    // queryParameters required defaults to false (PARITY #2)
    expect(byName["opt"]).toMatchObject({
      location: "query",
      required: false,
      type: "integer",
      minimum: 1,
      maximum: 10,
    });
  });

  it("extracts request body and response bodies with examples", () => {
    const vfs = createVfs([
      [
        "api.raml",
        HEADER +
          "title: T\n" +
          "mediaType: application/json\n" +
          "/ping:\n" +
          "  post:\n" +
          "    body:\n" +
          "      type: PingRequest\n" +
          "      examples:\n" +
          "        One:\n" +
          "          msg: hi\n" +
          "    responses:\n" +
          "      201:\n" +
          "        description: Created\n" +
          "        body:\n" +
          "          application/json:\n" +
          "            type: PingResponse\n" +
          "            example:\n" +
          "              msg: created\n",
      ],
    ]);
    const spec = parseSpec(vfs, "api.raml");
    const post = spec.endpoints[0];
    expect(post?.requestBody).toEqual({
      contentType: "application/json",
      type: "PingRequest",
      examples: { One: { msg: "hi" } },
      source: { file: "api.raml", line: 6 },
    });
    expect(post?.responses).toEqual([
      {
        statusCode: "201",
        description: "Created",
        source: { file: "api.raml", line: 12 },
        body: {
          contentType: "application/json",
          type: "PingResponse",
          examples: { example: { msg: "created" } },
        },
      },
    ]);
  });

  it("collects security schemes and resolves securedBy inheritance", () => {
    const vfs = createVfs([
      [
        "api.raml",
        HEADER +
          "title: T\n" +
          "securedBy: [ sec.clientId ]\n" +
          "uses:\n" +
          "  sec:\n" +
          "    securitySchemes:\n" +
          "      clientId:\n" +
          "        type: Client ID Enforcement\n" +
          "        description: Needs a client id\n" +
          "/a:\n" +
          "  get:\n" +
          "    description: inherits\n" +
          "/b:\n" +
          "  get:\n" +
          "    securedBy: [ null ]\n" +
          "    description: public\n",
      ],
    ]);
    const spec = parseSpec(vfs, "api.raml");
    expect(spec.apiInfo.securitySchemes["clientId"]).toEqual({
      type: "Client ID Enforcement",
      description: "Needs a client id",
      source: { file: "api.raml", line: 7 },
    });
    const byPath = Object.fromEntries(spec.endpoints.map((e) => [e.path, e]));
    expect(byPath["/a"]?.securitySchemeIds).toEqual(["clientId"]);
    expect(byPath["/b"]?.securitySchemeIds).toEqual(["anonymous"]);
  });
});

describe("requirement sourcing", () => {
  it("extracts resource- and method-scope requirements with provenance", () => {
    const table = [
      "### Functional Requirements:",
      "",
      "| # | Use Case | Detailed Description | Acceptance Criteria Description |",
      "| --- | --- | --- | --- |",
      "| FR-S-G-01 | UC-01 | Get firewall flag | Returns flag |",
      "",
    ].join("\n");
    const vfs = createVfs([
      [
        "api.raml",
        HEADER +
          "title: T\n" +
          "/trials:\n" +
          "  description: !include /overview_files/ov.md\n" +
          "  post:\n" +
          "    description: !include /overview_files/ovm.md\n",
      ],
      ["overview_files/ov.md", table],
      ["overview_files/ovm.md", table.replace("FR-S-G-01", "FR-M-01")],
    ]);
    const spec = parseSpec(vfs, "api.raml");
    const endpoint = spec.endpoints[0];
    // Both resource- and method-scope requirements are visible on the method.
    expect(endpoint?.requirements.map((r) => [r.reqId, r.scope])).toEqual([
      ["FR-S-G-01", "resource"],
      ["FR-M-01", "method"],
    ]);
    expect(endpoint?.requirements[0]?.source).toEqual({
      file: "overview_files/ov.md",
      line: 5,
    });
    // The flat list holds each requirement once.
    expect(spec.requirements).toHaveLength(2);
    expect(spec.requirements[0]?.scope).toBe("resource");
    expect(spec.requirements[1]?.scope).toBe("method");
  });

  it("carries table diagnostics with provenance", () => {
    const vfs = createVfs([
      [
        "api.raml",
        HEADER + "title: T\n" + "/t:\n" + "  description: !include /ov.md\n",
      ],
      [
        "ov.md",
        [
          "### Functional Requirements:",
          "",
          "| # | Use Case | Detailed Description | Acceptance Criteria Description |",
          "| --- | --- | --- | --- |",
          "| FR-1 | UC |",
          "",
        ].join("\n"),
      ],
    ]);
    const spec = parseSpec(vfs, "api.raml");
    const diag = spec.diagnostics.find(
      (d) => d.code === "requirement-row-short",
    );
    expect(diag).toMatchObject({ path: "ov.md", line: 5 });
    expect(spec.requirements).toEqual([]);
  });
});

describe("OpenAPI extraction", () => {
  const oas = JSON.stringify({
    openapi: "3.0.0",
    info: { title: "OAS API", version: "2.0", description: "An OAS test" },
    servers: [{ url: "https://oas.example.com/v2" }],
    security: [{ apiKey: [] }],
    paths: {
      "/items/{itemId}": {
        parameters: [
          {
            name: "itemId",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Item id",
          },
        ],
        get: {
          summary: "Get item",
          description: "Fetch one item",
          parameters: [
            {
              name: "verbose",
              in: "query",
              schema: { type: "boolean", example: true },
            },
          ],
          responses: {
            "200": {
              description: "OK",
              content: {
                "application/json": {
                  schema: { type: "object" },
                  example: { id: "1" },
                },
              },
            },
          },
        },
        post: {
          summary: "Create item",
          requestBody: {
            content: {
              "application/json": {
                schema: { type: "object" },
                examples: { Sample: { value: { id: "2" } } },
              },
            },
          },
          responses: { "201": { description: "Created" } },
          security: [],
        },
      },
    },
    components: {
      securitySchemes: {
        apiKey: { type: "apiKey", description: "API key auth" },
      },
    },
  });

  it("extracts APIInfo, endpoints, params, bodies and security", () => {
    const vfs = createVfs([["openapi.json", oas]]);
    const spec = parseSpec(vfs, "openapi.json");
    expect(spec.apiInfo).toMatchObject({
      title: "OAS API",
      version: "2.0",
      description: "An OAS test",
      baseUri: "https://oas.example.com/v2",
      protocols: ["https"],
    });
    expect(spec.apiInfo.securitySchemes["apiKey"]).toEqual({
      type: "apiKey",
      description: "API key auth",
      source: { file: "openapi.json", line: 1 },
    });

    const byKey = Object.fromEntries(
      spec.endpoints.map((e) => [`${e.method} ${e.path}`, e]),
    );
    const get = byKey["GET /items/{itemId}"];
    expect(get?.summary).toBe("Get item");
    expect(get?.description).toBe("Fetch one item");
    expect(
      get?.parameters.map((p) => [p.name, p.location, p.required]),
    ).toEqual([
      ["itemId", "path", true],
      ["verbose", "query", false],
    ]);
    expect(get?.securitySchemeIds).toEqual(["apiKey"]);
    expect(get?.responses[0]).toEqual({
      statusCode: "200",
      description: "OK",
      source: { file: "openapi.json", line: 1 },
      body: {
        contentType: "application/json",
        type: "object",
        examples: { example: { id: "1" } },
      },
    });

    const post = byKey["POST /items/{itemId}"];
    expect(post?.requestBody).toEqual({
      contentType: "application/json",
      type: "object",
      examples: { Sample: { id: "2" } },
      source: { file: "openapi.json", line: 1 },
    });
    // operation `security: []` overrides the root -> explicit empty list.
    expect(post?.securitySchemeIds).toEqual([]);
  });
});
