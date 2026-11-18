/* Wordle engine: guess the five-letter word in six tries.
 * Green means the letter is right and in the right place, yellow means it is
 * in the word but in the wrong place, grey means it is not in the word at all.
 * On-screen keyboard plus physical keyboard. Answers are common words only.
 * Options: { showcase: true } still frame for cover art. */
(function () {
  'use strict';
  var MG = window.MG, h = MG.h, o = window.GAME_OPTIONS || {};
  var SHOW = !!o.showcase;

  /* The first 200 words are the common words answers are picked from;
   * the whole list is accepted as a guess. */
  var WORDS = [
    'ABOUT', 'ABOVE', 'ACTOR', 'ACUTE', 'ADMIT', 'ADOPT', 'ADULT', 'AFTER', 'AGAIN', 'AGENT',
    'AGREE', 'AHEAD', 'ALARM', 'ALBUM', 'ALERT', 'ALIKE', 'ALIVE', 'ALLOW', 'ALONE', 'ALONG',
    'ALOUD', 'ALPHA', 'ALTAR', 'ALTER', 'AMONG', 'ANGER', 'ANGLE', 'ANGRY', 'ANKLE', 'APART',
    'APPLE', 'APPLY', 'ARENA', 'ARGUE', 'ARISE', 'ARMOR', 'AROSE', 'ARRAY', 'ARROW', 'ASIDE',
    'ASSET', 'AUDIO', 'AUDIT', 'AVOID', 'AWAKE', 'AWARD', 'AWARE', 'AWFUL', 'BACON', 'BADGE',
    'BADLY', 'BAKER', 'BASIC', 'BASIS', 'BEACH', 'BEARD', 'BEAST', 'BEGIN', 'BEGUN', 'BEING',
    'BELLY', 'BELOW', 'BENCH', 'BERRY', 'BIBLE', 'BIRTH', 'BLACK', 'BLADE', 'BLAME', 'BLANK',
    'BLAST', 'BLEND', 'BLESS', 'BLIND', 'BLOCK', 'BLOOD', 'BLOOM', 'BOARD', 'BOAST', 'BONUS',
    'BOOST', 'BOUND', 'BRACE', 'BRAIN', 'BRAND', 'BRAVE', 'BREAD', 'BREAK', 'BRICK', 'BRIDE',
    'BRIEF', 'BRING', 'BROAD', 'BROKE', 'BROOK', 'BROOM', 'BROWN', 'BRUSH', 'BUILD', 'BUNCH',
    'BURST', 'BUYER', 'CABLE', 'CAMEL', 'CANAL', 'CANDY', 'CANOE', 'CARGO', 'CARRY', 'CATCH',
    'CAUSE', 'CEASE', 'CHAIN', 'CHAIR', 'CHALK', 'CHAOS', 'CHARM', 'CHART', 'CHASE', 'CHEAP',
    'CHECK', 'CHEST', 'CHIEF', 'CHILD', 'CHILL', 'CIVIL', 'CLAIM', 'CLASS', 'CLEAN', 'CLEAR',
    'CLERK', 'CLICK', 'CLIMB', 'CLOCK', 'CLOSE', 'CLOTH', 'CLOUD', 'COACH', 'COAST', 'COLOR',
    'COMIC', 'COUCH', 'COULD', 'COUNT', 'COURT', 'COVER', 'CRACK', 'CRAFT', 'CRASH', 'CRAZY',
    'CREAM', 'CREEK', 'CRIME', 'CROSS', 'CROWD', 'CRUEL', 'CRUSH', 'CURVE', 'CYCLE', 'DAILY',
    'DANCE', 'DEATH', 'DELAY', 'DEPTH', 'DIARY', 'DIRTY', 'DOUBT', 'DOZEN', 'DRAFT', 'DRAIN',
    'DRAMA', 'DREAM', 'DRESS', 'DRIFT', 'DRILL', 'DRINK', 'DRIVE', 'EAGER', 'EAGLE', 'EARLY',
    'EARTH', 'EIGHT', 'ELBOW', 'ELDER', 'ELECT', 'ELITE', 'EMAIL', 'EMPTY', 'ENEMY', 'ENJOY',
    'ENTER', 'ENTRY', 'EQUAL', 'EQUIP', 'ERROR', 'ESSAY', 'EVENT', 'EVERY', 'EXACT', 'EXIST',
    'EXTRA', 'FAITH', 'FALSE', 'FANCY', 'FAULT', 'FAVOR', 'FENCE', 'FERRY', 'FIELD', 'FIFTH',
    'FIGHT', 'FINAL', 'FIRST', 'FLAME', 'FLASH', 'FLEET', 'FLESH', 'FLOAT', 'FLOOD', 'FLOOR',
    'FLOUR', 'FLUID', 'FOCUS', 'FORCE', 'FOUND', 'FRAME', 'FRESH', 'FRONT', 'FROST', 'FRUIT',
    'FUNNY', 'GLASS', 'GLEAM', 'GLIDE', 'GLORY', 'GLOVE', 'GRAIN', 'GRAND', 'GRANT', 'GRAPE',
    'GRAPH', 'GRASP', 'GRASS', 'GRAVE', 'GREAT', 'GREEN', 'GREET', 'GRIEF', 'GRILL', 'GROUP',
    'GUARD', 'GUESS', 'GUEST', 'GUIDE', 'GUILT', 'HABIT', 'HAPPY', 'HEART', 'HEAVY', 'HELLO',
    'HENCE', 'HOBBY', 'HONOR', 'HORSE', 'HOTEL', 'HOUSE', 'HUMAN', 'HUMOR', 'HURRY', 'IDEAL',
    'IMAGE', 'IMPLY', 'INDEX', 'INNER', 'INPUT', 'ISSUE', 'JELLY', 'JEWEL', 'JOINT', 'JUDGE',
    'JUICE', 'KNIFE', 'KNOCK', 'LABEL', 'LABOR', 'LARGE', 'LAUGH', 'LAYER', 'LEARN', 'LEAST',
    'LEAVE', 'LEGAL', 'LEMON', 'LEVEL', 'LIGHT', 'LIMIT', 'LOCAL', 'LOGIC', 'LOOSE', 'LOVER',
    'LOYAL', 'LUNCH', 'MADAM', 'MAGIC', 'MAJOR', 'MARCH', 'MARRY', 'MATCH', 'MAYBE', 'MAYOR',
    'MEDIA', 'MERCY', 'MERIT', 'MERRY', 'METAL', 'METER', 'MIGHT', 'MINOR', 'MODEL', 'MONEY',
    'MONTH', 'MORAL', 'MOTOR', 'MOUNT', 'MOUSE', 'MOUTH', 'MOVIE', 'MUSIC', 'NERVE', 'NEVER',
    'NIGHT', 'NOBLE', 'NOISE', 'NORTH', 'NOVEL', 'NURSE', 'OCEAN', 'OFFER', 'OFTEN', 'OLIVE',
    'ONION', 'OPERA', 'ORBIT', 'ORDER', 'ORGAN', 'OTHER', 'OUGHT', 'OUTER', 'OWNER', 'PAINT',
    'PANEL', 'PANIC', 'PAPER', 'PARTY', 'PAUSE', 'PEACE', 'PEACH', 'PHASE', 'PHONE', 'PHOTO',
    'PIANO', 'PIECE', 'PILOT', 'PITCH', 'PLACE', 'PLAIN', 'PLANE', 'PLANT', 'PLATE', 'POINT',
    'POUND', 'POWER', 'PRESS', 'PRICE', 'PRIDE', 'PRIME', 'PRINT', 'PRIOR', 'PRIZE', 'PROOF',
    'PROUD', 'PROVE', 'PULSE', 'PUNCH', 'PUPIL', 'QUEEN', 'QUICK', 'QUIET', 'QUITE', 'QUOTE',
    'RADIO', 'RAISE', 'RALLY', 'RANGE', 'RAPID', 'RATIO', 'REACH', 'REACT', 'READY', 'REALM',
    'REBEL', 'REFER', 'RELAX', 'REPLY', 'RIDGE', 'RIGHT', 'RIVER', 'ROMAN', 'ROUGH', 'ROUND',
    'ROUTE', 'ROYAL', 'RURAL', 'SALAD', 'SCALE', 'SCENE', 'SCOPE', 'SCORE', 'SCRAP', 'SEIZE',
    'SENSE', 'SERVE', 'SEVEN', 'SHADE', 'SHAKE', 'SHALL', 'SHAME', 'SHAPE', 'SHARE', 'SHARP',
    'SHEEP', 'SHEET', 'SHELF', 'SHELL', 'SHIFT', 'SHINE', 'SHIRT', 'SHOCK', 'SHOOT', 'SHORE',
    'SHORT', 'SHOUT', 'SIGHT', 'SILLY', 'SINCE', 'SKILL', 'SKIRT', 'SLEEP', 'SLICE', 'SLIDE',
    'SLOPE', 'SMALL', 'SMART', 'SMELL', 'SMILE', 'SMOKE', 'SNACK', 'SNAKE', 'SOLAR', 'SOLID',
    'SOLVE', 'SORRY', 'SOUND', 'SOUTH', 'SPACE', 'SPARE', 'SPEAK', 'SPEED', 'SPELL', 'SPEND',
    'SPLIT', 'SPOKE', 'SPORT', 'SPRAY', 'STAFF', 'STAGE', 'STAIN', 'STAIR', 'STAKE', 'STAND',
    'STARE', 'START', 'STATE', 'STEAK', 'STEAL', 'STEAM', 'STEEL', 'STEEP', 'STEER', 'STICK',
    'STILL', 'STONE', 'STOOD', 'STORE', 'STORM', 'STORY', 'STOVE', 'STRAW', 'STRIP', 'STUDY',
    'STUFF', 'STYLE', 'SUGAR', 'SUPER', 'SWEAR', 'SWEAT', 'SWEEP', 'SWEET', 'SWING', 'TABLE',
    'TASTE', 'TEACH', 'TENSE', 'THANK', 'THEIR', 'THEME', 'THERE', 'THESE', 'THICK', 'THIEF',
    'THING', 'THINK', 'THIRD', 'THOSE', 'THREE', 'THROW', 'THUMB', 'TIGHT', 'TIRED', 'TITLE',
    'TOAST', 'TODAY', 'TOOTH', 'TOPIC', 'TOTAL', 'TOUCH', 'TOUGH', 'TOWER', 'TRACE', 'TRACK',
    'TRADE', 'TRAIL', 'TRAIN', 'TREAT', 'TREND', 'TRIAL', 'TRIBE', 'TRICK', 'TROOP', 'TRUCK',
    'TRUST', 'TRUTH', 'TWICE', 'UNCLE', 'UNDER', 'UNION', 'UNTIL', 'UPPER', 'UPSET', 'URBAN',
    'USUAL', 'VALUE', 'VERSE', 'VIDEO', 'VISIT', 'VITAL', 'VOICE', 'WASTE', 'WATCH', 'WATER',
    'WEIGH', 'WEIRD', 'WHALE', 'WHEEL', 'WHERE', 'WHICH', 'WHILE', 'WHITE', 'WHOLE', 'WHOSE',
    'WOMAN', 'WOMEN', 'WORLD', 'WORRY', 'WORTH', 'WOULD', 'WOUND', 'WRITE', 'WRONG', 'YIELD',
    'YOUNG', 'YOUTH', 'CRANE', 'SLATE'
  ];;;
  var ANSWERS_N = 200;
  var WORD_SET = {};
  WORDS.forEach(function (w) { WORD_SET[w] = true; });

  /* ---------- state ---------- */
  var state = 'idle'; // idle | playing | done
  var answer = '', row = 0, col = 0, guesses = [];
  var stats = MG.store.get('stats', null) || { played: 0, won: 0, streak: 0, maxStreak: 0, best: 0 };
  var lastWord = MG.store.get('lastWord', '');

  function pickAnswer() {
    var a = '';
    do { a = WORDS[Math.floor(Math.random() * ANSWERS_N)]; } while (a === lastWord && ANSWERS_N > 1);
    lastWord = a; MG.store.set('lastWord', a);
    return a;
  }
  function evaluate(guess, ans) {
    var res = [0, 0, 0, 0, 0], counts = {}, i;
    for (i = 0; i < 5; i++) if (guess[i] !== ans[i]) counts[ans[i]] = (counts[ans[i]] || 0) + 1;
    for (i = 0; i < 5; i++) if (guess[i] === ans[i]) res[i] = 2;
    for (i = 0; i < 5; i++) if (res[i] !== 2 && counts[guess[i]]) { res[i] = 1; counts[guess[i]]--; }
    return res;
  }

  /* ---------- DOM ---------- */
  function pill(label, el) { return h('span', { class: 'mg-pill' }, h('small', { text: label }), el); }
  var guessEl = h('b', { text: '0/6' }), streakEl = h('b', { text: stats.streak ? stats.streak : '–' });
  var bestEl = h('b', { text: stats.best ? stats.best : '–' });
  var soundBtn = h('button', { class: 'mg-icon-btn', type: 'button' });
  var pauseBtn = h('button', { class: 'mg-icon-btn', type: 'button', 'aria-label': 'Pause the game' },
    h('span', { html: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1.2"/><rect x="14" y="5" width="4" height="14" rx="1.2"/></svg>' }));
  var msg = h('div', { class: 'wd-msg', 'aria-live': 'polite', text: 'Guess the five-letter word!' });
  var board = h('div', { class: 'wd-board', role: 'grid', 'aria-label': 'Wordle board' });
  var tileEls = [];
  for (var r = 0; r < 6; r++) {
    var rowEl = h('div', { class: 'wd-row', role: 'row' });
    for (var c = 0; c < 5; c++) {
      var t = h('span', { class: 'wd-tile', role: 'gridcell' });
      tileEls.push(t); rowEl.append(t);
    }
    board.append(rowEl);
  }
  var KEY_ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
  var keyEls = {};
  var keyboard = h('div', { class: 'wd-keys' });
  KEY_ROWS.forEach(function (keys, ri) {
    var rowDiv = h('div', { class: 'wd-keyrow' });
    if (ri === 2) {
      var enter = h('button', { class: 'wd-key is-wide', type: 'button', text: 'Enter', 'data-key': 'ENTER' });
      enter.addEventListener('click', function () { onKey('ENTER'); });
      rowDiv.append(enter);
    }
    keys.split('').forEach(function (k) {
      var b = h('button', { class: 'wd-key', type: 'button', text: k, 'data-key': k });
      b.addEventListener('click', function () { onKey(k); });
      keyEls[k] = b; rowDiv.append(b);
    });
    if (ri === 2) {
      var back = h('button', { class: 'wd-key is-wide', type: 'button', html: '&#9003;', 'aria-label': 'Delete', 'data-key': 'BACK' });
      back.addEventListener('click', function () { onKey('BACK'); });
      rowDiv.append(back);
    }
    keyboard.append(rowDiv);
  });
  var overlay = h('div', { class: 'mg-overlay', hidden: true });
  var root = h('div', { class: 'mg-root wd' + (SHOW ? ' is-showcase' : '') },
    h('div', { class: 'mg-hud' }, pill('Guesses', guessEl), pill('Streak', streakEl), pill('Best', bestEl),
      h('span', { class: 'mg-spacer' }), pauseBtn, soundBtn),
    h('div', { class: 'wd-main' }, msg, board, keyboard), overlay);
  document.getElementById('game').append(root);

  /* ---------- helpers ---------- */
  function renderHud() {
    guessEl.textContent = row + '/6';
    streakEl.textContent = stats.streak ? stats.streak : '–';
    bestEl.textContent = stats.best ? stats.best + ' guess' + (stats.best === 1 ? '' : 'es') : '–';
  }
  function renderRow(r, reveal) {
    var g = guesses[r] || '';
    for (var i = 0; i < 5; i++) {
      var t = tileEls[r * 5 + i], ch = g[i] || '';
      t.textContent = ch;
      t.classList.toggle('is-filled', !!ch);
      if (reveal && ch) {
        var res = evaluate(g, answer);
        t.classList.add(res[i] === 2 ? 'is-green' : res[i] === 1 ? 'is-yellow' : 'is-grey');
        t.style.transitionDelay = (i * 0.12) + 's';
      }
    }
  }
  function renderKeys() {
    var state = {}; // letter -> best state (2 green > 1 yellow > 0 grey)
    guesses.forEach(function (g) {
      var res = evaluate(g, answer);
      for (var i = 0; i < 5; i++) {
        var k = g[i];
        if (state[k] === undefined || res[i] > state[k]) state[k] = res[i];
      }
    });
    for (var k in keyEls) {
      var b = keyEls[k];
      b.classList.remove('is-green', 'is-yellow', 'is-grey');
      if (state[k] === 2) b.classList.add('is-green');
      else if (state[k] === 1) b.classList.add('is-yellow');
      else if (state[k] === 0) b.classList.add('is-grey');
    }
  }
  function flash(text) {
    msg.textContent = text;
    msg.classList.remove('is-flash'); void msg.offsetWidth; msg.classList.add('is-flash');
  }
  function shakeRow() {
    var rowEl = board.children[row];
    rowEl.classList.remove('is-shake'); void rowEl.offsetWidth; rowEl.classList.add('is-shake');
  }

  /* ---------- the game ---------- */
  function start() {
    answer = pickAnswer();
    guesses = []; row = 0; col = 0;
    tileEls.forEach(function (t) { t.textContent = ''; t.className = 'wd-tile'; t.style.transitionDelay = ''; });
    for (var k in keyEls) keyEls[k].classList.remove('is-green', 'is-yellow', 'is-grey');
    state = 'playing'; overlay.hidden = true;
    msg.textContent = 'Guess the five-letter word!';
    renderHud();
    MG.event('game_start');
  }
  function submit() {
    var g = guesses[row];
    if (!g || g.length < 5) { flash('Not enough letters'); shakeRow(); MG.tone(200, 0.08, 'triangle', 0.04, 140); return; }
    if (!WORD_SET[g]) { flash('Not in the word list'); shakeRow(); MG.tone(200, 0.08, 'triangle', 0.04, 140); return; }
    renderRow(row, true);
    renderKeys();
    var won = g === answer;
    row++;
    renderHud();
    if (won) {
      MG.sfx.win(); MG.confetti(120);
      finish(true);
    } else if (row >= 6) {
      MG.sfx.lose();
      finish(false);
    } else {
      MG.sfx.good();
      var left = 6 - row;
      msg.textContent = left + (left === 1 ? ' guess left' : ' guesses left') + ' — keep going!';
    }
  }
  function finish(won) {
    state = 'done';
    stats.played++;
    if (won) {
      stats.won++;
      stats.streak++;
      stats.maxStreak = Math.max(stats.maxStreak, stats.streak);
      if (!stats.best || row < stats.best) stats.best = row;
    } else stats.streak = 0;
    MG.store.set('stats', stats);
    renderHud();
    var again = h('button', { class: 'mg-btn', type: 'button', text: 'Play another word' });
    again.addEventListener('click', function () { MG.adBreak('next', 'wordle-again', start); });
    overlay.innerHTML = '';
    overlay.append(h('div', { class: 'mg-card wd-card', role: 'dialog', 'aria-modal': 'true', 'aria-label': won ? 'You found the word' : 'Out of guesses' },
      h('div', { class: 'wd-badge', 'aria-hidden': 'true', text: won ? '🎉' : '🔤' }),
      h('div', null, h('small', { class: 'mg-label', text: won ? 'You found the word' : 'The word was' }),
        h('h2', { class: 'mg-title', text: won ? answer : answer }),
        !won ? h('p', { class: 'mg-sub', text: 'Six guesses, and the word was ' + answer + '.' }) : null),
      h('div', { class: 'wd-score' }, h('span', { class: 'mg-big', text: won ? row + '/6' : '0/6' }),
        h('span', { text: (won ? 'guesses · ' : '') + stats.won + ' wins in ' + stats.played + ' games · streak ' + stats.streak + (stats.maxStreak ? ' (best ' + stats.maxStreak + ')' : '') })),
      h('p', { class: 'mg-sub', text: won ? (row === 1 ? 'One guess — a perfect first try!' : row <= 3 ? 'Sharp guessing — that was quick.' : 'Found it with room to spare.') : 'A new word is waiting — common words only, so the next one is very gettable.' }),
      h('div', { class: 'mg-row' }, again)));
    overlay.hidden = false;
    MG.focusSafe(again, 700);
    MG.event('game_over', { won: won, guesses: row });
  }
  function onKey(k) {
    if (state !== 'playing') return;
    if (k === 'ENTER') { submit(); return; }
    if (k === 'BACK') {
      if (col > 0) {
        col--;
        guesses[row] = (guesses[row] || '').slice(0, -1);
        renderRow(row, false);
      }
      return;
    }
    if (col >= 5) return;
    guesses[row] = (guesses[row] || '') + k;
    col++;
    renderRow(row, false);
    MG.sfx.tap();
  }

  /* ---------- pause (word games have no clock, but the button still hides the board) ---------- */
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
      h('p', { class: 'mg-sub', text: 'The word is waiting. Take your time — there is no clock in Wordle.' }),
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
    if (e.code === 'Enter') { e.preventDefault(); onKey('ENTER'); }
    else if (e.code === 'Backspace') { e.preventDefault(); onKey('BACK'); }
    else if (/^[a-zA-Z]$/.test(e.key)) { onKey(e.key.toUpperCase()); }
  });

  /* ---------- start screen ---------- */
  function showStart() {
    var play = h('button', { class: 'mg-btn', type: 'button', text: 'Start guessing' });
    play.addEventListener('click', start);
    overlay.innerHTML = '';
    overlay.append(h('div', { class: 'mg-card', role: 'dialog', 'aria-label': 'Wordle' },
      h('div', { class: 'wd-badge', 'aria-hidden': 'true', text: '🔤' }),
      h('h2', { class: 'mg-title', text: 'Wordle' }),
      h('p', { class: 'mg-sub', text: 'Guess the five-letter word in six tries. Green means the letter is right and in the right place, yellow means it is in the word but in the wrong place, and grey means it is not in the word at all.' + (stats.played ? ' You have played ' + stats.played + ' game' + (stats.played === 1 ? '' : 's') + ' and won ' + stats.won + '.' : '') }),
      play));
    overlay.hidden = false;
  }

  /* ---------- start ---------- */
  renderSound(); renderHud(); showStart();
  if (SHOW) { // still frame: two guesses in, third row all green
    overlay.hidden = true;
    state = 'playing';
    answer = 'PLANT';
    guesses = ['CRANE', 'SLATE', 'PLANT'];
    row = 3; col = 0;
    for (var i = 0; i < 3; i++) renderRow(i, true);
    renderKeys();
    root.classList.add('is-showcase');
    renderHud();
    setTimeout(function () { document.documentElement.setAttribute('data-ready', '1'); }, 400);
  }
  MG.ready();
})();
