/**
 * Things that happen when you are not expecting them.
 *
 * Novelty is one of the things that switches on the brain's dopamine system (the
 * substantia nigra / VTA responds to novel stimuli as such: Bunzeck & Düzel, Neuron 2006),
 * and that system is part of what decides what the hippocampus keeps (Lisman & Grace,
 * Neuron 2005). So the app hides surprises: true stories from old source code, strange
 * facts, a creature for every misconception you beat, a couple of secret modes, notes
 * left for whoever gets far enough, and replies to words nobody is told to type.
 *
 * What keeps this from turning into a points system, which the motivation research warns
 * against (`motivation.ts`): none of it is announced, none of it can be farmed, and there
 * is no "N of M collected" to chase. Deci, Koestner & Ryan's 1999 meta-analysis found that
 * *expected* rewards for doing a task lower interest in it, and *unexpected* ones do not.
 * Everything here is unexpected by construction, and most of it is about the subject.
 *
 * Every story presented as true is true and was checked before it shipped; jokes are
 * plainly jokes. Pure: tested in scripts/test-eggs.mjs.
 */

export type EggKind =
  | 'source' // a real comment or line from real code, with its story
  | 'fact' // a true fact that rearranges something
  | 'rumour' // a hint that a secret exists
  | 'beast' // a misconception beaten, as a creature
  | 'clock' // the time of day was interesting
  | 'calendar' // the date was interesting
  | 'milestone' // a round (binary) number of answers
  | 'letter' // a note left for whoever got this far
  | 'answer' // something you typed into a card
  | 'mentor' // something you said to the mentor
  | 'secret'; // a secret mode found

export interface Egg {
  id: string;
  kind: EggKind;
  glyph: string;
  title: string;
  /** Inline markdown: `code`, **bold**, *emphasis*. */
  body: string;
}

/** What is kept of an egg once found: enough to show it again, whatever content changes later. */
export interface FoundEgg {
  at: string;
  kind: EggKind;
  glyph: string;
  title: string;
  body: string;
}

export interface EggState {
  found: Record<string, FoundEgg>;
  /** Per theme: correct answers in a row since a miss (the hunt). */
  hunts: Record<string, { run: number }>;
  /** Local dates on which a fact, and a piece of old source, were last shown. */
  lastFact?: string | null;
  lastSource?: string | null;
}

export const emptyEggs = (): EggState => ({ found: {}, hunts: {}, lastFact: null, lastSource: null });

export const KIND_LABEL: Record<EggKind, string> = {
  source: 'Found in the source',
  fact: 'Strange but true',
  rumour: 'A rumour',
  beast: 'Bestiary',
  clock: 'The clock struck',
  calendar: 'On this day',
  milestone: 'Overflow',
  letter: 'A note left here',
  answer: 'You typed something',
  mentor: 'The mentor heard that',
  secret: 'Secret mode',
};

type Rng = () => number;
type Track = 'sql' | 'go' | 'cpp';

// --- found in the source ----------------------------------------------------------

