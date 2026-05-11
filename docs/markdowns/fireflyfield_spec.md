# Sensory Safari — Exhibit Six: The Firefly Field
### Full Design Specification

---

## 1. Overview

**Exhibit name:** The Firefly Field  
**Primary sense:** Sight — and the synthesis of all five senses  
**Unlock condition:** Only accessible after all five preceding exhibits are completed  
**Core mechanic:** Two phases — Phase 1: a sense-invocation ceremony with one character per exhibit; Phase 2: a sky-painting memory game using five sense-coded firefly jars to reveal a poetic message  
**Session length:** Open-ended — ends when the full message is revealed  
**Completion:** Always completable — celebratory regardless of score, points cannot go below zero  
**Primary metric:** Sky sectors correctly lit on first attempt; total fireflies retained  
**Data destination:** Supabase `game_sessions`, `trials`, `performance` tables  

---

## 2. Narrative

> *Oh thank goodness. This safari was amazing. But not exactly what you thought it would be.*
>
> *And now you're finally somewhere peaceful. A beautiful quiet field. Lush trees. The starry night sky above.*
>
> *No strange animals in sight.*
>
> *Wait — are the stars moving?*
>
> *No. Those are fireflies.*
>
> *And they seem to have something to say.*

---

## 3. State Machine

```
IDLE
  └─> CEREMONY_INTRO
        └─> [for each sense 1–5]
              CHARACTER_PROMPT
                └─> SENSE_FOCUS_WAIT (min 5 seconds)
                      └─> PLAYER_CONFIRMS
                            └─> FIREFLY_RING_APPEARS
                                  └─> [all 5 complete]
                                        CONVERGENCE_AURA
                                          └─> SKY_TRANSITION
                                                └─> SKY_PAINTING
                                                      └─> [message complete]
                                                            GAME_OVER
                                                              └─> FINAL_CEREMONY
                                                                    └─> MINDFULNESS_PAUSE
                                                                          └─> RESULTS
                                                                                └─> SAFARI_MAP
```

---

## 4. Phase 1 — The Sense Invocation Ceremony

### 4.1 Ceremony Intro

The field is dark and still. Five silhouettes emerge from the treeline — the bat, owl, raccoon, opossum, and skunk from the previous exhibits. They arrange themselves in a gentle arc around the player position.

Each character's expression conveys their relationship with the player:
- **Bat:** Arms crossed, one eyebrow raised — grudging respect. *"You were faster than expected. Barely."*
- **Owl:** Imperious head tilt, steady gaze — cold acknowledgement. *"You listened. Eventually."*
- **Raccoon:** Leaning back in chair they somehow brought, appraising — cautious respect. *"You understood garbage. That means something."*
- **Opossum:** Paw over heart, visibly moved — warm affection. *"You found every single baby. I won't forget that."*
- **Skunk:** Small, sincere, tail held high — genuine fondness. *"You tasted the world for us. That was kind."*

After a brief beat, they speak together: *"Before you go — we have one more thing to ask."*

They step forward one at a time.

---

### 4.2 Character Prompts (One Per Sense)

Each character delivers their prompt, and the player must focus on the named sense before pressing the button. A minimum 5-second wait is enforced before the confirm button appears. Each prompt has its own visual and audio texture carried over from its original exhibit.

---

#### 4.2.1 Bat — Hearing → The Voice Within

**Visual texture:** Near-black screen, faint sonar ripples pulsing outward from the bat's position. Concentric rings in the dark, just lighter than the background — the bat cave aesthetic.

**Audio texture:** Low ambient cave hum, distant drip, a single sonar chirp pulse every few seconds.

**Prompt:**
> *"You learned to hear us in the dark.*
> *Now go further.*
> *Can you go past sound — to the voice within?"*

**Confirm button label:** *"I hear it."*

**On confirm:** A ring of amber fireflies spirals outward from the player position and settles gently around them.

---

#### 4.2.2 Owl — Sight → The Light Within

**Visual texture:** Dark barn shadows, barn rafters faintly visible, the owl's amber eyes glowing at the edge. Slow dust motes drift in a narrow shaft of moonlight — the owl barn aesthetic.

**Audio texture:** Distant owl hoot, barn creak, hay rustle.

**Prompt:**
> *"You learned to see in the silence.*
> *Now go further.*
> *Can you go past sight — to the light within?"*

**Confirm button label:** *"I see it."*

