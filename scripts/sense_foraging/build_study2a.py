"""Sense Foraging Study 2a (structure, ~500 on Prolific): definitions and the SQL that
creates the study, INACTIVE, for review (Norm, 2026-10-29).

The wording is the round 6 set from senseforaging.com/research/itemset, snapshotted in
study2a/items.json from the Handbook's src/pages/research/itemSetData.json (the file the
/research/study2a/list and /take pages read). Rebuild from a fresh copy if it changes.

Session:
  background (sf-background, as Study 1)
  -> the two modes and nine vignettes (sf2a-vignettes): the introduction, then the vignettes
     in a per-participant order, three a page, rated 1 Doing mode to 6 Sensing mode, no
     feedback; then the self-rating on the same anchors
  -> the 58 statements and three attention checks (sf2a-scale), per-participant order,
     eight or seven a page
  -> IUS-12 (sf2-ius12, the Study 2b definition), which also puts time between the scale's
     reworded statements and their Study 1 wording
  -> the trial's six other primary-score statements in Study 1 wording (sf2a-end), fixed order
  -> debrief.

Ids. Exports name a questionnaire's columns by the id's trailing number, and an id names one
wording, so the 58 statements are sf2a_01 to sf2a_58 (their item-review id is `source`; the
7 still in Study 1 wording also carry `study1_item`). The end items keep their sf6_ ids:
they are Study 1's wording. Vignettes are vig_1 to vig_9 (V1 to V9) and vig_self.

Usage:  python scripts/sense_foraging/build_study2a.py
"""
import json
import sys
import uuid
from pathlib import Path

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE))
from build_draft import fallback_pages, info, likert, lit, questionnaire, SFS_POINTS  # noqa: E402

OUT = HERE / 'study2a'
STUDY1 = '74cb6aa5-857c-408e-adfa-a5556acd62b7'
DEBRIEF_ACTIVITY = 'f79f90f7-9f59-44a6-8cf7-4ca45a76298a'
DATA = json.loads((OUT / 'items.json').read_text(encoding='utf-8'))

CHECKS = {  # item-review id: (platform id, correct value)
    'AC1': ('sf2a_attn_disagree', 2),
    'AC2': ('sf2a_attn_agree', 5),
    'AC3': ('sf2a_attn_strongly_disagree', 1),
}
SCALE_INSTRUCTIONS = 'In general, how much do you agree with each statement? There are no right or wrong answers.'

ITEMS = [{**it, 'factor': f['name'], 'pid': f'sf2a_{n:02d}'}
         for n, (f, it) in enumerate(((f, it) for f in DATA['factors'] for it in f['items']), 1)]
PID = {it['id']: it['pid'] for it in ITEMS}


def bipolar_points():
    lo, hi = DATA['anchors']
    return [(1, f'1 {lo}'), (2, '2'), (3, '3'), (4, '4'), (5, '5'), (6, f'6 {hi}')]


def check(cid, text):
    c = likert(cid, text, SFS_POINTS)
    del c['allow_pna']      # an instruction, not a question about the person
    return c


def build_vignettes():
    pts = bipolar_points()
    vid = lambda v: f"vig_{v['id'][1:]}"
    stem = info('vig_stem_{}', DATA['stem'], f"Rate each one from 1 {DATA['anchors'][0]} to 6 {DATA['anchors'][1]}.")
    vigs = [likert(vid(v), v['text'], pts) for v in DATA['vignettes']]
    pages = [{'id': f'vig_p{k}', 'components': [{**stem, 'id': f'vig_stem_{k}'}, *vigs[3 * k - 3:3 * k]]} for k in (1, 2, 3)]
    pages.append({'id': 'vig_p4', 'components': [info('vig_self_head', 'Now, about you', ''),
                                                 likert('vig_self', DATA['selfRating'], pts)]})
    d = questionnaire('sf2a-vignettes', 'Two ways of noticing', '\n\n'.join(DATA['intro']), pages)
    sensing = [vid(v) for v in DATA['vignettes'] if v['sensing']]
    doing = [vid(v) for v in DATA['vignettes'] if not v['sensing']]
    # Random order, three a page, each page with at least one of each kind.
    d['interleave'] = {'items': [vid(v) for v in DATA['vignettes']], 'page_sizes': [3, 3, 3],
                       'groups': [{'items': sensing, 'min_gap': 1, 'max_per_page': 2, 'min_per_page': 1},
                                  {'items': doing, 'min_gap': 1, 'max_per_page': 2, 'min_per_page': 1}]}
    d['vignettes'] = [{'id': vid(v), 'source': v['id'], 'kind': v['kind'], 'sensing': v['sensing']} for v in DATA['vignettes']]
    d['scoring'] = {'note': 'Not a scale. Separation = mean(sensing vignettes) - mean(doing vignettes), 1 = Doing mode, '
                            '6 = Sensing mode. vig_self is the self-rating on the same anchors.'}
    return d


