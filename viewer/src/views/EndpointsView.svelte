<script lang="ts">
  import type { LintFinding, ParsedSpec } from "../../../src/index.js";
  import { groupEndpoints } from "../lib/group.js";
  import { findingsForEndpoint } from "../lib/lint.js";
  import EndpointCard from "./EndpointCard.svelte";

  let {
    spec,
    findings = [],
  }: { spec: ParsedSpec; findings?: LintFinding[] } = $props();

  let onlyWithFindings = $state(false);

  const groups = $derived(
    groupEndpoints(
      onlyWithFindings
        ? spec.endpoints.filter(
            (e) => findingsForEndpoint(findings, e.path, e.method).length > 0,
          )
        : spec.endpoints,
    ),
  );
</script>

<label class="lint-filter no-print">
  <input type="checkbox" bind:checked={onlyWithFindings} />
  Only endpoints with findings
</label>

{#if spec.endpoints.length === 0}
  <p class="empty">No endpoints found.</p>
{:else if groups.length === 0}
  <p class="empty">No endpoints with lint findings.</p>
{/if}

{#each groups as group (group.path)}
  <section class="resource">
    <h2>{group.path}</h2>
    {#if group.resourceDescription !== undefined && group.resourceDescription !== ""}
      <p class="resource-desc">{group.resourceDescription}</p>
    {/if}
    {#each group.endpoints as endpoint (endpoint.method + "|" + endpoint.path)}
      <EndpointCard
        {endpoint}
        findings={findingsForEndpoint(findings, endpoint.path, endpoint.method)}
      />
    {/each}
  </section>
{/each}
