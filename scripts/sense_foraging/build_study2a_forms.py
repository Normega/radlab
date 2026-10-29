"""Study 2a consent and debrief: Study 1's approved forms (Rev3 amendment, approved
2026-10-11) with the edits Study 2a needs: the vignettes and self-rating, 64 statements
with three checks, IUS-12, about 15 minutes. Drafts: they carry a banner until the
amendment covering 2a is approved.

As in build_study1_forms.py, each edit replaces one whole approved paragraph and the
build fails unless that paragraph is found verbatim; the changes are written to
study2a/forms_changes.md for the amendment.

Usage:  python scripts/sense_foraging/build_study2a_forms.py
"""
import html
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from build_draft import lit  # noqa: E402
from build_study1_forms import CONSENT as S1_CONSENT, DEBRIEF as S1_DEBRIEF  # noqa: E402

HERE = Path(__file__).parent
OUT = HERE / 'study2a'
STUDY = json.loads((OUT / 'ids.json').read_text(encoding='utf-8'))['study']
BANNER = ('<p style="border:2px solid #c00000;border-radius:12px;padding:8px 16px;color:#c00000">'
          '<strong>Study 2a draft, pending REB approval of the amendment.</strong> Not recruiting.</p>')
S1 = {w: n for w, _, n in S1_CONSENT + S1_DEBRIEF}   # Study 1's approved paragraphs, keyed by heading

CONSENT = [
    ('Purpose of the Study', S1['Purpose of the Study'],
     "We are developing and testing a new questionnaire that measures people's ability to notice and shift into a "
     "receptive, open, sensory way of engaging with the world, as distinct from a goal-directed, task-focused way of "
     "engaging with it. An earlier study identified the questionnaire's main parts. This study tests revised and new "
     "statements for each part, so that we can choose the best ones for the final version."),
    ('What You Will Be Asked to Do', S1['What You Will Be Asked to Do'],
     "If you agree to take part, you will first answer a few background questions (such as your age, gender, "
     "ethnicity, education, religious or spiritual background, and any regular meditation, yoga, or other mind-body "
     "practice). You will then read a short description of two ways of paying attention, rate nine brief descriptions "
     "of people in everyday moments on that difference, and rate yourself on the same scale. Next you will rate how "
     "much you agree with 64 short statements about how you pay attention in everyday life, and with 12 statements "
     "about how you respond to uncertainty. Three further statements simply ask you to select a particular answer, to "
     "check that each statement is being read. The study takes approximately 15 minutes and is completed in a single "
     "session."),
    ('Risks', S1['Risks'],
     "This study asks about everyday experiences, including how you pay attention and how you respond to stress and "
     "uncertainty. Some people may find it mildly uncomfortable to reflect on these topics. The questions do not ask "
     "about mood symptoms, self-harm, or suicidal thoughts. If you experience any discomfort, you are free to stop at "
     "any time. A list of mental health resources is provided at the end of the study, regardless of your answers."),
    ('Compensation', S1['Compensation'],
     "You will be paid $12.00 USD per hour, prorated to the time you spend on the study (approximately $3.00 for an "
     "estimated 15-minute session), consistent with Prolific's fair payment guidelines. Payment is processed through "
     "Prolific and is not affected by early withdrawal, provided some responses were submitted, or by how you answer "
     "any question."),
]

