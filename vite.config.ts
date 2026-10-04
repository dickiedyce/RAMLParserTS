import { defineConfig } from "vite";

// Library build: ESM for bundlers/npm + IIFE (window.RAMLParser) for plain
// <script> tags in static pages (DESIGN.md §11).
export default defineConfig({
  build: {
    target: "es2020",
    sourcemap: true,
    lib: {
      entry: "src/index.ts",
      name: "RAMLParser",
      formats: ["es", "iife"],
      fileName: (format) =>
        format === "es" ? "index.js" : "raml-parser-ts.global.js",
    },
  },
});
