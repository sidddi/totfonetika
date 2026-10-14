// TotFonetika engine: lexicon lookup first, own rules (fallback) for unknown words.
// Rules are written from the published IEC description of Catalan sounds; no third-party code.
export const DIALECTS = [
  { id: 'Central', label: { ca: 'Central', es: 'Central', en: 'Central' }, quality: 'good' },
  { id: 'Valencia', label: { ca: 'Valencià', es: 'Valenciano', en: 'Valencian' }, quality: 'good' },
  { id: 'Northwestern', label: { ca: 'Nord-occidental', es: 'Noroccidental', en: 'North-Western' }, quality: 'medium' },
  { id: 'Balearic', label: { ca: 'Balear', es: 'Balear', en: 'Balearic' }, quality: 'medium' },
  { id: 'Northern', label: { ca: 'Rossellonès', es: 'Rosellonés', en: 'Northern (Rosselló)' }, quality: 'low' },
];
const IDX = Object.fromEntries(DIALECTS.map((d, i) => [d.id, i]));

const V = 'aeiouàèéíòóúïü';
const isV = c => c && V.includes(c);
const ACC = { 'à': 'a', 'è': 'e', 'é': 'e', 'í': 'i', 'ò': 'o', 'ó': 'o', 'ú': 'u' };

export function tokenize(text) {
  // words incl. l·l, apostrophes and hyphens kept as separators
  const out = [];
  const re = /([\p{L}·]+)|([’'‑-])|(\s+)|([^\p{L}\s’'‑-]+)/gu;
  let m;
  while ((m = re.exec(text))) {
    if (m[1]) out.push({ t: 'w', s: m[1] });
    else if (m[2]) out.push({ t: 'sep', s: m[2] });
    else if (m[3]) out.push({ t: 'sp', s: ' ' });
    else out.push({ t: 'x', s: m[4] });
  }
  return out;
}

// ---------- fallback rules ----------
function phonemize(word) {
  // returns array of units {k:'V'|'C'|'G', p:phoneme, acc?:bool, ch?:'e'|'o'|'a'|'i'|'u'}
  const w = word.toLowerCase().replace(/l·l/g, 'L');
  const u = [];
  const n = w.length;
  const at = i => w[i] || '';
  for (let i = 0; i < n; i++) {
    const c = w[i], nx = at(i + 1);
    let pv = at(i - 1);
    if (pv === 'u' && (at(i - 2) === 'q' || at(i - 2) === 'g') && 'eiéèíï'.includes(at(i)) && !(u.length && u[u.length-1].k==='G')) pv = at(i - 2) === 'q' ? 'q' : 'g';
    const startOrAfterC = !pv || !isV(pv);
    const cons = (p, extra = 0) => { u.push({ k: 'C', p }); i += extra; };
    if (isV(c)) {
      if (c === 'u' && (pv === 'q' || pv === 'g') && 'eiéèí'.includes(nx) && nx) continue; // que, qui, gue, gui
      if (c === 'ü') { u.push({ k: 'G', p: 'w' }); continue; }
      if (c === 'ï') { u.push({ k: 'V', p: 'i', acc: false, ch: 'i' }); continue; }
      const accented = !!ACC[c];
      const base = ACC[c] || c;
      // glides: unaccented i/u next to another vowel
      if ((base === 'i' || base === 'u') && !accented) {
        const nv = !!nx && isV(nx);
        const pvv = !!pv && isV(pv);
        const afterQG = (pv === 'q' || pv === 'g') && base === 'u';
        const j = base === 'i' ? 'j' : 'w';
        if (afterQG && nv) { u.push({ k: 'G', p: 'w' }); continue; }
        if (pvv && nv) { u.push({ k: 'G', p: j }); continue; }                // noia, creia: onset glide
        if (pvv && !nv) { u.push({ k: 'G', p: j, coda: true }); continue; }   // aigua-type, pau, mai: coda glide
        if (!pv && nv) { u.push({ k: 'G', p: j }); continue; }                // iode, iogurt, uadi: initial glide
        // consonant + i/u + vowel: hiatus (gràcies, història, mutació)
      }
      u.push({ k: 'V', p: base, acc: accented, ch: base, grave: 'èò'.includes(c), acute: 'éó'.includes(c) });
      continue;
    }
    switch (c) {
      case 'L': u.push({ k: 'C', p: 'l.l' }); break;
      case 'b': cons('b'); break;
      case 'c':
        if ('eiéèí'.includes(nx) && nx) cons('s'); else if (nx === 'c' && 'eiéèí'.includes(at(i + 2))) { cons('ks'); i++; } else cons('k'); break;
      case 'ç': cons('s'); break;
      case 'd': cons('d'); break;
      case 'f': cons('f'); break;
      case 'g':
        if ('eiéèí'.includes(nx) && nx) cons('ʒ');
        else if (nx === 'u' && 'eiéèí'.includes(at(i + 2)) && at(i + 2)) cons('ɡ');
        else cons('ɡ'); break;
      case 'h': break;
      case 'j': cons('ʒ'); break;
      case 'k': cons('k'); break;
      case 'l': if (nx === 'l') cons('ʎ', 1); else cons('l'); break;
      case 'm': cons('m'); break;
      case 'n': if (nx === 'y') { cons('ɲ', 1); } else cons('n'); break;
      case 'p': if (i === 0 && nx === 'n') break; if (nx === 'h') { cons('f', 1); } else cons('p'); break;
      case 'q': cons('k'); if (nx === 'u') { /* handled by u rule */ } break;
      case 'r':
        if (nx === 'r') cons('r', 1);
        else if (!pv || 'nlsmz'.includes(pv)) cons('r');
        else cons('R'); break; // R = r in coda / ɾ between vowels, decided later
      case 's':
        if (nx === 's') cons('s', 1);
        else if (isV(pv) && isV(nx)) cons('z');
        else cons('s'); break;
      case 't':
        if (nx === 'x') cons('tʃ', 1);
        else if (nx === 'j' || (nx === 'g' && 'eiéèí'.includes(at(i + 2)))) cons('dʒ', 1);
        else if (nx === 'z') cons('dz', 1);
        else if (nx === 's' && !at(i + 2)) cons('ts', 1);
        else if (nx === 'h') cons('t', 1);
        else cons('t'); break;
      case 'v': cons('v'); break;
      case 'w': cons('w'); break;
      case 'x':
        if (/^(co|in|)e$/.test(w.slice(0, i)) && (isV(nx) || nx === 'h')) { u.push({ k: 'C', p: 'ɡ', keep: true }, { k: 'C', p: 'z' }); break; }
        if (!pv || !isV(pv) || 'iíï'.includes(pv)) cons('ʃ');
        else cons('ks'); break;
      case 'y': cons('j'); break;
      case 'z': cons('z'); break;
      default: break;
    }
  }
  // final "ig" -> tʃ ; "tg"/"tj" handled
  return u;
}

