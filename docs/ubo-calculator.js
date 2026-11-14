/* UBO calculator: engine and page logic (no libraries, no network except
   same-origin examples).

   Teaching tool for beneficial ownership under the AMLR, Regulation (EU)
   2024/1624, Arts 51 to 54. The engine is pure (no DOM) and works in the
   browser (window.UBO) and in node (module.exports), so tests/ubo.test.mjs
   checks the arithmetic, the Art. 54 rule and every legal extract against
   docs/data/laws/32024R1624_EN.json.

   Model: { parties:[{id,name,type:'person'|'entity'}],
            holdings:[{from,to,pct}],            // from holds pct % of to
            controls:[{from,to,basis}],           // control by other means
            customer:id, threshold:25 }

   Reading of the law (see the page note, needs a legal fact-check):
   - Art. 52(1): 25 % or more, indirect holdings multiplied along each chain,
     chains and direct holdings of the same person added.
   - Art. 53(2)(c): control through ownership = more than 50 % ("50 % plus one").
   - Art. 53(3), (4): control by other means, flagged by the user.
   - Art. 54: applies to the customer's direct holders. A holder entity Y is
     treated under Art. 54 when ownership interest and control coexist at
     different layers (Y holds 25 % or more of the customer or controls it, and
     Y is controlled by someone or controls the customer). Then multiplication
     through Y is excluded; the natural persons who control Y (54(a)) and, where
     Y controls the customer, the persons with an ownership interest in Y (54(b))
     are beneficial owners. */
