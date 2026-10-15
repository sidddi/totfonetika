// End-to-end test of the site in Chromium (desktop and phone width). Serves the repo root itself.
// Needs Playwright: npm i playwright (or set PLAYWRIGHT_MODULE to its path). Chromium: CHROMIUM=/path/to/chrome,
// default /opt/pw-browsers/chromium when it exists, else Playwright's own browser.
// Usage: node tools/tests/browser.mjs   — exit code 1 on any failure; screenshots in tools/tests/out/
import fs from 'fs';
import http from 'http';
import path from 'path';
import { createRequire } from 'module';
import { ROOT, report, failed } from './lib.mjs';

let chromium;
try { ({ chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright')); }
catch { console.log('SKIP Playwright no instal·lat (npm i playwright, o PLAYWRIGHT_MODULE=/camí/a/node_modules/playwright)'); process.exit(0); }

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
}).listen(0);
const URL = `http://localhost:${server.address().port}/`;
const OUT = path.join(ROOT, 'tools/tests/out'); fs.mkdirSync(OUT, { recursive: true });
const exe = process.env.CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const browser = await chromium.launch(exe ? { executablePath: exe } : {});

for (const vp of [{ width: 1280, height: 900, name: 'escriptori' }, { width: 375, height: 800, name: 'mobil' }]) {
  const ctx = await browser.newContext({ viewport: vp, permissions: ['clipboard-read', 'clipboard-write'], acceptDownloads: true });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && !/favicon|404/.test(m.text()) && errs.push(m.text()));
  const t0 = Date.now(); await p.goto(URL); await p.waitForSelector('textarea');
  report(true, `${vp.name}: carrega`, `${Date.now() - t0} ms`);
  const dialects = await p.$$eval('[data-d]', bs => bs.map(x => x.dataset.d));
  report(dialects.join() === 'Central,Valencia,Northwestern,Balearic', `${vp.name}: varietats`, dialects.join());
  const sw = await p.evaluate(() => document.documentElement.scrollWidth);
  report(sw <= vp.width, `${vp.name}: sense scroll horitzontal`, `${sw}px`);
  await p.fill('textarea', "L'àvia deia que la feina comença d'hora. constructor __proto__ toString"); await p.waitForTimeout(400);
  for (const d of dialects) {
    await p.click(`[data-d="${d}"]`); await p.waitForTimeout(120);
    const big = await p.innerText('.tf-big'); report(big.length > 10 && !/undefined|null|NaN/.test(big), `${vp.name}: ${d}`, big);
  }
  for (const o of ['syll', 'stress', 'brackets', 'liaison']) {
    await p.click(`[data-o="${o}"]`); await p.waitForTimeout(80);
    report((await p.innerText('.tf-big')).length > 5, `${vp.name}: opció ${o} desactivada`); await p.click(`[data-o="${o}"]`);
  }
  for (const l of ['es', 'en', 'ca']) {
    await p.click(`[data-lang="${l}"]`); await p.waitForTimeout(80); const txt = await p.innerText('body');
    report(/Viccionari|Wiktionary|Wikcionario/.test(txt) && !/rossellon|rosellon|northern/i.test(txt), `${vp.name}: idioma ${l} (atribució, sense rossellonès)`);
  }
  const nEx = await p.$$eval('[data-ex]', x => x.length);
  for (let i = 0; i < nEx; i++) { await p.click(`[data-ex="${i}"]`); await p.waitForTimeout(60); report((await p.innerText('.tf-big')).length > 3, `${vp.name}: exemple ${i + 1}`); }
  for (const a of await p.$$eval('[data-a]', x => x.map(y => y.dataset.a))) {
    const dl = p.waitForEvent('download', { timeout: 1500 }).catch(() => null);
    await p.click(`[data-a="${a}"]`); const d = await dl;
    report(a === 'copy' || !!d, `${vp.name}: botó ${a}`, d ? d.suggestedFilename() : '');
  }
  await p.fill('textarea', 'paraula '.repeat(3000)); const t1 = Date.now(); await p.innerText('.tf-big');
  report(Date.now() - t1 < 3000, `${vp.name}: text de 3.000 paraules`, `${Date.now() - t1} ms`);
  await p.fill('textarea', "La boira s'escolava entre els pins."); await p.waitForTimeout(200);
  await p.screenshot({ path: path.join(OUT, `${vp.name}.png`), fullPage: true });
  report(errs.length === 0, `${vp.name}: cap error JavaScript`, errs.join(' | '));
  await ctx.close();
}
// --- informe 15/10/2026: punts 2, 6 i 8 ---
{
  // 6. long words must stay inside the viewport (word list grid), at phone widths
  for (const width of [320, 375, 390]) {
    const ctx = await browser.newContext({ viewport: { width, height: 800 } }); const p = await ctx.newPage();
    await p.goto(URL); await p.waitForSelector('textarea');
    for (const text of ['anticonstitucionalíssimament', 'xyzqwxyzqwxyzqwxyzqwxyzqwxyzqw', 'pneumonoultramicroscòpicsilicovolcanoconiosi', 'dona', 'anticonstitucionalíssimament electroencefalografistes']) {
      await p.fill('textarea', text); await p.waitForTimeout(150);
      const m = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth,
        out: [...document.querySelectorAll('.tf-words li > *, .tf-big')].map(e => e.getBoundingClientRect()).filter(r => r.right > innerWidth + 0.5 || r.left < -0.5).length }));
      report(m.sw <= m.iw && m.out === 0, `mòbil ${width}px: "${text.slice(0, 28)}" dins la pantalla`, `scrollWidth ${m.sw}, innerWidth ${m.iw}, elements fora ${m.out}`);
    }
    await p.fill('textarea', 'anticonstitucionalíssimament'); await p.waitForTimeout(150);
    await p.screenshot({ path: path.join(OUT, `mot-llarg-${width}.png`), fullPage: true });
    await ctx.close();
  }
  // 8. document language follows the UI; IPA results stay ca-fonipa; text is kept
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } }); const p = await ctx.newPage();
    await p.goto(URL); await p.waitForSelector('textarea'); await p.fill('textarea', 'Bon dia, com estàs?'); await p.waitForTimeout(150);
    for (const l of ['ca', 'es', 'en', 'ca']) {
      await p.click(`[data-lang="${l}"]`); await p.waitForTimeout(100);
      const st = await p.evaluate(() => ({ lang: document.documentElement.lang, text: document.querySelector('textarea').value,
        ipa: [...document.querySelectorAll('.tf-big, .tf-words .i')].every(e => e.getAttribute('lang') === 'ca-fonipa'),
        ex: [...document.querySelectorAll('[data-ex]')].every(e => e.getAttribute('lang') === 'ca'),
        w: [...document.querySelectorAll('.tf-words .w')].every(e => e.getAttribute('lang') === 'ca') }));
      report(st.lang === l && st.text === 'Bon dia, com estàs?' && st.ipa && st.ex && st.w, `idioma ${l}: <html lang>, text conservat, AFI ca-fonipa, exemples i mots ca`, JSON.stringify(st));
    }
    await ctx.close();
  }
  // 2. NFD input: same visible result and same TXT / CSV / copy as NFC
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'], acceptDownloads: true });
    const p = await ctx.newPage(); await p.goto(URL); await p.waitForSelector('textarea');
    const grab = async text => {
      await p.fill('textarea', text); await p.waitForTimeout(150);
      const big = await p.innerText('.tf-big'), words = await p.innerText('.tf-words');
      const dl = async a => { const w = p.waitForEvent('download'); await p.click(`[data-a="${a}"]`); return fs.readFileSync(await (await w).path(), 'utf8'); };
      const txt = await dl('txt'), csv = await dl('csv');
      await p.click('[data-a="copy"]'); await p.waitForTimeout(100); const clip = await p.evaluate(() => navigator.clipboard.readText()).catch(() => null);
      return { big, words, txt, csv, clip };
    };
    for (const d of ['Central', 'Valencia', 'Northwestern', 'Balearic']) {
      await p.click(`[data-d="${d}"]`);
      const t = 'La qüestió del raïm és veïna; QÜESTIÓ, àvia i pingüí.';
      const a = await grab(t.normalize('NFC')), b = await grab(t.normalize('NFD'));
      const stray = /[\u0300-\u031D\u031F-\u0328\u032A-\u032E\u0330-\u0360\u0362-\u036F]/u;
      const same = ['big', 'words', 'txt', 'csv', 'clip'].filter(k => a[k] !== b[k]);
      report(!same.length && !stray.test(b.big + b.txt + b.csv), `NFD = NFC al web (${d}): resultat, llista, TXT, CSV, còpia`, same.length ? 'difereixen: ' + same.join(', ') : '');
    }
    await ctx.close();
  }
}
await browser.close(); server.close();
console.log(failed() ? `\n${failed()} proves han fallat` : '\nTot correcte');
process.exit(failed() ? 1 : 0);
