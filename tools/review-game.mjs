#!/usr/bin/env node
/* One review sheet per new game, for approval before it goes live:
 * tile thumbnail, logo (emblem + lettering), social card and Pinterest pin.
 * Usage: node tools/review-game.mjs <slug>  ->  review/<slug>-assets.png */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const req = createRequire(import.meta.url);
const load = n => { for (const c of [n, '/opt/npm-tools/node_modules/' + n]) { try { return req(c); } catch { /* next */ } } throw new Error('missing ' + n); };
const { chromium } = load('playwright');
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const slug = process.argv[2];
if (!slug) { console.error('usage: node tools/review-game.mjs <slug>'); process.exit(1); }
const g = JSON.parse(fs.readFileSync(path.join(ROOT, 'games', slug, 'meta.json'), 'utf8'));
const uri = (p, mime) => `data:${mime};base64,${fs.readFileSync(path.join(ROOT, p)).toString('base64')}`;
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box}body{margin:0;width:1600px;height:1180px;background:#EEF0F6;color:#171A2B;font-family:Poppins,sans-serif;padding:40px 52px}
h1{margin:0;font-size:34px}.sub{margin:4px 0 26px;color:#5A6079;font-size:18px}
.top{display:grid;grid-template-columns:640px 1fr;gap:36px;align-items:start}
.tile img{width:640px;height:480px;border-radius:22px;display:block;box-shadow:0 18px 34px -16px rgba(23,26,43,.55)}
.tile b{display:block;margin-top:12px;font-size:21px}.tile span{color:#5A6079;font-size:16px}
.logo{display:grid;gap:14px}.logo .row{display:flex;align-items:center;gap:22px}
.logo .em{width:220px;height:220px}.logo .wm{width:540px}
.small{display:flex;gap:18px;align-items:center;color:#5A6079;font-size:15px}.small img{border-radius:12px;box-shadow:0 6px 14px -8px rgba(0,0,0,.5)}
.soc{display:grid;grid-template-columns:auto auto;gap:30px;margin-top:30px;align-items:start}
.soc img{display:block;border-radius:14px;box-shadow:0 18px 34px -16px rgba(23,26,43,.55)}
.soc p{margin:8px 0 0;color:#5A6079;font-size:15px}
</style></head><body>
<h1>${esc(g.title)}: thumbnails and logo</h1><p class="sub">What players will see on the site, in search and when the game is shared.</p>
<div class="top">
  <div class="tile"><img src="${uri(`public/${slug}/thumb-800.webp`, 'image/webp')}"><b>${esc(g.title)}</b><span>${esc(g.tagline)}</span></div>
  <div class="logo">
    <div class="row"><img class="em" src="${uri(`art/logos/${slug}-emblem.png`, 'image/png')}"><img class="wm" src="${uri(`art/logos/${slug}-wordmark.png`, 'image/png')}"></div>
    <div class="small"><img src="${uri(`public/${slug}/icon-96.webp`, 'image/webp')}" width="96" height="96"> Game page icon (96 px)
      <img src="${uri(`public/${slug}/thumb-400.webp`, 'image/webp')}" width="200" height="150"> Tile on a phone</div>
  </div>
</div>
<div class="soc">
  <div><img src="${uri(`public/${slug}/og.jpg`, 'image/jpeg')}" width="760"><p>Social card (Facebook, WhatsApp, X)</p></div>
  <div><img src="${uri(`public/${slug}/pin.jpg`, 'image/jpeg')}" height="420"><p>Pinterest pin</p></div>
</div>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1180 } });
await page.setContent(html, { waitUntil: 'load' });
fs.mkdirSync(path.join(ROOT, 'review'), { recursive: true });
await page.screenshot({ path: path.join(ROOT, 'review', `${slug}-assets.png`), fullPage: true });
await browser.close();
console.log(`review/${slug}-assets.png`);
