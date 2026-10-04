/**
 * Extraction (DESIGN.md §9–§10): turns a {@link ResolvedSpec} into the
 * C-hybrid {@link ParsedSpec}. One builder per format — RAML 1.0 and
 * OpenAPI 3.x — plus the shared requirement-table sourcing.
 *
 * Parameter/response/body shapes follow the RAML 1.0 and OAS 3 semantics:
 * `uriParameters` are read from the resource chain (PARITY.md #1),
 * `queryParameters.required` defaults to `false` (PARITY.md #2), and
 * declaration order is preserved (PARITY.md #3).
 */

import { HTTP_METHODS } from "./expand.js";
import type { Diagnostic } from "./diagnostics.js";
import { parseRequirementTables } from "./requirements.js";
import type {
  APIInfo,
  APIParameter,
  APIResponse,
  DocumentationItem,
  Endpoint,
  ExampleMap,
  ParsedSpec,
  RequestBody,
  Requirement,
  RequirementScope,
  ResponseBody,
  SecurityScheme,
  SourceMap,
} from "./model.js";
import type { ResolvedSpec } from "./resolve.js";
import { isRecord } from "./util.js";

interface Ctx {
  sources: SourceMap;
  diagnostics: Diagnostic[];
  securitySchemes: Record<string, SecurityScheme>;
  requirements: Requirement[];
  rootMediaType?: string;
}

/** Extraction view of a resolved spec (DESIGN.md §9). */
export function extractSpec(resolved: ResolvedSpec): ParsedSpec {
  const ctx: Ctx = {
    sources: resolved.sources,
    diagnostics: [...resolved.diagnostics],
    securitySchemes: {},
    requirements: [],
    rootMediaType:
      typeof resolved.tree["mediaType"] === "string"
        ? resolved.tree["mediaType"]
        : undefined,
  };
  const [apiInfo, endpoints] =
    resolved.format === "raml1"
      ? extractRaml(resolved.tree, ctx)
      : extractOas(resolved.tree, ctx);
  return {
    apiInfo,
    endpoints,
    requirements: ctx.requirements,
    diagnostics: ctx.diagnostics,
  };
}

// MARK: - Shared helpers

function asText(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return "";
}

function asType(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return undefined;
}

function isHttpMethod(key: string): boolean {
  return (HTTP_METHODS as readonly string[]).includes(key.toLowerCase());
}

/** Picks the media-type key from a `body`/`content` node. */
function pickMediaType(keys: string[], preferred?: string): string | undefined {
  if (keys.length === 0) return undefined;
  if (preferred !== undefined && keys.includes(preferred)) return preferred;
  if (keys.includes("application/json")) return "application/json";
  return keys.find((k) => k.includes("/")) ?? keys[0];
}

function buildSecurityScheme(def: unknown): SecurityScheme {
  if (!isRecord(def)) {
    return { type: typeof def === "string" ? def : "", description: "" };
  }
  return {
    type: asType(def["type"]) ?? "",
    scheme: asType(def["scheme"]),
    description: asText(def["description"]),
  };
}

/** Registers an explicit "anonymous" scheme for RAML `securedBy: [null]`. */
function registerAnonymous(ctx: Ctx): void {
  if (!("anonymous" in ctx.securitySchemes)) {
    ctx.securitySchemes["anonymous"] = {
      type: "anonymous",
      description: "No authentication required (public)",
    };
  }
}

/**
 * Converts a `securedBy` node to scheme ids. A `null` entry means explicit
 * anonymous access (PARITY.md #4) and maps to the reserved id `anonymous`.
 * Namespace-qualified refs (`ns.name`) are normalised to `name`.
 */
