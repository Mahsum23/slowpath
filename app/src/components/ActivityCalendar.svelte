<script lang="ts">
  /**
   * The days you showed up: one column per week, Monday at the top, darker for more.
   *
   * One hue, five steps from the surface to the accent (sequential: more is darker in light
   * mode, brighter in dark — the steps are mixed from each mode's own tokens). A missed day
   * is simply empty: never red, never a gap called "broken". Hover or tap a day to read it;
   * every cell also carries its date and count for screen readers.
   */
  import { formatDate } from '../lib/date';
  import type { CalendarCell } from '../lib/motivation';

  let { weeks }: { weeks: CalendarCell[][] } = $props();

  let sel = $state<CalendarCell | null>(null);

  /** Month labels: shown above the first column whose Monday starts a new month. */
  const months = $derived(
    weeks.map((col, i) => {
      const m = new Date(`${col[0].date}T12:00`).getMonth();
      const prev = i ? new Date(`${weeks[i - 1][0].date}T12:00`).getMonth() : -1;
      return m !== prev ? new Date(`${col[0].date}T12:00`).toLocaleDateString(undefined, { month: 'short' }) : '';
    }),
  );

  const say = (c: CalendarCell) =>
    `${formatDate(c.date)}: ${c.score ? `${c.score} thing${c.score === 1 ? '' : 's'} done` : 'nothing'}`;
</script>

<div class="cal" style:--cols={weeks.length}>
  <div class="months" aria-hidden="true">
    {#each months as m}<span>{m}</span>{/each}
  </div>
  <div class="grid" role="group" aria-label="Activity calendar, one column per week">
    {#each weeks as col}
      {#each col as c}
        {#if c.future}
          <span class="cell future" aria-hidden="true"></span>
        {:else}
          <button
            class="cell s{c.step}"
            class:on={sel?.date === c.date}
            aria-label={say(c)}
            onpointerenter={() => (sel = c)}
            onclick={() => (sel = c)}
          ></button>
        {/if}
      {/each}
    {/each}
  </div>
  <div class="foot">
    <p class="readout">{sel ? say(sel) : 'Tap a day to see it.'}</p>
    <div class="legend" aria-hidden="true">
      <span>Less</span>
      {#each [0, 1, 2, 3, 4] as s}<i class="cell s{s}"></i>{/each}
      <span>More</span>
    </div>
  </div>
</div>

<style>
  .cal {
    --gap: 3px;
    --seq-0: var(--surface-2);
    --seq-1: color-mix(in oklab, var(--accent) 30%, var(--surface-2));
    --seq-2: color-mix(in oklab, var(--accent) 52%, var(--surface-2));
    --seq-3: color-mix(in oklab, var(--accent) 76%, var(--surface-2));
    --seq-4: var(--accent);
  }

  .months,
  .grid {
    display: grid;
    grid-template-columns: repeat(var(--cols), 1fr);
    gap: var(--gap);
  }

  .months {
    margin-bottom: 4px;
    font-size: 10px;
    color: var(--text-faint);
    white-space: nowrap;
  }

  .months span {
    overflow: visible;
  }

  .grid {
    grid-template-rows: repeat(7, auto);
    grid-auto-flow: column;
  }

  .cell {
    display: block;
    aspect-ratio: 1;
    width: 100%;
    border: 0;
    padding: 0;
    border-radius: 3px;
    background: var(--seq-0);
    cursor: pointer;
  }

  .cell.future {
    background: transparent;
    cursor: default;
  }

  .s1 { background: var(--seq-1); }
  .s2 { background: var(--seq-2); }
  .s3 { background: var(--seq-3); }
  .s4 { background: var(--seq-4); }

  .cell.on {
    outline: 2px solid var(--text);
    outline-offset: 1px;
  }

  .foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-top: 8px;
  }

  .readout {
    margin: 0;
    font-size: 12.5px;
    color: var(--text-faint);
  }

  .legend {
    display: flex;
    align-items: center;
    gap: 3px;
    font-size: 10.5px;
    color: var(--text-faint);
    flex: none;
  }

  .legend .cell {
    width: 10px;
    height: 10px;
    cursor: default;
  }

  .legend span:first-child {
    margin-right: 2px;
  }

  .legend span:last-child {
    margin-left: 2px;
  }
</style>
