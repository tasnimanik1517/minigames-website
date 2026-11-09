import { site, categories, categoryBySlug } from './site.mjs';
import { esc, u, base, env, jsonld, fmtDate } from './lib.mjs';
export { u as urlFor } from './lib.mjs';

/* ------------------------------------------------------------------ icons */
const I = {
  search: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>',
  close: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  moon: '<svg class="i-moon" viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M20.5 14.6A8.5 8.5 0 0 1 9.4 3.5a8.5 8.5 0 1 0 11.1 11.1Z"/></svg>',
  sun: '<svg class="i-sun" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4.2" fill="currentColor"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/></svg>',
  expand: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
  share: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12M7.5 7.5 12 3l4.5 4.5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>',
  chevron: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>',
  bolt: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M13.5 2 4 13.5h6.5L9.5 22 20 9.5h-6.6L13.5 2Z"/></svg>',
  shield: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M12 2 4 5v6.5c0 5 3.4 9 8 10.5 4.6-1.5 8-5.5 8-10.5V5l-8-3Zm-1.2 13.6-3.5-3.5 1.4-1.4 2.1 2.1 4.6-4.6 1.4 1.4-6 6Z"/></svg>',
  phone: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M8 2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm0 3v13h8V5H8Zm4 14.2a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z"/></svg>',
  user: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Zm0 2c-4.4 0-8 2.2-8 5v2h16v-2c0-2.8-3.6-5-8-5Z"/></svg>',
};

export function logo() {
  return `<svg class="logo-mark" viewBox="0 0 32 32" width="32" height="32" aria-hidden="true">
<rect width="32" height="32" rx="9" fill="var(--brand)"/>
<rect x="6.5" y="6.5" width="8.5" height="8.5" rx="2.6" fill="#fff"/>
<rect x="17" y="6.5" width="8.5" height="8.5" rx="2.6" fill="#fff" fill-opacity=".6"/>
<rect x="6.5" y="17" width="8.5" height="8.5" rx="2.6" fill="#fff" fill-opacity=".6"/>
<path d="M18.4 18.2v6.6a.9.9 0 0 0 1.35.78l5.5-3.3a.9.9 0 0 0 0-1.56l-5.5-3.3a.9.9 0 0 0-1.35.78Z" fill="var(--accent)"/>
</svg><span class="logo-word">MiniGames<span>.website</span></span>`;
}

/* ------------------------------------------------------------------ head */
export function head(p) {
  const canonical = site.url + (p.path || '/');
  const og = p.ogImage || site.url + '/og-default.jpg';
  const robots = p.noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large';
  return `<!doctype html>
<html lang="${site.lang}"${env.preview ? ` data-base="${base()}" data-preview="1"` : ''}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(p.title)}</title>
<meta name="description" content="${esc(p.description)}">
<meta name="robots" content="${robots}">${p.noCanonical ? '' : `
<link rel="canonical" href="${canonical}">`}
<meta name="theme-color" content="#F3F4F8" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#10121C" media="(prefers-color-scheme: dark)">
<link rel="icon" href="${u('/favicon.ico')}" sizes="32x32">
<link rel="icon" href="${u('/icon.svg')}" type="image/svg+xml">
<link rel="apple-touch-icon" href="${u('/apple-touch-icon.png')}">
<link rel="manifest" href="${u('/manifest.webmanifest')}">
<meta property="og:site_name" content="${esc(site.name)}">
<meta property="og:type" content="${p.ogType || 'website'}">
<meta property="og:title" content="${esc(p.ogTitle || p.title)}">
<meta property="og:description" content="${esc(p.description)}">
${p.noCanonical ? '' : `<meta property="og:url" content="${canonical}">`}
<meta property="og:image" content="${og}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(p.ogAlt || p.ogTitle || p.title)}">
${p.published ? `<meta property="article:published_time" content="${p.published}">\n<meta property="article:modified_time" content="${p.modified || p.published}">\n` : ''}<meta name="twitter:card" content="summary_large_image">
<style>${p.css}</style>
${p.preload || ''}${env.preview ? '' : `<script type="speculationrules">{"prefetch":[{"where":{"and":[{"href_matches":"/*"},{"not":{"href_matches":"/cdn-cgi/*"}}]},"eagerness":"moderate"}]}</script>\n`}${(p.jsonld || []).map(jsonld).join('\n')}
</head>`;
}

