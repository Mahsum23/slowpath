<script lang="ts">
  /**
   * One hook: the fact, the picture that carries it, and room for his own version.
   *
   * His own replaces mine once written (the generation effect: what you made yourself
   * holds better than what you read), and mine stays one tap away. See hooks.ts.
   */
  import type { Day, Hook } from '../lib/types';
  import { app } from '../lib/app.svelte';
  import { hueOf, ownText } from '../lib/hooks';
  import { inlineHtml } from '../lib/inline';

  interface Props {
    day: Day;
    hook: Hook;
    /** Shown after a miss: says why it is here. */
    reason?: string | null;
    /** The fact starts hidden behind its picture, for testing yourself. */
    covered?: boolean;
  }
  let { day, hook, reason = null, covered = false }: Props = $props();
  let uncovered = $state(false);
  const hidden = $derived(covered && !uncovered);

  const own = $derived(ownText(app.progress.hooks, day.id, hook.id));
  const hue = $derived(hueOf(day, hook.id));
  let showMine = $state(false);
  let editing = $state(false);
  let draft = $state('');

  function edit() {
    draft = own ?? '';
    editing = true;
  }

  async function save() {
    await app.saveOwnHook(day.id, hook.id, draft);
    editing = false;
    showMine = false;
  }
</script>

<aside class="hook h-{hue}" aria-label={hidden ? "Memory hook" : `Memory hook: ${hook.remember}`}>
  {#if reason}<p class="reason">{reason}</p>{/if}
  <div class="top">
    <span class="glyph" aria-hidden="true">{hook.glyph}</span>
    {#if hidden}
      <button class="remember reveal" onclick={() => (uncovered = true)}>What story goes with this, and what rule does it carry? Say it, then tap</button>
    {:else}
      <p class="remember inline-md">{@html inlineHtml(hook.remember)}</p>
    {/if}
  </div>

  {#if hidden}
    <!-- Covered: the picture alone is the cue. The story would give the rule away. -->
  {:else if editing}
    <label class="sr" for="own-{hook.id}">Your own hook</label>
    <textarea
      id="own-{hook.id}"
      bind:value={draft}
      rows="4"
      placeholder="The stranger and more personal, the better: a person you know, a place, a joke only you get."
    ></textarea>
    <div class="row">
      <button class="act strong" onclick={() => void save()}>{draft.trim() ? 'Keep this one' : own ? 'Clear mine' : 'Cancel'}</button>
      <button class="act" onclick={() => (editing = false)}>Cancel</button>
    </div>
  {:else}
    {#if own && !showMine}
      <p class="kicker">Yours</p>
      <p class="text own">{own}</p>
    {:else}
      <p class="text inline-md">{@html inlineHtml(hook.hook)}</p>
    {/if}
    <div class="row">
      {#if own}
        <button class="act" onclick={() => (showMine = !showMine)}>{showMine ? 'Show yours' : 'Show the original'}</button>
        <button class="act" onclick={edit}>Edit yours</button>
      {:else}
        <button class="act" onclick={edit}>Make your own</button>
      {/if}
    </div>
  {/if}
</aside>

<style>
  .hook {
    --h: #e0a400;
    margin: 18px 0;
    padding: 14px 15px 10px;
    border-radius: var(--radius);
    background: color-mix(in oklab, var(--h) 13%, var(--surface));
    border: 1px solid color-mix(in oklab, var(--h) 35%, var(--border));
    border-left: 5px solid var(--h);
  }

  .h-sun { --h: #e0a400; }
  .h-coral { --h: #e8664a; }
  .h-violet { --h: #8a5cf0; }
  .h-sea { --h: #1a9bb8; }
  .h-leaf { --h: #3fa34d; }
  .h-rose { --h: #d9488f; }

  .reason {
    margin: 0 0 8px;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: color-mix(in oklab, var(--h) 60%, var(--text));
  }

  .top {
    display: flex;
    gap: 12px;
    align-items: center;
  }

  .glyph {
    font-size: 34px;
    line-height: 1;
    flex: none;
  }

  .remember {
    margin: 0;
    font-weight: 700;
    font-size: 15px;
    line-height: 1.35;
  }

  .reveal {
    text-align: left;
    font-weight: 650;
    color: var(--text-dim);
    border-bottom: 1px dashed currentColor;
  }

  .kicker {
    margin: 10px 0 0;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-faint);
  }

  .text {
    margin: 9px 0 0;
    font-size: 14.5px;
    line-height: 1.55;
    color: var(--text);
  }

  .kicker + .text {
    margin-top: 3px;
  }

  .own {
    white-space: pre-wrap;
    font-style: italic;
  }

  textarea {
    width: 100%;
    margin-top: 10px;
    padding: 9px 10px;
    border-radius: 10px;
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text);
    font: inherit;
    font-size: 14.5px;
    resize: vertical;
  }

  .row {
    display: flex;
    gap: 14px;
    margin-top: 8px;
  }

  .act {
    font-size: 13px;
    font-weight: 650;
    color: color-mix(in oklab, var(--h) 55%, var(--text));
    padding: 4px 0;
  }

  .act.strong {
    color: var(--accent);
  }

  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
  }
</style>
