# Dana CHM135 study — follow-ups and open issues

Working tracker for the requests that came out of Dana's attributional-dynamics
study build (CHM135, recruiting Fall 2026), plus the platform defects that build
surfaced. Started 2026-09-02.

Status key: **done** · **in progress** · **specced** (decisions made, not built)
· **open** (needs a decision).

---

## 1. Self-enrollment from a Quercus announcement — **built 2026-09-03, needs a live walkthrough**

Shipped: `/study/signup?study_id=…` (consent, then identifiers) and
`/study/verify?token=…`, Edge Functions `study-signup` and
`study-signup-verify`, migration `20260903_self_enrollment.sql`, and a
Self-enrollment panel on the study admin page carrying the copyable link.

**Nothing is publicly joinable until `allow_self_enrollment` is turned on for a
study** — it defaults false, and that flag is the master switch.

**Verified live (2026-09-03)**, against the TESTING AGAIN study with the flag
temporarily on and a request row inserted directly so no mail was sent:

- the confirmation click created exactly ONE enrollment, and a second click
  returned the SAME session token rather than enrolling again;
- `external_id` came out as `self-775ec213…` and the auth address and display
  name (`Self-enrolled 775ec213`) carry no readable identifier, while
  `contact_email` and `student_number` sit on the enrollment;
- `consent_date` recorded the time consent was actually given, not the click;
- the schedule materialised (3 rows for her 3 sessions), one active link, and
  `get_session_by_token` resolved it to the 18-step baseline;
- the request row's identifiers were cleared on success;
- the flag being off refuses sign-up, and a nonexistent study gets the
  identical refusal, so the endpoint does not reveal which studies exist.

That pass also caught a real bug — `study_enrollments.external_source` had its
own CHECK constraint enumerating only sona/prolific
(`20260903_self_enrollment_source_value.sql` fixes it). The failure behaved
correctly: the claim released, the payload stayed intact, and the same token
worked on retry. All test data was removed afterwards and the flag reset.

**Still not done: a human walkthrough of the two halves a browser owns** — the
sign-up page itself, the delivered email, and the click through to session 1.
Sessions cannot reach the site through the egress proxy, so someone has to do
this before Dana recruits.

Deliberately out of scope for now: **studies with a screener are refused** with
a clear message rather than silently skipped. Anonymous screening would have to
run before any participant row exists and buffer to the request row; skipping it
would enroll people the protocol excludes. Dana's study has no screener.

### Original spec and decisions (kept for the record)

Dana wants an announcement link that takes a student to the baseline survey and
signs them up on the way in.

**Not** doable as survey questions: answers land in `instrument_responses.response`
as JSON, which gives no deduplication, no account to attach sessions 2–3 to, no
way to email the next session link, and buries an identifier in response JSON.

**Hazard to avoid.** Do not post `/study/join?study_id=…&id=…` publicly. That is
the SONA/Prolific entry point and `id` *is* the participant identity. Enrollments
are uniquely indexed on `(study_id, external_id)` and `auto-enroll` returns the
existing link on a repeat, so every student clicking one static link collapses
into a single shared participant account and a single shared session token — and
that token is a credential (`/s/:token` exchanges it for a real Supabase
session). Students would read and overwrite each other's responses.

### Decisions taken (Norm, 2026-09-03)

- **Domain**: restrict to U of T. Use the academic side's existing normaliser
  (`normalize_uoft_email`), which collapses `utoronto.ca` / `mail.utoronto.ca` /
  `alum.utoronto.ca` to one key — a literal `mail.utoronto.ca` check would reject
  a student typing their own bare `@utoronto.ca` address. Open sub-questions:
  exclude `alum.` for a current-student study, and strip `+tags` (the academic
  normaliser deliberately does not, but here the normalised email *is* the
  dedup key, so `+1`, `+2` is a one-line way to enroll repeatedly).
- **Identifiers**: email and student number live together on the enrollment row,
  everything else joins by uid. `study_enrollments` is already that table
  (`contact_email`, `external_id`), and `studyExport.js` already omits
  `contact_email` from its explicit select — keep `student_number` out the same
  way.
- **`external_id` must stay opaque.** `auto-enroll` builds the synthetic auth
  address from it *and* sets `user_metadata.display_name` to
  `"<SOURCE> <external_id>"`, which `handle_new_user` copies to
  `profiles.display_name` — the name shown in the dashboard, nav and admin lists
  and used by `send_message` to address outgoing mail. Existing rows read
  `SONA 1232`. A raw email there would spread the identifier to four places.
  Use a deterministic hash of the normalised email so the unique index still
  dedupes re-clicks.
