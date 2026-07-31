# Plan: mandatory sessions and completion-anchored scheduling

**Status:** plan only, nothing built. Written 2026-07-30 with Norm.

**Goal.** Let a study designate a session as *mandatory for continuation*: the
participant gets a window to complete it, is withdrawn if they don't, and — the
new part — everything downstream is scheduled **relative to when they actually
completed it**, not to a fixed offset from enrollment.

First instance: the Liliana midpoint assessment.

---

## 1. What already works

The Liliana chain is `ac_p1 → t_mid → s_mid → rnd_p2 → t_p2_*`.

| Requirement | Status |
|---|---|
| Only shown under adherence conditions | ✅ `ac_p1` withdraws below 10/12 before the midpoint materializes |
| Only continue if completed | ✅ `rnd_p2` won't resolve unless the preceding session is `completed` |
| Fixed completion window (72 h) | ✅ `s_mid.link_expires_hours = 72` |
| Reminders inside the window | ✅ verified live — a midpoint row reached `attempts: 3`, i.e. two reminders |
| Not completed → withdrawn | ✅ `missed_assessment` withdrawal + termination email |

**Nothing needs building for windows, reminders, or withdrawal.**

## 2. What doesn't

Every date is `addDays(t0Date, offset)` — anchored to enrollment, never to what
the participant did. Liliana's 3-day gap (`t_mid` offset 13, `t_p2_*` offset 16)
is a **hardcoded stand-in for the 72 h window**: the designer padded the schedule
because the schedule could not wait for completion.

Measured on the live study — every participant on the current graph completed
the midpoint the same morning it arrived and still waited three days:

| external_id | midpoint completed | phase 2 starts | gap |
|---|---|---|---|
| 909095 | Jul 28, 11:59 | Jul 31 | 3 days |
| 100006 / 100009 / 100003 | Jul 29, ~11:15 | Aug 1 | 3 days |

---

## 3. Decisions (Norm, 2026-07-30)

1. **Mandatory *sessions* only**, not blocks. Block semantics (must all children
   complete? which one anchors?) are deferred until something needs them.
2. **Midnight cutoff.** The anchor is the **calendar date of completion in lab
   time**, and the next session is that date + 1. Finish 23:59 on day 13 → next
   06:00 on day 14. Finish 00:01 on day 14 → next 06:00 on day 15. Arbitrary,
   but the cutoff has to be somewhere and a date boundary is the least surprising
   one.
3. **Everything downstream shifts**, including the later `ac_p2 → t_final` gate.
   The whole tail is relative to the midpoint.

## 4. Rejected: static worst-case plan + a rescheduling pass

Norm's initial proposal was to materialize the downstream schedule up front
assuming the maximum 3 days, then run a rescheduling function on completion.

**It can't work here, and it isn't needed.** `s_mid` points directly at
`rnd_p2`, a 3-arm randomize. Until the arm is drawn you don't know *which*
sessions exist (non-reactivity / reappraisal / self-compassion), so there is no
static plan to write. `materializeSchedule` already handles this: the randomize
branch sets `stoppedAt` and breaks unless the gating session is `completed`, and
`drawAssignment` runs only after. Nothing past the fork exists until completion —
confirmed by 909095, whose phase-2 rows appeared only after Jul 28.

So the deferral the rescheduling approach would need **already exists**. Compute
the dates correctly at insert time and there is no worst-case plan to write, no
UPDATE pass, and no window in which rows exist with dates we know are wrong.

*What the rejected approach did buy:* visibility. An admin looking at a
mid-study participant sees no phase-2 rows at all. That's a real gap, but the
fix is to **project** the schedule for display, not to materialize rows we
intend to overwrite. Tracked as a separate item (§8).

---

## 5. Design: anchor rebase

One change to `emit()` in `materializeSchedule`:

```ts
// today
scheduledDate: addDays(t0Date, offset)
// proposed
scheduledDate: addDays(anchorDate, offset - anchorOffset)
```

`(anchorDate, anchorOffset)` starts at `(t0Date, 0)`. When the walk passes a
**completed gate session**, it becomes `(completion date in lab tz, that node's
offset)`. Set `t_p2_* = 14` (gate offset + 1) and phase 2 lands the day after
completion, whenever that was.

Why this is safe:

- **No-op for on-time completers.** Everyone so far completed on the scheduled
  day, so `completedDate == t0 + 13` and nothing moves. Blast radius is limited
  to late completers *by construction*.
- **Idempotent.** Already-materialized nodes are skipped, and `completed_at`
  never changes, so re-walking every 15 minutes is stable.
- **Generalizes.** Any number of gates; each rebases from the previous anchor.
- **Downstream gates shift for free** — `t_final` is computed from the same
  anchor, satisfying decision 3 with no extra code.

### Guards

- **Never pull earlier:** `anchorDate = max(gateScheduledDate, completedDate)`.
  A rebase may only push later than the design.
