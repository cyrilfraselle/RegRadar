// Max motion gate: replays Max's walk-in and arrival with a controlled clock and measures how smooth
// it is. Pure node, no browser: the skeleton, the footstep plan and the signed-distance renderer are
// the exact code shipped in docs/max-widget.js (the block between the @rig markers).
//
//   node tests/max-motion.test.mjs              run the gate (exit 1 on failure)
//   MAX_SHEETS=dir node tests/max-motion.test.mjs   also write contact sheets (PNG) into dir
//
// Checks, at the final display size (1.3 CSS px per unit, 60 fps):
//  (a) silhouette change between consecutive frames (XOR area / area): no frame above 3x the median
//  (b) one connected silhouette per frame (far legs counted as joined); no hole ever opens in the merged
//      near body during the walk (cracks or pinholes at joints); in the arrival no pinholes and no hole
//      that flickers (lasts under 3 frames). The eyes and badge lines are cut-outs and are not counted.
//  (c) paw slip: a paw on the ground moves less than 0.5 px horizontally during its stance
//  (d) loop closure: the walk cycle returns to its first frame
// plus: IoU of the rest pose against design-refs/max-walk-master.png when that (untracked) file exists.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(process.env.MAX_RIG_SRC || path.join(ROOT, 'docs/max-widget.js'), 'utf8');
const m = /\/\*@rig\*\/([\s\S]*?)\/\*@rig-end\*\//.exec(src);
if (!m) { console.error('no /*@rig*/ block found'); process.exit(1); }
const RIG = new Function(m[1] + '\nreturn RIG;')();

const W = 360, H = 150, S = 1.3, FPS = 60, EXT = 260; // canvas as in the widget, plus room to the right for the entry
let fails = 0;
const ok = (cond, msg) => { console.log((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) fails++; };
const f2 = (v) => (Math.round(v * 1000) / 1000).toString();

// ---------------------------------------------------------------- helpers
function renderFrame(sc, t, dpr, opts = {}) {
  const w = (W + EXT) * dpr, h = H * dpr, buf = new Uint8Array(w * h);
  const f = RIG.frame(sc.pl, t), c = RIG.cam(sc, t);
  // union: near and far parts joined (no gap, no cut-outs); near: the near body alone (no cut-outs)
  const P = opts.union ? f.P.filter((p) => p.L !== 2) : opts.near ? f.P.filter((p) => p.L === 0 || p.L === 3) : f.P;
  P.kt = f.P.kt;
  RIG.render(P, opts.union ? -100 : f.gap, buf, w, h, c[0], c[1], S * dpr);
  return { buf, w, h, c: f.c };
}
function area(b) { let s = 0; for (let i = 0; i < b.length; i++) s += b[i]; return s / 255; }
function xor(a, b) { let s = 0; for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]); return s / 255; }
function components(buf, w, h, fg, minArea = 0) { // 8-connected for the foreground, 4-connected for the background
  const lab = new Int32Array(w * h), st = []; let n = 0, inner = 0;
  for (let i = 0; i < w * h; i++) {
    if (lab[i] || (buf[i] >= 128) !== fg) continue;
    n++; let border = false, cnt = 0; lab[i] = n; st.push(i);
    while (st.length) {
      const p = st.pop(), x = p % w, y = (p / w) | 0; cnt++;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) border = true;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if ((!dx && !dy) || (!fg && dx && dy)) continue;
        const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= w || Y >= h) continue;
        const q = Y * w + X; if (!lab[q] && (buf[q] >= 128) === fg) { lab[q] = n; st.push(q); }
      }
    }
    if (!border && cnt >= minArea) inner++;
  }
  return fg ? n : inner;
}
function stats(a) {
  const s = a.slice().sort((x, y) => x - y), q = (p) => s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))];
  return { mean: a.reduce((x, y) => x + y, 0) / a.length, median: q(0.5), p95: q(0.95), max: s[s.length - 1] };
}

