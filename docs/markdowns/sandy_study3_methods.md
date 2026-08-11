# Sandy Study 3 — Methods & Analysis Log

Running record of every data-handling and analysis decision, maintained for reportability
and computational reproducibility. Updated after each step. Companion to
[`sandy_study3_prereg.md`](sandy_study3_prereg.md).

- **Study**: Perfectionism and Effort Allocation in Multi-task Performance (Sandy Study 3)
- **Platform study id**: `f8cbf629-d477-4ada-ae47-23a59c602b13`
- **Source export**: `I:\Shared drives\Sandy\Study3\Data\PilotSandy Study 3_study_export.zip`
  (generated from `/admin/export`; 12 CSVs; 385 KB)
- **Analysis environment**: R 4.6.0, Python 3.13 (pandas 2.3.3, numpy 2.3.5, scipy 1.16.3)
- **Status**: Step 1 complete (data review). Steps 2–6 pending.

> **Pilot firewall.** The pilot is used *only* to estimate nuisance parameters (variances,
> zero rates, reliabilities, ICCs, distribution shapes, feasibility). No pilot analysis
> estimates an effect size for any preregistered hypothesis: no trait→outcome association
> and no condition→outcome contrast is computed at any point. This is enforced structurally
> in the extraction code (§Step 3) and is why the pilot can precede registration without
> circularity (prereg §3.5).

---

## Step 1 — Data review against the preregistration

**Date**: 2026-08-11. **Scripts**: `inventory.py`, `inventory2.py`, `inventory3.py`,
`inventory4.py` (to be committed to the analysis repo as `scripts/01_inventory.py`).

### 1.1 Cohort identification

The export contains all participants ever enrolled in the study, including development
and simulated runs. Cohorts are separable by `participant_id` format:

| Cohort | n | `participant_id` form | Enrolled |
|---|---|---|---|
| **Prolific pilot** | **22** | 24-char hex (Prolific PID) | 2026-08-04 (6), 2026-08-06 (16) |
| Internal/dev | 34 | `SIM_*`, null, or platform anon ids | 2026-06-16 → 2026-07-28 |

Of the 22 Prolific enrolments: 21 have step timings, **20 have a complete session**
(both games, all seven questionnaires, all state ratings, reached debrief). The analysis
cohort is therefore **N = 20**, which matches the intended pilot size.

Condition balance in the complete cohort: **12 redemption / 10 control** (`framing` slot).
All 20 have exactly one `framing` draw; none missing. Neither game was replayed by any
participant (max 1 session each), so no first-attempt rule is needed.

### 1.2 Where each preregistered variable actually lives

Every variable named in prereg §4 is present in the export. Sourcing is **not** what the
prereg assumed in three places (flagged ⚠).

| Prereg §4 variable | Source table | Key / filter | Status |
|---|---|---|---|
| Framing condition | `participant_assignments` | `node_id='framing'` | ✔ 20/20 |
| APS-R, BAT-Student, PANAS, RRQ, GSE, DASS-21, SCS-26 | `questionnaire_responses` | `questionnaire_slug`, `responses` jsonb | ✔ 20/20 each |
| Stress (T0/T1/T2) | `vas_responses` | `scale_id=14f70c02…` (slug `stress`, emoji_6) | ✔ 3/participant |
| Task satisfaction (×2) | `vas_responses` | `scale_id=667755b1…` (slug `task-satisfaction`) | ✔ 2/participant |
| Negative / positive emotionality (T0/T1/T2) | `questionnaire_responses` ⚠ | slug `slider_negative_emotionality` / `_positive_` | ✔ 3/participant |
| Predicted efficacy (×2), post efficacy (×2), effort (×2) | `questionnaire_responses` ⚠ | corresponding `slider_*` slugs | ✔ 2/participant |
| Aptitude subtask scores + percentiles, `avg_pct`, task switches | `aptitude_sessions` | `game IS NULL` | ✔ 20/20, no missing |
| ColourMax coverage/precision per image, `avg_pct` | `aptitude_sessions` ⚠ | `game='color_max'`, `results` jsonb → `scores[]` | ✔ 20/20 |
| **ColourMax time per image** | `aptitude_events` ⚠⚠ | reconstructed from `page_switch` | ✔ (see §1.3) |
| Demographics | `equity_census_responses` | `responses` jsonb | ✔ 20/20 |
| Session/step durations | `participant_step_timings` | `study_id` | ✔ 21 participants |

