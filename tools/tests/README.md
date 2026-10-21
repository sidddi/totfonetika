# Proves de TotFonetika

No formen part del web. Executeu-les des de l'arrel del repo abans de fusionar res a `main`:

    bash tools/tests/run.sh            # compara amb origin/main
    bash tools/tests/run.sh e711cc9    # o amb qualsevol commit

Requisits: Node 18+. Opcionals: Playwright per a la prova del navegador
(`npm i playwright`, o `PLAYWRIGHT_MODULE=/camí/node_modules/playwright`) i el binari d'eSpeak-NG de Projecte AINA
(`ESPEAK_NG=/camí/espeak-ng`, vegeu la capçalera d'`espeak.mjs`). Sense ells, aquestes dues proves se salten.

| Script | Què comprova | Falla si… |
|---|---|---|
| `check.mjs` | Les 6 varietats; ~460.000 transcripcions (top 100.000 de wordfreq, tot el lexicó, noms interns de JavaScript com `constructor`, entrades estranyes) sense errors ni caràcters que no siguin AFI; format del lexicó; rendiment; 187 casos de referència revisats a mà (`data/golden.json`). | qualsevol error, o si un cas de referència canvia |
| `compare-ref.mjs [ref]` | Cada paraula del top 100.000 × 4 varietats amb jutge (central, valencià, nord-occidental, balear), abans (ref) i ara; cada canvi es jutja amb el Viccionari (`tools/cawikt`). | alguna paraula empitjora (`--allow-worse` per acceptar-ho) |
| `browser.mjs` | El web a Chromium, escriptori i mòbil: varietats, opcions, idiomes, exemples, copiar, descarregar TXT/CSV, text llarg, sense scroll horitzontal ni errors JavaScript. Captures a `out/`. | qualsevol d'aquestes coses |
| `espeak.mjs` | Encert de TotFonetika i d'eSpeak-NG (AINA) amb el Viccionari revisat com a jutge. Només informa. | — |

Quan un canvi és volgut i altera un cas de referència: reviseu-lo i executeu `node tools/tests/check.mjs --update-golden`.

Dades: `data/top100k.txt.gz` és `wordfreq.top_n_list('ca', 100000)` (wordfreq, dades CC BY-SA 4.0).
