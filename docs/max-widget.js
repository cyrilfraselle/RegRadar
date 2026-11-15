/* ═══════════════════════════════════════════════════════════════
   Max: RegRadar's quiet assistant (the owner's parents' cat).

   First slice: animation and the chat panel SHELL only. No AI, no
   network calls beyond this file's own stylesheet. The answer engine
   plugs in later through ONE hook: window.RegMax.setAnswerer().

   Motion (a flat black silhouette, all original, no images):
   - Walk-in (first page view of a browser session): a skinned skeleton merged into one smooth
     shape (signed distance field, drawn on a canvas at the device pixel ratio). He walks in from
     beyond the right edge in a lateral-sequence walk with planted paws, slows, looks up, sits and
     curls into the round badge while the glass bubble inflates on a spring.
   - Idle bubble: breathing, glow drift, ear twitches and slow blinks at
     random 6-14 s, an occasional faint sparkle across the glass.
   - Pointer (fine pointers only): spring-damped 3D tilt, specular
     highlight and eyes that follow the pointer.
   - Hover perk, click hop then a spring panel from the bubble.
   - Everything pauses when the tab is hidden or the bubble is off-screen.
   - prefers-reduced-motion: static glass bubble fades in, nothing moves.
   - ?maxdemo=1 cycles every state, with slow motion and replay.

   Loaded by one line at the end of site-nav.js (and by index.html).
   docs/max-preview.html is generated from this file and max-widget.css
   by scripts/build-max-preview.mjs.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var MAX_ENABLED = true; // kill switch: false = Max never appears anywhere

  // Full-frame simulation pages: Max stays out of the way there.
  var EXCLUDE = ['workstation.html', 'desk.html', 'laundromat.html', 'ownership.html',
    'shift.html', 'triage.html', 'casefile.html', 'film-follow-the-money.html',
    'film-effort-follows-risk.html', 'film-know-who-know-why.html', 'film-look-through.html'];
  var PREVIEW = window.MAX_PREVIEW === true; // set by max-preview.html (CSS inlined there)
  var page = location.pathname.split('/').pop() || 'index.html';
  if (!MAX_ENABLED || (!PREVIEW && EXCLUDE.indexOf(page) !== -1) || window.__regMax) return;
  window.__regMax = true;

  var VERSION = '20261115a';
  var K_HIDDEN = 'regradar-max-hidden', K_GREETED = 'regradar-max-greeted';
  var params = new URLSearchParams(location.search);
  var DEMO = PREVIEW || params.get('maxdemo') === '1';
  var mq = function (q) { return !!(window.matchMedia && window.matchMedia(q).matches); };
  var reduced = mq('(prefers-reduced-motion: reduce)');
  var finePointer = mq('(hover: hover) and (pointer: fine)');
  function lget(s, k) { try { return s.getItem(k); } catch (e) { return null; } }
  function lset(s, k, v) { try { if (v == null) s.removeItem(k); else s.setItem(k, v); } catch (e) {} }

  /* ------------------------------------------------------------ the answer hook
     THE single place where an answer engine plugs in later. Until something
     calls RegMax.setAnswerer(fn), the input stays disabled and Max says chat
     is coming soon. Contract for fn(question, ctx) -> Promise:
       ctx.say(text)            add a message from Max (plain text)
       ctx.sayNode(node)        add a message from Max (DOM node)
       ctx.setState(name)       'idle' | 'think' | 'found' | 'unsure'
       ctx.page                 { file, open, celex, art } light page context
     Nothing in this file talks to a model or a network. */
  var ANSWER = null;

  /* ------------------------------------------------------------ small maths */
  var PI = Math.PI;
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function f1(n) { return Math.round(n * 100) / 100; }
  function rnd(a, b) { return a + Math.random() * (b - a); }

  /* ------------------------------------------------------------ the walking cat
     ONE continuous silhouette: a skeleton carries smooth primitives merged into a single signed
     distance field (smooth unions, so joints never show a seam). Rest pose fitted to the approved
     master; walk and arrival are pure functions of time, replayed by tests/max-motion.test.mjs. */
  /*@rig*/
  var RIG = (function () {
    var PI = Math.PI;
    function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  /* --- signed distance field: primitives, smooth union, tiled renderer --- */
  function sdCone(px, py, a) { // a = [ax, ay, r1, bx, by, r2]: tapered capsule (iq's uneven capsule)
    var dx = a[3] - a[0], dy = a[4] - a[1], h = Math.sqrt(dx * dx + dy * dy), r1 = a[2], r2 = a[5];
    var qx = px - a[0], qy = py - a[1];
    if (h < 1e-6 || Math.abs(r1 - r2) >= h) { var d1 = Math.sqrt(qx * qx + qy * qy) - r1, ex = px - a[3], ey = py - a[4], d2 = Math.sqrt(ex * ex + ey * ey) - r2; return d1 < d2 ? d1 : d2; }
    var ux = dx / h, uy = dy / h, x = Math.abs(qx * uy - qy * ux), y = qx * ux + qy * uy;
    var b = (r1 - r2) / h, c = Math.sqrt(1 - b * b), k = -b * x + c * y;
    if (k < 0) return Math.sqrt(x * x + y * y) - r1;
    if (k > c * h) return Math.sqrt(x * x + (y - h) * (y - h)) - r2;
    return x * c + y * b - r1;
  }
  function sdTri(px, py, a) { // a = [x0, y0, x1, y1, x2, y2, round]
    var e0x = a[2] - a[0], e0y = a[3] - a[1], e1x = a[4] - a[2], e1y = a[5] - a[3], e2x = a[0] - a[4], e2y = a[1] - a[5];
    var v0x = px - a[0], v0y = py - a[1], v1x = px - a[2], v1y = py - a[3], v2x = px - a[4], v2y = py - a[5];
    var t0 = clamp((v0x * e0x + v0y * e0y) / (e0x * e0x + e0y * e0y), 0, 1), t1 = clamp((v1x * e1x + v1y * e1y) / (e1x * e1x + e1y * e1y), 0, 1), t2 = clamp((v2x * e2x + v2y * e2y) / (e2x * e2x + e2y * e2y), 0, 1);
    var q0x = v0x - e0x * t0, q0y = v0y - e0y * t0, q1x = v1x - e1x * t1, q1y = v1y - e1y * t1, q2x = v2x - e2x * t2, q2y = v2y - e2y * t2;
    var s = e0x * e2y - e0y * e2x > 0 ? 1 : -1;
    var d = q0x * q0x + q0y * q0y, w = s * (v0x * e0y - v0y * e0x), dd = q1x * q1x + q1y * q1y, ww = s * (v1x * e1y - v1y * e1x);
    if (dd < d) d = dd; if (ww < w) w = ww;
    dd = q2x * q2x + q2y * q2y; ww = s * (v2x * e2y - v2y * e2x);
    if (dd < d) d = dd; if (ww < w) w = ww;
    return (w < 0 ? Math.sqrt(d) : -Math.sqrt(d)) - a[6];
  }
  function sdArc(px, py, a) { // a = [cx, cy, radius, start angle, sweep, half width]: a stroked arc with round caps
    var dx = px - a[0], dy = py - a[1], t = Math.atan2(dy, dx) - a[3], sw = a[4];
    if (sw < 0) { t = -t; sw = -sw; }
    t = ((t % (2 * PI)) + 2 * PI) % (2 * PI);
    if (t <= sw) return Math.abs(Math.sqrt(dx * dx + dy * dy) - a[2]) - a[5];
    var e = sw * (a[4] < 0 ? -1 : 1) + a[3], ax = a[0] + a[2] * Math.cos(a[3]) - px, ay = a[1] + a[2] * Math.sin(a[3]) - py, bx = a[0] + a[2] * Math.cos(e) - px, by = a[1] + a[2] * Math.sin(e) - py;
    return Math.sqrt(Math.min(ax * ax + ay * ay, bx * bx + by * by)) - a[5];
  }
  function sdPrim(p, x, y) { return p.t === 0 ? sdCone(x, y, p.a) : p.t === 1 ? sdTri(x, y, p.a) : sdArc(x, y, p.a); }
  function smin(a, b, k) { var m = a < b ? a : b, h = k - Math.abs(a - b); return h > 0 ? m - h * h * 0.25 / k : m; }
  // Layers: 0 = the near body (smooth union, in list order), 3 = the tail (its own smooth chain, then
  // melted into the body as one piece with radius P.kt), 1 = the far legs and far ear (cut back
  // by a thin gap where they pass behind the near body, as in the master), 2 = cut-outs (eyes, lines).
  function compose(P, d, idx, n, gap) {
    var near = 1e9, far = 1e9, cut = 1e9, tail = 1e9;
    for (var j = 0; j < n; j++) {
      var i = idx ? idx[j] : j, p = P[i], v = d[i];
      if (p.L === 0) near = smin(near, v, p.k); else if (p.L === 3) tail = smin(tail, v, p.k); else if (p.L === 1) far = smin(far, v, p.k); else if (v < cut) cut = v;
    }
    var r = tail < 1e9 ? smin(near, tail, P.kt) : near;
    if (far < 1e9) { var g = gap - r; r = Math.min(r, far > g ? far : g); }
    return -cut > r ? -cut : r;
  }
  function primBox(p) {
    var a = p.a, x0, y0, x1, y1;
    if (p.t === 0) { x0 = Math.min(a[0] - a[2], a[3] - a[5]); x1 = Math.max(a[0] + a[2], a[3] + a[5]); y0 = Math.min(a[1] - a[2], a[4] - a[5]); y1 = Math.max(a[1] + a[2], a[4] + a[5]); }
    else if (p.t === 1) { x0 = Math.min(a[0], a[2], a[4]) - a[6]; x1 = Math.max(a[0], a[2], a[4]) + a[6]; y0 = Math.min(a[1], a[3], a[5]) - a[6]; y1 = Math.max(a[1], a[3], a[5]) + a[6]; }
    else { x0 = a[0] - a[2] - a[5]; x1 = a[0] + a[2] + a[5]; y0 = a[1] - a[2] - a[5]; y1 = a[1] + a[2] + a[5]; }
    return [x0, y0, x1, y1];
  }
  /* Render the field into an 8-bit coverage buffer (W x H device pixels; world = o + (pixel + .5) / sc).
     Tiles of 8 px are classified from the field at their centre (the field is 1-Lipschitz), so only
     tiles on the outline are evaluated per pixel, and only with the primitives that can reach them. */
  var TS = 8, dBuf = [], cand = [];
  function render(P, gap, buf, W, H, ox, oy, sc) {
    var n = P.length, kmax = P.kt || 0, bx0 = 1e9, by0 = 1e9, bx1 = -1e9, by1 = -1e9, i, j;
    for (i = 0; i < n; i++) {
      if (P[i].k > kmax) kmax = P[i].k;
      if (P[i].L === 2) continue;
      var b = primBox(P[i]); if (b[0] < bx0) bx0 = b[0]; if (b[1] < by0) by0 = b[1]; if (b[2] > bx1) bx1 = b[2]; if (b[3] > by1) by1 = b[3];
    }
    var mg = kmax + 0.5; // smooth unions can swell the shape a little past its primitives
    var px0 = Math.max(0, Math.floor((bx0 - mg - ox) * sc)), py0 = Math.max(0, Math.floor((by0 - mg - oy) * sc));
    var px1 = Math.min(W, Math.ceil((bx1 + mg - ox) * sc)), py1 = Math.min(H, Math.ceil((by1 + mg - oy) * sc));
    if (px1 <= px0 || py1 <= py0) return null;
    var hd = TS / sc * 0.7072, aa = 0.5 / sc, thr = 3 * hd + 2 * kmax + (gap > 0 ? gap : 0) + 1, inv = 1 / sc;
    for (var ty = py0; ty < py1; ty += TS) for (var tx = px0; tx < px1; tx += TS) {
      var tw = Math.min(TS, px1 - tx), th = Math.min(TS, py1 - ty), cx = ox + (tx + tw / 2) * inv, cy = oy + (ty + th / 2) * inv;
      for (i = 0; i < n; i++) dBuf[i] = sdPrim(P[i], cx, cy);
      var dc = compose(P, dBuf, null, n, gap), x, y, o;
      if (dc > hd + aa) continue;
      if (dc < -hd - aa) { for (y = ty; y < ty + th; y++) { o = y * W; for (x = tx; x < tx + tw; x++) buf[o + x] = 255; } continue; }
      var m = 0;
      for (i = 0; i < n; i++) if (dBuf[i] < thr) cand[m++] = i;
      for (y = ty; y < ty + th; y++) {
        var wy = oy + (y + 0.5) * inv; o = y * W;
        for (x = tx; x < tx + tw; x++) {
          var wx = ox + (x + 0.5) * inv;
          for (j = 0; j < m; j++) dBuf[cand[j]] = sdPrim(P[cand[j]], wx, wy);
          var v = 0.5 - compose(P, dBuf, cand, m, gap) * sc;
          buf[o + x] = v <= 0 ? 0 : v >= 1 ? 255 : (v * 255 + 0.5) | 0;
        }
      }
    }
    return [px0, py0, px1, py1];
  }
  /* --- skeleton, fitted to the master: joints [x, y, r] in 1/16 master px, facing left. S spine, B belly,
     N neck, H skull, M muzzle, EN/EF ears (corners + rounding), L legs [near fore, far fore, far hind,
     near hind] x [shoulder/hip, elbow/stifle, wrist/hock, heel, toe], T tail. */
  var REST = {S:[[46.74,68.02,11],[58.62,68.6,10.5],[75.15,65.65,9.8],[86.77,66.15,10.16]],B:[62.19,68.25,9.2],N:[30.67,52.48,5.28],H:[26.05,51.15,6.85],M:[[21.1,54.28,4.3],[18.83,54.45,2.6]],EN:[27.13,47.85,28.38,40.53,33.55,48.33,1.68],EF:[23.15,44.48,22.25,39.95,26.15,43.2,0.6],L:[[[40.75,71.74,7.15],[38.58,81.72,3.85],[28.4,96.3,2.05],[24.3,100.9,1.9],[21,101.4,1.9]],[[49.35,71.85,7.15],[53.1,82.85,3.3],[57.1,97.55,1.9],[56.4,101.15,1.9],[53.52,101.78,1.8]],[[78.1,71.98,6.6],[80.93,81.83,4.9],[85.25,92.35,2.6],[78.35,100.8,1.65],[74,101.35,1.8]],[[88.23,70.03,9.4],[94.27,81,4.8],[104.9,88.75,2.5],[108.2,100.05,1.85],[105.7,102.2,2]]],T:[[97.77,58.4,2.8],[100.74,54.75,2.4],[102.8,50.71,2.37],[103.21,46.26,2.34],[101.89,41.71,2.31],[99.98,37.37,2.27],[98.93,33.42,2.24],[99.3,30.02,2.21],[100.84,27.66,2.18],[102.99,26.41,2.15],[105.38,26.27,2.11],[107.64,27.2,2.08],[109.69,28.79,2.05]]};
  var GROUND = 103.5;
  // Smooth-union radii: how softly each part melts into what is drawn before it.
  var K = { s: 0.6, b: 2.5, n: 3, h: 2.2, m: 1.6, e: 0.9, l: [3, 1.4, 1.1, 0.9], t0: 2.6, t: 0.5 };
  function cone(a, b, k, L) { return { t: 0, L: L, k: k, a: [a[0], a[1], a[2], b[0], b[1], b[2]] }; }
  function build(J, o) {
    o = o || {};
    var P = [], i, s = J.S;
    for (i = 0; i < 3; i++) P.push(cone(s[i], s[i + 1], K.s, 0));
    P.push(cone(J.B, J.B, K.b, 0));
    P.push(cone(J.N, s[0], K.n, 0));
    P.push(cone(J.H, J.H, K.h, 0));
    P.push(cone(J.M[0], J.M[1], K.m, 0));
    P.push({ t: 1, L: 0, k: K.e, a: J.EN.slice() });
    function leg(l, L) { for (var j = 0; j < 4; j++) P.push(cone(l[j], l[j + 1], j === 0 && L === 1 ? 0 : K.l[j], L)); }
    leg(J.L[0], 0); leg(J.L[3], 0);
    var T = J.T, prev = T[0];
    for (i = 0; i < 12; i++) for (var u = 1; u <= 3; u++) { // Catmull-Rom through the tail joints: a smooth tube, no beads
      var a = T[i ? i - 1 : 0], b = T[i], c = T[i + 1], d = T[i < 11 ? i + 2 : 12], t = u / 3, t2 = t * t, t3 = t2 * t, q = [0, 0, 0];
      for (var e = 0; e < 3; e++) q[e] = 0.5 * (2 * b[e] + (c[e] - a[e]) * t + (2 * a[e] - 5 * b[e] + 4 * c[e] - d[e]) * t2 + (3 * b[e] - a[e] - 3 * c[e] + d[e]) * t3);
      P.push(cone(prev, q, K.t, 3)); prev = q;
    }
    leg(J.L[1], 1); leg(J.L[2], 1);
    P.push({ t: 1, L: 1, k: 0, a: J.EF.slice() });
    if (o.cuts) P = P.concat(o.cuts);
    P.kt = o.kt || K.t0;
    return P;
  }
  /* --- motion: everything below is a pure function of time t (seconds) and a plan, so the walk is
     evaluated continuously (no stepped frames) and the test can replay it exactly. */
  function sm(t) { t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); }
  function lp(a, b, t) { return a + (b - a) * t; }
  function rot(v, a) { var c = Math.cos(a), s = Math.sin(a); return [v[0] * c - v[1] * s, v[0] * s + v[1] * c]; }
  function len(x, y) { return Math.sqrt(x * x + y * y); }
  // Gait: lateral-sequence walk (near hind, near fore, far hind, far fore), each paw on the ground 62% of the cycle.
  var DUTY = 0.62, OFF = [0.25, 0.75, 0.5, 0], LS = 23, DC = LS / DUTY, VW = 46, TSW = 0.42, MINR = 3;
  var PSI = [[-0.04, -0.8, -1.3], [0.1, -0.45, -0.95]]; // paw angle at contact, at heel peel, in mid swing (fore, hind)
  // Leg mechanics come from the near legs (the far legs of the master are caught mid-swing), placed at each leg's own shoulder or hip.
  var LEG = REST.L.map(function (l0, i) {
    var l = REST.L[i < 2 ? 0 : 3], top = l[0], mid = l[1], low = l[2], toe = l[4], tx = low[0] - top[0], ty = low[1] - top[1], mx = mid[0] - top[0], my = mid[1] - top[1];
    return { a: len(mx, my), b: len(low[0] - mid[0], low[1] - mid[1]), s: mx * ty - my * tx > 0 ? -1 : 1, vA: [low[0] - toe[0], low[1] - toe[1]],
      vH: [l[3][0] - toe[0], l[3][1] - toe[1]], y: GROUND - toe[2], c: l0[0][0] + (i < 2 ? -8 : 6.5), h: i < 2 ? 3.6 : 3.1, ps: PSI[i < 2 ? 0 : 1] };
  });
  // Tail: rest segment lengths and absolute angles, so the chain can bend joint by joint.
  var TL = [], TA = [];
  for (var ti = 0; ti < 12; ti++) { var A0 = REST.T[ti], A1 = REST.T[ti + 1]; TL.push(len(A1[0] - A0[0], A1[1] - A0[1])); TA.push(Math.atan2(A1[1] - A0[1], A1[0] - A0[0])); }

  /* Speed profile: segments {t0, t1, v0, v1} joined by cosine ramps; X(t) is the body offset from the rest pose. */
  function timeline(segs, X0) {
    var last = segs[segs.length - 1], vEnd = last.v1, tStop = vEnd ? Infinity : last.t1;
    function seg(t, f) {
      if (t <= segs[0].t0) return f === 0 ? segs[0].v0 : f === 1 ? segs[0].v0 * (t - segs[0].t0) : 0;
      var d = 0;
      for (var i = 0; i < segs.length; i++) {
        var s = segs[i], T = s.t1 - s.t0, u = Math.min(t, s.t1) - s.t0, dv = s.v1 - s.v0;
        if (t <= s.t1) {
          if (f === 0) return s.v0 + dv * (1 - Math.cos(PI * u / T)) / 2;
          if (f === 2) return dv * PI / (2 * T) * Math.sin(PI * u / T);
          return d + s.v0 * u + dv * (u / 2 - T / (2 * PI) * Math.sin(PI * u / T));
        }
        d += s.v0 * T + dv * T / 2;
      }
      return f === 0 ? vEnd : f === 1 ? d + vEnd * (t - last.t1) : 0;
    }
    var tl = { v: function (t) { return seg(t, 0); }, dist: function (t) { return seg(t, 1); }, acc: function (t) { return seg(t, 2); },
      X: function (t) { return t === Infinity ? tl.Xend : X0 - seg(t, 1); }, tStop: tStop, segs: segs, X0: X0 };
    tl.Xend = vEnd ? -Infinity : X0 - seg(last.t1, 1);
    tl.tAt = function (dd) { // inverse of dist (Infinity if he stops before covering dd)
      var lo = segs[0].t0 - 30, hi;
      if (vEnd) hi = last.t1 + Math.max(0, dd - seg(last.t1, 1)) / vEnd + 1; else { if (dd >= seg(last.t1, 1) - 1e-9) return Infinity; hi = last.t1; }
      for (var k = 0; k < 48; k++) { var m = (lo + hi) / 2; if (seg(m, 1) < dd) lo = m; else hi = m; }
      return (lo + hi) / 2;
    };
    return tl;
  }
  /* Footstep plan: every paw is planted at a fixed world x for its whole stance (so it cannot slide),
     centred on the distance the body covers until that paw lifts again. Lift-offs follow the gait phase;
     swings are shortened when he slows down, and no new step starts in the last few units. */
  function plan(tl, phi0, prev, ta) {
    var legs = LEG.map(function (L, i) {
      var u0 = phi0 + OFF[i], n = Math.floor(u0) - 1, ev = [], old = prev && prev.legs[i];
      function Tu(u) { return tl.tAt((u - u0) * DC); }
      while (ev.length < 90) {
        var j = ev.length, ld = Tu(n), lo = Tu(n + DUTY), pv = ev[j - 1];
        if (pv) ld = Math.min(ld, pv.lo + TSW);
        if (lo < Infinity && tl.X(lo) - tl.Xend < MINR) lo = Infinity;
        var Xa = tl.X(ld), e = { ld: ld, lo: lo, x: Xa + L.c - (Xa - tl.X(lo)) / 2 };
        if (old && old[j]) { var o = old[j]; if (o.ld <= ta || (j && old[j - 1].lo <= ta)) { e.ld = o.ld; e.x = o.x; } if (o.lo <= ta) e.lo = o.lo; }
        ev.push(e);
        if (e.lo === Infinity) break;
        n++;
      }
      return ev;
    });
    return { tl: tl, phi0: phi0, legs: legs };
  }
  function stPsi(ps, p) { return ps[0] * (1 - sm(p / 0.5)) + ps[1] * sm((p - 0.5) / 0.5); }
  function swPsi(ps, s) { return s < 0.4 ? lp(ps[1], ps[2], sm(s / 0.4)) : lp(ps[2], ps[0], sm((s - 0.4) / 0.6)); }
  // Paw state at time t: toe position (world) and paw angle.
  function paw(pl, i, t) {
    var L = LEG[i], ev = pl.legs[i], tl = pl.tl, j = 0;
    while (j + 1 < ev.length && ev[j + 1].ld <= t) j++;
    var e = ev[j];
    if (t < e.lo || j + 1 >= ev.length) {
      var Xa = tl.X(e.ld), Xb = tl.X(e.lo), p = Xa - Xb > 1e-6 ? (Xa - tl.X(Math.max(t, e.ld))) / (Xa - Xb) : 0.5;
      return { x: e.x, y: L.y, psi: stPsi(L.ps, Math.min(1, p)), st: 1 };
    }
    var nx = ev[j + 1], s = clamp((t - e.lo) / (nx.ld - e.lo), 0, 1), k = Math.min(1, Math.abs(nx.x - e.x) / (0.8 * DC));
    return { x: lp(e.x, nx.x, sm(s)), y: L.y - L.h * k * Math.sin(PI * Math.pow(s, 0.8)), psi: swPsi(L.ps, s), st: 0 };
  }
  function ik(top, a, b, t, s) {
    var dx = t[0] - top[0], dy = t[1] - top[1], d = clamp(len(dx, dy), Math.abs(a - b) + 1e-3, a + b - 1e-3);
    var ph = Math.atan2(dy, dx) + s * Math.acos(clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1));
    return [top[0] + a * Math.cos(ph), top[1] + a * Math.sin(ph)];
  }
  function cp(j) { return j.slice(); }
  function mv(j, dx, dy) { return [j[0] + dx, j[1] + dy, j[2]]; }
  function rotAbout(j, c, a) { var v = rot([j[0] - c[0], j[1] - c[1]], a); return [c[0] + v[0], c[1] + v[1], j[2]]; }
  // the far legs walk slimmer than the master's caught-mid-swing far legs, so they never read as lumps under the belly
  var FAR = [0, [[5, 0, 4.4], [0, 0, 3.1], [0, 0, 1.9], [0, 0, 1.85], [0, 0, 1.8]], [[0, 0, 4.6], [0, 0, 3.6], [0, 0, 2.3], [0, 0, 1.7], [0, 0, 1.8]], 0];
  FAR.forEach(function (f, i) { if (f) f.forEach(function (j, k) { j[0] = REST.L[i][k][0]; j[1] = REST.L[i][k][1]; }); });
  var LOOK = 0.45, CURL = 1.3; // after he stops: looks up, then curls for CURL seconds

  /* The walking pose at time t (world joints). */
  function walk(pl, t) {
    var tl = pl.tl, X = tl.X(t), q = clamp(tl.v(t) / VW, 0, 1.2), ph = pl.phi0 + tl.dist(t) / DC, R = REST;
    var uF = ph + OFF[0], uH = ph + OFF[3], c4 = Math.cos(4 * PI * (uF - 0.12));
    var yF = 0.55 * q * c4, yR = 0.55 * q * Math.cos(4 * PI * (uH - 0.12)), sq = 0.012 * q * (0.5 + 0.5 * c4);
    var ts = tl.tStop, tau = t - ts, look = ts < Infinity ? sm((tau + 0.3) / 0.6) : 0;
    if (tau > 0) { var bump = Math.pow(Math.sin(PI * clamp(tau / 0.5, 0, 1)), 2) * 0.5; yF += bump * 0.6; yR += bump; } // weight settles after the stop
    function Y(j) { return [j[0], GROUND - (GROUND - j[1]) * (1 - sq), j[2]]; } // slight squash on footfalls, about the ground
    var J = { S: [], L: [], T: [] }, i;
    for (i = 0; i < 4; i++) J.S.push(Y(mv(R.S[i], X, lp(yF, yR, i / 3) + 0.22 * q * Math.sin(4 * PI * ph + i))));
    J.B = Y(mv(R.B, X, (yF + yR) / 2));
    // head: steadier than the body, counter-rotates the pitch, nods slightly, looks up at the end
    var N = Y(mv(R.N, X, yF * 0.75)), pitch = (yR - yF) / 40, hr = -0.6 * pitch - 0.025 * q * Math.sin(4 * PI * (uF - 0.3)) + 0.05 * q - 0.24 * look;
    var hy = yF * 0.45 - 2 * look, piv = R.N;
    function head(j) { var r = rotAbout(j, piv, hr); return Y([r[0] + X, r[1] + hy, r[2]]); }
    J.N = N; J.H = head(R.H); J.M = [head(R.M[0]), head(R.M[1])];
    var er = -0.06 * q * Math.sin(4 * PI * (uF - 0.25)) + 0.08 * look;
    function ear(e, lag) {
      var bx = (e[0] + e[4]) / 2, by = (e[1] + e[5]) / 2, tip = rotAbout([e[2], e[3], 0], [bx, by], er * lag), a = head([e[0], e[1], 0]), b = head(tip), c = head([e[4], e[5], 0]);
      return [a[0], a[1], b[0], b[1], c[0], c[1], e[6]];
    }
    J.EN = ear(R.EN, 1); J.EF = ear(R.EF, 1.3);
    for (i = 0; i < 4; i++) {
      var L = LEG[i], P = paw(pl, i, t), rl = FAR[i] || R.L[i], fy = i < 2 ? yF : yR;
      var top = Y(mv(rl[0], X + 0.1 * clamp(P.x - X - L.c, -14, 14), fy)), toe = [P.x, P.y, rl[4][2]];
      var vA = rot(L.vA, P.psi), vH = rot(L.vH, P.psi), low = [toe[0] + vA[0], toe[1] + vA[1], rl[2][2]];
      var m = ik(top, L.a, L.b, low, L.s);
      J.L.push([top, [m[0], m[1], rl[1][2]], low, [toe[0] + vH[0], toe[1] + vH[1], rl[3][2]], toe]);
    }
    // tail: phase-lagged sway (overlapping action), a lagged reaction to speed changes, follow-through after the stop
    var acc = 0, base = Y(mv(R.T[0], X, yR)), ang = 0;
    J.T.push(base);
    for (i = 0; i < 12; i++) {
      var lag = i * 0.045, d = q * 0.045 * Math.sin(2 * PI * ph - 0.5 * i) + 0.02 * q * Math.cos(4 * PI * uH - 0.5 * i) + 0.0009 * tl.acc(t - lag);
      if (tau > lag) { var u = tau - lag; d -= 0.05 * Math.exp(-u / 0.45) * Math.sin(2 * PI * u / 0.9) * sm(u / 0.12); }
      ang += d; acc = TA[i] + ang;
      var pr = J.T[i]; J.T.push([pr[0] + TL[i] * Math.cos(acc), pr[1] + TL[i] * Math.sin(acc), R.T[i + 1][2]]);
    }
    return J;
  }
  /* --- arrival: from the same skeleton he sits, then curls into the round badge (badge units, 40 x 40). */
  var BC = [20, 22], BR = 14.6, EARS = [[215, 18.8], [248, 19.2]], EW = 15;
  var SIT = {
    S: [[48, 63.5, 11], [59, 70, 10.5], [70, 79, 9.8], [80.5, 89.5, 10.16]], B: [64, 76, 9.2], N: [31, 47.5, 4.68], H: [26.5, 45.5, 6.85],
    M: [[22, 48.2, 4.3], [19.6, 48.6, 2.6]], EN: [26.6, 41.6, 28.2, 34.2, 36.5, 44, 1], EF: [23.4, 39.2, 22.6, 34.4, 26.5, 37.7, 0.6],
    L: [[[45, 70, 7.15], [44, 83, 3.85], [41.5, 96.4, 2.05], [41, 100.9, 1.9], [37.6, 101.4, 1.9]],
      [[51, 70, 7.15], [50.5, 83, 3.3], [48.5, 96.8, 1.9], [48, 101.2, 1.9], [44.8, 101.7, 1.8]],
      [[79, 88, 6.6], [68.5, 95, 4.9], [84, 100.6, 2.6], [80.5, 101.5, 1.65], [71.5, 101.8, 1.8]],
      [[81, 88, 9.4], [70, 94.5, 4.8], [88, 100.4, 2.5], [84.5, 101.4, 1.85], [74, 101.9, 2]]],
    T: [[88, 92, 2.8], [92, 95.5, 2.4], [95.5, 98.5, 2.37], [99.5, 100.3, 2.3], [103.5, 100.9, 2.27], [107.5, 101, 2.24], [111.5, 100.9, 2.21],
      [115.4, 100.8, 2.18], [119.3, 100.6, 2.15], [123, 100.1, 2.12], [126.5, 99.2, 2.09], [129.6, 97.8, 2.07], [132, 95.8, 2.05]]
  };
  function bpol(deg, r) { var a = deg * PI / 180; return [BC[0] + r * Math.cos(a), BC[1] + r * Math.sin(a)]; }
  // The badge ear (straight sides, quadratic tip) as a rounded triangle: inner triangle + rounding radius.
  function bear(e) {
    var a = bpol(e[0] - EW, BR - 1.5), b = bpol(e[0], e[1] + 1.4), c = bpol(e[0] + EW, BR - 1.5);
    var ap = [0.25 * lp(a[0], b[0], 0.62) + 0.5 * b[0] + 0.25 * lp(c[0], b[0], 0.62), 0.25 * lp(a[1], b[1], 0.62) + 0.5 * b[1] + 0.25 * lp(c[1], b[1], 0.62)];
    var ux = a[0] - b[0], uy = a[1] - b[1], vx = c[0] - b[0], vy = c[1] - b[1], h = Math.acos((ux * vx + uy * vy) / len(ux, uy) / len(vx, vy)) / 2;
    var gap = len(b[0] - ap[0], b[1] - ap[1]), r = gap / (1 / Math.sin(h) - 1), mx = (a[0] + c[0]) / 2, my = (a[1] + c[1]) / 2, dl = len(b[0] - mx, b[1] - my);
    var tip = [b[0] - (b[0] - mx) / dl * r / Math.sin(h), b[1] - (b[1] - my) / dl * r / Math.sin(h)];
    function inset(p) { return [p[0] + (mx - p[0]) * 0.2, p[1] + (my - p[1]) * 0.2]; }
    var A = inset(a), C = inset(c);
    return [A[0], A[1], tip[0], tip[1], C[0], C[1], r];
  }
  var BEARS = [bear(EARS[1]), bear(EARS[0])]; // near ear -> the upper badge ear, far ear -> the left one
  function curlPose(A) {
    function w(u, v, r) { return [A.x + (u - BC[0]) * A.s, A.y + (v - BC[1]) * A.s, r * A.s]; }
    function pw(deg, rad, r) { var p = bpol(deg, rad); return w(p[0], p[1], r); }
    function ew(e) { var a = w(e[0], e[1], e[6]), b = w(e[2], e[3], 0), c = w(e[4], e[5], 0); return [a[0], a[1], b[0], b[1], c[0], c[1], a[2]]; }
    var J = { S: [pw(215, 6, 7.5), pw(305, 6, 7.5), pw(35, 6, 7.5), pw(125, 6, 7.5)], B: w(20, 22, 14), N: w(17, 18.5, 4), H: w(15.5, 17.5, 5.5),
      M: [w(15.5, 20.5, 3.5), w(17, 23, 2)], EN: ew(BEARS[0]), EF: ew(BEARS[1]), L: [], T: [] };
    [[12.5, 25], [14.5, 27], [25, 27.5], [23.5, 29]].forEach(function (c) {
      J.L.push([w(c[0] + 1, c[1] - 2, 3.4), w(c[0], c[1], 3), w(c[0] - 1, c[1] + 1, 2.5), w(c[0] - 1.5, c[1] + 1.5, 2.2), w(c[0] - 2, c[1] + 1.5, 2)]);
    });
    J.T.push(pw(300, 8.5, 2.8));
    for (var i = 1; i < 13; i++) J.T.push(pw(325 + (i - 1) * 16.5, 12.1, 1.85 - 0.02 * i));
    return J;
  }
  // The badge's white lines (tucked head, tail wrapping to the chin, tail tip) and eyes, as cut-outs.
  function badgeCuts(A, wl, we) {
    var s = A.s, hw = 0.675 * s * wl, out = [];
    function w(u, v) { return [A.x + (u - BC[0]) * s, A.y + (v - BC[1]) * s]; }
    function arc(c, r, a0, sw) { var p = w(c[0], c[1]); out.push({ t: 2, L: 2, k: 0, a: [p[0], p[1], r * s, a0, sw, hw] }); }
    function seg(a, b, r) { var p = w(a[0], a[1]), q = w(b[0], b[1]); out.push({ t: 0, L: 2, k: 0, a: [p[0], p[1], r, q[0], q[1], r] }); }
    if (wl > 0) {
      arc([18.748, 20.982], 7.8, -1.054, -2.43);
      arc([19.35, 20.9], 10.691, -0.487, 3.142);
      seg([9.9, 25.9], [7.775, 26.075], hw); seg([7.775, 26.075], [6.4, 25.2], hw);
    }
    if (we > 0) { seg([13.7, 18.6], [13.7, 18.6], 1.6 * s * we); seg([17.3, 15.4], [17.3, 15.4], 1.6 * s * we); }
    return out;
  }
  // Flatten a pose to numbers (same order every time) with a motion group per number.
  function flat(J) { var o = []; (function f(v) { if (Array.isArray(v)) v.forEach(f); else o.push(v); })([J.S, J.B, J.N, J.H, J.M, J.EN, J.EF, J.L, J.T]); return o; }
  function unflat(a) { var i = 0; function c(v) { return Array.isArray(v) ? v.map(c) : a[i++]; } var r = c([REST.S, REST.B, REST.N, REST.H, REST.M, REST.EN, REST.EF, REST.L, REST.T]);
    return { S: r[0], B: r[1], N: r[2], H: r[3], M: r[4], EN: r[5], EF: r[6], L: r[7], T: r[8] }; }
  // group windows inside the curl (start, end): spine, head, ears, fore legs, hind legs, tail
  var GW = [[0, 0.8], [0.04, 0.86], [0.04, 0.86], [0, 0.7], [0, 0.66], [0, 0.9]];
  var GRP = (function () {
    var g = [], n = function (k, v) { for (var i = 0; i < v; i++) g.push(k); };
    n(0, 12 + 3); n(1, 3 + 3 + 6); n(2, 14); n(3, 30); n(4, 30); n(0, 3); n(5, 36);
    return g;
  })();
  // number kind per flat index: 0 = x, 1 = y, 2 = radius (or ear rounding)
  var KIND = (function () { var o = {}; function mark(v) { return typeof v[0] === 'number' ? (v.length === 3 ? [0, 1, 2] : [0, 1, 0, 1, 0, 1, 2]) : v.map(mark); }
    for (var k in REST) o[k] = mark(REST[k]); return flat(o); })();
  function herm(p0, p1, m0, m1, u) { var u2 = u * u, u3 = u2 * u; return (2 * u3 - 3 * u2 + 1) * p0 + (u3 - 2 * u2 + u) * m0 + (-2 * u3 + 3 * u2) * p1 + (u3 - u2) * m1; }
  function wrap(x, ref) { while (x - ref > PI) x -= 2 * PI; while (x - ref < -PI) x += 2 * PI; return x; }
  // tail as base angle + bend at each joint, and segment lengths
  function tang(T) { var a = [], l = [], p = 0; for (var i = 0; i < 12; i++) { var d = Math.atan2(T[i + 1][1] - T[i][1], T[i + 1][0] - T[i][0]); a.push(i ? wrap(d - p, 0) : d); p = d; l.push(len(T[i + 1][0] - T[i][0], T[i + 1][1] - T[i][1])); } return [a, l]; }
  var S0 = 1.5; // the curl is shaped at this size around the sitting cat, then glides and shrinks into the bubble
  /* Everything the renderer needs at time t: primitives, the far-part gap, curl progress. */
  function frame(pl, t) {
    var J = walk(pl, t), tl = pl.tl, A = pl.arrive, c = A && tl.tStop < Infinity ? (t - tl.tStop - LOOK) / CURL : -1, gap = 0.8, cuts;
    if (c > 0) {
      c = Math.min(c, 1);
      var px = SIT.B[0] + tl.Xend, py = SIT.B[1], e = sm((c - 0.3) / 0.7), g = lp(1, A.s / S0, e), dx = (A.x - px) * e, dy = (A.y - py) * e;
      var Cp = curlPose({ x: px, y: py, s: S0 }), a = flat(J), s1 = flat(SIT), s2 = flat(Cp), out = [], Jw = J;
      for (var i = 0; i < a.length; i++) {
        var gw = GW[GRP[i]], s = clamp((c - gw[0]) / (gw[1] - gw[0]), 0, 1), k = KIND[i], b = s1[i] + (k === 0 ? tl.Xend : 0), m = GRP[i] === 5 ? 0 : 0.5 * (s2[i] - a[i]);
        var v = s < 0.5 ? herm(a[i], b, 0, m, 2 * s) : herm(b, s2[i], m, 0, 2 * s - 1);
        out.push(k === 2 ? v * g : k === 0 ? px + dx + (v - px) * g : py + dy + (v - py) * g);
      }
      J = unflat(out);
      // the tail moves joint by joint (angles, not positions, so it never cuts through his body): it swings
      // down behind him, rests a beat along the ground, then wraps round under him into the curl
      var ts = clamp((c - GW[5][0]) / (GW[5][1] - GW[5][0]), 0, 1), K0 = tang(Jw.T), K1 = tang(SIT.T), K2 = tang(Cp.T), acc = 0;
      for (i = 0; i < 12; i++) {
        var r1 = wrap(K1[0][i], K0[0][i]), u = ts < 0.5 ? 2 * ts : 2 * ts - 1;
        acc += ts < 0.5 ? herm(K0[0][i], r1, 0, 0, u) : herm(r1, wrap(K2[0][i], r1), 0, 0, u);
        var ln = (ts < 0.5 ? herm(K0[1][i], K1[1][i], 0, 0, u) : herm(K1[1][i], K2[1][i], 0, 0, u)) * g, pr = J.T[i];
        J.T[i + 1] = [pr[0] + ln * Math.cos(acc), pr[1] + ln * Math.sin(acc), J.T[i + 1][2]];
      }
      gap = 0.8 * (1 - sm((c - 0.5) / 0.4));
      cuts = badgeCuts({ x: px + dx, y: py + dy, s: S0 * g }, sm((c - 0.8) / 0.2), sm((c - 0.84) / 0.16));
    }
    return { P: build(J, { cuts: cuts, kt: c > 0 ? 2.6 + 4.4 * sm(c / 0.3) : 0 }), gap: gap, c: c };
  }
  /* --- scenes: the walk-in (he enters from beyond the right edge and stops) and the demo walk in place. */
  function scene(W, H, S, inPlace) {
    var cx = 111.5 - (W - 70) / S, cy = GROUND - (H - 6) / S, sc = { S: S, W: W, H: H, cx: cx, cy: cy, follow: !!inPlace }, tl;
    if (inPlace) tl = timeline([{ t0: 0, t1: 1, v0: VW, v1: VW }], 0);
    else {
      var v0 = 0.55 * VW, Ta = 0.6, Td = 1.5, da = Ta * (v0 + VW) / 2, dd = VW * Td / 2;
      var X0 = Math.max(cx + W / S - 14, da + dd), Tc = (X0 - da - dd) / VW;
      tl = timeline([{ t0: 0, t1: Ta, v0: v0, v1: VW }, { t0: Ta, t1: Ta + Tc, v0: VW, v1: VW }, { t0: Ta + Tc, t1: Ta + Tc + Td, v0: VW, v1: 0 }], X0);
    }
    sc.pl = plan(tl, 0.3);
    return sc;
  }
  function cam(sc, t) { return [sc.follow ? sc.cx + sc.pl.tl.X(t) : sc.cx, sc.cy]; }
  function stopAt(sc, ta) { // demo: ease out of the walk in place from time ta (paws already down stay down)
    var old = sc.pl, tl = timeline([{ t0: 0, t1: ta, v0: VW, v1: VW }, { t0: ta, t1: ta + 0.9, v0: VW, v1: 0 }], 0);
    sc.pl = plan(tl, old.phi0, old, ta); sc.pl.arrive = old.arrive;
  }
  function setBadge(sc, px, py) { // badge centre (20, 22) in canvas CSS px, once he has stopped
    var c = cam(sc, sc.pl.tl.tStop);
    sc.pl.arrive = { x: c[0] + px / sc.S, y: c[1] + py / sc.S, s: 0.9 / sc.S };
  }
  function draw(sc, t, buf, W, H, dpr) {
    var f = frame(sc.pl, t), c = cam(sc, t);
    return { box: render(f.P, f.gap, buf, W, H, c[0], c[1], sc.S * dpr), c: f.c };
  }
  return { REST: REST, GROUND: GROUND, build: build, render: render, frame: frame, walk: walk, paw: paw, timeline: timeline, plan: plan,
    scene: scene, cam: cam, stopAt: stopAt, setBadge: setBadge, draw: draw, LEG: LEG, DC: DC, VW: VW, LOOK: LOOK, CURL: CURL,
    BC: BC, BR: BR, EARS: EARS, EW: EW };
})();
  /*@rig-end*/

  /* ------------------------------------------------------------ badge geometry
     A curled cat seen from above: a disc with two ears at the upper left.
     The same polar outline r(θ) drives the static badge and the morph
     target, so the morph lands exactly on the badge. Badge units: 40 x 40. */
  var BC = RIG.BC, BR = RIG.BR, EARS = RIG.EARS, EW = RIG.EW;
  function polar(deg, r) { var a = deg * PI / 180; return [BC[0] + r * Math.cos(a), BC[1] + r * Math.sin(a)]; }
  function earTri(e) {
    // a soft, rounded ear: straight-ish sides, round tip
    var a = polar(e[0] - EW, BR - 1.5), b = polar(e[0], e[1] + 1.4), c = polar(e[0] + EW, BR - 1.5);
    var p = [lerp(a[0], b[0], 0.62), lerp(a[1], b[1], 0.62)], q = [lerp(c[0], b[0], 0.62), lerp(c[1], b[1], 0.62)];
    return 'M' + f1(a[0]) + ' ' + f1(a[1]) + 'L' + f1(p[0]) + ' ' + f1(p[1]) + 'Q' + f1(b[0]) + ' ' + f1(b[1]) + ' ' + f1(q[0]) + ' ' + f1(q[1]) + 'L' + f1(c[0]) + ' ' + f1(c[1]) + 'Z';
  }
  function earBase(e) { return polar(e[0], BR - 1); }
  function badge(id) {
    var b1 = earBase(EARS[0]), b2 = earBase(EARS[1]);
    return '<svg viewBox="0 0 40 40" aria-hidden="true" focusable="false">' +
      '<defs><mask id="' + id + '" maskUnits="userSpaceOnUse" x="-4" y="-4" width="48" height="48">' +
        '<rect x="-4" y="-4" width="48" height="48" fill="#fff"/>' +
        '<g fill="none" stroke="#000" stroke-width="1.35" stroke-linecap="round">' +
          '<path d="M22.6 14.2 A7.8 7.8 0 0 1 11.4 23.6"/>' +                 // tucked head
          '<path d="M28.8 15.9 A10.6 10.6 0 1 1 9.9 25.9"/>' +                // tail wrapping round to the chin
          '<path d="M9.9 25.9 Q7.4 26.6 6.4 25.2"/>' +                        // rounded tail tip
        '</g></mask></defs>' +
      '<g class="mx-cg" mask="url(#' + id + ')" fill="currentColor">' +
        '<circle cx="20" cy="22" r="14"/>' +
        '<path class="mx-ear" style="transform-origin:' + f1(b1[0]) + 'px ' + f1(b1[1]) + 'px" d="' + earTri(EARS[0]) + '"/>' +
        '<path class="mx-ear mx-ear2" style="transform-origin:' + f1(b2[0]) + 'px ' + f1(b2[1]) + 'px" d="' + earTri(EARS[1]) + '"/>' +
      '</g>' +
      '<g class="mx-eyes"><circle cx="13.7" cy="18.6" r="1.6"/><circle cx="17.3" cy="15.4" r="1.6"/></g>' +
      '</svg>';
  }

  /* ------------------------------------------------------------ helpers */
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function button(cls, text, label) {
    var b = el('button', 'mx-b ' + (cls || ''), text);
    b.type = 'button';
    if (label) b.setAttribute('aria-label', label);
    return b;
  }
  function anim(node, frames, opts) { if (!node || !node.animate || reduced) return null; var a = node.animate(frames, opts); a.playbackRate = rate; return a; }
  // Light page context, ready for the answer hook (obligation, article or tool).
  function pageContext() {
    return { file: page, open: params.get('open') || '', celex: page === 'law.html' ? (params.get('celex') || '') : '',
      art: page === 'law.html' ? (params.get('art') || '') : '' };
  }

  /* ------------------------------------------------------------ theme */
  function isDark() {
    var t = document.documentElement.getAttribute('data-theme');
    if (t) return t === 'dark';
    var m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/.exec(getComputedStyle(document.body).backgroundColor || '');
    if (!m || m[4] === '0') return mq('(prefers-color-scheme: dark)');
    return (0.2126 * m[1] + 0.7152 * m[2] + 0.0722 * m[3]) / 255 < 0.45;
  }

  /* ------------------------------------------------------------ build */
  var root, btn, orb, tilt, glass, badgeEl, walker, rig, caption, panel, log, input, send, closeB, demoBar;
  var state = 'idle', revertTimer = null, appeared = false, paused = false, rate = 1, alive = false;

  // States for later wiring: 'idle' | 'think' | 'found' | 'unsure' ('sit' kept as an alias of idle).
  function setState(s) {
    if (s === 'sit') s = 'idle';
    state = s;
    if (!btn) return;
    btn.classList.remove('mx-thinking', 'mx-found', 'mx-unsure');
    if (s === 'think') btn.classList.add('mx-thinking');
    if (s === 'found') { void btn.offsetWidth; btn.classList.add('mx-found');
      anim(btn.querySelector('.mx-glow2'), [{ opacity: 0, transform: 'scale(.8)' }, { opacity: 0.95, transform: 'scale(1.1)', offset: 0.18 }, { opacity: 0, transform: 'scale(1.35)' }], { duration: 700, easing: 'ease-out' }); }
    if (s === 'unsure') btn.classList.add('mx-unsure');
    clearTimeout(revertTimer);
    if ((s === 'found' || s === 'unsure') && !DEMO) revertTimer = setTimeout(function () { setState('idle'); }, 3000);
    applyRate();
  }

  function build() {
    root = el('div');
    root.id = 'max-root';
    root.setAttribute('data-no-glossary', '');
    root.classList.toggle('mx-dark', isDark());
    root.classList.toggle('mx-rm', reduced);

    btn = el('button', 'mx-btn');
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Talk to Max');
    btn.setAttribute('aria-haspopup', 'dialog');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', 'max-panel');
    btn.innerHTML = '<span class="mx-tilt" aria-hidden="true"><span class="mx-orb">' +
      '<span class="mx-glow"></span><span class="mx-glow2"></span>' +
      '<span class="mx-glass"><span class="mx-spec"></span><span class="mx-sheen"></span></span>' +
      '<span class="mx-badge">' + badge('mx-mask-b') + '</span>' +
      '</span></span><span class="mx-tip" aria-hidden="true">Talk to Max</span>';
    tilt = btn.querySelector('.mx-tilt'); orb = btn.querySelector('.mx-orb'); glass = btn.querySelector('.mx-glass'); badgeEl = btn.querySelector('.mx-badge');
    btn.addEventListener('click', function () { if (panel && !panel.hidden) closePanel(); else openPanel(); });
    root.appendChild(btn);
    document.body.appendChild(root);

    new MutationObserver(function () { root.classList.toggle('mx-dark', isDark()); })
      .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    watchObstacles();
    watchVisibility();
    if (finePointer && !reduced) watchPointer();
  }

  /* ------------------------------------------------------------ pause when unseen */
  function setPaused(p) {
    if (p === paused || !root) return;
    paused = p;
    root.classList.toggle('mx-paused', p);
    if (p) stopIdle(); else { if (alive) startIdle(); kick(); }
  }
  function watchVisibility() {
    var onScreen = true;
    document.addEventListener('visibilitychange', function () { setPaused(document.hidden || !onScreen); });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) { onScreen = es[es.length - 1].isIntersecting; setPaused(document.hidden || !onScreen); })
        .observe(btn);
    }
    if (document.hidden) setPaused(true);
  }

  /* ------------------------------------------------------------ the frame loop
     One rAF loop for the walk-in, the morph and the pointer springs. It only
     runs while something is moving, and never while paused. */
  var tasks = [], rafId = 0, lastT = 0;
  function kick() { if (!rafId && !paused && tasks.length) { lastT = 0; rafId = requestAnimationFrame(frame); } }
  function addTask(fn) { tasks.push(fn); kick(); }
  function frame(now) {
    rafId = 0;
    if (paused) return;
    var dt = lastT ? Math.min((now - lastT) / 1000, 1 / 30) : 1 / 60; lastT = now;
    dt *= rate;
    var cur = tasks; tasks = [];
    var keep = cur.filter(function (fn) { return fn(dt) !== false; });
    tasks = keep.concat(tasks); // keep tasks added during this frame
    if (tasks.length) rafId = requestAnimationFrame(frame);
  }

  /* ------------------------------------------------------------ appear */
  function appear() {
    if (appeared) return;
    appeared = true;
    build();
    if (DEMO) { startDemo(); return; }
    var greet = !lget(sessionStorage, K_GREETED);
    if (!greet || reduced) {
      if (greet) lset(sessionStorage, K_GREETED, '1');
      showBubble(false);
      if (greet) showCaption();
      return;
    }
    setTimeout(function () {
      lset(sessionStorage, K_GREETED, '1');
      walkIn({ onDone: showCaption });
    }, 2500);
  }

  /* The walker is one canvas along the bottom right. Every frame the skeleton is posed at time t and its
     merged field is rendered at the device pixel ratio, only over the cat's own box. */
  var WK_H = 150, WK_S = 1.3, CAT_RGB = [11, 11, 13];
  function makeWalker() {
    removeWalker();
    walker = el('div', 'mx-walker');
    walker.setAttribute('aria-hidden', 'true');
    var w = Math.min(360, window.innerWidth || 360), dpr = Math.min(2, window.devicePixelRatio || 1), cv = el('canvas');
    walker.style.width = w + 'px';
    cv.width = Math.round(w * dpr); cv.height = Math.round(WK_H * dpr);
    walker.appendChild(cv);
    root.insertBefore(walker, btn);
    var ctx = cv.getContext('2d');
    rig = { w: w, dpr: dpr, cv: cv, ctx: ctx, img: ctx ? ctx.createImageData(cv.width, cv.height) : null, buf: new Uint8Array(cv.width * cv.height), box: null };
    return rig;
  }
  function removeWalker() { if (walker && walker.parentNode) walker.parentNode.removeChild(walker); walker = null; rig = null; }
  function paint(R, sc, t) {
    if (!R.img) return 1;
    var W = R.cv.width, H = R.cv.height, buf = R.buf, d = R.img.data, old = R.box, x, y, i;
    if (old) for (y = old[1]; y < old[3]; y++) for (x = old[0], i = y * W + x; x < old[2]; x++, i++) { buf[i] = 0; d[i * 4 + 3] = 0; }
    var f = RIG.draw(sc, t, buf, W, H, R.dpr), b = f.box;
    if (b) for (y = b[1]; y < b[3]; y++) for (x = b[0], i = y * W + x; x < b[2]; x++, i++) { var o = i * 4; d[o] = CAT_RGB[0]; d[o + 1] = CAT_RGB[1]; d[o + 2] = CAT_RGB[2]; d[o + 3] = buf[i]; }
    var u = old && b ? [Math.min(old[0], b[0]), Math.min(old[1], b[1]), Math.max(old[2], b[2]), Math.max(old[3], b[3])] : (b || old);
    if (u) R.ctx.putImageData(R.img, 0, 0, u[0], u[1], u[2] - u[0], u[3] - u[1]);
    R.box = b;
    return f.c;
  }
  // Where the badge centre will be, in walker canvas px (the bubble's centre does not move with its scale).
  function badgeSpot(R) {
    var wr = walker.getBoundingClientRect(), br = btn.getBoundingClientRect();
    return [br.left + br.width / 2 - wr.left, br.top + br.height / 2 - wr.top + 1.8];
  }

  /* Walk in from beyond the right edge (or on the spot in the demo), slow down, look up, sit and curl
     into the bubble. opts: { inPlace, onDone }. Returns { arrive } for the demo. */
  function walkIn(opts) {
    opts = opts || {};
    var R = makeWalker(), sc = RIG.scene(R.w, WK_H, WK_S, !!opts.inPlace), t = 0, inflated = false;
    btn.classList.remove('mx-on', 'mx-alive'); btn.classList.add('mx-forming');
    stopIdle();
    function place() { var p = badgeSpot(R); RIG.setBadge(sc, p[0], p[1]); }
    if (!opts.inPlace) place();
    function step(dt) {
      if (rig !== R) return false;
      t += dt;
      var c = paint(R, sc, t);
      if (c >= 0.5 && !inflated) { inflated = true; btn.classList.add('mx-on'); inflate(); }
      if (c >= 1) { btn.classList.remove('mx-forming'); removeWalker(); finishArrival(); if (opts.onDone) opts.onDone(); return false; }
      return true;
    }
    paint(R, sc, 0);
    addTask(step);
    return { arrive: function () { if (opts.inPlace && sc.pl.tl.tStop === Infinity) { RIG.stopAt(sc, t); place(); } } };
  }
  // The glass bubble inflates on a spring with a soft halo burst.
  function inflate() {
    btn.classList.add('mx-on');
    anim(glass, [{ transform: 'scale(.15)', opacity: 0 }, { transform: 'scale(1.12)', opacity: 1, offset: 0.45 },
      { transform: 'scale(.96)', offset: 0.7 }, { transform: 'scale(1.015)', offset: 0.86 }, { transform: 'scale(1)', opacity: 1 }],
      { duration: 760, delay: 120, fill: 'backwards', easing: 'cubic-bezier(.25,.7,.3,1)' });
    anim(btn.querySelector('.mx-glow2'), [{ opacity: 0, transform: 'scale(.6)' }, { opacity: 0.85, transform: 'scale(1.15)', offset: 0.35 }, { opacity: 0, transform: 'scale(1.5)' }],
      { duration: 900, delay: 200, fill: 'backwards', easing: 'ease-out' });
  }
  function finishArrival() { // the walker's last frame is the badge itself (eyes open), so nothing pops
    btn.classList.remove('mx-forming');
    becomeAlive();
  }
  function showBubble(animated) {
    btn.classList.remove('mx-forming');
    requestAnimationFrame(function () { if (btn) { btn.classList.add('mx-on'); if (animated) inflate(); becomeAlive(); } });
  }
  function becomeAlive() { alive = true; btn.classList.add('mx-alive'); if (!paused) startIdle(); }

  function showCaption() {
    if (!btn || (panel && !panel.hidden)) return;
    caption = el('span', 'mx-cap', 'Hi, I am Max.');
    caption.setAttribute('aria-hidden', 'true');
    btn.appendChild(caption);
    requestAnimationFrame(function () { requestAnimationFrame(function () { if (caption) caption.classList.add('mx-show'); }); });
    setTimeout(removeCaption, 6000);
  }
  function removeCaption() {
    if (!caption) return;
    var c = caption; caption = null;
    c.classList.remove('mx-show');
    setTimeout(function () { if (c.parentNode) c.parentNode.removeChild(c); }, 900);
  }

  /* ------------------------------------------------------------ idle life
     Irregular, low-amplitude events so nothing loops obviously. */
  var idleTimers = [];
  function later(fn, a, b) { idleTimers.push(setTimeout(fn, rnd(a, b) * 1000 / rate)); }
  function startIdle() {
    stopIdle();
    if (reduced || !btn) return;
    (function blink() { later(function () {
      anim(btn.querySelector('.mx-eyes'), [{ transform: 'scaleY(1)' }, { transform: 'scaleY(.08)', offset: 0.45 }, { transform: 'scaleY(1)' }],
        { duration: 300, easing: 'ease-in-out' });
      if (Math.random() < 0.18) setTimeout(function () { anim(btn && btn.querySelector('.mx-eyes'), [{ transform: 'scaleY(1)' }, { transform: 'scaleY(.08)', offset: 0.45 }, { transform: 'scaleY(1)' }], { duration: 260 }); }, 380);
      blink(); }, 6, 14); })();
    (function twitch() { later(function () {
      var ears = btn.querySelectorAll('.mx-ear'), e = ears[Math.random() < 0.5 ? 0 : 1], s = Math.random() < 0.5 ? -1 : 1;
      anim(e, [{ transform: 'rotate(0)' }, { transform: 'rotate(' + 9 * s + 'deg)', offset: 0.25 }, { transform: 'rotate(' + -4 * s + 'deg)', offset: 0.55 }, { transform: 'rotate(0)' }],
        { duration: 420, easing: 'ease-out' });
      twitch(); }, 4, 11); })();
    (function sparkle() { later(function () {
      anim(btn.querySelector('.mx-sheen'), [{ transform: 'translateX(-70%) rotate(20deg)', opacity: 0 }, { opacity: 0.55, offset: 0.4 }, { transform: 'translateX(70%) rotate(20deg)', opacity: 0 }],
        { duration: 1400, easing: 'ease-in-out' });
      sparkle(); }, 9, 20); })();
  }
  function stopIdle() { idleTimers.forEach(clearTimeout); idleTimers = []; }

  /* ------------------------------------------------------------ pointer: 3D tilt, specular, eyes */
  var ptr = { tx: 0, ty: 0, rx: 0, ry: 0, vx: 0, vy: 0, ex: 0, ey: 0, active: false, last: 0 };
  function watchPointer() {
    document.addEventListener('pointermove', function (ev) {
      if (ev.pointerType && ev.pointerType !== 'mouse' && ev.pointerType !== 'pen') return;
      if (!btn || !btn.classList.contains('mx-alive')) return;
      var r = btn.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      var dx = ev.clientX - cx, dy = ev.clientY - cy, d = Math.sqrt(dx * dx + dy * dy) || 1, near = clamp(1 - d / 520, 0, 1);
      var reach = Math.min(1, d / 90);
      ptr.tx = clamp(-dy / d * 8 * reach * (0.25 + 0.75 * near), -8, 8); // rotateX
      ptr.ty = clamp(dx / d * 8 * reach * (0.25 + 0.75 * near), -8, 8);  // rotateY
      ptr.ex = dx / d * Math.min(1, d / 60); ptr.ey = dy / d * Math.min(1, d / 60);
      ptr.last = performance.now();
      if (!ptr.active) { ptr.active = true; addTask(pointerStep); }
    }, { passive: true });
    document.addEventListener('pointerleave', function () { ptr.tx = ptr.ty = ptr.ex = ptr.ey = 0; }, { passive: true });
  }
  function pointerStep(dt) {
    if (!btn) { ptr.active = false; return false; }
    if (performance.now() - ptr.last > 2500) { ptr.tx = ptr.ty = 0; ptr.ex *= 0.98; ptr.ey *= 0.98; }
    ptr.vx += (170 * (ptr.tx - ptr.rx) - 16 * ptr.vx) * dt; ptr.vy += (170 * (ptr.ty - ptr.ry) - 16 * ptr.vy) * dt;
    ptr.rx += ptr.vx * dt; ptr.ry += ptr.vy * dt;
    tilt.style.transform = 'perspective(260px) rotateX(' + f1(ptr.rx) + 'deg) rotateY(' + f1(ptr.ry) + 'deg)';
    glass.style.setProperty('--sx', f1(50 + ptr.ry * 3.2) + '%'); glass.style.setProperty('--sy', f1(40 - ptr.rx * 3.2) + '%');
    var eyes = btn.querySelector('.mx-eyes');
    eyes.style.translate = f1(ptr.ex * 0.85) + 'px ' + f1(ptr.ey * 0.85) + 'px';
    var settled = Math.abs(ptr.vx) + Math.abs(ptr.vy) < 0.02 && Math.abs(ptr.tx - ptr.rx) + Math.abs(ptr.ty - ptr.ry) < 0.02;
    if (settled && performance.now() - ptr.last > 600) { ptr.active = false; return false; }
    return true;
  }

  /* ------------------------------------------------------------ panel */
  function buildPanel() {
    panel = el('div', 'mxp');
    panel.id = 'max-panel';
    panel.hidden = true;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', 'mxp-title');

    var h = el('div', 'mxp-h');
    var av = el('div', 'mxp-av'); av.innerHTML = badge('mx-mask-a'); h.appendChild(av);
    var h2 = el('h2', '', 'Max'); h2.id = 'mxp-title'; h.appendChild(h2);
    var hideB = button('', 'Hide Max', 'Hide Max on this device');
    hideB.addEventListener('click', hideMax);
    closeB = button('mx-x', '×', 'Close chat');
    closeB.addEventListener('click', closePanel);
    h.appendChild(hideB); h.appendChild(closeB);
    panel.appendChild(h);

    log = el('div', 'mxp-log');
    log.setAttribute('role', 'log');
    log.setAttribute('aria-live', 'polite');
    log.setAttribute('aria-label', 'Conversation with Max');
    panel.appendChild(log);

    var f = el('form', 'mxp-f');
    f.setAttribute('autocomplete', 'off');
    var row = el('div', 'mxp-in');
    var lab = el('label', 'mx-vh', 'Your message for Max'); lab.htmlFor = 'mxp-q';
    input = el('textarea'); input.id = 'mxp-q'; input.rows = 1;
    send = el('button', 'mx-b mx-pri', 'Send'); send.type = 'submit';
    row.appendChild(lab); row.appendChild(input); row.appendChild(send);
    f.appendChild(row);
    var legal = el('div', 'mxp-legal');
    legal.appendChild(el('span', '', 'Prototype. Not legal advice.'));
    var a = el('a', '', 'Search the law'); a.href = 'ask.html';
    legal.appendChild(a);
    f.appendChild(legal);
    f.addEventListener('submit', function (e) { e.preventDefault(); submit(); });
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } });
    panel.appendChild(f);

    panel.addEventListener('keydown', trapKeys);
    root.appendChild(panel);
    say('Max is still learning to talk. Chat is coming soon.');
    syncInput();
  }

  function syncInput() {
    var on = typeof ANSWER === 'function';
    input.disabled = !on; send.disabled = !on;
    input.placeholder = on ? 'Message Max' : 'Coming soon';
  }

  function say(text) { var m = el('div', 'mxp-m mxp-max'); m.appendChild(el('p', '', text)); return addMsg(m); }
  function sayNode(node) { var m = el('div', 'mxp-m mxp-max'); m.appendChild(node); return addMsg(m); }
  function addMsg(m) { log.appendChild(m); log.scrollTop = log.scrollHeight; return m; }

  function submit() {
    var q = input.value.trim();
    if (!q || typeof ANSWER !== 'function') return;
    addMsg(el('div', 'mxp-m mxp-you', q));
    input.value = '';
    setState('think');
    Promise.resolve().then(function () {
      return ANSWER(q, { say: say, sayNode: sayNode, setState: setState, page: pageContext() });
    }).catch(function () {
      say('Something went wrong on my side. Please try again.'); setState('unsure');
    }).then(function () { if (state === 'think') setState('idle'); });
  }

  function focusables() {
    return [].slice.call(panel.querySelectorAll('button,a[href],textarea,input,[tabindex]:not([tabindex="-1"])'))
      .filter(function (n) { return !n.disabled && n.offsetParent !== null; });
  }
  function trapKeys(e) {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closePanel(); return; }
    if (e.key !== 'Tab') return;
    var f = focusables(); if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  function onDocFocus(e) { if (panel && !panel.hidden && !panel.contains(e.target)) { var f = focusables(); if (f.length) f[0].focus(); } }

  function hop() {
    anim(orb, [{ transform: 'translateY(0) scale(1,1)' }, { transform: 'translateY(1px) scale(1.09,.9)', offset: 0.16 },
      { transform: 'translateY(-9px) scale(.94,1.07)', offset: 0.46 }, { transform: 'translateY(0) scale(1.07,.92)', offset: 0.74 },
      { transform: 'translateY(0) scale(.99,1.01)', offset: 0.88 }, { transform: 'translateY(0) scale(1,1)' }],
      { duration: 460, easing: 'cubic-bezier(.3,.6,.4,1)' });
  }
  var panelAnim = null;
  function originForPanel() {
    return mq('(max-width:560px)') ? 'calc(100% - 42px) calc(100% - 42px)' : 'calc(100% - 26px) calc(100% + 38px)';
  }
  function openPanel() {
    removeCaption();
    if (!panel) buildPanel();
    hop();
    panel.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    document.addEventListener('focusin', onDocFocus);
    (input.disabled ? closeB : input).focus();
    if (panelAnim) panelAnim.cancel();
    panel.style.transformOrigin = originForPanel();
    panelAnim = anim(panel, [{ transform: 'scale(.12)', opacity: 0 }, { transform: 'scale(1.02)', opacity: 1, offset: 0.68 }, { transform: 'scale(1)', opacity: 1 }],
      { duration: 440, easing: 'cubic-bezier(.2,.85,.25,1)', delay: 90, fill: 'backwards' });
    var parts = [panel.querySelector('.mxp-h')].concat([].slice.call(log.children), [panel.querySelector('.mxp-f')]);
    parts.forEach(function (n, i) {
      anim(n, [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }],
        { duration: 280, delay: 220 + i * 55, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' });
    });
  }
  function closePanel() {
    if (!panel || panel.hidden) return;
    btn.setAttribute('aria-expanded', 'false');
    document.removeEventListener('focusin', onDocFocus);
    btn.focus();
    if (panelAnim) panelAnim.cancel();
    panel.style.transformOrigin = originForPanel();
    var a = anim(panel, [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(.12)', opacity: 0 }], { duration: 220, easing: 'cubic-bezier(.5,0,.75,0)' });
    if (a) a.onfinish = function () { if (btn && btn.getAttribute('aria-expanded') === 'false') panel.hidden = true; };
    else panel.hidden = true;
  }

  /* ------------------------------------------------------------ hide / bring back */
  function hideMax() {
    lset(localStorage, K_HIDDEN, '1');
    document.removeEventListener('focusin', onDocFocus);
    stopDemo(); stopIdle(); tasks = [];
    if (root && root.parentNode) root.parentNode.removeChild(root);
    root = btn = panel = walker = rig = caption = null;
    appeared = false; alive = false;
    var back = footerLink();
    var note = el('div', 'mx-vh'); note.setAttribute('role', 'status'); document.body.appendChild(note);
    setTimeout(function () { note.textContent = 'Max is hidden on this device. Use “Bring Max back” in the page footer to see him again.'; }, 60);
    setTimeout(function () { if (note.parentNode) note.parentNode.removeChild(note); }, 6000);
    if (back) { back.setAttribute('tabindex', '-1'); back.focus({ preventScroll: true }); back.removeAttribute('tabindex'); }
  }

  function footerLink() {
    if (document.getElementById('mx-back')) return document.getElementById('mx-back');
    var foot = document.querySelector('footer.rrf p') || document.querySelector('body > footer p') || document.querySelector('body > footer');
    if (!foot) { foot = el('p'); foot.style.textAlign = 'center'; document.body.appendChild(foot); }
    var wrap = el('span'); wrap.id = 'mx-back-wrap';
    wrap.appendChild(document.createTextNode(' '));
    var b = el('button', 'mx-back', 'Bring Max back'); b.type = 'button'; b.id = 'mx-back';
    b.addEventListener('click', function () {
      lset(localStorage, K_HIDDEN, null);
      wrap.parentNode.removeChild(wrap);
      lset(sessionStorage, K_GREETED, '1'); // back means the bubble only, no walk-in or caption
      appear();
      btn.focus();
    });
    wrap.appendChild(b);
    foot.appendChild(wrap);
    return b;
  }

  /* ------------------------------------------------------------ keep out of the way
     Lift Max above anything fixed or sticky at the bottom that he would
     cover: the landing page's floating CTA, sticky action bars, or anything
     marked data-max-avoid. Modal dialogs and drawers sit above him (z-index 90). */
  var AVOID = '#cta.show,.minibar,[data-max-avoid]';
  var lifting = false;
  function updateLift() {
    lifting = false;
    if (!root) return;
    var vw = window.innerWidth, vh = window.innerHeight, base = 16, size = 52;
    var left = vw - 16 - size - 12, top = vh - base - size - 10, lift = 0;
    [].forEach.call(document.querySelectorAll(AVOID), function (n) {
      if (root.contains(n)) return;
      var r = n.getBoundingClientRect();
      if (!r.width || !r.height || r.bottom <= top || r.top >= vh || r.right <= left || r.left >= vw) return;
      lift = Math.max(lift, vh - r.top + 8 - base);
    });
    root.style.setProperty('--mx-lift', Math.round(lift) + 'px');
  }
  function queueLift() { if (!lifting) { lifting = true; requestAnimationFrame(updateLift); } }
  function watchObstacles() {
    window.addEventListener('scroll', queueLift, { passive: true });
    window.addEventListener('resize', queueLift);
    var cta = document.getElementById('cta');
    if (cta) new MutationObserver(function () { queueLift(); setTimeout(queueLift, 650); })
      .observe(cta, { attributes: true, attributeFilter: ['class'] });
    updateLift();
  }

  /* ------------------------------------------------------------ demo (?maxdemo=1 or max-preview.html only) */
  var demoTimer = null, demoLabel = null, demoI = 0;
  function applyRate() {
    if (!root || !root.getAnimations) return;
    root.getAnimations({ subtree: true }).forEach(function (a) { a.playbackRate = rate; });
  }
  var walkCtl = null;
  var STEPS = [
    ['Walking', 4.2, function () { btn.classList.remove('mx-tip-on'); setState('idle'); walkCtl = walkIn({ inPlace: true }); }],
    ['Arriving: slows, looks up, crouches, curls into the bubble', 3.4, function () { if (walkCtl) walkCtl.arrive(); walkCtl = null; }],
    ['Idle: breathing, blinks, ear twitches', 5, function () { setState('idle'); }],
    ['Hover: ears perk, halo brightens, tooltip', 3.4, function () { btn.classList.add('mx-tip-on'); }],
    ['Thinking: soft halo pulse and shimmer', 4.4, function () { btn.classList.remove('mx-tip-on'); setState('think'); }],
    ['Found a source: white flash, ears perk', 3.2, function () { setState('found'); }],
    ['Not sure: head tilt', 3.4, function () { setState('unsure'); }]
  ];
  function startDemo() {
    demoBar = el('div', 'mxp-demo');
    demoLabel = el('span', 'mxp-demo-l'); demoLabel.setAttribute('role', 'status');
    var slow = button('', 'Slow motion'); slow.setAttribute('aria-pressed', 'false');
    slow.addEventListener('click', function () {
      rate = rate === 1 ? 0.25 : 1; slow.setAttribute('aria-pressed', rate === 1 ? 'false' : 'true'); applyRate();
      clearTimeout(demoTimer); demoTimer = setTimeout(next, STEPS[(demoI + STEPS.length - 1) % STEPS.length][1] * 1000 / rate);
    });
    var replay = button('', 'Replay walk-in');
    replay.addEventListener('click', function () {
      clearTimeout(demoTimer); walkCtl = null; setState('idle'); btn.classList.remove('mx-tip-on');
      walkIn({ onDone: function () { demoI = 2; demoTimer = setTimeout(next, 2500 / rate); } });
      demoLabel.textContent = 'Replay: walk-in from the edge, look up, crouch, curl';
    });
    demoBar.appendChild(demoLabel); demoBar.appendChild(slow); demoBar.appendChild(replay);
    root.insertBefore(demoBar, btn);
    if (reduced) { showBubble(false); demoLabel.textContent = 'Reduced motion is on: Max stays still.'; return; }
    next();
  }
  function next() {
    if (!root) return;
    var s = STEPS[demoI];
    demoLabel.textContent = 'Max demo: ' + s[0];
    s[2]();
    demoI = (demoI + 1) % STEPS.length;
    demoTimer = setTimeout(next, s[1] * 1000 / rate);
    setTimeout(applyRate, 30);
  }
  function stopDemo() { clearTimeout(demoTimer); }

  /* ------------------------------------------------------------ public API (for the later engine) */
  window.RegMax = {
    setAnswerer: function (fn) { ANSWER = typeof fn === 'function' ? fn : null; if (panel) syncInput(); },
    setState: setState,
    open: function () { if (root) openPanel(); }
  };

  /* ------------------------------------------------------------ start
     Appear once the stylesheet is in place: on load, immediately if it is
     already loaded (cached or inlined), and with one silent retry if the
     first load fails. Without styles Max would render as a bare button,
     so after a second failure he stays away rather than break the page. */
  function go() {
    if (lget(localStorage, K_HIDDEN) === '1' && !DEMO) footerLink();
    else appear();
  }
  function loadCss(attempt) {
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'max-widget.css?v=' + VERSION + (attempt ? '&r=' + attempt : '');
    link.setAttribute('data-max-css', '');
    link.onload = go;
    link.onerror = function () { link.parentNode && link.parentNode.removeChild(link); if (!attempt) setTimeout(function () { loadCss(1); }, 1500); };
    document.head.appendChild(link);
    if (link.sheet) { try { if (link.sheet.cssRules) go(); } catch (e) {} }
  }
  function start() {
    if (PREVIEW || document.getElementById('max-widget-css')) { go(); return; }
    var have = document.querySelector('link[data-max-css]');
    if (have && have.sheet) { go(); return; }
    loadCss(0);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(start, 0); });
  else setTimeout(start, 0);
})();
