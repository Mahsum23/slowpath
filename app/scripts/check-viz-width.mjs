/**
 * check-viz-width.mjs — open every lesson page that has a visual, step through each visual,
 * and report any step whose frame scrolls sideways at phone width (390px). A visual whose
 * point is off-screen teaches nothing, and this is the only check that sees the rendering.
 *
 * Needs the dev server: npx vite --port 4188, then BASE=http://127.0.0.1:4188 node scripts/check-viz-width.mjs
 * Playwright: PLAYWRIGHT=<path to playwright's index.mjs> if it is not resolvable from here.
 */
import { readFileSync } from 'node:fs';
const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright');
const BASE = process.env.BASE ?? 'http://127.0.0.1:4188';
const content = new URL('../public/content/weeks/', import.meta.url).pathname;
const pages = [];
for (const [track, file] of [['sql', 'track-sql'], ['go', 'track-go'], ['cpp', 'track-cpp']]) {
  for (const d of JSON.parse(readFileSync(`${content}${file}.json`, 'utf8')).days) {
    if (d.parts) d.parts.forEach((p) => p.markdown.includes('```viz') && pages.push([track, file, d.id, p.n]));
    else if (d.theoryMarkdown?.includes('```viz')) pages.push([track, file, d.id, null]);
  }
}
const b = await chromium.launch();
const page = await (await b.newContext({ viewport: { width: 390, height: 860 } })).newPage();
await page.goto(`${BASE}/`); await page.waitForTimeout(9000);
let bad = 0, total = 0, lastTrack = null;
for (const [track, file, day, part] of pages) {
  if (track !== lastTrack) {
    await page.evaluate(async (t) => {
      const db = await new Promise((res) => { const r = indexedDB.open('cpp-lab'); r.onsuccess = () => res(r.result); });
      const get = (s, k) => new Promise((res) => { const q = db.transaction(s).objectStore(s).get(k); q.onsuccess = () => res(q.result); });
      const put = (s, v, k) => new Promise((res) => { const q = db.transaction(s, 'readwrite').objectStore(s).put(v, k); q.onsuccess = res; });
      const p = await get('kv', 'progress'); p.settings.track = t; await put('kv', p, 'progress');
    }, track);
    lastTrack = track;
  }
  await page.goto(`${BASE}/#/session/${file}/${day}/0${part ? '/' + part : ''}`); await page.reload(); await page.waitForTimeout(1500);
  const figs = page.locator('figure.viz');
  for (let f = 0; f < await figs.count(); f++) {
    const fig = figs.nth(f);
    const n = await fig.locator('.dot').count();
    for (let s = 0; s < n; s++) {
      total++;
      const over = await fig.locator('.frame').evaluate((el) => el.scrollWidth - el.clientWidth);
      if (over > 2) { bad++; console.log(`WIDE +${over}px  ${day} part ${part} "${await fig.locator('.title').innerText()}" step ${s + 1}`); }
      if (s < n - 1) { await fig.getByRole('button', { name: /^Next/ }).click(); await page.waitForTimeout(80); }
    }
  }
}
console.log(`${total} steps checked, ${bad} too wide`);
await b.close();
process.exit(bad ? 1 : 0);
