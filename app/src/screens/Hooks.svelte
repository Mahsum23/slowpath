<script lang="ts">
  /**
   * Every hook of the subject being studied, for the material already read.
   *
   * "Cover the facts" hides each rule behind its picture: read the story, say the rule, tap
   * to check. Seeing them all together is also how one tells which ones are not yet his own.
   */
  import { app } from '../lib/app.svelte';
  import { router } from '../lib/router.svelte';
  import { hookRead } from '../lib/hooks';
  import HookCard from '../components/HookCard.svelte';

  let covered = $state(true);

  const groups = $derived.by(() => {
    const path = app.path;
    if (!path) return [];
    return path.days
      .filter((d) => d.hooks?.length)
      .map((d) => {
        const prog = app.progress.days[d.id];
        const read = (d.hooks ?? []).filter((h) => hookRead(d, prog, h));
        return { day: d, read, later: (d.hooks?.length ?? 0) - read.length };
      })
      .filter((g) => g.read.length || g.later);
  });
  const total = $derived(groups.reduce((n, g) => n + g.read.length, 0));
</script>

<div class="screen">
  <button class="back" onclick={() => router.back()} aria-label="Back">
    <svg viewBox="0 0 24 24"><path d="m15 5-7 7 7 7" /></svg>
  </button>
  <p class="eyebrow">🪝 {total} so far</p>
  <h1>Memory hooks</h1>
  <p class="intro">
    One picture for each fact that will not stay put on its own. With the facts covered, all you
    get is the picture: recall its story and the rule it carries, out loud, then tap to check. When one does nothing for you,
    replace it with your own: one you made up holds better than one you read.
  </p>

  <label class="toggle">
    <input type="checkbox" bind:checked={covered} />
    <span>Cover the facts</span>
  </label>

  {#if !groups.length}
    <p class="empty">Hooks appear here as you read the lessons that have them.</p>
  {/if}

  {#each groups as g (g.day.id)}
    <section>
      <h2>Day {g.day.day} · {g.day.title}</h2>
      {#each g.read as h (h.id)}
        {#key covered}
          <HookCard day={g.day} hook={h} {covered} />
        {/key}
      {/each}
      {#if g.later}
        <p class="later">{g.later} more as you read on.</p>
      {/if}
    </section>
  {/each}
</div>

<style>
  .back {
    margin: 0 0 8px -6px;
    color: var(--text-dim);
  }

  .back svg {
    width: 24px;
    height: 24px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  h1 {
    font-size: 26px;
    letter-spacing: -0.025em;
    margin: 4px 0 8px;
  }

  .intro {
    color: var(--text-dim);
    font-size: 15px;
    line-height: 1.5;
    margin: 0 0 14px;
  }

  .toggle {
    display: inline-flex;
    gap: 8px;
    align-items: center;
    font-size: 14px;
    font-weight: 600;
    margin-bottom: 8px;
  }

  .empty,
  .later {
    color: var(--text-faint);
    font-size: 13.5px;
  }

  section {
    margin-top: 22px;
  }

  h2 {
    font-size: 16px;
    margin: 0 0 -6px;
  }
</style>
