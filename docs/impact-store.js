/* ═══════════════════════════════════════════════════════════════
   RegRadar: Change impact assessments on the data spine (docs/rr-core.js)

   The Change impact page (docs/impact.js) keeps its working model in
   memory: { assessments: { <RegWatch item id>: assessment } }. This file
   is the only place that knows how that model is stored in the spine:

     assessment -> entity type 'reg_change', id 'RC:imp-<item id>'
                   (RC:<item id> is the read-only RegWatch feed record)
     decision   -> the 'reg_change' workflow: none = assessing,
                   action or monitor = assessed, no_action = not_relevant
     owner      -> a team member by name (RR.owners), or plain text
     date       -> entity.due: applies-from date, else consultation
                   deadline, else planning deadline
     the rest   -> data.assessment, the whole assessment as the page
                   holds it (overrides, dates and their sources,
                   rationale, task list), so nothing is lost

   MIGRATION (once, idempotent): migrate() copies what the page kept under
   the old localStorage key 'regradar-impact' into the spine. The old key is
   only READ (it stays as a backup) and the spine setting 'migrated.impact'
   records that it is done. RR.boot runs it for every page that opens the
   spine. Records the read-only bridge mirrored earlier (RC:<item id>, origin
   module:impact) are retired by the spine's migration rules, not copied.

   No DOM. Runs in the browser and in Node (tests).
   ═══════════════════════════════════════════════════════════════ */
