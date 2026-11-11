/* Flappy Bird engine: one tap to flap, thread the bird through the green pipes.
 * Canvas game on a fixed logical world (480 x 640) scaled to fit the stage.
 * Options: { showcase: true } still frame for cover art. */
(function () {
  'use strict';
  var MG = window.MG, h = MG.h, o = window.GAME_OPTIONS || {};

  /* logical world */
  var W = 480, H = 640, GROUND = 72;
  var BIRD_X = 150, BIRD_R = 16;
  var GRAVITY = 1500, FLAP_VY = -430, MAX_FALL = 780;
  var PIPE_W = 78, PIPE_GAP = 168, PIPE_SPACING = 265;
  var BASE_SPEED = 155, SPEED_PER_PIPE = 2, MAX_SPEED = 235;
  var MEDALS = [[0, '🥚', 'Egg'], [10, '🥉', 'Bronze Flapper'], [20, '🥈', 'Silver Flapper'],
    [30, '🥇', 'Gold Flapper'], [40, '💎', 'Platinum Flapper']];
  var best = +MG.store.get('best', 0) || 0;

  /* ---------- state ---------- */
  var state = 'idle', paused = false; // idle | playing | dying | done
  var birdY = H * 0.45, birdVy = 0, birdRot = 0, wing = 0, bobT = 0;
  var pipes = [], speed = BASE_SPEED, score = 0, groundX = 0, cloudX = 0, dist = 0;
  var flash = 0, shakeT = 0, lastTick = 0;
  var clouds = [
    { x: 40, y: 70, s: 1 }, { x: 260, y: 130, s: 0.7 }, { x: 400, y: 50, s: 0.85 }, { x: 180, y: 190, s: 0.6 }
  ];

  /* ---------- DOM ---------- */
  function pill(label, el) { return h('span', { class: 'mg-pill' }, h('small', { text: label }), el); }
  var scoreEl = h('b', { text: '0' }), bestEl = h('b', { text: best ? best : '–' });
  var soundBtn = h('button', { class: 'mg-icon-btn', type: 'button' });
  var pauseBtn = h('button', { class: 'mg-icon-btn', type: 'button', 'aria-label': 'Pause the game' },
    h('span', { html: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1.2"/><rect x="14" y="5" width="4" height="14" rx="1.2"/></svg>' }));
  var canvas = h('canvas', { class: 'fp-canvas', role: 'img', 'aria-label': 'Flappy Bird game board' });
  var stage = h('div', { class: 'fp-stage' }, canvas);
  var overlay = h('div', { class: 'mg-overlay', hidden: true });
  var root = h('div', { class: 'mg-root fp' },
    h('div', { class: 'mg-hud' }, pill('Score', scoreEl), pill('Best', bestEl),
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
  function medal(s) { var m = MEDALS[0]; MEDALS.forEach(function (x) { if (s >= x[0]) m = x; }); return m; }
  function renderHud() {
    scoreEl.textContent = score;
    bestEl.textContent = Math.max(best, score) || '–';
  }
  function gapY() { return 130 + Math.random() * (H - GROUND - 130 - PIPE_GAP - 130); }
  function spawnPipe(x) { pipes.push({ x: x, gap: gapY(), passed: false }); }
  function reset() {
    birdY = H * 0.45; birdVy = 0; birdRot = 0; wing = 0;
    pipes = []; speed = BASE_SPEED; score = 0; dist = 0; flash = 0; shakeT = 0;
    renderHud();
  }
  function start() {
    reset();
    state = 'playing'; paused = false; overlay.hidden = true;
    spawnPipe(W + 60);
    MG.event('game_start');
  }
  function flap() {
    if (state !== 'playing' || paused) return;
    birdVy = FLAP_VY; wing = 0;
    MG.tone(520, 0.07, 'square', 0.045, 880);
    MG.vibrate(8);
  }
  function hitPipe(p) {
    var bx0 = BIRD_X - BIRD_R + 3, bx1 = BIRD_X + BIRD_R - 3;
    if (bx1 < p.x || bx0 > p.x + PIPE_W) return false;
    var topBot = p.gap, botTop = p.gap + PIPE_GAP;
    var by0 = birdY - BIRD_R + 3, by1 = birdY + BIRD_R - 3;
    // top pipe occupies [0, topBot], bottom pipe [botTop, H - GROUND]: only overlap counts
    return (by1 > 0 && by0 < topBot) || (by0 < H - GROUND && by1 > botTop);
  }
  function crash() {
    state = 'dying'; flash = 0.5; shakeT = 0.35;
    MG.sfx.bad(); MG.vibrate(60);
    if (birdVy < 0) birdVy = 0;
  }
  function finish() {
    state = 'done';
    var prev = best, isBest = score > best;
    if (isBest) { best = score; MG.store.set('best', best); }
    renderHud();
    var m = medal(score);
    var again = h('button', { class: 'mg-btn', type: 'button', text: 'Flap again' });
    again.addEventListener('click', function () { MG.adBreak('next', 'flappy-again', start); });
    overlay.innerHTML = '';
    overlay.append(h('div', { class: 'mg-card fp-card', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Game over' },
      h('div', { class: 'fp-badge', 'aria-hidden': 'true', text: m[1] }),
      h('div', null, h('small', { class: 'mg-label', text: 'Your medal' }), h('h2', { class: 'mg-title', text: m[2] })),
      h('div', { class: 'fp-score' }, h('span', { class: 'mg-big', text: score }), h('span', { text: score === 1 ? 'pipe cleared' : 'pipes cleared' })),
      isBest && prev ? h('span', { class: 'mg-badge', text: 'New best!' }) : null,
      h('p', { class: 'mg-sub', text: (prev && !isBest ? 'Your best is ' + prev + '. ' : '') + 'Tap to flap, thread the gap, and beat it next time.' }),
      h('div', { class: 'mg-row' }, again)));
    overlay.hidden = false;
    MG.focusSafe(again, 700);
    if (isBest && prev) { MG.confetti(120); MG.sfx.win(); }
    else if (score >= 10) MG.sfx.good(); else MG.sfx.lose();
    MG.event('game_over', { score: score });
  }

  /* ---------- update ---------- */
  function tick(now) {
    requestAnimationFrame(tick);
    var dt = Math.min(0.05, Math.max(0, (now - (lastTick || now)) / 1000));
    lastTick = now;
    if (flash > 0) flash = Math.max(0, flash - dt * 1.6);
    if (shakeT > 0) shakeT = Math.max(0, shakeT - dt);
    if (state === 'idle') {
      bobT += dt;
      birdY = H * 0.45 + Math.sin(bobT * 3) * 10;
      birdRot = Math.sin(bobT * 3) * 0.08;
      groundX -= 24 * dt; cloudX -= 6 * dt;
    } else if (state === 'playing' && !paused) {
      birdVy = Math.min(MAX_FALL, birdVy + GRAVITY * dt);
      birdY += birdVy * dt;
      if (birdY < BIRD_R) { birdY = BIRD_R; if (birdVy < 0) birdVy = 0; } // ceiling: the bird slides along the top
      birdRot = Math.max(-0.45, Math.min(1.25, birdVy / 520));
      wing += dt * (birdVy < 0 ? 26 : 12);
      groundX -= speed * dt; cloudX -= 10 * dt; dist += speed * dt;
      var last = pipes[pipes.length - 1];
      if (last && last.x < W - PIPE_SPACING) spawnPipe(last.x + PIPE_SPACING);
      for (var i = pipes.length - 1; i >= 0; i--) {
        var p = pipes[i];
        p.x -= speed * dt;
        if (!p.passed && p.x + PIPE_W < BIRD_X - BIRD_R) {
          p.passed = true; score++;
          speed = Math.min(MAX_SPEED, BASE_SPEED + SPEED_PER_PIPE * score);
          MG.sfx.bonus(); renderHud();
        }
        if (p.x < -PIPE_W - 20) pipes.splice(i, 1);
      }
      if (hitPipe(pipes[0]) || (pipes[1] && hitPipe(pipes[1]))) { crash(); }
      else if (birdY + BIRD_R >= H - GROUND) { birdY = H - GROUND - BIRD_R; crash(); }
    } else if (state === 'dying') {
      birdVy = Math.min(MAX_FALL, birdVy + GRAVITY * dt);
      birdY += birdVy * dt;
      birdRot = Math.min(1.5, birdRot + dt * 4);
      if (birdY + BIRD_R >= H - GROUND) { birdY = H - GROUND - BIRD_R; finish(); }
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
  function drawPipe(p) {
    var capH = 30, capOver = 4;
    function body(x, y, w, h, top) {
      ctx.fillStyle = '#5DAE1E'; ctx.strokeStyle = '#3E7A12'; ctx.lineWidth = 3;
      rr(x, y, w, h, 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.28)';
      ctx.fillRect(x + 9, y + 4, 10, h - 8);
      ctx.fillStyle = 'rgba(0,0,0,.12)';
      ctx.fillRect(x + w - 12, y + 4, 6, h - 8);
      ctx.fillStyle = '#74BF2E'; ctx.strokeStyle = '#3E7A12'; ctx.lineWidth = 3;
      if (top) { rr(x - capOver, y + h - capH, w + capOver * 2, capH, 4); }
      else { rr(x - capOver, y, w + capOver * 2, capH, 4); }
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.28)';
      if (top) ctx.fillRect(x + 5, y + h - capH + 4, 10, capH - 8);
      else ctx.fillRect(x + 5, y + 4, 10, capH - 8);
    }
    body(p.x, 0, PIPE_W, p.gap, true);
    body(p.x, p.gap + PIPE_GAP, PIPE_W, H - GROUND - p.gap - PIPE_GAP, false);
  }
  function drawBird() {
    ctx.save();
    ctx.translate(BIRD_X, birdY);
    ctx.rotate(birdRot);
    // tail
    ctx.fillStyle = '#F08A1D';
    ctx.beginPath(); ctx.moveTo(-13, -2); ctx.lineTo(-26, -8); ctx.lineTo(-24, 2); ctx.lineTo(-26, 8); ctx.lineTo(-12, 6); ctx.closePath(); ctx.fill();
    // body
    var g = ctx.createRadialGradient(-4, -8, 4, 0, 0, 22);
    g.addColorStop(0, '#FFE066'); g.addColorStop(1, '#F5B81D');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(0, 0, 18, 15, 0, 0, 6.3); ctx.fill();
    ctx.strokeStyle = '#C77F0A'; ctx.lineWidth = 2; ctx.stroke();
    // belly
    ctx.fillStyle = '#FFF3C4';
    ctx.beginPath(); ctx.ellipse(2, 6, 11, 7, 0, 0, 6.3); ctx.fill();
    // wing (flaps)
    var wA = Math.sin(wing) * 0.9;
    ctx.save(); ctx.translate(-4, 2); ctx.rotate(wA);
    ctx.fillStyle = '#F08A1D';
    ctx.beginPath(); ctx.ellipse(-4, 0, 11, 6.5, -0.3, 0, 6.3); ctx.fill();
    ctx.strokeStyle = '#C77F0A'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.restore();
    // eye
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(7, -6, 6.5, 0, 6.3); ctx.fill();
    ctx.fillStyle = '#17100B';
    ctx.beginPath(); ctx.arc(9, -6, 3.2, 0, 6.3); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(10, -7.5, 1.2, 0, 6.3); ctx.fill();
    // beak
    ctx.fillStyle = '#FF6A2B';
    ctx.beginPath(); ctx.moveTo(13, -3); ctx.lineTo(26, 1); ctx.lineTo(13, 5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#E8481C';
    ctx.beginPath(); ctx.moveTo(13, 4); ctx.lineTo(23, 5); ctx.lineTo(13, 8); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  function draw() {
    if (!ctx) return;
    /* The frame is 3:4, exactly the world, but a wider frame (the 4:3 cover) letterboxes:
     * paint the sky and the ground strip across the whole canvas first, in device
     * space, so the bars are a seamless extension of the world. */
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var gyY = oy + (H - GROUND) * scale;
    var skyFull = ctx.createLinearGradient(0, oy, 0, gyY);
    skyFull.addColorStop(0, '#4EC0CA'); skyFull.addColorStop(0.7, '#7ED8DE'); skyFull.addColorStop(1, '#C8F0E8');
    ctx.fillStyle = skyFull; ctx.fillRect(0, 0, cw, ch);
    ctx.fillStyle = '#DED895'; ctx.fillRect(0, gyY, cw, ch - gyY);
    ctx.fillStyle = '#7EC850'; ctx.fillRect(0, gyY, cw, 16 * scale);
    ctx.fillStyle = '#5DAE1E'; ctx.fillRect(0, gyY + 16 * scale, cw, 4 * scale);
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * ox, dpr * oy);
    if (shakeT > 0) {
      var s = shakeT * 22;
      ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
    }
    // sky
    var sky = ctx.createLinearGradient(0, 0, 0, H - GROUND);
    sky.addColorStop(0, '#4EC0CA'); sky.addColorStop(0.7, '#7ED8DE'); sky.addColorStop(1, '#C8F0E8');
    ctx.fillStyle = sky; ctx.fillRect(-30, -30, W + 60, H - GROUND + 30);
    // sun
    ctx.fillStyle = '#FFF3A0';
    ctx.beginPath(); ctx.arc(398, 78, 34, 0, 6.3); ctx.fill();
    ctx.fillStyle = 'rgba(255,243,160,.35)';
    ctx.beginPath(); ctx.arc(398, 78, 48, 0, 6.3); ctx.fill();
    // clouds (one subpath per puff, or the arcs join with straight lines)
    ctx.fillStyle = 'rgba(255,255,255,.92)';
    clouds.forEach(function (c) {
      var x = ((c.x + cloudX * c.s) % (W + 220) + W + 220) % (W + 220) - 110;
      var y = c.y, s = c.s;
      [[0, 0, 42, 17], [-26, 5, 26, 12], [28, 5, 28, 13]].forEach(function (e) {
        ctx.beginPath(); ctx.ellipse(x + e[0] * s, y + e[1] * s, e[2] * s, e[3] * s, 0, 0, 6.3); ctx.fill();
      });
    });
    // distant hills (drawn past the world edges so a wider frame has no hard cut)
    ctx.fillStyle = '#8ED081';
    ctx.beginPath(); ctx.moveTo(-160, H - GROUND);
    ctx.quadraticCurveTo(110, H - GROUND - 96, 250, H - GROUND);
    ctx.quadraticCurveTo(380, H - GROUND - 70, 640, H - GROUND);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#6DBF6B';
    ctx.beginPath(); ctx.moveTo(-160, H - GROUND);
    ctx.quadraticCurveTo(140, H - GROUND - 52, 300, H - GROUND);
    ctx.quadraticCurveTo(420, H - GROUND - 40, 640, H - GROUND);
    ctx.closePath(); ctx.fill();
    // pipes
    pipes.forEach(drawPipe);
    // ground (drawn past the world edges so a wider frame has no hard cut)
    var gy = H - GROUND;
    ctx.fillStyle = '#DED895'; ctx.fillRect(-200, gy, W + 400, GROUND);
    ctx.fillStyle = '#7EC850'; ctx.fillRect(-200, gy, W + 400, 16);
    ctx.fillStyle = '#5DAE1E'; ctx.fillRect(-200, gy + 16, W + 400, 4);
    ctx.fillStyle = 'rgba(0,0,0,.10)';
    var off = ((groundX % 44) + 44) % 44;
    for (var x = -off - 200; x < W + 244; x += 44) {
      ctx.beginPath(); ctx.moveTo(x, gy + 20); ctx.lineTo(x + 22, gy + 20); ctx.lineTo(x + 12, gy + GROUND); ctx.lineTo(x - 10, gy + GROUND); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = 'rgba(0,0,0,.08)';
    ctx.fillRect(-200, gy, W + 400, 3);
    drawBird();
    // big score while playing
    if (state === 'playing' || state === 'dying') {
      ctx.font = '900 56px Poppins, "DejaVu Sans", sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.lineWidth = 8; ctx.strokeStyle = 'rgba(0,0,0,.35)';
      ctx.strokeText(String(score), W / 2, 26);
      ctx.fillStyle = '#fff';
      ctx.fillText(String(score), W / 2, 26);
    }
    if (state === 'idle') {
      ctx.font = '900 26px Poppins, "DejaVu Sans", sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      var pulse = 0.65 + Math.sin(bobT * 4) * 0.35;
      ctx.globalAlpha = pulse;
      ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,.35)';
      ctx.strokeText('Tap to flap!', W / 2, H * 0.62);
      ctx.fillStyle = '#fff';
      ctx.fillText('Tap to flap!', W / 2, H * 0.62);
      ctx.globalAlpha = 1;
    }
    // crash flash
    if (flash > 0) { ctx.fillStyle = 'rgba(255,255,255,' + flash.toFixed(2) + ')'; ctx.fillRect(-30, -30, W + 60, H + 60); }
  }

  /* ---------- input ---------- */
  canvas.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    if (state === 'idle') { start(); flap(); }
    else flap();
  });
  document.addEventListener('keydown', function (e) {
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
      e.preventDefault();
      if (state === 'idle') { start(); flap(); }
      else flap();
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
      h('p', { class: 'mg-sub', text: 'The bird is hovering in mid-air. The pipes are waiting.' }),
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
    var play = h('button', { class: 'mg-btn', type: 'button', text: 'Start flapping' });
    play.addEventListener('click', function () { start(); flap(); });
    overlay.innerHTML = '';
    overlay.append(h('div', { class: 'mg-card', role: 'dialog', 'aria-label': 'Flappy Bird' },
      h('div', { class: 'fp-badge', 'aria-hidden': 'true', text: '🐤' }),
      h('h2', { class: 'mg-title', text: 'Flappy Bird' }),
      h('p', { class: 'mg-sub', text: 'Tap to flap and thread the little bird through the pipes. One pipe, one point. How far can you fly?' + (best ? ' Your best is ' + best + '.' : '') }),
      play));
    overlay.hidden = false;
  }

  /* ---------- start ---------- */
  renderSound(); renderHud(); showStart();
  resize();
  requestAnimationFrame(tick);
  if (o.showcase) { // still frame: bird mid-flight between two pipe pairs, score 7
    overlay.hidden = true;
    state = 'playing'; paused = true; // frozen frame
    score = 7; best = Math.max(best, 12);
    birdY = 300; birdVy = -60; birdRot = -0.2; wing = 1.2;
    pipes = [{ x: 300, gap: 210, passed: true }, { x: 565, gap: 320, passed: false }];
    root.classList.add('is-showcase');
    renderHud(); draw();
    setTimeout(function () { document.documentElement.setAttribute('data-ready', '1'); }, 80);
  }
  MG.ready();
})();
