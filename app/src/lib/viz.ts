/**
 * Visuals in lessons: step-through diagrams written as data inside the lesson file.
 *
 * A lesson marks one with a fence, ```` ```viz tables ```` (or `slices`, `seq`), holding YAML.
 * The content build turns the YAML into JSON and validates it (build-content.mjs), so the app
 * only ever parses JSON; `Markdown.svelte` splits a lesson around these fences and mounts
 * `Viz.svelte` in their place.
 *
 * What they are for, and what they are not: pictures next to words help people learn
 * (Mayer's multimedia principle), but only pictures that show the idea; decorative ones do
 * not (Sung & Mayer 2012), and a complex animation lands better cut into steps the learner
 * advances (the segmenting principle). So every visual here is a mechanism shown one step at
 * a time, on the lesson's own data, advanced by the reader: rows leaving at WHERE, a ghost
 * row a LEFT JOIN invents, a slice's capacity reaching past its length. Never decoration.
 *
 * Pure: no DOM. Tested in scripts/test-viz.mjs.
 */

/** What a row is doing in this step. */
export const ROW_MARKS = ['in', 'out', 'new', 'hit', 'ghost', 'dead', 'win'] as const;
export type RowMark = (typeof ROW_MARKS)[number];

export interface VizTable {
  name: string;
  cols: string[];
  /** Cells; `null` is drawn as NULL. */
  rows: (string | number | boolean | null)[][];
  /** Per row, parallel to `rows`; missing or null means an ordinary row. */
  marks?: (RowMark | null)[];
  /** Column indexes to highlight in this step. */
  hl?: number[];
}

export interface TablesStep {
  say: string;
  code?: string;
  tables: VizTable[];
}

export interface SliceArray {
  name: string;
  cells: (string | number)[];
  /** Cell indexes that just changed. */
  hl?: number[];
}

export interface SliceView {
  name: string;
  /** Index into the step's `arrays`. */
  array: number;
  from: number;
  len: number;
  cap: number;
}

export interface SlicesStep {
  say: string;
  code?: string;
  arrays: SliceArray[];
  slices: SliceView[];
}

export interface SeqStep {
  say: string;
  /** A message sent in this step, drawn as an arrow between lanes. */
  msg?: { from: number; to: number; text: string };
  /** What a lane holds after this step (a queue, a state), by lane index. */
  notes?: Record<string, string>;
}

export type Viz =
  | { kind: 'tables'; title?: string; steps: TablesStep[] }
  | { kind: 'slices'; title?: string; steps: SlicesStep[] }
  | { kind: 'seq'; title?: string; lanes: string[]; steps: SeqStep[] };

export const VIZ_KINDS = ['tables', 'slices', 'seq'] as const;

export type Segment = { kind: 'md'; text: string } | { kind: 'viz'; viz: Viz } | { kind: 'bad'; text: string };

const FENCE = /^```viz[ \t]+(\w+)[^\n]*\n([\s\S]*?)^```[ \t]*$/gm;

/**
 * A lesson split around its visuals. A fence the build already turned into JSON becomes a
 * `viz` segment; anything else that claims to be one (bad JSON, an unknown kind) comes back
 * as `bad` and is shown as plain code, so a broken visual never takes the text with it.
 */
export function splitViz(md: string): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  for (const m of md.matchAll(FENCE)) {
    if (m.index! > last) out.push({ kind: 'md', text: md.slice(last, m.index) });
    last = m.index! + m[0].length;
    try {
      const body = JSON.parse(m[2]);
      const viz = { ...body, kind: m[1] } as Viz;
      if (vizProblems(viz).length) throw new Error('invalid');
      out.push({ kind: 'viz', viz });
    } catch {
      out.push({ kind: 'bad', text: m[0] });
    }
  }
  if (last < md.length) out.push({ kind: 'md', text: md.slice(last) });
  return out.filter((s) => s.kind !== 'md' || s.text.trim());
}

const isInt = (n: unknown): n is number => Number.isInteger(n);

