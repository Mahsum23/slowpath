/**
 * test-parts.mjs — a day read in parts (parts.ts): which part is next, what a day read
 * before parts existed counts as, a part added to a finished day, and that the review deck,
 * the practice bank and the streak all follow the parts rather than the whole day.
 *
 * Run: npm test
 */
import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const cache = new URL('../node_modules/.cache/slowpath/', import.meta.url).pathname;
mkdirSync(cache, { recursive: true });
async function load(entry, name) {
  const outfile = join(cache, name);
  await build({ entryPoints: [new URL(entry, import.meta.url).pathname], bundle: true, format: 'esm', platform: 'node', outfile });
  return import(outfile);
}
const P = await load('../src/lib/parts.ts', 'parts.mjs');
const { cardsFor } = await load('../src/lib/review.ts', 'review-parts.mjs');
const { bankCards, buildRound } = await load('../src/lib/practice.ts', 'practice-parts.mjs');
const { deriveStreak } = await load('../src/lib/streak.ts', 'streak-parts.mjs');
const { mergeProgress } = await load('../src/lib/merge.ts', 'merge-parts.mjs');

let fails = 0;
const ok = (label, cond, extra) => {
  if (!cond) { fails++; console.log(`  FAIL  ${label}${extra ? `\n        ${extra}` : ''}`); }
  else console.log(`  PASS  ${label}`);
};

const q = (id, part) => ({ id, part, prompt: id, options: [{ text: 'a', correct: true, why: '' }, { text: 'b', correct: false, why: '' }] });
const part = (n, added = null, markdown = 'text') => ({ n, title: `P${n}`, markdown, minutes: 4, added });
const order = (a, b, c) => `\`\`\`sql order\n${a}\n${b}\n${c}\n\`\`\``;
const day = {
  id: 'd', day: 4, title: 'D', estMinutes: 25, teaser: null, teachBack: 'why?', status: 'available',
  theoryMarkdown: 'all', drill: null, task: null,
  parts: [part(1, null, order('SELECT 1;', 'SELECT 2;', 'SELECT 3;')), part(2), part(3, '2026-10-12', order('SELECT 4;', 'SELECT 5;', 'SELECT 6;'))],
  quiz: [q('q1', 1), q('q2', 1), q('q3', 2), q('q4', 3)],
  write: { lang: 'sql', setup: 'x', defs: {}, challenges: [{ id: 'w1', part: 1 }, { id: 'w3', part: 3 }, { id: 'wall', part: null }] },
  practice: { write: { lang: 'sql', setup: 'x', defs: {}, challenges: [{ id: 'p1' }, { id: 'p3', part: 3 }] }, drill: [{ id: 'k1', part: 2 }] },
};
const blankQuiz = { answers: {}, correct: {}, completedAt: null, cleanSweep: false };
const prog = (over = {}) => ({
  weekId: 'w', theoryDone: false, quiz: blankQuiz, drill: blankQuiz, task: 'todo', checklist: [],
  notes: '', teachBackDone: false, completedAt: null, ...over,
});

// --- which part is next ---------------------------------------------------------
{
  const fresh = prog();
  ok('a fresh day starts at part 1', P.nextPart(day, fresh)?.n === 1);
  ok('nothing is done on a fresh day', !P.partDone(day, fresh, 1) && !P.allPartsDone(day, fresh));
  const two = prog({ parts: { 1: '2026-10-12T08:00:00Z' } });
  ok('after part 1, part 2 is next', P.nextPart(day, two)?.n === 2);
  const all = prog({ parts: { 1: 'a', 2: 'b', 3: 'c' } });
  ok('all three read: nothing next, theory done', P.nextPart(day, all) === null && P.allPartsDone(day, all));
}

// --- days read before parts existed, and parts added later -------------------------
{
  const legacy = prog({ theoryDone: true, completedAt: '2026-10-01T10:00:00Z' });
  ok('a day read before parts counts its original parts as read', P.partDone(day, legacy, 1) && P.partDone(day, legacy, 2));
  ok('...but not a part added afterwards', !P.partDone(day, legacy, 3));
  ok('...which is what is offered next', P.nextPart(day, legacy)?.n === 3);
  ok('...and the theory is not "all read" until it is', !P.allPartsDone(day, legacy));
  const after = { ...legacy, parts: { 3: '2026-10-12T09:00:00Z' } };
  ok('reading the added part finishes it', P.allPartsDone(day, after) && P.nextPart(day, after) === null);
}

