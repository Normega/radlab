import json, re, base64, sys, os
ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'dist', 'index.html')
sys.path.insert(0, ROOT)
from spells import CHAPTERS, NEEDS, SPELLS
P = json.load(open(os.path.join(ROOT, 'data', 'papers.json'), encoding='utf-8'))
for slug, bl in P.items():
    for b in bl:
        if b['type'] != 'ref': continue
        t = b['text']
        m = re.match(r'(.*?)\s*\((\d{4}[^)]*)\)\.?\s*(.*)', t)
        authors, rest = (m.group(1), m.group(3)) if m else (t, '')
        names = re.findall(r"([^,&]+?), (?:[A-ZÀ-ÞØ]\.\s?-?)+", authors)
        sur = b['sur']
        if 'et al' in authors or len(names) > 2: short = f"{sur} et al. ({b.get('ytag', b['year'])})"
        elif len(names) == 2: short = f"{names[0].strip()} & {names[1].strip().lstrip('& ')} ({b['year']})"
        else: short = f"{sur} ({b['year']})"
        title = re.split(r'(?<=[.?])\s', rest, 1)[0].rstrip('.') if rest else ''
        b['short'] = short; b['title'] = title
        for k in ('sur',): b.pop(k, None)
imgs = {}
used = {p['img'] for s in SPELLS for p in s['pages'] if 'img' in p}
for name in sorted(used):
    imgs[name] = 'data:image/webp;base64,' + base64.b64encode(open(os.path.join(ROOT, 'img', f'{name}.webp'), 'rb').read()).decode()
data = dict(chapters=CHAPTERS, needs=NEEDS, spells=SPELLS, papers=P, images=imgs)
js = json.dumps(data, ensure_ascii=False).replace('</', '<\\/')
html = open(os.path.join(ROOT, 'template.html'), encoding='utf-8').read().replace('__DATA__', js)
os.makedirs(os.path.dirname(OUT), exist_ok=True)
open(OUT, 'w', encoding='utf-8', newline='\n').write(html)
print(len(html)//1024, 'KB')
for s in SPELLS:
    for p in s['pages']:
        for c in p.get('cites', []) + s['sources']:
            if not any(b.get('id') == c for b in P[c.rsplit('-', 1)[0]]): print('BAD ID', c)
