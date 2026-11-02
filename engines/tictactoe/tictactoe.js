/* Tic Tac Toe engine.
 * Options: { size: 3|4, win: 3|4, maxPieces: 0 (unlimited) | n (oldest piece vanishes), drawAfter: moves }
 * Players: 1 = X, 2 = O. In "vs computer" mode the human is always X. */
(function () {
  'use strict';
  var MG = window.MG, h = MG.h;
  var o = window.GAME_OPTIONS || {};
  var N = o.size || 3, K = o.win || N, MAXP = o.maxPieces || 0;
  var CELLS = N * N;
  var DRAW_AFTER = o.drawAfter || (MAXP ? 40 : CELLS);
  var LINES = buildLines();
  var LINES_AT = []; // lines through each cell
  for (var c0 = 0; c0 < CELLS; c0++) LINES_AT.push(LINES.filter(function (L) { return L.indexOf(c0) >= 0; }));

  var ICON = {
    soundOn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z" fill="currentColor"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>',
    soundOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z" fill="currentColor"/><path d="m16 9 6 6M22 9l-6 6"/></svg>',
    restart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4h4"/></svg>'
  };
  // Pieces are drawn as lacquered tokens: a cast shadow, a dark rim, a gradient body and a highlight.
  var X_D = 'M28 28 72 72M72 28 28 72';
  var X_SVG = '<svg viewBox="0 0 100 100" aria-hidden="true"><path class="pc-sh" transform="translate(2.5 5)" d="' + X_D + '"/><path class="pc-rim" d="' + X_D + '"/><path class="pc-body x" d="' + X_D + '"/><path class="pc-hi" transform="translate(-1.6 -2.2)" d="M31 29 50 48M69 29 61 37"/></svg>';
  var O_SVG = '<svg viewBox="0 0 100 100" aria-hidden="true"><circle class="pc-sh" cx="52.5" cy="55" r="24"/><circle class="pc-rim" cx="50" cy="50" r="24"/><circle class="pc-body o" cx="50" cy="50" r="24"/><path class="pc-hi" d="M32 41 A20 20 0 0 1 45 29"/></svg>';
  if (!document.getElementById('ttt-defs')) {
    var defs = document.createElement('div');
    defs.innerHTML = '<svg id="ttt-defs" width="0" height="0" style="position:absolute" aria-hidden="true"><defs>' +
      '<linearGradient id="tttX" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF9470"/><stop offset=".5" stop-color="#EA4A1F"/><stop offset="1" stop-color="#B02C0B"/></linearGradient>' +
      '<linearGradient id="tttO" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9CC0FF"/><stop offset=".5" stop-color="#3270FF"/><stop offset="1" stop-color="#1A44BE"/></linearGradient>' +
      '</defs></svg>';
    document.body.appendChild(defs.firstChild);
  }

  function buildLines() {
    var L = [], r, c, i, line;
    for (r = 0; r < N; r++) for (c = 0; c + K <= N; c++) { line = []; for (i = 0; i < K; i++) line.push(r * N + c + i); L.push(line); }
    for (c = 0; c < N; c++) for (r = 0; r + K <= N; r++) { line = []; for (i = 0; i < K; i++) line.push((r + i) * N + c); L.push(line); }
    for (r = 0; r + K <= N; r++) for (c = 0; c + K <= N; c++) {
      line = []; for (i = 0; i < K; i++) line.push((r + i) * N + c + i); L.push(line);
      line = []; for (i = 0; i < K; i++) line.push((r + i) * N + c + K - 1 - i); L.push(line);
    }
    return L;
  }

  /* ---------- rules (pure, operate on a state object) ---------- */
  function newState() { return { board: new Array(CELLS).fill(0), pieces: { 1: [], 2: [] }, moves: 0 }; }
  function cloneState(s) { return { board: s.board.slice(), pieces: { 1: s.pieces[1].slice(), 2: s.pieces[2].slice() }, moves: s.moves }; }
  function apply(s, i, p) {
    var removed = -1;
    if (MAXP && s.pieces[p].length === MAXP) { removed = s.pieces[p].shift(); s.board[removed] = 0; }
    s.board[i] = p; s.pieces[p].push(i); s.moves++;
    return removed;
  }
  function undo(s, i, p, removed) {
    s.board[i] = 0; s.pieces[p].pop(); s.moves--;
    if (removed >= 0) { s.board[removed] = p; s.pieces[p].unshift(removed); }
  }
  function winAt(bd, i, p) { // only lines through the last placed cell can be new wins
    var ls = LINES_AT[i];
    for (var l = 0; l < ls.length; l++) {
      var L = ls[l], ok = true;
      for (var j = 0; j < L.length; j++) if (bd[L[j]] !== p) { ok = false; break; }
      if (ok) return L;
    }
    return null;
  }
  function empties(bd) { var e = []; for (var i = 0; i < CELLS; i++) if (!bd[i]) e.push(i); return e; }
  function isDrawn(s) { return s.moves >= DRAW_AFTER || (!MAXP && s.moves >= CELLS); }

  /* ---------- AI: iterative-deepening alpha-beta with a time budget ---------- */
  var ABORT = {}, deadline = 0, nodes = 0;
  function evaluate(s, me) {
    var opp = 3 - me, sc = 0, W = [0, 1, 6, 40, 200];
    var vMe = MAXP && s.pieces[me].length === MAXP ? s.pieces[me][0] : -1;
    var vOp = MAXP && s.pieces[opp].length === MAXP ? s.pieces[opp][0] : -1;
    for (var l = 0; l < LINES.length; l++) {
      var L = LINES[l], a = 0, b = 0, blockedA = false, blockedB = false;
      for (var j = 0; j < L.length; j++) {
        var c = L[j], v = s.board[c];
        if (v === me) { if (c !== vMe) a++; blockedB = true; }
        else if (v === opp) { if (c !== vOp) b++; blockedA = true; }
      }
      if (a && !blockedA) sc += W[a];
      if (b && !blockedB) sc -= W[b];
    }
    return sc;
  }
  function order(s, list, p) {
    var c = (N - 1) / 2;
    return list.map(function (i) {
      var d = Math.abs(i % N - c) + Math.abs(((i / N) | 0) - c);
      return [i, -d + (Math.random() * 0.01)];
    }).sort(function (a, b) { return b[1] - a[1]; }).map(function (x) { return x[0]; });
  }
  function search(s, depth, alpha, beta, p, me, ply, last, lastP) {
    if (last >= 0 && winAt(s.board, last, lastP)) return (lastP === me ? 1 : -1) * (10000 - ply);
    if (isDrawn(s)) return 0;
    if (depth === 0) return evaluate(s, me);
    if ((++nodes & 1023) === 0 && performance.now() > deadline) throw ABORT;
    var list = order(s, empties(s.board), p), maximizing = p === me, best = maximizing ? -Infinity : Infinity;
    for (var m = 0; m < list.length; m++) {
      var i = list[m], rem = apply(s, i, p);
      var v = search(s, depth - 1, alpha, beta, 3 - p, me, ply + 1, i, p);
      undo(s, i, p, rem);
      if (maximizing) { if (v > best) best = v; if (best > alpha) alpha = best; }
      else { if (v < best) best = v; if (best < beta) beta = best; }
      if (beta <= alpha) break;
    }
    return best;
  }
  function immediateWin(s, p) {
    var e = empties(s.board);
    for (var k = 0; k < e.length; k++) { var rem = apply(s, e[k], p), w = winAt(s.board, e[k], p); undo(s, e[k], p, rem); if (w) return e[k]; }
    return -1;
  }
  function chooseMove(live, me, level) {
    var s = cloneState(live), e = empties(s.board);
    if (!e.length) return -1;
    var rnd = e[(Math.random() * e.length) | 0];
    var win = immediateWin(s, me), block = immediateWin(s, 3 - me);
    if (level === 'easy') {
      if (win >= 0 && Math.random() < 0.6) return win;
      if (block >= 0 && Math.random() < 0.3) return block;
      return rnd;
    }
    if (win >= 0) return win;
    if (level === 'medium') {
      if (block >= 0 && Math.random() < 0.8) return block;
      if (Math.random() < 0.3) return rnd;
    }
    var maxDepth = level === 'hard' ? 12 : (MAXP ? 3 : 2);
    deadline = performance.now() + (level === 'hard' ? 600 : 120); nodes = 0;
    var choices = [block >= 0 ? block : rnd];
    for (var d = 1; d <= maxDepth; d++) {
      try {
        var best = -Infinity, cur = [], list = order(s, e, me);
        for (var m = 0; m < list.length; m++) {
          var i = list[m], rem = apply(s, i, me);
          var v = search(s, d - 1, -Infinity, Infinity, 3 - me, me, 1, i, me);
          undo(s, i, me, rem);
          if (v > best) { best = v; cur = [i]; } else if (v === best) cur.push(i);
        }
        choices = cur;
        if (best > 9000 || best < -9000) break; // forced result found
        if (!MAXP && d >= CELLS - s.moves) break; // searched to the end
      } catch (err) {
        if (err !== ABORT) throw err;
        s = cloneState(live); break; // keep the previous depth's answer
      }
    }
    return choices[(Math.random() * choices.length) | 0];
  }

  /* ---------- settings + persistent score ---------- */
  var mode = MG.store.get('mode', 'cpu');      // 'cpu' | 'pvp'
  var level = MG.store.get('level', 'medium'); // 'easy' | 'medium' | 'hard'
  function scoreKey() { return 'score-' + mode + (mode === 'cpu' ? '-' + level : ''); }
  var scores = MG.store.get(scoreKey(), { x: 0, o: 0, d: 0 });

  var S = newState(), turn = 1, over = false, winLine = null, starter = 1, busy = false, cpuTimer = 0, lastPlaced = -1;

  /* ---------- DOM ---------- */
  var xScore = h('b'), oScore = h('b'), dScore = h('b'), xLabel = h('small'), oLabel = h('small');
  var soundBtn = h('button', { class: 'mg-icon-btn', type: 'button' });
  var grid = h('div', { class: 'ttt-grid', role: 'grid', 'aria-label': 'Tic Tac Toe board, ' + N + ' by ' + N });
  grid.style.setProperty('--n', N);
  var lineSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  lineSvg.setAttribute('class', 'ttt-line'); lineSvg.setAttribute('viewBox', '0 0 100 100'); lineSvg.setAttribute('aria-hidden', 'true');
  var boardWrap = h('div', { class: 'ttt-board' }, grid, lineSvg);
  var status = h('p', { class: 'ttt-status', 'aria-live': 'polite' });
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
      r.addEventListener('click', function () { scores = { x: 0, o: 0, d: 0 }; MG.store.set(scoreKey(), scores); renderScores(); MG.sfx.tap(); r.textContent = 'Score reset'; });
      return [r];
    }
  });
  var cells = [];
  for (var ci = 0; ci < CELLS; ci++) {
    var cb = h('button', { class: 'ttt-cell', type: 'button', role: 'gridcell', tabindex: ci === 0 ? '0' : '-1', 'data-i': String(ci) });
    cb.addEventListener('click', onCell);
    cells.push(cb); grid.append(cb);
  }
  var rule = MAXP ? h('p', { class: 'ttt-rule', html: 'You can only keep <b>' + MAXP + '</b> pieces. Your faded piece vanishes when you place the next one.' }) : null;
  var rootEl = h('div', { class: 'mg-root ttt ttt-' + N },
    h('div', { class: 'mg-hud' },
      h('span', { class: 'mg-pill ttt-x' }, xLabel, xScore),
      h('span', { class: 'mg-pill' }, h('small', { text: 'Draw' }), dScore),
      h('span', { class: 'mg-pill ttt-o' }, oLabel, oScore),
      h('span', { class: 'mg-spacer' }), soundBtn),
    h('div', { class: 'ttt-main' }, h('div', { class: 'ttt-inner' }, boardWrap,
      h('div', { class: 'ttt-statusrow' }, status, nextBtn), rule)),
    h('div', { class: 'ttt-bar' }, opts.el),
    overlay);
  document.getElementById('game').append(rootEl);

  function renderSound() {
    soundBtn.innerHTML = MG.sound.muted ? ICON.soundOff : ICON.soundOn;
    soundBtn.setAttribute('aria-label', MG.sound.muted ? 'Turn sound on' : 'Turn sound off');
  }
  soundBtn.addEventListener('click', function () { MG.sound.toggle(); renderSound(); });
  nextBtn.addEventListener('click', function () { MG.adBreak('next', 'ttt-next', function () { newRound(false); }); });
  function loadScores() { scores = MG.store.get(scoreKey(), { x: 0, o: 0, d: 0 }); renderScores(); }
  function renderScores() {
    xLabel.textContent = mode === 'cpu' ? 'You' : 'X';
    oLabel.textContent = mode === 'cpu' ? 'CPU' : 'O';
    xScore.textContent = scores.x; oScore.textContent = scores.o; dScore.textContent = scores.d;
  }

  /* ---------- flow ---------- */
  function newRound(resetStarter) {
    clearTimeout(cpuTimer); busy = false;
    starter = resetStarter ? 1 : 3 - starter;
    S = newState(); turn = starter; over = false; winLine = null; lastPlaced = -1;
    nextBtn.hidden = true; lineSvg.innerHTML = ''; rootEl.classList.remove('is-over');
    render();
    MG.event('game_start', { mode: mode });
    if (mode === 'cpu' && turn === 2) cpuTurn();
  }
  function place(i) {
    if (over || S.board[i]) return;
    apply(S, i, turn); lastPlaced = i;
    MG.sfx.place(); MG.vibrate(8);
    var w = winAt(S.board, i, turn);
    if (w) { finish(turn, w); return; }
    if (isDrawn(S)) { finish(0, null); return; }
    turn = 3 - turn; render();
    if (mode === 'cpu' && turn === 2) cpuTurn();
  }
  function cpuTurn() {
    busy = true; render();
    var started = performance.now();
    cpuTimer = setTimeout(function () {
      var i = chooseMove(S, 2, level);
      var wait = Math.max(0, 420 - (performance.now() - started));
      cpuTimer = setTimeout(function () { busy = false; if (i >= 0) place(i); }, wait);
    }, 30);
  }
  function finish(p, line) {
    over = true; winLine = line;
    if (p === 1) scores.x++; else if (p === 2) scores.o++; else scores.d++;
    MG.store.set(scoreKey(), scores); renderScores();
    var result = p === 0 ? 'draw' : mode === 'cpu' ? (p === 1 ? 'win' : 'lose') : 'win';
    if (result === 'win') { MG.sfx.win(); MG.confetti(); } else if (result === 'lose') MG.sfx.lose(); else MG.sfx.draw();
    MG.event('game_over', { result: result, mode: mode });
    if (line) drawWinLine(line);
    rootEl.classList.add('is-over'); nextBtn.hidden = false;
    render();
    setTimeout(function () { if (over) { try { nextBtn.focus({ preventScroll: true }); } catch (e) { /* ignore */ } } }, 60);
  }
  function drawWinLine(line) {
    var a = line[0], b = line[line.length - 1], s = 100 / N;
    var x1 = (a % N + .5) * s, y1 = (((a / N) | 0) + .5) * s, x2 = (b % N + .5) * s, y2 = (((b / N) | 0) + .5) * s;
    var dx = x2 - x1, dy = y2 - y1, len = Math.sqrt(dx * dx + dy * dy), ext = s * 0.3;
    x1 -= dx / len * ext; y1 -= dy / len * ext; x2 += dx / len * ext; y2 += dy / len * ext;
    lineSvg.innerHTML = '<line pathLength="1" x1="' + x1.toFixed(2) + '" y1="' + y1.toFixed(2) + '" x2="' + x2.toFixed(2) + '" y2="' + y2.toFixed(2) + '"/>';
  }

  function render() {
    var fading = {};
    if (MAXP && !over) [1, 2].forEach(function (p) { if (S.pieces[p].length === MAXP) fading[S.pieces[p][0]] = p === turn ? 'next' : 'later'; });
    var locked = over || busy || (mode === 'cpu' && turn === 2);
    for (var i = 0; i < CELLS; i++) {
      var v = S.board[i], el = cells[i], want = v === 1 ? 'x' : v === 2 ? 'o' : '';
      if (el.getAttribute('data-v') !== want) {
        el.setAttribute('data-v', want);
        el.innerHTML = v === 1 ? X_SVG : v === 2 ? O_SVG : '';
      }
      el.classList.toggle('is-new', i === lastPlaced);
      el.classList.toggle('is-fading', !!fading[i]);
      el.classList.toggle('is-fading-next', fading[i] === 'next');
      el.classList.toggle('is-win', !!(winLine && winLine.indexOf(i) >= 0));
      el.setAttribute('aria-label', 'Row ' + (((i / N) | 0) + 1) + ', column ' + (i % N + 1) + ': ' +
        (v === 1 ? 'X' : v === 2 ? 'O' : 'empty') + (fading[i] ? ', vanishes soon' : ''));
      el.setAttribute('aria-disabled', String(!!(v || locked)));
    }
    rootEl.setAttribute('data-turn', turn === 1 ? 'x' : 'o');
    rootEl.classList.toggle('is-thinking', busy);
    status.className = 'ttt-status';
    var t;
    if (over) {
      if (!winLine) t = 'It’s a draw!';
      else if (mode === 'cpu') { var youWon = S.board[winLine[0]] === 1; t = youWon ? 'You win!' : 'Computer wins'; status.classList.add(youWon ? 'is-good' : 'is-bad'); }
      else { t = (S.board[winLine[0]] === 1 ? 'X' : 'O') + ' wins!'; status.classList.add('is-good'); }
    } else if (busy) t = 'Computer is thinking…';
    else if (mode === 'cpu') t = S.moves === 0 && turn === 1 ? 'You go first — you’re X' : 'Your turn';
    else t = (turn === 1 ? 'X' : 'O') + '’s turn';
    if (!over && MAXP && DRAW_AFTER - S.moves <= 10) t += ' · draw in ' + (DRAW_AFTER - S.moves);
    status.textContent = t;
  }

  function onCell(e) {
    var i = +e.currentTarget.getAttribute('data-i');
    if (over) { nextBtn.click(); return; }
    if (busy || (mode === 'cpu' && turn === 2) || S.board[i]) return;
    place(i);
  }
  grid.addEventListener('keydown', function (e) {
    var i = +(document.activeElement && document.activeElement.getAttribute('data-i'));
    if (isNaN(i)) return;
    var r = (i / N) | 0, c = i % N, j = -1;
    if (e.key === 'ArrowUp') j = ((r + N - 1) % N) * N + c;
    else if (e.key === 'ArrowDown') j = ((r + 1) % N) * N + c;
    else if (e.key === 'ArrowLeft') j = r * N + (c + N - 1) % N;
    else if (e.key === 'ArrowRight') j = r * N + (c + 1) % N;
    if (j >= 0) { e.preventDefault(); e.stopPropagation(); focusCell(j); }
  });
  function focusCell(j) {
    cells.forEach(function (c, k) { c.tabIndex = k === j ? 0 : -1; });
    try { cells[j].focus({ preventScroll: true }); } catch (e) { cells[j].focus(); }
  }
  document.addEventListener('keydown', function (e) {
    if (!overlay.hidden) { if (e.key === 'Escape') opts.close(); return; }
    if (N === 3 && /^[1-9]$/.test(e.key)) { e.preventDefault(); var i = +e.key - 1; focusCell(i); cells[i].click(); }
    else if ((e.key === 'Enter' || e.key === ' ') && over && !(document.activeElement && document.activeElement.closest('button'))) { e.preventDefault(); nextBtn.click(); }
    else if (e.key.indexOf('Arrow') === 0 && !(document.activeElement && document.activeElement.closest('.ttt-grid'))) { e.preventDefault(); focusCell(0); }
  });

  renderSound(); renderScores(); render();
  if (o.showcase) { // still frame for cover art: X wins on the diagonal, spare pieces on the table
    rootEl.classList.add('is-showcase');
    [[0, 1], [4, 1], [8, 1], [2, 2], [3, 2], [7, 2]].forEach(function (m) { apply(S, m[0], m[1]); });
    over = true; winLine = [0, 4, 8]; lastPlaced = -1; render(); drawWinLine(winLine);
    rootEl.append(h('div', { class: 'ttt-spare s1', html: X_SVG.replace('<svg', '<svg data-v="x"') }), h('div', { class: 'ttt-spare s2', html: O_SVG.replace('<svg', '<svg data-v="o"') }));
    document.documentElement.setAttribute('data-ready', '1');
  }
  MG.ready();
})();