export const SOURCES: Egg[] = [
  {
    id: 'src:unix-v6',
    kind: 'source',
    glyph: '📜',
    title: '“You are not expected to understand this.”',
    body:
      'A comment in the context-switching code of Sixth Edition Unix, 1975, and probably the most quoted comment ever written — it ended up on T-shirts. Dennis Ritchie later explained he meant it like a teacher saying *this won\'t be on the exam*, and admitted the authors didn\'t fully understand that code either.',
  },
  {
    id: 'src:agc-hope',
    kind: 'source',
    glyph: '🌕',
    title: '`TEMPORARY, I HOPE HOPE HOPE`',
    body:
      'A comment in the lunar landing guidance code of Apollo 11, 1969. It flew to the Moon and back. Temporary code has a way of going much further than anyone planned.',
  },
  {
    id: 'src:agc-burn',
    kind: 'source',
    glyph: '🔥',
    title: '`BURN_BABY_BURN--MASTER_IGNITION_ROUTINE`',
    body:
      'The name of the Apollo 11 file that lit the lunar module\'s engine. The programmers borrowed it from the catchphrase of the 1960s radio DJ Magnificent Montague. Code that landed people on the Moon, written by people who were allowed to have fun.',
  },
  {
    id: 'src:quake',
    kind: 'source',
    glyph: '👾',
    title: '`// what the fuck?`',
    body:
      'From Quake III Arena\'s fast inverse square root, released as open source in 2005: it sits right next to the magic constant `0x5f3759df`, under a line that says `// evil floating point bit level hacking`. Tracing who actually invented the trick took years of detective work.',
  },
  {
    id: 'src:dotfiles',
    kind: 'source',
    glyph: '👻',
    title: 'Hidden files were a bug',
    body:
      'As Rob Pike tells it: early Unix `ls` skipped `.` and `..` with a lazy test, *does the name start with a dot?* — so every name starting with a dot vanished too, and people began hiding things on purpose. A shortcut of a few characters became a convention every Unix system still follows.',
  },
  {
    id: 'src:moth',
    kind: 'source',
    glyph: '🦋',
    title: '“First actual case of bug being found.”',
    body:
      'The logbook of the Harvard Mark II, 9 September 1947, with a moth taped under the entry. "Bug" was already engineering slang — Edison used it in the 1870s. The joke in the log is that this time it was literal.',
  },
  {
    id: 'src:hell-o',
    kind: 'source',
    glyph: '👋',
    title: '`a \'hell\'; b \'o, w\'; c \'orld\';`',
    body:
      'The first "hello, world" — in Brian Kernighan\'s 1972 tutorial for the language B, split across three variables because a B character constant held at most four characters. It moved to C in *The C Programming Language* (1978), lower case and comma included.',
  },
  {
    id: 'src:manifesto',
    kind: 'source',
    glyph: '🖥️',
    title: '“This is our world now… the world of the electron and the switch, the beauty of the baud.”',
    body:
      'From *The Conscience of a Hacker*, written by "The Mentor" in January 1986, shortly after his arrest, and published in Phrack. Forty years later it is still the closest thing the old hacker underground had to a creed.',
  },
];

// --- strange but true, and rumours of secrets ---------------------------------------

const FACTS: Record<Track | 'any', Egg[]> = {
  sql: [
    {
      id: 'fact:sequel',
      kind: 'fact',
      glyph: '✈️',
      title: 'SQL was renamed because of an aircraft company',
      body:
        'IBM\'s query language was called SEQUEL (1974). The name had to change because it was already a trademark — of Hawker Siddeley, a British aircraft maker. That is why "sequel" and "S-Q-L" are both still heard today.',
    },
    {
      id: 'fact:slonik',
      kind: 'fact',
      glyph: '🐘',
      title: 'The elephant has a name',
      body: 'PostgreSQL\'s elephant is called **Slonik**, from the Russian for "little elephant".',
    },
    {
      id: 'fact:post-ingres',
      kind: 'fact',
      glyph: '🏛️',
      title: 'Postgres means "after Ingres"',
      body:
        'Michael Stonebraker started Postgres at Berkeley in 1986 as the successor to his own Ingres. It did not speak SQL at first; that came with Postgres95, and the name PostgreSQL in 1996. Every `psql` prompt is a forty-year-old research project.',
    },
    {
      id: 'fact:billion-dollar',
      kind: 'fact',
      glyph: '💸',
      title: 'The billion-dollar mistake',
      body:
        'Tony Hoare added the null reference to ALGOL W in 1965 "simply because it was so easy to implement". In 2009 he called it his billion-dollar mistake. SQL\'s NULL is a different beast, but it has a similar body count.',
    },
  ],
  go: [
    {
      id: 'fact:gopher',
      kind: 'fact',
      glyph: '🐹',
      title: 'The gopher has an artist',
      body: 'Go\'s gopher was drawn by Renée French. It first appeared some fifteen years before Go, on a T-shirt for a fundraiser of the New Jersey radio station WFMU. French later turned it into Glenda, the Plan 9 bunny at Bell Labs, and suggested it as Go\'s mascot for the 2009 launch.',
    },
    {
      id: 'fact:go-compile',
      kind: 'fact',
      glyph: '⏳',
      title: 'Go began as a wait',
      body:
        'Rob Pike has said the starting point for Go was long C++ build times at Google — big programs, and far too much code going through the compiler. A language designed, in part, by people tired of waiting.',
    },
  ],
  cpp: [
    {
      id: 'fact:cpp-name',
      kind: 'fact',
      glyph: '➕',
      title: 'C++ was named by somebody else',
      body:
        'Bjarne Stroustrup\'s language was "C with Classes" until 1983, when Rick Mascitti suggested C++. The joke is that `C++` evaluates to the old C.',
    },
    {
      id: 'fact:morris',
      kind: 'fact',
      glyph: '🪱',
      title: 'One `gets()` and the internet went down',
      body:
        'The Morris worm of 2 November 1988 got into thousands of machines partly by overflowing a buffer in `fingerd`, which read its input with `gets()`. Its author became the first person convicted under the US Computer Fraud and Abuse Act. `gets` was finally removed from C in C11.',
    },
    {
      id: 'fact:crunch',
      kind: 'fact',
      glyph: '📯',
      title: 'A cereal-box whistle ran the phone network',
      body:
        'A toy whistle given away with Cap\'n Crunch cereal played 2600 Hz — the tone AT&T\'s long-distance network used to signal an idle trunk. Whistle it into a phone and you could take control of the line. Signalling in the same channel as the data is a design mistake the industry has kept repeating.',
    },
  ],
  any: [
    {
      id: 'fact:cyberspace',
      kind: 'fact',
      glyph: '🌐',
      title: 'Cyberspace was a short story first',
      body:
        'William Gibson coined "cyberspace" in *Burning Chrome* (1982) and made it famous in *Neuromancer* (1984) — written on a typewriter, by someone who barely used computers.',
    },
    {
      id: 'fact:dracones',
      kind: 'fact',
      glyph: '🐉',
      title: 'Here be dragons — once, really',
      body:
        'Old maps almost never said it. One of the very few that does is the Hunt–Lenox Globe, around 1510: **HC SVNT DRACONES**, off the coast of Asia. Rumour has it the edge of *this* map remembers too, if you knock on it.',
    },
    {
      id: 'fact:note-g',
      kind: 'fact',
      glyph: '⚙️',
      title: 'The first program ran on a machine that was never built',
      body:
        'Ada Lovelace\'s Note G (1843) laid out, step by step, how Babbage\'s Analytical Engine would compute Bernoulli numbers. The engine was never built. The program was correct anyway.',
    },
  ],
};

