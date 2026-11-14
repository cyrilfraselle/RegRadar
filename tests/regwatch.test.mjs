// RegWatch adapter checks (docs/regwatch-data.js). Plain Node 18+, no dependencies. From the repo root:
//   node tests/regwatch.test.mjs
// Checks: the topic map (every target exists in docs/data/topics.json, every engine tag in
// docs/data/sources/topic-tags.json is mapped or listed as unmatched); the feed adapter on the real
// feed.json (primary first, news never ranked above primary, clustered sources kept beneath the lead);
// the fallback to the legacy archive when the feed is empty or missing; deadlines attached to their
// document with the quoted sentence; the .ics export; and the filters. Exits 1 on any failure.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const D = require(path.join(root, 'docs', 'regwatch-data.js'));
const J = (p) => JSON.parse(fs.readFileSync(path.join(root, 'docs', p), 'utf8'));
const exists = (p) => fs.existsSync(path.join(root, 'docs', p));

let n = 0, failed = 0;
function test(name, fn) {
  n++;
  try { fn(); console.log('ok   ' + name); }
  catch (e) { failed++; console.log('FAIL ' + name + '\n     ' + String(e && e.message || e).split('\n').join('\n     ')); }
}

const TOPICS = J('data/topics.json');
const topicIds = new Set();
TOPICS.topics.forEach((t) => { topicIds.add(t.id); (t.children || []).forEach((c) => topicIds.add(c.id)); });
const TAGS = J('data/sources/topic-tags.json').tags.map((t) => t.id);

test('every mapped topic id exists in docs/data/topics.json', () => {
  for (const [tag, id] of Object.entries(D.TOPIC_MAP)) assert.ok(topicIds.has(id), `${tag} -> ${id} is not a topic`);
});
test('every engine topic tag is mapped or listed as unmatched', () => {
  for (const t of TAGS) assert.ok(D.TOPIC_MAP[t] || D.TOPIC_UNMATCHED.includes(t), `tag ${t} neither mapped nor unmatched`);
  for (const t of D.TOPIC_UNMATCHED) assert.ok(!D.TOPIC_MAP[t], `${t} is both mapped and unmatched`);
  assert.equal(D.topicHref('cdd-natural-person'), 'topics.html#topic=cdd-natural');
  assert.equal(D.topicHref('payments-emoney'), '');
});

test('authorities: Belgian supervisors are BE and named once', () => {
  assert.deepEqual(D.authority('BNB — Supervision (circulars, decisions)'), { key: 'NBB', name: 'National Bank of Belgium', jur: 'BE' });
  assert.equal(D.authority('BNB / NBB — Publications').key, 'NBB');
  assert.equal(D.authority('FSMA').jur, 'BE');
  assert.equal(D.authority('EU Publications Office (EUR-Lex data)').key, 'OJ');
  assert.equal(D.authority('EUR-Lex — Legislative proposals').key, 'COM');
  assert.equal(D.authority('ECB — Banking Supervision publications').key, 'ECB');
  assert.equal(D.AUTH_ORDER[0], 'NBB');
});
test('status: draft, final, in force, information', () => {
  assert.equal(D.status('draft (consultation closed)', 'consultation'), 'draft');
  assert.equal(D.status('final (submitted to the Commission)', 'rts_its_draft'), 'final');
  assert.equal(D.status('in force', 'legislation'), 'inforce');
  assert.equal(D.status('binding', 'legislation', 'Proposal for a Regulation', 'eurlex_proposals'), 'draft');
  assert.equal(D.status('informational', 'supervisory_communication'), 'info');
});

if (exists('data/sources/feed.json')) {
  const feed = J('data/sources/feed.json');
  const items = D.fromFeed(feed);
  test('feed adapter: one item per card, primary always ranked above news', () => {
    assert.equal(items.length, feed.cards.length);
    const firstNews = items.findIndex((i) => i.isNews);
    if (firstNews >= 0) assert.ok(items.slice(firstNews).every((i) => i.isNews || i.rank <= items[firstNews].rank + 100), 'primary after news');
    for (const i of items) {
      assert.ok(i.title && i.authority && i.type && D.STATUS_LABEL[i.status], 'incomplete item ' + i.id);
      assert.ok(!/^CELEX:/.test(i.title), 'CELEX prefix left in title');
      if (i.isNews) assert.ok(i.rank < 100, 'news ranked in a primary band');
    }
  });
  test('feed adapter: clustered sources stay beneath the lead, primary before news', () => {
    const multi = items.filter((i) => i.also.length);
    if (!multi.length) return;
    for (const i of multi) {
      const firstNews = i.also.findIndex((m) => m.isNews);
      if (firstNews >= 0) assert.ok(i.also.slice(firstNews).every((m) => m.isNews), 'primary listed after news in ' + i.id);
    }
  });
  if (exists('data/sources/deadlines.json')) {
    const dl = J('data/sources/deadlines.json').deadlines;
    test('deadlines attach to their document, with the quoted sentence', () => {
      D.attachDeadlines(items, dl);
      const withQuote = dl.filter((d) => d.quote && d.source_doc_id);
      for (const d of withQuote) {
        const it = items.find((i) => i.docId === d.source_doc_id || i.id === d.source_doc_id);
        if (it) assert.ok(it.deadlines.some((x) => x.id === d.id), 'deadline not attached to ' + it.id);
      }
      const up = D.upcoming(dl, '2026-11-14', 90);
      assert.ok(up.every((d) => d.date >= '2026-11-14' && D.daysUntil(d.date, '2026-11-14') <= 90));
    });
  }
  if (exists('data/sources/entries.json') && exists('data/sources/proposals.json')) {
    test('enrichment: first seen, jurisdiction and what changed from the engine', () => {
      D.enrich(items, J('data/sources/entries.json'), J('data/sources/proposals.json'));
      const eng = items.filter((i) => i.origin === 'engine');
      assert.ok(eng.every((i) => i.firstSeen), 'engine item without first seen');
      for (const i of items.filter((x) => x.whatChanged)) assert.equal(i.change, 'changed');
    });
  }
}

