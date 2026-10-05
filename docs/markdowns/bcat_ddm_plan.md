# BCAT-DDM prototype — inventory, plan, and status

> **Read this first** if you are a session picking up the BCAT-DDM work. It records what already
> exists, what was decided, and what is still waiting on Norm. Update the **Status** and **Decisions**
> sections as you go — this file is the thread, not the chat.
>
> **Source brief:** `I:\My Drive\Mentoring\Undergrads\Nansi\BCAT-DDM Prototype Handoff.md`
> (Norm, 2026-10-01; student lead: Nansi). Theory PDFs sit beside it (Teoh, Cunningham & Hutcherson
> 2023; Wu, Szücs, Moors & Tuerlinckx).
> **Shareable write-up (Google Doc, for Nansi and the lab):**
> [BCAT-DDM: design status and decisions](https://docs.google.com/document/d/1g4111SODzbDdzlvrnmzYpil9ONMNDieQX04CjGio_C8/edit)
> (Nansi folder, created 2026-10-05). It is a snapshot; this file stays the plan of record.
> **Created:** 2026-10-01 (handoff steps 1–3: inventory + proposed plan). **No task code written yet.**

---

## Status

| Step (from the handoff) | State |
|---|---|
| 1. Read website.md, inventory pacer / BCAT / VAS / scale tables | ✅ done 2026-10-01 (§1–§4 below) |
| 2. List pre-built VAS options; do calm→activated / tired→alert exist? | ✅ done 2026-10-01 — **neither exists** (§3) |
| 3. Findings + build plan mapped to the open questions | ✅ drafted 2026-10-01 (§5–§6) — **awaiting Norm's answers** |
| Design-power simulation (added by Norm 2026-10-01) | ✅ first full run done (§6b); schedule generator built in `src/games/BcatDdm/schedule.js` |
| 4a. Continuous pacer + scheduled step changes + event log | ⏸ blocked on approval |
| 4b. Free-response detection + confidence | ⏸ |
| 4c. Arousal / alertness probes + re-entrainment | ⏸ |
| 4d. Follow / Watch conditions | ⏸ |
| 4e. Simulated data export for go/no-go DDM | ⏸ |

**Gate:** do not write task code until Norm has answered the open questions in §5 (the handoff
says so explicitly). Record his answers in §7 *Decisions* with the date.

---

## 1. What "BCAT" already is — three implementations

There is no single BCAT codebase. Three exist, and they differ in ways that matter here.

| Implementation | Where | Trial shape | Response | Thresholds |
|---|---|---|---|---|
| **Lab PsychoPy task, "Intero2025"** (the pilot behind the current paper; N = 306, prereg osf.io/wz32n) | Task source **not in this repo** (location unconfirmed). Analysis: `I:\Shared drives\Aya\Repo\Analysis` (`R/02_prep_bcat_baseline.R` reads `*Intero2025*.csv`; columns `level, Direction, Correct, Response, ArousalRating, confidenceSlider.response, ACCthresh, DECthresh`) | Short paced trials, high vs low salience (step vs ramp) | Post-trial 3-alternative choice (3AFC: faster / same / slower), then arousal + confidence | Quest (`ACCthresh` / `DECthresh`) |
| **Website Breath Belt** (lab-only port with a Polar H10 belt) | `src/games/BreathBelt/`, route `/games/breath-belt`; website.md §20 | **4 breaths**: 2 at baseline 4 s, then 2 at the condition period (step at breath 2→3) | Post-trial 3AFC → confidence → "arousal" (both 6-point face scales) | Dual QUEST+ (faster/slower), `useBeltQuestStaircases.js` |
| **Study 1 (original PsychoPy)** | Priors written up in `docs/markdowns/fourbreathtask.md` | 8 breaths, step at breath 5 | 3AFC + confidence (1–7) + arousal (1–7) | Fixed magnitudes 0.20 / 0.35 / 0.50 |

Demos built from the website version: `BreathBeltDemo.jsx` (`/demo/breath-belt`) and
`PacerOpenerDemo.jsx` (`/demo/pacer-opener`, a device-free one-trial pacer).

**What this answers in the brief's open questions** (still worth one-line confirmation from Norm):
- *"4 pulse / breath"* almost certainly means the **4-breath trial** (2 baseline + 2 changed breaths,
  step at 2→3), which is how both the website task and `fourbreathtask.md` describe it.
- *When is the response collected?* **After the trial**, in every version. The 3AFC screen appears only
  once the 4th breath ends; `belt_trials.response_rt_ms` is timed from trial end, not from change
  onset. So nothing in the existing data gives a usable reaction time from change onset. The
  free-response design is a genuine change, not a re-analysis.

---

## 2. Reusable code — what fits, what doesn't

### Pacer
- `src/games/EbbAndFlow/useBreathCycle.js` — breath clock: `getPhase()` returns 0–1 (0 = inhale start,
  0.5 = exhale start) from `performance.now()`. `startBreath(ms)` restarts the clock and resolves a
  Promise via **one `setTimeout` per breath**.
- `src/games/EbbAndFlow/components/AvatarBreathPacer.jsx` — the visual pacer (platform avatar face
  that swells and shrinks). Takes `getPhase` (or a live `getLevel`) and has a `controlRef` with
  `resumeAnimation()` / `resetToNeutral()`.
- `src/games/BreathBelt/hooks/useTrialRunner.js` — runs one discrete trial: 500 ms fixation hold,
  2 + 2 breaths, then freezes the avatar.

**Why the pacer can't be reused as it is for a continuous stream:**
1. *Drift.* Each breath restarts the clock when a `setTimeout` fires, so timer lateness builds up
   breath by breath. Over a 10–15 min stream, the pacer's real timing will wander away from its
   nominal schedule.
2. *The onset marker is turned off.* Trigger code 11 (condition onset) was **disabled** because
   awaiting the trigger stalled the animation at the breath 2→3 boundary
   (`useTrialRunner.js:83-89`). Onset is currently reconstructed offline from codes 10/12. For the
   DDM, change onset is *the* time-zero, so it needs a direct, millisecond-accurate marker.
3. *Built around discrete trials.* There is a fixation hold and a freeze between trials, which is the
   opposite of one continuous stream.

**Proposal:** keep `AvatarBreathPacer` (or a plain circle, see §5 Q-pacer) as the *renderer*, but
drive it from a new **schedule-driven clock**. All breath start times are precomputed in absolute
time, and `getPhase(t)` is a lookup into that schedule, so nothing accumulates. Triggers are
**fire-and-forget** (never awaited inside the animation path). Because every change starts at an
inhale onset (phase 0), switching period there causes no visible jump in the pacer.

### Belt, triggers, calibration, backup — reuse unchanged
- `src/games/BreathBelt/hooks/useBeltConnection.js`: Polar H10 over Web Bluetooth (accelerometer +
  heart rate), the 6-model linear-regression calibration fit (`fitBestModel`), and `sendTrigger` for
  AD_BBT (Web Serial) and Biopac (the local `scripts/parallel_server.py` helper on `:8765`; it must
  run from `http://localhost:5173` because of the mixed-content block).
- `CalibrationScreen.jsx`, `CalibReviewPanel.jsx`, `useStreamingBackup.js` (local CSV backup),
  `useBeltSession.js` (uploads raw accelerometer / heart-rate CSVs to the `belt-sessions` Storage
  bucket).
- `src/games/shared/breath/` (website.md §20, *Shared breath-signal layer*): `useBreathSignal` exposes
  live `phase`, `bpm`, `lastPeriodMs` and **`onBreathEvent(cb)`** (inhale/exhale onsets), and
  `breathFeatures.parseHrPacket` decodes **RR intervals**. This is the natural source for
  *measured-breath* event logging and the heart-rate arousal track. `/dev/breath-lab?sim=1` is the
  belt-free test bench.
- The Polar H10 path currently streams accelerometer + heart rate/RR only, **not raw ECG** (the
  device can stream ECG at 130 Hz over the same protocol, but nothing requests it). Lab-grade ECG
  and respiration come from Biopac / LabChart, aligned through the triggers.

### Thresholds (the Quest pre-run)
- `useBeltQuestStaircases.js` (`jsquest-plus`) fits a **Weibull, 3AFC** model: guess = 1/3,
  slope β = 3.5, lapse = .02. Stimulus = log10(seconds of deviation from a 4 s base), range
  0.1–2.0 s, prior mean 0.5 s.
- To get the 4 constant-stimulus levels from a fitted threshold *t*, invert the guess-corrected
  detection part: `x_p = t + log10(−ln(1 − p)) / β` for p ∈ {.25, .50, .75, .90}.
- **Caveat to raise with Norm:** that threshold comes from *post-trial 3AFC on a 4-breath trial*. The
  main task is *free-response detection in a continuous stream* (a different task, with a different
  false-alarm structure), so the levels are a starting point, not the targets. Options: a short
  go/no-go recalibration block, or re-centring the levels after block 1 from the observed hit rates.
- Units: Breath Belt uses absolute seconds, while `fourbreathtask.md` and the paper use the
  proportional `delta = TotalChange − 1`. **Log both** (`belt_trials.proportion_mag` already does).

### Data and physiology analysis
- Tables `belt_sessions` and `belt_trials` (live columns include `trial_onset_ms`,
  `condition_onset_ms`, `response_rt_ms`, `session_start_epoch_ms`, phase start/end anchors).
- Offline breath detection: "Study 5" `breath_pipeline.R` (`run_pipeline`) and
  `Intero2025_BehaviourLedBreathAnalysis.R` are cited in website.md §20 and
  `breathbelt_correspondence_prereg.md`, but **neither file is in this repo or the Aya repo**.
  Ask Norm where they live. The browser port of the trough method is `buildCleanGraph` /
  directional adherence in `BreathBeltDemo.jsx`. Lab physio extraction (bioread → `.rds`) is in
  `I:\Shared drives\Aya\Repo\Analysis\R\05_prep_physio.R`.
- **Trigger-nibble gotcha:** Aya's rigs put L on the low nibble and R on the high one; Breath Belt
  does the opposite (`Biopac_Right` = shift 1, `Biopac_Left` = shift 16). Pin this down before
  writing any trigger-alignment code.

---

## 3. Rating scales — what exists (queried live 2026-10-01)

**In-game rating components (`src/games/shared/`)**
- `ConfidenceRating.jsx` — 6 avatar faces, "no idea … certain". Reusable as-is for post-press
  confidence.
- `ArousalRating.jsx` — 6 faces, labelled **"very tired … very alert"**, but Breath Belt asks it as
  *"How activated do you feel right now?"*. **So the existing "arousal" rating is really
  tired→alert, under an activation question. It conflates the two constructs the brief says to keep
  separate.** Do not reuse it as the calm→activated item. (Also note website.md §20 says "1–7" for
  both ratings; the components are 6-point.)

**Platform VAS library (`vas_scales`, 8 rows, all `emoji_6`):** confidence, effort, enjoyment,
helpful, life-satisfaction, sleep, stress, task-satisfaction. **No calm→activated, no tired→alert,
no Karolinska Sleepiness Scale (KSS).**

**Continuous sliders (`slider_scales`, ~35 rows):** min/max/labels/step. All study-specific
(attribution, efficacy, age, positive/negative emotionality). **None fits.**

**How the platform VAS is wired:** `VasRenderer.jsx` writes one row to `vas_responses` per *session
step* (with `schedule_id` / `step_index`), dispatched by `VasStepWrapper` inside a study session.
It is built for between-task steps, **not for a 3–5 s probe embedded in a running stream**.

**Recommendation:** build the two in-task probes as small new components inside the task: a
*continuous* slider (0–100 is better for trial-level modelling than a 6-point face scale), with fixed
on-screen time and a timeout. Store them in the task's own event log (§6). If Norm wants them in
the admin library for reuse elsewhere, also register matching `slider_scales` rows. That is cosmetic
and doesn't change the task's data path.

---

## 4. Platform constraints that apply (from CLAUDE.md)

- **New tables:** add own-rows RLS for `authenticated`, or writes are silently blocked. The migration
  goes in `supabase/migrations/YYYYMMDD_*.sql` and gets a row in the migrations README manifest.
- **Data-logging rules 1–5:** a table holding participant responses (press, confidence, VAS) is a
  *response table*. It needs to be append-only (the two triggers plus an entry in
  `src/lib/responsesAppendOnly.test.mjs` `RESPONSE_TABLES`), use submit locks (`useSubmitLock`), and
  name export columns from recorded facts, never from occurrence order.
- **Route:** lazy-load it in `App.jsx`, lab-gated like Breath Belt (`profiles.role` ∈ lab/admin).
- **`api/` is already at 12 files**, the Vercel cap. This task must not add a serverless function.
- **Branches:** pure-frontend work goes to `dev` first. Anything touching `supabase/` goes to `main`
  together with its coupled code. Never `git add -A`; another session's files are usually staged
  in this tree.
- **R:** build paths with `file.path()`, prefix dplyr calls (`dplyr::`), and open with the standard
  package block (see the Aya handoff for the exact block).

---

## 5. Open questions for Norm (the brief's 7, plus what the inventory added)

Answered provisionally by the inventory (confirm):
1. **"4 pulse / breath"** = the 4-breath trial (2 baseline + 2 changed, step at 2→3)? *(§1)*
2. **Response timing** = after the trial (post-trial 3AFC), in every existing version? *(§1)*

Still Norm's call:

3. **Session format:** two sessions, or one ~60 min visit? This decides whether Watch is a full or a
   short block.
4. **Run length:** a continuous 10–15 min stream, or short blocks with breaks?
5. **Platform:** recommended = build in this repo as a lab-only route that reuses the Breath Belt
   plumbing, with a belt-free mode (`?sim=1` and a "no belt" browser pilot) for piloting the task
   logic online. Lab physiology rides on the existing triggers. OK?
6. **Capnography / EDA** in the lab? (Nothing in the codebase references either.)
7. **VAS reuse vs new:** recommended = new in-task continuous probes (§3). The existing
   `ArousalRating` is tired→alert, so it can't serve as calm→activated.

Raised by the inventory:

8. **Trial yield vs DDM needs (the biggest design risk).** One change cycle is: up to ~10 breaths
   of response window (~30–50 s), return to baseline, 2–3 re-entrainment breaths (~10 s), a probe
   (~5 s), then a 30–60 s stable stretch. That is roughly **1 change per 75–110 s**, so about
   **8–12 changes per 15 min**. Spread over 4 levels × 2 directions, that is ~1–2 per cell per block.
   Hierarchical fitting helps, but per-person drift by level/condition will be thin. Does the
   "every 30–60 s" mean onset-to-onset (which squeezes the stable stretch) or the gap after
   re-entrainment? Can the response window be shorter than 10 breaths?
9. **The return to baseline is itself a step change.** After a 10-breath window, stepping back to
   the baseline rate is a second, fully detectable change. Should a press during the return count as
   a false alarm, be modelled as its own event, or be suppressed? (Proposal: log it as its own
   event type, `return`, and don't score it as a false alarm.)
10. **Quest pre-run task:** reuse the 3AFC 4-breath Quest as-is (fast, validated), or run a short
    go/no-go version that matches the main task? (§2 *Thresholds*)
11. **Pacer visual:** the avatar face (platform look, used in Breath Belt) or a plain expanding
    circle (Study 1 / PsychoPy look; easier to degrade for the optional low-contrast condition)?
12. **Location of the Intero2025 PsychoPy task source and of `breath_pipeline.R`** (§2), so offline
    breath-onset detection reuses the published method rather than a re-implementation.

---

## 6. Proposed build plan (after approval)

**Where:** `src/games/BcatDdm/` (new), route `/games/bcat-ddm` (lab-gated, lazy-loaded), plus
`?sim=1`. Reuse `useBeltConnection`, `CalibrationScreen`, `useStreamingBackup`,
`useBeltQuestStaircases` (pre-run), `ConfidenceRating`, and `AvatarBreathPacer` as the renderer.

**Pure, node-testable core first** (the same pattern as `emberMechanics.js` / `mirrorCalibration.js`:
React-free, explicit `.js` imports, a `*.test.mjs` beside it):

- `schedule.js` — `buildSchedule({ basePeriodMs, levels, directions, condition, durationMs, seed, … })`
  → an array of breaths with absolute `startMs` / `periodMs`, plus change events (onset locked to an
  inhale start; level, magnitude in seconds *and* proportion, direction), response windows, return
  and re-entrainment breaths, no-change "catch" windows matched in length, and probe sampling
  (~1 in 3 across hits / misses / false alarms / no-change, decided at window close). Seeded, so a
  session is reproducible.
- `pacerClock.js` — `getPhase(nowMs)` / `getBreathIndex(nowMs)` looked up from the schedule. No
  per-breath timers.
- `scoring.js` — classifies presses (hit within the window / false alarm in stable or catch periods /
  press during a return) and computes RT in ms and in **breaths since onset**, using *measured*
  breaths when a belt is present and paced breaths otherwise (both logged).
- `simulate.js` (step 4e) — generates a synthetic participant from known DDM parameters
  (v by level × condition, a, z by direction, Ter) through the *same* schedule and scoring code, and
  writes the export. Used for parameter-recovery checks in brms / HSSM before any real data exists.

**Then the React layer:** stream screen (pacer + press capture on Space / tap, with a sync-ref lock
per press), post-press confidence, probes, block breaks with the alertness probe on a fixed timer,
and a Follow / Watch block runner.

**Event log** (one row per event, ms since a session epoch anchor plus the epoch itself):
`pacer_breath` (inhale onset, period), `change_onset`, `return_onset`, `response`
(press time, classification), `confidence`, `probe_shown` / `probe_response`, `block_start` /
`block_end`, `trigger_sent` (code, ms). Raw accelerometer / heart-rate / RR go to Storage as in
Breath Belt.

**Storage (proposed, needs sign-off):** `bcat_ddm_sessions` (one row per session; schedule seed,
calibration, Quest state, levels) + `bcat_ddm_events` (append-only, own-rows RLS, response-table
triggers). The alternative is a `dataset jsonb` on one session row, as Breath Guardian does.
Simpler, but it loses everything if the tab dies before the end; events-as-rows survive a crash.

**Export (step 4e):** one row per change or catch window: `participant, session, block, condition,
event_type, level, magnitude_s, magnitude_prop, direction, onset_ms, responded, rt_ms, rt_breaths,
confidence, measured_period_pre_ms, measured_period_post_ms, arousal_vas, alertness_vas_nearest,
time_on_task_s`. No response → `responded = 0`, `rt = NA`, which is the shape both brms `wiener` (with
the implicit-boundary treatment) and HSSM go/no-go expect. Column names come from recorded facts
(CLAUDE.md rule 3).

**Trigger codes:** the 1–13 vocabulary is taken. New events need codes ≥ 14 (proposal: 14 change
onset, 15 return onset, 16 response, 17 probe onset, 18/19 block start/end). Check them against the
lab recorders before use.

---

## 6a. Design alternatives for power — brainstorm 2026-10-01 (NOT decided)

**Why trials are scarce in the brief's design.** The 10-breath response window, the return to
baseline, re-entrainment and the stable stretch together leave ~25–45 changes in 40 min of task time.

**The Study 1 caution on ramps.** In `fourbreathtask.md`, the low-salience (amortised ramp) slope is
1.24 logit units per unit of magnitude, against 5.70 for a step. Accuracy for ramps stayed near
chance even at 50% change. Ramps are weak evidence for this system. A pure ramp design would
therefore need long ramps reaching large, uncomfortable periods (2 s or 8 s), and would produce many
misses: the opposite of the efficiency it promises.

**What step vs ramp could tell us.** The comparison separates two ways the evidence could be coded:

| Evidence coding | Step delivers | Ramp delivers |
|---|---|---|
| *Level* (deviation from a remembered reference) | constant drift (decaying if the reference adapts) | linearly growing drift |
| *Transient* (breath-to-breath difference) | one pulse at onset | small constant drift |

Study 1 (step ≫ ramp at the same total change) points to transient coding, or level coding with a
fast-adapting reference. If that's right, the step's evidence sits in the first 1–3 breaths, and a
10-breath window mostly collects guesses.

**Ways to recover power, ranked by expected gain / cost:**
1. **Roving baseline (no return).** Each step's new rate becomes the next baseline, bounded around the
   centre, with proportional magnitudes. This removes the return events and most re-entrainment, and
   the "a return is itself a change" problem goes away. ~1.5–2× the changes.
2. **Shorter response window.** Set it from the hit-RT distribution of an online pilot; likely 4–6
   breaths.
3. **Hazard-based onsets with a short minimum gap.** False alarms are scored per breath across all
   stable time, so no long dedicated no-change stretches are needed.
4. **Continuous magnitudes** sampled around each person's threshold, instead of 4 fixed levels, with
   drift regressed on the *measured* deviation. Power then depends on the total number of trials, not
   on trials per cell.
5. **Confidence encoded in the press** (two keys, "think so" / "sure"). This replaces the post-press
   rating screen and keeps the stream continuous.
6. **Cheaper Watch:** a shorter block with only the higher levels. It is a control estimate.
7. **Second session** (test-retest ICC for step d' was .54 in Study 1).

**The ramp as a diagnostic, not the main design.** A small block of ramp trials at 2 ramp rates,
with null trials, over a fixed number of breaths, continuing to a fixed endpoint whatever the
response. This tests integration directly: a pure threshold predicts the same magnitude at
detection at both ramp rates, while integration predicts lower magnitudes for slower ramps. Because
the endpoint is matched across hits and misses, the arousal-gating comparison is clean. The ramp
needs a time-varying-drift model (PyDDM, or simulation-based inference), **not** brms `wiener`.

**A complementary analysis:** a discrete-time hazard model (detection per breath, logistic). It
handles censoring, ramps and time-varying covariates natively. Comparing current, cumulative and
exponentially weighted deviation as predictors tests perfect vs leaky integration directly.

**Recommended way to decide:** build the pure core first (`schedule.js`, `scoring.js`,
`simulate.js`) and run a design-power simulation. Generate synthetic participants under 3 evidence
models (level-perfect, level-leaky, transient). Run each candidate design (the brief's, roving step,
trial-based step, step + ramp block) through 40 min, refit, and compare parameter recovery and model
discrimination. The task code needs this core anyway, so the simulation costs little extra.

---

## 6b. Design-power simulation — results 2026-10-01

Code: `scripts/bcat_ddm_sim/` (README there for the model and assumptions). Schedules come from
`src/games/BcatDdm/schedule.js`, the generator the task will use. Full tables:
`scripts/bcat_ddm_sim/results/summary.md`.

**Setup.** 40 min of Follow task time; N = 30 simulated participants per design × generating
observer; every session is fitted with all 3 observers by exact maximum likelihood over the
whole press stream; 98% of fits converged. Generating observers, each calibrated to Study 1
(50% detection of a 20% step within 5 breaths, 0.3 false alarms/min):
- **level**: perfect accumulation of deviation from a running reference;
- **leaky**: the same evidence, but accumulation leaks, with integration time ≈ 3 s;
- **transient**: only breath-to-breath change counts.

| | brief | roving | trials | ramp | roving_ramp |
|---|---|---|---|---|---|
| changes / session | 23 | 53 | 48 (+16 null) | 40 (+13 null) | 49 (+3 null) |
| hits / session | 16 | 27 | 24 | 26 | 27 |
| **level** observer: r(v) / r(a) / r(δ) | .78/.61/.30 | .56/.61/.01 | .64/.47/.06 | **.91/.87/.71** | .81/.64/.34 |
| **transient** observer: r(v) / r(a) / r(δ) | .89/.81/.85 | **.92/.83/.81** | .51/.44/.05 | .57/.61/.05 | .77/.76/.69 |
| **leaky** observer: r(λ) | .55 | .41 | .24 | .24 | .43 |
| per person: transient vs level picked correctly | 100% | 100% | 97% | 90% | 100% |
| per person: leaky picked when true | 17% | 17% | 17% | 23% | 17% |
| group ΔAIC, right model wins? (level gen / leaky gen) | ✗ / ✓ | ✗ / ✗ | ✓ / ✓ | ✓ / ✓ | ✓ / ✓ |

**What it says**
1. **More changes ≠ more power.** Roving doubles the changes (23 → 53), but hits only rise
   16 → 27. It recovers level-observer parameters *worse* than the brief, with the criterion δ
   unrecoverable. Each change is less informative because magnitudes are spread out, the window is
   short, and there is less settled stable time to pin down false alarms. Raw count is the wrong
   target.
2. **Ramps are the best design for a level (deviation-coding) observer.** Every ramp sweeps the
   whole magnitude range, so each trial samples the dose-response curve: r(v) = .91,
   r(δ) = .71. **They are poor for a transient observer** (r ≈ .57), who detects only 37% of ramps
   against ~80% for level/leaky observers. That is Study 1's step ≫ ramp asymmetry, reproduced by
   transient coding.
3. **Which evidence is coded is answerable per person in every design**: level vs transient was
   picked correctly 90–100% of the time, with ΔAIC in the thousands at group level. This, not
   perfect vs leaky, is the accumulation question 40 min can actually answer.
4. **Perfect vs leaky accumulation is not answerable per person in any design** (17–23% recovery;
   ~30% of true leaks estimated at the floor). Only at group level, and only designs with ramps or
   fixed trials get the direction right for both generators.
5. **A step + ramp mix (roving_ramp) is the robust choice under uncertainty.** It is never the worst
   on any row and is good for both level and transient observers. Pure ramp is best if the
   observer is a level observer, and worst if it is a transient one.

**Answer to "should we re-evaluate a ramp-with-null-trials design?"** Yes, as a *component*. A
ramp block is what makes the level/leaky parameters and the group-level leak test work. Ramps alone
gamble on the coding question that the study is meant to answer, and Study 1 already leans
transient.

**Caveats.** One replicate of N = 30 per cell (SE of r ≈ .1, so differences under ~.15 are noise).
Fits are per person; a hierarchical fit will do better across the board. Watch is not simulated.
The leak's size (λ = 0.35/s) is an assumption: a slower leak would be harder to detect, a faster
one easier. Belt error (2% per period) roughly halves the transient observer's fitted gain
(errors-in-variables); correlations survive, absolute values don't.

**Next simulation runs worth doing (each ~1 h, background):**
- ramp share in roving_ramp (25% → 40–50%);
- σ_meas = 0 sensitivity, to see how much a better belt buys;
- λ range;
- a mixed level+transient observer;
- add Watch;
- hierarchical refit of the top two designs.

---

## 6c. Round 2 — the best overall accumulation model, with coding as an individual difference (running 2026-10-05)

**Question (Norm, 2026-10-05).** The central aim is the best overall model of how breath-change
evidence accumulates. The secondary aim is individual differences in *what* is accumulated:
breath-to-breath change vs total change from baseline.

**What changed from round 1**
- **Two-channel observers.** Every observer is one accumulator fed by total change (gain vL) and
  breath-to-breath change (gain vT), with or without a leak. The generating observers are
  `level`, `leaky`, `transient`, `mixed` and `mixed_leaky`, all 5 also fitted to every session.
  Mixed observers vary in their breath-to-breath share s ~ Beta(2, 2).
- **New metrics:**
  - does the summed-AIC winner across the group match the generator?
  - per-person model choice;
  - r(true s, recovered s).
- **Designs:**
  - `roving_ramp` (25% ramps, block at the end);
  - `roving_ramp50` (50%);
  - `ramp`;
  - **`roving_mixed`** (new): each change in a roving stream is randomly a step or a 6-breath ramp
    of the same total size. That is Study 1's salience manipulation within one stream, with no
    blocks.
- **Calibration fix.** Paced breath noise is now log-SD .04, down from .06, and calibration takes the
  lowest gain that reaches the target. At .06 the transient observer was uncalibratable (its gain
  ran off to a plateau), so round-1 transient numbers carry that caveat. See the sim README
  *Checks done*.

**Queued after it:** σ_meas = 0 on the best two designs, to show what a better belt would buy.
Results go in `scripts/bcat_ddm_sim/results_round2/summary.md`, with conclusions written here.

---

## 7. Decisions (append with dates)

*(none yet — waiting on §5)*

---

## 8. Session log

- **2026-10-01** — Handoff steps 1–3. Inventoried the three BCAT versions, pacer, belt plumbing, Quest,
  rating components, and the live `vas_scales` / `slider_scales` tables. Found that no
  calm→activated or tired→alert scale exists, that the existing `ArousalRating` is actually
  tired→alert, that the pacer drifts and has the onset trigger disabled, and that the trial yield is a
  risk. Drafted this plan. No code, no schema changes.
- **2026-10-01** — Power brainstorm (§6a): roving-baseline steps + shorter windows as the main lever;
  ramp kept as a diagnostic block, not the main design (Study 1 ramps near chance); proposed a
  design-power simulation as the way to decide.
- **2026-10-01** — Built and ran the design-power simulation (§6b): `src/games/BcatDdm/schedule.js`
  (+25 tests) and `scripts/bcat_ddm_sim/`. Headline: step+ramp mix is the robust design; coding
  (level vs transient) is identifiable per person, perfect-vs-leaky only at group level with ramps.
  Committed to `dev` 2026-10-05.
- **2026-10-05** — Norm reframed the central question: the **best overall model of how breath-change
  evidence accumulates**, with breath-to-breath vs total-change coding as an individual difference.
  Wrote the Google Doc snapshot (link at top). Built round 2 (§6c): two-channel observers,
  `roving_mixed` design, first-crossing calibration, `--resume`; launched the N = 30 run.