/* ------------------------------------------------------------------ header / footer */
export function header({ cats = true, active = '' } = {}) {
  return `<a class="skip" href="#main">Skip to games</a>
<header class="site-header">
  <div class="wrap header-row">
    <a class="logo" href="${u('/')}" aria-label="${esc(site.name)} home">${logo()}</a>
    <form class="search" role="search" action="${u('/all-games/')}" method="get" autocomplete="off">
      <label class="sr" for="q">Search games</label>
      <span class="search-icon">${I.search}</span>
      <input id="q" name="q" type="search" placeholder="Search games" enterkeyhint="search" spellcheck="false" aria-controls="search-results" aria-expanded="false" aria-autocomplete="list">
      <button class="search-close icon-btn" type="button" aria-label="Close search">${I.close}</button>
      <div class="search-results" id="search-results" role="listbox" aria-label="Search results" hidden></div>
    </form>
    <div class="header-actions">
      <button class="icon-btn search-open" type="button" aria-label="Search games">${I.search}</button>
    </div>
  </div>
</header>
${cats ? catNav(active) : ''}`;
}

export function catNav(active) {
  const list = categories.filter(c => c.count >= site.minNavCategory || c.slug === active);
  return `<nav class="cats" aria-label="Game categories"><div class="wrap cats-row">
<a class="chip${active === 'home' ? ' is-active' : ''}" href="${u('/')}"${active === 'home' ? ' aria-current="page"' : ''}>All games</a>
${list.map(c => `<a class="chip${active === c.slug ? ' is-active' : ''}" href="${u('/' + c.slug + '-games/')}" style="--cc:${c.color}"${active === c.slug ? ' aria-current="page"' : ''}><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="${c.icon}"/></svg>${esc(c.name)}</a>`).join('\n')}
</div></nav>`;
}

export function footer() {
  const list = categories.filter(c => c.count >= site.minNavCategory);
  return `<footer class="site-footer">
  <div class="wrap footer-grid">
    <div class="footer-brand">
      <a class="logo" href="${u('/')}" aria-label="${esc(site.name)} home">${logo()}</a>
      <p>${esc(site.name)} is a free collection of mini games that load in seconds and work on phones, tablets and computers. No downloads, no sign-up and no pop-ups.</p>
    </div>
    <nav aria-label="Categories"><h2>Categories</h2><ul>${list.map(c => `<li><a href="${u('/' + c.slug + '-games/')}">${esc(c.name)} games</a></li>`).join('')}<li><a href="${u('/all-games/')}">All games</a></li></ul></nav>
    <nav aria-label="Site"><h2>${esc(site.shortName)}</h2><ul>
      <li><a href="${u('/about/')}">About</a></li>
      <li><a href="${u('/contact/')}">Contact</a></li>
      <li><a href="${u('/privacy-policy/')}">Privacy Policy</a></li>
      <li><a href="${u('/terms/')}">Terms of Use</a></li>
    </ul></nav>
  </div>
  <div class="wrap footer-base"><p>&copy; ${new Date().getUTCFullYear()} ${esc(site.name)}</p></div>
</footer>`;
}

/* ------------------------------------------------------------------ tiles */
function catLabel(g) { const c = categoryBySlug[g.categories[0]]; return c ? c.name : ''; }
function playersLabel(g) { return g.players === '1' ? '1 player' : g.players.replace('–', '–') + ' players'; }