function expandGroups(units) {
  // split multi-char consonant phonemes "ks", "ts", "l.l" into separate units where relevant
  const out = [];
  for (const x of units) {
    if (x.p === 'ks') { out.push({ k: 'C', p: 'k' }, { k: 'C', p: 's' }); }
    else if (x.p === 'ts') { out.push({ k: 'C', p: 't' }, { k: 'C', p: 's' }); }
    else if (x.p === 'l.l') { out.push({ k: 'C', p: 'l', split: true }, { k: 'C', p: 'l', split: true }); }
    else out.push(x);
  }
  return out;
}

const ONSET2 = new Set(['pl', 'bl', 'kl', 'ɡl', 'fl', 'pɾ', 'bɾ', 'tɾ', 'dɾ', 'kɾ', 'ɡɾ', 'fɾ']);

function syllabify(units) {
  // returns array of syllables: arrays of units; nuclei are k==='V' or G in coda (k:'G' stays with preceding)
  const nuclei = [];
  units.forEach((x, i) => { if (x.k === 'V') nuclei.push(i); });
  if (!nuclei.length) return [units.slice()];
  const bounds = [0];
  for (let a = 0; a < nuclei.length - 1; a++) {
    const s = nuclei[a] + 1, e = nuclei[a + 1];
    // units between nuclei: s..e-1
    // glides in "coda" position attach to previous nucleus
    let j = s;
    while (j < e && units[j].k === 'G' && units[j].coda) j++;
    const mid = units.slice(j, e);
    // onset glides (non-coda) attach to next
    let cut;
    if (mid.length === 0) cut = e;
    else {
      // count consonants (C) and onset glides
      const cs = [];
      mid.forEach((x, idx) => { if (x.k === 'C') cs.push(idx); });
      if (cs.length <= 1) cut = j; // everything to next onset
      else if (cs.length === 2) {
        const pair = mid[cs[0]].p + mid[cs[1]].p;
        if (ONSET2.has(pair) && !mid[cs[0]].split && !mid[cs[1]].split) cut = j;
        else cut = j + cs[1];
      } else {
        const last2 = mid[cs[cs.length - 2]].p + mid[cs[cs.length - 1]].p;
        cut = ONSET2.has(last2) ? j + cs[cs.length - 2] : j + cs[cs.length - 1];
      }
    }
    bounds.push(cut);
  }
  const syl = [];
  for (let b = 0; b < bounds.length; b++) syl.push(units.slice(bounds[b], b + 1 < bounds.length ? bounds[b + 1] : units.length));
  return syl;
}

function stressIndex(word, syl) {
  const w = word.toLowerCase();
  // accent mark?
  const vs = syl.map(s => s.find(x => x.k === 'V'));
  const acc = vs.findIndex(v => v && v.acc);
  if (acc >= 0) return { i: acc, certain: true };
  if (syl.length === 1) return { i: 0, certain: true };
  // falling diphthong at the end (avui, palau, europeu, museus): oxytone; wins over the vowel/-s penultimate rule
  if (/([aeio]|(?<![qg])u)[iu]s?$/.test(w) && !/(.)\1s?$/.test(w)) return { i: syl.length - 1, certain: false };
  // ends in vowel, -s, -en, -in (plural/verb) -> penultimate
  if (/[aeiou]$|[aeiouàèéíòóú]s$|[ei]n$|ia$|ie$|io$|ua$|ue$|uo$/.test(w)) return { i: syl.length - 2, certain: false };
  return { i: syl.length - 1, certain: false };
}

