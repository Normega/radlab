# Liliana Study — Session Quality Scoring & Midpoint Feedback Spec

> Drafted 2026-07-08. Companion to website.md §26 (Training Modules) and §28 (Experiment Builder).
> Status: **planned, not implemented**. Work packages WP-L1 … WP-L6 below.

## 1. Design summary

Every intervention session (all 31 days — Phase 1 **and** Phase 2) is bracketed by daily check-ins.

**Canonical source (confirmed by Norm 2026-07-08): the two VAS packages that already exist in
`vas_packages`.** The check-in (pre) is the contents of `liliana_pre_intervention_ratings`; the
check-in (post) is the contents of `liliana_post_intervention_ratings`. Verified against the live DB:

| Package | Order | Scale slug | Question |
|---|---|---|---|
| `liliana_pre_intervention_ratings` | 1 | `sleep` | How would you rate the quality of your sleep last night? |
| | 2 | `stress` | Right now, how stressed are you feeling? |
| `liliana_post_intervention_ratings` | 1 | `stress` | Right now, how stressed are you feeling? |
| | 2 | `helpful` | How helpful did you find today's practice? |
| | 3 | `enjoyment` | How enjoyable did you find today's practice? |
| | 4 | `effort` | How much effort did you put into completing this practice? |

All are `emoji_6` scales (values 1–6). Delivered around the training step:
`vas_pkg_liliana_pre_intervention_ratings → training module → vas_pkg_liliana_post_intervention_ratings`.
Package contents/order in the DB are authoritative; any future item edit happens in the package, and the
scoring view keys on scale slug (not position), so reordering is harmless.

**Superseded placeholder — do not confuse with the above**: the "Check-in (pre)" / "Check-in (post)" cards
shown at `/admin/training` come from `src/components/study/wrapperElements.js` (`CHECKIN_ITEMS`: valence,
energy, stress sliders), rendered only by `TrainingLibrary` / `WrapperElementPage` as an admin demo. They
are explicitly marked as placeholders in that file, are mounted in no participant runtime path, and save
no data. They are **outdated** relative to the packages above; WP-L2 aligns or retires them so the admin
preview matches what participants actually get.

At the **midpoint assessment** (after 12 Phase 1 sessions: 3 practices × 4 days, counterbalanced),
participants are drawn into one of **three midpoint groups**:

| Group | Display | Phase 2 practice determined by |
|---|---|---|
| `feedback_choice` (Choice with Feedback) | Personal data summary (ranked practices) | Participant's free choice, immediately after the feedback screen |
| `control_choice` (Choice) | Control display (no personal data) | Participant's free choice, immediately after the control display |
| `control_assigned` (No-Choice) | Control display (no personal data) | Participant **states a preference**, then is assigned to one of the two **non-preferred** practices with equal probability — **never** the preferred one. The owl frames it: growth often occurs outside the comfort zone \o/ |

(Group mechanics finalized by Norm 2026-07-09, replacing the earlier balanced-owl-draw design for the
No-Choice arm.) This isolates the feedback effect (`feedback_choice` vs `control_choice`) and the
choice effect (`control_choice` vs `control_assigned`). The two non-feedback groups see the **same**
control display, and the **stated preference is recorded for all three groups** (choosers' selection
doubles as their preference) — enabling the preference-vs-assignment analyses. The anti-preference
pick is deterministic (seeded from study seed + node + participant) and happens server-side.

**Snapshot for everyone**: the quality summary and ranking are computed and stored for *all three groups*
at midpoint (only *shown* to `feedback_choice`). This gives the counterfactual for free — e.g., did
feedback-group participants pick their top-ranked practice more often than controls?

## 2. Quality metric

**Principle: store ingredients, compute the score.** Raw ratings linked to day + condition are the durable
data; the score lives in SQL with an explicit `metric_version`, swappable during piloting with no migration.

Per completed session:
- `delta_stress` = pre_stress − post_stress (positive = relief)
- `appraisal` = mean(enjoyment, helpful)

