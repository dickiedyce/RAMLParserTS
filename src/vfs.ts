import { RamlParseError } from "./errors.js";

/**
 * In-memory filesystem: normalised path -> file content.
 *
 * Loaders (`loadZip`, `loadFiles`) build one from a dropped zip or folder;
 * include resolution reads from it. Paths use `/` separators, no leading
 * slash, with `.`/`..` segments resolved.
 */
export interface Vfs {
  has(path: string): boolean;
  /** Reads a file; throws `RamlParseError("file-not-found")` if missing. */
  read(path: string): string;
  /** All normalised paths in the filesystem. */
  readonly paths: string[];
}

export type VfsEntries =
  | Iterable<readonly [string, string]>
  | Record<string, string>;

/**
 * Normalises a path: `/` separators, no leading slash, `.`/`..` resolved.
 * Unresolvable leading `..` segments are kept (the path simply won't match
 * any file).
 */
export function normalizePath(path: string): string {
  const parts = path.replace(/\\/g, "/").split("/");
  const out: string[] = [];
  for (const part of parts) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      const last = out[out.length - 1];
      if (out.length > 0 && last !== "..") {
        out.pop();
      } else {
        out.push("..");
      }
      continue;
    }
    out.push(part);
  }
  return out.join("/");
}

/** Directory portion of a normalised path ("" at the root). */
function dirname(path: string): string {
  const idx = path.lastIndexOf("/");
  return idx === -1 ? "" : path.slice(0, idx);
}

/**
 * Resolves an `!include` target to a normalised VFS path.
 *
 * Targets starting with `/` are resolved against the spec root; everything
 * else is resolved against the including file's directory (RAML semantics,
 * PARITY.md #10).
 */
export function resolveIncludePath(fromFile: string, includePath: string): string {
  const target = includePath.replace(/\\/g, "/");
  if (target.startsWith("/")) return normalizePath(target);
  const dir = dirname(fromFile);
  return normalizePath(dir === "" ? target : `${dir}/${target}`);
}

/** Creates a VFS from path/content pairs (keys are normalised). */
export function createVfs(entries: VfsEntries): Vfs {
  const map = new Map<string, string>();
  const pairs: Iterable<readonly [string, string]> =
    Symbol.iterator in Object(entries)
      ? (entries as Iterable<readonly [string, string]>)
      : Object.entries(entries as Record<string, string>);
  for (const [path, content] of pairs) {
    map.set(normalizePath(path), content);
  }
  return {
    has(path: string): boolean {
      return map.has(normalizePath(path));
    },
    read(path: string): string {
      const key = normalizePath(path);
      const content = map.get(key);
      if (content === undefined) {
        throw new RamlParseError("file-not-found", `Cannot read: ${key}`, {
          path: key,
        });
      }
      return content;
    },
    get paths(): string[] {
      return [...map.keys()];
    },
  };
}
