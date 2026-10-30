#!/usr/bin/env node
/**
 * build-content.mjs — compiles the repo's lessons into the app's content JSON.
 *
 * Source of truth is the repo, always:
 *   milestones/tracks.yaml                      each track's title, intro and plan
 *   milestones/<m>/lessons/topic.yaml           a topic's roster (titles, teasers, order)
 *   milestones/<m>/lessons/day-NN-<slug>.md     theory + task, greppable, no answers
 *   milestones/<m>/lessons/day-NN-<slug>.quiz.yaml   the answer key, kept out of the .md
 *
 * Output (build artifacts — never hand-edit):
 *   app/public/content/curriculum.json
 *   app/public/content/weeks/track-<t>.json     one path per track, every topic in order
 *
 * A track is one continuous path of days. Topics are how the source is organised and
 * show up only as dividers on it. The output keeps the shape the app has always read
 * (`weeks`, one object per entry) so an installed copy that has not updated yet still
 * understands it — it simply sees one long "week" per track.
 *
 * Run: npm run content
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

const SCHEMA_VERSION = 1;

const here = dirname(fileURLToPath(import.meta.url));
const appDir = resolve(here, '..');
const repoRoot = resolve(appDir, '..');
const milestonesDir = join(repoRoot, 'milestones');
const outDir = join(appDir, 'public', 'content');

const warnings = [];
const warn = (msg) => warnings.push(msg);
/** A mistake that would corrupt progress or cards: stop the build. */
const fail = (msg) => {
  console.error(`\n  ✗ ${msg}\n`);
  process.exit(1);
};

/** Split a markdown doc into its top-level `## ` sections, keyed by lowercased title. */
function splitSections(md) {
  const sections = {};
  const lines = md.split('\n');
  let current = null;
  let buf = [];
  const flush = () => {
    if (current) sections[current] = buf.join('\n').trim();
  };
  for (const line of lines) {
    const m = /^##\s+(.+?)\s*$/.exec(line);
    if (m) {
      flush();
      current = m[1].toLowerCase();
      buf = [];
    } else if (current) {
      buf.push(line);
    }
  }
  flush();
  return sections;
}

/**
 * Pull the structured bits out of a `## Task` section, leaving prose behind.
 * Conventions (see day-01 for the canonical shape):
 *   - File: `path`            → task.files[]
 *   - Compile: `command`      → task.compile   (or "Run:", same field)
 *   ### Checklist            → task.checklist[] from its `- [ ]` items
 */
