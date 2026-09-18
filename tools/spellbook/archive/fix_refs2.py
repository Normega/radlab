# Round 2: add refs missing from Aya's list, drop uncited Murphy (2016), Cousins 2019a/b
import json, sys, html as H
sys.path.insert(0, '/home/claude/sb')
from relink import linkify
F = '/home/claude/sb/data/papers.json'
P = json.load(open(F)); nap = P['nap-spell']
def ref(rid, sur, year, text, doi=None):
    return dict(type='ref', text=text, id=rid, sur=sur, year=year, doi=doi, html=linkify(text))
NEW = [  # (insert after id, block)
 ('nap-spell-r6', ref('nap-spell-r34', 'Dennison', 2017,
   "Dennison, S. A. (2017). The effects of sleep time and power napping on memory and vigilance [Master's thesis, University of Huddersfield]. University of Huddersfield Repository. https://eprints.hud.ac.uk/id/eprint/34407/")),
 ('nap-spell-r19', ref('nap-spell-r35', 'Liu', 2019,
   "Liu, J., Feng, R., Ji, X., Cui, N., Raine, A., & Mednick, S. C. (2019). Midday napping in children: Associations between nap frequency and duration across cognitive, positive psychological well-being, behavioral, and metabolic health outcomes. Sleep, 42(9), Article zsz126. https://doi.org/10.1093/sleep/zsz126",
   '10.1093/sleep/zsz126')),
 ('nap-spell-r31', ref('nap-spell-r36', 'Tamaki', 2020,
   "Tamaki, M., Wang, Z., Barnes-Diana, T., Guo, D., Berard, A. V., Walsh, E., Watanabe, T., & Sasaki, Y. (2020). Complementary contributions of non-REM and REM sleep to visual learning. Nature Neuroscience, 23(9), 1150–1156. https://doi.org/10.1038/s41593-020-0666-y",
   '10.1038/s41593-020-0666-y')),
]
ids = [b.get('id') for b in nap]
assert 'Spyridonidis' in nap[ids.index('nap-spell-r31')]['text']
for after, blk in NEW:
    ids = [b.get('id') for b in nap]; nap.insert(ids.index(after) + 1, blk)
nap[:] = [b for b in nap if b.get('id') != 'nap-spell-r23']          # Murphy 2016, uncited
R = {b.get('id'): b for b in nap}
for rid, tag in (('nap-spell-r5', '2019a'), ('nap-spell-r6', '2019b')):  # a = "Does splitting...", b = "The long-term..."
    b = R[rid]; b['text'] = b['text'].replace('(2019)', f'({tag})', 1); b['html'] = linkify(b['text']); b['ytag'] = tag
for b in nap:
    if b['type'] == 'ref': continue
    for rid, tag in (('nap-spell-r5', '2019a'), ('nap-spell-r6', '2019b')):
        for sep in (', ', ' ('):
            old = f'<a class="cite" href="#{rid}">Cousins et al.{sep}2019</a>'
            if old in b['html']:
                b['html'] = b['html'].replace(old, old.replace('2019<', tag + '<'))
                b['text'] = b['text'].replace(f'Cousins et al.{sep}2019', f'Cousins et al.{sep}{tag}', 1)
json.dump(P, open(F, 'w'), ensure_ascii=False, indent=1)
# spell page: move the three into cites, Cousins on page 2 is r6 -> 2019b
s = open('/home/claude/sb/spells.py').read()
old_c = '"cites": ["nap-spell-r33", "nap-spell-r30", "nap-spell-r6", "nap-spell-r28"],\n             "uncited": ["Liu et al., 2019", "Dennison, 2017", "Tamaki et al., 2020"]},'
assert old_c in s
s = s.replace(old_c, '"cites": ["nap-spell-r33", "nap-spell-r35", "nap-spell-r30", "nap-spell-r6", "nap-spell-r28", "nap-spell-r34", "nap-spell-r36"]},')
assert s.count('(Cousins et al., 2019)') == 1
s = s.replace('(Cousins et al., 2019)', '(Cousins et al., 2019b)')
open('/home/claude/sb/spells.py', 'w').write(s)
