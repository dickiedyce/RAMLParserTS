import { describe, expect, it } from "vitest";

import { parseRequirementTables } from "../src/requirements.js";

describe("requirement-table extraction", () => {
  it("parses a functional table with four columns", () => {
    const text = [
      "Intro prose.",
      "",
      "### Functional Requirements:",
      "",
      "| # | Use Case | Detailed Description | Acceptance Criteria Description |",
      "| --- | --- | --- | --- |",
      "| FR-S-G-01 | UC-01 | Get isFirewall value | Returns value within 1h |",
      "",
    ].join("\n");
    const { rows, diagnostics } = parseRequirementTables(text);
    expect(diagnostics).toEqual([]);
    expect(rows).toEqual([
      {
        reqId: "FR-S-G-01",
        reqType: "FR",
        useCase: "UC-01",
        description: "Get isFirewall value",
        acceptanceCriteria: "Returns value within 1h",
        line: 7,
      },
    ]);
  });

  it("parses a non-functional table with three columns (acceptance optional)", () => {
    const text = [
      "### Non-Functional Requirements:",
      "",
      "| # | Use Case | Detailed Description |",
      "| --- | --- | --- |",
      "| NFR-S-P-01 | UC-02 | Response under 2s |",
      "",
    ].join("\n");
    const { rows, diagnostics } = parseRequirementTables(text);
    expect(diagnostics).toEqual([]);
    expect(rows).toEqual([
      {
        reqId: "NFR-S-P-01",
        reqType: "NFR",
        useCase: "UC-02",
        description: "Response under 2s",
        acceptanceCriteria: "",
        line: 5,
      },
    ]);
  });

  it("captures an optional fourth NFR column when present", () => {
    const text = [
      "### Non-Functional Requirements:",
      "",
      "| # | Use Case | Detailed Description | Acceptance Criteria Description |",
      "| --- | --- | --- | --- |",
      "| NFR-S-P-01 | UC-02 | Response under 2s | Measured at p95 |",
      "",
    ].join("\n");
    const { rows } = parseRequirementTables(text);
    expect(rows[0]?.acceptanceCriteria).toBe("Measured at p95");
  });

  it("classifies Non-Functional headings as NFR despite the 'Functional' substring", () => {
    const text = [
      "### Specific Non-Functional Requirements:",
      "",
      "| # | Use Case | Detailed Description |",
      "| --- | --- | --- |",
      "| NFR-1 | UC | Latency budget |",
      "",
    ].join("\n");
    const { rows } = parseRequirementTables(text);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.reqType).toBe("NFR");
  });

  it("keeps a middle description that contains an unescaped pipe", () => {
    const text = [
      "### Functional Requirements:",
      "",
      "| # | Use Case | Detailed Description | Acceptance Criteria Description |",
      "| --- | --- | --- | --- |",
      "| FR-1 | UC | Splits a | b into one description | Criteria |",
      "",
    ].join("\n");
    const { rows } = parseRequirementTables(text);
    expect(rows[0]?.description).toBe("Splits a | b into one description");
    expect(rows[0]?.acceptanceCriteria).toBe("Criteria");
  });

  it("does not split on an escaped pipe", () => {
    const text = [
      "### Functional Requirements:",
      "",
      "| # | Use Case | Detailed Description | Acceptance Criteria Description |",
      "| --- | --- | --- | --- |",
      "| FR-1 | UC | A \\| B | Criteria |",
      "",
    ].join("\n");
    const { rows } = parseRequirementTables(text);
    expect(rows[0]?.description).toBe("A | B");
  });

  it("drops an FR row that omits acceptance with a diagnostic, but keeps the row", () => {
    const text = [
      "### Functional Requirements:",
      "",
      "| # | Use Case | Detailed Description | Acceptance Criteria Description |",
      "| --- | --- | --- | --- |",
      "| FR-1 | UC | Description only |",
      "",
    ].join("\n");
    const { rows, diagnostics } = parseRequirementTables(text);
    expect(rows[0]?.acceptanceCriteria).toBe("");
    expect(diagnostics).toEqual([
      {
        code: "requirement-missing-acceptance",
        severity: "warning",
        message: expect.stringContaining("acceptance"),
        line: 5,
      },
    ]);
  });

  it("drops a row with an empty id and reports it", () => {
    const text = [
      "### Functional Requirements:",
      "",
      "| # | Use Case | Detailed Description | Acceptance Criteria Description |",
      "| --- | --- | --- | --- |",
      "|  | UC | Description | Criteria |",
      "",
    ].join("\n");
    const { rows, diagnostics } = parseRequirementTables(text);
    expect(rows).toEqual([]);
    expect(diagnostics).toEqual([
      {
        code: "requirement-missing-id",
        severity: "warning",
        message: expect.stringContaining("id"),
        line: 5,
      },
    ]);
  });

  it("drops a row with too few columns and reports it", () => {
    const text = [
      "### Functional Requirements:",
      "",
      "| # | Use Case | Detailed Description | Acceptance Criteria Description |",
      "| --- | --- | --- | --- |",
      "| FR-1 | UC |",
      "",
    ].join("\n");
    const { rows, diagnostics } = parseRequirementTables(text);
    expect(rows).toEqual([]);
    expect(diagnostics).toEqual([
      {
        code: "requirement-row-short",
        severity: "warning",
        message: expect.stringContaining("column"),
        line: 5,
      },
    ]);
  });

  it("ignores rows outside any recognised section", () => {
    const text = ["| FR-1 | UC | Description | Criteria |", ""].join("\n");
    const { rows, diagnostics } = parseRequirementTables(text);
    expect(rows).toEqual([]);
    expect(diagnostics).toEqual([]);
  });

  it("honours a custom heading configuration", () => {
    const text = [
      "### Acceptance Criteria:",
      "",
      "| Ref | Story | Detail |",
      "| --- | --- | --- |",
      "| AC-1 | US-1 | Does a thing |",
      "",
    ].join("\n");
    const { rows } = parseRequirementTables(text, {
      functionalHeadings: ["Acceptance Criteria"],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.reqId).toBe("AC-1");
    expect(rows[0]?.reqType).toBe("FR");
    // Three columns in an FR section: no acceptance -> warning but kept.
    expect(rows[0]?.acceptanceCriteria).toBe("");
  });

  it("handles rows without a trailing pipe and multiple tables", () => {
    const text = [
      "### Functional Requirements:",
      "",
      "| # | Use Case | Detailed Description | Acceptance Criteria Description |",
      "| --- | --- | --- | --- |",
      "| FR-1 | UC | One | Criteria 1",
      "",
      "### Non-Functional Requirements:",
      "",
      "| # | Use Case | Detailed Description |",
      "| --- | --- | --- |",
      "| NFR-1 | UC | Two |",
      "",
    ].join("\n");
    const { rows } = parseRequirementTables(text);
    expect(rows.map((r) => [r.reqId, r.reqType, r.line])).toEqual([
      ["FR-1", "FR", 5],
      ["NFR-1", "NFR", 11],
    ]);
  });
});
