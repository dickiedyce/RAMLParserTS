# RAMLParserTS

Parse **RAML 1.0** and **OpenAPI 3.x** specifications into structured data —
in the browser, with no backend and no Node runtime.

Extracted data includes API info, endpoints, parameters, responses, security
schemes, and functional/non-functional requirements from description tables.

> **Status: early development.** See [`DESIGN.md`](https://github.com/dickiedyce/RAMLParserTS/blob/main/DESIGN.md) for the agreed
> design and [`PARITY.md`](https://github.com/dickiedyce/RAMLParserTS/blob/main/PARITY.md) for differences from the Swift original.

![Viewer demo: drop a MuleSoft export, pick the root, browse endpoints and requirements](https://raw.githubusercontent.com/dickiedyce/RAMLParserTS/main/docs/assets/demo.gif)

## Features

- Parses RAML 1.0 and OpenAPI 3.0/3.1 specifications
- Resolves `!include` directives (RAML, YAML, JSON, plain text) from a
  folder/zip dropped into the page
- Expands RAML traits, resource types, and `uses:` libraries; resolves
  OpenAPI `$ref`s
- Extracts endpoints, parameters, responses, and security schemes
- Extracts functional and non-functional requirements from description tables
- Lints documentation omissions (missing descriptions, examples, acceptance
  criteria) with per-rule configuration and file:line attribution
- Runs 100% client-side: suitable for static web pages (ESM + IIFE builds)

## Supported formats

| Format      | Support                        |
| ----------- | ------------------------------ |
| RAML 1.0    | ✅                             |
| OpenAPI 3.x | ✅                             |
| RAML 0.8    | ❌ rejected with a clear error |
| Swagger 2.0 | ❌ rejected with a clear error |

## Installation

```sh
npm install raml-parser-ts
```

Or use the IIFE build from a plain `<script>` tag:

```html
<script src="dist/raml-parser-ts.global.js"></script>
<script>
  // global: RAMLParser
</script>
```

## Usage

```js
import {
  discoverRoots,
  lintSpec,
  loadZip,
  parseFiles,
  parseSpec,
} from "raml-parser-ts";

// One-shot from dropped files (zip or folder):
const spec = await parseFiles(event.dataTransfer.files);
console.log(spec.apiInfo.title, spec.endpoints.length);

// Or step by step (e.g. to show a root picker):
const vfs = loadZip(new Uint8Array(await file.arrayBuffer()));
const roots = discoverRoots(vfs); // valid root candidates only
const spec2 = parseSpec(vfs, roots[0]); // resolve + extract

// Documentation-omission lint (DESIGN.md §18):
const { findings } = lintSpec(spec2); // per-rule enable/severity via options
```

`spec` is a plain JSON-serialisable `ParsedSpec` — `apiInfo`, `endpoints`,
`requirements`, `diagnostics`. Non-fatal problems arrive as diagnostics; fatal
ones throw `RamlParseError`. Every entity carries `source { file, line }`
provenance pointing at its own key, and lint findings do the same. See [`DESIGN.md`](https://github.com/dickiedyce/RAMLParserTS/blob/main/DESIGN.md) §9–§10 for the model and
[`docs/requirement-tables.md`](https://github.com/dickiedyce/RAMLParserTS/blob/main/docs/requirement-tables.md) for the FR/NFR
extraction grammar.

## Quick tour

The gif above is a real recording of the bundled viewer. To reproduce it:

1. `npm install && npm run build:ui` — builds `viewer/dist/index.html`, one
   self-contained file.
2. Open `viewer/dist/index.html` in a browser (from disk — no server needed).
3. Drop [`examples/demo-inventory-api-1.0.0-raml.zip`](https://github.com/dickiedyce/RAMLParserTS/raw/main/examples/demo-inventory-api-1.0.0-raml.zip)
   onto the page — a synthetic MuleSoft-style export, all content invented.
4. Pick `demo-inventory-api.raml` in the root picker (the zip also holds a tiny
   OpenAPI root so the picker appears).
5. Browse **Endpoints** (params, bodies, examples, security), **Requirements**
   (FR/NFR tables with scope and `file:line` provenance), **Diagnostics** and
   **Raw**.
6. Export `endpoints.md` / `requirements.md`, or print the page.

The demo zip is regenerated from [`examples/demo/`](https://github.com/dickiedyce/RAMLParserTS/tree/main/examples/demo) with
`npm run demo:zip`; the gif is re-recorded with `npm run demo:gif` (Playwright
recording + ffmpeg).

## Viewer

A single-file Svelte viewer for browsing a dropped spec (folder or zip), with
markdown exports and print styles. The built page runs from disk, offline, with
no backend — nothing leaves your machine.

Views: **Endpoints** (with inline lint badges and an "only endpoints with
findings" filter), **Requirements**, **Lint** (documentation omissions grouped
by severity, each with target and `file:line`), **Diagnostics**, **Raw**.
Exports: `endpoints.md`, `requirements.md`, `lint.md`, plus print styles.

```sh
npm run dev:ui     # develop with hot reload
npm run build:ui   # write viewer/dist/index.html (self-contained)
npm run check:ui   # build + Playwright drop-to-render smoke
```

## Development

```sh
npm install
npm run check   # typecheck + lint + tests + build
```

See [`CONTRIBUTING.md`](https://github.com/dickiedyce/RAMLParserTS/blob/main/CONTRIBUTING.md). No CI is configured — run
`npm run check` before pushing. The Playwright smoke (`npm run check:ui`) needs
`npx playwright install chromium` once first.

## Credits

Ported from [RAMLParserKit](https://github.com/dickiedyce/RAMLParserKit) by
Richard Dyce (MIT, Swift).

## License

MIT — see [`LICENSE`](https://github.com/dickiedyce/RAMLParserTS/blob/main/LICENSE).
