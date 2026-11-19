/* Hangman engine: guess the hidden word one letter at a time.
 * Six wrong guesses and the little figure is complete — find the word first.
 * Every word comes with a hint, and answers are common words only.
 * Options: { showcase: true } still frame for cover art. */
(function () {
  'use strict';
  var MG = window.MG, h = MG.h, o = window.GAME_OPTIONS || {};
  var SHOW = !!o.showcase;

  /* [word, hint] — common words only, so every round is winnable. */
  var WORDS = [
    ['APPLE', 'Fruit'], ['BANANA', 'Fruit'], ['ORANGE', 'Fruit'], ['GRAPE', 'Fruit'], ['LEMON', 'Fruit'],
    ['MANGO', 'Fruit'], ['PEACH', 'Fruit'], ['BERRY', 'Fruit'], ['MELON', 'Fruit'], ['CHERRY', 'Fruit'],
    ['TIGER', 'Animal'], ['HORSE', 'Animal'], ['MONKEY', 'Animal'], ['RABBIT', 'Animal'], ['ELEPHANT', 'Animal'],
    ['GIRAFFE', 'Animal'], ['DOLPHIN', 'Animal'], ['PENGUIN', 'Animal'], ['ZEBRA', 'Animal'], ['BEAR', 'Animal'],
    ['SNAKE', 'Animal'], ['EAGLE', 'Animal'], ['WOLF', 'Animal'], ['PANDA', 'Animal'], ['KOALA', 'Animal'],
    ['GARDEN', 'Outdoors'], ['RIVER', 'Outdoors'], ['MOUNTAIN', 'Outdoors'], ['BEACH', 'Outdoors'], ['FOREST', 'Outdoors'],
    ['DESERT', 'Outdoors'], ['ISLAND', 'Outdoors'], ['VALLEY', 'Outdoors'], ['MEADOW', 'Outdoors'], ['OCEAN', 'Outdoors'],
    ['PIANO', 'Music'], ['GUITAR', 'Music'], ['DRUM', 'Music'], ['VIOLIN', 'Music'], ['TRUMPET', 'Music'],
    ['MELODY', 'Music'], ['RHYTHM', 'Music'], ['SINGER', 'Music'], ['CONCERT', 'Music'], ['BANJO', 'Music'],
    ['BREAD', 'Food'], ['CHEESE', 'Food'], ['PIZZA', 'Food'], ['PASTA', 'Food'], ['BUTTER', 'Food'],
    ['HONEY', 'Food'], ['SUGAR', 'Food'], ['COOKIE', 'Food'], ['DINNER', 'Food'], ['LUNCH', 'Food'],
    ['SCHOOL', 'Place'], ['LIBRARY', 'Place'], ['MUSEUM', 'Place'], ['MARKET', 'Place'], ['BRIDGE', 'Place'],
    ['CASTLE', 'Place'], ['HOTEL', 'Place'], ['CINEMA', 'Place'], ['STADIUM', 'Place'], ['VILLAGE', 'Place'],
    ['DOCTOR', 'People'], ['TEACHER', 'People'], ['FARMER', 'People'], ['PILOT', 'People'], ['ARTIST', 'People'],
    ['SINGER', 'People'], ['WRITER', 'People'], ['COOK', 'People'], ['DRIVER', 'People'], ['FRIEND', 'People'],
    ['WINDOW', 'At home'], ['KITCHEN', 'At home'], ['BEDROOM', 'At home'], ['SOFA', 'At home'], ['LAMP', 'At home'],
    ['MIRROR', 'At home'], ['CANDLE', 'At home'], ['PILLOW', 'At home'], ['BLANKET', 'At home'], ['CURTAIN', 'At home'],
    ['ROCKET', 'Space'], ['PLANET', 'Space'], ['COMET', 'Space'], ['GALAXY', 'Space'], ['ASTRONAUT', 'Space'],
    ['SATURN', 'Space'], ['VENUS', 'Space'], ['MARS', 'Space'], ['NEBULA', 'Space'], ['ORBIT', 'Space'],
    ['FOOTBALL', 'Sport'], ['TENNIS', 'Sport'], ['CRICKET', 'Sport'], ['HOCKEY', 'Sport'], ['BOXING', 'Sport'],
    ['SWIMMING', 'Sport'], ['RUNNING', 'Sport'], ['CYCLING', 'Sport'], ['GOLF', 'Sport'], ['SKATING', 'Sport'],
    ['PUZZLE', 'Fun'], ['JIGSAW', 'Fun'], ['BALLOON', 'Fun'], ['KITE', 'Fun'], ['CIRCUS', 'Fun'],
    ['MAGIC', 'Fun'], ['TOY', 'Fun'], ['GAME', 'Fun'], ['PARTY', 'Fun'], ['DANCE', 'Fun']
  ];
  var MAX_WRONG = 6;
  var stats = MG.store.get('stats', null) || { played: 0, won: 0, streak: 0, bestStreak: 0 };
  var lastWord = MG.store.get('lastWord', '');

  /* ---------- state ---------- */
  var state = 'idle'; // idle | playing | done
  var answer = '', hint = '', guessed = {}, wrong = 0, revealed = 0;

  function pickWord() {
    var w;
    do { w = WORDS[Math.floor(Math.random() * WORDS.length)]; } while (w[0] === lastWord && WORDS.length > 1);
    lastWord = w[0]; MG.store.set('lastWord', w[0]);
    return w;
  }

  /* ---------- DOM ---------- */
  function pill(label, el) { return h('span', { class: 'mg-pill' }, h('small', { text: label }), el); }
  var wrongEl = h('b', { text: '0/6' }), streakEl = h('b', { text: stats.streak ? stats.streak : '–' });
  var bestEl = h('b', { text: stats.bestStreak ? stats.bestStreak : '–' });
  var soundBtn = h('button', { class: 'mg-icon-btn', type: 'button' });
  var pauseBtn = h('button', { class: 'mg-icon-btn', type: 'button', 'aria-label': 'Pause the game' },
    h('span', { html: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1.2"/><rect x="14" y="5" width="4" height="14" rx="1.2"/></svg>' }));
  var msg = h('div', { class: 'hm-msg', 'aria-live': 'polite', text: 'Guess the hidden word!' });
  // gallows: the wooden frame is always there; the six figure parts appear one per wrong guess
  var partEls = [];
  var gallows = h('div', { class: 'hm-gallows', role: 'img', 'aria-label': 'Hangman gallows' },
    h('span', { class: 'hm-base' }), h('span', { class: 'hm-post' }), h('span', { class: 'hm-beam' }), h('span', { class: 'hm-rope' }),
    h('span', { class: 'hm-part hm-head' }, h('span', { class: 'hm-eye is-l' }), h('span', { class: 'hm-eye is-r' }), h('span', { class: 'hm-smile' })),
    h('span', { class: 'hm-part hm-body' }),
    h('span', { class: 'hm-part hm-arm is-l' }), h('span', { class: 'hm-part hm-arm is-r' }),
    h('span', { class: 'hm-part hm-leg is-l' }), h('span', { class: 'hm-part hm-leg is-r' }));
  partEls = Array.prototype.slice.call(gallows.querySelectorAll('.hm-part'));
  var hintEl = h('div', { class: 'hm-hint' });
  var wordEl = h('div', { class: 'hm-word', role: 'group', 'aria-label': 'Hidden word' });
  var KEY_ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
  var keyEls = {};
  var keyboard = h('div', { class: 'hm-keys' });
  KEY_ROWS.forEach(function (keys) {
    var rowDiv = h('div', { class: 'hm-keyrow' });
    keys.split('').forEach(function (k) {
      var b = h('button', { class: 'hm-key', type: 'button', text: k, 'data-key': k });
      b.addEventListener('click', function () { onKey(k); });
      keyEls[k] = b; rowDiv.append(b);
    });
    keyboard.append(rowDiv);
  });
  var overlay = h('div', { class: 'mg-overlay', hidden: true });
  var root = h('div', { class: 'mg-root hm' + (SHOW ? ' is-showcase' : '') },
    h('div', { class: 'mg-hud' }, pill('Wrong', wrongEl), pill('Streak', streakEl), pill('Best', bestEl),
      h('span', { class: 'mg-spacer' }), pauseBtn, soundBtn),
    h('div', { class: 'hm-main' }, msg, gallows, hintEl, wordEl, keyboard), overlay);
  document.getElementById('game').append(root);

  /* ---------- helpers ---------- */
  function renderHud() {
    wrongEl.textContent = wrong + '/' + MAX_WRONG;
    streakEl.textContent = stats.streak ? stats.streak : '–';
    bestEl.textContent = stats.bestStreak ? stats.bestStreak : '–';
    wrongEl.parentNode.classList.toggle('is-low', wrong >= 4);
  }
  function renderWord() {
    wordEl.innerHTML = '';
    var done = true;
    for (var i = 0; i < answer.length; i++) {
      var ch = answer[i], hit = !!guessed[ch];
      if (!hit) done = false;
      var t = h('span', { class: 'hm-letter' + (hit ? ' is-hit' : ''), text: hit ? ch : '' });
      wordEl.append(t);
    }
    revealed = done ? answer.length : 0;
    return done;
  }
  function renderParts() {
    partEls.forEach(function (p, i) { p.classList.toggle('is-shown', i < wrong); });
  }
  function flash(text) {
    msg.textContent = text;
    msg.classList.remove('is-flash'); void msg.offsetWidth; msg.classList.add('is-flash');
  }

  /* ---------- the game ---------- */
  function start() {
    var w = pickWord();
    answer = w[0]; hint = w[1];
    guessed = {}; wrong = 0;
    for (var k in keyEls) keyEls[k].classList.remove('is-good', 'is-bad');
    state = 'playing'; overlay.hidden = true;
    hintEl.textContent = 'Hint: ' + hint + ' · ' + answer.length + ' letters';
    msg.textContent = 'Pick a letter — six wrong guesses and the game is over.';
    renderWord(); renderParts(); renderHud();
    MG.event('game_start');
  }
  function onKey(k) {
    if (state !== 'playing') return;
    if (guessed[k]) return;
    guessed[k] = true;
    var good = answer.indexOf(k) !== -1;
    var b = keyEls[k];
    b.classList.add(good ? 'is-good' : 'is-bad');
    if (good) {
      MG.sfx.tap();
      var done = renderWord();
      if (done) { MG.sfx.win(); MG.confetti(120); finish(true); return; }
      var left = 0;
      for (var i = 0; i < answer.length; i++) if (!guessed[answer[i]]) left++;
      msg.textContent = 'Nice — ' + k + ' is in the word! ' + left + (left === 1 ? ' letter' : ' letters') + ' to go.';
    } else {
      wrong++;
      renderParts(); renderHud();
      MG.tone(200, 0.12, 'sawtooth', 0.04, 120);
      if (wrong >= MAX_WRONG) { MG.sfx.lose(); finish(false); return; }
      msg.textContent = 'No ' + k + ' in this word — ' + (MAX_WRONG - wrong) + (MAX_WRONG - wrong === 1 ? ' wrong guess left!' : ' wrong guesses left.');
    }
  }
  function finish(won) {
    state = 'done';
    stats.played++;
    if (won) {
      stats.won++;
      stats.streak++;
      stats.bestStreak = Math.max(stats.bestStreak, stats.streak);
    } else stats.streak = 0;
    MG.store.set('stats', stats);
    renderHud();
    var again = h('button', { class: 'mg-btn', type: 'button', text: 'Play another word' });
    again.addEventListener('click', function () { MG.adBreak('next', 'hangman-again', start); });
    overlay.innerHTML = '';
    overlay.append(h('div', { class: 'mg-card hm-card', role: 'dialog', 'aria-modal': 'true', 'aria-label': won ? 'You found the word' : 'Out of guesses' },
      h('div', { class: 'hm-badge', 'aria-hidden': 'true', text: won ? '🎉' : '😵' }),
      h('div', null, h('small', { class: 'mg-label', text: won ? 'You found the word' : 'The word was' }),
        h('h2', { class: 'mg-title', text: answer }),
        !won ? h('p', { class: 'mg-sub', text: 'Six wrong guesses, and the word was ' + answer + ' (' + hint.toLowerCase() + ').' }) : null),
      h('div', { class: 'hm-score' }, h('span', { class: 'mg-big', text: won ? (MAX_WRONG - wrong) + '/' + MAX_WRONG : '0/' + MAX_WRONG }),
        h('span', { text: (won ? 'wrong guesses to spare · ' : '') + stats.won + ' wins in ' + stats.played + ' games · streak ' + stats.streak + (stats.bestStreak ? ' (best ' + stats.bestStreak + ')' : '') })),
      h('p', { class: 'mg-sub', text: won ? (wrong === 0 ? 'A perfect round — not a single wrong letter!' : wrong <= 2 ? 'Sharp guessing — the figure barely got started.' : 'Found it just in time.') : 'A new word is waiting — common words only, so the next one is very gettable.' }),
      h('div', { class: 'mg-row' }, again)));
    overlay.hidden = false;
    MG.focusSafe(again, 700);
    MG.event('game_over', { won: won, wrong: wrong });
  }

  /* ---------- pause (no clock, but the button still hides the word) ---------- */
  function pauseGame() {
    if (state !== 'playing') return;
    state = 'paused';
    var resume = h('button', { class: 'mg-btn', type: 'button', text: 'Resume' });
    var restart = h('button', { class: 'mg-btn is-secondary', type: 'button', text: 'New word' });
    resume.addEventListener('click', function () { state = 'playing'; overlay.hidden = true; });
    restart.addEventListener('click', start);
    overlay.innerHTML = '';
    overlay.append(h('div', { class: 'mg-card', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Paused' },
      h('h2', { class: 'mg-title', text: 'Paused' }),
      h('p', { class: 'mg-sub', text: 'The word is waiting. Take your time — there is no clock in Hangman.' }),
      h('div', { class: 'mg-row' }, restart, resume)));
    overlay.hidden = false;
    MG.focusSafe(resume, 300);
  }
  pauseBtn.addEventListener('click', function () {
    if (state === 'paused') { state = 'playing'; overlay.hidden = true; } else pauseGame();
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

  /* ---------- input: physical keyboard ---------- */
  document.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (state === 'idle') { if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); start(); } return; }
    if (state !== 'playing') return;
    if (/^[a-zA-Z]$/.test(e.key)) onKey(e.key.toUpperCase());
  });

  /* ---------- start screen ---------- */
  function showStart() {
    var play = h('button', { class: 'mg-btn', type: 'button', text: 'Start guessing' });
    play.addEventListener('click', start);
    overlay.innerHTML = '';
    overlay.append(h('div', { class: 'mg-card', role: 'dialog', 'aria-label': 'Hangman' },
      h('div', { class: 'hm-badge', 'aria-hidden': 'true', text: '🔤' }),
      h('h2', { class: 'mg-title', text: 'Hangman' }),
      h('p', { class: 'mg-sub', text: 'Guess the hidden word one letter at a time. Every word comes with a hint, and you get six wrong guesses before the little figure is complete.' + (stats.played ? ' You have played ' + stats.played + ' game' + (stats.played === 1 ? '' : 's') + ' and won ' + stats.won + '.' : '') }),
      play));
    overlay.hidden = false;
  }

  /* ---------- start ---------- */
  renderSound(); renderHud(); showStart();
  if (SHOW) { // still frame: GARDEN half found, two wrong guesses drawn
    overlay.hidden = true;
    state = 'playing';
    answer = 'GARDEN'; hint = 'Outdoors';
    guessed = { G: true, R: true, D: true, N: true, X: true, Q: true };
    wrong = 2;
    hintEl.textContent = 'Hint: Outdoors · 6 letters';
    msg.textContent = 'Nice — N is in the word! 2 letters to go.';
    renderWord(); renderParts();
    for (var k in keyEls) {
      if (guessed[k]) keyEls[k].classList.add(answer.indexOf(k) !== -1 ? 'is-good' : 'is-bad');
    }
    root.classList.add('is-showcase');
    renderHud();
    setTimeout(function () { document.documentElement.setAttribute('data-ready', '1'); }, 80);
  }
  MG.ready();
})();
