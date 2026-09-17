import sys, glob, re, json, html
sys.path.insert(0, '/home/claude/sb')
from extract import extract, extract_docx
U = '/mnt/user-data/uploads/'
g = lambda p: glob.glob(U + p)[0]
papers = {
 'sleep-protection': extract(g('bahsassara*.pdf')),
 'sense-foraging':   extract(g('alvesmaya*.pdf'))[1:],   # drop repeated title
 'restored-spirits': extract(g('shaikhmaria*.pdf')),
 'sleeping-spell':   extract(g('ritchienina*.pdf')),
 'steady-motion':    extract(g('alrefaesarah*.pdf')),
 'metaphor-mirror':  extract(g('kowalskiabbey*Term*.pdf')),
 'nap-spell':        extract_docx(g('fouadaya*.docx'), 'Napping in Academic Life: Benefits, Barriers, and Practical Considerations.', 'appendix'),
 'dispel-stress':    extract_docx(g('kaurbrahmleen*.docx'), 'April 6', 'appendix 1b'),
}
def clean(t):
    t = t.replace('\xad', '').replace('&amp;', '&')
    t = re.sub(r'\s+', ' ', t).strip()
    return t
def fix_ref(t):
    t = clean(t).replace('<', '').replace('>', '')
    t = re.sub(r'(https?://.*)$', lambda m: m.group(1).replace(' ', ''), t)
    t = t.replace('https://doi.org/https://doi.org/', 'https://doi.org/')
    return t
# known corrections (documented in flags)
FIX = {
 'http://www.jstor.org.myaccess.library.utoronto.ca/stable/24763495': 'https://doi.org/10.1177/0956797615625989',
 'Muscate, K. A.': 'Muscatell, K. A.',
}
for slug, blocks in papers.items():
    # Brahmleen appendix 1a paragraph got typed as ref
    for b in blocks:
        b['text'] = fix_ref(b['text']) if b['type'] == 'ref' else clean(b['text'])
        for k, v in FIX.items(): b['text'] = b['text'].replace(k, v)
    for i, b in enumerate(blocks):
        if b['type'] == 'h' and b['text'].lower().startswith('appendix'):
            for x in blocks[i+1:]: x['type'] = 'p'

def ref_key(t):
    m = re.match(r'([^,(]+?)[,.] ', t); sur = m.group(1).strip() if m else t.split(',')[0]
    y = re.search(r'\((\d{4})', t); return sur, int(y.group(1)) if y else None

URL = re.compile(r'(https?://[^\s]+)')
def linkify(t):
    out = []; last = 0
    for m in URL.finditer(t):
        out.append(html.escape(t[last:m.start()]))
        u = m.group(1).rstrip('.'); out.append(f'<a href="{html.escape(u)}" target="_blank" rel="noopener">{html.escape(u)}</a>')
        last = m.start() + len(u)
    out.append(html.escape(t[last:])); return ''.join(out)

report = {}
for slug, blocks in papers.items():
    refs = [b for b in blocks if b['type'] == 'ref']
    keys = []
    for i, r in enumerate(refs):
        r['id'] = f'{slug}-r{i+1}'; sur, yr = ref_key(r['text']); r['sur'] = sur; r['year'] = yr
        r['doi'] = (re.search(r'doi\.org/(\S+)', r['text']) or [None, None])[1]
        if r['doi']: r['doi'] = r['doi'].rstrip('.')
        keys.append((sur, yr, r['id']))
    surnames = sorted({k[0] for k in keys}, key=len, reverse=True)
    alt = {'Linden': ['Linden'], 'El-Bouzaidi': ['El-Bouzaidi'], 'Escelsior': ['Escelsior', 'Excelsior'], 'Van der Zweerde': ['[Vv]an der Zweerde'], 'Lovato': ['Lovato', 'Leon']}
    pats = []
    for s in surnames:
        forms = alt.get(s, [re.escape(s)])
        pats.append((s, re.compile(r'(?<![\w-])(?:' + '|'.join(forms) + r")(?:’s|'s)?(?P<gap>[^()\d;]{0,34}?)\(?(?P<yr>(?:19|20)\d{2})")))
    cited = set(); miss = 0
    for b in blocks:
        if b['type'] == 'ref':
            b['html'] = linkify(b['text']); continue
        t = b['text']; hits = []
        if b['type'] == 'p':
            for s, p in pats:
                for m in p.finditer(t):
                    yr = int(m.group('yr')); cands = [k for k in keys if k[0] == s]
                    best = min(cands, key=lambda k: abs((k[1] or 0) - yr))
                    if abs((best[1] or 0) - yr) > 1: continue
                    hits.append((m.start(), m.end(), best[2]))
        hits.sort(); res = []; last = 0
        for a, e, rid in hits:
            if a < last: continue
            res.append(html.escape(t[last:a])); res.append(f'<a class="cite" href="#{rid}">{html.escape(t[a:e])}</a>'); last = e; cited.add(rid)
        res.append(html.escape(t[last:])); b['html'] = ''.join(res)
    report[slug] = (len(refs), len(cited), [r['sur'] + ' ' + str(r['year']) for r in refs if r['id'] not in cited])
json.dump(papers, open('/home/claude/sb/data/papers.json', 'w'), ensure_ascii=False, indent=1)
for k, v in report.items(): print(k, v)
