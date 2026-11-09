#!/usr/bin/env node
/* MiniGames.website static build. Zero runtime dependencies; uses esbuild for minification when available.
 *   node build.mjs            -> dist/          (deploy this folder)
 *   node build.mjs --preview  -> dist-preview/  (relative links, opens without a server) */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { site, categories, categoryBySlug, staticPages } from './src/site.mjs';
import { env, esc } from './src/lib.mjs';
import * as T from './src/templates.mjs';

const PREVIEW = process.argv.includes('--preview');
env.preview = PREVIEW;
const ROOT = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.join(ROOT, PREVIEW ? 'dist-preview' : 'dist');
const rd = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

/* ---------- minifiers ---------- */
let esbuild = null;
const req = createRequire(import.meta.url);
for (const cand of ['esbuild', '/opt/npm-tools/node_modules/esbuild']) { try { esbuild = req(cand); break; } catch { /* try next */ } }
const minCss = css => esbuild
  ? esbuild.transformSync(css, { loader: 'css', minify: true, target: ['chrome100', 'safari15', 'firefox100'] }).code.trim()
  : css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').replace(/\s*([{};,>])\s*/g, '$1').replace(/;}/g, '}').trim();
const minJs = js => esbuild ? esbuild.transformSync(js, { loader: 'js', minify: true, target: 'es2017' }).code.trim() : js;
const hash = s => crypto.createHash('sha256').update(s).digest('hex').slice(0, 10);

/* ---------- output helpers ---------- */
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
function write(rel, content) {
  const file = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}
function page(urlPath, render) {
  env.current = urlPath;
  const html = render();
  write(urlPath.endsWith('/') ? urlPath + 'index.html' : urlPath, html);
}
function copyDir(src, dst) {
  if (!fs.existsSync(src)) return;
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) { fs.mkdirSync(d, { recursive: true }); copyDir(s, d); }
    else fs.copyFileSync(s, d);
  }
}

/* ---------- load + validate games ---------- */
// Release schedule: a game goes live on its "added" date, Bangladesh time. A daily GitHub Action
// (.github/workflows/daily-release.yml) pushes an empty commit on release days so Cloudflare rebuilds.
// `--all` (or MG_ALL=1, or a preview build) includes scheduled games too, for local testing.
const ALL = PREVIEW || process.argv.includes('--all') || process.env.MG_ALL === '1';
const TODAY = process.env.MG_TODAY || new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const errors = [];
const allGames = fs.readdirSync(path.join(ROOT, 'games'))
  .filter(d => fs.existsSync(path.join(ROOT, 'games', d, 'meta.json')))
  .map(d => {
    const g = JSON.parse(rd(`games/${d}/meta.json`));
    const need = ['slug', 'title', 'seoTitle', 'description', 'tagline', 'lede', 'sections', 'categories', 'engine', 'aspect', 'players', 'time', 'controls', 'added', 'updated', 'popularity', 'color'];
    for (const k of need) if (g[k] === undefined) errors.push(`${d}: missing "${k}"`);
    if (g.slug !== d) errors.push(`${d}: slug "${g.slug}" must match folder name`);
    for (const c of g.categories || []) if (!categoryBySlug[c]) errors.push(`${d}: unknown category "${c}"`);
    if ((g.description || '').length > 165) errors.push(`${d}: description is ${g.description.length} chars (keep under 165)`);
    if (!fs.existsSync(path.join(ROOT, 'engines', g.engine))) errors.push(`${d}: engine "${g.engine}" not found`);
    for (const img of ['thumb-400.webp', 'thumb-400.avif', 'thumb-800.webp', 'thumb-800.avif', 'og.jpg', 'pin.jpg', 'icon-96.webp']) {
      if (!fs.existsSync(path.join(ROOT, 'public', d, img))) errors.push(`${d}: missing image public/${d}/${img} (run: node tools/make-images.mjs)`);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(g.added || '')) errors.push(`${d}: "added" must be a YYYY-MM-DD date`);
    return g;
  });
if (errors.length) { console.error('Build failed:\n  ' + errors.join('\n  ')); process.exit(1); }
const games = allGames.filter(g => ALL || g.added <= TODAY);
const scheduled = allGames.filter(g => !games.includes(g)).sort((a, b) => a.added < b.added ? -1 : 1);

for (const c of categories) c.count = games.filter(g => g.categories.includes(c.slug)).length;
const related = {};
for (const g of games) {
  related[g.slug] = games.filter(o => o !== g)
    .map(o => ({ o, s: o.categories.filter(c => g.categories.includes(c)).length * 10 + o.popularity / 10 }))
    .sort((a, b) => b.s - a.s).map(x => x.o);
}

