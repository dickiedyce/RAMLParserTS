/**
 * Shared formatting helpers for the viewer (plain functions, unit-tested).
 */
import type { APIParameter, Requirement } from "../../../src/index.js";

/** Renders an example value for display: raw strings, pretty JSON otherwise. */
export function formatExample(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === undefined) return "";
  return JSON.stringify(value, null, 2) ?? String(value);
}

/** Joins parameter facets/constraints into a short human-readable string. */
export function formatConstraints(param: APIParameter): string {
  const bits: string[] = [];
  if (param.minimum !== undefined) bits.push(`min ${param.minimum}`);
  if (param.maximum !== undefined) bits.push(`max ${param.maximum}`);
  if (param.minLength !== undefined) bits.push(`minLength ${param.minLength}`);
  if (param.maxLength !== undefined) bits.push(`maxLength ${param.maxLength}`);
  if (param.pattern !== undefined) bits.push(`pattern ${param.pattern}`);
  return bits.join(", ");
}

/** Renders a requirement's provenance as `file:line`, or "-" when unknown. */
export function sourceLabel(requirement: Requirement): string {
  const file = requirement.source?.file;
  if (file === undefined) return "-";
  const line = requirement.source?.line;
  return line !== undefined ? `${file}:${line}` : file;
}
