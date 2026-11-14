// Deadlines calendar checks (docs/calendar.js, docs/regwatch-data.js .ics). Plain Node 18+. From the repo root:
//   node tests/calendar.test.mjs
// Checks: strict date parsing, day arithmetic across month ends and leap years, month grids, tolerant
// loading (missing, empty, malformed), classification, filters and windows, and the .ics output
// (UID, DTSTAMP, all-day dates, escaping, 75-octet folding, CRLF) on the real deadlines.json.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const C = require(path.join(root, 'docs', 'calendar.js'));
const REAL = JSON.parse(fs.readFileSync(path.join(root, 'docs', 'data', 'sources', 'deadlines.json'), 'utf8'));

let n = 0, failed = 0;
function test(name, fn) {
  n++;
  try { fn(); console.log('ok   ' + name); }
  catch (e) { failed++; console.log('FAIL ' + name + '\n     ' + String(e && e.message || e).split('\n').join('\n     ')); }
}

test('parseDay is strict: real dates only', () => {
  assert.ok(C.parseDay('2028-02-29') != null);
  for (const bad of ['2027-02-29', '2026-13-01', '2026-00-10', '2026-11-31', '26-11-14', '', null, '2026-11-14T10:00:00Z']) assert.equal(C.parseDay(bad), null, String(bad));
});
test('day arithmetic across month ends, years and leap days', () => {
  assert.equal(C.addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(C.addDays('2028-02-28', 1), '2028-02-29');
  assert.equal(C.addDays('2027-02-28', 1), '2027-03-01');
  assert.equal(C.daysBetween('2026-11-14', '2027-02-12'), 90);
  assert.equal(C.daysBetween('2026-11-14', '2026-11-13'), -1);
  assert.equal(C.daysBetween('x', '2026-11-13'), null);
  assert.equal(C.daysBetween('2026-03-28', '2026-03-30'), 2, 'no daylight saving drift');
});
test('todayLocal uses local calendar day', () => {
  assert.equal(C.todayLocal(new Date(2026, 10, 14, 23, 59)), '2026-11-14');
  assert.equal(C.todayLocal(new Date(2026, 0, 1, 0, 0)), '2026-01-01');
});
test('month grid: Monday first, whole weeks, correct month flags', () => {
  const g = C.monthGrid(2026, 10);   // November 2026 starts on a Sunday
  assert.ok(g.every((w) => w.length === 7));
  assert.equal(g[0][6].iso, '2026-11-01'); assert.equal(g[0][6].inMonth, true); assert.equal(g[0][0].inMonth, false);
  assert.equal(g.length, 6);
  assert.equal(g.flat().filter((c) => c.inMonth).length, 30);
  const f = C.monthGrid(2026, 1);    // February 2026 starts Sunday... 28 days
  assert.equal(f.flat().filter((c) => c.inMonth).length, 28);
  assert.deepEqual(C.shiftMonth({ y: 2026, m: 11 }, 1), { y: 2027, m: 0 });
  assert.deepEqual(C.shiftMonth({ y: 2026, m: 0 }, -1), { y: 2025, m: 11 });
});
test('tolerant loading: missing, empty, malformed', () => {
  for (const f of [null, undefined, {}, [], { deadlines: null }, { deadlines: 'x' }, { deadlines: [null, 1, 'a', {}] }, { deadlines: [{ date: 'soon', title: 'x' }] }]) assert.deepEqual(C.normalise(f), []);
  const one = C.normalise({ deadlines: [{ date: '2027-07-10', title: 'AMLR applies' }] });
  assert.equal(one.length, 1); assert.ok(one[0].id); assert.equal(one[0].confidence, 'medium', 'unknown confidence is not claimed as high');
});
test('real file: normalised, sorted, every item has a valid date, title, authority and topic', () => {
  const all = C.normalise(REAL);
  assert.ok(all.length >= 90);
  for (let i = 1; i < all.length; i++) assert.ok(all[i - 1].date <= all[i].date);
  for (const d of all) { assert.ok(C.parseDay(d.date) != null); assert.ok(d.title && d.authKey && d.topic && d.jur); }
  assert.equal(new Set(all.map((d) => d.id)).size, all.length, 'ids unique');
});
test('classification: authority, jurisdiction and topic', () => {
  assert.deepEqual(C.authorityOf({ source: 'amla-consultations-list', url: 'https://www.amla.europa.eu/x' }), { key: 'AMLA', jur: 'EU' });
  assert.deepEqual(C.authorityOf({ source: 'eurlex-cellar-ojl-recent', url: 'https://eur-lex.europa.eu/x' }), { key: 'OJ', jur: 'EU' });
  assert.deepEqual(C.authorityOf({ source: 'laws', url: 'https://eur-lex.europa.eu/x' }), { key: 'LAWS', jur: 'EU' });
  assert.equal(C.authorityOf({ source: 'x', url: 'https://www.nbb.be/en/y' }).jur, 'BE');
  assert.equal(C.authorityOf({ source: 'x', url: 'https://www.fsma.be/y' }).key, 'FSMA');
  assert.equal(C.topicOf('Draft RTS on pecuniary sanctions, administrative measures (AMLA)'), 'aml');
  assert.equal(C.topicOf('Council Decision (CFSP) 2026/2362'), 'sanctions');
  assert.equal(C.topicOf('MiCA applies'), 'crypto');
  assert.equal(C.topicOf('Something else'), 'other');
});
test('filters and windows (today 2026-11-14)', () => {
  const all = C.normalise(REAL), today = '2026-11-14';
  const w90 = C.inWindow(all, '90', today);
  assert.ok(w90.length > 0 && w90.every((d) => d.date >= today && d.date <= '2027-02-12'));
  assert.ok(C.inWindow(all, 'all', today).length > w90.length);
  assert.ok(C.inWindow(all, 'past', today).every((d) => d.date < today));
  assert.equal(C.inWindow(all, '90', today).filter((d) => d.date === today).length, C.inWindow(all, '0', today).length, 'today is included');
  const amla = C.filter(all, { auth: 'AMLA' }); assert.ok(amla.length && amla.every((d) => d.authKey === 'AMLA'));
  assert.equal(C.filter(all, { jur: 'BE' }).length, 0, 'no Belgian dates in the feed yet');
  const k = C.filter(all, { kind: 'consultation closes', topic: 'aml' }); assert.ok(k.every((d) => d.kind === 'consultation closes' && d.topic === 'aml'));
  assert.equal(C.filter(all, {}).length, all.length);
});

function unfold(s) { return s.replace(/\r\n /g, ''); }
test('.ics: structure, UID, DTSTAMP, all-day dates, CRLF', () => {
  const ics = C.toIcs([{ id: 'abc', date: '2026-12-31', kind: 'application date', title: 'X applies', url: 'https://e.eu/x', confidence: 'high', quote: '', loc: '', method: 'structured' }], '2026-11-14T12:00:00.000Z');
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n'));
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
  assert.ok(!/[^\r]\n/.test(ics), 'CRLF only');
  assert.ok(ics.includes('UID:abc@regradar-regwatch'));
  assert.ok(ics.includes('DTSTAMP:20261114T120000Z'));
  assert.ok(ics.includes('DTSTART;VALUE=DATE:20261231') && ics.includes('DTEND;VALUE=DATE:20270101'), 'end is the next day, across the year end');
  assert.ok(ics.includes('URL:https://e.eu/x'));
});
test('.ics: escaping, medium confidence flagged, invalid dates skipped', () => {
  const ics = C.toIcs([
    { id: 'm1', date: '2027-02-28', kind: 'reporting deadline', title: 'A, B; C', url: 'law.html?celex=1', confidence: 'medium', quote: 'must report by 1 March', loc: 'Art. 5', method: 'text' },
    { id: 'bad', date: '2027-02-30', kind: 'application date', title: 'broken', url: '', confidence: 'high', quote: '', loc: '', method: '' }
  ], '2026-11-14T12:00:00Z');
  const u = unfold(ics);
  assert.ok(u.includes('SUMMARY:Reporting deadline: A\\, B\\; C'));
  assert.ok(u.includes('must report by 1 March') && u.includes('medium confidence'));
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 1);
  assert.ok(!ics.includes('URL:law.html'), 'relative links are not exported as URL');
  assert.ok(ics.includes('DTEND;VALUE=DATE:20270301'));
});
test('.ics on the real file: unique UIDs, lines of at most 75 octets, unfolds to valid properties', () => {
  const all = C.normalise(REAL), ics = C.toIcs(all, '2026-11-14T12:00:00Z');
  const lines = ics.split('\r\n'); lines.pop();
  for (const l of lines) assert.ok(Buffer.byteLength(l, 'utf8') <= 75, 'too long: ' + l.slice(0, 40));
  const uids = unfold(ics).match(/^UID:.*$/gm);
  assert.equal(uids.length, all.length); assert.equal(new Set(uids).size, all.length);
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, (ics.match(/END:VEVENT/g) || []).length);
  assert.ok(unfold(ics).split('\r\n').every((l) => l === '' || /^[A-Z-]+(;[^:]*)?:/.test(l)), 'every unfolded line is a property');
});
test('.ics folding never splits a multi-byte character', () => {
  const t = 'Éé’–'.repeat(40);
  const ics = C.toIcs([{ id: 'u', date: '2027-01-01', kind: 'application date', title: t, url: '', confidence: 'high', quote: '', loc: '', method: '' }], '2026-11-14T12:00:00Z');
  assert.ok(!ics.includes('�'));
  assert.ok(unfold(ics).includes('SUMMARY:Applies: ' + t) || unfold(ics).includes(t));
  for (const l of ics.split('\r\n')) assert.ok(Buffer.byteLength(l, 'utf8') <= 75);
});

console.log(`\n${n - failed}/${n} passed`);
process.exit(failed ? 1 : 0);
