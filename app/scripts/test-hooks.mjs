/**
 * test-hooks.mjs — memory hooks (hooks.ts): which hook a missed card brings back, that his
 * own version wins and syncs (a clear included), that neighbouring hooks never share a
 * colour, and that every hook shipped can actually come back after some miss.
 *
 * Run: npm test
 */
import { build } from 'esbuild';
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const cache = new URL('../node_modules/.cache/slowpath/', import.meta.url).pathname;
mkdirSync(cache, { recursive: true });
async function load(entry, name) {
  const outfile = join(cache, name);
  await build({ entryPoints: [new URL(entry, import.meta.url).pathname], bundle: true, format: 'esm', platform: 'node', outfile });
  return import(outfile);
}
const H = await load('../src/lib/hooks.ts', 'hooks.mjs');

let fails = 0;
const ok = (label, cond, extra) => {
  if (!cond) { fails++; console.log(`  FAIL  ${label}${extra ? `\n        ${extra}` : ''}`); }
  else console.log(`  PASS  ${label}`);
};

const hook = (id, extra = {}) => ({ id, glyph: '🪝', remember: id, hook: id, ...extra });
const parted = {
  id: 'x-day-01', day: 1, parts: [{ n: 1 }, { n: 2 }],
  quiz: [
    { id: 'q1', part: 1, prompt: 'a', options: [] },
    { id: 'q2', part: 2, tag: 'frames', prompt: 'b', options: [] },
    { id: 'q3', part: 2, prompt: 'c', options: [] },
  ],
  drill: [{ id: 'd1', prompt: 'd', options: [] }],
  hooks: [hook('first', { part: 1 }), hook('named', { part: 2, cards: ['q3'] }), hook('themed', { part: 2, tags: ['frames'] }), hook('drilled', { part: 2, cards: ['d1'] })],
};

// --- which hook comes back -------------------------------------------------------------
ok('a hook that names the card wins', H.hookForCard(parted, { kind: 'quiz', questionId: 'q3' })?.id === 'named');
ok('then a hook on the card\'s theme', H.hookForCard(parted, { kind: 'quiz', questionId: 'q2' })?.id === 'themed');
ok('then the first hook of the card\'s part', H.hookForCard(parted, { kind: 'quiz', questionId: 'q1' })?.id === 'first');
ok('a drill step with no part is found by name', H.hookForCard(parted, { kind: 'drill', questionId: 'd1' })?.id === 'drilled');
{
  const whole = { ...parted, parts: null, hooks: [hook('only', { cards: ['q3'] })] };
  ok('a day read in one go has no part to fall back on', H.hookForCard(whole, { kind: 'quiz', questionId: 'q1' }) === null);
  ok('…but still finds a hook that names the card', H.hookForCard(whole, { kind: 'quiz', questionId: 'q3' })?.id === 'only');
}
ok('a card with no question id gets nothing', H.hookForCard(parted, { kind: 'forge' }) === null);
ok('a day without hooks gets nothing', H.hookForCard({ ...parted, hooks: null }, { kind: 'quiz', questionId: 'q1' }) === null);
ok('a part shows only its own hooks', H.hooksForPart(parted, 2).map((h) => h.id).join() === 'named,themed,drilled');
ok('a day in one go shows them all', H.hooksForPart(parted, null).length === 4);

// --- his own ---------------------------------------------------------------------------
{
  const own = { [H.hookKey('x-day-01', 'first')]: { text: '  my picture ', at: '2026-01-02T00:00:00Z' } };
  ok('his own text is used, trimmed', H.ownText(own, 'x-day-01', 'first') === 'my picture');
  ok('a cleared one counts as none', H.ownText({ [H.hookKey('x-day-01', 'first')]: { text: '', at: 'z' } }, 'x-day-01', 'first') === null);
  const a = { k: { text: 'old', at: '2026-01-01T00:00:00Z' }, only: { text: 'a', at: '2026-01-01T00:00:00Z' } };
  const b = { k: { text: '', at: '2026-01-03T00:00:00Z' }, other: { text: 'b', at: '2026-01-01T00:00:00Z' } };
  const m = H.mergeOwnHooks(a, b);
  ok('the newer write wins, so a clear on one device clears it everywhere', m.k.text === '');
  ok('entries from both sides are kept', m.only.text === 'a' && m.other.text === 'b');
  const m2 = H.mergeOwnHooks(b, a);
  ok('merging is symmetric', Object.keys(m).every((k) => m[k].text === m2[k]?.text) && Object.keys(m).length === Object.keys(m2).length);
  ok('merging nothing is empty', Object.keys(H.mergeOwnHooks(undefined, undefined)).length === 0);
}

// --- read material only, and colour ----------------------------------------------------
ok('a part\'s hook is read once the part is', H.hookRead(parted, { theoryDone: false, parts: { 2: 'x' } }, parted.hooks[1]));
ok('…and not before', !H.hookRead(parted, { theoryDone: false, parts: { 2: 'x' } }, parted.hooks[0]));
ok('a day in one go needs its theory read', H.hookRead({ ...parted, parts: null }, { theoryDone: true }, parted.hooks[0]));
{
  const hues = parted.hooks.map((h) => H.hueOf(parted, h.id));
  ok('neighbouring hooks never share a colour', hues.every((c, i) => i === 0 || c !== hues[i - 1]), hues.join());
}

// --- every shipped hook can come back --------------------------------------------------
{
  const dir = new URL('../public/content/weeks/', import.meta.url).pathname;
  let orphans = [];
  let total = 0;
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    for (const day of JSON.parse(readFileSync(join(dir, f), 'utf8')).days) {
      for (const h of day.hooks ?? []) {
        total++;
        const items = [
          ...(day.quiz ?? []).map((q) => ({ kind: 'quiz', questionId: q.id })),
          ...(day.drill ?? []).map((q) => ({ kind: 'drill', questionId: q.id })),
          ...(day.write?.challenges ?? []).map((c) => ({ kind: 'write', questionId: c.id })),
          ...(day.practice?.write?.challenges ?? []).map((c) => ({ kind: 'write', questionId: c.id })),
          ...(day.practice?.drill ?? []).map((c) => ({ kind: 'drill', questionId: c.id })),
        ];
        if (!items.some((it) => H.hookForCard(day, it)?.id === h.id)) orphans.push(`${day.id}/${h.id}`);
      }
    }
  }
  ok(`every shipped hook (${total}) is what some missed card brings back`, total > 0 && !orphans.length, orphans.join(', '));
}

console.log(fails ? `\nhooks: ${fails} failed` : '\nhooks: all passed');
process.exit(fails ? 1 : 0);
