# Scope: linking a check-in to the adherence rule that governs it

**Status:** scope only, nothing built. Written 2026-07-27 after the
missed-session copy was found to assert a rule the system doesn't apply
uniformly (see website.md §28, "Missed-session copy corrected for accuracy").

**Problem it solves.** Adherence rules are per-study `adherence_check` nodes
inside `studies.design_graph`. Participant-facing copy is global constants in
shared code. Nothing connects them, so a string can claim something false for
one study and true for another, and nothing catches it. Live proof: the
reassurance "missing doesn't affect your standing" was false for the two
Liliana studies (10-of-12 enforced, 21 active participants) and true for Zerin
(no `adherence_check` node at all, 9 active) — and Zerin is the 3×/day study
where the missed-session line fires most.

---

## 1. Two candidate linkages — pick (b)

**(a) Graph-downstream.** For a session node, walk forward through the graph to
the first reachable `adherence_check`. Answers "which gate decides whether this
participant continues past here."

**(b) Counted-toward.** Whether completing this session increments a given
check's counter. Answers "does missing *this one* move me toward withdrawal."

**(b) is the one copy needs**, and it's also the cheaper one: it's a plain join,
no graph walk.

```
participant_schedule.study_session_id
  → study_sessions.session_template_id
  → session_template_nodes.module_id          (text slug, e.g. 'reappraisal-phase2-day11')
  → intervention_modules.module_id → .phase   (text, e.g. 'phase2')
  → design_graph adherence_check node WHERE node.phase = that phase
  → { min_required, of_total }
```

Verified end to end against live data — Liliana phase1 resolves to
`min_required: 10`, phase2 to `min_required: 10`, and studies with no
`adherence_check` resolve to empty.

They do **not** coincide. `countCompletedPhaseDays` (materializeSchedule.ts:146)
counts by module phase, not by graph position — so (a) would produce a linkage
the enforcement code doesn't actually use.

---

## 2. Findings that change the design

**2.1 — `of_total` cannot be derived by counting.** Counting `study_sessions`
rows per phase gives **36** for Liliana phase2, but the authored rule says
`of_total: 12`. `fullTraversal()` deliberately emits every node on every branch
(3 randomize arms × 12 sessions) because different participants land on
different nodes; no individual does 36. **The authored node value is the only
correct source.** A naive "derive it from the schedule" implementation would
tell participants "10 of 36" — exactly the class of error this work exists to
prevent.

**2.2 — the counting rule is hardwired to one study's schema.**
`countCompletedPhaseDays` reads `liliana_participants` → `liliana_day_data`, so
it returns 0 for any study without those rows. A `governing_adherence` column on
a non-Liliana study would describe a rule that could never actually fire.

> **Decided 2026-07-27 (Norm):** generalize it to all studies, with the entire
> study counting as one phase when phases aren't specified. This removes the
> `enforced: false` case from §3 — an authored rule becomes a real rule
> everywhere. See §2.6 and §2.7 for what that decision costs.

**2.6 — the generic count is NOT equivalent to the current one; it is stricter.**
Counting completed `participant_schedule` rows (joined to phase via
`session_template_nodes.module_id`) was compared against the live
`liliana_day_data` count for all 17 participants with phase1 data: **14 agree, 3
disagree, and `participant_schedule` is never higher.**

| `liliana_day_data` | `participant_schedule` | passes today (≥10) | passes after change |
|---|---|---|---|
| 8 | 6 | no | no |
| 8 | 6 | no | no |
| **10** | **9** | **yes** | **no** |

The third row is an actively enrolled participant who currently passes and would
be **withdrawn and sent a termination email** the first time the advance pass ran
after the switch. So this is not a refactor — it is a change to who stays in the
study, and it must not ship as a side effect.

The two sources genuinely measure different things (a module can carry
`completed_at` in `liliana_day_data` while its schedule row never reached
`completed`); which one is *correct* is a research decision, not a technical one.
Options: investigate and reconcile the discrepancy first; grandfather everyone
currently enrolled at their present count; or run the new count in shadow mode
and log disagreements for a week before it becomes authoritative.
**Recommended: shadow mode**, since it also validates the generic count against
Liliana before any other study depends on it.

**2.7 — "days" vs "sessions" stops being the same thing.**
The function is `countCompletedPhaseDays` and Liliana runs one session per day,
so day-count and session-count coincide there. Under "the whole study is one
phase", Zerin's 3-check-ins-per-day schedule breaks that: counting schedule rows
counts *check-ins*, so a 30-day study yields ~90, and a threshold authored as
"10" would mean something its author didn't intend.