function parseTask(taskMd) {
  if (!taskMd) return null;

  const files = [];
  let compile = null;
  const checklist = [];

  // The checklist subsection is consumed whole, not left in the prose.
  const checklistSplit = taskMd.split(/^###\s+Checklist\s*$/m);
  const body = checklistSplit[0];
  if (checklistSplit[1]) {
    // An item can run over several lines (an indented continuation is the same sentence).
    // Reading one line per item cut "…off the same index, and you can say what the
    // difference was" down to "…off the same" — and now that a reviewer grades against
    // these, half a requirement would be graded as if it were the whole of it.
    let open = false;
    for (const line of checklistSplit[1].split('\n')) {
      const m = /^\s*-\s*\[[ xX]\]\s+(.*\S)\s*$/.exec(line);
      if (m) {
        checklist.push(m[1]);
        open = true;
      } else if (open && /^\s+\S/.test(line)) {
        checklist[checklist.length - 1] += ` ${line.trim()}`;
      } else {
        open = false;
      }
    }
  }

  const proseLines = [];
  for (const line of body.split('\n')) {
    const file = /^\s*-\s*(?:📄\s*)?File:\s*`([^`]+)`/i.exec(line);
    if (file) {
      files.push(file[1]);
      continue;
    }
    // "Run:" is the same field under a name that isn't a lie on a track with no
    // compiler in it.
    const cc = /^\s*-\s*(?:Compile|Run):\s*`([^`]+)`/i.exec(line);
    if (cc) {
      compile = cc[1];
      continue;
    }
    proseLines.push(line);
  }

  return {
    markdown: proseLines.join('\n').replace(/\n{3,}/g, '\n\n').trim(),
    files,
    compile,
    checklist,
  };
}

/** How many numbered questions the human-facing `## Quiz` section advertises. */
/**
 * Parsons markers, checked at build time rather than discovered on a phone.
 *
 * ```` ```cpp order ```` opts a block into the review deck as a reorder card. Two ways
 * that goes wrong, and neither shows up until the card is dealt weeks later:
 *
 *  - a marked block the app will silently drop (wrong size, or a repeated line, which
 *    would mean more than one correct order) — the author thinks there is a card and
 *    there is not;
 *  - a marked block containing a line that is only a comment, which is never a step in
 *    a sequence and produces exactly the nonsense this check was written after.
 */
function checkOrderMarkers(dayId, mdName, theory, warn) {
  if (!theory) return;
  const lines = theory.split('\n');
  let open = null;
  for (const line of lines) {
    const fence = /^[ \t]*```(.*)$/.exec(line);
    if (fence) {
      if (open) {
        const body = open.lines.filter((l) => l.trim());
        if (open.marked) {
          const first = body[0]?.slice(0, 46) ?? '(empty)';
          if (body.length < 3 || body.length > 12) {
            warn(`${dayId}: ${mdName} marks a ${body.length}-line block "order" — only 3–12 become cards ("${first}")`);
          } else if (new Set(body).size !== body.length) {
            warn(`${dayId}: ${mdName} marks a block with a repeated line "order" — it will be dropped ("${first}")`);
          }
          const comment = body.find((l) => /^\s*(\/\/|--|#)/.test(l));
          if (comment) {
            warn(`${dayId}: ${mdName} marks a block whose line "${comment.trim().slice(0, 40)}" is only a comment — not a step`);
          }
        }
        open = null;
      } else {
        const info = fence[1].trim().toLowerCase().split(/\s+/);
        open = { marked: info.slice(1).includes('order'), lines: [] };
      }
      continue;
    }
    if (open) open.lines.push(line);
  }
}

function countMdQuizQuestions(quizMd) {
  if (!quizMd) return 0;
  return (quizMd.match(/^\s*\d+\.\s+/gm) ?? []).length;
}

/**
 * Deterministic option shuffle.
 *
 * Authoring a quiz, you write the right answer first — it's the one you're sure of,
 * the distractors come after. Do that four days running and the learner has stopped
 * reading the options and started pattern-matching on position, which measures
 * nothing. So the source order is treated as arbitrary and the build lays the options
 * out itself.
 *
 * Seeded rather than random, deliberately: the same lesson must shuffle the same way
 * on every machine and every rebuild, because the app records answers by position and
 * `contentHash` would otherwise churn on every `npm run content`.
 *
 * FNV-1a over the seed string, then xorshift32 — small, no dependency, and stable
 * across Node versions in a way Math.random() explicitly is not.
 */
function rng(seed) {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  let s = h >>> 0 || 0x9e3779b9;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 0x1_0000_0000;
  };
}

function shuffle(items, seed) {
  const next = rng(seed);
  const a = [...items];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Shuffle every question in a day, then check the day as a whole: a seed that happens
 * to put all five answers in slot C is just as much of a tell as authoring order was.
 * Re-salt until the positions differ; bounded, and the identity fallback is only
 * reachable for a single-question day.
 */
function placeOptions(questions, dayId) {
  for (let salt = 0; salt < 32; salt += 1) {
    const out = questions.map((q) => ({
      ...q,
      options: shuffle(q.options, `${dayId}:${q.id}:${salt}`),
    }));
    const slots = out.map((q) => q.options.findIndex((o) => o.correct));
    if (out.length < 2 || new Set(slots).size > 1) return out;
  }
  return questions;
}

/**
 * A card's theme: a short human phrase ("partial indexes") naming the one idea it tests,
 * finer than the day. When a card is missed, the deck follows up with others that share
 * its theme, and shows the phrase as "Focus: …" — so write it as a reader would say it.
 */
function tagOf(raw) {
  const t = raw === undefined || raw === null ? '' : String(raw).trim();
  return t || null;
}

/** `part: N` on a question, card or bank item: it needs part N of its day read first. */
function partOf(raw) {
  const n = Number(raw);
  return raw === undefined || raw === null || !Number.isInteger(n) || n < 1 ? null : n;
}

/**
 * A day read in sittings. Its `.md` has `## Part N: Title` sections in place of one
 * `## Theory`; each may end with a `### Check yourself` list (question text only, as
 * `## Quiz` is), and the questions themselves carry `part: N` in the .quiz.yaml.
 *
 * `added` (from topic.yaml) marks parts written after the day was published, so that
 * someone who had already read it is offered the new part rather than credited with it.
 */
function parseParts(md, dayId, mdName, added) {
  const parts = [];
  let cur = null;
  let fence = false;
  for (const line of md.split('\n')) {
    if (/^[ \t]*```/.test(line)) fence = !fence;
    const h2 = !fence && /^##\s+(.+?)\s*$/.exec(line);
    if (h2) {
      if (cur) parts.push(cur);
      const m = /^Part\s+(\d+)\s*[:.—-]\s*(.+)$/i.exec(h2[1]);
      cur = m ? { n: Number(m[1]), title: m[2].trim(), lines: [] } : null;
      continue;
    }
    if (cur) cur.lines.push(line);
  }
  if (cur) parts.push(cur);
  parts.forEach((p, i) => {
    if (p.n !== i + 1) fail(`${dayId}: ${mdName} has "Part ${p.n}" where Part ${i + 1} was expected — parts are numbered 1, 2, 3 … in order`);
  });
  for (const k of Object.keys(added ?? {})) {
    if (!parts.some((p) => p.n === Number(k))) warn(`${dayId}: topic.yaml marks part ${k} as added, but ${mdName} has no such part`);
  }
  return parts.map((p) => {
    // The questions are the quiz file's; the list in the .md is for a reader of the file.
    const text = p.lines.join('\n');
    const check = /\n###\s+Check yourself\s*\n([\s\S]*)$/i.exec(text);
    const body = (check ? text.slice(0, check.index) : text).trim();
    // Prose at about 150 words a minute (technical reading, with a terminal open); code and
    // output at a third of that rate per word, since it is read slowly or typed.
    const code = (body.match(/```[\s\S]*?```/g) ?? []).join(' ').split(/\s+/).length;
    const words = body.replace(/```[\s\S]*?```/g, ' ').split(/\s+/).length + code / 3;
    const at = added?.[p.n] ?? added?.[String(p.n)];
    return {
      n: p.n,
      title: p.title,
      markdown: body,
      minutes: Math.max(3, Math.round(words / 150)),
      added: at ? String(at instanceof Date ? at.toISOString().slice(0, 10) : at) : null,
      listed: countMdQuizQuestions(check?.[1]),
    };
  });
}

function loadQuiz(path, dayId) {
  if (!existsSync(path)) return null;
  const doc = parseYaml(readFileSync(path, 'utf8'));
  const questions = doc?.questions ?? [];
  if (!Array.isArray(questions) || questions.length === 0) {
    warn(`${dayId}: ${path} has no questions`);
    return null;
  }
  const parsed = questions.map((q, qi) => {
    const options = q.options ?? [];
    const correctCount = options.filter((o) => o.correct).length;
    if (correctCount !== 1) {
      warn(`${dayId} q${qi + 1}: expected exactly 1 correct option, found ${correctCount}`);
    }
    if (options.length < 2 || options.length > 4) {
      warn(`${dayId} q${qi + 1}: ${options.length} options — the app is designed for 2–4`);
    }
    for (const o of options) {
      if (!o.why?.trim()) warn(`${dayId} q${qi + 1}: option "${o.text}" has no "why"`);
    }
    return {
      id: q.id ?? `q${qi + 1}`,
      tag: tagOf(q.tag),
      part: partOf(q.part),
      prompt: String(q.prompt ?? '').trim(),
      options: options.map((o) => ({
        text: String(o.text ?? '').trim(),
        correct: Boolean(o.correct),
        why: String(o.why ?? '').trim(),
      })),
    };
  });

  return placeOptions(parsed, dayId);
}

/**
 * The drill: the half of a day's work that needs no machine.
 *
 * Same file convention and same answer-key shape as the quiz, on purpose — a drill is
 * answered the same way, so it shares the authoring rules, the shuffling and the
 * renderer. What it adds is `code`: a listing you reason about rather than a fact you
 * recall. The `.md` carries only the question text, exactly as the quiz does, because
 * that is the file open while the lesson is being done.
 */
const DRILL_KINDS = new Set(['predict', 'find', 'choose']);

function loadDrill(path, dayId) {
  if (!existsSync(path)) return null;
  const doc = parseYaml(readFileSync(path, 'utf8'));
  return parseDrill(doc?.steps ?? [], path, dayId, { max: 4, salt: 'drill' });
}

function parseDrill(steps, path, dayId, { max, salt }) {
  if (!Array.isArray(steps) || steps.length === 0) {
    warn(`${dayId}: ${path} has no steps`);
    return null;
  }
  if (steps.length > max) {
    warn(`${dayId}: ${steps.length} drill steps — this is the short half of the day, keep it to 2–4`);
  }
  const parsed = steps.map((q, qi) => {
    const options = q.options ?? [];
    const correctCount = options.filter((o) => o.correct).length;
    if (correctCount !== 1) {
      warn(`${dayId} drill ${qi + 1}: expected exactly 1 correct option, found ${correctCount}`);
    }
    if (options.length < 2 || options.length > 4) {
      warn(`${dayId} drill ${qi + 1}: ${options.length} options — the app is designed for 2–4`);
    }
    for (const o of options) {
      if (!o.why?.trim()) warn(`${dayId} drill ${qi + 1}: option "${o.text}" has no "why"`);
    }
    // A question whose code comment already states the answer measures reading, not thinking:
    // "-- 12 orders, from 4 customers, in 3 statuses" above a query whose answer is 12, 4, 3.
    // Show the data (a VALUES list) and let the reader work out what it produces.
    {
      const comments = String(q.code ?? '').split('\n').map((l) => /(?:--|\/\/)(.*)$/.exec(l)?.[1] ?? '').join(' ');
      const right = options.find((o) => o.correct);
      const nums = new Set(String(right?.text ?? '').replace(/`/g, '').match(/\d+/g) ?? []);
      if (nums.size >= 2 && [...nums].every((n) => new RegExp(`\\b${n}\\b`).test(comments))) {
        warn(`${dayId} drill ${q.id ?? qi + 1}: a comment in the code already states the answer (${[...nums].join(', ')}) — show the data instead of describing the result`);
      }
    }
    if (q.kind && !DRILL_KINDS.has(q.kind)) {
      warn(`${dayId} drill ${qi + 1}: unknown kind "${q.kind}" — expected ${[...DRILL_KINDS].join(', ')}`);
    }
    return {
      id: q.id ?? `d${qi + 1}`,
      tag: tagOf(q.tag),
      part: partOf(q.part),
      kind: DRILL_KINDS.has(q.kind) ? q.kind : 'choose',
      code: q.code ? String(q.code).replace(/\n+$/, '') : null,
      prompt: String(q.prompt ?? '').trim(),
      options: options.map((o) => ({
        text: String(o.text ?? '').trim(),
        correct: Boolean(o.correct),
        why: String(o.why ?? '').trim(),
      })),
    };
  });

  // Shuffled by the same deterministic placement the quiz uses, so the correct answer
  // does not sit in the same slot every day and teach position instead of content.
  return placeOptions(parsed, `${dayId}-${salt}`);
}

