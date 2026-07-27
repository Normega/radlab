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
a non-Liliana study would describe a rule that could never actually fire. The
column must therefore record *what is enforced*, not *what is authored*, or it
becomes a second thing that can drift from reality.

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

1. **Should Zerin participants be told missing is consequence-free?** It's true
   today. But if an adherence rule is ever added, the copy silently becomes a
   lie for everyone already enrolled. Safer to keep one hedged string for all
   studies and treat this whole linkage as an *audit* mechanism rather than a
   copy-personalisation one — cheaper, and it can't regress.
2. **Is `countCompletedPhaseDays` meant to stay Liliana-specific?** If Zerin or a
   future study should ever enforce adherence, that function needs a generic
   path (count `participant_schedule` completions by phase) and 2.2 mostly
   dissolves.
3. **Do participants ever need to see their progress toward the threshold**
   ("8 of 10 so far"), or only the fact that a threshold exists? The former is a
   much stronger retention tool and a much bigger surface to get wrong.

My recommendation: answer Q1 as "one hedged string for everyone" and build items
1, 2, 4, 6 as an **audit** — the column exists so a test can assert copy against
it, not so copy varies per participant. That gets the safety benefit without
putting per-study prose generation on the critical path of every check-in email.
