// Compare tools/cawikt/cawikt.json with the site lexicon. Report only, changes nothing.
// Usage: node tools/cawikt/compare.mjs tools/cawikt/cawikt.json top100k.txt
// top100k.txt: one word per line, wordfreq top_n_list('ca', 100000) (same list as tools/build-lemmas.mjs).
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const E = await import(pathToFileURL(path.join(ROOT, 'engine.js')).href);
const LEX = JSON.parse(fs.readFileSync(path.join(ROOT, 'lexicon.json'), 'utf8'));
E.setLexicon(LEX); E.setLemmas(JSON.parse(fs.readFileSync(path.join(ROOT, 'lemmes.json'), 'utf8')));
const CW = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const TOP = fs.readFileSync(process.argv[3], 'utf8').split('\n').filter(Boolean);
const TOP100K = new Set(TOP);

// lexicon order: Central|Valencia|Northwestern|Balearic|Northern
const KEYS = ['central', 'valencia', 'nordoccidental', 'balear', 'rossellones'];
const lexAlts = (e, i) => (Array.isArray(e) ? e : [e]).map(s => s.split('|')[i]).filter(Boolean);
// no syllable dots, no stress marks, ɫ = l, no brackets/slashes, no tie bars
const norm = s => s.normalize('NFC').replace(/[\/\[\]ˈˌ.͜͡]/g, '').replace(/ɫ/g, 'l').replace(/\s+/g, ' ').trim();

const cwKeys = Object.keys(CW).map(w => w.toLowerCase());
const cw = Object.fromEntries(Object.entries(CW).map(([w, v]) => [w.toLowerCase(), Object.fromEntries(Object.entries(v).map(([k, a]) => [k, a.filter(Boolean)]))]));
const out = [];
const p = (...a) => out.push(a.join(' '));

p('Entrades catalanes amb pronúncia:', cwKeys.length);
const missing = cwKeys.filter(w => !LEX[w]);
p('No són al lexicó:', missing.length, '| d\'aquestes al top 100k:', missing.filter(w => TOP100K.has(w)).length);

const perVar = Object.fromEntries(KEYS.map(k => [k, cwKeys.filter(w => cw[w][k]?.length).length]));
p('Entrades per varietat:', JSON.stringify(perVar));
const ross = cwKeys.filter(w => cw[w].rossellones?.length);
p('Amb rossellonès:', ross.length, '| no al lexicó:', ross.filter(w => !LEX[w]).length,
  '| al lexicó sense rossellonès:', ross.filter(w => LEX[w] && !lexAlts(LEX[w], 4).length).length);

// agreement: any normalized alternative in common
const disagreements = [];
for (const [i, k] of KEYS.entries()) {
  let both = 0, agree = 0;
  for (const w of cwKeys) {
    const a = cw[w][k]; if (!a?.length || !LEX[w]) continue;
    const b = lexAlts(LEX[w], i); if (!b.length) continue;
    both++;
    const nb = new Set(b.map(norm));
    if (a.some(x => nb.has(norm(x)))) agree++; else disagreements.push({ w, k, cawikt: a, lexicon: b });
  }
  p(`Acord ${k}:`, both ? `${agree}/${both} = ${(100 * agree / both).toFixed(1)}%` : 'n/a');
}
// 20 sample disagreements, spread over varieties, frequent words first
const rank = new Map(TOP.map((w, i) => [w, i]));
disagreements.sort((x, y) => (rank.get(x.w) ?? 1e9) - (rank.get(y.w) ?? 1e9));
const sample = [];
for (let r = 0; sample.length < 20 && r < 50; r++) for (const k of KEYS) { const d = disagreements.filter(x => x.k === k)[r]; if (d && sample.length < 20) sample.push(d); }
p('\n20 desacords de mostra (paraula | varietat | Viccionari | lexicó):');
for (const d of sample) p(`${d.w} | ${d.k} | ${d.cawikt.join(', ')} | ${d.lexicon.join(', ')}`);

// expected gain on the 5000 most frequent words, per variety
const DIAL = ['Central', 'Valencia', 'Northwestern', 'Balearic', 'Northern'];
p('\nGuany al top 5000 (paraules no resoltes pel lexicó que el Viccionari té en aquella varietat):');
for (const [i, d] of DIAL.entries()) {
  const src = {}; let gain = 0;
  for (const w of TOP.slice(0, 5000)) {
    const s = E.transcribeWord(w, d).source; src[s] = (src[s] || 0) + 1;
    if (s !== 'lexicon' && cw[w]?.[KEYS[i]]?.length) gain++;
  }
  p(`${d}: fonts ara ${JSON.stringify(src)} → passarien a diccionari: ${gain}`);
}
console.log(out.join('\n'));
