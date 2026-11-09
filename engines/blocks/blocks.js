/* Block Puzzle engine: drag pieces onto the board, fill rows or columns to clear them.
 * Options: { size: 8|10 (default board), showcase: true (still frame for cover art) }
 * No rotation. Three pieces per round; the game ends when none of the remaining pieces fits. */
(function () {
  'use strict';
  var MG = window.MG, h = MG.h;
  var o = window.GAME_OPTIONS || {};
  var SIZES = [8, 10];
  var reduce = false;
  try { reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* ignore */ }
  var ICON = {
    soundOn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z" fill="currentColor"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>',
    soundOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z" fill="currentColor"/><path d="m16 9 6 6M22 9l-6 6"/></svg>',
    restart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4h4"/></svg>'
  };
  var CANDY = ['', '#FF4D6D', '#FF922B', '#FFD43B', '#82C91E', '#4DABF7', '#9775FA', '#F06595', '#20C997'];

  /* ---------- pieces: [cells, colour, weight]; cells are [row, col] ---------- */
  function rows(str) { var out = []; str.split('/').forEach(function (line, r) { for (var c = 0; c < line.length; c++) if (line[c] === '#') out.push([r, c]); }); return out; }
  var DEFS = [
    ['#', 3, 3], ['##', 5, 5], ['#/#', 5, 5], ['###', 5, 5], ['#/#/#', 5, 5], ['####', 5, 4], ['#/#/#/#', 5, 4],
    ['#####', 5, 2], ['#/#/#/#/#', 5, 2], ['##/##', 2, 7], ['###/###/###', 2, 2], ['###/###', 6, 3], ['##/##/##', 6, 3],
    ['#./##', 4, 4], ['##/#.', 4, 4], ['##/.#', 4, 4], ['.#/##', 4, 4],
    ['#../#../###', 1, 2], ['..#/..#/###', 1, 2], ['###/#../#..', 1, 2], ['###/..#/..#', 1, 2],
    ['#./#./##', 7, 3], ['.#/.#/##', 7, 3], ['##/#./#.', 7, 3], ['##/.#/.#', 7, 3],
    ['###/#..', 7, 3], ['###/..#', 7, 3], ['#../###', 7, 3], ['..#/###', 7, 3],
    ['###/.#.', 6, 3], ['.#./###', 6, 3], ['#./##/#.', 6, 3], ['.#/##/.#', 6, 3],
    ['.##/##.', 8, 2], ['##./.##', 8, 2], ['#./##/.#', 8, 2], ['.#/##/#.', 8, 2]
  ];
  var SHAPES = DEFS.map(function (d) {
    var cells = rows(d[0]), w = 0, hh = 0;
    cells.forEach(function (p) { hh = Math.max(hh, p[0] + 1); w = Math.max(w, p[1] + 1); });
    return { cells: cells, w: w, h: hh, color: d[1], weight: d[2] };
  });
  var TOTAL_W = SHAPES.reduce(function (s, p) { return s + p.weight; }, 0);
  function randomShape() { var r = Math.random() * TOTAL_W; for (var i = 0; i < SHAPES.length; i++) { r -= SHAPES[i].weight; if (r <= 0) return i; } return 0; }

  /* ---------- state ---------- */
  var n = o.showcase ? 8 : +MG.store.get('size', o.size || 8);
  if (SIZES.indexOf(n) < 0) n = 8;
  var board = [], tray = [-1, -1, -1], score = 0, best = 0, bestBefore = 0, streak = 0, miss = 0, over = false, placedCount = 0;
  var sel = -1, cursor = { r: 0, c: 0 }, drag = null, busy = false;

  /* ---------- DOM ---------- */
  var scoreEl = h('b', { text: '0' }), bestEl = h('b', { text: '0' });
  var scorePill = h('span', { class: 'mg-pill bp-score' }, h('small', { text: 'Score' }), scoreEl);
  var comboPill = h('span', { class: 'mg-pill bp-combo', hidden: true });
  var newBtn = h('button', { class: 'mg-icon-btn', type: 'button', 'aria-label': 'New game', title: 'New game', html: ICON.restart });
  var soundBtn = h('button', { class: 'mg-icon-btn', type: 'button' });
  var boardEl = h('div', { class: 'bp-board', role: 'grid', 'aria-label': 'Board' });
  var fx = h('canvas', { class: 'bp-fx', 'aria-hidden': 'true' });
  var banner = h('div', { class: 'bp-banner', 'aria-hidden': 'true' });
  var boardWrap = h('div', { class: 'bp-boardwrap' }, boardEl, fx, banner);
  var trayEl = h('div', { class: 'bp-tray', role: 'group', 'aria-label': 'Pieces' });
  var live = h('p', { class: 'mg-sr', 'aria-live': 'polite' });
  var overlay = h('div', { class: 'mg-overlay', hidden: true });
  var overlayKind = '';
  var opts = MG.options({
    overlay: overlay, title: 'Board',
    summary: function () { return n + '×' + n + (n === 8 ? ' · Classic' : ' · Big'); },
    groups: [{ label: 'Board size', items: [[8, '8×8 Classic'], [10, '10×10 Big']], get: function () { return n; }, set: function (v) { setSize(v); } }],
    extra: function () { return [h('p', { class: 'mg-hint', text: 'Each board keeps its own game and best score.' })]; },
    onClose: function () { overlayKind = ''; }
  });
  opts.el.addEventListener('click', function () { overlayKind = 'options'; });
  var main = h('div', { class: 'bp-main' }, h('div', { class: 'bp-stage' }, boardWrap, trayEl));
  var root = h('div', { class: 'mg-root bp' },
    h('div', { class: 'mg-hud' }, scorePill, h('span', { class: 'mg-pill' }, h('small', { text: 'Best' }), bestEl), comboPill,
      h('span', { class: 'mg-spacer' }), newBtn, soundBtn),
    main, h('div', { class: 'bp-bar' }, opts.el), live, overlay);
  document.getElementById('game').append(root);
  var cellEls = [];

  function buildBoard() {
    boardEl.innerHTML = ''; cellEls = [];
    boardEl.style.setProperty('--n', n);
    for (var i = 0; i < n * n; i++) {
      var c = h('div', { class: 'bp-cell', role: 'gridcell', 'data-i': String(i), tabindex: i === cursor.r * n + cursor.c ? '0' : '-1' });
      cellEls.push(c); boardEl.append(c);
    }
    root.setAttribute('data-size', n);
    syncCursor();
  }

  /* ---------- rules ---------- */
  function fits(si, r, c) {
    var s = SHAPES[si];
    if (r < 0 || c < 0 || r + s.h > n || c + s.w > n) return false;
    for (var k = 0; k < s.cells.length; k++) if (board[(r + s.cells[k][0]) * n + c + s.cells[k][1]]) return false;
    return true;
  }
  function canPlace(si) { for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (fits(si, r, c)) return true; return false; }
  function linesAfter(si, r, c) { // rows and columns that would be complete after this placement
    var tmp = board.slice(), s = SHAPES[si], full = { rows: [], cols: [] };
    s.cells.forEach(function (p) { tmp[(r + p[0]) * n + c + p[1]] = 1; });
    for (var i = 0; i < n; i++) {
      var rf = true, cf = true;
      for (var j = 0; j < n; j++) { if (!tmp[i * n + j]) rf = false; if (!tmp[j * n + i]) cf = false; }
      if (rf) full.rows.push(i); if (cf) full.cols.push(i);
    }
    return full;
  }
  function deal() {
    // Fairness: re-deal a few times if none of the three pieces would fit.
    for (var tries = 0; tries < 12; tries++) {
      tray = [randomShape(), randomShape(), randomShape()];
      if (tray.some(canPlace)) return;
    }
  }
  function place(slot, r, c) {
    var si = tray[slot];
    if (si < 0 || !fits(si, r, c) || over) return false;
    var s = SHAPES[si], lines = linesAfter(si, r, c), placed = [];
    s.cells.forEach(function (p) { var i = (r + p[0]) * n + c + p[1]; board[i] = s.color; placed.push(i); });
    tray[slot] = -1; sel = -1; placedCount++;
    var gained = s.cells.length, k = lines.rows.length + lines.cols.length, cleared = [];
    if (k) {
      streak++; miss = 0;
      var seen = {};
      lines.rows.forEach(function (row) { for (var j = 0; j < n; j++) seen[row * n + j] = 1; });
      lines.cols.forEach(function (col) { for (var j = 0; j < n; j++) seen[j * n + col] = 1; });
      cleared = Object.keys(seen).map(Number);
      var lineScore = 10 * n * k * (k + 1) / 2, mult = 1 + 0.5 * (streak - 1);
      gained += Math.round(lineScore * mult);
    } else if (streak) { miss++; if (miss >= 3) { streak = 0; miss = 0; } }
    score += gained;
    if (score > best) { best = score; MG.store.set('best-' + n, best); }
    render(placed, cleared);
    feedback(k, cleared, gained);
    if (cleared.length) {
      busy = true;
      setTimeout(function () {
        cleared.forEach(function (i) { board[i] = 0; });
        busy = false;
        if (board.every(function (v) { return !v; })) { score += 30 * n; banner.textContent = ''; say('Board clear! +' + (30 * n), 'is-gold'); if (score > best) { best = score; MG.store.set('best-' + n, best); } MG.confetti(90); }
        afterPlace();
      }, reduce ? 0 : 280);
    } else afterPlace();
    return true;
  }
  function afterPlace() {
    if (tray.every(function (t) { return t < 0; })) deal();
    render();
    var anyFit = tray.some(function (t) { return t >= 0 && canPlace(t); });
    if (!anyFit) { over = true; save(); MG.event('game_over', { score: score, size: n }); setTimeout(showOver, reduce ? 0 : 650); }
    else save();
  }

  /* ---------- feedback ---------- */
  var NOTES = [392, 440, 523, 587, 659, 784, 880, 1047, 1175, 1319];
  function feedback(k, cleared, gained) {
    if (!k) { MG.tone(240, 0.07, 'triangle', 0.05, 170); MG.vibrate(6); return; }
    for (var i = 0; i < Math.min(k + 2, 6); i++) MG.tone(NOTES[Math.min(i + streak, NOTES.length - 1)], 0.16, 'triangle', 0.06, 0, i * 0.06);
    MG.vibrate(k > 1 ? [12, 30, 12] : 14);
    var words = ['', 'Nice!', 'Double!', 'Triple!', 'Fantastic!', 'Unbelievable!'];
    var text = (words[Math.min(k, 5)] || 'Unbelievable!') + ' +' + gained;
    if (streak >= 2) text = 'Combo ×' + streak + ' · ' + text;
    say(text, k >= 3 || streak >= 4 ? 'is-gold' : '');
    burst(cleared);
    live.textContent = (k === 1 ? '1 line' : k + ' lines') + ' cleared. Score ' + score;
  }
  function say(text, extra) {
    banner.className = 'bp-banner ' + (extra || '');
    banner.textContent = text; void banner.offsetWidth; banner.classList.add('is-on');
  }
  var fxCtx = null, fxW = 0, fxH = 0, parts = [], raf = 0;
  function burst(cells) {
    if (reduce || !cells.length) return;
    var br = boardWrap.getBoundingClientRect();
    if (!fxCtx || Math.abs(br.width - fxW) > 1) { fxW = br.width; fxH = br.height; fxCtx = MG.fitCanvas(fx, fxW, fxH); }
    cells.forEach(function (i) {
      var r = cellEls[i].getBoundingClientRect(), col = CANDY[board[i]] || '#FFD43B';
      for (var k = 0; k < 3; k++) {
        var a = Math.random() * 6.28, sp = 1 + Math.random() * 3;
        parts.push({ x: r.left - br.left + r.width / 2, y: r.top - br.top + r.height / 2, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 2, t: 0, max: 30 + Math.random() * 14, s: r.width * (0.1 + Math.random() * 0.1), c: col, rot: Math.random() * 6 });
      }
    });
    if (!raf) raf = requestAnimationFrame(tick);
  }
  function tick() {
    raf = 0; fxCtx.clearRect(0, 0, fxW, fxH);
    parts = parts.filter(function (p) { return p.t < p.max; });
    parts.forEach(function (p) {
      p.t++; p.x += p.vx; p.y += p.vy; p.vy += 0.18; p.rot += 0.15;
      var life = 1 - p.t / p.max;
      fxCtx.globalAlpha = Math.max(0, life); fxCtx.fillStyle = p.c;
      fxCtx.save(); fxCtx.translate(p.x, p.y); fxCtx.rotate(p.rot);
      fxCtx.fillRect(-p.s, -p.s, p.s * 2, p.s * 2); fxCtx.fillStyle = 'rgba(255,255,255,.6)'; fxCtx.fillRect(-p.s, -p.s, p.s, p.s * 0.6);
      fxCtx.restore();
    });
    fxCtx.globalAlpha = 1;
    if (parts.length) raf = requestAnimationFrame(tick); else fxCtx.clearRect(0, 0, fxW, fxH);
  }

  /* ---------- render ---------- */
  var trayEls = [];
  function pieceEl(si, cls) {
    var s = SHAPES[si], el = h('div', { class: 'bp-piece ' + (cls || '') });
    el.style.setProperty('--w', s.w); el.style.setProperty('--h', s.h);
    s.cells.forEach(function (p) {
      var b = h('span', { class: 'bp-blk k' + s.color });
      b.style.gridRow = p[0] + 1; b.style.gridColumn = p[1] + 1; el.append(b);
    });
    return el;
  }
  function render(placed, cleared) { renderBoard(placed, cleared); renderTray(); }
  function renderBoard(placed, cleared) {
    var ghost = {}, warn = {};
    var g = currentGhost();
    if (g) {
      SHAPES[tray[g.slot]].cells.forEach(function (p) { ghost[(g.r + p[0]) * n + g.c + p[1]] = SHAPES[tray[g.slot]].color; });
      var L = linesAfter(tray[g.slot], g.r, g.c);
      L.rows.forEach(function (row) { for (var j = 0; j < n; j++) warn[row * n + j] = 1; });
      L.cols.forEach(function (col) { for (var j = 0; j < n; j++) warn[j * n + col] = 1; });
    }
    for (var i = 0; i < n * n; i++) {
      var v = board[i], el = cellEls[i];
      var want = 'bp-cell' + (v ? ' f k' + v : '') + (ghost[i] && !v ? ' ghost k' + ghost[i] : '') + (warn[i] ? ' warn' : '') +
        (placed && placed.indexOf(i) >= 0 ? ' is-in' : '') + (cleared && cleared.indexOf(i) >= 0 ? ' is-out' : '') +
        (sel >= 0 && !drag && cursor.r * n + cursor.c === i ? ' cur' : '');
      if (el.className !== want) el.className = want;
    }
  }
  var trayKey = '';
  function renderTray() {
    // Rebuild only when the pieces, the selection or the board change. The pressed button must stay in the DOM
    // during a drag, or touch browsers stop sending the rest of the gesture to this frame.
    var key = tray.join(',') + '|' + sel + '|' + board.join('');
    if (key !== trayKey) {
      trayKey = key; trayEl.innerHTML = ''; trayEls = [];
      tray.forEach(function (si, slot) {
        var btn = h('button', { class: 'bp-slot' + (si < 0 ? ' is-empty' : '') + (slot === sel ? ' is-sel' : '') + (si >= 0 && !canPlace(si) ? ' no-fit' : ''),
          type: 'button', 'data-slot': String(slot), 'aria-label': si < 0 ? 'Used' : 'Piece ' + (slot + 1) + ', ' + SHAPES[si].cells.length + ' blocks', disabled: si < 0 });
        if (si >= 0) btn.append(pieceEl(si));
        trayEls.push(btn); trayEl.append(btn);
      });
    }
    trayEls.forEach(function (b, i) { b.classList.toggle('is-dragging', !!drag && drag.slot === i); });
    scoreEl.textContent = score; bestEl.textContent = Math.max(best, score);
    comboPill.hidden = streak < 2;
    comboPill.textContent = 'Combo ×' + streak;
  }

  /* ---------- placing: drag, tap-to-select, keyboard ---------- */
  function currentGhost() {
    if (drag && drag.target) return { slot: drag.slot, r: drag.target.r, c: drag.target.c };
    if (!drag && sel >= 0 && tray[sel] >= 0) {
      var s = SHAPES[tray[sel]], r = Math.min(cursor.r, n - s.h), c = Math.min(cursor.c, n - s.w);
      if (fits(tray[sel], r, c)) return { slot: sel, r: r, c: c };
    }
    return null;
  }
  function geom() {
    var br = boardEl.getBoundingClientRect(), first = cellEls[0].getBoundingClientRect(), second = cellEls[1].getBoundingClientRect();
    return { left: first.left, top: first.top, step: second.left - first.left, cell: first.width, br: br };
  }
  root.addEventListener('pointerdown', function (e) {
    if (busy || over || !overlay.hidden) return;
    var slotEl = e.target.closest && e.target.closest('.bp-slot');
    if (!slotEl || slotEl.disabled) return;
    var slot = +slotEl.getAttribute('data-slot'), si = tray[slot];
    if (si < 0) return;
    e.preventDefault();
    try { slotEl.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    var gm = geom(), s = SHAPES[si];
    var float = pieceEl(si, 'bp-float');
    float.style.setProperty('--cell', gm.cell + 'px'); float.style.setProperty('--gap', (gm.step - gm.cell) + 'px');
    root.append(float);
    var lift = e.pointerType === 'mouse' ? 0 : Math.max(60, gm.step * 2.2);
    drag = { slot: slot, si: si, float: float, sx: e.clientX, sy: e.clientY, moved: false, lift: lift, w: s.w * gm.step, h: s.h * gm.step, target: null, id: e.pointerId };
    moveDrag(e.clientX, e.clientY);
    render();
  });
  window.addEventListener('pointermove', function (e) {
    if (drag && e.pointerId === drag.id) { if (Math.abs(e.clientX - drag.sx) + Math.abs(e.clientY - drag.sy) > 6) drag.moved = true; moveDrag(e.clientX, e.clientY); renderBoard(); }
    else if (!drag && sel >= 0 && e.pointerType === 'mouse') {
      var cell = e.target.closest && e.target.closest('.bp-cell');
      if (cell) { var i = +cell.getAttribute('data-i'), s = SHAPES[tray[sel]]; aim(((i / n) | 0) - ((s.h - 1) >> 1), i % n - ((s.w - 1) >> 1)); }
    }
  });
  function moveDrag(x, y) {
    var rr = root.getBoundingClientRect(), gm = geom();
    var left = x - drag.w / 2, top = y - drag.h / 2 - drag.lift;
    drag.float.style.transform = 'translate(' + (left - rr.left) + 'px,' + (top - rr.top) + 'px)';
    var c = Math.round((left - gm.left) / gm.step), r = Math.round((top - gm.top) / gm.step);
    drag.target = fits(drag.si, r, c) ? { r: r, c: c } : null;
  }
  function endDrag(e, cancel) {
    if (!drag || e.pointerId !== drag.id) return;
    var d = drag; drag = null; d.float.remove();
    if (!cancel && d.target) { place(d.slot, d.target.r, d.target.c); return; }
    if (!d.moved) { sel = sel === d.slot ? -1 : d.slot; MG.sfx.tap(); }
    render();
  }
  window.addEventListener('pointerup', function (e) { endDrag(e, false); });
  window.addEventListener('pointercancel', function (e) { endDrag(e, true); });
  boardEl.addEventListener('click', function (e) {
    if (sel < 0 || busy) return;
    var cell = e.target.closest('.bp-cell'); if (!cell) return;
    var i = +cell.getAttribute('data-i'), s = SHAPES[tray[sel]];
    var r = ((i / n) | 0) - ((s.h - 1) >> 1), c = i % n - ((s.w - 1) >> 1);
    r = Math.max(0, Math.min(r, n - s.h)); c = Math.max(0, Math.min(c, n - s.w));
    if (!place(sel, r, c)) { MG.tone(140, 0.08, 'sine', 0.04); }
  });
  function syncCursor() { // roving tabindex: only the cursor cell is in the tab order, and focus follows it while the board holds focus
    var idx = cursor.r * n + cursor.c;
    cellEls.forEach(function (el, i) { el.tabIndex = i === idx ? 0 : -1; });
    if (document.activeElement && boardEl.contains(document.activeElement)) { try { cellEls[idx].focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
  }
  function aim(r, c) { cursor.r = Math.max(0, Math.min(n - 1, r)); cursor.c = Math.max(0, Math.min(n - 1, c)); syncCursor(); renderBoard(); }
  document.addEventListener('keydown', function (e) {
    if (!overlay.hidden) { if (e.key === 'Escape' && overlayKind !== 'over') { closeOverlay(); e.preventDefault(); } return; }
    if (busy || over) return;
    if (/^[1-3]$/.test(e.key)) { var s0 = +e.key - 1; if (tray[s0] >= 0) { sel = s0; MG.sfx.tap(); render(); } e.preventDefault(); return; }
    if (sel < 0) { if (e.key.indexOf('Arrow') === 0 || e.key === 'Enter') { sel = tray.findIndex(function (t) { return t >= 0; }); render(); e.preventDefault(); } return; }
    var d = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key];
    if (d) { e.preventDefault(); aim(cursor.r + d[0], cursor.c + d[1]); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); var g = currentGhost(); if (g) place(g.slot, g.r, g.c); else MG.tone(140, 0.08, 'sine', 0.04); }
    else if (e.key === 'Escape') { sel = -1; render(); }
    else if (e.key === 'Tab' && !e.shiftKey && document.activeElement === document.body) { /* let the browser move focus */ }
  });

  /* ---------- flow ---------- */
  function save() {
    if (o.showcase) return;
    MG.store.set('game-' + n, { board: board, tray: tray, score: score, streak: streak, miss: miss, over: over });
  }
  function newGame() {
    closeOverlay();
    board = new Array(n * n).fill(0); score = 0; streak = 0; miss = 0; over = false; sel = -1; placedCount = 0; bestBefore = best;
    deal(); render(); save();
    MG.event('game_start', { size: n });
  }
  function restore() {
    best = +MG.store.get('best-' + n, 0) || 0; bestBefore = best;
    var s = MG.store.get('game-' + n, null);
    if (s && s.board && s.board.length === n * n && !s.over && s.tray && s.tray.length === 3) {
      board = s.board; tray = s.tray; score = s.score || 0; streak = s.streak || 0; miss = s.miss || 0; over = false; sel = -1;
      if (tray.every(function (t) { return t < 0; })) deal();
      render();
      if (!tray.some(function (t) { return t >= 0 && canPlace(t); })) newGame();
    } else newGame();
  }
  function setSize(v) { v = +v; if (v === n || SIZES.indexOf(v) < 0) return; save(); n = v; MG.store.set('size', v); buildBoard(); fxCtx = null; restore(); }
  function closeOverlay() { if (overlayKind === 'options') opts.close(); overlay.hidden = true; overlayKind = ''; }
  function card(kind, kids) { overlay.innerHTML = ''; overlay.append(h('div', { class: 'mg-card bp-card', role: 'dialog', 'aria-modal': 'true' }, kids)); overlay.hidden = false; overlayKind = kind; }
  function askNew() {
    if (over || score < 200) { MG.adBreak('next', 'blocks-new', newGame); return; }
    var yes = h('button', { class: 'mg-btn', type: 'button', text: 'New game' }), no = h('button', { class: 'mg-btn is-secondary', type: 'button', text: 'Keep playing' });
    yes.addEventListener('click', function () { MG.adBreak('next', 'blocks-new', newGame); }); no.addEventListener('click', closeOverlay);
    card('confirm', [h('h2', { class: 'mg-title', text: 'Start over?' }), h('p', { class: 'mg-sub', text: 'This game (' + score + ' points) will end. Your best score stays saved.' }), h('div', { class: 'mg-row' }, yes, no)]);
    MG.focusSafe(no);
  }
  function showOver() {
    MG.sfx.lose();
    var isBest = score > bestBefore && score > 0;
    var again = h('button', { class: 'mg-btn', type: 'button', text: 'Play again' });
    again.addEventListener('click', function () { MG.adBreak('next', 'blocks-over', newGame); });
    card('over', [h('h2', { class: 'mg-title', text: 'No room left' }), isBest ? h('span', { class: 'mg-badge', text: 'New best!' }) : null,
      h('div', { class: 'mg-big', text: String(score) }), h('p', { class: 'mg-sub', text: isBest ? 'Your best game on this board so far.' : 'Best on this board: ' + best }),
      h('div', { class: 'mg-row' }, again)]);
    if (isBest) MG.confetti(120);
    MG.focusSafe(again);
  }
  function renderSound() { soundBtn.innerHTML = MG.sound.muted ? ICON.soundOff : ICON.soundOn; soundBtn.setAttribute('aria-label', MG.sound.muted ? 'Turn sound on' : 'Turn sound off'); }
  soundBtn.addEventListener('click', function () { MG.sound.toggle(); renderSound(); });
  newBtn.addEventListener('click', askNew);

  /* ---------- start ---------- */
  buildBoard(); renderSound();
  if (o.showcase) { // still frame for cover art: a colourful board with a row about to clear and three pieces waiting
    root.classList.add('is-showcase');
    var pic = ['55556..1', '35.66.71', '33..4.71', '2224477.', '8.2.4..6', '88.11.66', '58811222', '55.33.44'];
    board = []; pic.forEach(function (line) { for (var c = 0; c < 8; c++) board.push(line[c] === '.' ? 0 : +line[c]); });
    tray = [9, 21, 33]; sel = -1; streak = 3; score = 4280; best = 6120;
    render();
    [48, 49, 50, 51, 52, 53, 54, 55].forEach(function (i) { cellEls[i].classList.add('warn'); });
    banner.textContent = 'Combo ×3 · Triple!'; banner.className = 'bp-banner is-gold is-on is-still';
    requestAnimationFrame(function () { document.documentElement.setAttribute('data-ready', '1'); });
  } else restore();
  MG.ready();
})();
