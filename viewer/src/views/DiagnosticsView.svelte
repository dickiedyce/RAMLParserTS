<script lang="ts">
  import type { Diagnostic } from "../../../src/index.js";

  let { diagnostics }: { diagnostics: Diagnostic[] } = $props();

  function location(d: Diagnostic): string {
    if (d.path === undefined) return "-";
    return d.line !== undefined ? `${d.path}:${d.line}` : d.path;
  }
</script>

{#if diagnostics.length === 0}
  <p class="empty">No diagnostics. Clean parse.</p>
{:else}
  <table class="diagnostics">
    <thead>
      <tr><th>Severity</th><th>Code</th><th>Message</th><th>Location</th></tr>
    </thead>
    <tbody>
      {#each diagnostics as d, i (i)}
        <tr class="sev-{d.severity}">
          <td>{d.severity}</td>
          <td><code>{d.code}</code></td>
          <td>{d.message}</td>
          <td>{location(d)}</td>
        </tr>
      {/each}
    </tbody>
  </table>
{/if}