- **Email verification required** — a typo must cost a dead signup-request row,
  not a ghost account with a materialised schedule.
- **Order: screener → consent → identifiers → enrollment.** Consent before any
  identifiable data.

### Implications of that order

Screener and consent currently run *inside* `/s/:token`, which presupposes an
enrollment. Running them first means both happen with no participant row in
existence. There is a precedent (screener answers are buffered pre-consent and
flushed after), but it uses `sessionStorage` keyed by `participant_id` — and
**the email round-trip breaks any client-side buffer**, since a student can fill
the form on a laptop and click the link on their phone. The buffer must be
server-side on the signup-request row and replayed at the verified click.

`consent_date` should record when consent was actually given, not when the email
link was clicked.

### Build shape

New `study_signup_requests` table (email, student number, token, 24h expiry, IP
hash, buffered screener/consent) → verification email → public verify route
consumes the token once and only then creates the account, enrollment
(`contact_email` + `student_number`), schedule and session link.

Reusable: `renderClassVerifyEmail` (`_shared/classVerifyEmail.ts`), the salted
IP hasher and the `enrollment_attempts` table from `auto-enroll` (already
study-scoped, no migration), `RESEARCH_REPLY_TO`. Template to follow:
`send-class-verification-email` + `verify_utoronto_email` (app-owned token with
its own expiry), not the GoTrue magic-link path.

Invariants to carry over: never return the token in the HTTP response; enforce
"enrolled is earned by clicking the link, not assigned" in SQL.

Leave `auto-enroll` untouched — gate on a new `allow_self_enrollment` flag
rather than branching a function live for three other studies. Unifying the two
into one shared enrollment helper is a good follow-up, not launch work.

---

## 2. Open text component — **done** (2026-09-03, commit `1c089d8`)

New composable `open_text` type, single-line or paragraph via a `multiline`
toggle, optional word floor/ceiling. Migration `20260903_open_text_instrument.sql`
applied live. Chemistry course wanted the same component.

Outstanding: the admin pages sit behind lab auth and have not been click-tested
by a signed-in user.

---

## 3. Consent and debrief timing — **partly done**

- **Consent already behaves as Dana wants** — it is a gate keyed on
  `study_enrollments.consent_date`, so it fires once, before the first session
  opened, and never again. The checkbox label "Require consent before sessions"
  is what misleads; it means "before starting", not "before each session".
  *Open (small): relabel it and add helper text.*
- **Caveat worth telling researchers**: participants added through the admin
  Enrollment panel get `consent_date` stamped at enrollment, so they never see
  the consent form at all.
- **Debrief is not automatic and currently reaches nobody in Dana's study.** It
  renders only where the "Debrief Form" activity is placed in a session
  template; her three templates have none, and all end on the mental-health
  resources display. *Action for Dana: add it as the final step of
  `Dana Attribution Dynamics - Term Test 2 - CHM135`.* Note her two studies
  **share the same three template rows**, so the edit affects both.
- Nothing enforces "last session only" — correctness is by placement alone, and
  a template carrying a debrief node but no uploaded form silently shows
  placeholder copy to real participants. *Open: a `debrief_required` flag that
  auto-appends to the final session would need `get_session_by_token` to expose
  a session ordinal, which it does not today.*

---

## 4. Several questions on one page — **open (decision)**

Dana's Term Test 2 session has 40 steps (11 numeric sliders, 10 Likert sliders,
10 multiple choice, 2 hierarchies, 1 open list, 2 displays, 4 questionnaires) —
40 submit clicks.

The two routes solve different halves and are complementary:

- **Expand assessment packages** to hold composable instruments. Cheap: `items`
  is untyped jsonb with no constraint, so **no migration** — one query and one
  branch each in `VasPackageBuilder` and `VasStepWrapper`, plus the easy-to-miss
  fixes in `SessionBuilder.jsx` (`pkgContentsMap` has two hardcoded id buckets)
  and `displayDeps.js`. Gives fewer *session-builder nodes*, but packages render
  one item per screen, so it does **not** reduce submit clicks.
- **Port Dana's questionnaire builder** (in her handoff package, never ported:
  `ComposableQuestionnaireBuilder` + `PageEditor` + `ComponentPicker` +
  `ComponentEditor` + per-type editors + CSS, ~13 files). Composable
  questionnaires **already render several components on one page with a single
  Continue, in production today** — the only missing piece is a GUI to author
  them. This is the cheap route to fewer clicks.

Caveat: authoring as a questionnaire changes where data lands
(`questionnaire_responses`, keyed by component id) rather than one
`instrument_responses` row per instrument. It would not retroactively help the
87 steps Dana has already built without re-authoring them. Recommendation: port
the builder for future studies, let her current study run as built.

