"""Sense Foraging Study 2b (CFA + convergent and discriminant validity, 500 on Prolific): the
new definitions and the SQL that creates the study, INACTIVE, for review. Decisions 1-29 in
sense-foraging-scale/study2/decisions_after_2a.md (Norm, 31 October to 9 November 2026).

Session:
  background (sf-background, as Study 1 and 2a)
  -> the two modes and nine vignettes (sf2b-vignettes: 2a's, with Norm's 2 November introduction,
     V2 and V7; built in the analysis repo, copied here)
  -> the scale (sf2b-scale): the 10 (the 8 inside it) and three unscored reversed statements, one
     fixed order on two pages, with one attention check
  -> the PSY240 trial's other eight statements in Study 1 wording (sf2b-end), with one check;
     with sf6_36 and sf6_44 in sf2b-scale these complete the trial's 10
  -> validity block, first half, in a per-participant order (shuffle_group 'validity')
  -> the pause offer (sf2b-pause), one offer only (decision 21), then where and how tired
  -> validity block, second half, in its own per-participant order. A fixed step between two
     runs of a shuffle group splits them (src/lib/stepShuffle.js), so no measure crosses the pause.
  -> debrief.

The halves are fixed. Past-week behaviour comes after the pause, so its "deliberately pause"
question cannot prompt the offer. The third attention check is BFI-2's own.

Ids. Exports name a questionnaire's columns by the id's trailing number, so the scale's
statements are sf2b_01 to sf2b_13 (their item-review id is `source`); the trial statements keep
their sf6_ ids, as in sf2a-end, because they are Study 1's wording. Brief MAIA-2 keeps MAIA-2's
item numbers (maia_02 ...), the SPSQ-SF and ASI-3 items keep their source numbers.

Usage:  python scripts/sense_foraging/build_study2b.py
"""
import json
import sys
import uuid
from pathlib import Path

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE))
from build_draft import likert, lit, questionnaire, SFS_POINTS  # noqa: E402

OUT = HERE / 'study2b'
ANALYSIS = Path(r'F:\gits\sense-foraging-scale\study2\materials')
STUDY1 = '74cb6aa5-857c-408e-adfa-a5556acd62b7'
DEBRIEF_ACTIVITY = 'f79f90f7-9f59-44a6-8cf7-4ca45a76298a'
LIFESAT_ACTIVITY = 'e6ff9b25-d826-4561-8121-1201798948dc'
SCALE_INSTRUCTIONS = 'In general, how much do you agree with each statement? There are no right or wrong answers.'


def load(path):
    return json.loads(Path(path).read_text(encoding='utf-8'))


def comps(d):
    return {c['id']: c for p in d['pages'] for c in p['components']}


def check(cid, label):
    c = likert(cid, f'To show that you are reading each statement, please select \u201c{label}\u201d for this one.', SFS_POINTS)
    del c['allow_pna']      # an instruction, not a question about the person
    return c


# ---- the scale: the 10 and the three exploratory reversed statements (2a wording) -------------
A2 = comps(load(HERE / 'study2a' / 'sf2a-scale.json'))
A2_ITEMS = {it['source']: it for it in load(HERE / 'study2a' / 'sf2a-scale.json')['items']}
# Fixed order (decisions 2-4, 14): the order of the 10 is the one sent for the Look Again submission
# (statements 1-10), with the three exploratory statements and the check placed so reversed ones
# never sit together: positions 2, 5, 7, 9, 12 and 14 are reversed.
SCALE = [  # (source, role)
    ('N4', '8'), ('sf6_36', '8'), ('V10', '8'), ('sf6_27', '8'), ('N6', 'exploratory'), ('sfc_36', '8'), ('U4', '8'),
    ('A9', '10'), ('sfc_x2', '8'), (None, 'check'), ('sfc_35', '8'), ('sf6_44', 'exploratory'), ('sfc_24', '10'),
    ('sfc_31', 'exploratory'),
]
SCALE_CHECK = ('sf2b_attn_agree', 'Agree', 5)


