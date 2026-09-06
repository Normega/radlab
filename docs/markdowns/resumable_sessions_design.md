# Resumable sessions — design for discussion

*2026-09-06. Written after the 2026-08-27 Sandy Study 3 incident, where twelve
sessions ended with a step exiting cleanly and the next never entering, and two
participants lost 22+ minutes of work with no way back in.*

**Norm's constraint (2026-09-06):** resume from the last *completed* step. Never
resume partway through a timed task.

---

## 1. The constraint turns out to simplify the design

Resuming at a **step boundary** satisfies "never mid-task" by construction. There
is no partial-task state to restore, because we never restore into the middle of
anything: whatever step you were on when it broke, you get that step again from
its beginning. A half-played AptitudeSuite is replayed, not rejoined.

So the whole design reduces to one question — *what is the last step this person
provably finished?* — plus the consequences of replaying the one after it.

## 2. Where the resume point comes from

Three options were considered:

| | Survives browser close | Survives device change | Auditable | New storage |
|---|---|---|---|---|
| `sessionStorage` | no | no | no | none |
| **`participant_step_timings`** | **yes** | **yes** | **yes** | **none** |
| New column on `participant_schedule` | yes | yes | yes | migration |

**Recommendation: derive it from `participant_step_timings`.** A row is already
written on every step completion, carrying `participant_schedule_id` and
`step_index`. The resume point is:

```sql
select coalesce(max(step_index) + 1, 0)
from participant_step_timings
where participant_schedule_id = $1
```

No new state, no second source of truth to drift, and it is inspectable after the
fact — the same table that told us where the twelve sessions died.

**One hardening required.** That insert is currently fire-and-forget
(`.then(({error}) => console.warn(...))`). Today a failed write costs a timing
row; under this design it would cost the participant their place. It needs to be
awaited (or retried once) before the step advances — the only change to the
existing write path.

## 3. The problem that makes naive resume dangerous

`stepOutputs` is **in-memory only**. `SessionEntry` says so directly:

> *"In-memory only — a mid-session reload restarts the flow, so outputs rebuild
> as steps redo."*

Display steps interpolate from it — `{{game.aptitude_suite.avg_pct}}`,
`{{game.color_max.avg_pct}}`, and a `redemption_score` that SessionEntry derives
from both. **In Sandy Study 3 that display is the experimental manipulation.**

So a participant who crashes after a game and resumes past it would reach the
feedback screen with nothing to interpolate. That is not a cosmetic bug: it
either shows them a broken screen or, worse, silently shows them the wrong
feedback. **Resume is unsafe until outputs are rebuilt on load.**

**They can be rebuilt.** Both games persist what the manifest claims they output:

- AptitudeSuite → `aptitude_sessions` (`anagram_pct`, `fluency_pct`,
  `wordprobe_pct`, `avg_pct`, `task_switch_count`), `study_id` stamped
- ColorMax → `aptitude_sessions` with `game = 'color_max'`, `avg_pct` + `results`

**Bug found while checking (worth fixing regardless of resume):** ColorMax's
insert does not stamp `study_id` — verified, all its rows have it null while
AptitudeSuite's are populated. Those rows are currently attributable only by
`user_id` + time. Reconstruction would have to match on that; stamping
`study_id` at insert is a two-line fix and makes the query honest.

**Open scope question (§7).** Rebuilding outputs generically means a resolver per
element type that can read back what each step produced. `pond_watch` and
`still_water` report no flat outputs, `breath_belt` writes to `belt_sessions`,
so the manifest in `elementOutputs.js` is the natural place to declare "how to
re-read me". That is real work, and it is the bulk of this project.

## 4. Replay creates duplicate rows — the data-integrity half

If someone half-plays AptitudeSuite, crashes, and replays it, there are now two
`aptitude_sessions` rows for one participant in one session. Nothing today says
which one counts. That is squarely CLAUDE.md participant-data territory: the
export must name columns from recorded facts, not from occurrence order.

