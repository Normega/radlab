# Lecture load test

Simulates a full lecture's worth of students against the **production** main
Supabase project, to answer one question: *how many concurrent students does
the current compute size actually hold?*

Written 2026-09-09, the night PSY240 L1 took the site down. The database was
on `nano` (0.5 GB, shared burstable CPU); it drained its CPU credits about two
hours into a three-hour lecture and never recovered. Compute is now `small`
(2 GB, 2 cores) and this test exists so the next sizing decision is made from
a measured curve instead of a guess.

## The two experiments

These are different questions and only one of them can be compressed.

| | Question | Method | Time |
|---|---|---|---|
| **A · Ramp** | Where does latency start to degrade with concurrency? | Step 25→300, burst at each level | ~75 min |
| **B · Soak** | Does it survive three hours at lecture load? | Hold ~200 and watch CPU credits | 3 h |

Run **A** first. It also gives a cheap estimate of **B**: measure the CPU-credit
slope during the 200-user step and extrapolate to exhaustion. If the projected
time-to-empty is comfortably over three hours, skip the soak. If it is
marginal, run the soak overnight before trusting it with a real lecture.

## What is simulated, and what is not

Each simulated student is a **real `supabase-js` client**: a real auth session,
a real Realtime websocket on the same channels a browser subscribes to, the
same 20-second polling backstop, and check-in writes through the same RLS
policies. From the database's side it is indistinguishable from a student.

That matters because the operation most likely to bite is **Realtime fan-out
with per-subscriber RLS**. `checkins` is `REPLICA IDENTITY FULL` (set
2026-09-06 so students actually receive reveal events), so one status UPDATE
ships the whole row and Postgres evaluates the members-read policy *once per
subscriber*. A REST-only load tool never touches that path.

**Not covered, deliberately:**

- **Email.** Simulated students sign in with a password, so Resend, the
  roster-join door, and the magic-link round trip are untested. The real 9:10
  sign-in wave is therefore *not* reproduced.
- **Browsers.** No rendering, no phone memory, no lecture-hall wifi.
- **Vercel.** `api/` function concurrency is its own limit and not exercised.
- **Lecture slides.** The decks are static HTML on the CDN and touch the
  database not at all — loading them during the test is free and proves
  nothing. (Only the slides *index* queries `lectures`, once.)

## Blast radius

There is no staging backend — dev and production share one database — so
containment is by scope, not by environment:

- Everything writes to a scratch class, slug **`loadtest`**, with its own
  lecture and check-ins copied from PSY240 L1 so the write shapes match.
- Users are **`loadtest+NNN@radlab.zone`**, created with passwords.
- `teardown.mjs` is scoped to that slug and that email prefix, prints
  before/after counts, and has a `--dry-run`.
- **No PSY240 or PSY309 row is ever read or written.**

Synthetic users briefly count toward Auth MAU billing (300 against Pro's
100,000 — noise) and each fires `handle_new_user`, so profiles are created
too. Teardown removes both.

## Running it

```bash
# 0. one-time: put a service key in .env.local (see "Credentials" below)

# 1. create the scratch class, lecture, check-ins and N users
node scripts/loadtest/setup.mjs --users 300

# 2. smoke test at 25 first — proves the cleanup works on a small mess
node scripts/loadtest/run.mjs --levels 25 --hold 120
node scripts/loadtest/teardown.mjs --dry-run

# 3. the real ramp
node scripts/loadtest/run.mjs --levels 25,50,100,150,200,250,300 --hold 480

# 4. clean up
node scripts/loadtest/teardown.mjs
```

`run.mjs` pauses for a **60-second live window** at each level, so the
instructor can drive the real console against the scratch class and report how
it *feels* while the objective numbers are being recorded. Scripted actions and
manual ones use different check-in positions, so they never contend for the
single-live-checkin slot.

## Credentials

Creating users and driving the instructor side needs a service key, which is
**not** in `.env.local` by default. Get one from
Settings → API → `sb_secret_…`, add it as:

```
SUPABASE_SERVICE_KEY=sb_secret_...
```

and **remove it when the test is done** — it is a full-access key and this repo
is public. (`.env.local` is gitignored, but the habit is the protection.)

Legacy `service_role` JWTs are disabled on this project; it must be an
`sb_secret_` key.

## Client-side bottleneck

300 websockets is not a CPU or memory problem — it is a **single-threaded
event loop** problem. One Node process uses one core no matter how many the
machine has, and a saturated event loop adds client-side queuing delay to every
measurement, which reads as server slowness.

So `run.mjs` **forks worker processes** (default: one per 50 clients) and each
worker reports its own **event-loop lag**. If lag exceeds ~50 ms the run is
flagged `CLIENT-BOUND` and its latency numbers are not trustworthy — add
workers or move to a bigger machine and re-run.

## What to watch, server-side

During the run, in the dashboard:

- **Reports → Database → CPU** — and specifically the **burst credit balance**.
  Its *slope* is the single most diagnostic number here.
- Connection count against `max_connections` (90 on `small`).

Afterwards, the two signatures already seen in production:

```sql
select timestamp, left(event_message, 160) as msg
from logs where source = 'postgres_logs'
  and (event_message ilike '%statement timeout%'
    or event_message ilike '%checkpoint complete%')
order by timestamp desc limit 50
```