def build_scale():
    rows, items, n = [], [], 0
    for src, role in SCALE:
        if src is None:
            cid, label, _ = SCALE_CHECK
            rows.append(check(cid, label))
            continue
        n += 1
        a = A2_ITEMS[src]
        pid = f'sf2b_{n:02d}'
        rows.append(likert(pid, A2[a['id']]['question'], SFS_POINTS))
        items.append({'id': pid, 'source': src, 'sf2a_id': a['id'], 'role': role, 'in_8': role == '8',
                      'in_10': role in ('8', '10'), 'reverse_keyed': a['reverse_keyed'],
                      **({'study1_item': a['study1_item']} if 'study1_item' in a else {})})
    assert n == 13 and sum(i['in_8'] for i in items) == 8 and sum(i['in_10'] for i in items) == 10
    assert sorted(i['source'] for i in items if i['in_8']) == sorted(['N4', 'sf6_36', 'V10', 'sf6_27', 'sfc_36', 'sfc_x2', 'sfc_35', 'U4'])
    pages = [{'id': 'sf2b_p1', 'components': rows[:7]}, {'id': 'sf2b_p2', 'components': rows[7:]}]
    d = questionnaire('sf2b-scale', 'How you pay attention', SCALE_INSTRUCTIONS, pages)
    d['items'] = items
    d['attention_checks'] = {SCALE_CHECK[0]: SCALE_CHECK[2]}
    d['scoring'] = {
        'method': 'mean', 'reverse': '7 - x',
        'sf8': [i['id'] for i in items if i['in_8']], 'sf10': [i['id'] for i in items if i['in_10']],
        'reverse_items': [i['id'] for i in items if i['reverse_keyed']],
        'unscored': [i['id'] for i in items if i['role'] == 'exploratory'],
        'note': 'The 8 is the primary score, the 10 secondary. "Prefer not to answer" is missing.'}
    return d


# ---- the trial's other statements, in Study 1 wording ----------------------------------------
# The PSY240 trial's 10 (Access + Valuing and savouring) in its own wording, psy240-sf-short-20.
# sf6_36 and sf6_44 are in sf2b-scale in that wording; the other eight are here. (2a's sf2a-end had
# sf6_7 and sf6_27 in other wordings; 2b uses the trial's.)
TRIAL_10 = ['sf6_9', 'sf6_35', 'sf6_36', 'sf6_44', 'sf6_7', 'sf6_8', 'sf6_12', 'sf6_18', 'sf6_27', 'sf6_11']
END_CHECK = ('sf2b_attn_disagree', 'Disagree', 2)


def build_end():
    trial = comps(load(HERE / 'study1' / 'psy240-sf-short-20.json'))
    scale_s1 = {i['study1_item'] for i in build_scale()['items'] if 'study1_item' in i}
    assert scale_s1 == {'sf6_36', 'sf6_44'}, scale_s1
    sc = comps(build_scale())
    for i in build_scale()['items']:
        if 'study1_item' in i:
            assert sc[i['id']]['question'] == trial[i['study1_item']]['question'], i
    rest = [t for t in TRIAL_10 if t not in scale_s1]
    rows = [likert(t, trial[t]['question'], SFS_POINTS) for t in rest]
    rows.insert(4, check(END_CHECK[0], END_CHECK[1]))
    d = questionnaire('sf2b-end', 'A few more statements',
                      'A few more statements about how you pay attention. ' + SCALE_INSTRUCTIONS,
                      [{'id': 'sf2b_end_p1', 'components': rows}])
    d['attention_checks'] = {END_CHECK[0]: END_CHECK[2]}
    where = ', '.join(i['id'] for i in build_scale()['items'] if 'study1_item' in i)
    d['source'] = ('PSY240 trial wording (psy240-sf-short-20, = Study 1 sf-pool6). With sf6_36 and sf6_44 in sf2b-scale '
                   f'({where}) these complete the trial primary score, Access + Valuing and savouring.')
    return d


