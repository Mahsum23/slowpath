<script lang="ts">
  /**
   * Backing arrays as rows of cells, and each slice as a bar under them: solid over its
   * length, dashed over the capacity beyond it. The dashed part is the whole point: it is
   * the room an `append` will write into, and nothing in the code shows it.
   */
  import type { SlicesStep } from '../lib/viz';

  let { step }: { step: SlicesStep } = $props();
  // Cells shrink for a long array so it still fits a phone (about 300px of frame).
  const CELL = $derived(Math.min(44, Math.floor(300 / Math.max(1, ...step.arrays.map((a) => a.cells.length)))));
</script>

<div class="slices" style="--cell: {CELL}px">
  {#each step.arrays as a, ai}
    <div class="arr">
      <p class="name">{a.name}</p>
      <div class="cells" style="width: {a.cells.length * CELL}px">
        {#each a.cells as c, i}
          <div class="cell" class:hl={a.hl?.includes(i)}>
            <span class="v">{c}</span>
            <span class="i">{i}</span>
          </div>
        {/each}
      </div>
      {#each step.slices.filter((s) => s.array === ai) as s (s.name)}
        <div class="bar" style="margin-left: {s.from * CELL}px; width: {Math.max(s.cap, 0.4) * CELL}px">
          <div class="len" style="width: {s.len * CELL}px"></div>
          <span class="label"><b>{s.name}</b> len {s.len} · cap {s.cap}</span>
        </div>
      {/each}
    </div>
  {/each}
</div>

<style>
  .slices {
    display: grid;
    gap: 16px;
  }

  .name {
    margin: 0 0 4px;
    font-family: var(--font-mono);
    font-size: 12px;
    font-weight: 700;
    color: var(--text-dim);
  }

  .cells {
    display: flex;
  }

  .cell {
    width: var(--cell);
    height: var(--cell);
    display: grid;
    place-items: center;
    position: relative;
    border: 1.5px solid var(--border-strong);
    margin-right: -1.5px;
    background: var(--surface);
    font-family: var(--font-mono);
    font-weight: 700;
    transition: background 0.25s;
  }

  .cell.hl {
    background: color-mix(in oklab, var(--flame) 30%, var(--surface));
  }

  .i {
    position: absolute;
    bottom: 1px;
    right: 3px;
    font-size: 9px;
    font-weight: 500;
    color: var(--text-faint);
  }

  .bar {
    position: relative;
    margin-top: 8px;
    height: 22px;
    border: 2px dashed color-mix(in oklab, var(--accent) 55%, var(--border));
    border-radius: 6px;
    transition: width 0.3s, margin-left 0.3s;
  }

  .len {
    position: absolute;
    inset: -2px auto -2px -2px;
    background: var(--accent);
    border-radius: 6px;
    opacity: 0.85;
    transition: width 0.3s;
  }

  .label {
    position: absolute;
    left: 6px;
    top: 50%;
    transform: translateY(-50%);
    font-family: var(--font-mono);
    font-size: 11.5px;
    white-space: nowrap;
    color: var(--accent-ink);
    mix-blend-mode: normal;
    text-shadow: 0 0 3px color-mix(in oklab, var(--accent) 80%, black);
  }
</style>
