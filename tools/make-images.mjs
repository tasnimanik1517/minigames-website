#!/usr/bin/env node
/* Renders cover art and derives every image the site needs:
 *   public/<slug>/thumb-{400,800}.{webp,avif}   tiles (4:3)
 *   public/<slug>/icon-96.webp                   square icon on the game page
 *   public/<slug>/og.jpg                         1200x630 social card (Facebook, X, WhatsApp)
 *   public/<slug>/pin.jpg                        1000x1500 Pinterest pin
 *   public/og-default.jpg, favicon.ico, icon.svg, apple-touch-icon.png, icon-192.png, icon-512.png
 *   review/thumbnails.png                        contact sheet for approval
 * Usage: node tools/make-images.mjs [slug ...] */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { covers } from './covers.mjs';

const req = createRequire(import.meta.url);
const load = n => { for (const c of [n, '/opt/npm-tools/node_modules/' + n]) { try { return req(c); } catch { /* next */ } } throw new Error('Missing dependency: ' + n); };
const sharp = load('sharp');
const { chromium } = load('playwright');

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PUB = path.join(ROOT, 'public');
const ART = path.join(ROOT, 'art');
const only = process.argv.slice(2);
const metas = Object.fromEntries(fs.readdirSync(path.join(ROOT, 'games')).filter(d => fs.existsSync(path.join(ROOT, 'games', d, 'meta.json')))
  .map(d => [d, JSON.parse(fs.readFileSync(path.join(ROOT, 'games', d, 'meta.json'), 'utf8'))]));

