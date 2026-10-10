"""Build item pool 6 of the Sense Foraging questionnaire (proposal, 2026-10-10).

Pool 6 = pool 5's 34 items, unchanged (the PSY240 trial's instrument, on the
6-point scale since 2026-10-10) + 14 reverse-keyed items, chosen from 28 drafted
candidates (two per slot). The design follows reports/Reverse keyed items and
acquiescence.md: ~30% reversed, one per facet except Drift awareness, a second in
the four largest clusters, every reversal a contradictory of one named pool 5
item, no negations, partners on different pages.

Sources: scripts/sense_foraging/pool5_items.json (snapshot of radlab's
sf-pool-5). Writes receptive_state_item_pool_6.xlsx beside the earlier pools.

Usage:  python scripts/sense_foraging/build_pool6.py
"""
import json
from pathlib import Path

import openpyxl
from openpyxl.styles import Alignment, Font, PatternFill

HERE = Path(__file__).parent
DRIVE = Path(r'I:\Shared drives\SenseForaging\Assessment\MainQuestionnaire')
OUT = DRIVE / 'receptive_state_item_pool_6.xlsx'
POOL5 = json.loads((HERE / 'pool5_items.json').read_text(encoding='utf-8'))
ITEM = {i['n']: i for i in POOL5['items']}

# slot, facet, (partner item n, candidate text, note), (…b), proposed pick
SLOTS = [
    ('R1', 'Action', (1, 'I doubt my ability to move into the sensing mode',
                      'Contradicts "confident in my ability". Ability is the construct, so rule 8 allows it.'),
                     (1, 'I feel unsure whether I can move into the sensing mode when I want to',
                      'Softer; "when I want to" adds a condition the partner lacks (rule 4).'), 'a'),
    ('R2', 'Action', (9, 'Moving into the sensing mode is a struggle for me in everyday life',
                      'Matched on referent and time frame ("in everyday life").'),
                     (7, 'Once I notice I have slipped into the doing mode, I stay stuck there until something changes',
                      'Conditions on noticing, so it does not depend on trained insight (rule 6); longer.'), 'a'),
    ('R3', 'Practice', (3, 'For me, the sensing mode and the doing mode feel like the same thing',
                        'A clean contradictory of "different in kind"; shorter than its partner.'),
                       (2, 'The sensing mode feels available to me only at certain times',
                        'Contradicts "always available"; mild, so it is matched in intensity.'), 'a'),
    ('R4', 'Labelling', (33, 'When I try to name what I am sensing, I get caught up in thinking about it',
                         'Same referent and vocabulary as its partner. Only Labelling item besides 33.'),
                        (33, 'Putting a word to what I am sensing pulls me into thinking about it',
                         'Shorter; "pulls me into" may read as a figure of speech.'), 'a'),
    ('R5', 'Completeness', (21, 'When I notice a sensation, I feel I have to figure out what it means',
                            'Opposite stance (rule 1), no "non-judging" double negative (rule 2).'),
                           (21, 'I keep working at a sensation until I know what it means or where it leads',
                            'Mirrors the partner\'s wording closely; "working at" is less plain.'), 'a'),
    ('R6', 'Completeness', (20, 'What I notice in the moment only feels like enough once I have added meaning to it',
                            'Contradicts "complete on its own". Avoids "incomplete" (rule 2: no un-/in- forms).'),
                           (20, 'I need to add meaning to what I notice before it feels like enough',
                            'Shorter; the same claim.'), 'b'),
    ('R7', 'Normalising stress', (17, 'When stress narrows my attention, I see it as a personal failing',
                                  'Item 17 is the pool\'s one negation ("I do not view…"); this states the opposite '
                                  'stance positively. Self-blame tracks distress (rule 7), but 15 is neutral content.'),
                                 (17, 'When stress narrows my attention, I blame myself for it',
                                  'Plainer; slightly stronger than its partner.'), 'a'),
    ('R8', 'Safety', (22, 'Whether I feel safe or threatened, moving into the sensing mode feels the same to me',
                      'Contradicts the dependence 22 asserts. FLAG: a high-Action person may agree for the wrong '
                      'reason (sensing under threat is a trained skill); watch its cross-loading on Action.'),
                     (24, 'I find it hard to tell whether my surroundings are safe enough to explore openly',
                      'Contradicts 24; "hard" is defensible because 24 is itself an ability item (rule 8).'), 'b'),
    ('R9', 'View', (11, 'Only time spent getting things done feels worthwhile to me',
                    'The exact contradictory of 11 ("not only on getting things done"); a stance on doing, no '
                    'slight on doing (dual dignity).'),
                   (11, 'Time in the sensing mode feels wasted when I could be getting things done',
                    'Closer to its partner\'s wording; "wasted" is stronger than "real value" (rule 4).'), 'a'),
    ('R10', 'View', (12, 'When I am busy, returning to the sensing mode feels like a low priority',
                     'Same condition ("busy") and referent as 12, matched in intensity.'),
                    (10, 'Whether I am in the sensing mode or the doing mode feels out of my hands',
                     'Contradicts "always have a choice" (the course\'s central claim, Oct 2), but may read as '
                     'drift, which rule 6 keeps out.'), 'a'),
    ('R11', 'View under stress', (16, 'When I am stressed, I set the sensing mode aside until things calm down',
                                  'Opposite stance to "make space for", non-pejorative.'),
                                 (18, 'When stress pulls me toward narrow, familiar responses, returning to the sensing '
                                      'mode feels like a distraction',
                                  'Long (rule 9) and close to 18\'s own length.'), 'a'),
    ('R12', 'Openness', (28, 'When I am in the sensing mode, I would rather predict what happens than be surprised by it',
                         'Contradicts "welcome surprise … rather than trying to predict".'),
                        (28, 'In the sensing mode, I try to keep control of what happens next',
                         'Shorter; leaves out surprise, so it is a looser opposite (rule 3).'), 'a'),
    ('R13', 'Openness', (32, 'When I am in the sensing mode, I steer away from uncertainty and ambiguity',
                         'Contradicts "drawn to". A middle person ("tolerant") disagrees with both, so it '
                         'fails rule 3 by design of item 32 itself; prefer b.'),
                        (29, 'I need to know what comes next to feel at ease',
                         'Contradicts "value being free from the need … to know what comes next".'), 'b'),
    ('R14', 'Reward / awe', (25, 'Time in the sensing mode feels ordinary and flat to me',
                             'Contradicts "awe or wonder"; avoids "unremarkable" (rule 2).'),
                            (27, 'The feeling that comes from sensory exploration matters little to me',
                             '"little" is a near-negation; weaker match to "look forward to".'), 'a'),
]

