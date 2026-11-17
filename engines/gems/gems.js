/* Gem Match engine: swap neighbouring gems to match three or more in a row.
 * A 60-second score attack: matches clear, gems fall, cascades multiply the score.
 * Options: { showcase } (showcase renders one still frame for cover art). */
(function () {
  'use strict';
  var MG = window.MG, h = MG.h;
  var opts = window.GAME_OPTIONS || {};
  var SHOW = !!opts.showcase;
  var SIZE = 8, TYPES = 6, TIME_LIMIT = 60;
  var ICON = {
    pause: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1.5"/><rect x="14" y="5" width="4" height="14" rx="1.5"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.9l10-6.5a1 1 0 0 0 0-1.7l-10-6.5A1 1 0 0 0 8 5.5Z"/></svg>',
    soundOn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z" fill="currentColor"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>',
    soundOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z" fill="currentColor"/><path d="m16 9 6 6M22 9l-6 6"/></svg>'
  };

  /* ---------------------------------------------------------------- DOM */
  var scoreEl = h('b', { text: '0' }), bestEl = h('b', { text: '0' }), timeEl = h('b', { text: '60' });
  var timePill = h('span', { class: 'mg-pill gm-time' }, h('small', { text: 'Time' }), timeEl);
  var pauseBtn = h('button', { class: 'mg-icon-btn', type: 'button', 'aria-label': 'Pause', html: ICON.pause });
  var soundBtn = h('button', { class: 'mg-icon-btn', type: 'button' });
  var hintBtn = h('button', { class: 'mg-btn is-small gm-hint-btn', type: 'button', text: '💡 Hint' });
  var boardEl = h('div', { class: 'gm-board', role: 'grid', 'aria-label': 'Gem board' });
  var stage = h('div', { class: 'gm-stage' }, h('div', { class: 'gm-wrap' }, boardEl, hintBtn));
  var overlay = h('div', { class: 'mg-overlay' });
  var live = h('div', { class: 'mg-sr', 'aria-live': 'polite' });
  var rootEl = h('div', { class: 'mg-root gm' + (SHOW ? ' is-showcase' : '') },
    h('div', { class: 'mg-hud' },
      h('span', { class: 'mg-pill' }, h('small', { text: 'Score' }), scoreEl),
      h('span', { class: 'mg-pill' }, h('small', { text: 'Best' }), bestEl),
      timePill,
      h('span', { class: 'mg-spacer' }), pauseBtn, soundBtn),
    stage, overlay, live);
  document.getElementById('game').append(rootEl);
  function renderSoundBtn() {
    soundBtn.innerHTML = MG.sound.muted ? ICON.soundOff : ICON.soundOn;
    soundBtn.setAttribute('aria-label', MG.sound.muted ? 'Turn sound on' : 'Turn sound off');
  }
  soundBtn.addEventListener('click', function () { MG.sound.toggle(); renderSoundBtn(); });
  renderSoundBtn();

  /* ---------------------------------------------------------------- state */
  var state = 'idle'; // idle | running | paused | over
  var board = []; // SIZE x SIZE of gem types 0..5, or -1 for empty
  var cells = []; // DOM buttons, index = y*SIZE+x
  var score = 0, matchesMade = 0, bestCombo = 0;
  var timeLeft = TIME_LIMIT, timerId = 0;
  var sel = null; // selected cell {x,y}
  var cursor = { x: 3, y: 3 };
  var busy = false, hintPair = null, hintTimer = 0;

  function best() { return MG.store.get('best', 0); }
  function setBest(v) { MG.store.set('best', v); }
  function updateHud() {
    scoreEl.textContent = score; bestEl.textContent = Math.max(best(), score);
    timeEl.textContent = Math.ceil(timeLeft);
    timePill.classList.toggle('is-low', timeLeft <= 10 && state === 'running');
  }
  function idx(x, y) { return y * SIZE + x; }
  function inBoard(x, y) { return x >= 0 && y >= 0 && x < SIZE && y < SIZE; }
  function randType() { return (Math.random() * TYPES) | 0; }

  /* ---------------------------------------------------------------- board */
  function fillBoard() {
    board = [];
    for (var y = 0; y < SIZE; y++) {
      board[y] = [];
      for (var x = 0; x < SIZE; x++) {
        var t;
        do {
          t = randType();
        } while ((x >= 2 && board[y][x - 1] === t && board[y][x - 2] === t) ||
                 (y >= 2 && board[y - 1][x] === t && board[y - 2][x] === t));
        board[y][x] = t;
      }
    }
    if (!findMove()) shuffleBoard();
  }
  function shuffleBoard() {
    var flat = [];
    for (var y = 0; y < SIZE; y++) for (var x = 0; x < SIZE; x++) flat.push(board[y][x]);
    for (var tries = 0; tries < 40; tries++) {
      for (var i = flat.length - 1; i > 0; i--) { var j = (Math.random() * (i + 1)) | 0; var tmp = flat[i]; flat[i] = flat[j]; flat[j] = tmp; }
      for (var k = 0; k < flat.length; k++) board[(k / SIZE) | 0][k % SIZE] = flat[k];
      if (!findMatches().length && findMove()) return;
    }
  }
  function findMatches() {
    var set = {};
    for (var y = 0; y < SIZE; y++) {
      var run = 1;
      for (var x = 1; x <= SIZE; x++) {
        if (x < SIZE && board[y][x] === board[y][x - 1] && board[y][x] >= 0) run++;
        else { if (run >= 3) for (var i = x - run; i < x; i++) set[idx(i, y)] = true; run = 1; }
      }
    }
    for (var x = 0; x < SIZE; x++) {
      var run2 = 1;
      for (var y = 1; y <= SIZE; y++) {
        if (y < SIZE && board[y][x] === board[y - 1][x] && board[y][x] >= 0) run2++;
        else { if (run2 >= 3) for (var j = y - run2; j < y; j++) set[idx(x, j)] = true; run2 = 1; }
      }
    }
    return Object.keys(set).map(Number);
  }
  function findMove() {
    for (var y = 0; y < SIZE; y++) for (var x = 0; x < SIZE; x++) {
      var dirs = [[1, 0], [0, 1]];
      for (var d = 0; d < 2; d++) {
        var nx = x + dirs[d][0], ny = y + dirs[d][1];
        if (!inBoard(nx, ny)) continue;
        var a = board[y][x]; board[y][x] = board[ny][nx]; board[ny][nx] = a;
        var ok = findMatches().length > 0;
        board[ny][nx] = board[y][x]; board[y][x] = a;
        if (ok) return [{ x: x, y: y }, { x: nx, y: ny }];
      }
    }
    return null;
  }
  function applyGravity() {
    for (var x = 0; x < SIZE; x++) {
      var write = SIZE - 1;
      for (var y = SIZE - 1; y >= 0; y--) {
        if (board[y][x] >= 0) { board[write][x] = board[y][x]; write--; }
      }
      for (var w = write; w >= 0; w--) board[w][x] = randType();
    }
  }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  /* ---------------------------------------------------------------- render */
  function buildCells() {
    boardEl.innerHTML = ''; cells = [];
    for (var y = 0; y < SIZE; y++) for (var x = 0; x < SIZE; x++) {
      (function (cx, cy) {
        var b = h('button', { class: 'gm-cell', type: 'button', role: 'gridcell', 'aria-label': 'Gem row ' + (cy + 1) + ' column ' + (cx + 1) });
        b.addEventListener('click', function () { onCell(cx, cy); });
        b.addEventListener('pointerdown', function (e) { dragStart = { x: cx, y: cy, px: e.clientX, py: e.clientY }; });
        b.addEventListener('pointerup', function (e) { onDragEnd(cx, cy, e); });
        boardEl.append(b); cells[idx(cx, cy)] = b;
      })(x, y);
    }
  }
  function renderBoard(dropFrom) {
    for (var y = 0; y < SIZE; y++) for (var x = 0; x < SIZE; x++) {
      var c = cells[idx(x, y)], t = board[y][x];
      c.className = 'gm-cell' + (sel && sel.x === x && sel.y === y ? ' is-sel' : '') +
        (cursor.x === x && cursor.y === y && state === 'running' ? ' is-cursor' : '') +
        (hintPair && ((hintPair[0].x === x && hintPair[0].y === y) || (hintPair[1].x === x && hintPair[1].y === y)) ? ' is-hint' : '') +
        (dropFrom && dropFrom[idx(x, y)] ? ' is-drop' : '');
      c.innerHTML = t >= 0 ? '<span class="gm-gem g' + t + '"></span>' : '';
      c.setAttribute('aria-label', 'Gem row ' + (y + 1) + ' column ' + (x + 1) + (t >= 0 ? ', colour ' + (t + 1) : ', empty'));
    }
  }
  var dragStart = null;
  function onDragEnd(cx, cy, e) {
    if (!dragStart || state !== 'running' || busy) { dragStart = null; return; }
    var dx = e.clientX - dragStart.px, dy = e.clientY - dragStart.py;
    dragStart = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return; // a tap: the click handler deals with it
    var d = Math.abs(dx) > Math.abs(dy) ? { x: dx > 0 ? 1 : -1, y: 0 } : { x: 0, y: dy > 0 ? 1 : -1 };
    attemptSwap({ x: cx, y: cy }, { x: cx + d.x, y: cy + d.y });
  }
  function onCell(x, y) {
    if (state === 'idle' || state === 'over') { start(); return; }
    if (state !== 'running' || busy) return;
    clearHint();
    cursor = { x: x, y: y };
    if (!sel) { sel = { x: x, y: y }; MG.sfx.tap(); renderBoard(); return; }
    if (sel.x === x && sel.y === y) { sel = null; renderBoard(); return; }
    if (Math.abs(sel.x - x) + Math.abs(sel.y - y) === 1) {
      var a = sel; sel = null;
      attemptSwap(a, { x: x, y: y });
    } else { sel = { x: x, y: y }; MG.sfx.tap(); renderBoard(); }
  }
  function showHint() {
    if (state !== 'running' || busy) return;
    var mv = findMove();
    if (!mv) { shuffleBoard(); renderBoard(); return; }
    clearHint();
    hintPair = mv; renderBoard();
    MG.sfx.tap();
    clearTimeout(hintTimer);
    hintTimer = setTimeout(clearHint, 2200);
  }
  function clearHint() { if (hintPair) { hintPair = null; clearTimeout(hintTimer); renderBoard(); } }
  hintBtn.addEventListener('click', showHint);

  /* ---------------------------------------------------------------- play */
  function swapCells(a, b) {
    var t = board[a.y][a.x]; board[a.y][a.x] = board[b.y][b.x]; board[b.y][b.x] = t;
  }
  async function attemptSwap(a, b) {
    if (!inBoard(b.x, b.y) || busy || state !== 'running') return;
    busy = true; clearHint();
    swapCells(a, b); renderBoard(); MG.sfx.place();
    await wait(180);
    var matches = findMatches();
    if (!matches.length) {
      // no match: swap back with a little shake
      swapCells(a, b);
      cells[idx(a.x, a.y)].classList.add('is-nope'); cells[idx(b.x, b.y)].classList.add('is-nope');
      renderBoard();
      cells[idx(a.x, a.y)].classList.add('is-nope'); cells[idx(b.x, b.y)].classList.add('is-nope');
      MG.sfx.draw(); busy = false; return;
    }
    await resolveBoard();
    busy = false;
  }
  async function resolveBoard() {
    var combo = 0;
    for (;;) {
      var matches = findMatches();
      if (!matches.length) break;
      combo++;
      var n = matches.length;
      score += n * 10 * combo;
      matchesMade++;
      if (combo > bestCombo) bestCombo = combo;
      updateHud();
      matches.forEach(function (i) { cells[i].classList.add('is-clear'); });
      if (combo === 1) MG.sfx.good(); else MG.sfx.bonus();
      await wait(280);
      matches.forEach(function (i) { board[(i / SIZE) | 0][i % SIZE] = -1; });
      var dropped = {};
      for (var x = 0; x < SIZE; x++) {
        var write = SIZE - 1;
        for (var y = SIZE - 1; y >= 0; y--) if (board[y][x] >= 0) { board[write][x] = board[y][x]; write--; }
        for (var w = write; w >= 0; w--) { board[w][x] = randType(); dropped[idx(x, w)] = true; }
      }
      renderBoard(dropped);
      await wait(200);
    }
    if (!findMove()) { shuffleBoard(); renderBoard(); toast('No moves — board shuffled'); }
  }
  function toast(text) { var t = h('div', { class: 'mg-toast', text: text }); rootEl.append(t); setTimeout(function () { t.remove(); }, 1600); }
  function tick() {
    timeLeft = Math.max(0, timeLeft - 0.1);
    updateHud();
    if (timeLeft <= 0) { clearInterval(timerId); timerId = 0; endGame(); }
  }
  function start() {
    if (state === 'running') return;
    (state === 'over' ? function (cb) { MG.adBreak('next', 'gem-match-restart', cb); } : function (cb) { cb(); })(function () {
      fillBoard(); buildCells();
      score = 0; matchesMade = 0; bestCombo = 0; timeLeft = TIME_LIMIT;
      sel = null; cursor = { x: 3, y: 3 }; busy = false; hintPair = null;
      renderBoard(); updateHud();
      state = 'running'; overlay.hidden = true;
      pauseBtn.innerHTML = ICON.pause; pauseBtn.setAttribute('aria-label', 'Pause');
      MG.event('game_start', {}); MG.sfx.tap();
      clearInterval(timerId); timerId = setInterval(tick, 100);
    });
  }
  function pause() {
    if (state !== 'running') return;
    state = 'paused'; clearInterval(timerId); timerId = 0;
    pauseBtn.innerHTML = ICON.play; pauseBtn.setAttribute('aria-label', 'Resume');
    showOverlay('paused');
  }
  function resume() {
    if (state !== 'paused') return;
    state = 'running'; overlay.hidden = true;
    pauseBtn.innerHTML = ICON.pause; pauseBtn.setAttribute('aria-label', 'Pause');
    clearInterval(timerId); timerId = setInterval(tick, 100);
  }
  pauseBtn.addEventListener('click', function () { if (state === 'running') pause(); else if (state === 'paused') resume(); else start(); });
  MG.onPause(pause);
  function endGame() {
    state = 'over';
    var isBest = score > best();
    if (isBest) setBest(score);
    MG.event('game_over', { score: score, best: isBest, matches: matchesMade });
    live.textContent = 'Time up. Score ' + score + '.';
    showOverlay('over', isBest);
    if (isBest && score > 0) { MG.sfx.win(); MG.confetti(); } else MG.sfx.lose();
  }

  /* ---------------------------------------------------------------- overlay */
  var bestLine = h('p', { class: 'mg-hint' });
  function showOverlay(kind, isBest) {
    overlay.innerHTML = '';
    var card;
    if (kind === 'paused') {
      card = h('div', { class: 'mg-card' },
        h('h2', { class: 'mg-title', text: 'Paused' }), h('p', { class: 'mg-sub', text: 'Score ' + score + ' · ' + Math.ceil(timeLeft) + 's left' }),
        h('button', { class: 'mg-btn', type: 'button', onclick: resume, text: 'Resume' }),
        h('p', { class: 'mg-hint', html: 'Press <span class="mg-kbd">Space</span> to resume' }));
    } else {
      bestLine.textContent = 'Best: ' + best() + (matchesMade ? ' · ' + matchesMade + ' matches' : '');
      var over = kind === 'over';
      card = h('div', { class: 'mg-card' },
        h('h2', { class: 'mg-title', text: over ? 'Time’s up!' : 'Gem Match' }),
        over ? h('div', { class: 'mg-big', text: String(score) }) : h('p', { class: 'mg-sub', text: 'Swap neighbouring gems to line up three or more of a kind. You have 60 seconds — every match scores, and chain reactions multiply the points.' }),
        over && isBest ? h('span', { class: 'mg-badge', text: 'New best!' }) : null,
        h('button', { class: 'mg-btn', type: 'button', onclick: function () { start(); }, text: over ? 'Play again' : 'Play' }),
        bestLine,
        h('p', { class: 'mg-hint', html: matchMedia('(pointer: coarse)').matches ? 'Tap a gem, then tap a neighbour — or just swipe a gem' : 'Click a gem, then a neighbour — or drag a gem · Arrow keys move the cursor, Enter selects' }));
    }
    overlay.append(card); overlay.hidden = false;
    var btn = card.querySelector('.mg-btn');
    if (btn) MG.focusSafe(btn);
  }

  /* ---------------------------------------------------------------- input */
  document.addEventListener('keydown', function (e) {
    if (e.key === ' ' || e.code === 'Space' || e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
      e.preventDefault();
      if (state === 'running') pause(); else if (state === 'paused') resume(); else if (e.key === ' ' || e.code === 'Space') start();
      return;
    }
    if (state !== 'running' || busy) return;
    var k = e.key;
    if (k === 'Enter') {
      e.preventDefault();
      if (!sel) { sel = { x: cursor.x, y: cursor.y }; MG.sfx.tap(); renderBoard(); }
      else if (sel.x === cursor.x && sel.y === cursor.y) { sel = null; renderBoard(); }
      return;
    }
    var d = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[k];
    if (!d) return;
    e.preventDefault();
    var nx = cursor.x + d[0], ny = cursor.y + d[1];
    if (!inBoard(nx, ny)) return;
    if (sel) {
      var a = sel; sel = null;
      attemptSwap(a, { x: nx, y: ny });
    } else { cursor = { x: nx, y: ny }; renderBoard(); }
  });
  overlay.addEventListener('click', function (e) {
    if (e.target !== overlay) return;
    if (state === 'paused') resume(); else if (state === 'idle' || state === 'over') start();
  });

  /* ---------------------------------------------------------------- boot */
  if (SHOW) {
    // A single still frame for cover art: a full board with a glowing three-in-a-row.
    fillBoard();
    // force a red three-in-a-row across the middle, highlighted as a hint
    board[3][2] = 0; board[3][3] = 0; board[3][4] = 0;
    board[2][3] = 1; board[4][3] = 2; board[3][1] = 4; board[3][5] = 3;
    buildCells(); renderBoard();
    hintPair = [{ x: 3, y: 3 }, { x: 4, y: 3 }]; renderBoard();
    state = 'showcase';
    document.documentElement.setAttribute('data-ready', '1');
  } else {
    fillBoard(); buildCells(); renderBoard(); updateHud();
    showOverlay('idle');
    MG.ready();
  }
})();
