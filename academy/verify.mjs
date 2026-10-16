// Academy content check. No dependencies. Run from the repo root:  node academy/verify.mjs
// Fails (exit 1) when: JSON does not parse; a law quote is not verbatim in docs/data/laws/;
// a cited article does not exist; a module-map obligation id is not in obligations.json;
// an explainer scene has no caption or draws outside the canvas; a quiz answer index is invalid.
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

if (errs.length) { console.error(errs.map((e) => 'FAIL ' + e).join('\n')); process.exit(1); }
console.log(`ok: ${cur.tracks.length} modules, ${exp.explainers.length} explainers, ${cur.tracks.reduce((n, t) => n + t.law.length, 0)} law quotes verbatim, module-map ids real`);
