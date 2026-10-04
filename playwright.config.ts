import { defineConfig } from "@playwright/test";

// The one e2e smoke test (Q25-C): drop -> parse -> render through the real
// built single-file HTML. Run via `npm run check:ui`; requires
// `npx playwright install chromium` first.
export default defineConfig({
  testDir: "./viewer/e2e",
  timeout: 30_000,
  reporter: "line",
  use: {
    browserName: "chromium",
  },
});
