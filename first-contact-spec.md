# First Contact / Deeper Contact — Build Specification
## Come, See Platform · RADlab · Norman Farb

---

## Overview

**First Contact** is a mandatory one-time onboarding game that teaches the PSI-AMP breath sync mechanic before participants enter Ebb & Flow. The narrative: you are making psychic contact with your avatar for the first time, summoning it into existence through breath synchronisation.

After completion, the game becomes **Deeper Contact** — a standalone practice game accessible at any time from the Games page. The core mechanic is identical to the Ebb & Flow warmup but with richer narrative framing, progressive avatar feature reveal, and an aura effect for returning players.

**Why this exists**: test users struggled with the cold-start warmup in Ebb & Flow. First Contact separates learning the mechanic from performing the detection task, removes the 80% sync gate as a blocker, and turns sync practice into a rewarding experience in its own right.

---

## 1. New Files to Create

```
src/games/FirstContact/
  FirstContact.jsx          ← top-level component, state machine
  useBreathSync.js          ← rolling 4-cycle sync buffer
  constants.js              ← timing, thresholds, copy strings
  components/
    ContactAvatar.jsx       ← avatar with ghost → reveal + aura effect
    SyncMeter.jsx           ← arc-style sync quality indicator
    BreathPrompt.jsx        ← staggered instructional text overlay
    ContactComplete.jsx     ← success/completion screen
```

---

## 2. Files to Modify

- `App.jsx` — add `/games/first-contact` route + onboarding guard
- `src/pages/Games.jsx` — add First Contact / Deeper Contact card
- `src/games/EbbAndFlow/components/AvatarBreathPacer.jsx` — add aura effect

---

## 3. Supabase Schema Changes

Run in Supabase SQL editor:

```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS first_contact_complete BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS first_contact_complete_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS deeper_contact_best_sync NUMERIC(4,3) DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS deeper_contact_last_sync NUMERIC(4,3) DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS deeper_contact_sessions INTEGER DEFAULT 0;
```

---

## 4. Routing

Add to `App.jsx`:

```jsx
<Route path="/games/first-contact" element={<FirstContact />} />
```

### Onboarding guard

If `profiles.first_contact_complete === false`, redirect any attempt to access `/games/ebb-flow` to `/games/first-contact` with message:

> *"Complete First Contact before beginning Ebb & Flow."*

This check belongs in the auth wrapper or a `ProtectedGame` HOC — not inside `EbbAndFlow.jsx` itself.

---

## 5. Games Page Updates (`Games.jsx`)

Show two different cards depending on `first_contact_complete`:

**If `first_contact_complete === false`:**
```
First Contact                          [required]
"Begin here. Meet your avatar
 for the first time."                  [ Begin ]
```
Show prominently at top of Games page with a visual indicator that it unlocks Ebb & Flow (e.g. a small lock icon on the Ebb & Flow card).

**If `first_contact_complete === true`:**
```
Deeper Contact
"Return to strengthen
 your connection."                     [ Play ]
```
Normal card, same visual weight as Pond Watch and Ebb & Flow.

---

## 6. Constants (`constants.js`)

```js
export const SYNC_THRESHOLD = 0.80;          // rolling mean needed for completion
export const BUFFER_SIZE = 4;                // cycles in rolling sync buffer
export const MIN_CYCLES_BEFORE_COMPLETE = 4; // minimum cycles before completion possible
export const BREATH_DURATION_MS = 4000;      // 4 s per cycle (same as Ebb & Flow)
export const SCALE_AMPLITUDE = 0.15;         // fixed — not mode-dependent
export const AURA_MAX_OPACITY_GAME = 0.60;   // First Contact / Deeper Contact
export const AURA_MAX_OPACITY_EBB = 0.35;    // Ebb & Flow (less distracting)
export const PROMPT_FADE_CYCLES = 3;         // returning players: hide prompts after N cycles

// Copy strings
export const COPY = {
  intro_first: "Your avatar is waiting. Begin breathing to make contact.",
  intro_returning: "Welcome back. Breathe to deepen your connection.",
  complete_first: "Initial contact established. Your avatar is with you.",
  complete_returning: "Connection deepened.",
  btn_continue_onboarding: "Continue to Ebb & Flow",
  btn_done_standalone: "Done",
  games_tagline_first: "Begin here. Meet your avatar for the first time.",
  games_tagline_deeper: "Return to strengthen your connection.",
};
```

