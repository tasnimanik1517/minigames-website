/* Simon Says engine: four coloured pads light up in a pattern; repeat it back.
 * Each round adds one step and the pattern plays a little faster.
 * Options: { showcase: true } still frame for cover art. */
(function () {
  'use strict';
  var MG = window.MG, h = MG.h, o = window.GAME_OPTIONS || {};

  var PADS = [
    { name: 'Green', freq: 415, key: '1' },
    { name: 'Red', freq: 310, key: '2' },
    { name: 'Yellow', freq: 252, key: '3' },
    { name: 'Blue', freq: 209, key: '4' }
  ];
  var RANKS = [[0, '🌱', 'First Step'], [3, '👀', 'Pattern Watcher'], [6, '🧠', 'Memory Keeper'],
    [9, '🎵', 'Tune Tracker'], [12, '⚡', 'Sequence Star'], [16, '👑', 'Simon Champion']];
  var best = +MG.store.get('best', 0) || 0;

  /* ---------- state ---------- */
  var state = 'idle', paused = false;
  var seq = [], inputIdx = 0, timer = null, showIdx = 0, bestAtStart = 0;

  /* ---------- DOM ---------- */
  function pill(label, el) { return h('span', { class: 'mg-pill' }, h('small', { text: label }), el); }
  var roundEl = h('b'), bestEl = h('b');
  var soundBtn = h('button', { class: 'mg-icon-btn', type: 'button' });
  var pauseBtn = h('button', { class: 'mg-icon-btn', type: 'button', 'aria-label': 'Pause the game' },
    h('span', { html: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1.2"/><rect x="14" y="5" width="4" height="14" rx="1.2"/></svg>' }));
  var msg = h('div', { class: 'sm-msg', 'aria-live': 'polite', text: 'Watch the pads, then repeat the pattern.' });
  var board = h('div', { class: 'sm-board', role: 'group', 'aria-label': 'Four coloured pads' });
  var padEls = [];
  PADS.forEach(function (p, i) {
    var pad = h('button', { class: 'sm-pad is-' + p.name.toLowerCase(), type: 'button', 'aria-label': p.name + ' pad' },
      h('span', { class: 'sm-note', 'aria-hidden': 'true', text: '♪' }));
    pad.addEventListener('pointerdown', function (e) { e.preventDefault(); onPad(i); });
    padEls.push(pad); board.append(pad);
  });
  var hub = h('div', { class: 'sm-hub', 'aria-hidden': 'true' }, h('span', { class: 'sm-hub-n', text: '0' }));
  board.append(hub);
  var overlay = h('div', { class: 'mg-overlay', hidden: true });
  var root = h('div', { class: 'mg-root sm' },
    h('div', { class: 'mg-hud' }, pill('Round', roundEl), pill('Best', bestEl),
      h('span', { class: 'mg-spacer' }), pauseBtn, soundBtn),
    h('div', { class: 'sm-main' }, msg, board), overlay);
  document.getElementById('game').append(root);

  /* ---------- helpers ---------- */
  function rank(s) { var r = RANKS[0]; RANKS.forEach(function (x) { if (s >= x[0]) r = x; }); return r; }
  function stepMs() { return Math.max(320, 560 - (seq.length - 1) * 14); } // pattern plays faster as it grows
  function renderHud() {
    roundEl.textContent = seq.length ? seq.length : '–';
    bestEl.textContent = best ? best : '–';
    hub.firstChild.textContent = seq.length ? seq.length : '0';
  }
  function light(i, ms) {
    padEls[i].classList.add('is-lit');
    MG.tone(PADS[i].freq, Math.min(ms, 600) / 1000 + 0.08, 'sine', 0.09);
    setTimeout(function () { padEls[i].classList.remove('is-lit'); }, ms);
  }
  function clearTimer() { if (timer) { clearTimeout(timer); timer = null; } }

  /* ---------- the round ---------- */
  function start() {
    seq = []; inputIdx = 0; clearTimer(); bestAtStart = best;
    state = 'playing'; paused = false; overlay.hidden = true;
    nextRound();
  }
  function nextRound() {
    seq.push(Math.floor(Math.random() * 4));
    inputIdx = 0;
    board.setAttribute('data-seq', seq.join(','));
    renderHud();
    state = 'showing'; showIdx = 0;
    msg.textContent = 'Watch the pattern…';
    showStep();
  }
  function showStep() {
    if (state !== 'showing' || paused) return;
    if (showIdx >= seq.length) {
      state = 'input'; inputIdx = 0;
      msg.textContent = 'Your turn — repeat the pattern!';
      return;
    }
    var i = seq[showIdx], ms = stepMs();
    light(i, ms);
    showIdx++;
    timer = setTimeout(showStep, ms + 190);
  }
  function onPad(i) {
    if (state !== 'input' || paused) return;
    light(i, 260);
    MG.vibrate(10);
    if (i === seq[inputIdx]) {
      inputIdx++;
      if (inputIdx >= seq.length) { // round complete
        var done = seq.length;
        state = 'showing'; // block input while the next round sets up
        msg.textContent = 'Nice! Round ' + (done + 1) + ' is coming…';
        MG.sfx.good();
        if (done > best) { best = done; MG.store.set('best', best); }
        renderHud();
        timer = setTimeout(nextRound, 1000);
      }
    } else { // wrong pad: the pattern breaks
      MG.sfx.bad();
      finish();
    }
  }
  function finish() {
    clearTimer();
    state = 'done';
    var score = seq.length - 1; // rounds fully repeated
    var isBest = score > 0 && score > bestAtStart; // best was already kept up to date as rounds completed
    renderHud();
    var r = rank(score);
    var again = h('button', { class: 'mg-btn', type: 'button', text: 'Play again' });
    again.addEventListener('click', function () { MG.adBreak('next', 'simon-again', start); });
    overlay.innerHTML = '';
    overlay.append(h('div', { class: 'mg-card sm-card', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Your result' },
      h('div', { class: 'sm-badge', 'aria-hidden': 'true', text: r[1] }),
      h('div', null, h('small', { class: 'mg-label', text: 'Your Simon badge' }), h('h2', { class: 'mg-title', text: r[2] })),
      h('div', { class: 'sm-score' }, h('span', { class: 'mg-big', text: score }), h('span', { text: score === 1 ? 'round repeated' : 'rounds repeated' })),
      isBest ? h('span', { class: 'mg-badge', text: 'New best!' }) : null,
      h('p', { class: 'mg-sub', text: 'You reached round ' + seq.length + ' and the pattern slipped away there.' + (best ? ' Your best is ' + best + ' rounds.' : '') }),
      h('div', { class: 'mg-row' }, again)));
    overlay.hidden = false;
    MG.focusSafe(again, 700);
    if (isBest) { MG.confetti(120); MG.sfx.win(); } else if (score >= 6) MG.sfx.good(); else MG.sfx.draw();
    MG.event('game_over', { score: score });
  }

  /* ---------- pause ---------- */
  function pauseGame() {
    if ((state !== 'showing' && state !== 'input') || paused) return;
    paused = true; clearTimer();
    var resume = h('button', { class: 'mg-btn', type: 'button', text: 'Resume' });
    var restart = h('button', { class: 'mg-btn is-secondary', type: 'button', text: 'Start again' });
    resume.addEventListener('click', resumeGame);
    restart.addEventListener('click', start);
    overlay.innerHTML = '';
    overlay.append(h('div', { class: 'mg-card', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Paused' },
      h('h2', { class: 'mg-title', text: 'Paused' }),
      h('p', { class: 'mg-sub', text: 'The pattern is waiting. Resume to see it from the start again.' }),
      h('div', { class: 'mg-row' }, restart, resume)));
    overlay.hidden = false;
    MG.focusSafe(resume, 300);
  }
  function resumeGame() {
    paused = false; overlay.hidden = true;
    if (state === 'showing') { showIdx = 0; showStep(); } // replay the pattern from the start
  }
  pauseBtn.addEventListener('click', function () {
    if (paused) resumeGame(); else pauseGame();
  });
  MG.onPause(pauseGame);

  /* ---------- keyboard: 1-4 or arrow keys ---------- */
  document.addEventListener('keydown', function (e) {
    if (state !== 'input' || paused) return;
    var map = { '1': 0, '2': 1, '3': 2, '4': 3, ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3 };
    if (e.key in map) { e.preventDefault(); onPad(map[e.key]); }
  });

  /* ---------- start screen ---------- */
  function showStart() {
    var play = h('button', { class: 'mg-btn', type: 'button', text: 'Start watching' });
    play.addEventListener('click', start);
    overlay.innerHTML = '';
    overlay.append(h('div', { class: 'mg-card', role: 'dialog', 'aria-label': 'Simon Says' },
      h('div', { class: 'sm-badge', 'aria-hidden': 'true', text: '🎵' }),
      h('h2', { class: 'mg-title', text: 'Simon Says' }),
      h('p', { class: 'mg-sub', text: 'Four pads light up in a pattern. Watch it, then tap the pads back in the same order. Each round adds one more step — how long can you keep up?' + (best ? ' Your best is ' + best + ' rounds.' : '') }),
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
  if (o.showcase) { // still frame: round 3, green and yellow lit mid-pattern
    overlay.hidden = true;
    seq = [0, 2, 1]; board.setAttribute('data-seq', '0,2,1');
    best = best || 7;
    padEls[0].classList.add('is-lit'); padEls[2].classList.add('is-lit');
    msg.textContent = 'Watch the pattern…';
    root.classList.add('is-showcase');
    renderHud();
    setTimeout(function () { document.documentElement.setAttribute('data-ready', '1'); }, 80);
  }
  MG.ready();
})();
