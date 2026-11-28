// Register Kanban logic tests (docs/register-logic.js, docs/gap-logic.js). Plain Node 18+. From the repo root:
//   node tests/register.test.mjs
// Checks: columns follow the gap view's "covered" definition, grouping and filters, allowed and refused
// moves, saving through the spine (setting plus event in the log), persistence across a re-open
// (memory and localStorage adapters), and that the gap view reads the register's "not applicable".
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const RR = require(path.join(root, 'docs', 'rr-core.js'));
const RL = require(path.join(root, 'docs', 'register-logic.js'));
const GL = require(path.join(root, 'docs', 'gap-logic.js'));
const J = (p) => JSON.parse(fs.readFileSync(path.join(root, 'docs', p), 'utf8'));
const CFG = J('data/spine/config.json');
const OBL = J('data/obligations.json').obligations;
const CTL = J('data/controls.json').controls;
const TODAY = '2026-11-23';

let n = 0, failed = 0;
async function test(name, fn) {
  n++;
  try { await fn(); console.log('ok   ' + name); }
  catch (e) { failed++; console.log('FAIL ' + name + '\n     ' + (e && e.stack ? e.stack.split('\n').slice(0, 6).join('\n     ') : e)); }
}
async function spine(adapter) {
  const s = RR.createSpine({ config: CFG, adapter: adapter || RR.adapters.memory(), today: TODAY });
  await s.ready;
  s.addReference(RR.reference.obligations({ obligations: OBL }));
  return s;
}
const never = () => false;
const ctx = (s, controls = [], extra = {}) => ({ controls, cfg: GL.DEFAULT_CFG, isOverdue: never, spine: s, ...extra });
const A = OBL[0], B = OBL[1], C = OBL[2];
const ctl = (o, over = {}) => ({ id: 'c-' + o.id, name: 'Control', owner: 'T. Nguyen', status: 'approved', last_tested: '2026-10-01', obligation_ids: [o.id], ...over });
const card = (s, o, controls = []) => RL.classify(o, ctx(s, controls));

