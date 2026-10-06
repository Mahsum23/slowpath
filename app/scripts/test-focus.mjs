/**
 * test-focus.mjs — noticing what you keep getting wrong (focus.ts): themes, how a miss
 * heats and cools, which cards a miss pulls in next, and that the deck leans on hot ones.
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
const F = await load('../src/lib/focus.ts', 'focus.mjs');
const R = await load('../src/lib/review.ts', 'review-f.mjs');

let fails = 0;
const ok = (label, cond, extra) => {
  if (!cond) { fails++; console.log(`  FAIL  ${label}${extra ? `\n        ${extra}` : ''}`); }
  else console.log(`  PASS  ${label}`);
};
const seqRng = (...v) => { let i = 0; return () => v[i++ % v.length]; };
const mid = () => 0.5;

const q = (id, tag) => ({ id, tag, prompt: `prompt ${id}`, options: [] });
const w = (id, tag) => ({ id, tag, prompt: `write ${id}` });
const day = {
  id: 'sql-day-02', title: 'An index is a sorted copy',
  quiz: [q('q1', 'partial indexes'), q('q2', null)],
  drill: [q('d1', 'partial indexes'), q('d2', 'sargable filters')],
  write: { lang: 'sql', setup: '', defs: {}, challenges: [w('w1', 'partial indexes')] },
  practice: { write: { lang: 'sql', setup: '', defs: {}, challenges: [w('p1', 'partial indexes'), w('p2', 'partial indexes'), w('p3', 'sargable filters')] }, drill: [q('pd1', 'partial indexes')] },
};
const other = { id: 'sql-day-03', title: 'NULL', quiz: [q('n1', null)], drill: [], write: null, practice: null };
const dayOf = (id) => ({ [day.id]: day, [other.id]: other })[id];
const card = (kind, d, id) => ({ id: `${kind}:${d.id}:${id}`, kind, dayId: d.id, questionId: id });

console.log('— themes —');
ok('an item\'s theme is the author\'s phrase', F.themeLabel(day, card('quiz', day, 'q1')) === 'partial indexes');
ok('an untagged item falls back to its day', F.themeLabel(day, card('quiz', day, 'q2')) === 'An index is a sorted copy');
ok('items in a bank and in the day\'s own files share a theme', F.themeKey(day, card('quiz', day, 'q1')) === F.themeKey(day, card('write', day, 'p1')));
ok('different tags are different themes', F.themeKey(day, card('drill', day, 'd1')) !== F.themeKey(day, card('drill', day, 'd2')));

console.log('\n— a miss heats a theme, and it cools —');
const NOW = new Date('2026-10-06T12:00:00Z');
const missed = (hoursAgo, extra = {}) => ({ interval: 1, ease: 2.1, streak: 0, due: '2026-10-07', seen: 1, lapses: 1, lastAt: new Date(NOW.getTime() - hoursAgo * 3600e3).toISOString(), ...extra });
const right = { interval: 3, ease: 2.3, streak: 2, due: '2026-10-09', seen: 3, lapses: 1, lastAt: NOW.toISOString() };
const deck = [card('quiz', day, 'q1'), card('drill', day, 'd1'), card('drill', day, 'd2'), card('quiz', other, 'n1')];
const st = (cards) => ({ cards, lastAmbush: null });

ok('a fresh miss is a hot theme', F.heatMap(deck, st({ [deck[0].id]: missed(1) }), dayOf, NOW)[0]?.label === 'partial indexes');
ok('answered right since, it is no longer a miss', F.heatMap(deck, st({ [deck[0].id]: right }), dayOf, NOW).length === 0);
ok('a card never answered is not a miss', !F.lastWasMiss({ interval: 0, ease: 2.3, streak: 0, due: '2026-10-06', seen: 0, lapses: 0, lastAt: null }));
const week = F.heatMap(deck, st({ [deck[0].id]: missed(24 * 14) }), dayOf, NOW);
ok('a miss a fortnight old has cooled away', week.length === 0);
const today = F.heatMap(deck, st({ [deck[0].id]: missed(2) }), dayOf, NOW)[0].heat;
const fourDays = F.heatMap(deck, st({ [deck[0].id]: missed(24 * 4 - 1) }), dayOf, NOW)[0].heat;
ok('heat halves in about four days', fourDays > today * 0.45 && fourDays < today * 0.6, `${today} -> ${fourDays}`);
const two = F.heatMap(deck, st({ [deck[0].id]: missed(1), [deck[1].id]: missed(1) }), dayOf, NOW)[0];
ok('two misses in one theme are hotter, and counted', two.misses === 2 && two.heat > 1.8);
const hots = F.heatMap(deck, st({ [deck[0].id]: missed(1), [deck[2].id]: missed(30) }), dayOf, NOW);
ok('the hottest theme comes first', hots[0].label === 'partial indexes');

console.log('\n— the deck leans on hot themes —');
const heats = F.heatMap(deck, st({ [deck[0].id]: missed(1) }), dayOf, NOW);
ok('a card in a hot theme weighs more than one elsewhere', F.weightOf(deck[1], heats, dayOf) > F.weightOf(deck[3], heats, dayOf));
ok('a card in the same day but another theme gets a little warmth', F.weightOf(deck[2], heats, dayOf) > 1 && F.weightOf(deck[2], heats, dayOf) < F.weightOf(deck[1], heats, dayOf));
ok('with nothing hot, every card weighs 1', F.weightOf(deck[0], [], dayOf) === 1);
const picks = { hot: 0, cold: 0 };
const pool = [deck[1], deck[3]];
let seed = 3; const rng = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
for (let i = 0; i < 600; i++) {
  const c = R.pickNext(pool, st({}), '2026-10-06', rng, new Set(), undefined, (x) => F.weightOf(x, heats, dayOf));
  c.dayId === day.id ? picks.hot++ : picks.cold++;
}
ok(`pickNext deals the hot card more often (${picks.hot} vs ${picks.cold})`, picks.hot > picks.cold * 1.8);
ok('without a weight, pickNext is unchanged', R.pickNext(pool, st({}), '2026-10-06', mid, new Set()) !== null);

console.log('\n— what a miss pulls in next —');
const bank = [
  card('quiz', day, 'q1'), card('quiz', day, 'q2'), card('drill', day, 'd1'), card('drill', day, 'd2'),
  card('write', day, 'w1'), card('write', day, 'p1'), card('write', day, 'p2'), card('write', day, 'p3'), card('drill', day, 'pd1'),
  card('quiz', other, 'n1'),
];
const miss = card('quiz', day, 'q1');
const ups = F.pickFollowUps(miss, bank, dayOf, new Set(), 3, mid);
ok('three follow-ups', ups.length === 3);
ok('never the missed card itself', ups.every((u) => u.card.id !== miss.id));
ok('never another day\'s card', ups.every((u) => u.card.dayId === day.id));
ok('they come from the same theme while it lasts', ups.every((u) => u.sameTheme));
ok('and are other kinds of card than the miss, to vary the angle', ups.every((u) => u.card.kind !== 'quiz'));
ok('and not three of one kind', new Set(ups.map((u) => u.card.kind)).size >= 2, ups.map((u) => u.card.kind).join());
const used = new Set(ups.map((u) => u.card.id));
ok('cards already dealt this sitting are not picked again', F.pickFollowUps(miss, bank, dayOf, used, 3, mid).every((u) => !used.has(u.card.id)));
const lone = F.pickFollowUps(card('drill', day, 'd2'), bank, dayOf, new Set(), 3, mid);
ok('a theme with one card falls back to the rest of the day', lone.length === 3 && lone.some((u) => !u.sameTheme));
ok('a day with nothing else yields none', F.pickFollowUps(card('quiz', other, 'n1'), bank, dayOf, new Set(), 3, mid).length === 0);
ok('graded cards are never offered as follow-ups', F.pickFollowUps(miss, [...bank, { id: 'explain:sql-day-02', kind: 'explain', dayId: day.id }, { id: 'forge:sql-day-02', kind: 'forge', dayId: day.id }], dayOf, new Set(), 20, mid).every((u) => ['quiz', 'drill', 'write'].includes(u.card.kind)));

console.log('\n— answering on reflex —');
const long = 'A report should list customers whose paid orders total more than 150. Where does status go, where does the sum go, and what goes wrong if the status condition is left out?';
ok('a long question answered in a second was not read', F.isReflex(1000, long));
ok('...answered in twenty seconds was', !F.isReflex(20000, long));
ok('a short question has a floor, so a quick honest answer is not flagged', !F.isReflex(1500, 'What does count(*) return?'));
ok('reading time scales with the text: the same two seconds is a reflex on a paragraph and not on a phrase', F.isReflex(2000, long) && !F.isReflex(2000, 'one two three four five six'));
ok('wordsIn counts words, not punctuation', F.wordsIn('SELECT a, b FROM t;') === 5);
let sd = 5; const r2 = () => ((sd = (sd * 1664525 + 1013904223) >>> 0) / 2 ** 32);
let always = true;
for (let n = 2; n <= 4; n++) for (let i = 0; i < 200; i++) {
  const p = F.permutation(n, r2);
  if (p.every((v, k) => v === k) || new Set(p).size !== n) always = false;
}
ok('an option order is a real permutation and never the authored one', always);
ok('a stuck rng still gives a different order', F.permutation(4, () => 0).some((v, k) => v !== k));
ok('one option has only one order', F.permutation(1).length === 1);
const slots = new Set();
for (let i = 0; i < 300; i++) slots.add(F.permutation(4, r2).indexOf(0));
ok('the first authored option lands in every slot over time', slots.size === 4);

const qd = { id: 'd', quiz: [{ id: 'q1', prompt: 'Which is right?', options: [{ text: 'A', correct: true, why: 'because' }, { text: 'B', correct: false, why: 'no' }] }], drill: [], write: { challenges: [{ id: 'w1', prompt: 'Write it', solution: 'SELECT 1;' }] } };
ok('a card brief carries the key, so a model can write a different question', /\[correct\] A — because/.test(F.cardBrief(qd, { kind: 'quiz', questionId: 'q1' })) && /\[wrong\] B/.test(F.cardBrief(qd, { kind: 'quiz', questionId: 'q1' })));
ok('...and for a write card the reference answer', /SELECT 1;/.test(F.cardBrief(qd, { kind: 'write', questionId: 'w1' })));
ok('...and nothing for a card it cannot describe', F.cardBrief(qd, { kind: 'explain' }) === '');

console.log('\n— the schedule hears about reflex —');
const fresh = R.newCard(new Date('2026-10-06T10:00:00Z'));
const t = new Date('2026-10-06T10:00:00Z');
const g1 = R.grade(fresh, 'good', t, mid, { reflex: true });
ok('one reflex answer counts one', g1.reflex === 1 && !R.isWorn(g1));
const g2 = R.grade(g1, 'good', t, mid, { reflex: true });
ok('two in a row wear the card out', g2.reflex === 2 && R.isWorn(g2));
ok('a slow right answer clears it', R.grade(g2, 'good', t, mid, { reflex: false }).reflex === 0);
ok('a miss clears it', R.grade(g2, 'again', t, mid).reflex === 0);
ok('an early (practice) reflex still counts, though it leaves the interval alone', R.grade(g1, 'good', t, mid, { early: true, reflex: true }).reflex === 2);
ok('cards from before this existed are not worn', !R.isWorn({ ...fresh, reflex: undefined }) && !R.isWorn(undefined));

console.log(fails ? `\n${fails} failed` : '\nall passed');
process.exit(fails ? 1 : 0);
