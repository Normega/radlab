# Ebb & Flow — Claude Code Build Specification
## Come, See Platform · RADlab · Norman Farb

---

## Overview

**Ebb & Flow** is the second psychophysics game on the Come, See platform, following Pond Watch. It is an interoceptive breath change detection task in which the participant's own avatar — built in `BaseAvatarCreator.jsx` and stored in Supabase — serves as the breath pacer. Participants entrain their breathing to the avatar, then detect whether the avatar's breathing pace changed across a 4-breath trial. Post-trial ratings capture confidence and arousal. Four QUEST+ adaptive staircases independently estimate detection thresholds across faster/slower × high/low salience conditions.

The game sits at `/games/ebb-flow` and follows the same conventions as Pond Watch (`onSessionComplete` callback prop, `useRef`-based timing, Supabase wiring via callback).

---

## 1. File Structure

```
src/
  games/
    EbbAndFlow/
      EbbAndFlow.jsx                # Top-level game component, state machine
      useQuestStaircases.js         # Hook: 4 QUEST+ instances, serialization
      useBreathCycle.js             # Hook: useRef-based breath timing engine
      useButtonSync.js              # Hook: PSI-AMP press/release tracking
      components/
        AvatarBreathPacer.jsx       # Avatar SVG with animated breath cues
        PsiAmpButton.jsx            # Hold/release button with sync ring
        ResponseScreen.jsx          # 3AFC + two placement sliders
        WarmupScreen.jsx            # Entrainment phase with sync indicator
        SessionStart.jsx            # Score, mode, trial count, begin
        SessionSummary.jsx          # End-of-session results
        ModeSelector.jsx            # Beginner/Listener/Empath buttons
        ContinuePrompt.jsx          # "Keep going?" prompt every 10 trials
      constants.js                  # All magic numbers, priors, timing
```

Add route in `App.jsx` (or wherever routes live):
```jsx
<Route path="/games/ebb-flow" element={<EbbAndFlow onSessionComplete={handleSessionComplete} />} />
```

---

## 2. Dependencies

Install before building:
```bash
npm install jsquestplus
```

jsQuestPlus is MIT-licensed, published on npm, peer-reviewed (Kuroki & Pronk, 2022, *Behavior Research Methods*). Import as ES module:
```js
import jsQuestPlus from 'jsquestplus';
```

---

## 3. Constants (`constants.js`)

```js
// Breath timing
export const BASELINE_BREATH_DURATION_MS = 4000; // 4 s per cycle
export const BREATHS_PER_TRIAL = 4;
export const WARMUP_BREATHS = 4;
export const WARMUP_SYNC_THRESHOLD = 0.80; // must reach before trials begin

// Game modes — scale amplitude of avatar breathing animation
export const GAME_MODES = {
  beginner: { label: 'Beginner', scaleAmplitude: 0.25, unlockAt: 0 },
  listener: { label: 'Listener', scaleAmplitude: 0.12, unlockAt: 50 },
  empath:   { label: 'Empath',   scaleAmplitude: 0.02, unlockAt: 100 },
};

// Scoring
export const POINTS = {
  correct_high_salience: 10,
  correct_low_salience: 20,
  correct_catch: 8,           // correctly says "same" on catch trial
  false_alarm: -5,            // says change on catch trial
  confidence_calibrated: 5,   // bonus: high conf + correct OR low conf + incorrect
};

// QUEST+ priors (from Study 1 empirical data — fourbreathtask.md)
export const QUEST_PRIORS = {
  threshold_mean: 0.20,       // magnitude units (linear)
  threshold_sd: 0.15,         // wider than Study 1 to accommodate 4-breath design
  slope: 5.70,                // logit units per magnitude unit (Study 1 model)
  lapse_rate: 0.02,
  guess_rate: 1 / 3,          // 3AFC
  target_threshold_pct: 0.75, // 75% correct target
};

// QUEST+ convergence — stop prompting when all 4 SDs are below this
export const QUEST_CONVERGENCE_SD = 0.04;

// Magnitude space — stimuli sampled from this range (log10 transformed for Weibull)
export const MAGNITUDE_MIN = 0.05;
export const MAGNITUDE_MAX = 0.50;
export const MAGNITUDE_STEPS = 46; // resolution of staircase grid

// Catch trial proportion
export const CATCH_TRIAL_PROPORTION = 0.25;

// Session
export const MIN_TRIALS_PER_SESSION = 10;
export const CONTINUE_PROMPT_INTERVAL = 10;
```

