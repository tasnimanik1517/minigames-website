/* Crossy Road engine: hop a chicken across roads and rivers.
 * Options: { showcase } (showcase renders one still frame for cover art). */
(function () {
  'use strict';
  var MG = window.MG, h = MG.h;
  var opts = window.GAME_OPTIONS || {};
  var SHOW = !!opts.showcase;
  var COLS = 9, VISIBLE = 12; // columns across, rows visible on screen
  var HOP_MS = 130;
  var ICON = {
    pause: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1.5"/><rect x="14" y="5" width="4" height="14" rx="1.5"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.9l10-6.5a1 1 0 0 0 0-1.7l-10-6.5A1 1 0 0 0 8 5.5Z"/></svg>',
    soundOn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z" fill="currentColor"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>',
    soundOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z" fill="currentColor"/><path d="m16 9 6 6M22 9l-6 6"/></svg>'
  };
  var CAR_COLORS = ['#E8481C', '#2F6BFF', '#FFC22E', '#8B5CFF', '#1FB86E', '#E5487D', '#FF8A3D'];
  var CAR_KINDS = [{ w: 1, h: 0.62, cab: 0.55 }, { w: 2, h: 0.66, cab: 0.5 }]; // car, truck

  /* ---------------------------------------------------------------- DOM */
  var scoreEl = h('b', { text: '0' }), bestEl = h('b', { text: '0' }), coinsEl = h('b', { text: '0' });
  var pauseBtn = h('button', { class: 'mg-icon-btn', type: 'button', 'aria-label': 'Pause', html: ICON.pause });
  var soundBtn = h('button', { class: 'mg-icon-btn', type: 'button' });
  var canvas = h('canvas', { role: 'img', 'aria-label': 'Crossy Road game board' });
  var stage = h('div', { class: 'cy-stage' }, canvas);
  var overlay = h('div', { class: 'mg-overlay' });
  var live = h('div', { class: 'mg-sr', 'aria-live': 'polite' });
  var rootEl = h('div', { class: 'mg-root cy' + (SHOW ? ' is-showcase' : '') },
    h('div', { class: 'mg-hud' },
      h('span', { class: 'mg-pill' }, h('small', { text: 'Score' }), scoreEl),
      h('span', { class: 'mg-pill' }, h('small', { text: 'Best' }), bestEl),
      h('span', { class: 'mg-pill' }, h('small', { text: '🪙' }), coinsEl),
      h('span', { class: 'mg-spacer' }), pauseBtn, soundBtn),
    stage, overlay, live);
  document.getElementById('game').append(rootEl);
  function renderSoundBtn() {
    soundBtn.innerHTML = MG.sound.muted ? ICON.soundOff : ICON.soundOn;
    soundBtn.setAttribute('aria-label', MG.sound.muted ? 'Turn sound on' : 'Turn sound off');
  }
  soundBtn.addEventListener('click', function () { MG.sound.toggle(); renderSoundBtn(); });
  renderSoundBtn();

  /* ---------------------------------------------------------------- state */
  var state = 'idle'; // idle | running | paused | dying | over
  var rows = {}; // absolute row number -> row object
  var topRow = -1; // highest generated row
  var px = 4, py = 0; // player cell (px is float while riding a log)
  var fromX = 4, fromY = 0, toX = 4, toY = 0, hopT = 1, hopQueue = [];
  var facing = 'up';
  var score = 0, maxRow = 0, coins = 0;
  var camRow = 0; // bottom visible absolute row
  var lastT = 0, raf = 0, idleTimer = 0, dieKind = '';
  var particles = [], splash = 0;

  function best() { return MG.store.get('best', 0); }
  function setBest(v) { MG.store.set('best', v); }
  function updateHud() {
    scoreEl.textContent = score; bestEl.textContent = Math.max(best(), score); coinsEl.textContent = coins;
  }
  function difficulty(row) { // 0 at the start, 1 far ahead: drives speed and traffic
    return Math.min(1, Math.max(0, row / 60));
  }
  function rowType(r) {
    if (r <= 2) return 'grass'; // gentle start: three safe grass rows
    var k = Math.random(), d = difficulty(r);
    if (k < 0.30 - d * 0.08) return 'grass';
    if (k < 0.30 - d * 0.08 + 0.38) return 'road';
    return 'river';
  }
  function genRow(r) {
    var type = rowType(r);
    // Never stack three rivers or three roads in a row: a long run of either is
    // unfair (rivers) or dull (roads), and the first rows must stay crossable.
    var p1 = rows[r - 1] && rows[r - 1].type, p2 = rows[r - 2] && rows[r - 2].type;
    if (type !== 'grass' && p1 === type && p2 === type) type = 'grass';
    var row = { type: type, seed: (Math.random() * 1e9) | 0, items: [], coin: null, tree: -1 };
    if (type === 'road') {
      var dir = Math.random() < 0.5 ? 1 : -1;
      var speed = dir * (1.1 + difficulty(r) * 2.4 + Math.random() * 0.7);
      var gap = 4.2 - difficulty(r) * 1.6; // cells between vehicles shrink as you go further
      var x = Math.random() * COLS;
      while (x < COLS + 6) {
        var kind = Math.random() < 0.25 ? CAR_KINDS[1] : CAR_KINDS[0];
        row.items.push({ x: x, w: kind.w, h: kind.h, speed: speed, color: CAR_COLORS[(Math.random() * CAR_COLORS.length) | 0], truck: kind.w === 2 });
        x += kind.w + gap * (0.7 + Math.random() * 0.7);
      }
    } else if (type === 'river') {
      var rdir = Math.random() < 0.5 ? 1 : -1;
      var rspeed = rdir * (0.9 + difficulty(r) * 1.4 + Math.random() * 0.5);
      var lw = 2 + ((Math.random() * 2) | 0); // log length 2-3 cells
      var lgap = 3.6 - difficulty(r) * 1.0;
      var lx = Math.random() * COLS;
      while (lx < COLS + 6) {
        row.items.push({ x: lx, w: lw, speed: rspeed });
        lx += lw + lgap * (0.7 + Math.random() * 0.7);
      }
    } else {
      if (r > 2 && Math.random() < 0.3) row.tree = (Math.random() * COLS) | 0;
      if (r > 2 && Math.random() < 0.4) {
        var cx = (Math.random() * COLS) | 0;
        if (cx !== row.tree) row.coin = { x: cx, taken: false };
      }
    }
    rows[r] = row;
    if (r > topRow) topRow = r;
    return row;
  }
  function getRow(r) { return rows[r] || genRow(r); }
  function pruneRows() {
    for (var k in rows) if (+k < camRow - 3) delete rows[k];
  }
  function reset() {
    rows = {}; topRow = -1;
    for (var r = 0; r <= VISIBLE + 2; r++) genRow(r);
    px = 4; py = 0; fromX = 4; fromY = 0; toX = 4; toY = 0; hopT = 1; hopQueue = [];
    facing = 'up'; score = 0; maxRow = 0; coins = 0; camRow = 0;
    particles = []; splash = 0; dieKind = '';
    updateHud();
  }
  function curCell() { // interpolated cell while hopping
    var t = hopT >= 1 ? 1 : hopT;
    return { x: fromX + (toX - fromX) * t, y: Math.round(fromY + (toY - fromY) * t) };
  }
  function rowAt(y) { return getRow(y); }
  function logUnder(x, y) {
    var row = rowAt(y);
    if (row.type !== 'river') return null;
    for (var i = 0; i < row.items.length; i++) {
      var L = row.items[i];
      if (x >= L.x - L.w / 2 - 0.15 && x <= L.x + L.w / 2 + 0.15) return L;
    }
    return null;
  }
  function carHit(x, y) {
    var row = rowAt(y);
    if (row.type !== 'road') return false;
    for (var i = 0; i < row.items.length; i++) {
      var v = row.items[i];
      if (Math.abs(x - v.x) < v.w / 2 + 0.32) return true;
    }
    return false;
  }
  function blocked(x, y) {
    if (x < 0 || x >= COLS) return true;
    var row = rowAt(y);
    return row.type === 'grass' && row.tree === x;
  }
  function tryHop(dx, dy) {
    if (state !== 'running') return;
    if (hopQueue.length < 2) hopQueue.push({ dx: dx, dy: dy });
  }
  function doHop(d) {
    var nx = Math.round(px) + d.dx, ny = py + d.dy;
    if (ny < 0) ny = 0;
    if (blocked(nx, ny)) { MG.sfx.tap(); return; } // bump into a tree or the edge: stay put
    if (d.dy > 0) facing = 'up'; else if (d.dy < 0) facing = 'down';
    else if (d.dx > 0) facing = 'right'; else if (d.dx < 0) facing = 'left';
    fromX = px; fromY = py; toX = nx; toY = ny; hopT = 0;
    px = nx; py = ny;
    MG.sfx.tap();
    if (ny > maxRow) {
      maxRow = ny;
      score = maxRow + coins * 5;
      updateHud();
      if (ny > topRow - 6) { for (var r = topRow + 1; r <= ny + VISIBLE; r++) genRow(r); }
    }
    camRow = Math.max(0, py - 2);
    pruneRows();
  }
  function landCheck() {
    var row = rowAt(py), cx = Math.round(px);
    if (row.type === 'river' && !logUnder(px, py)) { die('drowned'); return; }
    if (row.type === 'grass' && row.coin && !row.coin.taken && row.coin.x === cx) {
      row.coin.taken = true; coins += 1; score = maxRow + coins * 5; updateHud();
      MG.sfx.bonus(); toast('+5  🪙');
    }
  }
  function toast(text) { var t = h('div', { class: 'mg-toast', text: text }); rootEl.append(t); setTimeout(function () { t.remove(); }, 1500); }
  function die(kind) {
    if (state !== 'running') return;
    state = 'dying'; dieKind = kind;
    MG.sfx.bad(); MG.vibrate(120);
    if (kind === 'drowned') { splash = 1; for (var i = 0; i < 22; i++) particles.push({ x: px, y: py, vx: (Math.random() - .5) * 0.09, vy: Math.random() * 0.12, r: 2 + Math.random() * 4, life: 1, c: i % 2 ? '#7FD4F5' : '#FFFFFF' }); }
    else { for (var j = 0; j < 16; j++) particles.push({ x: px, y: py, vx: (Math.random() - .5) * 0.1, vy: (Math.random() - .5) * 0.1, r: 2 + Math.random() * 3, life: 1, c: j % 2 ? '#FFFFFF' : '#FFC22E' }); }
    var isBest = score > best();
    if (isBest) setBest(score);
    MG.event('game_over', { score: score, best: isBest, kind: kind });
    live.textContent = kind === 'drowned' ? 'Splashed! Score ' + score + '.' : 'Squashed! Score ' + score + '.';
    setTimeout(function () {
      state = 'over'; showOverlay('over', isBest); draw(1);
      if (isBest && score > 0) { MG.sfx.win(); MG.confetti(); }
    }, 750);
  }
  function start() {
    if (state === 'running' || state === 'dying') return;
    (state === 'over' ? function (cb) { MG.adBreak('next', 'crossy-road-restart', cb); } : function (cb) { cb(); })(function () {
      reset();
      state = 'running'; overlay.hidden = true;
      pauseBtn.innerHTML = ICON.pause; pauseBtn.setAttribute('aria-label', 'Pause');
      MG.event('game_start', {}); MG.sfx.tap();
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

  /* ---------------------------------------------------------------- update */
  function update(dt) { // dt in ms
    var s = dt / 1000;
    for (var k in rows) {
      var row = rows[k];
      if (row.type === 'road' || row.type === 'river') {
        for (var i = 0; i < row.items.length; i++) {
          var it = row.items[i];
          it.x += it.speed * s;
          var span = COLS + it.w + 4;
          if (it.speed > 0 && it.x - it.w / 2 > COLS + 2) it.x -= span;
          if (it.speed < 0 && it.x + it.w / 2 < -2) it.x += span;
        }
      }
    }
    // ride the log under the chicken
    if (state === 'running' && hopT >= 1) {
      var rowNow = rowAt(py);
      if (rowNow.type === 'river') {
        var L = logUnder(px, py);
        if (L) {
          px += L.speed * s;
          if (px < -0.4 || px > COLS - 0.4) { die('drowned'); return; }
        }
      }
    }
    // hop progress
    if (hopT < 1) {
      hopT = Math.min(1, hopT + dt / HOP_MS);
      if (hopT >= 1) landCheck();
    } else if (hopQueue.length && state === 'running') {
      doHop(hopQueue.shift());
    }
    // squashed or drowned, checked every frame while on the board
    if (state === 'running' && hopT >= 1) {
      var c = curCell();
      if (carHit(c.x, c.y)) { die('squashed'); return; }
      var r2 = rowAt(c.y);
      if (r2.type === 'river' && !logUnder(c.x, c.y)) { die('drowned'); return; }
    }
    for (var p = particles.length - 1; p >= 0; p--) {
      var q = particles[p]; q.x += q.vx * dt / 16; q.y += q.vy * dt / 16; q.vy += 0.004 * dt / 16; q.life -= dt / 650;
      if (q.life <= 0) particles.splice(p, 1);
    }
    if (splash > 0) splash = Math.max(0, splash - dt / 700);
  }
  function loop() {
    cancelAnimationFrame(raf); clearTimeout(idleTimer);
    raf = requestAnimationFrame(function frame(t) {
      if (!lastT) lastT = t;
      var dt = Math.min(64, t - lastT); lastT = t;
      if (state === 'running') update(dt);
      draw(hopT >= 1 ? 1 : hopT);
      if (state === 'running' || state === 'dying' || particles.length) raf = requestAnimationFrame(frame);
      else if (!document.hidden) { lastT = 0; idleTimer = setTimeout(loop, 400); }
    });
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden && !SHOW) { lastT = 0; loop(); } });

  /* ---------------------------------------------------------------- rendering */
  var cell = 40, CW = 0, CH = 0, ctx = null;
  var GRASS = ['#7CBE4F', '#74B546'], GRASS_DARK = ['#5E9E38', '#568F33'];
  function isDark() {
    var t = document.documentElement.getAttribute('data-theme');
    if (t === 'dark') return true; if (t === 'light') return false;
    try { return matchMedia('(prefers-color-scheme: dark)').matches; } catch (e) { return false; }
  }
  function seeded(s) { s = (s % 2147483646) + 1; return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
  function resize() {
    var r = stage.getBoundingClientRect();
    var availW = Math.max(200, r.width - (SHOW ? 0 : 16)), availH = Math.max(260, r.height - (SHOW ? 0 : 8));
    cell = Math.max(24, Math.floor(Math.min(availW / (COLS + 0.6), availH / (VISIBLE + 0.6))));
    CW = cell * COLS; CH = cell * VISIBLE;
    ctx = MG.fitCanvas(canvas, CW, CH);
    draw(1);
  }
  if (window.ResizeObserver) new ResizeObserver(resize).observe(stage); else window.addEventListener('resize', resize);
  MG.themeChanged(function () { draw(1); });

  function rowY(ry) { // screen y of the top of absolute row ry
    return CH - (ry - camRow + 1) * cell;
  }
  function drawRow(row, ry) {
    var y = rowY(ry), dark = isDark(), R = seeded(row.seed);
    var g1 = dark ? GRASS_DARK[ry % 2] : GRASS[ry % 2];
    if (row.type === 'grass') {
      ctx.fillStyle = g1; ctx.fillRect(0, y, CW, cell);
      ctx.fillStyle = 'rgba(255,255,255,.06)';
      for (var i = 0; i < COLS; i++) if ((i + ry) % 2) ctx.fillRect(i * cell, y, cell, cell);
      // grass tufts and flowers
      for (var b = 0; b < 10; b++) {
        var bx = R() * CW, by = y + R() * cell;
        ctx.strokeStyle = dark ? 'rgba(0,0,0,.25)' : 'rgba(40,90,20,.35)';
        ctx.lineWidth = Math.max(1, cell * 0.04); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + (R() - .5) * 4, by - cell * 0.14); ctx.stroke();
      }
      if (R() < 0.5) { // a flower
        var fx = (0.15 + R() * 0.7) * CW, fy = y + cell * (0.25 + R() * 0.4);
        ctx.fillStyle = ['#FF8FB3', '#FFFFFF', '#FFD75A'][(R() * 3) | 0];
        for (var p = 0; p < 5; p++) { var a = p * 1.2566; ctx.beginPath(); ctx.arc(fx + Math.cos(a) * cell * 0.09, fy + Math.sin(a) * cell * 0.09, cell * 0.06, 0, 7); ctx.fill(); }
        ctx.fillStyle = '#E8A21C'; ctx.beginPath(); ctx.arc(fx, fy, cell * 0.05, 0, 7); ctx.fill();
      }
      if (row.tree >= 0) drawTree(row.tree * cell + cell / 2, y + cell / 2);
      if (row.coin && !row.coin.taken) drawCoin(row.coin.x * cell + cell / 2, y + cell / 2);
    } else if (row.type === 'road') {
      ctx.fillStyle = dark ? '#3A3F4A' : '#5A5F6B'; ctx.fillRect(0, y, CW, cell);
      ctx.fillStyle = dark ? '#31353F' : '#4E5360'; ctx.fillRect(0, y, CW, cell * 0.08); ctx.fillRect(0, y + cell * 0.92, CW, cell * 0.08);
      ctx.fillStyle = '#FFD75A';
      for (var d = 0; d < COLS; d++) ctx.fillRect(d * cell + cell * 0.32, y + cell * 0.47, cell * 0.36, cell * 0.06);
      for (var v = 0; v < row.items.length; v++) drawVehicle(row.items[v], y);
    } else { // river
      var wg = ctx.createLinearGradient(0, y, 0, y + cell);
      wg.addColorStop(0, dark ? '#1E6FA8' : '#3FA7D6'); wg.addColorStop(1, dark ? '#155A8A' : '#2B8FC0');
      ctx.fillStyle = wg; ctx.fillRect(0, y, CW, cell);
      ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = Math.max(1, cell * 0.05); ctx.lineCap = 'round';
      for (var w = 0; w < 4; w++) {
        var wx = ((row.seed % 97) / 97 + w * 0.27) % 1 * CW, wy = y + cell * (0.2 + w * 0.2);
        ctx.beginPath(); ctx.moveTo(wx, wy); ctx.quadraticCurveTo(wx + cell * 0.3, wy - cell * 0.08, wx + cell * 0.6, wy); ctx.stroke();
      }
      for (var l = 0; l < row.items.length; l++) drawLog(row.items[l], y);
    }
  }
  function drawVehicle(v, y) {
    var x = v.x * cell, w = v.w * cell, h = cell * v.h, cy = y + (cell - h) / 2;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.beginPath(); ctx.ellipse(x, cy + h * 0.55, w * 0.48, h * 0.22, 0, 0, 7); ctx.fill();
    // body
    ctx.fillStyle = v.color;
    ctx.beginPath(); ctx.roundRect(x - w / 2, cy, w, h, h * 0.28); ctx.fill();
    // cabin / windows
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    var cabW = w * (v.truck ? 0.3 : 0.42);
    ctx.beginPath(); ctx.roundRect(v.speed > 0 ? x + w / 2 - cabW - w * 0.08 : x - w / 2 + w * 0.08, cy + h * 0.16, cabW, h * 0.42, h * 0.12); ctx.fill();
    if (v.truck) { ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(x - w / 2 + w * 0.12, cy + h * 0.14, w * 0.4, h * 0.6); }
    // wheels
    ctx.fillStyle = '#1A1A1A';
    var wy = cy + h * 0.82;
    [[-0.32, 0], [0.32, 0]].forEach(function (o) {
      ctx.beginPath(); ctx.arc(x + w * o[0], wy, h * 0.16, 0, 7); ctx.fill();
    });
    // headlights in the direction of travel
    ctx.fillStyle = '#FFF6B0';
    ctx.beginPath(); ctx.arc(x + (v.speed > 0 ? w / 2 - 2 : -w / 2 + 2), cy + h * 0.5, h * 0.1, 0, 7); ctx.fill();
    ctx.restore();
  }
  function drawLog(L, y) {
    var x = L.x * cell, w = L.w * cell, h = cell * 0.6, cy = y + (cell - h) / 2;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.2)';
    ctx.beginPath(); ctx.ellipse(x, cy + h * 0.6, w * 0.48, h * 0.2, 0, 0, 7); ctx.fill();
    var lg = ctx.createLinearGradient(0, cy, 0, cy + h);
    lg.addColorStop(0, '#B07A3E'); lg.addColorStop(1, '#7C4F22');
    ctx.fillStyle = lg;
    ctx.beginPath(); ctx.roundRect(x - w / 2, cy, w, h, h * 0.45); ctx.fill();
    ctx.strokeStyle = 'rgba(60,35,10,.5)'; ctx.lineWidth = Math.max(1, cell * 0.04);
    ctx.beginPath(); ctx.moveTo(x - w / 2 + cell * 0.2, cy + h * 0.3); ctx.lineTo(x + w / 2 - cell * 0.2, cy + h * 0.3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - w / 2 + cell * 0.2, cy + h * 0.68); ctx.lineTo(x + w / 2 - cell * 0.2, cy + h * 0.68); ctx.stroke();
    ctx.fillStyle = '#E8C890';
    ctx.beginPath(); ctx.ellipse(x - w / 2 + 2, cy + h / 2, cell * 0.07, h * 0.32, 0, 0, 7); ctx.fill();
    ctx.restore();
  }
  function drawTree(cx, cy) {
    ctx.save(); ctx.translate(cx, cy);
    ctx.fillStyle = '#6B4423'; ctx.fillRect(-cell * 0.06, cell * 0.05, cell * 0.12, cell * 0.4);
    ctx.fillStyle = '#2F7A2E';
    ctx.beginPath(); ctx.arc(0, -cell * 0.05, cell * 0.34, 0, 7); ctx.fill();
    ctx.fillStyle = '#3F9C35';
    ctx.beginPath(); ctx.arc(-cell * 0.08, -cell * 0.16, cell * 0.24, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.25)';
    ctx.beginPath(); ctx.arc(-cell * 0.12, -cell * 0.22, cell * 0.1, 0, 7); ctx.fill();
    ctx.restore();
  }
  function drawCoin(cx, cy) {
    var t = performance.now() / 300;
    ctx.save(); ctx.translate(cx, cy);
    ctx.fillStyle = 'rgba(0,0,0,.2)';
    ctx.beginPath(); ctx.ellipse(0, cell * 0.32, cell * 0.2, cell * 0.07, 0, 0, 7); ctx.fill();
    var bob = Math.sin(t) * cell * 0.05;
    ctx.translate(0, bob);
    ctx.fillStyle = '#B97800'; ctx.beginPath(); ctx.arc(0, 0, cell * 0.26, 0, 7); ctx.fill();
    var cg = ctx.createRadialGradient(-cell * 0.08, -cell * 0.08, 0, 0, 0, cell * 0.26);
    cg.addColorStop(0, '#FFF3B0'); cg.addColorStop(1, '#FFC22E');
    ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(0, 0, cell * 0.22, 0, 7); ctx.fill();
    ctx.fillStyle = '#B97800'; ctx.font = 'bold ' + Math.round(cell * 0.26) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('★', 0, cell * 0.01);
    ctx.restore();
  }
  function drawChicken(x, y, lift, squash) {
    var c = cell;
    ctx.save(); ctx.translate(x, y - lift);
    ctx.scale(1 + squash * 0.08, 1 - squash * 0.08);
    var flip = facing === 'left' ? -1 : 1;
    ctx.scale(flip, 1);
    var up = facing === 'up', down = facing === 'down';
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,.22)';
    ctx.beginPath(); ctx.ellipse(0, c * 0.34 + lift, c * 0.26, c * 0.08, 0, 0, 7); ctx.fill();
    // body
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath(); ctx.ellipse(0, c * 0.08, c * 0.3, c * 0.26, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.12)'; ctx.lineWidth = Math.max(1, c * 0.03); ctx.stroke();
    // wing
    ctx.fillStyle = '#EFEFEF';
    ctx.beginPath(); ctx.ellipse(-c * 0.05, c * 0.1, c * 0.16, c * 0.1, -0.4, 0, 7); ctx.fill();
    // tail feathers
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath(); ctx.moveTo(-c * 0.22, -c * 0.02); ctx.lineTo(-c * 0.42, -c * 0.22); ctx.lineTo(-c * 0.3, c * 0.02); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-c * 0.2, c * 0.06); ctx.lineTo(-c * 0.4, -c * 0.06); ctx.lineTo(-c * 0.3, c * 0.14); ctx.closePath(); ctx.fill();
    if (up || down) {
      // head seen from behind / front: comb on top, beak pointing up/down
      ctx.fillStyle = '#E8481C';
      ctx.beginPath(); ctx.arc(-c * 0.06, -c * 0.2, c * 0.07, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(c * 0.05, -c * 0.2, c * 0.07, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(0, -c * 0.24, c * 0.07, 0, 7); ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath(); ctx.arc(0, -c * 0.08, c * 0.17, 0, 7); ctx.fill();
      ctx.fillStyle = '#1A1A1A';
      ctx.beginPath(); ctx.arc(-c * 0.07, -c * 0.1, c * 0.035, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(c * 0.07, -c * 0.1, c * 0.035, 0, 7); ctx.fill();
      ctx.fillStyle = '#FF8A1F';
      ctx.beginPath(); ctx.moveTo(-c * 0.07, -c * 0.02); ctx.lineTo(c * 0.07, -c * 0.02); ctx.lineTo(0, c * (down ? 0.08 : 0.02)); ctx.closePath(); ctx.fill();
    } else {
      // side profile: head to the right
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath(); ctx.arc(c * 0.2, -c * 0.12, c * 0.17, 0, 7); ctx.fill();
      ctx.fillStyle = '#E8481C';
      ctx.beginPath(); ctx.arc(c * 0.14, -c * 0.28, c * 0.06, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(c * 0.24, -c * 0.28, c * 0.06, 0, 7); ctx.fill();
      ctx.fillStyle = '#FF8A1F';
      ctx.beginPath(); ctx.moveTo(c * 0.32, -c * 0.14); ctx.lineTo(c * 0.46, -c * 0.08); ctx.lineTo(c * 0.32, -c * 0.04); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#1A1A1A';
      ctx.beginPath(); ctx.arc(c * 0.24, -c * 0.14, c * 0.04, 0, 7); ctx.fill();
      ctx.fillStyle = '#FF6B6E';
      ctx.beginPath(); ctx.ellipse(c * 0.3, -c * 0.02, c * 0.05, c * 0.07, 0, 0, 7); ctx.fill();
    }
    ctx.restore();
  }
  function draw(t) {
    if (!ctx) return;
    var now = performance.now();
    ctx.clearRect(0, 0, CW, CH);
    // rows from bottom to top so the chicken can overlap the row above
    for (var ry = camRow + VISIBLE - 1; ry >= camRow; ry--) drawRow(getRow(ry), ry);
    // particles
    for (var i = 0; i < particles.length; i++) {
      var q = particles[i];
      ctx.save(); ctx.globalAlpha = Math.max(0, q.life);
      ctx.translate(q.x * cell + cell / 2, rowY(q.y) + cell / 2);
      ctx.fillStyle = q.c; ctx.beginPath(); ctx.arc(0, 0, q.r, 0, 7); ctx.fill();
      ctx.restore();
    }
    if (state === 'dying' && dieKind === 'drowned' && splash > 0) {
      var c = curCell();
      ctx.save(); ctx.globalAlpha = splash;
      ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 2;
      for (var s = 0; s < 3; s++) {
        ctx.beginPath(); ctx.arc(c.x * cell + cell / 2, rowY(c.y) + cell / 2, cell * (0.3 + s * 0.25 + (1 - splash) * 0.5), 0, 7); ctx.stroke();
      }
      ctx.restore();
    }
    if (state !== 'dying') {
      var cellPos = curCell();
      var hopLift = hopT < 1 ? Math.sin(hopT * Math.PI) * cell * 0.32 : 0;
      var squash = hopT < 1 ? Math.sin(hopT * Math.PI) : 0;
      drawChicken(cellPos.x * cell + cell / 2, rowY(cellPos.y) + cell / 2, hopLift, squash);
    }
    // "you are here" marker on the start row while idle
    if (state === 'idle') {
      ctx.save(); ctx.globalAlpha = 0.6 + 0.4 * Math.sin(now / 300);
      ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold ' + Math.round(cell * 0.3) + 'px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('▲', px * cell + cell / 2, rowY(0) - cell * 0.1);
      ctx.restore();
    }
  }

  /* ---------------------------------------------------------------- overlay */
  var bestLine = h('p', { class: 'mg-hint' });
  function showOverlay(kind, isBest) {
    overlay.innerHTML = '';
    var card;
    if (kind === 'paused') {
      card = h('div', { class: 'mg-card' },
        h('h2', { class: 'mg-title', text: 'Paused' }), h('p', { class: 'mg-sub', text: 'Score ' + score }),
        h('button', { class: 'mg-btn', type: 'button', onclick: resume, text: 'Resume' }),
        h('p', { class: 'mg-hint', html: 'Press <span class="mg-kbd">Space</span> to resume' }));
    } else {
      bestLine.textContent = 'Best: ' + best() + (coins ? ' · 🪙 ' + coins + ' coins' : '');
      var over = kind === 'over';
      card = h('div', { class: 'mg-card' },
        h('h2', { class: 'mg-title', text: over ? (dieKind === 'drowned' ? 'Splashed!' : 'Squashed!') : 'Crossy Road' }),
        over ? h('div', { class: 'mg-big', text: String(score) }) : h('p', { class: 'mg-sub', text: 'Hop the chicken across roads and rivers. Dodge the cars, ride the logs, grab the coins — and don’t get squashed or wet.' }),
        over && isBest ? h('span', { class: 'mg-badge', text: 'New best!' }) : null,
        h('button', { class: 'mg-btn', type: 'button', onclick: function () { start(); }, text: over ? 'Play again' : 'Play' }),
        bestLine,
        h('p', { class: 'mg-hint', html: matchMedia('(pointer: coarse)').matches ? 'Swipe or tap around the chicken to hop' : '<span class="mg-kbd">←</span> <span class="mg-kbd">↑</span> <span class="mg-kbd">→</span> <span class="mg-kbd">↓</span> or <span class="mg-kbd">WASD</span> to hop · <span class="mg-kbd">Space</span> pause' }));
    }
    overlay.append(card); overlay.hidden = false;
    var btn = card.querySelector('.mg-btn');
    if (btn) MG.focusSafe(btn);
  }

  /* ---------------------------------------------------------------- input */
  var KEYMAP = {
    ArrowUp: 'up', KeyW: 'up', w: 'up', W: 'up', ArrowDown: 'down', KeyS: 'down', s: 'down', S: 'down',
    ArrowLeft: 'left', KeyA: 'left', a: 'left', A: 'left', ArrowRight: 'right', KeyD: 'right', d: 'right', D: 'right'
  };
  var DIRS = { up: { dx: 0, dy: 1 }, down: { dx: 0, dy: -1 }, left: { dx: -1, dy: 0 }, right: { dx: 1, dy: 0 } };
  function hop(name) {
    if (SHOW) return;
    if (state === 'idle' || state === 'over') { start(); if (name) setTimeout(function () { tryHop(DIRS[name].dx, DIRS[name].dy); }, 60); return; }
    if (state === 'paused') { resume(); return; }
    if (name) tryHop(DIRS[name].dx, DIRS[name].dy);
  }
  document.addEventListener('keydown', function (e) {
    var name = KEYMAP[e.code] || KEYMAP[e.key];
    if (name) { e.preventDefault(); hop(name); return; }
    if (e.key === ' ' || e.code === 'Space' || e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
      e.preventDefault();
      if (state === 'running') pause(); else if (state === 'paused') resume(); else if (e.key === ' ' || e.code === 'Space') start();
    } else if (e.key === 'Enter' && (state === 'idle' || state === 'over') && document.activeElement === document.body) { e.preventDefault(); start(); }
  });
  var touch = null;
  function steerTo(clientX, clientY) { // tap around the chicken: hop toward the tap
    if (state !== 'running') return;
    var r = canvas.getBoundingClientRect(); if (!r.width) return;
    var c = curCell();
    var hx = r.left + (c.x + 0.5) * cell * (r.width / CW), hy = r.top + (rowY(c.y) + cell / 2) * (r.height / CH);
    var dx = clientX - hx, dy = clientY - hy;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 12) return;
    hop(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
  }
  stage.addEventListener('touchstart', function (e) {
    var t = e.changedTouches[0];
    touch = { x: t.clientX, y: t.clientY, moved: false };
    if (state === 'running') steerTo(t.clientX, t.clientY);
  }, { passive: true });
  stage.addEventListener('touchmove', function (e) {
    if (!touch) return;
    e.preventDefault();
    var t = e.changedTouches[0], dx = t.clientX - touch.x, dy = t.clientY - touch.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    hop(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
    touch = { x: t.clientX, y: t.clientY, moved: true };
  }, { passive: false });
  stage.addEventListener('touchend', function () {
    if (touch && !touch.moved) { if (state === 'idle' || state === 'over') start(); else if (state === 'paused') resume(); }
    touch = null;
  });
  stage.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'touch') return;
    if (state === 'running') steerTo(e.clientX, e.clientY);
  });
  stage.addEventListener('click', function (e) {
    if (e.pointerType === 'touch') return;
    if (state === 'idle' || state === 'over') start(); else if (state === 'paused') resume();
  });
  overlay.addEventListener('click', function (e) {
    if (e.target !== overlay) return;
    if (state === 'paused') resume(); else if (state === 'idle' || state === 'over') start();
  });

  /* ---------------------------------------------------------------- boot */
  if (SHOW) {
    // A single still frame for cover art: chicken mid-hop over a river log, cars passing below.
    reset();
    rows = {};
    var fixed = ['grass', 'road', 'grass', 'river', 'grass', 'road', 'grass', 'river', 'grass', 'road', 'grass', 'river'];
    for (var fr = 0; fr < fixed.length; fr++) {
      var row = { type: fixed[fr], seed: 1000 + fr * 77, items: [], coin: null, tree: -1 };
      if (row.type === 'road') {
        row.items.push({ x: 1.5, w: 1, h: 0.62, speed: 1.5, color: '#E8481C', truck: false });
        row.items.push({ x: 5.5, w: 2, h: 0.66, speed: -1.2, color: '#2F6BFF', truck: true });
        row.items.push({ x: 8.2, w: 1, h: 0.62, speed: 1.5, color: '#FFC22E', truck: false });
      } else if (row.type === 'river') {
        row.items.push({ x: 2.5, w: 3, speed: 1 });
        row.items.push({ x: 6.5, w: 2, speed: -0.9 });
      } else if (fr === 2) { row.coin = { x: 6, taken: false }; }
      else if (fr === 6) { row.tree = 1; }
      rows[fr] = row;
    }
    topRow = fixed.length - 1;
    px = 4; py = 3; fromX = 4; fromY = 3; toX = 4; toY = 4; hopT = 0.45; facing = 'up';
    camRow = 0; state = 'showcase';
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
