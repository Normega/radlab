"""Sense Foraging Study 2 (CFA + validity) and its 2-week retest: definitions and the SQL
that creates both studies, inactive, for review (Norm, 2026-10-11).

Session (Study 2):
  background (sf-background, as Study 1) -> the 20-item short form (sf-short-20, fixed
  order, as the PSY240 trial) -> 14 candidate items (unscored, in a per-participant order) -> the validity block in
  a per-participant order (session_template_nodes.shuffle_group = 'validity'):
  FFMQ-15, MAIA-2, BIDR-16, PHQ-4 (the REB-approved appendix, verbatim, via
  build_draft.build_validity), IUS-12, SBI Savoring the Moment, BFI-2 Open-Mindedness,
  EQ Decentering, PSS-4, three past-week criterion items, and life satisfaction (the
  six-face item) -> debrief.
Retest: the short form only, ~2 weeks later, for a random invited subsample; its
study names Study 2 in identity_link_study_id so the two stay linkable after
Prolific IDs are deleted (20261011_identity_links.sql).

New measures are copied verbatim from the sources in research_notes/Study 2 measures/
(each item checked against a primary or authors' source). Paper-form instructions
are adapted for the web only where they say "circle" or "write" (-> "select"); the
adaptations are listed in study2/measures_notes.md for the amendment.

Usage:  python scripts/sense_foraging/build_study2.py
"""
import json
import sys
import uuid
from pathlib import Path

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE))
from build_draft import build_validity, fallback_pages, likert, lit, mc, opt, questionnaire, chunk, SFS_POINTS  # noqa: E402

OUT = HERE / 'study2'
STUDY1 = '74cb6aa5-857c-408e-adfa-a5556acd62b7'
LIFESAT_ACTIVITY = 'e6ff9b25-d826-4561-8121-1201798948dc'
DEBRIEF_ACTIVITY = 'f79f90f7-9f59-44a6-8cf7-4ca45a76298a'


def pages(prefix, comps, sizes):
    return [{'id': f'{prefix}_p{k}', 'components': c} for k, c in enumerate(chunk(comps, sizes), 1)]


def check(cid, label, points):
    c = likert(cid, f'To show that you are reading each statement, please select "{label}" for this one.', points)
    del c['allow_pna']
    return c


# -- new measures, verbatim -----------------------------------------------------------
IUS_POINTS = [(1, 'Not at all characteristic of me'), (2, 'A little characteristic of me'),
              (3, 'Somewhat characteristic of me'), (4, 'Very characteristic of me'),
              (5, 'Entirely characteristic of me')]
IUS12 = [  # lab form order (Carleton/Asmundson lab theses); P = prospective, I = inhibitory
    'Unforeseen events upset me greatly.',
    'It frustrates me not having all the information I need.',
    'Uncertainty keeps me from living a full life.',
    'One should always look ahead so as to avoid surprises.',
    'A small unforeseen event can spoil everything, even with the best of planning.',
    'When it’s time to act, uncertainty paralyses me.',
    'When I am uncertain I can’t function very well.',
    'I always want to know what the future has in store for me.',
    'I can’t stand being taken by surprise.',
    'The smallest doubt can stop me from acting.',
    'I should be able to organize everything in advance.',
    'I must get away from all uncertain situations.',
]
SBI_POINTS = [(1, '1 Strongly disagree'), (2, '2'), (3, '3'), (4, '4'), (5, '5'), (6, '6'), (7, '7 Strongly agree')]
SBI_MOMENT = {  # Savoring the Moment subscale, SBI item numbers; R = reverse-scored
    2: ('It’s hard for me to hang onto a good feeling for very long.', True),
    5: ('I know how to make the most of a good time.', False),
    8: ('When it comes to enjoying myself, I’m my own “worst enemy.”', True),
    11: ('When something good happens, I can make my enjoyment of it last longer by thinking or doing certain things.', False),
    14: ('I can’t seem to capture the joy of happy moments.', True),
    17: ('I feel fully able to appreciate good things that happen to me.', False),
    20: ('I don’t enjoy things as much as I should.', True),
    23: ('It’s easy for me to enjoy myself when I want to.', False),
}
BFI_POINTS = [(1, 'Disagree strongly'), (2, 'Disagree a little'), (3, 'Neutral; no opinion'),
              (4, 'Agree a little'), (5, 'Agree strongly')]
