// Authoring helper for film 02 (Effort follows risk). Writes the scene data
// docs/data/academy/films/aml-basics.json, which is what the page loads and
// what tests/films.test.mjs checks. Every string here must be in the claim
// ledger of academy/films/aml-basics.script.md. Run: node academy/films/src/aml-basics.mjs
import { write } from './lib.mjs';

const RISK = 'warm', OK = 'cool';
const E = [];

/* S1 · Hook: a prepaid card in line art crosses a dashed border */
E.push({ type: 'art', t0: .5, dur: 1.2, dash: [10, 9], c: 't3', lw: 2, polys: [[[560, 220], [540, 320], [575, 420], [548, 520], [570, 620]]] });
E.push({ type: 'glow', x: 720, y: 400, r: 320, c: RISK, ga: [[2.6, 0], [3.6, .16], [12, .16], [13, 0]] });
E.push({ type: 'group', x: 400, y: 400, t0: .2, t1: 5.4, mv: [{ t: 1.5, d: 1.6, x: 720 }], items: [
  { type: 'art', t0: .3, dur: 1.3, c: 'hi', lw: 2.2, glw: 10, polys: [
    ['Z', [-150, -95], [150, -95], [150, 95], [-150, 95]],
    ['Z', [-112, -44], [-62, -44], [-62, -4], [-112, -4]],
    [[-112, 40], [60, 40]], [[-112, 64], [10, 64]], [[96, -70], [126, -70]]] }
] });
E.push({ type: 'text', screen: true, s: 'New card. New country. New risks?', x: 800, y: 760, size: 56, align: 'center', t0: .7, t1: 4.6, st: .1, tint: { i: [5], c: RISK } });
E.push({ type: 'text', screen: true, s: 'Brindle Pay · fictional payment and e-money firm', x: 800, y: 818, size: 22, mono: true, c: 't2', align: 'center', t0: 1.6, t1: 4.6, split: 'char', st: .012, track: 1, lod: 1 });

/* S2 · Four habits, not a sequence */
const HX = [-510, -170, 170, 510];
const habit = (i, title, extra) => Object.assign({ type: 'card', x: HX[i], y: 0, w: 300, h: 220, r: 16, emph: true, ts: 54, title, enter: 'deal', t0: 5.5 + i * .12, c: 't3', cs: .8 }, extra);
const keepLines = [8.1, 9.6, 11.3, 12.5, 13.1].map((tt, i) => ({ type: 'art', t0: tt, dur: .35, c: OK, lw: 2, ca: .8, polys: [[[400, 66 + i * 9], [400 + 170 - (i % 2) * 40, 58 + i * 9]]] }));
E.push({ type: 'group', x: 2100, y: 520, t0: 5.3, t1: 26.8, mv: [{ t: 13.0, d: 1.3, x: 2250, y: 560, s: .2 }], a: [[13, 1], [14, .55]], items: [
  { type: 'orbit', x: HX[0], y: 0, rx: 186, ry: 140, period: 2.6, t0: 6.6, t1: 13.0, c: OK },
  { type: 'orbit', x: HX[1], y: 0, rx: 186, ry: 140, period: 3.1, phase: 1.7, t0: 6.9, t1: 13.0, c: OK },
  habit(0, 'KNOW the customer', { c: OK, cs: .7 }),
  habit(1, 'WATCH what they do', { c: OK, cs: .7 }),
  habit(2, 'REPORT suspicions → FIU', { c: RISK, cs: [[0, 0], [10.1, 0], [10.3, .95], [11.6, .25]], pulses: [10.25] }),
  habit(3, 'KEEP the records', { c: OK, cs: .35 }),
  { type: 'glow', x: 150, y: -165, r: 70, c: RISK, ga: .5, t0: 9.7, t1: 10.9 },
  { type: 'circle', x: 150, y: -165, r: 7, c: RISK, fill: 1, lw: 0, t0: 9.7, t1: 10.9, pulses: [9.75] },
  { type: 'flow', from: [-450, -100], to: [430, -100], bend: -.16, t0: 7.3, dur: .8, c: OK, lw: 2 },
  { type: 'flow', from: [-150, -100], to: [430, -100], bend: -.2, t0: 8.8, dur: .8, c: OK, lw: 2 },
  { type: 'flow', from: [150, -100], to: [440, -100], bend: -.3, t0: 10.5, dur: .8, c: RISK, lw: 2 },
  { type: 'flow', from: [-450, -100], to: [430, -100], bend: -.16, t0: 12.4 - .7, dur: .8, c: OK, lw: 2 },
  { type: 'flow', from: [-150, -100], to: [430, -100], bend: -.2, t0: 12.3, dur: .8, c: OK, lw: 2 },
  ...keepLines
] });