// ---------------------------------------------------------------- the walk-in
const sc = RIG.scene(W, H, S, false);
RIG.setBadge(sc, W - 42, H - 16 - 26 + 1.8);
const tl = sc.pl.tl, tStop = tl.tStop, tEnd = tStop + RIG.LOOK + RIG.CURL;
console.log(`walk-in: ${f2(tStop)} s walking (${f2(tl.X0)} units), arrival ${f2(RIG.LOOK + RIG.CURL)} s`);
const N = Math.ceil(tEnd * FPS);
const ch = [], chArr = [], comp = [], holes = [], compGap = [], pin = [], walking = [];
let prev = null, t0 = Date.now(), maxReach = 0;
for (let k = 0; k <= N; k++) {
  const t = Math.min(k / FPS, tEnd), fr = renderFrame(sc, t, 1), a = area(fr.buf);
  if (prev) (t <= tStop ? ch : chArr).push(xor(fr.buf, prev) / Math.max(a, 1));
  prev = fr.buf;
  const un = renderFrame(sc, t, 1, { union: true }), nr = renderFrame(sc, t, 1, { near: true });
  comp.push(components(un.buf, un.w, un.h, true)); holes.push(components(nr.buf, nr.w, nr.h, false));
  pin.push(components(nr.buf, nr.w, nr.h, false) - components(nr.buf, nr.w, nr.h, false, 6)); walking.push(t <= tStop);
  if (process.env.MAX_DEBUG && (comp[comp.length - 1] !== 1 || holes[holes.length - 1])) console.log('  t', f2(t), 'pieces', comp[comp.length - 1], 'holes', holes[holes.length - 1], 'curl', f2(fr.c));
  compGap.push(components(fr.buf, fr.w, fr.h, true));
  if (t <= tStop) {
    const J = RIG.walk(sc.pl, t);
    J.L.forEach((l, i) => { const L = RIG.LEG[i], d = Math.hypot(l[2][0] - l[0][0], l[2][1] - l[0][1]); maxReach = Math.max(maxReach, d / (L.a + L.b)); });
  }
}
const ms = (Date.now() - t0) / (N + 1) / 3;
const sw = stats(ch), sa = stats(chArr);
console.log(`(a) walk XOR/area: mean ${f2(sw.mean)}  median ${f2(sw.median)}  p95 ${f2(sw.p95)}  max ${f2(sw.max)}  (${ch.length} frames)`);
ok(sw.max <= 3 * sw.median, `(a) no walk frame jumps more than 3x the median (max/median = ${f2(sw.max / sw.median)})`);
console.log(`    arrival XOR/area: mean ${f2(sa.mean)}  median ${f2(sa.median)}  p95 ${f2(sa.p95)}  max ${f2(sa.max)}  (${chArr.length} frames)`);
ok(sa.max <= 3 * sa.median, `(a) no arrival frame jumps more than 3x its median (max/median = ${f2(sa.max / sa.median)})`);
const cmin = Math.min(...comp), cmax = Math.max(...comp);
ok(cmin === 1 && cmax === 1, `(b) one connected silhouette in every frame (min ${cmin}, max ${cmax})`);
const wHoles = Math.max(...holes.filter((h, k) => walking[k]));
ok(wHoles === 0, `(b) walk: no hole ever opens in the merged near body (max ${wHoles})`);
let flick = 0;
for (let k = 1; k < holes.length; k++) if (holes[k] !== holes[k - 1]) { let r = k; while (r < holes.length && holes[r] === holes[k]) r++; if (r - k < 3 && r < holes.length) flick++; }
ok(flick === 0 && Math.max(...pin) === 0, `(b) arrival: no pinholes (max ${Math.max(...pin)}) and no hole that lasts under 3 frames (${flick}); the wrapping tail may enclose space (up to ${Math.max(...holes)})`);
console.log(`    visible pieces with the far-leg gaps: ${Math.min(...compGap)}-${Math.max(...compGap)}`);

