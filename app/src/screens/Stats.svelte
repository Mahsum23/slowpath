<script lang="ts">
  import { app } from '../lib/app.svelte';
  import { router, sessionPath } from '../lib/router.svelte';
  import { BADGES } from '../lib/badges';
  import { levelOf, levelProgress } from '../lib/xp';
  import Flame from '../components/Flame.svelte';
  import { formatDate, localDateOf, today } from '../lib/date';
  import { calendar, consistency, knownHistory, knownNow, weeklyAccuracy } from '../lib/motivation';
  import KnownLine from '../components/KnownLine.svelte';
  import ActivityCalendar from '../components/ActivityCalendar.svelte';
  import KnowledgeMap from '../components/KnowledgeMap.svelte';
  import AccuracyBars from '../components/AccuracyBars.svelte';
  import { TRACKS } from '../lib/types';

  const lp = $derived(levelProgress(app.progress.xp));
  const earned = $derived(app.progress.badges);

  // What you know right now, and how that has moved.
  const known = $derived(knownNow(app.progress.review));
  // The logged history, ending at today's live value so the line meets the big number.
  const history = $derived.by(() => {
    const t = today();
    const past = knownHistory(app.progress.activity).filter((p) => p.date < t).slice(-59);
    return past.length ? [...past, { date: t, known }] : past;
  });
  const weekAgo = $derived.by(() => {
    const cut = new Date();
    cut.setDate(cut.getDate() - 7);
    const iso = today(cut);
    const before = history.filter((p) => p.date <= iso).at(-1);
    return before ? known - before.known : null;
  });

  const scores = $derived(app.scores);
  // From the week you started (at least eight weeks, at most sixteen): months of empty
  // squares before you began are not part of your story.
  const weeks = $derived.by(() => {
    const first = [...scores.entries()].filter(([, v]) => v > 0).map(([d]) => d).sort()[0];
    const span = first ? Math.ceil((Date.now() - new Date(`${first}T12:00`).getTime()) / (7 * 86_400_000)) + 1 : 8;
    return calendar(scores, Math.max(8, Math.min(16, span)));
  });
  const steady = $derived(consistency(scores, 30));
  const accuracy = $derived(weeklyAccuracy(app.progress.activity).slice(-10));
  // Only concepts you have reached: a list of lessons not yet opened is a to-do list, not progress.
  const allConcepts = $derived(app.knowledge);
  const map = $derived(allConcepts.filter((k) => k.s.met > 0 || app.progress.days[k.day.id]?.theoryDone));
  const ahead = $derived(allConcepts.length - map.length);
  const solid = $derived(map.filter((k) => k.s.status === 'solid').length);
</script>

