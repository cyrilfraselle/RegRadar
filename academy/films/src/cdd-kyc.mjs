// Authoring helper for film 03 (Know who, know why). Writes
// docs/data/academy/films/cdd-kyc.json. Every string must be in the claim ledger of
// academy/films/cdd-kyc.script.md. Run: node academy/films/src/cdd-kyc.mjs
import { write } from './lib.mjs';

const RISK = 'warm', OK = 'cool';
const E = [];
const coolAt = (tc) => [[0, 0], [tc, 0], [tc + .45, 1]];

/* S1 · Hook: a half-filled form, a chat bubble, the locked button */
E.push({ type: 'card', x: 1400, y: 440, w: 300, h: 360, r: 14, t0: .8, t1: 6.6, enter: 'slide', ed: -80, c: 't3', items: [
  { type: 'art', t0: 1.1, dur: 1, c: 't3', lw: 6, ca: .45, polys: [[[-110, -130], [60, -130]], [[-110, -80], [90, -80]], [[-110, -30], [20, -30]], [[-110, 20], [40, 20]]] },
  { type: 'art', t0: 1.6, dur: .8, c: 't3', lw: 1.4, ca: .5, polys: [['Z', [-110, 60], [110, 60], [110, 92], [-110, 92]], ['Z', [-110, 112], [110, 112], [110, 144], [-110, 144]]] }] });
E.push({ type: 'card', x: 2560, y: 290, w: 480, h: 92, r: 24, t0: 1.0, t1: 6.4, enter: 'pop', c: RISK, cs: .5 });
E.push({ type: 'text', s: 'Can we send €48,000 today?', x: 2350, y: 299, size: 26, w: 600, c: 'hi', split: 'type', cps: 24, t0: 1.3, t1: 6.4 });
E.push({ type: 'text', screen: true, s: 'Before money moves,', x: 800, y: 160, size: 58, align: 'center', plate: true, t0: 2.6, t1: 5.7, st: .09 });
E.push({ type: 'text', screen: true, s: 'know who is moving it.', x: 800, y: 236, size: 58, align: 'center', plate: true, t0: 3.0, t1: 5.7, st: .09 });

/* The customer file: blocks warm (open) to cool (checked) */
const BY = [-185, -125, -65, -5, 55];
const blk = (i, title, t0, c) => ({ type: 'card', x: 0, y: BY[i], w: 440, h: 50, r: 8, title, ts: 16, tw: 600, pad: 16, t0, enter: 'rise', ed: 20, c, cs: .9 });
const icons = [
  [['Z', [-30, -20], [30, -20], [30, 20], [-30, 20]], [[-18, -4], [-6, -4]], [[6, -8], [22, -8]], [[6, 2], [22, 2]], [[6, 10], [16, 10]]],
  [['Z', [-22, -26], [22, -26], [22, 26], [-22, 26]], [[-12, -12], [12, -12]], [[-12, -2], [12, -2]], [[-12, 8], [6, 8]]],
  [[[-24, -16], [24, -16]], [[-24, -4], [24, -4]], [[-24, 8], [24, 8]], [[-24, 20], [10, 20]]],
  [[[-24, -16], [24, -16]], [[-24, -4], [24, -4]], [[-24, 8], [24, 8]], ['Z', [-30, -26], [30, -26], [30, 28], [-30, 28]]],
  [['Z', [-22, -26], [22, -26], [22, 26], [-22, 26]], [[-12, -12], [12, -12]], [[-14, 12], [-6, 4], [2, 14], [10, 6], [14, 12]]]
];
const coolT = [15.0, null, 16.6, 17.6, 18.8];
const fileItems = [
  { type: 'card', x: 0, y: 0, w: 500, h: 620, r: 18, title: 'Larkmoor Trading', ts: 22, valign: 'top', pad: 26, t0: 2.2, c: [[0, 0], [24, 0], [26, .5]], cs: .55 },
  { type: 'text', s: 'ALL MEASURES APPLY · MAIN ONES SHOWN', x: -224, y: -236, size: 15, mono: true, w: 600, c: 't2', t0: 13.4, split: 'char', st: .012, track: 1.5 },
  blk(0, 'Identify and verify the customer', 13.6, coolAt(15.0)),
  blk(1, 'Identify and verify the beneficial owners · understand the structure', 13.9, [[0, 0]]),
  blk(2, 'Sanctions check', 14.2, coolAt(16.6)),
  blk(3, 'Politically exposed person check', 14.5, coolAt(17.6)),
  blk(4, 'Who acts for the company · identified · authorised?', 14.8, coolAt(18.8)),
  Object.assign(blk(0, 'Ongoing monitoring', 25.4, .8), { y: 115 }),
  { type: 'circle', x: 196, y: 115, r: 11, c: OK, lw: 2, a0: -1.6, a1: 3.6, dur: .6, t0: 25.8, arrow: true },
  { type: 'text', s: '?', x: 234, y: -112, size: 34, w: 800, c: RISK, align: 'center', split: 'none', t0: 15.6, t1: 35.2 },
  { type: 'glow', x: 0, y: -125, r: 260, c: RISK, ga: [[34, 0], [35.4, .22], [37, .1]], t0: 34 }
];
icons.forEach((polys, i) => {
  fileItems.push({ type: 'art', x: -430, y: BY[i], t0: 13.5 + i * .15, t1: 27.0, dur: .6, c: 't2', lw: 1.8, polys });
  if (coolT[i]) fileItems.push({ type: 'flow', from: [-392, BY[i]], to: [-226, BY[i]], bend: -.25, t0: coolT[i] - .7, dur: .7, c: OK, lw: 2.2 });
});
fileItems.push({ type: 'flow', from: [-392, BY[1]], to: [-226, BY[1]], bend: -.25, t0: 15.6, dur: .7, c: RISK, lw: 2.2 });
const slideOut = [{ t: 42.0, d: 1.2, x: 1400 }];
E.push({ type: 'group', x: 2000, y: 600, t0: 1.6, t1: 48.6, mv: slideOut, a: [[37.3, 1], [37.9, .3], [42, .3], [43, .25]], items: fileItems });