/* S3 · The business-wide risk assessment (radar + document card), moves to an inset later */
const docCard = { type: 'card', x: 650, y: 0, w: 640, h: 300, r: 14, t0: 20.4, enter: 'rise', ed: 120, valign: 'top', tmono: true, ts: 20, tw: 700, tc: OK, lmono: true, ls: 18, lh: 1.5, c: OK, cs: .6,
  title: 'BUSINESS-WIDE RISK ASSESSMENT',
  lines: [{ s: 'Drawn up by: compliance officer', tt: 21.0, gap: 8 }, { s: 'Approved by: management body (management function)', tt: 21.9, gap: 8 }, { s: 'Documented · kept up to date · regularly reviewed · available to supervisors on request', tt: 22.7 }], cps: 64 };
E.push({ type: 'group', x: 2250, y: 560, t0: 13.2, t1: 54.8, fin: .3,
  mv: [{ t: 27.0, d: 1.6, x: 3429, y: 579, s: .28 }, { t: 46.0, d: .7, x: 5522, y: 560 }], a: [[46, 1], [46.7, .6]], items: [
  { type: 'radar', r: 330, t0: 13.4, ls: 16, la: [[26.8, 1], [27.6, 0]],
    spokes: ['ACTIVITIES', 'PRODUCTS', 'TRANSACTIONS', 'DELIVERY CHANNELS', 'CUSTOMERS', 'GEOGRAPHICAL ZONES'],
    sweep: { t0: 13.8, period: 2.4, stop: 20.2, hold: -0.5236 },
    blips: [
      { k: 0, d: .45, c: .85 }, { k: 2, d: .7, c: .85 }, { k: 3, d: .5, c: .85 }, { k: 4, d: .58, c: .85 },
      { k: 1, d: .62, big: true, s: 'Prepaid card', c: [[0, 0], [20.6, 0], [21.6, .3]], after: 15.0 },
      { k: 5, d: .6, big: true, s: 'New country', lx: -16, la: 'right', c: [[0, 0], [20.6, 0], [21.6, .3]], after: 15.0 }] },
  docCard,
  { type: 'stamp', x: 880, y: -118, s: 'BEFORE LAUNCH', t0: 24.0, rot: -8, c: RISK, size: 24 },
  { type: 'circle', x: 0, y: 450, r: 60, c: OK, lw: 6, a0: -1.6, a1: 3.6, dur: .7, t0: 43.4, arrow: true, t1: 45.8 }
] });

