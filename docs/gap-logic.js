/* Coverage logic shared by the gap view (gaps.js) and the register Kanban (register.js).
   One definition of "covered": a control that is approved, owned (if required) and tested (if required).
   Pure functions, no DOM. Works in the browser (window.GapLogic) and in Node tests (require). */
(function (root, factory) {
  var m = factory();
  if (typeof module === 'object' && module.exports) module.exports = m; else root.GapLogic = m;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var DEFAULT_CFG = { needOwner: true, needTest: true, overdueIsUntested: true };
  function ctlsFor(controls, id) { return (controls || []).filter(function (c) { return (c.obligation_ids || []).indexOf(id) !== -1; }); }
  /* 2 tested, 1 in place but untested, 0 not in place. isOverdue(control) is supplied by the caller. */
  function ctlState(c, cfg, isOverdue) {
    if (c.status !== 'approved') return 0;
    if (cfg.needOwner && !(c.owner || '').trim()) return 0;
    var tested = !!c.last_tested;
    if (tested && cfg.overdueIsUntested && isOverdue && isOverdue(c)) tested = false;
    return (tested || !cfg.needTest) ? 2 : 1;
  }
  /* covered_tested | covered_untested | partly | not_covered | na */
  function statusOf(o, controls, cfg, isOverdue, dismissed) {
    if (dismissed) return 'na';
    var cs = ctlsFor(controls, o.id);
    if (!cs.length) return 'not_covered';
    var best = Math.max.apply(null, cs.map(function (c) { return ctlState(c, cfg, isOverdue); }));
    return best === 2 ? 'covered_tested' : best === 1 ? 'covered_untested' : 'partly';
  }
  return { DEFAULT_CFG: DEFAULT_CFG, ctlsFor: ctlsFor, ctlState: ctlState, statusOf: statusOf };
});
