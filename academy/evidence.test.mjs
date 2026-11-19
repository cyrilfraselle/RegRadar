// Plain node test (no dependencies) for docs/academy-evidence.js:
// integrity code, record build/verify, CSV round trip, import, merge, refresher/overdue logic, storage keys.
// Run from the repo root:  node academy/evidence.test.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const E = createRequire(import.meta.url)(path.join(root, 'docs', 'academy-evidence.js'));
let n = 0;
const t = (name, fn) => { try { fn(); n++; } catch (e) { console.error('FAIL ' + name + '\n  ' + (e.message || e)); process.exitCode = 1; } };

const tracks = [1, 2, 3, 4, 5].map((i) => ({ id: 'm' + i, no: i, title: 'Module ' + i }));
const MODS = tracks.map((x) => x.id);
const map = { m1: { obligations: ['AMLR-art19', 'AMLR-art20'] }, m2: { obligations: [] } };
const scope = E.scopes(tracks)[0];
const comps = [
  { module: 'm1', completedAt: '2026-01-15T10:00:00.000Z', score: 4, max: 4, contentVersion: '1.0.0' },
  { module: 'm2', completedAt: '2026-02-01T10:00:00.000Z', score: 3, max: 4, contentVersion: null },
];
const mk = (learner) => E.buildRecord({ learner, tracks, completions: comps, scope, issued: '2026-10-18', content: { version: '1.0.0', date: '2026-10-18' }, map });

/* ── hash ── */
t('canonical sorts keys and ignores undefined', () => {
  assert.equal(E.canonical({ b: 1, a: [2, { d: 1, c: undefined }] }), '{"a":[2,{"d":1}],"b":1}');
});
t('code format and golden vector (stable across engines and versions)', () => {
  const c = E.codeOf({ a: 1 });
  assert.match(c, /^RR-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/);
  assert.equal(c, E.codeOf({ a: 1 }));
  assert.notEqual(c, E.codeOf({ a: 2 }));
  // golden vectors: if these change, every code ever issued stops matching
  assert.equal(E.cyrb53('abc'), 5059922895146125);
  assert.equal(E.cyrb53(''), 3338908027751811);
  assert.equal(c, 'RR-34B7-7CC1-D846');
});

/* ── record ── */
t('record has learner, version, scope, statement and a matching code', () => {
  const r = mk({ name: ' Ada  Lovelace ', role: 'Analyst', firm: 'CF Bank' });
  assert.equal(r.format, 'regradar-academy-completions');
  assert.equal(r.learner.name, 'Ada Lovelace');
  assert.equal(r.completions.length, 2);
  assert.equal(r.completions[0].contentVersion, '1.0.0');
  assert.equal(r.completions[1].contentVersion, null);
  assert.deepEqual(r.completions[0].obligations, ['AMLR-art19', 'AMLR-art20']);
  assert.match(r.statement, /self-attested by the device record/);
  assert.match(r.integrity.note, /not a digital signature/);
  assert.equal(E.verifyRecord(r), 'match');
});
t('editing any content breaks the code; the code survives a JSON round trip', () => {
  const r = mk({ name: 'Ada', role: '', firm: '' });
  assert.equal(E.verifyRecord(JSON.parse(JSON.stringify(r))), 'match');
  const x = JSON.parse(JSON.stringify(r)); x.completions[0].score = 1; assert.equal(E.verifyRecord(x), 'mismatch');
  const y = JSON.parse(JSON.stringify(r)); y.learner.name = 'Eve'; assert.equal(E.verifyRecord(y), 'mismatch');
  const z = JSON.parse(JSON.stringify(r)); delete z.integrity; assert.equal(E.verifyRecord(z), 'none');
});
t('same record on the same day gives the same code; a different learner does not', () => {
  assert.equal(mk({ name: 'Ada' }).integrity.code, mk({ name: 'Ada' }).integrity.code);
  assert.notEqual(mk({ name: 'Ada' }).integrity.code, mk({ name: 'Bob' }).integrity.code);
});
t('scope limits the record to its lessons; seasons are groups of three', () => {
  const sc = E.scopes(tracks);
  assert.deepEqual(sc.map((s) => s.id), ['all', 'season-1', 'season-2', 'lesson:m1', 'lesson:m2', 'lesson:m3', 'lesson:m4', 'lesson:m5']);
  const s1 = sc.find((s) => s.id === 'season-1');
  const r = E.buildRecord({ learner: {}, tracks, completions: comps.concat([{ module: 'm5', completedAt: '2026-03-01T00:00:00Z', score: 4, max: 4 }]), scope: s1, issued: '2026-10-18', content: {}, map });
  assert.deepEqual(r.completions.map((c) => c.module), ['m1', 'm2']);
});

