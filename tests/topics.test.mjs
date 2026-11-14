// Topic view data checks (docs/data/topics.json). Plain Node 18+, no dependencies. From the repo root:
//   node tests/topics.test.mjs
// Checks: structure of the topic tree; every article exists in docs/data/laws/<celex>_EN.json; every
// extract (law layer and AMLA mandates) appears verbatim in its article and, when stated, in its
// paragraph (whitespace normalised, nothing else); point markers exist in the extract; every obligation
// id exists in docs/data/obligations.json; every source reference resolves; a subtopic that claims a law
// layer has at least one extract; firm-type ids come from docs/data/applicability.json; at least 8
// subtopics are seeded and the natural-person CDD subtopic covers the parts the owner asked for.
// Also runs the page's pure helpers (docs/topics.js) on the data. Exits 1 on any failure.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const J = (p) => JSON.parse(fs.readFileSync(path.join(root, 'docs', p), 'utf8'));
const TOP = J('data/topics.json');
const OBL = J('data/obligations.json');
const APP = J('data/applicability.json');
const LAWS = {};
const law = (celex) => LAWS[celex] || (LAWS[celex] = J('data/laws/' + celex + '_EN.json'));
const N = (s) => String(s).replace(/[\s ]+/g, ' ').trim();

let n = 0, failed = 0;
function test(name, fn) {
  n++;
  try { fn(); console.log('ok   ' + name); }
  catch (e) { failed++; console.log('FAIL ' + name + '\n     ' + String(e && e.message || e).split('\n').join('\n     ')); }
}

function article(celex, id) {
  const a = law(celex).articles.find((x) => x.id === String(id));
  assert.ok(a, `article ${id} not found in ${celex}`);
  return a;
}
function paragraph(celex, art, para) {
  const t = article(celex, art).text.replace(/ /g, ' ');
  if (!para) return N(t);
  const m = new RegExp('(^|\\n)' + para + '\\.\\s').exec(t);
  assert.ok(m, `paragraph ${para} not found in ${celex} Art. ${art}`);
  const start = m.index + m[0].length;
  const m2 = new RegExp('\\n' + (+para + 1) + '\\.\\s').exec(t.slice(start));
  return N(t.slice(start, m2 ? start + m2.index : undefined));
}
function checkExtract(x, where) {
  assert.ok(x && typeof x === 'object', where + ': extract is not an object');
  assert.ok(LAWS[x.celex] || fs.existsSync(path.join(root, 'docs', 'data', 'laws', x.celex + '_EN.json')), where + ': unknown celex ' + x.celex);
  assert.ok(typeof x.article === 'string' && x.article, where + ': article missing');
  assert.ok(typeof x.text === 'string' && x.text.length >= 20, where + ': extract text missing or too short');
  assert.equal(x.text, N(x.text), where + ': extract must be whitespace-normalised');
  assert.ok(typeof x.locator === 'string' && x.locator.indexOf('Art. ' + x.article) !== -1, where + ': locator must name Art. ' + x.article);
  assert.ok(typeof x.label === 'string' && x.label, where + ': label missing');
  const seg = paragraph(x.celex, x.article, x.paragraph);
  assert.ok(seg.indexOf(x.text) !== -1, `${where}: extract is NOT verbatim in ${x.celex} Art. ${x.article}${x.paragraph ? '(' + x.paragraph + ')' : ''}:\n"${x.text.slice(0, 120)}..."`);
  (x.points || []).forEach((p) => assert.ok(x.text.indexOf('(' + p + ') ') !== -1, `${where}: point (${p}) not in the extract`));
  (x.applies_to || []).forEach((f) => assert.ok(FIRMS.has(f), `${where}: unknown firm type ${f}`));
}

const FIRMS = new Set(APP.entities.map((e) => e.id));
const OIDS = new Set(OBL.obligations.map((o) => o.id));
const SUBS = [];
(TOP.topics || []).forEach((t) => (t.children || []).forEach((c) => SUBS.push(Object.assign({ parent: t.id }, c))));

