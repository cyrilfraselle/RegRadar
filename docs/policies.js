/* ═══════════════════════════════════════════════════════════════
   RegRadar: policies and procedures page (epic E6)
   UI for the library, coverage, attestations and templates.
   All logic lives in policies-data.js; state is device-local.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  var PD = window.PolicyData, esc = PD.esc;
  var AMLR = "32024R1624";
  var ST = null, OBS = [], CONTROLS = [], APP = null, TPL = [], SEED = null, LAWIDX = [], LAWS = {};
  var T = PD.today();
  var S = {
    tab: "library", sel: null, dtab: "overview", q: "", fs: "all", fover: false, fob: null,
    cov: "all", covTopic: null, mapRow: null, att: "person", cmpA: null, cmpB: null, showAll: false, viewVer: null,
    tpl: {}, lawOpen: {}, mapOpen: false, refAdd: false, refCelex: "", edMode: window.innerWidth >= 1280 ? "split" : "write", opener: null
  };
  var $ = function (id) { return document.getElementById(id); };
  function pl(n, w, w2) { return n + " " + (n === 1 ? w : (w2 || w + "s")); }
  function norm(s) { return String(s || "").replace(/\s+/g, " ").trim(); }
  function readLS(k) { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } }
  function toast(m) {
    var t = $("toast"); t.textContent = m; t.classList.add("on");
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove("on"); }, 2600);
  }
  function persist() { if (!PD.save(ST)) toast("Could not save on this device (storage is full or blocked)."); }
  function me() { return PD.getStaff(ST, ST.me) || ST.staff[0] || { id: "", name: "Unknown", team: "" }; }
  function meName() { return me().name; }
  function cur() { return S.sel ? PD.getPolicy(ST, S.sel) : null; }
  function fmt(d) { return PD.fmt(d); }
  function keepFocus(fn) {
    var a = document.activeElement, key = a && (a.getAttribute("data-fk") || a.id);
    fn();
    if (key) { var n = document.querySelector('[data-fk="' + key + '"]') || document.getElementById(key); if (n) n.focus(); }
  }

  /* ---------- laws ---------- */
  function loadLaw(celex) {
    if (LAWS[celex] !== undefined) return Promise.resolve(LAWS[celex]);
    return fetch("data/laws/" + celex + "_EN.json").then(function (r) { if (!r.ok) throw new Error("x"); return r.json(); }).then(function (j) {
      var m = {}; j.articles.forEach(function (a) { m[String(a.id)] = a; });
      LAWS[celex] = { name: j.name, celex: celex, arts: m, list: j.articles }; return LAWS[celex];
    }).catch(function () { LAWS[celex] = null; return null; });
  }
  function needLaws(celexes) {
    var u = {}; celexes.forEach(function (c) { if (c) u[c] = true; });
    var todo = Object.keys(u).filter(function (c) { return LAWS[c] === undefined; });
    if (!todo.length) return Promise.resolve(false);
    return Promise.all(todo.map(loadLaw)).then(function () { return true; });
  }
  function lawName(celex) {
    var e = LAWIDX.filter(function (x) { return x.celex === celex; })[0];
    return e ? e.name : celex;
  }
  function refLabel(r) { return lawName(r.celex) + " Art. " + r.art; }
  function refInfo(r) {
    var L = LAWS[r.celex];
    if (L === undefined) return { loading: true };
    if (!L) return { missing: true };
    var a = L.arts[String(r.art)];
    if (!a) return { missing: true };
    return { a: a, qok: r.quote ? norm(a.text).indexOf(norm(r.quote)) !== -1 : null };
  }
  function lawHref(r) { return "law.html?celex=" + encodeURIComponent(r.celex) + "&art=" + encodeURIComponent(r.art); }
  function artNum(o) { var m = (o.source_url || "").match(/art=(\d+)/); return m ? m[1] : ((o.legal_basis || "").match(/(\d+)/) || [])[1]; }
  function titleOf(o) {
    var L = LAWS[AMLR], a = L && L.arts[String(artNum(o))];
    return a ? a.title : (o.what.length > 70 ? o.what.slice(0, 67) + "…" : o.what);
  }
  function obById(id) { return OBS.filter(function (o) { return o.id === id; })[0]; }
  function obLabel(o) { return o.legal_basis + ": " + titleOf(o); }
  function entityLabel(id) { var e = ((APP && APP.entities) || []).filter(function (x) { return x.id === id; })[0]; return e ? e.label : id; }
  function scopeInfo() {
    var prof = readLS("regradar-profile") || {}, mine = readLS("regradar-obligations-mine") || {};
    var ent = prof.entity || "", dis = mine.dismissed || {};
    var list = OBS.filter(function (o) { return (!ent || (o.who || []).indexOf(ent) !== -1) && !dis[o.id]; });
    return { list: list, entity: ent, label: ent ? entityLabel(ent) : "", dismissed: OBS.filter(function (o) { return dis[o.id]; }).length };
  }

  /* ---------- small renderers ---------- */
  function stCls(s) { return { approved: "cov", in_review: "rev", draft: "drf", retired: "drf", superseded: "drf", withdrawn: "drf" }[s] || "drf"; }
  function stChip(s) { return '<span class="st ' + stCls(s) + '">' + esc(PD.STATUS_LABEL[s] || s) + "</span>"; }
  function reviewTxt(p) {
    var r = PD.reviewState(p, T);
    if (r.state === "na") return { t: p.retired ? "Retired " + fmt(p.retired.on) : "Review starts once approved", cls: "" };
    if (r.state === "overdue") return { t: "Review overdue by " + pl(-r.days, "day"), cls: "late" };
    if (r.state === "soon") return { t: "Review due in " + pl(r.days, "day") + " (" + fmt(r.date) + ")", cls: "" };
    return { t: "Next review " + fmt(r.date), cls: "" };
  }
  function bar(pct, label) {
    var cls = pct >= 80 ? "" : (pct >= 50 ? "low" : "bad");
    return '<div class="bar ' + cls + '" role="img" aria-label="' + esc(label || pct + " percent") + '"><span style="width:' + pct + '%"></span></div>';
  }
  function empty(msg, btn) { return '<div class="empty">' + msg + (btn || "") + "</div>"; }
  function attestFor(p) {
    var rows = PD.attestRows(ST, p, T), d = rows.filter(function (r) { return r.a.state === "done"; }).length;
    return { rows: rows, done: d, total: rows.length, pct: rows.length ? Math.round(100 * d / rows.length) : 100 };
  }

  /* ═══════════ boot ═══════════ */
  function getJ(u) { return fetch(u, { cache: "no-store" }).then(function (r) { if (!r.ok) throw new Error(u); return r.json(); }); }
  function boot() {
    Promise.all([
      getJ("data/obligations.json"), getJ("data/policies-seed.json"), getJ("data/policies-templates.json"),
      getJ("data/laws/index.json").catch(function () { return []; }),
      getJ("data/applicability.json").catch(function () { return null; }),
      (window.ControlsData ? ControlsData.load().catch(function () { return null; }) : Promise.resolve(null)),
      loadLaw(AMLR)
    ]).then(function (r) {
      OBS = r[0].obligations || []; SEED = r[1]; TPL = r[2].templates || []; LAWIDX = r[3] || []; APP = r[4];
      CONTROLS = r[5] ? r[5].controls : [];
      ST = PD.loadLocal();
      if (!ST) { ST = PD.fromSeed(SEED); persist(); }
      init();
    }).catch(function () {
      $("detail").innerHTML = empty("Could not load the policy data. Check your connection and reload.");
    });
  }
  function init() {
    var p = new URLSearchParams(location.search);
    if (p.get("tab") && ["library", "coverage", "attest", "templates"].indexOf(p.get("tab")) !== -1) S.tab = p.get("tab");
    if (p.get("obligation") && obById(p.get("obligation"))) { S.fob = p.get("obligation"); S.tab = "library"; }
    if (p.get("open") && PD.getPolicy(ST, p.get("open"))) { S.sel = p.get("open"); S.tab = "library"; }
    if (p.get("dtab") && ["overview", "document", "versions", "attest"].indexOf(p.get("dtab")) !== -1) S.dtab = p.get("dtab");
    if (!S.sel) { var l = visibleList(); if (l.length) S.sel = l[0].id; }
    renderMeSel(); renderAll();
    var cel = {};
    ST.policies.forEach(function (x) { (x.legal_refs || []).forEach(function (r) { cel[r.celex] = true; }); });
    needLaws(Object.keys(cel)).then(function (changed) { if (changed) renderAll(); });
  }

  /* ═══════════ chrome ═══════════ */
  function renderMeSel() {
    $("meSel").innerHTML = ST.staff.map(function (s) {
      return '<option value="' + esc(s.id) + '"' + (s.id === ST.me ? " selected" : "") + ">" + esc(s.name) + " (" + esc(s.team) + ")</option>";
    }).join("");
    if (!ST.staff.length) $("meSel").innerHTML = '<option value="">Add staff first</option>';
  }
  function renderAll() {
    var tabs = ["library", "coverage", "attest", "templates"];
    tabs.forEach(function (t) {
      var on = S.tab === t;
      $("t-" + t).setAttribute("aria-selected", on); $("t-" + t).tabIndex = on ? 0 : -1;
      $("panel-" + t).hidden = !on;
    });
    $("foot").firstChild.textContent = (ST.demo ? "Demo data for a fictional firm (CF Bank). " : "") + "Everything you change stays on this device. Not legal advice or an audit opinion. ";
    renderFoot();
    renderKpis();
    if (S.tab === "library") { renderFilters(); renderItems(); renderDetail(); }
    else if (S.tab === "coverage") renderCoverage();
    else if (S.tab === "attest") renderAttest();
    else renderTemplates();
    try {
      var u = new URL(location.href); u.search = "";
      if (S.tab !== "library") u.searchParams.set("tab", S.tab);
      if (S.tab === "library" && S.sel) { u.searchParams.set("open", S.sel); if (S.dtab !== "overview") u.searchParams.set("dtab", S.dtab); }
      history.replaceState(null, "", u);
    } catch (e) { /* ignore */ }
  }
  function renderFoot() {
    var f = $("foot");
    if (!f.querySelector("button")) {
      var b = document.createElement("button"); b.type = "button"; b.setAttribute("data-act", "data"); b.textContent = "Backup, restore or reset data";
      f.appendChild(b);
    }
  }
  function renderKpis() {
    var active = ST.policies.filter(function (p) { return !p.retired; });
    var inForce = active.filter(function (p) { return PD.liveVersion(p); }).length;
    var inRev = active.filter(function (p) { return PD.statusOf(p) === "in_review" || (PD.liveVersion(p) && PD.pendingVersion(p) && PD.pendingVersion(p).status === "in_review"); }).length;
    var drafts = active.filter(function (p) { return PD.statusOf(p) === "draft"; }).length;
    var over = 0, soon = 0;
    active.forEach(function (p) { var r = PD.reviewState(p, T); if (r.state === "overdue") over++; else if (r.state === "soon") soon++; });
    var sc = scopeInfo(), cov = PD.coverage(ST, sc.list, CONTROLS, T);
    var as = PD.attestSummary(ST, T);
    var C = 2 * Math.PI * 24;
    function ring(pct) {
      var cls = pct >= 80 ? "" : (pct >= 50 ? "low" : "bad");
      return '<svg class="ring ' + cls + '" viewBox="0 0 60 60" role="img" aria-label="' + pct + ' percent"><circle class="bg" cx="30" cy="30" r="24"/><circle class="fg" cx="30" cy="30" r="24" transform="rotate(-90 30 30)" stroke-dasharray="' + C.toFixed(1) + '" stroke-dashoffset="' + (C * (1 - pct / 100)).toFixed(1) + '"/></svg>';
    }
    $("kpis").innerHTML =
      '<button type="button" class="kpi" data-act="kpi" data-to="library"><div><div class="n mono">' + inForce + '<span style="font-size:16px;color:var(--text-3)"> / ' + active.length + '</span></div><div class="l">Policies in force</div><div class="s">' + inRev + " in review · " + drafts + " draft</div></div></button>" +
      '<button type="button" class="kpi' + (over ? " warn" : "") + '" data-act="kpi" data-to="overdue"><div><div class="n mono" style="color:' + (over ? "var(--crit)" : "var(--ok)") + '">' + over + '</div><div class="l">Reviews overdue</div><div class="s">' + soon + " more due within 30 days</div></div></button>" +
      '<button type="button" class="kpi" data-act="kpi" data-to="coverage">' + ring(cov.pct) + '<div><div class="n mono">' + cov.pct + '%</div><div class="l">Obligations governed</div><div class="s">' + cov.covered + " of " + cov.total + " in the register</div></div></button>" +
      '<button type="button" class="kpi' + (as.overdue ? " warn" : "") + '" data-act="kpi" data-to="attest">' + ring(as.pct) + '<div><div class="n mono">' + as.pct + '%</div><div class="l">Acknowledged</div><div class="s">' + as.outstanding + " outstanding · " + as.overdue + " overdue</div></div></button>";
  }

  /* ═══════════ library: list ═══════════ */
  function attention(p) {
    var s = PD.statusOf(p), r = PD.reviewState(p, T).state;
    if (s === "retired") return 9;
    if (r === "overdue") return 0;
    var pv = PD.pendingVersion(p);
    if (pv && pv.status === "in_review") return 1;
    if (s === "draft") return 2;
    if (r === "soon") return 3;
    return 4;
  }
  function visibleList() {
    var q = S.q.trim().toLowerCase();
    var l = ST.policies.filter(function (p) {
      var s = PD.statusOf(p);
      if (S.fs !== "all" && s !== S.fs) return false;
      if (S.fover && !(PD.reviewState(p, T).state === "overdue")) return false;
      if (S.fob && (p.obligation_ids || []).indexOf(S.fob) === -1) return false;
      if (q && (p.title + " " + p.ref + " " + p.owner + " " + p.kind).toLowerCase().indexOf(q) === -1) return false;
      return true;
    });
    l.sort(function (a, b) { return attention(a) - attention(b) || (a.ref < b.ref ? -1 : 1); });
    return l;
  }
  function renderFilters() {
    var cnt = { all: ST.policies.length, approved: 0, in_review: 0, draft: 0, retired: 0 }, over = 0;
    ST.policies.forEach(function (p) { cnt[PD.statusOf(p)]++; if (PD.reviewState(p, T).state === "overdue") over++; });
    var h = "";
    [["all", "All"], ["approved", "Approved"], ["in_review", "In review"], ["draft", "Draft"], ["retired", "Retired"]].forEach(function (x) {
      h += '<button type="button" class="chip" data-act="fstatus" data-s="' + x[0] + '" aria-pressed="' + (S.fs === x[0]) + '">' + x[1] + ' <span class="mono">' + cnt[x[0]] + "</span></button>";
    });
    h += '<button type="button" class="chip" data-act="fover" aria-pressed="' + S.fover + '">Review overdue <span class="mono">' + over + "</span></button>";
    if (S.fob) {
      var o = obById(S.fob);
      h += '<button type="button" class="chip" data-act="clearob" aria-pressed="true" aria-label="Clear obligation filter">Governs ' + esc(o ? o.legal_basis : S.fob) + " ✕</button>";
    }
    $("filters").innerHTML = h;
  }
  function renderItems() {
    var l = visibleList();
    if (!l.length) {
      $("items").innerHTML = '<li>' + empty(ST.policies.length ? "No policies match." : "No policies yet.", ST.policies.length ? "" : '<br><button type="button" class="btn pri" data-act="newpol">Create the first policy</button>') + "</li>";
      return;
    }
    $("items").innerHTML = l.map(function (p) {
      var live = PD.liveVersion(p), lat = PD.latestVersion(p), pv = PD.pendingVersion(p), rv = reviewTxt(p);
      var meta = "v" + (live ? live.ver : (lat ? lat.ver : "?")) + " · " + esc(p.owner || "No owner");
      return '<li><button type="button" class="item" data-act="sel" data-id="' + esc(p.id) + '" data-fk="item-' + esc(p.id) + '" aria-current="' + (S.sel === p.id) + '">' +
        '<span><span class="a">' + esc(p.ref) + " · " + esc(p.kind) + '</span><span class="t" style="display:block">' + esc(p.title) + "</span>" +
        '<span class="m" style="display:block">' + meta + "</span>" +
        '<span class="m ' + rv.cls + '" style="display:block">' + esc(rv.t) + "</span>" +
        (live && pv ? '<span class="m" style="display:block">v' + esc(pv.ver) + (pv.status === "in_review" ? " awaiting approval" : " draft in progress") + "</span>" : "") +
        "</span>" + stChip(PD.statusOf(p)) + "</button></li>";
    }).join("");
  }

  /* ═══════════ library: detail ═══════════ */
  var DTABS = [["overview", "Overview"], ["document", "Document"], ["versions", "Versions"], ["attest", "Acknowledgements"]];
  function renderDetail() {
    flushDraft();
    var p = cur(), el = $("detail");
    if (!p) { el.innerHTML = empty(ST.policies.length ? "Select a policy." : "Create a policy, or start from a template outline.", '<br><button type="button" class="btn pri" data-act="newpol">New policy</button>'); return; }
    var live = PD.liveVersion(p), lat = PD.latestVersion(p), pv = PD.pendingVersion(p);
    var h = '<div class="d-art"><span class="mono" style="font-weight:700;color:var(--text)">' + esc(p.ref) + '</span><span class="chip">' + esc(p.kind) + "</span>" + stChip(PD.statusOf(p)) +
      (live ? '<span class="chip mono">v' + esc(live.ver) + " live</span>" : "") +
      (pv ? '<span class="chip imp mono">v' + esc(pv.ver) + (pv.status === "in_review" ? " in review" : " draft") + "</span>" : "") +
      (p.demo ? '<span class="chip">Demo</span>' : "") + "</div>" +
      '<input class="titleinput" data-f="title" value="' + esc(p.title) + '" aria-label="Policy title"' + (p.retired ? " readonly" : "") + ">" +
      '<div class="dtabs" role="tablist" aria-label="Policy sections">' + DTABS.map(function (t) {
        return '<button type="button" class="dtab" role="tab" id="dt-' + t[0] + '" data-act="dtab" data-d="' + t[0] + '" aria-selected="' + (S.dtab === t[0]) + '" aria-controls="dpanel" tabindex="' + (S.dtab === t[0] ? 0 : -1) + '">' + t[1] + "</button>";
      }).join("") + "</div>" +
      '<div id="dpanel" role="tabpanel" aria-labelledby="dt-' + S.dtab + '">';
    if (S.dtab === "overview") h += ovHtml(p);
    else if (S.dtab === "document") h += docHtml(p);
    else if (S.dtab === "versions") h += verHtml(p);
    else h += polAttHtml(p);
    h += "</div>";
    el.innerHTML = h;
    if (S.dtab === "document") bindEditor();
    var need = (p.legal_refs || []).map(function (r) { return r.celex; });
    if (need.some(function (c) { return LAWS[c] === undefined; })) needLaws(need).then(function (ch) { if (ch && cur() === p && S.tab === "library") keepFocus(renderDetail); });
  }

  /* ----- overview ----- */
  function actionsHtml(p) {
    var pv = PD.pendingVersion(p), live = PD.liveVersion(p), h = "";
    if (p.retired) {
      h += '<button type="button" class="btn sm pri" data-act="reinstate">Reinstate</button>';
    } else {
      if (pv && pv.status === "in_review") h += '<button type="button" class="btn sm pri" data-act="approve">Approve v' + esc(pv.ver) + '…</button><button type="button" class="btn sm" data-act="return">Return to author…</button>';
      if (pv && pv.status === "draft") h += '<button type="button" class="btn sm pri" data-act="submitrev">Submit v' + esc(pv.ver) + " for review</button>";
      if (live && !pv) h += '<button type="button" class="btn sm" data-act="review">Record periodic review…</button>';
      else if (live && pv) h += '<button type="button" class="btn sm" data-act="review">Record periodic review…</button>';
      h += '<button type="button" class="btn sm" data-act="godoc">Edit and publish</button>';
    }
    h += '<button type="button" class="btn sm" data-act="print" data-ver="' + esc((live || PD.latestVersion(p) || {}).ver || "") + '">Print / save as PDF</button>';
    if (!p.retired) h += '<button type="button" class="btn sm danger" data-act="retire">Retire…</button>';
    return '<div class="row-actions">' + h + "</div>";
  }
  function ovHtml(p) {
    var rs = PD.reviewState(p, T), rv = reviewTxt(p), nr = PD.nextReview(p);
    var h = actionsHtml(p);
    if (p.retired) h += '<div class="notice" style="margin-top:14px"><b>Retired ' + esc(fmt(p.retired.on)) + "</b> by " + esc(p.retired.by) + ". " + esc(p.retired.why) + "</div>";
    h += '<div class="blk"><h4>Governance</h4><div class="fields">' +
      '<div class="field"><label for="f-owner">Owner</label><input class="in" id="f-owner" data-f="owner" list="staffNames" value="' + esc(p.owner) + '"' + (p.retired ? " disabled" : "") + "></div>" +
      '<div class="field"><label for="f-appr">Approver</label><input class="in" id="f-appr" data-f="approver" list="staffNames" value="' + esc(p.approver) + '"' + (p.retired ? " disabled" : "") + "></div>" +
      '<div class="field"><label for="f-cycle">Review cycle</label><select class="sel" id="f-cycle" data-f="cycleMonths"' + (p.retired ? " disabled" : "") + ">" +
      [3, 6, 12, 18, 24, 36].map(function (m) { return '<option value="' + m + '"' + (m === p.cycleMonths ? " selected" : "") + ">Every " + m + " months</option>"; }).join("") + "</select></div>" +
      '<div class="field"><label for="f-att">Acknowledge within</label><select class="sel" id="f-att" data-f="attestDays"' + (p.retired ? " disabled" : "") + ">" +
      [7, 14, 30, 60, 90].map(function (m) { return '<option value="' + m + '"' + (m === p.attestDays ? " selected" : "") + ">" + m + " days of approval</option>"; }).join("") + "</select></div>" +
      '<div class="field"><span class="lab">Last reviewed or approved</span><div class="ro">' + (p.lastReviewed ? esc(fmt(p.lastReviewed)) : "Not yet") + "</div></div>" +
      '<div class="field"><span class="lab">Next review</span><div class="ro">' + (nr ? esc(fmt(nr)) + ' <span class="st ' + (rs.state === "overdue" ? "gap" : (rs.state === "soon" ? "rev" : "cov")) + '" style="margin-left:6px">' + esc(rv.t.replace(/ \(.*\)/, "")) + "</span>" : esc(rv.t)) + "</div></div></div>" +
      '<datalist id="staffNames">' + ST.staff.map(function (s) { return '<option value="' + esc(s.name) + '"></option>'; }).join("") + "</datalist>" +
      '<fieldset style="margin-top:14px"' + (p.retired ? " disabled" : "") + "><legend>Who must read it (audience)</legend><div class=\"checks\">" +
      '<label><input type="checkbox" data-f="aud" value="*"' + (p.audience.indexOf("*") !== -1 ? " checked" : "") + "> All staff</label>" +
      ST.teams.map(function (t) { return '<label><input type="checkbox" data-f="aud" value="' + esc(t) + '"' + (p.audience.indexOf("*") !== -1 ? " disabled" : "") + (p.audience.indexOf(t) !== -1 ? " checked" : "") + "> " + esc(t) + "</label>"; }).join("") +
      "</div></fieldset></div>";
    // obligations
    var ids = p.obligation_ids || [];
    h += '<div class="blk"><h4>Obligations this policy governs <span class="count">' + ids.length + "</span></h4>";
    if (ids.length) {
      h += '<div class="card-list">' + ids.map(function (id) {
        var o = obById(id); if (!o) return "";
        var nc = CONTROLS.filter(function (c) { return (c.obligation_ids || []).indexOf(id) !== -1; }).length;
        return '<div class="card"><div><a class="t" href="workspace.html?open=' + encodeURIComponent(id) + '">' + esc(obLabel(o)) + '</a><div class="s">' + esc(o.topic || "") + " · " +
          (nc ? '<a href="workspace.html?open=' + encodeURIComponent(id) + '">' + pl(nc, "control") + "</a> test it" : '<span style="color:var(--crit);font-weight:600">no control yet</span>') + " · applies " + esc(fmt(o.deadline)) + "</div></div>" +
          (p.retired ? "" : '<div class="acts"><button type="button" class="btn sm" data-act="unmap" data-o="' + esc(id) + '" aria-label="Stop governing ' + esc(o.legal_basis) + '">Remove</button></div>') + "</div>";
      }).join("") + "</div>";
    } else {
      h += '<p class="hint" style="margin-top:0">No register obligations are mapped. Either this policy covers law the register does not hold yet (see the legal references below), or it is unmapped.</p>';
    }
    if (!p.retired) {
      h += '<div class="row-actions"><button type="button" class="btn sm pri" data-act="mapopen" aria-expanded="' + S.mapOpen + '">' + (S.mapOpen ? "Done" : "Map obligations") + "</button></div>";
      if (S.mapOpen) {
        h += '<div class="picker"><fieldset><legend>Tick every obligation this policy answers</legend><div class="checks" style="flex-direction:column;gap:2px">' +
          OBS.map(function (o) { return '<label><input type="checkbox" data-f="ob" value="' + esc(o.id) + '"' + (ids.indexOf(o.id) !== -1 ? " checked" : "") + "> " + esc(obLabel(o)) + "</label>"; }).join("") + "</div></fieldset></div>";
      }
    }
    h += "</div>";
    // legal references
    var refs = p.legal_refs || [];
    h += '<div class="blk"><h4>Legal references <span class="count">' + refs.length + '</span></h4><p class="hint" style="margin:-4px 0 10px">Each article is looked up in the law text held in this site. Quotes appear only when they match that text word for word.</p>';
    if (refs.length) {
      h += '<div class="card-list">' + refs.map(function (r, i) {
        var inf = refInfo(r), key = r.celex + ":" + r.art;
        var line = '<a class="t" href="' + esc(lawHref(r)) + '">' + esc(refLabel(r)) + (inf.a ? " · " + esc(inf.a.title) : "") + "</a>";
        var badge = inf.loading ? '<span class="chip">Checking…</span>' : (inf.missing ? '<span class="chip crit">Not found in the law files</span>' : '<span class="chip ok">Found in the official text</span>');
        var body = "";
        if (inf.a && r.quote) body += inf.qok ? '<div class="quote">“' + esc(r.quote) + '”<div class="hint">Verbatim from ' + esc(refLabel(r)) + ".</div></div>" : '<div class="hint warn">The saved quote no longer matches the current law text. Check the source.</div>';
        if (inf.a) body += '<div class="row-actions" style="margin-top:8px"><button type="button" class="btn sm" data-act="lawtoggle" data-k="' + esc(key) + '" aria-expanded="' + !!S.lawOpen[key] + '">' + (S.lawOpen[key] ? "Hide full article" : "Show full article") + "</button>" +
          (p.retired ? "" : '<button type="button" class="btn sm" data-act="rmref" data-i="' + i + '" aria-label="Remove reference ' + esc(refLabel(r)) + '">Remove</button>') + "</div>" +
          (S.lawOpen[key] ? '<div class="fulltext" tabindex="0" aria-label="Full text of ' + esc(refLabel(r)) + '">' + esc(inf.a.text) + "</div>" : "");
        return '<div class="card block"><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;justify-content:space-between">' + line + badge + "</div>" + body + "</div>";
      }).join("") + "</div>";
    } else h += '<p class="hint" style="margin-top:0">No legal references yet.</p>';
    if (!p.retired) {
      h += '<div class="row-actions"><button type="button" class="btn sm" data-act="refadd" aria-expanded="' + S.refAdd + '">' + (S.refAdd ? "Close" : "Add a legal reference") + "</button></div>";
      if (S.refAdd) {
        var laws = LAWIDX.filter(function (x) { return x.available; });
        var L = S.refCelex ? LAWS[S.refCelex] : null;
        h += '<div class="picker"><div class="fields"><div class="field"><label for="ref-law">Instrument</label><select class="sel" id="ref-law" data-f="reflaw"><option value="">Choose…</option>' +
          laws.map(function (x) { return '<option value="' + esc(x.celex) + '"' + (x.celex === S.refCelex ? " selected" : "") + ">" + esc(x.name + ": " + x.full_name) + "</option>"; }).join("") + "</select></div>" +
          '<div class="field"><label for="ref-art">Article</label><select class="sel" id="ref-art" data-f="refart"' + (L ? "" : " disabled") + ">" +
          (L ? '<option value="">Choose…</option>' + L.list.map(function (a) { return '<option value="' + esc(a.id) + '">Art. ' + esc(a.id) + " · " + esc(a.title) + "</option>"; }).join("") : '<option value="">' + (S.refCelex ? "Loading…" : "Choose an instrument first") + "</option>") + "</select></div></div></div>";
      }
    }
    h += "</div>";
    // activity
    var acts = ST.log.filter(function (x) { return x.policy === p.id; }).slice(0, 8);
    h += '<div class="blk"><h4>Recent activity</h4>' + (acts.length ? '<div class="hist">' + acts.map(function (a) {
      return '<div><span class="d">' + esc(fmt(String(a.t).slice(0, 10))) + "</span><span><b>" + esc(a.action) + "</b> · " + esc(a.who) + (a.detail ? ": " + esc(a.detail) : "") + "</span></div>";
    }).join("") + "</div>" : '<p class="hint" style="margin-top:0">Nothing recorded yet.</p>') + "</div>";
    return h;
  }

  /* ----- document / editor ----- */
  function docHtml(p) {
    var pv = PD.pendingVersion(p), lat = PD.latestVersion(p), ro = !!p.retired;
    var text = PD.currentText(p);
    var h = "";
    if (ro) h += '<div class="notice">Retired policies are read-only. Reinstate the policy from the Overview tab to edit it.</div>';
    if (pv && pv.status === "in_review") h += '<div class="notice" style="margin-top:12px">Version ' + esc(pv.ver) + " is waiting for approval. You can keep drafting the next version, but cannot publish it until " + esc(pv.ver) + " is approved, returned or withdrawn. <button type=\"button\" class=\"linkbtn\" data-act=\"withdraw\">Withdraw " + esc(pv.ver) + "…</button></div>";
    if (pv && pv.status === "draft" && pv.returned) h += '<div class="notice" style="margin-top:12px"><b>Returned by ' + esc(pv.returned.by) + " on " + esc(fmt(pv.returned.on)) + ".</b> " + esc(pv.returned.why) + "</div>";
    h += '<div class="blk"><div class="edbar"><div class="seg" role="group" aria-label="Editor layout">' +
      [["write", "Write"], ["split", "Split"], ["preview", "Preview"]].map(function (m) { return '<button type="button" data-act="edmode" data-m="' + m[0] + '" aria-pressed="' + (S.edMode === m[0]) + '">' + m[1] + "</button>"; }).join("") + "</div>";
    if (!ro && S.edMode !== "preview") {
      h += '<span class="edtools" role="group" aria-label="Formatting" style="display:inline-flex;gap:6px;flex-wrap:wrap">' +
        [["h2", "H2", "Heading"], ["b", "B", "Bold"], ["i", "I", "Italic"], ["ul", "• List", "Bulleted list"], ["ol", "1. List", "Numbered list"], ["q", "“ ”", "Quote"], ["tbl", "Table", "Insert table"], ["ask", "Prompt", "Insert a to-answer prompt"]].map(function (b) {
          return '<button type="button" class="tbtn" data-act="tool" data-t="' + b[0] + '" aria-label="' + b[2] + '" title="' + b[2] + '">' + b[1] + "</button>";
        }).join("") + "</span>";
    }
    h += "</div>";
    var split = S.edMode === "split";
    h += '<div class="editor' + (split ? " split" : "") + '">' +
      (S.edMode !== "preview" ? '<div><label for="ed" class="sr-only">Policy text in markdown</label><textarea id="ed" spellcheck="true"' + (ro ? " readonly" : "") + ">" + esc(text) + "</textarea></div>" : "") +
      (S.edMode !== "write" ? '<div class="pv doc" id="pv" tabindex="0" role="region" aria-label="Live preview"></div>' : "") + "</div>";
    h += '<div class="edstat" id="edstat" aria-live="polite"></div>';
    h += '<div class="row-actions">';
    if (!ro) {
      var blocked = pv && pv.status === "in_review";
      h += '<button type="button" class="btn pri" data-act="publish"' + (blocked ? ' aria-disabled="true"' : "") + ">Publish new version…</button>" +
        '<button type="button" class="btn" data-act="cmpdraft">Compare with v' + esc(lat ? lat.ver : "") + "</button>" +
        '<button type="button" class="btn danger" data-act="discard"' + (p.draft ? "" : " hidden") + ' id="discardBtn">Discard changes</button>';
    }
    h += '<button type="button" class="btn" data-act="print" data-ver="draft">Print current text</button></div>';
    h += '<p class="cheat">Markdown: <code># Heading</code> <code>## Section</code> <code>**bold**</code> <code>*italic*</code> <code>- bullet</code> <code>1. step</code> <code>| a | b |</code> tables <code>&gt; quote</code>. Lines starting <code>&gt; TO ANSWER:</code> are template prompts to replace with your own text. Your work is saved on this device as you type.</p></div>';
    return h;
  }
  function bindEditor() {
    var ta = $("ed"), p = cur();
    if (ta) {
      ta.addEventListener("input", function () {
        S.pending = { pid: p.id, value: ta.value };
        clearTimeout(S.sv); S.sv = setTimeout(flushDraft, 500);
        clearTimeout(S.pu); S.pu = setTimeout(edUpdate, 120);
      });
    }
    edUpdate();
  }
  function edUpdate() {
    var p = cur(); if (!p) return;
    var ta = $("ed"), v = ta ? ta.value : PD.currentText(p), lat = PD.latestVersion(p);
    var pv = $("pv"); if (pv) pv.innerHTML = PD.renderMd(v, { base: 4 });
    var d = PD.diffHtml(lat ? lat.body : "", v, false), pr = PD.countPrompts(v);
    var st = $("edstat"); if (!st) return;
    st.innerHTML = "<span>" + pl(PD.wordCount(v), "word") + "</span>" +
      "<span>" + (d.same ? "No changes since v" + esc(lat ? lat.ver : "") : '<b style="color:var(--ok)">+' + d.add + '</b> <b style="color:var(--crit)">−' + d.del + "</b> lines since v" + esc(lat ? lat.ver : "")) + "</span>" +
      (pr ? '<span style="color:var(--imp);font-weight:600">' + pl(pr, "template prompt") + " still to answer</span>" : "") +
      '<span id="savedAt">' + (p.draft ? "Draft saved on this device" : "") + "</span>";
    var db = $("discardBtn"); if (db) db.hidden = !(p.draft || (ta && ta.value !== (lat ? lat.body : "")));
  }
  function flushDraft() {
    clearTimeout(S.sv);
    if (!S.pending) return;
    var pd = S.pending; S.pending = null;
    var p = PD.getPolicy(ST, pd.pid); if (!p || p.retired) return;
    PD.setDraft(ST, p, pd.value); persist();
    var sa = $("savedAt"); if (sa) sa.textContent = "Draft saved " + new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    var db = $("discardBtn"); if (db) db.hidden = !p.draft;
  }
  function tool(t) {
    var ta = $("ed"); if (!ta || ta.readOnly) return;
    var v = ta.value, s = ta.selectionStart, e = ta.selectionEnd;
    function wrap(a, b, ph) { var sel = v.slice(s, e) || ph; ta.setRangeText(a + sel + b, s, e, "select"); }
    function line(prefix) {
      var ls = v.lastIndexOf("\n", s - 1) + 1, blk = v.slice(ls, e);
      var n = 0;
      ta.setRangeText(blk.split("\n").map(function (l) { n++; return (prefix === "1. " ? n + ". " : prefix) + l; }).join("\n"), ls, e, "end");
    }
    if (t === "h2") line("## "); else if (t === "b") wrap("**", "**", "bold text"); else if (t === "i") wrap("*", "*", "italic text");
    else if (t === "ul") line("- "); else if (t === "ol") line("1. "); else if (t === "q") line("> ");
    else if (t === "tbl") ta.setRangeText("\n| Column | Column |\n|---|---|\n| | |\n", s, e, "end");
    else if (t === "ask") ta.setRangeText("\n> TO ANSWER: \n", s, e, "end");
    ta.focus(); ta.dispatchEvent(new Event("input"));
  }

  /* ----- versions & compare ----- */
  function verText(p, key) {
    if (key === "__draft") return PD.currentText(p);
    var v = PD.findVersion(p, key); return v ? v.body : "";
  }
  function verOptions(p, sel) {
    var o = p.versions.slice().reverse().map(function (v) {
      return '<option value="' + esc(v.ver) + '"' + (sel === v.ver ? " selected" : "") + ">v" + esc(v.ver) + " · " + esc(PD.STATUS_LABEL[v.status] || v.status) + " · " + esc(fmt(v.date)) + "</option>";
    }).join("");
    if (p.draft) o = '<option value="__draft"' + (sel === "__draft" ? " selected" : "") + ">Working draft (unpublished)</option>" + o;
    return o;
  }
  function verHtml(p) {
    var vs = p.versions, lat = PD.latestVersion(p), live = PD.liveVersion(p);
    if (!S.cmpB || (S.cmpB !== "__draft" && !PD.findVersion(p, S.cmpB)) || (S.cmpB === "__draft" && !p.draft)) S.cmpB = p.draft ? "__draft" : (lat ? lat.ver : null);
    if (!S.cmpA || (S.cmpA !== "__draft" && !PD.findVersion(p, S.cmpA))) {
      var i = lat ? PD.verIdx(p, lat.ver) : 0; S.cmpA = vs[Math.max(0, S.cmpB === "__draft" ? vs.length - 1 : i - 1)].ver;
    }
    var h = '<div class="blk"><h4>Compare versions</h4><div class="cmp-pick">' +
      '<div class="field"><label for="cmpA">From (older)</label><select class="sel" id="cmpA" data-f="cmpA">' + verOptions(p, S.cmpA) + "</select></div>" +
      '<div class="field"><label for="cmpB">To (newer)</label><select class="sel" id="cmpB" data-f="cmpB">' + verOptions(p, S.cmpB) + "</select></div>" +
      '<button type="button" class="btn sm" data-act="cmpswap">Swap</button>' +
      '<button type="button" class="btn sm" data-act="cmpall" aria-pressed="' + S.showAll + '">' + (S.showAll ? "Show changes only" : "Show whole document") + "</button></div>";
    var d = PD.diffHtml(verText(p, S.cmpA), verText(p, S.cmpB), S.showAll);
    if (S.cmpA === S.cmpB) h += '<p class="hint">Pick two different versions to compare.</p>';
    else if (d.same) h += '<p class="hint">These two versions have identical text.</p>';
    else h += '<div class="diffstat" aria-live="polite"><span class="a">+' + d.add + ' added</span><span class="d">−' + d.del + ' removed</span></div>' +
      '<div class="diffwrap"><table class="diff-t"><caption class="sr-only">Line differences from version ' + esc(S.cmpA) + " to " + esc(S.cmpB) + '</caption><colgroup><col style="width:40px"><col style="width:40px"><col style="width:24px"><col></colgroup><tbody>' + d.html + "</tbody></table></div>";
    h += "</div>";
    if (S.viewVer && PD.findVersion(p, S.viewVer)) {
      var vv = PD.findVersion(p, S.viewVer);
      h += '<div class="blk"><h4>Version ' + esc(vv.ver) + ' <button type="button" class="btn sm" data-act="closeview">Close</button></h4><div class="pv doc full" tabindex="0" role="region" aria-label="Text of version ' + esc(vv.ver) + '">' + PD.renderMd(vv.body, { base: 4 }) + "</div></div>";
    }
    h += '<div class="blk"><h4>History <span class="count">' + vs.length + '</span></h4><ul class="vlist">' + vs.slice().reverse().map(function (v, ri) {
      var idx = vs.length - 1 - ri, prev = idx > 0 ? vs[idx - 1] : null, isLive = live && v.ver === live.ver;
      var sign = "";
      if (v.status === "approved" || v.status === "superseded") {
        if (v.approvedBy) sign = "Approved by <b>" + esc(v.approvedBy) + "</b> on " + esc(fmt(v.approvedOn)) + (v.selfApproved ? ' <span class="chip imp">author and approver are the same person</span>' : "");
        else sign = "Superseded without a recorded sign-off";
      } else if (v.status === "in_review") sign = "Waiting for sign-off by <b>" + esc(ST.policies && p.approver ? p.approver : "an approver") + "</b>";
      else if (v.status === "draft") sign = v.returned ? "Returned to author by " + esc(v.returned.by) + " on " + esc(fmt(v.returned.on)) + ": " + esc(v.returned.why) : "Not yet submitted for review";
      else if (v.status === "withdrawn") sign = "Withdrawn by " + esc(v.withdrawn ? v.withdrawn.by : "") + (v.withdrawn ? ": " + esc(v.withdrawn.why) : "");
      return '<li class="ver' + (isLive ? " cur" : "") + '"><div class="ver-h"><span class="v">v' + esc(v.ver) + "</span>" + stChip(v.status) + (isLive ? '<span class="chip ok">Live</span>' : "") + (v.reattest === false ? '<span class="chip">No re-acknowledgement</span>' : "") +
        '</div><p>' + esc(v.note) + '</p><div class="s">' + esc(fmt(v.date)) + " · by " + esc(v.by) + (v.effective ? " · effective " + esc(fmt(v.effective)) : "") + "</div>" + (sign ? '<div class="s">' + sign + "</div>" : "") +
        '<div class="row-actions" style="margin-top:8px"><button type="button" class="btn sm" data-act="viewver" data-v="' + esc(v.ver) + '">Read</button>' +
        (prev ? '<button type="button" class="btn sm" data-act="cmpprev" data-v="' + esc(v.ver) + '">Changes since v' + esc(prev.ver) + "</button>" : "") +
        '<button type="button" class="btn sm" data-act="print" data-ver="' + esc(v.ver) + '">Print</button>' +
        (!p.retired && idx !== vs.length - 1 && v.status !== "withdrawn" ? '<button type="button" class="btn sm" data-act="restore" data-v="' + esc(v.ver) + '">Start a new draft from this version</button>' : "") + "</div></li>";
    }).join("") + "</ul></div>";
    return h;
  }

  /* ----- per-policy acknowledgements ----- */
  function ackBadge(a) {
    if (a.state === "done") return '<span class="st cov">Read v' + esc(a.ver) + " · " + esc(fmt(a.on)) + "</span>";
    if (a.state === "overdue") return '<span class="st gap">Overdue ' + pl(a.late, "day") + "</span>" + (a.earlier ? ' <span class="chip">read earlier v' + esc(a.earlier.ver) + "</span>" : "");
    return '<span class="st rev">Due ' + esc(fmt(a.due)) + "</span>" + (a.earlier ? ' <span class="chip">read earlier v' + esc(a.earlier.ver) + "</span>" : "");
  }
  function polAttHtml(p) {
    var live = PD.liveVersion(p), req = PD.required(p);
    if (!live || p.retired) return '<div class="blk"><div class="notice">' + (p.retired ? "Retired policies are not tracked." : "Acknowledgements start once a version is approved.") + "</div></div>";
    var f = attestFor(p), due = PD.attestDue(p), mine = me();
    var myRow = f.rows.filter(function (r) { return r.staff.id === mine.id; })[0];
    var h = '<div class="blk"><h4>Version ' + esc(req.v.ver) + " · due " + esc(fmt(due)) + '</h4><div class="prog">' + bar(f.pct, f.done + " of " + f.total + " have read it") + '<b class="mono">' + f.done + " / " + f.total + "</b></div>";
    if (req.v.ver !== live.ver) h += '<p class="hint">Live version is v' + esc(live.ver) + ", which did not ask for re-acknowledgement, so reading v" + esc(req.v.ver) + " or later counts.</p>";
    if (myRow && myRow.a.state !== "done") h += '<div class="row-actions"><button type="button" class="btn pri" data-act="ackme">I have read and understood v' + esc(live.ver) + "</button></div>";
    h += '<p class="hint">This is a simulation: there is no sign-in, so you record a person\'s acknowledgement yourself (stored with your name as the recorder).</p></div>';
    if (!f.total) return h + '<div class="empty">Nobody is in the audience. Choose a team on the Overview tab or add staff.</div>';
    var order = { overdue: 0, outstanding: 1, done: 2 };
    h += '<div class="blk"><h4>People <span class="count">' + f.total + '</span></h4><table class="tbl"><thead><tr><th scope="col">Person</th><th scope="col">Team</th><th scope="col">Status</th><th scope="col">Action</th></tr></thead><tbody>' +
      f.rows.slice().sort(function (a, b) { return order[a.a.state] - order[b.a.state] || a.staff.name.localeCompare(b.staff.name); }).map(function (r) {
        return '<tr><td data-label="Person"><span class="t">' + esc(r.staff.name) + '</span><div class="s">' + esc(r.staff.role) + '</div></td><td data-label="Team">' + esc(r.staff.team) + '</td><td data-label="Status">' + ackBadge(r.a) + '</td><td data-label="Action">' +
          (r.a.state === "done" ? "" : '<button type="button" class="btn sm" data-act="ack" data-s="' + esc(r.staff.id) + '" data-fk="ack-' + esc(r.staff.id) + '" aria-label="Record that ' + esc(r.staff.name) + ' has read ' + esc(p.title) + '">Record as read</button> <button type="button" class="btn sm" data-act="remind" data-s="' + esc(r.staff.id) + '" aria-label="Remind ' + esc(r.staff.name) + '">Remind</button>') + "</td></tr>";
      }).join("") + "</tbody></table></div>";
    return h;
  }

  /* ═══════════ coverage ═══════════ */
  function renderCoverage() {
    var sc = scopeInfo(), cov = PD.coverage(ST, sc.list, CONTROLS, T), c = cov.counts;
    var el = $("panel-coverage");
    var topics = {}; cov.rows.forEach(function (r) { var t = r.o.topic || "Other"; topics[t] = topics[t] || { cov: 0, tot: 0 }; topics[t].tot++; if (r.state === "governed" || r.state === "overdue") topics[t].cov++; });
    var rows = cov.rows.filter(function (r) {
      if (S.cov === "gap" && r.state !== "gap") return false;
      if (S.cov === "pending" && r.state !== "pending") return false;
      if (S.cov === "governed" && !(r.state === "governed" || r.state === "overdue")) return false;
      if (S.covTopic && (r.o.topic || "Other") !== S.covTopic) return false;
      return true;
    });
    rows.sort(function (a, b) {
      var ord = { gap: 0, pending: 1, overdue: 2, governed: 3 };
      return ord[a.state] - ord[b.state] || (a.o.criticality === "high" ? 0 : 1) - (b.o.criticality === "high" ? 0 : 1) || (a.o.id < b.o.id ? -1 : 1);
    });
    var STL = { governed: ["cov", "Governed"], overdue: ["rev", "Governed, review overdue"], pending: ["rev", "Policy not yet approved"], gap: ["gap", "Gap: no policy"] };
    var h = '<div class="panel-h"><div><h2>Which obligations have a governing policy</h2><p>Every obligation in the register against the approved policies that answer it, and the controls that test it. A policy that is only a draft does not count as covered.</p></div>' +
      '<button type="button" class="btn" data-act="exportCov">Export coverage (CSV)</button></div>';
    h += '<div class="notice">Scope follows your Compliance workspace' + (sc.label ? ": firm type <b>" + esc(sc.label) + "</b>" : ": all firm types") + (sc.dismissed ? ", " + pl(sc.dismissed, "obligation") + " marked not applicable left out" : "") + '. The register holds ' + OBS.length + ' obligations (AMLR); policies on other laws (sanctions, DORA, outsourcing) cite their legal basis directly below until those obligations join the register.</div>';
    h += '<div class="kpis" style="margin-top:14px">' +
      '<div class="kpi"><div><div class="n mono">' + cov.pct + '%</div><div class="l">Governed</div><div class="s">' + cov.covered + " of " + cov.total + " obligations</div></div></div>" +
      '<div class="kpi' + (c.gap ? " warn" : "") + '"><div><div class="n mono" style="color:' + (c.gap ? "var(--crit)" : "var(--ok)") + '">' + c.gap + '</div><div class="l">Gaps</div><div class="s">no policy at all</div></div></div>' +
      '<div class="kpi"><div><div class="n mono">' + c.pending + '</div><div class="l">Draft or in review only</div><div class="s">not yet approved</div></div></div>' +
      '<div class="kpi"><div><div class="n mono">' + c.overdue + '</div><div class="l">Review overdue</div><div class="s">governed by an out-of-date policy</div></div></div></div>';
    h += '<div class="chips" role="group" aria-label="Filter obligations" style="margin-bottom:12px">' +
      [["all", "All"], ["gap", "Gaps"], ["pending", "Not yet approved"], ["governed", "Governed"]].map(function (x) { return '<button type="button" class="chip" data-act="covf" data-f="' + x[0] + '" aria-pressed="' + (S.cov === x[0]) + '">' + x[1] + "</button>"; }).join("") +
      Object.keys(topics).sort().map(function (t) { return '<button type="button" class="chip" data-act="covt" data-t="' + esc(t) + '" aria-pressed="' + (S.covTopic === t) + '">' + esc(t) + ' <span class="mono">' + topics[t].cov + "/" + topics[t].tot + "</span></button>"; }).join("") + "</div>";
    if (!rows.length) h += '<div class="pane">' + empty("No obligations match this filter.") + "</div>";
    else {
      h += '<div class="pane pane-pad"><table class="tbl"><thead><tr><th scope="col">Obligation</th><th scope="col">Status</th><th scope="col">Governing policies</th><th scope="col">Controls</th><th scope="col">Action</th></tr></thead><tbody>' +
        rows.map(function (r) {
          var o = r.o, st = STL[r.state], open = S.mapRow === o.id;
          var cand = ST.policies.filter(function (p) { return !p.retired && (p.obligation_ids || []).indexOf(o.id) === -1; });
          return '<tr><td data-label="Obligation"><a class="t" href="workspace.html?open=' + encodeURIComponent(o.id) + '">' + esc(o.legal_basis) + ": " + esc(titleOf(o)) + '</a><div class="s">' + esc(o.topic || "") + " · " + esc(o.criticality || o.priority || "") + " criticality · applies " + esc(fmt(o.deadline)) + "</div></td>" +
            '<td data-label="Status"><span class="st ' + st[0] + '">' + st[1] + "</span></td>" +
            '<td data-label="Governing policies">' + (r.policies.length ? r.policies.map(function (p) {
              return '<div><button type="button" class="linkbtn" data-act="gopol" data-id="' + esc(p.id) + '">' + esc(p.title) + '</button> <span class="s">v' + esc((PD.liveVersion(p) || PD.latestVersion(p)).ver) + " · " + esc(PD.STATUS_LABEL[PD.statusOf(p)]) + "</span></div>";
            }).join("") : '<span class="s">None</span>') + "</td>" +
            '<td data-label="Controls">' + (r.controls ? '<a href="workspace.html?open=' + encodeURIComponent(o.id) + '">' + pl(r.controls, "control") + "</a>" : '<span class="s">' + (CONTROLS.length ? "None" : "n/a") + "</span>") + (r.policies.length && !r.controls && CONTROLS.length ? '<div class="s" style="color:var(--crit)">Policy without a test</div>' : "") + "</td>" +
            '<td data-label="Action">' + (cand.length ? '<button type="button" class="btn sm" data-act="maprow" data-o="' + esc(o.id) + '" aria-expanded="' + open + '" data-fk="maprow-' + esc(o.id) + '">' + (open ? "Cancel" : "Map a policy") + "</button>" : "") +
            (open ? '<div class="newrow"><label class="sr-only" for="mapsel">Policy for ' + esc(o.legal_basis) + '</label><select class="sel" id="mapsel">' + cand.map(function (p) { return '<option value="' + esc(p.id) + '">' + esc(p.title) + "</option>"; }).join("") + '</select><button type="button" class="btn pri sm" data-act="mapdo" data-o="' + esc(o.id) + '">Map</button></div>' : "") + "</td></tr>";
        }).join("") + "</tbody></table></div>";
    }
    // outside the register
    var out = ST.policies.filter(function (p) { return !p.retired && !(p.obligation_ids || []).length; });
    h += '<div class="sect"><h3>Policies on law the register does not hold yet</h3>';
    if (out.length) {
      h += '<div class="card-list">' + out.map(function (p) {
        return '<div class="card"><div><button type="button" class="open" data-act="gopol" data-id="' + esc(p.id) + '"><div class="t">' + esc(p.title) + '</div></button><div class="chips" style="margin-top:4px">' +
          ((p.legal_refs || []).length ? p.legal_refs.map(function (r) { return '<a class="chip" href="' + esc(lawHref(r)) + '">' + esc(refLabel(r)) + "</a>"; }).join("") : '<span class="s">No legal references recorded</span>') + "</div></div>" + stChip(PD.statusOf(p)) + "</div>";
      }).join("") + "</div>";
    } else h += '<p class="hint">Every policy is mapped to at least one register obligation.</p>';
    h += "</div>";
    el.innerHTML = h;
  }

  /* ═══════════ attestations ═══════════ */
  function reminderText(person, items) {
    var first = person.name.split(" ")[0].replace(/^[A-Z]\.$/, person.name);
    return "Hello " + first + ",\n\nPlease read and acknowledge " + (items.length === 1 ? "this policy" : "these policies") + " in RegRadar:\n" +
      items.map(function (i) {
        var late = i.a.state === "overdue" ? " (overdue by " + pl(i.a.late, "day") + ")" : "";
        return "- " + i.p.title + ", v" + PD.liveVersion(i.p).ver + ", due " + fmt(i.a.due) + late;
      }).join("\n") + "\n\nThank you,\n" + meName();
  }
  function renderAttest() {
    var as = PD.attestSummary(ST, T), el = $("panel-attest");
    var h = '<div class="panel-h"><div><h2>Who has read what</h2><p>Acknowledgements of the live version of each policy, outstanding items and reminders. Simulated and stored on this device: there is no sign-in and no email is sent.</p></div>' +
      '<button type="button" class="btn" data-act="exportAtt">Export acknowledgements (CSV)</button></div>';
    h += '<div class="kpis"><div class="kpi"><div><div class="n mono">' + as.pct + '%</div><div class="l">Acknowledged</div><div class="s">' + as.done + " of " + as.total + " required</div></div></div>" +
      '<div class="kpi"><div><div class="n mono">' + as.outstanding + '</div><div class="l">Outstanding</div><div class="s">across ' + pl(as.people, "person", "people") + "</div></div></div>" +
      '<div class="kpi' + (as.overdue ? " warn" : "") + '"><div><div class="n mono" style="color:' + (as.overdue ? "var(--crit)" : "var(--ok)") + '">' + as.overdue + '</div><div class="l">Overdue</div><div class="s">past the due date</div></div></div>' +
      '<div class="kpi"><div><div class="n mono">' + as.perPolicy.length + '</div><div class="l">Policies tracked</div><div class="s">approved, not retired</div></div></div></div>';
    h += '<div class="seg" role="group" aria-label="View" style="margin-bottom:14px">' + [["person", "By person"], ["policy", "By policy"], ["reminders", "Reminders"]].map(function (x) {
      return '<button type="button" data-act="attv" data-v="' + x[0] + '" aria-pressed="' + (S.att === x[0]) + '">' + x[1] + "</button>";
    }).join("") + "</div>";
    if (S.att === "person") {
      var people = PD.outstandingByPerson(ST, T);
      h += people.length ? '<div class="card-list">' + people.map(function (pp) {
        var lastR = PD.lastReminderOn(ST, pp.staff.id);
        return '<div class="card block"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center"><div><span class="t">' + esc(pp.staff.name) + '</span><div class="s">' + esc(pp.staff.role) + " · " + esc(pp.staff.team) + (lastR ? " · last reminded " + esc(fmt(lastR)) : " · never reminded") + '</div></div><button type="button" class="btn sm" data-act="remind" data-s="' + esc(pp.staff.id) + '" aria-label="Remind ' + esc(pp.staff.name) + '">Remind…</button></div>' +
          '<div class="card-list" style="margin-top:10px">' + pp.items.map(function (i) {
            return '<div class="card" style="background:var(--surface)"><div><button type="button" class="open" data-act="gopol" data-id="' + esc(i.p.id) + '" data-d="attest"><div class="t">' + esc(i.p.title) + ' <span class="mono">v' + esc(PD.liveVersion(i.p).ver) + '</span></div></button><div class="s">' + ackBadge(i.a).replace(/<span class="chip">.*?<\/span>/, "") + "</div></div>" +
              '<button type="button" class="btn sm" data-act="ack" data-s="' + esc(pp.staff.id) + '" data-p="' + esc(i.p.id) + '" aria-label="Record that ' + esc(pp.staff.name) + ' has read ' + esc(i.p.title) + '">Record as read</button></div>';
          }).join("") + "</div></div>";
      }).join("") + "</div>" : '<div class="pane">' + empty("Everyone has acknowledged every live policy.") + "</div>";
    } else if (S.att === "policy") {
      h += as.perPolicy.length ? '<div class="pane pane-pad"><table class="tbl"><thead><tr><th scope="col">Policy</th><th scope="col">Version</th><th scope="col">Due</th><th scope="col">Progress</th><th scope="col">Outstanding</th></tr></thead><tbody>' + as.perPolicy.map(function (r) {
        var pct = r.total ? Math.round(100 * r.done / r.total) : 100;
        var names = PD.attestRows(ST, r.p, T).filter(function (x) { return x.a.state !== "done"; }).map(function (x) { return x.staff.name; });
        return '<tr><td data-label="Policy"><button type="button" class="linkbtn" data-act="gopol" data-id="' + esc(r.p.id) + '" data-d="attest">' + esc(r.p.title) + '</button><div class="s">' + esc(r.p.ref) + "</div></td><td data-label=\"Version\" class=\"mono\">v" + esc(r.req.v.ver) + '</td><td data-label="Due">' + esc(fmt(r.due)) + '</td><td data-label="Progress"><div class="prog" style="min-width:140px">' + bar(pct, r.done + " of " + r.total) + '<span class="mono">' + r.done + "/" + r.total + '</span></div></td><td data-label="Outstanding">' + (names.length ? esc(names.slice(0, 4).join(", ") + (names.length > 4 ? " and " + (names.length - 4) + " more" : "")) : '<span class="s">None</span>') + "</td></tr>";
      }).join("") + "</tbody></table></div>" : '<div class="pane">' + empty("No approved policies yet.") + "</div>";
    } else {
      var due = PD.outstandingByPerson(ST, T).filter(function (pp) {
        var l = PD.lastReminderOn(ST, pp.staff.id);
        return pp.items.some(function (i) { return i.a.state === "overdue"; }) && (!l || PD.diffDays(l, T) >= 7);
      });
      h += '<div class="notice">RegRadar does not send email or messages. A reminder here gives you the text to paste into your own channel, then logs that you sent it.</div>';
      h += '<div class="sect"><h3>Due a reminder <span class="count" style="font-weight:600;color:var(--text-3)">overdue, not reminded in the last 7 days</span></h3>';
      h += due.length ? '<div class="card-list">' + due.map(function (pp) {
        return '<div class="card"><div><span class="t">' + esc(pp.staff.name) + '</span><div class="s">' + pl(pp.items.length, "policy", "policies") + " outstanding, " + pp.items.filter(function (i) { return i.a.state === "overdue"; }).length + ' overdue</div></div><button type="button" class="btn sm" data-act="remind" data-s="' + esc(pp.staff.id) + '" aria-label="Remind ' + esc(pp.staff.name) + '">Remind…</button></div>';
      }).join("") + '</div><div class="row-actions"><button type="button" class="btn" data-act="remindall">Remind all ' + due.length + "…</button></div>" : '<p class="hint">Nobody is due a reminder.</p>';
      h += "</div>";
      var lg = ST.reminders.slice().sort(function (a, b) { return a.on < b.on ? 1 : -1; });
      h += '<div class="sect"><h3>Reminder log <span class="count" style="font-weight:600;color:var(--text-3)">' + lg.length + "</span></h3>";
      h += lg.length ? '<div class="pane pane-pad"><table class="tbl"><thead><tr><th scope="col">Date</th><th scope="col">To</th><th scope="col">Policies</th><th scope="col">Logged by</th></tr></thead><tbody>' + lg.map(function (r) {
        var s = PD.getStaff(ST, r.staff);
        return '<tr><td data-label="Date">' + esc(fmt(r.on)) + '</td><td data-label="To">' + esc(s ? s.name : r.staff) + '</td><td data-label="Policies">' + esc(r.policies.map(function (id) { var p = PD.getPolicy(ST, id); return p ? p.title : id; }).join("; ")) + '</td><td data-label="Logged by">' + esc(r.by) + "</td></tr>";
      }).join("") + "</tbody></table></div>" : '<p class="hint">No reminders logged yet.</p>';
      h += "</div>";
    }
    el.innerHTML = h;
  }

  /* ═══════════ templates ═══════════ */
  function renderTemplates() {
    var h = '<div class="panel-h"><div><h2>Starter outlines</h2><p>Section headings and the questions each section must answer, with the obligations and articles that bear on it. Pick one to start a draft in the editor.</p></div><button type="button" class="btn" data-act="newpol" data-blank="1">Start blank</button></div>';
    h += '<div class="notice"><b>Template outline, not legal advice or a finished policy.</b> RegRadar writes no legal text for you: each section lists questions to answer in your firm\'s own words. Article references are checked against the law text held in this site; whether a rule applies to your firm is for you and your counsel to confirm.</div>';
    h += '<div class="cols" style="margin-top:14px">' + TPL.map(function (t) {
      var open = !!S.tpl[t.id];
      return '<article class="tcard" aria-labelledby="th-' + esc(t.id) + '"><div class="chips"><span class="chip">' + esc(t.kind) + '</span><span class="chip">' + t.sections.length + " sections</span></div><h3 id=\"th-" + esc(t.id) + '">' + esc(t.title) + '</h3><p class="p">' + esc(t.purpose) + "</p>" +
        (t.obligation_ids.length ? '<div class="chips">' + t.obligation_ids.map(function (id) { var o = obById(id); return '<a class="chip" href="workspace.html?open=' + encodeURIComponent(id) + '">' + esc(o ? o.legal_basis : id) + "</a>"; }).join("") + "</div>" : '<p class="hint" style="margin:0">No register obligations yet: cites its legal basis directly.</p>') +
        '<div class="push row-actions" style="margin-top:0"><button type="button" class="btn sm" data-act="tplopen" data-id="' + esc(t.id) + '" aria-expanded="' + open + '">' + (open ? "Hide outline" : "Preview outline") + '</button><button type="button" class="btn sm pri" data-act="newpol" data-t="' + esc(t.id) + '">Create from this outline</button></div>' +
        (open ? '<ol>' + t.sections.map(function (s) {
          return "<li><b>" + esc(s.h) + '</b><ul class="q">' + s.ask.map(function (q) { return "<li>" + esc(q) + "</li>"; }).join("") + "</ul>" +
            '<div class="chips" style="margin-top:4px">' + s.refs.map(function (r) { return '<a class="chip" href="' + esc(lawHref(r)) + '">' + esc(refLabel(r)) + "</a>"; }).join("") + s.obligations.map(function (id) { var o = obById(id); return '<a class="chip ok" href="workspace.html?open=' + encodeURIComponent(id) + '">' + esc(o ? o.legal_basis : id) + "</a>"; }).join("") + "</div></li>";
        }).join("") + "</ol>" : "") + "</article>";
    }).join("") + "</div>";
    $("panel-templates").innerHTML = h;
  }
  function outlineMd(t, title) {
    var md = "# " + title + "\n\n> Template outline, not legal advice or a finished policy. Answer each prompt below in your firm's own words, then delete this note.\n";
    t.sections.forEach(function (s, i) {
      md += "\n## " + (i + 1) + ". " + s.h + "\n";
      s.ask.forEach(function (q) { md += "> TO ANSWER: " + q + "\n"; });
      var src = s.refs.map(refLabel).concat(s.obligations.map(function (id) { var o = obById(id); return o ? o.legal_basis + " (register)" : id; }));
      if (src.length) md += "\n*Relevant: " + src.join("; ") + "*\n";
    });
    return md;
  }

  /* ═══════════ dialogs ═══════════ */
  var dlg = $("dlg");
  function dlgOpen(html, onSubmit) {
    if (!dlg.open) S.opener = document.activeElement;
    dlg.innerHTML = html; dlg._submit = onSubmit || null;
    if (!dlg.open) dlg.showModal();
    var f = dlg.querySelector("[autofocus],input:not([type=hidden]),textarea,select,button.pri");
    if (f) f.focus();
  }
  function dlgClose() { if (dlg.open) dlg.close(); }
  function dlgHtml(title, sub, body, okLabel, extra) {
    return '<form novalidate><div class="dlg-h"><h2 id="dlgTitle">' + esc(title) + "</h2>" + (sub ? "<p>" + esc(sub) + "</p>" : "") + '</div><div class="dlg-b">' + body + '<p class="err" id="dlgErr" role="alert" hidden></p></div><div class="dlg-f"><button type="button" class="btn" data-act="dlgclose">' + (okLabel ? "Cancel" : "Close") + "</button>" + (okLabel ? '<button type="submit" class="btn pri">' + esc(okLabel) + "</button>" : "") + (extra || "") + "</div></form>";
  }
  function dlgErr(msg) { var e = $("dlgErr"); if (!e) return false; e.textContent = msg; e.hidden = !msg; if (msg) { var f = dlg.querySelector("[aria-invalid=true]"); if (f) f.focus(); } return false; }
  dlg.addEventListener("close", function () {
    var o = S.opener; S.opener = null;
    if (o && document.body.contains(o)) o.focus();
    else { var it = document.querySelector('[data-fk="item-' + (S.sel || "") + '"]'); if (it) it.focus(); }
  });
  dlg.addEventListener("click", function (e) { if (e.target === dlg) dlgClose(); });
  dlg.addEventListener("submit", function (e) { e.preventDefault(); if (dlg._submit) { var r = dlg._submit(e.target); if (r !== false) dlgClose(); } });
  function staffOpts(sel) { return ST.staff.map(function (s) { return '<option value="' + esc(s.id) + '"' + (s.id === sel ? " selected" : "") + ">" + esc(s.name) + " (" + esc(s.team) + ")</option>"; }).join(""); }
  function done(msg) { persist(); renderAll(); renderKpis(); if (msg) toast(msg); }

  function dlgNew(tplId, blank) {
    var t = tplId ? TPL.filter(function (x) { return x.id === tplId; })[0] : null;
    var body = '<div class="field"><label for="n-title">Title</label><input class="in" id="n-title" value="' + esc(t ? t.title : "") + '" autocomplete="off"></div>' +
      '<div class="field"><label for="n-tpl">Start from</label><select class="sel" id="n-tpl"><option value="">Blank policy</option>' + TPL.map(function (x) { return '<option value="' + esc(x.id) + '"' + (t && t.id === x.id ? " selected" : "") + ">Template outline: " + esc(x.title) + "</option>"; }).join("") + "</select></div>" +
      '<div class="fields"><div class="field"><label for="n-kind">Type</label><select class="sel" id="n-kind">' + ["Policy", "Procedure", "Standard"].map(function (k) { return "<option" + (t && t.kind === k ? " selected" : "") + ">" + k + "</option>"; }).join("") + "</select></div>" +
      '<div class="field"><label for="n-cycle">Review cycle</label><select class="sel" id="n-cycle">' + [3, 6, 12, 18, 24, 36].map(function (m) { return '<option value="' + m + '"' + (m === (t ? t.cycleMonths : 12) ? " selected" : "") + ">Every " + m + " months</option>"; }).join("") + "</select></div>" +
      '<div class="field"><label for="n-owner">Owner</label><select class="sel" id="n-owner">' + staffOpts(ST.me) + "</select></div>" +
      '<div class="field"><label for="n-appr">Approver</label><select class="sel" id="n-appr">' + staffOpts((ST.staff.filter(function (s) { return s.id !== ST.me; })[0] || {}).id) + "</select></div></div>" +
      '<p class="hint" style="margin:0">Template outlines are questions to answer, not legal text. They never replace advice on what applies to your firm.</p>';
    dlgOpen(dlgHtml("New policy", "Creates a draft you can edit, publish and send for approval.", body, "Create draft"), function () {
      var title = $("n-title").value.trim();
      if (!title) { $("n-title").setAttribute("aria-invalid", "true"); return dlgErr("Give the policy a title."); }
      var tid = $("n-tpl").value, tt = TPL.filter(function (x) { return x.id === tid; })[0];
      var owner = PD.getStaff(ST, $("n-owner").value), appr = PD.getStaff(ST, $("n-appr").value);
      var p = PD.createPolicy(ST, {
        title: title, kind: $("n-kind").value, owner: owner ? owner.name : "", approver: appr ? appr.name : "", cycleMonths: +$("n-cycle").value,
        by: meName(), template: tid, body: tt ? outlineMd(tt, title) : "# " + title + "\n\n## 1. Purpose and scope\n\n",
        obligation_ids: tt ? tt.obligation_ids : [], legal_refs: tt ? tt.legal_refs : [], audience: tt ? tt.audience : ["*"]
      });
      S.sel = p.id; S.tab = "library"; S.dtab = "document"; S.fs = "all"; S.q = ""; S.fob = null; $("q").value = "";
      done("Draft created from " + (tt ? "the outline" : "a blank page"));
      needLaws(p.legal_refs.map(function (r) { return r.celex; })).then(function (c) { if (c) keepFocus(renderAll); });
    });
  }
  function dlgPublish() {
    var p = cur(); if (!p) return;
    var pv = PD.pendingVersion(p);
    if (pv && pv.status === "in_review") { toast("Version " + pv.ver + " is waiting for approval. Approve, return or withdraw it first."); return; }
    flushDraft();
    var lat = PD.latestVersion(p), text = PD.currentText(p), d = PD.diffHtml(lat ? lat.body : "", text, false), prompts = PD.countPrompts(text);
    var hi = PD.highestVersion(p) || "0.0.0";
    if (d.same) { toast("There are no changes to publish yet."); return; }
    var body = '<div class="field"><span class="lab">What kind of change is it?</span><div class="radios" role="radiogroup" aria-label="Kind of change">' +
      [["patch", "Patch", "Wording, typos, clarifications. Same meaning."], ["minor", "Minor", "A procedure or control changed."], ["major", "Major", "New scope or a different policy position."]].map(function (k, i) {
        return '<label class="radio"><input type="radio" name="kind" value="' + k[0] + '"' + (k[0] === "minor" ? " checked" : "") + '><div><b>' + k[1] + " → v" + PD.semBump(hi, k[0]) + "</b><span>" + k[2] + "</span></div></label>";
      }).join("") + "</div></div>" +
      '<div class="field"><label for="p-note">Why? (change note, recorded with your name)</label><textarea class="in" id="p-note" placeholder="What changed and what triggered it"></textarea></div>' +
      '<div class="fields"><div class="field"><label for="p-eff">Effective from</label><input class="in" type="date" id="p-eff" value="' + T + '"></div>' +
      '<div class="field"><label for="p-sub">After saving</label><select class="sel" id="p-sub"><option value="review">Submit for approval</option><option value="draft">Keep as draft</option></select></div></div>' +
      '<div class="checks"><label><input type="checkbox" id="p-re" checked> Staff must read this version again</label></div>' +
      '<p class="hint" style="margin:0">Changes: <b style="color:var(--ok)">+' + d.add + '</b> <b style="color:var(--crit)">−' + d.del + "</b> lines against v" + esc(lat ? lat.ver : "") + ". Published as <b>" + esc(meName()) + "</b> on " + esc(fmt(T)) + "." +
      (prompts ? ' <span style="color:var(--imp);font-weight:600">' + pl(prompts, "template prompt") + " still unanswered.</span>" : "") + "</p>";
    dlgOpen(dlgHtml("Publish a new version", p.title, body, "Publish version"), function () {
      var note = $("p-note").value.trim();
      if (!note) { $("p-note").setAttribute("aria-invalid", "true"); return dlgErr("Say why this version exists. The change note is required."); }
      var kind = dlg.querySelector("input[name=kind]:checked").value;
      var r = PD.publish(ST, p, { kind: kind, note: note, by: meName(), submit: $("p-sub").value === "review", reattest: $("p-re").checked, effective: $("p-eff").value || T });
      if (r.error) return dlgErr(r.error);
      S.dtab = "versions"; S.cmpA = null; S.cmpB = null;
      done("Version " + r.version.ver + (r.version.status === "in_review" ? " submitted for approval" : " saved as draft"));
    });
  }
  var NOOUT_QUOTE = "the approval of the obliged entity’s internal policies, procedures and controls pursuant to Article 9";
  function dlgApprove() {
    var p = cur(), pv = p && PD.pendingVersion(p); if (!pv || pv.status !== "in_review") return;
    var pre = PD.staffByName(ST, p.approver) || me();
    var L = LAWS[AMLR], a18 = L && L.arts["18"];
    var showQ = (p.legal_refs || []).some(function (r) { return r.celex === AMLR; }) && a18 && norm(a18.text).indexOf(norm(NOOUT_QUOTE)) !== -1;
    var body = '<div class="field"><label for="a-by">Approving as</label><select class="sel" id="a-by">' + staffOpts(pre.id) + "</select></div>" +
      '<p class="hint warn" id="a-warn" style="margin:0" hidden></p>' +
      '<div class="field"><label for="a-note">Comment (optional)</label><textarea class="in" id="a-note" placeholder="Anything the record should show"></textarea></div>' +
      '<div class="checks"><label><input type="checkbox" id="a-ok"> I have read version ' + esc(pv.ver) + " and approve it for use</label></div>" +
      '<div class="notice">Changes in v' + esc(pv.ver) + ": " + esc(pv.note) + "</div>" +
      (showQ ? '<p class="hint" style="margin:0">AMLR Art. 18 lists among the tasks that shall not be outsourced under any circumstances: “' + esc(NOOUT_QUOTE) + '”. Approval is yours to give.</p>' : "");
    dlgOpen(dlgHtml("Approve version " + pv.ver, p.title, body, "Approve and sign off"), function () {
      if (!$("a-ok").checked) { $("a-ok").setAttribute("aria-invalid", "true"); return dlgErr("Tick the box to confirm you have read this version."); }
      var by = PD.getStaff(ST, $("a-by").value);
      var r = PD.approve(ST, p, by ? by.name : meName(), $("a-note").value.trim());
      if (r.error) return dlgErr(r.error);
      S.dtab = "overview";
      done("Version " + r.version.ver + " approved and live");
    });
    function warn() {
      var by = PD.getStaff(ST, $("a-by").value), w = $("a-warn"), msg = "";
      if (by && by.name === pv.by) msg = "The approver is also the author. Allowed here, but the record will flag it. Good practice is a second person.";
      else if (by && p.approver && by.name !== p.approver) msg = "The designated approver is " + p.approver + ". The record will show who actually signed.";
      w.textContent = msg; w.hidden = !msg;
    }
    $("a-by").addEventListener("change", warn); warn();
  }
  function dlgReason(title, sub, label, ok, fn, optional) {
    dlgOpen(dlgHtml(title, sub, '<div class="field"><label for="r-why">' + label + '</label><textarea class="in" id="r-why"></textarea></div>', ok), function () {
      var v = $("r-why").value.trim();
      if (!v && !optional) { $("r-why").setAttribute("aria-invalid", "true"); return dlgErr("This is required for the record."); }
      return fn(v);
    });
  }
  function dlgStaff() {
    function list() {
      return ST.staff.map(function (s) {
        return '<li class="card" style="list-style:none"><div><div class="t">' + esc(s.name) + '</div><div class="s">' + esc(s.role) + " · " + esc(s.team) + '</div></div><button type="button" class="btn sm danger" data-act="rmstaff" data-s="' + esc(s.id) + '" aria-label="Remove ' + esc(s.name) + '">Remove</button></li>';
      }).join("") || '<li class="hint" style="list-style:none">No staff yet.</li>';
    }
    dlgOpen('<div class="dlg-in"><div class="dlg-h"><h2 id="dlgTitle">Staff</h2><p>The people who sign off and acknowledge policies. Stored on this device only. Removing a person keeps their past acknowledgements in the record.</p></div><div class="dlg-b">' +
      '<ul class="card-list" id="staffList" style="list-style:none">' + list() + "</ul>" +
      '<div class="field"><label for="st-name">Add a person</label><div class="newrow" style="margin-top:0"><input class="in" id="st-name" placeholder="Name" autocomplete="off"><input class="in" id="st-team" list="teamList" placeholder="Team" autocomplete="off"><input class="in" id="st-role" placeholder="Role (optional)" autocomplete="off"><button type="button" class="btn pri" data-act="addstaff">Add</button></div><datalist id="teamList">' + ST.teams.map(function (t) { return '<option value="' + esc(t) + '"></option>'; }).join("") + '</datalist></div>' +
      '<div class="field"><label for="st-bulk">Or paste a list (one per line: name, team, role)</label><textarea class="in" id="st-bulk" placeholder="A. Example, Compliance, Analyst"></textarea><div class="row-actions"><button type="button" class="btn sm" data-act="bulkstaff">Add pasted people</button></div></div>' +
      '<p class="err" id="dlgErr" role="alert" hidden></p></div><div class="dlg-f"><button type="button" class="btn pri" data-act="dlgclose">Done</button></div></div>');
    dlg._refreshStaff = function () { $("staffList").innerHTML = list(); };
  }
  function dlgData() {
    var body = '<div class="row-actions" style="margin-top:0"><button type="button" class="btn" data-act="backup">Download a backup (JSON)</button></div>' +
      '<div class="field"><label for="restoreFile">Restore from a backup</label><input class="in" type="file" id="restoreFile" accept="application/json,.json"></div>' +
      '<hr style="border:0;border-top:1px solid var(--border)">' +
      '<div class="row-actions" style="margin-top:0"><button type="button" class="btn" data-act="resetdemo">Reload the CF Bank demo data</button><button type="button" class="btn danger" data-act="startempty">Start with an empty library</button></div>' +
      '<p class="hint" style="margin:0">Your policies live in this browser only (key regradar-policies). Clearing site data deletes them, so download a backup now and then. Reloading the demo or starting empty replaces everything shown here.</p>';
    dlgOpen('<div class="dlg-in"><div class="dlg-h"><h2 id="dlgTitle">Your data</h2></div><div class="dlg-b">' + body + '<p class="err" id="dlgErr" role="alert" hidden></p></div><div class="dlg-f"><button type="button" class="btn pri" data-act="dlgclose">Close</button></div></div>');
  }
  function dlgConfirm(title, msg, ok, fn) {
    dlgOpen(dlgHtml(title, "", '<p>' + msg + "</p>", ok), function () { return fn(); });
  }
  function dlgRemind(ids) {
    var parts = ids.map(function (id) {
      var s = PD.getStaff(ST, id), items = PD.outstandingByPerson(ST, T).filter(function (x) { return x.staff.id === id; })[0];
      return s && items ? { s: s, items: items.items, text: reminderText(s, items.items) } : null;
    }).filter(Boolean);
    if (!parts.length) { toast("Nothing outstanding for that person."); return; }
    var text = parts.map(function (x) { return (parts.length > 1 ? "To: " + x.s.name + " (" + x.s.team + ")\n\n" : "") + x.text; }).join("\n\n------\n\n");
    var body = '<div class="field"><label for="rm-text">Message' + (parts.length > 1 ? "s" : "") +  ' (edit before you copy)</label><textarea class="in" id="rm-text" style="min-height:220px">' + esc(text) + '</textarea></div>' +
      '<p class="hint" style="margin:0">RegRadar does not send anything. Copy the text, send it through your own channel, then log it so the record shows it was sent.</p>';
    dlgOpen(dlgHtml("Reminder for " + (parts.length === 1 ? parts[0].s.name : parts.length + " people"), "", body, "Log as sent", '<button type="button" class="btn" data-act="copyrm">Copy text</button>'), function () {
      parts.forEach(function (x) { PD.remind(ST, x.s.id, x.items.map(function (i) { return i.p.id; }), meName(), "Reminder logged"); });
      done(parts.length === 1 ? "Reminder logged for " + parts[0].s.name : parts.length + " reminders logged");
    });
  }

  /* ═══════════ print & csv ═══════════ */
  function printPolicy(verKey) {
    var p = cur(); if (!p) return;
    var v, text;
    flushDraft();
    if (verKey === "draft") { v = PD.latestVersion(p); text = PD.currentText(p); }
    else { v = PD.findVersion(p, verKey) || PD.liveVersion(p) || PD.latestVersion(p); text = v.body; }
    var isDraft = verKey === "draft" || v.status !== "approved";
    var body = text.replace(/^\s*>\s*Demo document[^\n]*\n+/i, "");
    var lines = body.split("\n"); if (/^#\s+/.test(lines[0]) && norm(lines[0].replace(/^#\s+/, "")).toLowerCase() === norm(p.title).toLowerCase()) body = lines.slice(1).join("\n");
    var obl = (p.obligation_ids || []).map(function (id) { var o = obById(id); return o ? o.legal_basis : id; });
    var refs = (p.legal_refs || []).map(refLabel);
    var aud = p.audience.indexOf("*") !== -1 ? "All staff" : p.audience.join(", ");
    var rs = PD.nextReview(p);
    function row(a, b) { return "<tr><td>" + esc(a) + "</td><td>" + b + "</td></tr>"; }
    var status = verKey === "draft" ? "Working draft (not published)" : (PD.STATUS_LABEL[v.status] || v.status);
    var h = '<div class="pd-foot"><span>' + esc(p.ref) + " · " + esc(p.title) + " · version " + esc(v.ver) + (verKey === "draft" ? " (working draft)" : " · " + esc(status)) + "</span><span>" + esc(ST.org) + " · printed " + esc(fmt(T)) + "</span></div>" +
      "<h1>" + esc(p.title) + "</h1>" + (isDraft ? '<div class="pd-draftmark">' + (verKey === "draft" ? "WORKING DRAFT" : "NOT APPROVED: " + esc(status.toUpperCase())) + "</div>" : "") +
      '<table class="pd-ctrl"><tbody>' +
      row("Reference", esc(p.ref)) + row("Type", esc(p.kind)) + row("Version", esc(v.ver) + " · " + esc(status)) +
      row("Effective from", esc(fmt(v.effective || v.approvedOn || v.date))) + row("Owner", esc(p.owner)) + row("Approver (designated)", esc(p.approver)) +
      row("Approved", v.approvedBy ? esc(v.approvedBy) + " on " + esc(fmt(v.approvedOn)) : "Not approved") +
      row("Next review", rs && v.status === "approved" ? esc(fmt(rs)) + " (every " + p.cycleMonths + " months)" : "Every " + p.cycleMonths + " months after approval") +
      row("Audience", esc(aud)) + (obl.length ? row("Register obligations", esc(obl.join("; "))) : "") + (refs.length ? row("Legal basis", esc(refs.join("; "))) : "") +
      "</tbody></table>" + PD.renderMd(body, { base: 2 });
    h += "<h2>Sign-off</h2><table class=\"pd-sign\"><thead><tr><th>Role</th><th>Name</th><th>Date</th><th>Signature</th></tr></thead><tbody><tr><td>Author (" + esc(v.by) + ")</td><td></td><td></td><td></td></tr><tr><td>Approver</td><td>" + (v.approvedBy ? esc(v.approvedBy) : "") + "</td><td>" + (v.approvedOn ? esc(fmt(v.approvedOn)) : "") + "</td><td></td></tr></tbody></table>";
    h += "<h2>Version history</h2><table><thead><tr><th>Version</th><th>Date</th><th>By</th><th>Change note</th><th>Status</th></tr></thead><tbody>" + p.versions.map(function (x) {
      return "<tr><td>" + esc(x.ver) + "</td><td>" + esc(fmt(x.date)) + "</td><td>" + esc(x.by) + "</td><td>" + esc(x.note) + "</td><td>" + esc(PD.STATUS_LABEL[x.status] || x.status) + (x.approvedBy ? ", " + esc(x.approvedBy) : "") + "</td></tr>";
    }).join("") + "</tbody></table>";
    if (ST.demo && p.demo) h += '<p style="font-size:9pt;margin-top:10pt">Demo document for the fictional CF Bank. Not legal advice.</p>';
    $("printDoc").innerHTML = h;
    var old = document.title; document.title = p.ref + " " + p.title + " v" + v.ver;
    var restore = function () { document.title = old; window.removeEventListener("afterprint", restore); };
    window.addEventListener("afterprint", restore);
    window.print();
  }
  function download(name, text, type) {
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + text], { type: type || "text/csv;charset=utf-8" }));
    a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }
  function exportReg() {
    var rows = [["Reference", "Title", "Type", "Status", "Live version", "Pending version", "Owner", "Approver", "Last reviewed or approved", "Review cycle (months)", "Next review", "Review state", "Audience", "Obligations governed", "Legal references", "Read live version", "Audience size"]];
    ST.policies.forEach(function (p) {
      var live = PD.liveVersion(p), pv = PD.pendingVersion(p), rs = PD.reviewState(p, T), f = attestFor(p);
      rows.push([p.ref, p.title, p.kind, PD.STATUS_LABEL[PD.statusOf(p)], live ? live.ver : "", pv ? pv.ver + " (" + PD.STATUS_LABEL[pv.status] + ")" : "", p.owner, p.approver, p.lastReviewed || "", p.cycleMonths, PD.nextReview(p) || "",
        rs.state === "na" ? "" : (rs.state === "overdue" ? "Overdue by " + (-rs.days) + " days" : (rs.state === "soon" ? "Due in " + rs.days + " days" : "On track")),
        p.audience.indexOf("*") !== -1 ? "All staff" : p.audience.join("; "), (p.obligation_ids || []).map(function (id) { var o = obById(id); return o ? o.legal_basis : id; }).join("; "), (p.legal_refs || []).map(refLabel).join("; "),
        live && !p.retired ? f.done : "", live && !p.retired ? f.total : ""]);
    });
    download("regradar_policy_register.csv", PD.csv(rows)); toast("Register exported");
  }
  function exportLog() {
    var rows = [["Reference", "Policy", "Version", "Status", "Date", "Author", "Change note", "Approved by", "Approved on", "Author approved own version", "Re-acknowledgement required"]];
    ST.policies.forEach(function (p) {
      p.versions.forEach(function (v) { rows.push([p.ref, p.title, v.ver, PD.STATUS_LABEL[v.status] || v.status, v.date, v.by, v.note, v.approvedBy || "", v.approvedOn || "", v.approvedBy ? (v.selfApproved ? "Yes" : "No") : "", v.reattest === false ? "No" : "Yes"]); });
    });
    download("regradar_policy_version_log.csv", PD.csv(rows)); toast("Version log exported");
  }
  function exportCov() {
    var sc = scopeInfo(), cov = PD.coverage(ST, sc.list, CONTROLS, T);
    var L = { governed: "Governed", overdue: "Governed, review overdue", pending: "Policy not yet approved", gap: "Gap" };
    var rows = [["Obligation", "Title", "Topic", "Criticality", "Applies from", "Status", "Governing policies", "Controls"]];
    cov.rows.forEach(function (r) { rows.push([r.o.legal_basis, titleOf(r.o), r.o.topic, r.o.criticality || r.o.priority, r.o.deadline || "", L[r.state], r.policies.map(function (p) { return p.ref + " " + p.title; }).join("; "), r.controls]); });
    download("regradar_policy_coverage.csv", PD.csv(rows)); toast("Coverage exported");
  }
  function exportAtt() {
    var rows = [["Reference", "Policy", "Required version", "Due", "Person", "Team", "Status", "Read on", "Days overdue"]];
    ST.policies.forEach(function (p) {
      if (p.retired || !PD.liveVersion(p)) return;
      var req = PD.required(p), due = PD.attestDue(p);
      PD.attestRows(ST, p, T).forEach(function (r) {
        rows.push([p.ref, p.title, req.v.ver, due, r.staff.name, r.staff.team, r.a.state === "done" ? "Read" : (r.a.state === "overdue" ? "Overdue" : "Outstanding"), r.a.on || "", r.a.state === "overdue" ? r.a.late : ""]);
      });
    });
    download("regradar_policy_acknowledgements.csv", PD.csv(rows)); toast("Acknowledgements exported");
  }

  /* ═══════════ events ═══════════ */
  function goPolicy(id, dtab) {
    flushDraft();
    S.tab = "library"; S.sel = id; S.dtab = dtab || "overview"; S.viewVer = null; S.mapOpen = false; S.refAdd = false; S.cmpA = null; S.cmpB = null;
    if (!visibleList().some(function (p) { return p.id === id; })) { S.fs = "all"; S.fover = false; S.fob = null; S.q = ""; $("q").value = ""; }
    renderAll();
    var d = $("detail"); if (innerWidth <= 980 && d) d.scrollIntoView({ block: "start" });
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-act]"); if (!b || b.tagName === "SELECT" || b.tagName === "INPUT") return;
    var a = b.getAttribute("data-act"), p = cur();
    if (b.getAttribute("aria-disabled") === "true") { toast("Version " + ((p && PD.pendingVersion(p) || {}).ver || "") + " is waiting for approval first."); return; }
    switch (a) {
      case "tab": flushDraft(); S.tab = b.dataset.tab; renderAll(); return;
      case "kpi": flushDraft(); if (b.dataset.to === "overdue") { S.tab = "library"; S.fover = true; S.fs = "all"; var l = visibleList(); if (l.length) S.sel = l[0].id; } else S.tab = b.dataset.to; renderAll(); return;
      case "sel": goPolicy(b.dataset.id, S.dtab); return;
      case "gopol": goPolicy(b.dataset.id, b.dataset.d || "overview"); return;
      case "fstatus": S.fs = b.dataset.s; keepFocus(renderAll); return;
      case "fover": S.fover = !S.fover; keepFocus(renderAll); return;
      case "clearob": S.fob = null; keepFocus(renderAll); return;
      case "dtab": flushDraft(); S.dtab = b.dataset.d; keepFocus(renderAll); return;
      case "newpol": dlgNew(b.dataset.t, b.dataset.blank); return;
      case "staff": dlgStaff(); return;
      case "data": dlgData(); return;
      case "dlgclose": dlgClose(); return;
      case "godoc": S.dtab = "document"; renderAll(); return;
      case "edmode": flushDraft(); S.edMode = b.dataset.m; keepFocus(renderDetail); return;
      case "tool": tool(b.dataset.t); return;
      case "publish": dlgPublish(); return;
      case "cmpdraft": flushDraft(); S.dtab = "versions"; S.cmpA = PD.latestVersion(p).ver; S.cmpB = "__draft"; if (!p.draft) { toast("No unpublished changes yet."); S.dtab = "document"; } renderAll(); return;
      case "discard": dlgConfirm("Discard your changes?", "The unpublished text on this device is deleted and the editor returns to v" + esc(PD.latestVersion(p).ver) + ".", "Discard changes", function () { S.pending = null; p.draft = null; done("Changes discarded"); }); return;
      case "approve": dlgApprove(); return;
      case "return": dlgReason("Return to author", p.title, "What needs to change?", "Return version", function (v) { var r = PD.returnToAuthor(ST, p, meName(), v); if (r.error) return dlgErr(r.error); S.dtab = "document"; done("Returned to the author"); }); return;
      case "withdraw": dlgReason("Withdraw version", p.title, "Why is it withdrawn?", "Withdraw", function (v) { var r = PD.withdraw(ST, p, meName(), v); if (r.error) return dlgErr(r.error); done("Version withdrawn; its text is in your working draft"); }); return;
      case "submitrev": var r1 = PD.submitForReview(ST, p, meName()); if (r1.error) toast(r1.error); else done("Submitted for approval"); return;
      case "review": dlgReason("Record a periodic review", "Confirms the policy was reviewed and still fits. Resets the next review date.", "Outcome (what you checked, what you changed or why nothing changed)", "Record review", function (v) { var r = PD.recordReview(ST, p, meName(), v); if (r.error) return dlgErr(r.error); done("Review recorded"); }); return;
      case "retire": dlgReason("Retire this policy", "A retired policy is no longer reviewed or tracked for acknowledgements, and stops counting towards coverage.", "Reason (and what replaces it)", "Retire policy", function (v) { PD.retire(ST, p, meName(), v); done("Policy retired"); }); return;
      case "reinstate": dlgReason("Reinstate this policy", p.title, "Why is it back in use?", "Reinstate", function (v) { PD.reinstate(ST, p, meName(), v); done("Policy reinstated"); }); return;
      case "mapopen": S.mapOpen = !S.mapOpen; keepFocus(renderDetail); return;
      case "unmap": p.obligation_ids = p.obligation_ids.filter(function (x) { return x !== b.dataset.o; }); PD.logEntry(ST, meName(), p.id, "unmapped", b.dataset.o); persist(); renderAll(); toast("Obligation removed"); return;
      case "refadd": S.refAdd = !S.refAdd; S.refCelex = ""; keepFocus(renderDetail); return;
      case "rmref": p.legal_refs.splice(+b.dataset.i, 1); persist(); renderDetail(); toast("Reference removed"); return;
      case "lawtoggle": S.lawOpen[b.dataset.k] = !S.lawOpen[b.dataset.k]; keepFocus(renderDetail); return;
      case "cmpswap": var t = S.cmpA; S.cmpA = S.cmpB; S.cmpB = t; keepFocus(renderDetail); return;
      case "cmpall": S.showAll = !S.showAll; keepFocus(renderDetail); return;
      case "cmpprev": var ix = PD.verIdx(p, b.dataset.v); S.cmpA = p.versions[ix - 1].ver; S.cmpB = b.dataset.v; renderDetail(); var dw = document.querySelector(".diffwrap"); if (dw) dw.scrollIntoView({ block: "nearest" }); return;
      case "viewver": S.viewVer = b.dataset.v; renderDetail(); return;
      case "closeview": S.viewVer = null; renderDetail(); return;
      case "restore": dlgConfirm("Start a new draft from v" + esc(b.dataset.v) + "?", "This replaces your unpublished working text with the text of v" + esc(b.dataset.v) + ". Published versions are never changed.", "Replace working text", function () { PD.setDraft(ST, p, PD.findVersion(p, b.dataset.v).body); S.dtab = "document"; done("Working text restored from v" + b.dataset.v); }); return;
      case "print": printPolicy(b.dataset.ver); return;
      case "ackme": PD.acknowledge(ST, p, me().id, meName()); done("Thank you, your acknowledgement is recorded"); return;
      case "ack": var pol = b.dataset.p ? PD.getPolicy(ST, b.dataset.p) : p; PD.acknowledge(ST, pol, b.dataset.s, meName()); keepFocus(function () { done("Acknowledgement recorded"); }); return;
      case "remind": dlgRemind([b.dataset.s]); return;
      case "remindall": dlgRemind(PD.outstandingByPerson(ST, T).filter(function (pp) { var l = PD.lastReminderOn(ST, pp.staff.id); return pp.items.some(function (i) { return i.a.state === "overdue"; }) && (!l || PD.diffDays(l, T) >= 7); }).map(function (pp) { return pp.staff.id; })); return;
      case "copyrm": var ta = $("rm-text"); ta.select(); var okc = false; try { okc = document.execCommand && document.execCommand("copy"); } catch (x) { /* ignore */ }
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(ta.value).then(function () { toast("Copied"); }, function () { toast(okc ? "Copied" : "Select the text and copy it"); }); else toast(okc ? "Copied" : "Select the text and copy it"); return;
      case "attv": S.att = b.dataset.v; keepFocus(renderAttest); return;
      case "covf": S.cov = b.dataset.f; keepFocus(renderCoverage); return;
      case "covt": S.covTopic = S.covTopic === b.dataset.t ? null : b.dataset.t; keepFocus(renderCoverage); return;
      case "maprow": S.mapRow = S.mapRow === b.dataset.o ? null : b.dataset.o; keepFocus(renderCoverage); return;
      case "mapdo": var sel = $("mapsel"), pp = PD.getPolicy(ST, sel.value); if (pp) { pp.obligation_ids.push(b.dataset.o); PD.logEntry(ST, meName(), pp.id, "mapped", b.dataset.o); S.mapRow = null; done("Mapped " + pp.title); } return;
      case "tplopen": S.tpl[b.dataset.id] = !S.tpl[b.dataset.id]; keepFocus(renderTemplates); return;
      case "exportReg": exportReg(); return;
      case "exportLog": exportLog(); return;
      case "exportCov": exportCov(); return;
      case "exportAtt": exportAtt(); return;
      case "addstaff": addStaffFromForm(); return;
      case "bulkstaff": bulkStaff(); return;
      case "rmstaff": var s = PD.getStaff(ST, b.dataset.s); if (s) { PD.removeStaff(ST, s.id); persist(); renderMeSel(); dlg._refreshStaff && dlg._refreshStaff(); renderAll(); toast(s.name + " removed"); } return;
      case "backup": download("regradar_policies_backup.json", JSON.stringify(ST, null, 1), "application/json"); toast("Backup downloaded"); return;
      case "resetdemo": dlgConfirm("Reload the demo data?", "This replaces all policies, people and acknowledgements on this device with the CF Bank (fictional) demo.", "Replace with demo", function () { ST = PD.fromSeed(SEED); S.sel = null; S.dtab = "overview"; persist(); renderMeSel(); var l = visibleList(); S.sel = l.length ? l[0].id : null; done("Demo data loaded"); }); return;
      case "startempty": dlgConfirm("Start with an empty library?", "This deletes every policy, person and acknowledgement on this device. Download a backup first if you may need them.", "Delete and start empty", function () { var e = PD.emptyState(); e.org = "Your firm"; ST = e; S.sel = null; persist(); renderMeSel(); done("Library is empty"); dlgStaff(); return false; }); return;
    }
  });
  function addStaffFromForm() {
    var n = $("st-name").value.trim(), t = $("st-team").value.trim();
    if (!n || !t) { dlgErr("A name and a team are required."); return; }
    dlgErr(""); PD.addStaff(ST, n, t, $("st-role").value.trim()); persist(); renderMeSel(); if (!PD.getStaff(ST, ST.me)) ST.me = ST.staff[0].id;
    $("st-name").value = ""; $("st-role").value = ""; dlg._refreshStaff(); renderAll(); toast(n + " added"); $("st-name").focus();
  }
  function bulkStaff() {
    var lines = $("st-bulk").value.split("\n").map(function (l) { return l.trim(); }).filter(Boolean), n = 0;
    lines.forEach(function (l) { var c = l.split(",").map(function (x) { return x.trim(); }); if (c[0] && c[1]) { PD.addStaff(ST, c[0], c[1], c[2] || ""); n++; } });
    if (!n) { dlgErr("Use one person per line: name, team, role."); return; }
    dlgErr(""); if (!PD.getStaff(ST, ST.me)) ST.me = ST.staff[0].id;
    persist(); renderMeSel(); $("st-bulk").value = ""; dlg._refreshStaff(); renderAll(); toast(pl(n, "person", "people") + " added");
  }
  document.addEventListener("change", function (e) {
    var t = e.target, f = t.dataset && t.dataset.f, p = cur();
    if (t.id === "meSel") { ST.me = t.value; persist(); toast("Acting as " + meName()); return; }
    if (t.id === "restoreFile") {
      var file = t.files[0]; if (!file) return;
      var rd = new FileReader();
      rd.onload = function () {
        try {
          var j = JSON.parse(rd.result);
          if (!j || j.v !== 1 || !Array.isArray(j.policies) || !Array.isArray(j.staff)) throw new Error("shape");
          ST = j; ST.attest = ST.attest || {}; ST.reminders = ST.reminders || []; ST.log = ST.log || []; ST.teams = ST.teams || [];
          S.sel = null; persist(); renderMeSel(); var l = visibleList(); S.sel = l.length ? l[0].id : null; dlgClose(); renderAll(); toast("Backup restored");
        } catch (x) { dlgErr("That file is not a RegRadar policies backup."); }
      };
      rd.readAsText(file); return;
    }
    if (!f) return;
    if (f === "cmpA" || f === "cmpB") { S[f] = t.value; keepFocus(renderDetail); return; }
    if (f === "reflaw") { S.refCelex = t.value; renderDetail(); if (t.value) loadLaw(t.value).then(function () { keepFocus(renderDetail); }); return; }
    if (f === "refart") { if (t.value && p) { var r = { celex: S.refCelex, art: t.value }; if (!p.legal_refs.some(function (x) { return x.celex === r.celex && String(x.art) === String(r.art); })) { p.legal_refs.push(r); PD.logEntry(ST, meName(), p.id, "reference added", refLabel(r)); persist(); S.refAdd = false; renderDetail(); toast(refLabel(r) + " added"); } else toast("Already listed"); } return; }
    if (!p) return;
    if (f === "title") { var v = t.value.trim(); if (v) { p.title = v; persist(); renderItems(); toast("Saved"); } else t.value = p.title; return; }
    if (f === "owner" || f === "approver") { p[f] = t.value.trim(); persist(); renderItems(); toast("Saved"); return; }
    if (f === "cycleMonths" || f === "attestDays") { p[f] = +t.value; persist(); keepFocus(function () { renderAll(); }); toast("Saved"); return; }
    if (f === "aud") {
      var all = p.audience.indexOf("*") !== -1;
      if (t.value === "*") p.audience = t.checked ? ["*"] : [];
      else { p.audience = p.audience.filter(function (x) { return x !== t.value; }); if (t.checked) p.audience.push(t.value); }
      if (!p.audience.length) p.audience = ["*"];
      persist(); keepFocus(renderAll); toast("Audience saved"); return;
    }
    if (f === "ob") {
      var ids = p.obligation_ids || (p.obligation_ids = []), i = ids.indexOf(t.value);
      if (t.checked && i === -1) ids.push(t.value); else if (!t.checked && i !== -1) ids.splice(i, 1);
      PD.logEntry(ST, meName(), p.id, t.checked ? "mapped" : "unmapped", t.value); persist(); keepFocus(function () { renderKpis(); renderDetail(); }); return;
    }
  });
  document.addEventListener("input", function (e) {
    if (e.target.id === "q") { S.q = e.target.value; renderItems(); }
  });
  document.addEventListener("keydown", function (e) {
    var a = document.activeElement, tag = (a || {}).tagName;
    if (e.key === "/" && S.tab === "library" && tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT" && !dlg.open) { e.preventDefault(); $("q").focus(); return; }
    if ((e.key === "ArrowDown" || e.key === "ArrowUp") && a && a.classList.contains("item")) {
      e.preventDefault();
      var li = a.closest("li"), n = e.key === "ArrowDown" ? li.nextElementSibling : li.previousElementSibling;
      if (n && n.querySelector(".item")) n.querySelector(".item").focus(); return;
    }
    if ((e.key === "ArrowRight" || e.key === "ArrowLeft") && a && (a.classList.contains("tab") || a.classList.contains("dtab"))) {
      var sibs = Array.prototype.slice.call(a.parentNode.querySelectorAll('[role="tab"]')), i = sibs.indexOf(a);
      var nx = sibs[(i + (e.key === "ArrowRight" ? 1 : sibs.length - 1)) % sibs.length];
      e.preventDefault(); nx.focus(); nx.click(); return;
    }
    if (e.key === "Enter" && a && /^st-(name|team|role)$/.test(a.id)) { e.preventDefault(); addStaffFromForm(); return; }
    if ((e.metaKey || e.ctrlKey) && a && a.id === "ed" && (e.key === "b" || e.key === "i")) { e.preventDefault(); tool(e.key); }
  });
  window.addEventListener("beforeunload", flushDraft);
  window.addEventListener("pagehide", flushDraft);
  window.addEventListener("beforeprint", function () { /* print document is built before window.print() */ });

  boot();
})();
