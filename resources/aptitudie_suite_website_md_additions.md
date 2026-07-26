# website.md additions — The Aptitude Suite
# Instructions: two insertions required.
#
# INSERTION 1: Add the route row to §7 Routes table, after the `/games/farm-joy` row:
#   | `/games/aptitude-suite` | `AptitudeSuite` | Protected — research stream |
#
# INSERTION 2: Append §21 in full at the end of the file (after the last line of §20).
#
# Also add to §13 Open Next Steps → new "Aptitude Suite" block (see below).
# -----------------------------------------------------------------------


# ── INSERTION 1 ── (in §7 Routes table, after the /games/farm-joy row)

| `/games/aptitude-suite` | `AptitudeSuite` | Protected — research stream |


# ── INSERTION 2 ── (append at end of file, after last line of §20)

---

## 21. The Aptitude Suite

### Overview

The Aptitude Suite is a 10-minute, three-task cognitive assessment designed to expose perfectionist tendencies through time-allocation behaviour. Participants freely switch between three simultaneously active tasks and are told to aim for the top 10% overall. The key behavioural measures are task-switching frequency, dwell time per task, and score trajectory over time — not raw performance.

**Scientific paradigm**: Perfectionism trap — diminishing-returns scoring curves make 90th+ percentile disproportionately costly. Participants high in perfectionism are expected to over-allocate time to tasks where they are already performing well.

**Route**: `/games/aptitude-suite`
**Access**: Protected (logged-in users only); research stream initially
**Game name slug**: `aptitude_suite`
**Session duration**: 10 minutes exactly (timer starts on "Begin")

Do NOT use the word "Wordle" anywhere in the UI or codebase.

---

### Sub-tasks

| Sub-task | Internal name | Mechanic |
|---|---|---|
| Unscramble | `anagram` | Unscramble a word; difficulty increases with word length |
| Word Storm | `fluency` | Name as many category members as possible |
| Word Probe | `wordprobe` | Guess a 5-letter word in up to 6 attempts with letter-position feedback |

---

### File Structure

```
src/games/AptitudeSuite/
  AptitudeSuite.jsx           <- main layout, timer, session orchestration, Supabase writes
  constants.js                <- all tunable params + logisticPercentile()
  schema.sql                  <- aptitude_sessions + aptitude_events tables + RLS
  data/
    anagrams.js               <- 10+ words per length, lengths 3–12
    categories.js             <- 6 category whitelists (fruits, vegetables, animals, tools, furniture, vehicles)
    wordProbeAnswers.js       <- ~300 curated 5-letter answer words
    wordProbeValid.js         <- ~5000 valid 5-letter guess words
  hooks/
    useSessionTimer.js        <- 10-min ref-based countdown, fires onExpire
    useAnagram.js             <- word queue, skip logic, score state
    useFluency.js             <- whitelist lookup, Levenshtein-1, dedup, score state
    useWordProbe.js           <- guess state, letter colouring, scoring, round management
  components/
    PercentileGauge.jsx       <- 180° SVG arc dial, 0–99; animates on change
    GlobalAverage.jsx         <- live mean of 3 percentile values
    SessionTimer.jsx          <- MM:SS countdown; turns --pk under 60s; pulses under 30s
    AnagramBox.jsx
    FluencyBox.jsx
    WordProbeBox.jsx
    RevealAnswer.jsx          <- 2-second correct-answer overlay between Word Probe rounds
    SessionComplete.jsx       <- summary + Supabase submit
```

---

### Layout

Three equal-width white cards side by side on desktop (`lg:grid-cols-3`), stacked vertically on mobile. Each card: `PercentileGauge` at top, task UI below. Page header: `GlobalAverage` centre, `SessionTimer` right.

---

### Unscramble (Anagram) — mechanics

- Present one scrambled word; participant types and submits (Enter or button)
- Correct: +1 pt, next word loads. Skip: −1 pt (floor 0), next word loads. Wrong guess: no penalty.
- Word length increases every 2 solves: 3, 3, 4, 4, 5, 5, … 12, 12, 12 (stays at 12 after max length)
- Pool: 10+ words per length (3–12); random draw without replacement; reshuffle on exhaustion
- Scramble: Fisher-Yates; re-run if shuffled === original

**Percentile curve (logistic)**:
```
percentile(s) = min(99, round(99 / (1 + exp(-0.55 × (s - 5)))))
```
100th % anchor: 10 words. Midpoint: ~5 words.

---

### Word Storm (Category Fluency) — mechanics

- Category name shown at top of box; one category per session (random draw at start, logged)
- Participant types words one at a time and submits (Enter or button)
- Valid (in whitelist, not already submitted, within Levenshtein-1): +1 pt; canonical form stored; word appended to running list below input
- Invalid: "not recognised" feedback, no penalty. Duplicate: "already listed" feedback, no penalty.
- Levenshtein-1 match: iterative DP, case-insensitive, no external library

**Categories**: fruits, vegetables, animals, tools, furniture, vehicles
**Lists**: 80–150 entries per category; all lowercase; defined in `categories.js`

**Percentile curve (logistic)**:
```
percentile(s) = min(99, round(99 / (1 + exp(-0.45 × (s - 7.5)))))
```
100th % anchor: 15 words. Midpoint: ~7–8 words.

---

### Word Probe — mechanics