# Interleave clusters for Study 1 (pool 5's facets; Labelling joins Practice's spacing).
CLUSTER = {'Action': 'Action', 'Practice': 'Practice', 'Labelling': 'Labelling', 'Completeness': 'Completeness',
           'Drift awareness': 'Drift-awareness', 'Normalising stress': 'Normalizing', 'Safety': 'Safety',
           'View': 'View: core', 'View under stress': 'View: under stress', 'Openness': 'View: openness',
           'Reward / awe': 'Reward / Awe'}

RULES = [
    ('1', 'Reverse the construct, not the sentence', 'Describe the low pole\'s stance or behaviour, never the absence of the skill.'),
    ('2', 'No negations', 'No not / never / don\'t / un- / in- / non- / -less in a stem.'),
    ('3', 'Middle-person test', 'Could someone moderate on the facet sensibly DISAGREE with both the reversal and its partner? '
          'If yes, rewrite. With no midpoint, that "disagree with both" pattern is the main misresponse (Weijters et al. 2010).'),
    ('4', 'One named partner', 'Same facet, matched on intensity, length, reading level, time frame and referent.'),
    ('5', 'Same course vocabulary', '"Sensing mode" / "doing mode" on both sides, so learning the words cannot favour one keying.'),
    ('6', 'Nothing that rests on trained insight', 'No lapse or autopilot frequency: noticing improves with training, so reported '
          'lapses rise as the skill grows (MAAS; FFMQ Acting with Awareness failed invariance over treatment). Hence no Drift reversal.'),
    ('7', 'A stance, not a symptom', 'Never the only distress item in its facet.'),
    ('8', '"Hard" only where ability is the construct', 'Action (and Safety 24, itself an ability item); elsewhere a stance opposite.'),
    ('9', 'One clause, short', 'No double-barrelling; phones and non-native readers.'),
    ('10', 'Over-draft 2 to 1, then think-aloud', 'Pool 4 already planned 5-8 think-aloud interviews; probe each reversal for misreading.'),
]