/* ── dates ── */
t('addMonths clamps to the end of a short month and crosses years', () => {
  assert.equal(E.addMonths('2025-01-31', 1), '2025-02-28');
  assert.equal(E.addMonths('2024-01-31', 1), '2024-02-29');
  assert.equal(E.addMonths('2025-11-15', 12), '2026-11-15');
  assert.equal(E.addMonths('2025-12-31', 2), '2026-02-28');
});
t('dateOnly accepts ISO and date strings and rejects nonsense', () => {
  assert.equal(E.dateOnly('2026-02-01T10:00:00.000Z'), '2026-02-01');
  assert.equal(E.dateOnly('2026-02-30'), null);
  assert.equal(E.dateOnly('not a date'), null);
  assert.equal(E.dateOnly(''), null);
});

/* ── refresher logic ── */
t('status boundaries: overdue only strictly after the due date', () => {
  const s = (asOf, months = 12) => E.statusOf('2025-10-18', asOf, months, 30).status;
  assert.equal(s('2026-10-18'), 'due-soon');   // due today: still valid
  assert.equal(s('2026-10-19'), 'overdue');
  assert.equal(s('2026-09-18'), 'due-soon');   // exactly 30 days before
  assert.equal(s('2026-09-17'), 'current');    // 31 days before
  assert.equal(s('2030-01-01', 0), 'current'); // no refresher
  assert.equal(s('2025-01-01'), 'current');    // completion dated after the report date
});

const L = (name, ...ms) => ({ name, role: '', firm: 'CF Bank', completions: ms.map(([module, on, v]) => ({ module, completedAt: on, score: 3, max: 4, contentVersion: v || null })) });
const src = (name, ...learners) => ({ name, kind: 'json', learners, integrity: 'match', warnings: [], ok: true });
const OPT = { modules: MODS, required: ['m1', 'm2', 'm3'], months: 12, dueSoonDays: 30, asOf: '2026-10-18' };

t('merge: outstanding, overdue, due-soon and current per learner and module', () => {
  const r = E.merge([src('a.json', L('Ada', ['m1', '2026-06-01'], ['m2', '2025-09-01'], ['m3', '2025-11-01'])), src('b.json', L('Bob', ['m1', '2026-05-01']))], OPT);
  const ada = r.learners.find((x) => x.name === 'Ada'), bob = r.learners.find((x) => x.name === 'Bob');
  assert.equal(ada.cells.m1.status, 'current');
  assert.equal(ada.cells.m2.status, 'overdue');          // due 2026-09-01
  assert.equal(ada.cells.m2.dueOn, '2026-09-01');
  assert.equal(ada.cells.m3.status, 'due-soon');         // due 2026-11-01, 14 days away
  assert.equal(ada.summary.upToDate, false);
  assert.equal(bob.cells.m2.status, 'outstanding');
  assert.equal(bob.summary.outstanding, 2);
  assert.equal(r.byModule.m1.pct, 100);
  assert.equal(r.byModule.m2.overdue, 1); assert.equal(r.byModule.m2.outstanding, 1); assert.equal(r.byModule.m2.pct, 0);
});
t('merge: a faked date changes the verdict', () => {
  const s = [src('a.json', L('Ada', ['m1', '2026-06-01'], ['m2', '2026-06-01'], ['m3', '2026-06-01']))];
  assert.equal(E.merge(s, OPT).learners[0].summary.upToDate, true);
  assert.equal(E.merge(s, { ...OPT, asOf: '2027-06-01' }).learners[0].summary.upToDate, true);     // due today
  const late = E.merge(s, { ...OPT, asOf: '2027-06-02' });
  assert.equal(late.learners[0].summary.upToDate, false);
  assert.equal(late.coverage.overdue, 3);
  assert.equal(E.merge(s, { ...OPT, asOf: '2027-06-02', months: 24 }).learners[0].summary.upToDate, true);
});
t('merge: the same learner in two files is one learner and the latest completion wins', () => {
  const r = E.merge([src('a.json', L('Ada', ['m1', '2025-01-01', '1.0.0'])), src('b.json', L('ada', ['m1', '2026-08-01', '1.1.0'], ['m2', '2026-08-02']))], OPT);
  assert.equal(r.learners.length, 1);
  assert.equal(r.learners[0].cells.m1.completedOn, '2026-08-01');
  assert.equal(r.learners[0].cells.m1.version, '1.1.0');
  assert.equal(r.learners[0].cells.m1.repeats, 1);
  assert.deepEqual(r.learners[0].files, ['a.json', 'b.json']);
});
t('merge: same name at two firms stays two learners; unnamed learners stay separate per file', () => {
  const a = L('Ada', ['m1', '2026-06-01']); const b = { ...L('Ada', ['m1', '2026-06-01']), firm: 'Other' };
  assert.equal(E.merge([src('a', a), src('b', b)], OPT).learners.length, 2);
  assert.equal(E.merge([src('a', L('', ['m1', '2026-06-01'])), src('b', L('', ['m1', '2026-06-01']))], OPT).learners.length, 2);
});
t('merge: optional modules show completions but are never outstanding; coverage numbers add up', () => {
  const r = E.merge([src('a', L('Ada', ['m1', '2026-06-01'], ['m4', '2026-06-01'])), src('b', L('Bob', ['m1', '2026-06-01'], ['m2', '2026-06-01'], ['m3', '2026-06-01']))], OPT);
  const ada = r.learners.find((x) => x.name === 'Ada');
  assert.equal(ada.cells.m4.status, 'current'); assert.equal(ada.cells.m4.required, false);
  assert.equal(ada.cells.m5.status, 'none');
  assert.equal(ada.summary.required, 3); assert.equal(ada.summary.outstanding, 2);
  assert.deepEqual(r.coverage, { learners: 2, upToDate: 1, upToDatePct: 50, slots: 6, valid: 4, validPct: 67, overdue: 0, outstanding: 2 });
  assert.deepEqual(r.period, { first: '2026-06-01', last: '2026-06-01' });
  assert.deepEqual(r.versions, { 'not recorded': 5 });
});
t('merge: no required modules, no learners, no crash', () => {
  const r = E.merge([], { ...OPT, required: [] });
  assert.equal(r.coverage.upToDatePct, null); assert.equal(r.coverage.validPct, null);
  const r2 = E.merge([src('a', L('Ada', ['m1', '2026-06-01']))], { ...OPT, required: [] });
  assert.equal(r2.learners[0].summary.upToDate, false);
});
t('register code is stable and reacts to a change', () => {
  const s = [src('a', L('Ada', ['m1', '2026-06-01']))];
  assert.equal(E.merge(s, OPT).code, E.merge(s, OPT).code);
  assert.notEqual(E.merge(s, OPT).code, E.merge(s, { ...OPT, months: 6 }).code);
});

