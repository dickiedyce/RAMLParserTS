<script lang="ts">
  import type { ParsedSpec } from "../../../src/index.js";

  let {
    tree,
    spec,
  }: { tree: Record<string, unknown> | null; spec: ParsedSpec } = $props();
</script>

{#if tree !== null}
  <h2>Resolved tree</h2>
  <pre class="raw">{JSON.stringify(tree, null, 2)}</pre>
{/if}
<h2>Parsed model</h2>
<pre class="raw">{JSON.stringify(spec, null, 2)}</pre>
