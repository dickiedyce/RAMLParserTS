// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it } from "vitest";

import { targetLabel } from "../src/lib/lint.js";
import LintView from "../src/views/LintView.svelte";
import type { LintFinding } from "../../src/index.js";

afterEach(cleanup);

const findings: LintFinding[] = [
  {
    code: "endpoint-missing-description",
    severity: "warning",
    message: "GET /ping has no summary or description",
    path: "api.raml",
    line: 4,
    target: { kind: "endpoint", endpointPath: "/ping", method: "GET" },
  },
  {
    code: "parameter-missing-example",
    severity: "info",
    message: "Parameter q on GET /ping has no example",
    path: "api.raml",
    line: 7,
    target: {
      kind: "parameter",
      endpointPath: "/ping",
      method: "GET",
      name: "q",
    },
  },
];

describe("LintView", () => {
  it("renders severity, rule, message, target and location", () => {
    render(LintView, { props: { findings } });
    expect(screen.getByText("warning")).toBeTruthy();
    expect(screen.getByText("info")).toBeTruthy();
    expect(screen.getByText("endpoint-missing-description")).toBeTruthy();
    expect(
      screen.getByText("GET /ping has no summary or description"),
    ).toBeTruthy();
    expect(screen.getByText('GET /ping · parameter "q"')).toBeTruthy();
    expect(screen.getByText("api.raml:4")).toBeTruthy();
    expect(screen.getByText("api.raml:7")).toBeTruthy();
  });

  it("shows a clean message when there are no findings", () => {
    render(LintView, { props: { findings: [] } });
    expect(screen.getByText("No lint findings. Well documented.")).toBeTruthy();
  });
});

describe("targetLabel", () => {
  it("labels every target kind", () => {
    expect(targetLabel({ kind: "api-info" })).toBe("API info");
    expect(
      targetLabel({ kind: "endpoint", endpointPath: "/ping", method: "GET" }),
    ).toBe("GET /ping");
    expect(
      targetLabel({
        kind: "parameter",
        endpointPath: "/ping",
        method: "GET",
        name: "q",
      }),
    ).toBe('GET /ping · parameter "q"');
    expect(
      targetLabel({
        kind: "response",
        endpointPath: "/ping",
        method: "GET",
        statusCode: "200",
      }),
    ).toBe("GET /ping · response 200");
    expect(
      targetLabel({
        kind: "request-body",
        endpointPath: "/ping",
        method: "GET",
      }),
    ).toBe("GET /ping · request body");
    expect(targetLabel({ kind: "security-scheme", name: "sec" })).toBe(
      'security scheme "sec"',
    );
    expect(targetLabel({ kind: "requirement", name: "FR-01" })).toBe(
      "requirement FR-01",
    );
  });
});
