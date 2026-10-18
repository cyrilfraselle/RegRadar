/* ═══════════════════════════════════════════════════════════════
   RegRadar: policies and procedures on the data spine (docs/rr-core.js)

   docs/policies-data.js keeps its interface (loadLocal, save, clear and
   all the pure helpers); the page keeps working on one in-memory state
   {policies, staff, attest, reminders, log, teams, me, ...}. This file is
   the only place that knows how that state lives in the spine:

     policy            -> entity 'policy' (POL:<id>): status from its
                          versions (draft, in review, approved, retired),
                          due = next periodic review, owner = a team
                          member, obligations = 'implements' links
     version           -> entity 'policy_version' (POLV:<id>:<ver>), linked
                          'version_of' its policy; the text, change note,
                          approver and approval date live in its data;
                          its status is the version's state
     staff member      -> a team member ('person'), with data.staff_id
     acknowledgement   -> entity 'attestation' (ATT:<id>:<staff>:<n>),
                          linked 'evidences' the policy, owned by the person
     audit trail       -> events in the append-only log (published,
                          approved, acknowledged, mapped, ...), with the
                          acting person and time; the page's "log" is read
                          back from them
     reminders, org, teams, "acting as" -> spine settings
     an unsaved draft  -> stored with the policy WITHOUT an audit event
                          (only publishing is audit-worthy)

   Saves compare the page's state with the spine and write only what
   differs. A state that did not come from loadLocal (the demo seed, an
   empty library, a restored backup) REPLACES the library: the old records
   are archived and the page's log starts again, as before.

   MIGRATION (once, idempotent): migrate() reads the old localStorage key
   'regradar-policies' (never written, never removed: a backup) and writes
   the state into the spine; records the bridge mirrored earlier keep their
   ids and are adopted. The spine setting 'migrated.policies' marks it done.
   No DOM; runs in the browser and in Node (tests).
   ═══════════════════════════════════════════════════════════════ */
