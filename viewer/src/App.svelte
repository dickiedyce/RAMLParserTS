<script lang="ts">
  import {
    RamlParseError,
    discoverRoots,
    entriesFromFileList,
    extractSpec,
    loadFiles,
    loadZip,
    resolveSpec,
  } from "../../src/index.js";
  import type { ParsedSpec, Vfs } from "../../src/index.js";
  import {
    buildEndpointsMarkdown,
    buildRequirementsMarkdown,
  } from "./lib/markdown.js";
  import DiagnosticsView from "./views/DiagnosticsView.svelte";
  import EndpointsView from "./views/EndpointsView.svelte";
  import RawView from "./views/RawView.svelte";
  import RequirementsView from "./views/RequirementsView.svelte";

  type View = "endpoints" | "requirements" | "diagnostics" | "raw";

  let vfs: Vfs | null = $state(null);
  let roots: string[] = $state([]);
  let rootPath: string | null = $state(null);
  let spec: ParsedSpec | null = $state(null);
  let tree: Record<string, unknown> | null = $state(null);
  let error: string | null = $state(null);
  let view: View = $state("endpoints");

  async function ingest(files: ArrayLike<File>): Promise<void> {
    error = null;
    spec = null;
    tree = null;
    rootPath = null;
    try {
      const list = Array.from(files);
      const first = list[0];
      if (
        list.length === 1 &&
        first !== undefined &&
        /\.zip$/i.test(first.name)
      ) {
        vfs = loadZip(new Uint8Array(await first.arrayBuffer()));
      } else {
        vfs = await loadFiles(entriesFromFileList(list));
      }
      roots = discoverRoots(vfs);
      const only = roots[0];
      if (only !== undefined && roots.length === 1) {
        chooseRoot(only);
      } else if (roots.length === 0) {
        error =
          "No RAML 1.0 or OpenAPI 3.x root document found in the dropped files.";
      }
    } catch (e) {
      error = message(e);
    }
  }

  function chooseRoot(path: string): void {
    if (vfs === null) return;
    try {
      const resolved = resolveSpec(vfs, path);
      tree = resolved.tree;
      spec = extractSpec(resolved);
      rootPath = path;
      view = "endpoints";
      error = null;
    } catch (e) {
      error = message(e);
    }
  }

  function reset(): void {
    vfs = null;
    roots = [];
    rootPath = null;
    spec = null;
    tree = null;
    error = null;
    view = "endpoints";
  }

  function message(e: unknown): string {
    if (e instanceof RamlParseError) return `${e.name}[${e.code}]: ${e.message}`;
    return e instanceof Error ? e.message : String(e);
  }

  function onDrop(e: DragEvent): void {
    e.preventDefault();
    const files = e.dataTransfer?.files;
    if (files !== undefined && files.length > 0) void ingest(files);
  }

  function onInput(e: Event): void {
    const input = e.currentTarget as HTMLInputElement;
    if (input.files !== null && input.files.length > 0) void ingest(input.files);
    input.value = "";
  }

  function download(name: string, text: string): void {
    const blob = new Blob([text], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportEndpoints(): void {
    if (spec !== null) download("endpoints.md", buildEndpointsMarkdown(spec));
  }

  function exportRequirements(): void {
    if (spec !== null) download("requirements.md", buildRequirementsMarkdown(spec));
  }
</script>

<main>
  <header class="no-print">
    <h1>RAML Parser Viewer</h1>
    <p class="tagline">
      Drop a MuleSoft export (folder or zip) to browse its API reference and
      requirements. Nothing leaves your machine.
    </p>
    {#if spec !== null}
      <nav class="tabs" aria-label="Views">
        <button class:active={view === "endpoints"} onclick={() => (view = "endpoints")}>Endpoints</button>
        <button class:active={view === "requirements"} onclick={() => (view = "requirements")}>Requirements</button>
        <button class:active={view === "diagnostics"} onclick={() => (view = "diagnostics")}>Diagnostics</button>
        <button class:active={view === "raw"} onclick={() => (view = "raw")}>Raw</button>
      </nav>
      <div class="actions">
        <button onclick={exportEndpoints}>Export endpoints.md</button>
        <button onclick={exportRequirements}>Export requirements.md</button>
        <button onclick={() => window.print()}>Print</button>
        <button onclick={reset}>Start over</button>
      </div>
      {#if rootPath !== null}<p class="root">Root: {rootPath}</p>{/if}
    {/if}
  </header>

  {#if error !== null}
    <div class="error" role="alert">{error}</div>
  {/if}

  {#if spec === null}
    {#if roots.length > 1}
      <section class="picker">
        <h2>Multiple root documents found</h2>
        <p>Pick the root to parse:</p>
        <ul>
          {#each roots as root (root)}
            <li><button onclick={() => chooseRoot(root)}>{root}</button></li>
          {/each}
        </ul>
      </section>
    {:else}
      <div
        class="dropzone no-print"
        data-testid="dropzone"
        role="button"
        tabindex="0"
        aria-label="Drop a spec folder or zip"
        ondrop={onDrop}
        ondragover={(e) => e.preventDefault()}
        ondragenter={(e) => e.preventDefault()}
      >
        <p><strong>Drop</strong> a spec folder or zip here</p>
        <div class="pickers">
          <label class="file-label">
            Choose zip&hellip;
            <input type="file" accept=".zip,application/zip" onchange={onInput} />
          </label>
          <label class="file-label">
            Choose folder&hellip;
            <input type="file" webkitdirectory multiple onchange={onInput} />
          </label>
        </div>
      </div>
    {/if}
  {:else}
    {#if view === "endpoints"}
      <EndpointsView spec={spec} />
    {:else if view === "requirements"}
      <RequirementsView spec={spec} />
    {:else if view === "diagnostics"}
      <DiagnosticsView diagnostics={spec.diagnostics} />
    {:else}
      <RawView tree={tree} spec={spec} />
    {/if}
  {/if}
</main>
