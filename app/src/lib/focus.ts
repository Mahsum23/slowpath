/**
 * Noticing what you keep getting wrong, and leaning on it.
 *
 * A review deck that treats every card alike hands you the same dozen questions whether
 * or not they are the ones that need it. This is the part that pays attention. It does
 * three things, all derived from what is already stored (nothing new to sync):
 *
 *   1. A **theme** per card: the one idea it tests. Authors name it in a phrase
 *      (`tag: partial indexes`); a card with no tag falls back to its whole day.
 *   2. **Heat**: a theme is hot while cards in it were last answered wrong, and cools as
 *      those misses age or the cards are got right. The deck weights hot cards up.
 *   3. **Follow-ups**: the moment you miss a card, pick the others to put in front of you
 *      next — from the same theme first, from other angles (a different kind of card
 *      beats another of the same kind), preferring things you have not seen. Several
 *      small different questions about one mistake beat the same question twice.
 *
 * Pure on purpose: every rule is tested in node (scripts/test-focus.mjs).
 */
import { localDateOf } from './date';
import type { CardRef } from './review';
import type { Day, ReviewCard, ReviewState } from './types';

/** How many follow-ups one miss earns. */
export const FOLLOW_UPS = 3;

/** A miss counts for about this many days before it has mostly cooled. */
const HALF_LIFE_DAYS = 4;

/** Heat at which a theme is worth mentioning. One fresh miss is 1. */
export const HOT = 0.5;

type Rng = () => number;

export interface ItemInfo {
  /** The theme phrase the author gave it, if any. */
  tag: string | null;
  /** What it asks, for telling the model what to avoid repeating. */
  prompt: string;
}

/** Find the content behind a card, whichever file it came from. */
export function itemOf(day: Day, card: Pick<CardRef, 'kind' | 'questionId'>): ItemInfo | null {
  const id = card.questionId;
  if (!id) return null;
  if (card.kind === 'quiz') {
    const q = day.quiz?.find((x) => x.id === id);
    return q ? { tag: q.tag ?? null, prompt: q.prompt } : null;
  }
  if (card.kind === 'drill') {
    const q = day.drill?.find((x) => x.id === id) ?? day.practice?.drill.find((x) => x.id === id);
    return q ? { tag: q.tag ?? null, prompt: q.prompt } : null;
  }
  if (card.kind === 'write') {
    const c = day.write?.challenges.find((x) => x.id === id) ?? day.practice?.write?.challenges.find((x) => x.id === id);
    return c ? { tag: c.tag ?? null, prompt: c.prompt } : null;
  }
  return null;
}

/** A theme's identity: the day plus the tag, or the whole day when there is no tag. */
export function themeKey(day: Day, card: Pick<CardRef, 'kind' | 'questionId'>): string {
  return `${day.id}#${itemOf(day, card)?.tag ?? ''}`;
}

/** What to call a theme on screen. */
export function themeLabel(day: Day, card: Pick<CardRef, 'kind' | 'questionId'>): string {
  return itemOf(day, card)?.tag ?? day.title;
}

/** Whether a card's most recent answer was a miss. A miss resets the streak to zero. */
export function lastWasMiss(rc: ReviewCard | undefined): boolean {
  return Boolean(rc && rc.seen > 0 && rc.streak === 0 && rc.lapses > 0 && rc.lastAt);
}

/** One miss's weight now: 1 when fresh, halving every HALF_LIFE_DAYS. */
export function missWeight(rc: ReviewCard, now: Date): number {
  if (!rc.lastAt) return 0;
  const days = Math.max(0, (now.getTime() - new Date(rc.lastAt).getTime()) / 86_400_000);
  return 0.5 ** (days / HALF_LIFE_DAYS);
}

export interface Heat {
  key: string;
  label: string;
  dayId: string;
  heat: number;
  /** How many cards in the theme are currently sitting on a miss. */
  misses: number;
}

type DayOf = (dayId: string) => Day | undefined;

/** Every theme with something to be worried about, hottest first. */
export function heatMap(deck: CardRef[], state: ReviewState, dayOf: DayOf, now: Date = new Date()): Heat[] {
  const by = new Map<string, Heat>();
  for (const c of deck) {
    const rc = state.cards[c.id];
    if (!lastWasMiss(rc)) continue;
    const day = dayOf(c.dayId);
    if (!day) continue;
    const key = themeKey(day, c);
    const h = by.get(key) ?? { key, label: themeLabel(day, c), dayId: day.id, heat: 0, misses: 0 };
    h.heat += missWeight(rc!, now);
    h.misses++;
    by.set(key, h);
  }
  return [...by.values()].filter((h) => h.heat >= HOT).sort((a, b) => b.heat - a.heat);
}

/** A card's weight when choosing what to deal next: 1, plus its theme's heat, capped. */
export function weightOf(card: CardRef, heats: Heat[], dayOf: DayOf): number {
  if (!heats.length) return 1;
  const day = dayOf(card.dayId);
  if (!day) return 1;
  const key = themeKey(day, card);
  const h = heats.find((x) => x.key === key);
  // Same day, other theme: a little warmth, since a muddled day is rarely one muddle.
  const sameDay = heats.some((x) => x.dayId === day.id);
  return 1 + Math.min(3, (h?.heat ?? 0) * 2) + (sameDay ? 0.4 : 0);
}