test('top-level shape', () => {
  assert.ok(TOP._meta && TOP._meta.method && TOP._meta.disclaimer, '_meta with method and disclaimer');
  assert.ok(Array.isArray(TOP.topics), 'topics is an array');
  assert.ok(TOP.topics.length >= 8 && TOP.topics.length <= 14, 'about 10 big topics, got ' + TOP.topics.length);
  assert.ok(TOP.sources && typeof TOP.sources === 'object', 'sources catalogue');
  assert.equal(TOP._meta.layers.length, 4, 'four layers');
  assert.equal(typeof TOP._meta.sources.enabled, 'boolean', '_meta.sources.enabled is a boolean');
});

test('ids are unique, topics have 2 to 8 subtopics, every node has title and "what it is"', () => {
  const seen = new Set();
  TOP.topics.forEach((t) => {
    [t].concat(t.children || []).forEach((x) => {
      assert.match(x.id, /^[a-z0-9-]+$/, 'id ' + x.id);
      assert.ok(!seen.has(x.id), 'duplicate id ' + x.id); seen.add(x.id);
      assert.ok(x.title && x.title.length <= 80, 'title of ' + x.id);
      assert.ok(x.what && x.what.length >= 40 && x.what.length <= 220, '"what" of ' + x.id + ' should be about 2 lines (40-220 chars), got ' + (x.what || '').length);
    });
    assert.ok(t.children.length >= 2 && t.children.length <= 8, t.id + ' has ' + t.children.length + ' subtopics');
  });
});

test('every article reference exists and every law extract is verbatim', () => {
  SUBS.forEach((s) => {
    assert.ok(Array.isArray(s.extracts), s.id + ': extracts array');
    s.extracts.forEach((x, i) => checkExtract(x, s.id + '#' + i));
  });
});

test('the verbatim check rejects a changed word and a wrong paragraph', () => {
  const x = SUBS.find((s) => s.id === 'cdd-natural').extracts[0];
  assert.throws(() => checkExtract(Object.assign({}, x, { text: x.text.replace('shall', 'should') }), 'tampered'), /NOT verbatim/);
  assert.throws(() => checkExtract(Object.assign({}, x, { paragraph: '3' }), 'wrong paragraph'), /NOT verbatim/);
});

test('no subtopic has an empty law layer', () => {
  SUBS.forEach((s) => assert.ok(s.extracts.length > 0, s.id + ' claims a law layer but has no extract'));
});

test('at least 8 subtopics seeded, and in at least 8 big topics', () => {
  const seeded = SUBS.filter((s) => s.extracts.length);
  assert.ok(seeded.length >= 8, 'seeded subtopics: ' + seeded.length);
  assert.ok(new Set(seeded.map((s) => s.parent)).size >= 8, 'big topics with a seeded subtopic');
});

test('every obligation id exists in docs/data/obligations.json', () => {
  SUBS.forEach((s) => {
    assert.ok(Array.isArray(s.obligations), s.id + ': obligations array');
    s.obligations.forEach((o) => assert.ok(OIDS.has(o), s.id + ': unknown obligation ' + o));
  });
});

test('obligations named by a subtopic belong to an article it quotes or that it explains', () => {
  // A register entry "AMLR-artNN" should match an article quoted in the subtopic, so the checklist and the extracts agree.
  SUBS.forEach((s) => {
    const arts = new Set(s.extracts.filter((x) => x.celex === '32024R1624').map((x) => x.article));
    s.obligations.forEach((o) => {
      const art = (/^AMLR-art(\d+)$/.exec(o) || [])[1];
      if (art) assert.ok(arts.has(art), `${s.id}: obligation ${o} but no extract from Art. ${art}`);
    });
  });
});

test('source references resolve; AMLA mandates are verbatim; guidance entries never carry invented content', () => {
  const ids = new Set(Object.keys(TOP.sources));
  Object.entries(TOP.sources).forEach(([id, src]) => {
    assert.equal(src.id, id, 'source key and id differ: ' + id);
    assert.ok(['amla', 'guidance'].includes(src.layer), id + ': layer');
    assert.ok(src.authority && src.title && src.kind, id + ': authority, title, kind');
    assert.equal(src.status, 'not_collected', id + ': until the collector publishes it, status is not_collected');
    assert.ok(!('extracts' in src) && !('text' in src), id + ': no content before collection');
    if (src.layer === 'amla') checkExtract(src.mandate, 'source ' + id);
    else assert.ok(src.expected && src.expected.length < 260, id + ': "expected" says what it will contain');
  });
  SUBS.forEach((s) => (s.sources || []).forEach((r) => assert.ok(ids.has(r), s.id + ': unknown source ' + r)));
});