PLACEMENT = [
    ('Pages', '48 items + 2 attention checks = 50 slots on 6 pages (9, 9, 8, 8, 8, 8); about 7 minutes.'),
    ('Kept from pool 5', 'Cluster spacing (3 apart), View never adjacent, flagged pairs 4-13, 16-18, 1-9, 6-16 apart, '
                         'no more than 2 per cluster per page, the two attention checks in their halves.'),
    ('New: partners apart', 'Each reversal on a different page from its partner (Weijters, Geuens & Schillewaert 2009).'),
    ('New: reversals spread', 'Never two reversals adjacent; 2-3 per page; no run of more than 5 positive items.'),
    ('New: away from checks', 'No reversal first on page 1, or next to an attention check.'),
    ('Same response order', 'Disagree on the left on every item; reversal is in content only. Scored values are stored '
                            'unrecoded (1 = Strongly disagree on every item); reverse-scoring happens in analysis.'),
    ('Platform work', 'interleaveOrder.js needs three new rule types (different page, max run, per-page min/max for a group). '
                      'To build once pool 6 is approved.'),
]

ANALYSIS = [
    ('Screening', 'Exclusion rule unchanged (fail both attention checks). Antonym-pair inconsistency (pairs correlating -.60 or '
                  'below), longstring and seconds per item are FLAGS and a sensitivity analysis, never exclusions: '
                  'inconsistency also tracks reading level and mid-trait position. Tabulate Prefer not to answer by keying.'),
    ('Study 1 EFA', 'Polychoric, WLSMV, items unrecoded. Random-intercept ESEM with target rotation to the facets. Screen the '
                    'flagged near-duplicate pairs first. A factor made mainly of reversals is a method factor, not a facet. '
                    'Sensitivity: siren (Lorenzo-Seva & Ferrando), positive items only, without flagged respondents.'),
    ('Item retention', 'Keep a reversal if it loads on its facet comparably to the facet\'s positive items (random-intercept '
                       'solution) and correlates clearly negatively with its partner. Thresholds to pre-register.'),
    ('Study 2 CFA', 'Correlated facets + random-intercept acquiescence factor; compare with a reversed-item method factor; '
                    'BIDR-16 (8 of 16 reversed) as an external acquiescence check.'),
    ('RCT', 'Keyed score in baseline-adjusted ANCOVA; treatment effect also SEPARATELY on positive and reversed items '
            '(both rise = agreement shift, not improvement); invariance across time and arm with the method factor modelled.'),
    ('Fallback', 'If the reversals fail in Study 1: score from positive items only, but keep the best 4-6 pairs in the RCT, '
                 'unscored, so acquiescence stays estimable.'),
]

HEAD = Font(bold=True)
FILL = PatternFill('solid', fgColor='FCE4EF')
WRAP = Alignment(wrap_text=True, vertical='top')


def sheet(wb, title, header, rows, widths):
    ws = wb.create_sheet(title)
    ws.append(header)
    for c in ws[1]:
        c.font = HEAD
        c.fill = FILL
    for r in rows:
        ws.append(list(r))
    for col, w in zip('ABCDEFGHIJKL', widths):
        ws.column_dimensions[col].width = w
    for row in ws.iter_rows():
        for c in row:
            c.alignment = WRAP
    ws.freeze_panes = 'A2'
    return ws