DEBRIEF = [
    ('About This Study', S1['About This Study'],
     "This study is testing a new questionnaire designed to measure people's ability to notice and shift into a "
     "receptive, sensory way of engaging with the world (sometimes called \"sense foraging\"), as distinct from a more "
     "goal-directed, evaluative way of engaging with it. In an earlier study its statements formed four parts: getting "
     "into the sensing mode, understanding the two modes, valuing and savouring time spent sensing, and letting "
     "experience be. This study tests revised and new statements for each part, and for a possible fifth part, "
     "foraging (looking for something to take in), so that we can choose the best statements for the final version. "
     "Your ratings of the brief descriptions of people tell us whether the difference between the two modes was clear, "
     "and the uncertainty questionnaire (IUS-12) helps us tell letting experience be apart from a general dislike of "
     "uncertainty. Some statements were worded in the opposite direction from others (for example, describing "
     "difficulty rather than ease): mixing directions helps us separate what people agree with from a general tendency "
     "to agree. A later study will examine how the questionnaire relates to established measures of mindfulness and "
     "bodily awareness."),
    ('About This Study (second paragraph)', S1['About This Study (second paragraph)'],
     "We are also comparing responses between people who regularly engage in a contemplative practice (such as "
     "meditation or yoga) and those who do not, to see whether practitioners score differently on this new measure, as "
     "a way of testing whether it captures something meaningful. Three statements asked you to select a specific "
     "answer; these help us check that statements were read carefully."),
    ('Mental Health and Wellbeing Resources (introduction)', S1['Mental Health and Wellbeing Resources (introduction)'],
     "Taking part in this study involved reflecting on your everyday experiences, including how you pay attention and "
     "respond to stress and uncertainty. If anything raised difficult feelings, or if you are experiencing distress for "
     "any reason, the resources below are free, confidential, and available regardless of how you answered any of the "
     "study questions."),
]


def para(text):
    return f'<p>{html.escape(text)}</p>'


def apply(doc, edits):
    for where, old, new in edits:
        assert doc.count(para(old)) == 1, f'approved paragraph not found verbatim: {where}'
        doc = doc.replace(para(old), para(new))
    return BANNER + '\n' + doc


def main():
    consent = apply((HERE / 'study1' / 'consent.html').read_text(encoding='utf-8'), CONSENT)
    debrief = apply((HERE / 'study1' / 'debrief.html').read_text(encoding='utf-8'), DEBRIEF)
    for leftover in ('48 short', '48 statements', '10-minute', '$2.00', 'Two further', 'Two statements', 'In this first study'):
        assert leftover not in consent + debrief, leftover
    (OUT / 'consent.html').write_bytes(consent.encode('utf-8'))   # LF on every platform
    (OUT / 'debrief.html').write_bytes(debrief.encode('utf-8'))

    sql = ['BEGIN;',
           f"WITH c AS (INSERT INTO study_consent_forms (study_id, html_content) VALUES ({lit(STUDY)}, {lit(consent)}) RETURNING id),",
           f"     d AS (INSERT INTO study_debrief_forms (study_id, html_content) VALUES ({lit(STUDY)}, {lit(debrief)}) RETURNING id)",
           "UPDATE studies SET active_consent_form_id = (SELECT id FROM c), active_debrief_form_id = (SELECT id FROM d) "
           f"WHERE id = {lit(STUDY)};",
           'COMMIT;']
    (OUT / 'study2a_forms.sql').write_bytes(('\n'.join(sql) + '\n').encode('utf-8'))

    md = ['# Study 2a consent and debrief: changes from Study 1\'s approved forms', '',
          'Generated by `scripts/sense_foraging/build_study2a_forms.py`. Every other paragraph is the approved Study 1 '
          'text (Rev3 amendment, approved 2026-10-11) verbatim. Study 2a = the background questions, a description of the '
          'two modes with nine vignettes and a self-rating, 58 statements with three attention checks, IUS-12, and six '
          'statements in Study 1 wording; about 15 minutes.', '']
    for title, edits in (('Consent form', CONSENT), ('Debrief form', DEBRIEF)):
        md.append(f'## {title}\n')
        for where, old, new in edits:
            md += [f'### {where}', '', '**Approved (Study 1):**', '', f'> {old}', '', '**Study 2a:**', '', f'> {new}', '']
    (OUT / 'forms_changes.md').write_bytes(('\n'.join(md)).encode('utf-8'))
    print('consent', len(consent), 'debrief', len(debrief))


if __name__ == '__main__':
    main()
