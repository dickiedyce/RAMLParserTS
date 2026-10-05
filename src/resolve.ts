import type { Diagnostic } from "./diagnostics.js";
import { RamlParseError } from "./errors.js";
import { expandRaml } from "./expand.js";
import { loadSpecTree } from "./include.js";
import type { SourceMap, SpecFormat } from "./model.js";
import { resolveRefs } from "./refs.js";
import { isRecord } from "./util.js";
import { normalizePath, type Vfs } from "./vfs.js";

/** Spec flavour detected from the root document. */
export type { SpecFormat } from "./model.js";
export interface ResolvedSpec {
  format: SpecFormat;
  /** Fully resolved tree: includes expanded, plus traits/$refs per format. */
  tree: Record<string, unknown>;
  diagnostics: Diagnostic[];
  /** Content → source-file provenance for included raw text. */
  sources: SourceMap;
}

const RAML_HEADER = /^#%RAML\s+(\d+\.\d+)\s*(.*?)\s*$/;

/**
 * Resolves a spec completely (DESIGN.md §9): loads the root with `!include`
 * expansion, detects the format (RAML 1.0 / OpenAPI 3.x — anything else is
 * rejected loudly, PARITY.md #8) and applies format-specific resolution:
 * RAML `uses:`/traits/resourceTypes with `<<param>>` substitution, or OpenAPI
 * `$ref` expansion.
 */
export function resolveSpec(vfs: Vfs, rootPath: string): ResolvedSpec {
  const path = normalizePath(rootPath);
  const raw = vfs.read(path);
  const sources: SourceMap = new Map();
  const { value, diagnostics } = loadSpecTree(vfs, path, sources);
  if (!isRecord(value)) {
    throw new RamlParseError(
      "invalid-yaml",
      `Root of ${path} is not a mapping`,
      { path },
    );
  }
  const format = detectFormat(raw, value, path, diagnostics);
  const tree =
    format === "raml1"
      ? expandRaml(value, vfs, path, diagnostics, sources)
      : resolveRefs(value, vfs, path, diagnostics, sources);
  return { format, tree, diagnostics, sources };
}

/**
 * Lists valid root candidates in the VFS (Q19): RAML 1.0 root documents
 * (fragments and RAML 0.8 filtered out) and OpenAPI 3.x documents.
 * Sorted; callers may auto-select when exactly one is returned.
 */
export function discoverRoots(vfs: Vfs): string[] {
  const out: string[] = [];
  for (const path of vfs.paths) {
    const raw = stripBom(vfs.read(path));
    const firstLine = raw.split(/\r?\n/, 1)[0] ?? "";
    const header = RAML_HEADER.exec(firstLine);
    if (header !== null) {
      // Root RAML 1.0 only: no fragment type on the header line.
      if (header[1] === "1.0" && (header[2] ?? "") === "") out.push(path);
      continue;
    }
    try {
      const { value } = loadSpecTree(vfs, path);
      if (isRecord(value) && isOas3(value)) out.push(path);
    } catch {
      // Unparseable or unsupported file: not a root candidate.
    }
  }
  return out.sort();
}

// MARK: - Format detection

function detectFormat(
  raw: string,
  tree: Record<string, unknown>,
  path: string,
  diagnostics: Diagnostic[],
): SpecFormat {
  const firstLine = stripBom(raw).split(/\r?\n/, 1)[0] ?? "";
  const header = RAML_HEADER.exec(firstLine);
  if (header !== null) {
    const version = header[1] ?? "";
    if (version === "1.0") return "raml1";
    throw unsupported(`RAML ${version}`, path);
  }
  if ("swagger" in tree) {
    throw unsupported(`Swagger ${String(tree["swagger"])}`, path);
  }
  if ("openapi" in tree) {
    const version = String(tree["openapi"]);
    if (/^3(\.|$)/.test(version)) return "openapi3";
    throw unsupported(`OpenAPI ${version}`, path);
  }
  diagnostics.push({
    code: "missing-raml-header",
    severity: "warning",
    message: `No #%RAML header in ${path}; assuming RAML 1.0`,
    path,
  });
  return "raml1";
}

function isOas3(tree: Record<string, unknown>): boolean {
  return "openapi" in tree && /^3(\.|$)/.test(String(tree["openapi"]));
}

function unsupported(found: string, path: string): RamlParseError {
  return new RamlParseError(
    "unsupported-format",
    `Unsupported format: ${found} (only RAML 1.0 and OpenAPI 3.x are supported)`,
    { path },
  );
}

function stripBom(text: string): string {
  return text.startsWith("\uFEFF") ? text.slice(1) : text;
}
