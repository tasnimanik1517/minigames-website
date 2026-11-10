/* Minesweeper engine: the classic minefield. Tap a cell to reveal it, long-press,
 * right-click or flag mode to plant a flag. First tap is always safe.
 * Options: { showcase: true } still frame for cover art. */
(function () {
  'use strict';
  var MG = window.MG, h = MG.h, o = window.GAME_OPTIONS || {};

  var LEVELS = {
    beginner: { rows: 9, cols: 9, mines: 10, label: 'Beginner' },
    intermediate: { rows: 16, cols: 16, mines: 40, label: 'Intermediate' },
    expert: { rows: 16, cols: 30, mines: 99, label: 'Expert' }
  };
  var level = MG.store.get('level', 'beginner');
  if (!LEVELS[level]) level = 'beginner';
  var NUMCLS = ['', 'n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'n7', 'n8'];

  /* ---------- state ---------- */
  var state = 'idle'; // idle | playing | won | lost
  var paused = false, flagMode = false;
  var cells = [], rows = 0, cols = 0, mineTotal = 0;
  var opened = 0, flags = 0, minesPlaced = false;
  var startMs = 0, elapsedMs = 0, pauseMs = 0, timerId = null;
  var best = +MG.store.get('best:' + level, 0) || 0;
  var lpCell = -1, lpAt = 0; // cell whose long-press just fired: its click must not also reveal

  /* ---------- DOM ---------- */
  function pill(label, el) { return h('span', { class: 'mg-pill' }, h('small', { text: label }), el); }
  var minesEl = h('b'), timeEl = h('b'), bestEl = h('b');
  var soundBtn = h('button', { class: 'mg-icon-btn', type: 'button' });
  var pauseBtn = h('button', { class: 'mg-icon-btn', type: 'button', 'aria-label': 'Pause the game' },
    h('span', { html: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1.2"/><rect x="14" y="5" width="4" height="14" rx="1.2"/></svg>' }));
  var flagBtn = h('button', { class: 'mg-icon-btn mn-flag', type: 'button', 'aria-label': 'Flag mode: tap cells to plant flags', 'aria-pressed': 'false', text: '🚩' });
  var msg = h('div', { class: 'mn-msg', 'aria-live': 'polite', text: 'Tap a cell to start.' });
  var boardWrap = h('div', { class: 'mn-scroll' });
  var board = h('div', { class: 'mn-board', role: 'grid', 'aria-label': 'Minefield' });
  boardWrap.append(board);
  var overlay = h('div', { class: 'mg-overlay', hidden: true });
  var opts = MG.options({
    overlay: overlay, title: 'Game options',
    summary: function () { return LEVELS[level].label + ' · ' + LEVELS[level].cols + '×' + LEVELS[level].rows + ' · ' + LEVELS[level].mines + ' mines'; },
    groups: [
      { label: 'Difficulty', items: [['beginner', 'Beginner 9×9 · 10'], ['intermediate', 'Intermediate 16×16 · 40'], ['expert', 'Expert 30×16 · 99']],
        get: function () { return level; },
        set: function (v) { level = v; MG.store.set('level', v); best = +MG.store.get('best:' + level, 0) || 0; newGame(); } }
    ],
    extra: function () {
      var r = h('button', { class: 'mg-linkbtn', type: 'button', text: 'Reset best times' });
      r.addEventListener('click', function () {
        ['beginner', 'intermediate', 'expert'].forEach(function (k) { MG.store.set('best:' + k, 0); });
        best = 0; renderHud(); MG.sfx.tap(); r.textContent = 'Best times reset';
      });
      return [r];
    }
  });
  var root = h('div', { class: 'mg-root mn' },
    h('div', { class: 'mg-hud' }, pill('💣 Mines', minesEl), pill('⏱ Time', timeEl), pill('Best', bestEl),
      h('span', { class: 'mg-spacer' }), flagBtn, pauseBtn, soundBtn),
    h('div', { class: 'mn-main' }, msg, boardWrap, h('div', { class: 'mn-bar' }, opts.el)),
    overlay);
  document.getElementById('game').append(root);

  /* ---------- helpers ---------- */
  function idx(r, c) { return r * cols + c; }
  function neighbours(i) {
    var r = Math.floor(i / cols), c = i % cols, out = [];
    for (var dr = -1; dr <= 1; dr++) for (var dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      var nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) out.push(idx(nr, nc));
    }
    return out;
  }
  function fmt(ms) {
    var s = Math.floor(ms / 1000);
    return s < 60 ? String(s) + 's' : Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2);
  }
  function renderHud() {
    minesEl.textContent = mineTotal - flags;
    bestEl.textContent = best ? fmt(best * 1000) : '–';
    timeEl.textContent = fmt(state === 'playing' || state === 'won' || state === 'lost' ? elapsedMs : 0);
  }
  function setCell(i, text, cls) {
    var el = cells[i].el;
    el.textContent = text || '';
    el.className = 'mn-cell' + (cls ? ' ' + cls : '');
  }

  /* ---------- the game ---------- */
  function buildBoard() {
    var L = LEVELS[level];
    rows = L.rows; cols = L.cols; mineTotal = L.mines;
    board.innerHTML = '';
    board.style.setProperty('--cols', cols);
    board.className = 'mn-board mn-lv-' + level;
    cells = [];
    for (var i = 0; i < rows * cols; i++) {
      (function (i) {
        var el = h('button', { class: 'mn-cell', type: 'button', role: 'gridcell', 'aria-label': 'Cell ' + (i + 1) });
        el.addEventListener('click', function (e) { onCellClick(i, e); });
        el.addEventListener('contextmenu', function (e) { e.preventDefault(); toggleFlag(i); });
        var lpTimer = null;
        el.addEventListener('pointerdown', function (e) {
          if (e.button > 0) return;
          lpTimer = setTimeout(function () { lpCell = i; lpAt = Date.now(); toggleFlag(i); MG.vibrate(20); }, 450);
        });
        el.addEventListener('pointerup', function () { clearTimeout(lpTimer); });
        el.addEventListener('pointerleave', function () { clearTimeout(lpTimer); });
        el.addEventListener('keydown', function (e) {
          if (e.key === 'f' || e.key === 'F') { e.preventDefault(); toggleFlag(i); }
        });
        cells.push({ el: el, mine: false, open: false, flag: false, adj: 0 });
        board.append(el);
      })(i);
    }
  }
  function newGame() {
    stopTimer();
    state = 'idle'; paused = false; flagMode = false; flagBtn.setAttribute('aria-pressed', 'false');
    opened = 0; flags = 0; minesPlaced = false; elapsedMs = 0;
    buildBoard();
    overlay.hidden = true;
    msg.textContent = 'Tap a cell to start.';
    renderHud();
    opts.refresh();
  }
  function placeMines(safe) {
    var banned = {};
    banned[safe] = true;
    neighbours(safe).forEach(function (n) { banned[n] = true; });
    var spots = [];
    for (var i = 0; i < rows * cols; i++) if (!banned[i]) spots.push(i);
    for (var m = 0; m < mineTotal; m++) {
      var pick = Math.floor(Math.random() * spots.length);
      var mi = spots.splice(pick, 1)[0];
      cells[mi].mine = true;
      neighbours(mi).forEach(function (n) { cells[n].adj++; });
    }
    minesPlaced = true;
  }
  function startTimer() {
    startMs = Date.now();
    timerId = setInterval(function () {
      if (state === 'playing' && !paused) { elapsedMs = Date.now() - startMs; renderHud(); }
    }, 250);
  }
  function stopTimer() { if (timerId) { clearInterval(timerId); timerId = null; } }
  function reveal(i) {
    var stack = [i];
    while (stack.length) {
      var cur = stack.pop(), cell = cells[cur];
      if (cell.open || cell.flag) continue;
      cell.open = true; opened++;
      var cls = 'is-open' + (cell.adj ? ' ' + NUMCLS[cell.adj] : '');
      setCell(cur, cell.adj ? String(cell.adj) : '', cls);
      cells[cur].el.setAttribute('aria-label', 'Revealed, ' + (cell.adj ? cell.adj + ' neighbouring mines' : 'no neighbouring mines'));
      if (!cell.adj) neighbours(cur).forEach(function (n) { if (!cells[n].open && !cells[n].flag) stack.push(n); });
    }
  }
  function chord(i) {
    var cell = cells[i];
    if (!cell.open || !cell.adj) return;
    var ns = neighbours(i), f = 0;
    ns.forEach(function (n) { if (cells[n].flag) f++; });
    if (f !== cell.adj) return;
    ns.forEach(function (n) { if (!cells[n].flag && !cells[n].open) revealOrBoom(n); });
    afterReveal();
  }
  function revealOrBoom(i) {
    if (cells[i].mine) { boom(i); return; }
    reveal(i);
  }
  function afterReveal() {
    if (state !== 'playing') return;
    if (opened === rows * cols - mineTotal) win();
  }
  function onCellClick(i, e) {
    if (e.button > 0) return;
    if (lpCell === i && Date.now() - lpAt < 600) { lpCell = -1; return; } // long-press already flagged this cell
    if (state === 'won' || state === 'lost' || paused) return;
    var cell = cells[i];
    if (flagMode) { toggleFlag(i); return; }
    if (cell.flag) return;
    if (cell.open) { chord(i); return; }
    if (state === 'idle') {
      placeMines(i);
      state = 'playing';
      startTimer();
      msg.textContent = 'Find all the mines — flag what you suspect.';
    }
    revealOrBoom(i);
    if (state === 'playing') { MG.sfx.tap(); afterReveal(); }
  }
  function toggleFlag(i) {
    if (state === 'won' || state === 'lost' || paused) return;
    var cell = cells[i];
    if (cell.open) return;
    if (!cell.flag && flags >= mineTotal) return;
    if (state === 'idle') { // flagging before the first reveal still starts the clock fairly: place mines first
      placeMines(i);
      state = 'playing';
      startTimer();
      msg.textContent = 'Find all the mines — flag what you suspect.';
    }
    cell.flag = !cell.flag;
    flags += cell.flag ? 1 : -1;
    setCell(i, cell.flag ? '🚩' : '', cell.flag ? 'is-flag' : '');
    cells[i].el.setAttribute('aria-label', cell.flag ? 'Flagged cell ' + (i + 1) : 'Cell ' + (i + 1));
    MG.sfx.place(); MG.vibrate(10);
    renderHud();
  }
  function boom(i) {
    state = 'lost';
    stopTimer();
    cells[i].el.classList.add('is-boom');
    setCell(i, '💥', 'is-boom');
    for (var k = 0; k < cells.length; k++) {
      if (cells[k].mine && !cells[k].open && k !== i) setCell(k, '💣', 'is-mine');
      if (!cells[k].mine && cells[k].flag) setCell(k, '✖️', 'is-wrong');
    }
    MG.sfx.bad(); MG.vibrate([40, 40, 80]);
    msg.textContent = 'Boom! That was a mine.';
    finish(false);
  }
  function win() {
    state = 'won';
    stopTimer();
    for (var k = 0; k < cells.length; k++) if (cells[k].mine && !cells[k].flag) setCell(k, '🚩', 'is-flag');
    flags = mineTotal;
    var secs = Math.floor(elapsedMs / 1000);
    var isBest = !best || secs < best;
    if (isBest) { best = secs; MG.store.set('best:' + level, best); }
    renderHud();
    msg.textContent = 'Cleared! No mines left.';
    MG.sfx.win(); MG.confetti(90);
    finish(true, isBest);
  }
  function finish(won, isBest) {
    renderHud();
    var secs = Math.floor(elapsedMs / 1000);
    var again = h('button', { class: 'mg-btn', type: 'button', text: 'Play again' });
    again.addEventListener('click', function () { MG.adBreak('next', 'mines-again', newGame); });
    var change = h('button', { class: 'mg-btn is-secondary', type: 'button', text: 'Change difficulty' });
    change.addEventListener('click', function () { overlay.hidden = true; opts.open(); });
    overlay.innerHTML = '';
    overlay.append(h('div', { class: 'mg-card mn-card', role: 'dialog', 'aria-modal': 'true', 'aria-label': won ? 'You win' : 'Game over' },
      h('div', { class: 'mn-badge', 'aria-hidden': 'true', text: won ? '🏆' : '💥' }),
      h('div', null, h('small', { class: 'mg-label', text: won ? 'Minefield cleared' : 'Mine hit' }),
        h('h2', { class: 'mg-title', text: won ? 'You win!' : 'Boom!' })),
      h('div', { class: 'mn-score' }, h('span', { class: 'mg-big', text: fmt(elapsedMs) }),
        h('span', { text: LEVELS[level].label + ' · ' + LEVELS[level].cols + '×' + LEVELS[level].rows + ' · ' + mineTotal + ' mines' })),
      isBest ? h('span', { class: 'mg-badge', text: 'New best time!' }) : null,
      h('p', { class: 'mg-sub', text: won
        ? 'Every safe cell revealed and every mine flagged.' + (best && !isBest ? ' Your best is ' + fmt(best * 1000) + '.' : '')
        : 'You hit a mine after ' + secs + ' seconds.' + (best ? ' Your best clear is ' + fmt(best * 1000) + '.' : ' Try the beginner board first — it is a kinder place to learn.') }),
      h('div', { class: 'mg-row' }, again, change)));
    overlay.hidden = false;
    MG.focusSafe(again, 700);
    MG.event('game_over', { won: won, time: secs, level: level });
  }

  /* ---------- pause (button, tab switch and host messages all land here) ---------- */
  function pauseGame() {
    if (state !== 'playing' || paused) return;
    paused = true; pauseMs = Date.now();
    var resume = h('button', { class: 'mg-btn', type: 'button', text: 'Resume' });
    var restart = h('button', { class: 'mg-btn is-secondary', type: 'button', text: 'Start again' });
    resume.addEventListener('click', function () { resumeGame(); });
    restart.addEventListener('click', newGame);
    overlay.innerHTML = '';
    overlay.append(h('div', { class: 'mg-card', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Paused' },
      h('h2', { class: 'mg-title', text: 'Paused' }),
      h('p', { class: 'mg-sub', text: 'The minefield is frozen and the clock is stopped.' }),
      h('div', { class: 'mg-row' }, restart, resume)));
    overlay.hidden = false;
    MG.focusSafe(resume, 300);
  }
  function resumeGame() {
    if (!paused) return;
    paused = false;
    startMs += Date.now() - pauseMs;
    overlay.hidden = true;
  }
  pauseBtn.addEventListener('click', function () {
    if (paused) resumeGame(); else pauseGame();
  });
  MG.onPause(pauseGame);

  /* ---------- flag mode + sound ---------- */
  flagBtn.addEventListener('click', function () {
    flagMode = !flagMode;
    flagBtn.setAttribute('aria-pressed', String(flagMode));
    flagBtn.classList.toggle('is-on', flagMode);
    msg.textContent = flagMode ? 'Flag mode on — tap cells to plant flags.' : 'Tap a cell to start.';
    MG.sfx.tap();
  });
  soundBtn.addEventListener('click', function () { MG.sound.toggle(); renderSound(); });
  function renderSound() {
    soundBtn.innerHTML = MG.sound.muted
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z" fill="currentColor"/><path d="m16 9 6 6M22 9l-6 6"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z" fill="currentColor"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>';
    soundBtn.setAttribute('aria-label', MG.sound.muted ? 'Turn sound on' : 'Turn sound off');
  }

  /* ---------- start ---------- */
  renderSound();
  newGame();
  if (o.showcase) { // still frame: beginner board, mid-game, numbers and flags showing
    overlay.hidden = true;
    var fixedMines = [8, 17, 26, 35, 44, 53, 62, 71, 79, 80];
    fixedMines.forEach(function (mi) { cells[mi].mine = true; neighbours(mi).forEach(function (n) { cells[n].adj++; }); });
    minesPlaced = true; state = 'playing'; startMs = Date.now() - 42000; elapsedMs = 42000;
    for (var r = 0; r < 6; r++) for (var c = 0; c < 7; c++) {
      var ci = idx(r, c);
      if (!cells[ci].mine) reveal(ci);
    }
    [8, 17].forEach(function (fi) { cells[fi].flag = true; flags++; setCell(fi, '🚩', 'is-flag'); });
    best = best || 87;
    msg.textContent = '8 mines left to find';
    root.classList.add('is-showcase');
    renderHud();
    setTimeout(function () { document.documentElement.setAttribute('data-ready', '1'); }, 80);
  }
  MG.ready();
})();
