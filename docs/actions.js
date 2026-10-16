/* ═══════════════════════════════════════════════════════════════
   RegRadar: Issues and actions tracker (E7) with board reporting (E9 slice)

   Device-local data layer (key 'regradar-actions'), same pattern as
   controls-data.js. Reads controls (docs/data/controls.json plus the
   device-local overlay 'regradar-controls-mine' via ControlsData) and
   obligations (docs/data/obligations.json) to link and to suggest issues.

   Demo data (docs/data/actions-demo.json) is fictional (CF Bank).
   SLA days and escalation thresholds are defaults: configure for your firm.
   ═══════════════════════════════════════════════════════════════ */
(function () {
'use strict';

/* ───────── constants ───────── */
var KEY = 'regradar-actions';
var SEV = [
  { id: 'critical', label: 'Critical', rank: 0 }, { id: 'high', label: 'High', rank: 1 },
  { id: 'medium', label: 'Medium', rank: 2 }, { id: 'low', label: 'Low', rank: 3 }
];
var STATUS = [
  { id: 'open', label: 'Open' }, { id: 'in_progress', label: 'In progress' },
  { id: 'awaiting_validation', label: 'Awaiting validation' }, { id: 'closed', label: 'Closed' },
  { id: 'risk_accepted', label: 'Risk accepted' }
];
var ACTIVE = ['open', 'in_progress', 'awaiting_validation'];
var SOURCES = [
  { id: 'internal_audit', label: 'Internal audit' }, { id: 'regulator_inspection', label: 'Regulator inspection' },
  { id: 'control_test', label: 'Control test failure' }, { id: 'self_identified', label: 'Self-identified' },
  { id: 'external_review', label: 'External review' }
];
var ROOTS = ['Process design', 'People and training', 'Technology and systems', 'Data quality', 'Governance and oversight',
  'Third party or outsourcing', 'Policy or procedure gap', 'Resourcing', 'Other'];
var AGE_B = [
  { id: 'a0', label: '0 to 30 days', min: 0, max: 30 }, { id: 'a1', label: '31 to 60', min: 31, max: 60 },
  { id: 'a2', label: '61 to 90', min: 61, max: 90 }, { id: 'a3', label: '91 to 180', min: 91, max: 180 },
  { id: 'a4', label: 'Over 180', min: 181, max: 99999 }
];
var DUE_B = [
  { id: 'd0', label: 'Not yet due', min: -99999, max: 0 }, { id: 'd1', label: '1 to 30 days overdue', min: 1, max: 30 },
  { id: 'd2', label: '31 to 60', min: 31, max: 60 }, { id: 'd3', label: '61 to 90', min: 61, max: 90 },
  { id: 'd4', label: 'Over 90', min: 91, max: 99999 }
];
var PRESETS = [
  { id: 'active', label: 'Active', f: { status: 'active' } },
  { id: 'attention', label: 'Needs attention', f: { status: 'attention' } },
  { id: 'crit', label: 'Critical and high', f: { status: 'active', severity: 'crithigh' } },
  { id: 'awaiting', label: 'Awaiting validation', f: { status: 'awaiting_validation' } },
  { id: 'accepted', label: 'Risk accepted', f: { status: 'risk_accepted' } },
  { id: 'closed', label: 'Closed', f: { status: 'closed' } },
  { id: 'all', label: 'All', f: { status: 'all' } }
];
var SORTS = [
  { id: 'priority', label: 'Priority (escalation, severity, due)' }, { id: 'due', label: 'Due date, soonest first' },
  { id: 'severity', label: 'Severity' }, { id: 'age', label: 'Age, oldest first' },
  { id: 'status', label: 'Status' }, { id: 'id', label: 'ID, newest first' }
];
var CHECK_NOTE = 'Default, configure for your firm';

function defaultCfg() {
  return {
    sla: { critical: { sla: 30, mgmt: 7, board: 21 }, high: { sla: 60, mgmt: 14, board: 30 },
      medium: { sla: 90, mgmt: 21, board: 60 }, low: { sla: 180, mgmt: 30, board: 90 } },
    dueSoon: 14, shortcuts: true
  };
}
function defaultFilter() {
  return { q: '', status: 'active', severity: '', source: '', owner: '', lod: '', root: '', control: '', obligation: '', age: '', dueb: '', sort: 'priority' };
}

/* ───────── helpers ───────── */
var $ = function (id) { return document.getElementById(id); };
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function pad(n) { return n < 10 ? '0' + n : '' + n; }
function isoOf(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function dn(iso) { var p = iso.split('-'); return Math.round(Date.UTC(+p[0], +p[1] - 1, +p[2]) / 864e5); }
function addDays(iso, n) { var d = new Date((dn(iso) + n) * 864e5); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); }
function diff(a, b) { return dn(a) - dn(b); }
function validISO(s) { return /^\d{4}-\d{2}-\d{2}$/.test(s || '') && addDays(s, 0) === s; }
function fmt(iso) { return iso ? new Date(dn(iso) * 864e5).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : 'none'; }
function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }
function by(list, id) { for (var k = 0; k < list.length; k++) if (list[k].id === id) return list[k]; return null; }
function labelOf(list, id) { var x = by(list, id); return x ? x.label : (id || ''); }
function uniq(a) { return a.filter(function (x, k) { return x && a.indexOf(x) === k; }); }

var asof = new URLSearchParams(location.search).get('asof');
var TODAY = validISO(asof) ? asof : isoOf(new Date());

/* ───────── state ───────── */
var S = null;            // persisted
var OBS = [], CONTROLS = [], TESTS = {}, LAW = null;
var D = {};              // derived per issue id
var F = defaultFilter();
var UI = { tab: 'register', months: 6, lastId: null };
var SH = null;           // open issue sheet {id, W, isNew, invoker}
var storageOk = true;

function freshState() { return { v: 1, seq: 0, issues: [], cfg: defaultCfg(), saved: [], dismissed: {}, report: { commentary: '', by: '' }, firm: '' }; }

function mergeCfg(c) {
  var d = defaultCfg();
  if (!c) return d;
  SEV.forEach(function (s) {
    var x = (c.sla || {})[s.id] || {};
    ['sla', 'mgmt', 'board'].forEach(function (k) { if (isFinite(x[k]) && x[k] >= 0) d.sla[s.id][k] = +x[k]; });
  });
  if (isFinite(c.dueSoon) && c.dueSoon >= 0) d.dueSoon = +c.dueSoon;
  if (c.shortcuts === false) d.shortcuts = false;
  return d;
}
function loadState() {
  var raw = null;
  try { raw = localStorage.getItem(KEY); } catch (e) { storageOk = false; }
  if (!raw) return null;
  try {
    var p = JSON.parse(raw), s = Object.assign(freshState(), p);
    s.cfg = mergeCfg(p.cfg);
    s.issues = Array.isArray(p.issues) ? p.issues : [];
    s.saved = Array.isArray(p.saved) ? p.saved : [];
    return s;
  } catch (e) { return null; }
}
function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); storageOk = true; return true; }
  catch (e) { storageOk = false; toast('Could not save on this device (storage blocked or full). Changes last until you close the page.'); return false; }
}

function materialize(seed) {
  var s = freshState();
  s.firm = seed.firm || '';
  seed.issues.forEach(function (x) {
    var i = {
      id: x.id, title: x.title, description: x.description || '', source: x.source, source_ref: x.source_ref || '',
      severity: x.severity, root_cause: x.root_cause || '', owner: x.owner, lod: x.lod || '1LOD', status: x.status,
      opened_on: addDays(TODAY, x.opened_off), due_on: addDays(TODAY, x.due_off),
      closed_on: x.closed_off != null ? addDays(TODAY, x.closed_off) : '', closed_by: x.closed_by || '', closure_note: x.closure_note || '',
      submitted_on: x.submitted_off != null ? addDays(TODAY, x.submitted_off) : '',
      accepted: x.accepted ? { by: x.accepted.by, until: addDays(TODAY, x.accepted.until_off), on: addDays(TODAY, x.accepted.on_off), rationale: x.accepted.rationale } : null,
      control_ids: (x.control_ids || []).slice(), obligation_ids: (x.obligation_ids || []).slice(),
      actions: (x.actions || []).map(function (a, k) {
        return { id: 'A' + (k + 1), title: a.title, owner: a.owner, due_on: addDays(TODAY, a.due_off), status: a.done_off != null ? 'done' : 'open',
          done_on: a.done_off != null ? addDays(TODAY, a.done_off) : '', evidence: a.evidence || '' };
      }),
      history: [], demo: true
    };
    i.history.push({ d: i.opened_on, t: 'Opened (demo data)' });
    i.actions.forEach(function (a) { if (a.done_on) i.history.push({ d: a.done_on, t: 'Action done: ' + a.title }); });
    if (i.submitted_on) i.history.push({ d: i.submitted_on, t: 'Submitted for validation' });
    if (i.accepted) i.history.push({ d: i.accepted.on, t: 'Risk accepted by ' + i.accepted.by + ' until ' + fmt(i.accepted.until) });
    if (i.closed_on) i.history.push({ d: i.closed_on, t: 'Closed. Validated by ' + i.closed_by });
    i.history.sort(function (a, b) { return a.d < b.d ? -1 : a.d > b.d ? 1 : 0; });
    s.issues.push(i);
    s.seq = Math.max(s.seq, parseInt(String(x.id).replace(/\D/g, ''), 10) || 0);
  });
  return s;
}

/* ───────── derived values ───────── */
function sevCfg(sev) { return S.cfg.sla[sev] || S.cfg.sla.medium; }
function derive(i) {
  var c = sevCfg(i.severity), d = {};
  d.active = ACTIVE.indexOf(i.status) !== -1;
  d.od = d.active && i.due_on && i.due_on < TODAY ? diff(TODAY, i.due_on) : 0;
  d.level = '';
  if (d.od > 0) { d.level = 'overdue'; if (d.od >= c.mgmt) d.level = 'mgmt'; if (d.od >= c.board) d.level = 'board'; }
  d.levelRank = { '': 0, overdue: 1, mgmt: 2, board: 3 }[d.level];
  d.age = diff(i.status === 'closed' && i.closed_on ? i.closed_on : TODAY, i.opened_on);
  d.dueIn = d.active && i.due_on && i.due_on >= TODAY ? diff(i.due_on, TODAY) : null;
  d.dueSoon = d.dueIn !== null && d.dueIn <= S.cfg.dueSoon;
  d.accExp = i.status === 'risk_accepted' && i.accepted && i.accepted.until < TODAY;
  d.accSoon = i.status === 'risk_accepted' && i.accepted && !d.accExp && diff(i.accepted.until, TODAY) <= 30;
  var acts = i.actions || [];
  d.nAct = acts.length; d.nDone = acts.filter(function (a) { return a.status === 'done'; }).length;
  d.actOd = d.active ? acts.filter(function (a) { return a.status !== 'done' && a.due_on && a.due_on < TODAY; }).length : 0;
  d.slaTarget = addDays(i.opened_on, c.sla);
  d.beyondSla = i.due_on > d.slaTarget ? diff(i.due_on, d.slaTarget) : 0;
  d.unassigned = !i.owner || /^unassigned$/i.test(i.owner);
  d.attention = d.od > 0 || d.dueSoon || d.actOd > 0 || d.accExp || d.accSoon;
  d.sevRank = (by(SEV, i.severity) || SEV[2]).rank;
  return d;
}
function recompute() { D = {}; S.issues.forEach(function (i) { D[i.id] = derive(i); }); }
function issue(id) { return by(S.issues, id); }
function ctl(id) { return by(CONTROLS, id); }
function obl(id) { return by(OBS, id); }
function artNum(o) { var m = (o.source_url || '').match(/art=(\d+)/); return m ? m[1] : ((o.legal_basis || '').match(/(\d+)/) || [])[1]; }
function oblTitle(o) {
  if (LAW) { var n = artNum(o), a = LAW.articles.filter(function (x) { return String(x.id) === String(n); })[0]; if (a) return a.title.replace(/ /g, ' '); }
  return (o.what || '').length > 70 ? o.what.slice(0, 67) + '…' : (o.what || '');
}
function oblLabel(id) { var o = obl(id); return o ? o.legal_basis + ' · ' + oblTitle(o) : id; }
function oblShort(id) { var o = obl(id); return o ? o.legal_basis : id; }
function ctlLabel(id) { var c = ctl(id); return c ? id + ' · ' + c.name : id + ' (not found)'; }
function owners() {
  var a = [];
  CONTROLS.forEach(function (c) { a.push(c.owner); });
  S.issues.forEach(function (i) { a.push(i.owner); i.actions.forEach(function (x) { a.push(x.owner); }); if (i.closed_by) a.push(i.closed_by); });
  return uniq(a.filter(function (x) { return x && !/^unassigned$/i.test(x); })).sort();
}

