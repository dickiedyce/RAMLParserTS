import { describe, expect, it } from "vitest";

import type { LintFinding } from "../../src/index.js";
import {
  buildEndpointsMarkdown,
  buildLintMarkdown,
  buildRequirementsMarkdown,
  escapeCell,
} from "../src/lib/markdown.js";
import { makeSpec } from "./fixtures.js";

describe("escapeCell", () => {
  it("escapes pipes and flattens newlines", () => {
    expect(escapeCell("a | b\nc")).toBe("a \\| b c");
  });
});

describe("buildEndpointsMarkdown", () => {
  const md = buildEndpointsMarkdown(makeSpec());

  it("renders the API header and facts", () => {
    expect(md).toContain("# Trials API v1");
    expect(md).toContain("A trials API");
    expect(md).toContain("- Base URI: https://api.example.com");
    expect(md).toContain("- Protocols: HTTPS");
    expect(md).toContain("- Media type: application/json");
  });

  it("renders security schemes and per-resource methods", () => {
    expect(md).toContain("## Security schemes");
    expect(md).toContain("| clientIdEnforcement | Client ID Enforcement |");
    expect(md).toContain("## /trials");
    expect(md).toContain("Trials resource");
    expect(md).toContain("### GET /trials");
    expect(md).toContain("### POST /trials");
    expect(md).toContain("**Security:** clientIdEnforcement");
    expect(md).toContain("**Security:** anonymous");
  });

  it("renders parameters with facets and escaped pipes", () => {
    expect(md).toContain("| Name | In | Required | Type | Description |");
    expect(md).toContain("| id | path | yes | string | Trial id |");
    expect(md).toContain("min 1, max 10");
    expect(md).toContain("Limit \\| capped");
  });

  it("renders request and response bodies with examples", () => {
    expect(md).toContain("#### Request body");
    expect(md).toContain("- Type: Trial");
    expect(md).toContain("**Example Sample:**");
    expect(md).toContain('"id": "T-2"');
    expect(md).toContain("#### 200");
    expect(md).toContain("#### 204");
    expect(md).toContain('"items"');
  });

  it("lists attached requirements", () => {
    expect(md).toContain("- [FR] FR-S-G-01 (resource): Get firewall flag");
    expect(md).toContain("- [NFR] NFR-M-01 (method): Respond within 2s");
  });
});

describe("buildLintMarkdown", () => {
  const findings: LintFinding[] = [
    {
      code: "parameter-missing-example",
      severity: "info",
      message: "Parameter limit on GET /trials has no example",
      path: "api.raml",
      line: 20,
      target: {
        kind: "parameter",
        endpointPath: "/trials",
        method: "GET",
        name: "limit",
      },
    },
    {
      code: "api-info-missing-description",
      severity: "warning",
      message: "API info has no description",
      path: "api.raml",
      line: 1,
      target: { kind: "api-info" },
    },
  ];

  it("groups findings by severity, warnings first, with target and location", () => {
    const md = buildLintMarkdown(makeSpec(), findings);
    expect(md).toContain("# Lint: Trials API v1");
    expect(md.indexOf("## Warnings")).toBeLessThan(md.indexOf("## Info"));
    expect(md).toContain("api-info-missing-description");
    expect(md).toContain("API info has no description");
    expect(md).toContain("api.raml:1");
    expect(md).toContain('GET /trials · parameter "limit"');
    expect(md).toContain("api.raml:20");
  });

  it("renders a clean checklist when there are no findings", () => {
    const md = buildLintMarkdown(makeSpec(), []);
    expect(md).toContain("No lint findings.");
  });
});

describe("buildRequirementsMarkdown", () => {
  const md = buildRequirementsMarkdown(makeSpec());

  it("splits FR and NFR tables with scope and source", () => {
    expect(md).toContain("# Requirements: Trials API");
    expect(md).toContain("## Functional Requirements");
    expect(md).toContain("## Non-Functional Requirements");
    expect(md).toContain(
      "| FR-S-G-01 | UC-01 | Get firewall flag | Returns the flag | resource | overview_files/ov.md:5 |",
    );
    expect(md).toContain(
      "| NFR-M-01 | UC-02 | Respond within 2s | Measured at p95 | method | overview_files/ovm.md:6 |",
    );
  });

  it("says None for an empty section", () => {
    const spec = makeSpec();
    spec.requirements = [];
    const md = buildRequirementsMarkdown(spec);
    expect(md).toContain("## Functional Requirements\n\nNone.");
    expect(md).toContain("## Non-Functional Requirements\n\nNone.");
  });
});
