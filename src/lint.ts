/**
 * Documentation-omission linting (DESIGN.md §18).
 *
 * A pure pass over the extracted {@link ParsedSpec}: flags missing
 * descriptions, examples, documentation sections and requirement-table gaps.
 * Lint findings are never `error` severity — parse problems belong to the
 * parser's `diagnostics[]`. Overlap with parse-time diagnostics (e.g.
 * `requirement-missing-acceptance`) is deliberate: each view is self-contained.
 *
 * Every rule self-skips where inapplicable: requirement-table rules skip OAS3
 * specs and RAML specs with no requirement tables at all, so a table-less spec
 * never lights up.
 */
import type { Diagnostic, DiagnosticSeverity } from "./diagnostics.js";
import type { ParsedSpec, Source } from "./model.js";

export type LintRuleId =
  | "endpoint-missing-description"
  | "parameter-missing-description"
  | "response-missing-description"
  | "api-info-missing-description"
  | "security-scheme-missing-description"
  | "endpoint-missing-responses"
  | "parameter-missing-example"
  | "response-missing-example"
  | "request-body-missing-example"
  | "api-info-missing-documentation"
  | "endpoint-missing-requirements"
  | "requirement-missing-acceptance";

export type LintTargetKind =
  | "api-info"
  | "endpoint"
  | "parameter"
  | "response"
  | "request-body"
  | "security-scheme"
  | "requirement";

/** Where in the spec a finding points, for badge placement and jump-to. */
export interface LintTarget {
  kind: LintTargetKind;
  endpointPath?: string;
  method?: string;
  /** Parameter or security-scheme name. */
  name?: string;
  /** Response status code. */
  statusCode?: string;
}

/** A diagnostic-shaped finding with a structured target (DESIGN.md §18). */
export interface LintFinding extends Omit<Diagnostic, "includePath"> {
  code: LintRuleId;
  target: LintTarget;
}

export interface LintRuleConfig {
  /** Default `true`. */
  enabled?: boolean;
  /** Overrides the rule's default severity. */
  severity?: DiagnosticSeverity;
}

export interface LintOptions {
  rules?: Partial<Record<LintRuleId, LintRuleConfig>>;
}

export interface LintReport {
  findings: LintFinding[];
}

const DEFAULT_SEVERITY: Record<LintRuleId, DiagnosticSeverity> = {
  "endpoint-missing-description": "warning",
  "parameter-missing-description": "warning",
  "response-missing-description": "warning",
  "api-info-missing-description": "warning",
  "security-scheme-missing-description": "warning",
  "endpoint-missing-responses": "warning",
  "parameter-missing-example": "info",
  "response-missing-example": "info",
  "request-body-missing-example": "info",
  "api-info-missing-documentation": "info",
  "endpoint-missing-requirements": "info",
  "requirement-missing-acceptance": "info",
};

/**
 * Runs the documentation-omission rules over an extracted spec.
 * Deterministic order: api-info, then each endpoint (its own findings, then
 * parameters, request body, responses), security schemes, requirements.
 */
export function lintSpec(
  parsed: ParsedSpec,
  options: LintOptions = {},
): LintReport {
  const findings: LintFinding[] = [];
  const push = (
    code: LintRuleId,
    message: string,
    target: LintTarget,
    source: Source | undefined,
  ): void => {
    const config = options.rules?.[code];
    if (config?.enabled === false) return;
    findings.push({
      code,
      severity: config?.severity ?? DEFAULT_SEVERITY[code],
      message,
      path: source?.file,
      line: source?.line,
      target,
    });
  };

  // Requirement-table rules only apply to RAML specs that have such tables.
  const requirementRulesApply =
    parsed.format === "raml1" && parsed.requirements.length > 0;

  const api = parsed.apiInfo;
  const apiTarget: LintTarget = { kind: "api-info" };
  if (api.description === "") {
    push(
      "api-info-missing-description",
      "API info has no description",
      apiTarget,
      api.source,
    );
  }
  if (api.documentation.length === 0) {
    push(
      "api-info-missing-documentation",
      "API has no documentation section",
      apiTarget,
      api.source,
    );
  }

  for (const [name, scheme] of Object.entries(api.securitySchemes)) {
    if (scheme.description === "") {
      push(
        "security-scheme-missing-description",
        `Security scheme ${name} has no description`,
        { kind: "security-scheme", name },
        scheme.source,
      );
    }
  }

  for (const endpoint of parsed.endpoints) {
    const where = `${endpoint.method} ${endpoint.path}`;
    const target: LintTarget = {
      kind: "endpoint",
      endpointPath: endpoint.path,
      method: endpoint.method,
    };
    const documented =
      endpoint.summary !== "" ||
      endpoint.description !== "" ||
      (endpoint.resourceDescription ?? "") !== "";
    if (!documented) {
      push(
        "endpoint-missing-description",
        `${where} has no summary or description`,
        target,
        endpoint.source,
      );
    }
    if (endpoint.responses.length === 0) {
      push(
        "endpoint-missing-responses",
        `${where} documents no responses`,
        target,
        endpoint.source,
      );
    }
    if (requirementRulesApply && endpoint.requirements.length === 0) {
      push(
        "endpoint-missing-requirements",
        `${where} has no attached requirements`,
        target,
        endpoint.source,
      );
    }

    for (const param of endpoint.parameters) {
      const paramTarget: LintTarget = {
        ...target,
        kind: "parameter",
        name: param.name,
      };
      if (param.description === "") {
        push(
          "parameter-missing-description",
          `Parameter ${param.name} on ${where} has no description`,
          paramTarget,
          param.source,
        );
      }
      if (param.example === undefined) {
        push(
          "parameter-missing-example",
          `Parameter ${param.name} on ${where} has no example`,
          paramTarget,
          param.source,
        );
      }
    }

    const body = endpoint.requestBody;
    if (body !== undefined && Object.keys(body.examples).length === 0) {
      push(
        "request-body-missing-example",
        `Request body of ${where} has no examples`,
        { ...target, kind: "request-body" },
        body.source,
      );
    }

    for (const response of endpoint.responses) {
      const responseTarget: LintTarget = {
        ...target,
        kind: "response",
        statusCode: response.statusCode,
      };
      if (response.description === "") {
        push(
          "response-missing-description",
          `Response ${response.statusCode} of ${where} has no description`,
          responseTarget,
          response.source,
        );
      }
      if (response.body !== undefined && isEmpty(response.body.examples)) {
        push(
          "response-missing-example",
          `Response ${response.statusCode} of ${where} has no examples`,
          responseTarget,
          response.source,
        );
      }
    }
  }

  if (requirementRulesApply) {
    for (const req of parsed.requirements) {
      if (req.acceptanceCriteria === "") {
        push(
          "requirement-missing-acceptance",
          `Requirement ${req.reqId} has no acceptance criteria`,
          { kind: "requirement", name: req.reqId },
          req.source,
        );
      }
    }
  }

  return { findings };
}

function isEmpty(record: Record<string, unknown>): boolean {
  return Object.keys(record).length === 0;
}
