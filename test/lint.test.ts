/**
 * Documentation-omission linter (DESIGN.md §18): 12 rules over the extracted
 * model, each self-skipping where inapplicable. Lint never emits `error` —
 * parse problems belong to the parser's diagnostics.
 */
import { describe, expect, it } from "vitest";

import { lintSpec, type LintFinding, type LintRuleId } from "../src/lint.js";
import type { Endpoint, ParsedSpec, Requirement } from "../src/model.js";
import { parseSpec } from "../src/parse.js";
import { createVfs } from "../src/vfs.js";

const HEADER = "#%RAML 1.0\n";

/** A fully documented spec: no rule should fire. */
function makeSpec(): ParsedSpec {
  const requirement: Requirement = {
    reqId: "FR-01",
    reqType: "FR",
    useCase: "UC-01",
    description: "Do the thing",
    acceptanceCriteria: "It works",
    scope: "method",
    source: { file: "api.raml", line: 9 },
  };
  const endpoint: Endpoint = {
    path: "/ping",
    method: "GET",
    summary: "Ping",
    description: "Pings",
    parameters: [
      {
        name: "q",
        location: "query",
        required: false,
        type: "string",
        description: "Query term",
        example: "hello",
        source: { file: "api.raml", line: 7 },
      },
    ],
    requestBody: {
      contentType: "application/json",
      type: "Ping",
      examples: { One: { msg: "hi" } },
    },
    responses: [
      {
        statusCode: "200",
        description: "OK",
        source: { file: "api.raml", line: 12 },
        body: {
          contentType: "application/json",
          type: "Ping",
          examples: { example: { msg: "hi" } },
        },
      },
    ],
    requirements: [requirement],
    securitySchemeIds: [],
    source: { file: "api.raml", line: 4 },
  };
  return {
    format: "raml1",
    apiInfo: {
      title: "T",
      version: "v1",
      description: "A test API",
      documentation: [{ title: "Guide", content: "Welcome" }],
      securitySchemes: {
        sec: {
          type: "Basic Auth",
          description: "Basic auth",
          source: { file: "api.raml", line: 2 },
        },
      },
      source: { file: "api.raml", line: 1 },
    },
    endpoints: [endpoint],
    requirements: [requirement],
    diagnostics: [],
  };
}

function codes(findings: LintFinding[]): string[] {
  return findings.map((f) => f.code);
}

function finding(
  findings: LintFinding[],
  rule: LintRuleId,
): LintFinding | undefined {
  return findings.find((f) => f.code === rule);
}

describe("lintSpec — clean spec", () => {
  it("reports nothing for a fully documented spec", () => {
    expect(lintSpec(makeSpec()).findings).toEqual([]);
  });
});

describe("lintSpec — warning rules", () => {
  it("endpoint-missing-description: fires when summary, description and resource description are all empty", () => {
    const spec = makeSpec();
    spec.endpoints[0]!.summary = "";
    spec.endpoints[0]!.description = "";
    const f = finding(lintSpec(spec).findings, "endpoint-missing-description");
    expect(f).toMatchObject({
      severity: "warning",
      target: { kind: "endpoint", endpointPath: "/ping", method: "GET" },
      path: "api.raml",
      line: 4,
    });
  });

  it("endpoint-missing-description: a resource-level description covers its methods", () => {
    const spec = makeSpec();
    spec.endpoints[0]!.summary = "";
    spec.endpoints[0]!.description = "";
    spec.endpoints[0]!.resourceDescription = "Shared resource docs";
    expect(codes(lintSpec(spec).findings)).not.toContain(
      "endpoint-missing-description",
    );
  });

  it("parameter-missing-description fires; parameter-missing-example fires when example is absent", () => {
    const spec = makeSpec();
    spec.endpoints[0]!.parameters[0]!.description = "";
    spec.endpoints[0]!.parameters[0]!.example = undefined;
    const findings = lintSpec(spec).findings;
    const d = finding(findings, "parameter-missing-description");
    expect(d).toMatchObject({
      severity: "warning",
      target: {
        kind: "parameter",
        endpointPath: "/ping",
        method: "GET",
        name: "q",
      },
      path: "api.raml",
      line: 7,
    });
    const e = finding(findings, "parameter-missing-example");
    expect(e?.severity).toBe("info");
  });

  it("response-missing-description and response-missing-example fire on empty responses", () => {
    const spec = makeSpec();
    spec.endpoints[0]!.responses[0]!.description = "";
    spec.endpoints[0]!.responses[0]!.body = {
      contentType: "application/json",
      examples: {},
    };
    const findings = lintSpec(spec).findings;
    const d = finding(findings, "response-missing-description");
    expect(d).toMatchObject({
      severity: "warning",
      target: {
        kind: "response",
        endpointPath: "/ping",
        method: "GET",
        statusCode: "200",
      },
      path: "api.raml",
      line: 12,
    });
    expect(finding(findings, "response-missing-example")?.severity).toBe(
      "info",
    );
  });

  it("response-missing-example is skipped when the response has no body", () => {
    const spec = makeSpec();
    spec.endpoints[0]!.responses[0]!.body = undefined;
    expect(codes(lintSpec(spec).findings)).not.toContain(
      "response-missing-example",
    );
  });

  it("api-info-missing-description and security-scheme-missing-description fire", () => {
    const spec = makeSpec();
    spec.apiInfo.description = "";
    spec.apiInfo.securitySchemes["sec"]!.description = "";
    const findings = lintSpec(spec).findings;
    expect(finding(findings, "api-info-missing-description")).toMatchObject({
      severity: "warning",
      target: { kind: "api-info" },
    });
    expect(
      finding(findings, "security-scheme-missing-description"),
    ).toMatchObject({
      severity: "warning",
      target: { kind: "security-scheme", name: "sec" },
    });
  });

  it("endpoint-missing-responses fires when an endpoint documents no responses", () => {
    const spec = makeSpec();
    spec.endpoints[0]!.responses = [];
    expect(
      finding(lintSpec(spec).findings, "endpoint-missing-responses"),
    ).toMatchObject({ severity: "warning" });
  });
});

