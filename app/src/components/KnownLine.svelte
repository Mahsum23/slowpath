<script lang="ts">
  /**
   * "What you'd get right now", over time: one series, so no legend — the heading names it.
   *
   * A 2px line with a 10% wash under it, a ringed dot and the value at the end (the one
   * label that matters), a hairline baseline, and a crosshair with the day's value on
   * hover or touch. The numbers are also in the aria-label, so the chart is never the
   * only way to read them.
   */
  import { formatDate } from '../lib/date';

  let { points }: { points: { date: string; known: number }[] } = $props();

  const W = 320;
  const H = 120;
  const PAD = { l: 4, r: 40, t: 14, b: 18 };

  const max = $derived(Math.max(4, ...points.map((p) => p.known)));
  /** A clean top tick: 5, 10, 20, 25, 50, 100… */
  const top = $derived.by(() => {
    const steps = [5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];
    return steps.find((s) => s >= max) ?? Math.ceil(max / 500) * 500;
  });
  const x = (i: number) => PAD.l + (points.length <= 1 ? 0 : (i / (points.length - 1)) * (W - PAD.l - PAD.r));
  const y = (v: number) => PAD.t + (1 - v / top) * (H - PAD.t - PAD.b);

  const line = $derived(points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.known).toFixed(1)}`).join(' '));
  const area = $derived(
    points.length ? `${line} L${x(points.length - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z` : '',
  );

  let hover = $state<number | null>(null);
  let svg = $state<SVGSVGElement | null>(null);

  function pick(e: PointerEvent) {
    if (!svg || points.length < 2) return;
    const r = svg.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const i = Math.round(((px - PAD.l) / (W - PAD.l - PAD.r)) * (points.length - 1));
    hover = Math.max(0, Math.min(points.length - 1, i));
  }

  const last = $derived(points.at(-1));
  const shown = $derived(hover !== null ? points[hover] : null);
  const label = $derived(
    `Questions you would get right, by day: ${points.map((p) => `${formatDate(p.date)} ${p.known}`).join(', ')}`,
  );
</script>

<div class="chart">
  <svg
    bind:this={svg}
    viewBox="0 0 {W} {H}"
    role="img"
    aria-label={label}
    onpointermove={pick}
    onpointerdown={pick}
    onpointerleave={() => (hover = null)}
  >
    <line class="axis" x1={PAD.l} x2={W - PAD.r} y1={y(0)} y2={y(0)} />
    <line class="grid" x1={PAD.l} x2={W - PAD.r} y1={y(top)} y2={y(top)} />
    <text class="tick" x={W - PAD.r + 6} y={y(top) + 4}>{top}</text>
    <text class="tick" x={W - PAD.r + 6} y={y(0) + 4}>0</text>
    {#if points.length > 1}
      <path class="area" d={area} />
      <path class="line" d={line} />
    {/if}
    {#if last}
      <circle class="dot" cx={x(points.length - 1)} cy={y(last.known)} r="4.5" />
    {/if}
    {#if shown && hover !== null}
      <line class="cross" x1={x(hover)} x2={x(hover)} y1={PAD.t - 6} y2={y(0)} />
      <circle class="dot" cx={x(hover)} cy={y(shown.known)} r="4.5" />
    {/if}
    {#if points.length}
      <text class="first" x={PAD.l} y={H - 3}>{formatDate(points[0].date)}</text>
      <text class="lastd" x={W - PAD.r} y={H - 3} text-anchor="end">{formatDate(points.at(-1)!.date)}</text>
    {/if}
  </svg>
  <p class="readout" aria-live="polite">
    {#if shown}
      <strong>{shown.known}</strong> on {formatDate(shown.date)}
    {:else if last}
      Drag across the line to see a day.
    {/if}
  </p>
</div>

<style>
  .chart {
    position: relative;
  }

  svg {
    display: block;
    width: 100%;
    height: auto;
    touch-action: pan-y;
    overflow: visible;
  }

  .axis,
  .grid {
    stroke: var(--border);
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
  }

  .cross {
    stroke: var(--border-strong);
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
  }

  .area {
    fill: var(--accent);
    opacity: 0.1;
  }

  .line {
    fill: none;
    stroke: var(--accent);
    stroke-width: 2;
    stroke-linejoin: round;
    stroke-linecap: round;
    vector-effect: non-scaling-stroke;
  }

  .dot {
    fill: var(--accent);
    stroke: var(--surface);
    stroke-width: 2;
  }

  .tick,
  .first,
  .lastd {
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
