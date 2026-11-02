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
  if (p.endsWith('/')) p += 'index.html';
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
  const frame = page.frame({ url: /game\.html/ });
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
