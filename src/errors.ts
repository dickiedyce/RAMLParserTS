/**
 * Error codes for fatal parse failures (DESIGN.md §9).
 *
 * Non-fatal issues never throw — they are collected as `Diagnostic`s in the
 * result. `RamlParseError` is reserved for conditions where no useful result
 * can be produced at all.
 */
export type RamlParseErrorCode =
  | "invalid-yaml"
  | "file-not-found"
  | "unsupported-format"
  | "no-root-found";

export interface RamlParseErrorDetails {
  /** Path within the virtual filesystem, when known. */
  path?: string;
  /** 1-based line number, when known. */
  line?: number;
  /** 1-based column number, when known. */
  column?: number;
  /** Anything else worth surfacing. */
  [key: string]: unknown;
}

/** Fatal parse failure. Thrown; never collected as a diagnostic. */
export class RamlParseError extends Error {
  readonly code: RamlParseErrorCode;
  readonly details: RamlParseErrorDetails | undefined;

  constructor(
    code: RamlParseErrorCode,
    message: string,
    details?: RamlParseErrorDetails,
  ) {
    super(message);
    this.name = "RamlParseError";
    this.code = code;
    this.details = details;
  }

  override toString(): string {
    return `${this.name}[${this.code}]: ${this.message}`;
  }
}