/* the button and the account card sit outside the dimmed file */
E.push({ type: 'group', x: 2000, y: 600, t0: 3.0, t1: 48.6, mv: slideOut, a: [[42, 1], [43, .25]], items: [
  { type: 'card', x: 0, y: 235, w: 300, h: 56, r: 28, title: 'Send €48,000', ts: 20, center: true, pad: 16, t0: 3.2, enter: 'pop', c: RISK, cs: .9, a: [[38.9, 1], [39.5, .35]] },
  { type: 'art', x: 122, y: 235, t0: 3.5, dur: .5, c: RISK, lw: 2, polys: [['Z', [-9, -2], [9, -2], [9, 12], [-9, 12]], [[-6, -2], [-6, -8], [0, -13], [6, -8], [6, -2]]], t1: 30.2 },
  { type: 'group', x: 178, y: 228, t0: 30.2, enter: 'drop', ed: 50, items: [
    { type: 'art', t0: 30.2, dur: .4, c: OK, lw: 3, polys: [['Z', [-16, -2], [16, -2], [16, 22], [-16, 22]], [[-10, -2], [-10, -12], [0, -20], [10, -12], [10, -2]]] },
    { type: 'text', s: 'safeguards', x: 26, y: 14, size: 17, mono: true, c: OK, t0: 30.5, split: 'char', st: .02 }] },
  { type: 'card', x: -420, y: 235, w: 210, h: 56, r: 10, title: 'Account open', ts: 18, center: true, pad: 12, t0: 30.6, enter: 'pop', c: OK, cs: .7, pulses: [30.8, 38.9],
    swap: [{ t: 38.9, title: 'Account closed' }] },
  { type: 'card', x: -420, y: 235, w: 210, h: 56, r: 10, t0: 38.9, fin: .3, c: RISK, cs: .9, fa: 0, bw: 2 }
] });
E.push({ type: 'text', s: 'no transactions until customer and beneficial owners are identified and verified', x: 2000, y: 960, size: 18, mono: true, c: OK, align: 'center', t0: 31.0, t1: 34.4, split: 'char', st: .008, maxW: 980 });

