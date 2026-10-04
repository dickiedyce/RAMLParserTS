import { describe, expect, it } from "vitest";

import type { APIParameter, Requirement } from "../../src/index.js";
import {
  formatConstraints,
  formatExample,
  sourceLabel,
} from "../src/lib/format.js";

function param(overrides: Partial<APIParameter> = {}): APIParameter {
  return {
    name: "n",
    location: "query",
    required: false,
    type: "string",
    description: "",
    ...overrides,
  };
}

describe("formatExample", () => {
  it("returns strings as written", () => {
    expect(formatExample("hello")).toBe("hello");
  });

  it("pretty-prints objects and arrays as JSON", () => {
    expect(formatExample({ a: 1 })).toBe('{\n  "a": 1\n}');
    expect(formatExample([1, 2])).toBe("[\n  1,\n  2\n]");
  });

  it("stringifies numbers and booleans", () => {
    expect(formatExample(42)).toBe("42");
    expect(formatExample(false)).toBe("false");
  });

  it("renders missing values as empty", () => {
    expect(formatExample(undefined)).toBe("");
  });
});

describe("formatConstraints", () => {
  it("returns empty when there are no facets", () => {
    expect(formatConstraints(param())).toBe("");
  });

  it("joins numeric facets", () => {
    expect(formatConstraints(param({ minimum: 1, maximum: 10 }))).toBe(
      "min 1, max 10",
    );
  });

  it("joins string constraints", () => {
    expect(
      formatConstraints(
        param({ minLength: 2, maxLength: 4, pattern: "^a|b$" }),
      ),
    ).toBe("minLength 2, maxLength 4, pattern ^a|b$");
  });
});

describe("sourceLabel", () => {
  it("formats file and line", () => {
    expect(
      sourceLabel({
        reqId: "FR-1",
        reqType: "FR",
        useCase: "UC",
        description: "",
        acceptanceCriteria: "",
        scope: "method",
        source: { file: "ov.md", line: 7 },
      }),
    ).toBe("ov.md:7");
  });

  it("formats file without line, and '-' without provenance", () => {
    const base: Omit<Requirement, "source"> = {
      reqId: "FR-1",
      reqType: "FR",
      useCase: "UC",
      description: "",
      acceptanceCriteria: "",
      scope: "method",
    };
    expect(sourceLabel({ ...base, source: { file: "ov.md" } })).toBe("ov.md");
    expect(sourceLabel({ ...base, source: {} })).toBe("-");
    expect(sourceLabel(base)).toBe("-");
  });
});
