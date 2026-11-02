/* Memory Match engine: flip two cards, keep them if they match.
 * Solo (moves, time, stars, best scores per size) or two players taking turns (a match earns another turn).
 * Options: { showcase: true } still frame for cover art. */
(function () {
  'use strict';
  var MG = window.MG, h = MG.h;
  var o = window.GAME_OPTIONS || {};
  var reduce = false;
  try { reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* ignore */ }
  var ICON = {
    soundOn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z" fill="currentColor"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>',
    soundOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z" fill="currentColor"/><path d="m16 9 6 6M22 9l-6 6"/></svg>',
    restart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4h4"/></svg>'
  };
  var THEMES = {
    animals: { name: 'Animals', items: ['🐶', '🐱', '🦊', '🐼', '🐨', '🐯', '🦁', '🐸', '🐵', '🐧', '🦉', '🦄', '🐰', '🐻', '🐷', '🐮', '🐙', '🦋'] },
    sweets: { name: 'Sweets', items: ['🍩', '🧁', '🍭', '🍪', '🍫', '🍰', '🍦', '🍬', '🎂', '🍓', '🍒', '🍉', '🥞', '🍯', '🍮', '🥧', '🍡', '🍋'] },
    ocean: { name: 'Ocean', items: ['🐠', '🐙', '🦀', '🐬', '🐳', '🦈', '🐢', '🐚', '🦑', '🐡', '🦞', '🐋', '🦭', '🪸', '🐟', '🦐', '🌊', '⚓'] },
    space: { name: 'Space', items: ['🚀', '🪐', '🌙', '⭐', '☄️', '👽', '🛸', '🌍', '🌞', '🔭', '🌌', '🛰️', '👩‍🚀', '🌠', '🌕', '🌑', '🌈', '💫'] }
  };
  var SIZES = { easy: [4, 3, 'Easy'], normal: [4, 4, 'Normal'], hard: [5, 4, 'Hard'], expert: [6, 5, 'Expert'] };
  var TINTS = ['#FFE3EC', '#E3F2FF', '#FFF4D6', '#E6F9EA', '#F1E6FF', '#FFE9DC', '#DFF8F6', '#FDE7F7', '#EEF1D9'];

  var size = MG.store.get('size', 'normal'); if (!SIZES[size]) size = 'normal';
  var theme = MG.store.get('theme', 'animals'); if (!THEMES[theme]) theme = 'animals';
  var mode = MG.store.get('mode', 'solo'); if (mode !== 'solo' && mode !== 'duo') mode = 'solo';
  var deck = [], open = [], matched = 0, moves = 0, streak = 0, started = 0, elapsed = 0, timer = 0, lock = false, over = false;
  var player = 1, pts = { 1: 0, 2: 0 }, focusIdx = 0;

  /* ---------- DOM ---------- */
  var pillA = h('span', { class: 'mg-pill mm-p1' }), pillB = h('span', { class: 'mg-pill mm-p2' });
  var restartBtn = h('button', { class: 'mg-icon-btn', type: 'button', 'aria-label': 'New game', title: 'New game', html: ICON.restart });
  var soundBtn = h('button', { class: 'mg-icon-btn', type: 'button' });
  var grid = h('div', { class: 'mm-grid', role: 'grid', 'aria-label': 'Cards' });
  var status = h('p', { class: 'mm-status', 'aria-live': 'polite' });
  var overlay = h('div', { class: 'mg-overlay', hidden: true });
  var overlayKind = '';
  var opts = MG.options({
    overlay: overlay, title: 'Game options',
    summary: function () { return SIZES[size][2] + ' · ' + THEMES[theme].name + (mode === 'duo' ? ' · 2P' : ''); },
    groups: [
      { label: 'Cards', items: [['easy', '12'], ['normal', '16'], ['hard', '20'], ['expert', '30']], get: function () { return size; }, set: function (v) { size = v; MG.store.set('size', v); newGame(); } },
      { label: 'Pictures', items: [['animals', 'Animals'], ['sweets', 'Sweets'], ['ocean', 'Ocean'], ['space', 'Space']], get: function () { return theme; }, set: function (v) { theme = v; MG.store.set('theme', v); newGame(); } },
      { label: 'Players', items: [['solo', '1 player'], ['duo', '2 players']], get: function () { return mode; }, set: function (v) { mode = v; MG.store.set('mode', v); newGame(); } }
    ],
    onClose: function () { overlayKind = ''; }
  });
  opts.el.addEventListener('click', function () { overlayKind = 'options'; });
  var main = h('div', { class: 'mm-main' }, grid);
  var root = h('div', { class: 'mg-root mm' },
    h('div', { class: 'mg-hud' }, pillA, pillB, h('span', { class: 'mg-spacer' }), restartBtn, soundBtn),
    main, h('div', { class: 'mm-bar' }, status, opts.el), overlay);
  document.getElementById('game').append(root);

  /* ---------- layout: largest cards that fit ---------- */
  function layout() {
    var cols = SIZES[size][0], rows = SIZES[size][1];
    var W = main.clientWidth - 12, H = main.clientHeight - 8;
    if (!W || !H) return;
    // prefer landscape grids on wide screens and portrait grids on tall ones
    if (H > W * 1.15) { var t = cols; cols = rows; rows = t; }
    var gap = Math.max(6, Math.min(12, W * 0.016));
    var cw = Math.min((W - gap * (cols - 1)) / cols, ((H - gap * (rows - 1)) / rows) * 0.78, 150);
    grid.style.setProperty('--cols', cols); grid.style.setProperty('--cw', Math.floor(cw) + 'px'); grid.style.setProperty('--gap', gap + 'px');
  }
  if (window.ResizeObserver) new ResizeObserver(layout).observe(main); else window.addEventListener('resize', layout);

  /* ---------- game ---------- */
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = (Math.random() * (i + 1)) | 0, t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function newGame() {
    closeOverlay();
    clearInterval(timer); timer = 0; started = 0; elapsed = 0;
    var n = SIZES[size][0] * SIZES[size][1] / 2;
    var pics = shuffle(THEMES[theme].items.slice()).slice(0, n);
    deck = shuffle(pics.concat(pics).map(function (p, i) { return { pic: p, tint: TINTS[pics.indexOf(p) % TINTS.length], up: false, done: false, id: i }; }));
    open = []; matched = 0; moves = 0; streak = 0; lock = false; over = false; player = 1; pts = { 1: 0, 2: 0 }; focusIdx = 0;
    build(); hud();
    MG.event('game_start', { size: size, mode: mode });
  }
  function build() {
    grid.innerHTML = '';
    root.setAttribute('data-theme-set', theme);
    deck.forEach(function (c, i) {
      var b = h('button', { class: 'mm-card', type: 'button', role: 'gridcell', 'data-i': String(i), tabindex: i === focusIdx ? '0' : '-1' },
        h('span', { class: 'mm-inner' },
          h('span', { class: 'mm-back', 'aria-hidden': 'true' }),
          h('span', { class: 'mm-face', 'aria-hidden': 'true', style: '--tint:' + c.tint }, h('span', { class: 'mm-pic', text: c.pic }))));
      b.addEventListener('click', function () { flip(i); });
      c.el = b; grid.append(b);
    });
    layout(); paint();
  }
  function paint() {
    deck.forEach(function (c, i) {
      c.el.classList.toggle('is-up', c.up || c.done);
      c.el.classList.toggle('is-done', c.done);
      c.el.setAttribute('aria-label', 'Card ' + (i + 1) + (c.up || c.done ? ': ' + c.pic : ', face down') + (c.done ? ', matched' : ''));
    });
  }
  function hud() {
    if (mode === 'solo') {
      pillA.innerHTML = ''; pillA.append(h('small', { text: 'Moves' }), h('b', { text: String(moves) }));
      pillB.innerHTML = ''; pillB.append(h('small', { text: 'Time' }), h('b', { text: clock(elapsed) }));
      pillA.classList.remove('is-turn'); pillB.classList.remove('is-turn');
      var best = MG.store.get('best-' + size, null);
      status.textContent = matched === deck.length / 2 ? '' : best ? 'Best: ' + best.moves + ' moves · ' + clock(best.time) : 'Find all ' + deck.length / 2 + ' pairs';
    } else {
      pillA.innerHTML = ''; pillA.append(h('small', { text: 'Player 1' }), h('b', { text: String(pts[1]) }));
      pillB.innerHTML = ''; pillB.append(h('small', { text: 'Player 2' }), h('b', { text: String(pts[2]) }));
      pillA.classList.toggle('is-turn', player === 1 && !over); pillB.classList.toggle('is-turn', player === 2 && !over);
      status.textContent = over ? '' : 'Player ' + player + '’s turn';
    }
    root.setAttribute('data-player', player);
  }
  function clock(ms) { var s = Math.floor(ms / 1000); return Math.floor(s / 60) + ':' + ('0' + s % 60).slice(-2); }
  function tickClock() { elapsed = Date.now() - started; if (mode === 'solo') pillB.querySelector('b').textContent = clock(elapsed); }
  function flip(i) {
    var c = deck[i];
    if (lock || over || c.up || c.done || !overlay.hidden) return;
    if (!started) { started = Date.now(); timer = setInterval(tickClock, 500); }
    c.up = true; open.push(c); focusIdx = i;
    MG.tone(520 + open.length * 90, 0.06, 'triangle', 0.045);
    paint();
    if (open.length < 2) return;
    moves++; lock = true;
    var a = open[0], b = open[1];
    if (a.pic === b.pic) {
      streak++;
      setTimeout(function () {
        a.done = b.done = true; a.up = b.up = false; open = []; lock = false; matched++;
        if (mode === 'duo') pts[player]++;
        var f = [659, 784, 988, 1175, 1319][Math.min(streak - 1, 4)];
        MG.tone(f, 0.12, 'triangle', 0.06); MG.tone(f * 1.5, 0.14, 'sine', 0.035, 0, 0.07); MG.vibrate(12);
        paint(); hud(); burst(a.el); burst(b.el);
        if (streak >= 3 && mode === 'solo') toast(streak + ' in a row!');
        if (matched === deck.length / 2) finish();
      }, reduce ? 60 : 320);
    } else {
      streak = 0;
      setTimeout(function () {
        a.el.classList.add('nope'); b.el.classList.add('nope');
        MG.tone(200, 0.12, 'sine', 0.04, 150);
      }, reduce ? 0 : 380);
      setTimeout(function () {
        a.up = b.up = false; open = []; lock = false;
        a.el.classList.remove('nope'); b.el.classList.remove('nope');
        if (mode === 'duo') player = 3 - player;
        paint(); hud();
      }, reduce ? 500 : 950);
    }
    hud();
  }
  function stars() { var p = deck.length / 2; return moves <= Math.ceil(p * 1.5) ? 3 : moves <= Math.ceil(p * 2.2) ? 2 : 1; }
  function finish() {
    over = true; clearInterval(timer); tickClock();
    var again = h('button', { class: 'mg-btn', type: 'button', text: 'Play again' });
    again.addEventListener('click', function () { MG.adBreak('next', 'memory-again', newGame); });
    if (mode === 'solo') {
      var st = stars(), best = MG.store.get('best-' + size, null), isBest = !best || moves < best.moves || (moves === best.moves && elapsed < best.time);
      if (isBest) MG.store.set('best-' + size, { moves: moves, time: elapsed });
      MG.sfx.win(); MG.confetti(st === 3 ? 150 : 90);
      MG.event('win', { size: size, moves: moves, time: elapsed });
      var starRow = h('div', { class: 'mm-stars', 'aria-label': st + ' out of 3 stars' });
      for (var k = 1; k <= 3; k++) starRow.append(h('span', { class: k <= st ? 'on' : '', text: '★' }));
      card('win', [starRow, h('h2', { class: 'mg-title', text: st === 3 ? 'Perfect memory!' : st === 2 ? 'Well done!' : 'All pairs found!' }), isBest ? h('span', { class: 'mg-badge', text: 'New best!' }) : null,
        h('p', { class: 'mg-sub', text: moves + ' moves in ' + clock(elapsed) + '. Three stars need ' + Math.ceil(deck.length / 2 * 1.5) + ' moves or fewer.' }), again]);
    } else {
      var w = pts[1] === pts[2] ? 0 : pts[1] > pts[2] ? 1 : 2;
      MG.sfx.win(); MG.confetti(110);
      card('win', [h('h2', { class: 'mg-title', text: w ? 'Player ' + w + ' wins!' : 'It’s a tie!' }),
        h('p', { class: 'mg-sub', text: 'Player 1: ' + pts[1] + ' pairs · Player 2: ' + pts[2] + ' pairs' }), again]);
    }
    hud();
    MG.focusSafe(again);
  }

  /* ---------- effects ---------- */
  function burst(el) {
    if (reduce) return;
    var r = el.getBoundingClientRect(), rr = root.getBoundingClientRect();
    for (var k = 0; k < 8; k++) {
      var s = h('i', { class: 'mm-spark', 'aria-hidden': 'true' });
      var a = (k / 8) * 6.283, d = r.width * (0.55 + Math.random() * 0.25);
      s.style.left = (r.left - rr.left + r.width / 2) + 'px'; s.style.top = (r.top - rr.top + r.height / 2) + 'px';
      s.style.setProperty('--dx', Math.cos(a) * d + 'px'); s.style.setProperty('--dy', Math.sin(a) * d + 'px');
      root.append(s); setTimeout(function (x) { return function () { x.remove(); }; }(s), 700);
    }
  }
  function toast(t) { var el = h('div', { class: 'mg-toast mm-toast', text: t }); root.append(el); setTimeout(function () { el.remove(); }, 1500); }
  function closeOverlay() { if (overlayKind === 'options') opts.close(); overlay.hidden = true; overlayKind = ''; }
  function card(kind, kids) { overlay.innerHTML = ''; overlay.append(h('div', { class: 'mg-card mm-card-dlg', role: 'dialog', 'aria-modal': 'true' }, kids)); overlay.hidden = false; overlayKind = kind; }
  function renderSound() { soundBtn.innerHTML = MG.sound.muted ? ICON.soundOff : ICON.soundOn; soundBtn.setAttribute('aria-label', MG.sound.muted ? 'Turn sound on' : 'Turn sound off'); }

  /* ---------- input ---------- */
  soundBtn.addEventListener('click', function () { MG.sound.toggle(); renderSound(); });
  restartBtn.addEventListener('click', function () { if (matched || moves) MG.adBreak('next', 'memory-new', newGame); else newGame(); });
  function focusCard(i) {
    focusIdx = Math.max(0, Math.min(deck.length - 1, i));
    deck.forEach(function (c, k) { c.el.tabIndex = k === focusIdx ? 0 : -1; });
    try { deck[focusIdx].el.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
  }
  document.addEventListener('keydown', function (e) {
    if (!overlay.hidden) { if (e.key === 'Escape' && overlayKind !== 'win') { e.preventDefault(); closeOverlay(); } return; }
    var cols = +getComputedStyle(grid).getPropertyValue('--cols') || SIZES[size][0];
    var d = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -cols, ArrowDown: cols }[e.key];
    if (d) { e.preventDefault(); focusCard(document.activeElement && document.activeElement.classList.contains('mm-card') ? focusIdx + d : focusIdx); }
    else if ((e.key === 'Enter' || e.key === ' ') && !(document.activeElement && document.activeElement.classList.contains('mm-card'))) { e.preventDefault(); flip(focusIdx); }
  });

  /* ---------- start ---------- */
  renderSound();
  if (o.showcase) { // still frame: a game in progress, three pairs found, one pair being turned
    root.classList.add('is-showcase');
    size = 'normal'; theme = 'animals'; mode = 'solo';
    var pics = ['🐼', '🦊', '🐸', '🦄', '🐯', '🐧', '🦉', '🐵'];
    deck = [0, 1, 2, 3, 4, 5, 6, 7, 3, 0, 5, 2, 7, 1, 4, 6].map(function (k, i) { return { pic: pics[k], tint: TINTS[k], up: false, done: false, id: i }; });
    build();
    [[0, 9], [3, 8], [5, 10]].forEach(function (p) { deck[p[0]].done = deck[p[1]].done = true; });
    deck[13].up = true; paint();
    deck[6].el.classList.add('is-turning');
    moves = 9; hud();
    requestAnimationFrame(function () { document.documentElement.setAttribute('data-ready', '1'); });
  } else newGame();
  MG.ready();
})();