BFI_OM = {  # BFI-2 item numbers; facet; R
    5: ('Has few artistic interests.', 'Aesthetic Sensitivity', True),
    10: ('Is curious about many different things.', 'Intellectual Curiosity', False),
    15: ('Is inventive, finds clever ways to do things.', 'Creative Imagination', False),
    20: ('Is fascinated by art, music, or literature.', 'Aesthetic Sensitivity', False),
    25: ('Avoids intellectual, philosophical discussions.', 'Intellectual Curiosity', True),
    30: ('Has little creativity.', 'Creative Imagination', True),
    35: ('Values art and beauty.', 'Aesthetic Sensitivity', False),
    40: ('Is complex, a deep thinker.', 'Intellectual Curiosity', False),
    45: ('Has difficulty imagining things.', 'Creative Imagination', True),
    50: ('Thinks poetry and plays are boring.', 'Aesthetic Sensitivity', True),
    55: ('Has little interest in abstract ideas.', 'Intellectual Curiosity', True),
    60: ('Is original, comes up with new ideas.', 'Creative Imagination', False),
}
EQ_POINTS = [(1, '1 Never'), (2, '2'), (3, '3'), (4, '4'), (5, '5 All the time')]
EQD = [  # developers' standalone order; EQ item numbers
    (3, 'I am better able to accept myself as I am.'),
    (15, 'I can observe unpleasant feelings without being drawn into them.'),
    (9, 'I notice that I don’t take difficulties so personally.'),
    (14, 'I can treat myself kindly.'),
    (10, 'I can separate myself from my thoughts and feelings.'),
    (16, 'I have the sense that I am fully aware of what is going on around me and inside me.'),
    (6, 'I can slow my thinking at times of stress.'),
    (17, 'I can actually see that I am not my thoughts.'),
    (18, 'I am consciously aware of a sense of my body as a whole.'),
    (12, 'I can take time to respond to difficulties.'),
    (20, 'I view things from a wider perspective.'),
]
PSS_POINTS = [(0, 'Never'), (1, 'Almost never'), (2, 'Sometimes'), (3, 'Fairly often'), (4, 'Very often')]
PSS4 = [
    ('In the last month, how often have you felt that you were unable to control the important things in your life?', False),
    ('In the last month, how often have you felt confident about your ability to handle your personal problems?', True),
    ('In the last month, how often have you felt that things were going your way?', True),
    ('In the last month, how often have you felt difficulties were piling up so high that you could not overcome them?', False),
]
# New items to test, unscored; 6-point + PNA. Drafted from Study 1's gaps (sfc_2-6) and from its item
# analysis with Norm, 2026-10-11 (sfc_7-15): Understanding items ask about recognising one's own mode in
# the moment (the old ones were truisms ~90% agreed with); Letting be items count elaborating, explaining
# or acting against letting be, never quiet labelling or noticing pleasant/unpleasant, which the course
# teaches as part of the sensing mode (and which loaded on Access in Study 1). sfc_1 was dropped (it
# repeats item 15's truism). Ids are not reused.
CANDIDATES = [
    ('sfc_2', 'My attention works the same way whether I am stressed or relaxed', 'Understanding the modes', True),
    ('sfc_3', 'To me, sensing and doing are two names for the same thing', 'Understanding the modes', True),
    ('sfc_7', 'I can tell which mode I am in while it is happening', 'Understanding the modes', False),
    ('sfc_8', 'I notice the moment my attention shifts from sensing to doing', 'Understanding the modes', False),
    ('sfc_9', 'I usually realize I was in the doing mode only long afterwards', 'Understanding the modes', True),
    ('sfc_5', 'I can feel at ease without knowing what comes next', 'Letting be', False),
    ('sfc_6', 'I am content to notice something without working out what it means', 'Letting be', False),
    ('sfc_10', 'I can notice that something feels unpleasant without trying to change it', 'Letting be', False),
    ('sfc_11', 'Once I have named what I notice, I am happy to leave it there', 'Letting be', False),
    ('sfc_12', 'When I notice something, I start explaining it to myself straight away', 'Letting be', True),
    ('sfc_13', 'After I name a sensation, one thought quickly leads to another', 'Letting be', True),
    ('sfc_14', 'I have trouble just letting what I notice be', 'Letting be', True),
    ('sfc_4', 'When I have free time, I would rather fill it than spend it just sensing', 'Valuing and savouring', True),
    ('sfc_15', 'Time spent just taking things in feels like time wasted', 'Valuing and savouring', True),
]
# Per-participant order (the renderer's interleave engine): same-factor items never adjacent, reversed
# items 3-5 a page and never first, opposite pairs on different pages. Checked feasible for 2,000 seeds.
def candidates_interleave():
    by = lambda f: [c for c, _, ff, _ in CANDIDATES if ff == f]
    return {'items': [c for c, *_ in CANDIDATES], 'page_sizes': [7, 7],
            'clusters': {'understanding': by('Understanding the modes'), 'letting_be': by('Letting be'),
                         'valuing': by('Valuing and savouring')},
            'cluster_min_gap': 2, 'cluster_max_per_page': 4,
            'groups': [{'items': [c for c, _, _, r in CANDIDATES if r], 'min_gap': 1, 'max_per_page': 5, 'min_per_page': 3,
                        'avoid_positions': [1], 'max_run_outside': 3}],
            'apart_pages': [['sfc_8', 'sfc_9'], ['sfc_11', 'sfc_12'], ['sfc_4', 'sfc_15']]}


