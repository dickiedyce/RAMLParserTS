# Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
