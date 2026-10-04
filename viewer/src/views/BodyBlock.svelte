<script lang="ts">
  import type { ExampleMap } from "../../../src/index.js";
  import { formatExample } from "../lib/format.js";

  let {
    contentType,
    type,
    examples,
  }: { contentType?: string; type?: string; examples: ExampleMap } = $props();
</script>

<div class="body">
  {#if contentType !== undefined}<p class="content-type">Content type: {contentType}</p>{/if}
  {#if type !== undefined}<p class="type">Type: {type}</p>{/if}
  {#each Object.entries(examples) as [name, value] (name)}
    <p class="example-name"><strong>Example {name}:</strong></p>
    <pre class="example">{formatExample(value)}</pre>
  {/each}
</div>
