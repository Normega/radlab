"""Study 2 consent and debrief (the approved Rev2 forms, which describe Study 2, edited for
the added measures, the ~20-minute length and the optional 2-week follow-up) and the
follow-up's own short consent and debrief (new documents). Drafts: they carry a banner
until the amendment is approved.

As in build_study1_forms.py, each edit replaces one whole approved paragraph (or adds
one after it) and the build fails unless that paragraph is found verbatim; the changes
are written to study2/forms_changes.md for the amendment.

Usage:  python scripts/sense_foraging/build_study2_forms.py
"""
import html
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from build_draft import DRAFT_BANNER, build_consent, build_debrief, lit  # noqa: E402
from build_study1_forms import CONSENT as S1_CONSENT  # noqa: E402

OUT = Path(__file__).parent / 'study2'
IDS = json.loads((OUT / 'ids.json').read_text(encoding='utf-8'))
BANNER = ('<p style="border:2px solid #c00000;border-radius:12px;padding:8px 16px;color:#c00000">'
          '<strong>Study 2 draft, pending REB approval of the amendment.</strong> Not recruiting.</p>')
OLD = {w: o for w, o, _ in S1_CONSENT}   # approved Rev2 paragraphs, keyed by heading

FOLLOW_UP = ("About two weeks later, some participants, chosen at random, will be invited through Prolific to an optional "
             "short follow-up: the 20 statements about how you pay attention again, which takes about 3 minutes and is paid "
             "separately. You can decline the invitation without any effect on this study or your payment.")

CONSENT = [
    ('Purpose of the Study', OLD['Purpose of the Study'], [
        "We are developing and testing a new questionnaire that measures people's ability to notice and shift into a "
        "receptive, open, sensory way of engaging with the world, as distinct from a goal-directed, task-focused way of "
        "engaging with it. An earlier study identified the questionnaire's main parts and a shorter, 20-statement version. "
        "This study will help us confirm that structure and understand how the questionnaire relates to existing measures "
        "of mindfulness, bodily awareness, how people handle uncertainty and enjoy good experiences, and general wellbeing."]),
    ('What You Will Be Asked to Do', OLD['What You Will Be Asked to Do'], [
        "If you agree to take part, you will first answer a few background questions (such as your age, gender, "
        "ethnicity, education, religious or spiritual background, and any regular meditation, yoga, or other mind-body "
        "practice). You will then complete a series of online questionnaires about how you pay attention, your everyday "
        "sensory experience, attitudes toward mindfulness and body awareness, how you respond to uncertainty and enjoy good "
        "experiences, some personality characteristics, stress, and general wellbeing (including a brief screener for "
        "common mood and anxiety symptoms), and a few questions about your past week. Two statements simply ask you to "
        "select a particular answer, to check that each statement is being read. The study takes approximately 20 minutes "
        "and is completed in a single session.",
        FOLLOW_UP]),
    ('Voluntary Participation', OLD['Voluntary Participation'], [
        "Your participation is entirely voluntary. Every question about you offers a \"Prefer not to answer\" option, "
        "and you may stop the study at any time by closing the browser window, without penalty. If you complete only "
        "part of the study, you will still be compensated for the time you spent, consistent with Prolific's payment "
        "policies."]),
    ('Confidentiality',
     "We do not collect your name or email address. Your Prolific ID is used only to verify your eligibility and to "
     "process your payment; it is permanently removed from the dataset once payment is complete and before any analysis "
     "takes place. After that point, your responses cannot be linked back to you, including by the research team.", [
        "We do not collect your name or email address. Your Prolific ID is used only to verify your eligibility, to "
        "process your payment and, if you are invited to the optional follow-up, to link your two sets of answers; it is "
        "then permanently removed from the dataset, before any analysis takes place. After that point, your responses "
        "cannot be linked back to you, including by the research team."]),
    ('Data Retention and Disposition',
     "Your Prolific ID is retained only until your payment is confirmed, typically within a few days of your "
     "participation, after which it is permanently deleted and cannot be recovered by anyone, including the research "
     "team. From that point forward, your responses exist only as part of a de-identified, non-attributable dataset. This "
     "de-identified data will be retained indefinitely by the research team, consistent with standard practice in the "
     "field, to support reanalysis, replication, and comparison with future research. No identifiable version of your "
     "data is retained beyond the payment-confirmation window described above.", [
        "Your Prolific ID is retained only until your payment is confirmed or, because some participants are invited to "
        "the optional follow-up, until the follow-up closes (about three weeks after your participation), after which it "
        "is permanently deleted and cannot be recovered by anyone, including the research team. Before it is deleted, "
        "your answers to this study and to the follow-up are linked by a random code that contains no information about "
        "you. From that point forward, your responses exist only as part of a de-identified, non-attributable dataset. "
        "This de-identified data will be retained indefinitely by the research team, consistent with standard practice in "
        "the field, to support reanalysis, replication, and comparison with future research. No identifiable version of "
        "your data is retained beyond the window described above."]),
    ('Compensation', OLD['Compensation'], [
        "You will be paid $12.00 USD per hour, prorated to the time you spend on the study (approximately $4.00 for an "
        "estimated 20-minute session), consistent with Prolific's fair payment guidelines. Payment is processed through "
        "Prolific and is not affected by early withdrawal, provided some responses were submitted, or by how you answer "
        "any question. The optional follow-up is paid separately at the same rate."]),
    ('Withdrawing Your Data',
     "Because your Prolific ID is removed shortly after payment is processed, you can request that your data be withdrawn "
     "only during that short window. To do so, email norman.farb@utoronto.ca with your Prolific ID within 48 hours of "
     "completing the study and state that you would like to withdraw. After de-identification, your specific responses "
     "can no longer be located or removed. If you separately consented to depositing your data in the University of "
     "Toronto's Dataverse (see above), the same 48-hour window applies before deposit; once deposited, individual "
     "responses can no longer be identified or withdrawn from the dataset.", [
        "You can request that your data be withdrawn by emailing norman.farb@utoronto.ca with your Prolific ID within 48 "
        "hours of completing the study (or of completing the follow-up, for your follow-up answers) and stating that you "
        "would like to withdraw. After de-identification, your specific responses can no longer be located or removed. If "
        "you separately consented to depositing your data in the University of Toronto's Dataverse (see above), the same "
        "48-hour window applies before deposit; once deposited, individual responses can no longer be identified or "
        "withdrawn from the dataset."]),
]