def main():
    picks = []
    cand_rows = []
    for k, (slot, facet, a, b, pick) in enumerate(SLOTS):
        for tag, (partner, text, note) in (('a', a), ('b', b)):
            p = ITEM[partner]
            assert p['facet'] == facet, (slot, partner)
            cand_rows.append((slot, tag, facet, partner, p['text'], text, 'proposed' if tag == pick else '', note))
            if tag == pick:
                picks.append((35 + k, slot, facet, partner, text))
    assert len(picks) == 14

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = 'Instructions'
    info = [
        ('Sense Foraging outcome questionnaire: item pool 6 (PROPOSAL, 2026-10-10)', ''),
        ('', ''),
        ('Status', 'Proposal for Norm. Not approved, not on the platform, not yet in the ethics amendment.'),
        ('What it is', 'Pool 5 (34 items, Oct 6 wording, unchanged) plus 14 reverse-keyed items, picked from 28 candidates '
                       '(two per slot, on the Reversal candidates sheet). 48 items, 29% reversed.'),
        ('Why', 'An all-positive scale cannot separate agreeing from the content. That matters most in the RCT: the course '
                'teaches the items\' own words ("sensing mode", "doing mode"), so a shift toward agreeing would count as '
                'improvement. With reversals, real improvement raises positive items and lowers reversed ones; an agreement '
                'shift raises both. Evidence: reports/Reverse keyed items and acquiescence.md (radlab repo, 2026-10-10).'),
        ('Why 14', 'The only tested ratio for the random-intercept model is about one third reversed (de la Fuente & Abad '
                   '2020). A few reversals among many positives is the design the literature warns against (Weijters, '
                   'Baumgartner & Schillewaert 2013).'),
        ('Where', 'One per facet except Drift awareness, plus a second in Action, View, Openness and Completeness. '
                  'Never a whole facet reversed.'),
        ('Not reversed', 'Drift awareness: training raises noticing, so a reversed autopilot item could get WORSE as the '
                         'skill improves (MAAS; FFMQ Acting with Awareness failed invariance over treatment). Its four '
                         'items stay positive and are framed as catching the drift.'),
        ('Response scale', '1 Strongly disagree, 2 Disagree, 3 Mildly disagree, 4 Mildly agree, 5 Agree, 6 Strongly agree, '
                           'plus a small per-item "Prefer not to answer". Same as pool 5 since 2026-10-10.'),
        ('Known risk', 'The 6-point format without a midpoint had the most misresponse to reversed pairs in the one experiment '
                       'that varied it (Weijters, Cabooter & Schillewaert 2010), mostly people disagreeing with both items of a '
                       'loose pair. Hence rule 3 (the middle-person test) matters more than the count.'),
        ('Item numbers', 'Pool 5 keeps 1-34 (platform ids sf5_1 to sf5_34, as in the trial). The 14 reversals are 35-48 '
                         '(ids sf6_35 to sf6_48), stored unrecoded; reverse-score in analysis.'),
        ('Before finalising', '(1) Norm picks one candidate per slot (or edits). (2) Think-aloud on phones with 5-8 people, '
                              'probing each reversal. (3) Into the ethics amendment with pool 5. (4) Pre-register the analysis '
                              'plan below before Study 1.'),
        ('Shown before the items', POOL5['instructions']),
    ]
    for r in info:
        ws.append(list(r))
    ws['A1'].font = Font(bold=True, size=13)
    ws.column_dimensions['A'].width = 24
    ws.column_dimensions['B'].width = 120
    for row in ws.iter_rows(min_row=3):
        row[0].font = HEAD
        for c in row:
            c.alignment = WRAP

    pool = []
    partner_of = {}
    for n, slot, facet, partner, text in picks:
        partner_of.setdefault(partner, []).append(n)
    for i in POOL5['items']:
        pool.append((i['n'], i['id'], i['text'], 'positive', i['facet'], CLUSTER[i['facet']],
                     ', '.join(map(str, partner_of.get(i['n'], []))), 'pool 5 (unchanged)'))
    for n, slot, facet, partner, text in picks:
        pool.append((n, f'sf6_{n}', text, 'REVERSED', facet, CLUSTER[facet], str(partner), f'new (slot {slot})'))
    sheet(wb, 'Item Pool', ['Item #', 'Platform id', 'Wording', 'Keying', 'Facet (pool 5 key)', 'Interleave cluster',
                            'Paired with', 'Source'], pool, [8, 12, 90, 11, 20, 18, 10, 18])
    sheet(wb, 'Reversal candidates', ['Slot', 'Candidate', 'Facet', 'Partner #', 'Partner (pool 5)', 'Reversed candidate',
                                      'Proposed', 'Note'], cand_rows, [6, 10, 18, 9, 60, 60, 10, 70])
    sheet(wb, 'Drafting rules', ['#', 'Rule', 'Detail'], RULES, [5, 36, 110])
    sheet(wb, 'Placement', ['Rule', 'Detail'], PLACEMENT, [24, 120])
    sheet(wb, 'Analysis plan', ['Stage', 'Plan (pre-register before Study 1)'], ANALYSIS, [18, 130])
    wb.save(OUT)
    print('wrote', OUT, len(pool), 'items,', sum(1 for r in pool if r[3] == 'REVERSED'), 'reversed')


if __name__ == '__main__':
    main()