**Metric v1 (primary)**: `quality = ( z(delta_stress) + z(appraisal) ) / 2`, z-scored **within-person**
across that participant's completed Phase 1 sessions. Practices ranked by mean quality over their 4 days.

**Metric v2 (comparison)**: rank by mean `delta_stress` alone.

Deliberate exclusions from the benefit score:
- **Effort** — valence-ambiguous (engagement vs strain). Kept as engagement check + analysis covariate.
- **Sleep** — measured pre-practice; day-level nuisance covariate for the lab's mixed models, not the score.

Not doing per-participant PCA: 12 obs × 4 items is unstable, sign-indeterminate, non-comparable across
people, and unexplainable to participants. If data-driven weights are wanted after the pilot, a pooled PCA
on within-person-centered pilot data yields fixed weights = just another `metric_version` (v3).

Deterministic tie-breaks: v1 composite → mean delta_stress → mean helpful → seeded hash
(`hashint8` of participant id + condition), recorded in the snapshot.

Missing data: abandoned sessions (`liliana_day_data.completed_at IS NULL`) excluded. Ranking requires
≥ 2 completed sessions per practice; below that the snapshot flags `low_n` per practice (still ranks —
the manipulation requires a definitive ranking — but the flag is available to copy and analysis).

## 3. Work packages

### WP-L1 — VAS ↔ schedule linkage (migration + wiring)

The gap: `VasRenderer` inserts `vas_responses` with `session_id: null` and no schedule link; the `stress`
scale appears twice per session, distinguishable today only by timestamp. `StepDispatcher` already receives
`scheduleId` but does not pass it to VAS steps.

Migration `2026MMDD_vas_schedule_linkage.sql`:
- `vas_responses`: add `schedule_id uuid REFERENCES participant_schedule(id)`, `package_slug text`;
  index `(user_id, schedule_id)`. **Verify RLS**: authenticated own-rows policy per CLAUDE.md
  (check existing policies before assuming).
- `liliana_day_data`: add `module_id text` (condition stamp; belt-and-braces vs the join
  `participant_schedule → study_sessions → session_template_nodes → intervention_modules`).

Code:
- `StepDispatcher` → pass `scheduleId` to `VasStepWrapper`.
- `VasStepWrapper` → pass `scheduleId` + package slug to `VasRenderer` (single-scale steps pass the scale
  slug as its own context; the daily check-ins always run as packages).
- `VasRenderer` insert gains `schedule_id`, `package_slug`.
- `TrainingStepWrapper`: include `module_id` in the `liliana_day_data` insert; backfill on re-entry rows
  where null.

Uniqueness after this: `(user_id, schedule_id, package_slug, scale_id)` identifies every rating;
pre-vs-post stress disambiguated by package.

Checkable: backend + invisible wiring; verify via a dry-run session then SQL row check.

### WP-L2 — Daily check-in packages + template convention

- Packages **already exist** (`liliana_pre_intervention_ratings`, `liliana_post_intervention_ratings` —
  see §1). No creation needed; verify contents/order against §1 at implementation time and treat the
  packages as the single source of truth.
- Convention for **all** training session templates, Phase 1 and Phase 2:
  `vas_pkg_liliana_pre_intervention_ratings → training step → vas_pkg_liliana_post_intervention_ratings`.
  Applied during study authoring (existing P0 roadmap item). Build + click-test one template now.
- Align the `/admin/training` wrapper demo with reality: replace `wrapperElements.js`'s placeholder
  `CHECKIN_ITEMS` (valence/energy/stress sliders) — ideally the Check-in cards render a preview fetched
  from the two packages so there is no second copy of the items to drift; at minimum, update the demo
  content and its "pre and post share the same items" comment (no longer true) and point to the packages.

Checkable: run one training session end-to-end; six `vas_responses` rows land with `schedule_id` set.
`/admin/training` Check-in demo cards show the real package items.

