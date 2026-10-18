/* ═══════════════════════════════════════════════════════════════
   RegRadar — shared controls data layer

   The controls library, on the data spine (docs/rr-core.js): controls
   are 'control' records, obligation links are typed links, test records
   are 'test' records with a note and evidence, and every change is an
   event in the log. The interface below is unchanged for callers; the
   storage lives in docs/controls-store.js. The shipped library
   (docs/data/controls.json) is imported once, together with whatever this
   device kept under the old key 'regradar-controls-mine' (left as a
   backup). Call load() first: it opens the spine, and the mutators below
   work on it afterwards.
   ═══════════════════════════════════════════════════════════════ */
window.ControlsData = (function () {
  var LKEY = "regradar-controls-mine";   // the old device-local key: imported once into the spine, kept as a backup, no longer written
  var SELF = (document.currentScript && document.currentScript.src) || "";
  var STALE = false;

  function has(arr, v) { return arr.indexOf(v) !== -1; }

  /* The spine (docs/rr-core.js) is opened once per page: pages that already booted it share their instance,
     so there is one event log writer per page. rr-core.js is loaded here if the page did not include it. */
  function dirOf() { return SELF.replace(/[?#].*$/, "").replace(/[^\/]*$/, ""); }
  function ensureRR() {
    if (window.RR) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var el = document.createElement("script");
      el.src = dirOf() + "rr-core.js" + (SELF.indexOf("?") !== -1 ? SELF.slice(SELF.indexOf("?")) : "");
      el.onload = resolve; el.onerror = function () { reject(new Error("rr-core.js could not be loaded")); };
      document.head.appendChild(el);
    });
  }
  function onExternal() { STALE = true; }
  async function spine() {
    await ensureRR();
    if (!window.RR.current || !window.ControlsStore || STALE) { STALE = false; await window.RR.boot({ onExternalChange: onExternal }); }
    return window.RR.current;
  }
  function sp() {
    if (!window.RR || !window.RR.current || !window.ControlsStore) throw new Error("ControlsData.load() must finish before controls are changed.");
    return window.RR.current;
  }

  async function load() {
    var res = await fetch("data/controls.json", { cache: "no-store" });
    var base = await res.json();
    var s = await spine();
    window.ControlsStore.syncLibrary(s, base);       // library controls the repo gained since this device last looked
    var r = window.ControlsStore.read(s);
    return { meta: base._meta, controls: r.controls, tests: r.tests };
  }

  function addControl(control) { window.ControlsStore.addControl(sp(), control); return control; }
  function updateControl(cid, patch) { window.ControlsStore.updateControl(sp(), cid, patch); }
  function removeControl(cid) { window.ControlsStore.removeControl(sp(), cid); }
  function mapControl(obligationId, controlId) { window.ControlsStore.mapControl(sp(), obligationId, controlId); }
  function unmapControl(obligationId, controlId) { window.ControlsStore.unmapControl(sp(), obligationId, controlId); }
  function recordTest(cid, result, note, evidence) { return window.ControlsStore.recordTest(sp(), cid, result, note, evidence); }

  function coverage(obligations, controls) {
    var byObligation = {};
    obligations.forEach(function (o) {
      byObligation[o.id] = controls.filter(function (c) { return has(c.obligation_ids || [], o.id); }).map(function (c) { return c.id; });
    });
    var mappedCount = obligations.filter(function (o) { return byObligation[o.id].length > 0; }).length;
    var byTopic = {};
    obligations.forEach(function (o) {
      var t = o.topic || "Other";
      byTopic[t] = byTopic[t] || { mapped: 0, total: 0 };
      byTopic[t].total++;
      if (byObligation[o.id].length > 0) byTopic[t].mapped++;
    });
    return { byObligation: byObligation, mappedCount: mappedCount, total: obligations.length, byTopic: byTopic };
  }

  var FREQ_DAYS = { "Monthly": 30, "Quarterly": 91, "Annual": 365 };   // used until the spine's config is available

  function nextDue(control) {
    var cfg = window.RR && window.RR.current ? window.RR.current.config().control_frequency_days : null;
    var days = (cfg || FREQ_DAYS)[control.frequency];
    if (!days || !control.last_tested) return null;
    var d = new Date(control.last_tested);
    d.setDate(d.getDate() + days);
    return d;
  }
  function isOverdue(control, today) {
    var due = nextDue(control);
    return !!(due && due < today);
  }

  return { load: load, addControl: addControl, updateControl: updateControl, removeControl: removeControl,
    mapControl: mapControl, unmapControl: unmapControl, recordTest: recordTest,
    coverage: coverage, nextDue: nextDue, isOverdue: isOverdue, LKEY: LKEY };
})();
