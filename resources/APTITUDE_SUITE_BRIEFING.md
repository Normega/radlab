# Claude Code Briefing — The Aptitude Suite

## Context

This is a new game for the RADlab Come, See platform (`radlab.vercel.app`). The platform uses React + Vite, Tailwind CSS v3, Supabase (PostgreSQL + Auth), and Vercel. Design tokens, font stack, and component conventions are defined in `src/index.css` and `website.md`. Follow all existing patterns exactly.

The Aptitude Suite is a 10-minute, three-task assessment designed to expose perfectionist tendencies via time allocation behaviour. It runs under the research participant stream initially (route: `/games/aptitude-suite`, protected). The three sub-tasks are called **Unscramble**, **Word Storm**, and **Word Probe**. Do not use the word "Wordle" anywhere in the codebase or UI.

---

## File Structure to Create

```
src/games/AptitudeSuite/
  AptitudeSuite.jsx           <- main layout, timer, session orchestration
  constants.js                <- scoring curves, timing config, all tunable params
  schema.sql                  <- Supabase tables (see §Database below)
  data/
    anagrams.js               <- word pool: 10+ words per length, lengths 3–12
    categories.js             <- 6 category whitelists + metadata
    wordProbeAnswers.js       <- ~300 curated common 5-letter answer words
    wordProbeValid.js         <- ~5000 valid 5-letter guess words
  hooks/
    useSessionTimer.js        <- 10-min countdown ref-based, fires onExpire callback
    useAnagram.js             <- word queue, skip logic, score state
    useFluency.js             <- whitelist lookup, Levenshtein-1, dedup, score state
    useWordProbe.js           <- guess state, letter colouring, scoring, round management
  components/
    PercentileGauge.jsx       <- arc dial showing 0–99th percentile
    GlobalAverage.jsx         <- live average of 3 percentile values
    SessionTimer.jsx          <- prominent countdown display
    AnagramBox.jsx            <- Unscramble UI
    FluencyBox.jsx            <- Word Storm UI
    WordProbeBox.jsx          <- Word Probe UI
    RevealAnswer.jsx          <- 2-second correct-answer overlay between Word Probe rounds
    SessionComplete.jsx       <- end-of-session summary + Supabase submit
```

Add the route `/games/aptitude-suite` to `App.jsx`, protected (requires auth).

---

## Design System

Use the existing brand tokens from `src/index.css`. Do not inline hex values — always use CSS custom properties.

| Token | Value | Usage |
|---|---|---|
| `--bg` | `#FCF0F5` | Page background |
| `--bgc` | `#ffffff` | Card / box background |
| `--bgp` | `#FBEAF3` | Pink-tinted panels |
| `--pk` | `#f068a4` | Primary accent |
| `--pkd` | `#c04a82` | Hover states |
| `--gy` | `#abadb0` | Secondary elements |
| `--tx` | `#1c1c1e` | Primary text |
| `--tx2` | `#6b6c70` | Secondary text |
| `--tx3` | `#a8a9ad` | Labels |
| `--bd` | `rgba(180,100,140,0.13)` | Default border |

Fonts: `"DM Serif Display"` for headings/game titles, `"Space Mono"` for scores/percentile readouts, `"DM Sans"` for body/UI. Minimum font size: 12px (`--fs-min`).

Layout: warm, friendly, not clinical. Three equal-width white cards side by side on desktop. Each card has the percentile gauge at the top, task content below. Timer and global average percentile displayed prominently at the top of the page, above the three cards. On mobile, stack the cards vertically.

---

## Session Structure

- Duration: **10 minutes** exactly
- Timer starts on first interaction after a brief instruction screen
- All three tasks run simultaneously — participant freely switches between boxes
- Session ends when timer expires (no early exit)
- On expiry: show `SessionComplete` summary, then submit to Supabase
- Track task switches: any time the participant interacts with a different box than their last interaction, increment `task_switch_count`

---

## Task 1 — Unscramble (Anagram)

### Mechanics
- Present one scrambled word at a time
- Participant types their answer and submits (Enter key or button)
- Correct: +1 point, next word loads
- Skip: −1 point (floor at 0), next word loads
- Wrong guess: no penalty, participant can keep trying or skip

