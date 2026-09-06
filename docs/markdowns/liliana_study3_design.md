# Liliana Study 3 — Live Test: Reproducible Design Specification

> Compiled 2026-08-19 from the live study record (`studies.bf080651-7967-48f6-ae7e-10d25ff123d4`),
> its `design_graph`, the session templates and instrument definitions in the production database,
> and the participant-facing implementation in `src/`.
> Companion documents: `docs/markdowns/liliana_feedback_spec.md` (midpoint mechanics, WP-L1…L6),
> `website.md` (platform architecture).
>
> **Status at time of writing: authored, dry-run complete, not yet recruiting.** Two non-test
> enrollments exist in total (one withdrawn 2026-07-16, one enrolled 2026-08-19). All power
> calculations are therefore prospective and unconstrained by collected data.
>
> Two important status caveats. First, **the study running today is `Liliana Study 3 — Live Test`,
> a `duplicate_study` clone of the dry-run graph** made 2026-07-15 so live testing wouldn't disturb
> the dry run's participant history; "author the real study (duplicate the proven dry-run graph)"
> is still an open pre-pretest item. Second, **`MidpointStep.jsx`'s participant-facing copy is
> still awaiting Liliana's sign-off** — the ranking and assignment screens implement her preview
> HTMLs verbatim, but the feedback-screen and control-display copy are placeholders. Timeline:
> pretest August 2026, recruit September 2026.

---

## 1. One-paragraph summary

A 31-day, fully online, longitudinal emotion-regulation study in an undergraduate sample.
Every participant first samples **all three** brief daily practices — Non-reactivity, Reappraisal,
Self-Compassion — for four days each in counterbalanced order (Phase 1, 12 sessions). At a midpoint
assessment they are randomized to one of three **midpoint groups** that cross *receiving personalized
feedback about how each practice worked for them* with *getting to choose their Phase 2 practice*.
They then do a single practice for twelve more days (Phase 2) and complete a final assessment.
Each daily session is bracketed by pre/post ratings, so the study yields a within-person estimate of
each practice's immediate stress relief — which is also the quantity fed back to the feedback group.

**The design isolates two effects by construction:**

| Contrast | Groups compared | Isolates |
|---|---|---|
| Feedback effect | `feedback_choice` vs `control_choice` | Seeing your own outcome data, holding choice constant |
| Choice effect | `control_choice` vs `control_assigned` | Having agency, holding display constant |

The two non-feedback groups see the *same* control display, and **all three groups supply a full
preference ranking**, so preference-vs-received analyses are available in every cell.

---

## 2. Registration identifiers

| Field | Value |
|---|---|
| Study name | `Liliana Study 3 — Live Test` |
| Study id | `bf080651-7967-48f6-ae7e-10d25ff123d4` |
| Delivery mode | `online_longitudinal` |
| Design version | 2 |
| Randomization seed | `liliana-dryrun-1` |
| Screener id | `0a8b1e9e-1e3e-4943-82bc-c3f8a8791a72` (`emotion-regulation-screener-v1`) |
| Enrollment | External, `sona`, rolling |
| Consent / debrief | Required; forms `5ff9b7f1…` / `23a35fde…` |
| Recruitment site | University of Toronto Mississauga (UTM), PSY100/201/202 participant pool |

---

## 3. Eligibility and screening

A two-phase pre-consent screener. Failing either phase stops enrollment and displays mental-health
resources (UTM Health & Counselling, Good2Talk 1-866-925-5454, Distress Centres of Greater Toronto,
Crisis Services Canada).

### Phase 1 — eligibility checklist (all six must be "Yes")

1. Can fluently read and write in English.
2. Normal or corrected-to-normal vision.
3. Experiences some level of emotional distress.
4. **No** current diagnosis, and none in the past year, of a cognitive, mood, or substance use disorder.
5. Daily access to email and an internet-connected web browser.
6. Willing to complete ~4 min/day of online intervention and reporting over 31 days.

### Phase 2 — distress banding (GAD-7 and PHQ-8)

Both administered in full. Bands:

| Instrument | None/mild | Moderate | Severe |
|---|---|---|---|
| GAD-7 (7 items, 0–3, sum) | 0–9 | 10–14 | 15–21 |
| PHQ-8 (8 items, 0–3, sum) | 0–9 | 10–19 | 20–24 |

