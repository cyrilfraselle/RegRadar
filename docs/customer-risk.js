/* RegRadar: customer risk assessment engine (E4).
   Static, device-local. Storage key: regradar-cra.
   Data: data/cra-model.json (default model), data/cra-checklist.json (verified checklist),
   data/cra-demo.json (fictional customers), data/country-risk.json, data/obligations.json. */
(function () {
'use strict';

var KEY = 'regradar-cra';
var TIERS = ['low', 'medium', 'high', 'prohibited'];
var TL = { low: 'Low', medium: 'Medium', high: 'High', prohibited: 'Prohibited' };
var DDL = { low: 'Standard CDD', medium: 'Standard CDD', high: 'Enhanced due diligence', prohibited: 'Decline or escalate' };
var CTL = { low: 'Low', med: 'Medium', high: 'High', prohib: 'Prohibited', nodata: 'No data' };
var CTC = { low: 'low', med: 'medium', high: 'high', prohib: 'prohibited', nodata: 'none' };
var SECTION_ORDER = ['Decline or escalate', 'Alerts to resolve', 'Standard CDD', 'Simplified measures (optional)', 'Enhanced due diligence',
  'High-risk third country', 'Politically exposed person', 'Residence by investment', 'Crypto-asset services', 'Ongoing'];
var SUBST = ['cpi', 'sanctions', 'secrecy', 'criminality', 'resilience', 'human_trafficking'];
var GEO_LABEL = { fatf: 'FATF listing', eu_hrtc: 'EU high-risk list', sanctions: 'Sanctions exposure', criminality: 'Organised crime', cpi: 'Corruption (CPI)', secrecy: 'Financial secrecy', resilience: 'Weak AML resilience', human_trafficking: 'Human trafficking' };

var DEF = null, MODEL = null, CL = [], CR = null, CBY = {}, OBS = {}, DEMO = null, COUNTRY_OPTS = '';
var STATE = { v: 1, customers: [], model: null, modelEdited: '', actor: 'Analyst A (demo)', seeded: false };
var UI = { tab: 'files', sel: null, sub: 'assess', q: '', flt: 'all' };
var memOnly = false;

function $(id) { return document.getElementById(id); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function clone(o) { return JSON.parse(JSON.stringify(o)); }
function lastOf(a) { return a && a.length ? a[a.length - 1] : null; }
function rank(t) { return TIERS.indexOf(t); }
function canon(o) { return JSON.stringify(o, Object.keys(o || {}).sort()); }
function toast(m) { var t = $('toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove('on'); }, 2600); }

/* ---------- dates ---------- */
function pad(n) { return (n < 10 ? '0' : '') + n; }
function isoDay(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function todayIso() { return isoDay(new Date()); }
function dayNum(s) { return Math.floor(Date.parse(String(s).slice(0, 10) + 'T00:00:00Z') / 864e5); }
function addDays(s, n) { return new Date((dayNum(s) + n) * 864e5).toISOString().slice(0, 10); }
function addMonths(s, m) {
  var d = new Date(Date.parse(String(s).slice(0, 10) + 'T00:00:00Z')), day = d.getUTCDate();
  d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + m);
  var last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d.toISOString().slice(0, 10);
}
function fmt(s) { if (!s) return 'none'; return new Date(String(s).slice(0, 10) + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }); }
function fmtTime(s) { if (!s) return ''; var d = new Date(s); return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }
function nowIso() { return new Date().toISOString(); }
function atDaysAgo(n) { return addDays(todayIso(), -n) + 'T09:00:00.000Z'; }

/* ---------- storage ---------- */
function loadState() {
  try { var s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && s.v === 1 && Array.isArray(s.customers)) return s; } catch (e) { memOnly = true; }
  return null;
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(STATE)); } catch (e) { memOnly = true; } }

/* ---------- country data ---------- */
function cRisk(i, k) {
  if (k === 'fatf') return i.fatf === 'black' ? 10 : i.fatf === 'grey' ? 6.5 : 0;
  if (k === 'eu_hrtc') return i.eu_hrtc ? 10 : 0;
  if (k === 'cpi') return i.cpi == null ? null : (100 - i.cpi) / 10;
  if (k === 'resilience') return i.resilience == null ? null : 10 - i.resilience;
  return i[k] == null ? null : i[k];
}
function geoSancParam() { var r = MODEL.rules.filter(function (x) { return x.id === 'r_geo_sanc'; })[0]; return r && r.param != null ? +r.param : 9; }
function countryInfo(code) {
  var c = CBY[code]; if (!c) return null;
  var g = MODEL.geo, i = c.indicators || {};
  var has = SUBST.some(function (k) { return i[k] != null; }), comp = null;
  if (has) {
    var n = 0, d = 0;
    Object.keys(g.weights).forEach(function (k) { var v = cRisk(i, k), w = +g.weights[k] || 0; if (v != null && w > 0) { n += v * w; d += w; } });
    comp = d ? n / d : null;
  }
  var prohib = i.fatf === 'black' || (i.sanctions || 0) >= (g.prohib_sanctions || 9);
  var tier = prohib ? 'prohib' : comp == null ? 'nodata' : comp < g.low ? 'low' : comp < g.high ? 'med' : 'high';
  var tags = [];
  if (i.fatf === 'black') tags.push('fatf-black');
  if (i.fatf === 'grey') tags.push('fatf-grey');
  if (i.eu_hrtc === true) tags.push('eu-hrtc');
  if (i.eu_tax) tags.push('eu-tax');
  if ((i.sanctions || 0) >= geoSancParam()) tags.push('geo-sanctions');
  return { code: code, name: c.name, comp: comp, tier: tier, tags: tags, ind: i, region: c.region };
}
var TAG_TEXT = { 'fatf-black': 'FATF black list', 'fatf-grey': 'FATF grey list', 'eu-hrtc': 'EU high-risk third country', 'eu-tax': 'EU non-cooperative tax list', 'geo-sanctions': 'high sanctions exposure' };

/* ---------- scoring engine ---------- */
function tierByScore(s, th) { return s >= th.high ? 'high' : s >= th.medium ? 'medium' : 'low'; }
function evaluate(inputs, model) {
  model = model || MODEL;
  var W = 0; model.factors.forEach(function (f) { W += Math.max(0, +f.weight || 0); });
  var rows = [], score = 0, answered = 0, tags = {};
  function addTag(t, why) { (tags[t] = tags[t] || []); if (tags[t].indexOf(why) < 0) tags[t].push(why); }
  var resInfo = inputs.country_res ? countryInfo(inputs.country_res) : null;
  model.factors.forEach(function (f) {
    var v = inputs[f.id], row = { f: f, v: v, ans: '', s: null, un: false, info: null }, opt = null;
    if (f.kind === 'country') {
      if (v === '_same' && f.sameScore != null) { row.s = f.sameScore; row.ans = f.same; }
      else {
        var code = v === '_same' ? inputs.country_res : v;
        var ci = code ? countryInfo(code) : null;
        if (ci) {
          row.info = ci; row.s = model.geo.tier_score[ci.tier]; row.ans = ci.name + ' (' + CTL[ci.tier] + ' country)';
          ci.tags.forEach(function (t) { addTag(t, (f.short || f.label) + ': ' + ci.name + ', ' + TAG_TEXT[t]); });
        }
      }
    } else {
      opt = (f.options || []).filter(function (o) { return o.v === v; })[0];
      if (opt) {
        row.s = opt.score; row.ans = opt.label;
        (opt.tags || []).forEach(function (t) { addTag(t, f.label + ': ' + opt.label); });
      }
    }
    if (row.s == null) { row.un = true; row.s = model.unanswered_score; row.ans = 'Not answered (counted as ' + model.unanswered_score + ')'; } else answered++;
    var w = W > 0 ? Math.max(0, +f.weight || 0) / W : 0;
    row.share = w * 100; row.level = (row.s - 1) / 4; row.points = w * row.level * 100;
    score += row.points; rows.push(row);
  });
  score = Math.round(score * 10) / 10;
  var base = tierByScore(score, model.thresholds), tier = base, hits = [], floor = 0;
  model.rules.forEach(function (r) {
    if (r.action === 'off' || !tags[r.tag]) return;
    var h = { rule: r, reasons: tags[r.tag], push: rank(r.action) > rank(base) };
    hits.push(h);
    if (rank(r.action) > rank(tier)) tier = r.action;
    if (r.min && r.min !== 'off') floor = Math.max(floor, rank(r.min));
  });
  hits.forEach(function (h) { h.decisive = h.push && h.rule.action === tier; });
  return { score: score, base: base, tier: tier, rows: rows, hits: hits, tags: tags, answered: answered, total: model.factors.length, floor: floor };
}
function effTier(c, ev) { return c.override ? c.override.tier : ev.tier; }
function checklistFor(ev, tier) {
  return CL.filter(function (it) {
    if (it.tiers.indexOf(tier) < 0) return false;
    if (it.anyTag && !it.anyTag.some(function (t) { return ev.tags[t]; })) return false;
    if (it.notTag && it.notTag.some(function (t) { return ev.tags[t]; })) return false;
    return true;
  });
}
function reviewMonths(tier) {
  if (tier === 'prohibited') return null;
  var m = +MODEL.review_months[tier] || 12, mx = +MODEL.review_max_months[tier] || 60;
  return Math.min(m, mx);
}
function decisionsOf(c) { return c.decisions.slice().sort(function (a, b) { return a.at < b.at ? -1 : 1; }); }
function derive(c) {
  var ev = evaluate(c.inputs), tier = effTier(c, ev), items = checklistFor(ev, tier);
  var done = items.filter(function (it) { return c.checklist[it.id] && c.checklist[it.id].done; });
  var gates = items.filter(function (it) { return it.gate && !(c.checklist[it.id] && c.checklist[it.id].done); });
  var decs = decisionsOf(c), ld = lastOf(decs), status = 'pending';
  if (ld) status = ld.decision === 'approve' ? 'approved' : ld.decision === 'reject' ? 'rejected' : 'escalated';
  var redecide = !!(ld && ld.decision !== 'reject' && ld.tier !== tier);
  if (status === 'approved' && redecide) status = 'redecide';
  var d = { ev: ev, tier: tier, items: items, done: done.length, gates: gates, status: status, lastDecision: ld, review: null, redecide: redecide };
  if (status === 'approved' || status === 'redecide') {
    var last = null;
    decs.forEach(function (x) { if (x.decision === 'approve') last = x.at; });
    (c.reviews || []).forEach(function (r) { if (!last || r.at > last) last = r.at; });
    var m = reviewMonths(tier);
    if (last && m) {
      var next = addMonths(last, m), days = dayNum(next) - dayNum(todayIso());
      d.review = { last: last.slice(0, 10), next: next, months: m, days: days, state: days < 0 ? 'overdue' : days <= 30 ? 'soon' : 'ok' };
    }
  }
  return d;
}
function statusText(d) {
  return { pending: 'Awaiting decision', approved: 'Approved', rejected: 'Rejected', escalated: 'Escalated', redecide: 'Decide again (tier changed)' }[d.status];
}
function needsDecision(d) { return d.status === 'pending' || d.status === 'escalated' || d.status === 'redecide'; }

/* ---------- history ---------- */
function recordHistory(c, note, by) {
  var ev = evaluate(c.inputs);
  c.history.push({
    at: nowIso(), by: by || STATE.actor || '', note: note || '', score: ev.score, computed: ev.tier, tier: effTier(c, ev),
    overridden: !!c.override, model: MODEL._meta.version, answered: ev.answered, total: ev.total, inputs: clone(c.inputs),
    override: c.override ? { tier: c.override.tier, rationale: c.override.rationale } : null
  });
}
function unrecorded(c) {
  var h = lastOf(c.history);
  if (!h) return true;
  return canon(h.inputs) !== canon(c.inputs) || (h.override ? h.override.tier : '') !== (c.override ? c.override.tier : '');
}
function changedFactors(prev, cur) {
  var out = [];
  MODEL.factors.forEach(function (f) { if ((prev || {})[f.id] !== (cur || {})[f.id]) out.push(f.short || f.label); });
  return out;
}

/* ---------- seeding ---------- */
function snapshot(c, inputs, note, by, at) {
  var ev = evaluate(inputs);
  return { at: at, by: by, note: note, score: ev.score, computed: ev.tier, tier: ev.tier, overridden: false, model: MODEL._meta.version, answered: ev.answered, total: ev.total, inputs: clone(inputs), override: null };
}
function seedCustomers() {
  return DEMO.customers.map(function (d) {
    var c = { id: d.id, name: d.name, demo: true, created: addDays(todayIso(), -d.daysAgoCreated), inputs: clone(d.inputs), override: null, history: [], decisions: [], reviews: [], checklist: {} };
    (d.earlier || []).forEach(function (e) { c.history.push(snapshot(c, Object.assign({}, d.inputs, e.patch), e.note, 'Analyst A (demo)', atDaysAgo(e.daysAgo))); });
    (d.decisions || []).forEach(function (x) { c.decisions.push({ at: atDaysAgo(x.daysAgo), by: x.by, decision: x.decision, rationale: x.rationale, tier: null, dd: null, score: null }); });
    (d.reviews || []).forEach(function (r) { c.reviews.push({ at: atDaysAgo(r.daysAgo), kind: r.kind, outcome: r.outcome, by: r.by, note: r.note }); });
    var ld = lastOf(decisionsOf(c)), when = ld ? ld.at : atDaysAgo(d.daysAgoCreated);
    var snap = snapshot(c, c.inputs, ld ? 'Assessment at decision' : 'Customer created', 'Analyst A (demo)', when);
    c.history.push(snap);
    c.decisions.forEach(function (x) { x.tier = snap.tier; x.dd = DDL[snap.tier]; x.score = snap.score; });
    var ev = evaluate(c.inputs), items = checklistFor(ev, snap.tier);
    if (d.checklist === 'all') items.forEach(function (it) { c.checklist[it.id] = { done: true, at: when.slice(0, 10) }; });
    else (d.checklist || []).forEach(function (id) { c.checklist[id] = { done: true, at: when.slice(0, 10) }; });
    return c;
  });
}

/* ---------- csv ---------- */
function csvCell(v) {
  var s = String(v == null ? '' : v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function download(name, text, type) {
  var blob = new Blob(['﻿' + text], { type: type || 'text/csv;charset=utf-8' }), a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
  setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
function exportRegister() {
  var rows = [['reference', 'name', 'demo_data', 'customer_type', 'country_of_residence', 'status', 'score_0_100', 'computed_tier', 'effective_tier', 'override', 'due_diligence_level', 'last_decision', 'last_decision_date', 'last_review', 'next_review', 'review_state', 'checklist_done', 'checklist_total', 'open_required_items', 'pep_status', 'model_version']];
  STATE.customers.forEach(function (c) {
    var d = derive(c), ev = d.ev, ld = d.lastDecision, ct = MODEL.factors.filter(function (f) { return f.id === 'ctype'; })[0], pe = MODEL.factors.filter(function (f) { return f.id === 'pep'; })[0];
    var opt = function (f, v) { var o = f && (f.options || []).filter(function (x) { return x.v === v; })[0]; return o ? o.label : ''; };
    var ci = c.inputs.country_res ? CBY[c.inputs.country_res] : null;
    rows.push([c.id, c.name, c.demo ? 'yes' : 'no', opt(ct, c.inputs.ctype), ci ? ci.name : '', statusText(d), ev.score.toFixed(1), TL[ev.tier], TL[d.tier], c.override ? 'yes' : 'no', DDL[d.tier],
      ld ? ld.decision : '', ld ? ld.at.slice(0, 10) : '', d.review ? d.review.last : '', d.review ? d.review.next : '', d.review ? d.review.state : '', d.done, d.items.length, d.gates.length, opt(pe, c.inputs.pep), MODEL._meta.version]);
  });
  download('regradar-customer-register-' + todayIso() + '.csv', rows.map(function (r) { return r.map(csvCell).join(','); }).join('\r\n'));
  toast('Register exported (' + STATE.customers.length + ' customers)');
}
function exportDecisions() {
  var rows = [['reference', 'customer', 'date', 'decision', 'tier_at_decision', 'due_diligence_level', 'score', 'by', 'rationale']];
  STATE.customers.forEach(function (c) {
    decisionsOf(c).forEach(function (x) { rows.push([c.id, c.name, x.at.slice(0, 10), x.decision, TL[x.tier] || '', x.dd || '', x.score == null ? '' : x.score, x.by, x.rationale]); });
    (c.reviews || []).forEach(function (r) { rows.push([c.id, c.name, r.at.slice(0, 10), 'review (' + r.kind + ')', '', '', '', r.by, r.outcome + '. ' + r.note]); });
  });
  rows.sort(function (a, b) { return a[0] === 'reference' ? -1 : b[0] === 'reference' ? 1 : (a[2] < b[2] ? -1 : 1); });
  download('regradar-decision-log-' + todayIso() + '.csv', rows.map(function (r) { return r.map(csvCell).join(','); }).join('\r\n'));
  toast('Decision log exported');
}

/* ---------- small renderers ---------- */
function tierChip(t, extra) { return '<span class="chip ' + t + '">' + (extra || '') + TL[t] + '</span>'; }
function obLink(it) {
  if (it.ob && OBS[it.ob]) return '<a class="lnk" href="workspace.html?open=' + encodeURIComponent(it.ob) + '">Obligation ' + esc(OBS[it.ob].legal_basis) + ' in Compliance</a>';
  if (it.n) return '<a class="lnk" href="law.html?celex=32024R1624&amp;art=' + esc(it.n) + '">Read Art. ' + esc(it.n) + ' in the law reader</a>';
  if (it.src === 'eba') return '<a class="lnk" href="' + esc(DEF._meta.sources[0].url) + '" rel="noopener">EBA/GL/2024/01 (PDF)</a>';
  return '';
}
function countryOptions() {
  var l = CR.countries.slice().sort(function (a, b) { return a.name < b.name ? -1 : 1; });
  return l.map(function (c) { return '<option value="' + esc(c.code) + '">' + esc(c.name) + ' (' + esc(c.code) + ')</option>'; }).join('');
}
function cinfoHtml(f, inputs) {
  var v = inputs[f.id];
  if (!v) return '';
  var code = v;
  if (v === '_same') {
    if (f.sameScore != null) return '<div class="cinfo">No cross-border corridor. Scores ' + f.sameScore + ' of 5.</div>';
    code = inputs.country_res;
    if (!code) return '<div class="cinfo faint">Select the residence or incorporation country first.</div>';
  }
  var ci = countryInfo(code);
  if (!ci) return '<div class="cinfo faint">Country not found in the data.</div>';
  var i = ci.ind, chips = [];
  if (i.fatf === 'black') chips.push('<span class="chip prohibited">FATF black list</span>');
  else if (i.fatf === 'grey') chips.push('<span class="chip medium">FATF grey list</span>');
  else chips.push('<span class="chip none">Not on FATF lists</span>');
  if (i.eu_hrtc === true) chips.push('<span class="chip high">EU high-risk third country' + (i.eu_hrtc_since ? ' since ' + esc(String(i.eu_hrtc_since).replace(/ /g, ' ')) : '') + '</span>');
  else if (i.eu_hrtc === false) chips.push('<span class="chip none">Not on EU high-risk list</span>');
  else chips.push('<span class="chip none">EU list: no data</span>');
  if (i.eu_tax) chips.push('<span class="chip medium">EU tax list: ' + esc(i.eu_tax) + '</span>');
  if ((i.sanctions || 0) > 0) chips.push('<span class="chip ' + ((i.sanctions || 0) >= 7 ? 'high' : 'none') + '">Sanctions exposure ' + i.sanctions + '/10</span>');
  if (i.cpi != null) chips.push('<span class="chip none">CPI ' + i.cpi + '/100</span>');
  var stale = (CR.stale_indicators || []).filter(function (k) { return k === 'fatf' || k === 'eu_hrtc'; }).length;
  return '<div class="cinfo"><div class="row"><b>' + esc(ci.name) + '</b><span class="chip ' + CTC[ci.tier] + '">Country tier: ' + CTL[ci.tier] + '</span>' +
    (ci.comp != null ? '<span class="mono muted">composite ' + ci.comp.toFixed(1) + ' / 10</span>' : '<span class="muted">no measured indicators, scored as ' + MODEL.geo.tier_score.nodata + ' of 5</span>') + '</div>' +
    '<div class="row" style="margin-top:6px">' + chips.join('') + '</div>' +
    '<div class="faint" style="margin-top:6px;font-size:12.5px">Country data as of ' + esc(CR.as_of) + (stale ? '. FATF and EU lists are last-known values (the latest refresh failed): verify against the official lists.' : '.') + ' <a href="country-risk.html">Country risk page</a></div></div>';
}

/* ---------- dashboard ---------- */
function renderKpis() {
  var ds = STATE.customers.map(function (c) { return { c: c, d: derive(c) }; });
  var hi = ds.filter(function (x) { return (x.d.tier === 'high' || x.d.tier === 'prohibited') && x.d.status !== 'rejected'; }).length;
  var od = ds.filter(function (x) { return x.d.review && x.d.review.state === 'overdue'; }).length;
  var soon = ds.filter(function (x) { return x.d.review && x.d.review.state === 'soon'; }).length;
  var nd = ds.filter(function (x) { return needsDecision(x.d); }).length;
  function k(n, l, flt, warn) {
    return '<div class="kpi' + (warn && n ? ' warn' : '') + '"><button type="button" class="n mono" data-act="flt" data-v="' + flt + '" aria-label="' + n + ' ' + l + ', show in list">' + n + '</button><div class="l">' + l + '</div></div>';
  }
  $('kpis').innerHTML = k(ds.length, 'customers', 'all') + k(hi, 'High or prohibited', 'high') + k(od, 'reviews overdue', 'due', true) + k(soon, 'reviews due in 30 days', 'due') + k(nd, 'awaiting a decision', 'decision', true);
}
function renderDash() {
  var ds = STATE.customers.map(function (c) { return { c: c, d: derive(c) }; });
  var act = ds.filter(function (x) { return x.d.status !== 'rejected'; }), rej = ds.length - act.length, cnt = { low: 0, medium: 0, high: 0, prohibited: 0 };
  act.forEach(function (x) { cnt[x.d.tier]++; });
  var tot = act.length || 1;
  var bar = TIERS.map(function (t) { return cnt[t] ? '<span class="sw ' + t + '" style="width:' + (cnt[t] / tot * 100) + '%;height:100%;border-radius:0"></span>' : ''; }).join('');
  var legend = TIERS.map(function (t) { return '<button type="button" data-act="flt" data-v="' + t + '"><span class="sw ' + t + '"></span>' + TL[t] + ' <b class="mono">' + cnt[t] + '</b></button>'; }).join('');
  var sched = ds.filter(function (x) { return x.d.review; }).sort(function (a, b) { return a.d.review.days - b.d.review.days; }).slice(0, 8);
  var list = sched.length ? sched.map(function (x) {
    var r = x.d.review, txt = r.state === 'overdue' ? 'Overdue by ' + (-r.days) + (r.days === -1 ? ' day' : ' days') : r.days === 0 ? 'Due today' : 'In ' + r.days + (r.days === 1 ? ' day' : ' days');
    return '<button type="button" data-act="open" data-id="' + esc(x.c.id) + '" data-sub="activity"><span class="nm">' + esc(x.c.name) + '</span><span class="chip ' + (r.state === 'overdue' ? 'high' : r.state === 'soon' ? 'medium' : 'none') + '">' + esc(txt) + ' (' + esc(fmt(r.next)) + ')</span></button>';
  }).join('') : '<div class="empty">No scheduled reviews yet. Approve a customer to start the review clock.</div>';
  $('dash').innerHTML =
    '<div class="card2"><h2>Tier distribution</h2><div class="dist" role="img" aria-label="' + TIERS.map(function (t) { return cnt[t] + ' ' + TL[t]; }).join(', ') + '">' + bar + '</div><div class="legend">' + legend + '</div>' +
    '<p class="faint" style="margin-top:6px;font-size:12.5px">Effective tier of ' + act.length + ' active customers' + (rej ? ', ' + rej + ' rejected not counted' : '') + '.</p></div>' +
    '<div class="card2"><h2>Reviews due (next 8)</h2><div class="due-list">' + list + '</div></div>';
}

/* ---------- list ---------- */
function visibleCustomers() {
  var q = UI.q.trim().toLowerCase(), out = [];
  STATE.customers.forEach(function (c) {
    var d = derive(c);
    if (q && (c.name + ' ' + c.id).toLowerCase().indexOf(q) < 0) return;
    if (UI.flt === 'due' && !(d.review && d.review.state !== 'ok')) return;
    if (UI.flt === 'decision' && !needsDecision(d)) return;
    if (TIERS.indexOf(UI.flt) >= 0 && d.tier !== UI.flt) return;
    out.push({ c: c, d: d });
  });
  out.sort(function (a, b) {
    function u(x) { return x.d.review && x.d.review.state === 'overdue' ? 0 : needsDecision(x.d) ? 1 : x.d.review && x.d.review.state === 'soon' ? 2 : 3; }
    var ua = u(a), ub = u(b);
    if (ua !== ub) return ua - ub;
    if (rank(a.d.tier) !== rank(b.d.tier)) return rank(b.d.tier) - rank(a.d.tier);
    return a.c.name < b.c.name ? -1 : 1;
  });
  return out;
}
function renderFilters() {
  var f = [['all', 'All'], ['low', 'Low'], ['medium', 'Medium'], ['high', 'High'], ['prohibited', 'Prohibited'], ['due', 'Review due'], ['decision', 'Needs decision']];
  $('filters').innerHTML = f.map(function (x) { return '<button type="button" class="chip" data-act="flt" data-v="' + x[0] + '" aria-pressed="' + (UI.flt === x[0]) + '">' + x[1] + '</button>'; }).join('');
}
function renderItems() {
  var l = visibleCustomers();
  if (!l.length) { $('items').innerHTML = '<div class="empty">' + (STATE.customers.length ? 'No customers match these filters.' : 'No customers yet. Use New customer to add a fictional one, or reset the demo data.') + '</div>'; return; }
  $('items').innerHTML = l.map(function (x) {
    var c = x.c, d = x.d, sub = statusText(d), warn = '';
    if (d.review && d.review.state === 'overdue') warn = ' · review overdue';
    else if (d.review && d.review.state === 'soon') warn = ' · review soon';
    return '<button type="button" class="item" data-act="open" data-id="' + esc(c.id) + '" aria-current="' + (UI.sel === c.id) + '"><span><span class="a">' + esc(c.id) + (c.demo ? ' · demo' : '') + '</span><div class="t">' + esc(c.name) + '</div><div class="s">' + esc(sub + warn) + '</div></span>' + tierChip(d.tier) + '</button>';
  }).join('');
}

/* ---------- detail ---------- */
function cur() { return STATE.customers.filter(function (c) { return c.id === UI.sel; })[0] || null; }
function renderDetail() {
  var c = cur();
  if (!c) {
    $('detail').innerHTML = '<div class="empty">' + (STATE.customers.length ? 'Select a customer to open the file.' : 'Create a customer to start.') + '</div>';
    return;
  }
  var d = derive(c);
  renderDetailShell(c, d, d.ev);
  renderSub();
}
function renderSub() {
  var c = cur(); if (!c) return;
  if (UI.sub === 'assess') renderAssess(c);
  else if (UI.sub === 'checklist') renderChecklist(c);
  else renderActivity(c);
}

/* assessment */
function renderAssess(c) {
  var html = '<div class="asm"><div id="formBox">';
  MODEL.groups.forEach(function (g) {
    html += '<fieldset class="fs"><legend>' + esc(g.label) + '</legend><div class="eba">Basis: ' + esc(g.eba) + '</div>';
    MODEL.factors.filter(function (f) { return f.group === g.id; }).forEach(function (f) {
      var id = 'f-' + f.id, v = c.inputs[f.id] || '', opts = '<option value="">Select an answer</option>';
      if (f.kind === 'country') {
        if (f.same) opts += '<option value="_same"' + (v === '_same' ? ' selected' : '') + '>' + esc(f.same) + '</option>';
        opts += COUNTRY_OPTS.replace('value="' + esc(v) + '"', 'value="' + esc(v) + '" selected');
      } else {
        (f.options || []).forEach(function (o) { opts += '<option value="' + esc(o.v) + '"' + (v === o.v ? ' selected' : '') + '>' + esc(o.label) + '</option>'; });
      }
      html += '<div class="q"><label for="' + id + '">' + esc(f.label) + '</label><select class="sel" id="' + id + '" data-f="' + esc(f.id) + '"' + (f.help ? ' aria-describedby="' + id + '-h"' : '') + '>' + opts + '</select>' +
        (f.help ? '<div class="help" id="' + id + '-h">' + esc(f.help) + '</div>' : '') + (f.kind === 'country' ? '<div id="ci-' + f.id + '">' + cinfoHtml(f, c.inputs) + '</div>' : '') + '</div>';
    });
    html += '</fieldset>';
  });
  html += '</div><div class="scorebox" id="scoreBox"></div><div class="minibar" id="miniBar" aria-hidden="true"></div></div><div class="vh" id="scoreLive" role="status"></div>';
  $('subBody').innerHTML = html;
  renderScoreBox(c);
}
function renderScoreBox(c) {
  var d = derive(c), ev = d.ev, th = MODEL.thresholds, h = '';
  h += '<div class="score-card"><div class="bigscore"><span class="num mono">' + ev.score.toFixed(1) + '</span><span class="muted">of 100</span>' + tierChip(d.tier) + '</div>' +
    '<div style="margin-top:4px;font-weight:600">' + esc(DDL[d.tier]) + '</div>' +
    '<div class="gauge" style="--lo:' + th.medium + '%;--hi:' + th.high + '%" aria-hidden="true"><i style="left:' + Math.min(100, ev.score) + '%"></i></div>' +
    '<div class="gscale"><span>0</span><span>Medium from ' + th.medium + '</span><span>High from ' + th.high + '</span><span>100</span></div>' +
    '<p class="faint" style="margin-top:8px;font-size:12.5px">' + ev.answered + ' of ' + ev.total + ' factors answered. Unanswered factors count as ' + MODEL.unanswered_score + ' of 5 until you answer them.</p>' +
    '<p class="faint" style="font-size:12.5px">Model: ' + esc(MODEL._meta.version) + (STATE.model ? ' (edited on this device)' : ' (default, configure for your firm)') + '</p></div>';
  var mb = $('miniBar'); if (mb) mb.innerHTML = '<span><span class="num mono">' + ev.score.toFixed(1) + '</span> / 100</span>' + tierChip(d.tier) + '<span>' + esc(DDL[d.tier]) + '</span>';
  /* why */
  h += '<div><h3 class="sec">Why this tier</h3><ul class="hits">';
  h += '<li>Score <b class="mono">' + ev.score.toFixed(1) + '</b> falls in the <b>' + TL[ev.base] + '</b> band' +
    (ev.base === 'low' ? ' (below ' + th.medium + ')' : ev.base === 'medium' ? ' (' + th.medium + ' to below ' + th.high + ')' : ' (' + th.high + ' or more)') + '.' +
    (ev.base !== 'high' ? '<div class="why">' + (ev.base === 'low' ? (th.medium - ev.score).toFixed(1) + ' points below Medium.' : (th.high - ev.score).toFixed(1) + ' points below High.') + '</div>' : '') + '</li>';
  if (!ev.hits.length) h += '<li>No rule is triggered by the current answers.</li>';
  ev.hits.forEach(function (x) {
    var cls = x.push ? ' class="push' + (x.rule.action === 'prohibited' ? ' p' : '') + '"' : '';
    h += '<li' + cls + '><b>' + (x.push ? 'Rule pushed the tier to ' + TL[x.rule.action] + ': ' : 'Rule confirms ' + TL[x.rule.action] + ' minimum: ') + esc(x.rule.label) + '</b><div class="why">' + esc(x.reasons.join('; ')) + '</div><div class="why">' + esc(x.rule.basis) + '</div></li>';
  });
  if (c.override) h += '<li class="push"><b>Overridden to ' + TL[c.override.tier] + '</b><div class="why">' + esc(c.override.rationale) + ' (by ' + esc(c.override.by) + ', ' + esc(fmt(c.override.at)) + (c.override.approver ? ', approved by ' + esc(c.override.approver) : '') + ')</div></li>';
  h += '</ul></div>';
  /* breakdown */
  var rows = ev.rows.slice().sort(function (a, b) { return b.points - a.points; });
  h += '<div><h3 class="sec">Factor contributions, largest first</h3><ol class="bd" aria-label="Ranked factor contributions">' + rows.map(function (r) {
    var cls = r.level >= .75 ? 'hi' : r.level >= .5 ? 'mid' : '';
    return '<li><span class="nm">' + esc(r.f.short || r.f.label) + '</span><span class="mono">+' + r.points.toFixed(1) + ' <span class="faint">of ' + r.share.toFixed(0) + ' max</span></span>' +
      '<span class="bar" aria-hidden="true"><i class="' + cls + '" style="width:' + (r.level * 100) + '%"></i></span><span class="ans">' + esc(r.ans) + '</span></li>';
  }).join('') + '</ol></div>';
  $('scoreBox').innerHTML = h;
}
function updateAfterAnswer(fid) {
  var c = cur(); if (!c) return;
  save();
  MODEL.factors.filter(function (x) { return x.kind === 'country'; }).forEach(function (cf) {
    var el = $('ci-' + cf.id); if (el && (cf.id === fid || fid === 'country_res')) el.innerHTML = cinfoHtml(cf, c.inputs);
  });
  renderScoreBox(c);
  var d = derive(c);
  $('scoreLive').textContent = 'Score ' + d.ev.score.toFixed(1) + ', ' + TL[d.tier] + ' tier, ' + DDL[d.tier];
  refreshHeader(c);
  renderKpis(); renderDash(); renderItems();
}
function refreshHeader(c) {
  /* rebuild the header block (chips, actions, alerts, tab labels) but keep the form and its focus */
  var body = $('subBody'); if (!body) return;
  var active = document.activeElement && document.activeElement.id, scroll = window.pageYOffset;
  var d = derive(c);
  body.parentNode.removeChild(body);
  renderDetailShell(c, d, d.ev);
  var fresh = $('subBody'); fresh.parentNode.replaceChild(body, fresh);
  body.setAttribute('aria-labelledby', 'stab-' + UI.sub);
  if (active) { var a = $(active); if (a) a.focus({ preventScroll: true }); }
  window.scrollTo(0, scroll);
}
function renderDetailShell(c, d, ev) {
  var chips = tierChip(d.tier) + '<span class="chip">' + esc(DDL[d.tier]) + '</span><span class="chip ' + (d.status === 'approved' ? 'low' : d.status === 'rejected' ? 'high' : d.status === 'pending' ? 'none' : 'medium') + '">' + esc(statusText(d)) + '</span>';
  if (c.override) chips += '<span class="chip medium">Overridden from ' + TL[ev.tier] + '</span>';
  if (d.review) chips += '<span class="chip ' + (d.review.state === 'overdue' ? 'high' : d.review.state === 'soon' ? 'medium' : 'none') + '">Next review ' + esc(fmt(d.review.next)) + (d.review.state === 'overdue' ? ' (overdue)' : '') + '</span>';
  if (c.demo) chips += '<span class="chip demo">Fictional demo customer</span>';
  var unrec = unrecorded(c);
  $('detail').innerHTML =
    '<div class="d-top"><div><div class="d-ref">' + esc(c.id) + '</div><h2>' + esc(c.name) + '</h2></div></div>' +
    '<div class="d-chips">' + chips + '</div>' +
    '<div class="actions">' +
      '<button type="button" class="btn pri sm" data-act="decide">Record decision</button>' +
      (unrec ? '<button type="button" class="btn sm" data-act="record" id="btnRecord">Record assessment in history</button>' : '') +
      '<button type="button" class="btn sm" data-act="override">' + (c.override ? 'Edit or remove override' : 'Override tier') + '</button>' +
      ((d.status === 'approved' || d.status === 'redecide') ? '<button type="button" class="btn sm" data-act="review">Record review</button>' : '') +
      '<button type="button" class="btn sm" data-act="file">Customer risk file (print)</button>' +
      '<button type="button" class="btn sm danger" data-act="delete">Delete</button>' +
    '</div>' +
    (unrec ? '<div class="alert warn" style="margin-top:12px"><b>Changes not yet in the risk history.</b>The score reflects your latest answers. Record the assessment to add a dated entry to the history (a decision also records it).</div>' : '') +
    (d.redecide ? '<div class="alert warn" style="margin-top:12px"><b>The tier changed since the last decision.</b>It was ' + esc(TL[d.lastDecision.tier] || '') + ' when decided and is ' + esc(TL[d.tier]) + ' now. Record a new decision.</div>' : '') +
    '<div class="subtabs" role="tablist" aria-label="Customer file sections" id="subTabs">' +
      [['assess', 'Risk assessment'], ['checklist', 'Due diligence checklist (' + d.done + '/' + d.items.length + ')'], ['activity', 'Decisions, reviews and history']].map(function (s) {
        return '<button type="button" role="tab" id="stab-' + s[0] + '" aria-selected="' + (UI.sub === s[0]) + '" aria-controls="subBody" data-sub="' + s[0] + '" tabindex="' + (UI.sub === s[0] ? 0 : -1) + '">' + s[1] + '</button>';
      }).join('') + '</div>' +
    '<div id="subBody" role="tabpanel" aria-labelledby="stab-' + UI.sub + '"></div>';
}

/* checklist */
function renderChecklist(c) {
  var d = derive(c), items = d.items, pct = items.length ? Math.round(100 * d.done / items.length) : 0;
  var h = '<div class="alert ' + (d.tier === 'prohibited' ? 'proh' : d.tier === 'high' ? 'bad' : 'ok') + '"><b>' + esc(DDL[d.tier]) + ' (' + TL[d.tier] + ' risk)</b>' +
    (d.tier === 'prohibited' ? 'The checklist covers declining the relationship, recording why, and escalating. Do not onboard.' :
      d.tier === 'high' ? 'Enhanced measures apply on top of standard CDD (AMLR Art. 34, Art. 26(2)(a) for the 12-month review).' :
        d.tier === 'low' ? 'Standard CDD applies. Simplified measures are optional under AMLR Art. 33 and need documented lower-risk factors.' : 'Standard CDD applies.') + '</div>';
  h += '<div><b class="mono">' + d.done + ' of ' + items.length + '</b> items done' + (d.gates.length ? ', <span class="gatebadge">' + d.gates.length + ' required item' + (d.gates.length === 1 ? '' : 's') + ' open before approval</span>' : '') + '<div class="prog" role="img" aria-label="' + pct + ' percent complete"><i style="width:' + pct + '%"></i></div></div>';
  var bySec = {};
  items.forEach(function (it) { (bySec[it.section] = bySec[it.section] || []).push(it); });
  Object.keys(bySec).sort(function (a, b) { var ia = SECTION_ORDER.indexOf(a), ib = SECTION_ORDER.indexOf(b); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); }).forEach(function (sec) {
    h += '<div class="ck-sec">' + esc(sec) + '</div><ul class="ck">';
    bySec[sec].forEach(function (it) {
      var st = c.checklist[it.id], dn = st && st.done;
      h += '<li class="ck-it' + (dn ? ' done' : '') + '"><div class="ck-row"><input type="checkbox" id="ck-' + it.id + '" data-ck="' + it.id + '"' + (dn ? ' checked' : '') + '><div><label for="ck-' + it.id + '">' + esc(it.task) + (it.gate ? ' <span class="gatebadge">(required to approve)</span>' : '') + '</label>' +
        '<div class="ck-meta"><span class="chip">' + esc(it.art) + '</span>' + (it.art === 'Good practice' ? '<span class="faint">Not a cited obligation</span>' : '') + obLink(it) + (dn ? '<span class="faint">Done ' + esc(fmt(st.at)) + '</span>' : '') + '</div>' +
        (it.quote ? '<details><summary>Show the verified text</summary><blockquote>“' + esc(it.quote) + '”<div class="faint" style="font-family:var(--font);font-size:12.5px;margin-top:4px">' + esc(it.art) + (it.src === 'eba' ? '' : ', Regulation (EU) 2024/1624') + '</div></blockquote></details>' : '') + '</div></div></li>';
    });
    h += '</ul>';
  });
  $('subBody').innerHTML = h;
}

/* activity */
function renderActivity(c) {
  var d = derive(c), h = '';
  h += '<h3 class="sec">Review schedule</h3>';
  if (d.review) {
    var r = d.review;
    h += '<div class="alert ' + (r.state === 'overdue' ? 'bad' : r.state === 'soon' ? 'warn' : 'ok') + '"><b>Next review ' + esc(fmt(r.next)) + ' ' + (r.state === 'overdue' ? '(overdue by ' + (-r.days) + ' days)' : '(in ' + r.days + ' days)') + '</b>Last approval or review ' + esc(fmt(r.last)) + '. Frequency for ' + TL[d.tier] + ' risk: every ' + r.months + ' months (default, configure for your firm). AMLR Art. 26(2) caps the interval at 1 year for higher-risk customers and 5 years for all others. A change of circumstances or a relevant new fact also triggers a review (Art. 26(3)).</div>';
  } else {
    h += '<p class="muted">' + (d.status === 'rejected' ? 'Rejected customers are not scheduled for review.' : d.tier === 'prohibited' ? 'No schedule: the relationship is not to be maintained at this tier.' : 'The review clock starts when the customer is approved.') + '</p>';
  }
  h += '<h3 class="sec">Decision log</h3>';
  var decs = decisionsOf(c).slice().reverse();
  var revs = (c.reviews || []).map(function (r) { return { at: r.at, kind: 'review', r: r }; });
  var all = decs.map(function (x) { return { at: x.at, kind: 'dec', x: x }; }).concat(revs).sort(function (a, b) { return a.at < b.at ? 1 : -1; });
  if (!all.length) h += '<p class="muted">No decisions yet. Use Record decision once the checklist is done.</p>';
  else h += '<ul class="tl">' + all.map(function (e) {
    if (e.kind === 'dec') { var x = e.x; return '<li class="' + esc(x.decision) + '"><div class="when">' + esc(fmt(x.at)) + ' · ' + esc(x.by) + '</div><div class="what">' + ({ approve: 'Approved', reject: 'Rejected', escalate: 'Escalated' }[x.decision]) + ' at ' + esc(TL[x.tier] || '') + ' risk (' + esc(x.dd || '') + ')</div><div class="why">' + esc(x.rationale) + '</div></li>'; }
    var r = e.r; return '<li><div class="when">' + esc(fmt(r.at)) + ' · ' + esc(r.by) + '</div><div class="what">' + (r.kind === 'trigger' ? 'Trigger-event review' : 'Periodic review') + ': ' + esc(r.outcome) + '</div><div class="why">' + esc(r.note) + '</div></li>';
  }).join('') + '</ul>';
  h += '<h3 class="sec">Risk history</h3><div class="tw"><table class="tbl"><thead><tr><th scope="col">Date</th><th scope="col">Score</th><th scope="col">Tier</th><th scope="col">By</th><th scope="col">What changed</th></tr></thead><tbody>';
  var hist = c.history.slice();
  hist.slice().reverse().forEach(function (e, idx) {
    var prev = hist[hist.length - 2 - idx], chg = prev ? changedFactors(prev.inputs, e.inputs) : [];
    h += '<tr><td class="mono">' + esc(fmt(e.at)) + '</td><td class="mono">' + e.score.toFixed(1) + '</td><td>' + tierChip(e.tier) + (e.overridden ? ' <span class="faint">override</span>' : '') + '</td><td>' + esc(e.by) + '</td><td>' + esc(e.note) + (chg.length ? '<div class="faint">Answers changed: ' + esc(chg.join(', ')) + '</div>' : '') + '<div class="faint">' + e.answered + '/' + e.total + ' answered · model ' + esc(e.model) + '</div></td></tr>';
  });
  h += '</tbody></table></div>';
  $('subBody').innerHTML = h;
}

/* ---------- dialogs ---------- */
var lastOpener = null;
function openDlg(html, wide) {
  var dl = $('dlg'); lastOpener = document.activeElement;
  dl.className = wide ? 'wide' : '';
  dl.innerHTML = '<div class="dlg">' + html + '</div>';
  if (!dl.open) dl.showModal();
  var f = dl.querySelector('input:not([type=hidden]),textarea,select'); if (f) f.focus();
}
function closeDlg() { var dl = $('dlg'); if (dl.open) dl.close(); }
function formErr(msg) {
  var e = $('dlg').querySelector('.err');
  if (!e) { e = document.createElement('div'); e.className = 'err'; e.setAttribute('role', 'alert'); $('dlg').querySelector('.foot').insertAdjacentElement('beforebegin', e); }
  e.textContent = msg;
}
function actorField() {
  return '<div class="row"><label for="d-by">Your name or role (use an invented name or a role, not a real person)</label><input class="in" id="d-by" maxlength="40" value="' + esc(STATE.actor) + '" autocomplete="off"></div>';
}
function readActor() { var v = $('d-by').value.trim(); if (!v) return null; STATE.actor = v; return v; }

function dlgNew() {
  var next = 1001; STATE.customers.forEach(function (c) { var n = parseInt(c.id.replace(/\D/g, ''), 10); if (n >= next) next = n + 1; });
  var ctype = MODEL.factors.filter(function (f) { return f.id === 'ctype'; })[0];
  openDlg('<h2 id="dlgTitle">New customer</h2><p class="muted">Use an invented name only. You can add the answers on the next screen.</p>' +
    '<div class="row"><label for="n-name">Customer name (fictional)</label><input class="in" id="n-name" maxlength="80" autocomplete="off" style="width:100%"></div>' +
    '<div class="row"><label for="n-ref">Reference</label><input class="in" id="n-ref" value="CUS-' + next + '" maxlength="20" style="width:100%"></div>' +
    '<div class="row"><label for="n-type">Customer type</label><select class="sel" id="n-type"><option value="">Select later</option>' + ctype.options.map(function (o) { return '<option value="' + esc(o.v) + '">' + esc(o.label) + '</option>'; }).join('') + '</select></div>' +
    '<div class="row"><label for="n-cty">Country of residence or incorporation</label><select class="sel" id="n-cty"><option value="">Select later</option>' + COUNTRY_OPTS + '</select></div>' +
    '<div class="foot"><button type="button" class="btn" data-act="dlg-cancel">Cancel</button><button type="button" class="btn pri" data-act="new-ok">Create customer</button></div>');
}
function newOk() {
  var name = $('n-name').value.trim(), ref = $('n-ref').value.trim();
  if (!name) return formErr('Enter a name (an invented one).');
  if (!ref) return formErr('Enter a reference.');
  if (STATE.customers.some(function (c) { return c.id === ref; })) return formErr('That reference is already used.');
  var inputs = {}; if ($('n-type').value) inputs.ctype = $('n-type').value; if ($('n-cty').value) inputs.country_res = $('n-cty').value;
  var c = { id: ref, name: name, demo: false, created: todayIso(), inputs: inputs, override: null, history: [], decisions: [], reviews: [], checklist: {} };
  recordHistory(c, 'Customer created');
  STATE.customers.push(c); save(); closeDlg();
  UI.sel = c.id; UI.sub = 'assess'; UI.flt = 'all'; UI.q = ''; $('q').value = '';
  renderAll(); toast('Customer created. Answer the risk factors to score it.');
}

function dlgDecide() {
  var c = cur(); if (!c) return;
  var d = derive(c), sug = d.tier === 'prohibited' ? 'reject' : 'approve';
  openDlg('<h2 id="dlgTitle">Record decision</h2><p class="muted">' + esc(c.name) + ': ' + TL[d.tier] + ' risk, ' + esc(DDL[d.tier]) + ', score ' + d.ev.score.toFixed(1) + '.</p>' +
    '<div class="row" role="radiogroup" aria-labelledby="dec-l"><span class="ql" id="dec-l">Decision</span>' +
    [['approve', 'Approve', 'Onboard or continue the relationship at this tier.'], ['reject', 'Reject', 'Decline or terminate. The reasons are recorded.'], ['escalate', 'Escalate', 'Send to the MLRO or senior management for a decision.']].map(function (o) {
      return '<div class="radio"><input type="radio" name="dec" id="dec-' + o[0] + '" value="' + o[0] + '"' + (o[0] === sug ? ' checked' : '') + '><label for="dec-' + o[0] + '">' + o[1] + '<small>' + o[2] + '</small></label></div>';
    }).join('') + '</div>' +
    '<div id="blockers" aria-live="polite"></div>' +
    '<div class="row"><label for="d-why">Rationale (required, at least 15 characters)</label><textarea class="in" id="d-why" maxlength="800"></textarea></div>' + actorField() +
    '<div class="foot"><button type="button" class="btn" data-act="dlg-cancel">Cancel</button><button type="button" class="btn pri" data-act="decide-ok" id="decideOk">Save decision</button></div>');
  updateBlockers();
}
function blockersFor(c, d, decision) {
  var b = [];
  if (decision !== 'approve') return b;
  if (d.tier === 'prohibited') b.push('The effective tier is Prohibited: this customer cannot be approved. Reject, escalate, or document an override with the MLRO approver.');
  if (d.ev.answered < d.ev.total) b.push((d.ev.total - d.ev.answered) + ' risk factor' + (d.ev.total - d.ev.answered === 1 ? ' is' : 's are') + ' still unanswered.');
  if (d.gates.length) b.push('Required checklist items are open: ' + d.gates.map(function (g) { return g.task; }).join('; ') + '.');
  return b;
}
function updateBlockers() {
  var c = cur(); if (!c || !$('blockers')) return;
  var d = derive(c), sel = $('dlg').querySelector('input[name=dec]:checked'), dec = sel ? sel.value : 'approve', b = blockersFor(c, d, dec);
  $('blockers').innerHTML = b.length ? '<div class="alert bad" style="margin-top:12px"><b>Cannot approve yet</b><ul style="margin-left:18px">' + b.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>' : '';
  $('decideOk').disabled = b.length > 0;
}
function decideOk() {
  var c = cur(), d = derive(c), sel = $('dlg').querySelector('input[name=dec]:checked'), dec = sel.value, why = $('d-why').value.trim(), by = readActor();
  if (blockersFor(c, d, dec).length) return;
  if (why.length < 15) return formErr('A rationale of at least 15 characters is required.');
  if (!by) return formErr('Enter your name or role.');
  if (unrecorded(c)) recordHistory(c, 'Recorded with decision', by);
  c.decisions.push({ at: nowIso(), by: by, decision: dec, rationale: why, tier: d.tier, dd: DDL[d.tier], score: d.ev.score });
  save(); closeDlg(); UI.sub = 'activity'; renderAll(); toast('Decision recorded: ' + dec);
}

function dlgOverride() {
  var c = cur(); if (!c) return;
  var d = derive(c), ev = d.ev, o = c.override;
  openDlg('<h2 id="dlgTitle">Override the tier</h2><p class="muted">Model result: <b>' + TL[ev.tier] + '</b> (score ' + ev.score.toFixed(1) + '). ' + (ev.floor > 0 ? 'A rule anchored in the AMLR sets a minimum of <b>' + TL[TIERS[ev.floor]] + '</b>: tiers below it are not available.' : 'No legal minimum applies to this customer.') + '</p>' +
    '<div class="row"><label for="o-tier">Tier to apply</label><select class="sel" id="o-tier">' + TIERS.map(function (t) {
      return '<option value="' + t + '"' + (rank(t) < ev.floor ? ' disabled' : '') + ((o ? o.tier : ev.tier) === t ? ' selected' : '') + '>' + TL[t] + (t === ev.tier ? ' (model result)' : '') + (rank(t) < ev.floor ? ' (below legal minimum)' : '') + '</option>';
    }).join('') + '</select></div>' +
    '<div class="row"><label for="o-why">Rationale (required: 15 characters to raise, 30 to lower the tier)</label><textarea class="in" id="o-why" maxlength="800">' + esc(o ? o.rationale : '') + '</textarea></div>' +
    '<div class="row"><label for="o-app">Approver, required when lowering the tier (MLRO or senior management role)</label><input class="in" id="o-app" maxlength="40" style="width:100%" value="' + esc(o && o.approver ? o.approver : '') + '"></div>' + actorField() +
    '<div class="foot">' + (o ? '<button type="button" class="btn danger" data-act="override-clear">Remove override</button>' : '') + '<button type="button" class="btn" data-act="dlg-cancel">Cancel</button><button type="button" class="btn pri" data-act="override-ok">Apply override</button></div>');
}
function overrideOk() {
  var c = cur(), ev = evaluate(c.inputs), tier = $('o-tier').value, why = $('o-why').value.trim(), app = $('o-app').value.trim(), by = readActor();
  if (tier === ev.tier) return formErr('That is the model result already. To keep it, remove the override instead.');
  if (rank(tier) < ev.floor) return formErr('That tier is below the legal minimum for this customer.');
  var lower = rank(tier) < rank(ev.tier);
  if (why.length < (lower ? 30 : 15)) return formErr('The rationale needs at least ' + (lower ? 30 : 15) + ' characters.');
  if (lower && !app) return formErr('Name the approver (MLRO or senior management) when lowering the tier.');
  if (!by) return formErr('Enter your name or role.');
  c.override = { tier: tier, rationale: why, approver: app, by: by, at: nowIso() };
  recordHistory(c, 'Override to ' + TL[tier] + ': ' + why, by);
  save(); closeDlg(); renderAll(); toast('Override applied');
}
function overrideClear() {
  var c = cur(); c.override = null; recordHistory(c, 'Override removed');
  save(); closeDlg(); renderAll(); toast('Override removed');
}

function dlgReview() {
  var c = cur(); if (!c) return;
  openDlg('<h2 id="dlgTitle">Record a review</h2><p class="muted">' + esc(c.name) + '. Re-check your answers first (Risk assessment), then log the review here. This resets the review clock.</p>' +
    '<div class="row"><label for="r-kind">Type</label><select class="sel" id="r-kind"><option value="periodic">Periodic review</option><option value="trigger">Trigger event (change of circumstances or new relevant fact)</option></select></div>' +
    '<div class="row"><label for="r-out">Outcome</label><select class="sel" id="r-out"><option>No change to the risk profile</option><option>Information updated, tier unchanged</option><option>Tier changed after re-assessment</option><option>Escalated to the MLRO</option></select></div>' +
    '<div class="row"><label for="r-note">What you checked (required, at least 15 characters)</label><textarea class="in" id="r-note" maxlength="800"></textarea></div>' + actorField() +
    '<div class="foot"><button type="button" class="btn" data-act="dlg-cancel">Cancel</button><button type="button" class="btn pri" data-act="review-ok">Save review</button></div>');
}
function reviewOk() {
  var c = cur(), note = $('r-note').value.trim(), by = readActor();
  if (note.length < 15) return formErr('Describe what you checked (at least 15 characters).');
  if (!by) return formErr('Enter your name or role.');
  var kind = $('r-kind').value, out = $('r-out').value;
  if (unrecorded(c)) recordHistory(c, 'Recorded with review', by);
  c.reviews.push({ at: nowIso(), kind: kind, outcome: out, by: by, note: note });
  save(); closeDlg(); UI.sub = 'activity'; renderAll(); toast('Review recorded. Next review date updated.');
}
function dlgConfirm(title, msg, act) {
  openDlg('<h2 id="dlgTitle">' + esc(title) + '</h2><p>' + esc(msg) + '</p><div class="foot"><button type="button" class="btn" data-act="dlg-cancel">Cancel</button><button type="button" class="btn pri" data-act="' + act + '">Confirm</button></div>');
}

/* ---------- print file ---------- */
function buildFile(c, withId) {
  var d = derive(c), ev = d.ev, h = '';
  h += '<h1' + (withId ? ' id="fileTitle"' : '') + '>Customer risk file</h1><div class="small">Generated ' + esc(fmt(todayIso())) + ' by RegRadar (prototype). Model ' + esc(MODEL._meta.version) + '.</div>';
  if (c.demo) h += '<div class="demo">Fictional demo customer of the fictional bank CF Bank. Not a real person or company.</div>';
  h += '<div class="meta"><div><b>Customer:</b> ' + esc(c.name) + '</div><div><b>Reference:</b> ' + esc(c.id) + '</div><div><b>Status:</b> ' + esc(statusText(d)) + '</div><div><b>Opened:</b> ' + esc(fmt(c.created)) + '</div></div>';
  h += '<h2>1. Result</h2><p class="big">Score ' + ev.score.toFixed(1) + ' / 100 &nbsp; <span class="t ' + d.tier + '">' + TL[d.tier] + '</span> &nbsp; ' + esc(DDL[d.tier]) + '</p>';
  h += '<p class="small">Bands: Medium from ' + MODEL.thresholds.medium + ', High from ' + MODEL.thresholds.high + ' (default, configure for your firm). Model result before rules: ' + TL[ev.base] + '. ' + ev.answered + ' of ' + ev.total + ' factors answered.</p>';
  if (c.override) h += '<p><b>Override:</b> ' + TL[ev.tier] + ' to ' + TL[c.override.tier] + ' by ' + esc(c.override.by) + ' on ' + esc(fmt(c.override.at)) + (c.override.approver ? ', approver ' + esc(c.override.approver) : '') + '. Rationale: ' + esc(c.override.rationale) + '</p>';
  if (ev.hits.length) h += '<p><b>Rules triggered:</b></p><ul style="margin-left:18px">' + ev.hits.map(function (x) { return '<li>' + esc(x.rule.label) + ' (minimum ' + TL[x.rule.action] + '): ' + esc(x.reasons.join('; ')) + '. ' + esc(x.rule.basis) + '</li>'; }).join('') + '</ul>';
  h += '<h2>2. Risk factors, largest contribution first</h2><table class="tbl"><thead><tr><th scope="col">Factor</th><th scope="col">Answer</th><th scope="col">Score (1 to 5)</th><th scope="col">Weight</th><th scope="col">Points</th></tr></thead><tbody>';
  ev.rows.slice().sort(function (a, b) { return b.points - a.points; }).forEach(function (r) { h += '<tr><td>' + esc(r.f.label) + '</td><td>' + esc(r.ans) + '</td><td>' + r.s + '</td><td>' + r.share.toFixed(0) + '%</td><td>' + r.points.toFixed(1) + '</td></tr>'; });
  h += '</tbody></table>';
  h += '<h2>3. Geography (Country risk data as of ' + esc(CR.as_of) + ')</h2><table class="tbl"><thead><tr><th scope="col">Role</th><th scope="col">Country</th><th scope="col">Tier</th><th scope="col">Listings</th></tr></thead><tbody>';
  ev.rows.filter(function (r) { return r.f.kind === 'country'; }).forEach(function (r) {
    if (r.info) { var i = r.info.ind, l = []; if (i.fatf) l.push('FATF ' + i.fatf + ' list'); if (i.eu_hrtc === true) l.push('EU high-risk third country'); if (i.eu_tax) l.push('EU tax list ' + i.eu_tax); if ((i.sanctions || 0) > 0) l.push('sanctions exposure ' + i.sanctions + '/10'); h += '<tr><td>' + esc(r.f.short) + '</td><td>' + esc(r.info.name) + '</td><td>' + CTL[r.info.tier] + '</td><td>' + esc(l.join(', ') || 'none') + '</td></tr>'; }
    else h += '<tr><td>' + esc(r.f.short) + '</td><td colspan="3">' + esc(r.ans) + '</td></tr>';
  });
  h += '</tbody></table><p class="small">FATF and EU list values may be last-known (feed refresh failed). Verify against the official lists.</p>';
  h += '<h2>4. Due diligence checklist (' + d.done + ' of ' + d.items.length + ' done)</h2><table class="tbl"><thead><tr><th scope="col">Done</th><th scope="col">Task</th><th scope="col">Basis</th></tr></thead><tbody>';
  d.items.forEach(function (it) { var s = c.checklist[it.id]; h += '<tr><td>' + (s && s.done ? 'Yes, ' + esc(fmt(s.at)) : 'Open') + '</td><td>' + esc(it.task) + (it.gate ? ' (required to approve)' : '') + '</td><td>' + esc(it.art) + '</td></tr>'; });
  h += '</tbody></table>';
  h += '<h2>5. Decision log</h2>';
  var decs = decisionsOf(c);
  h += decs.length ? '<table class="tbl"><thead><tr><th scope="col">Date</th><th scope="col">Decision</th><th scope="col">By</th><th scope="col">Tier</th><th scope="col">Rationale</th></tr></thead><tbody>' + decs.map(function (x) { return '<tr><td>' + esc(fmt(x.at)) + '</td><td>' + esc(x.decision) + '</td><td>' + esc(x.by) + '</td><td>' + esc(TL[x.tier] || '') + '</td><td>' + esc(x.rationale) + '</td></tr>'; }).join('') + '</tbody></table>' : '<p>No decision recorded.</p>';
  h += '<h2>6. Review schedule</h2>';
  h += d.review ? '<p>Last approval or review ' + esc(fmt(d.review.last)) + '. Next review <b>' + esc(fmt(d.review.next)) + '</b> (every ' + d.review.months + ' months for ' + TL[d.tier] + ' risk; ' + (d.review.state === 'overdue' ? 'OVERDUE' : 'on schedule') + ').</p>' : '<p>No review scheduled.</p>';
  if ((c.reviews || []).length) h += '<table class="tbl"><thead><tr><th scope="col">Date</th><th scope="col">Type</th><th scope="col">Outcome</th><th scope="col">By</th></tr></thead><tbody>' + c.reviews.map(function (r) { return '<tr><td>' + esc(fmt(r.at)) + '</td><td>' + esc(r.kind) + '</td><td>' + esc(r.outcome + '. ' + r.note) + '</td><td>' + esc(r.by) + '</td></tr>'; }).join('') + '</tbody></table>';
  h += '<h2>7. Risk history</h2><table class="tbl"><thead><tr><th scope="col">Date</th><th scope="col">Score</th><th scope="col">Tier</th><th scope="col">By</th><th scope="col">Note</th></tr></thead><tbody>' + c.history.slice().reverse().map(function (e) { return '<tr><td>' + esc(fmt(e.at)) + '</td><td>' + e.score.toFixed(1) + '</td><td>' + TL[e.tier] + '</td><td>' + esc(e.by) + '</td><td>' + esc(e.note) + '</td></tr>'; }).join('') + '</tbody></table>';
  h += '<div class="sign"><div>Prepared by (name, date)</div><div>Approved by (name, role, date)</div></div>';
  h += '<p class="small" style="margin-top:14px">Sources: EBA/GL/2021/02 as amended by EBA/GL/2024/01 (risk factors); Regulation (EU) 2024/1624 Arts 19 to 26, 29, 33, 34, 40 to 42, 45, 46, 69, 73; RegRadar Country risk data. Weights, scores, thresholds and review periods are defaults that the firm configures. Indicative decision support, not legal advice or an audit opinion. ' + (c.demo ? 'Demo data.' : '') + '</p>';
  return '<div class="pf">' + h + '</div>';
}
function openFile() {
  var c = cur(); if (!c) return;
  var dl = $('fileDlg'); lastOpener = document.activeElement;
  dl.innerHTML = '<div style="display:flex;gap:8px;justify-content:flex-end;padding:12px 16px;border-bottom:1px solid var(--border);flex-wrap:wrap"><button type="button" class="btn pri" data-act="print">Print or save as PDF</button><button type="button" class="btn" data-act="file-close">Close</button></div>' + buildFile(c, true);
  dl.showModal();
}
function doPrint() {
  var c = cur(); if (!c) return;
  $('printRoot').innerHTML = buildFile(c, false);
  window.print();
}

/* ---------- model tab ---------- */
function editModel(fn) {
  if (!STATE.model) STATE.model = clone(DEF);
  fn(STATE.model);
  STATE.model._meta.version = DEF._meta.version + '+edited-' + todayIso();
  STATE.modelEdited = todayIso();
  MODEL = STATE.model; save();
}
function modelImpact() {
  var n = 0, names = [];
  STATE.customers.forEach(function (c) {
    var h = lastOf(c.history), ev = evaluate(c.inputs);
    if (h && h.computed !== ev.tier) { n++; names.push(c.name); }
  });
  return n ? '<b>' + n + ' customer' + (n === 1 ? '' : 's') + '</b> now score a different tier than at the last recorded assessment: ' + esc(names.join(', ')) + '. Open each file to record a fresh assessment.' : 'No customer changes tier against its last recorded assessment.';
}
function refreshModelLive() {
  var el = $('mImpact'); if (el) el.innerHTML = modelImpact();
  var tot = 0; MODEL.factors.forEach(function (f) { tot += +f.weight || 0; });
  var st = $('mTotal'); if (st) st.textContent = 'Total weight ' + tot + ' (shares are relative, so the total need not be 100).';
  MODEL.factors.forEach(function (f) { var s = $('m-sh-' + f.id); if (s) s.textContent = tot ? Math.round((+f.weight || 0) / tot * 100) + '%' : '0%'; });
  var v = $('mVer'); if (v) v.textContent = MODEL._meta.version;
  var b = $('mState'); if (b) b.innerHTML = STATE.model ? 'Edited on this device since ' + esc(STATE.modelEdited) + '.' : '<span class="default-note">Default model: configure for your firm.</span>';
  var dis = $('mDist');
  if (dis) {
    var cnt = { low: 0, medium: 0, high: 0, prohibited: 0 };
    STATE.customers.forEach(function (c) { cnt[derive(c).tier]++; });
    dis.textContent = 'At these settings: ' + TIERS.map(function (t) { return cnt[t] + ' ' + TL[t]; }).join(', ') + '.';
  }
  renderKpis(); renderDash(); renderItems();
  var c = cur(); if (c) refreshHeader(c);
}
function renderModel() {
  var m = MODEL, h = '';
  h += '<div class="alert warn"><b>Default model, configure for your firm.</b>The factor list follows the EBA risk-factor categories (customer, geography, products and channels, behaviour). The weights, answer scores, thresholds and review periods below are a starting judgement, not a regulatory requirement. Changes apply to every customer at once and are kept on this device. Saved history is not rewritten.</div>';
  h += '<div class="card2" style="margin-bottom:14px"><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;justify-content:space-between"><div><b>Model version:</b> <span class="mono" id="mVer"></span><div id="mState" class="muted"></div></div><div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn sm" data-act="model-export">Export model (JSON)</button><label class="btn sm" for="m-import" style="cursor:pointer">Import model (JSON)</label><input type="file" id="m-import" accept="application/json,.json" class="vh"><button type="button" class="btn sm danger" data-act="model-reset">Reset to default</button></div></div><p style="margin-top:8px" id="mImpact"></p><p class="faint" id="mDist"></p></div>';
  h += '<div class="mgrid"><div>';
  h += '<div class="card2" style="margin-bottom:14px"><h2>Tier thresholds and review periods</h2>' +
    '<div class="fld"><label for="m-thr-med">Medium from (score 0 to 100)</label><input class="in numin" type="number" id="m-thr-med" min="1" max="98" step="1" value="' + m.thresholds.medium + '" data-m="thr-med"></div>' +
    '<div class="fld"><label for="m-thr-high">High from (score 0 to 100)</label><input class="in numin" type="number" id="m-thr-high" min="2" max="99" step="1" value="' + m.thresholds.high + '" data-m="thr-high"></div>' +
    '<div class="fld"><label for="m-un">Score for an unanswered factor (1 to 5)</label><input class="in numin" type="number" id="m-un" min="1" max="5" step="1" value="' + m.unanswered_score + '" data-m="unanswered"></div>' +
    ['low', 'medium', 'high'].map(function (t) {
      return '<div class="fld"><label for="m-rev-' + t + '">Review every (months), ' + TL[t] + ' risk. Legal maximum ' + m.review_max_months[t] + '</label><input class="in numin" type="number" id="m-rev-' + t + '" min="1" max="' + m.review_max_months[t] + '" step="1" value="' + m.review_months[t] + '" data-m="rev" data-t="' + t + '"></div>';
    }).join('') +
    '<div class="err" id="mErr" role="alert"></div><p class="faint" style="font-size:12.5px">AMLR Art. 26(2): updates of customer information shall not exceed 1 year for higher-risk customers to which Section 4 measures apply, and 5 years for all other customers. The intervals below those caps are the firm\'s choice.</p></div>';
  h += '<div class="card2" style="margin-bottom:14px"><h2>Geography scoring</h2><p class="muted">' + esc(m.geo.note) + '</p>' +
    '<div class="fld"><label for="g-low">Country tier Medium from (composite 0 to 10)</label><input class="in numin" type="number" step="0.1" min="0" max="10" id="g-low" value="' + m.geo.low + '" data-m="geo-low"></div>' +
    '<div class="fld"><label for="g-high">Country tier High from</label><input class="in numin" type="number" step="0.1" min="0" max="10" id="g-high" value="' + m.geo.high + '" data-m="geo-high"></div>' +
    '<h3 class="sec">Answer score for each country tier (1 to 5)</h3>' +
    Object.keys(m.geo.tier_score).map(function (k) { return '<div class="fld"><label for="gs-' + k + '">' + CTL[k] + ' country</label><input class="in numin" type="number" min="1" max="5" step="1" id="gs-' + k + '" value="' + m.geo.tier_score[k] + '" data-m="geo-score" data-k="' + k + '"></div>'; }).join('') +
    '<details><summary style="cursor:pointer;color:var(--accent);min-height:36px;display:inline-flex;align-items:center">Indicator weights for the country composite</summary>' +
    Object.keys(m.geo.weights).map(function (k) { return '<div class="fld"><label for="gw-' + k + '">' + esc(GEO_LABEL[k] || k) + '</label><input class="in numin" type="number" min="0" max="100" step="1" id="gw-' + k + '" value="' + m.geo.weights[k] + '" data-m="geo-w" data-k="' + k + '"></div>'; }).join('') + '</details></div>';
  h += '<div class="card2"><h2>Rules that set a minimum tier</h2><p class="muted">After scoring, any triggered rule can only raise the tier. Rules marked as a legal minimum cannot be switched below the level the AMLR requires.</p>' +
    m.rules.map(function (r) {
      var opts = ['off', 'medium', 'high', 'prohibited'].map(function (a) {
        var dis = a !== 'off' ? false : (r.min && r.min !== 'off');
        var below = rank(a === 'off' ? 'low' : a) < rank(r.min === 'off' ? 'low' : r.min) || (a === 'off' && r.min !== 'off');
        return '<option value="' + a + '"' + (r.action === a ? ' selected' : '') + (below && a !== r.min ? ' disabled' : '') + '>' + (a === 'off' ? 'Off' : 'At least ' + TL[a]) + (dis ? '' : '') + '</option>';
      }).join('');
      return '<div class="rule"><div class="top"><div><label for="r-' + r.id + '"><b>' + esc(r.label) + '</b></label><div class="basis">' + esc(r.basis) + '</div>' + (r.min && r.min !== 'off' ? '<div class="basis"><b>Legal minimum: ' + TL[r.min] + '</b></div>' : '') +
        (r.param != null ? '<div class="fld" style="margin-top:6px"><label for="rp-' + r.id + '">Sanctions exposure threshold (0 to 10)</label><input class="in numin" type="number" min="0" max="10" step="1" id="rp-' + r.id + '" value="' + r.param + '" data-m="rule-param" data-r="' + r.id + '"></div>' : '') + '</div>' +
        '<select class="sel" id="r-' + r.id + '" data-m="rule" data-r="' + r.id + '">' + opts + '</select></div></div>';
    }).join('') + '</div>';
  h += '</div><div>';
  MODEL.groups.forEach(function (g) {
    h += '<div class="card2" style="margin-bottom:14px"><h2>' + esc(g.label) + '</h2><div class="faint" style="font-size:12.5px;margin-bottom:6px">Basis: ' + esc(g.eba) + '</div>';
    MODEL.factors.filter(function (f) { return f.group === g.id; }).forEach(function (f) {
      h += '<div class="mrow"><div class="nm"><label for="m-w-' + f.id + '">' + esc(f.label) + '</label></div><input class="in numin" type="number" min="0" max="100" step="1" id="m-w-' + f.id + '" value="' + f.weight + '" data-m="weight" data-f="' + f.id + '" aria-label="Weight of ' + esc(f.label) + '"><span class="share mono muted" id="m-sh-' + f.id + '"></span>';
      if (f.options) {
        h += '<details><summary>Answer scores (' + f.options.length + ' answers)</summary>' + f.options.map(function (o, i) {
          return '<div class="orow"><label for="m-s-' + f.id + '-' + i + '">' + esc(o.label) + '</label><input class="in numin" type="number" min="1" max="5" step="1" id="m-s-' + f.id + '-' + i + '" value="' + o.score + '" data-m="score" data-f="' + f.id + '" data-i="' + i + '"></div>';
        }).join('') + '</details>';
      } else h += '<div class="faint" style="grid-column:1/-1;font-size:12.5px">Scored from the country tier (see Geography scoring).</div>';
      h += '</div>';
    });
    h += '</div>';
  });
  h += '<p class="faint" id="mTotal"></p></div></div>';
  $('panel-model').innerHTML = h;
  refreshModelLive();
}
function modelChange(t) {
  var m = t.dataset.m, val = t.value, n = parseFloat(val);
  function bad(msg) { $('mErr').textContent = msg; return true; }
  $('mErr').textContent = '';
  if (isNaN(n) && m !== 'rule') { bad('Enter a number.'); return; }
  if (m === 'weight') { if (n < 0 || n > 100) { bad('Weights run from 0 to 100.'); return; } editModel(function (x) { x.factors.filter(function (f) { return f.id === t.dataset.f; })[0].weight = n; }); }
  else if (m === 'score') { if (n < 1 || n > 5) { t.value = '1'; bad('Scores run from 1 to 5.'); return; } editModel(function (x) { x.factors.filter(function (f) { return f.id === t.dataset.f; })[0].options[+t.dataset.i].score = Math.round(n); }); }
  else if (m === 'thr-med') { if (n < 1 || n >= MODEL.thresholds.high) { bad('Medium must be at least 1 and below the High threshold.'); t.value = MODEL.thresholds.medium; return; } editModel(function (x) { x.thresholds.medium = n; }); }
  else if (m === 'thr-high') { if (n <= MODEL.thresholds.medium || n > 99) { bad('High must be above the Medium threshold and at most 99.'); t.value = MODEL.thresholds.high; return; } editModel(function (x) { x.thresholds.high = n; }); }
  else if (m === 'unanswered') { if (n < 1 || n > 5) { bad('Use 1 to 5.'); return; } editModel(function (x) { x.unanswered_score = Math.round(n); }); }
  else if (m === 'rev') { var mx = MODEL.review_max_months[t.dataset.t]; if (n < 1 || n > mx) { bad('Review interval for ' + TL[t.dataset.t] + ' risk must be between 1 and ' + mx + ' months (AMLR Art. 26(2)).'); t.value = MODEL.review_months[t.dataset.t]; return; } editModel(function (x) { x.review_months[t.dataset.t] = Math.round(n); }); }
  else if (m === 'geo-low') { if (n < 0 || n >= MODEL.geo.high) { bad('Country Medium threshold must be below the High threshold.'); t.value = MODEL.geo.low; return; } editModel(function (x) { x.geo.low = n; }); }
  else if (m === 'geo-high') { if (n <= MODEL.geo.low || n > 10) { bad('Country High threshold must be above Medium and at most 10.'); t.value = MODEL.geo.high; return; } editModel(function (x) { x.geo.high = n; }); }
  else if (m === 'geo-score') { if (n < 1 || n > 5) { bad('Use 1 to 5.'); return; } editModel(function (x) { x.geo.tier_score[t.dataset.k] = Math.round(n); }); }
  else if (m === 'geo-w') { if (n < 0 || n > 100) { bad('Use 0 to 100.'); return; } editModel(function (x) { x.geo.weights[t.dataset.k] = n; }); }
  else if (m === 'rule-param') { if (n < 0 || n > 10) { bad('Use 0 to 10.'); return; } editModel(function (x) { x.rules.filter(function (r) { return r.id === t.dataset.r; })[0].param = n; }); }
  else if (m === 'rule') { editModel(function (x) { x.rules.filter(function (r) { return r.id === t.dataset.r; })[0].action = val; }); }
  refreshModelLive(); toast('Model updated for all customers');
}
function validateModel(m) {
  if (!m || typeof m !== 'object') return 'The file is not a model.';
  if (!Array.isArray(m.factors) || !Array.isArray(m.rules) || !m.thresholds || !m._meta) return 'Missing factors, rules, thresholds or _meta.';
  var ids = DEF.factors.map(function (f) { return f.id; }).sort().join();
  if (m.factors.map(function (f) { return f.id; }).sort().join() !== ids) return 'The factor list does not match this version of the tool.';
  for (var i = 0; i < m.factors.length; i++) {
    var f = m.factors[i];
    if (typeof f.weight !== 'number' || f.weight < 0 || f.weight > 100) return 'Invalid weight for ' + f.id + '.';
    if (f.options) for (var j = 0; j < f.options.length; j++) { var s = f.options[j].score; if (typeof s !== 'number' || s < 1 || s > 5) return 'Invalid score in ' + f.id + '.'; }
  }
  if (!(m.thresholds.medium >= 1 && m.thresholds.high > m.thresholds.medium && m.thresholds.high <= 99)) return 'Invalid thresholds.';
  for (var k = 0; k < m.rules.length; k++) { if (['off', 'medium', 'high', 'prohibited'].indexOf(m.rules[k].action) < 0) return 'Invalid rule action.'; }
  if (!m.geo || !m.geo.weights || !m.geo.tier_score || !m.review_months || !m.review_max_months) return 'Missing geography or review settings.';
  return '';
}

/* ---------- sources tab ---------- */
function renderSources() {
  var s = DEF._meta.sources, stale = (CR.stale_indicators || []);
  var h = '<div class="src"><h2 style="margin-top:0">How the score works</h2>' +
    '<p>Every factor has an answer scale from 1 (lowest risk) to 5 (highest). The customer score is the weighted average of the answers, rescaled so that all-1 answers give 0 and all-5 answers give 100. Weights are relative. Tier bands, rules and review periods come from the Scoring model tab. This follows the EBA approach of taking a holistic view of all risk factors (Guideline 3.2) and then applying floors where a single factor decides the outcome.</p>' +
    '<p>Rules can only raise the tier. A rule marked as a legal minimum (for example PEP, EU high-risk third country, residence by investment) cannot be switched below the level the AMLR requires. Anything else is a firm policy default you can change. An override needs a written rationale, and an approver when it lowers the tier.</p>' +
    '<p>The tier gives the due diligence level: Low and Medium use standard CDD (simplified measures are optional under Art. 33), High uses enhanced due diligence (Art. 34), Prohibited means decline or escalate (Art. 21).</p>' +
    '<h2>Sources checked</h2><ul>' +
    '<li><b>EBA Guidelines EBA/GL/2021/02</b> on customer due diligence and ML/TF risk factors, as amended by <b>EBA/GL/2024/01</b> of 16 January 2024 (crypto-asset service providers, Guideline 21). The factor groups follow Guideline 2 (customer, countries and geographical areas, products, services and transactions, delivery channels). Paragraph references quoted in the tool (2.4(b), 3.2, 4.60, 21.3, 21.5, 21.7, 21.9, 21.12, 21.13) were read in the amending text. <a href="' + esc(s[0].url) + '" rel="noopener">Final report (PDF, EBA)</a>.</li>' +
    '<li><b>Regulation (EU) 2024/1624 (AMLR)</b>: the 49 checklist items cite Arts 20 to 26, 29, 33, 34, 40, 41, 42, 45, 46, 69 and 73. Every quotation was checked as a verbatim string of <code>data/laws/32024R1624_EN.json</code> (the CELLAR text). Open any item in Compliance or the law reader. <a href="law.html?celex=32024R1624&amp;art=20">AMLR Art. 20</a>, <a href="law.html?celex=32024R1624&amp;art=34">Art. 34</a>, <a href="law.html?celex=32024R1624&amp;art=42">Art. 42</a>.</li>' +
    '<li><b>Country risk data</b>, as of ' + esc(CR.as_of) + '. ' + (stale.length ? 'The feeds <b>' + esc(stale.join(', ')) + '</b> could not be refreshed, so FATF and EU list values are last-known.' : '') + ' <a href="country-risk.html">Open the Country risk page</a>.</li></ul>' +
    '<h2>What is verified and what is a default</h2><table class="tbl"><thead><tr><th scope="col">Item</th><th scope="col">Status</th></tr></thead><tbody>' +
    '<tr><td>Article numbers and quoted text in the checklist</td><td>Verified against the official text</td></tr>' +
    '<tr><td>Review intervals capped at 1 year (higher risk) and 5 years (others)</td><td>Verified, AMLR Art. 26(2)</td></tr>' +
    '<tr><td>EDD for high-risk third countries, PEPs, residence by investment</td><td>Verified, AMLR Arts 29(4), 42, 46, 41</td></tr>' +
    '<tr><td>Factor list and categories</td><td>Follows EBA Guideline 2 and 21; the selection and wording of answers are RegRadar\'s</td></tr>' +
    '<tr><td>Weights, answer scores, tier bands, review intervals below the caps, volume bands</td><td><b>Default, configure for your firm</b></td></tr>' +
    '<tr><td>Declining FATF black-list and high-sanctions countries</td><td><b>Firm policy default</b>, not a legal requirement for every firm</td></tr>' +
    '<tr><td>Demo customers, names and decisions</td><td>Fictional (CF Bank)</td></tr></tbody></table>' +
    '<h2>Limits</h2><ul><li>The EBA Guidelines were written under Directive (EU) 2015/849. The AMLR applies from 10 July 2027 according to the RegRadar obligations register. AMLR Art. 20(3) tasks AMLA with guidelines on risk variables and risk factors: check whether they have been published and update the model when they are.</li>' +
    '<li>This is a prototype. Do not enter real personal data. Nothing leaves your browser. Clearing site data erases everything, so export the register and decision log (CSV) and the model (JSON) as your record.</li>' +
    '<li>Scores are decision support. A compliance officer decides. This is not legal advice or an audit opinion.</li></ul></div>';
  $('panel-sources').innerHTML = h;
}

/* ---------- tabs / render ---------- */
function setTab(t, focus) {
  UI.tab = t;
  ['files', 'model', 'sources'].forEach(function (k) {
    var on = k === t; $('tab-' + k).setAttribute('aria-selected', on); $('tab-' + k).tabIndex = on ? 0 : -1; $('panel-' + k).hidden = !on;
  });
  if (t === 'model') renderModel();
  if (t === 'sources') renderSources();
  if (focus) $('tab-' + t).focus();
}
function renderAll() {
  renderKpis(); renderDash(); renderFilters(); renderItems(); renderDetail();
}
function setSub(s, focus) {
  UI.sub = s;
  document.querySelectorAll('#subTabs [data-sub]').forEach(function (b) { var on = b.dataset.sub === s; b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1; });
  $('subBody').setAttribute('aria-labelledby', 'stab-' + s);
  renderSub();
  if (focus) $('stab-' + s).focus();
}
function tabKeys(e, sel, cb) {
  var keys = { ArrowRight: 1, ArrowLeft: -1, Home: 'h', End: 'e' }; if (!(e.key in keys)) return false;
  var tabs = [].slice.call(document.querySelectorAll(sel)), i = tabs.indexOf(e.target); if (i < 0) return false;
  var n = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (i + keys[e.key] + tabs.length) % tabs.length;
  e.preventDefault(); cb(tabs[n]); return true;
}

/* ---------- events ---------- */
document.addEventListener('click', function (e) {
  var t = e.target.closest('[data-act],[data-tab],[data-sub]'); if (!t) return;
  if (t.dataset.tab) { setTab(t.dataset.tab); return; }
  if (t.dataset.sub && !t.dataset.act && t.closest('#subTabs')) { setSub(t.dataset.sub); return; }
  var a = t.dataset.act;
  if (a === 'open') { UI.sel = t.dataset.id; if (t.dataset.sub) UI.sub = t.dataset.sub; if (UI.tab !== 'files') setTab('files'); renderItems(); renderDetail(); if (window.innerWidth < 981) $('detail').scrollIntoView({ block: 'start' }); return; }
  if (a === 'flt') { UI.flt = t.dataset.v; renderFilters(); renderItems(); return; }
  if (a === 'new') return dlgNew();
  if (a === 'new-ok') return newOk();
  if (a === 'dlg-cancel') return closeDlg();
  if (a === 'export-register') return exportRegister();
  if (a === 'export-decisions') return exportDecisions();
  if (a === 'decide') return dlgDecide();
  if (a === 'decide-ok') return decideOk();
  if (a === 'override') return dlgOverride();
  if (a === 'override-ok') return overrideOk();
  if (a === 'override-clear') return overrideClear();
  if (a === 'review') return dlgReview();
  if (a === 'review-ok') return reviewOk();
  if (a === 'record') { var c = cur(); recordHistory(c, 'Assessment recorded'); save(); renderAll(); toast('Assessment recorded in the history'); var b = $('stab-' + UI.sub); if (b) b.focus(); return; }
  if (a === 'delete') return dlgConfirm('Delete this customer file?', 'The file, its history and its decisions are removed from this device. This cannot be undone. Export the decision log first if you need it.', 'delete-ok');
  if (a === 'delete-ok') { STATE.customers = STATE.customers.filter(function (c) { return c.id !== UI.sel; }); UI.sel = null; save(); closeDlg(); renderAll(); toast('Customer deleted'); return; }
  if (a === 'file') return openFile();
  if (a === 'file-close') { $('fileDlg').close(); return; }
  if (a === 'print') return doPrint();
  if (a === 'model-export') { download('regradar-cra-model-' + todayIso() + '.json', JSON.stringify(MODEL, null, 2), 'application/json'); toast('Model exported'); return; }
  if (a === 'model-reset') return dlgConfirm('Reset the model to the default?', 'Your edited weights, scores, thresholds and rules are replaced by the default model. Customers are re-scored; saved history stays.', 'model-reset-ok');
  if (a === 'model-reset-ok') { STATE.model = null; STATE.modelEdited = ''; MODEL = DEF; save(); closeDlg(); renderModel(); renderAll(); toast('Default model restored'); return; }
  if (a === 'reset-demo') return dlgConfirm('Reset the demo data?', 'All customers on this device, including ones you added, are replaced by the fictional demo set.', 'reset-demo-ok');
  if (a === 'reset-demo-ok') { STATE.customers = seedCustomers(); UI.sel = null; save(); closeDlg(); selectFirst(); renderAll(); toast('Demo data restored'); return; }
});
document.addEventListener('change', function (e) {
  var t = e.target;
  if (t.dataset && t.dataset.f && t.closest('#formBox')) {
    var c = cur(); if (!c) return;
    if (t.value) c.inputs[t.dataset.f] = t.value; else delete c.inputs[t.dataset.f];
    updateAfterAnswer(t.dataset.f); return;
  }
  if (t.dataset && t.dataset.ck) {
    var c2 = cur(); if (!c2) return;
    if (t.checked) c2.checklist[t.dataset.ck] = { done: true, at: todayIso() }; else delete c2.checklist[t.dataset.ck];
    save(); renderChecklist(c2); var el = $('ck-' + t.dataset.ck); if (el) el.focus();
    renderKpis(); refreshHeader(c2); var el2 = $('ck-' + t.dataset.ck); if (el2) el2.focus(); return;
  }
  if (t.dataset && t.dataset.m) { modelChange(t); return; }
  if (t.id === 'm-import' && t.files && t.files[0]) {
    var rd = new FileReader();
    rd.onload = function () {
      var m; try { m = JSON.parse(rd.result); } catch (x) { toast('That file is not valid JSON.'); return; }
      var err = validateModel(m); if (err) { toast('Model not imported: ' + err); return; }
      editModel(function (x) { Object.keys(x).forEach(function (k) { delete x[k]; }); Object.assign(x, m); });
      STATE.model._meta.version = (m._meta.version || 'imported') + '+imported-' + todayIso();
      MODEL = STATE.model; save(); renderModel(); renderAll(); toast('Model imported');
    };
    rd.readAsText(t.files[0]); t.value = '';
  }
});
document.addEventListener('input', function (e) {
  if (e.target.id === 'q') { UI.q = e.target.value; renderItems(); }
  if (e.target.name === 'dec') updateBlockers();
});
document.addEventListener('change', function (e) { if (e.target.name === 'dec') updateBlockers(); });
document.addEventListener('keydown', function (e) {
  if (e.target.closest && e.target.closest('#mainTabs')) tabKeys(e, '#mainTabs [role=tab]', function (b) { setTab(b.dataset.tab, true); });
  else if (e.target.closest && e.target.closest('#subTabs')) tabKeys(e, '#subTabs [role=tab]', function (b) { setSub(b.dataset.sub, true); });
  else if (e.key === '/' && ['INPUT', 'TEXTAREA', 'SELECT'].indexOf((document.activeElement || {}).tagName) < 0 && UI.tab === 'files' && !$('dlg').open) { e.preventDefault(); $('q').focus(); }
});
$('fileDlg').addEventListener('close', function () { if (lastOpener && document.contains(lastOpener)) lastOpener.focus(); });
$('dlg').addEventListener('close', function () { if (lastOpener && document.contains(lastOpener)) lastOpener.focus(); });

/* ---------- boot ---------- */
function selectFirst() { var l = visibleCustomers(); UI.sel = l.length ? l[0].c.id : null; }
async function boot() {
  try {
    var r = await Promise.all([
      fetch('data/cra-model.json', { cache: 'no-store' }).then(function (x) { return x.json(); }),
      fetch('data/cra-checklist.json', { cache: 'no-store' }).then(function (x) { return x.json(); }),
      fetch('data/country-risk.json', { cache: 'no-store' }).then(function (x) { return x.json(); }),
      fetch('data/cra-demo.json', { cache: 'no-store' }).then(function (x) { return x.json(); }),
      fetch('data/obligations.json', { cache: 'no-store' }).then(function (x) { return x.json(); }).catch(function () { return { obligations: [] }; })
    ]);
    DEF = r[0]; CL = r[1].items; CR = r[2]; DEMO = r[3];
    (r[4].obligations || []).forEach(function (o) { OBS[o.id] = o; });
  } catch (e) {
    $('detail').innerHTML = '<div class="empty">Could not load the model data. Check your connection and reload.</div>';
    return;
  }
  CR.countries.forEach(function (c) { CBY[c.code] = c; });
  var s = loadState();
  if (s) { STATE = Object.assign(STATE, s); }
  MODEL = STATE.model || DEF;
  COUNTRY_OPTS = countryOptions();
  if (!STATE.seeded) { STATE.customers = seedCustomers(); STATE.seeded = true; save(); }
  var p = new URLSearchParams(location.search);
  if (p.get('open') && STATE.customers.some(function (c) { return c.id === p.get('open'); })) UI.sel = p.get('open');
  else selectFirst();
  renderAll();
  var foot = document.createElement('p');
  foot.className = 'note';
  foot.innerHTML = '<button type="button" class="btn sm" data-act="reset-demo">Reset demo data</button>' + (memOnly ? ' <span>Browser storage is unavailable, so changes last only until you close this page.</span>' : '');
  $('main').insertBefore(foot, document.querySelector('main > p.note'));
}
boot();
})();
