/* ═══════════════════════════════════════════════════════════════
   RegRadar: topic view (docs/topics.html)

   One page per compliance topic, in four layers:
     1. the law (verbatim AMLR / TFR extracts from docs/data/topics.json,
        checked by tests/topics.test.mjs),
     2. AMLA (what the AMLR mandates AMLA to produce, quoted, plus the
        document once the source collector publishes it),
     3. supervisors and guidance (NBB first, then EBA, FATF...), shown as
        "not collected yet" until published, never invented,
     4. your controls (read from the data spine, docs/rr-core.js), with a
        visible gap marker.
   Highlights mode is deterministic: a checklist from the verified
   obligation records and rule-based marks in the extracts.

   AI hook (not used yet, no network call here):
     window.RegTopics.setSummariser(function (payload) { return 'text' or Promise<'text'> })
   payload = { topic, extracts, obligations, sources } for the open subtopic.

   The pure helpers at the top run in Node too (tests/topics.test.mjs).
   ═══════════════════════════════════════════════════════════════ */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.RegTopicsCore = api; if (typeof document !== 'undefined') api.start(); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ───────── pure helpers ───────── */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function norm(s) { return String(s || '').toLowerCase().replace(/[\s ]+/g, ' ').trim(); }

  var MONTHS = '(?:January|February|March|April|May|June|July|August|September|October|November|December)';
  // Highlight rules, in priority order (at one position the first rule that matches wins; then the longest match).
  var RULES = [
    { cls: 'hl-proh', label: 'Prohibition', re: /\b(?:shall not|must not|shall refrain from|shall be prohibited|are prohibited|is prohibited|shall abstain)\b/g },
    { cls: 'hl-time', label: 'Deadline or period', re: new RegExp('\\b(?:(?:within|by|before|no later than|not exceed(?:ing)?|at least|for not less than|less than)\\s+)?(?:\\d{1,2} ' + MONTHS + ' \\d{4}|\\d+ (?:working days?|calendar days?|days?|hours?|months?|years?))\\b|\\bwithout (?:undue )?delay\\b|\\bas soon as practicable\\b|\\bpromptly\\b', 'g') },
    { cls: 'hl-num', label: 'Threshold or amount', re: /\bEUR \d{1,3}(?: \d{3})*\b|\b\d+(?:[.,]\d+)? ?%(?: plus one)?/g },
    { cls: 'hl-duty', label: 'Obligation', re: /\b(?:shall|must)\b/g },
    { cls: 'hl-perm', label: 'Permission or option', re: /\bmay\b/g }
  ];
  function highlight(text) {
    var s = String(text || ''), hits = [];
    RULES.forEach(function (r, pri) {
      r.re.lastIndex = 0; var m;
      while ((m = r.re.exec(s))) { if (m[0].length) hits.push({ a: m.index, b: m.index + m[0].length, cls: r.cls, pri: pri }); else r.re.lastIndex++; }
    });
    hits.sort(function (x, y) { return x.a - y.a || x.pri - y.pri || (y.b - y.a) - (x.b - x.a); });
    var out = '', pos = 0;
    hits.forEach(function (h) {
      if (h.a < pos) return;
      out += esc(s.slice(pos, h.a)) + '<mark class="' + h.cls + '">' + esc(s.slice(h.a, h.b)) + '</mark>';
      pos = h.b;
    });
    return out + esc(s.slice(pos));
  }
  // Split an extract into sentences or list points; the ones that state a duty or a prohibition are "key".
  function keySentences(text) {
    var parts = String(text || '').split(/(?<=[.;:])\s+(?=\(|[A-Z])/);
    return parts.map(function (p) { return { text: p, key: /\b(?:shall|must)\b/.test(p) }; });
  }
  function shortOf(lawMeta, celex) { return (lawMeta && lawMeta[celex] && lawMeta[celex].short) || celex; }
  function locatorText(x) {
    var loc = 'Art. ' + x.article + (x.paragraph ? '(' + x.paragraph + ')' : '');
    var p = x.points || [];
    if (p.length === 1) loc += ', point (' + p[0] + ')';
    else if (p.length > 1) loc += ', points (' + p[0] + ') to (' + p[p.length - 1] + ')';
    return loc;
  }
  function lawUrl(celex) { return 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:' + celex; }
  function readerHref(x) { return 'law.html?celex=' + encodeURIComponent(x.celex) + '&art=' + encodeURIComponent(x.article); }
  function citation(x, lawMeta) {
    var title = (lawMeta && lawMeta[x.celex] && lawMeta[x.celex].title) || x.celex;
    return '"' + x.text + '" ' + title + ', ' + locatorText(x) + '. EUR-Lex, CELEX ' + x.celex + ': ' + lawUrl(x.celex);
  }
  function csvCell(v) { var s = String(v == null ? '' : v); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; }
  function csvRows(rows) { return rows.map(function (r) { return r.map(csvCell).join(','); }).join('\n'); }

  function allSubs(T) {
    var out = [];
    (T.topics || []).forEach(function (t) { (t.children || []).forEach(function (c) { out.push({ sub: c, parent: t }); }); });
    return out;
  }
  function appliesTo(sub, firm) { return !firm || !sub.applies_to || sub.applies_to.indexOf(firm) !== -1; }
  function extractApplies(x, firm, app) {
    if (!firm) return true;
    if (x.applies_to && x.applies_to.indexOf(firm) === -1) return false;
    var reg = app && (app.regulations || []).filter(function (r) { return r.celex === x.celex; })[0];
    return !(reg && reg.applies && reg.applies[firm] === 'na');
  }
  function haystack(c, parent) {
    return norm([parent.title, c.title, c.what, (c.keywords || []).join(' '), (c.obligations || []).join(' ')].concat((c.extracts || []).map(function (x) { return x.label + ' ' + shortOf(null, x.celex) + ' ' + locatorText(x) + ' ' + x.text; })).join(' '));
  }
  // Every word of the query must appear (case-insensitive) in the subtopic: titles, keywords, labels, locators, extract text.
  function search(T, q) {
    var words = norm(q).split(' ').filter(Boolean);
    if (!words.length) return [];
    return allSubs(T).filter(function (r) { var h = haystack(r.sub, r.parent); return words.every(function (w) { return h.indexOf(w) !== -1; }); })
      .map(function (r) { return Object.assign({ parent: r.parent.id }, r.sub); });
  }

  function obligationsFor(sub, OBL, firm) {
    var by = {}; (OBL || []).forEach(function (o) { by[o.id] = o; });
    return (sub.obligations || []).map(function (id) { return by[id]; }).filter(function (o) { return o && (!firm || !o.who || o.who.indexOf(firm) !== -1); });
  }
  function sourceDate(doc) { return (doc && (doc.date || (doc.versions && doc.versions.length && doc.versions[doc.versions.length - 1].date))) || ''; }

  function topicCsv(sub, T, OBL, controlRows, firm, docs, app) {
    var lawMeta = T._meta.law, rows = [['layer', 'source', 'locator', 'date', 'status', 'label', 'text', 'link']];
    (sub.extracts || []).filter(function (x) { return extractApplies(x, firm, app); }).forEach(function (x) {
      var lm = lawMeta[x.celex] || {};
      rows.push(['law', lm.title || x.celex, locatorText(x), lm.applies_from ? 'applies from ' + lm.applies_from : '', lm.status || '', x.label, x.text, lawUrl(x.celex)]);
    });
    (sub.sources || []).forEach(function (id) {
      var s = T.sources[id]; if (!s) return;
      var d = docs && docs[id];
      rows.push([s.layer === 'amla' ? 'amla' : 'guidance', s.authority + ': ' + s.title, d ? (d.version || '') : '', d ? sourceDate(d) : '', d ? (d.status || 'collected') : 'not collected yet',
        s.layer === 'amla' ? 'AMLR mandate, ' + locatorText(s.mandate) : 'expected content', s.layer === 'amla' ? s.mandate.text : s.expected, d && d.url ? d.url : '']);
    });
    obligationsFor(sub, OBL, firm).forEach(function (o) { rows.push(['checklist', 'Obligations register', o.legal_basis, o.deadline || '', o.status || '', o.id, o.what, o.source_url || '']); });
    (controlRows || []).forEach(function (c) { rows.push(['controls', c.obligation, c.name, c.lastTest || '', c.status, c.owner, c.gaps.join('; ') || 'no gap marker', '']); });
    return csvRows(rows);
  }

  /* ───────── page ───────── */
  var D = null, OBL = [], APP = null, R = null, DOCS = {}, REG = null, SUMMARISER = null, CUR = null, LAST_ROWS = [];
  var ST = { firm: '', hl: false, q: '' };
  function $(id) { return document.getElementById(id); }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } }
  function toast(msg) { var t = $('toast'); if (!t) return; t.textContent = msg; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(function () { t.classList.remove('on'); }, 2600); }
  function firmLabel(id) { var e = APP && (APP.entities || []).filter(function (x) { return x.id === id; })[0]; return e ? e.label : id; }
  function fmtDate(s) {
    if (!/^\d{4}-\d{2}-\d{2}/.test(s || '')) return s || '';
    var p = s.slice(0, 10).split('-'), m = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return (+p[2]) + ' ' + m[+p[1] - 1] + ' ' + p[0];
  }
  function today() { var d = new Date(); return d.toISOString().slice(0, 10); }
  function daysBetween(a, b) { return Math.round((Date.parse(a) - Date.parse(b)) / 864e5); }
  function getJson(url) { return fetch(url, { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }); }

  function findNode(id) {
    var hit = null;
    (D.topics || []).forEach(function (t) { if (t.id === id) hit = { topic: t }; (t.children || []).forEach(function (c) { if (c.id === id) hit = { topic: t, sub: c }; }); });
    return hit;
  }
  function route() { var m = /^#topic=([a-z0-9-]+)$/.exec(location.hash || ''); return m ? m[1] : ''; }

  /* ---- navigation tree ---- */
  function renderTree() {
    var cur = route(), node = cur ? findNode(cur) : null, openId = node ? node.topic.id : '';
    var hits = ST.q ? search(D, ST.q) : null, hitIds = {};
    (hits || []).forEach(function (h) { hitIds[h.id] = 1; });
    var hidden = 0, h = '';
    D.topics.forEach(function (t) {
      var kids = t.children.filter(function (c) { var ok = appliesTo(c, ST.firm); if (!ok) hidden++; return ok && (!hits || hitIds[c.id]); });
      if (hits && !kids.length) return;
      var open = hits ? true : (lsGet('regradar-topics-open-' + t.id) === '1' || t.id === openId);
      h += '<li class="tnode"><div class="trow"><a class="tlink' + (cur === t.id ? ' on' : '') + '" href="#topic=' + t.id + '"' + (cur === t.id ? ' aria-current="page"' : '') + '>' + esc(t.title) + '</a>' +
        '<button class="tx" type="button" aria-expanded="' + open + '" aria-controls="tk-' + t.id + '" data-tx="' + t.id + '"><span class="sr">Show subtopics of ' + esc(t.title) + '</span><span aria-hidden="true" class="chev"></span></button></div>' +
        '<ul class="tkids" id="tk-' + t.id + '"' + (open ? '' : ' hidden') + '>' + kids.map(function (c) {
          var on = cur === c.id;
          return '<li><a class="slink' + (on ? ' on' : '') + '" href="#topic=' + c.id + '"' + (on ? ' aria-current="page"' : '') + '>' + esc(c.title) + '</a></li>';
        }).join('') + '</ul></li>';
    });
    $('tree').innerHTML = h || '<li class="empty">No topic matches. Try fewer words, an article number (Art. 22) or a term (PEP).</li>';
    var info = [];
    if (hits) info.push(hits.filter(function (x) { return appliesTo(x, ST.firm); }).length + ' subtopic' + (hits.length === 1 ? '' : 's') + ' match "' + ST.q + '"');
    if (ST.firm && hidden) info.push(hidden + ' subtopic' + (hidden === 1 ? '' : 's') + ' hidden: not for ' + firmLabel(ST.firm));
    $('qInfo').textContent = info.join('. ');
  }

  /* ---- views ---- */
  function chip(text, cls) { return '<span class="chip' + (cls ? ' ' + cls : '') + '">' + esc(text) + '</span>'; }
  function overview() {
    var h = '<h2 class="vh" tabindex="-1">All topics</h2><p class="sub">Ten themes of the AMLR, each split into the questions a compliance team asks. Start with <a href="#topic=cdd-natural">customer due diligence for a natural person</a>, the most complete topic.</p><ul class="cards">';
    D.topics.forEach(function (t) {
      var kids = t.children.filter(function (c) { return appliesTo(c, ST.firm); });
      h += '<li class="card"><h3><a href="#topic=' + t.id + '">' + esc(t.title) + '</a></h3><p>' + esc(t.what) + '</p><ul class="mini">' +
        kids.map(function (c) { return '<li><a href="#topic=' + c.id + '">' + esc(c.title) + '</a></li>'; }).join('') + '</ul></li>';
    });
    return h + '</ul>';
  }
  function topicView(t) {
    var kids = t.children.filter(function (c) { return appliesTo(c, ST.firm); });
    var h = '<p class="crumb"><a href="#">All topics</a></p><h2 class="vh" tabindex="-1">' + esc(t.title) + '</h2><p class="sub">' + esc(t.what) + '</p><ul class="cards">';
    kids.forEach(function (c) {
      var obl = obligationsFor(c, OBL, ST.firm).length;
      h += '<li class="card"><h3><a href="#topic=' + c.id + '">' + esc(c.title) + '</a></h3><p>' + esc(c.what) + '</p><p class="meta">' +
        chip(c.extracts.length + ' law extract' + (c.extracts.length === 1 ? '' : 's')) + ' ' + chip(obl ? obl + ' register obligation' + (obl === 1 ? '' : 's') : 'No register obligation yet', obl ? '' : 'warn') + '</p></li>';
    });
    return h + '</ul>';
  }

  function lawLayer(sub) {
    var lm = D._meta.law, shown = [], other = [];
    sub.extracts.forEach(function (x, i) { (extractApplies(x, ST.firm, APP) ? shown : other).push({ x: x, i: i }); });
    function card(o) {
      var x = o.x, m = lm[x.celex] || {};
      var body = ST.hl ? keySentences(x.text).map(function (p) { return p.key ? '<span class="key">' + highlight(p.text) + '</span>' : highlight(p.text); }).join(' ') : esc(x.text);
      return '<li class="ex"><h4>' + esc(x.label) + '</h4>' +
        '<p class="meta">' + chip(m.short || x.celex, 'law') + ' <span class="loc">' + esc(locatorText(x)) + '</span> ' + chip(m.status === 'in_force' ? 'In force' : (m.status || ''), 'ok') +
        ' <span class="hint">' + esc(m.status_note || '') + '</span>' + (x.applies_to ? ' ' + chip('Only: ' + x.applies_to.map(firmLabel).join(', ')) : '') + '</p>' +
        '<blockquote class="quote" cite="' + esc(lawUrl(x.celex)) + '">' + body + '</blockquote>' +
        '<p class="acts"><a class="btn ghost" href="' + esc(readerHref(x)) + '">Read Art. ' + esc(x.article) + ' in full<span class="sr"> (' + esc(m.short || '') + ')</span></a>' +
        '<button class="btn ghost" type="button" data-cite="' + o.i + '">Copy citation<span class="sr"> for ' + esc(locatorText(x)) + '</span></button></p></li>';
    }
    var h = '<ul class="exs">' + shown.map(card).join('') + '</ul>';
    if (!shown.length) h = '<p class="empty">No extract here applies to ' + esc(firmLabel(ST.firm)) + '.</p>';
    if (other.length) h += '<details class="others"><summary>' + other.length + ' extract' + (other.length === 1 ? '' : 's') + ' for other firm types</summary><ul class="exs">' + other.map(card).join('') + '</ul></details>';
    return h;
  }

  function docBlock(id, src) {
    var d = DOCS[id];
    var reg = REG && REG[id];
    if (!d && !reg) return null;
    var recent = false, last = sourceDate(d || reg);
    if ((d && d.versions && d.versions.length > 1) || (reg && reg.changed)) recent = !last || daysBetween(today(), last) <= 90;
    var ex = d && (d.extracts || []).filter(function (e) { return e && e.text && (!e.topics || e.topics.indexOf(CUR.id) !== -1); });
    var h = '<p class="meta">' + chip(statusLabel((d || reg).status), statusCls((d || reg).status)) + (last ? ' <span class="hint">Dated ' + esc(fmtDate(last)) + '</span>' : '') +
      ((d || reg).version ? ' <span class="hint">Version ' + esc((d || reg).version) + '</span>' : '') + (recent ? ' ' + chip('Changed recently', 'new') : '') + '</p>';
    if (ex && ex.length) h += '<ul class="exs">' + ex.slice(0, 6).map(function (e) { return '<li class="ex"><p class="meta"><span class="loc">' + esc(e.locator || '') + '</span></p><blockquote class="quote">' + (ST.hl ? highlight(e.text) : esc(e.text)) + '</blockquote></li>'; }).join('') + '</ul>';
    else h += '<p class="hint">Collected. No extract is tagged for this topic yet.</p>';
    var url = (d && d.url) || (reg && reg.url);
    if (url && /^https:\/\//.test(url)) h += '<p class="acts"><a class="btn ghost" href="' + esc(url) + '" rel="noopener">Open the source<span class="sr">: ' + esc(src.title) + '</span></a></p>';
    return h;
  }
  function statusLabel(s) { return { draft: 'Draft', consultation: 'Consultation', final: 'Final', in_force: 'In force', not_collected: 'Not collected yet' }[s] || (s ? String(s) : 'Collected'); }
  function statusCls(s) { return s === 'in_force' || s === 'final' ? 'ok' : s === 'draft' || s === 'consultation' ? 'imp' : 'muted'; }

  function sourceLayer(sub, layer) {
    var ids = (sub.sources || []).filter(function (id) { return D.sources[id] && D.sources[id].layer === layer; });
    if (layer === 'guidance') {
      var rank = { NBB: 0, Belgium: 1, 'CTIF-CFI': 2, FSMA: 3, EBA: 4, AMLA: 5, FATF: 6, EU: 7 };
      ids.sort(function (a, b) { var x = rank[D.sources[a].authority], y = rank[D.sources[b].authority]; return (x == null ? 9 : x) - (y == null ? 9 : y); });
    }
    if (!ids.length) return '<p class="empty">No ' + (layer === 'amla' ? 'AMLA mandate' : 'guidance source') + ' is listed for this subtopic yet.</p>';
    return '<ul class="srcs">' + ids.map(function (id) {
      var s = D.sources[id], got = docBlock(id, s);
      var h = '<li class="src"><h4>' + esc(s.title) + '</h4><p class="meta">' + chip(s.authority, 'auth') + ' <span class="hint">' + esc(s.kind) + '</span>' + (got ? '' : ' ' + chip('Not collected yet', 'muted')) + '</p>';
      if (got) h += got;
      if (s.layer === 'amla') {
        h += '<p class="lbl2">' + (got ? 'The AMLR mandate' : 'What it will contain: the AMLR mandate, quoted') + ' (' + esc(locatorText(s.mandate)) + ')</p>' +
          '<blockquote class="quote small">' + (ST.hl ? highlight(s.mandate.text) : esc(s.mandate.text)) + '</blockquote>' +
          '<p class="acts"><a class="btn ghost" href="' + esc(readerHref(s.mandate)) + '">Read Art. ' + esc(s.mandate.article) + ' in full</a></p>';
      } else if (!got) {
        h += '<p><span class="lbl2">What it will contain:</span> ' + esc(s.expected) + '</p>' + (s.ref_to_confirm ? '<p class="hint">Planned reference: the exact title and identifier will be confirmed when collected.</p>' : '');
      }
      return h + '</li>';
    }).join('') + '</ul>';
  }

  /* ---- controls (data spine) ---- */
  function controlRows(sub) {
    if (!R) return null;
    var rows = [], t = R.today ? R.today() : today();
    obligationsFor(sub, OBL, ST.firm).forEach(function (o) {
      var ctl = R.linked('OBL:' + o.id, 'mitigates', 'in').filter(function (e) { return e.type === 'control' && e.status !== 'retired'; });
      if (!ctl.length) rows.push({ obligation: o.legal_basis, oid: o.id, name: '', owner: '', status: '', lastTest: '', result: '', gaps: ['No control mapped'] });
      ctl.forEach(function (c) {
        var d = c.data || {}, tests = R.linked(c.id, 'tests', 'in').filter(function (x) { return x.type === 'test'; })
          .sort(function (a, b) { return String((b.data || {}).tested_on).localeCompare(String((a.data || {}).tested_on)); });
        var lt = tests[0], last = lt ? (lt.data || {}).tested_on : d.last_tested, res = lt ? lt.status : (d.effectiveness || 'not_tested');
        var owner = c.owner && R.get(c.owner) ? R.get(c.owner).title : (d.owner_text || '');
        var st = R.stateDef ? R.stateDef('control', c.status) : null, gaps = [];
        if (!last) gaps.push('Not tested');
        if (res === 'failed' || res === 'needs_improvement') gaps.push('Last test: ' + (res === 'failed' ? 'failed' : 'needs improvement'));
        if (c.due && c.due < t) gaps.push('Test overdue since ' + fmtDate(c.due));
        if (!owner) gaps.push('No owner');
        if (c.status !== 'approved') gaps.push('Not approved (' + (st ? st.label : c.status) + ')');
        rows.push({ obligation: o.legal_basis, oid: o.id, name: c.title, owner: owner, status: st ? st.label : c.status, lastTest: last || '', result: res, gaps: gaps, demo: c.origin === 'demo' || (d.demo === true) });
      });
    });
    return rows;
  }
  function controlsLayer(sub) {
    var obl = obligationsFor(sub, OBL, ST.firm);
    if (!(sub.obligations || []).length) return '<p class="gapline">' + chip('Gap', 'gap') + ' No verified obligation in the register covers this subtopic yet, so no control can be mapped to it. The register grows from 12 obligations; until then, check your controls against the extracts above.</p>';
    if (!obl.length) return '<p class="empty">The register obligations of this subtopic do not bind ' + esc(firmLabel(ST.firm)) + '.</p>';
    if (!R) return '<p class="empty">Your controls could not be read on this device (storage blocked or the data layer did not load). Open <a href="controls.html">Controls</a> to check.</p>';
    var rows = controlRows(sub); LAST_ROWS = rows;
    var gaps = rows.filter(function (r) { return r.gaps.length; }).length;
    var h = '<p class="meta">' + (gaps ? chip(gaps + ' gap marker' + (gaps === 1 ? '' : 's'), 'gap') : chip('No gap marker', 'ok')) + ' <span class="hint">Read from this browser. Gap = no control, not tested, last test not effective, overdue, no owner or not approved.</span></p>';
    h += '<div class="tablewrap" tabindex="0" role="region" aria-label="Controls for ' + esc(sub.title) + '"><table class="tbl"><caption class="sr">Controls linked to the obligations of this subtopic</caption><thead><tr><th scope="col">Obligation</th><th scope="col">Control</th><th scope="col">Owner</th><th scope="col">Status</th><th scope="col">Last test</th><th scope="col">Gap</th></tr></thead><tbody>';
    rows.forEach(function (r) {
      h += '<tr><td><a href="obligations.html#' + esc(r.oid) + '">' + esc(r.obligation) + '</a></td><td>' + (r.name ? esc(r.name) + (r.demo ? ' ' + chip('Demo', 'muted') : '') : '<span class="hint">None</span>') + '</td><td>' + esc(r.owner || '-') + '</td><td>' + esc(r.status || '-') + '</td>' +
        '<td>' + (r.lastTest ? esc(fmtDate(r.lastTest)) + (r.result && r.result !== 'not_tested' ? '<br><span class="hint">' + esc(r.result.replace('_', ' ')) + '</span>' : '') : '-') + '</td>' +
        '<td>' + (r.gaps.length ? r.gaps.map(function (g) { return chip(g, 'gap'); }).join(' ') : chip('None', 'ok')) + '</td></tr>';
    });
    h += '</tbody></table></div><p class="acts"><a class="btn ghost" href="controls.html">Open Controls to map or test</a></p>';
    return h;
  }

  function highlightsPanel(sub) {
    var obl = obligationsFor(sub, OBL, ST.firm);
    var h = '<section class="hl-panel" aria-labelledby="h-hl"><h3 id="h-hl">Highlights</h3>';
    h += '<h4>Key obligations (from the verified register)</h4>';
    if (obl.length) {
      h += '<ul class="check">' + obl.map(function (o) {
        return '<li><b>' + esc(o.legal_basis) + '.</b> ' + esc(o.what) + (o.sub_requirements && o.sub_requirements.length ? '<ul>' + o.sub_requirements.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>' : '') + '</li>';
      }).join('') + '</ul>';
    } else h += '<p class="hint">No verified obligation record for this subtopic yet. Use the highlighted key sentences in the extracts below.</p>';
    h += '<h4>How the extracts are marked</h4><ul class="legend">' + RULES.map(function (r) { return '<li><mark class="' + r.cls + '">' + esc(r.label) + '</mark></li>'; }).join('') +
      '<li><span class="key">Key sentence: states an obligation ("shall", "must")</span></li></ul>' +
      '<p class="hint">Rules: modal verbs (shall, must, may, shall not), amounts in EUR and percentages, dates and periods (within 5 working days, 1 year). Marks are mechanical: read the full sentence.</p>';
    h += '<div class="ai"><button class="btn ai-btn" type="button" id="aiBtn"' + (SUMMARISER ? '' : ' aria-disabled="true"') + '>Summarise with Max' + (SUMMARISER ? '' : ' (coming soon)') + '</button>' +
      '<p class="hint" id="aiNote">' + (SUMMARISER ? 'AI summary of the extracts on this page. Check it against the text.' : 'Not available yet: summaries will come later, from the extracts on this page only.') + '</p><div id="aiOut" aria-live="polite"></div></div>';
    return h + '</section>';
  }

  function subView(t, s) {
    CUR = s;
    var na = !appliesTo(s, ST.firm);
    var h = '<p class="crumb"><a href="#">All topics</a> <span aria-hidden="true">/</span> <a href="#topic=' + t.id + '">' + esc(t.title) + '</a></p>' +
      '<h2 class="vh" tabindex="-1">' + esc(s.title) + '</h2><p class="sub">' + esc(s.what) + '</p>' +
      (s.applies_to ? '<p class="meta">' + chip('For: ' + s.applies_to.map(firmLabel).join(', ')) + '</p>' : '') +
      (na ? '<p class="banner">This subtopic is scoped to other firm types than ' + esc(firmLabel(ST.firm)) + '. Shown because you opened it directly.</p>' : '');
    if (ST.hl) h += highlightsPanel(s);
    var L = D._meta.layers;
    h += '<section class="layer l-law" aria-labelledby="h-law"><div class="lh"><h3 id="h-law">' + esc(L[0].title) + '</h3><p class="hint">' + esc(L[0].note) + '</p></div>' + lawLayer(s) + '</section>';
    h += '<section class="layer l-amla" aria-labelledby="h-amla"><div class="lh"><h3 id="h-amla">' + esc(L[1].title) + '</h3><p class="hint">' + esc(L[1].note) + '</p></div>' + sourceLayer(s, 'amla') + '</section>';
    h += '<section class="layer l-guid" aria-labelledby="h-guid"><div class="lh"><h3 id="h-guid">' + esc(L[2].title) + '</h3><p class="hint">' + esc(L[2].note) + '</p></div>' + sourceLayer(s, 'guidance') + '</section>';
    h += '<section class="layer l-ctl" aria-labelledby="h-ctl"><div class="lh"><h3 id="h-ctl">' + esc(L[3].title) + '</h3><p class="hint">' + esc(L[3].note) + '</p></div>' + controlsLayer(s) + '</section>';
    return h;
  }

  function render(focus) {
    var id = route(), node = id ? findNode(id) : null, main = $('main');
    CUR = null; LAST_ROWS = [];
    if (!node) main.innerHTML = overview();
    else if (node.sub) main.innerHTML = subView(node.topic, node.sub);
    else main.innerHTML = topicView(node.topic);
    $('csvBtn').disabled = !CUR; $('printBtn').disabled = !CUR;
    document.title = 'RegRadar: ' + (node ? (node.sub || node.topic).title + ' · Topics' : 'Topics');
    renderTree();
    if (focus) { var hd = main.querySelector('.vh'); if (hd) hd.focus(); if (window.matchMedia && matchMedia('(max-width: 899px)').matches && node) setSide(false); }
  }
  function setSide(open) { $('sideToggle').setAttribute('aria-expanded', String(open)); $('sideBody').classList.toggle('closed', !open); }

  function payload() {
    if (!CUR) return null;
    return { topic: { id: CUR.id, title: CUR.title, what: CUR.what },
      extracts: CUR.extracts.filter(function (x) { return extractApplies(x, ST.firm, APP); }).map(function (x) { return { source: shortOf(D._meta.law, x.celex), locator: locatorText(x), label: x.label, text: x.text }; }),
      obligations: obligationsFor(CUR, OBL, ST.firm).map(function (o) { return { id: o.id, legal_basis: o.legal_basis, what: o.what }; }),
      sources: (CUR.sources || []).map(function (id) { var s = D.sources[id]; return { id: id, authority: s.authority, title: s.title, collected: !!DOCS[id] }; }) };
  }

  function wire() {
    document.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.dataset.tx) {
        var open = b.getAttribute('aria-expanded') !== 'true';
        b.setAttribute('aria-expanded', String(open)); $('tk-' + b.dataset.tx).hidden = !open; lsSet('regradar-topics-open-' + b.dataset.tx, open ? '1' : '0');
      } else if (b.dataset.cite != null && CUR) {
        var txt = citation(CUR.extracts[+b.dataset.cite], D._meta.law);
        var done = function () { toast('Citation copied.'); };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, function () { fallbackCopy(txt); });
        else fallbackCopy(txt);
      } else if (b.id === 'aiBtn') {
        if (!SUMMARISER) { $('aiNote').textContent = 'Coming soon. Nothing was sent anywhere.'; return; }
        var out = $('aiOut'); out.textContent = 'Summarising…';
        Promise.resolve().then(function () { return SUMMARISER(payload()); }).then(function (txt) {
          out.innerHTML = '<p class="lbl2">Summary by Max (AI, check against the extracts)</p><p class="ai-text"></p>'; out.querySelector('.ai-text').textContent = String(txt || '');
        }).catch(function () { out.textContent = 'The summary could not be made.'; });
      }
    });
    $('sideToggle').addEventListener('click', function () { setSide($('sideToggle').getAttribute('aria-expanded') !== 'true'); });
    $('q').addEventListener('input', function () { ST.q = this.value.trim(); renderTree(); });
    $('firmSel').addEventListener('change', function () { ST.firm = this.value; lsSet('regradar-topics-firm', ST.firm); render(false); });
    $('hlBtn').addEventListener('click', function () { ST.hl = !ST.hl; this.setAttribute('aria-pressed', String(ST.hl)); lsSet('regradar-topics-hl', ST.hl ? '1' : '0'); render(false); });
    $('csvBtn').addEventListener('click', function () {
      if (!CUR) return;
      var csv = topicCsv(CUR, D, OBL, controlRows(CUR) || [], ST.firm, DOCS, APP);
      var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' }));
      a.download = 'regradar-topic-' + CUR.id + '-' + today() + '.csv'; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 0);
    });
    $('printBtn').addEventListener('click', function () { window.print(); });
    window.addEventListener('hashchange', function () { render(true); });
  }
  function fallbackCopy(txt) {
    var ta = document.createElement('textarea'); ta.value = txt; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select();
    var ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove(); toast(ok ? 'Citation copied.' : 'Copy is blocked here. Select the text and copy it by hand.');
  }

  function loadSources() {
    var on = D._meta.sources && (D._meta.sources.enabled || /[?&]sources=1\b/.test(location.search));
    if (!on) return Promise.resolve();
    return getJson(D._meta.sources.registry).then(function (reg) {
      if (!reg) return;
      var list = Array.isArray(reg) ? reg : (reg.sources || reg.docs || []);
      REG = {}; list.forEach(function (r) { if (r && r.id) REG[r.id] = r; });
      var want = Object.keys(D.sources).filter(function (id) { return REG[id]; });
      return Promise.all(want.map(function (id) {
        return getJson(D._meta.sources.docs.replace('<id>', encodeURIComponent(id))).then(function (d) { if (d && typeof d === 'object') DOCS[id] = d; });
      }));
    });
  }

  function start() {
    window.toggleTheme = function () { var h = document.documentElement, t = h.dataset.theme === 'dark' ? 'light' : 'dark'; h.dataset.theme = t; lsSet('regradar-theme', t); };
    window.RegTopics = {
      // AI plug-in point. fn(payload) returns text or a Promise of text. Nothing calls a model until a page sets this.
      setSummariser: function (fn) { SUMMARISER = typeof fn === 'function' ? fn : null; if (D) render(false); },
      current: payload,
      data: function () { return D; }
    };
    ST.firm = lsGet('regradar-topics-firm') || '';
    ST.hl = lsGet('regradar-topics-hl') === '1';
    $('hlBtn').setAttribute('aria-pressed', String(ST.hl));
    if (matchMedia && matchMedia('(max-width: 899px)').matches && route()) setSide(false);
    wire();
    Promise.all([getJson('data/topics.json'), getJson('data/obligations.json'), getJson('data/applicability.json')]).then(function (r) {
      D = r[0]; OBL = (r[1] && r[1].obligations) || []; APP = r[2];
      if (!D) { $('main').innerHTML = '<p class="banner">The topics could not be loaded. Reload the page.</p>'; return; }
      var sel = $('firmSel');
      ((APP && APP.entities) || []).forEach(function (e) { var o = document.createElement('option'); o.value = e.id; o.textContent = e.label; sel.appendChild(o); });
      if (ST.firm && !sel.querySelector('option[value="' + ST.firm + '"]')) ST.firm = '';
      sel.value = ST.firm;
      render(false);
      return loadSources().then(function () { if (Object.keys(DOCS).length) render(false); });
    }).then(function () {
      if (typeof RR === 'undefined' || !RR.boot) { render(false); return; }
      return RR.boot({}).then(function (b) { R = b.spine; }).catch(function () { R = null; }).then(function () { render(false); });
    });
  }

  return { start: start, highlight: highlight, keySentences: keySentences, search: search, citation: citation, locatorText: locatorText,
    csvCell: csvCell, topicCsv: topicCsv, obligationsFor: obligationsFor, extractApplies: extractApplies, appliesTo: appliesTo, RULES: RULES };
});
