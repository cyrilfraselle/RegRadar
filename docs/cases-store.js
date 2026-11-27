/* ═══════════════════════════════════════════════════════════════
   RegRadar: Cases, alerts, FIU reports and requests on the data spine (docs/rr-core.js)

   The Cases page (docs/cases.js) keeps its working model in memory:
   { settings, alerts, cases, filings, requests, seq }. This file is the only
   place that knows how that model is stored in the spine:

     case     -> entity type 'case'         id 'CS:<case id>'   (board and briefing see it)
     alert    -> entity type 'alert'        id 'AL:<alert id>'
     filing   -> entity type 'filing'       id 'FL:<filing id>'
     request  -> entity type 'fiu_request'  id 'RQ:<request id>'
     settings -> spine settings 'cases.settings', 'cases.seq', 'cases.meta'

   Each record keeps the whole page record in data.rec, so nothing is lost.
   Title, status, owner (a team member) and due date are real fields of the
   entity, so the board can move and assign cases and alerts.

   CARE WITH CASE DATA. The spine's event log is append-only and hashed, so
   nothing written there can be taken back. The content of a case (subjects,
   timeline, narrative, evidence) is therefore written WITHOUT an audit event
   (the spine's silent update): the log shows that a case was created, moved
   or assigned, never what it says. Deleting or erasing a record empties its
   content first and then archives it.

   MIGRATION (once, idempotent): migrate() copies what the page kept under
   the old localStorage key 'regradar-cases' into the spine. The old key is
   only READ (it stays as a backup) and the spine setting 'migrated.cases'
   records that it is done. The read-only mirror of cases that the bridge
   made earlier (CASE:<id>) is retired by the spine's migration rules.

   No DOM. Runs in the browser and in Node (tests).
   ═══════════════════════════════════════════════════════════════ */
