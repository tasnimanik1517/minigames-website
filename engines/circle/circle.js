/* Perfect Circle Challenge engine: draw one orbit around the planet and see how round it is.
 * The line changes colour as it wobbles, the perfect circle appears afterwards and a little moon flies your orbit.
 * Options: { showcase: true } still frame for cover art. */
(function () {
  'use strict';
  var MG = window.MG, h = MG.h, o = window.GAME_OPTIONS || {};
  var reduce = false, touch = false;
  try { reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; touch = matchMedia('(pointer: coarse)').matches; } catch (e) { /* ignore */ }

  var RANKS = [[0, '🥔', 'Potato'], [50, '🥚', 'Egg'], [70, '🍪', 'Cookie'], [80, '🍊', 'Orange'], [88, '🌕', 'Full Moon'], [94, '🔮', 'Crystal Ball'], [97, '⭕', "Giotto's O"]];
  var best = +MG.store.get('best', 0) || 0, tries = +MG.store.get('tries', 0) || 0;

  /* ---------- DOM ---------- */
  function pill(label, el) { return h('span', { class: 'mg-pill' }, h('small', { text: label }), el); }
  var bestEl = h('b'), triesEl = h('b');
  var soundBtn = h('button', { class: 'mg-icon-btn', type: 'button' });
  var bg = h('canvas', { class: 'ci-cv', 'aria-hidden': 'true' }), ink = h('canvas', { class: 'ci-cv', 'aria-hidden': 'true' }), fx = h('canvas', { class: 'ci-cv', 'aria-hidden': 'true' });
  var head = h('div', { class: 'ci-head', 'aria-live': 'polite' });
  var stage = h('div', { class: 'ci-stage', role: 'img', 'aria-label': 'Drawing area: draw a circle around the planet' }, bg, ink, fx, head);
  var root = h('div', { class: 'mg-root ci' },
    h('div', { class: 'mg-hud' }, pill('Best', bestEl), pill('Tries', triesEl), h('span', { class: 'mg-spacer' }), soundBtn), stage);
  document.getElementById('game').append(root);

  /* ---------- layout and the night sky ---------- */
  var W = 0, H = 0, cx = 0, cy = 0, pr = 30, bx, ix, fxx, unit = 1;
  function layout() {
    var r = stage.getBoundingClientRect();
    W = Math.max(200, Math.round(r.width)); H = Math.max(200, Math.round(r.height));
    cx = W / 2; cy = H * 0.56; unit = Math.min(W, H) / 400;
    pr = Math.max(16, Math.min(o.showcase ? 999 : 44, Math.min(W, H) * 0.065));
    bx = MG.fitCanvas(bg, W, H); ix = MG.fitCanvas(ink, W, H); fxx = MG.fitCanvas(fx, W, H);
    paintSky();
  }
  function paintSky() {
    var s = 11;
    function rnd() { s = (s * 16807) % 2147483647; return s / 2147483647; }
    var g = bx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#1A1446'); g.addColorStop(0.6, '#0F0C2E'); g.addColorStop(1, '#0A0820');
    bx.fillStyle = g; bx.fillRect(0, 0, W, H);
    [[0.15, 0.2, '#7A3CFF', 0.32], [0.88, 0.78, '#14B8C8', 0.24], [0.8, 0.12, '#FF4FA0', 0.16]].forEach(function (n) { // soft nebulae
      var rg = bx.createRadialGradient(W * n[0], H * n[1], 0, W * n[0], H * n[1], Math.max(W, H) * 0.55);
      rg.addColorStop(0, hexA(n[2], n[3])); rg.addColorStop(1, hexA(n[2], 0)); bx.fillStyle = rg; bx.fillRect(0, 0, W, H);
    });
    var count = Math.round(W * H / 2600);
    for (var i = 0; i < count; i++) {
      var x = rnd() * W, y = rnd() * H, big = rnd() < 0.06, a = 0.35 + rnd() * 0.65;
      bx.fillStyle = 'rgba(255,255,255,' + a + ')';
      bx.beginPath(); bx.arc(x, y, big ? 1.6 : 0.5 + rnd() * 0.8, 0, 6.2832); bx.fill();
      if (big) { bx.fillStyle = 'rgba(200,220,255,.18)'; bx.beginPath(); bx.arc(x, y, 5, 0, 6.2832); bx.fill(); }
    }
    // the planet
    var glow = bx.createRadialGradient(cx, cy, pr * 0.6, cx, cy, pr * 3);
    glow.addColorStop(0, 'rgba(120,170,255,.38)'); glow.addColorStop(1, 'rgba(120,170,255,0)');
    bx.fillStyle = glow; bx.beginPath(); bx.arc(cx, cy, pr * 3, 0, 6.2832); bx.fill();
    var body = bx.createRadialGradient(cx - pr * 0.4, cy - pr * 0.45, pr * 0.1, cx, cy, pr);
    body.addColorStop(0, '#B9F6FF'); body.addColorStop(0.45, '#58A6FF'); body.addColorStop(1, '#3B2FA8');
    bx.save(); bx.beginPath(); bx.arc(cx, cy, pr, 0, 6.2832); bx.fillStyle = body; bx.fill(); bx.clip();
    bx.fillStyle = 'rgba(255,255,255,.18)';
    bx.beginPath(); bx.ellipse(cx, cy - pr * 0.25, pr * 1.2, pr * 0.14, -0.2, 0, 6.2832); bx.fill();
    bx.beginPath(); bx.ellipse(cx, cy + pr * 0.3, pr * 1.2, pr * 0.1, -0.2, 0, 6.2832); bx.fill();
    bx.fillStyle = 'rgba(30,20,90,.25)'; bx.beginPath(); bx.arc(cx + pr * 0.35, cy + pr * 0.35, pr, 0, 6.2832); bx.fill();
    bx.restore();
    bx.strokeStyle = 'rgba(255,255,255,.08)'; bx.lineWidth = 1; bx.setLineDash([3, 7]); // faint guide marks: nothing to trace, just a hint of scale
    bx.beginPath(); bx.arc(cx, cy, pr * 1.9, 0, 6.2832); bx.stroke(); bx.setLineDash([]);
  }
  function hexA(hex, a) { var n = parseInt(hex.slice(1), 16); return 'rgba(' + (n >> 16) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')'; }

  /* ---------- drawing ---------- */
  var pts = [], drawing = false, swept = 0, lastAng = 0, sumR = 0, rect = null, orbitRaf = 0, last = null;
  function tint(err) { var hue = 160 - Math.min(1, err / 0.14) * 175; return 'hsl(' + Math.round((hue + 360) % 360) + ',95%,63%)'; }
  function seg(a, b, col) {
    ix.strokeStyle = col; ix.shadowColor = col; ix.shadowBlur = 12 * unit; ix.lineWidth = Math.max(3.5, 5 * unit); ix.lineCap = 'round';
    ix.beginPath(); ix.moveTo(a[0], a[1]); ix.lineTo(b[0], b[1]); ix.stroke();
  }
  function local(e) { return [e.clientX - rect.left, e.clientY - rect.top]; }
  function begin(p) {
    cancelAnimationFrame(orbitRaf); ix.clearRect(0, 0, W, H); fxx.clearRect(0, 0, W, H);
    pts = [p]; swept = 0; lastAng = Math.atan2(p[1] - cy, p[0] - cx); sumR = Math.hypot(p[0] - cx, p[1] - cy); drawing = true;
    head.className = 'ci-head is-live'; head.innerHTML = '';
    head.append(h('b', { class: 'ci-num', text: '100%' }), h('span', { text: 'Keep going all the way round' }));
    last = p;
  }
  function add(p) {
    var q = pts[pts.length - 1];
    if (Math.hypot(p[0] - q[0], p[1] - q[1]) < 2) return;
    var r = Math.hypot(p[0] - cx, p[1] - cy);
    if (r < pr + 3) { finish('crash'); return; }
    var a = Math.atan2(p[1] - cy, p[0] - cx), d = a - lastAng;
    if (d > Math.PI) d -= 2 * Math.PI; else if (d < -Math.PI) d += 2 * Math.PI;
    swept += d; lastAng = a; pts.push(p); sumR += r;
    var mean = sumR / pts.length;
    seg(q, p, tint(Math.abs(r - mean) / mean));
    if (pts.length % 4 === 0) { var st = stats(pts); head.firstChild.textContent = st ? fmt(score(st, 360)) : '100%'; }
    if (Math.abs(swept) >= 2 * Math.PI) finish('full');
  }
  function resample(list, step) { // even spacing along the line, so slow and fast parts count the same
    var out = [list[0]], carry = 0;
    for (var i = 1; i < list.length; i++) {
      var a = list[i - 1], b = list[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]), t = step - carry;
      while (t <= L) { out.push([a[0] + (b[0] - a[0]) * t / L, a[1] + (b[1] - a[1]) * t / L]); t += step; }
      carry = L - (t - step);
    }
    return out;
  }
  function stats(list) {
    var rs = resample(list, 3).map(function (p) { return Math.hypot(p[0] - cx, p[1] - cy); });
    if (rs.length < 8) return null;
    var R = rs.reduce(function (s, v) { return s + v; }, 0) / rs.length, v = 0;
    rs.forEach(function (r) { v += (r - R) * (r - R); });
    // subtract a 2px noise floor (finger jitter doesn't shrink on small circles, so raw RMS unfairly penalises them)
    return { R: R, dev: Math.sqrt(Math.max(0, v / rs.length - 4)) / R };
  }
  function score(st, deg) { return Math.max(0, Math.min(100, 100 * (1 - 4.5 * st.dev) - Math.max(0, 360 - deg) * 0.15)); }
  function fmt(s) { return (Math.floor(s * 10) / 10).toFixed(1) + '%'; }
  function rank(s) { var r = RANKS[0]; RANKS.forEach(function (x) { if (s >= x[0]) r = x; }); return r; }
  function words(s) {
    return s >= 97 ? 'Astonishing. Giotto would be proud!' : s >= 93 ? 'A superb orbit!' : s >= 88 ? 'Very round!' : s >= 80 ? 'Nice circle!'
      : s >= 70 ? 'Pretty round. Try a steadier speed.' : s >= 50 ? 'A bit wobbly. Draw from your elbow.' : 'That orbit is more of a potato!';
  }
  function fail(icon, title, text) {
    head.className = 'ci-head is-fail'; head.innerHTML = '';
    head.append(h('b', { class: 'ci-title', text: icon + ' ' + title }), h('span', { text: text }));
    MG.sfx.bad();
  }
  function finish(why) {
    if (!drawing) return;
    drawing = false;
    if (why === 'crash') { fail('💥', 'Crash!', 'You flew into the planet. Draw around it, not through it.'); return; }
    var deg = Math.abs(swept) * 180 / Math.PI;
    if (pts.length < 12) { ix.clearRect(0, 0, W, H); idle(); return; } // just a tap
    if (deg < 300) { fail('🔄', 'Keep going!', 'Draw all the way around the planet in one go.'); return; }
    var st = stats(pts);
    if (!st) { idle(); return; }
    if (st.R < pr * 2.2) { fail('🔍', 'Too small!', 'Give the planet more room: draw a bigger circle.'); return; }
    var s = Math.floor(score(st, deg) * 10) / 10, isBest = s > best, r = rank(s);
    tries++; MG.store.set('tries', tries);
    if (isBest) { best = s; MG.store.set('best', best); }
    // reveal the score FIRST — the repaint below is slow (shadowBlur per segment) and must not block the result
    head.className = 'ci-head is-done'; head.innerHTML = '';
    head.append(h('b', { class: 'ci-num', text: fmt(s) }),
      h('span', { class: 'ci-rank', text: r[1] + ' ' + r[2] + (isBest && tries > 1 ? ' · New best!' : '') }),
      h('span', { text: words(s) + ' ' + (touch ? 'Draw again to beat it.' : 'Draw again to beat it.') }));
    renderHud();
    // repaint the whole line, coloured by how far each part is from the perfect circle
    ix.clearRect(0, 0, W, H);
    for (var i = 1; i < pts.length; i++) { var rr = Math.hypot(pts[i][0] - cx, pts[i][1] - cy); seg(pts[i - 1], pts[i], tint(Math.abs(rr - st.R) / st.R)); }
    orbit(st.R);
    if (s >= 90) MG.sfx.win(); else if (s >= 70) MG.sfx.good(); else MG.tone(392, 0.18, 'triangle', 0.05);
    if (isBest && tries > 1) MG.confetti(s >= 90 ? 110 : 80); // any new best earns a celebration, bigger at the top band
    MG.event('game_over', { score: s });
  }
  function idle() {
    head.className = 'ci-head'; head.innerHTML = '';
    head.append(h('b', { class: 'ci-title', text: 'Draw a perfect circle around the planet' }),
      h('span', { text: touch ? 'One finger, all the way round, in one go' : 'Hold the mouse button and go all the way round' }));
  }

  /* ---------- the moon flies your orbit ---------- */
  function orbit(R) {
    var path = resample(pts.concat([pts[0]]), 2), n = path.length, t0 = performance.now(), period = 3200, laps = reduce ? 0 : 1;
    function moon(p, a) {
      fxx.globalAlpha = a;
      var g = fxx.createRadialGradient(p[0] - 3 * unit, p[1] - 3 * unit, 1, p[0], p[1], 10 * unit);
      g.addColorStop(0, '#FFFBE8'); g.addColorStop(1, '#D9C78E');
      fxx.fillStyle = g; fxx.beginPath(); fxx.arc(p[0], p[1], 9 * unit, 0, 6.2832); fxx.fill();
      fxx.fillStyle = 'rgba(150,130,80,.45)';
      fxx.beginPath(); fxx.arc(p[0] + 2.5 * unit, p[1] - 1.5 * unit, 2.2 * unit, 0, 6.2832); fxx.arc(p[0] - 3 * unit, p[1] + 3 * unit, 1.5 * unit, 0, 6.2832); fxx.fill();
      fxx.globalAlpha = 1;
    }
    function frame(now) {
      var k = Math.max(0, (now - t0) / period); // a frame can be stamped a moment before t0
      fxx.clearRect(0, 0, W, H);
      fxx.strokeStyle = 'rgba(255,255,255,.5)'; fxx.lineWidth = 1.5; fxx.setLineDash([6, 8]);
      fxx.beginPath(); fxx.arc(cx, cy, R, 0, 6.2832); fxx.stroke(); fxx.setLineDash([]);
      var at = Math.floor((k % 1) * n);
      if (k >= laps) at = 0;
      for (var j = 18; j >= 1; j--) { var q = path[(at - j * 3 + n * 4) % n]; fxx.fillStyle = 'rgba(255,240,200,' + (0.28 * (1 - j / 19)) + ')'; fxx.beginPath(); fxx.arc(q[0], q[1], 5 * unit * (1 - j / 22), 0, 6.2832); fxx.fill(); }
      moon(path[at], 1);
      if (k < laps) orbitRaf = requestAnimationFrame(frame);
    }
    cancelAnimationFrame(orbitRaf);
    if (laps) orbitRaf = requestAnimationFrame(frame); else frame(t0 + 1e9);
  }

  /* ---------- input ---------- */
  stage.addEventListener('pointerdown', function (e) {
    if (e.button > 0 || drawing) return;
    e.preventDefault();
    try { stage.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    rect = stage.getBoundingClientRect(); begin(local(e));
  });
  stage.addEventListener('pointermove', function (e) {
    if (!drawing) return;
    var list = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    if (!list.length) list = [e];
    for (var i = 0; i < list.length && drawing; i++) add(local(list[i]));
  });
  stage.addEventListener('pointerup', function () { finish('lift'); });
  stage.addEventListener('pointercancel', function () { if (drawing) { drawing = false; ix.clearRect(0, 0, W, H); idle(); } });
  soundBtn.addEventListener('click', function () { MG.sound.toggle(); renderSound(); });
  function renderSound() {
    soundBtn.innerHTML = MG.sound.muted
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z" fill="currentColor"/><path d="m16 9 6 6M22 9l-6 6"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z" fill="currentColor"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>';
    soundBtn.setAttribute('aria-label', MG.sound.muted ? 'Turn sound on' : 'Turn sound off');
  }
  function renderHud() { bestEl.textContent = best ? fmt(best) : '–'; triesEl.textContent = tries; }
  var resizeT = 0;
  window.addEventListener('resize', function () { clearTimeout(resizeT); resizeT = setTimeout(function () { if (drawing) return; cancelAnimationFrame(orbitRaf); layout(); idle(); }, 120); });
  MG.onPause(function () { cancelAnimationFrame(orbitRaf); });

  /* ---------- start ---------- */
  renderSound(); renderHud(); layout(); idle();
  if (o.showcase) { // still frame: a very round orbit with the moon on it
    root.classList.add('is-showcase');
    var R0 = Math.min(W, H) * 0.29, th0 = -0.75;
    rect = { left: 0, top: 0 };
    begin([cx + Math.cos(th0) * R0, cy + Math.sin(th0) * R0]);
    for (var k = 1; k <= 399; k++) {
      var th = th0 + k / 400 * 2 * Math.PI, rr = R0 * (1 + 0.008 * Math.sin(2 * th + 0.6) + 0.004 * Math.sin(3 * th) + (k > 370 ? (k - 370) * 0.0002 : 0));
      add([cx + Math.cos(th) * rr, cy + Math.sin(th) * rr]);
    }
    drawing = false;
    var stS = stats(pts), sS = Math.floor(score(stS, 360) * 10) / 10, rS = rank(sS);
    best = sS; tries = 7; renderHud();
    head.className = 'ci-head is-done'; head.innerHTML = '';
    head.append(h('b', { class: 'ci-num', text: fmt(sS) }), h('span', { class: 'ci-rank', text: rS[1] + ' ' + rS[2] + ' · New best!' }));
    reduce = true; orbit(stS.R);
    setTimeout(function () { document.documentElement.setAttribute('data-ready', '1'); }, 80);
  }
  MG.ready();
})();
