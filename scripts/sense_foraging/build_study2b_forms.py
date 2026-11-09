"""Study 2b consent and debrief: Study 1's approved forms (Rev3 amendment, approved 2026-10-11)
with the edits Study 2b needs: the vignettes, the scale and the validity battery (including the
PHQ-4 mood/anxiety screener), the optional break and what it records, three checks, about 22
minutes, pay at £12.71 an hour (UK minimum wage, Norm, 9 November 2026). The REB amendment is
approved under protocol #00051180 (Norm, 9 November), so the forms carry no banner.

As in build_study2a_forms.py, each edit replaces one whole approved paragraph and the build fails
unless that paragraph is found verbatim; the changes are written to study2b/forms_changes.md.

The time and pay estimate is the plan's until the pilot (decision 23) gives the median time;
update MINUTES and rebuild then.

Usage:  python scripts/sense_foraging/build_study2b_forms.py
"""
import html
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from build_draft import lit  # noqa: E402
from build_study1_forms import CONSENT as S1_CONSENT, DEBRIEF as S1_DEBRIEF  # noqa: E402

HERE = Path(__file__).parent
OUT = HERE / 'study2b'
STUDY = json.loads((OUT / 'ids.json').read_text(encoding='utf-8'))['study']
S1 = {w: n for w, _, n in S1_CONSENT + S1_DEBRIEF}   # Study 1's approved paragraphs, keyed by heading
RATE = 12.71
MINUTES = 22
PAY = f'£{RATE * MINUTES / 60:.2f}'

CONSENT = [
    ('Purpose of the Study', S1['Purpose of the Study'],
     "We are developing and testing a new questionnaire that measures people's ability to notice and shift into a "
     "receptive, open, sensory way of engaging with the world, as distinct from a goal-directed, task-focused way of "
     "engaging with it. Earlier studies identified what the questionnaire measures and chose a short version. This "
     "study checks that short version in a new group of people and examines how it relates to existing measures of "
     "mindfulness, bodily awareness, enjoying good experiences, personality, stress, and general wellbeing."),
    ('What You Will Be Asked to Do', S1['What You Will Be Asked to Do'],
     "If you agree to take part, you will first answer a few background questions (such as your age, gender, "
     "ethnicity, education, religious or spiritual background, and any regular meditation, yoga, or other mind-body "
     "practice). You will then read a short description of two ways of paying attention, rate nine brief descriptions "
     "of people in everyday moments on that difference, and rate yourself on the same scale. Next you will complete a "
     "series of online questionnaires about how you pay attention, your everyday sensory experience, body awareness, "
     "enjoying good experiences, new experiences and thinking, some personality characteristics, stress, and general "
     "wellbeing (including a brief screener for common mood and anxiety symptoms), and a few questions about your past "
     "week. Partway through you will be offered an optional short break; whether you take it is up to you and does not "
     "affect your payment. Three statements simply ask you to select a particular answer, to check that each statement "
     f"is being read. The study takes approximately {MINUTES} minutes, plus any break you choose to take, and is "
     "completed in a single session."),
    ('Risks', S1['Risks'],
     "This study asks about everyday experiences, attitudes, and general wellbeing. Some people may find it mildly "
     "uncomfortable to reflect on these topics, including the brief mood/anxiety screening questions and questions "
     "about worrying over body sensations. These questions do not ask about self-harm or suicidal thoughts. If you "
     "experience any discomfort, you are free to stop at any time. A list of mental health resources is provided at the "
     "end of the study, regardless of your answers."),
    ('Compensation', S1['Compensation'],
     f"You will be paid £{RATE:.2f} per hour, prorated to the time you spend on the study (approximately {PAY} for an "
     f"estimated {MINUTES}-minute session), consistent with Prolific's fair payment guidelines. Payment is processed "
     "through Prolific and is not affected by early withdrawal, provided some responses were submitted, by whether you "
     "take the optional break, or by how you answer any question."),
]