def scale_interleave():
    p = lambda *ids: [PID[i] for i in ids]
    items = [it['pid'] for it in ITEMS]
    checks = [cid for cid, _ in CHECKS.values()]
    n = len(items) + len(checks)
    sizes = [8] * 5 + [7] * 3
    assert sum(sizes) == n, (sum(sizes), n)
    third = n // 3
    return {
        'items': items + checks,
        'page_sizes': sizes,
        'clusters': {f['key']: [PID[it['id']] for it in f['items']] for f in DATA['factors']},
        'cluster_min_gap': 2,
        'cluster_max_per_page': 3,
        'groups': [
            # reversed statements spread through, never first on a page
            {'items': [it['pid'] for it in ITEMS if it['r']], 'min_gap': 1, 'max_per_page': 4, 'min_per_page': 1,
             'avoid_positions': [1]},
            # statements that name a mode, so they do not bunch
            {'items': [it['pid'] for it in ITEMS if 'mode' in it['text']], 'min_gap': 3, 'max_per_page': 2},
        ],
        'apart_pages': [
            p('sf6_9', 'sf6_36'), p('sf6_36', 'sf6_35'), p('sf6_9', 'sf6_35'),   # easy / struggle / question my ability
            p('sf6_12', 'sf6_44'), p('sf6_11', 'sf6_43'),                         # worth it when busy / low priority
            p('sf6_7', 'N2'), p('sfc_8', 'sfc_9'), p('U3', 'sfc_9'),              # slipping, rushing
            p('sf6_15', 'U1'), p('sf6_15', 'U4'),                                 # "When I am stressed" / react the same way
            p('sf6_8', 'A9'),                                                     # new places
            p('sfc_35', 'F10'), p('N4', 'sfc_18'),                                # "During my day" / sights and sounds
            p('sfc_12', 'sfc_14'), p('sfc_26', 'sfc_13'), p('sf6_21', 'sfc_14'),  # same openings / letting it be
            p('sfc_29', 'sfc_30'), p('sfc_28', 'sfc_31'),                         # pause before acting / act at once
        ],
        # one check in each third, never at a page's edge
        'anchored': {checks[0]: {'min_position': 3, 'max_position': third - 1, 'not_page_edge': True},
                     checks[1]: {'min_position': third + 2, 'max_position': 2 * third - 1, 'not_page_edge': True},
                     checks[2]: {'min_position': 2 * third + 2, 'max_position': n - 2, 'not_page_edge': True}},
    }


def build_scale():
    comp = {it['pid']: likert(it['pid'], it['text'], SFS_POINTS) for it in ITEMS}
    for c in DATA['checks']:
        cid, _ = CHECKS[c['id']]
        comp[cid] = check(cid, c['text'])
    spec = scale_interleave()
    layout = fallback_pages(spec)      # the renderer's own order for a fixed seed: a valid fallback
    d = questionnaire('sf2a-scale', 'How you pay attention', SCALE_INSTRUCTIONS,
                      [{'id': f'sf2a_p{k}', 'components': [comp[i] for i in ids]} for k, ids in enumerate(layout, 1)])
    d['interleave'] = spec
    d['items'] = [{'id': it['pid'], 'source': it['id'], 'factor': it['factor'], 'reverse_keyed': it['r'],
                   **({'study1_item': it['id']} if it.get('study1') else {})} for it in ITEMS]
    # Only Study 1's own ids (sf6_) can be in its wording; an sfc_ statement unchanged since the
    # candidate list never ran in Study 1.
    assert all(i['study1_item'].startswith('sf6_') for i in d['items'] if 'study1_item' in i)
    d['attention_checks'] = {cid: v for cid, v in CHECKS.values()}
    d['factors'] = {f['name']: {'definition': f['def'], 'item_ids': [PID[it['id']] for it in f['items']]} for f in DATA['factors']}
    return d


def build_end():
    comps = [likert(e['id'], e['text'], SFS_POINTS) for e in DATA['end']]
    d = questionnaire('sf2a-end', 'A few more statements',
                      'A few more statements about how you pay attention. ' + SCALE_INSTRUCTIONS,
                      [{'id': 'end_p1', 'components': comps}])
    d['source'] = ('Study 1 wording (sf-pool6). With sf6_9, sf6_35, sf6_36 and sf6_44 in sf2a-scale (sf2a_01-03, sf2a_27), '
                   'these complete the PSY240 trial primary score, Access + Valuing and savouring.')
    return d


