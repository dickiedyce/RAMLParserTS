import type { Diagnostic } from "./diagnostics.js";
import { loadSpecTree } from "./include.js";
import { deepClone, isRecord, stringifyValue } from "./util.js";
import { normalizePath, resolveIncludePath, type Vfs } from "./vfs.js";

/**
 * RAML expansion: `uses:` libraries, `is:` traits and `type:` resource types,
 * with `<<param>>` substitution (DESIGN.md §6).
 *
 * Precedence (high -> low): explicit method properties, method `is:` traits
 * (first listed wins), resource `is:` traits, the resource type's method
 * content (including traits the type itself references).
 *
 * Note for parity: RAMLParserKit performs no expansion at all, so specs whose
 * methods live only in resource types (typical of MuleSoft exports) yield
 * fewer endpoints there (PARITY.md #12).
 */

/** HTTP method keys recognised on resources and in resource types. */
export const HTTP_METHODS = [
  "get",
  "put",
  "post",
  "delete",
  "options",
  "head",
  "patch",
  "trace",
] as const;

interface ExpandCtx {
  vfs: Vfs;
  rootPath: string;
  rootTree: Record<string, unknown>;
  diagnostics: Diagnostic[];
  libCache: Map<string, Record<string, unknown> | null>;
}

export function expandRaml(
  tree: Record<string, unknown>,
  vfs: Vfs,
  rootPath: string,
  diagnostics: Diagnostic[],
): Record<string, unknown> {
  const ctx: ExpandCtx = {
    vfs,
    rootPath,
    rootTree: tree,
    diagnostics,
    libCache: new Map(),
  };
  inlineUses(ctx, tree, rootPath);
  walkResources(ctx, tree, "");
  return tree;
}

// MARK: - uses: libraries

function inlineUses(
  ctx: ExpandCtx,
  tree: Record<string, unknown>,
  fromFile: string,
): void {
  const uses = tree["uses"];
  if (!isRecord(uses)) return;
  for (const [ns, raw] of Object.entries(uses)) {
    if (typeof raw !== "string") continue; // already inlined
    const path = normalizePath(resolveIncludePath(fromFile, raw));
    const lib = loadLibrary(ctx, path);
    uses[ns] = lib ?? {};
    if (lib !== null) inlineUses(ctx, lib, path);
  }
}