// --- what may be asked ------------------------------------------------------------
{
  const one = prog({ parts: { 1: 'a' } });
  ok('an item for a read part is unlocked', P.unlocked(day, one, 1));
  ok('an item for an unread part is not', !P.unlocked(day, one, 2));
  ok('an item for no part needs the whole day', !P.unlocked(day, one, null) && P.unlocked(day, prog({ parts: { 1: 'a', 2: 'b', 3: 'c' } }), null));
  const legacy = prog({ theoryDone: true });
  ok('on a day read before parts, an item for no part stays open', P.unlocked(day, legacy, null));
  ok('...and one for an added part waits for it', !P.unlocked(day, legacy, 3));
  ok("a part's questions are its own", P.partQuestions(day, 1).map((x) => x.id).join() === 'q1,q2');
}

// --- the review deck follows the parts -------------------------------------------
{
  const one = prog({ parts: { 1: 'a' }, quiz: { ...blankQuiz, answers: { q1: 0, q2: 1 }, correct: { q1: true, q2: false } } });
  const ids = cardsFor(day, one, 'sql').map((c) => c.id);
  ok("part 1's write card is in the deck once part 1 is read", ids.includes('write:d:w1'));
  ok("part 3's is not", !ids.includes('write:d:w3'));
  ok('a write card for the whole day waits for every part', !ids.includes('write:d:wall'));
  ok("part 1's answered questions are cards", ids.includes('quiz:d:q1') && ids.includes('quiz:d:q2'));
  ok("part 1's reorder block is a card, part 3's is not", ids.filter((i) => i.startsWith('parsons:')).length === 1);
  const legacy = prog({ theoryDone: true });
  const lids = cardsFor(day, legacy, 'sql').map((c) => c.id);
  ok("an old reader gets the day's cards but not the added part's", lids.includes('write:d:wall') && lids.includes('write:d:w1') && !lids.includes('write:d:w3'));
}

// --- the practice bank follows the parts --------------------------------------------
{
  const legacy = prog({ theoryDone: true });
  const open = bankCards(day, legacy).map((c) => c.questionId).sort().join();
  ok('a bank item for an unread added part is held back', open === 'k1,p1', open);
  ok('without progress the bank is listed whole (for counting)', bankCards(day).length === 3);
  const after = { ...legacy, parts: { 3: 'x' } };
  ok('reading the part opens its items', bankCards(day, after).length === 3);
  const round = buildRound(day, undefined, Math.random, 10, legacy).map((c) => c.questionId);
  ok('a round never deals a held-back item', !round.includes('p3') && round.length === 2, round.join());
}

// --- streak and sync --------------------------------------------------------------
{
  const s = deriveStreak([{ completedAt: null, parts: { 1: '2026-10-10T12:00:00', 2: '2026-10-11T12:00:00' } }]);
  ok('each part read is a day shown up for the streak', s.count === 2 && s.lastActiveDate === '2026-10-11', JSON.stringify(s));
  ok('merging keeps the earlier finish of a part', P.mergeParts({ 1: '2026-10-11' }, { 1: '2026-10-10', 2: '2026-10-12' })[1] === '2026-10-10');
  ok('merging keeps parts only one side has', Object.keys(P.mergeParts({ 3: 'c' }, { 1: 'a' })).sort().join() === '1,3');
  const base = { schemaVersion: 2, xp: 0, badges: {}, streak: { count: 0, longest: 0, lastActiveDate: null, freezes: 0, freezesEarnedAt: 0 }, review: { cards: {} }, settings: {} };
  const m = mergeProgress({ ...base, days: { d: prog({ parts: { 1: 'a' } }) } }, { ...base, days: { d: prog({ parts: { 2: 'b' } }) } });
  ok('two devices that each read a part end up with both', Object.keys(m.days.d.parts).sort().join() === '1,2');
}

if (fails) {
  console.log(`\n${fails} failure(s)`);
  process.exit(1);
}
console.log('\nparts: all passed');
