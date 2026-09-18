"""One-shot: import Noor Chaudhry's "Living your Values" into papers.json.

APPLIED 2026-09-18. Do not rerun — it asserts against the original .docx,
which is not in the repo (student source files never are), so it will fail at
the first assert. Kept because student prose and references may only change
through a documented script, and this script is that record.

Usage when it was run:
    python tools/spellbook/archive/import_noor.py "<path to>/NoorCapstone Essay.docx"

What it did, exactly:

1. Walked word/document.xml in document order for paragraph text.
2. Dropped the six title-block paragraphs (title, author, department, course,
   instructor, date) and everything from "References" onward, which is rebuilt
   from REFS below rather than parsed.
3. Applied ONE correction, and it is to a REFERENCE, not to her prose. Her
   text cites Berkout as 2022 in four places while her reference entry reads
   (2021). Crossref settles it: the paper is online-first 2021-07-20 and in
   print 2022-03, as Behavior Analysis in Practice 15(1), 104-114. Her in-text
   2022 is therefore correct by APA (the version of record) and agrees with
   the volume and issue she herself cites; the (2021) in her reference list is
   the online-first date and is the part that was wrong. So REFS carries 2022
   and her wording is untouched.

   Norm approved "correct it" on 2026-09-18 on the understanding that 2021 was
   the right year. It is not — the correction simply lands on the reference
   instead, which is the smaller edit and leaves student prose alone.
4. Linked the citations enumerated in CITES — literal strings only, no
   pattern-matching, so every link is auditable against her text.
   "(Russo-Netzer, 2024)" is deliberately NOT linked: there is no solo 2024
   Russo-Netzer in her reference list, and inferring she meant Russo-Netzer &
   Atad would assert a target her text does not name. That reference is cited
   elsewhere, so nothing is left uncited by the omission.
"""
import html as H
import json
import os
import re
import sys
import xml.etree.ElementTree as ET
import zipfile

SLUG = 'living-your-values'
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'

REFS = [
    # (2021) in her list -> (2022): the print issue year, matching 15(1) and
    # matching her own in-text citations. See the note at the top of this file.
    ('r1', 'Berkout', 2022, '10.1007/s40617-021-00589-1',
     'Berkout O. V. (2022). Working With Values: An Overview of Approaches and Considerations in '
     'Implementation. Behavior analysis in practice, 15(1), 104–114. '
     'https://doi.org/10.1007/s40617-021-00589-1'),
    ('r2', 'Ford', 2018, '10.1037/pspp0000157',
     'Ford, B. Q., Lam, P., John, O. P., & Mauss, I. B. (2018). The psychological health benefits of '
     'accepting negative emotions and thoughts: Laboratory, diary, and longitudinal evidence. Journal '
     'of personality and social psychology, 115(6), 1075–1092. https://doi.org/10.1037/pspp0000157'),
    ('r3', 'Gloster', 2017, '10.1016/j.brat.2017.01.013',
     'Gloster, A. T., Klotsche, J., Ciarrochi, J., Eifert, G., Sonntag, R., Wittchen, H. U., & Hoyer, J. '
     '(2017). Increasing valued behaviors precedes reduction in suffering: Findings from a randomized '
     'controlled trial using ACT. Behaviour research and therapy, 91, 64–71. '
     'https://doi.org/10.1016/j.brat.2017.01.013'),
    ('r4', 'Levin', 2020, '10.1016/j.brat.2020.103557',
     'Levin, M. E., Krafft, J., Hicks, E. T., Pierce, B., & Twohig, M. P. (2020). A randomized '
     'dismantling trial of the open and engaged components of acceptance and commitment therapy in an '
     'online intervention for distressed college students. Behaviour research and therapy, 126, 103557. '
     'https://doi.org/10.1016/j.brat.2020.103557'),
    ('r5', 'Levin', 2014, '10.1080/07448481.2013.843533',
     'Levin, M. E., Pistorello, J., Seeley, J. R., & Hayes, S. C. (2014). Feasibility of a prototype '
     'web-based acceptance and commitment therapy prevention program for college students. Journal of '
     'American college health : J of ACH, 62(1), 20–30. https://doi.org/10.1080/07448481.2013.843533'),
    ('r6', 'Paliliunas', 2018, '10.1007/s40617-018-0252-x',
     'Paliliunas, D., Belisle, J., & Dixon, M. R. (2018). A Randomized Control Trial to Evaluate the Use '
     'of Acceptance and Commitment Therapy (ACT) to Increase Academic Performance and Psychological '
     'Flexibility in Graduate Students. Behavior analysis in practice, 11(3), 241–253. '
     'https://doi.org/10.1007/s40617-018-0252-x'),
    ('r7', 'Russo-Netzer', 2019, '10.1007/s10902-018-0031-y',
     'Russo-Netzer, P. (2019). Prioritizing meaning as a pathway to meaning in life and well-being. '
     'Journal of Happiness Studies: An Interdisciplinary Forum on Subjective Well-Being, 20(6), '
     '1863–1891. https://doi.org/10.1007/s10902-018-0031-y'),
    ('r8', 'Russo-Netzer', 2024, '10.3389/fpsyg.2024.1375237',
     'Russo-Netzer, P., & Atad, O. I. (2024). Activating values intervention: an integrative pathway to '
     'well-being. Frontiers in psychology, 15, 1375237. https://doi.org/10.3389/fpsyg.2024.1375237'),
    ('r9', 'Russo-Netzer', 2020, '10.1016/j.paid.2020.110248',
     'Russo-Netzer, P., & Shoshani, A. (2020). Authentic Inner Compass, Well-being, and Prioritization '
     'of Positivity and Meaning among Adolescents. Personality and Individual Differences, 167(3), '
     'https://doi.org/10.1016/j.paid.2020.110248'),
    ('r10', 'Wang', 2024, '10.2196/50664',
     "Wang, D., Lin, B., Zhang, S., Xu, W., & Liu, X. (2024). Effectiveness of an Internet-Based "
     "Self-Help Acceptance and Commitment Therapy Program on Medical Students' Mental Well-Being: "
     'Follow-Up Randomized Controlled Trial. Journal of medical Internet research, 26, e50664. '
     'https://doi.org/10.2196/50664'),
]