---

## 4. QUEST+ Staircase Configuration (`useQuestStaircases.js`)

### The four staircases

| Key | Direction | Salience | Change delivery |
|-----|-----------|----------|-----------------|
| `faster_high` | Acceleration | High | Full change abruptly at breath 2→3 |
| `faster_low`  | Acceleration | Low  | Change amortised across breaths 2–4 |
| `slower_high` | Deceleration | High | Full change abruptly at breath 2→3 |
| `slower_low`  | Deceleration | Low  | Change amortised across breaths 2–4 |

### Psychometric functions (3AFC Weibull)

Stimulus dimension is `log10(magnitude)`. The three response options per staircase are:

- **response index 0** = "same" (always incorrect on signal trials)
- **response index 1** = correct direction (faster for faster staircases, slower for slower staircases)
- **response index 2** = opposite direction (always incorrect)

```js
import jsQuestPlus from 'jsquestplus';

// P(correct) — Weibull with 3AFC guess rate
function pCorrect(stim, threshold, slope, lapse) {
  return jsQuestPlus.weibull(stim, threshold, slope, 1 / 3, lapse);
}

// P(wrong) — remaining probability split equally between two error types
function pWrong(stim, threshold, slope, lapse) {
  return (1 - pCorrect(stim, threshold, slope, lapse)) / 2;
}

// psych_func array order: [P(same), P(correct_direction), P(opposite_direction)]
const psychFuncs = [pWrong, pCorrect, pWrong];
```

### Stimulus and parameter samples

```js
import { MAGNITUDE_MIN, MAGNITUDE_MAX, MAGNITUDE_STEPS, QUEST_PRIORS } from './constants';

// Stimulus space in log10(magnitude)
const stimSamples = jsQuestPlus.linspace(
  Math.log10(MAGNITUDE_MIN),
  Math.log10(MAGNITUDE_MAX),
  MAGNITUDE_STEPS
);

// Threshold samples: same log10 space, Gaussian prior centred on log10(0.20)
const thresholdSamples = jsQuestPlus.linspace(
  Math.log10(MAGNITUDE_MIN),
  Math.log10(MAGNITUDE_MAX),
  MAGNITUDE_STEPS
);
const thresholdPrior = jsQuestPlus.gauss(
  thresholdSamples,
  Math.log10(QUEST_PRIORS.threshold_mean),  // ≈ -0.699
  QUEST_PRIORS.threshold_sd                  // 0.15 in log10 units
);

// Slope: fixed at Study 1 estimate (single-value array)
const slopeSamples = [QUEST_PRIORS.slope];

// Lapse: fixed
const lapseSamples = [QUEST_PRIORS.lapse_rate];
```

### Initialising a staircase

```js
function createStaircase(thresholdPrior, thresholdSamples) {
  return new jsQuestPlus({
    psych_func: [pWrong, pCorrect, pWrong],
    stim_samples: [stimSamples],
    psych_samples: [thresholdSamples, slopeSamples, lapseSamples],
    priors: jsQuestPlus.set_prior([
      thresholdPrior,
      slopeSamples.length,   // uniform over slope (single value = no effect)
      lapseSamples.length,   // uniform over lapse (single value = no effect)
    ]),
  });
}
```

### Getting the next stimulus

```js
// Returns magnitude in linear units (convert from log10)
function getNextMagnitude(staircase) {
  const log10Mag = staircase.getStimParams();
  return Math.pow(10, log10Mag);
}
```

### Updating after a response