- **Lab timezone, not UTC.** `completed_at` is `timestamptz`; the calendar date
  must be taken in `America/Toronto` (reuse `check_schedule`'s
  `formatInTimeZone`). Taking it in UTC would push anyone completing after 20:00
  Toronto into the next day — the same class of bug as the 14:00-vs-morning
  next-contact defect on 2026-07-25.
- **Null `completed_at`** (legacy rows): fall back to the gate's scheduled date,
  i.e. current behaviour.

---

## 5a. Recommended build order (2026-07-31)

**Ship the rebase alone first. Do not build the declarative gate yet.**

The gate check already exists — `rnd_p2` refuses to resolve unless the preceding
session is `completed`, `ac_p1` handles the adherence condition. Liliana's
gating works today; only the date arithmetic is broken. So:

**Phase 1 — anchor rebase (items 2 + 3 below). No schema, no UI, ~40 lines.**

1. `materializeSchedule`'s schedule query selects `status, study_session_id` —
   add `completed_at`, and make the `materialized` map hold
   `{status, completedAt}` rather than a bare status string.
2. Track `lastSessionCompletedAt` beside the existing `lastSessionStatus` /
   `lastSessionNodeKey`.
3. In the `randomize` branch, once it confirms `lastSessionStatus ===
   'completed'`, set `(anchorDate, anchorOffset)` from that session before
   continuing the walk.
4. `emit()` uses `addDays(anchorDate, offset - anchorOffset)`.
5. Liliana graph: `t_p2_*` 16 → 14.

`t_final` shifts for free — same anchor.

**Phase 2 — declarative `gates_continuation` (items 1, 4, 5). Later.**

Only needed for a mandatory session *not* followed by a fork, which no current
study has. Deferring it also means the block semantics parked by decision 1 can
be settled against a second real use case instead of guessed at.

**Why this order**

- Phase 1 is the entire fix for the live study; Phase 2 buys Liliana nothing.
- Not throwaway: Phase 2 reuses the identical rebase code and only changes
  *where the anchor comes from* — a declared flag instead of "the session before
  a fork". Phase 1 builds the machinery, Phase 2 rewires its trigger.
- `materializeSchedule` decides every participant's schedule. Changing date
  arithmetic alone is contained and verifiable; adding a new gate concept in the
  same pass moves two things at once in the platform's most load-bearing
  function.
- No new routine, cron step, or pass is required — the advance pass already
  re-walks every 15 minutes and materializes when the fork resolves.

**The verification that matters:** replay the four in-flight participants and
assert **zero diffs**. All four completed on time, so `completedDate == t0 + 13`
and the rebase must be a mathematical no-op. Any row that moves means the
arithmetic is wrong.

## 6. Work breakdown

| # | Change | Where | Size |
|---|---|---|---|
| 1 | `gates_continuation: true` on session nodes | `experimentGraph.js`, graph schema | S |
| 2 | Anchor rebase in `emit()`; add `completed_at` to the schedule query (it currently selects only `status, study_session_id`) | `_shared/materializeSchedule.ts` | S (~40 lines) |
| 3 | Collapse Liliana's compensating gap: `t_p2_*` 16 → 14 | study design graph | XS |
| 4 | `validate()` rejects a gate whose downstream offset ≤ its own | `experimentGraph.js` | S |
| 5 | Builder UI: "required to continue" checkbox + window hours | `ExperimentBuilder` | S–M |
| 6 | Tests (§7) | — | S |

**Declaring the gate (#1) is the real conceptual change.** Today gating is
*emergent* — it is "whatever session happens to precede a `randomize`". A
mandatory session with no fork after it gates nothing at all. Making it a
declared property is what turns this from a Liliana quirk into a study-design
feature, and it is what Norm actually asked for.

## 7. Testing

`materializeSchedule` decides every participant's schedule and is the most
load-bearing function on the platform, so:

- Unit: on-time completion produces **byte-identical** rows to today (the
  critical regression — it proves the blast radius claim).
- Unit: completion 1 and 3 days late shifts every downstream row by exactly that
  much, including `t_final`.
- Unit: completion at 23:59 vs 00:01 lab time lands on adjacent days
  (decision 2), and the same instants in UTC do **not** change the answer.
- Unit: null `completed_at` reproduces current behaviour.
- Idempotency: re-running the walk after materialization inserts nothing and
  moves nothing.
- Live dry-run: replay the four in-flight participants and confirm zero diffs.

## 8. Not in scope, tracked

- **Projected-schedule visibility** for admins (see §4).
- **Block-level gating** (deferred by decision 1).
- **Minimum gap after completion** — completing at 23:59 means the next session
  is 6 h later at 06:00. Accepted for now; revisit if it reads badly.

## 9. In-flight participants

`materializeSchedule` skips already-materialized nodes, so 909095 and the three
100xxx accounts keep their existing dates (Jul 31 / Aug 1). Only participants who
reach the gate **after** deploy get the new behaviour. No backfill, no migration
of live schedules — deliberately.
