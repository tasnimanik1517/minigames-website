/* 2048 engine: slide the board, merge matching gems, reach the target gem.
 * Options: { size: 3|4|5 (default board), showcase: true (still frame for cover art) }
 * 3×3 aims for 512, 4×4 and 5×5 aim for 2048. Each size keeps its own saved game and best score. */
(function () {
  'use strict';
  var MG = window.MG, h = MG.h;
  var o = window.GAME_OPTIONS || {};
  var SIZES = [3, 4, 5], TARGET = { 3: 512, 4: 2048, 5: 2048 }, UNDOS = 3, SLIDE = 110;
  var reduce = false;
  try { reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* ignore */ }

  var ICON = {
    soundOn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z" fill="currentColor"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>',
    soundOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z" fill="currentColor"/><path d="m16 9 6 6M22 9l-6 6"/></svg>',
    restart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4h4"/></svg>',
    undo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>'
  };
  // Sparkle colour for each gem (merge particles) and a pentatonic note ladder for merge sounds.
  var GLOW = { 2: '#BFE6FA', 4: '#8DEBD2', 8: '#FFD066', 16: '#FFB070', 32: '#FF7A84', 64: '#FF7FBF', 128: '#FFE36B',
    256: '#7CF0A6', 512: '#8DB6FF', 1024: '#C79BFF', 2048: '#FFFFFF' };
  var NOTES = [262, 294, 330, 392, 440, 523, 587, 659, 784, 880, 1047, 1175, 1319, 1568, 1760, 2093, 2349];

  var n = o.showcase ? 4 : +MG.store.get('size', o.size || 4);
  if (SIZES.indexOf(n) < 0) n = 4;
  var grid = [], score = 0, moves = 0, undoLeft = UNDOS, prev = null, won = false, over = false;
  var best = 0, bestBefore = 0, bestTile = 0, pending = [], overlayKind = '', ts = 60, gap = 8;

  /* ---------- DOM ---------- */
  var scoreEl = h('b', { text: '0' }), bestEl = h('b', { text: '0' });
  var scorePill = h('span', { class: 'mg-pill t48-score' }, h('small', { text: 'Score' }), scoreEl);
  var bestPill = h('span', { class: 'mg-pill t48-best' }, h('small', { text: 'Best' }), bestEl);
  var undoCount = h('i', { class: 't48-count' });
  var undoBtn = h('button', { class: 'mg-icon-btn t48-undo', type: 'button', html: ICON.undo });
  undoBtn.append(undoCount);
  var newBtn = h('button', { class: 'mg-icon-btn', type: 'button', 'aria-label': 'New game', title: 'New game (N)', html: ICON.restart });
  var soundBtn = h('button', { class: 'mg-icon-btn', type: 'button' });
  var cellsEl = h('div', { class: 't48-cells', 'aria-hidden': 'true' });
  var tilesEl = h('div', { class: 't48-tiles', 'aria-hidden': 'true' });
  var fx = h('canvas', { class: 't48-fx', 'aria-hidden': 'true' });
  var board = h('div', { class: 't48-board', role: 'img' }, cellsEl, tilesEl, fx);
  var hint = h('p', { class: 't48-hint', text: 'Swipe or use the arrow keys to slide the gems' });
  var live = h('p', { class: 'mg-sr', 'aria-live': 'polite' });
  var overlay = h('div', { class: 'mg-overlay', hidden: true });
  var opts = MG.options({
    overlay: overlay, title: 'Board',
    summary: function () { return n + '×' + n + ' · ' + (n === 3 ? 'Small' : n === 4 ? 'Classic' : 'Big'); },
    groups: [{ label: 'Board size', items: [[3, '3×3 Small'], [4, '4×4 Classic'], [5, '5×5 Big']],
      get: function () { return n; }, set: function (v) { setSize(v); } }],
    extra: function () {
      return [h('p', { class: 'mg-hint', text: 'Goal on this board: the ' + TARGET[n] + ' gem. Every size keeps its own game and best score.' })];
    },
    onClose: function () { overlayKind = ''; }
  });
  opts.el.addEventListener('click', function () { overlayKind = 'options'; });
  var main = h('div', { class: 't48-main' }, h('div', { class: 't48-stage' }, board, hint));
  var root = h('div', { class: 'mg-root t48' },
    h('div', { class: 'mg-hud' }, scorePill, bestPill, h('span', { class: 'mg-spacer' }), undoBtn, newBtn, soundBtn),
    main, h('div', { class: 't48-bar' }, opts.el), live, overlay);
  document.getElementById('game').append(root);

  /* ---------- layout: tile size and gap in px, so cells and gems always line up ---------- */
  function layout() {
    var w = board.clientWidth; if (!w) return;
    gap = Math.max(5, Math.min(12, Math.round(w * 0.026)));
    ts = (w - gap * (n + 1)) / n;
    board.style.setProperty('--gap', gap + 'px'); board.style.setProperty('--ts', ts + 'px'); board.style.setProperty('--n', n);
    fxCtx = null;
  }
  if (window.ResizeObserver) new ResizeObserver(layout).observe(board); else window.addEventListener('resize', layout);
  function buildCells() {
    cellsEl.innerHTML = '';
    for (var i = 0; i < n * n; i++) cellsEl.append(h('span'));
    board.setAttribute('aria-label', n + ' by ' + n + ' board');
    root.setAttribute('data-size', n);
    layout();
  }

  /* ---------- tiles ---------- */
  function cls(v) { return 'v' + (v > 2048 ? 'max' : v) + ' d' + Math.min(String(v).length, 6); }
  function face(v, anim) { return h('span', { class: 't48-face ' + cls(v) + (anim ? ' ' + anim : '') }, h('b', { text: String(v) })); }
  function makeTile(v, cell, anim) {
    var t = { v: v, cell: cell, el: h('div', { class: 't48-tile' }, face(v, anim)) };
    put(t); tilesEl.append(t.el);
    return t;
  }
  function put(t) { t.el.style.setProperty('--x', t.cell % n); t.el.style.setProperty('--y', (t.cell / n) | 0); }
  function flush() {
    pending.forEach(function (p) { clearTimeout(p.timer); p.els.forEach(function (e) { e.remove(); }); });
    pending = [];
  }
  function empties() { var e = []; for (var i = 0; i < n * n; i++) if (!grid[i]) e.push(i); return e; }
  function spawn(anim) {
    var e = empties(); if (!e.length) return null;
    var cell = e[(Math.random() * e.length) | 0];
    var t = makeTile(Math.random() < 0.9 ? 2 : 4, cell, anim === false ? '' : 'is-new');
    grid[cell] = t;
    return t;
  }
  function load(cells, sc, mv, wn) {
    flush(); tilesEl.innerHTML = ''; grid = new Array(n * n).fill(null); bestTile = 0;
    cells.forEach(function (v, i) { if (v) { grid[i] = makeTile(v, i, ''); if (v > bestTile) bestTile = v; } });
    score = sc || 0; moves = mv || 0; won = !!wn;
  }
  function snapshot() { return { cells: grid.map(function (t) { return t ? t.v : 0; }), score: score, moves: moves, won: won }; }

  /* ---------- rules ---------- */
  // Cells of line i, ordered from the edge the gems slide towards. dir: 0 up, 1 right, 2 down, 3 left.
  function lineCells(dir, i) {
    var out = [];
    for (var k = 0; k < n; k++) {
      var r = dir === 0 ? k : dir === 2 ? n - 1 - k : i, c = dir === 3 ? k : dir === 1 ? n - 1 - k : i;
      out.push(r * n + c);
    }
    return out;
  }
  function canMove() {
    for (var i = 0; i < n * n; i++) {
      if (!grid[i]) return true;
      var v = grid[i].v;
      if (i % n < n - 1 && grid[i + 1] && grid[i + 1].v === v) return true;
      if (i + n < n * n && grid[i + n] && grid[i + n].v === v) return true;
    }
    return false;
  }
  function move(dir) {
    if (over || !overlay.hidden) return;
    flush();
    var before = snapshot(), next = new Array(n * n).fill(null), moved = false, gained = 0, merged = [], gone = [];
    for (var i = 0; i < n; i++) {
      var cells = lineCells(dir, i), list = [], out = [], k;
      for (k = 0; k < n; k++) if (grid[cells[k]]) list.push(grid[cells[k]]);
      for (k = 0; k < list.length; k++) { // each gem merges at most once per move
        var t = list[k], last = out[out.length - 1];
        if (last && !last.from && last.v === t.v) out[out.length - 1] = { v: t.v * 2, from: [last, t] };
        else out.push(t);
      }
      for (k = 0; k < out.length; k++) {
        var it = out[k], cell = cells[k];
        if (it.from) {
          moved = true;
          for (var s = 0; s < 2; s++) { var src = it.from[s]; src.cell = cell; put(src); src.el.classList.add('is-gone'); gone.push(src.el); }
          var m = makeTile(it.v, cell, 'is-merged');
          next[cell] = m; merged.push(m); gained += it.v;
        } else {
          if (it.cell !== cell) { moved = true; it.cell = cell; put(it); }
          next[cell] = it;
        }
      }
    }
    if (!moved) { bump(dir); return; }
    grid = next; prev = before; score += gained; moves++;
    if (gone.length) {
      var p = { els: gone };
      p.timer = setTimeout(function () { gone.forEach(function (e) { e.remove(); }); pending.splice(pending.indexOf(p), 1); }, SLIDE + 40);
      pending.push(p);
    }
    spawn();
    afterMove(merged, gained);
  }
  function afterMove(merged, gained) {
    if (!hint.classList.contains('is-hidden')) { hint.classList.add('is-hidden'); MG.store.set('hinted', 1); }
    var top = 0;
    merged.forEach(function (m) { if (m.v > top) top = m.v; });
    play(merged);
    if (gained) { plus(gained); sparkle(merged); }
    if (top >= 128) MG.vibrate(top >= 1024 ? 30 : 12);
    if (top > bestTile) {
      bestTile = top;
      if (top >= 256 && top < TARGET[n]) toast(top >= 1024 ? 'Amazing! A ' + top + ' gem' : 'New gem: ' + top);
      if (top === 1024 && TARGET[n] > 1024) MG.confetti(60);
    }
    if (score > best) { best = score; MG.store.set('best-' + n, best); }
    if (merged.length) live.textContent = 'Score ' + score;
    render();
    if (!won && top >= TARGET[n]) { won = true; save(); setTimeout(showWin, reduce ? 0 : 360); return; }
    if (!canMove()) { over = true; save(); MG.event('game_over', { score: score, size: n, tile: bestTile }); setTimeout(showOver, reduce ? 0 : 520); return; }
    save();
  }

  /* ---------- feedback: sound, score pop, sparkles, bump ---------- */
  function play(merged) {
    if (!merged.length) { MG.tone(170, 0.05, 'sine', 0.02); return; }
    merged.map(function (m) { return Math.round(Math.log2(m.v)); }).sort(function (a, b) { return a - b; }).forEach(function (lv, i) {
      var f = NOTES[Math.min(lv - 1, NOTES.length - 1)];
      MG.tone(f, 0.18, 'triangle', 0.06, 0, i * 0.055);
      MG.tone(f * 2, 0.12, 'sine', 0.022, 0, i * 0.055 + 0.012);
    });
    if (merged.length >= 3) MG.tone(1568, 0.12, 'sine', 0.03, 2093, merged.length * 0.055);
  }
  function plus(v) {
    if (reduce) return;
    var el = h('span', { class: 't48-plus', text: '+' + v });
    scorePill.append(el); setTimeout(function () { el.remove(); }, 750);
  }
  function toast(text) {
    var el = h('div', { class: 'mg-toast t48-toast', text: text });
    root.append(el); setTimeout(function () { el.remove(); }, 1700);
  }
  function bump(dir) {
    board.classList.remove('bump-0', 'bump-1', 'bump-2', 'bump-3');
    void board.offsetWidth;
    board.classList.add('bump-' + dir);
    MG.tone(110, 0.06, 'sine', 0.025);
  }
  var fxCtx = null, fxW = 0, fxH = 0, parts = [], raf = 0;
  function sparkle(merged) {
    if (reduce) return;
    var br = board.getBoundingClientRect();
    if (!fxCtx || Math.abs(br.width - fxW) > 1) { fxW = br.width; fxH = br.height; fxCtx = MG.fitCanvas(fx, fxW, fxH); }
    merged.forEach(function (m) {
      var r = m.el.getBoundingClientRect(), cx = r.left - br.left + r.width / 2, cy = r.top - br.top + r.height / 2;
      var col = GLOW[m.v] || '#FFE27A', count = m.v >= 128 ? 16 : 9, k = r.width / 80;
      for (var i = 0; i < count; i++) {
        var a = Math.random() * 6.2832, sp = (1.6 + Math.random() * 3.4) * k;
        parts.push({ x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0, max: 22 + Math.random() * 16,
          s: (1.4 + Math.random() * 2.4) * k, c: col, wait: 6 });
      }
    });
    if (!raf) raf = requestAnimationFrame(tick);
  }
  function tick() {
    raf = 0; if (!fxCtx) { parts = []; return; }
    fxCtx.clearRect(0, 0, fxW, fxH);
    parts = parts.filter(function (p) { return p.t < p.max + p.wait; });
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i]; p.t++;
      if (p.t < p.wait) continue;
      p.x += p.vx; p.y += p.vy; p.vx *= 0.9; p.vy *= 0.9;
      var life = 1 - (p.t - p.wait) / p.max, s = p.s * (0.5 + life * 0.7);
      fxCtx.globalAlpha = Math.max(0, life); fxCtx.fillStyle = p.c;
      fxCtx.beginPath(); fxCtx.moveTo(p.x, p.y - s * 2);
      fxCtx.quadraticCurveTo(p.x, p.y, p.x + s * 2, p.y); fxCtx.quadraticCurveTo(p.x, p.y, p.x, p.y + s * 2);
      fxCtx.quadraticCurveTo(p.x, p.y, p.x - s * 2, p.y); fxCtx.quadraticCurveTo(p.x, p.y, p.x, p.y - s * 2); fxCtx.fill();
    }
    fxCtx.globalAlpha = 1;
    if (parts.length) raf = requestAnimationFrame(tick); else fxCtx.clearRect(0, 0, fxW, fxH);
  }

  /* ---------- game flow ---------- */
  function save() {
    if (o.showcase) return;
    var s = snapshot(); s.undoLeft = undoLeft; s.prev = prev; s.over = over;
    MG.store.set('game-' + n, s);
  }
  function newGame() {
    overlay.hidden = true; overlayKind = '';
    load(new Array(n * n).fill(0), 0, 0, false);
    undoLeft = UNDOS; prev = null; over = false; bestBefore = best;
    spawn(); spawn();
    grid.forEach(function (t) { if (t && t.v > bestTile) bestTile = t.v; });
    render(); save();
    MG.event('game_start', { size: n });
  }
  function restore() {
    best = +MG.store.get('best-' + n, 0) || 0; bestBefore = best;
    var s = MG.store.get('game-' + n, null);
    if (s && s.cells && s.cells.length === n * n && !s.over) {
      load(s.cells, s.score, s.moves, s.won);
      undoLeft = typeof s.undoLeft === 'number' ? s.undoLeft : UNDOS; prev = s.prev || null; over = false;
      render();
    } else newGame();
  }
  function setSize(v) {
    v = +v; if (v === n || SIZES.indexOf(v) < 0) return;
    save(); n = v; MG.store.set('size', v);
    buildCells(); restore();
  }
  function undo() {
    if (!prev || undoLeft <= 0) return;
    undoLeft--; load(prev.cells, prev.score, prev.moves, prev.won); prev = null; over = false;
    overlay.hidden = true; overlayKind = '';
    MG.tone(523, 0.08, 'triangle', 0.05, 392); render(); save();
    live.textContent = 'Move undone. Score ' + score;
  }
  function askNew() {
    if (over || moves < 8) { MG.adBreak('next', '2048-new', newGame); return; }
    var yes = h('button', { class: 'mg-btn', type: 'button', text: 'New game' });
    var no = h('button', { class: 'mg-btn is-secondary', type: 'button', text: 'Keep playing' });
    yes.addEventListener('click', function () { MG.adBreak('next', '2048-new', newGame); });
    no.addEventListener('click', closeOverlay);
    card('confirm', [h('h2', { class: 'mg-title', text: 'Start over?' }),
      h('p', { class: 'mg-sub', text: 'This game (' + score + ' points) will end. Your best score stays saved.' }),
      h('div', { class: 'mg-row' }, yes, no)]);
    MG.focusSafe(no);
  }
  function closeOverlay() { if (overlayKind === 'options') opts.close(); overlay.hidden = true; overlayKind = ''; }
  function card(kind, children) {
    overlay.innerHTML = ''; overlay.append(h('div', { class: 'mg-card t48-card', role: 'dialog', 'aria-modal': 'true' }, children));
    overlay.hidden = false; overlayKind = kind;
  }
  function gem(v) { return h('div', { class: 't48-gem' }, face(v, '')); }
  function showWin() {
    MG.sfx.win(); MG.confetti(170); MG.vibrate([20, 40, 30]);
    MG.event('win', { size: n, moves: moves });
    var keep = h('button', { class: 'mg-btn', type: 'button', text: 'Keep going' });
    var again = h('button', { class: 'mg-btn is-secondary', type: 'button', text: 'New game' });
    keep.addEventListener('click', closeOverlay);
    again.addEventListener('click', function () { MG.adBreak('next', '2048-win', newGame); });
    card('win', [gem(TARGET[n]), h('h2', { class: 'mg-title', text: TARGET[n] + '!' }),
      h('p', { class: 'mg-sub', text: 'You made the ' + TARGET[n] + ' gem in ' + moves + ' moves. Keep going for an even bigger one.' }),
      h('div', { class: 'mg-row' }, keep, again)]);
    MG.focusSafe(keep);
  }
  function showOver() {
    MG.sfx.lose();
    var isBest = score > bestBefore;
    var again = h('button', { class: 'mg-btn', type: 'button', text: 'Try again' });
    again.addEventListener('click', function () { MG.adBreak('next', '2048-over', newGame); });
    var row = h('div', { class: 'mg-row' }, again);
    if (prev && undoLeft > 0) {
      var u = h('button', { class: 'mg-btn is-secondary', type: 'button', text: 'Undo (' + undoLeft + ' left)' });
      u.addEventListener('click', undo); row.append(u);
    }
    card('over', [h('h2', { class: 'mg-title', text: 'No moves left' }), isBest ? h('span', { class: 'mg-badge', text: 'New best!' }) : null,
      h('div', { class: 'mg-big', text: String(score) }),
      h('p', { class: 'mg-sub', text: 'Biggest gem: ' + bestTile + (isBest ? '' : ' · Best score: ' + best) }), row]);
    MG.focusSafe(again);
  }
  function render() {
    scoreEl.textContent = score; bestEl.textContent = Math.max(best, score);
    undoCount.textContent = undoLeft;
    var can = !!prev && undoLeft > 0;
    undoBtn.disabled = !can;
    undoBtn.setAttribute('aria-label', 'Undo last move, ' + undoLeft + ' left');
    undoBtn.title = 'Undo (U) · ' + undoLeft + ' left';
    opts.refresh();
  }
  function renderSound() {
    soundBtn.innerHTML = MG.sound.muted ? ICON.soundOff : ICON.soundOn;
    soundBtn.setAttribute('aria-label', MG.sound.muted ? 'Turn sound on' : 'Turn sound off');
  }

  /* ---------- input ---------- */
  soundBtn.addEventListener('click', function () { MG.sound.toggle(); renderSound(); });
  undoBtn.addEventListener('click', undo);
  newBtn.addEventListener('click', askNew);
  var KEYS = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3, w: 0, d: 1, s: 2, a: 3, W: 0, D: 1, S: 2, A: 3 };
  document.addEventListener('keydown', function (e) {
    if (!overlay.hidden) {
      if (e.key === 'Escape' && overlayKind !== 'over') { e.preventDefault(); closeOverlay(); }
      return;
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); undo(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (Object.prototype.hasOwnProperty.call(KEYS, e.key)) { e.preventDefault(); move(KEYS[e.key]); }
    else if (e.key === 'u' || e.key === 'U') undo();
    else if (e.key === 'n' || e.key === 'N') askNew();
  });
  var sx = 0, sy = 0, sid = null;
  main.addEventListener('pointerdown', function (e) {
    if (!overlay.hidden || (e.pointerType === 'mouse' && e.button !== 0)) return;
    sid = e.pointerId; sx = e.clientX; sy = e.clientY;
    try { main.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  });
  main.addEventListener('pointerup', function (e) {
    if (e.pointerId !== sid) return;
    sid = null;
    var dx = e.clientX - sx, dy = e.clientY - sy, ax = Math.abs(dx), ay = Math.abs(dy);
    if (Math.max(ax, ay) < 22) return;
    move(ax > ay ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0));
  });
  main.addEventListener('pointercancel', function () { sid = null; });

  /* ---------- start ---------- */
  buildCells(); renderSound();
  if (o.showcase) { // still frame for cover art: a long chain of gems leading to a glowing 2048
    root.classList.add('is-showcase');
    load([4, 8, 16, 32, 512, 256, 128, 64, 1024, 2, 8, 4, 2048, 2, 0, 2], 0, 0, false);
    root.append(h('div', { class: 't48-spare s1' }, gem(64)), h('div', { class: 't48-spare s2' }, gem(8)), h('div', { class: 't48-spare s3' }, gem(256)));
    requestAnimationFrame(function () { document.documentElement.setAttribute('data-ready', '1'); });
  } else {
    restore();
    if (MG.store.get('hinted', 0)) hint.classList.add('is-hidden');
  }
  MG.ready();
})();