export function picture(g, { sizes = '(min-width: 1280px) 200px, (min-width: 860px) 23vw, (min-width: 560px) 31vw, 46vw', eager = false, priority = false, cls = '' } = {}) {
  const b = '/' + g.slug + '/';
  return `<picture>
<source type="image/avif" srcset="${u(b + 'thumb-400.avif')} 400w, ${u(b + 'thumb-800.avif')} 800w" sizes="${sizes}">
<img${cls ? ` class="${cls}"` : ''} src="${u(b + 'thumb-400.webp')}" srcset="${u(b + 'thumb-400.webp')} 400w, ${u(b + 'thumb-800.webp')} 800w" sizes="${sizes}" width="400" height="300" alt="" ${eager ? 'loading="eager"' : 'loading="lazy"'} decoding="async"${priority ? ' fetchpriority="high"' : ''}>
</picture>`;
}

export function tile(g, { eager = false, priority = false, sizes } = {}) {
  const isNew = (Date.now() - Date.parse(g.added)) / 864e5 < 21;
  return `<a class="tile" href="${u('/' + g.slug + '/')}" style="--tc:${g.color}" data-title="${esc(g.title.toLowerCase())}" data-tags="${esc(g.categories.join(' '))}">
<span class="tile-media">${picture(g, { eager, priority, sizes })}${isNew ? '<span class="badge">New</span>' : ''}</span>
<span class="tile-info"><span class="tile-title">${esc(g.shortTitle || g.title)}</span><span class="tile-meta">${esc(catLabel(g))} · ${g.players === '1' ? '1P' : g.players + 'P'}</span></span>
</a>`;
}

/* With only a few games the grid uses fewer, bigger columns on wide screens (see .grid.max-N in site.css),
 * so the image sizes hint changes with it. */
const capSizes = {
  3: '(min-width: 1320px) 420px, (min-width: 560px) 31vw, 46vw',
  4: '(min-width: 1320px) 315px, (min-width: 860px) 23vw, (min-width: 560px) 31vw, 46vw',
  5: '(min-width: 1320px) 250px, (min-width: 1100px) 19vw, (min-width: 860px) 23vw, (min-width: 560px) 31vw, 46vw',
};
export function grid(list, { eagerCount = 4, label = '' } = {}) {
  const cap = list.length <= 5 ? Math.max(3, list.length) : 0;
  return `<div class="grid-wrap"><div class="grid${cap ? ' max-' + cap : ''}"${label ? ` aria-label="${esc(label)}"` : ''}>
${list.map((g, i) => tile(g, { eager: i < eagerCount, priority: i === 0, sizes: cap ? capSizes[cap] : undefined })).join('\n')}
</div></div>`;
}

export function adSlot(name) {
  if (!site.adsenseClient || !site.adSlots[name]) return '';
  return `<div class="ad-slot ad-${name}"><span class="ad-label">Advertisement</span><ins class="adsbygoogle" style="display:block" data-ad-client="${site.adsenseClient}" data-ad-slot="${site.adSlots[name]}" data-ad-format="auto" data-full-width-responsive="true"></ins></div>`;
}

/* One card per category for the homepage "Browse by category" section: the category's most
 * popular game provides the picture, the whole card links to the category page. */
export function catCard(c, games) {
  const top = games.filter(g => g.categories.includes(c.slug)).sort((a, b) => b.popularity - a.popularity)[0];
  return `<a class="cat-card" href="${u('/' + c.slug + '-games/')}" style="--cc:${c.color}">
<span class="cat-card-media">${picture(top, { sizes: '(min-width: 1280px) 300px, (min-width: 860px) 23vw, (min-width: 560px) 31vw, 46vw' })}</span>
<span class="cat-card-info"><span class="cat-card-name"><svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path fill="currentColor" d="${c.icon}"/></svg>${esc(c.name)} games</span><span class="cat-card-count">${c.count} games</span></span>
</a>`;
}

const trust = `<ul class="trust" aria-label="Why play here">
<li>${I.bolt}Loads in a second</li>
<li>${I.shield}No pop-ups</li>
<li>${I.user}No sign-up</li>
<li>${I.phone}Phone friendly</li>
</ul>`;

