# Sense Foraging Scale validation (REB #00051180): running it on radlab.zone through Prolific

Plan written 2026-10-08. **Nothing has been built yet.** The plan rests on three sources:

- the approved package in `I:\My Drive\Ethics\Sense Foraging Questionnaire Zindel\Rev2\`;
- the item pool `Sense Foraging and Other Scales v1.2.docx` in the parent folder (the 32 items, 1–6 agreement scale). Rev2 does not contain it;
- `HANDOFF_platform_lessons_from_UTMAP_2026.md` in that same parent folder, checked against `origin/main` @ `cb80a7c` and the live database.

Read §1 (decisions) before writing code. Several choices change what gets built.

**Build status, 2026-10-09** (newest first):
- **On `dev` (`66bd6c7`), CI green.** Not yet on `main`:
  - **P1 interleave** (`src/lib/interleaveOrder.js`);
  - **P3 `show_if`** (`src/lib/composableVisibility.js`);
  - multiple choice now honours `allow_pna`. It had been accepted and silently ignored, so 5 background questions could not be declined.
  - Live `sf-background` / `sf-sfs` definitions updated and verified byte-identical to `scripts/sense_foraging/study1/*.json` (canonical-jsonb md5).
  - Until `dev` is promoted, radlab.zone renders them without branching or the multiple-choice decline. **Test Study 1 on dev.radlab.zone.**
- **P4 decline: no new code needed.** The PSY240 trial session shipped "No thanks" (`studies.decline_message`, `decline_consent()`, applied live; ConsentGate on `dev`). Study 1's message tells people to return the submission on Prolific.
- **Two attention checks in Study 1 (Norm, 2026-10-09)**: `sfs_attn_disagree` (pages 1–2) and `sfs_attn_agree` (pages 3–4). They ask for different answers, offer no "Prefer not to answer", and **failing both excludes from analysis**; failing one is flagged. Live `sf-sfs` verified identical to the file; pool 5's sheets updated. Still open: whether a double fail is also rejected on Prolific (recommended: no, because the consent promises payment for time spent).
- **Attention checks renamed** (`sfs_attn_*`, `maia_attn_check`). The export names a column by an item's trailing digits, so `_attn_1` would have exported as `_1` ("item 1").
- **Next:** P5 (identity table + de-identification + `?test=1`), then P6 (posting column).
- **De-identification decided (2026-10-09):** the scrub specification and timeline are in §5a, and the how-to is in website.md §26c. Open: offsite-backup retention (§5a, option (b) recommended).

---

## 0. What the approved protocol asks for

| | Study 1 (EFA) | Study 2 (CFA + validity) |
|---|---|---|
| N | 450–500 | 450–500, independent of Study 1 |
| Battery | Background questionnaire, then the 32 SFS items in **randomized order** | Background + 32 SFS + FFMQ-15, MAIA-2 (37), single-item life satisfaction, PHQ-4, BIDR-16. **Item and scale order randomized/counterbalanced** |
| Item count | ~45 | ~118 |
| Recruitment | Two Prolific postings per study, both leading to the identical study: "Everyday Experience & Wellbeing Survey" (general) and "Mindfulness, Body Awareness & Everyday Experience Survey" (contemplative-leaning). No screening. 18+, fluent in English, countries US/UK/CA/AU/IE/NZ | same |
| Pay | $12 USD/h prorated; partial completers paid for their time | same |

Promises the platform has to keep, quoted from Consent v3 and the debrief:

1. "You may skip any question you prefer not to answer."
2. "I agree" / "**I do not agree** to participate" are both offered.
3. Repository (Borealis) deposit is a **separate, optional** Yes/No question.
4. "If you complete only part of the study, you will still be compensated for the time you spent."
5. The Prolific ID is "permanently removed … once payment is complete" and then "**cannot be recovered by anyone, including the research team**".
6. Withdrawal is possible by emailing the Prolific ID **within 48 h**, and the same window applies before any deposit.
7. Resources go to everyone; there is no individual feedback or scoring, and no contact is triggered by any answer.

## 0a. What the platform already does (verified 2026-10-08)

- **The Prolific path is proven at scale.** Sandy Study 3 (`online_single`, Prolific) took 366 Prolific enrollments over 8 postings, Jul 21 – Aug 27. Every enrollment recorded its posting's `prolific_study_id` in `study_enrollments.external_meta`.
- **Join URL**: `https://radlab.zone/study/join?study_id=<uuid>&PROLIFIC_PID={{%PROLIFIC_PID%}}&STUDY_ID={{%STUDY_ID%}}&SESSION_ID={{%SESSION_ID%}}`. StudyDetail generates it. **Correction to the handoff:** the path is `/study/join`. `/join/:slug` is the OpenJoin route, and a bare `/join?study_id=` matches neither.
- Unsubstituted placeholders are refused (`_shared/externalIdGuard.ts`). Re-entry is keyed on (study, external_id). In `auto-enroll` §6b the single-shot path takes the **first** `study_sessions` row by `order_index` and issues a 48 h link.
- A mid-session reload resumes at the current step (`SessionEntry` `readProgress`, sessionStorage, per tab). A reload inside a composable questionnaire restarts that questionnaire at page 1. Its answers are re-collected and kept as `_r2` (rule 5), not lost.
- Repository consent is live (`20261008_repository_consent.sql`, applied). When asked, the Yes/No answer is **required** before continuing. It is stored as `study_enrollments.repository_consent` and exported.
- Composable questionnaires support `likert` / `multiple_choice` (with `exclusive`, `allow_multiple`, and a per-option `response_type: number|text` box), `open_text`, sliders, `information`, and "Prefer not to answer" (`'pna'`). Responses land in `questionnaire_responses` with `schedule_id` and `step_index`, and are append-only (rule 5).
- `CompletionRedirectScreen` shows after the debrief and returns to Prolific after 10 s.
- `participant_step_timings` records time on every step, which is the speeder signal.

## 0b. Gaps: what the protocol needs and the platform lacks

| # | Gap | Why it matters |
|---|---|---|
| G1 | **No item-order randomization** in composable questionnaires | REB: SFS items "presented in randomized order" (Studies 1 and 2) |
| G2 | **No step-order randomization** in a single-shot session. Counterbalancing exists only between sessions of a longitudinal graph, and §6b always runs the first session | REB: Study 2 scale order randomized/counterbalanced |
| G3 | **No conditional questions** in composable surveys | Background Q6 → Q7–Q10 only if "Yes" |
| G4 | **No "I do not agree" button** on ConsentGate | Approved form offers it. On Prolific a non-consenter needs a way back (a return code) |
| G5 | **The Prolific ID is stored in clear text in five places**: `study_enrollments.external_id`, the auth email `ext-prolific-<pid>@participants.radlab.zone`, `user_metadata.display_name` (`PROLIFIC <pid>`), `profiles.display_name`, and `external_meta.prolific_session_id` (a Prolific submission id, which re-identifies through the Prolific dashboard) | Promise 5 needs a deletion step. **Deleting it from the live DB is not enough:** the nightly offsite backup (`Normega/radlab-backups`, §29d) dumps `public` + `auth`, keeps dailies 30 days and **never prunes monthlies**, and copies rather than syncs. A PID written in clear text therefore survives indefinitely, which breaks "cannot be recovered by anyone". |
| G6 | **Non-consenters' PIDs are kept.** `auto-enroll` writes the enrollment *before* consent | REB §9: screening/non-participant information is not retained. Sandy Study 3 holds 21 such rows today |
| G7 | **Posting identity is not exported.** `external_meta.prolific_study_id` is stored but `studyExport.js` never reads it | Posting framing (general vs contemplative) is an analysis covariate in the Methods |
| G8 | **No partial-completion or reconciliation tooling.** No report lists "consented, did not finish, minutes spent" | Promise 4 (prorated pay), checking submissions before approval, and the trigger for de-identification |
| G9 | `?test=1` → `is_test` exists only on open-join, not `auto-enroll` | Test runs through the real Prolific preview must not count as participants |
| G10 | Repository Yes label is generic ("…(Borealis), as described above.") | Approved v3 wording is longer. Acceptable if the consent HTML carries the full text, but verbatim is safer |

## 0c. Problems in the approved documents (fix before launch, possibly by minor amendment)

1. **The debrief still says data go to the Open Science Framework (osf.io).** This contradicts the Borealis move and the *optional* deposit, and it is the last sentence every participant reads.
2. **One consent form and one debrief are written for Study 2.**
   - The consent describes the mood/anxiety screener and "attitudes toward mindfulness and body awareness". The debrief names FFMQ-15, MAIA-2 and PHQ-4, then states "All questionnaires you completed were exactly as described".
   - For Study 1, which gives none of these, both are inaccurate.
   - Consent also says "approximately 15–20 minutes" and "$3.60 for an estimated 18-minute session". Study 1 is ~45 items, likely **6–9 minutes**. Prolific requires an accurate time estimate, and the reward follows it.
3. **The debrief's resource list is a subset of the approved resource sheet.** It is missing Crisis Text Line, Shout, Pieta, the emergency numbers and findahelpline.com. The handoff says to show the full sheet. Both documents are approved, so the debrief page should carry the sheet in full.
4. **The debrief says "comparing practitioners and non-practitioners"**, while the Methods say practice is measured dimensionally. This is minor, but it is a description of the study.
5. **The SFS instructions read "describes you right now".** That is state wording on trait items ("Accessing the receptive mode has gotten easier for me over time"). Confirm it is intended. It is approved text, so changing it needs an amendment.
6. **The life-satisfaction format was left open.** The appendix says "1–7 *or* the 0–10 version, pick one". This has to be chosen before building.
7. **The race/ethnicity list was never specified** ("standard census-style categories"). The categories have to be chosen, and they must work across six countries.
8. `Prolific_Screening_Reference_Notes` (Rev2) is stale. It assumes Qualtrics and in-study screening, both superseded by the no-screening, two-posting design. Do not build from it.
9. Two copies of `REB_Application_Draft.docx` exist. The one inside `files.zip` (23:01) is later than the loose file (19:13) and lists the Round 2 and Addendum letters. They agree on everything that affects the build.

---

## 1. Decisions for Norm (each changes what gets built)

**Status 2026-10-09:**
- **D1 decided:** every item required, each with the small "Prefer not to answer".
- **D2 decided:** Norm is handling the amendment.
- **D4 decided:** use the platform's existing `life-satisfaction` scale. It has the approved wording, but its format is 6 emoji points (unhappy → delighted) where the appendix says 1–7 or 0–10, so it goes into the amendment. It also needs "Prefer not to answer" added to the VAS step, which has none today.
- **D3 decided (2026-10-09):**
  - Shuffle only the new scale's 32 items, in both studies.
  - The shuffle is **constrained, not plain random**: items from the same hypothesized facet must not clump.
  - Validity-scale items stay in published order.
  - The new scale always comes straight after the background questions. The five validity scales follow in random order.
  - Positions are recorded.
  - Facet key received 2026-10-09 (pool 4). The rules built on it are verified (see P1 below).
- **D5 decided:** the short international race/ethnicity list (a). Asian is split into East / South / Southeast, and Indigenous is broadened with examples for all six countries.
- **D6 decided (2026-10-09):** keep the Prolific ID, but in **one identity table** (Prolific ID → random study id). Every other row uses the random id. The offsite backup skips that table's data, so deletion after payment + 48 h is permanent. Supabase's own ~7-day daily backups are the only residue.
- **D7 decided:** two instructed-response checks. Study 1 has one among the 32 new-scale items. Study 2 has that one plus one inside MAIA-2. None in the short scales. Both go into Norm's amendment.

**P1 amendment: interleaved shuffle (rules verified 2026-10-09).**

The facet key comes from pool 4's Conceptual Mapping sheet. Pool 5 (`I:\Shared drives\SenseForaging\Assessment\MainQuestionnaire\receptive_state_item_pool_5.xlsx`) is the build sheet: platform ids, both wordings, construct, interleave cluster and the attention check.

Clusters:

| Cluster | Items |
|---|---|
| Action | 1, 6–9 |
| Practice | 2, 3 |
| Drift-awareness | 4, 13, 14 |
| View: core | 5, 10–12 |
| View: under stress | 16, 18 |
| Normalizing | 15, 17 |
| Completeness | 19–21 |
| Safety | 22–24 |
| Reward / Awe | 25–27 |
| View: openness | 28–32 |

Rules. There are 34 slots (32 items + the two checks) on pages of 9, 9, 8 and 8.
- Two items from the same cluster are at least 3 positions apart.
- The 11 View items are never adjacent.
- The flagged pairs 4–13, 16–18, 1–9 and 6–16 are at least 3 apart.
- No page carries more than 2 items from one cluster or more than 3 View items.
- The Disagree check sits in positions 3–16 (pages 1–2) and the Agree check in 20–33 (pages 3–4), never first or last on a page.

Method: a bounded random depth-first search with deterministic restarts, seeded per participant.

Prototype: `scripts/sense_foraging/interleave_prototype.py`, to be ported to JS with the same test. Results over 10,000 seeds:
- 0 failures, and every order re-checked against every rule;
- each item's mean position 15.0–17.1 (ideal 16.0);
- each item opens the scale in 2.4–4.3% of orders (ideal 3.0%).

**Wording DECIDED 2026-10-09:** pool 5 (= pool 4 "sensing / doing" wording + definition + `sfs_attn_1`) is what goes to ethics, and it is what `sf-sfs` already runs. The rest of this paragraph is history. Pool 3 is word for word the REB-approved v1.2 text. Pool 4 (Oct 2) is newer: "sensing / doing" in 20 items, item 10 changed in meaning, and a definition shown before the items. Running pool 4 means putting those changes in the amendment.

| | Decision | Recommendation |
|---|---|---|
| D1 | How "skip any question" is honoured | **Every item required, every item offers "Prefer not to answer"** (UTMAP's choice; already built). It stops accidental page skips and keeps declined (`pna`) distinct from blank. Applies to all ~118 items, demographics included |
| D2 | Study 1 consent/debrief accuracy (§0c.1–2) | Minor amendment: a Study 1 variant of both forms (battery, time, pay), the debrief's OSF line → Borealis, and the full resource sheet. Submit it now, and build in parallel |
| D3 | What gets randomized in Study 2 | Background first and fixed. Then **SFS + the five validity scales in random order per participant**. **SFS items shuffled; validity-scale items in published order** (keeps the validated formats; the REB text "item and scale order randomized/counterbalanced" is satisfied by the SFS shuffle plus scale-order shuffle). Alternative: SFS always first, so its context matches Study 1 |
| D4 | Life-satisfaction format | 1–7, "In general, how satisfied are you with your life?" (the appendix's primary item) |
| D5 | Race/ethnicity options for a six-country sample | Short international list, select-all: Asian (East / South / Southeast), Black, Hispanic or Latino/a/x, Indigenous, Middle Eastern or North African, White, Mixed or multiple, Other (specify), Prefer not to say. Needs your sign-off, since the REB doc defers to "standard" categories |
| D6 | How the Prolific ID is stored (§0b G5) | **Keyed hash at intake.** The platform never writes the PID in clear text. It stores `HMAC(secret, PID)`, with the secret only in Edge Function secrets, so it is never in a DB dump. Lookups (withdrawal email, partial pay) hash the PID first. After the 48 h window + payment, the hash is overwritten with a random surrogate. When data collection closes, the secret is destroyed, which leaves the backups' hashes unlinkable for good. The alternative is clear text plus an amendment to the retention wording to admit backup retention; that is weaker and needs REB contact |
| D7 | Attention checks | None are in the approved battery, and Prolific only lets you reject on its own approved check formats. Either (a) amend to add 2 Prolific-compliant instructed-response items, or (b) rely on declared quality criteria: completion time from `participant_step_timings`, long-string runs, reversed-item inconsistency. **Declare the criteria before data either way.** I lean (a) for an N≈1000 online factor analysis |
| D8 | Posting split | Equal places per posting (≈250 + 250 per study). The postings exclude each other on Prolific, and Study 2 excludes all Study 1 participants (Prolific "previous studies" filter) |
| D9 | Partial-completion pay mechanism | Confirm Prolific's current mechanism before launch: bonus to returned or timed-out submissions, or a "partial" completion code. **I could not verify Prolific's current UI from here.** The platform side (G8) is the same either way |
| D10 | Device restriction | Allow desktop and mobile. 5+-point Likert stacks vertically below 760 px, already verified for UTMAP |

---

## 2. Platform work (in deploy order)

Rules that apply throughout:

- Coupled schema and code go to `main` together. Frontend-only work goes to `dev` first.
- Stage explicit paths. Lint before every push.
- Add a migration-manifest row for every migration applied.
- Ship code before data that depends on it, and check the deploy landed by fetching the built JS from radlab.zone.

**P1 — Composable item randomization (G1).** Frontend only.
- New definition field `randomize_items: { pool: [component ids], per_page: n }`. The pooled items are shuffled and re-paginated.
- The shuffle is seeded from the link token, which the wrapper passes in, so a reload reproduces the order.
- Record the fact (rules 3–4): the stored responses gain `_presented_position: { sfs_01: 17, … }`. The exporter emits it as `<slug>_pos_<item>` columns, or keeps it out of the master and writes a sidecar. The column names come from item ids, never from position.
- Tests: seeded determinism, every item shown exactly once, positions recorded.

**P2 — Session step-order randomization for single-shot sessions (G2).** Frontend, plus one nullable column (main).
- `session_template_nodes.shuffle_group` (text, null = fixed). Contiguous nodes that share a group are permuted per participant in `SessionEntry`, seeded by the link token, so resume via `readProgress` still lines up.
- The presented order is already recorded: `step_index` sits on every response and `participant_step_timings` carries the activity per step.
- `responseColumns.js` suffixes only instruments repeated within a session, so a shuffled once-per-session instrument keeps its column name. Add a test to prove it.
- `StudySessionRunner` and `SessionDemoModal` ignore the shuffle; they are operator-run and demo views.

**P3 — Composable conditional components (G3).** Frontend.
- New `show_if: { component: 'bg_practice_regular', equals: 'yes' }`.
- A hidden component is excluded from `pageIsComplete` and stored as `'not_applicable'`. That gives a fourth code beside the value, `'pna'` and blank: skipped by logic ≠ declined ≠ missing.
- The validator checks that the referenced component exists and appears earlier.

**P4 — Consent decline (G4) and non-consenter cleanup (G6).** Frontend + migration (main).
- ConsentGate shows "I do not agree to participate" as an equal-weight bordered option (formal-buttons policy).
- On decline: a "You have chosen not to take part" screen with a button to `studies.decline_redirect_url`, the Prolific completion URL with a NOCONSENT code set in Prolific to request a return.
- A narrow `record_consent_decline` definer RPC **deletes the participant's enrollment and schedule rows**. Nothing about a non-participant is retained.
- A sweep removes enrollments that never consented, older than the link expiry. It covers people who simply close the tab.

**P5 — Prolific identity handling (G5, G6, G9, D6).** Migration + Edge Function + frontend (main). The biggest piece. Design as decided 2026-10-09: one identity table, deleted after payment.
- **`external_identities`** (study_id, external_id = the Prolific ID, surrogate, created_at): the only place a Prolific ID is ever written. RLS: no participant access; lab read; writes only through `auto-enroll` (service role) and the de-identification RPC.
- `auto-enroll`, for a study with `studies.separate_external_identity = true`:
  - looks the Prolific ID up in that table (re-entry and cross-posting dedupe still work);
  - on a new arrival, mints a random surrogate (`SF1-` + 10 random characters) and uses **only the surrogate** everywhere else: `study_enrollments.external_id`, the synthetic auth email, `user_metadata.display_name`, `profiles.display_name`;
  - keeps `prolific_study_id` (the posting, not the person) and **drops** `prolific_session_id`;
  - logs nothing containing the Prolific ID. Today one line logs `external_id` on exclusion-group refusals; it logs the surrogate instead.
- **Clean logs.** The Prolific study URL carries the IDs in the fragment: `https://radlab.zone/study/join#study_id=…&PROLIFIC_PID={{%PROLIFIC_PID%}}&STUDY_ID={{%STUDY_ID%}}`.
  - Browsers never send a fragment to the server, so the Prolific ID never reaches Vercel's or Supabase's request logs. It travels only in the `auto-enroll` POST body, which is not logged.
  - `StudyJoin` reads the fragment (the query string still works for SONA) and clears it with `history.replaceState`.
  - **Verify with Prolific's preview that it substitutes placeholders inside a fragment.** If it does not, keep the query string and note Vercel's log retention instead.
- **Offsite backup** (`Normega/radlab-backups`): `pg_dump --exclude-table-data=public.external_identities`. The table's shape is backed up; its rows never are.
- **`?test=1`** (or `test=1` in the fragment) marks the enrollment `is_test` (port of `49f9d93`).
- **`deidentify_external_enrollments(study_id, before)`** (lab-only RPC):
  - **refuses** rows completed less than 48 h ago;
  - deletes the matching `external_identities` rows (after this the Prolific ID exists nowhere we hold, apart from Supabase's own ≤7-day snapshots);
  - stamps `study_enrollments.deidentified_at`;
  - also deletes the identity rows of anyone who never consented or who declined (REB §9: nothing kept about non-participants), whatever their age.
- Deploy from an up-to-date `main` only (the stale-checkout revert of 2026-10-07).

**P6 — Export (G7).** Frontend.
- Master gains `prolific_study_id`, plus a `posting` label from a per-study map (`studies.external_meta_labels` or an export setting: `{ "<prolific study id>": "general" }`). The label is applied from recorded ids, never inferred.
- Also export `deidentified_at`.

**P7 — Prolific reconciliation panel (G8).** Frontend (lab-only, reads only).
- On the study page: completed / consented-not-finished (with minutes from `participant_step_timings`) / declined.
- Input: paste PIDs from the Prolific dashboard. The panel hashes them in-browser with a lab-held key only if D6 allows that; otherwise lookups go through a lab-only Edge Function that holds the key.
- Output: approve list, partial-pay list with prorated amounts ($0.20/min), and "unknown to platform" (possible code sharing → do not approve).
- Then the de-identify button (P5).

**P8 — Repository label (G10).** Frontend, small. A per-study override of the Yes/No labels so the approved v3 wording shows verbatim.

Verification for each piece:
- jsdom click-through of the real components (handoff §4).
- `npm test`, `npm run lint`, `npm run audit:design:check`, `npx vite build`.
- Rolled-back SQL probes for each RPC.

---

## 3. Content build (after P1–P3 are live)

Generate every definition from a script kept in the repo (`scripts/sense_foraging/build_questionnaires.mjs`, with JSON beside it). It should run `validateComposableDefinition` plus a policy check: every answerable item required and declinable, and ids unique. After loading, verify `definition = '<json>'::jsonb` against the file.

New slugs, prefix `sf-`. Never reuse or edit a slug another study runs:
- `brief-maia-2` is a 24-item brief form and the wrong instrument.
- `phq-4` is a legacy one-item-per-screen definition.
- `utmap-phq4-self` belongs to UTMAP.

| Slug | Content | Stored coding | Notes |
|---|---|---|---|
| `sf-background` | Approved Background Q1–Q13 | as listed; `pna`, `not_applicable` | Age and practice years as numeric `response_type: number` options + PNA. Country: the six recruitment countries + Other (specify) + PNA (Prolific already verifies country). Q6 Yes/No/PNA gates Q7–Q10 (`show_if`). Gender self-describe uses an option text box. Religious tradition: single select |
| `sf-sfs32` | 32 items, v1.2 wording verbatim, instructions verbatim | 1–6, all points labelled | `randomize_items` over all 32, 8 per page. Ids `sfs_01`…`sfs_32` = item-pool numbering, fixed forever |
| `sf-ffmq15` | Baer et al. 2012, published order | 1–5 | Reverse items: 3,4,7,8,9,13,14 |
| `sf-maia2` | 37 items, published order | **0–5** | "Circle one number" → "Select" (format, not content). Reverse items: 5–12, 15 |
| `sf-lifesat` | per D4 | 1–7 (or 0–10) | |
| `sf-phq4` | Kroenke 2009 | **0–3** | Not scored on screen and no feedback (promise 7) |
| `sf-bidr16` | Hart et al. 2015 | 1–7, labels at 1/4/7 | Reverse: 1,3,5,8,9,11,12,13 |

Write the coding table into the analysis repo and check it against the scoring code before launch. UTMAP's 0–3 vs 1–4 mix-up came from identical-looking labels.

Studies (two platform studies, one per protocol study, since batteries and debriefs differ):

```
SF Study 1 — EFA     online_single, no design_graph
SF Study 2 — CFA     online_single, no design_graph
  allow_external_enrollment = true, external_enrollment_source = 'prolific'
  consent_required = true, active consent/debrief forms (Study-specific per D2)
  offer_repository_consent = true, hash_external_id = true (D6)
  completion_redirect_url = https://app.prolific.com/submissions/complete?cc=<CODE>
     (set the SAME custom completion code on both postings of a study)
  decline_redirect_url = …?cc=<NOCONSENT code>
  reminders off; open_email_after_consent false; no contact-email gate (not longitudinal)
Session template S1: sf-background → sf-sfs32
Session template S2: sf-background → [shuffle_group "battery": sf-sfs32, sf-ffmq15, sf-maia2,
                     sf-lifesat, sf-phq4, sf-bidr16]   (per D3)
Debrief HTML = approved debrief (D2-corrected) + full Mental Health Resources sheet
```

The consent HTML is the approved v3 text verbatim, including "Future use of your data". The checkboxes are rendered by ConsentGate, not by the HTML.

---

**Trap found on the draft (2026-10-09).** A `study_sessions` row with `send_time` NULL breaks every Prolific/SONA join on a single-shot study:
- `auto-enroll` §6b copies `send_time` into `participant_schedule.send_time`, which is NOT NULL;
- by then the enrollment row is already created, so the participant sees "Failed to create session schedule" and is left with an enrollment and no link.

Set `send_time` on the real studies' sessions. Better, have §6b default it, since open-join studies such as UTMAP leave it null and nothing in the admin UI requires it.

**Draft study live (2026-10-09):** "Sense Foraging Study 2 (DRAFT, pool 4 wording)", `fe7eb24e-c4c0-43ae-87c4-e55e7314d411`, built by `scripts/sense_foraging/build_draft.py`. Test enrollments are `SFDRAFT-NORM-*` and are marked `is_test`. After review: turn joining off and set the study `active = false`.

**Study 1 created (2026-10-09):** "Sense Foraging Study 1 (EFA)", `74cb6aa5-857c-408e-adfa-a5556acd62b7`.
- Content: `sf-background` ("About you") → `sf-sfs` ("How you pay attention", pool 4 wording, seed-12345 order + `sfs_attn_1`) → debrief.
- It was copied server-side from the reviewed draft rows; item ids were verified identical to the draft.
- Consent and debrief are still the approved v3 / debrief texts under a DRAFT banner, until Norm's Study 1 amendment text arrives.
- Test enrollments are `SF1-NORM-*`, marked `is_test`.

Before Study 1 can go on Prolific (Study 2's scale-order shuffle, P2, is **not** needed for it):
1. P1, the per-participant interleaved shuffle. Ship the code first, then add the `randomize_items` block to `sf-sfs`.
2. P3, background branching (then drop the "Draft note" component).
3. P4, the "I do not agree" button + NOCONSENT return code.
4. P5, the Prolific-ID identity table, de-identification and `?test=1`.
5. P6, the posting column in the export.
6. The amended Study 1 consent/debrief replace the forms, and the banners go.
7. Prolific completion code → `completion_redirect_url`.
8. A 20-person pilot to set the time estimate and reward.

P7 (reconciliation panel) can start as manual SQL. A `send_time` default in `auto-enroll` §6b is a safety net for later studies; Study 1's session already has one.

## 4. Verification before any real participant

1. **Consent-as-checklist.** Walk every sentence of consent and debrief against the running study, and record the evidence for each in this file:
   - every item declinable;
   - decline works;
   - deposit question separate and required-to-answer;
   - no scores shown;
   - resources visible to all;
   - return to Prolific with the right code.
2. **Real Prolific preview link** (not hand-typed), with `?test=1`, on a phone and on a desktop. Check:
   - join → consent → deposit question → every page → debrief → Prolific;
   - reload mid-questionnaire and mid-battery (order must be identical after the reload);
   - the decline path;
   - the placeholder-refusal path.
3. **Export dry run on ~10 test participants:**
   - column names come from item ids;
   - `_presented_position` and step order are recoverable;
   - `pna` / `not_applicable` / blank are distinct;
   - `posting`, `repository_consent` and `is_test` are present;
   - `_export_integrity.csv` is clean.
4. **De-identification probe on a test enrollment:**
   - the 48 h refusal fires;
   - the surrogate replaces all five PID locations (G5);
   - the export join still holds.
5. RLS audit query (CLAUDE.md) and response-table audit query both return nothing.

## 5. Running it

1. **Pilot.** Study 1, ~20 places on the general posting.
   - Measure median time, and set the real time estimate and reward ($12/h).
   - Run the export and a reconciliation cycle end to end.
   - Pilot the Study 2 battery (~118 items) the same way. If it runs past 20 minutes, the consent's time estimate is wrong.
2. **Launch in batches** (places released in steps, as Sandy Study 3 did). Watch the first hour: enrollments, consents, completions, and the edge logs for `auto-enroll` errors.
3. **Daily cadence:**
   - reconcile Prolific submissions against the panel (P7);
   - approve, and pay partials;
   - after 48 h, run `deidentify_external_enrollments` for that batch;
   - log each batch (date, n approved, n partial, n de-identified).
   - Withdrawal emails within 48 h: look the Prolific ID up in `external_identities`, delete that participant's responses, record the withdrawal.
4. **Study 2** launches after Study 1 closes (CFA tests the EFA structure). Prolific excludes all Study 1 participants. Preregister the CFA model and the quality-exclusion criteria from Study 1 first.
5. **Close each study:**
   - set `active = false`, plus the CLAUDE.md "disabling a study" steps;
   - confirm `external_identities` has no rows for the study;
   - then follow §5a (freeze the shareable file, then purge the raw rows).
6. **Borealis deposit and sharing on request:** only the §5a shareable file, and only its `repository_consent = true` rows. Files restricted, with the approved Terms of Access text, and the DUA signed before any release.

## 5a. De-identification and the shareable dataset (decided 2026-10-09)

**The goal (Norm, 2026-10-09):** once a participant is paid and their 48 h withdrawal window has closed, nobody, including us under a court order served on Prolific, can link their answers back to them. The dataset must be fit to share with other researchers on reasonable request.

**Why deleting the Prolific ID is not enough.** Prolific keeps, per submission, the Prolific ID, the start and finish times, the **time taken in seconds**, and the profile it verified (age, country, and the demographics participants chose to give it). Any of those, matched against what we hold, can re-link a row. So the scrub removes exact times, exact durations and rare demographic combinations, not just the ID.

**Timeline**

| When | What | Where it runs |
|---|---|---|
| Arrival | Prolific ID written only to `external_identities`, through the URL fragment (no server log). Everything else carries the surrogate. | `auto-enroll` (P5) |
| ≥ 48 h after completion **and** payment approved | `deidentify_external_enrollments`: the identity row is deleted. From here the only bridge to a person is Prolific's own records (times, durations, profile). | lab RPC (P5), per batch |
| Decline / never consented | Identity row deleted at the next batch run, whatever its age. | same RPC |
| Study closed, data frozen | Produce the **shareable file** (below), verify it, store it (lab Shared Drive + checksum). Then `purge_study_data(study_id, <study name typed out>)` deletes the raw rows, the step timings and the accounts that exist only for this study. | `scripts/sense_foraging/deidentify.py` (to build) + existing `purge_study_data` |
| After purge | Supabase's own daily snapshots age out in ≤ 7 days. **Offsite backups still hold the raw rows (never the Prolific ID).** See the open decision below. | — |

**The shareable file: what the scrub does**

1. **Participant id:** a fresh random id per row (`SF1-0001`…), assigned in shuffled order. Not the surrogate, not `profile_id`, nothing that exists in the database or the backups.
2. **Time:** every timestamp is dropped: enrolled, consent, completed, received, step entered/exited.
   - Kept instead: `wave` (study + calendar month of collection, e.g. `S1-2026-11`) and `minutes_total`, rounded to whole minutes and top-coded at 60.
   - Per-instrument minutes are rounded the same way and top-coded at 30. Prolific's time taken is in seconds; a whole-minute value with no date leaves dozens of matches per value.
3. **Quality flags, computed from the exact times before they are dropped**, per the criteria preregistered before data collection:
   - `attn_failed` (0–2 Sense Foraging checks failed; **2 = excluded from analysis**), `attn_maia_pass` (Study 2);
   - `speeder` (median seconds per item below the declared floor);
   - `longstring_max` (longest run of identical answers);
   - `pna_count`.
   The exact times needed to recompute them are not shared and are purged at close.
4. **Free text:** every "Other / please specify / self-describe" answer is read by a lab member, recoded into an existing category or `other`, and **never shared raw**. A rare country or a self-description can identify someone.
5. **Quasi-identifiers:** age in 5-year bands, top-coded at 75+.
   - Then check that every combination of age band × gender × country × race/ethnicity (collapsed) × education occurs at least **5 times** in the file.
   - Where it does not, coarsen in this order until it does: education → race/ethnicity (to broader groups) → country (to "Other") → age (to 10-year bands).
   - The script reports what it coarsened and how many rows each step touched.
6. **Posting:** `general` / `contemplative`, mapped from the recorded Prolific study id (P6). The Prolific study id itself is dropped.
7. **Kept as is:** item answers (`pna`, `not_applicable` and the attention checks included), presented positions (`…_pos_NN`, random per person and not identifying), consent to deposit.
8. **Rows:** test enrollments, withdrawals and decliners are removed. A second file, `…_shareable_depositable.csv`, keeps only `repository_consent = true`. **That is the only file that leaves the lab**, whether to Borealis or to a researcher on request (both under the DUA). The other is for the lab's own analysis.
9. **Proof:** the script writes `_deidentification_report.csv`: row counts in and out, each coarsening step, the smallest combination size (must be ≥ 5), and a scan showing no column holds a timestamp, a surrogate or a profile id.

**Open decision (Norm): offsite backups.** The nightly offsite dumps never contain a Prolific ID (P5 excludes that table), but monthly dumps are kept forever and will hold the raw rows, with exact timestamps, from the collection months. With a court order served on Prolific and access to those dumps, a determined party could still match times. Options:
- (a) accept it and say so in the security document;
- (b) when a study closes, delete or re-dump the offsite monthly snapshots that cover its collection months. This affects every study's backups for those months, so it would be done once both Sense Foraging studies close and only after a fresh full dump exists.

Recommended: (b).

## 6. Size of the work

- P1–P3 and P6–P8 are frontend: roughly 2–3 sessions including tests.
- P4–P5 touch consent, auth and an Edge Function on the production backend: 1–2 careful sessions with rolled-back probes.
- Content and verification: 1–2 sessions.

The amendment (D2, plus D6/D7 if chosen) is the likely critical path, not the code.