/**
 * `day-NN-<slug>.write.yaml`: queries to write from memory in the review deck.
 *
 *   setup:       SQL that creates and fills the tables (run fresh for every attempt)
 *   challenges:  id, prompt, solution, and optionally hint, ordered, verify
 *
 * There is no expected output in the file on purpose. The deck runs `solution` and shows
 * what it returns, so the target can never disagree with the reference, and the answer a
 * learner writes is judged by running it and comparing rows (writecheck.ts) — a different
 * but correct query passes. `tools/check-write-cards.py` runs every solution on a real
 * PostgreSQL before it ships, the same way check-sql-lesson.py does for lessons.
 */
/** What a card file holds that only the authoring-time checker reads; never shipped. */
const AUTHORING_ONLY = ['harness', 'expect', 'good', 'bad'];

function loadWrite(path, dayId) {
  if (!existsSync(path)) return null;
  return parseWrite(parseYaml(readFileSync(path, 'utf8')), path, dayId);
}

function parseWrite(doc, path, dayId) {
  const lang = String(doc?.lang ?? 'sql');
  if (!['sql', 'go', 'cpp'].includes(lang)) warn(`${dayId}: ${path} has lang "${lang}" — expected sql, go or cpp`);
  const shape = lang !== 'sql';
  const setup = String(doc?.setup ?? '').trim();
  const list = doc?.challenges ?? [];
  if (!shape && !setup) warn(`${dayId}: ${path} has no setup — the tables have to come from somewhere`);
  if (!Array.isArray(list) || list.length === 0) {
    warn(`${dayId}: ${path} has no challenges`);
    return null;
  }
  const defs = Object.fromEntries(Object.entries(doc?.defs ?? {}).map(([k, v]) => [k, String(v).trim()]));
  const seen = new Set();
  const challenges = list.map((c, i) => {
    const id = String(c.id ?? `w${i + 1}`);
    if (seen.has(id)) warn(`${dayId} write ${id}: duplicate id — card ids are built from it`);
    seen.add(id);
    if (/[:\s]/.test(id)) warn(`${dayId} write ${id}: ids may not contain ":" or spaces`);
    if (!String(c.prompt ?? '').trim()) warn(`${dayId} write ${id}: no prompt`);
    if (!String(c.solution ?? '').trim()) warn(`${dayId} write ${id}: no solution`);
    const requires = (c.requires ?? []).map((r) => ({
      say: String(r.say ?? '').trim(),
      ...(r.match !== undefined ? { match: String(r.match).trim() } : {}),
      ...(r.then ? { then: r.then.map((x) => String(x).trim()) } : {}),
    }));
    const forbids = (c.forbids ?? []).map((f) => ({ say: String(f.say ?? '').trim(), match: String(f.match ?? '').trim() }));
    if ([...String(c.prompt ?? '').matchAll(/\*\*([^*]+)\*\*/g)].some((m) => m[1].includes('`'))) warn(`${dayId} write ${id}: code inside **bold** in the prompt renders as literal asterisks — use *emphasis* or drop the bold`);
    if (shape) {
      if (!requires.length) warn(`${dayId} write ${id}: no requires — a shape card with nothing to check accepts anything`);
      for (const r of requires) {
        if (!r.say) warn(`${dayId} write ${id}: a requirement has no say`);
        if ((r.match === undefined) === (r.then === undefined)) warn(`${dayId} write ${id}: "${r.say}" needs exactly one of match / then`);
      }
      if (!String(c.note ?? '').trim()) warn(`${dayId} write ${id}: no note — say what the card is for once it is answered`);
      if (!Array.isArray(c.good ?? []) || !Array.isArray(c.bad ?? []) || !(c.bad ?? []).length) {
        warn(`${dayId} write ${id}: needs at least one "bad" example the pattern must reject`);
      }
    }
    // SQL cards may carry `bad` (classic wrong answers check-write-cards.py proves wrong);
    // the harness keys only mean something for a compiled language.
    for (const key of AUTHORING_ONLY) if (!shape && key !== 'bad' && c[key] !== undefined) warn(`${dayId} write ${id}: "${key}" is for Go/C++ cards`);
    if (!shape) {
      // A SQL forbid is a regular expression over the query, matched case-insensitively.
      for (const f of forbids) {
        try { new RegExp(f.match, 'i'); } catch { warn(`${dayId} write ${id}: forbid "${f.say}" is not a valid regular expression`); }
      }
    }
    return {
      id,
      prompt: String(c.prompt ?? '').trim(),
      solution: String(c.solution ?? '').trim(),
      hint: c.hint ? String(c.hint).trim() : null,
      verify: c.verify ? String(c.verify).trim() : null,
      // null means "decide from the solution": ordered when it sorts at the top level.
      ordered: typeof c.ordered === 'boolean' ? c.ordered : null,
      tag: tagOf(c.tag),
      part: partOf(c.part),
      given: c.given ? String(c.given).trimEnd() : null,
      note: c.note ? String(c.note).trim() : null,
      requires,
      forbids,
    };
  });
  return { lang, setup, defs, challenges };
}

