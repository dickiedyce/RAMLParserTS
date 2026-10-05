/**
 * Lint presentation helpers (DESIGN.md §18): human labels for rule ids and
 * targets, shared by the Lint tab, inline badges and the lint.md export.
 */
import type {
  LintFinding,
  LintRuleId,
  LintTarget,
} from "../../../src/index.js";

/** Short badge text per rule. */
const RULE_LABELS: Record<LintRuleId, string> = {
  "endpoint-missing-description": "no description",
  "parameter-missing-description": "no description",
  "response-missing-description": "no description",
  "api-info-missing-description": "no description",
  "security-scheme-missing-description": "no description",
  "endpoint-missing-responses": "no responses",
  "parameter-missing-example": "no example",
  "response-missing-example": "no examples",
  "request-body-missing-example": "no examples",
  "api-info-missing-documentation": "no documentation",
  "endpoint-missing-requirements": "no requirements",
  "requirement-missing-acceptance": "no acceptance criteria",
};

export function ruleLabel(code: LintRuleId): string {
  return RULE_LABELS[code];
}

/** Human label for a finding's target, e.g. `GET /ping · parameter "q"`. */
export function targetLabel(target: LintTarget): string {
  const where =
    target.endpointPath === undefined
      ? undefined
      : `${target.method ?? ""} ${target.endpointPath}`.trim();
  switch (target.kind) {
    case "api-info":
      return "API info";
    case "endpoint":
      return where ?? "endpoint";
    case "parameter":
      return `${where ?? ""} · parameter "${target.name ?? ""}"`.trim();
    case "response":
      return `${where ?? ""} · response ${target.statusCode ?? ""}`.trim();
    case "request-body":
      return `${where ?? ""} · request body`.trim();
    case "security-scheme":
      return `security scheme "${target.name ?? ""}"`;
    case "requirement":
      return `requirement ${target.name ?? ""}`.trim();
  }
}

/** Findings pointing at one endpoint (any target kind scoped to it). */
export function findingsForEndpoint(
  findings: LintFinding[],
  path: string,
  method: string,
): LintFinding[] {
  return findings.filter(
    (f) => f.target.endpointPath === path && f.target.method === method,
  );
}

/** `file:line` for a finding, or `-` when unknown. */
export function findingLocation(finding: LintFinding): string {
  if (finding.path === undefined) return "-";
  return finding.line !== undefined
    ? `${finding.path}:${finding.line}`
    : finding.path;
}