test('firm-type filters use applicability.json ids', () => {
  SUBS.forEach((s) => (s.applies_to || []).forEach((f) => assert.ok(FIRMS.has(f), s.id + ': unknown firm type ' + f)));
});

test('natural-person CDD is complete for the law layer', () => {
  const s = SUBS.find((x) => x.id === 'cdd-natural');
  assert.ok(s, 'cdd-natural exists');
  const have = new Set(s.extracts.map((x) => x.article + (x.paragraph ? '(' + x.paragraph + ')' : '')));
  const need = {
    'identification and verification': ['20(1)', '22(1)', '22(6)'],
    'beneficial owner / persons acted for': ['22(7)'],
    'purpose and nature': ['25'],
    'ongoing monitoring': ['26(1)', '26(2)'],
    timing: ['23(1)', '23(2)'],
    'simplified and enhanced triggers': ['20(2)', '33(5)', '34(1)'],
    'CDD cannot be completed': ['21(1)', '21(3)']
  };
  Object.entries(need).forEach(([part, list]) => list.forEach((a) => assert.ok(have.has(a), 'cdd-natural misses ' + part + ': Art. ' + a)));
  const pts = s.extracts.filter((x) => x.article === '20' && x.paragraph === '1').flatMap((x) => x.points || []);
  ['a', 'b', 'c', 'd', 'e', 'g', 'h', 'i'].forEach((p) => assert.ok(pts.includes(p), 'cdd-natural misses Art. 20(1)(' + p + ')'));
  assert.ok(s.extracts.some((x) => x.article === '22' && x.paragraph === '1' && /for a natural person: \(i\) all names and surnames;/.test(x.text)), 'Art. 22(1)(a) data points');
});

test('page helpers: highlight rules, search, citation, CSV (docs/topics.js)', () => {
  const RT = require(path.join(root, 'docs', 'topics.js'));
  const h = RT.highlight('Obliged entities shall not disclose; they may report within 5 working days of at least EUR 10 000 and 25 % by 10 July 2027.');
  assert.match(h, /<mark class="hl-proh">shall not<\/mark>/);
  assert.match(h, /<mark class="hl-perm">may<\/mark>/);
  assert.match(h, /<mark class="hl-time">within 5 working days<\/mark>/);
  assert.match(h, /<mark class="hl-num">EUR 10 000<\/mark>/);
  assert.match(h, /<mark class="hl-num">25 %<\/mark>/);
  assert.match(h, /<mark class="hl-time">by 10 July 2027<\/mark>/);
  assert.equal(RT.highlight('<b>x</b> shall'), '&lt;b&gt;x&lt;/b&gt; <mark class="hl-duty">shall</mark>', 'escapes before marking');
  const hits = RT.search(TOP, 'passport');
  assert.ok(hits.some((x) => x.id === 'cdd-natural'), 'search finds cdd-natural by "passport"');
  assert.ok(RT.search(TOP, 'Art. 69').some((x) => x.id === 'str-report'), 'search by article');
  const sub = SUBS.find((x) => x.id === 'cdd-natural');
  const cite = RT.citation(sub.extracts[0], TOP._meta.law);
  assert.match(cite, /^".+" Regulation \(EU\) 2024\/1624 \(AMLR\), Art\. 20\(1\)/);
  const csv = RT.topicCsv(sub, TOP, OBL.obligations, [], null);
  assert.ok(csv.split('\n')[0].startsWith('"layer",'), 'CSV header');
  assert.ok(csv.indexOf('Art. 22(1)') !== -1, 'CSV has the extracts');
  assert.ok(RT.csvCell('=1+1').startsWith("\"'="), 'CSV formula injection guarded');
});

console.log(`\n${n - failed}/${n} passed`);
if (failed) process.exit(1);
