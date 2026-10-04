import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "coverage/**",
      "fixtures/local/**",
      "examples/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // The shipped library must run in browsers with no Node runtime (DESIGN.md §11).
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            "node:*",
            "fs",
            "fs/*",
            "path",
            "os",
            "child_process",
            "crypto",
            "url",
            "util",
            "stream",
            "zlib",
            "http",
            "https",
            "net",
            "worker_threads",
          ],
        },
      ],
      "no-restricted-globals": [
        "error",
        "process",
        "Buffer",
        "__dirname",
        "__filename",
      ],
    },
  },
  {
    // Tooling and tests run under Node — built-ins are fine there.
    files: ["vite.config.ts", "vitest.config.ts", "scripts/**", "test/**"],
    rules: {
      "no-restricted-imports": "off",
      "no-restricted-globals": "off",
    },
  },
);
