/* ═══════════════════════════════════════════════════════════════
   RegRadar: work board (board.html)

   A Kanban over the data spine's tasks and findings (config.json
   "board": types and workflow). Columns are the workflow states.
   Cards move by dragging (mouse or pen) or by real buttons on each card (with
   an aria-live announcement), can be assigned, dated and linked to
   obligations, controls and findings, and the MLRO dispatches new work
   from a dialog that shows each person's load. Every change is an
   event in the spine's append-only log.

   Findings and remediation actions of the Issues and actions page live in
   the spine (docs/actions-store.js), so they are ordinary cards here and
   edits show on that page. Cards mirrored from modules that have not
   moved onto the spine yet stay read-only.
   ═══════════════════════════════════════════════════════════════ */
(function () {
'use strict';

var $ = function (id) { return document.getElementById(id); };
var R = null, BOOT = null, CFG = null, D = RR.dates, TODAY = '';
var UI = { assignee: '', dragId: null, opener: null, allDone: false, cardId: null };
var params = new URLSearchParams(location.search);
UI.assignee = params.get('assignee') || '';

/* ───────── helpers ───────── */
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }
function toast(m) { var t = $('toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove('on'); }, 2600); }
function announce(m) { var l = $('live'); l.textContent = ''; setTimeout(function () { l.textContent = m; }, 30); }
function download(name, text) {
  var a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\ufeff' + text], { type: 'text/csv;charset=utf-8' }));
  a.download = name; document.body.appendChild(a); a.click();
  setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
function nameOf(id) {
  if (!id) return 'Unassigned';
  var p = R.get(id); if (p) return p.title;
  return id === 'person:me' ? 'You (this device)' : id === 'system:bridge' ? 'Module import' : id;
}
function initials(id) { return nameOf(id).replace(/\(.*?\)/g, '').split(/[\s.]+/).filter(Boolean).slice(0, 2).map(function (w) { return w[0].toUpperCase(); }).join(''); }
function states() { return CFG.workflows[CFG.board.workflow].states; }
function stateLabel(id) { var s = states().filter(function (x) { return x.id === id; })[0]; return s ? s.label : id; }
function stateIdx(id) { for (var i = 0; i < states().length; i++) if (states()[i].id === id) return i; return -1; }
function scaleLabel(id) { var s = R.scale('priority').filter(function (x) { return x.id === id; })[0]; return s ? s.label : ''; }
function scaleRank(id) { var s = R.scale('priority').filter(function (x) { return x.id === id; })[0]; return s ? s.rank : 9; }
function kindLabel(id) { var k = R.taskKinds().filter(function (x) { return x.id === id; })[0]; return k ? k.label : ''; }
function isDemo(e) { return e.origin === 'demo' || (e.data && e.data.demo === true); }
function modulePage(e) { var m = RR.MODULES.concat(RR.bridge.migrated).filter(function (x) { return x.id === (e.src && e.src.module); })[0]; return m; }
function dueText(days) { return days < 0 ? plural(-days, 'day') + ' overdue' : days === 0 ? 'Due today' : days === 1 ? 'Due tomorrow' : 'Due ' + D.fmt(D.addDays(TODAY, days)); }
function refLabel(e) {
  if (!e) return '';
  if (e.type === 'obligation') return e.data.legal_basis || e.title;
  if (e.type === 'control') return 'Control ' + (e.data.ref || '') + ': ' + e.title;
  return e.title;
}
function isOpenCard(e) { var c = R.category(e); return c === 'open' || c === 'review'; }
function loadOf(pid) {
  var l = R.list(CFG.board.types, function (e) { return e.owner === pid && isOpenCard(e); });
  return { open: l.length, overdue: l.filter(function (e) { return e.due && e.due < TODAY; }).length };
}

/* ───────── board ───────── */
function cards() {
  return R.list(CFG.board.types, function (e) {
    if (UI.assignee === '__none') return !e.owner;
    return !UI.assignee || e.owner === UI.assignee;
  });
}
function sortCards(list, done) {
  return list.sort(function (a, b) {
    if (done) return (b.updated_at || '') < (a.updated_at || '') ? -1 : 1;
    var ad = a.due || '9999-12-31', bd = b.due || '9999-12-31';
    return ad < bd ? -1 : ad > bd ? 1 : scaleRank(a.data.priority) - scaleRank(b.data.priority) || a.title.localeCompare(b.title);
  });
}
function cardHtml(e) {
  var w = R.isWritable(e), i = stateIdx(e.status), st = states();
  var ds = R.dueState(e), od = ds && ds.days < 0 && isOpenCard(e);
  var links = R.linked(e.id, null, 'out').filter(function (x) { return x.type === 'obligation' || x.type === 'control' || x.type === 'issue'; });
  var h = '<li class="card' + (w ? '' : ' locked') + (od ? ' od' : '') + '" data-id="' + esc(e.id) + '"' + (w ? ' data-drag="1"' : '') + '>' +
    '<div class="c-top"><span>' + esc(R.typeDef(e.type).label + (e.data.kind ? ' · ' + kindLabel(e.data.kind) : '')) + '</span>' +
    (e.data.priority ? '<span class="chip ' + (scaleRank(e.data.priority) <= 1 ? 'crit' : scaleRank(e.data.priority) === 2 ? 'imp' : '') + '">' + esc(scaleLabel(e.data.priority)) + '</span>' : '') +
    (isDemo(e) ? '<span class="chip demo">Demo</span>' : '') + '</div>' +
    '<button class="c-title" type="button" data-act="open" data-id="' + esc(e.id) + '">' + esc(e.title) + '</button>' +
    '<div class="c-meta">' + (e.owner ? '<span class="avatar" aria-hidden="true">' + esc(initials(e.owner)) + '</span><span>' + esc(nameOf(e.owner)) + '</span>' : '<span>Unassigned</span>') +
    (ds && isOpenCard(e) ? '<span aria-hidden="true">·</span><span class="chip ' + (ds.days < 0 ? 'crit' : ds.days <= 7 ? 'imp' : '') + '">' + esc(dueText(ds.days)) + '</span>' : '') + '</div>';
  if (links.length) h += '<div class="c-links">' + links.slice(0, 3).map(function (x) { return '<span class="chip">' + esc(x.type === 'control' ? 'Control ' + x.data.ref : x.type === 'issue' ? 'Finding' : refLabel(x)) + '</span>'; }).join('') + (links.length > 3 ? '<span class="chip">+' + (links.length - 3) + '</span>' : '') + '</div>';
  if (w) {
    h += '<div class="c-move">' +
      (i > 0 ? '<button type="button" data-act="mv" data-id="' + esc(e.id) + '" data-to="' + esc(st[i - 1].id) + '" data-dir="back" aria-label="Move “' + esc(e.title) + '” back to ' + esc(st[i - 1].label) + '"><span aria-hidden="true">←</span> ' + esc(st[i - 1].label) + '</button>' : '') +
      (i < st.length - 1 ? '<button type="button" data-act="mv" data-id="' + esc(e.id) + '" data-to="' + esc(st[i + 1].id) + '" data-dir="fwd" aria-label="Move “' + esc(e.title) + '” to ' + esc(st[i + 1].label) + '">' + esc(st[i + 1].label) + ' <span aria-hidden="true">→</span></button>' : '') + '</div>';
  } else {
    var m = modulePage(e);
    h += '<p class="c-lock">From <a href="' + esc(m ? m.page : '#') + '">' + esc(m ? m.label : 'a module') + '</a>. Change it there.</p>';
  }
  return h + '</li>';
}
function renderBoard() {
  var all = cards();
  $('board').innerHTML = states().map(function (s) {
    var list = sortCards(all.filter(function (e) { return e.status === s.id; }), s.category === 'done');
    var total = list.length, shown = list;
    if (s.category === 'done' && !UI.allDone && list.length > 6) shown = list.slice(0, 6);
    var wip = s.wip_limit ? ' of ' + s.wip_limit : '';
    return '<section class="col" data-status="' + esc(s.id) + '" aria-labelledby="col-' + esc(s.id) + '">' +
      '<div class="col-h"><h2 id="col-' + esc(s.id) + '">' + esc(s.label) + '</h2><span class="n' + (s.wip_limit && total > s.wip_limit ? ' over-wip' : '') + '"' + (s.wip_limit ? ' title="Work-in-progress limit (default, configure for your firm)"' : '') + '>' + total + wip + (s.wip_limit && total > s.wip_limit ? ' · over limit' : '') + '</span></div>' +
      '<ol class="cards" aria-label="' + esc(s.label) + ': ' + plural(total, 'card') + '">' + (shown.length ? shown.map(cardHtml).join('') : '<li class="col-empty">No cards</li>') + '</ol>' +
      (shown.length < total || (UI.allDone && s.category === 'done' && total > 6) ? '<button class="linkbtn" type="button" data-act="all-done" aria-expanded="' + UI.allDone + '">' + (UI.allDone ? 'Show fewer' : 'Show all ' + total) + '</button>' : '') +
      '</section>';
  }).join('');
}
function renderSelects() {
  var people = R.people().filter(function (p) { return !(p.data && p.data.role === 'board') && (p.status === 'active' || loadOf(p.id).open || p.id === UI.assignee); });   // inactive people only while they still hold cards
  var un = R.list(CFG.board.types, function (e) { return !e.owner && isOpenCard(e); }).length;
  $('asgSel').innerHTML = '<option value="">Everyone</option><option value="__none"' + (UI.assignee === '__none' ? ' selected' : '') + '>Unassigned (' + un + ' open)</option>' +
    people.map(function (p) { var l = loadOf(p.id); return '<option value="' + esc(p.id) + '"' + (p.id === UI.assignee ? ' selected' : '') + '>' + esc(p.title + ' (' + l.open + ' open)') + '</option>'; }).join('');
  var actor = R.actor();
  $('actorSel').innerHTML = '<option value="person:me"' + (actor === 'person:me' ? ' selected' : '') + '>You (this device)</option>' +
    R.people().filter(function (p) { return p.id !== 'person:me'; }).map(function (p) { var r = R.role(p.data && p.data.role); return '<option value="' + esc(p.id) + '"' + (p.id === actor ? ' selected' : '') + '>' + esc(p.title + (r ? ' (' + r.label + ')' : '')) + '</option>'; }).join('');
}
function renderBanners() {
  var h = '';
  if (!BOOT.storageOk || !R.saveOk()) h += '<div class="banner warn" role="alert"><p>This browser is not saving: storage is blocked or full. Changes last until you close the page.</p></div>';
  if (R.hasDemo()) h += '<div class="banner demo"><p><b>Demo data.</b> ' + esc(R.getSetting('firm_name') || 'CF Bank (fictional)') + ', its team and these tasks are fictional.</p><a class="btn" href="home.html">Remove it on the briefing</a></div>';
  else if (!R.list(CFG.board.types).length) h += '<div class="empty-hero"><h2>The board is empty</h2><p>Dispatch the first task, or load the fictional demo team to try it in five minutes.</p><div class="row-actions"><button class="btn pri" type="button" data-act="dispatch">Dispatch work</button><button class="btn" type="button" data-act="demo-on">Load demo data</button></div></div>';
  $('banners').innerHTML = h;
}
function eventText(ev) {
  var who = nameOf(ev.actor), t = ev.title ? '“' + ev.title + '”' : '';
  var ch = ev.changes || {};
  switch (ev.action) {
    case 'move': return who + ' moved ' + t + ' from ' + stateLabelAny(ev, ch.status[0]) + ' to ' + stateLabelAny(ev, ch.status[1]);
    case 'assign': return who + ' assigned ' + t + ' to ' + nameOf(ch.owner && ch.owner[1]);
    case 'dispatch': return who + ' dispatched ' + t;
    case 'create': return who + ' created ' + t + (ev.note ? ' (' + ev.note + ')' : '');
    case 'update': return who + ' changed ' + t + ': ' + Object.keys(ch).map(function (k) { return k.replace(/^data\./, ''); }).join(', ');
    case 'link': case 'unlink': return who + (ev.action === 'link' ? ' linked ' : ' unlinked ') + (ev.note || t);
    case 'archive': return who + ' archived ' + t + (ev.note ? ' (' + ev.note + ')' : '');
    case 'import': return ev.entity ? 'Module import: ' + t + (ev.note ? ' (' + ev.note + ')' : '') : 'Module import: ' + ev.note;
    case 'sync': return 'Module import updated ' + t + (ev.note ? ' (' + ev.note + ')' : '');
    case 'demo': return who + ': ' + ev.title + (ev.note ? ' (' + ev.note + ')' : '');
    case 'settings': return who + ' changed the setting “' + ev.title + '”';
    case 'comment': return who + ' noted on ' + t + ': ' + ev.note;
    default: return who + ' ' + ev.action + ' ' + t;
  }
}
function stateLabelAny(ev, id) { try { var s = R.stateDef(ev.entity_type, id); return s ? s.label : id; } catch (e) { return id; } }
function fmtAt(iso) { var d = new Date(iso); return isNaN(d) ? iso : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); }
function renderActivity() {
  var ev = R.events().filter(function (e) { return e.action !== 'import' || !e.entity; }).slice(-12).reverse();
  var v = R.verifyLog();
  $('activity').innerHTML = (ev.length ? '<ol class="act">' + ev.map(function (e) { return '<li><span class="d">' + esc(fmtAt(e.at)) + '</span><span>' + esc(eventText(e)) + '</span></li>'; }).join('') + '</ol>' : '<p class="empty">No activity yet.</p>') +
    '<p class="hint" style="margin-top:8px">' + plural(R.events().length, 'entry', 'entries') + ' in the event log. ' + (v.ok ? 'Chain check: intact (each entry carries the fingerprint of the one before; an integrity check, not a security control).' : 'Chain check: <b>broken at entry ' + v.broken_at + '</b>. The stored log was changed outside RegRadar.') + '</p>';
}
function render() {
  TODAY = R.today();
  renderSelects(); renderBanners(); renderBoard(); renderActivity();
}

/* ───────── moves ───────── */
function move(id, to, how) {
  var e = R.get(id); if (!e || e.status === to) return;
  try { R.move(id, to); }
  catch (err) { toast(err.message); announce(err.message); return; }
  var n = cards().filter(function (x) { return x.status === to; }).length;
  render();
  announce('Moved “' + e.title + '” from ' + stateLabel(e.status) + ' to ' + stateLabel(to) + '. ' + stateLabel(to) + ' now has ' + plural(n, 'card') + '.');
  if (how && how.focus) {
    var card = document.querySelector('.card[data-id="' + cssEsc(id) + '"]');
    var f = card && (card.querySelector('[data-dir="' + how.focus + '"]') || card.querySelector('[data-act="mv"]') || card.querySelector('.c-title'));
    if (f) f.focus();
  }
}
function cssEsc(s) { return window.CSS && CSS.escape ? CSS.escape(s) : String(s).replace(/["\\]/g, '\\$&'); }

/* ───────── dialogs ───────── */
function openDialog(d, opener) {
  UI.opener = opener || document.activeElement;
  d.showModal();
  var f = d.querySelector('[autofocus]') || d.querySelector('input,select,textarea') || d.querySelector('button');
  if (f) f.focus();
}
function closeDialog(d) { if (d.open) d.close(); }
['dlg-card', 'dlg-dispatch'].forEach(function (id) {
  $(id).addEventListener('close', function () {
    var o = UI.opener; UI.opener = null; UI.cardId = null;
    if (o && document.contains(o)) o.focus();
    else if (o && o.dataset && o.dataset.id) { var c = document.querySelector('.card[data-id="' + cssEsc(o.dataset.id) + '"] .c-title'); if (c) c.focus(); }
  });
});
function personOptions(sel, withLoad) {
  return '<option value="">Unassigned</option>' + R.people().filter(function (p) { return !(p.data && p.data.role === 'board') && (p.status === 'active' || p.id === sel); }).map(function (p) {
    var r = R.role(p.data && p.data.role), l = loadOf(p.id);
    var t = p.title + (r ? ', ' + r.label : '') + (withLoad ? ' (' + l.open + ' open' + (l.overdue ? ', ' + l.overdue + ' overdue' : '') + ')' : '');
    return '<option value="' + esc(p.id) + '"' + (p.id === sel ? ' selected' : '') + '>' + esc(t) + '</option>';
  }).join('');
}
function optList(list, sel, empty) { return '<option value="">' + esc(empty) + '</option>' + list.map(function (x) { return '<option value="' + esc(x.id) + '"' + (x.id === sel ? ' selected' : '') + '>' + esc(x.label) + '</option>'; }).join(''); }
function kindOpts(sel) { return R.taskKinds().map(function (k) { return { id: k.id, label: k.label }; }); }
function prioOpts() { return R.scale('priority').map(function (k) { return { id: k.id, label: k.label }; }); }
function obligationOpts() {
  return R.list('obligation', function (o) { return o.status !== 'not_applicable'; }).map(function (o) { return { id: o.id, label: o.data.legal_basis + ' · ' + (o.data.topic || '') }; });
}
function controlOpts() { return R.list('control').map(function (c) { return { id: c.id, label: (c.data.ref ? c.data.ref + ': ' : '') + c.title }; }); }
function issueOpts() { return R.list('issue', function (i) { return isOpenCard(i); }).map(function (i) { return { id: i.id, label: i.title }; }); }

function field(id, label, html, cls, help) { return '<div class="field' + (cls ? ' ' + cls : '') + '"><label for="' + id + '">' + esc(label) + '</label>' + html + (help ? '<div class="help">' + esc(help) + '</div>' : '') + '</div>'; }

function openDispatch(opener) {
  var d = $('dlg-dispatch');
  var to = params.get('to') || (UI.assignee && UI.assignee !== '__none' ? UI.assignee : '');
  d.innerHTML = '<form method="dialog" id="f-dispatch" novalidate>' +
    '<div class="dlg-h"><div><h2 id="dlg-dispatch-h">Dispatch work</h2><p class="hint">Create a task, give it an owner and a date, and link it to what it serves. Dispatching as ' + esc(nameOf(R.actor())) + '.</p></div><button class="btn ghost" type="button" data-act="close" aria-label="Close">Close</button></div>' +
    '<div class="dlg-b"><div class="fields">' +
    field('d-title', 'What needs doing', '<input class="in" id="d-title" required autofocus autocomplete="off">', 'full') +
    field('d-owner', 'Assign to', '<select class="sel" id="d-owner">' + personOptions(to, true) + '</select>', 'full', 'Open cards per person on this board are shown in brackets.') +
    field('d-due', 'Due date', '<input class="in" type="date" id="d-due" value="' + esc(D.addDays(TODAY, 14)) + '">') +
    field('d-prio', 'Priority', '<select class="sel" id="d-prio">' + optList(prioOpts(), 'medium', 'Not set') + '</select>') +
    field('d-kind', 'Kind of work', '<select class="sel" id="d-kind">' + optList(kindOpts(), 'other', 'Not set') + '</select>') +
    field('d-ob', 'Obligation it serves', '<select class="sel" id="d-ob">' + optList(obligationOpts(), '', 'None') + '</select>') +
    field('d-ctl', 'Control it concerns', '<select class="sel" id="d-ctl">' + optList(controlOpts(), '', 'None') + '</select>', 'full') +
    field('d-iss', 'Finding it fixes', '<select class="sel" id="d-iss">' + optList(issueOpts(), '', 'None') + '</select>', 'full') +
    field('d-notes', 'Notes', '<textarea class="in" id="d-notes"></textarea>', 'full') +
    '</div><div class="err" id="d-err" role="alert"></div></div>' +
    '<div class="dlg-f"><button class="btn" type="button" data-act="close">Cancel</button><button class="btn pri" type="submit" data-act="do-dispatch">Dispatch</button></div></form>';
  openDialog(d, opener);
}
function doDispatch() {
  var v = function (id) { return ($(id).value || '').trim(); };
  var err = $('d-err'); err.textContent = '';
  if (!v('d-title')) { err.textContent = 'Say what needs doing.'; $('d-title').focus(); return; }
  if (v('d-due') && !D.valid(v('d-due'))) { err.textContent = 'Use a valid due date.'; $('d-due').focus(); return; }
  var t;
  try {
    t = R.create('action', { title: v('d-title'), owner: v('d-owner') || null, due: v('d-due') || null,
      data: { kind: v('d-kind') || undefined, priority: v('d-prio') || undefined, description: v('d-notes') || undefined } }, { action: 'dispatch', note: v('d-owner') ? 'to ' + nameOf(v('d-owner')) : 'unassigned' });
    if (v('d-ob')) R.link('addresses', t.id, v('d-ob'));
    if (v('d-ctl')) R.link('concerns', t.id, v('d-ctl'));
    if (v('d-iss')) R.link('fixes', t.id, v('d-iss'));
  } catch (e) { err.textContent = e.message; return; }
  UI.opener = null;
  closeDialog($('dlg-dispatch'));
  if (UI.assignee && UI.assignee !== t.owner && !(UI.assignee === '__none' && !t.owner)) UI.assignee = '';
  render();
  var msg = 'Dispatched “' + t.title + '” to ' + nameOf(t.owner) + ' in ' + stateLabel(t.status) + '.';
  toast(msg); announce(msg);
  var c = document.querySelector('.card[data-id="' + cssEsc(t.id) + '"] .c-title'); if (c) c.focus();
}

function openCard(id, opener) {
  var e = R.get(id); if (!e) { toast('That card no longer exists.'); return; }
  UI.cardId = id;
  var d = $('dlg-card'), w = R.isWritable(e);
  var outs = R.links(id, null, 'out'), ins = R.links(id, null, 'in');
  function linkRow(l, dir) {
    var other = R.get(dir === 'out' ? l.to : l.from), lt = R.linkType(l.type);
    if (!other) return '';
    var txt = (dir === 'out' ? lt.label : lt.inverse) + ': ' + refLabel(other);
    return '<li><span>' + esc(txt) + '</span>' + (w && dir === 'out' ? '<button class="btn ghost" type="button" data-act="unlink" data-link="' + esc(l.id) + '" aria-label="Remove link: ' + esc(txt) + '">Remove</button>' : '') + '</li>';
  }
  var linksHtml = outs.map(function (l) { return linkRow(l, 'out'); }).join('') + ins.map(function (l) { return linkRow(l, 'in'); }).join('');
  var hist = R.history(id).slice().reverse();
  var h = '<div class="dlg-h"><div><p class="hint">' + esc(R.typeDef(e.type).label + ' · ' + e.id) + (isDemo(e) ? ' · demo data' : '') + '</p><h2 id="dlg-card-h">' + esc(e.title) + '</h2></div><button class="btn ghost" type="button" data-act="close" aria-label="Close">Close</button></div><div class="dlg-b">';
  if (w) {
    h += '<form id="f-card" novalidate><div class="fields">' +
      field('c-title', 'Title', '<input class="in" id="c-title" value="' + esc(e.title) + '" autocomplete="off">', 'full') +
      field('c-status', 'Column', '<select class="sel" id="c-status">' + states().map(function (s) { return '<option value="' + esc(s.id) + '"' + (s.id === e.status ? ' selected' : '') + '>' + esc(s.label) + '</option>'; }).join('') + '</select>') +
      field('c-owner', 'Assigned to', '<select class="sel" id="c-owner">' + personOptions(e.owner, true) + '</select>') +
      field('c-due', 'Due date', '<input class="in" type="date" id="c-due" value="' + esc(e.due || '') + '">') +
      field('c-prio', 'Priority', '<select class="sel" id="c-prio">' + optList(prioOpts(), e.data.priority || '', 'Not set') + '</select>') +
      (e.type === 'action' ? field('c-kind', 'Kind of work', '<select class="sel" id="c-kind">' + optList(kindOpts(), e.data.kind || '', 'Not set') + '</select>', 'full') : '') +
      field('c-notes', 'Notes', '<textarea class="in" id="c-notes">' + esc(e.data.description || '') + '</textarea>', 'full') +
      '</div><div class="err" id="c-err" role="alert"></div></form>';
  } else {
    var m = modulePage(e);
    h += '<p>' + esc(R.readOnlyWhy(e)) + ' <a href="' + esc(m ? m.page : '#') + '">Open ' + esc(m ? m.label : 'the module') + '</a>.</p>' +
      '<dl class="fields" style="margin-top:12px">' + [['Column', stateLabel(e.status)], ['Assigned to', nameOf(e.owner)], ['Due', e.due ? D.fmt(e.due) : 'No date'], ['Priority', scaleLabel(e.data.priority) || 'Not set']]
        .map(function (r) { return '<div class="field"><dt class="flabel">' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd></div>'; }).join('') + '</dl>';
  }
  h += '<div class="blk"><h3>Links</h3>' + (linksHtml ? '<ul class="linklist">' + linksHtml + '</ul>' : '<p class="hint">Not linked to an obligation, control or finding yet.</p>');
  if (w) {
    var opts = '<optgroup label="Obligation it serves">' + obligationOpts().map(function (o) { return '<option value="addresses|' + esc(o.id) + '">' + esc(o.label) + '</option>'; }).join('') + '</optgroup>' +
      '<optgroup label="Control it concerns">' + controlOpts().map(function (o) { return '<option value="concerns|' + esc(o.id) + '">' + esc(o.label) + '</option>'; }).join('') + '</optgroup>' +
      (e.type === 'action' ? '<optgroup label="Finding it fixes">' + issueOpts().map(function (o) { return '<option value="fixes|' + esc(o.id) + '">' + esc(o.label) + '</option>'; }).join('') + '</optgroup>' : '');
    h += '<div class="addlink"><label class="sr" for="c-link">Add a link</label><select class="sel" id="c-link"><option value="">Add a link…</option>' + opts + '</select><button class="btn" type="button" data-act="addlink">Add link</button></div>';
  }
  h += '</div><div class="blk"><h3>History <span class="hint">(from the event log)</span></h3>' +
    (hist.length ? '<ol class="hist">' + hist.map(function (ev) { return '<li><span class="d">' + esc(fmtAt(ev.at)) + '</span><span>' + esc(eventText(ev)) + '</span></li>'; }).join('') + '</ol>' : '<p class="hint">No history yet.</p>') + '</div></div>';
  h += '<div class="dlg-f">' + (w ? '<button class="btn danger" type="button" data-act="archive">Archive</button><button class="btn" type="button" data-act="close">Cancel</button><button class="btn pri" type="button" data-act="save">Save</button>' : '<button class="btn" type="button" data-act="close">Close</button>') + '</div>';
  d.innerHTML = h;
  if (!d.open) openDialog(d, opener);
}
function saveCard() {
  var id = UI.cardId, e = R.get(id), v = function (x) { var el = $(x); return el ? (el.value || '').trim() : undefined; };
  var err = $('c-err'); err.textContent = '';
  var patch = { title: v('c-title'), status: v('c-status'), owner: v('c-owner') || null, due: v('c-due') || null };
  var want = { priority: v('c-prio'), description: v('c-notes') }, data = {};
  if (e.type === 'action') want.kind = v('c-kind');
  Object.keys(want).forEach(function (k) { if ((want[k] || '') !== (e.data[k] || '')) data[k] = want[k] || ''; });
  if (Object.keys(data).length) patch.data = data;
  try { R.update(id, patch); } catch (x) { err.textContent = x.message; return; }
  closeDialog($('dlg-card'));
  render();
  toast('Saved'); announce('Saved “' + R.get(id).title + '”.');
}

/* ───────── CSV ───────── */
function csvBoard() {
  var rows = [['id', 'type', 'title', 'column', 'assigned_to', 'due', 'priority', 'kind', 'obligations', 'controls', 'findings', 'source', 'demo_data']];
  sortCards(cards(), false).forEach(function (e) {
    var ln = function (t) { return R.linked(e.id, null, 'out').filter(function (x) { return x.type === t; }).map(function (x) { return x.type === 'obligation' ? x.data.legal_basis : x.data.ref || x.id; }).join('; '); };
    var m = modulePage(e);
    rows.push([e.id, R.typeDef(e.type).label, e.title, stateLabel(e.status), e.owner ? nameOf(e.owner) : '', e.due || '', scaleLabel(e.data.priority), kindLabel(e.data.kind), ln('obligation'), ln('control'), ln('issue'), m ? m.label : 'Work board', isDemo(e) ? 'yes' : '']);
  });
  download('regradar-board-' + TODAY + '.csv', RR.util.csv(rows)); toast('Board downloaded (CSV)');
}
function csvLog() {
  var rows = [['seq', 'at', 'actor', 'action', 'entity_id', 'entity_type', 'title', 'changes', 'note', 'hash']];
  R.events().forEach(function (ev) {
    var ch = ev.changes ? Object.keys(ev.changes).map(function (k) { return k + ': ' + ev.changes[k][0] + ' -> ' + ev.changes[k][1]; }).join('; ') : '';
    rows.push([ev.seq, ev.at, nameOf(ev.actor), ev.action, ev.entity || '', ev.entity_type || '', ev.title, ch, ev.note, ev.hash]);
  });
  download('regradar-event-log-' + TODAY + '.csv', RR.util.csv(rows)); toast('Event log downloaded');
}

/* ───────── events ───────── */
document.addEventListener('click', function (ev) {
  var b = ev.target.closest('[data-act]'); if (!b) return;
  var a = b.getAttribute('data-act');
  if (a === 'mv') return move(b.dataset.id, b.dataset.to, { focus: b.dataset.dir });
  if (a === 'open') return openCard(b.dataset.id, b);
  if (a === 'dispatch') return openDispatch(b);
  if (a === 'close') { ev.preventDefault(); closeDialog(b.closest('dialog')); return; }
  if (a === 'do-dispatch') { ev.preventDefault(); doDispatch(); return; }
  if (a === 'save') return saveCard();
  if (a === 'archive') {
    var t = R.get(UI.cardId);
    try { R.archive(UI.cardId); } catch (x) { toast(x.message); return; }
    closeDialog($('dlg-card')); render(); toast('Archived. It stays in the event log.'); announce('Archived “' + t.title + '”.'); $('board').focus(); return;
  }
  if (a === 'addlink') {
    var val = $('c-link').value; if (!val) { $('c-link').focus(); return; }
    var p = val.split('|');
    try { R.link(p[0], UI.cardId, p[1]); } catch (x) { toast(x.message); return; }
    openCard(UI.cardId); render(); announce('Link added.'); var s = $('c-link'); if (s) s.focus(); return;
  }
  if (a === 'unlink') {
    try { R.unlink(b.dataset.link); } catch (x) { toast(x.message); return; }
    openCard(UI.cardId); render(); announce('Link removed.'); var s2 = $('c-link'); if (s2) s2.focus(); return;
  }
  if (a === 'all-done') { UI.allDone = !UI.allDone; render(); var y = document.querySelector('[data-act="all-done"]'); if (y) y.focus(); return; }
  if (a === 'csv') return csvBoard();
  if (a === 'csv-log') return csvLog();
  if (a === 'demo-on') {
    b.disabled = true;
    fetch('data/spine/demo.json', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (demo) {
      var res = R.loadDemo(demo); render(); toast('Demo data loaded (' + res.records + ' fictional records)'); $('board').focus();
    }).catch(function () { b.disabled = false; toast('Could not load the demo data.'); });
  }
});
document.addEventListener('submit', function (ev) { if (ev.target.id === 'f-dispatch') { ev.preventDefault(); doDispatch(); } if (ev.target.id === 'f-card') { ev.preventDefault(); saveCard(); } });
document.addEventListener('change', function (ev) {
  var t = ev.target;
  if (t.id === 'asgSel') {
    UI.assignee = t.value; render();
    try { var u = new URL(location.href); if (t.value) u.searchParams.set('assignee', t.value); else u.searchParams.delete('assignee'); history.replaceState(null, '', u); } catch (x) { /* ignore */ }
    announce('Showing ' + (t.value === '__none' ? 'unassigned cards' : t.value ? 'cards for ' + nameOf(t.value) : 'everyone\'s cards') + ': ' + plural(cards().length, 'card') + '.');
    $('asgSel').focus(); return;
  }
  if (t.id === 'actorSel') { R.setSetting('actor', t.value); R.setActor(t.value); render(); $('actorSel').focus(); toast('Acting as ' + nameOf(t.value)); }
});

/* drag and drop with a mouse or pen (pointer events); the move buttons are the keyboard and touch path */
var DR = null, suppressClick = false;
function colAt(x, y) { var el = document.elementFromPoint(x, y); return el && el.closest ? el.closest('.col') : null; }
document.addEventListener('pointerdown', function (ev) {
  if (ev.pointerType === 'touch' || ev.button !== 0) return;
  var c = ev.target.closest && ev.target.closest('.card[data-drag]');
  if (!c || ev.target.closest('.c-move,a,select,input')) return;
  DR = { id: c.dataset.id, card: c, x: ev.clientX, y: ev.clientY, on: false, ghost: null };
});
document.addEventListener('pointermove', function (ev) {
  if (!DR) return;
  if (!DR.on) {
    if (Math.abs(ev.clientX - DR.x) + Math.abs(ev.clientY - DR.y) < 8) return;
    DR.on = true;
    var r = DR.card.getBoundingClientRect(), g = DR.card.cloneNode(true);
    g.className += ' ghost'; g.removeAttribute('data-id'); g.setAttribute('aria-hidden', 'true');
    g.style.width = r.width + 'px'; DR.dx = DR.x - r.left; DR.dy = DR.y - r.top;
    document.body.appendChild(g); DR.ghost = g; DR.card.classList.add('dragging');
    document.body.classList.add('is-dragging');
  }
  DR.ghost.style.transform = 'translate(' + (ev.clientX - DR.dx) + 'px,' + (ev.clientY - DR.dy) + 'px)';
  var col = colAt(ev.clientX, ev.clientY);
  document.querySelectorAll('.col.over').forEach(function (n) { if (n !== col) n.classList.remove('over'); });
  if (col) col.classList.add('over');
});
function endDrag(ev, drop) {
  if (!DR) return;
  var d = DR; DR = null;
  if (!d.on) return;
  suppressClick = true; setTimeout(function () { suppressClick = false; }, 0);
  if (d.ghost) d.ghost.remove();
  document.body.classList.remove('is-dragging');
  document.querySelectorAll('.dragging,.col.over').forEach(function (n) { n.classList.remove('dragging', 'over'); });
  var col = drop && colAt(ev.clientX, ev.clientY);
  if (col) move(d.id, col.dataset.status, null);
}
document.addEventListener('pointerup', function (ev) { endDrag(ev, true); });
document.addEventListener('pointercancel', function (ev) { endDrag(ev, false); });
document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && DR) endDrag(ev, false); });
document.addEventListener('click', function (ev) { if (suppressClick) { ev.stopPropagation(); ev.preventDefault(); } }, true);

window.toggleTheme = function () { var h = document.documentElement, t = h.dataset.theme === 'dark' ? 'light' : 'dark'; h.dataset.theme = t; try { localStorage.setItem('regradar-theme', t); } catch (x) { /* ignore */ } };

var reopenT = null;
function boot() {
  return RR.boot({ onExternalChange: function () { if ($('dlg-card').open || $('dlg-dispatch').open) return; clearTimeout(reopenT); reopenT = setTimeout(boot, 400); } }).then(function (b) {
    BOOT = b; R = b.spine; CFG = R.config();
    R.onError(function () { renderBanners(); });
    render();
    if (!boot.done) {
      boot.done = true;
      if (params.get('open') && R.get(params.get('open'))) openCard(params.get('open'));
      else if (params.get('dispatch')) openDispatch();
    }
  }).catch(function (err) {
    $('board').innerHTML = '<p class="empty">Could not open the board: ' + esc(err.message) + ' Reload the page to try again.</p>';
  });
}
boot();
})();
