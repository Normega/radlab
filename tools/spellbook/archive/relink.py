import re, html
URL = re.compile(r'(https?://[^\s]+)')
def linkify(t):
    out = []; last = 0
    for m in URL.finditer(t):
        out.append(html.escape(t[last:m.start()]))
        u = m.group(1).rstrip('.'); out.append(f'<a href="{html.escape(u)}" target="_blank" rel="noopener">{html.escape(u)}</a>')
        last = m.start() + len(u)
    out.append(html.escape(t[last:])); return ''.join(out)
ALT = {'Van der Zweerde': ['[Vv]an der Zweerde']}
def relink(blocks):
    refs = [b for b in blocks if b['type'] == 'ref' and b['id'].split('-')[-1].startswith('r')]
    keys = [(r['sur'], r['year'], r['id']) for r in refs]
    surnames = sorted({k[0] for k in keys}, key=len, reverse=True)
    pats = []
    for s in surnames:
        forms = ALT.get(s, [re.escape(s)])
        pats.append((s, re.compile(r'(?<![\w-])(?:' + '|'.join(forms) + r")(?:’s|'s)?(?P<gap>[^()\d;]{0,34}?)\(?(?P<yr>(?:19|20)\d{2})")))
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
            res.append(html.escape(t[last:a])); res.append(f'<a class="cite" href="#{rid}">{html.escape(t[a:e])}</a>'); last = e
        res.append(html.escape(t[last:])); b['html'] = ''.join(res)
