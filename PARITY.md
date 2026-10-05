# PARITY — Divergences from RAMLParserKit (Swift)

Policy: **spec-correct** (design decision Q5). This file is the allowlist used
by the golden cross-validation harness (Q18): every intentional difference
between RAMLParserTS output and RAMLParserKit output must have an entry here.
Any delta NOT listed fails the parity test.

Status key: `done` = implemented and accounted for by the M4 golden harness —
covered by the `parity/` projection, the `parity/allowlist.json` allowlist, or
unit tests. All divergences below are done.

## Behavioural divergences

| #   | Area                               | Swift behaviour                                                                                                                                                                                                     | TS behaviour                                                                                                                                                                     | Rationale                                                                                                           | Status |
| --- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------ |
| 1   | URI parameters                     | Read from the _operation_ node                                                                                                                                                                                      | Read from the _resource_ node (RAML 1.0 semantics)                                                                                                                               | RAML declares uriParameters on resources; confirmed in MuleSoft exports                                             | done   |
| 2   | queryParameters required           | Defaults to `true`                                                                                                                                                                                                  | Defaults to `false`                                                                                                                                                              | RAML 1.0 spec default is `false`                                                                                    | done   |
| 3   | Ordering                           | Endpoints/params/requirements unordered (Yams dicts)                                                                                                                                                                | Declaration order preserved (yaml AST); golden diff aligns collections by key                                                                                                    | Docs conventionally follow source order                                                                             | done   |
| 4   | securedBy `[null]`                 | Stringifies as `"<null>"` (NSNull description; verified against golden)                                                                                                                                             | Means "no auth" (anonymous), represented explicitly (`anonymous` id)                                                                                                             | RAML semantics; the projection maps `anonymous` → `"<null>"`                                                        | done   |
| 5   | Requirement sourcing               | Method-level descriptions only                                                                                                                                                                                      | Resource-level **and** method-level descriptions                                                                                                                                 | Sample export carries FR tables in resource-level descriptions (e.g. `/trials`); Swift would miss them              | done   |
| 6   | Title/version fallback             | Folder-name regex fallback (`name-v1.2.3-raml`)                                                                                                                                                                     | Removed; title/version from spec keys only                                                                                                                                       | Spec-correct; viewer may show input folder name as a label                                                          | done   |
| 7   | Non-fatal errors                   | `print()` warnings, placeholder strings                                                                                                                                                                             | `diagnostics[]` in results (file/line/reason) + placeholders                                                                                                                     | No silent failures (Q9); placeholder content may differ                                                             | done   |
| 8   | Unsupported formats                | Swagger 2.0 / RAML 0.8 silently mis-parse                                                                                                                                                                           | Rejected with clear error                                                                                                                                                        | Loud failure over silent garbage (Q6)                                                                               | done   |
| 9   | Include resolution                 | Regex sentinel pre-pass                                                                                                                                                                                             | Proper `!include` custom tag in YAML parser                                                                                                                                      | Fixes quoted/flow-context edge cases; result equivalent for well-formed input                                       | done   |
| 10  | Include path base                  | `appendingPathComponent` relative to including file                                                                                                                                                                 | Relative to including file; **leading-`/` resolved against spec root**                                                                                                           | MuleSoft exports use root-relative includes (`!include /overview_files/...`)                                        | done   |
| 11  | NFR rows                           | Heading match `contains("Functional Requirements")` also fires for "Non-Functional …" headings: every scraped row is typed `FR`, rows with fewer than 4 columns are dropped, and a 4-column NFR row appears as `FR` | Non-functional headings matched first; rows typed `NFR`; optional 4th column captured when present                                                                               | Swift mistypes/drops NFR rows (verified against golden); accepted interview decision (Q9 sub-point)                 | done   |
| 12  | Trait/resourceType expansion       | None: `is:`/`type:`/`<<param>>` are ignored; methods defined only inside resource types are invisible (e.g. `GET /` in MuleSoft exports)                                                                            | `uses:`/traits/resourceTypes expanded with `<<param>>` node substitution; OAS3 `$ref` resolved                                                                                   | DESIGN.md §6; real LEAP export yields 14 endpoints vs Swift's 13                                                    | done   |
| 13  | Root-relative includes without `/` | Miss (include-not-found placeholder)                                                                                                                                                                                | File-relative first, then spec-root fallback with `include-fallback` warning                                                                                                     | MuleSoft exports write root-relative include paths without a leading `/`; recovering the target beats a placeholder | done   |
| 14  | Security (RAML)                    | Synthesises one `securitySchemes["default"]` (`type: "RAML Security"`, `scheme` = raw `securedBy` entries joined); endpoint `securitySchemes` = method-level `securedBy` only, raw strings                          | Parses `securitySchemes`/`uses:` libraries into named `SecurityScheme` objects; endpoint ids inherit root/resource `securedBy`, normalise `ns.name` → `name`, explicit anonymous | A5; verified against golden (`default` vs named schemes)                                                            | done   |
| 15  | Response body media type           | `contentType = body.keys.first` — an arbitrary facet key (`type`/`example`) for implied-media-type bodies                                                                                                           | Implied-media-type bodies resolve to the root `mediaType`; facet keys are never media types                                                                                      | Swift's mapping-key order is nondeterministic; verified against golden                                              | done   |

