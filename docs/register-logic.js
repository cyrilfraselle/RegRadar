/* Register Kanban logic: which column an obligation sits in, which moves are allowed, and how a move is saved.
   Columns follow the gap view: "Controlled and tested" is the gap view's covered_tested (GapLogic), so
   covered means an approved control with an owner AND a recorded test. Handling choices (applicable,
   owned, not applicable) are kept in the data spine (rr-core.js) as one setting per obligation, so each
   change is an event in the append-only log. Pure, no DOM; works in the browser and in Node. */
(function (root, factory) {
  var m = factory(typeof require === 'function' && typeof module === 'object' ? require('./gap-logic.js') : root.GapLogic);
  if (typeof module === 'object' && module.exports) module.exports = m; else root.RegisterLogic = m;
})(typeof self !== 'undefined' ? self : this, function (GapLogic) {
  'use strict';
  var COLS = [
    { id: 'not_assessed', label: 'Not assessed', hint: 'Nobody has looked at it yet' },
    { id: 'applicable', label: 'Applicable', hint: 'Applies to the firm, no owner yet' },
    { id: 'owned', label: 'Owned', hint: 'A named person is responsible' },
    { id: 'controlled', label: 'Controlled and tested', hint: 'Approved control, owner and a recorded test' },
    { id: 'na', label: 'Not applicable', hint: 'Does not apply to the firm' }
  ];
  var RANK = { not_assessed: 0, applicable: 1, owned: 2 };
  var KEY = 'register.status.';
  function colLabel(id) { for (var i = 0; i < COLS.length; i++) if (COLS[i].id === id) return COLS[i].label; return id; }

  /* ---- saved handling choice (spine setting) ---- */
  function recOf(spine, id) { var r = spine && spine.getSetting ? spine.getSetting(KEY + id) : null; return r && typeof r === 'object' ? r : null; }
  /* Not applicable: the register's own choice wins; the workspace's old "dismissed" list only counts when the register has no choice yet. */
  function isNA(spine, id, legacyDismissed) { var r = recOf(spine, id); return r ? r.status === 'na' : !!legacyDismissed; }

  /* ---- classification ---- */
  function artNum(o) { var m = (o.source_url || '').match(/art=(\d+)/); return m ? +m[1] : +((o.legal_basis || '').match(/(\d+)/) || [])[1] || 0; }
  function shortTitle(o) {
    var w = (o.what || '').trim(), first = w.split(/(?<=[.;:])\s/)[0] || w;
    return first.length > 110 ? first.slice(0, 107) + '…' : first;
  }
  /* ctx: { controls, cfg, isOverdue, spine, legacyDismissed(id) } */
  function classify(o, ctx) {
    var rec = recOf(ctx.spine, o.id), cs = GapLogic.ctlsFor(ctx.controls, o.id), cfg = ctx.cfg || GapLogic.DEFAULT_CFG;
    var legacy = ctx.legacyDismissed ? !!ctx.legacyDismissed(o.id) : false;
    var ctlOwner = ''; cs.forEach(function (c) { if (!ctlOwner && (c.owner || '').trim()) ctlOwner = c.owner.trim(); });
    var owner = ((rec && rec.owner) || '').trim() || ctlOwner;
    var gap = GapLogic.statusOf(o, ctx.controls, cfg, ctx.isOverdue, false);
    var floor = ctlOwner ? 'owned' : cs.length ? 'applicable' : 'not_assessed';
    var declared = rec && RANK[rec.status] != null ? rec.status : 'not_assessed';
    if (declared === 'owned' && !owner) declared = 'applicable';
    var col;
    if (rec ? rec.status === 'na' : legacy) col = 'na';
    else if (gap === 'covered_tested') col = 'controlled';
    else col = RANK[declared] >= RANK[floor] ? declared : floor;
    return { o: o, id: o.id, col: col, floor: floor, gap: gap, owner: owner, ownerIsOwn: !!(rec && rec.owner), controls: cs, ctlCount: cs.length };
  }
  function buildCards(obls, ctx) { return (obls || []).map(function (o) { return classify(o, ctx); }); }
  function group(cards) {
    var g = {}; COLS.forEach(function (c) { g[c.id] = []; });
    cards.forEach(function (c) { g[c.col].push(c); });
    COLS.forEach(function (c) { g[c.id].sort(function (a, b) { return artNum(a.o) - artNum(b.o) || (a.id < b.id ? -1 : 1); }); });
    return g;
  }
  function filterCards(cards, f) {
    f = f || {};
    return cards.filter(function (c) {
      var o = c.o;
      if (f.topic && (o.topic || 'Other') !== f.topic) return false;
      if (f.who && (o.who || []).indexOf(f.who) === -1) return false;
      if (f.priority && (o.priority || o.criticality || '') !== f.priority) return false;
      if (f.owner === '__none') return !c.owner;
      if (f.owner && c.owner !== f.owner) return false;
      return true;
    });
  }

  /* ---- transitions ---- */
  /* Returns { ok } or { ok:false, reason } or { ok:true, needsOwner:true } when an owner must be named first. */
  function canMove(card, to) {
    if (!card || !card.id) return { ok: false, reason: 'Unknown obligation.' };
    if (card.col === to) return { ok: false, reason: '' };
    if (to === 'controlled') return { ok: false, reason: 'This column is automatic. It needs an approved control with an owner and a recorded test: add or test the control in Controls.' };
    if (to === 'na') return { ok: true };
    if (card.col === 'controlled') return { ok: false, reason: 'A tested control covers this obligation. Change the control, or move the card to Not applicable.' };
    if (RANK[to] == null) return { ok: false, reason: 'Unknown column.' };
    if (card.col !== 'na' && RANK[to] < RANK[card.floor]) return { ok: false, reason: 'A control is already mapped to this obligation, so it cannot go back to ' + colLabel(to) + '.' };
    if (to === 'owned' && !card.owner) return { ok: true, needsOwner: true };
    return { ok: true };
  }
  /* Save a move. opts.owner names the owner (required when canMove says needsOwner). Throws on a refused move. */
  function move(spine, card, to, opts) {
    opts = opts || {};
    var chk = canMove(card, to);
    if (!chk.ok) throw new Error(chk.reason || 'Move not allowed.');
    var owner = (opts.owner != null ? String(opts.owner) : (card.ownerIsOwn ? card.owner : '')).trim();
    if (to === 'owned' && !owner && !card.owner) throw new Error('Name an owner first.');
    var prev = recOf(spine, card.id) || {};
    var next = { status: to, at: spine.today ? spine.today() : null };
    if (owner) next.owner = owner; else if (to === 'owned' && card.owner) next.owner = card.owner;
    if (to === 'owned' && prev.owner && !owner) next.owner = prev.owner;
    spine.setSetting(KEY + card.id, next);
    return next;
  }
  /* Change only the owner, keeping the column. */
  function setOwner(spine, card, owner) {
    owner = String(owner || '').trim();
    var prev = recOf(spine, card.id) || { status: card.col === 'owned' || card.col === 'controlled' ? 'owned' : card.col === 'na' ? 'na' : card.col };
    var st = prev.status === 'na' ? 'na' : (owner ? 'owned' : (RANK[prev.status] != null && prev.status !== 'owned' ? prev.status : 'applicable'));
    var next = { status: st, at: spine.today ? spine.today() : null };
    if (owner) next.owner = owner;
    spine.setSetting(KEY + card.id, next);
    return next;
  }
  return { COLS: COLS, KEY: KEY, colLabel: colLabel, recOf: recOf, isNA: isNA, artNum: artNum, shortTitle: shortTitle,
    classify: classify, buildCards: buildCards, group: group, filterCards: filterCards, canMove: canMove, move: move, setOwner: setOwner };
});