(function (root, factory) {
  var RR = (typeof module === 'object' && module.exports) ? require('./rr-core.js') : root.RR;
  var Store = factory(RR);
  if (typeof module === 'object' && module.exports) module.exports = Store; else root.ImpactStore = Store;
  if (RR && RR.migrations && !RR.migrations.some(function (m) { return m.id === 'impact'; })) {
    RR.migrations.push({ id: 'impact', label: 'Change impact', order: 30, run: Store.migrate });
  }
})(typeof self !== 'undefined' ? self : this, function (RR) {
  'use strict';

  var KEY = 'regradar-impact';           // the old, module-owned key (backup, never written here)
  var DONE = 'migrated.impact';          // spine setting: the one-time import has happened
  var PREFIX = 'RC:imp-';
  var DECISION_STATUS = { '': 'assessing', action: 'assessed', monitor: 'assessed', no_action: 'not_relevant' };
  var STR_KEYS = ['itemId', 'itemTitle', 'itemUrl', 'itemSource', 'itemDate', 'created', 'updated', 'severity', 'decision', 'rationale', 'owner',
    'effective', 'effectiveSrc', 'consultation', 'consultationSrc', 'planning', 'planningSrc'];

  function str(v) { return v == null ? '' : String(v); }
  function clone(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }
  function stable(v) { return RR.util.stable(v); }
  function validDate(s) { return RR.dates.valid(str(s).slice(0, 10)) ? str(s).slice(0, 10) : ''; }
  function eid(itemId) { return PREFIX + itemId; }
  function isMine(e) { return e && e.type === 'reg_change' && e.id.indexOf(PREFIX) === 0 && e.src && e.src.module === 'impact'; }

  /* One assessment as the page holds it; never throws on odd data. Returns null when it has no item id. */
  function norm(x) {
    if (!x || typeof x !== 'object' || Array.isArray(x) || !str(x.itemId).trim()) return null;
    var a = {};
    STR_KEYS.forEach(function (k) { a[k] = str(x[k]); });
    var o = x.over && typeof x.over === 'object' ? x.over : {};
    a.over = {};
    ['instr', 'ob', 'ctl', 'pol', 'seg'].forEach(function (k) { a.over[k] = o[k] && typeof o[k] === 'object' && !Array.isArray(o[k]) ? clone(o[k]) : {}; });
    a.tasks = Array.isArray(x.tasks) ? clone(x.tasks.filter(function (t) { return t && typeof t === 'object'; })) : [];
    a.touched = !!x.touched;
    a.id = a.itemId;
    return a;
  }
  function dueOf(a) { return validDate(a.effective) || validDate(a.consultation) || validDate(a.planning) || null; }
  function ownerText(name, id) { var n = str(name).trim(); return id || !n || /^unassigned$/i.test(n) ? '' : n; }

  function write(sp, a, o) {
    o = o || {};
    var id = eid(a.itemId), cur = sp.get(id), oid = RR.owners.resolve(sp, a.owner, 'Found in Change impact');
    var data = { assessment: clone(a), source: a.itemSource, url: a.itemUrl, published: validDate(a.itemDate), decision: a.decision, priority: a.severity,
      effective: validDate(a.effective), consultation: validDate(a.consultation), owner_text: ownerText(a.owner, oid) };
    var input = { title: a.itemTitle.trim() || a.itemId, status: DECISION_STATUS[a.decision] || 'assessing', owner: oid, due: dueOf(a), data: data };
    if (cur && cur.type === 'reg_change' && !isMine(cur)) throw new Error('Id used by another record: ' + id);
    if (cur && cur.archived) return sp.update(id, Object.assign({ archived: false }, input), { replaceData: true, action: 'restore', note: o.note });
    if (cur) return sp.update(id, input, { replaceData: true, note: o.note });
    return sp.create('reg_change', Object.assign({ id: id, src: { module: 'impact', ref: a.itemId } }, input), { action: o.action || 'create', note: o.note, origin: o.origin });
  }

  /* ───────── read the assessments (the page's model) ───────── */
  function read(sp) {
    var out = { assessments: {}, _b: {} };
    sp.list('reg_change').filter(isMine).forEach(function (e) {
      var a = norm(e.data && e.data.assessment);
      if (!a) return;
      // the board may have changed the owner, status or date: those win over the copy held in data.assessment
      var oid = e.owner ? sp.get(e.owner) : null;
      if (oid) a.owner = oid.title; else if (e.data && e.data.owner_text) a.owner = str(e.data.owner_text);
      out.assessments[a.itemId] = a;
      out._b[a.itemId] = stable(a);
    });
    return out;
  }

  /* ───────── write back only what changed; assessments that vanished are archived, never deleted ───────── */
  function commit(sp, R) {
    var errors = [], seen = {};
    Object.keys(R.assessments).forEach(function (k) {
      var a = norm(R.assessments[k]);
      if (!a) return;
      seen[a.itemId] = 1;
      var s = stable(a);
      if (R._b[a.itemId] === s && sp.get(eid(a.itemId)) && !sp.get(eid(a.itemId)).archived) return;
      try { write(sp, a, { action: 'create', note: 'Assessment saved' }); R._b[a.itemId] = s; } catch (e) { errors.push(a.itemId + ': ' + e.message); }
    });
    Object.keys(R._b).forEach(function (k) {
      if (seen[k]) return;
      try { var e = sp.get(eid(k)); if (e && isMine(e) && !e.archived) sp.archive(e.id, { note: 'Assessment reset' }); delete R._b[k]; } catch (x) { errors.push(k + ': ' + x.message); }
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
    if (!src || typeof src !== 'object' || Array.isArray(src) || !src.assessments || typeof src.assessments !== 'object') return { status: 'unreadable' };
    var rep = { status: 'migrated', assessments: 0, skipped: 0 };
    Object.keys(src.assessments).forEach(function (k) {
      var a = norm(src.assessments[k]);
      if (!a) { rep.skipped++; return; }
      var cur = sp.get(eid(a.itemId));
      if (cur) { rep.skipped++; return; }                          // already imported (an interrupted run) or written since
      write(sp, a, { action: 'import', note: 'Imported from the old assessments on this device' });
      rep.assessments++;
    });
    sp.setSetting(DONE, { at: new Date().toISOString(), source: KEY, assessments: rep.assessments });
    sp.log('import', null, 'Change impact: ' + rep.assessments + ' assessments imported from this device. The old data is kept as a backup.');
    return rep;
  }

  return { KEY: KEY, DONE: DONE, DECISION_STATUS: DECISION_STATUS, migrate: migrate, read: read, commit: commit, norm: norm, entityId: eid };
});
