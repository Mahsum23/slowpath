/**
 * Parts: a day read in sittings, not in one go.
 *
 * A day used to be one long page of theory, five questions at the end, then the practice.
 * It was too much to digest at once: by the fifth question the first section was a page
 * and a half behind. So a day can now be split into parts — a few minutes of reading each,
 * closed by the two or three questions that check *that* part, with its cards entering the
 * review deck the moment it is done. The drill, the lab task and the teach-back stay where
 * they were: once, after the last part, as the day's big piece of work.
 *
 * Whether a part is done is decided here and only here, because three things lean on it:
 * the session (which part to open), Today (what to offer next) and the review deck (what
 * it may ask about). A day read before it was split has `theoryDone` and no part records;
 * all its original parts count as read. A part added to a day later carries `added`, and is
 * not — that is what lets a new lesson be slotted into a finished day and still be offered.
 *
 * Pure: tested in scripts/test-parts.mjs.
 */
import type { Day, DayPart, DayProgress } from './types';

type Prog = Pick<DayProgress, 'theoryDone' | 'parts'> | undefined;

export const partsOf = (day: Day): DayPart[] => day.parts ?? [];

/** Whether the day is read in sittings at all. */
export const isParted = (day: Day): boolean => partsOf(day).length > 0;

/** When part `n` was finished, or null. A legacy read counts for the parts that existed. */
export function partDoneAt(day: Day, p: Prog, n: number): string | null {
  const at = p?.parts?.[String(n)];
  if (at) return at;
  const part = partsOf(day).find((x) => x.n === n);
  return part && !part.added && p?.theoryDone ? 'before-parts' : null;
}

export const partDone = (day: Day, p: Prog, n: number): boolean => partDoneAt(day, p, n) !== null;

/** The parts not read yet, in order. */
export const partsLeft = (day: Day, p: Prog): DayPart[] => partsOf(day).filter((x) => !partDone(day, p, x.n));

/** The first part not read yet, or null when there is none (or the day has no parts). */
export const nextPart = (day: Day, p: Prog): DayPart | null => partsLeft(day, p)[0] ?? null;

/** Every part read: the theory is done. A day without parts answers from `theoryDone`. */
export const allPartsDone = (day: Day, p: Prog): boolean =>
  isParted(day) ? partsLeft(day, p).length === 0 : Boolean(p?.theoryDone);

/**
 * Whether something that needs part `n` (a question, a card, a bank item) may be asked.
 * With no part it needs the whole theory: on a day without parts that is `theoryDone`,
 * exactly as before.
 */
export function unlocked(day: Day, p: Prog, n: number | null | undefined): boolean {
  if (n === null || n === undefined || !isParted(day)) return allPartsDone(day, p) || Boolean(p?.theoryDone);
  return partDone(day, p, n);
}

/** The questions that check part `n`. */
export const partQuestions = (day: Day, n: number) => (day.quiz ?? []).filter((q) => q.part === n);

/** Two devices' part records: each part keeps the earlier finish. */
export function mergeParts(a: Record<string, string> | undefined, b: Record<string, string> | undefined): Record<string, string> | undefined {
  if (!a || !b) return a ?? b;
  const out = { ...b };
  for (const [k, v] of Object.entries(a)) out[k] = out[k] && out[k] < v ? out[k] : v;
  return out;
}
