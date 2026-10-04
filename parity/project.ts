/**
 * TS → Swift projection (PARITY.md "Projection map").
 *
 * Maps a TS `ParsedSpec` onto the JSON shape RAMLParserKit (Swift) encodes, so
 * the golden cross-diff compares like with like. Additive TS fields (A1–A9)
 * are dropped; renamed fields are mapped back (`type` → `schemaType`); lossy
 * Swift behaviours are mirrored (`String(describing:)`-style examples, `Int?`
 * facets, `anonymous` → `"<null>"`).
 */

import type {
  APIParameter,
  Endpoint,
  ParsedSpec,
  Requirement,
} from "../src/index.js";

export interface SwiftParameter {
  name: string;
  location: string;
  required: boolean;
  schemaType: string;
  description: string;
  example?: string;
  minimum?: number;
  maximum?: number;
}

export interface SwiftResponse {
  statusCode: string;
  description: string;
  contentType?: string;
}

export interface SwiftRequirement {
  reqId: string;
  reqType: string;
  useCase: string;
  description: string;
  acceptanceCriteria: string;
}

export interface SwiftEndpoint {
  path: string;
  method: string;
  summary: string;
  description: string;
  parameters: SwiftParameter[];
  responses: SwiftResponse[];
  requirements: SwiftRequirement[];
  securitySchemes: string[];
}

export interface SwiftSpec {
  apiInfo: {
    title: string;
    version: string;
    description: string;
    securitySchemes: Record<
      string,
      { type: string; scheme: string; description: string }
    >;
  };
  endpoints: SwiftEndpoint[];
  requirements: SwiftRequirement[];
}

/**
 * Mirrors Swift's `"\(value)"` stringification of YAML values: bare scalars,
 * `["A", "B"]`-style arrays, `["k": v]`-style mappings (keys sorted for
 * determinism — Swift's dictionary order is unspecified).
 */
export function swiftDescribe(value: unknown): string {
  return describe(value, false);
}

function describe(value: unknown, inContainer: boolean): string {
  if (typeof value === "string") {
    return inContainer ? JSON.stringify(value) : value;
  }
  if (value === null || value === undefined) return "null";
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => describe(v, true)).join(", ")}]`;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value).sort(([a], [b]) =>
      a < b ? -1 : a > b ? 1 : 0,
    );
    return `[${entries.map(([k, v]) => `${JSON.stringify(k)}: ${describe(v, true)}`).join(", ")}]`;
  }
  return String(value);
}

function projectRequirement(req: Requirement): SwiftRequirement {
  return {
    reqId: req.reqId,
    reqType: req.reqType,
    useCase: req.useCase,
    description: req.description,
    acceptanceCriteria: req.acceptanceCriteria,
  };
}

function projectParameter(param: APIParameter): SwiftParameter {
  const out: SwiftParameter = {
    name: param.name,
    location: param.location,
    required: param.required,
    schemaType: param.type,
    description: param.description,
  };
  if (param.example !== undefined) out.example = swiftDescribe(param.example);
  // Swift reads facets via `as? Int` — doubles are dropped there.
  if (param.minimum !== undefined && Number.isInteger(param.minimum)) {
    out.minimum = param.minimum;
  }
  if (param.maximum !== undefined && Number.isInteger(param.maximum)) {
    out.maximum = param.maximum;
  }
  return out;
}

function projectEndpoint(endpoint: Endpoint): SwiftEndpoint {
  return {
    path: endpoint.path,
    method: endpoint.method,
    summary: endpoint.summary,
    description: endpoint.description,
    parameters: endpoint.parameters.map(projectParameter),
    responses: endpoint.responses.map((response) => {
      const out: SwiftResponse = {
        statusCode: response.statusCode,
        description: response.description,
      };
      const contentType = response.body?.contentType;
      if (contentType !== undefined) out.contentType = contentType;
      return out;
    }),
    requirements: endpoint.requirements.map(projectRequirement),
    // PARITY.md #4: explicit anonymous access maps to Swift's "<null>" string.
    securitySchemes: endpoint.securitySchemeIds.map((id) =>
      id === "anonymous" ? "<null>" : id,
    ),
  };
}

export function projectToSwift(spec: ParsedSpec): SwiftSpec {
  const schemes: SwiftSpec["apiInfo"]["securitySchemes"] = {};
  for (const [name, scheme] of Object.entries(spec.apiInfo.securitySchemes)) {
    schemes[name] = {
      type: scheme.type,
      scheme: scheme.scheme ?? "",
      description: scheme.description,
    };
  }
  return {
    apiInfo: {
      title: spec.apiInfo.title,
      version: spec.apiInfo.version,
      description: spec.apiInfo.description,
      securitySchemes: schemes,
    },
    endpoints: spec.endpoints.map(projectEndpoint),
    requirements: spec.requirements.map(projectRequirement),
  };
}
