/**
 * test-eggs.mjs — the surprises (eggs.ts): when each one fires, that ordinary work never
 * trips one by accident, that nothing can be found twice, and that the hunt for a beaten
 * misconception behaves.
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
const E = await load('../src/lib/eggs.ts', 'eggs.mjs');

let fails = 0;
const ok = (label, cond, extra) => {
  if (!cond) { fails++; console.log(`  FAIL  ${label}${extra ? `\n        ${extra}` : ''}`); }
  else console.log(`  PASS  ${label}`);
};

// --- the hunt ------------------------------------------------------------------------
{
  let h = {};
  let r = E.stepHunt(h, 't', true);
  ok('a right answer on a theme never missed opens no hunt', !r.slain && !('t' in r.hunts));
  r = E.stepHunt(r.hunts, 't', false);
  ok('a miss opens a hunt', r.hunts.t?.run === 0);
  r = E.stepHunt(r.hunts, 't', true);
  r = E.stepHunt(r.hunts, 't', true);
  ok('two right after a miss is not yet enough', !r.slain && r.hunts.t.run === 2);
  const again = E.stepHunt(r.hunts, 't', false);
  ok('a miss mid-hunt starts the count again', again.hunts.t.run === 0);
  r = E.stepHunt(r.hunts, 't', true);
  ok(`${E.SLAY_AT} right in a row after a miss beats it`, r.slain && !('t' in r.hunts));
}

// --- the bestiary ----------------------------------------------------------------------
{
  ok('a NULL theme becomes the Hollow King', E.beastFor('d:x', 'aggregates over nothing').title.includes('Hollow King'));
  ok('fan-out becomes the Hydra', E.beastFor('d:y', 'detecting fan-out').title.includes('Hydra'));
  ok('running order is the Alias Phantom, not the Shuffler', E.beastFor('d:r', 'running order').title.includes('Alias Phantom'));
  ok('ties become the Shuffler', E.beastFor('d:z', 'ties and stable order').title.includes('Shuffler'));
  const odd = E.beastFor('d:odd', 'quantum gravity');
  ok('an unknown theme still gets a creature, named after it', odd.title.endsWith('of quantum gravity') && odd.id === 'beast:d:odd', odd.title);
  ok('the same theme always gets the same creature', E.beastFor('d:odd', 'quantum gravity').title === odd.title);
}

// --- the clock and the calendar ----------------------------------------------------------
{
  const at = (y, mo, d, h = 12, mi = 0) => new Date(y, mo - 1, d, h, mi);
  ok('3:14 is π o\'clock', E.clockEgg(at(2026, 5, 5, 3, 14))?.id === 'clock:pi');
  ok('13:37 is leet', E.clockEgg(at(2026, 5, 5, 13, 37))?.id === 'clock:leet');
  ok('an ordinary afternoon is nothing', E.clockEgg(at(2026, 5, 5, 15, 20)) === null);
  ok('half past two at night is the night shift', E.clockEgg(at(2026, 5, 5, 2, 30))?.id === 'clock:night-shift');
  ok('Ada Lovelace Day 2026 is Tuesday 13 October', E.calendarEgg(at(2026, 10, 13))?.id === 'cal:ada:2026');
  ok('…and not the first Tuesday', E.calendarEgg(at(2026, 10, 6)) === null);
  ok('day 256 of 2026 is 13 September', E.calendarEgg(at(2026, 9, 13))?.id === 'cal:256:2026');
  ok('in a leap year day 256 is 12 September', E.calendarEgg(at(2028, 9, 12))?.id === 'cal:256:2028');
  ok('29 October is LO', E.calendarEgg(at(2026, 10, 29))?.id === 'cal:lo:2026');
  ok('Friday 13 November 2026 is Friday the 13th', E.calendarEgg(at(2026, 11, 13))?.id === 'cal:fri13-10:2026');
  ok('a calendar egg comes back next year under a new id', E.calendarEgg(at(2027, 10, 29))?.id === 'cal:lo:2027');
  ok('an ordinary day is nothing', E.calendarEgg(at(2026, 10, 12)) === null);
}

// --- round numbers ---------------------------------------------------------------------
{
  ok('crossing 256 is a milestone', E.milestoneCrossed(255, 256)?.id === 'milestone:256');
  ok('257 is not', E.milestoneCrossed(256, 257) === null);
  ok('100 is not a round number here', E.milestoneCrossed(99, 100) === null);
}

// --- typed into a card ---------------------------------------------------------------------
{
  ok('Bobby Tables', E.answerEgg("SELECT 1; DROP TABLE students;", 'sql')?.id === 'answer:bobby');
  ok('ORDER BY random()', E.answerEgg('SELECT name FROM t ORDER BY random() LIMIT 1', 'sql')?.id === 'answer:random');
  ok('a TODO comment', E.answerEgg('SELECT 1 -- TODO make this fast', 'sql')?.id === 'answer:todo');
  const plain = [
    "SELECT customer, sum(amount) AS total FROM orders WHERE status = 'paid' GROUP BY customer ORDER BY customer",
    'SELECT id FROM posts WHERE (created_at, id) < ($1, $2) ORDER BY created_at DESC, id DESC LIMIT 20',
    "SELECT date_trunc('month', placed)::date AS month, count(*) FROM sales GROUP BY 1 ORDER BY 1",
    'SELECT count(*) FILTER (WHERE status = \'todos\') FROM tasks',
    'SELECT 42 AS n, 7 AS m',
  ];
  ok('ordinary answers never trip one', plain.every((q) => E.answerEgg(q, 'sql') === null), plain.find((q) => E.answerEgg(q, 'sql')));
  ok('a Go answer with goto', E.answerEgg('goto retry', 'go')?.id === 'answer:goto');
  ok('SQL-only eggs stay in SQL', E.answerEgg('x.ORDER BY random()', 'go') === null);
}

// --- said to the mentor ---------------------------------------------------------------------
{
  ok('xyzzy', E.mentorEgg('xyzzy')?.reply.startsWith('Nothing happens.'));
  ok('XYZZY, shouted', E.mentorEgg('  XYZZY! ')?.egg.id === 'mentor:xyzzy');
  ok('sudo make me a sandwich', E.mentorEgg('sudo make me a sandwich')?.reply.startsWith('Okay.'));
  ok('without sudo', E.mentorEgg('Make me a sandwich.')?.reply.startsWith('What? Make it yourself.'));
  ok('rm -rf /', E.mentorEgg('rm -rf /')?.egg.id === 'mentor:rmrf');
  const real = ['What is a NULL-extended row?', 'why is 42 the default?', 'Can you explain ORDER BY ties?', 'ping me when the round ends', 'rm -rf /tmp/build is safe, right?'];
  ok('real questions go to the model', real.every((q) => E.mentorEgg(q) === null), real.find((q) => E.mentorEgg(q)));
}

// --- the Konami code, and knocking ------------------------------------------------------------
{
  let at = 0;
  let done = false;
  for (const k of E.KONAMI) ({ at, done } = E.konamiStep(at, k));
  ok('the whole code completes', done && at === 0);
  at = 0;
  for (const k of ['ArrowUp', 'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA']) ({ at, done } = E.konamiStep(at, k));
  ok('a third ↑ restarts it without losing the attempt', done);
  ({ at, done } = E.konamiStep(5, 'KeyX'));
  ok('a wrong key resets', at === 0 && !done);
  let taps = [];
  let k;
  for (let i = 0; i < 6; i++) ({ taps, done } = E.knock(taps, 1000 + i * 100, 7, 2500));
  ok('six knocks are not seven', !done && taps.length === 6);
  k = E.knock(taps, 1700, 7, 2500);
  ok('the seventh opens it', k.done && k.taps.length === 0);
  taps = [0, 100, 200, 300, 400, 500];
  k = E.knock(taps, 9000, 7, 2500);
  ok('knocks too far apart do not add up', !k.done && k.taps.length === 1);
}

// --- dealing, once -------------------------------------------------------------------------------
{
  const found = {};
  const seen = new Set();
  let e;
  let n = 0;
  while ((e = E.pickFact('sql', found, Math.random))) {
    ok(`fact ${e.id} is new`, !seen.has(e.id));
    seen.add(e.id);
    found[e.id] = true;
    if (++n > 50) break;
  }
  ok('the pool runs dry instead of repeating', E.pickFact('sql', found, Math.random) === null);
  ok('Go facts are not dealt on the SQL track', ![...seen].includes('fact:gopher'));
  const ids = [...E.SOURCES, ...E.RUMOURS, ...Object.values(E.LETTERS), ...Object.values(E.SECRETS)].map((x) => x.id);
  ok('every egg id is unique', new Set(ids).size === ids.length);
  const all = [...E.SOURCES, ...E.RUMOURS, ...Object.values(E.LETTERS), ...Object.values(E.SECRETS)];
  ok('every text has balanced backticks', all.every((x) => (x.title.split('`').length - 1) % 2 === 0 && (x.body.split('`').length - 1) % 2 === 0), all.find((x) => (x.body.split('`').length - 1) % 2)?.id);
}

// --- two devices --------------------------------------------------------------------------------
{
  const a = { found: { x: { at: '2026-10-02', kind: 'fact', glyph: '', title: 'x', body: '' } }, hunts: { t: { run: 1 } }, lastFact: '2026-10-02', lastSource: null };
  const b = { found: { x: { at: '2026-10-01', kind: 'fact', glyph: '', title: 'x', body: '' }, y: { at: '2026-10-03', kind: 'source', glyph: '', title: 'y', body: '' } }, hunts: {}, lastFact: '2026-10-01', lastSource: '2026-10-03' };
  const m = E.mergeEggs(a, b);
  ok('finds from both devices are kept', Object.keys(m.found).sort().join() === 'x,y');
  ok('the earlier find wins', m.found.x.at === '2026-10-01');
  ok('the later "last shown" date wins', m.lastFact === '2026-10-02' && m.lastSource === '2026-10-03');
}

if (fails) {
  console.log(`\n${fails} failure(s)`);
  process.exit(1);
}
console.log('\neggs: all passed');