**Status — implemented 2026-07-09.**
- Discovery during implementation: 11 Liliana daily-training session templates already existed
  (P1 D1 ×3 conditions, P1 D2–4 NR, P2 D1 ×3 conditions, P2 D2–4 NR), carrying the check-ins as
  **six individual single-scale VAS steps** — which would have defeated WP-L1's pre/post stress
  disambiguation (single-scale steps write `package_slug = null`, so the two stress responses per
  session would be indistinguishable). All 11 converted in one SQL transaction to the canonical
  3-step shape `Check-in (pre) [pre package] → training module → Check-in (post) [post package]`;
  verified by re-query. The remaining ~23 daily templates must be authored with the same shape
  (SessionBuilder: add the two packages from the activity picker around the training step).
- `/admin/training` wrapper demo aligned: `wrapperElements.js` check-in elements now reference the
  package slugs (exported as `PRE_/POST_CHECKIN_PACKAGE_SLUG`); `WrapperElementPage` fetches the
  live package + scales and renders them through the real participant-facing `VasRenderer`
  (previewMode, full-bleed — exactly what the session runner delivers, no second copy to drift).
  Placeholder `CHECKIN_ITEMS` (valence/energy/stress sliders) deleted; TrainingLibrary footnote
  updated to point at /admin/vas.

### WP-L3 — Metrics view, snapshot table, RPCs (migration)

- **View `liliana_session_metrics`** (`security_invoker`, like `assignment_balance`): one row per
  (participant, study_day). Columns: profile_id, liliana participant id, study_day, phase, condition
  (via `liliana_day_data.module_id → intervention_modules.condition`), pre_sleep, pre_stress, post_stress,
  enjoyment, helpful, effort, delta_stress, appraisal, completed. Also serves the data-export roadmap item.
- **Table `liliana_midpoint_feedback`** — the auditable snapshot (what was shown *is the manipulation*):
  `id, participant_id (FK liliana_participants), profile_id uuid, midpoint_group text, metric_version int,
  computed jsonb (per practice: n, mean_delta_stress, mean_appraisal, composite_v1, composite_v2, low_n),
  ranking jsonb (ordered arms), created_at, shown_at, phase2_practice text,
  phase2_source text CHECK IN ('choice','owl'), decided_at`. UNIQUE(participant_id).
  RLS: participant SELECT own via `profile_id = auth.uid()`; **no** client INSERT/UPDATE (RPC-only).
- **RPC `get_liliana_midpoint_summary(p_mark_shown boolean default false)`** — SECURITY DEFINER,
  participant from `auth.uid()`. Computes per-practice aggregates over completed Phase 1 sessions,
  v1 + v2 composites, ranking with tie-breaks; idempotent snapshot insert; stamps `shown_at` when
  `p_mark_shown` (feedback group render). Returns the snapshot.
- **RPC `record_practice_decision(p_study_id, p_node_id, p_practice, p_source)`** — SECURITY DEFINER.
  Validates: snapshot exists; `p_source='choice'` only allowed for the two choice groups; `p_practice`
  ∈ the fork node's arms in `design_graph`. For choices: idempotent insert into `participant_assignments`
  (`kind='choice'`, `value=to_jsonb(p_practice)`, `draw_index` null). For owl (`p_source='owl'`): the
  assignment row already exists from `draw_assignment`; this call only stamps the snapshot.
  Both paths: update snapshot `phase2_practice/source/decided_at`; stamp
  `liliana_participants.midpoint_completed_at` (participants cannot UPDATE that table directly).
- **Patch `draw_assignment`**: `v_draw_index` count filtered to `kind = 'randomize'` so choice rows at the
  same fork node don't perturb the permuted-block cycle for `control_assigned` draws. Idempotency check
  stays unfiltered (a chooser who calls draw gets their choice back). Consider surfacing `kind` in
  `assignment_balance` / StudyBalancePage so choices and draws are distinguishable in the audit.

Checkable: backend-only; verified by SQL against seeded test data.