/* S4 · Effort follows risk: two customers, a dial, check blocks */
const blk = (x, y, h, title, t0, c, cs, extra) => Object.assign({ type: 'card', x, y, w: 400, h, r: 8, title, ts: h > 40 ? 18 : 15, tw: 600, center: true, t0, enter: 'rise', ed: 24, c, cs, pad: 10 }, extra);
E.push({ type: 'group', t0: 27.6, t1: 46.2, a: [[40.2, 1], [40.8, .45]], items: [
  { type: 'dial', x: 4180, y: 360, w: 760, t0: 28.0, left: 'LOWER RISK · may simplify', right: 'INCREASED RISK · enhanced measures', ls: 16,
    needles: [{ v: -.45, t: 30.4 }, { v: .55, t: 31.0 }] },
  { type: 'text', s: "Rating: Brindle Pay's own analysis in this example", x: 4180, y: 455, size: 16, mono: true, c: 't3', align: 'center', split: 'none', t0: 31.6, lod: 1 },
  { type: 'edge', from: [3530, 560], to: [3712, 540], bend: -.2, t0: 29.6, dur: .6, c: OK, ca: .55, lw: 1.4 },
  { type: 'edge', from: [3530, 590], to: [4214, 610], bend: .12, t0: 29.8, dur: .8, c: OK, ca: .55, lw: 1.4 },
  { type: 'card', x: 3930, y: 560, w: 440, h: 150, t0: 28.6, enter: 'drop', title: 'Customer A · fictional', ts: 21, lines: ['Salaried · small top-ups from own bank account'], c: OK, cs: .6 },
  { type: 'card', x: 4430, y: 560, w: 440, h: 150, t0: 28.9, enter: 'drop', title: 'Customer B · fictional', ts: 21, lines: ['Company set up last month · asks for high limits · funds from several countries'], c: RISK, cs: .7 },
  blk(3930, 668, 34, 'Due diligence', 34.2, OK, .3, { ba: .45, fa: .7 }),
  blk(3930, 710, 34, 'Monitoring', 34.4, OK, [[0, .3], [36.9, .3], [37.1, .9], [38.2, .4]], { ba: .45, fa: .7, pulses: [37.0] }),
  blk(4430, 676, 52, 'Due diligence', 34.3, OK, .7),
  blk(4430, 736, 52, 'Monitoring', 34.5, OK, .7),
  blk(4430, 796, 52, 'Source of funds', 35.4, RISK, .9),
  blk(4430, 856, 52, 'Senior management approval', 35.8, RISK, .9),
  blk(4430, 916, 52, 'Closer monitoring', 36.2, RISK, .9),
  { type: 'text', s: 'still enough to spot the unusual', x: 3930, y: 770, size: 17, mono: true, c: OK, align: 'center', t0: 37.0, split: 'char', st: .015 }
] });

/* S5 · Show why: the decision record */
const rec = (y, s, tt) => ({ type: 'card', x: 4120, y, w: 860, h: 46, r: 8, t0: tt - .3, lines: [{ s, tt }], lmono: true, ls: 18, pad: 18, c: OK, cs: .5 });
E.push({ type: 'group', t0: 40.2, t1: 46.0, items: [
  rec(990, 'A · lower · reasons · date · who decided', 40.6),
  rec(1045, 'B · higher · reasons · date · who decided', 41.6),
  { type: 'circle', x: 4592, y: 990, r: 15, c: OK, lw: 2.4, a0: -1.6, a1: 3.6, dur: .6, t0: 42.8, arrow: true },
  { type: 'circle', x: 4592, y: 1045, r: 15, c: OK, lw: 2.4, a0: -1.6, a1: 3.6, dur: .6, t0: 43.0, arrow: true },
  { type: 'text', s: 'review regularly · and when things change', x: 4120, y: 1102, size: 18, mono: true, c: OK, align: 'center', t0: 43.2, split: 'char', st: .014 }
] });

