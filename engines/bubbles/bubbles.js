/* Bubble Shooter engine: aim the cannon, shoot coloured bubbles, match three or more
 * of a colour to pop them. Bubbles left hanging drop away. Clear the board to reach
 * the next level; if the bubbles cross the red line, the game is over.
 * Canvas game on a fixed logical world (480 x 640) scaled to fit the stage.
 * Each grid row keeps its own offset parity (rowOdd), because a ceiling drop shifts
 * rows down without changing their horizontal offset.
 * Options: { showcase: true } still frame for cover art. */
(function () {
  'use strict';
  var MG = window.MG, h = MG.h, o = window.GAME_OPTIONS || {};
  var SHOWCASE = !!o.showcase;

  /* logical world */
  var W = 480, H = 640;
  var R = 19, D = 38, V = 33, LEFT = 50, TOP = 64; // bubble radius, spacing, grid origin
  var CX = W / 2, CY = H - 58; // cannon
  var DANGER_Y = H - 168;
  var SHOT_SPEED = 640, DROP_EVERY = 6;
  var COLORS = [
    { name: 'red', base: '#EF4444', light: '#FCA5A5', dark: '#991B1B' },
    { name: 'blue', base: '#3B82F6', light: '#93C5FD', dark: '#1E40AF' },
    { name: 'green', base: '#22C55E', light: '#86EFAC', dark: '#166534' },
    { name: 'yellow', base: '#EAB308', light: '#FDE047', dark: '#854D0E' },
    { name: 'purple', base: '#A855F7', light: '#D8B4FE', dark: '#6B21A8' }
  ];
  var RANKS = [[0, '🫧', 'First Pop'], [100, '🎯', 'Sharp Shooter'], [250, '💥', 'Pop Expert'],
    [500, '🌈', 'Bubble Master'], [900, '🏆', 'Board Clearer'], [1500, '👑', 'Bubble Champion']];
  var best = +MG.store.get('best', 0) || 0;

  /* ---------- state ---------- */
  var state = 'idle', paused = false; // idle | playing | done
  var grid = []; // rows of (colour index | null)
  var rowOdd = []; // per-row offset parity: odd rows hold 9 bubbles, shifted right by R
  var level = 1, score = 0, popped = 0, misses = 0;
  var current = 0, next = 1, angle = -90; // degrees, -90 = straight up
  var shot = null; // {x, y, vx, vy, color}
  var falling = [], parts = [], popups = [];
  var lastTick = 0;

  /* ---------- DOM ---------- */
  function pill(label, el) { return h('span', { class: 'mg-pill' }, h('small', { text: label }), el); }
  var scoreEl = h('b', { text: '0' }), bestEl = h('b', { text: best ? best : '–' });
  var levelEl = h('b', { text: '1' }), dropEl = h('b', { text: String(DROP_EVERY) });
  var soundBtn = h('button', { class: 'mg-icon-btn', type: 'button' });
  var pauseBtn = h('button', { class: 'mg-icon-btn', type: 'button', 'aria-label': 'Pause the game' },
    h('span', { html: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1.2"/><rect x="14" y="5" width="4" height="14" rx="1.2"/></svg>' }));
  var canvas = h('canvas', { class: 'bb-canvas', role: 'img', 'aria-label': 'Bubble Shooter game board' });
  var fireBtn = h('button', { class: 'bb-fire', type: 'button', 'aria-label': 'Shoot' }, h('span', { 'aria-hidden': 'true', text: 'SHOOT' }));
  var stage = h('div', { class: 'bb-stage' }, canvas, fireBtn);
  var overlay = h('div', { class: 'mg-overlay', hidden: true });
  var root = h('div', { class: 'mg-root bb' },
    h('div', { class: 'mg-hud' }, pill('Score', scoreEl), pill('Level', levelEl), pill('Drop in', dropEl), pill('Best', bestEl),
      h('span', { class: 'mg-spacer' }), pauseBtn, soundBtn),
    stage, overlay);
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
    dropEl.textContent = DROP_EVERY - misses;
  }
  function palette() { return level >= 3 ? 5 : 4; } // a fifth colour joins from level 3
  function rowLen(r, odd) { return (odd === undefined ? rowOdd[r] : odd) ? 9 : 10; }
  function cellCenter(r, c, odd) {
    var o2 = odd === undefined ? rowOdd[r] : odd;
    return { x: LEFT + c * D + (o2 ? R : 0) + R, y: TOP + r * V };
  }
  function neighbours(r, c, odd) {
    // odd-r offset neighbours: (dc, dr)
    var o2 = odd === undefined ? rowOdd[r] : odd;
    var even = [[-1, -1], [0, -1], [-1, 0], [1, 0], [-1, 1], [0, 1]];
    var oddN = [[0, -1], [1, -1], [-1, 0], [1, 0], [0, 1], [1, 1]];
    return (o2 ? oddN : even).map(function (d) { return [r + d[1], c + d[0]]; });
  }
  function inGrid(r, c, odd) { return r >= 0 && r < grid.length && c >= 0 && c < rowLen(r, odd); }
  function gridColors() { // colours still on the board, so the cannon never loads a dead colour
    var seen = {};
    grid.forEach(function (row) { row.forEach(function (v) { if (v !== null) seen[v] = 1; }); });
    var list = Object.keys(seen).map(Number);
    return list.length ? list : [0, 1, 2, 3].slice(0, palette());
  }
  function randomColor() { var l = gridColors(); return l[Math.floor(Math.random() * l.length)]; }
  function buildLevel() {
    var rows = level >= 3 ? 6 : 5, n = palette();
    grid = []; rowOdd = [];
    for (var r = 0; r < rows; r++) {
      var row = [];
      for (var c = 0; c < (r % 2 ? 9 : 10); c++) row.push(Math.floor(Math.random() * n));
      grid.push(row); rowOdd.push(r % 2 === 1);
    }
    misses = 0;
    current = randomColor(); next = randomColor();
    shot = null; falling = []; parts = []; popups = [];
  }
  function reset() {
    score = 0; popped = 0; level = 1; angle = -90;
    buildLevel();
    renderHud();
  }
  function start() {
    reset();
    state = 'playing'; paused = false; overlay.hidden = true;
    MG.event('game_start');
  }
  function countBubbles() { var n = 0; grid.forEach(function (row) { row.forEach(function (v) { if (v !== null) n++; }); }); return n; }

  /* ---------- shooting ---------- */
  function muzzle() { var a = angle * Math.PI / 180; return { x: CX + Math.cos(a) * 34, y: CY + Math.sin(a) * 34 }; }
  function shoot() {
    if (state !== 'playing' || paused || shot) return;
    var m = muzzle(), a = angle * Math.PI / 180;
    shot = { x: m.x, y: m.y, vx: Math.cos(a) * SHOT_SPEED, vy: Math.sin(a) * SHOT_SPEED, color: current };
    MG.sfx.tap();
  }
  function stickShot() {
    var p = { x: shot.x, y: shot.y }, color = shot.color;
    shot = null;
    // nearest empty cell that touches the ceiling or an existing bubble
    var bestCell = null, bestD = 1e9, bestOdd = false;
    for (var r = 0; r < grid.length + 1; r++) {
      var odd = r < grid.length ? rowOdd[r] : (grid.length ? !rowOdd[grid.length - 1] : false);
      for (var c = 0; c < rowLen(r, odd); c++) {
        if (r < grid.length && grid[r][c] !== null) continue;
        var touches = r === 0;
        if (!touches) neighbours(r, c, odd).forEach(function (n) {
          if (inGrid(n[0], n[1]) && grid[n[0]][n[1]] !== null) touches = true;
        });
        if (!touches) continue;
        var cc = cellCenter(r, c, odd), d = Math.hypot(cc.x - p.x, cc.y - p.y);
        if (d < bestD) { bestD = d; bestCell = [r, c]; bestOdd = odd; }
      }
    }
    if (!bestCell) { // nowhere to stick: the board is full to the ceiling
      finish(false);
      return;
    }
    while (grid.length <= bestCell[0]) {
      var nr = grid.length, nodd = nr ? !rowOdd[nr - 1] : false;
      grid.push(new Array(nodd ? 9 : 10).fill(null)); rowOdd.push(nodd);
    }
    grid[bestCell[0]][bestCell[1]] = color;
    resolve(bestCell[0], bestCell[1], color);
  }
  function resolve(r, c, color) {
    // flood-fill the same colour from the bubble that just landed
    var group = [], seen = {}, stack = [[r, c]];
    seen[r + ',' + c] = 1;
    while (stack.length) {
      var n = stack.pop();
      group.push(n);
      neighbours(n[0], n[1]).forEach(function (m) {
        var k = m[0] + ',' + m[1];
        if (!seen[k] && inGrid(m[0], m[1]) && grid[m[0]][m[1]] === color) { seen[k] = 1; stack.push(m); }
      });
    }
    if (group.length >= 3) {
      group.forEach(function (n) {
        var cc = cellCenter(n[0], n[1]);
        grid[n[0]][n[1]] = null;
        explode(cc.x, cc.y, COLORS[color].base);
      });
      var gain = group.length * 10 + (group.length >= 5 ? 50 : 0);
      score += gain; popped += group.length; misses = 0;
      popups.push({ text: '+' + gain, x: cellCenter(r, c).x, y: cellCenter(r, c).y, t: 0 });
      MG.sfx.bonus(); MG.vibrate(20);
      dropFloating();
    } else {
      misses++;
      if (misses >= DROP_EVERY) { misses = 0; pushRow(); }
    }
    current = next; next = randomColor();
    renderHud();
    if (state !== 'playing') return;
    if (!countBubbles()) { levelClear(); return; }
    if (crossedLine()) finish(false);
  }
  function dropFloating() {
    // bubbles no longer connected to the ceiling fall away
    var seen = {}, stack = [];
    for (var c = 0; c < rowLen(0); c++) if (grid[0] && grid[0][c] !== null) { seen['0,' + c] = 1; stack.push([0, c]); }
    while (stack.length) {
      var n = stack.pop();
      neighbours(n[0], n[1]).forEach(function (m) {
        var k = m[0] + ',' + m[1];
        if (!seen[k] && inGrid(m[0], m[1]) && grid[m[0]][m[1]] !== null) { seen[k] = 1; stack.push(m); }
      });
    }
    var dropped = 0;
    grid.forEach(function (row, r) {
      row.forEach(function (v, c) {
        if (v !== null && !seen[r + ',' + c]) {
          var cc = cellCenter(r, c);
          falling.push({ x: cc.x, y: cc.y, vy: 60, color: v });
          grid[r][c] = null;
          dropped++;
        }
      });
    });
    if (dropped) { score += dropped * 10; popped += dropped; MG.tone(520, 0.12, 'triangle', 0.05, 700); }
  }
  function pushRow() {
    var row = [];
    for (var c = 0; c < 10; c++) row.push(Math.floor(Math.random() * palette()));
    grid.unshift(row); rowOdd.unshift(false);
    popups.push({ text: 'The ceiling drops!', x: W / 2, y: H * 0.4, t: 0 });
    MG.tone(180, 0.2, 'sawtooth', 0.04, 120);
  }
  function crossedLine() {
    for (var r = 0; r < grid.length; r++) for (var c = 0; c < rowLen(r); c++) {
      if (grid[r][c] !== null && cellCenter(r, c).y + R >= DANGER_Y) return true;
    }
    return false;
  }
  function levelClear() {
    var bonus = 150 + level * 50;
    score += bonus;
    popups.push({ text: 'Level ' + level + ' clear!  +' + bonus, x: W / 2, y: H * 0.42, t: 0 });
    level++;
    buildLevel();
    MG.sfx.win(); MG.confetti(90);
    renderHud();
  }
  function explode(x, y, color) {
    for (var i = 0; i < 10; i++) parts.push({ x: x, y: y, vx: (Math.random() - 0.5) * 280, vy: (Math.random() - 0.5) * 280 - 40, t: 0, c: color });
  }
  function finish(cleared) {
    state = 'done';
    var prev = best, isBest = score > best;
    if (isBest) { best = score; MG.store.set('best', best); }
    renderHud();
    var r = rank(score);
    var again = h('button', { class: 'mg-btn', type: 'button', text: 'Play again' });
    again.addEventListener('click', function () { MG.adBreak('next', 'bubbles-again', start); });
    overlay.innerHTML = '';
    overlay.append(h('div', { class: 'mg-card bb-card', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Your result' },
      h('div', { class: 'bb-badge', 'aria-hidden': 'true', text: r[1] }),
      h('div', null, h('small', { class: 'mg-label', text: 'Your bubble badge' }), h('h2', { class: 'mg-title', text: r[2] })),
      h('div', { class: 'bb-score' }, h('span', { class: 'mg-big', text: score }), h('span', { text: 'points · level ' + level })),
      isBest && prev ? h('span', { class: 'mg-badge', text: 'New best!' }) : null,
      h('p', { class: 'mg-sub', text: popped + ' bubbles popped.' + (cleared ? '' : ' The bubbles crossed the red line.') + (prev && !isBest ? ' Your best is ' + prev + '.' : '') }),
      h('div', { class: 'mg-row' }, again)));
    overlay.hidden = false;
    MG.focusSafe(again, 700);
    if (isBest && prev) { MG.confetti(120); MG.sfx.win(); } else if (score >= 250) MG.sfx.good(); else MG.sfx.draw();
    MG.event('game_over', { score: score });
  }

  /* ---------- aiming ---------- */
  function toWorld(e) {
    var rect = canvas.getBoundingClientRect();
    var px = (e.clientX - rect.left) / rect.width * cw, py = (e.clientY - rect.top) / rect.height * ch;
    return { x: (px - ox) / scale, y: (py - oy) / scale };
  }
  function aimAt(w) {
    var a = Math.atan2(w.y - CY, w.x - CX) * 180 / Math.PI;
    if (a > 0) a = a > 90 ? -180 : 0; // never aim downwards
    angle = Math.max(-168, Math.min(-12, a));
  }
  var aiming = false;
  canvas.addEventListener('pointerdown', function (e) {
    if (state !== 'playing' || paused) return;
    e.preventDefault();
    aiming = true;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    aimAt(toWorld(e));
  });
  canvas.addEventListener('pointermove', function (e) { if (aiming) aimAt(toWorld(e)); });
  canvas.addEventListener('pointerup', function (e) {
    if (!aiming) return;
    aiming = false;
    aimAt(toWorld(e));
    shoot();
  });
  canvas.addEventListener('pointercancel', function () { aiming = false; });
  fireBtn.addEventListener('click', shoot);
  document.addEventListener('keydown', function (e) {
    if (state !== 'playing' || paused) return;
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') { e.preventDefault(); angle = Math.max(-168, angle - 4); }
    else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') { e.preventDefault(); angle = Math.min(-12, angle + 4); }
    else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); shoot(); }
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
      h('p', { class: 'mg-sub', text: 'The bubbles are waiting. The ceiling is not dropping while you rest.' }),
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
    var play = h('button', { class: 'mg-btn', type: 'button', text: 'Start popping' });
    play.addEventListener('click', start);
    overlay.innerHTML = '';
    overlay.append(h('div', { class: 'mg-card', role: 'dialog', 'aria-label': 'Bubble Shooter' },
      h('div', { class: 'bb-badge', 'aria-hidden': 'true', text: '🫧' }),
      h('h2', { class: 'mg-title', text: 'Bubble Shooter' }),
      h('p', { class: 'mg-sub', text: 'Aim the cannon and shoot bubbles at the board. Match three or more of a colour to pop them, and clear the whole board before the bubbles cross the red line.' + (best ? ' Your best is ' + best + ' points.' : '') }),
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
  function drawBubble(x, y, ci, alpha) {
    var c = COLORS[ci];
    ctx.save();
    ctx.globalAlpha = alpha === undefined ? 1 : alpha;
    var g = ctx.createRadialGradient(x - R * 0.35, y - R * 0.4, R * 0.1, x, y, R);
    g.addColorStop(0, c.light); g.addColorStop(0.55, c.base); g.addColorStop(1, c.dark);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, R, 0, 6.2832); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.75)';
    ctx.beginPath(); ctx.ellipse(x - R * 0.32, y - R * 0.42, R * 0.28, R * 0.16, -0.6, 0, 6.2832); ctx.fill();
    ctx.restore();
  }
  function drawAimGuide() {
    if (shot || (state !== 'playing' && !SHOWCASE) || paused) return;
    var a = angle * Math.PI / 180, dx = Math.cos(a), dy = Math.sin(a);
    var x = muzzle().x, y = muzzle().y;
    ctx.save();
    ctx.fillStyle = 'rgba(23,26,43,.55)';
    for (var i = 0; i < 26; i++) {
      x += dx * 13; y += dy * 13;
      if (x < R) { x = R; dx = Math.abs(dx); }
      if (x > W - R) { x = W - R; dx = -Math.abs(dx); }
      if (y < TOP) break;
      var hit = false;
      outer: for (var r = 0; r < grid.length; r++) for (var c = 0; c < rowLen(r); c++) {
        if (grid[r][c] === null) continue;
        var cc = cellCenter(r, c);
        if (Math.hypot(cc.x - x, cc.y - y) < R * 2) { hit = true; break outer; }
      }
      ctx.beginPath(); ctx.arc(x, y, 3.2, 0, 6.2832); ctx.fill();
      if (hit) break;
    }
    ctx.restore();
  }
  function draw() {
    if (!ctx) return;
    ctx.save();
    /* The frame is 3:4, exactly the world, but a wider frame (the 4:3 cover) letterboxes:
     * paint the background across the whole canvas first, in device space. */
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    var bg = ctx.createLinearGradient(0, 0, 0, ch);
    bg.addColorStop(0, '#BFE3FF'); bg.addColorStop(0.6, '#E3F2FF'); bg.addColorStop(1, '#FFF7D6');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, cw, ch);
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * ox, dpr * oy);
    // soft clouds
    ctx.fillStyle = 'rgba(255,255,255,.75)';
    [[70, 540, 34], [150, 560, 24], [390, 520, 30], [330, 580, 22]].forEach(function (cl) {
      ctx.beginPath(); ctx.arc(cl[0], cl[1], cl[2], 0, 6.2832); ctx.fill();
      ctx.beginPath(); ctx.arc(cl[0] + 26, cl[1] + 6, cl[2] * 0.7, 0, 6.2832); ctx.fill();
    });
    // ceiling strip
    ctx.fillStyle = 'rgba(23,26,43,.08)'; ctx.fillRect(0, 0, W, TOP - R - 6);
    // danger line
    ctx.save();
    ctx.strokeStyle = 'rgba(220,38,38,.75)'; ctx.lineWidth = 2; ctx.setLineDash([8, 7]);
    ctx.beginPath(); ctx.moveTo(8, DANGER_Y); ctx.lineTo(W - 8, DANGER_Y); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(220,38,38,.8)'; ctx.font = '700 12px Poppins, sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('⚠ DANGER LINE', 12, DANGER_Y - 6);
    ctx.restore();
    // board bubbles
    grid.forEach(function (row, r) {
      row.forEach(function (v, c) { if (v !== null) { var cc = cellCenter(r, c); drawBubble(cc.x, cc.y, v); } });
    });
    // falling bubbles
    falling.forEach(function (f) { drawBubble(f.x, f.y, f.color, Math.max(0, 1 - f.y / (H + 40))); });
    // aim guide
    drawAimGuide();
    // flying shot
    if (shot) drawBubble(shot.x, shot.y, shot.color);
    // cannon
    var a = angle * Math.PI / 180;
    ctx.save();
    ctx.translate(CX, CY);
    ctx.rotate(a + Math.PI / 2);
    ctx.fillStyle = '#3A3350';
    ctx.beginPath(); ctx.roundRect(-13, -46, 26, 52, 10); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.25)';
    ctx.beginPath(); ctx.roundRect(-13, -46, 26, 14, 8); ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.translate(CX, CY);
    var cg = ctx.createRadialGradient(-8, -10, 4, 0, 0, 34);
    cg.addColorStop(0, '#5B5470'); cg.addColorStop(1, '#241F38');
    ctx.fillStyle = cg;
    ctx.beginPath(); ctx.arc(0, 0, 34, 0, 6.2832); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
    if (state !== 'idle' || SHOWCASE) drawBubble(CX, CY, current);
    // next bubble preview
    ctx.save();
    ctx.fillStyle = 'rgba(23,26,43,.55)'; ctx.font = '700 10px Poppins, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('NEXT', CX + 66, CY + 40);
    ctx.restore();
    drawBubble(CX + 66, CY, next, 0.9);
    // particles
    parts.forEach(function (p) {
      ctx.globalAlpha = Math.max(0, 1 - p.t / 0.55);
      ctx.fillStyle = p.c;
      ctx.beginPath(); ctx.arc(p.x, p.y, 4.5, 0, 6.2832); ctx.fill();
    });
    ctx.globalAlpha = 1;
    // popups
    ctx.save();
    ctx.textAlign = 'center'; ctx.font = '900 22px Poppins, sans-serif';
    popups.forEach(function (p) {
      ctx.globalAlpha = Math.max(0, 1 - p.t / 1.1);
      ctx.fillStyle = '#171A2B';
      ctx.fillText(p.text, p.x, p.y - p.t * 34);
    });
    ctx.restore();
    ctx.restore();
  }

  /* ---------- main loop ---------- */
  function tick(now) {
    requestAnimationFrame(tick);
    var dt = Math.min(50, Math.max(0, now - (lastTick || now))) / 1000;
    lastTick = now;
    if (state === 'playing' && !paused && !SHOWCASE) {
      if (shot) {
        shot.x += shot.vx * dt; shot.y += shot.vy * dt;
        if (shot.x < R) { shot.x = R; shot.vx = Math.abs(shot.vx); }
        if (shot.x > W - R) { shot.x = W - R; shot.vx = -Math.abs(shot.vx); }
        var stuck = shot.y <= TOP;
        if (!stuck) {
          outer: for (var r = 0; r < grid.length; r++) for (var c = 0; c < rowLen(r); c++) {
            if (grid[r][c] === null) continue;
            var cc = cellCenter(r, c);
            if (Math.hypot(cc.x - shot.x, cc.y - shot.y) < R * 2 * 0.95) { stuck = true; break outer; }
          }
        }
        if (stuck) stickShot();
      }
      falling.forEach(function (f) { f.vy += 900 * dt; f.y += f.vy * dt; });
      falling = falling.filter(function (f) { return f.y < H + 40; });
      parts.forEach(function (p) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 320 * dt; });
      parts = parts.filter(function (p) { return p.t < 0.55; });
      popups.forEach(function (p) { p.t += dt; });
      popups = popups.filter(function (p) { return p.t < 1.1; });
    }
    draw();
  }

  /* ---------- start ---------- */
  renderSound(); renderHud(); buildLevel(); showStart();
  requestAnimationFrame(tick);
  if (SHOWCASE) { // still frame: a board mid-game, one bubble flying, cannon aimed up-left
    overlay.hidden = true; level = 1; score = 120; popped = 14;
    grid = [
      [0, 1, 2, 3, 0, 1, 2, 3, 0, 1],
      [2, 0, 3, 1, 2, 0, 3, 1, 2],
      [1, 3, 0, 2, null, 1, 0, 3, 1],
      [3, 1, 2, 0, 3, 2, 1, 0, 3],
      [0, 2, 1, 3, 0, 1, 2, 3, 0],
      [1, 0, 3, 2, 1, 3, 0, 2, 1],
      [2, 3, 0, 1, 2, 0, 3, 1, 2]
    ];
    rowOdd = [false, true, false, true, false, true, false];
    current = 2; next = 0; angle = -118;
    shot = { x: 156, y: 423, vx: -300, vy: -560, color: 2 };
    root.classList.add('is-showcase');
    renderHud();
    setTimeout(function () { document.documentElement.setAttribute('data-ready', '1'); }, 80);
  }
  MG.ready();
})();
