/* Reaction Time Test engine: wait for the signal, then tap as fast as you can. Five tries, average in milliseconds.
 * Three signals: a colour change, five start lights going out, or a beep.
 * Options: { showcase: true } still frame for cover art. */
(function () {
  'use strict';
  var MG = window.MG, h = MG.h, o = window.GAME_OPTIONS || {};
  var reduce = false, touch = false;
  try { reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; touch = matchMedia('(pointer: coarse)').matches; } catch (e) { /* ignore */ }

  var TRIES = 5;
  var RANKS = [[0, '⚡', 'Lightning'], [170, '🐍', 'Striking Snake'], [200, '🐸', 'Fly-catching Frog'], [240, '🐱', 'Pouncing Cat'],
    [280, '🐶', 'Playful Puppy'], [330, '🐨', 'Cosy Koala'], [400, '🦥', 'Sleepy Sloth']];
  var MODES = {
    colour: { name: 'Colour', icon: '🟢', intro: 'When the screen turns green, tap as fast as you can.', wait: 'Wait for green…', go: 'Tap!' },
    lights: { name: 'Start lights', icon: '🚦', intro: 'Five red lights come on one by one. When they all go out, tap!', wait: 'Wait for lights out…', go: '' },
    sound: { name: 'Sound', icon: '👂', intro: 'Listen carefully. When you hear the beep, tap!', wait: 'Listen…', go: '' }
  };
  var mode = MODES[MG.store.get('mode', 'colour')] ? MG.store.get('mode', 'colour') : 'colour';
  var best = MG.store.get('best', null) || {};

  /* ---------- state ---------- */
  var state = 'idle', times = [], timers = [], tGo = 0, lit = 0;

  /* ---------- DOM ---------- */
  var tryEl = h('b'), avgEl = h('b');
  var soundBtn = h('button', { class: 'mg-icon-btn', type: 'button' });
  var overlay = h('div', { class: 'mg-overlay', hidden: true });
  var opts = MG.options({
    overlay: overlay, title: 'Choose a signal',
    summary: function () { return MODES[mode].icon + ' ' + MODES[mode].name; },
    groups: [{ label: 'React to', items: [['colour', '🟢 Colour'], ['lights', '🚦 Start lights'], ['sound', '👂 Sound']],
      get: function () { return mode; }, set: function (v) { mode = v; MG.store.set('mode', v); reset(); } }],
    extra: function () { return [h('p', { class: 'mg-hint', text: 'Each signal keeps its own best score.' })]; }
  });
  var big = h('div', { class: 'rt-big' }), title = h('div', { class: 'rt-title' }), sub = h('div', { class: 'rt-sub' });
  var cta = h('div', { class: 'rt-cta', text: touch ? 'Tap anywhere to start' : 'Click or press Space to start' });
  var lights = h('div', { class: 'rt-lights', 'aria-hidden': 'true' });
  for (var i = 0; i < 5; i++) lights.append(h('span', { class: 'rt-light' }, h('i'), h('i')));
  var waves = h('div', { class: 'rt-waves', 'aria-hidden': 'true' }, h('i'), h('i'), h('i'));
  var panel = h('div', { class: 'rt-panel', role: 'button', tabindex: '0', 'aria-live': 'polite' }, waves, lights, big, title, sub, cta);
  var slots = h('div', { class: 'rt-slots', 'aria-label': 'Your tries' });
  var root = h('div', { class: 'mg-root rt' },
    h('div', { class: 'mg-hud' }, h('span', { class: 'mg-pill' }, h('small', { text: 'Try' }), tryEl), h('span', { class: 'mg-pill' }, h('small', { text: 'Average' }), avgEl),
      h('span', { class: 'mg-spacer' }), opts.el, soundBtn),
    h('div', { class: 'rt-main' }, panel, slots), overlay);
  document.getElementById('game').append(root);

  /* ---------- helpers ---------- */
  function rank(ms) { var r = RANKS[RANKS.length - 1]; for (var k = 0; k < RANKS.length; k++) if (ms >= RANKS[k][0]) r = RANKS[k]; return r; }
  function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }
  function avg(list) { return list.length ? Math.round(list.reduce(function (a, b) { return a + b; }, 0) / list.length) : 0; }
  function show(cls, b, t, s) {
    panel.className = 'rt-panel m-' + mode + ' is-' + cls;
    big.textContent = b || ''; title.textContent = t || ''; sub.textContent = s || '';
  }
  function renderSlots() {
    slots.innerHTML = '';
    for (var k = 0; k < TRIES; k++) {
      var ms = times[k];
      slots.append(h('span', { class: 'rt-slot' + (ms ? ' is-done' : '') + (k === times.length && state !== 'idle' ? ' is-now' : '') },
        h('b', { text: ms ? ms : '–' }), h('small', { text: ms ? 'ms' : 'try ' + (k + 1) })));
    }
    tryEl.textContent = Math.min(times.length + (state === 'idle' ? 0 : 1), TRIES) + ' / ' + TRIES;
    avgEl.textContent = times.length ? avg(times) + ' ms' : '–';
  }
  function setLights(n) { lit = n; for (var k = 0; k < 5; k++) lights.children[k].classList.toggle('on', k < n); }

  /* ---------- a try ---------- */
  function startTry() {
    clearTimers();
    if (mode === 'sound' && MG.sound.muted) { state = 'idle'; show('early', '🔇', 'Sound is off', 'Turn the sound on with the speaker button at the top, then tap to start.'); return; }
    state = 'wait';
    var m = MODES[mode];
    show('wait', mode === 'sound' ? '👂' : '', m.wait, mode === 'colour' ? 'Do not tap yet' : mode === 'lights' ? '' : 'Tap when you hear the beep');
    renderSlots();
    if (mode === 'lights') {
      setLights(0);
      for (var k = 1; k <= 5; k++) later(function (n) { return function () { setLights(n); MG.tone(520, 0.09, 'square', 0.03); }; }(k), 650 * k);
      later(signal, 650 * 5 + 400 + Math.random() * 2400);
    } else {
      later(signal, 1500 + Math.random() * 3200);
    }
  }
  function signal() {
    if (state !== 'wait') return;
    if (mode === 'sound') { MG.tone(880, 0.16, 'square', 0.09); tGo = performance.now(); state = 'go'; return; }
    requestAnimationFrame(function () { // change the screen and note the time in the same frame
      if (state !== 'wait') return;
      if (mode === 'lights') { setLights(0); show('go', '', '', ''); }
      else show('go', MODES.colour.go, '', '');
      tGo = performance.now(); state = 'go';
    });
  }
  function press(e) {
    if (!overlay.hidden) return;
    var now = performance.now(), ts = e && e.timeStamp;
    if (ts && ts > tGo - 5 && ts <= now + 1) now = ts; // the moment the finger or key went down
    if (state === 'idle' || state === 'shown' || state === 'early' || state === 'slow') { MG.sfx.tap(); startTry(); return; }
    if (state === 'wait') { // jumped the gun
      clearTimers(); state = 'early'; setLights(0);
      show('early', '✋', mode === 'lights' ? 'Jump start!' : 'Too soon!', 'That one does not count. Tap to try again.');
      MG.sfx.bad(); MG.vibrate(60); renderSlots(); return;
    }
    if (state === 'go') {
      var ms = Math.max(1, Math.round(now - tGo));
      if (ms < 100) { // like a false start in sprinting: too quick to be a reaction, so it was a guess
        state = 'early'; show('early', '🔮', 'That was a guess!', 'Under 100 ms is too quick to be a real reaction, so it does not count. Tap to try again.');
        MG.sfx.bad(); renderSlots(); return;
      }
      if (ms > 2000) { state = 'slow'; show('early', '😴', 'Still there?', 'That took over two seconds, so it does not count. Tap to try again.'); return; }
      times.push(ms); state = 'shown';
      var r = rank(ms);
      if (times.length >= TRIES) { renderSlots(); finish(); return; }
      show('shown', ms + ' ms', r[1] + ' ' + r[2], 'Tap for try ' + (times.length + 1) + ' of ' + TRIES);
      MG.sfx.good(); renderSlots();
    }
  }
  function reset() {
    clearTimers(); state = 'idle'; times = []; setLights(0); overlay.hidden = true;
    var m = MODES[mode], b = best[mode];
    show('idle', m.icon, 'Reaction Time Test', m.intro + (b ? ' Your best average: ' + b.avg + ' ms.' : ''));
    big.textContent = m.icon;
    renderSlots();
  }

  /* ---------- results ---------- */
  function finish() {
    var a = avg(times), fast = Math.min.apply(null, times), slow = Math.max.apply(null, times), r = rank(a), prev = best[mode];
    var isBest = !prev || a < prev.avg;
    if (isBest) { best[mode] = { avg: a, fast: Math.min(fast, prev ? prev.fast : fast) }; MG.store.set('best', best); }
    else if (fast < prev.fast) { prev.fast = fast; MG.store.set('best', best); }
    state = 'done';
    show('shown', a + ' ms', r[1] + ' ' + r[2], 'Average of your ' + TRIES + ' tries');
    var again = h('button', { class: 'mg-btn', type: 'button', text: 'Try again' });
    var change = h('button', { class: 'mg-btn is-secondary', type: 'button', text: 'Change signal' });
    again.addEventListener('click', function () { MG.adBreak('next', 'reaction-again', function () { reset(); startTry(); }); overlay.hidden = true; });
    change.addEventListener('click', function () { reset(); opts.open(); });
    var lab = mode === 'sound' ? 'In lab studies people react to a sound a little faster than to a light.'
      : 'Lab studies usually put reaction to a light at around 200 to 250 ms for young adults.';
    overlay.innerHTML = '';
    overlay.append(h('div', { class: 'mg-card rt-card', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Your result' },
      h('div', { class: 'rt-badge', 'aria-hidden': 'true', text: r[1] }),
      h('div', null, h('small', { class: 'mg-label', text: 'Your reaction badge' }), h('h2', { class: 'mg-title', text: r[2] })),
      h('div', { class: 'rt-score' }, h('span', { class: 'mg-big', text: a }), h('span', { text: 'ms average' })),
      isBest ? h('span', { class: 'mg-badge', text: 'New best!' }) : null,
      h('div', { class: 'rt-list' }, times.map(function (t) { return h('span', { class: t === fast ? 'is-fast' : t === slow ? 'is-slow' : '', text: t }); })),
      h('p', { class: 'mg-sub', text: 'Fastest try ' + fast + ' ms. ' + lab + (prev && !isBest ? ' Your best average: ' + prev.avg + ' ms.' : '') }),
      h('div', { class: 'mg-row' }, change, again)));
    overlay.hidden = false;
    MG.focusSafe(again, 700);
    if (isBest) { MG.confetti(120); MG.sfx.win(); } else MG.sfx.good();
    MG.event('game_over', { score: a, mode: mode });
  }

  /* ---------- input ---------- */
  panel.addEventListener('pointerdown', function (e) { if (e.button > 0) return; e.preventDefault(); press(e); });
  document.addEventListener('keydown', function (e) {
    if (e.repeat || !overlay.hidden || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key !== ' ' && e.key !== 'Enter') return;
    if (e.target !== panel && e.target.closest && e.target.closest('button, a, input')) return;
    e.preventDefault(); press(e);
  });
  soundBtn.addEventListener('click', function () { MG.sound.toggle(); renderSound(); });
  function renderSound() {
    soundBtn.innerHTML = MG.sound.muted
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z" fill="currentColor"/><path d="m16 9 6 6M22 9l-6 6"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z" fill="currentColor"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>';
    soundBtn.setAttribute('aria-label', MG.sound.muted ? 'Turn sound on' : 'Turn sound off');
    if (mode === 'sound' && state === 'idle') sub.textContent = MG.sound.muted ? 'Sound is off. Turn it on with the speaker button to play this test.' : MODES.sound.intro;
  }
  MG.onPause(function () { if (state === 'wait' || state === 'go') { clearTimers(); state = 'early'; setLights(0); show('early', '⏸', 'Paused', 'Tap to try again.'); } });

  /* ---------- start ---------- */
  reset(); renderSound();
  if (o.showcase) { // still frame: start lights, all five on, three tries done
    mode = 'lights'; opts.refresh(); times = [231, 198, 247]; state = 'wait'; renderSlots();
    show('wait', '', MODES.lights.wait, ''); setLights(5);
    root.classList.add('is-showcase');
    setTimeout(function () { document.documentElement.setAttribute('data-ready', '1'); }, 60);
  }
  MG.ready();
})();
