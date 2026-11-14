// Shared writer for the film authoring helpers. Rounds numbers so the JSON stays readable.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
export function write(id, data) {
  const out = path.join(root, 'docs', 'data', 'academy', 'films', `${id}.json`);
  const json = JSON.stringify(data, (k, v) => (typeof v === 'number' ? Math.round(v * 1000) / 1000 : v));
  fs.writeFileSync(out, json + '\n');
  console.log(`wrote ${path.relative(root, out)} (${json.length} bytes)`);
}