**Pass requires both:** neither score is severe, **and** at least one score is moderate or above.

The eligible window is therefore `max(GAD-7, PHQ-8) ≥ 10` **and** `GAD-7 ≤ 14` **and** `PHQ-8 ≤ 19`.
Fails are separated into `fail_low` (coping well) and `fail_high` (needs more support than a study
can provide) with distinct, non-punitive copy.

> **The screener is the baseline administration of GAD-7 and PHQ-8, by design.** It runs
> immediately before the baseline battery as one continuous Day-1 session, and screener data is
> retained only once consent is given. Both instruments ask about the preceding two weeks, so
> re-administering them minutes later in the same sitting was deliberately rejected — it would
> measure test–retest noise, not change. The export labels this administration `screener` rather
> than `baseline` because it is collected outside the scheduled-session system; that is a
> data-plumbing distinction, not a substantive one, and **analysis should treat it as baseline.**
>
> **Analysis note.** This is nonetheless a restricted-range sample *selected on* these two
> instruments, so regression to the mean is expected on them under the null. That affects
> single-arm pre-post tests (baseline→midpoint), not between-group contrasts, where it cancels.
> Note that eligibility is a *disjunction* — only one score need reach 10 — so for any given
> participant RTM is expected on the binding score and not the other, which is a usable internal
> control.

---

## 4. Compensation

Maximum **3 hours** of PSY100/201/202 course credit.

| Component | Credit |
|---|---|
| Baseline assessment | ~30 min |
| Midpoint assessment | ~20 min |
| Final assessment | ~25 min |
| 24 daily sessions × ~4 min | ~1.75 h |
| **Total** | **~3 h** |

Prorating rule: to receive full credit for a phase, complete **≥10 of that phase's 12** daily
sessions. Below that, credit is awarded for sessions actually completed, **rounded up to the nearest
half hour**. Early withdrawal is credited for the portion completed, same rounding.

Implemented as a read-only worksheet with manual award at `/admin/studies/:id/liliana-credit`
(`src/pages/admin/LilianaCreditPage.jsx`, RPC `get_liliana_credit_report`).

---

## 5. Calendar

**24 training days + 3 assessments. Nominal length 31 days, but the real length is 29–31 and
varies per participant** (see gate-relative scheduling below). All sends at **06:00
America/Toronto**. `reminders_enabled = true`, `reminder_interval_hours = 12`,
`reminder_max = 2`, `max_attempts = 4`.

| Nominal day | Event | `day_offset` | Link lifetime |
|---|---|---|---|
| 1 | Screener → consent → Baseline assessment | 0 | 24 h |
| 2–13 | **Phase 1** — 12 daily sessions | 1 | 24 h each |
| 14–16 | Midpoint assessment (3-day window) | 13 | 72 h |
| 17–28 | **Phase 2** — 12 daily sessions | 16 | 24 h each |
| 29–31 | Final assessment (3-day window) | 28 | 72 h |

### Gate-relative scheduling — the calendar is not fixed

The two 3-day assessment windows are **catch windows, not waiting periods**. A segment behind a
gating assessment starts **the day after that assessment is actually completed**, and every
downstream timepoint shifts by the same offset.

- Midpoint completed on **day 14** → Phase 2 runs days 15–26, final window 27–29: a **29-day** study.
- Midpoint completed on **day 16** → the nominal day-17 calendar, **31 days**.

Implemented as `materializeSchedule`'s `dayShift`; `day_offset` is the graph's *nominal* calendar,
not the participant's. Rows already materialized are never moved — each timepoint re-derives its
shift from the `scheduled_date` its own first session was created with. Eight calendar cases are
pinned in `supabase/functions/_shared/materializeSchedule.test.mjs`.

> **Analysis note.** `participant_schedule.study_day` is the participant's real study day and is
> what participant-facing emails show; admin panels label rows from `study_sessions.day_number`
> (the nominal day). **Use `participant_schedule.study_day` for any day-indexed analysis** — the
> two diverge for every participant who completes the midpoint before day 16. Elapsed time from
> baseline to final is therefore a variable, not a constant, and is a candidate covariate.

