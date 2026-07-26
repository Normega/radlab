# Sensory Safari — Exhibit One: The Bat Cave
### Full Design Specification

---

## 1. Overview

**Exhibit name:** The Bat Cave  
**Primary sense:** Hearing / Touch (sonar as felt vibration / sound)  
**Core mechanic:** Intercept sonar communications between bats to learn their attack direction, then dodge accordingly  
**Session length:** 5 rounds, always  
**Completion:** Always completable — no fail state, just score variation  
**Data destination:** Supabase `game_sessions`, `trials`, `performance` tables  

---

## 2. Narrative

> *You've always wanted to make friends with a bat. Rabies? Never heard of her.*
>
> *But something's happening. Waves pulse through the air — and when they hit you, you understand them. The bats can communicate with you! But... what are they saying?*
>
> *Oh. Oh no.*

The bats are not interested in friendship. They are interested in making you clean their poop.

The pre-game intro establishes this via interceptable sonar waves that contain mocking commentary. Once the player has caught enough intro waves (or a timer expires), the game begins properly.

---

## 3. State Machine

```
IDLE
  └─> INTRO
        └─> ROUND_START
              └─> SONAR_PHASE
                    ├─> (player catches sonar) SONAR_CAUGHT
                    └─> (sonar expires uncaught) SONAR_MISSED
                          └─> ATTACK_INCOMING
                                └─> DODGE_WINDOW
                                      ├─> (correct dodge) DODGE_SUCCESS
                                      └─> (wrong/no input) DODGE_FAIL
                                            └─> [round < 5] ROUND_START
                                            └─> [round == 5] GAME_OVER
                                                  └─> SCORING
                                                        └─> MINDFULNESS_PAUSE
                                                              └─> RESULTS
                                                                    └─> SAFARI_MAP
```

---

## 4. Phase-by-Phase Breakdown

### 4.1 IDLE
- Dark cave screen loads
- Faint bat eyes appear and disappear at screen edges — never centred, always peripheral
- No instructions, no UI chrome
- A short ambient cave audio loop begins (dripping water, distant wing flaps)
- Player clicks anywhere to enter INTRO

---

### 4.2 INTRO

**Purpose:** Teach the sonar catch mechanic before stakes exist. Establish narrative tone.

**Behaviour:**
- Sonar ripples begin crossing the screen at the *slowest* speed (1 second travel time)
- Audio cue fires each time a ripple launches (a low-frequency chirp / pulse sound)
- Player can click/tap a ripple to "catch" it
- When caught, a text bubble appears briefly from the bat eyes with mocking commentary:
  - *"You move like you're made of mud."*
  - *"We will catch you so fast."*
  - *"You'll be cleaning the East Cave. Trust."*
  - *"My grandmother is faster. She's a rock."*
- 4–6 intro waves fire in sequence (enough for the player to definitely catch at least one)
- After all intro waves have fired, a beat of silence, then all bat eyes snap open (red), and the intro ends
- Transition text (brief, centre screen, auto-advances): **"They've spotted you. Time to prove them wrong."**
- Fade to ROUND_START

**No skip button.** The intro is part of the experience. But it is short.

---

### 4.3 ROUND_START

- Round counter updates (e.g. faint "Round 1 / 5" in corner — minimal, unobtrusive)
- 1 second pause before sonar phase begins
- Bat eyes are visible but dim — not threatening yet

---

### 4.4 SONAR_PHASE

**Duration:** Variable. The sonar wave launches, travels across the screen, and expires. The player has the travel window to catch it.

**Sonar wave behaviour:**
- One ripple launches from one side of the screen toward the other
- Visual: concentric expanding rings, slightly lighter than the cave background — visible but subtle
- Travel time starts at **1 second** in session 1, scaling down across sessions (see Section 7: Difficulty Scaling)
- Audio: a directional chirp fires on launch (left or right channel depending on origin side)
- The wave carries a message. If caught, the message is revealed as brief voiced/text overlay:
  - *"Attack from the left!"* or *"Attack from the right!"*
  - The sonar **always tells the truth**
- If uncaught, the wave exits screen silently. Player has no intel.

**Catching the sonar:**
- Click/tap anywhere on the ripple while it is in motion
- Hit detection: the full ring arc is clickable, not just the leading edge — generous hitbox
- Catching is confirmed by a brief visual pulse and audio "absorption" sound (something satisfying — a warm thud or resonance)

---

### 4.5 ATTACK_INCOMING

- ~0.5 second after sonar expires (caught or not)
- All bat eyes in the periphery open simultaneously — red
- Screen pulses very slightly (dark red vignette flash)
- Optional: a rising audio tension cue (short, sharp)

---

### 4.6 DODGE_WINDOW

