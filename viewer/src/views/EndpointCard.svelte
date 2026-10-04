<script lang="ts">
  import type { Endpoint } from "../../../src/index.js";
  import { formatConstraints, formatExample } from "../lib/format.js";
  import BodyBlock from "./BodyBlock.svelte";

  let { endpoint }: { endpoint: Endpoint } = $props();
</script>

<article class="endpoint">
  <h3 class="method-{endpoint.method.toLowerCase()}">{endpoint.method} {endpoint.path}</h3>
  {#if endpoint.summary !== ""}<p class="summary">{endpoint.summary}</p>{/if}
  {#if endpoint.description !== ""}<p class="description">{endpoint.description}</p>{/if}
  <p class="security"><strong>Security:</strong> {endpoint.securitySchemeIds.length > 0 ? endpoint.securitySchemeIds.join(", ") : "none"}</p>

  {#if endpoint.parameters.length > 0}
    <h4>Parameters</h4>
    <table class="params">
      <thead>
        <tr><th>Name</th><th>In</th><th>Required</th><th>Type</th><th>Description</th><th>Example</th><th>Constraints</th></tr>
      </thead>
      <tbody>
        {#each endpoint.parameters as param (param.name + "|" + param.location)}
          <tr>
            <td><code>{param.name}</code></td>
            <td>{param.location}</td>
            <td>{param.required ? "yes" : "no"}</td>
            <td><code>{param.type}</code></td>
            <td>{param.description}</td>
            <td>{#if param.example !== undefined}<pre class="example">{formatExample(param.example)}</pre>{/if}</td>
            <td>{formatConstraints(param)}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}

  {#if endpoint.requestBody !== undefined}
    <h4>Request body</h4>
    <BodyBlock {...endpoint.requestBody} />
  {/if}

  {#if endpoint.responses.length > 0}
    <h4>Responses</h4>
    {#each endpoint.responses as response (response.statusCode)}
      <section class="response">
        <h5>{response.statusCode} {response.description}</h5>
        {#if response.body !== undefined}<BodyBlock {...response.body} />{/if}
      </section>
    {/each}
  {/if}

  {#if endpoint.requirements.length > 0}
    <h4>Requirements</h4>
    <ul class="endpoint-requirements">
      {#each endpoint.requirements as req (req.reqId + "|" + req.scope)}
        <li><strong>{req.reqId}</strong> <em>({req.scope})</em> {req.description}</li>
      {/each}
    </ul>
  {/if}
</article>
