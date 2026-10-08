<script lang="ts">
  /**
   * Every concept of the track, as a tile coloured by how well it is held right now.
   *
   * The colour is a five-step ramp of one hue (strength is a magnitude), on a swatch beside
   * the text — the words stay in text colours. The state is said in words too, with an icon
   * for "shaky", so nothing depends on colour alone. A concept fades if it is left alone;
   * that is not a punishment, it is the forgetting curve, and tapping it is the way back.
   */
  import { router, sessionPath } from '../lib/router.svelte';
  import { strengthStep, type ConceptStrength, type Strength } from '../lib/motivation';
  import type { Day } from '../lib/types';

  let { items, weekId }: { items: { day: Day; s: ConceptStrength; landed: boolean }[]; weekId: string } = $props();

  const WORDS: Record<Strength, string> = {
    new: 'not met yet',
    shaky: 'shaky — worth a round',
    fading: 'fading',
    growing: 'growing',
    solid: 'solid',
  };

  function open(day: Day) {
    if (day.practice) router.go(`/review/round/${day.id}`);
    else router.go(sessionPath(weekId, day.id, 0));
  }
</script>

<div class="map">
  {#each items as { day, s, landed }}
    {@const step = strengthStep(s)}
    <button class="tile card" onclick={() => open(day)} aria-label="Day {day.day}, {day.title}: {WORDS[s.status]}, {s.met} of {s.total} questions met">
      <span class="swatch s{step}" aria-hidden="true">
        {#if s.status === 'shaky'}<span class="mark">!</span>{:else if landed}<span class="mark">✓</span>{/if}
      </span>
      <span class="body">
        <span class="title">{day.title}</span>
        <span class="state" class:shaky={s.status === 'shaky'}>
          Day {day.day} · {WORDS[s.status]}{#if s.met}{` · ${Math.round(s.strength * 100)}%`}{/if}
        </span>
        <span class="meter" aria-hidden="true"><span style:width="{s.total ? (s.met / s.total) * 100 : 0}%"></span></span>
        <span class="met">{s.met} of {s.total} questions met{landed ? ' · landed' : ''}{s.misses && s.status !== 'shaky' ? ` · ${s.misses} to revisit` : ''}</span>
      </span>
    </button>
  {/each}
  <div class="legend" aria-hidden="true">
    <span>Not met</span>
    {#each [0, 1, 2, 3, 4] as st}<i class="swatch small s{st}"></i>{/each}
    <span>Solid</span>
  </div>
</div>

<style>
  .map {
    --seq-0: var(--surface-2);
    --seq-1: color-mix(in oklab, var(--accent) 30%, var(--surface-2));
    --seq-2: color-mix(in oklab, var(--accent) 52%, var(--surface-2));
    --seq-3: color-mix(in oklab, var(--accent) 76%, var(--surface-2));
    --seq-4: var(--accent);
    display: grid;
    gap: 8px;
  }

  .tile {
    display: flex;
    gap: 13px;
    align-items: center;
    padding: 12px 14px;
    text-align: left;
    width: 100%;
    cursor: pointer;
  }

  .swatch {
    flex: none;
    width: 40px;
    height: 40px;
    border-radius: 10px;
    display: grid;
    place-items: center;
    background: var(--seq-0);
  }

  .swatch.small {
    width: 11px;
    height: 11px;
    border-radius: 3px;
  }

  .s1 { background: var(--seq-1); }
  .s2 { background: var(--seq-2); }
  .s3 { background: var(--seq-3); }
  .s4 { background: var(--seq-4); }

  .mark {
    font-weight: 800;
    font-size: 16px;
    color: var(--text);
    background: var(--surface);
    border-radius: 999px;
    width: 20px;
    height: 20px;
    display: grid;
    place-items: center;
    line-height: 1;
  }

  .body {
    display: grid;
    gap: 3px;
    min-width: 0;
    flex: 1;
  }

  .title {
    font-weight: 650;
    font-size: 14.5px;
    line-height: 1.3;
  }

  .state {
    font-size: 12.5px;
    color: var(--text-dim);
  }

  /* Not the error red: a concept to go back to is not a failure, and research on work
     diaries found setbacks weigh far more than wins — no need to shout about them. */
  .state.shaky {
    color: var(--flame);
  }

  .meter {
    display: block;
    height: 4px;
    border-radius: 2px;
    background: var(--surface-2);
    overflow: hidden;
    margin-top: 3px;
  }

  .meter span {
    display: block;
    height: 100%;
    background: var(--text-faint);
    border-radius: 2px;
  }

  .met {
    font-size: 11.5px;
    color: var(--text-faint);
  }

  .legend {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 3px;
    font-size: 10.5px;
    color: var(--text-faint);
    margin-top: 2px;
  }

  .legend span:first-child {
    margin-right: 3px;
  }

  .legend span:last-child {
    margin-left: 3px;
  }
</style>
