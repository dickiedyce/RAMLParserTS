import { describe, expect, it } from "vitest";

import {
  buildEndpointsMarkdown,
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
