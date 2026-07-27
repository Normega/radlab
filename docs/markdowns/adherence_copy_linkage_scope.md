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
no enrollment outcome. **Unblocked** — Q4 answered 2026-07-27. Review the logged
disagreements before Phase B.

**Phase B — the audit hook.** Add `governing_adherence`, resolve it at compile
time, and add a test asserting participant-facing copy against it. Copy itself
stays a single hedged string for every study, so this phase cannot change what
any participant sees — it only fails a build when a string starts claiming
something the rules don't support.

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
3. **Do participants ever need to see their progress toward the threshold**
   ("8 of 10 so far"), or only the fact that a threshold exists? The former is a
   much stronger retention tool and a much bigger surface to get wrong.
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
