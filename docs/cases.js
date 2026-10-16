/* ═══════════════════════════════════════════════════════════════
   RegRadar: monitoring alerts, case management and STR/SAR

   Device-local (localStorage key 'regradar-cases'). Seeds with fictional
   demo data from data/cases-seed.json. Typologies and red-flag checklists
   come from data/cases-typologies.json (shared vocabulary with the
   Academy casebook). Law quotations are extracted at load time from
   data/laws/32024R1624_EN.json, so they are verbatim by construction.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var NARR = window.CasesNarr;
  var KEY = 'regradar-cases';
  var CELEX = '32024R1624';
  var DEF = function () {
    return { firm: 'CF Bank (fictional)', me: 'Analyst A', mlro: 'MLRO (demo)', team: ['Analyst A', 'Analyst B', 'MLRO (demo)'],
      sla: { high: 1, medium: 3, low: 5 }, caseDays: 10, fileDays: 3, ackDays: 3, holidays: [] };
  };
  var PRIO = ['high', 'medium', 'low'];
  var STATUS = { open: 'Open', review: 'In analyst review', mlro: 'Awaiting MLRO decision', filing: 'Awaiting filing', filed: 'Filed with FIU', closed: 'Closed' };
  var ASTATUS = { new: 'New', in_review: 'In review', closed: 'Closed: false positive', escalated: 'Escalated to case' };
  var DECISION = { report: 'Report to the FIU', noreport: 'Do not report', refer: 'Refer elsewhere' };
  var CLOSE_REASONS = ['Explained by documented customer activity', 'Consistent with the expected profile or business model', 'Duplicate of another alert or case', 'Data or system error', 'Name match discounted: a different person', 'Reviewed and below our risk threshold', 'Other (explain in the note)'];
  var EVTYPES = [['note', 'Note'], ['analysis', 'Analysis'], ['rfi', 'Internal request'], ['external', 'Contact with an authority or another institution'], ['customer', 'Contact with the customer']];
  var QSPEC = {
    promptly: { art: '69', ref: 'Art. 69(1)', from: 'Obliged entities, and, where applicable, their directors and employees, shall cooperate fully', to: 'additional information in such cases;' },
    attempted: { art: '69', ref: 'Art. 69(1), second subparagraph', from: 'All suspicious transactions, including attempted transactions', to: 'in accordance with the first subparagraph.' },
    fiu5: { art: '69', ref: 'Art. 69(1), third subparagraph', from: 'For the purposes of the first subparagraph, obliged entities shall reply to requests', to: 'including to less than 24 hours.' },
    fiuExt: { art: '69', ref: 'Art. 69(1), fourth subparagraph', from: 'By way of derogation from the third subparagraph', to: 'does not undermine the FIU’s analysis.' },
    basis: { art: '69', ref: 'Art. 69(2)', from: 'A suspicion pursuant to paragraph 1, point (a), shall be based', to: 'risk profile of the client.' },
    indicators: { art: '69', ref: 'Art. 69(5)', from: 'By 10 July 2027, AMLA shall issue guidelines', to: 'periodically updated.' },
    officer: { art: '69', ref: 'Art. 69(6)', from: 'The compliance officer appointed in accordance with Article 11(2) shall transmit', to: 'is established.' },
    officer11: { art: '11', ref: 'Art. 11(2)', from: 'The compliance officer shall also be responsible for reporting', to: 'in accordance with Article 69(6).' },
    refrain: { art: '71', ref: 'Art. 71(1)', from: 'Obliged entities shall refrain from carrying out transactions', to: 'within 3 working days of submitting the report.' },
    refrain2: { art: '71', ref: 'Art. 71(2)', from: 'Where it is not possible for an obliged entity', to: 'immediately after carrying out the transaction.' },
    goodfaith: { art: '72', ref: 'Art. 72', from: 'Disclosure of information to the FIU in good faith', to: 'whether illegal activity actually occurred.' },
    tipping: { art: '73', ref: 'Art. 73(1)', from: 'Obliged entities and their directors, employees', to: 'is being, or may be, carried out.' },
    apply: { art: '90', ref: 'Art. 90', from: 'It shall apply from 10 July 2027', to: 'to which it shall apply from 10 July 2029.' }
  };

  var DB = null, TYPO = { typologies: [], common: [] }, LAW = null, OB = null, SEED = null, QUOTES = {};
  var UI = { tab: 'alerts', alert: null, case: null, csub: 'summary', f: { status: 'open', priority: '', typology: '', assignee: '', q: '', sort: 'sla' }, cf: { status: 'active', q: '' }, mdet: false, focus: null, opener: null };

  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function toast(m) { var t = $('toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove('on'); }, 2600); }
  function pad(n, w) { n = String(n); while (n.length < w) n = '0' + n; return n; }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1, 2) + '-' + pad(d.getDate(), 2); }
  function parseISO(s) { var p = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || ''); return p ? new Date(+p[1], +p[2] - 1, +p[3]) : null; }
  function dayEnd(s) { var d = parseISO(s); if (!d) return null; d.setHours(23, 59, 59, 0); return d; }
  function fmtD(x) { var d = typeof x === 'string' ? (x.length === 10 ? parseISO(x) : new Date(x)) : x; return d && !isNaN(d) ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''; }
  function fmtDT(x) { var d = new Date(x); return isNaN(d) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) + ', ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); }
  function nowIso() { return new Date().toISOString(); }
  function isWD(d) { var w = d.getDay(); return w !== 0 && w !== 6 && DB.settings.holidays.indexOf(iso(d)) === -1; }
  function addWD(d, n) { var x = new Date(d.getTime()), c = 0; while (c < n) { x.setDate(x.getDate() + 1); if (isWD(x)) c++; } return x; }
  function remain(due, soonH) {
    var ms = due - new Date(), abs = Math.abs(ms), h = abs / 36e5, txt;
    if (h < 1) txt = Math.max(1, Math.round(abs / 6e4)) + 'm';
    else if (h < 48) txt = Math.round(h) + 'h';
    else txt = Math.floor(h / 24) + 'd ' + Math.round(h % 24) + 'h';
    var st = ms < 0 ? 'overdue' : (ms < (soonH || 24) * 36e5 ? 'soon' : 'ok');
    return { state: st, text: ms < 0 ? txt + ' overdue' : txt + ' left', ms: ms };
  }
  function clockChip(due, soonH) { var r = remain(due, soonH); return '<span class="clock ' + (r.state === 'ok' ? '' : r.state) + '">' + esc(r.text) + '</span>'; }

  /* ---------- data ---------- */
  function normalize(d) {
    d.settings = Object.assign(DEF(), d.settings || {});
    d.settings.sla = Object.assign(DEF().sla, d.settings.sla || {});
    ['alerts', 'cases', 'filings', 'requests'].forEach(function (k) { if (!Array.isArray(d[k])) d[k] = []; });
    d.seq = Object.assign({ alert: 0, case: 0, filing: 0, req: 0 }, d.seq || {});
    d.cases.forEach(function (c) {
      c.alertIds = c.alertIds || []; c.subjects = c.subjects || []; c.timeline = c.timeline || []; c.evidence = c.evidence || [];
      c.flagState = c.flagState || {}; c.customFlags = c.customFlags || []; c.narr = c.narr || {};
      if (!Array.isArray(c.narr.actions)) c.narr.actions = [];
    });
    return d;
  }
  function loadDB() { try { var r = localStorage.getItem(KEY); if (r) { var d = JSON.parse(r); if (d && Array.isArray(d.alerts) && Array.isArray(d.cases)) return normalize(d); } } catch (e) { /* storage blocked */ } return null; }
  function save() { DB.updatedAt = nowIso(); try { localStorage.setItem(KEY, JSON.stringify(DB)); } catch (e) { toast('Could not save: browser storage is blocked or full. Export a backup.'); } }
  function emptyDB() { return normalize({ v: 1, settings: DEF(), alerts: [], cases: [], filings: [], requests: [], seq: {} }); }

  function narrDefaults() {
    return { type: 'STR', suspicion: 'tbd', attempted: false, cddFailure: false, includeFlags: true, actions: [], transactionHandling: '', tippingAck: false, edited: false, draft: '', currency: 'EUR',
      legalBasis: 'AMLR Art. 69(1)(a), or the national law in force until the AMLR applies (10 July 2027)' };
  }
  function hydrate(seed) {
    var d = emptyDB(), now = Date.now(), H = 36e5, D = 864e5;
    DB = d; /* addWD needs settings */
    function dayIso(daysAgo) { return iso(new Date(now - daysAgo * D)); }
    function fixDates(o) {
      var r = {}; Object.keys(o || {}).forEach(function (k) { var v = o[k]; r[k] = (v && typeof v === 'object' && !Array.isArray(v) && 'daysAgo' in v) ? dayIso(v.daysAgo) : v; }); return r;
    }
    seed.alerts.forEach(function (a) {
      var created = new Date(now - a.ageHours * H).toISOString();
      var o = { id: a.id, title: a.title, typology: a.typology, priority: a.priority, createdAt: created, assignee: a.assignee || '', status: a.status, rule: a.rule, customer: a.customer,
        summary: a.summary, amount: a.amount, facts: a.facts || {}, onFile: a.onFile || '', casebookId: a.casebookId || '', source: 'demo',
        txs: (a.txs || []).map(function (t) { return [new Date(now - t.daysAgo * D).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), t.kind, t.amount, t.party]; }),
        log: [{ at: created, by: 'System', text: 'Alert raised by monitoring rule: ' + a.rule }] };
      if (a.caseId) o.caseId = a.caseId;
      if (a.status === 'closed') { o.closeReason = a.closeReason; o.closeNote = a.closeNote; o.closedAt = new Date(now - (a.closedHoursAgo || 24) * H).toISOString(); o.log.push({ at: o.closedAt, by: o.assignee || 'Analyst', text: 'Closed as false positive: ' + a.closeReason }); }
      if (a.status === 'escalated') o.log.push({ at: new Date(now - (a.ageHours - 4) * H).toISOString(), by: o.assignee || 'Analyst', text: 'Escalated to ' + a.caseId });
      d.alerts.push(o);
    });
    seed.cases.forEach(function (c) {
      var o = { id: c.id, title: c.title, typology: c.typology, priority: c.priority, status: c.status, openedAt: new Date(now - c.openedHoursAgo * H).toISOString(), assignee: c.assignee,
        suspicionDate: c.suspicionDaysAgo == null ? '' : dayIso(c.suspicionDaysAgo), holdTransaction: !!c.holdTransaction, alertIds: c.alertIds.slice(), subjects: c.subjects, flagState: c.flagState || {}, customFlags: [], mitigation: '',
        timeline: c.timeline.map(function (e) { return { at: new Date(now - e.hoursAgo * H).toISOString(), by: e.by, type: e.type, text: e.text }; }),
        evidence: c.evidence.map(function (e) { return { label: e.label, kind: e.kind, ref: e.ref, by: c.assignee, at: new Date(now - e.hoursAgo * H).toISOString() }; }),
        analyst: c.analyst ? { name: c.analyst.name, at: new Date(now - c.analyst.hoursAgo * H).toISOString(), rec: c.analyst.rec, rationale: c.analyst.rationale } : null,
        mlro: c.mlro ? { name: c.mlro.name, at: new Date(now - c.mlro.hoursAgo * H).toISOString(), decision: c.mlro.decision, rationale: c.mlro.rationale } : null,
        narr: Object.assign(narrDefaults(), fixDates(c.narr)) };
      if (o.status === 'closed') o.closedAt = o.mlro ? o.mlro.at : nowIso();
      d.cases.push(o);
    });
    seed.filings.forEach(function (f) {
      d.filings.push({ id: f.id, caseId: f.caseId, kind: f.kind, ownRef: f.ownRef, filedAt: dayIso(f.filedDaysAgo), channel: f.channel, fiuRef: f.fiuRef || '', ack: f.ack, holdResolved: !!f.holdResolved, note: f.note || '' });
    });
    seed.requests.forEach(function (r) {
      var rec = dayIso(r.receivedDaysAgo);
      d.requests.push({ id: r.id, caseId: r.caseId || '', receivedAt: rec, fiuRef: r.fiuRef, subject: r.subject, dueAt: iso(addWD(parseISO(rec), 5)), dueSource: r.dueSource, respondedAt: r.respondedDaysAgo == null ? '' : dayIso(r.respondedDaysAgo), note: r.note || '' });
    });
    d.seq = { alert: seed.alerts.length, case: seed.cases.length, filing: seed.filings.length, req: seed.requests.length };
    d.demo = true;
    return d;
  }
  function nextId(kind) {
    DB.seq[kind] = (DB.seq[kind] || 0) + 1; var n = DB.seq[kind];
    if (kind === 'alert') return 'ALR-' + pad(n, 4);
    if (kind === 'case') return 'CASE-' + new Date().getFullYear() + '-' + pad(n, 4);
    if (kind === 'filing') return 'FIL-' + pad(n, 4);
    return 'REQ-' + pad(n, 4);
  }

  /* ---------- lookups ---------- */
  function alertById(id) { return DB.alerts.filter(function (a) { return a.id === id; })[0]; }
  function caseById(id) { return DB.cases.filter(function (c) { return c.id === id; })[0]; }
  function filingsFor(cid) { return DB.filings.filter(function (f) { return f.caseId === cid; }); }
  function typo(id) { return TYPO.typologies.filter(function (t) { return t.id === id; })[0] || { id: id, label: id || 'Other', redFlags: [], academy_cases: [] }; }
  function flagsFor(c) {
    var out = [], seen = {};
    function add(text, source) { if (!seen[text]) { seen[text] = 1; out.push({ text: text, source: source }); } }
    (typo(c.typology).redFlags || []).forEach(function (f) { add(f.text, f.source); });
    (TYPO.common || []).forEach(function (t) { add(t, 'common'); });
    (c.customFlags || []).forEach(function (t) { add(t, 'custom'); });
    return out;
  }
  function flagProgress(c) {
    var fl = flagsFor(c), yes = 0, done = 0;
    fl.forEach(function (f) { var s = c.flagState[f.text]; if (s) done++; if (s === 'yes') yes++; });
    return { total: fl.length, assessed: done, present: yes };
  }
  function presentFlags(c) { return flagsFor(c).filter(function (f) { return c.flagState[f.text] === 'yes'; }).map(function (f) { return f.text; }); }
  function alertDue(a) { return addWD(new Date(a.createdAt), DB.settings.sla[a.priority] || 3); }
  function isOpenAlert(a) { return a.status === 'new' || a.status === 'in_review'; }
  function caseLog(c, type, text, by) { c.timeline.push({ at: nowIso(), by: by || DB.settings.me, type: type, text: text }); }
  function alertLog(a, text, by) { a.log = a.log || []; a.log.push({ at: nowIso(), by: by || DB.settings.me, text: text }); }
  function narrCtx(c) { return { ref: c.id, todayIso: iso(new Date()), flagsPresent: presentFlags(c), evidence: c.evidence }; }
  function narrText(c) { return c.narr.edited ? (c.narr.draft || '') : NARR.build(c.narr, narrCtx(c)); }
  function srcLabel(s) { return { casebook: 'Academy casebook', default: 'Default', common: 'Common', custom: 'Added by you' }[s] || s; }
  function lawLink(art, label) { return '<a href="law.html?celex=' + CELEX + '&amp;art=' + esc(art) + '">' + esc(label) + '</a>'; }

  /* ---------- law quotes ---------- */
  function norm(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }
  function buildQuotes() {
    QUOTES = {};
    if (!LAW || !LAW.articles) return;
    Object.keys(QSPEC).forEach(function (k) {
      var sp = QSPEC[k], art = LAW.articles.filter(function (a) { return String(a.id) === sp.art; })[0];
      if (!art) return;
      var t = norm(art.text), i = t.indexOf(sp.from); if (i < 0) return;
      var j = t.indexOf(sp.to, i); if (j < 0) return;
      QUOTES[k] = t.slice(i, j + sp.to.length);
    });
  }
  function lawBlock(k) {
    var sp = QSPEC[k], q = QUOTES[k];
    if (!q) return '<p class="hint">The text of AMLR ' + esc(sp.ref) + ' could not be loaded. ' + lawLink(sp.art, 'Open it in the law reader') + '.</p>';
    return '<blockquote class="law">“' + esc(q) + '”<cite>Regulation (EU) 2024/1624 (AMLR), ' + esc(sp.ref) + '. ' + lawLink(sp.art, 'Open in the law reader') + '. <span class="vf">Checked against the parsed law text.</span></cite></blockquote>';
  }
  function tipCallout() {
    return '<div class="callout" role="note"><b class="k">Tipping-off: do not inform the customer.</b> Do not tell the customer or anyone outside the permitted channels that this case exists, that a report has been or will be made, or that the activity is being assessed. Check with the MLRO before any customer contact.' + lawBlock('tipping') + '</div>';
  }

  /* ---------- CSV ---------- */
  function csvCell(x) { var s = String(x == null ? '' : x); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; }
  function download(name, text, mime) {
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: mime || 'text/csv' })); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function toCSV(rows) { return rows.map(function (r) { return r.map(csvCell).join(','); }).join('\r\n'); }
  function registerCSV() {
    var rows = [['Case ref', 'Title', 'Typology', 'Priority', 'Status', 'Opened', 'Assignee', 'Suspicion formed', 'Subjects', 'Linked alerts', 'Red flags present', 'Red flags assessed', 'Red flags total', 'Evidence items', 'Narrative complete %', 'Analyst recommendation', 'Analyst signed by', 'Analyst signed at', 'MLRO decision', 'MLRO signed by', 'MLRO decided at', 'Filing ref', 'Date filed', 'FIU acknowledgement date', 'FIU acknowledgement ref']];
    DB.cases.forEach(function (c) {
      var fp = flagProgress(c), f = filingsFor(c.id)[0] || {}, comp = NARR.completeness(c.narr, narrCtx(c));
      rows.push([c.id, c.title, typo(c.typology).label, c.priority, STATUS[c.status], fmtD(c.openedAt), c.assignee, c.suspicionDate, c.subjects.map(function (s) { return s.name; }).join('; '), c.alertIds.join('; '), fp.present, fp.assessed, fp.total, c.evidence.length, comp.pct,
        c.analyst ? DECISION[c.analyst.rec] : '', c.analyst ? c.analyst.name : '', c.analyst ? c.analyst.at : '', c.mlro ? DECISION[c.mlro.decision] : '', c.mlro ? c.mlro.name : '', c.mlro ? c.mlro.at : '',
        f.ownRef || '', f.filedAt || '', f.ack ? f.ack.at : '', f.ack ? f.ack.ref : '']);
    });
    return toCSV(rows);
  }
  function alertsCSV() {
    var rows = [['Alert ref', 'Title', 'Typology', 'Priority', 'Status', 'Raised', 'Triage due', 'Assignee', 'Rule', 'Amount', 'Case', 'Close reason']];
    DB.alerts.forEach(function (a) { rows.push([a.id, a.title, typo(a.typology).label, a.priority, ASTATUS[a.status], a.createdAt, isOpenAlert(a) ? alertDue(a).toISOString() : '', a.assignee, a.rule, a.amount, a.caseId || '', a.closeReason || '']); });
    return toCSV(rows);
  }
  function filingsCSV() {
    var rows = [['Filing id', 'Own reference', 'Case', 'Type', 'Date filed', 'Channel', 'FIU reference', 'Acknowledged on', 'Acknowledgement ref', 'Note']];
    DB.filings.forEach(function (f) { rows.push([f.id, f.ownRef, f.caseId, f.kind, f.filedAt, f.channel, f.fiuRef, f.ack ? f.ack.at : '', f.ack ? f.ack.ref : '', f.note]); });
    rows.push([]); rows.push(['FIU request id', 'FIU reference', 'Case', 'Subject', 'Received', 'Due', 'Deadline basis', 'Responded', 'Note']);
    DB.requests.forEach(function (r) { rows.push([r.id, r.fiuRef, r.caseId, r.subject, r.receivedAt, r.dueAt, r.dueSource === 'fiu' ? 'Set by the FIU' : 'Default 5 working days (AMLR Art. 69(1))', r.respondedAt, r.note]); });
    return toCSV(rows);
  }

  /* ---------- clocks ---------- */
  function clocks() {
    var out = [], s = DB.settings;
    DB.alerts.forEach(function (a) {
      if (!isOpenAlert(a)) return;
      out.push({ kind: 'Alert triage', basis: 'internal', title: a.title, ref: a.id, due: alertDue(a), note: 'Your triage target: ' + s.sla[a.priority] + ' working day' + (s.sla[a.priority] === 1 ? '' : 's') + ' for ' + a.priority + ' priority.', go: { tab: 'alerts', alert: a.id } });
    });
    DB.cases.forEach(function (c) {
      if (c.status === 'open' || c.status === 'review' || c.status === 'mlro') out.push({ kind: 'Case decision', basis: 'internal', title: c.title, ref: c.id, due: addWD(new Date(c.openedAt), s.caseDays), note: 'Your target to reach an MLRO decision: ' + s.caseDays + ' working days from opening.', go: { tab: 'cases', case: c.id, csub: 'signoff' } });
      if (c.status === 'filing') {
        var at = c.mlro ? new Date(c.mlro.at) : new Date(c.openedAt);
        out.push({ kind: 'Report to be filed', basis: 'internal', title: c.title, ref: c.id, due: addWD(at, s.fileDays), note: 'Art. 69(1)(a) asks for reporting "promptly" and gives no fixed number of days. Your internal target: ' + s.fileDays + ' working days after the MLRO decision.', go: { tab: 'cases', case: c.id, csub: 'signoff' } });
      }
    });
    DB.filings.forEach(function (f) {
      var c = caseById(f.caseId), fd = parseISO(f.filedAt); if (!fd) return;
      if (!f.ack) out.push({ kind: 'FIU acknowledgement', basis: 'internal', title: 'Acknowledgement for ' + (f.ownRef || f.id), ref: f.caseId, due: dayEnd(iso(addWD(fd, s.ackDays))), note: 'Filed ' + fmtD(f.filedAt) + '. Your target to chase or log the FIU acknowledgement: ' + s.ackDays + ' working days.', go: { tab: 'filings', filing: f.id } });
      if (c && c.holdTransaction && !f.holdResolved) out.push({ kind: 'Held transaction', basis: 'statutory', info: true, title: 'Held transaction on ' + (c.title), ref: f.caseId, due: dayEnd(iso(addWD(fd, 3))), note: 'Art. 71(1): a held transaction may be carried out after assessing the risks of proceeding if no contrary instruction came from the FIU within 3 working days of submitting the report. Record the outcome on the filing.', go: { tab: 'filings', filing: f.id } });
    });
    DB.requests.forEach(function (r) {
      if (r.respondedAt) return;
      out.push({ kind: 'FIU request', basis: 'statutory', title: r.subject, ref: r.fiuRef || r.id, due: dayEnd(r.dueAt), note: r.dueSource === 'fiu' ? 'Deadline set by the FIU on this request.' : 'Default: 5 working days from receipt (AMLR Art. 69(1)). The FIU may shorten or extend it: edit the request if it did.', go: { tab: 'filings', req: r.id } });
    });
    out.forEach(function (x) { x.r = remain(x.due, x.basis === 'statutory' ? 48 : 24); });
    out.sort(function (a, b) { return a.due - b.due; });
    return out;
  }
  function overdueCount() { return clocks().filter(function (x) { return x.r.state === 'overdue' && !x.info; }).length; }

  /* ---------- dialogs ---------- */
  var dlg;
  function dlgOpen(title, body, o) {
    o = o || {};
    UI.opener = document.activeElement;
    dlg.className = o.wide ? 'wide' : '';
    dlg.setAttribute('aria-labelledby', 'dlgTitle');
    dlg.innerHTML = '<form class="dform" novalidate><h2 id="dlgTitle">' + esc(title) + '</h2><div>' + body + '</div><p class="derr" id="derr" role="alert"></p>' +
      '<div class="dactions"><button type="button" class="btn" data-act="dlg-cancel">' + esc(o.cancel || 'Cancel') + '</button>' + (o.submit === null ? '' : '<button type="submit" class="btn pri">' + esc(o.submit || 'Save') + '</button>') + '</div></form>';
    var form = dlg.querySelector('form');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var r = o.onSubmit ? o.onSubmit(form) : null;
      if (r && r.error) { $('derr').textContent = r.error; var f = form.querySelector('[data-err="' + (r.field || '') + '"]'); if (f) f.focus(); return; }
      dlg.close();
    });
    if (!dlg.open) dlg.showModal();
    var first = dlg.querySelector('input:not([type=hidden]),select,textarea'); if (first) first.focus(); else { var b = dlg.querySelector('button'); if (b) b.focus(); }
  }
  function fld(label, id, control, help, cls) { return '<div class="field' + (cls ? ' ' + cls : '') + '"><label for="' + id + '">' + esc(label) + '</label>' + control + (help ? '<div class="help" id="' + id + '-h">' + esc(help) + '</div>' : '') + '</div>'; }
  function opt(v, label, sel) { return '<option value="' + esc(v) + '"' + (sel ? ' selected' : '') + '>' + esc(label) + '</option>'; }
  function selectHtml(id, opts, cur, extra) { return '<select class="sel" id="' + id + '" name="' + id + '"' + (extra || '') + '>' + opts.map(function (o) { return opt(o[0], o[1], o[0] === cur); }).join('') + '</select>'; }
  function val(id) { var e = $(id); return e ? (e.type === 'checkbox' ? e.checked : String(e.value).trim()) : ''; }
  function confirmDlg(title, msg, label, fn) {
    dlgOpen(title, '<p>' + esc(msg) + '</p>', { submit: label, onSubmit: function () { fn(); } });
  }
  function teamOpts(blank) { var o = blank ? [['', 'Unassigned']] : []; DB.settings.team.forEach(function (n) { o.push([n, n]); }); return o; }
  function typoOpts() { return TYPO.typologies.map(function (t) { return [t.id, t.label]; }); }

  /* ---------- KPIs and tabs ---------- */
  function renderKpis() {
    var oa = DB.alerts.filter(isOpenAlert), late = oa.filter(function (a) { return remain(alertDue(a)).state === 'overdue'; }).length;
    var oc = DB.cases.filter(function (c) { return c.status !== 'closed'; }), am = DB.cases.filter(function (c) { return c.status === 'mlro'; }).length;
    var af = DB.cases.filter(function (c) { return c.status === 'filing'; }).length, un = DB.filings.filter(function (f) { return !f.ack; }).length;
    var od = overdueCount();
    $('kpis').innerHTML =
      '<div class="kpi' + (late ? ' warn' : '') + '"><div class="n mono">' + oa.length + '</div><div class="l">Open alerts</div><div class="s">' + late + ' past triage target</div></div>' +
      '<div class="kpi"><div class="n mono">' + oc.length + '</div><div class="l">Open cases</div><div class="s">' + am + ' awaiting MLRO decision</div></div>' +
      '<div class="kpi"><div class="n mono">' + af + '</div><div class="l">Awaiting filing</div><div class="s">' + un + ' filing' + (un === 1 ? '' : 's') + ' not yet acknowledged</div></div>' +
      '<div class="kpi' + (od ? ' warn' : '') + '"><div class="n mono">' + od + '</div><div class="l">Overdue clocks</div><div class="s">across alerts, cases, filings and FIU requests</div></div>';
  }
  function renderTabs() {
    var tabs = [['alerts', 'Alert queue', DB.alerts.filter(isOpenAlert).length], ['cases', 'Cases', DB.cases.filter(function (c) { return c.status !== 'closed'; }).length], ['filings', 'Filings and clocks', overdueCount()]];
    $('mainTabs').innerHTML = tabs.map(function (t) {
      return '<button type="button" role="tab" id="tab-' + t[0] + '" data-act="tab" data-t="' + t[0] + '" aria-selected="' + (UI.tab === t[0]) + '" aria-controls="panel" tabindex="' + (UI.tab === t[0] ? 0 : -1) + '">' + t[1] + '<span class="cnt">' + t[2] + '</span></button>';
    }).join('');
    $('panel').setAttribute('aria-labelledby', 'tab-' + UI.tab);
  }

  /* ---------- alert queue ---------- */
  function filteredAlerts() {
    var f = UI.f, q = f.q.toLowerCase(), prank = { high: 0, medium: 1, low: 2 };
    var l = DB.alerts.filter(function (a) {
      if (f.status === 'open' && !isOpenAlert(a)) return false;
      if (f.status === 'closed' && a.status !== 'closed') return false;
      if (f.status === 'escalated' && a.status !== 'escalated') return false;
      if (f.priority && a.priority !== f.priority) return false;
      if (f.typology && a.typology !== f.typology) return false;
      if (f.assignee === '__none' ? a.assignee : (f.assignee && a.assignee !== f.assignee)) return false;
      if (q && (a.id + ' ' + a.title + ' ' + a.customer + ' ' + a.rule + ' ' + a.summary).toLowerCase().indexOf(q) === -1) return false;
      return true;
    });
    l.sort(function (a, b) {
      if (f.sort === 'priority') return (prank[a.priority] - prank[b.priority]) || (alertDue(a) - alertDue(b));
      if (f.sort === 'age') return new Date(a.createdAt) - new Date(b.createdAt);
      return alertDue(a) - alertDue(b);
    });
    return l;
  }
  function prioChip(p) { return '<span class="chip ' + (p === 'high' ? 'crit' : (p === 'medium' ? 'imp' : '')) + '">' + esc(p) + '</span>'; }
  function alertItem(a) {
    var right = isOpenAlert(a) ? clockChip(alertDue(a)) : '<span class="chip">' + (a.status === 'closed' ? 'Closed' : 'Case') + '</span>';
    return '<button type="button" class="item" data-act="alert" data-alert="' + esc(a.id) + '" aria-current="' + (UI.alert === a.id) + '" tabindex="' + (UI.alert === a.id ? 0 : -1) + '">' +
      '<span><span class="a">' + esc(a.id) + ' · ' + esc(typo(a.typology).label) + '</span><span class="t">' + esc(a.title) + '</span>' +
      '<span class="m">' + prioChip(a.priority) + '<span>' + esc(a.assignee || 'Unassigned') + '</span></span></span><span class="r">' + right + '</span></button>';
  }
  function alertItemsHtml() {
    var l = filteredAlerts();
    if (!l.length) return '<div class="empty">' + (DB.alerts.length ? 'No alerts match these filters.' : 'No alerts yet. Add one, import a CSV, or reset the demo data from Data and settings.') + '</div>';
    var h = l.map(alertItem).join('');
    return h;
  }
  function alertsView() {
    var f = UI.f, list = filteredAlerts();
    if (!UI.alert || !alertById(UI.alert)) UI.alert = (window.innerWidth > 980 && list[0]) ? list[0].id : null;
    var h = '<div class="grid' + (UI.mdet ? ' m-detail' : '') + '"><aside class="pane list" aria-label="Alert queue"><div class="list-top">' +
      '<input class="in" id="aq" type="search" placeholder="Search alerts" aria-label="Search alerts" value="' + esc(f.q) + '" autocomplete="off">' +
      '<div class="frow"><select class="sel" id="af-status" data-af="status" aria-label="Status">' + [['open', 'Open'], ['escalated', 'Escalated'], ['closed', 'Closed'], ['all', 'All statuses']].map(function (o) { return opt(o[0], o[1], f.status === o[0]); }).join('') + '</select>' +
      '<select class="sel" id="af-priority" data-af="priority" aria-label="Priority">' + opt('', 'Any priority', !f.priority) + PRIO.map(function (p) { return opt(p, p[0].toUpperCase() + p.slice(1), f.priority === p); }).join('') + '</select></div>' +
      '<div class="frow"><select class="sel" id="af-typology" data-af="typology" aria-label="Typology">' + opt('', 'Any typology', !f.typology) + typoOpts().map(function (o) { return opt(o[0], o[1], f.typology === o[0]); }).join('') + '</select>' +
      '<select class="sel" id="af-assignee" data-af="assignee" aria-label="Assignee">' + opt('', 'Anyone', !f.assignee) + opt('__none', 'Unassigned', f.assignee === '__none') + DB.settings.team.map(function (n) { return opt(n, n, f.assignee === n); }).join('') + '</select></div>' +
      '<div class="frow"><select class="sel" id="af-sort" data-af="sort" aria-label="Sort by">' + [['sla', 'Sort: due soonest'], ['priority', 'Sort: priority'], ['age', 'Sort: oldest first']].map(function (o) { return opt(o[0], o[1], f.sort === o[0]); }).join('') + '</select>' +
      '<button class="btn sm" type="button" data-act="import-alerts">Import CSV</button></div>' +
      '<p class="hint">With an alert focused: <kbd>j</kbd>/<kbd>k</kbd> or arrows move, <kbd>e</kbd> escalate, <kbd>c</kbd> close as false positive, <kbd>a</kbd> assign to me.</p>' +
      '</div><div class="items" id="aitems">' + alertItemsHtml() + '</div></aside>' +
      '<section class="pane detail" id="adetail" aria-label="Alert detail">' + alertDetail(alertById(UI.alert)) + '</section></div>';
    return h;
  }
  function alertDetail(a) {
    if (!a) return '<button class="btn sm back" type="button" data-act="back">Back to the queue</button><div class="empty">Select an alert to review it.</div>';
    var due = alertDue(a), c = a.caseId ? caseById(a.caseId) : null;
    var h = '<button class="btn sm back" type="button" data-act="back">Back to the queue</button>' +
      '<div class="d-top"><span class="mono" style="font-weight:700;color:var(--text)">' + esc(a.id) + '</span><span class="chip">' + esc(typo(a.typology).label) + '</span>' + prioChip(a.priority) +
      '<span class="chip">' + esc(ASTATUS[a.status]) + '</span>' + (isOpenAlert(a) ? clockChip(due) : '') + (a.source === 'demo' ? '<span class="chip">Demo alert</span>' : '') + '</div>' +
      '<h2>' + esc(a.title) + '</h2><p class="d-sub">' + esc(a.rule) + ' · raised ' + esc(fmtDT(a.createdAt)) + '</p>' +
      '<p class="d-text">' + esc(a.summary) + '</p>' +
      '<div class="blk"><h3>Customer</h3><p>' + esc(a.customer) + '</p>' +
      (Object.keys(a.facts || {}).length ? '<dl class="facts" style="margin-top:10px">' + Object.keys(a.facts).map(function (k) { return '<div><dt>' + esc(k) + '</dt><dd>' + esc(a.facts[k]) + '</dd></div>'; }).join('') + '</dl>' : '') + '</div>';
    if ((a.txs || []).length) h += '<div class="blk"><h3>Transactions in the alert <span class="count">' + a.txs.length + '</span></h3><div class="txs">' + a.txs.map(function (t) { return '<div class="tx"><span class="d">' + esc(t[0]) + '</span><span>' + esc(t[1]) + ' · ' + esc(t[3]) + '</span><span class="amt">' + esc(t[2]) + '</span></div>'; }).join('') + '</div></div>';
    if (a.onFile) h += '<div class="blk"><h3>What is on file</h3><p>' + esc(a.onFile) + '</p></div>';
    var al = a.assignee;
    h += '<div class="blk"><h3>Triage</h3>';
    if (isOpenAlert(a)) {
      h += '<div class="row-actions" style="margin-top:0"><button class="btn pri" type="button" data-act="alert-esc" data-id="' + esc(a.id) + '">Escalate to case <kbd>e</kbd></button><button class="btn" type="button" data-act="alert-close" data-id="' + esc(a.id) + '">Close as false positive <kbd>c</kbd></button>' +
        (a.status === 'new' ? '<button class="btn" type="button" data-act="alert-review" data-id="' + esc(a.id) + '">Start review</button>' : '') +
        (al !== DB.settings.me ? '<button class="btn" type="button" data-act="alert-me" data-id="' + esc(a.id) + '">Assign to me <kbd>a</kbd></button>' : '') + '</div>' +
        '<div class="fields" style="margin-top:12px">' + fld('Assignee', 'a-assignee', selectHtml('a-assignee', teamOpts(true), al, ' data-aa="assignee"')) + fld('Priority', 'a-priority', selectHtml('a-priority', PRIO.map(function (p) { return [p, p[0].toUpperCase() + p.slice(1)]; }), a.priority, ' data-aa="priority"'), 'Changing priority changes the triage target.') + '</div>';
    } else if (a.status === 'closed') {
      h += '<div class="callout info"><b class="k">Closed as false positive</b> ' + esc(fmtDT(a.closedAt)) + '. Reason: ' + esc(a.closeReason) + (a.closeNote ? '. ' + esc(a.closeNote) : '') + '</div><div class="row-actions"><button class="btn" type="button" data-act="alert-reopen" data-id="' + esc(a.id) + '">Reopen alert</button></div>';
    } else {
      h += '<p>Escalated to ' + (c ? '<button class="btn link sm" type="button" data-act="goto-case" data-id="' + esc(c.id) + '">' + esc(c.id) + '</button> (' + esc(STATUS[c.status]) + ')' : esc(a.caseId || 'a case')) + '.</p>';
    }
    h += '</div>';
    if (a.casebookId) h += '<div class="blk"><h3>Practise this pattern</h3><p class="hint">Based on Academy case <span class="mono">' + esc(a.casebookId) + '</span> (fictional). Open the <a href="academy.html">Academy</a> to rehearse the triage decision.</p></div>';
    h += '<div class="blk"><h3>Alert history</h3><ul class="tl">' + (a.log || []).slice().reverse().map(function (e) { return '<li><span class="w">' + esc(fmtDT(e.at)) + '</span><span class="tx2"><span class="by">' + esc(e.by) + '</span> ' + esc(e.text) + '</span></li>'; }).join('') + '</ul></div>';
    return h;
  }
  function selectAlert(id, focus, scroll) {
    UI.alert = id;
    Array.prototype.forEach.call(document.querySelectorAll('#aitems .item'), function (b) { var on = b.dataset.alert === id; b.setAttribute('aria-current', on); b.tabIndex = on ? 0 : -1; });
    $('adetail').innerHTML = alertDetail(alertById(id));
    if (focus) { var b2 = document.querySelector('#aitems .item[data-alert="' + id + '"]'); if (b2) b2.focus(); }
    if (scroll && window.innerWidth <= 980) { UI.mdet = true; document.querySelector('#panel .grid').classList.add('m-detail'); window.scrollTo(0, $('mainTabs').offsetTop); }
    syncUrl();
  }
  function afterAlertChange(nextId) {
    var list = filteredAlerts();
    if (nextId === undefined) nextId = UI.alert;
    if (nextId && !list.some(function (a) { return a.id === nextId; })) nextId = null;
    UI.alert = nextId || (window.innerWidth > 980 && list[0] ? list[0].id : null);
    if (!UI.alert) UI.mdet = false;
    renderKpis(); renderTabs();
    $('aitems').innerHTML = alertItemsHtml();
    $('adetail').innerHTML = alertDetail(alertById(UI.alert));
    document.querySelector('#panel .grid').classList.toggle('m-detail', UI.mdet);
    if (UI.alert && window.innerWidth > 980) {
      var sel = '#aitems .item[data-alert="' + UI.alert + '"]';
      if (dlg.open) UI.pendingFocus = sel; else { var b = document.querySelector(sel); if (b) b.focus(); }
    }
    syncUrl();
  }
  function neighbour(id) {
    var l = filteredAlerts(), i = l.map(function (a) { return a.id; }).indexOf(id);
    return l[i + 1] ? l[i + 1].id : (l[i - 1] ? l[i - 1].id : null);
  }
  function dlgCloseAlert(id) {
    var a = alertById(id); if (!a) return;
    dlgOpen('Close ' + a.id + ' as a false positive',
      '<p class="hint" style="margin-bottom:10px">' + esc(a.title) + '</p><div class="fields">' +
      fld('Reason', 'ca-reason', selectHtml('ca-reason', CLOSE_REASONS.map(function (r) { return [r, r]; }), CLOSE_REASONS[0]), '', 'full') +
      fld('Note', 'ca-note', '<textarea class="in" id="ca-note" rows="3" data-err="note"></textarea>', 'Say what you checked. This is the record an auditor will read. Required for "Other".', 'full') + '</div>',
      { submit: 'Close alert', onSubmit: function () {
        var r = val('ca-reason'), n = val('ca-note');
        if (/^Other/.test(r) && !n) return { error: 'Explain the reason in the note.', field: 'note' };
        var nx = neighbour(id);
        a.status = 'closed'; a.closeReason = r; a.closeNote = n; a.closedAt = nowIso(); alertLog(a, 'Closed as false positive: ' + r + (n ? '. ' + n : ''));
        save(); afterAlertChange(nx); toast(a.id + ' closed as false positive');
      } });
  }
  function dlgEscalate(id) {
    var a = alertById(id); if (!a) return;
    var open = DB.cases.filter(function (c) { return c.status !== 'closed' && c.status !== 'filed'; });
    dlgOpen('Escalate ' + a.id + ' to a case',
      '<p class="hint" style="margin-bottom:10px">' + esc(a.title) + '</p><div class="fields">' +
      fld('Case', 'ce-case', selectHtml('ce-case', [['__new', 'Open a new case']].concat(open.map(function (c) { return [c.id, c.id + ': ' + c.title]; })), '__new'), 'Link to an existing open case if this alert belongs to the same activity.', 'full') +
      fld('Case title', 'ce-title', '<input class="in" id="ce-title" value="' + esc(a.title) + '" data-err="title">', '', 'full') +
      fld('Priority', 'ce-prio', selectHtml('ce-prio', PRIO.map(function (p) { return [p, p[0].toUpperCase() + p.slice(1)]; }), a.priority)) +
      fld('Assignee', 'ce-asg', selectHtml('ce-asg', teamOpts(true), a.assignee || DB.settings.me)) + '</div>',
      { submit: 'Escalate', onSubmit: function () {
        var target = val('ce-case'), nx = neighbour(id), c;
        if (target === '__new') {
          if (!val('ce-title')) return { error: 'Give the case a title.', field: 'title' };
          c = createCase(a, val('ce-title'), val('ce-prio'), val('ce-asg'));
        } else {
          c = caseById(target); c.alertIds.push(a.id); caseLog(c, 'system', 'Alert ' + a.id + ' linked to this case.');
        }
        a.status = 'escalated'; a.caseId = c.id; alertLog(a, 'Escalated to ' + c.id);
        save(); afterAlertChange(nx); toast(a.id + ' escalated to ' + c.id);
      } });
  }
  function createCase(a, title, prio, asg) {
    var id = nextId('case'), parts = String(a.customer || '').split('·').map(function (s) { return s.trim(); });
    var c = { id: id, title: title, typology: a.typology, priority: prio, status: 'open', openedAt: nowIso(), assignee: asg, suspicionDate: iso(new Date()), holdTransaction: false, alertIds: [a.id],
      subjects: [{ name: parts[1] || parts[0] || 'Customer', role: 'Customer', ref: '' }], flagState: {}, customFlags: [], mitigation: '', timeline: [], evidence: [], analyst: null, mlro: null, narr: narrDefaults() };
    var n = c.narr; n.entityName = DB.settings.firm; n.officerName = DB.settings.mlro; n.subjectName = c.subjects[0].name; n.relationship = parts[0] ? parts[0] + (parts[2] ? ', ' + parts[2] : '') + (parts[3] ? ', ' + parts[3] : '') : '';
    n.activitySummary = a.summary || ''; n.totalAmount = (String(a.amount || '').match(/[\d][\d,.]*/) || [''])[0]; n.jurisdictions = (a.facts && a.facts.Jurisdictions) || ''; n.expectedActivity = (a.facts && a.facts['Expected activity']) || '';
    n.suspicionFormedOn = c.suspicionDate; n.detectedOn = iso(new Date(a.createdAt));
    caseLog(c, 'system', 'Case opened from alert ' + a.id + '.');
    DB.cases.push(c); return c;
  }
  function dlgNewAlert() {
    dlgOpen('New alert', '<p class="hint" style="margin-bottom:10px">Use references, never real names or account numbers.</p><div class="fields">' +
      fld('Title', 'na-title', '<input class="in" id="na-title" data-err="title">', '', 'full') +
      fld('Typology', 'na-typ', selectHtml('na-typ', typoOpts(), 'other')) + fld('Priority', 'na-prio', selectHtml('na-prio', PRIO.map(function (p) { return [p, p[0].toUpperCase() + p.slice(1)]; }), 'medium')) +
      fld('Customer (reference)', 'na-cust', '<input class="in" id="na-cust" placeholder="Retail · CUST-0001 · customer since 2021 · standard risk">', '', 'full') +
      fld('Amount', 'na-amt', '<input class="in" id="na-amt" placeholder="€12,000 across 3 payments">') + fld('Rule or source', 'na-rule', '<input class="in" id="na-rule" placeholder="Manual referral">') +
      fld('What triggered it', 'na-sum', '<textarea class="in" id="na-sum" rows="3"></textarea>', '', 'full') + '</div>',
      { submit: 'Add alert', onSubmit: function () {
        if (!val('na-title')) return { error: 'Give the alert a title.', field: 'title' };
        var a = { id: nextId('alert'), title: val('na-title'), typology: val('na-typ'), priority: val('na-prio'), createdAt: nowIso(), assignee: '', status: 'new', rule: val('na-rule') || 'Manual entry', customer: val('na-cust') || 'Not stated', summary: val('na-sum'), amount: val('na-amt'), facts: {}, txs: [], onFile: '', casebookId: '', source: 'manual', log: [] };
        alertLog(a, 'Alert added manually.'); DB.alerts.push(a); UI.tab = 'alerts'; UI.f.status = 'open'; UI.alert = a.id; save(); render(); toast(a.id + ' added');
      } });
  }
  function parseCSV(text) {
    var rows = [], row = [], cur = '', q = false, i, ch;
    for (i = 0; i < text.length; i++) {
      ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
      else if (ch === '"') q = true;
      else if (ch === ',') { row.push(cur); cur = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cur); cur = ''; if (row.some(function (x) { return x !== ''; })) rows.push(row); row = []; }
      else cur += ch;
    }
    row.push(cur); if (row.some(function (x) { return x !== ''; })) rows.push(row);
    return rows;
  }
  function dlgImportAlerts() {
    dlgOpen('Import alerts from CSV',
      '<p class="hint" style="margin-bottom:10px">Columns (header row required): <span class="mono">title, typology, priority, customer, amount, summary, rule, date</span>. Only <span class="mono">title</span> is required. Typology uses the ids in the filter (for example structuring, mule, crypto). Use references, never real personal data.</p>' +
      '<div class="fields">' + fld('CSV file', 'ia-file', '<input class="in" id="ia-file" type="file" accept=".csv,text/csv" data-err="file">', '', 'full') + '</div>',
      { submit: 'Import', onSubmit: function () {
        var f = $('ia-file').files[0]; if (!f) return { error: 'Choose a CSV file first.', field: 'file' };
        var rd = new FileReader();
        rd.onload = function () {
          var rows = parseCSV(String(rd.result)), hd = (rows.shift() || []).map(function (h) { return h.trim().toLowerCase(); }), n = 0, ids = TYPO.typologies.map(function (t) { return t.id; });
          if (hd.indexOf('title') === -1) { toast('No "title" column found'); return; }
          rows.forEach(function (r) {
            var o = {}; hd.forEach(function (h, i) { o[h] = (r[i] || '').trim(); });
            if (!o.title) return;
            var d = o.date ? new Date(o.date) : new Date(); if (isNaN(d)) d = new Date();
            var a = { id: nextId('alert'), title: o.title, typology: ids.indexOf(o.typology) !== -1 ? o.typology : 'other', priority: PRIO.indexOf((o.priority || '').toLowerCase()) !== -1 ? o.priority.toLowerCase() : 'medium', createdAt: d.toISOString(), assignee: '', status: 'new', rule: o.rule || 'Imported', customer: o.customer || 'Not stated', summary: o.summary || '', amount: o.amount || '', facts: {}, txs: [], onFile: '', casebookId: '', source: 'import', log: [] };
            alertLog(a, 'Imported from CSV.'); DB.alerts.push(a); n++;
          });
          save(); render(); toast(n + ' alert' + (n === 1 ? '' : 's') + ' imported');
        };
        rd.readAsText(f);
      } });
  }

  /* ---------- cases list ---------- */
  var CFILTERS = [['active', 'Active'], ['mlro', 'Awaiting MLRO'], ['filing', 'Awaiting filing'], ['filed', 'Filed'], ['closed', 'Closed'], ['all', 'All']];
  function filteredCases() {
    var f = UI.cf, q = f.q.toLowerCase(), rank = { open: 0, review: 1, mlro: 2, filing: 3, filed: 4, closed: 5 };
    return DB.cases.filter(function (c) {
      if (f.status === 'active' ? c.status === 'closed' : (f.status !== 'all' && c.status !== f.status)) return false;
      if (q && (c.id + ' ' + c.title + ' ' + c.subjects.map(function (s) { return s.name; }).join(' ')).toLowerCase().indexOf(q) === -1) return false;
      return true;
    }).sort(function (a, b) { return (rank[a.status] - rank[b.status]) || (new Date(a.openedAt) - new Date(b.openedAt)); });
  }
  function caseItem(c) {
    return '<button type="button" class="item" data-act="case" data-case="' + esc(c.id) + '" aria-current="' + (UI.case === c.id) + '" tabindex="' + (UI.case === c.id ? 0 : -1) + '"><span><span class="a">' + esc(c.id) + ' · ' + esc(typo(c.typology).label) + '</span><span class="t">' + esc(c.title) + '</span>' +
      '<span class="m">' + prioChip(c.priority) + '<span>' + esc(c.assignee || 'Unassigned') + '</span><span>opened ' + esc(fmtD(c.openedAt)) + '</span></span></span><span class="r"><span class="chip' + (c.status === 'filing' || c.status === 'mlro' ? ' imp' : (c.status === 'filed' ? ' ok' : '')) + '">' + esc(STATUS[c.status]) + '</span></span></button>';
  }
  function caseItemsHtml() {
    var l = filteredCases();
    return l.length ? l.map(caseItem).join('') : '<div class="empty">' + (DB.cases.length ? 'No cases match.' : 'No cases yet. Escalate an alert from the queue to open one.') + '</div>';
  }
  function casesView() {
    var list = filteredCases();
    if (!UI.case || !caseById(UI.case)) UI.case = (window.innerWidth > 980 && list[0]) ? list[0].id : null;
    return '<div class="grid' + (UI.mdet ? ' m-detail' : '') + '"><aside class="pane list" aria-label="Case register"><div class="list-top">' +
      '<input class="in" id="cq" type="search" placeholder="Search cases" aria-label="Search cases" value="' + esc(UI.cf.q) + '" autocomplete="off">' +
      '<div class="chips" role="group" aria-label="Filter cases">' + CFILTERS.map(function (p) { return '<button class="chip" type="button" data-act="cfilter" data-s="' + p[0] + '" aria-pressed="' + (UI.cf.status === p[0]) + '">' + p[1] + '</button>'; }).join('') + '</div>' +
      '</div><div class="items" id="citems">' + caseItemsHtml() + '</div></aside>' +
      '<section class="pane detail" id="cdetail" aria-label="Case file">' + caseDetail(caseById(UI.case)) + '</section></div>';
  }
  function selectCase(id, scroll) {
    UI.case = id; UI.csub = UI.csub || 'summary';
    Array.prototype.forEach.call(document.querySelectorAll('#citems .item'), function (b) { var on = b.dataset['case'] === id; b.setAttribute('aria-current', on); b.tabIndex = on ? 0 : -1; });
    renderCaseDetail();
    if (scroll && window.innerWidth <= 980) { UI.mdet = true; document.querySelector('#panel .grid').classList.add('m-detail'); window.scrollTo(0, $('mainTabs').offsetTop); }
    syncUrl();
  }
  function renderCaseDetail() {
    var el = $('cdetail'); if (!el) return;
    var c = caseById(UI.case), st = el.scrollTop;
    el.innerHTML = caseDetail(c);
  }
  function refreshCaseList() { var el = $('citems'); if (el) el.innerHTML = caseItemsHtml(); renderKpis(); renderTabs(); }

  /* ---------- case detail ---------- */
  var SUBS = [['summary', 'Summary'], ['flags', 'Red flags'], ['timeline', 'Timeline and notes'], ['evidence', 'Evidence'], ['narrative', 'STR/SAR narrative'], ['signoff', 'Sign-off and decision'], ['print', 'Case file (print)']];
  function stepperHtml(c) {
    var steps = [['Case opened', true], ['Analyst sign-off', !!c.analyst], ['MLRO decision', !!c.mlro]];
    if (!c.mlro || c.mlro.decision === 'report') steps.push(['Filed with FIU', c.status === 'filed' || (c.status === 'closed' && filingsFor(c.id).length > 0)]);
    steps.push(['Closed', c.status === 'closed']);
    var cur = -1; steps.forEach(function (s, i) { if (cur === -1 && !s[1]) cur = i; });
    return '<ol class="stepper" aria-label="Case progress">' + steps.map(function (s, i) { return '<li class="' + (s[1] ? 'done' : (i === cur ? 'cur' : '')) + '"' + (i === cur ? ' aria-current="step"' : '') + '>' + (s[1] ? '✓ ' : '') + esc(s[0]) + (s[1] ? '<span class="sr"> (done)</span>' : '') + '</li>'; }).join('') + '</ol>';
  }
  function caseDetail(c) {
    if (!c) return '<button class="btn sm back" type="button" data-act="back">Back to the register</button><div class="empty">Select a case to open its file.</div>';
    var h = '<button class="btn sm back" type="button" data-act="back">Back to the register</button>' +
      '<div class="d-top"><span class="mono" style="font-weight:700;color:var(--text)">' + esc(c.id) + '</span><span class="chip">' + esc(typo(c.typology).label) + '</span>' + prioChip(c.priority) + '<span class="chip' + (c.status === 'filed' ? ' ok' : (c.status === 'filing' || c.status === 'mlro' ? ' imp' : '')) + '">' + esc(STATUS[c.status]) + '</span></div>' +
      '<h2>' + esc(c.title) + '</h2><p class="d-sub">Opened ' + esc(fmtDT(c.openedAt)) + ' · ' + esc(c.assignee || 'Unassigned') + (c.suspicionDate ? ' · suspicion formed ' + esc(fmtD(c.suspicionDate)) : '') + '</p>' + stepperHtml(c) +
      '<div class="subtabs" role="tablist" aria-label="Case file sections">' + SUBS.map(function (s) { return '<button type="button" role="tab" id="st-' + s[0] + '" data-act="csub" data-s="' + s[0] + '" aria-selected="' + (UI.csub === s[0]) + '" tabindex="' + (UI.csub === s[0] ? 0 : -1) + '">' + s[1] + '</button>'; }).join('') + '</div>' +
      '<div role="tabpanel" aria-labelledby="st-' + UI.csub + '" id="csubpanel">';
    h += ({ summary: sumView, flags: flagsView, timeline: timelineView, evidence: evidenceView, narrative: narrativeView, signoff: signoffView, print: printView }[UI.csub] || sumView)(c);
    return h + '</div>';
  }

  function sumView(c) {
    var h = tipCallout();
    h += '<div class="blk"><h3>Case details</h3><div class="fields">' +
      fld('Title', 'c-title', '<input class="in" id="c-title" data-cf="title" value="' + esc(c.title) + '">', '', 'full') +
      fld('Typology', 'c-typ', selectHtml('c-typ', typoOpts(), c.typology, ' data-cf="typology"'), 'Sets the red-flag checklist.') +
      fld('Priority', 'c-prio', selectHtml('c-prio', PRIO.map(function (p) { return [p, p[0].toUpperCase() + p.slice(1)]; }), c.priority, ' data-cf="priority"')) +
      fld('Assignee', 'c-asg', selectHtml('c-asg', teamOpts(true), c.assignee, ' data-cf="assignee"')) +
      fld('Date suspicion formed', 'c-sus', '<input class="in" type="date" id="c-sus" data-cf="suspicionDate" value="' + esc(c.suspicionDate) + '">', 'The day the facts became a suspicion. Art. 69(1)(a) asks for reporting "promptly".') +
      '<div class="field full"><label class="chk"><input type="checkbox" data-cf="holdTransaction"' + (c.holdTransaction ? ' checked' : '') + '><span>A transaction is being held pending the report (Art. 71). This adds a hold-review clock after filing.</span></label></div></div></div>';
    h += '<div class="blk"><h3>Linked customers and entities <span class="count">' + c.subjects.length + '</span></h3>' +
      (c.subjects.length ? '<div class="card-list">' + c.subjects.map(function (s, i) { return '<div class="card"><div><div class="t">' + esc(s.name) + '</div><div class="s">' + esc(s.role) + (s.ref ? ' · ' + esc(s.ref) : '') + '</div></div><button class="btn sm" type="button" data-act="subj-rm" data-i="' + i + '" aria-label="Remove ' + esc(s.name) + '">Remove</button></div>'; }).join('') + '</div>' : '<p class="hint">No subjects yet.</p>') +
      '<div class="fields" style="margin-top:12px"><div class="field">' + '<label for="sj-name">Name or reference</label><input class="in" id="sj-name" autocomplete="off"></div><div class="field"><label for="sj-role">Role</label>' + selectHtml('sj-role', [['Customer', 'Customer'], ['Counterparty', 'Counterparty'], ['Beneficial owner', 'Beneficial owner'], ['Representative', 'Representative'], ['Other', 'Other']], 'Customer') + '</div>' +
      '<div class="field"><label for="sj-ref">Customer or entity ID</label><input class="in" id="sj-ref" autocomplete="off"></div><div class="field"><label>&nbsp;</label><button class="btn" type="button" data-act="subj-add">Add subject</button></div></div></div>';
    h += '<div class="blk"><h3>Linked alerts <span class="count">' + c.alertIds.length + '</span></h3><div class="card-list">' + c.alertIds.map(function (id) {
      var a = alertById(id); return '<div class="card"><div><div class="t">' + esc(id) + ': ' + esc(a ? a.title : '') + '</div><div class="s">' + esc(a ? a.rule + ' · ' + a.amount : '') + '</div></div>' + (a ? '<button class="btn sm" type="button" data-act="goto-alert" data-id="' + esc(id) + '">Open alert</button>' : '') + '</div>';
    }).join('') + '</div></div>';
    var ob = OB && OB.filter(function (o) { return o.id === 'AMLR-art69'; })[0];
    h += '<div class="blk"><h3>Legal basis and links</h3><div class="chips"><a class="chip" href="workspace.html?open=AMLR-art69">Obligation AMLR-art69: reporting suspicion to the FIU</a>' + ['69', '71', '73'].map(function (n) { return '<a class="chip" href="law.html?celex=' + CELEX + '&amp;art=' + n + '">AMLR Art. ' + n + '</a>'; }).join('') + '</div>' +
      (ob ? '<p class="hint" style="margin-top:8px">' + esc(ob.what) + ' Applies from ' + esc(fmtD(ob.deadline)) + '.</p>' : '') + '</div>';
    h += '<div class="row-actions">' + (c.status === 'closed' ? '<button class="btn" type="button" data-act="case-reopen">Reopen case</button>' : '') + '<button class="btn danger" type="button" data-act="case-delete">Delete case from this device</button></div>';
    return h;
  }

  function flagsView(c) {
    var fl = flagsFor(c), p = flagProgress(c), t = typo(c.typology), pct = p.total ? Math.round(100 * p.assessed / p.total) : 0;
    var h = '<div class="blk"><h3>Red-flag checklist: ' + esc(t.label) + '</h3><p class="hint">Mark each indicator as present, not present, or unknown. Indicators come from the shared Academy casebook and from illustrative defaults; configure them for your firm. ' +
      (t.academy_cases && t.academy_cases.length ? 'Related Academy cases: ' + t.academy_cases.map(function (x) { return '<span class="mono">' + esc(x) + '</span>'; }).join(', ') + '. ' : '') + 'Art. 69(5) AMLR requires AMLA to publish indicator guidelines by 10 July 2027.</p>' +
      '<div style="margin:12px 0"><div class="meter ' + (pct < 50 ? 'bad' : (pct < 100 ? 'low' : '')) + '" role="img" aria-label="' + p.assessed + ' of ' + p.total + ' indicators assessed"><i style="width:' + pct + '%"></i></div><p class="hint" style="margin-top:4px">' + p.assessed + ' of ' + p.total + ' assessed · ' + p.present + ' present</p></div>';
    fl.forEach(function (f, i) {
      var s = c.flagState[f.text] || '';
      h += '<fieldset class="flagrow"><legend class="ft" style="font-size:14px;font-weight:400;color:var(--text)">' + esc(f.text) + ' <span class="chip">' + esc(srcLabel(f.source)) + '</span></legend><div class="seg3">' +
        [['yes', 'Present'], ['no', 'Not present'], ['unk', 'Unknown']].map(function (o) { return '<label><input type="radio" name="fl' + i + '" data-fl="' + i + '" value="' + o[0] + '"' + (s === o[0] ? ' checked' : '') + '>' + o[1] + '</label>'; }).join('') + '</div></fieldset>';
    });
    h += '<div class="fields" style="margin-top:14px"><div class="field full"><label for="fl-new">Add your own indicator</label><div class="newrow" style="display:flex;gap:8px;flex-wrap:wrap"><input class="in" id="fl-new" style="flex:1;min-width:200px"><button class="btn" type="button" data-act="flag-add">Add indicator</button></div></div>' +
      fld('Mitigating factors and innocent explanations considered', 'c-mit', '<textarea class="in" id="c-mit" rows="3" data-cf="mitigation">' + esc(c.mitigation || '') + '</textarea>', 'A balanced file records what points the other way too.', 'full') + '</div></div>';
    return h;
  }

  function timelineView(c) {
    var h = '<div class="blk"><h3>Add to the timeline</h3><div class="fields">' + fld('Type', 'tl-type', selectHtml('tl-type', EVTYPES, 'note')) + fld('Note', 'tl-text', '<textarea class="in" id="tl-text" rows="3" data-err="text"></textarea>', 'Record what was done and what was found. Use references, never real personal data.', 'full') + '</div>' +
      '<p class="hint" id="tl-warn" style="margin-top:6px">If you contact the customer, do not reveal the case, the assessment or any report. Log what you said.</p>' +
      '<div class="row-actions"><button class="btn pri" type="button" data-act="note-add">Add entry</button></div></div>';
    h += '<div class="blk"><h3>Timeline <span class="count">' + c.timeline.length + '</span></h3><ul class="tl">' + c.timeline.slice().sort(function (a, b) { return new Date(b.at) - new Date(a.at); }).map(function (e) {
      return '<li><span class="w">' + esc(fmtDT(e.at)) + '</span><span class="tx2"><span class="by">' + esc(e.by) + '</span> <span class="chip">' + esc((EVTYPES.filter(function (x) { return x[0] === e.type; })[0] || [0, e.type === 'signoff' ? 'Sign-off' : (e.type === 'filing' ? 'Filing' : 'System')])[1]) + '</span><br>' + esc(e.text) + '</span></li>';
    }).join('') + '</ul></div>';
    return h;
  }

  function evidenceView(c) {
    var h = '<div class="blk"><h3>Add evidence</h3><p class="hint" style="margin-bottom:10px">Point to where the evidence lives (a document store path, a system record, a link). Do not paste personal data or file contents here.</p><div class="fields">' +
      fld('What it is', 'ev-label', '<input class="in" id="ev-label" data-err="label">') + fld('Kind', 'ev-kind', selectHtml('ev-kind', [['Document', 'Document'], ['System record', 'System record'], ['Link', 'Link'], ['Note', 'Note']], 'Document')) +
      fld('Where to find it', 'ev-ref', '<input class="in" id="ev-ref" placeholder="Folder path, record id or https:// link">', '', 'full') + '</div><div class="row-actions"><button class="btn pri" type="button" data-act="ev-add">Add evidence</button></div></div>';
    h += '<div class="blk"><h3>Evidence list <span class="count">' + c.evidence.length + '</span></h3>' + (c.evidence.length ? '<div class="card-list">' + c.evidence.map(function (e, i) {
      var link = /^https?:\/\//i.test(e.ref) ? '<a href="' + esc(e.ref) + '" target="_blank" rel="noopener noreferrer">' + esc(e.ref) + '</a>' : esc(e.ref);
      return '<div class="card"><div><div class="t">' + esc(e.label) + ' <span class="chip">' + esc(e.kind) + '</span></div><div class="s">' + link + ' · added by ' + esc(e.by) + ', ' + esc(fmtD(e.at)) + '</div></div><button class="btn sm" type="button" data-act="ev-rm" data-i="' + i + '" aria-label="Remove ' + esc(e.label) + '">Remove</button></div>';
    }).join('') + '</div>' : '<p class="hint">No evidence logged yet. Evidence logged here is listed automatically under supporting documents in the narrative.</p>') + '</div>';
    return h;
  }

  /* narrative */
  function narrFieldHtml(f, n, c) {
    var id = 'n-' + f.k, v = n[f.k], help = f.help ? '<div class="help" id="' + id + '-h">' + esc(f.help) + '</div>' : '', desc = f.help ? ' aria-describedby="' + id + '-h"' : '', rq = f.req ? ' <span aria-hidden="true">*</span><span class="sr"> (required)</span>' : '';
    if (f.type === 'checkbox') return '<div class="field"><label class="chk" for="' + id + '"><input type="checkbox" id="' + id + '" data-n="' + f.k + '"' + (v ? ' checked' : '') + '><span>' + esc(f.label) + rq + '</span></label></div>';
    if (f.type === 'checks') return '<fieldset class="field"><legend>' + esc(f.label) + '</legend>' + f.opts.map(function (o) { return '<label class="chk"><input type="checkbox" data-nlist="' + f.k + '" value="' + o[0] + '"' + ((v || []).indexOf(o[0]) !== -1 ? ' checked' : '') + '><span>' + esc(o[1]) + '</span></label>'; }).join('') + '</fieldset>';
    var ctl;
    if (f.type === 'textarea') ctl = '<textarea class="in" id="' + id + '" data-n="' + f.k + '" rows="' + (f.rows || 3) + '"' + desc + '>' + esc(v || '') + '</textarea>';
    else if (f.type === 'select') ctl = '<select class="sel" id="' + id + '" data-n="' + f.k + '"' + desc + '>' + f.opts.map(function (o) { return opt(o[0], o[1], (v || '') === o[0]); }).join('') + '</select>';
    else ctl = '<input class="in" id="' + id + '" data-n="' + f.k + '" type="' + (f.type === 'date' ? 'date' : 'text') + '" value="' + esc(v || '') + '"' + desc + ' autocomplete="off">';
    return '<div class="field"><label for="' + id + '">' + esc(f.label) + rq + '</label>' + ctl + help + '</div>';
  }
  function narrativeView(c) {
    var n = c.narr, h = '<div class="callout info" style="margin-top:14px"><b class="k">How this works.</b> Fill in the guided form. The draft on the right is written from your answers with fixed templates (no AI): the same answers always give the same text. You can edit the draft directly; after that, form changes no longer overwrite it unless you regenerate.</div>';
    h += '<div class="narr"><div>' + NARR.GROUPS.map(function (g) {
      var fs = NARR.FIELDS.filter(function (f) { return f.g === g.id; });
      return '<section class="ngroup" aria-labelledby="ng-' + g.id + '"><h4 id="ng-' + g.id + '">' + esc(g.title) + '</h4><p class="hint">' + esc(g.hint) + '</p><div class="fields">' + fs.map(function (f) { return narrFieldHtml(f, n, c); }).join('') + '</div></section>';
    }).join('') + '</div>' +
      '<div class="sticky"><section class="ngroup" style="margin-top:16px" aria-labelledby="ng-draft"><h4 id="ng-draft">Draft narrative</h4><div id="narrEdited" class="hint" ' + (n.edited ? '' : 'hidden') + '>You edited this draft by hand. Form changes will not overwrite it.</div>' +
      '<label class="sr" for="narrDraft">Draft narrative text</label><textarea class="in draft" id="narrDraft" spellcheck="true">' + esc(narrText(c)) + '</textarea>' +
      '<div class="row-actions"><button class="btn sm" type="button" data-act="narr-copy">Copy text</button><button class="btn sm" type="button" data-act="narr-dl">Download .txt</button><button class="btn sm" type="button" data-act="narr-regen">Regenerate from the form</button></div>' +
      '<div id="narrComp"></div></section><section class="ngroup" aria-labelledby="ng-q"><h4 id="ng-q">Quality checklist</h4><p class="hint">Plain-language checks on the text above. They are prompts, not a guarantee.</p><div id="narrQual"></div></section>' +
      '<div class="callout" role="note"><b class="k">Tipping-off.</b> Do not inform the customer. The report and the fact that the activity was assessed stay inside the permitted channels (AMLR Art. 73(1)).</div></div></div>';
    return h;
  }
  function updateNarrChecks(c) {
    var ctx = narrCtx(c), comp = NARR.completeness(c.narr, ctx), txt = $('narrDraft') ? $('narrDraft').value : narrText(c), q = NARR.quality(txt, c.narr, ctx);
    var cl = $('narrComp'), ql = $('narrQual'); if (!cl || !ql) return;
    var missing = comp.items.filter(function (i) { return !i.ok; });
    cl.innerHTML = '<div style="margin-top:12px"><div class="meter ' + (comp.pct < 50 ? 'bad' : (comp.pct < 100 ? 'low' : '')) + '" role="img" aria-label="Completeness ' + comp.pct + ' percent"><i style="width:' + comp.pct + '%"></i></div><p style="margin-top:4px;font-weight:700">Completeness: ' + comp.ok + ' of ' + comp.total + ' required answers (' + comp.pct + '%)</p>' +
      (missing.length ? '<ul class="todo" aria-label="Missing answers">' + missing.map(function (m) { return '<li><span class="no" aria-hidden="true">✗</span><button class="btn link sm" type="button" data-act="goto-field" data-k="' + m.k + '">' + esc(m.label) + '</button></li>'; }).join('') + '</ul>' : '<p class="todo"><span class="ok">✓</span> Every required answer is filled in.</p>') + '</div>';
    ql.innerHTML = q.map(function (x) { return '<div class="qrow"><span><span class="badge ' + x.status + '">' + ({ pass: 'Pass', warn: 'Check', fail: 'Fix' }[x.status]) + '</span></span><span><b>' + esc(x.label) + '</b><span class="detail2">' + esc(x.detail) + '</span></span></div>'; }).join('');
  }
  function onNarrInput(el) {
    var c = caseById(UI.case); if (!c) return;
    var k = el.dataset.n;
    c.narr[k] = el.type === 'checkbox' ? el.checked : el.value;
    if (!c.narr.edited && $('narrDraft')) $('narrDraft').value = narrText(c);
    updateNarrChecks(c); save();
  }

  /* sign-off */
  function signoffView(c) {
    var s = DB.settings, a = c.analyst, m = c.mlro, comp = NARR.completeness(c.narr, narrCtx(c)), fp = flagProgress(c);
    var h = '<div class="blk"><h3>Before you sign</h3><ul class="todo">' +
      [[fp.assessed > 0, 'Red flags assessed (' + fp.assessed + ' of ' + fp.total + ')'], [c.evidence.length > 0, 'Evidence logged (' + c.evidence.length + ')'], [comp.pct === 100, 'Report narrative complete (' + comp.pct + '%)'], [!!c.narr.tippingAck, 'Tipping-off confirmation ticked']].map(function (x) { return '<li><span class="' + (x[0] ? 'ok' : 'no') + '" aria-hidden="true">' + (x[0] ? '✓' : '✗') + '</span><span>' + esc(x[1]) + '<span class="sr">' + (x[0] ? ' (done)' : ' (not done)') + '</span></span></li>'; }).join('') + '</ul></div>';
    h += '<div class="sections">';
    h += '<section class="sec2" aria-labelledby="so-a"><h3 id="so-a">1. Analyst recommendation and sign-off</h3>';
    if (a) h += '<div class="signed"><b>Signed by ' + esc(a.name) + '</b> on ' + esc(fmtDT(a.at)) + '. Recommends: <b>' + esc(DECISION[a.rec]) + '</b><br>' + esc(a.rationale) + '</div>' + (!m && c.status !== 'closed' ? '<button class="btn sm" type="button" data-act="signoff-withdraw">Withdraw analyst sign-off</button>' : '');
    else h += '<div class="fields">' + fld('Recommendation', 's-rec', selectHtml('s-rec', [['', 'Choose'], ['report', DECISION.report], ['noreport', DECISION.noreport], ['refer', DECISION.refer]], ''), '', '') + fld('Name', 's-name', '<input class="in" id="s-name" value="' + esc(s.me) + '">') +
      fld('Rationale', 's-rat', '<textarea class="in" id="s-rat" rows="4"></textarea>', 'Facts first: what you saw, what you checked, why it meets or does not meet the threshold of suspicion.', 'full') + '</div><p class="derr" id="s-err" role="alert"></p><div class="row-actions"><button class="btn pri" type="button" data-act="signoff-analyst">Sign off as analyst</button></div>';
    h += '</section>';

    h += '<section class="sec2' + (a ? '' : ' locked') + '" aria-labelledby="so-m"><h3 id="so-m">2. MLRO decision</h3>';
    h += '<p class="hint" style="margin-bottom:8px">The compliance officer transmits reports to the FIU:</p>' + lawBlock('officer') + lawBlock('officer11');
    if (m) h += '<div class="signed" style="margin-top:10px"><b>Decided by ' + esc(m.name) + '</b> on ' + esc(fmtDT(m.at)) + '. Decision: <b>' + esc(DECISION[m.decision]) + '</b>' + (m.referral ? ' (' + esc(m.referral) + ')' : '') + '<br>' + esc(m.rationale) + '</div>' + (c.status === 'filing' || c.status === 'closed' && !filingsFor(c.id).length ? '<button class="btn sm" type="button" data-act="mlro-withdraw">Withdraw MLRO decision</button>' : '');
    else if (!a) h += '<p style="margin-top:10px">The analyst must sign off first.</p>';
    else {
      h += '<div class="fields" style="margin-top:10px">' + fld('Decision', 'm-dec', selectHtml('m-dec', [['', 'Choose'], ['report', DECISION.report], ['noreport', DECISION.noreport], ['refer', DECISION.refer]], '')) + fld('Name', 'm-name', '<input class="in" id="m-name" value="' + esc(s.mlro) + '">') +
        fld('If referring: to whom or where', 'm-ref', '<input class="in" id="m-ref" placeholder="For example: sanctions team, tax compliance, law enforcement contact">', '', 'full') +
        fld('Rationale', 'm-rat', '<textarea class="in" id="m-rat" rows="4"></textarea>', 'Record why. Whether or not you report, this is the file an inspector will want to see.', 'full') + '</div>';
      var warns = [];
      if (a.name.toLowerCase() === s.mlro.toLowerCase()) warns.push('The analyst and the MLRO are the same name. Four-eyes review is stronger with two people.');
      if (comp.pct < 100) warns.push('The report narrative is ' + comp.pct + '% complete. You can still decide, but complete it before filing.');
      if (!c.narr.tippingAck) warns.push('The tipping-off confirmation is not ticked in the narrative.');
      if (warns.length) h += '<ul class="todo" aria-label="Warnings">' + warns.map(function (w) { return '<li><span class="no" aria-hidden="true">!</span><span>' + esc(w) + '</span></li>'; }).join('') + '</ul>';
      h += '<p class="derr" id="m-err" role="alert"></p><div class="row-actions"><button class="btn pri" type="button" data-act="mlro-decide">Record MLRO decision</button></div>';
    }
    h += '</section>';

    var fs = filingsFor(c.id);
    h += '<section class="sec2' + (m && m.decision === 'report' ? '' : ' locked') + '" aria-labelledby="so-f"><h3 id="so-f">3. Filing with the FIU</h3>';
    if (fs.length) h += '<div class="card-list">' + fs.map(function (f) { return filingCard(f, true); }).join('') + '</div>';
    else if (m && m.decision === 'report') h += '<p>Decision is to report. File through the FIU channel that applies to you, then record it here.</p>' + lawBlock('promptly') + lawBlock('attempted') + lawBlock('refrain') + '<div class="row-actions"><button class="btn pri" type="button" data-act="record-filing" data-case="' + esc(c.id) + '">Record filing</button></div>';
    else h += '<p>Available once the MLRO decides to report. If the decision is not to report, the case closes with the rationale on file.</p>';
    if (c.status === 'filed') h += '<div class="row-actions"><button class="btn" type="button" data-act="case-close">Close case</button></div>';
    h += '</section></div>';
    return h;
  }
  function filingCard(f, compact) {
    var c = caseById(f.caseId), ack = f.ack;
    return '<div class="card' + '"><div><div class="t">' + esc(f.ownRef || f.id) + ' · ' + esc(f.kind) + (c && !compact ? ' · ' + esc(c.title) : '') + '</div><div class="s">Filed ' + esc(fmtD(f.filedAt)) + (f.channel ? ' via ' + esc(f.channel) : '') + (f.fiuRef ? ' · FIU ref ' + esc(f.fiuRef) : '') + '</div>' +
      '<div class="s">' + (ack ? '<span class="clock done">Acknowledged ' + esc(fmtD(ack.at)) + (ack.ref ? ', ref ' + esc(ack.ref) : '') + '</span>' : '<span class="clock soon">Awaiting FIU acknowledgement</span>') +
      (c && c.holdTransaction ? ' <span class="clock ' + (f.holdResolved ? 'done' : 'info') + '">Held transaction ' + (f.holdResolved ? 'resolved' : 'open') + '</span>' : '') + '</div>' + (f.note ? '<div class="s">' + esc(f.note) + '</div>' : '') + '</div>' +
      '<button class="btn sm" type="button" data-act="filing-edit" data-id="' + esc(f.id) + '">' + (ack ? 'Edit' : 'Log acknowledgement') + '</button></div>';
  }
  function showErr(id, msg) { var e = $(id); if (e) e.textContent = msg; }
  function doSignAnalyst() {
    var c = caseById(UI.case), rec = val('s-rec'), nm = val('s-name'), rat = val('s-rat');
    if (!rec || !nm || !rat) { showErr('s-err', 'Choose a recommendation, give your name and write the rationale.'); return; }
    c.analyst = { name: nm, at: nowIso(), rec: rec, rationale: rat }; c.status = 'mlro';
    caseLog(c, 'signoff', 'Analyst sign-off by ' + nm + ': recommends "' + DECISION[rec] + '".', nm); save(); refreshCaseList(); renderCaseDetail(); toast('Analyst sign-off recorded');
  }
  function doDecide() {
    var c = caseById(UI.case), d = val('m-dec'), nm = val('m-name'), rat = val('m-rat'), ref = val('m-ref');
    if (!d || !nm || !rat) { showErr('m-err', 'Choose a decision, give your name and write the rationale.'); return; }
    if (d === 'refer' && !ref) { showErr('m-err', 'Say who or where the case is referred to.'); return; }
    c.mlro = { name: nm, at: nowIso(), decision: d, rationale: rat, referral: d === 'refer' ? ref : '' };
    c.status = d === 'report' ? 'filing' : 'closed'; if (c.status === 'closed') c.closedAt = nowIso();
    caseLog(c, 'signoff', 'MLRO decision by ' + nm + ': ' + DECISION[d] + (ref && d === 'refer' ? ' (' + ref + ')' : '') + '.', nm);
    save(); refreshCaseList(); renderCaseDetail(); toast('MLRO decision recorded: ' + DECISION[d]);
  }
  function dlgFiling(caseId, fid) {
    var f = fid ? DB.filings.filter(function (x) { return x.id === fid; })[0] : null, c = caseById(f ? f.caseId : caseId);
    var def = f || { ownRef: (c && c.narr.type === 'SAR' ? 'SAR' : 'STR') + '-' + new Date().getFullYear() + '-' + pad(DB.seq.filing + 1, 4), kind: (c && c.narr.type) || 'STR', filedAt: iso(new Date()), channel: '', fiuRef: '', ack: null, holdResolved: false, note: '' };
    dlgOpen(f ? 'Update filing ' + (f.ownRef || f.id) : 'Record filing for ' + (c ? c.id : ''),
      '<div class="fields">' + fld('Your reference', 'fi-own', '<input class="in" id="fi-own" value="' + esc(def.ownRef) + '" data-err="own">') + fld('Type', 'fi-kind', selectHtml('fi-kind', [['STR', 'STR'], ['SAR', 'SAR']], def.kind)) +
      fld('Date filed', 'fi-date', '<input class="in" type="date" id="fi-date" value="' + esc(def.filedAt) + '" data-err="date">') + fld('Channel', 'fi-chan', '<input class="in" id="fi-chan" value="' + esc(def.channel) + '" placeholder="FIU portal, secure upload">') +
      fld('FIU reference (if given)', 'fi-fiu', '<input class="in" id="fi-fiu" value="' + esc(def.fiuRef) + '">') +
      fld('Acknowledged on', 'fi-ackd', '<input class="in" type="date" id="fi-ackd" value="' + esc(def.ack ? def.ack.at : '') + '">', 'Leave empty until the FIU acknowledges.') + fld('Acknowledgement reference', 'fi-ackr', '<input class="in" id="fi-ackr" value="' + esc(def.ack ? def.ack.ref : '') + '">') +
      (c && c.holdTransaction ? '<div class="field full"><label class="chk"><input type="checkbox" id="fi-hold"' + (def.holdResolved ? ' checked' : '') + '><span>Held transaction resolved (released or blocked on FIU instruction). See Art. 71(1).</span></label></div>' : '') +
      fld('Note', 'fi-note', '<textarea class="in" id="fi-note" rows="2">' + esc(def.note) + '</textarea>', '', 'full') + '</div>',
      { submit: f ? 'Save' : 'Record filing', onSubmit: function () {
        if (!val('fi-own')) return { error: 'Give the filing a reference.', field: 'own' };
        if (!val('fi-date')) return { error: 'Enter the date filed.', field: 'date' };
        var ack = val('fi-ackd') ? { at: val('fi-ackd'), ref: val('fi-ackr') } : null;
        var o = f || { id: nextId('filing'), caseId: c.id };
        Object.assign(o, { ownRef: val('fi-own'), kind: val('fi-kind'), filedAt: val('fi-date'), channel: val('fi-chan'), fiuRef: val('fi-fiu'), ack: ack, holdResolved: $('fi-hold') ? $('fi-hold').checked : false, note: val('fi-note') });
        if (!f) { DB.filings.push(o); c.status = 'filed'; caseLog(c, 'filing', 'Report filed with the FIU (own ref ' + o.ownRef + ').'); }
        else if (ack && !f.ackLogged) { f.ackLogged = true; if (c) caseLog(c, 'filing', 'FIU acknowledgement logged' + (ack.ref ? ' (' + ack.ref + ')' : '') + '.'); }
        save(); render(); toast(f ? 'Filing updated' : 'Filing recorded');
      } });
  }
  function dlgRequest(rid) {
    var r = rid ? DB.requests.filter(function (x) { return x.id === rid; })[0] : null;
    var def = r || { caseId: '', receivedAt: iso(new Date()), fiuRef: '', subject: '', dueAt: '', dueSource: 'default', note: '' };
    var def5 = function (rec) { var d = parseISO(rec); return d ? iso(addWD(d, 5)) : ''; };
    var custom = def.dueSource === 'fiu';
    dlgOpen(r ? 'Edit FIU request' : 'Log an FIU request for information',
      '<div class="fields">' + fld('FIU reference', 'rq-ref', '<input class="in" id="rq-ref" value="' + esc(def.fiuRef) + '">') +
      fld('Related case', 'rq-case', selectHtml('rq-case', [['', 'None / not linked']].concat(DB.cases.map(function (c) { return [c.id, c.id + ': ' + c.title]; })), def.caseId)) +
      fld('What is requested', 'rq-sub', '<input class="in" id="rq-sub" value="' + esc(def.subject) + '" data-err="subject">', '', 'full') +
      fld('Received on', 'rq-rec', '<input class="in" type="date" id="rq-rec" value="' + esc(def.receivedAt) + '" data-err="rec">') +
      '<div class="field"><label for="rq-due">Reply due by</label><input class="in" type="date" id="rq-due" value="' + esc(custom ? def.dueAt : def5(def.receivedAt)) + '"' + (custom ? '' : ' readonly') + ' aria-describedby="rq-due-h"><div class="help" id="rq-due-h">Default: 5 working days from receipt (AMLR Art. 69(1)), weekends and your configured holidays excluded.</div></div>' +
      '<div class="field full"><label class="chk"><input type="checkbox" id="rq-custom"' + (custom ? ' checked' : '') + '><span>The FIU gave a different deadline (it may shorten or extend it). Enter that date instead.</span></label></div>' +
      fld('Note', 'rq-note', '<textarea class="in" id="rq-note" rows="2">' + esc(def.note) + '</textarea>', '', 'full') + '</div>',
      { submit: r ? 'Save' : 'Log request', onSubmit: function () {
        if (!val('rq-sub')) return { error: 'Say what is requested.', field: 'subject' };
        if (!val('rq-rec')) return { error: 'Enter the date received.', field: 'rec' };
        var cust = $('rq-custom').checked, due = cust ? val('rq-due') : def5(val('rq-rec'));
        if (!due) return { error: 'Enter the deadline the FIU gave.', field: '' };
        var o = r || { id: nextId('req'), respondedAt: '' };
        Object.assign(o, { fiuRef: val('rq-ref'), caseId: val('rq-case'), subject: val('rq-sub'), receivedAt: val('rq-rec'), dueAt: due, dueSource: cust ? 'fiu' : 'default', note: val('rq-note') });
        if (!r) DB.requests.push(o); save(); render(); toast(r ? 'Request updated' : 'FIU request logged');
      } });
  }
  function dlgRespond(rid) {
    var r = DB.requests.filter(function (x) { return x.id === rid; })[0]; if (!r) return;
    dlgOpen('Record the reply to ' + (r.fiuRef || r.id), '<div class="fields">' + fld('Replied on', 'rs-date', '<input class="in" type="date" id="rs-date" value="' + iso(new Date()) + '" data-err="date">') + fld('Note', 'rs-note', '<textarea class="in" id="rs-note" rows="2"></textarea>', '', 'full') + '</div>',
      { submit: 'Mark as answered', onSubmit: function () { if (!val('rs-date')) return { error: 'Enter the date.', field: 'date' }; r.respondedAt = val('rs-date'); if (val('rs-note')) r.note = (r.note ? r.note + ' ' : '') + val('rs-note'); save(); render(); toast('Request marked as answered'); } });
  }

  /* print */
  function tbl(head, rows) { return '<table><thead><tr>' + head.map(function (h) { return '<th scope="col">' + esc(h) + '</th>'; }).join('') + '</tr></thead><tbody>' + (rows.length ? rows.map(function (r) { return '<tr>' + r.map(function (x) { return '<td>' + esc(x) + '</td>'; }).join('') + '</tr>'; }).join('') : '<tr><td colspan="' + head.length + '">None recorded.</td></tr>') + '</tbody></table>'; }
  function printHtml(c) {
    var fp = flagProgress(c), fl = flagsFor(c), fs = filingsFor(c.id), comp = NARR.completeness(c.narr, narrCtx(c));
    var h = '<article class="printdoc"><h1>Case file ' + esc(c.id) + '</h1><p class="meta">' + esc(c.title) + '</p>' +
      '<p class="conf">CONFIDENTIAL. This file concerns a suspicion assessment or report. It must not be disclosed to the customer or other third persons (AMLR Art. 73(1)). Demo data: fictional.</p>' +
      '<p class="meta">' + esc(DB.settings.firm) + ' · printed ' + esc(fmtDT(nowIso())) + ' · status: ' + esc(STATUS[c.status]) + '</p>' +
      '<h2>1. Case details</h2>' + tbl(['Field', 'Value'], [['Typology', typo(c.typology).label], ['Priority', c.priority], ['Assignee', c.assignee || 'Unassigned'], ['Opened', fmtDT(c.openedAt)], ['Suspicion formed', fmtD(c.suspicionDate) || 'Not recorded'], ['Transaction held (Art. 71)', c.holdTransaction ? 'Yes' : 'No']]) +
      '<h2>2. Customers and entities</h2>' + tbl(['Name or reference', 'Role', 'ID'], c.subjects.map(function (s) { return [s.name, s.role, s.ref]; })) +
      '<h2>3. Linked alerts</h2>' + tbl(['Alert', 'Title', 'Rule', 'Raised', 'Amount'], c.alertIds.map(function (id) { var a = alertById(id) || {}; return [id, a.title, a.rule, a.createdAt ? fmtD(a.createdAt) : '', a.amount]; })) +
      '<h2>4. Red flags (' + fp.present + ' present, ' + fp.assessed + ' of ' + fp.total + ' assessed)</h2>' + tbl(['Indicator', 'Assessment'], fl.map(function (f) { return [f.text, { yes: 'Present', no: 'Not present', unk: 'Unknown' }[c.flagState[f.text]] || 'Not assessed']; })) + (c.mitigation ? '<p><b>Mitigating factors considered:</b> ' + esc(c.mitigation) + '</p>' : '') +
      '<h2>5. Timeline</h2>' + tbl(['When', 'Who', 'Entry'], c.timeline.slice().sort(function (a, b) { return new Date(a.at) - new Date(b.at); }).map(function (e) { return [fmtDT(e.at), e.by, e.text]; })) +
      '<h2>6. Evidence</h2>' + tbl(['Item', 'Kind', 'Where', 'Added'], c.evidence.map(function (e) { return [e.label, e.kind, e.ref, fmtD(e.at)]; })) +
      '<h2>7. Sign-off and decision</h2>' + tbl(['Step', 'By', 'When', 'Outcome and rationale'], [['Analyst', c.analyst ? c.analyst.name : '', c.analyst ? fmtDT(c.analyst.at) : '', c.analyst ? DECISION[c.analyst.rec] + '. ' + c.analyst.rationale : 'Not signed'], ['MLRO', c.mlro ? c.mlro.name : '', c.mlro ? fmtDT(c.mlro.at) : '', c.mlro ? DECISION[c.mlro.decision] + (c.mlro.referral ? ' (' + c.mlro.referral + ')' : '') + '. ' + c.mlro.rationale : 'No decision']]) +
      '<h2>8. Filing</h2>' + tbl(['Reference', 'Type', 'Filed', 'Channel', 'FIU acknowledgement'], fs.map(function (f) { return [f.ownRef, f.kind, fmtD(f.filedAt), f.channel, f.ack ? fmtD(f.ack.at) + (f.ack.ref ? ' (' + f.ack.ref + ')' : '') : 'Awaiting']; })) +
      '<h2>9. Report narrative (completeness ' + comp.pct + '%)</h2><pre>' + esc(narrText(c)) + '</pre>' +
      '<p class="meta">Prototype output from RegRadar with fictional data. Not legal advice.</p></article>';
    return h;
  }
  function printView(c) {
    return '<div class="row-actions"><button class="btn pri" type="button" data-act="case-print">Print or save as PDF</button></div><p class="hint" style="margin-top:6px">This is the print-ready case file. Use your browser’s print dialog to print it or save it as a PDF.</p>' + printHtml(c);
  }

  /* ---------- filings and clocks ---------- */
  function filingsView() {
    var cl = clocks(), basisSel = UI.basis || '', shown = cl.filter(function (x) { return !basisSel || x.basis === basisSel; });
    var h = '<div class="sec-h" style="margin-top:0"><h2 id="h-clocks">Clocks and deadlines</h2><div class="chips" role="group" aria-label="Filter clocks">' + [['', 'All'], ['statutory', 'From the law'], ['internal', 'Your internal targets']].map(function (p) { return '<button class="chip" type="button" data-act="cbasis" data-b="' + p[0] + '" aria-pressed="' + (basisSel === p[0]) + '">' + p[1] + '</button>'; }).join('') + '</div></div>' +
      '<p class="hint">Working days skip weekends and the holidays you list in Data and settings. Internal targets are defaults: configure them for your firm.</p>';
    h += '<div class="card-list" style="margin-top:10px" aria-labelledby="h-clocks">' + (shown.length ? shown.map(function (x) {
      var chipCls = x.info ? 'info' : (x.r.state === 'ok' ? '' : x.r.state);
      var txt = x.info ? (x.r.state === 'overdue' ? 'Review: ' + x.r.text.replace(' overdue', ' past') : x.r.text) : x.r.text;
      return '<div class="card' + (x.r.state === 'overdue' && !x.info ? ' over' : '') + '"><div><div class="t">' + esc(x.kind) + ': ' + esc(x.title) + '</div><div class="s"><span class="mono">' + esc(x.ref) + '</span> · due ' + esc(fmtDT(x.due)) + ' · <b>' + (x.basis === 'statutory' ? 'From the law' : 'Internal target') + '</b></div><div class="s">' + esc(x.note) + '</div></div><div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end"><span class="clock ' + chipCls + '">' + esc(txt) + '</span><button class="btn sm" type="button" data-act="clock-go" data-i="' + cl.indexOf(x) + '">Open</button></div></div>';
    }).join('') : '<div class="empty">Nothing is running. Open alerts, cases awaiting a decision, unacknowledged filings and FIU requests appear here.</div>') + '</div>';

    h += '<div class="sec-h"><h2 id="h-fil">Filing log</h2><div class="head-tools"><button class="btn sm" type="button" data-act="record-filing" data-case="">Record a filing</button><button class="btn sm" type="button" data-act="export-filings">Export filing log (CSV)</button></div></div>';
    h += '<div class="card-list" aria-labelledby="h-fil">' + (DB.filings.length ? DB.filings.slice().sort(function (a, b) { return a.filedAt < b.filedAt ? 1 : -1; }).map(function (f) { return filingCard(f, false); }).join('') : '<div class="empty">No filings logged yet. When the MLRO decides to report, record the filing from the case.</div>') + '</div>';

    h += '<div class="sec-h"><h2 id="h-req">FIU requests for information</h2><button class="btn sm" type="button" data-act="req-new">Log an FIU request</button></div>';
    h += '<div class="card-list" aria-labelledby="h-req">' + (DB.requests.length ? DB.requests.slice().sort(function (a, b) { return a.dueAt < b.dueAt ? -1 : 1; }).map(function (r) {
      var due = dayEnd(r.dueAt), rm = remain(due, 48), c = r.caseId ? caseById(r.caseId) : null;
      return '<div class="card' + (!r.respondedAt && rm.state === 'overdue' ? ' over' : '') + '"><div><div class="t">' + esc(r.fiuRef || r.id) + ': ' + esc(r.subject) + '</div><div class="s">Received ' + esc(fmtD(r.receivedAt)) + ' · due ' + esc(fmtD(r.dueAt)) + ' (' + (r.dueSource === 'fiu' ? 'set by the FIU' : '5 working days') + ')' + (c ? ' · ' + esc(c.id) : '') + '</div>' + (r.note ? '<div class="s">' + esc(r.note) + '</div>' : '') + '</div>' +
        '<div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end">' + (r.respondedAt ? '<span class="clock done">Answered ' + esc(fmtD(r.respondedAt)) + '</span>' : '<span class="clock ' + (rm.state === 'ok' ? '' : rm.state) + '">' + esc(rm.text) + '</span>') +
        '<span style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">' + (r.respondedAt ? '' : '<button class="btn sm" type="button" data-act="req-respond" data-id="' + esc(r.id) + '">Mark answered</button>') + '<button class="btn sm" type="button" data-act="req-edit" data-id="' + esc(r.id) + '">Edit</button></span></div></div>';
    }).join('') : '<div class="empty">No FIU requests logged.</div>') + '</div>';

    h += '<div class="sec-h"><h2>What the law says</h2></div><details class="fold" open><summary>Reporting and responding (AMLR Art. 69)</summary><p class="hint" style="margin-bottom:6px">Link: <a href="workspace.html?open=AMLR-art69">obligation AMLR-art69 in the Compliance workspace</a>.</p>' + lawBlock('promptly') + lawBlock('attempted') + lawBlock('fiu5') + lawBlock('fiuExt') + lawBlock('basis') + '</details>' +
      '<details class="fold"><summary>Refraining from transactions (AMLR Art. 71)</summary>' + lawBlock('refrain') + lawBlock('refrain2') + '</details>' +
      '<details class="fold"><summary>Prohibition of disclosure and good-faith protection (AMLR Art. 72 and 73)</summary>' + lawBlock('tipping') + lawBlock('goodfaith') + '</details>' +
      '<details class="fold"><summary>When the AMLR applies</summary>' + lawBlock('apply') + '<p class="hint" style="margin-top:8px">Until it applies, the reporting rules of your national law and your FIU’s format govern. Check them before relying on this page for a live filing.</p></details>';
    return h;
  }

  /* ---------- dialogs: data & settings ---------- */
  function dlgData() {
    var s = DB.settings;
    dlgOpen('Data and settings',
      '<div class="fields">' + fld('Firm name', 'st-firm', '<input class="in" id="st-firm" value="' + esc(s.firm) + '">') + fld('Your name', 'st-me', '<input class="in" id="st-me" value="' + esc(s.me) + '">') +
      fld('MLRO name', 'st-mlro', '<input class="in" id="st-mlro" value="' + esc(s.mlro) + '">') + fld('Team (comma separated)', 'st-team', '<input class="in" id="st-team" value="' + esc(s.team.join(', ')) + '">') +
      fld('Triage target, high priority (working days)', 'st-sh', '<input class="in" type="number" min="1" max="30" id="st-sh" value="' + s.sla.high + '">', 'Defaults. Configure for your firm.') + fld('Triage target, medium', 'st-sm', '<input class="in" type="number" min="1" max="30" id="st-sm" value="' + s.sla.medium + '">') +
      fld('Triage target, low', 'st-sl', '<input class="in" type="number" min="1" max="60" id="st-sl" value="' + s.sla.low + '">') + fld('Case decision target (working days)', 'st-cd', '<input class="in" type="number" min="1" max="90" id="st-cd" value="' + s.caseDays + '">') +
      fld('File after MLRO decision (working days)', 'st-fd', '<input class="in" type="number" min="1" max="30" id="st-fd" value="' + s.fileDays + '">', 'The law says "promptly", with no fixed days. This is your own target.') + fld('Chase FIU acknowledgement after (working days)', 'st-ad', '<input class="in" type="number" min="1" max="30" id="st-ad" value="' + s.ackDays + '">') +
      fld('Non-working days (YYYY-MM-DD, comma or line separated)', 'st-hol', '<textarea class="in" id="st-hol" rows="2">' + esc(s.holidays.join(', ')) + '</textarea>', 'Public holidays in your Member State. Weekends are always skipped.', 'full') + '</div>' +
      '<div class="blk"><h3>Your data</h3><p class="hint" style="margin-bottom:8px">Stored only in this browser (<span class="mono">regradar-cases</span>). Export a backup before clearing site data.</p><div class="row-actions" style="margin-top:0"><button class="btn sm" type="button" data-act="exp-json">Export backup (JSON)</button><label class="btn sm" for="imp-file" style="cursor:pointer">Import backup</label><input class="sr" type="file" id="imp-file" accept=".json,application/json"><button class="btn sm" type="button" data-act="export-alerts">Export alerts (CSV)</button>' +
      '<button class="btn sm danger" type="button" data-act="reset-demo">Reset to demo data</button><button class="btn sm danger" type="button" data-act="erase">Erase all data</button></div></div>',
      { wide: true, submit: 'Save settings', onSubmit: function () {
        var n = function (id, d, lo, hi) { var x = parseInt(val(id), 10); return isNaN(x) ? d : Math.min(hi, Math.max(lo, x)); };
        s.firm = val('st-firm') || s.firm; s.me = val('st-me') || s.me; s.mlro = val('st-mlro') || s.mlro;
        var team = val('st-team').split(',').map(function (x) { return x.trim(); }).filter(Boolean); if (team.length) s.team = team;
        s.sla = { high: n('st-sh', 1, 1, 30), medium: n('st-sm', 3, 1, 30), low: n('st-sl', 5, 1, 60) }; s.caseDays = n('st-cd', 10, 1, 90); s.fileDays = n('st-fd', 3, 1, 30); s.ackDays = n('st-ad', 3, 1, 30);
        s.holidays = val('st-hol').split(/[\s,;]+/).filter(function (x) { return /^\d{4}-\d{2}-\d{2}$/.test(x); });
        save(); render(); toast('Settings saved');
      } });
  }

  /* ---------- render ---------- */
  function syncUrl() {
    try {
      var u = new URL(location.href); u.search = ''; u.searchParams.set('tab', UI.tab);
      if (UI.tab === 'alerts' && UI.alert) u.searchParams.set('alert', UI.alert);
      if (UI.tab === 'cases' && UI.case) { u.searchParams.set('case', UI.case); if (UI.csub !== 'summary') u.searchParams.set('sub', UI.csub); }
      history.replaceState(null, '', u);
    } catch (e) { /* ignore */ }
  }
  function render() {
    renderTabs(); renderKpis();
    var p = $('panel'), keep = $('aitems') || $('citems'), st = keep ? keep.scrollTop : 0;
    p.innerHTML = UI.tab === 'alerts' ? alertsView() : (UI.tab === 'cases' ? casesView() : filingsView());
    var items = $('aitems') || $('citems'); if (items) items.scrollTop = st;
    syncUrl();
    if (UI.focus) { var el = document.querySelector(UI.focus); if (el) el.focus(); UI.focus = null; }
    if (UI.tab === 'cases' && UI.csub === 'narrative') { var c = caseById(UI.case); if (c) updateNarrChecks(c); }
  }
  function goto(g) {
    UI.tab = g.tab; UI.mdet = true;
    if (g.alert) { UI.alert = g.alert; var a = alertById(g.alert); if (a && !filteredAlerts().some(function (x) { return x.id === g.alert; })) { UI.f.status = 'all'; UI.f.priority = ''; UI.f.typology = ''; UI.f.assignee = ''; UI.f.q = ''; } }
    if (g.case) { UI.case = g.case; UI.csub = g.csub || 'summary'; if (!filteredCases().some(function (x) { return x.id === g.case; })) { UI.cf.status = 'all'; UI.cf.q = ''; } }
    if (g.tab === 'filings') UI.mdet = false;
    render(); window.scrollTo(0, 0);
    if (g.filing || g.req) { var btn = document.querySelector('[data-act="' + (g.filing ? 'filing-edit' : 'req-edit') + '"][data-id="' + (g.filing || g.req) + '"]'); if (btn) { btn.scrollIntoView({ block: 'center' }); btn.focus(); } }
  }

  /* ---------- events ---------- */
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]'); if (!b) return;
    var act = b.getAttribute('data-act'), c = caseById(UI.case);
    switch (act) {
      case 'tab': UI.tab = b.dataset.t; UI.mdet = false; render(); return;
      case 'back': UI.mdet = false; document.querySelector('#panel .grid').classList.remove('m-detail'); return;
      case 'new-alert': dlgNewAlert(); return;
      case 'import-alerts': dlgImportAlerts(); return;
      case 'export-register': download('regradar_case_register.csv', registerCSV()); toast('Case register exported'); return;
      case 'export-alerts': download('regradar_alerts.csv', alertsCSV()); toast('Alerts exported'); return;
      case 'export-filings': download('regradar_filing_log.csv', filingsCSV()); toast('Filing log exported'); return;
      case 'data': dlgData(); return;
      case 'dlg-cancel': dlg.close(); return;
      case 'exp-json': download('regradar_cases_backup.json', JSON.stringify(DB, null, 1), 'application/json'); toast('Backup exported'); return;
      case 'reset-demo': confirmDlg('Reset to demo data?', 'This replaces everything on this device with the fictional demo data. Export a backup first if you want to keep your work.', 'Reset', function () { DB = hydrate(SEED || { alerts: [], cases: [], filings: [], requests: [] }); UI.alert = null; UI.case = null; save(); render(); toast('Demo data restored'); }); return;
      case 'erase': confirmDlg('Erase all data on this device?', 'All alerts, cases, filings and settings in this browser will be deleted. This cannot be undone. Export a backup first if you need one.', 'Erase everything', function () { DB = emptyDB(); UI.alert = null; UI.case = null; save(); render(); toast('All data erased'); }); return;
      case 'alert': selectAlert(b.dataset.alert, false, true); return;
      case 'alert-esc': dlgEscalate(b.dataset.id); return;
      case 'alert-close': dlgCloseAlert(b.dataset.id); return;
      case 'alert-review': { var a1 = alertById(b.dataset.id); a1.status = 'in_review'; if (!a1.assignee) a1.assignee = DB.settings.me; alertLog(a1, 'Review started.'); save(); afterAlertChange(a1.id); return; }
      case 'alert-me': { var a2 = alertById(b.dataset.id); a2.assignee = DB.settings.me; alertLog(a2, 'Assigned to ' + a2.assignee + '.'); save(); afterAlertChange(a2.id); toast('Assigned to you'); return; }
      case 'alert-reopen': { var a3 = alertById(b.dataset.id); a3.status = 'new'; delete a3.closeReason; alertLog(a3, 'Reopened.'); save(); UI.f.status = 'open'; render(); return; }
      case 'goto-case': goto({ tab: 'cases', case: b.dataset.id }); return;
      case 'goto-alert': goto({ tab: 'alerts', alert: b.dataset.id }); return;
      case 'case': selectCase(b.dataset['case'], true); return;
      case 'cfilter': UI.cf.status = b.dataset.s; UI.focus = '[data-act="cfilter"][data-s="' + b.dataset.s + '"]'; UI.case = null; render(); return;
      case 'csub': UI.csub = b.dataset.s; renderCaseDetail(); if (UI.csub === 'narrative') updateNarrChecks(caseById(UI.case)); var tb = $('st-' + UI.csub); if (tb) tb.focus(); syncUrl(); return;
      case 'subj-add': { var nm = val('sj-name'); if (!nm) { toast('Enter a name or reference'); $('sj-name').focus(); return; } c.subjects.push({ name: nm, role: val('sj-role'), ref: val('sj-ref') }); caseLog(c, 'system', 'Subject added: ' + nm + ' (' + val('sj-role') + ').'); save(); renderCaseDetail(); return; }
      case 'subj-rm': { var sj = c.subjects.splice(+b.dataset.i, 1)[0]; caseLog(c, 'system', 'Subject removed: ' + sj.name + '.'); save(); renderCaseDetail(); return; }
      case 'flag-add': { var t = val('fl-new'); if (!t) { toast('Describe the indicator first'); $('fl-new').focus(); return; } c.customFlags.push(t); save(); UI.focus = '#fl-new'; renderCaseDetail(); return; }
      case 'note-add': { var tx = val('tl-text'); if (!tx) { toast('Write the entry first'); $('tl-text').focus(); return; } caseLog(c, val('tl-type'), tx); save(); renderCaseDetail(); return; }
      case 'ev-add': { var lb = val('ev-label'); if (!lb) { toast('Say what the evidence is'); $('ev-label').focus(); return; } c.evidence.push({ label: lb, kind: val('ev-kind'), ref: val('ev-ref'), by: DB.settings.me, at: nowIso() }); caseLog(c, 'system', 'Evidence added: ' + lb + '.'); save(); renderCaseDetail(); return; }
      case 'ev-rm': { var ev = c.evidence.splice(+b.dataset.i, 1)[0]; caseLog(c, 'system', 'Evidence removed: ' + ev.label + '.'); save(); renderCaseDetail(); return; }
      case 'narr-copy': { var txt = $('narrDraft').value; if (navigator.clipboard) navigator.clipboard.writeText(txt).then(function () { toast('Narrative copied'); }, function () { $('narrDraft').select(); toast('Select and copy the text'); }); else { $('narrDraft').select(); toast('Select and copy the text'); } return; }
      case 'narr-dl': download('narrative_' + c.id + '.txt', $('narrDraft').value, 'text/plain'); toast('Narrative downloaded'); return;
      case 'narr-regen': { var go = function () { c.narr.edited = false; c.narr.draft = ''; save(); renderCaseDetail(); updateNarrChecks(c); toast('Draft regenerated'); }; if (c.narr.edited) confirmDlg('Regenerate the draft?', 'This replaces the text you edited by hand with a fresh draft built from the form.', 'Regenerate', go); else go(); return; }
      case 'goto-field': { var f = $('n-' + b.dataset.k) || document.querySelector('[data-nlist="' + b.dataset.k + '"]'); if (f) { f.scrollIntoView({ block: 'center' }); f.focus(); } return; }
      case 'signoff-analyst': doSignAnalyst(); return;
      case 'signoff-withdraw': confirmDlg('Withdraw analyst sign-off?', 'The case returns to analyst review and the withdrawal is logged on the timeline.', 'Withdraw', function () { caseLog(c, 'signoff', 'Analyst sign-off by ' + c.analyst.name + ' withdrawn.'); c.analyst = null; c.status = 'review'; save(); refreshCaseList(); renderCaseDetail(); }); return;
      case 'mlro-decide': doDecide(); return;
      case 'mlro-withdraw': confirmDlg('Withdraw the MLRO decision?', 'The case returns to awaiting MLRO decision and the withdrawal is logged on the timeline.', 'Withdraw', function () { caseLog(c, 'signoff', 'MLRO decision by ' + c.mlro.name + ' withdrawn.'); c.mlro = null; c.status = 'mlro'; delete c.closedAt; save(); refreshCaseList(); renderCaseDetail(); }); return;
      case 'case-close': c.status = 'closed'; c.closedAt = nowIso(); caseLog(c, 'system', 'Case closed.'); save(); refreshCaseList(); renderCaseDetail(); toast('Case closed'); return;
      case 'case-reopen': c.status = c.mlro ? (c.mlro.decision === 'report' ? 'filing' : 'mlro') : (c.analyst ? 'mlro' : 'open'); if (c.mlro && c.mlro.decision !== 'report') { caseLog(c, 'signoff', 'Case reopened; MLRO decision cleared.'); c.mlro = null; } else caseLog(c, 'system', 'Case reopened.'); if (filingsFor(c.id).length) c.status = 'filed'; delete c.closedAt; save(); refreshCaseList(); renderCaseDetail(); return;
      case 'case-delete': confirmDlg('Delete ' + c.id + ' from this device?', 'The case file, its timeline and notes are removed. Linked alerts return to the queue. Filings logged against it are kept. This cannot be undone.', 'Delete case', function () {
        c.alertIds.forEach(function (id) { var a = alertById(id); if (a) { a.status = 'new'; delete a.caseId; alertLog(a, 'Case ' + c.id + ' deleted; alert returned to the queue.'); } });
        DB.cases = DB.cases.filter(function (x) { return x.id !== c.id; }); UI.case = null; UI.mdet = false; save(); render(); toast('Case deleted'); }); return;
      case 'case-print': $('printHost').innerHTML = printHtml(c); window.print(); return;
      case 'record-filing': { var cid = b.dataset['case']; if (!cid) { var elig = DB.cases.filter(function (x) { return x.mlro && x.mlro.decision === 'report' && !filingsFor(x.id).length; }); if (!elig.length) { toast('No case is awaiting filing. The MLRO must decide to report first.'); return; } cid = elig[0].id; } dlgFiling(cid, null); return; }
      case 'filing-edit': dlgFiling(null, b.dataset.id); return;
      case 'req-new': dlgRequest(null); return;
      case 'req-edit': dlgRequest(b.dataset.id); return;
      case 'req-respond': dlgRespond(b.dataset.id); return;
      case 'cbasis': UI.basis = b.dataset.b; UI.focus = '[data-act="cbasis"][data-b="' + b.dataset.b + '"]'; render(); return;
      case 'clock-go': { var cl = clocks()[+b.dataset.i]; if (cl) goto(cl.go); return; }
    }
  });
  document.addEventListener('change', function (e) {
    var t = e.target, c;
    if (t.dataset.af) { UI.f[t.dataset.af] = t.value; UI.alert = null; UI.focus = '#' + t.id; render(); return; }
    if (t.dataset.aa) { var a = alertById(UI.alert); if (!a) return; if (t.dataset.aa === 'assignee') { a.assignee = t.value; alertLog(a, 'Assigned to ' + (t.value || 'nobody') + '.'); } else { alertLog(a, 'Priority changed from ' + a.priority + ' to ' + t.value + '.'); a.priority = t.value; } save(); UI.focus = '#' + t.id; afterAlertChange(a.id); return; }
    if (t.dataset.cf) {
      c = caseById(UI.case); if (!c) return; var k = t.dataset.cf, v = t.type === 'checkbox' ? t.checked : t.value;
      if (k === 'title' && !String(v).trim()) { t.value = c.title; return; }
      if (['typology', 'priority', 'assignee'].indexOf(k) !== -1 && c[k] !== v) caseLog(c, 'system', k[0].toUpperCase() + k.slice(1) + ' changed from "' + (k === 'typology' ? typo(c[k]).label : (c[k] || 'unassigned')) + '" to "' + (k === 'typology' ? typo(v).label : (v || 'unassigned')) + '".');
      if (k === 'holdTransaction') caseLog(c, 'system', v ? 'Transaction hold recorded (Art. 71).' : 'Transaction hold cleared.');
      c[k] = v; save(); refreshCaseList(); if (k === 'typology' || k === 'holdTransaction') { UI.focus = '#' + t.id; renderCaseDetail(); if (UI.focus) { var el = document.querySelector(UI.focus); if (el) el.focus(); UI.focus = null; } }
      else if (k === 'title') document.querySelector('#cdetail h2').textContent = v;
      return;
    }
    if (t.dataset.fl !== undefined) { c = caseById(UI.case); var fl = flagsFor(c)[+t.dataset.fl]; if (!fl) return; c.flagState[fl.text] = t.value; save(); var p = flagProgress(c); var m = document.querySelector('#csubpanel .meter'); if (m) { var pct = Math.round(100 * p.assessed / p.total); m.firstChild.style.width = pct + '%'; m.className = 'meter ' + (pct < 50 ? 'bad' : (pct < 100 ? 'low' : '')); m.setAttribute('aria-label', p.assessed + ' of ' + p.total + ' indicators assessed'); m.nextElementSibling.textContent = p.assessed + ' of ' + p.total + ' assessed · ' + p.present + ' present'; } return; }
    if (t.dataset.nlist) { c = caseById(UI.case); var set = c.narr[t.dataset.nlist] || []; var i = set.indexOf(t.value); if (t.checked && i === -1) set.push(t.value); if (!t.checked && i !== -1) set.splice(i, 1); c.narr[t.dataset.nlist] = set; if (!c.narr.edited) $('narrDraft').value = narrText(c); updateNarrChecks(c); save(); return; }
    if (t.dataset.n && (t.type === 'checkbox' || t.tagName === 'SELECT' || t.type === 'date')) { onNarrInput(t); return; }
    if (t.id === 'rq-rec' || t.id === 'rq-custom') {
      var cust = $('rq-custom').checked, d = parseISO($('rq-rec').value);
      $('rq-due').readOnly = !cust; if (!cust && d) $('rq-due').value = iso(addWD(d, 5));
      return;
    }
    if (t.id === 'imp-file' && t.files[0]) {
      var rd = new FileReader();
      rd.onload = function () {
        try {
          var d2 = JSON.parse(String(rd.result)); if (!d2 || !Array.isArray(d2.alerts) || !Array.isArray(d2.cases)) throw new Error('shape');
          confirmDlg('Import this backup?', 'This replaces everything on this device with the contents of the file (' + d2.alerts.length + ' alerts, ' + d2.cases.length + ' cases).', 'Import', function () { DB = normalize(d2); UI.alert = null; UI.case = null; save(); render(); toast('Backup imported'); });
        } catch (err) { toast('That file is not a RegRadar cases backup'); }
      };
      rd.readAsText(t.files[0]);
    }
  });
  document.addEventListener('input', function (e) {
    var t = e.target, c;
    if (t.id === 'aq') { UI.f.q = t.value; var l = $('aitems'); if (l) l.innerHTML = alertItemsHtml(); return; }
    if (t.id === 'cq') { UI.cf.q = t.value; var l2 = $('citems'); if (l2) l2.innerHTML = caseItemsHtml(); return; }
    if (t.id === 'narrDraft') { c = caseById(UI.case); c.narr.edited = true; c.narr.draft = t.value; var ed = $('narrEdited'); if (ed) ed.hidden = false; updateNarrChecks(c); save(); return; }
    if (t.dataset.n && t.type !== 'checkbox' && t.tagName !== 'SELECT' && t.type !== 'date') { onNarrInput(t); return; }
    if (t.id === 'tl-type') return;
  });
  document.addEventListener('keydown', function (e) {
    var t = e.target;
    if (t.closest && t.closest('[role="tablist"]') && (e.key === 'ArrowRight' || e.key === 'ArrowLeft') && t.getAttribute('role') === 'tab') {
      var tabs = Array.prototype.slice.call(t.parentNode.querySelectorAll('[role="tab"]')), i = tabs.indexOf(t), n = tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
      e.preventDefault(); n.click(); var nt = $(n.id); if (nt) nt.focus(); return;
    }
    var it = t.closest && t.closest('.item'); if (!it) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var isAlert = !!it.dataset.alert, k = e.key;
    if (k === 'ArrowDown' || k === 'ArrowUp' || (isAlert && (k === 'j' || k === 'k'))) {
      e.preventDefault();
      var n2 = (k === 'ArrowDown' || k === 'j') ? it.nextElementSibling : it.previousElementSibling;
      if (n2 && n2.classList.contains('item')) { n2.focus(); if (isAlert) selectAlert(n2.dataset.alert, true, false); else selectCase(n2.dataset['case'], false); }
      return;
    }
    if (isAlert) {
      var a = alertById(it.dataset.alert); if (!a || !isOpenAlert(a)) return;
      if (k === 'e') { e.preventDefault(); selectAlert(a.id, false, false); dlgEscalate(a.id); }
      else if (k === 'c') { e.preventDefault(); selectAlert(a.id, false, false); dlgCloseAlert(a.id); }
      else if (k === 'a') { e.preventDefault(); a.assignee = DB.settings.me; alertLog(a, 'Assigned to ' + a.assignee + '.'); save(); afterAlertChange(a.id); toast('Assigned to you'); }
    }
  });
  window.toggleTheme = function () { var h = document.documentElement, t = h.dataset.theme === 'dark' ? 'light' : 'dark'; h.dataset.theme = t; try { localStorage.setItem('regradar-theme', t); } catch (e) { /* ignore */ } };

  /* ---------- boot ---------- */
  function getJSON(url) { return fetch(url, { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error(url); return r.json(); }).catch(function () { return null; }); }
  async function boot() {
    dlg = $('dlg');
    dlg.addEventListener('close', function () {
      var o = UI.opener; UI.opener = null;
      var pf = UI.pendingFocus ? document.querySelector(UI.pendingFocus) : null; UI.pendingFocus = null;
      if (pf) pf.focus();
      else if (o && document.contains(o) && o.focus) o.focus(); else { var h1 = document.querySelector('h1'); if (h1) { h1.tabIndex = -1; h1.focus(); } }
    });
    var r = await Promise.all([getJSON('data/cases-seed.json'), getJSON('data/cases-typologies.json'), getJSON('data/laws/32024R1624_EN.json'), getJSON('data/obligations.json')]);
    SEED = r[0]; if (r[1]) TYPO = r[1]; if (!TYPO.typologies.length) TYPO.typologies = [{ id: 'other', label: 'Other unusual activity', redFlags: [] }]; LAW = r[2]; OB = r[3] && r[3].obligations;
    buildQuotes();
    DB = loadDB();
    if (!DB) { DB = SEED ? hydrate(SEED) : emptyDB(); save(); }
    $('tipLink').innerHTML = lawLink('73', 'AMLR Art. 73(1)') + ' prohibits telling the customer or other third persons that a transaction or activity is being assessed or reported.';
    var p = new URLSearchParams(location.search);
    if (p.get('tab') === 'cases' || p.get('case')) UI.tab = 'cases';
    if (p.get('tab') === 'filings') UI.tab = 'filings';
    if (p.get('alert')) { UI.alert = p.get('alert'); UI.f.status = 'all'; UI.mdet = true; }
    if (p.get('case')) { UI.case = p.get('case'); UI.cf.status = 'all'; UI.mdet = true; }
    if (p.get('sub') && SUBS.some(function (s) { return s[0] === p.get('sub'); })) UI.csub = p.get('sub');
    render();
  }
  boot();
})();
