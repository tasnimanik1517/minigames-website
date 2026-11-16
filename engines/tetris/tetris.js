/* Tetris engine: the falling-block classic. Move and rotate the falling pieces,
 * complete full lines to clear them. Four lines at once is a Tetris.
 * Canvas game on a fixed logical world (480 x 640) scaled to fit the stage.
 * Level 1 starts slow (850 ms per step) and speeds up every 10 lines.
 * Options: { showcase: true } still frame for cover art. */
(function () {
  'use strict';
  var MG = window.MG, h = MG.h, o = window.GAME_OPTIONS || {};
  var SHOWCASE = !!o.showcase;

  /* logical world */
  var W = 480, H = 640;
  var COLS = 10, ROWS = 20, CELL = 26;
  var BX = 40, BY = 64; // board origin
  var BW = COLS * CELL, BH = ROWS * CELL;
  var NX = 330, NY = 64; // next-piece panel
  var PIECES = {
    I: { color: '#22D3EE', dark: '#0E7490', cells: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]] },
    O: { color: '#FACC15', dark: '#A16207', cells: [[1, 1], [1, 1]] },
    T: { color: '#C084FC', dark: '#7E22CE', cells: [[0, 1, 0], [1, 1, 1], [0, 0, 0]] },
    S: { color: '#4ADE80', dark: '#15803D', cells: [[0, 1, 1], [1, 1, 0], [0, 0, 0]] },
    Z: { color: '#F87171', dark: '#B91C1C', cells: [[1, 1, 0], [0, 1, 1], [0, 0, 0]] },
    J: { color: '#60A5FA', dark: '#1D4ED8', cells: [[1, 0, 0], [1, 1, 1], [0, 0, 0]] },
    L: { color: '#FB923C', dark: '#C2410C', cells: [[0, 0, 1], [1, 1, 1], [0, 0, 0]] }
  };
  var KEYS = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
  var LINE_POINTS = [0, 100, 300, 500, 800];
  var RANKS = [[0, '🧱', 'Block Stacker'], [500, '🎯', 'Line Clearer'], [1500, '💥', 'Combo Breaker'],
    [3000, '🌈', 'Tetris Master'], [5000, '🏆', 'Block Champion'], [8000, '👑', 'Grand Master']];
  var best = +MG.store.get('best', 0) || 0;

  /* ---------- state ---------- */
  var state = 'idle', paused = false; // idle | playing | clearing | done
  var board = []; // ROWS x COLS of piece key | null
  var cur = null; // { key, cells, x, y }
  var nextKey = null;
  var score = 0, lines = 0, level = 1, tetrises = 0, pieces = 0;
  var dropTimer = 0, clearTimer = 0, clearRows = [];
  var softDrop = false;
  var popups = [], parts = [];
  var lastTick = 0;

  /* ---------- DOM ---------- */
  function pill(label, el) { return h('span', { class: 'mg-pill' }, h('small', { text: label }), el); }
  var scoreEl = h('b', { text: '0' }), bestEl = h('b', { text: best ? best : '–' });
  var levelEl = h('b', { text: '1' }), linesEl = h('b', { text: '0' });
  var soundBtn = h('button', { class: 'mg-icon-btn', type: 'button' });
  var pauseBtn = h('button', { class: 'mg-icon-btn', type: 'button', 'aria-label': 'Pause the game' },
    h('span', { html: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1.2"/><rect x="14" y="5" width="4" height="14" rx="1.2"/></svg>' }));
  var canvas = h('canvas', { class: 'tt-canvas', role: 'img', 'aria-label': 'Tetris game board' });
  function ctlBtn(label, aria, fn) {
    var b = h('button', { class: 'tt-btn', type: 'button', 'aria-label': aria }, h('span', { 'aria-hidden': 'true', text: label }));
    var timer = null, iv = null;
    function stop() { if (timer) { clearTimeout(timer); timer = null; } if (iv) { clearInterval(iv); iv = null; } }
    b.addEventListener('pointerdown', function (e) {
      if (state !== 'playing' || paused) return;
      e.preventDefault();
      try { b.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      fn();
      timer = setTimeout(function () { iv = setInterval(fn, 70); }, 200);
    });
    b.addEventListener('pointerup', stop);
    b.addEventListener('pointercancel', stop);
    b.addEventListener('lostpointercapture', stop);
    b.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    return b;
  }
  var leftBtn = ctlBtn('◀', 'Move left', function () { move(-1); });
  var rightBtn = ctlBtn('▶', 'Move right', function () { move(1); });
  var rotBtn = ctlBtn('⟳', 'Rotate', function () { rotate(); });
  var downBtn = ctlBtn('▼', 'Soft drop', function () { stepDown(true); });
  var dropBtn = h('button', { class: 'tt-btn is-drop', type: 'button', 'aria-label': 'Hard drop' }, h('span', { 'aria-hidden': 'true', text: '⤓' }));
  dropBtn.addEventListener('click', function () { hardDrop(); });
  var controls = h('div', { class: 'tt-controls' }, leftBtn, rotBtn, rightBtn, downBtn, dropBtn);
  var stage = h('div', { class: 'tt-stage' }, canvas);
  var overlay = h('div', { class: 'mg-overlay', hidden: true });
  var root = h('div', { class: 'mg-root tt' },
    h('div', { class: 'mg-hud' }, pill('Score', scoreEl), pill('Level', levelEl), pill('Lines', linesEl), pill('Best', bestEl),
      h('span', { class: 'mg-spacer' }), pauseBtn, soundBtn),
    stage, controls, overlay);
  document.getElementById('game').append(root);

  var ctx = null, dpr = 1, scale = 1, ox = 0, oy = 0, cw = 0, ch = 0;
  function resize() {
    var r = stage.getBoundingClientRect();
    cw = Math.max(150, r.width); ch = Math.max(150, r.height);
    scale = Math.min(cw / W, ch / H);
    ox = (cw - W * scale) / 2; oy = (ch - H * scale) / 2;
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    ctx = MG.fitCanvas(canvas, cw, ch);
    draw();
  }
  if (window.ResizeObserver) new ResizeObserver(resize).observe(stage);
  else window.addEventListener('resize', resize);

  /* ---------- helpers ---------- */
  function rank(s) { var r = RANKS[0]; RANKS.forEach(function (x) { if (s >= x[0]) r = x; }); return r; }
  function renderHud() {
    scoreEl.textContent = score;
    bestEl.textContent = Math.max(best, score) || '–';
    levelEl.textContent = level;
    linesEl.textContent = lines;
  }
  function dropInterval() { return softDrop ? 45 : Math.max(90, 850 - (level - 1) * 70); }
  function emptyBoard() { board = []; for (var r = 0; r < ROWS; r++) board.push(new Array(COLS).fill(null)); }
  function bag() {
    var keys = KEYS.slice();
    for (var i = keys.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = keys[i]; keys[i] = keys[j]; keys[j] = t; }
    return keys;
  }
  var queue = [];
  function drawPieceKey() {
    if (!queue.length) queue = bag();
    return queue.shift();
  }
  function spawn() {
    var key = nextKey || drawPieceKey();
    nextKey = drawPieceKey();
    cur = { key: key, cells: PIECES[key].cells.map(function (row) { return row.slice(); }), x: 3, y: key === 'I' ? -1 : 0 };
    if (collides(cur.cells, cur.x, cur.y)) { cur = null; finish(false); return; }
    dropTimer = 0;
  }
  function collides(cells, x, y) {
    for (var r = 0; r < cells.length; r++) for (var c = 0; c < cells[r].length; c++) {
      if (!cells[r][c]) continue;
      var bx = x + c, by = y + r;
      if (bx < 0 || bx >= COLS || by >= ROWS) return true;
      if (by >= 0 && board[by][bx]) return true;
    }
    return false;
  }
  function rotateCells(cells) {
    var n = cells.length, out = [];
    for (var r = 0; r < n; r++) { out.push([]); for (var c = 0; c < n; c++) out[r][c] = cells[n - 1 - c][r]; }
    return out;
  }
  function rotate() {
    if (state !== 'playing' || paused || !cur) return;
    var rot = rotateCells(cur.cells);
    var kicks = [0, -1, 1, -2, 2];
    for (var i = 0; i < kicks.length; i++) {
      if (!collides(rot, cur.x + kicks[i], cur.y)) { cur.cells = rot; cur.x += kicks[i]; MG.sfx.tap(); return; }
    }
  }
  function move(dx) {
    if (state !== 'playing' || paused || !cur) return;
    if (!collides(cur.cells, cur.x + dx, cur.y)) { cur.x += dx; MG.sfx.tap(); }
  }
  function stepDown(manual) {
    if (state !== 'playing' || paused || !cur) return false;
    if (!collides(cur.cells, cur.x, cur.y + 1)) {
      cur.y++;
      if (manual) score += 1;
      dropTimer = 0;
      return true;
    }
    lockPiece();
    return false;
  }
  function hardDrop() {
    if (state !== 'playing' || paused || !cur) return;
    var d = 0;
    while (!collides(cur.cells, cur.x, cur.y + 1)) { cur.y++; d++; }
    score += d * 2;
    MG.sfx.place();
    lockPiece();
  }
  function lockPiece() {
    cur.cells.forEach(function (row, r) {
      row.forEach(function (v, c) {
        if (v && cur.y + r >= 0) board[cur.y + r][cur.x + c] = cur.key;
      });
    });
    pieces++;
    MG.sfx.place();
    var full = [];
    for (var r = 0; r < ROWS; r++) if (board[r].every(function (v) { return !!v; })) full.push(r);
    if (full.length) {
      clearRows = full;
      state = 'clearing';
      clearTimer = 0;
      var gain = LINE_POINTS[full.length] * level;
      score += gain;
      lines += full.length;
      if (full.length === 4) { tetrises++; popups.push({ text: 'TETRIS! +' + gain, x: BX + BW / 2, y: BY + BH * 0.4, t: 0 }); MG.confetti(90); MG.sfx.win(); }
      else { popups.push({ text: '+' + gain, x: BX + BW / 2, y: BY + BH * 0.4, t: 0 }); MG.sfx.bonus(); }
      level = Math.floor(lines / 10) + 1;
    } else {
      cur = null;
      spawn();
    }
    renderHud();
  }
  function finishClearing() {
    clearRows.slice().sort(function (a, b) { return b - a; }).forEach(function (r) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(null));
    });
    clearRows = [];
    cur = null;
    state = 'playing';
    spawn();
  }
  function reset() {
    score = 0; lines = 0; level = 1; tetrises = 0; pieces = 0;
    emptyBoard(); queue = [];
    nextKey = drawPieceKey();
    popups = []; parts = [];
    spawn();
    renderHud();
  }
  function start() {
    reset();
    state = 'playing'; paused = false; overlay.hidden = true;
    MG.event('game_start');
  }
  function finish() {
    state = 'done';
    var prev = best, isBest = score > best;
    if (isBest) { best = score; MG.store.set('best', best); }
    renderHud();
    var r = rank(score);
    var again = h('button', { class: 'mg-btn', type: 'button', text: 'Play again' });
    again.addEventListener('click', function () { MG.adBreak('next', 'tetris-again', start); });
    overlay.innerHTML = '';
    overlay.append(h('div', { class: 'mg-card tt-card', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Your result' },
      h('div', { class: 'tt-badge', 'aria-hidden': 'true', text: r[1] }),
      h('div', null, h('small', { class: 'mg-label', text: 'Your Tetris badge' }), h('h2', { class: 'mg-title', text: r[2] })),
      h('div', { class: 'tt-score' }, h('span', { class: 'mg-big', text: score }), h('span', { text: lines + ' lines · level ' + level + (tetrises ? ' · ' + tetrises + ' Tetris' + (tetrises > 1 ? 'es' : '') : '') })),
      isBest && prev ? h('span', { class: 'mg-badge', text: 'New best!' }) : null,
      h('p', { class: 'mg-sub', text: 'The stack reached the top after ' + pieces + ' pieces.' + (prev && !isBest ? ' Your best is ' + prev + '.' : '') }),
      h('div', { class: 'mg-row' }, again)));
    overlay.hidden = false;
    MG.focusSafe(again, 700);
    if (isBest && prev) { MG.confetti(120); MG.sfx.win(); } else if (score >= 1500) MG.sfx.good(); else MG.sfx.draw();
    MG.event('game_over', { score: score });
  }

  /* ---------- input ---------- */
  document.addEventListener('keydown', function (e) {
    if (state !== 'playing' || paused) return;
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') { e.preventDefault(); move(-1); }
    else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') { e.preventDefault(); move(1); }
    else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') { e.preventDefault(); softDrop = true; stepDown(true); }
    else if (e.key === 'ArrowUp' || e.key === 'x' || e.key === 'X') { e.preventDefault(); rotate(); }
    else if (e.key === ' ') { e.preventDefault(); hardDrop(); }
  });
  document.addEventListener('keyup', function (e) {
    if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') softDrop = false;
  });

  /* ---------- pause ---------- */
  function pauseGame() {
    if (state !== 'playing' || paused) return;
    paused = true;
    var resume = h('button', { class: 'mg-btn', type: 'button', text: 'Resume' });
    var restart = h('button', { class: 'mg-btn is-secondary', type: 'button', text: 'Start again' });
    resume.addEventListener('click', function () { paused = false; overlay.hidden = true; });
    restart.addEventListener('click', start);
    overlay.innerHTML = '';
    overlay.append(h('div', { class: 'mg-card', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Paused' },
      h('h2', { class: 'mg-title', text: 'Paused' }),
      h('p', { class: 'mg-sub', text: 'The blocks are frozen mid-fall. Take a breath.' }),
      h('div', { class: 'mg-row' }, restart, resume)));
    overlay.hidden = false;
    MG.focusSafe(resume, 300);
  }
  pauseBtn.addEventListener('click', function () {
    if (paused) { paused = false; overlay.hidden = true; } else pauseGame();
  });
  MG.onPause(pauseGame);

  /* ---------- start screen ---------- */
  function showStart() {
    var play = h('button', { class: 'mg-btn', type: 'button', text: 'Start stacking' });
    play.addEventListener('click', start);
    overlay.innerHTML = '';
    overlay.append(h('div', { class: 'mg-card', role: 'dialog', 'aria-label': 'Tetris' },
      h('div', { class: 'tt-badge', 'aria-hidden': 'true', text: '🧱' }),
      h('h2', { class: 'mg-title', text: 'Tetris' }),
      h('p', { class: 'mg-sub', text: 'Blocks fall from the top. Move and rotate them to fill whole lines — a full line clears, and four at once is a Tetris. The stack must never reach the top.' + (best ? ' Your best is ' + best + ' points.' : '') }),
      play));
    overlay.hidden = false;
  }

  /* ---------- sound button (same pattern as the other games) ---------- */
  soundBtn.addEventListener('click', function () { MG.sound.toggle(); renderSound(); });
  function renderSound() {
    soundBtn.innerHTML = MG.sound.muted
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z" fill="currentColor"/><path d="m16 9 6 6M22 9l-6 6"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z" fill="currentColor"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>';
    soundBtn.setAttribute('aria-label', MG.sound.muted ? 'Turn sound on' : 'Turn sound off');
  }

  /* ---------- drawing ---------- */
  function drawCell(x, y, key, alpha) {
    var p = PIECES[key];
    ctx.save();
    ctx.globalAlpha = alpha === undefined ? 1 : alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.roundRect(x + 1, y + 1, CELL - 2, CELL - 2, 5); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.38)';
    ctx.beginPath(); ctx.roundRect(x + 3, y + 3, CELL - 6, 8, 4); ctx.fill();
    ctx.fillStyle = p.dark;
    ctx.beginPath(); ctx.roundRect(x + 3, y + CELL - 7, CELL - 6, 4, 2); ctx.fill();
    ctx.restore();
  }
  function ghostY() {
    if (!cur) return 0;
    var y = cur.y;
    while (!collides(cur.cells, cur.x, y + 1)) y++;
    return y;
  }
  function drawPiece(cells, key, x, y, alpha) {
    cells.forEach(function (row, r) {
      row.forEach(function (v, c) { if (v) drawCell(BX + (x + c) * CELL, BY + (y + r) * CELL, key, alpha); });
    });
  }
  function draw() {
    if (!ctx) return;
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    var bg = ctx.createLinearGradient(0, 0, 0, ch);
    bg.addColorStop(0, '#1B1440'); bg.addColorStop(0.6, '#241B47'); bg.addColorStop(1, '#17112E');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, cw, ch);
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * ox, dpr * oy);
    // faint stars
    ctx.fillStyle = 'rgba(255,255,255,.5)';
    [[30, 30, 2], [450, 90, 2], [420, 600, 2], [20, 420, 1.6], [300, 20, 1.6], [460, 330, 1.8]].forEach(function (s) {
      ctx.beginPath(); ctx.arc(s[0], s[1], s[2], 0, 6.2832); ctx.fill();
    });
    // board frame
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    ctx.beginPath(); ctx.roundRect(BX - 6, BY - 6, BW + 12, BH + 12, 10); ctx.fill();
    ctx.fillStyle = '#0E0A24';
    ctx.beginPath(); ctx.roundRect(BX, BY, BW, BH, 6); ctx.fill();
    // grid lines
    ctx.strokeStyle = 'rgba(255,255,255,.05)'; ctx.lineWidth = 1;
    for (var gx = 1; gx < COLS; gx++) { ctx.beginPath(); ctx.moveTo(BX + gx * CELL, BY); ctx.lineTo(BX + gx * CELL, BY + BH); ctx.stroke(); }
    for (var gy = 1; gy < ROWS; gy++) { ctx.beginPath(); ctx.moveTo(BX, BY + gy * CELL); ctx.lineTo(BX + BW, BY + gy * CELL); ctx.stroke(); }
    // locked blocks
    var flashing = state === 'clearing' && Math.floor(clearTimer / 90) % 2 === 0;
    board.forEach(function (row, r) {
      row.forEach(function (v, c) {
        if (!v) return;
        if (flashing && clearRows.indexOf(r) >= 0) {
          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath(); ctx.roundRect(BX + c * CELL + 1, BY + r * CELL + 1, CELL - 2, CELL - 2, 5); ctx.fill();
        } else drawCell(BX + c * CELL, BY + r * CELL, v);
      });
    });
    // ghost + falling piece
    if (cur && state === 'playing') {
      var gy = ghostY();
      if (gy !== cur.y) {
        ctx.save(); ctx.globalAlpha = 0.28;
        cur.cells.forEach(function (row, r) {
          row.forEach(function (v, c) {
            if (!v) return;
            ctx.strokeStyle = PIECES[cur.key].color; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.roundRect(BX + (cur.x + c) * CELL + 2, BY + (gy + r) * CELL + 2, CELL - 4, CELL - 4, 5); ctx.stroke();
          });
        });
        ctx.restore();
      }
      drawPiece(cur.cells, cur.key, cur.x, cur.y);
    }
    // next panel
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,.08)';
    ctx.beginPath(); ctx.roundRect(NX - 8, NY - 8, 136, 132, 12); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.font = '800 12px Poppins, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('NEXT', NX + 60, NY + 10);
    if (nextKey) {
      var p = PIECES[nextKey], n = p.cells.length;
      var px = NX + 60 - (n * CELL) / 2, py = NY + 34;
      p.cells.forEach(function (row, r) {
        row.forEach(function (v, c) { if (v) drawCell(px + c * CELL, py + r * CELL, nextKey); });
      });
    }
    // level + speed note
    ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.font = '800 12px Poppins, sans-serif';
    ctx.fillText('SPEED', NX + 60, NY + 168);
    ctx.font = '700 13px Poppins, sans-serif'; ctx.fillStyle = '#FACC15';
    ctx.fillText('Lv ' + level + ' · ' + Math.round(1000 / dropInterval() * 10) / 10 + '/s', NX + 60, NY + 188);
    // mini legend of the seven pieces
    ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.font = '700 11px Poppins, sans-serif';
    ctx.fillText('7 PIECES', NX + 60, NY + 224);
    KEYS.forEach(function (k, i) {
      var py2 = NY + 244 + i * 30;
      PIECES[k].cells.forEach(function (row, r) {
        row.forEach(function (v, c) {
          if (!v) return;
          ctx.fillStyle = PIECES[k].color;
          ctx.beginPath(); ctx.roundRect(NX + 18 + c * 9, py2 + r * 9, 8, 8, 2); ctx.fill();
        });
      });
      ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.font = '700 12px Poppins, sans-serif'; ctx.textAlign = 'left';
      ctx.fillText(k === 'I' ? 'I — straight' : k === 'O' ? 'O — square' : k === 'T' ? 'T — tee' : k === 'S' ? 'S — skew' : k === 'Z' ? 'Z — skew' : k === 'J' ? 'J — hook' : 'L — hook', NX + 58, py2 + 12);
      ctx.textAlign = 'center';
    });
    ctx.restore();
    // popups
    ctx.save();
    ctx.textAlign = 'center'; ctx.font = '900 24px Poppins, sans-serif';
    popups.forEach(function (pp) {
      ctx.globalAlpha = Math.max(0, 1 - pp.t / 1.1);
      ctx.fillStyle = '#FACC15';
      ctx.fillText(pp.text, pp.x, pp.y - pp.t * 34);
    });
    ctx.restore();
    ctx.restore();
  }

  /* ---------- main loop ---------- */
  function tick(now) {
    requestAnimationFrame(tick);
    var dt = Math.min(50, Math.max(0, now - (lastTick || now))) / 1000;
    lastTick = now;
    if (!paused && !SHOWCASE) {
      if (state === 'playing' && cur) {
        dropTimer += dt * 1000;
        if (dropTimer >= dropInterval()) { dropTimer = 0; stepDown(false); }
      } else if (state === 'clearing') {
        clearTimer += dt * 1000;
        if (clearTimer >= 200) finishClearing();
      }
      popups.forEach(function (p) { p.t += dt; });
      popups = popups.filter(function (p) { return p.t < 1.1; });
    }
    draw();
  }

  /* ---------- start ---------- */
  renderSound(); renderHud(); emptyBoard();
  nextKey = drawPieceKey();
  spawn();
  showStart();
  requestAnimationFrame(tick);
  if (SHOWCASE) { // still frame: a tall stack, one line nearly complete, a T piece falling
    overlay.hidden = true; state = 'playing';
    board = [
      [null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, 'Z', null, null, null, null],
      [null, null, null, null, 'L', 'L', 'L', null, null, null],
      [null, null, 'J', 'J', 'J', 'S', 'S', null, null, null],
      [null, 'T', 'T', 'T', 'O', 'O', 'S', 'S', null, null],
      ['I', 'I', 'I', 'I', 'O', 'O', 'Z', 'Z', 'J', null],
      ['L', 'L', 'J', 'J', 'T', 'T', 'T', 'Z', 'Z', 'J'],
      ['S', 'S', 'O', 'O', 'I', 'I', 'I', 'I', 'L', null]
    ];
    score = 1250; lines = 14; level = 2;
    nextKey = 'I';
    cur = { key: 'T', cells: PIECES.T.cells.map(function (row) { return row.slice(); }), x: 4, y: 8 };
    root.classList.add('is-showcase');
    renderHud();
    setTimeout(function () { document.documentElement.setAttribute('data-ready', '1'); }, 80);
  }
  MG.ready();
})();