function scripts(ctx) {
  return `<script src="${u(ctx.assets.js)}" defer></script>
${site.adsenseClient ? `<script>window.MG_ADS=${JSON.stringify(site.adsenseClient)}</script>` : ''}`;
}

/* ------------------------------------------------------------------ pages */
export function pageHome(ctx) {
  const games = ctx.games;
  const popular = [...games].sort((a, b) => (b.featured - a.featured) || b.popularity - a.popularity);
  const fresh = [...games].sort((a, b) => b.added.localeCompare(a.added));
  const sectioned = games.length >= site.sectionedHomeAt;
  const catsWithGames = categories.filter(c => c.count >= 3);
  const first = popular[0];
  return `${head({
    css: ctx.css, path: '/',
    title: 'MiniGames.website – Free Mini Games Online, No Download',
    ogTitle: 'MiniGames.website – Free mini games, ready to play',
    description: `Play ${games.length >= 10 ? games.length + ' ' : ''}free mini games online at MiniGames.website: Snake, Tic Tac Toe, Rock Paper Scissors and more. Instant play on phone or computer, no download or sign-up.`,
    preload: `<link rel="preload" as="image" type="image/avif" imagesrcset="${u('/' + first.slug + '/thumb-400.avif')} 400w, ${u('/' + first.slug + '/thumb-800.avif')} 800w" imagesizes="(min-width: 1280px) 200px, (min-width: 860px) 23vw, (min-width: 560px) 31vw, 46vw" fetchpriority="high">\n`,
    jsonld: [
      { '@context': 'https://schema.org', '@type': 'WebSite', '@id': site.url + '/#website', name: site.name, alternateName: ['MiniGames', 'Mini Games Website', 'minigames.website'], url: site.url + '/', inLanguage: 'en', publisher: { '@id': site.url + '/#org' } },
      { '@context': 'https://schema.org', '@type': 'Organization', '@id': site.url + '/#org', name: site.name, url: site.url + '/', logo: { '@type': 'ImageObject', url: site.url + '/icon-512.png', width: 512, height: 512 } },
    ],
  })}
<body class="page-home">
${header({ active: 'home' })}
<main id="main">
  <section class="wrap home-intro">
    <h1>Free mini games, <span>ready to play</span></h1>
    ${trust}
  </section>
  <section class="wrap recent" id="recent" hidden aria-labelledby="recent-h">
    <div class="section-head"><h2 id="recent-h">Continue playing</h2></div>
    <div class="recent-row" id="recent-row"></div>
  </section>
  <script>${ctx.recentInline}</script>
  <section class="wrap" aria-labelledby="popular-h">
    <div class="section-head"><h2 id="popular-h">${sectioned ? 'Popular games' : 'All games'}</h2>${sectioned ? `<a class="see-all" href="${u('/all-games/')}">See all ${I.chevron}</a>` : ''}</div>
    ${grid(sectioned ? popular.slice(0, 8) : popular, { eagerCount: 5, label: 'Popular games' })}
  </section>
  ${adSlot('home')}
  ${sectioned ? `<section class="wrap" aria-labelledby="new-h"><div class="section-head"><h2 id="new-h">New games</h2></div>${grid(fresh.slice(0, 6), { eagerCount: 0 })}</section>
  <section class="wrap" aria-labelledby="cats-h"><div class="section-head"><h2 id="cats-h">Browse by category</h2><a class="see-all" href="${u('/all-games/')}">See all ${I.chevron}</a></div><div class="cat-cards">
${catsWithGames.map(c => catCard(c, games)).join('\n')}
</div></section>` : ''}
  <section class="wrap home-about">
    <p>MiniGames.website collects small, free browser games — classics, puzzles and quick two-player games — and adds new ones regularly. <a href="${u('/about/')}">More about this site</a></p>
  </section>
</main>
${footer()}
${scripts(ctx)}
</body>
</html>`;
}

