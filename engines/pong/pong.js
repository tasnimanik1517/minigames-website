/* Pong engine: the original arcade duel — you at the bottom, the computer at the top.
 * First to 7 wins the match. The ball starts gentle and gets faster every rally.
 * Canvas game on a fixed logical world (480 x 640) scaled to fit the stage.
 * Options: { showcase: true } still frame for cover art. */
(function () {
  'use strict';
  var MG = window.MG, h = MG.h, o = window.GAME_OPTIONS || {};

  /* logical world */
  var W = 480, H = 640;
  var PADDLE_W = 110, PADDLE_H = 14, PLAYER_Y = H - 56, AI_Y = 42;
  var BALL_R = 8, WIN_SCORE = 7;
  var BASE_SPEED = 250, SPEED_PER_HIT = 12, MAX_SPEED = 540;
  var AI_SPEED = 245;
  var RANKS = [[0, '🥚', 'First Rally'], [2, '🏓', 'Paddle Rookie'], [4, '🔥', 'Rally Runner'],
    [6, '🏆', 'Table Tennis Star'], [7, '👑', 'Pong Champion']];
  var wins = +MG.store.get('wins', 0) || 0;

  /* ---------- state ---------- */
  var state = 'idle', paused = false; // idle | playing | done
  var you = 0, cpu = 0, hits = 0, bestRally = 0, rally = 0;
  var playerX = (W - PADDLE_W) / 2, playerTarget = playerX, aiX = (W - PADDLE_W) / 2;
  var ball = { x: W / 2, y: H / 2, vx: 0, vy: 0 };
  var serveAt = 0, gameTime = 0, lastTick = 0;
  var keys = {};
  var trail = [];

  /* ---------- DOM ---------- */
  function pill(label, el) { return h('span', { class: 'mg-pill' }, h('small', { text: label }), el); }
  var youEl = h('b', { text: '0' }), cpuEl = h('b', { text: '0' }), winsEl = h('b', { text: wins ? wins : '–' });
  var soundBtn = h('button', { class: 'mg-icon-btn', type: 'button' });
  var pauseBtn = h('button', { class: 'mg-icon-btn', type: 'button', 'aria-label': 'Pause the match' },
    h('span', { html: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1.2"/><rect x="14" y="5" width="4" height="14" rx="1.2"/></svg>' }));
  var msg = h('div', { class: 'pg-msg', 'aria-live': 'polite', text: 'First to 7 wins the match' });
  var canvas = h('canvas', { class: 'pg-canvas', role: 'img', 'aria-label': 'Pong table' });
  var stage = h('div', { class: 'pg-stage' }, canvas);
  var overlay = h('div', { class: 'mg-overlay', hidden: true });
  var root = h('div', { class: 'mg-root pg' },
    h('div', { class: 'mg-hud' }, pill('You', youEl), pill('CPU', cpuEl), pill('Wins', winsEl),
      h('span', { class: 'mg-spacer' }), pauseBtn, soundBtn),
    h('div', { class: 'pg-main' }, msg, stage), overlay);
  document.getElementById('game').append(root);

  var ctx = null, scale = 1, ox = 0, oy = 0, cw = 0, ch = 0;
  function resize() {
    var r = stage.getBoundingClientRect();
    cw = Math.max(150, r.width); ch = Math.max(150, r.height);
    scale = Math.min(cw / W, ch / H);
    ox = (cw - W * scale) / 2; oy = (ch - H * scale) / 2;
    ctx = MG.fitCanvas(canvas, cw, ch);
    draw();
  }
  if (window.ResizeObserver) new ResizeObserver(resize).observe(stage);
  else window.addEventListener('resize', resize);

  /* ---------- helpers ---------- */
  function rank(s) { var r = RANKS[0]; RANKS.forEach(function (x) { if (s >= x[0]) r = x; }); return r; }
  function renderHud() {
    youEl.textContent = you;
    cpuEl.textContent = cpu;
    winsEl.textContent = wins ? wins : '–';
  }
  function speed() { return Math.min(MAX_SPEED, BASE_SPEED + SPEED_PER_HIT * hits); }
  function clampPaddle(x) { return Math.max(0, Math.min(W - PADDLE_W, x)); }

  /* ---------- drawing ---------- */
  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  function draw() {
    if (!ctx) return;
    ctx.clearRect(0, 0, cw, ch);
    ctx.save();
    ctx.translate(ox, oy); ctx.scale(scale, scale);
    // big faint scores, one in each half
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.font = '900 120px Poppins, Inter, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(cpu), W / 2, H * 0.25);
    ctx.fillText(String(you), W / 2, H * 0.75);
    // centre line
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 4; ctx.setLineDash([18, 16]);
    ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke();
    ctx.setLineDash([]);
    // ball trail
    for (var i = 0; i < trail.length; i++) {
      var t = trail[i];
      ctx.globalAlpha = 0.12 + 0.25 * (i / trail.length);
      ctx.fillStyle = '#FFE066';
      ctx.beginPath(); ctx.arc(t.x, t.y, BALL_R * (0.5 + 0.5 * i / trail.length), 0, 6.3); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // AI paddle (top) — cool blue
    ctx.shadowColor = 'rgba(56,189,248,0.8)'; ctx.shadowBlur = 18;
    ctx.fillStyle = '#38BDF8';
    roundRect(ctx, aiX, AI_Y, PADDLE_W, PADDLE_H, 7); ctx.fill();
    // player paddle (bottom) — warm amber
    ctx.shadowColor = 'rgba(255,194,46,0.8)';
    ctx.fillStyle = '#FFC22E';
    roundRect(ctx, playerX, PLAYER_Y, PADDLE_W, PADDLE_H, 7); ctx.fill();
    ctx.shadowBlur = 0;
    // ball
    ctx.fillStyle = '#FFFFFF';
    ctx.shadowColor = 'rgba(255,255,255,0.9)'; ctx.shadowBlur = 16;
    ctx.beginPath(); ctx.arc(ball.x, ball.y, BALL_R, 0, 6.3); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  /* ---------- the match ---------- */
  function serve(towardPlayer) {
    ball.x = W / 2; ball.y = H / 2;
    var ang = (Math.random() * 0.7 - 0.35); // up to ~20 degrees off vertical
    var sp = speed();
    ball.vx = Math.sin(ang) * sp;
    ball.vy = (towardPlayer ? 1 : -1) * Math.cos(ang) * sp;
    trail = [];
    serveAt = gameTime + 650;
    state = 'serving';
  }
  function start() {
    you = 0; cpu = 0; hits = 0; bestRally = 0; rally = 0;
    playerX = (W - PADDLE_W) / 2; playerTarget = playerX; aiX = playerX;
    state = 'playing'; paused = false; overlay.hidden = true;
    msg.textContent = 'First to 7 wins the match';
    renderHud();
    serve(Math.random() < 0.5);
  }
  function point(winner) {
    if (winner === 'you') { you++; rally = 0; msg.textContent = 'Point! You lead ' + you + '–' + cpu; MG.sfx.good(); }
    else { cpu++; rally = 0; msg.textContent = 'CPU scores — ' + you + '–' + cpu; MG.sfx.bad(); }
    renderHud(); draw();
    if (you >= WIN_SCORE || cpu >= WIN_SCORE) { finish(); return; }
    serve(winner === 'cpu');
  }
  function bouncePaddle(isPlayer) {
    var px = isPlayer ? playerX : aiX;
    var rel = (ball.x - (px + PADDLE_W / 2)) / (PADDLE_W / 2); // -1 .. 1
    rel = Math.max(-1, Math.min(1, rel));
    var sp = speed();
    var ang = rel * 1.05; // up to ~60 degrees
    ball.vx = Math.sin(ang) * sp;
    ball.vy = (isPlayer ? -1 : 1) * Math.cos(ang) * sp;
    ball.y = isPlayer ? PLAYER_Y - BALL_R - 1 : AI_Y + PADDLE_H + BALL_R + 1;
    hits++; rally++;
    if (rally > bestRally) bestRally = rally;
    MG.tone(isPlayer ? 520 : 380, 0.05, 'square', 0.04);
    MG.vibrate(8);
  }
  function tick(now) {
    requestAnimationFrame(tick);
    var dt = Math.min(50, Math.max(0, now - (lastTick || now))) / 1000;
    lastTick = now;
    if (state === 'done' || paused) return;
    gameTime += dt * 1000;
    // player paddle: keys move it, pointer sets the target
    var keySpeed = 460;
    if (keys.ArrowLeft || keys.KeyA) playerTarget -= keySpeed * dt;
    if (keys.ArrowRight || keys.KeyD) playerTarget += keySpeed * dt;
    playerTarget = clampPaddle(playerTarget);
    playerX += (playerTarget - playerX) * Math.min(1, dt * 18);
    playerX = clampPaddle(playerX);
    // AI paddle: chases the ball only while it comes its way, and a touch slower than the ball
    if (ball.vy < 0) {
      var target = ball.x - PADDLE_W / 2 + (Math.sin(gameTime / 700) * 14); // small wobble so it is beatable
      var diff = target - aiX;
      var step = Math.max(-AI_SPEED * dt, Math.min(AI_SPEED * dt, diff));
      aiX = clampPaddle(aiX + step);
    } else {
      // drift back to centre while the ball heads away
      var c = (W - PADDLE_W) / 2 - aiX;
      aiX = clampPaddle(aiX + Math.max(-90 * dt, Math.min(90 * dt, c)));
    }
    if (state === 'serving') {
      if (gameTime >= serveAt) state = 'playing';
      draw();
      return;
    }
    if (state !== 'playing') { draw(); return; }
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    trail.push({ x: ball.x, y: ball.y });
    if (trail.length > 7) trail.shift();
    // side walls
    if (ball.x < BALL_R) { ball.x = BALL_R; ball.vx = Math.abs(ball.vx); MG.tone(300, 0.04, 'triangle', 0.03); }
    if (ball.x > W - BALL_R) { ball.x = W - BALL_R; ball.vx = -Math.abs(ball.vx); MG.tone(300, 0.04, 'triangle', 0.03); }
    // paddles
    if (ball.vy > 0 && ball.y + BALL_R >= PLAYER_Y && ball.y - BALL_R <= PLAYER_Y + PADDLE_H &&
        ball.x >= playerX - BALL_R && ball.x <= playerX + PADDLE_W + BALL_R) bouncePaddle(true);
    else if (ball.vy < 0 && ball.y - BALL_R <= AI_Y + PADDLE_H && ball.y + BALL_R >= AI_Y &&
        ball.x >= aiX - BALL_R && ball.x <= aiX + PADDLE_W + BALL_R) bouncePaddle(false);
    // points
    if (ball.y < -BALL_R * 2) point('you');
    else if (ball.y > H + BALL_R * 2) point('cpu');
    draw();
  }
  function finish() {
    state = 'done';
    var won = you >= WIN_SCORE;
    var prev = wins, isNewWin = won;
    if (won) { wins++; MG.store.set('wins', wins); }
    renderHud();
    var r = rank(you);
    var again = h('button', { class: 'mg-btn', type: 'button', text: 'Play again' });
    again.addEventListener('click', function () { MG.adBreak('next', 'pong-again', start); });
    overlay.innerHTML = '';
    overlay.append(h('div', { class: 'mg-card pg-card', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Match result' },
      h('div', { class: 'pg-badge', 'aria-hidden': 'true', text: won ? '🏆' : r[1] }),
      h('div', null, h('small', { class: 'mg-label', text: won ? 'You won the match!' : 'CPU won the match' }), h('h2', { class: 'mg-title', text: won ? 'Pong Champion' : r[2] })),
      h('div', { class: 'pg-score' }, h('span', { class: 'mg-big', text: you + ' – ' + cpu }), h('span', { text: 'final score · best rally ' + bestRally })),
      won && prev ? h('span', { class: 'mg-badge', text: 'Match win ' + wins + '!' }) : null,
      h('p', { class: 'mg-sub', text: won ? 'You beat the computer — first to 7, and you got there first.' : 'The computer reached 7 first. Your best rally was ' + bestRally + ' hits — try to stretch it next time.' }),
      h('div', { class: 'mg-row' }, again)));
    overlay.hidden = false;
    MG.focusSafe(again, 700);
    if (won) { MG.confetti(120); MG.sfx.win(); } else MG.sfx.lose();
    MG.event('game_over', { score: you, won: won });
  }

  /* ---------- pause ---------- */
  function pauseGame() {
    if (state !== 'playing' && state !== 'serving' || paused) return;
    paused = true;
    var resume = h('button', { class: 'mg-btn', type: 'button', text: 'Resume' });
    var restart = h('button', { class: 'mg-btn is-secondary', type: 'button', text: 'Start again' });
    resume.addEventListener('click', function () { paused = false; overlay.hidden = true; });
    restart.addEventListener('click', start);
    overlay.innerHTML = '';
    overlay.append(h('div', { class: 'mg-card', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Paused' },
      h('h2', { class: 'mg-title', text: 'Paused' }),
      h('p', { class: 'mg-sub', text: 'The ball is frozen mid-flight. The match waits for you.' }),
      h('div', { class: 'mg-row' }, restart, resume)));
    overlay.hidden = false;
    MG.focusSafe(resume, 300);
  }
  pauseBtn.addEventListener('click', function () {
    if (paused) { paused = false; overlay.hidden = true; } else pauseGame();
  });
  MG.onPause(pauseGame);

  /* ---------- controls: pointer drag + keyboard ---------- */
  function pointerToTarget(e) {
    var r = canvas.getBoundingClientRect();
    var lx = (e.clientX - r.left - ox) / scale;
    playerTarget = clampPaddle(lx - PADDLE_W / 2);
  }
  stage.addEventListener('pointerdown', function (e) { if (state === 'playing' || state === 'serving') pointerToTarget(e); });
  stage.addEventListener('pointermove', function (e) { if (e.buttons && (state === 'playing' || state === 'serving')) pointerToTarget(e); });
  document.addEventListener('keydown', function (e) {
    if (e.code === 'ArrowLeft' || e.code === 'ArrowRight' || e.code === 'KeyA' || e.code === 'KeyD') {
      keys[e.code] = true;
      if (state === 'playing' || state === 'serving') e.preventDefault();
    }
  });
  document.addEventListener('keyup', function (e) { keys[e.code] = false; });

  /* ---------- start screen ---------- */
  function showStart() {
    var play = h('button', { class: 'mg-btn', type: 'button', text: 'Start the match' });
    play.addEventListener('click', start);
    overlay.innerHTML = '';
    overlay.append(h('div', { class: 'mg-card', role: 'dialog', 'aria-label': 'Pong' },
      h('div', { class: 'pg-badge', 'aria-hidden': 'true', text: '🏓' }),
      h('h2', { class: 'mg-title', text: 'Pong' }),
      h('p', { class: 'mg-sub', text: 'The original arcade duel: bounce the ball past the computer paddle. First to 7 wins the match — drag, or use the arrow keys.' + (wins ? ' You have won ' + wins + (wins === 1 ? ' match.' : ' matches.') : '') }),
      play));
    overlay.hidden = false;
  }

  /* ---------- sound button ---------- */
  soundBtn.addEventListener('click', function () { MG.sound.toggle(); renderSound(); });
  function renderSound() {
    soundBtn.innerHTML = MG.sound.muted
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z" fill="currentColor"/><path d="m16 9 6 6M22 9l-6 6"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z" fill="currentColor"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>';
    soundBtn.setAttribute('aria-label', MG.sound.muted ? 'Turn sound on' : 'Turn sound off');
  }

  /* ---------- start ---------- */
  renderSound(); renderHud(); showStart();
  resize();
  requestAnimationFrame(tick);
  if (o.showcase) { // still frame: mid-rally, 4–2, ball flying toward the player
    overlay.hidden = true;
    state = 'playing'; paused = true; // frozen frame
    you = 4; cpu = 2; wins = Math.max(wins, 3);
    playerX = 150; playerTarget = 150; aiX = 230;
    ball.x = 300; ball.y = 380; ball.vx = -160; ball.vy = 300;
    trail = [{ x: 316, y: 350 }, { x: 328, y: 326 }, { x: 338, y: 306 }];
    msg.textContent = 'First to 7 wins the match';
    root.classList.add('is-showcase');
    renderHud(); draw();
    setTimeout(function () { document.documentElement.setAttribute('data-ready', '1'); }, 80);
  }
  MG.ready();
})();
