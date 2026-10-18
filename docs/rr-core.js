/* ═══════════════════════════════════════════════════════════════
   RegRadar data spine (Foundation F1): window.RR

   One entity graph for every module. What it holds:
   - typed ENTITIES with stable ids (obligation, control, test, issue,
     action/task, policy, case, assessment, customer file, person,
     training completion, regulatory change, regulation);
   - a typed LINK table (control mitigates obligation, action fixes
     issue, policy implements obligation, ...);
   - an append-only EVENT LOG (who, what, when, which entity), each
     event chained to the previous one by a hash so accidental edits
     show up (an integrity check, not a security control);
   - a small query API: get, list, filter, linked, links, history,
     events, subscribe.

   Configuration over code: entity types, statuses and workflows,
   roles, scales, link types and fields come from
   docs/data/spine/config.json ("configure for your firm").

   Storage goes through an ADAPTER with five methods:
       load(table)            -> Promise<record[]>
       list(table, predicate) -> Promise<record[]>
       save(table, record)    -> Promise   upsert by record.id (not events)
       append(table, record)  -> Promise   insert only; rejects an existing id
       reset()                -> Promise   wipe (device-local adapters only)
   Tables: meta, entities, links, events. Adapters here: memory (tests),
   localStorage (today) and a documented Postgres stub (later; schema in
   docs/data/spine/schema.sql). Queries run on an in-memory copy, so they
   are synchronous; writes go to the adapter in order, in the background
   (RR.flush() waits for them).

   The READ-ONLY BRIDGE (RR.bridge.collect + spine.importModules) reads
   the existing modules' localStorage keys and mirrors them into the
   spine. It never writes or deletes those keys. Mirrored records are
   read-only in the spine until their module is migrated onto it.

   A MIGRATED module leaves the bridge: its records live in the spine
   (writable everywhere), and a one-time, idempotent import (RR.migrations,
   run by RR.boot) copies what the module kept under its old localStorage
   key. The old key is left untouched as a backup. Migrated so far:
   Issues and actions (docs/actions-store.js).

   No DOM. The only network use is RR.boot() (pages only), which fetches
   same-origin repo JSON. Everything else runs in plain Node (tests).
   ═══════════════════════════════════════════════════════════════ */
