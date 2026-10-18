// Data spine tests (docs/rr-core.js). Plain Node 18+, no dependencies. From the repo root:
//   node tests/spine.test.mjs
// Covers: config integrity, entity create/link/query, the append-only event log and its hash chain,
// adapter swap (memory -> memory, localStorage with a fake storage, Postgres stub), the read-only
// import bridge on fixture module data, demo data, schema version guard, and the one-time migration of
// Issues and actions onto the spine (legacy key in, spine records out, idempotent, old key untouched,
// the board can edit the records, the page's model round-trips). Exits 1 on any failure.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const RR = require(path.join(root, 'docs', 'rr-core.js'));
const AS = require(path.join(root, 'docs', 'actions-store.js'));
const J = (p) => JSON.parse(fs.readFileSync(path.join(root, 'docs', p), 'utf8'));
const CFG = J('data/spine/config.json');
const DEMO = J('data/spine/demo.json');
const OBL = J('data/obligations.json');
const APP = J('data/applicability.json');
const CTL = J('data/controls.json');
const TODAY = '2026-10-17';

let n = 0, failed = 0;
async function test(name, fn) {
  n++;
  try { await fn(); console.log('ok   ' + name); }
  catch (e) { failed++; console.log('FAIL ' + name + '\n     ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join('\n     ') : e)); }
}
function clockFrom(start) { let t = Date.parse(start); return () => new Date((t += 1000)).toISOString(); }
async function spine(opts = {}) {
  const s = RR.createSpine({ config: CFG, adapter: opts.adapter || RR.adapters.memory(opts.seed), today: TODAY, clock: clockFrom('2026-10-17T08:00:00Z'), actor: opts.actor });
  await s.ready;
  if (opts.reference !== false) {
    s.addReference(RR.reference.obligations(OBL));
    s.addReference(RR.reference.regulations(APP));
  }
  return s;
}
function fakeStorage(init = {}, readOnlyKeys = []) {
  const m = new Map(Object.entries(init)), writes = [];
  return {
    writes,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { if (readOnlyKeys.includes(k)) throw new Error('WRITE to module key ' + k); writes.push(k); m.set(k, String(v)); },
    removeItem: (k) => { if (readOnlyKeys.includes(k)) throw new Error('REMOVE of module key ' + k); m.delete(k); },
    dump: () => Object.fromEntries(m)
  };
}

/* ───────── fixture module data (the shapes the modules store today) ───────── */
const FIX = {
  'regradar-controls-mine': JSON.stringify({
    extra: [{ id: 'local-abc', name: 'Sanctions list update check', owner: 'Sanmi O.', frequency: 'Quarterly', type: 'Detective', status: 'draft', last_tested: null, obligation_ids: [] }],
    extraMappings: { 'AMLR-art42': ['ctl-02'] }, removedMappings: { 'AMLR-art19': ['ctl-01'] },
    overrides: { 'ctl-03': { owner: 'J. Okafor' } },
    tests: { 'ctl-01': [{ date: '2026-10-01', result: 'failed', note: 'newest' }, { date: '2026-09-02', result: 'effective', note: 'older' }] }
  }),
  'regradar-actions': JSON.stringify({ v: 1, seq: 2, issues: [
    { id: 'ISS-001', title: 'Missing ID evidence', severity: 'critical', owner: 'T. Nguyen', status: 'awaiting_validation', opened_on: '2026-08-01', due_on: '2026-10-10',
      control_ids: ['ctl-01'], obligation_ids: ['AMLR-art19'], actions: [{ id: 'A1', title: 'Back-fill', owner: 'Sanmi O.', due_on: '2026-10-20', status: 'open' }, { id: 'A2', title: 'Retrain', owner: 'Sanmi O.', due_on: '2026-09-20', status: 'done' }] },
    { id: 'ISS-002', title: 'Old finding', severity: 'low', owner: 'R. Haddad', status: 'closed', due_on: '2026-07-01', control_ids: [], obligation_ids: [], actions: [] }
  ] }),
  'regradar-policies': JSON.stringify({ v: 1, staff: [{ id: 's1', name: 'T. Nguyen', team: 'Compliance', role: 'Compliance Officer' }, { id: 's2', name: 'I. Claes', team: 'Onboarding', role: 'Head of Onboarding' }],
    policies: [
      { id: 'POL-01', ref: 'X-1', title: 'AML policy', owner: 'T. Nguyen', cycleMonths: 12, lastReviewed: '2025-11-01', obligation_ids: ['AMLR-art26'], versions: [{ ver: '1.0.0', status: 'approved' }, { ver: '1.1.0', status: 'in_review' }] },
      { id: 'POL-02', title: 'CDD procedure', owner: 'I. Claes', cycleMonths: 6, lastReviewed: '2026-03-01', obligation_ids: [], versions: [{ ver: '1.0.0', status: 'approved' }] },
      { id: 'POL-03', title: 'Retired one', owner: 'I. Claes', retired: { on: '2026-01-01' }, versions: [{ ver: '1.0.0', status: 'superseded' }] }
    ], attest: {}, reminders: [], log: [] }),
  'regradar-cases': JSON.stringify({ settings: { team: ['Analyst A', 'MLRO (demo)'], caseDays: 10, holidays: ['2026-10-19'] },
    alerts: [], filings: [], requests: [],
    cases: [{ id: 'CASE-1', title: 'Pass-through', status: 'mlro', openedAt: '2026-10-09T10:00:00.000Z', assignee: 'Analyst A', priority: 'high' },
      { id: 'CASE-2', title: 'Filed one', status: 'filed', openedAt: '2026-09-01T10:00:00.000Z', assignee: 'MLRO (demo)', priority: 'low' }] }),
  'regradar-bwra': JSON.stringify({ v: 1, scenarios: [{ id: 'sc-1' }], refresh: { months: 12, due: '' }, signoff: { label: 'BWRA 2026', preparedBy: 'R. Haddad', preparedOn: '2026-10-01', approvedOn: '' } }),
  'regradar-cra': JSON.stringify({ v: 1, customers: [{ id: 'CUS-1', name: 'Acme (fictional)', decisions: [] }, { id: 'CUS-2', name: 'Beta (fictional)', decisions: [{ at: '2026-01-01T00:00:00Z', decision: 'approve' }] }] }),
  'regradar-impact': JSON.stringify({ v: 1, assessments: { abc: { itemId: 'abc', itemTitle: 'EBA guidelines X', decision: 'action', owner: 'R. Haddad', effective: '2027-01-15', effectiveSrc: 'Art. 3' } } }),
  'regradar-obligations-mine': JSON.stringify({ dismissed: { 'AMLR-art46': true }, pinned: ['AMLR-art19'], notes: { 'AMLR-art19': 'our note' } }),
  'regradar-profile': JSON.stringify({ entity: 'pi', acts: [] }),
  'regradar-academy-training': JSON.stringify({ v: 1, modules: { 'cdd-kyc': { steps: {}, completed: { at: '2026-10-02T09:00:00Z', score: 3, max: 4 } }, 'peps': { steps: {} } } })
};
const MODULE_KEYS = Object.keys(FIX);

/* ═════════════════ tests ═════════════════ */

await test('config: workflows, link types, board, bridge maps and briefing refer to things that exist', () => {
  const types = Object.keys(CFG.entity_types);
  for (const [t, d] of Object.entries(CFG.entity_types)) {
    assert.ok(CFG.workflows[d.workflow], `${t}: workflow ${d.workflow} missing`);
    for (const s of CFG.workflows[d.workflow].states) assert.ok(CFG._meta.categories[s.category], `${d.workflow}.${s.id}: unknown category ${s.category}`);
  }
  for (const l of CFG.link_types) for (const t of l.from.concat(l.to)) assert.ok(types.includes(t), `link ${l.id}: unknown type ${t}`);
  assert.ok(CFG.workflows[CFG.board.workflow], 'board workflow');
  for (const t of CFG.board.types) assert.equal(CFG.entity_types[t].workflow, CFG.board.workflow, `board type ${t} must use the board workflow`);
  const st = (wf) => CFG.workflows[wf].states.map((s) => s.id);
  for (const v of Object.values(CFG.bridge.issue_status)) assert.ok(st('work').includes(v));
  for (const v of Object.values(CFG.bridge.action_status)) assert.ok(st('work').includes(v));
  for (const v of Object.values(CFG.bridge.control_status)) assert.ok(st('control').includes(v));
  for (const v of Object.values(CFG.bridge.policy_status)) assert.ok(st('document').includes(v));
  for (const v of Object.values(CFG.bridge.impact_status)) assert.ok(st('reg_change').includes(v));
  for (const k of CFG.briefing.due_kinds) for (const t of k.types) assert.ok(types.includes(t), `due kind ${k.id}: ${t}`);
  for (const t of CFG.briefing.workload_types) assert.ok(types.includes(t));
});

await test('entities: create, validate, link, query', async () => {
  const s = await spine();
  const mlro = s.create('person', { id: 'person:a', title: 'A (test)', data: { role: 'mlro' } });
  assert.equal(mlro.status, 'active');
  const t = s.create('action', { title: 'Do the thing', owner: 'person:a', due: '2026-10-20', data: { kind: 'control_test', priority: 'high' } });
  assert.match(t.id, /^TSK-/);
  assert.equal(t.status, 'todo', 'first workflow state is the default');
  assert.equal(s.get(t.id).title, 'Do the thing');
  assert.throws(() => s.create('action', { title: 'x', status: 'nope' }), /Unknown status/);
  assert.throws(() => s.create('action', { title: 'x', data: { priority: 'urgent' } }), /not a valid/);
  assert.throws(() => s.create('action', { title: 'x', owner: 'person:ghost' }), /team member/);
  assert.throws(() => s.create('action', { title: '' }), /title/);
  assert.throws(() => s.create('obligation', { title: 'x' }), /repository data/);
  s.link('addresses', t.id, 'OBL:AMLR-art19');
  assert.throws(() => s.link('mitigates', t.id, 'OBL:AMLR-art19'), /cannot/, 'link type checks entity types');
  assert.deepEqual(s.linked(t.id).map((e) => e.id), ['OBL:AMLR-art19']);
  assert.deepEqual(s.linked('OBL:AMLR-art19', 'addresses', 'in').map((e) => e.id), [t.id]);
  assert.equal(s.list('action', { owner: 'person:a' }).length, 1);
  assert.equal(s.list('action', { open: true }).length, 1);
  assert.equal(s.list('obligation').length, OBL.obligations.length, 'reference obligations are queryable');
  assert.equal(s.dueState(t).state, 'week');
  const moved = s.move(t.id, 'review');
  assert.equal(moved.status, 'review');
  assert.ok(s.awaitingApproval(moved));
  assert.equal(s.list(null, (e) => e.type === 'action' && s.category(e) === 'review').length, 1);
  assert.throws(() => { s.get(t.id).title = 'hacked'; }, TypeError, 'returned entities are frozen');
  const l = s.links(t.id)[0];
  s.unlink(l.id);
  assert.equal(s.linked(t.id).length, 0);
});

await test('event log: append-only, per-entity history, hash chain, subscribe', async () => {
  const s = await spine();
  const seen = [];
  const off = s.subscribe((ev) => seen.push(ev.action));
  s.create('person', { id: 'person:b', title: 'B' });
  const t = s.create('action', { title: 'Task' });
  s.assign(t.id, 'person:b');
  s.move(t.id, 'in_progress');
  s.update(t.id, { due: '2026-11-01' });
  off();
  s.move(t.id, 'done');
  assert.deepEqual(seen, ['create', 'create', 'assign', 'move', 'update']);
  const h = s.history(t.id);
  assert.deepEqual(h.map((e) => e.action), ['create', 'assign', 'move', 'update', 'move']);
  assert.deepEqual(h[2].changes, { status: ['todo', 'in_progress'] });
  assert.ok(h.every((e) => e.at && e.actor && e.entity === t.id));
  assert.throws(() => { h[0].action = 'x'; }, TypeError, 'events are frozen');
  assert.deepEqual(s.verifyLog(), { ok: true, count: 6 });
  await s.flush();
  // the adapter refuses to update or re-append events
  const a = RR.adapters.memory();
  await a.append('events', { id: 'e1' });
  await assert.rejects(a.append('events', { id: 'e1' }), /append-only/);
  await assert.rejects(a.save('events', { id: 'e1' }), /append-only/);
  // tampering with a stored event breaks the chain
  const dump = s.exportAll();
  dump.events[2] = Object.assign({}, dump.events[2], { note: 'edited later' });
  const s2 = await spine({ seed: dump });
  assert.equal(s2.verifyLog().ok, false);
  assert.equal(s2.verifyLog().broken_at, 3);
});

await test('adapter swap: copy to another adapter and get identical answers', async () => {
  const s = await spine();
  s.create('person', { id: 'person:c', title: 'C' });
  const t = s.create('action', { title: 'Swap me', owner: 'person:c', due: '2026-10-18' });
  s.link('addresses', t.id, 'OBL:AMLR-art20');
  s.move(t.id, 'in_progress');
  s.setSetting('firm_type', 'emi');
  const target = RR.adapters.memory();
  await s.copyTo(target);
  const s2 = await spine({ adapter: target });
  for (const q of [(x) => x.list('action'), (x) => x.linked(t.id), (x) => x.history(t.id), (x) => x.people()]) {
    assert.deepEqual(JSON.parse(JSON.stringify(q(s2))), JSON.parse(JSON.stringify(q(s))));
  }
  assert.equal(s2.getSetting('firm_type'), 'emi');
  assert.equal(s2.verifyLog().ok, true);
  // new events continue the same chain
  s2.move(t.id, 'done');
  assert.equal(s2.verifyLog().ok, true);

  // localStorage adapter with a fake storage: survives a reopen, writes only spine keys
  const fs1 = fakeStorage(FIX, MODULE_KEYS);
  const L = RR.adapters.localStorage({ storage: fs1 });
  const s3 = await spine({ adapter: L });
  s3.create('action', { id: 'TSK-1', title: 'Persist me' });
  await s3.flush();
  assert.ok(fs1.writes.every((k) => k.startsWith('regradar-spine-')), 'only regradar-spine-* keys are written');
  const s4 = await spine({ adapter: RR.adapters.localStorage({ storage: fs1 }) });
  assert.equal(s4.get('TSK-1').title, 'Persist me');
  assert.equal(s4.verifyLog().ok, true);

  // Postgres: a documented stub that refuses clearly
  const pg = RR.adapters.postgres();
  assert.equal(pg.stub, true);
  await assert.rejects(pg.load('entities'), /stub/);
  for (const m of ['load', 'list', 'save', 'append', 'reset']) assert.equal(typeof pg[m], 'function', `postgres stub has ${m}()`);
});

await test('bridge: imports every module key read-only, idempotent, syncs and archives', async () => {
  const st = fakeStorage(FIX, MODULE_KEYS);
  const before = JSON.stringify(MODULE_KEYS.map((k) => st.getItem(k)));
  const s = await spine({ adapter: RR.adapters.localStorage({ storage: st }) });
  const ref = { controls: CTL };
  const r = s.importModules((k) => st.getItem(k), ref);
  await s.flush();
  assert.equal(JSON.stringify(MODULE_KEYS.map((k) => st.getItem(k))), before, 'module keys unchanged');
  assert.deepEqual(r.errors, []);
  assert.ok(r.modules.every((m) => m.found), 'every fixture key was found');

  // controls: library + device overlay, mappings, tests, due from frequency
  assert.equal(s.list('control').length, CTL.controls.length + 1);
  assert.equal(s.get('CTL:ctl-03').owner, 'person:j-okafor', 'override applied');
  assert.ok(!s.linked('CTL:ctl-01', 'mitigates').some((e) => e.id === 'OBL:AMLR-art19'), 'removed mapping honoured');
  assert.ok(s.linked('CTL:ctl-02', 'mitigates').some((e) => e.id === 'OBL:AMLR-art42'), 'extra mapping honoured');
  assert.equal(s.get('CTL:ctl-01').due, '2026-10-02', 'Monthly = 30 days after last_tested 2026-09-02');
  assert.equal(s.linked('CTL:ctl-01', 'tests').length, 2);
  assert.equal(s.get('TST:ctl-01:1').status, 'failed', 'newest test gets the highest index');
  // issues and actions have left the bridge: they are imported once by their own migration, not mirrored
  assert.equal(s.list(['issue', 'action']).length, 0, 'the bridge no longer mirrors regradar-actions');
  assert.ok(!RR.bridge.modules.some((m) => m.id === 'actions'), 'actions is not in the bridge module list');
  assert.equal(RR.bridge.migrated[0].id, 'actions');
  assert.ok(!r.modules.some((m) => m.module === 'actions'), 'no report line for a migrated module');
  // policies
  assert.equal(s.get('POL:POL-01').status, 'in_review', 'a version in review makes the file wait for approval');
  assert.equal(s.get('POL:POL-01').due, '2026-11-01');
  assert.equal(s.get('POL:POL-02').due, '2026-09-01');
  assert.equal(s.get('POL:POL-03').status, 'retired');
  assert.equal(s.get('person:t-nguyen').data.role, 'mlro', 'role guessed from "Compliance Officer"');
  // cases: 10 working days from 9 Oct 2026 with 19 Oct as a holiday -> 26 Oct
  assert.equal(s.get('CASE:CASE-1').due, '2026-10-26');
  assert.equal(s.get('CASE:CASE-2').due, null);
  assert.equal(s.get('person:mlro-demo').data.role, 'mlro');
  // BWRA, CRA, impact, training
  assert.equal(s.get('RA:bwra').status, 'in_review');
  assert.equal(s.get('CRF:CUS-1').status, 'pending');
  assert.equal(s.get('CRF:CUS-2').status, 'approved');
  assert.equal(s.get('RC:abc').status, 'assessed');
  assert.equal(s.get('RC:abc').due, '2027-01-15');
  assert.equal(s.list('training').length, 1);
  assert.equal(s.get('TRN:academy:cdd-kyc').data.score, '3/4');
  // overlays
  assert.equal(s.get('OBL:AMLR-art46').status, 'not_applicable');
  assert.equal(s.get('OBL:AMLR-art19').data.watched, true);
  assert.equal(s.getSetting('firm_type'), 'pi');
  // read-only in the spine
  assert.throws(() => s.move('CASE:CASE-1', 'closed'), /Cases and STR/);
  assert.throws(() => s.link('addresses', 'CASE:CASE-1', 'OBL:AMLR-art20'), /Managed on/);
  assert.throws(() => s.update('OBL:AMLR-art19', { title: 'x' }), /repository/);
  // but a spine task may link to module records
  const mine = s.create('action', { title: 'Mine' });
  s.link('addresses', mine.id, 'OBL:AMLR-art20');

  // idempotent: nothing changes -> no new events
  const nEv = s.events().length;
  const r2 = s.importModules((k) => st.getItem(k), ref);
  assert.equal(r2.created + r2.updated + r2.archived, 0);
  assert.equal(s.events().length, nEv);

  // a module change syncs; a removed record is archived (and stays in the log)
  const cases = JSON.parse(FIX['regradar-cases']);
  cases.cases[0].status = 'filed';
  cases.cases.pop();
  const st2 = fakeStorage(Object.assign({}, FIX, { 'regradar-cases': JSON.stringify(cases) }), MODULE_KEYS);
  const r3 = s.importModules((k) => st2.getItem(k), ref);
  assert.equal(r3.updated, 1);
  assert.equal(r3.archived, 1);
  assert.equal(s.get('CASE:CASE-1').status, 'filed');
  assert.equal(s.list('case').length, 1);
  assert.equal(s.list('case', { archived: true }).length, 2);
  assert.deepEqual(s.history('CASE:CASE-1').map((e) => e.action), ['import', 'sync']);
  assert.equal(s.history('CASE:CASE-1')[0].actor, 'system:bridge', 'imports are attributed to the bridge');
  assert.equal(s.history('person:t-nguyen')[0].actor, 'system:bridge');

  // an unreadable key is reported and its records are kept, not archived
  const st3 = fakeStorage(Object.assign({}, FIX, { 'regradar-cases': '{broken' }), MODULE_KEYS);
  const r4 = s.importModules((k) => st3.getItem(k), ref);
  assert.equal(r4.modules.find((m) => m.module === 'cases').error, 'unreadable JSON');
  assert.equal(s.get('CASE:CASE-1').archived, false);
  assert.equal(s.verifyLog().ok, true);
});

await test('bridge: no module data -> only the controls library and nothing invented', async () => {
  const s = await spine();
  const r = s.importModules(() => null, { controls: CTL });
  assert.equal(r.modules.filter((m) => m.found).length, 0);
  assert.equal(s.list(['issue', 'action', 'policy', 'case', 'assessment', 'customer_file', 'training']).length, 0);
  assert.equal(s.list('control').length, CTL.controls.length);
});

await test('demo: loads a labelled fictional team of 4 and work, removes and reloads cleanly', async () => {
  const s = await spine();
  s.importModules(() => null, { controls: CTL });
  const r = s.loadDemo(DEMO);
  assert.deepEqual(r.skipped, []);
  const team = s.people().filter((p) => p.origin === 'demo' || (p.data && p.data.role));
  assert.equal(s.people().filter((p) => ['mlro', 'manager', 'analyst'].includes(p.data.role)).length, 4);
  assert.ok(team.length >= 4);
  assert.equal(s.list('action').length, DEMO.tasks.length);
  assert.ok(s.list(null, { origin: 'demo' }).every((e) => e.data.demo === true), 'every demo record is labelled');
  assert.equal(s.getSetting('firm_name'), 'CF Bank (fictional)');
  const t1 = s.get('TSK:demo-t1');
  assert.equal(t1.due, '2026-10-14');
  assert.deepEqual(s.linked(t1.id, 'fixes').map((e) => e.id), ['ISS:demo-i1']);
  assert.ok(s.linked(t1.id, 'concerns').some((e) => e.id === 'CTL:ctl-01'), 'demo links reach real controls');
  for (const x of [].concat(DEMO.tasks, DEMO.issues, DEMO.policies, DEMO.cases, DEMO.assessments, DEMO.tests, DEMO.training)) {
    for (const l of x.links || []) if (/^(OBL|CTL):/.test(l.to)) assert.ok(s.get(l.to), `demo link target ${l.to} exists in repo data`);
  }
  const removed = s.clearDemo();
  assert.ok(removed > 20);
  assert.equal(s.list('action').length, 0);
  assert.equal(s.hasDemo(), false);
  s.loadDemo(DEMO);
  assert.equal(s.list('action').length, DEMO.tasks.length);
  assert.equal(s.verifyLog().ok, true);
});

await test('demo: skips policies/cases (and findings) when the modules already have them', async () => {
  const st = fakeStorage(FIX);
  const s = await spine();
  s.importModules((k) => st.getItem(k), { controls: CTL });
  let r = s.loadDemo(DEMO);
  assert.ok(r.skipped.includes('Policies') && r.skipped.includes('Cases'));
  assert.ok(!r.skipped.includes('Findings'), 'findings are no longer mirrored: only a migrated register makes them the firm\'s own');
  assert.equal(s.list('policy').filter((p) => p.origin === 'demo').length, 0);
  // once the Issues and actions register is on the spine, its findings win over the demo ones
  const s2 = await spine();
  s2.importModules((k) => st.getItem(k), { controls: CTL });
  assert.equal(AS.migrate(s2, (k) => st.getItem(k)).status, 'migrated');
  r = s2.loadDemo(DEMO);
  assert.ok(r.skipped.includes('Findings'));
  assert.equal(s2.list('issue').filter((i) => i.origin === 'demo').length, 0);
  assert.equal(s2.list('action').filter((a) => a.origin === 'demo').length, DEMO.tasks.length, 'demo tasks still load beside the register');
});

await test('schema: version recorded, newer data refused, reference data never persisted', async () => {
  const a = RR.adapters.memory();
  const s = await spine({ adapter: a });
  await s.flush();
  const meta = await a.load('meta');
  assert.equal(meta.find((m) => m.id === 'schema').version, RR.SCHEMA_VERSION);
  assert.equal((await a.load('entities')).filter((e) => e.origin === 'reference').length, 0);
  const b = RR.adapters.memory({ meta: [{ id: 'schema', version: RR.SCHEMA_VERSION + 1 }] });
  await assert.rejects(RR.createSpine({ config: CFG, adapter: b }).ready, /newer/);
});

await test('reference: obligation and regulation dates carry their source', () => {
  const o = RR.reference.obligations(OBL)[0];
  assert.equal(o.due, OBL.obligations[0].deadline);
  assert.match(o.data.date_source, /obligations\.json/);
  const g = RR.reference.regulations(APP).find((x) => x.data.ref === 'AMLR');
  assert.equal(g.due, '2027-07-10');
  assert.match(g.data.date_source, /applicability\.json/);
  assert.equal(RR.reference.regChanges([{ id: 'x', title: 't', deadline: '' }])[0].due, null, 'no deadline in the feed -> no due date');
});

await test('utilities: csv guards formulas, dates handle month ends and working days', () => {
  assert.equal(RR.util.csv([['=1+1', 'a,b', 'say "hi"']]), "'=1+1,\"a,b\",\"say \"\"hi\"\"\"");
  assert.equal(RR.util.csv([[-30, '-2.5', '-x']]), "-30,-2.5,'-x", 'numbers are not treated as formulas');
  assert.equal(RR.dates.addMonths('2026-01-31', 1), '2026-02-28');
  assert.equal(RR.dates.addMonths('2026-11-15', 3), '2027-02-15');
  assert.equal(RR.dates.addWorkingDays('2026-10-16', 1), '2026-10-19');
  assert.equal(RR.dates.diff('2026-10-20', '2026-10-17'), 3);
});


/* ═════════════════ Issues and actions: migration onto the spine ═════════════════ */
const LEGACY = {
  v: 1, seq: 7, firm: 'CF Bank (fictional)',
  cfg: { sla: { critical: { sla: 20, mgmt: 5, board: 15 } }, dueSoon: 10, shortcuts: false },
  saved: [{ id: 'sf1', name: 'Mine', f: { status: 'all', owner: 'T. Nguyen' } }],
  dismissed: { 'ctl-02|last test failed|2026-10-01': '2026-10-05' },
  report: { commentary: 'Board commentary', by: 'T. Nguyen' },
  issues: [
    { id: 'ISS-001', title: 'Missing ID evidence', description: 'Nine files', source: 'regulator_inspection', source_ref: 'SI-1', severity: 'critical', root_cause: 'Process design', owner: 'T. Nguyen', lod: '1LOD',
      status: 'awaiting_validation', opened_on: '2026-08-01', due_on: '2026-10-10', closed_on: '', closed_by: '', closure_note: '', submitted_on: '2026-10-05', accepted: null,
      control_ids: ['ctl-01', 'ctl-gone'], obligation_ids: ['AMLR-art19', 'AMLR-nope'], demo: false,
      actions: [{ id: 'A1', title: 'Back-fill', owner: 'Sanmi O.', due_on: '2026-10-20', status: 'open', done_on: '', evidence: '' },
        { id: 'A2', title: 'Retrain', owner: 'IT Change Board', due_on: '2026-09-20', status: 'done', done_on: '2026-09-18', evidence: 'Attendance log' }],
      history: [{ d: '2026-08-01', t: 'Opened' }, { d: '2026-09-18', t: 'Action done: Retrain' }, { d: '2026-10-05', t: 'Submitted for validation' }] },
    { id: 'ISS-002', title: 'Old finding', severity: 'low', owner: 'R. Haddad', lod: '2LOD', status: 'closed', opened_on: '2026-05-01', due_on: '2026-07-01', closed_on: '2026-06-20', closed_by: 'T. Nguyen', closure_note: 'Re-tested',
      control_ids: [], obligation_ids: [], actions: [], history: [{ d: '2026-06-20', t: 'Closed. Validated by T. Nguyen (on time)' }] },
    { id: 'ISS-003', title: 'Accepted for now', severity: 'medium', owner: 'Unassigned', status: 'risk_accepted', opened_on: '2026-04-01', due_on: '2026-06-30',
      accepted: { by: 'Board', until: '2027-01-31', on: '2026-07-01', rationale: 'Vendor replaced in Q1' }, control_ids: [], obligation_ids: [], actions: [], history: [] },
    { id: 'ISS-005', title: 'Raised from a change', severity: 'high', owner: 'M. Van Damme', status: 'in_progress', opened_on: '2026-10-10', due_on: '2026-11-10', demo: true, impact_ref: 'abc12345',
      control_ids: [], obligation_ids: ['AMLR-art26'], actions: [], history: [{ d: '2026-10-10', t: 'Opened from regulatory impact assessment (RegWatch item abc12345)' }] }
  ]
};
const LEG_KEY = 'regradar-actions';
async function onDevice(extra = {}) {
  const st = fakeStorage(Object.assign({ [LEG_KEY]: JSON.stringify(LEGACY) }, extra), [LEG_KEY]);
  const s = await spine({ adapter: RR.adapters.localStorage({ storage: st }) });
  s.importModules((k) => st.getItem(k), { controls: CTL });
  return { st, s, read: (k) => st.getItem(k) };
}

await test('actions: the store maps the page statuses onto the work workflow exactly as config.json says', () => {
  for (const [k, v] of Object.entries(AS.TO_ENTITY)) assert.equal(CFG.bridge.issue_status[k], v, `issue_status.${k}`);
  assert.equal(CFG.bridge.action_status.done, AS.TO_ENTITY.closed);
  assert.equal(CFG.bridge.action_status.open, AS.TO_ENTITY.open);
  for (const [e, v] of Object.entries(AS.FROM_ENTITY)) assert.equal(AS.TO_ENTITY[v], e, `${e} round-trips`);
  assert.ok(RR.migrations.some((m) => m.id === 'actions'), 'the migration is registered with the spine');
});

await test('migration: legacy key in, spine records out (findings, tasks, people, links, log, settings)', async () => {
  const { st, s, read } = await onDevice();
  const before = st.getItem(LEG_KEY);
  const rep = RR.runMigrations(s, read);
  await s.flush();
  assert.equal(rep.length, 1);
  assert.equal(rep[0].status, 'migrated');
  assert.equal(rep[0].issues, 4);
  assert.equal(rep[0].tasks, 2);
  // findings and statuses on the work workflow, the page's finer status kept
  const f1 = s.get('ISS-001');
  assert.equal(f1.type, 'issue');
  assert.equal(f1.status, 'review', 'awaiting_validation -> review');
  assert.equal(f1.data.module_status, 'awaiting_validation');
  assert.equal(f1.due, '2026-10-10');
  assert.equal(f1.data.priority, 'critical', 'severity uses the spine priority scale');
  assert.equal(f1.data.source, 'regulator_inspection');
  assert.equal(f1.data.root_cause, 'Process design');
  assert.equal(f1.data.opened_on, '2026-08-01');
  assert.equal(f1.origin, 'spine', 'writable everywhere, not a mirror');
  assert.ok(s.isWritable(f1));
  assert.equal(s.get('ISS-002').status, 'done');
  assert.equal(s.get('ISS-002').data.closed_by, 'T. Nguyen');
  assert.equal(s.get('ISS-003').status, 'done');
  assert.equal(s.get('ISS-003').data.module_status, 'risk_accepted');
  assert.deepEqual(s.get('ISS-003').data.accepted, { by: 'Board', until: '2027-01-31', on: '2026-07-01', rationale: 'Vendor replaced in Q1' });
  assert.equal(s.get('ISS-003').owner, null, '"Unassigned" is no owner');
  assert.equal(s.get('ISS-005').status, 'in_progress');
  assert.equal(s.get('ISS-005').data.demo, true);
  assert.equal(s.get('ISS-005').data.impact_ref, 'abc12345');
  assert.equal(s.list('issue').length, 4);
  // owners are team members, reusing people the bridge or the demo already knows
  assert.equal(f1.owner, 'person:t-nguyen');
  assert.equal(s.get('person:t-nguyen').type, 'person');
  assert.equal(s.get('person:m-van-damme').title, 'M. Van Damme');
  // remediation actions are tasks linked "fixes" to their finding
  const tasks = s.linked('ISS-001', 'fixes', 'in');
  assert.deepEqual(tasks.map((t) => t.id).sort(), ['TSK-ISS-001-A1', 'TSK-ISS-001-A2']);
  const a2 = s.get('TSK-ISS-001-A2');
  assert.equal(a2.type, 'action');
  assert.equal(a2.status, 'done');
  assert.equal(a2.owner, null, '"IT Change Board" is not a person: it stays plain text on the task');
  assert.equal(a2.data.owner_text, 'IT Change Board');
  assert.equal(s.get('person:it-change-board'), null);
  assert.equal(a2.data.evidence, 'Attendance log');
  assert.equal(a2.data.done_on, '2026-09-18');
  assert.equal(a2.data.kind, 'remediation');
  assert.equal(a2.data.priority, 'critical', 'a task carries its finding\'s priority');
  assert.equal(s.get('TSK-ISS-001-A1').status, 'todo');
  assert.equal(s.get('TSK-ISS-001-A1').due, '2026-10-20');
  // controls and obligations are typed links; ids that do not exist yet are kept, not lost
  assert.deepEqual(s.linked('ISS-001', 'concerns').map((e) => e.id), ['CTL:ctl-01']);
  assert.deepEqual(s.linked('ISS-001', 'addresses').map((e) => e.id), ['OBL:AMLR-art19']);
  assert.deepEqual(f1.data.unresolved_links, { controls: ['ctl-gone'], obligations: ['AMLR-nope'] });
  // the page's own settings and the firm name moved too
  assert.equal(s.getSetting('firm_name'), 'CF Bank (fictional)');
  assert.equal(s.getSetting(AS.PREFS).cfg.dueSoon, 10);
  assert.equal(s.getSetting(AS.PREFS).saved[0].name, 'Mine');
  assert.equal(s.getSetting(AS.PREFS).report.commentary, 'Board commentary');
  // marked done in the spine settings, event log intact and attributed to the module import
  const done = s.getSetting(AS.DONE);
  assert.equal(done.issues, 4); assert.equal(done.tasks, 2); assert.equal(done.seq, 7);
  assert.equal(s.verifyLog().ok, true);
  assert.ok(s.history('ISS-001').every((e) => e.actor === 'system:bridge'));
  assert.equal(s.history('ISS-001')[0].action, 'import');
  // the old key is only read: untouched, never written, never removed
  assert.equal(st.getItem(LEG_KEY), before);
  assert.ok(st.writes.every((k) => k.startsWith('regradar-spine-')), 'only regradar-spine-* keys are written');
});

await test('migration: idempotent (second run, lost marker, reopened spine) and the old key stays', async () => {
  const { st, s, read } = await onDevice();
  RR.runMigrations(s, read);
  await s.flush();
  const nEv = s.events().length, nEnt = s.list(null, { archived: true }).length;
  assert.equal(RR.runMigrations(s, read)[0].status, 'already');
  assert.equal(s.events().length, nEv, 'a second run writes nothing');
  // a fresh spine over the same storage (page reload) does nothing either
  const s2 = await spine({ adapter: RR.adapters.localStorage({ storage: st }) });
  assert.equal(RR.runMigrations(s2, read)[0].status, 'already');
  assert.equal(s2.list('issue').length, 4);
  // even if the "done" marker were lost, no record is duplicated or overwritten
  const s3 = await spine();
  RR.runMigrations(s3, read);
  s3.update('ISS-001', { title: 'Edited after the import' });
  s3.setSetting(AS.DONE, null);
  const again = RR.runMigrations(s3, read)[0];
  assert.equal(again.issues, 0);
  assert.equal(again.skipped, 4);
  assert.equal(s3.get('ISS-001').title, 'Edited after the import', 'user edits survive a repeated import');
  assert.equal(s3.list('issue', { archived: true }).length, 4);
  assert.equal(s.list(null, { archived: true }).length, nEnt);
  assert.ok(st.getItem(LEG_KEY), 'backup still there');
});

await test('migration: nothing to import, unreadable data, empty register, blocked storage', async () => {
  const s = await spine();
  assert.equal(RR.runMigrations(s, () => null)[0].status, 'none');
  assert.equal(s.getSetting(AS.DONE), null, 'no legacy data -> no marker, nothing invented');
  assert.equal(s.list(['issue', 'action']).length, 0);
  assert.equal(RR.runMigrations(s, () => '{broken')[0].status, 'unreadable');
  assert.equal(RR.runMigrations(s, () => '[1,2]')[0].status, 'unreadable');
  assert.equal(s.getSetting(AS.DONE), null, 'unreadable data is not marked done, so it is retried and never lost');
  assert.equal(RR.runMigrations(s, () => { throw new Error('blocked'); })[0].status, 'blocked');
  // an empty register (all issues removed) is a real state: mark it done so the demo is not re-seeded
  assert.equal(RR.runMigrations(s, () => JSON.stringify({ v: 1, seq: 3, issues: [] }))[0].status, 'migrated');
  assert.equal(s.getSetting(AS.DONE).seq, 3);
  // odd old data does not throw: unknown severity/status, missing ids and titles
  const s2 = await spine();
  const r = RR.runMigrations(s2, () => JSON.stringify({ issues: [{ severity: 'urgent', status: 'weird', actions: [{}] }, null, { id: 'X-9', title: 'Plain', due_on: 'not a date' }] }))[0];
  assert.equal(r.status, 'migrated');
  assert.equal(s2.list('issue').length, 3);
  assert.equal(s2.get('ISS-001').data.priority, 'medium');
  assert.equal(s2.get('ISS-001').status, 'todo');
  assert.equal(s2.get('X-9').due, null);
  assert.equal(s2.list('action').length, 1);
});

await test('migration: an id already used by another record gets a new one; old bridge mirrors are retired', async () => {
  const s = await spine();
  s.create('issue', { id: 'ISS-001', title: 'Created on the board' });
  // a copy mirrored by the old bridge (before this module moved)
  s.create('issue', { id: 'ISS:ISS-009', title: 'Old mirror', status: 'todo' }, { origin: 'module:actions', _bridge: true, action: 'import' });
  s.create('action', { id: 'TSK:ISS-009:A1', title: 'Old mirrored action', status: 'todo' }, { origin: 'module:actions', _bridge: true, action: 'import' });
  s.link('fixes', 'TSK:ISS-009:A1', 'ISS:ISS-009', { _bridge: true, module: 'actions', silent: true });
  const rep = RR.runMigrations(s, () => JSON.stringify(LEGACY))[0];
  assert.equal(rep.renamed.length, 1);
  assert.deepEqual(rep.renamed[0], ['ISS-001', 'ISS-008'], 'new id continues after the old sequence');
  assert.equal(s.get('ISS-001').title, 'Created on the board', 'the existing record is untouched');
  assert.equal(s.get('ISS-008').title, 'Missing ID evidence');
  assert.ok(s.get('TSK-ISS-008-A1'));
  const r = s.importModules(() => null, { controls: CTL });
  assert.equal(r.archived, 2, 'the old read-only copies are archived');
  assert.equal(s.get('ISS:ISS-009').archived, true);
  assert.match(s.history('ISS:ISS-009').pop().note, /now keeps its records in the spine/);
  assert.equal(s.list('issue').filter((i) => String(i.origin).startsWith('module:')).length, 0);
  assert.equal(s.verifyLog().ok, true);
});

await test('migration: the board (any spine client) can now edit the records, and the page sees it', async () => {
  const { s, read } = await onDevice();
  RR.runMigrations(s, read);
  const mlro = 'person:t-nguyen';
  // what board.js does: move, assign, update, link, archive
  assert.equal(s.move('ISS-005', 'review').status, 'review');
  assert.equal(s.move('TSK-ISS-001-A1', 'in_progress').status, 'in_progress');
  s.assign('TSK-ISS-001-A1', 'person:m-van-damme');
  s.update('ISS-005', { due: '2026-12-01', data: { priority: 'medium', description: 'Edited on the board' } });
  s.link('concerns', 'TSK-ISS-001-A1', 'CTL:ctl-01');
  const t = s.create('action', { title: 'Dispatched on the board', owner: mlro, due: '2026-11-01', data: { kind: 'remediation', priority: 'high' } }, { action: 'dispatch' });
  s.link('fixes', t.id, 'ISS-002');
  assert.equal(s.history('ISS-005').length, 3, 'import + move + update');
  assert.equal(s.verifyLog().ok, true);
  // the page reads the same records back
  const R = AS.read(s, { defaultDue: () => '2026-12-31' });
  const by = (id) => R.issues.find((i) => i.id === id);
  assert.equal(by('ISS-005').status, 'awaiting_validation', 'board "Waiting for approval" shows as awaiting validation');
  assert.equal(by('ISS-005').severity, 'medium');
  assert.equal(by('ISS-005').description, 'Edited on the board');
  assert.equal(by('ISS-005').due_on, '2026-12-01');
  const a1 = by('ISS-001').actions.find((a) => a.id === 'A1');
  assert.equal(a1.status, 'open', 'a task in progress is still an open action');
  assert.equal(a1.owner, 'M. Van Damme');
  assert.deepEqual(by('ISS-002').actions.map((a) => a.title), ['Dispatched on the board'], 'a task dispatched on the board and linked to a finding is its action');
  assert.equal(by('ISS-002').actions[0].owner, 'T. Nguyen');
  // done on the board = closed, with the date taken from the log
  s.move('ISS-005', 'done');
  const closed = AS.read(s).issues.find((i) => i.id === 'ISS-005');
  assert.equal(closed.status, 'closed');
  assert.match(closed.closed_on, /^\d{4}-\d{2}-\d{2}$/);
});

await test('page model: reads back exactly what the old page held (display parity)', async () => {
  const { s, read } = await onDevice();
  RR.runMigrations(s, read);
  const R = AS.read(s);
  assert.equal(R.seq, 7);
  assert.equal(R.firm, 'CF Bank (fictional)');
  assert.deepEqual(R.issues.map((i) => i.id), ['ISS-001', 'ISS-002', 'ISS-003', 'ISS-005']);
  for (const old of LEGACY.issues) {
    const got = R.issues.find((i) => i.id === old.id);
    for (const k of ['title', 'severity', 'status', 'source', 'source_ref', 'root_cause', 'lod', 'opened_on', 'due_on', 'closed_on', 'closed_by', 'closure_note', 'submitted_on', 'description']) {
      assert.equal(got[k], old[k] == null ? (k === 'source' ? 'self_identified' : k === 'lod' ? '1LOD' : '') : old[k], `${old.id}.${k}`);
    }
    assert.equal(got.owner, /unassigned/i.test(old.owner || '') ? '' : old.owner, `${old.id}.owner`);
    assert.deepEqual(got.accepted, old.accepted || null, `${old.id}.accepted`);
    assert.equal(!!got.demo, !!old.demo);
    assert.deepEqual(got.control_ids, old.control_ids, `${old.id}.control_ids (unresolved ids come back too)`);
    assert.deepEqual(got.obligation_ids, old.obligation_ids);
    assert.deepEqual(got.actions.map((a) => [a.id, a.title, a.owner, a.due_on, a.status, a.done_on, a.evidence]),
      (old.actions || []).map((a) => [a.id, a.title, a.owner, a.due_on, a.status, a.done_on, a.evidence]), `${old.id}.actions`);
    // history: the old lines come back first, in order
    assert.deepEqual(AS.history(s, got).map((h) => [h.d, h.t]), (old.history || []).map((h) => [h.d, h.t]), `${old.id}.history`);
  }
});

await test('page model: edits write only what changed, with notes in the event log; the board\'s changes are not overwritten', async () => {
  const { s, read } = await onDevice();
  RR.runMigrations(s, read);
  const R = AS.read(s);
  const get = (id) => R.issues.find((i) => i.id === id);
  const n0 = s.events().length;
  assert.deepEqual(AS.commit(s, R, {}).errors, []);
  assert.equal(s.events().length, n0, 'committing an unchanged register writes nothing');
  // the board moves ISS-005 while the page is open
  s.move('ISS-005', 'review');
  // the page edits a different field of the same finding, and a status flow on another
  const i5 = get('ISS-005'), i1 = get('ISS-001');
  i5.title = 'Raised from a change (renamed)';
  i1.status = 'closed'; i1.closed_on = '2026-10-12'; i1.closed_by = 'R. Haddad'; i1.closure_note = 'Checked 40 files';
  AS.commit(s, R, { 'ISS-005': ['Title updated'], 'ISS-001': ['Closed. Validated by R. Haddad (2 days after due date)'] });
  assert.equal(s.get('ISS-005').status, 'review', 'the board move survives a page save that did not touch the status');
  assert.equal(s.get('ISS-005').title, 'Raised from a change (renamed)');
  assert.equal(s.get('ISS-001').status, 'done');
  assert.equal(s.get('ISS-001').data.module_status, 'closed');
  assert.equal(s.get('ISS-001').data.closed_by, 'R. Haddad');
  const last = s.history('ISS-001').pop();
  assert.equal(last.action, 'move');
  assert.equal(last.note, 'Closed. Validated by R. Haddad (2 days after due date)');
  assert.deepEqual(last.changes.status, ['review', 'done']);
  // action flow: mark done, add, edit, remove
  i1.actions[0].status = 'done'; i1.actions[0].done_on = '2026-10-11'; i1.actions[0].evidence = 'Retrieval log';
  i1.actions.push({ id: 'A3', title: 'Re-test a sample', owner: 'Priya K.', due_on: '2026-11-15', status: 'open', done_on: '', evidence: '' });
  i1.actions = i1.actions.filter((a) => a.id !== 'A2');
  AS.commit(s, R, { 'ISS-001': ['Action done: Back-fill'] });
  assert.equal(s.get('TSK-ISS-001-A1').status, 'done');
  assert.equal(s.get('TSK-ISS-001-A1').data.evidence, 'Retrieval log');
  assert.equal(s.get('TSK-ISS-001-A2').archived, true, 'a removed action is archived, its history stays');
  assert.equal(s.get('TSK-ISS-001-A3').owner, 'person:priya-k', 'a new owner becomes a team member');
  assert.deepEqual(s.linked('ISS-001', 'fixes', 'in').map((t) => t.id).sort(), ['TSK-ISS-001-A1', 'TSK-ISS-001-A3']);
  assert.ok(s.history('TSK-ISS-001-A1').some((e) => e.note === 'Action done: Back-fill'));
  const back = AS.read(s).issues.find((i) => i.id === 'ISS-001');
  assert.deepEqual(back.actions.map((a) => a.id), ['A1', 'A3']);
  // owner, severity (tasks follow), due date, links, accepted risk
  i1.owner = 'R. Haddad'; i1.severity = 'high'; i1.due_on = '2026-10-30';
  i1.control_ids = ['ctl-02']; i1.obligation_ids = [];
  AS.commit(s, R, { 'ISS-001': ['Owner changed from T. Nguyen to R. Haddad'] });
  assert.equal(s.get('ISS-001').owner, 'person:r-haddad');
  assert.equal(s.get('ISS-001').data.priority, 'high');
  assert.equal(s.get('TSK-ISS-001-A3').data.priority, 'high', 'open tasks follow the finding\'s severity');
  assert.equal(s.get('TSK-ISS-001-A1').data.priority, 'critical', 'finished tasks keep theirs');
  assert.deepEqual(s.linked('ISS-001', 'concerns').map((e) => e.id), ['CTL:ctl-02']);
  assert.deepEqual(s.linked('ISS-001', 'addresses').map((e) => e.id), []);
  assert.equal(s.get('ISS-001').data.unresolved_links, null);
  // a note with no field change becomes a comment event
  AS.commit(s, R, { 'ISS-002': ['Reviewed in committee'] });
  assert.equal(s.history('ISS-002').pop().action, 'comment');
  // the history the page shows: old lines, then the log, with the board's own events described
  const h = AS.history(s, get('ISS-001')).map((x) => x.t);
  assert.equal(h[0], 'Opened');
  assert.ok(h.includes('Closed. Validated by R. Haddad (2 days after due date)'));
  assert.ok(h.includes('Action done: Back-fill'));
  assert.ok(!h.some((t) => /module_status|import|settings/i.test(t)));
  const h5 = AS.history(s, get('ISS-005')).map((x) => x.t);
  assert.ok(h5.some((t) => /status changed from In progress to Waiting for approval/.test(t)), 'a board move reads in plain words');
  assert.equal(s.verifyLog().ok, true);
  // delete an issue: archived with its actions, kept in the log
  R.issues = R.issues.filter((i) => i.id !== 'ISS-002');
  AS.commit(s, R, {});
  assert.equal(s.get('ISS-002').archived, true);
  assert.equal(s.list('issue').some((i) => i.id === 'ISS-002'), false);
  // the same id can be re-added later (CSV import after a delete)
  R.issues.push(AS.normIssue({ id: 'ISS-002', title: 'Back again', actions: [{ title: 'Do it' }] }, 0));
  AS.commit(s, R, {});
  assert.equal(s.get('ISS-002').archived, false);
  assert.equal(s.get('ISS-002').title, 'Back again');
  assert.equal(s.verifyLog().ok, true);
});

await test('page model: new issues and impact-created findings continue the old numbering; prefs and firm are saved', async () => {
  const { s, read } = await onDevice();
  RR.runMigrations(s, read);
  const R = AS.read(s);
  // the impact page's flow: page-shaped issue without an id
  const ids = AS.createFindings(s, [{ title: 'Review EBA guideline', severity: 'high', owner: 'R. Haddad', lod: '2LOD', status: 'open', source: 'self_identified', source_ref: 'RegWatch item abc12345', due_on: '2026-11-30', control_ids: ['ctl-01'], obligation_ids: ['AMLR-art26'], actions: [], impact_ref: 'abc12345', history: [{ d: '2026-10-17', t: 'Opened from regulatory impact assessment (RegWatch item abc12345)' }] }]);
  assert.deepEqual(ids, ['ISS-008'], 'after the old seq (7)');
  assert.equal(s.get('ISS-008').status, 'todo');
  assert.equal(s.get('ISS-008').owner, 'person:r-haddad');
  assert.deepEqual(s.linked('ISS-008', 'addresses').map((e) => e.id), ['OBL:AMLR-art26']);
  assert.equal(s.history('ISS-008')[0].note, 'Opened from regulatory impact assessment (RegWatch item abc12345)');
  assert.equal(AS.peek((k) => (k === 'regradar-spine-entities' ? JSON.stringify(Object.fromEntries(s.exportAll().entities.map((e) => [e.id, e]))) : null)).ids['ISS-008'], 1);
  // a deleted id is never reused
  R.issues = R.issues.filter((i) => i.id !== 'ISS-005'); AS.commit(s, R, {});
  assert.equal(AS.createFindings(s, [{ title: 'Next' }])[0], 'ISS-009');
  // the page adds an issue (id assigned by the page from the seq)
  const R2 = AS.read(s);
  R2.issues.push(AS.normIssue({ id: 'ISS-010', title: 'From quick add', severity: 'low', owner: '', due_on: '2026-12-01', opened_on: '2026-10-17' }, 0));
  AS.commit(s, R2, { 'ISS-010': ['Opened'] });
  assert.equal(s.history('ISS-010')[0].note, 'Opened');
  assert.equal(AS.nextSeq(s), 10);
  // prefs and firm
  R2.firm = 'Other Bank'; assert.deepEqual(AS.commit(s, R2, {}).errors, []);
  assert.equal(s.getSetting('firm_name'), 'Other Bank');
  assert.equal(AS.savePrefs(s, R2, { cfg: { dueSoon: 5 }, saved: [], dismissed: {}, report: { commentary: 'x', by: '' } }), true);
  assert.equal(AS.savePrefs(s, R2, { cfg: { dueSoon: 5 }, saved: [], dismissed: {}, report: { commentary: 'x', by: '' } }), false, 'unchanged prefs write nothing');
  assert.equal(AS.read(s).prefs.cfg.dueSoon, 5);
});

await test('owners: only people become team members; boards, committees and functions stay plain text', async () => {
  for (const n of ['T. Nguyen', 'Priya K.', 'Sanmi O.', 'M. Van Damme', 'Jean-Luc Dupont', 'R. Haddad']) assert.equal(AS.looksLikePerson(n), true, n);
  for (const n of ['IT Change Board', 'Risk Committee', 'Onboarding team', 'HR', 'KYC', 'Steering group', 'Third party vendor', 'Finance department', '12345']) assert.equal(AS.looksLikePerson(n), false, n);
  const s = await spine();
  s.create('person', { id: 'person:hr', title: 'HR', data: { role: 'staff' } });   // a team member with that name is that person
  const ids = AS.createFindings(s, [{ title: 'Owners', owner: 'Risk Committee', actions: [
    { title: 'a', owner: 'IT Change Board' }, { title: 'b', owner: 'Priya K.' }, { title: 'c', owner: 'HR' }, { title: 'd', owner: 'Unassigned' }] }]);
  const f = s.get(ids[0]);
  assert.equal(f.owner, null); assert.equal(f.data.owner_text, 'Risk Committee');
  const t = (k) => s.get('TSK-' + ids[0] + '-A' + k);
  assert.equal(t(1).owner, null); assert.equal(t(1).data.owner_text, 'IT Change Board');
  assert.equal(t(2).owner, 'person:priya-k'); assert.equal(t(2).data.owner_text, '');
  assert.equal(t(3).owner, 'person:hr', 'an existing team member of that name wins');
  assert.equal(t(4).owner, null); assert.equal(t(4).data.owner_text, '');
  assert.deepEqual(s.people().map((p) => p.title).sort(), ['HR', 'Priya K.'], 'no team member invented for a board or a committee');
  // the page reads the text back, and editing the owner switches between the two forms
  const R = AS.read(s), i = R.issues[0];
  assert.equal(i.owner, 'Risk Committee');
  assert.deepEqual(i.actions.map((a) => a.owner), ['IT Change Board', 'Priya K.', 'HR', '']);
  i.owner = 'R. Haddad'; i.actions[0].owner = 'Sanmi O.'; i.actions[1].owner = 'Audit Committee';
  AS.commit(s, R, {});
  assert.equal(s.get(ids[0]).owner, 'person:r-haddad'); assert.equal(s.get(ids[0]).data.owner_text, '');
  assert.equal(t(1).owner, 'person:sanmi-o'); assert.equal(t(1).data.owner_text, '');
  assert.equal(t(2).owner, null); assert.equal(t(2).data.owner_text, 'Audit Committee');
  assert.deepEqual(AS.read(s).issues[0].actions.map((a) => a.owner), ['Sanmi O.', 'Audit Committee', 'HR', '']);
});

await test('demo: the tracker demo register has demo origin, so "Remove demo data" clears it and the briefing demo is not doubled', async () => {
  const s = await spine();
  s.importModules(() => null, { controls: CTL });
  const ids = AS.createFindings(s, [{ id: 'ISS-001', title: 'Demo finding', demo: true, severity: 'high', owner: 'T. Nguyen', actions: [{ title: 'Fix it', owner: 'IT Change Board' }], history: [{ d: '2026-10-01', t: 'Opened (demo data)' }] }],
    { action: 'import', seed: true, origin: 'demo', note: 'Demo data (fictional)' });
  assert.equal(s.get(ids[0]).origin, 'demo');
  assert.equal(s.get('TSK-ISS-001-A1').origin, 'demo');
  assert.equal(s.hasDemo(), true);
  assert.equal(AS.read(s).issues[0].demo, true);
  const r = s.loadDemo(DEMO);
  assert.ok(r.skipped.includes('Findings'), 'the briefing demo does not add a second set of findings');
  assert.equal(s.list('issue').length, 1);
  assert.ok(s.clearDemo() >= 2);
  assert.equal(AS.read(s).issues.length, 0, 'the tracker no longer shows them');
  assert.equal(s.get('ISS-001').archived, true);
  // after removal the briefing demo loads its own findings again
  s.loadDemo(DEMO);
  assert.equal(s.list('issue').length, DEMO.issues.length);
  assert.equal(AS.read(s).issues.length, DEMO.issues.length, 'and the tracker shows those, in its own fields');
  assert.equal(s.verifyLog().ok, true);
});

await test('page model: peek counts issues on the device before and after the migration', async () => {
  const { st, s, read } = await onDevice();
  let p = AS.peek(read);
  assert.equal(p.exists, true); assert.equal(p.n, 4); assert.equal(p.migrated, false); assert.ok(p.ids['ISS-003']);
  RR.runMigrations(s, read);
  await s.flush();
  p = AS.peek(read);
  assert.equal(p.migrated, true); assert.equal(p.n, 4); assert.ok(p.ids['ISS-001']);
  assert.equal(AS.peek(() => null).exists, false);
  assert.equal(AS.peek(() => '{broken').unreadable, true);
  void st;
});

console.log(`\n${n - failed}/${n} passed`);
process.exit(failed ? 1 : 0);
