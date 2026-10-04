/**
 * RAMLParserTS — parse RAML 1.0 and OpenAPI 3.x in the browser.
 *
 * TypeScript port of RAMLParserKit (Swift, MIT).
 * Public API per DESIGN.md §9; implementation lands in milestones 1–3.
 */
export type { Diagnostic, DiagnosticCode, DiagnosticSeverity } from "./diagnostics.js";
export { RamlParseError } from "./errors.js";
export type { RamlParseErrorCode, RamlParseErrorDetails } from "./errors.js";
export { loadSpecTree } from "./include.js";
export type { SpecTreeResult } from "./include.js";
export { entriesFromFileList, loadFiles, loadZip } from "./loaders.js";
export type { FileEntry } from "./loaders.js";
export { createVfs, normalizePath, resolveIncludePath } from "./vfs.js";
export type { Vfs, VfsEntries } from "./vfs.js";