DEBRIEF = [
    ('About This Study',
     "This study is testing a new questionnaire designed to measure people's ability to notice and shift into a "
     "receptive, sensory way of engaging with the world (sometimes called \"sense foraging\"), as distinct from a more "
     "goal-directed, evaluative way of engaging with it. We are examining whether this new questionnaire has a coherent "
     "factor structure and how it relates to established measures of trait mindfulness (FFMQ-15) and interoceptive "
     "(bodily) awareness (MAIA-2).", [
        "This study is testing a new questionnaire designed to measure people's ability to notice and shift into a "
        "receptive, sensory way of engaging with the world (sometimes called \"sense foraging\"), as distinct from a more "
        "goal-directed, evaluative way of engaging with it. In an earlier study its statements formed four parts: getting "
        "into the sensing mode, understanding the two modes, valuing and savouring time spent sensing, and letting "
        "experience be. This study checks that structure in a new group of people and examines how the questionnaire "
        "relates to established measures of trait mindfulness (FFMQ-15), interoceptive (bodily) awareness (MAIA-2), "
        "decentering (Experiences Questionnaire), intolerance of uncertainty (IUS-12), savouring (Savoring Beliefs "
        "Inventory) and openness to experience (BFI-2). Six further statements were new ones we are testing for a future "
        "version, and some statements were worded in the opposite direction from others, which helps us separate what "
        "people agree with from a general tendency to agree."]),
    ('About This Study (second paragraph)',
     "We are also comparing responses between people who regularly engage in a contemplative practice (such as "
     "meditation or yoga) and those who do not, to see whether practitioners score differently on this new measure, as a "
     "way of testing whether it captures something meaningful. Finally, we included two brief wellbeing measures (a life "
     "satisfaction item and the PHQ-4 mood/anxiety screener) to explore, on an exploratory basis, whether the capacity "
     "for receptive sensory engagement relates to general wellbeing.", [
        "We are also comparing responses between people who regularly engage in a contemplative practice (such as "
        "meditation or yoga) and those who do not, to see whether practitioners score differently on this new measure, as "
        "a way of testing whether it captures something meaningful. Finally, we included brief wellbeing and stress "
        "measures (a life satisfaction item, the PHQ-4 mood/anxiety screener and the Perceived Stress Scale) and a few "
        "questions about your past week, to explore whether the capacity for receptive sensory engagement relates to "
        "general wellbeing and everyday behaviour. Two statements asked you to select a specific answer; these help us "
        "check that statements were read carefully."]),
    ('Your Data',
     "As explained in the consent form, your Prolific ID is used only to process payment and is removed from the dataset "
     "shortly afterward. If you would like to withdraw your data, please email norman.farb@utoronto.ca with your Prolific "
     "ID within 48 hours of completing the study. After that point we can no longer locate or remove your individual "
     "responses.", [
        "As explained in the consent form, your Prolific ID is used only to process payment and, if you are invited to the "
        "optional follow-up, to link your two sets of answers; it is removed from the dataset once the follow-up closes. "
        "If you would like to withdraw your data, please email norman.farb@utoronto.ca with your Prolific ID within 48 "
        "hours of completing the study. After that point we can no longer locate or remove your individual responses."]),
]