/* S2 · When it applies */
const tile = (y, h, title, t0, extra) => Object.assign({ type: 'card', x: 1100, y, w: 660, h, r: 12, title, ts: 21, tw: 600, pad: 22, t0, t1: 13.0, enter: 'slide', ed: -60, c: 't3' }, extra);
E.push(tile(330, 80, 'A business relationship starts', 6.4, { c: [[0, 0], [7.2, 0], [7.5, 1]], cs: .9, pulses: [7.3] }));
E.push(tile(455, 128, 'Occasional transaction from EUR 10 000 · single or linked · lower for some firms', 6.6, { lines: [{ s: 'e.g. EUR 1 000 for some firms and transactions · Art. 19(2), (3)', mono: true, size: 15, c: 't2' }] }));
E.push(tile(585, 80, 'Any suspicion · whatever the amount', 6.8));
E.push(tile(695, 80, 'Doubts about the data, or about who you are dealing with', 7.0));
E.push({ type: 'check', x: 1394, y: 330, size: 22, t0: 7.4, c: OK, t1: 13.0 });
E.push({ type: 'text', s: 'applies here', x: 1452, y: 337, size: 18, mono: true, c: OK, t0: 7.5, t1: 13.0, split: 'char', st: .02 });

/* S3 · understand the business: the profile card */
const pl = ['Business: phone accessories wholesale', 'Why this account: pay suppliers, receive from retailers', 'Expected: about €60,000 a month', 'Money from: retailers in the EU', 'Money to: suppliers abroad'];
E.push({ type: 'card', x: 2550, y: 470, w: 480, h: 310, r: 14, t0: 21.0, t1: 27.2, enter: 'slide', ed: -90, valign: 'top', pad: 26, cps: 60, ls: 18, lh: 1.55, c: OK, cs: .5,
  lines: pl.map((s, i) => ({ s, tt: 21.3 + i * .55, gap: 6 })) });

/* S4 · the dial (from film 02), this example */
E.push({ type: 'dial', x: 2650, y: 380, w: 440, t0: 27.8, t1: 34.2, needles: [{ v: .45, t: 29.0, label: 'this example' }] });

/* S5 · cannot finish */
E.push({ type: 'card', x: 2420, y: 400, w: 360, h: 120, r: 12, t0: 35.3, t1: 37.6, enter: 'slide', ed: -40, c: RISK, cs: .9, lmono: true, ls: 19, pad: 20,
  lines: [{ s: 'Owner: "a holding company abroad". Names: refused.', c: RISK, tt: 35.4 }], cps: 62 });
const outc = (x, title, t0, extra) => Object.assign({ type: 'card', x, y: 470, w: 460, h: 120, r: 14, title, ts: 21, tw: 650, center: true, pad: 22, t0, t1: 42.0, enter: 'drop', c: 't3', cs: .8 }, extra);
E.push(outc(1640, 'Do not start · do not run the transaction', 37.4));
E.push(outc(2150, 'End any existing relationship', 37.7, { c: [[0, 0]], cs: [[0, 0], [38.5, 0], [38.8, .95]], pulses: [38.6] }));
E.push(outc(2660, 'Consider a report to the FIU', 38.0));
E.push({ type: 'text', s: 'this example: close the account', x: 2150, y: 568, size: 19, mono: true, c: RISK, align: 'center', t0: 38.6, t1: 42.0, split: 'char', st: .015 });
E.push({ type: 'card', x: 2150, y: 660, w: 1480, h: 50, r: 10, t0: 39.2, t1: 42.0, enter: 'rise', ed: 16, c: OK, cs: .5, lmono: true, ls: 19, pad: 22, center: true, cps: 40,
  lines: [{ s: 'Record the decision and why', tt: 39.4 }] });

