// UBO calculator checks (docs/ubo-calculator.js). Plain Node 18+, no dependencies. From the repo root:
//   node tests/ubo.test.mjs
// Checks: chain multiplication, adding chains and direct holdings, the 25 % boundary, control through
// ownership (50 % plus one), control by other means, the Art. 54 coexistence rule, loops, impossible
// inputs, the examples in docs/data/academy/ownership.json against their stated answers, the film
// example, CSV and file round trip, and that every legal extract is verbatim in
// docs/data/laws/32024R1624_EN.json. Exits 1 on any failure.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const U = require(path.join(root, 'docs', 'ubo-calculator.js'));
const J = (p) => JSON.parse(fs.readFileSync(path.join(root, 'docs', p), 'utf8'));

let n = 0, failed = 0;
function test(name, fn) {
  n++;
  try { fn(); console.log('ok   ' + name); }
  catch (e) { failed++; console.log('FAIL ' + name + '\n     ' + String(e && e.message || e).split('\n').join('\n     ')); }
}

// small builder: ent('A','B') entities, per('x') persons, h('x','A',30) holdings
function build(ents, pers, holds, ctrls, customer, threshold) {
  return {
    parties: ents.map((id) => ({ id, name: id, type: 'entity' })).concat(pers.map((id) => ({ id, name: id, type: 'person' }))),
    holdings: holds.map(([from, to, pct]) => ({ from, to, pct })),
    controls: (ctrls || []).map(([from, to, basis]) => ({ from, to, basis })),
    customer: customer || ents[0], threshold: threshold || 25
  };
}
const get = (r, id) => r.persons.find((p) => p.id === id);

