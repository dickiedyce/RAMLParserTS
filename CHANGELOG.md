# Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- No-install viewer distribution: `raml-parser-viewer.html` (the self-contained
  viewer) attached to every GitHub Release, hosted on GitHub Pages at
  https://dickiedyce.github.io/RAMLParserTS/, and a `release-viewer.yml`
  workflow that runs `npm run check`, uploads the asset to the tagged release,
  and deploys Pages on each `v*` tag.

## [0.2.0] - 2026-10-05

### Added

- Documentation-omission linter: `lintSpec(parsed, options?)` with 12 rules
  (missing descriptions, examples, documentation section, responses,
  requirement gaps), per-rule enable/severity overrides, structured finding
  targets, and rule self-skip for inapplicable formats (DESIGN.md §18).
- Key-level provenance: `source { file, line }` on `APIInfo`, `Endpoint`,
  `APIParameter`, `APIResponse`, `RequestBody` and `SecurityScheme`, plus
  `ParsedSpec.format` (additive A10/A11).
- Viewer: **Lint** tab, inline lint badges on endpoint cards, "Only endpoints
  with findings" filter, and `lint.md` export.

## [0.1.1] - 2026-10-04

### Added

- Parity harness: `parity/swift-runner/` (RAMLParserKit-based golden runner,
  macOS), `parity/project.ts` (TS→Swift projection), `parity/diff.ts` (keyed
  golden diff) and `parity/allowlist.json`; `test/parity.test.ts` gates every
  cross-tool delta on a `PARITY.md` entry. Synthetic fixtures with committed
  goldens in `fixtures/`; private corpora via `fixtures/local/`.
  Regenerate goldens with `npm run goldens`.

### Changed

- PARITY.md verified against real Swift goldens: `securedBy: [null]` renders as
  `"<null>"` in Swift (documented as `"null"` before), Swift's NFR-table
  mistyping is documented precisely (#11), and two new entries cover RAML
  security handling (#14) and response body media-type resolution (#15).

## [0.1.0] - 2026-10-04

### Added

- Resolution core: format detection with loud rejection (RAML 0.8 / Swagger 2.0 /
  unknown OpenAPI majors), `discoverRoots` root-candidate detection.
- RAML expansion: `uses:` library inlining, `is:` traits and `type:` resource
  types with `<<param>>` node substitution (incl. implicit
  `<<methodName>>`/`<<resourcePath>>`/`<<resourcePathName>>`) and documented
  precedence rules.
- OpenAPI `$ref` resolution (internal pointers and external files) with
  cycle-safe expansion chains.
- `resolveSpec()` orchestrating includes + format-specific resolution.
- VFS layer (`createVfs`, `normalizePath`, `resolveIncludePath`) with
  root-relative and relative include-path resolution.
- Zip (`loadZip`) and folder (`loadFiles`, `entriesFromFileList`) loaders with
  zip-slip protection.
- `loadSpecTree`: YAML parsing with a real `!include` custom tag — resolves
  RAML/YAML/JSON/plain-text includes against the VFS, detects include cycles,
  and collects non-fatal include problems as diagnostics with file/line
  provenance. Falls back to spec-root resolution for root-relative include
  paths missing a leading `/` (MuleSoft export quirk).
- Project scaffold: MIT licence, build tooling (Vite, TypeScript strict, Vitest,
  ESLint with a Node-builtin ban for library code), `RamlParseError`.
- C-hybrid data model (`src/model.ts`): `APIInfo`, `Endpoint`, `APIParameter`,
  `APIResponse`/`RequestBody`, `Requirement`, `SecurityScheme` — JSON-serializable
  plain data with additive fields (PARITY.md A1–A9): baseUri/protocols/mediaType/
  documentation, request bodies, response examples, numeric facets + JSON-shaped
  examples + string constraints, `securitySchemeIds`, `scope` + `source`
  provenance, `resourceDescription`, and `diagnostics`.
- Extraction (`extractSpec`): RAML + OpenAPI endpoint builders — resource-chain
  `uriParameters`, method `queryParameters`/`headers` (required defaults `false`),
  request/response bodies with named examples, security-scheme resolution and
  `securedBy`/`security` inheritance (`[null]` → explicit anonymous).
- Requirement-table extractor (`parseRequirementTables`): configurable FR/NFR
  grammar (headings + columns), optional NFR acceptance column, escaped-pipe
  splitting, strict diagnostics that never drop a non-conforming row silently.
- Provenance: `SourceMap` records which file an `!include`d text came from;
  requirements carry `source { file, line }` and `scope: "resource" | "method"`.
- `parseSpec()` / `parseFiles()` composition entry points (VFS/zip/FileList →
  resolved + extracted `ParsedSpec`).
- Viewer (`viewer/`): single-file Svelte app (runs from disk, offline) with
  drag-and-drop of spec folders/zips, root-document picker, Endpoints /
  Requirements / Diagnostics / Raw views, markdown exports (`endpoints.md`,
  `requirements.md`) and print styles. Built via `npm run build:ui` to one
  self-contained HTML file.
- Viewer tests: Vitest + @testing-library/svelte component tests (`viewer/tests/`)
  and one Playwright drop-to-render smoke (`npm run check:ui`).
- Synthetic demo export: sources in `examples/demo/`, generated zip
  `examples/demo-inventory-api-1.0.0-raml.zip` (`npm run demo:zip`) — invented
  content, safe to commit and distribute; used by the README tour and the
  viewer demo recording.
- `docs/requirement-tables.md`: the FR/NFR table grammar, conformance
  diagnostics and configuration API.
- README quick tour with a viewer demo GIF (`npm run demo:gif`: Playwright
  recording + ffmpeg).
