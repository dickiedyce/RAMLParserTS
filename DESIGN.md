# RAMLParserTS — Agreed Design (2026-10-04)

Design decisions reached by interview (26 questions). Companion files:
`PARITY.md` (divergence registry vs RAMLParserKit), `docs/requirement-tables.md`
(requirement-table grammar, to be written in Milestone 3).

## 1. Purpose

A TypeScript port of [RAMLParserKit](https://github.com/dickiedyce/RAMLParserKit)
(Swift) for use in static web pages. Two consumers:

1. The in-repo **viewer** (API reference + requirements browsing).
2. A separate **API visualiser** project (out of scope here) consuming the library.

The distinctive feature — FR/NFR requirement-table extraction — is in scope and
must not be dropped.

## 2. Input

- **Drag-and-drop only**: a spec **folder or zip** (both from day one) into the page.
  Builds an in-memory virtual filesystem (`Vfs`: `Map<path, string>`).
- No URL fetching (CORS), no build-time bundling, no paste-only mode required.
- Real source corpus: **MuleSoft Exchange exports** (zip trees with
  `exchange_modules/<uuid>/<lib>/<version>/...`, `data-types/`, `examples/`,
  `overview_files/`, root `.raml`). Synthetic fixtures mimic this structure.
- Include paths may be relative **or root-relative** (`!include /overview_files/...`);
  resolution is against the including file's directory for relative paths and
  against the spec root for leading-`/` paths.

## 3. Deliverable & repo hygiene

- Flat single package (no workspaces): parser in `src/`, Svelte viewer in `viewer/`.
- **Open-source from day one**: MIT `LICENSE` (copyright Richard Dyce), `README.md`,
  `CONTRIBUTING.md`, `.gitignore`, `CHANGELOG.md`, hand-kept semver tags.
- Attribution: README credits "Ported from RAMLParserKit by Richard Dyce (MIT)".

## 4. Supported formats (explicit matrix)

- **RAML 1.0** and **OpenAPI 3.0/3.1** only.
- RAML 0.8, Swagger 2.0: **unsupported — rejected loudly** with a clear error
  (no silent mis-parse). README documents the actual matrix.

## 5. YAML engine & `!include`

- **`yaml` (eemeli)**: YAML 1.2-correct, order-preserving AST, first-class custom tags.
- `!include` is a **proper custom tag** (no regex sentinel hack): resolves at parse
  time against the VFS; each resolved node carries provenance (file, line).
- Non-fatal include failures produce a diagnostic + placeholder (never abort
  the whole parse), but are always surfaced.

## 6. Reference resolution depth

Resolve/expand: OAS3 `$ref` (parameters, responses, securitySchemes, schemas);
RAML `is:` traits (incl. **`<<param>>` node-level substitution** — substituted
values can be object nodes, e.g. included JSON examples); `resourceTypes:`;
`uses:` namespaces for security/type references.

**Not** in scope: RAML type-system evaluation (inheritance, unions, facets
elaboration). `type:` declarations are carried as written.

## 7. Requirement-table extraction (configurable)

- Source of truth: description fields at **resource level and method level**
  (Swift only scrapes method level — a documented divergence), including
  descriptions filled by `!include`d markdown (e.g. `overview_files/ov_*.md`).
- Grammar documented in `docs/requirement-tables.md`; observed convention:
  heading `### Functional Requirements:` / `### Non-Functional Requirements:`,
  FR columns `# | Use Case | Detailed Description | Acceptance Criteria Description`,
  NFR columns id/use-case/description with **optional 4th column** (acceptance
  criteria) parsed when present.
- **Configurable** heading/column mapping (pluggable extractor config).
- Strict validation with structured **diagnostics** (file, line, reason) —
  never silently drop a non-conforming row.

## 8. Fixtures & licensing

- **Synthetic fixtures only** in the public repo, structure-faithful to the
  MuleSoft export layout (invented API content). One small **synthetic demo zip**
  in `examples/` for README/playground use.
- Real exports stay **git-ignored** (`fixtures/local/`), used via a local harness
  that skips when absent. The provided LEAP sample zip must NOT be committed.
- Fixture choice is spec-by-example for the table grammar.

## 9. Public API

Two entry points + composition (JSON-serializable plain data throughout):

- `resolveSpec(vfs, rootPath)` — includes + `$ref` + traits/resourceTypes expanded,
  order preserved → `ResolvedSpec`.
- `extractSpec(resolved)` — extraction view → `ParsedSpec`.
- `parseSpec(vfs, rootPath)` — composition of the two.
- `parseFiles(files)` — async convenience: zip/folder `FileList`/`ArrayBuffer`
  → VFS → `parseSpec`.
- `discoverRoots(vfs)` — valid root candidates (filters `#%RAML 1.0 <Fragment>`
  headers), for UIs that ask the user which file is the root.
- Errors: `RamlParseError` **thrown** on fatal (bad YAML, missing root,
  unsupported format); `diagnostics[]` in every result for non-fatal issues.
- Sync pure core (worker-friendly), async convenience layer only at the edges.

## 10. Data model (C-hybrid)

Native TS/JSON shape; Swift names kept where unambiguous (`ParsedSpec`,
`Endpoint`, `Requirement`, `APIResponse`, `APIInfo`); renames only where Swift
misled (`schemaType` → `type`). Every field justified by sample-export data or a
concrete consumer — no speculative generality. Known additions over Swift:

- `APIInfo.baseUri / protocols / mediaType / documentation[]`
- `Endpoint.requestBody { type, examples }`; resource-level vs method-level
  descriptions distinguished; requirements carry `scope: "resource" | "method"`
- `APIResponse.examples[]` (examples, not just content type)
- `APIParameter`: numeric facets (`minimum`/`maximum` as numbers), string
  constraints where observed; `example` preserves JSON shape (not stringified)
- `SecurityScheme` objects referenced by id (`Endpoint.securitySchemeIds`),
  no duplicated bare-string scheme lists
- `source { file, line }` provenance on requirements and diagnostics
- Swift `id: UUID` fields are **dropped** (Identifiable artifact).

Resource-level description requirements: attached to the resource, visible on
each of its methods with `scope: "resource"`.

## 11. Distribution & browser support

- **Dual build**: ESM + `.d.ts` for bundlers/npm **and** IIFE
  (`window.RAMLParser`) for `<script src>` static pages.
- Runtime is **100% Node-free** (pure `yaml` + `fflate`); enforced by lint ban
  on `node:*`/`fs`/`path` imports. Node is build tooling only.
- Evergreen browsers (Chrome/Edge/Firefox/Safari latest-two); ES2020 target,
  no polyfills. Folder drop via `webkitGetAsEntry` + `webkitdirectory` input;
  no `showDirectoryPicker` dependency.

## 12. Root-file discovery

Drop → scan → picker showing **only valid root candidates** (fragment headers
filtered). If exactly one candidate: auto-select, no picker. API exposes
`discoverRoots()`; the Swift folder-name title/version fallback is **dropped**
(divergence; the viewer may display the input folder name as a label).

## 13. Parity strategy

- **Golden cross-validation harness**: a small local Swift runner (RAMLParserKit
  via SPM, macOS) emits `ParsedSpec` JSON goldens per fixture; the TS suite
  diffs its output through a **TS→Swift projection** against those goldens.
- Intentional divergences live in the `PARITY.md` allowlist; any _unintended_
  delta fails the test. Goldens regenerate locally when fixtures change.
- Private-corpus check runs against `fixtures/local/` when present.

## 14. Viewer (in-repo demo app)

- v1 views: **endpoints** (resource tree, method cards: params, responses,
  security, request/response examples), **requirements** (FR/NFR tables +
  diagnostics), **diagnostics** panel, **raw resolved-tree browser**.
- v1 exports: **markdown downloads** + print stylesheet for PDF via the browser
  print dialog. No PDF library, no ISA generator (that is the Swift app's or a
  later project's job).
- Tests: Vitest + `@testing-library/svelte` component tests carry detail;
  **one Playwright smoke** on the built single-file HTML guards the
  drop→parse→render seam (`npm run check:ui`).

## 15. Naming & copyright

- Repo: `RAMLParserTS`. npm package: `raml-parser-ts` (fallback
  `@<scope>/raml-parser-ts` if the name is taken at publish time).
- LICENSE copyright: Richard Dyce.

## 16. CI, hosting, release

- **No CI.** Local `npm run check` (typecheck + lint + test + build) is the
  single pre-push discipline. No workflows directory, no badges.
- Viewer: **no hosting** — deliverable is `dist` single-file HTML running from disk.
- npm: **manual `npm publish`** from a clean checkout when ready; `package.json`
  kept publish-ready (`exports`, `files`, `prepublishOnly`).

## 17. Milestones

| #   | Milestone       | Contents                                                                                                                                                                | Depends on |
| --- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| 0   | Repo scaffold   | git init, MIT LICENSE, README skeleton, flat `package.json` (publish-ready), tsconfig strict/ES2020, Vitest, lint (with `node:*` ban), `npm run check`, devjournal init | —          |
| 1   | VFS + includes  | `Vfs`, zip (`fflate`) + folder loaders, `!include` custom tag, root-relative + relative resolution, include diagnostics                                                 | 0          |
| 2   | Resolution core | Format detection (RAML 1.0 / OAS3 / loud rejection), `uses:`/trait/resourceType expansion with `<<param>>` node substitution, OAS3 `$ref` resolution, `resolveSpec()`   | 1          |
| 3   | Extraction      | C-hybrid model, RAML + OAS3 endpoint builders, resource+method description sourcing, `parseSpec()`/`parseFiles()`, configurable table extractor + diagnostics           | 2          |
| 4   | Parity harness  | Swift golden runner (local macOS), TS→Swift projection, `PARITY.md` registry, private-corpus script                                                                     | 3          |
| 5   | Viewer          | Svelte drop UI, root picker, four views, markdown exports + print CSS, component tests + one smoke                                                                      | 3          |
| 6   | Release polish  | Full README (demo zip walkthrough), CHANGELOG, `docs/requirement-tables.md`, synthetic `examples/`, tag `v0.1.0`                                                        | 4, 5       |

Working method: **TDD (red-green-refactor)**, commit per completed cycle,
milestones logged via DevJournal. Fixtures written first at each milestone,
modeled on the LEAP sample's structure (content invented).

## 18. Linting (documentation omissions)

Agreed by interview (19 questions, 2026-10-05). Goal: highlight documentation
omissions to the people writing the RAML files.

- **Scope**: lint = **documentation omissions only**. Parser diagnostics remain
  the source of truth for parse-time errors. Deliberate overlap allowed: each
  view is self-contained, so `requirement-missing-acceptance` may appear in
  both Diagnostics and Lint.
- **Placement**: `src/lint.ts` in the **library**, exported from
  `src/index.ts` — the separate API visualiser reuses it; the viewer stays thin.
- **Input**: `lintSpec(parsed, options?)` runs over `ParsedSpec` (omission
  semantics live in the model). Provenance is bought by extending
  `source { file, line }` onto `Endpoint`, `APIParameter`, `APIResponse` and
  `APIInfo` at extraction time, bridged from the `SourceMap` the way
  `extractRequirements` already does.
- **Attribution**: omission findings point at the **entity's own key line**
  (the method key, the parameter key, the response status key) — where the
  writer must add the missing key. Keys contributed by traits, resourceTypes or
  `$ref` expansions carry the definition's file/line.
- **Pipeline**: separate pure call — `parseSpec`/`extractSpec` contracts
  unchanged (§9). The viewer calls `lintSpec` automatically after extraction
  and holds the report in its own state.
- **Finding shape**: `Diagnostic`-shaped **plus a structured `target`**
  (`kind` + `endpointPath`/`method`/`name`/`statusCode`) so the viewer can place
  badges without parsing messages; JSON-serializable plain data throughout.
- **Severity**: two tiers — **warning** for missing descriptions (including
  `endpoint-missing-responses`), **info** for missing examples, missing
  documentation section and requirement-table completeness. Lint never emits
  `error` (errors belong to the parser).
- **Rules** (12, all enabled by default; each rule self-skips when
  inapplicable — requirement-table rules skip OAS3 specs and RAML specs with no
  requirement tables):
  - warning: `endpoint-missing-description` (a resource-level description
    covers its methods), `parameter-missing-description`,
    `response-missing-description`, `api-info-missing-description`,
    `security-scheme-missing-description`, `endpoint-missing-responses`
  - info: `parameter-missing-example`, `response-missing-example`,
    `request-body-missing-example`, `api-info-missing-documentation`,
    `endpoint-missing-requirements`, `requirement-missing-acceptance`
- **Config**: `LintOptions` — per-rule enable/disable plus optional severity
  override (mirrors the `RequirementTableConfig` precedent in §7).
- **Viewer**: fifth **Lint** tab (severity / rule / message / target /
  `file:line`), inline badges on `EndpointCard` and parameter/response rows, a
  single "Only endpoints with findings" toggle on EndpointsView, and a
  standalone **`lint.md`** export (findings grouped by severity) alongside the
  existing exports.
- **Parity**: the TS→Swift projection ignores the new `source` fields
  (additive A10 in PARITY.md) — no golden regeneration, no allowlist entries.
- **Tests**: per-rule unit tests (fires / does not fire / self-skips) with
  inline `createVfs` fixtures; viewer component tests on the `makeSpec()`
  fixture pattern; the Playwright smoke asserts the Lint tab renders.
