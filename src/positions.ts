/**
 * Key-level provenance (DESIGN.md §18).
 *
 * Parsing turns YAML nodes into plain JS objects; this registry remembers,
 * per mapping object, where each of its keys was written (`file:line`) so
 * extraction can attribute model entities to their own key line. Trait,
 * resource-type and `$ref` expansion rebuilds objects, so every rebuild copies
 * its entries across (`copyKeyPos`) — a key contributed from a library keeps
 * the library's file/line.
 *
 * A `WeakMap` keyed by object identity keeps the tree itself plain JSON data
 * and needs no threading through call signatures; entries die with their
 * objects.
 */
import type { Source } from "./model.js";

type KeyMap = Map<string, Source>;
const registry = new WeakMap<object, KeyMap>();

/** Records where `key` of mapping `target` was written (no-op when unknown). */
export function setKeyPos(
  target: object,
  key: string,
  source: Source | undefined,
): void {
  if (source === undefined) return;
  let map = registry.get(target);
  if (map === undefined) {
    map = new Map();
    registry.set(target, map);
  }
  map.set(key, source);
}

/** Where `key` of mapping `target` was written, when known. */
export function keyPos(
  target: object | undefined,
  key: string,
): Source | undefined {
  if (target === undefined) return undefined;
  return registry.get(target)?.get(key);
}

/**
 * Copies every recorded key position from `from` onto `to`, later entries
 * overwriting earlier ones (matches `{ ...a, ...b }` semantics when called in
 * spread order).
 */
export function copyKeyPos(from: object, to: object): void {
  const map = registry.get(from);
  if (map === undefined) return;
  for (const [key, source] of map) setKeyPos(to, key, source);
}

/**
 * `{ ...a, ...b }` that also carries key provenance: later records win,
 * matching spread semantics.
 */
export function mergeRecords(
  ...records: Array<Record<string, unknown> | undefined>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const record of records) {
    if (record === undefined) continue;
    Object.assign(out, record);
    copyKeyPos(record, out);
  }
  return out;
}