```js
// responseKey: 'faster' | 'slower' | 'same'
// staircaseKey: 'faster_high' | 'faster_low' | 'slower_high' | 'slower_low'
function updateStaircase(staircase, staircaseKey, responseKey, log10Mag) {
  const correctResponse = staircaseKey.startsWith('faster') ? 'faster' : 'slower';
  let responseIndex;
  if (responseKey === correctResponse) responseIndex = 1;      // correct
  else if (responseKey === 'same') responseIndex = 0;          // wrong: same
  else responseIndex = 2;                                       // wrong: opposite
  staircase.update([log10Mag], responseIndex);
}
```

### Posterior SD for convergence check

```js
function getPosteriorSD(staircase) {
  // jsQuestPlus exposes getEstimates() for mean; SD requires manual computation
  // from the marginal distribution over threshold
  const marginal = staircase.getMarginalPosterior(0); // index 0 = threshold
  const threshVals = thresholdSamples;
  const mean = threshVals.reduce((acc, t, i) => acc + t * marginal[i], 0);
  const variance = threshVals.reduce((acc, t, i) => acc + marginal[i] * (t - mean) ** 2, 0);
  return Math.sqrt(variance); // in log10 units; compare to QUEST_CONVERGENCE_SD
}
```

> **Note:** Verify that `getMarginalPosterior` is the correct jsQuestPlus API for accessing the marginal over a single parameter. Check the jsQuestPlus GitHub source if not available — the internal `pdfAll` matrix may need manual marginalization. Test this in isolation before integrating.

### Serialization for Supabase

```js
// Save: extract all internal state
function serializeStaircase(staircase) {
  return {
    pdfAll: staircase.pdfAll,           // full posterior — ~KB scale, fine for JSONB
    stimSamples: staircase.stimSamples,
    psychSamples: staircase.psychSamples,
    trialCount: staircase.trialCount,
  };
}

// Restore: reinitialise and inject saved posterior as prior
function deserializeStaircase(saved) {
  const jsqp = createStaircase(thresholdPrior, thresholdSamples);
  jsqp.pdfAll = saved.pdfAll;           // overwrite posterior with saved state
  jsqp.trialCount = saved.trialCount;
  return jsqp;
}
```

> **Note:** Direct assignment to `pdfAll` may not be supported. If not, use the `priors: jsqp1.posteriors` pattern from the jsQuestPlus docs to restore from a previous session's posteriors. Verify against jsQuestPlus source.

### The hook

```js
export function useQuestStaircases(savedState) {
  const staircases = useRef(null);

  useEffect(() => {
    if (savedState) {
      // Restore from Supabase
      staircases.current = {
        faster_high: deserializeStaircase(savedState.faster_high),
        faster_low:  deserializeStaircase(savedState.faster_low),
        slower_high: deserializeStaircase(savedState.slower_high),
        slower_low:  deserializeStaircase(savedState.slower_low),
      };
    } else {
      // First session — initialise fresh
      staircases.current = {
        faster_high: createStaircase(thresholdPrior, thresholdSamples),
        faster_low:  createStaircase(thresholdPrior, thresholdSamples),
        slower_high: createStaircase(thresholdPrior, thresholdSamples),
        slower_low:  createStaircase(thresholdPrior, thresholdSamples),
      };
    }
  }, []);

  // Returns the staircase key with the highest posterior SD (most uncertain)
  function getMostUncertainStaircase() {
    const keys = ['faster_high', 'faster_low', 'slower_high', 'slower_low'];
    return keys.reduce((best, key) => {
      const sd = getPosteriorSD(staircases.current[key]);
      return sd > getPosteriorSD(staircases.current[best]) ? key : best;
    }, keys[0]);
  }

  function allConverged() {
    return ['faster_high', 'faster_low', 'slower_high', 'slower_low'].every(
      key => getPosteriorSD(staircases.current[key]) < QUEST_CONVERGENCE_SD
    );
  }

  function serialize() {
    const sc = staircases.current;
    return {
      faster_high: serializeStaircase(sc.faster_high),
      faster_low:  serializeStaircase(sc.faster_low),
      slower_high: serializeStaircase(sc.slower_high),
      slower_low:  serializeStaircase(sc.slower_low),
    };
  }

  return { staircases, getMostUncertainStaircase, allConverged, serialize };
}
```

---

## 5. Breath Timing Engine (`useBreathCycle.js`)

