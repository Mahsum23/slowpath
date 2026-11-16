<script lang="ts">
  /**
   * A step-through visual (viz.ts): one frame at a time, advanced by the reader.
   *
   * Learner-paced on purpose: a picture that changes on its own outruns the sentence that
   * explains it, and the segmenting research says people learn more from steps they advance
   * themselves. The caption sits under the frame, so the words and the picture they describe
   * are read together.
   */
  import type { Viz } from '../lib/viz';
  import { inlineHtml } from '../lib/inline';
  import { highlight } from '../lib/markdown';
  import VizTables from './VizTables.svelte';
  import VizSlices from './VizSlices.svelte';
  import VizSeq from './VizSeq.svelte';

  let { viz, lang = 'sql' }: { viz: Viz; lang?: string } = $props();

  let at = $state(0);
  const n = $derived(viz.steps.length);
  // Never past the end: a step index left over from a longer visual must not index off it.
  const cur = $derived(Math.min(at, n - 1));
  const step = $derived(viz.steps[cur]);
  const code = $derived('code' in step ? (step as { code?: string }).code : undefined);
</script>

<figure class="viz" aria-label={viz.title ?? 'Step-through diagram'}>
  {#if viz.title}<figcaption class="title">{viz.title}</figcaption>{/if}

  {#if code}
    <pre class="code"><code class="hljs">{@html highlight(code, lang)}</code></pre>
  {/if}

  <div class="frame">
    {#if viz.kind === 'tables'}
      <VizTables step={viz.steps[cur]} />
    {:else if viz.kind === 'slices'}
      <VizSlices step={viz.steps[cur]} />
    {:else}
      <VizSeq lanes={viz.lanes} steps={viz.steps} at={cur} />
    {/if}
  </div>

  <p class="say inline-md" aria-live="polite">{@html inlineHtml(step.say)}</p>

  <div class="nav">
    <button class="back" onclick={() => (at = Math.max(0, at - 1))} disabled={at === 0} aria-label="Previous step">
      <svg viewBox="0 0 24 24"><path d="m15 5-7 7 7 7" /></svg>
    </button>
    <div class="dots" aria-label="Step {at + 1} of {n}">
      {#each viz.steps as _, i}
        <button class="dot" class:on={i === at} class:past={i < at} onclick={() => (at = i)} aria-label="Go to step {i + 1}"></button>
      {/each}
    </div>
    {#if at < n - 1}
      <button class="next" onclick={() => (at += 1)}>
        Next
        <svg viewBox="0 0 24 24"><path d="m9 5 7 7-7 7" /></svg>
      </button>
    {:else}
      <button class="next again" onclick={() => (at = 0)}>
        <svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5" /></svg>
        Again
      </button>
    {/if}
  </div>
</figure>

<style>
  .viz {
    margin: 22px 0;
    padding: 14px 14px 12px;
    border-radius: var(--radius-lg);
    border: 1px solid color-mix(in oklab, var(--accent) 30%, var(--border));
    background: color-mix(in oklab, var(--accent) 5%, var(--surface));
  }

  .title {
    margin: 0 0 10px;
    font-size: 12px;
    font-weight: 750;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--accent);
  }

  .code {
    margin: 0 0 10px;
    font-size: 12.5px;
    /* Wrapped, not scrolled: on a phone the end of the line is usually the part that matters. */
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  .frame {
    overflow-x: auto;
    min-height: 60px;
  }

  .say {
    margin: 12px 0 4px;
    font-size: 15px;
    line-height: 1.5;
    min-height: 3em;
  }

  .nav {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 8px;
  }

  .nav svg {
    width: 18px;
    height: 18px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2.2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .back {
    display: grid;
    place-items: center;
    width: 38px;
    height: 38px;
    border-radius: 50%;
    border: 1px solid var(--border);
    color: var(--text-dim);
    background: var(--surface);
  }

  .back:disabled {
    opacity: 0.35;
  }

  .dots {
    display: flex;
    gap: 6px;
    flex: 1;
    justify-content: center;
    flex-wrap: wrap;
  }

  .dot {
    width: 9px;
    height: 9px;
    padding: 0;
    border-radius: 50%;
    background: var(--border-strong);
  }

  .dot.past {
    background: color-mix(in oklab, var(--accent) 45%, var(--border));
  }

  .dot.on {
    background: var(--accent);
    transform: scale(1.3);
  }

  .next {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 9px 16px;
    border-radius: 999px;
    background: var(--accent);
    color: var(--accent-ink);
    font-weight: 700;
    font-size: 14.5px;
  }

  .next.again {
    background: var(--accent-soft);
    color: var(--accent);
  }
</style>