function render(word, dialect) {
  let units = expandGroups(phonemize(word));
  // final-position rules
  const last = units.length - 1;
  // silent final t after n/l (fent, molt) and silent final r (central/nw/balearic; not Valencian/Northern)
  if (units[last] && units[last].p === 't' && units[last - 1] && ['n', 'l'].includes(units[last - 1].p) && units.length > 1 && !(dialect === 'Valencia' || dialect === 'Balearic' || dialect === 'Northern') ) units.pop();
  // gn -> ŋn ; ig/ix: Central, Balearic and Northern drop the glide before ʃ / tʃ
  units.forEach((x, i) => { if (x.k === 'C' && x.p === 'ɡ' && units[i + 1] && units[i + 1].p === 'n') x.p = 'ŋ'; });
  if (dialect === 'Central' || dialect === 'Balearic' || dialect === 'Northern') {
    for (let i = units.length - 2; i > 0; i--) if (units[i].k === 'G' && units[i].p === 'j' && ['ʃ', 'tʃ', 't͡ʃ'].includes(units[i + 1].p)) units.splice(i, 1);
  }
  // final ig -> tʃ
  if (/ig$/.test(word.toLowerCase()) && /[aeiou]ig$/.test(word.toLowerCase())) {
    const lastC = units.length - 1;
    if (units[lastC].p === 'ɡ') units[lastC] = { k: 'C', p: 'tʃ' };
  }
  // devoice final obstruents
  const f = units[units.length - 1];
  if (f && f.k === 'C') { if (f.p === 'b') f.p = 'p'; else if (f.p === 'd') f.p = 't'; else if (f.p === 'ɡ') f.p = 'k'; else if (f.p === 'v') f.p = 'f'; }
  // nasal place assimilation
  units.forEach((x, i) => { if (x.k === 'C' && x.p === 'n' && units[i + 1] && units[i + 1].k === 'C') { const q = units[i + 1].p; if ('pbm'.includes(q)) x.p = 'm'; else if (q === 'f' || q === 'v') x.p = 'ɱ'; else if (q === 'k' || q === 'ɡ') x.p = 'ŋ'; } });
  // r: tap between vowels / before vowel, trill-like coda r (written r) otherwise
  units.forEach((x, i) => {
    if (x.p !== 'R') return;
    const nxu = units[i + 1];
    x.p = nxu && (nxu.k === 'V' || nxu.k === 'G') ? 'ɾ' : (dialect === 'Valencia' ? 'ɾ' : 'r');
  });
  // dark l in coda (Central, Balearic, Northern use ɫ in the lexicon data)
  
  // v: only Valencian/Balearic keep /v/; central/NW -> b
  units.forEach(x => { if (x.k === 'C' && x.p === 'v' && (dialect === 'Central' || dialect === 'Northwestern' || dialect === 'Northern')) x.p = 'b'; if (x.k === 'C' && x.p === 'β' && (dialect === 'Valencia' || dialect === 'Balearic')) { /* v in spelling vs b: ambiguous, keep */ } });
  // s -> z before a voiced consonant inside the word
  units.forEach((x, i) => { const q = units[i + 1]; if (x.k === 'C' && x.p === 's' && q && q.k === 'C' && ['b', 'd', 'ɡ', 'm', 'n', 'l', 'ʎ', 'ɾ', 'r', 'v', 'ʒ'].includes(q.p)) x.p = 'z'; });
  // allophones: b d g approximants after a vowel/liquid (not after nasals; d not after l)
  units.forEach((x, i) => {
    const p = units[i - 1];
    if (x.k !== 'C' || x.keep) return;
    const prevV = p && (p.k === 'V' || p.k === 'G');
    const prevLiq = p && ['ɾ', 'r', 'l', 'ʎ'].includes(p.p);
    if (x.p === 'b' && dialect === 'Balearic') return;
    if (x.p === 'b' && prevV && units[i + 1] && units[i + 1].k === 'C' && !['l', 'ɾ', 'r', 'ʎ'].includes(units[i + 1].p)) {
      // b before a consonant stays b (voiced) or devoices to p (subjecte, subterfugi, subsòl); it is not a spirant
      if (['p', 't', 'k', 'f', 's', 'ʃ', 't͡ʃ', 'tʃ', 't͡s', 'ts'].includes(units[i + 1].p)) x.p = 'p';
    } else if (x.p === 'b' && (prevV || (p && ['l','ʃ','ʒ','f','v'].includes(p.p)))) x.p = 'β';
    else if (x.p === 'd' && (prevV || (p && (dialect === 'Valencia' ? ['ɾ','s','z','ʃ','ʒ','f','v'] : ['ɾ','ʃ','ʒ','f','v']).includes(p.p)))) x.p = 'ð';
    else if (x.p === 'ɡ' && (prevV || (p && ['ɾ','ʃ','ʒ','f','v'].includes(p.p)))) x.p = 'ɣ';
  });
  // affricates/palatals
  units.forEach((x, i) => {
    if (x.k === 'C' && x.p === 'ʒ') {
      const p = units[i - 1];
      if (p && p.k === 'C' && p.p === 'n') p.p = 'ɲ';
      if (dialect === 'Valencia') x.p = 'd͡ʒ';
    }
    if (x.p === 'dz') x.p = 'd͡z'; if (x.p === 'dʒ') x.p = 'd͡ʒ'; if (x.p === 'tʃ') x.p = 't͡ʃ'; if (x.p === 'ts') x.p = 't͡s';
  });
  const syl = syllabify(units);
  const st = stressIndex(word, syl);
  let uncertain = false;
  // final r is silent in oxytone polysyllables (cantar, paper) except Valencian/Northern
  if (syl.length > 1 && st.i === syl.length - 1 && dialect !== 'Valencia' && dialect !== 'Northern') {
    const ls = syl[syl.length - 1], lu = ls[ls.length - 1];
    if (lu && lu.k === 'C' && (lu.p === 'r' || lu.p === 'ɾ')) ls.pop();
  }
  const outSyl = syl.map((s, si) => {
    const stressed = si === st.i;
    return s.map(x => {
      if (x.k !== 'V') return x.p;
      let p = x.p;
      if (stressed) {
        if (p === 'e') { if (!x.grave && !x.acute && si === syl.length - 1 && /encs?$/.test(word.toLowerCase()) && dialect !== 'Valencia') p = 'ɛ'; else if (!x.grave && !x.acute && si === syl.length - 1 && /eus?$/.test(word.toLowerCase()) && (dialect === 'Central' || dialect === 'Balearic')) p = 'ɛ'; else if (x.grave) p = 'ɛ'; else if (x.acute) p = 'e'; else { uncertain = true; p = 'e'; } }
        if (dialect === 'Balearic' && p === 'ɛ') p = 'ə';
        else if (p === 'o') { if (!x.grave && !x.acute && si === syl.length - 1 && /ous?$/.test(word.toLowerCase()) && (dialect === 'Central' || dialect === 'Balearic')) p = 'ɔ'; else if (x.grave) p = 'ɔ'; else if (x.acute) p = 'o'; else { uncertain = true; p = 'o'; } }
        if (dialect === 'Northern' && (p === 'e')) p = 'e̞';
        if (dialect === 'Northern' && (p === 'o')) p = 'o̞';
      } else {
        if (dialect === 'Central' || dialect === 'Balearic' || dialect === 'Northern') { if (p === 'a' || p === 'e') p = 'ə'; else if (p === 'o' && dialect !== 'Balearic') p = 'u'; }
        else if (dialect === 'Northwestern' || dialect === 'Valencia') { /* keep a e o */ }
      }
      return p;
    }).join('');
  });
  // -ble geminated (poble -> pɔb.blə); Valencian ˈpɔ.ble; stressed bl (doblat) is just an onset cluster
  for (let i = 0; i + 1 < outSyl.length; i++) {
    if (outSyl[i].endsWith('β') && outSyl[i + 1].startsWith('l') && (i + 1 === st.i || i >= st.i)) {
      const head = outSyl[i].slice(0, -1);
      if (i + 1 === st.i) { outSyl[i] = head; outSyl[i + 1] = 'β' + outSyl[i + 1]; }
      else if (dialect === 'Valencia') { outSyl[i] = head; outSyl[i + 1] = 'b' + outSyl[i + 1]; }
      else { outSyl[i] = head + 'b'; outSyl[i + 1] = 'b' + outSyl[i + 1]; }
    }
  }
  const mark = outSyl.map((s, i) => (i === st.i && outSyl.length > 1 ? 'ˈ' : '') + s);
  let ipa = mark.join('.').replace('.ˈ', 'ˈ');
  if (outSyl.length === 1) ipa = 'ˈ' + ipa; // monosyllables get stress mark like the lexicon? (lexicon omits for function words) keep mark
  return { ipa, uncertain, stressCertain: st.certain };
}