function securedByToIds(securedBy: unknown, ctx: Ctx): string[] {
  if (securedBy === null || securedBy === undefined) return [];
  const items = Array.isArray(securedBy) ? securedBy : [securedBy];
  const ids: string[] = [];
  for (const item of items) {
    if (item === null) {
      registerAnonymous(ctx);
      ids.push("anonymous");
    } else if (typeof item === "string") {
      const bare = item.includes(".")
        ? item.slice(item.indexOf(".") + 1)
        : item;
      ids.push(bare.trim());
    } else if (isRecord(item)) {
      for (const name of Object.keys(item)) {
        const bare = name.includes(".")
          ? name.slice(name.indexOf(".") + 1)
          : name;
        ids.push(bare.trim());
      }
    }
  }
  return ids;
}

function buildParam(
  name: string,
  def: unknown,
  location: string,
): APIParameter {
  const isPath = location === "path";
  const param: APIParameter = {
    name,
    location,
    required: isPath, // query/header default false (PARITY.md #2); path default true
    type: "string",
    description: "",
  };
  if (typeof def === "string") {
    param.type = def;
  } else if (isRecord(def)) {
    const type = asType(def["type"]);
    if (type !== undefined) param.type = type;
    param.description = asText(def["description"]);
    if ("required" in def && typeof def["required"] === "boolean") {
      param.required = def["required"];
    }
    if ("example" in def) param.example = def["example"];
    if (typeof def["minimum"] === "number") param.minimum = def["minimum"];
    if (typeof def["maximum"] === "number") param.maximum = def["maximum"];
    if (typeof def["minLength"] === "number")
      param.minLength = def["minLength"];
    if (typeof def["maxLength"] === "number")
      param.maxLength = def["maxLength"];
    if (typeof def["pattern"] === "string") param.pattern = def["pattern"];
  } else if (def !== null && def !== undefined) {
    param.type = String(def);
  }
  return param;
}

/**
 * Extracts requirement tables from a description, applying scope and
 * provenance. Table problems become diagnostics carrying the source file/line
 * when the text came from an `!include`d file.
 */
function extractRequirements(
  text: string,
  scope: RequirementScope,
  ctx: Ctx,
): Requirement[] {
  const { rows, diagnostics } = parseRequirementTables(text);
  const file = ctx.sources.get(text);
  for (const d of diagnostics) {
    ctx.diagnostics.push({
      code: d.code,
      severity: d.severity,
      message: d.message,
      path: file,
      line: file !== undefined ? d.line : undefined,
    });
  }
  return rows.map((row) => ({
    reqId: row.reqId,
    reqType: row.reqType,
    useCase: row.useCase,
    description: row.description,
    acceptanceCriteria: row.acceptanceCriteria,
    scope,
    source: { file, line: file !== undefined ? row.line : undefined },
  }));
}

// MARK: - RAML body / examples

function collectRamlExamples(node: Record<string, unknown>): ExampleMap {
  const out: ExampleMap = {};
  const examples = node["examples"];
  if (isRecord(examples)) {
    Object.assign(out, examples);
  } else if (Array.isArray(examples)) {
    examples.forEach((ex, i) => {
      out[String(i)] = ex;
    });
  }
  if ("example" in node) out["example"] = node["example"];
  return out;
}

/**
 * Parses a RAML `body` node: either an implied-media-type form
 * (`{ type, example(s) }`) or a media-type-keyed form
 * (`{ "application/json": { type, example(s) } }`).
 */
function parseRamlBody(body: unknown, rootMediaType?: string): RequestBody {
  if (typeof body === "string") {
    return { contentType: rootMediaType, type: body, examples: {} };
  }
  const node = isRecord(body) ? body : {};
  const hasFacet = "type" in node || "example" in node || "examples" in node;
  if (hasFacet) {
    return {
      contentType: rootMediaType,
      type: asType(node["type"]),
      examples: collectRamlExamples(node),
    };
  }
  const key = pickMediaType(Object.keys(node), rootMediaType);
  if (key === undefined) return { contentType: rootMediaType, examples: {} };
  const inner = node[key];
  if (isRecord(inner)) {
    return {
      contentType: key,
      type: asType(inner["type"]),
      examples: collectRamlExamples(inner),
    };
  }
  return {
    contentType: key,
    type: asType(inner),
    examples: {},
  };
}

// MARK: - RAML extraction