# ---- Brief MAIA-2 (decision 19) --------------------------------------------------------------
# Rogowska, Tataruch & Klimowska (2023), Scientific Reports 13:21270: MAIA-2 items 2-4, 6, 9, 10,
# 11, 12, 15, 17, 19, 20, 25-27, 29-37, three per subscale, wording and 0-5 scale as MAIA-2
# (Mehling et al., 2018). The lab's form copy (Assessment/study2b) prints item 9 twice in place of 6.
BRIEF_MAIA = {'Noticing': [2, 3, 4], 'Not-Distracting': [6, 9, 10], 'Not-Worrying': [11, 12, 15],
              'Attention Regulation': [17, 19, 20], 'Emotional Awareness': [25, 26, 27],
              'Self-Regulation': [29, 30, 31], 'Body Listening': [32, 33, 34], 'Trusting': [35, 36, 37]}
MAIA_REVERSED = [6, 9, 10, 11, 12, 15]


def build_maia():
    full = load(HERE / 'study2' / 'sf2-maia2.json')
    fc = comps(full)
    order = sorted(n for ns in BRIEF_MAIA.values() for n in ns)
    rows = [fc[f'maia_{n:02d}'] for n in order]
    pages = [{'id': f'bmaia_p{k + 1}', 'components': rows[8 * k:8 * k + 8]} for k in range(3)]
    d = questionnaire('sf2b-maia2-brief', 'Body awareness', full['instructions'], pages)
    d['scoring'] = {'method': 'mean per subscale', 'range': '0-5', 'reverse': '5 - x',
                    'reverse_items': [f'maia_{n:02d}' for n in MAIA_REVERSED],
                    'subscales': {k: [f'maia_{n:02d}' for n in v] for k, v in BRIEF_MAIA.items()},
                    'source': 'Brief MAIA-2: Rogowska, Tataruch & Klimowska (2023), Sci Rep 13:21270; items and '
                              'wording from MAIA-2 (Mehling et al., 2018), keeping MAIA-2 item numbers.'}
    return d


# ---- BSSS-8 ----------------------------------------------------------------------------------
BSSS = [  # Hoyle, Stephenson, Palmgreen, Lorch & Donohew (2002), Personality and Individual Differences 32, 401-414
    ('Experience seeking', 'I would like to explore strange places.'),
    ('Boredom susceptibility', 'I get restless when I spend too much time at home.'),
    ('Thrill and adventure seeking', 'I like to do frightening things.'),
    ('Disinhibition', 'I like wild parties.'),
    ('Experience seeking', 'I would like to take off on a trip with no pre-planned routes or timetables.'),
    ('Boredom susceptibility', 'I prefer friends who are excitingly unpredictable.'),
    ('Thrill and adventure seeking', 'I would like to try bungee jumping.'),
    ('Disinhibition', 'I would love to have new and exciting experiences, even if they are illegal.'),
]
BSSS_POINTS = [(1, 'Strongly disagree'), (2, 'Disagree'), (3, 'Neither agree nor disagree'), (4, 'Agree'), (5, 'Strongly agree')]


def build_bsss():
    rows = [likert(f'bsss_{k}', t, BSSS_POINTS) for k, (_, t) in enumerate(BSSS, 1)]
    d = questionnaire('sf2b-bsss8', 'New experiences', 'How much do you agree or disagree with each statement?',
                      [{'id': 'bsss_p1', 'components': rows}])
    d['scoring'] = {'method': 'mean', 'range': '1-5', 'reverse_items': [],
                    'subscales': {s: [f'bsss_{k}' for k, (s2, _) in enumerate(BSSS, 1) if s2 == s] for s in dict(BSSS)},
                    'source': 'Brief Sensation Seeking Scale (BSSS-8): Hoyle et al. (2002). Study 2b discriminant (decision 11).'}
    return d


