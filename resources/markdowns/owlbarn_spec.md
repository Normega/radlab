# Sensory Safari — Exhibit Two: The Owl Barn
### Full Design Specification

---

## 1. Overview

**Exhibit name:** The Owl Barn  
**Primary sense:** Hearing (directional, rhythmic)  
**Core mechanic:** Red light / green light tap-to-move across a barn while owls hoot; read the rhythm to choose between 3-tap (1 step) and 8-tap (2 step) movement bursts  
**Session length:** Variable — ends when player crosses all 10 steps  
**Completion:** Always completable — no fail state, only score variation  
**Primary metric:** Time to cross the barn floor  
**Internal RADlab metric:** Adaptive strategy efficiency score  
**Data destination:** Supabase `game_sessions`, `trials`, `performance` tables  

---

## 2. Narrative

> *You're so excited to see these majestic birds in action! It's so dark in here though… how will you spot them?*
>
> *Let your eyes adjust for a second… there. You can make out some shapes. Is that a bale of hay? But why is everything so large?*
>
> *Wait. Is everything large… or are you… miniature?*
>
> *Yep. It happened. You shrunk into owl prey. Sorry! Good luck! At least owls are loud.*

The player must cross the barn floor while owls circle overhead. Moving during a hoot means getting swooped. Reading the rhythm of silence windows — and choosing greedily (8 taps) or safely (3 taps) accordingly — is the skill.

---

## 3. State Machine

```
IDLE
  └─> SHRINK_ANIMATION
        └─> CALIBRATION_3TAP
              └─> CALIBRATION_8TAP
                    └─> CALIBRATION_COMPLETE
                          └─> [cycle begins]
                                HOOT_PHASE
                                  └─> SILENCE_PHASE (= one trial)
                                        ├─> player taps 3 → MOVE_1_STEP
                                        ├─> player taps 8 → MOVE_2_STEPS
                                        ├─> wrong count / hoot mid-sequence → SWOOPED
                                        └─> [step count == 10] BARN_CROSSED
                                              └─> GAME_OVER
                                                    └─> SCORING
                                                          └─> MINDFULNESS_PAUSE
                                                                └─> RESULTS
                                                                      └─> SAFARI_MAP
```

---

## 4. Phase-by-Phase Breakdown

### 4.1 IDLE

- Dark barn interior loads — shadowy rafters, scattered hay, loft platforms visible
- Everything appears normal-sized for one beat
- Ambient sound: creaking barn, distant wind, gentle owl hoots far away
- Player clicks/presses to enter shrink animation

---

### 4.2 SHRINK_ANIMATION

**Purpose:** Establish the narrative conceit. No interaction — pure cinematic moment.

**Behaviour:**
- All barn objects begin scaling up simultaneously over ~3 seconds
- Hay bales, boots, pails, wooden beams all grow to dwarf the player avatar
- Camera effectively zooms out as the world grows
- A mouse avatar (the player character) becomes visible at the start position — small, wide-eyed, ears flat
- Owls become visible in the rafters — large, imperious, rotating heads slowly
- Text fades in after scale completes: *"You are now prey-sized. The owls are watching. Don't move when they hoot."*
- Auto-advances after 1.5 second pause

**Visual note:** The 10 hiding objects are now visible along the floor — hay bunches, an enormous boot, a tilted pail, a coil of rope, etc. — each marking one step position toward the far barn door.

---

## 5. Calibration

### 5.1 CALIBRATION_3TAP

**Purpose:** Measure the player's natural fast 3-tap speed. Establishes the minimum silence window. Also tutorial for the tap mechanic.

**Prompt on screen:**
> *"Tap the spacebar as fast as you can — exactly 3 times!"*

- Player taps spacebar 3 times
- Each tap shows the yellow energy aura (see Section 8: Visual Feedback)
- On 3rd tap: green flare, count logged
- Elapsed time between tap 1 and tap 3 is recorded as `calibration_3tap_ms`
- **Clamped:** minimum 300ms, maximum 1000ms
- If result is outside clamp range, a brief friendly note: *"Let's try that again — tap as fast as you can!"* (only if too slow — if too fast the floor handles it silently)
- Repeat until a valid result is recorded

**Minimum silence window:**
```
min_silence_ms = clamp(calibration_3tap_ms + 50, 300, 1000)
```

---

### 5.2 CALIBRATION_8TAP

**Purpose:** Measure fast 8-tap speed. Establishes the maximum silence window ceiling.

**Prompt on screen:**
> *"Now tap as fast as you can — exactly 8 times!"*

