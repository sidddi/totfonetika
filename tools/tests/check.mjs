// Main check: robustness, lexicon integrity and golden cases. Exit code 1 on any failure.
// Usage: node tools/tests/check.mjs [--update-golden]
import fs from 'fs';
import path from 'path';
import { ROOT, DATA, TOP, loadEngine, IPA_OK, has, report, failed } from './lib.mjs';

const E = await loadEngine();
const LEX = JSON.parse(fs.readFileSync(path.join(ROOT, 'lexicon.json'), 'utf8'));
const D = E.DIALECTS.map(d => d.id);

// 1. varieties offered
report(D.join() === 'Central,Valencia,Northwestern,Balearic', 'varietats del menú', D.join(', '));

// 2. robustness: every frequent word, every lexicon key, JS property names and odd inputs, in every variety
const proto = [...Object.getOwnPropertyNames(Object.prototype), '__proto__', 'constructor', 'prototype'];
const edge = ['', ' ', '123', '3,5', '!!!', '😀', 'ÀÈÒ', "l'home", "d'aquí", 'porta-li-ho', "s'ho", 'Barcelona', 'CASA', 'a'.repeat(200),
  'x-y-z', "''", '--', 'qu', 'l·l', 'col·legi', 'Ç', 'üí', '\n\t'];
const words = [...new Set([...TOP, ...Object.keys(LEX), ...proto, ...edge])];
const bad = { crash: [], empty: [], junk: [], chars: [] };
const t0 = Date.now(); let n = 0;
for (const d of D) {
  for (const w of words) {
    let r; try { r = E.transcribeWord(w, d); } catch (e) { bad.crash.push(`${w} ${d}: ${e.message}`); continue; }
    n++; if (!w.trim()) continue;
    if (!r || typeof r.ipa !== 'string' || !r.ipa) { bad.empty.push(`${w} ${d}`); continue; }
    if (/undefined|null|NaN|[\/\[\]|]/.test(r.ipa)) bad.junk.push(`${w} ${d} ${r.ipa}`);
    if (/^[a-zà-ÿ·'-]+$/i.test(w) && !IPA_OK.test(r.ipa)) bad.chars.push(`${w} ${d} ${JSON.stringify(r.ipa)}`);
  }
  for (const t of [...edge, proto.join(' '), "L'home i la dona s'ho porten bé; d'aquí a l'escola hi ha 3 km.", 'Paraula '.repeat(5000)]) {
    try { E.transcribe(t, d); E.transcribe(t, d, { liaison: false }); } catch (e) { bad.crash.push(`text "${t.slice(0, 20)}" ${d}: ${e.message}`); }
  }
}
report(bad.crash.length === 0, `sense errors en ${n} transcripcions (${((Date.now() - t0) / 1000).toFixed(1)} s)`, bad.crash.slice(0, 5).join(' | '));
report(bad.empty.length === 0, 'cap resultat buit', bad.empty.slice(0, 5).join(' | '));
report(bad.junk.length === 0, 'cap "undefined", "/", "[" ni "|" a la sortida', bad.junk.slice(0, 5).join(' | '));
report(bad.chars.length === 0, 'només caràcters AFI', bad.chars.slice(0, 5).join(' | '));

// 3. lexicon integrity
const lexBad = [], onlyNorthern = [];
for (const [w, e] of Object.entries(LEX)) {
  const rows = Array.isArray(e) ? e : [e];
  if (!rows.length || rows.some(x => typeof x !== 'string')) { lexBad.push(`${w}: format`); continue; }
  for (const r of rows) {
    const c = r.split('|');
    if (c.length !== 5) lexBad.push(`${w}: ${c.length} columnes`);
    for (const x of c.slice(0, 4)) if (x && !IPA_OK.test(x)) lexBad.push(`${w}: ${JSON.stringify(x)}`);
    // rows with only the Northern column (removed from the menu) are unused: the engine falls back to its rules
    if (!c.slice(0, 4).some(Boolean)) (c[4] ? onlyNorthern : lexBad).push(w);
  }
}
report(lexBad.length === 0, `lexicó íntegre (${Object.keys(LEX).length} entrades)`, lexBad.slice(0, 5).join(' | '));
if (onlyNorthern.length) console.log(`AVÍS entrades només amb rossellonès, sense ús: ${onlyNorthern.join(', ')}`);

// 4. performance
const long = 'La meva germana deia que la feina comença d\'hora i que els seus companys treballen massa. '.repeat(600);
const t1 = Date.now(); E.transcribe(long, 'Central'); const ms = Date.now() - t1;
report(ms < 1500, 'rendiment: 9.600 paraules', `${ms} ms`);

// 5. golden cases: words and sentences checked by hand; any change must be deliberate (--update-golden)
const GOLD = path.join(DATA, 'golden.json');
const golden = JSON.parse(fs.readFileSync(GOLD, 'utf8'));
const render = (text, d, liaison) => E.transcribe(text, d, { liaison }).filter(x => !x.hide && x.source !== 'punct')
  .map((x, i) => (i && !x.joinPrev ? ' ' : '') + x.cipa).join('').replace(/\s+/g, ' ').trim();
const diffs = [];
for (const g of golden) {
  const got = render(g.text, g.dialect, g.liaison !== false);
  if (got !== g.expect) { diffs.push(`${g.dialect} "${g.text}": esperat ${g.expect} | ara ${got}`); if (process.argv.includes('--update-golden')) g.expect = got; }
}
if (process.argv.includes('--update-golden')) { fs.writeFileSync(GOLD, JSON.stringify(golden, null, 1) + '\n'); console.log(`golden.json actualitzat (${diffs.length} canvis)`); }
else report(diffs.length === 0, `casos de referència (${golden.length})`, diffs.length ? '\n     ' + diffs.join('\n     ') : '');

console.log(failed() ? `\n${failed()} proves han fallat` : '\nTot correcte');
process.exit(failed() ? 1 : 0);