<div class="screen">
  <h1>Progress</h1>

  <!-- The headline is about the material, not about points: how much you would get right
       if asked now. It goes up when you learn and drifts down when you leave it, which
       makes it the one number that is honest in both directions. -->
  <section class="card hero">
    <p class="lbl">You'd get right, if asked now</p>
    <p class="figure">
      <span class="numeral">{known}</span>
      <span class="unit">question{known === 1 ? '' : 's'}</span>
    </p>
    {#if weekAgo !== null}
      <p class="delta" class:up={weekAgo > 0}>
        {#if weekAgo > 0}+{weekAgo} since a week ago — that is learning, measured
        {:else if weekAgo < 0}{-weekAgo} fewer than a week ago — the forgetting curve at work; a round or two brings them back
        {:else}Holding steady since a week ago{/if}
      </p>
    {/if}
    {#if history.length >= 2}
      <KnownLine points={history} />
    {:else}
      <p class="sub soon">
        Estimated from your review schedule: each card's chance of being recalled today. The
        line of how it grows starts drawing after your next few answers.
      </p>
    {/if}
  </section>

  {#if app.path && map.length}
    <h2>What you know · {TRACKS[app.track].label}</h2>
    <p class="sub">
      {solid ? `${solid} of ${map.length} concepts solid.` : `${map.length} concepts so far.`}
      Strength comes from how you have answered, and fades if a concept is left alone — tap one to
      practise it.
    </p>
    <KnowledgeMap items={map} weekId={app.path.id} />
    {#if ahead}
      <p class="sub ahead">{ahead} more concept{ahead === 1 ? '' : 's'} written and waiting further along the path.</p>
    {/if}
  {/if}

  <h2>Showing up</h2>
  <p class="sub">
    Active on <strong>{steady.active}</strong> of the last {steady.span} days. Consistency is what
    builds this, not an unbroken chain — a day off leaves a gap, not a debt.
  </p>
  <ActivityCalendar {weeks} />

  <h2>Getting sharper</h2>
  {#if accuracy.length >= 2}
    <p class="sub">Right first time, week by week.</p>
    <AccuracyBars weeks={accuracy} />
  {:else}
    <p class="sub">
      Right first time, week by week — this fills in once there are two weeks with a handful of
      answers in each.
    </p>
  {/if}

  <h2>The rest</h2>
  <div class="tiles">
    <div class="card tile">
      <Flame count={app.streakCount} atRisk={app.streakAtRisk} size={26} />
      <span class="lbl">day streak</span>
      {#if app.progress.streak.freezes > 0}
        <span class="chip">{app.progress.streak.freezes} freeze{app.progress.streak.freezes > 1 ? 's' : ''} banked</span>
      {/if}
    </div>
    <div class="card tile">
      <span class="numeral big">{app.daysDone}</span>
      <span class="lbl">sessions done</span>
    </div>
    <div class="card tile">
      <span class="numeral big">{app.progress.xp}</span>
      <span class="lbl">XP · level {levelOf(app.progress.xp)}</span>
      <div class="xpbar"><span style:width="{lp.pct}%"></span></div>
    </div>
    <div class="card tile">
      <span class="numeral big">{app.progress.streak.longest}</span>
      <span class="lbl">longest streak</span>
    </div>
  </div>

  {#if app.streakAtRisk}
    <p class="risk">One session today keeps the run alive. That's the whole ask.</p>
  {/if}

  <h2>Badges</h2>
  <div class="badges">
    {#each BADGES as badge}
      {@const has = Boolean(earned[badge.id])}
      <div class="card badge" class:locked={!has}>
        <span class="glyph">{has ? badge.glyph : '·'}</span>
        <div>
          <strong>{badge.name}</strong>
          <p>{has ? badge.blurb : 'Not yet.'}</p>
          {#if has}
            <span class="when">{formatDate(localDateOf(earned[badge.id]))}</span>
          {/if}
        </div>
      </div>
    {/each}
  </div>

  <h2>What confused you</h2>
  {#if app.notedDays.length}
    <p class="sub">
      The honest column. Green checkmarks are not the point of this — these are.
    </p>
    <div class="notes">
      {#each app.notedDays as n}
        <button class="card note" onclick={() => router.go(sessionPath(n.week.id, n.day.id, 0))}>
          <span class="day">Day {n.day.day} · {n.day.title}</span>
          <p>{n.notes}</p>
        </button>
      {/each}
    </div>
  {:else}
    <p class="sub">
      Nothing logged yet. Write what tripped you up in the task step — it's worth more
      later than the fact you finished.
    </p>
  {/if}
</div>

<style>
  .hero {
    padding: 18px 18px 12px;
  }

  .hero .lbl {
    margin: 0;
  }

  .figure {
    margin: 4px 0 0;
    display: flex;
    align-items: baseline;
    gap: 8px;
  }

  .figure .numeral {
    font-size: 52px;
    font-weight: 700;
    line-height: 1;
    letter-spacing: -0.03em;
  }

  .unit {
    font-size: 15px;
    color: var(--text-dim);
  }

  .delta {
    margin: 6px 0 10px;
    font-size: 13.5px;
    color: var(--text-dim);
  }

  .delta.up {
    color: var(--ok);
  }

  .ahead {
    margin: 10px 0 0;
  }

  .soon {
    margin: 10px 0 4px;
  }

  h1 {
    font-size: 27px;
    letter-spacing: -0.025em;
    margin-bottom: 20px;
  }

  h2 {
    font-size: 16px;
    margin: 30px 0 12px;
  }

  .sub {
    font-size: 14px;
    color: var(--text-faint);
    line-height: 1.5;
    margin: -4px 0 14px;
  }

  .tiles {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .tile {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 3px;
    align-items: flex-start;
  }

  .big {
    font-size: 27px;
    line-height: 1.1;
  }

  .lbl {
    font-size: 11.5px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-faint);
  }

  .chip {
    margin-top: 6px;
    font-size: 11.5px;
    background: var(--surface-2);
    border-radius: 999px;
    padding: 3px 9px;
    color: var(--text-dim);
  }

  .xpbar {
    width: 100%;
    height: 5px;
    background: var(--surface-2);
    border-radius: 3px;
    margin-top: 9px;
    overflow: hidden;
  }

  .xpbar span {
    display: block;
    height: 100%;
    background: var(--accent);
    border-radius: 3px;
    transition: width 0.4s ease;
  }

  .risk {
    margin: 14px 0 0;
    font-size: 14px;
    color: var(--text-dim);
    background: var(--surface-2);
    border-radius: 12px;
    padding: 11px 14px;
  }

  .badges {
    display: grid;
    gap: 8px;
  }

  .badge {
    display: flex;
    gap: 13px;
    align-items: flex-start;
    padding: 13px 15px;
  }

  .badge.locked {
    opacity: 0.5;
    box-shadow: none;
  }

  .glyph {
    font-size: 21px;
    width: 26px;
    text-align: center;
    line-height: 1.3;
  }

  .badge strong {
    font-size: 15px;
  }

  .badge p {
    margin: 2px 0 0;
    font-size: 13.5px;
    line-height: 1.45;
    color: var(--text-dim);
  }

  .when {
    display: inline-block;
    margin-top: 5px;
    font-size: 11.5px;
    color: var(--text-faint);
  }

  .notes {
    display: grid;
    gap: 8px;
  }

  .note {
    text-align: left;
    padding: 13px 15px;
  }

  .note .day {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-faint);
  }

  .note p {
    margin: 5px 0 0;
    font-size: 14.5px;
    line-height: 1.5;
    color: var(--text-dim);
    white-space: pre-wrap;
  }
</style>