⚠ **Sliders are questionnaires, not VAS.** Single-item sliders are stored as rows in
`questionnaire_responses` with their own slug, not in `vas_responses`. Only the two
6-point emoji scales (stress, task-satisfaction) are true VAS rows. The prereg's §4
parenthetical slugs are correct as identifiers but imply the wrong table.

⚠ **ColourMax lives in the Aptitude tables.** There is no `color_max` table. ColourMax
writes a row to `aptitude_sessions` with `game='color_max'` and per-image results in the
`results` jsonb, and its events to `aptitude_events` with `task='color_max'`. Aptitude
Suite rows are identified by `game IS NULL` (not by a positive label).

⚠ **ColourMax rows carry no `study_id`** (null on all 52 rows in the export; the game's
insert never sets it). Study linkage must go through `user_id` → `study_enrollments`.
Aptitude Suite rows do carry `study_id` on 44/76. *Platform note for Norm: worth setting
`study_id` on the ColorMax insert so future exports are study-scoped without a join.*

### 1.3 ColourMax time-per-image is derivable, but only from the event log

This is the most consequential methods finding. The H1C dependent variable (time on each
of five images) is **not stored as a field**:

- `results.toolTimeByPage` is **brush-contact time** — accumulated only between pointer-down
  and pointer-up, per tool. It is not dwell time and must not be used for H1C.
- Dwell time is reconstructible from `aptitude_events`: the game logs `page_switch` with
  `value = {from, to}` and a wall-clock `elapsed_ms`, bracketed by `session_start`
  (elapsed 0) and `game_end`. The initial page is 0 (`pageRef = useRef(0)`), and `goPage`
  early-returns on self-switches, so the segment sequence is complete and unambiguous.

**Validation on the 20-participant cohort**: reconstructed dwell totals sum to
mean 301.0 s (SD 1.9; range 300.2–308.9) against a nominal 300 s cap — i.e. the
reconstruction closes to the true budget for every participant. Page switches:
median 4, range 1–13.

*Caveat carried forward*: `elapsed_ms` is wall-clock while the in-game countdown is a
`setInterval`, which browsers throttle in background tabs. Across the full export
(including dev sessions) reconstructed totals ranged up to 21,894 s, i.e. a backgrounded
tab. No pilot participant showed this, but the confirmatory pipeline will normalise to
within-person proportions (as prereg §4 already specifies, using each participant's actual
total rather than the nominal 300 s) and will flag any session whose total falls outside
290–320 s.

### 1.4 Questionnaire scoring keys

Scoring keys live in `questionnaires.definition.scoring.subscales[]` — with `item_ids` and
`reverse_items` — **not** on the item objects (item-level `reverse` is null everywhere,
which is a red herring). Verified correct against the published instruments:

