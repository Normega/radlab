import json, re, unicodedata
P=json.load(open('data/papers.json')); C=json.load(open('data/crossref.json'))
def norm(s): return re.sub(r'[^a-z]','',unicodedata.normalize('NFKD',s).encode('ascii','ignore').decode().lower())
for slug,bl in P.items():
  for b in bl:
    if b['type']!='ref': continue
    d=(b.get('doi') or '').rstrip('.').lower()
    if not d: print('NODOI',b['id'],b['text'][:140]); continue
    c=C[d]
    if not c['ok']: print('FAIL',b['id'],b['text'][:160]); continue
    t=b['text']; issues=[]
    if c['year']!=b['year']: issues.append(f"year {b['year']}->{c['year']}")
    fams=[a[0] for a in c['authors']]
    if fams and norm(fams[0])!=norm(b['sur']): issues.append(f"sur {b['sur']}->{fams[0]}")
    m=re.match(r'(.*?)\s*\(\d{4}',t); auth=m.group(1) if m else ''
    for f in fams[:20]:
      if norm(f) not in norm(auth): issues.append(f'missing/misspelt author {f}')
    nt=norm(c['title'])[:40]
    if nt and nt not in norm(t): issues.append('title? '+c['title'][:80])
    if issues: print('ISSUE',b['id'],issues,'\n   ',t[:200])