/**
 * `day-NN-<slug>.practice.yaml`: the day's practice bank — fresh questions on the same
 * concept, dealt in rounds on the days after the lesson until it has landed (practice.ts).
 *
 *   write:   challenges, the same shape as a .write.yaml (its own setup/lang/defs, or the
 *            day's write file's when left out)
 *   drill:   steps, the same shape as a .drill.yaml (any number)
 *
 * Ids must not repeat the day's own write or drill ids: they share a card namespace.
 */
function loadPractice(path, dayId, write, drill) {
  if (!existsSync(path)) return null;
  const doc = parseYaml(readFileSync(path, 'utf8')) ?? {};
  let w = null;
  if (doc.write?.length) {
    w = parseWrite({
      lang: doc.lang ?? write?.lang ?? 'sql',
      setup: doc.setup ?? write?.setup ?? '',
      defs: { ...(write?.defs ?? {}), ...(doc.defs ?? {}) },
      challenges: doc.write,
    }, path, dayId);
  }
  const d = doc.drill?.length ? parseDrill(doc.drill, path, dayId, { max: 999, salt: 'practice' }) : null;
  const clash = (mine, theirs, what) => {
    const ids = new Set((theirs ?? []).map((x) => x.id));
    for (const x of mine ?? []) if (ids.has(x.id)) fail(`${dayId}: practice ${what} id "${x.id}" is also in the day's own ${what} file — they share card ids`);
  };
  clash(w?.challenges, write?.challenges, 'write');
  clash(d, drill, 'drill');
  const total = (w?.challenges.length ?? 0) + (d?.length ?? 0);
  if (total && total < 20) warn(`${dayId}: practice bank has ${total} items — aim for 25–40 so rounds don't repeat`);
  return total ? { write: w, drill: d ?? [] } : null;
}

