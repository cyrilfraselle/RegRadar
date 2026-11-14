/* ═══════════════════════════════════════════════════════════════
   Max: RegRadar's quiet assistant (the owner's parents' cat).

   First slice: animation and the chat panel SHELL only. No AI, no
   network calls beyond this file's own stylesheet. The answer engine
   plugs in later through ONE hook: window.RegMax.setAnswerer().

   Motion (pictogram, flat silhouette, all original SVG):
   - Walk-in (first page view of a browser session): a procedural walk
     cycle. Feet are planted on the ground (no sliding) and the legs are
     solved with two-bone IK in a lateral-sequence walk (hind, fore,
     hind, fore). Body bob and spine flex, head counter-motion, spring
     ears and a spring-chain tail that lags and whips, contact shadows
     that pulse on each footfall, far legs lighter for depth, a rim
     light along the back. He eases in, slows, looks up, crouches, then
     his outline MORPHS point by point (96 matched points) into the
     curled badge while the glass bubble inflates on a spring.
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
    'shift.html', 'triage.html', 'casefile.html', 'film-follow-the-money.html'];
  var PREVIEW = window.MAX_PREVIEW === true; // set by max-preview.html (CSS inlined there)
  var page = location.pathname.split('/').pop() || 'index.html';
  if (!MAX_ENABLED || (!PREVIEW && EXCLUDE.indexOf(page) !== -1) || window.__regMax) return;
  window.__regMax = true;

  var VERSION = '20261114a';
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
  function smooth(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  function smoother(t) { t = clamp(t, 0, 1); return t * t * t * (t * (t * 6 - 15) + 10); }
  function easeIO(t) { t = clamp(t, 0, 1); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function f1(n) { return Math.round(n * 100) / 100; }
  function rnd(a, b) { return a + Math.random() * (b - a); }

  /* ------------------------------------------------------------ badge geometry
     A curled cat seen from above: a disc with two ears at the upper left.
     The same polar outline r(θ) drives the static badge and the morph
     target, so the morph lands exactly on the badge. Badge units: 40 x 40. */
  var BC = [20, 22], BR = 14.6, EARS = [[215, 18.8], [248, 19.2]], EW = 15;
  function badgeR(deg) {
    var r = BR;
    EARS.forEach(function (e) {
      var d = Math.abs(((deg - e[0]) % 360 + 540) % 360 - 180);
      if (d < EW) r = Math.max(r, BR + (e[1] - BR) * (0.5 + 0.5 * Math.cos(PI * d / EW)));
    });
    return r;
  }
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

  /* ------------------------------------------------------------ the walking rig
     Walker units: viewBox 120 x 64, facing left, ground at y = 60.
     The outline is 16 segments, each sampled 6 times = 96 points for the morph.
     Tags: h head, e1/e2 ear tips (head + spring), b back (spine flex), u belly. */
  var START = [5.5, 24, 'h'];
  var SEG = [
    ['C', [5.8, 20.5, 'h'], [7, 18, 'h'], [9, 16, 'h']],
    ['C', [9.2, 14, 'h'], [9, 12, 'h'], [9.4, 10.5, 'h']],
    ['C', [9.8, 8, 'e1'], [11.8, 7.2, 'e1'], [12.8, 8.2, 'e1']],
    ['C', [14, 9.5, 'h'], [15.2, 11.5, 'h'], [16, 12.6, 'h']],
    ['C', [17, 12.2, 'h'], [18, 12.2, 'h'], [19, 12.4, 'h']],
    ['C', [19.6, 10, 'e2'], [21.5, 7.6, 'e2'], [23, 8.2, 'e2']],
    ['C', [24.6, 9, 'h'], [25.4, 12.5, 'h'], [26, 15.5, 'h']],
    ['C', [28, 17.5, 'h'], [31, 20.5, ''], [38, 21.5, '']],
    ['C', [52, 19.5, 'b'], [70, 18, 'b'], [84, 20.5, '']],
    ['C', [92, 22, ''], [97.5, 29, ''], [95.5, 37, '']],
    ['C', [93.5, 44, ''], [87, 47.5, ''], [79, 46.5, '']],
    ['C', [66, 48.5, 'u'], [46, 48.5, 'u'], [35, 44.5, '']],
    ['C', [29.5, 42.5, ''], [26.5, 39, ''], [25.5, 35.5, '']],
    ['C', [24, 33.5, 'h'], [21, 33.5, 'h'], [17.5, 33.2, 'h']],
    ['C', [12.5, 33, 'h'], [8.5, 31.5, 'h'], [6.6, 28.6, 'h']],
    ['C', [5.4, 26.8, 'h'], [5.2, 25.4, 'h'], [5.5, 24, 'h']]
  ];
  // Morph anchors: outline sample index -> badge angle (degrees, clockwise from +x).
  var ANCH = [[0, 190], [18, 215], [36, 248], [48, 290], [60, 385], [69, 450], [78, 515], [90, 540], [96, 550]];
  var GROUND = 60, LC = 26, DUTY = 0.62;
  var LEGS = [ // hip (rest, body frame), bone lengths, width, thigh, phase offset, far side: shorter, rounder legs
    { hip: [84, 35], a: 12.5, b: 13, w: 5.2, th: 7, off: 0.5, far: true },
    { hip: [35, 35], a: 12.5, b: 12.5, w: 4.8, th: 4.8, off: 0.75, far: true },
    { hip: [81, 36.5], a: 12.5, b: 13, w: 5.8, th: 8, off: 0, far: false },
    { hip: [32, 36.5], a: 12.5, b: 12.5, w: 5.4, th: 5.4, off: 0.25, far: false }
  ];
  var TAIL_N = 9, TAIL_L = 3.9, TAIL_BASE = [92, 27];
  var TAIL_REST = [-0.86, -0.12, -0.12, -0.12, -0.14, -0.2, -0.32, -0.48, -0.62];
  // Walker box (right 10, bottom 12, 96 x 51 px, 0.8 px/unit) vs badge box
  // (bubble right 16, bottom 16, 52 px; badge inset 8 px, 36 px for 40 units).
  function badgeToWalker(p) { return [57.5 + 1.125 * p[0], 3.75 + 1.125 * p[1]]; }

  function Rig(svg) {
    this.svg = svg;
    var q = function (s) { return svg.querySelector(s); };
    this.g = q('.mx-wk'); this.sq = q('.mx-sq'); this.body = q('.mx-wbody'); this.tail = q('.mx-wtail');
    this.rim = q('.mx-wrim'); this.bshadow = q('.mx-wbsh');
    this.legEls = [].slice.call(svg.querySelectorAll('.mx-wleg'));
    this.shEls = [].slice.call(svg.querySelectorAll('.mx-wsh'));
    this.thEls = [].slice.call(svg.querySelectorAll('.mx-wth'));
    this.pawEls = [].slice.call(svg.querySelectorAll('.mx-wpaw')); this.hl = q('.mx-whl');
    this.thEls.forEach(function (t, i) { t.setAttribute('rx', f1(LEGS[i].a / 2 + 2)); t.setAttribute('ry', f1(LEGS[i].th)); });
    this.x = 0; this.phase = 0; this.amp = 0; this.t = 0;
    this.pose = { bodyY: 0, pitch: 0, flex: 0, belly: 0, hx: 0, hy: 0, headRot: 0, e1x: 0, e1y: 0, e2x: 0, e2y: 0, earLift: 0, tailDrop: 0 };
    this.ear = { x: 0, y: 0, vx: 0, vy: 0 };
    this.tailA = TAIL_REST.slice(); this.tailV = TAIL_REST.map(function () { return 0; });
    this.prevBodyY = 0; this.bodyVy = 0; this.morph = null;
  }
  Rig.prototype.bodyXf = function (x, y) { // pitch about mid-body, then bob
    var p = this.pose, c = Math.cos(p.pitch), s = Math.sin(p.pitch), dx = x - 55, dy = y - 33;
    return [55 + dx * c - dy * s, 33 + dx * s + dy * c + p.bodyY];
  };
  Rig.prototype.xf = function (pt) {
    var p = this.pose, x = pt[0], y = pt[1], tag = pt[2];
    if (tag === 'h' || tag === 'e1' || tag === 'e2') {
      var c = Math.cos(p.headRot), s = Math.sin(p.headRot), dx = x - 26, dy = y - 22;
      x = 26 + dx * c - dy * s + p.hx; y = 22 + dx * s + dy * c + p.hy;
      if (tag === 'e1') { x += p.e1x; y += p.e1y; }
      if (tag === 'e2') { x += p.e2x; y += p.e2y; }
    } else if (tag === 'b') y += p.flex;
    else if (tag === 'u') y += p.belly;
    return this.bodyXf(x, y);
  };
  Rig.prototype.outlineD = function () {
    var self = this, s = this.xf(START), d = 'M' + f1(s[0]) + ' ' + f1(s[1]);
    SEG.forEach(function (sg) {
      d += sg[0];
      for (var i = 1; i < sg.length; i++) { var p = self.xf(sg[i]); d += f1(p[0]) + ' ' + f1(p[1]) + ' '; }
    });
    return d + 'Z';
  };
  Rig.prototype.samples = function () { // 96 points in outline order
    var self = this, out = [], p0 = this.xf(START);
    SEG.forEach(function (sg) {
      var pts = sg.slice(1).map(function (p) { return self.xf(p); });
      for (var k = 0; k < 6; k++) {
        var t = k / 6, u = 1 - t;
        if (sg[0] === 'L') out.push([lerp(p0[0], pts[0][0], t), lerp(p0[1], pts[0][1], t)]);
        else out.push([u * u * u * p0[0] + 3 * u * u * t * pts[0][0] + 3 * u * t * t * pts[1][0] + t * t * t * pts[2][0],
          u * u * u * p0[1] + 3 * u * u * t * pts[0][1] + 3 * u * t * t * pts[1][1] + t * t * t * pts[2][1]]);
      }
      p0 = pts[pts.length - 1];
    });
    return out;
  };
  function morphTargets() {
    var out = [];
    for (var i = 0; i < 96; i++) {
      var j = 0; while (ANCH[j + 1][0] < i) j++;
      var a = ANCH[j], b = ANCH[j + 1], deg = lerp(a[1], b[1], (i - a[0]) / (b[0] - a[0]));
      out.push(badgeToWalker(polar(deg, badgeR(deg))));
    }
    return out;
  }
  function tailArc() { // where the tail lies in the badge: along r = 12 from 20° to 165°
    var out = [];
    for (var i = 0; i <= TAIL_N; i++) out.push(badgeToWalker(polar(lerp(20, 165, i / TAIL_N), 12)));
    return out;
  }
  function ik(h, f, a, b) { // two-bone, joint bends backward (+x)
    var dx = f[0] - h[0], dy = f[1] - h[1], d = clamp(Math.sqrt(dx * dx + dy * dy), 0.01, a + b - 0.01);
    var phi = Math.atan2(dy, dx), al = Math.acos(clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1));
    return [h[0] + a * Math.cos(phi - al), h[1] + a * Math.sin(phi - al)];
  }
  Rig.prototype.feet = function () {
    var self = this;
    return LEGS.map(function (L) {
      var u = ((self.phase - L.off) % 1 + 1) % 1, S = DUTY * LC * self.amp, H = 4.4 * self.amp, fx, fy, lift = 0, s;
      if (u < DUTY) { s = u / DUTY; fx = -S / 2 + S * s; fy = 0; }
      else { s = (u - DUTY) / (1 - DUTY); fx = S / 2 - S * smooth(s); fy = -H * Math.sin(PI * s); lift = Math.sin(PI * s); }
      var hip = self.bodyXf(L.hip[0], L.hip[1]);
      return { hip: hip, foot: [L.hip[0] + fx, GROUND + fy], lift: lift * self.amp, u: u };
    });
  };
  Rig.prototype.tailPts = function () {
    var b = this.bodyXf(TAIL_BASE[0], TAIL_BASE[1]), pts = [b], ang = 0;
    for (var i = 0; i < TAIL_N; i++) {
      ang += this.tailA[i];
      var p = pts[i]; pts.push([p[0] + TAIL_L * Math.cos(ang), p[1] + TAIL_L * Math.sin(ang)]);
    }
    return pts;
  };
  function taper(pts, w0, w1) { // tapered stroke outline with a round tip
    var L = [], R = [], n = pts.length;
    for (var i = 0; i < n; i++) {
      var a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], m = Math.sqrt(dx * dx + dy * dy) || 1;
      var w = lerp(w0, w1, i / (n - 1)) / 2, nx = -dy / m * w, ny = dx / m * w;
      L.push([pts[i][0] + nx, pts[i][1] + ny]); R.push([pts[i][0] - nx, pts[i][1] - ny]);
    }
    var d = 'M' + L.map(function (p) { return f1(p[0]) + ' ' + f1(p[1]); }).join('L');
    d += 'L' + f1(R[n - 1][0]) + ' ' + f1(R[n - 1][1]);
    d += 'L' + R.reverse().map(function (p) { return f1(p[0]) + ' ' + f1(p[1]); }).join('L');
    var t = pts[n - 1], r = w1 / 2; // round tip as a second sub-path drawn in the same direction-independent way
    return d + 'Z' + 'M' + f1(t[0] - r) + ' ' + f1(t[1]) + 'a' + f1(r) + ' ' + f1(r) + ' 0 1 0 ' + f1(2 * r) + ' 0a' + f1(r) + ' ' + f1(r) + ' 0 1 0 ' + f1(-2 * r) + ' 0Z';
  }
  // Advance secondary motion (ears and tail springs) by dt seconds.
  Rig.prototype.secondary = function (dt) {
    var p = this.pose, e = this.ear;
    this.bodyVy = (p.bodyY - this.prevBodyY) / Math.max(dt, 1e-3); this.prevBodyY = p.bodyY;
    e.vx += (-180 * e.x - 9 * e.vx) * dt; e.vy += (-180 * e.y - 9 * e.vy - this.bodyVy * 2.2) * dt;
    e.x += e.vx * dt; e.y += e.vy * dt;
    p.e1x = e.x * 0.6; p.e1y = e.y; p.e2x = e.x * 0.8; p.e2y = e.y * 1.25 + p.earLift;
    p.e1y += p.earLift;
    var w = 2 * PI / 1.7;
    for (var i = 0; i < TAIL_N; i++) {
      var target = TAIL_REST[i] + (0.025 + 0.012 * i) * (0.35 + this.amp) * Math.sin(this.t * w - i * 0.6) + this.bodyVy * 0.0015 * (i + 1) + (p.tailDrop || 0) * (i === 0 ? 1 : 0);
      var k = 150 - 11 * i;
      this.tailV[i] += (k * (target - this.tailA[i]) - 12 * this.tailV[i]) * dt;
      this.tailA[i] += this.tailV[i] * dt;
    }
  };
  Rig.prototype.render = function () {
    var self = this, feet = this.feet();
    this.g.setAttribute('transform', 'translate(' + f1(this.x) + ' 0)');
    this.body.setAttribute('d', this.outlineD());
    this.tail.setAttribute('d', taper(this.tailPts(), 6.8, 4.6));
    this.hl.setAttribute('transform', 'translate(0 ' + f1(this.pose.bodyY) + ')');
    var a = this.xf([38, 22.8, '']), b = this.xf([52, 20.8, 'b']), c = this.xf([70, 19.3, 'b']), dd = this.xf([86, 22.2, '']);
    this.rim.setAttribute('d', 'M' + f1(a[0]) + ' ' + f1(a[1]) + 'C' + f1(b[0]) + ' ' + f1(b[1]) + ' ' + f1(c[0]) + ' ' + f1(c[1]) + ' ' + f1(dd[0]) + ' ' + f1(dd[1]));
    feet.forEach(function (F, i) {
      var L = LEGS[i], k = ik(F.hip, F.foot, L.a, L.b);
      self.legEls[i].setAttribute('d', 'M' + f1(F.hip[0]) + ' ' + f1(F.hip[1]) + 'L' + f1(k[0]) + ' ' + f1(k[1]) + 'L' + f1(F.foot[0]) + ' ' + f1(F.foot[1]));
      var pw = self.pawEls[i]; pw.setAttribute('cx', f1(F.foot[0] - 1)); pw.setAttribute('cy', f1(F.foot[1] + 0.4));
      var th = self.thEls[i], ang = Math.atan2(k[1] - F.hip[1], k[0] - F.hip[0]) * 180 / PI;
      th.setAttribute('transform', 'translate(' + f1((F.hip[0] + k[0]) / 2) + ' ' + f1((F.hip[1] + k[1]) / 2) + ') rotate(' + f1(ang) + ')');
      var pulse = 1 + 0.35 * Math.exp(-F.u * 26) * self.amp, sh = self.shEls[i];
      sh.setAttribute('cx', f1(F.foot[0] - 1)); sh.setAttribute('rx', f1(3.8 * (1 - 0.55 * F.lift) * pulse));
      sh.setAttribute('opacity', f1((L.far ? 0.5 : 0.9) * (1 - 0.8 * F.lift)));
    });
  };
  Rig.prototype.renderMorph = function (e, sx, sy) {
    var M = this.morph, pts = [];
    for (var i = 0; i < 96; i++) pts.push([lerp(M.src[i][0], M.dst[i][0], M.ease(i, e)), lerp(M.src[i][1], M.dst[i][1], M.ease(i, e))]);
    this.body.setAttribute('d', 'M' + pts.map(function (p) { return f1(p[0]) + ' ' + f1(p[1]); }).join('L') + 'Z');
    var tp = M.tail.map(function (p, i) { return [lerp(p[0], M.arc[i][0], e), lerp(p[1], M.arc[i][1], e)]; });
    this.tail.setAttribute('d', taper(tp, lerp(6.8, 4.4, e), lerp(4.6, 3.6, e)));
    var self = this;
    M.legs.forEach(function (L, i) {
      var e2 = clamp(e * 1.6, 0, 1), h = [lerp(L.hip[0], M.c[0], e2 * 0.8), lerp(L.hip[1], M.c[1] + 4, e2 * 0.8)];
      var k = [lerp(L.knee[0], h[0], e2), lerp(L.knee[1], h[1], e2)], f = [lerp(L.foot[0], h[0], e2), lerp(L.foot[1], h[1], e2)];
      self.legEls[i].setAttribute('d', 'M' + f1(h[0]) + ' ' + f1(h[1]) + 'L' + f1(k[0]) + ' ' + f1(k[1]) + 'L' + f1(f[0]) + ' ' + f1(f[1]));
      self.legEls[i].setAttribute('stroke-width', f1(LEGS[i].w * (1 - e2)));
      self.thEls[i].setAttribute('transform', 'translate(' + f1((h[0] + k[0]) / 2) + ' ' + f1((h[1] + k[1]) / 2) + ') scale(' + f1(1 - e2) + ')');
      self.shEls[i].setAttribute('opacity', f1(0.8 * (1 - e)));
      self.pawEls[i].setAttribute('cx', f1(f[0])); self.pawEls[i].setAttribute('cy', f1(f[1]));
      self.pawEls[i].setAttribute('rx', f1(3.4 * (1 - e2))); self.pawEls[i].setAttribute('ry', f1(2.4 * (1 - e2)));
    });
    this.rim.style.opacity = f1(0.9 * clamp(1 - e * 2.5, 0, 1));
    this.hl.style.opacity = f1(clamp(1 - e * 2, 0, 1));
    this.bshadow.style.opacity = f1(1 - e);
    this.g.setAttribute('transform', 'translate(' + f1(this.x * (1 - e)) + ' 0)');
    this.sq.setAttribute('transform', 'translate(' + f1(M.c[0]) + ' ' + f1(M.c[1]) + ') scale(' + f1(sx) + ' ' + f1(sy) + ') translate(' + f1(-M.c[0]) + ' ' + f1(-M.c[1]) + ')');
  };
  Rig.prototype.startMorph = function () {
    var feet = this.feet(), c = badgeToWalker(BC), shift = this.x, dst = morphTargets();
    this.morph = {
      src: this.samples(), dst: dst, c: [c[0], c[1]], tail: this.tailPts(), arc: tailArc(),
      legs: feet.map(function (F, i) { return { hip: F.hip, knee: ik(F.hip, F.foot, LEGS[i].a, LEGS[i].b), foot: F.foot }; }),
      // the head curls in slightly after the body (overlapping action)
      ease: function (i, e) { var lag = (i < 48 || i > 84) ? 0.12 : 0; return easeIO((e - lag) / (1 - lag)); }
    };
    if (shift) { // fold the remaining translation into the source points
      var sh = function (p) { return [p[0] + shift, p[1]]; };
      this.morph.src = this.morph.src.map(sh); this.morph.tail = this.morph.tail.map(sh);
      this.morph.legs.forEach(function (L) { L.hip = sh(L.hip); L.knee = sh(L.knee); L.foot = sh(L.foot); });
      this.x = 0;
    }
  };

  // Monochrome volume: a soft ground shadow, a faint grey rim on the back, a
  // dark-grey inner highlight clipped to the body; far legs a touch lighter.
  var WALKER_SVG =
    '<svg viewBox="0 0 120 64" aria-hidden="true" focusable="false"><defs>' +
      '<radialGradient id="mx-wsg"><stop offset="0" stop-color="#000" stop-opacity=".3"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="mx-whg"><stop offset="0" stop-color="#34343A" stop-opacity=".5"/><stop offset="1" stop-color="#34343A" stop-opacity="0"/></radialGradient>' +
      '<clipPath id="mx-wclip"><use href="#mx-wbody-p"/></clipPath></defs><g class="mx-wk">' +
      '<ellipse class="mx-wbsh" cx="60" cy="62.2" rx="40" ry="3" fill="url(#mx-wsg)"/>' +
      '<ellipse class="mx-wsh" cx="0" cy="62.3" rx="3" ry="1"/><ellipse class="mx-wsh" cx="0" cy="62.3" rx="3" ry="1"/>' +
      '<ellipse class="mx-wsh" cx="0" cy="62.3" rx="3" ry="1"/><ellipse class="mx-wsh" cx="0" cy="62.3" rx="3" ry="1"/>' +
      '<g class="mx-sq"><g class="mx-sil">' +
        '<path class="mx-wtail"/>' +
        '<g class="mx-wfar"><path class="mx-wleg" stroke-width="5.2"/><path class="mx-wleg" stroke-width="4.8"/>' +
        '<ellipse class="mx-wth"/><ellipse class="mx-wth"/><ellipse class="mx-wpaw" rx="3.3" ry="2.3"/><ellipse class="mx-wpaw" rx="3.1" ry="2.2"/></g>' +
        '<path class="mx-wbody" id="mx-wbody-p"/>' +
        '<path class="mx-wleg" stroke-width="5.8"/><path class="mx-wleg" stroke-width="5.4"/>' +
        '<ellipse class="mx-wth"/><ellipse class="mx-wth"/><ellipse class="mx-wpaw" rx="3.5" ry="2.4"/><ellipse class="mx-wpaw" rx="3.3" ry="2.3"/>' +
      '</g><g clip-path="url(#mx-wclip)"><g class="mx-whl">' +
        '<ellipse cx="80" cy="30" rx="15" ry="10" fill="url(#mx-whg)"/><ellipse cx="38" cy="28" rx="10" ry="7" fill="url(#mx-whg)"/><ellipse cx="15" cy="17" rx="7" ry="6" fill="url(#mx-whg)"/>' +
      '</g></g><path class="mx-wrim"/></g>' +
    '</g></svg>';

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

  function makeWalker() {
    removeWalker();
    walker = el('div', 'mx-walker');
    walker.setAttribute('aria-hidden', 'true');
    walker.innerHTML = WALKER_SVG;
    root.insertBefore(walker, btn);
    rig = new Rig(walker.querySelector('svg'));
    return rig;
  }
  function removeWalker() { if (walker && walker.parentNode) walker.parentNode.removeChild(walker); walker = null; rig = null; }

  /* opts: { inPlace: walk without travelling (demo), onDone } */
  function walkIn(opts) {
    opts = opts || {};
    var R = makeWalker(), TW = 4.4, X0 = 172, t = 0, speedLP = 0;
    btn.classList.remove('mx-on', 'mx-alive'); btn.classList.add('mx-forming');
    stopIdle();
    R.x = opts.inPlace ? 0 : X0;
    function step(dt) {
      if (!rig || rig !== R) return false;
      t += dt; R.t += dt;
      var P = R.pose;
      {
        var nx, sp;
        if (opts.inPlace) { nx = 0; sp = 46; R.phase += 46 * dt / LC; }
        else { nx = X0 * (1 - smoother(Math.pow(clamp(t / TW, 0, 1), 0.8))); sp = (R.x - nx) / Math.max(dt, 1e-3); R.phase += (R.x - nx) / LC; }
        speedLP = lerp(speedLP, sp, 0.25);
        R.x = nx; R.amp = clamp(speedLP / 26, 0, 1);
        var ph = R.phase * 2 * PI, A = R.amp;
        P.bodyY = -1.1 * A * Math.cos(2 * ph); P.pitch = 0.014 * A * Math.sin(ph);
        P.flex = 0.9 * A * Math.sin(2 * ph + 1); P.belly = 0.4 * A * Math.sin(2 * ph);
        P.hy = 0.85 * A * Math.cos(2 * ph); P.hx = (-0.9 - 0.3 * Math.sin(ph)) * A; P.headRot = 0.035 * A * Math.sin(ph + 0.6);
        if (!opts.inPlace && t >= TW) { walkTail(R, opts.onDone); return false; }
        if (opts.inPlace && opts.stop && opts.stop()) return false;
      }
      R.secondary(dt);
      R.render();
      return true;
    }
    R.secondary(1 / 60); R.render();
    addTask(step);
  }
  // The glass bubble inflates on a spring with a soft glow burst.
  function inflate() {
    btn.classList.add('mx-on');
    anim(glass, [{ transform: 'scale(.15)', opacity: 0 }, { transform: 'scale(1.12)', opacity: 1, offset: 0.45 },
      { transform: 'scale(.96)', offset: 0.7 }, { transform: 'scale(1.015)', offset: 0.86 }, { transform: 'scale(1)', opacity: 1 }],
      { duration: 760, delay: 240, fill: 'backwards', easing: 'cubic-bezier(.25,.7,.3,1)' });
    anim(btn.querySelector('.mx-glow2'), [{ opacity: 0, transform: 'scale(.6)' }, { opacity: 0.85, transform: 'scale(1.15)', offset: 0.35 }, { opacity: 0, transform: 'scale(1.5)' }],
      { duration: 900, delay: 240, fill: 'backwards', easing: 'ease-out' });
  }
  function finishArrival() {
    removeWalker();
    btn.classList.remove('mx-forming');
    var eyes = btn.querySelector('.mx-eyes');
    anim(eyes, [{ transform: 'scaleY(0)' }, { transform: 'scaleY(0)', offset: 0.35 }, { transform: 'scaleY(1)' }], { duration: 520, easing: 'ease-out' });
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
  var demoTimer = null, demoLabel = null, demoI = 0, walkingInPlace = false;
  function applyRate() {
    if (!root || !root.getAnimations) return;
    root.getAnimations({ subtree: true }).forEach(function (a) { a.playbackRate = rate; });
  }
  var STEPS = [
    ['Walking', 4.2, function () { btn.classList.remove('mx-on', 'mx-alive', 'mx-tip-on'); setState('idle'); walkingInPlace = true; walkIn({ inPlace: true, stop: function () { return !walkingInPlace; } }); }],
    ['Arriving: crouch, morph, bubble inflates', 3.2, function () { walkingInPlace = false; if (rig) { runArrival(); } }],
    ['Idle: breathing, blinks, ear twitches', 5, function () { setState('idle'); }],
    ['Hover: ears perk, halo brightens, tooltip', 3.4, function () { btn.classList.add('mx-tip-on'); }],
    ['Thinking: soft halo pulse and shimmer', 4.4, function () { btn.classList.remove('mx-tip-on'); setState('think'); }],
    ['Found a source: white flash, ears perk', 3.2, function () { setState('found'); }],
    ['Not sure: head tilt', 3.4, function () { setState('unsure'); }]
  ];
  // From walking in place: look up, crouch and morph (reuses the walk-in stages).
  function runArrival() {
    walkingInPlace = false;
    removeWalker();
    var R = makeWalker(); R.x = 0; R.amp = 1;
    btn.classList.add('mx-forming');
    // a short eased stop from walking speed, then the normal arrival stages
    var stage = 'stop', st = 0, P = R.pose;
    addTask(function (dt) {
      if (rig !== R) return false;
      st += dt; R.t += dt;
      if (stage === 'stop') {
        R.amp = 1 - smooth(st / 0.6); R.phase += 46 * (1 - smooth(st / 0.6)) * dt / LC;
        var ph = R.phase * 2 * PI, A = R.amp;
        P.bodyY = -1.1 * A * Math.cos(2 * ph); P.flex = 0.9 * A * Math.sin(2 * ph + 1); P.hy = 0.85 * A * Math.cos(2 * ph);
        if (st > 0.6) { stage = 'done'; walkTail(R); return false; }
      }
      R.secondary(dt); R.render(); return true;
    });
  }
  function walkTail(R, onDone) { // look up, crouch (anticipation), morph, overshoot and settle
    var stage = 'look', st = 0, P = R.pose;
    addTask(function (dt) {
      if (rig !== R) return false;
      st += dt; R.t += dt;
      if (stage === 'look') {
        var k = smooth(st / 0.5);
        P.headRot = lerp(P.headRot, 0.26, 0.12); P.hy = lerp(P.hy, -0.6, 0.12); P.earLift = -1.2 * k; P.bodyY = lerp(P.bodyY, 0, 0.2);
        if (st >= 0.55) { stage = 'crouch'; st = 0; }
      } else if (stage === 'crouch') {
        var c = smooth(st / 0.26);
        P.bodyY = 2.2 * c; P.headRot = lerp(0.26, 0.04, c); P.hy = lerp(-0.6, 0.8, c); P.flex = 0.8 * c; P.earLift = lerp(-1.2, 0.4, c); P.tailDrop = 0.15 * c;
        if (st >= 0.26) { stage = 'morph'; st = 0; R.startMorph(); inflate(); }
      } else if (stage === 'morph') {
        var u = clamp(st / 0.72, 0, 1), e = easeIO(u), sy = 1 + 0.1 * Math.sin(2 * PI * u) * (1 - 0.45 * u);
        R.renderMorph(e, 1 / Math.pow(sy, 0.6), sy);
        if (u >= 1) { stage = 'settle'; st = 0; }
        return true;
      } else {
        var s2 = 1 - 0.06 * Math.exp(-9 * st) * Math.cos(22 * st);
        R.renderMorph(1, 1 / Math.pow(s2, 0.6), s2);
        if (st >= 0.32) { finishArrival(); if (onDone) onDone(); return false; }
        return true;
      }
      R.secondary(dt); R.render(); return true;
    });
  }
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
      clearTimeout(demoTimer); walkingInPlace = false; setState('idle'); btn.classList.remove('mx-tip-on');
      walkIn({ onDone: function () { demoI = 2; demoTimer = setTimeout(next, 2500 / rate); } });
      demoLabel.textContent = 'Replay: walk-in from the edge, look up, crouch, morph';
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