/* ── CSV ── */
t('csv cells: quoting and spreadsheet-formula neutralising', () => {
  assert.equal(E.csvCell('a,b'), '"a,b"');
  assert.equal(E.csvCell('say "hi"'), '"say ""hi"""');
  assert.equal(E.csvCell('=HYPERLINK("x")'), '"\'=HYPERLINK(""x"")"');
  assert.equal(E.csvCell('+1'), "'+1"); assert.equal(E.csvCell('@a'), "'@a"); assert.equal(E.csvCell('-x'), "'-x");
  assert.equal(E.csvCell(3), '3'); assert.equal(E.csvCell(null), '');
});
t('csv parser: quotes, commas in cells, CRLF, BOM, blank lines', () => {
  const rows = E.parseCSV('﻿a,b\r\n"x,1","y ""q"""\r\n\r\nlast,');
  assert.deepEqual(rows, [['a', 'b'], ['x,1', 'y "q"'], ['last', '']]);
});
t('record CSV has the documented columns, the Art. 12 reference and round-trips through the importer', () => {
  const r = mk({ name: '=cmd|x', role: 'Head, AML', firm: 'CF "Bank"' });
  const csv = E.recordCSV(r);
  const head = E.parseCSV(csv)[0];
  assert.deepEqual(head, ['learner', 'role', 'firm', 'module_id', 'module_title', 'completed_on', 'score', 'max_score', 'content_version', 'related_amlr_obligations', 'art12_reference']);
  assert.match(csv, /AMLR-art19\|AMLR-art20/); assert.match(csv, /Art\. 12/);
  const s = E.importCSV(csv, 'x.csv', MODS);
  assert.equal(s.ok, true); assert.equal(s.learners.length, 1);
  const l = s.learners[0];
  assert.equal(l.name, '=cmd|x'); assert.equal(l.role, 'Head, AML'); assert.equal(l.firm, 'CF "Bank"');
  assert.deepEqual(l.completions.map((c) => [c.module, c.completedAt, c.score, c.max, c.contentVersion]), [['m1', '2026-01-15', 4, 4, '1.0.0'], ['m2', '2026-02-01', 3, 4, null]]);
});
t('csv import: several learners, unknown modules, bad dates, fraction scores, placeholder rows', () => {
  const csv = 'learner,firm,module_id,completed_on,score\nAda,F,m1,2026-01-01,3/4\nAda,F,m9,2026-01-01,1\nBob,F,m2,31/12/2026,2\nBob,F,m3,,\nCid,F,m1,2026-02-02T09:00:00Z,4\n';
  const s = E.importCSV(csv, 'team.csv', MODS);
  assert.deepEqual(s.learners.map((x) => [x.name, x.completions.length]), [['Ada', 1], ['Bob', 0], ['Cid', 1]]);
  assert.equal(s.learners[0].completions[0].score, 3); assert.equal(s.learners[0].completions[0].max, 4);
  assert.ok(s.warnings.some((w) => /not in this version/.test(w)));
  assert.ok(s.warnings.some((w) => /unreadable date/.test(w)));
  assert.equal(E.importCSV('foo,bar\n1,2', 'bad.csv', MODS).ok, false);
});
t('register CSV lists outstanding required modules, status and due date, and re-imports cleanly', () => {
  const r = E.merge([src('a', L('Ada', ['m1', '2025-06-01']))], OPT);
  const rows = E.parseCSV(E.registerCSV(r, { m1: 'One', m2: 'Two' }, map));
  assert.equal(rows[0][11], 'status'); assert.equal(rows[0][12], 'refresher_due_on');
  assert.deepEqual(rows.slice(1).map((x) => [x[3], x[11], x[12]]), [['m1', 'overdue', '2026-06-01'], ['m2', 'outstanding', ''], ['m3', 'outstanding', '']]);
  const back = E.importCSV(E.registerCSV(r, {}, map), 'reg.csv', MODS);
  assert.equal(back.learners.length, 1); assert.equal(back.learners[0].completions.length, 1);
});