(function (root, factory) {
  var RR = (typeof module === 'object' && module.exports) ? require('./rr-core.js') : root.RR;
  var Store = factory(RR);
  if (typeof module === 'object' && module.exports) module.exports = Store; else root.PolicyStore = Store;
  if (RR && RR.migrations && !RR.migrations.some(function (m) { return m.id === 'policies'; })) {
    RR.migrations.push({ id: 'policies', label: 'Policies', order: 15, run: Store.migrate });
  }
})(typeof self !== 'undefined' ? self : this, function (RR) {
  'use strict';

  var KEY = 'regradar-policies';           // the old, module-owned key (backup, never written here)
  var DONE = 'migrated.policies';          // spine setting: the one-time import has happened
  var META = 'policies.meta';              // spine setting: org, demo flag, teams, "acting as", where the log starts
  var REM = 'policies.reminders';          // spine setting: reminders sent
  var AUTO = { create: 1, update: 1, move: 1, assign: 1, archive: 1, restore: 1, link: 1, unlink: 1, import: 1, sync: 1, demo: 1, settings: 1, reset: 1, adopt: 1, dispatch: 1, comment: 1 };
  var LOG_TYPES = { policy: 1, policy_version: 1, attestation: 1 };
  var LOG_CAP = 600;

  function str(v) { return v == null ? '' : String(v); }
  function clone(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }
  function stable(v) { return RR.util.stable(v); }
  function slug(s) { return RR.util.slug(s); }
  function validDate(s) { return RR.dates.valid(str(s).slice(0, 10)) ? str(s).slice(0, 10) : ''; }
  function has(a, v) { return a.indexOf(v) !== -1; }
  function hide(o, k, v) { Object.defineProperty(o, k, { value: v, enumerable: false, writable: true, configurable: true }); }
  function peid(id) { return 'POL:' + id; }
  function veid(pid, ver) { return 'POLV:' + pid + ':' + ver; }
  function aeid(pid, sid, k) { return 'ATT:' + pid + ':' + sid + ':' + k; }
  function personIdFor(sp, s, taken) {
    var base = 'person:' + slug(s.name), hit = sp.get(base);
    if (hit && hit.type === 'person' && (!hit.data.staff_id || hit.data.staff_id === s.id || hit.status === 'left')) return base;   // a returning person is the same team member
    if (!hit) return base;
    return base + '-' + slug(s.id);
  }

  /* ───────── the legacy state, as the page holds it ───────── */
  function normState(raw) {
    if (!raw || typeof raw !== 'object' || raw.v !== 1 || !Array.isArray(raw.policies) || !Array.isArray(raw.staff)) return null;
    var st = clone(raw);
    st.attest = st.attest && typeof st.attest === 'object' ? st.attest : {}; st.reminders = Array.isArray(st.reminders) ? st.reminders : [];
    st.log = Array.isArray(st.log) ? st.log : []; st.teams = Array.isArray(st.teams) ? st.teams : [];
    st.policies = st.policies.filter(function (p) { return p && p.id; }); st.staff = st.staff.filter(function (s) { return s && s.id && s.name; });
    st.policies.forEach(function (p) { p.versions = Array.isArray(p.versions) ? p.versions : []; p.reviews = Array.isArray(p.reviews) ? p.reviews : []; p.obligation_ids = Array.isArray(p.obligation_ids) ? p.obligation_ids : []; p.legal_refs = Array.isArray(p.legal_refs) ? p.legal_refs : []; p.audience = Array.isArray(p.audience) && p.audience.length ? p.audience : ['*']; });
    return st;
  }
  function nextReviewOf(p) {
    var live = null, i;
    for (i = p.versions.length - 1; i >= 0; i--) if (p.versions[i].status === 'approved') { live = p.versions[i]; break; }
    if (p.retired || !validDate(p.lastReviewed) || !live) return null;
    return RR.dates.addMonths(validDate(p.lastReviewed), p.cycleMonths || 12);
  }
  // The spine's status of a policy: the same rule the briefing always used. A version waiting for approval makes the
  // file "in review" even while an older version is live (the page's own statusOf says "approved" then).
  function statusOfPolicy(p) {
    if (p.retired) return 'retired';
    var i, latest = null, live = false;
    for (i = p.versions.length - 1; i >= 0; i--) if (p.versions[i].status === 'approved') { live = true; break; }
    for (i = p.versions.length - 1; i >= 0; i--) if (p.versions[i].status !== 'withdrawn') { latest = p.versions[i]; break; }
    if (latest && latest.status === 'in_review') return 'in_review';
    return live ? 'approved' : 'draft';
  }

  /* ───────── write ───────── */
  function ownerOf(sp, name) { return RR.owners.resolve(sp, name, 'Found in Policies'); }
  function ownerText(name, id) { var n = str(name).trim(); return id || !n || /^unassigned$/i.test(n) ? '' : n; }
  function staffPerson(sp, s, demo, n) {
    var id = personIdFor(sp, s), cur = sp.get(id), data = { staff_id: s.id, staff_n: n, team: str(s.team), job_title: str(s.role) };
    if (cur && cur.type === 'person') {
      var patch = { data: Object.assign({}, data, cur.data.role ? {} : { role: RR.bridge.guessRole(str(s.role) || s.name, sp.config()) }) };
      if (cur.archived) patch.archived = false;
      if (cur.status !== 'active') patch.status = 'active';
      sp.update(id, patch, { action: 'sync' });
    } else {
      data.role = RR.bridge.guessRole(str(s.role) || s.name, sp.config());
      sp.create('person', { id: id, title: s.name, status: 'active', data: data, src: { module: 'policies', ref: s.id } }, { origin: demo ? 'demo' : 'spine', action: 'import', note: 'Staff member in Policies' });
    }
    return id;
  }
  function policyPieces(sp, st, p, idx) {
    var oid = ownerOf(sp, p.owner), due = nextReviewOf(p), status = statusOfPolicy(p);
    var live = null, pend = null, i, latest = null;
    for (i = p.versions.length - 1; i >= 0; i--) if (p.versions[i].status === 'approved') { live = p.versions[i]; break; }
    for (i = p.versions.length - 1; i >= 0; i--) if (p.versions[i].status !== 'withdrawn') { latest = p.versions[i]; break; }
    if (latest && latest.status === 'in_review') pend = latest;
    var un = (p.obligation_ids || []).filter(function (x) { return !sp.get('OBL:' + x); });
    return { title: str(p.title).trim() || p.id, status: status, owner: oid, due: due, data: {
      pid: p.id, order: idx, ref: str(p.ref) || p.id, kind: str(p.kind) || 'Policy', cycle_months: p.cycleMonths || 12, attest_days: p.attestDays || 30, audience: p.audience.slice(),
      approver: str(p.approver), owner_text: ownerText(p.owner, oid), template: str(p.template), legal_refs: clone(p.legal_refs || []), demo: !!p.demo,
      retired: p.retired ? clone(p.retired) : null, reviews: clone(p.reviews || []), last_reviewed: validDate(p.lastReviewed) || null,
      live_version: live ? live.ver : '', pending_version: pend ? pend.ver : '', unresolved_obligations: un.length ? un : null,
      date_source: due ? 'last reviewed ' + validDate(p.lastReviewed) + ' + ' + (p.cycleMonths || 12) + '-month cycle (Policies page)' : '' } };
  }
  function syncObligations(sp, eid, ids) {
    var cur = sp.links(eid, 'implements', 'out').filter(function (l) { return l.to.indexOf('OBL:') === 0; }), want = {}, have = {};
    ids.forEach(function (o) { want['OBL:' + o] = 1; });
    cur.forEach(function (l) { if (!want[l.to]) sp.unlink(l.id, { silent: true }); else have[l.to] = 1; });
    Object.keys(want).forEach(function (t) { if (!have[t] && sp.get(t)) { try { sp.link('implements', eid, t, { silent: true }); } catch (e) { /* kept in data.unresolved_obligations */ } } });
  }
  function versionData(p, v, n) {
    return { pid: p.id, ver: str(v.ver), n: n, date: validDate(v.date) || '', by: str(v.by), note: str(v.note), reattest: v.reattest !== false, body: str(v.body),
      effective: validDate(v.effective) || '', approvedBy: str(v.approvedBy), approvedOn: validDate(v.approvedOn) || '', approvalNote: str(v.approvalNote), selfApproved: !!v.selfApproved,
      returned: v.returned ? clone(v.returned) : null, withdrawn: v.withdrawn ? clone(v.withdrawn) : null };
  }
  var VSTATES = ['draft', 'in_review', 'approved', 'superseded', 'withdrawn'];

  function existingPolicies(sp) { return sp.list('policy').filter(function (e) { return e.data && e.data.pid; }); }

  /* Write the page's state into the spine. o.action 'import' marks a migration. Returns { errors }. */
  function writeState(sp, st, o) {
    o = o || {};
    var errors = [], who = sp.actor(), demoOrigin = o.origin;
    var meId = null;
    st.staff.forEach(function (s) { if (s.id === st.me) { var h = sp.get(personIdFor(sp, s)); if (h && h.type === 'person') meId = h.id; } });
    if (!o.system && meId) sp.setActor(meId);
    function attempt(label, fn) { try { fn(); } catch (e) { errors.push(label + ': ' + e.message); } }
    try {
      var fresh = !st._loaded, present = {}, replaced = false;
      st.policies.forEach(function (p) { present[p.id] = 1; });
      var gone = existingPolicies(sp).filter(function (e) { return !present[e.data.pid]; });
      // A state that did not come from loadLocal replaces the library (demo seed, empty start, restored backup).
      if (fresh && (gone.length || (existingPolicies(sp).length && !o.system))) replaced = true;
      var lastSeq = sp.events().length ? sp.events()[sp.events().length - 1].seq : 0;
      // staff
      var rosterIds = {};
      st.staff.forEach(function (s, n) { attempt('staff ' + s.name, function () { rosterIds[staffPerson(sp, s, st.demo && /^s\d\d$/.test(s.id) ? true : false, n)] = s.id; }); });
      // a person removed from the roster becomes an INACTIVE team member (status 'left'): not offered for new work, name kept in every record and in the audit trail
      sp.list('person').forEach(function (e) { if (e.data && e.data.staff_id && !rosterIds[e.id] && e.status === 'active') attempt('staff ' + e.title, function () { sp.update(e.id, { status: 'left' }, { action: 'update', note: 'Removed from the policies roster: inactive team member' }); }); });
      var sidToPerson = {}; Object.keys(rosterIds).forEach(function (pid) { sidToPerson[rosterIds[pid]] = pid; });
      // policies, their versions and obligations
      st.policies.forEach(function (p, idx) {
        attempt('policy ' + p.id, function () {
          var eid = peid(p.id), cur = sp.get(eid), pc = policyPieces(sp, st, p, idx), draft = p.draft ? clone(p.draft) : null;
          var origin = p.demo ? 'demo' : (demoOrigin || 'spine');
          if (cur && String(cur.origin || '').indexOf('module:') === 0) { sp.adopt(eid); cur = sp.get(eid); }
          if (!cur) {
            var d0 = Object.assign({}, pc.data, { draft: draft });
            sp.create('policy', { id: eid, title: pc.title, status: pc.status, owner: pc.owner, due: pc.due, data: d0, src: { module: 'policies', ref: p.id } }, { origin: origin, action: o.action || 'create', note: o.action === 'import' ? 'Imported from the old policies register on this device' : undefined });
          } else {
            if (!sp.isWritable(cur)) return;
            var patch = { title: pc.title, status: pc.status, owner: pc.owner, due: pc.due, data: pc.data };
            if (cur.archived) patch.archived = false;
            sp.update(eid, patch, { action: cur.archived ? 'restore' : (o.action === 'import' ? 'import' : undefined) });
            var curDraft = cur.data && cur.data.draft;
            if (stable(curDraft || null) !== stable(draft)) sp.update(eid, { data: { draft: draft } }, { silent: true });
          }
          syncObligations(sp, eid, p.obligation_ids || []);
          // versions
          var seen = {};
          p.versions.forEach(function (v, n) {
            seen[v.ver] = 1;
            var id = veid(p.id, v.ver), vc = sp.get(id), vs = has(VSTATES, v.status) ? v.status : 'draft';
            var vd = versionData(p, v, n), title = pc.title + ' v' + v.ver;
            if (vc && String(vc.origin || '').indexOf('module:') === 0) { sp.adopt(id); vc = sp.get(id); }
            if (!vc) {
              sp.create('policy_version', { id: id, title: title, status: vs, data: vd, src: { module: 'policies', ref: p.id + '@' + v.ver } }, { origin: origin, action: o.action || 'create', note: o.action === 'import' ? 'Imported with the policy' : 'Version ' + v.ver + ' of ' + pc.title });
              try { sp.link('version_of', id, eid, { silent: true }); } catch (e) { /* policy is written first */ }
            } else {
              var vp = { title: title, status: vs, data: vd }; if (vc.archived) vp.archived = false;
              sp.update(id, vp, { action: vc.archived ? 'restore' : undefined });
            }
          });
          sp.links(eid, 'version_of', 'in').forEach(function (l) {
            var ve = sp.get(l.from);
            if (ve && ve.type === 'policy_version' && !ve.archived && !seen[ve.data.ver]) sp.archive(ve.id, { note: 'Version removed' });
          });
        });
      });
      // a replaced library: archive what is no longer there, and start the page's log again
      gone.forEach(function (e) {
        attempt('archive ' + e.id, function () {
          sp.links(e.id, 'version_of', 'in').forEach(function (l) { var ve = sp.get(l.from); if (ve && !ve.archived) sp.archive(ve.id, { note: 'Library replaced' }); });
          sp.archive(e.id, { note: 'Library replaced' });
        });
      });
      // acknowledgements: one record per acknowledgement, oldest = 0
      var attSeen = {};
      Object.keys(st.attest || {}).forEach(function (pid) {
        var pe = sp.get(peid(pid)); if (!pe || pe.archived) return;
        var pol = st.policies.filter(function (x) { return x.id === pid; })[0], origin = pol && pol.demo ? 'demo' : (demoOrigin || 'spine');
        Object.keys(st.attest[pid] || {}).forEach(function (sid) {
          var acks = st.attest[pid][sid] || [], person = sidToPerson[sid] || null;
          if (!person) { var sf = st.staff.filter(function (x) { return x.id === sid; })[0]; if (sf) person = personIdFor(sp, sf); }
          for (var i = 0; i < acks.length; i++) {
            var a = acks[i], k = acks.length - 1 - i, id = aeid(pid, sid, k);
            attSeen[id] = 1;
            attempt('acknowledgement ' + id, function () {
              var cur = sp.get(id), who2 = person && sp.get(person) ? sp.get(person).title : sid;
              var data = { policy: pid, staff: sid, ver: str(a.ver), on: validDate(a.on) || '', by_text: str(a.by), k: k };
              if (cur && String(cur.origin || '').indexOf('module:') === 0) { sp.adopt(id); cur = sp.get(id); }
              if (!cur) {
                sp.create('attestation', { id: id, title: who2 + ' acknowledged ' + pe.title + ' v' + str(a.ver), status: 'recorded', owner: person && sp.get(person) ? person : null, due: null, data: data, src: { module: 'policies', ref: pid + '/' + sid + '#' + k } }, { origin: origin, action: o.action || 'create', note: o.action === 'import' ? 'Imported with the policy' : undefined });
                try { sp.link('evidences', id, pe.id, { silent: true }); } catch (e) { /* policy exists */ }
              } else if (cur.archived) sp.update(id, { archived: false, data: data }, { action: 'restore' });
            });
          }
        });
      });
      sp.list('attestation').forEach(function (e) { if (e.data && e.data.policy && !attSeen[e.id] && (replaced || fresh)) attempt('archive ' + e.id, function () { sp.archive(e.id, { note: 'Library replaced' }); }); });
      // settings: reminders, org, teams, "acting as"
      attempt('reminders', function () { if (stable(sp.getSetting(REM) || []) !== stable(st.reminders || [])) sp.setSetting(REM, clone(st.reminders || [])); });
      attempt('meta', function () {
        var old = sp.getSetting(META) || {};
        var m = { org: str(st.org), demo: !!st.demo, seedVersion: st.seedVersion || 0, teams: (st.teams || []).slice(), me: str(st.me), logFrom: replaced ? lastSeq : (old.logFrom || 0) };
        if (stable(old) !== stable(m)) sp.setSetting(META, m);
      });
      // the audit trail: the page's new log lines become events, with their acting person and time
      var seenSet = st._seen, fresh0 = [];
      (st.log || []).forEach(function (en) { if (!seenSet || !seenSet.has(en)) fresh0.push(en); });
      fresh0.reverse().forEach(function (en) {
        attempt('log', function () {
          var pe = en.policy && sp.get(peid(en.policy)) && !sp.get(peid(en.policy)).archived ? peid(en.policy) : null;
          var actor = null;
          if (en.who) { var w = slug(en.who), cand = sp.get('person:' + w); actor = cand && cand.type === 'person' ? cand.id : (st.staff.filter(function (x) { return x.name === en.who; })[0] ? personIdFor(sp, st.staff.filter(function (x) { return x.name === en.who; })[0]) : en.who); }
          sp.log(str(en.action) || 'note', pe, str(en.detail), { actor: actor || undefined, at: en.t });
        });
      });
      hide(st, '_loaded', true);
      var ss = seenSet || new WeakSet(); (st.log || []).forEach(function (en) { ss.add(en); }); hide(st, '_seen', ss);
    } finally { sp.setActor(who); }
    return { errors: errors };
  }

  /* ───────── read ───────── */
  function idsOf(sp, e, un) {
    var out = sp.links(e.id, 'implements', 'out').filter(function (l) { return l.to.indexOf('OBL:') === 0; }).map(function (l) { return l.to.slice(4); });
    (un || []).forEach(function (x) { if (out.indexOf(x) === -1) out.push(x); });
    return out;
  }
  function nameOf(sp, id) { if (!id) return ''; var p = sp.get(id); return p ? p.title : id; }
  function viewVersion(e) {
    var d = e.data || {}, v = { ver: str(d.ver), date: str(d.date), by: str(d.by), note: str(d.note), status: e.status, reattest: d.reattest !== false, body: str(d.body) };
    if (d.effective) v.effective = d.effective;
    if (d.approvedBy) v.approvedBy = d.approvedBy;
    if (d.approvedOn) v.approvedOn = d.approvedOn;
    if (d.approvalNote) v.approvalNote = d.approvalNote;
    if (d.selfApproved) v.selfApproved = true;
    if (d.returned) v.returned = clone(d.returned);
    if (d.withdrawn) v.withdrawn = clone(d.withdrawn);
    return v;
  }
  function viewPolicy(sp, e) {
    var d = e.data || {};
    var vers = sp.links(e.id, 'version_of', 'in').map(function (l) { return sp.get(l.from); }).filter(function (v) { return v && v.type === 'policy_version' && !v.archived; })
      .sort(function (a, b) { return (a.data.n || 0) - (b.data.n || 0); }).map(viewVersion);
    var p = { id: d.pid, ref: str(d.ref) === d.pid ? '' : str(d.ref), title: e.title, kind: str(d.kind) || 'Policy', owner: nameOf(sp, e.owner) || str(d.owner_text), approver: str(d.approver), cycleMonths: d.cycle_months || 12, attestDays: d.attest_days || 30,
      audience: Array.isArray(d.audience) && d.audience.length ? d.audience.slice() : ['*'], obligation_ids: idsOf(sp, e, d.unresolved_obligations), legal_refs: clone(d.legal_refs) || [], template: str(d.template),
      demo: !!d.demo || e.origin === 'demo', retired: d.retired ? clone(d.retired) : (e.status === 'retired' ? { on: '', by: '', why: '' } : null), draft: d.draft ? clone(d.draft) : null,
      reviews: clone(d.reviews) || [], lastReviewed: d.last_reviewed || null, versions: vers };
    return p;
  }
  function logFromEvents(sp, from) {
    var out = [];
    sp.events().forEach(function (ev) {
      if (ev.seq <= from || AUTO[ev.action]) return;
      if (ev.entity_type && !LOG_TYPES[ev.entity_type]) return;
      var pid = '';
      if (ev.entity) { var x = /^(?:POL|POLV|ATT):([^:]+)/.exec(ev.entity); pid = x ? x[1] : ''; }
      out.push({ t: ev.at, who: ev.actor && ev.actor.indexOf('person:') === 0 ? nameOf(sp, ev.actor) : (ev.actor === 'system:bridge' ? 'Module import' : str(ev.actor)), policy: pid, action: ev.action, detail: str(ev.note), _seq: ev.seq });
    });
    out.sort(function (a, b) { return a.t < b.t ? 1 : a.t > b.t ? -1 : b._seq - a._seq; });
    out.forEach(function (x) { delete x._seq; });
    return out.slice(0, LOG_CAP);
  }
  /* The page's state from the spine, or null when no policy library exists yet (the page then offers the demo). */
  function read(sp) {
    var meta = sp.getSetting(META), pols = existingPolicies(sp);
    if (!meta && !pols.length) return null;
    meta = meta || {};
    var st = { v: 1, seedVersion: meta.seedVersion || 0, org: meta.org || 'Your firm', demo: false, me: meta.me || '', teams: (meta.teams || []).slice(), staff: [], policies: [], attest: {}, reminders: clone(sp.getSetting(REM)) || [], log: [] };
    pols.sort(function (a, b) { var na = a.data.order != null ? a.data.order : 1e9, nb = b.data.order != null ? b.data.order : 1e9; return na - nb || (a.id < b.id ? -1 : 1); });
    st.policies = pols.map(function (e) { return viewPolicy(sp, e); });
    st.demo = !!meta.demo && st.policies.some(function (p) { return p.demo; });
    sp.list('person').forEach(function (e) {
      if (e.data && e.data.staff_id && e.status === 'active') st.staff.push({ id: e.data.staff_id, name: e.title, team: str(e.data.team), role: str(e.data.job_title), _n: e.data.staff_n != null ? e.data.staff_n : 1e9 });
    });
    st.staff.sort(function (a, b) { return a._n - b._n || (a.id < b.id ? -1 : 1); });
    st.staff.forEach(function (x) { delete x._n; });
    var byPol = {};
    sp.list('attestation').forEach(function (e) { var d = e.data || {}; if (!d.policy) return; ((byPol[d.policy] = byPol[d.policy] || {})[d.staff] = byPol[d.policy][d.staff] || []).push({ k: d.k || 0, ver: str(d.ver), on: str(d.on), by: str(d.by_text) }); });
    Object.keys(byPol).forEach(function (pid) {
      st.attest[pid] = {};
      Object.keys(byPol[pid]).forEach(function (sid) { st.attest[pid][sid] = byPol[pid][sid].sort(function (a, b) { return b.k - a.k; }).map(function (a) { return { ver: a.ver, on: a.on, by: a.by }; }); });
    });
    st.log = logFromEvents(sp, meta.logFrom || 0);
    hide(st, '_loaded', true);
    var seen = new WeakSet(); st.log.forEach(function (en) { seen.add(en); }); hide(st, '_seen', seen);
    return st;
  }
  function commit(sp, st) { return writeState(sp, st, {}); }

  /* ───────── the one-time import from the old localStorage key ───────── */
  function migrate(sp, read0) {
    if (sp.getSetting(DONE)) return { status: 'already' };
    var raw;
    try { raw = read0(KEY); } catch (e) { return { status: 'blocked' }; }
    if (raw == null || raw === '') return { status: 'none' };
    var parsed;
    try { parsed = JSON.parse(raw); } catch (e) { return { status: 'unreadable' }; }
    var st = normState(parsed);
    if (!st) return { status: 'unreadable' };
    var r = writeState(sp, st, { action: 'import', system: true });
    if (r.errors.length) return { status: 'error', error: r.errors[0], errors: r.errors };
    sp.setSetting(DONE, { at: new Date().toISOString(), source: KEY, policies: st.policies.length, staff: st.staff.length, log: st.log.length });
    sp.log('import', null, 'Policies: ' + st.policies.length + ' policies, ' + st.staff.length + ' people and ' + st.log.length + ' audit-trail lines imported from the old register on this device (kept as a backup).');
    return { status: 'migrated', policies: st.policies.length, staff: st.staff.length, log: st.log.length };
  }

  /* For code that has no spine (the impact and Ask pages): the policy list straight from the spine's storage, or from
     the old key until the import has run. */
  function listFromStorage(getItem) {
    function json(k) { try { var r = getItem(k); return r ? JSON.parse(r) : null; } catch (e) { return null; } }
    var meta = json('regradar-spine-meta'), ents = json('regradar-spine-entities'), links = json('regradar-spine-links') || {};
    var done = meta && meta.settings && meta.settings.values && meta.settings.values[DONE];
    if (done && ents) {
      var out = [];
      Object.keys(ents).forEach(function (k) {
        var e = ents[k]; if (!e || e.type !== 'policy' || e.archived || !e.data || !e.data.pid) return;
        var d = e.data, ids = [];
        Object.keys(links).forEach(function (lk) { var l = links[lk]; if (l && l.type === 'implements' && l.from === e.id && !l.ended_at && String(l.to).indexOf('OBL:') === 0) ids.push(l.to.slice(4)); });
        (d.unresolved_obligations || []).forEach(function (x) { if (ids.indexOf(x) === -1) ids.push(x); });
        out.push({ id: d.pid, ref: str(d.ref) === d.pid ? '' : str(d.ref), title: e.title || d.pid, owner: (e.owner && ents[e.owner] ? ents[e.owner].title : str(d.owner_text)), obligation_ids: ids, legal_refs: d.legal_refs || [], retired: !!d.retired || e.status === 'retired' });
      });
      return out;
    }
    var old = json(KEY);
    if (old && Array.isArray(old.policies)) return old.policies.map(function (p) { return { id: p.id, ref: p.ref || '', title: p.title || p.id, owner: p.owner || '', obligation_ids: p.obligation_ids || [], legal_refs: p.legal_refs || [], retired: !!p.retired }; });
    return [];
  }

  return { KEY: KEY, DONE: DONE, META: META, REM: REM, migrate: migrate, read: read, commit: commit, listFromStorage: listFromStorage, normState: normState };
});