**Critical:** All timing must use `useRef` — never `useState` — to avoid stale closure bugs. This is the same pattern as Pond Watch.

```js
export function useBreathCycle() {
  const cycleStartRef = useRef(null);
  const cycleDurationRef = useRef(BASELINE_BREATH_DURATION_MS);
  const breathIndexRef = useRef(0);       // 0–3 within a trial
  const phaseRef = useRef(0);             // 0.0–1.0 within current cycle
  const rafRef = useRef(null);

  // Returns current breath phase: 0.0 = start of inhale, 0.5 = start of exhale
  function getPhase() {
    if (!cycleStartRef.current) return 0;
    const elapsed = performance.now() - cycleStartRef.current;
    return (elapsed % cycleDurationRef.current) / cycleDurationRef.current;
  }

  // Call at start of each breath cycle; returns a Promise that resolves at cycle end
  function startBreath(durationMs) {
    cycleDurationRef.current = durationMs;
    cycleStartRef.current = performance.now();
    return new Promise(resolve => setTimeout(resolve, durationMs));
  }

  return { getPhase, startBreath, cycleDurationRef, cycleStartRef };
}
```

---

## 6. Trial Structure

### Trial types

Each trial is one of five types. Type is determined before the trial starts.

```js
function selectTrialType(getMostUncertainStaircase) {
  if (Math.random() < CATCH_TRIAL_PROPORTION) return 'catch';
  return getMostUncertainStaircase(); // 'faster_high' | 'faster_low' | 'slower_high' | 'slower_low'
}
```

### Computing breath durations for a trial

```js
// magnitude: linear units (e.g. 0.22)
// direction: 'faster' | 'slower'
// salience: 'high' | 'low'
// Returns array of 4 durations in ms

function computeBreathDurations(baseDuration, magnitude, direction, salience) {
  const totalChange = direction === 'faster'
    ? 1 - magnitude   // TotalChange < 1 = shorter cycles
    : 1 + magnitude;  // TotalChange > 1 = longer cycles

  const changed = baseDuration * totalChange;

  if (salience === 'high') {
    // Full change loaded at breath 2→3 (index 2)
    return [
      baseDuration,   // breath 1: baseline reference
      baseDuration,   // breath 2: still baseline
      changed,        // breath 3: abrupt step change
      changed,        // breath 4: maintains new pace
    ];
  } else {
    // Low salience: change amortised across breaths 2, 3, 4
    const step = (changed - baseDuration) / 3;
    return [
      baseDuration,
      baseDuration + step,
      baseDuration + step * 2,
      baseDuration + step * 3,
    ];
  }
}

// Catch trial: all breaths at baseline
function computeCatchDurations(baseDuration) {
  return [baseDuration, baseDuration, baseDuration, baseDuration];
}
```

---

## 7. PSI-AMP Button & Sync Tracking (`useButtonSync.js`, `PsiAmpButton.jsx`)

### The mechanic
- **Hold** the button during inhale (phase 0.0–0.5)
- **Release** the button during exhale (phase 0.5–1.0)
- Input: `onPointerDown` / `onPointerUp` / `onPointerLeave` (mouse + touch)
- Keyboard: spacebar as equivalent

### Sync score per breath
```js
// pressPhase: phase at moment of press (0.0–1.0)
// releasePhase: phase at moment of release (0.0–1.0)
// Perfect press: pressPhase near 0.0; perfect release: releasePhase near 0.5
function computeBreathSyncScore(pressPhase, releasePhase) {
  if (pressPhase === null) return 0; // no press detected = missed breath
  const pressScore   = 1 - Math.min(pressPhase, 1 - pressPhase) * 2;
  const releaseScore = 1 - Math.abs(releasePhase - 0.5) * 2;
  return Math.max(0, (pressScore + releaseScore) / 2);
}
```

### Visual ring during warm-up
The ring around the PSI-AMP button fills as a circular progress indicator (SVG `stroke-dashoffset` or conic-gradient). It shows the rolling mean sync score across the current warm-up breaths. Colour transitions: red (0–0.50) → amber (0.50–0.80) → green (0.80–1.0). Once the rolling mean reaches 0.80 the screen auto-advances to the trial loop. If after 12 warm-up breaths the threshold is not met, a gentle prompt appears: *"Try pressing the button right as the face begins to expand."* — but there is no hard failure gate, just continued breathing until threshold is met.