> **Decided 2026-07-27 (Norm): sessions, always.** Adherence is adherence to the
> laid-out schedule, so the unit is invariant to cadence. Costs nothing for the
> live studies — see Q4 for the verification and the three implementation
> consequences.

**2.3 — the enforced threshold can differ from the authored one.**
`min_required` and `of_total` are optional on the node, with `?? 10` and `?? 12`
defaults in materializeSchedule.ts:338-339. A graph omitting them enforces 10/12
while storing nothing. Either the compile step must persist the resolved
defaults, or the defaults must move into the graph at authoring time.

**2.4 — every join in the chain is by string, none by FK.**
`session_template_nodes.module_id` is a text slug (uuid vs text — a direct join
to `intervention_modules.id` errors), and `adherence_check.phase` matches
`intervention_modules.phase` by string equality. Nothing prevents a typo'd phase
from silently resolving to "no rule".

**2.5 — compile is client-side.** `toSlots()` / `fullTraversal()` live in
`src/lib/experimentGraph.js`, run in ExperimentBuilder, and delete-and-reinsert
`study_sessions`. So a new column is only populated for studies someone
re-saves — existing rows need a deliberate backfill.

---

## 3. Proposed design

Add `study_sessions.governing_adherence jsonb` (nullable), written by `toSlots()`
at compile time:

```jsonc
// session that counts toward a rule
{ "phase": "phase1", "min_required": 10, "of_total": 12, "enforced": true }
// session in a study with no adherence_check
null
// authored rule exists but can't be enforced (see 2.2)
{ "phase": "phase1", "min_required": 10, "of_total": 12, "enforced": false }
```

`enforced` is the honesty flag from 2.2 — copy keys off it, so a study with an
authored-but-inert rule doesn't threaten participants with a withdrawal that
cannot happen.

Copy then becomes a function of the row rather than a constant:

| `governing_adherence` | missed-session line |
|---|---|
| `null` | "Missing a session doesn't affect your standing in the study" (true here) |
| `enforced: false` | current hedged wording |
| `enforced: true` | "…you've completed N of the M sessions this phase needs" |

---

## 3a. Agreed sequence (2026-07-27)

Two phases, deliberately separate, because only the first can hurt anyone:

**Phase A — shadow-mode the generic counter.** Generalize
`countCompletedPhaseDays` → `countCompletedPhaseSessions` (whole study as one
phase when unspecified; count the participant's own completed schedule rows, in
sessions), compute it *alongside* the existing count, log disagreements, change
no enrollment outcome. Review the logged disagreements before Phase B.

Phase A must settle **two** predicates, not one — §2.6 (which completions count:
`liliana_day_data` vs schedule rows, errs toward withdrawing) and §2.8 (which
*sessions* count: all vs daily-only, errs toward retaining). They are
independent and each has live participants sitting on the boundary, so the
shadow log needs to record both counts separately rather than one combined
number.

**Phase B — the audit hook.** Add `governing_adherence`, resolve it at compile
time, and add a test asserting participant-facing copy — and consent text (Q6) —
against it. The hedged string itself stays identical for every study, so this
phase cannot change what any participant sees; it only fails a build when a
claim stops matching the rules.

**Phase C — the progress display.** "So far, you've completed x out of y (%) of
your scheduled check-ins", universal, with the threshold stated where one
exists. `y` is elapsed sessions; suppressed below ~3 elapsed. This is the only
phase with a participant-visible surface, which is why it is last.

> **Partially shipped ahead of Phase A, 2026-07-29** — the *descriptive half*
> only: `So far, you've responded to 5 out of 6 check-ins (83%).`
> (`progressSentence` in `emailTemplate.ts`, `checkInProgress` in
> `send_message`). Norm asked to start experimenting while the cohort is still
> test users.
>
> **Placement, settled 2026-07-29:** reminders **and the missed-session email**,
> never a plain first send. The principle is Norm's — surface it only where
> there's a lapse to speak to; on a first send the participant is about to do
> the session anyway and a running score reads as surveillance. Reminders alone
> were not enough: Zerin's daily check-in link expires in 4 h while its
> `reminder_interval_hours` is 6, so the link is dead before a reminder is ever
> due and only **4 of 79** Zerin sends have ever had one (none at 09:00 or
> 14:00). Reminder-only would have meant Liliana-only indefinitely. The
> missed-session path already fires for Zerin — `followsMissedSession` keys off
> the closed window, not the lagging `missed` label — and costs no extra email.
> Measured: Zerin goes from 0 emails carrying the line to **39** (38 with a
> number); Liliana adds 33 and 14.
>
> Rejected alternative: dropping Zerin's reminder cadence below 4 h so reminders
> could fire. With three check-ins a day and `reminder_max: 1` that is up to six
> emails a day to someone already not opening them — the opposite of the intent.
>
> The Phase A dependency was stated as "the number must be validated before
> participants see it". That argument applies to a number which *determines an
> outcome*; this one deliberately makes no claim about standing, so it only has
> to be an honest description of the schedule, and it uses the simple
> definition (prior rows with `attempts >= 1`; answered = `status='completed'`)
> rather than trying to match the unsettled enforcement counter. **The threshold
> half is still blocked** and must not be added until §2.6/§2.8 are settled —
> the moment a threshold appears next to the number, the two definitions have to
> agree.
>
> Residual risk accepted: the displayed count can still contradict a
> participant's own memory where the two enforcement candidates disagree (3 of
> 17, §2.6). With a test cohort that is a *feature* — it surfaces the
> discrepancy from the participant side, which the shadow log alone cannot.