/** Hints that secrets exist. Dealt like facts, so they arrive as rarely. */
export const RUMOURS: Egg[] = [
  {
    id: 'rumour:knock',
    kind: 'rumour',
    glyph: '🚪',
    title: 'They say the name answers if you knock',
    body: 'Seven times, quickly, on the word at the top of Today. Nobody admits to having tried it.',
  },
  {
    id: 'rumour:konami',
    kind: 'rumour',
    glyph: '🕹️',
    title: 'Old keyboards remember a code',
    body: '↑ ↑ ↓ ↓ ← → ← → B A. It has opened secret doors since 1986. Some say it still does, on a keyboard, anywhere outside a text box.',
  },
  {
    id: 'rumour:xyzzy',
    kind: 'rumour',
    glyph: '🕯️',
    title: 'The mentor knows a magic word',
    body: 'From a cave in Kentucky, 1976. Five letters. Try saying it to the mentor.',
  },
];

// --- misconceptions beaten: the bestiary -------------------------------------------

/** The creature a theme becomes, from what the theme is about. First match wins. */
const BEASTS: { match: RegExp; name: string; lore: string }[] = [
  { match: /null|coalesce|nothing|empty/i, name: 'NULL, the Hollow King', lore: 'Neither true nor false, it rules the third value and swallows every comparison that touches it. It has stopped expecting you to fall for it.' },
  { match: /fan.?out|grain|join.*multipl|multipl/i, name: 'The Fan-out Hydra', lore: 'Cut one join and two more rows grow back. You learned to aggregate first, and it has nothing left to grow from.' },
  { match: /left join|outer|anti.?join|on vs where/i, name: 'The Vanishing Customer', lore: 'A ghost that lives in the WHERE clause under a LEFT JOIN and eats everyone without a match. It is hungry, and you no longer feed it.' },
  { match: /where vs having|having|what a clause|alias|running order|clause/i, name: 'The Alias Phantom', lore: 'Visible in ORDER BY, invisible in WHERE, it haunts people who read queries top to bottom. You read them in running order now.' },
  { match: /order|sort|ties|offset|keyset|pagin/i, name: 'The Shuffler', lore: 'It rearranges rows whenever nobody is looking, and nobody without an ORDER BY is ever looking. You now always look.' },
  { match: /window|frame|rank|lag|lead|running/i, name: 'The Frame Wraith', lore: 'It hides in the default frame and whispers RANGE where you meant ROWS. Banished, for now, to the edge of the partition.' },
  { match: /partial ind|covering|composite|index|seq.?scan|prefix/i, name: 'The Seq-Scan Wyrm', lore: 'It sleeps on top of every table you forgot to index and reads all of it, every time. You learned where to put the sword.' },
  { match: /time|zone|timestamp|date|calendar|interval|now\(\)/i, name: 'The Chronophage', lore: 'It eats the last day of every BETWEEN and an hour each spring. It has gone looking for someone who still trusts midnight.' },
  { match: /round|float|integer|numeric|division|overflow|money/i, name: 'The Rounding Imp', lore: 'It steals a fraction of a cent at a time and has never once been caught by a test. It was caught by you.' },
  { match: /filter|count|aggregate/i, name: 'The Double Counter', lore: 'It counts the zeros, sums the duplicates and swears the totals are right. It no longer gets a vote.' },
  { match: /goroutine|channel|select|deadlock|race|mutex/i, name: 'The Deadlock Twins', lore: 'Each waits for the other forever. You made one of them go first.' },
  { match: /nil|interface/i, name: 'The Typed Nil', lore: 'It looks like nothing and is not equal to nothing. A shapeshifter, now pinned to its type.' },
  { match: /defer|panic|recover|error/i, name: 'The Deferred Shade', lore: 'It waits until the function returns and evaluates its arguments early, out of spite. You know its schedule now.' },
  { match: /slice|append|array|capacity/i, name: 'The Aliasing Mimic', lore: 'It pretends to be a fresh copy and shares a backing array with something you love. Unmasked.' },
  { match: /byte order|endian|htons|network order/i, name: 'The Endian Djinn', lore: 'It turns port 9000 into port 10275 and grants no wishes. Bottled, big end first.' },
  { match: /socket|bind|listen|accept|connect|backlog|recv|send/i, name: 'The Half-Open Wraith', lore: 'It haunts connections that one side thinks are alive. You learned to read the zero that recv() returns.' },
  { match: /pointer|memory|buffer|lifetime|dangling|struct|padding/i, name: 'The Dangling Shade', lore: 'It lives at an address that used to be yours. You stopped visiting.' },
  { match: /page|ctid|heap|mvcc|vacuum|tuple/i, name: 'The Dead Tuple', lore: 'An old version of a row, still lying on the page, still taking up space. Vacuumed, with respect.' },
];

