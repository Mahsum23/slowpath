/**
 * test-motivation.mjs — what the progress screens show (motivation.ts): memory strength,
 * the answer log and how it merges, the calendar, consistency, fresh starts.
 *
 * Run: npm test
 */
import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const cache = new URL('../node_modules/.cache/slowpath/', import.meta.url).pathname;
mkdirSync(cache, { recursive: true });
const outfile = join(cache, 'motivation.mjs');
await build({ entryPoints: [new URL('../src/lib/motivation.ts', import.meta.url).pathname], bundle: true, format: 'esm', platform: 'node', outfile });
const M = await import(outfile);

let fails = 0;
const ok = (label, cond, extra) => {
  if (!cond) { fails++; console.log(`  FAIL  ${label}${extra ? `\n        ${extra}` : ''}`); }
  else console.log(`  PASS  ${label}`);
};
const NOW = new Date(2026, 9, 8, 12, 0, 0); // Thursday 8 Oct 2026, local
const ago = (days) => new Date(NOW.getTime() - days * 86_400_000).toISOString();
const card = (interval, daysAgo, extra = {}) => ({ interval, ease: 2.3, streak: 1, due: '2026-10-09', seen: 1, lapses: 0, lastAt: ago(daysAgo), ...extra });

console.log('— memory strength —');
ok('a card never answered has no strength', M.recall(undefined, NOW) === null && M.recall({ ...card(1, 0), seen: 0, lastAt: null }, NOW) === null);
ok('just answered is near 1', M.recall(card(3, 0), NOW) > 0.99);
ok('at its interval, about 90% — when the schedule brings it back', Math.abs(M.recall(card(10, 10), NOW) - 0.9) < 0.001);
ok('long overdue drifts towards 0', M.recall(card(1, 60), NOW) < 0.2);
ok('a longer interval decays slower', M.recall(card(20, 10), NOW) > M.recall(card(5, 10), NOW));
const review = { cards: { a: card(10, 0), b: card(10, 10), c: card(1, 60) }, lastAmbush: null };
ok('knownNow is the expected number right', M.knownNow(review, NOW) === Math.round(1 + 0.9 + M.recall(card(1, 60), NOW)));

console.log('\n— a concept\'s strength —');
const ids = ['a', 'b', 'x', 'y', 'z'];
const s1 = M.conceptStrength(ids, review, NOW);
ok('counts what was met out of what exists', s1.met === 2 && s1.total === 5);
ok('strength is the mean recall over what was met', Math.abs(s1.strength - 0.95) < 0.01);
ok('nothing met is "new"', M.conceptStrength(['x'], review, NOW).status === 'new');
ok('a card last answered wrong makes the concept "shaky", whatever the average', M.conceptStrength(['a', 'm'], { cards: { a: card(30, 0), m: card(1, 0, { streak: 0, lapses: 1 }) } }, NOW).status === 'shaky');
const many20 = { cards: { ...Object.fromEntries(Array.from({ length: 19 }, (_, i) => [`k${i}`, card(20, 1)])), slip: card(1, 0, { streak: 0, lapses: 1 }) } };
const one = M.conceptStrength([...Array.from({ length: 19 }, (_, i) => `k${i}`), 'slip'], many20, NOW);
ok('one slip among twenty is a card to revisit, not a shaky concept', one.status !== 'shaky' && one.misses === 1);
ok('a low average is "fading"', M.conceptStrength(['c'], review, NOW).status === 'fading');
const many = { cards: Object.fromEntries(['1', '2', '3', '4', '5'].map((k) => [k, card(20, 1)])) };
ok('strong across enough cards is "solid"', M.conceptStrength(['1', '2', '3', '4', '5', '6'], many, NOW).status === 'solid');
ok('strong on two cards out of thirty is only "growing"', M.conceptStrength(['1', '2', ...Array.from({ length: 28 }, (_, i) => `q${i}`)], many, NOW).status === 'growing');
ok('steps: not met is 0, strong is 4', M.strengthStep({ met: 0, strength: 0 }) === 0 && M.strengthStep({ met: 3, strength: 0.95 }) === 4 && M.strengthStep({ met: 3, strength: 0.5 }) === 1);

