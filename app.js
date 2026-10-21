import { DIALECTS, setLexicon, setLemmas, transcribe } from './engine.js';
import { T, EXAMPLES, LEGEND } from './i18n.js';

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const BIRD = `<svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="64" height="58" viewBox="-16 -6 236 214"><g stroke="#14161c" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"><path d="M138 146L192 148L180 162L198 174L170 176L182 192L128 176z" fill="#0a4a39"/><path d="M84 178l-6 14h20l-2-14z" fill="#fb923c"/><path d="M116 178l6 14h-20l2-14z" fill="#fb923c"/><g class="wl"><path d="M48 100C22 100 6 126 10 160Q12 172 20 178Q30 166 40 158C50 148 56 126 54 108z" fill="#0f6b52"/><path d="M22 138q12 0 20 10M18 156q10-2 18 6" fill="none" stroke-width="5"/></g><g class="wr"><path d="M152 100C178 100 194 126 190 160Q188 172 180 178Q170 166 160 158C150 148 144 126 146 108z" fill="#0f6b52"/><path d="M178 138q-12 0-20 10M182 156q-10-2-18 6" fill="none" stroke-width="5"/></g><path d="M100 48C54 48 36 84 36 118c0 40 28 64 64 64s64-24 64-64c0-34-18-70-64-70z" fill="#1f9d74"/><path d="M82 52C74 36 80 20 92 12c0 14 8 16 10 36z" fill="#14161c"/><path d="M104 50c4-16 14-24 26-26-2 14-8 22-14 30z" fill="#14161c"/><ellipse cx="100" cy="156" rx="36" ry="24" fill="#c8e86a" stroke="none"/><g transform="translate(0,8)"><path d="M85 130c2 13 28 13 30 0z" fill="#f59e0b"/><path d="M89 124h22l-3 9h-16z" fill="#14161c" stroke-width="3"/><path d="M81 118c0-8 8-14 19-14s19 6 19 14c0 5-10 11-19 11s-19-6-19-11z" fill="#fb923c"/></g></g><g stroke="#14161c" stroke-width="5"><circle cx="70" cy="94" r="18" fill="#fff"/><circle cx="130" cy="94" r="18" fill="#fff"/></g><circle cx="74" cy="96" r="9" fill="#14161c"/><circle cx="126" cy="96" r="9" fill="#14161c"/><circle cx="77" cy="92" r="3.5" fill="#fff"/><circle cx="129" cy="92" r="3.5" fill="#fff"/><circle cx="46" cy="124" r="7" fill="#fb923c" opacity=".4"/><circle cx="148" cy="124" r="7" fill="#fb923c" opacity=".4"/></svg>`;

function fmt(ipa, o) {
  let s = ipa;
  if (!o.syll) s = s.replace(/\./g, '');
  if (!o.stress) s = s.replace(/[ˈˌ]/g, '');
  return s;
}
function wrap(s, o) { return !s ? '' : (o.brackets ? '[' + s + ']' : s); }