### During trials
Sync ring is hidden. Button is active (press/release still logged). On the response screen the button goes completely inert — no visual affordance, no event handlers.

### Button label
The button face simply reads **"inhale"** in the held state and is blank/neutral when released. The term "PSI-AMP" appears only in the instruction screen narrative, not on the button itself.

---

## 8. Avatar as Breath Pacer (`AvatarBreathPacer.jsx`)

### Avatar source
Pull the participant's avatar from Supabase `profiles.avatar_config` (the same JSON used by `BaseAvatarCreator`). Render the avatar SVG using the same construction logic as `BaseAvatarCreator.jsx`. Do not re-implement the SVG from scratch — import and call the avatar rendering function directly.

For non-logged-in users: render a default avatar using mid-range parameters from `BaseAvatarCreator`. In the top-right header area (outside the game component) and on the platform home page feed, display a prompt: *"Create your avatar"* — linking to the avatar creator. This is outside `EbbAndFlow.jsx` scope.

### Animated breath cues

All four cues animate continuously based on current breath phase (0.0–1.0):

| Cue | Inhale (phase→0.5) | Exhale (phase→1.0) |
|-----|--------------------|--------------------|
| **Scale** | Expand by `scaleAmplitude` (mode-dependent: 0.25/0.12/0.02) | Contract back |
| **Eyelids** | Rise (eyes widen) | Lower (heavy-lidded) |
| **Blush** | Fade (opacity ~0.26) | Intensify (opacity ~0.62) |
| **Brow lift** | Rise slightly (+2.5px translate) | Lower (-2.5px translate) |

Scale is applied as `svg.style.transform = scale(${s})` on the whole SVG element, `transform-origin: 50% 52%`. All other cues use direct SVG attribute manipulation (`setAttribute`) — not CSS keyframes (Safari compatibility).

Use `requestAnimationFrame` for all animation. Drive animation from `getPhase()` in `useBreathCycle`. **Never use CSS `animation` or `transition` on SVG elements** — these have known Safari/iOS bugs documented in the platform's prior work.

### Breath phase signal
The `bT` (breath value 0–1) is computed as:
```js
const bT = (Math.sin(phase * Math.PI * 2 - Math.PI / 2) + 1) / 2;
// bT = 0 at start of exhale, bT = 1 at peak inhale
```

---

## 9. Response Screen (`ResponseScreen.jsx`)

Three inputs, all required before "Next trial" unlocks.

### 3AFC buttons
```
[ Faster ]  [ No change ]  [ Slower ]
```
Tappable buttons. No default selection. Selected state uses pink accent (`#f068a4` border + background tint). Must tap to select — no keyboard default.

### Placement sliders (confidence + arousal)

Both sliders use the mandatory-placement pattern:

- **UNSET state**: track visible, thumb rendered as a dashed circle outline at track centre, greyed out. A horizontal dashed line spans the full track width as an additional "unset" indicator.
- **PLACED state**: real thumb snaps to exact pointer position on first `pointerdown`. Thumb becomes solid, fill colour extends from left edge to thumb position. Fine adjustment via drag after placement.
- `pointerCapture` used to handle drag outside the track bounds gracefully.
- Value displayed as integer 1–7 next to the slider label once placed.
- "Next trial" button checks: `afc !== null && confidence !== null && arousal !== null`.

```
How confident are you?        [—]
  |  ·  ·  ·  ·  ·  ·  |
not at all          completely

How activated do you feel?    [—]
  |  ·  ·  ·  ·  ·  ·  |
calm / still        alert / activated
```

7 tick marks on each slider. Labels at both ends only.

---

## 10. State Machine (`EbbAndFlow.jsx`)

