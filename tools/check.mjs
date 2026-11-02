#!/usr/bin/env node
/* Smoke + performance checks against a local static server for dist/.
 * - every page: no console errors, no failed requests, no horizontal overflow
 * - games: boot inside the frame and respond to input
 * - lab metrics on a throttled "mid-range phone on 4G" profile: FCP, LCP, CLS
 * - screenshots into review/ */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import zlib from 'node:zlib';
import { createRequire } from 'node:module';

const req = createRequire(import.meta.url);
const load = n => { for (const c of [n, '/opt/npm-tools/node_modules/' + n]) { try { return req(c); } catch { /* next */ } } throw new Error('missing ' + n); };
const { chromium, devices } = load('playwright');
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const DIST = path.join(ROOT, 'dist');
const REVIEW = path.join(ROOT, 'review');
fs.mkdirSync(REVIEW, { recursive: true });

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.avif': 'image/avif', '.jpg': 'image/jpeg', '.png': 'image/png', '.ico': 'image/x-icon', '.xml': 'application/xml', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain' };
const server = http.createServer((rq, rs) => {
  let p = decodeURIComponent(new URL(rq.url, 'http://x').pathname);
  // Same HTML handling as Cloudflare static assets: /x/game serves game.html, /x/game.html redirects to /x/game.
  if (p.endsWith('.html') && !p.endsWith('/404.html')) { rs.writeHead(307, { location: p.endsWith('/index.html') ? p.slice(0, -10) : p.slice(0, -5) }); rs.end(); return; }
  if (p.endsWith('/')) p += 'index.html';
  else if (!path.extname(p) && fs.existsSync(path.join(DIST, p + '.html'))) p += '.html';
  let f = path.join(DIST, p);
  if (!f.startsWith(DIST) || !fs.existsSync(f)) { rs.writeHead(404, { 'content-type': 'text/html' }); rs.end(fs.readFileSync(path.join(DIST, '404.html'))); return; }
  const body = fs.readFileSync(f);
  const ext = path.extname(f);
  const gz = /\.(html|js|css|json|svg|xml)$/.test(f) ? zlib.brotliCompressSync(body) : null;
  rs.writeHead(200, { 'content-type': TYPES[ext] || 'application/octet-stream', ...(gz ? { 'content-encoding': 'br' } : {}), 'cache-control': p.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache' });
  rs.end(gz || body);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = 'http://127.0.0.1:' + server.address().port;

const games = fs.readdirSync(path.join(ROOT, 'games')).filter(d => fs.existsSync(path.join(ROOT, 'games', d, 'meta.json')));
const pages = ['/', '/all-games/', '/board-games/', '/about/', '/privacy-policy/', '/missing-page/', ...games.map(g => `/${g}/`)];
const browser = await chromium.launch();
const problems = [];
const report = [];

async function audit(url, { mobile, shotName }) {
  const ctx = await browser.newContext(mobile ? { ...devices['Pixel 7'] } : { viewport: { width: 1366, height: 860 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push(String(e)));
  page.on('requestfailed', r => errs.push('failed: ' + r.url()));
  page.on('response', r => { if (r.status() >= 400 && !url.includes('missing')) errs.push(r.status() + ' ' + r.url()); });
  const cdp = await ctx.newCDPSession(page);
  if (mobile) {
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6 * 1024 * 1024 / 8, uploadThroughput: 750 * 1024 / 8 });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  }
  await page.addInitScript(() => {
    window.__lcp = 0; window.__cls = 0;
    new PerformanceObserver(l => { for (const e of l.getEntries()) window.__lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
  });
  const t0 = Date.now();
  await page.goto(BASE + url, { waitUntil: 'load' });
  await page.waitForTimeout(900);
  const m = await page.evaluate(() => ({
    fcp: Math.round((performance.getEntriesByName('first-contentful-paint')[0] || {}).startTime || 0),
    lcp: Math.round(window.__lcp), cls: +window.__cls.toFixed(3),
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    title: document.title, h1: (document.querySelector('h1') || {}).textContent,
    transfer: performance.getEntriesByType('resource').reduce((a, r) => a + (r.transferSize || 0), 0) + (performance.getEntriesByType('navigation')[0].transferSize || 0),
  }));
  if (shotName) await page.screenshot({ path: path.join(REVIEW, shotName), fullPage: false });
  await ctx.close();
  if (errs.length) problems.push(`${url} (${mobile ? 'mobile' : 'desktop'}): ${errs.join(' | ')}`);
  if (m.overflow) problems.push(`${url} (${mobile ? 'mobile' : 'desktop'}): horizontal overflow`);
  report.push({ url, dev: mobile ? 'mobile' : 'desktop', ...m, ms: Date.now() - t0 });
}

for (const u of pages) {
  const name = u === '/' ? 'home' : u.replace(/\//g, '');
  await audit(u, { mobile: true, shotName: ['home', 'snake', 'tic-tac-toe', 'rock-paper-scissors'].includes(name) ? `m-${name}.png` : null });
  await audit(u, { mobile: false, shotName: ['home', 'snake', 'tic-tac-toe', 'rock-paper-scissors'].includes(name) ? `d-${name}.png` : null });
}

/* gameplay checks inside the frame */
async function play(slug, fn) {
  const ctx = await browser.newContext({ ...devices['Pixel 7'] });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(`${BASE}/${slug}/`, { waitUntil: 'load' });
  const frame = page.frame({ url: /\/game(\.html)?$/ });
  await frame.waitForSelector('#game .mg-root');
  const result = await fn(frame, page);
  await page.screenshot({ path: path.join(REVIEW, `play-${slug}.png`) });
  await ctx.close();
  if (errs.length) problems.push(`${slug} gameplay: ${errs.join(' | ')}`);
  return result;
}
const plays = {};
plays.snake = await play('snake', async (f) => {
  await f.click('.mg-overlay .mg-btn');
  await f.waitForTimeout(400);
  await f.press('body', 'ArrowUp'); await f.waitForTimeout(500); await f.press('body', 'ArrowLeft');
  await f.waitForTimeout(3500);
  return await f.evaluate(() => ({ score: document.querySelector('.mg-pill b').textContent, overlay: !document.querySelector('.mg-overlay').hidden, title: (document.querySelector('.mg-overlay .mg-title') || {}).textContent }));
});
plays['tic-tac-toe'] = await play('tic-tac-toe', async (f) => {
  await f.click('.ttt-cell[data-i="4"]');
  await f.waitForTimeout(1200);
  const marks = await f.$$eval('.ttt-cell', cs => cs.map(c => c.getAttribute('data-v') || '.').join(''));
  return { marks, status: await f.textContent('.ttt-status') };
});
plays['rock-paper-scissors'] = await play('rock-paper-scissors', async (f) => {
  for (const k of ['r', 'p', 's', 'r']) { await f.press('body', k); await f.waitForTimeout(700); }
  const out = { result: await f.textContent('.rps-result'), detail: await f.textContent('.rps-detail'), history: await f.$$eval('.rps-history li', l => l.length) };
  await f.click('.mg-chip'); await f.waitForTimeout(200);
  out.optionGroups = await f.$$eval('.mg-overlay .mg-seg', x => x.length);
  return out;
});
plays['2048'] = await play('2048', async (f) => {
  const count = () => f.$$eval('.t48-tile:not(.is-gone)', l => l.length);
  const start = await count();
  for (const k of ['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'ArrowLeft', 'ArrowDown']) { await f.press('body', k); await f.waitForTimeout(170); }
  const out = { start, after: await count(), score: await f.textContent('.t48-score b') };
  await f.click('.t48-undo'); await f.waitForTimeout(200);
  out.undoLeft = await f.textContent('.t48-count');
  out.overlap = await f.evaluate(() => { const seen = {}; let dup = 0; document.querySelectorAll('.t48-tile:not(.is-gone)').forEach(t => { const k = t.style.getPropertyValue('--x') + ',' + t.style.getPropertyValue('--y'); if (seen[k]) dup++; seen[k] = 1; }); return dup; });
  return out;
});
plays['block-puzzle'] = await play('block-puzzle', async (f) => {
  const filled = () => f.$$eval('.bp-cell.f', l => l.length);
  const out = { start: await filled() };
  // touch: drag the first piece onto the empty board with a finger (the piece floats above the fingertip)
  const slot = await f.$('.bp-slot:not(.is-empty)'), sb = await slot.boundingBox(), bb = await (await f.$('.bp-board')).boundingBox();
  const cdp = await f.page().context().newCDPSession(f.page());
  const sx = sb.x + sb.width / 2, sy = sb.y + sb.height / 2, tx = bb.x + bb.width * 0.5, ty = bb.y + bb.height * 0.5 + 80;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: sx, y: sy }] });
  for (let i = 1; i <= 8; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: sx + (tx - sx) * i / 8, y: sy + (ty - sy) * i / 8 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await f.waitForTimeout(450);
  out.afterTouchDrag = await filled();
  // keyboard: choose a piece, move the outline, place it
  for (const k of ['2', 'Enter', '3', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'Enter']) { await f.press('body', k); await f.waitForTimeout(60); }
  await f.waitForTimeout(400);
  out.afterKeys = await filled(); out.score = await f.textContent('.bp-score b'); out.tray = await f.$$eval('.bp-slot:not(.is-empty)', l => l.length);
  return out;
});
plays['ball-sort'] = await play('ball-sort', async (f) => {
  const tops = () => f.$$eval('.bs-tube', l => l.map(t => t.querySelectorAll('.bs-ball').length).join(''));
  const start = await tops();
  // ask for a hint, then play the hinted move by tapping both tubes
  await f.click('.bs-tool'); await f.waitForTimeout(150);
  const from = await f.$eval('.bs-tube.hint-from', el => +el.dataset.i).catch(() => -1), to = await f.$eval('.bs-tube.hint-to', el => +el.dataset.i).catch(() => -1);
  if (from >= 0) { await f.click(`.bs-tube[data-i="${from}"]`); await f.waitForTimeout(120); await f.click(`.bs-tube[data-i="${to}"]`); await f.waitForTimeout(600); }
  const out = { start, hint: [from, to], after: await tops(), moves: await f.textContent('.mg-hud .mg-pill:nth-child(2) b') };
  await f.press('body', 'u'); await f.waitForTimeout(600);
  out.afterUndo = await tops();
  return out;
});
plays['memory-match'] = await play('memory-match', async (f) => {
  // look at the cards two at a time, then turn over the first pair we have seen
  const n = await f.$$eval('.mm-card', l => l.length), seen = {};
  for (let i = 0; i + 1 < n; i += 2) {
    for (const k of [i, i + 1]) { await f.click(`.mm-card[data-i="${k}"]`); await f.waitForTimeout(60); seen[k] = await f.$eval(`.mm-card[data-i="${k}"] .mm-pic`, e => e.textContent); }
    await f.waitForTimeout(1050);
    const byPic = {}; let pair = null;
    for (const [k, p] of Object.entries(seen)) { if (byPic[p] !== undefined) { pair = [byPic[p], +k]; break; } byPic[p] = +k; }
    if (pair && (await f.$$eval('.mm-card.is-done', l => l.length)) === 0) {
      for (const k of pair) { await f.click(`.mm-card[data-i="${k}"]`); await f.waitForTimeout(80); }
      await f.waitForTimeout(600); break;
    }
  }
  return { cards: n, matched: await f.$$eval('.mm-card.is-done', l => l.length), moves: await f.textContent('.mm-p1 b') };
});
plays['fruit-merge'] = await play('fruit-merge', async (f) => {
  // drop eight fruits at a few positions with the keyboard and let them settle
  for (let i = 0; i < 8; i++) { await f.press('body', i % 2 ? 'ArrowLeft' : 'ArrowRight'); await f.press('body', 'Space'); await f.waitForTimeout(520); }
  await f.waitForTimeout(1200);
  const s = await f.evaluate(() => JSON.parse(localStorage.getItem('mg:fruit-merge:state') || 'null'));
  return { fruits: s && s.fruits.length, score: await f.textContent('.fm-score b'), overlay: await f.$eval('.mg-overlay', e => !e.hidden) };
});
plays['alchemy-lab'] = await play('alchemy-lab', async (f) => {
  const page = f.page(), cdp = await page.context().newCDPSession(page);
  const count = () => f.textContent('.al-count b');
  const table = () => f.$$eval('.al-item', l => l.map(e => e.querySelector('.al-name').textContent).join(','));
  async function finger(a, z, lift) { // drag with a finger from box a to box z
    const sx = a.x + a.width / 2, sy = a.y + a.height / 2, tx = z.x + z.width / 2, ty = z.y + z.height / 2 + lift;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: sx, y: sy }] });
    for (let i = 1; i <= 10; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: sx + (tx - sx) * i / 10, y: sy + (ty - sy) * i / 10 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await f.waitForTimeout(450);
  }
  const itemBox = async n => { for (const e of await f.$$('.al-item')) if ((await e.$eval('.al-name', x => x.textContent)) === n) return e.boundingBox(); };
  const out = { start: await count(), table: await table() };
  // tap two list elements: the first lands on the table picked, the second mixes with it
  await f.tap('.al-chip[data-name="Water"]'); await f.waitForTimeout(150);
  await f.tap('.al-chip[data-name="Fire"]'); await f.waitForTimeout(400);
  out.taps = [await count(), await f.textContent('.al-banner')];
  // finger drag: Earth from the list onto Water on the table (the dragged element floats above the finger)
  await finger(await (await f.$('.al-chip[data-name="Earth"]')).boundingBox(), await itemBox('Water'), 36);
  out.chipDrag = [await count(), await table()];
  // finger drag on the table: Fire onto Mud makes brick
  await finger(await itemBox('Fire'), await itemBox('Mud'), 0);
  out.itemDrag = [await count(), await table()];
  await f.tap('.al-btn[aria-label="Hint"]'); await f.waitForTimeout(150);
  out.hint = await f.$$eval('.al-chip.is-hinted', l => l.length);
  out.saved = await f.evaluate(() => JSON.parse(localStorage.getItem('mg:alchemy-lab:found')).length);
  return out;
});
plays['typing-speed-test'] = await play('typing-speed-test', async (f) => {
  const page = f.page();
  // pick the 15 second test, then type the words shown (one with a wrong letter) until the clock runs out
  await f.tap('.mg-chip'); await f.waitForTimeout(150);
  await f.tap('.mg-overlay .mg-seg button:has-text("15 s")'); await f.waitForTimeout(100);
  await f.tap('.mg-overlay .mg-btn'); await f.waitForTimeout(150);
  await f.tap('.ty-box'); await f.waitForTimeout(100);
  const words = await f.$$eval('.ty-w', l => l.map(w => w.textContent)), t0 = Date.now();
  for (let i = 0; i < words.length && Date.now() - t0 < 17000; i++) {
    await page.keyboard.type((i === 2 ? words[i] + 'x' : words[i]) + ' ', { delay: 80 });
    if (await f.$('.ty-card')) break;
  }
  await f.waitForSelector('.ty-card', { timeout: 6000 }); await f.waitForTimeout(900);
  return { wpm: await f.textContent('.ty-wpm'), badge: await f.textContent('.ty-rank b'), accuracy: await f.textContent('.ty-facts b'),
    missed: await f.$$eval('.ty-trouble kbd', l => l.map(k => k.textContent)), saved: await f.evaluate(() => localStorage.getItem('mg:typing-speed-test:best')) };
});
plays['reaction-time-test'] = await play('reaction-time-test', async (f) => {
  // a jump start first, then five tries: wait for green and tap
  await f.tap('.rt-panel'); await f.waitForTimeout(300); await f.tap('.rt-panel'); await f.waitForTimeout(100);
  const out = { early: await f.textContent('.rt-title') };
  for (let i = 0; i < 5; i++) {
    await f.tap('.rt-panel');
    await f.waitForSelector('.rt-panel.is-go', { timeout: 8000 });
    await f.waitForTimeout(150); await f.tap('.rt-panel'); await f.waitForTimeout(100);
  }
  await f.waitForSelector('.rt-card', { timeout: 3000 });
  out.average = await f.textContent('.rt-score .mg-big'); out.badge = await f.textContent('.rt-card .mg-title');
  out.tries = await f.$$eval('.rt-list span', l => l.map(s => +s.textContent));
  return out;
});
plays['perfect-circle'] = await play('perfect-circle', async (f) => {
  // draw a slightly wobbly circle around the planet with a finger
  const page = f.page(), cdp = await page.context().newCDPSession(page);
  const b = await (await f.$('.ci-stage')).boundingBox(), cx = b.x + b.width / 2, cy = b.y + b.height * 0.56, R = Math.min(b.width, b.height) * 0.32;
  const at = th => ({ x: cx + Math.cos(th) * R * (1 + 0.02 * Math.sin(3 * th)), y: cy + Math.sin(th) * R * (1 + 0.02 * Math.sin(3 * th)) });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [at(0)] });
  for (let i = 1; i <= 90; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [at(i / 90 * 2 * Math.PI * 1.04)] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await f.waitForTimeout(300);
  return { head: await f.$eval('.ci-head', e => e.innerText.replace(/\n/g, ' / ')), best: await f.evaluate(() => localStorage.getItem('mg:perfect-circle:best')) };
});
/* page weight (compressed HTML) */
const weights = {};
for (const u of ['/', '/snake/', '/snake/game.html', '/tic-tac-toe/game.html', '/rock-paper-scissors/game.html']) {
  const f = path.join(DIST, u.endsWith('/') ? u + 'index.html' : u);
  weights[u] = (zlib.brotliCompressSync(fs.readFileSync(f)).length / 1024).toFixed(1) + ' KB br';
}
const jsFile = fs.readdirSync(path.join(DIST, 'assets'))[0];
weights['/assets/' + jsFile] = (zlib.brotliCompressSync(fs.readFileSync(path.join(DIST, 'assets', jsFile))).length / 1024).toFixed(1) + ' KB br';

await browser.close(); server.close();
console.log('\nLAB METRICS (mobile = Pixel 7, 4x CPU slowdown, ~1.6 Mbps, 150 ms latency)');
console.table(report.map(r => ({ url: r.url, dev: r.dev, FCP: r.fcp, LCP: r.lcp, CLS: r.cls, KB: (r.transfer / 1024).toFixed(0) })));
console.log('GAMEPLAY', JSON.stringify(plays, null, 1));
console.log('WEIGHTS', weights);
console.log(problems.length ? '\nPROBLEMS:\n- ' + problems.join('\n- ') : '\nNo console errors, failed requests or overflow.');