### Word Progression
- Starts at 3-letter words
- Every 2 correct solves, word length increases by 1 (3, 3, 4, 4, 5, 5, ..., 12, 12, 12, ...)
- At length 12, continue serving 12-letter words indefinitely
- Word pool: 10+ words per length (3 through 12) — random draw without replacement within a session; if pool exhausted at a length, reshuffle and redraw
- Scrambled display: shuffle letters so the scramble never accidentally equals the original word; if it does, reshuffle

### Data in `anagrams.js`
Build a pool of at least 10 common English words per length from 3 to 12 letters. Use everyday words, not obscure vocabulary. Examples by length:
- 3: cat, dog, run, sun, map, jar, cup, net, fog, box
- 4: calm, lamp, frog, drum, pink, vest, curl, wolf, knot, clam
- 5: brand, flute, plumb, crank, shout, dwarf, blaze, crisp, quota, swamp
- ...continue through 12-letter words (e.g., blackberries, conversation, fingerprints)

### Scoring / Percentile (logistic)
```
percentile(s) = min(99, round(99 / (1 + exp(-0.55 * (s - 5)))))
```
- 100th percentile anchor: 10 words solved
- Midpoint (50th percentile): ~5 words

---

## Task 2 — Word Storm (Category Fluency)

### Mechanics
- A category name is shown at the top of the box (e.g., "Fruits")
- Participant types words one at a time and submits (Enter key or button)
- Valid word (in whitelist, not already submitted, within Levenshtein-1 of a whitelist entry): +1 point, word added to the submitted list below the input
- Invalid word: show brief "not recognised" feedback, no penalty
- Already submitted: show "already listed" feedback, no penalty
- Category is randomly assigned at session start; same category for the whole session
- Show the running list of accepted words in the box so participants can see what they've found

### Category Assignment
Randomly select one of 6 categories at session start. Log the assigned category in the session record.

### Levenshtein-1 matching
Implement a basic Levenshtein distance function. If the participant's input is within distance 1 of any whitelist word (case-insensitive), accept it and store the canonical whitelist form.

### Word Lists in `categories.js`
Build comprehensive whitelists for these 6 categories. Use well-known, unambiguous members. Aim for 80–150 entries per category. Export as:

```js
export const categories = {
  fruits: { label: "Fruits", words: [...] },
  vegetables: { label: "Vegetables", words: [...] },
  animals: { label: "Animals", words: [...] },
  tools: { label: "Tools", words: [...] },
  furniture: { label: "Furniture", words: [...] },
  vehicles: { label: "Vehicles", words: [...] },
}
```

All words lowercase. Common examples:
- Fruits: apple, banana, mango, strawberry, papaya, kiwi, lemon, peach, plum, grape, cherry, pear, orange, melon, fig, lime, apricot, blueberry, raspberry, pineapple, coconut, watermelon, pomegranate, lychee, guava, passion fruit, nectarine, tangerine, dragonfruit, jackfruit...
- Vegetables: carrot, broccoli, spinach, onion, garlic, potato, tomato, cucumber, zucchini, celery, pepper, eggplant, corn, pea, kale, lettuce, cabbage, cauliflower, asparagus, beetroot, artichoke, leek, radish, pumpkin, squash, turnip...
- Animals: dog, cat, lion, tiger, elephant, giraffe, zebra, dolphin, whale, shark, eagle, owl, penguin, bear, wolf, fox, deer, rabbit, horse, cow, pig, sheep, goat, chicken, duck, swan, crocodile, gorilla, chimpanzee, kangaroo, koala, panda...
- Tools: hammer, screwdriver, wrench, pliers, drill, saw, chisel, level, tape measure, clamp, file, mallet, awl, plane, staple gun, utility knife, socket wrench, hex key, jigsaw, sander, router, wire stripper, soldering iron, caulking gun...
- Furniture: chair, table, sofa, couch, desk, bed, dresser, wardrobe, bookshelf, cabinet, nightstand, armchair, ottoman, bench, stool, shelf, sideboard, chest of drawers, coffee table, dining table, recliner, bunk bed, futon, credenza, vanity...
- Vehicles: car, truck, bus, motorcycle, bicycle, train, plane, helicopter, boat, ship, van, SUV, scooter, tram, subway, ferry, canoe, kayak, yacht, jet, glider, hovercraft, ambulance, fire truck, tractor, forklift, snowmobile, skateboard...