// (c) paw slip, from the rig (toe position) and from the pixels (toe edge of the ground contact)
let slipRig = 0, slipImg = 0;
for (let i = 0; i < 4; i++) {
  let px = null;
  for (let k = 0; k <= Math.floor(tStop * FPS); k++) {
    const p = RIG.paw(sc.pl, i, k / FPS);
    if (p.st) { if (px !== null) slipRig = Math.max(slipRig, Math.abs(p.x - px) * S); px = p.x; } else px = null;
  }
}
{ // pixels: toe-side edge of every stance paw just above the ground, in consecutive frames (merged
  // silhouette, so a far paw is not counted as moving when a near paw's gap passes over it; frames where
  // another paw is close enough to touch it are skipped)
  let last = null;
  for (let k = 0; k <= Math.floor(tStop * FPS); k++) {
    const t = k / FPS, fr = renderFrame(sc, t, 1, { union: true }), cam = RIG.cam(sc, t), edges = [];
    const all = [0, 1, 2, 3].map((i) => RIG.paw(sc.pl, i, t));
    for (let i = 0; i < 4; i++) {
      const p = all[i], p2 = RIG.paw(sc.pl, i, t + 1 / FPS), r = RIG.REST.L[i][4][2];
      const near = all.some((o, j) => j !== i && Math.abs(o.x - p.x) < 8);
      if (!p.st || !p2.st || near) { edges.push(null); continue; }
      const y = Math.floor((RIG.GROUND - 0.3 - cam[1]) * S), x0 = Math.floor((p.x - r - 2 - cam[0]) * S);
      let e = null; for (let x = Math.max(0, x0); x < x0 + 8 && x < fr.w; x++) { const v = fr.buf[y * fr.w + x] / 255; if (v > 0) { e = x + 1 - v; break; } }
      edges.push(e);
    }
    if (last) edges.forEach((e, i) => { if (e !== null && last[i] !== null) { const d = Math.abs(e - last[i]); if (process.env.MAX_DEBUG && d > 0.5) console.log("  slip", i, f2(t), f2(d)); slipImg = Math.max(slipImg, d); } });
    last = edges;
  }
}
ok(slipRig <= 0.5 && slipImg <= 0.5, `(c) paw slip during stance: rig ${f2(slipRig)} px, pixels ${f2(slipImg)} px (limit 0.5)`);

// (d) loop closure on the walk cycle (demo walk in place, camera following)
const lp = RIG.scene(W, H, S, true), T = RIG.DC / RIG.VW;
const A = renderFrame(lp, 3, 2), B = renderFrame(lp, 3 + T, 2), lc = xor(A.buf, B.buf) / area(A.buf);
ok(lc < 0.002, `(d) loop closure: frame(t + ${f2(T)} s) vs frame(t): XOR/area ${lc.toExponential(2)}`);
ok(maxReach <= 1, `legs stay within reach (max extension ${f2(maxReach * 100)}%)`);
console.log(`render: ${f2(ms)} ms per frame at final size (node, single thread)`);

// ---------------------------------------------------------------- rest pose vs the approved master
const master = path.join(ROOT, 'design-refs/max-walk-master.png');
if (fs.existsSync(master)) {
  const im = decodePNG(master), G = 512, cov = new Float32Array(G * G), f = 2048 / G;
  for (let y = 0; y < 2048; y++) for (let x = 0; x < 2048; x++) { const i = (y * 2048 + x) * im.bpp; if (im.data[i] + im.data[i + 1] + im.data[i + 2] < 384) cov[((y / f) | 0) * G + ((x / f) | 0)] += 1 / (f * f); }
  const buf = new Uint8Array(G * G);
  RIG.render(RIG.build(RIG.REST), 0.8, buf, G, G, 0, 0, G / 128);
  let I = 0, U = 0; for (let i = 0; i < buf.length; i++) { const a = buf[i] >= 128, b = cov[i] >= 0.5; if (a && b) I++; if (a || b) U++; }
  ok(I / U >= 0.9, `rest pose IoU against the master silhouette: ${f2(I / U)}`);
} else console.log('SKIP rest-pose IoU (design-refs/max-walk-master.png is not in the repo)');

