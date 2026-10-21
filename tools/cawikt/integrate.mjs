// Add Viccionari entries to lexicon.json: words missing from the lexicon, in the wordfreq top 100k, whose {{ca-pron}}
// has hints or hand-written IPA (not the bare spelling-generated ones). IPA converted with convert.mjs.
// Usage: node tools/cawikt/integrate.mjs tools/cawikt/cawikt.json tools/cawikt/cawikt-meta.json top100k.txt OUT.json
// Reads lexicon.json, writes the extended lexicon to OUT.json (copy it over lexicon.json after checking).
// Northern is filled only from sept=; otherwise left empty and the engine uses its rules for Northern.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { toLexicon } from './convert.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const LEXF = path.join(ROOT, 'lexicon.json');
const LEX = JSON.parse(fs.readFileSync(LEXF, 'utf8'));
const CW = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const META = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
const TOP = new Set(fs.readFileSync(process.argv[4], 'utf8').split('\n').filter(Boolean));
const KEYS = ['central', 'valencia', 'nordoccidental', 'balear', 'rossellones']; // lexicon order
const MAX_ROWS = 3;

// lowercase like the lexicon; a lowercase page wins over a capitalised one
const cw = {};
for (const [w, v] of Object.entries(CW)) {
  const k = w.toLowerCase();
  if (cw[k] && w !== k) continue;
  cw[k] = { v, kind: META[w] };
}

const added = {}, stats = { hints: 0, manual: 0, rossellones: 0 };
for (const [w, { v, kind }] of Object.entries(cw)) {
  if (LEX[w] || !TOP.has(w) || !/^[a-zàèéíïòóúüç·'-]+$/.test(w)) continue;
  if (kind !== 'hints' && kind !== 'manual') continue;
  if (!v.central?.length) continue;
  const alts = KEYS.map(k => (v[k] || []).map(x => toLexicon(x, k)));
  const n = Math.min(MAX_ROWS, Math.max(...alts.map(a => a.length)));
  const rows = [];
  for (let i = 0; i < n; i++) {
    const row = alts.map(a => a.length ? a[Math.min(i, a.length - 1)] : '').join('|');
    if (!rows.includes(row)) rows.push(row);
  }
  added[w] = rows.length === 1 ? rows[0] : rows;
  stats[kind]++; if (alts[4].length) stats.rossellones++;
}
fs.writeFileSync(process.argv[5], JSON.stringify({ ...LEX, ...added }));
console.log(`added ${Object.keys(added).length} entries`, stats);
