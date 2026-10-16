/* ═══════════════════════════════════════════════════════════════
   RegRadar: business-wide risk assessment (BWRA) builder.

   Device-local (localStorage 'regradar-bwra'). Reads the scenario
   library (data/bwra-scenarios.json), the demo dataset
   (data/bwra-demo.json) and the controls library + device overlay via
   ControlsData (controls-data.js, key 'regradar-controls-mine').

   Scoring (also shown in the UI, see "Method and sources"):
     inherent = likelihood x impact                      (1..25)
     control strength s = status x test result x overdue haircut
     preventive controls reduce likelihood, others reduce impact:
       E = 1 - product(1 - s)     over the linked controls of that kind
     residual likelihood = 1 + (L - 1) x (1 - cap x E_L)   (rounded)
     residual impact     = 1 + (I - 1) x (1 - cap x E_I)   (rounded)
   A documented manual override replaces E for both axes.
   Prototype, not legal advice.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var KEY = 'regradar-bwra';
  var CATS = ['customers', 'products', 'channels', 'geographies', 'transactions'];
  var CAT_NAME = { customers: 'Customers', products: 'Products and services', channels: 'Delivery channels', geographies: 'Geographies', transactions: 'Transactions' };
  var CAT_PFX = { customers: 'C', products: 'P', channels: 'D', geographies: 'G', transactions: 'T' };
  var FIRM = { pi: 'Payment institution', emi: 'E-money institution', casp: 'Crypto-asset service provider' };
  var BAND = ['Low', 'Medium', 'High', 'Very high'];
  var LEVELS = [
    { v: 0, n: 'Ineffective' }, { v: 0.25, n: 'Weak' }, { v: 0.5, n: 'Partially effective' },
    { v: 0.75, n: 'Largely effective' }, { v: 1, n: 'Effective' }
  ];
  var STATUS_F = { approved: 1, pending_review: 0.5, draft: 0.25 };
  var STATUS_N = { approved: 'Approved', pending_review: 'In review', draft: 'Draft' };
  var TEST_N = { effective: 'Test: effective', needs_improvement: 'Test: needs improvement', failed: 'Test: failed', not_tested: 'No test result' };

  var LIB = null, DEMO = null, CTLS = [], CTL = {}, CTL_OK = false, S = null;
  var today = new Date();
  var UI = { tab: 'overview', q: '', cat: '', band: '', owner: '', sort: 'res', noctl: false, cell: null, afilter: 'open',
    editId: null, actId: null, actSid: null, rsrc: 'current', libSel: null, libFirm: 'emi', ctlQ: '' };
  var memOnly = false;

  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function uid(p) { return p + Math.random().toString(36).slice(2, 9); }
  function iso(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function todayIso() { return iso(today); }
  function fmt(s) { if (!s) return 'not set'; var d = new Date(s + 'T12:00:00'); return isNaN(d) ? s : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }
  function days(s) { if (!s) return null; return Math.round((new Date(s + 'T12:00:00') - new Date(todayIso() + 'T12:00:00')) / 864e5); }
  function addMonths(s, n) { var d = new Date(s + 'T12:00:00'); d.setMonth(d.getMonth() + n); return iso(d); }
  function r1(x) { return (Math.round(x * 10) / 10).toFixed(1); }
  function toast(m) { var t = $('toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove('on'); }, 2600); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  /* ---------- state ---------- */
  function blank() {
    return { v: 1, demo: false, firm: { name: '', type: 'emi' },
      scales: { likelihood: clone(LIB.defaults.likelihood), impact: clone(LIB.defaults.impact), bands: LIB.defaults.bands.slice() },
      params: clone(LIB.defaults.params), scenarios: [], actions: [],
      refresh: { months: 12, due: '' },
      signoff: { label: 'Business-wide risk assessment', preparedBy: '', preparedOn: '', reviewedBy: '', reviewedOn: '', approvedBy: '', approvedOn: '', communicated: false, ref: '' },
      snapshots: [], baseline: null };
  }
  function libScenario(id) { return LIB.scenarios.filter(function (s) { return s.id === id; })[0]; }
  function nextCode(cat, list) {
    var n = 0;
    (list || S.scenarios).forEach(function (s) { if (s.cat === cat) { var k = parseInt(String(s.code).slice(1), 10); if (k > n) n = k; } });
    return CAT_PFX[cat] + (n + 1);
  }
  function fromLib(ls, firm, list) {
    var d = ls.firms[firm] || ls.firms.emi || ls.firms.pi || ls.firms.casp;
    return { id: uid('sc-'), code: nextCode(ls.cat, list), cat: ls.cat, lib: ls.id, title: ls.title, desc: ls.desc, L: d[0], I: d[1],
      controls: [], override: null, owner: '', notes: '', ref: ls.ref || '' };
  }
  function buildDemo() {
    var s = blank();
    s.demo = true; s.firm = clone(DEMO.firm);
    LIB.scenarios.forEach(function (ls) {
      if (!ls.firms[s.firm.type]) return;
      var sc = fromLib(ls, s.firm.type, s.scenarios);
      sc.id = 'sc-' + ls.id; // stable ids for the demo
      sc.controls = (DEMO.links[ls.id] || []).slice();
      sc.owner = DEMO.owners[ls.id] || '';
      if (DEMO.overrides[ls.id]) sc.override = { value: DEMO.overrides[ls.id].value, rationale: DEMO.overrides[ls.id].rationale };
      s.scenarios.push(sc);
    });
    s.actions = DEMO.actions.map(function (a) { return { id: uid('ac-'), sid: 'sc-' + a.sid, title: a.title, owner: a.owner, due: a.due, status: a.status }; });
    s.refresh = clone(DEMO.refresh); s.signoff = clone(DEMO.signoff);
    s.snapshots = DEMO.snapshots.map(function (sn) {
      var rows = [];
      Object.keys(sn.rows).forEach(function (k) {
        var ls = libScenario(k), cur = s.scenarios.filter(function (x) { return x.id === 'sc-' + k; })[0];
        var a = sn.rows[k];
        var inh = a[0] * a[1], res = a[2] * a[3];
        rows.push({ sid: 'sc-' + k, code: cur ? cur.code : '', cat: ls.cat, title: ls.title, L: a[0], I: a[1], inh: inh, ib: bandOf(inh, s.scales.bands),
          E: 0, mode: 'derived', elab: 'Not recorded', rL: a[2], rI: a[3], res: res, rb: bandOf(res, s.scales.bands), owner: (cur && cur.owner) || '', nctl: 0 });
      });
      var o = clone(sn); delete o.rows;
      return Object.assign(o, { id: uid('sn-'), firmName: s.firm.name, firmType: s.firm.type, demo: true, communicated: true, label: sn.label, rows: rows, actions: [],
        scales: { likelihood: s.scales.likelihood.map(function (x) { return x.n; }), impact: s.scales.impact.map(function (x) { return x.n; }), bands: s.scales.bands.slice() } });
    });
    return s;
  }
  function normalise(x) {
    var b = blank();
    var s = Object.assign(b, x || {});
    s.scales = Object.assign(b.scales, s.scales || {});
    s.params = Object.assign(b.params, s.params || {});
    s.firm = Object.assign(b.firm, s.firm || {});
    s.refresh = Object.assign(b.refresh, s.refresh || {});
    s.signoff = Object.assign(b.signoff, s.signoff || {});
    ['scenarios', 'actions', 'snapshots'].forEach(function (k) { if (!Array.isArray(s[k])) s[k] = []; });
    s.scenarios.forEach(function (sc) { sc.controls = sc.controls || []; sc.L = clamp(sc.L); sc.I = clamp(sc.I); });
    return s;
  }
  function clamp(n) { n = parseInt(n, 10); return n >= 1 && n <= 5 ? n : 3; }
  function load() {
    try { var raw = localStorage.getItem(KEY); if (raw) return normalise(JSON.parse(raw)); } catch (e) { memOnly = true; }
    return null;
  }
  function save() {
    S.saved = new Date().toISOString();
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { if (!memOnly) { memOnly = true; toast('Could not save on this device. Download a backup to keep your work.'); } }
  }

  /* ---------- engine ---------- */
  function bandOf(score, th) { th = th || S.scales.bands; return score <= th[0] ? 0 : score <= th[1] ? 1 : score <= th[2] ? 2 : 3; }
  function strength(c) {
    var P = S.params;
    var sf = STATUS_F[c.status]; if (sf == null) sf = 0.25;
    var tf = c.effectiveness === 'effective' ? 1 : c.effectiveness === 'needs_improvement' ? 0.5 : c.effectiveness === 'failed' ? 0 : P.untested;
    var od = ControlsData.isOverdue(c, today);
    return { s: sf * tf * (od ? P.overdue : 1), sf: sf, tf: tf, od: od };
  }
  function comb(list) { return 1 - list.reduce(function (p, x) { return p * (1 - x.st.s); }, 1); }
  function effLabel(E) { return E >= 0.9 ? 'Effective' : E >= 0.65 ? 'Largely effective' : E >= 0.4 ? 'Partially effective' : E >= 0.15 ? 'Weak' : 'Ineffective'; }
  function evaluate(sc) {
    var pre = [], oth = [], all = [], missing = [];
    sc.controls.forEach(function (id) {
      var c = CTL[id];
      if (!c) { missing.push(id); return; }
      var it = { c: c, st: strength(c) };
      all.push(it); (c.type === 'Preventive' ? pre : oth).push(it);
    });
    var eL = comb(pre), eI = comb(oth), eAll = comb(all);
    var mode = all.length ? 'derived' : 'none';
    if (sc.override) { eL = eI = eAll = sc.override.value; mode = 'override'; }
    var cap = S.params.cap;
    var rLraw = 1 + (sc.L - 1) * (1 - cap * eL), rIraw = 1 + (sc.I - 1) * (1 - cap * eI);
    var rL = Math.max(1, Math.round(rLraw + 1e-9)), rI = Math.max(1, Math.round(rIraw + 1e-9));
    var inh = sc.L * sc.I, res = rL * rI;
    return { pre: pre, oth: oth, all: all, missing: missing, eL: eL, eI: eI, E: eAll, mode: mode, rLraw: rLraw, rIraw: rIraw,
      rL: rL, rI: rI, inh: inh, res: res, ib: bandOf(inh), rb: bandOf(res) };
  }
  function openActions(sid) { return S.actions.filter(function (a) { return a.sid === sid && a.status !== 'done'; }); }
  function toRow(sc, ev) {
    return { sid: sc.id, code: sc.code, cat: sc.cat, title: sc.title, L: sc.L, I: sc.I, inh: ev.inh, ib: ev.ib, E: ev.E, mode: ev.mode,
      elab: ev.mode === 'none' ? 'No control linked' : effLabel(ev.E), rL: ev.rL, rI: ev.rI, res: ev.res, rb: ev.rb, owner: sc.owner || '',
      nctl: sc.controls.length, ctlNames: ev.all.map(function (x) { return x.c.name; }), rationale: sc.override ? sc.override.rationale : '',
      overrideNoRat: !!(sc.override && !String(sc.override.rationale || '').trim()), desc: sc.desc, ref: sc.ref || '' };
  }
  function currentRows() { return S.scenarios.map(function (sc) { return toRow(sc, evaluate(sc)); }); }
  function stats(rows) {
    var n = rows.length, o = { n: n, avgInh: 0, avgRes: 0, rb: [0, 0, 0, 0], ib: [0, 0, 0, 0], uncovered: 0, cat: {} };
    CATS.forEach(function (c) { o.cat[c] = { n: 0, inh: 0, res: 0, max: 0, hi: 0 }; });
    rows.forEach(function (r) {
      o.avgInh += r.inh; o.avgRes += r.res; o.rb[r.rb]++; o.ib[r.ib]++;
      if (r.mode === 'none') o.uncovered++;
      var c = o.cat[r.cat] || (o.cat[r.cat] = { n: 0, inh: 0, res: 0, max: 0, hi: 0 });
      c.n++; c.inh += r.inh; c.res += r.res; if (r.res > c.max) c.max = r.res; if (r.rb >= 2) c.hi++;
    });
    if (n) { o.avgInh /= n; o.avgRes /= n; }
    Object.keys(o.cat).forEach(function (k) { var c = o.cat[k]; if (c.n) { c.avgInh = c.inh / c.n; c.avgRes = c.res / c.n; } else { c.avgInh = 0; c.avgRes = 0; } });
    return o;
  }
  function baselineSnap() {
    if (S.baseline) { var b = S.snapshots.filter(function (s) { return s.id === S.baseline; })[0]; if (b) return b; }
    return S.snapshots.length ? S.snapshots[S.snapshots.length - 1] : null;
  }
  function baseMap(snap) { var m = {}; if (snap) snap.rows.forEach(function (r) { m[r.sid] = r; }); return m; }

  /* ---------- band / chip markup ---------- */
  var PAT = ['', 'p1', 'p2', 'p3'];
  function bandChip(score, b) { return '<span class="band b' + b + ' ' + PAT[b] + '"><span class="sc">' + score + '</span> ' + BAND[b] + '</span>'; }
  function changeHtml(r, bm) {
    if (!bm) return '<span class="pill-eq">No previous version</span>';
    var p = bm[r.sid];
    if (!p) return '<span class="pill-eq">New risk</span>';
    var d = r.res - p.res;
    if (d > 0) return '<span class="pill-up"><span aria-hidden="true">&#9650;</span> ' + d + ' higher</span>';
    if (d < 0) return '<span class="pill-down"><span aria-hidden="true">&#9660;</span> ' + (-d) + ' lower</span>';
    return '<span class="pill-eq">No change</span>';
  }

  /* ---------- heat map ---------- */
  function heat(rows, kind, interactive, full) {
    var Lx = kind === 'inh' ? 'L' : 'rL', Ix = kind === 'inh' ? 'I' : 'rI';
    var map = {};
    rows.forEach(function (r) { var k = r[Lx] + '-' + r[Ix]; (map[k] = map[k] || []).push(r); });
    var LL = (S.scales.likelihood || []), II = (S.scales.impact || []);
    function lname(a, i) { return a[i - 1] ? (a[i - 1].n || a[i - 1]) : ''; }
    var h = '<div class="hmwrap"><div class="hm-y">Impact</div><table class="hm"><caption class="sr" style="position:absolute;left:-9999px">' + (kind === 'inh' ? 'Inherent' : 'Residual') + ' risk heat map: impact by likelihood</caption><tbody>';
    for (var i = 5; i >= 1; i--) {
      h += '<tr><th scope="row" class="rowh">' + i + '<span class="nm"> ' + esc(lname(II, i)) + '</span></th>';
      for (var l = 1; l <= 5; l++) {
        var sc = l * i, b = bandOf(sc), list = map[l + '-' + i] || [];
        var cls = 'hm-cell b' + b + ' ' + PAT[b];
        var inner = '<span class="z">' + sc + ' ' + BAND[b] + '</span>';
        if (list.length) {
          inner += '<span class="n">' + list.length + '</span>';
          var codes = list.slice(0, full ? 8 : 3).map(function (r) { return r.code; }).join(' ') + (list.length > (full ? 8 : 3) ? ' +' + (list.length - (full ? 8 : 3)) : '');
          inner += '<span class="cd">' + esc(codes) + '</span>';
        }
        var sel = UI.cell && UI.cell.kind === kind && UI.cell.l === l && UI.cell.i === i;
        if (interactive && list.length) {
          var lab = 'Likelihood ' + l + ' ' + lname(LL, l) + ', impact ' + i + ' ' + lname(II, i) + ': score ' + sc + ', ' + BAND[b] + '. ' + list.length + (list.length === 1 ? ' risk' : ' risks') + ': ' + list.map(function (r) { return r.code; }).join(', ') + '. Show in the register.';
          h += '<td><button type="button" class="cell ' + cls + (sel ? ' sel' : '') + '" data-act="cell" data-kind="' + kind + '" data-l="' + l + '" data-i="' + i + '" aria-label="' + esc(lab) + '">' + inner + '</button></td>';
        } else {
          h += '<td><div class="cell ' + cls + '">' + inner + '</div></td>';
        }
      }
      h += '</tr>';
    }
    h += '<tr><td class="blank"></td>';
    for (var x = 1; x <= 5; x++) h += '<th scope="col">' + x + '<span class="nm"> ' + esc(lname(LL, x)) + '</span></th>';
    h += '</tr></tbody></table><div class="hm-x">Likelihood</div></div>';
    h += '<p class="hm-key"><b>Likelihood:</b> ' + [1,2,3,4,5].map(function (n) { return n + ' ' + esc(lname(LL, n)); }).join(', ') + '. <b>Impact:</b> ' + [1,2,3,4,5].map(function (n) { return n + ' ' + esc(lname(II, n)); }).join(', ') + '.</p>';
    return h;
  }
  function legendHtml() {
    var th = S.scales.bands, rng = ['1 to ' + th[0], (th[0] + 1) + ' to ' + th[1], (th[1] + 1) + ' to ' + th[2], (th[2] + 1) + ' to 25'];
    return [0, 1, 2, 3].map(function (b) { return '<span><span class="swatch b' + b + ' ' + PAT[b] + '" aria-hidden="true"></span>' + BAND[b] + ' (score ' + rng[b] + ')</span>'; }).join('') +
      '<span>Number in a cell = how many risks sit there. Colour, pattern and the words all carry the rating.</span>';
  }

  /* ---------- overview ---------- */
  function renderBanners() {
    var h = '';
    if (S.demo) h += '<div class="banner demo"><span><b>Demo data.</b> This is a fictional assessment for CF Bank (a made-up firm), with invented scores, owners, actions and history, linked to the 8 sample controls. Edit anything to try the tool.</span><button class="btn sm" type="button" data-act="startblank">Start my own assessment</button></div>';
    var d = days(S.refresh.due);
    if (d != null && d < 0) h += '<div class="banner bad"><span><b>Annual refresh overdue by ' + (-d) + (d === -1 ? ' day' : ' days') + '.</b> The assessment was due for review on ' + fmt(S.refresh.due) + '. Review it, then save a new version.</span><button class="btn sm" type="button" data-tab-go="versions">Open versions</button></div>';
    else if (d != null && d <= 60) h += '<div class="banner warn"><span><b>Refresh due in ' + d + (d === 1 ? ' day' : ' days') + '</b> (' + fmt(S.refresh.due) + ').</span><button class="btn sm" type="button" data-tab-go="versions">Open versions</button></div>';
    if (!CTL_OK) h += '<div class="banner warn"><span><b>Controls library not available.</b> Linking controls and derived effectiveness are off until it loads; manual overrides still work.</span></div>';
    $('banners').innerHTML = h;
  }
  function renderKpis(rows, st) {
    var d = days(S.refresh.due), refreshTxt, cls = '';
    if (d == null) refreshTxt = ['not set', 'Set a date under Versions'];
    else if (d < 0) { refreshTxt = [(-d) + ' days late', 'Due ' + fmt(S.refresh.due)]; cls = 'warn'; }
    else { refreshTxt = [d + ' days', 'Due ' + fmt(S.refresh.due)]; if (d <= 60) cls = 'amber'; }
    var hi = st.rb[2] + st.rb[3], hiInh = st.ib[2] + st.ib[3];
    var covered = st.n - st.uncovered;
    $('kpis').innerHTML =
      '<div class="kpi"><div class="n mono">' + st.n + '</div><div class="l">Risks assessed</div><div class="s">in ' + CATS.filter(function (c) { return st.cat[c].n; }).length + ' of 5 categories</div></div>' +
      '<div class="kpi"><div class="n mono">' + (st.n ? r1(st.avgInh) + ' &rarr; ' + r1(st.avgRes) : '-') + '</div><div class="l">Average score, inherent to residual</div><div class="s">of 25</div></div>' +
      '<div class="kpi ' + (hi ? 'warn' : '') + '"><div class="n mono" style="color:' + (hi ? 'var(--crit)' : 'var(--ok)') + '">' + hi + '</div><div class="l">High or very high residual</div><div class="s">' + hiInh + ' before controls</div></div>' +
      '<div class="kpi ' + (st.uncovered ? 'amber' : '') + '"><div class="n mono">' + covered + ' / ' + st.n + '</div><div class="l">Risks with a linked control</div><div class="s">' + st.uncovered + ' without one</div></div>' +
      '<div class="kpi ' + cls + '"><div class="n mono">' + refreshTxt[0] + '</div><div class="l">Annual refresh</div><div class="s">' + refreshTxt[1] + '</div></div>';
  }
  function categorySummary(st, bm, rows) {
    var h = '<ul class="cats">';
    var prevStats = null;
    var snap = baselineSnap();
    if (snap) prevStats = stats(snap.rows);
    CATS.forEach(function (c) {
      var x = st.cat[c];
      var trend = '<span class="pill-eq">No previous version</span>';
      if (prevStats && prevStats.cat[c].n && x.n) {
        var d = x.avgRes - prevStats.cat[c].avgRes;
        trend = Math.abs(d) < 0.05 ? '<span class="pill-eq">No change</span>' : d > 0 ? '<span class="pill-up"><span aria-hidden="true">&#9650;</span> ' + r1(d) + ' higher</span>' : '<span class="pill-down"><span aria-hidden="true">&#9660;</span> ' + r1(-d) + ' lower</span>';
      }
      h += '<li><div class="nm">' + CAT_NAME[c] + '<small>' + x.n + (x.n === 1 ? ' risk' : ' risks') + '</small></div>' +
        '<div class="st">Inherent avg<b>' + (x.n ? r1(x.avgInh) : '-') + '</b><div class="bar" aria-hidden="true"><i style="width:' + Math.round(x.avgInh / 25 * 100) + '%"></i></div></div>' +
        '<div class="st">Residual avg<b>' + (x.n ? r1(x.avgRes) : '-') + '</b><div class="bar res" aria-hidden="true"><i style="width:' + Math.round(x.avgRes / 25 * 100) + '%"></i></div></div>' +
        '<div class="st">High+ residual<b>' + x.hi + '</b>' + trend + '</div></li>';
    });
    return h + '</ul>';
  }
  function distBar(s, label) {
    var tot = s.rb.reduce(function (a, b) { return a + b; }, 0) || 1;
    var seg = s.rb.map(function (n, b) { return n ? '<span class="b' + b + ' ' + PAT[b] + '" style="flex:' + n + ' 1 0" title="' + BAND[b] + ': ' + n + '">' + n + '</span>' : ''; }).join('');
    var txt = BAND.map(function (nm, b) { return nm + ' ' + s.rb[b]; }).join(', ');
    return '<div class="small muted" style="margin-top:8px">' + esc(label) + '</div><div class="dist" role="img" aria-label="' + esc(label + ': ' + txt) + '">' + seg + '</div>';
  }
  function trendHtml(rows, st) {
    var snaps = S.snapshots;
    if (!snaps.length) return '<p class="sub">No saved version yet. Save a version under "Versions and sign-off" and this panel compares the current assessment with it: scores, ratings, which risks moved and by how much.</p>';
    var snap = baselineSnap(), ps = stats(snap.rows), bm = baseMap(snap);
    var opts = snaps.slice().reverse().map(function (s) { return '<option value="' + s.id + '"' + (s.id === snap.id ? ' selected' : '') + '>' + esc(s.label) + ' (' + fmt(s.date) + ')</option>'; }).join('');
    function row(label, a, b, dec, lowerBetter) {
      var d = b - a, t;
      if (Math.abs(d) < 0.05) t = '<span class="pill-eq">No change</span>';
      else { var up = d > 0; var bad = lowerBetter ? up : !up; t = '<span class="' + (lowerBetter === null ? 'pill-eq' : (bad ? 'pill-up' : 'pill-down')) + '"><span aria-hidden="true">' + (up ? '&#9650;' : '&#9660;') + '</span> ' + (up ? '+' : '-') + (dec ? r1(Math.abs(d)) : Math.abs(d)) + '</span>'; }
      return '<tr><th scope="row">' + label + '</th><td class="num">' + (dec ? r1(a) : a) + '</td><td class="num">' + (dec ? r1(b) : b) + '</td><td>' + t + '</td></tr>';
    }
    var movers = rows.filter(function (r) { return bm[r.sid]; }).map(function (r) { return { r: r, d: r.res - bm[r.sid].res }; }).filter(function (m) { return m.d !== 0; });
    var up = movers.filter(function (m) { return m.d > 0; }).sort(function (a, b) { return b.d - a.d; }).slice(0, 3);
    var dn = movers.filter(function (m) { return m.d < 0; }).sort(function (a, b) { return a.d - b.d; }).slice(0, 3);
    var added = rows.filter(function (r) { return !bm[r.sid]; }).length;
    function mv(list, none) { return list.length ? '<ul class="list-plain">' + list.map(function (m) { return '<li><button type="button" class="lnk" data-act="open" data-id="' + m.r.sid + '">' + esc(m.r.code + ' ' + m.r.title) + '</button><span class="mono ' + (m.d > 0 ? 'pill-up' : 'pill-down') + '">' + (m.d > 0 ? '+' : '') + m.d + '</span></li>'; }).join('') + '</ul>' : '<p class="small muted">' + none + '</p>'; }
    // sparkline of average residual over versions then now
    var pts = snaps.map(function (s) { return { l: fmt(s.date).replace(/^\d+ /, ''), v: stats(s.rows).avgRes }; }); pts.push({ l: 'Now', v: st.avgRes });
    var W = 320, H = 96, pad = 26, mx = Math.max.apply(null, pts.map(function (p) { return p.v; })) + 1, mn = Math.max(0, Math.min.apply(null, pts.map(function (p) { return p.v; })) - 1);
    var path = '', dots = '';
    pts.forEach(function (p, i) {
      var x = pad + (pts.length === 1 ? (W - 2 * pad) / 2 : i * (W - 2 * pad) / (pts.length - 1)), y = 14 + (H - 44) * (1 - (p.v - mn) / ((mx - mn) || 1));
      path += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1) + ' ';
      dots += '<circle class="dot" cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="4"/><text x="' + x.toFixed(1) + '" y="' + (y - 8).toFixed(1) + '" text-anchor="middle">' + r1(p.v) + '</text><text x="' + x.toFixed(1) + '" y="' + (H - 6) + '" text-anchor="middle">' + esc(p.l) + '</text>';
    });
    var spark = '<svg class="spark" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Average residual score by version: ' + pts.map(function (p) { return p.l + ' ' + r1(p.v); }).join(', ') + '"><line class="ax" x1="' + pad + '" x2="' + (W - pad) + '" y1="' + (H - 20) + '" y2="' + (H - 20) + '"/><path class="ln" d="' + path + '"/>' + dots + '</svg>';
    return '<div class="field" style="margin-bottom:8px"><label for="baseSel">Compare with</label><select class="sel" id="baseSel">' + opts + '</select></div>' +
      '<table class="mini"><thead><tr><th scope="col">Measure</th><th scope="col" class="num">Then</th><th scope="col" class="num">Now</th><th scope="col">Change</th></tr></thead><tbody>' +
      row('Risks assessed', ps.n, st.n, false, null) + row('Average inherent score', ps.avgInh, st.avgInh, true, true) + row('Average residual score', ps.avgRes, st.avgRes, true, true) +
      row('High or very high residual', ps.rb[2] + ps.rb[3], st.rb[2] + st.rb[3], false, true) + '</tbody></table>' +
      distBar(ps, 'Residual ratings then (' + snap.label + ')') + distBar(st, 'Residual ratings now') +
      '<h3>Moved up</h3>' + mv(up, 'No risk has a higher residual score than in the compared version.') +
      '<h3>Moved down</h3>' + mv(dn, 'No risk has a lower residual score than in the compared version.') +
      (added ? '<p class="small muted" style="margin-top:8px">' + added + (added === 1 ? ' risk is' : ' risks are') + ' new since that version.</p>' : '') + spark;
  }
  function weakControls() {
    var used = {};
    S.scenarios.forEach(function (sc) { sc.controls.forEach(function (id) { used[id] = (used[id] || 0) + 1; }); });
    var out = [];
    Object.keys(used).forEach(function (id) {
      var c = CTL[id]; if (!c) { out.push({ id: id, name: id + ' (not found)', why: 'control no longer exists', n: used[id], s: 0 }); return; }
      var st = strength(c), why = [];
      if (c.status !== 'approved') why.push(STATUS_N[c.status] ? STATUS_N[c.status].toLowerCase() : c.status);
      if (c.effectiveness === 'failed') why.push('last test failed'); else if (c.effectiveness === 'needs_improvement') why.push('last test needs improvement'); else if (c.effectiveness !== 'effective') why.push('no test result');
      if (st.od) why.push('retest overdue');
      if (st.s < 0.5 && why.length) out.push({ id: id, name: c.name, why: why.join(', '), n: used[id], s: st.s });
    });
    return out.sort(function (a, b) { return b.n - a.n; });
  }
  function attention(rows) {
    var needAct = rows.filter(function (r) { return r.rb >= 2 && !openActions(r.sid).length; }).sort(function (a, b) { return b.res - a.res; });
    var noctl = rows.filter(function (r) { return r.mode === 'none'; }).sort(function (a, b) { return b.inh - a.inh; });
    var wk = weakControls();
    function lst(list, f, none) { return list.length ? '<ul class="list-plain">' + list.slice(0, 7).map(f).join('') + '</ul>' + (list.length > 7 ? '<p class="small muted">and ' + (list.length - 7) + ' more in the register</p>' : '') : '<p class="small muted">' + none + '</p>'; }
    var open = function (r, extra) { return '<li><button type="button" class="lnk" data-act="open" data-id="' + r.sid + '">' + esc(r.code + ' ' + r.title) + '</button>' + extra + '</li>'; };
    return '<div><h3>High residual, no treatment action</h3>' + lst(needAct, function (r) { return open(r, bandChip(r.res, r.rb)); }, 'Every high or very high residual risk has an open action.') + '</div>' +
      '<div><h3>No control linked</h3>' + lst(noctl, function (r) { return open(r, bandChip(r.inh, r.ib)); }, 'Every risk has at least one linked control or a documented override.') + '</div>' +
      '<div><h3>Weak controls feeding the scores</h3>' + lst(wk, function (w) { return '<li><span><b>' + esc(w.name) + '</b><br><span class="small muted">' + esc(w.why) + '</span></span><span class="chip">' + w.n + (w.n === 1 ? ' risk' : ' risks') + '</span></li>'; }, 'No linked control is in review, failed, untested or overdue.') + '</div>';
  }
  function renderOverview(rows, st) {
    renderKpis(rows, st);
    $('hmInh').innerHTML = heat(rows, 'inh', true);
    $('hmRes').innerHTML = heat(rows, 'res', true);
    $('legend').innerHTML = legendHtml();
    $('catSum').innerHTML = categorySummary(st, null, rows);
    $('trend').innerHTML = trendHtml(rows, st);
    $('attention').innerHTML = attention(rows);
  }

  /* ---------- register ---------- */
  function ownersList() {
    var m = {};
    S.scenarios.forEach(function (s) { if (s.owner) m[s.owner] = 1; });
    S.actions.forEach(function (a) { if (a.owner) m[a.owner] = 1; });
    CTLS.forEach(function (c) { if (c.owner && c.owner !== 'Unassigned') m[c.owner] = 1; });
    return Object.keys(m).sort();
  }
  function setOpts(id, html) { var el = $(id); if (el._h !== html) { el.innerHTML = html; el._h = html; } }
  function fillFilters() {
    setOpts('fcat', '<option value="">All categories</option>' + CATS.map(function (c) { return '<option value="' + c + '">' + CAT_NAME[c] + '</option>'; }).join(''));
    setOpts('fband', '<option value="">All ratings</option>' + BAND.map(function (b, i) { return '<option value="' + i + '">' + b + '</option>'; }).join(''));
    var ow = {}; S.scenarios.forEach(function (s) { ow[s.owner || ''] = 1; });
    setOpts('fowner', '<option value="">All owners</option>' + Object.keys(ow).sort().map(function (o) { return '<option value="' + esc(o) + '">' + (o ? esc(o) : 'No owner') + '</option>'; }).join(''));
    $('fcat').value = UI.cat; $('fband').value = UI.band; $('fowner').value = UI.owner; $('fsort').value = UI.sort;
    if ($('fq').value !== UI.q) $('fq').value = UI.q;
    $('fnoctl').checked = UI.noctl;
    setOpts('ownerList', ownersList().map(function (o) { return '<option value="' + esc(o) + '">'; }).join(''));
  }
  function filteredRows(rows) {
    var q = UI.q.trim().toLowerCase(), bm = baseMap(baselineSnap());
    var list = rows.filter(function (r) {
      if (UI.cat && r.cat !== UI.cat) return false;
      if (UI.band !== '' && r.rb !== parseInt(UI.band, 10)) return false;
      if (UI.owner !== '' && (r.owner || '') !== UI.owner) return false;
      if (UI.noctl && r.mode !== 'none') return false;
      if (UI.cell) { var Lx = UI.cell.kind === 'inh' ? r.L : r.rL, Ix = UI.cell.kind === 'inh' ? r.I : r.rI; if (Lx !== UI.cell.l || Ix !== UI.cell.i) return false; }
      if (q && (r.title + ' ' + r.code + ' ' + r.owner + ' ' + (r.ctlNames || []).join(' ') + ' ' + CAT_NAME[r.cat]).toLowerCase().indexOf(q) === -1) return false;
      return true;
    });
    list.sort(function (a, b) {
      if (UI.sort === 'inh') return b.inh - a.inh || b.res - a.res;
      if (UI.sort === 'chg') { var da = bm[a.sid] ? a.res - bm[a.sid].res : -99, db = bm[b.sid] ? b.res - bm[b.sid].res : -99; return db - da || b.res - a.res; }
      if (UI.sort === 'cat') return CATS.indexOf(a.cat) - CATS.indexOf(b.cat) || b.res - a.res;
      if (UI.sort === 'owner') return (a.owner || '~').localeCompare(b.owner || '~') || b.res - a.res;
      return b.res - a.res || b.inh - a.inh;
    });
    return list;
  }
  function flagsFor(r) {
    var f = [];
    if (r.mode === 'none') f.push('<span class="chip imp">No control linked</span>');
    if (r.mode === 'override') f.push('<span class="chip">Manual override</span>');
    if (r.overrideNoRat) f.push('<span class="chip crit">Rationale missing</span>');
    if (r.rb >= 2 && !openActions(r.sid).length) f.push('<span class="chip crit">No action</span>');
    return f.join('');
  }
  function renderRegister(rows) {
    fillFilters();
    var all = rows, list = filteredRows(rows), bm = baseMap(baselineSnap());
    var rankMap = {}; rows.slice().sort(function (a, b) { return b.res - a.res || b.inh - a.inh; }).forEach(function (r, i) { rankMap[r.sid] = i + 1; });
    var cell = UI.cell ? ' <button type="button" class="chip" data-act="clearcell" aria-label="Remove heat map cell filter">' + (UI.cell.kind === 'inh' ? 'Inherent' : 'Residual') + ' cell L' + UI.cell.l + ' x I' + UI.cell.i + ' &times;</button>' : '';
    $('regCount').innerHTML = 'Showing ' + list.length + ' of ' + all.length + ' risks, ranked by residual score.' + cell;
    $('regBody').innerHTML = list.map(function (r) {
      var oa = openActions(r.sid).length;
      return '<tr><td class="rk" data-l="Rank">' + rankMap[r.sid] + '</td>' +
        '<td data-l="Risk"><button type="button" class="lnk" data-act="open" data-id="' + r.sid + '">' + esc(r.code + ' ' + r.title) + '</button><div class="sub">' + CAT_NAME[r.cat] + '</div><div class="flags">' + flagsFor(r) + '</div></td>' +
        '<td data-l="Inherent">' + bandChip(r.inh, r.ib) + '<div class="sub mono">L' + r.L + ' x I' + r.I + '</div></td>' +
        '<td data-l="Controls">' + esc(r.elab) + '<div class="sub">' + r.nctl + (r.nctl === 1 ? ' control' : ' controls') + '</div></td>' +
        '<td data-l="Residual">' + bandChip(r.res, r.rb) + '<div class="sub mono">L' + r.rL + ' x I' + r.rI + '</div></td>' +
        '<td data-l="Since previous">' + changeHtml(r, S.snapshots.length ? bm : null) + '</td>' +
        '<td data-l="Owner">' + (r.owner ? esc(r.owner) : '<span class="muted">No owner</span>') + '</td>' +
        '<td data-l="Open actions">' + oa + '</td></tr>';
    }).join('');
    $('regEmpty').innerHTML = !all.length ? emptyState() : (!list.length ? '<div class="empty">No risk matches these filters. <button class="btn sm" type="button" data-act="clearfilters">Clear filters</button></div>' : '');
    $('cntReg').textContent = all.length;
  }
  function emptyState() {
    return '<div class="empty"><p><b>No risks yet.</b> Start from the scenario library for your firm type, or add your own.</p><div class="rowtools" style="justify-content:center;margin-top:10px"><button class="btn pri" type="button" data-act="library">Open the scenario library</button><button class="btn" type="button" data-act="add">Add a risk</button><button class="btn" type="button" data-act="loaddemo">Load the CF Bank demo</button></div></div>';
  }

  /* ---------- actions tab ---------- */
  function scById(id) { return S.scenarios.filter(function (s) { return s.id === id; })[0]; }
  function renderActions() {
    var f = UI.afilter, now = todayIso();
    var list = S.actions.filter(function (a) {
      var od = a.status !== 'done' && a.due && a.due < now;
      if (f === 'open') return a.status !== 'done';
      if (f === 'overdue') return od;
      if (f === 'done') return a.status === 'done';
      return true;
    }).sort(function (a, b) { return (a.due || '9999').localeCompare(b.due || '9999'); });
    $('afilter').value = f;
    $('cntAct').textContent = S.actions.filter(function (a) { return a.status !== 'done'; }).length;
    if (!list.length) { $('actList').innerHTML = '<div class="empty">' + (S.actions.length ? 'No action matches this filter.' : 'No actions yet. Add one for any risk that needs treatment: a control to build, a test to run, a decision to take.') + '</div>'; return; }
    $('actList').innerHTML = list.map(function (a) {
      var sc = scById(a.sid), od = a.status !== 'done' && a.due && a.due < now, d = days(a.due);
      var st = a.status === 'done' ? '<span class="chip ok">Done</span>' : od ? '<span class="chip crit">Overdue by ' + (-d) + (d === -1 ? ' day' : ' days') + '</span>' : a.status === 'progress' ? '<span class="chip imp">In progress</span>' : '<span class="chip">Open</span>';
      return '<div class="cardrow ' + (a.status === 'done' ? 'done' : '') + '"><div><div class="t">' + esc(a.title) + '</div><div class="sub">' +
        (sc ? '<button type="button" class="lnk" data-act="open" data-id="' + sc.id + '">' + esc(sc.code + ' ' + sc.title) + '</button>' : 'Not linked to a risk') +
        ' &middot; ' + (a.owner ? esc(a.owner) : 'No owner') + ' &middot; due ' + fmt(a.due) + '</div></div><div class="rowtools">' + st +
        (a.status !== 'done' ? '<button type="button" class="btn sm" data-act="actdone" data-id="' + a.id + '" aria-label="Mark done: ' + esc(a.title) + '">Mark done</button>' : '') +
        '<button type="button" class="btn sm" data-act="editaction" data-id="' + a.id + '" aria-label="Edit action: ' + esc(a.title) + '">Edit</button></div></div>';
    }).join('');
  }

  /* ---------- versions tab ---------- */
  function fillSignoff() {
    var so = S.signoff;
    [['so_label', 'label'], ['so_prep', 'preparedBy'], ['so_prepOn', 'preparedOn'], ['so_rev', 'reviewedBy'], ['so_revOn', 'reviewedOn'], ['so_app', 'approvedBy'], ['so_appOn', 'approvedOn'], ['so_ref', 'ref']].forEach(function (p) { $(p[0]).value = so[p[1]] || ''; });
    $('so_comm').checked = !!so.communicated; $('so_firm').value = S.firm.name || '';
    $('rf_months').value = S.refresh.months; $('rf_due').value = S.refresh.due || '';
    rfState();
  }
  function rfState() {
    var d = days(S.refresh.due), t;
    if (d == null) t = 'No refresh date set. Set one so the assessment cannot silently go stale.';
    else if (d < 0) t = 'Overdue by ' + (-d) + (d === -1 ? ' day' : ' days') + '. Review the assessment and save a new version.';
    else t = 'Next refresh in ' + d + (d === 1 ? ' day' : ' days') + ' (' + fmt(S.refresh.due) + ').';
    $('rfState').textContent = t;
  }
  function renderSnaps() {
    var snaps = S.snapshots.slice().reverse();
    if (!snaps.length) { $('snapList').innerHTML = '<div class="empty">No saved version yet. Fill in the sign-off fields above and choose "Save as a new version".</div>'; return; }
    var base = baselineSnap();
    $('snapList').innerHTML = snaps.map(function (s) {
      var st = stats(s.rows), isBase = base && base.id === s.id;
      var sign = (s.preparedBy ? 'Prepared by ' + esc(s.preparedBy) + (s.preparedOn ? ' on ' + fmt(s.preparedOn) : '') : 'Preparer not recorded') + ' &middot; ' +
        (s.reviewedBy ? 'reviewed by ' + esc(s.reviewedBy) + (s.reviewedOn ? ' on ' + fmt(s.reviewedOn) : '') : 'not reviewed') + ' &middot; ' +
        (s.approvedBy ? 'approved by ' + esc(s.approvedBy) + (s.approvedOn ? ' on ' + fmt(s.approvedOn) : '') : '<b>not approved</b>');
      return '<div class="cardrow"><div><div class="t">' + esc(s.label) + (s.demo ? ' <span class="chip">Demo</span>' : '') + (isBase ? ' <span class="chip ok">Trend baseline</span>' : '') + '</div>' +
        '<div class="sub">Saved ' + fmt(s.date) + ' &middot; ' + st.n + ' risks &middot; average residual ' + r1(st.avgRes) + ' &middot; ' + (st.rb[2] + st.rb[3]) + ' high or very high</div><div class="sub">' + sign + '</div></div>' +
        '<div class="rowtools"><button type="button" class="btn sm" data-act="viewsnap" data-id="' + s.id + '" aria-label="Open ' + esc(s.label) + ' as a report">Open as report</button>' +
        (isBase ? '' : '<button type="button" class="btn sm" data-act="setbase" data-id="' + s.id + '" aria-label="Use ' + esc(s.label) + ' as the trend baseline">Use as baseline</button>') +
        '<button type="button" class="btn sm danger" data-act="delsnap" data-id="' + s.id + '" aria-label="Delete version ' + esc(s.label) + '">Delete</button></div></div>';
    }).join('');
  }
  function saveSnapshot() {
    var rows = currentRows(), so = S.signoff, label = (so.label || '').trim() || 'Assessment ' + todayIso();
    var prev = S.snapshots.length ? S.snapshots[S.snapshots.length - 1].id : null;
    var snap = { id: uid('sn-'), label: label, date: todayIso(), preparedBy: so.preparedBy, preparedOn: so.preparedOn, reviewedBy: so.reviewedBy, reviewedOn: so.reviewedOn,
      approvedBy: so.approvedBy, approvedOn: so.approvedOn, communicated: so.communicated, ref: so.ref, firmName: S.firm.name, firmType: S.firm.type, demo: S.demo,
      rows: rows, actions: clone(S.actions), scales: { likelihood: S.scales.likelihood.map(function (x) { return x.n; }), impact: S.scales.impact.map(function (x) { return x.n; }), bands: S.scales.bands.slice() } };
    snap.rows.forEach(function (r) { delete r.desc; });
    S.snapshots.push(snap);
    if (prev && !S.baseline) S.baseline = prev;
    var msg = 'Version saved';
    if (so.approvedOn) { S.refresh.due = addMonths(so.approvedOn, S.refresh.months); msg += '. Next refresh set to ' + fmt(S.refresh.due); }
    save(); renderAll(); fillSignoff(); toast(msg);
  }

  /* ---------- report ---------- */
  function reportSource() {
    if (UI.rsrc !== 'current') {
      var sn = S.snapshots.filter(function (s) { return s.id === UI.rsrc; })[0];
      if (sn) return { snap: sn, rows: sn.rows, label: sn.label, firm: sn.firmName, type: sn.firmType, demo: !!sn.demo, so: sn, date: sn.date, actions: sn.actions || [], scales: sn.scales, status: sn.approvedOn ? 'Approved' : 'Saved version, not approved' };
      UI.rsrc = 'current';
    }
    var so = S.signoff;
    return { snap: null, rows: currentRows(), label: so.label || 'Business-wide risk assessment', firm: S.firm.name, type: S.firm.type, demo: S.demo, so: so, date: todayIso(), actions: S.actions,
      scales: { likelihood: S.scales.likelihood.map(function (x) { return x.n; }), impact: S.scales.impact.map(function (x) { return x.n; }), bands: S.scales.bands }, status: 'Working draft' };
  }
  function renderReport() {
    var sel = '<option value="current">Current working assessment</option>' + S.snapshots.slice().reverse().map(function (s) { return '<option value="' + s.id + '">' + esc(s.label) + ' (' + fmt(s.date) + ')</option>'; }).join('');
    $('rsrc').innerHTML = sel; $('rsrc').value = UI.rsrc;
    var R = reportSource(), rows = R.rows;
    if (!rows.length) { $('reportRoot').innerHTML = '<p class="empty">Nothing to report yet. Add risks first.</p>'; return; }
    var st = stats(rows);
    // baseline for report: previous snapshot before this one
    var idx = R.snap ? S.snapshots.indexOf(R.snap) : S.snapshots.length;
    var base = idx > 0 ? S.snapshots[idx - 1] : null, bm = baseMap(base), ps = base ? stats(base.rows) : null;
    var th = R.scales.bands;
    var sav = S.scales; // heat labels use current labels; for snapshots use stored names
    var keep = S.scales; S.scales = { likelihood: R.scales.likelihood.map(function (n) { return { n: n }; }), impact: R.scales.impact.map(function (n) { return { n: n }; }), bands: th };
    var h = '';
    function sumTxt() {
      var hi = st.rb[2] + st.rb[3], hiI = st.ib[2] + st.ib[3];
      var t = st.n + ' ML/TF risks were assessed across ' + CATS.filter(function (c) { return st.cat[c].n; }).length + ' categories. Before controls ' + hiI + ' are rated high or very high; after the effect of controls ' + hi + ' remain high or very high. The average score moves from ' + r1(st.avgInh) + ' (inherent) to ' + r1(st.avgRes) + ' (residual) on a scale of 25.';
      if (st.uncovered) t += ' ' + st.uncovered + (st.uncovered === 1 ? ' risk has' : ' risks have') + ' no linked control and is therefore shown with no mitigation.';
      if (ps) t += ' Compared with "' + base.label + '", the average residual score is ' + (Math.abs(st.avgRes - ps.avgRes) < 0.05 ? 'unchanged' : (st.avgRes > ps.avgRes ? 'up by ' : 'down by ') + r1(Math.abs(st.avgRes - ps.avgRes))) + ' and high or very high residual risks went from ' + (ps.rb[2] + ps.rb[3]) + ' to ' + hi + '.';
      return t;
    }
    h += (R.demo ? '<div class="demo-tag">DEMO DATA: fictional firm, invented figures</div>' : '') +
      '<h1>' + esc(R.label) + '</h1><div class="meta"><span><b>Firm:</b> ' + esc(R.firm || 'not named') + '</span><span><b>Type:</b> ' + FIRM[R.type] + '</span><span><b>Status:</b> ' + esc(R.status) + '</span><span><b>Date:</b> ' + fmt(R.date) + '</span><span><b>Next refresh:</b> ' + fmt(S.refresh.due) + '</span></div>';
    h += '<h2>1. Summary for the board</h2><p>' + esc(sumTxt()) + '</p>';
    h += '<div class="kv keep"><div><b>' + st.n + '</b><span>Risks assessed</span></div><div><b>' + r1(st.avgInh) + ' &rarr; ' + r1(st.avgRes) + '</b><span>Average score, inherent to residual</span></div><div><b>' + (st.rb[2] + st.rb[3]) + '</b><span>High or very high residual</span></div><div><b>' + (st.n - st.uncovered) + ' / ' + st.n + '</b><span>With a linked control</span></div></div>';
    h += '<h2>2. Heat maps</h2><div class="hm2 keep"><div><h3 style="font-size:14px;margin-bottom:6px">Inherent risk</h3>' + heat(rows, 'inh', false, true) + '</div><div><h3 style="font-size:14px;margin-bottom:6px">Residual risk</h3>' + heat(rows, 'res', false, true) + '</div></div><div class="legend">' + legendHtml() + '</div>';
    h += '<h2>3. By category</h2><table class="mini keep"><thead><tr><th scope="col">Category</th><th scope="col" class="num">Risks</th><th scope="col" class="num">Avg inherent</th><th scope="col" class="num">Avg residual</th><th scope="col" class="num">High or very high residual</th>' + (ps ? '<th scope="col">Residual vs "' + esc(base.label) + '"</th>' : '') + '</tr></thead><tbody>' +
      CATS.map(function (c) { var x = st.cat[c], t = ''; if (ps) { if (ps.cat[c].n && x.n) { var d = x.avgRes - ps.cat[c].avgRes; t = '<td>' + (Math.abs(d) < 0.05 ? 'No change' : d > 0 ? '&#9650; ' + r1(d) + ' higher' : '&#9660; ' + r1(-d) + ' lower') + '</td>'; } else t = '<td>-</td>'; } return '<tr><th scope="row">' + CAT_NAME[c] + '</th><td class="num">' + x.n + '</td><td class="num">' + (x.n ? r1(x.avgInh) : '-') + '</td><td class="num">' + (x.n ? r1(x.avgRes) : '-') + '</td><td class="num">' + x.hi + '</td>' + t + '</tr>'; }).join('') + '</tbody></table>';
    var top = rows.slice().sort(function (a, b) { return b.res - a.res || b.inh - a.inh; });
    h += '<h2>4. Risk register, ranked by residual score</h2><table class="mini"><thead><tr><th scope="col">#</th><th scope="col">Risk</th><th scope="col">Inherent</th><th scope="col">Controls</th><th scope="col">Residual</th>' + (ps ? '<th scope="col">Since previous</th>' : '') + '<th scope="col">Owner</th></tr></thead><tbody>' +
      top.map(function (r, i) { return '<tr><td class="num">' + (i + 1) + '</td><th scope="row" style="font-weight:600">' + esc(r.code + ' ' + r.title) + '<div class="sub" style="font-weight:400">' + CAT_NAME[r.cat] + '</div>' + (r.mode === 'override' && r.rationale ? '<div class="sub" style="font-weight:400">Override: ' + esc(r.rationale) + '</div>' : '') + '</th><td>' + bandChip(r.inh, r.ib) + '</td><td>' + esc(r.elab || '') + (r.nctl ? ' (' + r.nctl + ')' : '') + '</td><td>' + bandChip(r.res, r.rb) + '</td>' + (ps ? '<td>' + changeHtml(r, bm).replace(/<[^>]+>/g, '') + '</td>' : '') + '<td>' + esc(r.owner || '-') + '</td></tr>'; }).join('') + '</tbody></table>';
    var acts = (R.actions || []).filter(function (a) { return a.status !== 'done'; }).sort(function (a, b) { return (a.due || '9999').localeCompare(b.due || '9999'); });
    var idMap = {}; rows.forEach(function (r) { idMap[r.sid] = r; });
    h += '<h2>5. Open actions</h2>' + (acts.length ? '<table class="mini keep"><thead><tr><th scope="col">Action</th><th scope="col">Risk</th><th scope="col">Owner</th><th scope="col">Due</th></tr></thead><tbody>' + acts.map(function (a) { var r = idMap[a.sid]; var od = a.due && a.due < todayIso() && !R.snap; return '<tr><td>' + esc(a.title) + '</td><td>' + (r ? esc(r.code) : '-') + '</td><td>' + esc(a.owner || '-') + '</td><td>' + fmt(a.due) + (od ? ' (overdue)' : '') + '</td></tr>'; }).join('') + '</tbody></table>' : '<p>No open actions.</p>');
    var so = R.so;
    h += '<h2>6. Sign-off</h2><p class="muted small">AMLR Art. 10(2): drawn up by the compliance officer, approved by the management body in its management function and, where such a body exists, communicated to the management body in its supervisory function.</p><div class="sign keep">' +
      '<div><b>Prepared by</b> (compliance officer)<br>' + esc(so.preparedBy || '') + '<small>' + (so.preparedOn ? fmt(so.preparedOn) : 'Date: ____________') + '</small></div>' +
      '<div><b>Reviewed by</b><br>' + esc(so.reviewedBy || '') + '<small>' + (so.reviewedOn ? fmt(so.reviewedOn) : 'Date: ____________') + '</small></div>' +
      '<div><b>Approved by</b> (management body)<br>' + esc(so.approvedBy || '') + '<small>' + (so.approvedOn ? fmt(so.approvedOn) : 'Date: ____________') + '</small></div></div>' +
      '<p class="small">Communicated to the supervisory function: ' + (so.communicated ? 'yes' : 'not recorded') + (so.ref ? '. Reference: ' + esc(so.ref) : '') + '.</p>';
    h += '<h2>7. Method and limits</h2><p class="small">Inherent risk = likelihood x impact on 1 to 5 scales. Controls linked from the controls library lower likelihood (preventive) or impact (detective and other) according to their approval status, last test result and retest timeliness, capped at a ' + Math.round(S.params.cap * 100) + '% reduction; a manual override needs a written rationale. Bands: Low up to ' + th[0] + ', Medium up to ' + th[1] + ', High up to ' + th[2] + ', Very high above. Scales, bands and weights are defaults chosen by RegRadar, set by the firm and not by any regulator. Legal basis: AMLR (Reg. (EU) 2024/1624) Art. 10, which applies from 10 July 2027, and the EBA ML/TF Risk Factors Guidelines (EBA/GL/2021/02, amended by EBA/GL/2024/01). This is a prototype output: it is not legal advice or an audit opinion, and it is only as good as the inputs and judgement behind it.</p>';
    S.scales = keep;
    $('reportRoot').innerHTML = h;
    Array.prototype.forEach.call($('reportRoot').querySelectorAll('table.mini'), function (t) {
      var hd = Array.prototype.map.call(t.querySelectorAll('thead th'), function (x) { return x.textContent; });
      Array.prototype.forEach.call(t.querySelectorAll('tbody tr'), function (tr) { Array.prototype.forEach.call(tr.children, function (c, i) { if (hd[i]) c.setAttribute('data-l', hd[i]); }); });
    });
  }

  /* ---------- method tab ---------- */
  var ART10 = null;
  function renderMethod() {
    var P = S.params, th = S.scales.bands;
    var art = ART10 ? ART10.text.split(/\n+/).filter(function (p) { return p.trim(); }).map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('') : '<p>The article text could not be loaded here. Read it in the <a class="lnk" href="law.html?celex=32024R1624&amp;art=10">law reader</a>.</p>';
    $('methodRoot').innerHTML =
      '<section class="pane" aria-labelledby="m1"><h2 id="m1">What the law asks for</h2>' +
      '<p class="sub">Regulation (EU) 2024/1624 (AMLR) applies from 10 July 2027 (Art. 90, checked in the parsed text). Until then, firms rely on Directive (EU) 2015/849 Art. 8 and the EBA guidelines below.</p>' +
      '<h3>AMLR Art. 10, Business-wide risk assessment (verbatim from the parsed EUR-Lex text in this repository)</h3><div class="quote">' + art + '</div>' +
      '<p class="small muted" style="margin-top:8px">Art. 10(4) also tells AMLA to issue guidelines on the minimum content of the assessment by 10 July 2026. RegRadar has not checked whether they have been published: look in RegWatch, and adapt the categories, scales and fields here when they are.</p>' +
      '<p class="small" style="margin-top:8px"><a class="lnk" href="law.html?celex=32024R1624&amp;art=10">Read Article 10 in the law reader</a> &middot; <a class="lnk" href="law.html?celex=32024R1624&amp;art=9">Article 9: internal policies, procedures and controls</a> (names the carrying out and updating of the business-wide risk assessment among them)</p></section>' +
      '<section class="pane" aria-labelledby="m2"><h2 id="m2">EBA guidance used</h2><ul>' +
      '<li><b>EBA/GL/2021/02</b> (1 March 2021), Guidelines on customer due diligence and the factors credit and financial institutions should consider when assessing the ML/TF risk associated with individual business relationships and occasional transactions (the "ML/TF Risk Factors Guidelines"), issued under Articles 17 and 18(4) of Directive (EU) 2015/849. Title I covers risk assessment for all firms, with sectoral guidance in Title II (Guideline 10 e-money issuers, Guideline 11 money remitters, Guideline 18 payment initiation and account information services).</li>' +
      '<li><b>EBA/GL/2024/01</b> (16 January 2024, applies from 30 December 2024), amending EBA/GL/2021/02. It adds crypto-asset risk factors to Title I, a new sectoral Guideline 21 for crypto-asset service providers, and a new Guideline 1.7(d): where a firm launches or significantly changes products, services or business practices, including a new delivery channel or technology, it should assess the risk exposure before launch and reflect a significant impact in its business-wide risk assessment.</li></ul>' +
      '<p class="small muted">Checked against the text of EBA/GL/2024/01 as published on eba.europa.eu. Not re-read here: the full unamended Title I wording of EBA/GL/2021/02 and any later consolidated version. The AMLR is expected to be supported by AMLA guidelines (see above); those will take precedence once they exist.</p>' +
      '<p class="small"><a class="lnk" href="https://www.eba.europa.eu/sites/default/files/2024-01/a3e89f4f-fbf3-4bd6-9e07-35f3243555b3/Final%20Amending%20%20Guidelines%20on%20MLTF%20Risk%20Factors.pdf" rel="noopener">EBA/GL/2024/01 final report (PDF, eba.europa.eu)</a></p></section>' +
      '<section class="pane" aria-labelledby="m3"><h2 id="m3">How the scores are calculated</h2>' +
      '<ol><li><b>Inherent risk</b> = likelihood x impact, each 1 to 5, before any control. Range 1 to 25.</li>' +
      '<li><b>Rating bands</b> (your setting): Low up to ' + th[0] + ', Medium up to ' + th[1] + ', High up to ' + th[2] + ', Very high above ' + th[2] + '.</li>' +
      '<li><b>Strength of one control</b> <span class="formula">s = status x test x overdue</span>. Status: approved 1.00, in review 0.50, draft 0.25. Test: effective 1.00, needs improvement 0.50, failed 0.00, no test result ' + P.untested.toFixed(2) + '. Overdue retest: x ' + P.overdue.toFixed(2) + ' (only when the control has a frequency and a last test date).</li>' +
      '<li><b>Effect of several controls</b> <span class="formula">E = 1 - (1 - s1)(1 - s2)...</span>, so each extra control helps with diminishing returns. Preventive controls give E for likelihood; detective and all other types give E for impact.</li>' +
      '<li><b>Residual position</b> <span class="formula">L&prime; = 1 + (L - 1)(1 - cap x E<sub>L</sub>)</span> and <span class="formula">I&prime; = 1 + (I - 1)(1 - cap x E<sub>I</sub>)</span>, rounded to the nearest whole step, where cap = ' + Math.round(P.cap * 100) + '%. Residual score = L&prime; x I&prime;.</li>' +
      '<li><b>Manual override</b>: you may set the effectiveness yourself (Ineffective 0, Weak 0.25, Partially effective 0.5, Largely effective 0.75, Effective 1). It replaces the derived E on both axes and must carry a written rationale, which appears in the register and the board report.</li>' +
      '<li><b>No linked control</b> means E = 0: residual equals inherent, and the register flags it.</li></ol>' +
      '<div class="pt" aria-label="Current parameters"><span>Largest reduction by controls (cap)</span><b>' + Math.round(P.cap * 100) + '%</b><span>Credit when retest overdue</span><b>' + Math.round(P.overdue * 100) + '%</b><span>Credit for a control with no test result</span><b>' + Math.round(P.untested * 100) + '%</b></div></section>' +
      '<section class="pane" aria-labelledby="m4"><h2 id="m4">Limits, and what is demo versus checked</h2><ul>' +
      '<li><b>Checked:</b> the text of AMLR Art. 10 and Art. 90 shown here comes straight from the parsed official text; the EBA references named in the scenario library were read in the published EBA/GL/2024/01 text.</li>' +
      '<li><b>Defaults, not rules:</b> the starter scenarios, their default likelihood and impact, the scale wording, the rating bands, the control weights and the cap are RegRadar defaults. No regulator prescribes them. Configure them, then explain your choices to your supervisor.</li>' +
      '<li><b>Demo:</b> CF Bank is fictional. Its scores, owners, actions and its two earlier versions are invented to show the tool.</li>' +
      '<li><b>Limits:</b> a 5 by 5 matrix is a communication tool, not a measurement. Control effectiveness is inferred from status and test records in the controls library, and cannot replace judgement about whether a control really works. A control you link is assumed to address the risk: the tool does not judge relevance, and one strong control can by itself produce a high effectiveness, so review the links. The tool does not check completeness: a risk you never list is not assessed. The library has no credit-institution set yet.</li>' +
      '<li><b>Storage:</b> everything stays in this browser. There is no account, no audit trail beyond saved versions, and no multi-user approval. Back up before clearing site data.</li></ul>' +
      '<p class="small"><b>Prototype, not legal advice.</b> Verify against the official sources and your supervisor\'s expectations before relying on any output.</p></section>';
  }

  /* ---------- scenario dialog ---------- */
  function optsScale(arr, sel) { return arr.map(function (x, i) { return '<option value="' + (i + 1) + '"' + (sel === i + 1 ? ' selected' : '') + '>' + (i + 1) + ' - ' + esc(x.n) + '</option>'; }).join(''); }
  function openScenario(id) {
    var sc = scById(id); if (!sc) return;
    UI.editId = id; UI.ctlQ = '';
    $('dsTitle').textContent = sc.code + ': risk scenario';
    $('ds_title').value = sc.title; $('ds_desc').value = sc.desc || ''; $('ds_owner').value = sc.owner || ''; $('ds_notes').value = sc.notes || '';
    $('ds_cat').innerHTML = CATS.map(function (c) { return '<option value="' + c + '"' + (sc.cat === c ? ' selected' : '') + '>' + CAT_NAME[c] + '</option>'; }).join('');
    $('ds_L').innerHTML = optsScale(S.scales.likelihood, sc.L); $('ds_I').innerHTML = optsScale(S.scales.impact, sc.I);
    $('ds_cq').value = '';
    $('ds_ref').innerHTML = sc.ref ? 'Source: ' + esc(sc.ref) : (sc.lib ? 'RegRadar starter scenario, not taken from a regulator\'s list.' : 'Custom risk added by you.');
    $('ownerList').innerHTML = ownersList().map(function (o) { return '<option value="' + esc(o) + '">'; }).join('');
    $('ds_ovr').innerHTML = '<option value="">Derived from the linked controls</option>' + LEVELS.map(function (l) { return '<option value="' + l.v + '">Override: ' + l.n + '</option>'; }).join('');
    $('ds_ovr').value = sc.override ? String(sc.override.value) : ''; $('ds_rat').value = sc.override ? (sc.override.rationale || '') : '';
    refreshScenarioDlg();
    $('dlgScenario').showModal();
  }
  function scaleHints() {
    var sc = scById(UI.editId); if (!sc) return;
    $('ds_Lh').textContent = (S.scales.likelihood[sc.L - 1] || {}).d || ''; $('ds_Ih').textContent = (S.scales.impact[sc.I - 1] || {}).d || '';
  }
  function suggested(sc) {
    var kws = (sc.lib && libScenario(sc.lib) ? libScenario(sc.lib).kw : []) || [];
    var m = {};
    CTLS.forEach(function (c) { var n = c.name.toLowerCase(); if (kws.some(function (k) { return n.indexOf(k) !== -1; })) m[c.id] = 1; });
    return m;
  }
  function ctlRowStatus(c) {
    var st = strength(c);
    var chips = '<span class="chip ' + (c.status === 'approved' ? 'ok' : 'imp') + '">' + (STATUS_N[c.status] || c.status) + '</span> <span class="chip ' + (c.effectiveness === 'effective' ? 'ok' : (c.effectiveness === 'failed' ? 'crit' : 'imp')) + '">' + (TEST_N[c.effectiveness] || c.effectiveness) + '</span>' + (st.od ? ' <span class="chip crit">Retest overdue</span>' : '');
    return { st: st, chips: chips };
  }
  function renderCtlPick(sc) {
    if (!CTL_OK) { $('ds_ctls').innerHTML = '<p class="muted">The controls library could not be loaded.</p>'; return; }
    var q = UI.ctlQ.toLowerCase(), sg = suggested(sc);
    var list = CTLS.filter(function (c) { return !q || (c.name + ' ' + c.owner + ' ' + c.type).toLowerCase().indexOf(q) !== -1; })
      .sort(function (a, b) { var A = sc.controls.indexOf(a.id) !== -1 ? 0 : sg[a.id] ? 1 : 2, B = sc.controls.indexOf(b.id) !== -1 ? 0 : sg[b.id] ? 1 : 2; return A - B; });
    var miss = sc.controls.filter(function (id) { return !CTL[id]; });
    $('ds_ctls').innerHTML = miss.map(function (id) { return '<div class="ctlitem"><input type="checkbox" checked data-ctl="' + esc(id) + '" id="cx-' + esc(id) + '"><label for="cx-' + esc(id) + '"><span class="t">' + esc(id) + ' (no longer in the library)</span></label><span class="chip crit">Missing</span></div>'; }).join('') +
      (list.map(function (c) {
        var on = sc.controls.indexOf(c.id) !== -1, r = ctlRowStatus(c);
        return '<div class="ctlitem"><input type="checkbox" data-ctl="' + esc(c.id) + '" id="cx-' + esc(c.id) + '"' + (on ? ' checked' : '') + '><label for="cx-' + esc(c.id) + '"><span class="t">' + esc(c.name) + '</span><span class="sub">' + esc(c.type) + ' &middot; ' + esc(c.owner || 'no owner') + ' &middot; ' + (c.last_tested ? 'tested ' + fmt(c.last_tested) : 'never tested') + (!on && sg[c.id] ? ' &middot; <b>suggested</b>' : '') + '</span></label><span class="rowtools" style="justify-content:flex-end">' + r.chips + ' <span class="chip mono">' + Math.round(r.st.s * 100) + '%</span></span></div>';
      }).join('') || '<p class="muted">No control matches.</p>');
  }
  function refreshScenarioDlg() {
    var sc = scById(UI.editId); if (!sc) return;
    var ev = evaluate(sc);
    scaleHints();
    renderCtlPick(sc);
    var eff;
    if (ev.mode === 'none') eff = '<div class="calc"><b>No control linked.</b> Residual risk equals inherent risk. Link the controls that answer this risk, or document why none applies using an override.</div>';
    else eff = '<div class="pairs"><div><div class="small muted">Control effectiveness</div><b style="font-size:16px">' + esc(effLabel(ev.E)) + '</b> <span class="mono">(' + Math.round(ev.E * 100) + '%' + (ev.mode === 'override' ? ', manual override' : '') + ')</span></div></div>';
    eff += '<div class="pairs" style="margin-top:10px"><div>Inherent ' + bandChip(ev.inh, ev.ib) + '</div><span class="arrow" aria-hidden="true">&rarr;</span><div>Residual ' + bandChip(ev.res, ev.rb) + '</div></div>';
    $('ds_eff').innerHTML = eff;
    var c = '<ol>';
    c += '<li>Inherent: <code>L ' + sc.L + ' x I ' + sc.I + ' = ' + ev.inh + '</code> (' + BAND[ev.ib] + ').</li>';
    if (ev.mode === 'override') c += '<li>Manual override: effectiveness set to <code>' + ev.E.toFixed(2) + '</code> (' + effLabel(ev.E) + ') for both likelihood and impact. The linked controls are shown but not used.</li>';
    function list(arr, nm) { return arr.length ? arr.map(function (x) { return esc(x.c.name) + ' <code>' + x.st.sf.toFixed(2) + ' x ' + x.st.tf.toFixed(2) + (x.st.od ? ' x ' + S.params.overdue.toFixed(2) : '') + ' = ' + x.st.s.toFixed(2) + '</code>'; }).join('; ') : 'none'; }
    c += '<li>Preventive controls (reduce likelihood): ' + list(ev.pre) + '. Combined <code>E<sub>L</sub> = ' + ev.eL.toFixed(2) + '</code>.</li>';
    c += '<li>Detective and other controls (reduce impact): ' + list(ev.oth) + '. Combined <code>E<sub>I</sub> = ' + ev.eI.toFixed(2) + '</code>.</li>';
    c += '<li>Residual likelihood: <code>1 + (' + sc.L + ' - 1) x (1 - ' + S.params.cap.toFixed(2) + ' x ' + ev.eL.toFixed(2) + ') = ' + ev.rLraw.toFixed(2) + '</code>, rounded to <b>' + ev.rL + '</b>.</li>';
    c += '<li>Residual impact: <code>1 + (' + sc.I + ' - 1) x (1 - ' + S.params.cap.toFixed(2) + ' x ' + ev.eI.toFixed(2) + ') = ' + ev.rIraw.toFixed(2) + '</code>, rounded to <b>' + ev.rI + '</b>.</li>';
    c += '<li>Residual: <code>' + ev.rL + ' x ' + ev.rI + ' = ' + ev.res + '</code> (' + BAND[ev.rb] + ').</li></ol>';
    $('ds_calc').innerHTML = c;
    $('ds_raterr').hidden = !(sc.override && !String(sc.override.rationale || '').trim());
    var acts = S.actions.filter(function (a) { return a.sid === sc.id; });
    $('ds_acts').innerHTML = acts.length ? acts.map(function (a) { return '<div class="cardrow ' + (a.status === 'done' ? 'done' : '') + '"><div><div class="t">' + esc(a.title) + '</div><div class="sub">' + (a.owner ? esc(a.owner) : 'No owner') + ' &middot; due ' + fmt(a.due) + ' &middot; ' + ({ open: 'Open', progress: 'In progress', done: 'Done' })[a.status] + '</div></div><button type="button" class="btn sm" data-act="editaction" data-id="' + a.id + '" aria-label="Edit action: ' + esc(a.title) + '">Edit</button></div>'; }).join('') : '<p class="small muted">No action for this risk yet.</p>';
  }
  function bindScenarioFields() {
    function sc() { return scById(UI.editId); }
    function upd(fn) { var s = sc(); if (!s) return; fn(s); save(); refreshScenarioDlg(); renderAll(true); }
    $('ds_title').addEventListener('input', function () { var s = sc(); if (s) { s.title = this.value; save(); renderAll(true); } });
    $('ds_desc').addEventListener('input', function () { var s = sc(); if (s) { s.desc = this.value; save(); } });
    $('ds_notes').addEventListener('input', function () { var s = sc(); if (s) { s.notes = this.value; save(); } });
    $('ds_owner').addEventListener('input', function () { var v = this.value; var s = sc(); if (s) { s.owner = v; save(); renderAll(true); } });
    $('ds_cat').addEventListener('change', function () { var v = this.value; upd(function (s) { if (s.cat !== v) { s.cat = v; s.code = nextCode(v); $('dsTitle').textContent = s.code + ': risk scenario'; } }); });
    $('ds_L').addEventListener('change', function () { var v = parseInt(this.value, 10); upd(function (s) { s.L = v; }); });
    $('ds_I').addEventListener('change', function () { var v = parseInt(this.value, 10); upd(function (s) { s.I = v; }); });
    $('ds_cq').addEventListener('input', function () { UI.ctlQ = this.value; var s = sc(); if (s) renderCtlPick(s); });
    $('ds_ctls').addEventListener('change', function (e) {
      var id = e.target.getAttribute('data-ctl'); if (!id) return;
      var s = sc(); if (!s) return;
      var i = s.controls.indexOf(id);
      if (e.target.checked && i === -1) s.controls.push(id); else if (!e.target.checked && i !== -1) s.controls.splice(i, 1);
      save(); var fid = document.activeElement && document.activeElement.id; refreshScenarioDlg(); renderAll(true); if (fid && $(fid)) $(fid).focus();
    });
    $('ds_ovr').addEventListener('change', function () {
      var v = this.value; upd(function (s) { s.override = v === '' ? null : { value: parseFloat(v), rationale: (s.override && s.override.rationale) || $('ds_rat').value || '' }; });
    });
    $('ds_rat').addEventListener('input', function () { var s = sc(); if (s && s.override) { s.override.rationale = this.value; save(); $('ds_raterr').hidden = !!this.value.trim(); renderAll(true); } });
  }

  /* ---------- library dialog ---------- */
  function openLibrary() {
    UI.libFirm = S.firm.type;
    UI.libSel = {};
    S.scenarios.forEach(function (s) { if (s.lib) UI.libSel[s.lib] = true; });
    if (!S.scenarios.length) LIB.scenarios.forEach(function (ls) { if (ls.firms[UI.libFirm]) UI.libSel[ls.id] = true; });
    $('dl_firm').innerHTML = Object.keys(FIRM).map(function (k) { return '<option value="' + k + '"' + (UI.libFirm === k ? ' selected' : '') + '>' + FIRM[k] + '</option>'; }).join('');
    renderLibrary(); $('dlgLibrary').showModal();
  }
  function renderLibrary() {
    var firm = UI.libFirm, h = '';
    CATS.forEach(function (c) {
      var items = LIB.scenarios.filter(function (s) { return s.cat === c && s.firms[firm]; });
      if (!items.length) return;
      h += '<h3 style="margin:14px 0 6px">' + CAT_NAME[c] + '</h3>';
      items.forEach(function (s) {
        var d = s.firms[firm];
        h += '<div class="ctlitem" style="grid-template-columns:auto minmax(0,1fr) auto"><input type="checkbox" id="lb-' + s.id + '" data-lib="' + s.id + '"' + (UI.libSel[s.id] ? ' checked' : '') + '><label for="lb-' + s.id + '"><span class="t">' + esc(s.title) + '</span><span class="sub">' + esc(s.desc) + '</span></label><span class="chip mono" title="Default likelihood x impact for this firm type">' + d[0] + ' x ' + d[1] + '</span></div>';
      });
    });
    $('dl_list').innerHTML = h;
    libSummary();
  }
  function libSummary() {
    var have = {}; S.scenarios.forEach(function (s) { if (s.lib) have[s.lib] = true; });
    var add = 0, rem = 0;
    Object.keys(UI.libSel).forEach(function (k) { if (UI.libSel[k] && !have[k]) add++; });
    Object.keys(have).forEach(function (k) { if (!UI.libSel[k]) rem++; });
    $('dl_sum').textContent = add + ' to add' + (rem ? ', ' + rem + ' to remove (with their links and notes)' : '') + '. Your own custom risks are never touched.';
  }

  /* ---------- settings dialog ---------- */
  function openSettings() {
    function rows(kind, arr) { return arr.map(function (x, i) { return '<div class="fields" style="margin-bottom:8px"><div class="field"><label for="dg_' + kind + 'n' + i + '">' + (kind === 'L' ? 'Likelihood' : 'Impact') + ' ' + (i + 1) + ' name</label><input class="in" id="dg_' + kind + 'n' + i + '" value="' + esc(x.n) + '" autocomplete="off"></div><div class="field"><label for="dg_' + kind + 'd' + i + '">What it means</label><input class="in" id="dg_' + kind + 'd' + i + '" value="' + esc(x.d || '') + '" autocomplete="off"></div></div>'; }).join(''); }
    $('dg_L').innerHTML = rows('L', S.scales.likelihood); $('dg_I').innerHTML = rows('I', S.scales.impact);
    $('dg_b0').value = S.scales.bands[0]; $('dg_b1').value = S.scales.bands[1]; $('dg_b2').value = S.scales.bands[2];
    $('dg_cap').value = Math.round(S.params.cap * 100); $('dg_od').value = Math.round(S.params.overdue * 100); $('dg_un').value = Math.round(S.params.untested * 100);
    $('dg_err').hidden = true; $('dlgSettings').showModal();
  }
  function applySettings(defaults) {
    var sc = S.scales, pr = S.params;
    if (defaults) { sc.likelihood = clone(LIB.defaults.likelihood); sc.impact = clone(LIB.defaults.impact); sc.bands = LIB.defaults.bands.slice(); S.params = clone(LIB.defaults.params); }
    else {
      var b = [parseInt($('dg_b0').value, 10), parseInt($('dg_b1').value, 10), parseInt($('dg_b2').value, 10)];
      if (!(b[0] >= 1 && b[1] > b[0] && b[2] > b[1] && b[2] <= 24)) { $('dg_err').hidden = false; return false; }
      for (var i = 0; i < 5; i++) {
        sc.likelihood[i] = { n: $('dg_Ln' + i).value.trim() || sc.likelihood[i].n, d: $('dg_Ld' + i).value.trim() };
        sc.impact[i] = { n: $('dg_In' + i).value.trim() || sc.impact[i].n, d: $('dg_Id' + i).value.trim() };
      }
      sc.bands = b;
      function pc(id, def) { var v = parseFloat($(id).value); return isFinite(v) ? Math.min(100, Math.max(0, v)) / 100 : def; }
      pr.cap = Math.max(0.1, pc('dg_cap', 0.75)); pr.overdue = pc('dg_od', 0.7); pr.untested = pc('dg_un', 0.3);
    }
    save(); renderAll(); return true;
  }

  /* ---------- action dialog ---------- */
  function openAction(id, sid) {
    var a = id ? S.actions.filter(function (x) { return x.id === id; })[0] : null;
    UI.actId = id || null;
    $('daTitle').textContent = a ? 'Edit action' : 'Add an action';
    $('da_title').value = a ? a.title : ''; $('da_owner').value = a ? a.owner : ''; $('da_due').value = a ? a.due : ''; $('da_status').value = a ? a.status : 'open';
    var sel = a ? a.sid : (sid || '');
    $('da_sid').innerHTML = '<option value="">Not linked to a risk</option>' + S.scenarios.map(function (s) { return '<option value="' + s.id + '"' + (s.id === sel ? ' selected' : '') + '>' + esc(s.code + ' ' + s.title) + '</option>'; }).join('');
    $('da_del').hidden = !a; $('da_err').hidden = true;
    $('ownerList').innerHTML = ownersList().map(function (o) { return '<option value="' + esc(o) + '">'; }).join('');
    $('dlgAction').showModal();
  }
  function saveAction() {
    var t = $('da_title').value.trim();
    if (!t) { $('da_err').hidden = false; $('da_title').focus(); return; }
    var o = { title: t, sid: $('da_sid').value, owner: $('da_owner').value.trim(), due: $('da_due').value, status: $('da_status').value };
    if (UI.actId) Object.assign(S.actions.filter(function (x) { return x.id === UI.actId; })[0], o);
    else S.actions.push(Object.assign({ id: uid('ac-') }, o));
    save(); $('dlgAction').close(); renderAll(); if ($('dlgScenario').open) refreshScenarioDlg(); toast('Action saved');
  }

  /* ---------- confirm ---------- */
  var confirmCb = null;
  function confirmDlg(title, msg, okLabel, cb) {
    $('dcTitle').textContent = title; $('dcMsg').textContent = msg; $('dcOk').textContent = okLabel || 'Confirm'; confirmCb = cb; $('dlgConfirm').showModal();
  }

  /* ---------- CSV ---------- */
  function csvCell(v) {
    var s = String(v == null ? '' : v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[",\n\r;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function download(name, text, type) {
    var blob = new Blob(['﻿' + text], { type: type || 'text/csv;charset=utf-8' }), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name; a.hidden = true; a.textContent = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function exportCsv() {
    var R = reportSource(), rows = R.rows.slice().sort(function (a, b) { return b.res - a.res || b.inh - a.inh; });
    var idx = R.snap ? S.snapshots.indexOf(R.snap) : S.snapshots.length, bm = baseMap(idx > 0 ? S.snapshots[idx - 1] : null);
    var head = ['Rank', 'ID', 'Category', 'Risk', 'Description', 'Likelihood', 'Impact', 'Inherent score', 'Inherent rating', 'Linked controls', 'Control effectiveness', 'Effectiveness basis', 'Override rationale',
      'Residual likelihood', 'Residual impact', 'Residual score', 'Residual rating', 'Previous residual score', 'Change', 'Owner', 'Open actions', 'Source'];
    var lines = [head.map(csvCell).join(',')];
    rows.forEach(function (r, i) {
      var p = bm[r.sid], oa = (R.actions || []).filter(function (a) { return a.sid === r.sid && a.status !== 'done'; }).length;
      lines.push([i + 1, r.code, CAT_NAME[r.cat], r.title, r.desc || '', r.L, r.I, r.inh, BAND[r.ib], (r.ctlNames || []).join(' | '), r.elab, r.mode === 'override' ? 'Manual override' : r.mode === 'derived' ? 'Derived from controls' : 'No control', r.rationale || '',
        r.rL, r.rI, r.res, BAND[r.rb], p ? p.res : '', p ? r.res - p.res : 'new', r.owner, oa, r.ref || ''].map(csvCell).join(','));
    });
    download('bwra-register-' + (R.snap ? R.snap.date : todayIso()) + '.csv', lines.join('\r\n'));
    toast('Register exported (' + rows.length + ' risks)');
  }
  function exportActionsCsv() {
    var lines = [['Action', 'Risk ID', 'Risk', 'Owner', 'Due', 'Status', 'Overdue'].map(csvCell).join(',')];
    S.actions.forEach(function (a) { var sc = scById(a.sid); lines.push([a.title, sc ? sc.code : '', sc ? sc.title : '', a.owner, a.due, ({ open: 'Open', progress: 'In progress', done: 'Done' })[a.status], a.status !== 'done' && a.due && a.due < todayIso() ? 'yes' : 'no'].map(csvCell).join(',')); });
    download('bwra-actions-' + todayIso() + '.csv', lines.join('\r\n')); toast('Actions exported');
  }

  /* ---------- render all ---------- */
  function renderAll(quick) {
    var fid = document.activeElement && document.activeElement.id;
    var rows = currentRows(), st = stats(rows);
    renderBanners(); renderOverview(rows, st); renderRegister(rows); renderActions(); renderSnaps(); renderReport();
    if (!quick) renderMethod();
    if (fid && $(fid) && document.activeElement !== $(fid) && !$('dlgScenario').open) $(fid).focus();
  }
  function setTab(t, focus) {
    UI.tab = t;
    document.querySelectorAll('#tabs [role=tab]').forEach(function (b) {
      var on = b.getAttribute('data-tab') === t; b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1;
      if (on && focus) b.focus();
    });
    ['overview', 'register', 'actions', 'versions', 'report', 'method'].forEach(function (k) { $('panel-' + k).hidden = k !== t; });
    try { history.replaceState(null, '', '#' + t); } catch (e) {}
  }

  /* ---------- library apply ---------- */
  function applyLibrary() {
    var firm = UI.libFirm, have = {};
    S.scenarios.forEach(function (s) { if (s.lib) have[s.lib] = s; });
    var removed = 0, added = 0;
    Object.keys(have).forEach(function (k) { if (!UI.libSel[k]) { var id = have[k].id; S.scenarios = S.scenarios.filter(function (s) { return s.id !== id; }); S.actions.forEach(function (a) { if (a.sid === id) a.sid = ''; }); removed++; } });
    LIB.scenarios.forEach(function (ls) { if (UI.libSel[ls.id] && !have[ls.id] && ls.firms[firm]) { S.scenarios.push(fromLib(ls, firm)); added++; } });
    S.firm.type = firm;
    save(); renderAll(); fillFilters();
    toast(added + ' added, ' + removed + ' removed');
  }

  /* ---------- events ---------- */
  function onClick(e) {
    var t = e.target.closest('[data-act],[data-tab],[data-tab-go],[data-close]');
    if (!t) return;
    if (t.hasAttribute('data-close')) { var d = t.closest('dialog'); if (d) d.close(); return; }
    if (t.hasAttribute('data-tab')) { setTab(t.getAttribute('data-tab')); return; }
    if (t.hasAttribute('data-tab-go')) { setTab(t.getAttribute('data-tab-go')); return; }
    var a = t.getAttribute('data-act'), id = t.getAttribute('data-id');
    switch (a) {
      case 'library': openLibrary(); break;
      case 'add': addCustom(); break;
      case 'csv': exportCsv(); break;
      case 'csvactions': exportActionsCsv(); break;
      case 'print': renderReport(); setTimeout(function () { window.print(); }, 60); break;
      case 'settings': openSettings(); break;
      case 'cell':
        var k = { kind: t.getAttribute('data-kind'), l: +t.getAttribute('data-l'), i: +t.getAttribute('data-i') };
        UI.cell = (UI.cell && UI.cell.kind === k.kind && UI.cell.l === k.l && UI.cell.i === k.i) ? null : k;
        setTab('register'); renderAll(true); break;
      case 'clearcell': UI.cell = null; renderAll(true); break;
      case 'clearfilters': UI.q = ''; UI.cat = ''; UI.band = ''; UI.owner = ''; UI.noctl = false; UI.cell = null; renderAll(true); break;
      case 'open': openScenario(id); break;
      case 'addaction': openAction(null, null); break;
      case 'addaction-here': openAction(null, UI.editId); break;
      case 'editaction': openAction(id); break;
      case 'saveaction': saveAction(); break;
      case 'delaction':
        confirmDlg('Delete this action?', 'The action is removed from the register and the board report.', 'Delete', function () { S.actions = S.actions.filter(function (x) { return x.id !== UI.actId; }); save(); $('dlgAction').close(); renderAll(); if ($('dlgScenario').open) refreshScenarioDlg(); toast('Action deleted'); });
        break;
      case 'actdone': var ac = S.actions.filter(function (x) { return x.id === id; })[0]; if (ac) { ac.status = 'done'; save(); renderAll(true); toast('Marked done'); } break;
      case 'donescenario':
        var s0 = scById(UI.editId);
        if (s0 && s0.override && !String(s0.override.rationale || '').trim()) { $('ds_raterr').hidden = false; $('ds_rat').focus(); return; }
        $('dlgScenario').close(); break;
      case 'delscenario':
        confirmDlg('Remove this risk?', 'The risk, its control links and notes are removed from the current assessment. Saved versions keep their own copy. Actions linked to it stay but become unlinked.', 'Remove', function () {
          var sid = UI.editId; S.scenarios = S.scenarios.filter(function (s) { return s.id !== sid; }); S.actions.forEach(function (x) { if (x.sid === sid) x.sid = ''; });
          save(); $('dlgScenario').close(); renderAll(); toast('Risk removed');
        });
        break;
      case 'libdefaults': LIB.scenarios.forEach(function (ls) { if (ls.firms[UI.libFirm]) UI.libSel[ls.id] = true; else delete UI.libSel[ls.id]; }); renderLibrary(); break;
      case 'libapply': $('dlgLibrary').close(); applyLibrary(); break;
      case 'savesettings': if (applySettings(false)) { $('dlgSettings').close(); toast('Settings saved'); } break;
      case 'resetsettings': confirmDlg('Restore the default scales?', 'Scale wording, rating bands and control weights return to the RegRadar defaults. Your risks keep their likelihood and impact numbers.', 'Restore', function () { applySettings(true); $('dlgSettings').close(); toast('Defaults restored'); }); break;
      case 'savesnap': saveSnapshot(); break;
      case 'viewsnap': UI.rsrc = id; renderReport(); setTab('report'); break;
      case 'setbase': S.baseline = id; save(); renderAll(true); toast('Trend baseline updated'); break;
      case 'delsnap': confirmDlg('Delete this version?', 'The saved version is removed from this device. This cannot be undone unless you have a backup.', 'Delete', function () { S.snapshots = S.snapshots.filter(function (s) { return s.id !== id; }); if (S.baseline === id) S.baseline = null; if (UI.rsrc === id) UI.rsrc = 'current'; save(); renderAll(true); toast('Version deleted'); }); break;
      case 'backup': download('regradar-bwra-backup-' + todayIso() + '.json', JSON.stringify(S, null, 1), 'application/json'); toast('Backup downloaded'); break;
      case 'startblank':
        confirmDlg('Start a blank assessment?', 'This replaces everything in the BWRA on this device, including saved versions. Download a backup first if you want to keep it.', 'Start blank', function () { S = blank(); UI.cell = null; save(); resetUiAfterLoad(); openLibrary(); });
        break;
      case 'loaddemo':
        confirmDlg('Load the CF Bank demo?', 'This replaces the BWRA on this device with fictional demo data.', 'Load demo', function () { S = buildDemo(); UI.cell = null; save(); resetUiAfterLoad(); toast('Demo loaded'); });
        break;
    }
  }
  function resetUiAfterLoad() { UI.rsrc = 'current'; renderAll(); fillSignoff(); setTab('overview'); }
  function addCustom() {
    var cat = 'customers';
    var sc = { id: uid('sc-'), code: nextCode(cat), cat: cat, lib: null, title: 'New risk scenario', desc: '', L: 3, I: 3, controls: [], override: null, owner: '', notes: '', ref: '' };
    S.scenarios.push(sc); save(); renderAll(true); openScenario(sc.id);
    setTimeout(function () { $('ds_title').select(); }, 30);
  }

  function bind() {
    document.addEventListener('click', onClick);
    $('tabs').addEventListener('keydown', function (e) {
      var tabs = Array.prototype.slice.call(document.querySelectorAll('#tabs [role=tab]')), i = tabs.indexOf(document.activeElement);
      if (i < 0) return;
      var n = e.key === 'ArrowRight' ? (i + 1) % tabs.length : e.key === 'ArrowLeft' ? (i + tabs.length - 1) % tabs.length : e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : -1;
      if (n < 0) return; e.preventDefault(); setTab(tabs[n].getAttribute('data-tab'), true);
    });
    $('fq').addEventListener('input', function () { UI.q = this.value; renderRegister(currentRows()); });
    $('fcat').addEventListener('change', function () { UI.cat = this.value; renderRegister(currentRows()); });
    $('fband').addEventListener('change', function () { UI.band = this.value; renderRegister(currentRows()); });
    $('fowner').addEventListener('change', function () { UI.owner = this.value; renderRegister(currentRows()); });
    $('fsort').addEventListener('change', function () { UI.sort = this.value; renderRegister(currentRows()); });
    $('fnoctl').addEventListener('change', function () { UI.noctl = this.checked; renderRegister(currentRows()); });
    $('afilter').addEventListener('change', function () { UI.afilter = this.value; renderActions(); });
    $('rsrc').addEventListener('change', function () { UI.rsrc = this.value; renderReport(); });
    document.addEventListener('change', function (e) { if (e.target.id === 'baseSel') { S.baseline = e.target.value; save(); renderAll(true); } });
    document.querySelectorAll('[data-so]').forEach(function (el) {
      el.addEventListener(el.type === 'checkbox' ? 'change' : 'input', function () { S.signoff[el.getAttribute('data-so')] = el.type === 'checkbox' ? el.checked : el.value; save(); renderReport(); });
    });
    $('so_firm').addEventListener('input', function () { S.firm.name = this.value; save(); renderReport(); });
    $('rf_months').addEventListener('input', function () { var v = parseInt(this.value, 10); if (v >= 1 && v <= 60) { S.refresh.months = v; save(); } });
    $('rf_due').addEventListener('input', function () { S.refresh.due = this.value; save(); rfState(); renderBanners(); renderOverview(currentRows(), stats(currentRows())); renderReport(); });
    $('dl_firm').addEventListener('change', function () { UI.libFirm = this.value; UI.libSel = {}; LIB.scenarios.forEach(function (ls) { if (ls.firms[UI.libFirm]) UI.libSel[ls.id] = true; }); renderLibrary(); });
    $('dl_list').addEventListener('change', function (e) { var id = e.target.getAttribute('data-lib'); if (!id) return; if (e.target.checked) UI.libSel[id] = true; else delete UI.libSel[id]; libSummary(); });
    $('dcOk').addEventListener('click', function () { var cb = confirmCb; confirmCb = null; $('dlgConfirm').close(); if (cb) cb(); });
    $('restoreFile').addEventListener('change', function () {
      var f = this.files && this.files[0]; if (!f) return;
      var rd = new FileReader();
      rd.onload = function () {
        try {
          var o = JSON.parse(rd.result);
          if (!o || !Array.isArray(o.scenarios) || !o.scales) throw new Error('shape');
          S = normalise(o); save(); resetUiAfterLoad(); toast('Backup restored');
        } catch (err) { toast('That file is not a RegRadar BWRA backup'); }
      };
      rd.readAsText(f); this.value = '';
    });
    bindScenarioFields();
    ['dlgScenario', 'dlgLibrary', 'dlgSettings', 'dlgAction', 'dlgConfirm'].forEach(function (id) {
      $(id).addEventListener('click', function (e) { if (e.target === this) this.close(); });
    });
    $('dlgScenario').addEventListener('close', function () { UI.editId = null; renderAll(true); });
  }

  /* ---------- boot ---------- */
  async function boot() {
    try {
      var r = await Promise.all([
        fetch('data/bwra-scenarios.json', { cache: 'no-store' }).then(function (x) { return x.json(); }),
        fetch('data/bwra-demo.json', { cache: 'no-store' }).then(function (x) { return x.json(); }),
        fetch('data/laws/32024R1624_EN.json').then(function (x) { return x.json(); }).catch(function () { return null; })
      ]);
      LIB = r[0]; DEMO = r[1];
      if (r[2]) ART10 = r[2].articles.filter(function (a) { return String(a.id) === '10'; })[0] || null;
    } catch (e) {
      $('panel-overview').innerHTML = '<div class="empty">Could not load the risk assessment data. Check your connection and reload.</div>'; return;
    }
    try { var cd = await ControlsData.load(); CTLS = cd.controls; CTLS.forEach(function (c) { CTL[c.id] = c; }); CTL_OK = true; } catch (e) { CTL_OK = false; }
    S = load();
    if (!S) { S = buildDemo(); save(); }
    var h = (location.hash || '').replace('#', '');
    bind(); fillFilters(); fillSignoff(); renderAll();
    if (['overview', 'register', 'actions', 'versions', 'report', 'method'].indexOf(h) !== -1) setTab(h);
  }
  window.addEventListener('beforeprint', function () { if (S) renderReport(); });
  boot();
})();
