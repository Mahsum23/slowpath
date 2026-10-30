/**
 * Hooks: a vivid association for the facts that will not stay put on their own.
 *
 * Most of a lesson holds because it makes sense. The arbitrary residue does not: that
 * `RANGE` is the default frame, that `HAVING` cannot see an alias, that `extract` merges
 * years. Those are what a hook is for. Each one pairs the fact (`remember`) with a picture
 * or a story (`hook`) that carries the *reason* as well as the words, because a mnemonic
 * that only encodes the words is the weak kind (Dunlosky et al. 2013 rated keyword
 * mnemonics low utility on their own), while one that ties the image to the mechanism is
 * elaboration, which holds.
 *
 * Three findings decide how they are used:
 * - Odd images are remembered because they stand out from ordinary ones (McDaniel &
 *   Einstein 1986: the bizarreness effect appears in mixed lists only). So hooks are kept
 *   for the important facts, and every one is different in kind from its neighbours.
 * - Something you made yourself is remembered better than something you read (Slamecka &
 *   Graf 1978, the generation effect). So he can write his own, and his replaces mine.
 * - A hook is a retrieval cue, and retrieval is what the deck trains. So a hook comes back
 *   at the moment it is needed: right after a card on its idea was missed.
 *
 * Pure: no app state, no DOM. Tested in scripts/test-hooks.mjs.
 */
import type { Day, DayProgress, Hook, OwnHook } from './types';
import { itemOf } from './focus';
import { partDone } from './parts';
import type { CardRef } from './review';

/** Where a hook's own version is stored: hook ids are unique within a day only. */
export const hookKey = (dayId: string, hookId: string) => `${dayId}:${hookId}`;

/** The hooks a part ends with, or the whole day's when it is read in one go. */
export function hooksForPart(day: Day, part: number | null): Hook[] {
  const all = day.hooks ?? [];
  return part == null ? all : all.filter((h) => (h.part ?? 1) === part);
}

/**
 * The hook for a card that was just missed, if there is one.
 *
 * Most specific first: a hook that names the card, then one that covers its theme, then
 * (on a day in parts) the first hook of the part it checks. A day read in one go has no
 * part to fall back on, so a miss with no named link shows nothing rather than a hook
 * about something else.
 */
export function hookForCard(day: Day, card: Pick<CardRef, 'kind' | 'questionId'>): Hook | null {
  const hooks = day.hooks ?? [];
  if (!hooks.length || !card.questionId) return null;
  const byId = hooks.find((h) => h.cards?.includes(card.questionId!));
  if (byId) return byId;
  const item = itemOf(day, card);
  if (item?.tag) {
    const byTag = hooks.find((h) => h.tags?.includes(item.tag!));
    if (byTag) return byTag;
  }
  if (day.parts?.length && item?.part) return hooks.find((h) => (h.part ?? 1) === item.part) ?? null;
  return null;
}

/** His own version, if he wrote one and has not cleared it. */
export function ownText(own: Record<string, OwnHook> | undefined, dayId: string, hookId: string): string | null {
  const t = own?.[hookKey(dayId, hookId)]?.text?.trim();
  return t ? t : null;
}

/**
 * Two devices' own hooks, merged. The newer write wins per hook, and a cleared one is
 * kept as an empty text (not deleted), so clearing it on one device clears it on all.
 */
export function mergeOwnHooks(
  a: Record<string, OwnHook> | undefined,
  b: Record<string, OwnHook> | undefined,
): Record<string, OwnHook> {
  const out: Record<string, OwnHook> = { ...(a ?? {}) };
  for (const [k, v] of Object.entries(b ?? {})) {
    const mine = out[k];
    if (!mine || v.at > mine.at) out[k] = v;
  }
  return out;
}

/**
 * A colour for each hook, so two neighbouring ones never look alike. Distinctiveness is
 * the whole mechanism, and a page of identical boxes would undo it. The colour follows
 * the hook's place in its day (offset by the day, so day 4 does not open like day 5), so
 * a hook keeps its colour everywhere it appears and consecutive hooks always differ.
 */
export const HOOK_HUES = ['sun', 'coral', 'violet', 'sea', 'leaf', 'rose'] as const;
export type HookHue = (typeof HOOK_HUES)[number];

export function hueOf(day: Pick<Day, 'day' | 'hooks'>, hookId: string): HookHue {
  const i = Math.max(0, (day.hooks ?? []).findIndex((h) => h.id === hookId));
  return HOOK_HUES[(day.day + i) % HOOK_HUES.length];
}

/** Whether the reading a hook belongs to has been done: hooks are kept for read material. */
export function hookRead(day: Day, prog: Pick<DayProgress, 'theoryDone' | 'parts'> | undefined, hook: Hook): boolean {
  return day.parts?.length ? partDone(day, prog, hook.part ?? 1) : Boolean(prog?.theoryDone);
}