---

## 7. Rolling Sync Buffer (`useBreathSync.js`)

```js
import { useRef } from 'react';
import { BUFFER_SIZE } from './constants';

export function useBreathSync() {
  const buffer = useRef([]);

  // Add a new cycle sync score (0–1). Evicts oldest if buffer is full.
  function addCycleSync(syncScore) {
    buffer.current = [...buffer.current, syncScore].slice(-BUFFER_SIZE);
  }

  // Rolling mean of the last N cycles (N = buffer contents, max BUFFER_SIZE)
  function getRollingMean() {
    if (buffer.current.length === 0) return 0;
    return buffer.current.reduce((a, b) => a + b, 0) / buffer.current.length;
  }

  function getBufferLength() {
    return buffer.current.length;
  }

  function reset() {
    buffer.current = [];
  }

  return { addCycleSync, getRollingMean, getBufferLength, reset };
}
```

**Critical behaviour**: once the buffer holds 4 cycles, each new cycle evicts the oldest. Early poor sync scores cannot permanently block progress — participants always have a fresh path to 80%.

---

## 8. `ContactAvatar.jsx`

The central visual. Receives:

```js
ContactAvatar.propTypes = {
  avatarConfig: PropTypes.object,   // from profiles.avatar_config
  syncLevel: PropTypes.number,      // 0.0–1.0 rolling mean
  breathPhase: PropTypes.number,    // 0.0–1.0 from breath cycle
  isFirstContact: PropTypes.bool,   // true = ghost reveal mode
  isComplete: PropTypes.bool,       // true = completion state
}
```

### Avatar rendering modes

**Ghost reveal mode** (`isFirstContact === true`, `isComplete === false`):

- Head ellipse renders at full opacity always
- All facial features (eyes, brows, blush, mouth) start as ghost impressions
- Ghost base opacity: `0.08`
- Feature opacity interpolates with `syncLevel`:
  ```js
  const featureOpacity = 0.08 + (syncLevel / SYNC_THRESHOLD) * (1 - 0.08);
  // Clamp to max 1.0
  ```
- At `syncLevel = 0`: features barely visible (0.08)
- At `syncLevel = 0.80`: features fully revealed (1.0)
- Apply opacity to each SVG feature group via `setAttribute('opacity', featureOpacity)`

**Normal mode** (`isFirstContact === false` OR `isComplete === true`):
- All features at full opacity always

### Breath animation cues

Identical to `AvatarBreathPacer.jsx` — all four cues driven by `breathPhase`:

| Cue | Inhale (phase → 0.5) | Exhale (phase → 1.0) |
|-----|----------------------|----------------------|
| Scale | Expand by `SCALE_AMPLITUDE` (15%) | Contract back |
| Eyelids | Rise (eyes widen) | Lower (heavy-lidded) |
| Blush | Fade (opacity ~0.26) | Intensify (opacity ~0.62) |
| Brow lift | Rise +2.5px | Lower -2.5px |

All animation via `requestAnimationFrame` + `setAttribute`. **No CSS keyframes on SVG elements** (Safari bug).

### Aura effect

Three concentric SVG rings positioned **behind** the avatar head (render before head ellipse in SVG draw order):

```js
// Ring parameters
const RING_BASE_RADIUS = 72;
const RING_MAX_RADIUS = 140;
const RING_STAGGER = 1/3; // one-third breath cycle offset between rings

// Per ring, per frame:
const ringPhase = (breathPhase + ringIndex * RING_STAGGER) % 1.0;
const radius = RING_BASE_RADIUS + ringPhase * (RING_MAX_RADIUS - RING_BASE_RADIUS);
const opacity = syncLevel * AURA_MAX_OPACITY * (1 - ringPhase);
// Set r and opacity via setAttribute on each ring circle
```

Ring colour: `rgba(253, 188, 180, 0.5)` (avatar skin tone toward white). No fill, stroke only, stroke-width 1.5.

