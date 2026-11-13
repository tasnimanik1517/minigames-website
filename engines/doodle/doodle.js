/* Doodle Jump engine: bounce ever higher, steer left and right, don't fall.
 * The doodler bounces on its own; you only steer. Platforms get sparser and
 * trickier the higher you climb. Canvas game on a fixed logical world
 * (480 x 640) scaled to fit the stage.
 * Options: { showcase: true } still frame for cover art. */
(function () {
  'use strict';
  var MG = window.MG, h = MG.h, o = window.GAME_OPTIONS || {};

  /* logical world */
  var W = 480, H = 640;
  var GRAV = 2400, JUMP_V = -880, SPRING_V = -1560;
  var MOVE_SPEED = 330;
  var PR = 20; // player radius
  var RANKS = [[0, '🌱', 'First Hop'], [100, '🐸', 'Little Leaper'], [300, '☁️', 'Cloud Climber'],
    [600, '🚀', 'Sky Rocket'], [1000, '💎', 'High Flyer'], [1500, '👑', 'Doodle Champion']];
  var best = +MG.store.get('best', 0) || 0;

  /* ---------- state ---------- */
  var state = 'idle', paused = false; // idle | playing | done
  var player = { x: W / 2, y: H - 120, vx: 0, vy: 0, face: 1, squash: 0 };
  var targetX = W / 2, pointerActive = false;
  var keys = { left: false, right: false };
  var platforms = []; // {x, y, w, type, baseX, phase, range, broken, fallV, spring}
  var cam = 0, topY = 0, startY = 0, maxHeight = 0, score = 0;
  var t = 0, lastTick = 0, bounceT = 0;
  var particles = []; // {x, y, vx, vy, t, color, r}

  /* ---------- DOM ---------- */
  function pill(label, el) { return h('span', { class: 'mg-pill' }, h('small', { text: label }), el); }
  var scoreEl = h('b', { text: '0' }), bestEl = h('b', { text: best ? best : '–' });
  var soundBtn = h('button', { class: 'mg-icon-btn', type: 'button' });
  var pauseBtn = h('button', { class: 'mg-icon-btn', type: 'button', 'aria-label': 'Pause the game' },
    h('span', { html: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1.2"/><rect x="14" y="5" width="4" height="14" rx="1.2"/></svg>' }));
  var canvas = h('canvas', { class: 'dj-canvas', role: 'img', 'aria-label': 'Doodle Jump game board' });
  var stage = h('div', { class: 'dj-stage' }, canvas);
  var overlay = h('div', { class: 'mg-overlay', hidden: true });
  var root = h('div', { class: 'mg-root dj' },
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
  function rank(s) { var r = RANKS[0]; RANKS.forEach(function (x) { if (s >= x[0]) r = x; }); return r; }
  function renderHud() {
    scoreEl.textContent = score;
    bestEl.textContent = Math.max(best, score) || '–';
  }
  function hash(n) { var x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
  function gapFor(height) { return 52 + Math.min(48, height / 45) + Math.random() * 18; }
  function widthFor(height) { return Math.max(58, 96 - height / 60); }
  function typeFor(height) {
    var r = Math.random();
    if (height < 300) return 'normal';
    if (height < 600) return r < 0.75 ? 'normal' : 'moving';
    if (r < 0.55) return 'normal';
    if (r < 0.78) return 'moving';
    return 'breakable';
  }
  function addPlatform(y, height) {
    var w = widthFor(height), type = typeFor(height);
    var p = { x: 8 + Math.random() * (W - 16 - w), y: y, w: w, type: type,
      baseX: 0, phase: Math.random() * 6.28, range: 40 + Math.random() * 60,
      broken: false, fallV: 0, spring: false };
    p.baseX = p.x;
    if (type === 'normal' && height > 300 && Math.random() < 0.14) p.spring = true;
    platforms.push(p);
    return p;
  }
  function buildWorld() {
    platforms = []; particles = [];
    player.x = W / 2; player.y = H - 120; player.vx = 0; player.vy = JUMP_V; player.face = 1;
    targetX = W / 2; pointerActive = false;
    cam = 0; startY = player.y; maxHeight = 0; score = 0; t = 0;
    var y = H - 30, height = 0;
    platforms.push({ x: W / 2 - 50, y: y, w: 100, type: 'normal', baseX: W / 2 - 50, phase: 0, range: 0, broken: false, fallV: 0, spring: false });
    y -= 60; height += 60;
    while (y > -120) {
      addPlatform(y, height);
      var g = gapFor(height);
      y -= g; height += g;
    }
    topY = y;
    renderHud();
  }
  function ensurePlatforms() {
    var height = startY - topY;
    while (topY > cam - 140) {
      var g = gapFor(height);
      topY -= g; height += g;
      addPlatform(topY, height);
    }
    // drop platforms far below the screen
    platforms = platforms.filter(function (p) { return p.y < cam + H + 220 && !p.broken; });
  }
  function burst(x, y, color, n) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * 6.28, s = 60 + Math.random() * 160;
      particles.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60, t: 0, color: color, r: 2 + Math.random() * 3 });
    }
  }
  function reset() { buildWorld(); }
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
    var again = h('button', { class: 'mg-btn', type: 'button', text: 'Jump again' });
    again.addEventListener('click', function () { MG.adBreak('next', 'doodle-again', start); });
    overlay.innerHTML = '';
    overlay.append(h('div', { class: 'mg-card dj-card', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Game over' },
      h('div', { class: 'dj-badge', 'aria-hidden': 'true', text: r[1] }),
      h('div', null, h('small', { class: 'mg-label', text: 'Your climber rank' }), h('h2', { class: 'mg-title', text: r[2] })),
      h('div', { class: 'dj-score' }, h('span', { class: 'mg-big', text: score }), h('span', { text: 'points · ' + Math.floor(maxHeight / 10) + ' m climbed · best ' + Math.max(prev, score) })),
      isBest && prev ? h('span', { class: 'mg-badge', text: 'New best!' }) : null,
      h('p', { class: 'mg-sub', text: (prev && !isBest ? 'Your best is ' + prev + '. ' : '') + 'Steer with the arrow keys or drag your finger. Green platforms are safe, blue ones slide, brown ones crumble — and a spring sends you flying.' }),
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
    t += dt;
    if (state === 'playing' && !paused) {
      // steering: pointer drag wins, otherwise keys
      if (pointerActive) {
        var dx = targetX - player.x;
        player.vx = Math.max(-MOVE_SPEED, Math.min(MOVE_SPEED, dx * 10));
      } else if (keys.left && !keys.right) player.vx = -MOVE_SPEED;
      else if (keys.right && !keys.left) player.vx = MOVE_SPEED;
      else player.vx = 0;
      if (player.vx > 12) player.face = 1;
      else if (player.vx < -12) player.face = -1;
      player.vy += GRAV * dt;
      var prevY = player.y;
      player.x += player.vx * dt;
      player.y += player.vy * dt;
      // wrap around the sides
      if (player.x < -PR) { player.x = W + PR; targetX = player.x; }
      else if (player.x > W + PR) { player.x = -PR; targetX = player.x; }
      // camera follows upward movement only
      var screenY = player.y - cam;
      if (screenY < H * 0.38) cam = player.y - H * 0.38;
      var height = startY - player.y;
      if (height > maxHeight) {
        maxHeight = height;
        score = Math.floor(maxHeight / 10);
        renderHud();
      }
      ensurePlatforms();
      // landing: only while falling, feet crossing a platform top
      if (player.vy > 0) {
        for (var i = 0; i < platforms.length; i++) {
          var p = platforms[i];
          if (p.broken) continue;
          var px = p.type === 'moving' ? p.baseX + Math.sin(t * 1.6 + p.phase) * p.range : p.x;
          px = Math.max(4, Math.min(W - p.w - 4, px));
          var feetPrev = prevY + PR, feetNow = player.y + PR;
          if (feetPrev <= p.y + 8 && feetNow >= p.y && player.x + PR * 0.7 > px && player.x - PR * 0.7 < px + p.w) {
            if (p.type === 'breakable') {
              p.broken = true; p.fallV = 40;
              burst(player.x, p.y, '#B07A45', 8);
              MG.tone(180, 0.12, 'sawtooth', 0.04);
            } else if (p.spring && Math.abs(player.x - (px + p.w / 2)) < p.w / 2) {
              player.y = p.y - PR; player.vy = SPRING_V;
              player.squash = 1; bounceT = 0;
              burst(player.x, p.y, '#FFC22E', 12);
              MG.sfx.bonus(); MG.vibrate(20);
            } else {
              player.y = p.y - PR; player.vy = JUMP_V;
              player.squash = 1; bounceT = 0;
              MG.sfx.tap();
            }
            break;
          }
        }
      }
      // falling below the screen ends the run
      if (player.y - cam > H + 60) { MG.sfx.bad(); finish(); }
      // broken platforms tumble away
      platforms.forEach(function (p) { if (p.broken) { p.fallV += 900 * dt; p.y += p.fallV * dt; } });
      player.squash = Math.max(0, player.squash - dt * 4);
      bounceT += dt;
    }
    for (var j = particles.length - 1; j >= 0; j--) {
      var pt = particles[j];
      pt.t += dt; pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.vy += 500 * dt;
      if (pt.t > 0.7) particles.splice(j, 1);
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
  function drawCloud(x, y, s) {
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    ctx.beginPath();
    ctx.arc(x, y, 26 * s, 0, 6.3);
    ctx.arc(x + 24 * s, y - 10 * s, 20 * s, 0, 6.3);
    ctx.arc(x + 48 * s, y, 24 * s, 0, 6.3);
    ctx.arc(x + 24 * s, y + 8 * s, 22 * s, 0, 6.3);
    ctx.fill();
  }
  function draw() {
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var bgFull = ctx.createLinearGradient(0, oy, 0, oy + ch);
    bgFull.addColorStop(0, '#7EC8F7'); bgFull.addColorStop(0.6, '#A8DCFF'); bgFull.addColorStop(1, '#C9ECFF');
    ctx.fillStyle = bgFull; ctx.fillRect(0, 0, cw, ch);
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * ox, dpr * oy);
    // sky: colour deepens as you climb
    var sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#5FB4F0'); sky.addColorStop(0.55, '#8ED0FA'); sky.addColorStop(1, '#C9ECFF');
    ctx.fillStyle = sky; ctx.fillRect(-30, -30, W + 60, H + 60);
    // sun
    ctx.fillStyle = '#FFD93D';
    ctx.beginPath(); ctx.arc(W - 62, 66, 34, 0, 6.3); ctx.fill();
    ctx.fillStyle = 'rgba(255,217,61,.35)';
    ctx.beginPath(); ctx.arc(W - 62, 66, 48, 0, 6.3); ctx.fill();
    // clouds: deterministic rows scrolling with the camera
    var firstRow = Math.floor((cam - 80) / 260);
    for (var k = firstRow; k < firstRow + 5; k++) {
      var cx = 30 + hash(k * 3 + 1) * (W - 140), cy = k * 260 - cam, cs = 0.7 + hash(k * 3 + 2) * 0.6;
      if (cy > -80 && cy < H + 80) drawCloud(cx, cy, cs);
    }
    // height markers every 500 points of climb
    ctx.font = '800 13px Poppins, "DejaVu Sans", sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    var firstMark = Math.ceil((startY - cam - H) / 500) * 500;
    for (var m = firstMark; m < startY - cam + 100; m += 500) {
      var my = startY - m - cam;
      if (my < 0 || my > H) continue;
      ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 2;
      ctx.setLineDash([8, 8]); ctx.beginPath(); ctx.moveTo(10, my); ctx.lineTo(W - 10, my); ctx.stroke(); ctx.setLineDash([]);
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(20,60,110,.4)';
      ctx.strokeText((m / 10) + ' m', 16, my - 12);
      ctx.fillStyle = 'rgba(255,255,255,.95)';
      ctx.fillText((m / 10) + ' m', 16, my - 12);
    }
    // platforms
    platforms.forEach(function (p) {
      var py = p.y - cam;
      if (py < -40 || py > H + 40) return;
      var px = p.type === 'moving' ? p.baseX + Math.sin(t * 1.6 + p.phase) * p.range : p.x;
      px = Math.max(4, Math.min(W - p.w - 4, px));
      var col = p.type === 'moving' ? '#4F86FF' : p.type === 'breakable' ? '#B07A45' : '#3FAE5A';
      var colD = p.type === 'moving' ? '#2F5FD0' : p.type === 'breakable' ? '#8A5A2E' : '#2B8A44';
      ctx.fillStyle = colD;
      rr(px + 2, py + 4, p.w, 12, 6); ctx.fill();
      ctx.fillStyle = col;
      rr(px, py, p.w, 12, 6); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.45)';
      rr(px + 4, py + 1, p.w - 8, 4, 2); ctx.fill();
      if (p.type === 'breakable') {
        ctx.strokeStyle = 'rgba(90,50,20,.7)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(px + p.w * 0.3, py + 2); ctx.lineTo(px + p.w * 0.42, py + 9);
        ctx.moveTo(px + p.w * 0.62, py + 2); ctx.lineTo(px + p.w * 0.55, py + 10); ctx.stroke();
      }
      if (p.spring) {
        ctx.strokeStyle = '#FF9F1C'; ctx.lineWidth = 4; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(px + p.w / 2 - 10, py); ctx.lineTo(px + p.w / 2 + 10, py - 6);
        ctx.lineTo(px + p.w / 2 - 10, py - 12); ctx.lineTo(px + p.w / 2 + 10, py - 18);
        ctx.stroke();
        ctx.fillStyle = '#E8481C';
        rr(px + p.w / 2 - 13, py - 24, 26, 7, 3); ctx.fill();
      }
    });
    // particles
    particles.forEach(function (pt) {
      ctx.globalAlpha = Math.max(0, 1 - pt.t / 0.7);
      ctx.fillStyle = pt.color;
      ctx.beginPath(); ctx.arc(pt.x, pt.y - cam, pt.r, 0, 6.3); ctx.fill();
    });
    ctx.globalAlpha = 1;
    // player: a round green doodler with big eyes
    var py = player.y - cam;
    if (py > -60 && py < H + 60) {
      var sq = player.squash;
      var rw = PR * (1 + sq * 0.35), rh = PR * (1 - sq * 0.3);
      ctx.save();
      ctx.translate(player.x, py);
      ctx.fillStyle = 'rgba(0,0,0,.18)';
      ctx.beginPath(); ctx.ellipse(0, PR + 8, PR * 0.9, 5, 0, 0, 6.3); ctx.fill();
      var bg = ctx.createRadialGradient(-6, -8, 2, 0, 0, PR + 6);
      bg.addColorStop(0, '#8FE388'); bg.addColorStop(0.6, '#3FAE5A'); bg.addColorStop(1, '#2B8A44');
      ctx.fillStyle = bg;
      ctx.beginPath(); ctx.ellipse(0, 0, rw, rh, 0, 0, 6.3); ctx.fill();
      ctx.strokeStyle = 'rgba(20,90,40,.5)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, 0, rw, rh, 0, 0, 6.3); ctx.stroke();
      // feet
      ctx.fillStyle = '#2B8A44';
      ctx.beginPath(); ctx.ellipse(-8, rh - 2, 7, 4, 0, 0, 6.3); ctx.fill();
      ctx.beginPath(); ctx.ellipse(8, rh - 2, 7, 4, 0, 0, 6.3); ctx.fill();
      // eyes look where you steer
      var ex = player.face * 4;
      [-1, 1].forEach(function (s) {
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(s * 8 + ex, -6, 7, 0, 6.3); ctx.fill();
        ctx.fillStyle = '#171A2B';
        ctx.beginPath(); ctx.arc(s * 8 + ex * 1.6, -6, 3.4, 0, 6.3); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(s * 8 + ex * 1.6 - 1, -7.4, 1.2, 0, 6.3); ctx.fill();
      });
      // smile
      ctx.strokeStyle = '#14522A'; ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(ex, 4, 7, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
      ctx.restore();
    }
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
      ctx.strokeText('Steer left and right —', W / 2, H * 0.58);
      ctx.strokeText('just don\'t look down!', W / 2, H * 0.58 + 30);
      ctx.fillStyle = '#fff';
      ctx.fillText('Steer left and right —', W / 2, H * 0.58);
      ctx.fillText('just don\'t look down!', W / 2, H * 0.58 + 30);
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
    pointerActive = true;
    targetX = pointerToWorld(e);
    if (state === 'idle') start();
  });
  canvas.addEventListener('pointermove', function (e) {
    if (!pointerActive) return;
    targetX = pointerToWorld(e);
  });
  window.addEventListener('pointerup', function () { pointerActive = false; });
  document.addEventListener('keydown', function (e) {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
      e.preventDefault(); keys.left = true;
      if (state === 'idle') start();
    } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
      e.preventDefault(); keys.right = true;
      if (state === 'idle') start();
    } else if (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowUp') {
      e.preventDefault();
      if (state === 'idle') start();
    }
  });
  document.addEventListener('keyup', function (e) {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = false;
    else if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false;
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
      h('p', { class: 'mg-sub', text: 'The doodler is frozen mid-bounce. The sky is waiting.' }),
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
    var play = h('button', { class: 'mg-btn', type: 'button', text: 'Start jumping' });
    play.addEventListener('click', start);
    overlay.innerHTML = '';
    overlay.append(h('div', { class: 'mg-card', role: 'dialog', 'aria-label': 'Doodle Jump' },
      h('div', { class: 'dj-badge', 'aria-hidden': 'true', text: '🐸' }),
      h('h2', { class: 'mg-title', text: 'Doodle Jump' }),
      h('p', { class: 'mg-sub', text: 'Your little doodler bounces on its own — you just steer. Ride the platforms up through the clouds, grab the springs, and see how high you can climb before gravity wins.' + (best ? ' Your best is ' + best + ' points.' : '') }),
      play));
    overlay.hidden = false;
  }

  /* ---------- start ---------- */
  renderSound(); reset(); showStart();
  resize();
  requestAnimationFrame(tick);
  if (o.showcase) { // still frame: mid-climb, springs and sliding platforms in view, score 120
    overlay.hidden = true;
    state = 'playing'; paused = true; // frozen frame
    score = 120; best = Math.max(best, 240); maxHeight = 1200;
    player.x = 210; player.y = 300; player.vy = -300; player.face = 1;
    cam = -260;
    platforms = [
      { x: 60, y: 560, w: 96, type: 'normal', baseX: 60, phase: 0, range: 0, broken: false, fallV: 0, spring: false },
      { x: 300, y: 470, w: 80, type: 'moving', baseX: 300, phase: 0.4, range: 60, broken: false, fallV: 0, spring: false },
      { x: 130, y: 380, w: 90, type: 'normal', baseX: 130, phase: 0, range: 0, broken: false, fallV: 0, spring: true },
      { x: 320, y: 280, w: 76, type: 'breakable', baseX: 320, phase: 0, range: 0, broken: false, fallV: 0, spring: false },
      { x: 90, y: 190, w: 88, type: 'normal', baseX: 90, phase: 0, range: 0, broken: false, fallV: 0, spring: false },
      { x: 290, y: 100, w: 70, type: 'moving', baseX: 290, phase: 1.8, range: 50, broken: false, fallV: 0, spring: false },
    ];
    topY = 100;
    root.classList.add('is-showcase');
    renderHud(); draw();
    setTimeout(function () { document.documentElement.setAttribute('data-ready', '1'); }, 80);
  }
  MG.ready();
})();