Options, in preference order:

1. **Mark the abandoned attempt.** On resume, stamp rows belonging to a step we
   are about to replay with `superseded_at`/`superseded_by_resume = true`. The
   export filters them; nothing is deleted, and the abandonment stays visible.
2. **Take the last attempt per (schedule, step_index).** No schema change, but it
   is an inference at read time — exactly the "clever inference over recorded
   fact" the rules warn against.
3. Do nothing and let the export show both. Rejected: silently double-counts.

Option 1 needs a small migration and a decision about which tables get the
column (`aptitude_sessions`, `vas_responses`, `questionnaire_responses`,
`instrument_responses`, `participant_step_timings`).

## 5. The crash-loop guard

`currentIndex` advances *before* the next step mounts, so a persisted index would
point at the step that crashed and re-mount it forever. Deriving from *completed*
steps avoids that by construction — but a step that crashes deterministically on
a given device will still crash on resume.

**Proposal:** the boundary already writes a `step_crash` row (live since
2026-09-05). On resume, if a crash row already exists for this
`(schedule_id, step_index)`, do not silently re-enter it. Show the participant a
short "we had trouble with this screen" and *either*:

- **(a)** offer to skip that step and continue — data for it is missing but the
  rest of the session completes, or
- **(b)** stop and route them to the research team.

This is a **policy decision, not a technical one** — see §7.

## 6. Boundaries of resume

- **Link validity.** Links expire 48h (`participant_links.status='expired'`,
  `ended_reason='timeout'`). Resume lives inside that window; an expired link
  stays expired. Anything longer is a re-issue decision by staff.
- **Schedule status.** The scheduler marks abandoned rows `missed`. Resume must
  work while the row is still open, and a `missed` row must be reopened
  deliberately by staff rather than by the participant returning.
- **Consent and screener.** Both precede step 0 and are already recorded on the
  enrollment; resume enters the step flow and must not re-prompt.
- **Assignments.** Already server-side via `useAssignments` — condition arms are
  stable across a resume with no work required. Verified.
- **Two tabs.** Two resumed tabs could double-submit. The existing dedupe guards
  collapse repeats within 10s and would not catch a minutes-apart duplicate.
  Lowest-cost mitigation: resume is read-only about position, and §4's
  supersede-on-replay makes a duplicate visible rather than silent.

## 7. What needs deciding before implementation

1. **Crash-loop policy (§5)** — skip the offending step, or stop and hand off to
   staff? Skipping keeps the session completable and preserves everything after
   it; stopping protects the protocol from a hole in the middle. This one is
   Norm's call, and it may differ per study.
2. **Supersede vs last-attempt (§4)** — is a `superseded_*` column acceptable
   across the response tables, or should the export infer?
3. **How far to take output reconstruction (§3)** — all element types, or only
   the ones a given study's displays actually interpolate? The narrow version is
   much smaller and covers Sandy Study 3; the general version is the real
   feature.
4. **Who may resume** — silently for everyone, or only within a study that opts
   in? A study whose protocol assumes one continuous sitting may not want it.

## 8. Suggested build order

Each stage is independently useful and independently reviewable.

- **0 — hygiene, no behaviour change.** Stamp `study_id` in ColorMax's insert.
  Harden the step-timing write so a failure cannot cost a resume point.
- **1 — resume position only.** Derive last-completed from
  `participant_step_timings`, restore `currentIndex`, gate on link validity and
  schedule status. **Only safe for studies whose displays interpolate nothing** —
  so ship it behind a per-study flag, off by default.
- **2 — output reconstruction.** Per-type resolvers, driven by
  `elementOutputs.js`. This is what makes resume safe for Sandy Study 3.
- **3 — replay bookkeeping.** Supersede rows for replayed steps; export honours
  it.
- **4 — crash-loop policy.** Implement whichever §7.1 answer is chosen.

Stage 1 alone would have saved `664c9f50` — three steps from the end, on a
questionnaire, interpolating nothing.