/* ── JSON import ── */
t('json import: valid record is read with its integrity result; tampering is flagged; junk is refused', () => {
  const r = JSON.parse(JSON.stringify(mk({ name: 'Ada', role: '', firm: 'F' })));
  const ok = E.importJSON(r, 'ada.json', MODS);
  assert.equal(ok.ok, true); assert.equal(ok.integrity, 'match'); assert.equal(ok.learners[0].completions.length, 2);
  r.completions[0].score = 0;
  assert.equal(E.importJSON(r, 'ada.json', MODS).integrity, 'mismatch');
  assert.equal(E.importJSON({ hello: 1 }, 'x.json', MODS).ok, false);
  assert.equal(E.importJSON(null, 'x.json', MODS).ok, false);
  const odd = JSON.parse(JSON.stringify(mk({ name: 'Ada' }))); odd.completions.push({ module: 'zzz', completedAt: '2026-01-01' }, { module: 'm3', completedAt: 'nope' });
  const w = E.importJSON(odd, 'odd.json', MODS); assert.equal(w.learners[0].completions.length, 2); assert.equal(w.warnings.length, 2);
});

/* ── storage: only the new keys are touched ── */
t('clearKeys removes the learner and register-config keys and nothing else', () => {
  const m = new Map([['regradar-academy-training', 'T'], ['regradar-academy-progress', 'P'], ['regradar-academy-misses', 'M'], ['regradar-theme', 'dark']]);
  const store = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
  E.saveLearner({ name: ' Ada ', role: '', firm: 'F' }, store);
  E.saveConfig({ required: ['m1'], months: 6, dueSoonDays: 30 }, store);
  assert.deepEqual(E.loadLearner(store), { name: 'Ada', role: '', firm: 'F' });
  assert.deepEqual(E.loadConfig(store), { v: 1, required: ['m1'], months: 6, dueSoonDays: 30 });
  E.clearKeys(store);
  assert.equal(m.has(E.KEYS.learner), false); assert.equal(m.has(E.KEYS.config), false);
  assert.deepEqual([...m.keys()].sort(), ['regradar-academy-misses', 'regradar-academy-progress', 'regradar-academy-training', 'regradar-theme']);
  assert.deepEqual(E.loadLearner(store), { name: '', role: '', firm: '' });
  assert.equal(E.loadConfig(store).months, 12);
});
t('saving an empty learner removes the key; garbage in storage is ignored', () => {
  const m = new Map([[E.KEYS.learner, '{not json'], [E.KEYS.config, '{"v":1,"months":-5,"required":"x"}']]);
  const store = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) };
  assert.deepEqual(E.loadLearner(store), { name: '', role: '', firm: '' });
  assert.deepEqual(E.loadConfig(store), { v: 1, required: null, months: 12, dueSoonDays: 30 });
  E.saveLearner({ name: 'A' }, store); E.saveLearner({ name: '', role: ' ', firm: '' }, store);
  assert.equal(m.has(E.KEYS.learner), false);
});

if (process.exitCode) { console.error('evidence tests failed'); } else console.log('ok: ' + n + ' evidence tests (integrity code, record, CSV, import, merge, refresher/overdue, storage keys)');