/* ───────── toast ───────── */
function toast(m) { var t = $('toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove('on'); }, 2600); }

/* ───────── mutation ───────── */
function log(i, t) { i.history.push({ d: TODAY, t: t }); }
function nextId() { S.seq++; return 'ISS-' + (S.seq < 100 ? ('00' + S.seq).slice(-3) : S.seq); }
function slaDue(sev, opened) { return addDays(opened || TODAY, sevCfg(sev).sla); }
function blankIssue(over) {
  var sev = (over && over.severity) || 'medium';
  return Object.assign({
    id: '', title: '', description: '', source: 'self_identified', source_ref: '', severity: sev, root_cause: '', owner: '', lod: '1LOD',
    status: 'open', opened_on: TODAY, due_on: slaDue(sev, TODAY), closed_on: '', closed_by: '', closure_note: '', submitted_on: '',
    accepted: null, control_ids: [], obligation_ids: [], actions: [], history: [], demo: false
  }, over || {});
}
function addIssue(i) { i.id = nextId(); i.history = [{ d: TODAY, t: 'Opened' }]; S.issues.push(i); return i; }
function touch() { recompute(); persist(); renderAll(); if (SH && !SH.isNew) renderSheetParts(); }

/* ───────── filtering ───────── */
function matches(i) {
  var d = D[i.id], f = F;
  if (f.status === 'active') { if (!d.active) return false; }
  else if (f.status === 'attention') { if (!d.attention) return false; }
  else if (f.status !== 'all' && i.status !== f.status) return false;
  if (f.severity === 'crithigh') { if (i.severity !== 'critical' && i.severity !== 'high') return false; }
  else if (f.severity && i.severity !== f.severity) return false;
  if (f.source && i.source !== f.source) return false;
  if (f.owner && (f.owner === '__none' ? !d.unassigned : i.owner !== f.owner)) return false;
  if (f.lod && i.lod !== f.lod) return false;
  if (f.root && i.root_cause !== f.root) return false;
  if (f.control && i.control_ids.indexOf(f.control) === -1) return false;
  if (f.obligation && i.obligation_ids.indexOf(f.obligation) === -1) return false;
  if (f.age) { var b = by(AGE_B, f.age); if (b && (d.age < b.min || d.age > b.max)) return false; }
  if (f.dueb) {
    var db = by(DUE_B, f.dueb), v = d.active && i.due_on ? diff(TODAY, i.due_on) : -99999;
    if (db && (v < db.min || v > db.max)) return false;
    if (db && db.id === 'd0' && !d.active) return false;
  }
  var q = f.q.trim().toLowerCase();
  if (q) {
    var hay = [i.id, i.title, i.description, i.owner, labelOf(SOURCES, i.source), i.source_ref, i.root_cause]
      .concat(i.control_ids.map(ctlLabel), i.obligation_ids.map(oblLabel), i.actions.map(function (a) { return a.title + ' ' + a.owner; })).join(' ').toLowerCase();
    if (hay.indexOf(q) === -1) return false;
  }
  return true;
}
function cmp(a, b) {
  var da = D[a.id], db = D[b.id], s = F.sort;
  function n(x, y) { return x < y ? -1 : x > y ? 1 : 0; }
  function tie() { return n(a.due_on || '9', b.due_on || '9') || n(a.id, b.id); }
  if (s === 'due') return n(a.due_on || '9', b.due_on || '9') || n(da.sevRank, db.sevRank);
  if (s === 'severity') return n(da.sevRank, db.sevRank) || tie();
  if (s === 'age') return n(db.age, da.age) || n(a.id, b.id);
  if (s === 'status') return n(STATUS.map(function (x) { return x.id; }).indexOf(a.status), STATUS.map(function (x) { return x.id; }).indexOf(b.status)) || n(da.sevRank, db.sevRank) || tie();
  if (s === 'id') return n(b.id, a.id);
  var ga = da.active || da.accExp ? 0 : (a.status === 'risk_accepted' ? 1 : 2), gb = db.active || db.accExp ? 0 : (b.status === 'risk_accepted' ? 1 : 2);
  if (ga !== gb) return ga - gb;
  if (ga === 2) return n(b.closed_on || '', a.closed_on || '');
  var la = da.levelRank + (da.accExp ? 3 : 0), lb = db.levelRank + (db.accExp ? 3 : 0);
  return n(lb, la) || n(da.sevRank, db.sevRank) || tie();
}
function visible() { return S.issues.filter(matches).sort(cmp); }
function sameFilter(a, b) {
  return ['status', 'severity', 'source', 'owner', 'lod', 'root', 'control', 'obligation', 'age', 'dueb', 'q'].every(function (k) { return (a[k] || '') === (b[k] || ''); });
}

/* ───────── rendering: shared bits ───────── */
function chip(cls, text) { return '<span class="chip ' + cls + '">' + esc(text) + '</span>'; }
function sevChip(s) { return chip('s-' + s, labelOf(SEV, s)); }
function stChip(s) { return chip('st-' + s, labelOf(STATUS, s)); }
function flagsFor(i) {
  var d = D[i.id], f = [];
  if (d.od > 0) f.push(chip('f-bad', 'Overdue ' + d.od + 'd'));
  if (d.level === 'mgmt') f.push(chip('f-bad', 'Escalate: senior management'));
  if (d.level === 'board') f.push(chip('f-bad', 'Escalate: board or risk committee'));
  if (d.dueSoon) f.push(chip('f-warn', d.dueIn === 0 ? 'Due today' : 'Due in ' + d.dueIn + 'd'));
  if (d.actOd) f.push(chip('f-warn', plural(d.actOd, 'action') + ' overdue'));
  if (d.accExp) f.push(chip('f-bad', 'Risk acceptance expired: re-approve or remediate'));
  else if (d.accSoon) f.push(chip('f-warn', 'Acceptance expires in ' + diff(i.accepted.until, TODAY) + 'd'));
  if (d.active && d.unassigned) f.push(chip('f-warn', 'No owner'));
  if (d.active && !d.nAct && i.status !== 'awaiting_validation') f.push(chip('f-info', 'No remediation action yet'));
  if (d.active && d.beyondSla) f.push(chip('f-info', 'Due date ' + d.beyondSla + 'd beyond default SLA'));
  return f;
}
function dueCell(i) {
  var d = D[i.id];
  if (i.status === 'closed') return '<span class="mono">' + esc(fmt(i.closed_on)) + '</span><span class="rel">closed</span>';
  if (i.status === 'risk_accepted') return '<span class="mono">' + esc(fmt(i.accepted ? i.accepted.until : '')) + '</span><span class="rel' + (d.accExp ? ' bad' : '') + '">' + (d.accExp ? 'acceptance expired' : 'accepted until') + '</span>';
  var rel = d.od > 0 ? '<span class="rel bad">' + d.od + ' days overdue</span>' : (d.dueIn === 0 ? '<span class="rel">due today</span>' : '<span class="rel">in ' + plural(d.dueIn, 'day') + '</span>');
  return '<span class="mono">' + esc(fmt(i.due_on)) + '</span>' + rel;
}

/* ───────── KPIs ───────── */
function stats() {
  var act = S.issues.filter(function (i) { return D[i.id].active; });
  var closed = S.issues.filter(function (i) { return i.status === 'closed' && i.closed_on; });
  var since = addDays(TODAY, -90);
  var closed90 = closed.filter(function (i) { return i.closed_on >= since; });
  var opened90 = S.issues.filter(function (i) { return i.opened_on >= since; });
  var onTime90 = closed90.filter(function (i) { return i.closed_on <= i.due_on; });
  var over = act.filter(function (i) { return D[i.id].od > 0; });
  return {
    act: act, closed: closed, closed90: closed90, opened90: opened90, onTime90: onTime90, over: over,
    esc: over.filter(function (i) { return D[i.id].levelRank >= 2; }),
    critHigh: act.filter(function (i) { return i.severity === 'critical' || i.severity === 'high'; }),
    awaiting: S.issues.filter(function (i) { return i.status === 'awaiting_validation'; }),
    accepted: S.issues.filter(function (i) { return i.status === 'risk_accepted'; }),
    dueSoon: act.filter(function (i) { return D[i.id].dueSoon; }),
    avgAge: act.length ? Math.round(act.reduce(function (s, i) { return s + D[i.id].age; }, 0) / act.length) : 0
  };
}
function renderKpis() {
  var st = stats(), accProblem = st.accepted.filter(function (i) { return D[i.id].accExp || D[i.id].accSoon; }).length;
  $('kpis').innerHTML =
    '<div class="kpi"><div class="n mono">' + st.act.length + '</div><div class="l">Active issues</div><div class="s">' + st.critHigh.length + ' critical or high</div></div>' +
    '<div class="kpi' + (st.over.length ? ' warn' : '') + '"><div class="n mono">' + st.over.length + '</div><div class="l">Overdue</div><div class="s">' + st.esc.length + ' need escalation</div></div>' +
    '<div class="kpi"><div class="n mono">' + st.awaiting.length + '</div><div class="l">Awaiting validation</div><div class="s">remediated, not yet closed</div></div>' +
    '<div class="kpi"><div class="n mono">' + st.accepted.length + '</div><div class="l">Risk accepted</div><div class="s">' + accProblem + ' expired or expiring in 30 days</div></div>' +
    '<div class="kpi"><div class="n mono">' + st.closed90.length + '</div><div class="l">Closed, last 90 days</div><div class="s">' + st.onTime90.length + ' on or before due date</div></div>';
  var demo = S.issues.some(function (i) { return i.demo; });
  $('demoBanner').hidden = !demo;
}

/* ───────── suggestions from the control test log ───────── */
function suggestions() {
  var out = [];
  CONTROLS.forEach(function (c) {
    var log = TESTS[c.id] || [], last = log[0] || null;
    var res = last ? last.result : c.effectiveness, reasons = [], sev = 'low';
    if (res === 'failed') { reasons.push('last test failed'); sev = 'high'; }
    else if (res === 'needs_improvement') { reasons.push('last test: needs improvement'); sev = 'medium'; }
    var od = c.status === 'approved' && window.ControlsData.isOverdue(c, new Date(TODAY + 'T12:00:00'));
    if (od) { reasons.push('retest overdue'); if (sev === 'low') sev = 'medium'; }
    if (c.status === 'approved' && !c.last_tested) { reasons.push('never tested'); }
    if (!reasons.length) return;
    var key = c.id + '|' + reasons.join('+') + '|' + ((last && last.date) || c.last_tested || '');
    if (S.dismissed[key]) return;
    var has = S.issues.some(function (i) { return i.status !== 'closed' && i.control_ids.indexOf(c.id) !== -1; });
    if (has) return;
    var due = od ? window.ControlsData.nextDue(c) : null;
    var desc = [];
    if (last) desc.push('Test on ' + fmt(last.date) + ': ' + labelOfResult(last.result) + (last.note ? '. Note: ' + last.note : '') + '.');
    else if (c.last_tested) desc.push('Last tested ' + fmt(c.last_tested) + ', recorded as ' + labelOfResult(c.effectiveness) + '.');
    if (od && due) desc.push('Retest was due ' + fmt(due.toISOString().slice(0, 10)) + ' (' + c.frequency + ' cycle).');
    if (c.status === 'approved' && !c.last_tested) desc.push('The control is approved but has no test on record.');
    desc.push('Raised from the control test log. Control owner: ' + c.owner + '.');
    var title = res === 'failed' ? 'Control test failed: ' : res === 'needs_improvement' ? 'Control test needs improvement: ' : od ? 'Control retest overdue: ' : 'Control never tested: ';
    out.push({ key: key, control: c, reasons: reasons, draft: {
      title: title + c.name, description: desc.join(' '), source: 'control_test', source_ref: 'Control ' + c.id,
      severity: sev, owner: c.owner, lod: '1LOD', control_ids: [c.id], obligation_ids: (c.obligation_ids || []).slice()
    } });
  });
  return out;
}
function labelOfResult(r) { return { effective: 'effective', needs_improvement: 'needs improvement', failed: 'failed', not_tested: 'not tested' }[r] || r; }
function renderSuggestions() {
  var el = $('sugg'), list = suggestions();
  var wasOpen = el.open;
  el.innerHTML = '<summary>Suggested issues from your control tests <span class="chip ' + (list.length ? 'f-warn' : 'f-ok') + '">' + list.length + '</span></summary>' +
    (list.length
      ? '<ul class="sugg-list">' + list.map(function (s, k) {
        return '<li class="sg"><div class="t">' + esc(s.control.name) + '</div><div class="s">' + esc(s.control.id) + ' · owner ' + esc(s.control.owner) + ' · ' + esc(s.reasons.join(', ')) + '</div>' +
          '<div class="s">Suggested severity: ' + esc(labelOf(SEV, s.draft.severity)) + ' (you can change it)</div>' +
          '<div class="btns"><button type="button" class="btn sm pri" data-act="sugg-create" data-k="' + k + '">Create issue from this</button>' +
          '<button type="button" class="btn sm" data-act="sugg-dismiss" data-k="' + k + '">Dismiss</button></div></li>';
      }).join('') + '</ul><p class="hint" style="padding:0 16px 14px">Built from the control test log kept in the Compliance workspace on this device. Dismissed suggestions return only after a new test result.</p>'
      : '<p class="muted" style="padding:0 16px 14px">No control is failing its latest test or overdue for retest without an open issue. Record tests in the Compliance workspace and they appear here.</p>');
  el.open = wasOpen || (list.length > 0 && !el._seen);
  el._seen = true;
  SUGG = list;
}
var SUGG = [];

/* ───────── register ───────── */
function fillSelect(id, opts, val) {
  var el = $(id); if (!el) return;
  el.innerHTML = opts.map(function (o) { return '<option value="' + esc(o[0]) + '">' + esc(o[1]) + '</option>'; }).join('');
  el.value = val;
  if (el.value !== val) el.value = opts[0][0];
}
function renderFilters() {
  fillSelect('fStatus', [['active', 'Active (open, in progress, awaiting)'], ['attention', 'Needs attention'], ['all', 'All statuses']].concat(STATUS.map(function (s) { return [s.id, s.label]; })), F.status);
  fillSelect('fSev', [['', 'Any severity'], ['crithigh', 'Critical and high']].concat(SEV.map(function (s) { return [s.id, s.label]; })), F.severity);
  fillSelect('fSrc', [['', 'Any source']].concat(SOURCES.map(function (s) { return [s.id, s.label]; })), F.source);
  fillSelect('fOwn', [['', 'Any owner'], ['__none', 'Unassigned']].concat(uniq(S.issues.map(function (i) { return i.owner; }).filter(function (x) { return x && !/^unassigned$/i.test(x); })).sort().map(function (o) { return [o, o]; })), F.owner);
  fillSelect('fLod', [['', 'Any'], ['1LOD', '1LOD'], ['2LOD', '2LOD']], F.lod);
  fillSelect('fRoot', [['', 'Any root cause']].concat(ROOTS.map(function (r) { return [r, r]; })), F.root);
  fillSelect('fSort', SORTS.map(function (s) { return [s.id, s.label]; }), F.sort);
  if ($('fq').value !== F.q) $('fq').value = F.q;
  $('presets').innerHTML = '<span class="lbl">Views</span>' + PRESETS.map(function (p) {
    return '<button type="button" class="chip" data-act="preset" data-id="' + p.id + '" aria-pressed="' + sameFilter(F, Object.assign(defaultFilter(), p.f)) + '">' + esc(p.label) + '</button>';
  }).join('') + S.saved.map(function (s) {
    return '<span class="savedchip"><button type="button" class="chip" data-act="applysaved" data-id="' + esc(s.id) + '" aria-pressed="' + sameFilter(F, Object.assign(defaultFilter(), s.f)) + '">' + esc(s.name) + '</button>' +
      '<button type="button" class="chip x" data-act="delsaved" data-id="' + esc(s.id) + '" aria-label="Delete saved filter ' + esc(s.name) + '">×</button></span>';
  }).join('');
  var sc = [];
  if (F.control) sc.push(['control', 'Control ' + F.control]);
  if (F.obligation) sc.push(['obligation', 'Obligation ' + oblShort(F.obligation)]);
  if (F.age) sc.push(['age', 'Age ' + labelOf(AGE_B, F.age)]);
  if (F.dueb) sc.push(['dueb', labelOf(DUE_B, F.dueb)]);
  $('scope').innerHTML = sc.map(function (x) { return '<button type="button" class="chip f-info" data-act="dropscope" data-k="' + x[0] + '" aria-label="Remove filter: ' + esc(x[1]) + '">' + esc(x[1]) + ' ×</button>'; }).join('');
  $('scope').style.display = sc.length ? '' : 'none';
}
function renderList() {
  var l = visible();
  $('count').textContent = 'Showing ' + l.length + ' of ' + S.issues.length + ' issues';
  if (!S.issues.length) {
    $('list').innerHTML = '<li class="empty"><b>No issues yet</b>Use quick add above, create one with New issue, or import a CSV. Suggested issues from your control tests appear at the top.</li>';
    return;
  }
  if (!l.length) {
    $('list').innerHTML = '<li class="empty"><b>No issues match these filters</b>Clear the filters or pick another view.</li>';
    return;
  }
  $('list').innerHTML = l.map(function (i) {
    var d = D[i.id], fl = flagsFor(i);
    var links = i.obligation_ids.slice(0, 2).map(oblShort).join(', ') + (i.obligation_ids.length > 2 ? ' +' + (i.obligation_ids.length - 2) : '');
    var sub = [labelOf(SOURCES, i.source)].concat(links ? [links] : [], i.control_ids.length ? [i.control_ids.slice(0, 2).join(', ') + (i.control_ids.length > 2 ? ' +' + (i.control_ids.length - 2) : '')] : [], i.root_cause ? [i.root_cause] : []);
    return '<li class="row" data-id="' + esc(i.id) + '">' +
      '<span class="c-id">' + esc(i.id) + '</span>' +
      '<div class="c-title"><button type="button" class="rowbtn" data-act="open" data-id="' + esc(i.id) + '">' + esc(i.title) + '</button><div class="sub">' + esc(sub.join(' · ')) + (i.demo ? ' · demo' : '') + '<span class="m-only"> · ' + d.age + 'd old · ' + (d.nAct ? d.nDone + '/' + d.nAct + ' actions done' : 'no actions') + '</span></div></div>' +
      '<span class="c-sev">' + sevChip(i.severity) + '</span>' +
      '<span class="c-st">' + stChip(i.status) + '</span>' +
      '<span class="c-own"><span class="lbl">Owner</span>' + esc(d.unassigned ? 'Unassigned' : i.owner) + ' <small>' + esc(i.lod) + '</small></span>' +
      '<span class="c-due"><span class="lbl">' + (i.status === 'closed' ? 'Closed' : i.status === 'risk_accepted' ? 'Until' : 'Due') + '</span>' + dueCell(i) + '</span>' +
      '<span class="c-age mono"><span class="lbl">Age</span>' + d.age + 'd</span>' +
      '<span class="c-act"><span class="lbl">Actions</span>' + (d.nAct ? d.nDone + '/' + d.nAct : '0') + '</span>' +
      '<div class="c-flags">' + fl.join('') + '</div></li>';
  }).join('');
}

/* ───────── ageing view ───────── */
function heat(n, sev, kind, bid) {
  var cls = n === 0 ? 'h0' : (kind === 'due' ? (bid === 'd0' ? 'h1' : bid === 'd1' ? 'h2' : 'h3') : (bid === 'a0' ? 'h1' : bid === 'a1' || bid === 'a2' ? 'h2' : 'h3'));
  if (!n) return '<span class="heat h0">0</span>';
  return '<button type="button" class="heat ' + cls + '" data-act="agecell" data-kind="' + kind + '" data-sev="' + sev + '" data-b="' + bid + '" aria-label="' + n + ' ' + (sev ? labelOf(SEV, sev) : 'all') + ' issues, ' + esc(kind === 'due' ? labelOf(DUE_B, bid) : labelOf(AGE_B, bid)) + ': show them">' + n + '</button>';
}
function renderAgeing() {
  var st = stats(), act = st.act;
  function matrix(kind, buckets, valOf) {
    var rows = SEV.map(function (s) {
      var items = act.filter(function (i) { return i.severity === s.id; });
      return '<tr><th scope="row">' + esc(s.label) + '</th>' + buckets.map(function (b) {
        var n = items.filter(function (i) { var v = valOf(i); return v >= b.min && v <= b.max; }).length;
        return '<td class="num">' + heat(n, s.id, kind, b.id) + '</td>';
      }).join('') + '<td class="num">' + items.length + '</td></tr>';
    }).join('');
    var tot = '<tr class="total"><th scope="row">All</th>' + buckets.map(function (b) {
      var n = act.filter(function (i) { var v = valOf(i); return v >= b.min && v <= b.max; }).length;
      return '<td class="num">' + heat(n, '', kind, b.id) + '</td>';
    }).join('') + '<td class="num">' + act.length + '</td></tr>';
    return '<table class="tbl"><thead><tr><th scope="col">Severity</th>' + buckets.map(function (b) { return '<th scope="col" class="num">' + esc(b.label) + '</th>'; }).join('') + '<th scope="col" class="num">Total</th></tr></thead><tbody>' + rows + tot + '</tbody></table>';
  }
  var avg = SEV.map(function (s) {
    var it = act.filter(function (i) { return i.severity === s.id; });
    return '<tr><th scope="row">' + esc(s.label) + '</th><td class="num">' + it.length + '</td><td class="num">' + (it.length ? Math.round(it.reduce(function (a, i) { return a + D[i.id].age; }, 0) / it.length) : '–') + '</td><td class="num">' + (it.length ? Math.max.apply(null, it.map(function (i) { return D[i.id].age; })) : '–') + '</td></tr>';
  }).join('');
  var oldest = act.slice().sort(function (a, b) { return D[b.id].age - D[a.id].age; }).slice(0, 8);
  $('panel-ageing').innerHTML =
    '<div class="two"><div class="pane"><div class="pane-h"><h2>Age of active issues</h2><span class="hint">Days since opened. Click a count to list the issues.</span></div><div class="pane-b">' +
    (act.length ? matrix('age', AGE_B, function (i) { return D[i.id].age; }) : '<p class="muted">No active issues.</p>') + '</div></div>' +
    '<div class="pane"><div class="pane-h"><h2>Time past due date</h2><span class="hint">Active issues only. Escalation thresholds follow your SLA settings (' + CHECK_NOTE.toLowerCase() + ').</span></div><div class="pane-b">' +
    (act.length ? matrix('due', DUE_B, function (i) { return i.due_on && i.due_on < TODAY ? diff(TODAY, i.due_on) : 0; }) : '<p class="muted">No active issues.</p>') + '</div></div></div>' +
    '<div class="two" style="margin-top:16px"><div class="pane"><div class="pane-h"><h2>Average and maximum age</h2></div><div class="pane-b"><table class="tbl"><thead><tr><th scope="col">Severity</th><th scope="col" class="num">Active</th><th scope="col" class="num">Average days</th><th scope="col" class="num">Oldest days</th></tr></thead><tbody>' + avg + '</tbody></table></div></div>' +
    '<div class="pane"><div class="pane-h"><h2>Oldest active issues</h2></div><div class="pane-b">' + (oldest.length ? '<table class="tbl"><thead><tr><th scope="col">Issue</th><th scope="col">Severity</th><th scope="col" class="num">Age</th></tr></thead><tbody>' + oldest.map(function (i) {
      return '<tr><td><button type="button" class="link" data-act="open" data-id="' + esc(i.id) + '">' + esc(i.id) + '</button> ' + esc(i.title) + '</td><td>' + sevChip(i.severity) + '</td><td class="num">' + D[i.id].age + 'd</td></tr>';
    }).join('') + '</tbody></table>' : '<p class="muted">No active issues.</p>') + '</div></div></div>';
}

/* ───────── board report ───────── */
function monthsBack(n) {
  var out = [], p = TODAY.split('-'), y = +p[0], m = +p[1];
  for (var k = n - 1; k >= 0; k--) {
    var mm = m - k, yy = y; while (mm < 1) { mm += 12; yy--; }
    var start = yy + '-' + pad(mm) + '-01';
    var last = new Date(Date.UTC(yy, mm, 0)).getUTCDate();
    var end = yy + '-' + pad(mm) + '-' + pad(last); if (end > TODAY) end = TODAY;
    out.push({ y: yy, m: mm, start: start, end: end, label: new Date(Date.UTC(yy, mm - 1, 1)).toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' }), long: new Date(Date.UTC(yy, mm - 1, 1)).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }) });
  }
  return out;
}
function backlogAt(date) {
  return S.issues.filter(function (i) {
    if (i.opened_on > date) return false;
    if (i.closed_on && i.closed_on <= date) return false;
    if (i.status === 'risk_accepted' && i.accepted && i.accepted.on <= date) return false;
    return true;
  }).length;
}
function series() {
  return monthsBack(UI.months).map(function (mo) {
    return Object.assign(mo, {
      opened: S.issues.filter(function (i) { return i.opened_on >= mo.start && i.opened_on <= mo.end; }).length,
      closed: S.issues.filter(function (i) { return i.closed_on && i.closed_on >= mo.start && i.closed_on <= mo.end; }).length,
      backlog: backlogAt(mo.end)
    });
  });
}
function chartHTML(ser) {
  var max = Math.max.apply(null, [1].concat(ser.map(function (s) { return Math.max(s.opened, s.closed); })));
  var cols = ser.map(function (s) {
    return '<div class="col"><div class="bars" style="padding-top:20px">' +
      '<div class="b op" style="height:' + (s.opened / max * 100) + '%"><span>' + s.opened + '</span></div>' +
      '<div class="b cl" style="height:' + (s.closed / max * 100) + '%"><span>' + s.closed + '</span></div></div>' +
      '<div class="m">' + esc(s.label) + '</div><div class="bk" title="Open backlog at month end">' + s.backlog + '</div></div>';
  }).join('');
  var sum = ser.map(function (s) { return s.long + ': ' + s.opened + ' opened, ' + s.closed + ' closed, ' + s.backlog + ' in backlog'; }).join('; ');
  return '<div class="legend"><span><i class="op"></i>Opened</span><span><i class="cl"></i>Closed</span><span>Figure under each month: open backlog at month end</span></div>' +
    '<div class="chart" role="img" aria-label="Issues opened and closed per month. ' + esc(sum) + '" style="grid-template-columns:repeat(' + ser.length + ',minmax(0,1fr))">' + cols + '</div>' +
    '<details class="alt"><summary>Show this chart as a table</summary><table class="tbl"><caption class="sr">Issues opened, closed and open backlog by month</caption><thead><tr><th scope="col">Month</th><th scope="col" class="num">Opened</th><th scope="col" class="num">Closed</th><th scope="col" class="num">Backlog at month end</th></tr></thead><tbody>' +
    ser.map(function (s) { return '<tr><th scope="row">' + esc(s.long) + '</th><td class="num">' + s.opened + '</td><td class="num">' + s.closed + '</td><td class="num">' + s.backlog + '</td></tr>'; }).join('') + '</tbody></table></details>';
}
function barRows(items, total, cls) {
  var max = Math.max.apply(null, [1].concat(items.map(function (x) { return x[1]; })));
  return '<table class="tbl fit"><tbody>' + items.map(function (x) {
    return '<tr><th scope="row" style="font-weight:600;color:var(--text)">' + esc(x[0]) + '</th><td class="num" style="width:44px">' + x[1] + '</td><td style="width:42%"><div class="barcell"><div class="bar ' + (x[2] || cls || '') + '" style="width:' + Math.round(x[1] / max * 100) + '%"></div></div></td></tr>';
  }).join('') + '</tbody></table>';
}
function headline(st) {
  var firm = S.firm || 'The firm', p = [];
  var ch = st.critHigh.length;
  p.push('As of ' + fmt(TODAY) + ', ' + firm + ' has ' + plural(st.act.length, 'active issue') + (st.act.length ? ', of which ' + (st.act.filter(function (i) { return i.severity === 'critical'; }).length) + ' critical and ' + st.act.filter(function (i) { return i.severity === 'high'; }).length + ' high' : '') + '.');
  if (st.over.length) p.push(plural(st.over.length, 'issue is', 'issues are')  + ' past its due date' + (st.esc.length ? ', and ' + st.esc.length + (st.esc.length === 1 ? ' has' : ' have') + ' reached an escalation threshold' : '') + '.');
  else p.push('No active issue is past its due date.');
  if (st.dueSoon.length) p.push(plural(st.dueSoon.length, 'more issue') + ' fall' + (st.dueSoon.length === 1 ? 's' : '') + ' due within ' + S.cfg.dueSoon + ' days.');
  p.push('Over the last 90 days ' + plural(st.opened90.length, 'issue was', 'issues were') + ' opened and ' + plural(st.closed90.length, 'was', 'were') + ' closed' + (st.closed90.length ? ' (' + st.onTime90.length + ' on or before the due date)' : '') + '.');
  var inForce = st.accepted.filter(function (i) { return !D[i.id].accExp; }).length, exp = st.accepted.length - inForce;
  if (st.accepted.length) p.push(plural(inForce, 'risk acceptance is', 'risk acceptances are') + ' in force' + (exp ? ' and ' + exp + ' ' + (exp === 1 ? 'has' : 'have') + ' expired and needs re-approval' : '') + '.');
  if (ch === 0 && st.act.length) p.push('No critical or high issue is active.');
  return p.join(' ');
}
function rankRisks(st) {
  return st.act.slice().sort(function (a, b) {
    var da = D[a.id], db = D[b.id];
    return (db.levelRank - da.levelRank) || (da.sevRank - db.sevRank) || (db.od - da.od) || (db.age - da.age);
  }).slice(0, 5);
}
function renderReport() {
  var st = stats(), ser = series();
  var closed12 = st.closed.filter(function (i) { return i.closed_on >= addDays(TODAY, -365); });
  var onTime12 = closed12.filter(function (i) { return i.closed_on <= i.due_on; }).length;
  var rate90 = st.opened90.length ? Math.round(100 * st.closed90.length / st.opened90.length) : null;
  var sm = STATUS.map(function (s) { return s.id; });
  var matrixRows = SEV.map(function (s) {
    var it = S.issues.filter(function (i) { return i.severity === s.id; });
    return '<tr><th scope="row">' + esc(s.label) + '</th>' + sm.map(function (k) { return '<td class="num">' + it.filter(function (i) { return i.status === k; }).length + '</td>'; }).join('') + '<td class="num">' + it.length + '</td></tr>';
  }).join('');
  var matrixTot = '<tr class="total"><th scope="row">Total</th>' + sm.map(function (k) { return '<td class="num">' + S.issues.filter(function (i) { return i.status === k; }).length + '</td>'; }).join('') + '<td class="num">' + S.issues.length + '</td></tr>';
  var ageRows = AGE_B.map(function (b) { return [b.label, st.act.filter(function (i) { var a = D[i.id].age; return a >= b.min && a <= b.max; }).length]; });
  var over = st.over.slice().sort(function (a, b) { return D[b.id].od - D[a.id].od; });
  var lvlText = { overdue: 'Overdue, owner', mgmt: 'Senior management', board: 'Board or risk committee' };
  var risks = rankRisks(st);
  var rootRows = ROOTS.map(function (r) { return [r, st.act.filter(function (i) { return i.root_cause === r; }).length]; }).concat([['Not yet assessed', st.act.filter(function (i) { return !i.root_cause; }).length]]).filter(function (x) { return x[1] > 0; }).sort(function (a, b) { return b[1] - a[1]; });
  var srcRows = SOURCES.map(function (s) { return [s.label, st.act.filter(function (i) { return i.source === s.id; }).length]; }).filter(function (x) { return x[1] > 0; }).sort(function (a, b) { return b[1] - a[1]; });
  var acc = st.accepted.slice().sort(function (a, b) { return a.accepted.until < b.accepted.until ? -1 : 1; });
  var noCtl = st.act.filter(function (i) { return !i.control_ids.length; }).length;
  $('panel-report').innerHTML =
    '<div class="rep-tools"><button type="button" class="btn pri" data-act="print">Print or save as PDF</button>' +
    '<label for="repMonths" class="muted">Chart period</label><select class="sel" id="repMonths"><option value="6"' + (UI.months === 6 ? ' selected' : '') + '>Last 6 months</option><option value="12"' + (UI.months === 12 ? ' selected' : '') + '>Last 12 months</option></select>' +
    '<span class="hint">The printed version is a one-page summary for the board or an audit committee.</span></div>' +
    '<article class="board" aria-labelledby="boardH">' +
    '<h2 class="bt" id="boardH">Issues and remediation: board summary</h2>' +
    '<div class="meta"><span>' + esc(S.firm || 'Firm name not set') + '</span><span aria-hidden="true">·</span><span>As of ' + esc(fmt(TODAY)) + '</span>' + (S.issues.some(function (i) { return i.demo; }) ? '<span class="chip demo">Contains fictional demo data</span>' : '') + '</div>' +
    '<p class="headline">' + esc(headline(st)) + '</p>' +
    '<div class="bk-kpis">' +
    kpi(st.act.length, 'Active issues', st.critHigh.length + ' critical or high') +
    kpi(st.over.length, 'Overdue', st.esc.length + ' escalated', st.over.length > 0) +
    kpi(st.avgAge + 'd', 'Average age', 'active issues') +
    kpi(rate90 === null ? '–' : rate90 + '%', 'Closure rate, 90d', st.closed90.length + ' of ' + st.opened90.length + ' opened') +
    kpi(closed12.length ? Math.round(100 * onTime12 / closed12.length) + '%' : '–', 'On time, 12m', onTime12 + ' of ' + closed12.length) +
    kpi(st.accepted.length, 'Risk accepted', acc.filter(function (i) { return D[i.id].accExp; }).length + ' expired') + '</div>' +
    '<div class="board-grid wide"><div>' +
    '<div class="blk"><h3>Issues by severity and status</h3><table class="tbl"><thead><tr><th scope="col">Severity</th>' + STATUS.map(function (s) { return '<th scope="col" class="num">' + esc(s.label) + '</th>'; }).join('') + '<th scope="col" class="num">Total</th></tr></thead><tbody>' + matrixRows + matrixTot + '</tbody></table></div></div>' +
    '<div><div class="blk"><h3>Opened and closed by month</h3>' + chartHTML(ser) + '</div></div></div>' +
    '<div class="board-grid three"><div><div class="blk"><h3>Ageing of active issues <small>days since opened</small></h3>' + barRows(ageRows, st.act.length, '') + '</div></div>' +
    '<div><div class="blk"><h3>Active issues by root cause <small>default taxonomy, configure for your firm</small></h3>' + (rootRows.length ? barRows(rootRows, st.act.length, 'warn') : '<p class="muted">None.</p>') + '</div></div>' +
    '<div><div class="blk"><h3>Active issues by source</h3>' + (srcRows.length ? barRows(srcRows, st.act.length, '') : '<p class="muted">None.</p>') + '</div></div></div>' +
    '<div class="blk"><h3>Top risks <small>ordered by escalation level, then severity, then days overdue</small></h3>' + (risks.length ? '<table class="tbl"><thead><tr><th scope="col">Issue</th><th scope="col">Severity</th><th scope="col">Status</th><th scope="col">Owner</th><th scope="col" class="num">Age</th><th scope="col">Why it ranks here</th></tr></thead><tbody>' +
      risks.map(function (i) {
        var d = D[i.id], why = [];
        if (d.od) why.push(d.od + 'd overdue' + (d.levelRank >= 2 ? ', ' + lvlText[d.level].toLowerCase() : ''));
        if (!i.control_ids.length) why.push('no linked control');
        if (d.actOd) why.push(plural(d.actOd, 'action') + ' overdue');
        if (!why.length) why.push(labelOf(SEV, i.severity).toLowerCase() + ' severity');
        return '<tr><td><span class="mono">' + esc(i.id) + '</span> ' + esc(i.title) + '</td><td>' + sevChip(i.severity) + '</td><td>' + stChip(i.status) + '</td><td>' + esc(i.owner || 'Unassigned') + '</td><td class="num">' + d.age + 'd</td><td>' + esc(why.join('; ')) + '</td></tr>';
      }).join('') + '</tbody></table>' : '<p class="muted">No active issues.</p>') + '</div>' +
    '<div class="board-grid"><div><div class="blk"><h3>Overdue and escalated <small>' + (over.length > 6 ? 'six longest of ' + over.length : over.length + ' in total') + '</small></h3>' + (over.length ? '<table class="tbl"><thead><tr><th scope="col">Issue</th><th scope="col">Owner</th><th scope="col" class="num">Days</th><th scope="col">Escalation level</th></tr></thead><tbody>' +
      over.slice(0, 6).map(function (i) { return '<tr><td><span class="mono">' + esc(i.id) + '</span> ' + esc(i.title) + '</td><td>' + esc(i.owner || 'Unassigned') + '</td><td class="num">' + D[i.id].od + '</td><td>' + esc(lvlText[D[i.id].level]) + '</td></tr>'; }).join('') + '</tbody></table>' : '<p class="muted">Nothing is overdue.</p>') + '</div></div>' +
    '<div><div class="blk"><h3>Risk acceptances</h3>' + (acc.length ? '<table class="tbl"><thead><tr><th scope="col">Issue</th><th scope="col">Approved by</th><th scope="col">Expires</th></tr></thead><tbody>' +
      acc.map(function (i) { return '<tr><td><span class="mono">' + esc(i.id) + '</span> ' + esc(i.title) + '</td><td>' + esc(i.accepted.by) + '</td><td>' + esc(fmt(i.accepted.until)) + (D[i.id].accExp ? ' (expired)' : '') + '</td></tr>'; }).join('') + '</tbody></table>' : '<p class="muted">None.</p>') + '</div></div></div>' +
    '<div class="blk"><h3>Management commentary</h3>' +
    '<label class="sr" for="repComm">Management commentary</label><textarea class="in screen-only" id="repComm" placeholder="Add context for the board: causes, decisions needed, resourcing asks.">' + esc(S.report.commentary) + '</textarea>' +
    '<div class="commentary-box print-only" id="repCommPrint">' + esc(S.report.commentary || 'No commentary added.') + '</div>' +
    '<div class="signoff"><div class="field"><label for="repBy">Prepared by</label><input class="in" id="repBy" value="' + esc(S.report.by) + '" maxlength="80"></div><div class="field"><label for="repDate">Date</label><input class="in" id="repDate" value="' + esc(fmt(TODAY)) + '" readonly></div></div></div>' +
    '<p class="caveat">Method: active means open, in progress or awaiting validation. Overdue compares each due date with today. Escalation thresholds and SLA days are defaults, configure for your firm (' + SEV.map(function (s) { return s.label + ' ' + sevCfg(s.id).sla + 'd'; }).join(', ') + '). Closure rate is issues closed divided by issues opened in the last 90 days. The figure under each month in the chart is the open backlog at month end. ' +
    (noCtl ? noCtl + ' active ' + (noCtl === 1 ? 'issue has' : 'issues have') + ' no linked control. ' : '') +
    'Figures come from the register held on this device and are management information, not an audit opinion or legal advice.</p>' +
    '</article>';
}
function kpi(n, l, s, warn) { return '<div class="kpi' + (warn ? ' warn' : '') + '"><div class="n mono">' + esc(n) + '</div><div class="l">' + esc(l) + '</div><div class="s">' + esc(s) + '</div></div>'; }

/* Wide tables scroll inside their own focusable region instead of widening the page. */
function wrapTables(root) {
  root.querySelectorAll('table.tbl').forEach(function (t) {
    if (t.parentNode.classList.contains('tbl-wrap')) return;
    var h = t.closest('.blk,.pane,section') && t.closest('.blk,.pane,section').querySelector('h2,h3'), w = document.createElement('div');
    w.className = 'tbl-wrap'; w.tabIndex = 0; w.setAttribute('role', 'region'); w.setAttribute('aria-label', (h ? h.textContent.trim() : 'Table') + ' (scrollable table)');
    t.parentNode.insertBefore(w, t); w.appendChild(t);
  });
}
/* ───────── render orchestration ───────── */
function renderAll() {
  renderKpis();
  if (UI.tab === 'register') { renderSuggestions(); renderFilters(); renderList(); }
  else if (UI.tab === 'ageing') { renderAgeing(); wrapTables($('panel-ageing')); }
  else { renderReport(); wrapTables($('panel-report')); }
}
function setTab(tab, focus) {
  UI.tab = tab;
  ['register', 'ageing', 'report'].forEach(function (t) {
    $('panel-' + t).hidden = t !== tab;
    var b = $('tab-' + t); b.setAttribute('aria-selected', t === tab); b.tabIndex = t === tab ? 0 : -1;
  });
  if (focus) $('tab-' + tab).focus();
  try { history.replaceState(null, '', location.pathname + location.search + (tab === 'register' ? '' : '#' + tab)); } catch (e) {}
  renderAll();
}

/* ═══════════ dialogs ═══════════ */
function openDlg(dlg) { if (!dlg.open) dlg.showModal(); }
function ownerList() { return '<datalist id="dlOwners">' + owners().map(function (o) { return '<option value="' + esc(o) + '">'; }).join('') + '</datalist>'; }
function fieldHTML(f) {
  var id = 'df-' + f.id, v = f.value == null ? '' : f.value, req = f.required ? ' aria-required="true"' : '', cls = f.full === false ? '' : ' full';
  var ctl;
  if (f.type === 'textarea') ctl = '<textarea class="in" id="' + id + '" rows="3"' + req + '>' + esc(v) + '</textarea>';
  else if (f.type === 'select') ctl = '<select class="sel" id="' + id + '"' + req + '>' + f.options.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (o[0] === v ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>';
  else ctl = '<input class="in" id="' + id + '" type="' + (f.type || 'text') + '" value="' + esc(v) + '"' + req + (f.list ? ' list="dlOwners"' : '') + (f.min ? ' min="' + f.min + '"' : '') + ' autocomplete="off">';
  return '<div class="field' + cls + '"><label for="' + id + '">' + esc(f.label) + (f.required ? ' (required)' : '') + '</label>' + ctl + (f.hint ? '<div class="hint">' + esc(f.hint) + '</div>' : '') + '</div>';
}
/* Generic small dialog. spec: {title, intro, fields[], submit, danger, onSubmit(vals) -> error string | falsy} */
function decide(spec) {
  var dlg = $('dlgDecide'), invoker = document.activeElement, ifk = invoker && invoker.getAttribute ? invoker.getAttribute('data-fk') : null;
  dlg.innerHTML = '<form method="dialog" id="decForm" novalidate>' +
    '<div class="dlg-h"><h2 id="decTitle">' + esc(spec.title) + '</h2><button type="button" class="btn x" data-act="dec-cancel" aria-label="Close dialog">×</button></div>' +
    '<div class="dlg-b">' + (spec.intro ? '<p class="muted" style="margin-bottom:12px">' + esc(spec.intro) + '</p>' : '') + ownerList() +
    (spec.fields && spec.fields.length ? '<div class="fields">' + spec.fields.map(fieldHTML).join('') + '</div>' : '') +
    '<p class="err" id="decErr" role="alert"></p></div>' +
    '<div class="dlg-f"><button type="button" class="btn" data-act="dec-cancel">Cancel</button><button type="submit" class="btn ' + (spec.danger ? 'danger' : 'pri') + '">' + esc(spec.submit || 'Save') + '</button></div></form>';
  dlg.onclose = function () {
    dlg.onclose = null;
    if (invoker && invoker.isConnected) { try { invoker.focus(); } catch (e) {} return; }
    var t = ifk && $('dlgIssue').open ? $('dlgIssue').querySelector('[data-fk="' + ifk + '"]') : null;
    if (!t && $('dlgIssue').open) t = $('sheetTitle');
    if (t) t.focus();
  };
  $('decForm').onsubmit = function (e) {
    e.preventDefault();
    var vals = {}, bad = null;
    (spec.fields || []).forEach(function (f) {
      var v = $('df-' + f.id).value.trim(); vals[f.id] = v;
      if (f.required && !v && !bad) bad = f;
    });
    if (bad) { $('decErr').textContent = bad.label + ' is required.'; $('df-' + bad.id).focus(); return; }
    var err = spec.onSubmit(vals);
    if (err) { $('decErr').textContent = err; return; }
    dlg.close();
  };
  openDlg(dlg);
  var first = dlg.querySelector('input,textarea,select'); if (first) first.focus();
}

/* ───────── issue sheet ───────── */
function sheetFormHTML(W, locked) {
  var dis = locked ? ' disabled' : '';
  function opt(list, v, blank) { return (blank ? '<option value="">' + esc(blank) + '</option>' : '') + list.map(function (o) { var id = o.id || o, l = o.label || o; return '<option value="' + esc(id) + '"' + (id === v ? ' selected' : '') + '>' + esc(l) + '</option>'; }).join(''); }
  return '<form id="issueForm" novalidate autocomplete="off"><div class="fields">' +
    '<div class="field full"><label for="i-title">Title (required)</label><input class="in" id="i-title" name="title" value="' + esc(W.title) + '" maxlength="200" aria-required="true"' + dis + '></div>' +
    '<div class="field full"><label for="i-desc">Description</label><textarea class="in" id="i-desc" name="description" rows="3"' + dis + '>' + esc(W.description) + '</textarea></div>' +
    '<div class="field"><label for="i-src">Source</label><select class="sel" id="i-src" name="source"' + dis + '>' + opt(SOURCES, W.source) + '</select></div>' +
    '<div class="field"><label for="i-ref">Source reference</label><input class="in" id="i-ref" name="source_ref" value="' + esc(W.source_ref) + '" maxlength="120" placeholder="Report number, letter date, test id"' + dis + '></div>' +
    '<div class="field"><label for="i-sev">Severity</label><select class="sel" id="i-sev" name="severity"' + dis + '>' + opt(SEV, W.severity) + '</select></div>' +
    '<div class="field"><label for="i-root">Root-cause category</label><select class="sel" id="i-root" name="root_cause"' + dis + '>' + opt(ROOTS, W.root_cause, 'Not yet assessed') + '</select><div class="hint">Default taxonomy, configure for your firm.</div></div>' +
    '<div class="field"><label for="i-own">Owner</label><input class="in" id="i-own" name="owner" value="' + esc(W.owner) + '" list="dlOwners" maxlength="80" placeholder="Name of the accountable person"' + dis + '></div>' +
    '<div class="field"><label for="i-lod">Owning line of defence</label><select class="sel" id="i-lod" name="lod"' + dis + '><option value="1LOD"' + (W.lod === '1LOD' ? ' selected' : '') + '>1LOD (business, control owner)</option><option value="2LOD"' + (W.lod === '2LOD' ? ' selected' : '') + '>2LOD (compliance, risk)</option></select></div>' +
    '<div class="field"><label for="i-open">Opened on</label><input class="in" id="i-open" name="opened_on" type="date" value="' + esc(W.opened_on) + '"' + dis + '></div>' +
    '<div class="field"><label for="i-due">Due date</label><input class="in" id="i-due" name="due_on" type="date" value="' + esc(W.due_on) + '"' + dis + '><div class="hint" id="slaHint"></div></div>' +
    '</div><p class="err" id="formErr" role="alert"></p></form>';
}
function slaHintHTML(W) {
  var tgt = slaDue(W.severity, W.opened_on);
  return 'Default SLA for ' + labelOf(SEV, W.severity) + ': ' + sevCfg(W.severity).sla + ' days, target ' + fmt(tgt) + ' (' + CHECK_NOTE.toLowerCase() + '). ' +
    (W.due_on !== tgt && !SH.locked ? '<button type="button" class="link" data-act="usesla">Use SLA target</button>' : '');
}
function linkChips(kind, ids, locked) {
  return ids.map(function (id) {
    var href = kind === 'c' ? 'workspace.html?view=controls&control=' + encodeURIComponent(id) : 'workspace.html?open=' + encodeURIComponent(id);
    var label = kind === 'c' ? ctlLabel(id) : oblLabel(id);
    return '<span class="lk"><a href="' + href + '" title="Open in the Compliance workspace">' + esc(label) + '</a>' + (locked ? '' : '<button type="button" data-act="unlink" data-kind="' + kind + '" data-id="' + esc(id) + '" aria-label="Remove link to ' + esc(label) + '">×</button>') + '</span>';
  }).join('');
}
function renderLinks() {
  var W = SH.W, locked = SH.locked;
  var cOpts = CONTROLS.filter(function (c) { return W.control_ids.indexOf(c.id) === -1; });
  var oOpts = OBS.filter(function (o) { return W.obligation_ids.indexOf(o.id) === -1; });
  $('shLinks').innerHTML =
    '<div class="two"><div><h4 style="font-size:13px;margin-bottom:6px">Controls</h4><div class="links">' + (W.control_ids.length ? linkChips('c', W.control_ids, locked) : '<span class="hint">No control linked.</span>') + '</div>' +
    (locked ? '' : '<label class="sr" for="addCtl">Link a control</label><select class="sel" id="addCtl" data-act-change="addlink" data-kind="c"><option value="">Link a control…</option>' + cOpts.map(function (c) { return '<option value="' + esc(c.id) + '">' + esc(c.id + ' · ' + c.name) + '</option>'; }).join('') + '</select>') + '</div>' +
    '<div><h4 style="font-size:13px;margin-bottom:6px">Obligations</h4><div class="links">' + (W.obligation_ids.length ? linkChips('o', W.obligation_ids, locked) : '<span class="hint">No obligation linked.</span>') + '</div>' +
    (locked ? '' : '<label class="sr" for="addObl">Link an obligation</label><select class="sel" id="addObl" data-act-change="addlink" data-kind="o"><option value="">Link an obligation…</option>' + oOpts.map(function (o) { return '<option value="' + esc(o.id) + '">' + esc(o.legal_basis + ' · ' + oblTitle(o)) + '</option>'; }).join('') + '</select>') + '</div></div>';
}
function flowHTML(i) {
  var s = i.status, d = D[i.id], b = [], note = '';
  function btn(label, act, to, cls) { return '<button type="button" class="btn sm ' + (cls || '') + '" data-act="' + act + '"' + (to ? ' data-to="' + to + '"' : '') + ' data-fk="flow-' + (to || act) + '">' + esc(label) + '</button>'; }
  if (s === 'open') { b.push(btn('Start work', 'flow', 'in_progress', 'pri'), btn('Accept risk…', 'accept')); note = 'Next: start work, add remediation actions below, then submit for validation.'; }
  if (s === 'in_progress') { b.push(btn('Submit for validation', 'flow', 'awaiting_validation', 'pri'), btn('Accept risk…', 'accept')); note = 'To submit for validation, add at least one remediation action and mark every action done with an evidence note (' + (d.nAct - d.nDone) + ' not done yet).'; }
  if (s === 'awaiting_validation') { b.push(btn('Validate and close…', 'closedlg', '', 'pri'), btn('Send back…', 'sendback'), btn('Accept risk…', 'accept')); note = 'Closure needs a validator other than the issue owner and a closure note.'; }
  if (s === 'risk_accepted') { b.push(btn('Renew acceptance…', 'accept', '', ''), btn('Resume remediation', 'flow', 'in_progress', 'pri')); note = 'Accepted by ' + (i.accepted ? i.accepted.by : '') + ' until ' + fmt(i.accepted ? i.accepted.until : '') + (d.accExp ? '. This acceptance has expired: renew it or resume remediation.' : '.'); }
  if (s === 'closed') { b.push(btn('Reopen…', 'reopen')); note = 'Closed issues are read-only. Reopen to change them.'; }
  return '<div class="flow">' + stChip(s) + b.join('') + '</div><div class="flow-note">' + esc(note) + '</div><p class="err" id="flowErr" role="alert"></p>';
}
function renderChips() {
  var i = SH.isNew ? null : issue(SH.id);
  var chips = [];
  if (i) { chips.push(sevChip(i.severity), stChip(i.status)); flagsFor(i).forEach(function (f) { chips.push(f); }); }
  else chips.push(chip('f-info', 'New issue'));
  $('shChips').innerHTML = '<span class="mono">' + esc(i ? i.id : 'Not yet saved') + '</span>' + chips.join('') + (i && i.demo ? chip('demo', 'Demo data') : '');
}
function renderActions() {
  var i = issue(SH.id), locked = SH.locked;
  $('shActs').innerHTML = (i.actions.length ? '<ul class="acts">' + i.actions.map(function (a) {
    var od = a.status !== 'done' && a.due_on && a.due_on < TODAY && D[i.id].active;
    return '<li class="act"><div><div class="t">' + (a.status === 'done' ? chip('f-ok', 'Done') : chip(od ? 'f-bad' : 'st-open', od ? 'Overdue ' + diff(TODAY, a.due_on) + 'd' : 'Open')) + ' ' + esc(a.title) + '</div>' +
      '<div class="s">Owner ' + esc(a.owner || 'unassigned') + ' · due ' + esc(fmt(a.due_on)) + (a.status === 'done' ? ' · done ' + esc(fmt(a.done_on)) : '') + '</div>' +
      '<div class="ev">' + (a.evidence ? 'Evidence: ' + esc(a.evidence) : '<span class="hint">No evidence note yet.</span>') + '</div></div>' +
      (locked ? '' : '<div class="btns">' + (a.status === 'done'
        ? '<button type="button" class="btn sm" data-act="act-undo" data-id="' + esc(a.id) + '">Reopen</button>'
        : '<button type="button" class="btn sm pri" data-act="act-done" data-id="' + esc(a.id) + '" data-fk="act-done-' + esc(a.id) + '">Mark done…</button>') +
        '<button type="button" class="btn sm" data-act="act-edit" data-id="' + esc(a.id) + '" data-fk="act-edit-' + esc(a.id) + '">Edit</button>' +
        '<button type="button" class="btn sm danger" data-act="act-del" data-id="' + esc(a.id) + '">Remove</button></div>') + '</li>';
  }).join('') + '</ul>' : '<p class="muted">No remediation actions yet. Add the steps that will fix the root cause, each with an owner and a due date.</p>') +
    (locked ? '' : '<div style="margin-top:10px"><button type="button" class="btn sm" data-act="act-add" data-fk="act-add">Add remediation action</button></div>');
}
function renderOutcome() {
  var i = issue(SH.id), h = '';
  if (i.status === 'closed') h = '<div class="outcome"><b>Closed ' + esc(fmt(i.closed_on)) + '</b>, validated by ' + esc(i.closed_by || 'unknown') + (i.closed_on > i.due_on ? ' (' + diff(i.closed_on, i.due_on) + ' days after the due date)' : ' (on time)') + '.<br>' + esc(i.closure_note || '') + '</div>';
  if (i.status === 'risk_accepted' && i.accepted) h = '<div class="outcome' + (D[i.id].accExp ? ' bad' : '') + '"><b>Risk accepted by ' + esc(i.accepted.by) + '</b> on ' + esc(fmt(i.accepted.on)) + ', valid until ' + esc(fmt(i.accepted.until)) + (D[i.id].accExp ? ' (expired)' : '') + '.<br>Rationale: ' + esc(i.accepted.rationale) + '</div>';
  $('shOutcome').innerHTML = h; $('shOutcomeWrap').style.display = h ? '' : 'none';
}
function renderHist() {
  var i = issue(SH.id);
  $('shHist').innerHTML = '<ol class="hist">' + i.history.slice().reverse().map(function (h) { return '<li><span class="d">' + esc(fmt(h.d)) + '</span><span>' + esc(h.t) + '</span></li>'; }).join('') + '</ol>';
}
function renderSheetParts(fk) {
  if (!SH) return;
  var dlg = $('dlgIssue'), scroll = dlg.querySelector('.dlg-b'), top = scroll ? scroll.scrollTop : 0;
  var active = document.activeElement && document.activeElement.getAttribute ? document.activeElement.getAttribute('data-fk') : null;
  renderChips(); renderLinks();
  if (!SH.isNew) {
    var i = issue(SH.id);
    $('shFlow').innerHTML = flowHTML(i); renderActions(); renderOutcome(); renderHist();
    $('sheetTitle').textContent = i.title;
  }
  $('slaHint').innerHTML = slaHintHTML(SH.W);
  scroll.scrollTop = top;
  var want = fk || active;
  if (want) { var t = dlg.querySelector('[data-fk="' + want + '"]'); if (t) t.focus(); }
}
function openSheet(id, draft, keepInvoker) {
  var dlg = $('dlgIssue');
  var isNew = !id, i = id ? issue(id) : null;
  if (id && !i) return;
  var W = isNew ? blankIssue(draft) : i;
  SH = { id: id, isNew: isNew, W: isNew ? W : i, invoker: keepInvoker || document.activeElement, locked: !isNew && i.status === 'closed', dueTouched: false };
  var title = isNew ? (W.title || 'New issue') : i.title;
  dlg.innerHTML = '<div class="dlg-h"><div><div class="idl" id="shChips"></div><h2 id="sheetTitle" tabindex="-1">' + esc(title) + '</h2></div><button type="button" class="btn x" data-act="sheet-close" aria-label="Close issue">×</button></div>' +
    '<div class="dlg-b">' + ownerList() +
    (isNew ? '' : '<section class="sec" aria-labelledby="h-flow"><h3 id="h-flow">Workflow</h3><div id="shFlow"></div></section>') +
    '<section class="sec" aria-labelledby="h-det"><h3 id="h-det">Details' + (isNew ? '' : ' <span class="hint">(changes save as you go)</span>') + '</h3>' + sheetFormHTML(W, SH.locked) + '</section>' +
    '<section class="sec" aria-labelledby="h-lnk"><h3 id="h-lnk">Linked controls and obligations</h3><div id="shLinks"></div></section>' +
    (isNew ? '<p class="hint">After you create the issue you can add remediation actions with owners, due dates and evidence.</p>' :
      '<section class="sec" aria-labelledby="h-act"><h3 id="h-act">Remediation actions</h3><div id="shActs"></div></section>' +
      '<section class="sec" id="shOutcomeWrap" aria-labelledby="h-out"><h3 id="h-out">Outcome</h3><div id="shOutcome"></div></section>' +
      '<section class="sec" aria-labelledby="h-his"><h3 id="h-his">History</h3><div id="shHist"></div></section>') +
    '</div><div class="dlg-f">' + (isNew ? '<button type="button" class="btn" data-act="sheet-close">Cancel</button><button type="button" class="btn pri" data-act="sheet-create">Create issue</button>'
      : '<button type="button" class="btn danger sp" data-act="del-issue">Delete issue</button><button type="button" class="btn" data-act="sheet-close">Close</button>') + '</div>';
  dlg.onclose = function () {
    var inv = SH && SH.invoker, last = SH && SH.id;
    dlg.onclose = null; SH = null;
    try { history.replaceState(null, '', location.pathname + location.search + (UI.tab === 'register' ? '' : '#' + UI.tab)); } catch (e) {}
    if (last) UI.lastId = last;
    var b = last && document.querySelector('.rowbtn[data-id="' + last + '"]');
    if (b) b.focus(); else if (inv && inv.isConnected) inv.focus();
  };
  openDlg(dlg);
  renderSheetParts();
  if (!isNew) { try { history.replaceState(null, '', location.pathname + location.search + '#' + id); } catch (e) {} }
  var f = $('i-title'); if (f && isNew) f.focus(); else $('sheetTitle').focus();
}
function readForm() {
  var f = $('issueForm'), v = {};
  ['title', 'description', 'source', 'source_ref', 'severity', 'root_cause', 'owner', 'lod', 'opened_on', 'due_on'].forEach(function (k) { v[k] = f.elements[k].value.trim(); });
  return v;
}
function validateFields(v) {
  if (!v.title) return ['title', 'Title is required.'];
  if (!validISO(v.opened_on)) return ['opened_on', 'Opened on must be a valid date.'];
  if (!validISO(v.due_on)) return ['due_on', 'Due date must be a valid date.'];
  if (v.due_on < v.opened_on) return ['due_on', 'The due date cannot be before the opened date.'];
  return null;
}
function commitField(name) {
  var i = issue(SH.id), f = $('issueForm'), el = f.elements[name], nv = el.value.trim(), ov = i[name];
  if (nv === (ov || '')) return;
  var v = readForm(), bad = validateFields(v);
  if (bad) { $('formErr').textContent = bad[1]; el.value = ov || ''; el.focus(); return; }
  $('formErr').textContent = '';
  i[name] = nv;
  var lab = { title: 'Title', description: 'Description', source: 'Source', source_ref: 'Source reference', severity: 'Severity', root_cause: 'Root cause', owner: 'Owner', lod: 'Line of defence', opened_on: 'Opened date', due_on: 'Due date' }[name];
  if (name === 'due_on') log(i, 'Due date moved from ' + fmt(ov) + ' to ' + fmt(nv));
  else if (name === 'severity') log(i, 'Severity changed from ' + labelOf(SEV, ov) + ' to ' + labelOf(SEV, nv));
  else if (name === 'owner') log(i, 'Owner changed from ' + (ov || 'unassigned') + ' to ' + (nv || 'unassigned'));
  else if (name !== 'description') log(i, lab + ' updated');
  else log(i, 'Description updated');
  touch(); toast('Saved');
}
function createFromSheet() {
  var v = readForm(), bad = validateFields(v);
  if (bad) { $('formErr').textContent = bad[1]; $('i-' + ({ title: 'title', opened_on: 'open', due_on: 'due' }[bad[0]])).focus(); return; }
  var W = SH.W, i = blankIssue(Object.assign({}, v, { control_ids: W.control_ids.slice(), obligation_ids: W.obligation_ids.slice() }));
  addIssue(i);
  if (W.fromSugg) delete S.dismissed[W.fromSugg];
  recompute(); persist();
  var dlg = $('dlgIssue'); dlg.onclose = null; dlg.close(); SH = null;
  UI.lastId = i.id; renderAll();
  openSheet(i.id);
  toast('Issue ' + i.id + ' created. Add remediation actions below.');
}

/* ───────── workflow transitions ───────── */
function flowTo(to) {
  var i = issue(SH.id), err = $('flowErr');
  if (to === 'in_progress') {
    log(i, i.status === 'risk_accepted' ? 'Risk acceptance withdrawn, remediation resumed' : 'Work started');
    i.status = 'in_progress'; if (i.accepted) { i.accepted = null; }
    touch(); return;
  }
  if (to === 'awaiting_validation') {
    var d = D[i.id];
    if (!d.nAct) { err.textContent = 'Add at least one remediation action first.'; return; }
    if (d.nDone < d.nAct) { err.textContent = 'Mark all ' + d.nAct + ' remediation actions done with an evidence note first (' + (d.nAct - d.nDone) + ' open).'; return; }
    i.status = 'awaiting_validation'; i.submitted_on = TODAY; log(i, 'Submitted for validation'); touch(); toast('Submitted for validation'); return;
  }
}
function dlgClose(i) {
  decide({
    title: 'Validate and close ' + i.id, intro: 'Closure records who validated that the remediation worked. The validator should be independent of the owner.',
    fields: [
      { id: 'by', label: 'Validated by', required: true, list: true, value: '' },
      { id: 'on', label: 'Closed on', type: 'date', required: true, value: TODAY, full: false },
      { id: 'note', label: 'Closure note (what was checked)', type: 'textarea', required: true, value: '' }],
    submit: 'Close issue',
    onSubmit: function (v) {
      if (!validISO(v.on) || v.on < i.opened_on) return 'Closed on must be a valid date on or after the opened date.';
      if (i.owner && v.by.toLowerCase() === i.owner.trim().toLowerCase()) return 'The validator must be someone other than the issue owner (' + i.owner + ').';
      i.status = 'closed'; i.closed_on = v.on; i.closed_by = v.by; i.closure_note = v.note;
      log(i, 'Closed. Validated by ' + v.by + (v.on > i.due_on ? ' (' + diff(v.on, i.due_on) + ' days after due date)' : ' (on time)'));
      touch(); rebuildSheet(); toast('Issue closed'); return null;
    }
  });
}
function rebuildSheet() { var id = SH.id, inv = SH.invoker; openSheet(id, null, inv); }
function dlgAccept(i) {
  var cur = i.accepted;
  decide({
    title: (i.status === 'risk_accepted' ? 'Renew risk acceptance for ' : 'Accept risk for ') + i.id,
    intro: 'Accepting a risk means choosing not to remediate it for now. Record who approved it, why, and when the acceptance must be reviewed. The approver should have authority under your own risk-acceptance policy.',
    fields: [
      { id: 'by', label: 'Approved by', required: true, list: true, value: cur ? cur.by : '' },
      { id: 'until', label: 'Acceptance expires on', type: 'date', required: true, value: cur && cur.until > TODAY ? cur.until : addDays(TODAY, 180), full: false, hint: 'Suggested 180 days: ' + CHECK_NOTE.toLowerCase() + '.' },
      { id: 'why', label: 'Rationale', type: 'textarea', required: true, value: cur ? cur.rationale : '' }],
    submit: 'Record acceptance',
    onSubmit: function (v) {
      if (!validISO(v.until) || v.until <= TODAY) return 'The expiry must be a valid date after today.';
      i.accepted = { by: v.by, until: v.until, on: TODAY, rationale: v.why };
      log(i, 'Risk accepted by ' + v.by + ' until ' + fmt(v.until)); i.status = 'risk_accepted'; touch(); toast('Risk acceptance recorded'); return null;
    }
  });
}
function dlgReason(i, kind) {
  var map = { sendback: ['Send ' + i.id + ' back', 'Validation did not confirm the fix. Say what is missing.', 'in_progress', 'Sent back from validation', 'Send back'], reopen: ['Reopen ' + i.id, 'Say why this issue is being reopened.', 'in_progress', 'Reopened', 'Reopen issue'] }[kind];
  decide({
    title: map[0], intro: map[1], fields: [{ id: 'why', label: 'Reason', type: 'textarea', required: true, value: '' }], submit: map[4],
    onSubmit: function (v) {
      var wasClosed = i.status === 'closed';
      i.status = map[2]; i.submitted_on = '';
      if (wasClosed) { i.closed_on = ''; i.closed_by = ''; i.closure_note = ''; }
      log(i, map[3] + ': ' + v.why);
      if (wasClosed) { touch(); rebuildSheet(); toast('Issue reopened'); return null; }
      touch(); toast('Status updated'); return null;
    }
  });
}

/* ───────── remediation actions ───────── */
function actionDialog(i, a) {
  var isNew = !a;
  decide({
    title: isNew ? 'Add remediation action' : 'Edit remediation action',
    fields: [
      { id: 'title', label: 'What will be done', required: true, value: a ? a.title : '' },
      { id: 'owner', label: 'Owner', required: true, list: true, value: a ? a.owner : (i.owner && !/^unassigned$/i.test(i.owner) ? i.owner : ''), full: false },
      { id: 'due', label: 'Due date', type: 'date', required: true, value: a ? a.due_on : i.due_on, full: false },
      { id: 'ev', label: 'Evidence note', type: 'textarea', value: a ? a.evidence : '', hint: 'What proves it is done: document, ticket, test, screenshot reference.' }],
    submit: isNew ? 'Add action' : 'Save action',
    onSubmit: function (v) {
      if (!validISO(v.due)) return 'Due date must be a valid date.';
      if (isNew) {
        var n = i.actions.reduce(function (m, x) { return Math.max(m, parseInt(String(x.id).replace(/\D/g, ''), 10) || 0); }, 0) + 1;
        i.actions.push({ id: 'A' + n, title: v.title, owner: v.owner, due_on: v.due, status: 'open', done_on: '', evidence: v.ev });
        log(i, 'Action added: ' + v.title);
      } else {
        a.title = v.title; a.owner = v.owner; a.due_on = v.due; a.evidence = v.ev; log(i, 'Action updated: ' + v.title);
      }
      touch(); return null;
    }
  });
}
function actionDone(i, a) {
  decide({
    title: 'Mark action done', intro: a.title,
    fields: [
      { id: 'on', label: 'Done on', type: 'date', required: true, value: TODAY, full: false },
      { id: 'ev', label: 'Evidence note', type: 'textarea', required: true, value: a.evidence, hint: 'Evidence first: say what proves this is done.' }],
    submit: 'Mark done',
    onSubmit: function (v) {
      if (!validISO(v.on)) return 'Done on must be a valid date.';
      a.status = 'done'; a.done_on = v.on; a.evidence = v.ev; log(i, 'Action done: ' + a.title); touch(); return null;
    }
  });
}

/* ───────── new issue entry points ───────── */
function newIssue(draft) { openSheet(null, draft || {}); }
function quickAdd() {
  var t = $('qaTitle'), title = t.value.trim();
  if (!title) { toast('Type a short description first'); t.focus(); return; }
  var sev = $('qaSev').value;
  var i = addIssue(blankIssue({ title: title, severity: sev, owner: '', lod: '2LOD', due_on: slaDue(sev, TODAY) }));
  t.value = ''; F = Object.assign(F, { status: 'active', q: '' });
  recompute(); persist(); renderAll();
  toast('Added ' + i.id + '. Open it to set the owner and add actions.');
  t.focus();
}

/* ═══════════ CSV ═══════════ */
var CSV_COLS = ['id', 'title', 'description', 'source', 'source_ref', 'severity', 'root_cause', 'owner', 'lod', 'status', 'opened_on', 'due_on', 'closed_on', 'closed_by', 'closure_note', 'control_ids', 'obligation_ids', 'risk_accepted_by', 'risk_accepted_until', 'risk_accepted_rationale', 'actions'];
function csvCell(v) {
  v = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(v)) v = "'" + v;
  return /[",;\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
}
function csvClean(v) { return /^'[=+\-@\t\r]/.test(v) ? v.slice(1) : v; }
function encActions(acts) {
  return acts.map(function (a) { return [a.title, a.owner, a.due_on, a.status === 'done' ? 'done' : 'open', a.evidence].map(function (x) { return String(x || '').replace(/\s*\|\|\s*/g, ' | ').replace(/\s*~\s*/g, ' - '); }).join(' ~ '); }).join(' || ');
}
function issuesCSV() {
  var rows = [CSV_COLS.join(',')];
  S.issues.forEach(function (i) {
    var a = i.accepted || {};
    rows.push([i.id, i.title, i.description, labelOf(SOURCES, i.source), i.source_ref, labelOf(SEV, i.severity), i.root_cause, i.owner, i.lod, labelOf(STATUS, i.status), i.opened_on, i.due_on, i.closed_on, i.closed_by, i.closure_note,
      i.control_ids.join(';'), i.obligation_ids.join(';'), a.by || '', a.until || '', a.rationale || '', encActions(i.actions)].map(csvCell).join(','));
  });
  return rows.join('\r\n');
}
function actionsCSV() {
  var rows = [['issue_id', 'issue_title', 'issue_severity', 'issue_status', 'action_id', 'action', 'owner', 'due_on', 'status', 'done_on', 'overdue_days', 'evidence'].join(',')];
  S.issues.forEach(function (i) {
    i.actions.forEach(function (a) {
      var od = a.status !== 'done' && a.due_on < TODAY && D[i.id].active ? diff(TODAY, a.due_on) : 0;
      rows.push([i.id, i.title, labelOf(SEV, i.severity), labelOf(STATUS, i.status), a.id, a.title, a.owner, a.due_on, a.status, a.done_on, od, a.evidence].map(csvCell).join(','));
    });
  });
  return rows.join('\r\n');
}
function download(name, text) {
  var blob = new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' }), a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
  setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
function parseCSV(text) {
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  var first = '', q0 = false, k, c;
  for (k = 0; k < text.length; k++) { c = text[k]; if (c === '"') q0 = !q0; if (!q0 && (c === '\n' || c === '\r')) break; first += c; }
  function count(ch) { var n = 0, q = false; for (var x = 0; x < first.length; x++) { if (first[x] === '"') q = !q; else if (!q && first[x] === ch) n++; } return n; }
  var delim = count(';') > count(',') ? ';' : (count('\t') > count(',') ? '\t' : ',');
  var rows = [], row = [], cell = '', q = false;
  for (k = 0; k < text.length; k++) {
    c = text[k];
    if (q) { if (c === '"') { if (text[k + 1] === '"') { cell += '"'; k++; } else q = false; } else cell += c; }
    else if (c === '"' && cell === '') q = true;
    else if (c === delim) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[k + 1] === '\n') k++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return { rows: rows.filter(function (r) { return r.some(function (x) { return x.trim() !== ''; }); }), delim: delim, unterminated: q };
}
var SYN = {
  id: ['id', 'issue_id', 'ref'], title: ['title', 'issue', 'finding', 'name', 'summary'], description: ['description', 'details'], source: ['source', 'origin'],
  source_ref: ['source_ref', 'source_reference', 'reference'], severity: ['severity', 'rating', 'priority'], root_cause: ['root_cause', 'rootcause', 'cause', 'root_cause_category'],
  owner: ['owner', 'issue_owner', 'responsible'], lod: ['lod', 'line', 'line_of_defence', 'line_of_defense'], status: ['status', 'state'],
  opened_on: ['opened_on', 'opened', 'date_opened', 'raised_on', 'date'], due_on: ['due_on', 'due', 'due_date', 'target_date', 'deadline'], closed_on: ['closed_on', 'closed', 'date_closed'],
  closed_by: ['closed_by', 'validated_by'], closure_note: ['closure_note', 'closure'], control_ids: ['control_ids', 'controls', 'control'], obligation_ids: ['obligation_ids', 'obligations', 'obligation'],
  risk_accepted_by: ['risk_accepted_by', 'accepted_by', 'approver'], risk_accepted_until: ['risk_accepted_until', 'accepted_until', 'acceptance_expiry', 'expiry'],
  risk_accepted_rationale: ['risk_accepted_rationale', 'acceptance_rationale', 'rationale'], actions: ['actions', 'remediation_actions', 'remediation']
};
function normKey(s) { return s.trim().toLowerCase().replace(/[\s\-]+/g, '_'); }
function toISODate(s) {
  s = (s || '').trim(); if (!s) return '';
  if (validISO(s)) return s;
  var m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/);
  if (m) { var iso = m[3] + '-' + pad(+m[2]) + '-' + pad(+m[1]); if (validISO(iso)) return iso; }
  return null;
}
function matchEnum(list, v) {
  var t = v.trim().toLowerCase().replace(/[\s_\-]+/g, ' ');
  for (var k = 0; k < list.length; k++) { var o = list[k]; if (o.id.replace(/_/g, ' ') === t || o.label.toLowerCase().replace(/[\-]/g, ' ') === t) return o.id; }
  return null;
}
function splitIds(s) { return (s || '').split(/[;|,]/).map(function (x) { return x.trim(); }).filter(Boolean); }
function validateCSV(text) {
  var res = { rows: [], fatal: '', notes: [], delim: ',' };
  if (text.length > 1500000) { res.fatal = 'The file is larger than 1.5 MB. Split it and import in parts.'; return res; }
  var p = parseCSV(text); res.delim = p.delim;
  if (p.unterminated) { res.fatal = 'A quoted value is not closed (unbalanced quotation mark).'; return res; }
  if (p.rows.length < 2) { res.fatal = 'No data rows found. The first row must be the column headers.'; return res; }
  if (p.rows.length > 1001) { res.fatal = 'More than 1,000 data rows. Split the file and import in parts.'; return res; }
  var head = p.rows[0].map(normKey), col = {}, unknown = [];
  res.cols = [];
  head.forEach(function (h, idx) {
    var f = null; Object.keys(SYN).forEach(function (k) { if (SYN[k].indexOf(h) !== -1 && f === null) f = k; });
    if (f && col[f] === undefined) col[f] = idx; else if (h) unknown.push(p.rows[0][idx]);
  });
  if (col.title === undefined) { res.fatal = 'No "title" column found. Columns recognised: ' + CSV_COLS.join(', ') + '.'; return res; }
  res.cols = Object.keys(col);
  if (unknown.length) res.notes.push('Ignored unknown columns: ' + unknown.join(', ') + '.');
  var seen = {}, seq = S.seq;
  for (var r = 1; r < p.rows.length; r++) {
    var raw = p.rows[r], line = r + 1, errs = [], warns = [];
    var g = function (k) { return col[k] === undefined ? '' : csvClean((raw[col[k]] || '').trim()); };
    var it = blankIssue({});
    it.title = g('title'); if (!it.title) errs.push(['title', 'Title is empty.']);
    if (it.title.length > 200) { it.title = it.title.slice(0, 200); warns.push(['title', 'Title shortened to 200 characters.']); }
    it.description = g('description'); it.source_ref = g('source_ref'); it.owner = g('owner'); it.closed_by = g('closed_by'); it.closure_note = g('closure_note');
    var sv = g('severity'); if (!sv) { if (col.severity !== undefined) warns.push(['severity', 'Empty: set to Medium.']); } else { var sid = matchEnum(SEV, sv); if (!sid) errs.push(['severity', '"' + sv + '" is not one of Critical, High, Medium, Low.']); else it.severity = sid; }
    var so = g('source'); if (!so) { if (col.source !== undefined) warns.push(['source', 'Empty: set to Self-identified.']); } else { var soid = matchEnum(SOURCES, so); if (!soid) errs.push(['source', '"' + so + '" is not a known source (' + SOURCES.map(function (x) { return x.label; }).join(', ') + ').']); else it.source = soid; }
    var stt = g('status'); if (stt) { var stid = matchEnum(STATUS, stt); if (!stid) errs.push(['status', '"' + stt + '" is not a known status (' + STATUS.map(function (x) { return x.label; }).join(', ') + ').']); else it.status = stid; }
    var rc = g('root_cause'); if (rc) { var rm = ROOTS.filter(function (x) { return x.toLowerCase() === rc.toLowerCase(); })[0]; if (rm) it.root_cause = rm; else { it.root_cause = 'Other'; warns.push(['root_cause', '"' + rc + '" is not in the default taxonomy: set to Other.']); } }
    var lod = g('lod'); if (lod) { var lm = lod.toLowerCase().replace(/\s/g, ''); if (/^(1|1lod|first|firstline)$/.test(lm)) it.lod = '1LOD'; else if (/^(2|2lod|second|secondline)$/.test(lm)) it.lod = '2LOD'; else warns.push(['lod', '"' + lod + '" is not 1LOD or 2LOD: set to 1LOD.']); }
    function dateField(key, label) { var v = g(key); if (!v) return ''; var d = toISODate(v); if (d === null) { errs.push([key, label + ' "' + v + '" is not a date. Use YYYY-MM-DD or DD/MM/YYYY.']); return ''; } return d; }
    var od = dateField('opened_on', 'Opened date'); if (od) it.opened_on = od; else if (col.opened_on !== undefined && !g('opened_on')) warns.push(['opened_on', 'Empty: set to today.']);
    var dd = dateField('due_on', 'Due date'); if (dd) it.due_on = dd; else if (!g('due_on')) { it.due_on = slaDue(it.severity, it.opened_on); if (col.due_on !== undefined) warns.push(['due_on', 'Empty: set to the default SLA date ' + it.due_on + '.']); }
    if (it.due_on < it.opened_on) errs.push(['due_on', 'Due date is before the opened date.']);
    var cd = dateField('closed_on', 'Closed date');
    if (it.status === 'closed') { if (cd) it.closed_on = cd; else { it.closed_on = TODAY; warns.push(['closed_on', 'Closed but no date: set to today.']); } if (it.closed_on < it.opened_on) errs.push(['closed_on', 'Closed date is before the opened date.']); if (!it.closed_by) warns.push(['closed_by', 'No validator recorded.']); }
    if (it.status === 'risk_accepted') {
      var ab = g('risk_accepted_by'), au = dateField('risk_accepted_until', 'Acceptance expiry'), ar = g('risk_accepted_rationale');
      if (!ab) errs.push(['risk_accepted_by', 'Risk accepted needs an approver.']);
      if (!au && !errs.some(function (e) { return e[0] === 'risk_accepted_until'; })) errs.push(['risk_accepted_until', 'Risk accepted needs an expiry date.']);
      if (!ar) warns.push(['risk_accepted_rationale', 'No rationale recorded.']);
      it.accepted = { by: ab, until: au, on: TODAY, rationale: ar };
    }
    var cids = splitIds(g('control_ids')).filter(function (x) { if (ctl(x)) return true; warns.push(['control_ids', 'Unknown control "' + x + '" dropped.']); return false; });
    it.control_ids = uniq(cids);
    it.obligation_ids = uniq(splitIds(g('obligation_ids')).filter(function (x) { if (obl(x)) return true; warns.push(['obligation_ids', 'Unknown obligation "' + x + '" dropped.']); return false; }));
    var at = g('actions');
    if (at) at.split('||').forEach(function (chunk, ix) {
      var f = chunk.split('~').map(function (x) { return x.trim(); });
      if (!f[0]) return;
      var ad = f[2] ? toISODate(f[2]) : it.due_on;
      if (ad === null) { errs.push(['actions', 'Action ' + (ix + 1) + ' has an invalid due date "' + f[2] + '".']); return; }
      var done = /^done$/i.test(f[3] || '');
      it.actions.push({ id: 'A' + (it.actions.length + 1), title: f[0], owner: f[1] || '', due_on: ad || it.due_on, status: done ? 'done' : 'open', done_on: done ? (it.closed_on || TODAY) : '', evidence: f[4] || '' });
    });
    var id = g('id'), mode = 'new';
    if (id) {
      if (!/^[A-Za-z0-9._\-]{1,20}$/.test(id)) { errs.push(['id', 'ID "' + id + '" has invalid characters (letters, digits, . _ - only).']); }
      else if (seen[id.toLowerCase()]) errs.push(['id', 'ID "' + id + '" appears twice in the file.']);
      else { seen[id.toLowerCase()] = true; if (issue(id)) mode = 'update'; it.id = id; }
    }
    var rawv = {}; Object.keys(col).forEach(function (k) { rawv[k] = g(k); });
    res.rows.push({ line: line, issue: it, errors: errs, warnings: warns, mode: mode, hasId: !!id, raw: rawv });
  }
  return res;
}
function applyImport(res) {
  var n = 0, u = 0;
  res.rows.forEach(function (r) {
    if (r.errors.length) return;
    var it = r.issue;
    if (r.mode === 'update') {
      var cur = issue(it.id);
      var MAP = { risk_accepted_by: 'accepted', risk_accepted_until: 'accepted', risk_accepted_rationale: 'accepted' };
      Object.keys(r.raw).forEach(function (k) {
        if (k === 'id' || r.raw[k] === '') return;
        var f = MAP[k] || k;
        cur[f] = it[f];
      });
      cur.demo = false; log(cur, 'Updated from CSV import'); u++;
    } else {
      if (!it.id || issue(it.id)) it.id = nextId();
      else { var num = parseInt(it.id.replace(/\D/g, ''), 10); if (num > S.seq) S.seq = num; }
      it.history = [{ d: TODAY, t: 'Imported from CSV' }]; S.issues.push(it); n++;
    }
  });
  touch();
  return { added: n, updated: u };
}
function ioDialog() {
  var dlg = $('dlgIo');
  dlg.innerHTML = '<div class="dlg-h"><h2 id="ioTitle">Import and export</h2><button type="button" class="btn x" data-act="io-close" aria-label="Close dialog">×</button></div>' +
    '<div class="dlg-b"><section class="sec"><h3>Export</h3><p class="muted" style="margin-bottom:8px">CSV opens in Excel and Sheets. Values that start with = + - or @ are prefixed with an apostrophe so spreadsheets do not run them as formulas.</p>' +
    '<div class="flow"><button type="button" class="btn" data-act="export-issues">Issues (CSV, ' + S.issues.length + ' rows)</button><button type="button" class="btn" data-act="export-actions">Remediation actions (CSV, ' + S.issues.reduce(function (n, i) { return n + i.actions.length; }, 0) + ' rows)</button><button type="button" class="btn" data-act="export-template">Import template (CSV)</button></div></section>' +
    '<section class="sec"><h3>Import issues from CSV</h3><p class="muted" style="margin-bottom:8px">The first row holds column headers; only <b>title</b> is required. Comma, semicolon or tab separated. Dates as YYYY-MM-DD or DD/MM/YYYY. Rows whose id matches an existing issue update it; others are added. Actions go in one column as <span class="mono">title ~ owner ~ due ~ done|open ~ evidence</span>, separated by <span class="mono">||</span>.</p>' +
    '<div class="field"><label for="ioFile">CSV file</label><input class="in" id="ioFile" type="file" accept=".csv,text/csv,text/plain"></div>' +
    '<div class="field" style="margin-top:10px"><label for="ioText">Or paste CSV text</label><textarea class="in" id="ioText" rows="4" placeholder="title,severity,owner,due_on"></textarea></div>' +
    '<div class="flow" style="margin-top:10px"><button type="button" class="btn pri" data-act="io-check">Check file</button></div>' +
    '<div id="ioResult" aria-live="polite" style="margin-top:12px"></div></section></div>' +
    '<div class="dlg-f"><button type="button" class="btn" data-act="io-close">Close</button></div>';
  openDlg(dlg);
  $('ioFile').addEventListener('change', function (e) {
    var f = e.target.files[0]; if (!f) return;
    if (f.size > 1500000) { $('ioResult').innerHTML = '<p class="err">The file is larger than 1.5 MB.</p>'; return; }
    var rd = new FileReader(); rd.onload = function () { $('ioText').value = String(rd.result); checkImport(); }; rd.readAsText(f);
  });
}
var IMPORT = null;
function checkImport() {
  var text = $('ioText').value;
  if (!text.trim()) { $('ioResult').innerHTML = '<p class="err">Choose a file or paste CSV text first.</p>'; return; }
  var res = validateCSV(text); IMPORT = res;
  if (res.fatal) { $('ioResult').innerHTML = '<p class="err">' + esc(res.fatal) + '</p>'; return; }
  var ok = res.rows.filter(function (r) { return !r.errors.length; }), bad = res.rows.length - ok.length;
  var nNew = ok.filter(function (r) { return r.mode === 'new'; }).length, nUp = ok.length - nNew;
  var issues = [];
  res.rows.forEach(function (r) { r.errors.forEach(function (e) { issues.push([r.line, 'Error', e[0], e[1]]); }); r.warnings.forEach(function (w) { issues.push([r.line, 'Warning', w[0], w[1]]); }); });
  $('ioResult').innerHTML = '<p><b>' + res.rows.length + ' rows read</b> (separator "' + (res.delim === '\t' ? 'tab' : res.delim) + '"): ' + ok.length + ' can be imported (' + nNew + ' new, ' + nUp + ' updates), ' + bad + ' have errors and will be skipped.</p>' +
    (res.notes.length ? '<p class="hint">' + esc(res.notes.join(' ')) + '</p>' : '') +
    (issues.length ? '<table class="tbl tbl-errs"><caption class="sr">Row problems</caption><thead><tr><th scope="col">Row</th><th scope="col">Type</th><th scope="col">Field</th><th scope="col">Message</th></tr></thead><tbody>' +
      issues.slice(0, 80).map(function (x) { return '<tr><td class="num">' + x[0] + '</td><td>' + (x[1] === 'Error' ? chip('f-bad', 'Error') : chip('f-warn', 'Warning')) + '</td><td>' + esc(x[2]) + '</td><td>' + esc(x[3]) + '</td></tr>'; }).join('') + '</tbody></table>' + (issues.length > 80 ? '<p class="hint">Showing the first 80 of ' + issues.length + ' messages.</p>' : '') : '<p class="muted">No problems found.</p>') +
    '<div class="flow" style="margin-top:10px"><button type="button" class="btn pri" data-act="io-apply"' + (ok.length ? '' : ' disabled') + '>Import ' + ok.length + ' valid ' + (ok.length === 1 ? 'row' : 'rows') + '</button></div>';
  wrapTables($('ioResult'));
}

/* ───────── settings and keys dialogs ───────── */
function settingsDialog() {
  var dlg = $('dlgSet'), c = S.cfg;
  dlg.innerHTML = '<form id="setForm" method="dialog" novalidate><div class="dlg-h"><h2 id="setTitle">SLA and escalation settings</h2><button type="button" class="btn x" data-act="set-close" aria-label="Close dialog">×</button></div>' +
    '<div class="dlg-b"><p class="muted" style="margin-bottom:12px"><b>Defaults, configure for your firm.</b> These numbers are not regulatory deadlines. They set the suggested due date for a new issue and when overdue issues are flagged for escalation. Days are calendar days.</p>' +
    '<table class="tbl cfg"><thead><tr><th scope="col">Severity</th><th scope="col">Remediation SLA (days from opened)</th><th scope="col">Escalate to senior management (days overdue)</th><th scope="col">Escalate to board or risk committee (days overdue)</th></tr></thead><tbody>' +
    SEV.map(function (s) {
      return '<tr><th scope="row">' + esc(s.label) + '</th>' + ['sla', 'mgmt', 'board'].map(function (k) {
        return '<td><label class="sr" for="cfg-' + s.id + '-' + k + '">' + esc(s.label + ' ' + k) + '</label><input class="in" id="cfg-' + s.id + '-' + k + '" type="number" min="0" max="3650" value="' + c.sla[s.id][k] + '"></td>';
      }).join('') + '</tr>';
    }).join('') + '</tbody></table>' +
    '<div class="fields" style="margin-top:14px"><div class="field"><label for="cfg-soon">Flag "due soon" within (days)</label><input class="in" id="cfg-soon" type="number" min="0" max="365" value="' + c.dueSoon + '"></div>' +
    '<div class="field"><label for="cfg-firm">Firm name on the board report</label><input class="in" id="cfg-firm" value="' + esc(S.firm) + '" maxlength="80"></div></div>' +
    '<p class="err" id="setErr" role="alert"></p></div>' +
    '<div class="dlg-f"><button type="button" class="btn sp" data-act="set-reset">Restore defaults</button><button type="button" class="btn" data-act="set-close">Cancel</button><button type="submit" class="btn pri">Save settings</button></div></form>';
  $('setForm').onsubmit = function (e) {
    e.preventDefault();
    var n = defaultCfg();
    for (var k = 0; k < SEV.length; k++) {
      var s = SEV[k].id, v = {};
      ['sla', 'mgmt', 'board'].forEach(function (f) { v[f] = parseInt($('cfg-' + s + '-' + f).value, 10); });
      if (!isFinite(v.sla) || !isFinite(v.mgmt) || !isFinite(v.board) || v.sla < 0 || v.mgmt < 0 || v.board < 0) { $('setErr').textContent = 'Enter whole numbers of days (0 or more) for ' + SEV[k].label + '.'; return; }
      if (v.board < v.mgmt) { $('setErr').textContent = 'For ' + SEV[k].label + ', the board threshold cannot be lower than the senior management threshold.'; return; }
      n.sla[s] = v;
    }
    var soon = parseInt($('cfg-soon').value, 10); if (!isFinite(soon) || soon < 0) { $('setErr').textContent = 'Enter a whole number of days for due soon.'; return; }
    n.dueSoon = soon; n.shortcuts = S.cfg.shortcuts; S.cfg = n; S.firm = $('cfg-firm').value.trim();
    dlg.close(); touch(); toast('Settings saved');
  };
  openDlg(dlg);
}
function keysDialog() {
  var dlg = $('dlgKeys');
  var rows = [['n', 'New issue'], ['q', 'Quick add'], ['/', 'Search'], ['j or ↓', 'Next issue in the list'], ['k or ↑', 'Previous issue in the list'], ['Enter', 'Open the focused issue'], ['1 2 3', 'Register, Ageing, Board report'], ['?', 'This help'], ['Esc', 'Close a dialog']];
  dlg.innerHTML = '<div class="dlg-h"><h2 id="keysTitle">Keyboard shortcuts</h2><button type="button" class="btn x" data-act="keys-close" aria-label="Close dialog">×</button></div><div class="dlg-b">' +
    '<table class="kb"><caption class="sr">Shortcuts</caption><tbody>' + rows.map(function (r) { return '<tr><th scope="row" style="text-align:left;width:34%"><span class="kbd">' + esc(r[0]) + '</span></th><td>' + esc(r[1]) + '</td></tr>'; }).join('') + '</tbody></table>' +
    '<label class="checks" style="margin-top:12px"><input type="checkbox" id="keysOn"' + (S.cfg.shortcuts ? ' checked' : '') + '> Single-key shortcuts on</label><p class="hint">Turn them off if they clash with assistive technology or speech input. Arrow keys in the list always work.</p></div>' +
    '<div class="dlg-f"><button type="button" class="btn" data-act="keys-close">Close</button></div>';
  openDlg(dlg);
  $('keysOn').addEventListener('change', function (e) { S.cfg.shortcuts = e.target.checked; persist(); toast(e.target.checked ? 'Shortcuts on' : 'Shortcuts off'); });
}

/* ═══════════ events ═══════════ */
function closeBy(id) { var d = $(id); if (d.open) d.close(); }
document.addEventListener('click', function (e) {
  var b = e.target.closest('[data-act]'); if (!b) return;
  var a = b.getAttribute('data-act'), id = b.getAttribute('data-id');
  switch (a) {
    case 'new': newIssue(); break;
    case 'io': ioDialog(); break;
    case 'settings': settingsDialog(); break;
    case 'keys': keysDialog(); break;
    case 'open': UI.lastId = id; openSheet(id); break;
    case 'sheet-close': closeBy('dlgIssue'); break;
    case 'sheet-create': createFromSheet(); break;
    case 'dec-cancel': closeBy('dlgDecide'); break;
    case 'io-close': closeBy('dlgIo'); break;
    case 'set-close': closeBy('dlgSet'); break;
    case 'keys-close': closeBy('dlgKeys'); break;
    case 'print': beforePrint(); window.print(); break;
    case 'preset': F = Object.assign(defaultFilter(), by(PRESETS, id).f, { sort: F.sort }); renderAll(); break;
    case 'applysaved': F = Object.assign(defaultFilter(), by(S.saved, id).f); renderAll(); break;
    case 'delsaved': S.saved = S.saved.filter(function (x) { return x.id !== id; }); persist(); renderFilters(); toast('Saved filter deleted'); break;
    case 'savefilter': saveFilterDialog(); break;
    case 'clearfilters': F = defaultFilter(); renderAll(); break;
    case 'dropscope': F[b.getAttribute('data-k')] = ''; renderAll(); break;
    case 'agecell':
      F = Object.assign(defaultFilter(), { status: 'active', severity: b.getAttribute('data-sev') });
      if (b.getAttribute('data-kind') === 'age') F.age = b.getAttribute('data-b'); else F.dueb = b.getAttribute('data-b');
      setTab('register'); $('list').scrollIntoView({ block: 'start' }); break;
    case 'sugg-create': var sg = SUGG[+b.getAttribute('data-k')]; if (sg) newIssue(Object.assign({}, sg.draft, { fromSugg: sg.key, due_on: slaDue(sg.draft.severity, TODAY) })); break;
    case 'sugg-dismiss': var sd = SUGG[+b.getAttribute('data-k')]; if (sd) { S.dismissed[sd.key] = TODAY; persist(); renderSuggestions(); toast('Suggestion dismissed until the next test result'); } break;
    case 'cleardemo': decide({ title: 'Remove demo issues', intro: 'This removes the fictional CF Bank demo issues from this device. Issues you created or imported stay. This cannot be undone.', fields: [], submit: 'Remove demo issues', danger: true,
      onSubmit: function () { S.issues = S.issues.filter(function (i) { return !i.demo; }); if (/fictional/i.test(S.firm)) S.firm = ''; touch(); toast('Demo issues removed'); return null; } }); break;
    case 'usesla': { var f = $('issueForm'); f.elements.due_on.value = slaDue(f.elements.severity.value, f.elements.opened_on.value || TODAY); onFormChange('due_on'); break; }
    case 'unlink': unlinkTo(b.getAttribute('data-kind'), id); break;
    case 'flow': flowTo(b.getAttribute('data-to')); break;
    case 'closedlg': dlgClose(issue(SH.id)); break;
    case 'sendback': dlgReason(issue(SH.id), 'sendback'); break;
    case 'reopen': dlgReason(issue(SH.id), 'reopen'); break;
    case 'accept': dlgAccept(issue(SH.id)); break;
    case 'act-add': actionDialog(issue(SH.id), null); break;
    case 'act-edit': actionDialog(issue(SH.id), by(issue(SH.id).actions, id)); break;
    case 'act-done': actionDone(issue(SH.id), by(issue(SH.id).actions, id)); break;
    case 'act-undo': { var iu = issue(SH.id), au = by(iu.actions, id); au.status = 'open'; au.done_on = ''; log(iu, 'Action reopened: ' + au.title); touch(); break; }
    case 'act-del': { var ii = issue(SH.id), ad = by(ii.actions, id);
      decide({ title: 'Remove this action?', intro: ad.title, fields: [], submit: 'Remove action', danger: true, onSubmit: function () { ii.actions = ii.actions.filter(function (x) { return x.id !== id; }); log(ii, 'Action removed: ' + ad.title); touch(); return null; } }); break; }
    case 'del-issue': { var di = issue(SH.id);
      decide({ title: 'Delete ' + di.id + '?', intro: 'The issue, its actions and its history are removed from this device. This cannot be undone. To keep the record, close the issue or export a CSV first.', fields: [], submit: 'Delete issue', danger: true,
        onSubmit: function () { S.issues = S.issues.filter(function (x) { return x.id !== di.id; }); var d = $('dlgIssue'); d.onclose = null; d.close(); SH = null; UI.lastId = null; touch(); toast(di.id + ' deleted'); $('qaTitle').focus(); return null; } }); break; }
    case 'export-issues': download('regradar-issues-' + TODAY + '.csv', issuesCSV()); toast('Issues exported'); break;
    case 'export-actions': download('regradar-actions-' + TODAY + '.csv', actionsCSV()); toast('Actions exported'); break;
    case 'export-template': download('regradar-issues-template.csv', CSV_COLS.join(',') + '\r\n' + ['', 'Example: access reviews not completed', 'Quarterly access reviews missed for two systems', 'Internal audit', 'IA-2026-12', 'High', 'Process design', 'T. Nguyen', '1LOD', 'Open', TODAY, addDays(TODAY, 60), '', '', '', 'ctl-01', 'AMLR-art19', '', '', '', 'Complete the reviews ~ T. Nguyen ~ ' + addDays(TODAY, 30) + ' ~ open ~ '].map(csvCell).join(',')); break;
    case 'io-check': checkImport(); break;
    case 'io-apply': { var r = applyImport(IMPORT); IMPORT = null; $('ioResult').innerHTML = '<p><b>Imported:</b> ' + r.added + ' added, ' + r.updated + ' updated.</p>'; toast('Import complete'); break; }
    case 'set-reset': S.cfg = defaultCfg(); closeBy('dlgSet'); touch(); toast('Defaults restored'); break;
  }
});
function saveFilterDialog() {
  decide({ title: 'Save this filter', intro: 'Saves the current search and filters under a name so you can apply them in one click.',
    fields: [{ id: 'name', label: 'Name', required: true, value: '' }], submit: 'Save filter',
    onSubmit: function (v) {
      if (S.saved.length >= 12) return 'You can keep up to 12 saved filters. Delete one first.';
      var f = Object.assign({}, F); delete f.sort; f.sort = F.sort;
      S.saved.push({ id: 'sf' + Date.now().toString(36), name: v.name.slice(0, 40), f: f }); persist(); renderFilters(); toast('Filter saved'); return null;
    } });
}
function unlinkTo(kind, id) {
  var arr = kind === 'c' ? SH.W.control_ids : SH.W.obligation_ids, k = arr.indexOf(id); if (k === -1) return;
  arr.splice(k, 1);
  if (!SH.isNew) { log(SH.W, (kind === 'c' ? 'Control unlinked: ' : 'Obligation unlinked: ') + id); touch(); } else renderSheetParts();
}
function onFormChange(name) {
  if (!SH) return;
  if (SH.isNew) {
    var v = readForm(); Object.assign(SH.W, v);
    if (name === 'due_on') SH.dueTouched = true;
    if ((name === 'severity' || name === 'opened_on') && !SH.dueTouched && validISO(v.opened_on)) { $('issueForm').elements.due_on.value = slaDue(v.severity, v.opened_on); SH.W.due_on = $('issueForm').elements.due_on.value; }
    $('slaHint').innerHTML = slaHintHTML(SH.W);
    return;
  }
  commitField(name);
}
document.addEventListener('change', function (e) {
  var t = e.target;
  if (t.form && t.form.id === 'issueForm' && t.name) { onFormChange(t.name); return; }
  if (t.getAttribute && t.getAttribute('data-act-change') === 'addlink' && t.value) {
    var kind = t.getAttribute('data-kind'), arr = kind === 'c' ? SH.W.control_ids : SH.W.obligation_ids;
    if (arr.indexOf(t.value) === -1) arr.push(t.value);
    if (!SH.isNew) { log(SH.W, (kind === 'c' ? 'Control linked: ' : 'Obligation linked: ') + t.value); touch(); } else renderSheetParts();
    var again = $(kind === 'c' ? 'addCtl' : 'addObl'); if (again) again.focus();
    return;
  }
  var map = { fStatus: 'status', fSev: 'severity', fSrc: 'source', fOwn: 'owner', fLod: 'lod', fRoot: 'root', fSort: 'sort' };
  if (map[t.id]) { F[map[t.id]] = t.value; renderAll(); return; }
  if (t.id === 'repMonths') { UI.months = +t.value; renderReport(); wrapTables($('panel-report')); $('repMonths').focus(); return; }
  if (t.id === 'repBy') { S.report.by = t.value.trim(); persist(); return; }
});
document.addEventListener('input', function (e) {
  var t = e.target;
  if (t.id === 'fq') { F.q = t.value; renderList(); renderFilters_presetsOnly(); }
  if (t.id === 'repComm') { S.report.commentary = t.value; persist(); $('repCommPrint').textContent = t.value || 'No commentary added.'; }
});
function renderFilters_presetsOnly() {
  var btns = document.querySelectorAll('#presets [aria-pressed]');
  btns.forEach(function (b) {
    var p = by(PRESETS, b.getAttribute('data-id')) || by(S.saved, b.getAttribute('data-id'));
    if (p) b.setAttribute('aria-pressed', sameFilter(F, Object.assign(defaultFilter(), p.f)));
  });
}
$('qaForm').addEventListener('submit', function (e) { e.preventDefault(); quickAdd(); });

/* tabs: arrow keys */
document.querySelector('.tabs').addEventListener('click', function (e) { var b = e.target.closest('[data-tab]'); if (b) setTab(b.getAttribute('data-tab')); });
document.querySelector('.tabs').addEventListener('keydown', function (e) {
  var order = ['register', 'ageing', 'report'], k = order.indexOf(UI.tab);
  if (e.key === 'ArrowRight') { e.preventDefault(); setTab(order[(k + 1) % 3], true); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); setTab(order[(k + 2) % 3], true); }
  else if (e.key === 'Home') { e.preventDefault(); setTab('register', true); }
  else if (e.key === 'End') { e.preventDefault(); setTab('report', true); }
});

/* keyboard: row navigation and shortcuts */
function rowBtns() { return Array.prototype.slice.call(document.querySelectorAll('#list .rowbtn')); }
function moveRow(delta, fromEl) {
  var bs = rowBtns(); if (!bs.length) return;
  var k = fromEl ? bs.indexOf(fromEl) : -1, n = k === -1 ? (delta > 0 ? 0 : bs.length - 1) : Math.max(0, Math.min(bs.length - 1, k + delta));
  bs[n].focus(); UI.lastId = bs[n].getAttribute('data-id');
}
document.addEventListener('keydown', function (e) {
  if (e.altKey || e.ctrlKey || e.metaKey) return;
  var ae = document.activeElement, tag = ae ? ae.tagName : '';
  if (ae && ae.classList && ae.classList.contains('rowbtn')) {
    if (e.key === 'ArrowDown') { e.preventDefault(); moveRow(1, ae); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); moveRow(-1, ae); return; }
    if (e.key === 'Home') { e.preventDefault(); moveRow(-9999, ae); return; }
    if (e.key === 'End') { e.preventDefault(); moveRow(9999, ae); return; }
  }
  if (!S || !S.cfg.shortcuts) return;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (ae && ae.isContentEditable)) return;
  if (document.querySelector('dialog[open]')) return;
  if (e.key === 'n') { e.preventDefault(); newIssue(); }
  else if (e.key === 'q') { e.preventDefault(); if (UI.tab !== 'register') setTab('register'); $('qaTitle').focus(); }
  else if (e.key === '/') { e.preventDefault(); if (UI.tab !== 'register') setTab('register'); $('fq').focus(); }
  else if (e.key === 'j') { if (UI.tab === 'register') moveRow(1, ae && ae.classList.contains('rowbtn') ? ae : null); }
  else if (e.key === 'k') { if (UI.tab === 'register') moveRow(-1, ae && ae.classList.contains('rowbtn') ? ae : null); }
  else if (e.key === '1') setTab('register');
  else if (e.key === '2') setTab('ageing');
  else if (e.key === '3') setTab('report');
  else if (e.key === '?') { e.preventDefault(); keysDialog(); }
});

/* print: open the table alternatives so they print */
function beforePrint() { if (S && UI.tab !== 'report') { renderReport(); wrapTables($('panel-report')); } document.querySelectorAll('details.alt').forEach(function (d) { d.setAttribute('data-was', d.open ? '1' : ''); d.open = true; }); }
window.addEventListener('beforeprint', beforePrint);
window.addEventListener('afterprint', function () { document.querySelectorAll('details.alt').forEach(function (d) { d.open = !!d.getAttribute('data-was'); }); });

window.toggleTheme = function () {
  var h = document.documentElement, t = h.dataset.theme === 'dark' ? 'light' : 'dark';
  h.dataset.theme = t; try { localStorage.setItem('regradar-theme', t); } catch (e) {}
};

/* ═══════════ boot ═══════════ */
async function fetchJSON(url) { var r = await fetch(url, { cache: 'no-store' }); if (!r.ok) throw new Error(url); return r.json(); }
async function boot() {
  var loadErr = [];
  try { OBS = (await fetchJSON('data/obligations.json')).obligations || []; } catch (e) { loadErr.push('obligations'); }
  try { var cd = await window.ControlsData.load(); CONTROLS = cd.controls; TESTS = cd.tests || {}; } catch (e) { loadErr.push('controls'); }
  S = loadState();
  if (!S) {
    try { S = materialize(await fetchJSON('data/actions-demo.json')); persist(); } catch (e) { S = freshState(); }
  }
  recompute();
  if (loadErr.length) toast('Could not load ' + loadErr.join(' and ') + ': links and suggestions are limited.');
  var p = new URLSearchParams(location.search);
  if (p.get('control')) { F.control = p.get('control'); F.status = 'all'; }
  if (p.get('obligation')) { F.obligation = p.get('obligation'); F.status = 'all'; }
  var hash = decodeURIComponent((location.hash || '').slice(1));
  var tab = hash === 'ageing' || hash === 'report' ? hash : 'register';
  setTab(tab);
  if (p.get('new')) {
    var sev = SEV.some(function (s) { return s.id === p.get('severity'); }) ? p.get('severity') : 'medium', dr = { severity: sev, due_on: slaDue(sev, TODAY) };
    if (p.get('control') && ctl(p.get('control'))) { var c = ctl(p.get('control')); dr.control_ids = [c.id]; dr.obligation_ids = (c.obligation_ids || []).slice(); dr.owner = c.owner; dr.source = 'control_test'; }
    if (p.get('obligation') && obl(p.get('obligation')) && !(dr.obligation_ids || []).length) dr.obligation_ids = [p.get('obligation')];
    newIssue(dr);
    try { var q = new URLSearchParams(location.search); q.delete('new'); history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : '') + location.hash); } catch (e) {}
  } else if (/^ISS-|^[A-Za-z0-9._-]+$/.test(hash) && issue(hash)) openSheet(hash);
  fetchJSON('data/laws/32024R1624_EN.json').then(function (l) { LAW = l; if (SH) renderSheetParts(); renderAll(); }).catch(function () {});
}
if (window.innerWidth < 861) $('fdet').open = false;
boot();
})();
