// Authoring helper for film 04 (Look through). Writes
// docs/data/academy/films/beneficial-ownership.json. Every string must be in the claim ledger of
// academy/films/beneficial-ownership.script.md. Structure (fixed, checked in the script brief):
// Velmont: Mira 30 % · Kappa Holding 40 % · Jonas 8 % · others 22 %; Kappa: Jonas 45 % · Elif 35 % · Tom 20 %.
// Run: node academy/films/src/beneficial-ownership.mjs
import { write } from './lib.mjs';

const RISK = 'warm', OK = 'cool';
const E = [];
const lbl = (s, x, y, t0, o = {}) => Object.assign({ type: 'text', s, x, y, size: 20, mono: true, c: 't2', t0, split: 'char', st: .015 }, o);
const greyOut = [[0, 1], [36.3, 1], [36.9, .25]];

/* S1 · Who is behind it? */
[1640, 1760, 1880, 2000].forEach((x, i) => E.push({ type: 'person', x, y: 700 - (i % 2) * 12, r: 26, c: RISK, flick: 2.6 + i * .7, a: .55, t0: .6 + i * .15, t1: 12.4 }));
E.push({ type: 'text', screen: true, s: 'Who is behind it?', x: 800, y: 190, size: 72, align: 'center', plate: true, t0: 1.0, t1: 5.6, st: .1, tint: { i: [2], c: RISK } });

/* S2 · two routes, drawn together */
E.push({ type: 'group', t0: 6.4, t1: 12.2, items: [
  { type: 'edge', from: [1740, 812], to: [1676, 736], t0: 6.6, dur: .8, c: 't2', lw: 2.6, ca: .9 },
  { type: 'edge', from: [1900, 812], to: [1964, 736], t0: 6.6, dur: .8, c: OK, lw: 2.6, ca: .9, dash: [8, 7] },
  lbl('OWNS', 1690, 792, 7.2, { align: 'right', c: 'hi', w: 600 }),
  lbl('CONTROLS · other means', 1952, 792, 7.2, { c: OK, w: 600 })
] });

/* The chart */
E.push({ type: 'card', x: 1820, y: 860, w: 480, h: 92, r: 14, title: 'Velmont Analytics BV · fictional', ts: 22, center: true, t0: .2, c: OK, cs: .5, fa: [[6, .96], [6.6, .5], [12, .5], [12.6, .96]] });
E.push({ type: 'card', x: 1820, y: 940, w: 560, h: 46, r: 23, title: 'Orrin · fictional crypto-asset service provider', ts: 16, tmono: true, center: true, pad: 12, t0: 2.4, enter: 'drop', ed: 30, c: OK, cs: .5 });

/* S3 · direct shareholders */
E.push({ type: 'edge', from: [1222, 600], to: [1640, 814], bend: .08, t0: 12.4, c: 't3' });
E.push(lbl('Mira · 30 %', 1405, 738, 12.6, { align: 'right' }));
E.push({ type: 'person', x: 1200, y: 560, c: [[0, .15], [15.2, .15], [15.5, 1]], solid: [[15.2, 0], [15.6, 1]], t0: 12.3, enter: 'pop' });
E.push(lbl('BENEFICIAL OWNER', 1200, 626, 15.4, { size: 16, c: OK, w: 700, align: 'center', t1: 31.9 }));
E.push({ type: 'edge', from: [1820, 644], to: [1820, 814], t0: 12.6, c: 't3' });
E.push({ type: 'card', x: 1820, y: 580, w: 420, h: 128, r: 12, title: 'Kappa Holding Ltd · 40 %', ts: 21, valign: 'top', t0: 12.5, enter: 'deal', c: 't3', cs: .8, cps: 50,
  lines: [{ s: 'No one controls Kappa Holding in this example (no one holds over 50 %)', tt: 19.3, mono: true, size: 16, c: OK }] });
