// Compare the working tree with a git ref (default origin/main), word by word over the wordfreq top 100k,
// and judge each changed word against the Viccionari (tools/cawikt). Exit code 1 if a change makes a word worse
// than before by the Viccionari, unless --allow-worse.
// Usage: node tools/tests/compare-ref.mjs [ref] [--allow-worse] [--show N]
import fs from 'fs';
import { ROOT, TOP, loadEngine, checkoutRef, viccionari, VARIETY_KEY, has, report, failed } from './lib.mjs';

const args = process.argv.slice(2);
const ref = args.find(a => !a.startsWith('--') && !/^\d+$/.test(a)) || 'origin/main';
const show = +(args[args.indexOf('--show') + 1] || 10);
const dir = checkoutRef(ref);
const [OLD, NEW] = [await loadEngine(dir), await loadEngine(ROOT)];
const oldLex = JSON.parse(fs.readFileSync(`${dir}/lexicon.json`, 'utf8'));
const VIC = await viccionari();
const nd = s => s.replace(/[ˈˌ.͡]/g, '');
const score = (ipa, ref) => !ref ? null : ref.includes(ipa) ? 2 : ref.map(nd).includes(nd(ipa)) ? 1 : 0;

console.log(`Comparació amb ${ref}\n`);
const tally = { same: 0, better: 0, worse: 0, equal: 0, unknown: 0 }; const worse = [], better = [], unknown = [];
for (const d of Object.keys(VARIETY_KEY)) for (const w of TOP) {
  let a, b; try { a = OLD.transcribeWord(w, d); } catch { a = null; }
  b = NEW.transcribeWord(w, d);
  if (a && a.ipa === b.ipa) { tally.same++; continue; }
  const ref = VIC[w]?.[VARIETY_KEY[d]];
  const sa = a ? score(a.ipa, ref) : -1, sb = score(b.ipa, ref);
  const line = `${w} ${d}: ${a ? a.ipa : '(error)'} → ${b.ipa}${ref ? ` (Viccionari ${ref[0]})` : ''}${has(oldLex, w) ? ' [lexicó]' : ''}`;
  if (sb === null) { tally.unknown++; unknown.push(line); } else if (sb > sa) { tally.better++; better.push(line); }
  else if (sb < sa) { tally.worse++; worse.push(line); } else tally.equal++;
}
console.log(`iguals ${tally.same} | canviades: millor ${tally.better}, pitjor ${tally.worse}, igual de bé/malament ${tally.equal}, sense referència ${tally.unknown}`);
for (const [t, l] of [['millor', better], ['pitjor', worse], ['sense referència', unknown]]) if (l.length) console.log(`\n${t} (mostra):\n  ${l.slice(0, show).join('\n  ')}`);
console.log();
report(!worse.length || args.includes('--allow-worse'), 'cap paraula empitjora segons el Viccionari', worse.length ? `${worse.length} empitjoren` : '');
fs.rmSync(dir, { recursive: true, force: true });
process.exit(failed() ? 1 : 0);