/** Everything wrong with a visual, as sentences; empty when it can be drawn. */
export function vizProblems(v: Viz): string[] {
  const p: string[] = [];
  if (!(VIZ_KINDS as readonly string[]).includes(v.kind)) return [`unknown kind "${v.kind}"`];
  if (!Array.isArray(v.steps) || !v.steps.length) return ['no steps'];
  v.steps.forEach((s, i) => {
    const at = `step ${i + 1}`;
    if (!s || typeof s.say !== 'string' || !s.say.trim()) p.push(`${at}: needs "say"`);
    if (v.kind === 'tables') {
      const t = s as TablesStep;
      if (!Array.isArray(t.tables) || !t.tables.length) p.push(`${at}: needs "tables"`);
      for (const tb of t.tables ?? []) {
        if (!Array.isArray(tb.cols) || !Array.isArray(tb.rows)) { p.push(`${at}: table ${tb.name} needs cols and rows`); continue; }
        tb.rows.forEach((r, j) => {
          if (!Array.isArray(r) || r.length !== tb.cols.length) p.push(`${at}: ${tb.name} row ${j + 1} has ${Array.isArray(r) ? r.length : 0} cells for ${tb.cols.length} columns`);
        });
        if (tb.marks && tb.marks.length > tb.rows.length) p.push(`${at}: ${tb.name} has more marks than rows`);
        for (const m of tb.marks ?? []) if (m != null && !(ROW_MARKS as readonly string[]).includes(m)) p.push(`${at}: unknown mark "${m}"`);
        for (const c of tb.hl ?? []) if (!isInt(c) || c < 0 || c >= tb.cols.length) p.push(`${at}: ${tb.name} highlights column ${c}, which does not exist`);
      }
    } else if (v.kind === 'slices') {
      const t = s as SlicesStep;
      if (!Array.isArray(t.arrays) || !Array.isArray(t.slices)) { p.push(`${at}: needs "arrays" and "slices"`); return; }
      for (const sl of t.slices) {
        const arr = t.arrays[sl.array];
        if (!arr) { p.push(`${at}: slice ${sl.name} points at array ${sl.array}, which does not exist`); continue; }
        if (![sl.from, sl.len, sl.cap].every((n) => isInt(n) && n >= 0)) p.push(`${at}: slice ${sl.name} needs whole numbers`);
        else if (sl.len > sl.cap) p.push(`${at}: slice ${sl.name} has len ${sl.len} over cap ${sl.cap}`);
        else if (sl.from + sl.cap > arr.cells.length) p.push(`${at}: slice ${sl.name} reaches past the end of ${arr.name}`);
      }
    } else if (v.kind === 'seq') {
      const t = s as SeqStep;
      const n = Array.isArray(v.lanes) ? v.lanes.length : 0;
      if (n < 2) { p.push('a sequence needs two or more lanes'); return; }
      if (t.msg && (![t.msg.from, t.msg.to].every((x) => isInt(x) && x >= 0 && x < n) || t.msg.from === t.msg.to)) p.push(`${at}: the message goes between lanes that do not exist`);
      for (const k of Object.keys(t.notes ?? {})) if (!(Number(k) >= 0 && Number(k) < n)) p.push(`${at}: a note on lane ${k}, which does not exist`);
    }
  });
  return p;
}

/** How a cell is written: NULL spelled out, booleans as psql prints them. */
export function cellText(v: string | number | boolean | null): string {
  if (v === null) return 'NULL';
  if (typeof v === 'boolean') return v ? 't' : 'f';
  return String(v);
}

/**
 * A row's identity across steps, so a row that survives a step stays the same element and
 * moves rather than being redrawn: its table and its cells, plus how many identical rows came
 * before it (fan-out makes exact duplicates on purpose).
 */
export function rowKeys(table: string, rows: VizTable['rows']): string[] {
  const seen = new Map<string, number>();
  return rows.map((r) => {
    const base = `${table}|${JSON.stringify(r)}`;
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return `${base}#${n}`;
  });
}

/**
 * A lesson with each visual replaced by what it says in words: its title and step captions.
 * For the mentor, which is told what the reader saw and has no use for the data behind it.
 */
export function vizAsText(md: string): string {
  return splitViz(md)
    .map((s) => {
      if (s.kind !== 'viz') return s.text;
      const steps = s.viz.steps.map((st, i) => `${i + 1}. ${st.say}`).join('\n');
      return `\n[Step-through diagram${s.viz.title ? `: ${s.viz.title}` : ''}]\n${steps}\n`;
    })
    .join('');
}
