/* Dino Runner engine: the endless runner classic. A little dino sprints across the
 * desert — tap or press Space to jump the cacti, duck under the pterodactyls.
 * It starts slow and speeds up as the distance grows.
 * Canvas game on a fixed logical world (480 x 640) scaled to fit the stage.
 * Options: { showcase: true } still frame for cover art. */
(function () {
  'use strict';
  var MG = window.MG, h = MG.h, o = window.GAME_OPTIONS || {};
  var SHOWCASE = !!o.showcase;

  /* logical world */
  var W = 480, H = 640;
  var GY = 500; // ground line
  var DINO_X = 70;
  var GRAV = 2600, JUMP_V = -880;
  var BASE_SPEED = 260, MAX_SPEED = 640;
  var RANKS = [[0, '🦕', 'Hatchling'], [100, '🌵', 'Cactus Dodger'], [300, '🏃', 'Speedy Runner'],
    [600, '💨', 'Desert Dasher'], [1000, '🏆', 'Dino Champion'], [1500, '👑', 'T-Rex Legend']];
  var best = +MG.store.get('best', 0) || 0;

  /* ---------- state ---------- */
  var state = 'idle', paused = false; // idle | playing | done
  var dino = { y: 0, vy: 0, duck: false, onGround: true }; // y = height above ground
  var speed = BASE_SPEED, dist = 0, score = 0, nextMilestone = 100;
  var obstacles = []; // { kind: 'cactus'|'bird', x, w, h, y, flap }
  var spawnIn = 500; // px until next obstacle
  var clouds = [], hills = [], groundOff = 0, legPhase = 0;
  var popups = [];
  var lastTick = 0;

  /* ---------- DOM ---------- */
  function pill(label, el) { return h('span', { class: 'mg-pill' }, h('small', { text: label }), el); }
  var scoreEl = h('b', { text: '0' }), bestEl = h('b', { text: best ? best : '–' });
  var speedEl = h('b', { text: '1.0×' });
  var soundBtn = h('button', { class: 'mg-icon-btn', type: 'button' });
  var pauseBtn = h('button', { class: 'mg-icon-btn', type: 'button', 'aria-label': 'Pause the game' },
    h('span', { html: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1.2"/><rect x="14" y="5" width="4" height="14" rx="1.2"/></svg>' }));
  var canvas = h('canvas', { class: 'dn-canvas', role: 'img', 'aria-label': 'Dino Runner game' });
  var jumpBtn = h('button', { class: 'dn-btn is-jump', type: 'button', 'aria-label': 'Jump' }, h('span', { 'aria-hidden': 'true', text: 'JUMP' }));
  var duckBtn = h('button', { class: 'dn-btn is-duck', type: 'button', 'aria-label': 'Duck' }, h('span', { 'aria-hidden': 'true', text: 'DUCK' }));
  jumpBtn.addEventListener('pointerdown', function (e) { e.preventDefault(); jump(); });
  duckBtn.addEventListener('pointerdown', function (e) { e.preventDefault(); dino.duck = true; });
  duckBtn.addEventListener('pointerup', function () { dino.duck = false; });
  duckBtn.addEventListener('pointercancel', function () { dino.duck = false; });
  duckBtn.addEventListener('pointerleave', function () { dino.duck = false; });
  canvas.addEventListener('pointerdown', function (e) { if (state === 'playing' && !paused) { e.preventDefault(); jump(); } });
  var controls = h('div', { class: 'dn-controls' }, duckBtn, jumpBtn);
  var stage = h('div', { class: 'dn-stage' }, canvas);
  var overlay = h('div', { class: 'mg-overlay', hidden: true });
  var root = h('div', { class: 'mg-root dn' },
    h('div', { class: 'mg-hud' }, pill('Score', scoreEl), pill('Speed', speedEl), pill('Best', bestEl),
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
    speedEl.textContent = (speed / BASE_SPEED).toFixed(1) + '×';
  }
  function dinoH() { return dino.duck ? 30 : 56; }
  function dinoW() { return dino.duck ? 76 : 60; }
  function jump() {
    if (state !== 'playing' || paused) return;
    if (!dino.onGround) return;
    dino.vy = JUMP_V; dino.onGround = false; dino.duck = false;
    MG.sfx.tap();
  }
  function spawnObstacle() {
    var roll = Math.random();
    if (roll < 0.62) {
      var w = 22 + Math.random() * 26, n = Math.random() < 0.3 ? 2 : 1;
      obstacles.push({ kind: 'cactus', x: W + 20, w: w * n + (n > 1 ? 14 : 0), h: 44 + Math.random() * 22, y: 0, flap: 0 });
    } else {
      var high = Math.random() < 0.5;
      obstacles.push({ kind: 'bird', x: W + 20, w: 52, h: 26, y: high ? 96 : 34, flap: Math.random() * 6 });
    }
    spawnIn = 430 + Math.random() * 320;
  }
  function reset() {
    dino = { y: 0, vy: 0, duck: false, onGround: true };
    speed = BASE_SPEED; dist = 0; score = 0; nextMilestone = 100;
    obstacles = []; spawnIn = 420; groundOff = 0; legPhase = 0; popups = [];
    clouds = [];
    for (var i = 0; i < 5; i++) clouds.push({ x: Math.random() * W, y: 40 + Math.random() * 130, s: 0.6 + Math.random() * 0.8 });
    hills = [];
    for (var j = 0; j < 3; j++) hills.push({ x: j * 200 + Math.random() * 60, w: 180 + Math.random() * 120, h: 46 + Math.random() * 40 });
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
    var again = h('button', { class: 'mg-btn', type: 'button', text: 'Run again' });
    again.addEventListener('click', function () { MG.adBreak('next', 'dino-again', start); });
    overlay.innerHTML = '';
    overlay.append(h('div', { class: 'mg-card dn-card', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Your result' },
      h('div', { class: 'dn-badge', 'aria-hidden': 'true', text: r[1] }),
      h('div', null, h('small', { class: 'mg-label', text: 'Your dino badge' }), h('h2', { class: 'mg-title', text: r[2] })),
      h('div', { class: 'dn-score' }, h('span', { class: 'mg-big', text: score }), h('span', { text: 'points · reached ' + (speed / BASE_SPEED).toFixed(1) + '× speed' })),
      isBest && prev ? h('span', { class: 'mg-badge', text: 'New best!' }) : null,
      h('p', { class: 'mg-sub', text: 'Your dino ran ' + Math.round(dist) + ' metres before tripping.' + (prev && !isBest ? ' Your best is ' + prev + '.' : '') }),
      h('div', { class: 'mg-row' }, again)));
    overlay.hidden = false;
    MG.focusSafe(again, 700);
    if (isBest && prev) { MG.confetti(120); MG.sfx.win(); } else if (score >= 300) MG.sfx.good(); else MG.sfx.draw();
    MG.event('game_over', { score: score });
  }
  function collide(ob) {
    // forgiving hitboxes: shrink both boxes a little
    var dx = DINO_X + 6, dw = dinoW() - 12, dh = dinoH() - 4;
    var dy = GY - dino.y - dh;
    var ox2 = ob.x + 5, ow = ob.w - 10;
    var oy2, oh;
    if (ob.kind === 'cactus') { oy2 = GY - ob.h + 4; oh = ob.h - 6; }
    else { oy2 = GY - ob.y - ob.h + 3; oh = ob.h - 6; }
    return dx < ox2 + ow && dx + dw > ox2 && dy < oy2 + oh && dy + dh > oy2;
  }

  /* ---------- input ---------- */
  document.addEventListener('keydown', function (e) {
    if (state !== 'playing' || paused) return;
    if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') { e.preventDefault(); jump(); }
    else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') { e.preventDefault(); dino.duck = true; }
  });
  document.addEventListener('keyup', function (e) {
    if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') dino.duck = false;
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
      h('p', { class: 'mg-sub', text: 'The dino is catching its breath. The desert will wait.' }),
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
    var play = h('button', { class: 'mg-btn', type: 'button', text: 'Start running' });
    play.addEventListener('click', start);
    overlay.innerHTML = '';
    overlay.append(h('div', { class: 'mg-card', role: 'dialog', 'aria-label': 'Dino Runner' },
      h('div', { class: 'dn-badge', 'aria-hidden': 'true', text: '🦕' }),
      h('h2', { class: 'mg-title', text: 'Dino Runner' }),
      h('p', { class: 'mg-sub', text: 'The desert never ends and the dino never stops. Tap or press Space to jump the cacti, hold Down to duck under the pterodactyls, and see how far you get before you trip.' + (best ? ' Your best is ' + best + ' points.' : '') }),
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
  function drawDino() {
    var x = DINO_X, yTop = GY - dino.y - dinoH();
    var duck = dino.duck && dino.onGround;
    var lp = Math.sin(legPhase) * (dino.onGround ? 1 : 0);
    ctx.save();
    ctx.translate(x, yTop);
    // tail
    ctx.fillStyle = '#2F9E44';
    ctx.beginPath();
    ctx.moveTo(2, duck ? 22 : 26); ctx.lineTo(-30, duck ? 10 : 6); ctx.lineTo(4, duck ? 12 : 12);
    ctx.closePath(); ctx.fill();
    // legs
    ctx.fillStyle = '#1E7A34';
    if (dino.onGround && !duck) {
      ctx.fillRect(14, dinoH() - 14 + Math.max(0, lp) * 6, 9, 14 - Math.max(0, lp) * 6);
      ctx.fillRect(34, dinoH() - 14 + Math.max(0, -lp) * 6, 9, 14 - Math.max(0, -lp) * 6);
    } else if (!dino.onGround) {
      ctx.fillRect(14, dinoH() - 10, 9, 10);
      ctx.fillRect(36, dinoH() - 12, 9, 12);
    }
    // body
    ctx.fillStyle = '#37B24D';
    ctx.beginPath(); ctx.roundRect(0, duck ? 6 : 8, 60, duck ? 24 : 34, 12); ctx.fill();
    // belly
    ctx.fillStyle = '#8CE99A';
    ctx.beginPath(); ctx.roundRect(8, duck ? 20 : 28, 34, 12, 6); ctx.fill();
    // neck + head
    ctx.fillStyle = '#37B24D';
    if (duck) {
      ctx.beginPath(); ctx.roundRect(44, 2, 34, 20, 9); ctx.fill();
      ctx.beginPath(); ctx.arc(72, 12, 4, 0, 6.2832); ctx.fill();
    } else {
      ctx.beginPath(); ctx.roundRect(38, -22, 16, 34, 7); ctx.fill();
      ctx.beginPath(); ctx.roundRect(38, -24, 34, 22, 10); ctx.fill();
      // snout + smile
      ctx.strokeStyle = '#1E7A34'; ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(58, -8); ctx.quadraticCurveTo(64, -4, 58, -2); ctx.stroke();
    }
    // eye
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(duck ? 66 : 60, duck ? 8 : -16, 5, 0, 6.2832); ctx.fill();
    ctx.fillStyle = '#171A2B';
    ctx.beginPath(); ctx.arc(duck ? 68 : 62, duck ? 8 : -16, 2.5, 0, 6.2832); ctx.fill();
    // spikes
    ctx.fillStyle = '#2F9E44';
    for (var i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(10 + i * 14, duck ? 8 : 10); ctx.lineTo(15 + i * 14, duck ? 0 : 2); ctx.lineTo(20 + i * 14, duck ? 8 : 10);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  function drawCactus(ob) {
    var x = ob.x, base = GY;
    ctx.save();
    ctx.fillStyle = '#2F9E44';
    ctx.strokeStyle = '#1E7A34'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(x + ob.w / 2 - 8, base - ob.h, 16, ob.h, 7); ctx.fill(); ctx.stroke();
    // arms
    ctx.beginPath(); ctx.roundRect(x + 2, base - ob.h + 12, 10, 22, 5); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.roundRect(x + 2, base - ob.h + 12, 22, 10, 5); ctx.fill(); ctx.stroke();
    if (ob.w > 44) {
      ctx.beginPath(); ctx.roundRect(x + ob.w - 12, base - ob.h + 20, 10, 22, 5); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.roundRect(x + ob.w - 30, base - ob.h + 20, 22, 10, 5); ctx.fill(); ctx.stroke();
    }
    // spikes
    ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x + ob.w / 2 - 4, base - ob.h + 8); ctx.lineTo(x + ob.w / 2 - 4, base - 8); ctx.stroke();
    ctx.restore();
  }
  function drawBird(ob) {
    var x = ob.x, y = GY - ob.y - ob.h;
    var flap = Math.sin(ob.flap * 6) * 10;
    ctx.save();
    ctx.translate(x, y);
    // wings
    ctx.fillStyle = '#8B5CF6';
    ctx.beginPath(); ctx.moveTo(10, 14); ctx.quadraticCurveTo(22, 2 - flap, 34, 12); ctx.quadraticCurveTo(22, 16, 10, 14); ctx.fill();
    ctx.beginPath(); ctx.moveTo(18, 16); ctx.quadraticCurveTo(30, 30 + flap, 42, 18); ctx.quadraticCurveTo(30, 20, 18, 16); ctx.fill();
    // body
    ctx.fillStyle = '#7C3AED';
    ctx.beginPath(); ctx.ellipse(26, 14, 24, 10, 0, 0, 6.2832); ctx.fill();
    // head + beak
    ctx.beginPath(); ctx.arc(48, 10, 8, 0, 6.2832); ctx.fill();
    ctx.fillStyle = '#F59E0B';
    ctx.beginPath(); ctx.moveTo(55, 8); ctx.lineTo(64, 11); ctx.lineTo(55, 14); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(49, 8, 2.5, 0, 6.2832); ctx.fill();
    ctx.fillStyle = '#171A2B';
    ctx.beginPath(); ctx.arc(50, 8, 1.2, 0, 6.2832); ctx.fill();
    ctx.restore();
  }
  function draw() {
    if (!ctx) return;
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    var bg = ctx.createLinearGradient(0, 0, 0, ch);
    bg.addColorStop(0, '#7DD3FC'); bg.addColorStop(0.55, '#BAE6FD'); bg.addColorStop(0.78, '#FEF3C7'); bg.addColorStop(1, '#FDE68A');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, cw, ch);
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * ox, dpr * oy);
    // sun
    ctx.fillStyle = '#FDE047';
    ctx.beginPath(); ctx.arc(408, 84, 34, 0, 6.2832); ctx.fill();
    ctx.fillStyle = 'rgba(253,224,71,.35)';
    ctx.beginPath(); ctx.arc(408, 84, 48, 0, 6.2832); ctx.fill();
    // clouds
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    clouds.forEach(function (cl) {
      ctx.beginPath(); ctx.ellipse(cl.x, cl.y, 34 * cl.s, 12 * cl.s, 0, 0, 6.2832); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cl.x + 22 * cl.s, cl.y + 4, 22 * cl.s, 9 * cl.s, 0, 0, 6.2832); ctx.fill();
    });
    // hills
    ctx.fillStyle = '#FCD34D';
    hills.forEach(function (hl) {
      ctx.beginPath(); ctx.ellipse(hl.x + hl.w / 2, GY, hl.w / 2, hl.h, 0, Math.PI, 0); ctx.fill();
    });
    // ground
    ctx.fillStyle = '#F59E0B';
    ctx.fillRect(0, GY, W, H - GY);
    ctx.fillStyle = '#D97706';
    ctx.fillRect(0, GY, W, 6);
    ctx.fillStyle = '#B45309';
    for (var gx = -((groundOff % 48) + 48) % 48; gx < W; gx += 48) ctx.fillRect(gx, GY + 34, 26, 4);
    for (var px = -((groundOff % 90) + 90) % 90; px < W; px += 90) {
      ctx.beginPath(); ctx.arc(px + 30, GY + 86, 3, 0, 6.2832); ctx.fill();
    }
    // obstacles
    obstacles.forEach(function (ob) { if (ob.kind === 'cactus') drawCactus(ob); else drawBird(ob); });
    // dino (standing on the ground even before you start)
    drawDino();
    // popups
    ctx.save();
    ctx.textAlign = 'center'; ctx.font = '900 24px Poppins, sans-serif';
    popups.forEach(function (p) {
      ctx.globalAlpha = Math.max(0, 1 - p.t / 1.1);
      ctx.fillStyle = '#92400E';
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
      // physics
      if (!dino.onGround) {
        dino.vy += GRAV * dt;
        dino.y -= dino.vy * dt;
        if (dino.y <= 0) { dino.y = 0; dino.vy = 0; dino.onGround = true; }
      }
      speed = Math.min(MAX_SPEED, BASE_SPEED + score * 0.55);
      var step = speed * dt;
      dist += step / 10;
      score = Math.floor(dist);
      groundOff += step;
      legPhase += dt * speed * 0.055;
      clouds.forEach(function (cl) { cl.x -= step * 0.12; if (cl.x < -60) { cl.x = W + 50; cl.y = 40 + Math.random() * 130; } });
      hills.forEach(function (hl) { hl.x -= step * 0.3; if (hl.x + hl.w < 0) { hl.x = W + 40; hl.w = 180 + Math.random() * 120; hl.h = 46 + Math.random() * 40; } });
      spawnIn -= step;
      if (spawnIn <= 0) spawnObstacle();
      obstacles.forEach(function (ob) { ob.x -= step; ob.flap += dt; });
      obstacles = obstacles.filter(function (ob) { return ob.x + ob.w > -20; });
      for (var i = 0; i < obstacles.length; i++) {
        if (collide(obstacles[i])) { finish(); break; }
      }
      if (score >= nextMilestone) {
        popups.push({ text: nextMilestone + ' points!', x: W / 2, y: 200, t: 0 });
        MG.sfx.bonus();
        nextMilestone += 100;
      }
      popups.forEach(function (p) { p.t += dt; });
      popups = popups.filter(function (p) { return p.t < 1.1; });
      renderHud();
    }
    draw();
  }

  /* ---------- start ---------- */
  renderSound(); renderHud(); reset();
  showStart();
  requestAnimationFrame(tick);
  if (SHOWCASE) { // still frame: dino mid-jump over cacti, a bird above, score 320
    overlay.hidden = true; state = 'playing';
    score = 320; dist = 320; speed = 430;
    dino = { y: 92, vy: -260, duck: false, onGround: false };
    obstacles = [
      { kind: 'cactus', x: 250, w: 30, h: 52, y: 0, flap: 0 },
      { kind: 'cactus', x: 292, w: 44, h: 62, y: 0, flap: 0 },
      { kind: 'bird', x: 380, w: 52, h: 26, y: 96, flap: 1.2 }
    ];
    root.classList.add('is-showcase');
    renderHud();
    setTimeout(function () { document.documentElement.setAttribute('data-ready', '1'); }, 80);
  }
  MG.ready();
})();