- 5-letter word; up to 6 guesses per round
- Guess validated against `wordProbeValid`; invalid word shows "not a word" error, not counted as a guess
- Letter feedback per guess: green = correct letter + position; yellow = correct letter + wrong position; gray = not in word
- Duplicate-letter handling: mark greens first, then yellows for remaining unmatched letters (standard algorithm)
- Scoring: solve on guess N = `7 − N` points (guess 1 = 6 pts, guess 6 = 1 pt, fail = 0 pts)
- On solve or fail: `RevealAnswer` overlay for 2 s showing the correct word, then new round loads
- Answer words: random without replacement from `wordProbeAnswers`; reshuffle on exhaustion
- Grid: 6 × 5; colour tokens: green = `--pk`, gray = `--gy`, yellow = `#F5C842` (local constant)

**Percentile curve (logistic)**:
```
percentile(s) = min(99, round(99 / (1 + exp(-0.12 × (s - 15)))))
```
100th % anchor: 30 pts. Midpoint: 15 pts.

---

### Percentile gauge

- All three percentile displays (column-level + global average) update on every point scored
- Ceiling: 99 — display stays at 99 once reached, no further change
- `GlobalAverage` = `mean([anagram_pct, fluency_pct, wordprobe_pct])`, rounded to nearest integer

---

### constants.js (key exports)

```js
SESSION_DURATION_MS = 600_000
REVEAL_ANSWER_DURATION_MS = 2000
WORDPROBE_YELLOW = '#F5C842'

logisticPercentile(score, midpoint, k)
  → min(99, round(99 / (1 + exp(-k * (score - midpoint)))))

// Per-task params:
// Anagram:    midpoint=5,    k=0.55
// Fluency:    midpoint=7.5,  k=0.45
// Word Probe: midpoint=15,   k=0.12
```

---

### Database Schema

#### `aptitude_sessions`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `user_id` | uuid | FK → `profiles` |
| `study_id` | uuid | FK → `studies`; null for public |
| `is_test` | bool | default false |
| `session_start` | timestamptz | |
| `session_end` | timestamptz | |
| `category_assigned` | text | slug of the Word Storm category used |
| `anagram_score` | integer | default 0 |
| `fluency_score` | integer | default 0 |
| `wordprobe_score` | integer | default 0 |
| `anagram_pct` | integer | default 0 |
| `fluency_pct` | integer | default 0 |
| `wordprobe_pct` | integer | default 0 |
| `avg_pct` | numeric(5,2) | default 0 |
| `task_switch_count` | integer | default 0 |
| `created_at` | timestamptz | default now() |

#### `aptitude_events`

One row per participant action.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `session_id` | uuid | FK → `aptitude_sessions` |
| `task` | text | `'anagram'` \| `'fluency'` \| `'wordprobe'` |
| `event_type` | text | see below |
| `value` | text | word typed |
| `score_at_time` | integer | task score at moment of event |
| `pct_at_time` | integer | task percentile at moment of event |
| `elapsed_ms` | integer | ms since session_start |
| `created_at` | timestamptz | default now() |

**event_type values**:
- anagram: `solve`, `skip`, `wrong_guess`
- fluency: `submit_valid`, `submit_invalid`, `submit_duplicate`
- wordprobe: `guess_valid`, `guess_invalid`, `round_solve`, `round_fail`

RLS: users read/insert/update only their own rows (matching `user_id` or via `session_id` join).

---

### Supabase integration

- Insert `aptitude_sessions` row at session start (after "Begin" click)
- Insert `aptitude_events` fire-and-forget in real time (do not await in hot path)
- Final `UPDATE aptitude_sessions` on timer expiry with `session_end` + all final scores and percentiles
- All Supabase calls in `AptitudeSuite.jsx` or a dedicated `useAptitudeSession.js` hook; never inside task-level hooks

---

### Instruction screen (pre-timer)

**Title** (DM Serif Display): "The Aptitude Suite"

**Body** (DM Sans): "You have 10 minutes to work across three tasks. Each task scores you against other participants — aim for the top 10%. Manage your time: you can switch between tasks freely. Your overall score is the average of your three percentile ranks."

Do not disclose scoring mechanics, percentile thresholds, or the perfectionism focus.

---

### Behavioural data rationale

The primary research measures are derived from `aptitude_events`:
- **Dwell time per task**: time between consecutive events on the same task
- **Task-switch count**: incremented in `AptitudeSuite.jsx` whenever the active task changes (`lastActiveTask` ref)
- **Score trajectory**: percentile-over-time reconstructed from `(elapsed_ms, pct_at_time)` pairs

---

### Status

Planned. Briefing document: `APTITUDE_SUITE_BRIEFING.md`. Not yet built.


# ── INSERTION 3 ── (in §13 Open Next Steps, add a new block before "Pages still to build")

**Aptitude Suite (next Claude Code session):**
- [ ] Run SQL: create `aptitude_sessions` + `aptitude_events` tables with RLS (see §21 schema + `schema.sql`)
- [ ] Build `src/games/AptitudeSuite/` per §21 and `APTITUDE_SUITE_BRIEFING.md`
- [ ] Add `/games/aptitude-suite` route in `App.jsx`
- [ ] Review and expand category word lists in `categories.js` before participant data collection
- [ ] Review `wordProbeAnswers.js` and `wordProbeValid.js` word lists; consider replacing `wordProbeValid.js` with a public-domain TWL/Scrabble word list for better coverage
- [ ] Update scoring curve parameters (`midpoint`, `k`) once real participant data is available
