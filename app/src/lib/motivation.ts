/**
 * Seeing the progress: what the Stats screen and Today show to keep someone going.
 *
 * Built on four findings, each turned into one thing on screen — and on one finding that
 * says what *not* to do:
 *
 *   - **Progress you can see is the motivator.** Amabile & Kramer's diary study (≈12,000
 *     daily entries) found that making progress, even small, was the single biggest
 *     lift to people's inner work life. So the headline is a number that grows when you
 *     learn and fades when you don't: how many questions you would get right *right now*
 *     (`knownNow`), with its history drawn as a line.
 *   - **Competence, made visible** (self-determination theory): the knowledge map shows
 *     each concept by how well it is held — strength from the review schedule, not from
 *     anything you clicked.
 *   - **Broken streaks demotivate; consistency rates don't** (Silverman & Barasch, JCR
 *     2023: a framed-as-broken streak lowered the chance of doing the activity again). So
 *     the calendar counts the days you showed up, and missed days are blank, never red.
 *   - **Fresh starts.** People begin again more readily after temporal landmarks — a new
 *     week, month, or a return (Dai, Milkman & Riis, Management Science 2014). After a gap
 *     Today greets you with what you still know, not with what you lost.
 *   - **Not more points.** Expected, tangible rewards for doing the activity reliably lower
 *     interest in it (Deci, Koestner & Ryan's 1999 meta-analysis of 128 studies);
 *     informational feedback does not. Everything here is information about the material.
 *
 * Pure: tested in scripts/test-motivation.mjs.
 */
import { daysBetween, localDateOf, today } from './date';
import type { Progress, ReviewCard, ReviewState } from './types';

/** One local date's answers: how many, how many right first time, and what was known. */
export interface ActivityDay {
  /** Cards answered. */
  n: number;
  /** ...of which right. */
  right: number;
  /** `knownNow` at the last answer of the day — the line on the Stats screen. */
  known?: number;
}

export type Activity = Record<string, ActivityDay>;

// --- memory strength ----------------------------------------------------------

/**
 * The chance of recalling a card now, 0–1, from its schedule alone.
 *
 * FSRS's forgetting curve, R(t) = (1 + t / 9S)^-1, with stability S taken as the card's
 * interval: a card is designed to come due when recall has fallen to about 90%, which is
 * exactly R(S). A card just answered is near 1; one long overdue drifts towards 0.
 * Returns null for a card never answered.
 */
export function recall(rc: ReviewCard | undefined, now: Date = new Date()): number | null {
  if (!rc || !rc.lastAt || rc.seen === 0) return null;
  const t = Math.max(0, (now.getTime() - new Date(rc.lastAt).getTime()) / 86_400_000);
  const s = Math.max(1, rc.interval);
  return 1 / (1 + t / (9 * s));
}

/** Expected number of cards you would get right if asked all of them now. */
export function knownNow(review: ReviewState, now: Date = new Date()): number {
  let sum = 0;
  for (const rc of Object.values(review.cards)) sum += recall(rc, now) ?? 0;
  return Math.round(sum);
}

export type Strength = 'new' | 'shaky' | 'fading' | 'growing' | 'solid';

export interface ConceptStrength {
  /** Mean recall over the cards met, 0–1; 0 when none met. */
  strength: number;
  /** How many of its cards have been met, and how many it has. */
  met: number;
  total: number;
  /** Cards whose last answer was a miss — "to revisit". */
  misses: number;
  status: Strength;
}

/**
 * How well one concept is held. `cardIds` is every card the concept owns (deck and bank).
 * "Shaky" outranks the average, but only when the misses are a real share of what was met
 * (a quarter or more): one slip among forty is a card to revisit, not a shaky concept, and
 * calling it one would be both wrong and discouraging.
 */
export function conceptStrength(cardIds: string[], review: ReviewState, now: Date = new Date()): ConceptStrength {
  const rs: number[] = [];
  let misses = 0;
  for (const id of cardIds) {
    const rc = review.cards[id];
    const r = recall(rc, now);
    if (r === null) continue;
    rs.push(r);
    if (rc && rc.streak === 0 && rc.lapses > 0) misses++;
  }
  const met = rs.length;
  const strength = met ? rs.reduce((a, b) => a + b, 0) / met : 0;
  const shaky = misses > 0 && misses / met >= 0.25;
  const status: Strength = !met ? 'new' : shaky ? 'shaky' : strength < 0.7 ? 'fading' : strength >= 0.85 && met >= Math.min(5, cardIds.length) ? 'solid' : 'growing';
  return { strength, met, total: cardIds.length, misses, status };
}

/** Five sequential steps for drawing strength; 0 means not met at all. */
export function strengthStep(c: ConceptStrength): 0 | 1 | 2 | 3 | 4 {
  if (!c.met) return 0;
  if (c.strength < 0.6) return 1;
  if (c.strength < 0.75) return 2;
  if (c.strength < 0.88) return 3;
  return 4;
}

// --- the activity log -----------------------------------------------------------

/** Record one answer. Returns a new log; the stored one is replaced, never mutated. */
export function logAnswer(log: Activity | undefined, right: boolean, known: number, at: Date = new Date()): Activity {
  const d = today(at);
  const prev = log?.[d] ?? { n: 0, right: 0 };
  return { ...log, [d]: { n: prev.n + 1, right: prev.right + (right ? 1 : 0), known } };
}

/**
 * Two devices' logs, combined. Per date and field the larger wins — never the sum. A sum
 * is not idempotent: every sync would add the other side's count to itself again (the
 * review deck's daily tally once doubled each round trip until it read 49196). Max can
 * undercount a day split across two devices, which is the honest direction to be wrong.
 */