- Same visual feedback sequence (yellow auras, green flare at 3, yellow again 4–7, big sparkly green at 8)
- Elapsed time tap 1 to tap 8 recorded as `calibration_8tap_ms`
- **Clamped:** maximum 2500ms (no floor — fast tappers are rewarded)

**Maximum silence window:**
```
max_silence_ms = clamp(calibration_8tap_ms × 1.25, min_silence_ms + 100, 2500)
```

The ×1.25 gives 25% headroom above their 8-tap speed at peak, making 8-tap windows achievable but not trivially easy.

---

### 5.3 CALIBRATION_COMPLETE

- Brief animated confirmation: the mouse avatar claps its little paws, a glowing timer bar appears showing the silence window range (visualised as a horizontal bar: short window on left, long window on right)
- Text: *"Short silences: go for 3. Long silences: go for 8. Ready?"*
- Player presses spacebar to begin

---

## 6. Core Game Loop

### 6.1 Trial Structure

Each **silence window** is one trial. Trials are grouped into **cycles of 8 windows**.

**Within each cycle:**
- Silence windows follow a sin function mapping window index (1–8) to duration
- At least 2 of the 8 windows are ≥ `max_silence_ms` (long enough for 8 taps)
- Remaining 6 windows are between `min_silence_ms` and just below `max_silence_ms`
- Exact durations drawn from sin function (see Section 7: Timing)

**Between trials:** A hoot phase separates each silence window. Hoot duration is randomly drawn from **3–5 seconds** per instance, so silence onset is not rigidly predictable.

---

### 6.2 HOOT_PHASE (Red Light)

- Owls hoot — audio and visual (owl silhouettes in rafters animate, mouths open)
- Player **must not tap** during this phase
- Any tap during hooting triggers SWOOPED
- Visual indicator: a warm red ambient glow pulses gently in the rafters — not a harsh UI element, an atmospheric cue
- Duration: random 3–5 seconds per hoot instance
- Ends when hooting stops — silence phase begins immediately

---

### 6.3 SILENCE_PHASE (Green Light / one trial)

- Hooting stops — the barn goes quiet
- Player may now tap
- A subtle ambient shift signals the change (audio: hoot fades, slight reverb tail; visual: rafter glow fades)
- No explicit "GO" indicator — the silence itself is the cue (consistent with the hearing-based theme)
- Optional: visual sound cue for accessibility (small musical note or wave icon appears, fades)

**Player chooses:**

| Action | Input | Outcome |
|---|---|---|
| 3 taps (fast) | Spacebar ×3 | Move 1 step forward |
| 8 taps (fast) | Spacebar ×8 | Move 2 steps forward |
| Wrong count | Any other number | Swooped (see SWOOPED) |
| Hoot mid-sequence | Hoot begins before count resolves | Swooped |
| No input | Silence window expires | No movement, no penalty — wait for next window |

**No-input is always safe.** The player can choose to wait out a window if uncertain. This is a valid conservative strategy.

---

### 6.4 Tap Visual Feedback (During Silence Phase)

| Tap count | Visual |
|---|---|
| 1 | Small yellow energy aura around avatar |
| 2 | Yellow aura, slightly larger |
| 3 | Bright green flare — clean burst (move 1 step triggered) |
| 4 | Yellow aura resets, smaller |
| 5–7 | Yellow aura grows incrementally |
| 8 | Large sparkly green aura — step triggers, count resets |

The aura system gives the player a visual tap counter without displaying a number — they learn to *feel* the count by the aura state, which reinforces the sensory theme.

After a successful 3 or 8, the avatar dashes forward to the next hiding object. Brief movement animation (~0.4s), then settles behind cover.

---

### 6.5 SWOOPED

Triggered by:
- Tapping during a hoot
- Hooting begins mid-sequence
- Wrong tap count resolves (any count other than 3 or 8)

**Sequence:**
1. Owl swoops down from rafters — fast diagonal animation across screen
2. Screen shakes briefly
3. Avatar is grabbed and dragged back 2 steps (floor: step 0)
4. Owl drops avatar at new position — avatar lands in a daze (brief star animation)
5. **Lockout begins:** hooting continues through the lockout period — player cannot tap
6. Lockout ends when the current hoot phase naturally ends — avatar dusts itself off (brief animation), ready for next silence window

**Swoop cost:**
- -2 steps (floor: 0 — cannot go below start)
- Lockout means at minimum one full silence window is lost

---

## 7. Timing System