const FALLBACK_KINDS = ['Gremlin', 'Basilisk', 'Daemon', 'Wyrm', 'Golem', 'Kraken', 'Imp', 'Lich'];

function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** The creature a misconception about `label` turns into, once beaten. */
export function beastFor(themeKey: string, label: string): Egg {
  const hit = BEASTS.find((b) => b.match.test(label));
  const name = hit?.name ?? `The ${FALLBACK_KINDS[hash(themeKey) % FALLBACK_KINDS.length]} of ${label}`;
  const lore = hit?.lore ?? `It fed on every wrong guess about ${label}. You starved it.`;
  return {
    id: `beast:${themeKey}`,
    kind: 'beast',
    glyph: hit ? '🐉' : '👹',
    title: name,
    body: `${lore} *Beaten: three right in a row on ${label}, after missing it.*`,
  };
}

/** Right answers in a row, after a miss, that beat a misconception. */
export const SLAY_AT = 3;

/**
 * One answer on a theme. A miss opens a hunt; SLAY_AT right answers in a row afterwards
 * end it. A theme you never missed has nothing to hunt — the bestiary is a record of
 * mistakes you came back from, not of things you already knew.
 */
export function stepHunt(hunts: EggState['hunts'], themeKey: string, right: boolean): { hunts: EggState['hunts']; slain: boolean } {
  const h = hunts[themeKey];
  if (!right) return { hunts: { ...hunts, [themeKey]: { run: 0 } }, slain: false };
  if (!h) return { hunts, slain: false };
  const run = h.run + 1;
  if (run >= SLAY_AT) {
    const { [themeKey]: _, ...rest } = hunts;
    return { hunts: rest, slain: true };
  }
  return { hunts: { ...hunts, [themeKey]: { run } }, slain: false };
}

// --- the clock and the calendar --------------------------------------------------

