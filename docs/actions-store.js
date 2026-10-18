/* ═══════════════════════════════════════════════════════════════
   RegRadar: Issues and actions on the data spine (docs/rr-core.js)

   The tracker (docs/actions.js) keeps its working model in memory: a
   list of issues, each with remediation actions. This file is the only
   place that knows how that model is stored in the spine:

     issue (the page says "issue", the spine says "finding")
                        -> entity type 'issue'  (id ISS-001 ...)
     remediation action -> entity type 'action' (a spine "task",
                           id TSK-<issue id>-A1), linked 'fixes' -> issue
     owner (a name)     -> a team member ('person' entity) by name
     severity           -> data.priority, on the spine's priority scale
     due date           -> entity.due
     status             -> the "work" workflow (todo, in_progress, review,
                           done); the page's finer status (for example
                           risk_accepted) is kept in data.module_status
     controls, obligations -> typed links ('concerns', 'addresses')
     status changes, comments, edits -> the append-only event log

   Everything is plain data in the spine, so the work board edits the same
   records. The page's own settings (SLA days, saved filters, dismissed
   suggestions, report commentary) live in the spine setting
   'actions.prefs'; the firm name is the shared setting 'firm_name'.

   MIGRATION (once, idempotent): migrate() copies what the page kept under
   the old localStorage key 'regradar-actions' into the spine. The old key
   is only READ (it stays as a backup, never written or removed) and the
   spine setting 'migrated.actions' records that it is done. RR.boot runs
   it for every page that opens the spine.

   No DOM. Runs in the browser and in Node (tests).
   ═══════════════════════════════════════════════════════════════ */