const JV = { from: [2262, 348], to: [2000, 814], ctrl: [2420, 640] };
E.push(Object.assign({ type: 'edge', t0: 12.8, c: 't3' }, JV));
E.push(Object.assign({ type: 'edge', t0: 26.5, dur: .8, c: OK, lw: 3, ca: .95 }, JV));
E.push(lbl('Jonas · 8 %', 2304, 642, 12.9));
E.push({ type: 'person', x: 2240, y: 310, c: [[0, .15], [29.0, .15], [29.3, 1]], solid: [[29.0, 0], [29.4, 1]], t0: 12.7, enter: 'pop' });
E.push(lbl('BENEFICIAL OWNER', 2196, 304, 29.3, { size: 16, c: OK, w: 700, align: 'right' }));
[[2500, 586], [2526, 610], [2550, 584], [2566, 612], [2516, 566]].forEach(([x, y], i) => E.push({ type: 'circle', x, y, r: 6, c: 't3', fill: .8, lw: 0, t0: 12.9 + i * .05 }));
E.push({ type: 'edge', from: [2500, 622], to: [2010, 818], bend: -.06, t0: 13.0, c: 't3', ca: .4 });
E.push(lbl('Other shareholders · 22 % · each under 5 %', 2530, 680, 13.1, { size: 17, align: 'center', maxW: 300, split: 'none' }));
E.push({ type: 'flow', from: [1640, 814], to: [1222, 600], bend: -.08, t0: 13.6, dur: .9, c: OK, lw: 2.8 });

/* the meter, with the dashed 25 % line */
const v = (pts) => pts;
E.push({ type: 'meter', x: 2790, y: 860, w: 380, h: 440, max: 40, th: 25, thLabel: '25 % or more.', t0: 12.6, tls: 16, nls: 18, bars: [
  { name: 'Mira', vals: [v([[14.4, 0], [15.4, 30]])], tag: { s: 'BENEFICIAL OWNER', t: 15.4, size: 15 } },
  { name: 'Jonas', vals: [v([[20.9, 0], [21.6, 18], [28.2, 18], [29.1, 26]])], tag: { s: 'BENEFICIAL OWNER', t: 29.2, size: 15 } },
  { name: 'Elif', vals: [v([[23.2, 0], [23.9, 14]])], sat: greyOut },
  { name: 'Tom', vals: [v([[25.2, 0], [25.9, 8]])], sat: greyOut },
  { vals: [[[13.6, 0], [14.2, 4.8]], [[13.7, 0], [14.3, 4.2]], [[13.8, 0], [14.4, 4.6]], [[13.9, 0], [14.5, 3.9]]], sat: .5 }
] });
E.push({ type: 'text', s: 'Lower thresholds may be set for some higher-risk types of company · Art. 52(2)', x: 2980, y: 934, size: 15, mono: true, c: 't3', align: 'center', maxW: 470, split: 'none', t0: 13.4, t1: 18.2 });

/* S4 · multiply along the chain, then add */
E.push({ type: 'person', x: 1440, y: 310, c: RISK, sat: greyOut, t0: 18.3, enter: 'pop' });
E.push({ type: 'person', x: 1820, y: 290, c: RISK, sat: greyOut, t0: 18.5, enter: 'pop' });
E.push({ type: 'edge', from: [1462, 350], to: [1700, 516], t0: 18.4, c: 't3' });
E.push({ type: 'edge', from: [1820, 330], to: [1820, 516], t0: 18.6, c: 't3' });
E.push({ type: 'edge', from: [2218, 348], to: [1940, 516], t0: 18.7, c: 't3' });
E.push(lbl('Elif · 35 %', 1560, 452, 18.6, { align: 'right', a: greyOut }));
E.push(lbl('Tom · 20 %', 1800, 432, 18.8, { align: 'right', a: greyOut }));
E.push(lbl('Jonas · 45 %', 2084, 458, 18.9));
E.push(lbl('not on these facts', 1630, 368, 36.6, { size: 18, c: 't3', align: 'center' }));
const two = (t0, top, person, c) => [
  { type: 'flow', from: [1820, 814], to: [1820, 646], t0, dur: .6, c, lw: 2.6 },
  { type: 'flow', from: top, to: person, t0: t0 + .6, dur: .6, c, lw: 2.6 }];
