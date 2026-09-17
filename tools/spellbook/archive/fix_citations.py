# Crossref-based cleanup of reference lists and matching in-text citations
import json, sys, re
sys.path.insert(0, '/home/claude/sb')
from relink import linkify
import html as H
P = json.load(open('/home/claude/sb/data/papers.json'))
R = {b['id']: b for bl in P.values() for b in bl if b['type'] == 'ref'}
def sub(rid, old, new, year=None, doi=None):
    b = R[rid]; assert old in b['text'], (rid, old); b['text'] = b['text'].replace(old, new)
    if year: b['year'] = year
    if doi: b['doi'] = doi
REF = [
 # year corrections (Crossref version-of-record year; volume/issue already cited)
 ('sense-foraging-r2', 'Serafini, G. (2024)', 'Serafini, G. (2025)', 2025, None),
 ('restored-spirits-r3', 'Ross, A. (2017)', 'Ross, A. (2018)', 2018, None),
 ('restored-spirits-r7', 'Chanworavit, S. (2022)', 'Chanworavit, S. (2023)', 2023, None),
 ('sleeping-spell-r6', 'Spengler, C. M. (2018)', 'Spengler, C. M. (2019)', 2019, None),
 ('metaphor-mirror-r12', 'Pavani, J.,', 'Pavani, J.-B.,', None, None),
 ('metaphor-mirror-r12', 'Congard, A. (2019)', 'Congard, A. (2020)', 2020, None),
 ('metaphor-mirror-r12', 'Health and Well-Being. https', 'Health and Well-Being, 12(2), 411–431. https', None, None),
 # wrong / dead DOIs
 ('sleep-protection-r2', '10.1016/j.jsmc.2019.02.004', '10.1016/j.jsmc.2019.02.002', None, '10.1016/j.jsmc.2019.02.002'),
 ('sleep-protection-r3', '10.1007/s12144-022-03455-1', '10.1007/s12144-022-03512-1', None, '10.1007/s12144-022-03512-1'),
 ('sleep-protection-r3', 'Current Psychology, 42, ', 'Current Psychology, 42(27), ', None, None),
 # "et al." in reference entries -> full author lists (APA 7)
 ('nap-spell-r5', 'Ong, J. L., et al. (2019)', 'Ong, J. L., Wong, K. F., & Chee, M. W. L. (2019)', None, None),
 ('nap-spell-r26', 'Bjorvatn, B., et al. (2017)', 'Bjorvatn, B., & Pallesen, S. (2017)', None, None),
 ('nap-spell-r26', 'Rhythms, 15, ', 'Rhythms, 15(2), ', None, None),
 ('nap-spell-r32', 'Tonello, L., et al. (2008)', 'Tonello, L., & Puri, B. K. (2008)', None, None),
]
INTEXT = {  # slug: [(old, new)] in student prose
 'sense-foraging': [('Excelsior et al., 2024', 'Escelsior et al., 2025'), ('Escelsior et al. (2024)', 'Escelsior et al. (2025)'), ('Escelsior et al., 2024', 'Escelsior et al., 2025')],
 'metaphor-mirror': [('Pavani and Colleagues (2019)', 'Pavani and colleagues (2020)'), ('Pavani et al., 2019', 'Pavani et al., 2020')],
 'nap-spell': [('Friedrich & Schlarb, 2017', 'Friedrich & Schlarb, 2018'), ('Leon & Lack, 2010', 'Lovato & Lack, 2010')],
}
for rid, old, new, yr, doi in REF: sub(rid, old, new, yr, doi)
for slug, pairs in INTEXT.items():
    for old, new in pairs:
        n = 0
        for b in P[slug]:
            if b['type'] != 'ref' and old in b['text']:
                n += b['text'].count(old); b['text'] = b['text'].replace(old, new)
                b['html'] = b['html'].replace(H.escape(old, quote=False), H.escape(new, quote=False))
        assert n, (slug, old); print(slug, old, '->', new, n)
HTMLFIX = {  # edits that straddle a cite anchor boundary
 'sense-foraging': [('>Escelsior et al. (2024</a>', '>Escelsior et al. (2025</a>')],
 'metaphor-mirror': [('>Pavani and Colleagues (2019</a>', '>Pavani and colleagues (2020</a>')],
}
for slug, pairs in HTMLFIX.items():
    for old, new in pairs:
        n = sum(old in b['html'] for b in P[slug]); assert n, old
        for b in P[slug]: b['html'] = b['html'].replace(old, new)
for rid, *_ in REF: R[rid]['html'] = linkify(R[rid]['text'])
json.dump(P, open('/home/claude/sb/data/papers.json', 'w'), ensure_ascii=False, indent=1)
