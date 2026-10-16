/* ═══════════════════════════════════════════════════════════════
   RegRadar: policies and procedures data layer (epic E6)

   Everything the policies page knows lives in ONE device-local
   document (localStorage key 'regradar-policies'): the policies and
   their versions, review dates, the staff roster, acknowledgements,
   reminders and an audit trail. The demo seed (CF Bank, fictional) is
   copied in on first visit; swap load/save for a backend later without
   touching the page.

   Pure logic only: dates, semantic versions, review cycles,
   acknowledgement status, obligation coverage, a small markdown
   renderer, a line/word diff and CSV helpers. No DOM, no network.
   ═══════════════════════════════════════════════════════════════ */
window.PolicyData = (function () {
  "use strict";
  var KEY = "regradar-policies";

  /* ---------- dates ---------- */
  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function iso(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function today() { return iso(new Date()); }
  function parse(s) { var p = String(s).slice(0, 10).split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function addDays(s, n) { var d = parse(s); d.setDate(d.getDate() + n); return iso(d); }
  function addMonths(s, m) {
    var d = parse(s), day = d.getDate();
    d.setDate(1); d.setMonth(d.getMonth() + m);
    var last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, last));
    return iso(d);
  }
  function diffDays(a, b) { return Math.round((parse(b) - parse(a)) / 864e5); } // b minus a
  function fmt(s) {
    if (!s) return "";
    return parse(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  }
  function fmtTime(ts) {
    if (!ts) return "";
    var d = new Date(ts);
    if (isNaN(d)) return String(ts);
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) + ", " +
      d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ---------- semantic versions ---------- */
  function semParts(v) {
    var p = String(v || "0.0.0").split(".").map(function (x) { return parseInt(x, 10) || 0; });
    while (p.length < 3) p.push(0);
    return p;
  }
  function semCmp(a, b) {
    var x = semParts(a), y = semParts(b);
    for (var i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1;
    return 0;
  }
  function semBump(v, kind) {
    var p = semParts(v);
    if (kind === "major") return (p[0] + 1) + ".0.0";
    if (kind === "minor") return p[0] + "." + (p[1] + 1) + ".0";
    return p[0] + "." + p[1] + "." + (p[2] + 1);
  }
  function highestVersion(p) {
    return p.versions.reduce(function (m, v) { return !m || semCmp(v.ver, m) > 0 ? v.ver : m; }, null);
  }

  /* ---------- persistence ---------- */
  function loadLocal() {
    try {
      var s = JSON.parse(localStorage.getItem(KEY) || "null");
      if (s && s.v === 1 && Array.isArray(s.policies) && Array.isArray(s.staff)) {
        s.attest = s.attest || {}; s.reminders = s.reminders || []; s.log = s.log || []; s.teams = s.teams || [];
        return s;
      }
    } catch (e) { /* unreadable: fall back to the seed */ }
    return null;
  }
  function save(st) {
    try { localStorage.setItem(KEY, JSON.stringify(st)); return true; } catch (e) { return false; }
  }
  function clear() { try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } }

  function logEntry(st, who, pid, action, detail) {
    st.log.unshift({ t: new Date().toISOString(), who: who || "", policy: pid || "", action: action, detail: detail || "" });
    if (st.log.length > 600) st.log.length = 600;
  }

  function emptyState() {
    return { v: 1, seedVersion: 0, org: "Your firm", demo: false, me: "", teams: [], staff: [], policies: [], attest: {}, reminders: [], log: [] };
  }

  /* Build a live state from the seed. Seed dates are offsets from today
     so overdue and outstanding states always show up in the demo. */
  function fromSeed(seed) {
    var t = today();
    var st = emptyState();
    st.seedVersion = seed._meta.version; st.org = seed._meta.org; st.demo = true;
    st.teams = seed.teams.slice();
    st.staff = clone(seed.staff);
    st.me = st.staff[0] ? st.staff[0].id : "";
    seed.policies.forEach(function (sp) {
      var p = clone(sp);
      p.versions = sp.versions.map(function (v) {
        var x = clone(v);
        x.date = addDays(t, v.dOff); delete x.dOff;
        if (v.approvedOff != null) { x.approvedOn = addDays(t, v.approvedOff); x.effective = x.approvedOn; }
        delete x.approvedOff;
        return x;
      });
      p.reviews = (sp.reviews || []).map(function (r) { return { on: addDays(t, r.dOff), by: r.by, note: r.note }; });
      p.lastReviewed = sp.lastReviewedOff != null ? addDays(t, sp.lastReviewedOff) : null;
      delete p.lastReviewedOff;
      p.retired = sp.retired ? { on: addDays(t, sp.retired.dOff), by: sp.retired.by, why: sp.retired.why } : null;
      p.draft = sp.draft ? { body: sp.draft.body, basedOn: sp.draft.basedOn, savedAt: addDays(t, sp.draft.dOff) + "T10:00:00" } : null;
      st.policies.push(p);
      p.versions.forEach(function (v) {
        logEntry(st, v.by, p.id, "published", "v" + v.ver + ": " + v.note);
        st.log[0].t = v.date + "T09:00:00";
        if (v.approvedBy) {
          logEntry(st, v.approvedBy, p.id, "approved", "v" + v.ver);
          st.log[0].t = v.approvedOn + "T11:00:00";
        }
      });
      (p.reviews || []).forEach(function (r) {
        logEntry(st, r.by, p.id, "reviewed", r.note); st.log[0].t = r.on + "T12:00:00";
      });
      if (p.retired) { logEntry(st, p.retired.by, p.id, "retired", p.retired.why); st.log[0].t = p.retired.on + "T12:00:00"; }
    });
    (seed.attest || []).forEach(function (a) {
      st.attest[a.policy] = st.attest[a.policy] || {};
      (st.attest[a.policy][a.staff] = st.attest[a.policy][a.staff] || []).push({ ver: a.ver, on: addDays(t, a.dOff), by: a.by });
    });
    (seed.reminders || []).forEach(function (r) {
      st.reminders.push({ on: addDays(t, r.dOff), by: r.by, staff: r.staff, policies: r.policies.slice(), note: r.note });
    });
    st.log.sort(function (a, b) { return a.t < b.t ? 1 : -1; });
    return st;
  }

  /* ---------- lookups and derived state ---------- */
  function byId(arr, id) { for (var i = 0; i < arr.length; i++) if (arr[i].id === id) return arr[i]; return null; }
  function getPolicy(st, id) { return byId(st.policies, id); }
  function getStaff(st, id) { return byId(st.staff, id); }
  function staffByName(st, name) {
    var n = String(name || "").trim().toLowerCase();
    for (var i = 0; i < st.staff.length; i++) if (st.staff[i].name.toLowerCase() === n) return st.staff[i];
    return null;
  }
  function liveVersion(p) {
    for (var i = p.versions.length - 1; i >= 0; i--) if (p.versions[i].status === "approved") return p.versions[i];
    return null;
  }
  function latestVersion(p) {
    for (var i = p.versions.length - 1; i >= 0; i--) if (p.versions[i].status !== "withdrawn") return p.versions[i];
    return p.versions[p.versions.length - 1] || null;
  }
  function pendingVersion(p) {
    var l = latestVersion(p);
    return l && (l.status === "draft" || l.status === "in_review") ? l : null;
  }
  function findVersion(p, ver) { for (var i = 0; i < p.versions.length; i++) if (p.versions[i].ver === ver) return p.versions[i]; return null; }
  function verIdx(p, ver) { for (var i = 0; i < p.versions.length; i++) if (p.versions[i].ver === ver) return i; return -1; }
  function statusOf(p) {
    if (p.retired) return "retired";
    if (liveVersion(p)) return "approved";
    var l = latestVersion(p);
    return l && l.status === "in_review" ? "in_review" : "draft";
  }
  var STATUS_LABEL = { draft: "Draft", in_review: "In review", approved: "Approved", retired: "Retired", superseded: "Superseded", withdrawn: "Withdrawn" };

  function nextReview(p) {
    if (p.retired || !p.lastReviewed || !liveVersion(p)) return null;
    return addMonths(p.lastReviewed, p.cycleMonths || 12);
  }
  function reviewState(p, t) {
    var n = nextReview(p);
    if (!n) return { state: "na", date: null, days: null };
    var d = diffDays(t || today(), n);
    return { state: d < 0 ? "overdue" : (d <= 30 ? "soon" : "ok"), date: n, days: d };
  }

  /* ---------- acknowledgements ---------- */
  function audience(st, p) {
    var all = p.audience.indexOf("*") !== -1;
    return st.staff.filter(function (s) { return all || p.audience.indexOf(s.team) !== -1; });
  }
  // The version people must have read: the latest approved version that asked for re-acknowledgement.
  function required(p) {
    var vs = p.versions, li = -1, i;
    for (i = vs.length - 1; i >= 0; i--) if (vs[i].status === "approved") { li = i; break; }
    if (li < 0) return null;
    for (i = li; i >= 0; i--) {
      if (vs[i].reattest !== false && (vs[i].status === "approved" || vs[i].status === "superseded")) return { idx: i, v: vs[i], live: vs[li] };
    }
    return { idx: li, v: vs[li], live: vs[li] };
  }
  function attestDue(p) {
    var r = required(p);
    return r ? addDays(r.v.approvedOn || r.v.date, p.attestDays || 30) : null;
  }
  function attestState(st, p, s, t) {
    var req = required(p);
    if (!req || p.retired) return null;
    var acks = (st.attest[p.id] || {})[s.id] || [];
    var ok = acks.filter(function (a) { return verIdx(p, a.ver) >= req.idx; });
    if (ok.length) return { state: "done", on: ok[0].on, ver: ok[0].ver, by: ok[0].by };
    var due = attestDue(p), late = diffDays(due, t || today());
    return { state: late > 0 ? "overdue" : "outstanding", due: due, late: late, earlier: acks.length ? acks[0] : null };
  }
  // All (policy, person) items for one policy
  function attestRows(st, p, t) {
    return audience(st, p).map(function (s) { return { staff: s, a: attestState(st, p, s, t) }; }).filter(function (r) { return r.a; });
  }
  function attestSummary(st, t) {
    var done = 0, out = 0, late = 0, people = {}, perPolicy = [];
    st.policies.forEach(function (p) {
      if (p.retired || !liveVersion(p)) return;
      var rows = attestRows(st, p, t), d = 0, o = 0, l = 0;
      rows.forEach(function (r) {
        if (r.a.state === "done") d++;
        else { o++; if (r.a.state === "overdue") l++; people[r.staff.id] = true; }
      });
      done += d; out += o; late += l;
      perPolicy.push({ p: p, total: rows.length, done: d, outstanding: o, overdue: l, due: attestDue(p), req: required(p) });
    });
    var total = done + out;
    return { done: done, outstanding: out, overdue: late, total: total, pct: total ? Math.round(100 * done / total) : 100, people: Object.keys(people).length, perPolicy: perPolicy };
  }
  function outstandingByPerson(st, t) {
    var map = {};
    st.policies.forEach(function (p) {
      if (p.retired || !liveVersion(p)) return;
      attestRows(st, p, t).forEach(function (r) {
        if (r.a.state === "done") return;
        (map[r.staff.id] = map[r.staff.id] || { staff: r.staff, items: [] }).items.push({ p: p, a: r.a });
      });
    });
    return Object.keys(map).map(function (k) { return map[k]; }).sort(function (x, y) {
      var ox = x.items.filter(function (i) { return i.a.state === "overdue"; }).length, oy = y.items.filter(function (i) { return i.a.state === "overdue"; }).length;
      return oy - ox || y.items.length - x.items.length || x.staff.name.localeCompare(y.staff.name);
    });
  }
  function lastReminderOn(st, staffId) {
    var best = null;
    st.reminders.forEach(function (r) { if (r.staff === staffId && (!best || r.on > best)) best = r.on; });
    return best;
  }

  /* ---------- obligation coverage ---------- */
  // state: governed | overdue (governed but review overdue) | pending (policy exists, not yet approved) | gap
  function coverage(st, obligations, controls, t) {
    var rows = obligations.map(function (o) {
      var ps = st.policies.filter(function (p) { return !p.retired && (p.obligation_ids || []).indexOf(o.id) !== -1; });
      var inForce = ps.filter(function (p) { return !!liveVersion(p); });
      var state = "gap";
      if (inForce.length) {
        state = inForce.some(function (p) { return reviewState(p, t).state !== "overdue"; }) ? "governed" : "overdue";
      } else if (ps.length) state = "pending";
      var nctl = (controls || []).filter(function (c) { return (c.obligation_ids || []).indexOf(o.id) !== -1; }).length;
      return { o: o, policies: ps, inForce: inForce, state: state, controls: nctl };
    });
    var c = { governed: 0, overdue: 0, pending: 0, gap: 0 };
    rows.forEach(function (r) { c[r.state]++; });
    var covered = c.governed + c.overdue;
    return { rows: rows, counts: c, covered: covered, total: rows.length, pct: rows.length ? Math.round(100 * covered / rows.length) : 0 };
  }

  /* ---------- operations (mutate st; caller saves) ---------- */
  function ensureRef(st, title) {
    var base = "POL", n = st.policies.length + 1, id;
    do { id = base + "-" + (n < 10 ? "0" + n : n); n++; } while (getPolicy(st, id));
    return id;
  }
  function createPolicy(st, o) {
    var id = ensureRef(st, o.title), t = today();
    var p = {
      id: id, ref: o.ref || id, title: o.title, kind: o.kind || "Policy", owner: o.owner || "", approver: o.approver || "",
      cycleMonths: o.cycleMonths || 12, attestDays: 30, audience: (o.audience && o.audience.length) ? o.audience : ["*"],
      obligation_ids: (o.obligation_ids || []).slice(), legal_refs: clone(o.legal_refs || []), template: o.template || "",
      demo: false, retired: null, draft: null, reviews: [], lastReviewed: null,
      versions: [{ ver: "0.1.0", date: t, by: o.by || o.owner || "", note: o.template ? "Started from the template outline." : "Created.", status: "draft", reattest: true, body: o.body || "" }]
    };
    st.policies.push(p);
    logEntry(st, o.by, id, "created", p.title);
    return p;
  }
  function setDraft(st, p, body) {
    var base = latestVersion(p);
    if (base && body === base.body) { p.draft = null; return; }
    p.draft = { body: body, basedOn: base ? base.ver : "", savedAt: new Date().toISOString() };
  }
  function currentText(p) { return p.draft ? p.draft.body : (latestVersion(p) ? latestVersion(p).body : ""); }
  function publish(st, p, o) {
    if (p.retired) return { error: "This policy is retired." };
    var pend = pendingVersion(p);
    if (pend && pend.status === "in_review") return { error: "Version " + pend.ver + " is waiting for approval. Approve, return or withdraw it first." };
    if (!String(o.note || "").trim()) return { error: "Say why this version exists: the change note is required." };
    var body = p.draft ? p.draft.body : currentText(p);
    var prev = latestVersion(p);
    if (prev && body === prev.body) return { error: "There are no changes to publish." };
    var ver = semBump(highestVersion(p) || "0.0.0", o.kind || "minor");
    var v = { ver: ver, date: today(), by: o.by, note: o.note.trim(), status: o.submit === false ? "draft" : "in_review", reattest: o.reattest !== false, body: body };
    if (o.effective) v.effective = o.effective;
    if (pend) pend.status = "superseded"; // an unsubmitted draft is replaced by the new version
    p.versions.push(v);
    p.draft = null;
    logEntry(st, o.by, p.id, "published", "v" + ver + " (" + (v.status === "in_review" ? "submitted for review" : "saved as draft") + "): " + v.note);
    return { version: v };
  }
  function submitForReview(st, p, by) {
    var v = pendingVersion(p);
    if (!v || v.status !== "draft") return { error: "Nothing to submit." };
    v.status = "in_review"; delete v.returned;
    logEntry(st, by, p.id, "submitted", "v" + v.ver + " submitted for review");
    return { version: v };
  }
  function approve(st, p, by, note) {
    var v = pendingVersion(p);
    if (!v || v.status !== "in_review") return { error: "No version is waiting for approval." };
    var t = today();
    p.versions.forEach(function (x) { if (x.status === "approved") x.status = "superseded"; });
    v.status = "approved"; v.approvedBy = by; v.approvedOn = t; v.approvalNote = note || ""; v.selfApproved = (by === v.by);
    v.effective = v.effective && v.effective > t ? v.effective : t;
    p.lastReviewed = t;
    logEntry(st, by, p.id, "approved", "v" + v.ver + (v.selfApproved ? " (approver is also the author)" : "") + (note ? ": " + note : ""));
    return { version: v };
  }
  function returnToAuthor(st, p, by, why) {
    var v = pendingVersion(p);
    if (!v || v.status !== "in_review") return { error: "No version is in review." };
    v.status = "draft"; v.returned = { by: by, on: today(), why: why };
    if (!p.draft) p.draft = { body: v.body, basedOn: v.ver, savedAt: new Date().toISOString() };
    logEntry(st, by, p.id, "returned", "v" + v.ver + " returned to the author: " + why);
    return { version: v };
  }
  function withdraw(st, p, by, why) {
    var v = pendingVersion(p);
    if (!v) return { error: "No pending version." };
    v.status = "withdrawn"; v.withdrawn = { by: by, on: today(), why: why };
    if (!p.draft) p.draft = { body: v.body, basedOn: v.ver, savedAt: new Date().toISOString() };
    logEntry(st, by, p.id, "withdrawn", "v" + v.ver + ": " + why);
    return { version: v };
  }
  function recordReview(st, p, by, note) {
    if (!liveVersion(p)) return { error: "Only an approved policy can be reviewed." };
    var t = today();
    p.reviews.push({ on: t, by: by, note: note });
    p.lastReviewed = t;
    logEntry(st, by, p.id, "reviewed", note || "Periodic review, no change");
    return {};
  }
  function retire(st, p, by, why) {
    p.retired = { on: today(), by: by, why: why };
    logEntry(st, by, p.id, "retired", why);
  }
  function reinstate(st, p, by, why) {
    p.retired = null;
    logEntry(st, by, p.id, "reinstated", why);
  }
  function acknowledge(st, p, staffId, by) {
    var req = required(p);
    if (!req) return { error: "No approved version to acknowledge." };
    var list = (st.attest[p.id] = st.attest[p.id] || {});
    var acks = (list[staffId] = list[staffId] || []);
    var s = getStaff(st, staffId);
    acks.unshift({ ver: req.live.ver, on: today(), by: by === (s && s.name) ? "self" : "Recorded by " + by });
    logEntry(st, by, p.id, "acknowledged", (s ? s.name : staffId) + " read v" + req.live.ver);
    return {};
  }
  function remind(st, staffId, policyIds, by, note) {
    var r = { on: today(), by: by, staff: staffId, policies: policyIds.slice(), note: note || "" };
    st.reminders.push(r);
    var s = getStaff(st, staffId);
    logEntry(st, by, policyIds.length === 1 ? policyIds[0] : "", "reminded", (s ? s.name : staffId) + ": " + policyIds.length + " outstanding");
    return r;
  }
  function addStaff(st, name, team, role) {
    var s = { id: "s" + Date.now().toString(36) + Math.floor(Math.random() * 99), name: name, team: team, role: role || "" };
    st.staff.push(s);
    if (team && st.teams.indexOf(team) === -1) st.teams.push(team);
    return s;
  }
  function removeStaff(st, id) {
    st.staff = st.staff.filter(function (s) { return s.id !== id; });
    if (st.me === id) st.me = st.staff[0] ? st.staff[0].id : "";
  }

  /* ---------- markdown (small, safe subset) ---------- */
  function safeUrl(u) { return /^(https?:\/\/|mailto:|#|\/?[\w.\/-]+\.html)/i.test(u) && !/^javascript:/i.test(u); }
  function inline(s) {
    s = esc(s);
    s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
    s = s.replace(/\*\*([^*]+?)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/(^|[\s(])\*(?!\s)([^*]+?)\*(?=[\s).,;:!?]|$)/g, "$1<em>$2</em>");
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (m, t, u) {
      var raw = u.replace(/&amp;/g, "&");
      return safeUrl(raw) ? '<a href="' + u + '" rel="noopener">' + t + "</a>" : m;
    });
    return s;
  }
  var LI = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
  var SEP = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;
  function cells(line) {
    var t = line.trim();
    if (t.charAt(0) === "|") t = t.slice(1);
    if (t.charAt(t.length - 1) === "|") t = t.slice(0, -1);
    return t.split("|").map(function (c) { return c.trim(); });
  }
  function buildList(items) {
    var html = "", stack = [];
    items.forEach(function (it) {
      var tag = it.ord ? "ol" : "ul";
      while (stack.length && it.lvl < stack[stack.length - 1].lvl) html += "</li></" + stack.pop().tag + ">";
      if (!stack.length || it.lvl > stack[stack.length - 1].lvl) { html += "<" + tag + ">"; stack.push({ lvl: it.lvl, tag: tag }); }
      else html += "</li>";
      html += "<li>" + inline(it.text);
    });
    while (stack.length) html += "</li></" + stack.pop().tag + ">";
    return html;
  }
  function renderMd(src, opts) {
    var base = (opts && opts.base) || 2;
    var lines = String(src || "").replace(/\r\n?/g, "\n").split("\n"), out = [], buf = [], i = 0;
    function flush() { if (buf.length) { out.push("<p>" + inline(buf.join(" ")) + "</p>"); buf = []; } }
    while (i < lines.length) {
      var ln = lines[i], m;
      if (/^\s*$/.test(ln)) { flush(); i++; continue; }
      if (/^```/.test(ln)) {
        flush(); var code = []; i++;
        while (i < lines.length && !/^```/.test(lines[i])) { code.push(lines[i]); i++; }
        i++; out.push("<pre><code>" + esc(code.join("\n")) + "</code></pre>"); continue;
      }
      if ((m = /^(#{1,4})\s+(.*?)\s*#*\s*$/.exec(ln))) {
        flush(); var lv = m[1].length;
        out.push("<h" + Math.min(lv + base - 1, 6) + ' class="md-h' + lv + '">' + inline(m[2]) + "</h" + Math.min(lv + base - 1, 6) + ">"); i++; continue;
      }
      if (/^\s*(-{3,}|\*{3,})\s*$/.test(ln)) { flush(); out.push("<hr>"); i++; continue; }
      if (/^>/.test(ln)) {
        flush(); var q = [];
        while (i < lines.length && /^>/.test(lines[i])) { q.push(lines[i].replace(/^>\s?/, "")); i++; }
        if (/^TO ANSWER:/i.test(q[0])) {
          var lis = [];
          q.forEach(function (l) {
            if (/^TO ANSWER:/i.test(l)) lis.push(l.replace(/^TO ANSWER:\s*/i, ""));
            else if (lis.length && l.trim()) lis[lis.length - 1] += " " + l.trim();
          });
          out.push('<div class="md-prompt"><strong>To answer</strong><ul>' + lis.map(function (x) { return "<li>" + inline(x) + "</li>"; }).join("") + "</ul></div>");
        } else out.push("<blockquote>" + renderMd(q.join("\n"), opts) + "</blockquote>");
        continue;
      }
      if (LI.test(ln)) {
        flush(); var items = [];
        while (i < lines.length && (m = LI.exec(lines[i]))) {
          items.push({ lvl: Math.floor(m[1].replace(/\t/g, "    ").length / 2), ord: /\d/.test(m[2]), text: m[3] }); i++;
        }
        out.push(buildList(items)); continue;
      }
      if (ln.indexOf("|") !== -1 && i + 1 < lines.length && SEP.test(lines[i + 1]) && lines[i + 1].indexOf("-") !== -1) {
        flush();
        var head = cells(ln), rows = []; i += 2;
        while (i < lines.length && lines[i].indexOf("|") !== -1 && !/^\s*$/.test(lines[i])) { rows.push(cells(lines[i])); i++; }
        out.push('<div class="md-table"><table><thead><tr>' + head.map(function (c) { return '<th scope="col">' + inline(c) + "</th>"; }).join("") +
          "</tr></thead><tbody>" + rows.map(function (r) {
            return "<tr>" + head.map(function (_, k) { return "<td>" + inline(r[k] || "") + "</td>"; }).join("") + "</tr>";
          }).join("") + "</tbody></table></div>");
        continue;
      }
      buf.push(ln.trim()); i++;
    }
    flush();
    return out.join("\n");
  }
  function countPrompts(src) {
    return String(src || "").split("\n").filter(function (l) { return /^>\s?TO ANSWER:/i.test(l); }).length;
  }
  function wordCount(src) { var m = String(src || "").match(/\S+/g); return m ? m.length : 0; }

  /* ---------- diff ---------- */
  function lcsOps(A, B) {
    var n = A.length, m = B.length, ops = [], i, j;
    if (n * m > 2500000) {
      A.forEach(function (x) { ops.push({ t: "-", s: x }); });
      B.forEach(function (x) { ops.push({ t: "+", s: x }); });
      return ops;
    }
    var L = [];
    for (i = 0; i <= n; i++) L.push(new Uint16Array(m + 1));
    for (i = n - 1; i >= 0; i--) for (j = m - 1; j >= 0; j--) L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    i = 0; j = 0;
    while (i < n && j < m) {
      if (A[i] === B[j]) { ops.push({ t: "=", s: A[i] }); i++; j++; }
      else if (L[i + 1][j] >= L[i][j + 1]) { ops.push({ t: "-", s: A[i] }); i++; }
      else { ops.push({ t: "+", s: B[j] }); j++; }
    }
    while (i < n) { ops.push({ t: "-", s: A[i++] }); }
    while (j < m) { ops.push({ t: "+", s: B[j++] }); }
    return ops;
  }
  function diffLines(a, b) {
    var s = 0, ea = a.length, eb = b.length, ops = [], k;
    while (s < ea && s < eb && a[s] === b[s]) s++;
    while (ea > s && eb > s && a[ea - 1] === b[eb - 1]) { ea--; eb--; }
    for (k = 0; k < s; k++) ops.push({ t: "=", s: a[k] });
    lcsOps(a.slice(s, ea), b.slice(s, eb)).forEach(function (o) { ops.push(o); });
    for (k = ea; k < a.length; k++) ops.push({ t: "=", s: a[k] });
    var la = 0, lb = 0;
    ops.forEach(function (o) {
      if (o.t === "=") { o.a = ++la; o.b = ++lb; }
      else if (o.t === "-") { o.a = ++la; }
      else { o.b = ++lb; }
    });
    return ops;
  }
  function wordDiff(a, b) {
    var A = a.split(/(\s+)/), B = b.split(/(\s+)/);
    var ops = lcsOps(A, B), ha = "", hb = "";
    ops.forEach(function (o) {
      if (o.t === "=") { ha += esc(o.s); hb += esc(o.s); }
      else if (o.t === "-") ha += /^\s+$/.test(o.s) ? esc(o.s) : '<del class="w">' + esc(o.s) + "</del>";
      else hb += /^\s+$/.test(o.s) ? esc(o.s) : '<ins class="w">' + esc(o.s) + "</ins>";
    });
    return { a: ha, b: hb };
  }
  // Returns { html, add, del, same }
  function diffHtml(oldText, newText, showAll) {
    var a = String(oldText || "").split("\n"), b = String(newText || "").split("\n");
    var ops = diffLines(a, b), add = 0, del = 0;
    ops.forEach(function (o) { if (o.t === "+") add++; else if (o.t === "-") del++; });
    if (!add && !del) return { html: "", add: 0, del: 0, same: true };
    // pair removed/added runs of equal length for word-level marks
    var i = 0;
    while (i < ops.length) {
      if (ops[i].t === "-") {
        var j = i; while (j < ops.length && ops[j].t === "-") j++;
        var k = j; while (k < ops.length && ops[k].t === "+") k++;
        var nd = j - i, na = k - j;
        if (nd === na) {
          for (var x = 0; x < nd; x++) {
            var w = wordDiff(ops[i + x].s, ops[j + x].s);
            ops[i + x].h = w.a; ops[j + x].h = w.b;
          }
        }
        i = k;
      } else i++;
    }
    var CTX = 2, show = new Array(ops.length);
    ops.forEach(function (o, idx) {
      if (showAll || o.t !== "=") {
        for (var d = -CTX; d <= CTX; d++) if (idx + d >= 0 && idx + d < ops.length) show[idx + d] = true;
        show[idx] = true;
      }
    });
    if (showAll) ops.forEach(function (_, idx) { show[idx] = true; });
    var html = "", hidden = 0;
    function flushHidden() {
      if (hidden) html += '<tr class="d-skip"><td colspan="4">' + hidden + " unchanged line" + (hidden === 1 ? "" : "s") + " not shown</td></tr>";
      hidden = 0;
    }
    ops.forEach(function (o, idx) {
      if (!show[idx]) { hidden++; return; }
      flushHidden();
      var cls = o.t === "+" ? "d-add" : (o.t === "-" ? "d-del" : "d-eq");
      var sign = o.t === "+" ? '+<span class="sr-only"> added line</span>' : (o.t === "-" ? '&minus;<span class="sr-only"> removed line</span>' : "");
      html += '<tr class="' + cls + '"><td class="n">' + (o.a || "") + '</td><td class="n">' + (o.b || "") + '</td><td class="sg">' + sign + '</td><td class="tx">' + (o.h || esc(o.s) || "&nbsp;") + "</td></tr>";
    });
    flushHidden();
    return { html: html, add: add, del: del, same: false };
  }

  /* ---------- csv ---------- */
  function csvCell(x) {
    var s = String(x == null ? "" : x);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // spreadsheet formula guard
    return '"' + s.replace(/"/g, '""') + '"';
  }
  function csv(rows) { return rows.map(function (r) { return r.map(csvCell).join(","); }).join("\r\n"); }

  return {
    KEY: KEY, today: today, iso: iso, parse: parse, addDays: addDays, addMonths: addMonths, diffDays: diffDays, fmt: fmt, fmtTime: fmtTime,
    clone: clone, esc: esc, semCmp: semCmp, semBump: semBump, highestVersion: highestVersion,
    loadLocal: loadLocal, save: save, clear: clear, emptyState: emptyState, fromSeed: fromSeed, logEntry: logEntry,
    getPolicy: getPolicy, getStaff: getStaff, staffByName: staffByName, liveVersion: liveVersion, latestVersion: latestVersion,
    pendingVersion: pendingVersion, findVersion: findVersion, verIdx: verIdx, statusOf: statusOf, STATUS_LABEL: STATUS_LABEL,
    nextReview: nextReview, reviewState: reviewState,
    audience: audience, required: required, attestDue: attestDue, attestState: attestState, attestRows: attestRows,
    attestSummary: attestSummary, outstandingByPerson: outstandingByPerson, lastReminderOn: lastReminderOn,
    coverage: coverage,
    createPolicy: createPolicy, setDraft: setDraft, currentText: currentText, publish: publish, submitForReview: submitForReview,
    approve: approve, returnToAuthor: returnToAuthor, withdraw: withdraw, recordReview: recordReview, retire: retire, reinstate: reinstate,
    acknowledge: acknowledge, remind: remind, addStaff: addStaff, removeStaff: removeStaff,
    renderMd: renderMd, countPrompts: countPrompts, wordCount: wordCount, diffHtml: diffHtml, csv: csv
  };
})();
