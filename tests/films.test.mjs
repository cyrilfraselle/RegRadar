// Gate step 6 for Academy films (academy/SCRIPT_REVIEW.md): the words on screen are the
// words that were checked. Plain node, no dependencies. Run from the repo root:
//   node tests/films.test.mjs
//
// For every film data file docs/data/academy/films/<id>.json it extracts every string the
// engine can show (canvas text, card titles and lines, labels, headers, HUD, end card,
// chapter names, still headings and still captions, DOM captions) and checks it against the
// approved script academy/films/<id>.script.md:
//   - captions must equal the script's final captions, in order and with the same timecodes
//     (and the owner-signed list in academy/films/SIGNOFF.md), and every caption must be made
//     only of ledger "Wording on screen" fragments;
//   - every other string must appear in a claim-ledger row: the "Wording on screen" column, a
//     backticked string in the ledger section (ledger rows, on-canvas text index), or the still
//     captions table. Lists of invented names in rows marked "ok, fictional" may be used item by
//     item (split on " · "). Chapter names come from the script's brief, the title from its
//     heading. Strings with no letters or digits (a glyph such as "?") are decoration.
// It fails on any string that is not in a ledger row. It also checks the films register
// docs/data/academy/films.json.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'docs', 'data', 'academy', 'films');
const errs = [];
const norm = (s) => String(s).replace(/ /g, ' ').replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim();
const cells = (line) => line.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split(' | ').map((c) => c.trim());
const ticks = (s) => [...s.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
const tc = (s) => { const m = /^(\d+):(\d\d)$/.exec(s.trim()); return m ? +m[1] * 60 + +m[2] : NaN; };

function readScript(id) {
  const md = fs.readFileSync(path.join(root, 'academy', 'films', `${id}.script.md`), 'utf8');
  const lines = md.split('\n');
  const allowed = new Set(), fragments = [];
  const add = (s) => { s = norm(s); if (s) allowed.add(s); };
  const title = norm((/^# Film \d+ · (.+?) \(module/m.exec(md) || [])[1] || '');
  add(title);
  const chap = lines.find((l) => l.startsWith('| Chapters |'));
  if (chap) cells(chap)[1].split(' · ').forEach((c) => add(c.replace(/\s+\d+:\d\d$/, '')));
  const captions = [];
  for (const l of lines) {
    const m = /^- \*\*Caption C(\d+)\*\*(?: \((\d+:\d\d) to (\d+:\d\d)\))?: (.+)$/.exec(l);
    if (m) captions.push({ n: +m[1], t0: m[2] ? tc(m[2]) : null, t1: m[3] ? tc(m[3]) : null, text: norm(m[4]) });
  }
  const start = lines.findIndex((l) => /^## Claim ledger/.test(l));
  if (start < 0) throw new Error(`${id}: no claim ledger`);
  let table = '';
  for (const l of lines.slice(start)) {
    if (/^### On-canvas text index/.test(l)) table = 'index';
    else if (/^### Still captions/.test(l)) table = 'stills';
    else if (/^### /.test(l)) table = 'other';
    if (!l.startsWith('|')) continue;
    ticks(l).forEach(add);
    const c = cells(l);
    if (table === '' && /^\d+$/.test(c[0])) {
      const fictional = /^ok, fictional/.test(c[4] || '');
      c[1].split(' / ').forEach((part) => {
        const s = norm(part.replace(/`/g, '').replace(/^\([^)]*\)\s*/, ''));
        if (!s) return; add(s); fragments.push(s);
        if (fictional) s.split(' · ').forEach(add);
      });
      if (fictional) ticks(c[2] || '').forEach((s) => s.split(' · ').forEach(add));
    }
    if (table === 'stills' && /^\d+:\d\d /.test(c[0])) { add(c[0].replace(/^\d+:\d\d /, '')); add(c[1]); }
  }
  return { title, allowed, fragments, captions };
}

function readSignoff() {
  const md = fs.readFileSync(path.join(root, 'academy', 'films', 'SIGNOFF.md'), 'utf8');
  const out = {}; let film = null;
  for (const l of md.split('\n')) {
    const h = /^## Film \d+ · (.+?) \(`([a-z-]+)`/.exec(l); if (h) { film = h[2]; out[film] = []; continue; }
    const m = /^\| C(\d+) \| (\d+:\d\d) to (\d+:\d\d) \| (.+) \|$/.exec(l);
    if (m && film) out[film].push({ n: +m[1], t0: tc(m[2]), t1: tc(m[3]), text: norm(m[4]) });
  }
  return out;
}

const TEXT = new Set(['s', 'title', 'pill', 'name', 'label', 'left', 'right', 'thLabel', 'eyebrow', 'value', 'h', 'cap', 'n']);
const ARR = new Set(['spokes', 'lines', 'footers']);
function strings(node, where, out) {
  if (Array.isArray(node)) { node.forEach((v, i) => strings(v, `${where}[${i}]`, out)); return out; }
  if (!node || typeof node !== 'object') return out;
  for (const [k, v] of Object.entries(node)) {
    if (k === 'captions') continue;
    if (TEXT.has(k) && typeof v === 'string') out.push({ s: v, where: `${where}.${k}` });
    else if (ARR.has(k) && Array.isArray(v)) v.forEach((x, i) => { if (typeof x === 'string') out.push({ s: x, where: `${where}.${k}[${i}]` }); else strings(x, `${where}.${k}[${i}]`, out); });
    else if (typeof v === 'object') strings(v, `${where}.${k}`, out);
  }
  return out;
}

const signoff = readSignoff();
const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort() : [];
if (!files.length) errs.push('no film data in docs/data/academy/films/');
let checked = 0;
for (const f of files) {
  const id = f.replace(/\.json$/, '');
  const D = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  let S; try { S = readScript(id); } catch (e) { errs.push(e.message); continue; }
  if (norm(D.title) !== S.title) errs.push(`${id}: title "${D.title}" is not the script title "${S.title}"`);
  /* captions */
  const so = signoff[id] || [];
  if (!so.length) errs.push(`${id}: no final captions in SIGNOFF.md`);
  if (D.captions.length !== S.captions.length) errs.push(`${id}: ${D.captions.length} captions, script has ${S.captions.length}`);
  D.captions.forEach((c, i) => {
    const txt = norm(c.text), sc = S.captions[i], sg = so[i];
    if (!sc || txt !== sc.text) errs.push(`${id}: caption ${i + 1} differs from script C${i + 1}:\n    film:   ${txt}\n    script: ${sc && sc.text}`);
    if (!sg || txt !== sg.text) errs.push(`${id}: caption ${i + 1} differs from the signed-off caption C${i + 1}`);
    if (sg && (Math.abs(c.t0 - sg.t0) > .001 || Math.abs(Math.min(c.t1, D.duration) - sg.t1) > .001)) errs.push(`${id}: caption ${i + 1} runs ${c.t0} to ${c.t1}, signed off ${sg.t0} to ${sg.t1}`);
    let rest = txt;
    [...S.fragments].sort((a, b) => b.length - a.length).forEach((fr) => { rest = rest.split(fr).join(' '); });
    if (!/^[\s.,;:]*$/.test(rest)) errs.push(`${id}: caption ${i + 1} has words not in any ledger row: "${norm(rest)}"`);
    checked++;
  });
  if (D.captions.length && Math.abs(D.captions[D.captions.length - 1].t1 - D.duration) > .001 && D.captions[D.captions.length - 1].t1 < D.duration) errs.push(`${id}: last caption ends before the film`);
  /* every other string */
  for (const { s, where } of strings(D, id, [])) {
    checked++;
    const n = norm(s);
    if (!/[A-Za-z0-9]/.test(n)) continue;
    if (!S.allowed.has(n)) errs.push(`${id}: "${s}" (${where}) is not in a ledger row of ${id}.script.md`);
  }
  if (!Array.isArray(D.stills) || !D.stills.length) errs.push(`${id}: no stills for reduced motion`);
}

/* the films register read by the Academy path */
const regPath = path.join(root, 'docs', 'data', 'academy', 'films.json');
if (!fs.existsSync(regPath)) errs.push('docs/data/academy/films.json is missing');
else {
  const reg = JSON.parse(fs.readFileSync(regPath, 'utf8'));
  const keys = ['id', 'title', 'topic', 'seconds', 'page', 'status'];
  if (!Array.isArray(reg.films)) errs.push('films.json: no films array');
  for (const e of reg.films || []) {
    const k = Object.keys(e);
    if (k.join() !== keys.join()) errs.push(`films.json ${e.id}: keys ${k.join()} (expected ${keys.join()})`);
    if (!fs.existsSync(path.join(root, 'docs', e.page))) errs.push(`films.json ${e.id}: page ${e.page} not found`);
  }
  for (const f of files) {
    const D = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    const e = (reg.films || []).find((x) => x.title === D.title);
    if (!e) errs.push(`films.json: no entry for ${D.title}`);
    else if (e.seconds !== D.duration) errs.push(`films.json ${e.id}: seconds ${e.seconds}, film runs ${D.duration}`);
  }
}

if (errs.length) { console.error(`films.test: ${errs.length} problem(s)\n- ` + errs.join('\n- ')); process.exit(1); }
console.log(`films.test: ${files.length} film(s), ${checked} strings checked against the claim ledgers: ok`);