DEBRIEF = [
    ('About This Study', S1['About This Study'],
     "This study is testing a new questionnaire designed to measure people's ability to notice and shift into a "
     "receptive, sensory way of engaging with the world (sometimes called \"sense foraging\"), as distinct from a more "
     "goal-directed, evaluative way of engaging with it. Earlier studies found that its statements measure one broad "
     "capacity and chose a short version. This study checks that short version in a new group of people and examines "
     "how it relates to established measures of trait mindfulness (FFMQ-15), bodily awareness (Brief MAIA-2), "
     "decentering (Experiences Questionnaire), savouring (Savoring Beliefs Inventory), openness (BFI-2 "
     "Open-Mindedness), sensation seeking (BSSS-8), need for cognition (NCS-6), sensitivity to light and sound "
     "(SPSQ-SF), worry about body sensations (ASI-3), finding meaning in events (Synchronicity Awareness and "
     "Meaning-Detecting Scale), and a tendency to describe oneself favourably (BIDR-16). Your ratings of the brief "
     "descriptions of people tell us whether the difference between the two modes was clear. Some statements were "
     "worded in the opposite direction from others (for example, describing difficulty rather than ease): mixing "
     "directions helps us separate what people agree with from a general tendency to agree."),
    ('About This Study (second paragraph)', S1['About This Study (second paragraph)'],
     "We are also comparing responses between people who regularly engage in a contemplative practice (such as "
     "meditation or yoga) and those who do not, to see whether practitioners score differently on this new measure, as "
     "a way of testing whether it captures something meaningful. We included brief wellbeing and stress measures (a "
     "life satisfaction item, the PHQ-4 mood/anxiety screener and the Perceived Stress Scale) and a few questions about "
     "your past week, to explore whether this capacity relates to general wellbeing and everyday behaviour. Three "
     "statements asked you to select a specific answer; these help us check that statements were read carefully."),
    ('About This Study (the break)', 'No deception was used in this study. All questionnaires you completed were exactly as described.',
     "The optional break partway through was also part of the study. We recorded whether you took it and, if you did, "
     "how long the break screen was open, to see whether people who score higher on the new questionnaire are more "
     "likely to take a moment to look and listen when they are offered one. We did not say this beforehand, because "
     "knowing could change the choice. There was no right choice, and it made no difference to your payment. Apart from "
     "this, all questionnaires you completed were exactly as described."),
    ('Your Data (second paragraph)', S1['Your Data (second paragraph)'],
     "Your responses, including those to the mood/anxiety and life satisfaction questions, are not scored or reviewed "
     "individually, and no personalized feedback or clinical judgment is generated from them."),
    ('Mental Health and Wellbeing Resources (introduction)', S1['Mental Health and Wellbeing Resources (introduction)'],
     "Taking part in this study involved reflecting on your everyday experiences, thoughts, and general wellbeing. If "
     "anything raised difficult feelings, or if you are experiencing distress for any reason, the resources below are "
     "free, confidential, and available regardless of how you answered any of the study questions."),
]


def para(text):
    return f'<p>{html.escape(text)}</p>'


def apply(doc, edits):
    for where, old, new in edits:
        assert doc.count(para(old)) == 1, f'approved paragraph not found verbatim: {where}'
        doc = doc.replace(para(old), para(new))
    return doc


def main():
    consent = apply((HERE / 'study1' / 'consent.html').read_text(encoding='utf-8'), CONSENT)
    debrief = apply((HERE / 'study1' / 'debrief.html').read_text(encoding='utf-8'), DEBRIEF)
    for leftover in ('48 short', '48 statements', '10-minute', '$2.00', '$12.00', 'Two further', 'Two statements',
                     'In this first study', 'No deception was used'):
        assert leftover not in consent + debrief, leftover
    (OUT / 'consent.html').write_bytes(consent.encode('utf-8'))   # LF on every platform
    (OUT / 'debrief.html').write_bytes(debrief.encode('utf-8'))

    sql = ['BEGIN;',
           f"WITH c AS (INSERT INTO study_consent_forms (study_id, html_content) VALUES ({lit(STUDY)}, {lit(consent)}) RETURNING id),",
           f"     d AS (INSERT INTO study_debrief_forms (study_id, html_content) VALUES ({lit(STUDY)}, {lit(debrief)}) RETURNING id)",
           "UPDATE studies SET active_consent_form_id = (SELECT id FROM c), active_debrief_form_id = (SELECT id FROM d) "
           f"WHERE id = {lit(STUDY)};",
           'COMMIT;']
    (OUT / 'study2b_forms.sql').write_bytes(('\n'.join(sql) + '\n').encode('utf-8'))

    md = ['# Study 2b consent and debrief: changes from Study 1\'s approved forms', '',
          'Generated by `scripts/sense_foraging/build_study2b_forms.py`. Every other paragraph is the approved Study 1 '
          'text (Rev3 amendment, approved 2026-10-11) verbatim. Study 2b = the background questions, the two modes with '
          'nine vignettes and a self-rating, the scale, the trial statements, the validity battery with an optional break '
          f'partway through, three attention checks; about {MINUTES} minutes at £{RATE:.2f} an hour.', '']
    for title, edits in (('Consent form', CONSENT), ('Debrief form', DEBRIEF)):
        md.append(f'## {title}\n')
        for where, old, new in edits:
            md += [f'### {where}', '', '**Approved (Study 1):**', '', f'> {old}', '', '**Study 2b:**', '', f'> {new}', '']
    (OUT / 'forms_changes.md').write_bytes(('\n'.join(md)).encode('utf-8'))
    print('consent', len(consent), 'debrief', len(debrief), 'pay', PAY)


if __name__ == '__main__':
    main()
