/* Breakout engine: steer the paddle, bounce the ball, smash every brick.
 * The ball launches from the paddle; clear all bricks to reach the next level.
 * Canvas game on a fixed logical world (480 x 640) scaled to fit the stage.
 * Options: { showcase: true } still frame for cover art. */
(function () {
  'use strict';
  var MG = window.MG, h = MG.h, o = window.GAME_OPTIONS || {};

  /* logical world */
  var W = 480, H = 640;
  var PADDLE_W = 110, PADDLE_H = 14, PADDLE_Y = H - 56;
  var BALL_R = 8;
  var ROWS = 5, COLS = 8, BRICK_GAP = 6, BRICK_H = 26, BRICK_TOP = 92;
  var BASE_SPEED = 265, SPEED_PER_LEVEL = 30, MAX_SPEED = 480;
  var LIVES = 3;
  var ROW_COLORS = ['#E8481C', '#FF9F1C', '#FFD93D', '#6BCB3D', '#4EC0CA'];
  var ROW_POINTS = [50, 40, 30, 20, 10];
  var RANKS = [[0, '🥚', 'First Bounce'], [100, '🧱', 'Brick Breaker'], [300, '🔥', 'Smash Specialist'],
    [600, '🏆', 'Breakout Star'], [1000, '💎', 'Brick Master'], [1500, '👑', 'Breakout Champion']];
  var best = +MG.store.get('best', 0) || 0;

  /* ---------- state ---------- */
  var state = 'idle', paused = false; // idle | serving | playing | done
  var paddleX = (W - PADDLE_W) / 2, paddleTarget = paddleX;
  var ball = { x: W / 2, y: PADDLE_Y - BALL_R - 1, vx: 0, vy: 0 };
  var bricks = []; // {x, y, w, row, alive}
  var score = 0, level = 1, lives = LIVES, smashed = 0;
  var bobT = 0, lastTick = 0, trail = [];
  var popups = []; // {text, x, y, t}

  /* ---------- DOM ---------- */
  function pill(label, el) { return h('span', { class: 'mg-pill' }, h('small', { text: label }), el); }
  var scoreEl = h('b', { text: '0' }), bestEl = h('b', { text: best ? best : '–' });
  var livesEl = h('b', { text: '●●●' });
  var soundBtn = h('button', { class: 'mg-icon-btn', type: 'button' });
  var pauseBtn = h('button', { class: 'mg-icon-btn', type: 'button', 'aria-label': 'Pause the game' },
    h('span', { html: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1.2"/><rect x="14" y="5" width="4" height="14" rx="1.2"/></svg>' }));
  var canvas = h('canvas', { class: 'bo-canvas', role: 'img', 'aria-label': 'Breakout game board' });
  var stage = h('div', { class: 'bo-stage' }, canvas);
  var overlay = h('div', { class: 'mg-overlay', hidden: true });
  var root = h('div', { class: 'mg-root bo' },
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
  function speed() { return Math.min(MAX_SPEED, BASE_SPEED + SPEED_PER_LEVEL * (level - 1)); }
  function renderHud() {
    scoreEl.textContent = score;
    bestEl.textContent = Math.max(best, score) || '–';
    livesEl.textContent = '●'.repeat(Math.max(0, lives)) + '○'.repeat(Math.max(0, LIVES - lives));
  }
  function buildBricks() {
    bricks = [];
    var bw = (W - 24 - BRICK_GAP * (COLS - 1)) / COLS;
    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        bricks.push({ x: 12 + c * (bw + BRICK_GAP), y: BRICK_TOP + r * (BRICK_H + BRICK_GAP), w: bw, row: r, alive: true });
      }
    }
  }
  function serve() {
    ball.x = paddleX + PADDLE_W / 2; ball.y = PADDLE_Y - BALL_R - 1;
    ball.vx = 0; ball.vy = 0; trail = [];
    state = 'serving';
  }
  function reset() {
    score = 0; level = 1; lives = LIVES; smashed = 0; popups = [];
    paddleX = (W - PADDLE_W) / 2; paddleTarget = paddleX;
    buildBricks();
    serve();
    renderHud();
  }
  function start() {
    reset();
    state = 'serving'; paused = false; overlay.hidden = true;
    MG.event('game_start');
  }
  function launch() {
    if (state !== 'serving' || paused) return;
    var s = speed();
    var a = (Math.random() * 0.5 + 0.25) * Math.PI; // 45..135 degrees up
    ball.vx = Math.cos(a) * s * (Math.random() < 0.5 ? -1 : 1);
    ball.vy = -Math.sin(a) * s;
    state = 'playing';
    MG.sfx.tap();
  }
  function nextLevel() {
    level++;
    buildBricks();
    serve();
    popups.push({ text: 'Level ' + level + '!', x: W / 2, y: H * 0.45, t: 0 });
    MG.sfx.win();
  }
  function loseLife() {
    lives--;
    renderHud();
    MG.sfx.bad(); MG.vibrate(60);
    if (lives <= 0) finish();
    else serve();
  }
  function finish() {
    state = 'done';
    var prev = best, isBest = score > best;
    if (isBest) { best = score; MG.store.set('best', best); }
    renderHud();
    var r = rank(score);
    var again = h('button', { class: 'mg-btn', type: 'button', text: 'Break out again' });
    again.addEventListener('click', function () { MG.adBreak('next', 'breakout-again', start); });
    overlay.innerHTML = '';
    overlay.append(h('div', { class: 'mg-card bo-card', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Game over' },
      h('div', { class: 'bo-badge', 'aria-hidden': 'true', text: r[1] }),
      h('div', null, h('small', { class: 'mg-label', text: 'Your breaker rank' }), h('h2', { class: 'mg-title', text: r[2] })),
      h('div', { class: 'bo-score' }, h('span', { class: 'mg-big', text: score }), h('span', { text: 'points · ' + smashed + ' bricks smashed · level ' + level })),
      isBest && prev ? h('span', { class: 'mg-badge', text: 'New best!' }) : null,
      h('p', { class: 'mg-sub', text: (prev && !isBest ? 'Your best is ' + prev + '. ' : '') + 'Clear every brick to reach the next level — the ball only gets faster.' }),
      h('div', { class: 'mg-row' }, again)));
    overlay.hidden = false;
    MG.focusSafe(again, 700);
    if (isBest && prev) { MG.confetti(120); MG.sfx.win(); }
    else if (score >= 300) MG.sfx.good(); else MG.sfx.lose();
    MG.event('game_over', { score: score });
  }

  /* ---------- update ---------- */
  function tick(now) {
    requestAnimationFrame(tick);
    var dt = Math.min(0.05, Math.max(0, (now - (lastTick || now)) / 1000));
    lastTick = now;
    if (state === 'idle' || state === 'serving') { bobT += dt; }
    // paddle eases toward its target (mouse, touch or keys)
    var prevX = paddleX;
    paddleX += (paddleTarget - paddleX) * Math.min(1, dt * 18);
    if (Math.abs(paddleTarget - paddleX) < 0.5) paddleX = paddleTarget;
    paddleX = Math.max(0, Math.min(W - PADDLE_W, paddleX));
    if (state === 'serving') {
      ball.x = paddleX + PADDLE_W / 2; ball.y = PADDLE_Y - BALL_R - 1;
    } else if (state === 'playing' && !paused) {
      var s = speed(), cur = Math.hypot(ball.vx, ball.vy) || s;
      ball.vx *= s / cur; ball.vy *= s / cur; // hold the level speed
      ball.x += ball.vx * dt; ball.y += ball.vy * dt;
      trail.push({ x: ball.x, y: ball.y }); if (trail.length > 7) trail.shift();
      // walls
      if (ball.x - BALL_R < 0) { ball.x = BALL_R; ball.vx = Math.abs(ball.vx); MG.tone(300, 0.04, 'square', 0.03); }
      if (ball.x + BALL_R > W) { ball.x = W - BALL_R; ball.vx = -Math.abs(ball.vx); MG.tone(300, 0.04, 'square', 0.03); }
      if (ball.y - BALL_R < 0) { ball.y = BALL_R; ball.vy = Math.abs(ball.vy); MG.tone(300, 0.04, 'square', 0.03); }
      // paddle: angle depends on where the ball lands on it
      if (ball.vy > 0 && ball.y + BALL_R >= PADDLE_Y && ball.y + BALL_R <= PADDLE_Y + PADDLE_H + 8 &&
          ball.x >= paddleX - BALL_R && ball.x <= paddleX + PADDLE_W + BALL_R) {
        var rel = Math.max(-1, Math.min(1, (ball.x - (paddleX + PADDLE_W / 2)) / (PADDLE_W / 2)));
        var ang = rel * 1.1; // up to ~63 degrees off vertical
        ball.vx = Math.sin(ang) * s; ball.vy = -Math.cos(ang) * s;
        ball.y = PADDLE_Y - BALL_R - 0.5;
        MG.sfx.tap(); MG.vibrate(8);
      }
      // bricks: reflect on the smallest penetration axis
      for (var i = 0; i < bricks.length; i++) {
        var b = bricks[i];
        if (!b.alive) continue;
        if (ball.x + BALL_R < b.x || ball.x - BALL_R > b.x + b.w ||
            ball.y + BALL_R < b.y || ball.y - BALL_R > b.y + BRICK_H) continue;
        var overlapL = (ball.x + BALL_R) - b.x, overlapR = (b.x + b.w) - (ball.x - BALL_R);
        var overlapT = (ball.y + BALL_R) - b.y, overlapB = (b.y + BRICK_H) - (ball.y - BALL_R);
        var minX = Math.min(overlapL, overlapR), minY = Math.min(overlapT, overlapB);
        if (minX < minY) ball.vx = overlapL < overlapR ? -Math.abs(ball.vx) : Math.abs(ball.vx);
        else ball.vy = overlapT < overlapB ? -Math.abs(ball.vy) : Math.abs(ball.vy);
        b.alive = false; smashed++;
        var pts = ROW_POINTS[b.row];
        score += pts;
        popups.push({ text: '+' + pts, x: b.x + b.w / 2, y: b.y, t: 0 });
        renderHud();
        MG.sfx.eat();
        break; // one brick per frame keeps the bounce predictable
      }
      if (bricks.every(function (b) { return !b.alive; })) { nextLevel(); return; }
      // fell past the paddle
      if (ball.y - BALL_R > H) loseLife();
    }
    for (var j = popups.length - 1; j >= 0; j--) {
      popups[j].t += dt;
      if (popups[j].t > 0.8) popups.splice(j, 1);
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
  function draw() {
    if (!ctx) return;
    /* The frame is 3:4, exactly the world, but a wider frame (the 4:3 cover) letterboxes:
     * paint the background across the whole canvas first, in device space. */
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var bgFull = ctx.createLinearGradient(0, oy, 0, oy + ch);
    bgFull.addColorStop(0, '#241A4A'); bgFull.addColorStop(0.6, '#3A2A7A'); bgFull.addColorStop(1, '#1C1550');
    ctx.fillStyle = bgFull; ctx.fillRect(0, 0, cw, ch);
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * ox, dpr * oy);
    // background: deep purple hall with faint stars
    var bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#241A4A'); bg.addColorStop(0.6, '#3A2A7A'); bg.addColorStop(1, '#1C1550');
    ctx.fillStyle = bg; ctx.fillRect(-30, -30, W + 60, H + 60);
    ctx.fillStyle = 'rgba(255,255,255,.5)';
    [[40, 40], [120, 70], [200, 36], [300, 60], [380, 42], [440, 78], [80, 120], [420, 130], [30, 200], [450, 200]].forEach(function (p) {
      ctx.beginPath(); ctx.arc(p[0], p[1], 1.6, 0, 6.3); ctx.fill();
    });
    // level label
    ctx.font = '800 15px Poppins, "DejaVu Sans", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(255,255,255,.65)';
    ctx.fillText('LEVEL ' + level, W / 2, 52);
    // bricks
    bricks.forEach(function (b) {
      if (!b.alive) return;
      var g = ctx.createLinearGradient(b.x, b.y, b.x, b.y + BRICK_H);
      g.addColorStop(0, ROW_COLORS[b.row]);
      g.addColorStop(1, ROW_COLORS[b.row]);
      ctx.fillStyle = g;
      rr(b.x, b.y, b.w, BRICK_H, 5); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.38)';
      rr(b.x + 3, b.y + 2, b.w - 6, 6, 3); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,.18)';
      ctx.fillRect(b.x + 2, b.y + BRICK_H - 4, b.w - 4, 2);
    });
    // paddle: glowing neon bar
    var pg = ctx.createLinearGradient(paddleX, 0, paddleX + PADDLE_W, 0);
    pg.addColorStop(0, '#FFC22E'); pg.addColorStop(0.5, '#FFE066'); pg.addColorStop(1, '#FF9F1C');
    ctx.fillStyle = pg;
    ctx.shadowColor = 'rgba(255,194,46,.8)'; ctx.shadowBlur = 14;
    rr(paddleX, PADDLE_Y, PADDLE_W, PADDLE_H, 7); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    rr(paddleX + 6, PADDLE_Y + 2, PADDLE_W - 12, 4, 2); ctx.fill();
    // ball trail + ball
    trail.forEach(function (t, i) {
      ctx.globalAlpha = (i + 1) / trail.length * 0.25;
      ctx.fillStyle = '#FFE066';
      ctx.beginPath(); ctx.arc(t.x, t.y, BALL_R * (0.4 + 0.6 * i / trail.length), 0, 6.3); ctx.fill();
    });
    ctx.globalAlpha = 1;
    var bgr = ctx.createRadialGradient(ball.x - 3, ball.y - 3, 1, ball.x, ball.y, BALL_R + 2);
    bgr.addColorStop(0, '#FFFFFF'); bgr.addColorStop(0.55, '#FFE066'); bgr.addColorStop(1, '#FF9F1C');
    ctx.fillStyle = bgr;
    ctx.shadowColor = 'rgba(255,194,46,.9)'; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.arc(ball.x, ball.y, BALL_R, 0, 6.3); ctx.fill();
    ctx.shadowBlur = 0;
    // big score while playing
    if (state === 'playing' || state === 'serving') {
      ctx.font = '900 44px Poppins, "DejaVu Sans", sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.lineWidth = 7; ctx.strokeStyle = 'rgba(0,0,0,.35)';
      ctx.strokeText(String(score), W / 2, H * 0.42);
      ctx.fillStyle = 'rgba(255,255,255,.92)';
      ctx.fillText(String(score), W / 2, H * 0.42);
    }
    // popups (+points, level up)
    popups.forEach(function (p) {
      var a = 1 - p.t / 0.8;
      ctx.globalAlpha = a;
      ctx.font = '900 22px Poppins, "DejaVu Sans", sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,.4)';
      var py = p.y - p.t * 40;
      ctx.strokeText(p.text, p.x, py);
      ctx.fillStyle = '#FFC22E';
      ctx.fillText(p.text, p.x, py);
      ctx.globalAlpha = 1;
    });
    if (state === 'idle') {
      ctx.font = '900 26px Poppins, "DejaVu Sans", sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      var pulse = 0.65 + Math.sin(bobT * 4) * 0.35;
      ctx.globalAlpha = pulse;
      ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,.4)';
      ctx.strokeText('Move the paddle, tap to launch!', W / 2, H * 0.58);
      ctx.fillStyle = '#fff';
      ctx.fillText('Move the paddle, tap to launch!', W / 2, H * 0.58);
      ctx.globalAlpha = 1;
    }
    if (state === 'serving') {
      ctx.font = '900 22px Poppins, "DejaVu Sans", sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      var pulse2 = 0.65 + Math.sin(bobT * 4) * 0.35;
      ctx.globalAlpha = pulse2;
      ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,.4)';
      ctx.strokeText('Tap to launch the ball!', W / 2, H * 0.58);
      ctx.fillStyle = '#fff';
      ctx.fillText('Tap to launch the ball!', W / 2, H * 0.58);
      ctx.globalAlpha = 1;
    }
  }

  /* ---------- input ---------- */
  function pointerToWorld(e) {
    var r = canvas.getBoundingClientRect();
    return (e.clientX - r.left) / r.width * W;
  }
  canvas.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    paddleTarget = Math.max(0, Math.min(W - PADDLE_W, pointerToWorld(e) - PADDLE_W / 2));
    if (state === 'idle') start();
    else launch();
  });
  canvas.addEventListener('pointermove', function (e) {
    if (e.buttons === 0 && e.pointerType === 'mouse') return; // mouse steers only while held
    paddleTarget = Math.max(0, Math.min(W - PADDLE_W, pointerToWorld(e) - PADDLE_W / 2));
  });
  document.addEventListener('keydown', function (e) {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
      e.preventDefault();
      paddleTarget = Math.max(0, paddleTarget - 36);
      if (state === 'idle') start();
    } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
      e.preventDefault();
      paddleTarget = Math.min(W - PADDLE_W, paddleTarget + 36);
      if (state === 'idle') start();
    } else if (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowUp') {
      e.preventDefault();
      if (state === 'idle') start();
      else launch();
    }
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
      h('p', { class: 'mg-sub', text: 'The ball is frozen mid-flight. The bricks are waiting.' }),
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
    var play = h('button', { class: 'mg-btn', type: 'button', text: 'Start breaking' });
    play.addEventListener('click', start);
    overlay.innerHTML = '';
    overlay.append(h('div', { class: 'mg-card', role: 'dialog', 'aria-label': 'Breakout' },
      h('div', { class: 'bo-badge', 'aria-hidden': 'true', text: '🧱' }),
      h('h2', { class: 'mg-title', text: 'Breakout' }),
      h('p', { class: 'mg-sub', text: 'Steer the paddle, bounce the ball, and smash every brick. You have three lives — clear the wall to reach the next level, where the ball flies faster.' + (best ? ' Your best is ' + best + ' points.' : '') }),
      play));
    overlay.hidden = false;
  }

  /* ---------- start ---------- */
  renderSound(); reset(); showStart();
  resize();
  requestAnimationFrame(tick);
  if (o.showcase) { // still frame: wall half cleared, ball mid-flight, score 120
    overlay.hidden = true;
    state = 'playing'; paused = true; // frozen frame
    score = 120; best = Math.max(best, 240); level = 1; lives = 3;
    paddleX = 170; paddleTarget = 170;
    ball.x = 300; ball.y = 380; ball.vx = 120; ball.vy = -240;
    trail = [{ x: 312, y: 404 }, { x: 322, y: 424 }, { x: 330, y: 442 }];
    // clear a bite out of the wall: rows 3-4 mostly gone, row 2 half gone
    bricks.forEach(function (b) {
      if (b.row >= 3) b.alive = (b.x % 3 !== 0);
      else if (b.row === 2) b.alive = (b.x % 2 === 0);
    });
    root.classList.add('is-showcase');
    renderHud(); draw();
    setTimeout(function () { document.documentElement.setAttribute('data-ready', '1'); }, 80);
  }
  MG.ready();
})();
