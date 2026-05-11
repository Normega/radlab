# Sensory Safari — Exhibit Three: The Opossum Hut
### Full Design Specification

---

## 1. Overview

**Exhibit name:** The Opossum Hut  
**Primary sense:** Touch (texture, resistance, warmth — simulated via cursor mechanics)  
**Core mechanic:** Search a dark grassy field for 12 hidden opossum babies using cursor drag resistance and warmth gradients; part the grass with repeated sweeps to expose and collect each baby  
**Session length:** Open-ended — ends when player finds all 12 or gives up  
**Completion:** Always completable — no fail state, rank affected by time and babies found  
**Primary metric:** Time to find all 12, with large penalties for abandoned babies  
**Internal RADlab metric:** Per-baby detection threshold (salience level at first find), search efficiency  
**Data destination:** Supabase `game_sessions`, `trials`, `performance` tables  

---

## 2. Narrative

> *The opossum is a beautiful, majestic, spiritual creature of the night.*
>
> *...But this mama opossum is TIRED. She has too many babies, and not enough time to sleep.*
>
> *She spots you as you enter. Her eyes widen.*
>
> *Guess what? You're the new babysitter.*
>
> *She chatters at you sternly and you know you better do a good job. But wait — you can hardly see anything in here, and she's tossing the little fluff balls into the soft grass below.*
>
> *Get on your knees and feel around for their squirmy squishy little bodies.*

---

## 3. State Machine

```
IDLE
  └─> INTRO_ANIMATION
        └─> SEARCHING
              ├─> SWEEP_IN_PROGRESS (per baby zone)
              │     ├─> GRASS_PARTS (reveal frames)
              │     ├─> GRASS_CLOSES (cursor leaves zone)
              │     └─> BABY_FOUND (60% exposed)
              │           └─> BABY_REUNITED (animates to mama)
              ├─> [all 12 found] GAME_OVER
              └─> [player gives up] GAME_OVER
                    └─> SCORING
                          └─> MINDFULNESS_PAUSE
                                └─> RESULTS
                                      └─> SAFARI_MAP
```

---

## 4. Phase-by-Phase Breakdown

### 4.1 IDLE

- Dark field loads: tall grass, starry night sky, distant treeline
- Mama opossum visible at right edge of screen — tired but alert, babies clustered around her
- Ambient audio: crickets, soft wind through grass, occasional frog
- Player clicks to enter intro

---

### 4.2 INTRO_ANIMATION

- Mama opossum scoops up babies one by one and tosses them gently into the field
- Each baby lands with a soft thud and disappears into the grass
- 12 tosses, staggered, babies landing across the full field area
- Baby landing positions are randomised each session (within salience-zone constraints — see Section 6)
- After the last toss, mama crosses her arms and stares at the player
- Text appears: *"Well? Get in there. Touch some grass."*
- Custom cursor activates — real cursor hidden, replaced with soft glowing hand
- SEARCHING phase begins

---

## 5. Cursor System

### 5.1 Custom Cursor

The real OS cursor is hidden via CSS (`cursor: none`). A custom cursor element — a small soft-glowing hand or fingertip — is rendered as a DOM element and updated via JavaScript on `mousemove`.

The custom cursor uses **lerp (linear interpolation)** to chase the real mouse position:

```javascript
customX += (realMouseX - customX) * lerpFactor
customY += (realMouseY - customY) * lerpFactor
```

`lerpFactor` ranges from 0.08 (high drag, very sticky) to 0.32 (low drag, nearly instant follow). Base value (open field, no baby nearby) is 0.25.

All interaction logic — sweep detection, warmth display, reveal progress — runs off the **custom cursor position**, not the real mouse position.

### 5.2 Drag Resistance

Drag is implemented by reducing `lerpFactor` in resistance zones.

- Open field (no zone): `lerpFactor = 0.25`
- Baby zone — scales with baby salience level (1 = most subtle, 12 = most obvious):

```
lerpFactor = 0.25 - (salience_level / 12) × 0.17
```

| Salience level | lerpFactor | Feel |
|---|---|---|
| 1 (most subtle) | 0.24 | Barely perceptible |
| 6 (mid) | 0.17 | Noticeably sticky |
| 12 (most obvious) | 0.08 | Strong resistance, cursor lags clearly |