# ---- NCS-6 (decision 18) ---------------------------------------------------------------------
NCS = [  # Lins de Holanda Coelho, Hanel & Wolf (2020), Assessment 27(8), 1870-1885, Appendix (NCS-18 numbers)
    (1, 'I would prefer complex to simple problems.', False),
    (2, 'I like to have the responsibility of handling a situation that requires a lot of thinking.', False),
    (3, 'Thinking is not my idea of fun.', True),
    (4, 'I would rather do something that requires little thought than something that is sure to challenge my thinking abilities.', True),
    (11, 'I really enjoy a task that involves coming up with new solutions to problems.', False),
    (15, 'I would prefer a task that is intellectual, difficult, and important to one that is somewhat important but does not require much thought.', False),
]
NCS_POINTS = [(1, '1 Extremely uncharacteristic of me'), (2, '2'), (3, '3'), (4, '4'), (5, '5 Extremely characteristic of me')]


def build_ncs():
    rows = [likert(f'ncs_{n:02d}', t, NCS_POINTS) for n, t, _ in NCS]
    d = questionnaire('sf2b-ncs6', 'Thinking', 'For each statement, please indicate how characteristic it is of you.',
                      [{'id': 'ncs_p1', 'components': rows}])
    d['scoring'] = {'method': 'mean', 'range': '1-5', 'reverse': '6 - x',
                    'reverse_items': [f'ncs_{n:02d}' for n, _, r in NCS if r],
                    'source': 'Need for Cognition Scale-6: Lins de Holanda Coelho, Hanel & Wolf (2020); ids keep the '
                              'NCS-18 item numbers. Study 2b discriminant (decision 18).'}
    return d


# ---- SPSQ-SF Sensory Discomfort (decision 26) ------------------------------------------------
SPSQ_SD = [  # De Gucht & Woestenburg (2025), European Journal of Psychological Assessment 41(5), 348-356, ESM
    (33, 'I find harsh sounds very annoying.'),
    (7, 'Brightly colored flickering lights are disturbing to me.'),
    (42, 'I am often bothered by too bright light.'),
    (25, 'I am easily disturbed by bright light or strong odors.'),
]
SPSQ_POINTS = [(1, '1 Not at all'), (2, '2'), (3, '3'), (4, '4 Moderately'), (5, '5'), (6, '6'), (7, '7 Extremely')]


def build_spsq():
    rows = [likert(f'spsq_{n:02d}', t, SPSQ_POINTS) for n, t in SPSQ_SD]
    d = questionnaire('sf2b-spsq-sd', 'Light and sound', 'How much does each statement apply to you?',
                      [{'id': 'spsq_p1', 'components': rows}])
    d['scoring'] = {'method': 'mean', 'range': '1-7', 'reverse_items': [],
                    'source': 'SPSQ-SF Sensory Discomfort subscale (4 items): De Gucht & Woestenburg (2025); English '
                              'wording from the article\'s supplement (developed in Dutch); 7-point scale as the SPSQ '
                              '(1 not at all, 4 moderately, 7 extremely). Ids keep the SPSQ item numbers. Study 2b '
                              'discriminant (decision 26).'}
    return d


# ---- ASI-3 Physical Concerns (decision 26) ---------------------------------------------------
ASI_PC = [  # Taylor et al. (2007), Psychological Assessment 19(2), 176-188
    (3, 'It scares me when my heart beats rapidly.'),
    (4, 'When my stomach is upset, I worry that I might be seriously ill.'),
    (7, "When my chest feels tight, I get scared that I won't be able to breathe properly."),
    (8, "When I feel pain in my chest, I worry that I'm going to have a heart attack."),
    (12, 'When I notice my heart skipping a beat, I worry that there is something seriously wrong with me.'),
    (15, 'When my throat feels tight, I worry that I could choke to death.'),
]
ASI_POINTS = [(0, '0 Very little'), (1, '1 A little'), (2, '2 Some'), (3, '3 Much'), (4, '4 Very much')]


def build_asi():
    rows = [likert(f'asi_{n:02d}', t, ASI_POINTS) for n, t in ASI_PC]
    d = questionnaire('sf2b-asi3-pc', 'Body sensations',
                      'How much do you agree with each statement as a general description of yourself? If a statement '
                      'describes something you have never experienced, answer for how you think you would feel if you did.',
                      [{'id': 'asi_p1', 'components': rows}])
    d['scoring'] = {'method': 'sum', 'range': '0-24', 'reverse_items': [],
                    'source': 'ASI-3 Physical Concerns subscale (items 3, 4, 7, 8, 12, 15): Taylor et al. (2007). '
                              'Study 2b discriminant (decision 26).'}
    return d


