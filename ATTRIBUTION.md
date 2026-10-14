# Attribution and licences (TotFonetika)

- Pronunciation lexicon (data/lexicon.json, site/lexicon.json): derived from Wiktionary pronunciation data extracted by Wiktextract (https://kaikki.org/dictionary/Catalan/), dump dated 2026-10-03. Wiktionary text is available under CC BY-SA 4.0 (and GFDL). The lexicon file is an adaptation: keep it as a separate file, keep this attribution visible on the site and release the file itself under CC BY-SA 4.0. Rebuild with `node tools/build-lexicon.mjs <dump.jsonl> data/lexicon.json`.
- IPA font: Charis SIL (SIL Open Font License 1.1) via @fontsource/charis-sil, file site/fonts/charis-sil-all-400-normal.woff2. Keep the OFL notice with the font.
- Rules engine (src/engine.js), UI (src/app.js, src/style.css) and texts: written for TotFonetika from published descriptions of Catalan phonology; no third-party code copied (catalan2ipa, espeak-ng and Segre were NOT used).
- Not legal advice: confirm before public launch.
