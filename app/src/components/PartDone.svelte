<script lang="ts">
  /**
   * The end of one part: what it added, and a real choice about what happens next.
   *
   * The point of parts is that stopping after one is a complete day, not an abandoned one,
   * so "stop here" is offered as plainly as "keep going" — and the screen says what the part
   * left behind in the review deck, which is where it will come back.
   */
  import Button from './Button.svelte';
  import { app } from '../lib/app.svelte';
  import { nextPart, partQuestions } from '../lib/parts';
  import type { Day, DayPart } from '../lib/types';

  interface Props {
    day: Day;
    weekId: string;
    part: DayPart;
    onpart: (n: number) => void;
    onpractice: () => void;
    onstop: () => void;
  }
  let { day, weekId, part, onpart, onpractice, onstop }: Props = $props();

  const progress = $derived(app.dayProgress(day.id, weekId));
  const qs = $derived(partQuestions(day, part.n));
  const right = $derived(qs.filter((q) => progress.quiz.correct[q.id]).length);
  const writes = $derived((day.write?.challenges ?? []).filter((c) => c.part === part.n).length);
  const bank = $derived(
    [...(day.practice?.write?.challenges ?? []), ...(day.practice?.drill ?? [])].filter((c) => c.part === part.n).length,
  );
  const next = $derived(nextPart(day, progress));
  const finished = $derived(Boolean(progress.completedAt));
</script>

<div class="done">
  <div class="check" aria-hidden="true">
    <svg viewBox="0 0 24 24"><path d="m5 13 4 4L19 7" /></svg>
  </div>
  <p class="eyebrow">Part {part.n} of {day.parts?.length ?? 1}</p>
  <h1>{part.title}</h1>
  <ul class="facts">
    {#if qs.length}<li><strong>{right} of {qs.length}</strong> right first time</li>{/if}
    <li>
      <strong>{qs.length + writes}</strong> new review card{qs.length + writes === 1 ? '' : 's'}{writes ? `, ${writes} of them a query to write` : ''}
      — they come back over the next days
    </li>
    {#if bank}<li><strong>{bank}</strong> more practice questions open up</li>{/if}
  </ul>

  {#if next && !finished}
    <p class="note">One part is a full day's sitting. Stopping here is fine — the next one waits on Today.</p>
    <p class="up">Up next: <strong>{next.title}</strong> · ~{next.minutes} min</p>
    <div class="actions">
      <Button full onclick={() => onpart(next.n)}>
        Read part {next.n}
        <svg viewBox="0 0 24 24"><path d="M5 12h14m-6-6 6 6-6 6" /></svg>
      </Button>
      <Button full variant="secondary" onclick={onstop}>Stop here for today</Button>
    </div>
  {:else if !finished}
    <p class="note">That was the last part. What's left is the day's practice: the drill, the task and explaining it back.</p>
    <div class="actions">
      <Button full onclick={onpractice}>
        On to the practice
        <svg viewBox="0 0 24 24"><path d="M5 12h14m-6-6 6 6-6 6" /></svg>
      </Button>
      <Button full variant="secondary" onclick={onstop}>Stop here for today</Button>
    </div>
  {:else if next}
    <p class="up">Up next: <strong>{next.title}</strong> · ~{next.minutes} min</p>
    <div class="actions">
      <Button full onclick={() => onpart(next.n)}>
        Read part {next.n}
        <svg viewBox="0 0 24 24"><path d="M5 12h14m-6-6 6 6-6 6" /></svg>
      </Button>
      <Button full variant="secondary" onclick={onstop}>Back to today</Button>
    </div>
  {:else}
    <div class="actions">
      <Button full onclick={onstop}>Back to today</Button>
    </div>
  {/if}
</div>

<style>
  .done {
    padding-top: 8px;
  }

  .check {
    width: 46px;
    height: 46px;
    border-radius: 999px;
    display: grid;
    place-items: center;
    background: var(--ok-soft);
    margin-bottom: 14px;
  }

  .check svg {
    width: 24px;
    height: 24px;
    fill: none;
    stroke: var(--ok);
    stroke-width: 2.4;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  h1 {
    font-size: 24px;
    letter-spacing: -0.02em;
    margin: 4px 0 14px;
  }

  .facts {
    list-style: none;
    padding: 0;
    margin: 0 0 18px;
    display: grid;
    gap: 7px;
    font-size: 15px;
    color: var(--text-dim);
  }

  .facts strong {
    color: var(--text);
  }

  .note {
    font-size: 14px;
    color: var(--text-faint);
    line-height: 1.5;
    margin: 0 0 18px;
  }

  .up {
    font-size: 14.5px;
    color: var(--text-dim);
    margin: 0 0 12px;
  }

  .up strong {
    color: var(--text);
  }

  .actions {
    display: grid;
    gap: 10px;
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