(function (root) {
  'use strict';

  var CELEX = '32024R1624';
  var EPS = 1e-9;

  /* ── verbatim extracts (checked by tests/ubo.test.mjs against the law JSON) ── */
  var EXTRACTS = {
    A51a: { art: '51', label: 'Art. 51(1)(a)', text: 'have, directly or indirectly, an ownership interest in the corporate entity' },
    A51b: { art: '51', label: 'Art. 51(1)(b)', text: 'control, directly or indirectly, the corporate or other legal entity, through ownership interest or via other means' },
    A51p: { art: '51', label: 'Art. 51, second paragraph', text: 'Control via other means as referred to in the first paragraph, point (b), shall be identified independently of and in parallel to the existence of an ownership interest or control through ownership interest.' },
    A52a: { art: '52', label: 'Art. 52(1), first subparagraph', text: '‘an ownership interest in the corporate entity’ shall mean direct or indirect ownership of 25 % or more of the shares or voting rights or other ownership interest in the corporate entity' },
    A52m: { art: '52', label: 'Art. 52(1), first subparagraph', text: 'The indirect ownership shall be calculated by multiplying the shares or voting rights or other ownership interests held by the intermediate entities in the chain of entities in which the beneficial owner holds shares or voting rights and by adding together the results from those various chains, unless Article 54 applies.' },
    A52b: { art: '52', label: 'Art. 52(1), second subparagraph', text: 'For the purposes of assessing whether an ownership interest exists in the corporate entity, all shareholdings on every level of ownership shall be taken into account.' },
    A52l: { art: '52', label: 'Art. 52(2)', text: 'The lower threshold referred to in the first subparagraph shall be set at a maximum of 15 % of ownership interest in the corporate entity' },
    A53b: { art: '53', label: 'Art. 53(2)(b)', text: '‘indirect control of a legal entity’ means control of intermediate legal entities in the ownership structure or in various chains of the ownership structure, where the direct control is identified on each level of the structure' },
    A53c: { art: '53', label: 'Art. 53(2)(c)', text: '‘control through ownership interest of the corporate entity’ means direct or indirect ownership of 50 % plus one of the shares or voting rights or other ownership interest in the corporate entity' },
    A53_3a: { art: '53', label: 'Art. 53(3)(a)', text: 'the majority of the voting rights in the corporate entity, whether or not shared by persons acting in concert' },
    A53_3b: { art: '53', label: 'Art. 53(3)(b)', text: 'the right to appoint or remove a majority of the members of the board or the administrative, management or supervisory body or similar officers of the legal entity' },
    A53_3c: { art: '53', label: 'Art. 53(3)(c)', text: 'relevant veto rights or decision rights attached to the share of the corporate entity' },
    A53_3d: { art: '53', label: 'Art. 53(3)(d)', text: 'decisions regarding distribution of profit of the legal entity or leading to a shift in assets in the legal entity' },
    A53_4a: { art: '53', label: 'Art. 53(4)(a)', text: 'formal or informal agreements with owners, members or the legal entities, provisions in the articles of association, partnership agreements, syndication agreements, or equivalent documents or agreements depending on the specific characteristics of the legal entity, as well as voting arrangements' },
    A53_4b: { art: '53', label: 'Art. 53(4)(b)', text: 'relationships between family members' },
    A53_4c: { art: '53', label: 'Art. 53(4)(c)', text: 'use of formal or informal nominee arrangements' },
    A54: { art: '54', label: 'Art. 54, introduction', text: 'Where corporate entities are owned through a multi-layered ownership structure, and in one or more chains of that structure the ownership interest and the control coexist in relation to different layers of the chain, the beneficial owners shall be:' },
    A54a: { art: '54', label: 'Art. 54(a)', text: 'the natural persons who control, directly or indirectly, through ownership interest or via other means, legal entities that have a direct ownership interest in the corporate entity, whether individually or cumulatively;' },
    A54b: { art: '54', label: 'Art. 54(b)', text: 'the natural persons who, whether individually or cumulatively, directly or indirectly, have an ownership interest in the corporate entity that controls, through ownership interest or via other means, the corporate entity, directly or indirectly.' },
    A22: { art: '22', label: 'Art. 22(2), second subparagraph', text: 'Where, after having exhausted all possible means of identification, no natural persons are identified as beneficial owners, or where there are doubts that the persons identified are the beneficial owners, obliged entities shall record that no beneficial owner was identified and identify all the natural persons holding the positions of senior managing officials in the legal entity and shall verify their identity.' }
  };

  var BASIS = {
    voting:    { label: 'holds the majority of the voting rights', key: 'A53_3a' },
    board:     { label: 'has the right to appoint or remove a majority of the board or similar body', key: 'A53_3b' },
    veto:      { label: 'holds relevant veto rights or decision rights attached to the shares', key: 'A53_3c' },
    profit:    { label: 'decides on the distribution of profit or on a shift in assets', key: 'A53_3d' },
    agreement: { label: 'controls through agreements, articles of association or voting arrangements', key: 'A53_4a' },
    family:    { label: 'controls through relationships between family members', key: 'A53_4b' },
    nominee:   { label: 'controls through formal or informal nominee arrangements', key: 'A53_4c' }
  };
  var BASIS_ORDER = ['board', 'voting', 'veto', 'profit', 'agreement', 'family', 'nominee'];

  function lawHref(art) { return 'law.html?celex=' + CELEX + '&art=' + art; }

  /* ── numbers ───────────────────────────────────────────────────── */
  function r9(x) { return Math.round(x * 1e9) / 1e9; }
  function fmt(x) { return String(Math.round(x * 10000) / 10000) + '%'; }
  function ge(a, b) { return a >= b - EPS; }

  /* ── validation: impossible inputs ─────────────────────────────── */
  function validate(model) {
    var out = [];
    var nodes = {};
    (model.parties || []).forEach(function (p) { nodes[p.id] = p; });
    function nm(id) { return nodes[id] ? (nodes[id].name || '(unnamed)') : '(unknown)'; }

    if (!model.customer || !nodes[model.customer]) {
      out.push({ level: 'error', code: 'no-customer', msg: 'Pick the customer: the legal entity whose beneficial owners you want to find.' });
    } else if (nodes[model.customer].type !== 'entity') {
      out.push({ level: 'error', code: 'customer-not-entity', msg: 'The customer must be a legal entity, not a natural person.' });
    }
    var seenName = {};
    (model.parties || []).forEach(function (p) {
      var k = String(p.name || '').trim().toLowerCase();
      if (!k) out.push({ level: 'warn', code: 'unnamed', msg: 'A party has no name. Give every party a name so the result is readable.' });
      else if (seenName[k]) out.push({ level: 'warn', code: 'dup-name', msg: 'Two parties are called "' + p.name + '". They are treated as different parties; rename one so the result is not confusing.' });
      seenName[k] = 1;
    });
    var into = {};
    (model.holdings || []).forEach(function (h) {
      if (!nodes[h.from] || !nodes[h.to]) { out.push({ level: 'error', code: 'unknown-party', msg: 'A holding row points to a party that does not exist.' }); return; }
      if (typeof h.pct !== 'number' || !isFinite(h.pct)) { out.push({ level: 'error', code: 'pct-missing', msg: 'The holding of ' + nm(h.from) + ' in ' + nm(h.to) + ' has no percentage.' }); return; }
      if (h.pct < 0 || h.pct > 100 + EPS) out.push({ level: 'error', code: 'pct-range', msg: 'The holding of ' + nm(h.from) + ' in ' + nm(h.to) + ' is ' + fmt(h.pct) + '. A percentage must be between 0 and 100.' });
      if (nodes[h.to].type === 'person') out.push({ level: 'error', code: 'owned-person', msg: nm(h.to) + ' is a natural person, so nobody can hold shares in them. Change the type or remove the row.' });
      if (h.from === h.to) out.push({ level: 'error', code: 'self', msg: nm(h.from) + ' cannot hold shares in itself.' });
      into[h.to] = (into[h.to] || 0) + h.pct;
    });
    Object.keys(into).forEach(function (id) {
      if (into[id] > 100 + EPS) out.push({ level: 'error', code: 'over-100', msg: 'The holdings in ' + nm(id) + ' add up to ' + fmt(into[id]) + ', which is more than 100%. Check the figures.' });
      else if (into[id] < 100 - EPS && nodes[id] && nodes[id].type === 'entity') out.push({ level: 'info', code: 'unaccounted', msg: fmt(100 - into[id]) + ' of ' + nm(id) + ' is not accounted for. An unknown holder could matter; ask for the full register of shareholders.' });
    });
    (model.controls || []).forEach(function (c) {
      if (!nodes[c.from] || !nodes[c.to]) { out.push({ level: 'error', code: 'unknown-party', msg: 'A control row points to a party that does not exist.' }); return; }
      if (nodes[c.to].type !== 'entity') out.push({ level: 'error', code: 'control-person', msg: 'Control is exercised over a legal entity; ' + nm(c.to) + ' is a natural person.' });
      if (c.from === c.to) out.push({ level: 'error', code: 'self', msg: nm(c.from) + ' cannot control itself.' });
      if (!BASIS[c.basis]) out.push({ level: 'error', code: 'basis', msg: 'A control row has no basis. Choose one of the listed means of control.' });
    });
    // cycles in the holdings graph (holder -> held)
    var adj = {};
    (model.holdings || []).forEach(function (h) { if (nodes[h.from] && nodes[h.to] && h.from !== h.to && h.pct > 0) (adj[h.from] = adj[h.from] || []).push(h.to); });
    var state = {}, stack = [], seen = {};
    function dfs(u) {
      state[u] = 1; stack.push(u);
      (adj[u] || []).forEach(function (v) {
        if (state[v] === 1) {
          var cyc = stack.slice(stack.indexOf(v)).concat([v]);
          var key = cyc.slice(0, -1).slice().sort().join('|');
          if (!seen[key]) { seen[key] = 1; out.push({ level: 'warn', code: 'cycle', msg: 'Loop in the holdings: ' + cyc.map(nm).join(' → ') + '. A loop cannot be multiplied through, so the holding that closes the loop is ignored in the calculation. Record it in the file as a flag.' }); }
        } else if (!state[v]) dfs(v);
      });
      stack.pop(); state[u] = 2;
    }
    Object.keys(adj).forEach(function (u) { if (!state[u]) dfs(u); });
    return out;
  }

  /* ── the engine ────────────────────────────────────────────────── */
  function analyse(model) {
    var thr = Number(model.threshold);
    if (!isFinite(thr) || thr <= 0) thr = 25;
    var issues = validate(model);
    var blocked = issues.some(function (i) { return i.level === 'error'; });
    var result = { customer: model.customer, threshold: thr, issues: issues, blocked: blocked, persons: [], fallback: false, notes: [] };
    if (blocked) return result;

    var nodes = {};
    model.parties.forEach(function (p) { nodes[p.id] = p; });
    function nm(id) { return nodes[id].name || '(unnamed)'; }
    var holders = {}, ctrl = {};
    model.parties.forEach(function (p) { holders[p.id] = []; ctrl[p.id] = []; });
    model.holdings.forEach(function (h) {
      if (h.pct > 0) holders[h.to].push({ from: h.from, pct: h.pct });
    });
    model.parties.forEach(function (p) {   // control through ownership: more than 50 %
      holders[p.id].forEach(function (h) { if (h.pct > 50 + EPS) ctrl[p.id].push({ from: h.from, to: p.id, basis: 'own', pct: h.pct }); });
    });
    (model.controls || []).forEach(function (c) { ctrl[c.to].push({ from: c.from, to: c.to, basis: c.basis }); });

    var ignored = {};

    function naturalControllers(E, seen) {   // person id -> links from the person up to E
      var out = {};
      seen = seen || {};
      if (seen[E]) return out;
      var s2 = {}; Object.keys(seen).forEach(function (k) { s2[k] = 1; }); s2[E] = 1;
      ctrl[E].forEach(function (c) {
        if (nodes[c.from].type === 'person') { if (!out[c.from]) out[c.from] = [c]; }
        else {
          var sub = naturalControllers(c.from, s2);
          Object.keys(sub).forEach(function (p) { if (!out[p]) out[p] = sub[p].concat([c]); });
        }
      });
      return out;
    }
    function controls(Y, X) { return ctrl[X].some(function (c) { return c.from === Y; }); }
    function linkApplies(Y, X, s) {
      var cx = controls(Y, X);
      return (cx || ge(s, thr)) && (ctrl[Y].length > 0 || cx);
    }
    function chainText(links) {   // holder -> ... -> target
      var parts = links.map(function (l) { return fmt(l.pct); });
      var prod = links.reduce(function (a, l) { return a * l.pct / 100; }, 1) * 100;
      prod = r9(prod);
      var sentence = links.map(function (l, i) {
        return (i === 0 ? nm(l.from) + ' holds ' + fmt(l.pct) + ' of ' + nm(l.to) : 'which holds ' + fmt(l.pct) + ' of ' + nm(l.to));
      }).join(', ');
      return { product: prod, sentence: sentence,
        math: links.length > 1 ? parts.join(' × ') + ' = ' + fmt(prod) : fmt(prod) };
    }
    function trace(T, path) {
      var res = { chains: [], excluded: [], links: [] };
      function walk(E, trail, pathIds, excl, reason) {
        holders[E].forEach(function (h) {
          if (pathIds.indexOf(h.from) >= 0) { ignored[h.from + '>' + E] = { from: h.from, to: E, pct: h.pct }; return; }
          var chain = [{ from: h.from, to: E, pct: h.pct }].concat(trail);
          if (nodes[h.from].type === 'person') {
            (excl ? res.excluded : res.chains).push({ person: h.from, links: chain, reason: reason });
          } else {
            var applies = !excl && trail.length === 0 && linkApplies(h.from, E, h.pct);
            if (applies) res.links.push({ entity: h.from, into: E, pct: h.pct, controlsInto: controls(h.from, E), ownInt: ge(h.pct, thr) });
            walk(h.from, chain, pathIds.concat([h.from]), excl || applies, excl ? reason : (applies ? { entity: h.from, into: E } : null));
          }
        });
      }
      walk(T, [], path, false, null);
      return res;
    }

    function analyseTarget(T, path, depth) {
      var tr = trace(T, path);
      var P = {};
      function rec(id) {
        return P[id] || (P[id] = { id: id, name: nm(id), chains: [], excluded: [], routes: [], total: 0, direct: 0, indirect: 0 });
      }
      tr.chains.forEach(function (c) {
        var t = chainText(c.links);
        var r = rec(c.person);
        r.chains.push({ links: c.links, direct: c.links.length === 1, product: t.product, math: t.math, sentence: t.sentence });
      });
      tr.excluded.forEach(function (c) {
        var t = chainText(c.links);
        rec(c.person).excluded.push({ links: c.links, product: t.product, math: t.math, sentence: t.sentence, reason: c.reason });
      });
      Object.keys(P).forEach(function (id) {
        var r = P[id];
        r.chains.forEach(function (c) { if (c.direct) r.direct += c.product; else r.indirect += c.product; });
        r.direct = r9(r.direct); r.indirect = r9(r.indirect); r.total = r9(r.direct + r.indirect);
      });
      // control (Art. 53), through ownership or other means, direct or indirect
      var nc = naturalControllers(T);
      Object.keys(nc).forEach(function (id) { rec(id).control = nc[id]; });
      // ownership route
      Object.keys(P).forEach(function (id) {
        var r = P[id];
        if (r.chains.length && ge(r.total, thr)) r.routes.push({ kind: 'ownership' });
        if (r.control) r.routes.push({ kind: r.control.every(function (l) { return l.basis === 'own'; }) ? 'control-own' : 'control-other' });
      });
      // Art. 54 at the customer's direct holders
      tr.links.forEach(function (lk) {
        var Y = lk.entity;
        var ncY = naturalControllers(Y);
        Object.keys(ncY).forEach(function (id) {
          var r = rec(id);
          if (!r.routes.some(function (x) { return x.kind === 'art54a' && x.entity === Y; })) r.routes.push({ kind: 'art54a', entity: Y, links: ncY[id], lk: lk });
        });
        if (lk.controlsInto && depth < 6) {
          var sub = analyseTarget(Y, path.concat([Y]), depth + 1);
          Object.keys(sub.persons).forEach(function (id) {
            var s = sub.persons[id];
            var viaOwn = s.routes.some(function (x) { return x.kind === 'ownership' || x.kind === 'art54a' || x.kind === 'art54b'; });
            if (viaOwn) {
              var r = rec(id);
              if (!r.routes.some(function (x) { return x.kind === 'art54b' && x.entity === Y; })) r.routes.push({ kind: 'art54b', entity: Y, sub: s, lk: lk });
            }
          });
        }
      });
      return { persons: P, links: tr.links };
    }

    var main = analyseTarget(model.customer, [model.customer], 0);
    var T = model.customer;

    function linkSentence(l) {
      if (l.basis === 'own') return nm(l.from) + ' holds ' + fmt(l.pct) + ' of ' + nm(l.to) + ', more than 50%';
      return nm(l.from) + ' ' + BASIS[l.basis].label + ' in ' + nm(l.to);
    }

    var persons = Object.keys(main.persons).map(function (id) {
      var r = main.persons[id];
      var steps = [], cites = [];
      function cite(k) { if (cites.indexOf(k) < 0) cites.push(k); }
      // ownership arithmetic
      if (r.chains.length) {
        r.chains.forEach(function (c) {
          steps.push(c.direct ? 'Direct holding: ' + c.sentence + '.'
            : 'Through the chain: ' + c.sentence + '. Multiply along the chain: ' + c.math + '.');
        });
        if (r.chains.some(function (c) { return !c.direct; })) cite('A52m');
        if (r.chains.length > 1) {
          steps.push('Add all holdings of ' + r.name + ': ' + r.chains.map(function (c) { return fmt(c.product); }).join(' + ') + ' = ' + fmt(r.total) + '.');
          cite('A52b');
        }
        steps.push(fmt(r.total) + (ge(r.total, thr) ? ' is ' + fmt(thr) + ' or more: an ownership interest (Art. 52(1)).' : ' is below ' + fmt(thr) + ': no ownership interest by itself.'));
        cite('A52a');
      }
      r.excluded.forEach(function (c) {
        steps.push('Not multiplied: ' + c.sentence + ' would give ' + c.math + ', but ' + nm(c.reason.entity) + ' is a holder of ' + nm(c.reason.into) + ' where ownership interest and control coexist, so Art. 54 applies instead of multiplication. For information only.');
        cite('A52m'); cite('A54');
      });
      var bo = false;
      r.routes.forEach(function (rt) {
        if (rt.kind === 'ownership') { bo = true; cite('A51a'); }
        else if (rt.kind === 'control-own' || rt.kind === 'control-other') {
          bo = true; cite('A51b');
          var txt = r.control.map(linkSentence).join('; ');
          steps.push('Control: ' + txt + '.' + (r.control.length > 1 ? ' Control is identified on each level of the chain (Art. 53(2)(b)).' : ''));
          if (r.control.length > 1) cite('A53b');
          r.control.forEach(function (l) { cite(l.basis === 'own' ? 'A53c' : BASIS[l.basis].key); });
          if (rt.kind === 'control-other') { cite('A51p'); steps.push('Control via other means is identified independently of any ownership interest (Art. 51, second paragraph), so ' + r.name + ' counts even with a small or no shareholding.'); }
        } else if (rt.kind === 'art54a') {
          bo = true; cite('A54'); cite('A54a');
          steps.push('Art. 54(a): ' + r.name + ' controls ' + nm(rt.entity) + ' (' + rt.links.map(linkSentence).join('; ') + '), which holds ' + fmt(rt.lk.pct) + ' of ' + nm(rt.lk.into) + '. A natural person who controls a legal entity with a direct stake in the customer is a beneficial owner.');
          rt.links.forEach(function (l) { cite(l.basis === 'own' ? 'A53c' : BASIS[l.basis].key); });
        } else if (rt.kind === 'art54b') {
          bo = true; cite('A54'); cite('A54b');
          steps.push('Art. 54(b): ' + nm(rt.entity) + ' controls ' + nm(rt.lk.into) + ' (' + (rt.lk.pct > 50 ? fmt(rt.lk.pct) + ', more than 50%' : 'by other means') + ') and ' + r.name + ' has an ownership interest of ' + fmt(rt.sub.total) + ' in ' + nm(rt.entity) + ' (' + fmt(thr) + ' or more). A person with an ownership interest in the company that controls the customer is a beneficial owner. Multiplication is excluded here.');
          cite('A53c');
        }
      });
      if (!bo) {
        if (!r.chains.length && !r.excluded.length) steps.push(r.name + ' has no holding in the customer\'s structure.');
        else if (!r.routes.length) { steps.push('No control by other means is recorded for ' + r.name + '. Not a beneficial owner on these inputs.'); cite('A51b'); }
      }
      var sortKey = bo ? 0 : 1;
      return { id: id, name: r.name, isBO: bo, total: r.total, direct: r.direct, indirect: r.indirect, chains: r.chains, excluded: r.excluded,
        routes: r.routes.map(function (x) { return x.kind; }), steps: steps, cites: cites, _s: sortKey };
    });
    // persons in the model that are not connected to the customer
    var shown = {};
    persons.forEach(function (p) { shown[p.id] = 1; });
    model.parties.forEach(function (p) {
      if (p.type === 'person' && !shown[p.id]) persons.push({ id: p.id, name: nm(p.id), isBO: false, total: 0, direct: 0, indirect: 0, chains: [], excluded: [], routes: [], cites: [],
        steps: [nm(p.id) + ' has no holding in, and no control over, the customer\'s structure.'], _s: 2 });
    });
    persons.sort(function (a, b) { return (a._s - b._s) || (b.total - a.total) || a.name.localeCompare(b.name); });
    result.persons = persons;
    result.fallback = !persons.some(function (p) { return p.isBO; });
    result.cites = result.fallback ? ['A22'] : [];
    var ign = Object.keys(ignored).map(function (k) { return ignored[k]; });
    ign.forEach(function (g) {
      result.issues.push({ level: 'warn', code: 'ignored-holding', msg: 'Ignored in the calculation: ' + nm(g.from) + ' holds ' + fmt(g.pct) + ' of ' + nm(g.to) + ', because ' + nm(g.from) + ' sits above ' + nm(g.to) + ' in the chain (a loop).' });
    });
    result.links = main.links.map(function (l) { return { entity: l.entity, into: l.into, pct: l.pct, controlsInto: l.controlsInto }; });
    result.ignored = ign;
    return result;
  }

  /* ── examples from docs/data/academy/ownership.json and the film ─── */
  var CASE_CONTROLS = {   // control facts the case states in its documents, not as an edge
    'OWN-04': [{ from: 'karel', to: 'cible', basis: 'board' }],
    'P4': [{ from: 'karel', to: 'cible', basis: 'board' }]
  };
  function fromCase(c) {
    var parties = (c.entities || []).map(function (e) { return { id: e.id, name: e.name, type: e.type === 'person' ? 'person' : 'entity' }; });
    var customer = null;
    (c.entities || []).forEach(function (e) { if (e.customer) customer = e.id; });
    if (!customer) customer = 'cible';
    var holdings = (c.edges || []).filter(function (e) { return !e.kind && e.pct > 0; }).map(function (e) { return { from: e.from, to: e.to, pct: e.pct }; });
    return { parties: parties, holdings: holdings, controls: (CASE_CONTROLS[c.id] || []).map(function (x) { return { from: x.from, to: x.to, basis: x.basis }; }),
      customer: customer, threshold: c.threshold || 25 };
  }
  var FILM = {
    parties: [
      { id: 'velmont', name: 'Velmont Analytics BV', type: 'entity' }, { id: 'kappa', name: 'Kappa Holding Ltd', type: 'entity' },
      { id: 'others', name: 'Other shareholders (each under 5%)', type: 'entity' },
      { id: 'mira', name: 'Mira', type: 'person' }, { id: 'jonas', name: 'Jonas', type: 'person' },
      { id: 'elif', name: 'Elif', type: 'person' }, { id: 'tom', name: 'Tom', type: 'person' }, { id: 'victor', name: 'Victor', type: 'person' }],
    holdings: [
      { from: 'mira', to: 'velmont', pct: 30 }, { from: 'kappa', to: 'velmont', pct: 40 }, { from: 'jonas', to: 'velmont', pct: 8 }, { from: 'others', to: 'velmont', pct: 22 },
      { from: 'jonas', to: 'kappa', pct: 45 }, { from: 'elif', to: 'kappa', pct: 35 }, { from: 'tom', to: 'kappa', pct: 20 }],
    controls: [{ from: 'victor', to: 'velmont', basis: 'board' }],
    customer: 'velmont', threshold: 25
  };
  var EXAMPLES = [   // source: 'film' or an id in ownership.json (primer P*, cases OWN-*)
    { id: 'film', title: 'Film example: 45% × 40% plus 8% direct = 26%', pick: function () { return JSON.parse(JSON.stringify(FILM)); } },
    { id: 'P3', title: 'Add up the paths (Rita)', src: 'primer' },
    { id: 'OWN-01', title: 'A holding company and two partners (Art. 54)', src: 'cases' },
    { id: 'OWN-02', title: 'Three branches, none decisive', src: 'cases' },
    { id: 'OWN-04', title: 'Eight percent and the board (control)', src: 'cases' },
    { id: 'OWN-05', title: 'The company that owns itself (loop)', src: 'cases' }
  ];

  /* ── file: save and load ───────────────────────────────────────── */
  var FORMAT = 'regradar-ubo/1';
  function serialise(model) {
    return JSON.stringify({ format: FORMAT, customer: model.customer, threshold: model.threshold,
      parties: model.parties, holdings: model.holdings, controls: model.controls }, null, 2);
  }
  function parseFile(text) {
    var d;
    try { d = JSON.parse(text); } catch (e) { return { error: 'This file is not valid JSON.' }; }
    if (!d || d.format !== FORMAT) return { error: 'This is not a RegRadar UBO structure file (format ' + FORMAT + ').' };
    if (!Array.isArray(d.parties) || !Array.isArray(d.holdings)) return { error: 'The file has no parties or holdings.' };
    var ids = {};
    var parties = d.parties.map(function (p) {
      var id = String(p && p.id || ''); if (!id || ids[id]) return null; ids[id] = 1;
      return { id: id, name: String(p.name || '').slice(0, 120), type: p.type === 'person' ? 'person' : 'entity' };
    });
    if (parties.indexOf(null) >= 0) return { error: 'The file has a party without a unique id.' };
    function num(x) { var n = typeof x === 'number' ? x : parseFloat(x); return isFinite(n) ? n : null; }
    return { model: {
      parties: parties,
      holdings: d.holdings.map(function (h) { return { from: String(h.from), to: String(h.to), pct: num(h.pct) }; }),
      controls: (Array.isArray(d.controls) ? d.controls : []).map(function (c) { return { from: String(c.from), to: String(c.to), basis: String(c.basis) }; }),
      customer: d.customer ? String(d.customer) : '', threshold: num(d.threshold) || 25 } };
  }

  /* ── CSV ───────────────────────────────────────────────────────── */
  function csvCell(v) {
    var s = String(v == null ? '' : v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;   // spreadsheet formula injection
    return /[",\n\r;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function toCsv(model, res, when) {
    var nm = {}; model.parties.forEach(function (p) { nm[p.id] = p.name; });
    var rows = [
      ['RegRadar UBO calculator', 'Teaching tool, not legal advice'],
      ['Customer', nm[model.customer] || ''], ['Threshold', fmt(res.threshold)], ['Date', when || ''], [],
      ['Natural person', 'Verdict', 'Total ownership interest', 'Direct', 'Indirect', 'Routes', 'Articles', 'Working']
    ];
    (res.persons || []).forEach(function (p) {
      rows.push([p.name, p.isBO ? 'Beneficial owner' : 'Not a beneficial owner on these inputs', fmt(p.total), fmt(p.direct), fmt(p.indirect),
        p.routes.join(' + '), p.cites.map(function (k) { return EXTRACTS[k].label; }).join('; '), p.steps.join(' ')]);
    });
    if (res.fallback && !res.blocked) rows.push([], ['No natural person qualifies on these inputs. Art. 22(2) is about senior managing officials: record the steps taken; this tool does not conclude.']);
    return '﻿' + rows.map(function (r) { return r.map(csvCell).join(','); }).join('\r\n') + '\r\n';
  }

  var API = { analyse: analyse, validate: validate, EXTRACTS: EXTRACTS, BASIS: BASIS, BASIS_ORDER: BASIS_ORDER, lawHref: lawHref, fmt: fmt,
    fromCase: fromCase, FILM: FILM, EXAMPLES: EXAMPLES, serialise: serialise, parseFile: parseFile, toCsv: toCsv, csvCell: csvCell, CELEX: CELEX };
  root.UBO = API;
  if (typeof module === 'object' && module.exports) module.exports = API;

  /* ═══ page ═══════════════════════════════════════════════════════ */
  if (typeof document === 'undefined' || !document.getElementById('uboApp')) return;
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var M, seq = 0, cases = null;
  function nid() { seq++; return 'n' + seq + Math.random().toString(36).slice(2, 5); }
  function setModel(m) {
    M = { parties: m.parties.map(function (p) { return { id: p.id, name: p.name, type: p.type }; }),
      holdings: m.holdings.map(function (h) { return { from: h.from, to: h.to, pct: h.pct }; }),
      controls: (m.controls || []).map(function (c) { return { from: c.from, to: c.to, basis: c.basis }; }),
      customer: m.customer, threshold: m.threshold || 25 };
    renderAll();
  }
  function blank() {
    var a = nid(), b = nid();
    return { parties: [{ id: a, name: 'Customer Ltd', type: 'entity' }, { id: b, name: 'Alex', type: 'person' }], holdings: [{ from: b, to: a, pct: 30 }], controls: [], customer: a, threshold: 25 };
  }
  function pname(id) { for (var i = 0; i < M.parties.length; i++) if (M.parties[i].id === id) return M.parties[i].name || '(unnamed)'; return '(unknown)'; }
  function partyOpts(sel, only) {
    return M.parties.filter(function (p) { return !only || p.type === only; })
      .map(function (p) { return '<option value="' + esc(p.id) + '"' + (p.id === sel ? ' selected' : '') + '>' + esc(p.name || '(unnamed)') + '</option>'; }).join('');
  }

  function renderParties() {
    $('partyRows').innerHTML = M.parties.map(function (p, i) {
      return '<tr data-i="' + i + '"><td data-l="Name"><input class="in" data-f="name" aria-label="Name of party ' + (i + 1) + '" value="' + esc(p.name) + '" maxlength="120"></td>' +
        '<td data-l="Type"><select class="sel" data-f="type" aria-label="Type of ' + esc(p.name || 'party ' + (i + 1)) + '"><option value="entity"' + (p.type === 'entity' ? ' selected' : '') + '>Legal entity</option><option value="person"' + (p.type === 'person' ? ' selected' : '') + '>Natural person</option></select></td>' +
        '<td data-l="Customer"><label class="cust"><input type="radio" name="cust" data-f="cust"' + (M.customer === p.id ? ' checked' : '') + (p.type === 'person' ? ' disabled' : '') + '> <span>Customer</span></label></td>' +
        '<td data-l=""><button class="btn sm danger" type="button" data-act="del" aria-label="Remove ' + esc(p.name || 'party ' + (i + 1)) + '">Remove</button></td></tr>';
    }).join('');
  }
  function renderHoldings() {
    $('holdRows').innerHTML = M.holdings.map(function (h, i) {
      return '<tr data-i="' + i + '"><td data-l="Holder"><select class="sel" data-f="from" aria-label="Holder, row ' + (i + 1) + '">' + partyOpts(h.from) + '</select></td>' +
        '<td data-l="Holds shares in"><select class="sel" data-f="to" aria-label="Entity held, row ' + (i + 1) + '">' + partyOpts(h.to, 'entity') + '</select></td>' +
        '<td data-l="Percent"><input class="in num" data-f="pct" type="number" inputmode="decimal" min="0" max="100" step="any" aria-label="Percentage of shares or voting rights, row ' + (i + 1) + '" value="' + (h.pct == null ? '' : h.pct) + '"></td>' +
        '<td data-l=""><button class="btn sm danger" type="button" data-act="del" aria-label="Remove holding row ' + (i + 1) + '">Remove</button></td></tr>';
    }).join('') || '<tr><td colspan="4" class="hint">No holdings yet. Add the first one.</td></tr>';
  }
  function renderControls() {
    $('ctrlRows').innerHTML = M.controls.map(function (c, i) {
      return '<tr data-i="' + i + '"><td data-l="Controller"><select class="sel" data-f="from" aria-label="Controller, row ' + (i + 1) + '">' + partyOpts(c.from) + '</select></td>' +
        '<td data-l="Controls"><select class="sel" data-f="to" aria-label="Entity controlled, row ' + (i + 1) + '">' + partyOpts(c.to, 'entity') + '</select></td>' +
        '<td data-l="Means of control"><select class="sel" data-f="basis" aria-label="Means of control, row ' + (i + 1) + '">' + BASIS_ORDER.map(function (b) { return '<option value="' + b + '"' + (c.basis === b ? ' selected' : '') + '>' + esc(EXTRACTS[BASIS[b].key].label + ': ' + BASIS[b].label) + '</option>'; }).join('') + '</select></td>' +
        '<td data-l=""><button class="btn sm danger" type="button" data-act="del" aria-label="Remove control row ' + (i + 1) + '">Remove</button></td></tr>';
    }).join('') || '<tr><td colspan="4" class="hint">No control by other means recorded.</td></tr>';
  }

  /* graph: owners above, customer at the bottom, one row per distance */
  function renderGraph(res) {
    var W = 150, H = 54, GX = 28, GY = 70;
    var ids = M.parties.map(function (p) { return p.id; });
    var depth = {}, q = [M.customer];
    if (M.customer) depth[M.customer] = 0;
    var holdersOf = {};
    M.holdings.forEach(function (h) { if (h.pct > 0) (holdersOf[h.to] = holdersOf[h.to] || []).push(h.from); });
    M.controls.forEach(function (c) { (holdersOf[c.to] = holdersOf[c.to] || []).push(c.from); });
    while (q.length) { var u = q.shift(); (holdersOf[u] || []).forEach(function (v) { if (depth[v] == null) { depth[v] = depth[u] + 1; q.push(v); } }); }
    var maxD = 0; Object.keys(depth).forEach(function (k) { maxD = Math.max(maxD, depth[k]); });
    var loose = ids.filter(function (id) { return depth[id] == null; });
    if (loose.length) { loose.forEach(function (id) { depth[id] = maxD + 1; }); maxD += 1; }
    var rows = []; for (var d = 0; d <= maxD; d++) rows.push([]);
    M.parties.forEach(function (p) { rows[depth[p.id] || 0].push(p); });
    var maxN = Math.max.apply(null, rows.map(function (r) { return r.length; }).concat([1]));
    var totalW = maxN * (W + GX) + GX, totalH = (maxD + 1) * (H + GY) - GY + 2 * 16;
    var pos = {};
    rows.forEach(function (r, d) {
      var y = 16 + (maxD - d) * (H + GY);
      var rowW = r.length * (W + GX) - GX, x0 = (totalW - rowW) / 2;
      r.forEach(function (p, i) { pos[p.id] = { x: x0 + i * (W + GX), y: y }; });
    });
    var verdict = {};
    (res.persons || []).forEach(function (p) { verdict[p.id] = p.isBO; });
    var out = '<svg role="img" aria-labelledby="gT gD" width="' + totalW + '" height="' + totalH + '" viewBox="0 0 ' + totalW + ' ' + totalH + '" xmlns="http://www.w3.org/2000/svg"><title id="gT">Ownership structure of ' + esc(pname(M.customer)) + '</title><desc id="gD">Solid lines show shareholdings with percentages, dashed lines show control by other means. The same information is in the lists below the graph.</desc>';
    M.holdings.forEach(function (h) {
      var a = pos[h.from], b = pos[h.to]; if (!a || !b) return;
      var x1 = a.x + W / 2, y1 = a.y + H, x2 = b.x + W / 2, y2 = b.y, my = (y1 + y2) / 2, mx = (x1 + x2) / 2;
      if (a.y >= b.y) { y1 = a.y; y2 = b.y + H; my = (y1 + y2) / 2; }
      out += '<path d="M' + x1 + ' ' + y1 + ' C' + x1 + ' ' + my + ' ' + x2 + ' ' + my + ' ' + x2 + ' ' + y2 + '" fill="none" stroke="var(--rr-line-strong)" stroke-width="1.6"/>';
      var t = (h.pct == null ? '?' : fmt(h.pct)), tw = t.length * 8 + 10;
      out += '<rect x="' + (mx - tw / 2) + '" y="' + (my - 11) + '" width="' + tw + '" height="22" rx="11" fill="var(--rr-surface)" stroke="var(--rr-line)"/><text x="' + mx + '" y="' + (my + 4) + '" text-anchor="middle" font-size="13" font-weight="600" fill="var(--rr-text)">' + esc(t) + '</text>';
    });
    M.controls.forEach(function (c) {
      var a = pos[c.from], b = pos[c.to]; if (!a || !b) return;
      var x1 = a.x + W / 2, y1 = a.y + H, x2 = b.x + W / 2 + 14, y2 = b.y;
      if (a.y >= b.y) { y1 = a.y; y2 = b.y + H; }
      var my = (y1 + y2) / 2, mx = (x1 + x2) / 2;
      out += '<path d="M' + x1 + ' ' + y1 + ' C' + x1 + ' ' + my + ' ' + x2 + ' ' + my + ' ' + x2 + ' ' + y2 + '" fill="none" stroke="var(--rr-review)" stroke-width="1.8" stroke-dasharray="6 4"/>';
      out += '<rect x="' + (mx - 30) + '" y="' + (my - 11) + '" width="60" height="22" rx="11" fill="var(--rr-review-bg)" stroke="var(--rr-review)"/><text x="' + mx + '" y="' + (my + 4) + '" text-anchor="middle" font-size="13" font-weight="600" fill="var(--rr-review)">control</text>';
    });
    M.parties.forEach(function (p) {
      var o = pos[p.id], isC = p.id === M.customer, bo = verdict[p.id], person = p.type === 'person';
      var stroke = isC ? 'var(--rr-text)' : (bo ? 'var(--rr-done)' : 'var(--rr-line-strong)');
      var fill = bo ? 'var(--rr-done-bg)' : 'var(--rr-surface-2)';
      var nameT = String(p.name || '(unnamed)'); if (nameT.length > 21) nameT = nameT.slice(0, 20) + '…';
      var sub = isC ? 'Customer' : (person ? (bo ? 'Beneficial owner' : 'Natural person') : 'Legal entity');
      out += '<g><rect x="' + o.x + '" y="' + o.y + '" width="' + W + '" height="' + H + '" rx="' + (person ? 27 : 10) + '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="' + (isC ? 3 : 1.6) + '"/>' +
        '<text x="' + (o.x + W / 2) + '" y="' + (o.y + 23) + '" text-anchor="middle" font-size="13" font-weight="700" fill="var(--rr-text)">' + esc(nameT) + '</text>' +
        '<text x="' + (o.x + W / 2) + '" y="' + (o.y + 41) + '" text-anchor="middle" font-size="12" fill="' + (bo ? 'var(--rr-done)' : 'var(--rr-text-2)') + '">' + sub + '</text></g>';
    });
    $('graph').innerHTML = out + '</svg>';
    var lst = M.holdings.map(function (h) { return '<li>' + esc(pname(h.from)) + ' holds ' + (h.pct == null ? '(no percentage)' : fmt(h.pct)) + ' of ' + esc(pname(h.to)) + '</li>'; })
      .concat(M.controls.map(function (c) { return '<li>' + esc(pname(c.from)) + ' ' + esc(BASIS[c.basis] ? BASIS[c.basis].label : '?') + ' in ' + esc(pname(c.to)) + '</li>'; }));
    $('graphList').innerHTML = lst.join('') || '<li>No holdings yet.</li>';
  }

  function citeHtml(keys) {
    return keys.map(function (k) {
      var e = EXTRACTS[k];
      return '<figure class="cite"><figcaption><b>' + esc(e.label) + '</b> <a href="' + lawHref(e.art) + '">Read Art. ' + e.art + ' in the law</a></figcaption><blockquote class="quote">' + esc(e.text) + '</blockquote></figure>';
    }).join('');
  }
  var last = null;
  function renderResult() {
    var res = analyse(M); last = res;
    var iss = res.issues.map(function (i) {
      return '<li class="iss ' + i.level + '"><span class="pill ' + (i.level === 'error' ? 'risk' : i.level === 'warn' ? 'review' : '') + '">' + (i.level === 'error' ? 'Error' : i.level === 'warn' ? 'Warning' : 'Note') + '</span> <span>' + esc(i.msg) + '</span></li>';
    }).join('');
    $('issues').innerHTML = iss ? '<ul class="rr-rows issues">' + iss + '</ul>' : '';
    $('issues').hidden = !iss;
    var box = $('result');
    $('btnCsv').disabled = $('btnPrint').disabled = res.blocked;
    if (res.blocked) {
      box.innerHTML = '<div class="rr-empty"><h2>No result yet</h2><p>Fix the errors above. The tool does not guess when the inputs are impossible.</p></div>';
      renderGraph(res); return;
    }
    var bos = res.persons.filter(function (p) { return p.isBO; });
    var html = '<div class="rr-stats"><div class="rr-stat"><div class="n">' + bos.length + '</div><div class="l">Beneficial owner' + (bos.length === 1 ? '' : 's') + ' on these inputs</div><div class="s">of ' + res.persons.length + ' natural person' + (res.persons.length === 1 ? '' : 's') + '</div></div>' +
      '<div class="rr-stat"><div class="n">' + fmt(res.threshold) + '</div><div class="l">Ownership threshold</div><div class="s">Art. 52(1)</div></div>' +
      '<div class="rr-stat"><div class="n">50%+1</div><div class="l">Control through shares</div><div class="s">Art. 53(2)(c)</div></div></div>';
    if (res.fallback) {
      html += '<div class="banner demo"><div><p><b>No natural person qualifies on these inputs.</b> Before relying on that, check that every route is exhausted: the full list of shareholders, and control by other means (board appointment rights, agreements, family ties, nominees). Art. 22(2) then speaks of recording that no beneficial owner was identified and identifying the senior managing officials. This tool only informs you of that fallback; it does not conclude it for you.</p>' +
        '<details><summary>Law: Art. 22(2)</summary>' + citeHtml(['A22']) + '</details></div></div>';
    }
    html += res.persons.map(function (p, i) {
      var head = p.chains.length || p.excluded.length ? '<p class="big num">' + fmt(p.total) + ' <small>ownership interest' + (p.chains.length > 1 || p.indirect ? ' (direct ' + fmt(p.direct) + ', indirect ' + fmt(p.indirect) + ')' : '') + '</small></p>' : '';
      return '<article class="rr-card pcard" aria-labelledby="pn' + i + '"><div class="pane-h"><h3 id="pn' + i + '">' + esc(p.name) + '</h3><span class="pill ' + (p.isBO ? 'done' : '') + '">' + (p.isBO ? 'Beneficial owner' : 'Not a beneficial owner on these inputs') + '</span></div>' +
        head + '<ol class="steps">' + p.steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>' +
        (p.cites.length ? '<details class="law"><summary>Law: ' + esc(p.cites.map(function (k) { return EXTRACTS[k].label; }).filter(function (x, j, a) { return a.indexOf(x) === j; }).join(', ')) + '</summary>' + citeHtml(p.cites) + '</details>' : '') + '</article>';
    }).join('');
    box.innerHTML = html;
    renderGraph(res);
  }

  function renderAll() {
    $('threshold').value = M.threshold;
    renderParties(); renderHoldings(); renderControls(); renderResult();
  }
  function toast(t) { var el = $('toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(function () { el.classList.remove('on'); }, 3200); }
  function download(name, type, text) {
    var a = document.createElement('a'), u = URL.createObjectURL(new Blob([text], { type: type }));
    a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 1000);
  }

  function init() {
    setModel(blank());
    // parties
    $('partyRows').addEventListener('input', function (e) {
      var tr = e.target.closest('tr'); if (!tr) return; var p = M.parties[+tr.dataset.i];
      if (e.target.dataset.f === 'name') { p.name = e.target.value; renderHoldings(); renderControls(); renderResult(); }
    });
    $('partyRows').addEventListener('change', function (e) {
      var tr = e.target.closest('tr'); if (!tr) return; var p = M.parties[+tr.dataset.i], f = e.target.dataset.f;
      if (f === 'type') { p.type = e.target.value; if (p.type === 'person' && M.customer === p.id) M.customer = ''; renderAll(); }
      else if (f === 'cust') { M.customer = p.id; renderResult(); }
    });
    $('partyRows').addEventListener('click', function (e) {
      var b = e.target.closest('[data-act="del"]'); if (!b) return; var i = +b.closest('tr').dataset.i, id = M.parties[i].id;
      M.parties.splice(i, 1);
      M.holdings = M.holdings.filter(function (h) { return h.from !== id && h.to !== id; });
      M.controls = M.controls.filter(function (c) { return c.from !== id && c.to !== id; });
      if (M.customer === id) M.customer = '';
      renderAll(); var nb = $('partyRows').querySelector('input[data-f="name"]'); if (nb) nb.focus();
    });
    $('addParty').addEventListener('click', function () {
      M.parties.push({ id: nid(), name: '', type: 'person' }); renderAll();
      var ins = $('partyRows').querySelectorAll('input[data-f="name"]'); ins[ins.length - 1].focus();
    });
    // holdings and controls
    [['holdRows', 'holdings'], ['ctrlRows', 'controls']].forEach(function (pair) {
      var el = $(pair[0]), key = pair[1];
      el.addEventListener('input', function (e) {
        var tr = e.target.closest('tr'); if (!tr || !tr.dataset.i || e.target.dataset.f !== 'pct') return;
        var v = e.target.value; M[key][+tr.dataset.i].pct = v === '' ? null : parseFloat(v); renderResult();
      });
      el.addEventListener('change', function (e) {
        var tr = e.target.closest('tr'); if (!tr || !tr.dataset.i || e.target.dataset.f === 'pct') return;
        M[key][+tr.dataset.i][e.target.dataset.f] = e.target.value; renderResult();
      });
      el.addEventListener('click', function (e) {
        var b = e.target.closest('[data-act="del"]'); if (!b) return;
        M[key].splice(+b.closest('tr').dataset.i, 1); (key === 'holdings' ? renderHoldings : renderControls)(); renderResult();
        var add = $(key === 'holdings' ? 'addHold' : 'addCtrl'); add.focus();
      });
    });
    function firstEntity() { var e = M.parties.filter(function (p) { return p.type === 'entity'; }); return e.length ? e[0].id : (M.parties[0] || {}).id; }
    $('addHold').addEventListener('click', function () {
      var cust = M.customer || firstEntity();
      var from = (M.parties.filter(function (p) { return p.id !== cust; })[0] || {}).id;
      M.holdings.push({ from: from, to: cust, pct: null }); renderHoldings(); renderResult();
      var ins = $('holdRows').querySelectorAll('select[data-f="from"]'); ins[ins.length - 1].focus();
    });
    $('addCtrl').addEventListener('click', function () {
      var cust = M.customer || firstEntity();
      var from = (M.parties.filter(function (p) { return p.id !== cust; })[0] || {}).id;
      M.controls.push({ from: from, to: cust, basis: 'board' }); renderControls(); renderResult();
      var ins = $('ctrlRows').querySelectorAll('select[data-f="from"]'); ins[ins.length - 1].focus();
    });
    $('threshold').addEventListener('input', function (e) { var v = parseFloat(e.target.value); M.threshold = isFinite(v) && v > 0 && v <= 25 ? v : 25; renderResult(); });
    // examples
    var sel = $('example');
    sel.innerHTML = '<option value="">Choose an example</option>' + EXAMPLES.map(function (x) { return '<option value="' + x.id + '">' + esc(x.title) + '</option>'; }).join('');
    function loadExample(id) {
      var ex = EXAMPLES.filter(function (x) { return x.id === id; })[0]; if (!ex) return;
      if (ex.pick) { setModel(ex.pick()); toast('Example loaded'); return; }
      fetch('data/academy/ownership.json').then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (d) {
        var c = (d[ex.src] || []).filter(function (k) { return k.id === id; })[0]; if (!c) throw 0;
        setModel(fromCase(c)); toast('Example loaded');
      }).catch(function () { toast('That example could not be loaded. The film example works offline.'); });
    }
    $('loadExample').addEventListener('click', function () { if (sel.value) loadExample(sel.value); else toast('Choose an example first'); });
    $('newBtn').addEventListener('click', function () { setModel(blank()); toast('New structure'); });
    // files
    $('btnSave').addEventListener('click', function () { download('ubo-structure.json', 'application/json', serialise(M)); toast('Saved to your device'); });
    $('btnLoad').addEventListener('click', function () { $('fileIn').click(); });
    $('fileIn').addEventListener('change', function (e) {
      var f = e.target.files[0]; if (!f) return;
      var rd = new FileReader();
      rd.onload = function () { var r = parseFile(String(rd.result)); if (r.error) toast(r.error); else { setModel(r.model); toast('Structure loaded'); } $('fileIn').value = ''; };
      rd.onerror = function () { toast('The file could not be read.'); };
      rd.readAsText(f);
    });
    $('btnCsv').addEventListener('click', function () { if (last && !last.blocked) download('ubo-result.csv', 'text/csv;charset=utf-8', toCsv(M, last, new Date().toISOString().slice(0, 10))); });
    $('btnPrint').addEventListener('click', function () { $('printTitle').textContent = 'UBO calculation for ' + pname(M.customer) + ', ' + new Date().toISOString().slice(0, 10); window.print(); });
    var opened = [];
    window.addEventListener('beforeprint', function () { opened = []; document.querySelectorAll('details').forEach(function (d) { if (!d.open) { d.open = true; opened.push(d); } }); });
    window.addEventListener('afterprint', function () { opened.forEach(function (d) { d.open = false; }); });
  }
  init();
})(typeof window !== 'undefined' ? window : globalThis);
