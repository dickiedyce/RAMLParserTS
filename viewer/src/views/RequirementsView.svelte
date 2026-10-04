<script lang="ts">
  import type { ParsedSpec } from "../../../src/index.js";
  import { sourceLabel } from "../lib/format.js";

  let { spec }: { spec: ParsedSpec } = $props();
  const fr = $derived(spec.requirements.filter((r) => r.reqType === "FR"));
  const nfr = $derived(spec.requirements.filter((r) => r.reqType === "NFR"));
</script>

{#if spec.requirements.length === 0}
  <p class="empty">No requirement tables found.</p>
{/if}

{#each [["Functional Requirements", fr], ["Non-Functional Requirements", nfr]] as [heading, rows] (heading)}
  {#if rows.length > 0}
    <h2>{heading}</h2>
    <table class="requirements">
      <thead>
        <tr><th>#</th><th>Use Case</th><th>Detailed Description</th><th>Acceptance Criteria</th><th>Scope</th><th>Source</th></tr>
      </thead>
      <tbody>
        {#each rows as r (r.reqId + "|" + r.scope)}
          <tr>
            <td><code>{r.reqId}</code></td>
            <td>{r.useCase}</td>
            <td>{r.description}</td>
            <td>{r.acceptanceCriteria}</td>
            <td>{r.scope}</td>
            <td>{sourceLabel(r)}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
{/each}
