/* Stack engine: a block swings left and right above the tower; tap to drop it.
 * Land it on the tower to grow taller, trim the overhang, and miss once to end.
 * A near-perfect drop snaps into place and keeps the tower full width.
 * Canvas game on a fixed logical world (480 x 640) scaled to fit the stage.
 * Options: { showcase: true } still frame for cover art. */
(function () {
  'use strict';
  var MG = window.MG, h = MG.h, o = window.GAME_OPTIONS || {};

  /* logical world */
  var W = 480, H = 640, BH = 28, GROUND = 40;
  var BASE_W = 240;
  var BASE_SPEED = 150, SPEED_PER_BLOCK = 4, MAX_SPEED = 380;
  var PERFECT = 9; // pixels of slack that still count as a perfect drop
  var RANKS = [[0, '🧱', 'First Brick'], [5, '🏗️', 'Apprentice Builder'], [10, '🏢', 'Tower Builder'],
    [20, '🌆', 'Skyline Maker'], [30, '🏙️', 'Master Stacker'], [40, '👑', 'Stack Champion']];
  var best = +MG.store.get('best', 0) || 0;

  /* ---------- state ---------- */
  var state = 'idle', paused = false; // idle | playing | done
  var blocks = []; // {x, w, hue} bottom to top
  var moving = null; // {x, w, dir, hue}
  var debris = []; // cut-off pieces falling away
  var score = 0, combo = 0, bestCombo = 0, perfects = 0;
  var camY = 0, camTarget = 0, bobT = 0, lastTick = 0;
  var popups = []; // {text, t}
  var clouds = [
    { x: 40, y: 70, s: 1 }, { x: 260, y: 130, s: 0.7 }, { x: 400, y: 50, s: 0.85 }, { x: 180, y: 190, s: 0.6 }
  ];

  /* ---------- DOM ---------- */
  function pill(label, el) { return h('span', { class: 'mg-pill' }, h('small', { text: label }), el); }
  var scoreEl = h('b', { text: '0' }), bestEl = h('b', { text: best ? best : '–' });
  var soundBtn = h('button', { class: 'mg-icon-btn', type: 'button' });
  var pauseBtn = h('button', { class: 'mg-icon-btn', type: 'button', 'aria-label': 'Pause the game' },
    h('span', { html: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1.2"/><rect x="14" y="5" width="4" height="14" rx="1.2"/></svg>' }));
  var canvas = h('canvas', { class: 'st-canvas', role: 'img', 'aria-label': 'Stack game board' });
  var stage = h('div', { class: 'st-stage' }, canvas);
  var overlay = h('div', { class: 'mg-overlay', hidden: true });
  var root = h('div', { class: 'mg-root st' },
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
  function hueFor(n) { return (n * 14) % 360; }
  function renderHud() {
    scoreEl.textContent = score;
    bestEl.textContent = Math.max(best, score) || '–';
  }
  function topY() { return H - GROUND - blocks.length * BH; }
  function updateCam() { camTarget = Math.max(0, (H - GROUND - blocks.length * BH) - 210); }
  function speed() { return Math.min(MAX_SPEED, BASE_SPEED + SPEED_PER_BLOCK * score); }
  function newMoving() {
    var prev = blocks[blocks.length - 1];
    moving = { x: 0, w: prev.w, dir: 1, hue: hueFor(blocks.length) };
  }
  function reset() {
    blocks = [{ x: (W - BASE_W) / 2, w: BASE_W, hue: hueFor(0) }];
    debris = []; popups = [];
    score = 0; combo = 0; bestCombo = 0; perfects = 0;
    camY = 0; camTarget = 0;
    newMoving();
    renderHud();
  }
  function start() {
    reset();
    state = 'playing'; paused = false; overlay.hidden = true;
    MG.event('game_start');
  }
  function drop() {
    if (state !== 'playing' || paused || !moving) return;
    var prev = blocks[blocks.length - 1];
    var m = moving;
    var left = Math.max(m.x, prev.x), right = Math.min(m.x + m.w, prev.x + prev.w);
    if (right <= left) { // missed the tower entirely
      debris.push({ x: m.x, y: topY() - BH, w: m.w, vy: 0, hue: m.hue });
      moving = null;
      MG.sfx.bad(); MG.vibrate(50);
      finish();
      return;
    }
    if (Math.abs(m.x - prev.x) <= PERFECT) { // perfect: snap, keep full width, grow the combo
      blocks.push({ x: prev.x, w: prev.w, hue: m.hue });
      combo++; perfects++; bestCombo = Math.max(bestCombo, combo);
      popups.push({ text: combo > 1 ? 'PERFECT ×' + combo : 'PERFECT!', t: 0 });
      MG.sfx.bonus(); MG.vibrate(10);
    } else { // trimmed: the overhang falls away
      var cutL = left - m.x, cutR = (m.x + m.w) - right;
      if (cutL > 0) debris.push({ x: m.x, y: topY() - BH, w: cutL, vy: 0, hue: m.hue });
      if (cutR > 0) debris.push({ x: right, y: topY() - BH, w: cutR, vy: 0, hue: m.hue });
      blocks.push({ x: left, w: right - left, hue: m.hue });
      combo = 0;
      MG.sfx.place(); MG.vibrate(8);
    }
    score++;
    renderHud();
    updateCam();
    newMoving();
  }
  function finish() {
    state = 'done';
    var prev = best, isBest = score > best;
    if (isBest) { best = score; MG.store.set('best', best); }
    renderHud();
    var r = rank(score);
    var again = h('button', { class: 'mg-btn', type: 'button', text: 'Stack again' });
    again.addEventListener('click', function () { MG.adBreak('next', 'stack-again', start); });
    overlay.innerHTML = '';
    overlay.append(h('div', { class: 'mg-card st-card', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Game over' },
      h('div', { class: 'st-badge', 'aria-hidden': 'true', text: r[1] }),
      h('div', null, h('small', { class: 'mg-label', text: 'Your builder rank' }), h('h2', { class: 'mg-title', text: r[2] })),
      h('div', { class: 'st-score' }, h('span', { class: 'mg-big', text: score }), h('span', { text: score === 1 ? 'block stacked' : 'blocks stacked' })),
      isBest && prev ? h('span', { class: 'mg-badge', text: 'New best!' }) : null,
      h('p', { class: 'mg-sub', text: perfects + (perfects === 1 ? ' perfect drop' : ' perfect drops') + (bestCombo > 1 ? ', best combo ×' + bestCombo : '') + '.' + (prev && !isBest ? ' Your best is ' + prev + '.' : '') }),
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
    if (state === 'idle') {
      bobT += dt;
    } else if (state === 'playing' && !paused) {
      if (moving) {
        moving.x += moving.dir * speed() * dt;
        if (moving.x <= 0) { moving.x = 0; moving.dir = 1; }
        else if (moving.x + moving.w >= W) { moving.x = W - moving.w; moving.dir = -1; }
      }
    }
    // debris falls away
    for (var i = debris.length - 1; i >= 0; i--) {
      var d = debris[i];
      d.vy += 1400 * dt; d.y += d.vy * dt;
      if (d.y > H + 60) debris.splice(i, 1);
    }
    for (var j = popups.length - 1; j >= 0; j--) {
      popups[j].t += dt;
      if (popups[j].t > 0.9) popups.splice(j, 1);
    }
    // camera eases toward the tower top
    camY += (camTarget - camY) * Math.min(1, dt * 5);
    if (Math.abs(camTarget - camY) < 0.5) camY = camTarget;
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
  function drawBlock(x, y, w, hue, alpha) {
    if (w <= 0) return;
    ctx.save();
    if (alpha !== undefined) ctx.globalAlpha = alpha;
    var g = ctx.createLinearGradient(x, y, x, y + BH);
    g.addColorStop(0, 'hsl(' + hue + ', 85%, 66%)');
    g.addColorStop(0.55, 'hsl(' + hue + ', 80%, 56%)');
    g.addColorStop(1, 'hsl(' + hue + ', 78%, 46%)');
    ctx.fillStyle = g;
    rr(x + 1, y, w - 2, BH, 5); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.35)';
    rr(x + 4, y + 2, w - 8, 6, 3); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.14)';
    ctx.fillRect(x + 2, y + BH - 5, w - 4, 3);
    ctx.restore();
  }
  function draw() {
    if (!ctx) return;
    /* The frame is 3:4, exactly the world, but a wider frame (the 4:3 cover) letterboxes:
     * paint the sky and the ground strip across the whole canvas first, in device
     * space, so the bars are a seamless extension of the world. */
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // The ground's screen position moves up as the camera scrolls down with the
    // tower, so the device-space sky/ground split must follow it, or a sliver
    // of sky shows through between the world ground and the device ground.
    var gyScreen = oy + (H - GROUND - camY) * scale;
    var skyFull = ctx.createLinearGradient(0, oy, 0, gyScreen);
    skyFull.addColorStop(0, '#FFE3F1'); skyFull.addColorStop(0.55, '#DCEBFF'); skyFull.addColorStop(1, '#C8F0E8');
    ctx.fillStyle = skyFull; ctx.fillRect(0, 0, cw, ch);
    ctx.fillStyle = '#B7E3A8'; ctx.fillRect(0, gyScreen, cw, ch - gyScreen);
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * ox, dpr * (oy - camY * scale));
    var camTop = camY;
    // sky
    var sky = ctx.createLinearGradient(0, camTop - 30, 0, H - GROUND);
    sky.addColorStop(0, '#FFE3F1'); sky.addColorStop(0.55, '#DCEBFF'); sky.addColorStop(1, '#C8F0E8');
    ctx.fillStyle = sky; ctx.fillRect(-30, camTop - 30, W + 60, H - GROUND - camTop + 60);
    // sun
    ctx.fillStyle = '#FFF3A0';
    ctx.beginPath(); ctx.arc(398, camTop + 78, 34, 0, 6.3); ctx.fill();
    ctx.fillStyle = 'rgba(255,243,160,.35)';
    ctx.beginPath(); ctx.arc(398, camTop + 78, 48, 0, 6.3); ctx.fill();
    // clouds
    ctx.fillStyle = 'rgba(255,255,255,.92)';
    clouds.forEach(function (c) {
      var x = ((c.x + bobT * 4 * c.s) % (W + 220) + W + 220) % (W + 220) - 110;
      var y = camTop + c.y, s = c.s;
      [[0, 0, 42, 17], [-26, 5, 26, 12], [28, 5, 28, 13]].forEach(function (e) {
        ctx.beginPath(); ctx.ellipse(x + e[0] * s, y + e[1] * s, e[2] * s, e[3] * s, 0, 0, 6.3); ctx.fill();
      });
    });
    // ground
    var gy = H - GROUND;
    ctx.fillStyle = '#B7E3A8'; ctx.fillRect(-200, gy, W + 400, GROUND + 200);
    ctx.fillStyle = '#8ED081'; ctx.fillRect(-200, gy, W + 400, 10);
    ctx.fillStyle = 'rgba(0,0,0,.08)';
    ctx.fillRect(-200, gy, W + 400, 2);
    // tower (bottom to top)
    for (var i = 0; i < blocks.length; i++) {
      var b = blocks[i];
      drawBlock(b.x, H - GROUND - (i + 1) * BH, b.w, b.hue);
    }
    // falling cut-off pieces
    debris.forEach(function (d) { drawBlock(d.x, d.y, d.w, d.hue, 0.9); });
    // the swinging block, with a soft guide line down to the tower
    if (moving && state !== 'done') {
      var my = topY() - BH;
      ctx.strokeStyle = 'rgba(23,48,58,.18)';
      ctx.setLineDash([6, 8]); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(moving.x + moving.w / 2, my + BH + 4); ctx.lineTo(moving.x + moving.w / 2, topY()); ctx.stroke();
      ctx.setLineDash([]);
      drawBlock(moving.x, my, moving.w, moving.hue);
    }
    // big score while playing
    if (state === 'playing') {
      ctx.font = '900 56px Poppins, "DejaVu Sans", sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.lineWidth = 8; ctx.strokeStyle = 'rgba(0,0,0,.30)';
      ctx.strokeText(String(score), W / 2, camTop + 26);
      ctx.fillStyle = '#fff';
      ctx.fillText(String(score), W / 2, camTop + 26);
    }
    // perfect popups
    popups.forEach(function (p) {
      var a = 1 - p.t / 0.9;
      ctx.globalAlpha = a;
      ctx.font = '900 30px Poppins, "DejaVu Sans", sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 7; ctx.strokeStyle = 'rgba(0,0,0,.35)';
      var py = topY() - 60 - p.t * 46;
      ctx.strokeText(p.text, W / 2, py);
      ctx.fillStyle = '#FFC22E';
      ctx.fillText(p.text, W / 2, py);
      ctx.globalAlpha = 1;
    });
    if (state === 'idle') {
      ctx.font = '900 26px Poppins, "DejaVu Sans", sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      var pulse = 0.65 + Math.sin(bobT * 4) * 0.35;
      ctx.globalAlpha = pulse;
      ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,.35)';
      ctx.strokeText('Tap to drop the block!', W / 2, camTop + H * 0.62);
      ctx.fillStyle = '#fff';
      ctx.fillText('Tap to drop the block!', W / 2, camTop + H * 0.62);
      ctx.globalAlpha = 1;
    }
  }

  /* ---------- input ---------- */
  canvas.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    if (state === 'idle') start();
    else drop();
  });
  document.addEventListener('keydown', function (e) {
    if (e.code === 'Space' || e.code === 'ArrowDown' || e.code === 'Enter') {
      e.preventDefault();
      if (state === 'idle') start();
      else drop();
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
      h('p', { class: 'mg-sub', text: 'The block is hovering mid-air. The tower is waiting.' }),
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
    var play = h('button', { class: 'mg-btn', type: 'button', text: 'Start stacking' });
    play.addEventListener('click', start);
    overlay.innerHTML = '';
    overlay.append(h('div', { class: 'mg-card', role: 'dialog', 'aria-label': 'Stack' },
      h('div', { class: 'st-badge', 'aria-hidden': 'true', text: '🧱' }),
      h('h2', { class: 'mg-title', text: 'Stack' }),
      h('p', { class: 'mg-sub', text: 'A block swings above the tower. Tap to drop it exactly on top. A perfect drop keeps your tower wide — one miss and the tower falls.' + (best ? ' Your best is ' + best + ' blocks.' : '') }),
      play));
    overlay.hidden = false;
  }

  /* ---------- start ---------- */
  renderSound(); reset(); showStart();
  resize();
  requestAnimationFrame(tick);
  if (o.showcase) { // still frame: a tall rainbow tower, one block mid-swing, score 9
    overlay.hidden = true;
    state = 'playing'; paused = true; // frozen frame
    score = 9; best = Math.max(best, 14);
    blocks = [];
    var bw = BASE_W;
    for (var i = 0; i < 9; i++) {
      blocks.push({ x: (W - bw) / 2 + (i % 2 ? 8 : -6) * (i > 5 ? 1 : 0), w: bw, hue: hueFor(i) });
      bw = Math.max(150, bw - 6);
    }
    blocks[8].w = 168;
    moving = { x: 120, w: 168, dir: 1, hue: hueFor(9) };
    updateCam(); camY = camTarget;
    root.classList.add('is-showcase');
    renderHud(); draw();
    setTimeout(function () { document.documentElement.setAttribute('data-ready', '1'); }, 80);
  }
  MG.ready();
})();