**Status — implemented, applied, and fully verified live 2026-07-09**
(migration `20260709_liliana_feedback_backend.sql`). Verification ran the whole pipeline against
synthetic 12-session Phase 1 data (self-compassion engineered best, reappraisal middle,
non-reactivity worst) in a self-cleaning batch:
- View pivots matched hand-computed values exactly (Δstress −0.25 / 1.0 / 3.0; appraisal 2.5 / 4.25 / 5.75).
- `get_liliana_midpoint_summary()` ranked SC > RA > NR (v1 composites 1.18 / −0.06 / −1.12), snapshot
  idempotent, `midpoint_group` backfilled after a later `draw_assignment('midpoint_group')`.
- Choice path: assignment row `kind='choice'`, `draw_index=null`, snapshot + `midpoint_completed_at`
  stamped; a second call attempting a different practice returned the original with `already_decided`.
- Owl path: uses the drawn value (client-passed practice ignored); empty-data participants get a
  graceful all-`low_n` ranking.
- **Patch proven**: with a choice row already at the fork node, the next balanced draw got
  `draw_index = 0` — decisions don't consume cycle positions.
- Two schema fixes caught by live testing, folded into the migration: `participant_assignments.kind`
  CHECK didn't allow `'choice'`; `vas_responses.schedule_id` FK lacked ON DELETE (would have blocked
  the study-delete cascade) — now SET NULL.
- Implementation detail: the view links check-ins to conditions by (profile, module) via the
  schedule's session template training node — immune to day-numbering drift between
  `participant_schedule.study_day` and `liliana_day_data.study_day` (which count different things).

**Amended for the final No-Choice mechanics (2026-07-09, migration
`20260709_liliana_midpoint_choice_rework.sql`, applied + verified live):** snapshot gains
`stated_preference`; `phase2_source` is now `('choice','anti_preference')`;
`participant_assignments.kind` gains `'anti_preference'`; `record_practice_decision(p_practice,
p_source, p_node_id default null)` reworked — the fork node is auto-detected from `design_graph`
(client never reads the graph), the choice path records the selection as both practice and
preference, and the anti-preference path records the stated preference then assigns a seeded 50/50
pick among the non-preferred arms server-side. Verified: `never_preferred = true`, assignment row
`kind='anti_preference'`/`draw_index null` (materializer-routable, doesn't disturb balanced cycles),
decision finality, and a 6/6 pick distribution across 12 simulated participants.

### WP-L4 — Midpoint step component

- New step category `midpoint`: SessionBuilder picker entry + `StepDispatcher` case →
  `src/components/study/MidpointStep.jsx`. Bespoke to Liliana's stack (consistent with the
  intervention_modules freeze — "legacy by appointment").
- Mount flow:
  1. `get_liliana_midpoint_summary()` — compute + snapshot (all groups).
  2. `draw_assignment(study_id, 'midpoint_group')` — 3-arm draw from `studies.assignment_slots`
     (slot lookup precedes graph lookup in the function, so this works on a longitudinal study).
  3. Branch by group:
     - `feedback_choice`: summary screens → choice screen → `record_practice_decision(…, 'choice')` → confirmation.
     - `control_choice`: control display → choice screen → same RPC.
     - `control_assigned`: control display → `draw_assignment(study_id, <fork_node_id>)` → owl
       announcement ("Based on my wisdom, I have placed you on the … path") →
       `record_practice_decision(…, 'owl')`.
- Fork node resolution: auto-detect the unique `randomize` node in `design_graph` whose arms match the
  three condition names; error loudly if ambiguous. (Avoids needing config plumbing on
  `session_template_nodes`.)
- Feedback display: one card per practice — condition owl PNG (`owl_nonreactivity` / `owl_reappraisal` /
  `owl_selfcompassion`), before→after stress arrow with the mean change, enjoyment/helpfulness bars,
  "based on N sessions", rank badges, winner highlighted. InterventionPage design tokens (`#f5f4f0`
  background, `#639922` accent, 640px surface) for continuity with the training experience. Personal,
  concrete, non-statistical copy.
- Control display: same chrome and approximate duration; generic non-evaluative recap (days completed,
  reflective copy), **no per-practice data**. Copy placeholders pending Liliana.
- Re-entry safe: reopening the midpoint link re-fetches the same snapshot, same group, same decision
  (all RPCs idempotent).

