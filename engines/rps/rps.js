/* Rock Paper Scissors engine. Options: { moves: 3 | 5 } (5 = Lizard & Spock expansion) */
(function () {
  'use strict';
  var MG = window.MG, h = MG.h;
  var opt = window.GAME_OPTIONS || {};
  var FIVE = opt.moves === 5;
  var ALL = {
    rock: { e: '✊', name: 'Rock', key: 'r' },
    paper: { e: '✋', name: 'Paper', key: 'p' },
    scissors: { e: '✌️', name: 'Scissors', key: 's' },
    lizard: { e: '🦎', name: 'Lizard', key: 'l' },
    spock: { e: '🖖', name: 'Spock', key: 'k' }
  };
  var RULES = FIVE ? {
    rock: { scissors: 'crushes', lizard: 'crushes' },
    paper: { rock: 'covers', spock: 'disproves' },
    scissors: { paper: 'cuts', lizard: 'decapitates' },
    lizard: { spock: 'poisons', paper: 'eats' },
    spock: { scissors: 'smashes', rock: 'vaporizes' }
  } : {
    rock: { scissors: 'crushes' },
    paper: { rock: 'covers' },
    scissors: { paper: 'cuts' }
  };
  var MOVES = Object.keys(RULES);
  function beats(a, b) { return !!RULES[a][b]; }
  function counters(m) { return MOVES.filter(function (x) { return beats(x, m); }); }
  var ICON = {
    soundOn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z" fill="currentColor"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>',
    soundOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z" fill="currentColor"/><path d="m16 9 6 6M22 9l-6 6"/></svg>',
    restart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4h4"/></svg>',
    rules: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14"/><circle cx="12" cy="17.2" r=".6" fill="currentColor"/></svg>'
  };

  /* ---------- settings ---------- */
  var opp = MG.store.get('opp', 'cpu');          // 'cpu' | 'pvp'
  var level = MG.store.get('level', 'normal');   // 'easy' | 'normal' | 'hard'
  var match = MG.store.get('match', 'endless');  // 'endless' | 'bo3' | 'bo5'
  var bestStreak = MG.store.get('bestStreak', 0);
  var score = { a: 0, b: 0, d: 0 }, streak = 0, history = [], playerMoves = [], busy = false, matchOver = false;
  var pvpFirst = null; // Player 1's hidden choice in pass & play

  /* ---------- AI ---------- */
  function cpuMove() {
    var rnd = MOVES[(Math.random() * MOVES.length) | 0];
    if (level === 'easy' || playerMoves.length < 3) return rnd;
    var predicted;
    if (level === 'normal') {
      // counter the player's most frequent move, 60% of the time
      var freq = {}; playerMoves.forEach(function (m) { freq[m] = (freq[m] || 0) + 1; });
      predicted = MOVES.slice().sort(function (x, y) { return (freq[y] || 0) - (freq[x] || 0); })[0];
      if (Math.random() > 0.6) return rnd;
    } else {
      // hard: second-order Markov chain over the player's history, plus a check for "repeat after win"
      var last = playerMoves[playerMoves.length - 1], prev = playerMoves[playerMoves.length - 2];
      var t2 = {}, t1 = {};
      for (var i = 2; i < playerMoves.length; i++) {
        if (playerMoves[i - 2] === prev && playerMoves[i - 1] === last) t2[playerMoves[i]] = (t2[playerMoves[i]] || 0) + 1;
      }
      for (var j = 1; j < playerMoves.length; j++) if (playerMoves[j - 1] === last) t1[playerMoves[j]] = (t1[playerMoves[j]] || 0) + 1;
      var table = Object.keys(t2).length ? t2 : t1;
      var keys = Object.keys(table);
      if (!keys.length) return rnd;
      predicted = keys.sort(function (x, y) { return table[y] - table[x]; })[0];
      if (Math.random() < 0.15) return rnd; // stay a little unpredictable
    }
    var c = counters(predicted);
    return c[(Math.random() * c.length) | 0];
  }

  /* ---------- DOM ---------- */
  var aScore = h('b', { text: '0' }), bScore = h('b', { text: '0' }), dScore = h('b', { text: '0' });
  var aLabel = h('small'), bLabel = h('small');
  var streakEl = h('b', { text: '0' });
  var soundBtn = h('button', { class: 'mg-icon-btn', type: 'button' });
  var rulesBtn = h('button', { class: 'mg-icon-btn', type: 'button', 'aria-label': 'Show rules', title: 'Rules', html: ICON.rules });
  var handA = h('div', { class: 'rps-hand is-a', 'aria-hidden': 'true', text: ALL.rock.e });
  var handB = h('div', { class: 'rps-hand is-b', 'aria-hidden': 'true', text: ALL.rock.e });
  var nameA = h('span', { class: 'rps-who' }), nameB = h('span', { class: 'rps-who' });
  var result = h('p', { class: 'rps-result', 'aria-live': 'polite' });
  var detail = h('p', { class: 'rps-detail' });
  var histEl = h('ol', { class: 'rps-history', 'aria-label': 'Last rounds' });
  var buttons = h('div', { class: 'rps-moves' + (FIVE ? ' is-five' : '') });
  MOVES.forEach(function (m) {
    var b = h('button', { class: 'rps-move', type: 'button', 'data-m': m, 'aria-label': ALL[m].name + ' (key ' + ALL[m].key.toUpperCase() + ')' },
      h('span', { class: 'rps-move-e', 'aria-hidden': 'true', text: ALL[m].e }),
      h('span', { class: 'rps-move-n', text: ALL[m].name }),
      h('span', { class: 'mg-kbd', 'aria-hidden': 'true', text: ALL[m].key.toUpperCase() }));
    b.addEventListener('click', function () { choose(m); });
    buttons.append(b);
  });
  var arena = h('div', { class: 'rps-arena' },
    h('div', { class: 'rps-side' }, handA, nameA),
    h('div', { class: 'rps-mid' }, h('span', { class: 'rps-vs', text: 'VS' })),
    h('div', { class: 'rps-side' }, handB, nameB));
  var overlay = h('div', { class: 'mg-overlay', hidden: true });
  function cap(x) { return x.charAt(0).toUpperCase() + x.slice(1); }
  var opts = MG.options({
    overlay: overlay, title: 'Game options',
    summary: function () {
      var m = match === 'bo3' ? 'Best of 3' : match === 'bo5' ? 'Best of 5' : 'Endless';
      return (opp === 'cpu' ? 'vs CPU \u00b7 ' + cap(level) : '2 Players') + ' \u00b7 ' + m;
    },
    groups: [
      { label: 'Opponent', items: [['cpu', 'vs Computer'], ['pvp', '2 Players']], get: function () { return opp; }, set: function (v) { opp = v; MG.store.set('opp', v); resetMatch(); } },
      { label: 'Difficulty', items: [['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard']], get: function () { return level; }, set: function (v) { level = v; MG.store.set('level', v); resetMatch(); }, visible: function () { return opp === 'cpu'; } },
      { label: 'Match', items: [['endless', 'Endless'], ['bo3', 'Best of 3'], ['bo5', 'Best of 5']], get: function () { return match; }, set: function (v) { match = v; MG.store.set('match', v); resetMatch(); } }
    ],
    extra: function () {
      var r = h('button', { class: 'mg-linkbtn', type: 'button', text: 'Reset score' });
      r.addEventListener('click', function () { resetMatch(); r.textContent = 'Score reset'; });
      return [opp === 'cpu' && level === 'hard' ? h('p', { class: 'mg-hint', text: 'Hard mode learns your patterns as you play.' }) : null, r].filter(Boolean);
    }
  });
  var rootEl = h('div', { class: 'mg-root rps' + (FIVE ? ' rps-5' : '') },
    h('div', { class: 'mg-hud' },
      h('span', { class: 'mg-pill rps-a' }, aLabel, aScore),
      h('span', { class: 'mg-pill' }, h('small', { text: 'Draw' }), dScore),
      h('span', { class: 'mg-pill rps-b' }, bLabel, bScore),
      h('span', { class: 'mg-pill rps-streak', title: 'Win streak' }, h('small', { text: 'Streak' }), streakEl),
      h('span', { class: 'mg-spacer' }), FIVE ? rulesBtn : null, soundBtn),
    h('div', { class: 'rps-main' }, arena, h('div', { class: 'rps-text' }, result, detail), buttons, histEl),
    h('div', { class: 'rps-bar' }, opts.el),
    overlay);
  document.getElementById('game').append(rootEl);

  function renderSound() {
    soundBtn.innerHTML = MG.sound.muted ? ICON.soundOff : ICON.soundOn;
    soundBtn.setAttribute('aria-label', MG.sound.muted ? 'Turn sound on' : 'Turn sound off');
  }
  soundBtn.addEventListener('click', function () { MG.sound.toggle(); renderSound(); });
  rulesBtn.addEventListener('click', showRules);

  function labels() {
    aLabel.textContent = opp === 'cpu' ? 'You' : 'P1';
    bLabel.textContent = opp === 'cpu' ? 'CPU' : 'P2';
    nameA.textContent = opp === 'cpu' ? 'You' : 'Player 1';
    nameB.textContent = opp === 'cpu' ? 'Computer' : 'Player 2';
    if (opts) opts.refresh();
  }
  function target() { return match === 'bo3' ? 2 : match === 'bo5' ? 3 : 0; }
  function renderScore() {
    aScore.textContent = score.a; bScore.textContent = score.b; dScore.textContent = score.d; streakEl.textContent = streak;
  }
  function resetMatch() {
    score = { a: 0, b: 0, d: 0 }; streak = 0; history = []; matchOver = false; pvpFirst = null; busy = false;
    handA.textContent = ALL.rock.e; handB.textContent = ALL.rock.e;
    rootEl.classList.remove('is-win', 'is-lose', 'is-draw', 'is-hidden-a');
    overlay.hidden = true;
    labels(); renderScore(); renderHistory();
    prompt();
    MG.event('game_start', { opponent: opp, match: match });
  }
  function prompt() {
    detail.textContent = '';
    if (opp === 'pvp') result.textContent = pvpFirst ? 'Player 2: choose your move' : 'Player 1: choose your move';
    else result.textContent = target() ? 'First to ' + target() + ' wins. Choose your move' : 'Choose your move';
    if (opp === 'pvp' && pvpFirst) detail.textContent = 'Player 1 has chosen. Player 2, no peeking needed—it’s hidden.';
  }
  function renderHistory() {
    histEl.innerHTML = '';
    history.slice(-8).forEach(function (r) {
      histEl.append(h('li', { class: 'is-' + r.res, title: ALL[r.a].name + ' vs ' + ALL[r.b].name },
        h('span', { 'aria-hidden': 'true', text: ALL[r.a].e + ALL[r.b].e }),
        h('span', { class: 'mg-sr', text: (r.res === 'w' ? 'Won' : r.res === 'l' ? 'Lost' : 'Draw') + ': ' + ALL[r.a].name + ' vs ' + ALL[r.b].name })));
    });
  }

  function choose(m) {
    if (busy) return;
    if (matchOver) { resetMatch(); }
    if (opp === 'pvp' && !pvpFirst) {
      pvpFirst = m; MG.sfx.tap();
      rootEl.classList.add('is-hidden-a');
      handA.textContent = '❓';
      prompt(); return;
    }
    var a = opp === 'pvp' ? pvpFirst : m;
    var b = opp === 'pvp' ? m : cpuMove();
    if (opp === 'cpu') playerMoves.push(m);
    pvpFirst = null;
    play(a, b);
  }
  function play(a, b) {
    busy = true;
    rootEl.classList.remove('is-win', 'is-lose', 'is-draw', 'is-hidden-a');
    handA.textContent = ALL.rock.e; handB.textContent = ALL.rock.e;
    rootEl.classList.add('is-shaking');
    result.textContent = opp === 'cpu' ? 'Rock… paper…' : 'Rock… paper…'; detail.textContent = '';
    MG.sfx.tap();
    setTimeout(function () {
      rootEl.classList.remove('is-shaking');
      handA.textContent = ALL[a].e; handB.textContent = ALL[b].e;
      var res = a === b ? 'd' : beats(a, b) ? 'w' : 'l';
      history.push({ a: a, b: b, res: res });
      if (res === 'w') { score.a++; streak = opp === 'cpu' ? streak + 1 : streak; }
      else if (res === 'l') { score.b++; if (opp === 'cpu') streak = 0; }
      else score.d++;
      if (streak > bestStreak) { bestStreak = streak; MG.store.set('bestStreak', bestStreak); }
      if (res === 'w' && opp === 'cpu' && streak > 0 && streak % 3 === 0) { MG.confetti(60); }
      rootEl.classList.add(res === 'w' ? 'is-win' : res === 'l' ? 'is-lose' : 'is-draw');
      var who = opp === 'cpu' ? (res === 'w' ? 'You win!' : res === 'l' ? 'You lose' : 'Draw') : (res === 'w' ? 'Player 1 wins!' : res === 'l' ? 'Player 2 wins!' : 'Draw');
      result.textContent = who;
      detail.textContent = res === 'd' ? 'Both chose ' + ALL[a].name + '.' : res === 'w' ? ALL[a].name + ' ' + RULES[a][b] + ' ' + ALL[b].name + '.' : ALL[b].name + ' ' + RULES[b][a] + ' ' + ALL[a].name + '.';
      if (res === 'w') MG.sfx.good(); else if (res === 'l') MG.sfx.bad(); else MG.sfx.draw();
      renderScore(); renderHistory();
      MG.event('round', { result: res });
      busy = false;
      var t = target();
      if (t && (score.a >= t || score.b >= t)) endMatch();
    }, 520);
  }
  function endMatch() {
    matchOver = true;
    var aWon = score.a > score.b;
    var title = opp === 'cpu' ? (aWon ? 'You won the match!' : 'Computer wins the match') : (aWon ? 'Player 1 wins the match!' : 'Player 2 wins the match!');
    if (aWon || opp === 'pvp') { MG.sfx.win(); MG.confetti(); } else MG.sfx.lose();
    MG.event('game_over', { result: opp === 'cpu' ? (aWon ? 'win' : 'lose') : 'win', score: score.a + '-' + score.b });
    overlay.innerHTML = '';
    var again = h('button', { class: 'mg-btn', type: 'button', text: 'New match' });
    again.addEventListener('click', function () { MG.adBreak('next', 'rps-match', resetMatch); });
    overlay.append(h('div', { class: 'mg-card' },
      h('h2', { class: 'mg-title', text: title }),
      h('div', { class: 'mg-big', text: score.a + ' – ' + score.b }),
      opp === 'cpu' ? h('p', { class: 'mg-hint', text: 'Best win streak: ' + bestStreak }) : null,
      again));
    overlay.hidden = false;
    setTimeout(function () { try { again.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }, 50);
  }
  function showRules() {
    overlay.innerHTML = '';
    var list = h('ul', { class: 'rps-rules' });
    MOVES.forEach(function (w) { Object.keys(RULES[w]).forEach(function (l) {
      list.append(h('li', null, h('span', { 'aria-hidden': 'true', text: ALL[w].e }), ' ' + ALL[w].name + ' ' + RULES[w][l] + ' ' + ALL[l].name));
    }); });
    var close = h('button', { class: 'mg-btn is-small', type: 'button', text: 'Got it' });
    close.addEventListener('click', function () { overlay.hidden = true; });
    overlay.append(h('div', { class: 'mg-card rps-rules-card' }, h('h2', { class: 'mg-title', text: 'Rules' }), list, close));
    overlay.hidden = false;
    try { close.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
  }
  overlay.addEventListener('click', function (e) { if (e.target === overlay && !matchOver) overlay.hidden = true; });

  document.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var k = (e.key || '').toLowerCase();
    if (!overlay.hidden) { if (e.key === 'Escape' && !matchOver) overlay.hidden = true; return; }
    for (var i = 0; i < MOVES.length; i++) if (ALL[MOVES[i]].key === k) { e.preventDefault(); choose(MOVES[i]); return; }
  });

  renderSound(); labels(); renderScore(); prompt();
  MG.ready();
})();
