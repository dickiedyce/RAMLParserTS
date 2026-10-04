import type { Diagnostic } from "./diagnostics.js";
import { loadSpecTree } from "./include.js";
import { isRecord } from "./util.js";
import { normalizePath, resolveIncludePath, type Vfs } from "./vfs.js";

/**
 * OpenAPI `$ref` resolution (DESIGN.md §6).
 *
 * Walks the tree and replaces `$ref` nodes with their targets: internal JSON
 * pointers (`#/components/...`) and external files (`defs.yaml#/...`), relative
 * to the file containing the ref. The expansion chain is tracked per traversal
 * path; a ref that points at or above its own expansion position is circular
 * and is left as a `$ref` node with a `ref-cycle` diagnostic.
 *
 * Limitation: any mapping with a string `$ref` key is treated as a reference
 * object (OAS 3.0 semantics); `$ref` inside example data is rare and ignored.
 */

interface RefCtx {
  vfs: Vfs;
  diagnostics: Diagnostic[];
  docs: Map<string, unknown>;
  rootPath: string;
}

export function resolveRefs(
  tree: Record<string, unknown>,
  vfs: Vfs,
  rootPath: string,
  diagnostics: Diagnostic[],
): Record<string, unknown> {
  const ctx: RefCtx = {
    vfs,
    diagnostics,
    docs: new Map([[rootPath, tree]]),
    rootPath,
  };
  return walk(ctx, tree, rootPath, "", [`${rootPath}#`]) as Record<
    string,
    unknown
  >;
}

// MARK: - Walking

function walk(
  ctx: RefCtx,
  node: unknown,
  file: string,
  pointer: string,
  chain: string[],
): unknown {
  if (Array.isArray(node)) {
    return node.map((item, i) =>
      walk(ctx, item, file, `${pointer}/${i}`, [
        ...chain,
        `${file}#${pointer}/${i}`,
      ]),
    );
  }
  if (!isRecord(node)) return node;

  const key = `${file}#${pointer}`;
  const here = [...chain, key];
  const ref = node["$ref"];
  if (typeof ref === "string") {
    const resolved = resolveRefNode(ctx, node, ref, file, here);
    if (resolved !== undefined) return resolved;
    // Cycle or unresolvable: keep the node as written (siblings included).
  }

  const out: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(node)) {
    out[name] = walk(
      ctx,
      value,
      file,
      `${pointer}/${escapeSegment(name)}`,
      here,
    );
  }
  return out;
}

function resolveRefNode(
  ctx: RefCtx,
  node: Record<string, unknown>,
  ref: string,
  fromFile: string,
  chain: string[],
): unknown | undefined {
  const hash = ref.indexOf("#");
  const filePart = hash === -1 ? ref : ref.slice(0, hash);
  const pointer = hash === -1 ? "" : ref.slice(hash + 1);
  const file =
    filePart === ""
      ? fromFile
      : normalizePath(resolveIncludePath(fromFile, filePart));
  const targetKey = `${file}#${pointer}`;

  if (chain.includes(targetKey)) {
    ctx.diagnostics.push({
      code: "ref-cycle",
      severity: "warning",
      message: `Circular $ref: ${ref}`,
      includePath: ref,
    });
    return undefined;
  }

  const doc = docFor(ctx, file);
  const target = pointerGet(doc, pointer);
  if (target === undefined) {
    ctx.diagnostics.push({
      code: "ref-not-found",
      severity: "error",
      message: `$ref target not found: ${ref}`,
      includePath: ref,
    });
    return undefined;
  }

  const value = walk(ctx, target, file, pointer, [...chain, targetKey]);

  // Sibling keys next to $ref override the target (OAS 3.1 semantics).
  const siblings = Object.entries(node).filter(([name]) => name !== "$ref");
  if (siblings.length === 0) return value;
  const base: Record<string, unknown> = isRecord(value)
    ? { ...value }
    : { value };
  for (const [name, item] of siblings) {
    base[name] = walk(
      ctx,
      item,
      fromFile,
      `${pointer}/${escapeSegment(name)}`,
      chain,
    );
  }
  return base;
}

function docFor(ctx: RefCtx, file: string): unknown {
  if (!ctx.docs.has(file)) {
    const { value, diagnostics } = loadSpecTree(ctx.vfs, file);
    ctx.diagnostics.push(...diagnostics);
    ctx.docs.set(file, value);
  }
  return ctx.docs.get(file);
}

// MARK: - JSON pointers

function pointerGet(doc: unknown, pointer: string): unknown {
  if (pointer === "") return doc;
  let current: unknown = doc;
  for (const raw of pointer.split("/").slice(1)) {
    const segment = unescapeSegment(raw);
    if (Array.isArray(current)) {
      const index = Number(segment);
      current = Number.isInteger(index) ? current[index] : undefined;
    } else if (isRecord(current)) {
      current = current[segment];
    } else {
      return undefined;
    }
    if (current === undefined) return undefined;
  }
  return current;
}

function escapeSegment(segment: string): string {
  return segment.replace(/~/g, "~0").replace(/\//g, "~1");
}

function unescapeSegment(segment: string): string {
  return segment.replace(/~1/g, "/").replace(/~0/g, "~");
}