# Literal in-text citation -> ref suffix. Matched on the HTML-escaped prose,
# so "&" appears as "&amp;" exactly as it will in the stored html.
CITES = [
    ('Ford et al., 2018', 'r2'),
    ('Russo-Netzer &amp; Atad, 2024', 'r8'),
    ('Russo-Netzer &amp; Shoshani, 2020', 'r9'),
    ('Berkout, 2022', 'r1'),
    ('Russo-Netzer (2019)', 'r7'),
    ('Russo-Netzer and Atad (2024)', 'r8'),
    ('Levin et al., (2020)', 'r4'),
    ('Levin et al., 2020', 'r4'),
    ('Russo-Netzer and Shosani (2020)', 'r9'),
    ('Gloster et al. (2017)', 'r3'),
    ('Levin et al., 2014', 'r5'),
    ('Wang et al., 2024', 'r10'),
    ('Paliliunas et al., 2018', 'r6'),
]


def paragraphs(docx_path):
    with zipfile.ZipFile(docx_path) as z:
        root = ET.fromstring(z.read('word/document.xml'))
    out = []
    for p in root.iter(f'{W}p'):
        buf = []
        for n in p.iter():
            if n.tag == f'{W}t':
                buf.append(n.text or '')
            elif n.tag == f'{W}tab':
                buf.append(' ')
            elif n.tag in (f'{W}br', f'{W}cr'):
                buf.append(' ')
        t = ''.join(buf).replace('\xa0', ' ').strip()
        t = re.sub(r'[ \t]{2,}', ' ', t)
        if t:
            out.append(t)
    return out


def link(escaped):
    """Wrap each enumerated citation literal in the book's cite anchor."""
    for literal, suffix in CITES:
        if literal not in escaped:
            continue
        escaped = escaped.replace(
            literal, f'<a class="cite" href="#{SLUG}-{suffix}">{literal}</a>')
    return escaped


def main():
    docx = sys.argv[1]
    paras = paragraphs(docx)

    assert paras[0] == 'Living your Values', paras[0]
    assert paras[1] == 'Noor Chaudhry', paras[1]
    ref_i = paras.index('References')
    body = paras[6:ref_i]
    assert len(body) == 15, f'expected 15 body paragraphs, got {len(body)}'

    # Her prose is imported verbatim. The only correction in this import is to
    # the Berkout reference year in REFS; this assert pins the in-text form her
    # citations actually take, so a silent change upstream cannot slip past.
    n_berkout = '\n\n'.join(body).count('(Berkout, 2022)')
    assert n_berkout == 4, f'expected 4 "(Berkout, 2022)", found {n_berkout}'
    print(f'prose imported verbatim; "(Berkout, 2022)" x{n_berkout} left as written')

    blocks = []
    for t in body:
        esc = H.escape(t, quote=False)
        blocks.append({'type': 'p', 'text': t, 'html': link(esc)})
    blocks.append({'type': 'h', 'text': 'References', 'html': 'References'})
    for suffix, sur, year, doi, text in REFS:
        blocks.append({
            'type': 'ref', 'text': text, 'id': f'{SLUG}-{suffix}',
            'sur': sur, 'year': year, 'doi': doi,
            'html': H.escape(text, quote=False),
        })

    path = os.path.join(ROOT, 'data', 'papers.json')
    P = json.load(open(path, encoding='utf-8'))
    assert SLUG not in P, f'{SLUG} already imported'
    P[SLUG] = blocks
    json.dump(P, open(path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

    linked = sum(b['html'].count('class="cite"') for b in blocks)
    print(f'{SLUG}: {len(body)} paragraphs, {len(REFS)} refs, {linked} citation links')


if __name__ == '__main__':
    main()