### 7.1 Sin Function for Silence Window Durations

Within each 8-window cycle, silence durations are mapped using:

```
duration(i) = min_silence_ms + (max_silence_ms - min_silence_ms) × 0.5 × (1 - cos(θ(i)))
```

Where `i` = window index (1–8) and `θ(i)` maps i across 0 → 2π over the cycle.

This produces a smooth wave: 2 peaks at `max_silence_ms`, 2 valleys at `min_silence_ms`, and 4 intermediate values. The player can learn the rhythm across the cycle.

**Window order within each cycle is shuffled slightly** — the sin values are computed then assigned to windows with ±1 position jitter, so the pattern is learnable but not mechanically exact.

### 7.2 Adaptive Difficulty

After each full 8-window cycle, check player progress:

```
if steps_completed < 5 (halfway):
    min_silence_ms += 100
    max_silence_ms += 100
    (apply clamps: min ≤ 1000, max ≤ 2500)
```

This can apply after multiple consecutive below-halfway cycles, compounding the adjustment. A player who is consistently struggling will find windows gradually more generous.

**Logged:** each adjustment is recorded so RADlab can see whether and how often calibration shifted.

---

## 8. Progress and Hiding Objects

10 hiding spots line the barn floor between start and the far door. Each is a distinct barn object:

1. Small hay bunch
2. Worn leather boot (enormous from the mouse's perspective)
3. Wooden bucket, tipped slightly
4. Coil of rope
5. Another hay bale, larger
6. A cracked clay pot
7. A rusted lantern (unlit)
8. A wooden crate, lid ajar
9. A heap of burlap sacking
10. The barn door frame itself (goal)

**Visual logic:** When the avatar reaches a hiding spot, it ducks behind it. While behind cover, it is visually sheltered — owl silhouettes in rafters do not orient toward it. This is purely narrative (there is no actual safety mechanic tied to cover position) but reinforces the sense of progress and safety.

A faint position indicator (paw prints on the floor, or a subtle path marking) shows how far across the barn the player has travelled.

---

## 9. Scoring

### 9.1 Primary Metric: Time to Cross

`crossing_time_ms` = timestamp at step 10 − timestamp at CALIBRATION_COMPLETE

Displayed to player as the primary score. Lower is better.

**Time tiers:**

The time tiers are computed relative to a theoretical minimum — the fastest possible crossing time given the player's calibration and the sin cycle. This normalises for individual differences in tap speed.

| Performance vs. theoretical minimum | Tier | Owl reaction |
|---|---|---|
| Within 125% | Master of Silence | *"You are uncomfortably competent."* |
| 125–175% | Owl Approved | *"Not bad. For something without wings."* |
| 175–250% | Adequately Stealthy | *"You made it. We choose not to be embarrassed."* |
| 250%+ | Lucky Mouse | *"We had you. We simply chose not to try."* |

### 9.2 Internal RADlab Metric: Adaptive Strategy Efficiency

Tracked silently, not displayed.

Per trial, record:
- `window_duration_ms` (the actual silence window length)
- `window_type`: `"short"` (< max_silence_ms) or `"long"` (≥ max_silence_ms)
- `player_choice`: `"3tap"`, `"8tap"`, `"no_input"`, or `"swoop"`
- `optimal_choice`: `"3tap"` if short, `"8tap"` if long

```
efficiency_score = informed_optimal_choices / total_actionable_windows
```

Where `total_actionable_windows` excludes swoop-lockout windows and no-input windows.

A secondary breakdown:
- `long_window_8tap_rate`: how often player chose 8 when they should have
- `short_window_3tap_rate`: how often player played safe on short windows
- `short_window_8tap_swoop_rate`: how often player over-reached on short windows (greedy failure)

---

## 10. Mindfulness Pause

Fires after BARN_CROSSED, before RESULTS.

**Prompt:**
> *Before you go —*
> *The owls were loud. But the silence between hoots —*
> *did you notice it had a shape? A rhythm?*
> *Some silences longer, some shorter.*
> *What did you listen to — the sound, or the quiet?*

**Hidden rewards:**

| Wait time | What happens | Bonus |
|---|---|---|
| 5s | Continue button appears | — |
| 30s | Owls descend from rafters and perch nearby, tilting heads in sync with an imagined hoot rhythm | Time bonus: −5s from displayed crossing time |
| 60s | Owls and mouse avatar begin to glow; the whole barn pulses softly with warm amber light | Additional −10s from displayed crossing time |

Time bonuses rather than points, consistent with the primary metric being time.

---

## 11. Results Screen

- Crossing time displayed prominently
- Owl tier name and reaction quote
- Subtle breakdown toggle: swoop count, 8-tap success rate, windows used vs. skipped
- If mindfulness bonuses reached: small glowing owl badge on results card
- **"Return to Safari"** and **"Try Again"** buttons

---

## 12. Visual Design

**Palette:**
- Background: deep warm brown-black (`#0d0905`) — barn wood in near-darkness
- Ambient rafter glow (hoot): deep amber-red (`#7a2800`) — atmospheric, not alarming
- Silence phase: glow fades to near-black, subtle blue moonlight from gaps in barn roof
- Avatar (mouse): warm grey, expressive, small
- Hiding objects: desaturated barn colours — straw gold, rust brown, clay grey
- Tap aura — yellow: `#f5c842`; green (3-tap): `#7fd46a`; green (8-tap): `#a8ff87` with sparkle particles

**Owls:**
- Silhouette style in rafters — large, dark shapes, just their eyes visible (amber, forward-facing)
- When swooping: full form visible briefly, wings spread, fast diagonal motion
- During mindfulness 30s: descend slowly, perch on hay bales, head-tilt animations

**Atmosphere:**
- Dust motes floating in shafts of moonlight from barn roof gaps
- Hay wisps drifting occasionally
- Subtle parallax on barn wall planks as player progresses

---

## 13. Audio Design

| Event | Sound |
|---|---|
| Hoot phase | Layered owl hoot, directional variation (left/right), overlapping 3–5s |
| Silence phase onset | Hoot fades with reverb tail, brief ambient settle |
| Tap (1–2, 4–7) | Soft energy pulse, slight pitch rise per tap |
| 3-tap success | Clean chime burst, forward step whoosh |
| 8-tap success | Larger chime cascade, faster step whoosh |
| Wrong count / mid-hoot | Hoot intensifies sharply, swoop wing beats |
| Swoop | Rapid wing flap, avatar squeak, landing thud |
| Lockout | Sustained hoot continues, avatar audio: ruffling, dusting off |
| Barn crossed | Brief triumphant mouse squeak, distant owl grumble |
| Mindfulness 30s | Owl feather rustle, soft landing sounds |
| Mindfulness 60s | Low resonant hum, warm ambient tone |

All audio optional — visual cues (aura system, rafter glow) carry the game without sound.

---

## 14. Supabase Data Schema

**`game_sessions` row:**
```json
{
  "user_id": "uuid or anonymous_id",
  "game_id": "owl_barn",
  "session_number": 2,
  "completed": true,
  "crossing_time_ms": 84200,
  "crossing_time_adjusted_ms": 79200,
  "owl_tier": "Owl Approved",
  "calibration_3tap_ms": 520,
  "calibration_8tap_ms": 1340,
  "min_silence_ms": 570,
  "max_silence_ms": 1675,
  "swoop_count": 3,
  "difficulty_adjustments": 1,
  "mindfulness_duration_ms": 38000,
  "mindfulness_bonus_reached": "30s",
  "created_at": "timestamp"
}
```

**`trials` rows (one per silence window):**
```json
{
  "session_id": "uuid",
  "cycle_number": 1,
  "window_index": 4,
  "window_duration_ms": 1620,
  "window_type": "long",
  "player_choice": "8tap",
  "optimal_choice": "8tap",
  "outcome": "success",
  "steps_before": 4,
  "steps_after": 6,
  "response_onset_ms": 210
}
```

**`performance` row:**
```json
{
  "session_id": "uuid",
  "efficiency_score": 0.72,
  "long_window_8tap_rate": 0.80,
  "short_window_3tap_rate": 0.91,
  "short_window_8tap_swoop_rate": 0.09,
  "no_input_rate": 0.12,
  "swoop_count": 3,
  "cycles_completed": 2,
  "difficulty_adjustments_applied": 1
}
```

---

## 15. Open Questions (Deferred)

- Whether the rafter glow is sufficient as a hoot indicator, or whether a more explicit UI element (e.g. a sound-wave icon) is needed for accessibility — test in playtesting
- Whether swoop count should factor into the displayed tier (vs. purely time-based) — current spec is time-only, swoop count in breakdown
- Mobile tap adaptation — spacebar → screen tap zone, aura feedback sizing
- Whether the 10 hiding objects should be procedurally varied per session or always in the same order

---

*Spec version 1.0 — Sensory Safari / Owl Barn*
*Ready for implementation*