/* S6 · What goes wrong: the card launches with no fresh assessment */
const cardsAt = [[6200, 420], [6380, 380], [6560, 430], [6260, 560], [6450, 590], [6620, 560]];
const map = [];
map.push({ type: 'art', t0: 46.4, dur: 1.0, c: 'cgrey', lw: 2, ca: .7, polys: [['Z', [6040, 300], [6260, 250], [6480, 285], [6700, 260], [6790, 420], [6730, 610], [6560, 720], [6300, 700], [6090, 650], [6000, 480]]] });
map.push({ type: 'glow', x: 6380, y: 490, r: 420, c: RISK, ga: [[46.5, 0], [47.6, .13]] });
const srcs = [[5860, 250], [5900, 760], [6380, 120], [6900, 160], [6100, 900], [5820, 500], [6650, 900], [6250, 120]];
let si = 0;
cardsAt.forEach(([x, y], i) => {
  const arrive = 47.0 + i * .18;
  for (let k = 0; k < 3; k++) {
    const s = srcs[si++ % srcs.length];
    map.push({ type: 'flow', from: s, to: [x, y], bend: (k - 1) * .18, t0: arrive - .75 + k * .12, dur: .75, c: RISK, lw: 2.2 });
  }
  map.push({ type: 'card', x, y, w: 58, h: 38, r: 6, t0: 46.6 + i * .08, enter: 'pop', c: RISK, cs: [[0, .2], [arrive, .2], [arrive + .3, .95]], pulses: [arrive + .1] });
  map.push({ type: 'flow', from: [x + 30, y], to: [7040, 470 + i * 12], bend: (i % 2 ? .08 : -.08), t0: 48.1 + i * .1, dur: .8, c: RISK, lw: 2.6, trace: .3 });
});
map.push({ type: 'text', s: 'abroad', x: 7050, y: 450, size: 20, mono: true, c: RISK, align: 'right', t0: 48.0, split: 'char', st: .03 });
map.push({ type: 'text', s: 'many payers in · out abroad the same day', x: 6380, y: 826, size: 20, mono: true, c: RISK, align: 'center', t0: 47.6, split: 'char', st: .01 });
map.push({ type: 'text', s: 'one example · commonly linked to money mules · not proof', x: 6380, y: 866, size: 17, mono: true, c: 't2', align: 'center', t0: 48.4, split: 'char', st: .008 });
E.push({ type: 'group', t0: 46.3, t1: 55.0, a: [[50, 1], [50.6, .22]], items: map });
E.push({ type: 'text', s: 'Last reviewed: before the plan changed', x: 5522, y: 692, size: 18, mono: true, c: RISK, align: 'center', maxW: 330, t0: 46.9, t1: 54.8, split: 'type', cps: 34 });
const chip = (y, s, t0) => ({ type: 'card', x: 6260, y, w: 620, h: 52, r: 26, title: s, ts: 20, tw: 600, t0, enter: 'slide', ed: -60, c: RISK, cs: .9, bar: false, pad: 26 });
E.push({ type: 'group', t0: 50.0, t1: 54.9, items: [
  { type: 'text', s: 'COMMON WARNING SIGNS', x: 5950, y: 336, size: 18, mono: true, w: 600, c: RISK, t0: 50.1, split: 'char', st: .02, track: 3 },
  chip(400, 'Assessment nobody updates', 50.3),
  chip(470, 'Nearly every customer on the same rating', 50.55),
  chip(540, 'Management body never saw it', 50.8),
  { type: 'art', t0: 51.6, dur: .5, c: 't3', lw: 1.2, polys: [[[5950, 604], [6640, 604]]] },
  { type: 'text', s: 'Controls that do not fit the risks → administrative measures', x: 5950, y: 648, size: 20, mono: true, c: 'cgrey', t0: 51.8, split: 'none', maxW: 760 },
  { type: 'text', s: 'Serious, repeated or systematic breaches → fines', x: 5950, y: 690, size: 20, mono: true, c: 'cgrey', t0: 52.5, split: 'none', maxW: 760 }
] });