function extractRaml(
  tree: Record<string, unknown>,
  ctx: Ctx,
): [APIInfo, Endpoint[]] {
  gatherRamlSecuritySchemes(tree, ctx);
  const apiInfo: APIInfo = {
    title: asText(tree["title"]),
    version: asText(tree["version"]),
    description: asText(tree["description"]),
    baseUri: asType(tree["baseUri"]),
    protocols: asStringArray(tree["protocols"]),
    mediaType: asType(tree["mediaType"]),
    documentation: extractDocumentation(tree["documentation"]),
    securitySchemes: ctx.securitySchemes,
  };
  const endpoints: Endpoint[] = [];
  walkRamlResources(tree, "", {}, tree["securedBy"], ctx, endpoints);
  return [apiInfo, endpoints];
}

function gatherRamlSecuritySchemes(
  tree: Record<string, unknown>,
  ctx: Ctx,
): void {
  const top = tree["securitySchemes"];
  if (isRecord(top)) {
    for (const [name, def] of Object.entries(top)) {
      ctx.securitySchemes[name] = buildSecurityScheme(def);
    }
  }
  const uses = tree["uses"];
  if (isRecord(uses)) {
    for (const lib of Object.values(uses)) {
      if (!isRecord(lib)) continue;
      const schemes = lib["securitySchemes"];
      if (!isRecord(schemes)) continue;
      for (const [name, def] of Object.entries(schemes)) {
        if (!(name in ctx.securitySchemes)) {
          ctx.securitySchemes[name] = buildSecurityScheme(def);
        }
      }
    }
  }
}

function extractDocumentation(value: unknown): DocumentationItem[] {
  if (!Array.isArray(value)) return [];
  const out: DocumentationItem[] = [];
  for (const item of value) {
    if (isRecord(item)) {
      out.push({
        title: asText(item["title"]),
        content: asText(item["content"]),
      });
    } else if (typeof item === "string") {
      out.push({ title: "", content: item });
    }
  }
  return out;
}

function walkRamlResources(
  node: Record<string, unknown>,
  basePath: string,
  uriAccum: Record<string, unknown>,
  securedBy: unknown,
  ctx: Ctx,
  endpoints: Endpoint[],
): void {
  for (const [key, value] of Object.entries(node)) {
    if (!key.startsWith("/") || !isRecord(value)) continue;
    const path = basePath + key;
    const uriHere = { ...uriAccum, ...uriParamsOf(value) };
    const securedHere = value["securedBy"] ?? securedBy;
    const resourceDesc = asType(value["description"]);
    const resourceReqs =
      resourceDesc !== undefined
        ? extractRequirements(resourceDesc, "resource", ctx)
        : [];
    ctx.requirements.push(...resourceReqs);

    for (const [mk, mv] of Object.entries(value)) {
      if (!isHttpMethod(mk) || !isRecord(mv)) continue;
      endpoints.push(
        buildRamlEndpoint(
          path,
          mk,
          mv,
          uriHere,
          securedHere,
          resourceDesc,
          resourceReqs,
          ctx,
        ),
      );
    }
    walkRamlResources(value, path, uriHere, securedHere, ctx, endpoints);
  }
}

function uriParamsOf(node: Record<string, unknown>): Record<string, unknown> {
  const uri = node["uriParameters"];
  return isRecord(uri) ? uri : {};
}