### Reminders

Dailies get one same-evening nudge (12 h) before the 24 h link expires; the two 72 h assessment
windows get one reminder per remaining day. Reminders never re-send an expired link. Worked
midpoint sequence: `06:00 d14 send → 18:00 d14 reminder → 06:00 d15 reminder → 18:00 d16 last
chance → 06:00 d17 expiry`.

A **final notice fires 12 h before link expiry** on critical sessions, independent of cadence and
**exempt from `reminder_max` / `max_attempts`**, once only. Which sessions qualify is derived from
graph position (`_shared/criticalSession.ts`); on this study that resolves to exactly
**`s_mid` (gate) and `s_final` (terminal)**.

Missed dailies **skip forward on the original calendar** — the participant is not shifted. A daily
row that is sent/issued, has no active link, and was scheduled before today is marked `missed` by
`check_schedule`.

---

## 6. Session inventory

### 6.1 Baseline (Day 1) — session template `65822f05…`

| # | Instrument | Items | Response scale | Scoring |
|---|---|---|---|---|
| 1 | Liliana Study 3 Demographics | 23 q / 7 sections | mixed | — |
| 2 | Student Stress Scale | 31 | checklist | weighted checklist |
| 3 | BFI-2-S | 30 | 1–5 agree | mean; 15 facets + 5 domains |
| 4 | BIPS | 9 | 1–5 frequency | sum; 3 subscales |
| 5 | VAS — Life Satisfaction | 1 | emoji 1–6 | raw |
| 6 | SPANE | 12 | 1–5 frequency | sum; P, N, B = P − N |
| 7 | PWB | 8 | 1–7 agree | sum |
| 8 | MPoD-t | 15 | 1–7 agree | mean; 3 subscales |
| 9 | ERQ — Cognitive Reappraisal | 6 | 1–7 agree | mean |
| 10 | SRI — Increase Positive | 7 | 1–5 agree | mean (reverse `sri_ip_7`) |
| 11 | SSCS-L | 18 | 1–5 | mean; 6 subscales + total |
| 12 | Introduction video | — | — | 90 % watch-gated |

### 6.2 Midpoint (Days 14–16) — session template `cc839191…`

Lead-in → **BIPS, GAD-7, PHQ-8, SPANE, PWB, VAS-LS, ERQ-CR, MPoD-t, SRI-IP, SSCS-L** →
**Midpoint Feedback & Choice** (§9).

### 6.3 Final (Days 29–31) — session template `3d1a1593…`

Lead-in → **BIPS, GAD-7, PHQ-8, SPANE, PWB, VAS-LS, ERQ-CR, MPoD-t, SRI-IP, SSCS-L** → Debrief form.

> Midpoint and final administer an **identical** ten-instrument battery, so every repeated-measures
> outcome has matched midpoint and final observations. The Day-1 baseline session omits GAD-7 and
> PHQ-8 because the screener immediately preceding it has just administered both (§3), and adds the
> three baseline-only measures: Demographics, Student Stress Scale, BFI-2-S. **All twelve
> instruments therefore have a Day-1 value**, whether collected in the screener or the baseline
> template.

### 6.4 Subscale structure (for outcome definition)

| Instrument | Subscales |
|---|---|
| BIPS | Pushed (1–3), Conflict & Imposition (4–6), Lack of Control (7–9; reverse item 8) |
| SPANE | SPANE-P (6), SPANE-N (6), derived SPANE-B = P − N |
| MPoD-t | Meta-awareness (1–5), (Dis)Identification (6–10), (Non)Reactivity (11–15) |
| SSCS-L | Kindness, Self-judgment (rev), Common Humanity, Isolation (rev), Mindfulness, Over-identification (rev) — 3 items each; derived Total State Self-Compassion |
| BFI-2-S | 15 facets (2 items each) nested in Extraversion, Agreeableness, Conscientiousness, Negative Emotionality, Open-Mindedness (6 items each) |

---

## 7. The daily session

Identical five-slot structure on all 24 intervention days, both phases:

```
Welcome  →  Check-in (pre)  →  Practice module  →  Check-in (post)  →  Farewell
```

### 7.1 Check-in ratings — the core repeated measure

