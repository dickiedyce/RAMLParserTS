import {
  LineCounter,
  isAlias,
  isMap,
  isScalar,
  isSeq,
  parseDocument,
} from "yaml";

import type { Diagnostic } from "./diagnostics.js";
import { RamlParseError } from "./errors.js";
import { normalizePath, resolveIncludePath, type Vfs } from "./vfs.js";

/**
 * Loads a spec from the VFS as a plain JS tree with all `!include` directives
 * resolved (RAML, YAML, JSON and plain-text includes; PARITY.md #9/#10).
 *
 * Fatal problems throw `RamlParseError`; non-fatal include problems are
 * collected as diagnostics and replaced with placeholder strings, so one
 * broken include never aborts the parse (PARITY.md #7).
 */
export interface SpecTreeResult {
  value: unknown;
  diagnostics: Diagnostic[];
}

export function loadSpecTree(vfs: Vfs, rootPath: string): SpecTreeResult {
  const diagnostics: Diagnostic[] = [];
  const path = normalizePath(rootPath);
  const ctx: Ctx = { vfs, diagnostics, stack: [path] };
  return { value: readAndParse(path, ctx), diagnostics };
}

// MARK: - Include tag

/** Marker produced by the `!include` custom tag for later resolution. */
class IncludeTarget {
  constructor(readonly rawPath: string) {}
}

const includeTag = {
  tag: "!include",
  resolve(value: string): IncludeTarget {
    return new IncludeTarget(value.trim());
  },
};

// MARK: - Parsing

interface Ctx {
  vfs: Vfs;
  diagnostics: Diagnostic[];
  /** Normalised paths of the include chain currently being parsed. */
  stack: string[];
}

interface Env {
  ctx: Ctx;
  filePath: string;
  doc: ReturnType<typeof parseDocument>;
  lineCounter: LineCounter;
}

function extension(path: string): string {
  const idx = path.lastIndexOf(".");
  return idx === -1 ? "" : path.slice(idx + 1).toLowerCase();
}

/** Reads and parses one file; dispatches on extension like RAMLParserKit. */
function readAndParse(path: string, ctx: Ctx): unknown {
  const content = ctx.vfs.read(path);
  const ext = extension(path);
  if (ext === "json") return JSON.parse(content) as unknown;
  if (ext === "raml" || ext === "yaml" || ext === "yml") {
    return parseYamlFile(path, content, ctx);
  }
  return content;
}

function parseYamlFile(path: string, content: string, ctx: Ctx): unknown {
  const lineCounter = new LineCounter();
  const doc = parseDocument(content, {
    customTags: [includeTag],
    lineCounter,
  });
  const err = doc.errors[0];
  if (err !== undefined) {
    throw new RamlParseError(
      "invalid-yaml",
      `YAML parse error in ${path}: ${err.message}`,
      {
        path,
        line: lineCounter.linePos(err.pos[0]).line,
        column: lineCounter.linePos(err.pos[0]).col,
      },
    );
  }
  const env: Env = { ctx, filePath: path, doc, lineCounter };
  return doc.contents === null ? null : buildNode(doc.contents, env);
}

// MARK: - Tree building (with include resolution)

function buildNode(node: unknown, env: Env): unknown {
  if (isScalar(node)) {
    const value = node.value;
    if (value instanceof IncludeTarget) {
      return resolveInclude(value, node.range?.[0], env);
    }
    return value;
  }
  if (isMap(node)) {
    const out: Record<string, unknown> = {};
    for (const pair of node.items) {
      out[String(buildNode(pair.key, env))] = buildNode(pair.value, env);
    }
    return out;
  }
  if (isSeq(node)) {
    return node.items.map((item) => buildNode(item, env));
  }
  if (isAlias(node)) {
    const target = node.resolve(env.doc);
    return target === null ? null : buildNode(target, env);
  }
  return null;
}

function resolveInclude(
  target: IncludeTarget,
  offset: number | undefined,
  env: Env,
): unknown {
  const rawPath = target.rawPath;
  let resolved = resolveIncludePath(env.filePath, rawPath);
  const line =
    offset === undefined ? undefined : env.lineCounter.linePos(offset).line;
  const at = { path: env.filePath, line, includePath: rawPath };

  // Lenient fallback (PARITY.md #13): MuleSoft exports sometimes write
  // root-relative includes without a leading "/". If the file-relative path
  // misses but the path exists from the spec root, use it and say so.
  if (
    !env.ctx.vfs.has(resolved) &&
    !rawPath.replace(/\\/g, "/").startsWith("/")
  ) {
    const fallback = normalizePath(rawPath);
    if (env.ctx.vfs.has(fallback)) {
      env.ctx.diagnostics.push({
        code: "include-fallback",
        severity: "warning",
        message: `Include ${rawPath} not found next to ${env.filePath}; resolved from spec root`,
        ...at,
      });
      resolved = fallback;
    }
  }

  if (env.ctx.stack.includes(resolved)) {
    env.ctx.diagnostics.push({
      code: "include-cycle",
      severity: "error",
      message: `Include cycle: ${rawPath}`,
      ...at,
    });
    return `[Include cycle: ${rawPath}]`;
  }
  if (!env.ctx.vfs.has(resolved)) {
    env.ctx.diagnostics.push({
      code: "include-not-found",
      severity: "error",
      message: `Include not found: ${rawPath}`,
      ...at,
    });
    return `[Include not found: ${rawPath}]`;
  }

  env.ctx.stack.push(resolved);
  try {
    return readAndParse(resolved, env.ctx);
  } catch (e) {
    env.ctx.diagnostics.push({
      code: "include-error",
      severity: "error",
      message: `Include error: ${rawPath}: ${e instanceof Error ? e.message : String(e)}`,
      ...at,
    });
    return `[Include error: ${rawPath}]`;
  } finally {
    env.ctx.stack.pop();
  }
}
