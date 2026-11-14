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
    'shift.html', 'triage.html', 'casefile.html', 'film-follow-the-money.html',
    'film-effort-follows-risk.html', 'film-know-who-know-why.html', 'film-look-through.html'];
  var PREVIEW = window.MAX_PREVIEW === true; // set by max-preview.html (CSS inlined there)
  var page = location.pathname.split('/').pop() || 'index.html';
  if (!MAX_ENABLED || (!PREVIEW && EXCLUDE.indexOf(page) !== -1) || window.__regMax) return;
  window.__regMax = true;

  var VERSION = '20261114b';
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

  /* ------------------------------------------------------------ the walking cat
     An original vector traced from the owner-approved master silhouette with
     our own tracer (boundary following, Douglas-Peucker, Catmull-Rom to
     Bezier). Units are 1/16 of the 2048 px master; viewBox 12 20 104 86,
     facing left, paws on y = 103.3. The main shape (head, near ear, body,
     near legs, tail) is reused with <use> and convex clip regions cut at the
     natural joints; the far ear and the far legs are their own shapes. Parts
     overlap across every cut and discs sit on the joint pivots, so the
     joins stay seamless while the parts rotate. */
  var CAT_MAIN = 'M104.1 23.9C104.6 23.8 105.1 23.8 105.6 23.9C106.1 24 106.5 23.9 107.1 24.2C107.7 24.5 108.8 25.1 109.4 25.5C110 25.9 110.1 26.2 110.5 26.7C110.8 27.1 111.1 27.7 111.3 28.2C111.6 28.7 111.7 29.2 111.8 29.7C111.9 30.2 111.9 30.8 111.8 31.2C111.8 31.6 111.7 31.8 111.5 32.1C111.4 32.4 111.1 32.6 110.8 32.8C110.6 32.9 110.3 33.1 110 33.1C109.7 33.1 109.2 33 109 33C108.7 32.9 108.6 32.9 108.4 32.7C108.2 32.5 107.9 32.2 107.8 31.8C107.6 31.4 107.7 30.6 107.6 30.2C107.5 29.7 107.3 29.4 107.1 29.2C106.9 28.9 106.7 28.7 106.3 28.5C106 28.3 105.6 28.1 105.2 28C104.7 28 104.2 28 103.8 28.1C103.4 28.2 103.2 28.3 102.8 28.5C102.4 28.8 101.8 29.3 101.5 29.7C101.2 30 101.1 30.2 101 30.6C100.8 31 100.6 31.4 100.6 32C100.6 32.6 100.6 33.6 100.7 34.2C100.8 34.9 100.8 34.9 101.3 35.9C101.8 36.9 103.1 39.1 103.8 40.3C104.4 41.6 104.8 42.5 105.2 43.6C105.5 44.7 105.6 45.8 105.7 46.8C105.8 47.8 105.7 48.9 105.6 49.8C105.5 50.7 105.3 51.3 105 52.2C104.6 53.1 103.9 54.5 103.4 55.3C103 56 102.8 56.2 102.3 56.8C101.8 57.4 101.3 57.9 100.4 58.7C99.5 59.5 97.7 60.9 97.1 61.5C96.4 62.2 96.6 62.3 96.5 62.6C96.4 62.9 96.3 62.7 96.5 63.5C96.7 64.3 97.5 65.4 97.8 67.3C98 69.1 98 72.9 98.1 74.5C98.2 76.1 98.4 76.2 98.5 76.8C98.7 77.4 98.8 77.6 99 78.2C99.3 78.7 99.7 79.5 100.1 80.1C100.5 80.7 100.8 81.2 101.5 81.9C102.1 82.6 103.1 83.5 103.8 84.1C104.6 84.7 105.5 84.8 106 85.3C106.5 85.8 106.5 85.5 106.9 87C107.4 88.4 108.3 91.9 108.7 93.8C109.2 95.7 109.4 97.4 109.6 98.3C109.8 99.3 109.7 99.2 109.7 99.7C109.6 100.2 109.5 100.9 109.4 101.3C109.3 101.8 109.2 102.1 109 102.4C108.8 102.7 108.6 103 108.2 103.3C107.8 103.6 107.1 103.9 106.7 104C106.2 104.2 105.7 104.2 105.3 104.1C104.9 104 104.5 103.8 104.3 103.7C104 103.5 103.9 103.3 103.8 103C103.7 102.7 103.7 102.2 103.7 101.9C103.7 101.6 103.8 101.6 103.9 101.3C104 101.1 104.2 100.8 104.5 100.5C104.8 100.3 105.5 100 105.7 99.8C105.9 99.5 106 100.2 105.7 99.1C105.5 98 104.5 94.4 104.1 93.2C103.7 92 103.7 92.4 103.4 91.9C103.1 91.4 102.7 90.9 102.1 90.4C101.5 89.9 101.1 89.6 99.9 89C98.7 88.4 96.4 87.5 95 86.8C93.6 86.2 92.4 85.5 91.4 84.9C90.4 84.3 90.4 84.4 89.2 83.3C88.1 82.3 85.6 79.9 84.4 78.8C83.2 77.8 83 77.7 82.2 77.2C81.4 76.8 80.5 76.4 79.6 76.1C78.7 75.8 77.8 75.7 77 75.6C76.1 75.5 75.3 75.6 74.7 75.7C74 75.7 74.6 75.5 72.9 76C71.2 76.4 66.7 77.8 64.5 78.3C62.2 78.9 60.9 79.1 59.4 79.3C57.9 79.5 57.3 79.6 55.5 79.6C53.7 79.6 50.1 79.3 48.5 79.3C47 79.4 47 79.6 46.3 79.9C45.7 80.2 45.1 80.5 44.5 81C43.9 81.4 44.8 80.4 42.8 82.7C40.8 84.9 34.5 92.1 32.5 94.5C30.5 96.9 31.4 96.4 30.8 97.1C30.2 97.8 29.8 97.7 29 98.5C28.3 99.4 26.8 101.3 26.1 102C25.3 102.8 25 102.8 24.5 103C24 103.2 23.7 103.2 23 103.2C22.4 103.3 21.3 103.3 20.7 103.2C20 103 19.6 102.7 19.3 102.5C19.1 102.3 19.1 102.3 19.1 102C19.1 101.8 19 101.5 19.1 101.2C19.2 100.9 19.3 100.6 19.5 100.3C19.8 100.1 20.3 99.6 20.8 99.5C21.3 99.3 22.2 99.4 22.7 99.3C23.1 99.2 22.8 99.5 23.4 98.9C24 98.3 24.8 97.7 26.3 95.5C27.7 93.3 30.9 87.9 32.1 85.8C33.3 83.6 33.2 83.6 33.6 82.7C34 81.7 34.2 81 34.3 80.2C34.5 79.3 34.6 79.8 34.3 77.6C34.1 75.4 33.4 69.2 33 67.1C32.7 65 32.8 66 32.3 65C31.8 64 30.6 62.1 29.9 61.1C29.2 60.1 28.6 59.5 28 59C27.3 58.5 26.6 58.2 26.1 58C25.5 57.9 25.4 57.8 24.7 57.9C23.9 58 22.2 58.4 21.5 58.5C20.8 58.6 20.8 58.6 20.4 58.5C20 58.5 19.8 58.5 19.3 58.2C18.8 57.9 17.9 57.3 17.3 56.7C16.8 56.1 16.3 55.1 16.2 54.6C16 54.1 15.9 54.3 16.2 53.8C16.5 53.3 17.6 52.3 18 51.5C18.5 50.6 18.6 49.5 18.9 48.8C19.2 48.2 19.2 48 19.7 47.5C20.2 46.9 21.4 46 22 45.6C22.7 45.1 23.1 45 23.7 44.8C24.2 44.6 25 44.4 25.4 44.3C25.8 44.1 25.8 44 26 43.8C26.1 43.7 26.1 43.9 26.3 43.2C26.4 42.6 26.6 40.7 26.8 40C27 39.3 27.1 39.3 27.3 39.1C27.6 38.9 27.9 38.8 28.3 38.9C28.6 39 28.9 39.1 29.5 39.6C30 40.1 31 41.2 31.5 42C32.1 42.9 32.1 43.9 32.9 44.8C33.7 45.8 34.9 46.4 36.2 47.8C37.6 49.2 40 52.3 41 53.4C42 54.5 41.9 54 42.3 54.3C42.7 54.5 42.8 54.7 43.6 54.8C44.4 55 45.8 55 47.3 55.4C48.8 55.8 51 56.8 52.4 57.2C53.8 57.6 54 57.7 55.5 57.8C57 57.8 58.7 57.9 61.4 57.6C64.1 57.3 69.1 56.5 72 56.2C74.8 55.9 76.6 55.7 78.4 55.7C80.2 55.6 81.8 55.7 83 55.8C84.1 55.9 84.1 55.9 85.3 56.1C86.5 56.3 88.9 57 90.2 57.2C91.4 57.4 92.1 57.3 92.8 57.2C93.6 57.1 93.9 57 94.7 56.6C95.5 56.2 96.7 55.5 97.5 54.8C98.3 54.2 98.9 53.5 99.5 52.8C100 52.1 100.4 51.3 100.7 50.6C100.9 49.9 101.1 49.3 101.2 48.5C101.2 47.6 101.1 46.3 101 45.3C100.8 44.4 100.7 44 100.2 42.8C99.6 41.7 98.2 39.4 97.7 38.2C97.1 37.1 97 36.8 96.8 36C96.6 35.3 96.4 34.4 96.3 33.7C96.3 32.9 96.3 32.4 96.4 31.6C96.5 30.8 96.8 29.9 97.1 29.1C97.4 28.3 97.9 27.5 98.5 26.8C99.1 26.2 100.1 25.4 100.7 25C101.4 24.5 101.9 24.4 102.5 24.2C103 24 103.5 23.9 104.1 23.9Z';
  var CAT_EAR = 'M22 39.5C22.3 39.5 22.6 39.5 23.2 40C23.8 40.4 25.2 41.6 25.6 42.1C26 42.6 25.5 42.9 25.5 43.2C25.4 43.4 25.7 43.3 25.2 43.5C24.8 43.7 23.3 44.8 22.7 44.4C22.1 44 21.9 41.8 21.7 41.1C21.5 40.4 21.6 40.5 21.7 40.2C21.7 40 21.7 39.5 22 39.5Z';
  var CAT_FH = 'M75.1 76.7C75.8 76.7 77.1 76.7 78 76.8C79 77 79.8 77.3 80.7 77.7C81.5 78 82.1 78.4 83.1 79.2C84.1 79.9 85.8 81.7 86.5 82.3C87.1 82.9 86.8 82.3 86.8 82.7C86.9 83.1 86.6 83.9 86.5 84.6C86.5 85.3 86.5 86.2 86.7 87C86.8 87.7 87 88.3 87.2 89C87.5 89.7 88 90.6 88.2 91.2C88.3 91.8 88.2 92 88 92.5C87.8 92.9 88 92.8 87 94C86.1 95.1 83.6 97.9 82.2 99.3C80.7 100.8 79.3 101.9 78.5 102.5C77.7 103.1 77.7 102.9 77.3 103C76.8 103.1 76.5 103.1 75.9 103.1C75.3 103.1 74.2 103.1 73.7 103C73.1 103 73 102.8 72.7 102.7C72.5 102.5 72.3 102.2 72.2 101.9C72.2 101.6 72.3 101.1 72.4 100.7C72.6 100.4 72.9 100.1 73.1 99.9C73.3 99.7 73.3 99.5 73.8 99.5C74.4 99.4 75.7 99.6 76.3 99.5C76.9 99.4 76.6 99.6 77.4 98.8C78.2 98 80.3 95.6 81 94.5C81.6 93.5 81.4 93.3 81.4 92.6C81.4 91.9 81.5 91.7 80.7 90.3C79.9 88.9 77.5 85.7 76.5 84.1C75.5 82.5 75.2 81.8 74.7 80.6C74.2 79.4 73.5 77.6 73.5 77C73.6 76.3 74.3 76.7 75.1 76.7Z';
  var CAT_FF = 'M48.4 80.4C49.4 80.4 51.6 80.7 53 80.7C54.3 80.8 55.7 78.9 56.5 80.7C57.3 82.4 57.5 89.1 57.8 91.2C58.1 93.4 58.1 92.9 58.3 93.5C58.5 94.1 58.8 94.5 58.8 94.9C58.9 95.3 58.5 95.2 58.5 95.8C58.5 96.3 58.8 97.4 58.8 98.2C58.8 99.1 58.8 100.1 58.7 100.8C58.5 101.5 58.3 102 58 102.4C57.7 102.8 57.4 103 57 103.2C56.5 103.3 55.9 103.4 55.3 103.5C54.8 103.5 54.2 103.5 53.7 103.5C53.2 103.4 52.7 103.2 52.3 103C52 102.8 51.9 102.6 51.8 102.3C51.7 101.9 51.8 101.4 51.9 101C52.1 100.7 52.4 100.4 52.7 100.2C52.9 100 53.2 99.9 53.5 99.8C53.9 99.7 54.4 99.8 54.6 99.7C54.8 99.7 54.7 99.9 54.8 99.5C54.8 99.1 55 98.3 54.8 97.3C54.7 96.4 54.4 95.6 53.7 93.7C53 91.8 51.4 87.6 50.6 85.8C49.8 84 49.5 83.7 49 82.9C48.4 82.1 47.2 81.3 47.2 80.8C47.1 80.4 47.5 80.5 48.4 80.4Z';
  var OV = 1.6, HOV = 5, GROUND = 103.3, STRIDE = 10.5, DUTY = 0.62, LC = STRIDE / DUTY, LIFT = 3.2;
  var SPINE = [[66, 40], [66, 96]], SPV = [66, 68.5], NECK = [[44.5, 53.4], [32.6, 63.2]];
  var TAILC = [[[87.5, 57.2], [97.3, 62.6]], [[100.3, 46], [105.6, 46]], [[96.2, 34], [100.6, 34]]];
  var LEGS = [ // shape, hip cut, knee cut, foot contact, region box, walk phase offset, stride centre shift, rear half, hip pivot (inside the body)
    { s: 'main', hip: [[34.5, 79], [46.5, 80.6]], knee: [[23.2, 93.6], [30.6, 97.6]], foot: [20, 103.3], box: [8, 74, 47.5, 108], off: 0.25, c: 5, rear: 0, pv: [40.5, 69] },
    { s: 'ff', hip: [[47, 81], [58, 81]], knee: [[53.3, 95.2], [58.4, 95.6]], foot: [52.5, 103.2], box: [44, 76, 62, 108], off: 0.75, c: 0, rear: 0, pv: [53, 71] },
    { s: 'fh', hip: [[73, 77.6], [86.5, 83]], knee: [[82.5, 91.5], [88.2, 93]], foot: [74.5, 103], box: [69, 72, 91, 108], off: 0.5, c: 1, rear: 1, pv: [80, 70] },
    { s: 'main', hip: [[80.5, 79.5], [101, 80]], knee: [[99.5, 91.8], [105.6, 89.4]], foot: [105, 103.2], box: [78, 74, 114, 108], off: 0, c: -3.5, rear: 1, pv: [91, 68] }
  ];
  function mid(a, b) { return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; }
  function dist(a, b) { return Math.sqrt((a[0] - b[0]) * (a[0] - b[0]) + (a[1] - b[1]) * (a[1] - b[1])); }
  function ang(a, b) { return Math.atan2(b[1] - a[1], b[0] - a[0]); }
  function rbox(b) { return [[b[0], b[1]], [b[2], b[1]], [b[2], b[3]], [b[0], b[3]]]; }
  // Keep the part of a convex polygon on the side of line ab that contains ref; grow moves the line away (overlap).
  function cutPoly(poly, ab, ref, grow) {
    var a = ab[0], b = ab[1], nx = a[1] - b[1], ny = b[0] - a[0], L = Math.sqrt(nx * nx + ny * ny), out = [];
    nx /= L; ny /= L;
    if ((ref[0] - a[0]) * nx + (ref[1] - a[1]) * ny < 0) { nx = -nx; ny = -ny; }
    function sd(p) { return (p[0] - a[0]) * nx + (p[1] - a[1]) * ny + (grow || 0); }
    for (var i = 0; i < poly.length; i++) {
      var P = poly[i], Q = poly[(i + 1) % poly.length], sp = sd(P), sq = sd(Q);
      if (sp >= 0) out.push(P);
      if ((sp >= 0) !== (sq >= 0)) { var t = sp / (sp - sq); out.push([P[0] + (Q[0] - P[0]) * t, P[1] + (Q[1] - P[1]) * t]); }
    }
    return out;
  }
  function pts(poly) { return poly.map(function (p) { return f1(p[0]) + ',' + f1(p[1]); }).join(' '); }
  LEGS.forEach(function (L) {
    L.H = L.pv; L.K = mid(L.knee[0], L.knee[1]);
    L.a = dist(L.H, L.K); L.b = dist(L.K, L.foot);
    L.bend = (L.K[0] - L.H[0]) * (L.foot[1] - L.H[1]) - (L.K[1] - L.H[1]) * (L.foot[0] - L.H[0]) > 0 ? 1 : -1;
  });
  var TP = TAILC.map(function (c) { return mid(c[0], c[1]); });

  function walkerSVG() {
    var defs = '<path id="mx-c-main" d="' + CAT_MAIN + '"/><path id="mx-c-ff" d="' + CAT_FF + '"/><path id="mx-c-fh" d="' + CAT_FH + '"/>' +
      '<radialGradient id="mx-wsg"><stop offset="0" stop-color="#000" stop-opacity=".28"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>';
    function clip(id, poly) { defs += '<clipPath id="mx-k-' + id + '"><polygon points="' + pts(poly) + '"/></clipPath>'; return 'url(#mx-k-' + id + ')'; }
    function use(shape, cl) { return '<use href="#mx-c-' + shape + '" clip-path="' + cl + '"/>'; }
    function disc(c, r) { return r ? '<circle cx="' + f1(c[0]) + '" cy="' + f1(c[1]) + '" r="' + f1(r) + '"/>' : ''; }
    var BIG = [0, 0, 130, 120];
    var head = function (g) { return cutPoly(rbox([8, 30, 52, 72]), NECK, [20, 45], g); };
    var tail = function (i, g) {
      var p = cutPoly(rbox([84, 18, 116, 63]), TAILC[0], [100, 40], i === 0 ? g : 0);
      if (i >= 1) p = cutPoly(p, TAILC[1], [102, 30], g); else p = cutPoly(p, TAILC[1], [95, 56], g);
      if (i === 2) p = cutPoly(p, TAILC[2], [100, 26], g); else if (i === 1) { p = cutPoly(p, TAILC[2], [103, 42], g); p = cutPoly(p, [[103.5, 32], [108, 40]], [98, 40], 0); }
      return p;
    };
    var legRegion = function (L, g) { return cutPoly(rbox(L.box), L.hip, L.foot, g); }; // g < 0 shrinks toward the foot
    // torso halves: whole shape minus the parts that move on their own
    var mFront = '<polygon fill="#fff" points="' + pts(cutPoly(rbox(BIG), SPINE, [30, 70], OV)) + '"/>' +
      '<polygon points="' + pts(head(-0.6)) + '"/><polygon points="' + pts(legRegion(LEGS[0], -2.2)) + '"/>';
    var mRear = '<polygon fill="#fff" points="' + pts(cutPoly(rbox(BIG), SPINE, [100, 70], OV)) + '"/>' +
      '<polygon points="' + pts(tail(0, 0)) + '"/><polygon points="' + pts(tail(1, 0)) + '"/><polygon points="' + pts(tail(2, 0)) + '"/>' +
      '<polygon points="' + pts(legRegion(LEGS[3], -2.2)) + '"/>';
    defs += '<mask id="mx-m-f" maskUnits="userSpaceOnUse" x="0" y="0" width="130" height="120">' + mFront + '</mask>' +
      '<mask id="mx-m-r" maskUnits="userSpaceOnUse" x="0" y="0" width="130" height="120">' + mRear + '</mask>';
    function leg(i) {
      var L = LEGS[i], up = cutPoly(cutPoly(rbox([L.box[0], L.box[1] - 10, L.box[2], L.box[3]]), L.hip, L.foot, HOV), L.knee, L.H, OV), lo = cutPoly(rbox(L.box), L.knee, L.foot, OV);
      return '<g class="mx-lu">' + use(L.s, clip('u' + i, up)) +
        '<g class="mx-ll">' + use(L.s, clip('l' + i, lo)) + disc(L.K, dist(L.knee[0], L.knee[1]) * 0.43) + '</g></g>';
    }
    var tailG = '<g class="mx-t0">' + use('main', clip('t0', tail(0, OV))) +
      '<g class="mx-t1">' + use('main', clip('t1', tail(1, OV))) + disc(TP[1], dist(TAILC[1][0], TAILC[1][1]) * 0.47) +
      '<g class="mx-t2">' + use('main', clip('t2', tail(2, OV))) + disc(TP[2], dist(TAILC[2][0], TAILC[2][1]) * 0.47) + '</g></g></g>';
    var headG = '<g class="mx-whd"><path d="' + CAT_EAR + '"/>' + use('main', clip('hd', head(OV))) + disc(mid(NECK[0], NECK[1]), dist(NECK[0], NECK[1]) * 0.42) + '</g>';
    var body = '<g class="mx-wk">' +
      '<ellipse cx="62" cy="104.2" rx="46" ry="2.6" fill="url(#mx-wsg)" class="mx-wbsh"/>' +
      '<ellipse class="mx-wsh" cy="104" rx="3" ry="1"/><ellipse class="mx-wsh" cy="104" rx="3" ry="1"/><ellipse class="mx-wsh" cy="104" rx="3" ry="1"/><ellipse class="mx-wsh" cy="104" rx="3" ry="1"/>' +
      '<g class="mx-sil">' +
        '<g class="mx-wf">' + leg(1) + '</g>' +
        '<g class="mx-wr">' + leg(2) + '</g>' +
        '<g class="mx-wr">' + tailG + '</g>' +
        '<g class="mx-wr"><use href="#mx-c-main" mask="url(#mx-m-r)"/>' + leg(3) + '</g>' +
        '<g class="mx-wf"><use href="#mx-c-main" mask="url(#mx-m-f)"/>' + disc(SPV, 10.8) + headG + leg(0) + '</g>' +
      '</g></g>';
    return '<svg viewBox="12 20 104 86" aria-hidden="true" focusable="false"><defs>' + defs + '</defs>' + body + '</svg>';
  }

  function fx(u) { return u < DUTY ? -STRIDE / 2 + STRIDE * u / DUTY : STRIDE / 2 - STRIDE * smooth((u - DUTY) / (1 - DUTY)); }
  function fy(u) { return u < DUTY ? 0 : -LIFT * Math.sin(PI * (u - DUTY) / (1 - DUTY)); }
  function rot(p, c, a) { var co = Math.cos(a), si = Math.sin(a), dx = p[0] - c[0], dy = p[1] - c[1]; return [c[0] + dx * co - dy * si, c[1] + dx * si + dy * co]; }
  function deg(r) { return f1(r * 180 / PI); }

  function Rig(svg) {
    var q = function (sel) { return [].slice.call(svg.querySelectorAll(sel)); };
    this.wk = svg.querySelector('.mx-wk'); this.front = q('.mx-wf'); this.rear = q('.mx-wr');
    this.lu = q('.mx-lu'); this.ll = q('.mx-ll'); this.sh = q('.mx-wsh'); this.head = svg.querySelector('.mx-whd');
    this.tg = [svg.querySelector('.mx-t0'), svg.querySelector('.mx-t1'), svg.querySelector('.mx-t2')];
    // DOM order of legs: far fore, far hind, near hind, near fore -> map to LEGS indexes
    this.order = [1, 2, 3, 0];
    this.x = 0; this.phase = 0; this.amp = 0; this.t = 0;
    this.by = 0; this.sp = 0; this.hr = 0; this.look = 0; this.crouch = 0;
    this.ta = [0, 0, 0]; this.tv = [0, 0, 0]; this.prevBy = 0;
  }
  Rig.prototype.step = function (dt) { // secondary motion: tail chain springs (lag and sway)
    var vy = (this.by - this.prevBy) / Math.max(dt, 1e-3); this.prevBy = this.by;
    var w = 2 * PI / 1.5;
    for (var i = 0; i < 3; i++) {
      var target = (0.03 + 0.03 * i) * (0.4 + this.amp) * Math.sin(this.t * w - i * 0.8) + vy * 0.004 * (i + 1) - this.crouch * 0.05 * (i === 0 ? 1 : 0);
      this.tv[i] += ((120 - 25 * i) * (target - this.ta[i]) - 10 * this.tv[i]) * dt;
      this.ta[i] += this.tv[i] * dt;
    }
  };
  Rig.prototype.render = function () {
    var self = this, A = this.amp, ph = this.phase * 2 * PI;
    this.by = -0.75 * A * Math.cos(2 * ph) + 1.6 * this.crouch;
    this.sp = 0.022 * A * Math.sin(ph);
    this.hr = 0.03 * A * Math.cos(2 * ph) + 0.12 * this.look - 0.04 * this.crouch;
    var fT = 'translate(0 ' + f1(this.by) + ')', rT = fT + ' rotate(' + deg(this.sp) + ' ' + SPV[0] + ' ' + SPV[1] + ')';
    this.wk.setAttribute('transform', 'translate(' + f1(this.x) + ' 0)');
    this.front.forEach(function (g) { g.setAttribute('transform', fT); });
    this.rear.forEach(function (g) { g.setAttribute('transform', rT); });
    this.head.setAttribute('transform', 'rotate(' + deg(this.hr) + ' ' + f1(mid(NECK[0], NECK[1])[0]) + ' ' + f1(mid(NECK[0], NECK[1])[1]) + ')');
    for (var i = 0; i < 3; i++) this.tg[i].setAttribute('transform', 'rotate(' + deg(this.ta[i]) + ' ' + f1(TP[i][0]) + ' ' + f1(TP[i][1]) + ')');
    this.order.forEach(function (li, k) {
      var L = LEGS[li], u = ((self.phase + L.off) % 1 + 1) % 1, lift = u < DUTY ? 0 : Math.sin(PI * (u - DUTY) / (1 - DUTY)) * A;
      var T = [L.foot[0] + (L.c + fx(u)) * Math.max(A, 0.35), L.foot[1] + fy(u) * A];
      var lt = [T[0], T[1] - self.by]; if (L.rear) lt = rot(lt, SPV, -self.sp);
      // two-bone IK, keeping the drawn knee direction
      var d = clamp(dist(L.H, lt), Math.abs(L.a - L.b) + 0.01, L.a + L.b - 0.01), phi = ang(L.H, lt);
      var al = Math.acos(clamp((L.a * L.a + d * d - L.b * L.b) / (2 * L.a * d), -1, 1)), k1 = phi - al, k2 = phi + al;
      var c1 = [L.H[0] + L.a * Math.cos(k1), L.H[1] + L.a * Math.sin(k1)];
      var cr = (c1[0] - L.H[0]) * (lt[1] - L.H[1]) - (c1[1] - L.H[1]) * (lt[0] - L.H[0]);
      var ka = (cr > 0 ? 1 : -1) === L.bend ? k1 : k2, Kn = [L.H[0] + L.a * Math.cos(ka), L.H[1] + L.a * Math.sin(ka)];
      var d1 = ka - ang(L.H, L.K), d2 = ang(Kn, lt) - ang(L.K, L.foot) - d1;
      self.lu[k].setAttribute('transform', 'rotate(' + deg(d1) + ' ' + f1(L.H[0]) + ' ' + f1(L.H[1]) + ')');
      self.ll[k].setAttribute('transform', 'rotate(' + deg(d2) + ' ' + f1(L.K[0]) + ' ' + f1(L.K[1]) + ')');
      var sh = self.sh[k], pulse = 1 + 0.3 * Math.exp(-u * 24) * A;
      sh.setAttribute('cx', f1(T[0] - 1)); sh.setAttribute('rx', f1(3.8 * (1 - 0.5 * lift) * pulse)); sh.style.opacity = f1((L.s === 'main' ? 0.9 : 0.6) * (1 - 0.75 * lift));
    });
  };

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
    walker.innerHTML = walkerSVG();
    root.insertBefore(walker, btn);
    rig = new Rig(walker.querySelector('svg'));
    return rig;
  }
  function removeWalker() { if (walker && walker.parentNode) walker.parentNode.removeChild(walker); walker = null; rig = null; }

  /* Walk in from the right edge (or on the spot in the demo), then arrive:
     slow down, look up toward the bubble, crouch, and curl into it.
     opts: { inPlace, onDone }. Returns { arrive } for the demo. */
  function walkIn(opts) {
    opts = opts || {};
    var R = makeWalker(), TW = 5, X0 = 140, t = 0, speedLP = 0, mode = 'walk', st = 0;
    btn.classList.remove('mx-on', 'mx-alive'); btn.classList.add('mx-forming');
    stopIdle();
    R.x = opts.inPlace ? 0 : X0;
    function step(dt) {
      if (rig !== R) return false;
      t += dt; st += dt; R.t += dt;
      if (mode === 'walk') {
        var nx = R.x, sp;
        if (opts.inPlace) { sp = 26; R.phase += sp * dt / LC; }
        else { nx = X0 * (1 - smoother(Math.pow(clamp(t / TW, 0, 1), 0.8))); sp = (R.x - nx) / Math.max(dt, 1e-3); R.phase += (R.x - nx) / LC; }
        speedLP = lerp(speedLP, sp, 0.25); R.x = nx; R.amp = clamp(speedLP / 14, 0, 1);
        if (!opts.inPlace && t >= TW) { mode = 'look'; st = 0; }
      } else if (mode === 'stop') { // demo: ease out of walking in place
        var k = 1 - smooth(st / 0.6); R.phase += 26 * k * dt / LC; R.amp = k;
        if (st >= 0.6) { mode = 'look'; st = 0; }
      } else if (mode === 'look') {
        R.amp = lerp(R.amp, 0, 0.2); R.look = smooth(st / 0.4);
        if (st >= 0.5) { mode = 'crouch'; st = 0; }
      } else if (mode === 'crouch') {
        R.crouch = smooth(st / 0.22); R.look = 1 - R.crouch;
        if (st >= 0.24) { R.step(dt); R.render(); curl(R, opts.onDone); return false; }
      }
      R.step(dt); R.render();
      return true;
    }
    R.step(1 / 60); R.render();
    addTask(step);
    return { arrive: function () { if (mode === 'walk') { mode = opts.inPlace ? 'stop' : 'look'; st = 0; } } };
  }
  // Squash, then shrink into the bubble while the glass inflates and the curled badge springs in.
  function curl(R, onDone) {
    var wr = walker.getBoundingClientRect(), br = btn.getBoundingClientRect();
    walker.style.transformOrigin = f1(br.left + br.width / 2 - wr.left) + 'px ' + f1(br.top + br.height / 2 - wr.top) + 'px';
    btn.classList.add('mx-on'); btn.classList.remove('mx-forming');
    inflate();
    anim(badgeEl, [{ opacity: 0, transform: 'scale(.45) rotate(-25deg)' }, { opacity: 1, transform: 'scale(1.08) rotate(4deg)', offset: 0.62 }, { opacity: 1, transform: 'scale(1)' }],
      { duration: 560, delay: 230, fill: 'backwards', easing: 'cubic-bezier(.3,.7,.3,1)' });
    var a = anim(walker, [{ transform: 'scale(1,1)', opacity: 1 }, { transform: 'scale(1.05,.9)', opacity: 1, offset: 0.22 },
      { transform: 'scale(.62,.7)', opacity: 0.9, offset: 0.62 }, { transform: 'scale(.3,.3)', opacity: 0 }],
      { duration: 560, easing: 'cubic-bezier(.45,0,.3,1)', fill: 'forwards' });
    function done() { if (rig === R) removeWalker(); finishArrival(); if (onDone) onDone(); }
    if (a) a.onfinish = done; else done();
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
  function finishArrival() {
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
