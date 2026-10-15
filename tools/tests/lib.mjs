// Shared helpers for the TotFonetika test scripts. Not part of the site.
import fs from 'fs';
import os from 'os';
import path from 'path';
import zlib from 'zlib';
import { execFileSync } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const DATA = path.join(ROOT, 'tools/tests/data');
export const SITE_FILES = ['engine.js', 'lexicon.json', 'lemmes.json'];

const readMaybeGz = f => fs.existsSync(f) ? fs.readFileSync(f) : zlib.gunzipSync(fs.readFileSync(f + '.gz'));
export const readJSON = f => JSON.parse(readMaybeGz(f).toString('utf8'));

// wordfreq top_n_list('ca', 100000), most frequent first
export const TOP = readMaybeGz(path.join(DATA, 'top100k.txt')).toString('utf8').split('\n').filter(Boolean);

// Load the engine (and its data) from a directory; each directory gets its own module instance.
export async function loadEngine(dir = ROOT) {
  const E = await import(pathToFileURL(path.join(dir, 'engine.js')).href + `?${encodeURIComponent(dir)}`);
  E.setLexicon(JSON.parse(fs.readFileSync(path.join(dir, 'lexicon.json'), 'utf8')));
  E.setLemmas(JSON.parse(fs.readFileSync(path.join(dir, 'lemmes.json'), 'utf8')));
  return E;
}

// Copy the site files of a git ref (default origin/main) to a temp dir, for before/after comparisons.
export function checkoutRef(ref) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'totfonetika-ref-'));
  for (const f of SITE_FILES) fs.writeFileSync(path.join(dir, f), execFileSync('git', ['-C', ROOT, 'show', `${ref}:${f}`], { maxBuffer: 1 << 28 }));
  return dir;
}

// Viccionari pronunciations (tools/cawikt), lowercase keys, lexicon notation
export async function viccionari() {
  const { toLexicon } = await import(pathToFileURL(path.join(ROOT, 'tools/cawikt/convert.mjs')).href);
  const cw = readJSON(path.join(ROOT, 'tools/cawikt/cawikt.json'));
  const meta = readJSON(path.join(ROOT, 'tools/cawikt/cawikt-meta.json'));
  const out = {};
  for (const [w, v] of Object.entries(cw)) {
    const k = w.toLowerCase(); if (out[k] && w !== k) continue;
    out[k] = { kind: meta[w], ...Object.fromEntries(Object.entries(v).map(([x, a]) => [x, a.map(i => toLexicon(i, x))])) };
  }
  return out;
}

export const VARIETY_KEY = { Central: 'central', Valencia: 'valencia', Northwestern: 'nordoccidental', Balearic: 'balear' };
export const VOWELS = 'aeiouəɛɔɐ';
// IPA characters the site may output
export const IPA_OK = /^[a-zɐəɛɔɾʎɲŋɱʃʒβðɣθɡʝɫʊɪʁχçɟʋˈˌ.ː̞̩̯͡‿ -]+$/u;
// stressed syllable: index of the vowel after the primary stress mark, and that vowel
export function stressOf(ipa) {
  const s = ipa.normalize('NFC'); const i = s.indexOf('ˈ'); if (i < 0) return null;
  return { pos: [...s.slice(0, i)].filter(c => VOWELS.includes(c)).length, v: [...s.slice(i)].find(c => VOWELS.includes(c)) };
}
export const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

let failures = 0;
export function report(ok, name, detail = '') { if (!ok) failures++; console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); }
export const failed = () => failures;
