/* Typing Speed Test engine: type the words before the clock runs out. Live speed and accuracy,
 * a rainbow keyboard that shows which finger presses each key, and a result card with a speed badge.
 * Options: { showcase: true } still frame for cover art. */
(function () {
  'use strict';
  var MG = window.MG, h = MG.h, o = window.GAME_OPTIONS || {};
  var reduce = false, touch = false;
  try { reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; touch = matchMedia('(pointer: coarse)').matches; } catch (e) { /* ignore */ }

  /* ---------- texts (written for this game) ---------- */
  var WORDS = [];
  ('the be to of and a in that have it for not on with he as you do at this but his by from they we say her she or an will my one ' +
   'all would there their what so up out if about who get which go me when make can like time no just him know take people into ' +
   'year your good some could them see other than then now look only come its over think also back after use two how our work ' +
   'first well way even new want because any these give day most us is was are been has had were said did made find where much ' +
   'too very still being here off went old put each those such why let thing great both place same another end while last never ' +
   'under might next hand part high life world head home must long small large own big right found should keep start show every ' +
   'something house again near city tree play light open seem run close fast slow fire water earth sky sun moon star rain snow wind ' +
   'cloud river sea ocean beach forest flower garden bird fish cat dog horse mouse frog bee apple bread milk cake tea juice music ' +
   'song dance smile laugh happy funny friend family mother father sister brother baby school book paper pencil letter word story ' +
   'picture color green blue red yellow pink purple orange black white brown gold silver round square little tiny huge warm cold ' +
   'hot cool soft hard sweet quick bright dark early late today tomorrow morning night week summer winter spring autumn walk jump ' +
   'swim fly sing draw read write learn teach help ask answer dream sleep wake eat drink cook clean build plant grow carry catch ' +
   'throw kick climb hide lose win try follow begin finish').split(' ').forEach(function (w) { if (WORDS.indexOf(w) < 0) WORDS.push(w); });
  var FACTS = [
    'Octopuses have three hearts and blue blood.',
    'A day on Venus lasts longer than a whole year on Venus.',
    'Bananas count as berries, but strawberries do not.',
    'Sharks were swimming in the oceans long before the first trees grew.',
    'A group of flamingos is called a flamboyance.',
    'Sea otters often hold hands while they sleep so they do not drift apart.',
    'Butterflies taste their food with their feet.',
    'A bolt of lightning is about five times hotter than the surface of the Sun.',
    'Hummingbirds can hover in one spot and even fly backwards.',
    'Koalas can sleep for up to twenty hours a day.',
    'Light from the Sun takes about eight minutes to reach the Earth.',
    'The Moon drifts about four centimetres further away from the Earth every year.',
    'Giraffes have seven bones in their necks, the same number as people.',
    'Honeybees dance to tell each other where to find flowers.',
    'Owls cannot move their eyes, so they turn their heads instead.',
    'Water grows by about nine percent when it freezes into ice.',
    'Mount Everest grows a few millimetres taller every year.',
    'A chameleon can shoot out a tongue that is longer than its own body.',
    'Starfish have no brain and no blood.',
    'Giant pandas spend around half of every day eating bamboo.',
    'Saturn is so light for its size that it would float in a big enough bathtub.',
    'Rainbows are really full circles, but from the ground we only see part of them.',
    'A fluffy white cloud can weigh as much as a hundred elephants.',
    'Dolphins call each other with special whistles that work like names.',
    'An ostrich has eyes that are bigger than its brain.',
    'Sloths can hold their breath for longer than dolphins can.',
    'Cats spend about two thirds of their lives asleep.',
    'Some kinds of bamboo can grow almost a metre in a single day.',
    'The Pacific is the largest ocean and covers about a third of the planet.',
    'There are more trees on Earth than stars in the Milky Way.',
    'A snail has thousands of tiny teeth on its tongue.',
    'Polar bears have black skin under their thick white fur.',
    'The Eiffel Tower can be about fifteen centimetres taller on a hot summer day.',
    'Most frogs drink water through their skin instead of their mouths.',
    'It takes about twelve bees their whole lives to make one teaspoon of honey.',
    'Jupiter has a storm called the Great Red Spot that is wider than the Earth.',
    'Earth is the only planet in our solar system that is not named after a god.',
    'A shrimp keeps its heart in its head.',
    'Penguins live almost only in the southern half of the world.',
    'People can tell apart thousands of different smells.'
  ];
  var RANKS = [[0, '🐢', 'Steady Turtle'], [20, '🐇', 'Quick Rabbit'], [35, '🦊', 'Clever Fox'], [50, '🐎', 'Galloping Horse'],
    [65, '🐆', 'Cheetah'], [80, '🦅', 'Falcon'], [100, '🚀', 'Rocket']];

  /* ---------- settings and saved results ---------- */
  var cfg = MG.store.get('cfg', null) || {};
  if ([15, 30, 60].indexOf(cfg.time) < 0) cfg.time = 30;
  if (cfg.text !== 'facts') cfg.text = 'words';
  if (cfg.guide !== false) cfg.guide = true;
  var best = MG.store.get('best', null) || {}, tests = MG.store.get('tests', 0) || 0;

  /* ---------- state ---------- */
  var target = [], typed = [], wi = 0, cur = '', running = false, finished = false, t0 = 0, timer = 0;
  var ok = 0, bad = 0, miss = {}, samples = [], streak = 0, shift = 0, queue = [];

  /* ---------- DOM ---------- */
  function pill(label, el) { return h('span', { class: 'mg-pill ty-stat' }, h('small', { text: label }), el); }
  var timeEl = h('b'), wpmEl = h('b'), accEl = h('b');
  var soundBtn = h('button', { class: 'mg-icon-btn', type: 'button' });
  var overlay = h('div', { class: 'mg-overlay', hidden: true });
  var wide = null;
  try { wide = matchMedia('(min-width: 600px) and (min-height: 430px)'); } catch (e) { /* ignore */ }
  var opts = MG.options({
    overlay: overlay, title: 'Test options',
    summary: function () { return cfg.time + ' s · ' + (cfg.text === 'words' ? 'Words' : 'Fun facts'); },
    groups: [
      { label: 'Time', items: [[15, '15 s'], [30, '30 s'], [60, '60 s']], get: function () { return cfg.time; }, set: function (v) { cfg.time = v; saveCfg(); newTest(); } },
      { label: 'Text', items: [['words', 'Common words'], ['facts', 'Fun facts']], get: function () { return cfg.text; }, set: function (v) { cfg.text = v; saveCfg(); newTest(); } },
      { label: 'Key guide', items: [[true, 'On'], [false, 'Off']], get: function () { return cfg.guide; }, set: function (v) { cfg.guide = v; saveCfg(); guideNext(); },
        visible: function () { return !wide || wide.matches; } }
    ],
    onClose: function () { focusInput(); }
  });
  var words = h('div', { class: 'ty-words' });
  var caret = h('i', { class: 'ty-caret' });
  words.append(caret);
  var input = h('input', { class: 'ty-input', type: 'text', autocomplete: 'off', autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false',
    enterkeyhint: 'next', 'aria-label': 'Type the words shown', 'aria-describedby': 'ty-sr' });
  var sr = h('p', { class: 'mg-sr', id: 'ty-sr' });
  var prompt = h('div', { class: 'ty-prompt', 'aria-hidden': 'true', text: touch ? '👆 Tap here and start typing' : '⌨️ Click here or press any key to type' });
  var view = h('div', { class: 'ty-view', 'aria-hidden': 'true' }, words);
  var box = h('div', { class: 'ty-box' }, view, input, prompt, sr);
  var status = h('p', { class: 'ty-status', 'aria-live': 'polite' });
  var restartBtn = h('button', { class: 'mg-btn is-small is-secondary ty-restart', type: 'button', 'aria-label': 'Restart the test',
    html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1"/><path d="M3.5 4.5v5h5"/></svg><span>Restart</span>' });
  var kb = h('div', { class: 'ty-kb', 'aria-hidden': 'true' });
  var ladder = h('ul', { class: 'ty-ladder', 'aria-label': 'Speed badges' });
  var streakEl = h('div', { class: 'ty-streak', 'aria-hidden': 'true' });
  var root = h('div', { class: 'mg-root ty' },
    h('div', { class: 'mg-hud' }, pill('Time', timeEl), pill('WPM', wpmEl), pill('Accuracy', accEl), h('span', { class: 'mg-spacer' }), soundBtn),
    h('div', { class: 'ty-main' }, box, h('div', { class: 'ty-bar' }, opts.el, status, restartBtn), kb,
      h('p', { class: 'ty-ladder-h', text: 'Speed badges' }), ladder),
    streakEl, overlay);
  function renderLadder() { // badges you have reached in this test type are lit, your best one is ringed
    var b = best[cfg.time + '-' + cfg.text], top = b ? rank(b.wpm) : null;
    ladder.innerHTML = '';
    RANKS.forEach(function (r) {
      ladder.append(h('li', { class: top && r === top ? 'now' : top && r[0] < top[0] ? 'got' : '', title: r[2] + ': ' + r[0] + '+ words per minute' },
        h('span', { 'aria-hidden': 'true', text: r[1] }), r[0] + '+'));
    });
  }
  document.getElementById('game').append(root);

  /* ---------- the rainbow keyboard: one colour per finger ---------- */
  var ROWS = [['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'], ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';', "'"],
    ['shiftL', 'z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '/', 'shiftR'], [' ']];
  var FINGER = { ' ': 0, shiftL: 1, shiftR: 8 };
  ['qaz', 'wsx', 'edc', 'rfvtgb', 'yhnujm', 'ik,', 'ol.', "p;/'"].forEach(function (s, i) { s.split('').forEach(function (k) { FINGER[k] = i + 1; }); });
  var keyEls = {};
  ROWS.forEach(function (row, ri) {
    var r = h('div', { class: 'ty-row r' + ri });
    row.forEach(function (k) {
      var label = k === ' ' ? 'space' : k.indexOf('shift') === 0 ? '⇧' : k;
      var el = h('span', { class: 'ty-key f' + FINGER[k] + (k === ' ' ? ' is-space' : '') + (k.indexOf('shift') === 0 ? ' is-shift' : '') + (k === 'f' || k === 'j' ? ' is-home' : ''), text: label });
      keyEls[k] = el; r.append(el);
    });
    kb.append(r);
  });
  function keysFor(ch) { // the key (plus the shift on the other hand) that types this character
    if (ch === undefined) return [];
    var low = ch.toLowerCase();
    if (ch === '?') return ['/', 'shiftL'];
    if (!keyEls[low]) return [];
    if (ch !== low) return [low, FINGER[low] <= 4 ? 'shiftR' : 'shiftL'];
    return [low];
  }
  function flash(ch, good) {
    if (reduce) return;
    keysFor(ch).forEach(function (k) { var el = keyEls[k]; el.classList.remove('is-hit', 'is-miss'); void el.offsetWidth; el.classList.add(good ? 'is-hit' : 'is-miss'); });
  }
  function guideNext() {
    Object.keys(keyEls).forEach(function (k) { keyEls[k].classList.remove('is-next'); });
    if (!cfg.guide || finished) return;
    var w = target[wi] || '', ch = cur.length < w.length ? w[cur.length] : ' ';
    if (cur.length <= w.length && w.indexOf(cur) !== 0) ch = '\b'; // after a mistake the next key is backspace: show none
    keysFor(ch).forEach(function (k) { keyEls[k].classList.add('is-next'); });
  }

  /* ---------- words on screen ---------- */
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = (Math.random() * (i + 1)) | 0, t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function nextWord() {
    if (cfg.text === 'words') { var w; do { w = WORDS[(Math.random() * WORDS.length) | 0]; } while (w === target[target.length - 1]); return w; }
    if (!queue.length) queue = shuffle(FACTS.slice()).join(' ').split(' ');
    return queue.shift();
  }
  function addWords(n) {
    for (var i = 0; i < n; i++) {
      var w = nextWord(), el = h('span', { class: 'ty-w' });
      for (var k = 0; k < w.length; k++) el.append(h('i', { text: w[k] }));
      target.push(w); words.insertBefore(el, caret);
    }
  }
  function paint(i, text, active) {
    var el = words.children[i], w = target[i];
    if (!el) return;
    while (el.children.length > w.length) el.lastChild.remove();
    for (var k = 0; k < w.length; k++) el.children[k].className = k < text.length ? (text[k] === w[k] ? 'ok' : 'bad') : (active ? '' : 'miss');
    for (k = w.length; k < Math.min(text.length, w.length + 10); k++) el.append(h('i', { class: 'extra', text: text[k] }));
    el.className = 'ty-w' + (active ? ' is-active' : '') + (!active && text !== w ? ' is-wrong' : '');
  }
  function placeCaret() {
    var el = words.children[wi];
    if (!el || !el.children.length) return;
    var kids = el.children, n = cur.length, x, y, c;
    if (n < kids.length) { c = kids[n]; x = c.offsetLeft; } else { c = kids[kids.length - 1]; x = c.offsetLeft + c.offsetWidth; }
    y = c.offsetTop;
    caret.style.transform = 'translate(' + x + 'px,' + y + 'px)';
    // keep the line being typed as the second visible line
    var pitch = el.offsetHeight || 1, line = Math.round(el.offsetTop / pitch), s = Math.max(0, line - 1) * pitch;
    if (s !== shift) { shift = s; words.style.transform = 'translateY(' + (-s) + 'px)'; }
  }

  /* ---------- typing ---------- */
  function countKeys(prev, next) {
    var w = target[wi] || '', i = 0;
    while (i < prev.length && i < next.length && prev[i] === next[i]) i++;
    for (var k = i; k < next.length; k++) {
      var good = next[k] === w[k];
      if (good) ok++; else { bad++; var ex = k < w.length ? w[k].toLowerCase() : ' '; miss[ex] = (miss[ex] || 0) + 1; }
      flash(next[k], good); click(good);
    }
  }
  function click(good) {
    if (good) MG.tone(1500 + Math.random() * 300, 0.018, 'triangle', 0.016);
    else MG.tone(210, 0.07, 'square', 0.022, 160);
  }
  function onInput() {
    if (finished) { input.value = ''; return; }
    var v = input.value.replace(/\s/g, ' ');
    if (!running) { if (!v.trim()) { input.value = ''; return; } start(); }
    for (var guard = 0; guard < 50; guard++) {
      var sp = v.indexOf(' ');
      if (sp < 0) break;
      var part = v.slice(0, sp); v = v.slice(sp + 1);
      if (!part && !cur) continue; // a space at the start of a word does nothing
      countKeys(cur, part);
      var w = target[wi], spaceOk = part.length >= w.length;
      if (spaceOk) ok++; else { bad++; miss[w[part.length].toLowerCase()] = (miss[w[part.length].toLowerCase()] || 0) + 1; }
      flash(' ', spaceOk);
      commit(part);
    }
    countKeys(cur, v);
    cur = v;
    if (input.value !== cur) input.value = cur;
    try { input.setSelectionRange(cur.length, cur.length); } catch (e) { /* ignore */ }
    paint(wi, cur, true); placeCaret(); guideNext(); live();
  }
  function commit(word) {
    typed[wi] = word;
    var right = word === target[wi];
    paint(wi, word, false);
    if (right) { streak++; if (streak % 10 === 0) cheer(streak); } else streak = 0;
    wi++; cur = '';
    if (wi > target.length - 20) addWords(30);
    paint(wi, '', true);
  }
  function cheer(n) {
    streakEl.textContent = '🔥 ' + n + ' in a row!';
    streakEl.classList.remove('is-on'); void streakEl.offsetWidth; streakEl.classList.add('is-on');
    MG.tone(988, 0.08, 'triangle', 0.04); MG.tone(1319, 0.12, 'triangle', 0.04, 0, 0.07);
  }

  /* ---------- clock and scores ---------- */
  function chars() { // [characters in correct words incl. spaces, all characters typed]
    var good = 0, all = 0;
    for (var i = 0; i < wi; i++) { all += typed[i].length + 1; if (typed[i] === target[i]) good += target[i].length + 1; }
    all += cur.length;
    if (cur && target[wi].indexOf(cur) === 0) good += cur.length;
    return [good, all];
  }
  function elapsed() { return Math.min(cfg.time, (performance.now() - t0) / 1000); }
  function speeds(sec) { var c = chars(), m = Math.max(sec, 0.001) / 60; return [Math.round(c[0] / 5 / m), Math.round(c[1] / 5 / m)]; }
  function accuracy() { return ok + bad ? Math.round(ok / (ok + bad) * 1000) / 10 : 100; }
  function live() {
    if (!running) return;
    var e = elapsed();
    timeEl.textContent = Math.ceil(cfg.time - e - 0.0001);
    wpmEl.textContent = e < 1.5 ? '–' : speeds(e)[0];
    accEl.textContent = Math.floor(accuracy()) + '%';
  }
  function start() {
    running = true; t0 = performance.now(); samples = [];
    root.classList.add('is-running'); status.textContent = '';
    timer = setInterval(function () {
      var e = elapsed();
      while (samples.length < Math.floor(e)) { var s = speeds(samples.length + 1); samples.push(s); }
      live();
      if (e >= cfg.time) finish();
    }, 100);
    MG.event('game_start', { mode: cfg.time + '-' + cfg.text });
  }
  function finish() {
    clearInterval(timer); running = false; finished = true;
    root.classList.remove('is-running');
    try { input.blur(); } catch (e) { /* ignore */ }
    var sp = speeds(cfg.time), acc = accuracy(), key = cfg.time + '-' + cfg.text, prev = best[key], isBest = !prev || sp[0] > prev.wpm;
    if (isBest && sp[0] > 0) { best[key] = { wpm: sp[0], acc: acc }; MG.store.set('best', best); }
    tests++; MG.store.set('tests', tests);
    guideNext(); timeEl.textContent = '0'; wpmEl.textContent = sp[0]; accEl.textContent = Math.floor(acc) + '%';
    showResult(sp[0], sp[1], acc, isBest && sp[0] > 0 && !!prev, prev);
    MG.event('game_over', { score: sp[0], mode: key });
  }

  /* ---------- result card ---------- */
  function rank(w) { var r = RANKS[0]; RANKS.forEach(function (x) { if (w >= x[0]) r = x; }); return r; }
  function showResult(wpm, raw, acc, newBest, prev) {
    var r = rank(wpm), avg = touch ? 36 : 52, who = touch ? 'phone typists' : 'keyboard typists';
    var big = h('div', { class: 'mg-big ty-wpm', text: '0' });
    var chart = h('canvas', { class: 'ty-chart', 'aria-hidden': 'true' });
    var compare = wpm >= avg + 5 ? 'Faster than the average of ' + avg + ' WPM in a large study of ' + who + '.'
      : wpm >= avg - 5 ? 'Right around the average of ' + avg + ' WPM in a large study of ' + who + '.'
      : 'The average in a large study of ' + who + ' was ' + avg + ' WPM. Practice makes it climb!';
    var worst = Object.keys(miss).sort(function (a, b) { return miss[b] - miss[a]; }).slice(0, 3);
    var again = h('button', { class: 'mg-btn', type: 'button', text: 'Try again' });
    var change = h('button', { class: 'mg-btn is-secondary', type: 'button', text: 'Change test' });
    again.addEventListener('click', function () { overlay.hidden = true; MG.adBreak('next', 'typing-again', function () { newTest(); focusInput(); }); });
    change.addEventListener('click', function () { newTest(); opts.open(); });
    var card = h('div', { class: 'mg-card ty-card', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Your result' },
      h('div', { class: 'ty-rank' }, h('span', { class: 'ty-badge', 'aria-hidden': 'true', text: r[1] }), h('span', null, h('small', { text: 'Your speed badge' }), h('b', { text: r[2] }))),
      h('div', { class: 'ty-score' }, big, h('span', { text: 'words per minute' })),
      newBest ? h('span', { class: 'mg-badge', text: 'New best!' }) : null,
      h('div', { class: 'ty-facts' },
        h('span', null, h('b', { text: Math.floor(acc) + '%' }), h('small', { text: 'accuracy' })),
        h('span', null, h('b', { text: raw }), h('small', { text: 'raw WPM' })),
        h('span', null, h('b', { text: cfg.time + ' s' }), h('small', { text: cfg.text === 'words' ? 'words' : 'fun facts' }))),
      chart,
      h('p', { class: 'mg-sub ty-compare', text: compare + (prev && !newBest ? ' Your best here: ' + prev.wpm + ' WPM.' : '') }),
      worst.length ? h('div', { class: 'ty-trouble' }, h('small', { text: 'Keys you missed most' }),
        h('span', null, worst.map(function (k) { return h('kbd', { class: 'mg-kbd', text: k === ' ' ? 'space' : k }); }))) : null,
      h('div', { class: 'mg-row' }, change, again));
    overlay.innerHTML = ''; overlay.append(card); overlay.hidden = false;
    MG.focusSafe(again, 1000);
    drawChart(chart);
    countUp(big, wpm);
    if (newBest) { MG.confetti(130); MG.sfx.win(); } else MG.sfx.good();
  }
  function countUp(el, to) {
    if (reduce || to < 3) { el.textContent = to; return; }
    var t1 = performance.now();
    (function f(t) { var p = Math.min(1, (t - t1) / 700); el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(f); })(t1);
  }
  function drawChart(cv) {
    var W = Math.max(200, Math.min(320, (cv.parentNode.clientWidth || 300) - 8)), H = 78;
    var x = MG.fitCanvas(cv, W, H);
    if (samples.length < 2) { cv.style.display = 'none'; return; }
    var max = 10; samples.forEach(function (s) { max = Math.max(max, s[0], s[1]); }); max *= 1.12;
    var n = samples.length, px = function (i) { return 6 + i / (n - 1) * (W - 12); }, py = function (v) { return H - 6 - v / max * (H - 16); };
    x.strokeStyle = 'rgba(120,100,170,.18)'; x.lineWidth = 1;
    for (var g = 1; g <= 3; g++) { x.beginPath(); x.moveTo(0, H - 6 - g * (H - 16) / 3 + .5); x.lineTo(W, H - 6 - g * (H - 16) / 3 + .5); x.stroke(); }
    x.beginPath(); samples.forEach(function (s, i) { if (i) x.lineTo(px(i), py(s[1])); else x.moveTo(px(i), py(s[1])); });
    x.strokeStyle = 'rgba(140,120,200,.45)'; x.lineWidth = 2; x.setLineDash([4, 4]); x.stroke(); x.setLineDash([]);
    var grad = x.createLinearGradient(0, 0, 0, H); grad.addColorStop(0, 'rgba(255,79,154,.32)'); grad.addColorStop(1, 'rgba(255,79,154,0)');
    x.beginPath(); samples.forEach(function (s, i) { if (i) x.lineTo(px(i), py(s[0])); else x.moveTo(px(i), py(s[0])); });
    x.lineTo(px(n - 1), H); x.lineTo(px(0), H); x.closePath(); x.fillStyle = grad; x.fill();
    x.beginPath(); samples.forEach(function (s, i) { if (i) x.lineTo(px(i), py(s[0])); else x.moveTo(px(i), py(s[0])); });
    x.strokeStyle = '#FF4F9A'; x.lineWidth = 3; x.lineJoin = 'round'; x.stroke();
  }

  /* ---------- a new test ---------- */
  function saveCfg() { MG.store.set('cfg', cfg); opts.refresh(); }
  function newTest() {
    clearInterval(timer); running = false; finished = false;
    target = []; typed = []; wi = 0; cur = ''; ok = 0; bad = 0; miss = {}; samples = []; streak = 0; shift = 0; queue = [];
    while (words.firstChild !== caret) words.firstChild.remove();
    words.style.transform = '';
    addWords(60);
    sr.textContent = target.slice(0, 40).join(' ');
    input.value = ''; overlay.hidden = true; root.classList.remove('is-running');
    timeEl.textContent = cfg.time; wpmEl.textContent = '0'; accEl.textContent = '–';
    var b = best[cfg.time + '-' + cfg.text];
    status.textContent = b ? 'Best: ' + b.wpm + ' WPM' : 'The clock starts with your first key';
    paint(0, '', true); placeCaret(); guideNext(); renderLadder();
  }
  function focusInput() { if (!touch && overlay.hidden) try { input.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }

  /* ---------- events ---------- */
  input.addEventListener('input', onInput);
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Tab' || e.key === 'Escape') { e.preventDefault(); newTest(); focusInput(); return; }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Home' || e.key === 'End' || e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault();
    if (e.key === 'Enter') { e.preventDefault(); if (cur) { input.value = cur + ' '; onInput(); } }
  });
  input.addEventListener('paste', function (e) { e.preventDefault(); });
  input.addEventListener('focus', function () { root.classList.add('is-focus'); });
  input.addEventListener('blur', function () { root.classList.remove('is-focus'); });
  ['click', 'select'].forEach(function (ev) { input.addEventListener(ev, function () { try { input.setSelectionRange(input.value.length, input.value.length); } catch (e) { /* ignore */ } }); });
  document.addEventListener('keydown', function (e) { // any key while the text box is not focused brings typing back
    if (!overlay.hidden || e.target === input || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target.closest && e.target.closest('button, input, a')) return;
    if (e.key && e.key.length === 1) input.focus({ preventScroll: true });
  });
  restartBtn.addEventListener('click', function () { newTest(); focusInput(); });
  soundBtn.addEventListener('click', function () { MG.sound.toggle(); renderSound(); });
  function renderSound() {
    soundBtn.innerHTML = MG.sound.muted
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z" fill="currentColor"/><path d="m16 9 6 6M22 9l-6 6"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z" fill="currentColor"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>';
    soundBtn.setAttribute('aria-label', MG.sound.muted ? 'Turn sound on' : 'Turn sound off');
  }
  MG.onPause(function () { if (running && document.hidden) { newTest(); status.textContent = 'Test stopped when you left the page'; } });
  window.addEventListener('resize', function () { placeCaret(); });

  /* ---------- start ---------- */
  renderSound();
  newTest();
  if (o.showcase) { // still frame: halfway through a fun-facts test, typing fast with one slip
    root.classList.add('is-showcase', 'is-running', 'is-focus');
    cfg.text = 'facts'; cfg.guide = true;
    target = []; queue = ('Octopuses have three hearts and blue blood. Hummingbirds can hover in one spot and even fly backwards. ' +
      'A group of flamingos is called a flamboyance. Sea otters often hold hands while they sleep so they do not drift apart.').split(' ');
    while (words.firstChild !== caret) words.firstChild.remove();
    addWords(queue.length);
    ['Octopuses', 'have', 'three', 'hearts', 'and', 'blue', 'blood.', 'Hummingbirds', 'can', 'hovr', 'in', 'one'].forEach(function (w) { typed[wi] = w; paint(wi, w, false); wi++; });
    cur = 'sp'; paint(wi, cur, true); placeCaret(); guideNext();
    timeEl.textContent = '18'; wpmEl.textContent = '74'; accEl.textContent = '97%';
    keyEls.h.classList.add('is-hit'); keyEls.e.classList.add('is-hit');
    streakEl.textContent = '🔥 10 in a row!'; streakEl.classList.add('is-on', 'is-still');
    status.textContent = '';
    setTimeout(function () { placeCaret(); document.documentElement.setAttribute('data-ready', '1'); }, 120);
  } else {
    focusInput();
  }
  MG.ready();
})();
