/* ═══════════════════════════════════════════════════════════════
   RegRadar: Regulatory change impact analysis (epic E1)

   A RegWatch item becomes: affected instruments, obligations, controls,
   policies and customer segments, the dates that apply, a decision and a
   prioritised task list that can be sent to the Issues and actions
   tracker. Device-local record: localStorage 'regradar-impact'.

   Matching is deterministic and rule-based (impact-match.js, rules in
   data/impact-rules.json). It is approximate and says why for every match.

   AI HOOK (slice A3, see VISION.md): see aiSecondOpinion() below. When
   docs/ai.js exists it can offer a second opinion on top of the rule
   result. Nothing in this file calls a model.
   ═══════════════════════════════════════════════════════════════ */
(function () {
'use strict';

var KEY = 'regradar-impact', PKEY = 'regradar-profile', AKEY = 'regradar-actions', POLKEY = 'regradar-policies';
var SEV = [['critical', 'Critical'], ['high', 'High'], ['medium', 'Medium'], ['low', 'Low']];
var DECISIONS = [['action', 'Action needed'], ['monitor', 'Monitor'], ['no_action', 'No action']];
var LIMIT = 40;

var $ = function (id) { return document.getElementById(id); };
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function pad(n) { return n < 10 ? '0' + n : '' + n; }
function isoOf(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
var asof = new URLSearchParams(location.search).get('asof');
var IM = window.ImpactMatch;
var TODAY = IM.validISO(asof) ? asof : isoOf(new Date());
function fmt(iso) { if (!iso) return 'not set'; var p = iso.slice(0, 10).split('-'); return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }); }
function fmtItem(d) { return d ? fmt(String(d).slice(0, 10)) : ''; }
function cleanTitle(it) { return String(it.title || '').replace(/^(?:CELEX|OJ):\S+:\s*/, ''); }
function plural(n, a, b) { return n + ' ' + (n === 1 ? a : (b || a + 's')); }
function labelOf(list, id) { for (var i = 0; i < list.length; i++) if (list[i][0] === id) return list[i][1]; return ''; }
function has(a, v) { return a.indexOf(v) !== -1; }
function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }

/* ───────── state ───────── */
var ITEMS = [], APP = null, OBS = [], RULES = null, CONTROLS = [], POLS = [], LAW = null, ENG = null;
var PROFILE = { entity: '', acts: [] };
var STORE = { v: 1, assessments: {} };
var F = { q: '', source: '', theme: '', period: '', sort: 'rel', reg: false, todo: false };
var MATCH = {};          // id -> quick analysis for the list
var SEL = null, A = null, AN = null, EFF = null, TX = null, SHOWN = LIMIT, OPENER = null;
var storageOk = true;

function loadStore() {
  var raw = lsGet(KEY);
  if (!raw) return;
  try { var p = JSON.parse(raw); if (p && p.assessments) STORE = { v: 1, assessments: p.assessments }; } catch (e) { /* unreadable: start empty */ }
}
function saveStore() { storageOk = lsSet(KEY, JSON.stringify(STORE)); if (!storageOk) toast('Could not save on this device (storage blocked or full). Changes last until you close the page.'); return storageOk; }
function loadProfile() { try { var p = JSON.parse(lsGet(PKEY) || 'null'); if (p) PROFILE = { entity: p.entity || '', acts: p.acts || [] }; } catch (e) { /* ignore */ } }
function saveProfile() { var base = {}; try { base = JSON.parse(lsGet(PKEY) || 'null') || {}; } catch (e) { base = {}; } base.entity = PROFILE.entity; base.acts = PROFILE.acts; lsSet(PKEY, JSON.stringify(base)); }
function loadPolicies() {
  POLS = [];
  try { var s = JSON.parse(lsGet(POLKEY) || 'null'); if (s && Array.isArray(s.policies)) POLS = s.policies.map(function (p) { return { id: p.id, ref: p.ref || '', title: p.title || p.id, owner: p.owner || '', obligation_ids: p.obligation_ids || [], legal_refs: p.legal_refs || [], retired: !!p.retired }; }); } catch (e) { /* tolerate absence */ }
}

