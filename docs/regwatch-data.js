/* RegWatch data adapter (pure functions, no DOM).

   Reads the source engine's output (docs/data/sources/feed.json,
   deadlines.json, and for enrichment entries.json and proposals.json) and
   turns it into one list of story items for docs/regwatch.html. When the
   engine feed is missing or empty it falls back to the legacy archive
   (docs/data/items.json), clustered the same way: one card per story.

   Works in the browser (window.RWData) and in node (module.exports), so
   tests/regwatch.test.mjs checks it without a browser. */
(function (root) {
  'use strict';

  /* ── authorities ────────────────────────────────────────────────
     The engine and the legacy archive name the same authority several
     ways. key = filter value, name = what the reader sees. */
  var AUTH = [
    [/^(nbb|bnb)\b|national bank of belgium|banque nationale/i, 'NBB', 'National Bank of Belgium', 'BE'],
    [/^fsma\b/i, 'FSMA', 'FSMA', 'BE'],
    [/^amla\b|anti-money laundering authority/i, 'AMLA', 'AMLA', 'EU'],
    [/^eba\b|european banking authority/i, 'EBA', 'EBA', 'EU'],
    [/^esma\b/i, 'ESMA', 'ESMA', 'EU'],
    [/^eiopa\b/i, 'EIOPA', 'EIOPA', 'EU'],
    [/legislative proposals/i, 'COM', 'European Commission', 'EU'],
    [/official journal|publications office|eur-lex/i, 'OJ', 'Official Journal of the EU', 'EU'],
    [/^european commission/i, 'COM', 'European Commission', 'EU'],
    [/^ecb\b|european central bank/i, 'ECB', 'ECB', 'EU'],
    [/^srb\b|single resolution board/i, 'SRB', 'SRB', 'EU'],
    [/^fsb\b|financial stability board/i, 'FSB', 'FSB', 'GLOBAL'],
    [/^fatf\b/i, 'FATF', 'FATF', 'GLOBAL'],
    [/^ctif|cfi\b/i, 'CTIF', 'CTIF-CFI', 'BE']
  ];
  // Filter order: Belgium first, then the EU AML authorities, then the rest.
  var AUTH_ORDER = ['NBB', 'FSMA', 'CTIF', 'AMLA', 'EBA', 'ESMA', 'EIOPA', 'COM', 'OJ', 'ECB', 'SRB', 'FSB', 'FATF'];
  var AUTH_NAME = {};
  AUTH.forEach(function (a) { AUTH_NAME[a[1]] = a[2]; });

  function authority(raw, jur) {
    var s = String(raw || '').replace(/^GNews\s*[—-]\s*/i, '').trim();
    for (var i = 0; i < AUTH.length; i++) {
      if (AUTH[i][0].test(s)) return { key: AUTH[i][1], name: AUTH[i][2], jur: jur || AUTH[i][3] };
    }
    return { key: s || 'Other', name: s || 'Other', jur: jur || 'EU' };
  }

  /* ── document type and status ──────────────────────────────────── */
  var TYPE_LABEL = {
    legislation: 'Legislation', rts_its_draft: 'Technical standard', guideline: 'Guidelines',
    consultation: 'Consultation', faq: 'Q&A', enforcement: 'Enforcement',
    supervisory_communication: 'Supervisory communication', news: 'News'
  };
  var TYPE_ORDER = ['legislation', 'rts_its_draft', 'guideline', 'consultation', 'faq', 'enforcement', 'supervisory_communication'];
  function legacyType(it) {
    var d = it.doc_type || '';
    if (/^news/.test(d)) return 'news';
    return ({ regulation: 'legislation', directive: 'legislation', national_law: 'legislation', rts_its: 'rts_its_draft',
      circular: 'guideline', guideline: 'guideline', qa: 'faq', consultation: 'consultation', proposal: 'consultation',
      enforcement: 'enforcement' })[d] || 'supervisory_communication';
  }

  /* Three statuses the reader asked for, plus "information" for the
     publications that carry no rule. The engine's own wording is kept as
     `statusRaw` and shown in the card's details. */
  var STATUS_LABEL = { draft: 'Draft', final: 'Final', inforce: 'In force', info: 'Information' };
  function status(raw, type, title, source) {
    var s = String(raw || '').toLowerCase();
    if (/proposal/.test(source || '') || /^proposal for|position of the council/i.test(title || '')) return 'draft';
    if (/draft|not-yet-binding|consultation/.test(s)) return 'draft';
    if (/in force|^binding|supervisory-binding|published in oj/.test(s)) return 'inforce';
    if (/final|published|comply-or-explain|interpretive|supervisory-expectation/.test(s)) return 'final';
    if (type === 'consultation') return 'draft';
    return 'info';
  }

  /* ── topic tags: engine tag id -> docs/data/topics.json id ─────────
     Checked by tests/regwatch.test.mjs: every target exists in
     topics.json, every engine tag is either mapped or listed below. */
  var TOPIC_MAP = {
    'cdd': 'cdd', 'cdd-natural-person': 'cdd-natural', 'cdd-legal-entity': 'cdd-legal',
    'simplified-edd': 'cdd', 'ongoing-monitoring': 'cdd-monitoring', 'outsourcing-reliance': 'cdd-reliance',
    'pep': 'pep', 'beneficial-ownership': 'bo', 'reporting-str': 'str', 'record-keeping': 'rec',
    'governance-risk-assessment': 'gov', 'sanctions': 'sanctions', 'crypto-assets': 'crypto',
    'transfers-of-funds': 'tfr-funds', 'high-risk-countries': 'third', 'training': 'train'
  };
  var TOPIC_UNMATCHED = ['payments-emoney'];   // no Topics page yet (outside the AMLR path)
  var TOPIC_LABEL = {   // fallback labels; topic-tags.json overrides when loaded
    'cdd': 'Customer due diligence', 'cdd-natural-person': 'CDD: natural persons',
    'cdd-legal-entity': 'CDD: legal entities', 'pep': 'Politically exposed persons',
    'beneficial-ownership': 'Beneficial ownership', 'simplified-edd': 'Simplified and enhanced due diligence',
    'ongoing-monitoring': 'Ongoing monitoring', 'reporting-str': 'Suspicion reporting',
    'record-keeping': 'Record keeping', 'governance-risk-assessment': 'Governance and risk assessment',
    'sanctions': 'Sanctions', 'crypto-assets': 'Crypto-assets', 'transfers-of-funds': 'Transfers of funds',
    'high-risk-countries': 'High-risk third countries', 'training': 'Training',
    'outsourcing-reliance': 'Outsourcing and reliance', 'payments-emoney': 'Payments and e-money'
  };
  function topicHref(tag) { return TOPIC_MAP[tag] ? 'topics.html#topic=' + TOPIC_MAP[tag] : ''; }

  /* ── helpers ───────────────────────────────────────────────────── */
  function cleanTitle(t) { return String(t || '').replace(/^CELEX:\S+:\s*/, '').replace(/\s+/g, ' ').trim(); }
  function day(d) { var m = /^(\d{4}-\d{2}-\d{2})/.exec(d || ''); return m ? m[1] : ''; }
  function daysUntil(date, today) {
    var a = /^(\d{4})-(\d{2})-(\d{2})/.exec(date || ''), b = /^(\d{4})-(\d{2})-(\d{2})/.exec(today || '');
    if (!a || !b) return null;
    return Math.round((Date.UTC(+a[1], a[2] - 1, +a[3]) - Date.UTC(+b[1], b[2] - 1, +b[3])) / 864e5);
  }
  function todayUTC(now) { return (now || new Date()).toISOString().slice(0, 10); }
  // News headlines end with " - Outlet"; the outlet is the source.
  function splitOutlet(t) {
    var m = /^(.*\S)\s+[-–—]\s+([^-–—]{2,60})$/.exec(String(t || ''));
    return m ? { title: m[1], outlet: m[2].trim() } : { title: String(t || ''), outlet: '' };
  }
  function normTitle(t) {
    return splitOutlet(cleanTitle(t)).title.toLowerCase().replace(/^(updated|breaking|update)\s*[:\-–—]?\s*/i, '')
      .replace(/[^a-z0-9]+/g, ' ').trim();
  }

  /* ── engine feed -> items ──────────────────────────────────────── */
  function member(m, isLead) {
    var a = authority(m.authority);
    var out = splitOutlet(cleanTitle(m.title));
    return {
      title: m.is_news ? out.title : cleanTitle(m.title), url: m.url || '', date: day(m.date),
      authority: m.is_news ? (out.outlet || a.name) : a.name, authKey: m.is_news ? '' : a.key,
      isNews: !!m.is_news, lead: !!isLead
    };
  }
  function fromFeed(feed) {
    var cards = feed && Array.isArray(feed.cards) ? feed.cards : [];
    return cards.filter(function (c) { return c && c.lead && c.lead.title; }).map(function (c, i) {
      var L = c.lead, a = authority(L.authority, L.jurisdiction);
      var news = !!(c.news_only || L.is_news);
      var type = news ? 'news' : (L.type || 'supervisory_communication');
      var head = member(L, true);
      // Primary sources first beneath the lead, then outlets.
      var also = (c.also || []).map(function (m) { return member(m, false); })
        .sort(function (x, y) { return (x.isNews - y.isNews); });
      return {
        id: L.id || ('card-' + i), docId: L.doc_id || '', title: head.title, url: L.url || '',
        date: day(L.date), firstSeen: L.first_seen || '', authority: news ? head.authority : a.name,
        authKey: news ? '' : a.key, jur: a.jur, type: type, status: news ? 'info' : status(L.status, type, L.title, L.source),
        statusRaw: L.status || '', topics: (L.topics || []).slice(), themes: [], isNews: news,
        also: also, rank: +c.rank || +L.rank || 0, tier: c.tier || L.tier || 'info', origin: L.origin || 'engine',
        source: L.source || '', change: L.change || '', changedAt: '', whatChanged: '', deadlines: [], summary: ''
      };
    });
  }

  /* ── legacy archive -> items (fallback) ────────────────────────── */
  function fromLegacy(list, today) {
    if (!Array.isArray(list)) return [];
    var groups = {}, order = [];
    list.forEach(function (it) {
      if (!it || !it.title) return;
      var news = /^gnews_/.test(it.source_id || '') || /^news/.test(it.doc_type || '');
      var k = normTitle(it.title);
      if (!groups[k]) { groups[k] = []; order.push(k); }
      groups[k].push({ it: it, news: news });
    });
    var t = today || todayUTC();
    return order.map(function (k) {
      var g = groups[k].sort(function (x, y) { return (x.news - y.news) || String(y.it.date).localeCompare(String(x.it.date)); });
      var L = g[0].it, news = g.every(function (x) { return x.news; });
      var a = authority(L.source, L.country === 'BE' ? 'BE' : L.country === 'GLOBAL' ? 'GLOBAL' : '');
      var type = news ? 'news' : legacyType(L);
      var head = splitOutlet(cleanTitle(L.title));
      var st = news ? 'info' : status(L.legal_status, type, L.title, L.source_id);
      var age = daysUntil(t, day(L.date)) || 0;
      // Same bands as the engine's rank(): primary always above news.
      var rank = (news ? 0 : 100) + ({ legislation: 85, rts_its_draft: 75, guideline: 65, consultation: 60, enforcement: 55, faq: 40 }[type] || 30) - Math.min(20, Math.max(0, age) / 7);
      return {
        id: 'legacy-' + L.id, docId: '', title: news ? head.title : cleanTitle(L.title), url: L.url || '',
        date: day(L.date), firstSeen: '', authority: news ? (head.outlet || a.name) : a.name, authKey: news ? '' : a.key,
        jur: a.jur, type: type, status: st, statusRaw: L.legal_status || '', topics: [], themes: (L.themes || []).filter(function (x) { return x !== 'General'; }),
        isNews: news, also: g.slice(1).map(function (x) {
          var o = splitOutlet(cleanTitle(x.it.title)), b = authority(x.it.source);
          return { title: x.news ? o.title : cleanTitle(x.it.title), url: x.it.url || '', date: day(x.it.date),
            authority: x.news ? (o.outlet || b.name) : b.name, authKey: x.news ? '' : b.key, isNews: x.news, lead: false };
        }), rank: rank, tier: 'info', origin: 'legacy items.json', source: L.source_id || '', change: '', changedAt: '',
        whatChanged: '', deadlines: [], summary: L.so_what || L.summary || ''
      };
    });
  }

  /* ── enrichment: deadlines, first seen, what changed ───────────── */
  function attachDeadlines(items, deadlines) {
    var byDoc = {}, byUrl = {};
    (deadlines || []).forEach(function (d) {
      if (d.source_doc_id) (byDoc[d.source_doc_id] = byDoc[d.source_doc_id] || []).push(d);
      if (d.url) (byUrl[d.url] = byUrl[d.url] || []).push(d);
    });
    items.forEach(function (it) {
      var seen = {}, out = [];
      [byDoc[it.docId], byDoc[it.id], byUrl[it.url]].concat(it.also.map(function (m) { return byUrl[m.url]; }))
        .forEach(function (arr) { (arr || []).forEach(function (d) { if (!seen[d.id]) { seen[d.id] = 1; out.push(d); } }); });
      it.deadlines = out.sort(function (a, b) { return a.date.localeCompare(b.date); });
    });
    return items;
  }
  function enrich(items, entries, proposals) {
    var E = {}, P = {};
    ((entries && entries.entries) || []).forEach(function (e) { E[e.id] = e; });
    ((proposals && proposals.proposals) || []).forEach(function (p) {
      if (p.change === 'changed' && p.what_changed && (!P[p.doc_id] || p.created > P[p.doc_id].created)) P[p.doc_id] = p;
    });
    items.forEach(function (it) {
      var e = E[it.id];
      if (e) {
        it.firstSeen = it.firstSeen || e.first_seen || '';
        if (e.jurisdiction) it.jur = e.jurisdiction;
        it.change = e.change || it.change;
        var last = (e.history || []).filter(function (h) { return h.change === 'changed'; }).pop();
        if (last) it.changedAt = last.at;
        if (!e.date) it.dateMissing = true;
      }
      var p = P[it.docId] || P[it.id];
      if (p) { it.whatChanged = p.what_changed.summary || ''; it.change = 'changed'; it.changedAt = it.changedAt || p.created; }
    });
    return items;
  }

  /* ── deadlines strip and .ics ──────────────────────────────────── */
  var KIND_LABEL = { 'consultation closes': 'Consultation closes', 'application date': 'Applies',
    'transposition deadline': 'Transposition deadline', 'reporting deadline': 'Reporting deadline', 'entry into force': 'Enters into force' };
  function upcoming(deadlines, today, days) {
    return (deadlines || []).filter(function (d) {
      var n = daysUntil(d.date, today); return n != null && n >= 0 && (days == null || n <= days);
    }).sort(function (a, b) { return a.date.localeCompare(b.date) || a.kind.localeCompare(b.kind); });
  }
  function fromTimeline(meta) {   // legacy meta.json timeline, sourced rows only (F-027)
    return ((meta && meta.timeline) || []).filter(function (t) { return /^https:\/\//.test(t.source || ''); }).map(function (t, i) {
      return { id: 'tl-' + i, date: day(t.date), kind: 'application date', title: t.event, url: t.source,
        confidence: 'high', method: 'legacy meta.json timeline' + (t.basis ? ' (' + t.basis + ')' : ''), loc: t.basis || '' };
    });
  }
  function icsEscape(s) { return String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1'); }
  function fold(line) {   // RFC 5545: lines of at most 75 octets
    var out = [], s = line;
    while (s.length > 74) { out.push(s.slice(0, 74)); s = ' ' + s.slice(74); }
    out.push(s); return out.join('\r\n');
  }
  function ics(list, stamp) {
    var ts = (stamp || new Date().toISOString()).replace(/[-:]/g, '').replace(/\.\d+/, '').slice(0, 15) + 'Z';
    var L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//RegRadar//RegWatch deadlines//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
    (list || []).forEach(function (d) {
      var start = d.date.replace(/-/g, '');
      var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d.date);
      var next = new Date(Date.UTC(+m[1], m[2] - 1, +m[3] + 1)).toISOString().slice(0, 10).replace(/-/g, '');
      L.push('BEGIN:VEVENT', 'UID:' + d.id + '@regradar-regwatch', 'DTSTAMP:' + ts,
        'DTSTART;VALUE=DATE:' + start, 'DTEND;VALUE=DATE:' + next,
        fold('SUMMARY:' + icsEscape((KIND_LABEL[d.kind] || d.kind) + ': ' + cleanTitle(d.title))),
        fold('DESCRIPTION:' + icsEscape([d.quote ? '"' + d.quote + '"' + (d.loc ? ' (' + d.loc + ')' : '') : '', 'Source: ' + (d.url || ''), 'How we know: ' + (d.method || '')].filter(Boolean).join('\n'))));
      if (/^https?:\/\//.test(d.url || '')) L.push(fold('URL:' + d.url));
      L.push('END:VEVENT');
    });
    L.push('END:VCALENDAR');
    return L.join('\r\n') + '\r\n';
  }

  /* ── filtering ─────────────────────────────────────────────────── */
  function matches(it, f, labelOf) {
    if (f.jur && it.jur !== f.jur) return false;
    if (f.auth && it.authKey !== f.auth) return false;
    if (f.type && it.type !== f.type) return false;
    if (f.status && it.status !== f.status) return false;
    if (f.topic && it.topics.indexOf(f.topic) < 0 && it.themes.indexOf(f.topic) < 0) return false;
    if (f.mine && f.mine.length && !it.topics.some(function (t) { return f.mine.indexOf(t) >= 0; })) return false;
    if (f.q) {
      var hay = [it.title, it.authority, TYPE_LABEL[it.type], STATUS_LABEL[it.status], it.statusRaw]
        .concat(it.topics.map(function (t) { return labelOf ? labelOf(t) : t; }), it.themes, it.also.map(function (m) { return m.title + ' ' + m.authority; }))
        .join(' ').toLowerCase();
      var words = String(f.q).toLowerCase().split(/\s+/).filter(Boolean);
      for (var i = 0; i < words.length; i++) if (hay.indexOf(words[i]) < 0) return false;
    }
    return true;
  }
  function staleDays(generated, now) {
    if (!generated) return null;
    var ts = /(Z|[+-]\d\d:?\d\d)$/.test(generated) ? generated : generated + 'Z';
    var t = Date.parse(ts); if (isNaN(t)) return null;
    return Math.floor(((now ? now.getTime() : Date.now()) - t) / 864e5);
  }

  var API = {
    authority: authority, AUTH_ORDER: AUTH_ORDER, AUTH_NAME: AUTH_NAME, TYPE_LABEL: TYPE_LABEL, TYPE_ORDER: TYPE_ORDER,
    STATUS_LABEL: STATUS_LABEL, status: status, TOPIC_MAP: TOPIC_MAP, TOPIC_UNMATCHED: TOPIC_UNMATCHED,
    TOPIC_LABEL: TOPIC_LABEL, topicHref: topicHref, KIND_LABEL: KIND_LABEL, cleanTitle: cleanTitle,
    daysUntil: daysUntil, todayUTC: todayUTC, fromFeed: fromFeed, fromLegacy: fromLegacy,
    attachDeadlines: attachDeadlines, enrich: enrich, upcoming: upcoming, fromTimeline: fromTimeline,
    ics: ics, matches: matches, staleDays: staleDays, normTitle: normTitle
  };
  if (typeof module === 'object' && module.exports) module.exports = API;
  else root.RWData = API;
})(typeof window !== 'undefined' ? window : this);
