/* RegWatch page (docs/regwatch.html). Data shaping lives in
   regwatch-data.js (RWData); this file only loads, filters and draws. */
(function () {
  'use strict';
  var D = window.RWData;
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  var safeUrl = function (u) { return /^(https?:\/\/|[a-z0-9-]+\.html)/i.test(u || '') ? u : ''; };
  var ls = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } }
  };
  var PKEY = 'regradar-profile', VKEY = 'regradar-regwatch-views', PAGE = 20;

  var S = {
    items: [], deadlines: [], app: null, tagLabel: {}, source: '', generated: '', loadFail: false,
    f: { q: '', jur: '', auth: '', topic: '', type: '', status: '', mine: false }, sort: 'rank', shown: PAGE,
    win: '90', picked: {}, entity: '', acts: []
  };
  var TODAY = D.todayUTC();

  /* ── formatting ───────────────────────────────────────────────── */
  function fmt(d, opt) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d || ''); if (!m) return '';
    return new Date(Date.UTC(+m[1], m[2] - 1, +m[3])).toLocaleDateString('en-GB', Object.assign({ day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }, opt || {}));
  }
  function countdown(n) { return n == null ? '' : n < 0 ? 'passed' : n === 0 ? 'today' : n === 1 ? 'tomorrow' : 'in ' + n + ' days'; }
  function label(tag) { return S.tagLabel[tag] || D.TOPIC_LABEL[tag] || tag; }
  var STATUS_PILL = { inforce: 'live', final: 'done', draft: 'review', info: '' };
  var JUR = { BE: 'Belgium', EU: 'EU', GLOBAL: 'Global' };

  /* ── "for my firm": regulation topics -> engine topic tags ──────── */
  var AML_TAGS = ['cdd', 'cdd-natural-person', 'cdd-legal-entity', 'pep', 'beneficial-ownership', 'simplified-edd',
    'ongoing-monitoring', 'reporting-str', 'record-keeping', 'governance-risk-assessment', 'sanctions',
    'high-risk-countries', 'training', 'outsourcing-reliance', 'transfers-of-funds'];
  var REG_TAGS = { 'AML/CFT': AML_TAGS, 'Crypto': ['crypto-assets', 'transfers-of-funds'],
    'Payments': ['payments-emoney', 'transfers-of-funds'], 'Data Protection': ['record-keeping'] };
  function verdict(reg) {
    var s = (reg.applies || {})[S.entity] || 'na', raises = reg.activity_raises || {};
    S.acts.forEach(function (a) { var t = raises[a]; if (t && t.indexOf(S.entity) >= 0) s = s === 'na' ? 'conditional' : 'direct'; });
    return s;
  }
  function myTags() {
    if (!S.app || !S.entity) return [];
    var set = {};
    S.app.regulations.forEach(function (r) { if (verdict(r) !== 'na') (REG_TAGS[r.topic] || []).forEach(function (t) { set[t] = 1; }); });
    return Object.keys(set);
  }

  /* ── filtering ────────────────────────────────────────────────── */
  function filt() { var f = Object.assign({}, S.f); f.mine = S.f.mine ? myTags() : null; return f; }
  function visible(list) {
    var f = filt(), out = list.filter(function (it) { return D.matches(it, f, label); });
    return out.sort(S.sort === 'date'
      ? function (a, b) { return (b.date || '').localeCompare(a.date || '') || b.rank - a.rank; }
      : function (a, b) { return b.rank - a.rank || (b.date || '').localeCompare(a.date || ''); });
  }
  function anyFilter() { var f = S.f; return !!(f.q || f.jur || f.auth || f.topic || f.type || f.status || f.mine); }

  /* ── cards ────────────────────────────────────────────────────── */
  function card(it, plain) {
    var url = safeUrl(it.url), age = D.daysUntil(TODAY, it.date), isNew = !it.dateMissing && age != null && age >= 0 && age <= 7;
    var who = it.isNews
      ? '<b>News</b><span class="sep" aria-hidden="true">·</span><span>' + esc(it.authority) + '</span>'
      : '<b>' + esc(it.authority) + '</b><span class="sep" aria-hidden="true">·</span><span>' + esc(JUR[it.jur] || it.jur) +
        '</span><span class="sep" aria-hidden="true">·</span><span>' + esc(D.TYPE_LABEL[it.type] || it.type) +
        '</span><span class="sep" aria-hidden="true">·</span><span>Primary source</span>';
    var st = it.isNews ? '' : '<span class="pill ' + STATUS_PILL[it.status] + '" title="' + esc(it.statusRaw ? 'Source status: ' + it.statusRaw : '') + '">' + D.STATUS_LABEL[it.status] + '</span>';
    var dates = [];
    if (it.date) dates.push((it.dateMissing ? 'Listed ' : 'Published ') + fmt(it.date));
    if (it.firstSeen) dates.push('first seen ' + fmt(it.firstSeen));
    var dls = it.deadlines.length ? '<ul class="dls" aria-label="Dates in this document">' + it.deadlines.slice(0, 4).map(function (d) {
      var n = D.daysUntil(d.date, TODAY);
      return '<li><span class="d">' + fmt(d.date) + '</span><span>' + esc(D.KIND_LABEL[d.kind] || d.kind) + '</span><span class="hint">' + countdown(n) + '</span>' +
        (d.quote ? '<q>' + esc(d.quote) + (d.loc ? ' (' + esc(d.loc) + ')' : '') + '</q>' : '') + '</li>';
    }).join('') + '</ul>' : '';
    var chg = it.change === 'changed' ? '<p class="chg"><b>Updated' + (it.changedAt ? ' ' + fmt(it.changedAt) : '') + ':</b> ' +
      esc(it.whatChanged || 'the source changed this entry since it was first seen.') + '</p>' : '';
    var tags = it.topics.map(function (t) {
      var h = D.topicHref(t);
      return h ? '<a class="chip" href="' + h + '" aria-label="Topic: ' + esc(label(t)) + ' (open in Topics)">' + esc(label(t)) + '</a>'
        : '<span class="chip">' + esc(label(t)) + '</span>';
    }).concat(it.themes.map(function (t) { return '<span class="chip">' + esc(t) + '</span>'; })).join('');
    var also = it.also.length ? '<div class="also"><h4>' + (it.isNews ? 'Also reported by' : 'Other sources on this story') + '</h4><ul>' +
      it.also.map(function (m) {
        var u = safeUrl(m.url);
        return '<li><span class="src">' + (m.isNews ? 'News · ' : '') + esc(m.authority) + '</span>' +
          (u ? '<a href="' + esc(u) + '" target="_blank" rel="noopener">' + esc(m.title) + '</a>' : '<span>' + esc(m.title) + '</span>') + '</li>';
      }).join('') + '</ul></div>' : '';
    var snip = it.summary && it.summary.length > 40 && it.summary.toLowerCase().indexOf(it.title.slice(0, 40).toLowerCase()) !== 0 ? it.summary : '';
    return '<li class="' + (plain ? 'doc plain' : 'rr-card doc') + '" data-id="' + esc(it.id) + '">' +
      '<h3>' + (url ? '<a href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(it.title) + ' <span class="ext" aria-hidden="true">↗</span><span class="sr"> (opens the source in a new tab)</span></a>' : esc(it.title)) + '</h3>' +
      '<p class="who">' + who + '</p>' +
      '<div class="state">' + st + (isNew ? '<span class="pill">New</span>' : '') +
        (it.change === 'changed' ? '<span class="pill review">Updated</span>' : '') +
        '<span class="dates">' + esc(dates.join(' · ')) + '</span></div>' +
      (snip ? '<p class="snip">' + esc(snip) + '</p>' : '') +
      chg + dls + (tags ? '<div class="chips tags">' + tags + '</div>' : '') + also + '</li>';
  }

  /* ── renderers ────────────────────────────────────────────────── */
  function renderStats() {
    var prim = S.items.filter(function (i) { return !i.isNews; });
    // Publication date, not first seen: the engine's first run saw everything at once.
    var week = prim.filter(function (i) { var n = D.daysUntil(TODAY, i.date); return !i.dateMissing && n != null && n <= 7 && n >= 0; });
    var be = prim.filter(function (i) { return i.jur === 'BE'; });
    var up = D.upcoming(S.deadlines, TODAY, 90);
    var tile = function (n, l, s, extra) { return '<div class="rr-stat' + (extra || '') + '"><div class="n">' + n + '</div><div class="l">' + l + '</div><div class="s">' + s + '</div></div>'; };
    $('stats').innerHTML = S.loadFail ? tile('–', 'Documents', 'Not loaded') + tile('–', 'This week', '&nbsp;') + tile('–', 'Belgium', 'NBB and FSMA') + tile('–', 'Deadlines', 'Next 90 days')
      : tile(prim.length, 'Documents', S.source === 'engine' ? 'Last 120 days, ranked' : 'Legacy archive') +
        tile(week.length, 'This week', 'Published in the last 7 days') +
        tile(be.length, 'Belgium', 'NBB and FSMA') +
        tile(up.length, 'Deadlines', up.length ? 'Next: ' + fmt(up[0].date, { year: undefined }) : 'Next 90 days');
  }
  function renderMeta() {
    var el = $('upd'), age = D.staleDays(S.generated);
    if (S.loadFail) { el.textContent = 'The feed could not be loaded.'; return; }
    var d = S.generated ? new Date(/(Z|[+-]\d\d:?\d\d)$/.test(S.generated) ? S.generated : S.generated + 'Z') : null;
    el.innerHTML = '<span>' + (S.source === 'engine' ? 'Source engine' : 'Legacy archive') + (d && !isNaN(d) ? ', updated ' +
      esc(d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })) : '') + '</span>' +
      (age != null && age >= 3 ? '<span class="stale" role="status">Feed last refreshed ' + age + ' days ago: documents and deadlines may be out of date.</span>' : '');
  }
  function renderNotice() {
    var n = $('notice');
    if (S.loadFail) {
      n.innerHTML = '<div class="banner warn" role="alert"><p><b>Could not load RegWatch.</b> Check your connection and try again. Nothing here should be read as "no changes".</p><button class="btn sm" type="button" id="retry">Retry</button></div>';
      $('retry').addEventListener('click', function () { this.disabled = true; this.textContent = 'Retrying…'; boot(true); });
    } else if (S.source === 'legacy') {
      n.innerHTML = '<div class="banner"><p>The source engine feed is empty, so this page shows the legacy archive. Status and topics are less precise there, and it has no first-seen dates.</p></div>';
    } else n.innerHTML = '';
  }
  function renderDocs(focusIdx) {
    var list = visible(S.items.filter(function (i) { return !i.isNews; }));
    var ul = $('docs');
    if (S.loadFail) { ul.innerHTML = '<li class="rr-card state-msg"><b>No documents loaded</b>Use Retry above.</li>'; $('moreWrap').innerHTML = ''; $('resN').textContent = ''; return; }
    ul.innerHTML = list.length ? list.slice(0, S.shown).map(card).join('')
      : '<li class="rr-card state-msg"><b>' + (anyFilter() ? 'No documents match' : 'No documents yet') + '</b>' + (anyFilter() ? 'Clear a filter to see more.' : 'The feed has no primary documents in its window.') + '</li>';
    $('resN').textContent = list.length + (list.length === 1 ? ' document' : ' documents') + (anyFilter() ? ' match' : '');
    var left = list.length - S.shown;
    $('moreWrap').innerHTML = left > 0 ? '<button class="btn" type="button" id="more">Show ' + Math.min(PAGE, left) + ' more (' + left + ' left)</button>' : '';
    if (left > 0) $('more').addEventListener('click', function () { var was = S.shown; S.shown += PAGE; renderDocs(was); });
    if (focusIdx != null) { var c = ul.children[focusIdx]; var a = c && c.querySelector('a'); if (a) a.focus(); }
    $('clrBtn').hidden = !anyFilter();
  }
  function renderNews() {
    var list = visible(S.items.filter(function (i) { return i.isNews; }));
    var all = S.items.filter(function (i) { return i.isNews; }).length;
    $('newsN').textContent = S.loadFail ? '' : all ? (list.length === all ? all : list.length + ' of ' + all) + (all === 1 ? ' story' : ' stories') : 'none in this feed';
    $('news').innerHTML = list.length ? list.slice(0, 30).map(function (it) { return card(it, true); }).join('')
      : '<li class="state-msg">' + (all ? 'No news story matches the filters.' : 'No news-only stories: every outlet in this feed covers a primary document and is listed under it.') + '</li>';
  }
  function windowDays() { return S.win === 'all' ? null : +S.win; }
  function renderDeadlines() {
    var body = $('dlBody');
    if (S.loadFail) { body.innerHTML = '<p class="hint">Not loaded.</p>'; return; }
    var days = windowDays(), list = D.upcoming(S.deadlines, TODAY, days);
    document.querySelectorAll('#dlWin [data-win]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.win === S.win)); });
    if (!list.length) {
      var later = D.upcoming(S.deadlines, TODAY, null);
      body.innerHTML = '<p class="state-msg" style="padding:var(--rr-4) 0"><b>Nothing due in this window</b>' +
        (later.length ? 'Next date: ' + fmt(later[0].date) + '. Widen the window to see it.' : 'No dated deadline ahead in the sources.') + '</p>';
      return;
    }
    // strip: markers along the window (the last date sets the scale for "All")
    var span = days || Math.max(30, D.daysUntil(list[list.length - 1].date, TODAY));
    var ticks = [], t0 = new Date(TODAY + 'T00:00:00Z');
    var step = span > 400 ? 12 : span > 120 ? 3 : 1, m = 0;
    while (true) {
      var dt = new Date(Date.UTC(t0.getUTCFullYear(), t0.getUTCMonth() + m + 1, 1));
      var n = Math.round((dt - t0) / 864e5); if (n > span) break;
      if (n / span < 0.9 && n / span > 0.06) ticks.push('<span class="tick" style="left:' + (100 * n / span).toFixed(2) + '%">' +
        dt.toLocaleDateString('en-GB', step >= 12 ? { year: 'numeric', timeZone: 'UTC' } : { month: 'short', timeZone: 'UTC' }) + '</span>');
      m += step;
    }
    var marks = list.map(function (d) { var n = D.daysUntil(d.date, TODAY); return '<span class="mk' + (n < 14 ? ' soon' : '') + '" style="left:' + Math.min(100, 100 * n / span).toFixed(2) + '%"></span>'; }).join('');
    var picked = list.filter(function (d) { return S.picked[d.id]; }).length;
    body.innerHTML = '<div class="strip" aria-hidden="true"><span class="now">Today</span><div class="track"></div>' + ticks.join('') + marks + '</div>' +
      '<p class="hint">' + list.length + (list.length === 1 ? ' date' : ' dates') + (days ? ' in the next ' + (days === 90 ? '90 days' : '12 months') : ' ahead') +
      '. Each comes from a stated field or quoted sentence in the source.</p>' +
      '<ul class="dl-list">' + list.slice(0, S.dlAll ? list.length : 5).map(function (d) {
        var n = D.daysUntil(d.date, TODAY), u = safeUrl(d.url), id = 'dl-' + esc(d.id);
        return '<li><label class="dl-row" for="' + id + '"><input type="checkbox" id="' + id + '" data-dl="' + esc(d.id) + '"' + (S.picked[d.id] ? ' checked' : '') + '>' +
          '<span class="dl-date"><b>' + fmt(d.date, { month: undefined, year: undefined }) + '</b><span>' + fmt(d.date, { day: undefined }) + '</span></span>' +
          '<span class="dl-body"><span class="t">' + esc(D.cleanTitle(d.title)) + '</span><span class="m"><span class="pill' + (n < 14 ? ' risk' : '') + '">' +
          esc(D.KIND_LABEL[d.kind] || d.kind) + '</span><span>' + countdown(n) + '</span></span>' +
          (d.quote ? '<q>' + esc(d.quote) + (d.loc ? ' (' + esc(d.loc) + ')' : '') + '</q>' : '') + '</span></label>' +
          (u ? '<p class="dl-src"><a href="' + esc(u) + '"' + (/^https?:/.test(u) ? ' target="_blank" rel="noopener"' : '') + '>Source<span class="sr"> for ' + esc(D.cleanTitle(d.title).slice(0, 80)) + '</span></a></p>' : '') + '</li>';
      }).join('') + '</ul>' +
      (list.length > 5 ? '<button class="btn sm" type="button" id="dlMore" aria-expanded="' + !!S.dlAll + '">' + (S.dlAll ? 'Show the first 5' : 'Show all ' + list.length + ' dates') + '</button>' : '') +
      '<div class="dl-foot"><button class="btn pri" type="button" id="icsBtn">' + (picked ? 'Add ' + picked + ' to calendar (.ics)' : 'Add all ' + list.length + ' to calendar (.ics)') + '</button>' +
      '<button class="btn sm quiet" type="button" id="pickAll">' + (picked === list.length ? 'Select none' : 'Select all') + '</button></div>';
    body.querySelectorAll('[data-dl]').forEach(function (c) {
      c.addEventListener('change', function () { if (c.checked) S.picked[c.dataset.dl] = 1; else delete S.picked[c.dataset.dl]; updateIcsLabel(list); });
    });
    if ($('dlMore')) $('dlMore').addEventListener('click', function () { S.dlAll = !S.dlAll; renderDeadlines(); $('dlMore').focus(); });
    $('pickAll').addEventListener('click', function () {
      var all = list.every(function (d) { return S.picked[d.id]; });
      list.forEach(function (d) { if (all) delete S.picked[d.id]; else S.picked[d.id] = 1; });
      body.querySelectorAll('[data-dl]').forEach(function (c) { c.checked = !all; });
      updateIcsLabel(list);
    });
    $('icsBtn').addEventListener('click', function () {
      var sel = list.filter(function (d) { return S.picked[d.id]; });
      downloadIcs(sel.length ? sel : list);
    });
  }
  function updateIcsLabel(list) {
    var picked = list.filter(function (d) { return S.picked[d.id]; }).length;
    $('icsBtn').textContent = picked ? 'Add ' + picked + ' to calendar (.ics)' : 'Add all ' + list.length + ' to calendar (.ics)';
    $('pickAll').textContent = picked === list.length ? 'Select none' : 'Select all';
  }
  function downloadIcs(list) {
    var blob = new Blob([D.ics(list)], { type: 'text/calendar;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'regwatch-deadlines.ics';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
    toast(list.length + (list.length === 1 ? ' date' : ' dates') + ' saved as regwatch-deadlines.ics');
  }
  function toast(msg) {
    var t = $('toast'); t.textContent = msg; t.classList.add('on');
    clearTimeout(toast.t); toast.t = setTimeout(function () { t.classList.remove('on'); }, 3200);
  }

  /* ── filter controls (built once per load, so focus is never lost) ─ */
  function opt(v, text, n) { return '<option value="' + esc(v) + '">' + esc(text) + (n != null ? ' (' + n + ')' : '') + '</option>'; }
  function count(key) { var c = {}; S.items.filter(function (i) { return !i.isNews; }).forEach(function (i) { [].concat(i[key]).forEach(function (v) { if (v) c[v] = (c[v] || 0) + 1; }); }); return c; }
  function buildFilters() {
    var a = count('authKey'), keys = Object.keys(a).sort(function (x, y) {
      var ix = D.AUTH_ORDER.indexOf(x), iy = D.AUTH_ORDER.indexOf(y);
      return (ix < 0 ? 99 : ix) - (iy < 0 ? 99 : iy) || x.localeCompare(y);
    });
    $('fAuth').innerHTML = opt('', 'All authorities') + keys.map(function (k) { return opt(k, D.AUTH_NAME[k] || k, a[k]); }).join('');
    var tp = count('topics'), th = count('themes');
    $('fTopic').innerHTML = opt('', 'All topics') + Object.keys(tp).sort(function (x, y) { return label(x).localeCompare(label(y)); }).map(function (k) { return opt(k, label(k), tp[k]); }).join('') +
      Object.keys(th).sort().map(function (k) { return opt(k, k, th[k]); }).join('');
    var ty = count('type');
    $('fType').innerHTML = opt('', 'All types') + D.TYPE_ORDER.filter(function (k) { return ty[k]; }).map(function (k) { return opt(k, D.TYPE_LABEL[k], ty[k]); }).join('');
    var st = count('status');
    $('fStatus').innerHTML = opt('', 'Any status') + ['draft', 'final', 'inforce', 'info'].filter(function (k) { return st[k]; }).map(function (k) { return opt(k, D.STATUS_LABEL[k], st[k]); }).join('');
    syncControls();
  }
  function syncControls() {
    $('q').value = S.f.q; $('fAuth').value = S.f.auth; $('fTopic').value = S.f.topic; $('fType').value = S.f.type; $('fStatus').value = S.f.status; $('sort').value = S.sort;
    ['fAuth', 'fTopic', 'fType', 'fStatus'].forEach(function (id) { if ($(id).selectedIndex < 0) $(id).value = ''; });
    document.querySelectorAll('#jur [data-jur]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.jur === S.f.jur)); });
    var mb = $('mineBtn'); mb.hidden = !S.entity; mb.setAttribute('aria-pressed', String(!!S.f.mine));
  }
  function refilter() { S.shown = PAGE; renderDocs(); renderNews(); }
  function wireFilters() {
    var qt;
    $('q').addEventListener('input', function () { clearTimeout(qt); var v = this.value; qt = setTimeout(function () { S.f.q = v.trim(); refilter(); }, 120); });
    [['fAuth', 'auth'], ['fTopic', 'topic'], ['fType', 'type'], ['fStatus', 'status']].forEach(function (p) {
      $(p[0]).addEventListener('change', function () { S.f[p[1]] = this.value; refilter(); });
    });
    $('sort').addEventListener('change', function () { S.sort = this.value; refilter(); });
    document.querySelectorAll('#jur [data-jur]').forEach(function (b) {
      b.addEventListener('click', function () { S.f.jur = b.dataset.jur; syncControls(); refilter(); });
    });
    $('mineBtn').addEventListener('click', function () { S.f.mine = !S.f.mine; syncControls(); refilter(); });
    $('clrBtn').addEventListener('click', function () { S.f = { q: '', jur: '', auth: '', topic: '', type: '', status: '', mine: false }; syncControls(); refilter(); $('q').focus(); });
    document.querySelectorAll('#dlWin [data-win]').forEach(function (b) {
      b.addEventListener('click', function () { S.win = b.dataset.win; renderDeadlines(); renderStats(); });
    });
    // saved views
    $('saveBtn').addEventListener('click', function () { $('saveForm').hidden = false; $('viewName').focus(); });
    $('saveCancel').addEventListener('click', function () { $('saveForm').hidden = true; $('saveBtn').focus(); });
    $('saveForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var name = $('viewName').value.trim(); if (!name) return;
      var v = ls.get(VKEY, []).filter(function (x) { return x.name !== name; });
      v.push({ name: name, f: Object.assign({}, S.f), sort: S.sort }); ls.set(VKEY, v.slice(-12));
      $('viewName').value = ''; $('saveForm').hidden = true; renderViews(); toast('View "' + name + '" saved on this device');
      var b = document.querySelector('#views [data-view="' + CSS.escape(name) + '"]'); if (b) b.focus();
    });
  }
  function renderViews() {
    var v = ls.get(VKEY, []), el = $('views');
    el.innerHTML = v.length ? '<span class="hint">Your views:</span>' + v.map(function (x) {
      return '<span class="vw"><button class="chip" type="button" data-view="' + esc(x.name) + '">' + esc(x.name) + '</button>' +
        '<button class="del" type="button" data-del="' + esc(x.name) + '" aria-label="Delete view ' + esc(x.name) + '">&times;</button></span>';
    }).join('') : '<span class="hint">Save a set of filters to reuse it.</span>';
    el.querySelectorAll('[data-view]').forEach(function (b) {
      b.addEventListener('click', function () {
        var x = ls.get(VKEY, []).filter(function (y) { return y.name === b.dataset.view; })[0]; if (!x) return;
        S.f = Object.assign({ q: '', jur: '', auth: '', topic: '', type: '', status: '', mine: false }, x.f); S.sort = x.sort || 'rank';
        if (S.f.mine && !S.entity) S.f.mine = false;
        syncControls(); refilter();
      });
    });
    el.querySelectorAll('[data-del]').forEach(function (b) {
      b.addEventListener('click', function () { ls.set(VKEY, ls.get(VKEY, []).filter(function (y) { return y.name !== b.dataset.del; })); renderViews(); $('saveBtn').focus(); });
    });
  }

  /* ── profile ("what applies to me") in a native dialog ─────────── */
  function paintWho() {
    var e = S.app && S.entity ? S.app.entities.filter(function (x) { return x.id === S.entity; })[0] : null;
    $('whoName').textContent = e ? e.label + (S.acts.length ? ' +' + S.acts.length : '') + ': change profile' : 'Set your profile';
    if (!S.entity) S.f.mine = false;
    syncControls();
  }
  function renderProfile(focusSel) {
    var b = $('profB');
    if (!S.app) { b.innerHTML = '<p class="state-msg">Applicability data is not available.</p>'; return; }
    var rows = S.entity ? S.app.regulations.map(function (r) { return { r: r, v: verdict(r) }; }).filter(function (x) { return x.v !== 'na'; })
      .sort(function (x, y) { return (x.v === 'direct' ? 0 : 1) - (y.v === 'direct' ? 0 : 1) || x.r.name.localeCompare(y.r.name); }) : [];
    b.innerHTML = '<p class="hint">Stored on this device only. It adds a "For my firm" filter to the documents.</p>' +
      '<h3>I am a</h3><div class="ents">' + S.app.entities.map(function (e) {
        return '<button class="ent" type="button" data-e="' + esc(e.id) + '" aria-pressed="' + (S.entity === e.id) + '"><b>' + esc(e.label) + '</b><span>' + esc(e.desc) + '</span></button>';
      }).join('') + '</div>' +
      '<h3>And I also do</h3><div class="chips">' + S.app.activities.map(function (a) {
        return '<button class="chip" type="button" data-a="' + esc(a.id) + '" aria-pressed="' + (S.acts.indexOf(a.id) >= 0) + '">' + esc(a.label) + '</button>';
      }).join('') + '</div>' +
      (S.entity ? '<h3>Your perimeter</h3><ul class="rr-rows perim">' + rows.map(function (x) {
        var note = (x.r.notes || {})[S.entity];
        return '<li><div><b>' + esc(x.r.name) + '</b><small>' + esc(x.r.why) + (note ? ' ' + esc(note) : '') + (x.r.applies_from ? ' Applies from ' + fmt(x.r.applies_from) + '.' : '') + '</small></div>' +
          '<span class="pill ' + (x.v === 'direct' ? 'live' : 'review') + '">' + (x.v === 'conditional' ? 'Conditional' : x.r.instrument === 'Directive' ? 'Applies, check transposition' : 'Applies directly') + '</span></li>';
      }).join('') + '</ul><p class="hint" style="margin-top:var(--rr-3)">' + esc((S.app._meta || {}).disclaimer || '') + '</p>' : '');
    b.querySelectorAll('[data-e]').forEach(function (x) {
      x.addEventListener('click', function () { S.entity = S.entity === x.dataset.e ? '' : x.dataset.e; saveP(); renderProfile('[data-e="' + x.dataset.e + '"]'); });
    });
    b.querySelectorAll('[data-a]').forEach(function (x) {
      x.addEventListener('click', function () { var i = S.acts.indexOf(x.dataset.a); if (i >= 0) S.acts.splice(i, 1); else S.acts.push(x.dataset.a); saveP(); renderProfile('[data-a="' + x.dataset.a + '"]'); });
    });
    if (focusSel) { var n = b.querySelector(focusSel); if (n) n.focus(); }
  }
  function saveP() { ls.set(PKEY, { entity: S.entity, acts: S.acts }); paintWho(); if (S.f.mine) refilter(); }
  function openProfile() { renderProfile(); var d = $('prof'); if (!d.open) d.showModal(); }

  /* ── load ─────────────────────────────────────────────────────── */
  function get(u) { return fetch(u, { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error(u + ' ' + r.status); return r.json(); }); }
  function load() {
    return Promise.all([
      get('data/sources/feed.json').catch(function () { return null; }),
      get('data/sources/deadlines.json').catch(function () { return null; }),
      get('data/applicability.json').catch(function () { return null; }),
      get('data/sources/topic-tags.json').catch(function () { return null; })
    ]).then(function (r) {
      var feed = r[0], dl = r[1];
      S.app = r[2];
      ((r[3] && r[3].tags) || []).forEach(function (t) { S.tagLabel[t.id] = t.label; });
      S.deadlines = (dl && Array.isArray(dl.deadlines)) ? dl.deadlines : [];
      // Register-level rows ("AMLR-art19: AMLR Art. 19 applies") repeat the
      // regulation's own application date; keep the regulation row only.
      var appDates = {};
      S.deadlines.forEach(function (d) { if (d.source === 'applicability.json') appDates[d.date] = 1; });
      S.deadlines = S.deadlines.filter(function (d) { return !(d.source === 'obligations.json' && appDates[d.date]); });
      var items = D.fromFeed(feed);
      if (items.length) {
        S.source = 'engine'; S.generated = (feed._meta || {}).generated || ''; S.items = items;
        return;
      }
      // Fallback: the legacy archive, while the engine feed is empty or missing.
      return Promise.all([get('data/items.json').catch(function () { return null; }), get('data/meta.json').catch(function () { return {}; })]).then(function (x) {
        var list = Array.isArray(x[0]) ? x[0] : (x[0] && Array.isArray(x[0].items) ? x[0].items : null);
        if (!list) { S.loadFail = true; S.items = []; return; }
        S.source = 'legacy'; S.generated = (x[1] || {}).last_updated || ''; S.items = D.fromLegacy(list, TODAY);
        if (!S.deadlines.length) S.deadlines = D.fromTimeline(x[1]);
      });
    });
  }
  function enrichLater() {
    if (S.source !== 'engine') return;
    Promise.all([get('data/sources/entries.json').catch(function () { return null; }), get('data/sources/proposals.json').catch(function () { return null; })])
      .then(function (r) {
        if (!r[0] && !r[1]) return;
        D.enrich(S.items, r[0], r[1]);
        var a = document.activeElement, inDocs = a && $('docs').contains(a), idx = -1;
        if (inDocs) { var li = a.closest('.doc'); idx = [].indexOf.call($('docs').children, li); }
        renderStats(); renderDocs(inDocs && idx >= 0 ? idx : null); renderNews();
      });
  }
  function renderAll() { renderStats(); renderMeta(); renderNotice(); buildFilters(); renderViews(); renderDeadlines(); renderDocs(); renderNews(); $('rw').setAttribute('aria-busy', 'false'); }
  function boot(retry) {
    S.loadFail = false;
    return load().catch(function () { S.loadFail = true; }).then(function () {
      if (!S.loadFail) D.attachDeadlines(S.items, S.deadlines);
      paintWho(); renderAll(); enrichLater();
      if (retry && !S.loadFail) $('h-docs').focus && $('s-docs').focus();
    });
  }

  var p = ls.get(PKEY, null); if (p) { S.entity = p.entity || ''; S.acts = p.acts || []; }
  wireFilters();
  $('whoBtn').addEventListener('click', openProfile);
  $('profX').addEventListener('click', function () { $('prof').close(); });
  $('profDone').addEventListener('click', function () { $('prof').close(); });
  $('profClr').addEventListener('click', function () { S.entity = ''; S.acts = []; saveP(); renderProfile(); });
  $('prof').addEventListener('close', function () { $('whoBtn').focus(); });
  boot().then(function () { if (location.hash === '#apply') openProfile(); });
})();