E.push(...two(19.6, [1940, 516], [2218, 348], .55), ...two(22.0, [1700, 516], [1462, 350], .3), ...two(24.0, [1820, 516], [1820, 330], .3));
E.push({ type: 'flow', from: [2000, 814], to: [2262, 348], ctrl: [2420, 640], t0: 26.8, dur: 1.0, c: OK, lw: 3 });
E.push({ type: 'flow', from: [1940, 516], to: [2218, 348], t0: 26.9, dur: .9, c: OK, lw: 3 });
E.push({ type: 'circle', x: 2240, y: 310, r: 40, c: OK, lw: 2, t0: 27.8, fin: .1, t1: 28.6, pulses: [27.8] });
E.push({ type: 'card', x: 2660, y: 350, w: 440, h: 244, r: 14, t0: 19.8, t1: 31.9, enter: 'slide', ed: 60, valign: 'top', pad: 28, c: OK, cs: .4, cps: 30, lmono: true, ls: 27, lh: 1.5,
  lines: [{ s: '45 % × 40 % = 18 %', tt: 20.6, c: 'hi' }, { s: '35 % × 40 % = 14 %', tt: 23.0, c: 't2' }, { s: '20 % × 40 % = 8 %', tt: 25.0, c: 't2' }, { s: '18 % + 8 % = 26 %', tt: 27.9, c: OK, w: 700 }] });

/* S5 · control by other means */
E.push({ type: 'group', t0: 32.2, t1: 39.6, items: [
  { type: 'person', x: 900, y: 520, c: [[0, .15], [35.8, .15], [36.1, 1]], solid: [[35.8, 0], [36.2, 1]], t0: 32.4, enter: 'pop' },
  lbl('Victor · 0 %', 900, 590, 32.6, { align: 'center', c: 'hi' }),
  { type: 'art', x: 740, y: 690, t0: 33.0, dur: .6, c: 't2', lw: 2, polys: [['Z', [-30, -40], [30, -40], [30, 40], [-30, 40]], [[-18, -22], [18, -22]], [[-18, -8], [18, -8]], [[-18, 6], [10, 6]], [[-16, 24], [-8, 18], [0, 28], [8, 20], [16, 26]]] },
  lbl('Agreement with the shareholders', 740, 768, 33.2, { size: 17, align: 'center', maxW: 260, split: 'none' }),
  { type: 'edge', from: [930, 556], to: [1326, 852], bend: .06, t0: 33.8, dur: .7, c: OK, dash: [8, 7], lw: 2.2 },
  ...[1340, 1380, 1420, 1460, 1500].map((x, i) => ({ type: 'circle', x, y: 860, r: 12, c: i < 3 ? [[0, .2], [34.4 + i * .3, .2], [34.6 + i * .3, 1]] : 't3', lw: 2, fill: i < 3 ? [[0, 0], [34.4 + i * .3, 0], [34.6 + i * .3, .85]] : 0, t0: 33.6 + i * .06 })),
  { type: 'edge', from: [1516, 860], to: [1578, 860], t0: 33.8, c: 't3', dur: .3 },
  lbl('appoint or remove a majority', 1420, 918, 35.2, { size: 17, c: OK, align: 'center' }),
  lbl('BENEFICIAL OWNER · control', 900, 626, 36.0, { size: 16, c: OK, w: 700, align: 'center' }),
  lbl('control, not shares', 900, 656, 36.6, { size: 16, c: OK, align: 'center' })
] });

/* S6 · verify, and check the register */
const P6 = [[3950, 'Mira', 40.6], [4350, 'Jonas', 41.0], [4750, 'Victor', 41.4]];
const s6 = [];
P6.forEach(([x, name, tk], i) => {
  s6.push({ type: 'card', x: x + 46, y: 534, w: 150, h: 100, r: 10, t0: 39.8 + i * .15, c: OK, cs: .35, items: [{ type: 'art', t0: 40.1 + i * .15, dur: .5, c: 't3', lw: 4, ca: .4, polys: [[[-50, -20], [40, -20]], [[-50, 0], [20, 0]], [[-50, 20], [30, 20]]] }] });
  s6.push({ type: 'person', x, y: 520, r: 46, c: OK, solid: 1, t0: 39.6 + i * .15, enter: 'pop' });
  s6.push({ type: 'text', s: name, x, y: 614, size: 22, w: 650, c: 'hi', align: 'center', t0: 39.9 + i * .15 });
  s6.push({ type: 'check', x: x + 54, y: 458, size: 22, t0: tk, c: OK, lw: 3.5 });
});
s6.push({ type: 'card', x: 5200, y: 520, w: 280, h: 260, r: 14, title: 'Central register · extract', tmono: true, ts: 16, valign: 'top', pad: 22, t0: 41.6, enter: 'slide', ed: 120, c: 't3', cs: .8,
  lines: [{ s: 'Mira', size: 20, c: 'hi', w: 600 }], items: [{ type: 'art', t0: 42.0, dur: .5, c: 't3', lw: 4, ca: .35, polys: [[[-110, 40], [40, 40]], [[-110, 70], [10, 70]], [[-110, 100], [60, 100]]] }] });