test('chain multiplication: 50% x 50% = 25% (on the threshold, a beneficial owner)', () => {
  const r = U.analyse(build(['T', 'H', 'O'], ['tom'], [['H', 'T', 50], ['tom', 'H', 50], ['O', 'T', 50]]));
  assert.equal(get(r, 'tom').total, 25);
  assert.equal(get(r, 'tom').isBO, true);
  assert.ok(get(r, 'tom').steps.join(' ').includes('50% × 50% = 25%'));
});
test('threshold boundary: 24.99 is not, 25 is, 25.01 is', () => {
  for (const [pct, bo] of [[24.99, false], [25, true], [25.01, true]]) {
    const r = U.analyse(build(['T'], ['p'], [['p', 'T', pct]]));
    assert.equal(get(r, 'p').isBO, bo, 'pct ' + pct);
  }
});
test('floating point: 45% x 40% is exactly 18%', () => {
  const r = U.analyse(build(['T', 'K'], ['j'], [['K', 'T', 40], ['j', 'K', 45]]));
  assert.equal(get(r, 'j').total, 18);
});
test('adding: chains and direct holdings of the same person are added (Art. 52(1))', () => {
  // Namur: 15 direct + 50% x 30% + 30% x 10%; here none controls the next (no one above 50)
  const r = U.analyse(build(['T', 'A', 'B'], ['lena'], [['A', 'T', 40], ['B', 'T', 30], ['lena', 'T', 15], ['lena', 'A', 30], ['lena', 'B', 10]]));
  assert.equal(get(r, 'lena').total, 15 + 12 + 3);
  assert.equal(get(r, 'lena').isBO, true);
  const st = get(r, 'lena').steps.join(' ');
  assert.ok(st.includes('= 30%') && st.includes('40% × 30% = 12%') && st.includes('30% × 10% = 3%'));
});
test('film example: Jonas 8% + 45% x 40% = 26%, Mira 30%, Victor by control, Elif 14%, Tom 8% no', () => {
  const r = U.analyse(U.FILM);
  assert.equal(get(r, 'jonas').total, 26);
  assert.equal(get(r, 'jonas').direct, 8);
  assert.equal(get(r, 'jonas').indirect, 18);
  const bo = r.persons.filter((p) => p.isBO).map((p) => p.id).sort();
  assert.deepEqual(bo, ['jonas', 'mira', 'victor']);
  assert.equal(get(r, 'elif').total, 14);
  assert.equal(get(r, 'tom').total, 8);
  assert.deepEqual(r.links, [], 'Art. 54 does not apply in the film example');
});
test('control through ownership: more than 50% (50% exactly is not control)', () => {
  const a = U.analyse(build(['T'], ['p'], [['p', 'T', 50.01]]));
  assert.ok(get(a, 'p').routes.includes('control-own'));
  const b = U.analyse(build(['T', 'H'], ['p', 'q'], [['p', 'H', 50], ['q', 'H', 50], ['H', 'T', 100]]));
  assert.ok(!get(b, 'p').routes.includes('control-own'), '50% of the holding is not control');
  assert.equal(get(b, 'p').isBO, true, 'but 50% x 100% = 50% is an ownership interest');
});
test('control by other means counts with 8% (Art. 53(3)(b))', () => {
  const r = U.analyse(build(['T'], ['k', 'x'], [['k', 'T', 8], ['x', 'T', 92]], [['k', 'T', 'board']]));
  assert.equal(get(r, 'k').isBO, true);
  assert.ok(get(r, 'k').routes.includes('control-other'));
  assert.equal(get(r, 'x').isBO, true);   // 92% > 50%
  assert.ok(get(r, 'k').cites.includes('A53_3b') && get(r, 'k').cites.includes('A51p'));
});
test('control by an entity is looked through to its natural controller', () => {
  const r = U.analyse(build(['T', 'Z'], ['v'], [['v', 'Z', 100]], [['Z', 'T', 'agreement']]));
  assert.equal(get(r, 'v').isBO, true);
  assert.ok(get(r, 'v').routes.includes('control-other'));
});
test('Art. 54: Bram 80% x 30% = 24% is not multiplied, he is a beneficial owner through the controlling holding', () => {
  const r = U.analyse(build(['T', 'H'], ['mina', 'bram', 'ines'], [['H', 'T', 80], ['ines', 'T', 20], ['mina', 'H', 70], ['bram', 'H', 30]]));
  assert.equal(get(r, 'bram').isBO, true);
  assert.ok(get(r, 'bram').routes.includes('art54b'));
  assert.equal(get(r, 'bram').total, 0, 'the chain through H is excluded from the sum');
  assert.equal(get(r, 'bram').excluded[0].product, 24);
  assert.equal(get(r, 'ines').isBO, false);
  assert.equal(get(r, 'mina').isBO, true);
  assert.equal(r.links.length, 1);
});
test('Art. 54: 24% in a controlling holding is not enough (below the stake in the controlling entity)', () => {
  const r = U.analyse(build(['T', 'H'], ['a', 'b'], [['H', 'T', 80], ['a', 'H', 76], ['b', 'H', 24]]));
  assert.equal(get(r, 'b').isBO, false);
  assert.equal(get(r, 'a').isBO, true);
});
test('Art. 54(a): a natural person who controls a 30% holder is a beneficial owner although 60% x 30% = 18%', () => {
  const r = U.analyse(build(['T', 'Y'], ['p', 'o'], [['Y', 'T', 30], ['o', 'T', 70], ['p', 'Y', 60]]));
  assert.equal(get(r, 'p').isBO, true);
  assert.ok(get(r, 'p').routes.includes('art54a'));
  assert.equal(get(r, 'p').excluded[0].product, 18);
});
test('no Art. 54 when the holder is not controlled and does not control (multiplication applies)', () => {
  const r = U.analyse(build(['T', 'Y'], ['p', 'q'], [['Y', 'T', 40], ['p', 'Y', 40], ['q', 'Y', 40]]));
  assert.equal(get(r, 'p').total, 16);
  assert.equal(r.links.length, 0);
});
test('loops: the holding that closes the loop is ignored and a warning is given', () => {
  const m = build(['T', 'H'], ['s'], [['H', 'T', 60], ['T', 'H', 20], ['s', 'H', 50]]);
  const r = U.analyse(m);
  assert.ok(r.issues.some((i) => i.code === 'cycle'));
  assert.ok(r.issues.some((i) => i.code === 'ignored-holding'));
  assert.equal(r.blocked, false);
  assert.equal(get(r, 's').isBO, true);
});
test('a person who holds through the loop is not inflated (no endless multiplication)', () => {
  const r = U.analyse(build(['T', 'H'], ['s'], [['H', 'T', 60], ['T', 'H', 20], ['s', 'H', 50], ['s', 'T', 8]]));
  assert.equal(get(r, 's').direct, 8);
  assert.ok(get(r, 's').total <= 8, 'multiplied chains through H are excluded');
});
test('impossible inputs: over 100%, percentage out of range, missing customer, person as customer', () => {
  assert.ok(U.analyse(build(['T'], ['a', 'b'], [['a', 'T', 70], ['b', 'T', 40]])).issues.some((i) => i.code === 'over-100'));
  assert.ok(U.analyse(build(['T'], ['a'], [['a', 'T', 120]])).issues.some((i) => i.code === 'pct-range'));
  assert.ok(U.analyse(build(['T'], ['a'], [['a', 'T', -5]])).issues.some((i) => i.code === 'pct-range'));
  const nc = build(['T'], ['a'], [['a', 'T', 30]]); nc.customer = '';
  const r = U.analyse(nc);
  assert.ok(r.blocked && r.issues.some((i) => i.code === 'no-customer'));
  assert.equal(r.persons.length, 0);
  const pc = build(['T'], ['a'], [['a', 'T', 30]]); pc.customer = 'a';
  assert.ok(U.analyse(pc).issues.some((i) => i.code === 'customer-not-entity'));
  assert.ok(U.analyse(build(['T'], ['a'], [['T', 'a', 30]])).issues.some((i) => i.code === 'owned-person'));
  assert.ok(U.analyse(build(['T'], ['a'], [['a', 'T', null]])).issues.some((i) => i.code === 'pct-missing'));
});
test('an under-100% structure gets a note, not an error', () => {
  const r = U.analyse(build(['T'], ['a'], [['a', 'T', 60]]));
  assert.ok(r.issues.some((i) => i.code === 'unaccounted' && i.level === 'info'));
  assert.equal(r.blocked, false);
});
test('no natural person qualifies: fallback note only, nobody claimed', () => {
  const r = U.analyse(build(['T'], ['a', 'b'], [['a', 'T', 20], ['b', 'T', 20]]));
  assert.equal(r.fallback, true);
  assert.deepEqual(r.cites, ['A22']);
  assert.ok(r.persons.every((p) => !p.isBO));
});
test('a lower threshold (Art. 52(2) scenario, 15%) changes the verdict', () => {
  const m = build(['T'], ['a'], [['a', 'T', 16]], [], 'T', 15);
  assert.equal(get(U.analyse(m), 'a').isBO, true);
});

