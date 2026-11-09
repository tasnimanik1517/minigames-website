/* Fruit Merge engine: drop fruit into the jar; two of the same kind that touch become the next bigger fruit.
 * Own circle physics (Verlet integration, several solver passes per frame) and fruit art drawn in code,
 * cached as sprites. Options: { showcase: true } still frame for cover art. */
(function () {
  'use strict';
  var MG = window.MG, h = MG.h;
  var o = window.GAME_OPTIONS || {};
  var reduce = false;
  try { reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* ignore */ }
  var ICON = {
    soundOn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z" fill="currentColor"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>',
    soundOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z" fill="currentColor"/><path d="m16 9 6 6M22 9l-6 6"/></svg>',
    restart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4h4"/></svg>'
  };
  // name, radius (jar is 100 units wide), body light/mid/dark, accent
  var FRUIT = [
    ['Blueberry', 3.6, '#8FA8FF', '#4157C9', '#1F2A78', '#2B3A99'],
    ['Cherry', 4.8, '#FF8A8A', '#E2232F', '#8E0D16', '#3E8E2E'],
    ['Strawberry', 6.2, '#FF9AA2', '#F0324A', '#A3122A', '#3FA34D'],
    ['Lime', 7.6, '#D7F58A', '#7CC62C', '#3F7D12', '#2F7A1E'],
    ['Plum', 9.1, '#D7A8FF', '#8E3FD6', '#4C1680', '#5D9C3A'],
    ['Orange', 10.8, '#FFD08A', '#FF8E1F', '#C2540A', '#3F8F2A'],
    ['Apple', 12.6, '#FFB0A0', '#E8352E', '#97141A', '#4E9A2A'],
    ['Peach', 14.6, '#FFE0C2', '#FFA27A', '#E0605A', '#5BA33A'],
    ['Mango', 16.8, '#FFF0A0', '#FFC23A', '#F0702A', '#4F9C35'],
    ['Coconut', 19.2, '#C99A6E', '#8A5A33', '#4E2E14', '#6B4425'],
    ['Melon', 21.8, '#EAFFC8', '#B6E57A', '#6FA83E', '#5E8F2E'],
    ['Watermelon', 24.8, '#8FE08A', '#2E9E3E', '#14581F', '#0F4A18']
  ];
  var W = 100, H = 132, DANGER = 22, G = 640;
  var reduceSteps = reduce;

  /* ---------- state ---------- */
  var fruits = [], nextId = 1, score = 0, best = +MG.store.get('best', 0) || 0, bestBefore = best, over = false;
  var aimX = W / 2, current = 0, next = 0, cooldown = 0, biggest = 0, dangerT = 0, combo = 0, comboT = 0;
  var pops = [], parts = [], noMerge = false, font = 'sans-serif';

  /* ---------- DOM ---------- */
  var scoreEl = h('b', { text: '0' }), bestEl = h('b', { text: String(best) });
  var nextCv = h('canvas', { class: 'fm-nextcv', width: 40, height: 40, 'aria-hidden': 'true' });
  var nextPill = h('span', { class: 'mg-pill fm-next' }, h('small', { text: 'Next' }), nextCv);
  var restartBtn = h('button', { class: 'mg-icon-btn', type: 'button', 'aria-label': 'New game', title: 'New game', html: ICON.restart });
  var soundBtn = h('button', { class: 'mg-icon-btn', type: 'button' });
  var cv = h('canvas', { class: 'fm-cv', 'aria-label': 'Fruit jar. Move to aim, tap or press Space to drop.', role: 'img' });
  var ladder = h('div', { class: 'fm-ladder', 'aria-hidden': 'true' });
  var live = h('p', { class: 'mg-sr', 'aria-live': 'polite' });
  var overlay = h('div', { class: 'mg-overlay', hidden: true });
  var main = h('div', { class: 'fm-main' }, cv);
  var root = h('div', { class: 'mg-root fm' },
    h('div', { class: 'mg-hud' }, h('span', { class: 'mg-pill fm-score' }, h('small', { text: 'Score' }), scoreEl), h('span', { class: 'mg-pill' }, h('small', { text: 'Best' }), bestEl), nextPill,
      h('span', { class: 'mg-spacer' }), restartBtn, soundBtn),
    main, ladder, live, overlay);
  document.getElementById('game').append(root);

  /* ---------- drawing: each fruit is painted once per size into a sprite ---------- */
  var ctx = null, scale = 4, ox = 0, oy = 0, dpr = 1, sprites = [], spriteScale = 0;
  function paintFruit(c, k, r) {
    var f = FRUIT[k], g;
    c.save();
    // body
    g = c.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
    g.addColorStop(0, f[2]); g.addColorStop(0.55, f[3]); g.addColorStop(1, f[4]);
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, r, 0, 6.2832); c.fill();
    // textures
    c.save(); c.beginPath(); c.arc(0, 0, r, 0, 6.2832); c.clip();
    var name = f[0];
    if (name === 'Watermelon') { c.strokeStyle = 'rgba(10,60,20,.55)'; c.lineWidth = r * 0.13; for (var s = -3; s <= 3; s++) { c.beginPath(); c.moveTo(s * r * 0.32, -r); c.bezierCurveTo(s * r * 0.32 + r * 0.18, -r * 0.3, s * r * 0.32 - r * 0.18, r * 0.3, s * r * 0.32, r); c.stroke(); } }
    if (name === 'Melon') { c.strokeStyle = 'rgba(255,255,240,.55)'; c.lineWidth = r * 0.035; for (var m = -4; m <= 4; m++) { c.beginPath(); c.moveTo(m * r * 0.24 - r, -r); c.lineTo(m * r * 0.24 + r, r); c.stroke(); c.beginPath(); c.moveTo(m * r * 0.24 + r, -r); c.lineTo(m * r * 0.24 - r, r); c.stroke(); } }
    if (name === 'Coconut') { c.strokeStyle = 'rgba(40,20,5,.45)'; c.lineWidth = r * 0.03; for (var q = 0; q < 26; q++) { var a = q * 0.85, rr = r * (0.3 + (q % 5) * 0.14); c.beginPath(); c.arc(Math.cos(a) * rr * 0.4, Math.sin(a) * rr * 0.4, rr * 0.5, a, a + 0.9); c.stroke(); } }
    if (name === 'Strawberry') { c.fillStyle = '#FFE680'; for (var sx = -3; sx <= 3; sx++) for (var sy = -2; sy <= 3; sy++) { if ((sx + sy) % 2) continue; c.beginPath(); c.ellipse(sx * r * 0.26, sy * r * 0.26 + r * 0.05, r * 0.05, r * 0.08, 0.3, 0, 6.2832); c.fill(); } }
    if (name === 'Orange' || name === 'Lime') { c.fillStyle = 'rgba(255,255,255,.18)'; for (var d = 0; d < 34; d++) { var da = d * 2.39, dr = r * Math.sqrt(d / 34) * 0.92; c.beginPath(); c.arc(Math.cos(da) * dr, Math.sin(da) * dr, r * 0.035, 0, 6.2832); c.fill(); } }
    if (name === 'Peach') { c.strokeStyle = 'rgba(180,60,60,.35)'; c.lineWidth = r * 0.05; c.beginPath(); c.moveTo(r * 0.05, -r); c.quadraticCurveTo(-r * 0.3, 0, r * 0.1, r); c.stroke(); }
    if (name === 'Plum') { g = c.createRadialGradient(r * 0.3, r * 0.3, 0, r * 0.3, r * 0.3, r); g.addColorStop(0, 'rgba(255,255,255,.18)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(-r, -r, 2 * r, 2 * r); }
    if (name === 'Mango') { g = c.createLinearGradient(-r, r, r, -r); g.addColorStop(0, 'rgba(255,60,40,.35)'); g.addColorStop(0.5, 'rgba(255,60,40,0)'); c.fillStyle = g; c.fillRect(-r, -r, 2 * r, 2 * r); }
    c.restore();
    // rim shade
    c.strokeStyle = 'rgba(0,0,0,.12)'; c.lineWidth = r * 0.05; c.beginPath(); c.arc(0, 0, r * 0.975, 0, 6.2832); c.stroke();
    // stems, leaves, crowns
    if (name === 'Blueberry') { c.fillStyle = '#1A2366'; star(c, 0, -r * 0.62, r * 0.28, 5); }
    else if (name === 'Strawberry') { c.fillStyle = f[5]; for (var l = 0; l < 5; l++) { c.save(); c.translate(0, -r * 0.82); c.rotate(-1.2 + l * 0.6); c.beginPath(); c.ellipse(0, -r * 0.16, r * 0.11, r * 0.26, 0, 0, 6.2832); c.fill(); c.restore(); } }
    else if (name === 'Coconut') { c.fillStyle = '#2A1606'; [[-0.22, -0.2], [0.22, -0.2], [0, 0.08]].forEach(function (p) { c.beginPath(); c.arc(p[0] * r, p[1] * r - r * 0.35, r * 0.07, 0, 6.2832); c.fill(); }); }
    else if (name !== 'Melon' && name !== 'Watermelon') {
      c.strokeStyle = '#6B4425'; c.lineWidth = Math.max(1, r * 0.09); c.lineCap = 'round';
      c.beginPath(); c.moveTo(0, -r * 0.82); c.quadraticCurveTo(r * 0.05, -r * 1.12, r * 0.2, -r * 1.2); c.stroke();
      c.fillStyle = f[5]; c.beginPath(); c.ellipse(r * 0.36, -r * 1.1, r * 0.28, r * 0.12, -0.5, 0, 6.2832); c.fill();
    } else { c.strokeStyle = '#4E7A22'; c.lineWidth = Math.max(1, r * 0.06); c.lineCap = 'round'; c.beginPath(); c.moveTo(0, -r * 0.94); c.quadraticCurveTo(r * 0.12, -r * 1.12, r * 0.06, -r * 1.2); c.stroke(); }
    // face
    var ey = -r * 0.02, ex = r * 0.3, es = Math.max(0.8, r * 0.1);
    c.fillStyle = name === 'Blueberry' || name === 'Plum' || name === 'Coconut' ? '#FFFFFF' : '#2A1A14';
    c.beginPath(); c.ellipse(-ex, ey, es * 0.8, es, 0, 0, 6.2832); c.ellipse(ex, ey, es * 0.8, es, 0, 0, 6.2832); c.fill();
    c.fillStyle = 'rgba(255,255,255,.9)'; c.beginPath(); c.arc(-ex + es * 0.25, ey - es * 0.35, es * 0.32, 0, 6.2832); c.arc(ex + es * 0.25, ey - es * 0.35, es * 0.32, 0, 6.2832); c.fill();
    c.strokeStyle = c.fillStyle = name === 'Blueberry' || name === 'Plum' || name === 'Coconut' ? '#FFFFFF' : '#2A1A14';
    c.lineWidth = Math.max(0.8, r * 0.06); c.lineCap = 'round';
    c.beginPath(); c.arc(0, ey + r * 0.14, r * 0.14, 0.25, Math.PI - 0.25); c.stroke();
    c.fillStyle = 'rgba(255,90,120,.35)'; c.beginPath(); c.ellipse(-ex - r * 0.1, ey + r * 0.2, r * 0.13, r * 0.08, 0, 0, 6.2832); c.ellipse(ex + r * 0.1, ey + r * 0.2, r * 0.13, r * 0.08, 0, 0, 6.2832); c.fill();
    // gloss
    g = c.createRadialGradient(-r * 0.4, -r * 0.45, 0, -r * 0.4, -r * 0.45, r * 0.55);
    g.addColorStop(0, 'rgba(255,255,255,.75)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, r, 0, 6.2832); c.fill();
    c.restore();
  }
  function star(c, x, y, r, n) { c.beginPath(); for (var i = 0; i < n * 2; i++) { var a = -Math.PI / 2 + i * Math.PI / n, rr = i % 2 ? r * 0.45 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } c.closePath(); c.fill(); }
  function buildSprites() {
    sprites = FRUIT.map(function (f, k) {
      var r = f[1] * scale * dpr, pad = r * 0.4, s = document.createElement('canvas');
      s.width = s.height = Math.ceil(2 * r + 2 * pad);
      var c = s.getContext('2d'); c.translate(s.width / 2, s.height / 2); paintFruit(c, k, r);
      return s;
    });
    spriteScale = scale * dpr;
    // ladder + next preview use small sprites
    ladder.innerHTML = '';
    FRUIT.forEach(function (f, k) {
      var c = document.createElement('canvas'), px = 30; c.width = c.height = px * 2;
      var x = c.getContext('2d'); x.translate(px, px); paintFruit(x, k, px * 0.72 * (0.62 + k * 0.035));
      ladder.append(h('span', { class: 'fm-step' + (k <= biggest ? ' got' : ''), title: f[0] }, c));
    });
    drawNext();
  }
  function drawNext() {
    var x = nextCv.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, 40, 40); x.translate(20, 22);
    paintFruit(x, next, 6 + next * 3);
  }

  /* ---------- layout ---------- */
  function layout() {
    var bw = main.clientWidth, bh = main.clientHeight;
    if (!bw || !bh) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    var s = Math.min((bw - 16) / (W + 8), (bh - 10) / (H + 16)) * (o.showcase ? 0.86 : 1);
    scale = s;
    ctx = MG.fitCanvas(cv, bw, bh);
    ox = (bw - W * s) / 2; oy = bh - H * s - (o.showcase ? 70 : 6);
    if (Math.abs(spriteScale - scale * dpr) > 0.01) buildSprites();
    if (o.showcase || over) draw(); // resizing clears the canvas; redraw when the frame loop is not running
  }
  if (window.ResizeObserver) new ResizeObserver(layout).observe(main); else window.addEventListener('resize', layout);

  /* ---------- physics ---------- */
  function add(k, x, y, vy) {
    var f = { id: nextId++, k: k, r: FRUIT[k][1], x: x, y: y, px: x, py: y - (vy || 0) / 60, a: Math.random() * 6.28, born: performance.now(), merged: false };
    fruits.push(f); return f;
  }
  function step(dt) {
    var i, j, f, sub = 8, sdt = dt / sub;
    for (var s = 0; s < sub; s++) {
      for (i = 0; i < fruits.length; i++) {
        f = fruits[i];
        var vx = (f.x - f.px) * 0.998, vy = (f.y - f.py) * 0.998;
        f.px = f.x; f.py = f.y; f.x += vx; f.y += vy + G * sdt * sdt;
        f.a += vx / f.r;
      }
      for (var it = 0; it < 3; it++) {
        for (i = 0; i < fruits.length; i++) {
          var a = fruits[i];
          for (j = i + 1; j < fruits.length; j++) {
            var b = fruits[j], dx = b.x - a.x, dy = b.y - a.y, rs = a.r + b.r;
            if (dx > rs || dx < -rs || dy > rs || dy < -rs) continue;
            var d2 = dx * dx + dy * dy;
            if (d2 >= rs * rs) continue;
            if (a.k === b.k && !noMerge && !a.merged && !b.merged) { merge(a, b); continue; }
            var d = Math.sqrt(d2) || 0.001, ov = (rs - d) / d, ma = a.r * a.r, mb = b.r * b.r, t = ov / (ma + mb);
            a.x -= dx * t * mb; a.y -= dy * t * mb; b.x += dx * t * ma; b.y += dy * t * ma;
          }
          if (a.x < a.r) { a.x = a.r; a.px += (a.x - a.px) * 0.3; }
          if (a.x > W - a.r) { a.x = W - a.r; a.px += (a.x - a.px) * 0.3; }
          if (a.y > H - a.r) { a.y = H - a.r; a.px += (a.x - a.px) * 0.12; }
        }
      }
      if (fruits.some(function (q) { return q.merged; })) fruits = fruits.filter(function (q) { return !q.merged; });
    }
  }
  function merge(a, b) {
    a.merged = b.merged = true;
    var k = a.k + 1, x = (a.x + b.x) / 2, y = (a.y + b.y) / 2;
    var pts = (k + 1) * (k + 2) / 2;
    if (k >= FRUIT.length) { // two watermelons: both vanish for a big bonus
      pts = 200; burst(x, y, '#FFE066', 50); MG.confetti(140); toast('Double watermelon! +200');
    } else {
      var n = add(k, x, y, -40); n.born = performance.now() - 400; n.pop = 1;
      if (k > biggest) { biggest = k; markLadder(); if (k >= 6) toast('New fruit: ' + FRUIT[k][0] + '!'); if (k === FRUIT.length - 1) { MG.confetti(160); MG.sfx.win(); } }
      burst(x, y, FRUIT[k][2], 10 + k * 2);
    }
    combo = comboT > 0 ? combo + 1 : 1; comboT = 0.9;
    score += pts * (combo >= 3 ? 2 : 1);
    pops.push({ x: x, y: y - FRUIT[Math.min(k, FRUIT.length - 1)][1], t: 0, text: '+' + pts * (combo >= 3 ? 2 : 1) });
    var base = [392, 440, 494, 523, 587, 659, 698, 784, 880, 988, 1047, 1175][Math.min(k, 11)];
    MG.tone(base, 0.12, 'triangle', 0.06); MG.tone(base * 1.5, 0.1, 'sine', 0.03, 0, 0.05);
    if (combo >= 3) MG.tone(base * 2, 0.08, 'sine', 0.03, 0, 0.1);
    MG.vibrate(k >= 7 ? 20 : 8);
    if (score > best) { best = score; MG.store.set('best', best); }
    hud();
  }
  function markLadder() { Array.prototype.forEach.call(ladder.children, function (el, k) { el.classList.toggle('got', k <= biggest); }); }
  function burst(x, y, col, n) { if (reduce) return; for (var i = 0; i < n; i++) { var a = Math.random() * 6.28, sp = 20 + Math.random() * 50; parts.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 20, t: 0, max: 0.5 + Math.random() * 0.4, c: i % 3 ? col : '#FFFFFF', s: 0.6 + Math.random() * 1.1 }); } }
  function toast(t) { var el = h('div', { class: 'mg-toast fm-toast', text: t }); root.append(el); setTimeout(function () { el.remove(); }, 1600); }

  /* ---------- game flow ---------- */
  function pick() { var r = Math.random(); return r < 0.32 ? 0 : r < 0.6 ? 1 : r < 0.82 ? 2 : r < 0.95 ? 3 : 4; }
  function drop() {
    if (over || cooldown > 0 || !overlay.hidden) return;
    var r = FRUIT[current][1], x = Math.max(r, Math.min(W - r, aimX));
    add(current, x, DANGER - r - 3, 10);
    MG.tone(300, 0.06, 'sine', 0.04, 200);
    current = next; next = pick(); cooldown = 0.45; drawNext();
    save();
  }
  function hud() { scoreEl.textContent = score; bestEl.textContent = Math.max(best, score); }
  function save() {
    if (o.showcase || over) return;
    MG.store.set('state', { fruits: fruits.map(function (f) { return [Math.round(f.x * 10) / 10, Math.round(f.y * 10) / 10, f.k]; }), score: score, current: current, next: next, biggest: biggest });
  }
  function newGame() {
    overlay.hidden = true; fruits = []; parts = []; pops = []; score = 0; over = false; dangerT = 0; biggest = 0; combo = 0;
    current = pick(); next = pick(); bestBefore = best; markLadder(); drawNext(); hud(); save();
    MG.event('game_start', {});
  }
  function restore() {
    var s = MG.store.get('state', null);
    if (!s || !s.fruits) { newGame(); return; }
    fruits = []; s.fruits.forEach(function (p) { if (p[2] >= 0 && p[2] < FRUIT.length) add(p[2], p[0], p[1], 0); });
    dangerT = 0; // a restored jar gets a grace period: fruit ages (set in add) and the danger timer start fresh, so the pile can settle first
    score = s.score || 0; current = s.current || 0; next = s.next || 0; biggest = s.biggest || 0; bestBefore = best;
    markLadder(); drawNext(); hud();
  }
  function gameOver() {
    over = true; MG.store.set('state', null); MG.sfx.lose();
    MG.event('game_over', { score: score, biggest: biggest });
    var isBest = score > bestBefore;
    var again = h('button', { class: 'mg-btn', type: 'button', text: 'Play again' });
    again.addEventListener('click', function () { MG.adBreak('next', 'fruit-again', newGame); });
    var c = document.createElement('canvas'); c.width = c.height = 120; var x = c.getContext('2d'); x.translate(60, 62); paintFruit(x, biggest, 46);
    overlay.innerHTML = '';
    overlay.append(h('div', { class: 'mg-card fm-card', role: 'dialog', 'aria-modal': 'true' },
      h('h2', { class: 'mg-title', text: 'The jar is full' }), isBest ? h('span', { class: 'mg-badge', text: 'New best!' }) : null,
      h('div', { class: 'mg-big', text: String(score) }), c,
      h('p', { class: 'mg-sub', text: 'Biggest fruit: ' + FRUIT[biggest][0] + (isBest ? '' : ' · Best score: ' + best) }), again));
    overlay.hidden = false;
    if (isBest) MG.confetti(120);
    MG.focusSafe(again);
  }

  /* ---------- frame ---------- */
  var last = 0, paused = false, saveT = 0;
  function frame(t) {
    requestAnimationFrame(frame);
    if (!ctx) { layout(); if (!ctx) return; }
    var dt = Math.min(0.033, (t - last) / 1000 || 0.016); last = t;
    if (!paused && !over) {
      step(dt);
      cooldown = Math.max(0, cooldown - dt); comboT = Math.max(0, comboT - dt);
      if (comboT === 0) combo = 0;
      // losing: a settled fruit stays above the line
      var now = performance.now(), high = fruits.some(function (f) { return now - f.born > 1500 && f.y - f.r < DANGER && Math.abs(f.y - f.py) < 0.05; });
      dangerT = high ? dangerT + dt : Math.max(0, dangerT - dt * 2);
      if (dangerT > 2.2) gameOver();
      saveT += dt; if (saveT > 2) { saveT = 0; save(); }
    }
    parts.forEach(function (p) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 120 * dt; });
    parts = parts.filter(function (p) { return p.t < p.max; });
    pops.forEach(function (p) { p.t += dt; }); pops = pops.filter(function (p) { return p.t < 0.9; });
    draw();
  }
  function draw() {
    var c = ctx, s = scale, bw = main.clientWidth, bh = main.clientHeight;
    c.clearRect(0, 0, bw, bh);
    c.save(); c.translate(ox, oy); c.scale(s, s);
    // jar back
    var jr = 6;
    c.fillStyle = 'rgba(255,255,255,.42)'; rr(c, -2.5, DANGER - 18, W + 5, H - DANGER + 20.5, jr); c.fill();
    // danger line
    var warn = Math.min(1, dangerT / 2.2);
    c.strokeStyle = warn > 0.05 ? 'rgba(255,70,90,' + (0.4 + 0.6 * Math.abs(Math.sin(performance.now() / 120)) * warn) + ')' : 'rgba(120,90,60,.28)';
    c.lineWidth = 0.6; c.setLineDash([2.2, 1.6]); c.beginPath(); c.moveTo(0, DANGER); c.lineTo(W, DANGER); c.stroke(); c.setLineDash([]);
    // aim guide + held fruit
    if (!over) {
      var r0 = FRUIT[current][1], ax = Math.max(r0, Math.min(W - r0, aimX)), ay = DANGER - r0 - 3;
      c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 0.5; c.setLineDash([1.2, 1.6]);
      c.beginPath(); c.moveTo(ax, ay + r0); c.lineTo(ax, H); c.stroke(); c.setLineDash([]);
      if (cooldown <= 0.15) sprite(c, current, ax, ay, 0, 1);
    }
    // fruit
    var now = performance.now();
    fruits.forEach(function (f) {
      var pop = f.pop && now - f.born < 600 ? 1 + 0.18 * Math.sin(Math.min(1, (now - f.born - 400) / 200) * Math.PI) : 1;
      sprite(c, f.k, f.x, f.y, f.a, pop);
    });
    // particles + score pops
    parts.forEach(function (p) { c.globalAlpha = 1 - p.t / p.max; c.fillStyle = p.c; c.beginPath(); c.arc(p.x, p.y, p.s, 0, 6.2832); c.fill(); });
    c.globalAlpha = 1;
    c.font = '900 5px ' + font; c.textAlign = 'center';
    pops.forEach(function (p) { c.globalAlpha = 1 - p.t / 0.9; c.fillStyle = '#FFFFFF'; c.strokeStyle = 'rgba(120,40,0,.6)'; c.lineWidth = 0.8; c.strokeText(p.text, p.x, p.y - p.t * 10); c.fillText(p.text, p.x, p.y - p.t * 10); });
    c.globalAlpha = 1;
    // jar glass front: walls, rim, shine
    c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 1.6;
    c.beginPath(); c.moveTo(-1.2, DANGER - 16); c.lineTo(-1.2, H - jr + 1); c.quadraticCurveTo(-1.2, H + 1.2, jr - 1, H + 1.2); c.lineTo(W - jr + 1, H + 1.2); c.quadraticCurveTo(W + 1.2, H + 1.2, W + 1.2, H - jr + 1); c.lineTo(W + 1.2, DANGER - 16); c.stroke();
    c.fillStyle = 'rgba(255,255,255,.22)'; c.fillRect(3, DANGER - 10, 2.2, H - DANGER + 2);
    c.restore();
  }
  function sprite(c, k, x, y, a, sc) {
    var sp = sprites[k]; if (!sp) return;
    var w = sp.width / spriteScale * (sc || 1);
    c.save(); c.translate(x, y); c.rotate(a); c.drawImage(sp, -w / 2, -w / 2, w, w); c.restore();
  }
  function rr(c, x, y, w, hh, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + hh, r); c.arcTo(x + w, y + hh, x, y + hh, r); c.arcTo(x, y + hh, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }

  /* ---------- input ---------- */
  function toWorld(clientX) { var b = cv.getBoundingClientRect(); return (clientX - b.left - ox) / scale; }
  var down = false;
  cv.addEventListener('pointerdown', function (e) { if (over || !overlay.hidden) return; down = true; aimX = toWorld(e.clientX); try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } });
  cv.addEventListener('pointermove', function (e) { if (e.pointerType === 'mouse' || down) aimX = toWorld(e.clientX); });
  cv.addEventListener('pointerup', function (e) { if (!down) return; down = false; aimX = toWorld(e.clientX); drop(); });
  cv.addEventListener('pointercancel', function () { down = false; });
  document.addEventListener('keydown', function (e) {
    if (!overlay.hidden) return;
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') { aimX = Math.max(0, aimX - 4); e.preventDefault(); }
    else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') { aimX = Math.min(W, aimX + 4); e.preventDefault(); }
    else if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); drop(); }
  });
  soundBtn.addEventListener('click', function () { MG.sound.toggle(); renderSound(); });
  restartBtn.addEventListener('click', function () { if (fruits.length > 3 && !over) { MG.adBreak('next', 'fruit-new', newGame); } else newGame(); });
  function renderSound() { soundBtn.innerHTML = MG.sound.muted ? ICON.soundOff : ICON.soundOn; soundBtn.setAttribute('aria-label', MG.sound.muted ? 'Turn sound on' : 'Turn sound off'); }
  MG.onPause(function () { paused = true; save(); });
  MG.onResume(function () { paused = false; });
  window.addEventListener('focus', function () { paused = false; });
  cv.addEventListener('pointerdown', function () { paused = false; });

  /* ---------- start ---------- */
  renderSound();
  try { font = getComputedStyle(root).fontFamily || font; } catch (e) { /* ignore */ }
  if (o.emblem) { // app icon art: a big watermelon with a strawberry and a cherry
    var E = 976, ec = h('canvas', { width: E, height: E, style: 'position:fixed;left:24px;top:24px;width:976px;height:976px;border-radius:230px' });
    document.body.append(ec); root.style.display = 'none';
    var ex = ec.getContext('2d'), eg = ex.createLinearGradient(0, 0, 0, E);
    eg.addColorStop(0, '#FFE98A'); eg.addColorStop(0.56, '#FFD86B'); eg.addColorStop(0.562, '#BFEBC8'); eg.addColorStop(1, '#A9E3B9');
    ex.fillStyle = eg; ex.fillRect(0, 0, E, E);
    ex.save(); ex.translate(575, 600); paintFruit(ex, 11, 300); ex.restore();
    ex.save(); ex.translate(235, 360); ex.rotate(-0.25); paintFruit(ex, 2, 150); ex.restore();
    ex.save(); ex.translate(250, 760); ex.rotate(0.2); paintFruit(ex, 1, 105); ex.restore();
    return;
  }
  if (o.showcase) { // still frame: a jar half full, settled by running the physics for a few seconds
    root.classList.add('is-showcase');
    var r = (function (seed) { return function () { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }; })(7);
    noMerge = true;
    [[11, 26], [7, 76], [6, 52], [5, 86], [5, 30], [4, 60], [3, 14], [3, 70], [2, 42], [2, 90], [1, 22], [1, 58], [1, 80], [0, 36], [0, 66]].forEach(function (p) {
      add(p[0], p[1] + (r() - 0.5) * 6, 12, 0);
      for (var q = 0; q < 50; q++) step(1 / 60);
    });
    for (var q2 = 0; q2 < 240; q2++) step(1 / 60);
    fruits.forEach(function (f) { f.px = f.x; f.py = f.y; });
    current = 5; next = 3; biggest = 11; score = 2480; hud();
    layout(); buildSprites(); draw();
    setTimeout(function () { layout(); draw(); document.documentElement.setAttribute('data-ready', '1'); }, 120);
  } else { restore(); requestAnimationFrame(frame); }
  MG.ready();
})();