All six items are `emoji_6` scales: a six-button emoji grid, **values 1–6**, no default, forced choice.

| Package | Order | Slug | Question |
|---|---|---|---|
| `liliana_pre_intervention_ratings` | 1 | `sleep` | How would you rate the quality of your sleep last night? |
| | 2 | `stress` | Right now, how stressed are you feeling? |
| `liliana_post_intervention_ratings` | 1 | `stress` | Right now, how stressed are you feeling? |
| | 2 | `helpful` | How helpful did you find today's practice? |
| | 3 | `enjoyment` | How enjoyable did you find today's practice? |
| | 4 | `effort` | How much effort did you put into completing this practice? |

Derived per completed session:

- **`delta_stress` = pre_stress − post_stress** (positive = relief). *Primary process measure.*
- **`appraisal` = mean(enjoyment, helpful)**.
- `effort` — deliberately excluded from any benefit score (valence-ambiguous: engagement vs strain).
  Retained as an engagement check and analysis covariate.
- `sleep` — measured pre-practice; a day-level nuisance covariate, not an outcome.

Every rating is written to `vas_responses` with `schedule_id` and `package_slug`, so
`(user_id, schedule_id, package_slug, scale_id)` uniquely identifies it and the two daily `stress`
readings are disambiguated **by package, not timestamp**. The per-session pivot is the view
`liliana_session_metrics` (one row per participant × study_day, with phase, condition, all six
ratings, `delta_stress`, `appraisal`, `completed`). Condition is linked by (profile, module) via the
schedule's template training node, so it is immune to day-numbering drift.

**On re-entry, the latest response wins** — if a participant reopens a session and re-rates, the
view reports the later value. Raw `vas_responses` retains every submission, so the earlier ratings
remain available if a sensitivity analysis wants them.

**Maximum daily observations per participant: 24 sessions × 6 ratings = 144.**

### 7.2 Practice modules

48 modules total: 3 conditions × (4 Phase 1 + 12 Phase 2). Content is authored per module from a
16-type block vocabulary (`lead_in`, `text`, `video`, `audio`, `prompt_response`, `multi_response`,
`slider`, `timer`, `training_response`, `training_response_multi`, `word_select`, `thought_rating`,
`thought_choice`, `trigger_map`, `body_diagram`, `quality_explorer`, `closing`), with `show_if`
conditional branching. Free-text and structured responses land in `intervention_responses`;
session completion stamps `liliana_day_data.completed_at`.

Media is completion-gated at **90 %** watched/listened, with forward-seek clamping, keyboard-seek
blocking, and tab-blur pausing (focus losses are logged to `participant_video_events` for
pre-analysis exclusion decisions).

| | Non-reactivity | Reappraisal | Self-compassion |
|---|---|---|---|
| **Phase 1, D1** | Breath Sensation | The Science of Stress | What Is Self-Compassion? |
| **D2** | Breath Sensation with Labeling | Recognizing Stress | Noticing the Inner Critic |
| **D3** | Opening Awareness | Stress as Threat vs. Challenge | Compassionate Friend |
| **D4** | Three-Minute Breathing Space | I Am Overwhelmed Because I Care | Self-Compassion Break |
| **Phase 2, D1** | Body Scan | The Power of Mindset | Why is it harder to be compassionate to myself? |
| **D2** | The Five Senses Exercise | What Are Stress Signals? | Tender and Fierce Self-Compassion |
| **D3** | Leaves on Stream | The Stress Trigger Map | Tender Self-Compassion |
| **D4** | See, Hear, Feel Practice | My Early Warning Signals | Fierce Self-Compassion |
| **D5** | Mountain Meditation | Thought Record | Mindfulness as a Foundation |
| **D6** | Lighthouse Meditation | Addressing Cognitive Distortions | Working with Difficult Emotions |
| **D7** | Sensory Detective | Is the World Really Ending? | RAIN Meditation |
| **D8** | Become a Sensory Scientist! | The Cup is Half Full | Giving and Receiving Compassion |
| **D9** | Mindfulness of an Object | I Care, Therefore I Can | Lovingkindness Meditation |
| **D10** | Guided Body Scan | Is Every Battle Worth Fighting? | Self-Compassion for Stress and Burnout |
| **D11** | Pause Before Reacting | Ready for Next Time | Make a Commitment to Yourself |
| **D12** | Graduation Day! | Graduation Day! | Graduation Day! |