// ── the academy examples, against the answers stated in ownership.json ──
const OWN = J('data/academy/ownership.json');
for (const c of OWN.cases.filter((k) => ['OWN-01', 'OWN-02', 'OWN-04', 'OWN-05'].includes(k.id))) {
  test(`ownership.json ${c.id}: beneficial owners match the stated answer`, () => {
    const r = U.analyse(U.fromCase(c));
    assert.equal(r.blocked, false, JSON.stringify(r.issues));
    assert.deepEqual(r.persons.filter((p) => p.isBO).map((p) => p.id).sort(), c.answer.ubos.slice().sort());
  });
}
test('ownership.json OWN-02 and OWN-05: stated totals reproduced (Victor 25, Lena 33; Omar 22, Sara 8 direct)', () => {
  const o2 = U.analyse(U.fromCase(OWN.cases.find((k) => k.id === 'OWN-02')));
  assert.equal(get(o2, 'victor').total, 25);
  assert.equal(get(o2, 'lena').total, 33);
  const o5 = U.analyse(U.fromCase(OWN.cases.find((k) => k.id === 'OWN-05')));
  assert.equal(get(o5, 'omar').total, 22);
  assert.equal(get(o5, 'sara').direct, 8);
  assert.ok(o5.issues.some((i) => i.code === 'cycle'));
});
test('ownership.json OWN-01: Bram 24% by multiplication is shown as not used', () => {
  const r = U.analyse(U.fromCase(OWN.cases.find((k) => k.id === 'OWN-01')));
  assert.equal(get(r, 'bram').excluded[0].product, 24);
  assert.equal(get(r, 'mina').excluded[0].product, 56);
});
test('ownership.json primer P3: Rita 15% + 40% x 40% = 31%', () => {
  const r = U.analyse(U.fromCase(OWN.primer.find((k) => k.id === 'P3')));
  assert.equal(get(r, 'rita').total, 31);
  assert.equal(get(r, 'rita').isBO, true);
});

// ── files and CSV ──
test('save and load round trip; a wrong file is refused', () => {
  const back = U.parseFile(U.serialise(U.FILM));
  assert.ok(back.model);
  assert.equal(get(U.analyse(back.model), 'jonas').total, 26);
  assert.ok(U.parseFile('{"format":"other"}').error);
  assert.ok(U.parseFile('not json').error);
});
test('CSV: header, one row per person, formula injection neutralised', () => {
  const m = JSON.parse(JSON.stringify(U.FILM)); m.parties.find((p) => p.id === 'tom').name = '=HYPERLINK("x")';
  const csv = U.toCsv(m, U.analyse(m), '2026-11-14');
  assert.ok(csv.startsWith('﻿'));
  assert.ok(csv.includes('Jonas,Beneficial owner,26%'));
  assert.ok(csv.includes('"\'=HYPERLINK(""x"")"'), 'formula prefixed');
});

// ── every legal extract is verbatim in the law JSON ──
const LAW = J('data/laws/32024R1624_EN.json');
const norm = (s) => String(s).replace(/\s+/g, ' ').trim();
for (const [key, e] of Object.entries(U.EXTRACTS)) {
  test(`extract ${key} (${e.label}) is verbatim in Art. ${e.art}`, () => {
    const art = LAW.articles.find((a) => a.id === e.art);
    assert.ok(art, 'article ' + e.art + ' exists');
    assert.ok(norm(art.text).includes(norm(e.text)), 'text not found in Art. ' + e.art);
  });
}
test('every citation key used in a result exists; links go to law.html with the article', () => {
  for (const ex of [U.FILM, U.fromCase(OWN.cases[0]), U.fromCase(OWN.cases[3])]) {
    const r = U.analyse(ex);
    for (const p of r.persons) for (const k of p.cites) assert.ok(U.EXTRACTS[k], k);
  }
  assert.equal(U.lawHref('52'), 'law.html?celex=32024R1624&art=52');
});

console.log(`\n${n - failed}/${n} passed`);
process.exit(failed ? 1 : 0);