console.log('\n— the answer log —');
let log = M.logAnswer(undefined, true, 10, NOW);
log = M.logAnswer(log, false, 11, NOW);
const d = '2026-10-08';
ok('answers and rights count up per local date', log[d].n === 2 && log[d].right === 1);
ok('known is the latest value', log[d].known === 11);
const other = { [d]: { n: 5, right: 4, known: 9 }, '2026-10-07': { n: 3, right: 3, known: 7 } };
const m = M.mergeActivity(log, other);
ok('merging takes the larger per field, never the sum', m[d].n === 5 && m[d].right === 4 && m[d].known === 11);
ok('dates only one side has survive', m['2026-10-07'].n === 3);
ok('merging is idempotent', JSON.stringify(M.mergeActivity(m, m)) === JSON.stringify(m));
ok('one side missing is the other', M.mergeActivity(undefined, other) === other);

console.log('\n— the calendar and consistency —');
const progress = {
  days: {
    a: { completedAt: new Date(2026, 9, 5, 9).toISOString(), practice: { rounds: [{ at: new Date(2026, 9, 6, 9).toISOString(), asked: 10, right: 8 }] } },
  },
  review: { cards: { old: card(3, 20) } },
};
const scores = M.activityScores(progress, { [d]: { n: 4, right: 3 } });
ok('a finished lesson counts on its date', (scores.get('2026-10-05') ?? 0) >= 10);
ok('a practice round counts its questions', scores.get('2026-10-06') === 10);
ok('the log counts its answers', scores.get(d) === 4);
ok('days before the log existed still show, from cards answered then', (scores.get('2026-09-18') ?? 0) >= 1);
const cal = M.calendar(scores, 16, NOW);
ok('16 columns of 7 days', cal.length === 16 && cal.every((c) => c.length === 7));
ok('each column starts on a Monday', cal.every((c) => new Date(c[0].date + 'T12:00').getDay() === 1));
ok('the last column holds today, and days after it are future', cal[15].some((c) => c.date === d) && cal[15].filter((c) => c.future).length === 3);
ok('a busy day draws darker than a light one', M.activityStep(40) > M.activityStep(3) && M.activityStep(0) === 0);
ok('consistency counts days with anything done', M.consistency(scores, 30, NOW).active === 4);

console.log('\n— getting sharper, and growing —');
const wk = M.weeklyAccuracy({ '2026-10-05': { n: 4, right: 2 }, '2026-10-08': { n: 6, right: 6 }, '2026-09-28': { n: 2, right: 2 } }, 5);
ok('answers group by Monday-start week', wk.length === 1 && wk[0].week === '2026-10-05' && wk[0].n === 10 && wk[0].rate === 0.8);
ok('a week with too few answers is left out rather than drawn as noise', !wk.some((w) => w.week === '2026-09-28'));
ok('the known line is in date order', JSON.stringify(M.knownHistory({ '2026-10-08': { n: 1, right: 1, known: 9 }, '2026-10-01': { n: 1, right: 1, known: 4 }, '2026-10-03': { n: 1, right: 0 } }).map((p) => p.known)) === '[4,9]');

console.log('\n— fresh starts —');
ok('a return after two empty days is named, with the gap', JSON.stringify(M.freshStart('2026-10-05', NOW)) === JSON.stringify({ kind: 'return', gap: 2 }));
ok('yesterday is not a fresh start', M.freshStart('2026-10-07', NOW) === null);
ok('already active today: nothing to say', M.freshStart('2026-10-08', NOW) === null);
ok('first visit ever is not a *re*-start', M.freshStart(null, NOW) === null);
ok('a Monday is a new week', M.freshStart('2026-10-11', new Date(2026, 9, 12, 9))?.kind === 'week');
ok('the first of the month is a new month', M.freshStart('2026-10-31', new Date(2026, 10, 1, 9))?.kind === 'month');
ok('last active before today ignores today', M.lastActiveBefore(new Map([['2026-10-08', 3], ['2026-10-06', 1], ['2026-10-01', 2]]), NOW) === '2026-10-06');

console.log(fails ? `\n${fails} failed` : '\nall passed');
process.exit(fails ? 1 : 0);
