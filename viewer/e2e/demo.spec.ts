import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";

/**
 * Records the README walkthrough against the real built single-file HTML and
 * saves it as docs/assets/demo.webm for GIF conversion.
 *
 * Run via `npm run demo:gif` (tagged @demo, excluded from `npm run check:ui`).
 */

const zip = new Uint8Array(
  readFileSync(
    new URL(
      "../../examples/demo-inventory-api-1.0.0-raml.zip",
      import.meta.url,
    ),
  ),
);

test.use({
  video: { mode: "on", size: { width: 1100, height: 760 } },
  viewport: { width: 1100, height: 760 },
});

test("@demo record the viewer walkthrough", async ({ page }) => {
  const video = page.video();
  const viewerUrl = new URL("../dist/index.html", import.meta.url).href;
  await page.goto(viewerUrl);
  await expect(page.getByText("RAML Parser Viewer")).toBeVisible();
  await page.waitForTimeout(900);

  // Drop the committed synthetic demo zip.
  await page.evaluate((bytes: number[]) => {
    const dt = new DataTransfer();
    dt.items.add(
      new File([new Uint8Array(bytes)], "demo.zip", {
        type: "application/zip",
      }),
    );
    document.querySelector('[data-testid="dropzone"]')?.dispatchEvent(
      new DragEvent("drop", {
        dataTransfer: dt,
        bubbles: true,
        cancelable: true,
      }),
    );
  }, Array.from(zip));

  // Root picker (the zip contains a second, OpenAPI, root).
  await expect(
    page.getByRole("button", { name: "demo-inventory-api.raml" }),
  ).toBeVisible();
  await page.waitForTimeout(900);
  await page.getByRole("button", { name: "demo-inventory-api.raml" }).click();

  // Endpoints: resource groups and method cards.
  await expect(page.getByText("GET /items", { exact: true })).toBeVisible();
  await page.waitForTimeout(1200);
  await page.mouse.move(550, 420);
  await page.mouse.wheel(0, 480);
  await page.waitForTimeout(1100);
  await page.mouse.wheel(0, -480);
  await page.waitForTimeout(500);

  // Requirements: FR/NFR tables with scope and provenance.
  await page.getByRole("button", { name: "Requirements", exact: true }).click();
  await expect(page.getByText("FR-D-01", { exact: true })).toBeVisible();
  await page.waitForTimeout(1500);

  // Diagnostics and Raw views.
  await page.getByRole("button", { name: "Diagnostics" }).click();
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: "Raw" }).click();
  await page.waitForTimeout(900);

  // Export affordances.
  await page
    .getByRole("button", { name: "Export endpoints.md" })
    .hover({ force: true });
  await page.waitForTimeout(800);

  await page.close();
  await video?.saveAs("docs/assets/demo.webm");
});