/* S6 · keep it current */
const fileArt = { type: 'art', dur: .6, c: 't3', lw: 5, ca: .4, polys: [[[-100, -120], [40, -120]], [[-100, -70], [90, -70]], [[-100, -20], [60, -20]], [[-100, 30], [80, 30]], [[-100, 80], [20, 80]]] };
[[2250, 42.4, [45.4]], [2700, 42.6, []], [3150, 42.8, [46.9]]].forEach(([x, t0, pulses]) => {
  E.push({ type: 'card', x, y: 470, w: 300, h: 380, r: 16, t0, t1: 56.0, enter: 'slide', ed: 260, c: OK, cs: [[0, .35], ...pulses.flatMap((p) => [[p, .35], [p + .2, 1], [p + 1.2, .35]])], pulses, a: [[48, 1], [48.6, .15]],
    items: [Object.assign({}, fileArt, { t0: t0 + .3 })] });
});
E.push({ type: 'group', t0: 42.8, t1: 48.4, items: [
  { type: 'art', t0: 43.0, dur: .8, c: 't3', lw: 2, polys: [[[2000, 780], [3400, 780]], ...Array.from({ length: 15 }, (_, i) => [[2000 + i * 100, 772], [2000 + i * 100, 788]])], stg: .2 },
  { type: 'circle', x: 2280, y: 780, r: 8, c: RISK, fill: 1, lw: 0, t0: 43.6 },
  { type: 'text', s: 'higher-risk customers: at least every year', x: 2000, y: 832, size: 18, mono: true, c: 't2', t0: 43.6, split: 'char', st: .01 },
  { type: 'circle', x: 3400, y: 780, r: 8, c: OK, fill: 1, lw: 0, t0: 44.1 },
  { type: 'text', s: 'all others: at least every 5 years', x: 3400, y: 872, size: 18, mono: true, c: 't2', align: 'right', t0: 44.1, split: 'char', st: .01 },
  { type: 'circle', x: 2560, y: 780, r: 9, c: OK, fill: .9, lw: 0, t0: 44.8, pulses: [44.8] },
  { type: 'text', s: 'something changed', x: 2560, y: 748, size: 16, mono: true, c: OK, align: 'center', t0: 44.8, split: 'char', st: .015 },
  { type: 'flow', from: [2560, 768], to: [2290, 664], bend: -.2, t0: 44.85, dur: .6, c: OK, lw: 2.2 },
  { type: 'circle', x: 3010, y: 780, r: 9, c: OK, fill: .9, lw: 0, t0: 46.3, pulses: [46.3] },
  { type: 'flow', from: [3010, 768], to: [3120, 664], bend: .2, t0: 46.35, dur: .6, c: OK, lw: 2.2 }
] });

/* S7 · what goes wrong */
const chip = (y, s, t0) => ({ type: 'card', x: 2350, y, w: 600, h: 52, r: 26, title: s, ts: 20, tw: 600, t0, enter: 'slide', ed: -60, c: RISK, cs: .9, pad: 26 });
E.push({ type: 'group', t0: 48.2, t1: 55.8, items: [
  { type: 'text', s: 'COMMON WARNING SIGNS · NOT PROOF', x: 2050, y: 344, size: 18, mono: true, w: 600, c: RISK, t0: 48.3, split: 'char', st: .015, track: 3 },
  chip(405, 'Questions avoided', 48.5), chip(470, 'Documents that do not agree', 48.75), chip(535, 'Structure with no business reason', 49.0),
  chip(600, 'Pressure to move money before checks are done', 49.25),
  { type: 'text', s: 'this example', x: 2668, y: 607, size: 17, mono: true, c: RISK, t0: 50.0, split: 'char', st: .03 },
  { type: 'card', x: 3250, y: 520, w: 360, h: 380, r: 16, t0: 52.0, enter: 'slide', ed: 80, title: 'open now, collect later', tmono: true, ts: 18, valign: 'top', pad: 24, c: RISK, cs: .6 },
  { type: 'art', t0: 52.3, dur: .6, c: RISK, lw: 2.2, dash: [8, 7], polys: [['Z', [3150, 520], [3350, 520], [3350, 620], [3150, 620]]] },
  { type: 'glow', x: 3250, y: 570, r: 160, c: RISK, ga: [[52.3, 0], [53, .16]] },
  ...[52.6, 53.2, 53.8, 54.4, 55.0].map((t0, i) => ({ type: 'flow', from: [2960, 560 + (i % 3) * 12], to: [3560, 572 - (i % 2) * 18], bend: (i % 2 ? .06 : -.06), t0, dur: .9, c: RISK, lw: 2.2 })),
  { type: 'art', t0: 53.4, dur: .5, c: 't3', lw: 1.2, polys: [[[2050, 704], [2650, 704]]] },
  { type: 'text', s: 'Serious, repeated or systematic breaches → fines', x: 2050, y: 748, size: 20, mono: true, c: 'cgrey', t0: 53.6, split: 'none' }
] });

