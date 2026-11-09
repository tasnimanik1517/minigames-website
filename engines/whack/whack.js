/* Whack-a-Mole engine: nine holes, 30 seconds, moles that pop up faster and faster.
 * Tap a mole to score, tap an empty hole and it only counts as a miss.
 * Options: { showcase: true } still frame for cover art. */
(function () {
  'use strict';
  var MG = window.MG, h = MG.h, o = window.GAME_OPTIONS || {};

  var ROUND = 30000, HOLES = 9, TWO_AT = 12000;
  var RANKS = [[0, '🌱', 'Seedling'], [10, '🐾', 'Mole Spotter'], [15, '🔨', 'Handy Whacker'],
    [20, '⚡', 'Quick Hands'], [25, '🏆', 'Mole Master'], [30, '👑', 'Whack-a-Mole Champion']];
  var best = +MG.store.get('best', 0) || 0;

  /* ---------- state ---------- */
  var state = 'idle', paused = false;
  var score = 0, hits = 0, misses = 0, escaped = 0;
  var gameTime = 0, nextSpawn = 0, lastTick = 0, lastSecond = -1;
  var moles = {}; // hole index -> gameTime when it ducks back down

  /* ---------- DOM ---------- */
  function pill(label, el) { return h('span', { class: 'mg-pill' }, h('small', { text: label }), el); }
  var scoreEl = h('b'), timeEl = h('b'), bestEl = h('b');
  var soundBtn = h('button', { class: 'mg-icon-btn', type: 'button' });
  var pauseBtn = h('button', { class: 'mg-icon-btn', type: 'button', 'aria-label': 'Pause the round' },
    h('span', { html: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1.2"/><rect x="14" y="5" width="4" height="14" rx="1.2"/></svg>' }));
  var msg = h('div', { class: 'wk-msg', 'aria-live': 'polite', text: 'Whack the moles!' });
  var board = h('div', { class: 'wk-board', role: 'group', 'aria-label': 'Nine mole holes' });
  var holeEls = [];
  for (var i = 0; i < HOLES; i++) {
    var mole = h('span', { class: 'wk-mole', 'aria-hidden': 'true' },
      h('span', { class: 'wk-ear is-l' }), h('span', { class: 'wk-ear is-r' }),
      h('span', { class: 'wk-eye is-l' }), h('span', { class: 'wk-eye is-r' }),
      h('span', { class: 'wk-nose' }), h('span', { class: 'wk-tooth' }));
    var hole = h('button', { class: 'wk-hole', type: 'button', 'aria-label': 'Hole ' + (i + 1) },
      h('span', { class: 'wk-burrow' }, mole), h('span', { class: 'wk-pit', 'aria-hidden': 'true' }), h('span', { class: 'wk-lip', 'aria-hidden': 'true' }));
    hole.addEventListener('pointerdown', onHole.bind(null, i, hole));
    holeEls.push(hole); board.append(hole);
  }
  var overlay = h('div', { class: 'mg-overlay', hidden: true });
  var root = h('div', { class: 'mg-root wk' },
    h('div', { class: 'mg-hud' }, pill('Score', scoreEl), pill('Time', timeEl), pill('Best', bestEl),
      h('span', { class: 'mg-spacer' }), pauseBtn, soundBtn),
    h('div', { class: 'wk-main' }, msg, board), overlay);
  document.getElementById('game').append(root);

  /* ---------- helpers ---------- */
  function rank(s) { var r = RANKS[0]; RANKS.forEach(function (x) { if (s >= x[0]) r = x; }); return r; }
  function upTime() { // how long a mole stays up: about 950 ms at the start, under 500 ms by the end
    return 950 - 470 * Math.min(1, gameTime / ROUND) + (Math.random() * 140 - 70);
  }
  function renderHud() {
    scoreEl.textContent = score;
    bestEl.textContent = best ? best : '–';
    timeEl.textContent = Math.max(0, Math.ceil((ROUND - gameTime) / 1000));
  }
  function setMole(i, up) { holeEls[i].classList.toggle('is-up', up); if (!up) holeEls[i].classList.remove('is-bonked'); }

  /* ---------- the round ---------- */
  function start() {
    score = 0; hits = 0; misses = 0; escaped = 0;
    gameTime = 0; nextSpawn = 0; lastSecond = -1; moles = {};
    for (var i = 0; i < HOLES; i++) setMole(i, false);
    state = 'playing'; paused = false; overlay.hidden = true;
    msg.textContent = 'Whack the moles!';
    renderHud();
  }
  function spawn() {
    var free = [];
    for (var i = 0; i < HOLES; i++) if (!(i in moles)) free.push(i);
    if (!free.length) return;
    var i = free[Math.floor(Math.random() * free.length)], up = upTime();
    moles[i] = gameTime + up;
    setMole(i, true);
    nextSpawn = gameTime + up + 110 + Math.random() * 150;
  }
  function tick(now) {
    requestAnimationFrame(tick);
    var dt = Math.min(50, Math.max(0, now - (lastTick || now)));
    lastTick = now;
    if (state !== 'playing' || paused) return;
    gameTime += dt;
    for (var k in moles) if (gameTime >= moles[k]) { delete moles[k]; setMole(+k, false); escaped++; }
    var maxActive = gameTime < TWO_AT ? 1 : 2, active = Object.keys(moles).length;
    if (active < maxActive && gameTime >= nextSpawn) spawn();
    var sec = Math.ceil(Math.max(0, ROUND - gameTime) / 1000);
    if (sec !== lastSecond) {
      lastSecond = sec; renderHud();
      timeEl.parentNode.classList.toggle('is-low', sec <= 5 && sec > 0);
      if (sec <= 3 && sec > 0) MG.tone(660, 0.06, 'square', 0.03);
    }
    if (gameTime >= ROUND) finish();
  }
  function onHole(i, hole, e) {
    if (e.button > 0) return;
    e.preventDefault();
    if (state !== 'playing' || paused) return;
    if (i in moles) { // whacked
      delete moles[i];
      score++; hits++;
      hole.classList.add('is-bonked');
      var pop = h('span', { class: 'wk-pop', text: '+1', 'aria-hidden': 'true' });
      hole.append(pop);
      setTimeout(function () { pop.remove(); }, 550);
      setTimeout(function () { setMole(i, false); }, 130);
      MG.sfx.eat(); MG.vibrate(12);
      msg.textContent = score === 1 ? 'Got one!' : score + ' moles whacked';
    } else { // an empty hole: nothing bad happens, it just counts as a miss
      misses++;
      hole.classList.remove('is-miss'); void hole.offsetWidth; hole.classList.add('is-miss');
      MG.tone(180, 0.07, 'triangle', 0.04, 120);
    }
    renderHud();
  }
  function finish() {
    state = 'done';
    for (var k in moles) setMole(+k, false);
    moles = {};
    renderHud();
    var prev = best, isBest = score > best;
    if (isBest) { best = score; MG.store.set('best', best); renderHud(); }
    var r = rank(score), tries = hits + misses;
    var acc = tries ? Math.round(hits / tries * 100) : 100;
    var again = h('button', { class: 'mg-btn', type: 'button', text: 'Play again' });
    again.addEventListener('click', function () { MG.adBreak('next', 'whack-again', start); });
    overlay.innerHTML = '';
    overlay.append(h('div', { class: 'mg-card wk-card', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Your result' },
      h('div', { class: 'wk-badge', 'aria-hidden': 'true', text: r[1] }),
      h('div', null, h('small', { class: 'mg-label', text: 'Your whacking badge' }), h('h2', { class: 'mg-title', text: r[2] })),
      h('div', { class: 'wk-score' }, h('span', { class: 'mg-big', text: score }), h('span', { text: 'moles in 30 seconds' })),
      isBest && prev ? h('span', { class: 'mg-badge', text: 'New best!' }) : null,
      h('p', { class: 'mg-sub', text: 'Accuracy ' + acc + '% · ' + escaped + (escaped === 1 ? ' mole' : ' moles') + ' got away.' + (prev && !isBest ? ' Your best is ' + prev + '.' : '') }),
      h('div', { class: 'mg-row' }, again)));
    overlay.hidden = false;
    MG.focusSafe(again, 700);
    if (isBest && prev) { MG.confetti(120); MG.sfx.win(); } else if (score >= 15) MG.sfx.good(); else MG.sfx.draw();
    MG.event('game_over', { score: score });
  }

  /* ---------- pause (button, tab switch and host messages all land here) ---------- */
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
      h('p', { class: 'mg-sub', text: 'The moles are waiting under their holes. The clock is stopped.' }),
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
    var play = h('button', { class: 'mg-btn', type: 'button', text: 'Start whacking' });
    play.addEventListener('click', start);
    overlay.innerHTML = '';
    overlay.append(h('div', { class: 'mg-card', role: 'dialog', 'aria-label': 'Whack-a-Mole' },
      h('div', { class: 'wk-badge', 'aria-hidden': 'true', text: '🔨' }),
      h('h2', { class: 'mg-title', text: 'Whack-a-Mole' }),
      h('p', { class: 'mg-sub', text: 'Moles pop up from nine holes for 30 seconds. Whack as many as you can before they duck back down.' + (best ? ' Your best is ' + best + '.' : '') }),
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

  /* ---------- start ---------- */
  renderSound(); renderHud(); showStart();
  requestAnimationFrame(tick);
  if (o.showcase) { // still frame: three moles up, a round well under way
    overlay.hidden = true;
    score = 14; gameTime = 12000; best = best || 21;
    [1, 4, 6].forEach(function (i) { moles[i] = 1e9; setMole(i, true); });
    msg.textContent = '14 moles whacked';
    root.classList.add('is-showcase');
    renderHud();
    setTimeout(function () { document.documentElement.setAttribute('data-ready', '1'); }, 80);
  }
  MG.ready();
})();
