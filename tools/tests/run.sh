#!/usr/bin/env bash
# Run all TotFonetika tests from the repo root: bash tools/tests/run.sh [git-ref-to-compare, default origin/main]
# Optional: PLAYWRIGHT_MODULE (browser test), ESPEAK_NG (comparison with Projecte AINA's eSpeak-NG).
set -u
cd "$(dirname "$0")/../.."
status=0
echo "== 1. Robustesa, lexicó i casos de referència";            node tools/tests/check.mjs || status=1
echo; echo "== 2. Canvis respecte de ${1:-origin/main}";         node tools/tests/compare-ref.mjs "${1:-origin/main}" || status=1
echo; echo "== 3. Navegador";                                     node tools/tests/browser.mjs || status=1
echo; echo "== 4. Comparació amb eSpeak-NG (opcional)";           node tools/tests/espeak.mjs || status=1
echo; [ $status -eq 0 ] && echo "TOTES LES PROVES OK" || echo "HI HA PROVES QUE FALLEN"
exit $status
