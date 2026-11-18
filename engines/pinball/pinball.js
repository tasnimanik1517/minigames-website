/* Pinball engine: a neon arcade table with three bumpers, two slingshots and two flippers.
 * Keep the silver ball in play, light all three bumpers for a jackpot, and do not let it drain.
 * Three balls per game. Canvas game on a fixed logical world (480 x 640) scaled to fit the stage.
 * Options: { showcase: true } still frame for cover art. */
(function () {
  'use strict';
  var MG = window.MG, h = MG.h, o = window.GAME_OPTIONS || {};

  /* logical world */
  var W = 480, H = 640;
  var BALL_R = 9, GRAVITY = 880, MAX_SPEED = 980;
  var BALLS = 3;
  var DOME = { x: 240, y: 240, r: 226 }; // the round top of the table
  var WALL_L = 14, WALL_R = 466, WALL_TOP = 240;
  var GUIDE_L = { x1: 14, y1: 560, x2: 150, y2: 620 }; // sloped inlane guides
  var GUIDE_R = { x1: 466, y1: 560, x2: 330, y2: 620 };
  var BUMPERS = [
    { x: 150, y: 205, r: 27, color: '#FF4D8D', lit: false },
    { x: 330, y: 205, r: 27, color: '#FFC22E', lit: false },
    { x: 240, y: 305, r: 27, color: '#22D3EE', lit: false }
  ];
  var SLINGS = [ // triangular slingshots above the flippers: [x1,y1,x2,y2] = the two kicking edges
    { pts: [[52, 452], [152, 432], [152, 542]], edges: [[0, 1], [1, 2]], color: '#FF6A3D' },
    { pts: [[428, 452], [328, 432], [328, 542]], edges: [[0, 1], [1, 2]], color: '#FF6A3D' }
  ];
  var LANES = [ // rollover lights: pass through to light them, both lit pays a bonus
    { x: 88, y: 300, r: 15, lit: false },
    { x: 392, y: 300, r: 15, lit: false }
  ];
  var FLIP = { len: 82, rest: 0.52, active: -0.52 }; // radians from horizontal, left flipper
  var PIVOT_L = { x: 152, y: 600 }, PIVOT_R = { x: 328, y: 600 };
  var BUMPER_POINTS = 100, SLING_POINTS = 10, LANE_POINTS = 50, JACKPOT = 500;
  var RANKS = [[0, '🥚', 'First Flip'], [300, '🕹️', 'Flipper Rookie'], [800, '⚡', 'Bumper Basher'],
    [1500, '🔥', 'Table Wizard'], [2500, '🏆', 'Pinball Star'], [4000, '👑', 'Pinball Champion']];
  var best = +MG.store.get('best', 0) || 0;

  /* ---------- state ---------- */
  var state = 'idle', paused = false; // idle | serving | playing | done
  var ball = { x: W / 2, y: 520, vx: 0, vy: 0 };
  var score = 0, ballsLeft = BALLS, bumpersHit = 0, drains = 0;
  var flipL = { angle: FLIP.rest, target: FLIP.rest, held: false };
  var flipR = { angle: Math.PI - FLIP.rest, target: Math.PI - FLIP.rest, held: false };
  var lastTick = 0, bobT = 0, stillT = 0, flashT = 0;
  var trail = [], popups = [], sparks = [];
  var msg = '';

  /* ---------- DOM ---------- */
  function pill(label, el) { return h('span', { class: 'mg-pill' }, h('small', { text: label }), el); }
  var scoreEl = h('b', { text: '0' }), bestEl = h('b', { text: best ? best : '–' });
  var ballsEl = h('b', { text: '●●●' });
  var soundBtn = h('button', { class: 'mg-icon-btn', type: 'button' });
  var pauseBtn = h('button', { class: 'mg-icon-btn', type: 'button', 'aria-label': 'Pause the game' },
    h('span', { html: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1.2"/><rect x="14" y="5" width="4" height="14" rx="1.2"/></svg>' }));
  var canvas = h('canvas', { class: 'pb-canvas', role: 'img', 'aria-label': 'Pinball table' });
  var stage = h('div', { class: 'pb-stage' }, canvas);
  var overlay = h('div', { class: 'mg-overlay', hidden: true });
  var root = h('div', { class: 'mg-root pb' },
    h('div', { class: 'mg-hud' }, pill('Score', scoreEl), pill('Balls', ballsEl), pill('Best', bestEl),
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
    ballsEl.textContent = '●'.repeat(Math.max(0, ballsLeft)) + '○'.repeat(Math.max(0, BALLS - ballsLeft));
  }
  function flipTip(f, pivot) {
    return { x: pivot.x + Math.cos(f.angle) * FLIP.len, y: pivot.y + Math.sin(f.angle) * FLIP.len };
  }
  function flipVel(f, pivot, px, py) { // velocity of the flipper surface at a point (px,py)
    var angVel = f._av || 0;
    var dx = px - pivot.x, dy = py - pivot.y;
    return { x: -angVel * dy, y: angVel * dx };
  }
  function addScore(n, x, y) {
    score += n;
    popups.push({ text: '+' + n, x: x, y: y, t: 0 });
    renderHud();
  }
  function burst(x, y, color, n) {
    for (var i = 0; i < (n || 8); i++) {
      var a = Math.random() * 6.283, s = 60 + Math.random() * 160;
      sparks.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, color: color });
    }
  }
  function resetLights() {
    BUMPERS.forEach(function (b) { b.lit = false; });
    LANES.forEach(function (l) { l.lit = false; });
  }
  function serve() {
    ball.x = W / 2; ball.y = 520; ball.vx = 0; ball.vy = 0;
    trail = []; stillT = 0;
    resetLights();
    state = 'serving';
  }
  function reset() {
    score = 0; ballsLeft = BALLS; bumpersHit = 0; drains = 0; popups = []; sparks = [];
    flipL.held = false; flipR.held = false;
    flipL.target = FLIP.rest; flipR.target = Math.PI - FLIP.rest;
    serve();
    renderHud();
  }
  function start() {
    reset();
    state = 'serving'; paused = false; overlay.hidden = true;
    msg = 'Tap or press Space to launch!';
    MG.event('game_start');
  }
  function launch() {
    if (state !== 'serving' || paused) return;
    ball.vx = (Math.random() < 0.5 ? -1 : 1) * (40 + Math.random() * 60);
    ball.vy = -560; // a gentle first launch: straight up through the bumpers
    state = 'playing';
    msg = '';
    MG.sfx.tap();
  }
  function loseBall() {
    drains++;
    ballsLeft--;
    renderHud();
    MG.sfx.bad(); MG.vibrate(60);
    if (ballsLeft <= 0) finish();
    else serve();
  }
  function finish() {
    state = 'done';
    var prev = best, isBest = score > best;
    if (isBest) { best = score; MG.store.set('best', best); }
    renderHud();
    var r = rank(score);
    var again = h('button', { class: 'mg-btn', type: 'button', text: 'Play pinball again' });
    again.addEventListener('click', function () { MG.adBreak('next', 'pinball-again', start); });
    overlay.innerHTML = '';
    overlay.append(h('div', { class: 'mg-card pb-card', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Game over' },
      h('div', { class: 'pb-badge', 'aria-hidden': 'true', text: r[1] }),
      h('div', null, h('small', { class: 'mg-label', text: 'Your pinball rank' }), h('h2', { class: 'mg-title', text: r[2] })),
      h('div', { class: 'pb-score' }, h('span', { class: 'mg-big', text: score }), h('span', { text: bumpersHit + ' bumper hits · ' + drains + (drains === 1 ? ' ball' : ' balls') + ' drained' })),
      isBest && prev ? h('span', { class: 'mg-badge', text: 'New best!' }) : null,
      h('p', { class: 'mg-sub', text: (prev && !isBest ? 'Your best is ' + prev + '. ' : '') + 'Light all three bumpers in one ball for a ' + JACKPOT + '-point jackpot, and pass through both rollover lanes for a bonus.' }),
      h('div', { class: 'mg-row' }, again)));
    overlay.hidden = false;
    MG.focusSafe(again, 700);
    if (isBest && prev) { MG.confetti(120); MG.sfx.win(); }
    else if (score >= 800) MG.sfx.good(); else MG.sfx.lose();
    MG.event('game_over', { score: score });
  }

  /* ---------- collision helpers ---------- */
  function reflect(vx, vy, nx, ny, rest) { // reflect velocity about a unit normal
    var d = vx * nx + vy * ny;
    if (d >= 0) return { vx: vx, vy: vy };
    return { vx: vx - (1 + rest) * d * nx, vy: vy - (1 + rest) * d * ny };
  }
  function collideCircle(cx, cy, r, rest, kick) { // static circle (bumper): returns true on hit
    var dx = ball.x - cx, dy = ball.y - cy, d = Math.hypot(dx, dy), min = r + BALL_R;
    if (d >= min || d === 0) return false;
    var nx = dx / d, ny = dy / d;
    ball.x = cx + nx * min; ball.y = cy + ny * min;
    var v = reflect(ball.vx, ball.vy, nx, ny, rest);
    var sp = Math.hypot(v.vx, v.vy);
    var want = Math.max(sp, kick || 0);
    if (sp > 0) { v.vx *= want / sp; v.vy *= want / sp; }
    ball.vx = v.vx; ball.vy = v.vy;
    return true;
  }
  function collideSegment(x1, y1, x2, y2, rest, kickVx, kickVy) { // static segment: returns true on hit
    var dx = x2 - x1, dy = y2 - y1, len2 = dx * dx + dy * dy || 1;
    var t = Math.max(0, Math.min(1, ((ball.x - x1) * dx + (ball.y - y1) * dy) / len2));
    var px = x1 + dx * t, py = y1 + dy * t;
    var ox = ball.x - px, oy = ball.y - py, d = Math.hypot(ox, oy);
    if (d >= BALL_R || d === 0) return false;
    var nx = ox / d, ny = oy / d;
    ball.x = px + nx * BALL_R; ball.y = py + ny * BALL_R;
    var v = reflect(ball.vx, ball.vy, nx, ny, rest);
    ball.vx = v.vx + (kickVx || 0); ball.vy = v.vy + (kickVy || 0);
    return true;
  }
  function collideFlipper(f, pivot, mirror) { // moving flipper: uses surface velocity for the kick
    var tip = flipTip(f, pivot);
    var dx = tip.x - pivot.x, dy = tip.y - pivot.y, len2 = dx * dx + dy * dy || 1;
    var t = Math.max(0, Math.min(1, ((ball.x - pivot.x) * dx + (ball.y - pivot.y) * dy) / len2));
    var px = pivot.x + dx * t, py = pivot.y + dy * t;
    var ox = ball.x - px, oy = ball.y - py, d = Math.hypot(ox, oy);
    if (d >= BALL_R + 7 || d === 0) return false;
    var nx = ox / d, ny = oy / d;
    ball.x = px + nx * (BALL_R + 7); ball.y = py + ny * (BALL_R + 7);
    var fv = flipVel(f, pivot, px, py);
    var rvx = ball.vx - fv.x, rvy = ball.vy - fv.y;
    var dot = rvx * nx + rvy * ny;
    if (dot < 0) {
      var e = 0.35;
      ball.vx = rvx - (1 + e) * dot * nx + fv.x;
      ball.vy = rvy - (1 + e) * dot * ny + fv.y;
    }
    // a fast upward flip throws the ball; a resting flipper just holds it
    if (f.held) { ball.vy = Math.min(ball.vy, -60); }
    return true;
  }

  /* ---------- update ---------- */
  function step(dt) {
    // flippers swing toward their target; track angular velocity for the kick
    [flipL, flipR].forEach(function (f) {
      var prev = f.angle, speed = 16;
      var d = f.target - f.angle;
      f.angle += Math.max(-speed * dt, Math.min(speed * dt, d));
      f._av = (f.angle - prev) / Math.max(dt, 0.001);
    });
    if (state !== 'playing' || paused) return;
    ball.vy += GRAVITY * dt;
    var sp = Math.hypot(ball.vx, ball.vy);
    if (sp > MAX_SPEED) { ball.vx *= MAX_SPEED / sp; ball.vy *= MAX_SPEED / sp; }
    ball.x += ball.vx * dt; ball.y += ball.vy * dt;
    trail.push({ x: ball.x, y: ball.y }); if (trail.length > 8) trail.shift();

    // the round dome at the top of the table
    var dcx = ball.x - DOME.x, dcy = ball.y - DOME.y, dd = Math.hypot(dcx, dcy);
    if (ball.y < DOME.y + 4 && dd > DOME.r - BALL_R) {
      var nx = dcx / dd, ny = dcy / dd;
      ball.x = DOME.x + nx * (DOME.r - BALL_R); ball.y = DOME.y + ny * (DOME.r - BALL_R);
      var v = reflect(ball.vx, ball.vy, nx, ny, 0.75);
      ball.vx = v.vx; ball.vy = v.vy;
      MG.tone(300, 0.03, 'square', 0.02);
    }
    // side walls (below the dome)
    if (ball.y >= WALL_TOP - 2) {
      if (ball.x - BALL_R < WALL_L) { ball.x = WALL_L + BALL_R; ball.vx = Math.abs(ball.vx) * 0.8; MG.tone(300, 0.03, 'square', 0.02); }
      if (ball.x + BALL_R > WALL_R) { ball.x = WALL_R - BALL_R; ball.vx = -Math.abs(ball.vx) * 0.8; MG.tone(300, 0.03, 'square', 0.02); }
    }
    // sloped inlane guides above the flippers
    collideSegment(GUIDE_L.x1, GUIDE_L.y1, GUIDE_L.x2, GUIDE_L.y2, 0.7);
    collideSegment(GUIDE_R.x1, GUIDE_R.y1, GUIDE_R.x2, GUIDE_R.y2, 0.7);
    // slingshots: a hit kicks the ball away and scores
    SLINGS.forEach(function (s) {
      s.edges.forEach(function (e) {
        var a = s.pts[e[0]], b = s.pts[e[1]];
        if (collideSegment(a[0], a[1], b[0], b[1], 0.9, (a[0] < W / 2 ? -1 : 1) * 60, -60)) {
          addScore(SLING_POINTS, ball.x, ball.y - 14);
          burst(ball.x, ball.y, s.color, 5);
          MG.sfx.tap(); MG.vibrate(8);
        }
      });
    });
    // bumpers: a firm kick, points, and a light
    BUMPERS.forEach(function (b) {
      if (collideCircle(b.x, b.y, b.r, 0.9, 540)) {
        flashT = 0.12;
        addScore(BUMPER_POINTS, b.x, b.y - b.r - 8);
        bumpersHit++;
        burst(b.x, b.y, b.color, 10);
        MG.tone(520, 0.08, 'square', 0.06, 780); MG.vibrate(12);
        if (!b.lit) {
          b.lit = true;
          if (BUMPERS.every(function (x) { return x.lit; })) {
            addScore(JACKPOT, W / 2, 150);
            popups.push({ text: 'JACKPOT!', x: W / 2, y: 120, t: 0 });
            MG.confetti(60); MG.sfx.win();
            BUMPERS.forEach(function (x) { x.lit = false; });
          }
        }
      }
    });
    // rollover lanes
    LANES.forEach(function (l) {
      if (!l.lit && Math.hypot(ball.x - l.x, ball.y - l.y) < l.r + BALL_R) {
        l.lit = true;
        addScore(LANE_POINTS, l.x, l.y - 22);
        MG.sfx.good();
        if (LANES.every(function (x) { return x.lit; })) {
          addScore(250, W / 2, 180);
          popups.push({ text: 'LANES BONUS +250', x: W / 2, y: 150, t: 0 });
          MG.sfx.win();
          LANES.forEach(function (x) { x.lit = false; });
        }
      }
    });
    // flippers
    collideFlipper(flipL, PIVOT_L, false);
    collideFlipper(flipR, PIVOT_R, true);
    // a ball that barely moves for a while gets a gentle nudge, so it can never get stuck
    var spd = Math.hypot(ball.vx, ball.vy);
    if (spd < 25) { stillT += dt; if (stillT > 1.2) { ball.vx = (Math.random() < 0.5 ? -1 : 1) * 90; ball.vy = -140; stillT = 0; } }
    else stillT = 0;
    // drained: below the table
    if (ball.y - BALL_R > H + 10) loseBall();
  }
  function tick(now) {
    requestAnimationFrame(tick);
    var dt = Math.min(0.05, Math.max(0, (now - (lastTick || now)) / 1000));
    lastTick = now;
    if (state === 'idle' || state === 'serving') bobT += dt;
    if (flashT > 0) flashT -= dt;
    // physics in small substeps so a fast ball cannot tunnel through a flipper
    var sub = 3;
    for (var i = 0; i < sub; i++) step(dt / sub);
    for (var j = popups.length - 1; j >= 0; j--) { popups[j].t += dt; if (popups[j].t > 0.9) popups.splice(j, 1); }
    for (var k = sparks.length - 1; k >= 0; k--) {
      var s = sparks[k]; s.t += dt; s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 300 * dt;
      if (s.t > 0.5) sparks.splice(k, 1);
    }
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
  function drawFlipper(pivot, f, mirror) {
    var tip = flipTip(f, pivot);
    var ang = Math.atan2(tip.y - pivot.y, tip.x - pivot.x);
    ctx.save();
    ctx.translate(pivot.x, pivot.y);
    ctx.rotate(ang);
    var g = ctx.createLinearGradient(0, -10, 0, 10);
    g.addColorStop(0, '#FFE066'); g.addColorStop(0.5, '#FF9F1C'); g.addColorStop(1, '#E8481C');
    ctx.fillStyle = g;
    ctx.shadowColor = 'rgba(255,159,28,.85)'; ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(FLIP.len - 12, -9);
    ctx.arc(FLIP.len - 12, 0, 9, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(0, 9);
    ctx.arc(0, 0, 9, Math.PI / 2, Math.PI * 1.5);
    ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,.5)';
    ctx.fillRect(10, -6, FLIP.len - 26, 3);
    ctx.restore();
    ctx.fillStyle = '#3A2A7A';
    ctx.beginPath(); ctx.arc(pivot.x, pivot.y, 10, 0, 6.3); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.75)';
    ctx.beginPath(); ctx.arc(pivot.x - 2, pivot.y - 2, 3.5, 0, 6.3); ctx.fill();
  }
  function draw() {
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var bgFull = ctx.createLinearGradient(0, oy, 0, oy + ch);
    bgFull.addColorStop(0, '#160B33'); bgFull.addColorStop(0.6, '#2A1650'); bgFull.addColorStop(1, '#12082A');
    ctx.fillStyle = bgFull; ctx.fillRect(0, 0, cw, ch);
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * ox, dpr * oy);
    // table background
    var bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#241145'); bg.addColorStop(0.55, '#2A1650'); bg.addColorStop(1, '#160B33');
    ctx.fillStyle = bg; ctx.fillRect(-30, -30, W + 60, H + 60);
    ctx.fillStyle = 'rgba(255,255,255,.35)';
    [[60, 90], [140, 60], [240, 44], [340, 60], [420, 90], [90, 150], [390, 150], [60, 380], [420, 380]].forEach(function (p) {
      ctx.beginPath(); ctx.arc(p[0], p[1], 1.6, 0, 6.3); ctx.fill();
    });
    // table rails: dome + side walls + inlane guides
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#22D3EE'; ctx.lineWidth = 7;
    ctx.shadowColor = 'rgba(34,211,238,.9)'; ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.arc(DOME.x, DOME.y, DOME.r, Math.PI, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(WALL_L, WALL_TOP); ctx.lineTo(WALL_L, GUIDE_L.y1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(WALL_R, WALL_TOP); ctx.lineTo(WALL_R, GUIDE_R.y1); ctx.stroke();
    ctx.strokeStyle = '#FF6A3D';
    ctx.shadowColor = 'rgba(255,106,61,.9)';
    ctx.beginPath(); ctx.moveTo(GUIDE_L.x1, GUIDE_L.y1); ctx.lineTo(GUIDE_L.x2, GUIDE_L.y2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(GUIDE_R.x1, GUIDE_R.y1); ctx.lineTo(GUIDE_R.x2, GUIDE_R.y2); ctx.stroke();
    ctx.shadowBlur = 0;
    // title on the table
    ctx.font = '900 30px Poppins, "DejaVu Sans", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.lineWidth = 7; ctx.strokeStyle = 'rgba(0,0,0,.4)';
    ctx.strokeText('PINBALL', W / 2, 58);
    ctx.fillStyle = 'rgba(255,255,255,.28)';
    ctx.fillText('PINBALL', W / 2, 58);
    // rollover lanes
    LANES.forEach(function (l) {
      ctx.beginPath(); ctx.arc(l.x, l.y, l.r, 0, 6.3);
      ctx.fillStyle = l.lit ? '#FFE066' : 'rgba(255,255,255,.10)';
      ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = l.lit ? '#FFC22E' : 'rgba(255,255,255,.35)';
      ctx.stroke();
      if (l.lit) { ctx.shadowColor = 'rgba(255,224,102,.9)'; ctx.shadowBlur = 16; ctx.fill(); ctx.shadowBlur = 0; }
      ctx.font = '900 15px Poppins, "DejaVu Sans", sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = l.lit ? '#7A4A00' : 'rgba(255,255,255,.5)';
      ctx.fillText('★', l.x, l.y + 1);
    });
    // slingshots
    SLINGS.forEach(function (s) {
      ctx.beginPath();
      ctx.moveTo(s.pts[0][0], s.pts[0][1]);
      ctx.lineTo(s.pts[1][0], s.pts[1][1]);
      ctx.lineTo(s.pts[2][0], s.pts[2][1]);
      ctx.closePath();
      var g = ctx.createLinearGradient(0, 430, 0, 545);
      g.addColorStop(0, '#FF8A4D'); g.addColorStop(1, '#E8481C');
      ctx.fillStyle = g; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      ctx.font = '900 13px Poppins, "DejaVu Sans", sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      var cx = (s.pts[0][0] + s.pts[1][0] + s.pts[2][0]) / 3, cy = (s.pts[0][1] + s.pts[1][1] + s.pts[2][1]) / 3;
      ctx.fillText('10', cx, cy);
    });
    // bumpers
    BUMPERS.forEach(function (b) {
      var glow = b.lit || flashT > 0;
      ctx.save();
      if (glow) { ctx.shadowColor = b.color; ctx.shadowBlur = 26; }
      var g = ctx.createRadialGradient(b.x - 7, b.y - 8, 2, b.x, b.y, b.r + 2);
      g.addColorStop(0, '#FFFFFF'); g.addColorStop(0.35, b.color); g.addColorStop(1, '#3A1D5E');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 6.3); ctx.fill();
      ctx.restore();
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255,255,255,.55)';
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r - 4, 0, 6.3); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.9)';
      ctx.font = '900 13px Poppins, "DejaVu Sans", sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('100', b.x, b.y + 1);
      if (b.lit) {
        ctx.fillStyle = '#FFE066';
        ctx.font = '900 15px Poppins, "DejaVu Sans", sans-serif';
        ctx.fillText('★', b.x, b.y - b.r - 14);
      }
    });
    // flippers
    drawFlipper(PIVOT_L, flipL, false);
    drawFlipper(PIVOT_R, flipR, true);
    // ball trail + ball
    trail.forEach(function (t, i) {
      ctx.globalAlpha = (i + 1) / trail.length * 0.22;
      ctx.fillStyle = '#FFE066';
      ctx.beginPath(); ctx.arc(t.x, t.y, BALL_R * (0.4 + 0.6 * i / trail.length), 0, 6.3); ctx.fill();
    });
    ctx.globalAlpha = 1;
    var bgr = ctx.createRadialGradient(ball.x - 3, ball.y - 3, 1, ball.x, ball.y, BALL_R + 2);
    bgr.addColorStop(0, '#FFFFFF'); bgr.addColorStop(0.55, '#E8E8F0'); bgr.addColorStop(1, '#8A8AA8');
    ctx.fillStyle = bgr;
    ctx.shadowColor = 'rgba(255,255,255,.7)'; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.arc(ball.x, ball.y, BALL_R, 0, 6.3); ctx.fill();
    ctx.shadowBlur = 0;
    // sparks
    sparks.forEach(function (s) {
      ctx.globalAlpha = Math.max(0, 1 - s.t / 0.5);
      ctx.fillStyle = s.color;
      ctx.beginPath(); ctx.arc(s.x, s.y, 3, 0, 6.3); ctx.fill();
    });
    ctx.globalAlpha = 1;
    // big score while playing
    if (state === 'playing' || state === 'serving') {
      ctx.font = '900 44px Poppins, "DejaVu Sans", sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.lineWidth = 7; ctx.strokeStyle = 'rgba(0,0,0,.35)';
      ctx.strokeText(String(score), W / 2, H * 0.52);
      ctx.fillStyle = 'rgba(255,255,255,.92)';
      ctx.fillText(String(score), W / 2, H * 0.52);
    }
    // popups
    popups.forEach(function (p) {
      var a = 1 - p.t / 0.9;
      ctx.globalAlpha = a;
      ctx.font = '900 20px Poppins, "DejaVu Sans", sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,.4)';
      var py = p.y - p.t * 44;
      ctx.strokeText(p.text, p.x, py);
      ctx.fillStyle = '#FFC22E';
      ctx.fillText(p.text, p.x, py);
      ctx.globalAlpha = 1;
    });
    if (state === 'idle' || state === 'serving') {
      ctx.font = '900 22px Poppins, "DejaVu Sans", sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      var pulse = 0.65 + Math.sin(bobT * 4) * 0.35;
      ctx.globalAlpha = pulse;
      ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,.4)';
      var hint = state === 'idle' ? 'Flip the flippers, keep the ball alive!' : 'Tap or press Space to launch!';
      ctx.strokeText(hint, W / 2, H * 0.66);
      ctx.fillStyle = '#fff';
      ctx.fillText(hint, W / 2, H * 0.66);
      ctx.globalAlpha = 1;
    }
  }

  /* ---------- input ---------- */
  function pressFlipper(side, down) {
    if (side === 'L') { flipL.held = down; flipL.target = down ? FLIP.active : FLIP.rest; }
    else { flipR.held = down; flipR.target = down ? Math.PI - FLIP.active : Math.PI - FLIP.rest; }
    if (down) MG.sfx.tap();
  }
  function canvasSide(e) {
    var r = canvas.getBoundingClientRect();
    return (e.clientX - r.left) / r.width < 0.5 ? 'L' : 'R';
  }
  canvas.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    if (state === 'idle') { start(); return; }
    if (state === 'serving') { launch(); return; }
    pressFlipper(canvasSide(e), true);
  });
  canvas.addEventListener('pointerup', function (e) { pressFlipper(canvasSide(e), false); });
  canvas.addEventListener('pointercancel', function () { pressFlipper('L', false); pressFlipper('R', false); });
  canvas.addEventListener('pointerleave', function () { pressFlipper('L', false); pressFlipper('R', false); });
  document.addEventListener('keydown', function (e) {
    if (e.repeat) return;
    if (e.code === 'ArrowLeft' || e.code === 'KeyZ') {
      e.preventDefault();
      if (state === 'idle') start(); else if (state === 'serving') launch(); else pressFlipper('L', true);
    } else if (e.code === 'ArrowRight' || e.code === 'Slash') {
      e.preventDefault();
      if (state === 'idle') start(); else if (state === 'serving') launch(); else pressFlipper('R', true);
    } else if (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowUp') {
      e.preventDefault();
      if (state === 'idle') start();
      else if (state === 'serving') launch();
    }
  });
  document.addEventListener('keyup', function (e) {
    if (e.code === 'ArrowLeft' || e.code === 'KeyZ') pressFlipper('L', false);
    else if (e.code === 'ArrowRight' || e.code === 'Slash') pressFlipper('R', false);
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
      h('p', { class: 'mg-sub', text: 'The ball is frozen mid-table. The bumpers are waiting.' }),
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
    var play = h('button', { class: 'mg-btn', type: 'button', text: 'Start playing' });
    play.addEventListener('click', start);
    overlay.innerHTML = '';
    overlay.append(h('div', { class: 'mg-card', role: 'dialog', 'aria-label': 'Pinball' },
      h('div', { class: 'pb-badge', 'aria-hidden': 'true', text: '🕹️' }),
      h('h2', { class: 'mg-title', text: 'Pinball' }),
      h('p', { class: 'mg-sub', text: 'The classic arcade table: flip the flippers, bounce the ball off the bumpers, and do not let it drain. You have three balls — light all three bumpers for a ' + JACKPOT + '-point jackpot.' + (best ? ' Your best is ' + best + ' points.' : '') }),
      play));
    overlay.hidden = false;
  }

  /* ---------- start ---------- */
  renderSound(); reset(); showStart();
  resize();
  requestAnimationFrame(tick);
  if (o.showcase) { // still frame: ball bouncing off a lit bumper, score 250
    overlay.hidden = true;
    state = 'playing'; paused = true; // frozen frame
    score = 250; best = Math.max(best, 420); ballsLeft = 3;
    ball.x = 196; ball.y = 268; ball.vx = 180; ball.vy = -260;
    trail = [{ x: 210, y: 300 }, { x: 222, y: 330 }, { x: 232, y: 358 }];
    BUMPERS[0].lit = true; BUMPERS[2].lit = true;
    LANES[0].lit = true;
    flipL.angle = FLIP.active; flipR.angle = Math.PI - FLIP.rest;
    root.classList.add('is-showcase');
    renderHud(); draw();
    setTimeout(function () { document.documentElement.setAttribute('data-ready', '1'); }, 80);
  }
  MG.ready();
})();
