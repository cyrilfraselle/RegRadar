// Academy content check. No dependencies. Run from the repo root:  node academy/verify.mjs
// Fails (exit 1) when: JSON does not parse; a law quote is not verbatim in docs/data/laws/;
// a cited article does not exist; a module-map obligation id is not in obligations.json;
// an explainer scene has no caption or draws outside the canvas; a quiz answer index is invalid;
// rounds.json (Spot it games, Decide scenarios, Shifts) has a bad answer, a missing reason, a
// citation to an article that does not exist, a law quote that is not verbatim, a round type
// without its tutorial, a lesson without the data its beats need, or a card that is missing from
// the claim ledger academy/FACTCHECK-rounds.md.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const docs = path.join(root, 'docs');
const A = path.join(docs, 'data', 'academy');
const errs = [];
const err = (m) => errs.push(m);
const J = (p) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { err(`cannot parse ${path.relative(root, p)}: ${e.message}`); return null; } };
const norm = (s) => String(s).replace(/ /g, ' ').replace(/\s+/g, ' ').trim();

for (const f of fs.readdirSync(A).filter((x) => x.endsWith('.json'))) J(path.join(A, f));
const cur = J(path.join(A, 'curriculum.json'));
const exp = J(path.join(A, 'explainers.json'));
const map = J(path.join(A, 'module-map.json'));
const obl = J(path.join(docs, 'data', 'obligations.json'));
const laws = {};
const law = (c) => laws[c] || (laws[c] = J(path.join(docs, 'data', 'laws', `${c}_EN.json`)));
const article = (c, id) => (law(c)?.articles || []).find((a) => String(a.id) === String(id));
const checkRef = (r, where) => { if (!article(r.celex, r.art)) err(`${where}: no article ${r.celex} Art. ${r.art}`); };

if (cur && exp) {
  const ex = Object.fromEntries(exp.explainers.map((e) => [e.id, e]));
  const seen = new Set();
  for (const t of cur.tracks) {
    const w = `track ${t.id}`;
    if (seen.has(t.id)) err(`${w}: duplicate id`); seen.add(t.id);
    for (const k of ['title', 'short', 'minutes', 'learn', 'explainer', 'risks', 'questions', 'law']) if (!t[k]) err(`${w}: missing ${k}`);
    if (!ex[t.explainer]) err(`${w}: explainer ${t.explainer} not found`);
    if (t.practice && !fs.existsSync(path.join(docs, t.practice.href))) err(`${w}: practice href ${t.practice.href} not found`);
    if (!t.risks?.wrong?.length || !t.risks?.consequences?.length || !t.risks?.redflags?.length) err(`${w}: risks need wrong, consequences and redflags`);
    for (const c of t.risks?.consequences || []) if (c.cite) checkRef(c.cite, `${w} consequence`);
    if ((t.questions || []).length < 3) err(`${w}: needs at least 3 questions`);
    (t.questions || []).forEach((q, i) => {
      const n = (q.options || []).length;
      const ans = Array.isArray(q.answer) ? q.answer : [q.answer];
      if (n < 2 || !ans.length || ans.some((a) => !Number.isInteger(a) || a < 0 || a >= n)) err(`${w} q${i + 1}: bad answer index`);
      if (!q.why) err(`${w} q${i + 1}: missing explanation`);
      if (q.law) checkRef(q.law, `${w} q${i + 1}`);
    });
    for (const [i, c] of (t.law || []).entries()) {
      const a = article(c.celex, c.art);
      if (!a) { err(`${w} law[${i}]: no article ${c.celex} Art. ${c.art}`); continue; }
      const txt = norm(a.text);
      for (const part of c.quote.split(' […] ')) if (!txt.includes(norm(part))) err(`${w} law[${i}] (${c.celex} Art. ${c.art}): quote is not verbatim: "${part.slice(0, 60)}…"`);
    }
  }
  for (const e of exp.explainers) {
    e.scenes.forEach((s, i) => {
      const w = `explainer ${e.id} scene ${i + 1}`;
      if (!s.title || !s.caption) err(`${w}: needs title and caption`);
      for (const it of s.items || []) {
        if (it.t === 'box' && (it.x < 0 || it.y < 0 || it.x + it.w > 480 || it.y + it.h > 300)) err(`${w}: box outside the 480x300 canvas`);
        if (it.s && it.s < 18) err(`${w}: text smaller than 18 units`);
      }
    });
    if (e.scenes.length < 5 || e.scenes.length > 8) err(`explainer ${e.id}: expected 5 to 8 scenes`);
  }
  for (const id of Object.keys(map?.modules || {})) if (!ex[id] && !cur.tracks.some((t) => t.id === id)) err(`module-map: unknown module ${id}`);
}
if (map && obl) {
  const ids = new Set(obl.obligations.map((o) => o.id));
  for (const [m, v] of Object.entries(map.modules)) for (const id of v.obligations) if (!ids.has(id)) err(`module-map ${m}: obligation ${id} is not in obligations.json`);
  if (cur) for (const t of cur.tracks) if (!map.modules[t.id]) err(`module-map: no entry for ${t.id}`);
}


