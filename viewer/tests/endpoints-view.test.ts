// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it } from "vitest";

import EndpointsView from "../src/views/EndpointsView.svelte";
import { makeSpec } from "./fixtures.js";

afterEach(cleanup);

describe("EndpointsView", () => {
  it("renders resources, method headings and descriptions", () => {
    render(EndpointsView, { props: { spec: makeSpec() } });
    expect(screen.getByText("/trials")).toBeTruthy();
    expect(screen.getByText("Trials resource")).toBeTruthy();
    expect(screen.getByText("GET /trials")).toBeTruthy();
    expect(screen.getByText("POST /trials")).toBeTruthy();
    expect(screen.getByText("Get trials")).toBeTruthy();
    expect(screen.getByText("Creates a trial")).toBeTruthy();
  });

  it("renders parameters with location, required flag and facets", () => {
    render(EndpointsView, { props: { spec: makeSpec() } });
    expect(screen.getByText("id")).toBeTruthy();
    expect(screen.getByText("path")).toBeTruthy();
    expect(screen.getAllByText("query").length).toBe(2);
    expect(screen.getByText("min 1, max 10")).toBeTruthy();
    expect(screen.getByText("Limit | capped")).toBeTruthy();
    expect(screen.getByText("yes")).toBeTruthy();
    expect(screen.getAllByText("no").length).toBe(2);
  });

  it("renders security ids and response summaries", () => {
    render(EndpointsView, { props: { spec: makeSpec() } });
    expect(screen.getByText(/clientIdEnforcement/)).toBeTruthy();
    expect(screen.getByText(/anonymous/)).toBeTruthy();
    expect(screen.getByText("200 OK")).toBeTruthy();
    expect(screen.getByText("204 No content")).toBeTruthy();
    expect(screen.getByText("201 Created")).toBeTruthy();
  });

  it("renders request and response body examples", () => {
    render(EndpointsView, { props: { spec: makeSpec() } });
    expect(screen.getByText("Type: Trial")).toBeTruthy();
    expect(screen.getByText("Example Sample:")).toBeTruthy();
    expect(screen.getByText("Type: TrialList")).toBeTruthy();
  });

  it("shows attached requirements with their scope", () => {
    render(EndpointsView, { props: { spec: makeSpec() } });
    // The resource-scope requirement is visible on both methods of /trials.
    expect(screen.getAllByText("FR-S-G-01").length).toBe(2);
    expect(screen.getAllByText("(resource)").length).toBe(2);
    expect(screen.getByText("(method)")).toBeTruthy();
    expect(screen.getByText("Respond within 2s")).toBeTruthy();
  });

  it("shows an empty message when there are no endpoints", () => {
    const spec = makeSpec();
    spec.endpoints = [];
    render(EndpointsView, { props: { spec } });
    expect(screen.getByText("No endpoints found.")).toBeTruthy();
  });
});
