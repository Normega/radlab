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
| `feedback_choice` | Personal data summary (ranked practices) | Participant's choice, immediately after the feedback screen |
| `control_choice` | Control display (no personal data) | Participant's choice, immediately after the control display |
| `control_assigned` | Control display (no personal data) | Balanced random draw, announced as the owl's wisdom ("I have placed you on the … path") |

This isolates the feedback effect (`feedback_choice` vs `control_choice`) and the choice effect
(`control_choice` vs `control_assigned`). The two non-feedback groups see the **same** control display.

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
