/**
 * Golden cross-diff (PARITY.md "Golden corpus").
 *
 * Compares the projected TS output against the Swift golden. Arrays are
 * aligned by natural key (not index) so Swift's unordered output diffs
 * cleanly (PARITY.md #3). Every delta must match an allowlist entry that
 * points at a PARITY.md divergence; an unlisted delta fails the harness.
 */

export type DeltaKind = "ts-extra" | "ts-missing" | "value";

export interface Delta {
  kind: DeltaKind;
  path: string[];
  tsValue: unknown;
  swiftValue: unknown;
}

export interface AllowlistEntry {
  /** PARITY.md divergence number this entry permits. */
  parity: number;
  /** Restrict to these delta kinds (default: all). */
  kinds?: DeltaKind[];
  /** Segment patterns; `*` matches one segment, `**` matches zero or more. */
  paths: string[][];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function canon(value: unknown): string {
  return JSON.stringify(sortDeep(value));
}

function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (isRecord(value)) {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort())
      out[key] = sortDeep(value[key]);
    return out;
  }
  return value;
}

/** Natural key for array entries so unordered collections align. */
function arrayKey(parent: string, item: unknown, index: number): string {
  if (isRecord(item)) {
    if (parent === "endpoints") {
      return `${String(item["method"])} ${String(item["path"])}`;
    }
    if (parent === "parameters") {
      return `${String(item["name"])} @${String(item["location"])}`;
    }
    if (parent === "responses") return String(item["statusCode"]);
    if (parent === "requirements") return String(item["reqId"]);
  }
  return `#${index}`;
}

export function diffSpecs(
  ts: unknown,
  swift: unknown,
  path: string[] = [],
): Delta[] {
  const deltas: Delta[] = [];
  diffNode(ts, swift, path, deltas);
  return deltas;
}

function diffNode(
  ts: unknown,
  swift: unknown,
  path: string[],
  deltas: Delta[],
): void {
  if (Array.isArray(ts) && Array.isArray(swift)) {
    diffArray(ts, swift, path, deltas);
    return;
  }
  if (isRecord(ts) && isRecord(swift)) {
    const keys = [...new Set([...Object.keys(ts), ...Object.keys(swift)])];
    for (const key of keys) {
      const inTs = key in ts;
      const inSwift = key in swift;
      if (inTs && !inSwift) {
        deltas.push({
          kind: "ts-extra",
          path: [...path, key],
          tsValue: ts[key],
          swiftValue: undefined,
        });
      } else if (!inTs && inSwift) {
        deltas.push({
          kind: "ts-missing",
          path: [...path, key],
          tsValue: undefined,
          swiftValue: swift[key],
        });
      } else {
        diffNode(ts[key], swift[key], [...path, key], deltas);
      }
    }
    return;
  }
  if (canon(ts) !== canon(swift)) {
    deltas.push({
      kind: "value",
      path: [...path],
      tsValue: ts,
      swiftValue: swift,
    });
  }
}

function diffArray(
  ts: unknown[],
  swift: unknown[],
  path: string[],
  deltas: Delta[],
): void {
  const parent = path[path.length - 1] ?? "";
  // Scalar arrays (e.g. securitySchemeIds) are unordered in Swift output.
  const scalar =
    ts.every((v) => !isRecord(v) && !Array.isArray(v)) &&
    swift.every((v) => !isRecord(v) && !Array.isArray(v));
  const tsItems = scalar ? [...ts].map(String).sort() : ts;
  const swiftItems = scalar ? [...swift].map(String).sort() : swift;

  const keyed =
    !scalar &&
    (parent === "endpoints" ||
      parent === "parameters" ||
      parent === "responses" ||
      parent === "requirements");
  if (!keyed) {
    const max = Math.max(tsItems.length, swiftItems.length);
    for (let i = 0; i < max; i += 1) {
      const t = tsItems[i];
      const s = swiftItems[i];
      if (i >= tsItems.length) {
        deltas.push({
          kind: "ts-missing",
          path: [...path, `#${i}`],
          tsValue: undefined,
          swiftValue: s,
        });
      } else if (i >= swiftItems.length) {
        deltas.push({
          kind: "ts-extra",
          path: [...path, `#${i}`],
          tsValue: t,
          swiftValue: undefined,
        });
      } else {
        diffNode(t, s, [...path, `#${i}`], deltas);
      }
    }
    return;
  }

  const tsMap = new Map<string, unknown>();
  const swiftMap = new Map<string, unknown>();
  const seen = new Map<string, number>();
  const keyOf = (item: unknown, i: number): string => {
    const base = arrayKey(parent, item, i);
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base} #${n}`;
  };
  tsItems.forEach((item, i) => tsMap.set(keyOf(item, i), item));
  seen.clear();
  swiftItems.forEach((item, i) => swiftMap.set(keyOf(item, i), item));

  for (const key of [
    ...new Set([...tsMap.keys(), ...swiftMap.keys()]),
  ].sort()) {
    const inTs = tsMap.has(key);
    const inSwift = swiftMap.has(key);
    if (inTs && !inSwift) {
      deltas.push({
        kind: "ts-extra",
        path: [...path, key],
        tsValue: tsMap.get(key),
        swiftValue: undefined,
      });
    } else if (!inTs && inSwift) {
      deltas.push({
        kind: "ts-missing",
        path: [...path, key],
        tsValue: undefined,
        swiftValue: swiftMap.get(key),
      });
    } else {
      diffNode(tsMap.get(key), swiftMap.get(key), [...path, key], deltas);
    }
  }
}

// MARK: - Allowlist

function patternMatches(pattern: string[], path: string[]): boolean {
  let pi = 0;
  let si = 0;
  while (pi < pattern.length && si < path.length) {
    const part = pattern[pi];
    if (part === "**") {
      if (pi === pattern.length - 1) return true;
      for (let skip = si; skip <= path.length; skip += 1) {
        if (patternMatches(pattern.slice(pi + 1), path.slice(skip))) {
          return true;
        }
      }
      return false;
    }
    if (part !== "*" && part !== path[si]) return false;
    pi += 1;
    si += 1;
  }
  // Trailing "**" matches the empty remainder.
  while (pi < pattern.length && pattern[pi] === "**") pi += 1;
  return pi === pattern.length && si === path.length;
}

export interface Classification {
  /** Deltas not covered by any allowlist entry — these fail the harness. */
  unmatched: Delta[];
  /** Entries that matched nothing (stale allowlist) — reported, not fatal. */
  unused: AllowlistEntry[];
}

export function classify(
  deltas: Delta[],
  allowlist: AllowlistEntry[],
): Classification {
  const used = new Set<number>();
  const unmatched: Delta[] = [];
  for (const delta of deltas) {
    let matched = false;
    allowlist.forEach((entry, i) => {
      if (entry.kinds !== undefined && !entry.kinds.includes(delta.kind))
        return;
      if (entry.paths.some((p) => patternMatches(p, delta.path))) {
        matched = true;
        used.add(i);
      }
    });
    if (!matched) unmatched.push(delta);
  }
  return {
    unmatched,
    unused: allowlist.filter((_, i) => !used.has(i)),
  };
}

export function formatDelta(delta: Delta): string {
  return `${delta.kind} ${delta.path.join(" › ")}`;
}
