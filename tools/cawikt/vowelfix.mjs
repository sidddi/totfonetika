// Correct the stressed mid vowel (e/ɛ, o/ɔ, ə/ɛ in Balearic) of existing lexicon entries where the Viccionari entry was
// checked by hand (hints or hand-written IPA) and differs from the lexicon ONLY in that vowel.
// Skipped: words with several pronunciations in either source (homographs: neta, dona), any other difference.
// Usage: node tools/cawikt/vowelfix.mjs cawikt.json cawikt-meta.json IN_lexicon.json OUT_lexicon.json [changes.tsv] [only.tsv]
// only.tsv (word<TAB>variety per line): apply just these. vowelfix-confirmed.tsv lists the 377 cells where a third source
// (Projecte AINA's eSpeak-NG fork, used only as a check, no data copied) agrees with the Viccionari.
import fs from 'fs';
import { toLexicon } from './convert.mjs';

const [CWF, METAF, IN, OUT, LOG, ONLY] = process.argv.slice(2);
const only = ONLY ? new Set(fs.readFileSync(ONLY, 'utf8').trim().split('\n').map(l => l.split('\t').slice(0, 2).join('\t'))) : null;
const CW = JSON.parse(fs.readFileSync(CWF, 'utf8')), META = JSON.parse(fs.readFileSync(METAF, 'utf8'));
const LEX = JSON.parse(fs.readFileSync(IN, 'utf8'));
const KEYS = ['central', 'valencia', 'nordoccidental', 'balear']; // lexicon columns 0..3
const PAIRS = new Set(['eɛ', 'ɛe', 'oɔ', 'ɔo', 'əɛ', 'ɛə', 'eə', 'əe']);

// one differing character, a mid vowel, inside the stressed syllable
function onlyStressedVowel(a, b) {
  if (a.length !== b.length || a === b) return false;
  let pos = -1;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) { if (pos >= 0) return false; pos = i; }
  if (!PAIRS.has(a[pos] + b[pos])) return false;
  const st = a.lastIndexOf('ˈ', pos); if (st < 0) return false;
  return !/[.ˌ]/.test(a.slice(st, pos));
}

const log = []; let n = 0;
for (const [w, e] of Object.entries(LEX)) {
  if (Array.isArray(e) || !Object.prototype.hasOwnProperty.call(CW, w)) continue;
  if (META[w] !== 'hints' && META[w] !== 'manual') continue;
  const cells = e.split('|'); let changed = false;
  KEYS.forEach((k, i) => {
    const v = CW[w][k]; if (!v || v.length !== 1 || !cells[i]) return;
    const vic = toLexicon(v[0], k);
    if (only && !only.has(`${w}\t${k}`)) return;
    if (onlyStressedVowel(cells[i], vic)) { log.push(`${w}\t${k}\t${cells[i]}\t${vic}`); cells[i] = vic; changed = true; }
  });
  if (changed) { LEX[w] = cells.join('|'); n++; }
}
fs.writeFileSync(OUT, JSON.stringify(LEX));
if (LOG) fs.writeFileSync(LOG, log.join('\n') + '\n');
console.log(`${n} words, ${log.length} cells corrected`);