/**
 * `day-NN-<slug>.hooks.yaml`: vivid associations for the facts that will not stay put on
 * their own (src/lib/hooks.ts).
 *
 *   hooks:
 *     - id: clause-order        unique within the day
 *       part: 1                 on a day read in parts
 *       glyph: 🍳               one emoji, the image's anchor
 *       remember: …             the fact, in a line
 *       hook: …                 the picture or story, carrying the reason as well
 *       tags: [running order]   themes it covers: a miss on any brings it back
 *       cards: [q-order]        card ids it covers, for items without a tag
 *
 * A hook that links to nothing (no tag or card that exists, and no part to fall back on)
 * can never come back after a miss, so the build says so.
 */
function loadHooks(path, dayId, { parts, items }) {
  if (!existsSync(path)) return null;
  const doc = parseYaml(readFileSync(path, 'utf8')) ?? {};
  const hooks = doc.hooks ?? [];
  const ids = new Set();
  const tags = new Set(items.map((x) => x.tag).filter(Boolean));
  const cardIds = new Set(items.map((x) => x.id));
  const out = hooks.map((h, i) => {
    const where = `${dayId} hook ${h.id ?? i + 1}`;
    for (const k of ['id', 'glyph', 'remember', 'hook']) if (!String(h[k] ?? '').trim()) fail(`${where}: missing "${k}"`);
    if (ids.has(h.id)) fail(`${where}: id repeats within the day`);
    ids.add(h.id);
    if (parts && !h.part) warn(`${where}: the day is in parts, so the hook needs "part: N"`);
    if (h.part && parts && h.part > parts) warn(`${where}: part ${h.part}, but the day has ${parts}`);
    for (const t of h.tags ?? []) if (!tags.has(t)) warn(`${where}: tag "${t}" is on no card of this day`);
    for (const c of h.cards ?? []) if (!cardIds.has(c)) warn(`${where}: card "${c}" is not one of this day's`);
    const linked = (h.tags ?? []).some((t) => tags.has(t)) || (h.cards ?? []).some((c) => cardIds.has(c)) || parts;
    if (!linked) warn(`${where}: links to no card, so a miss can never bring it back`);
    if ([...String(h.glyph)].length > 4) warn(`${where}: the glyph is one emoji, not text`);
    if (String(h.hook).trim().split(/\s+/).length > 110) warn(`${where}: over 110 words — a hook is read in a glance`);
    return {
      id: h.id,
      part: h.part ?? null,
      glyph: String(h.glyph).trim(),
      remember: String(h.remember).trim(),
      hook: String(h.hook).trim(),
      tags: h.tags ?? null,
      cards: h.cards ?? null,
    };
  });
  return out.length ? out : null;
}

