/**
 * Minimal typings for `.svelte` imports so `tsc --noEmit` can type-check the
 * viewer's TypeScript entry points. Component internals are checked by the
 * Svelte compiler at build time (full `svelte-check` is a release-pass item).
 */
declare module "*.svelte" {
  import type { Component } from "svelte";

  const component: Component<Record<string, unknown>>;
  export default component;
}

declare module "*.css";