await test('real data: every obligation lands in exactly one column, nothing hardcoded', async () => {
  const s = await spine();
  const cards = RL.buildCards(OBL, ctx(s));
  const g = RL.group(cards);
  assert.equal(Object.values(g).reduce((a, l) => a + l.length, 0), OBL.length);
  assert.equal(g.not_assessed.length, OBL.length, 'nothing handled yet, no controls: all not assessed');
});
await test('columns reuse the gap view: covered means owner AND tested', async () => {
  const s = await spine();
  assert.equal(card(s, A, [ctl(A)]).col, 'controlled');
  assert.equal(RL.classify(A, ctx(s, [ctl(A)])).gap, GL.statusOf(A, [ctl(A)], GL.DEFAULT_CFG, never, false));
  assert.equal(card(s, A, [ctl(A, { last_tested: null })]).col, 'owned', 'owner but untested');
  assert.equal(card(s, A, [ctl(A, { owner: '' })]).col, 'applicable', 'no owner: not owned, not covered');
  assert.equal(card(s, A, [ctl(A, { status: 'draft' })]).col, 'owned', 'draft with owner still names a person');
  assert.equal(RL.classify(A, { ...ctx(s, [ctl(A)]), isOverdue: () => true }).col, 'owned', 'overdue retest counts as untested');
  assert.equal(RL.classify(A, { ...ctx(s, [ctl(A, { last_tested: null })]), cfg: { needOwner: true, needTest: false, overdueIsUntested: true } }).col, 'controlled', 'config is honoured');
});
await test('card shows owner and linked controls count', async () => {
  const s = await spine();
  const c = card(s, A, [ctl(A), ctl(A, { id: 'x2', owner: '' })]);
  assert.equal(c.ctlCount, 2); assert.equal(c.owner, 'T. Nguyen');
});
await test('moves: applicable, owned (needs owner), not assessed, not applicable', async () => {
  const s = await spine();
  let c = card(s, A);
  assert.deepEqual(RL.canMove(c, 'applicable'), { ok: true });
  RL.move(s, c, 'applicable');
  c = card(s, A); assert.equal(c.col, 'applicable');
  assert.equal(RL.canMove(c, 'owned').needsOwner, true);
  assert.throws(() => RL.move(s, c, 'owned'), /owner/i);
  RL.move(s, c, 'owned', { owner: 'M. Van Damme' });
  c = card(s, A); assert.equal(c.col, 'owned'); assert.equal(c.owner, 'M. Van Damme');
  RL.move(s, c, 'not_assessed'); assert.equal(card(s, A).col, 'not_assessed');
  RL.move(s, card(s, A), 'na'); assert.equal(card(s, A).col, 'na');
  RL.move(s, card(s, A), 'applicable'); assert.equal(card(s, A).col, 'applicable');
});
await test('controlled column is automatic: no manual move in or out (except not applicable)', async () => {
  const s = await spine();
  const c = card(s, A, [ctl(A)]);
  assert.equal(RL.canMove(card(s, B), 'controlled').ok, false);
  assert.match(RL.canMove(card(s, B), 'controlled').reason, /control/i);
  assert.equal(RL.canMove(c, 'owned').ok, false);
  assert.equal(RL.canMove(c, 'na').ok, true);
  assert.throws(() => RL.move(s, card(s, B), 'controlled'));
});
await test('cannot move below what a mapped control already proves', async () => {
  const s = await spine();
  const c = card(s, A, [ctl(A, { last_tested: null })]);
  assert.equal(c.col, 'owned');
  assert.equal(RL.canMove(c, 'applicable').ok, false);
  assert.equal(RL.canMove(c, 'not_assessed').ok, false);
  assert.equal(RL.canMove(card(s, A, [ctl(A, { owner: '' })]), 'not_assessed').ok, false);
});
await test('a saved move is an event in the append-only log, chain verifies', async () => {
  const s = await spine();
  const before = s.events().length;
  RL.move(s, card(s, A), 'applicable');
  const ev = s.events().slice(before);
  assert.equal(ev.length, 1);
  assert.equal(ev[0].action, 'settings');
  assert.equal(ev[0].title, RL.KEY + A.id);
  assert.equal(ev[0].changes[RL.KEY + A.id][1].status, 'applicable');
  assert.ok(s.verifyLog().ok !== false);
});
await test('same-column move is refused and writes nothing', async () => {
  const s = await spine(); const n0 = s.events().length;
  assert.equal(RL.canMove(card(s, A), 'not_assessed').ok, false);
  assert.throws(() => RL.move(s, card(s, A), 'not_assessed'));
  assert.equal(s.events().length, n0);
});
await test('persistence: memory adapter survives a re-open', async () => {
  const ad = RR.adapters.memory();
  const s = await spine(ad);
  RL.move(s, card(s, A), 'owned', { owner: 'Sanmi O.' });
  RL.move(s, card(s, B), 'na');
  await s.flush();
  const s2 = await spine(ad);
  assert.equal(card(s2, A).col, 'owned'); assert.equal(card(s2, A).owner, 'Sanmi O.');
  assert.equal(card(s2, B).col, 'na');
  assert.equal(card(s2, C).col, 'not_assessed');
});
await test('persistence: localStorage adapter', async () => {
  const m = new Map();
  const store = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
  const s = await spine(RR.adapters.localStorage({ storage: store }));
  RL.move(s, card(s, A), 'applicable'); await s.flush();
  const s2 = await spine(RR.adapters.localStorage({ storage: store }));
  assert.equal(card(s2, A).col, 'applicable');
});
await test('gap view consistency: register "not applicable" is the gap view na; legacy dismissal still counts', async () => {
  const s = await spine();
  assert.equal(RL.isNA(s, A.id, false), false);
  assert.equal(RL.isNA(s, A.id, true), true, 'legacy workspace dismissal');
  RL.move(s, card(s, A), 'na');
  assert.equal(RL.isNA(s, A.id, false), true);
  assert.equal(GL.statusOf(A, [], GL.DEFAULT_CFG, never, RL.isNA(s, A.id, false)), 'na');
  RL.move(s, card(s, A), 'applicable');
  assert.equal(RL.isNA(s, A.id, true), false, 'register choice overrides the old dismissal');
  assert.equal(RL.classify(A, ctx(s, [], { legacyDismissed: () => true })).col, 'applicable');
  assert.equal(RL.classify(B, ctx(s, [], { legacyDismissed: () => true })).col, 'na');
});
await test('filters: topic, applies-to, priority, owner', async () => {
  const s = await spine();
  RL.move(s, card(s, A), 'owned', { owner: 'Sanmi O.' });
  const cards = RL.buildCards(OBL, ctx(s));
  const topic = OBL.find((o) => o.topic !== A.topic).topic;
  assert.ok(RL.filterCards(cards, { topic }).every((c) => c.o.topic === topic));
  assert.ok(RL.filterCards(cards, { priority: 'high' }).every((c) => c.o.priority === 'high'));
  assert.deepEqual(RL.filterCards(cards, { owner: 'Sanmi O.' }).map((c) => c.id), [A.id]);
  assert.equal(RL.filterCards(cards, { owner: '__none' }).length, OBL.length - 1);
  assert.ok(RL.filterCards(cards, { who: 'bank' }).every((c) => c.o.who.includes('bank')));
  assert.equal(RL.filterCards(cards, {}).length, OBL.length);
});
await test('change owner keeps the column logic honest', async () => {
  const s = await spine();
  RL.setOwner(s, card(s, A), 'Sanmi O.'); assert.equal(card(s, A).col, 'owned');
  RL.setOwner(s, card(s, A), ''); assert.equal(card(s, A).col, 'applicable');
});
await test('display text comes from the data only', async () => {
  for (const o of OBL) assert.ok(o.what.startsWith(RL.shortTitle(o).replace(/…$/, '')), o.id);
});

console.log(`\n${n - failed} of ${n} passed`);
process.exit(failed ? 1 : 0);