The one thing composable pages cannot do is emoji VAS scales (no registry
component). If a page must mix VAS with composable items, the smaller job is
porting VAS in as an eighth component type, not porting one-page rendering into
packages.

Also: packages have no edit page either — create and delete only.

---

## 5. Editing and deleting instruments — **done** (2026-09-03, commit `1c089d8`)

Library was insert-only, which is why one study build produced four generations
of the same question (`x` → `new_x` → `newnew_x` → `tt2_x`), all live in the
picker. Edit and Delete added, guarded on responses and session usage.

Outstanding: Dana's existing duplicates still need clearing — she should say
which to keep. As of 2026-09-03 there were 61 instruments and only 9 with any
responses, so most are freely deletable.

---

## 6. `instrument_responses` missing from the data export — **done** (2026-09-03)

Composable instrument responses were written from the day the integration
shipped and read back by nothing — the table appeared in no export registry, so
every Likert slider, multiple choice, hierarchy, open list and open text answer
was unexportable through the platform. The last unfinished item of the
2026-08-25 integration, and launch-blocking for Dana's study.

Now registered under a new **Instruments** category, and spread into the
participant-level master by `instrumentWideByProfile`. Timepoints are named from
the recorded `schedule_id` → session label (`oer1_baseline`,
`oer1_chm_term_test_1`); a row with no schedule link falls back to `_x<n>`
rather than inventing a timepoint. Rows whose schedule belongs to another study
are dropped, as the VAS block already does.

Flattening lives in `src/lib/instrumentColumns.js` (pure, 23 tests in
`instrumentColumns.test.mjs`). The one case needing the instrument definition is
multi-select: a response records only the options CHOSEN, so without the option
list an unselected option is indistinguishable from one never offered — the
definition turns that into an explicit 0.

Still open: `questionnaireWideByProfile` spreads `responses` keys into columns
assuming scalars, so a composable QUESTIONNAIRE carrying `open_text_list` or
`hierarchical_belief` components would emit JSON blobs rather than flat
columns. That path is unused today (no composable questionnaires exist) but
would matter the moment the builder in item 4 ships.

---

## Smaller defects found along the way — **all fixed 2026-09-03**

- **`QuestionnaireUpload` crashed on a valid composable upload.** Its success
  summary read `parsed.items.length`; a composable definition has `pages`, not
  `items`, so a definition that *passed* validation threw while rendering the
  "✓ Valid" panel — making the only authoring path for multi-question pages look
  broken at the last step. Now branches on the definition shape. Verified in a
  harness driving the real component: composable reads "2 pages · 3 components",
  legacy is unchanged at "2 items · auto_advance: on". `QuestionnairesPage` had
  the same assumption optional-chained, so it never threw but reported every
  composable questionnaire as "? items"; it now counts components.
- **`VasLibraryPage` deletes never checked the `activities` error**, so a
  constrained delete failed silently and removed the library row anyway, leaving
  a picker entry pointing at a scale that no longer existed — which a session
  would then fail on at runtime. All three mutations now go through one
  `deleteActivityRow` helper that throws with a readable message, the library
  row is deleted only if it succeeds, and the error is displayed (it was
  previously thrown into a mutation nothing rendered).
- **~~RLS asymmetry between `activities` and `composable_instruments`~~ — this
  was mis-diagnosed.** `profiles.role` is CHECK-constrained to
  `('lab','participant','public')`, so the `'admin'` in
  `my_role() = ANY (ARRAY['lab','admin'])` can never match: the state described
  (an admin who can create an instrument but not its picker row) cannot occur.
  The platform's real elevated-privilege mechanism is `profiles.super_admin` via
  `is_super_admin()`, which every comparable policy uses. The two outliers
  (`composable_instruments`, `displays`) were rewritten to that shape — a no-op
  today, since the single super admin already holds `role = 'lab'`, but the
  policy no longer implies a permission model the database cannot express.
  `activities` was deliberately **not** widened: doing so on the strength of a
  dead branch would have added real dead code.
- **Roster join's IP hash was unsalted** (`api/roster-join.js`) where
  `auto-enroll`'s is salted with a comment noting the IPv4 space is small enough
  to brute-force. Now salted (falling back to the service key, so no new env
  var), reads the same three headers auto-enroll does, and stores `null` rather
  than a hash of the empty string when there is no client IP — previously every
  IP-less request shared one constant hash, which in the staff triage list looks
  like a single prolific abuser. Rows logged before this hold short unsalted
  digests and will not group with new ones; nothing joins on the value.
