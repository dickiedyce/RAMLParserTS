/**
 * Markdown exports (DESIGN.md §12): an endpoint reference and a requirements
 * digest, ready to paste into ISA/API documentation. Pipe characters inside
 * table cells are escaped so rows never break.
 */
import type {
  APIParameter,
  APIResponse,
  Endpoint,
  ExampleMap,
  ParsedSpec,
} from "../../../src/index.js";
import { formatConstraints, formatExample, sourceLabel } from "./format.js";
import { groupEndpoints } from "./group.js";

interface BodyLike {
  contentType?: string;
  type?: string;
  examples: ExampleMap;
}

export function escapeCell(text: string): string {
  return text.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function bodyLines(body: BodyLike): string[] {
  const lines: string[] = [];
  if (body.contentType !== undefined) {
    lines.push(`- Content type: ${body.contentType}`);
  }
  if (body.type !== undefined) lines.push(`- Type: ${body.type}`);
  for (const [name, value] of Object.entries(body.examples)) {
    lines.push(
      "",
      `**Example ${name}:**`,
      "",
      "```json",
      formatExample(value),
      "```",
    );
  }
  return lines;
}

function paramsTable(params: APIParameter[]): string[] {
  return [
    "| Name | In | Required | Type | Description | Example | Constraints |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...params.map(
      (p) =>
        `| ${escapeCell(p.name)} | ${p.location} | ${p.required ? "yes" : "no"} | ${escapeCell(p.type)} | ${escapeCell(p.description)} | ${escapeCell(formatExample(p.example))} | ${escapeCell(formatConstraints(p))} |`,
    ),
  ];
}

function responseLines(response: APIResponse): string[] {
  const lines = [`#### ${response.statusCode}`, ""];
  if (response.description !== "") lines.push(response.description, "");
  if (response.body !== undefined) lines.push(...bodyLines(response.body));
  return lines;
}

function endpointSection(endpoint: Endpoint): string[] {
  const lines = [`### ${endpoint.method} ${endpoint.path}`, ""];
  if (endpoint.summary !== "")
    lines.push(`**Summary:** ${endpoint.summary}`, "");
  if (endpoint.description !== "") lines.push(endpoint.description, "");
  const security =
    endpoint.securitySchemeIds.length > 0
      ? endpoint.securitySchemeIds.join(", ")
      : "none";
  lines.push(`**Security:** ${security}`, "");
  if (endpoint.parameters.length > 0) {
    lines.push("#### Parameters", "", ...paramsTable(endpoint.parameters), "");
  }
  if (endpoint.requestBody !== undefined) {
    lines.push("#### Request body", "", ...bodyLines(endpoint.requestBody), "");
  }
  if (endpoint.responses.length > 0) {
    lines.push("#### Responses", "");
    for (const response of endpoint.responses) {
      lines.push(...responseLines(response), "");
    }
  }
  if (endpoint.requirements.length > 0) {
    lines.push("#### Requirements", "");
    for (const req of endpoint.requirements) {
      lines.push(
        `- [${req.reqType}] ${req.reqId} (${req.scope}): ${req.description}`,
      );
    }
    lines.push("");
  }
  return lines;
}

/** Full endpoint reference: API info, security schemes, per-resource methods. */
export function buildEndpointsMarkdown(spec: ParsedSpec): string {
  const info = spec.apiInfo;
  const title =
    info.version !== "" ? `${info.title} ${info.version}` : info.title;
  const lines = [`# ${title}`, ""];
  if (info.description !== "") lines.push(info.description, "");
  if (info.baseUri !== undefined) lines.push(`- Base URI: ${info.baseUri}`);
  if (info.protocols !== undefined) {
    lines.push(`- Protocols: ${info.protocols.join(", ")}`);
  }
  if (info.mediaType !== undefined)
    lines.push(`- Media type: ${info.mediaType}`);

  const schemes = Object.entries(info.securitySchemes);
  if (schemes.length > 0) {
    lines.push(
      "",
      "## Security schemes",
      "",
      "| Id | Type | Scheme | Description |",
      "| --- | --- | --- | --- |",
    );
    for (const [id, scheme] of schemes) {
      lines.push(
        `| ${escapeCell(id)} | ${escapeCell(scheme.type)} | ${escapeCell(scheme.scheme ?? "")} | ${escapeCell(scheme.description)} |`,
      );
    }
  }

  for (const group of groupEndpoints(spec.endpoints)) {
    lines.push("", `## ${group.path}`);
    if (
      group.resourceDescription !== undefined &&
      group.resourceDescription !== ""
    ) {
      lines.push("", group.resourceDescription);
    }
    for (const endpoint of group.endpoints) {
      lines.push("", ...endpointSection(endpoint));
    }
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

/** Requirements digest: FR/NFR tables with scope and provenance. */
export function buildRequirementsMarkdown(spec: ParsedSpec): string {
  const lines = [`# Requirements: ${spec.apiInfo.title}`, ""];
  const sections = [
    ["Functional Requirements", "FR"],
    ["Non-Functional Requirements", "NFR"],
  ] as const;
  for (const [heading, type] of sections) {
    const rows = spec.requirements.filter((r) => r.reqType === type);
    lines.push(`## ${heading}`, "");
    if (rows.length === 0) {
      lines.push("None.", "");
      continue;
    }
    lines.push(
      "| # | Use Case | Detailed Description | Acceptance Criteria | Scope | Source |",
      "| --- | --- | --- | --- | --- | --- |",
    );
    for (const r of rows) {
      lines.push(
        `| ${escapeCell(r.reqId)} | ${escapeCell(r.useCase)} | ${escapeCell(r.description)} | ${escapeCell(r.acceptanceCriteria)} | ${r.scope} | ${escapeCell(sourceLabel(r))} |`,
      );
    }
    lines.push("");
  }
  return `${lines.join("\n").trimEnd()}\n`;
}