Checkable on the live site: full midpoint experience per group via test participants / demo mode.

**Status — implemented 2026-07-09.**
- `src/components/study/MidpointStep.jsx`: new step category `midpoint` (StepDispatcher case,
  SessionBuilder picker group, `activities` row `midpoint/liliana_midpoint`). On mount: draws
  `midpoint_group` via `draw_assignment`, fetches the snapshot, branches:
  - `feedback_choice`: owl intro → ranked feedback cards (stress ↓/↑ per practice, appraisal /6,
    n sessions, #1 highlighted; `shown_at` stamped when the cards first render) → choice cards →
    confirmation (owl_love).
  - `control_choice`: control display (owl_still, no personal data) → choice cards → confirmation.
  - `control_assigned`: control display → preference elicitation ("which would you pick?") →
    server-side anti-preference assignment → reveal screen (owl acknowledges the preference,
    comfort-zone rationale, announces the assigned practice with its card).
  - Re-entry: `decided_at` set → "already set" screen. Sim mode: stub + continue, no DB.
- All copy is placeholder pending Liliana's sign-off (constants at the top of the component).
- `liliana_midpoint` step appended to the existing "Liliana Study 3 - Midpoint" session template
  (order_index 10, after the assessment questionnaires).
- Not yet click-tested end-to-end with a real participant link — that is the WP-L5 three-arm dry run.

### WP-L5 — Study wiring + end-to-end dry run

- Set `studies.assignment_slots = {"midpoint_group": ["feedback_choice","control_choice","control_assigned"]}`
  on Liliana's study (SQL; the StudyFormPage slot UI is hidden for longitudinal studies).
- Design graph: baseline → counterbalance (3 Phase 1 blocks, 4 days each) → midpoint session (contains
  the `midpoint` step) → randomize node with 3 arms → Phase 2 blocks (12 training days each, with daily
  check-in packages).
- Dry run all three midpoint arms with test participants: correct Phase 2 sessions materialize on the
  right days after the midpoint completes (`check_schedule` advance pass); balance holds for owl draws;
  snapshots correct; re-entry idempotent; balance audit page sane.
- Extend DataExportPage: `liliana_session_metrics` + `liliana_midpoint_feedback`.

Checkable: everything — this is the full participant journey rehearsal ahead of the August pretest.

**Status — dry run executed 2026-07-09 (Phase 2 cron advance pending at write time).**
- All 36 missing daily templates generated by SQL from `intervention_modules` (48/48 daily templates
  now exist, all canonical 3-step shape, verified by query).
- Dry-run study **"Liliana Study 3 — DRY RUN (WP-L5)"** (`dddddddd-0000-4000-8000-000000000001`)
  authored programmatically: `design_graph` hand-built and validated with the real
  `experimentGraph.js` (51 session slots; day-number spot checks), `study_sessions` compiled
  1:1, `assignment_slots.midpoint_group` + `design_seed` set. **Calendar assumption to confirm
  with Liliana**: 27 consecutive days — baseline d1, Phase 1 d2–13, midpoint d14, Phase 2 d15–26,
  final d27 (timepoint day_offsets are trivially editable in the builder).
- 3 test participants enrolled through the real `auto-enroll` flow: three distinct counterbalance
  permutations (draw_index 0/1/2), 14 schedule rows each, walk correctly stopped at the fork,
  first link issued.
- **A full training session click-tested in a real browser through a real participant link**
  (pre check-in → video (participant-client signed URL) → reflection prompts → post check-in):
  all six ratings schedule-linked with correct packages, day row study_day from the schedule,
  `intervention_responses` saved, `liliana_session_metrics` row correct (Δstress 3, appraisal 5).
- **Five launch-blocking integration bugs found and fixed** (none reachable by admin demos —
  only a real link click-through exposes them):
  1. `get_session_by_token` omitted `module_id` / returned `activities: null` for training nodes —
     training sessions were **never runnable via participant links** (migration
     `20260709_session_token_training_nodes.sql`).
  2. `SessionEntry` never passed `scheduleId` to StepDispatcher — all WP-L1 schedule linkage was
     silently null.
  3. The training stack (TrainingStepWrapper, InterventionPage, StudyVideoPlayer, video.ts,
     AudioBlock) used the global anon client — module fetch, day rows, response saves, and
     video/audio signed URLs (authenticated-only buckets) all failed for link participants.
     Participant client now threads through.
  4. Nothing created `liliana_participants` rows or advanced `current_day` — new
     `ensure_liliana_participant()` RPC self-creates on first training contact and derives the day
     from `participant_schedule.study_day` (migration `20260709_ensure_liliana_participant.sql`).
  5. MidpointStep's fire-and-forget `shown_at` stamp never executed — supabase-js builders are
     lazy and require `.then()`/await.
- **Midpoint click-tested for all three arms** (the permuted-block group draw gave each of the
  3 participants a distinct arm): No-Choice — preferred Self-Compassion, assigned Reappraisal,
  comfort-zone reveal correct; Choice — free selection + confirmation; Choice-with-Feedback —
  ranked cards matched the designed data exactly (Reappraisal #1 "your strongest", Stress ↓ 3.0,
  5.8/6, 4 sessions each). Snapshots, `stated_preference`, fork assignments (`anti_preference` /
  `choice`), and `midpoint_completed_at` stamps all verified in SQL.
- Still pending: Phase 2 materialization via the production 15-min cron advance pass; data-export
  coverage (`liliana_session_metrics` + snapshot in DataExportPage); unsubscribe click-test;
  Liliana's screen copy + calendar sign-off; then author the real study (duplicate of the dry-run
  graph) and retire the dry-run study.