/* ---------- assets ---------- */
const css = minCss(rd('src/styles/site.css'));
const js = minJs(rd('src/scripts/site.js'));
const jsPath = `/assets/site.${hash(js)}.js`;
write(jsPath, js);
for (const e of fs.readdirSync(path.join(ROOT, 'public'), { withFileTypes: true })) { // images of scheduled games stay out until release day
  if (e.isDirectory() && scheduled.some(g => g.slug === e.name)) continue;
  const s = path.join(ROOT, 'public', e.name), d = path.join(OUT, e.name);
  if (e.isDirectory()) { fs.mkdirSync(d, { recursive: true }); copyDir(s, d); } else fs.copyFileSync(s, d);
}

function recentInline() {
  // Runs while the page is parsed, so the "Continue playing" row is in place before the first paint (no layout shift).
  const map = Object.fromEntries(games.map(g => [g.slug, [esc(g.shortTitle || g.title), g.color]]));
  const B = PREVIEW ? './' : '/', I = PREVIEW ? 'index.html' : '';
  return minJs(`(function(){try{var r=JSON.parse(localStorage.getItem('mg:recent')||'[]');if(!r.length)return;var G=${JSON.stringify(map)},h='',n=0;
r.forEach(function(s){var g=G[s];if(!g||n>=10)return;h+='<a class="tile" href="${B}'+s+'/${I}" style="--tc:'+g[1]+'"><span class="tile-media"><img src="${B}'+s+'/thumb-400.webp" width="400" height="300" alt="" decoding="async" loading="'+(n<3?'eager':'lazy')+'"></span><span class="tile-info"><span class="tile-title">'+g[0]+'</span></span></a>';n++});
if(h){document.getElementById('recent-row').innerHTML=h;document.getElementById('recent').hidden=false}}catch(e){}})();`);
}

const ctx = { games, css, assets: { js: jsPath }, related, recentInline: recentInline(),
  titles: Object.fromEntries(allGames.map(g => [g.slug, g.title])) };

/* ---------- pages ---------- */
page('/', () => T.pageHome(ctx));
page('/all-games/', () => T.pageAllGames(ctx));
for (const c of categories) if (c.count > 0) page(`/${c.slug}-games/`, () => T.pageCategory(ctx, c));

const sdkCss = rd('sdk/mg.css'), sdkJs = rd('sdk/mg.js');
const engineCache = {};
for (const g of games) {
  page(`/${g.slug}/`, () => T.pageGame(ctx, g));
  if (!engineCache[g.engine]) {
    const dir = `engines/${g.engine}/`;
    engineCache[g.engine] = {
      css: minCss(sdkCss + '\n' + rd(dir + g.engine + '.css')),
      js: minJs(sdkJs + '\n' + rd(dir + g.engine + '.js')),
    };
  }
  page(`/${g.slug}/game.html`, () => T.gameFrame(ctx, g, engineCache[g.engine]));
}

for (const slug of staticPages) {
  const raw = rd(`src/pages/${slug}.html`);
  const m = raw.match(/^<!--(\{[\s\S]*?\})-->\s*/);
  const meta = JSON.parse(m[1]);
  page(`/${slug}/`, () => {
    // links inside page bodies are written root-relative; adapt them for preview builds
    const body = raw.slice(m[0].length).replace(/href="(\/[^"]*)"/g, (_, p) => `href="${T.urlFor(p)}"`);
    return T.pageStatic(ctx, { slug, ...meta, body });
  });
}
page('/404.html', () => T.page404(ctx));

/* ---------- data + SEO files ---------- */
write('/games.json', JSON.stringify(games
  .sort((a, b) => b.popularity - a.popularity)
  .map(g => ({ slug: g.slug, title: g.title, cat: categoryBySlug[g.categories[0]].name, tags: g.categories.map(c => categoryBySlug[c].name), alt: (g.aka || []).join(' '), pop: g.popularity }))));

const today = new Date().toISOString().slice(0, 10);
const newest = games.map(g => g.updated).sort().pop() || today;
const urls = [
  { loc: '/', lastmod: newest },
  { loc: '/all-games/', lastmod: newest },
  ...categories.filter(c => c.count >= site.minIndexableCategory).map(c => ({ loc: `/${c.slug}-games/`, lastmod: newest })),
  ...games.map(g => ({ loc: `/${g.slug}/`, lastmod: g.updated, image: `/${g.slug}/thumb-800.webp`, title: g.title })),
  ...staticPages.map(s => ({ loc: `/${s}/`, lastmod: '2026-11-02' })),
];
write('/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls.map(x => `  <url><loc>${site.url}${x.loc}</loc><lastmod>${x.lastmod}</lastmod>${x.image ? `<image:image><image:loc>${site.url}${x.image}</image:loc></image:image>` : ''}</url>`).join('\n')}
</urlset>
`);
write('/robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${site.url}/sitemap.xml\n`);