function toast(m) { var t = $('toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove('on'); }, 3200); }

/* ───────── lookups ───────── */
function ob(id) { for (var i = 0; i < OBS.length; i++) if (OBS[i].id === id) return OBS[i]; return null; }
function ctl(id) { for (var i = 0; i < CONTROLS.length; i++) if (CONTROLS[i].id === id) return CONTROLS[i]; return null; }
function pol(id) { for (var i = 0; i < POLS.length; i++) if (POLS[i].id === id) return POLS[i]; return null; }
function reg(id) { return ENG.regById[id]; }
function entityLabel() { var e = ((APP && APP.entities) || []).filter(function (x) { return x.id === PROFILE.entity; })[0]; return e ? e.label : ''; }
function actLabels() { return PROFILE.acts.map(function (a) { var x = ((APP && APP.activities) || []).filter(function (y) { return y.id === a; })[0]; return x ? x.label : a; }); }
function artOf(o) { var n = ENG.obArt(o); if (!LAW || !n) return null; return LAW.articles.filter(function (a) { return String(a.id) === String(n); })[0] || null; }
function obTitle(o) { var a = artOf(o); return a ? a.title.replace(/ /g, ' ') : ((o.what || '').length > 70 ? o.what.slice(0, 67) + '…' : (o.what || '')); }
function obLabel(id) { var o = ob(id); return o ? o.legal_basis + ' ' + obTitle(o) : id; }
function norm(s) { return String(s).replace(/[   ]/g, ' ').replace(/\s+/g, ' ').trim(); }
/* The register's excerpts use "[...]" for omissions. Each fragment must appear verbatim in the official article text. */
function verifyExcerpt(o) {
  var a = artOf(o);
  if (!a || !o.verbatim) return false;
  var text = norm(a.text);
  return o.verbatim.split(/\s*\[\.\.\.\]\s*/).every(function (frag) { frag = norm(frag); return !frag || text.indexOf(frag) !== -1; });
}

/* ───────── assessments ───────── */
function newAssessment(item) {
  var a = { id: item.id, itemId: item.id, itemTitle: cleanTitle(item), itemUrl: item.url || '', itemSource: item.source || '', itemDate: String(item.date || '').slice(0, 10),
    created: new Date().toISOString(), updated: '', severity: '', decision: '', rationale: '', owner: '',
    effective: '', effectiveSrc: '', consultation: '', consultationSrc: '', planning: '', planningSrc: '',
    over: { instr: {}, ob: {}, ctl: {}, pol: {}, seg: {} }, tasks: [], touched: false };
  return a;
}
function loadAssessment(item) {
  var s = STORE.assessments[item.id];
  if (s) { s.over = Object.assign({ instr: {}, ob: {}, ctl: {}, pol: {}, seg: {} }, s.over || {}); s.tasks = s.tasks || []; return s; }
  return newAssessment(item);
}
function prefillDates(a, an) {
  var eff = an.dates.filter(function (d) { return d.kind === 'field' || d.kind === 'effective'; })[0];
  var clo = an.dates.filter(function (d) { return d.kind === 'closing'; })[0];
  if (eff) { a.effective = eff.iso; a.effectiveSrc = eff.kind === 'field' ? 'RegWatch deadline field' : 'found in the item text: verify at the source'; }
  if (clo) { a.consultation = clo.iso; a.consultationSrc = 'found in the item text: verify at the source'; }
}
function anchor() { return (A && (A.planning || A.effective || A.consultation)) || ''; }
function anchorLabel() { if (!A) return ''; return A.planning ? 'planning deadline' : A.effective ? 'effective date' : A.consultation ? 'consultation deadline' : ''; }
function touch() {
  if (!A) return;
  A.touched = true; A.updated = new Date().toISOString(); A.itemTitle = A.itemTitle || '';
  STORE.assessments[A.itemId] = A; saveStore();
}
function activeDecision() { return A.decision || (EFF ? ENG.suggestDecision(SELITEM(), EFF).value : ''); }
function SELITEM() { for (var i = 0; i < ITEMS.length; i++) if (ITEMS[i].id === SEL) return ITEMS[i]; return null; }

/* ───────── derive ───────── */
function derive() {
  var item = SELITEM();
  TX = ENG.prep(item);
  AN = ENG.analyze(item, PROFILE);
  EFF = ENG.effective(AN, A.over, { controls: CONTROLS, policies: POLS, tx: TX });
}
function covOf(obId) { return ENG.coverage(obId, CONTROLS, new Date(TODAY + 'T12:00:00'), window.ControlsData ? window.ControlsData.isOverdue : null); }
function gapList() { return EFF.obIds.filter(function (id) { return covOf(id).state === 'gap'; }); }
function sevSuggestion() { return ENG.suggestSeverity(SELITEM(), EFF, AN, gapList().length); }

/* Task set: rules generate suggestions; the user's edits always win. */
function syncTasks() {
  var dec = activeDecision(), sg = sevSuggestion();
  var sugg = IM.buildTasks(RULES, {
    today: TODAY, decision: dec, severity: A.severity || 'medium', owner: A.owner, anchor: anchor(), consultation: A.consultation,
    itemTitle: A.itemTitle,
    gaps: gapList().map(function (id) { return { id: id, label: obLabel(id) }; }),
    controls: EFF.controls.filter(function (c) { return c.on && ctl(c.id); }).map(function (c) { var x = ctl(c.id); return { id: c.id, label: x.name, owner: x.owner, obligation_ids: c.obligations }; }),
    policies: EFF.policies.filter(function (p) { return p.on && pol(p.id); }).map(function (p) { var x = pol(p.id); return { id: p.id, label: x.title, owner: x.owner, obligation_ids: p.obligations }; }),
    segments: EFF.segments.filter(function (s) { return s.on && s.id !== 'internal-ict'; })
  });
  var byKey = {};
  sugg.forEach(function (t) { byKey[t.key] = t; });
  var keep = [];
  A.tasks.forEach(function (t) {
    if (t.custom) { keep.push(t); return; }
    var s = byKey[t.key];
    if (s) {
      if (!t.edited) { t.title = s.title; t.detail = s.detail; t.due = s.due; t.severity = s.severity; t.owner = s.owner; t.obligation_ids = s.obligation_ids; t.control_ids = s.control_ids; t.policy_ids = s.policy_ids; }
      keep.push(t); delete byKey[t.key];
    } else if (t.edited || t.issueId) keep.push(t);
  });
  sugg.forEach(function (s) {
    if (!byKey[s.key]) return;
    s.id = 'T' + Math.random().toString(36).slice(2, 8); s.include = true; s.edited = false; s.custom = false; s.issueId = '';
    keep.push(s);
  });
  A.tasks = keep;
  void sg;
}
function refresh(fk) {
  derive();
  syncTasks();
  if (A.touched) { STORE.assessments[A.itemId] = A; saveStore(); }
  renderDetail(fk);
  renderKpis();
  renderList();
}

/* ───────── quick match for the list ───────── */
function computeMatches() {
  MATCH = {};
  ITEMS.forEach(function (it) {
    var an = ENG.analyze(it, PROFILE);
    var on = an.instruments.filter(function (m) { return m.defaultOn; });
    var obs = an.obligations.filter(function (m) { return m.defaultOn; });
    MATCH[it.id] = { top: on[0] || null, nInstr: on.length, nOb: obs.length, weak: an.instruments.length };
  });
}

/* ───────── rendering helpers ───────── */
var CONF_LABEL = { high: 'High confidence', medium: 'Medium confidence', low: 'Low confidence', '': 'Added by you' };
function confChip(c) { return '<span class="chip ' + (c === 'high' ? 'ok' : c === 'medium' ? 'imp' : '') + '">' + esc(CONF_LABEL[c] || '') + '</span>'; }
function whyText(r) {
  switch (r.kind) {
    case 'identifier': return 'cites ' + r.term;
    case 'name': return '“' + r.term + '” in the ' + r.where;
    case 'keyword': return '“' + r.term + '” in the ' + r.where;
    case 'broad': return 'general term “' + r.term + '”';
    case 'source': return 'source is ' + r.term;
    case 'theme': return 'RegWatch theme ' + r.term;
    case 'topic': return 'topic term “' + r.term + '”';
    case 'citation': return 'cites ' + r.term;
    case 'parent': return 'its instrument also matched';
    case 'obligation': return r.term;
    case 'instrument': return r.term + ' is counted as affected';
    case 'tag': return 'topic: ' + r.term;
    default: return r.term;
  }
}
function whyChips(reasons, max) {
  var seen = {}, out = [];
  (reasons || []).forEach(function (r) { var t = whyText(r); if (!seen[t]) { seen[t] = 1; out.push(t); } });
  return '<div class="chips" aria-label="Why this matched">' + out.slice(0, max || 6).map(function (t) { return '<span class="chip why">' + esc(t) + '</span>'; }).join('') + (out.length > (max || 6) ? '<span class="chip why">+' + (out.length - (max || 6)) + ' more</span>' : '') + '</div>';
}
function tog(group, id, on, what) {
  return '<button type="button" class="tog" data-act="tog" data-g="' + group + '" data-id="' + esc(id) + '" data-fk="tog:' + group + ':' + esc(id) + '" aria-pressed="' + (on ? 'true' : 'false') + '" aria-label="' + esc(what) + ': counted as affected">' + (on ? '✓ Affected' : 'Not counted') + '</button>';
}
function verdictChip(v) {
  var e = entityLabel();
  if (v === 'direct') return '<span class="chip ok">Applies to ' + esc(e) + '</span>';
  if (v === 'conditional') return '<span class="chip imp">Conditional for ' + esc(e) + '</span>';
  if (v === 'na') return '<span class="chip crit">Not applicable to ' + esc(e) + '</span>';
  return '<span class="chip">Set your firm type to check applicability</span>';
}
function covChip(c) {
  if (c.state === 'gap') return '<span class="chip crit">Gap: no control mapped</span>';
  if (c.state === 'attention') return '<span class="chip imp">Covered, needs attention</span>';
  return '<span class="chip ok">Covered by ' + plural(c.controls.length, 'control') + '</span>';
}
function sevChip(s) { return s ? '<span class="chip ' + (s === 'critical' || s === 'high' ? 'crit' : s === 'medium' ? 'imp' : '') + '">' + esc(labelOf(SEV, s)) + '</span>' : ''; }

/* ───────── KPIs ───────── */
function renderKpis() {
  var assessed = 0, act = 0, mon = 0, openTasks = 0;
  Object.keys(STORE.assessments).forEach(function (id) {
    var a = STORE.assessments[id];
    if (a.decision) { assessed++; if (a.decision === 'action') act++; if (a.decision === 'monitor') mon++; }
    (a.tasks || []).forEach(function (t) { if (t.include && !t.issueId && a.decision && a.decision !== 'no_action') openTasks++; });
  });
  var touching = ITEMS.filter(function (it) { var m = MATCH[it.id]; return m && (m.nInstr || m.nOb); }).length;
  $('kpis').innerHTML =
    '<div class="kpi"><div class="n mono">' + ITEMS.length + '</div><div class="l">Items from RegWatch</div><div class="s">' + visibleItems().length + ' in the current view</div></div>' +
    '<div class="kpi"><div class="n mono">' + touching + '</div><div class="l">Match an instrument you cover</div><div class="s">confident match, ' + (PROFILE.entity ? 'for ' + esc(entityLabel()) : 'firm type not set') + '</div></div>' +
    '<div class="kpi"><div class="n mono">' + assessed + '</div><div class="l">Assessed</div><div class="s">' + act + ' action needed, ' + mon + ' monitor</div></div>' +
    '<div class="kpi"><div class="n mono">' + openTasks + '</div><div class="l">Tasks not yet in the tracker</div><div class="s">from decided assessments</div></div>';
}

/* ───────── profile bar ───────── */
function renderProfile() {
  var ents = (APP && APP.entities) || [];
  $('entitySel').innerHTML = '<option value="">Not set</option>' + ents.map(function (e) { return '<option value="' + esc(e.id) + '"' + (e.id === PROFILE.entity ? ' selected' : '') + '>' + esc(e.label) + '</option>'; }).join('');
  $('acts').innerHTML = ((APP && APP.activities) || []).map(function (a) { return '<button type="button" class="chip" data-act="act" data-id="' + esc(a.id) + '" aria-pressed="' + (has(PROFILE.acts, a.id) ? 'true' : 'false') + '">' + esc(a.label) + '</button>'; }).join('');
}

/* ───────── list ───────── */
var TOPICS = null;
function itemTime(it) { return new Date(it.date).getTime() || 0; }
function visibleItems() {
  var q = F.q.trim().toLowerCase(), now = new Date(TODAY + 'T23:59:59').getTime();
  var list = ITEMS.filter(function (it) {
    if (F.source && it.source !== F.source) return false;
    if (F.theme && (it.themes || []).indexOf(F.theme) === -1) return false;
    if (F.period && now - itemTime(it) > (+F.period) * 864e5) return false;
    if (F.reg) { var m = MATCH[it.id]; if (!m || !(m.nInstr || m.nOb)) return false; }
    if (F.todo && STORE.assessments[it.id] && STORE.assessments[it.id].decision) return false;
    if (q && (cleanTitle(it) + ' ' + it.source + ' ' + (it.themes || []).join(' ') + ' ' + (it.doc_label || '')).toLowerCase().indexOf(q) === -1) return false;
    return true;
  });
  var rank = { high: 3, medium: 2, low: 1 };
  list.sort(function (a, b) {
    if (F.sort === 'weight') return (b.legal_weight || 0) - (a.legal_weight || 0) || itemTime(b) - itemTime(a);
    if (F.sort === 'rel') {
      var ma = MATCH[a.id], mb = MATCH[b.id];
      var ra = ma && ma.top ? rank[ma.top.conf] * 10 + (ma.nOb ? 5 : 0) : 0, rb = mb && mb.top ? rank[mb.top.conf] * 10 + (mb.nOb ? 5 : 0) : 0;
      if (ra !== rb) return rb - ra;
      if ((b.legal_weight || 0) !== (a.legal_weight || 0)) return (b.legal_weight || 0) - (a.legal_weight || 0);
    }
    return itemTime(b) - itemTime(a);
  });
  return list;
}
function renderList() {
  var list = visibleItems(), shown = list.slice(0, SHOWN);
  $('listStat').textContent = list.length + ' of ' + ITEMS.length + ' items' + (list.length > shown.length ? ', showing ' + shown.length : '');
  if (!list.length) { $('items').innerHTML = '<div class="empty">No items match these filters.</div>'; return; }
  $('items').innerHTML = '<div role="list" aria-label="Regulatory items">' + shown.map(function (it) {
    var m = MATCH[it.id], a = STORE.assessments[it.id], chips = [];
    if (it.doc_label && it.doc_type !== 'news') chips.push('<span class="chip">' + esc(it.doc_label) + '</span>');
    if (m && m.top) chips.push('<span class="chip ' + (m.top.conf === 'high' ? 'ok' : 'imp') + '">' + esc(m.top.name) + (m.nOb ? ' · ' + plural(m.nOb, 'obligation') : '') + '</span>');
    if (a && a.decision) chips.push('<span class="chip acc">' + esc(labelOf(DECISIONS, a.decision)) + '</span>');
    return '<div role="listitem"><button type="button" class="item" data-act="pick" data-id="' + esc(it.id) + '" data-fk="item:' + esc(it.id) + '"' + (it.id === SEL ? ' aria-current="true"' : '') + '>' +
      '<span class="t">' + esc(cleanTitle(it)) + '</span><span class="m">' + esc(it.source) + ' · ' + esc(fmtItem(it.date)) + '</span>' +
      (chips.length ? '<span class="c">' + chips.join('') + '</span>' : '') + '</button></div>';
  }).join('') + '</div>' + (list.length > shown.length ? '<button type="button" class="btn more" data-act="more">Show ' + Math.min(LIMIT, list.length - shown.length) + ' more</button>' : '');
}
function fillFilters() {
  var srcs = {}, ths = {};
  ITEMS.forEach(function (it) { srcs[it.source] = 1; (it.themes || []).forEach(function (t) { ths[t] = 1; }); });
  $('fSource').innerHTML = '<option value="">All sources</option>' + Object.keys(srcs).sort().map(function (s) { return '<option>' + esc(s) + '</option>'; }).join('');
  $('fTheme').innerHTML = '<option value="">All topics</option>' + Object.keys(ths).sort().map(function (s) { return '<option>' + esc(s) + '</option>'; }).join('');
}

/* ───────── detail ───────── */
function renderEmpty() {
  var sug = ITEMS.filter(function (it) { var m = MATCH[it.id]; return m && (m.nInstr || m.nOb) && !(STORE.assessments[it.id] && STORE.assessments[it.id].decision); });
  sug.sort(function (a, b) { return (b.legal_weight || 0) - (a.legal_weight || 0) || itemTime(b) - itemTime(a); });
  $('detail').innerHTML = '<h2 style="margin-top:0">Choose a regulatory item</h2>' +
    '<p class="d-sum">Pick an item on the left, or start from one that touches your register. You get the affected obligations, controls, policies and customer segments, the dates that apply, and a task list. Set your firm type above so applicability is checked for you.</p>' +
    (sug.length ? '<div class="blk"><h3>Suggested to assess first <span class="count">' + sug.length + ' touch the register</span></h3><div class="cards">' +
      sug.slice(0, 5).map(function (it) { return '<div class="card"><div><div class="t">' + esc(cleanTitle(it)) + '</div><div class="s">' + esc(it.source) + ' · ' + esc(fmtItem(it.date)) + '</div></div><button type="button" class="btn sm" data-act="pick" data-id="' + esc(it.id) + '" data-fk="sugg:' + esc(it.id) + '">Assess</button></div>'; }).join('') + '</div></div>' : '');
}
function secItem(it) {
  var tags = [];
  if (it.doc_label) tags.push('<span class="chip">' + esc(it.doc_label) + '</span>');
  if (it.legal_status) tags.push('<span class="chip">' + esc(String(it.legal_status).replace(/-/g, ' ')) + '</span>');
  tags.push('<span class="chip">Legal weight ' + (it.legal_weight || 1) + ' of 10</span>');
  tags.push('<span class="chip ' + (it.impact === 3 ? 'crit' : 'imp') + '">RegWatch: ' + (it.impact === 3 ? 'Critical' : 'Important') + '</span>');
  (it.themes || []).slice(0, 3).forEach(function (t) { tags.push('<span class="chip">' + esc(t) + '</span>'); });
  var cov = EFF.obIds.length;
  return '<div class="d-top"><span><b>' + esc(it.source) + '</b> · ' + esc(fmtItem(it.date)) + '</span>' + (A.touched ? '<span class="chip acc">Saved on this device</span>' : '<span class="chip">Not saved yet: any change saves it</span>') + '</div>' +
    '<h2 id="dTitle" tabindex="-1">' + esc(cleanTitle(it)) + '</h2>' +
    (it.summary ? '<p class="d-sum">' + esc(it.summary) + '</p>' : '') +
    (it.so_what ? '<div class="note-box"><b>RegWatch so what:</b> ' + esc(it.so_what) + (it.action ? ' <b>Suggested action:</b> ' + esc(it.action) : '') + '</div>' : '') +
    '<div class="strip" aria-label="Item facts">' + tags.join('') + '</div>' +
    '<div class="d-links">' + (it.url ? '<a class="btn sm" href="' + esc(it.url) + '" target="_blank" rel="noopener noreferrer">Open the source<span class="sr"> (new tab)</span></a>' : '') + '<a class="btn sm" href="regwatch.html">RegWatch</a></div>' +
    '<div class="strip" aria-label="Impact summary"><span class="chip acc">' + plural(EFF.instrIds.length, 'instrument') + '</span><span class="chip acc">' + plural(cov, 'obligation') + (gapList().length ? ', ' + plural(gapList().length, 'gap') : '') + '</span><span class="chip acc">' +
    plural(EFF.controls.filter(function (c) { return c.on; }).length, 'control') + '</span><span class="chip acc">' + plural(EFF.policies.filter(function (c) { return c.on; }).length, 'policy', 'policies') + '</span><span class="chip acc">' + plural(A.tasks.filter(function (t) { return t.include; }).length, 'task') + '</span></div>' +
    (PROFILE.entity ? '' : '<div class="note-box warn">Your firm type is not set, so applicability is not checked and nothing is marked as not applicable. Choose it in the profile bar above.</div>');
}

function secInstruments() {
  var rows = {}, order = [];
  AN.instruments.forEach(function (m) { rows[m.id] = m; order.push(m.id); });
  Object.keys(A.over.instr).forEach(function (id) { if (A.over.instr[id] && !rows[id] && reg(id)) { var r = reg(id); rows[id] = { id: id, name: r.name, full_name: r.full_name, celex: r.celex, applies_from: r.applies_from || '', conf: '', reasons: [], verdict: ENG.verdictFor(r, PROFILE.entity, PROFILE.acts), manual: true }; order.push(id); } });
  var strong = order.filter(function (id) { var m = rows[id]; return m.conf === 'high' || m.conf === 'medium' || m.manual || EFF.instrOn[id]; });
  var weak = order.filter(function (id) { return strong.indexOf(id) === -1; });
  function card(id) {
    var m = rows[id], on = !!EFF.instrOn[id], r = reg(id);
    return '<div class="card' + (on ? '' : ' off') + '"><div><div class="t">' + esc(m.name) + ' <span style="font-weight:500;color:var(--text-2)">' + esc(m.full_name) + '</span></div>' +
      '<div class="chips" style="margin-top:6px">' + confChip(m.conf) + verdictChip(m.verdict) + (m.applies_from ? '<span class="chip">Applies from ' + esc(fmt(m.applies_from)) + '</span>' : '') + '</div>' +
      (m.reasons.length ? whyChips(m.reasons, 6) : '') +
      (m.verdict === 'na' ? '<div class="s">Not counted by default because the applicability matrix says it does not apply to your firm type.</div>' : '') +
      (m.note ? '<div class="s">' + esc(m.note) + '</div>' : '') +
      '<div class="s"><a href="law.html?celex=' + esc(m.celex) + '">Open ' + esc(m.name) + ' in the law reader</a></div></div>' + tog('instr', id, on, m.name) + '</div>';
  }
  var existing = Object.keys(rows);
  var addable = (APP.regulations || []).filter(function (r) { return existing.indexOf(r.id) === -1; });
  return '<section class="blk" aria-labelledby="hInstr"><h3 id="hInstr">Affected instruments <span class="count">' + EFF.instrIds.length + ' counted</span></h3>' +
    '<p class="lead">Instruments from the applicability matrix that the item names or describes. Switch any match on or off: your choice is what the rest of the page uses.</p>' +
    (strong.length ? '<div class="cards">' + strong.map(card).join('') + '</div>' : '<div class="note-box">No instrument in the register is named or clearly described in this item. That does not mean it is irrelevant: read the source. Sanctions designations, for example, are outside the 15 instruments held here.</div>') +
    (weak.length ? '<details class="fold"><summary>Weak signals (' + weak.length + '), not counted</summary><div class="cards">' + weak.map(card).join('') + '</div></details>' : '') +
    (addable.length ? '<div class="addrow"><label class="sr" for="addInstr">Add an instrument</label><select class="sel" id="addInstr"><option value="">Add an instrument manually…</option>' + addable.map(function (r) { return '<option value="' + esc(r.id) + '">' + esc(r.name + ' · ' + r.full_name) + '</option>'; }).join('') + '</select><button type="button" class="btn sm" data-act="add" data-g="instr" data-sel="addInstr" data-fk="add:instr">Add</button></div>' : '') +
    '</section>';
}

function secObligations() {
  var rows = {}, order = [];
  AN.obligations.forEach(function (m) { rows[m.id] = m; order.push(m.id); });
  Object.keys(A.over.ob).forEach(function (id) { if (A.over.ob[id] && !rows[id] && ob(id)) { rows[id] = { id: id, conf: '', reasons: [], manual: true, inScope: true }; order.push(id); } });
  var strong = order.filter(function (id) { return rows[id].conf !== 'low' || EFF.obOn[id]; });
  var weak = order.filter(function (id) { return strong.indexOf(id) === -1; });
  function card(id) {
    var m = rows[id], o = ob(id), on = !!EFF.obOn[id], cv = covOf(id), ver = verifyExcerpt(o);
    return '<div class="card' + (on ? '' : ' off') + '"><div><div class="t">' + esc(o.legal_basis) + ': ' + esc(obTitle(o)) + '</div>' +
      '<div class="s">' + esc(o.what) + '</div>' +
      '<div class="chips" style="margin-top:6px">' + confChip(m.conf) + covChip(cv) + (m.inScope === false ? '<span class="chip crit">Not for ' + esc(entityLabel()) + '</span>' : '') + (o.deadline ? '<span class="chip">Applies from ' + esc(fmt(o.deadline)) + '</span>' : '') + '</div>' +
      (m.reasons.length ? whyChips(m.reasons, 6) : '') +
      (cv.controls.length ? '<div class="s">Controls: ' + cv.controls.map(function (c) { return esc(c.name) + (cv.weak.indexOf(c) !== -1 ? ' (needs attention)' : ''); }).join('; ') + '</div>' : '') +
      '<details class="fold"><summary>Legal excerpt' + (ver ? ' (checked against the official text)' : '') + '</summary>' +
      (ver ? '<blockquote class="quote">' + esc(o.verbatim) + '</blockquote><div class="s">Verbatim from ' + esc(o.legal_basis) + ', checked in this page against the CELLAR text held in the law reader.</div>' : '<div class="s">The register\u2019s excerpt for this obligation is condensed and does not match the official text word for word, so it is not shown as a quote. Read the article in the law reader.</div>') +
      '<div class="s"><a href="' + esc(o.source_url) + '">Open ' + esc(o.legal_basis) + ' in the law reader</a> · <a href="workspace.html?open=' + esc(o.id) + '">Open in the Compliance workspace</a></div></details></div>' + tog('ob', id, on, o.legal_basis) + '</div>';
  }
  var others = AN.others.filter(function (x) { return !rows[x.id]; });
  var addable = OBS.filter(function (o) { return !rows[o.id]; });
  var regs = EFF.instrIds.filter(function (i) { return !OBS.some(function (o) { return ENG.obParent(o) === i; }); });
  return '<section class="blk" aria-labelledby="hOb"><h3 id="hOb">Affected obligations <span class="count">' + EFF.obIds.length + ' counted' + (gapList().length ? ', ' + gapList().length + ' without a control' : '') + '</span></h3>' +
    '<p class="lead">Obligations in your register that the item touches, with the terms that matched and whether a control answers each one.</p>' +
    (strong.length ? '<div class="cards">' + strong.map(card).join('') + '</div>' : '<div class="note-box">No obligation in the register is indicated by the text of this item.' + (regs.length ? ' The register holds obligations for AMLR only so far; ' + regs.map(function (i) { return esc(reg(i).name); }).join(', ') + ' ' + (regs.length > 1 ? 'have' : 'has') + ' none yet, so review ' + (regs.length > 1 ? 'those instruments' : 'that instrument') + ' directly.' : '') + '</div>') +
    (weak.length ? '<details class="fold"><summary>Weak signals (' + weak.length + '), not counted</summary><div class="cards">' + weak.map(card).join('') + '</div></details>' : '') +
    (others.length ? '<details class="fold"><summary>Other register obligations under the matched instruments (' + others.length + '), not indicated by the text</summary><div class="cards">' + others.map(function (x) { var o = ob(x.id); return '<div class="card off"><div><div class="t">' + esc(o.legal_basis) + ': ' + esc(obTitle(o)) + '</div><div class="s">' + esc(o.what) + '</div></div><button type="button" class="tog" data-act="add-id" data-g="ob" data-id="' + esc(o.id) + '" data-fk="addo:' + esc(o.id) + '" aria-label="Count ' + esc(o.legal_basis) + ' as affected">Count as affected</button></div>'; }).join('') + '</div></details>' : '') +
    (addable.length ? '<div class="addrow"><label class="sr" for="addOb">Add an obligation</label><select class="sel" id="addOb"><option value="">Add an obligation manually…</option>' + addable.map(function (o) { return '<option value="' + esc(o.id) + '">' + esc(o.legal_basis + ' · ' + obTitle(o)) + '</option>'; }).join('') + '</select><button type="button" class="btn sm" data-act="add" data-g="ob" data-sel="addOb" data-fk="add:ob">Add</button></div>' : '') +
    '</section>';
}

function viaText(c) { return c.via === 'obligation' ? 'maps to ' + c.obligations.map(function (id) { var o = ob(id); return o ? o.legal_basis : id; }).join(', ') : c.via === 'legal reference' ? 'cites ' + c.term : c.via === 'name' ? 'name contains “' + c.term + '” (' + c.tag + ')' : 'added by you'; }
function secControls() {
  var rows = EFF.controls.slice().sort(function (a, b) { return (b.on ? 1 : 0) - (a.on ? 1 : 0); });
  var addable = CONTROLS.filter(function (c) { return !rows.some(function (r) { return r.id === c.id; }); });
  var today = new Date(TODAY + 'T12:00:00');
  return '<section class="blk" aria-labelledby="hCtl"><h3 id="hCtl">Affected controls <span class="count">' + rows.filter(function (r) { return r.on; }).length + ' counted</span></h3>' +
    '<p class="lead">Controls mapped to the affected obligations, from the controls library and your device-local overlay. Controls found only by a name keyword are suggestions and start off.</p>' +
    (rows.length ? '<div class="cards">' + rows.map(function (r) {
      var c = ctl(r.id); if (!c) return '';
      var od = window.ControlsData && window.ControlsData.isOverdue(c, today);
      return '<div class="card' + (r.on ? '' : ' off') + '"><div><div class="t">' + esc(c.name) + '</div><div class="s">' + esc(c.id) + ' · owner ' + esc(c.owner || 'unassigned') + ' · ' + esc(c.frequency || '') + ' · last tested ' + esc(c.last_tested ? fmt(c.last_tested) : 'never') + '</div>' +
        '<div class="chips" style="margin-top:6px"><span class="chip ' + (c.status === 'approved' ? 'ok' : 'imp') + '">' + esc(String(c.status || '').replace(/_/g, ' ')) + '</span>' + (od ? '<span class="chip crit">Retest overdue</span>' : '') + (r.via === 'name' ? '<span class="chip">Suggestion</span>' : '') + '</div>' +
        '<div class="s">Why: ' + esc(viaText(r)) + '</div><div class="s"><a href="workspace.html?control=' + esc(c.id) + '">Open control</a></div></div>' + tog('ctl', r.id, r.on, c.name) + '</div>';
    }).join('') + '</div>' : '<div class="note-box">' + (EFF.obIds.length ? 'No control is mapped to the affected obligations. See the gaps above.' : 'No obligation is counted yet, so there are no mapped controls.') + '</div>') +
    (addable.length ? '<div class="addrow"><label class="sr" for="addCtl">Add a control</label><select class="sel" id="addCtl"><option value="">Add a control manually…</option>' + addable.map(function (c) { return '<option value="' + esc(c.id) + '">' + esc(c.id + ' · ' + c.name) + '</option>'; }).join('') + '</select><button type="button" class="btn sm" data-act="add" data-g="ctl" data-sel="addCtl" data-fk="add:ctl">Add</button></div>' : '') +
    '</section>';
}
function secPolicies() {
  var rows = EFF.policies.slice().sort(function (a, b) { return (b.on ? 1 : 0) - (a.on ? 1 : 0); });
  var addable = POLS.filter(function (p) { return !p.retired && !rows.some(function (r) { return r.id === p.id; }); });
  return '<section class="blk" aria-labelledby="hPol"><h3 id="hPol">Affected policies <span class="count">' + rows.filter(function (r) { return r.on; }).length + ' counted</span></h3>' +
    '<p class="lead">From the policy register on this device, by linked obligation, by cited instrument, or by a name keyword (suggestion only).</p>' +
    (!POLS.length ? '<div class="note-box">No policy register was found on this device. When you keep policies in the Policies module they appear here and can be linked to tasks. <a href="policies.html">Open Policies</a></div>' :
      (rows.length ? '<div class="cards">' + rows.map(function (r) {
        var p = pol(r.id); if (!p) return '';
        return '<div class="card' + (r.on ? '' : ' off') + '"><div><div class="t">' + esc(p.title) + '</div><div class="s">' + esc(p.ref || p.id) + ' · owner ' + esc(p.owner || 'unassigned') + '</div><div class="chips" style="margin-top:6px">' + (r.via === 'name' ? '<span class="chip">Suggestion</span>' : '') + '</div><div class="s">Why: ' + esc(viaText(r)) + '</div></div>' + tog('pol', r.id, r.on, p.title) + '</div>';
      }).join('') + '</div>' : '<div class="note-box">No policy is linked to the affected obligations or instruments.</div>') +
      (addable.length ? '<div class="addrow"><label class="sr" for="addPol">Add a policy</label><select class="sel" id="addPol"><option value="">Add a policy manually…</option>' + addable.map(function (p) { return '<option value="' + esc(p.id) + '">' + esc(p.title) + '</option>'; }).join('') + '</select><button type="button" class="btn sm" data-act="add" data-g="pol" data-sel="addPol" data-fk="add:pol">Add</button></div>' : '')) +
    '</section>';
}
function secSegments() {
  var rows = EFF.segments;
  return '<section class="blk" aria-labelledby="hSeg"><h3 id="hSeg">Customer segments affected <span class="count">' + rows.filter(function (r) { return r.on; }).length + ' counted</span></h3>' +
    '<p class="lead">Indicative, derived from the obligation topics and instruments above. Check against your own customer taxonomy.</p>' +
    (rows.length ? '<div class="cards">' + rows.map(function (s) {
      return '<div class="card' + (s.on ? '' : ' off') + '"><div><div class="t">' + esc(s.label) + '</div><div class="s">' + esc(s.note) + '</div><div class="chips" style="margin-top:6px">' + confChip(s.conf) + '</div>' + whyChips(s.reasons, 4) + '</div>' + tog('seg', s.id, s.on, s.label) + '</div>';
    }).join('') + '</div>' : '<div class="note-box">No customer segment is indicated by the matches so far.</div>') + '</section>';
}

var KIND_LABEL = { field: 'RegWatch deadline field', effective: 'reads like an application or effective date', closing: 'reads like a deadline or closing date', act: 'date of the act (adoption), not an application date', mentioned: 'date mentioned in the text' };
function daysText(iso) { var d = IM.diffDays(iso, TODAY); return d === 0 ? 'today' : d > 0 ? 'in ' + plural(d, 'day') : plural(-d, 'day') + ' ago'; }
function secDates() {
  var reg = [];
  EFF.instrIds.forEach(function (id) { var r = ENG.regById[id]; if (r && r.applies_from) reg.push({ iso: r.applies_from, label: r.name + ' applies from (applicability matrix)' }); });
  EFF.obIds.forEach(function (id) { var o = ob(id); if (o && o.deadline && !reg.some(function (x) { return x.iso === o.deadline && /obligation/.test(x.label); })) reg.push({ iso: o.deadline, label: 'Register deadline for ' + o.legal_basis }); });
  var seen = {}; reg = reg.filter(function (x) { var k = x.iso + x.label.split(' ')[0]; if (seen[k]) return false; seen[k] = 1; return true; }).slice(0, 4);
  function dateField(id, label, key, hint) {
    return '<div class="field"><label for="' + id + '">' + label + '</label><input class="in" type="date" id="' + id + '" data-act="date" data-k="' + key + '" value="' + esc(A[key]) + '" data-fk="date:' + key + '"><div class="hint">' + esc(A[key + 'Src'] ? 'Source: ' + A[key + 'Src'] + '. ' : '') + hint + '</div></div>';
  }
  var anc = anchor();
  return '<section class="blk" aria-labelledby="hDates"><h3 id="hDates">Dates and deadline</h3>' +
    '<p class="lead">Dates are taken only from the item’s fields and text, or entered by you. Nothing is assumed. Task due dates count back from the planning deadline.</p>' +
    '<div class="fields three">' + dateField('dEff', 'Applies or takes effect', 'effective', '') + dateField('dCon', 'Consultation or response deadline', 'consultation', '') + dateField('dPlan', 'Planning deadline (optional)', 'planning', 'Leave empty to use the effective date, then the consultation deadline.') + '</div>' +
    '<div class="stat">' + (anc ? 'Tasks are planned against the <b>' + anchorLabel() + '</b>, ' + esc(fmt(anc)) + ' (' + daysText(anc) + ').' + (IM.diffDays(anc, TODAY) <= 0 ? ' That date has passed, so due dates count forward from today.' : '') : 'No deadline set: task due dates count forward from today (' + esc(fmt(TODAY)) + ').') + '</div>' +
    (AN.dates.length ? '<details class="fold" open><summary>Dates found in the item (' + AN.dates.length + ')</summary><div class="dates">' + AN.dates.map(function (d, i) {
      return '<div class="drow"><div><b>' + esc(fmt(d.iso)) + '</b> <span class="chip why">' + esc(KIND_LABEL[d.kind]) + '</span><span class="snip">“' + esc(d.snippet) + '”</span></div><div class="btns"><button type="button" class="btn sm" data-act="usedate" data-k="effective" data-i="' + i + '" data-fk="ud:e:' + i + '">Use as effective</button><button type="button" class="btn sm" data-act="usedate" data-k="consultation" data-i="' + i + '" data-fk="ud:c:' + i + '">Use as deadline</button></div></div>';
    }).join('') + '</div></details>' : '<div class="note-box">No date was found in the item fields or text. Open the source and enter the dates above.</div>') +
    (reg.length ? '<details class="fold"><summary>Reference dates from the register</summary><div class="dates">' + reg.map(function (d, i) {
      return '<div class="drow"><div><b>' + esc(fmt(d.iso)) + '</b> <span class="snip">' + esc(d.label) + '</span></div><div class="btns"><button type="button" class="btn sm" data-act="useplan" data-iso="' + esc(d.iso) + '" data-fk="up:' + i + '">Use as planning deadline</button></div></div>';
    }).join('') + '</div></details>' : '') + '</section>';
}

function secAssessment() {
  var sg = sevSuggestion(), dg = ENG.suggestDecision(SELITEM(), EFF);
  return '<section class="blk" aria-labelledby="hAss"><h3 id="hAss">Assessment</h3>' +
    '<p class="lead">Your call. Suggestions come from RegWatch’s legal weight and the matches above, and are not legal severity.</p>' +
    '<fieldset class="field"><legend>Decision</legend><div class="radios">' + DECISIONS.map(function (d) { return '<label><input type="radio" name="decision" value="' + d[0] + '" data-act="decision" data-fk="dec:' + d[0] + '"' + (A.decision === d[0] ? ' checked' : '') + '>' + d[1] + '</label>'; }).join('') + '</div>' +
    '<div class="sugg">Suggestion: <b>' + esc(labelOf(DECISIONS, dg.value)) + '</b>. ' + esc(dg.why) + (A.decision ? '' : ' Tasks below are a preview until you decide.') + '</div></fieldset>' +
    '<div class="fields"><div class="field"><label for="sev">Severity</label><select class="sel" id="sev" data-act="severity"><option value="">Not set</option>' + SEV.map(function (s) { return '<option value="' + s[0] + '"' + (A.severity === s[0] ? ' selected' : '') + '>' + s[1] + '</option>'; }).join('') + '</select>' +
    '<div class="sugg">Suggestion (rule-based): <b>' + esc(labelOf(SEV, sg.value)) + '</b>, because ' + esc(sg.why.join('; ')) + '. ' + (A.severity === sg.value ? '' : '<button type="button" class="btn sm" data-act="usesev" data-fk="usesev">Use suggestion</button>') + '</div></div>' +
    '<div class="field"><label for="own">Owner</label><input class="in" id="own" type="text" data-act="owner" value="' + esc(A.owner) + '" autocomplete="off" placeholder="Who is accountable for this assessment"><div class="hint">Default owner for tasks that have none of their own.</div></div></div>' +
    '<div class="field" style="margin-top:12px"><label for="rat">Rationale</label><textarea class="in" id="rat" data-act="rationale" placeholder="Why this decision? Which parts of the change apply, and which do not?">' + esc(A.rationale) + '</textarea></div></section>';
}

function secTasks() {
  var tr = tracker();
  var list = A.tasks;
  var dec = activeDecision();
  return '<section class="blk" aria-labelledby="hTasks"><h3 id="hTasks">Tasks <span class="count">' + list.filter(function (t) { return t.include; }).length + ' included' + (A.decision ? '' : ', preview') + '</span></h3>' +
    '<p class="lead">Generated from templates by the matches above, ordered by due date. Edit anything: your edits are kept. Due dates ' + (anchor() ? 'count back from the ' + anchorLabel() : 'count forward from today') + '.</p>' +
    (dec === 'no_action' ? '<div class="note-box">Decision is no action, so no tasks are generated. Record the reasoning above. Add a task manually if you still need one.</div>' : '') +
    list.slice().sort(function (a, b) { return (a.due || '9').localeCompare(b.due || '9'); }).map(function (t) {
      var created = t.issueId && tr.ids[t.issueId];
      return '<div class="task' + (t.include ? '' : ' off') + '" data-tid="' + esc(t.id) + '"><div class="tr1"><label class="inc"><input type="checkbox" data-act="tinc" data-tid="' + esc(t.id) + '" data-fk="tinc:' + esc(t.id) + '"' + (t.include ? ' checked' : '') + '><span class="sr">Include this task</span></label>' +
        '<div class="field"><label class="sr" for="tt-' + esc(t.id) + '">Task title</label><input class="in ttl" id="tt-' + esc(t.id) + '" type="text" data-act="tfield" data-f="title" data-tid="' + esc(t.id) + '" value="' + esc(t.title) + '" autocomplete="off" data-fk="tt:' + esc(t.id) + '"></div></div>' +
        '<div class="tr2"><div class="field"><label for="to-' + esc(t.id) + '">Owner</label><input class="in" id="to-' + esc(t.id) + '" type="text" data-act="tfield" data-f="owner" data-tid="' + esc(t.id) + '" value="' + esc(t.owner) + '" autocomplete="off" placeholder="' + esc(A.owner || 'Unassigned') + '"></div>' +
        '<div class="field"><label for="td-' + esc(t.id) + '">Due</label><input class="in" id="td-' + esc(t.id) + '" type="date" data-act="tfield" data-f="due" data-tid="' + esc(t.id) + '" value="' + esc(t.due) + '"></div>' +
        '<div class="field"><label for="ts-' + esc(t.id) + '">Severity</label><select class="sel" id="ts-' + esc(t.id) + '" data-act="tfield" data-f="severity" data-tid="' + esc(t.id) + '">' + SEV.map(function (s) { return '<option value="' + s[0] + '"' + (t.severity === s[0] ? ' selected' : '') + '>' + s[1] + '</option>'; }).join('') + '</select></div></div>' +
        (t.detail ? '<div class="det">' + esc(t.detail) + '</div>' : '') +
        '<div class="tr3">' + (t.obligation_ids || []).slice(0, 4).map(function (id) { var o = ob(id); return '<span class="chip">' + esc(o ? o.legal_basis : id) + '</span>'; }).join('') +
        (created ? '<span class="chip ok">Issue ' + esc(t.issueId) + '</span><a class="btn sm" data-fk="issue:' + esc(t.id) + '" href="actions.html#' + esc(t.issueId) + '">Open in tracker</a>' :
          '<button type="button" class="btn sm pri" data-act="issue" data-tid="' + esc(t.id) + '" data-fk="issue:' + esc(t.id) + '"' + (t.include ? '' : ' disabled') + '>Create issue</button><a class="btn sm" href="' + esc(prefilledLink(t)) + '">Open prefilled form</a>') +
        (t.custom ? '<button type="button" class="btn sm danger" data-act="tdel" data-tid="' + esc(t.id) + '" data-fk="tdel:' + esc(t.id) + '">Remove</button>' : '') + '</div></div>';
    }).join('') +
    (list.length ? '' : '<div class="note-box">No tasks yet. Decide above, or add one.</div>') +
    '<div class="outs"><button type="button" class="btn sm" data-act="tadd" data-fk="tadd">Add a task</button><button type="button" class="btn sm pri" data-act="issue-all" data-fk="issue-all">Create issues for all included tasks</button></div>' +
    '<div class="stat">' + (tr.exists ? 'The tracker on this device holds ' + plural(tr.n, 'issue') + '. New issues are added to it.' : 'The tracker has not been opened on this device yet: creating an issue starts its register here.') + ' Open the <a href="actions.html">Issues and actions</a> page to work them. Issues start as open, 2LOD, self-identified.</div></section>';
}

function secOutputs() {
  return '<section class="blk" aria-labelledby="hOut"><h3 id="hOut">Outputs</h3><p class="lead">Take the assessment out of the page.</p><div class="outs">' +
    '<button type="button" class="btn pri" data-act="memo" data-fk="memo">Impact memo (print or PDF)</button>' +
    '<button type="button" class="btn" data-act="csv" data-fk="csv">Tasks as CSV</button>' +
    '<button type="button" class="btn" data-act="json" data-fk="json">Assessment as JSON</button>' +
    '<button type="button" class="btn danger" data-act="reset" data-fk="reset">Reset this assessment</button></div></section>' +
    '<section class="blk" aria-labelledby="hHow"><details class="fold" style="margin-top:0"><summary id="hHow">How matching works, and its limits</summary>' +
    '<div class="note-box" style="margin-top:8px">Matching is rule-based and approximate. Each instrument and obligation scores points for citations (such as “575/2013”), names, specific keywords and the item’s source or theme; the score becomes high, medium or low confidence and the terms that produced it are shown. Only high and medium matches that apply to your firm type are counted by default; the rest are shown as weak signals. The register holds 12 AMLR obligations, so items about other instruments are matched to the instrument only. Rules and keywords are in <code>data/impact-rules.json</code>.<br><br>' +
    'AI-assisted matching is planned (slice A3, through <code>docs/ai.js</code>) and is not connected: ' + esc(aiSecondOpinion()) + ' It would only ever add a labelled suggestion; a person decides.</div></details></section>';
}

/* AI HOOK (slice A3): returns the status line shown in "How matching works".
   When docs/ai.js exists, call its retrieval-grounded impact suggestion here, label the
   result as AI-drafted, verify any quotes and let the user accept or discard. Not implemented. */
function aiSecondOpinion() {
  return window.RegRadarAI ? 'docs/ai.js is present but this page does not call it yet.' : 'no model is called, everything you see is computed in your browser.';
}

function renderDetail(fk) {
  var focusKey = fk || (document.activeElement && document.activeElement.getAttribute && document.activeElement.getAttribute('data-fk')) || '';
  var it = SELITEM();
  if (!it) { renderEmpty(); return; }
  $('detail').innerHTML = secItem(it) + secInstruments() + secObligations() + secControls() + secPolicies() + secSegments() + secDates() + secAssessment() + secTasks() + secOutputs();
  if (focusKey) { var t = $('detail').querySelector('[data-fk="' + focusKey.replace(/"/g, '\\"') + '"]'); if (t) t.focus({ preventScroll: true }); }
}

/* ───────── tracker (Issues and actions store) ───────── */
function tracker() {
  var raw = lsGet(AKEY), ids = {}, n = 0, exists = false;
  if (raw) { try { var s = JSON.parse(raw); if (s && Array.isArray(s.issues)) { exists = true; n = s.issues.length; s.issues.forEach(function (i) { ids[i.id] = 1; }); } } catch (e) { /* unreadable */ } }
  return { exists: exists, n: n, ids: ids, raw: raw };
}
function prefilledLink(t) {
  var q = ['new=1', 'severity=' + encodeURIComponent(t.severity || 'medium'), 'title=' + encodeURIComponent(t.title || ''), 'due=' + encodeURIComponent(t.due || '')];
  if (t.owner || A.owner) q.push('owner=' + encodeURIComponent(t.owner || A.owner));
  if ((t.obligation_ids || [])[0]) q.push('obligation=' + encodeURIComponent(t.obligation_ids[0]));
  return 'actions.html?' + q.join('&');
}
function issueFor(t) {
  var it = SELITEM(), o = (t.obligation_ids || []).map(obLabel);
  var desc = ['Raised from a regulatory impact assessment.', 'Item: ' + A.itemTitle + ' (' + A.itemSource + ', ' + fmt(A.itemDate) + ')' + (A.itemUrl ? ' ' + A.itemUrl : ''),
    A.decision ? 'Decision: ' + labelOf(DECISIONS, A.decision) + '.' : '', t.detail ? 'Task: ' + t.detail : '', o.length ? 'Obligations: ' + o.join('; ') + '.' : '', A.rationale ? 'Rationale: ' + A.rationale : ''].filter(Boolean).join('\n');
  void it;
  var shortT = A.itemTitle.length > 48 ? A.itemTitle.slice(0, 45) + '\u2026' : A.itemTitle;
  return { id: '', title: t.title + ' (' + shortT + ')', description: desc, source: 'self_identified', source_ref: 'RegWatch item ' + String(A.itemId).slice(0, 8), severity: t.severity || 'medium', root_cause: 'Other',
    owner: t.owner || A.owner || '', lod: '2LOD', status: 'open', opened_on: TODAY, due_on: t.due || IM.addDays(TODAY, 30), closed_on: '', closed_by: '', closure_note: '', submitted_on: '', accepted: null,
    control_ids: (t.control_ids || []).slice(), obligation_ids: (t.obligation_ids || []).slice(), actions: [], history: [{ d: TODAY, t: 'Opened from regulatory impact assessment (RegWatch item ' + String(A.itemId).slice(0, 8) + ')' }], demo: false, impact_ref: A.itemId };
}
function createIssues(tasks) {
  var tr = tracker();
  if (tr.raw && !tr.exists) { toast('The tracker data on this device could not be read, so nothing was written. Downloading the issues instead.'); download('regradar-issues-' + TODAY + '.json', JSON.stringify(tasks.map(issueFor), null, 2), 'application/json'); return; }
  var s = { v: 1, seq: 0, issues: [] };
  if (tr.exists) { try { s = JSON.parse(tr.raw); } catch (e) { /* handled above */ } }
  s.issues = s.issues || []; s.seq = s.seq || 0;
  s.issues.forEach(function (i) { var n = parseInt(String(i.id).replace(/\D/g, ''), 10) || 0; if (n > s.seq) s.seq = n; });
  var made = [];
  tasks.forEach(function (t) {
    var i = issueFor(t); s.seq++; i.id = 'ISS-' + (s.seq < 100 ? ('00' + s.seq).slice(-3) : s.seq);
    s.issues.push(i); made.push([t, i.id]);
  });
  if (!lsSet(AKEY, JSON.stringify(s))) {
    toast('Could not write to the tracker (storage blocked or full). Downloading the issues instead.');
    download('regradar-issues-' + TODAY + '.json', JSON.stringify(tasks.map(issueFor), null, 2), 'application/json'); return;
  }
  made.forEach(function (m) { m[0].issueId = m[1]; m[0].edited = true; });
  touch();
  toast(made.length === 1 ? 'Issue ' + made[0][1] + ' created in the tracker' : made.length + ' issues created in the tracker');
}

/* ───────── outputs ───────── */
function download(name, text, type) {
  try {
    var b = new Blob([text], { type: type || 'text/plain' }), a = document.createElement('a');
    a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  } catch (e) { toast('Download is not available in this browser.'); }
}
function csvCell(v) { var s = String(v == null ? '' : v); if (/^[=+\-@]/.test(s)) s = "'" + s; return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
function tasksCSV() {
  var head = ['task_id', 'title', 'kind', 'severity', 'owner', 'due', 'planning_deadline', 'included', 'obligations', 'controls', 'policies', 'issue_id', 'item_id', 'item_title', 'item_url', 'decision'];
  var rows = A.tasks.slice().sort(function (a, b) { return (a.due || '9').localeCompare(b.due || '9'); }).map(function (t) {
    return [t.id, t.title, t.kind || 'custom', t.severity, t.owner || A.owner, t.due, anchor(), t.include ? 'yes' : 'no', (t.obligation_ids || []).map(function (id) { var o = ob(id); return o ? o.legal_basis : id; }).join('; '),
      (t.control_ids || []).join('; '), (t.policy_ids || []).join('; '), t.issueId || '', A.itemId, A.itemTitle, A.itemUrl, labelOf(DECISIONS, A.decision)];
  });
  return [head].concat(rows).map(function (r) { return r.map(csvCell).join(','); }).join('\r\n');
}
function memoHTML() {
  var it = SELITEM(), gl = gapList(), tasks = A.tasks.filter(function (t) { return t.include; }).sort(function (a, b) { return (a.due || '9').localeCompare(b.due || '9'); });
  var ctls = EFF.controls.filter(function (c) { return c.on && ctl(c.id); }), pols = EFF.policies.filter(function (c) { return c.on && pol(c.id); }), segs = EFF.segments.filter(function (s) { return s.on; });
  function cap(arr, n, fn) { return arr.slice(0, n).map(fn).join('') + (arr.length > n ? '<tr><td colspan="4">+' + (arr.length - n) + ' more in the full assessment</td></tr>' : ''); }
  var anc = anchor();
  return '<h1>Regulatory change: impact memo</h1><p class="sub">' + esc(entityLabel() || 'Firm type not set') + (actLabels().length ? ' · ' + esc(actLabels().join(', ')) : '') + ' · prepared ' + esc(fmt(TODAY)) + (A.owner ? ' · owner ' + esc(A.owner) : '') + '</p>' +
    '<h2>The change</h2><p><b>' + esc(A.itemTitle) + '</b></p><p class="sub">' + esc(A.itemSource) + ', published ' + esc(fmt(A.itemDate)) + (it && it.doc_label ? ' · ' + esc(it.doc_label) : '') + (it && it.legal_status ? ' · ' + esc(String(it.legal_status).replace(/-/g, ' ')) : '') + (A.itemUrl ? '<br>' + esc(A.itemUrl) : '') + '</p>' +
    '<h2>Assessment</h2><p><b>Decision:</b> ' + esc(A.decision ? labelOf(DECISIONS, A.decision) : 'not yet decided') + ' · <b>Severity:</b> ' + esc(A.severity ? labelOf(SEV, A.severity) : 'not set') + ' · <b>Deadline:</b> ' + (anc ? esc(fmt(anc)) + ' (' + anchorLabel() + ')' : 'none set') + (A.effective ? ' · <b>Applies:</b> ' + esc(fmt(A.effective)) : '') + (A.consultation ? ' · <b>Consultation closes:</b> ' + esc(fmt(A.consultation)) : '') + '</p>' +
    (A.rationale ? '<p><b>Rationale:</b> ' + esc(A.rationale) + '</p>' : '') +
    '<h2>Affected instruments and obligations</h2>' +
    (EFF.instrIds.length || EFF.obIds.length ? '<table><tr><th>Item</th><th>Basis</th><th>Coverage</th><th>Applies from</th></tr>' +
      EFF.instrIds.map(function (id) { var m = AN.instruments.filter(function (x) { return x.id === id; })[0], r = reg(id); return '<tr><td>' + esc(r.name) + '</td><td>' + esc(m ? CONF_LABEL[m.conf] + ': ' + m.reasons.slice(0, 3).map(whyText).join(', ') : 'added by reviewer') + '</td><td>instrument</td><td>' + esc(r.applies_from ? fmt(r.applies_from) : '') + '</td></tr>'; }).join('') +
      cap(EFF.obIds, 10, function (id) { var o = ob(id), m = AN.obligations.filter(function (x) { return x.id === id; })[0], cv = covOf(id); return '<tr><td>' + esc(o.legal_basis + ': ' + obTitle(o)) + '</td><td>' + esc(m ? CONF_LABEL[m.conf] : 'added by reviewer') + '</td><td>' + (cv.state === 'gap' ? 'GAP: no control' : cv.state === 'attention' ? 'covered, needs attention' : 'covered (' + cv.controls.length + ')') + '</td><td>' + esc(o.deadline ? fmt(o.deadline) : '') + '</td></tr>'; }) + '</table>' : '<p>None counted as affected.</p>') +
    '<h2>Controls, policies and customer segments</h2><p><b>Controls (' + ctls.length + '):</b> ' + (ctls.map(function (c) { return esc(ctl(c.id).name); }).join('; ') || 'none') + '.</p>' +
    '<p><b>Policies (' + pols.length + '):</b> ' + (pols.map(function (c) { return esc(pol(c.id).title); }).join('; ') || (POLS.length ? 'none' : 'no policy register on this device')) + '.</p>' +
    '<p><b>Customer segments (' + segs.length + '):</b> ' + (segs.map(function (s) { return esc(s.label); }).join('; ') || 'none indicated') + '.</p>' +
    '<h2>Tasks</h2>' + (tasks.length ? '<table><tr><th>Task</th><th>Owner</th><th>Due</th><th>Severity / issue</th></tr>' + cap(tasks, 12, function (t) { return '<tr><td>' + esc(t.title) + '</td><td>' + esc(t.owner || A.owner || 'unassigned') + '</td><td>' + esc(fmt(t.due)) + '</td><td>' + esc(labelOf(SEV, t.severity)) + (t.issueId ? ' · ' + esc(t.issueId) : '') + '</td></tr>'; }) + '</table>' : '<p>No tasks.</p>') +
    '<p class="disc">Indicative output of rule-based matching (RegRadar impact analysis), reviewed by the owner named above. Not legal advice or an audit opinion. Verify against the official source before relying on it. Legal excerpts are shown only after a check against the official text.</p>';
}

/* ───────── events ───────── */
function task(id) { for (var i = 0; i < A.tasks.length; i++) if (A.tasks[i].id === id) return A.tasks[i]; return null; }
function select(id, push) {
  var it = null;
  for (var i = 0; i < ITEMS.length; i++) if (ITEMS[i].id === id) { it = ITEMS[i]; break; }
  if (!it) return false;
  SEL = id; A = loadAssessment(it); derive();
  if (!A.touched && !A.effective && !A.consultation) prefillDates(A, AN);
  if (push) { try { var u = new URL(location.href); u.searchParams.set('item', id); history.replaceState(null, '', u.pathname + u.search); } catch (e) { /* ignore */ } }
  refresh();
  return true;
}
function resolveItem(q) {
  if (!q) return '';
  var exact = ITEMS.filter(function (i) { return i.id === q; })[0];
  if (exact) return exact.id;
  if (q.length >= 6) { var m = ITEMS.filter(function (i) { return i.id.indexOf(q) === 0; }); if (m.length === 1) return m[0].id; }
  return '';
}

document.addEventListener('click', function (e) {
  var b = e.target.closest('[data-act]');
  if (!b || b.tagName === 'SELECT' || b.tagName === 'INPUT' || b.tagName === 'TEXTAREA') return;
  var act = b.getAttribute('data-act'), id = b.getAttribute('data-id'), fk = b.getAttribute('data-fk') || '';
  switch (act) {
    case 'pick': OPENER = b; select(id, true); var d = $('dTitle'); if (d) { if (window.innerWidth < 981) d.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion:reduce)').matches ? 'auto' : 'smooth', block: 'start' }); d.focus({ preventScroll: true }); } break;
    case 'more': SHOWN += LIMIT; renderList(); break;
    case 'act': var k = PROFILE.acts.indexOf(id); if (k === -1) PROFILE.acts.push(id); else PROFILE.acts.splice(k, 1); saveProfile(); profileChanged(); break;
    case 'tog': var g = b.getAttribute('data-g'); var cur = b.getAttribute('aria-pressed') === 'true'; A.over[g][id] = !cur; touch(); refresh(fk); break;
    case 'add-id': A.over[b.getAttribute('data-g')][id] = true; touch(); refresh(); toast('Added'); break;
    case 'add': var sel = $(b.getAttribute('data-sel')); if (sel && sel.value) { A.over[b.getAttribute('data-g')][sel.value] = true; touch(); refresh(); toast('Added'); } else toast('Choose one from the list first'); break;
    case 'usedate': var dd = AN.dates[+b.getAttribute('data-i')], key = b.getAttribute('data-k'); A[key] = dd.iso; A[key + 'Src'] = 'chosen from the item text: verify at the source'; touch(); refresh(fk); break;
    case 'useplan': A.planning = b.getAttribute('data-iso'); A.planningSrc = 'register date'; touch(); refresh(fk); break;
    case 'usesev': A.severity = sevSuggestion().value; touch(); refresh(fk); break;
    case 'tadd': A.tasks.push({ id: 'T' + Math.random().toString(36).slice(2, 8), key: 'custom:' + Date.now(), kind: 'custom', custom: true, edited: true, include: true, title: '', detail: '', owner: '', due: IM.addDays(TODAY, 14), severity: A.severity || 'medium', obligation_ids: [], control_ids: [], policy_ids: [], issueId: '' }); touch(); refresh(); var last = A.tasks[A.tasks.length - 1]; var ti = $('tt-' + last.id); if (ti) ti.focus(); break;
    case 'tdel': A.tasks = A.tasks.filter(function (t) { return t.id !== id && t.id !== b.getAttribute('data-tid'); }); touch(); refresh(); break;
    case 'issue': var t = task(b.getAttribute('data-tid')); if (t) { if (!t.title.trim()) { toast('Give the task a title first'); break; } createIssues([t]); refresh(fk); } break;
    case 'issue-all': var todo = A.tasks.filter(function (x) { return x.include && !x.issueId && x.title.trim(); }); if (!todo.length) { toast('No included task is waiting for an issue'); break; } createIssues(todo); refresh(fk); break;
    case 'memo': OPENER = b; $('memoPrev').innerHTML = memoHTML(); $('printMemo').innerHTML = '<div class="memo">' + memoHTML() + '</div>'; $('memoDlg').showModal(); break;
    case 'memo-close': $('memoDlg').close(); break;
    case 'print': $('printMemo').innerHTML = '<div class="memo">' + memoHTML() + '</div>'; window.print(); break;
    case 'csv': download('regradar-impact-tasks-' + TODAY + '.csv', tasksCSV(), 'text/csv'); toast('Tasks exported'); break;
    case 'json': touch(); download('regradar-impact-' + String(A.itemId).slice(0, 8) + '-' + TODAY + '.json', JSON.stringify(A, null, 2), 'application/json'); break;
    case 'reset': if (window.confirm('Reset this assessment? Your decision, overrides, dates and tasks for this item are removed from this device. Issues already created in the tracker stay.')) { delete STORE.assessments[A.itemId]; saveStore(); A = null; select(SEL, false); toast('Assessment reset'); } break;
  }
});
$('memoDlg').addEventListener('close', function () { if (OPENER && document.contains(OPENER)) OPENER.focus(); });

function profileChanged() { computeMatches(); renderProfile(); if (SEL) { derive(); refresh(); } else { renderEmpty(); renderList(); renderKpis(); } }

document.addEventListener('change', function (e) {
  var el = e.target, act = el.getAttribute && el.getAttribute('data-act');
  if (!act) return;
  switch (act) {
    case 'entity': PROFILE.entity = el.value; saveProfile(); profileChanged(); break;
    case 'filter': F.source = $('fSource').value; F.theme = $('fTheme').value; F.period = $('fPeriod').value; F.sort = $('fSort').value; F.reg = $('fReg').checked; F.todo = $('fTodo').checked; SHOWN = LIMIT; renderList(); renderKpis(); break;
    case 'decision': A.decision = el.value; touch(); refresh(el.getAttribute('data-fk') || ''); break;
    case 'severity': A.severity = el.value; touch(); refresh(el.getAttribute('data-fk') || ''); break;
    case 'owner': A.owner = el.value.trim(); touch(); refresh(); break;
    case 'rationale': A.rationale = el.value; touch(); break;
    case 'date': var v = el.value, k = el.getAttribute('data-k'); if (v && !IM.validISO(v)) { toast('That date is not valid'); break; } A[k] = v; A[k + 'Src'] = v ? 'entered by you' : ''; touch(); refresh(el.getAttribute('data-fk')); break;
    case 'tinc': var t0 = task(el.getAttribute('data-tid')); if (t0) { t0.include = el.checked; t0.edited = true; touch(); refresh(el.getAttribute('data-fk')); } break;
    case 'tfield': var t1 = task(el.getAttribute('data-tid')), f = el.getAttribute('data-f'); if (t1) { if (f === 'due' && el.value && !IM.validISO(el.value)) { toast('That date is not valid'); break; } t1[f] = el.value; t1.edited = true; touch(); if (f === 'title') break; refresh(); } break;
  }
});
document.addEventListener('input', function (e) {
  var el = e.target;
  if (el.id === 'q') { F.q = el.value; SHOWN = LIMIT; renderList(); renderKpis(); }
  else if (el.getAttribute && el.getAttribute('data-act') === 'rationale') { A.rationale = el.value; A.touched = true; A.updated = new Date().toISOString(); clearTimeout(inputTimer); inputTimer = setTimeout(function () { STORE.assessments[A.itemId] = A; saveStore(); }, 600); }
});
var inputTimer = null;

window.toggleTheme = function () { var h = document.documentElement, t = h.dataset.theme === 'dark' ? 'light' : 'dark'; h.dataset.theme = t; try { localStorage.setItem('regradar-theme', t); } catch (e) { /* ignore */ } };

/* ───────── boot ───────── */
function getJSON(u) { return fetch(u, { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error(u); return r.json(); }); }
async function boot() {
  var res = await Promise.all([
    getJSON('data/items.json').catch(function () { return null; }),
    getJSON('data/applicability.json').catch(function () { return null; }),
    getJSON('data/obligations.json').catch(function () { return null; }),
    getJSON('data/impact-rules.json').catch(function () { return null; }),
    window.ControlsData ? window.ControlsData.load().catch(function () { return null; }) : Promise.resolve(null),
    getJSON('data/laws/32024R1624_EN.json').catch(function () { return null; })
  ]);
  if (!res[0] || !res[1] || !res[3]) { $('detail').innerHTML = '<div class="empty">Could not load the data for this page (' + (!res[0] ? 'RegWatch items' : !res[1] ? 'applicability matrix' : 'matching rules') + '). Check your connection and reload.</div>'; $('items').innerHTML = ''; return; }
  ITEMS = res[0]; APP = res[1]; OBS = (res[2] && res[2].obligations) || []; RULES = res[3]; CONTROLS = res[4] ? res[4].controls : []; LAW = res[5];
  ENG = IM.create(RULES, APP, OBS);
  loadStore(); loadProfile(); loadPolicies();
  fillFilters(); renderProfile(); computeMatches();
  var want = resolveItem(new URLSearchParams(location.search).get('item'));
  renderKpis(); renderList();
  if (want) select(want, false);
  else { renderEmpty(); if (new URLSearchParams(location.search).get('item')) toast('That item is not in the current RegWatch data'); }
  if (want) { var row = document.querySelector('.item[aria-current="true"]'); if (row && row.scrollIntoView) row.scrollIntoView({ block: 'nearest' }); }
}
boot();
})();