Dosage is not perfectly matched across arms: written-reflection density differs (Reappraisal Phase 2
has written reflection in 10 of 12 modules; Non-reactivity in 3 of 12, being more audio/video
guided-practice). **This is a known asymmetry and a candidate covariate or limitation.**

---

## 8. Phase 1 — within-subjects sampling of all three practices

Days 2–13. Three four-day blocks, one per practice. **Block order is counterbalanced across
participants using all 3! = 6 permutations**, drawn as a permuted-block cycle **at enrollment**
(`participant_assignments.kind = 'counterbalance'`, node `cb_p1`). Within a block the four days run
in fixed lesson order.

All six orders are confirmed in use in the live study record.

This yields, per participant, **four `delta_stress` observations per practice** — the input to the
midpoint ranking.

---

## 9. The midpoint manipulation

### 9.1 Group assignment

At the moment the midpoint step mounts, `draw_assignment(study_id, 'midpoint_group')` performs a
balanced permuted-block draw over three arms:

| Group | Display shown | Phase 2 practice determined by |
|---|---|---|
| `feedback_choice` | Personalized ranked summary of their own Phase 1 data | Participant's free choice |
| `control_choice` | Control display (attention-matched, no personal data) | Participant's free choice |
| `control_assigned` | Control display (identical to above) | Server-assigned, 50/50 between the **two non-preferred** practices — **never** their rank-1 |

Weights are equal (1:1:1).

### 9.2 Sequence per group

All three groups complete the identical ten-instrument questionnaire battery first, then:

```
feedback_choice :  owl intro → ranked feedback cards → preference ranking → free choice → confirmation
control_choice  :  control display                   → preference ranking → free choice → confirmation
control_assigned:  control display                   → preference ranking → anti-preference reveal
```

The feedback group ranks **after** seeing feedback, by design — feedback is permitted to influence
the stated ranking.

### 9.3 Preference ranking — captured in all three groups

A tap/drag ordering of all three practices, #1 to #3. Position implies rank, so it is always
complete. `stated_preference` = rank #1. The full ordering is stored as `preference_ranking`.

For choosers, the selection is recorded independently of the ranking — a participant may rank
Reappraisal #1 and still choose Self-Compassion (verified in dry-run testing). This gives a
**preference–choice concordance** measure in both choice groups.

### 9.4 The quality metric fed back

