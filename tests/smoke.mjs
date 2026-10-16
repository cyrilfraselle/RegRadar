// RegRadar smoke test with a ratchet.
//
// Loads every page in docs/ (and docs/labs/*/index.html) in headless
// Chromium at three widths and measures: console/page errors, same-origin
// request failures, horizontal overflow, and serious/critical axe
// violations. Results are compared to tests/baseline.json: any metric that
// gets WORSE fails the run, so quality can only go up. New pages must be
// clean. Update the baseline deliberately with:  node smoke.mjs --write-baseline
//
// Usage (from tests/):  npm ci && npx playwright install chromium && node smoke.mjs
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const here = path.dirname(fileURLToPath(import.meta.url));
const docs = path.resolve(here, '..', 'docs');
const baselinePath = process.env.BASELINE_FILE || path.join(here, 'baseline.json');
const outDir = path.join(here, 'out');
const WIDTHS = [390, 768, 1280];
const writeBaseline = process.argv.includes('--write-baseline');

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.txt': 'text/plain' };

function serve() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (p.endsWith('/')) p += 'index.html';
      const file = path.join(docs, p);
      if (!file.startsWith(docs) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    }).listen(0, '127.0.0.1', () => resolve(server));
  });
}

function listPages() {
  const pages = fs.readdirSync(docs).filter((f) => f.endsWith('.html')).sort();
  const labs = path.join(docs, 'labs');
  if (fs.existsSync(labs)) {
    for (const d of fs.readdirSync(labs)) {
      if (fs.existsSync(path.join(labs, d, 'index.html'))) pages.push(`labs/${d}/index.html`);
    }
  }
  return pages;
}

const server = await serve();
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const report = {};

for (const page of listPages()) {
  const entry = { console: 0, requestFailures: 0, overflow: [], axe: 0, notes: [] };
  for (const width of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    const pg = await ctx.newPage();
    pg.on('console', (m) => {
      if (m.type() !== 'error') return;
      const loc = m.location().url || '';
      if (loc && !loc.startsWith(origin)) return;
      if (width === 1280) { entry.console++; entry.notes.push(`console: ${m.text().slice(0, 140)}`); }
    });
    pg.on('pageerror', (e) => { if (width === 1280) { entry.console++; entry.notes.push(`pageerror: ${String(e.message).slice(0, 140)}`); } });
    pg.on('response', (r) => {
      if (r.url().startsWith(origin) && r.status() >= 400 && width === 1280) { entry.requestFailures++; entry.notes.push(`http ${r.status()} ${r.url().replace(origin, '')}`); }
    });
    try {
      await pg.goto(`${origin}/${page}`, { waitUntil: 'load', timeout: 20000 });
      await pg.waitForTimeout(900);
      const over = await pg.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (over > 1) entry.overflow.push(width);
      if (width === 1280) {
        const res = await new AxeBuilder({ page: pg }).withTags(['wcag2a', 'wcag2aa']).analyze();
        entry.axe = res.violations
          .filter((v) => v.impact === 'serious' || v.impact === 'critical')
          .reduce((n, v) => n + v.nodes.length, 0);
        for (const v of res.violations.filter((x) => x.impact === 'serious' || x.impact === 'critical').slice(0, 4)) {
          entry.notes.push(`axe ${v.impact} ${v.id} x${v.nodes.length}`);
        }
      }
    } catch (e) {
      entry.console++; entry.notes.push(`load failed: ${String(e.message).slice(0, 120)}`);
    }
    await ctx.close();
  }
  report[page] = entry;
}
await browser.close();
server.close();

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));

if (writeBaseline) {
  const base = {};
  for (const [p, e] of Object.entries(report)) base[p] = { console: e.console, requestFailures: e.requestFailures, overflow: e.overflow, axe: e.axe };
  fs.writeFileSync(baselinePath, JSON.stringify(base, null, 2) + '\n');
  console.log(`Baseline written for ${Object.keys(base).length} pages.`);
  process.exit(0);
}

const base = fs.existsSync(baselinePath) ? JSON.parse(fs.readFileSync(baselinePath, 'utf8')) : null;
const rows = [];
const regressions = [];
for (const [p, e] of Object.entries(report)) {
  const b = base && base[p] ? base[p] : { console: 0, requestFailures: 0, overflow: [], axe: 0, isNew: !!base };
  const worse = [];
  if (e.console > b.console) worse.push(`console errors ${b.console}->${e.console}`);
  if (e.requestFailures > b.requestFailures) worse.push(`failed requests ${b.requestFailures}->${e.requestFailures}`);
  const newOver = e.overflow.filter((w) => !b.overflow.includes(w));
  if (newOver.length) worse.push(`new overflow at ${newOver.join(',')}px`);
  if (e.axe > b.axe) worse.push(`axe serious/critical ${b.axe}->${e.axe}`);
  const improved = base && base[p] && (e.console < b.console || e.axe < b.axe || e.overflow.length < b.overflow.length);
  rows.push(`| ${p} | ${e.console} | ${e.requestFailures} | ${e.overflow.join(',') || '-'} | ${e.axe} | ${worse.length ? 'WORSE: ' + worse.join('; ') : (improved ? 'improved (update baseline)' : 'ok')} |`);
  if (worse.length) regressions.push({ page: p, worse, notes: e.notes });
}
const table = ['| page | console | http | overflow | axe | status |', '|---|---|---|---|---|---|', ...rows].join('\n');
console.log(table);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Smoke test\n\n${table}\n`);
if (!base) console.log('\nNo baseline yet: run with --write-baseline to create one.');
if (regressions.length) {
  console.error('\nREGRESSIONS:');
  for (const r of regressions) console.error(`- ${r.page}: ${r.worse.join('; ')}\n    ${r.notes.slice(0, 4).join('\n    ')}`);
  process.exit(1);
}
console.log('\nSmoke test passed (no regressions).');