// ---------- public API ----------
let LEX = null;
export function setLexicon(l) { LEX = l; }
let LEMMAS = null;
export function setLemmas(m) { LEMMAS = m || null; }

// Lemma-guided stressed vowel: take the rule transcription of an inflected form and, when its stressed syllable sits at
// the same index as the lemma's and both stressed vowels are in the same group (E: e ɛ ə e̞, O: o ɔ o̞), use the lemma's vowel.
const VOW_RE = /(e̞|o̞|[aeiouɛɔəɐ])/;
const GROUP = v => /^(e̞|[eɛə])$/.test(v) ? 'E' : /^(o̞|[oɔ])$/.test(v) ? 'O' : null;
function stressInfo(ipa) {
  const syl = ipa.split('.'); const idx = syl.findIndex(s => s.includes('ˈ'));
  if (idx < 0) return null;
  const m = VOW_RE.exec(syl[idx].slice(syl[idx].indexOf('ˈ') + 1));
  return m ? { syl, idx, v: m[1] } : null;
}
// verbs in -em/-eu (estem, portem, volem): stressed last syllable has a fixed vowel per variety
const VERB_E = { Central: 'ɛ', Valencia: 'e', Northwestern: 'e', Balearic: 'ə', Northern: 'e' };
// regular -em/-eu verb forms: stem + ar/er/ir (estem), the infinitive itself (future abandonarem), qu/gu stems (abadoquem -> abadocar)
// tools/build-lemmas.mjs uses the same test to leave regular forms out of lemmes.json
function regularVerb(key, lex) {
  const stem = key.slice(0, -2); if (key.length < 5) return false;
  if (['ar', 'er', 'ir'].some(e => lex[stem + e])) return true;
  if (/(ar|er|re|ir)$/.test(stem) && lex[stem]) return true;
  if (/qu$/.test(stem) && lex[stem.slice(0, -2) + 'car']) return true;
  if (/gu$/.test(stem) && lex[stem.slice(0, -2) + 'gar']) return true;
  return false;
}
function verbEmEu(r, key, dialect) {
  if (!LEX || !/(em|eu)$/.test(key)) return null;
  // verb lemma from the map, or regular stem + ar/er/ir found in the lexicon (estem -> estar, esteu -> estar)
  const lem = LEMMAS && LEMMAS[key];
  const isVerb = lem ? /(ar|er|re|ir)$/.test(lem) : regularVerb(key, LEX);
  if (!isVerb) return null;
  const a = stressInfo(r); if (!a || a.idx !== a.syl.length - 1 || GROUP(a.v) !== 'E') return null;
  const s = a.syl[a.idx], p = s.indexOf('ˈ') + 1;
  a.syl[a.idx] = s.slice(0, p) + s.slice(p).replace(VOW_RE, VERB_E[dialect]);
  return a.syl.join('.');
}
function lemmaGuided(r, key, dialect) {
  if (/[èéòó]/.test(key)) return null; // written accent already fixes the vowel
  if (!LEMMAS || !LEX || !LEMMAS[key] || !LEX[LEMMAS[key]]) return null;
  const alts = fromLex(LEX[LEMMAS[key]], dialect); if (!alts.length) return null;
  const a = stressInfo(r), b = stressInfo(alts[0]);
  if (!a || !b || a.idx !== b.idx) return null;
  const g = GROUP(a.v); if (!g || g !== GROUP(b.v)) return null;
  const s = a.syl[a.idx], p = s.indexOf('ˈ') + 1, rest = s.slice(p);
  a.syl[a.idx] = s.slice(0, p) + rest.replace(VOW_RE, b.v);
  return a.syl.join('.');
}