// RSS feed: lets Pinterest (and any feed reader) pick up new games automatically.
const rssDate = d => new Date(d + 'T09:00:00Z').toUTCString();
write('/feed.xml', `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">
<channel>
<title>${esc(site.name)} – new games</title>
<link>${site.url}/</link>
<atom:link href="${site.url}/feed.xml" rel="self" type="application/rss+xml"/>
<description>New free mini games from ${esc(site.name)}. Play instantly on phone or computer.</description>
<language>en</language>
<lastBuildDate>${rssDate(newest)}</lastBuildDate>
${[...games].sort((a, b) => b.added.localeCompare(a.added)).map(g => `<item>
<title>${esc(g.title)} – ${esc(g.tagline)}</title>
<link>${site.url}/${g.slug}/</link>
<guid isPermaLink="true">${site.url}/${g.slug}/</guid>
<pubDate>${rssDate(g.added)}</pubDate>
<description>${esc(g.description)}</description>
<enclosure url="${site.url}/${g.slug}/pin.jpg" type="image/jpeg" length="${fs.statSync(path.join(ROOT, 'public', g.slug, 'pin.jpg')).size}"/>
<media:content url="${site.url}/${g.slug}/pin.jpg" medium="image" type="image/jpeg" width="1000" height="1500"/>
</item>`).join('\n')}
</channel>
</rss>
`);

write('/manifest.webmanifest', JSON.stringify({
  name: site.name, short_name: site.shortName, start_url: '/', display: 'standalone', background_color: '#F3F4F8', theme_color: '#E8481C',
  description: site.tagline,
  icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: '/icon-512.png', sizes: '512x512', type: 'image/png' }, { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }],
}, null, 2));

write('/_headers', `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
  X-Frame-Options: SAMEORIGIN

/assets/*
  Cache-Control: public, max-age=31536000, immutable

/*.avif
  Cache-Control: public, max-age=604800, stale-while-revalidate=86400

/*.webp
  Cache-Control: public, max-age=604800, stale-while-revalidate=86400

/*.jpg
  Cache-Control: public, max-age=604800, stale-while-revalidate=86400

/*.png
  Cache-Control: public, max-age=604800, stale-while-revalidate=86400

/*/game
  X-Robots-Tag: noindex
  Content-Security-Policy: frame-ancestors 'self'

/*/game.html
  X-Robots-Tag: noindex
  Content-Security-Policy: frame-ancestors 'self'

https://:version.:subdomain.workers.dev/*
  X-Robots-Tag: noindex

/games.json
  Cache-Control: public, max-age=300

/feed.xml
  Content-Type: application/rss+xml; charset=utf-8
`);

// Old image URLs (shared on social media / indexed by image search) keep working.
write('/_redirects', `# Old image URLs (shared on social media / indexed by image search) keep working.
/assets/rock-paper-scissors-lizard-spock.webp /rock-paper-scissors/thumb-800.webp 301
/snake/thumbnail.webp /snake/thumb-800.webp 301
/tic-tac-toe-4x4-4-in-a-row/thumbnail.webp /tic-tac-toe/thumb-800.webp 301
/rock-paper-scissors-lizard-spock/thumbnail.webp /rock-paper-scissors/thumb-800.webp 301
# Retired game variants: send visitors and search engines to the classic version.
/tic-tac-toe-4x4-4-in-a-row /tic-tac-toe/ 301
/tic-tac-toe-4x4-4-in-a-row/ /tic-tac-toe/ 301
/tic-tac-toe-4x4-4-in-a-row/* /tic-tac-toe/ 301
/rock-paper-scissors-lizard-spock /rock-paper-scissors/ 301
/rock-paper-scissors-lizard-spock/ /rock-paper-scissors/ 301
/rock-paper-scissors-lizard-spock/* /rock-paper-scissors/ 301
# Alchemy Lab retired 2026-11-10: its book lives on inside Endless Craft.
/alchemy-lab /endless-craft/ 301
/alchemy-lab/ /endless-craft/ 301
/alchemy-lab/* /endless-craft/ 301
# Old internal template page.
/game-template / 301
/game-template/ / 301
/game-template/* / 301
/index.html / 301
`);
if (site.adsenseClient) write('/ads.txt', `google.com, ${site.adsenseClient.replace('ca-', '')}, DIRECT, f08c47fec0942fa0\n`);

/* ---------- report ---------- */
let total = 0, files = 0;
(function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else { total += fs.statSync(p).size; files++; } } })(OUT);
console.log(`Built ${games.length} games, ${files} files, ${(total / 1024).toFixed(0)} KB -> ${path.relative(ROOT, OUT)}${esbuild ? '' : ' (no esbuild: JS not minified)'}`);
console.log(ALL ? `All ${allGames.length} games included (scheduled ones too).`
  : `Release date ${TODAY}: ${games.length} live, ${scheduled.length} scheduled${scheduled.length ? ` (next: ${scheduled[0].title} on ${scheduled[0].added})` : ''}.`);