(function (root, factory) {
  var RR = (typeof module === 'object' && module.exports) ? require('./rr-core.js') : root.RR;
  var Store = factory(RR);
  if (typeof module === 'object' && module.exports) module.exports = Store; else root.ActionsStore = Store;
  if (RR && RR.migrations && !RR.migrations.some(function (m) { return m.id === 'actions'; })) {
    RR.migrations.push({ id: 'actions', label: 'Issues and actions', order: 20, run: Store.migrate });
  }
})(typeof self !== 'undefined' ? self : this, function (RR) {
  'use strict';

  var KEY = 'regradar-actions';             // the old, module-owned key (backup, never written here)
  var DONE = 'migrated.actions';            // spine setting: the one-time import has happened
  var PREFS = 'actions.prefs';              // spine setting: SLA config, saved filters, dismissed, report
  var SEEDED = 'actions.seeded';            // spine setting: the demo register was offered once
  var SEV = ['critical', 'high', 'medium', 'low'];
  var STATUS = ['open', 'in_progress', 'awaiting_validation', 'closed', 'risk_accepted'];
  // The page's status -> the spine's "work" workflow (the same table as config.json "bridge"; checked by a test).
  var TO_ENTITY = { open: 'todo', in_progress: 'in_progress', awaiting_validation: 'review', closed: 'done', risk_accepted: 'done' };
  var FROM_ENTITY = { todo: 'open', in_progress: 'in_progress', review: 'awaiting_validation', done: 'closed' };

  /* ───────── small helpers ───────── */
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function str(v) { return v == null ? '' : String(v); }
  function stable(v) { return RR.util.stable(v); }
  function clone(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }
  function validDate(s) { return RR.dates.valid(str(s).slice(0, 10)) ? str(s).slice(0, 10) : ''; }
  function localDate(at) { var d = new Date(at); return isNaN(d) ? '' : d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function idNumber(id) { var m = /^ISS-(\d+)$/.exec(str(id)); return m ? +m[1] : 0; }
  function issueId(n) { return 'ISS-' + (n < 100 ? ('00' + n).slice(-3) : n); }
  function taskEid(iid, aid) { return 'TSK-' + iid + '-' + aid; }
  function taskRefNum(ref) { var m = /^A(\d+)$/.exec(str(ref)); return m ? +m[1] : 1e9; }
  function isTask(e) { return e && e.type === 'action'; }

  /* ───────── people: owners are team members, matched by name ───────── */
  // Owners: a team member when the name reads like a person, plain text otherwise (rule in RR.owners).
  function ownerId(sp, name) { return RR.owners.resolve(sp, name, 'Found in Issues and actions'); }
  function ownerName(sp, id) {
    if (!id) return '';
    var p = sp.get(id);
    return p ? p.title : id;
  }
  // The owner as plain text, for an owner who is not a team member (empty when the owner is a person).
  function ownerText(sp, name, id) { var n = str(name).trim(); return id || !n || /^unassigned$/i.test(n) ? '' : n; }

  /* ───────── the model <-> the spine ───────── */
  // Clean up one issue as the page (or an old save) holds it. Never throws on odd data.
  function normIssue(x, k) {
    x = x && typeof x === 'object' ? x : {};
    var id = str(x.id).trim() || issueId(k + 1);
    var acc = x.accepted && typeof x.accepted === 'object' ? { by: str(x.accepted.by), until: str(x.accepted.until), on: str(x.accepted.on), rationale: str(x.accepted.rationale) } : null;
    var i = {
      id: id, title: str(x.title).trim() || id, description: str(x.description), source: str(x.source) || 'self_identified', source_ref: str(x.source_ref),
      severity: SEV.indexOf(x.severity) !== -1 ? x.severity : 'medium', root_cause: str(x.root_cause), owner: str(x.owner), lod: str(x.lod) || '1LOD',
      status: STATUS.indexOf(x.status) !== -1 ? x.status : 'open',
      opened_on: validDate(x.opened_on), due_on: validDate(x.due_on), closed_on: validDate(x.closed_on), closed_by: str(x.closed_by), closure_note: str(x.closure_note),
      submitted_on: validDate(x.submitted_on), accepted: acc,
      control_ids: Array.isArray(x.control_ids) ? x.control_ids.map(str).filter(Boolean) : [], obligation_ids: Array.isArray(x.obligation_ids) ? x.obligation_ids.map(str).filter(Boolean) : [],
      demo: !!x.demo, impact_ref: str(x.impact_ref),
      history_seed: Array.isArray(x.history) ? x.history.filter(function (h) { return h && h.t; }).map(function (h) { return { d: validDate(h.d), t: str(h.t) }; }) : [],
      actions: (Array.isArray(x.actions) ? x.actions : []).map(function (a, j) {
        a = a && typeof a === 'object' ? a : {};
        return { id: str(a.id).trim() || 'A' + (j + 1), title: str(a.title).trim() || '(untitled action)', owner: str(a.owner), due_on: validDate(a.due_on),
          status: a.status === 'done' ? 'done' : 'open', done_on: validDate(a.done_on), evidence: str(a.evidence) };
      })
    };
    if (i.status === 'risk_accepted' && !i.accepted) i.status = 'closed';
    return i;
  }

  function unresolvedFor(sp, i) {
    var c = i.control_ids.filter(function (x) { return !sp.get('CTL:' + x); }), o = i.obligation_ids.filter(function (x) { return !sp.get('OBL:' + x); });
    return c.length || o.length ? { controls: c, obligations: o } : null;
  }
  function issueData(sp, i) {
    var d = { description: i.description, source: i.source, source_ref: i.source_ref, priority: i.severity, root_cause: i.root_cause, lod: i.lod,
      opened_on: i.opened_on, closed_on: i.closed_on, closed_by: i.closed_by, closure_note: i.closure_note, submitted_on: i.submitted_on,
      accepted: i.accepted || null, demo: !!i.demo, module_status: i.status, impact_ref: i.impact_ref, unresolved_links: unresolvedFor(sp, i) };
    if (i.history_seed && i.history_seed.length) d.history_seed = i.history_seed;
    return d;
  }
  var ISSUE_DATA = { description: 'description', source: 'source', source_ref: 'source_ref', severity: 'priority', root_cause: 'root_cause', lod: 'lod', opened_on: 'opened_on',
    closed_on: 'closed_on', closed_by: 'closed_by', closure_note: 'closure_note', submitted_on: 'submitted_on', accepted: 'accepted', demo: 'demo', impact_ref: 'impact_ref' };
  // What counts as "changed" on an issue: these fields, in the page's own terms.
  function wireIssue(i) {
    return { title: i.title, description: i.description, source: i.source, source_ref: i.source_ref, severity: i.severity, root_cause: i.root_cause, owner: i.owner, lod: i.lod,
      status: i.status, opened_on: i.opened_on, due_on: i.due_on, closed_on: i.closed_on, closed_by: i.closed_by, closure_note: i.closure_note, submitted_on: i.submitted_on,
      accepted: i.accepted || null, demo: !!i.demo, impact_ref: i.impact_ref || '', control_ids: i.control_ids, obligation_ids: i.obligation_ids };
  }
  function wireTask(a) { return { title: a.title, owner: a.owner, due_on: a.due_on, status: a.status, done_on: a.done_on, evidence: a.evidence }; }
  function changedKeys(now, base) { return Object.keys(now).filter(function (k) { return stable(now[k]) !== stable(base ? base[k] : undefined); }); }

  function viewStatus(e) {
    var ms = e.data && e.data.module_status;
    if (ms && TO_ENTITY[ms] === e.status) return ms;
    return FROM_ENTITY[e.status] || 'open';
  }
  function idsOf(sp, e, type, prefix, extra) {
    var out = sp.links(e.id, type, 'out').filter(function (l) { return l.to.indexOf(prefix) === 0; }).map(function (l) { return l.to.slice(prefix.length); });
    (extra || []).forEach(function (x) { if (out.indexOf(x) === -1) out.push(x); });
    return out;
  }
  function taskEntities(sp, iid, withArchived) {
    var out = [];
    sp.links(iid, 'fixes', 'in').forEach(function (l) {
      var t = sp.get(l.from);
      if (t && isTask(t) && (withArchived || !t.archived) && out.indexOf(t) === -1) out.push(t);
    });
    return out;
  }
  function rebase(i) {
    i._b = clone(wireIssue(i));
    i._eids = i.actions.map(function (a) { return a._eid; }).filter(Boolean);
    i.actions.forEach(function (a) { a._b = clone(wireTask(a)); });
  }
  function viewIssue(sp, e, o) {
    var d = e.data || {}, un = d.unresolved_links || {};
    var status = viewStatus(e);
    var i = {
      id: e.id, title: e.title, description: str(d.description), source: str(d.source) || 'self_identified', source_ref: str(d.source_ref),
      severity: SEV.indexOf(d.priority) !== -1 ? d.priority : 'medium', root_cause: str(d.root_cause), owner: ownerName(sp, e.owner) || str(d.owner_text), lod: str(d.lod) || '1LOD', status: status,
      opened_on: validDate(d.opened_on) || localDate(e.created_at), due_on: e.due || '', closed_on: validDate(d.closed_on), closed_by: str(d.closed_by), closure_note: str(d.closure_note),
      submitted_on: validDate(d.submitted_on), accepted: d.accepted && typeof d.accepted === 'object' ? clone(d.accepted) : null,
      control_ids: idsOf(sp, e, 'concerns', 'CTL:', un.controls), obligation_ids: idsOf(sp, e, 'addresses', 'OBL:', un.obligations),
      demo: !!d.demo || e.origin === 'demo', impact_ref: str(d.impact_ref), history_seed: clone(d.history_seed) || [], actions: [], _eid: e.id
    };
    if (i.status === 'risk_accepted' && !i.accepted) i.status = 'closed';
    if (i.status === 'closed' && !i.closed_on) i.closed_on = localDate(e.updated_at);   // moved to Done on the board
    if (i.status === 'awaiting_validation' && !i.submitted_on) i.submitted_on = localDate(e.updated_at);
    if (!i.due_on) i.due_on = (o && o.defaultDue) ? o.defaultDue(i) : '';
    i.actions = taskEntities(sp, e.id, false).map(function (t) {
      var td = t.data || {}, done = t.status === 'done';
      return { id: str(td.ref) || t.id, title: t.title, owner: ownerName(sp, t.owner) || str(td.owner_text), due_on: t.due || i.due_on, status: done ? 'done' : 'open',
        done_on: done ? (validDate(td.done_on) || localDate(t.updated_at)) : '', evidence: str(td.evidence), _eid: t.id, _o: [taskRefNum(td.ref), t.created_at || '', t.id] };
    }).sort(function (a, b) { return a._o[0] - b._o[0] || (a._o[1] < b._o[1] ? -1 : a._o[1] > b._o[1] ? 1 : a._o[2] < b._o[2] ? -1 : 1); });
    rebase(i);
    return i;
  }

  function maxSeq(sp) {
    var rec = sp.getSetting(DONE), m = (rec && +rec.seq) || 0;
    sp.list('issue', { archived: true }).forEach(function (e) { m = Math.max(m, idNumber(e.id)); });
    return m;
  }

  /* ───────── create ───────── */
  function createTask(sp, i, a, o) {
    var eid = taskEid(i.id, a.id), cur = sp.get(eid);
    var done = a.status === 'done';
    var data = { kind: 'remediation', priority: i.severity, evidence: a.evidence, done_on: a.done_on, ref: a.id, demo: !!i.demo };
    var oid = ownerId(sp, a.owner);
    data.owner_text = ownerText(sp, a.owner, oid);
    var input = { title: a.title, status: done ? 'done' : 'todo', owner: oid, due: validDate(a.due_on) || validDate(i.due_on) || null, data: data };
    var ent;
    if (cur && isTask(cur) && cur.archived) ent = sp.update(eid, Object.assign({ archived: false }, input), { replaceData: true, action: 'restore', note: o.taskNote });
    else ent = sp.create('action', Object.assign({ id: eid, src: { module: 'actions', ref: i.id + '/' + a.id } }, input), { action: o.action || 'create', note: o.taskNote, origin: o.origin });
    try { sp.link('fixes', eid, i.id, { silent: true }); } catch (e) { /* the issue is always written first */ }
    a._eid = eid;
    return ent;
  }
  function syncLinks(sp, iid, ids, type, prefix) {
    var cur = sp.links(iid, type, 'out').filter(function (l) { return l.to.indexOf(prefix) === 0; }), want = {}, have = {};
    ids.forEach(function (x) { want[prefix + x] = 1; });
    cur.forEach(function (l) { if (!want[l.to]) sp.unlink(l.id, { silent: true }); else have[l.to] = 1; });
    Object.keys(want).forEach(function (t) { if (!have[t] && sp.get(t)) { try { sp.link(type, iid, t, { silent: true }); } catch (e) { /* type mismatch: kept in data.unresolved_links */ } } });
  }
  function createIssue(sp, i, o) {
    o = o || {};
    var cur = sp.get(i.id);
    var oid = ownerId(sp, i.owner), data = issueData(sp, i);
    data.owner_text = ownerText(sp, i.owner, oid);
    var input = { title: i.title, status: TO_ENTITY[i.status] || 'todo', owner: oid, due: validDate(i.due_on) || null, data: data };
    if (cur && cur.type === 'issue' && cur.archived) sp.update(i.id, Object.assign({ archived: false }, input), { replaceData: true, action: 'restore', note: o.note });
    else sp.create('issue', Object.assign({ id: i.id, src: { module: 'actions', ref: i.id } }, input), { action: o.action || 'create', note: o.note, origin: o.origin });
    syncLinks(sp, i.id, i.control_ids, 'concerns', 'CTL:');
    syncLinks(sp, i.id, i.obligation_ids, 'addresses', 'OBL:');
    i.actions.forEach(function (a) { createTask(sp, i, a, { action: o.action || 'create', origin: o.origin, taskNote: o.action === 'import' ? 'Imported with ' + i.id : 'Action added: ' + a.title }); });
    return i;
  }
  /* Create findings from page-shaped issues (the tracker's demo register, the impact page).
     Issues without an id get the next ISS-nnn. o.seed keeps the issue's own history lines (demo data);
     otherwise its first history line becomes the note on the creation event. Returns the ids. */
  function createFindings(sp, list, o) {
    o = o || {};
    var seq = maxSeq(sp), ids = [];
    list.forEach(function (raw, k) {
      var i = normIssue(raw, k);
      if (!str(raw && raw.id).trim()) { seq++; i.id = issueId(seq); }
      else seq = Math.max(seq, idNumber(i.id));
      if (!i.opened_on) i.opened_on = sp.today();
      if (!i.due_on) i.due_on = RR.dates.addDays(i.opened_on, 30);
      var first = !o.seed && raw && raw.history && raw.history[0] && raw.history[0].t;
      if (!o.seed) i.history_seed = [];
      createIssue(sp, i, { action: o.action || 'create', origin: o.origin, note: o.note || first || 'Opened' });
      ids.push(i.id);
    });
    return ids;
  }

  /* ───────── read the register ───────── */
  function read(sp, o) {
    o = o || {};
    var issues = sp.list('issue').map(function (e) { return viewIssue(sp, e, o); });
    issues.sort(function (a, b) {
      var na = idNumber(a.id) || 1e12, nb = idNumber(b.id) || 1e12;
      return na - nb || (a.opened_on < b.opened_on ? -1 : a.opened_on > b.opened_on ? 1 : a.id < b.id ? -1 : 1);
    });
    var prefs = sp.getSetting(PREFS);
    var out = { issues: issues, seq: maxSeq(sp), firm: str(sp.getSetting('firm_name')), prefs: prefs && typeof prefs === 'object' ? clone(prefs) : {}, _ids: issues.map(function (i) { return i.id; }) };
    out._firm = out.firm; out._prefs = stable(out.prefs);
    return out;
  }

  /* ───────── write the register back (only what changed) ───────── */
  function syncIssue(sp, R, i, notes) {
    var cur = sp.get(i.id);
    if (!cur || cur.type !== 'issue' || cur.archived) {                    // new (or re-added) issue
      createIssue(sp, i, { action: 'create', note: notes.join('; ') || 'Opened' });
      rebase(i);
      return;
    }
    var w = wireIssue(i), keys = changedKeys(w, i._b), patch = {}, data = {}, used = false;
    keys.forEach(function (k) {
      if (k === 'title') patch.title = i.title.trim() || cur.title;
      else if (k === 'owner') { patch.owner = ownerId(sp, i.owner); data.owner_text = ownerText(sp, i.owner, patch.owner); }
      else if (k === 'due_on') patch.due = validDate(i.due_on) || null;
      else if (k === 'status') { if (TO_ENTITY[i.status] !== cur.status) patch.status = TO_ENTITY[i.status]; data.module_status = i.status; }
      else if (ISSUE_DATA[k]) data[ISSUE_DATA[k]] = k === 'accepted' ? (i.accepted || null) : i[k];
    });
    if (keys.indexOf('control_ids') !== -1 || keys.indexOf('obligation_ids') !== -1) data.unresolved_links = unresolvedFor(sp, i);
    if (Object.keys(data).length) patch.data = data;
    if (Object.keys(patch).length) {
      var o = { note: notes.join('; ') };
      if (patch.status && patch.status !== cur.status) o.action = 'move';
      var upd = sp.update(i.id, patch, o);
      used = notes.length > 0 && upd.rev !== cur.rev;
    }
    if (keys.indexOf('control_ids') !== -1) syncLinks(sp, i.id, i.control_ids, 'concerns', 'CTL:');
    if (keys.indexOf('obligation_ids') !== -1) syncLinks(sp, i.id, i.obligation_ids, 'addresses', 'OBL:');
    // remediation actions
    var rest = notes.join('; ');
    function take() { if (used || !rest) return ''; used = true; return rest; }
    var current = {};
    i.actions.forEach(function (a) {
      if (a._eid) current[a._eid] = 1;
      var t = a._eid && sp.get(a._eid);
      if (!t || t.archived) { createTask(sp, i, a, { action: 'create', taskNote: take() || 'Action added: ' + a.title }); a._b = clone(wireTask(a)); if (a._eid) current[a._eid] = 1; return; }
      var tk = changedKeys(wireTask(a), a._b), tp = {}, td = {};
      tk.forEach(function (k) {
        if (k === 'title') tp.title = a.title;
        else if (k === 'owner') { tp.owner = ownerId(sp, a.owner); td.owner_text = ownerText(sp, a.owner, tp.owner); }
        else if (k === 'due_on') tp.due = validDate(a.due_on) || null;
        else if (k === 'status') { var want = a.status === 'done' ? 'done' : (t.status === 'done' ? 'todo' : t.status); if (want !== t.status) tp.status = want; }
        else if (k === 'done_on') td.done_on = a.done_on;
        else if (k === 'evidence') td.evidence = a.evidence;
      });
      if (keys.indexOf('severity') !== -1 && a.status !== 'done') td.priority = i.severity;
      if (Object.keys(td).length) tp.data = td;
      if (Object.keys(tp).length) { var so = { note: take() }; if (tp.status && tp.status !== t.status) so.action = 'move'; sp.update(t.id, tp, so); }
    });
    (i._eids || []).forEach(function (eid) {
      if (current[eid]) return;
      var t = sp.get(eid);
      if (t && !t.archived) sp.archive(eid, { note: take() || 'Action removed' });
    });
    if (rest && !used) sp.log('comment', i.id, rest);
    rebase(i);
  }

  /* Write the page's register back to the spine. `pend` holds the notes (history lines) logged since the last call, by issue id. */
  function commit(sp, R, pend) {
    pend = pend || {};
    var errors = [], ids = {};
    R.issues.forEach(function (i) {
      ids[i.id] = 1;
      try { syncIssue(sp, R, i, pend[i.id] || []); } catch (e) { errors.push(i.id + ': ' + e.message); }
    });
    (R._ids || []).forEach(function (id) {
      if (ids[id]) return;
      try {
        var e = sp.get(id);
        if (e && e.type === 'issue' && !e.archived) {
          taskEntities(sp, id, false).forEach(function (t) { sp.archive(t.id, { note: 'Removed with ' + id }); });
          sp.archive(id, { note: (pend[id] || []).join('; ') || 'Deleted from the register' });
        }
      } catch (e2) { errors.push(id + ': ' + e2.message); }
    });
    R._ids = Object.keys(ids);
    if (R.firm !== R._firm) { sp.setSetting('firm_name', R.firm); R._firm = R.firm; }
    return { errors: errors };
  }
  // The page's own settings (SLA days, saved filters, dismissed suggestions, report commentary).
  function savePrefs(sp, R, prefs) {
    var s = stable(prefs);
    if (s === R._prefs) return false;
    sp.setSetting(PREFS, clone(prefs));
    R._prefs = s;
    return true;
  }

  /* ───────── history shown on the issue sheet: old lines + the event log ───────── */
  var HIDDEN = { import: 1, sync: 1, demo: 1, settings: 1, reset: 1 };
  function describe(sp, ev, task) {
    var who = ev.actor && ev.actor !== 'person:me' ? ' (' + (ev.actor === 'system:bridge' ? 'module import' : ownerName(sp, ev.actor)) + ')' : '';
    var ch = ev.changes || {};
    function stateLabel(id) { try { var s = sp.stateDef(ev.entity_type, id); return s ? s.label : id; } catch (e) { return id; } }
    var pre = task ? 'Action “' + ev.title + '”: ' : '';
    if (ev.action === 'comment') return ev.note;
    if (HIDDEN[ev.action]) return null;
    if (ev.action === 'dispatch') return 'Action added on the work board: ' + ev.title + who;
    if (ev.action === 'link' || ev.action === 'unlink') return (ev.note || ev.action) + who;
    if (ev.note) return ev.note + who;
    if (ev.action === 'create') return task ? 'Action added: ' + ev.title + who : 'Opened' + who;
    if (ev.action === 'move' && ch.status) return pre + 'status changed from ' + stateLabel(ch.status[0]) + ' to ' + stateLabel(ch.status[1]) + who;
    if (ev.action === 'assign' && ch.owner) return pre + 'owner changed from ' + (ownerName(sp, ch.owner[0]) || 'unassigned') + ' to ' + (ownerName(sp, ch.owner[1]) || 'unassigned') + who;
    if (ev.action === 'archive') return task ? 'Action removed: ' + ev.title + who : 'Archived' + who;
    if (ev.action === 'restore') return 'Restored' + who;
    var labels = { title: 'title', owner: 'owner', due: 'due date', 'data.priority': 'severity', 'data.description': 'description', 'data.evidence': 'evidence note', 'data.done_on': 'done date' };
    var parts = Object.keys(ch).filter(function (k) { return k !== 'data.module_status' && k !== 'archived'; }).map(function (k) { return labels[k] || k.replace(/^data\./, '').replace(/_/g, ' '); });
    return parts.length ? pre + 'changed ' + parts.join(', ') + who : null;
  }
  function history(sp, i) {
    var rows = (i.history_seed || []).map(function (h, k) { return { d: h.d, t: h.t, s: 0, n: k }; });
    var ents = [{ id: i.id, task: false }].concat(taskEntities(sp, i.id, true).map(function (t) { return { id: t.id, task: true }; })), seen = {};
    ents.forEach(function (x) {
      sp.history(x.id).forEach(function (ev) {
        if (seen[ev.id]) return; seen[ev.id] = 1;
        var t = describe(sp, ev, x.task && ev.entity !== i.id);
        if (t) rows.push({ d: localDate(ev.at), t: t, s: 1, n: ev.seq });
      });
    });
    rows.sort(function (a, b) { return a.d < b.d ? -1 : a.d > b.d ? 1 : a.s - b.s || a.n - b.n; });
    return rows.map(function (r) { return { d: r.d, t: r.t }; });
  }

  /* ───────── the one-time import from the old localStorage key ───────── */
  function migrate(sp, read0) {
    if (sp.getSetting(DONE)) return { status: 'already' };
    var raw;
    try { raw = read0(KEY); } catch (e) { return { status: 'blocked' }; }
    if (raw == null || raw === '') return { status: 'none' };
    var src;
    try { src = JSON.parse(raw); } catch (e) { return { status: 'unreadable' }; }
    if (!src || typeof src !== 'object' || Array.isArray(src)) return { status: 'unreadable' };
    var list = Array.isArray(src.issues) ? src.issues : [];
    var rep = { status: 'migrated', issues: 0, tasks: 0, skipped: 0, renamed: [] };
    var seq = +src.seq || 0;
    list.forEach(function (x) { seq = Math.max(seq, idNumber(x && x.id)); });
    var next = seq;
    list.forEach(function (x, k) {
      var i = normIssue(x, k);
      var cur = sp.get(i.id);
      if (cur && cur.src && cur.src.module === 'actions') { rep.skipped++; return; }          // already imported (a previous, interrupted run)
      if (cur) { next++; rep.renamed.push([i.id, issueId(next)]); i.id = issueId(next); }       // an id used by something else: take a new one
      if (!i.opened_on) i.opened_on = '';
      createIssue(sp, i, { action: 'import', note: 'Imported from the old register on this device' });
      rep.issues++; rep.tasks += i.actions.length;
    });
    // the page's own settings and the firm name
    var prefs = {};
    ['cfg', 'saved', 'dismissed', 'report'].forEach(function (k) { if (src[k] != null && typeof src[k] === 'object') prefs[k] = clone(src[k]); });
    if (Object.keys(prefs).length && !sp.getSetting(PREFS)) sp.setSetting(PREFS, prefs);
    if (str(src.firm).trim() && !sp.getSetting('firm_name')) sp.setSetting('firm_name', str(src.firm).trim());
    sp.setSetting(DONE, { at: new Date().toISOString(), source: KEY, issues: rep.issues, tasks: rep.tasks, seq: Math.max(seq, next) });
    sp.log('import', null, 'Issues and actions: ' + rep.issues + ' issues and ' + rep.tasks + ' actions imported from the old register on this device. The old data is kept as a backup.');
    return rep;
  }

  /* A light look at the device (no spine needed): how many issues exist, and their ids. Used by the impact page. */
  function peek(getItem) {
    var out = { exists: false, n: 0, ids: {}, unreadable: false, migrated: false };
    function json(k) { try { var r = getItem(k); return r ? JSON.parse(r) : null; } catch (e) { return undefined; } }
    var meta = json('regradar-spine-meta'), ents = json('regradar-spine-entities');
    var rec = meta && meta.settings && meta.settings.values && meta.settings.values[DONE];
    if (rec) { out.migrated = true; out.exists = true; }
    if (ents) Object.keys(ents).forEach(function (k) { var e = ents[k]; if (e && e.type === 'issue' && !e.archived && !out.ids[e.id]) { out.ids[e.id] = 1; out.n++; out.exists = true; } });
    if (!rec) {
      var old = json(KEY);
      if (old === undefined) out.unreadable = true;
      else if (old && Array.isArray(old.issues)) {
        out.exists = true;
        old.issues.forEach(function (i) { if (i && i.id && !out.ids[i.id]) { out.ids[i.id] = 1; out.n++; } });
      }
    }
    return out;
  }

  return {
    KEY: KEY, DONE: DONE, PREFS: PREFS, SEEDED: SEEDED,
    TO_ENTITY: TO_ENTITY, FROM_ENTITY: FROM_ENTITY,
    migrate: migrate, read: read, commit: commit, savePrefs: savePrefs, createFindings: createFindings, history: history, peek: peek,
    normIssue: normIssue, ownerId: ownerId, looksLikePerson: function (n) { return RR.owners.looksLikePerson(n); }, nextSeq: maxSeq, issueId: issueId
  };
});
