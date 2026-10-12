<script lang="ts">
  /**
   * The cabinet of curiosities: everything that has happened along the way, kept.
   *
   * There is deliberately no "N of M": the point of a surprise is that you did not know it
   * was coming, and a checklist of the ones left would turn them back into chores. The
   * cabinet only says that some are still hidden — which is true, and is the only hint.
   */
  import { app } from '../lib/app.svelte';
  import { router } from '../lib/router.svelte';
  import { KIND_LABEL, type EggKind, type FoundEgg } from '../lib/eggs';
  import { inlineHtml } from '../lib/inline';
  import { formatDate } from '../lib/date';
  import { localDateOf } from '../lib/date';

  /** Shelves, in the order they are worth reading. */
  const SHELVES: { kinds: EggKind[]; title: string; note: string }[] = [
    { kinds: ['letter'], title: 'Notes left here', note: 'Written for whoever got that far.' },
    { kinds: ['beast'], title: 'Bestiary', note: 'Every one a mistake you came back from.' },
    { kinds: ['source'], title: 'Found in the source', note: 'Real lines from real code, and the stories behind them.' },
    { kinds: ['fact', 'rumour'], title: 'Strange but true', note: 'Facts that rearrange things — and the odd rumour.' },
    { kinds: ['secret'], title: 'Secret modes', note: 'Switch them back on or off here.' },
    { kinds: ['mentor', 'answer'], title: 'Things you said', note: 'Words that got an answer nobody asked the model for.' },
    { kinds: ['clock', 'calendar', 'milestone'], title: 'The right moment', note: 'Times, dates and round numbers that were worth a word.' },
  ];

  const found = $derived(Object.entries(app.eggs.found).sort(([, a], [, b]) => a.at.localeCompare(b.at)));
  const shelves = $derived(
    SHELVES.map((s) => ({ ...s, items: found.filter(([, e]) => s.kinds.includes(e.kind)) })).filter((s) => s.items.length),
  );

  const modeOf = (id: string) => (id === 'secret:phosphor' ? 'phosphor' : id === 'secret:dragons' ? 'dragons' : null);
  const when = (e: FoundEgg) => formatDate(localDateOf(e.at));
</script>

<div class="screen">
  <button class="back" onclick={() => router.back()} aria-label="Back">
    <svg viewBox="0 0 24 24"><path d="m15 5-7 7 7 7" /></svg>
  </button>
  <p class="eyebrow">🗝️ Hidden in plain sight</p>
  <h1>The cabinet of curiosities</h1>
  <p class="intro">
    Things that happened along the way. Nobody told you they were here, and nobody can tell
    you what is left — only that some of it is still hidden.
  </p>

  {#if !found.length}
    <p class="empty">Empty, for now. Keep going.</p>
  {/if}

  {#each shelves as shelf}
    <section>
      <h2>{shelf.title}</h2>
      <p class="note">{shelf.note}</p>
      <div class="items">
        {#each shelf.items as [id, e]}
          {@const mode = modeOf(id)}
          <article class="item k-{e.kind}">
            <span class="glyph" aria-hidden="true">{e.glyph}</span>
            <div class="text">
              <p class="kicker">{KIND_LABEL[e.kind]} · {when(e)}</p>
              <h3 class="inline-md">{@html inlineHtml(e.title)}</h3>
              <p class="body inline-md">{@html inlineHtml(e.body)}</p>
              {#if mode}
                <button class="toggle" onclick={() => void app.toggleSecret(mode)}>
                  {app.modes[mode] ? 'Switch it off' : 'Switch it on'}
                </button>
              {/if}
            </div>
          </article>
        {/each}
      </div>
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
    margin: 0 0 22px;
  }

  .empty {
    color: var(--text-faint);
  }

  section {
    margin-bottom: 26px;
  }

  h2 {
    font-size: 17px;
    margin: 0 0 2px;
  }

  .note {
    margin: 0 0 10px;
    font-size: 13px;
    color: var(--text-faint);
  }

  .items {
    display: grid;
    gap: 9px;
  }

  .item {
    display: flex;
    gap: 12px;
    padding: 13px 14px;
    border-radius: var(--radius);
    background: var(--surface);
    border: 1px solid var(--border);
  }

  .glyph {
    font-size: 24px;
    line-height: 1.1;
    flex: none;
  }

  .text {
    min-width: 0;
  }

  .kicker {
    margin: 0 0 2px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-faint);
  }

  h3 {
    margin: 0 0 5px;
    font-size: 15px;
    line-height: 1.35;
  }

  .k-source h3 {
    font-family: var(--font-mono);
    font-size: 13.5px;
  }

  .k-letter {
    background: #f3e6c4;
  }

  .k-letter .kicker {
    color: #8a6420;
  }

  .k-letter h3,
  .k-letter .body {
    font-family: Georgia, 'Iowan Old Style', 'Palatino Linotype', serif;
    color: #3b2f1a;
  }

  .k-beast {
    border-color: color-mix(in oklab, var(--flame) 50%, var(--border));
  }

  .body {
    margin: 0;
    font-size: 13.5px;
    line-height: 1.5;
    color: var(--text-dim);
  }

  .toggle {
    margin-top: 8px;
    font-size: 13px;
    font-weight: 650;
    color: var(--accent);
  }
</style>
