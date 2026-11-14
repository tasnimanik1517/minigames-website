/* Space Invaders engine: move the cannon, shoot the descending aliens, don't let them land.
 * Canvas game on a fixed logical world (480 x 640) scaled to fit the stage.
 * Options: { showcase: true } still frame for cover art. */
(function () {
  'use strict';
  var MG = window.MG, h = MG.h, o = window.GAME_OPTIONS || {};

  /* logical world */
  var W = 480, H = 640;
  var SHIP_W = 46, SHIP_H = 28, SHIP_Y = H - 64, SHIP_SPEED = 340;
  var BULLET_W = 4, BULLET_H = 14, BULLET_SPEED = 540, BULLET_MAX = 3, FIRE_CD = 240;
  var COLS = 8, ROWS = 5, CELL_W = 52, CELL_H = 40, GRID_TOP = 100, GRID_LEFT = 34;
  var PX = 3; // pixel size of the invader sprites
  var LIVES = 3;
  var ROW_POINTS = [30, 20, 20, 10, 10];
  var RANKS = [[0, '🚀', 'First Shot'], [100, '👾', 'Invader Hunter'], [300, '🛡️', 'Earth Defender'],
    [600, '🏆', 'Space Ace'], [1000, '💎', 'Galaxy Guardian'], [1500, '👑', 'Invader Champion']];
  var best = +MG.store.get('best', 0) || 0;

  /* pixel sprites: two frames each, legs alternate on every step */
  var SPRITES = [
    { name: 'squid', color: '#FF5A8A', w: 8, a: [
      '...XX...',
      '..XXXX..',
      '.XXXXXX.',
      'XX.XX.XX',
      'XXXXXXXX',
      '..X..X..',
      '.X.XX.X.',
      'X.X..X.X'], b: [
      '...XX...',
      '..XXXX..',
      '.XXXXXX.',
      'XX.XX.XX',
      'XXXXXXXX',
      '..X..X..',
      '.X.XX.X.',
      '..X..X..'] },
    { name: 'crab', color: '#5CE65C', w: 11, a: [
      '..X.....X..',
      '...X...X...',
      '..XXXXXXX..',
      '.XX.XXX.XX.',
      'XXXXXXXXXXX',
      'X.XXXXXXX.X',
      'X.X.....X.X',
      '...XX.XX...'], b: [
      '..X.....X..',
      '...X...X...',
      '..XXXXXXX..',
      '.XX.XXX.XX.',
      'XXXXXXXXXXX',
      'X.XXXXXXX.X',
      '..X.....X..',
      '.X.......X.'] },
    { name: 'octopus', color: '#4EC0CA', w: 12, a: [
      '....XXXX....',
      '.XXXXXXXXXX.',
      'XXXXXXXXXXXX',
      'XXX..XX..XXX',
      'XXXXXXXXXXXX',
      '...XX..XX...',
      '..XX.XX.XX..',
      'XX........XX'], b: [
      '....XXXX....',
      '.XXXXXXXXXX.',
      'XXXXXXXXXXXX',
      'XXX..XX..XXX',
      'XXXXXXXXXXXX',
      '...XX..XX...',
      '..XX.XX.XX..',
      '.XX......XX.'] }
  ];
  function spriteFor(row) { return row === 0 ? SPRITES[0] : row <= 2 ? SPRITES[1] : SPRITES[2]; }

  /* ---------- state ---------- */
  var state = 'idle', paused = false; // idle | playing | done
  var shipX = W / 2, shipTarget = W / 2, invuln = 0, lastShot = 0;
  var aliens = []; // {col, row, x, y, alive}
  var group = { ox: 0, oy: 0, dir: 1, step: 0, frame: 0 };
  var bullets = [], alienBullets = [], parts = [], popups = [];
  var ufo = null, ufoTimer = 16000;
  var waveFreeze = 0;
  var score = 0, wave = 1, lives = LIVES, kills = 0;
  var bobT = 0, lastTick = 0;
  var stars = [];
  (function () { var s = 1234567; function rnd() { s = (s * 16807) % 2147483647; return s / 2147483647; }
    for (var i = 0; i < 70; i++) stars.push({ x: rnd() * W, y: rnd() * H, r: 0.6 + rnd() * 1.4, tw: rnd() * 6.28 }); })();

  /* ---------- DOM ---------- */
  function pill(label, el) { return h('span', { class: 'mg-pill' }, h('small', { text: label }), el); }
  var scoreEl = h('b', { text: '0' }), bestEl = h('b', { text: best ? best : '–' });
  var livesEl = h('b', { text: '●●●' }), waveEl = h('b', { text: '1' });
  var soundBtn = h('button', { class: 'mg-icon-btn', type: 'button' });
  var pauseBtn = h('button', { class: 'mg-icon-btn', type: 'button', 'aria-label': 'Pause the game' },
    h('span', { html: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1.2"/><rect x="14" y="5" width="4" height="14" rx="1.2"/></svg>' }));
  var canvas = h('canvas', { class: 'iv-canvas', role: 'img', 'aria-label': 'Space Invaders game board' });
  var fireBtn = h('button', { class: 'iv-fire', type: 'button', 'aria-label': 'Fire' }, h('span', { 'aria-hidden': 'true', text: 'FIRE' }));
  var stage = h('div', { class: 'iv-stage' }, canvas, fireBtn);
  var overlay = h('div', { class: 'mg-overlay', hidden: true });
  var root = h('div', { class: 'mg-root iv' },
    h('div', { class: 'mg-hud' }, pill('Score', scoreEl), pill('Lives', livesEl), pill('Wave', waveEl), pill('Best', bestEl),
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
    waveEl.textContent = wave;
  }
  function aliveCount() { var n = 0; aliens.forEach(function (a) { if (a.alive) n++; }); return n; }
  function buildAliens() {
    aliens = [];
    for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) aliens.push({ col: c, row: r, alive: true });
    group.ox = 0; group.oy = 0; group.dir = 1; group.step = 0; group.frame = 0;
  }
  function alienPos(a) {
    var sp = spriteFor(a.row);
    return { x: GRID_LEFT + a.col * CELL_W + group.ox + (CELL_W - sp.w * PX) / 2,
      y: GRID_TOP + a.row * CELL_H + group.oy, w: sp.w * PX, h: 8 * PX };
  }
  function stepInterval() {
    var alive = aliveCount(), total = COLS * ROWS;
    return Math.max(120, Math.min(750, 750 * (alive / total) * Math.pow(0.9, wave - 1)));
  }
  function fireInterval() { return Math.max(550, 1500 - (wave - 1) * 120); }
  function reset() {
    score = 0; wave = 1; lives = LIVES; kills = 0; invuln = 0;
    shipX = W / 2; shipTarget = W / 2;
    bullets = []; alienBullets = []; parts = []; popups = [];
    ufo = null; ufoTimer = 14000 + Math.random() * 8000; waveFreeze = 0;
    buildAliens();
    renderHud();
  }
  function start() {
    reset();
    state = 'playing'; paused = false; overlay.hidden = true;
    MG.event('game_start');
  }
  function fire() {
    if (state !== 'playing' || paused) return;
    var now = performance.now();
    if (now - lastShot < FIRE_CD || bullets.length >= BULLET_MAX) return;
    lastShot = now;
    bullets.push({ x: shipX - BULLET_W / 2, y: SHIP_Y - BULLET_H - 2, vy: -BULLET_SPEED });
    MG.sfx.tap();
  }
  function alienFire() {
    if (alienBullets.length >= 4) return;
    var cols = [];
    for (var c = 0; c < COLS; c++) {
      var bottom = null;
      aliens.forEach(function (a) { if (a.alive && a.col === c && (!bottom || a.row > bottom.row)) bottom = a; });
      if (bottom) cols.push(bottom);
    }
    if (!cols.length) return;
    var a = cols[(Math.random() * cols.length) | 0], p = alienPos(a);
    alienBullets.push({ x: p.x + p.w / 2 - 2, y: p.y + p.h + 2, vy: 230 + wave * 12, w: 4, h: 12 });
    MG.tone(180, 0.06, 'square', 0.025, 140);
  }
  function explode(x, y, color) {
    for (var i = 0; i < 10; i++) parts.push({ x: x, y: y, vx: (Math.random() - 0.5) * 260, vy: (Math.random() - 0.5) * 260 - 40, t: 0, c: color });
  }
  function loseLife() {
    lives--;
    renderHud();
    alienBullets = [];
    MG.sfx.bad(); MG.vibrate(60);
    explode(shipX, SHIP_Y + SHIP_H / 2, '#7CFF6B');
    if (lives <= 0) { finish(false); return; }
    invuln = 1.6;
    shipX = W / 2; shipTarget = W / 2;
  }
  function nextWave() {
    wave++;
    score += 100;
    popups.push({ text: 'Wave ' + wave + '  ·  +100 bonus', x: W / 2, y: H * 0.42, t: 0 });
    buildAliens();
    waveFreeze = 1.0;
    renderHud();
    MG.sfx.win();
  }
  function finish(landed) {
    state = 'done';
    var prev = best, isBest = score > best;
    if (isBest) { best = score; MG.store.set('best', best); }
    renderHud();
    var r = rank(score);
    var again = h('button', { class: 'mg-btn', type: 'button', text: 'Defend again' });
    again.addEventListener('click', function () { MG.adBreak('next', 'invaders-again', start); });
    overlay.innerHTML = '';
    overlay.append(h('div', { class: 'mg-card iv-card', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Game over' },
      h('div', { class: 'iv-badge', 'aria-hidden': 'true', text: r[1] }),
      h('div', null, h('small', { class: 'mg-label', text: 'Your defender rank' }), h('h2', { class: 'mg-title', text: r[2] })),
      h('div', { class: 'iv-score' }, h('span', { class: 'mg-big', text: score }), h('span', { text: 'points · ' + kills + ' invaders shot down · wave ' + wave })),
      isBest && prev ? h('span', { class: 'mg-badge', text: 'New best!' }) : null,
      h('p', { class: 'mg-sub', text: (landed ? 'The invaders landed. ' : '') + (prev && !isBest ? 'Your best is ' + prev + '. ' : '') + 'Clear a wave to earn a bonus and face a faster one.' }),
      h('div', { class: 'mg-row' }, again)));
    overlay.hidden = false;
    MG.focusSafe(again, 700);
    if (isBest && prev) { MG.confetti(120); MG.sfx.win(); }
    else if (score >= 300) MG.sfx.good(); else MG.sfx.lose();
    MG.event('game_over', { score: score, wave: wave });
  }

  /* ---------- update ---------- */
  function rectHit(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }
  function tick(now) {
    requestAnimationFrame(tick);
    var dt = Math.min(0.05, Math.max(0, (now - (lastTick || now)) / 1000));
    lastTick = now;
    bobT += dt;
    if (state === 'playing' && !paused) {
      if (invuln > 0) invuln -= dt;
      if (waveFreeze > 0) waveFreeze -= dt;
      // ship eases toward its target
      var dx = shipTarget - shipX;
      var step = SHIP_SPEED * dt;
      shipX += Math.max(-step, Math.min(step, dx));
      shipX = Math.max(SHIP_W / 2, Math.min(W - SHIP_W / 2, shipX));
      // player bullets
      for (var i = bullets.length - 1; i >= 0; i--) {
        var b = bullets[i];
        b.y += b.vy * dt;
        if (b.y < -20) { bullets.splice(i, 1); continue; }
        var hit = false;
        if (ufo && rectHit(b.x, b.y, BULLET_W, BULLET_H, ufo.x, ufo.y, ufo.w, ufo.h)) {
          score += 100; kills++;
          popups.push({ text: '+100', x: ufo.x + ufo.w / 2, y: ufo.y + 20, t: 0 });
          explode(ufo.x + ufo.w / 2, ufo.y + ufo.h / 2, '#FF5A4F');
          ufo = null; hit = true; MG.sfx.bonus();
        }
        if (!hit) for (var j = 0; j < aliens.length; j++) {
          var a = aliens[j]; if (!a.alive) continue;
          var p = alienPos(a);
          if (rectHit(b.x, b.y, BULLET_W, BULLET_H, p.x, p.y, p.w, p.h)) {
            a.alive = false; hit = true; kills++;
            var pts = ROW_POINTS[a.row];
            score += pts;
            popups.push({ text: '+' + pts, x: p.x + p.w / 2, y: p.y + 8, t: 0 });
            explode(p.x + p.w / 2, p.y + p.h / 2, spriteFor(a.row).color);
            renderHud();
            MG.sfx.eat();
            break;
          }
        }
        if (hit) { bullets.splice(i, 1); continue; }
        // bullets cancel each other out
        for (var k = alienBullets.length - 1; k >= 0; k--) {
          var ab = alienBullets[k];
          if (rectHit(b.x, b.y, BULLET_W, BULLET_H, ab.x, ab.y, ab.w, ab.h)) {
            alienBullets.splice(k, 1); bullets.splice(i, 1); hit = true;
            MG.tone(500, 0.05, 'square', 0.03);
            break;
          }
        }
        if (hit) continue;
      }
      // alien bullets
      for (var m = alienBullets.length - 1; m >= 0; m--) {
        var ab2 = alienBullets[m];
        ab2.y += ab2.vy * dt;
        if (ab2.y > H) { alienBullets.splice(m, 1); continue; }
        if (invuln <= 0 && rectHit(ab2.x, ab2.y, ab2.w, ab2.h, shipX - SHIP_W / 2, SHIP_Y, SHIP_W, SHIP_H)) {
          alienBullets.splice(m, 1);
          loseLife();
          if (state !== 'playing') break;
        }
      }
      // alien stepping
      if (waveFreeze <= 0 && aliveCount() > 0) {
        group.step += dt * 1000;
        if (group.step >= stepInterval()) {
          group.step = 0;
          group.frame = 1 - group.frame;
          var edge = false;
          aliens.forEach(function (a) {
            if (!a.alive) return;
            var p2 = alienPos(a);
            if ((group.dir > 0 && p2.x + p2.w + 10 > W - 14) || (group.dir < 0 && p2.x - 10 < 14)) edge = true;
          });
          if (edge) { group.oy += 18; group.dir *= -1; MG.tone(140, 0.05, 'square', 0.02, 90); }
          else { group.ox += group.dir * 10; MG.tone(110 + (group.frame ? 20 : 0), 0.04, 'square', 0.02); }
          // landed?
          var landed = false;
          aliens.forEach(function (a) { if (a.alive && alienPos(a).y + 24 >= SHIP_Y - 4) landed = true; });
          if (landed) { finish(true); }
        }
        // alien fire timer
        ufoTimer -= dt * 1000;
        if (ufoTimer <= 0 && !ufo) {
          ufo = { x: Math.random() < 0.5 ? -60 : W + 10, y: 52, w: 52, h: 22, vx: (Math.random() < 0.5 ? 1 : -1) * 130 };
          ufoTimer = 16000 + Math.random() * 10000;
        }
      }
      if (ufo) {
        ufo.x += ufo.vx * dt;
        if (ufo.x < -80 || ufo.x > W + 30) ufo = null;
      }
      if (state === 'playing' && aliveCount() === 0) nextWave();
      else if (state === 'playing' && waveFreeze <= 0) {
        group.fireT = (group.fireT || 0) + dt * 1000;
        if (group.fireT >= fireInterval()) { group.fireT = 0; alienFire(); }
      }
    }
    for (var q = parts.length - 1; q >= 0; q--) {
      parts[q].t += dt;
      parts[q].x += parts[q].vx * dt; parts[q].y += parts[q].vy * dt; parts[q].vy += 300 * dt;
      if (parts[q].t > 0.45) parts.splice(q, 1);
    }
    for (var s2 = popups.length - 1; s2 >= 0; s2--) {
      popups[s2].t += dt;
      if (popups[s2].t > 0.9) popups.splice(s2, 1);
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
  function drawSprite(sp, frame, x, y) {
    var rows = frame ? sp.b : sp.a;
    ctx.fillStyle = sp.color;
    for (var r = 0; r < rows.length; r++) {
      var row = rows[r];
      for (var c = 0; c < row.length; c++) if (row[c] === 'X') ctx.fillRect(x + c * PX, y + r * PX, PX, PX);
    }
  }
  function draw() {
    if (!ctx) return;
    /* The frame is 3:4, exactly the world, but a wider frame (the 4:3 cover) letterboxes:
     * paint the background across the whole canvas first, in device space. */
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var bgFull = ctx.createLinearGradient(0, oy, 0, oy + ch);
    bgFull.addColorStop(0, '#0B1026'); bgFull.addColorStop(0.6, '#1B1440'); bgFull.addColorStop(1, '#0B1026');
    ctx.fillStyle = bgFull; ctx.fillRect(0, 0, cw, ch);
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * ox, dpr * oy);
    // background: deep space with twinkling stars
    var bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0B1026'); bg.addColorStop(0.6, '#1B1440'); bg.addColorStop(1, '#0B1026');
    ctx.fillStyle = bg; ctx.fillRect(-30, -30, W + 60, H + 60);
    stars.forEach(function (s) {
      ctx.globalAlpha = 0.35 + 0.35 * Math.sin(bobT * 1.5 + s.tw);
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.3); ctx.fill();
    });
    ctx.globalAlpha = 1;
    // ground line
    ctx.fillStyle = '#1FA84F';
    ctx.fillRect(0, H - 24, W, 3);
    ctx.fillStyle = 'rgba(31,168,79,.25)';
    ctx.fillRect(0, H - 21, W, 10);
    // wave label
    ctx.font = '800 15px Poppins, "DejaVu Sans", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(255,255,255,.65)';
    ctx.fillText('WAVE ' + wave, W / 2, 52);
    // UFO
    if (ufo) {
      ctx.fillStyle = '#FF5A4F';
      ctx.beginPath(); ctx.ellipse(ufo.x + ufo.w / 2, ufo.y + 14, 26, 9, 0, 0, 6.3); ctx.fill();
      ctx.fillStyle = '#FF8A7A';
      ctx.beginPath(); ctx.arc(ufo.x + ufo.w / 2, ufo.y + 9, 11, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#FFE066';
      [ufo.x + 8, ufo.x + 26, ufo.x + 44].forEach(function (lx) { ctx.beginPath(); ctx.arc(lx, ufo.y + 15, 2.6, 0, 6.3); ctx.fill(); });
    }
    // aliens
    aliens.forEach(function (a) {
      if (!a.alive) return;
      var p = alienPos(a), sp = spriteFor(a.row);
      ctx.shadowColor = sp.color; ctx.shadowBlur = 8;
      drawSprite(sp, group.frame, p.x, p.y);
      ctx.shadowBlur = 0;
    });
    // ship (blinks while invulnerable)
    if (state !== 'done' && !(invuln > 0 && Math.floor(bobT * 12) % 2 === 0)) {
      var sx = shipX - SHIP_W / 2;
      ctx.fillStyle = '#7CFF6B';
      ctx.shadowColor = 'rgba(124,255,107,.8)'; ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(sx + SHIP_W / 2 - 4, SHIP_Y);
      ctx.lineTo(sx + SHIP_W / 2 + 4, SHIP_Y);
      ctx.lineTo(sx + SHIP_W / 2 + 4, SHIP_Y + 8);
      ctx.lineTo(sx + SHIP_W - 2, SHIP_Y + 8);
      ctx.lineTo(sx + SHIP_W, SHIP_Y + SHIP_H - 4);
      ctx.lineTo(sx + SHIP_W - 6, SHIP_Y + SHIP_H);
      ctx.lineTo(sx + 6, SHIP_Y + SHIP_H);
      ctx.lineTo(sx, SHIP_Y + SHIP_H - 4);
      ctx.lineTo(sx + 2, SHIP_Y + 8);
      ctx.closePath(); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#E8FFD8';
      ctx.fillRect(sx + SHIP_W / 2 - 5, SHIP_Y + 10, 10, 8);
      ctx.fillStyle = '#FF5A4F';
      ctx.fillRect(sx + 4, SHIP_Y + SHIP_H - 6, 8, 4);
      ctx.fillRect(sx + SHIP_W - 12, SHIP_Y + SHIP_H - 6, 8, 4);
    }
    // player bullets
    bullets.forEach(function (b) {
      ctx.fillStyle = '#FFE066';
      ctx.shadowColor = 'rgba(255,224,102,.9)'; ctx.shadowBlur = 8;
      rr(b.x, b.y, BULLET_W, BULLET_H, 2); ctx.fill();
      ctx.shadowBlur = 0;
    });
    // alien bullets
    alienBullets.forEach(function (ab) {
      ctx.fillStyle = '#FF8A5C';
      ctx.shadowColor = 'rgba(255,138,92,.8)'; ctx.shadowBlur = 6;
      rr(ab.x, ab.y, ab.w, ab.h, 2); ctx.fill();
      ctx.shadowBlur = 0;
    });
    // explosion particles
    parts.forEach(function (p) {
      ctx.globalAlpha = Math.max(0, 1 - p.t / 0.45);
      ctx.fillStyle = p.c;
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    });
    ctx.globalAlpha = 1;
    // big score while playing
    if (state === 'playing') {
      ctx.font = '900 44px Poppins, "DejaVu Sans", sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.lineWidth = 7; ctx.strokeStyle = 'rgba(0,0,0,.35)';
      ctx.strokeText(String(score), W / 2, H * 0.42);
      ctx.fillStyle = 'rgba(255,255,255,.92)';
      ctx.fillText(String(score), W / 2, H * 0.42);
    }
    // popups (+points, wave bonus)
    popups.forEach(function (p) {
      var a = 1 - p.t / 0.9;
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
      ctx.font = '900 22px Poppins, "DejaVu Sans", sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      var pulse = 0.65 + Math.sin(bobT * 4) * 0.35;
      ctx.globalAlpha = pulse;
      ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,.4)';
      ctx.strokeText('Drag or use ← → to move.', W / 2, H * 0.58);
      ctx.strokeText('Space or FIRE to shoot!', W / 2, H * 0.58 + 30);
      ctx.fillStyle = '#fff';
      ctx.fillText('Drag or use ← → to move.', W / 2, H * 0.58);
      ctx.fillText('Space or FIRE to shoot!', W / 2, H * 0.58 + 30);
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
    shipTarget = Math.max(SHIP_W / 2, Math.min(W - SHIP_W / 2, pointerToWorld(e)));
    if (state === 'idle') start();
  });
  canvas.addEventListener('pointermove', function (e) {
    if (e.buttons === 0 && e.pointerType === 'mouse') return; // mouse steers only while held
    shipTarget = Math.max(SHIP_W / 2, Math.min(W - SHIP_W / 2, pointerToWorld(e)));
  });
  fireBtn.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    if (state === 'idle') { start(); return; }
    fire();
  });
  document.addEventListener('keydown', function (e) {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
      e.preventDefault();
      shipTarget = Math.max(SHIP_W / 2, shipTarget - 34);
      if (state === 'idle') start();
    } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
      e.preventDefault();
      shipTarget = Math.min(W - SHIP_W / 2, shipTarget + 34);
      if (state === 'idle') start();
    } else if (e.code === 'Space') {
      e.preventDefault();
      if (state === 'idle') start();
      else fire();
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
      h('p', { class: 'mg-sub', text: 'The invaders are frozen mid-descent. The cannon is waiting.' }),
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
    var play = h('button', { class: 'mg-btn', type: 'button', text: 'Start defending' });
    play.addEventListener('click', function () { play.blur(); start(); });
    overlay.innerHTML = '';
    overlay.append(h('div', { class: 'mg-card', role: 'dialog', 'aria-label': 'Space Invaders' },
      h('div', { class: 'iv-badge', 'aria-hidden': 'true', text: '👾' }),
      h('h2', { class: 'mg-title', text: 'Space Invaders' }),
      h('p', { class: 'mg-sub', text: 'The invaders are descending. Move your cannon, shoot them all, and don’t let them land. You have three lives — clear a wave and the next one comes faster.' + (best ? ' Your best is ' + best + ' points.' : '') }),
      play));
    overlay.hidden = false;
  }

  /* ---------- start ---------- */
  renderSound(); reset(); showStart();
  resize();
  requestAnimationFrame(tick);
  if (o.showcase) { // still frame: a wave half cleared, a bullet mid-flight, score 80
    overlay.hidden = true;
    state = 'playing'; paused = true; // frozen frame
    score = 80; best = Math.max(best, 240); wave = 1; lives = 3; kills = 4;
    shipX = 240; shipTarget = 240;
    bullets = [{ x: 238, y: 300, vy: -BULLET_SPEED }];
    aliens.forEach(function (a) {
      if (a.row >= 3) a.alive = (a.col % 2 === 0);
      else if (a.row === 2) a.alive = (a.col % 3 !== 0);
    });
    group.ox = 20; group.oy = 10;
    ufo = { x: 300, y: 52, w: 52, h: 22, vx: 130 };
    root.classList.add('is-showcase');
    renderHud(); draw();
    setTimeout(function () { document.documentElement.setAttribute('data-ready', '1'); }, 80);
  }
  MG.ready();
})();
