/* ═══════════════════════════════════════════════════════════════
   RegRadar — shared controls data layer

   Loads the seeded controls library (docs/data/controls.json) and
   overlays a device-local workspace (new controls the viewer adds,
   and obligation↔control links they draw) on top — same
   device-local personalization pattern as regradar-obligations-mine.
   Used by controls.html, dashboard.html and obligations.html so the
   three stay in sync without a backend.
   ═══════════════════════════════════════════════════════════════ */
window.ControlsData = (function () {
  var LKEY = "regradar-controls-mine";

  function loadLocal() {
    try {
      var m = JSON.parse(localStorage.getItem(LKEY) || "null");
      return Object.assign({ extra: [], extraMappings: {} }, m || {});
    } catch (e) { return { extra: [], extraMappings: {} }; }
  }
  function saveLocal(d) { try { localStorage.setItem(LKEY, JSON.stringify(d)); } catch (e) {} }

  async function load() {
    var res = await fetch("data/controls.json", { cache: "no-store" });
    var base = await res.json();
    var local = loadLocal();
    var controls = base.controls.map(function (c) {
      return Object.assign({}, c, { obligation_ids: (c.obligation_ids || []).slice() });
    }).concat(local.extra.map(function (c) {
      return Object.assign({}, c, { source: "local" });
    }));
    var byId = {}; controls.forEach(function (c) { byId[c.id] = c; });
    Object.keys(local.extraMappings || {}).forEach(function (obId) {
      (local.extraMappings[obId] || []).forEach(function (cid) {
        var c = byId[cid];
        if (c && c.obligation_ids.indexOf(obId) === -1) c.obligation_ids.push(obId);
      });
    });
    return { meta: base._meta, controls: controls };
  }

  function addControl(control) {
    var local = loadLocal();
    local.extra.push(control);
    saveLocal(local);
    return control;
  }

  function mapControl(obligationId, controlId) {
    var local = loadLocal();
    local.extraMappings = local.extraMappings || {};
    local.extraMappings[obligationId] = local.extraMappings[obligationId] || [];
    if (local.extraMappings[obligationId].indexOf(controlId) === -1) local.extraMappings[obligationId].push(controlId);
    saveLocal(local);
  }

  function unmapControl(obligationId, controlId) {
    var local = loadLocal();
    if (local.extraMappings && local.extraMappings[obligationId]) {
      local.extraMappings[obligationId] = local.extraMappings[obligationId].filter(function (id) { return id !== controlId; });
    }
    saveLocal(local);
  }

  /* coverage: which controls map to each obligation, grouped by topic */
  function coverage(obligations, controls) {
    var byObligation = {};
    obligations.forEach(function (o) {
      byObligation[o.id] = controls.filter(function (c) { return (c.obligation_ids || []).indexOf(o.id) !== -1; }).map(function (c) { return c.id; });
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

  var FREQ_DAYS = { "Monthly": 30, "Quarterly": 91, "Annual": 365 };

  function nextDue(control, today) {
    var days = FREQ_DAYS[control.frequency];
    if (!days || !control.last_tested) return null;
    var d = new Date(control.last_tested);
    d.setDate(d.getDate() + days);
    return d;
  }
  function isOverdue(control, today) {
    var due = nextDue(control, today);
    return !!(due && due < today);
  }

  return { load: load, addControl: addControl, mapControl: mapControl, unmapControl: unmapControl,
    coverage: coverage, nextDue: nextDue, isOverdue: isOverdue, LKEY: LKEY };
})();
