<script lang="ts">
  import type { LintFinding } from "../../../src/index.js";
  import { findingLocation, ruleLabel, targetLabel } from "../lib/lint.js";

  let { findings }: { findings: LintFinding[] } = $props();
</script>

{#if findings.length === 0}
  <p class="empty">No lint findings. Well documented.</p>
{:else}
  <table class="lint">
    <thead>
      <tr><th>Severity</th><th>Rule</th><th>Finding</th><th>Target</th><th>Location</th></tr>
    </thead>
    <tbody>
      {#each findings as f, i (i)}
        <tr class="sev-{f.severity}">
          <td>{f.severity}</td>
          <td><code>{f.code}</code><span class="rule-label">{ruleLabel(f.code)}</span></td>
          <td>{f.message}</td>
          <td>{targetLabel(f.target)}</td>
          <td>{findingLocation(f)}</td>
        </tr>
      {/each}
    </tbody>
  </table>
{/if}
