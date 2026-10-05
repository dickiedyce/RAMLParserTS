import { expect, test } from "@playwright/test";
import { strToU8, zipSync } from "fflate";

/**
 * The one e2e smoke (Q25-C): drop -> root picker -> parse -> views render,
 * exercised through the real built single-file HTML (file://, offline).
 */

const alphaRaml = `#%RAML 1.0
title: Alpha API
version: v1
/ping:
  description: |
    ### Functional Requirements:

    | # | Use Case | Detailed Description | Acceptance Criteria Description |
    | --- | --- | --- | --- |
    | FR-E2E-01 | UC-1 | Ping returns pong | 200 with pong |
  get:
    displayName: Ping
    description: Returns pong
    responses:
      200:
        description: OK
`;

const betaOas = JSON.stringify({
  openapi: "3.0.0",
  info: { title: "Beta API", version: "1.0" },
  paths: {
    "/items": {
      get: {
        summary: "List items",
        responses: { "200": { description: "OK" } },
      },
    },
  },
});

const zip = zipSync({
  "api-a/alpha.raml": strToU8(alphaRaml),
  "api-b/openapi.json": strToU8(betaOas),
});

const viewerUrl = new URL("../dist/index.html", import.meta.url).href;

test("drop a zip, pick a root, browse endpoints and requirements", async ({
  page,
}) => {
  await page.goto(viewerUrl);
  await expect(page.getByText("RAML Parser Viewer")).toBeVisible();

  // Simulate a drag-and-drop of the zip.
  await page.evaluate((bytes: number[]) => {
    const dt = new DataTransfer();
    dt.items.add(
      new File([new Uint8Array(bytes)], "spec.zip", {
        type: "application/zip",
      }),
    );
    const zone = document.querySelector('[data-testid="dropzone"]');
    zone?.dispatchEvent(
      new DragEvent("drop", {
        dataTransfer: dt,
        bubbles: true,
        cancelable: true,
      }),
    );
  }, Array.from(zip));

  // Root picker lists both discovered candidates.
  await expect(page.getByText("api-a/alpha.raml")).toBeVisible();
  await expect(page.getByText("api-b/openapi.json")).toBeVisible();

  // Parse the RAML root: endpoints view renders the method card.
  await page.getByRole("button", { name: "api-a/alpha.raml" }).click();
  await expect(page.getByText("GET /ping", { exact: true })).toBeVisible();
  await expect(page.getByText("Returns pong", { exact: true })).toBeVisible();

  // Requirements view shows the scraped FR table row.
  await page.getByRole("button", { name: "Requirements", exact: true }).click();
  await expect(page.getByText("FR-E2E-01", { exact: true })).toBeVisible();

  // Lint tab flags documentation omissions (no API description here).
  await page.getByRole("button", { name: "Lint", exact: true }).click();
  await expect(
    page.getByText("api-info-missing-description", { exact: true }),
  ).toBeVisible();

  // Diagnostics view renders; markdown export buttons are offered.
  await page.getByRole("button", { name: "Diagnostics" }).click();
  await expect(page.getByText("No diagnostics. Clean parse.")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Export endpoints.md" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Export lint.md" }),
  ).toBeVisible();
});