- **APS-R** (23 items, 1–7): Discrepancy = 12 items, no reverse ✔ (matches prereg)
- **RRQ-Rumination** (12 items, 1–5): reverse = `rrs_6`, `rrs_9`, `rrs_10` ✔ — the three
  negatively-worded items ("I don't waste time rethinking…", "I never ruminate…", "It is
  easy for me to put unwanted thoughts out of my mind")
- **SCS-26** (26 items, 1–5): Self-Judgment, Isolation, Over-Identification fully reversed ✔
- **BAT-Student**, **GSE**, **PANAS**, **DASS-21**: no reverse items ✔

Two deviations from the prereg text, both requiring a prereg edit:

1. ⚠ **BAT-Student is 33 items, not 23.** The platform administers the full instrument:
   BAT-C core = Exhaustion (8) + Mental Distance (5) + Cognitive Impairment (5) +
   Emotional Impairment (5) = 23; plus BAT-S secondary = Psychological Complaints (5) +
   Psychosomatic Complaints (5) = 10. The preregistered burnout predictor ("total mean,
   core dimensions") will be the **23 core items**; the 10 secondary items are exploratory.
2. The platform's stored `method` for APS-R is `sum`, the prereg says mean. Immaterial
   (predictors are z-scored; sum and mean are a linear rescaling) but the analysis code
   uses **mean** per the prereg, and states so.

### 1.5 The `_participant_master.csv` is not usable as an analysis table

It is retained for provenance only. Three independent problems:

1. **Cross-study contamination.** Profile-strategy tables have no `study_id`, so the master
   carries columns from unrelated studies for participants who were in more than one —
   `phq4_*`, `maia2_*`, `barqr_*`, `farm_joy_*`, `stillwater_*`, `word_max_*` all appear.
   (This is the known limitation documented in `website.md` §28a.)
2. **Occurrence suffixes are not aligned across participants.** The `_t<n>` suffix counts a
   slug's administrations *in that participant's own history*, not its position in this
   session. A participant who took APS-R in an earlier study has this study's APS-R landing
   in `apsr_t2`/`apsr_t3`/`apsr_t4` (all four exist in the file) while another's is `apsr_t1`.
   Column-wise pooling would silently mix administrations.
3. **No ColourMax per-image data** — the master has no path to the `results` jsonb.

**Decision**: the analysis dataset is built from the long tables with explicit study and
session scoping, ordering repeated measures by `completed_at`/`responded_at` *within the
study session window*, never by the master's `_t<n>` columns.

### 1.6 Data-quality observations (marginal only — no hypothesis-relevant associations)

- **ColourMax zeros are structural, not noise.** 9/20 participants (45%) left ≥1 image with
  zero dwell time; 13/20 (65%) left ≥1 image with zero coverage. This vindicates prereg
  decision **D7** (entropy-based concentration index as the primary H1C test, which is
  defined at zero without imputation) and makes the Dirichlet secondary analysis genuinely
  dependent on the `multRepl` detection-limit choice.
- **The H1C concentration index is well behaved**: mean 0.255, SD 0.167, range 0.015–0.577,
  skew +0.25. Approximately symmetric; the prereg §5.2 transformation rule (|skew| > 2)
  will not trigger.
- ⚠ **Word Probe has a severe floor.** Across the cohort, `wordprobe_pct` had median 0,
  mean 8.6, 75th percentile 16.3 (vs. anagram mean 52.1, fluency mean 57.1). Most
  participants scored zero on the Wordle-style task. See §Open issues — this materially
  affects H2C, whose DV is the within-person SD of the three subtask percentiles
  (observed mean SD = 36.4 on a 0–100 scale, largely manufactured by one floored task
  rather than by differential effort allocation).
- **Session length is ~30 minutes, not 45–60.** Summed step durations: median 30.0 min,
  mean 31.7, IQR 28.0–35.0. Longest steps: Aptitude Suite 8.8 min, ColourMax 5.3 min,
  questionnaire battery ~11.5 min total. The prereg's stated duration and the Prolific
  pay rate should be revised.
- ColourMax session integrity: 20/20 have non-null `results`, `session_end`, and `avg_pct`.
  (Across the full export 7/52 sessions lacked `game_end`; all were dev sessions.)

### 1.7 Open issues raised for discussion

Carried to the message accompanying this step; recorded here so the log is self-contained.

| # | Issue | Bearing |
|---|---|---|
| I1 | Word Probe floor effect contaminates the H2C variance DV | Prereg §5.1 H2C; possibly task calibration before launch |
| I2 | Session ~30 min vs. 45–60 min stated | Prereg §2/§3 and participant payment |
| I3 | BAT-Student 33 items vs. 23 stated | Prereg §4 measures table |
| I4 | Sliders sourced from `questionnaire_responses`, not `vas_responses` | Prereg §4 wording |
| I5 | H1C DV requires event-log reconstruction; no stored field | Prereg §4 indices + analysis code |
| I6 | Analysis repo location (blocked from creating `F:\gits\sandy_study3`) | Step 6 |
| I7 | ColourMax rows lack `study_id` | Platform fix, not analysis-blocking |

---

## Step 2 — Merge plan (pending)

## Step 3 — Nuisance-parameter extraction (pending)

## Step 4 — Simulation design (pending)

## Step 5 — Power analysis and prereg integration (pending)

## Step 6 — Reproducible repository (pending)
