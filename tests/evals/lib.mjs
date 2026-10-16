import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
export const docs = path.resolve(here, '..', '..', 'docs');
export const AI = createRequire(import.meta.url)(path.join(docs, 'ai.js'));
export function buildIndex(celexes) {
  const ix = AI.createIndex();
  for (const c of celexes) ix.addLaw(JSON.parse(fs.readFileSync(path.join(docs, 'data/laws', c + '_EN.json'), 'utf8')));
  ix.addObligations(JSON.parse(fs.readFileSync(path.join(docs, 'data/obligations.json'), 'utf8')).obligations);
  return ix;
}
export function readJSON(p) { return JSON.parse(fs.readFileSync(path.join(here, p), 'utf8')); }