**Primary is `metric_version = 2`: rank practices by mean `delta_stress` alone**, over that
participant's completed Phase 1 sessions. This was pre-specified in Liliana's methods document
(§4.3: "average within-session improvement in perceived stress … mean of the daily pre- to
post-session difference scores") and made primary by `20260710_metric_v2_primary.sql`.

Also computed and stored, for exploratory use only, never displayed:

- **v1 composite** = `( z(delta_stress) + z(appraisal) ) / 2`, z-scored **within-person** across
  that participant's completed Phase 1 sessions.

Deterministic tie-breaks: mean Δstress → mean helpful → seeded hash of (participant id, condition).

Missing data: sessions with `completed_at IS NULL` are excluded. Ranking requires **≥2 completed
sessions per practice**; below that the practice is flagged `low_n` and the card reads
"· limited data" — but a definitive ranking is still produced, because the manipulation requires one.

### 9.5 What the feedback group actually sees

One card per practice in rank order: rank badge, condition owl image,
`Stress ↓ X.X after practice` (mean Δstress, one decimal),
`Enjoyment & helpfulness: X.X / 6` (mean appraisal), `based on N sessions`, and a
"your strongest" tag on rank 1. **No z-scores, no statistics language, no p-values.**

### 9.6 The snapshot — counterfactual for free

`get_liliana_midpoint_summary()` computes and stores the full per-practice summary and ranking for
**all three groups**, and is only *displayed* to `feedback_choice`. `shown_at` is stamped when the
cards first render.

This means the objectively best-performing practice is known for every participant in every group,
enabling the central mediating analysis: *did the feedback group choose their data-ranked #1 more
often than controls, and does choosing one's data-ranked #1 predict Phase 2 outcomes regardless of
group?*

Everything lands in `liliana_midpoint_feedback`, one row per participant:
`midpoint_group, metric_version, computed (per-practice n / mean_delta_stress / mean_appraisal /
composite_v1 / composite_v2 / low_n), ranking, shown_at, preference_ranking, stated_preference,
phase2_practice, phase2_source ∈ {choice, anti_preference}, decided_at`.

### 9.7 The anti-preference rule

For `control_assigned`, the server records the stated ranking, then assigns a seeded 50/50 pick
among the **two non-rank-1 practices**. The invariant `never_preferred = true` is enforced
server-side and was verified across 12 simulated participants (6/6 split). Framed to the participant
as "Sometimes it's good to step outside your comfort zone!" — IRB-sensitive copy, paired with
matching debrief text.

> This is a genuine confound-free choice manipulation but it is **not** a pure agency manipulation:
> `control_assigned` participants systematically receive a *non-preferred* practice, whereas
> `control_choice` participants usually receive a preferred one. Any `control_choice` vs
> `control_assigned` difference conflates agency with preference-match. The preference ranking
> captured in all three groups is what makes this separable at analysis time — e.g. by comparing
> only participants who received a non-rank-1 practice across groups.

---

## 10. Phase 2

Days 17–28. Twelve daily sessions of the single practice determined at midpoint, same five-slot
session structure and same six check-in ratings. The materializer routes participants down their
arm by reading `participant_assignments` for node `rnd_p2`; a pre-written `choice` or
`anti_preference` row routes them with no special-casing, and only `control_assigned` consumes a
balanced random draw.

Phase 2 arm distribution is therefore **not** balanced by design — two-thirds of participants
self-select. Expect unequal and non-random cell sizes across the three practices in Phase 2, with
selection driven by Phase 1 experience.

---

## 11. Adherence, attrition, and withdrawal

| Gate | Rule | On failure |
|---|---|---|
| Phase 1 adherence (`ac_p1`) | ≥10 of 12 completed | **Withdraw** — enrollment status set, active link revoked, termination email sent; Phase 2 never materializes |
| Midpoint completion | Must complete within the 72 h window | **Formal withdrawal** (`missed_assessment`) + termination email; Phase 1 data retained |
| Phase 2 adherence (`ac_p2`) | ≥10 of 12 completed | **Continue** — analysis criterion only |

**What counts as a "daily session":** completed `liliana_day_data` rows joined to
`intervention_modules` by phase (`countCompletedPhaseDays()`). The midpoint and final assessments
are **excluded** from the count. This matters — when the count mistakenly included all completed
sessions, three participants were wrongly passed at 11/9 and 10/9 ×2, because every participant
carries 1–2 completed non-daily rows.

**Phase 1 still gates, deliberately.** It decides who enters Phase 2 at all, and the three-arm
midpoint draw balancing among people who actually did the Phase 1 practices is what the manipulation
rests on.

**Phase 2 stopped gating on 2026-08-11** (`20260811_adherence_on_fail.sql`): everyone reaching
Phase 2 receives the final assessment unless they withdraw or unsubscribe. The 10-of-12 threshold is
unchanged but is now a **classification, not an ending**, expressly so that intention-to-treat
analysis is possible alongside per-protocol. The classification lives in the derived view
`liliana_phase_adherence` (`completed_sessions`, `min_required`, `meets_criterion`, `on_fail`,
`enrollment_status`) — deliberately a view, so it recounts and can never disagree with the runtime
number.

**A lapsed-participant tier exists** (2026-08-07): after 4 consecutive acknowledged misses, the
participant is offered formal withdrawal at `/withdraw/{token}`. It acts only on explicit click,
carries no deadline or consequence, and emails continue if ignored. Withdrawal is never gated on
supplying a reason.

**Implication for the analysis plan.** ITT and per-protocol samples differ **only at Phase 2**.
Phase-1 non-adherers and midpoint non-completers are removed *before* the midpoint group is drawn,
so they never enter the manipulation at all — that attrition belongs above the randomization box in
a CONSORT flow, not beside it. Randomization balance holds only among those who reach the midpoint.

---

## 12. Assignment mechanics summary

| Node | Kind | Levels | Drawn when | Mechanism |
|---|---|---|---|---|
| `cb_p1` | counterbalance | 6 block orders | Enrollment | Permuted-block cycle |
| `midpoint_group` | randomize (slot) | `feedback_choice`, `control_choice`, `control_assigned` | Midpoint step mount | Balanced permuted-block, equal weights |
| `rnd_p2` | randomize / choice / anti_preference | `non_reactivity`, `reappraisal`, `self_compassion` | Midpoint decision | Free choice (2 groups) or seeded anti-preference (1 group) |

Draws are reproducible from `design_seed = liliana-dryrun-1` plus node and cycle number; each cycle
reshuffles from `seed + node_id + cycle_number` (permuted-block randomization — an RA cannot predict
the next arm). `draw_index` counts only drawn rows, so `choice` and `anti_preference` decision rows
at the `rnd_p2` fork never perturb the balanced cycle. Next index is
`COALESCE(MAX(draw_index), -1) + 1`, not `COUNT(*)`, so gaps are safe.

**Because `midpoint_group` resolves at the midpoint rather than at enrollment, balance holds among
participants who actually reach the midpoint** — not among those enrolled. This is deliberate, and
it is why Phase 1 adherence still gates.

---

## 13. Where the data lives

| Table / view | Contents |
|---|---|
| `study_enrollments` | One row per participant; `is_test`, `status`, `consent_date`, `withdrawal_reason` |
| `participant_schedule` | One row per scheduled session; `study_day`, `status`, `completed_at` |
| `participant_assignments` | Every draw/choice; `node_id`, `kind`, `value`, `draw_index` |
| `liliana_demographics` | 23-question battery, one jsonb blob |
| `screener_results` | GAD-7 / PHQ-8 intake scores and banding |
| `questionnaire_responses` | All assessment instruments; `schedule_id`-linked |
| `vas_responses` | All check-in ratings; `schedule_id` + `package_slug` |
| `liliana_day_data` | One row per participant × study_day; `module_id`, `completed_at` |
| `intervention_responses` | Within-module free text and structured answers |
| `liliana_midpoint_feedback` | The midpoint snapshot — group, metric, ranking, preference, decision |
| `liliana_session_metrics` (view) | Per-session pivot with `delta_stress`, `appraisal` |
| `liliana_phase_adherence` (view) | Per-phase completed-day counts vs threshold |
| `participant_step_timings` | Per-step durations |
| `participant_video_events` | Focus losses for exclusion decisions |

### Export

`src/lib/studyExport.js` produces per-table CSVs plus `_participant_master.csv` (one row per
enrollment) and a codebook. Column naming is **derived from recorded facts, never occurrence order**:

- `ldem_<key>` — demographics; `eq_<key>` — equity census; `dem_<col>` — legacy 4-item
- `<instrument>_<timepoint>_<item>` where timepoint ∈ `screener | baseline | midpoint | final`,
  resolved from `schedule_id` where recorded and from the study design otherwise; unresolvable
  occurrences fall back to `_x<n>` rather than inventing a label
- `vas_<slug>_<pre|post>_d<day>` — day number from the schedule, not from arrival order
- `<table>_n` — participation counts

---

## 14. Design factors, for the analysis plan

**Between-subjects**

| Factor | Levels | Randomized? |
|---|---|---|
| `midpoint_group` | 3 | Yes — balanced, equal weight |
| Phase 2 practice | 3 | Only for `control_assigned`; self-selected otherwise |
| Phase 1 block order | 6 | Yes — counterbalanced |

**Within-subjects**

| Factor | Levels |
|---|---|
| Phase | 2 (Phase 1, Phase 2) |
| Practice (Phase 1 only) | 3 (all participants experience all three) |
| Day | 12 per phase |
| Pre/post | 2 (within each daily session) |

**Candidate outcome families**

1. *Momentary / process*: `delta_stress` per session (24 per completer); also `helpful`,
   `enjoyment`, `effort`, `sleep`.
2. *Wellbeing & symptoms*: BIPS, GAD-7, PHQ-8, SPANE (P, N, B), PWB, VAS-LS —
   at midpoint and final, with baseline for all but GAD-7/PHQ-8.
3. *Mechanism / skill*: MPoD-t (3 subscales), ERQ-CR, SRI-IP, SSCS-L (6 subscales + total) —
   baseline, midpoint, final.
4. *Decision behaviour*: preference ranking, choice, concordance between choice and data-ranked #1,
   concordance between stated preference and data-ranked #1.
5. *Engagement / adherence*: sessions completed per phase, effort ratings, video focus losses,
   step timings.

**Baseline-only covariates**: full demographics (23 items), Student Stress Scale, BFI-2-S
(5 domains / 15 facets), plus screener GAD-7 and PHQ-8.

**Natural clustering for mixed models**: sessions nested in phase nested in participant; Phase 1
additionally nested in practice-block. Day and pre/post are within-session; `sleep` is a day-level
covariate.

---

## 15. Known caveats and open items

1. **Restricted range on GAD-7/PHQ-8** by screening design. Their Day-1 values come from the
   screener that runs immediately before the baseline battery (deliberate — see §3), so they are
   genuine baseline data; but the sample is *selected* on them, so regression to the mean is
   expected under the null in any single-arm pre-post test. Between-group contrasts are unaffected.
2. **Phase 2 arm sizes will be unbalanced and non-random** — two-thirds of participants self-select
   their practice.
3. **Agency and preference-match are confounded** in the `control_choice` vs `control_assigned`
   contrast (§9.7). Mitigated, not eliminated, by ranking all three groups.
4. **Intervention dosage is not matched across arms** — written-reflection density differs markedly
   between conditions in Phase 2 (§7.2).
5. **The full demographics battery became the live baseline instrument on 2026-08-19**
   (`20260819_liliana_baseline_demographics_swap.sql`). Anything collected before that date carries
   only the legacy four items (age, gender, racialized, SES ladder), and **this cannot be collected
   retroactively** — four items is the hard ceiling on existing participants' demographic data.
5b. **Study duration is a per-participant variable (29–31 days)**, set by when each person completes
   the midpoint (§5). Time-in-study is therefore correlated with midpoint promptness, which is
   plausibly correlated with engagement — treat it as a covariate, not a constant.
6. **Metric version is frozen at v2** (mean Δstress). WP-L6 anticipated a pilot bake-off of v1 vs v2
   (Kendall τ rank agreement, leave-one-session-out rank stability, pre-stress floor effects); this
   has not been run, because there is no pilot data.
7. **Floor/ceiling risk on `delta_stress`**: `stress` is a 6-point scale, so pre-stress of 1 makes
   relief unobservable. Pre-stress distribution should be checked before treating Δstress as
   continuous and unbounded.
8. **No pure no-treatment or waitlist control.** Every participant receives active intervention in
   both phases; between-arm comparisons are intervention-vs-intervention, and pre-post change
   confounds treatment with time, repeated assessment, and regression to the mean.

---

## 16. Reproduction checklist

To rebuild this study from scratch on the platform:

1. Create the screener (`emotion-regulation-screener-v1`): 6-item yes/all checklist, then GAD-7 +
   PHQ-8 with the banding in §3.
2. Create the 11 questionnaire definitions (§6.1, §6.4) and the 8 `emoji_6` VAS scales.
3. Create the two VAS packages with exactly the contents and order in §7.1.
4. Author 48 intervention modules (§7.2), 16 per condition.
5. Build 48 daily session templates in the canonical three-step shape
   `pre package → training module → post package`, wrapped by `daily_welcome` / `daily_farewell`.
6. Build the three assessment templates (§6.1–6.3).
7. Build the `design_graph`: baseline → counterbalance(3 blocks × 4 days) → Phase 1 adherence check
   (10/12, `withdraw`) → midpoint → randomize(3 arms) → Phase 2 blocks (12 days) → Phase 2 adherence
   check (10/12, `continue`) → final. Timepoint offsets 0 / 1 / 13 / 16 / 28.
8. Set `assignment_slots = {"midpoint_group": ["feedback_choice","control_choice","control_assigned"]}`
   and a `design_seed`.
9. Set contact policy: 06:00 sends, 24 h daily links, 72 h assessment links,
   `reminder_interval_hours 12`, `max_attempts 4`.
10. Link consent and debrief forms; enable external SONA enrollment.
