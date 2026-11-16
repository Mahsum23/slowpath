<script lang="ts">
  /**
   * Tables in one step of a visual. Rows keep their identity across steps (rowKeys), so a
   * row that survives slides to its new place, one that leaves fades out, and one that
   * arrives fades in: the reader watches the clause act on the rows instead of comparing
   * two printouts.
   */
  import { flip } from 'svelte/animate';
  import { fade } from 'svelte/transition';
  import { cellText, rowKeys, type TablesStep } from '../lib/viz';

  let { step }: { step: TablesStep } = $props();

  const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ms = still ? 0 : 260;

  const MARK_LABEL: Record<string, string> = {
    out: 'removed in this step',
    new: 'added in this step',
    hit: 'the one that matters',
    ghost: 'invented by the join, all NULLs on this side',
    dead: 'a dead row version',
    win: 'inside the window frame',
  };
</script>

<div class="tables">
  {#each step.tables as t (t.name)}
    {@const keys = rowKeys(t.name, t.rows)}
    <div class="tbl">
      <p class="name">{t.name}</p>
      <table>
        <thead>
          <tr>
            {#each t.cols as c, ci}
              <th class:hl={t.hl?.includes(ci)}>{c}</th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each t.rows as r, ri (keys[ri])}
            {@const m = t.marks?.[ri] ?? null}
            <tr class={m ? `m-${m}` : ''} animate:flip={{ duration: ms }} in:fade={{ duration: ms }} out:fade={{ duration: ms / 2 }} title={m ? MARK_LABEL[m] : undefined}>
              {#each r as v, ci}
                <td class:null={v === null} class:hl={t.hl?.includes(ci)}>{cellText(v)}</td>
              {/each}
            </tr>
          {/each}
          {#if !t.rows.length}
            <tr class="none"><td colspan={t.cols.length}>(0 rows)</td></tr>
          {/if}
        </tbody>
      </table>
    </div>
  {/each}
</div>

<style>
  .tables {
    display: flex;
    flex-wrap: wrap;
    gap: 14px;
    align-items: flex-start;
  }

  .name {
    margin: 0 0 4px;
    font-family: var(--font-mono);
    font-size: 12px;
    font-weight: 700;
    color: var(--text-dim);
  }

  table {
    border-collapse: collapse;
    font-family: var(--font-mono);
    font-size: 13px;
    background: var(--surface);
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid var(--border);
  }

  th,
  td {
    padding: 4px 10px;
    text-align: left;
    white-space: nowrap;
    border-bottom: 1px solid var(--border);
  }

  th {
    font-weight: 700;
    color: var(--text-dim);
    background: color-mix(in oklab, var(--text) 4%, var(--surface));
  }

  th.hl,
  td.hl {
    background: color-mix(in oklab, var(--accent) 14%, var(--surface));
  }

  td.null {
    color: var(--text-faint);
    font-style: italic;
  }

  tr:last-child td {
    border-bottom: none;
  }

  tr.m-out td {
    color: var(--text-faint);
    text-decoration: line-through;
    background: var(--bad-soft);
  }

  tr.m-new td {
    background: var(--ok-soft);
  }

  tr.m-hit td {
    background: color-mix(in oklab, var(--accent) 20%, var(--surface));
    font-weight: 700;
  }

  tr.m-ghost td {
    background: repeating-linear-gradient(
      -45deg,
      color-mix(in oklab, var(--accent) 10%, var(--surface)) 0 6px,
      var(--surface) 6px 12px
    );
    color: var(--accent);
  }

  tr.m-win td {
    background: color-mix(in oklab, var(--ok) 16%, var(--surface));
  }

  tr.m-dead td {
    color: var(--text-faint);
    text-decoration: line-through;
    opacity: 0.7;
  }

  tr.none td {
    color: var(--text-faint);
    font-style: italic;
  }
</style>
