# Requirement tables

The parser scrapes **functional (FR)** and **non-functional (NFR) requirements**
out of RAML/OAS description text — typically markdown pulled in via
`!include`, e.g. MuleSoft exports' `overview_files/ov_*.md`. This document is
the grammar the extractor implements (`src/requirements.ts`), what it
guarantees, and how to reconfigure it.

## Where requirements come from

- **Resource-level descriptions** (`description:` on a resource node) yield
  requirements with `scope: "resource"`; they are attached to the resource and
  visible on each of its methods.
- **Method-level descriptions** yield requirements with `scope: "method"`.
- Each requirement carries `source { file, line }` provenance when its text
  came from an `!include`d file (the row's line within that file).

## Grammar

A description is scanned line by line. Sections are opened by headings:

| Heading (as written)                        | Section |
| ------------------------------------------- | ------- |
| `### Functional Requirements:`              | FR      |
| `### Non-Functional Requirements:`          | NFR     |
| `### Specific Non-Functional Requirements:` | NFR     |

Headings are matched after stripping markdown heading/strong markers and a
trailing colon, case-insensitively, and **exactly** (so prose that merely
mentions "Functional Requirements" does not open a section). Non-functional is
checked first, so the "Non-Functional" substring never lands in the FR section.
Configurable — see below.

Inside a section, pipe-table rows are parsed:

```md
### Functional Requirements:

| #         | Use Case | Detailed Description    | Acceptance Criteria Description |
| --------- | -------- | ----------------------- | ------------------------------- |
| FR-S-G-01 | UC-01    | As a consumer, I want … | Once you provide …              |

### Non-Functional Requirements:

| #          | Use Case | Detailed Description | Acceptance Criteria Description |
| ---------- | -------- | -------------------- | ------------------------------- |
| NFR-S-P-01 | UC-02    | Respond within 2s    | Measured at p95                 |
```

### Columns

| Section | Columns (positional)                                            |
| ------- | --------------------------------------------------------------- |
| FR      | id, use case, description, **acceptance** (expected)            |
| NFR     | id, use case, description, acceptance (**optional** 4th column) |

Row-splitting rules:

- Rows may omit the trailing `|`.
- A middle cell containing an **unescaped** `|` is re-joined into the
  description (columns are anchored left and right: the last column is the
  acceptance criteria when present).
- `\|` is an escaped literal pipe and does not split.
- Header rows (first cell `#`, `ID`, `Req ID`, …) and separator rows (`---`)
  are skipped silently.
- Rows outside any recognised section are ignored.

### Conformance — never a silent drop

A row that does not fit the grammar produces a **diagnostic** with file/line
provenance and is never dropped silently:

| Code                             | When                                                          |
| -------------------------------- | ------------------------------------------------------------- |
| `requirement-missing-id`         | Data row with an empty id — dropped.                          |
| `requirement-row-short`          | Data row with fewer than 3 columns — dropped.                 |
| `requirement-missing-acceptance` | FR row without its acceptance column — kept, acceptance `""`. |

## Result shape

```ts
interface Requirement {
  reqId: string; // e.g. "FR-S-G-01"
  reqType: "FR" | "NFR";
  useCase: string;
  description: string;
  acceptanceCriteria: string;
  scope: "resource" | "method";
  source?: { file?: string; line?: number };
}
```

## Configuration

`parseRequirementTables(text, overrides?)` accepts any subset of
`RequirementTableConfig`:

```ts
import {
  defaultRequirementConfig,
  parseRequirementTables,
} from "raml-parser-ts";

const { rows, diagnostics } = parseRequirementTables(text, {
  functionalHeadings: ["Acceptance Criteria"],
  nonFunctionalHeadings: ["Quality Requirements"],
});

defaultRequirementConfig;
// {
//   functionalHeadings: ["Functional Requirements"],
//   nonFunctionalHeadings: [
//     "Non-Functional Requirements",
//     "Specific Non-Functional Requirements",
//   ],
//   skipFirstCells: ["#", "id", "req id", "requirement id", "ref", …],
//   separatorPattern: /^:?-{2,}:?$/,
// }
```

For full control, subclass the row handling by re-implementing the tiny
`parseRequirementTables` contract (it is a pure function: text in, rows +
diagnostics out).

## Known limitations

- Column order is positional (id / use case / description / acceptance);
  arbitrary column orders need a custom pass.
- An unescaped `|` inside the _acceptance criteria_ cell of an NFR row is
  indistinguishable from an extra column; escape pipes in cell text.
- Heading detection is exact-match after marker stripping; unusual headings
  ("Functional Requirements (FR)") need to be added to the config.
