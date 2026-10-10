"""Study 1 consent and debrief: the approved Rev2 forms with the edits Study 1 needs.

The approved package describes Study 2 (the scale plus FFMQ-15, MAIA-2, PHQ-4, life
satisfaction and BIDR-16, 15-20 minutes). Study 1 is the background questions and
item pool 6 alone (48 statements and two attention checks, about 10 minutes), so
every passage about the other measures, the time and the payment changes. Each
edit replaces one whole approved paragraph, and the build fails if that paragraph
is not found verbatim, so the list below is exactly what changed. It is also
written out as forms_changes.md for the REB amendment.

Usage:  python scripts/sense_foraging/build_study1_forms.py
Writes scripts/sense_foraging/study1/{consent,debrief}.html, study1_forms.sql and
forms_changes.md.
"""
import html
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from build_draft import DRAFT_BANNER, build_consent, build_debrief, lit  # noqa: E402

OUT = Path(__file__).parent / 'study1'
STUDY = '74cb6aa5-857c-408e-adfa-a5556acd62b7'

# Shown until the amendment is approved; removed for launch.
BANNER = ('<p style="border:2px solid #c00000;border-radius:12px;padding:8px 16px;color:#c00000">'
          '<strong>Study 1 wording, pending REB approval of the amendment.</strong> Not yet recruiting.</p>')

CONSENT = [
    ('Purpose of the Study',
     "We are developing and testing a new questionnaire that measures people's ability to notice and shift into a "
     "receptive, open, sensory way of engaging with the world, as distinct from a goal-directed, task-focused way of "
     "engaging with it. This study will help us understand how this questionnaire relates to existing measures of "
     "mindfulness, bodily awareness, and general wellbeing.",
     "We are developing and testing a new questionnaire that measures people's ability to notice and shift into a "
     "receptive, open, sensory way of engaging with the world, as distinct from a goal-directed, task-focused way of "
     "engaging with it. This study is the first step: it will help us understand how the questionnaire's statements "
     "group together, so that we can identify the most useful ones and produce a shorter version."),
    ('What You Will Be Asked to Do',
     "If you agree to take part, you will complete a series of online questionnaires about your everyday sensory "
     "experience, attitudes toward mindfulness and body awareness, and general wellbeing (including a brief screener "
     "for common mood and anxiety symptoms). You will also answer a few background questions, including questions "
     "about any regular meditation, yoga, or other mind-body practice. The study takes approximately 15-20 minutes "
     "and is completed in a single session.",
     "If you agree to take part, you will first answer a few background questions (such as your age, gender, "
     "ethnicity, education, religious or spiritual background, and any regular meditation, yoga, or other mind-body "
     "practice). You will then complete one questionnaire of 48 short statements about how you pay attention in "
     "everyday life, rating how much you agree with each. Two further statements simply ask you to select a "
     "particular answer, to check that each statement is being read. The study takes approximately 10 minutes and "
     "is completed in a single session."),
    ('Voluntary Participation',
     "Your participation is entirely voluntary. You may skip any question you prefer not to answer, and you may stop "
     "the study at any time by closing the browser window, without penalty. If you complete only part of the study, "
     "you will still be compensated for the time you spent, consistent with Prolific's payment policies.",
     "Your participation is entirely voluntary. Every question about you offers a \"Prefer not to answer\" option, "
     "and you may stop the study at any time by closing the browser window, without penalty. If you complete only "
     "part of the study, you will still be compensated for the time you spent, consistent with Prolific's payment "
     "policies."),
    ('Risks',
     "This study asks about everyday experiences, attitudes, and general wellbeing. Some people may find it mildly "
     "uncomfortable to reflect on these topics, including the brief mood/anxiety screening questions. These questions "
     "do not ask about self-harm or suicidal thoughts. If you experience any discomfort, you are free to stop at any "
     "time. A list of mental health resources is provided at the end of the study, regardless of your answers.",
     "This study asks about everyday experiences, including how you pay attention and how you respond to stress. "
     "Some people may find it mildly uncomfortable to reflect on these topics. The questions do not ask about mood "
     "symptoms, self-harm, or suicidal thoughts. If you experience any discomfort, you are free to stop at any time. "
     "A list of mental health resources is provided at the end of the study, regardless of your answers."),
    ('Compensation',
     "You will be paid $12.00 USD per hour, prorated to the time you spend on the study (approximately $3.60 for an "
     "estimated 18-minute session), consistent with Prolific's fair payment guidelines. Payment is processed through "
     "Prolific and is not affected by early withdrawal, provided some responses were submitted.",
     "You will be paid $12.00 USD per hour, prorated to the time you spend on the study (approximately $2.00 for an "
     "estimated 10-minute session), consistent with Prolific's fair payment guidelines. Payment is processed through "
     "Prolific and is not affected by early withdrawal, provided some responses were submitted, or by how you answer "
     "any question."),
]