### WP-L6 — Pilot metric bake-off (August)

R analysis on pilot data: per-participant rank agreement v1 vs v2 (Kendall τ), leave-one-session-out rank
stability, pre-stress floor effects, effort/engagement distributions. Decide and freeze `metric_version`
before September recruitment. Optional v3 = pooled-PCA fixed weights if the pilot argues for it.

## 4. Runtime integration (why this is cheap)

`materializeSchedule.ts` already resolves forks by reading `participant_assignments` per
`(study, participant)` into a `node_id → value` map and only calls `draw_assignment` when no row exists
(`kind` is irrelevant to routing). So a pre-written choice row routes the participant down their chosen
arm with **zero materializer/cron changes**. The owl arm uses the normal draw, so it is balanced across
`control_assigned` participants (after the WP-L3 `draw_index` kind-filter patch).

## 4a. Liliana sign-off checklist (before the real study is authored)

**Copy** (items 1–9 are constants at the top of `src/components/study/MidpointStep.jsx`; swapping
wording in is minutes of work):
1. Practice display names + one-line blurbs (Non-Reactivity / Reappraisal / Self-Compassion) —
   should match her modules' language.
2. Control display paragraph (both non-feedback groups; attention-matched, content-neutral).
3. Feedback intro owl text + "See my results" button.
4. Feedback screen heading/subtext + stat phrasings ("Stress ↓ X after practice",
   "Enjoyment & helpfulness: X / 6", "based on N sessions", "your strongest", "limited data").
5. Choice screen heading/subtext + "Lock it in".
6. Preference question (No-Choice) heading/subtext + "That's my pick".
7. **Anti-preference reveal (IRB-sensitive)**: preference acknowledgment + comfort-zone rationale +
   placement sentence — needs her exact approved wording, paired with the matching debrief text.
8. Choice confirmation + re-entry ("already set") screens.
9. Midpoint header (badge / "Halfway there" / subtitle).
10. Reminder email subject + body (builder → Contact settings; template variables available).
11. Consent + debrief forms uploaded and linked (`active_consent_form_id` /
    `active_debrief_form_id` — dry-run study has neither).
12. Optional: Welcome/Farewell wrapper-screen copy (`wrapperElements.js`) — preview-only today,
    only matters if those screens get wired into sessions.

