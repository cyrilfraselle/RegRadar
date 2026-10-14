/* ═══════════════════════════════════════════════════════════════
   RegRadar — shared controls data layer

   Loads the seeded controls library (docs/data/controls.json) and
   overlays a device-local workspace on top: controls the viewer adds,
   edits to any control, obligation↔control links they draw or remove,
   and a log of control tests. Same device-local pattern as
   regradar-obligations-mine; swap `loadLocal/saveLocal` for a backend
   later without touching the pages.
   ═══════════════════════════════════════════════════════════════ */
window.ControlsData = (function () {
  var LKEY = "regradar-controls-mine";
  var EMPTY = function () { return { extra: [], extraMappings: {}, removedMappings: {}, overrides: {}, tests: {} }; };

  function loadLocal() {
    try {
      var m = JSON.parse(localStorage.getItem(LKEY) || "null");
      return Object.assign(EMPTY(), m || {});
    } catch (e) { return EMPTY(); }
  }
  function saveLocal(d) { try { localStorage.setItem(LKEY, JSON.stringify(d)); } catch (e) {} }
  function has(arr, v) { return arr.indexOf(v) !== -1; }

  async function load() {
    var res = await fetch("data/controls.json", { cache: "no-store" });
    var base = await res.json();
    var local = loadLocal();
    var controls = base.controls.map(function (c) {
      return Object.assign({}, c, { obligation_ids: (c.obligation_ids || []).slice() });
    }).concat(local.extra.map(function (c) {
      return Object.assign({}, c, { source: "local", obligation_ids: (c.obligation_ids || []).slice() });
    }));
    var byId = {}; controls.forEach(function (c) { byId[c.id] = c; });
    controls.forEach(function (c) { Object.assign(c, local.overrides[c.id] || {}); });
    Object.keys(local.extraMappings || {}).forEach(function (obId) {
      (local.extraMappings[obId] || []).forEach(function (cid) {
        var c = byId[cid];
        if (c && !has(c.obligation_ids, obId)) c.obligation_ids.push(obId);
      });
    });
    Object.keys(local.removedMappings || {}).forEach(function (obId) {
      (local.removedMappings[obId] || []).forEach(function (cid) {
        var c = byId[cid];
        if (c) c.obligation_ids = c.obligation_ids.filter(function (x) { return x !== obId; });
      });
    });
    return { meta: base._meta, controls: controls, tests: local.tests || {} };
  }

  function addControl(control) {
    var local = loadLocal();
    local.extra.push(control);
    saveLocal(local);
    return control;
  }

  function updateControl(cid, patch) {
    var local = loadLocal();
    var ex = local.extra.filter(function (c) { return c.id === cid; })[0];
    if (ex) Object.assign(ex, patch);
    else local.overrides[cid] = Object.assign(local.overrides[cid] || {}, patch);
    saveLocal(local);
  }

  function removeControl(cid) {
    var local = loadLocal();
    local.extra = local.extra.filter(function (c) { return c.id !== cid; });
    Object.keys(local.extraMappings).forEach(function (k) {
      local.extraMappings[k] = local.extraMappings[k].filter(function (x) { return x !== cid; });
    });
    delete local.tests[cid];
    saveLocal(local);
  }

  function mapControl(obligationId, controlId) {
    var local = loadLocal();
    local.extraMappings[obligationId] = local.extraMappings[obligationId] || [];
    if (!has(local.extraMappings[obligationId], controlId)) local.extraMappings[obligationId].push(controlId);
    if (local.removedMappings[obligationId]) {
      local.removedMappings[obligationId] = local.removedMappings[obligationId].filter(function (x) { return x !== controlId; });
    }
    saveLocal(local);
  }

  function unmapControl(obligationId, controlId) {
    var local = loadLocal();
    if (local.extraMappings[obligationId]) {
      local.extraMappings[obligationId] = local.extraMappings[obligationId].filter(function (x) { return x !== controlId; });
    }
    local.removedMappings[obligationId] = local.removedMappings[obligationId] || [];
    if (!has(local.removedMappings[obligationId], controlId)) local.removedMappings[obligationId].push(controlId);
    saveLocal(local);
  }

  function recordTest(cid, result, note) {
    var local = loadLocal();
    var date = new Date().toISOString().slice(0, 10);
    local.tests[cid] = local.tests[cid] || [];
    local.tests[cid].unshift({ date: date, result: result, note: note || "" });
    var patch = { last_tested: date, effectiveness: result };
    var ex = local.extra.filter(function (c) { return c.id === cid; })[0];
    if (ex) Object.assign(ex, patch);
    else local.overrides[cid] = Object.assign(local.overrides[cid] || {}, patch);
    saveLocal(local);
    return date;
  }

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

  var FREQ_DAYS = { "Monthly": 30, "Quarterly": 91, "Annual": 365 };

  function nextDue(control) {
    var days = FREQ_DAYS[control.frequency];
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
