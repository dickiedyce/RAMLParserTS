import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// Builds the viewer as ONE self-contained HTML file that runs from disk,
// offline, with no backend (user delivery preference).
export default defineConfig({
  root: "viewer",
  base: "./",
  plugins: [svelte(), viteSingleFile()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