```
SESSION_START
  → user taps "Begin session"

WARMUP
  → 4 breaths at baseline pace
  → PSI-AMP button active, sync ring visible
  → auto-advance when rolling sync mean ≥ 0.80
  → (or after gentle prompt if taking too long)

TRIAL_ITI
  → 800ms blank pause between trials
  → avatar continues breathing at current pace

BREATH_SEQUENCE
  → 4 breaths at computed durations
  → avatar animated, PSI-AMP button active
  → press/release timestamps logged per breath

RESPONSE
  → PSI-AMP button inert
  → 3AFC + two placement sliders
  → on submit: compute score delta, update QUEST, increment counters

CONTINUE_PROMPT  (every CONTINUE_PROMPT_INTERVAL trials)
  → "Good work. Want to keep going?"
  → [ Yes, continue ] → TRIAL_ITI
  → [ Take a break ]  → SESSION_COMPLETE

STABILITY_COMPLETE  (if allConverged() returns true after any trial)
  → "Your sensitivity profile is complete."
  → → SESSION_COMPLETE

SESSION_COMPLETE
  → show summary: points this session, total points, d′ bars, mode unlock if applicable
  → save to Supabase via onSessionComplete callback
```

---

## 11. Supabase Schema Changes

### New columns on `profiles`

```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ebb_flow_game_mode TEXT DEFAULT 'beginner';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ebb_flow_total_trials INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ebb_flow_total_score INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ebb_flow_quest_state JSONB;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ebb_flow_listener_unlocked_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ebb_flow_empath_unlocked_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ebb_flow_last_session_at TIMESTAMPTZ;
```

`ebb_flow_quest_state` stores the serialized 4-staircase object. Expected size: ~50–200KB per user (4 × full posterior matrices). Within Supabase JSONB limits. Monitor with: `SELECT pg_column_size(ebb_flow_quest_state) FROM profiles LIMIT 10;` after first sessions.

### Trial data

Use the existing `trials` table. Store per-trial data in the `metrics` JSONB column:

```js
{
  trial_type: 'faster_high',    // or 'faster_low' | 'slower_high' | 'slower_low' | 'catch'
  total_change: 0.78,           // actual TotalChange applied
  magnitude: 0.22,              // linear magnitude
  log10_magnitude: -0.658,      // what QUEST actually operates on
  salience: 'high',
  direction: 'faster',
  response: 'faster',           // 'faster' | 'slower' | 'same'
  correct: true,
  confidence: 5,                // 1–7
  arousal: 4,                   // 1–7
  reaction_time_ms: 1840,
  breath_sync: [
    { breath_index: 0, press_phase: 0.03, release_phase: 0.51, sync_score: 0.91 },
    { breath_index: 1, press_phase: 0.06, release_phase: 0.49, sync_score: 0.88 },
    { breath_index: 2, press_phase: 0.04, release_phase: 0.52, sync_score: 0.92 },
    { breath_index: 3, press_phase: 0.07, release_phase: 0.50, sync_score: 0.89 },
  ],
  trial_sync_mean: 0.90,
  quest_posterior_mean: 0.21,   // log10 units; convert to linear for display
  quest_posterior_sd: 0.07,
  game_mode: 'beginner',
  scale_amplitude: 0.25,
}
```

---

## 12. Instruction Screen Content

The instruction screen should convey the following in plain language. Exact copy TBD, but the key beats are:

1. **The avatar breathes — follow it.** Your avatar will expand and contract. Let your own breath follow its rhythm.
2. **Use the attunement button.** While you inhale, hold the button. When you exhale, release it. This is your PSI-AMP — it helps you attune your breath to your avatar's.
3. **Something may change.** On some trials, the avatar's pace will shift — faster or slower. Your job is to notice.
4. **Tell us what you sensed.** After each breath cycle, you'll report whether the pace changed, how confident you feel, and how activated you feel right now.
5. **The more you practice, the subtler the changes become.** Beginner mode shows large changes. As you develop sensitivity, you unlock Listener and Empath modes.

---

## 13. Game Mode Selector (`ModeSelector.jsx`)

Shown on the `SESSION_START` screen. Always renders all three buttons. Locked modes are visually greyed out (opacity 0.4, `cursor: not-allowed`, lock icon) but visible.

