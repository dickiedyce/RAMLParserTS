import { strFromU8, unzipSync } from "fflate";

import { createVfs, normalizePath, type Vfs } from "./vfs.js";

/** A file read from a dropped folder; `text` reads its content as UTF-8. */
export interface FileEntry {
  path: string;
  text: () => Promise<string>;
}

/** True if a normalised path escapes the spec root (zip-slip guard). */
function isUnsafe(path: string): boolean {
  return path === "" || path === ".." || path.startsWith("../");
}

/**
 * Builds a VFS from zip bytes (e.g. a dropped MuleSoft export).
 * Directory entries and unsafe (zip-slip) paths are skipped.
 */
export function loadZip(bytes: Uint8Array): Vfs {
  const entries: Array<readonly [string, string]> = [];
  for (const [name, data] of Object.entries(unzipSync(bytes))) {
    if (name.endsWith("/")) continue;
    const path = normalizePath(name);
    if (isUnsafe(path)) continue;
    entries.push([path, strFromU8(data)]);
  }
  return createVfs(entries);
}

/**
 * Builds a VFS from files read out of a dropped folder.
 * Unsafe (root-escaping) paths are skipped.
 */
export async function loadFiles(files: Iterable<FileEntry>): Promise<Vfs> {
  const entries: Array<readonly [string, string]> = [];
  for (const file of files) {
    const path = normalizePath(file.path);
    if (isUnsafe(path)) continue;
    entries.push([path, await file.text()]);
  }
  return createVfs(entries);
}

/**
 * Maps DOM `File` objects (from a file input or drag-and-drop) to entries,
 * using `webkitRelativePath` when the browser provides folder context.
 */
export function entriesFromFileList(files: ArrayLike<File>): FileEntry[] {
  return Array.from(files, (file) => {
    const rel = (file as { webkitRelativePath?: string }).webkitRelativePath;
    return {
      path: rel && rel.length > 0 ? rel : file.name,
      text: () => file.text(),
    };
  });
}
