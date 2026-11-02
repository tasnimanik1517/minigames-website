/* MiniGames.website — site script (search, recently played, game page controls). No dependencies. */
(function () {
  'use strict';
  var d = document, root = d.documentElement;
  var PREVIEW = root.getAttribute('data-preview') === '1';
  var BASE = root.getAttribute('data-base') || '/';
  function href(p) { // internal link that also works in the static preview
    if (!PREVIEW) return p;
    var clean = p.replace(/^\//, '');
    return BASE + clean + (p.slice(-1) === '/' ? 'index.html' : '');
  }
  function lsGet(k, def) { try { var v = localStorage.getItem(k); return v === null ? def : JSON.parse(v); } catch (e) { return def; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } }
  function toast(msg) {
    var t = d.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg;
    d.body.appendChild(t); setTimeout(function () { t.remove(); }, 2300);
  }
  function escHtml(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* ---------------------------------------------------------------- search */
  var header = d.querySelector('.site-header');
  var form = d.querySelector('.search');
  var input = d.getElementById('q');
  var box = d.getElementById('search-results');
  var games = null, loading = null, sel = -1;
  function loadGames() {
    if (games) return Promise.resolve(games);
    if (!loading) loading = fetch(href('/games.json')).then(function (r) { return r.json(); }).then(function (j) { games = j; return j; }).catch(function () { games = []; return games; });
    return loading;
  }
  function norm(s) { return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim(); }
  function match(q) {
    var words = norm(q).split(' ').filter(Boolean);
    return games.map(function (g) {
      var hay = norm(g.title + ' ' + g.tags.join(' ') + ' ' + (g.alt || ''));
      var t = norm(g.title), score = 0;
      for (var i = 0; i < words.length; i++) {
        if (hay.indexOf(words[i]) < 0) return null;
        score += t.indexOf(words[i]) === 0 ? 3 : t.indexOf(' ' + words[i]) >= 0 ? 2 : 1;
      }
      return { g: g, s: score + g.pop / 100 };
    }).filter(Boolean).sort(function (a, b) { return b.s - a.s; }).map(function (x) { return x.g; });
  }
  function render(list, q) {
    sel = -1;
    if (!q) { box.hidden = true; input.setAttribute('aria-expanded', 'false'); return; }
    box.innerHTML = list.length ? list.slice(0, 7).map(function (g, i) {
      return '<a role="option" id="sr-' + i + '" href="' + href('/' + g.slug + '/') + '"><img src="' + href('/' + g.slug + '/thumb-400.webp') + '" alt="" width="56" height="42" loading="lazy"><span>' + escHtml(g.title) + '<small>' + escHtml(g.cat) + '</small></span></a>';
    }).join('') : '<p class="none">No games found for “' + escHtml(q) + '”.</p>';
    box.hidden = false; input.setAttribute('aria-expanded', 'true');
  }
  if (input) {
    var timer;
    input.addEventListener('focus', loadGames, { once: true });
    input.addEventListener('input', function () {
      clearTimeout(timer);
      var q = input.value.trim();
      timer = setTimeout(function () { loadGames().then(function () { render(q ? match(q) : [], q); }); }, 60);
    });
    input.addEventListener('keydown', function (e) {
      var items = box.querySelectorAll('a');
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (!items.length) return;
        e.preventDefault();
        sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        items.forEach(function (a, i) { a.setAttribute('aria-selected', String(i === sel)); });
        input.setAttribute('aria-activedescendant', 'sr-' + sel);
      } else if (e.key === 'Enter') {
        var target = items[sel >= 0 ? sel : 0];
        if (target) { e.preventDefault(); location.href = target.href; }
      } else if (e.key === 'Escape') { input.value = ''; render([], ''); closeSearch(); }
    });
    d.addEventListener('click', function (e) { if (!form.contains(e.target)) { box.hidden = true; input.setAttribute('aria-expanded', 'false'); } });
  }
  function openSearch() { header.classList.add('is-searching'); setTimeout(function () { input.focus(); }, 0); loadGames(); }
  function closeSearch() { header.classList.remove('is-searching'); box.hidden = true; }
  var openBtn = d.querySelector('.search-open'), closeBtn = d.querySelector('.search-close');
  if (openBtn) openBtn.addEventListener('click', openSearch);
  if (closeBtn) closeBtn.addEventListener('click', function () { input.value = ''; closeSearch(); });

  /* all-games page: ?q= filters the grid */
  if (d.body.classList.contains('page-all')) {
    var q0 = new URLSearchParams(location.search).get('q');
    if (q0) {
      input.value = q0;
      var words = norm(q0).split(' ').filter(Boolean), shown = 0;
      d.querySelectorAll('.grid .tile').forEach(function (t) {
        var hay = norm(t.getAttribute('data-title') + ' ' + t.getAttribute('data-tags'));
        var ok = words.every(function (w) { return hay.indexOf(w) >= 0; });
        t.hidden = !ok; if (ok) shown++;
      });
      var c = d.getElementById('all-count'); if (c) c.textContent = shown + ' result' + (shown === 1 ? '' : 's') + ' for “' + q0 + '”';
      d.getElementById('no-results').hidden = shown > 0;
    }
  }

  /* ---------------------------------------------------------------- game page */
  var frameWrap = d.getElementById('game-frame');
  if (frameWrap) {
    var iframe = frameWrap.querySelector('iframe');
    var slug = frameWrap.getAttribute('data-slug');
    var exitBtn = frameWrap.querySelector('.fs-exit');
    function post(msg) { msg.mgHost = 1; try { iframe.contentWindow.postMessage(msg, PREVIEW || location.origin === 'null' ? '*' : location.origin); } catch (e) { /* ignore */ } }

    // remember as recently played
    var recent = lsGet('mg:recent', []).filter(function (s) { return s !== slug; });
    recent.unshift(slug); lsSet('mg:recent', recent.slice(0, 12));

    // focus the game so arrow keys go to it, not to page scrolling
    function inView() { var r = frameWrap.getBoundingClientRect(); return r.top < innerHeight * 0.6 && r.bottom > innerHeight * 0.4; }
    function focusGame() { try { iframe.contentWindow.focus(); } catch (e) { /* ignore */ } }
    iframe.addEventListener('load', function () { if (inView() && (!d.activeElement || d.activeElement === d.body)) focusGame(); });
    // keys pressed on the page (not in a field) while the game is on screen are passed to the game
    var GAME_KEYS = { ArrowUp: 1, ArrowDown: 1, ArrowLeft: 1, ArrowRight: 1, ' ': 1 };
    d.addEventListener('keydown', function (e) {
      var a = d.activeElement;
      if (!GAME_KEYS[e.key] || e.metaKey || e.ctrlKey || e.altKey) return;
      if (a && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON|SUMMARY|A)$/.test(a.tagName))) return;
      if (!inView()) return;
      e.preventDefault(); post({ type: 'key', key: e.key, code: e.code }); focusGame();
    });
    // pause when the game scrolls out of view
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) { if (!en[0].isIntersecting) post({ type: 'pause' }); }, { threshold: 0.25 }).observe(frameWrap);
    }
    // messages from the game
    window.addEventListener('message', function (e) {
      if (e.source !== iframe.contentWindow || !e.data || e.data.mg !== 1) return;
      var m = e.data;
      if (m.type === 'event' && window.gtag) window.gtag('event', m.data.name, { game: slug, value: m.data.score });
    });

    // full screen (native where supported, otherwise a fixed overlay, e.g. iPhone)
    function isNativeFs() { return !!(d.fullscreenElement || d.webkitFullscreenElement); }
    function enterFs() {
      var req = frameWrap.requestFullscreen || frameWrap.webkitRequestFullscreen;
      if (req) {
        var p = req.call(frameWrap, { navigationUI: 'hide' });
        if (p && p.catch) p.catch(pseudoFs);
      } else pseudoFs();
      setTimeout(focusGame, 150);
    }
    function pseudoFs() { frameWrap.classList.add('is-pseudo-fs'); d.body.classList.add('is-fs-lock'); exitBtn.hidden = false; }
    function exitFs() {
      if (isNativeFs()) { (d.exitFullscreen || d.webkitExitFullscreen).call(d); }
      frameWrap.classList.remove('is-pseudo-fs'); d.body.classList.remove('is-fs-lock'); exitBtn.hidden = true;
    }
    exitBtn.addEventListener('click', exitFs);
    d.addEventListener('keydown', function (e) { if (e.key === 'Escape' && frameWrap.classList.contains('is-pseudo-fs')) exitFs(); });

    // share
    var sheet = d.getElementById('share-sheet');
    function openShare() {
      var url = (sheet.querySelector('.btn-copy') || {}).getAttribute ? sheet.querySelector('.btn-copy').getAttribute('data-url') : location.href;
      var title = frameWrap.getAttribute('data-title');
      if (navigator.share && matchMedia('(pointer: coarse)').matches) {
        navigator.share({ title: title + ' – MiniGames.website', url: url }).catch(function () { /* cancelled */ });
        return;
      }
      sheet.hidden = false; var c = sheet.querySelector('.btn-copy'); if (c) c.focus();
    }
    if (sheet) {
      sheet.addEventListener('click', function (e) { if (e.target === sheet || e.target.closest('.share-close')) sheet.hidden = true; });
      d.addEventListener('keydown', function (e) { if (e.key === 'Escape') sheet.hidden = true; });
      var copy = sheet.querySelector('.btn-copy');
      copy.addEventListener('click', function () {
        var url = copy.getAttribute('data-url');
        var done = function () { sheet.hidden = true; toast('Link copied'); };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, function () { prompt('Copy this link:', url); });
        else { prompt('Copy this link:', url); }
      });
    }
    d.querySelectorAll('.act').forEach(function (b) {
      b.addEventListener('click', function () {
        var act = b.getAttribute('data-act');
        if (act === 'fullscreen') enterFs(); else if (act === 'share') openShare();
      });
    });
  }

  /* ---------------------------------------------------------------- ads (only when AdSense is configured) */
  if (window.MG_ADS && d.querySelector('.adsbygoogle')) {
    var loaded = false;
    var loadAds = function () {
      if (loaded) return; loaded = true;
      var s = d.createElement('script'); s.async = true; s.crossOrigin = 'anonymous';
      s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + window.MG_ADS;
      d.head.appendChild(s);
      d.querySelectorAll('.adsbygoogle').forEach(function () { (window.adsbygoogle = window.adsbygoogle || []).push({}); });
    };
    // after the page and the game have loaded, so ads never slow down the first view
    var idle = window.requestIdleCallback || function (f) { setTimeout(f, 1200); };
    if (d.readyState === 'complete') idle(loadAds); else addEventListener('load', function () { idle(loadAds); });
    ['scroll', 'pointerdown', 'keydown'].forEach(function (ev) { addEventListener(ev, loadAds, { once: true, passive: true }); });
  }
})();