/* ── rounds.json: Spot it games, Decide scenarios, Shifts ─────────────── */
const rnd = J(path.join(A, 'rounds.json'));
let nGames = 0, nCards = 0, nDec = 0, nRQ = 0;
if (rnd && cur) {
  const ids = new Set(cur.tracks.map((t) => t.id));
  const ledgerPath = path.join(root, 'academy', 'FACTCHECK-rounds.md');
  const ledger = fs.existsSync(ledgerPath) ? fs.readFileSync(ledgerPath, 'utf8') : (err('missing academy/FACTCHECK-rounds.md (claim ledger)'), '');
  const inLedger = (key, where) => { if (ledger && !ledger.includes('`' + key + '`')) err(`${where}: not in the claim ledger (expected \`${key}\` in academy/FACTCHECK-rounds.md)`); };
  const TYPES = new Set(['flag', 'sort', 'match', 'doc', 'pick']);
  const tut = rnd.tutorials || {};
  const skip = (rnd._meta && rnd._meta.skip) || {};
  const quote = (q, where) => {
    const a = article(q.celex, q.art);
    if (!a) return err(`${where}: no article ${q.celex} Art. ${q.art}`);
    if (!q.quote) return err(`${where}: law entry without a quote`);
    const txt = norm(a.text);
    for (const part of q.quote.split(' […] ')) if (!txt.includes(norm(part))) err(`${where} (${q.celex} Art. ${q.art}): quote is not verbatim: "${part.slice(0, 60)}…"`);
    nRQ++;
  };
  const checkCard = (g, c, where, practice) => {
    if (!c.id) err(`${where}: card without id`);
    if (!c.why) err(`${where}: card without a reason (why)`);
    if (c.cite) checkRef(c.cite, where);
    const fictional = JSON.stringify(c);
    if (/CF Bank/.test(fictional) && !/fictional/i.test(fictional + g.intro)) err(`${where}: mentions CF Bank without saying it is fictional`);
    if (practice && !c.hint) err(`${where}: practice card needs a hint`);
    if (['flag', 'sort', 'match'].includes(g.type)) {
      if (!(g.choices || []).some((o) => o.id === c.answer)) err(`${where}: answer "${c.answer}" is not one of the choices`);
      if (g.type === 'match' && !(c.rows || []).length) err(`${where}: match card needs rows`);
    } else if (g.type === 'doc') {
      const f = (c.doc && c.doc.fields) || [];
      if (!c.ref || !(c.ref.rows || []).length) err(`${where}: document card needs ref rows`);
      if (!f.some((x) => x.id === c.answer)) err(`${where}: answer "${c.answer}" is not a field of the document`);
      if (new Set(f.map((x) => x.id)).size !== f.length) err(`${where}: duplicate field ids`);
    } else if (g.type === 'pick') {
      const o = (c.opts || []).map((x) => x.id);
      if (!Array.isArray(c.answer) || !c.answer.length || c.answer.some((a) => !o.includes(a))) err(`${where}: pick answer must be a non-empty list of option ids`);
    }
  };
  const games = {};
  for (const g of rnd.games || []) {
    const w = `rounds game ${g.id}`;
    nGames++;
    if (!ids.has(g.module)) err(`${w}: unknown module ${g.module}`);
    if (games[g.module]) err(`${w}: module ${g.module} already has a game`); games[g.module] = g;
    if (!TYPES.has(g.type)) err(`${w}: unknown type ${g.type}`);
    const T = tut[g.type];
    if (!T || !(T.howto || []).length) err(`${w}: type ${g.type} has no How to play text`);
    if (!T || !(T.coach || []).length || T.coach.length > 3) err(`${w}: type ${g.type} needs a coach of one to three steps`);
    for (const k of ['title', 'intro', 'remember', 'law']) if (!g[k] || (Array.isArray(g[k]) && !g[k].length)) err(`${w}: missing ${k}`);
    if (!g.practice) err(`${w}: needs an unscored practice card`); else checkCard(g, g.practice, `${w} practice`, true);
    if ((g.cards || []).length < 3) err(`${w}: needs at least 3 cards`);
    const seenC = new Set();
    for (const c of g.cards || []) { if (seenC.has(c.id)) err(`${w}: duplicate card ${c.id}`); seenC.add(c.id); checkCard(g, c, `${w} card ${c.id}`); inLedger(`${g.id}/${c.id}`, `${w} card ${c.id}`); nCards++; }
    inLedger(`${g.id}/${g.practice && g.practice.id}`, `${w} practice`);
    (g.law || []).forEach((q, i) => quote(q, `${w} law[${i}]`));
  }
  const decs = {};
  for (const d of rnd.decide || []) {
    const w = `rounds decide ${d.id}`;
    nDec++;
    if (!ids.has(d.module)) err(`${w}: unknown module ${d.module}`);
    if (decs[d.module]) err(`${w}: module ${d.module} already has a scenario`); decs[d.module] = d;
    if (!d.title || !d.text) err(`${w}: needs title and text`);
    const o = d.options || [];
    if (o.length < 2 || o.length > 4) err(`${w}: needs 2 to 4 options`);
    if (o.filter((x) => x.verdict === 'best').length !== 1) err(`${w}: needs exactly one best option`);
    for (const x of o) {
      if (!['best', 'ok', 'poor'].includes(x.verdict)) err(`${w} option ${x.id}: verdict must be best, ok or poor`);
      if (!x.consequence || !x.cite) err(`${w} option ${x.id}: needs a consequence and a citation`);
      if (x.cite) checkRef(x.cite, `${w} option ${x.id}`);
      inLedger(`${d.id}/${x.id}`, `${w} option ${x.id}`);
    }
    if (/CF Bank/.test(JSON.stringify(d)) && !/fictional/i.test(JSON.stringify(d))) err(`${w}: mentions CF Bank without saying it is fictional`);
  }
  if (!tut.decide || !(tut.decide.howto || []).length) err('rounds: the decide beat needs How to play text');
  /* every lesson has the data its beats need: watch, check and law are checked above;
     Spot it and Decide must exist, or the lesson must be listed in _meta.skip with a reason */
  for (const t of cur.tracks) {
    if (!games[t.id] && !skip[t.id]) err(`lesson ${t.id}: no Spot it game and no skip reason in rounds.json _meta.skip`);
    if (!decs[t.id] && !skip[t.id]) err(`lesson ${t.id}: no Decide scenario and no skip reason in rounds.json _meta.skip`);
    if (!(rnd._meta.labels || {})[t.id]) err(`lesson ${t.id}: no short label for the path row (rounds.json _meta.labels)`);
  }
  /* Shifts: one after every third lesson, linking to a practice room that exists */
  const sh = rnd.shifts || [];
  if (sh.length !== Math.floor(cur.tracks.length / 3)) err(`rounds: expected ${Math.floor(cur.tracks.length / 3)} shifts, found ${sh.length}`);
  sh.forEach((s, i) => {
    if (s.no !== i + 1) err(`shift ${i + 1}: numbered ${s.no}`);
    for (const k of ['title', 'room', 'href', 'minutes', 'desk_days', 'blurb']) if (!s[k]) err(`shift ${s.no}: missing ${k}`);
    for (const h of [s.href, s.alt_href].filter(Boolean)) if (!fs.existsSync(path.join(docs, h))) err(`shift ${s.no}: ${h} not found`);
    if (!/fictional/i.test(s.blurb || '')) err(`shift ${s.no}: blurb must say the cases are fictional`);
  });
}

if (errs.length) { console.error(errs.map((e) => 'FAIL ' + e).join('\n')); process.exit(1); }
console.log(`ok: ${cur.tracks.length} modules, ${exp.explainers.length} explainers, ${cur.tracks.reduce((n, t) => n + t.law.length, 0)} law quotes verbatim, module-map ids real; rounds: ${nGames} games, ${nCards} cards, ${nDec} decide scenarios, ${nRQ} round law quotes verbatim, ledger complete`);