def build_new():
    out = {}
    comps = [likert(f'ius12_{i:02d}', t, IUS_POINTS) for i, t in enumerate(IUS12, 1)]
    out['ius12'] = questionnaire('sf2-ius12', 'Uncertainty',
        'Please select the number that best corresponds to how much you agree with each item.', pages('ius', comps, [6, 6]))
    out['ius12']['scoring'] = {'method': 'sum', 'note': 'Carleton, Norton & Asmundson (2007). Lab-form order. Total 12-60.',
        'subscales': [{'name': 'Prospective', 'item_ids': [f'ius12_{i:02d}' for i in (1, 2, 4, 5, 8, 9, 11)]},
                      {'name': 'Inhibitory', 'item_ids': [f'ius12_{i:02d}' for i in (3, 6, 7, 10, 12)]}]}

    comps = [likert(f'sbi_{n:02d}', t, SBI_POINTS) for n, (t, _) in SBI_MOMENT.items()]
    out['sbi'] = questionnaire('sf2-sbi-moment', 'Enjoying good times',
        'For each statement listed below, please select the one number that best indicates how true the particular '
        'statement is for you. There are no right or wrong answers. Please be as honest as you can.', pages('sbi', comps, [8]))
    out['sbi']['scoring'] = {'method': 'mean', 'note': 'Bryant (2003); Savoring the Moment subscale (SBI items 2, 5, 8, 11, 14, 17, 20, 23).',
                             'reverse_items': [f'sbi_{n:02d}' for n, (_, r) in SBI_MOMENT.items() if r]}

    comps = [likert(f'bfi2_{n:02d}', f'I am someone who… {t[0].lower() + t[1:]}', BFI_POINTS) for n, (t, _, _) in BFI_OM.items()]
    comps.insert(7, check('bfi2_attn_check', 'Agree a little', BFI_POINTS))
    out['bfi'] = questionnaire('sf2-bfi2-om', 'Characteristics',
        'Here are a number of characteristics that may or may not apply to you. For example, do you agree that you are '
        'someone who likes to spend time with others? Please select a number for each statement to indicate the extent to '
        'which you agree or disagree with that statement.', pages('bfi', comps, [7, 6]))
    out['bfi']['scoring'] = {'method': 'mean', 'note': 'Soto & John (2017), Open-Mindedness domain (BFI-2 items).',
        'reverse_items': [f'bfi2_{n:02d}' for n, (_, _, r) in BFI_OM.items() if r],
        'subscales': [{'name': f, 'item_ids': [f'bfi2_{n:02d}' for n, (_, ff, _) in BFI_OM.items() if ff == f]}
                      for f in ('Aesthetic Sensitivity', 'Intellectual Curiosity', 'Creative Imagination')]}

    comps = [likert(f'eq_{n:02d}', t, EQ_POINTS) for n, t in EQD]
    out['eqd'] = questionnaire('sf2-eq-decentering', 'Your experiences',
        'For each statement below, please select the number that best describes your general experiences using a scale '
        'from 1 to 5, where 1 = Never and 5 = All the time.', pages('eq', comps, [6, 5]))
    out['eqd']['scoring'] = {'method': 'sum', 'note': 'Fresco et al. (2007) Decentering, 11 items (EQ numbers in ids), 11-55.'}

    comps = [likert(f'pss4_{i}', t, PSS_POINTS) for i, (t, _) in enumerate(PSS4, 1)]
    out['pss4'] = questionnaire('sf2-pss4', 'The last month',
        'The questions in this scale ask you about your feelings and thoughts during the last month. In each case, please '
        'indicate how often you felt or thought a certain way.', pages('pss', comps, [4]))
    out['pss4']['scoring'] = {'method': 'sum', 'note': 'Cohen et al. (1983); items 2 and 3 reverse-coded; 0-16. Licence via Mapi ePROVIDE.',
                              'reverse_items': ['pss4_2', 'pss4_3']}

    days = [opt(f'd{n}', f'{n} day' + ('' if n == 1 else 's'), value=n) for n in range(8)]
    crit = [
        mc('crit_pause_days', 'In the past 7 days, on how many days did you deliberately pause to take in your surroundings '
           'through your senses?', days),
        mc('crit_notice_first', 'In the past 7 days, when something unexpected happened, how often were you able to simply '
           'notice it before reacting?', [opt('never', 'Never', value=1), opt('rarely', 'Rarely', value=2),
           opt('sometimes', 'Sometimes', value=3), opt('often', 'Often', value=4), opt('almost_always', 'Almost always', value=5),
           opt('nothing_unexpected', 'Nothing unexpected happened')]),
        mc('crit_outdoors', 'In the past 7 days, about how much time in total did you spend outdoors not doing anything in '
           'particular?', [opt('none', 'None', value=0), opt('lt30', 'Less than 30 minutes', value=1),
           opt('30_120', '30 minutes to 2 hours', value=2), opt('2_5h', '2 to 5 hours', value=3),
           opt('gt5h', 'More than 5 hours', value=4)]),
    ]
    out['crit'] = questionnaire('sf2-past-week', 'Your past week', 'A few questions about the past 7 days.', pages('crit', crit, [3]))

    comp = {cid: likert(cid, t, SFS_POINTS) for cid, t, _, _ in CANDIDATES}
    spec = candidates_interleave()
    layout = fallback_pages(spec)      # the renderer's fallback is itself a valid order (fixed seed)
    out['cand'] = questionnaire('sf2-sfs-candidates', 'A few more statements',
        'A few more statements about how you pay attention. In general, how much do you agree with each statement? '
        'There are no right or wrong answers.',
        [{'id': f'sfc_p{k}', 'components': [comp[i] for i in ids]} for k, ids in enumerate(layout, 1)])
    out['cand']['interleave'] = spec
    out['cand']['candidates'] = [{'id': c, 'factor': f, 'reverse_keyed': r} for c, _, f, r in CANDIDATES]
    return out


