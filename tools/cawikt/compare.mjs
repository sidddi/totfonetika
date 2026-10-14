// Compare tools/cawikt/cawikt.json with the site lexicon. Report only, changes nothing.
// Usage: node tools/cawikt/compare.mjs tools/cawikt/cawikt.json tools/cawikt/cawikt-meta.json top100k.txt
// top100k.txt: one word per line, wordfreq top_n_list('ca', 100000) (same list as tools/build-lemmas.mjs).
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const E = await import(pathToFileURL(path.join(ROOT, 'engine.js')).href);
const LEX = JSON.parse(fs.readFileSync(path.join(ROOT, 'lexicon.json'), 'utf8'));
E.setLexicon(LEX); E.setLemmas(JSON.parse(fs.readFileSync(path.join(ROOT, 'lemmes.json'), 'utf8')));
const CW = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const META = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
const TOP = fs.readFileSync(process.argv[4], 'utf8').split('\n').filter(Boolean);
const TOP100K = new Set(TOP);

// lexicon order: Central|Valencia|Northwestern|Balearic|Northern
const KEYS = ['central', 'valencia', 'nordoccidental', 'balear', 'rossellones'];
const KINDS = ['auto', 'hints', 'manual'];
const lexAlts = (e, i) => (Array.isArray(e) ? e : [e]).map(s => s.split('|')[i]).filter(Boolean);
// no syllable dots, no stress marks, ɫ = l, no brackets/slashes, no tie bars
const norm = s => s.normalize('NFC').replace(/[\/\[\]ˈˌ.͜͡]/g, '').replace(/ɫ/g, 'l').replace(/\s+/g, ' ').trim();
const pct = (a, b) => b ? `${a}/${b} = ${(100 * a / b).toFixed(1)}%` : 'n/a';
const byKind = ws => KINDS.map(k => `${k} ${ws.filter(w => kindOf[w] === k).length}`).join(', ');

// lowercase keys like the lexicon; a lowercase page wins over a capitalised one (casa vs Casa)
const cw = {}, kindOf = {};
for (const [w, v] of Object.entries(CW)) {
  const k = w.toLowerCase();
  if (cw[k] && w !== k) continue;
  cw[k] = Object.fromEntries(Object.entries(v).map(([x, a]) => [x, a.filter(Boolean)])); kindOf[k] = META[w];
}
const cwKeys = Object.keys(cw);
const out = [];
const p = (...a) => out.push(a.join(' '));

p('## Totals');
p('Entrades catalanes amb pronúncia (títols):', Object.keys(CW).length, '| en minúscules, sense duplicats:', cwKeys.length, `(${byKind(cwKeys)})`);
const missing = cwKeys.filter(w => !LEX[w]);
const missTop = missing.filter(w => TOP100K.has(w));
p('No són al lexicó:', missing.length, `(${byKind(missing)})`);
p('  d\'aquestes al top 100k:', missTop.length, `(${byKind(missTop)})`);
p('  d\'aquestes al top 5k:', missing.filter(w => TOP.slice(0, 5000).includes(w)).length);
p('Entrades per varietat:', JSON.stringify(Object.fromEntries(KEYS.map(k => [k, cwKeys.filter(w => cw[w][k]?.length).length]))));

p('\n## Rossellonès');
const ross = cwKeys.filter(w => cw[w].rossellones?.length);
p('Amb rossellonès:', ross.length, '| no al lexicó:', ross.filter(w => !LEX[w]).length,
  '| al lexicó sense rossellonès:', ross.filter(w => LEX[w] && !lexAlts(LEX[w], 4).length).length,
  '| al top 100k:', ross.filter(w => TOP100K.has(w)).length);

p('\n## Concordança (alguna alternativa normalitzada en comú)');
const dis = [];
for (const [i, k] of KEYS.entries()) {
  const tally = Object.fromEntries(KINDS.map(x => [x, [0, 0]])); let both = 0, agree = 0;
  for (const w of cwKeys) {
    const a = cw[w][k]; if (!a?.length || !LEX[w]) continue;
    const b = lexAlts(LEX[w], i); if (!b.length) continue;
    const nb = new Set(b.map(norm)); const ok = a.some(x => nb.has(norm(x)));
    both++; tally[kindOf[w]][1]++;
    if (ok) { agree++; tally[kindOf[w]][0]++; } else dis.push({ w, k, cawikt: a, lexicon: b, kind: kindOf[w] });
  }
  p(`${k}: ${pct(agree, both)} | ` + KINDS.map(x => `${x} ${pct(...tally[x])}`).join(' | '));
}
const rank = new Map(TOP.map((w, i) => [w, i]));
dis.sort((x, y) => (rank.get(x.w) ?? 1e9) - (rank.get(y.w) ?? 1e9));
const sample = [];
for (let r = 0; sample.length < 20 && r < 200; r++) for (const k of KEYS) {
  const d = dis.filter(x => x.k === k)[r]; if (d && sample.length < 20 && !sample.some(s => s.w === d.w)) sample.push(d);
}
p('\n20 desacords de mostra, paraules freqüents primer (paraula | varietat | tipus | Viccionari | lexicó):');
for (const d of sample) p(`${d.w} | ${d.k} | ${d.kind} | ${d.cawikt.join(', ')} | ${d.lexicon.join(', ')}`);
fs.writeFileSync(path.join(path.dirname(process.argv[2]), 'disagreements.json'), JSON.stringify(dis, null, 0));

p('\n## Guany al top 5000 (paraules no resoltes pel lexicó que el Viccionari té en aquella varietat)');
const DIAL = ['Central', 'Valencia', 'Northwestern', 'Balearic', 'Northern'];
for (const [i, d] of DIAL.entries()) {
  const src = {}; const gain = { rules: [], lemma: [], derived: [] };
  for (const w of TOP.slice(0, 5000)) {
    const s = E.transcribeWord(w, d).source; src[s] = (src[s] || 0) + 1;
    if (s !== 'lexicon' && cw[w]?.[KEYS[i]]?.length) gain[s].push(w);
  }
  const all = [...gain.rules, ...gain.lemma, ...gain.derived];
  p(`${d}: ara ${JSON.stringify(src)} → a diccionari: ${all.length} (regles ${gain.rules.length}, lema ${gain.lemma.length}, derivat ${gain.derived.length}; ${byKind(all)})`);
  if (i === 0) p('  exemples regles→diccionari:', gain.rules.slice(0, 40).join(', '));
}
console.log(out.join('\n'));
