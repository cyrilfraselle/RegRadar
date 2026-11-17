/* Lab 001: Inspection pack. Read-only: never writes to any storage. */
(function () {
  'use strict';
  var TODAY = new Date().toISOString().slice(0, 10);
  function $(id) { return document.getElementById(id); }
  function get(key) { try { var r = localStorage.getItem(key); return r ? JSON.parse(r) : null; } catch (e) { return null; } }
  function arr(x) { return Array.isArray(x) ? x : []; }
  function ago(d) { var t = new Date(); t.setDate(t.getDate() + d); return t.toISOString().slice(0, 10); }

  /* Each reader returns {state:'ok'|'gap'|'nodata', detail, gaps:[text]} or null when no data. */
  var SECTIONS = [
    { id: 'bwra', name: 'Business-wide risk assessment', href: '../../risk-assessment.html', key: 'regradar-bwra', rule: 'Evidenced when approved by a named person.',
      read: function (d) { var s = d && d.signoff; if (!s) return null;
        if (s.approvedBy && s.approvedOn) return { state: 'ok', detail: 'Approved by ' + s.approvedBy + ' on ' + s.approvedOn + '.' };
        return { state: 'gap', detail: 'An assessment exists but is not approved.', gaps: ['BWRA never approved'] }; } },
    { id: 'cra', name: 'Customer risk assessments', href: '../../customer-risk.html', key: 'regradar-cra', rule: 'Evidenced when customers are assessed and none has an overdue review.',
      read: function (d) { var c = d && arr(d.customers); if (!c) return null;
        var od = c.filter(function (x) { var n = x && (x.next_review || x.nextReview); return n && String(n).slice(0, 10) < TODAY; }).length;
        if (!c.length) return { state: 'gap', detail: 'No customers assessed.', gaps: ['No customer risk assessments recorded'] };
        return od ? { state: 'gap', detail: c.length + ' customers, ' + od + ' overdue.', gaps: [od + ' customer review' + (od > 1 ? 's' : '') + ' overdue'] } : { state: 'ok', detail: c.length + ' customers assessed, none overdue.' }; } },
    { id: 'pol', name: 'Policies and procedures', href: '../../policies.html', key: 'regradar-policies', rule: 'Evidenced when every policy has an approved version.',
      read: function (d) { var p = d && arr(d.policies); if (!p) return null;
        var no = p.filter(function (x) { return !arr(x.versions).some(function (v) { return v.status === 'approved'; }); }).length;
        if (!p.length) return { state: 'gap', detail: 'No policies recorded.', gaps: ['No policies in the library'] };
        return no ? { state: 'gap', detail: p.length + ' policies, ' + no + ' without an approved version.', gaps: [no + ' polic' + (no > 1 ? 'ies' : 'y') + ' without an approved version'] } : { state: 'ok', detail: p.length + ' policies, all with an approved version.' }; } },
    { id: 'ctl', name: 'Controls and tests', href: '../../controls.html', key: 'regradar-controls-mine', rule: 'Evidenced when you have recorded your own controls.',
      read: function (d) { if (!d) return null; var n = arr(d.mine || d.controls).length;
        return n ? { state: 'ok', detail: n + ' own controls recorded.' } : { state: 'gap', detail: 'No own controls recorded.', gaps: ['No controls mapped to obligations'] }; } },
    { id: 'act', name: 'Issues and actions', href: '../../actions.html', key: 'regradar-actions', rule: 'Evidenced when no open issue is past its due date.',
      read: function (d) { var i = d && arr(d.issues); if (!i) return null;
        var od = i.filter(function (x) { return x.status !== 'closed' && x.due_on && x.due_on < TODAY; }).length;
        return od ? { state: 'gap', detail: i.length + ' issues, ' + od + ' overdue.', gaps: [od + ' open issue' + (od > 1 ? 's' : '') + ' overdue'] } : { state: 'ok', detail: i.length + ' issues tracked, none overdue.' }; } },
    { id: 'cas', name: 'Alerts and cases', href: '../../cases.html', key: 'regradar-cases', rule: 'Evidenced when there is no unassigned alert backlog (open alerts without a case).',
      read: function (d) { if (!d || !Array.isArray(d.cases)) return null; var al = arr(d.alerts);
        var open = al.filter(function (a) { return a.status === 'open' || a.status === 'new'; }).length;
        return open ? { state: 'gap', detail: d.cases.length + ' cases, ' + open + ' alerts still open.', gaps: [open + ' alert' + (open > 1 ? 's' : '') + ' not yet triaged'] } : { state: 'ok', detail: d.cases.length + ' cases, no open alerts.' }; } },
    { id: 'trn', name: 'Staff training', href: '../../academy.html', key: 'regradar-academy-progress', rule: 'Evidenced when any training completion is recorded on this device.',
      read: function (d) { if (!d) return null; var n = Object.keys(d).length;
        return n ? { state: 'ok', detail: 'Training progress recorded (' + n + ' entries).' } : { state: 'gap', detail: 'No training recorded.', gaps: ['No training recorded this year'] }; } },
    { id: 'imp', name: 'Regulatory change log', href: '../../impact.html', key: 'regradar-impact', rule: 'Evidenced when at least one regulatory change has been assessed.',
      read: function (d) { if (!d) return null; var n = arr(d.items || d.assessments || d.assessed).length || Object.keys(d).length;
        return n ? { state: 'ok', detail: 'Impact assessments recorded.' } : { state: 'gap', detail: 'Nothing assessed.', gaps: ['No regulatory change assessed'] }; } }
  ];

  var DEMO = {
    bwra: { signoff: { approvedBy: '', approvedOn: '' } },
    cra: { customers: [{ next_review: ago(-20) }, { next_review: ago(-3) }, { next_review: ago(200) }] },
    pol: { policies: [{ versions: [{ status: 'approved' }] }, { versions: [{ status: 'in_review' }] }, { versions: [{ status: 'draft' }] }] },
    ctl: { mine: [{}, {}, {}, {}] },
    act: { issues: [{ status: 'open', due_on: ago(-10) }, { status: 'closed', due_on: ago(-40) }] },
    cas: { cases: [{}], alerts: [{ status: 'open' }, { status: 'closed' }] },
    trn: {},
    imp: { items: [{}] }
  };

  var mode = 'real';
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function compute() {
    return SECTIONS.map(function (s) {
      var raw = mode === 'demo' ? DEMO[s.id] : get(s.key), r = null;
      try { r = s.read(raw); } catch (e) { r = null; }
      return { s: s, r: r || { state: 'nodata', detail: 'No data found on this device for this module.', gaps: [s.name + ': no data yet'] } };
    });
  }

  function render() {
    var rows = compute(), anyReal = rows.some(function (x) { return x.r.state !== 'nodata'; });
    if (mode === 'real' && !anyReal) { mode = 'demo'; rows = compute(); $('srcNote').textContent = 'Nothing found on this device yet, so demo data is shown. Use the modules, then come back and choose "This device".'; }
    else $('srcNote').textContent = mode === 'demo' ? 'Showing clearly fictional demo data (CF Bank).' : 'Reading this device only. Nothing is sent anywhere.';
    $('srcReal').setAttribute('aria-pressed', String(mode === 'real'));
    $('srcDemo').setAttribute('aria-pressed', String(mode === 'demo'));
    $('cvFirm').textContent = mode === 'demo' ? 'CF Bank (fictional)' : ((get('regradar-bwra') || {}).firm || {}).name || 'Firm name not set';
    $('cvDate').textContent = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    $('cvData').textContent = mode === 'demo' ? 'Demo data' : 'Device-local data from RegRadar modules';
    var gaps = [];
    rows.forEach(function (x) { arr(x.r.gaps).forEach(function (g) { gaps.push({ g: g, href: x.s.href, name: x.s.name }); }); });
    $('gaps').innerHTML = gaps.length ? '<div class="gaps"><ul>' + gaps.map(function (g) { return '<li><span>' + esc(g.g) + '</span><a class="go" href="' + g.href + '">Open ' + esc(g.name) + '</a></li>'; }).join('') + '</ul></div>' : '<p class="empty">Nothing missing under the default rules.</p>';
    var lbl = { ok: 'Evidenced', gap: 'Gap', nodata: 'No data' };
    $('secs').innerHTML = rows.map(function (x) { return '<li><span class="n">' + esc(x.s.name) + '</span><span class="pill ' + x.r.state + '">' + lbl[x.r.state] + '</span><span class="d">' + esc(x.r.detail) + ' Rule (default, configure for your firm): ' + esc(x.s.rule) + '</span><span class="src">source key: ' + esc(x.s.key) + '</span><a class="go" href="' + x.s.href + '">Open module</a></li>'; }).join('');
  }

  $('srcReal').addEventListener('click', function () { mode = 'real'; render(); });
  $('srcDemo').addEventListener('click', function () { mode = 'demo'; render(); });
  $('printBtn').addEventListener('click', function () { window.print(); });
  render();
})();
