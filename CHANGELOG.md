# Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- VFS layer (`createVfs`, `normalizePath`, `resolveIncludePath`) with
  root-relative and relative include-path resolution.
- Zip (`loadZip`) and folder (`loadFiles`, `entriesFromFileList`) loaders with
  zip-slip protection.
- `loadSpecTree`: YAML parsing with a real `!include` custom tag — resolves
  RAML/YAML/JSON/plain-text includes against the VFS, detects include cycles,
  and collects non-fatal include problems as diagnostics with file/line
  provenance.
- Project scaffold: MIT licence, build tooling (Vite, TypeScript strict, Vitest,
  ESLint with a Node-builtin ban for library code), `RamlParseError`.