**Duration:** Fixed at **2 seconds** across all sessions and all players.

**UI elements that appear:**
- Large **DODGE!** text centre screen (high contrast — white or amber on black)
- Two buttons: **← DIVE LEFT** and **DIVE RIGHT →**
- A 2-second progress bar depletes beneath them (visual urgency without being punishing)
- Buttons are large, accessible, keyboard-navigable (left arrow / right arrow keys also valid)

**If player inputs within 2 seconds:**
- Proceed to DODGE_SUCCESS or DODGE_FAIL depending on correctness
- The correct direction is the **opposite** of the announced attack side
  - "Attack from the left" → correct dodge is **right**
  - "Attack from the right" → correct dodge is **left**
- If sonar was missed, the correct direction is still determined by the random attack — player is guessing

**If player does not input within 2 seconds:**
- Treated as a failed dodge (grabbed by default)
- Proceed to DODGE_FAIL

---

### 4.7 DODGE_SUCCESS

**If sonar was caught (informed correct):**
- Player dives dramatically in correct direction
- Bats swoop through empty space, audible wing beat, frustrated chittering
- Brief text: *"Too slow, bats."*

**If sonar was missed (lucky correct):**
- Same visual, but bats sound slightly more annoyed
- Brief text: *"Lucky..."* (the bats know)

- Short beat, then advance to next round

---

### 4.8 DODGE_FAIL

- Bats grab player — brief dramatic animation (screen shakes, darkness floods in from sides)
- Bat laughter audio: *"HAHAHAHA"*
- Text bubble from bat eyes: randomised humiliation lines:
  - *"Magnificent. Truly."*
  - *"We have caught a very slow human."*
  - *"You moved directly into us. Incredible."*
  - *"The poop cleaning begins at dawn."*
- Duration: ~1.5 seconds, then auto-advance to next round
- **No lives lost.** This is just a round result.

---

### 4.9 GAME_OVER → SCORING

After round 5 resolves (success or fail), game pauses briefly before the mindfulness moment.

**Score is calculated as follows:**

| Metric | Tracked |
|---|---|
| `rounds_total` | Always 5 |
| `sonar_caught` | Count of rounds where sonar was intercepted |
| `dodges_correct` | Count of rounds where dodge direction was correct |
| `informed_correct` | Rounds where sonar was caught AND dodge was correct |
| `lucky_correct` | Rounds where sonar was missed AND dodge was correct |
| `dodge_window_ms` | Fixed this session, stored for reference |
| `sonar_speed_ms` | Travel time this session (for calibration) |

**Bat Respect Score (primary display metric):**

The game shows a single **Bat Respect** rating. This is weighted to reward *informed* correct dodges more than lucky ones:

```
base_score = (dodges_correct / 5) × 100
intel_bonus = (informed_correct / sonar_caught) × 20   [if sonar_caught > 0]
final_score = base_score + intel_bonus
```

Capped at 120 (a perfect game with perfect sonar catch rate earns a bonus above 100).

**Bat Respect tiers:**

| Score | Tier | Bat reaction |
|---|---|---|
| 0–39 | Poop Cleaner | *"Report to the East Cave immediately."* |
| 40–59 | Tolerated | *"You may exist. For now."* |
| 60–79 | Acknowledged | *"Hmm. Adequate."* |
| 80–99 | Respected | *"You are... not entirely useless."* |
| 100–120 | Honorary Bat | *"We did not expect this. We are experiencing feelings."* |

---

## 5. Mindfulness Pause

Fires between GAME_OVER and RESULTS. Cannot be skipped immediately.

**Structure:**

- Screen dims to near-black
- A single sonar ripple pulses slowly outward from centre — slow, gentle, ambient
- Text appears (fade in, centred):

> *Before you go —*
> *What did that sonar feel like when it hit you?*
> *Was it closer to sound? To touch?*
> *A vibration you heard, or heard through your skin?*

- After **5 seconds**, a faint **"Continue →"** appears at bottom

**Hidden rewards:**

| Wait time | What happens | Bonus |
|---|---|---|
| 5s | Continue button appears | — |
| 30s | Bats emerge from darkness, perch nearby, mime sonar-sending with little wings | +10 points |
| 60s | Bats and player begin to glow softly (bioluminescent pulse in sync) | +20 points |

The bonus points add to the final Bat Respect Score. A player who pauses long enough can tip into the next tier.

**The 30s and 60s rewards are not telegraphed in advance.** They are discovered by waiting. Replayability and word-of-mouth.

---

## 6. Results Screen

- Bat Respect tier displayed prominently (with tier name and bat reaction quote)
- Score breakdown available as a toggle (not shown by default — keeps it clean)
  - Shows: sonar caught, informed dodges, lucky dodges