write('aml-basics', {
  id: 'aml-basics', version: 'script-v2', module: 'aml-basics', topic: 'risk-based-approach',
  title: 'Effort follows risk', duration: 58, lang: 'en', seed: 20261112,
  ledger: { path: 'academy/films/aml-basics.script.md', status: 'signed off' },
  law: [{ celex: '32024R1624', arts: ['2', '10', '19', '20', '21', '26', '33', '34', '69', '77', '90'] }, { celex: '32024L1640', arts: ['55', '56'] }],
  alt: 'Animated explainer: a fictional firm assesses its own risks before launching a card in a new country, sizes each customer\'s checks to the risk and records why. The captions below the picture carry every word, and a full transcript follows the player.',
  poster: 38,
  camera: [
    { t: 0, x: 470, y: 420, z: 1.7 }, { t: 1.2, x: 480, y: 420, z: 1.62, e: 'lin' }, { t: 4.6, x: 600, y: 440, z: 1.2, e: 'cam' },
    { t: 5.0, x: 610, y: 440, z: 1.18, e: 'lin' }, { t: 6.3, x: 2100, y: 500, z: 1.0, e: 'cam', dip: .2 }, { t: 13.0, x: 2120, y: 505, z: .97, e: 'lin' },
    { t: 14.4, x: 2180, y: 520, z: .85, e: 'cam', dip: .18 }, { t: 20.0, x: 2200, y: 525, z: .83, e: 'lin' },
    { t: 21.4, x: 2560, y: 540, z: .85, e: 'cam' }, { t: 27.0, x: 2580, y: 540, z: .84, e: 'lin' },
    { t: 28.6, x: 4000, y: 560, z: 1.05, e: 'cam', dip: .2 }, { t: 40.0, x: 4010, y: 565, z: 1.07, e: 'lin' },
    { t: 41.5, x: 4000, y: 760, z: 1.2, e: 'cam' }, { t: 46.0, x: 4010, y: 762, z: 1.22, e: 'lin' },
    { t: 46.7, x: 6200, y: 520, z: .9, e: 'cam', dip: .22 }, { t: 55.0, x: 6215, y: 520, z: .88, e: 'lin' }, { t: 58, x: 6215, y: 520, z: .86, e: 'outCubic' }
  ],
  dim: [[55, 1], [55.6, .32]],
  chapters: [{ t: 0, n: 'Hook' }, { t: 5, n: 'Four habits' }, { t: 13, n: 'Your own risks' }, { t: 27, n: 'Effort follows risk' }, { t: 40, n: 'Show why' }, { t: 46, n: 'What goes wrong' }, { t: 55, n: 'End card' }],
  captions: [
    { t0: 0, t1: 5, text: 'One example scenario: Brindle Pay, a fictional payment and e-money firm, takes its prepaid card to a new country. The situation: a known product in a new market.' },
    { t0: 5, t1: 13, text: 'A common way to teach the everyday duties is four habits: know your customer, watch what they do, report suspicions to the Financial Intelligence Unit, and keep the records. They are not steps done once, in order: each can be needed at any point in the relationship.' },
    { t0: 13, t1: 20, text: "Underneath sits the firm's own business-wide risk assessment: the risks in its activities, products, transactions, delivery channels, customers and geographical zones." },
    { t0: 20, t1: 27, text: 'Before a new product goes live, or an existing one reaches a new country, the firm identifies and assesses the risks and takes measures to manage them. The compliance officer draws up the assessment; the management body in its management function approves it.' },
    { t0: 27, t1: 34, text: 'Then effort follows risk. How far due diligence goes for each customer rests on an individual risk analysis that takes that assessment into account. Lower risk: the firm may simplify. Increased risk: enhanced measures apply.' },
    { t0: 34, t1: 40, text: 'In this example, Customer B is rated higher and gets more: questions on the source of funds, senior management approval, closer monitoring. Customer A gets less, but monitoring must still be enough to spot unusual transactions.' },
    { t0: 40, t1: 46, text: 'The firm must at all times be able to show its supervisor that its measures fit the risks. So each decision is recorded with its reasons, and reviewed regularly and when circumstances change.' },
    { t0: 46, t1: 50, text: 'What goes wrong, in this example: the card launches with no fresh assessment. New cards are loaded by many different payers and emptied abroad the same day: a pattern commonly linked to money mules. A warning sign to examine, not proof.' },
    { t0: 50, t1: 55, text: 'Common warning signs: an assessment nobody updates, nearly every customer on the same rating, a management body that never saw it. Controls that do not fit the risks can lead to administrative measures by the supervisor, and serious, repeated or systematic breaches to fines.' },
    { t0: 55, t1: 58, text: 'Effort follows risk, and you can show why. In the EU, the main rules for firms are in the AMLR, Regulation (EU) 2024/1624, which applies from 10 July 2027.' }
  ],
  headers: [
    { t0: 5.3, t1: 12.5, eyebrow: 'A COMMON WAY TO TEACH IT', lines: ['Four habits. Not a sequence.'], accent: OK },
    { t0: 13.4, t1: 26.6, eyebrow: '01 · YOUR OWN RISKS', lines: ['Know your own risks.'], accent: OK },
    { t0: 27.4, t1: 39.6, eyebrow: '02 · EFFORT FOLLOWS RISK', lines: ['More risk, more checks.'], accent: .5 },
    { t0: 40.3, t1: 45.7, eyebrow: '03 · SHOW WHY', lines: ['Write down why.'], accent: OK },
    { t0: 46.3, t1: 54.6, eyebrow: 'WHAT GOES WRONG', lines: ['When the risk moves, the paperwork must too.'], accent: RISK }
  ],
  hud: { t0: .8, t1: 54.8, label: 'FICTIONAL EXAMPLE', value: 'Brindle Pay', temp: [[0, 0], [1, 0], [13, .35], [24, .9], [46.6, .9], [47.6, 0]] },
  end: { t0: 55.1, lines: ['Effort follows risk.', 'Show why.'], tint: { line: 1, from: 1 }, footers: ['AMLR · Regulation (EU) 2024/1624 · applies from 10 July 2027', 'Fictional example. Not legal advice.'] },
  sounds: [
    ...[5.5, 5.62, 5.74, 5.86].map((t, i) => ({ t, k: 'tock', i })), { t: 10.25, k: 'light', i: 0 },
    { t: 24.0, k: 'thud' }, { t: 16.0, k: 'light', i: 1 }, { t: 17.4, k: 'light', i: 2 },
    ...[34.2, 34.4, 34.3, 34.5].map((t, i) => ({ t, k: 'tick', i })), { t: 35.4, k: 'low' },
    { t: 42.8, k: 'light', i: 1 }, ...[47.0, 47.2, 47.4, 47.6, 47.8].map((t, i) => ({ t, k: 'tick', i })),
    ...[48.9, 49.1, 49.3].map((t, i) => ({ t, k: 'tock', i })), { t: 50.3, k: 'low' }
  ],
  stills: [
    { t: 3, h: 'New card, new country', cap: 'Brindle Pay, a fictional payment and e-money firm, takes its prepaid card to a new country.' },
    { t: 10, h: 'Four habits', cap: 'Know, watch, report, keep: a common way to teach the everyday duties. Not a sequence: each can be needed at any point.' },
    { t: 24.5, h: 'Your own risks', cap: 'The business-wide risk assessment, drawn up by the compliance officer and approved by the management body in its management function.' },
    { t: 38, h: 'Effort follows risk', cap: 'More checks for the customer rated higher; enough monitoring for both.' },
    { t: 44, h: 'Show why', cap: 'Each decision recorded with its reasons, reviewed regularly and when circumstances change.' },
    { t: 49.4, h: 'What goes wrong', cap: 'Many payers in, out abroad the same day: one pattern commonly linked to money mules, not proof.' },
    { t: 58, h: 'Effort follows risk. Show why.', cap: 'The AMLR applies from 10 July 2027.' }
  ],
  elements: E
});
