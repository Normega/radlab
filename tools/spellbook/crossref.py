# Fetch Crossref metadata for every DOI in papers.json; cache to data/crossref.json
import json, os, time, urllib.request, urllib.parse
ROOT = os.path.dirname(os.path.abspath(__file__))
P = json.load(open(os.path.join(ROOT, 'data', 'papers.json'), encoding='utf-8'))
dois = sorted({b['doi'].rstrip('.').lower() for bl in P.values() for b in bl if b['type'] == 'ref' and b.get('doi')})
out = {}
for d in dois:
    url = 'https://api.crossref.org/works/' + urllib.parse.quote(d, safe='/()')
    req = urllib.request.Request(url, headers={'User-Agent': 'RADlab-spellbook/0.1 (mailto:norman@radlab.zone)'})
    try:
        m = json.load(urllib.request.urlopen(req, timeout=20))['message']
        yr = (m.get('published-print') or m.get('published-online') or m.get('issued'))['date-parts'][0][0]
        out[d] = dict(ok=True, authors=[(a.get('family', a.get('name', '')), a.get('given', '')) for a in m.get('author', [])],
                      year=yr, title=(m.get('title') or [''])[0], journal=(m.get('container-title') or [''])[0],
                      volume=m.get('volume', ''), issue=m.get('issue', ''), page=m.get('page', ''),
                      article=m.get('article-number', ''), type=m.get('type', ''))
    except Exception as e:
        out[d] = dict(ok=False, error=str(e))
    time.sleep(0.15)
json.dump(out, open(os.path.join(ROOT, 'data', 'crossref.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(sum(v['ok'] for v in out.values()), 'of', len(out), 'resolved')
