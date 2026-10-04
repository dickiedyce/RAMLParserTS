/**
 * Composition entry points (DESIGN.md §9).
 *
 * `parseSpec` resolves then extracts; `parseFiles` is the async convenience
 * layer for browser drop targets (zip bytes or a `FileList`), building a VFS
 * and picking a root before delegating to `parseSpec`.
 */

import { extractSpec } from "./extract.js";
import { RamlParseError } from "./errors.js";
import {
  entriesFromFileList,
  loadFiles,
  loadZip,
  type FileEntry,
} from "./loaders.js";
import type { ParsedSpec } from "./model.js";
import { discoverRoots, resolveSpec } from "./resolve.js";
import type { Vfs } from "./vfs.js";

/** Resolves a spec then extracts the C-hybrid model. */
export function parseSpec(vfs: Vfs, rootPath: string): ParsedSpec {
  return extractSpec(resolveSpec(vfs, rootPath));
}

export interface ParseFilesOptions {
  /** Explicit root; skip root discovery when provided. */
  rootPath?: string;
}

/**
 * Parses a dropped zip (`Uint8Array`/`ArrayBuffer`) or folder (`FileList` /
 * `File[]`). Auto-selects the single discovered root; when several exist the
 * first sorted candidate is used — call `discoverRoots` + `parseSpec` for
 * explicit control.
 */
export async function parseFiles(
  input: ArrayBuffer | Uint8Array | ArrayLike<File>,
  options: ParseFilesOptions = {},
): Promise<ParsedSpec> {
  const vfs = await toVfs(input);
  return parseSpec(vfs, options.rootPath ?? pickRoot(vfs));
}

async function toVfs(
  input: ArrayBuffer | Uint8Array | ArrayLike<File>,
): Promise<Vfs> {
  if (input instanceof Uint8Array) return loadZip(input);
  if (input instanceof ArrayBuffer) return loadZip(new Uint8Array(input));
  return loadFiles(entriesFromFileList(input) as unknown as FileEntry[]);
}

function pickRoot(vfs: Vfs): string {
  const roots = discoverRoots(vfs);
  const first = roots[0];
  if (first === undefined) {
    throw new RamlParseError(
      "no-root-found",
      "No RAML 1.0 or OpenAPI 3.x root document found",
    );
  }
  return first;
}
