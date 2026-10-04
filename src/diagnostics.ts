/**
 * Non-fatal problems found while resolving or extracting a spec.
 *
 * Diiagnostics ride along in results (DESIGN.md §9): fatal conditions throw
 * `RamlParseError`, everything else is collected here so that one broken
 * include or malformed table row never aborts the whole parse.
 */
export type DiagnosticSeverity = "error" | "warning" | "info";

export type DiagnosticCode =
  | "include-not-found"
  | "include-cycle"
  | "include-error"
  | (string & {});

export interface Diagnostic {
  code: DiagnosticCode;
  severity: DiagnosticSeverity;
  message: string;
  /** VFS path of the file where the problem was found, when known. */
  path?: string;
  /** 1-based line in that file, when known. */
  line?: number;
  /** 1-based column in that file, when known. */
  column?: number;
  /** The raw include path as written, for include-related diagnostics. */
  includePath?: string;
}