export interface FollowUpPick {
  card: CardRef;
  /** Same theme (true) or only the same day (false). */
  sameTheme: boolean;
}

/**
 * The cards to put in front of someone who has just missed `missed`.
 *
 * `pool` is every card that could be dealt — the deck plus bank items not yet dealt.
 * Scoring, highest first: shares the theme (3); a different *kind* of card than the miss
 * and than the previous pick (1 each), because a second angle teaches what the same
 * angle again cannot; the same day (1). Cards already dealt this sitting, and the missed
 * card itself, are out. Ties are shuffled so it is not always the same follow-up.
 *
 * Cards from other days are never picked: a follow-up is for the idea you just missed.
 */
export function pickFollowUps(
  missed: CardRef,
  pool: CardRef[],
  dayOf: DayOf,
  exclude: ReadonlySet<string>,
  n: number = FOLLOW_UPS,
  rng: Rng = Math.random,
): FollowUpPick[] {
  const day = dayOf(missed.dayId);
  if (!day) return [];
  const theme = themeKey(day, missed);
  const picks: FollowUpPick[] = [];
  let prevKind = missed.kind;
  const taken = new Set<string>([missed.id, ...exclude]);
  // Only things a person can answer by themselves: a graded card needs a conversation.
  const eligible = pool.filter((c) => c.dayId === missed.dayId && (c.kind === 'quiz' || c.kind === 'drill' || c.kind === 'write'));
  while (picks.length < n) {
    let best: { c: CardRef; score: number; same: boolean } | null = null;
    for (const c of eligible) {
      if (taken.has(c.id)) continue;
      const same = themeKey(day, c) === theme;
      const score = (same ? 3 : 0) + 1 + (c.kind !== missed.kind ? 1 : 0) + (c.kind !== prevKind ? 1 : 0) + rng() * 0.5;
      if (!best || score > best.score) best = { c, score, same };
    }
    if (!best) break;
    taken.add(best.c.id);
    prevKind = best.c.kind;
    picks.push({ card: best.c, sameTheme: best.same });
  }
  return picks;
}

/** The date a miss is on, local, for "missed today" style copy. */
export const missedOn = (rc: ReviewCard | undefined): string | null => (rc?.lastAt ? localDateOf(rc.lastAt) : null);

// --- answering on reflex ---------------------------------------------------------------

/**
 * A card you have seen enough times gets answered from its shape — the first words, the
 * look of the code, the position of the right option — without being read. That is
 * recognition, not recall, and it measures nothing. Two defences, both here:
 *
 *   - options are reshuffled on every showing (`permutation`), so position cannot be
 *     remembered, and never in the order the lesson showed them;
 *   - an answer given faster than the question can have been read is a *reflex*. Two right
 *     reflexes in a row (`isWorn`, review.ts) and the card stops being dealt as itself: a
 *     fresh question on the same idea takes its place, and its result is credited to it.
 *
 * Speed is a proxy, not proof, so it only ever *changes the question*, never punishes.
 */

/** About how long reading this takes someone fast: ~250 words a minute. */
export const MS_PER_WORD = 240;

export const wordsIn = (text: string): number => (text.match(/[\p{L}\p{N}_]+/gu) ?? []).length;

/** Fast enough that the question cannot have been read: under 35% of its reading time. */
export function isReflex(elapsedMs: number, text: string): boolean {
  const read = wordsIn(text) * MS_PER_WORD;
  return elapsedMs < Math.max(1200, read * 0.35);
}

/** A random order of `n` options that is never the order they were authored in. */
export function permutation(n: number, rng: Rng = Math.random): number[] {
  const a = Array.from({ length: n }, (_, i) => i);
  if (n < 2) return a;
  for (let tries = 0; tries < 8; tries++) {
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    if (a.some((v, i) => v !== i)) return a;
  }
  // Pathological rng: rotate by one, which is certainly not the identity.
  return a.map((_, i) => (i + 1) % n);
}

/**
 * A card as the model needs to see it, from content alone — for writing a different
 * question about the same idea when the card itself has stopped working.
 */
export function cardBrief(day: Day, card: Pick<CardRef, 'kind' | 'questionId'>): string {
  const id = card.questionId;
  if (card.kind === 'quiz' || card.kind === 'drill') {
    const q =
      card.kind === 'quiz'
        ? day.quiz?.find((x) => x.id === id)
        : day.drill?.find((x) => x.id === id) ?? day.practice?.drill.find((x) => x.id === id);
    if (!q) return '';
    const code = 'code' in q && q.code ? `\n\n${q.code}` : '';
    return [
      `A multiple-choice card: ${q.prompt}${code}`,
      ...q.options.map((o) => `- ${o.correct ? '[correct]' : '[wrong]'} ${o.text} — ${o.why}`),
    ].join('\n');
  }
  if (card.kind === 'write') {
    const c = day.write?.challenges.find((x) => x.id === id) ?? day.practice?.write?.challenges.find((x) => x.id === id);
    return c ? `A write-it card: ${c.prompt}\n\nReference answer:\n${c.solution}` : '';
  }
  return '';
}
