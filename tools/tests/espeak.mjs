// Optional: TotFonetika vs Projecte AINA's eSpeak-NG fork (the engine of huggingface.co/spaces/projecte-aina/
// transcripcio-fonetica-catala), both judged against hand-checked Viccionari entries. eSpeak is only run here, its
// output is never copied into the site.
// Build once:  git clone -b new_catalan_accents https://github.com/projecte-aina/espeak-ng && cd espeak-ng &&
//              cmake -S . -B build -DUSE_MBROLA=OFF -DUSE_LIBSONIC=OFF -DUSE_LIBPCAUDIO=OFF -DUSE_ASYNC=OFF && cmake --build build -j4
// Usage:       ESPEAK_NG=/path/to/espeak-ng node tools/tests/espeak.mjs     (skips without ESPEAK_NG)
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { TOP, loadEngine, viccionari, checkoutRef, VARIETY_KEY, VOWELS, has } from './lib.mjs';

// lexicon before the Viccionari entries were added (commit e711cc9)
const baseDir = checkoutRef('e711cc9');
const BASE = JSON.parse(fs.readFileSync(path.join(baseDir, 'lexicon.json'), 'utf8')); fs.rmSync(baseDir, { recursive: true, force: true });

const BIN = process.env.ESPEAK_NG;
if (!BIN || !fs.existsSync(BIN)) { console.log('SKIP ESPEAK_NG no definit (camí al binari espeak-ng del fork de projecte-aina)'); process.exit(0); }
const DATA_DIR = path.resolve(path.dirname(BIN), '..');   // build/ contains espeak-ng-data
const CODE = { Central: 'ca', Valencia: 'ca-va', Northwestern: 'ca-nw', Balearic: 'ca-ba' };

// sample: top 5000 + 3000 random words from the rest (fixed seed), letters only
let seed = 1; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const ok = w => /^[a-zàèéíïòóúüç·]{2,}$/.test(w);
const rest = TOP.slice(5000).filter(ok); const sample = [];
while (sample.length < 3000) sample.push(rest.splice(Math.floor(rnd() * rest.length), 1)[0]);
const words = [...TOP.slice(0, 5000).filter(ok), ...sample];
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'espeak-')); const inFile = path.join(tmp, 'words.txt');
fs.writeFileSync(inFile, words.map(w => w + '.\n').join(''));

const E = await loadEngine(); const VIC = await viccionari();
const N = s => s.normalize('NFC').replace(/[\/\[\]ˈˌ.‿ː͡ ]/g, '').replace(/ɫ/g, 'l').replace(/ɾ/g, 'r').replace(/β/g, 'b')
  .replace(/ð/g, 'd').replace(/ɣ/g, 'ɡ').replace(/g/g, 'ɡ').replace(/̞/g, '');
const stresses = s => { s = s.normalize('NFC'); const o = []; for (let i = 0; i < s.length; i++) if (s[i] === 'ˈ')
  o.push({ pos: [...s.slice(0, i)].filter(c => VOWELS.includes(c)).length, v: [...s.slice(i)].find(c => VOWELS.includes(c)) }); return o; };
const pc = (x, n) => n ? (100 * x / n).toFixed(1) + '%' : '-';

console.log('Jutge: entrades del Viccionari revisades a mà, sense les paraules que TotFonetika n\'ha copiat.');
console.log('eSpeak posa dos accents principals en compostos i -ment: es compta bé si qualsevol coincideix.\n');
console.log('varietat          n | pronúncia sencera TF / eSpeak | síl·laba tònica TF / eSpeak | vocal tònica TF / eSpeak');
for (const [d, code] of Object.entries(CODE)) {
  const out = execFileSync(BIN, ['-q', '--ipa', '-v', code, `--path=${DATA_DIR}`, '-f', inFile], { maxBuffer: 1 << 26 }).toString('utf8').split('\n');
  if (out.length - 1 !== words.length) { console.log(`${d}: sortida desalineada (${out.length - 1} línies per ${words.length} paraules)`); continue; }
  const t = { n: 0, tf: [0, 0, 0], es: [0, 0, 0] };
  words.forEach((w, i) => {
    const v = VIC[w]; const ref = v?.[VARIETY_KEY[d]];
    if (!ref?.length || (v.kind !== 'hints' && v.kind !== 'manual')) return;
    const r = E.transcribeWord(w, d);
    if (r.source === 'lexicon' && !has(BASE, w)) return; // copied from the Viccionari: not a fair test
    const sr = ref.map(x => stresses(x)[0]).filter(Boolean), nr = ref.map(N);
    const score = sts => [sts.some(s => sr.some(r => r.pos === s.pos)), sts.some(s => sr.some(r => r.pos === s.pos && r.v === s.v))];
    const a = [nr.includes(N(r.ipa)), ...score(stresses(r.ipa).slice(0, 1))];
    const b = [nr.includes(N(out[i])), ...score(stresses(out[i]))];
    t.n++; a.forEach((x, k) => t.tf[k] += x); b.forEach((x, k) => t.es[k] += x);
  });
  console.log(`${d.padEnd(13)} ${String(t.n).padStart(5)} | ${pc(t.tf[0], t.n).padStart(6)} / ${pc(t.es[0], t.n).padStart(6)}            | ${pc(t.tf[1], t.n).padStart(6)} / ${pc(t.es[1], t.n).padStart(6)}            | ${pc(t.tf[2], t.n).padStart(6)} / ${pc(t.es[2], t.n).padStart(6)}`);
}
fs.rmSync(tmp, { recursive: true, force: true });