# ---- the pause (decisions 10, 21, 22) --------------------------------------------------------
def build_pause():
    d = questionnaire('sf2b-pause', 'A short break', '',
                      [{'id': 'pause_p1', 'components': [{'id': 'pause_1', 'type': 'sensing_pause', 'slot': 1,
                                                           'ask_context': True,
                                                           # never shown (the offer has its own text); the
                                                           # definition validator and the export label want one
                                                           'question': 'Optional break'}]}])
    d['scoring'] = {'note': 'Behavioural criterion. Engaged pause = choice "pause", at least 20 s on the page, and time '
                            'unfocused + hidden under half the total (decision 22). Where and how tired are asked after '
                            'the decision.'}
    return d


def copied(path):
    d = load(path)
    assert d['questionnaire_type'] == 'composable'
    return d


VALIDITY_A = [('q', 'sf2-ffmq15', 'FFMQ-15'), ('q', 'sf2-bidr16', 'BIDR-16'), ('q', 'sf2-sbi-moment', 'SBI Savoring the Moment'),
              ('q', 'sf2b-bsss8', 'BSSS-8'), ('q', 'sf2b-ncs6', 'NCS-6'), ('q', 'sf2-phq4', 'PHQ-4'),
              ('q', 'sf2b-spsq-sd', 'SPSQ-SF Sensory Discomfort'), ('q', 'sf2-pss4', 'PSS-4'),
              ('a', LIFESAT_ACTIVITY, 'Life satisfaction')]
VALIDITY_B = [('q', 'sf2b-maia2-brief', 'Brief MAIA-2'), ('q', 'sf2-bfi2-om', 'BFI-2 Open-Mindedness'),
              ('q', 'sf2-eq-decentering', 'EQ Decentering'), ('q', 'sf2-samd-md', 'SAMD Meaning-Detecting'),
              ('q', 'sf2b-asi3-pc', 'ASI-3 Physical Concerns'), ('q', 'sf2-past-week', 'Past-week behaviour')]