Expand these lists substantially in the actual implementation.

### Scoring / Percentile (logistic)
```
percentile(s) = min(99, round(99 / (1 + exp(-0.45 * (s - 7.5)))))
```
- 100th percentile anchor: 15 words
- Midpoint (50th percentile): ~7–8 words

---

## Task 3 — Word Probe (Wordle-adjacent)

Do NOT use the word "Wordle" anywhere in the UI or code comments.

### Mechanics
- 5-letter word to guess, 6 attempts per round
- Participant types a 5-letter word and submits (Enter key or button)
- Validate against `wordProbeValid` dictionary — if not a valid word, show "not a word" error, do not count as a guess
- After each valid guess, show letter feedback:
  - Green: correct letter, correct position
  - Yellow: correct letter, wrong position
  - Gray: letter not in answer
- Scoring per round:
  - Solve on guess 1: 6 points
  - Solve on guess 2: 5 points
  - Solve on guess 3: 4 points
  - Solve on guess 4: 3 points
  - Solve on guess 5: 2 points
  - Solve on guess 6: 1 point
  - Fail (6 wrong guesses): 0 points
- On solve or fail: show `RevealAnswer` overlay for 2 seconds displaying the correct word, then load a new random answer word
- Answer words drawn randomly without replacement from `wordProbeAnswers`; reshuffle if pool exhausted

### Grid display
Standard 6×5 letter grid. Each row is one guess. Filled rows show colour feedback. Current row shows typed letters. Future rows empty. Style with the brand colour tokens (use `--pk` for green equivalent, `--gy` for gray, and a warm yellow `#F5C842` for yellow — define this as a local constant in `constants.js`).

### Data in `wordProbeAnswers.js` and `wordProbeValid.js`
- `wordProbeAnswers`: ~300 common, recognisable 5-letter words (e.g., train, flame, cloud, brick, ghost, plant, stove, creek, frost, bloom). Avoid obscure or offensive words.
- `wordProbeValid`: ~5000 valid 5-letter English words for guess validation. This can include less common words.

### Scoring / Percentile (logistic)
```
percentile(s) = min(99, round(99 / (1 + exp(-0.12 * (s - 15)))))
```
- 100th percentile anchor: 30 points
- Midpoint (50th percentile): 15 points

---

## PercentileGauge Component

SVG arc gauge. Props: `value` (0–99), `label` (string), `size` (default 120px).

- Semicircular arc (180 degrees), flat edge at bottom
- Background arc: `--bd` colour
- Filled arc: colour transitions from `--gy` at 0 → `--pk` at 99 (interpolate in HSL or use a CSS gradient trick on the SVG stroke)
- Centre readout: value in `Space Mono`, bold, large; "percentile" label in `DM Sans`, small, `--tx3`
- Animate smoothly on value change (CSS transition on stroke-dashoffset)

---

## GlobalAverage Component

Shows the live mean of the three percentile values.

- Large central number in `DM Serif Display`
- Label below: "overall percentile" in `DM Sans` `--tx2`
- Positioned at top-centre of the page above the three boxes
- Updates whenever any task score changes

---

## SessionTimer Component

Props: `secondsRemaining`.

- Display format: `MM:SS` in `Space Mono`
- Normal colour: `--tx2`
- Under 60 seconds: turn `--pk`
- Under 30 seconds: add a subtle pulse animation
- Positioned top-right of the page header area

---

## Database Schema (`schema.sql`)

