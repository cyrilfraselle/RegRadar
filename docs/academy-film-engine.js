/* =====================================================================
   RegRadar Academy film engine (films 02 onwards).

   One engine, one data file per film (docs/data/academy/films/<id>.json,
   format described in academy/films/README.md). Everything a viewer sees
   is a pure function of time T: scrubbing, chapters, stills, replay and
   reduced motion all just set T and redraw. Randomness is seeded.

   The renderer, easing, comet, kinetic type, grain, vignette, camera
   maths, sounds and the player are taken from film 01
   (docs/film-follow-the-money.html, which keeps its own inline copy).

   Every string drawn on the canvas or shown in the DOM comes from the
   film's data file, from the keys checked by tests/films.test.mjs
   against the approved claim ledgers (gate step 6). The engine adds no
   words of its own to the picture.

   Usage: <section class="player" data-film="data/academy/films/x.json">
   plus #transcript (an <ol>), #stillsBlock and #stills on the page.
   ===================================================================== */
(function () {
'use strict';

var W = 1600, H = 900;
var SANS = '-apple-system,BlinkMacSystemFont,"SF Pro Display","Helvetica Neue",Helvetica,Arial,sans-serif';
var MONO = '"SF Mono",ui-monospace,Menlo,Consolas,monospace';

/* ---------- math + easing ---------- */
function clamp(v, a, b) { a = a == null ? 0 : a; b = b == null ? 1 : b; return v < a ? a : v > b ? b : v; }
function lerp(a, b, p) { return a + (b - a) * p; }
function seg(t, a, b) { return b === a ? (t >= b ? 1 : 0) : clamp((t - a) / (b - a)); }
function bell(p) { return Math.sin(Math.PI * clamp(p)); }
function cubicBezier(x1, y1, x2, y2) {
  var cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  function sx(t) { return ((ax * t + bx) * t + cx) * t; }
  function sy(t) { return ((ay * t + by) * t + cy) * t; }
  function dx(t) { return (3 * ax * t + 2 * bx) * t + cx; }
  return function (x) {
    if (x <= 0) return 0; if (x >= 1) return 1;
    var t = x, i, e, d;
    for (i = 0; i < 8; i++) { e = sx(t) - x; if (Math.abs(e) < 1e-6) return sy(t); d = dx(t); if (Math.abs(d) < 1e-6) break; t -= e / d; }
    var lo = 0, hi = 1; t = x;
    for (i = 0; i < 30; i++) { e = sx(t); if (Math.abs(e - x) < 1e-6) break; if (x > e) lo = t; else hi = t; t = (lo + hi) / 2; }
    return sy(t);
  };
}
var EZ = {
  lin: function (p) { return p; },
  inCubic: function (p) { return p * p * p; },
  outCubic: function (p) { return 1 - Math.pow(1 - p, 3); },
  inOutCubic: function (p) { return p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; },
  outQuart: function (p) { return 1 - Math.pow(1 - p, 4); },
  outExpo: function (p) { return p >= 1 ? 1 : 1 - Math.pow(2, -10 * p); },
  inOutSine: function (p) { return -(Math.cos(Math.PI * p) - 1) / 2; },
  outBack: function (p) { var c1 = 1.35, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); },
  site: cubicBezier(.16, 1, .3, 1),
  cam: cubicBezier(.65, 0, .25, 1)
};

/* ---------- colour: temperature, not colour (0 warm .. 1 cool) ---------- */
var WARM = [255, 180, 84], COOL = [120, 169, 255], HI = [245, 247, 251], T2 = [170, 180, 198], T3 = [138, 147, 160], CARD = [11, 19, 34];
var NAMED = { hi: HI, t2: T2, t3: T3, warm: WARM, cool: COOL, card: CARD, white: [255, 255, 255],
  wgrey: [196, 170, 132], cgrey: [140, 160, 196], ink: [7, 11, 20] };
function mix(a, b, p) { return [a[0] + (b[0] - a[0]) * p, a[1] + (b[1] - a[1]) * p, a[2] + (b[2] - a[2]) * p]; }
function rgba(c, a) { return 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + (a < 0 ? 0 : a > 1 ? 1 : +a.toFixed(4)) + ')'; }
function temp(d) { return mix(WARM, COOL, clamp(d)); }

/* A track is a number or a list of [time, value] points; values between
   two points ease (sine) from one to the next, hold before and after. */
function track(v, t, dflt) {
  if (v == null) return dflt;
  if (typeof v === 'number') return v;
  if (!Array.isArray(v) || !v.length) return dflt;
  if (t <= v[0][0]) return v[0][1];
  for (var i = 1; i < v.length; i++) {
    if (t < v[i][0]) { var a = v[i - 1], b = v[i]; return lerp(a[1], b[1], EZ.inOutSine(seg(t, a[0], b[0]))); }
  }
  return v[v.length - 1][1];
}
function colorOf(spec, t, dflt) {
  if (spec == null) return dflt || HI;
  if (typeof spec === 'string') return NAMED[spec] || dflt || HI;
  return temp(track(spec, t, 1));
}

/* ---------- seeded randomness ---------- */
function rng(s) { return function () { s |= 0; s = s + 0x6D2B79F5 | 0; var t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

/* ---------- geometry ---------- */
function polyLen(pts, closed) {
  var P = closed ? pts.concat([pts[0]]) : pts, L = [0];
  for (var i = 1; i < P.length; i++) L.push(L[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  return { pts: P, L: L, len: L[L.length - 1] };
}
function qpt(p0, c, p1, u) { var v = 1 - u; return [v * v * p0[0] + 2 * v * u * c[0] + u * u * p1[0], v * v * p0[1] + 2 * v * u * c[1] + u * u * p1[1]]; }
function ctrlOf(e) {
  if (e.ctrl) return e.ctrl;
  var a = e.from, b = e.to, dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1, bend = e.bend || 0;
  return [(a[0] + b[0]) / 2 - dy / len * len * bend, (a[1] + b[1]) / 2 + dx / len * len * bend];
}

/* =====================================================================
   Renderer state (per frame)
   ===================================================================== */
var ctx, t, sm, md, fine, AL = 1, CAMNOW, FILM;
var LC = new Map();
function F(size, w, fam) { return (w || 600) + ' ' + size.toFixed(2) + 'px ' + (fam || SANS); }
function ga(a) { ctx.globalAlpha = clamp(AL * a); }
function layout(f, str, split, track) {
  var k = f + '|' + split + '|' + track + '|' + str, L = LC.get(k); if (L) return L;
  ctx.font = f; var units = [], i;
  if (split === 'char') { for (i = 0; i < str.length; i++) units.push({ s: str[i], x: ctx.measureText(str.slice(0, i)).width + i * track }); }
  else { var idx = 0; str.split(' ').forEach(function (w) { units.push({ s: w, x: ctx.measureText(str.slice(0, idx)).width }); idx += w.length + 1; }); }
  L = { units: units, w: ctx.measureText(str).width + track * Math.max(0, str.length - 1) }; LC.set(k, L); return L;
}
/* word wrap to a maximum width; returns lines */
function wrap(str, f, maxW) {
  if (!maxW) return [str];
  var k = 'wrap|' + f + '|' + maxW + '|' + str, L = LC.get(k); if (L) return L;
  ctx.font = f; var words = str.split(' '), out = [], cur = '';
  words.forEach(function (w) { var nx = cur ? cur + ' ' + w : w; if (cur && ctx.measureText(nx).width > maxW) { out.push(cur); cur = w; } else cur = nx; });
  if (cur) out.push(cur); LC.set(k, out); return out;
}
function txt(str, x, y, size, w, fam, col, a, align, track) {
  if (a <= 0 || !str) return 0; var f = F(size, w, fam); ctx.font = f; ga(1); ctx.fillStyle = rgba(col, a); ctx.textBaseline = 'alphabetic';
  if (track) {
    var L = layout(f, str, 'char', track), x0 = align === 'center' ? x - L.w / 2 : align === 'right' ? x - L.w : x; ctx.textAlign = 'left';
    for (var i = 0; i < L.units.length; i++) ctx.fillText(L.units[i].s, x0 + L.units[i].x, y); return L.w;
  }
  ctx.textAlign = align || 'left'; ctx.fillText(str, x, y); return ctx.measureText(str).width;
}
/* Kinetic type: words or letters rise from behind a mask, staggered. */
function ktext(str, x, y, o) {
  var size = o.size, f = F(size, o.w || 650, o.fam), split = o.split || 'word', track = o.track || 0, L = layout(f, str, split, track);
  var tin = o.tin, st = o.st == null ? .06 : o.st, dur = o.dur || .7, rise = o.rise == null ? .95 : o.rise, odur = o.odur || .45;
  if (t < tin) return L.w;
  if (o.tout != null && t > o.tout + odur + st * .5 * L.units.length) return L.w;
  var x0 = o.align === 'center' ? x - L.w / 2 : o.align === 'right' ? x - L.w : x;
  ctx.save(); ga(1);
  if (o.mask !== false) { ctx.beginPath(); ctx.rect(x0 - size, y - size * 1.02, L.w + size * 2, size * 1.36); ctx.clip(); }
  ctx.font = f; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  for (var i = 0; i < L.units.length; i++) {
    var u = L.units[i], k = (o.i0 || 0) + i, p = seg(t, tin + k * st, tin + k * st + dur); if (p <= 0) continue;
    var e = EZ.site(p), qq = 0;
    if (o.tout != null) { qq = seg(t, o.tout + i * st * .5, o.tout + i * st * .5 + odur); if (qq >= 1) continue; }
    var dy = (1 - e) * size * rise - EZ.inCubic(qq) * size * .85;
    var a = clamp(p * 1.6) * (1 - qq) * (o.a == null ? 1 : o.a);
    ctx.fillStyle = rgba(o.colors ? o.colors(k, u.s) : o.col, a);
    ctx.fillText(u.s, x0 + u.x, y + dy);
  }
  ctx.restore(); return L.w;
}
function rr(x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function drawPoly(P, p) {
  if (p <= 0) return null; var target = P.len * p, pts = P.pts, hx = pts[0][0], hy = pts[0][1]; ctx.beginPath(); ctx.moveTo(hx, hy);
  for (var i = 1; i < pts.length; i++) {
    if (P.L[i] <= target) { ctx.lineTo(pts[i][0], pts[i][1]); hx = pts[i][0]; hy = pts[i][1]; }
    else { var f = (target - P.L[i - 1]) / (P.L[i] - P.L[i - 1]); hx = lerp(pts[i - 1][0], pts[i][0], f); hy = lerp(pts[i - 1][1], pts[i][1], f); ctx.lineTo(hx, hy); break; }
  }
  ctx.stroke(); return [hx, hy];
}
function glowDot(x, y, r, col, a) {
  if (a <= 0 || r <= 0) return; var g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(col, a)); g.addColorStop(.35, rgba(col, a * .35)); g.addColorStop(1, rgba(col, 0));
  ga(1); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}
/* The comet: luminous head, tapering tail along a path function. */
function cometPath(fn, u, col, w, a, tail) {
  tail = tail || .2; var n = 14, prev = fn(Math.max(0, u - tail));
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ga(1);
  for (var i = 1; i <= n; i++) {
    var uu = Math.max(0, u - tail + tail * i / n), pt = fn(uu), k = i / n;
    ctx.strokeStyle = rgba(col, a * k * k * .9); ctx.lineWidth = w * (.25 + .9 * k); ctx.beginPath(); ctx.moveTo(prev[0], prev[1]); ctx.lineTo(pt[0], pt[1]); ctx.stroke(); prev = pt;
  }
  glowDot(prev[0], prev[1], w * 7, col, a * .8);
  ctx.fillStyle = rgba([255, 255, 255], a * .9); ctx.beginPath(); ctx.arc(prev[0], prev[1], w * .85, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
function arrowHead(x, y, ang, s, col, a) {
  ga(1); ctx.fillStyle = rgba(col, a); ctx.beginPath();
  ctx.moveTo(x + Math.cos(ang) * s, y + Math.sin(ang) * s);
  ctx.lineTo(x + Math.cos(ang + 2.5) * s, y + Math.sin(ang + 2.5) * s);
  ctx.lineTo(x + Math.cos(ang - 2.5) * s, y + Math.sin(ang - 2.5) * s);
  ctx.closePath(); ctx.fill();
}

/* ---------- film grain (pre-rendered once) ---------- */
var GRAIN = null, grainPat = new WeakMap();
function grain() {
  if (GRAIN) return GRAIN;
  var c = document.createElement('canvas'); c.width = c.height = 160; var g = c.getContext('2d'), id = g.createImageData(160, 160), r = rng(7);
  for (var i = 0; i < id.data.length; i += 4) { var v = r() * 255 | 0; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; }
  g.putImageData(id, 0, 0); GRAIN = c; return c;
}

/* ---------- responsive text size: bigger on small players ---------- */
function ks(e) { return sm ? (e.ksm || 1.45) : md ? (e.kmd || 1.15) : 1; }
function hidden(e) { return (e.lod === 1 && sm) || (e.lod === 2 && md) || (e.only === 'sm' && !sm) || (e.only === 'wide' && sm); }

/* =====================================================================
   Element visibility, entrance and motion
   ===================================================================== */
function vis(e) {
  var t0 = e.t0 == null ? 0 : e.t0;
  if (t < t0) return 0;
  var a = e.fin === 0 ? 1 : seg(t, t0, t0 + (e.fin || .45));
  if (e.t1 != null) a *= 1 - seg(t, e.t1, e.t1 + (e.fout == null ? .4 : e.fout));
  if (e.a != null) a *= track(e.a, t, 1);
  if (e.flick) { var ph = (e.x || 0) * .013 + (e.y || 0) * .007; a *= .35 + .65 * (.5 + .5 * Math.sin(t * (e.flick) + ph)) * (.6 + .4 * Math.sin(t * e.flick * .37 + ph * 2)); }
  return a;
}
function entrance(e) {
  var o = { dx: 0, dy: 0, s: 1 }; if (!e.enter) return o;
  var p = seg(t, e.t0 || 0, (e.t0 || 0) + (e.edur || .7)), d = e.ed || 0;
  if (e.enter === 'rise') o.dy = (1 - EZ.site(p)) * (d || 40);
  else if (e.enter === 'drop') o.dy = -(1 - EZ.outBack(p)) * (d || 70);
  else if (e.enter === 'deal') o.s = lerp(.82, 1, EZ.outBack(p));
  else if (e.enter === 'slide') o.dx = (1 - EZ.site(p)) * (d || 80);
  else if (e.enter === 'pop') o.s = lerp(.4, 1, EZ.outBack(p));
  return o;
}
/* mv: list of moves {t, d, x, y, s} to absolute positions in the parent's space. */
function motion(e) {
  var x = e.x || 0, y = e.y || 0, s = e.s || 1;
  (e.mv || []).forEach(function (m) {
    if (t <= m.t) return; var p = EZ[m.e || 'cam'](seg(t, m.t, m.t + (m.d || 1)));
    if (m.x != null) x = lerp(x, m.x, p); if (m.y != null) y = lerp(y, m.y, p); if (m.s != null) s = Math.exp(lerp(Math.log(s), Math.log(m.s), p));
  });
  return { x: x, y: y, s: s };
}

/* =====================================================================
   Element types
   ===================================================================== */
var DRAW = {};

function drawEl(e) {
  if (hidden(e)) return;
  var a = vis(e); if (a <= 0.002) return;
  var m = motion(e), en = entrance(e), saved = AL;
  AL = saved * a;
  ctx.save();
  ctx.translate(m.x + en.dx, m.y + en.dy);
  var s = m.s * en.s; if (s !== 1) ctx.scale(s, s);
  if (DRAW[e.type]) DRAW[e.type](e);
  ctx.restore();
  AL = saved;
}

DRAW.group = function (e) { (e.items || []).forEach(drawEl); };

DRAW.glow = function (e) { glowDot(0, 0, e.r || 200, colorOf(e.c, t, WARM), e.ga == null ? .12 : track(e.ga, t, .12)); };

/* free text: kinetic (word/char), typewriter (type) or still (none) */
DRAW.text = function (e) {
  var k = ks(e), size = (e.size || 24) * k, col = colorOf(e.c, t, HI), fam = e.mono ? MONO : SANS, w = e.w || (e.mono ? 500 : 650);
  var f = F(size, w, fam), lines = e.maxW ? wrap(e.s, f, e.maxW * (e.wk || 1)) : [e.s], lh = size * (e.lh || 1.22);
  var tint = e.tint, words = 0;
  var colors = tint ? function (i) { return (tint.i && tint.i.indexOf(i) >= 0) || (tint.from != null && i >= tint.from) ? colorOf(tint.c, t, COOL) : col; } : null;
  var y0 = e.valign === 'bottom' ? -(lines.length - 1) * lh : 0;
  if (e.plate) {
    ctx.font = f; var pw = 0; lines.forEach(function (ln) { pw = Math.max(pw, ctx.measureText(ln).width); });
    var px = e.align === 'center' ? -pw / 2 : e.align === 'right' ? -pw : 0;
    ga(.78 * clamp(seg(t, e.t0 || 0, (e.t0 || 0) + .3))); ctx.fillStyle = 'rgba(7,11,20,1)'; rr(px - size * .5, y0 - size * 1.0, pw + size, lh * (lines.length - 1) + size * 1.35, size * .3); ctx.fill();
  }
  lines.forEach(function (ln, li) {
    var y = y0 + li * lh;
    if (e.split === 'type') {
      var n = Math.floor(clamp((t - (e.t0 || 0)) * (e.cps || 38), 0, 9999)) - (li ? lines.slice(0, li).join(' ').length + 1 : 0);
      if (n <= 0) return; var shown = ln.slice(0, n);
      txt(shown, 0, y, size, w, fam, col, 1, e.align || 'left', e.track || 0);
      if (n < ln.length + 6 && n <= ln.length + 1 && Math.floor(t * 4) % 2 === 0) {
        ctx.font = f; var cw = ctx.measureText(shown).width, x0 = e.align === 'center' ? cw / 2 : e.align === 'right' ? 0 : cw;
        ga(1); ctx.fillStyle = rgba(col, .8); ctx.fillRect(x0 + 2, y - size * .78, Math.max(2, size * .08), size * .9);
      }
    } else if (e.split === 'none') {
      txt(ln, 0, y, size, w, fam, col, 1, e.align || 'left', e.track || 0);
    } else {
      ktext(ln, 0, y, { size: size, w: w, fam: fam, col: col, tin: (e.t0 || 0) + li * (e.lst || .12), st: e.st, dur: e.dur, split: e.split, track: e.track,
        align: e.align, tout: e.t1, colors: colors, i0: words, mask: e.mask });
    }
    words += ln.split(' ').length;
  });
};

/* line art drawn on: polys [[x,y]...] (prefix a poly with "Z" for closed) */
DRAW.art = function (e) {
  if (!e._P) e._P = (e.polys || []).map(function (p) { var closed = p[0] === 'Z'; return polyLen(closed ? p.slice(1) : p, closed); });
  var dur = e.dur == null ? 1.2 : e.dur, p = dur ? EZ.inOutCubic(seg(t, e.t0 || 0, (e.t0 || 0) + dur)) : 1, n = e._P.length, stg = e.stg == null ? .45 : e.stg;
  var col = colorOf(e.c, t, T2);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = e.lw || 2;
  if (e.dash) ctx.setLineDash(e.dash);
  if (e.glw) { ctx.shadowColor = rgba(col, .6); ctx.shadowBlur = e.glw; }
  if (e.fill && p >= 1) { e._P.forEach(function (P) { ga(1); ctx.fillStyle = rgba(colorOf(e.fill, t, CARD), e.fa == null ? .9 : e.fa); ctx.beginPath(); P.pts.forEach(function (q, i) { i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }); ctx.fill(); }); }
  ga(1); ctx.strokeStyle = rgba(col, e.ca == null ? .9 : e.ca);
  for (var i = 0; i < n; i++) {
    var off = n > 1 ? i / (n - 1) * stg : 0, pp = stg < 1 ? clamp((p - off) / (1 - stg)) : p;
    var head = drawPoly(e._P[i], pp);
    if (e.arrow && pp >= 1) { var P = e._P[i].pts, a2 = P[P.length - 1], a1 = P[P.length - 2]; arrowHead(a2[0], a2[1], Math.atan2(a2[1] - a1[1], a2[0] - a1[0]), 9 + (e.lw || 2) * 2, col, e.ca == null ? .9 : e.ca); }
  }
  ctx.setLineDash([]); ctx.shadowBlur = 0;
};

/* a curved link between two points, drawn on, optional dash, arrow, label */
DRAW.edge = function (e) {
  var c = ctrlOf(e), col = colorOf(e.c, t, T3), dur = e.dur == null ? .7 : e.dur, p = dur ? EZ.inOutCubic(seg(t, e.t0 || 0, (e.t0 || 0) + dur)) : 1;
  var lw = track(e.lw, t, 1.8);
  ctx.lineCap = 'round'; ctx.lineWidth = lw; if (e.dash) ctx.setLineDash(e.dash);
  ga(1); ctx.strokeStyle = rgba(col, track(e.ca, t, .75));
  ctx.beginPath(); ctx.moveTo(e.from[0], e.from[1]); var steps = 28, last = e.from;
  for (var i = 1; i <= steps; i++) { var u = p * i / steps; last = qpt(e.from, c, e.to, u); ctx.lineTo(last[0], last[1]); }
  ctx.stroke(); ctx.setLineDash([]);
  if (e.arrow && p > .98) { var b4 = qpt(e.from, c, e.to, .96); arrowHead(e.to[0], e.to[1], Math.atan2(e.to[1] - b4[1], e.to[0] - b4[0]), 10 + lw * 2, col, track(e.ca, t, .75) + .15); }
};

/* comet along a curve, optional faint trace left behind */
DRAW.flow = function (e) {
  var c = ctrlOf(e), p = seg(t, e.t0 || 0, (e.t0 || 0) + (e.dur || .8)); if (p <= 0) return;
  var col = colorOf(e.c, t, WARM), u = EZ.inOutCubic(p), fn = function (uu) { return qpt(e.from, c, e.to, uu); };
  if (e.trace) {
    var ta = (e.trace === true ? .35 : e.trace) * (e.keep ? 1 : (1 - seg(t, (e.t0 || 0) + (e.dur || .8) + .3, (e.t0 || 0) + (e.dur || .8) + 1.4)));
    if (ta > 0) { ga(1); ctx.strokeStyle = rgba(mix(T3, col, .6), ta); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(e.from[0], e.from[1]); for (var i = 1; i <= 24; i++) { var q2 = fn(u * i / 24); ctx.lineTo(q2[0], q2[1]); } ctx.stroke(); }
  }
  if (p < 1) cometPath(fn, u, col, e.lw || 2.6, 1, e.tail);
};

/* comet circling an ellipse (a continuous duty) */
DRAW.orbit = function (e) {
  var col = colorOf(e.c, t, COOL), per = e.period || 2.4, ph = e.phase || 0, rx = e.rx || 160, ry = e.ry || 110;
  var base = ph + (t - (e.t0 || 0)) / per * Math.PI * 2;
  var fn = function (u) { var a = base - (1 - u) * 1.3; return [Math.cos(a) * rx, Math.sin(a) * ry]; };
  ga(1); ctx.strokeStyle = rgba(col, .14); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
  cometPath(fn, 1, col, e.lw || 2.4, 1, .55);
};

/* circle: ring, dot, seat, or an arc with an arrow (review loop) */
DRAW.circle = function (e) {
  var r = e.r || 10, col = colorOf(e.c, t, COOL), dur = e.dur || 0, p = dur ? EZ.inOutCubic(seg(t, e.t0 || 0, (e.t0 || 0) + dur)) : 1;
  var a0 = e.a0 == null ? -Math.PI / 2 : e.a0, a1 = e.a1 == null ? a0 + Math.PI * 2 : e.a1, ae = lerp(a0, a1, p);
  var fill = e.fill != null ? track(e.fill, t, 0) : 0;
  if (fill > 0) { ga(1); ctx.fillStyle = rgba(colorOf(e.fc || e.c, t, COOL), fill); ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); }
  if (e.glw) glowDot(0, 0, r * 3, col, .35 * track(e.glw, t, 1));
  if (e.lw !== 0) {
    ctx.lineWidth = e.lw || 2; if (e.dash) ctx.setLineDash(e.dash); ga(1); ctx.strokeStyle = rgba(col, e.ca == null ? .9 : e.ca);
    ctx.beginPath(); ctx.arc(0, 0, r, a0, ae); ctx.stroke(); ctx.setLineDash([]);
    if (e.arrow && p > .9) { var x = Math.cos(ae) * r, y = Math.sin(ae) * r; arrowHead(x, y, ae + Math.PI / 2, 7 + (e.lw || 2) * 1.5, col, .9); }
  }
  (e.pulses || []).forEach(function (tp) { var q2 = seg(t, tp, tp + .9); if (q2 > 0 && q2 < 1) { ga(1); ctx.strokeStyle = rgba(col, .7 * (1 - q2)); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, r + q2 * r * 2.4 + 6, 0, Math.PI * 2); ctx.stroke(); } });
};

/* a check mark drawn on */
DRAW.check = function (e) {
  var s = e.size || 18, p = EZ.outCubic(seg(t, e.t0 || 0, (e.t0 || 0) + (e.dur || .4))), col = colorOf(e.c, t, COOL);
  var P = polyLen([[-s * .55, 0], [-s * .15, s * .42], [s * .6, -s * .45]], false);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = e.lw || 3; ga(1); ctx.strokeStyle = rgba(col, 1); drawPoly(P, p);
};

/* a card: companies, customers, blocks, tiles, chips, files, outcomes */
function cardLayout(e, C, k) {
  var key = 'card|' + (e.id || '') + '|' + JSON.stringify(C) + '|' + k + '|' + e.w + '|' + e.h; var L = LC.get(key); if (L) return L;
  var pad = e.pad == null ? 22 : e.pad, inner = e.w - pad * 2 - (C.pill ? 0 : 0), rows = [], y = 0, kk = k;
  for (var pass = 0; pass < 8; pass++) {
    rows = []; y = 0;
    if (C.title) {
      if (e.emph) {
        var parts = C.title.split(' '), big = parts[0], rest = parts.slice(1).join(' ');
        var bs = (e.ts || 40) * kk; rows.push({ s: big, size: bs, w: 800, fam: SANS, col: 'tint', y: y + bs * .9, ref: C.title }); y += bs * 1.05;
        var rsz = bs * .5; wrap(rest, F(rsz, 600), inner).forEach(function (ln) { rows.push({ s: ln, size: rsz, w: 600, fam: SANS, col: 'hi2', y: y + rsz }); y += rsz * 1.3; });
      } else {
        var ts = (e.ts || 22) * kk, tf = F(ts, e.tw || 650, e.tmono ? MONO : SANS);
        wrap(C.title, tf, inner - (C.pill ? 70 : 0)).forEach(function (ln) { rows.push({ s: ln, size: ts, w: e.tw || 650, fam: e.tmono ? MONO : SANS, col: 'title', y: y + ts * .92 }); y += ts * 1.28; });
      }
      y += 4 * kk;
    }
    (C.lines || []).forEach(function (l) {
      if (typeof l === 'string') l = { s: l };
      var sz = (l.size || e.ls || 17) * kk, fam = l.mono || (l.mono == null && e.lmono) ? MONO : SANS, f = F(sz, l.w || 500, fam);
      wrap(l.s, f, inner).forEach(function (ln, i) { rows.push({ s: ln, size: sz, w: l.w || 500, fam: fam, col: l.c, y: y + sz * .92, tt: l.tt, li: i, full: l.s, off: i }); y += sz * (e.lh || 1.4); });
      y += (l.gap || 0) * kk;
    });
    if (y <= e.h - 2 * Math.min(pad, e.h * .16) || kk < .55) break;
    kk *= .9;
  }
  L = { rows: rows, h: y, pad: pad }; LC.set(key, L); return L;
}
function cardContent(e, C, a, tint) {
  if (a <= 0) return;
  var L = cardLayout(e, C, ks(e)), w = e.w, h = e.h, pad = L.pad, x0 = -w / 2 + pad, top = e.valign === 'top' ? -h / 2 + pad : -L.h / 2;
  var al = e.center ? 'center' : 'left', xx = e.center ? 0 : x0;
  var typed = {};
  L.rows.forEach(function (r) {
    var col = r.col === 'tint' ? tint : r.col === 'title' ? colorOf(e.tc, t, HI) : r.col === 'hi2' ? T2 : colorOf(r.col, t, T2);
    var s = r.s;
    if (r.tt != null) {
      var before = typed[r.full] || 0, n = Math.floor(clamp((t - r.tt) * (e.cps || 42), 0, 9999)) - before;
      typed[r.full] = before + r.s.length + 1;
      if (n <= 0) return; s = r.s.slice(0, n);
    }
    txt(s, xx, top + r.y, r.size, r.w, r.fam, col, a, al);
  });
  if (C.pill) {
    var ps = 14 * ks(e), f = F(ps, 600, MONO); ctx.font = f; var pw = ctx.measureText(C.pill).width + 20 * ks(e), ph = ps * 1.9;
    ga(a); ctx.strokeStyle = rgba(tint, .7); ctx.lineWidth = 1.2; rr(w / 2 - pad - pw, -h / 2 + pad - 4, pw, ph, ph / 2); ctx.stroke();
    txt(C.pill, w / 2 - pad - pw / 2, -h / 2 + pad - 4 + ph * .68, ps, 600, MONO, tint, a, 'center');
  }
}
DRAW.card = function (e) {
  var w = e.w || 300, h = e.h || 80, r = e.r == null ? 12 : e.r, tintC = colorOf(e.c, t, T3), cs = track(e.cs, t, .8), tint = mix(T3, tintC, cs);
  var glowA = track(e.glow, t, 0);
  (e.pulses || []).forEach(function (tp) {
    var q2 = seg(t, tp, tp + .7); if (q2 <= 0 || q2 >= 1) return; var g = (1 - q2);
    ga(1); ctx.strokeStyle = rgba(tintC, .6 * g); ctx.lineWidth = 2; rr(-w / 2 - q2 * 18, -h / 2 - q2 * 18, w + q2 * 36, h + q2 * 36, r + q2 * 12); ctx.stroke();
    glowA = Math.max(glowA, g * .8);
  });
  ctx.save(); ga(1);
  if (glowA > 0) { ctx.shadowColor = rgba(tintC, .55 * glowA); ctx.shadowBlur = 34 * glowA; }
  ctx.fillStyle = rgba(e.fill ? colorOf(e.fill, t, CARD) : mix(CARD, tintC, .06 + .1 * glowA), track(e.fa, t, .96)); rr(-w / 2, -h / 2, w, h, r); ctx.fill();
  ctx.shadowBlur = 0; ctx.lineWidth = e.bw || (e.emph ? 1.8 : 1.4); if (e.dash) ctx.setLineDash(e.dash);
  ctx.strokeStyle = rgba(tint, track(e.ba, t, .7)); ctx.stroke(); ctx.setLineDash([]);
  if (e.bar) { ctx.fillStyle = rgba(tint, .9); rr(-w / 2, -h / 2, 5, h, 2.5); ctx.fill(); }
  ctx.restore();
  /* content, with optional swaps (cross-fade at each swap time) */
  var cur = { title: e.title, pill: e.pill, lines: e.lines }, list = [cur];
  (e.swap || []).forEach(function (s) { list.push({ title: s.title != null ? s.title : cur.title, pill: s.pill != null ? s.pill : cur.pill, lines: s.lines != null ? s.lines : cur.lines, t: s.t }); cur = list[list.length - 1]; });
  for (var i = 0; i < list.length; i++) {
    var aIn = i === 0 ? 1 : seg(t, list[i].t, list[i].t + .35), aOut = i + 1 < list.length ? 1 - seg(t, list[i + 1].t - .05, list[i + 1].t + .25) : 1;
    cardContent(e, list[i], aIn * aOut, tint);
  }
  (e.items || []).forEach(drawEl);
};

/* person marker: dashed silhouette until identified, then solid */
DRAW.person = function (e) {
  var k = (e.r || 30) / 30, col = colorOf(e.c, t, T3), sat = track(e.sat, t, 1); col = mix(T3, col, sat);
  var solid = track(e.solid, t, 0);
  ctx.save(); ctx.lineWidth = 2 * Math.max(1, k * .8);
  function fig() { ctx.beginPath(); ctx.arc(0, -22 * k, 15 * k, 0, Math.PI * 2); ctx.moveTo(-30 * k, 26 * k); ctx.quadraticCurveTo(-30 * k, -2 * k, 0, -2 * k); ctx.quadraticCurveTo(30 * k, -2 * k, 30 * k, 26 * k); }
  if (solid > 0) {
    glowDot(0, -6 * k, 60 * k, col, .18 * solid);
    ga(solid); ctx.fillStyle = rgba(mix(CARD, col, .35), .95); ctx.beginPath(); ctx.arc(0, -22 * k, 15 * k, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-30 * k, 26 * k); ctx.quadraticCurveTo(-30 * k, -2 * k, 0, -2 * k); ctx.quadraticCurveTo(30 * k, -2 * k, 30 * k, 26 * k); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = rgba(col, .95); fig(); ctx.stroke();
  }
  if (solid < 1) { ga(1 - solid); ctx.setLineDash([5 * k, 5 * k]); ctx.strokeStyle = rgba(col, .9); fig(); ctx.stroke(); ctx.setLineDash([]); }
  ctx.restore();
  if (e.name) txt(e.name, 0, 26 * k + 26 * ks(e), 20 * ks(e), 600, e.nmono === false ? SANS : MONO, mix(T2, col, .4), 1, 'center');
  (e.items || []).forEach(drawEl);
};

/* radar: business-wide risk assessment; blips appear as the sweep passes */
DRAW.radar = function (e) {
  var R = e.r || 300, n = (e.spokes || []).length, col = colorOf(e.c, t, COOL);
  var sw = e.sweep || {}, per = sw.period || 2.4, s0 = sw.t0 == null ? (e.t0 || 0) : sw.t0, sStop = sw.stop == null ? 1e9 : sw.stop;
  function ang(k) { return -Math.PI / 2 + k * Math.PI * 2 / n; }
  var tt = Math.min(t, sStop), sweepA = -Math.PI / 2 + (tt - s0) / per * Math.PI * 2;
  if (sw.hold != null && t > sStop) sweepA = lerp(sweepA, sw.hold, EZ.cam(seg(t, sStop, sStop + .8)));
  var draw = EZ.inOutCubic(seg(t, e.t0 || 0, (e.t0 || 0) + 1.1));
  ctx.lineWidth = 1.2;
  [1 / 3, 2 / 3, 1].forEach(function (f, i) { ga(1); ctx.strokeStyle = rgba(T3, .22 + (i === 2 ? .12 : 0)); ctx.beginPath(); ctx.arc(0, 0, R * f * draw, 0, Math.PI * 2); ctx.stroke(); });
  for (var k = 0; k < n; k++) {
    var a = ang(k); ga(1); ctx.strokeStyle = rgba(T3, .3); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * R * draw, Math.sin(a) * R * draw); ctx.stroke();
    var la = seg(t, (e.t0 || 0) + .5 + k * .08, (e.t0 || 0) + 1 + k * .08);
    if (la > 0 && !(e.lod === 1 && sm)) {
      var lx = Math.cos(a) * (R + 26), ly = Math.sin(a) * (R + 26) + 6, al = Math.abs(Math.cos(a)) < .2 ? 'center' : Math.cos(a) > 0 ? 'left' : 'right';
      if (Math.sin(a) < -.9) ly -= 6; if (Math.sin(a) > .9) ly += 14;
      txt(e.spokes[k], lx, ly, (e.ls || 16) * ks(e), 600, MONO, T2, la * track(e.la, t, 1), al, 1.5);
    }
  }
  /* sweep */
  if (t >= s0 && track(e.swa, t, 1) > 0) {
    var swa = track(e.swa, t, 1);
    for (var j = 0; j < 18; j++) { var aa = sweepA - j * .045; ga(1); ctx.strokeStyle = rgba(col, .5 * (1 - j / 18) * swa * (t > sStop ? .6 : 1)); ctx.lineWidth = j ? 3 : 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(aa) * R, Math.sin(aa) * R); ctx.stroke(); }
  }
  /* blips: each appears when the sweep first passes its spoke after `after` */
  (e.blips || []).forEach(function (b) {
    var a = ang(b.k), frac = ((a + Math.PI / 2) / (Math.PI * 2) + 1) % 1, after = b.after == null ? s0 : b.after;
    var tb = s0 + per * frac; while (tb < after) tb += per;
    if (t < tb || tb > sStop + .01) return;
    var p = seg(t, tb, tb + .35), bc = colorOf(b.c, t, COOL), x = Math.cos(a) * R * b.d, y = Math.sin(a) * R * b.d;
    glowDot(x, y, 40 * (b.big ? 1.6 : 1), bc, .55 * p * (1 - .5 * seg(t, tb + .4, tb + 1.4)) + (b.big ? .25 * p : 0));
    ga(p); ctx.fillStyle = rgba(bc, 1); ctx.beginPath(); ctx.arc(x, y, b.big ? 9 : 6, 0, Math.PI * 2); ctx.fill();
    if (b.s) txt(b.s, x + (b.lx || 16), y + (b.ly || -14), (b.ls || 20) * ks(e), 650, SANS, mix(HI, bc, .35), p, b.la || 'left');
  });
  (e.items || []).forEach(drawEl);
};

/* dial: a horizontal risk scale with needles that settle */
DRAW.dial = function (e) {
  var w = e.w || 700, hw = w / 2, p = EZ.site(seg(t, e.t0 || 0, (e.t0 || 0) + .8));
  var g = ctx.createLinearGradient(-hw, 0, hw, 0); g.addColorStop(0, rgba(COOL, .9)); g.addColorStop(.5, rgba(mix(COOL, WARM, .5), .5)); g.addColorStop(1, rgba(WARM, .9));
  ga(1); ctx.fillStyle = g; rr(-hw * p, -5, w * p, 10, 5); ctx.fill();
  for (var i = 0; i <= 10; i++) { ga(p * .6); ctx.fillStyle = rgba(T3, 1); ctx.fillRect(-hw + w * i / 10 - .75, 10, 1.5, i % 5 ? 7 : 12); }
  var ls = (e.ls || 17) * ks(e);
  if (e.left) txt(e.left, -hw, 48 * Math.max(1, ks(e) * .9), ls, 600, MONO, COOL, p, 'left', 1);
  if (e.right) txt(e.right, hw, 48 * Math.max(1, ks(e) * .9) + (sm ? ls * 1.3 : 0), ls, 600, MONO, WARM, p, 'right', 1);
  (e.needles || []).forEach(function (nd) {
    var q2 = seg(t, nd.t, nd.t + .9); if (q2 <= 0) return;
    var v = lerp(nd.from == null ? 0 : nd.from, nd.v, EZ.outBack(q2)), x = v * hw, col = temp(lerp(1, 0, (v + 1) / 2));
    ga(clamp(q2 * 3)); ctx.fillStyle = rgba(col, 1); ctx.beginPath(); ctx.moveTo(x, -10); ctx.lineTo(x - 10, -30); ctx.lineTo(x + 10, -30); ctx.closePath(); ctx.fill();
    ctx.fillRect(x - 1.5, -10, 3, 22);
    glowDot(x, -18, 30, col, .35 * clamp(q2 * 3));
    if (nd.label) txt(nd.label, x, -42, (nd.ls || 18) * ks(e), 650, MONO, mix(HI, col, .4), clamp(q2 * 3), 'center', 1);
  });
};

/* meter: ownership bars against a threshold line */
DRAW.meter = function (e) {
  var w = e.w || 420, h = e.h || 440, max = e.max || 40, th = e.th || 25, p = EZ.site(seg(t, e.t0 || 0, (e.t0 || 0) + .8));
  var yTh = -h * th / max;
  ga(p); ctx.strokeStyle = rgba(T3, .5); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(w + 10, 0); ctx.stroke();
  /* the threshold line draws across */
  var lp = EZ.inOutCubic(seg(t, (e.t0 || 0) + .3, (e.t0 || 0) + 1.2));
  ctx.setLineDash([8, 7]); ga(1); ctx.strokeStyle = rgba(COOL, .85); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-20, yTh); ctx.lineTo(-20 + (w + 40) * lp, yTh); ctx.stroke(); ctx.setLineDash([]);
  if (e.thLabel) txt(e.thLabel, -24, yTh + 6, (e.tls || 18) * ks(e), 600, MONO, COOL, lp, 'right', 1);
  var bars = e.bars || [], slot = w / bars.length;
  bars.forEach(function (b, i) {
    var cx = slot * i + slot / 2, bw = b.bw || slot * .56;
    var vals = b.vals || [b.v];
    var sat = track(b.sat, t, 1);
    vals.forEach(function (vv, j) {
      var v = track(vv, t, 0); if (v <= 0) return;
      var bh = h * v / max, cool = seg(v, th - .6, th), col = mix(mix(T3, WARM, .45), COOL, cool); col = mix(T3, col, sat);
      var bx = vals.length > 1 ? cx - bw / 2 + j * (bw / vals.length) + 2 : cx - bw / 2, bww = vals.length > 1 ? bw / vals.length - 4 : bw;
      ctx.save(); ga(p);
      if (cool > 0) { ctx.shadowColor = rgba(COOL, .5 * cool); ctx.shadowBlur = 24 * cool; }
      ctx.fillStyle = rgba(col, .85); rr(bx, -bh, bww, bh, Math.min(6, bww / 2)); ctx.fill(); ctx.restore();
    });
    if (b.name) txt(b.name, cx, 30 * Math.max(1, ks(e) * .85), (e.nls || 18) * ks(e), 600, MONO, mix(T2, T3, 1 - sat), p, 'center');
    if (b.tag) {
      var ta = seg(t, b.tag.t, b.tag.t + .4); if (ta > 0) {
        var top = -h * track(vals[0], t, 0) / max;
        txt(b.tag.s, cx + (b.tag.dx || 0), top - 16, (b.tag.size || 14) * ks(e), 700, MONO, COOL, ta, b.tag.align || 'center', 1);
      }
    }
  });
};

/* stamp: lands with a thud */
DRAW.stamp = function (e) {
  var p = seg(t, e.t0 || 0, (e.t0 || 0) + .28), s = lerp(1.9, 1, EZ.inCubic(p)), col = colorOf(e.c, t, WARM), size = (e.size || 26) * ks(e);
  ctx.save(); ctx.rotate((e.rot == null ? -7 : e.rot) * Math.PI / 180); ctx.scale(s, s);
  var f = F(size, 800, MONO); ctx.font = f; var L = layout(f, e.s, 'char', 3), bw = L.w + 34, bh = size * 1.7;
  ga(clamp(p * 1.4)); ctx.strokeStyle = rgba(col, .95); ctx.lineWidth = 3; rr(-bw / 2, -bh / 2, bw, bh, 6); ctx.stroke();
  ctx.lineWidth = 1.2; rr(-bw / 2 + 5, -bh / 2 + 5, bw - 10, bh - 10, 4); ctx.stroke();
  txt(e.s, 0, size * .36, size, 800, MONO, col, clamp(p * 1.4), 'center', 3);
  ctx.restore();
  var q2 = seg(t, (e.t0 || 0) + .28, (e.t0 || 0) + 1); if (q2 > 0 && q2 < 1) glowDot(0, 0, 160 * q2 + 40, col, .25 * (1 - q2));
};

/* =====================================================================
   Screen-space pieces: header, HUD, end card
   ===================================================================== */
function header(hd) {
  var tin = hd.t0, tout = hd.t1; if (t < tin || t > tout + 1.2) return;
  var k = sm ? 1.9 : md ? 1.3 : 1, hk = sm ? 1.4 : md ? 1.12 : 1, accent = colorOf(hd.accent, t, COOL);
  var a = seg(t, tin, tin + .4) * (1 - seg(t, tout, tout + .4));
  var hs = 58 * hk, f = F(hs, 700), lines0 = wrap(hd.lines[0], f, W - 200), lines1 = hd.lines[1] ? wrap(hd.lines[1], f, W - 200) : null;
  var nl = Math.max(lines0.length, lines1 ? lines1.length : 0), y = 92 + 28 * k + hs;
  var sg = ctx.createLinearGradient(0, 0, 0, y + hs * 1.1 * (nl - 1) + 70); sg.addColorStop(0, 'rgba(7,11,20,.84)'); sg.addColorStop(.7, 'rgba(7,11,20,.56)'); sg.addColorStop(1, 'rgba(7,11,20,0)');
  ga(a); ctx.fillStyle = sg; ctx.fillRect(0, 0, W, y + hs * 1.1 * (nl - 1) + 70);
  var bw = EZ.site(seg(t, tin, tin + .7)) * 28;
  ga(a); ctx.fillStyle = rgba(accent, 1); ctx.fillRect(80, 92 - 7 * k - 3, bw * k, 3 * k);
  ktext(hd.eyebrow, 80 + 40 * k, 92, { size: 18 * k, w: 600, fam: MONO, col: T2, tin: tin + .05, split: 'char', st: .018, dur: .5, track: 3 * k, tout: tout, odur: .35 });
  var t1 = hd.swap || tout, t2 = tout;
  if (sm) { t1 = Math.min(t1, tin + 3.2); if (hd.swap) t2 = Math.min(tout, hd.swap + 3.4); }
  lines0.forEach(function (ln, i) { ktext(ln, 80, y + i * hs * 1.1, { size: hs, w: 700, col: HI, tin: tin + .15 + i * .12, st: .07, dur: .8, tout: t1, odur: .4 }); });
  if (lines1) lines1.forEach(function (ln, i) { ktext(ln, 80, y + i * hs * 1.1, { size: hs, w: 700, col: HI, tin: hd.swap + .3 + i * .12, st: .07, dur: .8, tout: t2, odur: .4 }); });
}
function hud(h) {
  if (!h || md) return;
  var a = seg(t, h.t0, h.t0 + .6) * (1 - seg(t, h.t1, h.t1 + .4)); if (a <= 0) return;
  var col = temp(track(h.temp, t, .5));
  txt(h.label, 1520, 90, 14, 600, MONO, T3, a, 'right', 2.5);
  ctx.font = F(22, 600, MONO); var w = ctx.measureText(h.value).width;
  txt(h.value, 1520, 124, 22, 600, MONO, col, a, 'right');
  glowDot(1520 - w - 16, 117, 16, col, .5 * a); ga(a); ctx.fillStyle = rgba(col, 1); ctx.beginPath(); ctx.arc(1520 - w - 16, 117, 5, 0, Math.PI * 2); ctx.fill();
}
function endCard(ec) {
  if (!ec || t < ec.t0) return;
  var hs = sm ? 96 : 80, y0 = sm ? 270 : 340, words = 0;
  ec.lines.forEach(function (ln, li) {
    var i0 = words, tint = ec.tint || {};
    ktext(ln, 800, y0 + li * hs * 1.14, { size: hs, w: 700, col: HI, tin: ec.t0 + .1 + li * .22, st: .07, dur: .6, align: 'center',
      colors: function (i) { return li === tint.line && i - i0 >= (tint.from || 0) ? COOL : HI; }, i0: i0 });
    words += ln.split(' ').length;
  });
  var b = EZ.site(seg(t, ec.t0 + .55, ec.t0 + 1.05)); if (b <= 0) return;
  var by = sm ? 650 : 600, ms = sm ? 72 : 52, fs = sm ? 52 : 34;
  ctx.font = F(fs, 700); var tw = ctx.measureText('RegRadar').width, gw = ms + 18 + tw, x0 = 800 - gw / 2;
  ctx.save(); ga(b); ctx.translate(0, (1 - b) * 14);
  ctx.fillStyle = '#4D8DFF'; rr(x0, by - ms / 2, ms, ms, ms * .24); ctx.fill();
  ctx.font = F(ms * .56, 800); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#05070C'; ctx.fillText('R', x0 + ms / 2, by + 1);
  ctx.font = F(fs, 700); ctx.textAlign = 'left'; ctx.fillStyle = rgba(HI, 1); ctx.fillText('RegRadar', x0 + ms + 18, by + 2);
  ctx.restore(); ctx.textBaseline = 'alphabetic';
  if (!md) { var s = seg(t, ec.t0 + .75, ec.t0 + 1.15); (ec.footers || []).forEach(function (f, i) { txt(f, 800, 790 + i * 32, 17, 500, MONO, T3, s, 'center', .5); }); }
}

/* =====================================================================
   Frame
   ===================================================================== */
function camAt(cam, tt) {
  var i = 0; while (i < cam.length - 2 && tt >= cam[i + 1].t) i++;
  var a = cam[i], b = cam[i + 1] || a, p = seg(tt, a.t, b.t), e = EZ[b.e || 'lin'](p);
  var z = Math.exp(lerp(Math.log(a.z), Math.log(b.z), e));
  if (b.dip) z *= 1 - b.dip * Math.sin(Math.PI * e);
  return { x: lerp(a.x, b.x, e), y: lerp(a.y, b.y, e), z: z };
}
function drawGrid(c) {
  var base = 48, L = Math.log2(26 / (base * c.z)), lev = Math.ceil(L), sp = base * Math.pow(2, lev), frac = lev - L;
  function pass(spacing, a) {
    if (a <= .002) return; var s = spacing * c.z, ox = ((W / 2 - c.x * c.z) % s + s) % s, oy = ((H / 2 - c.y * c.z) % s + s) % s;
    ctx.fillStyle = rgba(T2, a); for (var x = ox; x < W; x += s) for (var y = oy; y < H; y += s) ctx.fillRect(x - 1, y - 1, 2, 2);
  }
  ctx.globalAlpha = 1; pass(sp, .065); pass(sp / 2, .065 * frac);
}
function render(c, tt, w) {
  ctx = c; t = tt; sm = w < 560; md = w < 900; fine = !md;
  var D = FILM, cam = camAt(D.camera, t); CAMNOW = cam;
  AL = 1; ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.setLineDash([]);
  ctx.fillStyle = '#070B14'; ctx.fillRect(0, 0, W, H);
  drawGrid(cam);
  ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(cam.z, cam.z); ctx.translate(-cam.x, -cam.y);
  AL = 1; (D.glows || []).forEach(drawEl);
  AL = track(D.dim, t, 1);
  D.elements.forEach(function (e) { if (!e.screen) drawEl(e); });
  ctx.restore();
  AL = track(D.dim, t, 1);
  D.elements.forEach(function (e) { if (e.screen) drawEl(e); });
  AL = 1;
  (D.headers || []).forEach(header);
  hud(D.hud); endCard(D.end);
  var v = ctx.createRadialGradient(W / 2, H / 2, H * .35, W / 2, H / 2, H * 1.05);
  v.addColorStop(0, 'rgba(3,5,10,0)'); v.addColorStop(1, 'rgba(3,5,10,.55)');
  ctx.globalAlpha = 1; ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  var pat = grainPat.get(ctx); if (!pat) { pat = ctx.createPattern(grain(), 'repeat'); grainPat.set(ctx, pat); }
  var fr = Math.floor(t * 24); ctx.save(); ctx.globalAlpha = .035; ctx.globalCompositeOperation = 'overlay';
  ctx.translate(-((fr * 53) % 160), -((fr * 97) % 160)); ctx.fillStyle = pat; ctx.fillRect(0, 0, W + 160, H + 160); ctx.restore();
  var fi = 1 - seg(t, 0, .35); if (fi > 0) { ctx.globalAlpha = fi; ctx.fillStyle = '#070B14'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
}

/* =====================================================================
   Sound: generated with WebAudio, off until the viewer asks for it.
   ===================================================================== */
var Snd = { ac: null, out: null, on: false,
  init: function () {
    var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
    this.ac = new AC(); var lp = this.ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 4200;
    var comp = this.ac.createDynamicsCompressor(); this.out = this.ac.createGain(); this.out.gain.value = .55;
    this.out.connect(lp); lp.connect(comp); comp.connect(this.ac.destination); return true;
  },
  tone: function (f, d, g, type, f2, delay) {
    var ac = this.ac, t0 = ac.currentTime + (delay || 0), o = ac.createOscillator(), v = ac.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(f, t0); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + d);
    v.gain.setValueAtTime(.0001, t0); v.gain.exponentialRampToValueAtTime(g, t0 + .012); v.gain.exponentialRampToValueAtTime(.0001, t0 + d);
    o.connect(v); v.connect(this.out); o.start(t0); o.stop(t0 + d + .05);
  },
  play: function (k, i) {
    if (!this.on || !this.ac) return;
    if (k === 'pulse') { this.tone(58, 1.1, .32, 'sine', 44); this.tone(116, .5, .06, 'sine', 90); }
    else if (k === 'tick') this.tone(2100 + (i % 5) * 90, .05, .018, 'triangle');
    else if (k === 'tock') this.tone(420 + (i % 4) * 40, .16, .035, 'sine', 360);
    else if (k === 'low') { this.tone(73.4, 1.8, .12, 'sine'); this.tone(110, 1.8, .04, 'triangle'); }
    else if (k === 'light') this.tone([523.25, 659.25, 783.99][i % 3], .9, .06, 'sine');
    else if (k === 'thud') { this.tone(90, .35, .22, 'sine', 50); this.tone(180, .12, .05, 'triangle', 120); }
    else if (k === 'chord') { [220, 329.63, 440, 554.37].forEach(function (f, j) { Snd.tone(f, 2.4, .045, 'sine', null, j * .04); }); }
  }
};

/* =====================================================================
   Player
   ===================================================================== */
function fmt(s) { s = Math.max(0, Math.floor(s + 1e-6)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
var ICON = {
  play: '<svg class="i-play" viewBox="0 0 20 20" aria-hidden="true"><path d="M6 4.2v11.6c0 .6.7 1 1.2.7l9.1-5.8c.5-.3.5-1 0-1.3L7.2 3.5C6.7 3.2 6 3.6 6 4.2z" fill="currentColor"/></svg>',
  pause: '<svg class="i-pause" viewBox="0 0 20 20" aria-hidden="true" style="display:none"><rect x="5" y="4" width="3.4" height="12" rx="1" fill="currentColor"/><rect x="11.6" y="4" width="3.4" height="12" rx="1" fill="currentColor"/></svg>',
  replay: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4.5 10a5.5 5.5 0 1 0 1.7-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M4 3.5v3.6h3.6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  sound: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3.5 7.5h3l4-3.5v12l-4-3.5h-3z" fill="currentColor"/><path d="M13.5 7.2a4 4 0 0 1 0 5.6M15.6 5.1a7 7 0 0 1 0 9.8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>'
};

function mount(root, D) {
  FILM = D; var DUR = D.duration;
  root.innerHTML =
    '<div class="stage"><canvas role="img"></canvas></div>' +
    '<div class="captions" aria-live="off"></div>' +
    '<div class="ctrl"><div class="scrub"><div class="ticks" aria-hidden="true"></div>' +
    '<label class="sr" for="fscrub">Timeline</label><input type="range" id="fscrub" min="0" max="' + Math.round(DUR * 1000) + '" step="1" value="0"></div>' +
    '<div class="row"><button class="pbtn b-play" type="button" aria-label="Play">' + ICON.play + ICON.pause + '</button>' +
    '<button class="pbtn b-replay" type="button" aria-label="Replay from the start">' + ICON.replay + '</button>' +
    '<span class="time" aria-hidden="true"></span><span class="spacer"></span>' +
    '<button class="pbtn sound" type="button" aria-pressed="false">' + ICON.sound + '<span class="slab">Sound on</span></button></div>' +
    '<nav class="chapters" aria-label="Scenes"></nav>' +
    '<p class="keys"><kbd>Space</kbd> play or pause · <kbd>←</kbd> <kbd>→</kbd> one second · <kbd>Shift</kbd> + arrow five seconds · click the picture to pause</p></div>';
  var q = function (s) { return root.querySelector(s); };
  var cv = q('canvas'), stage = q('.stage'), range = q('input[type=range]'), bPlay = q('.b-play'), bReplay = q('.b-replay'), bSound = q('.sound'), timeEl = q('.time');
  cv.setAttribute('aria-label', D.alt);
  var T = 0, playing = false, last = 0, dirty = true, wasPlaying = false, scrubbing = false, curCap = -1, curCh = -1;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var c2d = cv.getContext('2d'), stageW = 0;

  /* captions: real text in the DOM, one paragraph each, only the current one visible */
  var capBox = q('.captions');
  D.captions.forEach(function (c, i) { var p = document.createElement('p'); p.textContent = c.text; p.dataset.i = i; capBox.appendChild(p); });
  var capEls = capBox.querySelectorAll('p');
  /* chapters + ticks */
  var chBox = q('.chapters'), ticks = q('.ticks');
  D.chapters.forEach(function (c, i) {
    var b = document.createElement('button'); b.type = 'button'; b.className = 'chap';
    b.innerHTML = '<span>' + fmt(c.t) + '</span>' + esc(c.n); b.setAttribute('aria-label', 'Go to ' + c.n + ', ' + fmt(c.t));
    b.addEventListener('click', function () { seek(c.t + .001); }); chBox.appendChild(b);
    if (i) { var k = document.createElement('i'); k.style.left = (c.t / DUR * 100) + '%'; ticks.appendChild(k); }
  });
  var chEls = chBox.querySelectorAll('.chap');
  /* transcript, generated from the captions (never written by hand) */
  var tr = document.getElementById('transcript');
  if (tr) {
    tr.innerHTML = '';
    D.captions.forEach(function (c) {
      var li = document.createElement('li'), chap = D.chapters.slice().reverse().find(function (h) { return h.t <= c.t0 + .01; });
      li.innerHTML = '<span class="tc">' + fmt(c.t0) + ' to ' + fmt(Math.min(DUR, c.t1)) + '</span><div><h3>' + esc(chap ? chap.n : '') + '</h3><p></p></div>';
      li.querySelector('p').textContent = c.text; tr.appendChild(li);
    });
  }

  function resize() {
    var r = stage.getBoundingClientRect(), dpr = Math.min(2.5, window.devicePixelRatio || 1);
    stageW = r.width; var w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.width * 9 / 16 * dpr));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; } dirty = true;
  }
  function draw() { var s = cv.width / W; c2d.setTransform(s, 0, 0, s, 0, 0); render(c2d, T, stageW); }
  function sync() {
    if (!scrubbing) range.value = Math.round(T * 1000);
    range.style.setProperty('--p', (T / DUR * 100).toFixed(3) + '%');
    var chi = 0; for (var i = 0; i < D.chapters.length; i++) if (T >= D.chapters[i].t) chi = i;
    range.setAttribute('aria-valuetext', fmt(T) + ' of ' + fmt(DUR) + ', ' + D.chapters[chi].n);
    timeEl.textContent = fmt(T) + ' / ' + fmt(DUR);
    var ci = 0; for (i = 0; i < D.captions.length; i++) if (T >= D.captions[i].t0) ci = i;
    if (ci !== curCap) { if (curCap >= 0) capEls[curCap].classList.remove('on'); capEls[ci].classList.add('on'); curCap = ci; }
    if (chi !== curCh) { chEls.forEach(function (b, j) { b.setAttribute('aria-current', j === chi ? 'true' : 'false'); }); curCh = chi; }
    q('.i-play').style.display = playing ? 'none' : ''; q('.i-pause').style.display = playing ? '' : 'none';
    bPlay.setAttribute('aria-label', playing ? 'Pause' : (T >= DUR ? 'Play again' : 'Play'));
  }
  var EV = (D.sounds || []).slice();
  D.chapters.forEach(function (c, i) { if (i) EV.push({ t: c.t, k: 'pulse' }); }); EV.push({ t: .15, k: 'pulse' });
  if (D.end) EV.push({ t: D.end.t0 + .1, k: 'chord' });
  EV.sort(function (a, b) { return a.t - b.t; });
  function fireSounds(a, b) { if (!Snd.on) return; for (var i = 0; i < EV.length; i++) { var e = EV[i]; if (e.t > a && e.t <= b && b - e.t < .15) Snd.play(e.k, e.i || i); } }
  function loop(now) {
    if (playing) { var dt = Math.min(.1, (now - last) / 1000), prev = T; T = Math.min(DUR, T + dt); fireSounds(prev, T); if (T >= DUR) playing = false; dirty = true; }
    last = now;
    if (dirty) { draw(); sync(); dirty = false; }
    requestAnimationFrame(loop);
  }
  function play() { if (T >= DUR) T = 0; playing = true; last = performance.now(); dirty = true; }
  function pause() { playing = false; dirty = true; }
  function toggle() { playing ? pause() : play(); }
  function seek(x) { T = clamp(x, 0, DUR); dirty = true; }

  bPlay.addEventListener('click', toggle);
  bReplay.addEventListener('click', function () { T = 0; play(); });
  stage.addEventListener('click', toggle);
  range.addEventListener('pointerdown', function () { scrubbing = true; wasPlaying = playing; playing = false; });
  range.addEventListener('input', function () { seek(range.value / 1000); });
  function endScrub() { if (!scrubbing) return; scrubbing = false; if (wasPlaying) play(); wasPlaying = false; }
  range.addEventListener('change', endScrub); range.addEventListener('pointerup', endScrub);
  bSound.addEventListener('click', function () {
    if (!Snd.on) { if (!Snd.ac && !Snd.init()) return; Snd.ac.resume(); Snd.on = true; }
    else { Snd.on = false; if (Snd.ac) Snd.ac.suspend(); }
    bSound.setAttribute('aria-pressed', Snd.on ? 'true' : 'false'); q('.slab').textContent = Snd.on ? 'Sound off' : 'Sound on';
  });
  document.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var el = document.activeElement, tag = el && el.tagName, inPlayer = el && root.contains(el), idle = !el || el === document.body;
    if (!inPlayer && !idle) return;
    if (tag === 'INPUT' && el.type !== 'range') return;
    if (e.key === ' ' || e.key === 'Spacebar') { if (tag === 'BUTTON') return; e.preventDefault(); toggle(); }
    else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); seek(T + (e.key === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 5 : 1)); }
    else if (inPlayer && e.key === 'Home') { e.preventDefault(); seek(0); }
    else if (inPlayer && e.key === 'End') { e.preventDefault(); seek(DUR); }
  });
  if (window.ResizeObserver) new ResizeObserver(resize).observe(stage); else window.addEventListener('resize', resize);
  resize();

  /* Reduced motion: no autoplay, a meaningful poster frame, and stills with captions. */
  function buildStills() {
    var box = document.getElementById('stills'), blk = document.getElementById('stillsBlock'); if (!box || !blk) return;
    blk.hidden = false;
    D.stills.forEach(function (s) {
      var f = document.createElement('figure'), d = document.createElement('div'), c = document.createElement('canvas'), fc = document.createElement('figcaption');
      d.className = 'sc'; c.setAttribute('role', 'img'); c.setAttribute('aria-label', 'Still at ' + fmt(s.t) + ': ' + s.h);
      fc.innerHTML = '<span class="mono">' + fmt(s.t) + '</span><b>' + esc(s.h) + '</b>' + esc(s.cap);
      d.appendChild(c); f.appendChild(d); f.appendChild(fc); box.appendChild(f);
      function paint() {
        var r = d.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1); if (!r.width) return;
        c.width = Math.round(r.width * dpr); c.height = Math.round(r.width * 9 / 16 * dpr); var g = c.getContext('2d'), k = c.width / W; g.setTransform(k, 0, 0, k, 0, 0); render(g, s.t, r.width);
        dirty = true;
      }
      if (window.ResizeObserver) new ResizeObserver(paint).observe(d); paint();
    });
  }
  if (reduce) { T = D.poster == null ? D.stills[Math.floor(D.stills.length / 2)].t : D.poster; buildStills(); }
  requestAnimationFrame(loop);
  if (!reduce && !/[?&]still=/.test(location.search)) setTimeout(function () { if (T === 0 && !playing) play(); }, 450);
  window.__film = { seek: function (x) { pause(); seek(x); return new Promise(function (r) { requestAnimationFrame(function () { requestAnimationFrame(r); }); }); }, get T() { return T; }, duration: DUR, id: D.id, ready: true };
}

function boot() {
  var root = document.querySelector('[data-film]'); if (!root) return;
  var url = root.getAttribute('data-film');
  fetch(url, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error('film data ' + r.status); return r.json(); })
    .then(function (D) { mount(root, D); })
    .catch(function (e) {
      var p = document.createElement('p'); p.className = 'film-error'; p.textContent = 'The film could not load. The transcript below has every word of it.';
      root.appendChild(p); if (window.console) console.warn(e);
    });
}
window.RRFilm = { render: function (c, D, tt, w) { FILM = D; render(c, tt, w); } };
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