**Update 2026-07-14 — midpoint copy resolved + intro video wired.** Liliana's preview HTMLs
(`I:\Shared drives\Liliana\Study3\Questionnaires_logic\MidPoint\`) supplied the canonical ranking
+ assignment copy; MidpointStep now implements them verbatim (drag/arrow ranking with colored rank
badges + "Your current ranking" box; assignment screens: "Great news!" chosen variant vs
"Sometimes it's good to step outside your comfort zone!" assigned variant, per-practice "What to
expect" paragraphs, "Begin Phase 2"), browser-verified through real participant links (both
variants; anti-preference invariant held). Practice labels/descriptions are hers
("Non-reactivity", "Self-compassion"). Checklist items 1, 5, 6, 8 (and 9's subtitle) are closed;
still open: control display copy (item 2), feedback intro/screen copy (3–4), reveal wording is now
hers (7 closed). The introduction video (`Liliana_Study3_Intro`) is wired as the final Baseline
step via the new `video` step category (`20260714_video_step.sql`), with full watch tracking —
item on the §4b list closed.

**Calendar / scheduling** (dry run assumes 27 consecutive days — but the study has historically
been described as 31 days, implying ~4 non-session days whose placement is unknown):
- Day map: gaps/rest days? (baseline→Phase 1 buffer, midpoint buffer, weekends?) Each is a
  timepoint `day_offset` edit in the builder.
- Send time (assumed 09:00 America/Toronto, same every day).
- Link lifetime per session (assumed 48 h — the missed-day grace window).
- Reminder policy: enabled? interval (default 24 h)? max per session?
- Missed-day policy: `max_attempts` (currently 1); participants stay on their original calendar
  (current behavior) vs shifting.
- Recruitment source (SONA / Prolific / both) + completion redirect URL.

## 4b. Methods-document reconciliation (2026-07-10)

Liliana's methods document (parsed 2026-07-10) resolves the calendar and pre-specifies several
details. Deltas against the built system, to be applied as **WP-L5b**:

**Calendar (31 days, resolved)** — baseline day 1; Phase 1 days 2–13; **midpoint window days
14–16** (hard deadline end of day 16, daily reminders; non-completers withdrawn from Phase 2,
Phase 1 data retained); Phase 2 days 17–28; **final window days 29–31**. Graph edits: midpoint
stays offset 13, Phase 2 arm timepoints move offset 14 → **16**, final offset 26 → **28**.
Timing: emails ~**06:00** (not 09:00); **daily links live 24 h** (not 48); midpoint/final links
**72 h**; same-day 18:00 reminder for dailies (reminder cadence config needs a pass — one
study-level interval must serve both the 12-h daily reminder and the daily assessment-window
reminders; likely interval 12 h + expiry-aware suppression, verify against check_schedule).
Missed dailies skip forward on the original calendar (current behavior ✓).

**Feedback metric pre-specified as Δstress (= metric v2)** — §4.3: "average within-session
improvement in perceived stress … mean of the daily pre- to post-session difference scores" per
arm. **Done 2026-07-10** (Norm confirmed; migration `20260710_metric_v2_primary.sql`, applied):
ranking now orders by mean Δstress (tie-breaks delta → helpfulness → seeded hash),
`metric_version = 2`, ranking entries carry both composites; v1 still computed + stored for
exploratory analysis. Verified live with a designed-disagreement participant (Δ4.0/appraisal 2.25
ranks #1 over Δ1.0/appraisal 5.75, which v1 would have preferred). Feedback UI already foregrounds
the stress delta with raw means as secondary — no component change needed; z-scores never shown.

**Preference is a ranking (Appendix 16), captured by ALL groups** — drag-and-drop rank #1–#3,
distinct from the choice act. Sequences: No-Choice = questionnaires → rank → anti-preference
reveal; Choice = questionnaires → rank → select; Feedback = questionnaires → feedback → rank →
select (feedback may influence the ranking). MidpointStep needs a ranking screen; snapshot gains
the full ranking (`stated_preference` = rank #1). Anti-preference logic is already equivalent
(50/50 among the two non-rank-1 arms).

**Group assignment timing** — doc internally inconsistent (§4.3 "prior to the midpoint" vs §3.5
"at completion"). Built behavior (drawn at midpoint-step mount) sits between; Norm confirmed
2026-07-10 that draw-at-midpoint-start is fine.

**WP-L5b implementation status (2026-07-14):**
- **Ranking**: `preference_ranking` jsonb on the snapshot; `record_practice_decision/4` validates
  the ranking (each arm exactly once; anti-preference practice must equal rank #1);
  `stated_preference` = rank #1. MidpointStep: tap-to-rank screen for all groups; sequences
  feedback → rank → select, control → rank → select, control → rank → anti-preference reveal.
  Selection is independent of the ranking (browser-verified: ranked reappraisal #1, chose
  self_compassion). Migration `20260710_preference_ranking.sql`.
- **Calendar/timing applied to the dry-run study**: Phase 2 timepoints offset 16 (day 17), final
  offset 28 (day 29); all sends 06:00; daily links 24 h, midpoint/final 72 h; study
  `max_attempts 4`, `reminder_interval_hours 12`. Fresh enrollment (dryrun-d) confirmed the new
  materialized calendar.
- **Baseline template** matches §4.1: Student Stress Scale inserted after Demographics, wellbeing
  order fixed (life sat → SPANE → PWB). Introduction video still pending Liliana's file.
- **Missed-day handling (launch-critical fix)**: the old system had NO repeat reminders, and one
  missed daily permanently blocked the Phase 2 fork (advance pass required zero outstanding rows;
  materializer required every upstream session completed — contradicting the methods doc's
  missed-days allowance). Now: `check_schedule` v10 marks dead rows (sent/issued, no active link,
  scheduled before today) as **'missed'**; the materializer fork gate is "nothing upstream still
  actionable AND the immediately preceding session (the gating assessment) completed" — missed
  dailies pass through, a missed midpoint never resolves the fork (= Phase-2 withdrawal per the
  methods doc, enforced structurally).
- **Reminders (new capability)**: `last_sent_at` on `participant_schedule`
  (`20260710_schedule_last_sent_at.sql`); check_schedule re-sends link_sent rows while their link
  is still active — cadence 12 h for daily sessions (one same-evening nudge before the 24 h link
  dies) and 24 h for 72 h assessment windows (one reminder per remaining day) — capped by
  `studies.max_attempts` (4), gated on `reminders_enabled`, never re-emails an expired link.

**Confirmed matches, no work**: counterbalanced Phase 1 (block order random, within-block fixed);
momentary assessment items + anchors = the two VAS packages exactly; PHQ-8/GAD-7 screener gates
(existing two-phase screener infra); rolling enrollment; midpoint/final instrument lists.

**New requirements**: baseline template additions (Student Stress Scale, PHQ-8/GAD-7 carry-over,
introduction video, §4.1 order); distress-flag monitoring (PHQ-8/GAD-7 thresholds at assessments →
resources + team follow-up); adherence/credit tooling (10-of-12 per phase, prorated SONA credit);
daily-email content (PI contact + Appendix 17 resources). Appendices 12/14/15/17 supply the
screener/consent/debrief/resources copy — clears those items from §4a; midpoint screen copy and
ranking-screen instructions still owed.

## 5. Open items (Liliana / Norm)

1. ~~Three-group structure~~ — confirmed 2026-07-08: feedback+choice / control display+choice /
   control display+owl placement.
2. Copy for the feedback screens, control display, and owl placement announcement (drafts can be built
   with placeholders; her sign-off before pretest).
3. Owl placement is a genuinely random balanced draw framed as the owl's wisdom — benevolent fiction;
   debrief/consent wording is an IRB-facing decision for Liliana.
4. Can choosers pick any practice, including their lowest-ranked? (Assumed yes — free choice.)
5. Semantics of `liliana_participants.condition` ("Assigned condition arm") — proposal: it holds the
   Phase 2 practice once decided; snapshot remains the source of truth.
6. ~~Post-question order~~ — resolved 2026-07-08: the package order is authoritative
   (stress → helpful → enjoyment → effort; stress lands immediately after practice, as desired).