- If player hit 30s or 60s pause threshold: a small glowing bat badge appears on the results card
- **"Return to Safari"** button → back to hub map
- **"Try Again"** button → restart at INTRO (sonar speed resets to prior session calibration)

---

## 7. Difficulty Scaling (Sonar Speed)

Sonar speed is the **only** scaling variable. Dodge window stays fixed at 2 seconds.

| Session | Sonar travel time | Notes |
|---|---|---|
| 1 (first ever) | 1000ms | Slow, learnable |
| 2 | 850ms | Slight increase |
| 3 | 700ms | Noticeably faster |
| 4+ | 600ms floor | Does not decrease further |

**Calibration logic:**
- If player caught ≥ 4/5 sonar waves last session → decrease travel time by 150ms next session
- If player caught ≤ 2/5 → keep same or slow by 100ms
- If player caught 3/5 → keep same
- Floor: 600ms. No player should face an impossible task.

Session data stored in Supabase and retrieved on load. New players default to 1000ms.

---

## 8. Visual Design

**Palette:**
- Background: near-black (`#0a080f`) — not pure black, slight purple undertone
- Sonar waves: `#1e1830` to `#2d2548` — just visible against background
- Bat eyes: dim amber (`#c47a2b`) at rest, red (`#cc2200`) on attack
- DODGE text: bright amber/white (`#f5e6c8`)
- UI chrome: minimal, same amber tones, very low opacity

**Bat eyes:**
- Appear in pairs, always at screen edges and corners
- Subtle entrance/exit animations (blink in, drift slightly, blink out)
- Number of visible eye pairs increases as rounds progress (subtle tension building)
- On attack: all pairs snap open simultaneously, no animation — instant

**Sonar ripple:**
- 3–4 concentric expanding rings
- Launched from one side, travel to the other
- Slight opacity fade as they travel (they don't vanish, just attenuate)
- On catch: rings collapse inward briefly, then a soft pulse radiates from click point

**Screen shake:**
- Only on DODGE_FAIL
- Subtle — 3 frames of ±4px horizontal offset
- Never on success (clean, controlled)

---

## 9. Audio Design

| Event | Sound |
|---|---|
| Sonar launch | Low-frequency directional chirp (L or R channel) |
| Sonar catch | Warm resonant absorption — low thud with slight reverb |
| Attack incoming | Rising short tension tone |
| Dodge success | Wing beat whoosh past (close but missed) |
| Dodge fail | Bat grab — wing flap, brief shriek, then laughter |
| Intro mocking | Short voiced/synthesised bat text (or stylised text-pop SFX) |
| Mindfulness pause | Cave ambient — drip, distant wings, low hum |
| 30s bonus unlock | Soft wing flutter, small chime |
| 60s bonus unlock | Gentle resonant glow tone |

All audio optional — game is fully playable with sound off using visual cues only.  
Spatial audio (left/right channel for sonar direction) is an enhancement layer, not required.

---

## 10. Supabase Data Schema

**`game_sessions` row (on session complete):**
```json
{
  "user_id": "uuid or anonymous_id",
  "game_id": "bat_cave",
  "session_number": 3,
  "completed": true,
  "final_score": 87,
  "bat_respect_tier": "Respected",
  "sonar_speed_ms": 700,
  "dodge_window_ms": 2000,
  "mindfulness_duration_ms": 34000,
  "mindfulness_bonus_reached": "30s",
  "created_at": "timestamp"
}
```

**`trials` rows (one per round):**
```json
{
  "session_id": "uuid",
  "round_number": 3,
  "attack_side": "left",
  "sonar_caught": true,
  "dodge_direction": "right",
  "dodge_correct": true,
  "informed_correct": true,
  "response_time_ms": 840
}
```

**`performance` row (SDT-adjacent summary):**
```json
{
  "session_id": "uuid",
  "sonar_catch_rate": 0.8,
  "dodge_accuracy": 0.8,
  "informed_accuracy": 1.0,
  "lucky_accuracy": 0.0,
  "intel_utilisation": 1.0
}
```

`intel_utilisation` = informed_correct / sonar_caught — measures whether catching the sonar actually improved performance. A player who catches sonar but still guesses wrong has low utilisation; scientifically interesting.

---

## 11. Open Questions (Deferred)

- Voiced bat audio vs. stylised text-pop SFX for mocking lines — depends on audio production resources
- Exact intro wave count (4–6 suggested) — tune in playtesting
- Whether the glowing bat badge from mindfulness pause appears on the overall safari hub (as a collectible visual) — nice to have
- Mobile touch adaptation — hitbox sizing for sonar ripple on small screens

---

*Spec version 1.0 — Sensory Safari / Bat Cave*
*Ready for implementation*