function fromLex(entry, dialect) {
  const rows = Array.isArray(entry) ? entry : [entry];
  const di = IDX[dialect];
  const out = [];
  for (const r of rows) {
    const cells = r.split('|');
    let v = cells[di];
    if (!v) { // fallback chain
      const chain = { Valencia: [2], Northwestern: [1], Balearic: [0], Northern: [0], Central: [] }[dialect] || [];
      for (const c of chain) if (cells[c]) { v = cells[c]; break; }
    }
    if (v && !out.includes(v)) out.push(v);
  }
  return out;
}

const ENCLITIC = { l: 'l', ls: 'ls', n: 'n', m: 'm', t: 't', s: 's', ns: 'ns', hi: 'j', ho: 'w' };
const CLITIC = { l: 'l', d: 'd', m: 'm', t: 't', s: 's', n: 'n', 'qu': 'k' };

// Unstressed function words (many are missing from the lexicon). Order: Central|Valencia|Northwestern|Balearic|Northern
const FUNC = {
  que: 'kə|ke|ke|kə|kə', el: 'əl|el|el|əl|əl', els: 'əls|els|els|əls|əls', la: 'lə|la|la|lə|lə', les: 'ləs|les|les|ləs|ləs',
  de: 'də|de|de|də|də', 'amb': 'əm|em|em|əm|əm', 'en': 'ən|en|en|ən|ən', 'un': 'un|un|un|un|un', 'una': 'ˈu.nə|ˈu.na|ˈu.na|ˈu.nə|ˈu.nə',
  'per': 'pər|per|per|pər|pər', 'a': 'ə|a|a|ə|ə', 'i': 'i|i|i|i|i', 'o': 'u|o|o|o|u', 'se': 'sə|se|se|sə|sə', 'li': 'li|li|li|li|li', 'em': 'əm|em|em|əm|əm',
  al: 'əl|al|al|əl|əl', als: 'əls|als|als|əls|əls', del: 'dəl|del|del|dəl|dəl', dels: 'dəls|dels|dels|dəls|dəls', pel: 'pəl|pel|pel|pəl|pəl', pels: 'pəls|pels|pels|pəls|pəls', es: 'əs|es|es|əs|əs', sa: 'sə|sa|sa|sə|sə', ses: 'səs|ses|ses|səs|səs',
  'et': 'ət|et|et|ət|ət', 'ens': 'əns|ens|ens|əns|əns', 'us': 'us|us|us|us|us', 'ho': 'u|o|o|u|u', 'ja': 'ˈʒa|ˈd͡ʒa|ˈja|ˈʒa|ˈʒa', 'hi': 'i|i|i|i|i', 'mes': 'ˈməs|ˈmes|ˈmes|ˈməs|ˈməs',
};

