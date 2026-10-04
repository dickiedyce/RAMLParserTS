// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it } from "vitest";

import DiagnosticsView from "../src/views/DiagnosticsView.svelte";
import RawView from "../src/views/RawView.svelte";
import { makeSpec } from "./fixtures.js";

afterEach(cleanup);

describe("DiagnosticsView", () => {
  it("renders severity, code, message and location", () => {
    render(DiagnosticsView, {
      props: { diagnostics: makeSpec().diagnostics },
    });
    expect(screen.getByText("warning")).toBeTruthy();
    expect(screen.getByText("include-fallback")).toBeTruthy();
    expect(screen.getByText("Include resolved from spec root")).toBeTruthy();
    expect(screen.getByText("api.raml:12")).toBeTruthy();
  });

  it("shows a clean message when there are no diagnostics", () => {
    render(DiagnosticsView, { props: { diagnostics: [] } });
    expect(screen.getByText("No diagnostics. Clean parse.")).toBeTruthy();
  });
});

describe("RawView", () => {
  it("shows the resolved tree and the parsed model as JSON", () => {
    const { container } = render(RawView, {
      props: { tree: { title: "T" }, spec: makeSpec() },
    });
    expect(screen.getByText("Resolved tree")).toBeTruthy();
    expect(screen.getByText("Parsed model")).toBeTruthy();
    expect(container.querySelectorAll("pre").length).toBe(2);
    expect(container.textContent).toContain('"title": "Trials API"');
  });

  it("omits the tree block when no tree is provided", () => {
    const { container } = render(RawView, {
      props: { tree: null, spec: makeSpec() },
    });
    expect(screen.queryByText("Resolved tree")).toBeNull();
    expect(container.querySelectorAll("pre").length).toBe(1);
  });
});
