// Offline retrieval eval: recall@5 over the golden set. No dependencies. Run: node evals/retrieval.mjs
import { AI, buildIndex, readJSON } from './lib.mjs';

const THRESHOLD = { overall: 0.90, holdout: 0.85 };   // set from the measured result, see README
const golden = readJSON('golden.json');
const ix = buildIndex(AI.CORE_SCOPE);
const byName = {};
for (const c of ix.loadedCelex()) byName[ix.laws[c].name] = c;

let problems = 0;
const stats = { all: { exp: 0, found: 0, q: 0, hit: 0 } };
const misses = [];
for (const item of golden.questions) {
  const s = stats[item.split] = stats[item.split] || { exp: 0, found: 0, q: 0, hit: 0 };
  let found = 0;
  const res = ix.search(item.question, { k: 5 });
  for (const e of item.expected) {
    const celex = byName[e.law];
    const art = celex && ix.getArticle(celex, e.art);
    if (!art || !new RegExp(e.evidence, 'i').test(AI.normMatch(art.text))) {
      console.error(`GOLDEN INVALID ${item.id}: ${e.law} Art ${e.art} does not contain /${e.evidence}/`);
      problems++; continue;
    }
    if (res.hits.some((h) => h.celex === celex && h.art === String(e.art))) found++;
  }
  for (const k of ['all', item.split]) {
    stats[k].exp += item.expected.length; stats[k].found += found; stats[k].q++; if (found === item.expected.length) stats[k].hit++;
  }
  if (found < item.expected.length) misses.push(`${item.id}: wanted ${item.expected.map((e) => e.law + ' ' + e.art).join(', ')}; got ${res.hits.map((h) => h.name + ' ' + h.art).join(', ')}`);
}
const pct = (a, b) => (b ? a / b : 0);
let fail = problems > 0;
console.log(`questions: ${stats.all.q}  corpus: ${ix.loadedCelex().length} instruments, ${ix.passages.length} passages`);
for (const k of Object.keys(stats)) {
  const s = stats[k];
  console.log(`${k.padEnd(8)} recall@5 = ${(pct(s.found, s.exp) * 100).toFixed(1)}%  (${s.found}/${s.exp} expected articles)  all-found questions = ${s.hit}/${s.q}`);
}
if (misses.length) { console.log('\nmisses:'); misses.forEach((m) => console.log('  ' + m)); }
const overall = pct(stats.all.found, stats.all.exp), hold = pct(stats.holdout.found, stats.holdout.exp);
if (overall < THRESHOLD.overall) { console.error(`FAIL overall recall@5 ${overall.toFixed(3)} < ${THRESHOLD.overall}`); fail = true; }
if (hold < THRESHOLD.holdout) { console.error(`FAIL holdout recall@5 ${hold.toFixed(3)} < ${THRESHOLD.holdout}`); fail = true; }
if (stats.all.q < 30) { console.error('FAIL golden set has fewer than 30 questions'); fail = true; }

// passage integrity: every passage text is a verbatim substring of its article
let bad = 0;
for (const p of ix.passages) if (!ix.getArticle(p.celex, p.art).text.includes(p.text)) bad++;
if (bad) { console.error(`FAIL ${bad} passages are not verbatim substrings of their article`); fail = true; }
else console.log('passage integrity: all passages are verbatim substrings of the article text');
process.exit(fail ? 1 : 0);