export function pageCategory(ctx, cat) {
  const list = ctx.games.filter(g => g.categories.includes(cat.slug)).sort((a, b) => b.popularity - a.popularity);
  const path = '/' + cat.slug + '-games/';
  return `${head({
    css: ctx.css, path,
    title: `${cat.name} Games – Play Free Online | ${site.name}`,
    description: `Play free ${cat.name.toLowerCase()} games online at ${site.name}. ${cat.intro.split('. ')[0]}. No download, works on phone and computer.`,
    noindex: list.length < site.minIndexableCategory,
    jsonld: [breadcrumbs([['Home', '/'], [cat.name + ' games', path]]), {
      '@context': 'https://schema.org', '@type': 'CollectionPage', name: cat.name + ' games', url: site.url + path,
      isPartOf: { '@id': site.url + '/#website' },
      mainEntity: { '@type': 'ItemList', itemListElement: list.map((g, i) => ({ '@type': 'ListItem', position: i + 1, url: site.url + '/' + g.slug + '/', name: g.title })) },
    }],
  })}
<body class="page-cat">
${header({ active: cat.slug })}
<main id="main">
  <section class="wrap page-head" style="--cc:${cat.color}">
    <h1>${esc(cat.name)} games</h1>
    <p>${esc(cat.intro)}</p>
  </section>
  <section class="wrap" aria-label="${esc(cat.name)} games">${grid(list, { eagerCount: 6 })}</section>
  ${adSlot('category')}
</main>
${footer()}
${scripts(ctx)}
</body>
</html>`;
}

export function pageAllGames(ctx) {
  const list = [...ctx.games].sort((a, b) => a.title.localeCompare(b.title));
  return `${head({
    css: ctx.css, path: '/all-games/',
    title: `All Games A–Z | ${site.name}`,
    description: `Every free game on ${site.name}, from A to Z. Search or browse and start playing instantly on phone or computer.`,
    jsonld: [breadcrumbs([['Home', '/'], ['All games', '/all-games/']])],
  })}
<body class="page-all">
${header({ active: '' })}
<main id="main">
  <section class="wrap page-head">
    <h1>All games</h1>
    <p id="all-count">${list.length} free games, A to Z.</p>
  </section>
  <section class="wrap" aria-label="All games">${grid(list, { eagerCount: 6 })}<p class="empty" id="no-results" hidden>No games match your search. <a href="${u('/all-games/')}">Show all games</a></p></section>
</main>
${footer()}
${scripts(ctx)}
</body>
</html>`;
}

/* In-text links written in meta.json: [[slug]] or [[slug|anchor text]] for a game, [[cat:skill|skill games]]
 * for a category. A link is only made when the target is live, so scheduled games appear as plain text
 * until their release day (pages are rebuilt every release day). */
let LIVE = new Map(), TITLES = {};
function rich(t) {
  return esc(t).replace(/\[\[(cat:)?([a-z0-9-]+)(?:\|([^\]]+))?\]\]/g, (m, isCat, slug, label) => {
    if (isCat) {
      const c = categoryBySlug[slug];
      const text = label || (c ? c.name + ' games' : slug);
      return c && c.count > 0 ? `<a href="${u('/' + slug + '-games/')}">${text}</a>` : text;
    }
    const g = LIVE.get(slug);
    const text = label || esc(g ? g.title : TITLES[slug] || slug);
    return g && g.slug !== env.currentGame ? `<a href="${u('/' + slug + '/')}">${text}</a>` : text;
  });
}