Resistance ramps in as the cursor enters the zone radius (smooth interpolation at zone edge, no hard boundary).

### 5.3 Warmth Gradient

The custom cursor shifts colour subtly as it enters a baby zone. Warmth is a secondary cue — present but understated.

- Open field: cursor glow colour `#d0cfc8` (cool grey-white)
- At zone edge: begins shifting toward `#e8c89a` (faint amber)
- At zone centre: `#f0b87a` (warm amber) — visible but not obvious

Warmth shift is proportional to distance from zone centre, same radius as resistance. It is intentionally subtle — players who notice it gain an advantage but it does not dominate the experience.

---

## 6. Baby Placement and Salience System

### 6.1 Salience Gradient

12 babies are assigned salience levels 1–12 before each session. Salience level determines the strength of resistance and warmth cues. Level 12 is the easiest to find (strongest cues), level 1 the hardest (subtlest cues).

Salience levels are **fixed per session** — they do not change mid-game. This is the experimental variable.

### 6.2 Spatial Placement

Baby positions are **randomised each session** within the following constraints:
- Field is divided into a loose grid of placement zones (4 columns × 3 rows = 12 zones)
- One baby is placed per zone, within a randomised position inside that zone
- This prevents clustering and ensures field-wide coverage
- Salience levels are randomly assigned to zone positions each session — so a player cannot learn "the hard baby is always top-left"

Zone radius (the area within which resistance and warmth activate): ~8–10% of screen width. Babies within the same row do not have overlapping zones.

### 6.3 What the Player Experiences

The player notices the cursor slowing and warming as they approach a zone. They must then sweep back and forth to part the grass. Highly salient babies (level 12) will be found almost by accident — strong drag and warm colour are hard to miss. Level 1 babies require deliberate, slow, attentive searching — the drag difference is barely there.

---

## 7. Grass Parting Mechanic

### 7.1 Sweep Detection

A sweep is counted when the custom cursor:
1. Enters a baby zone
2. Travels across the zone (minimum travel distance: 40% of zone diameter)
3. Exits or reverses direction

Each valid sweep adds 20% to the zone's reveal progress.

**Reset rule:** If the custom cursor moves more than 20% of screen width from the zone centre in any direction, reveal progress decreases at **20% per second** until it returns to 0% or the cursor re-enters the zone.

This means:
- 3 consecutive sweeps without wandering → baby found (60% exposed)
- Wandering mid-reveal → progress drains, must restart sweeps
- Slow deliberate back-and-forth is rewarded; erratic searching is not

### 7.2 Grass Animation Frames

Each baby zone has a layered grass overlay rendered on canvas or as stacked sprite frames.

| Reveal % | Frame | What's visible |
|---|---|---|
| 0% | Frame 0 | Full grass, nothing visible |
| 20% | Frame 1 | Grass beginning to part, glimpse of dark soil/rock |
| 40% | Frame 2 | Grass clearly parted, soil/rock visible, hint of fur at edge |
| 60% | Frame 3 | Baby clearly visible — trigger found event |
| Found flourish | Frame 4 (one-time) | Grass parts fully and quickly, baby springs up |

Frame 4 plays only on the found event — a quick (~0.3s) full-reveal flourish before the reunion animation. It is never part of the standard parting loop.

**Closing animation:** When cursor leaves the zone, frames play in reverse at 20% per second:
- Frame 3 → Frame 2 (1 second)
- Frame 2 → Frame 1 (1 second)
- Frame 1 → Frame 0 (1 second)

Grass "slides back into place" naturally without snapping.

### 7.3 Reveal Under the Grass

What's revealed as grass parts varies by location:
- Most zones: dark soil, pebbles, a root
- Some zones: a small rock or twig (red herring texture — resistance zones without babies are not implemented in this version, but worth flagging for future)
- Baby zones at 40%+: fur visible at edge, tiny paw, or ear tip before full reveal

---

## 8. Baby Found — Reunion Animation

When 60% is exposed:

1. Found flourish frame plays (Frame 4)
2. Baby springs up from grass — small bounce animation, wide eyes, tiny happy squeak audio
3. Baby floats/hops across the screen toward mama opossum
4. Mama's eyes light up — a small ❤️ appears above her head
5. Baby snuggles into her side
6. Mama settles slightly, then returns to watching the player
7. Baby counter updates (e.g. subtle "3/12" somewhere minimal in the corner)