def main():
    defs = {'vig': build_vignettes(), 'scale': build_scale(), 'end': build_end()}
    for d in defs.values():
        (OUT / f"{d['slug']}.json").write_bytes(json.dumps(d, ensure_ascii=False, indent=2).encode('utf-8'))   # LF on every platform

    ids = {k: str(uuid.uuid5(uuid.NAMESPACE_URL, f'radlab:sf-study2a:{k}')) for k in ('study', 'template', 'session')}
    sql = ['-- Sense Foraging Study 2a, created INACTIVE for review. Generated by',
           '-- scripts/sense_foraging/build_study2a.py; ids are deterministic (uuid5), so a rerun updates in place.',
           'BEGIN;']
    for d in defs.values():
        sql.append(f"INSERT INTO questionnaires (slug, name, definition) VALUES ({lit(d['slug'])}, {lit(d['name'])}, "
                   f"{lit(json.dumps(d, ensure_ascii=False))}::jsonb)\n  ON CONFLICT (slug) DO UPDATE SET definition = "
                   "EXCLUDED.definition, name = EXCLUDED.name, updated_at = now();")
    sql.append("INSERT INTO studies (id, name, public_title, delivery_mode, active, consent_required, offer_repository_consent, "
               "allow_external_enrollment, external_enrollment_source, reminders_enabled, compensation_kind, reply_to_email) "
               f"VALUES ({lit(ids['study'])}, 'Sense Foraging Study 2a (structure)', 'Everyday Attention Survey', 'online_single', "
               "false, true, true, false, 'prolific', false, 'pay', 'norman.farb@utoronto.ca')\n  ON CONFLICT (id) DO NOTHING;")
    sql.append("UPDATE studies SET separate_external_identity = true, questionnaire_layout = 'stacked', "
               f"decline_message = (SELECT decline_message FROM studies WHERE id = {lit(STUDY1)}) WHERE id = {lit(ids['study'])};")

    q = lambda slug: f"(SELECT id FROM questionnaires WHERE slug = {lit(slug)})"
    steps = [('q', 'sf-background', 'Background questionnaire'), ('q', 'sf2a-vignettes', 'The two modes: vignettes and self-rating'),
             ('q', 'sf2a-scale', 'Sense Foraging statements (58 + 3 checks)'), ('q', 'sf2-ius12', 'IUS-12'),
             ('q', 'sf2a-end', 'Trial statements in Study 1 wording'), ('a', DEBRIEF_ACTIVITY, 'Debrief')]
    sql.append(f"INSERT INTO session_templates (id, label, folder, description) VALUES ({lit(ids['template'])}, "
               "'SenseForaging_Study2a', 'Sense Foraging', 'Study 2a: background, the two modes and nine vignettes, the 58 "
               "statements, IUS-12, the six trial statements in Study 1 wording, debrief.') ON CONFLICT (id) DO NOTHING;")
    sql.append(f"DELETE FROM session_template_nodes WHERE session_template_id = {lit(ids['template'])};")
    for i, (kind, ref, label) in enumerate(steps):
        col, val = ('questionnaire_id', q(ref)) if kind == 'q' else ('activity_id', lit(ref))
        sql.append(f"INSERT INTO session_template_nodes (session_template_id, order_index, {col}, label) "
                   f"VALUES ({lit(ids['template'])}, {i}, {val}, {lit(label)});")
    # send_time must be set on a single-shot study, or every auto-enroll join fails (website.md §26c)
    sql.append("INSERT INTO study_sessions (id, study_id, session_template_id, day_number, send_time, label, order_index, "
               f"node_key, link_expires_hours) VALUES ({lit(ids['session'])}, {lit(ids['study'])}, {lit(ids['template'])}, 1, "
               "'09:00', 'Single session', 0, 'sf_single', 48) ON CONFLICT (id) DO NOTHING;")
    sql.append('COMMIT;')
    (OUT / 'study2a_create.sql').write_bytes(('\n'.join(sql) + '\n').encode('utf-8'))
    (OUT / 'ids.json').write_bytes((json.dumps(ids, indent=2) + '\n').encode('utf-8'))
    n = {d['slug']: sum(1 for p in d['pages'] for c in p['components'] if c['type'] != 'information') for d in defs.values()}
    print(json.dumps(n), 'study', ids['study'])


if __name__ == '__main__':
    main()
