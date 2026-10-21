# tools/cawikt — Viccionari (ca.wiktionary) pronunciations, evaluation only

Not used by the site. Source: dump cawiktionary-latest-pages-articles.xml.bz2 (Wikimedia, October 2026),
text under CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/). Attribution: "Viccionari
(https://ca.wiktionary.org), contributors; adapted (IPA extracted from {{ca-pron}})". Any derived file must keep
CC BY-SA 4.0.

- `extract.py` dump -> `cawikt.json` { word: { central, valencia, nordoccidental, balear, rossellones } } and
  `cawikt-meta.json` { word: auto | hints | manual }. Stored gzipped (`*.json.gz`); `gunzip -k` to use.
- `compare.mjs` report against lexicon.json (`report.txt`).

    python -I extract.py cawiktionary-latest-pages-articles.xml.bz2 . 4
    node compare.mjs cawikt.json cawikt-meta.json top100k.txt
