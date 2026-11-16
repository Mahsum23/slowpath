<script lang="ts">
  import { render } from '../lib/markdown';
  import { splitViz } from '../lib/viz';
  import Viz from './Viz.svelte';

  /**
   * `viz` turns on the lesson's step-through visuals (viz.ts). Only the lesson passes it:
   * anywhere else (a mentor reply) a ```viz fence is just a code block.
   */
  let { source, viz = false, lang = 'sql' }: { source: string | null | undefined; viz?: boolean; lang?: string } = $props();
  const segments = $derived(viz && source ? splitViz(source) : [{ kind: 'md' as const, text: source ?? '' }]);
</script>

<!-- Content is authored in this repo and compiled by our own build script, so it
     is trusted input; there is no user-supplied markdown anywhere in the app. -->
<div class="prose">
  {#each segments as s}
    {#if s.kind === 'viz'}
      <!-- Keyed by the visual itself: moving to another lesson starts its visual at step 1
           instead of reusing the last one's place. -->
      {#key s.viz}
        <Viz viz={s.viz} {lang} />
      {/key}
    {:else}
      {@html render(s.text)}
    {/if}
  {/each}
</div>