test('fallback: empty or missing feed gives no items, legacy archive gives story cards', () => {
  assert.deepEqual(D.fromFeed({ cards: [] }), []);
  assert.deepEqual(D.fromFeed(null), []);
  const legacy = [
    { id: 'a', title: 'EBA publishes guidelines on X - Reuters', url: 'https://r/1', date: '2026-11-10T10:00:00', source: 'GNews — EBA', source_id: 'gnews_eba', doc_type: 'news', themes: ['AML/CFT'] },
    { id: 'b', title: 'EBA publishes guidelines on X', url: 'https://eba/1', date: '2026-11-09T10:00:00', source: 'EBA', source_id: 'eba_rss', doc_type: 'guideline', legal_status: 'comply-or-explain', themes: [] },
    { id: 'c', title: 'Bank fined - FT', url: 'https://ft/1', date: '2026-11-10', source: 'GNews — x', source_id: 'gnews_fraud', doc_type: 'news' },
    { id: 'd', title: 'Bank fined - Les Echos', url: 'https://le/1', date: '2026-11-11', source: 'GNews — x', source_id: 'gnews_fraud', doc_type: 'news' }
  ];
  const out = D.fromLegacy(legacy, '2026-11-14');
  assert.equal(out.length, 2, 'one card per story');
  const g = out.find((i) => i.authKey === 'EBA');
  assert.ok(g && !g.isNews && g.also.length === 1 && g.also[0].isNews && g.also[0].authority === 'Reuters', 'primary leads, outlet beneath');
  const news = out.find((i) => i.isNews);
  assert.equal(news.also.length, 1);
  assert.ok(g.rank > news.rank);
});

test('.ics export: all-day events, escaped text, CRLF, folded lines', () => {
  const ics = D.ics([{ id: 'x1', date: '2026-12-31', kind: 'consultation closes', title: 'Consultation on RTS; CDD, part 1', url: 'https://www.amla.europa.eu/x', quote: 'Deadline: 31 December 2026', loc: 'Details, para 3', method: 'structured' }], '2026-11-14T08:00:00Z');
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n') && ics.endsWith('END:VCALENDAR\r\n'));
  assert.ok(ics.includes('DTSTART;VALUE=DATE:20261231\r\nDTEND;VALUE=DATE:20270101'));
  assert.ok(ics.includes('SUMMARY:Consultation closes: Consultation on RTS\\; CDD\\, part 1'));
  assert.ok(ics.split('\r\n').every((l) => l.length <= 75), 'line longer than 75');
});

test('filters: jurisdiction, authority, status, topic, search and my firm', () => {
  const it = { title: 'NBB circular on AML', authority: 'National Bank of Belgium', authKey: 'NBB', jur: 'BE', type: 'guideline', status: 'final', statusRaw: 'final', topics: ['cdd'], themes: [], also: [] };
  assert.ok(D.matches(it, { jur: 'BE', auth: 'NBB', status: 'final', topic: 'cdd', q: 'nbb circular' }));
  assert.ok(!D.matches(it, { jur: 'EU' }));
  assert.ok(D.matches(it, { q: 'customer due', topic: '' }, (t) => D.TOPIC_LABEL[t]));
  assert.ok(D.matches(it, { mine: ['cdd', 'pep'] }));
  assert.ok(!D.matches(it, { mine: ['crypto-assets'] }));
  assert.equal(D.staleDays('2026-11-10T00:00:00+00:00', new Date('2026-11-14T01:00:00Z')), 4);
});

console.log(`\n${n - failed}/${n} passed`);
if (failed) process.exit(1);