(function (root, factory) {
  var RR = (typeof module === 'object' && module.exports) ? require('./rr-core.js') : root.RR;
  var Store = factory(RR);
  if (typeof module === 'object' && module.exports) module.exports = Store; else root.CasesStore = Store;
  if (RR && RR.migrations && !RR.migrations.some(function (m) { return m.id === 'cases'; })) {
    RR.migrations.push({ id: 'cases', label: 'Cases and STR', order: 40, run: Store.migrate });
  }
})(typeof self !== 'undefined' ? self : this, function (RR) {
  'use strict';

  var KEY = 'regradar-cases';            // the old, module-owned key (backup, never written here)
  var DONE = 'migrated.cases';           // spine setting: the one-time import has happened
  var INIT = 'cases.init';               // spine setting: the page has been opened on the spine once
  var KINDS = {
    cases:    { type: 'case',        prefix: 'CS:' },
    alerts:   { type: 'alert',       prefix: 'AL:' },
    filings:  { type: 'filing',      prefix: 'FL:' },
    requests: { type: 'fiu_request', prefix: 'RQ:' }
  };
  var LISTS = Object.keys(KINDS);
  var OPEN_CASE = ['open', 'review', 'mlro'];
  var PRIORITIES = ['critical', 'high', 'medium', 'low'];

  function str(v) { return v == null ? '' : String(v); }
  function clone(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }
  function stable(v) { return RR.util.stable(v); }
  function isObj(v) { return v && typeof v === 'object' && !Array.isArray(v); }
  function eid(list, id) { return KINDS[list].prefix + id; }
  function isMine(e, list) {
    return e && e.type === KINDS[list].type && e.id.indexOf(KINDS[list].prefix) === 0 && e.src && e.src.module === 'cases';
  }
  function validDate(s) { return RR.dates.valid(str(s).slice(0, 10)) ? str(s).slice(0, 10) : ''; }

  /* the page's own statuses (they match the spine workflows; anything odd falls back to the first state) */
  function statusOf(list, rec, sp) {
    var want = list === 'requests' ? (rec.respondedAt ? 'answered' : 'open') : list === 'filings' ? 'filed' : str(rec.status);
    var wf = sp.config().entity_types[KINDS[list].type].workflow;
    var states = sp.config().workflows[wf].states.map(function (s) { return s.id; });
    return states.indexOf(want) !== -1 ? want : states[0];
  }
  function titleOf(list, rec) {
    var t = list === 'requests' ? rec.subject : list === 'filings' ? (rec.ownRef || (str(rec.kind) + ' report ' + rec.id)) : rec.title;
    return str(t).trim() || str(rec.id);
  }
  function dueOf(list, rec, settings) {
    if (list === 'cases') {
      var opened = validDate(rec.openedAt);
      if (OPEN_CASE.indexOf(rec.status) === -1 || !opened) return null;
      var days = +settings.caseDays || 10;
      return RR.dates.addWorkingDays(opened, days, Array.isArray(settings.holidays) ? settings.holidays : []) || null;
    }
    if (list === 'requests') return rec.respondedAt ? null : (validDate(rec.dueAt) || null);
    return null;
  }
  function validRec(x) { return isObj(x) && str(x.id).trim() !== ''; }

  function payload(list, rec, ord) {
    var d = { rec: clone(rec), ord: ord };
    if (list === 'cases' || list === 'alerts') {
      if (PRIORITIES.indexOf(rec.priority) !== -1) d.priority = rec.priority;
      if (rec.typology) d.typology = str(rec.typology);
    }
    return d;
  }

  /* Writes one record. Structural fields are audited; the content is not (see the header). */
  function write(sp, list, rec, ord, settings, o) {
    o = o || {};
    var id = eid(list, rec.id), cur = sp.get(id), K = KINDS[list];
    if (cur && !isMine(cur, list)) throw new Error('Id used by another record: ' + id);
    var oid = list === 'cases' || list === 'alerts' ? RR.owners.resolve(sp, rec.assignee, 'Found in Cases') : null;
    var input = { title: titleOf(list, rec), status: statusOf(list, rec, sp), owner: oid, due: dueOf(list, rec, settings) };
    var data = payload(list, rec, ord);
    if (!cur) {
      sp.create(K.type, Object.assign({ id: id, src: { module: 'cases', ref: rec.id }, data: {} }, input), { action: o.action || 'create', note: o.note, origin: o.origin });
    } else if (cur.archived) {
      sp.update(id, Object.assign({ archived: false }, input), { action: 'restore', note: o.note });
    } else {
      sp.update(id, input, { note: o.note });
    }
    sp.update(id, { data: data }, { replaceData: true, silent: true });
  }

  /* an archived record keeps no content */
  function retire(sp, list, id, note) {
    var e = sp.get(eid(list, id));
    if (!e || !isMine(e, list) || e.archived) return;
    sp.update(e.id, { data: {} }, { replaceData: true, silent: true });
    sp.archive(e.id, { note: note });
  }

  /* ───────── read the page's model ───────── */
  function read(sp) {
    var DB = { v: 1, settings: clone(sp.getSetting('cases.settings')) || {}, alerts: [], cases: [], filings: [], requests: [], seq: clone(sp.getSetting('cases.seq')) || {}, _b: {} };
    var meta = sp.getSetting('cases.meta') || {};
    if (meta.demo) DB.demo = true;
    LISTS.forEach(function (list) {
      var rows = [];
      sp.list(KINDS[list].type).filter(function (e) { return isMine(e, list) && !e.archived; }).forEach(function (e) {
        var rec = e.data && e.data.rec;
        if (!validRec(rec)) return;
        rec = clone(rec);
        if (list === 'cases' || list === 'alerts') {
          // the board may have moved or assigned it: that wins over the copy held in data.rec
          var p = e.owner ? sp.get(e.owner) : null;
          if (p) rec.assignee = p.title;
          if (e.status && e.status !== statusOf(list, rec, sp)) rec.status = e.status;
        }
        DB._b[eid(list, rec.id)] = stable(rec);
        rows.push({ ord: +(e.data && e.data.ord) || 0, rec: rec });
      });
      rows.sort(function (a, b) { return a.ord - b.ord; });
      DB[list] = rows.map(function (r) { return r.rec; });
    });
    return DB;
  }

  /* ───────── write back only what changed; records that vanished are emptied and archived ───────── */
  function commit(sp, DB, R) {
    var errors = [], seen = {}, settings = DB.settings || {};
    R = R || { _b: {} };
    R._b = R._b || {};
    try {
      sp.setSetting('cases.settings', clone(settings));
      sp.setSetting('cases.seq', clone(DB.seq || {}));
      sp.setSetting('cases.meta', { v: 1, demo: !!DB.demo });
      if (!sp.getSetting(INIT)) sp.setSetting(INIT, true);
    } catch (e) { errors.push('settings: ' + e.message); }
    LISTS.forEach(function (list) {
      (DB[list] || []).forEach(function (rec, i) {
        if (!validRec(rec)) return;
        var id = eid(list, rec.id), s = stable(rec), cur = sp.get(id);
        seen[id] = 1;
        if (R._b[id] === s && cur && !cur.archived && (+(cur.data && cur.data.ord) || 0) === i) return;
        try { write(sp, list, rec, i, settings, { action: 'create', note: 'Saved from the Cases page' }); R._b[id] = s; } catch (e) { errors.push(id + ': ' + e.message); }
      });
    });
    Object.keys(R._b).forEach(function (id) {
      if (seen[id]) return;
      var list = LISTS.filter(function (l) { return id.indexOf(KINDS[l].prefix) === 0; })[0];
      try { if (list) retire(sp, list, id.slice(KINDS[list].prefix.length), 'Removed from the Cases page'); delete R._b[id]; } catch (x) { errors.push(id + ': ' + x.message); }
    });
    return { errors: errors };
  }

  /* ───────── the one-time import from the old localStorage key ───────── */
  function migrate(sp, read0) {
    if (sp.getSetting(DONE)) return { status: 'already' };
    var raw;
    try { raw = read0(KEY); } catch (e) { return { status: 'blocked' }; }
    if (raw == null || raw === '') return { status: 'none' };
    var src;
    try { src = JSON.parse(raw); } catch (e) { return { status: 'unreadable' }; }
    if (!isObj(src) || !Array.isArray(src.alerts) || !Array.isArray(src.cases)) return { status: 'unreadable' };
    var settings = isObj(src.settings) ? src.settings : {};
    var rep = { status: 'migrated', records: 0, skipped: 0 };
    LISTS.forEach(function (list) {
      (Array.isArray(src[list]) ? src[list] : []).forEach(function (rec, i) {
        if (!validRec(rec)) { rep.skipped++; return; }
        if (sp.get(eid(list, rec.id))) { rep.skipped++; return; }      // an interrupted run, or written since
        write(sp, list, rec, i, settings, { action: 'import', note: 'Imported from the old cases on this device' });
        rep.records++;
      });
    });
    if (!sp.getSetting(INIT)) {
      sp.setSetting('cases.settings', clone(settings));
      sp.setSetting('cases.seq', clone(isObj(src.seq) ? src.seq : {}));
      sp.setSetting('cases.meta', { v: 1, demo: !!src.demo });
      sp.setSetting(INIT, true);
    }
    sp.setSetting(DONE, { at: new Date().toISOString(), source: KEY, records: rep.records });
    sp.log('import', null, 'Cases: ' + rep.records + ' records imported from this device. The old data is kept as a backup.');
    return rep;
  }

  return { KEY: KEY, DONE: DONE, INIT: INIT, KINDS: KINDS, migrate: migrate, read: read, commit: commit, entityId: eid };
});