function buildRamlEndpoint(
  path: string,
  method: string,
  op: Record<string, unknown>,
  uriHere: Record<string, unknown>,
  securedBy: unknown,
  resourceDesc: string | undefined,
  resourceReqs: Requirement[],
  ctx: Ctx,
): Endpoint {
  const description = asText(op["description"]);
  const methodReqs =
    description !== "" ? extractRequirements(description, "method", ctx) : [];
  ctx.requirements.push(...methodReqs);

  const parameters: APIParameter[] = [];
  const pathParams = { ...uriHere, ...uriParamsOf(op) };
  for (const [name, def] of Object.entries(pathParams)) {
    parameters.push(buildParam(name, def, "path"));
  }
  const query = op["queryParameters"];
  if (isRecord(query)) {
    for (const [name, def] of Object.entries(query)) {
      parameters.push(buildParam(name, def, "query"));
    }
  }
  const headers = op["headers"];
  if (isRecord(headers)) {
    for (const [name, def] of Object.entries(headers)) {
      parameters.push(buildParam(name, def, "header"));
    }
  }

  const responses: APIResponse[] = [];
  const respDefs = op["responses"];
  if (isRecord(respDefs)) {
    for (const [statusCode, def] of Object.entries(respDefs)) {
      const r = isRecord(def) ? def : {};
      const body = r["body"];
      responses.push({
        statusCode,
        description: asText(r["description"]),
        body:
          body === null || body === undefined
            ? undefined
            : toResponseBody(parseRamlBody(body, ctx.rootMediaType)),
      });
    }
  }

  const hasBody = op["body"] !== undefined && op["body"] !== null;
  return {
    path,
    method: method.toUpperCase(),
    summary: asText(op["displayName"]),
    description,
    resourceDescription: resourceDesc,
    parameters,
    requestBody: hasBody
      ? parseRamlBody(op["body"], ctx.rootMediaType)
      : undefined,
    responses,
    requirements: [...resourceReqs, ...methodReqs],
    securitySchemeIds: securedByToIds(op["securedBy"] ?? securedBy, ctx),
  };
}

function toResponseBody(body: RequestBody): ResponseBody {
  return {
    contentType: body.contentType,
    type: body.type,
    examples: body.examples,
  };
}

// MARK: - OpenAPI extraction

function extractOas(
  tree: Record<string, unknown>,
  ctx: Ctx,
): [APIInfo, Endpoint[]] {
  const info = isRecord(tree["info"]) ? tree["info"] : {};
  const components = isRecord(tree["components"]) ? tree["components"] : {};
  const schemes = isRecord(components["securitySchemes"])
    ? components["securitySchemes"]
    : {};
  for (const [name, def] of Object.entries(schemes)) {
    ctx.securitySchemes[name] = buildSecurityScheme(def);
  }

  const url = serversUrl(tree);
  const apiInfo: APIInfo = {
    title: asText(info["title"]),
    version: asText(info["version"]),
    description: asText(info["description"]),
    baseUri: url,
    protocols: url === undefined ? undefined : protocolsOfUrl(url),
    mediaType: undefined,
    documentation: [],
    securitySchemes: ctx.securitySchemes,
  };

  const endpoints: Endpoint[] = [];
  const rootSecurity = tree["security"];
  const paths = isRecord(tree["paths"]) ? tree["paths"] : {};
  for (const [path, pathItem] of Object.entries(paths)) {
    if (!isRecord(pathItem)) continue;
    const resourceDesc = asType(pathItem["description"]);
    const resourceReqs =
      resourceDesc !== undefined
        ? extractRequirements(resourceDesc, "resource", ctx)
        : [];
    ctx.requirements.push(...resourceReqs);

    const pathParams = Array.isArray(pathItem["parameters"])
      ? pathItem["parameters"]
      : [];
    for (const [mk, mv] of Object.entries(pathItem)) {
      if (!isHttpMethod(mk) || !isRecord(mv)) continue;
      endpoints.push(
        buildOasEndpoint(
          path,
          mk,
          mv,
          pathParams,
          rootSecurity,
          resourceDesc,
          resourceReqs,
          ctx,
        ),
      );
    }
  }
  return [apiInfo, endpoints];
}

function serversUrl(tree: Record<string, unknown>): string | undefined {
  const servers = tree["servers"];
  if (!Array.isArray(servers)) return undefined;
  const first = servers[0];
  return isRecord(first) ? asType(first["url"]) : undefined;
}

function protocolsOfUrl(url: string): string[] {
  const match = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(url);
  return match === null ? [] : [match[1]?.toLowerCase() ?? ""];
}