/** Something about this exact time of day, if anything. Found once each. */
export function clockEgg(now: Date): Egg | null {
  const h = now.getHours();
  const m = now.getMinutes();
  if (h === 3 && m === 14) return { id: 'clock:pi', kind: 'clock', glyph: '🥧', title: '3:14', body: 'You are studying at π o\'clock. The digits go on forever; your session does not have to.' };
  if (h === 13 && m === 37) return { id: 'clock:leet', kind: 'clock', glyph: '😎', title: '13:37', body: 'Studying at 1337. Elite hours, elite queries.' };
  if (h === 4 && m === 4) return { id: 'clock:404', kind: 'clock', glyph: '🛌', title: '04:04', body: '404: sleep not found. Whatever you learn now, a night\'s sleep is what files it away — consolidation happens offline.' };
  if (h === 0 && m < 10) return { id: 'clock:midnight', kind: 'clock', glyph: '🕛', title: 'Midnight', body: 'The date just changed under you. Somewhere a `timestamp without time zone` just became wrong, and a `timestamptz` did not.' };
  if (h >= 2 && h < 5) return { id: 'clock:night-shift', kind: 'clock', glyph: '🌘', title: 'The night shift', body: 'Every production incident you will ever be paged for happens at this hour. Consider this a rehearsal.' };
  return null;
}

/** The nth weekday (0 = Sunday) of a month. */
function nthWeekday(year: number, month: number, weekday: number, n: number): number {
  const first = new Date(year, month, 1).getDay();
  return 1 + ((weekday - first + 7) % 7) + (n - 1) * 7;
}

function dayOfYear(d: Date): number {
  return Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 86_400_000);
}

/** Something about today's date, if anything. Found once per year. */
export function calendarEgg(now: Date): Egg | null {
  const y = now.getFullYear();
  const mo = now.getMonth();
  const d = now.getDate();
  const id = (k: string) => `cal:${k}:${y}`;
  if (mo === 9 && d === nthWeekday(y, 9, 2, 2)) return { id: id('ada'), kind: 'calendar', glyph: '⚙️', title: 'Ada Lovelace Day', body: 'The second Tuesday of October. In 1843 she published, in Note G, a step-by-step program for a machine that was never built — and noted that such an engine could work on things other than numbers, such as music.' };
  if (dayOfYear(now) === 256) return { id: id('256'), kind: 'calendar', glyph: '💾', title: 'Day 256: Programmers\' Day', body: 'The 256th day of the year — 2⁸, the number of values in a byte. In Russia it has been an official professional holiday since 2009.' };
  if (mo === 2 && d === 14) return { id: id('pi'), kind: 'calendar', glyph: '🥧', title: 'Pi Day', body: '3/14. Also Einstein\'s birthday. Neither of them would have used a float for money.' };
  if (mo === 4 && d === 25) return { id: id('towel'), kind: 'calendar', glyph: '🧣', title: 'Towel Day', body: 'Fans of Douglas Adams carry a towel today. Don\'t panic. (The answer is still 42; the question is still unclear.)' };
  if (mo === 8 && d === 9) return { id: id('moth'), kind: 'calendar', glyph: '🦋', title: '9 September', body: 'The moth was taped into the Harvard Mark II logbook on this day in 1947. Dennis Ritchie, co-creator of C and Unix, was born on this day in 1941.' };
  if (mo === 9 && d === 29) return { id: id('lo'), kind: 'calendar', glyph: '📡', title: '29 October 1969', body: 'Charley Kline at UCLA tried to log in to a machine at the Stanford Research Institute. He typed **L**, **O** — and the system crashed. The first message ever sent over the network that became the internet was "LO". As in: lo and behold.' };
  if (mo === 10 && d === 2) return { id: id('worm'), kind: 'calendar', glyph: '🪱', title: '2 November 1988', body: 'The Morris worm. A buffer overflow in a program that read its input with `gets()`, and a large part of the internet went down. Bounds-check your inputs.' };
  if (mo === 10 && d === 10) return { id: id('go'), kind: 'calendar', glyph: '🐹', title: 'Go\'s birthday', body: 'Go was released as open source on 10 November 2009.' };
  if (mo === 5 && d === 23) return { id: id('turing'), kind: 'calendar', glyph: '🧠', title: 'Alan Turing\'s birthday', body: 'Born 23 June 1912. His 1936 paper defined what it means to compute anything at all — before there was a computer to compute it on.' };
  if (mo === 11 && d === 9) return { id: id('hopper'), kind: 'calendar', glyph: '⚓', title: 'Grace Hopper\'s birthday', body: 'Born 9 December 1906. She built one of the first compilers, when people thought computers could only do arithmetic, and handed out 30-centimetre lengths of wire to show what a nanosecond is.' };
  if (mo === 3 && d === 1) return { id: id('teapot'), kind: 'calendar', glyph: '🫖', title: 'April 1st', body: 'On this day in 1998 the IETF published RFC 2324, the Hyper Text Coffee Pot Control Protocol. It defines error **418 I\'m a teapot**, which real servers still return.' };
  if (now.getDay() === 5 && d === 13) return { id: id(`fri13-${mo}`), kind: 'calendar', glyph: '🐈‍⬛', title: 'Friday the 13th', body: 'Run every write today inside a transaction. Not because of superstition. Just in case.' };
  if (mo === 0 && d === 1) return { id: id('newyear'), kind: 'calendar', glyph: '🎆', title: 'Happy new year', body: `Unix time says it is about ${Math.floor(now.getTime() / 1000).toLocaleString('en')} seconds since 1970. A 32-bit counter of those runs out in January 2038.` };
  return null;
}

