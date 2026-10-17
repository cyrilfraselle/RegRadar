// Data spine tests (docs/rr-core.js). Plain Node 18+, no dependencies. From the repo root:
//   node tests/spine.test.mjs
// Covers: config integrity, entity create/link/query, the append-only event log and its hash chain,
// adapter swap (memory -> memory, localStorage with a fake storage, Postgres stub), the read-only
// import bridge on fixture module data, demo data, schema version guard. Exits 1 on any failure.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const RR = require(path.join(root, 'docs', 'rr-core.js'));
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
  // issues and actions
  assert.equal(s.get('ISS:ISS-001').status, 'review', 'awaiting_validation -> review');
  assert.equal(s.get('ISS:ISS-002').status, 'done');
  assert.equal(s.get('TSK:ISS-001:A1').owner, 'person:sanmi-o');
  assert.deepEqual(s.linked('TSK:ISS-001:A1', 'fixes').map((e) => e.id), ['ISS:ISS-001']);
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
  assert.throws(() => s.move('ISS:ISS-001', 'done'), /Issues and actions/);
  assert.throws(() => s.link('addresses', 'ISS:ISS-001', 'OBL:AMLR-art20'), /Managed on/);
  assert.throws(() => s.update('OBL:AMLR-art19', { title: 'x' }), /repository/);
  // but a spine task may link to module records
  const mine = s.create('action', { title: 'Mine' });
  s.link('fixes', mine.id, 'ISS:ISS-001');

  // idempotent: nothing changes -> no new events
  const nEv = s.events().length;
  const r2 = s.importModules((k) => st.getItem(k), ref);
  assert.equal(r2.created + r2.updated + r2.archived, 0);
  assert.equal(s.events().length, nEv);

  // a module change syncs; a removed record is archived (and stays in the log)
  const act = JSON.parse(FIX['regradar-actions']);
  act.issues[0].status = 'closed';
  act.issues.pop();
  const st2 = fakeStorage(Object.assign({}, FIX, { 'regradar-actions': JSON.stringify(act) }), MODULE_KEYS);
  const r3 = s.importModules((k) => st2.getItem(k), ref);
  assert.equal(r3.updated, 1);
  assert.equal(r3.archived, 1);
  assert.equal(s.get('ISS:ISS-001').status, 'done');
  assert.equal(s.list('issue').length, 1);
  assert.equal(s.list('issue', { archived: true }).length, 2);
  assert.deepEqual(s.history('ISS:ISS-001').map((e) => e.action), ['import', 'link', 'sync']);

  // an unreadable key is reported and its records are kept, not archived
  const st3 = fakeStorage(Object.assign({}, FIX, { 'regradar-actions': '{broken' }), MODULE_KEYS);
  const r4 = s.importModules((k) => st3.getItem(k), ref);
  assert.equal(r4.modules.find((m) => m.module === 'actions').error, 'unreadable JSON');
  assert.equal(s.get('ISS:ISS-001').archived, false);
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

await test('demo: skips policies/cases when the modules already have them', async () => {
  const st = fakeStorage(FIX);
  const s = await spine();
  s.importModules((k) => st.getItem(k), { controls: CTL });
  const r = s.loadDemo(DEMO);
  assert.ok(r.skipped.includes('Policies') && r.skipped.includes('Cases') && r.skipped.includes('Findings'));
  assert.equal(s.list('policy').filter((p) => p.origin === 'demo').length, 0);
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
  assert.equal(RR.dates.addMonths('2026-01-31', 1), '2026-02-28');
  assert.equal(RR.dates.addMonths('2026-11-15', 3), '2027-02-15');
  assert.equal(RR.dates.addWorkingDays('2026-10-16', 1), '2026-10-19');
  assert.equal(RR.dates.diff('2026-10-20', '2026-10-17'), 3);
});

console.log(`\n${n - failed}/${n} passed`);
process.exit(failed ? 1 : 0);