function buildTopic(milestone) {
  const lessonsDir = join(milestonesDir, milestone, 'lessons');
  const topicYaml = join(lessonsDir, 'topic.yaml');
  if (!existsSync(topicYaml)) return null;

  const meta = parseYaml(readFileSync(topicYaml, 'utf8'));
  const lessonFiles = readdirSync(lessonsDir).filter((f) => /^day-\d+-.*\.md$/.test(f));

  const days = (meta.days ?? []).map((d) => {
    const dayNum = String(d.day).padStart(2, '0');
    const mdName = lessonFiles.find((f) => f.startsWith(`day-${dayNum}-`));

    const base = {
      id: d.id,
      day: d.day,
      title: d.title,
      estMinutes: d.estMinutes ?? 25,
      teaser: d.teaser?.trim() ?? null,
      teachBack: d.teachBack?.trim() ?? null,
      topic: milestone,
    };

    if (!mdName) {
      // Listed but not yet written — shows on the map as a locked, titled step.
      return { ...base, status: 'upcoming', theoryMarkdown: null, quiz: null, task: null };
    }

    const slug = mdName.replace(/^day-\d+-/, '').replace(/\.md$/, '');
    const sections = splitSections(readFileSync(join(lessonsDir, mdName), 'utf8'));
    const quiz = loadQuiz(join(lessonsDir, mdName.replace(/\.md$/, '.quiz.yaml')), d.id);
    const drill = loadDrill(join(lessonsDir, mdName.replace(/\.md$/, '.drill.yaml')), d.id);
    const write = loadWrite(join(lessonsDir, mdName.replace(/\.md$/, '.write.yaml')), d.id);
    const practice = loadPractice(join(lessonsDir, mdName.replace(/\.md$/, '.practice.yaml')), d.id, write, drill);
    if (!write) {
      warn(`${d.id}: no .write.yaml — this day has nothing to type from memory in the review deck`);
    }
    if (!drill) warn(`${d.id}: no .drill.yaml — this day can only be done at a machine`);

    const raw = readFileSync(join(lessonsDir, mdName), 'utf8');
    const parts = parseParts(raw, d.id, mdName, d.added);
    const hooks = loadHooks(join(lessonsDir, mdName.replace(/\.md$/, '.hooks.yaml')), d.id, {
      parts: parts.length,
      items: [...(quiz ?? []), ...(drill ?? []), ...(write?.challenges ?? []), ...(practice?.write?.challenges ?? []), ...(practice?.drill ?? [])],
    });
    if (parts.length && sections.theory) warn(`${d.id}: ${mdName} has both "## Theory" and "## Part" sections — a day is read one way or the other`);
    if (!parts.length && !sections.theory) warn(`${d.id}: ${mdName} has no "## Theory" section`);
    for (const p of parts.length ? parts : [{ markdown: sections.theory }]) checkOrderMarkers(d.id, mdName, p.markdown, warn);
    if (!quiz) warn(`${d.id}: no .quiz.yaml — the day will skip straight to the task`);

    if (parts.length) {
      // Every question checks one part, and every part is checked: two or three questions
      // each, so a part is closed by a short check rather than left as reading alone.
      for (const q of quiz ?? []) {
        if (!q.part) warn(`${d.id} ${q.id}: the day is in parts, so the question needs "part: N"`);
        else if (q.part > parts.length) warn(`${d.id} ${q.id}: part ${q.part}, but the day has ${parts.length}`);
      }
      for (const p of parts) {
        const n = (quiz ?? []).filter((q) => q.part === p.n).length;
        p.minutes += Math.ceil(n * 0.75);
        if (n < 2 || n > 4) warn(`${d.id}: part ${p.n} has ${n} question(s) — two or three check a part`);
        if (p.listed !== n) warn(`${d.id}: ${mdName} part ${p.n} lists ${p.listed} question(s) under "Check yourself", .quiz.yaml has ${n}`);
      }
      const items = [...(write?.challenges ?? []), ...(practice?.write?.challenges ?? []), ...(practice?.drill ?? [])];
      for (const it of items) if (it.part && it.part > parts.length) warn(`${d.id} ${it.id}: part ${it.part}, but the day has ${parts.length}`);
    } else {
      const mdCount = countMdQuizQuestions(sections.quiz);
      if (quiz && mdCount && mdCount !== quiz.length) {
        warn(`${d.id}: ${mdName} lists ${mdCount} quiz questions, .quiz.yaml has ${quiz.length}`);
      }
    }

    return {
      ...base,
      slug,
      status: 'available',
      // A day in parts keeps the whole text here too, for the mentor and anything else
      // that wants the day at once.
      theoryMarkdown: parts.length ? parts.map((p) => `## ${p.title}\n\n${p.markdown}`).join('\n\n') : sections.theory ?? null,
      ...(parts.length ? { parts: parts.map(({ listed, ...p }) => p) } : {}),
      drill,
      write,
      practice,
      quiz,
      ...(hooks ? { hooks } : {}),
      task: parseTask(sections.task),
    };
  });

  return {
    id: milestone,
    title: meta.title,
    // Which subject this topic belongs to. Everything downstream — the day the app
    // offers next, the review deck, which language a fence is highlighted as — keys
    // off this, so a topic that forgets to declare it lands in the original track.
    track: meta.track ?? 'cpp',
    intro: meta.intro?.trim() ?? '',
    days,
  };
}