**On confirm:** A ring of cool blue fireflies spirals outward and settles around the existing amber ring.

---

#### 4.2.3 Raccoon — Smell → The Air Within

**Visual texture:** Dark alleyway bricks faintly visible, smell waves drifting upward from somewhere off-screen, warm amber candle glow at the edges — the trash pile aesthetic.

**Audio texture:** Alley ambience, distant cat, soft wind, faint rummaging.

**Prompt:**
> *"You learned to smell what we love.*
> *Now go further.*
> *Can you go past smell — to the air within?"*

**Confirm button label:** *"I smell it."*

**On confirm:** A ring of green fireflies joins the others.

---

#### 4.2.4 Opossum — Touch → The Feeling Within

**Visual texture:** Tall dark grass swaying gently, starry sky above, the faintest warm cursor-glow drifting through the field — the opossum hut aesthetic.

**Audio texture:** Crickets, wind through grass, soft rustle, distant frog.

**Prompt:**
> *"You learned to feel what you couldn't see.*
> *Now go further.*
> *Can you go past touch — to the feeling within?"*

**Confirm button label:** *"I feel it."*

**On confirm:** A ring of warm rose-pink fireflies joins the others.

---

#### 4.2.5 Skunk — Taste → The Life Within

**Visual texture:** Warm machine glow, brass and copper tones at the edges, the faintest slider-icon shimmer — the skunk den aesthetic.

**Audio texture:** Low mechanical hum, soft pressure release, den ambience.

**Prompt:**
> *"You learned to taste what couldn't be touched.*
> *Now go further.*
> *Can you go past taste — to the life within?"*

**Confirm button label:** *"I taste it."*

**On confirm:** A ring of golden fireflies joins the others.

---

### 4.3 Convergence Aura

All five rings of fireflies are now surrounding the player — amber, blue, green, rose, gold.

A brief beat of stillness. Then all five rings begin to rotate slowly, interweaving. Their colours blend at the edges. A soft building audio tone rises.

The five animal characters watch from the treeline. They nod — a small, unified gesture.

The aura builds to a peak, then expands outward in a soft pulse —

— and the scene dissolves into the night sky.

---

## 5. Phase 2 — Sky Painting

### 5.1 Scene Layout

A wide open night sky. Stars visible. No horizon — the player is looking upward, surrounded by the field.

Five firefly jars float in a gentle arc at the bottom of the screen, each glowing in its sense colour:

| Jar | Sense | Colour | Label |
|---|---|---|---|
| 1 | Hearing | Amber | 👂 Ears |
| 2 | Sight | Cool blue | 👁 Eyes |
| 3 | Smell | Green | 👃 Nose |
| 4 | Touch | Rose-pink | ✋ Hand |
| 5 | Taste | Gold | 👄 Mouth |

Each jar contains a portion of the firefly message. The full message is:

> *You heard what wasn't said.*  ← Ears jar
> *You felt what couldn't be touched.*  ← Hand jar
> *You smelled the world's secrets.*  ← Nose jar
> *You tasted what was lost.*  ← Mouth jar
> *You saw what hides in the dark.*  ← Eyes jar
> *This place is yours now.*  ← shared across all jars, final sectors
> *Take care of us.*  ← shared
> *— Your animals*  ← shared

---

### 5.2 Grid System

The sky is mapped to a **6×8 grid = 48 sectors**. Grid lines are invisible — the sky looks like uninterrupted stars.

**Sector assignment:**
- 48 sectors divided among 5 jars
- Each sector belongs to exactly one jar
- Assignment is randomised each session
- Approximate distribution: ~9–10 sectors per primary sense jar; ~6 sectors shared for the final three lines (distributed across all jars equally)
- No sector belongs to more than one jar

The player cannot see which sectors belong to which jar except during the brief peek window.

---

### 5.3 Jar Interaction — The Peek Window

**Click a jar:**
- All sectors belonging to that jar briefly illuminate in that jar's colour — a soft faint glow, not fully bright
- Glow lasts **2.5 seconds** — enough to scan and remember a cluster, not enough to map the whole jar's territory
- Grid lines remain invisible — sectors are implied by the glow patches only
- After 2.5 seconds, glow fades and sky returns to stars

**Clicking the same jar again:**
- Peek window repeats — but **-5 points per repeat click**
- No cap on repeats; points cannot go below zero