(function (root, factory) {
  var RR = factory();
  if (typeof module === 'object' && module.exports) module.exports = RR;
  else root.RR = RR;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var VERSION = '1.0.0';
  var SCHEMA_VERSION = 1;
  var TABLES = ['meta', 'entities', 'links', 'events'];

  /* ───────── small utilities ───────── */
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function clone(o) { return o == null ? o : JSON.parse(JSON.stringify(o)); }
  function deepFreeze(o) {
    if (o && typeof o === 'object' && !Object.isFrozen(o)) {
      Object.freeze(o);
      Object.keys(o).forEach(function (k) { deepFreeze(o[k]); });
    }
    return o;
  }
  function slug(s) {
    return String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'x';
  }
  // Stable JSON: object keys sorted, so equal data always hashes the same.
  function stable(v) {
    if (v === undefined) return 'null';
    if (v === null || typeof v !== 'object') return JSON.stringify(v);
    if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
    return '{' + Object.keys(v).sort().filter(function (k) { return v[k] !== undefined; })
      .map(function (k) { return JSON.stringify(k) + ':' + stable(v[k]); }).join(',') + '}';
  }
  // FNV-1a 32-bit. Fast and dependency-free; NOT cryptographic.
  function fnv(str) {
    var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return ('0000000' + h.toString(16)).slice(-8);
  }

  /* ───────── dates: plain YYYY-MM-DD strings, computed on UTC day numbers ───────── */
  var dates = {
    valid: function (s) { return /^\d{4}-\d{2}-\d{2}$/.test(s || '') && dates.fromDn(dates.dn(s)) === s; },
    dn: function (s) { var p = String(s).slice(0, 10).split('-'); return Math.round(Date.UTC(+p[0], +p[1] - 1, +p[2]) / 864e5); },
    fromDn: function (n) { var d = new Date(n * 864e5); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); },
    today: function () { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); },
    addDays: function (s, n) { return dates.fromDn(dates.dn(s) + n); },
    addMonths: function (s, m) {
      var p = String(s).slice(0, 10).split('-'), y = +p[0], mo = +p[1] - 1 + m, day = +p[2];
      y += Math.floor(mo / 12); mo = ((mo % 12) + 12) % 12;
      var last = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate();
      return y + '-' + pad(mo + 1) + '-' + pad(Math.min(day, last));
    },
    diff: function (a, b) { return dates.dn(a) - dates.dn(b); }, // a minus b, in days
    fmt: function (s) {
      if (!s) return '';
      return new Date(dates.dn(s) * 864e5).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
    },
    // Working days after a date (weekends and the given holidays skipped).
    addWorkingDays: function (s, n, holidays) {
      var d = dates.dn(s), c = 0, h = holidays || [];
      while (c < n) { d++; var w = new Date(d * 864e5).getUTCDay(), iso = dates.fromDn(d); if (w !== 0 && w !== 6 && h.indexOf(iso) === -1) c++; }
      return dates.fromDn(d);
    }
  };

  /* ───────── CSV (formula-injection safe, like the module exports) ───────── */
  function csvCell(v) {
    var s = String(v == null ? '' : v);
    if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = "'" + s; // plain numbers stay numbers
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function csv(rows) { return rows.map(function (r) { return r.map(csvCell).join(','); }).join('\r\n'); }

  /* ═════════════════ adapters ═════════════════ */

  // Shared shape: each table is { id: record } except events (an array).
  // `shared`: storage another tab may also write (localStorage). Each write
  // re-reads the table first so a record written elsewhere is never dropped.
  function tableAdapter(name, readTable, writeTable, wipe, shared) {
    var cache = {};
    function get(t, fresh) {
      if (TABLES.indexOf(t) === -1) throw new Error('Unknown table: ' + t);
      if (!cache[t] || (fresh && shared)) cache[t] = readTable(t) || (t === 'events' ? [] : {});
      return cache[t];
    }
    function rows(t) { var x = get(t); return t === 'events' ? x.slice() : Object.keys(x).map(function (k) { return x[k]; }); }
    function attempt(fn) { try { return Promise.resolve(fn()); } catch (e) { return Promise.reject(e); } }
    return {
      name: name,
      load: function (t) { return attempt(function () { return clone(rows(t)); }); },
      list: function (t, pred) { return attempt(function () { var r = clone(rows(t)); return pred ? r.filter(pred) : r; }); },
      save: function (t, rec) {
        return attempt(function () {
          if (t === 'events') throw new Error('The event log is append-only: use append().');
          if (!rec || !rec.id) throw new Error('A record needs an id.');
          var tbl = get(t, true); tbl[rec.id] = clone(rec); writeTable(t, tbl);
        });
      },
      append: function (t, rec) {
        return attempt(function () {
          if (t !== 'events') throw new Error('append() is only for the event log.');
          var ev = get(t, true);
          for (var i = ev.length - 1; i >= 0; i--) if (ev[i].id === rec.id) throw new Error('Event ' + rec.id + ' already exists: the log is append-only.');
          ev.push(clone(rec)); writeTable(t, ev);
        });
      },
      reset: function () { return attempt(function () { cache = {}; wipe(); }); }
    };
  }

  // In-memory adapter (tests, private windows). `seed` is an exportAll() dump.
  function memoryAdapter(seed) {
    var store = {};
    function init() {
      store = { meta: {}, entities: {}, links: {}, events: [] };
      if (seed) {
        ['meta', 'entities', 'links'].forEach(function (t) { (seed[t] || []).forEach(function (r) { store[t][r.id] = clone(r); }); });
        store.events = clone(seed.events || []);
      }
    }
    init();
    var a = tableAdapter('memory', function (t) { return store[t]; }, function (t, v) { store[t] = v; },
      function () { seed = null; init(); });
    a.dump = function () { return clone({ meta: Object.keys(store.meta).map(function (k) { return store.meta[k]; }),
      entities: Object.keys(store.entities).map(function (k) { return store.entities[k]; }),
      links: Object.keys(store.links).map(function (k) { return store.links[k]; }), events: store.events }); };
    return a;
  }

  // Device-local adapter: one localStorage key per table.
  // Keys: regradar-spine-meta, -entities, -links, -events. Nothing else is touched.
  function localStorageAdapter(opts) {
    opts = opts || {};
    var prefix = opts.prefix || 'regradar-spine-';
    var ls = opts.storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!ls) throw new Error('localStorage is not available here.');
    return tableAdapter('localStorage',
      function (t) { var raw = ls.getItem(prefix + t); return raw ? JSON.parse(raw) : null; },
      function (t, v) { ls.setItem(prefix + t, JSON.stringify(v)); },
      function () { TABLES.forEach(function (t) { ls.removeItem(prefix + t); }); }, true);
  }

  /* Postgres adapter: DOCUMENTED STUB, not wired.
     The prototype has no backend (decisions/002-free-prototype-stack.md:
     the owner chooses the host and region). When built it keeps exactly
     the interface above and:
       - talks to a small RegRadar HTTP API, never to the database from
         the browser (decision 002, rule 2), which runs portable SQL
         against docs/data/spine/schema.sql (PostgreSQL 13+, no vendor
         extensions), in an EU region;
       - every call carries the organisation; row-level security keyed by
         org_id does the isolation (decision 002, rule 3);
       - load/list = SELECT ... WHERE org_id = current org;
         save = INSERT ... ON CONFLICT (org_id, id) DO UPDATE;
         append = INSERT into rr_event only (UPDATE and DELETE are
         refused by a trigger and by grants);
         reset is not offered (an organisation's log is never wiped).
     Table mapping: meta -> rr_meta, entities -> rr_entity,
     links -> rr_link, events -> rr_event. */
  function postgresAdapter(opts) {
    var why = 'The Postgres adapter is a stub: no backend is configured yet. See decisions/002-free-prototype-stack.md and docs/data/spine/schema.sql.';
    function no() { return Promise.reject(new Error(why)); }
    return { name: 'postgres (stub)', stub: true, endpoint: (opts && opts.endpoint) || null,
      tables: { meta: 'rr_meta', entities: 'rr_entity', links: 'rr_link', events: 'rr_event' },
      load: no, list: no, save: no, append: no, reset: no };
  }

  /* ═════════════════ reference data (from the repo, read-only, in memory) ═════════════════ */
  var reference = {
    // docs/data/obligations.json -> obligation entities
    obligations: function (json) {
      return ((json && json.obligations) || []).map(function (o) {
        return { id: 'OBL:' + o.id, type: 'obligation', title: o.legal_basis + ': ' + (o.what || '').split('. ')[0].slice(0, 140),
          status: o.status === 'scheduled' ? 'scheduled' : 'in_force', owner: null, due: dates.valid(o.deadline) ? o.deadline : null,
          data: { ref: o.id, legal_basis: o.legal_basis, topic: o.topic || '', who: o.who || [], priority: o.priority || o.criticality || '',
            source_url: o.source_url || '', date_source: 'docs/data/obligations.json (' + o.legal_basis + ', "deadline")' } };
      });
    },
    // docs/data/applicability.json -> regulation entities, with the firm-type verdicts
    regulations: function (json) {
      return ((json && json.regulations) || []).map(function (r) {
        return { id: 'REG:' + slug(r.id), type: 'regulation', title: r.name + (r.full_name ? ' (' + r.full_name + ')' : ''),
          status: 'in_force', owner: null, due: dates.valid(r.applies_from) ? r.applies_from : null,
          data: { ref: r.id, name: r.name, full_name: r.full_name || '', celex: r.celex || '', applies: r.applies || {}, notes: r.notes || {},
            date_source: 'docs/data/applicability.json (' + r.name + ', "applies_from")' } };
      });
    },
    // docs/data/items.json (RegWatch) -> regulatory change entities; `due` only when the feed states a deadline
    regChanges: function (items) {
      return (Array.isArray(items) ? items : []).map(function (it) {
        var dl = String(it.deadline || '').slice(0, 10);
        return { id: 'RC:' + it.id, type: 'reg_change', title: it.title || it.id, status: 'new', owner: null, due: dates.valid(dl) ? dl : null,
          data: { source: it.source || '', url: it.url || '', published: String(it.date || '').slice(0, 10), impact: it.impact || 0,
            date_source: dates.valid(dl) ? 'docs/data/items.json (RegWatch "deadline")' : '' } };
      });
    }
  };

  /* ═════════════════ the read-only bridge ═════════════════ */
  var MODULES = [
    { id: 'controls', key: 'regradar-controls-mine', label: 'Controls (Compliance workspace)', page: 'workspace.html?view=controls' },
    { id: 'policies', key: 'regradar-policies', label: 'Policies', page: 'policies.html' },
    { id: 'cases', key: 'regradar-cases', label: 'Cases and STR', page: 'cases.html' },
    { id: 'bwra', key: 'regradar-bwra', label: 'Business risk', page: 'risk-assessment.html' },
    { id: 'cra', key: 'regradar-cra', label: 'Customer risk', page: 'customer-risk.html' },
    { id: 'impact', key: 'regradar-impact', label: 'Change impact', page: 'impact.html' },
    { id: 'obligations', key: 'regradar-obligations-mine', label: 'Obligations (your notes)', page: 'workspace.html' },
    { id: 'profile', key: 'regradar-profile', label: 'Firm profile', page: 'workspace.html' },
    { id: 'academy', key: 'regradar-academy-training', label: 'Academy training', page: 'academy.html' }
  ];
  // Modules that have moved onto the spine: no longer bridged, but still named in records and the log.
  var MIGRATED = [
    { id: 'actions', key: 'regradar-actions', label: 'Issues and actions', page: 'actions.html', migrated: true }
  ];
  function moduleById(id) {
    var i;
    for (i = 0; i < MODULES.length; i++) if (MODULES[i].id === id) return MODULES[i];
    for (i = 0; i < MIGRATED.length; i++) if (MIGRATED[i].id === id) return MIGRATED[i];
    return null;
  }

  function guessRole(text, cfg) {
    var t = String(text || '').toLowerCase(), kw = (cfg && cfg.role_keywords) || {};
    var order = Object.keys(kw).filter(function (k) { return k[0] !== '_'; });
    for (var i = 0; i < order.length; i++) {
      var words = kw[order[i]] || [];
      for (var j = 0; j < words.length; j++) if (t.indexOf(words[j]) !== -1) return order[i];
    }
    return '';
  }

  /* collect(read, ref, cfg, today): PURE. `read(key)` returns the raw string
     stored under a key (or null). Nothing is ever written. Returns the
     records the spine should mirror, plus overlays for reference data. */
  function collect(read, ref, cfg, today) {
    ref = ref || {}; cfg = cfg || {}; today = today || dates.today();
    var out = { entities: [], links: [], people: [], overlay: { obligations: {}, firm_type: '' }, report: [] };
    var people = {};
    var bmap = cfg.bridge || {};
    var freq = cfg.control_frequency_days || {};

    function parse(m) {
      var raw = null;
      try { raw = read(m.key); } catch (e) { return { found: false, error: 'storage blocked' }; }
      if (raw == null || raw === '') return { found: false };
      try { return { found: true, value: JSON.parse(raw) }; } catch (e) { return { found: true, error: 'unreadable JSON' }; }
    }
    function person(name, hints) {
      var n = String(name || '').trim();
      if (!n || /^unassigned$/i.test(n)) return null;
      var id = 'person:' + slug(n);
      if (!people[id]) {
        people[id] = { id: id, type: 'person', title: n, status: 'active', owner: null, due: null,
          data: { role: guessRole((hints && hints.role) || n, cfg), job_title: (hints && hints.role) || '', team: (hints && hints.team) || '' },
          src: { module: hints && hints.module, ref: n } };
      } else if (hints && hints.role && !people[id].data.job_title) {
        people[id].data.job_title = hints.role; people[id].data.role = people[id].data.role || guessRole(hints.role, cfg);
      }
      return id;
    }
    function add(m, e, ref2) {
      e.origin = 'module:' + m.id; e.src = { module: m.id, key: m.key, ref: ref2 };
      e.owner = e.owner || null; e.due = dates.valid(e.due) ? e.due : null; e.data = e.data || {};
      out.entities.push(e);
    }
    function link(type, from, to, m) { out.links.push({ type: type, from: from, to: to, module: m.id }); }
    function report(m, r, n, note) { out.report.push({ module: m.id, key: m.key, label: m.label, page: m.page, found: !!r.found, error: r.error || '', records: n || 0, note: note || '' }); }

    /* controls: docs/data/controls.json plus the device overlay (same merge as controls-data.js) */
    (function () {
      var m = moduleById('controls'), r = parse(m), n = 0;
      var local = Object.assign({ extra: [], extraMappings: {}, removedMappings: {}, overrides: {}, tests: {} }, (r.value && typeof r.value === 'object') ? r.value : {});
      var base = (ref.controls && ref.controls.controls) || [];
      if (!base.length && !r.found) { report(m, r, 0, 'no controls library loaded'); return; }
      var list = base.map(function (c) { return Object.assign({}, c, { obligation_ids: (c.obligation_ids || []).slice() }); })
        .concat((local.extra || []).map(function (c) { return Object.assign({}, c, { source: 'local', obligation_ids: (c.obligation_ids || []).slice() }); }));
      var byId = {}; list.forEach(function (c) { byId[c.id] = c; });
      list.forEach(function (c) { Object.assign(c, (local.overrides || {})[c.id] || {}); });
      Object.keys(local.extraMappings || {}).forEach(function (ob) { (local.extraMappings[ob] || []).forEach(function (cid) { var c = byId[cid]; if (c && c.obligation_ids.indexOf(ob) === -1) c.obligation_ids.push(ob); }); });
      Object.keys(local.removedMappings || {}).forEach(function (ob) { (local.removedMappings[ob] || []).forEach(function (cid) { var c = byId[cid]; if (c) c.obligation_ids = c.obligation_ids.filter(function (x) { return x !== ob; }); }); });
      list.forEach(function (c) {
        var days = freq[c.frequency], due = days && dates.valid(c.last_tested) ? dates.addDays(c.last_tested, days) : null;
        var id = 'CTL:' + c.id;
        add(m, { id: id, type: 'control', title: c.name || c.id, status: (bmap.control_status || {})[c.status] || 'draft',
          owner: person(c.owner, { module: m.id }), due: c.status === 'approved' ? due : null,
          data: { ref: c.id, frequency: c.frequency || '', control_type: c.type || '', last_tested: c.last_tested || '', effectiveness: c.effectiveness || '',
            date_source: due ? 'last tested ' + c.last_tested + ' + ' + c.frequency + ' cycle (config control_frequency_days)' : '' } }, c.id);
        n++;
        (c.obligation_ids || []).forEach(function (ob) { link('mitigates', id, 'OBL:' + ob, m); });
        var tests = (local.tests || {})[c.id] || [];
        tests.forEach(function (t, i) {
          var k = tests.length - 1 - i, tid = 'TST:' + c.id + ':' + k;
          add(m, { id: tid, type: 'test', title: 'Test of ' + (c.name || c.id), status: ['effective', 'needs_improvement', 'failed'].indexOf(t.result) !== -1 ? t.result : 'effective',
            data: { tested_on: t.date || '', note: t.note || '' } }, c.id + '#' + k);
          link('tests', tid, id, m); n++;
        });
      });
      report(m, r, n, r.found ? '' : 'library from docs/data/controls.json; no device changes');
    })();

    /* policies (staff, versions, review cycle) */
    (function () {
      var m = moduleById('policies'), r = parse(m), n = 0, st = r.value;
      if (!r.found || r.error || !st || !Array.isArray(st.policies)) { report(m, r, 0); return; }
      (st.staff || []).forEach(function (s) { person(s.name, { module: m.id, role: s.role, team: s.team }); });
      st.policies.forEach(function (p) {
        var vs = p.versions || [], live = null, latest = null, k;
        for (k = vs.length - 1; k >= 0; k--) if (vs[k].status === 'approved') { live = vs[k]; break; }
        for (k = vs.length - 1; k >= 0; k--) if (vs[k].status !== 'withdrawn') { latest = vs[k]; break; }
        var status = p.retired ? 'retired' : (latest && latest.status === 'in_review') ? 'in_review' : live ? 'approved' : 'draft';
        var due = (!p.retired && live && dates.valid(String(p.lastReviewed || '').slice(0, 10))) ? dates.addMonths(String(p.lastReviewed).slice(0, 10), p.cycleMonths || 12) : null;
        var id = 'POL:' + p.id;
        add(m, { id: id, type: 'policy', title: p.title || p.id, status: (bmap.policy_status || {})[status] || status,
          owner: person(p.owner, { module: m.id }), due: due,
          data: { ref: p.ref || p.id, cycle_months: p.cycleMonths || 12, live_version: live ? live.ver : '', pending_version: latest && latest.status === 'in_review' ? latest.ver : '',
            approver: p.approver || '', date_source: due ? 'last reviewed ' + String(p.lastReviewed).slice(0, 10) + ' + ' + (p.cycleMonths || 12) + '-month cycle (Policies page)' : '' } }, p.id);
        n++;
        (p.obligation_ids || []).forEach(function (ob) { link('implements', id, 'OBL:' + ob, m); });
      });
      report(m, r, n);
    })();

    /* cases (decision target in working days, as set on the Cases page) */
    (function () {
      var m = moduleById('cases'), r = parse(m), n = 0, db = r.value;
      if (!r.found || r.error || !db || !Array.isArray(db.cases)) { report(m, r, 0); return; }
      var s = db.settings || {}, caseDays = +s.caseDays || 10, hol = s.holidays || [];
      (s.team || []).forEach(function (nm) { person(nm, { module: m.id }); });
      db.cases.forEach(function (c) {
        var opened = String(c.openedAt || '').slice(0, 10), open = ['open', 'review', 'mlro'].indexOf(c.status) !== -1;
        var due = open && dates.valid(opened) ? dates.addWorkingDays(opened, caseDays, hol) : null;
        add(m, { id: 'CASE:' + c.id, type: 'case', title: c.title || c.id, status: c.status || 'open', owner: person(c.assignee, { module: m.id }), due: due,
          data: { ref: c.id, priority: c.priority || '', typology: c.typology || '', opened_on: opened,
            date_source: due ? 'opened ' + opened + ' + ' + caseDays + ' working days (Cases page setting)' : '' } }, c.id);
        n++;
      });
      report(m, r, n);
    })();

    /* business-wide risk assessment */
    (function () {
      var m = moduleById('bwra'), r = parse(m), S = r.value;
      if (!r.found || r.error || !S || typeof S !== 'object') { report(m, r, 0); return; }
      var so = S.signoff || {}, rf = S.refresh || {};
      if (!(S.scenarios || []).length && !so.preparedOn && !so.approvedOn) { report(m, r, 0, 'empty assessment'); return; }
      var status = dates.valid(so.approvedOn) ? 'approved' : dates.valid(so.preparedOn) ? 'in_review' : 'draft';
      var due = dates.valid(rf.due) ? rf.due : (dates.valid(so.approvedOn) ? dates.addMonths(so.approvedOn, +rf.months || 12) : null);
      add(m, { id: 'RA:bwra', type: 'assessment', title: so.label || 'Business-wide risk assessment', status: status,
        owner: person(so.preparedBy, { module: m.id }), due: due,
        data: { kind: 'Business-wide risk assessment', scenarios: (S.scenarios || []).length, approved_by: so.approvedBy || '', demo: !!S.demo,
          date_source: due ? (dates.valid(rf.due) ? 'refresh date set on the Business risk page' : 'approved ' + so.approvedOn + ' + ' + (+rf.months || 12) + ' months') : '' } }, 'bwra');
      report(m, r, 1);
    })();

    /* customer risk files (status from the last decision; review dates stay on that page for now) */
    (function () {
      var m = moduleById('cra'), r = parse(m), S = r.value, n = 0;
      if (!r.found || r.error || !S || !Array.isArray(S.customers)) { report(m, r, 0); return; }
      S.customers.forEach(function (c) {
        var ds = (c.decisions || []).slice().sort(function (a, b) { return a.at < b.at ? -1 : 1; }), ld = ds[ds.length - 1];
        var status = !ld ? 'pending' : ld.decision === 'approve' ? 'approved' : ld.decision === 'reject' ? 'rejected' : 'escalated';
        add(m, { id: 'CRF:' + c.id, type: 'customer_file', title: c.name || c.id, status: status, data: { ref: c.id, demo: !!c.demo, last_decision: ld ? String(ld.at).slice(0, 10) : '' } }, c.id);
        n++;
      });
      report(m, r, n);
    })();

    /* regulatory change assessments (Change impact) */
    (function () {
      var m = moduleById('impact'), r = parse(m), n = 0, st = r.value;
      if (!r.found || r.error || !st || !st.assessments) { report(m, r, 0); return; }
      Object.keys(st.assessments).forEach(function (k) {
        var a = st.assessments[k]; if (!a || !a.itemId) return;
        var due = dates.valid(a.effective) ? a.effective : dates.valid(a.consultation) ? a.consultation : null;
        add(m, { id: 'RC:' + a.itemId, type: 'reg_change', title: a.itemTitle || a.itemId, status: (bmap.impact_status || {})[a.decision || ''] || 'assessing',
          owner: person(a.owner, { module: m.id }), due: due,
          data: { source: a.itemSource || '', url: a.itemUrl || '', published: a.itemDate || '', decision: a.decision || '', priority: a.severity || '',
            effective: a.effective || '', consultation: a.consultation || '',
            date_source: due ? (dates.valid(a.effective) ? 'applies-from date entered on the Change impact page' + (a.effectiveSrc ? ' (' + a.effectiveSrc + ')' : '') : 'consultation date entered on the Change impact page' + (a.consultationSrc ? ' (' + a.consultationSrc + ')' : '')) : '' } }, a.itemId);
        n++;
      });
      report(m, r, n);
    })();

    /* obligations: "not applicable to us", watched, notes -> overlay on reference obligations */
    (function () {
      var m = moduleById('obligations'), r = parse(m), v = r.value || {}, n = 0;
      if (r.found && !r.error) {
        Object.keys(v.dismissed || {}).forEach(function (id) { if (v.dismissed[id]) { (out.overlay.obligations[id] = out.overlay.obligations[id] || {}).applicable = false; n++; } });
        (v.pinned || []).forEach(function (id) { (out.overlay.obligations[id] = out.overlay.obligations[id] || {}).watched = true; n++; });
        Object.keys(v.notes || {}).forEach(function (id) { (out.overlay.obligations[id] = out.overlay.obligations[id] || {}).note = v.notes[id]; n++; });
      }
      report(m, r, n);
    })();

    /* firm profile (firm type) */
    (function () {
      var m = moduleById('profile'), r = parse(m);
      if (r.found && !r.error && r.value && r.value.entity) out.overlay.firm_type = String(r.value.entity);
      report(m, r, out.overlay.firm_type ? 1 : 0);
    })();

    /* Academy completions on this device (the learner is "you, on this device") */
    (function () {
      var m = moduleById('academy'), r = parse(m), n = 0, S = r.value;
      if (!r.found || r.error || !S || !S.modules) { report(m, r, 0); return; }
      Object.keys(S.modules).forEach(function (mid) {
        var x = S.modules[mid]; if (!x || !x.completed) return;
        if (!people['person:me']) people['person:me'] = { id: 'person:me', type: 'person', title: 'You (this device)', status: 'active', owner: null, due: null, data: { role: '', job_title: '', team: '' }, src: { module: m.id, ref: 'device' } };
        var c = x.completed;
        add(m, { id: 'TRN:academy:' + mid, type: 'training', title: 'Academy: ' + ((ref.academyTitles || {})[mid] || mid), status: 'completed', owner: 'person:me',
          data: { module: mid, completed_on: String(c.at || '').slice(0, 10), score: c.max ? c.score + '/' + c.max : '' } }, mid);
        n++;
      });
      report(m, r, n);
    })();

    out.people = Object.keys(people).map(function (k) { return people[k]; });
    return out;
  }

  /* ═════════════════ the spine ═════════════════ */
  function createSpine(opts) {
    opts = opts || {};
    var cfg = opts.config;
    if (!cfg || !cfg.entity_types || !cfg.workflows) throw new Error('RR needs its configuration (docs/data/spine/config.json).');
    var adapter = opts.adapter || memoryAdapter();
    var clock = opts.clock || function () { return new Date().toISOString(); };
    var S = { ents: {}, links: {}, events: [], ref: {}, settings: {}, subs: [], errs: [], seq: 0, lastHash: '0',
      actor: opts.actor || 'person:me', today: dates.valid(opts.today) ? opts.today : dates.today(), queue: Promise.resolve(), saveOk: true, schema: SCHEMA_VERSION };

    /* ---------- config accessors ---------- */
    function typeDef(type) { var t = cfg.entity_types[type]; if (!t) throw new Error('Unknown entity type: ' + type); return t; }
    function states(type) { var w = cfg.workflows[typeDef(type).workflow]; return w ? w.states : []; }
    function stateDef(type, id) { var s = states(type); for (var i = 0; i < s.length; i++) if (s[i].id === id) return s[i]; return null; }
    function linkType(id) { var l = cfg.link_types || []; for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i]; return null; }
    function optionIds(f) {
      if (f.type === 'scale') return ((cfg.scales || {})[f.scale] || []).map(function (x) { return String(x.id); });
      if (f.options_from === 'task_kinds') return (cfg.task_kinds || []).map(function (x) { return x.id; });
      if (f.options_from === 'roles') return [''].concat((cfg.roles || []).map(function (x) { return x.id; }));
      return f.options || null;
    }
    function checkData(type, data) {
      (typeDef(type).fields || []).forEach(function (f) {
        var v = data[f.id];
        if (v == null || v === '') return;
        if (f.type === 'select' || f.type === 'scale') {
          var ids = optionIds(f);
          if (ids && ids.indexOf(String(v)) === -1) throw new Error(typeDef(type).label + ': "' + v + '" is not a valid ' + f.label.toLowerCase() + '.');
        }
        if (f.type === 'date' && !dates.valid(String(v))) throw new Error(f.label + ' must be a date (YYYY-MM-DD).');
        if (f.type === 'number' && !isFinite(v)) throw new Error(f.label + ' must be a number.');
      });
    }

    /* ---------- persistence and the event log ---------- */
    function persist(fn) {
      S.queue = S.queue.then(fn).then(function () { S.saveOk = true; }, function (e) {
        S.saveOk = false;
        S.errs.forEach(function (f) { try { f(e); } catch (x) { /* listener error */ } });
      });
      return S.queue;
    }
    function hashOf(ev) { var c = Object.assign({}, ev); delete c.hash; return fnv(ev.prev + '|' + stable(c)); }
    function logEvent(action, ent, extra) {
      extra = extra || {};
      S.seq++;
      var ev = { id: 'ev-' + Date.parse(clock()).toString(36) + '-' + S.seq, seq: S.seq, at: clock(), actor: extra.actor || S.actor, action: action,
        entity: ent ? ent.id : (extra.entity || null), entity_type: ent ? ent.type : (extra.entity_type || null), title: ent ? ent.title : (extra.title || ''),
        changes: extra.changes || null, link: extra.link || null, note: extra.note || '', prev: S.lastHash };
      ev.hash = hashOf(ev);
      S.lastHash = ev.hash;
      deepFreeze(ev);
      S.events.push(ev);
      persist(function () { return adapter.append('events', ev); });
      S.subs.slice().forEach(function (f) { try { f(ev); } catch (x) { /* listener error */ } });
      return ev;
    }
    function store(ent) {
      deepFreeze(ent);
      S.ents[ent.id] = ent;
      persist(function () { return adapter.save('entities', ent); });
      return ent;
    }
    function storeLink(l) {
      deepFreeze(l);
      S.links[l.id] = l;
      persist(function () { return adapter.save('links', l); });
      return l;
    }
    function saveSettings() {
      var rec = { id: 'settings', values: S.settings };
      persist(function () { return adapter.save('meta', rec); });
    }

    /* ---------- reads ---------- */
    function get(id) { return S.ents[id] || S.ref[id] || null; }
    function all() {
      var out = [], seen = {};
      Object.keys(S.ents).forEach(function (k) { out.push(S.ents[k]); seen[k] = 1; });
      Object.keys(S.ref).forEach(function (k) { if (!seen[k]) out.push(S.ref[k]); });
      return out;
    }
    function category(e) { if (!e) return ''; var s = stateDef(e.type, e.status); return s ? s.category : ''; }
    function matches(e, f) {
      return Object.keys(f).every(function (k) {
        var want = f[k], have;
        if (k === 'category') have = category(e);
        else if (k === 'open') return !!want === (['open', 'review'].indexOf(category(e)) !== -1);
        else if (k === 'archived') return true;
        else if (k.indexOf('data.') === 0) have = e.data ? e.data[k.slice(5)] : undefined;
        else have = e[k];
        return Array.isArray(want) ? want.indexOf(have) !== -1 : have === want;
      });
    }
    function list(type, filter) {
      var types = type == null || type === '*' ? null : (Array.isArray(type) ? type : [type]);
      var f = filter || {};
      var withArchived = typeof f === 'object' && f.archived === true;
      return all().filter(function (e) {
        if (types && types.indexOf(e.type) === -1) return false;
        if (e.archived && !withArchived) return false;
        return typeof f === 'function' ? f(e) : matches(e, f);
      }).sort(function (a, b) { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; });
    }
    function linksOf(id, type, dir) {
      dir = dir || 'both';
      return Object.keys(S.links).map(function (k) { return S.links[k]; }).filter(function (l) {
        if (l.ended_at) return false;
        if (type && l.type !== type) return false;
        return (dir !== 'in' && l.from === id) || (dir !== 'out' && l.to === id);
      });
    }
    function linked(id, type, dir) {
      var e0 = typeof id === 'object' ? id.id : id;
      return linksOf(e0, type, dir).map(function (l) { return get(l.from === e0 ? l.to : l.from); })
        .filter(function (e) { return e && !e.archived; });
    }
    function history(id) {
      var e0 = typeof id === 'object' ? id.id : id;
      return S.events.filter(function (ev) { return ev.entity === e0 || (ev.link && (ev.link.from === e0 || ev.link.to === e0)); });
    }
    function events(f) {
      f = f || {};
      return S.events.filter(function (ev) {
        if (f.actor && ev.actor !== f.actor) return false;
        if (f.action && (Array.isArray(f.action) ? f.action.indexOf(ev.action) === -1 : ev.action !== f.action)) return false;
        if (f.since && ev.at < f.since) return false;
        if (f.entity && ev.entity !== f.entity) return false;
        return true;
      });
    }
    function isWritable(e) { return e && e.origin !== 'reference' && String(e.origin || '').indexOf('module:') !== 0; }
    function readOnlyWhy(e) {
      if (!e) return '';
      if (e.origin === 'reference') return 'Comes from the repository data (read-only).';
      if (String(e.origin || '').indexOf('module:') === 0) {
        var m = moduleById(e.src && e.src.module);
        return 'Managed on the ' + (m ? m.label : 'module') + ' page until that module moves onto the spine.';
      }
      return '';
    }

    /* ---------- writes ---------- */
    function newId(type) {
      var p = typeDef(type).id_prefix || type.toUpperCase();
      var id;
      do { id = p + '-' + Date.parse(clock()).toString(36).slice(-5).toUpperCase() + Math.floor(Math.random() * 1296).toString(36).toUpperCase(); } while (S.ents[id]);
      return id;
    }
    function checkOwner(owner) {
      if (owner == null || owner === '') return null;
      var p = get(owner);
      if (!p || p.type !== 'person') throw new Error('Owner must be a team member (unknown: ' + owner + ').');
      return owner;
    }
    function create(type, input, o) {
      o = o || {};
      var td = typeDef(type);
      if (td.reference) throw new Error(td.label + ' records come from the repository data and cannot be created here.');
      input = input || {};
      var title = String(input.title || '').trim();
      if (!title) throw new Error('A title is required.');
      var id = input.id || newId(type);
      if (S.ents[id] || S.ref[id]) throw new Error('Id already exists: ' + id);
      var status = input.status || (states(type)[0] || {}).id;
      if (!stateDef(type, status)) throw new Error('Unknown status "' + status + '" for ' + td.label.toLowerCase() + '.');
      if (input.due && !dates.valid(input.due)) throw new Error('Due date must be YYYY-MM-DD.');
      var data = clone(input.data || {});
      if (!o._bridge) checkData(type, data);
      var now = clock();
      var ent = { id: id, type: type, title: title, status: status, owner: checkOwner(input.owner), due: input.due || null, data: data,
        origin: o.origin || 'spine', src: input.src || null, src_hash: input.src_hash || null,
        created_at: now, updated_at: now, created_by: S.actor, rev: 1, archived: false };
      store(ent);
      logEvent(o.action || 'create', ent, { note: o.note });
      return ent;
    }
    function diffOf(cur, next) {
      var ch = {};
      ['title', 'status', 'owner', 'due', 'archived'].forEach(function (k) { if (stable(cur[k]) !== stable(next[k])) ch[k] = [cur[k] == null ? null : cur[k], next[k] == null ? null : next[k]]; });
      var keys = {};
      Object.keys(cur.data || {}).concat(Object.keys(next.data || {})).forEach(function (k) { keys[k] = 1; });
      Object.keys(keys).forEach(function (k) { if (stable((cur.data || {})[k]) !== stable((next.data || {})[k])) ch['data.' + k] = [(cur.data || {})[k] == null ? null : cur.data[k], (next.data || {})[k] == null ? null : next.data[k]]; });
      return ch;
    }
    function update(id, patch, o) {
      o = o || {};
      var cur = S.ents[id];
      if (!cur) { if (S.ref[id]) throw new Error(readOnlyWhy(S.ref[id])); throw new Error('Not found: ' + id); }
      if (!o._bridge && !isWritable(cur)) throw new Error(readOnlyWhy(cur));
      patch = patch || {};
      var next = clone(cur);
      if ('title' in patch) { next.title = String(patch.title || '').trim(); if (!next.title) throw new Error('A title is required.'); }
      if ('status' in patch) { if (!stateDef(cur.type, patch.status)) throw new Error('Unknown status "' + patch.status + '".'); next.status = patch.status; }
      if ('owner' in patch) next.owner = checkOwner(patch.owner);
      if ('due' in patch) { if (patch.due && !dates.valid(patch.due)) throw new Error('Due date must be YYYY-MM-DD.'); next.due = patch.due || null; }
      if ('archived' in patch) next.archived = !!patch.archived;
      if (patch.data) {
        next.data = o.replaceData ? clone(patch.data) : Object.assign({}, cur.data, clone(patch.data));
        if (!o._bridge) checkData(cur.type, next.data);
      }
      if ('src_hash' in patch) next.src_hash = patch.src_hash;
      var ch = diffOf(cur, next);
      if (!Object.keys(ch).length && !('src_hash' in patch)) return cur;
      next.rev = (cur.rev || 1) + 1; next.updated_at = clock();
      store(next);
      var keys = Object.keys(ch), action = o.action;
      if (!action) action = keys.length === 1 && keys[0] === 'status' ? 'move' : keys.length === 1 && keys[0] === 'owner' ? 'assign' : keys.length === 1 && keys[0] === 'archived' ? (next.archived ? 'archive' : 'restore') : 'update';
      if (keys.length || o.action) logEvent(action, next, { changes: keys.length ? ch : null, note: o.note });
      return next;
    }
    function link(type, from, to, o) {
      o = o || {};
      var lt = linkType(type); if (!lt) throw new Error('Unknown link type: ' + type);
      var a = get(from), b = get(to);
      if (!a || !b) throw new Error('Both ends of a link must exist (' + from + ' -> ' + to + ').');
      if (lt.from.indexOf(a.type) === -1 || lt.to.indexOf(b.type) === -1) throw new Error('A ' + a.type + ' cannot "' + lt.label + '" a ' + b.type + '.');
      if (!o._bridge && !isWritable(a)) throw new Error(readOnlyWhy(a));
      var id = 'L:' + type + ':' + from + '>' + to, cur = S.links[id];
      if (cur && !cur.ended_at) return cur;
      var now = clock();
      var l = { id: id, type: type, from: from, to: to, origin: o.origin || (o._bridge ? 'module:' + (o.module || '') : (a.origin === 'demo' ? 'demo' : 'spine')),
        created_at: now, created_by: S.actor, ended_at: null, rev: cur ? (cur.rev || 1) + 1 : 1 };
      storeLink(l);
      if (!o.silent) logEvent('link', a, { link: { id: id, type: type, from: from, to: to }, note: a.title + ' ' + lt.label + ' ' + (b.type === 'obligation' && b.data.legal_basis ? b.data.legal_basis : b.title) });
      return l;
    }
    function unlink(linkId, o) {
      o = o || {};
      var cur = S.links[linkId]; if (!cur || cur.ended_at) return null;
      var a = get(cur.from);
      if (!o._bridge && a && !isWritable(a)) throw new Error(readOnlyWhy(a));
      var l = Object.assign(clone(cur), { ended_at: clock(), rev: (cur.rev || 1) + 1 });
      storeLink(l);
      if (!o.silent) logEvent('unlink', a, { link: { id: l.id, type: l.type, from: l.from, to: l.to }, note: 'link ended' });
      return l;
    }

    /* ---------- reference data ---------- */
    function addReference(list2) {
      (list2 || []).forEach(function (e) {
        var r = clone(e); r.origin = 'reference'; r.archived = false; r.owner = r.owner || null; r.data = r.data || {};
        if (!stateDef(r.type, r.status)) r.status = (states(r.type)[0] || {}).id;
        S.ref[r.id] = deepFreeze(r);
      });
    }

    /* ---------- the read-only bridge, applied ---------- */
    function importModules(read, ref) {
      var who = S.actor;
      S.actor = 'system:bridge'; // everything the bridge writes is attributed to the module import
      try { return importModulesAs(read, ref); } finally { S.actor = who; }
    }
    function importModulesAs(read, ref) {
      var c = collect(read, ref, cfg, S.today);
      var res = { created: 0, updated: 0, archived: 0, people: 0, links: 0, errors: [], modules: c.report };
      // overlays on reference obligations
      Object.keys(c.overlay.obligations).forEach(function (oid) {
        var r = S.ref['OBL:' + oid]; if (!r) return;
        var ov = c.overlay.obligations[oid], n = clone(r);
        n.data.watched = !!ov.watched; if (ov.note) n.data.note = ov.note;
        if (ov.applicable === false) { n.status = 'not_applicable'; n.data.applicable = false; }
        S.ref[n.id] = deepFreeze(n);
      });
      if (c.overlay.firm_type) S.moduleFirmType = c.overlay.firm_type;
      // people are discovered once, then owned (and editable) in the spine
      c.people.forEach(function (p) {
        if (S.ents[p.id]) return;
        create('person', { id: p.id, title: p.title, status: 'active', data: p.data, src: p.src }, { origin: 'discovered', action: 'import',
          note: 'Found in ' + ((moduleById(p.src && p.src.module) || {}).label || 'module data') });
        res.people++;
      });
      var failed = {}, seen = {};
      c.report.forEach(function (r) { if (r.error) failed[r.module] = true; });
      c.entities.forEach(function (e) {
        seen[e.id] = 1;
        var h = fnv(stable({ title: e.title, status: e.status, owner: e.owner, due: e.due, data: e.data }));
        var cur = S.ents[e.id];
        if (cur && cur.origin !== e.origin) return; // never overwrite a record the spine owns
        if (e.owner && !get(e.owner)) e.owner = null;
        try {
          if (!cur) {
            create(e.type, { id: e.id, title: e.title, status: e.status, owner: e.owner, due: e.due, data: e.data, src: e.src, src_hash: h },
              { origin: e.origin, action: 'import', _bridge: true, note: 'Mirrored from ' + moduleById(e.src.module).label });
            res.created++;
          } else if (cur.src_hash !== h || cur.archived) {
            update(e.id, { title: e.title, status: e.status, owner: e.owner, due: e.due, data: e.data, archived: false, src_hash: h },
              { _bridge: true, replaceData: true, action: 'sync', note: 'Changed on the ' + moduleById(e.src.module).label + ' page' });
            res.updated++;
          }
        } catch (err) {
          failed[e.src.module] = true; // keep what we have for that module rather than archiving it
          res.errors.push(e.id + ': ' + err.message);
        }
      });
      Object.keys(S.ents).forEach(function (k) {
        var e = S.ents[k], mid = String(e.origin || '').indexOf('module:') === 0 ? e.origin.slice(7) : null;
        if (mid && !seen[k] && !e.archived && !failed[mid]) {
          var mm = moduleById(mid);
          update(k, { archived: true }, { _bridge: true, action: 'archive', note: mm && mm.migrated
            ? 'The ' + mm.label + ' page now keeps its records in the spine: this mirrored copy is retired'
            : 'No longer found on the ' + (mm ? mm.label : mid) + ' page' });
          res.archived++;
        }
      });
      var seenL = {};
      c.links.forEach(function (l) {
        var id = 'L:' + l.type + ':' + l.from + '>' + l.to; seenL[id] = 1;
        if (S.links[id] && !S.links[id].ended_at) return;
        if (!get(l.from) || !get(l.to)) return;
        try { link(l.type, l.from, l.to, { _bridge: true, module: l.module, silent: true }); res.links++; } catch (e) { /* type mismatch: skip */ }
      });
      Object.keys(S.links).forEach(function (k) {
        var l = S.links[k], mid = String(l.origin || '').indexOf('module:') === 0 ? l.origin.slice(7) : null;
        if (mid && !seenL[k] && !l.ended_at && !failed[mid]) unlink(k, { _bridge: true, silent: true });
      });
      if (res.created || res.updated || res.archived || res.people) {
        logEvent('import', null, { entity_type: 'bridge', title: 'Module import', actor: 'system:bridge',
          note: res.created + ' new, ' + res.updated + ' changed, ' + res.archived + ' archived, ' + res.people + ' people, ' + res.links + ' links' });
      }
      return res;
    }

    /* ---------- demo data (fictional, labelled) ---------- */
    function loadDemo(demo) {
      if (!demo || !demo.people) throw new Error('Demo data missing.');
      var t = S.today, made = 0, skipped = [];
      var ids = {};
      function off(n) { return n == null ? null : dates.addDays(t, n); }
      function put(type, id, input) {
        var cur = S.ents[id];
        input.data = Object.assign({ demo: true }, input.data || {});
        if (cur && cur.origin === 'demo') { update(id, Object.assign({ archived: false }, input), { action: 'demo', note: 'Demo data reloaded' }); }
        else if (!cur) { create(type, Object.assign({ id: id }, input), { origin: 'demo', note: 'Demo data (fictional)' }); }
        made++;
        return id;
      }
      demo.people.forEach(function (p) {
        var id = 'person:' + slug(p.name); ids[p.key] = id;
        var cur = S.ents[id];
        if (cur && cur.origin !== 'demo') {
          if (!cur.data.role || cur.data.role !== p.role) update(id, { data: { role: p.role, job_title: p.job_title || cur.data.job_title } }, { action: 'demo', note: 'Role set by the demo data' });
          if (cur.archived) update(id, { archived: false }, { action: 'demo' });
          return;
        }
        put('person', id, { title: p.name, status: 'active', data: { role: p.role, job_title: p.job_title || '', team: p.team || '' } });
      });
      if (!S.settings.firm_name) setSetting('firm_name', demo.firm && demo.firm.name);
      if (!S.settings.firm_type && demo.firm && demo.firm.type) setSetting('firm_type', demo.firm.type);
      // The firm's own records (mirrored from a module, or kept in the spine by a migrated one) win over demo ones.
      // (The tracker's own demo register has origin 'demo' too: it counts, so the story is not loaded twice.)
      function hasModule(type) { return list(type).some(function (e) { return e.origin !== 'demo' || String(e.id).indexOf(':demo-') === -1; }); }
      var groups = [['issue', demo.issues], ['action', demo.tasks], ['policy', demo.policies], ['case', demo.cases], ['assessment', demo.assessments], ['training', demo.training], ['test', demo.tests]];
      groups.forEach(function (g) {
        var type = g[0], rows = g[1] || [];
        if (type !== 'action' && type !== 'training' && type !== 'test' && hasModule(type)) { if (rows.length) skipped.push(typeDef(type).plural); return; }
        rows.forEach(function (x) {
          var id = (typeDef(type).id_prefix || type) + ':demo-' + x.key;
          ids[x.key] = id;
          var xd = Object.assign({}, x.data || {});
          if (x.opened_off != null) xd.opened_on = off(x.opened_off);
          put(type, id, { title: x.title, status: x.status, owner: ids[x.owner] || null, due: off(x.due_off), data: xd });
          (x.links || []).forEach(function (l) {
            var to = ids[l.to] || l.to;
            if (get(to)) { try { link(l.type, id, to, { origin: 'demo' }); } catch (e) { /* skip a link the config does not allow */ } }
          });
        });
      });
      logEvent('demo', null, { entity_type: 'demo', title: 'Demo data loaded', note: made + ' fictional records (' + ((demo.firm && demo.firm.name) || 'demo firm') + ')' + (skipped.length ? '; skipped ' + skipped.join(', ') + ' because your modules already have them' : '') });
      return { records: made, skipped: skipped };
    }
    function clearDemo() {
      var n = 0;
      Object.keys(S.links).forEach(function (k) { var l = S.links[k]; if (l.origin === 'demo' && !l.ended_at) unlink(k, { silent: true }); });
      Object.keys(S.ents).forEach(function (k) {
        var e = S.ents[k];
        if (e.origin !== 'demo' || e.archived) return;
        if (e.type === 'person' && list(null, function (x) { return x.owner === k && x.origin !== 'demo'; }).length) return;
        update(k, { archived: true }, { action: 'archive', note: 'Demo data removed' }); n++;
      });
      if (n) logEvent('demo', null, { entity_type: 'demo', title: 'Demo data removed', note: n + ' fictional records archived (kept in the log)' });
      return n;
    }
    function hasDemo() { return list(null, { origin: 'demo' }).length > 0; }

    /* ---------- settings ---------- */
    function getSetting(k) {
      if (k === 'firm_type' && !S.settings.firm_type) return S.moduleFirmType || (cfg.firm && cfg.firm.type) || '';
      return S.settings[k] != null ? S.settings[k] : null;
    }
    function setSetting(k, v) {
      if (stable(S.settings[k]) === stable(v)) return;
      var old = S.settings[k];
      S.settings = Object.assign({}, S.settings); S.settings[k] = v;
      saveSettings();
      logEvent('settings', null, { entity_type: 'settings', title: k, changes: (function () { var c = {}; c[k] = [old == null ? null : old, v]; return c; })() });
    }

    /* ---------- open: load, migrate ---------- */
    var MIGRATIONS = {
      // Example for the next schema change:  2: function (tables) { tables.entities.forEach(...); return tables; }
    };
    var ready = (async function () {
      var t = {};
      for (var i = 0; i < TABLES.length; i++) t[TABLES[i]] = await adapter.load(TABLES[i]);
      var meta = {}; (t.meta || []).forEach(function (r) { meta[r.id] = r; });
      var ver = meta.schema ? +meta.schema.version : 0;
      if (ver > SCHEMA_VERSION) throw new Error('This data was written by a newer RegRadar (schema ' + ver + '). Update the page.');
      for (var v = Math.max(ver, 1) + 1; v <= SCHEMA_VERSION; v++) if (MIGRATIONS[v]) t = MIGRATIONS[v](t);
      (t.entities || []).forEach(function (e) { S.ents[e.id] = deepFreeze(e); });
      (t.links || []).forEach(function (l) { S.links[l.id] = deepFreeze(l); });
      S.events = (t.events || []).slice().sort(function (a, b) { return a.seq - b.seq; }).map(deepFreeze);
      if (S.events.length) { S.seq = S.events[S.events.length - 1].seq; S.lastHash = S.events[S.events.length - 1].hash; }
      S.settings = (meta.settings && meta.settings.values) || {};
      if (ver !== SCHEMA_VERSION) persist(function () { return adapter.save('meta', { id: 'schema', version: SCHEMA_VERSION, migrated_at: clock() }); });
      return api;
    })();

    var api = {
      ready: ready,
      version: VERSION,
      adapterName: adapter.name,
      // config
      config: function () { return cfg; },
      typeDef: typeDef, states: states, stateDef: stateDef, linkType: linkType,
      roles: function () { return cfg.roles || []; },
      role: function (id) { return (cfg.roles || []).filter(function (r) { return r.id === id; })[0] || null; },
      scale: function (id) { return (cfg.scales || {})[id] || []; },
      taskKinds: function () { return cfg.task_kinds || []; },
      today: function () { return S.today; },
      // reads
      get: get, list: list, filter: function (type, fn) { return list(type, fn); },
      linked: linked, links: linksOf, history: history, events: events,
      category: category,
      isOpen: function (e) { var c = category(e); return c === 'open' || c === 'review'; },
      awaitingApproval: function (e) { return category(e) === 'review'; },
      dueState: function (e, today) {
        if (!e || !e.due) return null;
        var d = dates.diff(e.due, today || S.today);
        return { days: d, state: d < 0 ? 'overdue' : d <= 7 ? 'week' : d <= 30 ? 'month' : 'later' };
      },
      people: function () { return list('person').sort(function (a, b) { return a.title.localeCompare(b.title); }); },
      isWritable: isWritable, readOnlyWhy: readOnlyWhy,
      // writes
      create: create, update: update,
      move: function (id, status, o) { return update(id, { status: status }, Object.assign({ action: 'move' }, o || {})); },
      assign: function (id, owner, o) { return update(id, { owner: owner }, Object.assign({ action: 'assign' }, o || {})); },
      archive: function (id, o) { return update(id, { archived: true }, Object.assign({ action: 'archive' }, o || {})); },
      link: link, unlink: unlink,
      log: function (action, entityId, note) { return logEvent(action, entityId ? get(entityId) : null, { note: note }); },
      // reference, bridge, demo
      addReference: addReference, importModules: importModules,
      loadDemo: loadDemo, clearDemo: clearDemo, hasDemo: hasDemo,
      // settings and actor
      getSetting: getSetting, setSetting: setSetting,
      setActor: function (id) { S.actor = id || 'person:me'; },
      actor: function () { return S.actor; },
      // events
      subscribe: function (fn) { S.subs.push(fn); return function () { S.subs = S.subs.filter(function (f) { return f !== fn; }); }; },
      onError: function (fn) { S.errs.push(fn); return function () { S.errs = S.errs.filter(function (f) { return f !== fn; }); }; },
      saveOk: function () { return S.saveOk; },
      flush: function () { return S.queue; },
      verifyLog: function () {
        var prev = '0';
        for (var i = 0; i < S.events.length; i++) {
          var ev = S.events[i];
          if (ev.prev !== prev || hashOf(ev) !== ev.hash) return { ok: false, broken_at: ev.seq };
          prev = ev.hash;
        }
        return { ok: true, count: S.events.length };
      },
      exportAll: function () {
        return clone({ schema_version: SCHEMA_VERSION, exported_at: clock(),
          meta: [{ id: 'schema', version: SCHEMA_VERSION }, { id: 'settings', values: S.settings }],
          entities: Object.keys(S.ents).map(function (k) { return S.ents[k]; }),
          links: Object.keys(S.links).map(function (k) { return S.links[k]; }), events: S.events });
      },
      // Copy everything into another adapter (for example memory -> Postgres later). Events keep their ids and hashes.
      copyTo: async function (other) {
        await S.queue;
        var d = api.exportAll();
        for (var i = 0; i < d.meta.length; i++) await other.save('meta', d.meta[i]);
        for (i = 0; i < d.entities.length; i++) await other.save('entities', d.entities[i]);
        for (i = 0; i < d.links.length; i++) await other.save('links', d.links[i]);
        for (i = 0; i < d.events.length; i++) await other.append('events', d.events[i]);
        return other;
      },
      // Device-local only: wipe the spine's own tables (module keys are never touched).
      reset: async function () {
        await S.queue;
        await adapter.reset();
        S.ents = {}; S.links = {}; S.events = []; S.seq = 0; S.lastHash = '0'; S.settings = {};
        logEvent('reset', null, { entity_type: 'spine', title: 'Spine cleared on this device' });
        return api;
      }
    };
    return api;
  }

  /* ═════════════════ the global ═════════════════ */
  var RR = {
    version: VERSION,
    SCHEMA_VERSION: SCHEMA_VERSION,
    MODULES: MODULES,
    createSpine: createSpine,
    adapters: { memory: memoryAdapter, localStorage: localStorageAdapter, postgres: postgresAdapter },
    reference: reference,
    bridge: { collect: collect, modules: MODULES, migrated: MIGRATED, guessRole: guessRole },
    /* One-time imports for modules that moved onto the spine. A module file (for example
       docs/actions-store.js) registers { id, label, run(spine, read) } here; RR.boot runs every
       registered migration after the bridge. run() must be idempotent, must never write or delete
       the module's old key (it stays as a backup) and returns a small report. */
    migrations: [],
    runMigrations: function (spine, read) {
      var who = spine.actor(), out = [];
      RR.migrations.forEach(function (m) {
        spine.setActor('system:bridge'); // imports are attributed to the module import, like the bridge
        try { out.push(Object.assign({ id: m.id }, m.run(spine, read))); }
        catch (e) { out.push({ id: m.id, status: 'error', error: String(e && e.message || e) }); }
      });
      spine.setActor(who);
      return out;
    },
    dates: dates,
    util: { csv: csv, csvCell: csvCell, slug: slug, stable: stable, hash: fnv, clone: clone },
    current: null,
    /* Browser helper used by home.html and board.html (the only function here
       that fetches, and only same-origin repo files). Opens the device spine,
       adds the repo reference data and runs the read-only bridge with the SAME
       inputs on every page, so mirrored records never flip between pages. */
    boot: async function (o) {
      o = o || {};
      var base = o.base || 'data/';
      function get(p, fb) { return fetch(base + p, { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : fb; }).catch(function () { return fb; }); }
      var r = await Promise.all([get('spine/config.json', null), get('obligations.json', null), get('applicability.json', null),
        get('controls.json', null), get('academy/curriculum.json', null), o.items ? get('items.json', []) : Promise.resolve([])]);
      if (!r[0]) throw new Error('Could not load the spine configuration (data/spine/config.json).');
      var storageOk = true, adapter, ls = null;
      try { ls = window.localStorage; ls.getItem('regradar-spine-meta'); adapter = localStorageAdapter(); }
      catch (e) { storageOk = false; adapter = memoryAdapter(); }
      var asof = null;
      try { asof = new URLSearchParams(location.search).get('asof'); } catch (e) { /* no location */ }
      var s = await RR.open({ config: r[0], adapter: adapter, today: dates.valid(asof) ? asof : undefined });
      s.addReference(reference.obligations(r[1]));
      s.addReference(reference.regulations(r[2]));
      if (o.items) s.addReference(reference.regChanges(r[5]));
      var titles = {}; ((r[4] && r[4].tracks) || []).forEach(function (t) { titles[t.id] = t.title; });
      var report = s.importModules(function (k) { return ls ? ls.getItem(k) : null; }, { controls: r[3], academyTitles: titles });
      var migrations = RR.runMigrations(s, function (k) { return ls ? ls.getItem(k) : null; });
      var actor = s.getSetting('actor');
      if (actor && s.get(actor)) s.setActor(actor);
      // Another tab (say the board) wrote to the spine: tell the page so it can re-open.
      if (o.onExternalChange && !RR._listening && typeof window !== 'undefined') {
        RR._listening = true;
        window.addEventListener('storage', function (e) { if (e.key && e.key.indexOf('regradar-spine-') === 0) o.onExternalChange(); });
      }
      return { spine: s, report: report, migrations: migrations, storageOk: storageOk, applicability: r[2], obligationsMeta: r[1] && r[1]._meta };
    },
    // Open the page's spine and make its methods available as RR.get, RR.list, ...
    open: async function (opts) {
      var s = createSpine(opts);
      await s.ready;
      RR.current = s;
      Object.keys(s).forEach(function (k) { if (typeof s[k] === 'function' && !(k in RR_RESERVED)) RR[k] = s[k]; });
      return s;
    }
  };
  var RR_RESERVED = { open: 1, createSpine: 1 };
  return RR;
});