describe("lintSpec — info rules", () => {
  it("request-body-missing-example fires when examples are empty", () => {
    const spec = makeSpec();
    spec.endpoints[0]!.requestBody!.examples = {};
    expect(
      finding(lintSpec(spec).findings, "request-body-missing-example"),
    ).toMatchObject({ severity: "info" });
  });

  it("api-info-missing-documentation fires when documentation[] is empty", () => {
    const spec = makeSpec();
    spec.apiInfo.documentation = [];
    expect(
      finding(lintSpec(spec).findings, "api-info-missing-documentation"),
    ).toMatchObject({ severity: "info" });
  });

  it("endpoint-missing-requirements fires when no requirements are attached", () => {
    const spec = makeSpec();
    spec.endpoints[0]!.requirements = [];
    expect(
      finding(lintSpec(spec).findings, "endpoint-missing-requirements"),
    ).toMatchObject({ severity: "info" });
  });

  it("requirement-missing-acceptance fires on empty acceptance criteria", () => {
    const spec = makeSpec();
    spec.requirements[0]!.acceptanceCriteria = "";
    expect(
      finding(lintSpec(spec).findings, "requirement-missing-acceptance"),
    ).toMatchObject({
      severity: "info",
      target: { kind: "requirement", name: "FR-01" },
    });
  });
});

describe("lintSpec — rule self-skip", () => {
  it("requirement-table rules are skipped for OAS3 specs", () => {
    const spec = makeSpec();
    spec.format = "openapi3";
    spec.requirements[0]!.acceptanceCriteria = "";
    spec.endpoints[0]!.requirements = [];
    expect(codes(lintSpec(spec).findings)).toEqual([]);
  });

  it("requirement-table rules are skipped for RAML specs with no requirement tables", () => {
    const spec = makeSpec();
    spec.requirements = [];
    spec.endpoints[0]!.requirements = [];
    spec.requirements = [];
    expect(codes(lintSpec(spec).findings)).toEqual([]);
  });
});

describe("lintSpec — options", () => {
  it("per-rule disable suppresses findings", () => {
    const spec = makeSpec();
    spec.apiInfo.description = "";
    spec.apiInfo.documentation = [];
    const findings = lintSpec(spec, {
      rules: { "api-info-missing-description": { enabled: false } },
    }).findings;
    expect(codes(findings)).toEqual(["api-info-missing-documentation"]);
  });

  it("per-rule severity override is honoured", () => {
    const spec = makeSpec();
    spec.apiInfo.documentation = [];
    const findings = lintSpec(spec, {
      rules: { "api-info-missing-documentation": { severity: "warning" } },
    }).findings;
    expect(findings[0]?.severity).toBe("warning");
  });
});

describe("lintSpec — parser integration", () => {
  it("lints a parsed RAML spec and points findings at entity key lines", () => {
    const vfs = createVfs([
      [
        "api.raml",
        HEADER +
          "title: T\n" + // 2
          "/ping:\n" + // 3
          "  get:\n" + // 4
          "    queryParameters:\n" + // 5
          "      q:\n" + // 6
          "        type: string\n", // 7
      ],
    ]);
    const spec = parseSpec(vfs, "api.raml");
    const findings = lintSpec(spec).findings;
    // q has no description and no example; its key line is 6.
    expect(finding(findings, "parameter-missing-description")).toMatchObject({
      path: "api.raml",
      line: 6,
    });
    expect(finding(findings, "parameter-missing-example")).toMatchObject({
      path: "api.raml",
      line: 6,
    });
  });
});