function loadLibrary(
  ctx: ExpandCtx,
  path: string,
): Record<string, unknown> | null {
  const cached = ctx.libCache.get(path);
  if (cached !== undefined) return cached;
  // Cache before parsing to break circular uses: chains.
  ctx.libCache.set(path, null);
  let result: Record<string, unknown> | null = null;
  if (!ctx.vfs.has(path)) {
    pushDiag(ctx, "library-not-found", `Library not found: ${path}`);
  } else {
    try {
      const { value, diagnostics } = loadSpecTree(ctx.vfs, path);
      ctx.diagnostics.push(...diagnostics);
      if (isRecord(value)) {
        result = value;
      } else {
        pushDiag(ctx, "library-error", `Library is not a mapping: ${path}`);
      }
    } catch (e) {
      pushDiag(
        ctx,
        "library-error",
        `Library error: ${path}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }
  ctx.libCache.set(path, result);
  return result;
}

// MARK: - Definition lookup

interface DefRef {
  name: string;
  params: Record<string, unknown>;
}

interface FoundDef {
  body: Record<string, unknown>;
  scope: Record<string, unknown>;
}

function parseRefList(value: unknown): DefRef[] {
  const items = Array.isArray(value) ? value : [value];
  const out: DefRef[] = [];
  for (const item of items) {
    if (typeof item === "string") {
      out.push({ name: item, params: {} });
    } else if (isRecord(item)) {
      for (const [name, params] of Object.entries(item)) {
        out.push({ name, params: isRecord(params) ? params : {} });
      }
    }
  }
  return out;
}

/**
 * Finds a trait or resource type by name, trying root scope first and then
 * `namespace.name` references through `uses:` chains (longest prefix first).
 */
function lookupDef(
  ctx: ExpandCtx,
  kind: "traits" | "resourceTypes",
  name: string,
  scopes: Array<Record<string, unknown>>,
): FoundDef | null {
  for (const scope of scopes) {
    const bucket = scope[kind];
    if (isRecord(bucket) && isRecord(bucket[name])) {
      return { body: bucket[name] as Record<string, unknown>, scope };
    }
  }
  const segments = name.split(".");
  for (let i = segments.length - 1; i >= 1; i--) {
    const ns = segments.slice(0, i);
    const local = segments.slice(i).join(".");
    for (const scope of scopes) {
      let container: unknown = scope;
      for (const seg of ns) {
        container = isRecord(container) ? container["uses"] : undefined;
        container = isRecord(container) ? container[seg] : undefined;
      }
      if (isRecord(container)) {
        const bucket = container[kind];
        if (isRecord(bucket) && isRecord(bucket[local])) {
          return {
            body: bucket[local] as Record<string, unknown>,
            scope: container,
          };
        }
      }
    }
  }
  return null;
}

// MARK: - <<param>> substitution

const WHOLE = /^<<\s*([\w.-]+)\s*(?:\|\s*([^<>]*))?\s*>>$/;
const EMBED = /<<\s*([\w.-]+)\s*(?:\|\s*([^<>]*))?\s*>>/g;

function substitute(
  ctx: ExpandCtx,
  node: unknown,
  params: Record<string, unknown>,
): unknown {
  if (typeof node === "string")
    return substituteString(ctx, node, params, false);
  if (Array.isArray(node)) {
    return node.map((item) => substitute(ctx, item, params));
  }
  if (isRecord(node)) {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(node)) {
      out[substituteString(ctx, key, params, true)] = substitute(
        ctx,
        value,
        params,
      );
    }
    return out;
  }
  return node;
}

/**
 * Substitutes `<<name>>` / `<<name | default>>` placeholders in a string.
 * A whole-string placeholder takes the parameter's value as a node (it may be
 * an object); embedded placeholders interpolate stringified values. As a
 * mapping key the result is always a string. Unresolved placeholders are left
 * as written and reported as `missing-parameter`.
 */
function substituteString(
  ctx: ExpandCtx,
  text: string,
  params: Record<string, unknown>,
  asKey: boolean,
): string {
  const whole = WHOLE.exec(text);
  if (whole !== null) {
    const name = whole[1] ?? "";
    const fallback = whole[2];
    if (name in params) {
      const value = deepClone(params[name]);
      return asKey ? stringifyValue(value) : (value as string);
    }
    if (fallback !== undefined) return fallback.trim();
    reportMissing(ctx, name);
    return text;
  }
  return text.replace(EMBED, (match, name: string, fallback?: string) => {
    if (name in params) return stringifyValue(params[name]);
    if (fallback !== undefined) return fallback.trim();
    reportMissing(ctx, name);
    return match;
  });
}

function reportMissing(ctx: ExpandCtx, name: string): void {
  pushDiag(
    ctx,
    "missing-parameter",
    `Unresolved parameter <<${name}>> (no value and no default)`,
    "warning",
  );
}

// MARK: - Trait / resource type application

/**
 * Substitutes parameters into a trait or resource-type body and expands any
 * `is:` references inside it (merged underneath the body's own properties).
 */
function buildContribution(
  ctx: ExpandCtx,
  body: unknown,
  params: Record<string, unknown>,
  implicit: Record<string, unknown>,
  scopes: Array<Record<string, unknown>>,
  seen: Set<string>,
): Record<string, unknown> | null {
  const sub = substitute(ctx, body, { ...implicit, ...params });
  if (!isRecord(sub)) return null;
  const result = { ...sub };
  const nested = parseRefList(result["is"]);
  delete result["is"];
  for (const ref of nested) {
    const key = `trait:${ref.name}`;
    if (seen.has(key)) {
      pushDiag(
        ctx,
        "expansion-cycle",
        `Trait cycle via ${ref.name}`,
        "warning",
      );
      continue;
    }
    const found = lookupDef(ctx, "traits", ref.name, scopes);
    if (found === null) {
      pushDiag(
        ctx,
        "trait-not-found",
        `Trait not found: ${ref.name}`,
        "warning",
      );
      continue;
    }
    seen.add(key);
    const contrib = buildContribution(
      ctx,
      found.body,
      ref.params,
      implicit,
      [ctx.rootTree, found.scope],
      seen,
    );
    seen.delete(key);
    if (contrib !== null) mergeUnder(result, contrib);
  }
  return result;
}

function expandResource(
  ctx: ExpandCtx,
  res: Record<string, unknown>,
  path: string,
): void {
  const implicit: Record<string, unknown> = {
    resourcePath: path,
    resourcePathName: lastSegment(path),
  };

  // 1. Resource type contributions (lowest precedence).
  const typeContribs = new Map<string, Record<string, unknown>>();
  const typeRefs = parseRefList(res["type"]);
  delete res["type"];
  for (const ref of typeRefs) {
    const found = lookupDef(ctx, "resourceTypes", ref.name, [ctx.rootTree]);
    if (found === null) {
      pushDiag(
        ctx,
        "resource-type-not-found",
        `Resource type not found: ${ref.name}`,
        "warning",
      );
      continue;
    }
    for (const [key, body] of Object.entries(found.body)) {
      const method = key.toLowerCase();
      const contrib = buildContribution(
        ctx,
        body,
        ref.params,
        HTTP_METHODS.includes(method as (typeof HTTP_METHODS)[number])
          ? { ...implicit, methodName: key }
          : implicit,
        [ctx.rootTree, found.scope],
        new Set(),
      );
      if (contrib === null) continue;
      if (HTTP_METHODS.includes(method as (typeof HTTP_METHODS)[number])) {
        const existing = typeContribs.get(method);
        if (existing !== undefined) mergeUnder(existing, contrib);
        else typeContribs.set(method, contrib);
      } else {
        // Non-method keys (description, uriParameters, ...) land on the
        // resource itself; the resource's own properties win.
        mergeUnder(res, contrib);
      }
    }
  }

  // 2. Traits: resource-level first (lower precedence), then method-level.
  const resourceIs = parseRefList(res["is"]);
  delete res["is"];
  const methodKeys = new Set<string>([
    ...Object.keys(res).filter((key) =>
      HTTP_METHODS.includes(key.toLowerCase() as (typeof HTTP_METHODS)[number]),
    ),
    ...typeContribs.keys(),
  ]);
  for (const method of methodKeys) {
    const explicit: Record<string, unknown> = isRecord(res[method])
      ? { ...(res[method] as Record<string, unknown>) }
      : {};
    const methodIs = parseRefList(explicit["is"]);
    delete explicit["is"];
    const methodImplicit = { ...implicit, methodName: method };
    const merged = explicit;
    for (const ref of [...methodIs, ...resourceIs]) {
      const found = lookupDef(ctx, "traits", ref.name, [ctx.rootTree]);
      if (found === null) {
        pushDiag(
          ctx,
          "trait-not-found",
          `Trait not found: ${ref.name}`,
          "warning",
        );
        continue;
      }
      const contrib = buildContribution(
        ctx,
        found.body,
        ref.params,
        methodImplicit,
        [ctx.rootTree, found.scope],
        new Set(),
      );
      if (contrib !== null) mergeUnder(merged, contrib);
    }
    const typeContrib = typeContribs.get(method);
    if (typeContrib !== undefined) mergeUnder(merged, typeContrib);
    res[method] = merged;
  }
}

function walkResources(
  ctx: ExpandCtx,
  node: Record<string, unknown>,
  basePath: string,
): void {
  for (const [key, value] of Object.entries(node)) {
    if (!key.startsWith("/") || !isRecord(value)) continue;
    const path = basePath + key;
    expandResource(ctx, value, path);
    walkResources(ctx, value, path);
  }
}

// MARK: - Helpers

/**
 * Deep-merges `source` under `target`: existing leaves in `target` win,
 * mappings merge recursively, anything else is kept from `target`.
 */
function mergeUnder(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): void {
  for (const [key, value] of Object.entries(source)) {
    const existing = target[key];
    if (existing === undefined) {
      target[key] = deepClone(value);
    } else if (isRecord(existing) && isRecord(value)) {
      mergeUnder(existing, value);
    }
  }
}

function lastSegment(path: string): string {
  const parts = path.split("/").filter((part) => part !== "");
  return parts[parts.length - 1] ?? "";
}

function pushDiag(
  ctx: ExpandCtx,
  code: string,
  message: string,
  severity: Diagnostic["severity"] = "error",
): void {
  ctx.diagnostics.push({ code, severity, message });
}