Each reunion is brief (~1.5 seconds) and satisfying. The field continues to be searchable during reunion animation — no pause.

---

## 9. Mama Opossum Reactive States

Mama has several reactive states that fire based on elapsed time and babies found. These are not hints — they are flavour and comic pressure.

**On baby found:**
- Small ❤️ above head, brief relieved expression
- Occasional murmured line: *"There's one... okay... keep going..."*

**Impatience escalation (time-based):**

| Elapsed time | Mama behaviour | Sample line |
|---|---|---|
| 0–60s | Alert, watching | — |
| 60–120s | Tapping foot | *"Any time now."* |
| 120–180s | Arms crossed, tsk tsk | *"My grandmother could find them in the dark. She was blind."* |
| 180–240s | Pointed stare | *"Touch. The. Grass."* |
| 240s+ | Theatrical sighing | *"I chose the wrong babysitter. I really did."* |

**Occasional unprompted coaching (not directional):**
- *"Really get in there. Feel around."*
- *"Slow down. You're missing things."*
- *"They're in the grass. The grass. Are you looking at the sky?"*

Lines fire at random intervals (not too frequently — every 40–60 seconds if no baby has been found recently).

---

## 10. Scoring

### 10.1 Primary Metric: Adjusted Time Score

Base time = seconds from SEARCHING start to GAME_OVER.

**Penalties for abandoned babies:**

```
penalty_per_missed_baby = base_time × 0.4
adjusted_time = base_time + (missed_babies × penalty_per_missed_baby)
```

This means missing babies is extremely costly relative to time. A player who finds all 12 slowly will generally outscore one who abandons.

Example: Player takes 300s and misses 2 babies.
```
penalty = 300 × 0.4 × 2 = 240s
adjusted_time = 540s
```

### 10.2 Rank Tiers

Tiers are calibrated to expected completion time distributions from playtesting. Placeholder values:

| Adjusted time | Rank | Mama reaction |
|---|---|---|
| < 120s | Opossum Whisperer | *"Okay. You're hired. Permanently."* |
| 120–240s | Trusted Babysitter | *"Good enough. I'm going to sleep."* |
| 240–360s | Adequate | *"They're all here. I suppose that counts."* |
| 360–480s | Barely Tolerated | *"Next time I'll ask the raccoons."* |
| 480s+ / gave up | On Thin Ice | *"Don't come back."* |

### 10.3 Give Up Mechanic

A small, unobtrusive "I give up" button in the corner (or keyboard shortcut). Pressing it:
- Prompts a one-line confirm: *"Mama will remember this."*
- Confirm → GAME_OVER with missed babies logged and penalised
- Cancel → return to searching

---

## 11. Internal RADlab Metrics

Tracked silently, not displayed to player.

**Per-baby trial data:**

| Field | Description |
|---|---|
| `baby_id` | 1–12, fixed per session |
| `salience_level` | 1–12 assigned to this baby |
| `found` | Boolean |
| `time_to_find_ms` | From session start to found event |
| `sweep_attempts` | Total valid sweeps before find |
| `false_zone_time_ms` | Time spent in zones with no baby (future use) |
| `reset_count` | How many times reveal progress was reset for this baby |

**Session-level performance:**

```json
{
  "session_id": "uuid",
  "detection_threshold_estimate": 7,
  "babies_found_by_salience": [12, 11, 10, 9, 8, 7, 6, null, null, null, null, null],
  "search_efficiency": 0.71,
  "mean_sweeps_per_find": 4.2,
  "mean_time_per_find_ms": 18400
}
```

`detection_threshold_estimate` = the lowest salience level at which the player reliably found the baby (found ≥ 2 of the 3 babies at that level across sessions — accumulated over repeat plays). This is the JND-adjacent measure.

`search_efficiency` = time spent in baby zones / total search time. Low efficiency = lots of time in empty field. High efficiency = systematic or cue-guided search.

---

## 12. Mindfulness Pause

Fires after GAME_OVER, before RESULTS.

**Prompt:**
> *Before you go —*
> *When the cursor slowed — did you notice it?*
> *Was it obvious, or did you have to learn to feel it?*
> *What does resistance feel like when you can't touch anything at all?*

