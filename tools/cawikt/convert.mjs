// Viccionari IPA -> lexicon conventions (the lexicon comes from en.wiktionary via kaikki.org).
// Lexicon conventions measured on lexicon.json:
//  - no velar l (ɫ -> l), no slashes
//  - coda rhotic: r in Central, Northwestern, Balearic, Northern; ɾ in Valencian
//  - after a coda r, d/g/b stay stops (ˈɔr.dɾə, ˈllar.ɡə, sərˈbi) except in Valencian (ˈoɾ.ðɾe)
//  - β only in Central, Northwestern, Northern; Valencian and Balearic write b
//  - Northern: mid vowels e̞ o̞ for e o
const V = 'aeiouəɛɔɐ';
const CODA = new RegExp(`[rɾ](?=$|[.ˈˌ]?[^${V}jw.ˈˌ])`, 'g');

export function toLexicon(ipa, variety) {
  // typos in hand-written IPA: ASCII g and c, retroflex ɳ, accented vowels
  let s = ipa.normalize('NFC').replace(/[\/\[\]]/g, '').trim().replace(/ɫ/g, 'l')
    .replace(/g/g, 'ɡ').replace(/c/g, 'k').replace(/ɳ/g, 'ŋ').replace(/[áà]/g, 'a').replace(/[éè]/g, 'e').replace(/[íì]/g, 'i').replace(/[óò]/g, 'o').replace(/[úù]/g, 'u');
  if (variety === 'valencia') return s.replace(CODA, 'ɾ').replace(/β/g, 'b');
  s = s.replace(CODA, 'r').replace(/r([.ˈˌ]?)ð/g, 'r$1d').replace(/r([.ˈˌ]?)ɣ/g, 'r$1ɡ').replace(/r([.ˈˌ]?)β/g, 'r$1b');
  if (variety === 'balear') return s.replace(/β/g, 'b');
  if (variety === 'nordoccidental') s = s.replace(new RegExp(`([${V}jwl][.ˈˌ]?)b(?!\\.?b)`, 'g'), '$1β');
  if (variety === 'rossellones') s = s.replace(/e(?!̞)/g, 'e̞').replace(/o(?!̞)/g, 'o̞');
  return s;
}
