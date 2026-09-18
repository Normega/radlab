import os
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
import json,re,html
P=json.load(open(os.path.join(ROOT,'data','papers.json'),encoding='utf-8'))
for slug,bl in P.items():
  R={b['id']:b for b in bl if b['type']=='ref'}; cited=set()
  for b in bl:
    if html.unescape(re.sub(r'<[^>]+>','',b['html']))!=b['text']: print('HTML/TEXT DRIFT',slug,b.get('id'),b['text'][:60])
    if b['type']=='ref': continue
    for rid,txt in re.findall(r'<a class="cite" href="#([^"]+)">(.*?)</a>',b['html']):
      cited.add(rid)
      if re.search(r'(\d{4}[ab]?)',txt).group(1)!=str(R[rid].get('ytag',R[rid]['year'])) or not txt.lower().startswith(R[rid]['sur'][:4].lower()): print('MISMATCH',rid,txt)
  print(slug,'uncited:',[(r['sur'],r['year']) for r in R.values() if r['id'] not in cited])