export function mount(root, { lexicon, lemmas = null, lang = 'ca' } = {}) {
  setLexicon(lexicon); setLemmas(lemmas);
  const st = { lang, dialect: 'Central', text: '', syll: true, stress: true, brackets: true, liaison: true, copied: false, hasVoice: false, speaking: false };
  let caVoice = null; // a LOCAL Catalan voice only: network voices would send the text off the device (see privacy note)
  function pickVoice() {
    if (!('speechSynthesis' in window)) return;
    caVoice = window.speechSynthesis.getVoices().find(v => v.localService && /^ca([-_]|$)/i.test(v.lang)) || null;
    const has = !!caVoice;
    if (has !== st.hasVoice) { st.hasVoice = has; keepFocus(renderResults); }
  }
  const t = () => T[st.lang];

  function results() {
    const items = transcribe(st.text, st.dialect, { liaison: st.liaison }).filter(x => x.source !== 'punct' || x.word);
    const words = items.filter(x => x.source !== 'punct');
    return { items, words };
  }
  function lineOf(items, o) {
    let out = '';
    items.filter(x => !x.hide && x.source !== 'unknown').forEach((x, i) => {
      const piece = x.source === 'punct' ? x.word : (fmt(x.cipa || x.ipa, o) || x.word);
      out += (i && !(x.joinPrev && x.source !== 'punct') ? ' ' : '') + piece;
    });
    return out.replace(/\s+([,.;:!?…])/g, '$1').trim();
  }
  function srcLabel(x) {
    const L = t();
    if (x.source === 'unknown') return L.srcUnknown;
    if (x.note === 'function word') return L.srcFunc;
    return x.source === 'lexicon' ? L.srcLex : x.source === 'derived' ? L.srcDerived : x.source === 'lemma' ? L.srcLemma : L.srcRules;
  }

  // The page is built once; the textarea is never re-created (caret, IME and dead keys survive). Each part is
  // re-rendered on its own: the input only refreshes the results.
  root.innerHTML = `
<div class="tf">
  <header class="tf-head" data-part="head"></header>
  <main>
    <section class="tf-card">
      <textarea id="tf-in" lang="ca" rows="4"></textarea>
      <div data-part="controls"></div>
    </section>
    <section class="tf-card" data-part="results"></section>
    <section class="tf-card" data-part="legend"></section>
  </main>
  <footer class="tf-foot" data-part="foot"></footer>
</div>`;
  const part = n => root.querySelector(`[data-part="${n}"]`);
  const ta = root.querySelector('#tf-in');

  function renderHead() {
    const L = t();
    part('head').innerHTML = `
    <div class="tf-brand">${BIRD}<div><h1>TotFonetika</h1><p>${esc(L.tagline)}</p></div></div>
    <div class="tf-lang" role="group" aria-label="${({ ca: 'Idioma', es: 'Idioma', en: 'Language' })[st.lang]}">${['ca', 'es', 'en'].map(l => `<button class="tf-chip ${l === st.lang ? 'on' : ''}" data-lang="${l}" aria-pressed="${l === st.lang}">${l.toUpperCase()}</button>`).join('')}</div>`;
  }
  function renderControls() {
    const L = t();
    const q = DIALECTS.find(d => d.id === st.dialect).quality;
    const qLabel = q === 'good' ? L.qualityGood : q === 'medium' ? L.qualityMedium : L.qualityLow;
    part('controls').innerHTML = `
    <div class="tf-examples"><span>${esc(L.examples)}:</span>${EXAMPLES.map((e, i) => `<button class="tf-chip" lang="ca" data-ex="${i}">${esc(e)}</button>`).join('')}</div>
    <div class="tf-row"><span class="tf-label" id="tf-dialect-label">${esc(L.dialect)}</span>
      <div class="tf-seg" role="radiogroup" aria-labelledby="tf-dialect-label">${DIALECTS.map(d => `<button role="radio" aria-checked="${d.id === st.dialect}" tabindex="${d.id === st.dialect ? 0 : -1}" class="tf-seg-b ${d.id === st.dialect ? 'on' : ''}" data-d="${d.id}">${esc(d.label[st.lang])}</button>`).join('')}</div>
    </div>
    <p class="tf-q tf-q-${q}"><b>${esc(qLabel)}.</b></p>
    <div class="tf-opts">
      <label><input type="checkbox" data-o="syll" ${st.syll ? 'checked' : ''}> ${esc(L.syll)}</label>
      <label><input type="checkbox" data-o="stress" ${st.stress ? 'checked' : ''}> ${esc(L.stress)}</label>
      <label><input type="checkbox" data-o="brackets" ${st.brackets ? 'checked' : ''}> ${esc(L.brackets)}</label>
      <label><input type="checkbox" data-o="liaison" ${st.liaison ? 'checked' : ''}> ${esc(L.liaison)}</label>
    </div>`;
  }
  function renderResults() {
    const L = t();
    const { items, words } = results();
    const o = { syll: st.syll, stress: st.stress, brackets: st.brackets };
    part('results').innerHTML = `
    <h2>${esc(L.result)}</h2>
    ${words.length ? `
    <div class="tf-out"><div class="tf-big" lang="ca-fonipa">${esc(wrap(lineOf(items, o), o))}</div>
      <div class="tf-actions"><button class="tf-btn" data-a="copy">${esc(st.copied ? L.copied : st.copyFailed ? L.copyFail : L.copy)}</button>${st.hasVoice ? `<button class="tf-btn" data-a="play" aria-pressed="${st.speaking}">${esc(st.speaking ? L.stop : L.play)}</button>` : ''}<button class="tf-btn ghost" data-a="txt">${esc(L.txt)}</button><button class="tf-btn ghost" data-a="csv">${esc(L.csv)}</button></div>${st.hasVoice ? `<p class="tf-note">${esc(L.audioNote)}</p>` : ''}</div>
    <h3>${esc(L.words)}</h3>
    <ul class="tf-words">${words.map(x => `<li><span class="w" lang="ca">${esc(x.word)}</span><span class="i" lang="ca-fonipa">${esc(wrap(fmt(x.ipa, o), o))}</span><span class="b b-${x.source}${x.uncertain ? ' u' : ''}">${esc(srcLabel(x))}${x.liaison ? ' · ' + esc(L.liaisonBadge) : ''}${x.uncertain && x.source !== 'unknown' ? ' · ' + esc(L.unsure) : ''}</span>${x.alts.length > 1 ? `<span class="alts">${esc(L.others)}: ${x.alts.slice(1).map(a => esc(wrap(fmt(a, o), o))).join(' , ')}</span>` : ''}</li>`).join('')}</ul>
    ` : `<p class="tf-empty">${esc(L.empty)}</p>`}
    <p class="tf-note">${esc(L.qualityNote)}</p><p class="tf-note">${esc(L.noteSandhi)}</p>`;
  }
  function renderStatic() {
    const L = t();
    part('legend').innerHTML = `<h2>${esc(L.legend)}</h2><p class="tf-note">${esc(L.legendSub)}</p>
    <div class="tf-legend">${LEGEND.map(([s, e]) => `<div><b lang="ca-fonipa">${esc(s)}</b><span>${esc(e)}</span></div>`).join('')}</div>`;
    part('foot').innerHTML = `<p>${esc(L.privacy)}</p><p><b>${esc(L.about)}.</b> ${esc(L.aboutText)}</p>`;
    ta.placeholder = L.placeholder; ta.setAttribute('aria-label', L.placeholder);
    // the page language follows the UI; Catalan input, examples and words keep lang="ca", IPA keeps ca-fonipa
    if (root.ownerDocument) root.ownerDocument.documentElement.lang = st.lang;
  }
  // re-render keeping keyboard focus on the same control (buttons and checkboxes are re-created)
  function keepFocus(fn) {
    const a = root.ownerDocument && root.ownerDocument.activeElement;
    const key = a && a !== ta && ['d', 'lang', 'o', 'ex', 'a'].map(k => a.dataset && a.dataset[k] !== undefined ? `[data-${k}="${a.dataset[k]}"]` : '').find(Boolean);
    fn();
    if (key) { const n = root.querySelector(key); if (n) n.focus(); }
  }
  function render() { keepFocus(() => { renderHead(); renderControls(); renderResults(); renderStatic(); }); }
  function setDialect(id, focus) {
    st.dialect = id; keepFocus(() => { renderControls(); renderResults(); });
    if (focus) root.querySelector(`[data-d="${id}"]`).focus();
  }
  function setText(v) { st.text = v; st.copied = false; if (ta.value !== v) ta.value = v; renderResults(); }

  ta.addEventListener('input', () => setText(ta.value));
  root.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || !root.contains(b)) return;
    if (b.dataset.lang) { st.lang = b.dataset.lang; render(); }
    else if (b.dataset.d) setDialect(b.dataset.d);
    else if (b.dataset.ex !== undefined) setText(EXAMPLES[+b.dataset.ex]);
    else if (b.dataset.a) action(b.dataset.a);
  });
  root.addEventListener('change', e => { const c = e.target; if (c.dataset && c.dataset.o) { st[c.dataset.o] = c.checked; keepFocus(renderResults); } });
  // radiogroup keyboard: arrows move and select (wrapping), Home/End go to the ends (WAI-ARIA radio group pattern)
  root.addEventListener('keydown', e => {
    const b = e.target.closest && e.target.closest('[role="radio"]'); if (!b) return;
    const ids = DIALECTS.map(d => d.id), i = ids.indexOf(b.dataset.d);
    const j = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: ids.length - 1 }[e.key];
    if (j === undefined) return;
    e.preventDefault(); setDialect(ids[(j + ids.length) % ids.length], true);
  });
  async function action(a) {
    const { items, words } = results();
    const o = { syll: st.syll, stress: st.stress, brackets: st.brackets };
    const line = wrap(lineOf(items, o), o);
    if (a === 'copy') {
      let ok = false;
      try { await navigator.clipboard.writeText(line); ok = true; } catch { }
      if (!ok) {
        try {
          const ta2 = document.createElement('textarea'); ta2.value = line; ta2.setAttribute('readonly', ''); ta2.style.cssText = 'position:fixed;left:-9999px;top:0';
          document.body.appendChild(ta2); ta2.select(); ok = document.execCommand('copy'); ta2.remove();
        } catch { }
      }
      if (!ok) { st.copyFailed = true; keepFocus(renderResults); setTimeout(() => { st.copyFailed = false; keepFocus(renderResults); }, 2500); return; }
      st.copied = true; keepFocus(renderResults); setTimeout(() => { st.copied = false; keepFocus(renderResults); }, 1500); return; }
    if (a === 'play') {
      if (!caVoice) return;
      if (st.speaking) { window.speechSynthesis.cancel(); st.speaking = false; keepFocus(renderResults); return; }
      const u = new SpeechSynthesisUtterance(st.text);
      u.voice = caVoice; u.lang = caVoice.lang; u.rate = 0.95;
      u.onend = u.onerror = () => { st.speaking = false; keepFocus(renderResults); };
      st.speaking = true; window.speechSynthesis.speak(u); keepFocus(renderResults); return; }
    const csv = 'word,ipa,dialect,source\n' + words.map(x => [x.word, wrap(fmt(x.ipa, o), o), st.dialect, x.source].map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n');
    const body = a === 'txt' ? line + '\n' : csv + '\n';
    const blob = new Blob([body], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = a === 'txt' ? 'totfonetika.txt' : 'totfonetika.csv'; link.click(); URL.revokeObjectURL(link.href);
  }
  render();
  pickVoice();
  if ('speechSynthesis' in window) window.speechSynthesis.onvoiceschanged = pickVoice;
}
