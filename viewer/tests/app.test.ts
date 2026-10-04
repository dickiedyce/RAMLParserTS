// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it } from "vitest";

import App from "../src/App.svelte";

afterEach(cleanup);

describe("App", () => {
  it("shows the drop zone before any input", () => {
    render(App);
    expect(screen.getByText("RAML Parser Viewer")).toBeTruthy();
    expect(screen.getByTestId("dropzone")).toBeTruthy();
    expect(screen.queryByText("Endpoints")).toBeNull();
  });
});
