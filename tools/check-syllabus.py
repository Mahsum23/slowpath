#!/usr/bin/env python3
"""
check-syllabus.py — no SQL card may ask for something no lesson has taught yet.

A practice card once wanted `date_trunc('month', placed)::date`. Nothing before it had
shown `date_trunc` or a `::date` cast, so the card measured whether you happened to know
PostgreSQL already, not whether the lesson landed. This makes that mistake mechanical to
catch.

For every SQL day it collects what the lessons have *shown in code* so far: the functions
called, the `::type` casts, and a list of keywords worth watching (FILTER, OVER, WITH,
CASE, coalesce …). Anything inside a code fence or inline `code` in the theory counts; prose
does not. A day's taught set is everything from earlier days on the track, plus — for an
item that names a `part:` — the parts of its own day up to that one, or the whole day for
an item that does not.

Then it reads what each item asks the learner to *write or read*: write-card solutions,
practice-bank solutions, drill code, and inline code in quiz and drill prompts and options.
Setups are left out (they are shown, not written). Anything used there that is neither
taught nor in the small baseline below is reported.

Functions are recognised against the server's own catalog (`pg_proc`), so a table named in
`INSERT INTO t (…)` is never mistaken for a call. Needs a server, like the other checkers:

    cd app && npm run content
    PGPASSWORD=x tools/check-syllabus.py
"""
import json
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PSQL = ['psql', '-h', os.environ.get('PGHOST', 'localhost'), '-U', os.environ.get('PGUSER', 'postgres'), '-X', '-qAt']

# What the SQL track assumes a reader arrives with: the five aggregates every tutorial opens with.
BASELINE = {'count()', 'sum()', 'avg()', 'min()', 'max()'}

# Keywords that are a thing to learn in their own right. Plain SELECT/WHERE/JOIN/GROUP BY are not
# watched; these are. Each is (name shown in the report, regular expression).
WATCHED = [
    ('FILTER (WHERE …)', r'\bfilter\s*\(\s*where\b'),
    ('OVER (…)', r'\bover\s*\('),
    ('WITH (a CTE)', r'(?:^|;)\s*with\s+(?:recursive\s+)?[a-z_][a-z0-9_]*\s*(?:\([^)]*\))?\s+as\s*(?:materialized\s+|not\s+materialized\s+)?\('),
    ('CASE', r'\bcase\b'),
    ('coalesce()', r'\bcoalesce\s*\('),
    ('nullif()', r'\bnullif\s*\('),
    ('greatest()/least()', r'\b(?:greatest|least)\s*\('),
    ('CAST(… AS …)', r'\bcast\s*\('),
    ('EXTRACT(… FROM …)', r'\bextract\s*\('),
    ('INTERVAL', r'\binterval\b'),
    ('AT TIME ZONE', r'\bat\s+time\s+zone\b'),
    ('OFFSET', r'\boffset\b'),
    ('FETCH FIRST', r'\bfetch\s+(?:first|next)\b'),
    ('DISTINCT ON', r'\bdistinct\s+on\b'),
    ('IS DISTINCT FROM', r'\bis\s+(?:not\s+)?distinct\s+from\b'),
    ('NULLS FIRST/LAST', r'\bnulls\s+(?:first|last)\b'),
    ('LATERAL', r'\blateral\b'),
    ('UNION/EXCEPT/INTERSECT', r'\b(?:union|except|intersect)\b'),
    ('EXISTS', r'\bexists\s*\('),
    ('ANY/ALL (…)', r'\b(?:any|all)\s*\('),
    ('ILIKE', r'\bilike\b'),
    ('RETURNING', r'\breturning\b'),
    ('ON CONFLICT', r'\bon\s+conflict\b'),
    ('ROWS/RANGE BETWEEN', r'\b(?:rows|range|groups)\s+between\b'),
    ('ROLLUP/CUBE/GROUPING SETS', r'\b(?:rollup|cube|grouping\s+sets)\b'),
    ('INCLUDE (…)', r'\binclude\s*\('),
    ('a partial index (CREATE INDEX … WHERE)', r'\bcreate\s+(?:unique\s+)?index\b[^;]*\bwhere\b'),
]

# Spellings of one type, so `::int` taught covers `::integer` asked.
TYPE_ALIASES = {
    'integer': 'int', 'int4': 'int', 'int8': 'bigint', 'int2': 'smallint',
    'float8': 'double precision', 'float4': 'real', 'float': 'double precision',
    'decimal': 'numeric', 'varchar': 'text', 'character varying': 'text',
    'timestamp with time zone': 'timestamptz', 'timestamp without time zone': 'timestamp',
    'bool': 'boolean',
}