```sql
-- Session record
CREATE TABLE aptitude_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  study_id uuid REFERENCES studies(id) ON DELETE SET NULL,
  is_test boolean DEFAULT false,
  session_start timestamptz NOT NULL,
  session_end timestamptz,
  category_assigned text NOT NULL,
  anagram_score integer DEFAULT 0,
  fluency_score integer DEFAULT 0,
  wordprobe_score integer DEFAULT 0,
  anagram_pct integer DEFAULT 0,
  fluency_pct integer DEFAULT 0,
  wordprobe_pct integer DEFAULT 0,
  avg_pct numeric(5,2) DEFAULT 0,
  task_switch_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Event log (one row per action)
CREATE TABLE aptitude_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES aptitude_sessions(id) ON DELETE CASCADE,
  task text NOT NULL CHECK (task IN ('anagram','fluency','wordprobe')),
  event_type text NOT NULL,
  -- anagram: 'solve' | 'skip' | 'wrong_guess'
  -- fluency: 'submit_valid' | 'submit_invalid' | 'submit_duplicate'
  -- wordprobe: 'guess_valid' | 'guess_invalid' | 'round_solve' | 'round_fail'
  value text,           -- the word typed
  score_at_time integer,
  pct_at_time integer,
  elapsed_ms integer,   -- ms since session_start
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE aptitude_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE aptitude_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users see own sessions"
  ON aptitude_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users insert own sessions"
  ON aptitude_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users update own sessions"
  ON aptitude_sessions FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "users see own events"
  ON aptitude_events FOR SELECT USING (
    session_id IN (SELECT id FROM aptitude_sessions WHERE user_id = auth.uid())
  );
CREATE POLICY "users insert own events"
  ON aptitude_events FOR INSERT WITH CHECK (
    session_id IN (SELECT id FROM aptitude_sessions WHERE user_id = auth.uid())
  );
```

---

## Supabase Integration

- Create the `aptitude_sessions` row at session start (after the participant clicks "Begin")
- Insert `aptitude_events` rows in real time as actions occur (fire-and-forget, don't await in the hot path)
- On session expiry, do a final `UPDATE aptitude_sessions SET session_end, all final scores/percentiles`
- Use the existing `src/lib/supabase.js` client singleton
- All Supabase calls go in `AptitudeSuite.jsx` or a dedicated `useAptitudeSession.js` hook — not inside individual task hooks

---

## Instruction Screen

Before the timer starts, show a brief instruction screen:

Title (DM Serif Display): **"The Aptitude Suite"**

Body (DM Sans): "You have 10 minutes to work across three tasks. Each task scores you against other participants — aim for the top 10%. Manage your time: you can switch between tasks freely. Your overall score is the average of your three percentile ranks."

Do not mention perfectionism, time allocation strategy, or scoring details beyond what's above. A "Begin" button starts the timer. Once begun, the instruction screen is gone.

---

## constants.js

Export all tunable parameters:

```js
export const SESSION_DURATION_MS = 10 * 60 * 1000;
export const REVEAL_ANSWER_DURATION_MS = 2000;

export const ANAGRAM_MIDPOINT = 5;
export const ANAGRAM_K = 0.55;

export const FLUENCY_MIDPOINT = 7.5;
export const FLUENCY_K = 0.45;

export const WORDPROBE_MIDPOINT = 15;
export const WORDPROBE_K = 0.12;

export const WORDPROBE_YELLOW = '#F5C842';

export function logisticPercentile(score, midpoint, k) {
  return Math.min(99, Math.round(99 / (1 + Math.exp(-k * (score - midpoint)))));
}
```

---

## Implementation Notes

- All timers and intervals via `useRef` to avoid stale closure bugs (follow EbbAndFlow pattern)
- Keyboard input: Enter submits in all three tasks; Backspace works normally in text inputs
- Anagram word shuffle: Fisher-Yates, re-run if shuffled === original
- Levenshtein implementation: iterative DP, case-insensitive, no external library needed
- Word Probe letter colouring: handle duplicate letters correctly (standard Wordle algorithm — mark greens first, then yellows for remaining unmatched letters)
- Do not use `localStorage` or `sessionStorage`
- All state in React hooks; no external state library needed
- Percentile updates on every point change — call `logisticPercentile` inline in the hook's return value, not stored separately
- Task switch detection: track `lastActiveTask` ref; on any interaction with a different task box, increment switch count

---

## Out of Scope for This Build

- Leaderboard integration
- Admin view of session data
- Participant-facing history / replay
- Any animation beyond the gauge transition and timer pulse

---

## Route to Add in App.jsx

```jsx
import AptitudeSuite from './games/AptitudeSuite/AptitudeSuite';
// ...
<Route path="/games/aptitude-suite" element={
  <ProtectedRoute><AptitudeSuite /></ProtectedRoute>
} />
```
