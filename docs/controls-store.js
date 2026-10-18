/* ═══════════════════════════════════════════════════════════════
   RegRadar: the controls library on the data spine (docs/rr-core.js)

   docs/controls-data.js keeps its interface (load, addControl,
   updateControl, removeControl, mapControl, unmapControl, recordTest,
   coverage, nextDue, isOverdue) and calls this file for storage:

     control (CTL:<id>)  -> entity type 'control' (workflow draft, pending
                            review, approved, retired); frequency, type,
                            last tested, effectiveness in data; the next
                            test is entity.due, computed from the spine
                            config (control_frequency_days) for approved
                            controls
     mapping control <-> obligation -> typed link 'mitigates'
     test record        -> entity type 'test' (TST:<id>:<n>), status = the
                            result, linked 'tests' to its control, with note
                            and evidence
     owner              -> a team member when the name reads like a person,
                            plain text (data.owner_text) otherwise
     status changes, edits, tests -> the append-only event log

   MIGRATION (once, idempotent): migrate() seeds the shipped library
   (docs/data/controls.json) and applies what this device kept under the
   old key 'regradar-controls-mine' (own controls, edits, mappings added or
   removed, test log). The old key is only READ (it stays as a backup) and
   the spine setting 'migrated.controls' marks it done. Records the bridge
   mirrored earlier keep their ids and are adopted. syncLibrary() adds
   library controls that the repo gained later; it never touches existing
   ones. No DOM; runs in the browser and in Node (tests).
   ═══════════════════════════════════════════════════════════════ */