## 4. Work breakdown

| # | Task | Size |
|---|---|---|
| 1 | Migration: add `study_sessions.governing_adherence jsonb` | XS |
| 2 | `toSlots()` resolves phase → rule; persist resolved defaults (2.3) | S |
| 3 | Decide + implement the `enforced` predicate (2.2) — the real design question | M |
| 4 | Backfill existing studies (script, or re-save each in the builder) (2.5) | S |
| 5 | Thread it into `send_message` / `SessionEntry` copy | S |
| 6 | Validation: `validate()` errors on a `phase` matching no module (2.4) | S |

Items 1-2 are mechanical. **Item 3 is where the actual thinking is** and should
be settled before any of it is written.

---

## 5. Open questions for Norm

1. ~~**Should Zerin participants be told missing is consequence-free?**~~
   **Answered 2026-07-27 (Norm): no — one hedged string for every study.** The
   live wording is "Missing the occasional session is normal, and there's
   nothing to make up", in `MISSED_INTRO` (`_shared/emailTemplate.ts`) and
   `expiredMessage` (`SessionEntry.jsx`). Hedged = asserts nothing that depends
   on a per-study rule, so it stays true with or without an `adherence_check`
   and cannot regress when one is added. **Copy therefore does NOT vary per
   study**, and this whole linkage exists as an *audit* mechanism only: the
   resolved rule is what a test asserts copy against, never what renders.
2. ~~**Is `countCompletedPhaseDays` meant to stay Liliana-specific?**~~
   **Answered 2026-07-27 (Norm): no — generalize to all studies, whole study as
   one phase when phases aren't specified.** Consequences in §2.6 and §2.7; the
   migration is not free and needs Q5 answered before it ships.
