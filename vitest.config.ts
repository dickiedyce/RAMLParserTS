import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [svelte()],
  resolve: {
    conditions: ["browser"],
  },
  test: {
    include: ["test/**/*.test.ts", "viewer/**/*.test.ts"],
    environment: "node",
  },
});