function renderSection(sec, g) {
  const esc = rich; // every text field in a section may carry [[links]]
  const paras = (sec.p || []).map(t => `<p>${esc(t)}</p>`).join('');
  const after = !!(sec.dl || sec.table);
  let out = `<h2>${esc(sec.h)}</h2>`;
  if (!after) out += paras;
  if (sec.ol) out += `<ol>${sec.ol.map(t => `<li>${esc(t)}</li>`).join('')}</ol>`;
  if (sec.ul) out += `<ul>${sec.ul.map(t => `<li>${esc(t)}</li>`).join('')}</ul>`;
  if (sec.table) out += `<div class="table-wrap"><table><thead><tr>${sec.table.head.map(h => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${sec.table.rows.map(r => `<tr>${r.map((c, i) => i === 0 ? `<th scope="row">${esc(c)}</th>` : `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  if (sec.dl) out += `<dl class="defs">${sec.dl.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`;
  if (after) out += paras;
  if (sec.controls) out += `<dl class="controls">${g.controls.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`;
  if (sec.faq) out += `<div class="faq">${sec.faq.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</div>`;
  return out;
}

function breadcrumbs(items) {
  return {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: items.map(([name, p], i) => ({ '@type': 'ListItem', position: i + 1, name, item: site.url + p })),
  };
}

export function pageGame(ctx, g) {
  LIVE = new Map(ctx.games.map(o => [o.slug, o])); TITLES = ctx.titles || {}; env.currentGame = g.slug;
  const path = '/' + g.slug + '/';
  const primary = categoryBySlug[g.categories[0]];
  const [aw, ah] = g.aspect.split('/').map(s => +s.trim());
  const [mw, mh] = (g.aspectMobile || g.aspect).split('/').map(s => +s.trim());
  const related = ctx.related[g.slug];
  const og = site.url + '/' + g.slug + '/og.jpg';
  return `${head({
    css: ctx.css, path,
    title: `${g.seoTitle} | ${site.name}`,
    ogTitle: `${g.title} – play free at ${site.name}`,
    description: g.description,
    ogImage: og, ogType: 'article', ogAlt: g.title + ' game',
    published: g.added, modified: g.updated,
    jsonld: [
      breadcrumbs([['Home', '/'], [primary.name + ' games', '/' + primary.slug + '-games/'], [g.title, path]]),
      {
        '@context': 'https://schema.org', '@type': 'WebPage', '@id': site.url + path, url: site.url + path, name: g.seoTitle,
        description: g.description, inLanguage: 'en', isPartOf: { '@id': site.url + '/#website' },
        primaryImageOfPage: { '@type': 'ImageObject', url: og, width: 1200, height: 630 },
        datePublished: g.added, dateModified: g.updated,
        mainEntity: {
          '@type': 'Game', name: g.title, description: g.description, url: site.url + path, image: og,
          genre: g.categories.map(c => categoryBySlug[c]?.name).filter(Boolean),
          numberOfPlayers: { '@type': 'QuantitativeValue', minValue: 1, maxValue: g.players === '1' ? 1 : 2 },
          isAccessibleForFree: true, publisher: { '@id': site.url + '/#org' },
        },
      },
    ],
  })}
<body class="page-game">
${header({ cats: false })}
<main id="main">
  <div class="game-top">
    <div class="game-stage">
      <div class="game-frame" id="game-frame" style="--aw:${aw};--ah:${ah};--mw:${mw};--mh:${mh}" data-slug="${g.slug}" data-title="${esc(g.title)}" data-color="${g.color}">
        <iframe src="${env.preview ? u(path + 'game.html') : path + 'game'}" title="${esc(g.title)} game" allow="fullscreen; autoplay; gamepad" allowfullscreen loading="eager"></iframe>
        <button class="fs-exit" type="button" hidden>${I.close}<span>Exit full screen</span></button>
      </div>
    </div>
    <div class="wrap game-bar">
      <div class="game-id">
        <img class="game-icon" src="${u(path + 'icon-96.webp')}" width="48" height="48" alt="" decoding="async">
        <div><h1>${esc(g.title)}</h1><p class="game-sub"><a href="${u('/' + primary.slug + '-games/')}">${esc(primary.name)}</a> · ${esc(playersLabel(g))} · ${esc(g.time)}</p></div>
      </div>
      <div class="game-actions">
        <button class="act" type="button" data-act="fullscreen" aria-label="Play full screen">${I.expand}<span>Full screen</span></button>
        <button class="act" type="button" data-act="share" aria-label="Share this game">${I.share}<span>Share</span></button>
      </div>
    </div>
  </div>
  <section class="wrap more-row" aria-labelledby="more-h">
    <div class="section-head"><h2 id="more-h">More games</h2><a class="see-all" href="${u('/all-games/')}">All games ${I.chevron}</a></div>
    <div class="recent-row">${related.slice(0, 8).map(r => tile(r)).join('\n')}</div>
  </section>
  <article class="wrap game-article prose">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="${u('/')}">Home</a>${I.chevron}<a href="${u('/' + primary.slug + '-games/')}">${esc(primary.name)} games</a>${I.chevron}<span aria-current="page">${esc(g.title)}</span></nav>
    <p class="lede">${rich(g.lede)}</p>
    ${g.sections.map((sec, i) => renderSection(sec, g) + (i === 1 ? adSlot('gameContent') : '')).join('\n    ')}
    <p class="updated">Updated ${fmtDate(g.updated)}</p>
  </article>
  ${adSlot('gameBottom')}
</main>
${footer()}
<div class="share-sheet" id="share-sheet" hidden>
  <div class="share-card" role="dialog" aria-modal="true" aria-labelledby="share-h">
    <h2 id="share-h">Share ${esc(g.title)}</h2>
    <div class="share-links">
      <a data-net="whatsapp" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(g.title + ' – play free: ' + site.url + path)}">WhatsApp</a>
      <a data-net="facebook" target="_blank" rel="noopener" href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(site.url + path)}">Facebook</a>
      <a data-net="pinterest" target="_blank" rel="noopener" href="https://www.pinterest.com/pin/create/button/?url=${encodeURIComponent(site.url + path)}&amp;media=${encodeURIComponent(site.url + '/' + g.slug + '/pin.jpg')}&amp;description=${encodeURIComponent(g.title + ' – ' + g.tagline + ' Play free online at ' + site.name)}">Pinterest</a>
      <a data-net="x" target="_blank" rel="noopener" href="https://x.com/intent/post?text=${encodeURIComponent(g.title + ' – play free')}&amp;url=${encodeURIComponent(site.url + path)}">X</a>
    </div>
    <button class="btn-copy" type="button" data-url="${site.url + path}">Copy link</button>
    <button class="share-close icon-btn" type="button" aria-label="Close">${I.close}</button>
  </div>
</div>
${scripts(ctx)}
</body>
</html>`;
}

export function pageStatic(ctx, pg) {
  return `${head({ css: ctx.css, path: '/' + pg.slug + '/', title: pg.title + ' | ' + site.name, description: pg.description, jsonld: [breadcrumbs([['Home', '/'], [pg.h1, '/' + pg.slug + '/']])] })}
<body class="page-static">
${header({ cats: false })}
<main id="main" class="wrap prose static">
  <h1>${esc(pg.h1)}</h1>
  ${pg.body}
</main>
${footer()}
${scripts(ctx)}
</body>
</html>`;
}

export function page404(ctx) {
  const top = [...ctx.games].sort((a, b) => b.popularity - a.popularity).slice(0, 6);
  return `${head({ css: ctx.css, path: '/404', title: 'Page not found | ' + site.name, description: 'This page does not exist. Pick a game to play instead.', noindex: true, noCanonical: true })}
<body class="page-404">
${header({ cats: false })}
<main id="main">
  <section class="wrap page-head"><h1>That page isn’t here</h1><p>The link may be old or mistyped. These games are, though:</p></section>
  <section class="wrap">${grid(top, { eagerCount: 6 })}</section>
</main>
${footer()}
${scripts(ctx)}
</body>
</html>`;
}

/* ------------------------------------------------------------------ game frame (iframe document) */
export function gameFrame(ctx, g, parts) {
  return `<!doctype html>
<html lang="en" data-slug="${g.slug}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex">
<title>${esc(g.title)}</title>
<link rel="canonical" href="${site.url}/${g.slug}/">
<style>${parts.css}</style>
</head>
<body>
<div id="game"></div>
<script>window.GAME_OPTIONS=${JSON.stringify(g.options || {})};</script>
<script>${parts.js}</script>
</body>
</html>`;
}