function derive(key, dialect) {
  // inflection: -s / -es / -a / -es from a known base. Returns {ipa} or null.
  if (!LEX) return null;
  const sfx = { Central: ['əs','s'], Valencia: ['es','s'], Northwestern: ['es','s'], Balearic: ['əs','s'], Northern: ['əs','s'] }[dialect];
  const get = k => { const e = LEX[k]; if (!e) return null; const a = fromLex(e, dialect); return a.length ? a[0] : null; };
  if (/[^s]s$/.test(key) && !/(es)$/.test(key)) { const b = get(key.slice(0, -1)); if (b) return b + 's'; }
  if (/s$/.test(key) && !/[aeiouàèéíòóú]s$/.test(key)) { /* handled above */ }
  if (/es$/.test(key)) { const b = get(key.slice(0, -2) + 'a'); if (b && /[əa]$/.test(b)) return b.slice(0, -1) + (dialect === 'Valencia' || dialect === 'Northwestern' ? 'es' : 'əs'); const b2 = get(key.slice(0, -2)); if (b2) return b2 + sfx[0]; }
  return null;
}

export function transcribeWord(word, dialect = 'Central') {
  const key = word.toLowerCase();
  if (FUNC[key]) { const alts = fromLex(FUNC[key], dialect); if (alts.length) return { word, source: 'lexicon', alts, ipa: alts[0], note: 'function word' }; }
  if (LEX && LEX[key]) {
    const alts = fromLex(LEX[key], dialect);
    if (alts.length) return { word, source: 'lexicon', alts, ipa: alts[0] };
  }
  const dv = derive(key, dialect);
  if (dv) return { word, source: 'derived', alts: [dv], ipa: dv, uncertain: true };
  const r = render(key, dialect);
  const lg = verbEmEu(r.ipa, key, dialect) || lemmaGuided(r.ipa, key, dialect);
  if (lg) r.ipa = lg;
  // final -nt/-lt/-nd/-ld (and plurals) lose the t/d in Central, Northwestern and Northern (IEC GIEC 4.3.2)
  if (['Central', 'Northwestern', 'Northern'].includes(dialect)) r.ipa = r.ipa.replace(/([nɫl])[td](s?)$/, '$1$2').replace(/ŋk(s?)$/, 'ŋ$1');
  return { word, source: lg ? 'lemma' : 'rules', alts: [r.ipa], ipa: r.ipa, uncertain: lg ? true : (r.uncertain || !r.stressCertain) };
}

export function transcribe(text, dialect = 'Central', opts = {}) {
  const liaison = opts.liaison !== false;
  const toks = tokenize(text);
  const items = [];
  let hyph = false;
  let apos = false;
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (t.t === 'w') {
      const nxt = toks[i + 1];
      let it;
      if (nxt && nxt.t === 'sep' && (nxt.s === "'" || nxt.s === '’') && CLITIC[t.s.toLowerCase()] && toks[i + 2] && toks[i + 2].t === 'w') {
        // elided clitic: attach consonant to the next word
        const next = transcribeWord(toks[i + 2].s, dialect);
        const c = CLITIC[t.s.toLowerCase()];
        const addC = a => a.replace(/^([ˈˌ]?)/, '$1' + c);
        it = { ...next, word: t.s + "'" + toks[i + 2].s, ipa: addC(next.ipa), alts: next.alts.map(addC), source: next.source, note: 'clitic' };
        i += 2;
      } else if (apos && ENCLITIC[t.s.toLowerCase()] && items.length && items[items.length - 1].source !== 'punct') {
        // enclitic after an apostrophe (porta'l, dóna'n): glue to the previous word
        const e = ENCLITIC[t.s.toLowerCase()], prev = items[items.length - 1];
        prev.word += "'" + t.s; prev.ipa += e; prev.alts = prev.alts.map(a => a + e); prev.note = 'clitic';
        apos = false; continue;
      } else it = transcribeWord(t.s, dialect);
      apos = false;
      if (hyph) it.hyphenBefore = true;
      hyph = false;
      items.push(it);
    } else if (t.t === 'sep') {
      if (t.s !== "'" && t.s !== '’') hyph = true; else apos = true;
    } else if (t.t === 'x') {
      hyph = false; apos = false;
      items.push({ word: t.s, source: 'punct', ipa: '', alts: [] });
    }
  }
  if (liaison && ['Central', 'Northwestern', 'Northern'].includes(dialect)) applyLiaison(items);
  if (liaison) applyConnected(items, dialect);
  else for (const x of items) x.cipa = x.ipa;
  return items;
}