function buildOasEndpoint(
  path: string,
  method: string,
  op: Record<string, unknown>,
  pathParams: unknown[],
  rootSecurity: unknown,
  resourceDesc: string | undefined,
  resourceReqs: Requirement[],
  ctx: Ctx,
): Endpoint {
  const description = asText(op["description"]);
  const methodReqs =
    description !== "" ? extractRequirements(description, "method", ctx) : [];
  ctx.requirements.push(...methodReqs);

  const opParams = Array.isArray(op["parameters"]) ? op["parameters"] : [];
  const parameters = mergeOasParams(pathParams, opParams).map((p) =>
    buildOasParam(p),
  );

  const responses: APIResponse[] = [];
  const respDefs = op["responses"];
  if (isRecord(respDefs)) {
    for (const [statusCode, def] of Object.entries(respDefs)) {
      const r = isRecord(def) ? def : {};
      responses.push({
        statusCode,
        description: asText(r["description"]),
        body: buildOasBody(r["content"]),
      });
    }
  }

  return {
    path,
    method: method.toUpperCase(),
    summary: asText(op["summary"]),
    description,
    resourceDescription: resourceDesc,
    parameters,
    requestBody: buildOasBody(
      isRecord(op["requestBody"]) ? op["requestBody"]["content"] : undefined,
    ),
    responses,
    requirements: [...resourceReqs, ...methodReqs],
    securitySchemeIds: oasSecurityToIds(
      "security" in op ? op["security"] : rootSecurity,
    ),
  };
}

function mergeOasParams(
  pathParams: unknown[],
  opParams: unknown[],
): Record<string, unknown>[] {
  const map = new Map<string, Record<string, unknown>>();
  for (const p of [...pathParams, ...opParams]) {
    if (!isRecord(p)) continue;
    map.set(`${asText(p["name"])}|${asText(p["in"])}`, p);
  }
  return [...map.values()];
}

function buildOasParam(param: Record<string, unknown>): APIParameter {
  const schema = isRecord(param["schema"]) ? param["schema"] : {};
  const location = asText(param["in"]) || "query";
  const isPath = location === "path";
  const out: APIParameter = {
    name: asText(param["name"]),
    location,
    required:
      typeof param["required"] === "boolean" ? param["required"] : isPath,
    type: asType(schema["type"]) ?? "string",
    description: asText(param["description"]),
  };
  const example = "example" in schema ? schema["example"] : param["example"];
  if (example !== undefined) out.example = example;
  if (typeof schema["minimum"] === "number") out.minimum = schema["minimum"];
  if (typeof schema["maximum"] === "number") out.maximum = schema["maximum"];
  if (typeof schema["minLength"] === "number")
    out.minLength = schema["minLength"];
  if (typeof schema["maxLength"] === "number")
    out.maxLength = schema["maxLength"];
  if (typeof schema["pattern"] === "string") out.pattern = schema["pattern"];
  return out;
}

function collectOasExamples(media: Record<string, unknown>): ExampleMap {
  const out: ExampleMap = {};
  const examples = media["examples"];
  if (isRecord(examples)) {
    for (const [name, ex] of Object.entries(examples)) {
      out[name] = isRecord(ex) && "value" in ex ? ex["value"] : ex;
    }
  }
  if ("example" in media) out["example"] = media["example"];
  return out;
}

function buildOasBody(content: unknown): RequestBody | undefined {
  if (!isRecord(content)) return undefined;
  const key = pickMediaType(Object.keys(content));
  if (key === undefined) return undefined;
  const media = content[key];
  const schema =
    isRecord(media) && isRecord(media["schema"]) ? media["schema"] : {};
  return {
    contentType: key,
    type: asType(schema["type"]),
    examples: isRecord(media) ? collectOasExamples(media) : {},
  };
}

function oasSecurityToIds(security: unknown): string[] {
  if (!Array.isArray(security)) return [];
  const ids: string[] = [];
  for (const req of security) {
    if (isRecord(req)) ids.push(...Object.keys(req));
  }
  return ids;
}

function asStringArray(value: unknown): string[] | undefined {
  if (Array.isArray(value)) return value.map((v) => String(v));
  if (typeof value === "string") return [value];
  return undefined;
}