s6.push({ type: 'glow', x: 5010, y: 520, r: 120, c: RISK, ga: .2, t0: 42.6 });
s6.push({ type: 'text', s: '≠', x: 5010, y: 545, size: 70, w: 700, c: RISK, align: 'center', split: 'none', t0: 42.6, enter: 'pop' });
s6.push({ type: 'edge', from: [4810, 690], to: [5150, 662], bend: .12, t0: 43.4, dur: .7, c: OK, arrow: true, lw: 2.2, ca: .9 });
s6.push(lbl('report the discrepancy', 4980, 736, 43.6, { size: 18, c: OK, align: 'center' }));
E.push({ type: 'group', t0: 39.4, t1: 46.4, items: s6 });

/* S7 · what goes wrong */
const chip = (y, s, t0) => ({ type: 'card', x: 5860, y, w: 600, h: 52, r: 26, title: s, ts: 19, tw: 600, t0, enter: 'slide', ed: -60, c: RISK, cs: .9, pad: 26 });
const box = (x, y) => ({ type: 'card', x, y, w: 200, h: 64, r: 10, t0: 46.3, enter: 'deal', c: RISK, cs: .45 });
E.push({ type: 'group', t0: 46.2, t1: 57.0, items: [
  lbl('COMMON WARNING SIGNS · NOT PROOF', 5560, 352, 46.4, { size: 18, c: RISK, w: 600, track: 3 }),
  Object.assign(chip(412, 'Nominees with no explanation', 46.6), { a: [[53, 1], [53.5, .5]] }),
  Object.assign(chip(477, 'Long or circular chains, no business reason', 46.85), { a: [[53, 1], [53.5, .5]] }),
  Object.assign(chip(542, 'Owner will not be named', 47.1), { a: [[53, 1], [53.5, .5]] }),
  box(6420, 450), box(6700, 600), box(6420, 740),
  { type: 'edge', from: [6524, 466], to: [6650, 566], bend: -.15, t0: 46.6, c: RISK, ca: .6, arrow: true },
  { type: 'edge', from: [6650, 634], to: [6524, 724], bend: -.15, t0: 46.9, c: RISK, ca: .6, arrow: true },
  { type: 'edge', from: [6380, 706], to: [6380, 486], bend: -.25, t0: 47.2, c: RISK, ca: .6, arrow: true },
  { type: 'edge', from: [6470, 416], to: [6640, 354], bend: -.1, t0: 47.5, c: RISK, ca: .6 },
  { type: 'card', x: 6740, y: 320, w: 360, h: 64, r: 10, title: 'Nominee Services Ltd · nominee', ts: 17, center: true, pad: 14, t0: 47.6, enter: 'deal', c: RISK, cs: .7 },
  { type: 'glow', x: 7010, y: 300, r: 110, c: 't2', ga: .16, t0: 48.0 },
  { type: 'text', s: '?', x: 7010, y: 318, size: 46, w: 800, c: 't2', align: 'center', split: 'none', t0: 48.0, a: .7 },
  { type: 'edge', from: [7010, 346], to: [7046, 500], t0: 49.6, dur: .5, c: 't3', dash: [5, 6], lw: 1.4 },
  { type: 'circle', x: 7050, y: 520, r: 14, c: 't3', lw: 2, t0: 49.9 },
  { type: 'circle', x: 7050, y: 620, r: 14, c: 't3', lw: 2, t0: 50.1 },
  { type: 'edge', from: [7050, 534], to: [7050, 606], t0: 50.0, dur: .3, c: 't3', dash: [5, 6], lw: 1.4 },
  lbl('sanctions check', 7022, 526, 49.9, { size: 17, align: 'right', split: 'none' }),
  lbl('PEP check', 7022, 626, 50.1, { size: 17, align: 'right', split: 'none' }),
  lbl('not run on the missing owner', 7070, 690, 50.5, { size: 16, c: 't3', align: 'right' }),
  lbl('No one found after all possible means → record it', 5560, 640, 53.1, { size: 19, c: 'hi', split: 'type', cps: 60 }),
  lbl('Identify and verify the senior managing officials', 5560, 684, 53.9, { size: 19, c: 'hi', split: 'type', cps: 60 }),
  lbl('Due diligence still not complete → do not proceed', 5560, 728, 54.7, { size: 19, c: RISK, split: 'type', cps: 60 })
] });