def catalog():
    """Function names and type names, from the server."""
    procs = subprocess.run(PSQL + ['-c', 'SELECT DISTINCT proname FROM pg_proc'], capture_output=True, text=True, check=True).stdout.split()
    types = subprocess.run(PSQL + ['-c', 'SELECT DISTINCT typname FROM pg_type'], capture_output=True, text=True, check=True).stdout.split()
    return set(procs), set(types) | {'int', 'integer', 'decimal', 'varchar', 'char', 'character', 'double', 'timestamp', 'timestamptz', 'time', 'interval', 'date', 'numeric', 'text', 'boolean'}


def strip(sql):
    """Comments and string literals out, lower case: what is left is the code's own words."""
    sql = re.sub(r'--[^\n]*', ' ', sql)
    sql = re.sub(r"'(?:[^']|'')*'", "''", sql)
    return sql.lower()


def constructs(sql, procs, types):
    s = strip(sql)
    found = set()
    for m in re.finditer(r'(?<![\w.])([a-z_][a-z0-9_]*)\s*\(', s):
        name = m.group(1)
        if name in procs and name not in types and name not in {'filter', 'over', 'exists', 'any', 'all', 'coalesce', 'nullif', 'greatest', 'least', 'cast', 'extract', 'values', 'in', 'row'}:
            found.add(f'{name}()')
    for m in re.finditer(r'::\s*([a-z_][a-z0-9_]*(?:\s+(?:with|without)\s+time\s+zone|\s+precision|\s+varying)?)', s):
        t = re.sub(r'\s+', ' ', m.group(1))
        found.add(f'::{TYPE_ALIASES.get(t, t)}')
    for label, rx in WATCHED:
        if re.search(rx, s):
            found.add(label)
    return found


def code_in(md):
    """The SQL in a markdown text: sql (or unlabelled) fences and inline code spans, one per
    snippet. Output blocks (```text) are left out: an error message quoting half a string
    would otherwise swallow the code after it."""
    out = [m.group(2) for m in re.finditer(r'```([^\n]*)\n(.*?)```', md or '', re.S) if m.group(1).split(' ')[0] in ('sql', '')]
    rest = re.sub(r'```[^\n]*\n.*?```', ' ', md or '', flags=re.S)
    out += re.findall(r'`([^`\n]+)`', rest)
    return out


def all_constructs(snippets, procs, types):
    found = set()
    for snip in snippets:
        found |= constructs(snip, procs, types)
    return found


def parts_of(day):
    """The day's theory as a list of (part number, markdown); one part when it is not split."""
    if day.get('parts'):
        return [(p['n'], p['markdown']) for p in day['parts']]
    return [(None, day.get('theoryMarkdown') or '')]


# --- Go ---------------------------------------------------------------------------
# The Go track starts from zero, so nothing is assumed: every package function, builtin
# and construct a card uses must have appeared in a lesson's code first.

GO_PKGS = {'fmt', 'os', 'errors', 'sync', 'strings', 'io', 'slices', 'atomic', 'time', 'math', 'sort',
           'bytes', 'strconv', 'bufio', 'net', 'http', 'context', 'runtime', 'unicode', 'maps', 'unsafe'}
GO_BUILTINS = {'append', 'cap', 'len', 'make', 'new', 'copy', 'delete', 'panic', 'recover', 'close', 'clear', 'min', 'max'}
GO_WATCHED = [
    ('defer', r'\bdefer\b'),
    ('go (a goroutine)', r'\bgo\s+(?:func\b|[\w.]+\()'),
    ('select', r'\bselect\s*\{'),
    ('chan', r'\bchan\b'),
    ('<- (send/receive)', r'<-'),
    ('goto', r'\bgoto\b'),
    ('switch', r'\bswitch\b'),
    ('interface type', r'\binterface\s*\{'),
    ('struct type', r'\bstruct\s*\{'),
    ('map type', r'\bmap\['),
    ('range', r'\brange\b'),
    ('const', r'\bconst\b'),
    ('iota', r'\biota\b'),
    ('method receiver', r'\bfunc\s+\(\s*\w+\s+\*?\w+\s*\)'),
    ('anonymous function', r'\bfunc\('),
    ('three-index slice', r'\[[^\[\]:]*:[^\[\]:]*:[^\[\]:]*\]'),
    ('... (variadic / spread)', r'\.\.\.'),
    ('%w (wrapping)', r'%w'),
]


def go_constructs(code):
    found = set()
    if '%w' in code:
        found.add('%w (wrapping)')
    s = re.sub(r'//[^\n]*', ' ', code)
    s = re.sub(r'`[^`]*`', '""', s)
    s = re.sub(r'"(?:[^"\\\n]|\\.)*"', '""', s)
    s = re.sub(r"'(?:[^'\\\n]|\\.)*'", "''", s)
    for m in re.finditer(r'(?<![\w.])([a-z][a-z0-9]*)\.([A-Z]\w*)', s):
        if m.group(1) in GO_PKGS:
            name = f'{m.group(1)}.{m.group(2)}'
            # Println without the newline is the same lesson, not a new one.
            found.add({'fmt.Print': 'fmt.Println'}.get(name, name))
    for m in re.finditer(r'(?<![\w.])([a-z]+)\s*\(', s):
        if m.group(1) in GO_BUILTINS:
            found.add(f'{m.group(1)}()')
    for label, rx in GO_WATCHED:
        if label != '%w (wrapping)' and re.search(rx, s):
            found.add(label)
    return found


