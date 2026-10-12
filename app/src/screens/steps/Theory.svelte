<script lang="ts">
  import type { Day, DayPart } from '../../lib/types';
  import { partDone, partQuestions, partsOf } from '../../lib/parts';
  import { app } from '../../lib/app.svelte';
  import Markdown from '../../components/Markdown.svelte';
  import Button from '../../components/Button.svelte';
  import MentorSheet from '../../components/MentorSheet.svelte';
  import { focusComposer, mentorKey } from '../../lib/shortcuts.svelte';
  import SelectionAsk from '../../components/SelectionAsk.svelte';

  interface Props {
    day: Day;
    weekId: string;
    hasQuiz: boolean;
    /** On a day read in parts, the part on screen; `onpart` switches to another. */
    part?: DayPart | null;
    onpart?: (n: number) => void;
    onnext: () => void;
  }
  let { day, weekId, hasQuiz, part = null, onpart, onnext }: Props = $props();

  const parts = $derived(partsOf(day));
  const progress = $derived(app.dayProgress(day.id, weekId));
  const checks = $derived(part ? partQuestions(day, part.n).length : 0);

  let asking = $state(false);
  let ask = $state<string | null>(null);

  // M does what the floating Ask button does, and Esc closes the sheet.
  mentorKey(() => ({
    open: () => { ask = null; asking = true; },
    close: () => (asking = false),
    isOpen: () => asking,
    focus: focusComposer,
  }));
  const week = $derived(app.findDay(weekId, day.id)?.week ?? null);

  // Openers worth a tap while reading, rather than a blank box. Deliberately about
  // understanding the material — the mentor won't write the task, and these shouldn't
  // suggest otherwise.
  const suggestions = $derived([
    `Explain ${day.title.toLowerCase()} a different way`,
    'What do people most often get wrong here?',
    'Why is it designed like this?',
  ]);

  /**
   * Wraps the highlighted passage rather than sending it bare, so the model is told
   * what the quoted text *is* — otherwise a stray fragment of a sentence reads like an
   * instruction rather than the thing being asked about.
   */
  const explainPrompt = (text: string) =>
    `Explain this passage from today's material in detail — what it means, why it is` +
    ` true, and what it would look like in practice:\n\n> ${text.replace(/\n/g, '\n> ')}`;

  function next() {
    // A part is finished by its questions (Session), not by scrolling past it.
    if (!part) void app.markTheoryDone(day, weekId);
    onnext();
  }
</script>

{#if part}
  <!-- Every part of the day, so it is plain how much is left and any part is one tap
       away — re-reading part 2 before part 4's questions should not mean walking back. -->
  <nav class="parts" aria-label="Parts of this day">
    {#each parts as p}
      <button
        class:on={p.n === part.n}
        class:done={partDone(day, progress, p.n)}
        aria-current={p.n === part.n ? 'step' : undefined}
        aria-label="Part {p.n}: {p.title}{partDone(day, progress, p.n) ? ', read' : ''}"
        onclick={() => onpart?.(p.n)}
      >
        <span>{p.n}</span>
      </button>
    {/each}
  </nav>
  <p class="eyebrow">Part {part.n} of {parts.length} · ~{part.minutes} min{part.added ? ' · new' : ''}</p>
  <h1>{part.title}</h1>
  <p class="of">{day.title}</p>
{:else}
  <p class="eyebrow">Theory</p>
  <h1>{day.title}</h1>
{/if}

<SelectionAsk onask={(text) => { ask = explainPrompt(text); asking = true; }}>
  <Markdown source={part ? part.markdown : day.theoryMarkdown} />
</SelectionAsk>

<div class="cta">
  <Button full onclick={next}>
    {#if part}
      {checks ? `Check yourself — ${checks} question${checks === 1 ? '' : 's'}` : 'Finish the part'}
    {:else}
      {hasQuiz ? 'Take the quiz' : 'On to the task'}
    {/if}
    <svg viewBox="0 0 24 24"><path d="M5 12h14m-6-6 6 6-6 6" /></svg>
  </Button>
</div>

<!-- Floating, because the question usually arrives mid-paragraph rather than at the
     end of one — theory pages are long and this has to stay in reach while scrolling. -->
<button class="ask" onclick={() => { ask = null; asking = true; }} aria-label="Ask the mentor">
  <svg viewBox="0 0 24 24"><path d="M21 12a8 8 0 0 1-8 8H7l-4 3 1-5.5A8 8 0 1 1 21 12z" /></svg>
  <span>Ask</span>
</button>

{#if week}
  <MentorSheet {week} {day} {ask} open={asking} onclose={() => (asking = false)} {suggestions} />
{/if}

<style>
  .parts {
    display: flex;
    gap: 6px;
    margin: 0 0 16px;
    flex-wrap: wrap;
  }

  .parts button {
    width: 30px;
    height: 30px;
    border-radius: 999px;
    display: grid;
    place-items: center;
    font-size: 13px;
    font-weight: 650;
    color: var(--text-faint);
    background: var(--surface-2);
    font-variant-numeric: tabular-nums;
  }

  .parts button.done {
    color: var(--ok);
    background: var(--ok-soft);
  }

  .parts button.on {
    color: #fff;
    background: var(--accent);
  }

  .of {
    margin: -14px 0 20px;
    font-size: 13.5px;
    color: var(--text-faint);
  }

  h1 {
    font-size: 26px;
    letter-spacing: -0.025em;
    margin: 4px 0 20px;
  }

  .cta {
    margin-top: 30px;
    padding-top: 22px;
    /* Clears the floating Ask pill, which is fixed over this corner. */
    margin-bottom: 78px;
    border-top: 1px solid var(--border);
  }

  .ask {
    position: fixed;
    right: 16px;
    bottom: calc(var(--safe-b) + 18px);
    z-index: 30;
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 10px 15px 10px 13px;
    border-radius: 999px;
    background: var(--accent);
    color: #fff;
    font-size: 14.5px;
    font-weight: 600;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.22);
  }

  .ask svg {
    width: 17px;
    height: 17px;
  }

  svg {
    width: 18px;
    height: 18px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
</style>