// --- round numbers ----------------------------------------------------------------

/** Answers given, in total, that are worth a word. Powers of four: rare, and getting rarer. */
export const MILESTONES: Record<number, Omit<Egg, 'id' | 'kind'>> = {
  64: { glyph: '🔢', title: '64 answers', body: '2⁶. That is the width of the register your answers would fit in. Nothing has overflowed yet.' },
  256: { glyph: '💾', title: '256 answers', body: 'A byte\'s worth. In an `unsigned char` the next one would wrap you back to zero. Luckily, you are not an `unsigned char`.' },
  1024: { glyph: '💌', title: '1024 answers', body: 'One kibi-answer. There is a note waiting for you in the cabinet.' },
  4096: { glyph: '📄', title: '4096 answers', body: 'A memory page. The operating system would hand you this many bytes at once. You earned it one at a time.' },
};

/** The milestone crossed by going from `before` to `after` answers, if any. */
export function milestoneCrossed(before: number, after: number): Egg | null {
  for (const n of Object.keys(MILESTONES).map(Number)) {
    if (before < n && after >= n) return { id: `milestone:${n}`, kind: 'milestone', ...MILESTONES[n] };
  }
  return null;
}

// --- notes left for whoever gets here ----------------------------------------------

export const LETTERS: Record<string, Egg> = {
  kibi: {
    id: 'letter:kibi',
    kind: 'letter',
    glyph: '💌',
    title: 'To whoever answered a thousand and twenty-four of these',
    body:
      'Most people who start something like this stop within a week. You did not. Nobody gets good at this by being clever once; they get good by coming back on the days it was boring. Whatever you are building with this, it will be built by the version of you who kept showing up. — *left here by whoever built this*',
  },
  comeback: {
    id: 'letter:comeback',
    kind: 'letter',
    glyph: '🕯️',
    title: 'You came back',
    body:
      'A week or more away, and here you are. That is the whole trick, honestly — not never stopping, but starting again. Everything you learned before the gap is still in there; the review deck will show you how much. — *left here for whoever came back*',
  },
  stubborn: {
    id: 'letter:stubborn',
    kind: 'letter',
    glyph: '🪨',
    title: 'It took more than one try',
    body:
      'This one did not land the first time, or the second. You kept going until it did, which is exactly what a hard concept is supposed to cost. Things learned the hard way are kept the longest. — *left here for whoever was stubborn*',
  },
  end: {
    id: 'letter:end',
    kind: 'letter',
    glyph: '🗺️',
    title: 'The edge of the written map',
    body:
      'You have read every day that has been written on this track so far. Beyond this point the map is blank, which means you get to ask for what comes next. — *left at the edge of the map*',
  },
};

// --- things typed into a card -----------------------------------------------------