**Clicking a sky sector (not a jar):**
- If the sector belongs to the most recently viewed jar (correct guess): fireflies swarm into that sector and form part of the message. Sector is permanently lit in the jar's colour. **+10 points**
- If the sector belongs to a different jar or is empty (wrong guess): a few fireflies drift away into the dark. **-3 points** (floored at 0)
- Clicking an already-lit sector: nothing happens, no penalty

**Strategic implication:** The player wants to peek a jar, memorise as many of its sectors as possible, then click those sectors before peeking again. Efficiency is rewarded; panic-clicking is gently penalised.

---

### 5.4 Message Assembly

As sectors are correctly lit, the message assembles in firefly-formed text:

- Each correct sector in a line's cluster causes one word of that line to form — fireflies swirl into letterforms and hold
- Partially completed lines show partial words glowing faintly — the overall shape is readable before it's complete
- When a full line is complete, its text brightens and a soft chime sounds
- The final three lines (*"This place is yours now. / Take care of us. / — Your animals"*) require sectors from all five jars — they assemble last, only when enough of all five jars are lit

The assembled message grows across the sky as play progresses, building toward the full poem from all directions simultaneously.

---

### 5.5 Completion

When all sectors are lit (or when enough sectors are lit to complete the full message — minor unlit sectors in the final lines can be treated as complete once 80% of their jar's sectors are illuminated):

- All firefly text brightens simultaneously
- A slow wave of light passes across the full sky
- The five animal characters reappear at the field's edge, looking up at the message
- Splat falls off something in the background
- A long, warm, still moment

Then the final ceremony begins.

---

## 6. Final Ceremony

**The zookeeper reveal:**

The message fades except for the last three lines, which pulse gently. The five characters turn to face the player.

The bat speaks first (reluctantly): *"You proved you could use all of them."*  
The owl: *"Sight. Sound. Smell. Touch. Taste."*  
The raccoon: *"Every last one."*  
The opossum: *"We talked it over."*  
Splat (the skunk): *"We want you to stay."*

A brief pause. Then all five together:

*"Welcome to the night safari. You're the zookeeper now."*

A certificate unfurls — styled like a nature conservation document, warm parchment tone, slightly crumpled at the edges, bearing the player's name (or "New Zookeeper" if anonymous) and the night safari seal (a firefly in a jar).

---

## 7. Scoring

### 7.1 Per-Session Score

```
sky_score = (correct_first_attempt_sectors / total_sectors) × 100
jar_efficiency = 1 - (repeat_jar_clicks / total_jar_clicks)
final_score = (sky_score × 0.7) + (jar_efficiency × 30)
```

**Score tiers:**

| Score | Tier | Certificate inscription |
|---|---|---|
| 90–100 | Master of the Night | *"Demonstrated exceptional sensory memory and profound attentiveness."* |
| 70–89 | Keeper of Secrets | *"Showed careful observation and a willingness to truly feel the world."* |
| 50–69 | Friend of the Dark | *"Found their way through the night with growing confidence."* |
| 0–49 | Night Wanderer | *"Arrived curious and left a little different. That's enough."* |

All tiers receive the full certificate. The inscription changes. There is no failing rank — this is the payoff, not a test.

---

## 8. Mindfulness Pause

Fires after the final ceremony, before the results screen. The gentlest pause in the game.

**Prompt:**
> *You used all of them tonight.*
> *Sound. Sight. Smell. Touch. Taste.*
> *Which one surprised you?*
> *Which one felt most like home?*

No minimum wait enforced here — the continue button appears immediately. The pause is an invitation, not a requirement. The player has earned that trust.

**Hidden rewards:**

| Wait time | What happens |
|---|---|
| 30s | All five animals settle into the field around the player; fireflies spell out the player's safari rank in the sky |
| 60s | The whole field begins to glow; the animals look up; the firefly message pulses once more in full |

No points awarded — this is the end of the game. The rewards are purely experiential.

---

## 9. Visual Design

**Field palette:**
- Sky: deep blue-black (`#060a12`), stars dense and varied in brightness
- Fireflies: each jar's colour, soft gaussian glow, slight flicker animation
- Assembled message text: warm white (`#f5f0e8`), slightly luminous
- Certificate: warm parchment (`#f2e8d0`), dark ink, firefly-in-jar seal

**Jar design:**
- Simple glass mason jars, slightly glowing from within
- Label ribbon on each with sense icon and name
- When hovered: jar brightens slightly, a few fireflies swirl inside
- When clicked: jar tilts slightly, fireflies inside rush upward

**Sky sector glow:**
- Soft radial gradient per sector, colour-matched to jar
- Not a grid square — an organic soft patch, like light through leaves
- Sectors slightly overlap visually at edges, reinforcing the seamless sky feel

**Message text:**
- Fireflies form letterforms — not pixel-perfect type, slightly organic and irregular
- Each letter assembled by 8–12 individual firefly dots holding position
- A gentle oscillation as fireflies hover in place — alive, not static

**Certificate:**
- Appears with a slow unfurl animation
- Slightly imperfect edges, coffee-ring stain in one corner (Splat)
- Firefly seal glows faintly
- Shareable as an image (future implementation)

---

## 10. Audio Design

| Event | Sound |
|---|---|
| Field ambient | Crickets, wind, distant frogs, firefly wing hum |
| Ceremony — bat | Cave drip, sonar pulse |
| Ceremony — owl | Barn creak, hoot echo |
| Ceremony — raccoon | Alley wind, distant rummaging |
| Ceremony — opossum | Grass rustle, crickets close |
| Ceremony — skunk | Machine hum, pressure release |
| Firefly ring appears | Soft chime ring, wings |
| Convergence aura | Building tone, all five pitches blending |
| Sky transition | Gentle whoosh, tone resolves |
| Jar peek | Soft uncork, firefly flutter rush |
| Correct sector | Warm chime, firefly swarm sound |
| Wrong sector | Soft departing wing flutter, no harsh sound |
| Message line complete | Brighter chime, brief swell |
| Full message complete | Long warm tone, slow orchestral swell |
| Certificate unfurl | Paper rustle, seal stamp, warm resolution chord |
| Mindfulness 30s | All five ambient textures layered softly |
| Mindfulness 60s | Full warm glow tone, field resonance |

---

## 11. Supabase Data Schema

**`game_sessions` row:**
```json
{
  "user_id": "uuid or anonymous_id",
  "game_id": "firefly_field",
  "session_number": 1,
  "completed": true,
  "sky_score": 78.3,
  "jar_efficiency": 0.81,
  "final_score": 79.1,
  "rank_tier": "Keeper of Secrets",
  "sectors_correct_first_attempt": 37,
  "sectors_total": 48,
  "repeat_jar_clicks": 4,
  "total_jar_clicks": 22,
  "ceremony_durations_ms": {
    "bat": 8400,
    "owl": 6200,
    "raccoon": 11300,
    "opossum": 7800,
    "skunk": 9100
  },
  "mindfulness_duration_ms": 44000,
  "mindfulness_bonus_reached": "30s",
  "created_at": "timestamp"
}
```

**`trials` rows (one per sky sector click):**
```json
{
  "session_id": "uuid",
  "click_number": 14,
  "jar_last_viewed": "opossum_hand",
  "sector_row": 3,
  "sector_col": 5,
  "sector_correct_jar": "opossum_hand",
  "outcome": "correct",
  "first_attempt": true,
  "points_earned": 10,
  "time_since_jar_peek_ms": 1840
}
```

**`performance` row:**
```json
{
  "session_id": "uuid",
  "sky_score": 78.3,
  "jar_efficiency": 0.81,
  "mean_time_to_click_after_peek_ms": 2100,
  "sectors_per_jar_peek": 2.4,
  "ceremony_engagement": {
    "bat_wait_ms": 8400,
    "owl_wait_ms": 6200,
    "raccoon_wait_ms": 11300,
    "opossum_wait_ms": 7800,
    "skunk_wait_ms": 9100
  }
}
```

`ceremony_engagement` measures how long each player sat with each sense — a subtle measure of which sensory modality they found most absorbing or difficult to imagine.

---

## 12. Open Questions (Deferred)

- Whether the certificate should be shareable as a downloadable image — a nice social feature but requires image generation
- Whether ceremony_engagement data (time spent with each sense prompt) should feed back into the RADlab sensory profile across exhibits — a cross-game individual differences measure
- Splat falling off something in the background during the completion scene — needs a specific prop and timing cue
- Whether anonymous players see "New Zookeeper" on their certificate or are prompted to enter a name just for display purposes (no account required)
- Mobile adaptation — jar interaction works well on touch; sky sector selection needs generous tap targets

---

*Spec version 1.0 — Sensory Safari / Firefly Field*
*Ready for implementation*