def main():
    OUT.mkdir(exist_ok=True)
    defs = {'vig': copied(ANALYSIS / 'sf2b-vignettes.json'), 'scale': build_scale(), 'end': build_end(),
            'maia': build_maia(), 'bsss': build_bsss(), 'ncs': build_ncs(), 'spsq': build_spsq(), 'asi': build_asi(),
            'samd': copied(ANALYSIS / 'sf2-samd-md.json'), 'pause': build_pause()}
    for d in defs.values():
        (OUT / f"{d['slug']}.json").write_bytes(json.dumps(d, ensure_ascii=False, indent=2).encode('utf-8'))   # LF on every platform

    ids = {k: str(uuid.uuid5(uuid.NAMESPACE_URL, f'radlab:sf-study2b:{k}')) for k in ('study', 'template', 'session')}
    sql = ['-- Sense Foraging Study 2b, created INACTIVE for review. Generated by',
           '-- scripts/sense_foraging/build_study2b.py; ids are deterministic (uuid5), so a rerun updates in place.',
           'BEGIN;']
    for d in defs.values():
        sql.append(f"INSERT INTO questionnaires (slug, name, definition) VALUES ({lit(d['slug'])}, {lit(d['name'])}, "
                   f"{lit(json.dumps(d, ensure_ascii=False))}::jsonb)\n  ON CONFLICT (slug) DO UPDATE SET definition = "
                   "EXCLUDED.definition, name = EXCLUDED.name, updated_at = now();")
    sql.append("INSERT INTO studies (id, name, public_title, delivery_mode, active, consent_required, offer_repository_consent, "
               "allow_external_enrollment, external_enrollment_source, reminders_enabled, compensation_kind, reply_to_email) "
               f"VALUES ({lit(ids['study'])}, 'Sense Foraging Study 2b (CFA + validity)', 'Everyday Attention Survey', 'online_single', "
               "false, true, true, false, 'prolific', false, 'pay', 'norman.farb@utoronto.ca')\n  ON CONFLICT (id) DO NOTHING;")
    # Face-scale "Prefer not to answer" is a study setting (20261013); the completion code comes from
    # the Prolific study, so completion_redirect_url is set when Norm creates it there.
    sql.append("UPDATE studies SET separate_external_identity = true, questionnaire_layout = 'stacked', ratings_allow_pna = true, "
               f"max_attempts = 1, decline_message = (SELECT decline_message FROM studies WHERE id = {lit(STUDY1)}) "
               f"WHERE id = {lit(ids['study'])};")
    # Decision 28: the pre-2a Study 2 build and its retest are retired, so nobody posts them.
    for old in ('528674d9-f691-5cff-a81c-1f4f0996b08b', '65ffadea-be05-56c7-922a-20b78258c6ab'):
        sql.append(f"UPDATE studies SET name = name || ' (RETIRED: superseded by 2b)', active = false, "
                   f"allow_external_enrollment = false WHERE id = {lit(old)} AND name NOT LIKE '%RETIRED%';")

    q = lambda slug: f"(SELECT id FROM questionnaires WHERE slug = {lit(slug)})"
    steps = [('q', 'sf-background', 'Background questionnaire', None),
             ('q', 'sf2b-vignettes', 'The two modes: vignettes and self-rating', None),
             ('q', 'sf2b-scale', 'Sense Foraging Scale: the 10 + 3 exploratory + check', None),
             ('q', 'sf2b-end', 'Trial statements in Study 1 wording', None)]
    steps += [(k, r, lbl, 'validity') for k, r, lbl in VALIDITY_A]
    steps += [('q', 'sf2b-pause', 'Pause offer', None)]
    steps += [(k, r, lbl, 'validity') for k, r, lbl in VALIDITY_B]
    steps += [('a', DEBRIEF_ACTIVITY, 'Debrief', None)]
    sql.append(f"INSERT INTO session_templates (id, label, folder, description) VALUES ({lit(ids['template'])}, "
               "'SenseForaging_Study2b', 'Sense Foraging', 'Study 2b: background, vignettes, the scale, the trial statements, "
               "validity block (first half, shuffled), the pause offer, validity block (second half, shuffled), debrief.') "
               "ON CONFLICT (id) DO NOTHING;")
    sql.append(f"DELETE FROM session_template_nodes WHERE session_template_id = {lit(ids['template'])};")
    for i, (kind, ref, label, group) in enumerate(steps):
        col, val = ('questionnaire_id', q(ref)) if kind == 'q' else ('activity_id', lit(ref))
        sql.append(f"INSERT INTO session_template_nodes (session_template_id, order_index, {col}, label, shuffle_group) "
                   f"VALUES ({lit(ids['template'])}, {i}, {val}, {lit(label)}, {lit(group) if group else 'NULL'});")
    # send_time must be set on a single-shot study, or every auto-enroll join fails (website.md §26c)
    sql.append("INSERT INTO study_sessions (id, study_id, session_template_id, day_number, send_time, label, order_index, "
               f"node_key, link_expires_hours) VALUES ({lit(ids['session'])}, {lit(ids['study'])}, {lit(ids['template'])}, 1, "
               "'09:00', 'Single session', 0, 'sf_single', 48) ON CONFLICT (id) DO NOTHING;")
    sql.append('COMMIT;')
    (OUT / 'study2b_create.sql').write_bytes(('\n'.join(sql) + '\n').encode('utf-8'))
    (OUT / 'ids.json').write_bytes((json.dumps(ids, indent=2) + '\n').encode('utf-8'))
    count = lambda d: sum(1 for p in d['pages'] for c in p['components'] if c['type'] not in ('information', 'sensing_pause'))
    print(json.dumps({d['slug']: count(d) for d in defs.values()}), 'study', ids['study'])


if __name__ == '__main__':
    main()