**In Ebb & Flow** (`AvatarBreathPacer.jsx`): same ring logic, `AURA_MAX_OPACITY = AURA_MAX_OPACITY_EBB = 0.35`. Aura intensity seeded from `profiles.deeper_contact_last_sync`. If `deeper_contact_last_sync = 0`, rings are invisible.

---

## 9. `SyncMeter.jsx`

Arc-style sync indicator rendered below the avatar.

```js
SyncMeter.propTypes = {
  syncLevel: PropTypes.number,   // 0.0–1.0
  justUpdated: PropTypes.bool,   // true for one render cycle after new score added — triggers pulse
}
```

**Visual design:**
- Same arc geometry as `SessionFeedback` arcs: `M 10 64 A 45 45 0 0 1 100 64`, arc length 141.4px
- Fill colour:
  - `syncLevel < 0.50`: amber `#BA7517`
  - `syncLevel 0.50–0.79`: yellow-green `#7DAE18`
  - `syncLevel ≥ 0.80`: green `#1D9E75`
- Percentage text at arc centre, Space Mono font
- Label below: "connection strength"
- Pulse on new cycle: CSS transition `transform scale(1.0 → 1.03 → 1.0)` on the meter wrapper — this is a CSS transition on a div, not SVG animation, so Safari-safe
- On completion (first crossing of 80%): meter background flashes green once (CSS transition opacity on a div overlay), then holds green

---

## 10. `BreathPrompt.jsx`

Staggered instructional text driven by breath phase.

```js
BreathPrompt.propTypes = {
  breathPhase: PropTypes.number,    // 0.0–1.0
  cycleCount: PropTypes.number,     // total cycles completed
  isReturning: PropTypes.bool,      // if true, hide after PROMPT_FADE_CYCLES
}
```

**Text states by phase:**

| Phase | Text | Weight | Colour |
|-------|------|--------|--------|
| 0.00–0.05 | "press" | bold | amber `#BA7517` |
| 0.05–0.50 | "inhale" | regular | amber `#BA7517` |
| 0.50–0.55 | "release" | bold | blue `#185FA5` |
| 0.55–1.00 | "exhale" | regular | blue `#185FA5` |

- Font: DM Serif Display, 28px
- Positioned below avatar, above sync meter
- Transition between states: 150ms CSS `opacity` transition (safe on a `<div>`, not SVG)
- For returning players (`isReturning === true`): fade prompts out entirely after `PROMPT_FADE_CYCLES` cycles — assume mechanic is known

---

## 11. State Machine (`FirstContact.jsx`)

```
INTRO
  ↓ user taps "Begin" or presses spacebar

SYNCING
  ↓ rolling mean ≥ 0.80 AND cycleCount ≥ MIN_CYCLES_BEFORE_COMPLETE

COMPLETE
  ↓ user taps continue/done button

→ navigate to /games/ebb-flow (if onboarding) or /games (if standalone)
```

### INTRO screen

- Avatar visible in ghost mode (first-time) or full (returning) — static, not yet breathing
- Narrative text (from `COPY`)
- "Begin" button + spacebar listener
- No PSI-AMP button visible yet

### SYNCING screen

- Avatar breathing (rAF loop running)
- PSI-AMP button active (hold = inhale, release = exhale)
- `BreathPrompt` visible
- `SyncMeter` visible and updating
- Aura rings active if returning player
- Ghost features fading in with syncLevel if first-time
- After each complete breath cycle:
  - Compute cycle sync score (same `computeBreathSyncScore` as Ebb & Flow)
  - Call `addCycleSync(score)`
  - Update `syncLevel = getRollingMean()`
  - If `syncLevel ≥ SYNC_THRESHOLD` AND `cycleCount ≥ MIN_CYCLES_BEFORE_COMPLETE` → transition to COMPLETE

### COMPLETE screen (`ContactComplete.jsx`)

**First-time:**
- Avatar fully revealed at full opacity — all features visible
- Aura rings at `syncLevel` intensity
- Text: *"Initial contact established. Your avatar is with you."*
- Button: *"Continue to Ebb & Flow"* → navigate to `/games/ebb-flow`

