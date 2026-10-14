#!/usr/bin/env python3
"""Extract Catalan pronunciations from a ca.wiktionary dump.

Usage: python -I extract.py cawiktionary-latest-pages-articles.xml.bz2 OUTDIR

Writes:
  OUTDIR/cawikt.json      { word: { central, valencia, nordoccidental, balear, rossellones } }  (each a list of IPA strings)
  OUTDIR/cawikt-raw.jsonl one line per page: the raw pronunciation template calls and explicit IPA found in the Catalan section,
                          plus a flag saying whether the IPA came from template parameters or only from the spelling.

Template pages (Plantilla:) and Lua modules (Mòdul:) from the same dump are loaded into wikitextprocessor so that
{{ca-pron}} is expanded exactly as the wiki renders it.
"""
import bz2, json, re, sys, os, collections
import xml.etree.ElementTree as ET

NS = {'0': 'main', '10': 'Plantilla', '828': 'Mòdul'}
CA_HEADER = re.compile(r'^==\s*(\{\{-ca-\}\}|Català)\s*==\s*$', re.M)
L2 = re.compile(r'^==[^=].*==\s*$', re.M)
PRON_TPL = re.compile(r'\{\{\s*(ca-pron|pron|AFI|IPA)\s*\|[^{}]*\}\}', re.I)
IPA = re.compile(r'[/\[]([^/\[\]]*[ˈˌəɛɔʎɲʃʒɾ][^/\[\]]*)[/\]]')

VARIETY = [  # label regex -> key (checked in order)
    (re.compile(r'rossellon|septentrional|nord-oriental', re.I), 'rossellones'),
    (re.compile(r'nord-occidental|occidental|lleidat|ribagor|tortosí', re.I), 'nordoccidental'),
    (re.compile(r'valenci|alacant', re.I), 'valencia'),
    (re.compile(r'balear|mallorqu|menorqu|eivissenc', re.I), 'balear'),
    (re.compile(r'central|oriental|barcelon', re.I), 'central'),
]


def pages(path):
    with bz2.open(path, 'rb') as f:
        title = ns = text = None
        for ev, el in ET.iterparse(f, events=('end',)):
            tag = el.tag.rsplit('}', 1)[-1]
            if tag == 'title': title = el.text
            elif tag == 'ns': ns = el.text
            elif tag == 'text': text = el.text or ''
            elif tag == 'page':
                yield title, ns, text
                el.clear()


def catalan_section(text):
    m = CA_HEADER.search(text)
    if not m: return None
    n = L2.search(text, m.end())
    return text[m.end(): n.start() if n else len(text)]


def variety_of(label):
    for rx, key in VARIETY:
        if rx.search(label): return key
    return None


def ipa_by_variety(rendered):
    """Rendered HTML/wikitext of a pronunciation block -> {variety: [ipa, ...]}. Each line/list item: label + IPA."""
    out = collections.defaultdict(list)
    for line in re.split(r'\n|<li|<tr|<br', rendered):
        ipas = IPA.findall(line)
        if not ipas: continue
        label = IPA.sub('', re.sub(r'<[^>]+>', ' ', line))
        key = variety_of(label)
        if key:
            for i in ipas:
                i = i.strip()
                if i and i not in out[key]: out[key].append(i)
    return out


def main(dump, outdir):
    os.makedirs(outdir, exist_ok=True)
    from wikitextprocessor import Wtp
    from wikitextprocessor.core import Page  # noqa: F401  (import check)
    wtp = Wtp(db_path=os.path.join(outdir, 'wtp.db'), lang_code='ca', project='wiktionary')
    entries = []
    for title, ns, text in pages(dump):
        if ns in ('10', '828'):
            wtp.add_page(f'{NS[ns]}:{title.split(":", 1)[-1]}', int(ns), text,
                         model='Scribunto' if ns == '828' else 'wikitext')
        elif ns == '0':
            sec = catalan_section(text)
            if sec is not None:
                entries.append((title, sec))
    wtp.db_conn.commit()

    result, raw = {}, open(os.path.join(outdir, 'cawikt-raw.jsonl'), 'w', encoding='utf-8')
    for title, sec in entries:
        calls = [m.group(0) for m in PRON_TPL.finditer(sec)]
        explicit = IPA.findall(sec)
        if not calls and not explicit: continue
        wtp.start_page(title)
        vars_ = collections.defaultdict(list)
        for c in calls:
            try:
                rendered = wtp.expand(c)
            except Exception as e:  # keep going, log
                rendered = ''
            for k, v in ipa_by_variety(rendered).items():
                vars_[k] += [x for x in v if x not in vars_[k]]
        # explicit IPA written in the section outside templates (lines with a variety label)
        for k, v in ipa_by_variety(PRON_TPL.sub('', sec)).items():
            vars_[k] += [x for x in v if x not in vars_[k]]
        # a ca-pron call with only the template name (or only the page name) is generated from spelling
        auto = all(re.fullmatch(r'\{\{\s*ca-pron\s*(\|\s*(' + re.escape(title) + r')?\s*)?\}\}', c) for c in calls) and bool(calls)
        raw.write(json.dumps({'w': title, 'calls': calls, 'auto_only': auto, 'ipa': vars_}, ensure_ascii=False) + '\n')
        if vars_:
            result[title] = dict(vars_)
    raw.close()
    with open(os.path.join(outdir, 'cawikt.json'), 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, sort_keys=True)
    print(f'catalan pages: {len(entries)}; with pronunciation: {len(result)}')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