## Additive model divergences (C-hybrid, Q24)

Fields present in TS model but not in Swift's. The golden harness compares via a
**TS→Swift projection**; these fields are stripped by the projection and asserted
separately.

| #   | Addition                                                                                                    | Justification                                                          |
| --- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| A1  | `APIInfo.baseUri / protocols / mediaType / documentation[]`                                                 | Present in sample export root RAML; viewer needs them                  |
| A2  | `Endpoint.requestBody { type, examples }`                                                                   | Swift `Endpoint` has no request body; sample exports always define one |
| A3  | `APIResponse.examples[]`                                                                                    | Response bodies carry examples in exports                              |
| A4  | `APIParameter` numeric facets, JSON-shaped `example`, string constraints                                    | Swift `Int?` facets and stringified examples are lossy                 |
| A5  | `Endpoint.securitySchemeIds` referencing `SecurityScheme` objects                                           | Removes Swift's duplicated bare-string scheme lists                    |
| A6  | `Requirement.scope: "resource" \| "method"` + `source { file, line }`                                       | Provenance and requirement attachment semantics (Q5 #5, Q24)           |
| A7  | `schemaType` renamed to `type`                                                                              | Swift name misleads                                                    |
| A8  | `Endpoint.resourceDescription` (resource-level description)                                                 | Q24-B: distinct from method `description` when sourcing requirements   |
| A9  | `ParsedSpec.diagnostics` (resolution + extraction diagnostics)                                              | DESIGN.md §9: diagnostics ride along in every result                   |
| A10 | `source { file, line }` on `APIInfo`/`Endpoint`/`APIParameter`/`APIResponse`/`RequestBody`/`SecurityScheme` | Key-level provenance for lint findings (DESIGN.md §18)                 |
| A11 | `ParsedSpec.format: SpecFormat`                                                                             | Lets lint rules self-skip per format (DESIGN.md §18)                   |

Removed vs Swift: `id: UUID` on all models (Swift `Identifiable` artifact;
JSON-serializable output rule, Q14).

## Projection map (TS → Swift shape, for golden diff)

| Swift field                         | TS source                                                                                                     |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `APIInfo.title/version/description` | same                                                                                                          |
| `APIInfo.securitySchemes`           | `securitySchemes` keyed by name                                                                               |
| `Endpoint.*`                        | same names minus `requestBody`, `resourceDescription`; `securitySchemeIds` → names (`anonymous` → `"<null>"`) |
| `APIParameter.schemaType`           | `type`                                                                                                        |
| `APIParameter.example`              | `String(describing:)` form (see `swiftDescribe`)                                                              |
| `APIResponse.contentType`           | `body.contentType`                                                                                            |
| `Requirement.*`                     | same names minus `scope`, `source`                                                                            |
| `source` (A10) / `format` (A11)     | ignored by the projection — TS-only lint provenance, no golden impact                                         |
| ordering                            | keyed alignment by natural key — ordering ignored (Swift output is unordered)                                 |

## Golden corpus

- Synthetic fixtures in `fixtures/` (public) — goldens committed:
  - `fixtures/basic-raml/` and `fixtures/basic-oas/` — clean specs; expect
    **zero deltas** beyond the projection.
  - `fixtures/leap-style-raml/` — traits, resource types, security and
    requirement tables; its deltas exercise #1, #2, #5, #11, #12, #14, #15.
- Real MuleSoft exports in `fixtures/local/` (git-ignored) — the golden diff
  runs against them when present, skipped otherwise. Never committed.
- Goldens are generated on macOS with RAMLParserKit itself: `npm run goldens`
  (builds `parity/swift-runner/`, writes `fixtures/*/golden.swift.json`).
- The harness (`test/parity.test.ts`) projects the TS output through
  `parity/project.ts`, diffs against the goldens with keyed alignment
  (`parity/diff.ts`), and gates every delta on `parity/allowlist.json` — each
  entry cites the divergence number above. **Unlisted deltas fail the test**;
  stale allowlist entries are reported.