3. **Do participants ever need to see their progress toward the threshold?**
   **Partly answered 2026-07-27 (Norm): show progress universally** — "So far,
   you've completed x out of y (%) of your scheduled check-ins." Whether to also
   state the threshold ("you need N to be in good standing") was left open.

   **The consent forms resolve it.** Liliana's active consent form already says:
   *"To receive full credit for each phase, you are expected to complete at
   least 10 out of 12 daily sessions within that phase."* Zerin's has no
   equivalent sentence, matching its lack of an `adherence_check`. So for any
   study with a rule, the participant has already been told the number and
   agreed to it — stating it in-app is consistency, not new pressure. Today the
   only place it appears post-consent is the **termination email, after they
   have already failed it**, which is the worst possible ordering.
   **Recommend: state the threshold wherever one exists**, sourced from the same
   `adherence_check` node the enforcement reads, so it cannot drift.

   Three implementation constraints on the progress display itself:

   - **`y` must be elapsed sessions, not whole-study.** For a forked study the
     participant's full path isn't materialized until forks resolve (Liliana
     phase2 appears only after the midpoint), so a whole-study denominator is
     unknowable mid-study *and* demoralizing — "10 of 48" at day 12 reads as
     failure. Norm's "So far…" phrasing already implies elapsed; make it
     explicit: sessions whose window has closed.
   - **Suppress it early.** Someone who misses their first session would see
     "0 out of 1 (0%)". Needs a floor (don't render below ~3 elapsed sessions)
     or it becomes the most discouraging thing on the page at the exact moment
     it matters most.
   - ~~**Blocked on Phase A.**~~ Revisited 2026-07-29 — see the Phase C note in
     §3a. The descriptive line shipped early on a test cohort; the *threshold*
     sentence remains blocked.

   **The low-rate contradiction, resolved 2026-07-29.** `MISSED_INTRO` said
   "Missing the occasional session is normal" — put that next to "you've
   responded to 4 out of 11 check-ins (36%)" and the two sentences contradict
   each other in one paragraph. At 36% it isn't occasional. That inaccuracy
   predates the number; the number merely exposes it.

   Resolved the honest way — the *intro* stops overclaiming rather than the
   number being hidden. Below `LOW_RATE_PCT` (50%, the principled cut:
   "occasional" holds exactly while completions outnumber misses) the email uses
   `MISSED_INTRO_LOW_RATE`, which acknowledges the difficulty, still says there's
   nothing to make up, and states no threshold and no threat. **Suppressing only
   bad news was explicitly rejected** — that would make the line dishonest, and
   the number is the one part that has to stay trustworthy. Not a rare path:
   11 of 38 Zerin emails and 17 of 43 Liliana emails would use it.

6. ~~**Should the audit also check consent text against the rule?**~~
   **Answered 2026-07-28 (Norm): yes.** The consent form is the strongest claim
   the lab makes about the rule, so it is in scope for the Phase B assertions.

   **Correction to my framing (Norm, 2026-07-28):** "10 out of 12 *daily*
   sessions" is not a competing unit. The unit was always sessions; "daily" is a
   frequency clarifier that also signals the count excludes the extra time for
   the midpoint assessment. So there is no days-vs-sessions divergence in the
   consent text — Q4 stands unchanged.

**2.8 — but "daily" does define the counted SET, and that is load-bearing.**
Excluding assessments is not cosmetic. Every Liliana participant has 1-2
completed non-daily rows (baseline, midpoint). Counting all completed sessions
instead of daily module sessions:

| all completed | daily only | passes on daily-only | passes if all counted |
|---|---|---|---|
| 11 | 9 | ✗ | ✓ |
| 10 | 9 | ✗ (×2) | ✓ (×2) |

**Three participants would wrongly pass.** Note the direction: §2.6's finding
wrongly *withdrew* one participant, this one wrongly *retains* three. The
counter errs both ways depending on choices nobody has written down, which is
the strongest argument yet for shadow mode.

Today the exclusion is free — the phase join runs through
`session_template_nodes.module_id` and assessments have no module, so they drop
out automatically. **The Q2 generalization removes that filter**: "whole study
as one phase" has no module join to hide behind. Phase A therefore needs an
explicit *countable session* predicate, not just a phase predicate. Options:
count only rows whose template has a `module_id`; add an explicit
`study_sessions.counts_toward_adherence boolean` at compile time (fits naturally
alongside `governing_adherence` from §3); or exclude by session type/label.
**Recommended: the explicit boolean** — it makes the countable set visible and
authorable rather than an emergent property of which tables happen to join.
4. ~~**In what unit is a threshold authored — days or sessions?**~~
   **Answered 2026-07-27 (Norm): always sessions, never days.** Adherence is
   adherence *to the laid-out schedule*, so the unit must be invariant to
   cadence — once a day, three times a day, or once a week all count the same
   way. Consequences:
   - **No re-authoring needed for the live studies.** Liliana phase1 is 12
     session templates across 12 distinct days, against an authored `of_total`
     of 12 — sessions and days coincide there, so existing thresholds already
     mean what "sessions" implies. Verified live.
   - `countCompletedPhaseDays` becomes a misnomer → rename to
     `countCompletedPhaseSessions` when Phase A generalizes it.
   - It must count **a participant's own completed schedule rows**, never
     `study_sessions` templates: Liliana phase2 has 36 templates (3 randomize
     arms × 12) but any one participant does 12. Counting templates would make
     the denominator 3× too large for any forked study.
   - For a study like Zerin, `of_total` is authored as total scheduled sessions
     (3/day × N days), not days — the researcher's call at authoring time.
5. ~~**How do currently-enrolled participants cross over?**~~
   **Answered 2026-07-27 (Norm): shadow-mode the counter first.** Compute the
   generic count alongside the existing `liliana_day_data` one, log every
   disagreement, and change nothing about who is withdrawn until the
   disagreements have been looked at. The 10-vs-9 participant in §2.6 is the
   reason: no enrollment outcome may change as a side effect of this work.

Still open: **Q3** (show progress toward the threshold, or only that one
exists?) and **Q4** (thresholds authored in days or sessions?). Q4 blocks the
generic counter; Q3 blocks nothing and can wait.

My recommendation: answer Q1 as "one hedged string for everyone" and build items
1, 2, 4, 6 as an **audit** — the column exists so a test can assert copy against
it, not so copy varies per participant. That gets the safety benefit without
putting per-study prose generation on the critical path of every check-in email.

With Q2 answered, the ordering matters: **generalizing the counter (Q4, Q5) is
now the riskiest item here, not the copy work.** It changes who stays enrolled
in a running study. It should be sequenced first, in shadow mode, and settled on
its own — the copy linkage can be built on top of it afterwards and is harmless
by comparison.