(function (root, factory) {
  var RR = (typeof module === 'object' && module.exports) ? require('./rr-core.js') : root.RR;
  var Store = factory(RR);
  if (typeof module === 'object' && module.exports) module.exports = Store; else root.ControlsStore = Store;
  if (RR && RR.migrations && !RR.migrations.some(function (m) { return m.id === 'controls'; })) {
    RR.migrations.push({ id: 'controls', label: 'Controls', order: 10, run: Store.migrate });
  }
})(typeof self !== 'undefined' ? self : this, function (RR) {
  'use strict';

  var KEY = 'regradar-controls-mine';       // the old, module-owned key (backup, never written here)
  var DONE = 'migrated.controls';           // spine setting: the one-time import has happened
  var LIB = 'controls.library';             // spine setting: library control ids already imported
  var KNOWN = ['id', 'name', 'owner', 'frequency', 'type', 'status', 'last_tested', 'effectiveness', 'source', 'obligation_ids'];
  var RESULTS = ['effective', 'needs_improvement', 'failed'];
  var DEFAULT_DAYS = { Monthly: 30, Quarterly: 91, Annual: 365 };

  function str(v) { return v == null ? '' : String(v); }
  function clone(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }
  function validDate(s) { return RR.dates.valid(str(s).slice(0, 10)) ? str(s).slice(0, 10) : ''; }
  function eid(cid) { return 'CTL:' + cid; }
  function cidOf(e) { return (e.data && e.data.ref) || String(e.id).replace(/^CTL:/, ''); }
  function has(a, v) { return a.indexOf(v) !== -1; }
  function days(sp, freq) { var f = (sp.config().control_frequency_days || DEFAULT_DAYS)[freq]; return f || null; }
  function dueFor(sp, status, freq, last) {
    var d = days(sp, freq), l = validDate(last);
    return status === 'approved' && d && l ? RR.dates.addDays(l, d) : null;
  }
  function options(sp, field) { var f = (sp.typeDef('control').fields || []).filter(function (x) { return x.id === field; })[0]; return (f && f.options) || null; }
  function statusOk(sp, s) { return !!sp.stateDef('control', s); }
  function ownerOf(sp, name) { return RR.owners.resolve(sp, name, 'Found in Controls'); }
  function ownerText(name, id) { var n = str(name).trim(); return id || !n || /^unassigned$/i.test(n) ? '' : n; }

  /* One control as the page-shaped object (what ControlsData hands to its callers) -> entity pieces. */
  function pieces(sp, c, order) {
    var extra = {}, data;
    Object.keys(c).forEach(function (k) { if (KNOWN.indexOf(k) === -1 && k.indexOf('__') !== 0) extra[k] = c[k]; });
    var freq = str(c.frequency), type = str(c.type), st = str(c.status);
    var fo = options(sp, 'frequency'), to = options(sp, 'control_type');
    if (freq && fo && !has(fo, freq)) { extra.frequency = freq; freq = ''; }
    if (type && to && !has(to, type)) { extra.type = type; type = ''; }
    var okSt = statusOk(sp, st), status = okSt ? st : 'draft';
    if (!okSt && st) extra.status = st;
    var oid = ownerOf(sp, c.owner);
    data = { ref: c.id, frequency: freq, control_type: type, last_tested: validDate(c.last_tested), effectiveness: str(c.effectiveness), source: str(c.source) || 'manual',
      owner_text: ownerText(c.owner, oid), order: order, extra: Object.keys(extra).length ? extra : null, lib_obligations: c.__lib || null };
    data.date_source = dueFor(sp, status, freq, data.last_tested) ? 'last tested ' + data.last_tested + ' + ' + freq + ' cycle (config control_frequency_days)' : '';
    return { title: str(c.name).trim() || c.id, status: status, owner: oid, due: dueFor(sp, status, freq, data.last_tested), data: data };
  }
  function syncMappings(sp, id, ids) {
    var cur = sp.links(id, 'mitigates', 'out').filter(function (l) { return l.to.indexOf('OBL:') === 0; }), want = {}, have = {}, unresolved = [];
    ids.forEach(function (o) { want['OBL:' + o] = o; });
    cur.forEach(function (l) { if (!want[l.to]) sp.unlink(l.id, { silent: true }); else have[l.to] = 1; });
    Object.keys(want).forEach(function (t) {
      if (have[t]) return;
      if (sp.get(t)) { try { sp.link('mitigates', id, t, { silent: true }); return; } catch (e) { /* fall through */ } }
      unresolved.push(want[t]);
    });
    return unresolved;
  }
  // Create (or adopt a mirrored copy of) one control with its obligations.
  function putControl(sp, c, order, o) {
    var id = eid(c.id), cur = sp.get(id), p = pieces(sp, c, order);
    var un = null;
    if (cur && cur.type === 'control' && !cur.archived && String(cur.origin).indexOf('module:') !== 0) return { skipped: true };
    if (cur && String(cur.origin || '').indexOf('module:') === 0) {
      sp.adopt(id);
      var ids0 = (c.obligation_ids || []);
      p.data.unresolved_obligations = null;
      sp.update(id, { title: p.title, status: p.status, owner: p.owner, due: p.due, archived: false, data: p.data }, { replaceData: true, action: 'import', note: o.note });
      un = syncMappings(sp, id, ids0);
    } else if (cur && cur.archived) {
      sp.update(id, { title: p.title, status: p.status, owner: p.owner, due: p.due, archived: false, data: p.data }, { replaceData: true, action: 'restore', note: o.note });
      un = syncMappings(sp, id, c.obligation_ids || []);
    } else {
      sp.create('control', { id: id, title: p.title, status: p.status, owner: p.owner, due: p.due, data: p.data, src: { module: 'controls', ref: c.id } }, { action: o.action || 'create', note: o.note });
      un = syncMappings(sp, id, c.obligation_ids || []);
    }
    if (un && un.length) sp.update(id, { data: { unresolved_obligations: un } }, { action: 'sync' });
    return { created: true };
  }
  function nextTestIndex(sp, cid) {
    var m = -1;
    sp.list('test', { archived: true }).forEach(function (t) { var x = /^TST:(.+):(\d+)$/.exec(t.id); if (x && x[1] === cid) m = Math.max(m, +x[2]); });
    return m + 1;
  }
  function putTest(sp, cid, k, t, controlTitle, o) {
    var id = 'TST:' + cid + ':' + k, cur = sp.get(id);
    var res = has(RESULTS, t.result) ? t.result : 'effective';
    var data = { tested_on: validDate(t.date), note: str(t.note), evidence: str(t.evidence), control: cid };
    if (cur && String(cur.origin || '').indexOf('module:') === 0) {
      sp.adopt(id);
      sp.update(id, { title: 'Test of ' + controlTitle, status: res, data: data }, { replaceData: true, action: 'import', note: o.note });
    } else if (cur) { return false; }
    else sp.create('test', { id: id, title: 'Test of ' + controlTitle, status: res, data: data, src: { module: 'controls', ref: cid + '#' + k } }, { action: o.action || 'create', note: o.note });
    try { sp.link('tests', id, eid(cid), { silent: true }); } catch (e) { /* the control is always written first */ }
    return true;
  }

  /* ───────── read ───────── */
  function viewControl(sp, e) {
    var d = e.data || {}, ex = d.extra || {}, un = d.unresolved_obligations || [], lib = d.lib_obligations || [];
    var ids = sp.links(e.id, 'mitigates', 'out').filter(function (l) { return l.to.indexOf('OBL:') === 0; }).map(function (l) { return l.to.slice(4); });
    un.forEach(function (x) { if (ids.indexOf(x) === -1) ids.push(x); });
    // the library's own order first (a mapping removed and drawn again returns to its place), then the rest
    ids.sort(function (a, b) { var ia = lib.indexOf(a), ib = lib.indexOf(b); return (ia === -1 ? 1e6 : ia) - (ib === -1 ? 1e6 : ib); });
    var c = { id: cidOf(e), name: e.title, owner: (e.owner && sp.get(e.owner) ? sp.get(e.owner).title : '') || str(d.owner_text) || 'Unassigned',
      frequency: str(d.frequency) || str(ex.frequency), type: str(d.control_type) || str(ex.type), status: ex.status && e.status === 'draft' ? ex.status : e.status,
      last_tested: validDate(d.last_tested) || null, effectiveness: str(d.effectiveness) || 'not_tested', source: str(d.source) || 'manual', obligation_ids: ids };
    Object.keys(ex).forEach(function (k) { if (!(k in c)) c[k] = ex[k]; });
    return c;
  }
  function read(sp) {
    var ents = sp.list('control').sort(function (a, b) {
      var oa = a.data && a.data.order != null ? a.data.order : 1e9, ob = b.data && b.data.order != null ? b.data.order : 1e9;
      return oa - ob || (a.id < b.id ? -1 : 1);
    });
    var controls = ents.map(function (e) { return viewControl(sp, e); }), tests = {};
    ents.forEach(function (e) {
      var list = sp.linked(e.id, 'tests', 'in').filter(function (t) { return t.type === 'test'; }).sort(function (a, b) {
        var ka = +(/:(\d+)$/.exec(a.id) || [0, 0])[1], kb = +(/:(\d+)$/.exec(b.id) || [0, 0])[1]; return kb - ka;
      });
      if (list.length) tests[cidOf(e)] = list.map(function (t) { return { date: str(t.data.tested_on), result: t.status, note: str(t.data.note), evidence: str(t.data.evidence) }; });
    });
    return { controls: controls, tests: tests };
  }

  /* ───────── write (what ControlsData's mutators call) ───────── */
  function need(sp, cid) { var e = sp.get(eid(cid)); if (!e || e.type !== 'control' || e.archived) throw new Error('Unknown control: ' + cid); return e; }
  function addControl(sp, control) {
    var order = 1000;
    sp.list('control').forEach(function (e) { if (e.data && e.data.order != null) order = Math.max(order, e.data.order + 1); });
    var c = Object.assign({ source: 'local' }, control, { source: 'local' });
    putControl(sp, c, order, { note: 'Added in the Compliance workspace' });
    return control;
  }
  function updateControl(sp, cid, patch) {
    var e = need(sp, cid), d = e.data || {}, ex = Object.assign({}, d.extra || {});
    var next = { frequency: str(d.frequency) || str(ex.frequency), last_tested: d.last_tested || '', status: e.status };
    var up = {}, data = {}, changedExtra = false;
    Object.keys(patch).forEach(function (k) {
      var v = patch[k];
      if (k === 'name') up.title = str(v).trim() || e.title;
      else if (k === 'owner') { var oid = ownerOf(sp, v); up.owner = oid; data.owner_text = ownerText(v, oid); }
      else if (k === 'status') { if (statusOk(sp, v)) { up.status = v; next.status = v; if (ex.status) { delete ex.status; changedExtra = true; } } else { ex.status = v; changedExtra = true; } }
      else if (k === 'frequency') { var fo = options(sp, 'frequency'); if (!fo || has(fo, v)) { data.frequency = v; next.frequency = v; if (ex.frequency) { delete ex.frequency; changedExtra = true; } } else { ex.frequency = v; data.frequency = ''; changedExtra = true; } }
      else if (k === 'type') { var to = options(sp, 'control_type'); if (!to || has(to, v)) { data.control_type = v; if (ex.type) { delete ex.type; changedExtra = true; } } else { ex.type = v; data.control_type = ''; changedExtra = true; } }
      else if (k === 'last_tested') { data.last_tested = validDate(v); next.last_tested = data.last_tested; }
      else if (k === 'effectiveness') data.effectiveness = str(v);
      else if (k !== 'id' && k !== 'obligation_ids' && k !== 'source') { ex[k] = v; changedExtra = true; }
    });
    if (changedExtra) data.extra = Object.keys(ex).length ? ex : null;
    up.due = dueFor(sp, next.status, next.frequency, next.last_tested);
    if ('last_tested' in data || 'frequency' in data || up.status) data.date_source = up.due ? 'last tested ' + next.last_tested + ' + ' + next.frequency + ' cycle (config control_frequency_days)' : '';
    if (Object.keys(data).length) up.data = data;
    sp.update(e.id, up, {});
  }
  function removeControl(sp, cid) {
    var e = sp.get(eid(cid));
    if (!e || e.type !== 'control' || e.archived) return;
    if (str(e.data && e.data.source) !== 'local') return;                         // the shipped library cannot be removed (as before)
    sp.linked(e.id, 'tests', 'in').forEach(function (t) { sp.archive(t.id, { note: 'Control removed' }); });
    sp.archive(e.id, { note: 'Removed in the Compliance workspace' });
  }
  function mapControl(sp, oid, cid) {
    var e = need(sp, cid), un = (e.data.unresolved_obligations || []).filter(function (x) { return x !== oid; });
    if (sp.get('OBL:' + oid)) {
      sp.link('mitigates', e.id, 'OBL:' + oid);
      if (un.length !== (e.data.unresolved_obligations || []).length) sp.update(e.id, { data: { unresolved_obligations: un.length ? un : null } }, { action: 'sync' });
    } else if ((e.data.unresolved_obligations || []).indexOf(oid) === -1) sp.update(e.id, { data: { unresolved_obligations: un.concat(oid) } }, { action: 'sync' });
  }
  function unmapControl(sp, oid, cid) {
    var e = sp.get(eid(cid)); if (!e || e.archived) return;
    sp.links(e.id, 'mitigates', 'out').filter(function (l) { return l.to === 'OBL:' + oid; }).forEach(function (l) { sp.unlink(l.id); });
    var un = e.data.unresolved_obligations || [];
    if (un.indexOf(oid) !== -1) { var n = un.filter(function (x) { return x !== oid; }); sp.update(e.id, { data: { unresolved_obligations: n.length ? n : null } }, { action: 'sync' }); }
  }
  function recordTest(sp, cid, result, note, evidence) {
    var e = need(sp, cid), date = new Date().toISOString().slice(0, 10);
    if (!has(RESULTS, result)) result = 'effective';
    putTest(sp, cid, nextTestIndex(sp, cid), { date: date, result: result, note: note, evidence: evidence }, e.title, { action: 'create', note: 'Test logged: ' + result.replace(/_/g, ' ') + (note ? '. ' + note : '') });
    updateControl(sp, cid, { last_tested: date, effectiveness: result });
    return date;
  }

  /* ───────── library: the shipped controls, once and when the repo adds more ───────── */
  function libraryList(base) { return (base && base.controls) || []; }
  function syncLibrary(sp, base) {
    var seen = sp.getSetting(LIB) || [], add = [], order = 0;
    libraryList(base).forEach(function (c, k) {
      if (has(seen, c.id) || sp.get(eid(c.id))) return;
      add.push([c, k]);
    });
    if (!add.length) return 0;
    add.forEach(function (x) { putControl(sp, withLib(x[0]), x[1], { action: 'import', note: 'Controls library (shipped demo data)' }); });
    sp.setSetting(LIB, seen.concat(add.map(function (x) { return x[0].id; })));
    void order;
    return add.length;
  }
  function withLib(c) { return Object.assign({}, c, { __lib: (c.obligation_ids || []).slice() }); }

  /* ───────── the one-time import from the old localStorage key ───────── */
  function migrate(sp, read0, ref) {
    if (sp.getSetting(DONE)) return { status: 'already' };
    var base = ref && ref.controls && Array.isArray(ref.controls.controls) ? ref.controls : null;
    var raw;
    try { raw = read0(KEY); } catch (e) { return { status: 'blocked' }; }
    var local = null;
    if (raw != null && raw !== '') {
      try { local = JSON.parse(raw); } catch (e) { return { status: 'unreadable' }; }
      if (!local || typeof local !== 'object' || Array.isArray(local)) return { status: 'unreadable' };
    }
    if (!base) return { status: 'deferred' };               // the library could not be loaded: try again next time
    var L = Object.assign({ extra: [], extraMappings: {}, removedMappings: {}, overrides: {}, tests: {} }, local || {});
    // the same merge the old ControlsData.load() did
    var list = base.controls.map(function (c) { return Object.assign({}, c, { obligation_ids: (c.obligation_ids || []).slice(), __lib: (c.obligation_ids || []).slice() }); })
      .concat((Array.isArray(L.extra) ? L.extra : []).map(function (c) { return Object.assign({}, c, { source: 'local', obligation_ids: (c.obligation_ids || []).slice() }); }));
    var byId = {}; list.forEach(function (c) { byId[c.id] = c; });
    list.forEach(function (c) { Object.assign(c, (L.overrides || {})[c.id] || {}); });
    Object.keys(L.extraMappings || {}).forEach(function (ob) { (L.extraMappings[ob] || []).forEach(function (cid) { var c = byId[cid]; if (c && !has(c.obligation_ids, ob)) c.obligation_ids.push(ob); }); });
    Object.keys(L.removedMappings || {}).forEach(function (ob) { (L.removedMappings[ob] || []).forEach(function (cid) { var c = byId[cid]; if (c) c.obligation_ids = c.obligation_ids.filter(function (x) { return x !== ob; }); }); });
    var rep = { status: local ? 'migrated' : 'seeded', controls: 0, tests: 0, skipped: 0 }, libIds = base.controls.map(function (c) { return c.id; });
    var orderOf = {}; list.forEach(function (c, k) { orderOf[c.id] = c.source === 'local' ? 1000 + k : k; });
    list.forEach(function (c) {
      if (!c || !c.id) return;
      var r = putControl(sp, c, orderOf[c.id], { action: 'import', note: local ? 'Imported from the old controls register on this device' : 'Controls library (shipped demo data)' });
      if (r.skipped) rep.skipped++; else rep.controls++;
    });
    // test log: the old array is newest first; the oldest gets index 0
    Object.keys(L.tests || {}).forEach(function (cid) {
      var arr = Array.isArray(L.tests[cid]) ? L.tests[cid] : [], c = byId[cid];
      if (!c) return;
      for (var k = 0; k < arr.length; k++) if (putTest(sp, cid, k, arr[arr.length - 1 - k], str(c.name) || cid, { action: 'import', note: 'Imported with the control' })) rep.tests++;
    });
    sp.setSetting(LIB, libIds);
    sp.setSetting(DONE, { at: new Date().toISOString(), source: KEY, controls: rep.controls, tests: rep.tests, seeded: !local });
    sp.log('import', null, 'Controls: ' + rep.controls + ' controls and ' + rep.tests + ' tests ' + (local ? 'imported from the old register on this device (kept as a backup)' : 'from the shipped library'));
    return rep;
  }

  /* For code that has no spine (the Ask page): read the migrated controls straight from the spine's storage keys.
     Returns null when the controls have not been migrated on this device yet. */
  function fromStorage(getItem) {
    function json(k) { try { var r = getItem(k); return r ? JSON.parse(r) : null; } catch (e) { return null; } }
    var meta = json('regradar-spine-meta'), ents = json('regradar-spine-entities'), links = json('regradar-spine-links') || {};
    var rec = meta && meta.settings && meta.settings.values && meta.settings.values[DONE];
    if (!rec || !ents) return null;
    var out = [];
    Object.keys(ents).forEach(function (k) {
      var e = ents[k]; if (!e || e.type !== 'control' || e.archived) return;
      var d = e.data || {}, ids = [];
      Object.keys(links).forEach(function (lk) { var l = links[lk]; if (l && l.type === 'mitigates' && l.from === e.id && !l.ended_at && String(l.to).indexOf('OBL:') === 0) ids.push(l.to.slice(4)); });
      (d.unresolved_obligations || []).forEach(function (x) { if (ids.indexOf(x) === -1) ids.push(x); });
      var o = e.owner && ents[e.owner] ? ents[e.owner].title : str(d.owner_text);
      out.push({ id: cidOf(e), name: e.title, owner: o || 'Unassigned', frequency: str(d.frequency), type: str(d.control_type), status: e.status, last_tested: d.last_tested || null,
        effectiveness: str(d.effectiveness) || 'not_tested', source: str(d.source) || 'manual', obligation_ids: ids, __order: d.order != null ? d.order : 1e9 });
    });
    out.sort(function (a, b) { return a.__order - b.__order; });
    out.forEach(function (c) { delete c.__order; });
    return out;
  }

  return { KEY: KEY, DONE: DONE, LIB: LIB, migrate: migrate, syncLibrary: syncLibrary, read: read, addControl: addControl, updateControl: updateControl,
    removeControl: removeControl, mapControl: mapControl, unmapControl: unmapControl, recordTest: recordTest, fromStorage: fromStorage, days: days };
});
