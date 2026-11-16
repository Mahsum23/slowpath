/**
 * test-viz.mjs — lesson visuals (viz.ts): splitting a lesson around its ```viz fences, the
 * checks that stop a broken visual from shipping, row identity across steps, and that every
 * visual in the built content splits out and draws.
 *
 * Run: npm test
 */
import { build } from 'esbuild';
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const cache = new URL('../node_modules/.cache/slowpath/', import.meta.url).pathname;
mkdirSync(cache, { recursive: true });
const outfile = join(cache, 'viz.mjs');
await build({ entryPoints: [new URL('../src/lib/viz.ts', import.meta.url).pathname], bundle: true, format: 'esm', platform: 'node', outfile });
const V = await import(outfile);

let fails = 0;
const ok = (label, cond, extra) => {
  if (!cond) { fails++; console.log(`  FAIL  ${label}${extra ? `\n        ${extra}` : ''}`); }
  else console.log(`  PASS  ${label}`);
};

const tables = { steps: [{ say: 'x', tables: [{ name: 't', cols: ['a', 'b'], rows: [[1, null]] }] }] };
const fence = (kind, body) => '```viz ' + kind + '\n' + JSON.stringify(body) + '\n```';

// --- splitting ---------------------------------------------------------------------
{
  const s = V.splitViz(`Before.\n\n${fence('tables', tables)}\n\nAfter.`);
  ok('text, visual, text', s.map((x) => x.kind).join() === 'md,viz,md');
  ok('the visual keeps its kind', s[1].viz.kind === 'tables');
  ok('a lesson with no visual is one piece', V.splitViz('Just text.').length === 1);
  ok('bad JSON is shown as code, never dropped', V.splitViz('```viz tables\n{nope\n```')[0].kind === 'bad');
  ok('an unknown kind is shown as code', V.splitViz(fence('pie', tables))[0].kind === 'bad');
  ok('other fences are left alone', V.splitViz('```sql\nSELECT 1;\n```').map((x) => x.kind).join() === 'md');
}

// --- what fails a visual -------------------------------------------------------------
{
  const p = (v) => V.vizProblems(v);
  ok('a good table passes', p({ kind: 'tables', ...tables }).length === 0);
  ok('a row with the wrong number of cells fails', p({ kind: 'tables', steps: [{ say: 'x', tables: [{ name: 't', cols: ['a', 'b'], rows: [[1]] }] }] }).length === 1);
  ok('an unknown mark fails', p({ kind: 'tables', steps: [{ say: 'x', tables: [{ name: 't', cols: ['a'], rows: [[1]], marks: ['sparkly'] }] }] }).length === 1);
  ok('a step without words fails', p({ kind: 'tables', steps: [{ tables: tables.steps[0].tables }] }).length === 1);
  ok('a slice longer than its capacity fails', p({ kind: 'slices', steps: [{ say: 'x', arrays: [{ name: 'a', cells: [1, 2] }], slices: [{ name: 's', array: 0, from: 0, len: 2, cap: 1 }] }] }).length === 1);
  ok('a slice reaching past its array fails', p({ kind: 'slices', steps: [{ say: 'x', arrays: [{ name: 'a', cells: [1, 2] }], slices: [{ name: 's', array: 0, from: 1, len: 1, cap: 2 }] }] }).length === 1);
  ok('a message to a lane that does not exist fails', p({ kind: 'seq', lanes: ['a', 'b'], steps: [{ say: 'x', msg: { from: 0, to: 2, text: 'SYN' } }] }).length === 1);
  ok('no steps fails', p({ kind: 'tables', steps: [] }).length === 1);
}

// --- rows keep their identity across steps -----------------------------------------
{
  const k = V.rowKeys('t', [[1, 'a'], [1, 'a'], [2, 'b']]);
  ok('identical rows (fan-out) still get distinct keys', new Set(k).size === 3);
  ok('the same row keeps its key in the next step', V.rowKeys('t', [[0, 'z'], [1, 'a']])[1] === k[0]);
  ok('NULL is spelled out, booleans as psql prints them', V.cellText(null) === 'NULL' && V.cellText(true) === 't' && V.cellText(false) === 'f');
}

// --- the mentor reads the words, not the data --------------------------------------
{
  const t = V.vizAsText(`Intro.\n\n${fence('tables', { title: 'Pipeline', steps: [{ say: 'WHERE drops a row', tables: tables.steps[0].tables }] })}\n\nOutro.`);
  ok('a visual becomes its title and captions', t.includes('Pipeline') && t.includes('1. WHERE drops a row'));
  ok('…and none of its data', !t.includes('"cols"') && t.includes('Intro.') && t.includes('Outro.'));
}

// --- every shipped visual draws ----------------------------------------------------
{
  const dir = new URL('../public/content/weeks/', import.meta.url).pathname;
  let n = 0;
  const bad = [];
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    for (const day of JSON.parse(readFileSync(join(dir, f), 'utf8')).days) {
      for (const md of [...(day.parts ?? []).map((p) => p.markdown), ...(day.parts ? [] : [day.theoryMarkdown ?? ''])]) {
        for (const s of V.splitViz(md)) {
          if (s.kind === 'viz') n++;
          if (s.kind === 'bad') bad.push(day.id);
        }
      }
    }
  }
  ok(`every shipped visual (${n}) splits out and is valid`, n > 0 && !bad.length, bad.join(', '));
}

// --- every page has one --------------------------------------------------------------
// A day is read part by part, so a visual somewhere in the day does not reach the reader
// of the part without one. Each part (or a day read in one go) carries its own.
{
  const dir = new URL('../public/content/weeks/', import.meta.url).pathname;
  const bare = [];
  let pages = 0;
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    for (const day of JSON.parse(readFileSync(join(dir, f), 'utf8')).days) {
      if (day.status !== 'available') continue;
      const texts = day.parts?.length ? day.parts.map((p) => [`${day.id} part ${p.n}`, p.markdown]) : [[day.id, day.theoryMarkdown ?? '']];
      for (const [where, md] of texts) {
        pages++;
        if (!V.splitViz(md).some((s) => s.kind === 'viz')) bare.push(where);
      }
    }
  }
  ok(`every page (${pages}) has at least one visual`, pages > 0 && !bare.length, bare.join(', '));
}

console.log(fails ? `\nviz: ${fails} failed` : '\nviz: all passed');
process.exit(fails ? 1 : 0);
