/* Snake engine: realistic snake on a forest-floor habitat.
 * Options: { cols, rows, showcase } (showcase renders one still frame for cover art). */
(function () {
  'use strict';
  var MG = window.MG, h = MG.h;
  var opts = window.GAME_OPTIONS || {};
  var SHOW = !!opts.showcase;
  var SKIP = {}; (opts.skip || []).forEach(function (k) { SKIP[k] = 1; });
  var MAXC = opts.cols || 20, MAXR = opts.rows || 20, COLS = MAXC, ROWS = MAXR;
  var DIRS = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
  var KEYMAP = {
    ArrowUp: 'up', KeyW: 'up', w: 'up', W: 'up', ArrowDown: 'down', KeyS: 'down', s: 'down', S: 'down',
    ArrowLeft: 'left', KeyA: 'left', a: 'left', A: 'left', ArrowRight: 'right', KeyD: 'right', d: 'right', D: 'right'
  };
  var ICON = {
    pause: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1.5"/><rect x="14" y="5" width="4" height="14" rx="1.5"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.9l10-6.5a1 1 0 0 0 0-1.7l-10-6.5A1 1 0 0 0 8 5.5Z"/></svg>',
    soundOn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z" fill="currentColor"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>',
    soundOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z" fill="currentColor"/><path d="m16 9 6 6M22 9l-6 6"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 6.5 19 15H5l7-8.5Z"/></svg>'
  };

  /* ---------------------------------------------------------------- DOM */
  var scoreEl = h('b', { text: '0' }), bestEl = h('b', { text: '0' }), modeEl = h('small', { text: 'Classic' });
  var pauseBtn = h('button', { class: 'mg-icon-btn', type: 'button', 'aria-label': 'Pause', html: ICON.pause });
  var soundBtn = h('button', { class: 'mg-icon-btn', type: 'button' });
  var canvas = h('canvas', { role: 'img', 'aria-label': 'Snake game board' });
  var stage = h('div', { class: 'snake-stage' }, canvas);
  var overlay = h('div', { class: 'mg-overlay' });
  var live = h('div', { class: 'mg-sr', 'aria-live': 'polite' });
  var pad = h('div', { class: 'snake-pad' }, h('div', { class: 'pad' }, padBtn('up', 'Up'), padBtn('left', 'Left'), padBtn('down', 'Down'), padBtn('right', 'Right')));
  var rootEl = h('div', { class: 'mg-root snake' + (SHOW ? ' is-showcase' : '') },
    h('div', { class: 'mg-hud' },
      h('span', { class: 'mg-pill' }, h('small', { text: 'Score' }), scoreEl),
      h('span', { class: 'mg-pill' }, h('small', { text: 'Best' }), bestEl),
      h('span', { class: 'mg-pill snake-mode' }, modeEl),
      h('span', { class: 'mg-spacer' }), pauseBtn, soundBtn),
    stage, pad, overlay, live);
  document.getElementById('game').append(rootEl);
  function padBtn(dir, label) {
    var b = h('button', { class: 'pad-' + dir, type: 'button', 'aria-label': label, html: ICON.arrow });
    b.addEventListener('pointerdown', function (e) { e.preventDefault(); input(dir); });
    return b;
  }
  function renderSoundBtn() {
    soundBtn.innerHTML = MG.sound.muted ? ICON.soundOff : ICON.soundOn;
    soundBtn.setAttribute('aria-label', MG.sound.muted ? 'Turn sound on' : 'Turn sound off');
  }
  soundBtn.addEventListener('click', function () { MG.sound.toggle(); renderSoundBtn(); });
  renderSoundBtn();

  /* ---------------------------------------------------------------- state */
  var mode = SHOW ? 'classic' : MG.store.get('mode', 'classic'); // 'classic' | 'wrap'
  var snake, prevTail, grew, dir, queue, food, bonus, score, eaten, interval, bulges;
  var state = 'idle'; // idle | running | paused | dying | over
  var acc = 0, lastT = 0, raf = 0, idleTimer = 0, particles = [], shake = 0, deathFlash = 0;
  var tongue = { next: 1200, t: -1 }; // tongue flick timer (ms)
  var travel = 0; // cells moved, drives the slither wave so the body follows one wavy track
  // Adaptive detail: if drawing gets slow on a weak device, drop the costliest layers first (3 = full detail).
  var quality = 3, drawAvg = 0, frameCount = 0;

  function best() { return MG.store.get('best-' + mode, 0); }
  function setBest(v) { MG.store.set('best-' + mode, v); }
  function updateHud() {
    scoreEl.textContent = score; bestEl.textContent = Math.max(best(), score);
    modeEl.textContent = mode === 'wrap' ? 'No walls' : 'Classic';
  }
  // Board size follows the screen: cells stay at least ~26px so the snake's details are visible on phones.
  function pickGrid() {
    if (SHOW) return false;
    var r = stage.getBoundingClientRect(), oc = COLS, or = ROWS;
    if (r.width > 0 && r.height > 0) {
      COLS = Math.max(12, Math.min(MAXC, Math.floor((r.width - 16) / 26 - 1.5)));
      ROWS = Math.max(12, Math.min(MAXR, Math.floor((r.height - 8) / 26 - 1.5)));
    }
    return oc !== COLS || or !== ROWS;
  }
  function reset() {
    if (pickGrid() && ctx) resize();
    var cy = Math.floor(ROWS / 2);
    snake = [{ x: 6, y: cy }, { x: 5, y: cy }, { x: 4, y: cy }];
    prevTail = { x: 3, y: cy }; grew = false;
    dir = DIRS.right; queue = []; score = 0; eaten = 0; interval = 135; bonus = null; bulges = [];
    particles = []; deathFlash = 0; acc = 0;
    placeFood(); updateHud();
  }
  function occupied(x, y) { for (var i = 0; i < snake.length; i++) if (snake[i].x === x && snake[i].y === y) return true; return false; }
  function freeCell() {
    var free = [];
    for (var y = 0; y < ROWS; y++) for (var x = 0; x < COLS; x++) {
      if (!occupied(x, y) && !(food && food.x === x && food.y === y) && !(bonus && bonus.x === x && bonus.y === y)) free.push({ x: x, y: y });
    }
    return free.length ? free[(Math.random() * free.length) | 0] : null;
  }
  function placeFood() {
    food = null;
    var c = freeCell();
    if (c) { c.tilt = (Math.random() - 0.5) * 0.7; c.born = performance.now(); c.seed = (Math.random() * 1e6) | 0; }
    food = c;
  }

  function input(name) {
    if (SHOW) return;
    if (state === 'idle' || state === 'over') { start(name); return; }
    if (state === 'paused') resume();
    if (state !== 'running') return;
    var nd = DIRS[name], last = queue.length ? queue[queue.length - 1] : dir;
    if (nd === last || (nd.x === -last.x && nd.y === -last.y)) return;
    if (queue.length < 3) queue.push(nd);
  }
  function start(firstDir) {
    if (state === 'running' || state === 'dying') return;
    // No ad before the first game; an ad break (when ads are enabled) can only happen between games.
    (state === 'over' ? function (cb) { MG.adBreak('next', 'snake-restart', cb); } : function (cb) { cb(); })(function () {
      reset();
      state = 'running'; overlay.hidden = true;
      if (firstDir && DIRS[firstDir] !== DIRS.left && DIRS[firstDir] !== dir) queue.push(DIRS[firstDir]);
      pauseBtn.innerHTML = ICON.pause; pauseBtn.setAttribute('aria-label', 'Pause');
      MG.event('game_start', { mode: mode }); MG.sfx.tap();
      lastT = 0; loop();
    });
  }
  function pause() {
    if (state !== 'running') return;
    state = 'paused'; pauseBtn.innerHTML = ICON.play; pauseBtn.setAttribute('aria-label', 'Resume');
    showOverlay('paused');
  }
  function resume() {
    if (state !== 'paused') return;
    state = 'running'; overlay.hidden = true;
    pauseBtn.innerHTML = ICON.pause; pauseBtn.setAttribute('aria-label', 'Pause');
    lastT = 0; loop();
  }
  pauseBtn.addEventListener('click', function () { if (state === 'running') pause(); else if (state === 'paused') resume(); else start(); });
  MG.onPause(pause);

  function die() {
    state = 'dying'; shake = 1; deathFlash = 1;
    MG.sfx.bad(); MG.vibrate(120);
    var isBest = score > best();
    if (isBest) setBest(score);
    MG.event('game_over', { score: score, mode: mode, best: isBest });
    live.textContent = 'Game over. Score ' + score + '.';
    setTimeout(function () {
      state = 'over'; showOverlay('over', isBest); draw(1);
      if (isBest && score > 0) { MG.sfx.win(); MG.confetti(); }
    }, 700);
  }
  function step() {
    if (queue.length) dir = queue.shift();
    var head = snake[0], nx = head.x + dir.x, ny = head.y + dir.y;
    if (mode === 'wrap') { nx = (nx + COLS) % COLS; ny = (ny + ROWS) % ROWS; }
    else if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) { die(); return; }
    var eats = food && food.x === nx && food.y === ny;
    var len = eats ? snake.length : snake.length - 1;
    for (var i = 0; i < len; i++) if (snake[i].x === nx && snake[i].y === ny) { die(); return; }
    prevTail = snake[snake.length - 1];
    snake.unshift({ x: nx, y: ny });
    travel += 1;
    grew = !!eats;
    for (var b = bulges.length - 1; b >= 0; b--) { bulges[b] += 0.62; if (bulges[b] > snake.length) bulges.splice(b, 1); }
    if (eats) {
      score += 1; eaten += 1;
      interval = Math.max(62, 135 - eaten * 2.6);
      shell(nx, ny, false); MG.sfx.eat();
      bulges.push(0.2);
      placeFood();
      if (!bonus && eaten % 7 === 0) { var c = freeCell(); if (c) bonus = { x: c.x, y: c.y, born: performance.now(), life: 5200 }; }
    } else snake.pop();
    if (bonus && bonus.x === nx && bonus.y === ny) {
      score += 5; shell(nx, ny, true); MG.sfx.bonus(); bonus = null; bulges.push(0.2); toast('+5');
    }
    updateHud();
  }
  function toast(text) { var t = h('div', { class: 'mg-toast', text: text }); rootEl.append(t); setTimeout(function () { t.remove(); }, 1600); }

  /* ---------------------------------------------------------------- rendering */
  var cell = 16, M = 12, W = 0, H = 0, CW = 0, CH = 0, ctx = null, bg = null, scalePat = null, DPR = 1;
  var SN = { edge: '#1C3510', base: '#4C9628', top: 'rgba(170,222,96,.55)', spine: 'rgba(226,248,170,.24)', blotch: 'rgba(36,74,18,.62)', spot: 'rgba(206,240,132,.55)', headA: '#7CC444', headB: '#3E7D21', plate: 'rgba(38,84,20,.7)', dead: '#C7343A' };
  function isDark() {
    var t = document.documentElement.getAttribute('data-theme');
    if (t === 'dark') return true; if (t === 'light') return false;
    try { return matchMedia('(prefers-color-scheme: dark)').matches; } catch (e) { return false; }
  }
  function seeded(s) { s = (s % 2147483646) + 1; return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }

  function resize() {
    var r = stage.getBoundingClientRect();
    var availW = Math.max(150, r.width - (SHOW ? 0 : 16)), availH = Math.max(150, r.height - (SHOW ? 0 : 8));
    cell = Math.max(9, Math.floor(Math.min(availW / (COLS + 1.5), availH / (ROWS + 1.5))));
    M = Math.round(cell * 0.75);
    W = cell * COLS; H = cell * ROWS; CW = W + 2 * M; CH = H + 2 * M;
    DPR = Math.min(window.devicePixelRatio || 1, 2.5);
    ctx = MG.fitCanvas(canvas, CW, CH);
    buildBackground(); buildScales();
    draw(state === 'running' ? Math.min(acc / interval, 1) : 1);
  }

  /* Habitat: grassy forest floor with soil, moss, pebbles, leaves and a ring of stones (classic) or tall grass (no walls). */
  function buildBackground() {
    var dark = isDark();
    var P = dark
      ? { g1: '#34552A', g2: '#22391C', bladeD: '#16290F', bladeL: '#57843B', soil: '#55412A', moss: '#3F6B2A', check: 'rgba(255,255,255,.035)', stoneA: '#7C7A70', stoneB: '#4A4943', vign: 'rgba(0,0,0,.35)' }
      : { g1: '#86B852', g2: '#5E9535', bladeD: '#3E6C23', bladeL: '#B4DC78', soil: '#94713F', moss: '#4E8A2C', check: 'rgba(255,255,255,.06)', stoneA: '#B3B0A2', stoneB: '#7A776B', vign: 'rgba(20,40,10,.28)' };
    bg = document.createElement('canvas');
    bg.width = Math.round(CW * DPR); bg.height = Math.round(CH * DPR);
    var b = bg.getContext('2d'); b.setTransform(DPR, 0, 0, DPR, 0, 0);
    var R = seeded(9871 + COLS * 7 + ROWS);
    var g = b.createLinearGradient(0, 0, CW, CH); g.addColorStop(0, P.g1); g.addColorStop(1, P.g2);
    b.fillStyle = g; b.fillRect(0, 0, CW, CH);
    var i, x, y, r, rg;
    for (i = 0; i < Math.round(COLS * ROWS / 14); i++) { // soil and moss patches
      x = R() * CW; y = R() * CH; r = (0.9 + R() * 2.4) * cell;
      rg = b.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, R() < 0.4 ? P.soil : P.moss); rg.addColorStop(1, 'rgba(0,0,0,0)');
      b.globalAlpha = 0.18 + R() * 0.16; b.fillStyle = rg; b.fillRect(x - r, y - r, r * 2, r * 2);
    }
    b.lineCap = 'round';
    var blades = Math.round(CW * CH / (cell * cell) * 26);
    for (i = 0; i < blades; i++) { // grass texture
      x = R() * CW; y = R() * CH;
      var len = (0.1 + R() * 0.24) * cell, a = -Math.PI / 2 + (R() - 0.5) * 1.2;
      b.globalAlpha = 0.18 + R() * 0.4;
      b.strokeStyle = R() < 0.55 ? P.bladeD : P.bladeL;
      b.lineWidth = Math.max(0.8, cell * (0.03 + R() * 0.03));
      b.beginPath(); b.moveTo(x, y);
      b.quadraticCurveTo(x + Math.cos(a) * len * 0.5 + (R() - .5) * len * .4, y + Math.sin(a) * len * 0.5, x + Math.cos(a) * len, y + Math.sin(a) * len);
      b.stroke();
    }
    b.globalAlpha = 1; b.fillStyle = P.check; // faint checker keeps the grid readable
    for (y = 0; y < ROWS; y++) for (x = (y % 2); x < COLS; x += 2) b.fillRect(M + x * cell, M + y * cell, cell, cell);
    for (i = 0; i < Math.round(COLS * ROWS / 16); i++) decor(b, R, P, M + R() * W, M + R() * H);
    if (mode === 'classic') stones(b, R, P); else tallGrass(b, R, P);
    b.globalAlpha = 1;
    rg = b.createRadialGradient(CW / 2, CH / 2, Math.min(CW, CH) * 0.35, CW / 2, CH / 2, Math.max(CW, CH) * 0.75);
    rg.addColorStop(0, 'rgba(0,0,0,0)'); rg.addColorStop(1, P.vign);
    b.fillStyle = rg; b.fillRect(0, 0, CW, CH);
  }
  function decor(b, R, P, x, y) {
    var k = R();
    b.save(); b.translate(x, y); b.rotate(R() * Math.PI * 2);
    if (k < 0.38) { // pebble
      var rx = cell * (0.08 + R() * 0.1), ry = rx * (0.65 + R() * 0.25);
      b.globalAlpha = 0.6; b.fillStyle = 'rgba(0,0,0,.35)'; b.beginPath(); b.ellipse(rx * .2, ry * .35, rx, ry, 0, 0, 7); b.fill();
      var pg = b.createRadialGradient(-rx * .4, -ry * .4, 0, 0, 0, rx * 1.2); pg.addColorStop(0, P.stoneA); pg.addColorStop(1, P.stoneB);
      b.globalAlpha = 0.75; b.fillStyle = pg; b.beginPath(); b.ellipse(0, 0, rx, ry, 0, 0, 7); b.fill();
    } else if (k < 0.7) { // fallen leaf
      var L = cell * (0.22 + R() * 0.16), Wd = L * 0.42, hue = R();
      b.globalAlpha = 0.55;
      b.fillStyle = hue < 0.4 ? '#B8862E' : hue < 0.75 ? '#8E6A2A' : '#6E8F2A';
      b.beginPath(); b.moveTo(-L / 2, 0); b.quadraticCurveTo(0, -Wd, L / 2, 0); b.quadraticCurveTo(0, Wd, -L / 2, 0); b.fill();
      b.strokeStyle = 'rgba(60,40,10,.5)'; b.lineWidth = Math.max(0.6, cell * 0.02);
      b.beginPath(); b.moveTo(-L / 2, 0); b.lineTo(L / 2, 0); b.stroke();
    } else if (k < 0.86) { // tiny wild flowers
      var n = 2 + ((R() * 3) | 0);
      for (var f = 0; f < n; f++) {
        var fx = (R() - .5) * cell * .5, fy = (R() - .5) * cell * .5, pr = cell * (0.035 + R() * 0.02);
        b.globalAlpha = 0.85; b.fillStyle = R() < 0.6 ? '#FFFFFF' : '#FFE27A';
        for (var p = 0; p < 5; p++) { var an = p * 1.2566; b.beginPath(); b.arc(fx + Math.cos(an) * pr, fy + Math.sin(an) * pr, pr * 0.8, 0, 7); b.fill(); }
        b.fillStyle = '#E8A21C'; b.beginPath(); b.arc(fx, fy, pr * 0.6, 0, 7); b.fill();
      }
    } else { // twig
      var tl = cell * (0.4 + R() * 0.4);
      b.globalAlpha = 0.5; b.strokeStyle = '#5A4126'; b.lineWidth = Math.max(1, cell * 0.045); b.lineCap = 'round';
      b.beginPath(); b.moveTo(-tl / 2, 0); b.quadraticCurveTo(0, cell * 0.06, tl / 2, -cell * 0.04); b.stroke();
      b.lineWidth = Math.max(0.7, cell * 0.03); b.beginPath(); b.moveTo(0, cell * 0.02); b.lineTo(cell * 0.12, -cell * 0.1); b.stroke();
    }
    b.restore(); b.globalAlpha = 1;
  }
  function stones(b, R, P) {
    b.save(); b.strokeStyle = 'rgba(0,0,0,.28)'; b.lineWidth = Math.max(2, cell * 0.08); b.strokeRect(M, M, W, H); b.restore();
    var edges = [[0, 0, CW, 0], [CW, 0, CW, CH], [CW, CH, 0, CH], [0, CH, 0, 0]];
    edges.forEach(function (e) {
      var len = Math.hypot(e[2] - e[0], e[3] - e[1]), n = Math.ceil(len / (cell * 0.62));
      var nx = e[3] - e[1], ny = e[0] - e[2], nl = Math.hypot(nx, ny) || 1;
      for (var i = 0; i <= n; i++) {
        var t = i / n, x = e[0] + (e[2] - e[0]) * t - nx / nl * M * 0.5, y = e[1] + (e[3] - e[1]) * t - ny / nl * M * 0.5;
        var rx = M * (0.5 + R() * 0.18), ry = M * (0.4 + R() * 0.14);
        b.save(); b.translate(x, y); b.rotate(R() * Math.PI);
        b.fillStyle = 'rgba(0,0,0,.32)'; b.beginPath(); b.ellipse(rx * .12, ry * .3, rx, ry, 0, 0, 7); b.fill();
        var sg = b.createRadialGradient(-rx * .4, -ry * .5, 0, 0, 0, rx * 1.15);
        sg.addColorStop(0, P.stoneA); sg.addColorStop(1, P.stoneB);
        b.fillStyle = sg; b.beginPath(); b.ellipse(0, 0, rx, ry, 0, 0, 7); b.fill();
        if (R() < 0.35) { b.globalAlpha = 0.45; b.fillStyle = P.moss; b.beginPath(); b.ellipse(rx * .2, -ry * .3, rx * .55, ry * .4, .3, 0, 7); b.fill(); b.globalAlpha = 1; }
        b.restore();
      }
    });
  }
  function tallGrass(b, R, P) {
    var w = M;
    b.save();
    b.fillStyle = 'rgba(0,0,0,.16)';
    b.fillRect(0, 0, CW, w); b.fillRect(0, CH - w, CW, w); b.fillRect(0, 0, w, CH); b.fillRect(CW - w, 0, w, CH);
    b.lineCap = 'round';
    for (var i = 0; i < (CW + CH) * 2 / (cell * 0.12); i++) {
      var side = (R() * 4) | 0, x, y;
      if (side === 0) { x = R() * CW; y = R() * w; } else if (side === 1) { x = R() * CW; y = CH - R() * w; }
      else if (side === 2) { x = R() * w; y = R() * CH; } else { x = CW - R() * w; y = R() * CH; }
      var len = cell * (0.3 + R() * 0.35), a = -Math.PI / 2 + (R() - .5) * 0.9;
      b.globalAlpha = 0.5 + R() * 0.4; b.strokeStyle = R() < 0.5 ? P.bladeD : P.moss; b.lineWidth = Math.max(1, cell * 0.05);
      b.beginPath(); b.moveTo(x, y);
      b.quadraticCurveTo(x + Math.cos(a) * len * .5 + (R() - .5) * len * .3, y + Math.sin(a) * len * .5, x + Math.cos(a) * len, y + Math.sin(a) * len);
      b.stroke();
    }
    b.restore();
  }
  function buildScales() { // small scale texture laid over the body
    var s = Math.max(4, Math.round(cell * 0.2)), c = document.createElement('canvas');
    c.width = s * 2; c.height = s * 2;
    var x = c.getContext('2d');
    x.strokeStyle = 'rgba(16,38,8,.55)'; x.lineWidth = Math.max(0.7, s * 0.12);
    [[0, 0], [s, 0], [2 * s, 0], [s / 2, s], [1.5 * s, s], [0, 2 * s], [s, 2 * s], [2 * s, 2 * s], [-s / 2, s], [2.5 * s, s]].forEach(function (p) {
      x.beginPath(); x.ellipse(p[0], p[1], s * 0.52, s * 0.62, 0, 0, Math.PI); x.stroke();
    });
    scalePat = ctx.createPattern(c, 'repeat');
  }
  MG.themeChanged(function () { buildBackground(); draw(1); });
  if (window.ResizeObserver) new ResizeObserver(resize).observe(stage); else window.addEventListener('resize', resize);

  function px(v) { return M + (v + 0.5) * cell; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function adjacent(p, q) { return Math.abs(p.x - q.x) + Math.abs(p.y - q.y) === 1; }

  /* Body centre-line as runs of points (a run breaks where the snake wraps around an edge),
   * corners smoothed, then resampled every few pixels so width and markings can vary along the body. */
  function bodyRuns(t) {
    var n = snake.length, pts = [];
    var tailTo = snake[n - 1], tailFrom = grew ? tailTo : prevTail;
    if (tailFrom === tailTo || adjacent(tailFrom, tailTo)) pts.push({ x: lerp(px(tailFrom.x), px(tailTo.x), t), y: lerp(px(tailFrom.y), px(tailTo.y), t) });
    else pts.push({ x: px(tailTo.x), y: px(tailTo.y), brk: true });
    for (var i = n - 1; i >= 1; i--) pts.push({ x: px(snake[i].x), y: px(snake[i].y) });
    var hd = snake[0], nk = snake[1];
    if (adjacent(nk, hd)) pts.push({ x: lerp(px(nk.x), px(hd.x), t), y: lerp(px(nk.y), px(hd.y), t) });
    else pts.push({ x: px(hd.x), y: px(hd.y), brk: true });
    var runs = [], cur = [];
    for (var j = 0; j < pts.length; j++) {
      var p = pts[j];
      if (cur.length) { var q = cur[cur.length - 1]; if (p.brk || Math.abs(p.x - q.x) > cell * 1.5 || Math.abs(p.y - q.y) > cell * 1.5) { runs.push(cur); cur = []; } }
      cur.push({ x: p.x, y: p.y });
    }
    runs.push(cur);
    var out = runs.map(function (r) { return resample(chaikin(chaikin(r))); });
    var total = 0; out.forEach(function (r) { total += (r.length - 1) * r.step; });
    var A = cell * 0.075, lambda = cell * 2.6, phase = (travel + t) * cell, sAt = 0;
    out.forEach(function (r) {
      for (var k = 0; k < r.length; k++) {
        var s = sAt + k * r.step, fromHead = total - s;
        var env = Math.min(1, Math.max(0, (fromHead - cell * 0.5) / (cell * 1.2))) * Math.min(1, s / (cell * 0.8));
        var o = A * env * Math.sin(2 * Math.PI * (phase - fromHead) / lambda);
        r[k].x -= r[k].ty * o; r[k].y += r[k].tx * o;
      }
      for (k = 0; k < r.length; k++) { // recompute tangents after the offset
        var P0 = r[Math.max(0, k - 1)], P1 = r[Math.min(r.length - 1, k + 1)], tl = Math.hypot(P1.x - P0.x, P1.y - P0.y) || 1;
        r[k].tx = (P1.x - P0.x) / tl; r[k].ty = (P1.y - P0.y) / tl;
      }
      sAt += (r.length - 1) * r.step;
    });
    return out;
  }
  function chaikin(p) {
    if (p.length < 3) return p;
    var o = [p[0]];
    for (var i = 0; i < p.length - 1; i++) {
      var a = p[i], b = p[i + 1];
      if (i > 0) o.push({ x: a.x * .75 + b.x * .25, y: a.y * .75 + b.y * .25 });
      if (i < p.length - 2) o.push({ x: a.x * .25 + b.x * .75, y: a.y * .25 + b.y * .75 });
    }
    o.push(p[p.length - 1]);
    return o;
  }
  function resample(p) {
    var step = Math.max(2, cell / 7), out = [{ x: p[0].x, y: p[0].y }], carry = 0;
    for (var i = 0; i < p.length - 1; i++) {
      var a = p[i], b = p[i + 1], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
      if (!d) continue;
      var s = step - carry;
      while (s <= d) { out.push({ x: a.x + dx * s / d, y: a.y + dy * s / d }); s += step; }
      carry = d - (s - step);
    }
    var last = p[p.length - 1], lo = out[out.length - 1];
    if (Math.hypot(last.x - lo.x, last.y - lo.y) > 0.3) out.push({ x: last.x, y: last.y });
    if (out.length === 1) out.push({ x: out[0].x + 0.01, y: out[0].y });
    for (var k = 0; k < out.length; k++) { // unit tangents
      var A = out[Math.max(0, k - 1)], B = out[Math.min(out.length - 1, k + 1)], tl = Math.hypot(B.x - A.x, B.y - A.y) || 1;
      out[k].tx = (B.x - A.x) / tl; out[k].ty = (B.y - A.y) / tl;
    }
    out.step = step;
    return out;
  }

  function drawSnake(t, now) {
    var runs = bodyRuns(t);
    var total = 0; runs.forEach(function (r) { total += (r.length - 1) * r.step; });
    var w = cell * 0.74, taper = Math.min(cell * 2.6, total * 0.55);
    var bul = bulges.map(function (b) { return total - (b + t * 0.62) * cell; }); // swallowed eggs travelling down the body
    function width(s) {
      var k = s < taper ? 0.22 + 0.78 * Math.pow(Math.max(0, s) / taper, 0.75) : 1;
      var u = s / Math.max(1, total); k *= 0.93 + 0.12 * Math.sin(Math.PI * Math.min(1, u * 1.15)); // fuller mid-body
      if (s > total - cell * 0.55) k *= 0.9; // slimmer neck behind the head
      var v = w * k;
      for (var i = 0; i < bul.length; i++) { var d = (s - bul[i]) / (cell * 0.42); if (d > -3 && d < 3) v += w * 0.32 * Math.exp(-d * d); }
      return v;
    }
    var flash = deathFlash > 0 && Math.floor(deathFlash * 10) % 2;
    var sAt = 0;
    runs.forEach(function (run, ri) {
      var s0 = sAt; sAt += (run.length - 1) * run.step;
      // shadow on the ground
      if (!SKIP.shadow && quality >= 1) {
      ctx.save(); ctx.translate(cell * 0.09, cell * 0.14);
      ctx.fillStyle = 'rgba(10,25,5,.30)'; outline(run, s0, width); ctx.fill();
      ctx.restore(); }
      ctx.fillStyle = flash ? SN.dead : SN.edge; outline(run, s0, function (s) { return width(s) + Math.max(1.4, cell * 0.06); }); ctx.fill();
      ctx.fillStyle = flash ? SN.dead : SN.base; outline(run, s0, width); ctx.fill();
      // markings: dark saddles with pale flecks along the back
      var spacing = cell * 0.82, end = s0 + (run.length - 1) * run.step;
      for (var k = Math.ceil(s0 / spacing); !SKIP.marks && quality >= 1 && k * spacing < end; k++) {
        var s = k * spacing; if (s < taper * 0.35 || s > total - cell * 0.75) continue;
        var p = run[Math.min(run.length - 1, Math.round((s - s0) / run.step))], ww = width(s);
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.atan2(p.ty, p.tx));
        ctx.fillStyle = SN.blotch; ctx.beginPath(); ctx.ellipse(0, 0, cell * 0.2, ww * 0.42, 0, 0, 7); ctx.fill();
        ctx.fillStyle = SN.spot;
        ctx.beginPath(); ctx.ellipse(cell * 0.36, ww * 0.3, cell * 0.06, ww * 0.08, 0, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.ellipse(cell * 0.36, -ww * 0.3, cell * 0.06, ww * 0.08, 0, 0, 7); ctx.fill();
        ctx.restore();
      }
      if (scalePat && !SKIP.scales && quality >= 3) { ctx.save(); ctx.globalAlpha = 0.3; ctx.fillStyle = scalePat; outline(run, s0, width); ctx.fill(); ctx.restore(); }
      // rounded shading: shadowed flanks, then soft lighter bands toward the lit side, then a thin specular line
      if (!SKIP.bands && quality >= 2) { ctx.fillStyle = 'rgba(10,30,4,.22)'; outline(run, s0, width, 0.1); ctx.fill(); }
      // level of detail: very long snakes get fewer shading passes so the frame rate stays smooth on phones
      (SKIP.bands || quality < 1 ? [] : quality < 3 ? [[0.5, 0.26]] : [[0.78, 0.12], [0.56, 0.13], [0.34, 0.14]]).forEach(function (b) {
        ctx.fillStyle = 'rgba(190,236,110,' + b[1] + ')'; outline(run, s0, function (s) { return width(s) * b[0]; }, -0.08); ctx.fill();
      });
      ctx.strokeStyle = SN.spine; ctx.lineWidth = Math.max(1, cell * 0.06); ctx.lineCap = 'round';
      ctx.beginPath();
      for (var i = 0; i < run.length; i++) {
        var q = run[i], sh = -width(s0 + i * run.step) * 0.16, X = q.x - q.ty * sh, Y = q.y + q.tx * sh;
        if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y);
      }
      ctx.stroke();
      if (ri === runs.length - 1) drawHead(run[run.length - 1], flash);
    });
  }
  // Closed outline of a body run with variable width; `shift` slides the band sideways (toward the light).
  function outline(run, s0, wf, shift) {
    var i, p, hw, off, ang;
    ctx.beginPath();
    for (i = 0; i < run.length; i++) {
      p = run[i]; hw = wf(s0 + i * run.step) / 2; off = shift ? hw * shift * 2 : 0;
      var x = p.x - p.ty * (hw + off), y = p.y + p.tx * (hw + off);
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    p = run[run.length - 1]; hw = wf(s0 + (run.length - 1) * run.step) / 2; off = shift ? hw * shift * 2 : 0;
    ang = Math.atan2(p.ty, p.tx);
    ctx.arc(p.x - p.ty * off, p.y + p.tx * off, hw, ang - Math.PI / 2, ang + Math.PI / 2);
    for (i = run.length - 1; i >= 0; i--) {
      p = run[i]; hw = wf(s0 + i * run.step) / 2; off = shift ? hw * shift * 2 : 0;
      ctx.lineTo(p.x + p.ty * (hw - off), p.y - p.tx * (hw - off));
    }
    p = run[0]; hw = wf(s0) / 2; off = shift ? hw * shift * 2 : 0; ang = Math.atan2(p.ty, p.tx);
    ctx.arc(p.x - p.ty * off, p.y + p.tx * off, hw, ang + Math.PI / 2, ang + Math.PI * 1.5);
    ctx.closePath();
  }
  function drawHead(p, flash) {
    var c = cell, a = Math.atan2(p.ty, p.tx);
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(a);
    function shape(g) {
      ctx.beginPath();
      ctx.moveTo(-0.32 * c, -0.36 * c * g);
      ctx.bezierCurveTo(0.08 * c, -0.52 * c * g, 0.46 * c, -0.4 * c * g, 0.6 * c, -0.06 * c * g);
      ctx.quadraticCurveTo(0.66 * c, 0, 0.6 * c, 0.06 * c * g);
      ctx.bezierCurveTo(0.46 * c, 0.4 * c * g, 0.08 * c, 0.52 * c * g, -0.32 * c, 0.36 * c * g);
      ctx.closePath();
    }
    ctx.save(); ctx.translate(c * .06, c * .1); ctx.fillStyle = 'rgba(10,25,5,.3)'; shape(1); ctx.fill(); ctx.restore();
    if (tongue.t >= 0 && !flash) { // forked tongue flick
      var k = Math.sin(Math.PI * Math.min(1, tongue.t / 300)), L = c * 0.5 * k, x0 = 0.6 * c;
      ctx.strokeStyle = '#D21F45'; ctx.lineWidth = Math.max(1.2, c * 0.05); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x0 + L * 0.68, 0);
      ctx.moveTo(x0 + L * 0.66, 0); ctx.lineTo(x0 + L, -c * 0.08 * k);
      ctx.moveTo(x0 + L * 0.66, 0); ctx.lineTo(x0 + L, c * 0.08 * k); ctx.stroke();
    }
    ctx.fillStyle = flash ? SN.dead : SN.edge; shape(1.07); ctx.fill();
    var hg = ctx.createRadialGradient(0.12 * c, -0.14 * c, 0, 0.1 * c, 0, 0.62 * c);
    hg.addColorStop(0, flash ? '#F06A6E' : SN.headA); hg.addColorStop(1, flash ? SN.dead : SN.headB);
    ctx.fillStyle = hg; shape(1); ctx.fill();
    ctx.strokeStyle = SN.plate; ctx.lineWidth = Math.max(0.8, c * 0.045); ctx.lineCap = 'round'; // head plates
    ctx.beginPath(); ctx.moveTo(-0.22 * c, -0.12 * c); ctx.quadraticCurveTo(0.12 * c, -0.2 * c, 0.34 * c, -0.12 * c);
    ctx.moveTo(-0.22 * c, 0.12 * c); ctx.quadraticCurveTo(0.12 * c, 0.2 * c, 0.34 * c, 0.12 * c);
    ctx.moveTo(-0.05 * c, 0); ctx.lineTo(0.3 * c, 0); ctx.stroke();
    ctx.fillStyle = SN.blotch; ctx.beginPath(); ctx.ellipse(-0.16 * c, 0, 0.12 * c, 0.09 * c, 0, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(15,30,8,.85)'; // nostrils
    ctx.beginPath(); ctx.ellipse(0.53 * c, -0.07 * c, 0.03 * c, 0.02 * c, 0.3, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0.53 * c, 0.07 * c, 0.03 * c, 0.02 * c, -0.3, 0, 7); ctx.fill();
    [-1, 1].forEach(function (sd) { // amber eyes with slit pupils
      var ex = 0.24 * c, ey = 0.27 * c * sd, er = 0.105 * c;
      ctx.fillStyle = '#132A0B'; ctx.beginPath(); ctx.arc(ex, ey, er * 1.22, 0, 7); ctx.fill();
      var ig = ctx.createRadialGradient(ex - er * .3, ey - er * .3, 0, ex, ey, er);
      ig.addColorStop(0, '#FFF0A0'); ig.addColorStop(.6, '#F2B630'); ig.addColorStop(1, '#B9741A');
      ctx.fillStyle = ig; ctx.beginPath(); ctx.arc(ex, ey, er, 0, 7); ctx.fill();
      ctx.fillStyle = '#0B0D08'; ctx.beginPath(); ctx.ellipse(ex + er * 0.1, ey, er * 0.22, er * 0.82, 0, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.beginPath(); ctx.arc(ex - er * .35, ey - er * .38 * sd, er * 0.22, 0, 7); ctx.fill();
    });
    ctx.restore();
  }

  function eggShape(rx, ry) {
    ctx.beginPath();
    ctx.moveTo(0, -ry);
    ctx.bezierCurveTo(rx * 0.62, -ry, rx, -ry * 0.18, rx, ry * 0.22);
    ctx.bezierCurveTo(rx, ry * 0.72, rx * 0.56, ry, 0, ry);
    ctx.bezierCurveTo(-rx * 0.56, ry, -rx, ry * 0.72, -rx, ry * 0.22);
    ctx.bezierCurveTo(-rx, -ry * 0.18, -rx * 0.62, -ry, 0, -ry);
    ctx.closePath();
  }
  function drawEgg(e, golden, now) {
    var x = px(e.x), y = px(e.y), c = cell;
    var pop = golden ? 1 : Math.min(1, Math.max(0, (now - (e.born || 0)) / 250)); // grows in when it appears
    var wob = Math.sin(now / 160) * (Math.sin(now / 1900 + (e.seed || 0)) > 0.92 ? 0.12 : 0); // occasional wobble
    var rx = c * 0.3 * pop, ry = c * 0.39 * pop;
    if (!golden) { // nest of dry grass
      ctx.save(); ctx.translate(x, y + c * 0.18); ctx.lineCap = 'round';
      var R = seeded((e.seed || 7) + 1);
      for (var i = 0; i < 9; i++) {
        var a0 = R() * Math.PI * 2, len = 0.9 + R() * 0.9;
        ctx.strokeStyle = R() < 0.5 ? 'rgba(150,112,58,.95)' : 'rgba(110,80,40,.95)';
        ctx.lineWidth = Math.max(1, c * 0.055);
        ctx.beginPath(); ctx.ellipse(0, 0, c * 0.36, c * 0.16, 0, a0, a0 + len); ctx.stroke();
      }
      ctx.restore();
    }
    if (pop <= 0) return;
    ctx.save(); ctx.translate(x, y); ctx.rotate((e.tilt || 0.2) + wob);
    ctx.fillStyle = 'rgba(10,20,5,.28)'; ctx.beginPath(); ctx.ellipse(c * 0.05, ry * 0.92, rx * 1.05, ry * 0.32, 0, 0, 7); ctx.fill();
    var g = ctx.createRadialGradient(-rx * 0.4, -ry * 0.45, 0, 0, 0, ry * 1.2);
    if (golden) { g.addColorStop(0, '#FFF8C8'); g.addColorStop(.45, '#FFC93A'); g.addColorStop(1, '#B97800'); }
    else { g.addColorStop(0, '#FFFFFF'); g.addColorStop(.5, '#F3E9D6'); g.addColorStop(1, '#CDB894'); }
    ctx.fillStyle = g; eggShape(rx, ry); ctx.fill();
    ctx.strokeStyle = golden ? 'rgba(150,95,0,.6)' : 'rgba(120,95,60,.45)'; ctx.lineWidth = Math.max(0.8, c * 0.025); ctx.stroke();
    if (!golden) { // speckles
      var S = seeded((e.seed || 3) + 11);
      ctx.fillStyle = 'rgba(120,82,40,.55)';
      for (var k = 0; k < 9; k++) { ctx.beginPath(); ctx.ellipse((S() - .5) * rx * 1.4, (S() - .35) * ry * 1.3, c * (0.012 + S() * 0.02), c * (0.01 + S() * 0.015), S() * 3, 0, 7); ctx.fill(); }
    }
    ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.ellipse(-rx * 0.38, -ry * 0.42, rx * 0.2, ry * 0.14, -0.5, 0, 7); ctx.fill();
    ctx.restore();
    if (golden) {
      var left = Math.max(0, 1 - (now - e.born) / e.life);
      ctx.save(); ctx.translate(x, y);
      for (var s = 0; s < 3; s++) { // orbiting sparkles
        var aa = now / 500 + s * 2.094, sx = Math.cos(aa) * c * 0.52, sy = Math.sin(aa) * c * 0.52, sr = c * (0.07 + 0.03 * Math.sin(now / 120 + s));
        ctx.fillStyle = '#FFF4B8';
        ctx.beginPath(); ctx.moveTo(sx, sy - sr); ctx.lineTo(sx + sr * .3, sy - sr * .3); ctx.lineTo(sx + sr, sy); ctx.lineTo(sx + sr * .3, sy + sr * .3);
        ctx.lineTo(sx, sy + sr); ctx.lineTo(sx - sr * .3, sy + sr * .3); ctx.lineTo(sx - sr, sy); ctx.lineTo(sx - sr * .3, sy - sr * .3); ctx.closePath(); ctx.fill();
      }
      ctx.strokeStyle = 'rgba(255,214,90,.9)'; ctx.lineWidth = Math.max(1.5, c * 0.06); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(0, 0, c * 0.68, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left); ctx.stroke();
      ctx.restore();
    }
  }
  function shell(gx, gy, golden) { // eggshell shards or gold sparkles
    var x = px(gx), y = px(gy);
    for (var i = 0; i < (golden ? 18 : 12); i++) {
      var a = Math.random() * Math.PI * 2, sp = (0.5 + Math.random()) * cell * 0.08;
      particles.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - cell * 0.03, r: cell * (0.05 + Math.random() * 0.07), life: 1, rot: Math.random() * 6,
        c: golden ? (i % 2 ? '#FFD75A' : '#FFF4B8') : (i % 3 ? '#F6EEDD' : '#D9C6A2') });
    }
  }

  function draw(t) {
    if (!ctx || !bg) return;
    var now = performance.now();
    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - .5) * 8 * shake, (Math.random() - .5) * 8 * shake);
    ctx.drawImage(bg, 0, 0, CW, CH);
    if (food) drawEgg(food, false, now);
    if (bonus) drawEgg(bonus, true, now);
    drawSnake(t, now);
    for (var i = 0; i < particles.length; i++) {
      var q = particles[i];
      ctx.save(); ctx.globalAlpha = Math.max(0, q.life); ctx.translate(q.x, q.y); ctx.rotate(q.rot); ctx.fillStyle = q.c;
      ctx.beginPath(); ctx.moveTo(-q.r, -q.r * .6); ctx.lineTo(q.r, -q.r * .2); ctx.lineTo(-q.r * .2, q.r); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  function loop() {
    cancelAnimationFrame(raf); clearTimeout(idleTimer);
    raf = requestAnimationFrame(function frame(t) {
      if (!lastT) lastT = t;
      var dt = Math.min(64, t - lastT); lastT = t;
      if (state === 'running') {
        acc += dt;
        while (acc >= interval && state === 'running') { acc -= interval; step(); }
        if (bonus && t - bonus.born > bonus.life) bonus = null;
      }
      tongue.next -= dt;
      if (tongue.t >= 0) { tongue.t += dt; if (tongue.t > 300) { tongue.t = -1; tongue.next = 1400 + Math.random() * 1800; } }
      else if (tongue.next <= 0) tongue.t = 0;
      for (var i = particles.length - 1; i >= 0; i--) {
        var q = particles[i]; q.x += q.vx * dt / 16; q.y += q.vy * dt / 16; q.vy += cell * 0.004 * dt / 16; q.rot += 0.2; q.life -= dt / 520;
        if (q.life <= 0) particles.splice(i, 1);
      }
      if (shake > 0) shake = Math.max(0, shake - dt / 300);
      if (deathFlash > 0) deathFlash = Math.max(0, deathFlash - dt / 700);
      var d0 = performance.now();
      draw(state === 'running' ? Math.min(acc / interval, 1) : 1);
      if (state === 'running') {
        drawAvg = drawAvg * 0.9 + (performance.now() - d0) * 0.1;
        if (++frameCount % 30 === 0) {
          if (drawAvg > 11 && quality > 0) quality--;
          else if (drawAvg < 4 && quality < 3) quality++;
        }
      }
      if (state === 'running' || state === 'dying' || particles.length || shake > 0 || tongue.t >= 0) raf = requestAnimationFrame(frame);
      else if (!document.hidden) { lastT = 0; idleTimer = setTimeout(loop, Math.max(120, tongue.next)); } // idle: wake up only for the next tongue flick
    });
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden && !SHOW) { lastT = 0; loop(); } });

  /* ---------------------------------------------------------------- overlay */
  var bestLine = h('p', { class: 'mg-hint' });
  function modeSeg() {
    var seg = h('div', { class: 'mg-seg', role: 'group', 'aria-label': 'Mode' });
    [['classic', 'Classic'], ['wrap', 'No walls']].forEach(function (m) {
      var b = h('button', { type: 'button', 'aria-pressed': String(mode === m[0]), text: m[1] });
      b.addEventListener('click', function () {
        mode = m[0]; MG.store.set('mode', mode);
        seg.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        bestLine.textContent = 'Best: ' + best();
        buildBackground();
        if (state === 'idle' || state === 'over') { reset(); draw(1); }
        MG.sfx.tap();
      });
      seg.append(b);
    });
    return seg;
  }
  function showOverlay(kind, isBest) {
    overlay.innerHTML = '';
    var card;
    if (kind === 'paused') {
      card = h('div', { class: 'mg-card' },
        h('h2', { class: 'mg-title', text: 'Paused' }), h('p', { class: 'mg-sub', text: 'Score ' + score }),
        h('button', { class: 'mg-btn', type: 'button', onclick: resume, text: 'Resume' }),
        h('p', { class: 'mg-hint', html: 'Press <span class="mg-kbd">Space</span> to resume' }));
    } else {
      bestLine.textContent = 'Best: ' + best();
      var over = kind === 'over';
      card = h('div', { class: 'mg-card' },
        h('h2', { class: 'mg-title', text: over ? 'Game over' : 'Snake' }),
        over ? h('div', { class: 'mg-big', text: String(score) }) : h('p', { class: 'mg-sub', text: 'Eat the eggs, grow longer and don’t hit the stones or your own tail.' }),
        over && isBest ? h('span', { class: 'mg-badge', text: 'New best!' }) : null,
        h('div', { class: 'mg-field' }, h('span', { class: 'mg-label', text: 'Mode' }), modeSeg()),
        h('button', { class: 'mg-btn', type: 'button', onclick: function () { start(); }, text: over ? 'Play again' : 'Play' }),
        bestLine,
        h('p', { class: 'mg-hint', html: matchMedia('(pointer: coarse)').matches ? 'Swipe or use the arrows to steer' : '<span class="mg-kbd">←</span> <span class="mg-kbd">↑</span> <span class="mg-kbd">→</span> <span class="mg-kbd">↓</span> or <span class="mg-kbd">WASD</span> to steer · <span class="mg-kbd">Space</span> pause' }));
    }
    overlay.append(card); overlay.hidden = false;
    var btn = card.querySelector('.mg-btn');
    if (btn) try { btn.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
  }

  /* ---------------------------------------------------------------- input */
  document.addEventListener('keydown', function (e) {
    var name = KEYMAP[e.code] || KEYMAP[e.key];
    if (name) { e.preventDefault(); input(name); return; }
    if (e.key === ' ' || e.code === 'Space' || e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
      e.preventDefault();
      if (state === 'running') pause(); else if (state === 'paused') resume(); else if (e.key === ' ' || e.code === 'Space') start();
    } else if (e.key === 'Enter' && (state === 'idle' || state === 'over') && document.activeElement === document.body) { e.preventDefault(); start(); }
  });
  var touch = null;
  stage.addEventListener('touchstart', function (e) { var t = e.changedTouches[0]; touch = { x: t.clientX, y: t.clientY, moved: false }; }, { passive: true });
  stage.addEventListener('touchmove', function (e) {
    if (!touch) return;
    e.preventDefault();
    var t = e.changedTouches[0], dx = t.clientX - touch.x, dy = t.clientY - touch.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 22) return;
    input(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
    touch = { x: t.clientX, y: t.clientY, moved: true };
  }, { passive: false });
  stage.addEventListener('touchend', function () {
    if (touch && !touch.moved) { if (state === 'idle' || state === 'over') start(); else if (state === 'paused') resume(); }
    touch = null;
  });
  overlay.addEventListener('click', function (e) {
    if (e.target !== overlay) return;
    if (state === 'paused') resume(); else if (state === 'idle' || state === 'over') start();
  });
  stage.addEventListener('click', function (e) {
    if (e.pointerType === 'touch') return;
    if (state === 'idle' || state === 'over') start(); else if (state === 'paused') resume();
  });

  /* ---------------------------------------------------------------- boot */
  if (SHOW) {
    // A single still frame for cover art: a long snake winding across the habitat toward an egg.
    var path = [];
    var run = function (x0, y0, dx, dy, n) { for (var i = 0; i < n; i++) path.push({ x: x0 + dx * i, y: y0 + dy * i }); };
    run(11, 7, -1, 0, 6); run(6, 6, 0, -1, 3); run(7, 4, 1, 0, 3); run(9, 3, 0, -1, 2); run(8, 2, -1, 0, 5); run(4, 3, 0, 1, 2); run(3, 4, -1, 0, 1);
    snake = path.reverse(); prevTail = { x: 12, y: 7 }; grew = false; dir = DIRS.left; queue = []; score = 0; eaten = 0; interval = 135;
    bulges = [6.5]; particles = []; travel = 3;
    food = { x: 1, y: 4, tilt: 0.3, born: -1e6, seed: 41 };
    bonus = { x: 10, y: 1, born: performance.now() - 1500, life: 5200 };
    if (opts.bench) { // long serpentine snake for render benchmarks
      path = [];
      for (var yy = 1; yy < ROWS - 1 && path.length < opts.bench; yy++) for (var xx = 0; xx < COLS - 2 && path.length < opts.bench; xx++) path.push({ x: yy % 2 ? COLS - 3 - xx : xx + 1, y: yy });
      snake = path.reverse(); prevTail = snake[snake.length - 1]; bulges = [4, 30];
      window.__drawBench = function (n) { var t0 = performance.now(); for (var i = 0; i < n; i++) draw((i % 10) / 10); return (performance.now() - t0) / n; };
    }
    tongue.t = 150; state = 'showcase';
    resize();
    document.documentElement.setAttribute('data-ready', '1');
  } else {
    reset();
    resize();
    showOverlay('idle');
    loop();
    MG.ready();
  }
})();
