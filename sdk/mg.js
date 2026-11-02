/*! MiniGames SDK v1. Shared runtime for every game frame:
 * per-game storage, theme sync, sound effects, pause/resume, parent messaging,
 * and an ad-break hook that is ready for Google's H5 Games Ads (Ad Placement API). */
(function () {
  'use strict';
  var root = document.documentElement;
  var slug = root.getAttribute('data-slug') || 'game';
  var origin = location.origin;
  var inFrame = false;
  try { inFrame = window.parent && window.parent !== window; } catch (e) { inFrame = true; }

  function lsGet(k, d) { try { var v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } }

  function applyTheme(t) {
    if (t === 'dark' || t === 'light') root.setAttribute('data-theme', t);
    else root.removeAttribute('data-theme');
  }
  applyTheme(lsGet('mg:theme', ''));

  function post(type, data) {
    if (!inFrame) return;
    try { window.parent.postMessage({ mg: 1, type: type, slug: slug, data: data || {} }, origin === 'null' ? '*' : origin); } catch (e) { /* ignore */ }
  }

  /* ---------- sound (tiny WebAudio synth, no audio files) ---------- */
  var muted = !!lsGet('mg:muted', false);
  var ctx = null;
  function audio() {
    if (!ctx) {
      var C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      try { ctx = new C(); } catch (e) { return null; }
    }
    if (ctx.state === 'suspended') { try { ctx.resume(); } catch (e) { /* ignore */ } }
    return ctx;
  }
  function tone(freq, dur, type, vol, slideTo, delay) {
    if (muted) return;
    var c = audio(); if (!c) return;
    var t0 = c.currentTime + (delay || 0);
    var o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.06, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(c.destination);
    o.start(t0); o.stop(t0 + dur + 0.03);
  }
  var sfx = {
    tap: function () { tone(560, 0.05, 'triangle', 0.05); },
    place: function () { tone(420, 0.07, 'triangle', 0.08, 300); },
    eat: function () { tone(660, 0.06, 'square', 0.035, 990); },
    bonus: function () { tone(784, 0.08, 'square', 0.04); tone(1175, 0.12, 'square', 0.04, 0, 0.07); },
    good: function () { tone(659, 0.09, 'triangle', 0.07); tone(880, 0.12, 'triangle', 0.07, 0, 0.08); },
    bad: function () { tone(240, 0.28, 'sawtooth', 0.05, 110); },
    draw: function () { tone(440, 0.12, 'triangle', 0.05); tone(440, 0.12, 'triangle', 0.05, 0, 0.14); },
    win: function () { [523, 659, 784, 1047].forEach(function (f, i) { tone(f, 0.16, 'triangle', 0.07, 0, i * 0.09); }); },
    lose: function () { [392, 330, 262].forEach(function (f, i) { tone(f, 0.2, 'triangle', 0.06, 0, i * 0.12); }); }
  };

  /* ---------- pause / resume ---------- */
  var pauseCbs = [], resumeCbs = [];
  function firePause() { pauseCbs.forEach(function (f) { try { f(); } catch (e) { console.error(e); } }); }
  function fireResume() { resumeCbs.forEach(function (f) { try { f(); } catch (e) { console.error(e); } }); }
  document.addEventListener('visibilitychange', function () { if (document.hidden) firePause(); });
  window.addEventListener('blur', function () { firePause(); });

  /* ---------- messages from the page that hosts the frame ---------- */
  window.addEventListener('message', function (e) {
    if (e.source !== window.parent) return;
    if (origin !== 'null' && e.origin !== origin) return;
    var d = e.data;
    if (!d || d.mgHost !== 1) return;
    if (d.type === 'theme') applyTheme(d.theme);
    else if (d.type === 'pause') firePause();
    else if (d.type === 'resume') fireResume();
    else if (d.type === 'key' && d.key) {
      // Keys pressed on the host page while the game is the main focus are forwarded here.
      document.dispatchEvent(new KeyboardEvent('keydown', { key: d.key, code: d.code || '', bubbles: true, cancelable: true }));
    }
  });

  var MG = {
    slug: slug,
    store: {
      get: function (k, d) { return lsGet('mg:' + slug + ':' + k, d); },
      set: function (k, v) { lsSet('mg:' + slug + ':' + k, v); }
    },
    sfx: sfx,
    sound: {
      get muted() { return muted; },
      set: function (m) { muted = !!m; lsSet('mg:muted', muted); post('sound', { muted: muted }); },
      toggle: function () { this.set(!muted); if (!muted) sfx.tap(); return muted; }
    },
    onPause: function (cb) { pauseCbs.push(cb); },
    onResume: function (cb) { resumeCbs.push(cb); },
    /** Analytics-style event, forwarded to the host page (game_start, game_over, win, lose...). */
    event: function (name, data) { var p = { name: name }; if (data) for (var k in data) p[k] = data[k]; post('event', p); },
    ready: function () { post('ready'); },
    /** Ad break between rounds. Calls Google's adBreak() when the H5 Games Ads tag is present,
     *  otherwise finishes immediately. Always continue the game from `done`. */
    adBreak: function (type, name, done) {
      var finished = false;
      function finish() { if (finished) return; finished = true; if (done) done(); }
      if (typeof window.adBreak === 'function') {
        try {
          window.adBreak({
            type: type || 'next', name: name || slug,
            beforeAd: function () { firePause(); },
            afterAd: function () { /* game resumes in adBreakDone */ },
            adBreakDone: finish
          });
          setTimeout(finish, 12000); // never leave the player stuck
        } catch (e) { finish(); }
      } else { finish(); }
    },
    /** Celebration burst (skipped for people who prefer reduced motion). */
    confetti: function (amount) {
      try { if (matchMedia('(prefers-reduced-motion: reduce)').matches) return; } catch (e) { /* ignore */ }
      var c = document.createElement('canvas'), r = Math.min(window.devicePixelRatio || 1, 2);
      var W = innerWidth, H = innerHeight; c.width = W * r; c.height = H * r;
      c.className = 'mg-confetti'; document.body.appendChild(c);
      var x = c.getContext('2d'); x.scale(r, r);
      var cols = ['#FF6A3D', '#FFC22E', '#2F6BFF', '#1FB86E', '#E5487D', '#8B5CFF'], ps = [], n = amount || 110;
      for (var i = 0; i < n; i++) ps.push({ x: W / 2 + (Math.random() - .5) * W * .5, y: H * .42, vx: (Math.random() - .5) * 13, vy: -Math.random() * 15 - 5,
        s: 5 + Math.random() * 6, c: cols[i % cols.length], a: Math.random() * 6, va: (Math.random() - .5) * .35, k: i % 3 });
      var t0 = performance.now();
      (function f(t) {
        var e = t - t0; x.clearRect(0, 0, W, H); x.globalAlpha = Math.max(0, 1 - e / 1700);
        for (var j = 0; j < ps.length; j++) {
          var p = ps[j]; p.vy += .42; p.vx *= .985; p.x += p.vx; p.y += p.vy; p.a += p.va;
          x.save(); x.translate(p.x, p.y); x.rotate(p.a); x.fillStyle = p.c;
          if (p.k === 0) x.fillRect(-p.s, -p.s / 2.5, p.s * 2, p.s / 1.25);
          else if (p.k === 1) { x.beginPath(); x.arc(0, 0, p.s * .55, 0, 6.3); x.fill(); }
          else { x.beginPath(); x.moveTo(0, -p.s); x.lineTo(p.s * .8, p.s * .6); x.lineTo(-p.s * .8, p.s * .6); x.fill(); }
          x.restore();
        }
        if (e < 1700) requestAnimationFrame(f); else c.remove();
      })(t0);
    },
    vibrate: function (ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* ignore */ } },
    /** Size a canvas for the device pixel ratio; returns the 2D context scaled to CSS pixels. */
    fitCanvas: function (canvas, w, h) {
      var r = Math.min(window.devicePixelRatio || 1, 3);
      canvas.width = Math.round(w * r); canvas.height = Math.round(h * r);
      canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
      var c = canvas.getContext('2d'); c.setTransform(r, 0, 0, r, 0, 0); return c;
    },
    /** Read a CSS custom property from :root (lets canvas games follow the theme). */
    css: function (name) { return getComputedStyle(root).getPropertyValue(name).trim(); },
    /** Small helper to build DOM: MG.h('button', {class:'mg-btn', onclick: fn}, 'Play') */
    h: function (tag, attrs) {
      var el = document.createElement(tag);
      if (attrs) for (var k in attrs) {
        var v = attrs[k];
        if (v == null || v === false) continue;
        if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else if (k === 'class') el.className = v;
        else if (k === 'text') el.textContent = v;
        else if (k === 'html') el.innerHTML = v;
        else el.setAttribute(k, v === true ? '' : v);
      }
      for (var i = 2; i < arguments.length; i++) {
        var ch = arguments[i];
        if (ch == null || ch === false) continue;
        if (Array.isArray(ch)) ch.forEach(function (c) { if (c != null) el.append(c); });
        else el.append(ch);
      }
      return el;
    },
    /** Compact "options" chip + dialog card, so settings never squeeze the board on phones.
     *  cfg = { overlay, title, summary: fn, groups: [{ label, items: [[value, text]], get, set, visible }], extra: fn -> [nodes] } */
    options: function (cfg) {
      var chip = MG.h('button', { class: 'mg-chip', type: 'button', 'aria-haspopup': 'dialog' });
      function refresh() {
        chip.innerHTML = '';
        chip.append(MG.h('span', { text: cfg.summary() }),
          MG.h('span', { class: 'mg-chip-caret', 'aria-hidden': 'true', html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m7 10 5 5 5-5"/></svg>' }));
        chip.setAttribute('aria-label', 'Game options: ' + cfg.summary());
      }
      function open() {
        var ov = cfg.overlay; ov.innerHTML = '';
        var card = MG.h('div', { class: 'mg-card', role: 'dialog', 'aria-label': cfg.title || 'Options' },
          MG.h('h2', { class: 'mg-title', text: cfg.title || 'Options' }));
        cfg.groups.forEach(function (g) {
          if (g.visible && !g.visible()) return;
          var segEl = MG.h('div', { class: 'mg-seg', role: 'group', 'aria-label': g.label });
          g.items.forEach(function (it) {
            var b = MG.h('button', { type: 'button', 'aria-pressed': String(g.get() === it[0]), text: it[1] });
            b.addEventListener('click', function () {
              if (g.get() !== it[0]) { g.set(it[0]); MG.sfx.tap(); }
              refresh(); open(); // re-render: visibility of other groups can depend on this one
            });
            segEl.append(b);
          });
          card.append(MG.h('div', { class: 'mg-field' }, MG.h('span', { class: 'mg-label', text: g.label }), segEl));
        });
        if (cfg.extra) cfg.extra().forEach(function (n) { card.append(n); });
        var done = MG.h('button', { class: 'mg-btn is-small', type: 'button', text: 'Done' });
        done.addEventListener('click', close);
        card.append(done);
        ov.append(card); ov.hidden = false;
        try { (card.querySelector('[aria-pressed="true"]') || done).focus({ preventScroll: true }); } catch (e) { /* ignore */ }
      }
      function close() { cfg.overlay.hidden = true; if (cfg.onClose) cfg.onClose(); }
      chip.addEventListener('click', open);
      refresh();
      return { el: chip, refresh: refresh, open: open, close: close };
    },
    themeChanged: function (cb) {
      new MutationObserver(cb).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
      if (window.matchMedia) {
        var mq = window.matchMedia('(prefers-color-scheme: dark)');
        if (mq.addEventListener) mq.addEventListener('change', cb);
      }
    }
  };
  window.MG = MG;
})();
