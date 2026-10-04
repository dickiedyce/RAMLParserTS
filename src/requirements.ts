/**
 * Requirement-table extraction (DESIGN.md §7).
 *
 * Scrapes FR/NFR requirement tables out of description text (typically
 * `!include`d markdown such as `overview_files/ov_*.md`). The grammar is
 * configurable — headings and the column layout can be remapped per corpus.
 *
 * Conformance is strict: a row that does not fit the grammar is never dropped
 * silently — it produces a `TableDiagnostic` carrying the line and reason.
 */

import type { DiagnosticSeverity } from "./diagnostics.js";
import type { RequirementType } from "./model.js";

/** How to recognise sections and skip non-data rows. */
export interface RequirementTableConfig {
  /** Lines that open a functional-requirement section. */
  functionalHeadings: string[];
  /** Lines that open a non-functional-requirement section. */
  nonFunctionalHeadings: string[];
  /** First-cell values that mark a header row (skipped). */
  skipFirstCells: string[];
  /** Matches a table separator cell such as `---` or `:---:`. */
  separatorPattern: RegExp;
}

/** A requirement row before scope/provenance are applied by the extractor. */
export interface ParsedRequirementRow {
  reqId: string;
  reqType: RequirementType;
  useCase: string;
  description: string;
  acceptanceCriteria: string;
  /** 1-based line within the parsed text. */
  line: number;
}

export interface TableDiagnostic {
  code: string;
  severity: DiagnosticSeverity;
  message: string;
  /** 1-based line within the parsed text. */
  line: number;
}

export interface TableParseResult {
  rows: ParsedRequirementRow[];
  diagnostics: TableDiagnostic[];
}

const DEFAULT_SKIP_FIRST_CELLS = [
  "#",
  "id",
  "req id",
  "requirement id",
  "ref",
  "reference",
  "use case",
  "category",
  "no",
  "no.",
  "number",
  "name",
];

export const defaultRequirementConfig: RequirementTableConfig = {
  functionalHeadings: ["Functional Requirements"],
  nonFunctionalHeadings: [
    "Non-Functional Requirements",
    "Specific Non-Functional Requirements",
  ],
  skipFirstCells: DEFAULT_SKIP_FIRST_CELLS,
  separatorPattern: /^:?-{2,}:?$/,
};

/**
 * Parses requirement tables out of free text. Headings switch the active
 * section (non-functional is matched before functional, so the
 * "Non-Functional" substring never misclassifies as functional); only pipe
 * rows inside a recognised section are considered.
 */
export function parseRequirementTables(
  text: string,
  overrides?: Partial<RequirementTableConfig>,
): TableParseResult {
  const config: RequirementTableConfig = {
    ...defaultRequirementConfig,
    ...overrides,
  };
  const rows: ParsedRequirementRow[] = [];
  const diagnostics: TableDiagnostic[] = [];
  let section: RequirementType | null = null;

  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = (lines[i] ?? "").trim();
    const lineNo = i + 1;

    const heading = matchHeading(line, config);
    if (heading !== null) {
      section = heading;
      continue;
    }
    if (section === null || !line.startsWith("|")) continue;

    const cells = splitRow(line);
    if (cells.length === 0 || cells.every((cell) => cell === "")) continue;
    if (cells.every((cell) => config.separatorPattern.test(cell))) continue;
    const first = (cells[0] ?? "").toLowerCase();
    if (config.skipFirstCells.includes(first)) continue;

    if (first === "") {
      diagnostics.push({
        code: "requirement-missing-id",
        severity: "warning",
        message: "Requirement row has an empty id",
        line: lineNo,
      });
      continue;
    }
    if (cells.length < 3) {
      diagnostics.push({
        code: "requirement-row-short",
        severity: "warning",
        message: `Requirement row has ${cells.length} column(s); expected at least 3`,
        line: lineNo,
      });
      continue;
    }

    const n = cells.length;
    const useCase = cells[1] ?? "";
    let description: string;
    let acceptanceCriteria: string;
    if (n >= 4) {
      acceptanceCriteria = cells[n - 1] ?? "";
      description = cells.slice(2, n - 1).join(" | ");
    } else {
      description = cells[2] ?? "";
      acceptanceCriteria = "";
      if (section === "FR") {
        diagnostics.push({
          code: "requirement-missing-acceptance",
          severity: "warning",
          message: `Functional requirement ${first} is missing an acceptance criteria column`,
          line: lineNo,
        });
      }
    }

    rows.push({
      reqId: cells[0] ?? "",
      reqType: section,
      useCase,
      description,
      acceptanceCriteria,
      line: lineNo,
    });
  }

  return { rows, diagnostics };
}

/** Detects a section-heading line; returns the section it opens, or null. */
function matchHeading(
  line: string,
  config: RequirementTableConfig,
): RequirementType | null {
  if (line === "" || line.startsWith("|")) return null;
  const stripped = stripMarkers(line);
  // Non-functional is matched first so "…Non-Functional…" never lands in FR.
  if (config.nonFunctionalHeadings.some((h) => stripped === h.toLowerCase())) {
    return "NFR";
  }
  if (config.functionalHeadings.some((h) => stripped === h.toLowerCase())) {
    return "FR";
  }
  return null;
}

/** Strips markdown heading/strong/list markers and a trailing colon. */
function stripMarkers(line: string): string {
  return line
    .replace(/^[#*_\-\s]+/, "")
    .replace(/[:*_\-\s]+$/, "")
    .toLowerCase();
}

/** Splits a pipe row into trimmed cells, honouring `\|` escapes. */
function splitRow(line: string): string[] {
  let s = line;
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|")) s = s.slice(0, -1);
  return s.split(/(?<!\\)\|/).map((cell) => cell.trim().replace(/\\\|/g, "|"));
}