write('beneficial-ownership', {
  id: 'beneficial-ownership', version: 'script-v2', module: 'beneficial-ownership', topic: 'beneficial-ownership',
  title: 'Look through', duration: 60, lang: 'en', seed: 20261114,
  ledger: { path: 'academy/films/beneficial-ownership.script.md', status: 'signed off' },
  law: [{ celex: '32024R1624', arts: ['2', '20', '21', '22', '24', '51', '52', '53', '54', '90'] }],
  alt: 'Animated explainer: an ownership chart for a fictional company. Percentages travel up the chart; a bar meter shows each person against the 25 % line; the arithmetic is written on screen. The captions below the picture carry every word, and a full transcript follows the player.',
  poster: 31,
  camera: [
    { t: 0, x: 1820, y: 860, z: 1.8 }, { t: .4, x: 1820, y: 858, z: 1.76, e: 'lin' }, { t: 5.6, x: 1820, y: 800, z: 1.1, e: 'cam' },
    { t: 6.0, x: 1820, y: 795, z: 1.1, e: 'lin' }, { t: 11.8, x: 1820, y: 770, z: 1.25, e: 'lin' },
    { t: 13.4, x: 2150, y: 600, z: .74, e: 'cam', dip: .1 }, { t: 18.0, x: 2155, y: 600, z: .73, e: 'lin' },
    { t: 19.4, x: 2300, y: 560, z: .8, e: 'cam' }, { t: 26.0, x: 2305, y: 562, z: .81, e: 'lin' },
    { t: 27.2, x: 2300, y: 590, z: .79, e: 'cam', dip: .12 }, { t: 32.0, x: 2300, y: 592, z: .78, e: 'lin' },
    { t: 33.4, x: 1350, y: 620, z: 1.0, e: 'cam', dip: .1 }, { t: 39.0, x: 1340, y: 620, z: 1.02, e: 'lin' },
    { t: 40.2, x: 4560, y: 560, z: .95, e: 'cam', dip: .2 }, { t: 46.0, x: 4565, y: 560, z: .96, e: 'lin' },
    { t: 47.0, x: 6380, y: 580, z: .85, e: 'cam', dip: .2 }, { t: 57.0, x: 6385, y: 580, z: .86, e: 'lin' }, { t: 60, x: 6385, y: 580, z: .84, e: 'outCubic' }
  ],
  dim: [[57, 1], [57.6, .32]],
  chapters: [{ t: 0, n: 'Hook' }, { t: 6, n: 'Who counts' }, { t: 12, n: 'Ownership' }, { t: 18, n: 'Multiply, then add' }, { t: 32, n: 'Control' }, { t: 39, n: 'Verify' }, { t: 46, n: 'What goes wrong' }, { t: 57, n: 'End card' }],
  captions: [
    { t0: 0, t1: 6, text: 'One example scenario: Velmont Analytics, a fictional company, applies for an account at Orrin, a fictional crypto-asset service provider. The pattern to watch, one common example: a stake split up so that no single piece looks big. A warning sign, not proof.' },
    { t0: 6, t1: 12, text: 'A beneficial owner is any natural person who ultimately owns or controls a legal entity. Control by other means is checked in parallel with ownership.' },
    { t0: 12, t1: 18, text: 'Ownership means 25 % or more of the shares, voting rights or other ownership interest, directly or indirectly. Mira holds 30 % directly: she is a beneficial owner.' },
    { t0: 18, t1: 26, text: 'Through a company, multiply along the chain. Kappa Holding owns 40 % of Velmont, and Jonas owns 45 % of Kappa: 45 % of 40 % is 18 %. Elif reaches 14 %, Tom 8 %.' },
    { t0: 26, t1: 32, text: 'Then add his direct and indirect holdings together. Jonas also holds 8 % of Velmont directly: 18 % plus 8 % is 26 %. He is a beneficial owner.' },
    { t0: 32, t1: 39, text: 'Victor holds no shares, but an agreement gives him the right to appoint or remove a majority of the board. That is control by other means: he is a beneficial owner too. On these facts, Elif and Tom are not.' },
    { t0: 39, t1: 46, text: 'Identify all three, take reasonable measures to verify who they are, and consult the central register as well. Differences from the register are, as a rule, reported to it.' },
    { t0: 46, t1: 53, text: 'Common warning signs, not proof: nominees with no explanation, long or circular chains with no business reason, an owner who will not be named. Miss an owner and you miss the sanctions and politically exposed person checks on that person.' },
    { t0: 53, t1: 57, text: 'If no one can be identified after exhausting all possible means, record that, and identify and verify the senior managing officials. If due diligence still cannot be completed, do not proceed.' },
    { t0: 57, t1: 60, text: 'Look through every layer to the natural persons behind it. The AMLR, Regulation (EU) 2024/1624, applies from 10 July 2027.' }
  ],
  headers: [
    { t0: 6.3, t1: 11.7, eyebrow: '01 · WHO COUNTS', lines: ['A natural person. Owns or controls.'], accent: OK },
    { t0: 12.3, t1: 17.6, eyebrow: '02 · OWNERSHIP', lines: ['25 % or more.'], accent: OK },
    { t0: 18.3, t1: 31.6, eyebrow: '03 · MULTIPLY, THEN ADD', lines: ['Multiply along. Add across.'], accent: .5 },
    { t0: 32.3, t1: 38.6, eyebrow: '04 · CONTROL', lines: ['No shares. Still in charge.'], accent: OK },
    { t0: 39.3, t1: 45.6, eyebrow: '05 · VERIFY', lines: ['The register is a check, not the answer.'], accent: OK },
    { t0: 46.3, t1: 56.6, eyebrow: 'WHAT GOES WRONG', lines: ['A missed owner is a missed check.'], accent: RISK }
  ],
  hud: { t0: .8, t1: 56.8, label: 'FICTIONAL EXAMPLE', value: 'Velmont Analytics', temp: [[0, 0], [15, .3], [29.5, .65], [36.2, 1], [46.2, 1], [46.8, .1]] },
  end: { t0: 57.1, lines: ['Look through every layer.', 'Find the natural persons.'], tint: { line: 1, from: 2 }, footers: ['AMLR · Regulation (EU) 2024/1624 · applies from 10 July 2027', 'Fictional example. Not legal advice.'] },
  sounds: [
    { t: 1.0, k: 'low' }, { t: 7.2, k: 'light', i: 0 }, { t: 7.25, k: 'light', i: 1 },
    { t: 14.5, k: 'tock', i: 0 }, { t: 15.2, k: 'light', i: 2 }, ...[20.6, 23.0, 25.0, 27.9].map((t, i) => ({ t, k: 'tick', i })),
    { t: 28.9, k: 'light', i: 0 }, { t: 29.2, k: 'light', i: 2 }, ...[34.4, 34.7, 35.0].map((t, i) => ({ t, k: 'light', i })), { t: 35.9, k: 'low' },
    ...[40.6, 41.0, 41.4].map((t, i) => ({ t, k: 'tick', i })), { t: 42.6, k: 'low' }, { t: 44.0, k: 'light', i: 1 }, { t: 47.4, k: 'low' }
  ],
  stills: [
    { t: 4.2, h: 'Who is behind it?', cap: 'Velmont Analytics, a fictional company, applies to Orrin, a fictional crypto-asset service provider.' },
    { t: 16.4, h: 'Ownership', cap: 'Mira holds 30 % directly: 25 % or more makes her a beneficial owner.' },
    { t: 24.6, h: 'Multiply', cap: 'Through Kappa Holding: 45 % × 40 % = 18 % for Jonas.' },
    { t: 31.2, h: 'Then add', cap: 'Jonas: 18 % plus 8 % directly = 26 %.' },
    { t: 37.6, h: 'Control', cap: 'Victor holds no shares but can appoint or remove a majority of the board.' },
    { t: 44.6, h: 'Verify', cap: 'Take reasonable measures to verify all three; consult the register and, as a rule, report differences.' },
    { t: 52.4, h: 'What goes wrong', cap: 'Nominees, circular chains, an owner who will not be named.' },
    { t: 60, h: 'Look through every layer', cap: 'The AMLR applies from 10 July 2027.' }
  ],
  elements: E
});
