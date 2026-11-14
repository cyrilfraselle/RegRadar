/* Regulatory deadlines calendar: date logic and page.

   Reads docs/data/sources/deadlines.json (the source engine's dated events;
   each has a source link, confidence high = a structured field, medium = a
   stated text pattern with the quoted sentence). Tolerant: a missing, empty
   or malformed file gives an honest empty state, never an error.

   The .ics export reuses RWData.ics from regwatch-data.js (UID, DTSTAMP,
   all-day events, escaped and folded lines). No network except the one
   same-origin JSON file. Works in the browser and in node (tests/calendar.test.mjs). */
(function (root) {
  'use strict';
  var D = root.RWData || (typeof require === 'function' ? require('./regwatch-data.js') : null);

  /* ── dates (all calendar days, no time zones) ──────────────────── */
  function parseDay(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
    if (!m) return null;
    var t = Date.UTC(+m[1], m[2] - 1, +m[3]), d = new Date(t);
    if (d.getUTCFullYear() !== +m[1] || d.getUTCMonth() !== m[2] - 1 || d.getUTCDate() !== +m[3]) return null;
    return t;
  }
  function iso(t) { return new Date(t).toISOString().slice(0, 10); }
  function daysBetween(a, b) { var x = parseDay(a), y = parseDay(b); return x == null || y == null ? null : Math.round((y - x) / 864e5); }
  function addDays(s, n) { var t = parseDay(s); return t == null ? null : iso(t + n * 864e5); }
  function todayLocal(now) {
    var d = now || new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  // Weeks (Monday first) covering a month: [[{iso, inMonth}*7]*n]
  function monthGrid(year, month0) {
    var first = Date.UTC(year, month0, 1), dow = (new Date(first).getUTCDay() + 6) % 7;
    var dim = new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate(), n = Math.ceil((dow + dim) / 7), weeks = [];
    for (var w = 0; w < n; w++) {
      var row = [];
      for (var i = 0; i < 7; i++) { var t = first + (w * 7 + i - dow) * 864e5; row.push({ iso: iso(t), inMonth: new Date(t).getUTCMonth() === month0 }); }
      weeks.push(row);
    }
    return weeks;
  }
  function shiftMonth(ym, n) { var t = new Date(Date.UTC(ym.y, ym.m + n, 1)); return { y: t.getUTCFullYear(), m: t.getUTCMonth() }; }

  /* ── classification ────────────────────────────────────────────── */
  var KINDS = [   // filter order; label is what the reader sees
    ['consultation closes', 'Consultation closes'], ['application date', 'Application date'],
    ['transposition deadline', 'Transposition deadline'], ['reporting deadline', 'Reporting deadline'], ['entry into force', 'Enters into force']
  ];
  var KIND_LABEL = {}; KINDS.forEach(function (k) { KIND_LABEL[k[0]] = k[1]; });

  var JUR = [['BE', 'Belgium'], ['EU', 'European Union'], ['GLOBAL', 'Global']];
  var AUTH_LABEL = { LAWS: 'EU law texts (RegRadar library)', OJ: 'Official Journal (EUR-Lex)', AMLA: 'AMLA' };

  function authorityOf(raw) {
    var src = String(raw.source || ''), url = String(raw.url || '');
    if (/^amla/i.test(src) || /amla\.europa\.eu/i.test(url)) return { key: 'AMLA', jur: 'EU' };
    if (/nbb\.be|nbb/i.test(src) || /nbb\.be/i.test(url)) return { key: 'NBB', jur: 'BE' };
    if (/fsma/i.test(src) || /fsma\.be/i.test(url)) return { key: 'FSMA', jur: 'BE' };
    if (/ctif|cfi-ctif/i.test(src) || /ctif-cfi\.be/i.test(url)) return { key: 'CTIF', jur: 'BE' };
    if (/^eurlex/i.test(src) || /eur-lex/i.test(url) && !/^(laws|applicability|obligations)/i.test(src)) return { key: 'OJ', jur: 'EU' };
    if (/^(laws|applicability|obligations)/i.test(src)) return { key: 'LAWS', jur: 'EU' };
    if (D && D.authority) { var a = D.authority(src); return { key: a.key, jur: a.jur }; }
    return { key: 'Other', jur: 'EU' };
  }
  var TOPICS = [   // first match wins; from the title only (a convenience filter, not a legal classification)
    ['aml', 'Anti-money laundering', /\bAML|money laundering|terrorist financ|\bFIU\b|EPPO|customer due diligence|beneficial owner|business relationship|suspicion/i],
    ['sanctions', 'Sanctions and restrictive measures', /CFSP|restrictive measures|sanction/i],
    ['crypto', 'Crypto-assets and transfers of funds', /MiCA|crypto|\bTFR\b|transfer of funds/i],
    ['resilience', 'Digital resilience', /DORA|NIS2|operational resilience|cyber/i],
    ['payments', 'Payments and e-money', /PSD|e-money|EMD|payment/i],
    ['prudential', 'Banking and markets', /\bCRR\b|CRD|MiFID|MiFIR|\bMAR\b|capital requirements|market abuse/i],
    ['data', 'Data protection', /GDPR|data protection/i]
  ];
  var TOPIC_LABEL = { other: 'Other' }; TOPICS.forEach(function (t) { TOPIC_LABEL[t[0]] = t[1]; });
  function topicOf(title) { for (var i = 0; i < TOPICS.length; i++) if (TOPICS[i][2].test(title)) return TOPICS[i][0]; return 'other'; }
  function cleanTitle(t) { return D && D.cleanTitle ? D.cleanTitle(t) : String(t || '').replace(/\s+/g, ' ').trim(); }

  // Tolerant: accepts the file's object, a bare array, or nothing.
  function normalise(file) {
    var arr = Array.isArray(file) ? file : (file && Array.isArray(file.deadlines) ? file.deadlines : []);
    var out = [], seen = {};
    arr.forEach(function (r, i) {
      if (!r || typeof r !== 'object' || parseDay(r.date) == null) return;
      var title = cleanTitle(r.title);
      if (!title) return;
      var a = authorityOf(r);
      var id = String(r.id || ('d' + r.date.replace(/-/g, '') + '-' + i));
      if (seen[id]) id += '-' + i; seen[id] = 1;
      var url = String(r.url || '');
      out.push({ id: id, date: r.date, kind: String(r.kind || 'application date'), title: title, url: url,
        confidence: r.confidence === 'medium' ? 'medium' : (r.confidence === 'high' ? 'high' : 'medium'),
        quote: String(r.quote || ''), loc: String(r.loc || ''), method: String(r.method || ''), source: String(r.source || ''),
        authKey: a.key, jur: a.jur, topic: topicOf(title) });
    });
    return out.sort(function (x, y) { return x.date.localeCompare(y.date) || x.kind.localeCompare(y.kind) || x.title.localeCompare(y.title); });
  }

  /* ── filters ───────────────────────────────────────────────────── */
  // f: {auth, kind, jur, topic, window: '90'|'180'|'365'|'all'|'past', today}
  function filter(list, f) {
    f = f || {};
    return list.filter(function (d) {
      if (f.auth && d.authKey !== f.auth) return false;
      if (f.kind && d.kind !== f.kind) return false;
      if (f.jur && d.jur !== f.jur) return false;
      if (f.topic && d.topic !== f.topic) return false;
      return true;
    });
  }
  function inWindow(list, win, today) {
    return list.filter(function (d) {
      var n = daysBetween(today, d.date);
      if (n == null) return false;
      if (win === 'past') return n < 0;
      if (win === 'all') return n >= 0;
      return n >= 0 && n <= parseInt(win, 10);
    });
  }
  function counts(list, key) { var c = {}; list.forEach(function (d) { c[d[key]] = (c[d[key]] || 0) + 1; }); return c; }

  /* ── .ics (reuses RWData.ics: UID, DTSTAMP, all-day, escaped, folded) ── */
  function toIcs(list, stamp) {
    var ok = (list || []).filter(function (d) { return parseDay(d.date) != null; }).map(function (d) {
      return { id: d.id, date: d.date, kind: d.kind, title: d.title, url: d.url, quote: d.quote, loc: d.loc,
        method: d.method + (d.confidence === 'medium' ? ' (medium confidence: check the source)' : '') };
    });
    return D.ics(ok, stamp);
  }

  var API = { parseDay: parseDay, daysBetween: daysBetween, addDays: addDays, todayLocal: todayLocal, monthGrid: monthGrid, shiftMonth: shiftMonth,
    KINDS: KINDS, KIND_LABEL: KIND_LABEL, JUR: JUR, AUTH_LABEL: AUTH_LABEL, TOPICS: TOPICS, TOPIC_LABEL: TOPIC_LABEL,
    authorityOf: authorityOf, topicOf: topicOf, normalise: normalise, filter: filter, inWindow: inWindow, counts: counts, toIcs: toIcs };
  root.RRCal = API;
  if (typeof module === 'object' && module.exports) module.exports = API;

  /* ═══ page ═══════════════════════════════════════════════════════ */
  if (typeof document === 'undefined' || !document.getElementById('calApp')) return;
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var qs = new URLSearchParams(location.search);
  var TODAY = parseDay(qs.get('today')) != null ? qs.get('today') : todayLocal();
  var S = { all: [], loaded: false, fail: false, view: 'list', win: '90', f: { auth: '', kind: '', jur: '', topic: '' }, picked: {},
    ym: { y: +TODAY.slice(0, 4), m: +TODAY.slice(5, 7) - 1 }, day: '', generated: '' };
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function fmtDate(s) { var t = parseDay(s); return t == null ? s : new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }); }
  function authName(k) { return AUTH_LABEL[k] || (D && D.AUTH_NAME && D.AUTH_NAME[k]) || k; }
  function safeUrl(u) { return /^https?:\/\//i.test(u) || /^law\.html\?/.test(u) ? u : ''; }
  function rel(s) {
    var n = daysBetween(TODAY, s);
    return n === 0 ? 'today' : n === 1 ? 'tomorrow' : n === -1 ? 'yesterday' : n > 0 ? 'in ' + n + ' days' : -n + ' days ago';
  }

  function rowHtml(d) {
    var id = 'c-' + esc(d.id), u = safeUrl(d.url);
    return '<li class="crow"><label class="cr-l" for="' + id + '"><input type="checkbox" id="' + id + '" data-pick="' + esc(d.id) + '"' + (S.picked[d.id] ? ' checked' : '') + '>' +
      '<span class="cr-date num"><b>' + esc(fmtDate(d.date)) + '</b><span>' + esc(rel(d.date)) + '</span></span>' +
      '<span class="cr-body"><span class="t">' + esc(d.title) + '</span><span class="m"><span class="pill live">' + esc(KIND_LABEL[d.kind] || d.kind) + '</span>' +
      '<span class="pill ' + (d.confidence === 'high' ? 'done' : 'review') + '">' + (d.confidence === 'high' ? 'Confidence: high' : 'Confidence: medium') + '</span>' +
      '<span class="hint">' + esc(authName(d.authKey)) + ' · ' + esc(TOPIC_LABEL[d.topic]) + '</span></span>' +
      (d.confidence === 'medium' ? '<q>' + (d.quote ? esc(d.quote) + (d.loc ? ' (' + esc(d.loc) + ')' : '') : 'No sentence stored for this date. Check the source.') + '</q>'
        : '<span class="hint">' + esc(d.method) + '</span>') + '</span></label>' +
      (u ? '<p class="cr-src"><a href="' + esc(u) + '"' + (/^https?:/.test(u) ? ' target="_blank" rel="noopener"' : '') + '>Source<span class="sr"> for ' + esc(d.title.slice(0, 80)) + '</span></a></p>' : '') + '</li>';
  }

  function listItems() { return inWindow(filter(S.all, S.f), S.win, TODAY); }
  function shownNow() {
    if (S.view === 'month') { var p = S.ym.y + '-' + String(S.ym.m + 1).padStart(2, '0'); return filter(S.all, S.f).filter(function (d) { return d.date.slice(0, 7) === p; }); }
    return listItems();
  }
  function emptyState() {
    if (S.fail) return '<div class="rr-empty"><h2>The deadlines could not be loaded</h2><p>Check your connection and reload. This does not mean there are no deadlines.</p></div>';
    if (!S.all.length) return '<div class="rr-empty"><h2>No dated deadlines yet</h2><p>The source engine has not published any dated events (docs/data/sources/deadlines.json is missing or empty). Nothing here should be read as "no deadline".</p></div>';
    var any = S.f.auth || S.f.kind || S.f.jur || S.f.topic;
    var all = filter(S.all, S.f), next = inWindow(all, 'all', TODAY)[0];
    var msg = S.f.jur === 'BE' && !all.length ? 'The sources hold no Belgian dated deadline yet (NBB, FSMA and CTIF-CFI dates are not in the engine feed). That is a gap in coverage, not proof that none exist.'
      : S.win === 'past' ? 'No past date matches.' : any ? 'No date matches these filters in this window.' : 'Nothing is dated in this window.';
    return '<div class="rr-empty"><h2>Nothing to show</h2><p>' + esc(msg) + (next && S.win !== 'past' ? ' The next matching date is ' + esc(fmtDate(next.date)) + '. Widen the window to see it.' : '') + '</p></div>';
  }

  function renderList() {
    var list = listItems();
    if (!list.length) return emptyState();
    var h = '', month = '';
    list.forEach(function (d) {
      var m = MONTHS[+d.date.slice(5, 7) - 1] + ' ' + d.date.slice(0, 4);
      if (m !== month) { if (month) h += '</ul>'; h += '<h3 class="mh">' + esc(m) + '</h3><ul class="clist">'; month = m; }
      h += rowHtml(d);
    });
    return h + '</ul>';
  }
  function renderMonth() {
    var y = S.ym.y, m = S.ym.m, p = y + '-' + String(m + 1).padStart(2, '0');
    var items = filter(S.all, S.f), by = {};
    items.forEach(function (d) { (by[d.date] = by[d.date] || []).push(d); });
    var weeks = monthGrid(y, m);
    var h = '<div class="mnav"><button class="btn" type="button" id="mPrev" aria-label="Previous month">Previous</button><h3 id="mTitle" aria-live="polite">' + MONTHS[m] + ' ' + y + '</h3>' +
      '<button class="btn" type="button" id="mNext" aria-label="Next month">Next</button><button class="btn quiet" type="button" id="mToday">Today</button></div>';
    h += '<table class="mgrid"><caption class="sr">' + MONTHS[m] + ' ' + y + ', days with deadlines are buttons</caption><thead><tr>' +
      ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(function (x) { return '<th scope="col">' + x + '</th>'; }).join('') + '</tr></thead><tbody>';
    weeks.forEach(function (w) {
      h += '<tr>' + w.map(function (c) {
        var n = (by[c.iso] || []).length, dn = +c.iso.slice(8), cls = (c.inMonth ? '' : 'out ') + (c.iso === TODAY ? 'today ' : '') + (c.iso === S.day ? 'sel' : '');
        if (!c.inMonth) return '<td class="' + cls + '" aria-hidden="true"><span class="dn">' + dn + '</span></td>';
        return '<td class="' + cls + '">' + (n ? '<button type="button" class="dbtn" data-day="' + c.iso + '" aria-pressed="' + (c.iso === S.day) + '" aria-label="' + esc(fmtDate(c.iso)) + ', ' + n + (n === 1 ? ' deadline' : ' deadlines') + '"><span class="dn">' + dn + '</span><span class="dc">' + n + '</span></button>'
          : '<span class="dn">' + dn + '</span>') + '</td>';
      }).join('') + '</tr>';
    });
    h += '</tbody></table>';
    var inM = items.filter(function (d) { return d.date.slice(0, 7) === p; });
    if (!inM.length) h += '<div class="rr-empty"><h2>No dates in ' + MONTHS[m] + ' ' + y + '</h2><p>' + esc(S.all.length ? 'Nothing matches the filters this month. Use Previous or Next, or clear the filters.' : 'There is no data to show.') + '</p></div>';
    else {
      var shown = S.day && by[S.day] ? by[S.day] : inM;
      h += '<h3 class="mh">' + (S.day && by[S.day] ? esc(fmtDate(S.day)) : 'All of ' + MONTHS[m] + ' ' + y) + ' <span class="count">' + shown.length + '</span></h3>' +
        (S.day && by[S.day] ? '<button class="btn quiet" type="button" id="dayClear">Show the whole month</button>' : '') + '<ul class="clist">' + shown.map(rowHtml).join('') + '</ul>';
    }
    return h;
  }

  function render(focus) {
    $('view').innerHTML = S.view === 'month' ? renderMonth() : renderList();
    $('winWrap').hidden = S.view === 'month';
    document.querySelectorAll('#viewSeg [data-view]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.view === S.view)); });
    var shown = shownNow(), picked = Object.keys(S.picked).filter(function (id) { return S.all.some(function (d) { return d.id === id; }); });
    $('icsBtn').textContent = picked.length ? 'Download .ics for ' + picked.length + ' selected' : 'Download .ics for all ' + shown.length + ' shown';
    $('icsBtn').disabled = !picked.length && !shown.length;
    $('pickAll').textContent = shown.length && shown.every(function (d) { return S.picked[d.id]; }) ? 'Select none' : 'Select all shown';
    $('pickAll').disabled = !shown.length;
    var n = S.view === 'list' ? listItems().length : shown.length;
    $('count').textContent = S.fail || !S.all.length ? '' : n + (n === 1 ? ' date' : ' dates') + (S.view === 'list' ? (S.win === 'past' ? ', past' : S.win === 'all' ? ' ahead' : ' in the next ' + S.win + ' days') : ' in the month');
    $('clr').hidden = !(S.f.auth || S.f.kind || S.f.jur || S.f.topic);
    if (focus) { var el = $(focus); if (el) el.focus(); }
  }

  function buildFilters() {
    function sel(id, label, opts) {
      $(id).innerHTML = opts.map(function (o) { return '<option value="' + esc(o[0]) + '">' + esc(o[1]) + '</option>'; }).join('');
    }
    var ca = counts(S.all, 'authKey'), ck = counts(S.all, 'kind'), cj = counts(S.all, 'jur'), ct = counts(S.all, 'topic');
    var order = ['NBB', 'FSMA', 'CTIF', 'AMLA', 'OJ', 'LAWS'];
    var akeys = Object.keys(ca).sort(function (x, y) { var a = order.indexOf(x), b = order.indexOf(y); return (a < 0 ? 99 : a) - (b < 0 ? 99 : b) || x.localeCompare(y); });
    sel('fAuth', '', [['', 'All authorities']].concat(akeys.map(function (k) { return [k, authName(k) + ' (' + ca[k] + ')']; })));
    sel('fKind', '', [['', 'All kinds']].concat(KINDS.map(function (k) { return [k[0], k[1] + ' (' + (ck[k[0]] || 0) + ')']; })));
    sel('fJur', '', [['', 'All jurisdictions']].concat(JUR.map(function (j) { return [j[0], j[1] + ' (' + (cj[j[0]] || 0) + ')']; })));
    var tk = TOPICS.map(function (t) { return t[0]; }).concat(['other']);
    sel('fTopic', '', [['', 'All topics']].concat(tk.filter(function (k) { return ct[k]; }).map(function (k) { return [k, TOPIC_LABEL[k] + ' (' + ct[k] + ')']; })));
  }
  function toast(t) { var el = $('toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(function () { el.classList.remove('on'); }, 3200); }

  function bind() {
    [['fAuth', 'auth'], ['fKind', 'kind'], ['fJur', 'jur'], ['fTopic', 'topic']].forEach(function (p) {
      $(p[0]).addEventListener('change', function (e) { S.f[p[1]] = e.target.value; S.day = ''; render(); });
    });
    $('fWin').addEventListener('change', function (e) { S.win = e.target.value; render(); });
    $('clr').addEventListener('click', function () { S.f = { auth: '', kind: '', jur: '', topic: '' }; ['fAuth', 'fKind', 'fJur', 'fTopic'].forEach(function (i) { $(i).value = ''; }); S.day = ''; render('fAuth'); });
    document.querySelectorAll('#viewSeg [data-view]').forEach(function (b) { b.addEventListener('click', function () { S.view = b.dataset.view; S.day = ''; render(); }); });
    $('view').addEventListener('change', function (e) {
      var id = e.target.dataset && e.target.dataset.pick; if (!id) return;
      if (e.target.checked) S.picked[id] = 1; else delete S.picked[id];
      var shown = shownNow(), picked = Object.keys(S.picked).length;
      $('icsBtn').textContent = picked ? 'Download .ics for ' + picked + ' selected' : 'Download .ics for all ' + shown.length + ' shown';
      $('pickAll').textContent = shown.length && shown.every(function (d) { return S.picked[d.id]; }) ? 'Select none' : 'Select all shown';
    });
    $('view').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.id === 'mPrev') { S.ym = shiftMonth(S.ym, -1); S.day = ''; render('mPrev'); }
      else if (b.id === 'mNext') { S.ym = shiftMonth(S.ym, 1); S.day = ''; render('mNext'); }
      else if (b.id === 'mToday') { S.ym = { y: +TODAY.slice(0, 4), m: +TODAY.slice(5, 7) - 1 }; S.day = ''; render('mToday'); }
      else if (b.id === 'dayClear') { S.day = ''; render('mTitle'); }
      else if (b.dataset.day) { var d = b.dataset.day; S.day = S.day === d ? '' : d; render(); var nb = document.querySelector('[data-day="' + d + '"]'); if (nb) nb.focus(); }
    });
    $('pickAll').addEventListener('click', function () {
      var shown = shownNow(), all = shown.every(function (d) { return S.picked[d.id]; });
      shown.forEach(function (d) { if (all) delete S.picked[d.id]; else S.picked[d.id] = 1; });
      render('pickAll');
    });
    $('icsBtn').addEventListener('click', function () {
      var picked = S.all.filter(function (d) { return S.picked[d.id]; }), list = picked.length ? picked : shownNow();
      if (!list.length) return;
      var a = document.createElement('a'), u = URL.createObjectURL(new Blob([toIcs(list)], { type: 'text/calendar;charset=utf-8' }));
      a.href = u; a.download = 'regradar-deadlines.ics'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 1500);
      toast(list.length + (list.length === 1 ? ' date' : ' dates') + ' saved as regradar-deadlines.ics');
    });
  }

  function boot() {
    bind();
    fetch('data/sources/deadlines.json', { cache: 'no-cache' }).then(function (r) { if (r.status === 404) return null; if (!r.ok) throw new Error(r.status); return r.json(); })
      .catch(function (e) { S.fail = true; return null; })
      .then(function (j) {
        S.loaded = true; S.all = normalise(j);
        S.generated = j && j._meta && j._meta.generated ? String(j._meta.generated).slice(0, 10) : '';
        var g = $('gen');
        if (S.generated) { var age = daysBetween(S.generated, TODAY); g.textContent = 'Source data generated ' + fmtDate(S.generated) + (age > 3 ? ' (' + age + ' days ago: dates may be out of date).' : '.'); }
        buildFilters(); render();
      });
  }
  boot();
})(typeof window !== 'undefined' ? window : globalThis);
