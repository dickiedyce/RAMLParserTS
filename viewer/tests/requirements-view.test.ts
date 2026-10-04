// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it } from "vitest";

import RequirementsView from "../src/views/RequirementsView.svelte";
import { makeSpec } from "./fixtures.js";

afterEach(cleanup);

describe("RequirementsView", () => {
  it("renders FR and NFR sections with scope and provenance", () => {
    render(RequirementsView, { props: { spec: makeSpec() } });
    expect(screen.getByText("Functional Requirements")).toBeTruthy();
    expect(screen.getByText("Non-Functional Requirements")).toBeTruthy();
    expect(screen.getByText("FR-S-G-01")).toBeTruthy();
    expect(screen.getByText("NFR-M-01")).toBeTruthy();
    expect(screen.getByText("Get firewall flag")).toBeTruthy();
    expect(screen.getByText("Respond within 2s")).toBeTruthy();
    expect(screen.getByText("overview_files/ov.md:5")).toBeTruthy();
    expect(screen.getByText("overview_files/ovm.md:6")).toBeTruthy();
  });

  it("distinguishes resource and method scope", () => {
    render(RequirementsView, { props: { spec: makeSpec() } });
    expect(screen.getByText("resource")).toBeTruthy();
    expect(screen.getByText("method")).toBeTruthy();
  });

  it("shows an empty message when nothing was scraped", () => {
    const spec = makeSpec();
    spec.requirements = [];
    render(RequirementsView, { props: { spec } });
    expect(screen.getByText("No requirement tables found.")).toBeTruthy();
  });
});
