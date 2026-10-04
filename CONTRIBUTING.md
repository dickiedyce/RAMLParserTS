# Contributing

## Ground rules

- **TDD**: write a failing test first (red), implement the minimum to pass
  (green), refactor. Commit when a cycle is complete.
- **No Node in the library**: `src/` and `viewer/` must run in browsers with no
  Node runtime. The lint config enforces this; tooling under `scripts/` and
  tests are exempt.
- **No CI**: run `npm run check` (typecheck + lint + tests + build) before
  pushing. It must pass.

## Getting started

```sh
npm install
npm run check
```

Useful individual scripts: `npm run test:watch`, `npm run lint`, `npm run build`,
`npm run dev:ui` (viewer dev server), `npm run build:ui` (single-file viewer
build).

## Testing the viewer

- Component tests live in `viewer/tests/` (Vitest + @testing-library/svelte on
  jsdom) and run as part of `npm run check`.
- One Playwright smoke (`viewer/e2e/smoke.spec.ts`) exercises the risky seam —
  drop -> root picker -> parse -> views — through the real built single-file
  HTML. Run it with `npm run check:ui` (kept out of `npm run check` because it
  needs a browser); run `npx playwright install chromium` once first.
- UI work follows TDD: write the component test first, then the component.

## Parity with RAMLParserKit

This library is a port of
[RAMLParserKit](https://github.com/dickiedyce/RAMLParserKit) (Swift). Intentional
behavioural divergences are registered in [`PARITY.md`](PARITY.md) — a
golden-file harness fails on any delta not listed there. If you change parser
behaviour relative to the Swift implementation, add or update a `PARITY.md` entry
in the same commit.

## Fixtures and sample specs

- Public fixtures are **synthetic** (invented API content, MuleSoft-export-like
  structure). Never commit proprietary RAML exports.
- Real corpora belong in `fixtures/local/` (git-ignored); the local harness runs
  against them when present and skips otherwise.

## Design

Broader design decisions live in [`DESIGN.md`](DESIGN.md). Non-obvious changes
should keep it and `PARITY.md` current.