const LOGO = (brand = '#E8481C', accent = '#FFC22E') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="9" fill="${brand}"/><rect x="6.5" y="6.5" width="8.5" height="8.5" rx="2.6" fill="#fff"/><rect x="17" y="6.5" width="8.5" height="8.5" rx="2.6" fill="#fff" fill-opacity=".6"/><rect x="6.5" y="17" width="8.5" height="8.5" rx="2.6" fill="#fff" fill-opacity=".6"/><path d="M18.4 18.2v6.6a.9.9 0 0 0 1.35.78l5.5-3.3a.9.9 0 0 0 0-1.56l-5.5-3.3a.9.9 0 0 0-1.35.78Z" fill="${accent}"/></svg>`;
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
function shade(hex, f) { // f<0 darker, f>0 lighter
  const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const t = f < 0 ? 0 : 255, p = Math.abs(f);
  r = Math.round((t - r) * p + r); g = Math.round((t - g) * p + g); b = Math.round((t - b) * p + b);
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

const browser = await chromium.launch();
const ctxPage = await browser.newPage({ viewport: { width: 1600, height: 1200 }, deviceScaleFactor: 1 });
async function shot(html, w, h, type = 'png') {
  await ctxPage.setViewportSize({ width: w, height: h });
  if (typeof html === 'object') { // still frame from the real game: capture its canvas, fill the 4:3 cover
    await ctxPage.setContent(html.html, { waitUntil: 'load' });
    await ctxPage.waitForSelector('html[data-ready="1"]', { timeout: 15000 });
    await ctxPage.waitForTimeout(150);
    const buf = html.selector === 'body'
      ? await ctxPage.screenshot({ type: 'png', clip: { x: 0, y: 0, width: w, height: h } })
      : await ctxPage.locator(html.selector).first().screenshot({ type: 'png' });
    return sharp(buf).resize(w, h, { fit: 'cover' }).png().toBuffer();
  }
  await ctxPage.setContent(html, { waitUntil: 'load' });
  await ctxPage.evaluate(() => document.fonts.ready);
  return ctxPage.screenshot({ type, clip: { x: 0, y: 0, width: w, height: h }, quality: type === 'jpeg' ? 90 : undefined });
}
const dataUri = (buf, mime = 'image/png') => `data:${mime};base64,${buf.toString('base64')}`;

fs.mkdirSync(ART, { recursive: true });
const slugs = Object.keys(covers).filter(s => metas[s] && (!only.length || only.includes(s)));
for (const slug of slugs) {
  const g = metas[slug];
  const dir = path.join(PUB, slug); fs.mkdirSync(dir, { recursive: true });
  const cover = await shot(covers[slug](), 1600, 1200);
  fs.writeFileSync(path.join(ART, slug + '.png'), cover);
  for (const w of [400, 800]) {
    const h = w * 3 / 4;
    await sharp(cover).resize(w, h).webp({ quality: 80, effort: 6 }).toFile(path.join(dir, `thumb-${w}.webp`));
    await sharp(cover).resize(w, h).avif({ quality: 52, effort: 6 }).toFile(path.join(dir, `thumb-${w}.avif`));
  }
  // icon-96.webp and logo.webp come from the game's logo (tools/logos.mjs)

  const dark = shade(g.color, -0.55), mid = shade(g.color, -0.25);
  const og = await shot(`<!doctype html><html><head><style>
    *{box-sizing:border-box}body{margin:0;width:1200px;height:630px;overflow:hidden;font-family:Poppins,sans-serif;background:${dark};color:#fff}
    .art{position:absolute;right:0;top:0;width:840px;height:630px;background:url(${dataUri(cover)}) center/cover}
    .fade{position:absolute;left:300px;top:0;width:300px;height:630px;background:linear-gradient(90deg,${dark},transparent)}
    .panel{position:absolute;left:0;top:0;width:520px;height:630px;padding:54px 0 54px 60px;display:flex;flex-direction:column}
    .brand{display:flex;align-items:center;gap:14px;font-weight:700;font-size:26px}.brand img{width:46px;height:46px}
    h1{font-size:${g.title.length > 22 ? 58 : 76}px;line-height:1.02;margin:auto 0 16px;letter-spacing:-1.5px;text-shadow:0 4px 18px rgba(0,0,0,.3)}
    p{font-size:27px;line-height:1.3;margin:0 0 30px;color:rgba(255,255,255,.86);max-width:430px}
    .pill{align-self:flex-start;background:#FFC22E;color:#2b1d00;font-weight:700;font-size:24px;padding:12px 26px;border-radius:999px}
  </style></head><body><div class="art"></div><div class="fade"></div><div class="panel">
    <div class="brand"><img src="${dataUri(Buffer.from(LOGO()), 'image/svg+xml')}">MiniGames.website</div>
    <h1>${esc(g.title)}</h1><p>${esc(g.tagline)}</p><span class="pill">Play free · no download</span></div></body></html>`, 1200, 630, 'jpeg');
  await sharp(og).jpeg({ quality: 84, mozjpeg: true }).toFile(path.join(dir, 'og.jpg'));

  const pin = await shot(`<!doctype html><html><head><style>
    *{box-sizing:border-box}body{margin:0;width:1000px;height:1500px;overflow:hidden;font-family:Poppins,sans-serif;color:#fff;
      background:radial-gradient(120% 80% at 50% 100%,${mid},${dark})}
    .art{width:1000px;height:750px;background:url(${dataUri(cover)}) center/cover;border-bottom:10px solid #FFC22E}
    .txt{padding:58px 70px 0;display:flex;flex-direction:column;gap:22px;height:740px}
    h1{font-size:${g.title.length > 22 ? 86 : 112}px;line-height:1;margin:0;letter-spacing:-2px}
    p{font-size:44px;line-height:1.25;margin:0;color:rgba(255,255,255,.9)}
    .pill{align-self:flex-start;background:#fff;color:${dark};font-weight:700;font-size:36px;padding:16px 34px;border-radius:999px;margin-top:10px}
    .brand{margin-top:auto;margin-bottom:64px;display:flex;align-items:center;gap:18px;font-weight:700;font-size:40px}.brand img{width:66px;height:66px}
  </style></head><body><div class="art"></div><div class="txt"><h1>${esc(g.title)}</h1><p>${esc(g.tagline)}</p>
    <span class="pill">Play free in your browser</span>
    <div class="brand"><img src="${dataUri(Buffer.from(LOGO()), 'image/svg+xml')}">minigames.website</div></div></body></html>`, 1000, 1500, 'jpeg');
  await sharp(pin).jpeg({ quality: 84, mozjpeg: true }).toFile(path.join(dir, 'pin.jpg'));
  console.log('images:', slug);
}

/* site icons */
const logoSvg = LOGO();
fs.writeFileSync(path.join(PUB, 'icon.svg'), logoSvg);
await sharp(Buffer.from(logoSvg)).resize(180, 180).png().toFile(path.join(PUB, 'apple-touch-icon.png'));
await sharp(Buffer.from(logoSvg)).resize(192, 192).png().toFile(path.join(PUB, 'icon-192.png'));
const pad = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" fill="#E8481C"/>${logoSvg.replace('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">', '<svg x="4" y="4" width="32" height="32" viewBox="0 0 32 32">')}</svg>`;
await sharp(Buffer.from(pad)).resize(512, 512).png().toFile(path.join(PUB, 'icon-512.png'));
const png32 = await sharp(Buffer.from(logoSvg)).resize(32, 32).png().toBuffer();
const ico = Buffer.alloc(22); ico.writeUInt16LE(0, 0); ico.writeUInt16LE(1, 2); ico.writeUInt16LE(1, 4);
ico.writeUInt8(32, 6); ico.writeUInt8(32, 7); ico.writeUInt8(0, 8); ico.writeUInt8(0, 9); ico.writeUInt16LE(1, 10); ico.writeUInt16LE(32, 12);
ico.writeUInt32LE(png32.length, 14); ico.writeUInt32LE(22, 18);
fs.writeFileSync(path.join(PUB, 'favicon.ico'), Buffer.concat([ico, png32]));

/* default social card + review sheet */
const all = Object.keys(covers).filter(s => fs.existsSync(path.join(ART, s + '.png')));
const arts = all.map(s => dataUri(fs.readFileSync(path.join(ART, s + '.png'))));
// public/og-default.jpg (site thumbnail) is made by tools/logos.mjs

fs.mkdirSync(path.join(ROOT, 'review'), { recursive: true });
const sheet = await shot(`<!doctype html><html><head><style>
  *{box-sizing:border-box}body{margin:0;width:1600px;height:1140px;background:#F3F4F8;font-family:Poppins,sans-serif;color:#171A2B;padding:48px 56px}
  h1{margin:0 0 6px;font-size:34px}.sub{margin:0 0 30px;color:#5A6079;font-size:19px}
  .row{display:grid;grid-template-columns:repeat(${Math.max(all.length, 3)},1fr);gap:24px}
  .t img{width:100%;aspect-ratio:4/3;border-radius:20px;display:block;box-shadow:0 14px 30px -14px rgba(23,26,43,.5)}
  .t b{display:block;margin-top:12px;font-size:19px}.t span{color:#5A6079;font-size:15px}
  .soc{display:grid;grid-template-columns:2fr 1fr 1fr;gap:24px;margin-top:40px;align-items:start}
  .soc img{width:100%;border-radius:14px;display:block;box-shadow:0 14px 30px -14px rgba(23,26,43,.5)}
  .soc p{margin:10px 0 0;color:#5A6079;font-size:15px}
</style></head><body><h1>Thumbnail review</h1><p class="sub">Each game has its own art style. Below: tiles as they appear on the site, then a Facebook/WhatsApp card and Pinterest pins.</p>
<div class="row">${all.map(s => `<div class="t"><img src="${dataUri(fs.readFileSync(path.join(PUB, s, 'thumb-800.webp')), 'image/webp')}"><b>${esc(metas[s].shortTitle || metas[s].title)}</b><span>${esc(metas[s].tagline)}</span></div>`).join('')}</div>
<div class="soc"><div><img src="${dataUri(fs.readFileSync(path.join(PUB, all[0], 'og.jpg')), 'image/jpeg')}"><p>Social card (1200×630) for links shared on Facebook, WhatsApp, X</p></div>
${all.slice(1, 3).map(s => `<div><img src="${dataUri(fs.readFileSync(path.join(PUB, s, 'pin.jpg')), 'image/jpeg')}" style="height:400px;width:auto"><p>Pinterest pin (1000×1500)</p></div>`).join('')}</div>
</body></html>`, 1600, 1140);
fs.writeFileSync(path.join(ROOT, 'review', 'thumbnails.png'), sheet);
await browser.close();
console.log('done: icons, review/thumbnails.png');
