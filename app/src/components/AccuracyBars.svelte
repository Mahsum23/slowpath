<script lang="ts">
  /**
   * Right first time, week by week: one series of columns, so no legend. Columns are thin
   * and rounded at the top only, the latest week carries its value on the cap, and the rest
   * are read by hover or tap. A dashed-free hairline at 80% marks the bar a practice round
   * has to clear, labelled, so the line explains itself.
   */
  import { formatDate } from '../lib/date';
  import type { WeekAccuracy } from '../lib/motivation';

  let { weeks }: { weeks: WeekAccuracy[] } = $props();

  const W = 320;
  const H = 120;
  const PAD = { l: 4, r: 30, t: 16, b: 18 };
  const slot = $derived((W - PAD.l - PAD.r) / Math.max(weeks.length, 1));
  const bw = $derived(Math.min(24, slot * 0.6));
  const y = (v: number) => PAD.t + (1 - v) * (H - PAD.t - PAD.b);

  let sel = $state<number | null>(null);
  const shown = $derived(sel !== null ? weeks[sel] : null);
  const pct = (v: number) => `${Math.round(v * 100)}%`;
</script>

<div class="chart">
  <svg viewBox="0 0 {W} {H}" role="img" aria-label="Right first time, by week: {weeks.map((w) => `week of ${formatDate(w.week)} ${pct(w.rate)} of ${w.n}`).join(', ')}">
    <line class="axis" x1={PAD.l} x2={W - PAD.r} y1={y(0)} y2={y(0)} />
    <line class="target" x1={PAD.l} x2={W - PAD.r} y1={y(0.8)} y2={y(0.8)} />
    <text class="tick" x={W - PAD.r + 5} y={y(0.8) + 3.5}>80%</text>
    {#each weeks as w, i}
      {@const cx = PAD.l + slot * i + slot / 2}
      {@const top = y(w.rate)}
      {@const h = y(0) - top}
      <path
        class="bar"
        class:dim={sel !== null && sel !== i}
        d="M{cx - bw / 2},{y(0)} V{top + Math.min(4, h)} Q{cx - bw / 2},{top} {cx - bw / 2 + Math.min(4, h)},{top} H{cx + bw / 2 - Math.min(4, h)} Q{cx + bw / 2},{top} {cx + bw / 2},{top + Math.min(4, h)} V{y(0)} Z"
      />
      <rect
        class="hit"
        x={PAD.l + slot * i}
        y={PAD.t - 10}
        width={slot}
        height={H - PAD.t}
        role="button"
        tabindex="0"
        aria-label="Week of {formatDate(w.week)}: {pct(w.rate)} right of {w.n}"
        onpointerenter={() => (sel = i)}
        onpointerleave={() => (sel = null)}
        onclick={() => (sel = i)}
        onkeydown={(e) => e.key === 'Enter' && (sel = i)}
      />
      {#if i === weeks.length - 1}
        <text class="val" x={cx} y={top - 5} text-anchor="middle">{pct(w.rate)}</text>
      {/if}
    {/each}
    {#if weeks.length}
      <text class="tick" x={PAD.l} y={H - 3}>{formatDate(weeks[0].week)}</text>
      <text class="tick" x={W - PAD.r} y={H - 3} text-anchor="end">this week</text>
    {/if}
  </svg>
  <p class="readout">
    {#if shown}<strong>{pct(shown.rate)}</strong> right first time, week of {formatDate(shown.week)} ({shown.n} answers){:else}Tap a week to read it.{/if}
  </p>
</div>

<style>
  svg {
    display: block;
    width: 100%;
    height: auto;
    overflow: visible;
  }

  .axis {
    stroke: var(--border);
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
  }

  .target {
    stroke: var(--border-strong);
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
  }

  .bar {
    fill: var(--accent);
    transition: opacity 0.15s;
  }

  .bar.dim {
    opacity: 0.45;
  }

  .hit {
    fill: transparent;
    cursor: pointer;
    outline: none;
  }

  .val {
    fill: var(--text);
    font-size: 10.5px;
    font-weight: 650;
    font-family: var(--font-ui);
  }

  .tick {
    fill: var(--text-faint);
    font-size: 9.5px;
    font-family: var(--font-ui);
  }

  .readout {
    margin: 4px 0 0;
    min-height: 18px;
    font-size: 12.5px;
    color: var(--text-faint);
  }

  .readout strong {
    color: var(--text);
  }
</style>