RETEST_CONSENT = [
    ('h2', 'Follow-up: Development and Validation of the Sense Foraging Scale'),
    ('p', 'UNIVERSITY OF TORONTO, Department of Psychology. Principal Investigator: Prof. Norman Farb, PhD, Department of '
          'Psychological and Brain Sciences, University of Toronto Mississauga, norman.farb@utoronto.ca, 905-828-3959.'),
    ('h2', 'Why you are invited'),
    ('p', 'About two weeks ago you took part in our study of a new questionnaire about how people pay attention. You were '
          'chosen at random to be invited to this optional follow-up. Answering the same statements again a short time '
          'later tells us how stable the questionnaire’s scores are, which is how researchers judge whether a change '
          'in scores is real.'),
    ('h2', 'What you will be asked to do'),
    ('p', 'Answer the same 20 statements about how you pay attention. It takes about 3 minutes, in a single session.'),
    ('h2', 'Voluntary participation and risks'),
    ('p', 'Taking part is entirely voluntary, and declining has no effect on your earlier participation or payment. Every '
          'statement offers a "Prefer not to answer" option, and you may stop at any time by closing the browser window. '
          'The statements are the same everyday-experience statements as before; we do not expect any risk beyond '
          'everyday life. A list of mental health resources is shown at the end.'),
    ('h2', 'Confidentiality'),
    ('p', 'We do not collect your name or email address. Your Prolific ID is used only to process your payment and to '
          'link your follow-up answers to your earlier ones by a random code that contains no information about you; '
          'the Prolific ID is then permanently deleted, as described in the original consent form. All data are stored '
          'in encrypted form on RADlab, the lab’s own research platform, accessible only to the research team, and '
          'results are reported only in aggregate. The choice you made earlier about depositing your de-identified data '
          'in the University of Toronto’s Dataverse applies to your follow-up answers too.'),
    ('h2', 'Compensation'),
    ('p', 'You will be paid at the same rate as before, $12.00 USD per hour, prorated (approximately $0.60 for an '
          'estimated 3-minute follow-up), through Prolific.'),
    ('h2', 'Withdrawing your data'),
    ('p', 'To withdraw your follow-up answers, email norman.farb@utoronto.ca with your Prolific ID within 48 hours of '
          'completing the follow-up. After de-identification your responses can no longer be located or removed.'),
    ('h2', 'Questions or concerns'),
    ('p', 'Contact Prof. Norman Farb at norman.farb@utoronto.ca. For questions about your rights as a research '
          'participant, contact the University of Toronto Office of Research Ethics at ethics.review@utoronto.ca or +1 '
          '416-946-3273, and reference Protocol # 00051180.'),
    ('h2', 'Consent'),
    ('p', 'By checking the box below, you confirm that you are 18 years of age or older, have read and understood the '
          'information above, and voluntarily agree to take part in this follow-up.'),
]
RETEST_DEBRIEF_INTRO = [
    ('h2', 'Thank you'),
    ('p', 'Thank you for completing the follow-up. Comparing your answers today with your answers about two weeks ago '
          'tells us how stable the questionnaire’s scores are over a short time, when nothing in particular has '
          'been done to change them. This is needed before the questionnaire can be used to measure change, for example '
          'before and after a course. No deception was used. If you would like to withdraw your follow-up answers, email '
          'norman.farb@utoronto.ca with your Prolific ID within 48 hours.'),
]