**Returning:**
- Avatar + aura at peak session sync intensity
- Text: *"Connection deepened. Sync: [X]%"*
- Button: *"Done"* → navigate to `/games`

**Supabase writes on COMPLETE:**
```js
// Always:
deeper_contact_best_sync = Math.max(currentRollingMean, previousBest)
deeper_contact_last_sync = currentRollingMean
deeper_contact_sessions = previousSessions + 1

// First time only:
first_contact_complete = true
first_contact_complete_at = new Date().toISOString()
```

---

## 12. PSI-AMP Button in First Contact

Reuse `PsiAmpButton.jsx` from Ebb & Flow exactly. The sync ring behaviour during First Contact:

- Ring is always visible (not hidden as it is during Ebb & Flow trials)
- Ring fill reflects rolling sync mean continuously
- Colour: same amber → green progression as `SyncMeter`
- This means two sync indicators are visible simultaneously (button ring + arc meter) — this is intentional, reinforcing the connection metaphor from two angles

---

## 13. Aura Effect in `AvatarBreathPacer.jsx` (Ebb & Flow)

Add aura rings to the existing avatar component. The aura runs at reduced opacity to avoid distracting from the detection task.

```js
// Load from profile on Ebb & Flow session start:
const auraIntensity = profile?.deeper_contact_last_sync ?? 0;
// auraIntensity = 0 → rings invisible
// auraIntensity = 1.0 → rings at AURA_MAX_OPACITY_EBB (0.35)
```

Render three rings behind the head (same geometry as ContactAvatar). The aura does not respond to trial sync during Ebb & Flow — it's a fixed ambient effect seeded from the last Deeper Contact session. It does not update mid-session.

---

## 14. Avatar Config for Non-Logged-In Users

If `avatarConfig` is null (guest user or avatar not yet created):
- Use default mid-range parameters from `BaseAvatarCreator`
- Show "Create your avatar" prompt in top-right header (already planned in `website.md`)
- First Contact still works with default avatar — no blocking

---

## 15. Cross-Browser Compatibility

Follow all existing platform rules:
- All SVG animation via `requestAnimationFrame` + `setAttribute` — **no CSS keyframes on SVG**
- `pointerdown`/`pointerup` + `setPointerCapture` for PSI-AMP button
- SVG attribute names hyphenated in `setAttribute` (`stop-color`, `stroke-width`, `flood-color`)
- CSS transitions only on `<div>` / HTML elements (e.g. BreathPrompt opacity, SyncMeter pulse)
- `will-change: transform` on avatar wrapper for GPU compositing
- `transform-origin` set on `style` property not SVG attribute

---

## 16. Testing Checklist

- [ ] Rolling buffer evicts oldest cycle correctly — cycle 5 score replaces cycle 1
- [ ] `getRollingMean()` never exceeds 1.0 or goes below 0
- [ ] Ghost feature opacity reaches exactly 1.0 at `syncLevel = 0.80`
- [ ] Completion does not trigger before `MIN_CYCLES_BEFORE_COMPLETE = 4` cycles
- [ ] Supabase writes correctly on first-time completion (`first_contact_complete = true`)
- [ ] Supabase writes correctly on returning completion (only updates `deeper_contact_*` columns)
- [ ] Onboarding guard redirects `/games/ebb-flow` to `/games/first-contact` correctly
- [ ] Guard does NOT redirect if `first_contact_complete === true`
- [ ] Aura rings render behind head (not on top of facial features)
- [ ] Aura opacity in Ebb & Flow never exceeds 0.35
- [ ] Aura is invisible in Ebb & Flow when `deeper_contact_last_sync = 0`
- [ ] BreathPrompt fades out after 3 cycles for returning players
- [ ] SyncMeter pulse fires once per cycle (not per frame)
- [ ] All four breath cues animate correctly on iOS Safari

---

## 17. What Is Out of Scope for This Build

- Multiplayer / shared sync sessions
- Audio breath pacing cues
- Leaderboard for Deeper Contact best sync
- Sync history charted over many sessions (future profile feature)
- Haptic feedback (future mobile enhancement)
