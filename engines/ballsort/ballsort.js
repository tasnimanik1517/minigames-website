/* Ball Sort engine: move the top marble between glass tubes until every tube holds one colour.
 * Levels are generated from the level number (the same level is the same puzzle for everyone) and checked
 * with a solver before play, so every level can be solved. The solver also powers the Hint button.
 * Options: { showcase: true } still frame for cover art. */
(function () {
  'use strict';
  var MG = window.MG, h = MG.h;
  var o = window.GAME_OPTIONS || {};
  var CAP = 4;
  var reduce = false;
  try { reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* ignore */ }
  var ICON = {
    soundOn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z" fill="currentColor"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>',
    soundOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z" fill="currentColor"/><path d="m16 9 6 6M22 9l-6 6"/></svg>',
    restart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4h4"/></svg>',
    undo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>',
    bulb: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1.1 2.2h5c.1-1 .5-1.7 1.1-2.2A6 6 0 0 0 12 3Z"/></svg>',
    tube: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3h8M9 3v13a3 3 0 0 0 6 0V3"/><path d="M19 8v6M16 11h6"/></svg>'
  };
  var NAMES = ['', 'Red', 'Orange', 'Yellow', 'Lime', 'Green', 'Cyan', 'Blue', 'Purple', 'Pink', 'Brown', 'White', 'Charcoal'];
  var SYMBOLS = ['', '●', '▲', '■', '◆', '★', '♥', '✚', '☾', '✿', '♣', '◯', '✕'];
  var CHIME = [523, 587, 659, 784, 880, 1047, 1175, 1319];

  /* ---------- seeded random + level recipe ---------- */
  function rng(seed) { var a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function colorsFor(level) { return Math.max(3, Math.min(12, 2 + Math.ceil(level / 2.4))); }
  function emptiesFor() { return 2; }

  /* ---------- solver: depth-first search over states, single-marble moves ---------- */
  function key(t) { return t.map(function (x) { return x.join(''); }).sort().join('|'); }
  function solved(t) { return t.every(function (x) { return !x.length || (x.length === CAP && x.every(function (v) { return v === x[0]; })); }); }
  function uniform(x) { for (var i = 1; i < x.length; i++) if (x[i] !== x[0]) return false; return true; }
  function movesOf(t) {
    var out = [], firstEmpty = -1;
    for (var e = 0; e < t.length; e++) if (!t[e].length) { firstEmpty = e; break; }
    for (var s = 0; s < t.length; s++) {
      var a = t[s]; if (!a.length) continue;
      if (a.length === CAP && uniform(a)) continue;
      var c = a[a.length - 1];
      for (var d = 0; d < t.length; d++) {
        if (d === s) continue;
        var b = t[d];
        if (b.length >= CAP) continue;
        if (!b.length) { if (d !== firstEmpty || uniform(a)) continue; out.push([s, d, 1]); }
        else if (b[b.length - 1] === c) out.push([s, d, 0]);
      }
    }
    return out; // same-colour targets first (score 0), empties last
  }
  function solve(start, limit) {
    var seen = {}, nodes = 0, path = [];
    var t = start.map(function (x) { return x.slice(); });
    function dfs() {
      if (solved(t)) return true;
      if (++nodes > limit) return false;
      var k = key(t); if (seen[k]) return false; seen[k] = 1;
      var ms = movesOf(t).sort(function (m1, m2) { return m1[2] - m2[2]; });
      for (var i = 0; i < ms.length; i++) {
        var m = ms[i], v = t[m[0]].pop(); t[m[1]].push(v); path.push(m);
        if (dfs()) return true;
        path.pop(); t[m[1]].pop(); t[m[0]].push(v);
        if (nodes > limit) return false;
      }
      return false;
    }
    return dfs() ? path.slice() : null;
  }
  function makeLevel(level) {
    var C = colorsFor(level), E = emptiesFor(level);
    for (var attempt = 0; attempt < 40; attempt++) {
      var r = rng(level * 7919 + attempt * 104729 + 13), balls = [];
      for (var c = 1; c <= C; c++) for (var k = 0; k < CAP; k++) balls.push(c);
      for (var i = balls.length - 1; i > 0; i--) { var j = (r() * (i + 1)) | 0, tmp = balls[i]; balls[i] = balls[j]; balls[j] = tmp; }
      var tubes = [];
      for (var q = 0; q < C; q++) tubes.push(balls.slice(q * CAP, q * CAP + CAP));
      for (var z = 0; z < E; z++) tubes.push([]);
      if (tubes.some(function (x) { return x.length === CAP && uniform(x); })) continue;
      var mixed = tubes.reduce(function (s, x) { for (var y = 1; y < x.length; y++) if (x[y] !== x[y - 1]) s++; return s; }, 0);
      if (mixed < C * 1.6) continue; // too easy: too many neighbours already match
      if (solve(tubes, 60000)) return tubes;
    }
    return tubes;
  }

  /* ---------- state ---------- */
  var level = o.showcase ? 7 : Math.max(1, +MG.store.get('level', 1) || 1);
  var tubes = [], history = [], moves = 0, selected = -1, extraUsed = false, busy = false, won = false;
  var symbols = !!MG.store.get('symbols', 0);

  /* ---------- DOM ---------- */
  var levelEl = h('b', { text: '1' }), movesEl = h('b', { text: '0' });
  var undoBtn = h('button', { class: 'mg-icon-btn', type: 'button', 'aria-label': 'Undo', title: 'Undo (U)', html: ICON.undo });
  var restartBtn = h('button', { class: 'mg-icon-btn', type: 'button', 'aria-label': 'Restart level', title: 'Restart level (R)', html: ICON.restart });
  var soundBtn = h('button', { class: 'mg-icon-btn', type: 'button' });
  var shelf = h('div', { class: 'bs-shelf', role: 'group', 'aria-label': 'Tubes' });
  var fx = h('canvas', { class: 'bs-fx', 'aria-hidden': 'true' });
  var hintBtn = h('button', { class: 'bs-tool', type: 'button', html: ICON.bulb + '<span>Hint</span>' });
  var tubeBtn = h('button', { class: 'bs-tool', type: 'button', html: ICON.tube + '<span>Extra tube</span>' });
  var live = h('p', { class: 'mg-sr', 'aria-live': 'polite' });
  var overlay = h('div', { class: 'mg-overlay', hidden: true });
  var overlayKind = '';
  var opts = MG.options({
    overlay: overlay, title: 'Options',
    summary: function () { return symbols ? 'Symbols on' : 'Colours only'; },
    groups: [{ label: 'Colour-blind symbols', items: [[false, 'Off'], [true, 'On']], get: function () { return symbols; },
      set: function (v) { symbols = v; MG.store.set('symbols', v ? 1 : 0); render(); } }],
    extra: function () {
      var r = h('button', { class: 'mg-linkbtn', type: 'button', text: 'Start again from level 1' });
      r.addEventListener('click', function () { level = 1; MG.store.set('level', 1); startLevel(true); opts.close(); });
      return [h('p', { class: 'mg-hint', text: 'Symbols put a small shape on every marble, so the puzzle can be solved without telling colours apart.' }), r];
    },
    onClose: function () { overlayKind = ''; }
  });
  opts.el.addEventListener('click', function () { overlayKind = 'options'; });
  var main = h('div', { class: 'bs-main' }, shelf, fx);
  var root = h('div', { class: 'mg-root bs' },
    h('div', { class: 'mg-hud' }, h('span', { class: 'mg-pill' }, h('small', { text: 'Level' }), levelEl), h('span', { class: 'mg-pill' }, h('small', { text: 'Moves' }), movesEl),
      h('span', { class: 'mg-spacer' }), undoBtn, restartBtn, soundBtn),
    main, h('div', { class: 'bs-bar' }, hintBtn, tubeBtn, opts.el), live, overlay);
  document.getElementById('game').append(root);

  /* ---------- layout: size marbles so every tube fits, in one or two rows ---------- */
  var tubeEls = [];
  function layout() {
    var W = main.clientWidth - 16, H = main.clientHeight - 10, T = tubes.length;
    if (!W || !H || !T) return;
    var best = null;
    for (var rowsN = 1; rowsN <= 3; rowsN++) {
      var per = Math.ceil(T / rowsN);
      var bW = (W - (per - 1) * 10) / per / 1.34, bH = (H / rowsN - 26) / (CAP + 1.9);
      var b = Math.min(bW, bH, 54);
      if (!best || b > best.b + 0.5) best = { b: b, per: per };
    }
    shelf.style.setProperty('--b', Math.max(14, Math.floor(best.b)) + 'px');
    shelf.style.setProperty('--per', best.per);
    fxCtx = null;
  }
  if (window.ResizeObserver) new ResizeObserver(layout).observe(main); else window.addEventListener('resize', layout);

  function ballEl(c) { return h('span', { class: 'bs-ball c' + c, 'data-c': String(c) }, h('i', { text: SYMBOLS[c] })); }
  function build() {
    shelf.innerHTML = ''; tubeEls = [];
    tubes.forEach(function (t, i) {
      var glass = h('span', { class: 'bs-glass' });
      t.forEach(function (c) { glass.append(ballEl(c)); });
      var el = h('button', { class: 'bs-tube', type: 'button', 'data-i': String(i) }, glass);
      el.addEventListener('click', function () { tap(i); });
      tubeEls.push(el); shelf.append(el);
    });
    layout(); render();
  }
  function render() {
    root.classList.toggle('show-symbols', symbols);
    levelEl.textContent = level; movesEl.textContent = moves;
    undoBtn.disabled = !history.length || busy;
    tubeBtn.disabled = extraUsed || won;
    tubeBtn.title = extraUsed ? 'Already used on this level' : 'Add an empty tube (once per level)';
    tubeEls.forEach(function (el, i) {
      var t = tubes[i], done = t.length === CAP && uniform(t);
      el.classList.toggle('is-sel', i === selected);
      el.classList.toggle('is-done', done);
      var balls = el.firstChild.children;
      for (var k = 0; k < balls.length; k++) { balls[k].classList.toggle('up', i === selected && k === balls.length - 1); balls[k].style.setProperty('--i', k); }
      var desc = t.length ? t.map(function (c) { return NAMES[c]; }).join(', ') + ' (bottom to top)' : 'empty';
      el.setAttribute('aria-label', 'Tube ' + (i + 1) + ': ' + desc + (done ? ', complete' : '') + (i === selected ? ', selected' : ''));
    });
  }

  /* ---------- play ---------- */
  function canMove(s, d) {
    if (s === d) return false;
    var a = tubes[s], b = tubes[d];
    if (!a.length || b.length >= CAP) return false;
    return !b.length || b[b.length - 1] === a[a.length - 1];
  }
  function tap(i) {
    if (busy || won || !overlay.hidden) return;
    if (selected < 0) {
      if (!tubes[i].length) return;
      selected = i; MG.tone(660, 0.05, 'sine', 0.04); render(); return;
    }
    if (selected === i) { selected = -1; MG.tone(440, 0.05, 'sine', 0.03); render(); return; }
    if (canMove(selected, i)) { var s = selected; selected = -1; doMove(s, i, true); }
    else if (tubes[i].length) { selected = i; MG.tone(660, 0.05, 'sine', 0.04); render(); }
    else shake(i);
  }
  function shake(i) { var el = tubeEls[i]; el.classList.remove('nope'); void el.offsetWidth; el.classList.add('nope'); MG.tone(150, 0.08, 'sine', 0.04); }
  function doMove(s, d, record) {
    var c = tubes[s].pop(); tubes[d].push(c);
    if (record) { history.push([s, d]); moves++; }
    var ball = tubeEls[s].firstChild.lastElementChild, first = ball.getBoundingClientRect();
    ball.style.transition = 'none'; ball.classList.remove('up');
    tubeEls[d].firstChild.append(ball);
    render();
    var last = ball.getBoundingClientRect(), tubeTop = tubeEls[d].getBoundingClientRect().top;
    var done = function () {
      busy = false; ball.style.transition = '';
      MG.tone(1200 + Math.random() * 200, 0.05, 'sine', 0.03); MG.tone(380, 0.06, 'triangle', 0.035);
      afterMove(d);
    };
    if (reduce || !ball.animate) { busy = false; ball.style.transition = ''; afterMove(d); save(); return; }
    busy = true;
    var dx = first.left - last.left, dy = first.top - last.top, above = tubeTop - last.top - last.height * 1.25;
    var anim = ball.animate([
      { transform: 'translate(' + dx + 'px,' + dy + 'px)' },
      { transform: 'translate(' + dx * 0.5 + 'px,' + Math.min(dy, above) * 1.04 + 'px)', offset: 0.38 },
      { transform: 'translate(0px,' + above + 'px)', offset: 0.62 },
      { transform: 'translate(0,0)' }
    ], { duration: 360, easing: 'cubic-bezier(.35,.7,.4,1)' });
    anim.onfinish = done;
    save();
  }
  function afterMove(d) {
    var t = tubes[d];
    if (t.length === CAP && uniform(t)) {
      var n = tubes.filter(function (x) { return x.length === CAP && uniform(x); }).length;
      CHIME.slice(0, 3).forEach(function (f, k) { MG.tone(f * (1 + n * 0.06), 0.14, 'triangle', 0.05, 0, k * 0.07); });
      sparkle(tubeEls[d]); MG.vibrate(15);
      live.textContent = NAMES[t[0]] + ' tube complete';
    }
    render();
    if (solved(tubes)) { won = true; save(); setTimeout(showWin, reduce ? 0 : 380); return; }
    if (!anyMove()) toast('No moves left. Undo, or add an extra tube');
  }
  function anyMove() { for (var s = 0; s < tubes.length; s++) for (var d = 0; d < tubes.length; d++) if (canMove(s, d)) return true; return false; }
  function undo() {
    if (!history.length || busy || won) return;
    var m = history.pop(); moves++; selected = -1;
    doMove(m[1], m[0], false);
    MG.tone(520, 0.07, 'triangle', 0.04, 400);
  }
  function hint() {
    if (busy || won) return;
    var path = solve(tubes, 40000);
    if (!path || !path.length) { toast(history.length ? 'Stuck here. Try undoing a few moves' : 'Try the extra tube'); return; }
    var m = path[0]; selected = -1; render();
    tubeEls[m[0]].classList.add('hint-from'); tubeEls[m[1]].classList.add('hint-to');
    setTimeout(function () { tubeEls.forEach(function (el) { el.classList.remove('hint-from', 'hint-to'); }); }, 1600);
    MG.tone(880, 0.08, 'sine', 0.04); MG.tone(1175, 0.1, 'sine', 0.035, 0, 0.08);
    live.textContent = 'Hint: move the top marble of tube ' + (m[0] + 1) + ' to tube ' + (m[1] + 1);
  }
  function addTube() {
    if (extraUsed || won || busy) return;
    extraUsed = true; tubes.push([]); selected = -1;
    MG.tone(392, 0.1, 'triangle', 0.05); MG.tone(523, 0.12, 'triangle', 0.05, 0, 0.08);
    build(); save();
  }
  function toast(text) { var el = h('div', { class: 'mg-toast bs-toast', text: text }); root.append(el); setTimeout(function () { el.remove(); }, 1700); }

  var fxCtx = null, fxW = 0, fxH = 0, parts = [], raf = 0;
  function sparkle(el) {
    if (reduce) return;
    var mr = main.getBoundingClientRect(), r = el.getBoundingClientRect();
    if (!fxCtx || Math.abs(mr.width - fxW) > 1) { fxW = mr.width; fxH = mr.height; fxCtx = MG.fitCanvas(fx, fxW, fxH); }
    for (var i = 0; i < 22; i++) {
      var a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2, sp = 2 + Math.random() * 4;
      parts.push({ x: r.left - mr.left + r.width / 2, y: r.top - mr.top + 6, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0, max: 30 + Math.random() * 20, s: 1.5 + Math.random() * 2.5 });
    }
    if (!raf) raf = requestAnimationFrame(tick);
  }
  function tick() {
    raf = 0; fxCtx.clearRect(0, 0, fxW, fxH);
    parts = parts.filter(function (p) { return p.t < p.max; });
    parts.forEach(function (p) {
      p.t++; p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.vx *= 0.97;
      fxCtx.globalAlpha = Math.max(0, 1 - p.t / p.max); fxCtx.fillStyle = p.t % 6 < 3 ? '#FFFFFF' : '#FFE38A';
      fxCtx.beginPath(); fxCtx.arc(p.x, p.y, p.s, 0, 6.283); fxCtx.fill();
    });
    fxCtx.globalAlpha = 1;
    if (parts.length) raf = requestAnimationFrame(tick); else fxCtx.clearRect(0, 0, fxW, fxH);
  }

  /* ---------- levels ---------- */
  function save() { if (!o.showcase) MG.store.set('state', { level: level, tubes: tubes, history: history.slice(-200), moves: moves, extraUsed: extraUsed, won: won }); }
  function startLevel(fresh) {
    overlay.hidden = true; overlayKind = '';
    var s = !fresh && MG.store.get('state', null);
    if (s && s.level === level && s.tubes && !s.won) { tubes = s.tubes; history = s.history || []; moves = s.moves || 0; extraUsed = !!s.extraUsed; }
    else { tubes = makeLevel(level); history = []; moves = 0; extraUsed = false; }
    won = false; selected = -1; busy = false;
    build(); save();
    MG.event('game_start', { level: level });
  }
  function restart() {
    if (busy) return;
    if (!moves) { startLevel(true); return; }
    var yes = h('button', { class: 'mg-btn', type: 'button', text: 'Restart' }), no = h('button', { class: 'mg-btn is-secondary', type: 'button', text: 'Cancel' });
    yes.addEventListener('click', function () { startLevel(true); }); no.addEventListener('click', closeOverlay);
    card('confirm', [h('h2', { class: 'mg-title', text: 'Restart level ' + level + '?' }), h('p', { class: 'mg-sub', text: 'The marbles go back to where they started.' }), h('div', { class: 'mg-row' }, yes, no)]);
    MG.focusSafe(no);
  }
  function closeOverlay() { if (overlayKind === 'options') opts.close(); overlay.hidden = true; overlayKind = ''; }
  function card(kind, kids) { overlay.innerHTML = ''; overlay.append(h('div', { class: 'mg-card bs-card', role: 'dialog', 'aria-modal': 'true' }, kids)); overlay.hidden = false; overlayKind = kind; }
  function showWin() {
    MG.sfx.win(); MG.confetti(130);
    var solvedCount = (+MG.store.get('solved', 0) || 0) + 1; MG.store.set('solved', solvedCount);
    MG.event('win', { level: level, moves: moves });
    var next = h('button', { class: 'mg-btn', type: 'button', text: 'Next level' });
    next.addEventListener('click', function () { level++; MG.store.set('level', level); MG.adBreak('next', 'ballsort-level', function () { startLevel(true); }); });
    var sw = h('div', { class: 'bs-swatches', 'aria-hidden': 'true' });
    for (var c = 1; c <= colorsFor(level); c++) sw.append(ballEl(c));
    card('win', [h('span', { class: 'mg-badge', text: 'Level ' + level }), h('h2', { class: 'mg-title', text: 'Sorted!' }), sw,
      h('p', { class: 'mg-sub', text: 'Solved in ' + moves + ' moves' + (extraUsed ? ' with the extra tube.' : '.') + ' Levels finished: ' + solvedCount + '.' }), next]);
    MG.focusSafe(next);
  }
  function renderSound() { soundBtn.innerHTML = MG.sound.muted ? ICON.soundOff : ICON.soundOn; soundBtn.setAttribute('aria-label', MG.sound.muted ? 'Turn sound on' : 'Turn sound off'); }

  /* ---------- input ---------- */
  soundBtn.addEventListener('click', function () { MG.sound.toggle(); renderSound(); });
  undoBtn.addEventListener('click', undo);
  restartBtn.addEventListener('click', restart);
  hintBtn.addEventListener('click', hint);
  tubeBtn.addEventListener('click', addTube);
  document.addEventListener('keydown', function (e) {
    if (!overlay.hidden) { if (e.key === 'Escape' && overlayKind !== 'win') { e.preventDefault(); closeOverlay(); } return; }
    if (e.ctrlKey || e.metaKey || e.altKey) { if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); undo(); } return; }
    var num = { '1': 0, '2': 1, '3': 2, '4': 3, '5': 4, '6': 5, '7': 6, '8': 7, '9': 8, '0': 9, q: 10, w: 11, e: 12, r: 13 }[e.key];
    if (e.key === 'u' || e.key === 'U') { undo(); return; }
    if (e.key === 'h' || e.key === 'H') { hint(); return; }
    if (e.key === 'Escape') { selected = -1; render(); return; }
    if (num !== undefined && num < tubes.length) { e.preventDefault(); tap(num); return; }
    if (e.key === 'R' && e.shiftKey) restart();
  });

  /* ---------- start ---------- */
  renderSound();
  if (o.showcase) { // still frame: a level halfway through, one tube just completed, one marble in the air
    root.classList.add('is-showcase');
    tubes = [[1, 1, 1, 1], [2, 3, 5, 3], [4, 4, 2], [6, 7, 6, 7], [3, 5, 5], [8, 8, 8], [2, 6, 7], [4, 4, 3, 8], [5, 2, 7, 6]];
    build(); selected = 2; render();
    tubeEls[0].classList.add('is-done');
    requestAnimationFrame(function () { document.documentElement.setAttribute('data-ready', '1'); });
  } else startLevel(false);
  MG.ready();
})();
