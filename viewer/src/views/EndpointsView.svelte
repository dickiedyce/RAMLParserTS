<script lang="ts">
  import type { ParsedSpec } from "../../../src/index.js";
  import { groupEndpoints } from "../lib/group.js";
  import EndpointCard from "./EndpointCard.svelte";

  let { spec }: { spec: ParsedSpec } = $props();
  const groups = $derived(groupEndpoints(spec.endpoints));
</script>

{#if spec.endpoints.length === 0}
  <p class="empty">No endpoints found.</p>
{/if}

{#each groups as group (group.path)}
  <section class="resource">
    <h2>{group.path}</h2>
    {#if group.resourceDescription !== undefined && group.resourceDescription !== ""}
      <p class="resource-desc">{group.resourceDescription}</p>
    {/if}
    {#each group.endpoints as endpoint (endpoint.method + "|" + endpoint.path)}
      <EndpointCard {endpoint} />
    {/each}
  </section>
{/each}