def go_code_in(md):
    out = [m.group(2) for m in re.finditer(r'```([^\n]*)\n(.*?)```', md or '', re.S) if m.group(1).split(' ')[0] == 'go']
    rest = re.sub(r'```[^\n]*\n.*?```', ' ', md or '', flags=re.S)
    out += re.findall(r'`([^`\n]+)`', rest)
    return out


def check_go():
    path = os.path.join(ROOT, 'app/public/content/weeks/track-go.json')
    days = [d for d in json.load(open(path))['days'] if d.get('status') == 'available']
    taught_before, problems = set(), 0
    every = lambda xs: set().union(*[go_constructs(x) for x in xs]) if xs else set()
    for day in days:
        by_part, acc = {}, set(taught_before)
        for n, md in parts_of(day):
            acc |= every(go_code_in(md))
            by_part[n] = set(acc)
        taught = lambda part: by_part.get(part, acc) if part is not None else acc
        items = []
        for c in (day.get('write') or {}).get('challenges', []):
            items.append((f"write {c['id']}", c.get('part'), [c['solution']]))
        for c in ((day.get('practice') or {}).get('write') or {}).get('challenges', []):
            items.append((f"practice {c['id']}", c.get('part'), [c['solution']]))
        for kind, steps in (('drill', day.get('drill') or []), ('practice drill', (day.get('practice') or {}).get('drill') or [])):
            for st in steps:
                items.append((f"{kind} {st['id']}", st.get('part'), [st.get('code') or ''] + go_code_in(st['prompt']) + go_code_in(next((o['text'] for o in st['options'] if o['correct']), ''))))
        for q in day.get('quiz') or []:
            items.append((f"quiz {q['id']}", q.get('part'), go_code_in(q['prompt']) + go_code_in(next((o['text'] for o in q['options'] if o['correct']), ''))))
        for label, part, code in items:
            missing = sorted(every(code) - taught(part))
            if missing:
                problems += 1
                where = f' (part {part})' if part is not None else ''
                print(f"  FAIL  {day['id']}/{label}{where}: uses {', '.join(missing)}, not shown in any lesson up to here")
        taught_before = acc
    print(f'\nGo: {len(days)} day(s) checked, {problems} item(s) using something not yet taught')
    return problems


def main():
    if '--track' in sys.argv and sys.argv[sys.argv.index('--track') + 1] == 'go':
        sys.exit(1 if check_go() else 0)
    path = os.path.join(ROOT, 'app/public/content/weeks/track-sql.json')
    if not os.path.exists(path):
        sys.exit('No content found. Run: cd app && npm run content')
    procs, types = catalog()
    days = [d for d in json.load(open(path))['days'] if d.get('status') == 'available']
    taught_before = set(BASELINE)
    problems = 0
    for day in days:
        parts = parts_of(day)
        by_part = {}
        acc = set(taught_before)
        for n, md in parts:
            acc |= all_constructs(code_in(md), procs, types)
            by_part[n] = set(acc)
        whole = acc

        def taught(part):
            return by_part.get(part, whole) if part is not None else whole

        items = []
        for c in (day.get('write') or {}).get('challenges', []) if (day.get('write') or {}).get('lang', 'sql') == 'sql' else []:
            items.append((f"write {c['id']}", c.get('part'), [c['solution']]))
        pw = ((day.get('practice') or {}).get('write') or {})
        if pw.get('lang', 'sql') == 'sql':
            for c in pw.get('challenges', []):
                items.append((f"practice {c['id']}", c.get('part'), [c['solution']]))
        for kind, steps in (('drill', day.get('drill') or []), ('practice drill', (day.get('practice') or {}).get('drill') or [])):
            for s in steps:
                text = [s.get('code') or ''] + code_in(s['prompt']) + code_in(next((o['text'] for o in s['options'] if o['correct']), ''))
                items.append((f"{kind} {s['id']}", s.get('part'), text))
        for q in day.get('quiz') or []:
            text = code_in(q['prompt']) + code_in(next((o['text'] for o in q['options'] if o['correct']), ''))
            items.append((f"quiz {q['id']}", q.get('part'), text))

        for label, part, sql in items:
            missing = sorted(all_constructs(sql, procs, types) - taught(part))
            if missing:
                problems += 1
                where = f' (part {part})' if part is not None else ''
                print(f"  FAIL  {day['id']}/{label}{where}: uses {', '.join(missing)}, not shown in any lesson up to here")
        taught_before = whole
    print(f'\nSQL: {len(days)} day(s) checked, {problems} item(s) using something not yet taught')
    if '--track' not in sys.argv:
        problems += check_go()
    sys.exit(1 if problems else 0)


if __name__ == '__main__':
    main()