def main():
    OUT.mkdir(exist_ok=True)
    v = build_validity()
    for k, slug, name in (('ffmq15', 'sf2-ffmq15', 'Everyday experiences'), ('maia2', 'sf2-maia2', 'Body awareness'),
                          ('phq4', 'sf2-phq4', 'Over the last two weeks'), ('bidr16', 'sf2-bidr16', 'About yourself')):
        v[k]['slug'], v[k]['name'] = slug, name
    # Attention checks are instructions, not questions about the person: no "Prefer not to answer".
    for c in (c for p in v['maia2']['pages'] for c in p['components'] if c['id'] == 'maia_attn_check'):
        c.pop('allow_pna', None)
    defs = {**v, **build_new()}
    for d in defs.values():
        (OUT / f"{d['slug']}.json").write_text(json.dumps(d, ensure_ascii=False, indent=2), encoding='utf-8')

    ids = {k: str(uuid.uuid5(uuid.NAMESPACE_URL, f'radlab:sf-study2:{k}')) for k in
           ['study', 'template', 'session', 'retest', 'retest_template', 'retest_session']}
    sql = ['-- Sense Foraging Study 2 and its retest, created INACTIVE for review. Generated by',
           '-- scripts/sense_foraging/build_study2.py; ids are deterministic (uuid5), so a rerun updates in place.',
           'BEGIN;']
    for d in defs.values():
        sql.append(f"INSERT INTO questionnaires (slug, name, definition) VALUES ({lit(d['slug'])}, {lit(d['name'])}, "
                   f"{lit(json.dumps(d, ensure_ascii=False))}::jsonb)\n  ON CONFLICT (slug) DO UPDATE SET definition = "
                   "EXCLUDED.definition, name = EXCLUDED.name, updated_at = now();")
    common = ("delivery_mode, active, consent_required, offer_repository_consent, allow_external_enrollment, "
              "external_enrollment_source, reminders_enabled, compensation_kind, reply_to_email")
    for key, name, title in (('study', 'Sense Foraging Study 2 (CFA + validity)', 'Everyday Experience Survey'),
                             ('retest', 'Sense Foraging Study 2 retest', 'Everyday Experience Survey: follow-up')):
        # The retest asks no repository question: its consent says the earlier choice carries over.
        repo = 'false' if key == 'retest' else 'true'
        sql.append(f"INSERT INTO studies (id, name, public_title, {common}) VALUES ({lit(ids[key])}, {lit(name)}, {lit(title)}, "
                   f"'online_single', false, true, {repo}, false, 'prolific', false, 'pay', 'norman.farb@utoronto.ca')\n"
                   "  ON CONFLICT (id) DO NOTHING;")
        sql.append(f"UPDATE studies SET separate_external_identity = true, questionnaire_layout = 'stacked', "
                   f"decline_message = (SELECT decline_message FROM studies WHERE id = {lit(STUDY1)}) WHERE id = {lit(ids[key])};")
    sql.append(f"UPDATE studies SET identity_link_study_id = {lit(ids['study'])} WHERE id = {lit(ids['retest'])};")

    q = lambda slug: f"(SELECT id FROM questionnaires WHERE slug = {lit(slug)})"
    steps = [('q', 'sf-background', 'Background questionnaire', None), ('q', 'sf-short-20', 'Sense Foraging Scale (short form)', None),
             ('q', 'sf2-sfs-candidates', 'Candidate statements (unscored)', None)]
    steps += [('q', defs[k]['slug'], label, 'validity') for k, label in
              (('ffmq15', 'FFMQ-15'), ('maia2', 'MAIA-2'), ('bidr16', 'BIDR-16'), ('phq4', 'PHQ-4'), ('ius12', 'IUS-12'),
               ('sbi', 'SBI Savoring the Moment'), ('bfi', 'BFI-2 Open-Mindedness'), ('eqd', 'EQ Decentering'),
               ('pss4', 'PSS-4'), ('crit', 'Past-week behaviour'))]
    steps += [('a', LIFESAT_ACTIVITY, 'Life satisfaction', 'validity'), ('a', DEBRIEF_ACTIVITY, 'Debrief', None)]
    retest_steps = [('q', 'sf-short-20', 'Sense Foraging Scale (short form)', None), ('a', DEBRIEF_ACTIVITY, 'Debrief', None)]

    for tkey, skey, study, label, folder, desc, st in (
            ('template', 'session', 'study', 'SenseForaging_Study2', 'Sense Foraging',
             'Study 2: background, short form, candidates, then the validity block in a per-participant order (shuffle_group validity), debrief.', steps),
            ('retest_template', 'retest_session', 'retest', 'SenseForaging_Study2_retest', 'Sense Foraging',
             'Study 2 retest: the short form again, ~2 weeks after Study 2, for an invited random subsample.', retest_steps)):
        sql.append(f"INSERT INTO session_templates (id, label, folder, description) VALUES ({lit(ids[tkey])}, {lit(label)}, "
                   f"{lit(folder)}, {lit(desc)}) ON CONFLICT (id) DO NOTHING;")
        sql.append(f"DELETE FROM session_template_nodes WHERE session_template_id = {lit(ids[tkey])};")
        for i, (kind, ref, lbl, group) in enumerate(st):
            col, val = ('questionnaire_id', q(ref)) if kind == 'q' else ('activity_id', lit(ref))
            sql.append(f"INSERT INTO session_template_nodes (session_template_id, order_index, {col}, label, shuffle_group) "
                       f"VALUES ({lit(ids[tkey])}, {i}, {val}, {lit(lbl)}, {lit(group) if group else 'NULL'});")
        sql.append("INSERT INTO study_sessions (id, study_id, session_template_id, day_number, send_time, label, order_index, "
                   f"node_key, link_expires_hours) VALUES ({lit(ids[skey])}, {lit(ids[study])}, {lit(ids[tkey])}, 1, '09:00', "
                   f"'Single session', 0, 'sf_single', 48) ON CONFLICT (id) DO NOTHING;")
    sql.append('COMMIT;')
    (OUT / 'study2_create.sql').write_text('\n'.join(sql) + '\n', encoding='utf-8')
    (OUT / 'ids.json').write_text(json.dumps(ids, indent=2), encoding='utf-8')
    n_items = {d['slug']: sum(1 for p in d['pages'] for c in p['components'] if c['type'] != 'information') for d in defs.values()}
    print(json.dumps(n_items, indent=1)); print('study', ids['study'], 'retest', ids['retest'])


if __name__ == '__main__':
    main()
