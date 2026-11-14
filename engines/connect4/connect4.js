/* Connect Four engine: drop discs into seven columns, line up four in a row.
 * Players: 1 = red (you), 2 = yellow (computer or player two).
 * Options: { showcase: true } still frame for cover art. */
(function () {
  'use strict';
  var MG = window.MG, h = MG.h, o = window.GAME_OPTIONS || {};
  var COLS = 7, ROWS = 6, WIN = 4, CELLS = COLS * ROWS;
  var RED = 1, YEL = 2;

  var ICON = {
    soundOn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z" fill="currentColor"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>',
    soundOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z" fill="currentColor"/><path d="m16 9 6 6M22 9l-6 6"/></svg>'
  };

  /* ---------- rules (pure, operate on a board array) ---------- */
  function idx(r, c) { return r * COLS + c; }
  function lowestEmpty(bd, c) {
    for (var r = ROWS - 1; r >= 0; r--) if (!bd[idx(r, c)]) return r;
    return -1;
  }
  function winAt(bd, r, c, p) { // lines through the last placed disc
    var dirs = [[0, 1], [1, 0], [1, 1], [1, -1]], line;
    for (var d = 0; d < dirs.length; d++) {
      var dr = dirs[d][0], dc = dirs[d][1], cells = [idx(r, c)], k;
      for (k = 1; k < WIN; k++) { var rr = r + dr * k, cc = c + dc * k; if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS || bd[idx(rr, cc)] !== p) break; cells.push(idx(rr, cc)); }
      for (k = 1; k < WIN; k++) { rr = r - dr * k; cc = c - dc * k; if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS || bd[idx(rr, cc)] !== p) break; cells.push(idx(rr, cc)); }
      if (cells.length >= WIN) return cells.slice(0, WIN);
    }
    return null;
  }
  function full(bd) { for (var c = 0; c < COLS; c++) if (lowestEmpty(bd, c) >= 0) return false; return true; }
  function immediateWin(bd, p) {
    for (var c = 0; c < COLS; c++) {
      var r = lowestEmpty(bd, c); if (r < 0) continue;
      bd[idx(r, c)] = p;
      var w = winAt(bd, r, c, p);
      bd[idx(r, c)] = 0;
      if (w) return c;
    }
    return -1;
  }
  function evaluate(bd, me) {
    var opp = 3 - me, sc = 0;
    function windowScore(a, b, c, d) {
      var mine = 0, theirs = 0, empty = 0;
      [a, b, c, d].forEach(function (v) { if (v === me) mine++; else if (v === opp) theirs++; else empty++; });
      if (mine && theirs) return 0;
      if (mine === 4) return 100000;
      if (theirs === 4) return -100000;
      if (mine === 3 && empty === 1) return 60;
      if (theirs === 3 && empty === 1) return -70;
      if (mine === 2 && empty === 2) return 8;
      if (theirs === 2 && empty === 2) return -9;
      if (mine === 1 && empty === 3) return 1;
      return 0;
    }
    var r, c;
    for (r = 0; r < ROWS; r++) for (c = 0; c + 3 < COLS; c++) sc += windowScore(bd[idx(r, c)], bd[idx(r, c + 1)], bd[idx(r, c + 2)], bd[idx(r, c + 3)]);
    for (c = 0; c < COLS; c++) for (r = 0; r + 3 < ROWS; r++) sc += windowScore(bd[idx(r, c)], bd[idx(r + 1, c)], bd[idx(r + 2, c)], bd[idx(r + 3, c)]);
    for (r = 0; r + 3 < ROWS; r++) for (c = 0; c + 3 < COLS; c++) sc += windowScore(bd[idx(r, c)], bd[idx(r + 1, c + 1)], bd[idx(r + 2, c + 2)], bd[idx(r + 3, c + 3)]);
    for (r = 0; r + 3 < ROWS; r++) for (c = 3; c < COLS; c++) sc += windowScore(bd[idx(r, c)], bd[idx(r + 1, c - 1)], bd[idx(r + 2, c - 2)], bd[idx(r + 3, c - 3)]);
    for (c = 0; c < COLS; c++) { // centre columns are worth more
      var w = 3 - Math.abs(c - 3);
      for (r = 0; r < ROWS; r++) if (bd[idx(r, c)] === me) sc += w; else if (bd[idx(r, c)] === opp) sc -= w;
    }
    return sc;
  }
  var ABORT = {}, deadline = 0, nodes = 0;
  function search(bd, depth, alpha, beta, p, me, ply) {
    if (depth === 0 || full(bd)) return evaluate(bd, me);
    if ((++nodes & 1023) === 0 && performance.now() > deadline) throw ABORT;
    var order = [3, 2, 4, 1, 5, 0, 6], maximizing = p === me, best = maximizing ? -Infinity : Infinity;
    for (var k = 0; k < order.length; k++) {
      var c = order[k], r = lowestEmpty(bd, c); if (r < 0) continue;
      bd[idx(r, c)] = p;
      var w = winAt(bd, r, c, p);
      var v = w ? (p === me ? 100000 - ply : -100000 + ply) : search(bd, depth - 1, alpha, beta, 3 - p, me, ply + 1);
      bd[idx(r, c)] = 0;
      if (maximizing) { if (v > best) best = v; if (best > alpha) alpha = best; }
      else { if (v < best) best = v; if (best < beta) beta = best; }
      if (beta <= alpha) break;
    }
    return best;
  }
  function chooseMove(bd, me, level) {
    var win = immediateWin(bd, me), block = immediateWin(bd, 3 - me);
    if (level === 'easy') {
      if (win >= 0 && Math.random() < 0.6) return win;
      if (block >= 0 && Math.random() < 0.3) return block;
      var open = []; for (var c = 0; c < COLS; c++) if (lowestEmpty(bd, c) >= 0) open.push(c);
      return open[(Math.random() * open.length) | 0];
    }
    if (win >= 0) return win;
    if (level === 'medium') {
      if (block >= 0 && Math.random() < 0.85) return block;
      if (Math.random() < 0.25) { var o2 = []; for (var c2 = 0; c2 < COLS; c2++) if (lowestEmpty(bd, c2) >= 0) o2.push(c2); return o2[(Math.random() * o2.length) | 0]; }
    } else if (block >= 0) {
      // hard: only skip a block when the search finds something better
      var quick = search(bd.slice(), 3, -Infinity, Infinity, me, me, 0);
      if (quick < 50000) return block;
    }
    var maxDepth = level === 'hard' ? 6 : 3;
    deadline = performance.now() + (level === 'hard' ? 450 : 150); nodes = 0;
    var choices = [block >= 0 ? block : 3], best = -Infinity;
    for (var d = 2; d <= maxDepth; d++) {
      try {
        var cur = [], curBest = -Infinity;
        [3, 2, 4, 1, 5, 0, 6].forEach(function (c) {
          var r = lowestEmpty(bd, c); if (r < 0) return;
          bd[idx(r, c)] = me;
          var w = winAt(bd, r, c, me);
          var v = w ? 100000 : search(bd, d - 1, -Infinity, Infinity, 3 - me, me, 1);
          bd[idx(r, c)] = 0;
          if (v > curBest) { curBest = v; cur = [c]; } else if (v === curBest) cur.push(c);
        });
        choices = cur; best = curBest;
        if (best > 90000) break;
      } catch (err) { if (err !== ABORT) throw err; break; }
    }
    return choices[(Math.random() * choices.length) | 0];
  }

  /* ---------- settings + persistent score ---------- */
  var mode = MG.store.get('mode', 'cpu');      // 'cpu' | 'pvp'
  var level = MG.store.get('level', 'medium'); // 'easy' | 'medium' | 'hard'
  function scoreKey() { return 'score-' + mode + (mode === 'cpu' ? '-' + level : ''); }
  var scores = MG.store.get(scoreKey(), { r: 0, y: 0, d: 0 });

  var board = new Array(CELLS).fill(0), turn = RED, over = false, winLine = null, starter = RED, busy = false, cpuTimer = 0, lastPlaced = -1, moves = 0, hoverCol = -1;

  /* ---------- DOM ---------- */
  var rScore = h('b'), yScore = h('b'), dScore = h('b'), rLabel = h('small'), yLabel = h('small');
  var soundBtn = h('button', { class: 'mg-icon-btn', type: 'button' });
  var cols = h('div', { class: 'cf-cols', role: 'group', 'aria-label': 'Choose a column' });
  var colBtns = [];
  for (var ci = 0; ci < COLS; ci++) {
    var cb = h('button', { class: 'cf-col', type: 'button', 'data-c': String(ci), 'aria-label': 'Drop a disc in column ' + (ci + 1) },
      h('span', { class: 'cf-arrow', 'aria-hidden': 'true', text: '▼' }));
    cb.addEventListener('click', onColumn.bind(null, ci));
    cb.addEventListener('pointerenter', preview.bind(null, ci, true));
    cb.addEventListener('pointerleave', preview.bind(null, ci, false));
    colBtns.push(cb); cols.append(cb);
  }
  var grid = h('div', { class: 'cf-grid', role: 'grid', 'aria-label': 'Connect Four board, 7 columns by 6 rows' });
  var cellEls = [];
  for (var ii = 0; ii < CELLS; ii++) {
    var cell = h('div', { class: 'cf-cell', role: 'gridcell', 'data-i': String(ii), 'data-v': '0' },
      h('span', { class: 'cf-disc' }));
    cell.addEventListener('click', onColumn.bind(null, ii % COLS));
    cellEls.push(cell); grid.append(cell);
  }
  var boardWrap = h('div', { class: 'cf-board' }, cols, grid);
  var status = h('p', { class: 'cf-status', 'aria-live': 'polite' });
  var nextBtn = h('button', { class: 'mg-btn is-small', type: 'button', text: 'Play again', hidden: true });
  var overlay = h('div', { class: 'mg-overlay', hidden: true });
  var opts = MG.options({
    overlay: overlay, title: 'Game options',
    summary: function () { return mode === 'cpu' ? 'vs Computer \u00b7 ' + level.charAt(0).toUpperCase() + level.slice(1) : '2 Players'; },
    groups: [
      { label: 'Mode', items: [['cpu', 'vs Computer'], ['pvp', '2 Players']], get: function () { return mode; },
        set: function (v) { mode = v; MG.store.set('mode', v); loadScores(); newRound(true); } },
      { label: 'Difficulty', items: [['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard']], get: function () { return level; },
        set: function (v) { level = v; MG.store.set('level', v); loadScores(); newRound(true); }, visible: function () { return mode === 'cpu'; } }
    ],
    extra: function () {
      var r = h('button', { class: 'mg-linkbtn', type: 'button', text: 'Reset score' });
      r.addEventListener('click', function () { scores = { r: 0, y: 0, d: 0 }; MG.store.set(scoreKey(), scores); renderScores(); MG.sfx.tap(); r.textContent = 'Score reset'; });
      return [r];
    }
  });
  var rootEl = h('div', { class: 'mg-root cf' },
    h('div', { class: 'mg-hud' },
      h('span', { class: 'mg-pill cf-red' }, rLabel, rScore),
      h('span', { class: 'mg-pill' }, h('small', { text: 'Draw' }), dScore),
      h('span', { class: 'mg-pill cf-yel' }, yLabel, yScore),
      h('span', { class: 'mg-spacer' }), soundBtn),
    h('div', { class: 'cf-main' }, h('div', { class: 'cf-inner' }, boardWrap,
      h('div', { class: 'cf-statusrow' }, status, nextBtn))),
    h('div', { class: 'cf-bar' }, opts.el),
    overlay);
  document.getElementById('game').append(rootEl);

  function renderSound() {
    soundBtn.innerHTML = MG.sound.muted ? ICON.soundOff : ICON.soundOn;
    soundBtn.setAttribute('aria-label', MG.sound.muted ? 'Turn sound on' : 'Turn sound off');
  }
  soundBtn.addEventListener('click', function () { MG.sound.toggle(); renderSound(); });
  nextBtn.addEventListener('click', function () { MG.adBreak('next', 'cf-next', function () { newRound(false); }); });
  function loadScores() { scores = MG.store.get(scoreKey(), { r: 0, y: 0, d: 0 }); renderScores(); }
  function renderScores() {
    rLabel.textContent = mode === 'cpu' ? 'You' : 'Red';
    yLabel.textContent = mode === 'cpu' ? 'CPU' : 'Yellow';
    rScore.textContent = scores.r; yScore.textContent = scores.y; dScore.textContent = scores.d;
  }

  /* ---------- flow ---------- */
  function newRound(resetStarter) {
    clearTimeout(cpuTimer); busy = false; hoverCol = -1;
    starter = resetStarter ? RED : 3 - starter;
    board = new Array(CELLS).fill(0); turn = starter; over = false; winLine = null; lastPlaced = -1; moves = 0;
    nextBtn.hidden = true; rootEl.classList.remove('is-over');
    render();
    MG.event('game_start', { mode: mode });
    if (mode === 'cpu' && turn === YEL) cpuTurn();
  }
  function drop(c) {
    if (over) return;
    var r = lowestEmpty(board, c); if (r < 0) return;
    board[idx(r, c)] = turn; lastPlaced = idx(r, c); moves++;
    MG.sfx.place(); MG.vibrate(8);
    var w = winAt(board, r, c, turn);
    render();
    if (w) { finish(turn, w); return; }
    if (full(board)) { finish(0, null); return; }
    turn = 3 - turn; render();
    if (mode === 'cpu' && turn === YEL) cpuTurn();
  }
  function cpuTurn() {
    busy = true; render();
    var started = performance.now();
    cpuTimer = setTimeout(function () {
      var c = chooseMove(board.slice(), YEL, level);
      var wait = Math.max(0, 420 - (performance.now() - started));
      cpuTimer = setTimeout(function () { busy = false; if (c >= 0) drop(c); }, wait);
    }, 30);
  }
  function finish(p, line) {
    over = true; winLine = line;
    if (p === RED) scores.r++; else if (p === YEL) scores.y++; else scores.d++;
    MG.store.set(scoreKey(), scores); renderScores();
    var result = p === 0 ? 'draw' : mode === 'cpu' ? (p === RED ? 'win' : 'lose') : 'win';
    if (result === 'win') { MG.sfx.win(); MG.confetti(); } else if (result === 'lose') MG.sfx.lose(); else MG.sfx.draw();
    MG.event('game_over', { result: result, mode: mode });
    rootEl.classList.add('is-over'); nextBtn.hidden = false;
    render();
    setTimeout(function () { if (over) MG.focusSafe(nextBtn); }, 60);
  }
  function render() {
    var locked = over || busy || (mode === 'cpu' && turn === YEL);
    for (var i = 0; i < CELLS; i++) {
      var v = board[i], el = cellEls[i];
      el.setAttribute('data-v', String(v));
      el.classList.toggle('is-new', i === lastPlaced);
      el.classList.toggle('is-win', !!(winLine && winLine.indexOf(i) >= 0));
      el.classList.remove('is-preview'); // a dropped disc must never keep the ghost preview
      el.setAttribute('aria-label', 'Row ' + (((i / COLS) | 0) + 1) + ', column ' + (i % COLS + 1) + ': ' +
        (v === RED ? 'red' : v === YEL ? 'yellow' : 'empty'));
    }
    if (hoverCol >= 0 && !over && !busy && !(mode === 'cpu' && turn === YEL)) {
      var pr = lowestEmpty(board, hoverCol);
      if (pr >= 0) cellEls[idx(pr, hoverCol)].classList.add('is-preview');
    }
    for (var c = 0; c < COLS; c++) colBtns[c].classList.toggle('is-full', lowestEmpty(board, c) < 0);
    rootEl.setAttribute('data-turn', turn === RED ? 'red' : 'yellow');
    rootEl.classList.toggle('is-thinking', busy);
    var t;
    if (over) {
      if (!winLine) t = 'It’s a draw — the board is full!';
      else if (mode === 'cpu') { var youWon = board[winLine[0]] === RED; t = youWon ? 'You win! Four in a row!' : 'Computer wins'; status.className = 'cf-status' + (youWon ? ' is-good' : ' is-bad'); }
      else { t = (board[winLine[0]] === RED ? 'Red' : 'Yellow') + ' wins! Four in a row!'; status.className = 'cf-status is-good'; }
    } else if (busy) t = 'Computer is thinking…';
    else if (mode === 'cpu') t = moves === 0 && turn === RED ? 'You go first — tap a column to drop a red disc' : 'Your turn — tap a column';
    else t = (turn === RED ? 'Red' : 'Yellow') + '’s turn — tap a column';
    if (!over) status.className = 'cf-status';
    status.textContent = t;
  }
  function onColumn(c) {
    if (over || busy || (mode === 'cpu' && turn === YEL)) return;
    drop(c);
  }
  function preview(c, on) {
    hoverCol = on ? c : -1;
    for (var r = 0; r < ROWS; r++) cellEls[idx(r, c)].classList.remove('is-preview');
    if (!on || over || busy || (mode === 'cpu' && turn === YEL)) return;
    var r2 = lowestEmpty(board, c); if (r2 < 0) return;
    cellEls[idx(r2, c)].classList.add('is-preview');
  }
  document.addEventListener('keydown', function (e) {
    if (!overlay.hidden) { if (e.key === 'Escape') opts.close(); return; }
    if (/^[1-7]$/.test(e.key)) { e.preventDefault(); onColumn(+e.key - 1); }
    else if ((e.key === 'Enter' || e.key === ' ') && over && !(document.activeElement && document.activeElement.closest('button'))) { e.preventDefault(); nextBtn.click(); }
  });

  renderSound(); renderScores(); render();
  if (o.showcase) { // still frame for cover art: red wins on a diagonal, board well under way
    rootEl.classList.add('is-showcase');
    var demo = [[5, 0, RED], [5, 1, YEL], [4, 1, RED], [5, 2, YEL], [4, 2, YEL], [3, 2, RED], [5, 3, YEL], [4, 3, YEL], [3, 3, YEL], [2, 3, RED], [5, 4, RED], [5, 5, YEL], [5, 6, RED], [4, 6, YEL]];
    demo.forEach(function (m) { board[idx(m[0], m[1])] = m[2]; });
    over = true; winLine = [idx(5, 0), idx(4, 1), idx(3, 2), idx(2, 3)]; lastPlaced = -1; moves = demo.length;
    scores = { r: 3, y: 1, d: 0 }; renderScores(); render();
    document.documentElement.setAttribute('data-ready', '1');
  }
  MG.ready();
})();