def para(text):
    return f'<p>{html.escape(text)}</p>'


def apply(doc, edits):
    assert doc.startswith(DRAFT_BANNER + '\n')
    doc = BANNER + '\n' + doc[len(DRAFT_BANNER) + 1:]
    for where, old, new in edits:
        assert doc.count(para(old)) == 1, f'approved paragraph not found verbatim: {where}'
        doc = doc.replace(para(old), '\n'.join(para(n) for n in new))
    return doc


def simple(blocks):
    return BANNER + '\n' + '\n'.join(f'<{t}>{html.escape(x)}</{t}>' for t, x in blocks)


def main():
    consent, debrief = apply(build_consent(), CONSENT), apply(build_debrief(), DEBRIEF)
    # The retest debrief reuses the approved resources section of the main debrief.
    res = debrief[debrief.index('<h2>Mental Health and Wellbeing Resources</h2>'):]
    r_consent, r_debrief = simple(RETEST_CONSENT), simple(RETEST_DEBRIEF_INTRO) + '\n' + res
    files = {'consent.html': consent, 'debrief.html': debrief, 'retest_consent.html': r_consent, 'retest_debrief.html': r_debrief}
    for f, h in files.items():
        (OUT / f).write_text(h, encoding='utf-8')

    sql = ['BEGIN;']
    for study, c, d in ((IDS['study'], consent, debrief), (IDS['retest'], r_consent, r_debrief)):
        sql.append(f"WITH c AS (INSERT INTO study_consent_forms (study_id, html_content) VALUES ({lit(study)}, {lit(c)}) RETURNING id),\n"
                   f"     d AS (INSERT INTO study_debrief_forms (study_id, html_content) VALUES ({lit(study)}, {lit(d)}) RETURNING id)\n"
                   f"UPDATE studies SET active_consent_form_id = (SELECT id FROM c), active_debrief_form_id = (SELECT id FROM d) "
                   f"WHERE id = {lit(study)};")
    sql.append('COMMIT;')
    (OUT / 'study2_forms.sql').write_text('\n'.join(sql) + '\n', encoding='utf-8')

    md = ['# Study 2 consent and debrief: changes from the approved Rev2 forms', '',
          'Generated by `scripts/sense_foraging/build_study2_forms.py`. Every other paragraph is the approved text verbatim.', '']
    for title, edits in (('Consent form', CONSENT), ('Debrief form', DEBRIEF)):
        md.append(f'## {title}\n')
        for where, old, new in edits:
            md += [f'### {where}', '', '**Approved:**', '', f'> {old}', '', '**Study 2:**', ''] + [f'> {n}\n' for n in new]
    md += ['## Follow-up (retest) consent and debrief: new documents', '',
           'Short forms written for the optional 2-week follow-up; the debrief reuses the approved resources sheet. Full text '
           'in `retest_consent.html` and `retest_debrief.html`.', '']
    (OUT / 'forms_changes.md').write_text('\n'.join(md), encoding='utf-8')
    print({f: len(h) for f, h in files.items()})


if __name__ == '__main__':
    main()