write('cdd-kyc', {
  id: 'cdd-kyc', version: 'script-v2', module: 'cdd-kyc', topic: 'cdd',
  title: 'Know who, know why', duration: 60, lang: 'en', seed: 20261113,
  ledger: { path: 'academy/films/cdd-kyc.script.md', status: 'signed off' },
  law: [{ celex: '32024R1624', arts: ['2', '3', '19', '20', '21', '22', '23', '25', '26', '69', '90'] }, { celex: '32024L1640', arts: ['55'] }],
  alt: 'Animated explainer: a fictional company in a hurry asks a fictional payment firm for an account. The customer file builds block by block; the account opens with safeguards, then is closed when the company will not name its owners. The captions below the picture carry every word, and a full transcript follows the player.',
  poster: 40,
  camera: [
    { t: 0, x: 2330, y: 340, z: 1.8 }, { t: 1.6, x: 2320, y: 345, z: 1.72, e: 'lin' }, { t: 5.6, x: 2080, y: 560, z: 1.0, e: 'cam' },
    { t: 6.0, x: 2070, y: 560, z: .99, e: 'lin' }, { t: 7.2, x: 1150, y: 540, z: 1.0, e: 'cam' }, { t: 13.0, x: 1160, y: 542, z: .97, e: 'lin' },
    { t: 14.3, x: 2050, y: 560, z: 1.0, e: 'cam', dip: .18 }, { t: 27.0, x: 2075, y: 565, z: 1.03, e: 'lin' },
    { t: 28.2, x: 2150, y: 580, z: 1.0, e: 'cam' }, { t: 34.0, x: 2155, y: 580, z: .98, e: 'lin' },
    { t: 35.3, x: 2150, y: 480, z: 1.6, e: 'cam' }, { t: 37.0, x: 2160, y: 480, z: 1.62, e: 'lin' },
    { t: 38.2, x: 2150, y: 620, z: .95, e: 'cam' }, { t: 42.0, x: 2155, y: 620, z: .94, e: 'lin' },
    { t: 43.2, x: 2700, y: 560, z: .85, e: 'cam' }, { t: 48.0, x: 2710, y: 562, z: .86, e: 'lin' },
    { t: 49.0, x: 2700, y: 560, z: 1.0, e: 'cam' }, { t: 56.0, x: 2710, y: 560, z: .98, e: 'lin' }, { t: 60, x: 2710, y: 560, z: .95, e: 'outCubic' }
  ],
  dim: [[56, 1], [56.6, .32]],
  chapters: [{ t: 0, n: 'Hook' }, { t: 6, n: 'When' }, { t: 13, n: 'What' }, { t: 27, n: 'Before money moves' }, { t: 34, n: 'If you cannot finish' }, { t: 42, n: 'Keep it current' }, { t: 48, n: 'What goes wrong' }, { t: 56, n: 'End card' }],
  captions: [
    { t0: 0, t1: 6, text: 'One example scenario: Larkmoor Trading, a fictional company set up last month, asks Brindle Pay, a fictional payment and e-money firm, for a business account and wants to send €48,000 today. The situation: a rushed onboarding.' },
    { t0: 6, t1: 13, text: 'Due diligence applies when a business relationship starts, as here. It also applies to occasional transactions from EUR 10 000, lower for some firms, to any suspicion whatever the amount, and to doubts about the data or about who you are dealing with.' },
    { t0: 13, t1: 21, text: 'It is a set of measures, applied together: identify the customer and verify its identity, identify the beneficial owners, take reasonable measures to verify them and understand the ownership and control structure, check sanctions and politically exposed persons, and identify and verify whoever acts for the company and confirm they are authorised.' },
    { t0: 21, t1: 27, text: 'Then understand the business: what Larkmoor does, why it wants the account and, where needed, how much it expects to move, where the money comes from and where it goes.' },
    { t0: 27, t1: 34, text: 'How deep you go follows the risk. Verification comes before the relationship starts, with limited exceptions for lower risk. A bank or other financial institution may open the account first, but only with safeguards so that nothing moves for the customer until it is identified and verified and its beneficial owners are identified and verified with reasonable measures.' },
    { t0: 34, t1: 42, text: 'In this example, Larkmoor will not name the people behind its holding company. When due diligence cannot be completed, the firm does not start the relationship or run the transaction, ends one already started (here, it closes the account it opened) and considers a report to the Financial Intelligence Unit. It records the decision and why.' },
    { t0: 42, t1: 48, text: 'For customers who are taken on, due diligence does not stop at onboarding. Information is updated at least every year for higher-risk customers, at least every five years for others, and when circumstances change.' },
    { t0: 48, t1: 56, text: 'Common warning signs, not proof: questions avoided, documents that do not agree, a structure with no business reason, pressure to move money before checks are done. One way it goes wrong: onboard now, collect later, never close the gap. Serious, repeated or systematic breaches can be fined.' },
    { t0: 56, t1: 60, text: 'Know who, know why, and keep knowing. The AMLR, Regulation (EU) 2024/1624, applies from 10 July 2027.' }
  ],
  headers: [
    { t0: 6.3, t1: 12.6, eyebrow: '01 · WHEN', lines: ['When it applies.'], accent: OK },
    { t0: 13.3, t1: 26.6, eyebrow: '02 · WHAT', lines: ['A set of measures, not one check.'], accent: OK },
    { t0: 27.3, t1: 33.6, eyebrow: '03 · BEFORE MONEY MOVES', lines: ['Open is not the same as live.'], accent: .5 },
    { t0: 34.3, t1: 41.6, eyebrow: '04 · IF YOU CANNOT FINISH', lines: ['Cannot finish? Do not proceed.'], accent: RISK },
    { t0: 42.3, t1: 47.6, eyebrow: '05 · NOT ONE-OFF', lines: ['Keep knowing.'], accent: OK },
    { t0: 48.3, t1: 55.6, eyebrow: 'WHAT GOES WRONG', lines: ['The gap that never closes.'], accent: RISK }
  ],
  hud: { t0: .8, t1: 55.8, label: 'FICTIONAL EXAMPLE', value: 'Larkmoor Trading', temp: [[0, 0], [14.5, 0], [19, .55], [35.2, .55], [35.8, 0]] },
  end: { t0: 56.1, lines: ['Know who. Know why.', 'Keep knowing.'], tint: { line: 1, from: 0 }, footers: ['AMLR · Regulation (EU) 2024/1624 · applies from 10 July 2027', 'Fictional example. Not legal advice.'] },
  sounds: [
    { t: 1.3, k: 'light', i: 2 }, ...[6.4, 6.6, 6.8, 7.0].map((t, i) => ({ t, k: 'tock', i })),
    ...[13.6, 13.9, 14.2, 14.5, 14.8].map((t, i) => ({ t, k: 'tick', i })), ...[15.0, 16.6, 17.6, 18.8].map((t, i) => ({ t, k: 'light', i })),
    { t: 30.6, k: 'tock', i: 0 }, { t: 30.3, k: 'tick', i: 1 }, { t: 35.6, k: 'low' }, ...[37.0, 37.3, 37.6].map((t, i) => ({ t, k: 'tock', i })),
    { t: 44.8, k: 'light', i: 0 }, { t: 46.3, k: 'light', i: 1 }, { t: 48.5, k: 'low' }, ...[52.6, 53.2, 53.8, 54.4].map((t, i) => ({ t, k: 'tick', i }))
  ],
  stills: [
    { t: 4.2, h: 'A rushed onboarding', cap: 'Larkmoor Trading, a fictional company, wants to send €48,000 today.' },
    { t: 11, h: 'When', cap: 'A new relationship, occasional transactions from a set value, any suspicion, doubts about the data or who you deal with.' },
    { t: 25.9, h: 'What', cap: 'A set of measures, applied together, plus an understanding of the business.' },
    { t: 32, h: 'Before money moves', cap: 'The account can open; nothing moves until the customer and its beneficial owners are identified and verified.' },
    { t: 40.5, h: 'If you cannot finish', cap: 'Do not proceed, close the account already opened, consider a report, record why.' },
    { t: 46.9, h: 'Keep it current', cap: 'Updated on a risk-based schedule and when things change.' },
    { t: 60, h: 'Know who. Know why. Keep knowing.', cap: 'The AMLR applies from 10 July 2027.' }
  ],
  elements: E
});