```
Game mode
[ Beginner ✓ ]  [ Listener 🔒 ]  [ Empath 🔒 ]
                  Unlock at 50     Unlock at 100
                    trials           trials
```

When a mode unlocks (trial count crosses threshold), show a brief animated reveal on the session summary screen before the user can select it. Allow the user to stay on their current mode — downgrading is intentional and valid.

Store selected mode in `profiles.ebb_flow_game_mode`. Scale amplitude is derived entirely from the selected mode via `GAME_MODES` constant — no manual override.

---

## 14. Scoring Logic

Compute after each trial response:

```js
function computeTrialScore(trialType, response, correct, confidence) {
  let points = 0;
  if (trialType === 'catch') {
    if (correct) points += POINTS.correct_catch;     // said "same" correctly
    else         points += POINTS.false_alarm;        // said change on catch
  } else {
    const salience = trialType.endsWith('high') ? 'high' : 'low';
    if (correct) {
      points += salience === 'high'
        ? POINTS.correct_high_salience
        : POINTS.correct_low_salience;
    }
    // Confidence calibration bonus
    const confidentAndCorrect = confidence >= 5 && correct;
    const uncertainAndWrong   = confidence <= 3 && !correct;
    if (confidentAndCorrect || uncertainAndWrong) points += POINTS.confidence_calibrated;
  }
  return points;
}
```

---

## 15. Cross-Browser Compatibility Notes

Based on prior platform experience (Badge Inspector):

- **No CSS keyframes on SVG elements** — use `requestAnimationFrame` + `setAttribute` only
- **No `foreignObject` in SVG** — not reliably supported on iOS Safari
- **No inline `<style>` tags inside SVG `<g>` elements** — apply styles via attributes
- **`pointerdown` / `pointerup` / `pointermove`** with `setPointerCapture` for the PSI-AMP button — covers mouse and touch uniformly
- **`transform-origin` on SVG elements** — set on the element's `style` property, not as an SVG attribute, for Safari compatibility
- **`will-change: transform`** on the avatar wrapper for GPU compositing — avoids repaints during animation

---

## 16. Testing Checklist Before Wiring Supabase

- [ ] jsQuestPlus initialises without error; `getStimParams()` returns a value in the expected log10 range
- [ ] `getPosteriorSD()` returns a plausible value (~0.10–0.15 at start) and decreases over simulated trials
- [ ] Breath durations are correct for all 4 trial types at magnitude 0.20 (verify computations manually)
- [ ] Abrupt change: breath 3 duration changes, breaths 1–2 and 4 are unaffected
- [ ] Gradual change: breaths 2–4 each step toward target, no single large jump
- [ ] PSI-AMP button: press/release timestamps log correctly against breath phase
- [ ] Sync score of 1.0 is achievable (press exactly at phase 0.0, release exactly at phase 0.5)
- [ ] Response screen: "Next trial" stays locked until all three inputs placed
- [ ] Slider placement: dashed ghost disappears on first tap, real thumb appears at exact tap position
- [ ] Session state machine: all 6 states reachable, no dead ends
- [ ] Mode unlock: crossing 50 trials triggers Listener unlock on session summary
- [ ] QUEST serialization round-trip: serialize → JSON.stringify → JSON.parse → deserialize → same next stim

---

## 17. `onSessionComplete` Callback Payload

```js
onSessionComplete({
  session_id,
  user_id,
  trials: [...],                  // array of per-trial objects (see §11)
  session_score: 140,
  total_score: 340,
  total_trials: 23,
  quest_state: { ... },           // serialized 4-staircase object for Supabase
  game_mode: 'beginner',
  new_mode_unlocked: null,        // 'listener' | 'empath' | null
  all_converged: false,
  session_sync_mean: 0.84,        // mean sync score across all trial breaths
})
```

---

## 18. What Is Out of Scope for This Build

- Attractiveness ratings (planned for future)
- Audio breath pacing cues
- Physiological sensor integration
- Social/leaderboard features
- Low-salience vs high-salience condition toggle in UI (both always active, selected by staircase logic)
- Post-hoc d′ fitting in MATLAB (data export for that is handled by trial storage)