// ---- connected speech (phrase level) ----
const PROCLITIC = new Set(['sant', 'sants', 'santa', 'santes', 'don', 'dona', 'na', 'en', 'el', 'la', 'els', 'les', 'de', 'que', 'amb', 'per', 'a', 'un', 'i', 'o', 'se', 'li', 'em', 'et', 'ens', 'us', 'ho', 'hi', 'mon', 'ton', 'son', 'al', 'als', 'del', 'dels', 'pel', 'pels', 'es', 'sa', 'ses']);
const ELIDE = new Set(['la', 'una', 'de', 'que', 'se', 'sa', 'ma', 'ta']);
const PALATAL_START = /^[ˈˌ]?(t͡ʃ|d͡ʒ|tʃ|dʒ|ʃ|ʒ|ɲ|ʎ)/;
const VOWEL_START = /^[ˈˌ]?[aeiouɛɔəɐ]/;
const CONS_START = /^[ˈˌ]?([^aeiouɛɔəɐ.ˈˌ])/;
const VOICED = new Set(['b', 'd', 'ɡ', 'g', 'v', 'z', 'ʒ', 'm', 'n', 'ɲ', 'l', 'ɫ', 'ʎ', 'ɾ', 'r']);
function applyConnected(items, dialect) {
  const lat = ['Central', 'Balearic', 'Northern'].includes(dialect);
  for (const x of items) x.cipa = x.ipa;
  for (let i = 0; i < items.length - 1; i++) {
    const a = items[i], b = items[i + 1];
    if (a.source === 'punct' || b.source === 'punct') continue;
    const bv = VOWEL_START.test(b.cipa);
    const bc = /^[ˈˌ]?[dtʒ]͡/.test(b.cipa) || /^[ˈˌ]?t[ʃs]/.test(b.cipa) ? undefined : (CONS_START.exec(b.cipa) || [])[1];
    let c = a.cipa, mod = false;
    let elided = false;
    // elision of the neutral vowel (una hora [unˈɔɾə], la escola [ləsˈkɔlə]): Central, Balearic, Northern
    if (lat && bv && ELIDE.has(a.word.toLowerCase()) && !(['la', 'una'].includes(a.word.toLowerCase()) && /^[iu]/.test(b.cipa)) && /[^ə]ə$/.test(c.replace(/[ˈˌ]/g, '')) && !a.hyphenBefore) {
      c = c.replace(/\.?ə$/, ''); a.cipa = c; a.connected = true; elided = true;
      a.cipa = a.cipa.replace(/[ˈˌ]/g, ''); c = a.cipa;
    }
    // sinalefa: unstressed initial i/u/o of the next word becomes a glide after a vowel (serà inútil [səˈɾa jˈnutiɫ])
    if (!elided && bv && /[aeɛoɔ]$|ˈ[^.]*[iu]$/.test(c) && !/ə$/.test(c) && /^[iuo]/.test(b.cipa) && /^[iuo][^aeiouɛɔəɐ]*[ˈ.]?[^]*[aeiouɛɔəɐ]/.test(b.cipa)) {
      b.cipa = ({ i: 'j', u: 'w', o: 'w' })[b.cipa[0]] + b.cipa.slice(1); b.connected = true;
    }
    // geminate/assimilated contact across words: -t/-d + m n l ʎ (setmana [səmˈmanə]); Central, Northern, Balearic
    if (lat && !elided && /[td]$/.test(c) && /^[mnlɫʎ]/.test(b.cipa.replace(/^[ˈˌ]/, '')) && !/[ʃʒ]$/.test(c)) {
      const first = b.cipa.replace(/^[ˈˌ]/, '')[0];
      c = c.slice(0, -1) + first;
      mod = true;
    }
    // palatal assimilation of n and l before a palatal (un joc [uɲ ˈʒɔk], el xoc [əʎ ˈʃɔk])
    if (!elided && PALATAL_START.test(b.cipa)) {
      if (/n$/.test(c)) { c = c.slice(0, -1) + 'ɲ'; mod = true; }
      else if (/[lɫ]$/.test(c)) { c = c.slice(0, -1) + 'ʎ'; mod = true; }
    }
    // final -r of infinitives resurfaces before a weak pronoun with hyphen (fer-hi [ˈfeɾi]); GIEC/Wikipedia
    if (bv && b.hyphenBefore && /r$/i.test(a.word) && !/[ɾr]$/.test(c)) { c += 'ɾ'; mod = true; }
    // final ʃ / t͡ʃ voice before a vowel or a voiced consonant (cruix el dit [kɾuʒ əl], vaig de bòlit [bad͡ʒ də])
    if ((bv || (bc && VOICED.has(bc))) && /ʃ$/.test(c) && !/ʃ[ʒ]/.test(c)) { c = /t͡ʃ$/.test(c) ? c.replace(/t͡ʃ$/, 'd͡ʒ') : c.slice(0, -1) + 'ʒ'; mod = true; }
    // s -> z before a vowel (central-type) or a voiced consonant (all)
    if (/s$/.test(c) && !/ts$/.test(c) && ((lat && bv) || (bc && VOICED.has(bc)))) { c = c.slice(0, -1) + 'z'; mod = true; }
    // final p t k voice before a voiced consonant
    else if (/[ptk]$/.test(c) && bc && VOICED.has(bc) && !/[ʃ]$/.test(c)) { c = c.slice(0, -1) + { p: 'b', t: 'd', k: 'ɡ' }[c.slice(-1)]; mod = true; }
    // final n assimilates to the next consonant
    else if (/n$/.test(c) && bc) {
      const m = { p: 'm', b: 'm', m: 'm', f: 'ɱ', v: 'ɱ', k: 'ŋ', ɡ: 'ŋ', g: 'ŋ' }[bc];
      if (m) { c = c.slice(0, -1) + m; mod = true; }
    }
    if (mod) { a.cipa = c; a.connected = true; }
    // phonological words: proclitic + host, host + hyphenated clitic
    const joined = elided || (PROCLITIC.has(a.word.toLowerCase()) && !a.hyphenBefore) || b.hyphenBefore;
    if (joined) {
      b.joinPrev = true;
      if (PROCLITIC.has(a.word.toLowerCase()) && !b.hyphenBefore) a.cipa = a.cipa.replace(/[ˈˌ]/g, '');
      if (b.hyphenBefore) b.cipa = b.cipa.replace(/[ˈˌ]/g, '');
      // resyllabify: last consonant moves to the next vowel; add a syllable dot between joined words
      const st = /^[ˈˌ]/.test(b.cipa) ? b.cipa[0] : '';
      const body = b.cipa.slice(st.length);
      if (elided && /^[^aeiouɛɔəɐ.ˈˌ]$/.test(a.cipa)) { b.cipa = st + a.cipa + body; a.cipa = ''; a.hide = true; b.joinPrev = !!a.joinPrev; continue; }
      const m = /^(.+)([^aeiouɛɔəɐ.ˈˌ])$/.exec(a.cipa);
      if (bv && m && !/͡/.test(a.cipa.slice(-3)) && !/[ʃʒ]$/.test(a.cipa)) {
        a.cipa = m[1].replace(/\.$/, '') + (st ? '' : '.');
        b.cipa = st + m[2] + body;
      } else if (!st && !/\.$/.test(a.cipa)) a.cipa += '.';
    }
  }
  // compound numerals (vint-i-tres, trenta-dos): main stress on the last element, secondary on the first
  const TENS = new Set(['vint', 'trenta', 'quaranta', 'cinquanta', 'seixanta', 'setanta', 'vuitanta', 'noranta']);
  for (let i = 0; i < items.length; i++) {
    const a = items[i];
    if (a.source === 'punct' || a.hide || !TENS.has(a.word.toLowerCase()) || a.hyphenBefore) continue;
    let j = i + 1;
    while (j < items.length && items[j].hyphenBefore && items[j].source !== 'punct') j++;
    const last = j - 1;
    if (last <= i) continue;
    a.cipa = a.cipa.replace(/ˈ/g, 'ˌ').replace(/ɛ/g, 'e').replace(/ɔ/g, 'o');
    const L = items[last];
    let ci = L.ipa.replace(/^[ˈˌ]/, '');
    if (/^[bdɡ]/.test(ci) && /[aeiouɛɔəɐ]$/.test(items[last - 1].cipa.replace(/\.$/, ''))) ci = ({ b: 'β', d: 'ð', ɡ: 'ɣ' })[ci[0]] + ci.slice(1);
    L.cipa = 'ˈ' + ci;
    L.connected = true;
    for (let k = i; k < last; k++) items[k].connected = true;
  }
  // drop the syllable dot before a joined word that starts with a stress mark (als la una [əlzˈlu.nə])
  const vis = items.filter(x => !x.hide && x.source !== 'punct');
  for (let k = 0; k + 1 < vis.length; k++) {
    if (vis[k + 1].joinPrev && /^[ˈˌ]/.test(vis[k + 1].cipa)) vis[k].cipa = vis[k].cipa.replace(/\.$/, '');
  }
}

function applyLiaison(items) {
  for (let i = 0; i < items.length - 1; i++) {
    const a = items[i], b = items[i + 1];
    if (!a || !b || a.source === 'punct' || b.source === 'punct' || a.note === 'clitic') continue;
    if (!/(n|l)t$/i.test(a.word) || !/^h?[aeiouàèéíòóúïü]/i.test(b.word) || /^h?[iu][aeiou]/i.test(b.word)) continue;
    const fix = x => (/[nɫl]$/.test(x) ? x + 't' : x);
    const alts = a.alts.map(fix);
    if (alts.join() === a.alts.join()) continue;
    a.alts = alts; a.ipa = alts[0]; a.liaison = true;
  }
}