const ANSWERS: { lang: 'sql' | 'go' | 'cpp' | 'any'; match: RegExp; egg: Egg }[] = [
  {
    lang: 'sql',
    match: /drop\s+table\s+students|'\s*\)\s*;\s*drop\s+table/i,
    egg: { id: 'answer:bobby', kind: 'answer', glyph: '🧒', title: 'Little Bobby Tables', body: '`Robert\'); DROP TABLE Students;--` — xkcd #327, 2007. The sandbox is rebuilt for every attempt, so no students were harmed. Parameterise your queries.' },
  },
  {
    lang: 'sql',
    match: /order\s+by\s+random\s*\(\s*\)/i,
    egg: { id: 'answer:random', kind: 'answer', glyph: '🎲', title: 'You chose chaos', body: '`ORDER BY random()` is the only ORDER BY that promises *no* order. On a big table it also sorts every row to keep one — `TABLESAMPLE` exists for a reason.' },
  },
  {
    lang: 'sql',
    match: /^\s*select\s+42\s*;?\s*$/i,
    egg: { id: 'answer:42', kind: 'answer', glyph: '🌌', title: 'The answer', body: 'Correct, as far as it goes. The trouble, as Douglas Adams pointed out, is that nobody knows the question.' },
  },
  {
    lang: 'sql',
    match: /pg_sleep\s*\(/i,
    egg: { id: 'answer:sleep', kind: 'answer', glyph: '😴', title: 'You put the database to sleep', body: 'It was tired anyway. (The card stops any query after a few seconds, so it will wake up.)' },
  },
  {
    lang: 'any',
    match: /hello,?\s+world/i,
    egg: { id: 'answer:hello', kind: 'answer', glyph: '👋', title: 'hello, world', body: 'Every programmer\'s first words in every language since 1972. The comma and the lower case are canon.' },
  },
  {
    lang: 'any',
    match: /\b(todo|fixme|xxx)\b/i,
    egg: { id: 'answer:todo', kind: 'answer', glyph: '📌', title: 'A TODO, in an answer', body: 'A TODO is a promise to a future you who will be busier than you are now. The Apollo programmers wrote *TEMPORARY, I HOPE HOPE HOPE*, and it flew to the Moon.' },
  },
  {
    lang: 'any',
    match: /\bgoto\b/i,
    egg: { id: 'answer:goto', kind: 'answer', glyph: '🚫', title: 'goto, considered', body: 'Dijkstra sent his letter as *A Case Against the GO TO Statement*. The editor, Niklaus Wirth, retitled it *Go To Statement Considered Harmful* (1968) — and gave the world a headline template for the next half century.' },
  },
];

/** Something worth noticing in what was typed into a write card. */
export function answerEgg(text: string, lang: string): Egg | null {
  const hit = ANSWERS.find((a) => (a.lang === 'any' || a.lang === lang) && a.match.test(text));
  return hit?.egg ?? null;
}

// --- words said to the mentor -------------------------------------------------------

/** A reply to a magic word, given without asking the model. */
export interface MentorEgg {
  egg: Egg;
  reply: string;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

export function mentorEgg(text: string): MentorEgg | null {
  const t = norm(text);
  const raw = text.trim();
  if (t === 'xyzzy') {
    return {
      reply: 'Nothing happens.\n\n…which is exactly what *Colossal Cave Adventure* said, in 1976, to everyone who typed it in the wrong room. Will Crowther wrote the cave after the real Kentucky caves he mapped; Don Woods added the magic. Every text adventure since descends from it.\n\n…and yet. Something did happen.',
      egg: { id: 'mentor:xyzzy', kind: 'mentor', glyph: '🕯️', title: 'xyzzy', body: 'Nothing happens. (Something did.)' },
    };
  }
  if (t === 'sudo make me a sandwich') {
    return {
      reply: 'Okay.\n\n*(xkcd #149, 2006.)*',
      egg: { id: 'mentor:sudo', kind: 'mentor', glyph: '🥪', title: 'sudo make me a sandwich', body: 'Okay.' },
    };
  }
  if (t === 'make me a sandwich') {
    return {
      reply: 'What? Make it yourself.',
      egg: { id: 'mentor:sandwich', kind: 'mentor', glyph: '🥪', title: 'make me a sandwich', body: 'What? Make it yourself. (There is a way to insist.)' },
    };
  }
  if (/^(sudo\s+)?rm\s+-rf\s+\/\*?\s*$/.test(raw)) {
    return {
      reply: 'Permission denied.\n\nModern GNU `rm` refuses to delete `/` at all unless you add `--no-preserve-root` — a flag that exists because someone, somewhere, needed the refusal. Then someone else typed the flag.',
      egg: { id: 'mentor:rmrf', kind: 'mentor', glyph: '💀', title: 'rm -rf /', body: 'Permission denied. You will thank it one day.' },
    };
  }
  if (t === 'ping') {
    return {
      reply: 'pong\n\n`64 bytes from mentor: icmp_seq=1 ttl=64 time=0.000 ms` — I was already here.',
      egg: { id: 'mentor:ping', kind: 'mentor', glyph: '🏓', title: 'ping', body: 'pong.' },
    };
  }
  if (t === 'hello world' || t === 'hello, world') {
    return {
      reply: 'hello, world\n\nFirst seen in Brian Kernighan\'s 1972 tutorial for B, where it had to be split across three variables because a B character constant held at most four characters.',
      egg: { id: 'mentor:hello', kind: 'mentor', glyph: '👋', title: 'hello, world', body: 'Said back, as tradition demands.' },
    };
  }
  if (t === '42' || /meaning of life|answer to life the universe and everything/.test(t)) {
    return {
      reply: 'Forty-two.\n\nThe answer is fine. The question is the part nobody has ever managed to write down — which, as it happens, is also true of most bug reports.',
      egg: { id: 'mentor:42', kind: 'mentor', glyph: '🌌', title: '42', body: 'The answer. Question pending.' },
    };
  }
  if (/\b(418|teapot|brew (me )?(some )?coffee)\b/.test(t)) {
    return {
      reply: '**418 I\'m a teapot.**\n\nRFC 2324, 1 April 1998: the Hyper Text Coffee Pot Control Protocol. A teapot asked to brew coffee must refuse. Real web frameworks still implement it, and a 2017 attempt to remove it was abandoned after people protested.',
      egg: { id: 'mentor:teapot', kind: 'mentor', glyph: '🫖', title: '418', body: 'I\'m a teapot.' },
    };
  }
  if (/^(up up down down|↑ ?↑ ?↓ ?↓)/.test(t) || t === 'konami') {
    return {
      reply: 'Close. Very close. But that one has to be *pressed*, not typed — on a keyboard, outside any text box.',
      egg: { id: 'mentor:konami-hint', kind: 'mentor', glyph: '🕹️', title: 'A code, typed', body: 'It has to be pressed, not typed.' },
    };
  }
  return null;
}

// --- the Konami code --------------------------------------------------------------

export const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA'];

/** Feed one key (`code`); returns how far along the code is, and whether it just completed. */
export function konamiStep(at: number, code: string): { at: number; done: boolean } {
  if (code === KONAMI[at]) {
    return at + 1 === KONAMI.length ? { at: 0, done: true } : { at: at + 1, done: false };
  }
  // A wrong key can still begin the code again: ↑ ↑ ↑ keeps the last two.
  if (code !== KONAMI[0]) return { at: 0, done: false };
  return { at: at === 2 ? 2 : 1, done: false };
}

// --- secret modes -----------------------------------------------------------------

export const SECRETS: Record<'phosphor' | 'dragons', Egg> = {
  phosphor: {
    id: 'secret:phosphor',
    kind: 'secret',
    glyph: '📟',
    title: 'Phosphor mode',
    body: 'Green on black, the way terminals glowed before anyone had a choice. Do it again to come back to the present.',
  },
  dragons: {
    id: 'secret:dragons',
    kind: 'secret',
    glyph: '🐉',
    title: 'Hic sunt dracones',
    body: 'The edge of the map is marked the old way now. Knock on it again to make the dragons go back to sleep.',
  },
};

// --- choosing ---------------------------------------------------------------------

/** Chance, per right answer, of a strange fact or a rumour — at most one a day. */
export const FACT_CHANCE = 0.06;
/** Chance, per part read, of a piece of old source — at most one a day. */
export const SOURCE_CHANCE = 0.5;

/** A fact or rumour not seen before, for this track, or null. */
export function pickFact(track: Track, found: Record<string, unknown>, rng: Rng): Egg | null {
  const pool = [...FACTS[track], ...FACTS.any, ...RUMOURS].filter((e) => !(e.id in found));
  return pool.length ? pool[Math.floor(rng() * pool.length)] : null;
}

/** A piece of old source not seen before, or null. */
export function pickSource(found: Record<string, unknown>, rng: Rng): Egg | null {
  const pool = SOURCES.filter((e) => !(e.id in found));
  return pool.length ? pool[Math.floor(rng() * pool.length)] : null;
}

/** Two devices' finds, combined: every egg either found, keeping the earlier find. */
export function mergeEggs(a: EggState | undefined, b: EggState | undefined): EggState | undefined {
  if (!a || !b) return a ?? b;
  const found = { ...b.found };
  for (const [k, v] of Object.entries(a.found)) if (!found[k] || v.at < found[k].at) found[k] = v;
  const max = (x?: string | null, y?: string | null) => (!x ? y ?? null : !y ? x : x > y ? x : y);
  return { found, hunts: { ...b.hunts, ...a.hunts }, lastFact: max(a.lastFact, b.lastFact), lastSource: max(a.lastSource, b.lastSource) };
}

/**
 * A knock: `need` taps within `windowMs`. Returns the taps still in the window and
 * whether this tap completed the knock (which starts the count again).
 */
export function knock(taps: number[], now: number, need: number, windowMs: number): { taps: number[]; done: boolean } {
  const recent = [...taps.filter((t) => now - t <= windowMs), now];
  return recent.length >= need ? { taps: [], done: true } : { taps: recent, done: false };
}