**Hidden rewards:**

| Wait time | What happens | Bonus |
|---|---|---|
| 5s | Continue button appears | — |
| 30s | Baby opossums tumble back out from mama and sit in a row, miming sniffing and patting the ground | −30s from adjusted time |
| 60s | All opossums and player begin to glow softly; mama looks uncharacteristically moved | −60s from adjusted time |

---

## 13. Visual Design

**Palette:**
- Background sky: deep blue-black (`#080c14`) with scattered stars
- Grass: layered deep greens (`#0d1f0e`, `#142b15`, `#1a3a1b`) — dark, textured, not flat
- Soil/rock under grass: warm dark brown (`#2a1a0e`), grey pebbles (`#3a3530`)
- Custom cursor: soft glowing hand, neutral `#d0cfc8` → warm `#f0b87a` on approach
- Mama opossum: warm grey-white, expressive face, right edge
- Baby opossums: tiny, fluffy, grey-white, wide eyes
- Heart: soft pink `#f4a0b8`, small, pops up briefly

**Grass parting:**
- Frame-by-frame sprite animation per zone
- Parting reveals a "wound" of dark soil beneath — atmospheric, slightly dramatic
- Baby becomes visible as fur/ear at 40%, full body at found flourish

**Atmosphere:**
- Fireflies drifting slowly in background (non-interactive, purely ambient)
- Stars visible through gaps in grass as player searches
- Occasional cloud drift across moon — very slow, barely perceptible

---

## 14. Audio Design

| Event | Sound |
|---|---|
| Field ambient | Crickets, wind, frogs, soft rustling |
| Cursor in resistance zone | Very subtle low friction sound — barely audible, a soft shhhh |
| Grass parting | Soft swishing, frame-synced |
| Baby found | Tiny happy squeak, brief chime |
| Baby reunion | Soft pat sound, mama exhale |
| Mama impatience lines | Delivered as text with optional voiced audio |
| Give up confirm | Mama audible tsk |
| Mindfulness 30s | Baby pattering sounds, soft sniffs |
| Mindfulness 60s | Gentle resonant warmth tone |

Audio optional — all cues have visual equivalents. The friction sound is the only audio tied directly to a gameplay mechanic and is deliberately subtle.

---

## 15. Supabase Data Schema

**`game_sessions` row:**
```json
{
  "user_id": "uuid or anonymous_id",
  "game_id": "opossum_hut",
  "session_number": 1,
  "completed": true,
  "babies_found": 10,
  "babies_missed": 2,
  "base_time_ms": 287000,
  "adjusted_time_ms": 517000,
  "mama_rank": "Barely Tolerated",
  "gave_up": false,
  "mindfulness_duration_ms": 41000,
  "mindfulness_bonus_reached": "30s",
  "created_at": "timestamp"
}
```

**`trials` rows (one per baby):**
```json
{
  "session_id": "uuid",
  "baby_id": 7,
  "salience_level": 4,
  "found": true,
  "time_to_find_ms": 34200,
  "sweep_attempts": 5,
  "reset_count": 1,
  "zone_row": 2,
  "zone_col": 3
}
```

**`performance` row:**
```json
{
  "session_id": "uuid",
  "detection_threshold_estimate": 4,
  "search_efficiency": 0.68,
  "mean_sweeps_per_find": 4.8,
  "mean_time_per_find_ms": 22100,
  "babies_found_by_salience": [1,1,1,1,1,1,0,0,1,1,0,1]
}
```

---

## 16. Open Questions (Deferred)

- Whether false-resistance zones (areas with strong drag but no baby) should be introduced in later sessions to measure signal discrimination — powerful RADlab manipulation but adds complexity
- Exact zone radius tuning — needs playtesting to feel right without being too easy or too small to find
- Mobile adaptation: cursor drag → finger swipe resistance via touch events and haptic feedback (primary reason this exhibit is desktop-first)
- Whether mama's impatience lines should be voiced or text-only — voiced adds personality but requires audio production
- Fine-tuning of penalty formula — 40% per missed baby is a placeholder; calibrate from playtesting data

---

*Spec version 1.0 — Sensory Safari / Opossum Hut*
*Ready for implementation*
