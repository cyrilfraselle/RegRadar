/* ═══════════════════════════════════════════════════════════════
   RegRadar: impact analysis, deterministic matcher (epic E1)

   Pure logic, no DOM, no network, no model. Maps one RegWatch item to
   instruments (applicability.json), obligations (obligations.json),
   customer segments, dates and a severity suggestion, using the rules
   in data/impact-rules.json. Every match carries the exact terms that
   produced it, so a compliance officer can check it.

   AI HOOK (slice A3 in VISION.md): AI-assisted matching will plug into
   docs/ai.js later, as an optional second opinion on top of this result.
   Nothing here calls a model.

   Loadable in the browser (window.ImpactMatch) and in Node (tests).
   ═══════════════════════════════════════════════════════════════ */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ImpactMatch = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* ---------- small helpers ---------- */
  function esc(s) { return String(s).replace(/[.*+?^${}()|[\]\\\/]/g, "\\$&"); }
  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function dayNum(iso) { var p = iso.split("-"); return Math.round(Date.UTC(+p[0], +p[1] - 1, +p[2]) / 864e5); }
  function addDays(iso, n) { var d = new Date((dayNum(iso) + n) * 864e5); return d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate()); }
  function diffDays(a, b) { return dayNum(a) - dayNum(b); }
  function validISO(s) { return /^\d{4}-\d{2}-\d{2}$/.test(s || "") && addDays(s, 0) === s; }
  function conf(score) { return score >= 4 ? "high" : score >= 2 ? "medium" : score > 0 ? "low" : ""; }
  var CONF_RANK = { high: 3, medium: 2, low: 1, "": 0 };
  function has(a, v) { return a.indexOf(v) !== -1; }

  /* A rule term is "text", "stem*" (no end boundary) or {t, cs} for
     case-sensitive acronyms. Spaces and hyphens match each other. */
  function compileTerm(t) {
    var o = typeof t === "string" ? { t: t } : t;
    var raw = o.t, stem = /\*$/.test(raw);
    if (stem) raw = raw.slice(0, -1);
    var body = raw.split(/[\s\-]+/).map(esc).join("[\\s\\-\\u2010-\\u2015]+");
    var re = new RegExp("(?:^|[^A-Za-z0-9])" + body + (stem ? "" : "(?![A-Za-z0-9])"), o.cs ? "" : "i");
    return { re: re, label: raw + (stem ? "…" : "") , key: raw.toLowerCase() };
  }
  function compileList(list) { return (list || []).map(compileTerm); }

  function celexParts(celex) {
    var m = /^3(\d{4})([RL])(\d+)$/.exec(celex || "");
    if (!m) return null;
    return { year: m[1], type: m[2], num: String(parseInt(m[3], 10)) };
  }
  function identifierRes(celex) {
    var p = celexParts(celex), out = [{ re: new RegExp("(?:^|[^A-Za-z0-9])" + esc(celex) + "(?![A-Za-z0-9])"), label: "CELEX " + celex }];
    if (p) {
      out.push({ re: new RegExp("(?:^|[^\\d/])" + p.year + "/0*" + p.num + "(?![\\d])"), label: p.year + "/" + p.num });
      out.push({ re: new RegExp("(?:^|[^\\d/])0*" + p.num + "/" + p.year + "(?![\\d])"), label: p.num + "/" + p.year });
    }
    return out;
  }

  /* ---------- engine ---------- */
  function create(rules, app, obligations) {
    var regs = (app && app.regulations) || [];
    var regById = {}, regByCelex = {};
    regs.forEach(function (r) { regById[r.id] = r; regByCelex[r.celex] = r; });

    var compiled = {};
    regs.forEach(function (r) {
      var ir = (rules.instruments || {})[r.id] || {};
      compiled[r.id] = {
        ids: identifierRes(r.celex),
        aliases: compileList(ir.aliases),
        keywords: compileList(ir.keywords),
        broad: compileList(ir.broad),
        sources: ir.sources || [],
        themes: []
      };
      var th = (rules.themeToTopic || {})[r.topic] || [];
      compiled[r.id].themes = th;
    });
    var topicTerms = {}, specTerms = {};
    Object.keys(rules.obligationTopics || {}).forEach(function (t) { topicTerms[t] = compileList(rules.obligationTopics[t]); });
    Object.keys(rules.obligationKeywords || {}).forEach(function (id) { specTerms[id] = compileList(rules.obligationKeywords[id]); });
    var tagTerms = {};
    Object.keys(rules.tags || {}).forEach(function (k) { tagTerms[k] = compileList(rules.tags[k].keywords); });
    var segTerms = {};
    (rules.segments || []).forEach(function (s) { segTerms[s.id] = compileList(s.keywords); });

    function obParent(o) {
      var m = /celex=(\d{5}[A-Z]\d{4})/.exec(o.source_url || "");
      return m && regByCelex[m[1]] ? regByCelex[m[1]].id : "";
    }
    function obArt(o) { var m = /art=(\d+)/.exec(o.source_url || ""); return m ? m[1] : ((o.legal_basis || "").match(/(\d+)/) || [])[1] || ""; }

    function prep(item) {
      var title = String(item.title || "").replace(/^(?:CELEX|OJ):\S+:\s*/, "");
      var summary = [item.summary || "", item.so_what || ""].join(" ").replace(/\s+/g, " ").trim();
      return { title: title, summary: summary, url: String(item.url || ""), source: String(item.source || ""),
        all: title + " • " + summary + " • " + item.url };
    }
    function hit(term, txt) { return term.re.test(txt); }

    function verdictFor(reg, entity, acts) {
      if (!entity) return "unknown";
      var s = (reg.applies || {})[entity] || "na", raises = reg.activity_raises || {};
      (acts || []).forEach(function (a) {
        var t = raises[a];
        if (t && has(t, entity)) s = s === "na" ? "conditional" : "direct";
      });
      return s;
    }

    /* ----- instruments ----- */
    function scoreInstrument(reg, tx, item) {
      var c = compiled[reg.id], reasons = [], score = 0, seen = {};
      var idHit = null;
      c.ids.forEach(function (t) { if (!idHit && hit(t, tx.all)) idHit = t; });
      if (idHit) { score += 4; reasons.push({ kind: "identifier", term: idHit.label, where: "text" }); }
      var nameBest = 0, nameReason = null;
      c.aliases.forEach(function (t) {
        var w = hit(t, tx.title) ? 3 : hit(t, tx.summary) ? 2 : 0;
        if (w > nameBest) { nameBest = w; nameReason = { kind: "name", term: t.label, where: w === 3 ? "title" : "summary" }; }
      });
      if (nameBest) { score += nameBest; reasons.push(nameReason); }
      var kw = 0;
      c.keywords.forEach(function (t) {
        if (seen[t.key]) return;
        var w = hit(t, tx.title) ? 1.5 : hit(t, tx.summary) ? 1 : 0;
        if (w) { seen[t.key] = 1; kw += w; reasons.push({ kind: "keyword", term: t.label, where: w === 1.5 ? "title" : "summary" }); }
      });
      score += Math.min(kw, 4);
      var br = 0;
      c.broad.forEach(function (t) {
        if (seen[t.key]) return;
        if (hit(t, tx.title) || hit(t, tx.summary)) { seen[t.key] = 1; br += 0.5; reasons.push({ kind: "broad", term: t.label, where: "text" }); }
      });
      score += Math.min(br, 1);
      var srcHit = c.sources.filter(function (s) { return tx.source.indexOf(s) !== -1; })[0];
      if (srcHit) { score += 1; reasons.push({ kind: "source", term: srcHit, where: "source" }); }
      var themeHit = (item.themes || []).filter(function (t) { return has(c.themes, t); })[0];
      if (themeHit) { score += 0.5; reasons.push({ kind: "theme", term: themeHit, where: "RegWatch theme" }); }
      /* Without an identifier, a name or a specific keyword, the signals left (broad terms,
         source, theme) are context only and never rise above low. */
      if (!idHit && !nameBest && !kw && score >= 2) score = 1.9;
      return { score: score, reasons: reasons };
    }

    /* ----- obligations ----- */
    function scoreObligation(o, tx, instrScore, entity) {
      var reasons = [], score = 0, seen = {};
      var spec = specTerms[o.id] || [], top = topicTerms[o.topic] || [];
      var kw = 0;
      spec.forEach(function (t) {
        if (seen[t.key]) return;
        var w = hit(t, tx.title) ? 1.5 : hit(t, tx.summary) ? 1 : 0;
        if (w) { seen[t.key] = 1; kw += w; reasons.push({ kind: "keyword", term: t.label, where: w === 1.5 ? "title" : "summary" }); }
      });
      score += Math.min(kw, 4);
      var tk = 0;
      top.forEach(function (t) {
        if (seen[t.key]) return;
        var w = hit(t, tx.title) ? 1 : hit(t, tx.summary) ? 0.5 : 0;
        if (w) { seen[t.key] = 1; tk += w; reasons.push({ kind: "topic", term: t.label + " (" + o.topic + ")", where: w === 1 ? "title" : "summary" }); }
      });
      score += Math.min(tk, 2);
      var n = obArt(o);
      var cite = n ? new RegExp("\\b(?:articles?|arts?\\.?)\\s*(?:\\d+\\s*(?:,|and|to|\\u2013|-)\\s*)*" + n + "\\b", "i") : null;
      if (cite && instrScore >= 2 && cite.test(tx.title + " " + tx.summary)) { score += 4; reasons.push({ kind: "citation", term: "Article " + n, where: "text" }); }
      var own = score > 0;
      if (own && instrScore >= 2) { score += 1; reasons.push({ kind: "parent", term: "instrument matched", where: "instrument" }); }
      var inScope = !entity || !(o.who && o.who.length) || has(o.who, entity);
      return { score: score, reasons: reasons, own: own, inScope: inScope };
    }

    /* ----- dates (only what the text says) ----- */
    var MONTHS = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
      jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
    var MN = "january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec";
    function classify(ctx, after) {
      var before = ctx.slice(-48).toLowerCase();
      if (/\bof\s*$/.test(before) && /(regulation|decision|directive|implementing|delegated|act)\b/.test(ctx.slice(-120).toLowerCase())) return "act";
      if (/(shall apply|will apply|applies|apply|applicable|application|enters? into (force|application)|entry into (force|application)|in force|effective|takes? effect|as of|from|starting|starts?|begin(s)?)\W*(?:on|from|as of)?\W*$/.test(before)) return "effective";
      if (/(until|by|before|no later than|deadline|respond|responses|feedback|comments?|submit(ted)?|closes?|closing|open (until|till)|due)\W*(?:on|from)?\W*$/.test(before) || /^\W*(deadline|is the deadline)/i.test(after)) return "closing";
      return "mentioned";
    }
    function extractDates(tx) {
      var out = [], seen = {};
      [["title", tx.title], ["summary", tx.summary]].forEach(function (pair) {
        var where = pair[0], text = pair[1], m;
        [new RegExp("\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(" + MN + ")\\.?,?\\s+(\\d{4})\\b", "gi"), new RegExp("\\b(" + MN + ")\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})\\b", "gi")].forEach(function (re, k) {
          while ((m = re.exec(text))) {
            var d = k === 0 ? +m[1] : +m[2], mo = MONTHS[(k === 0 ? m[2] : m[1]).toLowerCase()], y = +m[3];
            var iso = y + "-" + pad(mo) + "-" + pad(d);
            if (!mo || !validISO(iso) || y < 2000 || y > 2100) continue;
            var kind = classify(text.slice(Math.max(0, m.index - 120), m.index), text.slice(m.index + m[0].length, m.index + m[0].length + 40));
            var key = iso + kind;
            if (seen[key]) continue;
            seen[key] = 1;
            var s0 = Math.max(0, m.index - 55), s1 = Math.min(text.length, m.index + m[0].length + 35);
            out.push({ iso: iso, kind: kind, where: where, snippet: (s0 > 0 ? "…" : "") + text.slice(s0, s1).trim() + (s1 < text.length ? "…" : "") });
          }
        });
      });
      return out;
    }

    /* ----- tags from the text ----- */
    function textTags(tx) {
      var out = {};
      Object.keys(tagTerms).forEach(function (k) {
        var reasons = [], w = 0;
        tagTerms[k].forEach(function (t) {
          if (hit(t, tx.title)) { w += 2; reasons.push({ kind: "keyword", term: t.label, where: "title" }); }
          else if (hit(t, tx.summary)) { w += 1; reasons.push({ kind: "keyword", term: t.label, where: "summary" }); }
        });
        if (w) out[k] = { conf: w >= 2 ? "medium" : "low", reasons: reasons.slice(0, 4) };
      });
      return out;
    }

    /* ----- analyze one item ----- */
    function analyze(item, profile) {
      profile = profile || {};
      var entity = profile.entity || "", acts = profile.acts || [];
      var tx = prep(item);
      var instruments = [], byId = {};
      regs.forEach(function (r) {
        var s = scoreInstrument(r, tx, item);
        if (s.score <= 0) return;
        var verdict = verdictFor(r, entity, acts), c = conf(s.score);
        var m = { id: r.id, name: r.name, full_name: r.full_name, celex: r.celex, topic: r.topic, instrument: r.instrument, applies_from: r.applies_from || "",
          score: s.score, conf: c, reasons: s.reasons, verdict: verdict, why: r.why || "", note: (r.notes || {})[entity] || "",
          defaultOn: (c === "high" || c === "medium") && verdict !== "na" };
        instruments.push(m); byId[r.id] = m;
      });
      instruments.sort(function (a, b) { return b.score - a.score; });

      var obs = [], others = [], obById = {};
      (obligations || []).forEach(function (o) { obById[o.id] = o; });
      (obligations || []).forEach(function (o) {
        var pid = obParent(o), parent = byId[pid];
        var s = scoreObligation(o, tx, parent ? parent.score : 0, entity);
        var base = { id: o.id, parent: pid, score: s.score, conf: conf(s.score), reasons: s.reasons, inScope: s.inScope };
        if (s.own) {
          base.defaultOn = (base.conf === "high" || base.conf === "medium") && s.inScope;
          obs.push(base);
        } else if (parent && parent.defaultOn) {
          others.push({ id: o.id, parent: pid, inScope: s.inScope });
        }
      });
      obs.sort(function (a, b) { return b.score - a.score; });

      /* Specific obligation evidence (an article cited, or specific terms in the title) is evidence
         for the instrument itself: lift it to medium so the two never disagree. */
      obs.forEach(function (ob) {
        var pm = byId[ob.parent];
        if (!pm || !ob.reasons.some(function (r) { return r.kind === "citation" || r.kind === "keyword" || r.kind === "topic"; })) return;
        var own = ob.score - (ob.reasons.some(function (r) { return r.kind === "parent"; }) ? 1 : 0);
        if (own >= 2 && pm.score < 2) {
          pm.score = 2; pm.conf = "medium";
          pm.reasons.push({ kind: "obligation", term: "terms of " + (obById[ob.id] ? obById[ob.id].legal_basis : ob.id), where: "obligation match" });
          pm.defaultOn = pm.verdict !== "na";
        }
      });
      instruments.sort(function (a, b) { return b.score - a.score; });

      var tags = textTags(tx);
      var dates = extractDates(tx);
      var dl = String(item.deadline || "").slice(0, 10);
      if (validISO(dl)) dates.unshift({ iso: dl, kind: "field", where: "RegWatch deadline field", snippet: "RegWatch deadline field" });

      return { itemId: item.id, instruments: instruments, obligations: obs, others: others, tags: tags, dates: dates, profile: { entity: entity, acts: acts } };
    }

    /* ----- effective view: analysis plus the user's overrides ----- */
    function isOn(over, group, id, def) {
      var v = over && over[group] ? over[group][id] : undefined;
      return v === undefined ? !!def : !!v;
    }

    function effective(an, over, ctx) {
      ctx = ctx || {};
      var instrOn = {}, obOn = {};
      an.instruments.forEach(function (m) { instrOn[m.id] = isOn(over, "instr", m.id, m.defaultOn); });
      Object.keys((over && over.instr) || {}).forEach(function (id) { if (over.instr[id] && regById[id]) instrOn[id] = true; });
      an.obligations.forEach(function (m) { obOn[m.id] = isOn(over, "ob", m.id, m.defaultOn); });
      Object.keys((over && over.ob) || {}).forEach(function (id) { if (over.ob[id]) obOn[id] = true; });
      var instrIds = Object.keys(instrOn).filter(function (k) { return instrOn[k]; });
      var obIds = Object.keys(obOn).filter(function (k) { return obOn[k]; });
      var obById = {}; (obligations || []).forEach(function (o) { obById[o.id] = o; });
      obIds = obIds.filter(function (id) { return obById[id]; });

      /* tags: from the text, raised by included instruments */
      var tagList = {};
      Object.keys(an.tags).forEach(function (k) { tagList[k] = { conf: an.tags[k].conf, reasons: an.tags[k].reasons.slice() }; });
      Object.keys(rules.tags || {}).forEach(function (k) {
        var viaInstr = (rules.tags[k].instruments || []).filter(function (i) { return has(instrIds, i); });
        if (viaInstr.length) {
          tagList[k] = tagList[k] || { conf: "medium", reasons: [] };
          tagList[k].conf = "high";
          tagList[k].reasons.unshift({ kind: "instrument", term: viaInstr[0], where: "affected instrument" });
        }
      });
      var obTopics = obIds.map(function (id) { return obById[id].topic; });

      /* segments */
      var segments = [];
      (rules.segments || []).forEach(function (s) {
        var reasons = [], c = "";
        (s.obligationTopics || []).forEach(function (t) {
          var ids = obIds.filter(function (id) { return obById[id].topic === t; });
          if (ids.length) { reasons.push({ kind: "obligation", term: t + " obligation" + (ids.length > 1 ? "s" : ""), where: "affected obligations" }); c = "medium"; }
        });
        (s.instruments || []).forEach(function (i) { if (has(instrIds, i)) { reasons.push({ kind: "instrument", term: i, where: "affected instruments" }); c = "medium"; } });
        (s.tags || []).forEach(function (t) { if (tagList[t] && CONF_RANK[tagList[t].conf] >= 2 && !c) { reasons.push({ kind: "tag", term: rules.tags[t].label, where: "topic of the item" }); c = "low"; } });
        if (!reasons.length) {
          var tx2 = ctx.tx;
          if (tx2) segTerms[s.id].forEach(function (t) { if (hit(t, tx2.title) || hit(t, tx2.summary)) { reasons.push({ kind: "keyword", term: t.label, where: "text" }); c = "low"; } });
        }
        if (reasons.length) segments.push({ id: s.id, label: s.label, note: s.note || "", conf: c, reasons: reasons, defaultOn: c === "medium" || c === "high" });
      });

      /* controls */
      var controls = {}, ctlList = ctx.controls || [];
      ctlList.forEach(function (c) {
        var viaOb = obIds.filter(function (id) { return has(c.obligation_ids || [], id); });
        if (viaOb.length) controls[c.id] = { id: c.id, via: "obligation", obligations: viaOb, conf: "high", defaultOn: true };
      });
      Object.keys(tagList).forEach(function (k) {
        if (CONF_RANK[tagList[k].conf] < 2) return;
        var words = rules.tags[k].controlWords || [];
        ctlList.forEach(function (c) {
          if (controls[c.id]) return;
          var nm = String(c.name || "").toLowerCase(), w = words.filter(function (x) { return nm.indexOf(x) !== -1; })[0];
          if (w) controls[c.id] = { id: c.id, via: "name", term: w, tag: rules.tags[k].label, obligations: [], conf: "low", defaultOn: false };
        });
      });
      var controlRows = Object.keys(controls).map(function (id) { var r = controls[id]; r.on = isOn(over, "ctl", id, r.defaultOn); return r; });
      /* manual adds */
      Object.keys((over && over.ctl) || {}).forEach(function (id) {
        if (over.ctl[id] && !controls[id] && ctlList.some(function (c) { return c.id === id; })) controlRows.push({ id: id, via: "manual", obligations: [], conf: "", defaultOn: true, on: true });
      });

      /* policies */
      var pols = {}, polList = (ctx.policies || []).filter(function (p) { return !p.retired; });
      var celexOn = instrIds.map(function (i) { return regById[i] ? regById[i].celex : ""; });
      polList.forEach(function (p) {
        var viaOb = obIds.filter(function (id) { return has(p.obligation_ids || [], id); });
        var viaRef = (p.legal_refs || []).map(function (r) { return r.celex; }).filter(function (cx) { return has(celexOn, cx); });
        if (viaOb.length) pols[p.id] = { id: p.id, via: "obligation", obligations: viaOb, conf: "high", defaultOn: true };
        else if (viaRef.length) pols[p.id] = { id: p.id, via: "legal reference", term: viaRef[0], obligations: [], conf: "medium", defaultOn: true };
      });
      Object.keys(tagList).forEach(function (k) {
        if (CONF_RANK[tagList[k].conf] < 2) return;
        var words = rules.tags[k].policyWords || [];
        polList.forEach(function (p) {
          if (pols[p.id]) return;
          var nm = String(p.title || "").toLowerCase(), w = words.filter(function (x) { return nm.indexOf(x) !== -1; })[0];
          if (w) pols[p.id] = { id: p.id, via: "name", term: w, tag: rules.tags[k].label, obligations: [], conf: "low", defaultOn: false };
        });
      });
      var polRows = Object.keys(pols).map(function (id) { var r = pols[id]; r.on = isOn(over, "pol", id, r.defaultOn); return r; });
      Object.keys((over && over.pol) || {}).forEach(function (id) {
        if (over.pol[id] && !pols[id] && polList.some(function (p) { return p.id === id; })) polRows.push({ id: id, via: "manual", obligations: [], conf: "", defaultOn: true, on: true });
      });

      segments.forEach(function (s) { s.on = isOn(over, "seg", s.id, s.defaultOn); });
      return { instrIds: instrIds, obIds: obIds, instrOn: instrOn, obOn: obOn, tags: tagList, segments: segments, controls: controlRows, policies: polRows, obTopics: obTopics };
    }

    /* coverage of one obligation by the control list */
    function coverage(obId, controls, today, isOverdue) {
      var mapped = (controls || []).filter(function (c) { return has(c.obligation_ids || [], obId); });
      if (!mapped.length) return { state: "gap", controls: [], weak: [] };
      var weak = mapped.filter(function (c) {
        var bad = c.status !== "approved" || /^(ineffective|failed|partial|partially_effective|not_effective)$/.test(c.effectiveness || "") || (isOverdue && today && isOverdue(c, today));
        return bad;
      });
      return { state: weak.length === mapped.length ? "attention" : "covered", controls: mapped, weak: weak };
    }

    /* ----- suggestions (always labelled as suggestions in the UI) ----- */
    function suggestSeverity(item, eff, an, gapCount) {
      var lw = +item.legal_weight || 1, why = [], pts = 0;
      if (lw >= 9) { pts += 3; why.push("binding act (RegWatch legal weight " + lw + ")"); }
      else if (lw >= 6) { pts += 2; why.push("guidance or supervisory text (legal weight " + lw + ")"); }
      else if (lw >= 3) { pts += 1; why.push("not yet binding or informal (legal weight " + lw + ")"); }
      else why.push("informational (legal weight " + lw + ")");
      if (+item.impact === 3) { pts += 0.5; why.push("RegWatch impact label Critical"); }
      var best = an.instruments.filter(function (m) { return eff.instrOn[m.id]; }).reduce(function (a, m) { return Math.max(a, CONF_RANK[m.conf]); }, 0);
      if (best === 3) { pts += 1; why.push("high-confidence instrument match"); }
      else if (best === 2) { pts += 0.5; why.push("medium-confidence instrument match"); }
      else why.push("no instrument counted as affected");
      if (gapCount > 0) { pts += 0.5; why.push(gapCount + " affected obligation" + (gapCount > 1 ? "s" : "") + " without a control"); }
      var v = pts >= 4 ? "critical" : pts >= 3 ? "high" : pts >= 1.5 ? "medium" : "low";
      if (!eff.instrIds.length && !eff.obIds.length && v !== "low") { v = pts >= 3 ? "medium" : "low"; }
      return { value: v, why: why };
    }
    function suggestDecision(item, eff) {
      var lw = +item.legal_weight || 1, st = item.legal_status || "";
      var counted = eff.instrIds.length + eff.obIds.length;
      if (!counted && lw <= 3) return { value: "no_action", why: "Informational item and nothing in the register matches." };
      if (/not-yet-binding/.test(st) || has(["consultation", "proposal"], item.doc_type) || has(["consultation", "proposal"], item.lifecycle)) return { value: "monitor", why: "Not yet binding (" + (item.lifecycle_label || item.doc_label || st || "draft") + "): track, prepare, respond if relevant." };
      if (counted && (lw >= 6 || /binding/.test(st))) return { value: "action", why: "Binding or supervisory text that touches the register." };
      if (!counted) return { value: "monitor", why: "No confident match, but the item may still matter. Read the source." };
      return { value: "monitor", why: "Relevant to the register but not binding text." };
    }

    return { analyze: analyze, effective: effective, coverage: coverage, suggestSeverity: suggestSeverity, suggestDecision: suggestDecision,
      prep: prep, verdictFor: verdictFor, obParent: obParent, obArt: obArt, regById: regById, regByCelex: regByCelex };
  }

  /* ---------- task generation (pure) ---------- */
  var SEV_ORDER = ["critical", "high", "medium", "low"];
  function lowerSev(sev, steps) { var i = SEV_ORDER.indexOf(sev); if (i < 0) i = 2; return SEV_ORDER[Math.min(SEV_ORDER.length - 1, i + (steps || 0))]; }

  /* due date: counted back from the planning deadline when it is still ahead,
     otherwise counted forward from today. */
  function dueFor(tpl, anchor, today) {
    if (anchor && validISO(anchor) && diffDays(anchor, today) > 0) {
      var d = addDays(anchor, -tpl.daysBefore);
      return d < today ? addDays(today, Math.min(tpl.fallbackDays, Math.max(1, diffDays(anchor, today) - 1))) : d;
    }
    return addDays(today, tpl.fallbackDays);
  }

  /* Build the suggested task set. Returns [{key, kind, title, detail, owner, due, severity, obligation_ids, control_ids, policy_ids, anchorUsed}] */
  function buildTasks(rules, input) {
    var T = rules.taskTemplates, out = [], today = input.today, decision = input.decision;
    if (decision === "no_action") return out;
    var sev = input.severity || "medium", itemTitle = input.itemTitle || "this item";
    var short = itemTitle.length > 70 ? itemTitle.slice(0, 67) + "…" : itemTitle;
    function fill(s, o) { return s.replace(/\{(\w+)\}/g, function (_, k) { return o[k] != null ? o[k] : ""; }); }
    function add(key, kind, tpl, vars, extra) {
      var anchor = (extra && extra.anchor) || input.anchor || "";
      var t = Object.assign({ key: key, kind: kind, title: fill(tpl.title, vars), detail: tpl.detail, owner: input.owner || "",
        due: dueFor(tpl, anchor, today), severity: lowerSev(sev, tpl.weight || 0), obligation_ids: [], control_ids: [], policy_ids: [], role: tpl.role }, extra || {});
      out.push(t);
    }
    add("confirm", "confirm", T.confirm, { item: short });
    if (input.consultation && validISO(input.consultation) && diffDays(input.consultation, today) >= 0) {
      add("consult", "consult", T.consult, {}, { anchor: input.consultation });
    }
    if (decision === "monitor") {
      add("monitor", "monitor", T.monitor, { item: short });
      return out;
    }
    (input.gaps || []).forEach(function (g) { add("gap:" + g.id, "gap", T.gap, { obligation: g.label }, { obligation_ids: [g.id] }); });
    (input.controls || []).forEach(function (c) { add("ctl:" + c.id, "control", T.control, { control: c.label }, { control_ids: [c.id], obligation_ids: c.obligation_ids || [], owner: c.owner || input.owner || "" }); });
    (input.policies || []).forEach(function (p) { add("pol:" + p.id, "policy", T.policy, { policy: p.label }, { policy_ids: [p.id], obligation_ids: p.obligation_ids || [], owner: p.owner || input.owner || "" }); });
    if (input.segments && input.segments.length) {
      var segLabels = input.segments.slice(0, 2).map(function (s) { return s.label.toLowerCase(); }).join(" and ");
      add("customers", "customers", T.customers, { segments: segLabels + (input.segments.length > 2 ? " and " + (input.segments.length - 2) + " more" : "") });
    }
    if (sev === "critical" || sev === "high") add("board", "board", T.board, {});
    if ((input.controls || []).length || (input.policies || []).length) add("training", "training", T.training, {});
    return out;
  }

  return { create: create, buildTasks: buildTasks, dueFor: dueFor, addDays: addDays, diffDays: diffDays, validISO: validISO,
    CONF_RANK: CONF_RANK, SEV_ORDER: SEV_ORDER, lowerSev: lowerSev };
});