DEBRIEF = [
    ('About This Study',
     "This study is testing a new questionnaire designed to measure people's ability to notice and shift into a "
     "receptive, sensory way of engaging with the world (sometimes called \"sense foraging\"), as distinct from a more "
     "goal-directed, evaluative way of engaging with it. We are examining whether this new questionnaire has a "
     "coherent factor structure and how it relates to established measures of trait mindfulness (FFMQ-15) and "
     "interoceptive (bodily) awareness (MAIA-2).",
     "This study is testing a new questionnaire designed to measure people's ability to notice and shift into a "
     "receptive, sensory way of engaging with the world (sometimes called \"sense foraging\"), as distinct from a more "
     "goal-directed, evaluative way of engaging with it. In this first study we are examining how the questionnaire's "
     "48 statements group together (its factor structure) and which statements best capture each part, so that we "
     "can produce a shorter version. Some statements were worded in the opposite direction from others (for example, "
     "describing difficulty rather than ease): mixing directions helps us separate what people agree with from a "
     "general tendency to agree. A later study will examine how the questionnaire relates to established measures of "
     "mindfulness and bodily awareness."),
    ('About This Study (second paragraph)',
     "We are also comparing responses between people who regularly engage in a contemplative practice (such as "
     "meditation or yoga) and those who do not, to see whether practitioners score differently on this new measure, "
     "as a way of testing whether it captures something meaningful. Finally, we included two brief wellbeing "
     "measures (a life satisfaction item and the PHQ-4 mood/anxiety screener) to explore, on an exploratory basis, "
     "whether the capacity for receptive sensory engagement relates to general wellbeing.",
     "We are also comparing responses between people who regularly engage in a contemplative practice (such as "
     "meditation or yoga) and those who do not, to see whether practitioners score differently on this new measure, "
     "as a way of testing whether it captures something meaningful. Two statements asked you to select a specific "
     "answer; these help us check that statements were read carefully."),
    ('Your Data (second paragraph)',
     "Your responses to the mood/anxiety and life satisfaction questions are not scored or reviewed individually, "
     "and no personalized feedback or clinical judgment is generated from them.",
     "Your responses are not scored or reviewed individually, and no personalized feedback or judgment is generated "
     "from them."),
    ('Mental Health and Wellbeing Resources (introduction)',
     "Taking part in this study involved reflecting on your everyday experiences, thoughts, and general wellbeing. If "
     "anything raised difficult feelings, or if you are experiencing distress for any reason, the resources below are "
     "free, confidential, and available regardless of how you answered any of the study questions.",
     "Taking part in this study involved reflecting on your everyday experiences, including how you pay attention and "
     "respond to stress. If anything raised difficult feelings, or if you are experiencing distress for any reason, the "
     "resources below are free, confidential, and available regardless of how you answered any of the study "
     "questions."),
]


def para(text):
    return f'<p>{html.escape(text)}</p>'


def apply(doc, edits):
    assert doc.startswith(DRAFT_BANNER)
    doc = BANNER + doc[len(DRAFT_BANNER):]
    for where, old, new in edits:
        assert doc.count(para(old)) == 1, f'approved paragraph not found verbatim: {where}'
        doc = doc.replace(para(old), para(new))
    return doc


def main():
    consent = apply(build_consent(), CONSENT)
    debrief = apply(build_debrief(), DEBRIEF)
    for leftover in ('FFMQ', 'MAIA', 'PHQ', 'life satisfaction', '15-20', '18-minute', 'screener'):
        assert leftover not in consent + debrief, leftover
    OUT.mkdir(exist_ok=True)
    (OUT / 'consent.html').write_text(consent, encoding='utf-8')
    (OUT / 'debrief.html').write_text(debrief, encoding='utf-8')

    # New rows, then point the study at them: the old forms stay, as a record of
    # what the (test-only) enrollments so far were shown.
    sql = ['BEGIN;',
           f"WITH c AS (INSERT INTO study_consent_forms (study_id, html_content) VALUES ({lit(STUDY)}, {lit(consent)}) RETURNING id),",
           f"     d AS (INSERT INTO study_debrief_forms (study_id, html_content) VALUES ({lit(STUDY)}, {lit(debrief)}) RETURNING id)",
           f"UPDATE studies SET active_consent_form_id = (SELECT id FROM c), active_debrief_form_id = (SELECT id FROM d) "
           f"WHERE id = {lit(STUDY)};",
           'COMMIT;']
    (OUT / 'study1_forms.sql').write_text('\n'.join(sql), encoding='utf-8')

    md = ['# Study 1 consent and debrief: changes from the approved Rev2 forms', '',
          'Generated by `scripts/sense_foraging/build_study1_forms.py`. Every other paragraph is the approved text '
          'verbatim. Study 1 = the background questions and the 48-item Sense Foraging questionnaire (pool 6) with '
          'two attention-check statements, about 10 minutes; the validity measures move to Study 2.', '']
    for title, edits in (('Consent form', CONSENT), ('Debrief form', DEBRIEF)):
        md.append(f'## {title}\n')
        for where, old, new in edits:
            md += [f'### {where}', '', '**Approved:**', '', f'> {old}', '', '**Study 1:**', '', f'> {new}', '']
    (OUT / 'forms_changes.md').write_text('\n'.join(md), encoding='utf-8')
    print('consent', len(consent), 'debrief', len(debrief))


if __name__ == '__main__':
    main()
