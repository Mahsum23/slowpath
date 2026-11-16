<script lang="ts">
  /**
   * A sequence diagram: lanes across the top, one arrow per message, revealed step by step.
   * The newest arrow is the bright one; each lane's note shows what it holds after the step
   * (a queue, a state), which is where most of networking's surprises live.
   */
  import type { SeqStep } from '../lib/viz';

  let { lanes, steps, at }: { lanes: string[]; steps: SeqStep[]; at: number } = $props();

  const shown = $derived(steps.slice(0, at + 1).map((s, i) => ({ ...s, i })).filter((s) => s.msg));
  const notes = $derived.by(() => {
    // A lane keeps its last note until a later step changes it.
    const out: Record<string, string> = {};
    for (const s of steps.slice(0, at + 1)) for (const [k, v] of Object.entries(s.notes ?? {})) out[k] = v;
    return out;
  });
  const col = (i: number) => ((i + 0.5) / lanes.length) * 100;
</script>

<div class="seq" style="--n: {lanes.length}">
  <div class="heads">
    {#each lanes as l, i}
      <div class="head">
        <b>{l}</b>
        {#if notes[i]}<span class="note">{notes[i]}</span>{/if}
      </div>
    {/each}
  </div>
  <div class="body" style="height: {Math.max(1, shown.length) * 34 + 10}px">
    {#each lanes as _, i}
      <div class="life" style="left: {col(i)}%"></div>
    {/each}
    {#each shown as s, k (s.i)}
      {@const a = col(s.msg!.from)}
      {@const b = col(s.msg!.to)}
      <div
        class="msg"
        class:now={s.i === at}
        style="top: {k * 34 + 8}px; left: {Math.min(a, b)}%; width: {Math.abs(b - a)}%"
      >
        <span class="text">{s.msg!.text}</span>
        <span class="line" class:left={b < a}></span>
      </div>
    {/each}
  </div>
</div>

<style>
  .seq {
    min-width: 280px;
  }

  .heads {
    display: grid;
    grid-template-columns: repeat(var(--n), 1fr);
    gap: 6px;
  }

  .head {
    text-align: center;
    font-size: 12.5px;
    display: grid;
    gap: 4px;
    justify-items: center;
  }

  .head b {
    padding: 4px 8px;
    border-radius: 8px;
    background: var(--surface);
    border: 1px solid var(--border);
  }

  .note {
    font-family: var(--font-mono);
    font-size: 11px;
    padding: 2px 6px;
    border-radius: 6px;
    background: var(--ok-soft);
    color: var(--text);
  }

  .body {
    position: relative;
    margin-top: 6px;
    transition: height 0.25s;
  }

  .life {
    position: absolute;
    top: 0;
    bottom: 0;
    border-left: 2px dotted var(--border-strong);
  }

  .msg {
    position: absolute;
    height: 26px;
    color: var(--text-faint);
  }

  .msg.now {
    color: var(--accent);
  }

  .text {
    position: absolute;
    left: 50%;
    top: 0;
    transform: translateX(-50%);
    white-space: nowrap;
    padding: 0 4px;
    background: color-mix(in oklab, var(--accent) 5%, var(--surface));
    border-radius: 4px;
    text-align: center;
    font-family: var(--font-mono);
    font-size: 11.5px;
    font-weight: 700;
  }

  .line {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 3px;
    border-top: 2px solid currentColor;
  }

  .line::after {
    content: '';
    position: absolute;
    right: -1px;
    top: -6px;
    border: 5px solid transparent;
    border-left: 8px solid currentColor;
  }

  .line.left::after {
    right: auto;
    left: -1px;
    border-left: 5px solid transparent;
    border-right: 8px solid currentColor;
  }
</style>