function sha256(s) {
  return `sha256:${createHash('sha256').update(s).digest('hex').slice(0, 32)}`;
}

// ---------------------------------------------------------------------------

const milestones = existsSync(milestonesDir)
  ? readdirSync(milestonesDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort()
  : [];

const weeksOut = join(outDir, 'weeks');
// Emptied first: a path that no longer exists (the old per-week files) must not linger in
// the build output and keep being served.
rmSync(weeksOut, { recursive: true, force: true });
mkdirSync(weeksOut, { recursive: true });

const trackMeta = parseYaml(readFileSync(join(milestonesDir, 'tracks.yaml'), 'utf8')) ?? {};

/** Newest source mtime, so `generatedAt` only moves when the content actually does —
 *  stamping Date.now() here means every build dirties a committed file. */
let newest = 0;
newest = statSync(join(milestonesDir, 'tracks.yaml')).mtimeMs;

const topicsByTrack = new Map();
for (const milestone of milestones) {
  const topic = buildTopic(milestone);
  if (!topic) continue;
  const lessonsDir = join(milestonesDir, milestone, 'lessons');
  for (const f of readdirSync(lessonsDir)) {
    newest = Math.max(newest, statSync(join(lessonsDir, f)).mtimeMs);
  }
  if (!topicsByTrack.has(topic.track)) topicsByTrack.set(topic.track, []);
  topicsByTrack.get(topic.track).push(topic);
}

const weekRefs = [];
const trackOrder = [...Object.keys(trackMeta), ...[...topicsByTrack.keys()].filter((t) => !(t in trackMeta))];
for (const track of trackOrder) {
  const topics = topicsByTrack.get(track);
  if (!topics) continue;
  const meta = trackMeta[track] ?? {};
  const days = topics.flatMap((t) => t.days);

  // Day numbers count up through the whole track, so "Day 6" means one thing on the
  // path. A topic that restarts at 1 would put two Day 1s on one path.
  for (let i = 1; i < days.length; i++) {
    if (days[i].day <= days[i - 1].day) {
      console.error(
        `\nFATAL: in the ${track} track, ${days[i].id} is day ${days[i].day} but follows ` +
          `${days[i - 1].id} (day ${days[i - 1].day}).\n` +
          '       Day numbers keep counting up through a track: a new topic starts where\n' +
          '       the previous one stopped.\n',
      );
      process.exit(1);
    }
  }

  const path = {
    schemaVersion: SCHEMA_VERSION,
    id: `track-${track}`,
    title: meta.title ?? track,
    milestone: topics.at(-1).id,
    track,
    intro: meta.intro?.trim() ?? '',
    topics: topics.map((t) => ({ id: t.id, title: t.title, intro: t.intro })),
    next: (meta.next ?? []).map((n) => String(n).trim()),
    days,
  };

  const json = `${JSON.stringify(path, null, 2)}\n`;
  const rel = `content/weeks/${path.id}.json`;
  writeFileSync(join(weeksOut, `${path.id}.json`), json);

  const available = days.filter((d) => d.status === 'available').length;
  weekRefs.push({
    id: path.id,
    title: path.title,
    milestone: path.milestone,
    track,
    days: days.length,
    availableDays: available,
    url: rel,
    contentHash: sha256(json),
    available: available > 0,
  });

  console.log(`  ${path.id.padEnd(11)} ${path.title.padEnd(14)} ${available}/${days.length} days written, ${topics.length} topic(s)`);
}

// Day ids are the key of the progress record, the review deck and the mentor's chat
// threads — all of which are flat maps keyed by day id alone. Two weeks sharing one id
// therefore share a learner's progress, silently and in every direction at once. This
// is a hard failure rather than a warning because there is no partial version of it:
// the SQL and C++ tracks both shipping `day-01` made finishing one finish the other.
const seenDayIds = new Map();
for (const ref of weekRefs) {
  const week = JSON.parse(readFileSync(join(outDir, 'weeks', `${ref.id}.json`), 'utf8'));
  for (const day of week.days) {
    const owner = seenDayIds.get(day.id);
    if (owner) {
      console.error(
        `\nFATAL: day id "${day.id}" is used by both ${owner} and ${ref.id}.\n` +
          '       Day ids must be unique across every track — progress, review cards and\n' +
          '       chat threads are all keyed by them, so a collision merges two days into\n' +
          '       one record. Prefix the newer track\'s ids (e.g. "sql-day-01").\n',
      );
      process.exit(1);
    }
    seenDayIds.set(day.id, ref.id);
  }
}

const curriculum = {
  schemaVersion: SCHEMA_VERSION,
  title: 'slowpath',
  generatedAt: new Date(newest || Date.now()).toISOString(),
  weeks: weekRefs,
};
writeFileSync(join(outDir, 'curriculum.json'), `${JSON.stringify(curriculum, null, 2)}\n`);

console.log(`\n${weekRefs.length} track(s) → app/public/content/`);
if (warnings.length) {
  console.log(`\n${warnings.length} warning(s):`);
  for (const w of warnings) console.log(`  ! ${w}`);
}
