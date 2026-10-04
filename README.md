# RAMLParserTS

Parse **RAML 1.0** and **OpenAPI 3.x** specifications into structured data —
in the browser, with no backend and no Node runtime.

Extracted data includes API info, endpoints, parameters, responses, security
schemes, and functional/non-functional requirements from description tables.

> **Status: early development.** See [`DESIGN.md`](DESIGN.md) for the agreed
> design and [`PARITY.md`](PARITY.md) for differences from the Swift original.

## Features

- Parses RAML 1.0 and OpenAPI 3.0/3.1 specifications
- Resolves `!include` directives (RAML, YAML, JSON, plain text) from a
  folder/zip dropped into the page
- Expands RAML traits, resource types, and `uses:` libraries; resolves
  OpenAPI `$ref`s
- Extracts endpoints, parameters, responses, and security schemes
- Extracts functional and non-functional requirements from description tables
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

_(API stabilising — see `DESIGN.md` §9. This section fills in as the parser
lands.)_

## Viewer

A single-file Svelte viewer browses a dropped spec (folder or zip):
Endpoints / Requirements / Diagnostics / Raw views, markdown exports
(`endpoints.md`, `requirements.md`) and print styles. The built page is one
self-contained HTML file that runs from disk, offline, with no backend — nothing
leaves your machine.

```sh
npm run dev:ui     # develop with hot reload
npm run build:ui   # write viewer/dist/index.html (self-contained)
npm run check:ui   # build + Playwright drop-to-render smoke
```

Open `viewer/dist/index.html` in a browser and drop a MuleSoft export (folder
or zip) onto it. When several root documents are present, pick one from the
root picker.

## Development

```sh
npm install
npm run check   # typecheck + lint + tests + build
```

See [`CONTRIBUTING.md`](CONTRIBUTING.md). No CI is configured — run
`npm run check` before pushing. The Playwright smoke (`npm run check:ui`) needs
`npx playwright install chromium` once first.

## Credits

Ported from [RAMLParserKit](https://github.com/dickiedyce/RAMLParserKit) by
Richard Dyce (MIT, Swift).

## License

MIT — see [`LICENSE`](LICENSE).
