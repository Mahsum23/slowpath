<script lang="ts">
  /**
   * Something happened. One surprise at a time, from the top of the screen, in the voice
   * of whatever kind of surprise it is: a page of old source reads like a terminal, a note
   * left behind reads like paper, a beaten misconception arrives as a creature.
   *
   * It waits to be dismissed rather than timing out, because some of these are a paragraph
   * long and the point is that they get read.
   */
  import { app } from '../lib/app.svelte';
  import { router } from '../lib/router.svelte';
  import { KIND_LABEL } from '../lib/eggs';
  import { inlineHtml } from '../lib/inline';

  const egg = $derived(app.eggQueue[0] ?? null);
  const more = $derived(Math.max(0, app.eggQueue.length - 1));

  function cabinet() {
    app.dismissEgg();
    router.go('/curiosities');
  }
</script>

{#if egg}
  {#key egg.id}
    <div class="wrap" role="status" aria-live="polite">
      <article class="egg k-{egg.kind}">
        <div class="sparks" aria-hidden="true">
          {#each Array(10) as _, i}<i style:--i={i}></i>{/each}
        </div>
        <div class="glyph" aria-hidden="true">{egg.glyph}</div>
        <div class="text">
          <p class="kicker">{KIND_LABEL[egg.kind]}</p>
          <h2 class="inline-md">{@html inlineHtml(egg.title)}</h2>
          <p class="body inline-md">{@html inlineHtml(egg.body)}</p>
          <div class="actions">
            <button class="ok" onclick={() => app.dismissEgg()}>{more ? `Next (${more} more)` : 'Nice'}</button>
            <button class="link" onclick={cabinet}>Keep it in the cabinet</button>
          </div>
        </div>
      </article>
    </div>
  {/key}
{/if}

<style>
  .wrap {
    position: fixed;
    top: calc(var(--safe-t) + 10px);
    left: 0;
    right: 0;
    z-index: 80;
    display: flex;
    justify-content: center;
    padding: 0 12px;
    pointer-events: none;
  }

  .egg {
    position: relative;
    pointer-events: auto;
    width: min(100%, 460px);
    display: flex;
    gap: 13px;
    padding: 15px 16px 13px;
    border-radius: 18px;
    background: var(--surface);
    border: 1px solid var(--border-strong);
    box-shadow: var(--shadow-lift);
    animation: drop 0.55s cubic-bezier(0.2, 1.3, 0.35, 1) both;
    overflow: hidden;
  }

  .glyph {
    flex: none;
    font-size: 30px;
    line-height: 1;
    padding-top: 2px;
    animation: wobble 0.9s 0.35s ease-in-out both;
  }

  .text {
    min-width: 0;
    flex: 1;
  }

  .kicker {
    margin: 0 0 3px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--accent);
  }

  h2 {
    margin: 0 0 6px;
    font-size: 16.5px;
    line-height: 1.3;
    letter-spacing: -0.01em;
  }

  .body {
    margin: 0;
    font-size: 14px;
    line-height: 1.5;
    color: var(--text-dim);
  }

  .actions {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-top: 11px;
  }

  .ok {
    padding: 6px 14px;
    border-radius: 999px;
    background: var(--accent);
    color: var(--accent-ink);
    font-size: 13.5px;
    font-weight: 650;
  }

  .link {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-faint);
  }

  /* Old source reads like a terminal. */
  .k-source h2 {
    font-family: var(--font-mono);
    font-size: 14.5px;
  }

  /* A note left behind reads like paper. */
  .k-letter {
    background: #f3e6c4;
    border-color: #c8a865;
  }

  .k-letter h2,
  .k-letter .body {
    font-family: Georgia, 'Iowan Old Style', 'Palatino Linotype', serif;
    color: #3b2f1a;
  }

  .k-letter .kicker {
    color: #8a6420;
  }

  /* A beaten misconception arrives with a little more ceremony. */
  .k-beast {
    border-color: var(--flame);
  }

  .k-beast .kicker {
    color: var(--flame);
  }

  .sparks {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .sparks i {
    position: absolute;
    left: 34px;
    top: 30px;
    width: 5px;
    height: 5px;
    border-radius: 999px;
    background: var(--accent);
    opacity: 0;
    animation: spark 0.9s calc(0.25s + var(--i) * 0.02s) ease-out both;
    --a: calc(var(--i) * 36deg);
  }

  .k-beast .sparks i {
    background: var(--flame);
  }

  @keyframes drop {
    from {
      transform: translateY(-120%) scale(0.96);
      opacity: 0;
    }
    to {
      transform: none;
      opacity: 1;
    }
  }

  @keyframes wobble {
    0% { transform: scale(0.4) rotate(-20deg); }
    55% { transform: scale(1.25) rotate(10deg); }
    100% { transform: none; }
  }

  @keyframes spark {
    0% {
      opacity: 1;
      transform: rotate(var(--a)) translateX(0);
    }
    100% {
      opacity: 0;
      transform: rotate(var(--a)) translateX(46px);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .egg,
    .glyph,
    .sparks i {
      animation: none;
    }
  }
</style>
