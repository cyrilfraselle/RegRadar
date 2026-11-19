/* ═══════════════════════════════════════════════════════════════
   RegRadar: the briefing ("Jarvis", home.html)

   Built only from data spine queries (window.RR, docs/rr-core.js):
   what is due or overdue, files waiting for approval, open work per
   team member, and new obligations in the next 3, 6 or 12 months.
   The headline sentence is templated from those numbers (no AI call).
   Regulatory dates come from docs/data (obligations.json,
   applicability.json, items.json) and every one shows its source.
   ═══════════════════════════════════════════════════════════════ */
(function () {
'use strict';

var $ = function (id) { return document.getElementById(id); };
var R = null, BOOT = null, CFG = null, D = RR.dates, TODAY = '';
var UI = { who: '', months: 12, allDue: false, allFiles: false };
var WORK_TYPES = ['action', 'issue', 'case', 'policy', 'assessment', 'customer_file'];

/* ───────── helpers ───────── */
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }
function toast(m) { var t = $('toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove('on'); }, 2600); }
function download(name, text) {
  var a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' }));
  a.download = name; document.body.appendChild(a); a.click();
  setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
function nameOf(id) {
  if (!id) return 'Unassigned';
  var p = R.get(id);
  if (p) return p.title;
  return id === 'person:me' ? 'You (this device)' : id === 'system:bridge' ? 'Module import' : id;
}
function typeLabel(e) { return R.typeDef(e.type).label; }
function statusLabel(e) { var s = R.stateDef(e.type, e.status); return s ? s.label : e.status; }
function dueText(days) {
  if (days < 0) return plural(-days, 'day') + ' overdue';
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return 'Due in ' + days + ' days';
}
function dueChip(days) { return '<span class="chip ' + (days < 0 ? 'crit' : days <= 7 ? 'imp' : '') + '">' + esc(dueText(days)) + '</span>'; }
function isDemo(e) { return e.origin === 'demo' || (e.data && e.data.demo === true); }
function demoChip(e) { return isDemo(e) ? '<span class="chip demo">Demo</span>' : ''; }
function hrefFor(e) {
  var src = e.src && e.src.module, d = e.data || {};
  if (e.type === 'obligation') return 'workspace.html?open=' + encodeURIComponent(d.ref || '');
  if (e.type === 'regulation') return d.celex ? 'law.html?celex=' + encodeURIComponent(d.celex) : null;
  if (e.type === 'reg_change' && !src) return /^https?:\/\//.test(d.url || '') ? d.url : null;
  if (src === 'controls' && e.type === 'control') return 'workspace.html?control=' + encodeURIComponent(d.ref || '');
  if (src) { var m = RR.MODULES.concat(RR.bridge.migrated).filter(function (x) { return x.id === src; })[0]; return m ? m.page + (m.migrated ? '#' + encodeURIComponent(e.type === 'action' ? String(e.src.ref || '').split('/')[0] : e.id) : '') : null; }
  if (R.config().board.types.indexOf(e.type) !== -1) return 'board.html?open=' + encodeURIComponent(e.id);
  return null;
}
function titleLink(e) {
  var h = hrefFor(e), ext = h && /^https?:/.test(h);
  return h ? '<a href="' + esc(h) + '"' + (ext ? ' rel="noopener" target="_blank"' : '') + '>' + esc(e.title) + (ext ? '<span class="sr"> (opens the source in a new tab)</span>' : '') + '</a>' : esc(e.title);
}
function firmType() { return R.getSetting('firm_type') || ''; }
function firmLabel(id) {
  var e = ((BOOT.applicability && BOOT.applicability.entities) || []).filter(function (x) { return x.id === id; })[0];
  return e ? e.label : id;
}
function dueKind(e) {
  var k = CFG.briefing.due_kinds;
  for (var i = 0; i < k.length; i++) if (k[i].types.indexOf(e.type) !== -1) return k[i];
  return null;
}
// Does a regulatory record concern this firm type? (from the repo's own applicability data)
function applies(e) {
  var ft = firmType();
  if (e.type === 'obligation') return e.status !== 'not_applicable' && (!ft || (e.data.who || []).indexOf(ft) !== -1);
  if (e.type === 'regulation') return !ft || ((e.data.applies || {})[ft] || 'na') !== 'na';
  return true;
}

/* ───────── queries (RR only) ───────── */
function dueItems() {
  var types = [];
  CFG.briefing.due_kinds.forEach(function (k) { types = types.concat(k.types); });
  return R.list(types, function (e) {
    if (!e.due) return false;
    var cat = R.category(e);
    if (cat === 'done' || cat === 'cancelled') return false;
    var k = dueKind(e), days = D.diff(e.due, TODAY);
    if (k.id === 'regulatory') { if (days < 0 || !applies(e)) return false; }
    else if (UI.who && e.owner !== UI.who) return false;
    return days <= 30;
  }).map(function (e) { return { e: e, days: D.diff(e.due, TODAY), kind: dueKind(e) }; })
    .sort(function (a, b) { return a.days - b.days || a.e.title.localeCompare(b.e.title); });
}
function files() {
  return R.list(null, function (e) { return R.awaitingApproval(e) && (!UI.who || e.owner === UI.who); })
    .sort(function (a, b) { return (a.due || '9999') < (b.due || '9999') ? -1 : (a.due || '9999') > (b.due || '9999') ? 1 : a.title.localeCompare(b.title); });
}
// Open work owned by a person: open or waiting items, plus active controls/policies whose test or review falls due within 30 days.
function isWork(e) {
  var c = R.category(e);
  if (c === 'open' || c === 'review') return true;
  return c === 'active' && !!e.due && D.diff(e.due, TODAY) <= 30;
}
function workload() {
  var types = CFG.briefing.workload_types, rows = {};
  R.list(types, isWork).forEach(function (e) {
    var k = e.owner || '';
    var r = rows[k] || (rows[k] = { id: k, open: 0, overdue: 0, review: 0, items: [] });
    r.open++; r.items.push(e);
    if (e.due && D.diff(e.due, TODAY) < 0) r.overdue++;
    if (R.category(e) === 'review') r.review++;
  });
  R.people().forEach(function (p) {
    var role = p.data && p.data.role;
    if (role && role !== 'board' && !rows[p.id]) rows[p.id] = { id: p.id, open: 0, overdue: 0, review: 0, items: [] };
  });
  return Object.keys(rows).map(function (k) { return rows[k]; })
    .sort(function (a, b) { return (a.id === '') - (b.id === '') || b.open - a.open || b.overdue - a.overdue || nameOf(a.id).localeCompare(nameOf(b.id)); });
}
function horizon(months) {
  var end = D.addMonths(TODAY, months);
  var all = R.list(['regulation', 'obligation', 'reg_change'], function (e) { return e.due && D.diff(e.due, TODAY) >= 0 && applies(e); });
  var inWin = all.filter(function (e) { return e.due <= end; });
  var later = all.filter(function (e) { return e.due > end; }).sort(function (a, b) { return a.due < b.due ? -1 : 1; });
  var groups = {};
  inWin.forEach(function (e) { (groups[e.due] = groups[e.due] || { date: e.due, regulation: [], obligation: [], reg_change: [] })[e.type].push(e); });
  return { end: end, groups: Object.keys(groups).sort().map(function (k) { return groups[k]; }), next: later[0] || null, count: inWin.length };
}

/* ───────── render ───────── */
function render() {
  TODAY = R.today();
  $('dateline').textContent = 'Briefing for ' + new Date(D.dn(TODAY) * 864e5).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  renderWho(); renderBanners();
  var due = dueItems(), fl = files(), wl = workload(), hz = horizon(UI.months);
  renderDue(due); renderFiles(fl); renderLoad(wl); renderHorizon(hz);
  $('headline').textContent = headline(due, fl, wl);
  renderFootnote();
}

function headline(due, fl, wl) {
  var od = due.filter(function (x) { return x.days < 0; }).length, wk = due.filter(function (x) { return x.days >= 0 && x.days <= 7; }).length;
  var s = UI.who ? 'For ' + nameOf(UI.who) + ': ' : '';
  if (!od && !wk) s += 'nothing is overdue and nothing falls due in the next 7 days.';
  else s += (od ? plural(od, 'item') + (od === 1 ? ' is' : ' are') + ' overdue' : 'Nothing is overdue') + (wk ? (od ? ' and ' : ', and ') + plural(wk, 'item') + (wk === 1 ? ' falls' : ' fall') + ' due in the next 7 days.' : '.');
  s = s.charAt(0).toUpperCase() + s.slice(1);
  s += ' ' + (fl.length ? plural(fl.length, 'file') + (fl.length === 1 ? ' is' : ' are') + ' waiting for approval.' : 'No files are waiting for approval.');
  if (!UI.who) {
    var top = wl.filter(function (r) { return r.id && r.open; })[0];
    if (top) s += ' ' + nameOf(top.id) + ' carries the most open work (' + plural(top.open, 'item') + (top.overdue ? ', ' + top.overdue + ' overdue' : '') + ').';
    var un = wl.filter(function (r) { return !r.id; })[0];
    if (un && un.open) s += ' ' + plural(un.open, 'item') + (un.open === 1 ? ' has' : ' have') + ' no owner.';
  }
  var h = horizon(12), g = h.groups[0];
  if (g) {
    var reg = g.regulation.length ? g.regulation.map(function (r) { return r.data.name; }).sort().join(' and ') : '';
    s += ' Next new rules: ' + (reg ? reg + (g.regulation.length === 1 ? ' applies' : ' apply') : (g.obligation.length ? plural(g.obligation.length, 'obligation') : g.reg_change[0].title)) + ' from ' + D.fmt(g.date) + ' (in ' + D.diff(g.date, TODAY) + ' days).';
  }
  return s;
}

function renderWho() {
  var sel = $('whoSel'), cur = UI.who;
  sel.innerHTML = '<option value="">Whole team</option>' + R.people().map(function (p) {
    var role = R.role(p.data && p.data.role);
    return '<option value="' + esc(p.id) + '"' + (p.id === cur ? ' selected' : '') + '>' + esc(p.title + (role ? ' (' + role.label + ')' : '')) + '</option>';
  }).join('');
  if (cur && !R.get(cur)) UI.who = '';
}

function hasWork() { return R.list(WORK_TYPES).length > 0; }
function renderBanners() {
  var h = '';
  if (!BOOT.storageOk || !R.saveOk()) h += '<div class="banner warn" role="alert"><p>This browser is not saving: storage is blocked or full. What you do here lasts until you close the page.</p></div>';
  if (R.hasDemo()) {
    h += '<div class="banner demo"><p><b>Demo data.</b> ' + esc(R.getSetting('firm_name') || 'CF Bank (fictional)') + ', its team, tasks and files are fictional, to show the briefing working. Regulatory dates are real repository data.</p>' +
      '<button class="btn" type="button" data-act="demo-off">Remove demo data</button></div>';
  } else if (!hasWork()) {
    h += '<div class="empty-hero"><h2>No team work on this device yet</h2>' +
      '<p>The briefing fills itself from your modules (Issues and actions, Policies, Cases, Business risk, Customer risk, Change impact) as you use them, and from the work board. To judge it in five minutes, load a demo: a fictional team of four at the fictional CF Bank, with tasks, findings, a case and files waiting for approval.</p>' +
      '<div class="row-actions"><button class="btn pri" type="button" data-act="demo-on">Load demo data</button><a class="btn" href="board.html">Open the work board</a><a class="btn" href="actions.html">Open Issues and actions</a></div></div>';
  }
  $('banners').innerHTML = h;
}

function renderDue(due) {
  var od = due.filter(function (x) { return x.days < 0; }), wk = due.filter(function (x) { return x.days >= 0 && x.days <= 7; }), mo = due.filter(function (x) { return x.days > 7; });
  function breakdown(list) {
    var c = {};
    list.forEach(function (x) { c[x.kind.id] = (c[x.kind.id] || 0) + 1; });
    var parts = CFG.briefing.due_kinds.filter(function (k) { return c[k.id]; }).map(function (k) { return c[k.id] + ' ' + (c[k.id] === 1 ? (k.one || k.label) : k.label).toLowerCase(); });
    return parts.length ? parts.join(' · ') : 'none';
  }
  function tile(n, l, list, bad) { return '<div class="tile' + (bad && n ? ' bad' : '') + '"><div class="n mono">' + n + '</div><div class="l">' + l + '</div><div class="s">' + esc(breakdown(list)) + '</div></div>'; }
  $('due-scope').textContent = UI.who ? 'For ' + nameOf(UI.who) + ' (regulatory dates for everyone)' : 'Whole team';
  var h = '<div class="tiles">' + tile(od.length, 'Overdue', od, true) + tile(wk.length, 'Next 7 days', wk) + tile(mo.length, 'Days 8 to 30', mo) + '</div>';
  var reg = due.filter(function (x) { return x.kind.id === 'regulatory'; });
  if (!due.length) h += '<p class="empty">Nothing is due in the next 30 days.</p>';
  else {
    var shown = UI.allDue ? due : due.slice(0, 8);
    h += '<ul class="rows" aria-label="Due and overdue items">' + shown.map(function (x) {
      var e = x.e;
      return '<li><div><div class="t">' + titleLink(e) + '</div><div class="m"><span>' + esc(x.kind.one || x.kind.label) + '</span><span aria-hidden="true">·</span><span>' + esc(e.owner ? nameOf(e.owner) : (x.kind.id === 'regulatory' ? 'Everyone' : 'Unassigned')) + '</span>' + demoChip(e) +
        (e.data && e.data.date_source ? '<span class="sr">Date source: ' + esc(e.data.date_source) + '</span>' : '') + '</div></div>' +
        '<div class="r">' + dueChip(x.days) + '<span class="hint mono">' + esc(D.fmt(e.due)) + '</span></div></li>';
    }).join('') + '</ul>';
    if (due.length > 8) h += '<button class="linkbtn more" type="button" data-act="all-due" aria-expanded="' + UI.allDue + '">' + (UI.allDue ? 'Show fewer' : 'Show all ' + due.length) + '</button>';
  }
  if (!reg.length) {
    var nx = horizon(1200).groups[0];
    h += '<p class="src">No regulatory deadline in the next 30 days in the repository data' + (nx ? '; the next is ' + esc(D.fmt(nx.date)) + ' (see New obligations).' : '.') + ' RegWatch items count only when the feed states a deadline.</p>';
  }
  $('due').innerHTML = h;
}

function renderFiles(fl) {
  $('files-count').textContent = fl.length ? '(' + fl.length + ')' : '';
  if (!fl.length) { $('files').innerHTML = '<p class="empty">Nothing is waiting for approval' + (UI.who ? ' from ' + esc(nameOf(UI.who)) : '') + '.</p>'; return; }
  var shown = UI.allFiles ? fl : fl.slice(0, 8);
  var h = '<ul class="rows" aria-label="Files waiting for approval">' + shown.map(function (e) {
    var ds = R.dueState(e);
    var pend = e.data && e.data.pending_version ? ' (version ' + e.data.pending_version + ')' : '';
    return '<li><div><div class="t">' + titleLink(e) + '</div><div class="m"><span>' + esc(typeLabel(e)) + '</span><span aria-hidden="true">·</span><span>' + esc(statusLabel(e) + pend) + '</span><span aria-hidden="true">·</span><span>' + esc(e.owner ? nameOf(e.owner) : 'No owner') + '</span>' + demoChip(e) + '</div></div>' +
      '<div class="r">' + (ds ? dueChip(ds.days) : '<span class="hint">No date</span>') + '</div></li>';
  }).join('') + '</ul>';
  if (fl.length > 8) h += '<button class="linkbtn more" type="button" data-act="all-files" aria-expanded="' + UI.allFiles + '">' + (UI.allFiles ? 'Show fewer' : 'Show all ' + fl.length) + '</button>';
  $('files').innerHTML = h;
}

function renderLoad(wl) {
  var max = Math.max.apply(null, wl.map(function (r) { return r.open; }).concat([1]));
  if (!wl.length) { $('load').innerHTML = '<p class="empty">No team members yet. They appear when the modules name owners, or when you load the demo.</p>'; return; }
  $('load').innerHTML = '<p class="hint" style="margin:-4px 0 12px">Open items per person: tasks, findings, cases, files waiting, and control tests or reviews due within 30 days. Red is overdue.</p>' +
    '<ul class="load">' + wl.map(function (r) {
      var p = r.id ? R.get(r.id) : null, role = p && p.data ? R.role(p.data.role) : null;
      var wOd = Math.round(100 * r.overdue / max), wRest = Math.round(100 * (r.open - r.overdue) / max);
      var desc = plural(r.open, 'open item') + (r.overdue ? ', ' + r.overdue + ' overdue' : '') + (r.review ? ', ' + r.review + ' waiting for approval' : '');
      return '<li><div class="who"><b>' + esc(r.id ? nameOf(r.id) : 'Unassigned') + '</b><span>' + esc(role ? role.label : (r.id ? 'Role not set' : 'No owner yet')) + (p && isDemo(p) ? ' · demo' : '') + '</span></div>' +
        '<div><div class="bar" role="img" aria-label="' + esc(desc) + '">' + (r.overdue ? '<i class="od" style="width:' + wOd + '%"></i>' : '') + '<i style="width:' + wRest + '%"></i></div>' +
        '<div class="nums">' + esc(desc) + (r.id ? ' · <a href="board.html?assignee=' + encodeURIComponent(r.id) + '">See on the board</a>' : '') + '</div></div></li>';
    }).join('') + '</ul>';
}

function renderHorizon(hz) {
  var seg = $('hzSeg');
  if (!seg.querySelector('input')) {
    seg.innerHTML += CFG.briefing.horizon_months.map(function (m) {
      return '<label><input type="radio" name="hz" value="' + m + '"' + (m === UI.months ? ' checked' : '') + '><span>' + m + ' months</span></label>';
    }).join('');
  }
  var fs = $('firmSel'), ft = firmType();
  fs.innerHTML = '<option value="">All firm types</option>' + ((BOOT.applicability && BOOT.applicability.entities) || []).map(function (e) {
    return '<option value="' + esc(e.id) + '"' + (e.id === ft ? ' selected' : '') + '>' + esc(e.label) + '</option>';
  }).join('');
  var sv = (BOOT.applicability && BOOT.applicability._meta && BOOT.applicability._meta.status_values) || {};
  var h = '';
  if (!hz.groups.length) {
    h += '<p class="empty">Nothing new applies' + (ft ? ' to your firm type (' + esc(firmLabel(ft)) + ')' : '') + ' in the next ' + UI.months + ' months, according to the repository data.' +
      (hz.next ? ' The next date is <b>' + esc(D.fmt(hz.next.due)) + '</b>: ' + esc(hz.next.type === 'regulation' ? hz.next.data.name + ' applies' : hz.next.title) + ' (in ' + D.diff(hz.next.due, TODAY) + ' days).' : '') + '</p>';
  } else {
    h += '<ul class="hz">' + hz.groups.map(function (g) {
      var parts = '';
      g.regulation.forEach(function (r) {
        var v = ft ? (r.data.applies || {})[ft] : '';
        parts += '<p><b>' + esc(r.title) + '</b> applies from this date' + (v ? '. ' + esc(firmLabel(ft)) + ': ' + esc((sv[v] || v).replace(/ this entity type/, ' this firm type')) : '') + '</p>' +
          (v && r.data.notes && r.data.notes[ft] ? '<p class="hint">' + esc(r.data.notes[ft]) + '</p>' : '') +
          '<p class="src">Date source: ' + esc(r.data.date_source) + '</p>';
      });
      if (g.obligation.length) {
        parts += '<p>' + plural(g.obligation.length, 'obligation') + ' in the register start to apply:</p><div class="chips">' + g.obligation.map(function (o) {
          return '<a class="chip" href="' + esc(hrefFor(o)) + '" title="' + esc(o.title) + '">' + esc(o.data.legal_basis) + (o.data.topic ? ' · ' + esc(o.data.topic) : '') + '</a>';
        }).join('') + '</div><p class="src">Date source: docs/data/obligations.json ("deadline" of each obligation)</p>';
      }
      g.reg_change.forEach(function (c) { parts += '<p>' + titleLink(c) + '</p><p class="src">Date source: ' + esc(c.data.date_source || 'RegWatch') + '</p>'; });
      return '<li><div class="d">' + esc(D.fmt(g.date)) + '<small>in ' + D.diff(g.date, TODAY) + ' days</small></div>' + parts + '</li>';
    }).join('') + '</ul>';
  }
  $('hz').innerHTML = h;
}

function renderFootnote() {
  var found = BOOT.report.modules.filter(function (m) { return m.records; });
  var errs = BOOT.report.modules.filter(function (m) { return m.error; });
  $('footnote').innerHTML = 'Prototype, not legal advice. Everything stays in this browser. ' +
    (found.length ? 'Read from your pages on this device (nothing there was changed): ' + found.map(function (m) { return esc(m.label) + ' (' + m.records + ')'; }).join(', ') + '. ' : '') +
    (errs.length ? '<b>Could not read:</b> ' + errs.map(function (m) { return esc(m.label) + ' (' + esc(m.error) + ')'; }).join(', ') + '. ' : '') +
    'Regulatory dates come from the repository data and show their source. ' +
    '<button class="linkbtn" type="button" data-act="csv-log">Download the event log (CSV)</button>';
}

/* ───────── CSV ───────── */
function csvAll() {
  var rows = [['section', 'kind', 'id', 'title', 'owner', 'status', 'due', 'days_from_today', 'date_source', 'demo_data']];
  dueItems().forEach(function (x) { var e = x.e; rows.push(['due', x.kind.label, e.id, e.title, e.owner ? nameOf(e.owner) : '', statusLabel(e), e.due, x.days, (e.data && e.data.date_source) || '', isDemo(e) ? 'yes' : '']); });
  files().forEach(function (e) { rows.push(['files_to_review', typeLabel(e), e.id, e.title, e.owner ? nameOf(e.owner) : '', statusLabel(e), e.due || '', e.due ? D.diff(e.due, TODAY) : '', '', isDemo(e) ? 'yes' : '']); });
  workload().forEach(function (r) {
    var p = r.id ? R.get(r.id) : null, role = p && p.data ? R.role(p.data.role) : null;
    rows.push(['workload', role ? role.label : '', r.id, r.id ? nameOf(r.id) : 'Unassigned', '', 'open ' + r.open + '; overdue ' + r.overdue + '; waiting ' + r.review, '', '', '', p && isDemo(p) ? 'yes' : '']);
  });
  horizon(UI.months).groups.forEach(function (g) {
    ['regulation', 'obligation', 'reg_change'].forEach(function (t) {
      g[t].forEach(function (e) { rows.push(['new_obligations_' + UI.months + 'm', typeLabel(e), e.id, e.title, '', statusLabel(e), e.due, D.diff(e.due, TODAY), (e.data && e.data.date_source) || '', '']); });
    });
  });
  download('regradar-briefing-' + TODAY + '.csv', RR.util.csv(rows));
  toast('Briefing downloaded (CSV)');
}
function csvLog() {
  var rows = [['seq', 'at', 'actor', 'action', 'entity_id', 'entity_type', 'title', 'changes', 'note', 'hash']];
  R.events().forEach(function (ev) {
    var ch = ev.changes ? Object.keys(ev.changes).map(function (k) { return k + ': ' + ev.changes[k][0] + ' -> ' + ev.changes[k][1]; }).join('; ') : '';
    rows.push([ev.seq, ev.at, nameOf(ev.actor), ev.action, ev.entity || '', ev.entity_type || '', ev.title, ch, ev.note, ev.hash]);
  });
  var v = R.verifyLog();
  download('regradar-event-log-' + TODAY + '.csv', RR.util.csv(rows));
  toast(v.ok ? 'Event log downloaded (' + v.count + ' entries, chain intact)' : 'Event log downloaded. Warning: the chain breaks at entry ' + v.broken_at);
}

/* ───────── events ───────── */
document.addEventListener('click', function (e) {
  var b = e.target.closest('[data-act]'); if (!b) return;
  var a = b.getAttribute('data-act');
  if (a === 'csv') return csvAll();
  if (a === 'csv-log') return csvLog();
  if (a === 'all-due') { UI.allDue = !UI.allDue; render(); var x = document.querySelector('[data-act="all-due"]'); if (x) x.focus(); return; }
  if (a === 'all-files') { UI.allFiles = !UI.allFiles; render(); var y = document.querySelector('[data-act="all-files"]'); if (y) y.focus(); return; }
  if (a === 'demo-on') {
    b.disabled = true;
    fetch('data/spine/demo.json', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (demo) {
      var res = R.loadDemo(demo);
      render();
      toast('Demo data loaded (' + res.records + ' fictional records)' + (res.skipped.length ? '. Kept your own ' + res.skipped.join(', ').toLowerCase() : ''));
      var hd = $('headline'); hd.setAttribute('tabindex', '-1'); hd.focus();
    }).catch(function () { b.disabled = false; toast('Could not load the demo data. Reload and try again.'); });
    return;
  }
  if (a === 'demo-off') {
    var n = R.clearDemo(); render();
    toast(plural(n, 'demo record') + ' removed. They stay in the event log as archived.');
    var hb = $('headline'); hb.setAttribute('tabindex', '-1'); hb.focus();
  }
});
document.addEventListener('change', function (e) {
  var t = e.target;
  if (t.id === 'whoSel') { UI.who = t.value; render(); return; }
  if (t.id === 'firmSel') { R.setSetting('firm_type', t.value); render(); toast(t.value ? 'Showing what applies to: ' + firmLabel(t.value) : 'Showing all firm types'); return; }
  if (t.name === 'hz') { UI.months = +t.value; render(); }
});
window.toggleTheme = function () { var h = document.documentElement, t = h.dataset.theme === 'dark' ? 'light' : 'dark'; h.dataset.theme = t; try { localStorage.setItem('regradar-theme', t); } catch (x) { /* ignore */ } };

var reopenT = null;
function boot() {
  return RR.boot({ items: true, onExternalChange: function () { clearTimeout(reopenT); reopenT = setTimeout(boot, 400); } }).then(function (b) {
    BOOT = b; R = b.spine; CFG = R.config();
    if (!boot.done) { UI.months = CFG.briefing.horizon_default || 12; boot.done = true; }
    R.onError(function () { renderBanners(); });
    render();
  }).catch(function (err) {
    $('headline').textContent = 'Could not open the briefing: ' + err.message + ' Reload the page to try again.';
  });
}
boot();
})();