// ---------------------------------------------------------------- contact sheets
if (process.env.MAX_SHEETS) {
  const dir = process.env.MAX_SHEETS; fs.mkdirSync(dir, { recursive: true });
  const sheet = (name, times, s2, cols) => {
    const tiles = times.map((t) => renderFrame(sc2(t), t, 3)), cw = 150 * 3, chh = 120 * 3;
    const rows = Math.ceil(tiles.length / cols), out = new Uint8Array(cols * cw * rows * chh).fill(255);
    tiles.forEach((fr, n) => {
      // crop around the cat
      let x0 = fr.w, x1 = 0; for (let i = 0; i < fr.buf.length; i++) if (fr.buf[i]) { const x = i % fr.w; if (x < x0) x0 = x; if (x > x1) x1 = x; }
      const ox = Math.max(0, Math.round((x0 + x1) / 2 - cw / 2)), oy = fr.h - chh, cx = (n % cols) * cw, cy = ((n / cols) | 0) * chh;
      for (let y = 0; y < chh; y++) for (let x = 0; x < cw; x++) { const sx = ox + x, sy = oy + y; if (sx < fr.w && sy >= 0) out[(cy + y) * cols * cw + cx + x] = 255 - fr.buf[sy * fr.w + sx]; }
      for (let x = 0; x < cw; x++) out[(cy + chh - 1) * cols * cw + cx + x] = 200;
      for (let y = 0; y < chh; y++) out[(cy + y) * cols * cw + cx] = 200;
    });
    fs.writeFileSync(path.join(dir, name), encodePNG(cols * cw, rows * chh, out));
  };
  let sc2 = () => sc;
  const tc = 1.6; // cruising
  sheet('walk-16-consecutive.png', Array.from({ length: 16 }, (_, i) => tc + i / FPS), 3, 4);
  sheet('walk-cycle-16.png', Array.from({ length: 16 }, (_, i) => tc + i * T / 16), 3, 4);
  sheet('arrival-12.png', Array.from({ length: 12 }, (_, i) => tStop - 0.3 + i * (RIG.LOOK + RIG.CURL + 0.3) / 11), 3, 4);
  console.log('contact sheets written to ' + dir);
}

console.log(fails ? `\n${fails} check(s) failed` : '\nall motion checks passed');
process.exit(fails ? 1 : 0);

// ---------------------------------------------------------------- tiny PNG codec (gray out, RGB in)
function decodePNG(file) {
  const b = fs.readFileSync(file); let p = 8, w, h, ct; const idat = [];
  while (p < b.length) { const n = b.readUInt32BE(p), t = b.toString('ascii', p + 4, p + 8), d = b.subarray(p + 8, p + 8 + n);
    if (t === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); ct = d[9]; } if (t === 'IDAT') idat.push(d); p += 12 + n; }
  const raw = zlib.inflateSync(Buffer.concat(idat)), bpp = { 0: 1, 2: 3, 4: 2, 6: 4 }[ct], st = w * bpp, out = Buffer.alloc(h * st); let pr = Buffer.alloc(st);
  for (let y = 0; y < h; y++) { const f = raw[y * (st + 1)], ln = raw.subarray(y * (st + 1) + 1, (y + 1) * (st + 1)), cu = out.subarray(y * st, (y + 1) * st);
    for (let x = 0; x < st; x++) { const a = x >= bpp ? cu[x - bpp] : 0, u = pr[x], c = x >= bpp ? pr[x - bpp] : 0; let v = ln[x];
      if (f === 1) v += a; else if (f === 2) v += u; else if (f === 3) v += (a + u) >> 1; else if (f === 4) { const q = a + u - c, pa = Math.abs(q - a), pb = Math.abs(q - u), pc = Math.abs(q - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? u : c; }
      cu[x] = v & 255; } pr = cu; }
  return { w, h, bpp, data: out };
}
function encodePNG(w, h, g) {
  const raw = Buffer.alloc(h * (w + 1)); for (let y = 0; y < h; y++) { raw[y * (w + 1)] = 0; for (let x = 0; x < w; x++) raw[y * (w + 1) + 1 + x] = g[y * w + x]; }
  const T = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
  const crc = (buf) => { let c = -1; for (const v of buf) c = T[(c ^ v) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]), c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
