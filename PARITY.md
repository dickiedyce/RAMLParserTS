# PARITY — Divergences from RAMLParserKit (Swift)

Policy: **spec-correct** (design decision Q5). This file is the allowlist used
by the golden cross-validation harness (Q18): every intentional difference
between RAMLParserTS output and RAMLParserKit output must have an entry here.
Any delta NOT listed fails the parity test.

Status key: the Status column tracks golden-harness allowlisting (M4). All 13
behavioural divergences below are implemented in code (M1–M3); `planned` = not
yet harness-allowlisted, `done` = allowlisted by the golden harness.

## Behavioural divergences

| #   | Area                               | Swift behaviour                                                                                                                          | TS behaviour                                                                                   | Rationale                                                                                                           | Status  |
| --- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------- |
| 1   | URI parameters                     | Read from the _operation_ node                                                                                                           | Read from the _resource_ node (RAML 1.0 semantics)                                             | RAML declares uriParameters on resources; confirmed in MuleSoft exports                                             | planned |
| 2   | queryParameters required           | Defaults to `true`                                                                                                                       | Defaults to `false`                                                                            | RAML 1.0 spec default is `false`                                                                                    | planned |
| 3   | Ordering                           | Endpoints/params/requirements unordered (Yams dicts)                                                                                     | Declaration order preserved (yaml AST)                                                         | Docs conventionally follow source order                                                                             | planned |
| 4   | securedBy `[null]`                 | Stringifies as `"null"`                                                                                                                  | Means "no auth" (anonymous), represented explicitly                                            | RAML semantics                                                                                                      | planned |
| 5   | Requirement sourcing               | Method-level descriptions only                                                                                                           | Resource-level **and** method-level descriptions                                               | Sample export carries FR tables in resource-level descriptions (e.g. `/trials`); Swift would miss them              | planned |
| 6   | Title/version fallback             | Folder-name regex fallback (`name-v1.2.3-raml`)                                                                                          | Removed; title/version from spec keys only                                                     | Spec-correct; viewer may show input folder name as a label                                                          | planned |
| 7   | Non-fatal errors                   | `print()` warnings, placeholder strings                                                                                                  | `diagnostics[]` in results (file/line/reason) + placeholders                                   | No silent failures (Q9); placeholder content may differ                                                             | planned |
| 8   | Unsupported formats                | Swagger 2.0 / RAML 0.8 silently mis-parse                                                                                                | Rejected with clear error                                                                      | Loud failure over silent garbage (Q6)                                                                               | planned |
| 9   | Include resolution                 | Regex sentinel pre-pass                                                                                                                  | Proper `!include` custom tag in YAML parser                                                    | Fixes quoted/flow-context edge cases; result equivalent for well-formed input                                       | done    |
| 10  | Include path base                  | `appendingPathComponent` relative to including file                                                                                      | Relative to including file; **leading-`/` resolved against spec root**                         | MuleSoft exports use root-relative includes (`!include /overview_files/...`)                                        | done    |
| 11  | NFR rows                           | 3 columns; acceptance criteria dropped                                                                                                   | Optional 4th column captured when present                                                      | Accepted interview decision (Q9 sub-point)                                                                          | planned |
| 12  | Trait/resourceType expansion       | None: `is:`/`type:`/`<<param>>` are ignored; methods defined only inside resource types are invisible (e.g. `GET /` in MuleSoft exports) | `uses:`/traits/resourceTypes expanded with `<<param>>` node substitution; OAS3 `$ref` resolved | DESIGN.md §6; real LEAP export yields 14 endpoints vs Swift's 13                                                    | planned |
| 13  | Root-relative includes without `/` | Miss (include-not-found placeholder)                                                                                                     | File-relative first, then spec-root fallback with `include-fallback` warning                   | MuleSoft exports write root-relative include paths without a leading `/`; recovering the target beats a placeholder | planned |

## Additive model divergences (C-hybrid, Q24)

Fields present in TS model but not in Swift's. The golden harness compares via a
**TS→Swift projection**; these fields are stripped by the projection and asserted
separately.

| #   | Addition                                                                 | Justification                                                          |
| --- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| A1  | `APIInfo.baseUri / protocols / mediaType / documentation[]`              | Present in sample export root RAML; viewer needs them                  |
| A2  | `Endpoint.requestBody { type, examples }`                                | Swift `Endpoint` has no request body; sample exports always define one |
| A3  | `APIResponse.examples[]`                                                 | Response bodies carry examples in exports                              |
| A4  | `APIParameter` numeric facets, JSON-shaped `example`, string constraints | Swift `Int?` facets and stringified examples are lossy                 |
| A5  | `Endpoint.securitySchemeIds` referencing `SecurityScheme` objects        | Removes Swift's duplicated bare-string scheme lists                    |
| A6  | `Requirement.scope: "resource" \| "method"` + `source { file, line }`    | Provenance and requirement attachment semantics (Q5 #5, Q24)           |
| A7  | `schemaType` renamed to `type`                                           | Swift name misleads                                                    |
| A8  | `Endpoint.resourceDescription` (resource-level description)         | Q24-B: distinct from method `description` when sourcing requirements |
| A9  | `ParsedSpec.diagnostics` (resolution + extraction diagnostics)      | DESIGN.md §9: diagnostics ride along in every result                 |

Removed vs Swift: `id: UUID` on all models (Swift `Identifiable` artifact;
JSON-serializable output rule, Q14).

## Projection map (TS → Swift shape, for golden diff)

| Swift field                         | TS source                                                            |
| ----------------------------------- | -------------------------------------------------------------------- |
| `APIInfo.title/version/description` | same                                                                 |
| `APIInfo.securitySchemes`           | `securitySchemes` keyed by name                                      |
| `Endpoint.*`                        | same names minus `requestBody`, `resourceDescription`; `securitySchemeIds` → names |
| `APIParameter.schemaType`           | `type`                                                               |
| `APIParameter.example`              | `String(example)`                                                    |
| `APIResponse.contentType`           | `body.contentType`                                                   |
| `Requirement.*`                     | same names minus `scope`, `source`                                   |
| ordering                            | sorted canonically (Swift output is unordered)                       |

## Golden corpus

- Synthetic fixtures in `fixtures/` (public) — goldens committed.
- Real MuleSoft exports in `fixtures/local/` (git-ignored) — golden diff runs
  when present, skipped otherwise. Never committed.