export function mergeActivity(a: Activity | undefined, b: Activity | undefined): Activity | undefined {
  if (!a || !b) return a ?? b;
  const out: Activity = { ...b };
  for (const [d, x] of Object.entries(a)) {
    const y = out[d];
    out[d] = y
      ? { n: Math.max(x.n, y.n), right: Math.max(x.right, y.right), known: Math.max(x.known ?? 0, y.known ?? 0) || undefined }
      : x;
  }
  return out;
}

/**
 * How much happened on each date, from everything the progress record knows: the answer
 * log, lessons finished, practice rounds, and — for days before the log existed — the
 * cards whose last answer fell on that date.
 */
export function activityScores(progress: Progress, activity: Activity | undefined): Map<string, number> {
  const s = new Map<string, number>();
  const add = (d: string, v: number) => s.set(d, (s.get(d) ?? 0) + v);
  const logged = new Set(Object.keys(activity ?? {}));
  for (const [d, a] of Object.entries(activity ?? {})) add(d, a.n);
  for (const day of Object.values(progress.days)) {
    if (day.completedAt) add(localDateOf(day.completedAt), 10);
    for (const r of day.practice?.rounds ?? []) add(localDateOf(r.at), r.asked);
  }
  for (const rc of Object.values(progress.review.cards)) {
    if (!rc.lastAt) continue;
    const d = localDateOf(rc.lastAt);
    if (!logged.has(d)) add(d, 1);
  }
  return s;
}

/** A score as one of five intensity steps for the calendar. */
export function activityStep(score: number): 0 | 1 | 2 | 3 | 4 {
  if (score <= 0) return 0;
  if (score < 6) return 1;
  if (score < 16) return 2;
  if (score < 30) return 3;
  return 4;
}

export interface CalendarCell {
  date: string;
  score: number;
  step: 0 | 1 | 2 | 3 | 4;
  future: boolean;
}

/**
 * The calendar: `weeks` columns of seven days, Monday first, ending with this week.
 * Days after today are marked `future` so they can be drawn as nothing at all.
 */
export function calendar(scores: Map<string, number>, weeks = 16, now: Date = new Date()): CalendarCell[][] {
  const t = today(now);
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dow = (base.getDay() + 6) % 7; // Monday = 0
  const start = new Date(base);
  start.setDate(base.getDate() - dow - (weeks - 1) * 7);
  const cols: CalendarCell[][] = [];
  for (let w = 0; w < weeks; w++) {
    const col: CalendarCell[] = [];
    for (let d = 0; d < 7; d++) {
      const day = new Date(start);
      day.setDate(start.getDate() + w * 7 + d);
      const date = today(day);
      const score = scores.get(date) ?? 0;
      col.push({ date, score, step: activityStep(score), future: date > t });
    }
    cols.push(col);
  }
  return cols;
}

/** Days with anything done among the last `span` days, today included. */
export function consistency(scores: Map<string, number>, span = 30, now: Date = new Date()): { active: number; span: number } {
  let active = 0;
  for (let i = 0; i < span; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    if ((scores.get(today(d)) ?? 0) > 0) active++;
  }
  return { active, span };
}

export interface WeekAccuracy {
  /** Monday of the week. */
  week: string;
  n: number;
  /** Right / answered, 0–1. */
  rate: number;
}

/** Answers per Monday-start week, oldest first; weeks with fewer than `min` answers are left out. */
export function weeklyAccuracy(activity: Activity | undefined, min = 5): WeekAccuracy[] {
  const by = new Map<string, { n: number; right: number }>();
  for (const [d, a] of Object.entries(activity ?? {})) {
    const [y, m, dd] = d.split('-').map(Number);
    const date = new Date(y, m - 1, dd);
    date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
    const wk = today(date);
    const cur = by.get(wk) ?? { n: 0, right: 0 };
    by.set(wk, { n: cur.n + a.n, right: cur.right + a.right });
  }
  return [...by.entries()]
    .filter(([, v]) => v.n >= min)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, v]) => ({ week, n: v.n, rate: v.right / v.n }));
}

/** The "known now" history, oldest first: one point per day that has one. */
export function knownHistory(activity: Activity | undefined): { date: string; known: number }[] {
  return Object.entries(activity ?? {})
    .filter(([, a]) => typeof a.known === 'number')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, a]) => ({ date, known: a.known! }));
}

// --- fresh starts and small wins ------------------------------------------------

export type FreshStart = { kind: 'return'; gap: number } | { kind: 'week' } | { kind: 'month' } | null;

/**
 * Whether today is a fresh start worth naming. Only before anything has been done today,
 * and only when there was something before (a first ever visit is not a *re*-start).
 * A return after two or more empty days outranks the calendar.
 */
export function freshStart(lastActive: string | null, now: Date = new Date()): FreshStart {
  const t = today(now);
  if (!lastActive || lastActive === t) return null;
  const gap = daysBetween(lastActive, t);
  if (gap >= 3) return { kind: 'return', gap: gap - 1 };
  if (now.getDate() === 1) return { kind: 'month' };
  if (now.getDay() === 1) return { kind: 'week' };
  return null;
}

/** The most recent date with anything done, before today. */
export function lastActiveBefore(scores: Map<string, number>, now: Date = new Date()): string | null {
  const t = today(now);
  let best: string | null = null;
  for (const [d, v] of scores) if (v > 0 && d < t && (!best || d > best)) best = d;
  return best;
}
