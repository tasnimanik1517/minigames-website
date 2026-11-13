/* Fruit Slice engine: fruits fly up from the bottom — swipe through them to slice.
 * Miss a fruit and you lose a life; slice a bomb and you lose one too.
 * Three lives, combos for slicing several fruits in one swipe.
 * Canvas game on a fixed logical world (480 x 640) scaled to fit the stage.
 * Options: { showcase: true } still frame for cover art. */
(function () {
  'use strict';
  var MG = window.MG, h = MG.h, o = window.GAME_OPTIONS || {};

  /* logical world */
  var W = 480, H = 640;
  var GRAV = 950;
  var LIVES = 3;
  var FRUITS = [
    { kind: 'watermelon', r: 34, skin: '#2FA84F', flesh: '#FF5A6E', label: '🍉' },
    { kind: 'orange', r: 26, skin: '#FF8A1F', flesh: '#FFC46B', label: '🍊' },
    { kind: 'apple', r: 26, skin: '#E23A2E', flesh: '#FFF3D6', label: '🍎' },
    { kind: 'lemon', r: 24, skin: '#FFD93D', flesh: '#FFF6B0', label: '🍋' },
    { kind: 'kiwi', r: 22, skin: '#8A5A2E', flesh: '#A8D85A', label: '🥝' },
    { kind: 'plum', r: 24, skin: '#8B5CF6', flesh: '#FFD166', label: '🍇' },
  ];
  var RANKS = [[0, '🌱', 'First Slice'], [100, '🍊', 'Fruit Fan'], [250, '🔪', 'Sharp Shooter'],
    [500, '🍉', 'Slice Master'], [800, '⚡', 'Fruit Ninja'], [1200, '👑', 'Slice Champion']];
  var best = +MG.store.get('best', 0) || 0;

  /* ---------- state ---------- */
  var state = 'idle', paused = false; // idle | playing | done
  var fruits = []; // {kind, x, y, vx, vy, r, rot, vr, sliced, bomb}
  var halves = []; // {kind, x, y, vx, vy, rot, vr, side, t}
  var particles = []; // {x, y, vx, vy, t, color, r}
  var popups = []; // {text, x, y, t, color}
  var trail = []; // {x, y, t} recent blade points
  var swiping = false;
  var score = 0, lives = LIVES, sliced = 0, bestCombo = 0, comboCount = 0;
  var elapsed = 0, spawnT = 0, lastTick = 0, t = 0;
  var flash = 0, flashColor = '#fff';
  var shake = 0;

  /* ---------- DOM ---------- */
  function pill(label, el) { return h('span', { class: 'mg-pill' }, h('small', { text: label }), el); }
  var scoreEl = h('b', { text: '0' }), bestEl = h('b', { text: best ? best : '–' });
  var livesEl = h('b', { text: '●●●' });
  var soundBtn = h('button', { class: 'mg-icon-btn', type: 'button' });
  var pauseBtn = h('button', { class: 'mg-icon-btn', type: 'button', 'aria-label': 'Pause the game' },
    h('span', { html: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1.2"/><rect x="14" y="5" width="4" height="14" rx="1.2"/></svg>' }));
  var canvas = h('canvas', { class: 'fs-canvas', role: 'img', 'aria-label': 'Fruit Slice game board' });
  var stage = h('div', { class: 'fs-stage' }, canvas);
  var overlay = h('div', { class: 'mg-overlay', hidden: true });
  var root = h('div', { class: 'mg-root fs' },
    h('div', { class: 'mg-hud' }, pill('Score', scoreEl), pill('Lives', livesEl), pill('Best', bestEl),
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
    livesEl.textContent = '●'.repeat(Math.max(0, lives)) + '○'.repeat(Math.max(0, LIVES - lives));
  }
  function fruitDef(kind) {
    for (var i = 0; i < FRUITS.length; i++) if (FRUITS[i].kind === kind) return FRUITS[i];
    return FRUITS[0];
  }
  function spawnFruit() {
    var bomb = elapsed > 12 && Math.random() < 0.12;
    var def = bomb ? null : FRUITS[Math.floor(Math.random() * FRUITS.length)];
    var x = 50 + Math.random() * (W - 100);
    fruits.push({
      kind: bomb ? 'bomb' : def.kind,
      x: x, y: H + 40,
      vx: (W / 2 - x) * 0.35 + (Math.random() - 0.5) * 60,
      vy: -(600 + Math.random() * 200 + Math.min(200, elapsed * 2.5)),
      r: bomb ? 26 : def.r,
      rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 4,
      sliced: false, bomb: bomb,
    });
  }
  function burst(x, y, color, n, speed) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * 6.28, s = (speed || 160) * (0.4 + Math.random() * 0.8);
      particles.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60, t: 0, color: color, r: 2 + Math.random() * 4 });
    }
  }
  function sliceFruit(f) {
    f.sliced = true;
    var def = fruitDef(f.kind);
    comboCount++;
    sliced++;
    var pts = comboCount >= 3 ? 20 : 10;
    score += pts;
    popups.push({ text: '+' + pts, x: f.x, y: f.y - 10, t: 0, color: '#fff' });
    // two halves fly apart along the blade direction
    var ang = f.rot + Math.PI / 2;
    [-1, 1].forEach(function (s) {
      halves.push({ kind: f.kind, x: f.x, y: f.y, vx: f.vx + Math.cos(ang) * 90 * s,
        vy: f.vy - 60, rot: f.rot, vr: (Math.random() - 0.5) * 8, side: s, t: 0 });
    });
    burst(f.x, f.y, def.flesh, 10, 220);
    burst(f.x, f.y, def.skin, 6, 160);
    MG.tone(900, 0.12, 'sawtooth', 0.05, 300);
    MG.vibrate(10);
    renderHud();
  }
  function hitBomb(f) {
    f.sliced = true;
    lives--;
    flash = 1; flashColor = 'rgba(255,60,40,.45)';
    shake = 14;
    popups.push({ text: 'BOOM!', x: f.x, y: f.y - 20, t: 0, color: '#FF6A3D' });
    burst(f.x, f.y, '#FF6A3D', 22, 320);
    burst(f.x, f.y, '#3A3A3A', 12, 220);
    MG.sfx.bad(); MG.vibrate(120);
    renderHud();
    if (lives <= 0) finish();
  }
  function loseLife(why) {
    lives--;
    popups.push({ text: why, x: W / 2, y: H * 0.4, t: 0, color: '#FF8A8A' });
    MG.sfx.bad(); MG.vibrate(60);
    renderHud();
    if (lives <= 0) finish();
  }
  function reset() {
    fruits = []; halves = []; particles = []; popups = []; trail = [];
    score = 0; lives = LIVES; sliced = 0; bestCombo = 0; comboCount = 0;
    elapsed = 0; spawnT = 0.9; flash = 0; shake = 0;
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
    var again = h('button', { class: 'mg-btn', type: 'button', text: 'Slice again' });
    again.addEventListener('click', function () { MG.adBreak('next', 'fruit-again', start); });
    overlay.innerHTML = '';
    overlay.append(h('div', { class: 'mg-card fs-card', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Game over' },
      h('div', { class: 'fs-badge', 'aria-hidden': 'true', text: r[1] }),
      h('div', null, h('small', { class: 'mg-label', text: 'Your slicer rank' }), h('h2', { class: 'mg-title', text: r[2] })),
      h('div', { class: 'fs-score' }, h('span', { class: 'mg-big', text: score }), h('span', { text: 'points · ' + sliced + ' fruits sliced · best combo ×' + Math.max(1, bestCombo) })),
      isBest && prev ? h('span', { class: 'mg-badge', text: 'New best!' }) : null,
      h('p', { class: 'mg-sub', text: (prev && !isBest ? 'Your best is ' + prev + '. ' : '') + 'Swipe through three or more fruits in one stroke for double points — but never touch a bomb.' }),
      h('div', { class: 'mg-row' }, again)));
    overlay.hidden = false;
    MG.focusSafe(again, 700);
    if (isBest && prev) { MG.confetti(120); MG.sfx.win(); }
    else if (score >= 250) MG.sfx.good(); else MG.sfx.lose();
    MG.event('game_over', { score: score });
  }

  /* ---------- slicing ---------- */
  function segDist(px, py, x1, y1, x2, y2) {
    var dx = x2 - x1, dy = y2 - y1, len2 = dx * dx + dy * dy;
    var u = len2 ? Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2)) : 0;
    var cx = x1 + u * dx, cy = y1 + u * dy;
    return Math.hypot(px - cx, py - cy);
  }
  function checkSlice() {
    if (trail.length < 2) return;
    var fresh = [];
    for (var i = 0; i < fruits.length; i++) {
      var f = fruits[i];
      if (f.sliced) continue;
      var hit = false;
      for (var j = 1; j < trail.length; j++) {
        if (segDist(f.x, f.y, trail[j - 1].x, trail[j - 1].y, trail[j].x, trail[j].y) < f.r + 8) { hit = true; break; }
      }
      if (hit) {
        if (f.bomb) hitBomb(f); else sliceFruit(f);
        fresh.push(f);
      }
    }
    if (comboCount >= 3 && comboCount > bestCombo) bestCombo = comboCount;
  }

  /* ---------- update ---------- */
  function tick(now) {
    requestAnimationFrame(tick);
    var dt = Math.min(0.05, Math.max(0, (now - (lastTick || now)) / 1000));
    lastTick = now;
    t += dt;
    if (state === 'playing' && !paused) {
      elapsed += dt;
      spawnT -= dt;
      if (spawnT <= 0) {
        var interval = Math.max(0.45, 1.15 - elapsed * 0.008);
        spawnT = interval * (0.8 + Math.random() * 0.4);
        var count = 1 + (elapsed > 20 ? 1 : 0) + (elapsed > 40 && Math.random() < 0.5 ? 1 : 0);
        for (var s = 0; s < count; s++) spawnFruit();
      }
      // fruits fly and fall
      for (var i = fruits.length - 1; i >= 0; i--) {
        var f = fruits[i];
        if (f.sliced) { fruits.splice(i, 1); continue; }
        f.vy += GRAV * dt;
        f.x += f.vx * dt; f.y += f.vy * dt; f.rot += f.vr * dt;
        if (f.y > H + 60) {
          fruits.splice(i, 1);
          // warm-up: the first 10 seconds cost no life for a missed fruit
          if (!f.bomb) {
            if (elapsed < 10) popups.push({ text: 'Missed one!', x: W / 2, y: H * 0.4, t: 0, color: '#fff' });
            else loseLife('Missed one!');
          }
        }
      }
      // halves tumble and fade
      for (var j = halves.length - 1; j >= 0; j--) {
        var hf = halves[j];
        hf.t += dt; hf.vy += GRAV * dt;
        hf.x += hf.vx * dt; hf.y += hf.vy * dt; hf.rot += hf.vr * dt;
        if (hf.t > 0.7 || hf.y > H + 80) halves.splice(j, 1);
      }
      if (state !== 'playing') { draw(); return; } // a missed fruit may have ended the round
      // combo resets when no fruit was sliced recently: track via trail freshness
      if (comboCount > 0 && trail.length === 0) {
        if (comboCount > bestCombo) bestCombo = comboCount;
        comboCount = 0;
      }
      // trail points expire
      while (trail.length && t - trail[0].t > 0.12) trail.shift();
      checkSlice();
    }
    for (var k = particles.length - 1; k >= 0; k--) {
      var pt = particles[k];
      pt.t += dt; pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.vy += 700 * dt;
      if (pt.t > 0.7) particles.splice(k, 1);
    }
    for (var m = popups.length - 1; m >= 0; m--) {
      popups[m].t += dt;
      if (popups[m].t > 0.9) popups.splice(m, 1);
    }
    flash = Math.max(0, flash - dt * 2.2);
    shake = Math.max(0, shake - dt * 40);
    draw();
  }

  /* ---------- drawing ---------- */
  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function drawFruitBody(f, alpha) {
    var def = fruitDef(f.kind);
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(f.rot * 0.35);
    if (f.kind === 'watermelon') {
      ctx.fillStyle = '#2FA84F';
      ctx.beginPath(); ctx.arc(0, 0, f.r, 0, 6.3); ctx.fill();
      ctx.save();
      ctx.beginPath(); ctx.arc(0, 0, f.r, 0, 6.3); ctx.clip();
      ctx.strokeStyle = '#1E7A35'; ctx.lineWidth = 5; ctx.lineCap = 'round';
      for (var s = -2; s <= 2; s++) {
        ctx.beginPath();
        ctx.moveTo(s * f.r * 0.32, -f.r);
        ctx.quadraticCurveTo(s * f.r * 0.32 + 9, 0, s * f.r * 0.32, f.r);
        ctx.stroke();
      }
      ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,.25)';
      ctx.beginPath(); ctx.ellipse(-f.r * 0.35, -f.r * 0.4, f.r * 0.28, f.r * 0.16, -0.6, 0, 6.3); ctx.fill();
      ctx.strokeStyle = '#7A4A21'; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, -f.r + 2); ctx.lineTo(3, -f.r - 7); ctx.stroke();
    } else if (f.kind === 'lemon') {
      ctx.fillStyle = '#FFD93D';
      ctx.beginPath(); ctx.ellipse(0, 0, f.r * 1.15, f.r * 0.85, 0, 0, 6.3); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.3)';
      ctx.beginPath(); ctx.ellipse(-f.r * 0.35, -f.r * 0.3, f.r * 0.3, f.r * 0.16, -0.5, 0, 6.3); ctx.fill();
      ctx.fillStyle = '#E8B800';
      ctx.beginPath(); ctx.arc(f.r * 1.05, 0, 4, 0, 6.3); ctx.fill();
      ctx.beginPath(); ctx.arc(-f.r * 1.05, 0, 4, 0, 6.3); ctx.fill();
    } else {
      ctx.fillStyle = def.skin;
      ctx.beginPath(); ctx.arc(0, 0, f.r, 0, 6.3); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.3)';
      ctx.beginPath(); ctx.ellipse(-f.r * 0.35, -f.r * 0.4, f.r * 0.28, f.r * 0.16, -0.6, 0, 6.3); ctx.fill();
      if (f.kind === 'orange' || f.kind === 'apple') {
        ctx.strokeStyle = '#7A4A21'; ctx.lineWidth = 4; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(0, -f.r + 2); ctx.lineTo(4, -f.r - 8); ctx.stroke();
        ctx.fillStyle = '#3FAE5A';
        ctx.beginPath(); ctx.ellipse(12, -f.r - 4, 10, 5, -0.5, 0, 6.3); ctx.fill();
      }
      if (f.kind === 'kiwi') {
        ctx.fillStyle = 'rgba(255,255,255,.2)';
        ctx.beginPath(); ctx.arc(0, 0, f.r * 0.55, 0, 6.3); ctx.fill();
      }
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }
  function drawHalf(hf) {
    var def = fruitDef(hf.kind);
    var a = Math.max(0, 1 - hf.t / 0.7);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(hf.x, hf.y);
    ctx.rotate(hf.rot * 0.35 + hf.side * 0.9);
    // half disc: flat cut faces the blade direction
    ctx.beginPath();
    ctx.arc(0, 0, hf.r || def.r, -Math.PI / 2, Math.PI / 2);
    ctx.closePath();
    ctx.fillStyle = def.skin; ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 0, (hf.r || def.r) - 4, -Math.PI / 2, Math.PI / 2);
    ctx.closePath();
    ctx.fillStyle = def.flesh; ctx.fill();
    if (hf.kind === 'watermelon') {
      ctx.fillStyle = '#2B1A12';
      [[-8, -8], [6, -14], [-2, 6]].forEach(function (p) {
        ctx.beginPath(); ctx.ellipse(p[0], p[1], 2.4, 3.6, 0, 0, 6.3); ctx.fill();
      });
    }
    ctx.restore();
  }
  function drawBomb(f) {
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(f.rot * 0.2);
    ctx.fillStyle = '#22242E';
    ctx.beginPath(); ctx.arc(0, 0, f.r, 0, 6.3); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.35)';
    ctx.beginPath(); ctx.ellipse(-8, -10, 8, 5, -0.6, 0, 6.3); ctx.fill();
    ctx.strokeStyle = '#8A6A3E'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(4, -f.r + 4); ctx.quadraticCurveTo(14, -f.r - 12, 22, -f.r - 8); ctx.stroke();
    var flick = 3 + Math.sin(t * 18) * 2;
    ctx.fillStyle = '#FFC22E';
    ctx.beginPath(); ctx.arc(22, -f.r - 8, flick, 0, 6.3); ctx.fill();
    ctx.fillStyle = '#FF6A3D';
    ctx.beginPath(); ctx.arc(22, -f.r - 8, flick * 0.5, 0, 6.3); ctx.fill();
    // skull mark
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(-4, -2, 4, 0, 6.3); ctx.fill();
    ctx.beginPath(); ctx.arc(6, -2, 4, 0, 6.3); ctx.fill();
    ctx.fillRect(-2, 4, 8, 5);
    ctx.restore();
  }
  function draw() {
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var bgFull = ctx.createLinearGradient(0, oy, 0, oy + ch);
    bgFull.addColorStop(0, '#FFE9C9'); bgFull.addColorStop(0.6, '#FFF6E8'); bgFull.addColorStop(1, '#FFDFA8');
    ctx.fillStyle = bgFull; ctx.fillRect(0, 0, cw, ch);
    var shx = shake ? (Math.random() - 0.5) * shake : 0;
    var shy = shake ? (Math.random() - 0.5) * shake : 0;
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * ox + dpr * shx, dpr * oy + dpr * shy);
    // warm kitchen backdrop: wooden board + sunny wall
    var bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#FFE9C9'); bg.addColorStop(0.55, '#FFF6E8'); bg.addColorStop(1, '#FFDFA8');
    ctx.fillStyle = bg; ctx.fillRect(-30, -30, W + 60, H + 60);
    // cutting board at the bottom
    ctx.fillStyle = '#E8B06A';
    rr(-30, H - 84, W + 60, 114, 18); ctx.fill();
    ctx.fillStyle = '#D99A4E';
    rr(-30, H - 84, W + 60, 10, 5); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.35)';
    ctx.beginPath(); ctx.ellipse(W / 2, H - 40, 180, 16, 0, 0, 6.3); ctx.fill();
    // bunting flags across the top
    var cols = ['#FF6A3D', '#FFC22E', '#2FA84F', '#4F86FF', '#E8487D'];
    for (var i = 0; i < 7; i++) {
      var fx = 20 + i * 66;
      ctx.fillStyle = cols[i % cols.length];
      ctx.beginPath(); ctx.moveTo(fx, 0); ctx.lineTo(fx + 34, 0); ctx.lineTo(fx + 17, 26); ctx.closePath(); ctx.fill();
    }
    // halves
    halves.forEach(function (hf) { drawHalf(hf); });
    // fruits and bombs
    fruits.forEach(function (f) {
      if (f.sliced) return;
      if (f.bomb) drawBomb(f); else drawFruitBody(f);
    });
    // juice particles
    particles.forEach(function (pt) {
      ctx.globalAlpha = Math.max(0, 1 - pt.t / 0.7);
      ctx.fillStyle = pt.color;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.r, 0, 6.3); ctx.fill();
    });
    ctx.globalAlpha = 1;
    // blade trail
    if (trail.length > 1) {
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (var j = 1; j < trail.length; j++) {
        var a = j / trail.length;
        ctx.strokeStyle = 'rgba(255,255,255,' + (a * 0.9) + ')';
        ctx.lineWidth = 2 + a * 8;
        ctx.beginPath(); ctx.moveTo(trail[j - 1].x, trail[j - 1].y); ctx.lineTo(trail[j].x, trail[j].y); ctx.stroke();
      }
      var tip = trail[trail.length - 1];
      ctx.fillStyle = 'rgba(255,255,255,.9)';
      ctx.beginPath(); ctx.arc(tip.x, tip.y, 5, 0, 6.3); ctx.fill();
    }
    // popups
    popups.forEach(function (p) {
      var a = 1 - p.t / 0.9;
      ctx.globalAlpha = a;
      ctx.font = '900 26px Poppins, "DejaVu Sans", sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,.4)';
      var py = p.y - p.t * 50;
      ctx.strokeText(p.text, p.x, py);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, py);
      ctx.globalAlpha = 1;
    });
    // big score while playing
    if (state === 'playing' || state === 'idle') {
      ctx.font = '900 46px Poppins, "DejaVu Sans", sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.lineWidth = 7; ctx.strokeStyle = 'rgba(0,0,0,.3)';
      ctx.strokeText(String(score), W / 2, H * 0.44);
      ctx.fillStyle = 'rgba(255,255,255,.95)';
      ctx.fillText(String(score), W / 2, H * 0.44);
    }
    if (state === 'idle') {
      ctx.font = '900 24px Poppins, "DejaVu Sans", sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      var pulse = 0.65 + Math.sin(t * 4) * 0.35;
      ctx.globalAlpha = pulse;
      ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,.35)';
      ctx.strokeText('Swipe through the fruit —', W / 2, H * 0.58);
      ctx.strokeText('but never touch a bomb!', W / 2, H * 0.58 + 30);
      ctx.fillStyle = '#fff';
      ctx.fillText('Swipe through the fruit —', W / 2, H * 0.58);
      ctx.fillText('but never touch a bomb!', W / 2, H * 0.58 + 30);
      ctx.globalAlpha = 1;
    }
    // bomb flash
    if (flash > 0) {
      ctx.fillStyle = flashColor;
      ctx.globalAlpha = flash;
      ctx.fillRect(-30, -30, W + 60, H + 60);
      ctx.globalAlpha = 1;
    }
  }

  /* ---------- input ---------- */
  function pointerToWorld(e) {
    var r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
  }
  function pushTrail(p) {
    trail.push({ x: p.x, y: p.y, t: t });
    if (trail.length > 14) trail.shift();
  }
  canvas.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    if (state === 'idle') { start(); return; }
    if (state !== 'playing' || paused) return;
    swiping = true;
    trail = [];
    pushTrail(pointerToWorld(e));
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  });
  canvas.addEventListener('pointermove', function (e) {
    if (!swiping || state !== 'playing' || paused) return;
    e.preventDefault();
    pushTrail(pointerToWorld(e));
  });
  function endSwipe() { swiping = false; }
  canvas.addEventListener('pointerup', endSwipe);
  canvas.addEventListener('pointercancel', endSwipe);

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
      h('p', { class: 'mg-sub', text: 'The fruit is frozen mid-air. The blade is waiting.' }),
      h('div', { class: 'mg-row' }, restart, resume)));
    overlay.hidden = false;
    MG.focusSafe(resume, 300);
  }
  pauseBtn.addEventListener('click', function () {
    if (paused) { paused = false; overlay.hidden = true; } else pauseGame();
  });
  MG.onPause(pauseGame);

  /* ---------- sound button ---------- */
  soundBtn.addEventListener('click', function () { MG.sound.toggle(); renderSound(); });
  function renderSound() {
    soundBtn.innerHTML = MG.sound.muted
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z" fill="currentColor"/><path d="m16 9 6 6M22 9l-6 6"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z" fill="currentColor"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>';
    soundBtn.setAttribute('aria-label', MG.sound.muted ? 'Turn sound on' : 'Turn sound off');
  }

  /* ---------- start screen ---------- */
  function showStart() {
    var play = h('button', { class: 'mg-btn', type: 'button', text: 'Start slicing' });
    play.addEventListener('click', start);
    overlay.innerHTML = '';
    overlay.append(h('div', { class: 'mg-card', role: 'dialog', 'aria-label': 'Fruit Slice' },
      h('div', { class: 'fs-badge', 'aria-hidden': 'true', text: '🍉' }),
      h('h2', { class: 'mg-title', text: 'Fruit Slice' }),
      h('p', { class: 'mg-sub', text: 'Juicy fruit flies up from the board — swipe through it to slice. You have three lives: miss a fruit or touch a bomb and you lose one. Slice three or more in one swipe for double points.' + (best ? ' Your best is ' + best + ' points.' : '') }),
      play));
    overlay.hidden = false;
  }

  /* ---------- start ---------- */
  renderSound(); reset(); showStart();
  resize();
  requestAnimationFrame(tick);
  if (o.showcase) { // still frame: fruit mid-flight, a sliced pair, a bomb, score 120
    overlay.hidden = true;
    state = 'playing'; paused = true; // frozen frame
    score = 120; best = Math.max(best, 240); lives = 3;
    fruits = [
      { kind: 'watermelon', x: 120, y: 300, vx: 0, vy: -200, r: 34, rot: 0.4, vr: 0, sliced: false, bomb: false },
      { kind: 'orange', x: 330, y: 220, vx: 0, vy: -260, r: 26, rot: -0.3, vr: 0, sliced: false, bomb: false },
      { kind: 'apple', x: 250, y: 420, vx: 0, vy: -140, r: 26, rot: 0.2, vr: 0, sliced: false, bomb: false },
      { kind: 'lemon', x: 380, y: 380, vx: 0, vy: -180, r: 24, rot: 0.5, vr: 0, sliced: false, bomb: false },
      { kind: 'bomb', x: 90, y: 180, vx: 0, vy: -220, r: 26, rot: 0, vr: 0, sliced: false, bomb: true },
    ];
    halves = [
      { kind: 'kiwi', x: 210, y: 250, vx: -70, vy: -120, rot: 0.3, vr: 2, side: -1, t: 0.15, r: 22 },
      { kind: 'kiwi', x: 260, y: 250, vx: 70, vy: -120, rot: -0.2, vr: -2, side: 1, t: 0.15, r: 22 },
    ];
    trail = [{ x: 150, y: 330, t: 0 }, { x: 200, y: 290, t: 0.02 }, { x: 250, y: 255, t: 0.04 }, { x: 300, y: 220, t: 0.06 }];
    popups = [{ text: '+20', x: 235, y: 210, t: 0.1, color: '#fff' }];
    root.classList.add('is-showcase');
    renderHud(); draw();
    setTimeout(function () { document.documentElement.setAttribute('data-ready', '1'); }, 80);
  }
  MG.ready();
})();
