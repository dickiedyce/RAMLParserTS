/**
 * The C-hybrid data model (DESIGN.md §10).
 *
 * Native TS/JSON shape. Swift names are kept where unambiguous (`ParsedSpec`,
 * `Endpoint`, `Requirement`, `APIResponse`); renamed where Swift misled
 * (`schemaType` → `type`). Swift `id: UUID` fields are dropped (Identifiable
 * artifact) — every value here is JSON-serializable plain data.
 *
 * Fields marked "additive" (A1–A8 in PARITY.md) exist in the TS model but not
 * Swift's; the golden cross-validation harness strips them via the TS→Swift
 * projection documented in PARITY.md.
 */

import type { Diagnostic } from "./diagnostics.js";

/** Provenance of a requirement (additive, A6). `line` is 1-based. */
export interface Source {
  /** VFS path the text came from, when known (e.g. an `!include`d markdown). */
  file?: string;
  /** 1-based line within `file`, when known. */
  line?: number;
}

/**
 * Maps an included raw-text value to the VFS file it came from (content →
 * path). Built during include resolution so requirement extraction can
 * attribute scraped rows to their source file.
 */
export type SourceMap = Map<string, string>;

/** An auth scheme, keyed by id in {@link APIInfo.securitySchemes} (A5). */
export interface SecurityScheme {
  /** e.g. `OAuth 2.0`, `Basic Auth`, `Pass Through`, `x-custom`, `anonymous`. */
  type: string;
  /** HTTP auth scheme (`bearer`, `basic`), when applicable (OAS). */
  scheme?: string;
  description: string;
}

/**
 * A query/path/header/cookie parameter. Numeric facets are numbers (A4),
 * `example` keeps its JSON shape (A4), and string constraints are carried (A4).
 */
export interface APIParameter {
  name: string;
  /** `query` | `path` | `header` (RAML) | `cookie` (OAS). */
  location: string;
  required: boolean;
  /** Type declaration, carried as written (A7, was Swift `schemaType`). */
  type: string;
  description: string;
  /** JSON-shaped example value (A4), not stringified. */
  example?: unknown;
  /** Numeric facet (A4). */
  minimum?: number;
  /** Numeric facet (A4). */
  maximum?: number;
  /** String constraint (A4). */
  minLength?: number;
  /** String constraint (A4). */
  maxLength?: number;
  /** String constraint (A4). */
  pattern?: string;
}

/** Named examples keyed by example name (single examples use the key `example`). */
export type ExampleMap = Record<string, unknown>;

/** Request body (additive, A2). Mirrors {@link ResponseBody}. */
export interface RequestBody {
  /** Media type when declared explicitly (`application/json`). */
  contentType?: string;
  /** Type declaration, carried as written. */
  type?: string;
  examples: ExampleMap;
}

/** Response body (additive, A3). Swift's `contentType` maps from `contentType`. */
export interface ResponseBody {
  /** Media type (the body's media-type key, or the root `mediaType`). */
  contentType?: string;
  /** Type declaration, carried as written. */
  type?: string;
  examples: ExampleMap;
}

/** A single response status. */
export interface APIResponse {
  statusCode: string;
  description: string;
  /** Absent when the response declares no body (e.g. `204`). */
  body?: ResponseBody;
}

/** A functional / non-functional requirement scraped from a description table. */
export interface Requirement {
  /** e.g. `FR-S-G-01`. */
  reqId: string;
  /** `FR` or `NFR`. */
  reqType: RequirementType;
  useCase: string;
  description: string;
  acceptanceCriteria: string;
  /**
   * `resource` when the requirement came from a resource-level description
   * (visible on each of the resource's methods), `method` from a method-level
   * description (additive, A6).
   */
  scope: RequirementScope;
  /** Provenance (additive, A6). */
  source?: Source;
}

export type RequirementType = "FR" | "NFR";
export type RequirementScope = "resource" | "method";

/** One HTTP endpoint (method + path). */
export interface Endpoint {
  path: string;
  /** Uppercased HTTP method, e.g. `GET`. */
  method: string;
  /** `displayName` (RAML) / `summary` (OAS). */
  summary: string;
  /** Method-level description. */
  description: string;
  /** Resource-level description (additive; distinct from `description`). */
  resourceDescription?: string;
  parameters: APIParameter[];
  /** Additive (A2). */
  requestBody?: RequestBody;
  responses: APIResponse[];
  /** Method-scope + resource-scope requirements visible here (A6). */
  requirements: Requirement[];
  /** Ids referencing {@link APIInfo.securitySchemes} (A5, was `securitySchemes`). */
  securitySchemeIds: string[];
}

/** A `documentation:` entry (additive, A1). */
export interface DocumentationItem {
  title: string;
  content: string;
}

/** API-level metadata (top-level RAML keys / OAS `info`). */
export interface APIInfo {
  title: string;
  version: string;
  description: string;
  /** Additive (A1). */
  baseUri?: string;
  /** Additive (A1). */
  protocols?: string[];
  /** Additive (A1). */
  mediaType?: string;
  /** Additive (A1). */
  documentation: DocumentationItem[];
  /** Auth schemes keyed by id (Swift parity: keyed by name). */
  securitySchemes: Record<string, SecurityScheme>;
}

/**
 * The extraction view of a resolved spec (DESIGN.md §9).
 * `diagnostics` carries resolution + extraction diagnostics (additive, A8).
 */
export interface ParsedSpec {
  apiInfo: APIInfo;
  endpoints: Endpoint[];
  requirements: Requirement[];
  diagnostics: Diagnostic[];
}
