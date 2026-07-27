# Sensory Safari — Exhibit Four: The Raccoon Trash Pile
### Full Design Specification

---

## 1. Overview

**Exhibit name:** The Raccoon Trash Pile  
**Primary sense:** Smell (imagined olfactory engagement)  
**Core mechanic:** Two-phase game — Phase 1: sniff test (give each raccoon one food to smell, observe reactions); Phase 2: plate composition (assign 2 foods per raccoon, 8 placements total, confirm dinner)  
**Session length:** Open-ended — ends when player clicks "Dinner Is Served"  
**Completion:** Always completable — no fail state, score varies by match quality and variety  
**Primary metric:** Total meal enjoyment score across 4 raccoons  
**Internal RADlab metric:** Preference inference accuracy (did sniff data predict plate choices?)  
**Data destination:** Supabase `game_sessions`, `trials`, `performance` tables  

---

## 2. Narrative

> *Yes, these raccoons do have access to lush fields of green with fresh fruit trees and juicy insects of all kinds.*
>
> *But they prefer garbage. They must be from Toronto.*
>
> *They're picky though, and only the best will do. When you enter, they see the opportunity and put you to work immediately.*
>
> *You're the new trash collector. Sort through the piles and select only the most pungent items for their dinner.*
>
> *If it doesn't smell, they're just going to throw it at you. So be careful.*

---

## 3. State Machine

```
IDLE
  └─> INTRO_ANIMATION
        └─> PHASE_1_SEARCH
              └─> PHASE_1_SNIFF_ASSIGNMENT
                    └─> PHASE_1_REACTIONS
                          └─> PHASE_2_PLATING
                                └─> DINNER_IS_SERVED
                                      └─> REACTION_SEQUENCE
                                            └─> SCORING
                                                  └─> MINDFULNESS_PAUSE
                                                        └─> RESULTS
                                                              └─> SAFARI_MAP
```

---

## 4. The Raccoon Characters

Four fixed characters with shuffled preferences each session. Each character has visual and behavioural hints toward at least one liked food and one disliked food — not complete information, but enough to reward observation.

---

### 4.1 Reginald Pemberton III
**Type:** Snooty, upper-crust  
**Visual:** Small silk cravat, slicked-back fur, a tiny monocle, sits with perfect posture  
**Ambient behaviour:** Inspects his fork for smudges, occasionally sighs at the state of the tablecloth  
**Hints:**
- *Like hint:* A small wedge of aged cheese sits prominently in his breast pocket like a pocket square
- *Dislike hint:* He visibly recoils whenever a worm passes near his chair, dabbing his nose with a handkerchief

---

### 4.2 Deb
**Type:** Feral dumpster-diver, been through some things  
**Visual:** Matted fur, one ear slightly bent, a collection of bottle caps on a makeshift necklace, sauce stains of unknown origin  
**Ambient behaviour:** Gnaws on the table edge, rearranges her fork incorrectly, occasionally sniffs the air with great enthusiasm  
**Hints:**
- *Like hint:* A fish skeleton is tucked behind her ear like a pencil
- *Dislike hint:* Her expression sours faintly whenever someone mentions vegetables — a small wilted carrot near her place setting is being used as a napkin

---

### 4.3 Nana Blanche
**Type:** Refined grandmother, terrifying in her own way  
**Visual:** Pearl earrings, a small floral brooch, reading glasses on a chain, impeccable posture that somehow conveys judgment  
**Ambient behaviour:** Knits between rounds (the knitting is made of grass), occasionally nods approvingly at nothing  
**Hints:**
- *Like hint:* A small herb sprig (overgrown, slightly decomposed) is tucked into her brooch — she tends toward fermented vegetable matter
- *Dislike hint:* She has placed her butter knife very precisely on top of the fish fork, handle inward, as though barricading

---

### 4.4 Splat
**Type:** Chaotic gremlin child, no known origin  
**Visual:** Fur going in 7 directions, enormous eyes, something sticky on both paws, a bib that reads "I ♥ GARBAGE" in crayon  
**Ambient behaviour:** Bangs fork on table rhythmically, licks the plate preemptively, occasionally falls off chair and climbs back up  
**Hints:**
- *Like hint:* Has a grub balanced on their head, apparently intentionally, as a hat
- *Dislike hint:* Has pushed the cheese section of the table away from them with their fork as far as it will go

---

## 5. Food Types

Four smelly food types, each with distinct visual design and implied smell character:

| ID | Food | Visual | Implied smell |
|---|---|---|---|
| `cheese` | Aged cheese wedge | Yellow-orange, visible mould spots, smell waves thick and wavy | Sharp, pungent, fungal |
| `veg` | Rotting vegetables | Wilted greens, browning cabbage, soft spots, leaking slightly | Sour, fermented, earthy |
| `fish` | Old fish | Grey-silver, glassy eye still present, flies optional | Ammonia, brine, oceanic decay |
| `grubs` | Grubs and worms | Pale, wriggling slightly (animated), clumped in dark soil | Earthy, rich, faintly meaty |

**Non-smelly distractor objects** (partial list, can be expanded):
- Plastic bottles, glass jars, crumpled paper, old newspaper, broken toys, rubber gloves, tin cans, tangled wire, soggy cardboard, a single shoe, a deflated balloon, a novelty mug, batteries, an inexplicable spoon collection

---

## 6. Preference Shuffling

There are exactly 6 possible 2-like/2-dislike combinations across 4 food types:

| Combo ID | Likes | Dislikes |
|---|---|---|
| A | cheese + veg | fish + grubs |
| B | cheese + fish | veg + grubs |
| C | cheese + grubs | veg + fish |
| D | veg + fish | cheese + grubs |
| E | veg + grubs | cheese + fish |
| F | fish + grubs | cheese + veg |

Each session: randomly select 4 of the 6 combos, assign one to each raccoon. No two raccoons share a combo. This ensures genuine individual differences at the table every session.

The character visual hints remain constant (Reginald always hints at cheese-like and grub-dislike) but his *actual* assigned preferences vary — so a player who plays multiple times learns the hint system but not the answer.

---

## 7. Trash Pile — Layout and Interaction

### 7.1 Scene Layout

A dark alleyway at night. Four raccoons sit at a long dinner table, centre-back of screen. In the foreground: a chaotic field of spilled trash covering roughly 60% of the screen area.

Trash is layered — objects overlap, some obscure others. Larger foreground obstacles (2–3 trash cans, 1–2 cardboard boxes) must be tapped/clicked to tip over or open, dumping their contents and revealing items underneath.

**Object distribution:**
- 4 food types × 4 instances each = 16 smelly food items
- 16+ distractor non-smelly objects
- Total: 32+ objects in the pile, randomised positions each session
- Smelly food items are never fully buried under large obstacles at session start — at least 2 of each type are immediately accessible

### 7.2 Smell Waves

Smelly food items emit visual smell waves — small wavy lines rising from the object, styled per food type (cheese waves are thick and slow; fish waves are fast and sharp; veg waves are curling and greenish; grub waves are low and earthy).

**Smell waves are hidden for the first 30 seconds.** The player must imagine what smells during this window. After 30 seconds of no sniff assignment progress, faint smell waves appear on all smelly items simultaneously — a soft visual hint that does not identify the food type, just confirms "this is smelly."

### 7.3 Object Interaction

**Picking up:** Click an object to pick it up. It follows the cursor. The real cursor is visible (no custom cursor in this exhibit — this is smell, not touch).

**Putting down:** Click again to drop the object at cursor position. Objects can be repositioned freely — this is how the player uncovers buried items.

**Large obstacles (trash cans, boxes):** Click to tip/open. A brief tip animation plays, contents spill out around them. These cannot be picked up and moved.

**Sniff assignment (Phase 1 only):** While holding a food item, hover over a raccoon — a "sniff?" prompt appears above them. Click to assign this food to that raccoon for the Phase 1 sniff test. The food returns to the pile after assignment; a small icon appears above the raccoon's head showing which food type they've been assigned.

Each raccoon can only be assigned one food in Phase 1. Reassigning a raccoon replaces their previous assignment.

**Plate placement (Phase 2 only):** While holding any object, hover over a plate — a "place?" prompt appears. Click to place. Each plate holds 2 items. Items can be removed from plates by clicking them — they return to the pile.

---

## 8. Phase 1 — Sniff Test

### 8.1 Assignment

Player digs through the trash, picks up food items, and assigns one to each of the 4 raccoons. Any food type can be assigned to any raccoon — the same food type can be given to multiple raccoons.

A Phase 1 status indicator (minimal, corner of screen) shows how many raccoons have been assigned a food (e.g. small raccoon icons, filled when assigned).

When all 4 raccoons have an assignment, a **"Run Sniff Test"** button appears. Player can still change assignments before clicking it.

### 8.2 Reactions

All 4 raccoons sniff simultaneously. Each performs a reaction animation based on their assigned food and their shuffled preferences:

| Situation | Reaction | Animation | Sound |
|---|---|---|---|
| Non-smelly food | Irritated | Stares at player, taps plate, crosses arms | Unimpressed tsk |
| Liked food | Comedically delighted | Eyes go wide, spins fork, little heart, possibly falls off chair slightly | Excited chittering |
| Disliked food | Comedically disgusted | Full body recoil, tongue out, slides down chair | Retching sound, then grumble |

Reactions play out over ~2 seconds per raccoon, staggered slightly for comedic effect. After all reactions complete, a brief beat, then Phase 2 begins automatically.

**No explicit preference summary is shown.** The player must remember or infer from the reactions. There is no log or history panel — memory and inference are part of the challenge.

---

## 9. Phase 2 — Plate Composition

### 9.1 Plating

Player returns to the trash pile and composes 4 plates, 2 foods each. Any food (smelly or non-smelly) can be placed on any plate.

Phase 2 layout: the table is more prominent, plates are clearly visible with 2 slots each. The trash pile remains accessible in the foreground.

A small indicator above each plate shows current contents (0/2, 1/2, 2/2).

### 9.2 Dinner Is Served

Once the player is satisfied, they click the **"Dinner Is Served!"** button (styled dramatically — big, warm, slightly ridiculous). This triggers the reaction sequence. There is no automatic trigger — the player controls timing.

The button only appears once at least one plate has 2 items. Plates can be empty or partial — the raccoon simply gets fewer items.

---

## 10. Reaction Sequence and Scoring

### 10.1 Reaction Sequence

Raccoons react one at a time, left to right (Reginald → Deb → Nana Blanche → Splat). Each raccoon's reaction plays fully before the next begins.

For each food item on a plate, the raccoon:
1. Sniffs it
2. Reacts (same animation set as Phase 1 — like, dislike, or non-smelly irritation)
3. Points tally with a visual pop

After all items on all plates are reacted to, the total score is displayed.

### 10.2 Scoring Formula

**Per food item:**

| Situation | Points |
|---|---|
| Liked food | +30 |
| Disliked food | -15 |
| Non-smelly food | -5 (boring penalty) |

**Per-raccoon variety bonus:**

Applied after both items on a plate are scored:

| Plate composition | Bonus/Penalty |
|---|---|
| Two different liked foods | +20 variety bonus |
| One liked + one disliked | +0 (mixed — no bonus, no extra penalty) |
| Two of the same liked food | -10 (repetitive — raccoon looks mildly disappointed) |
| Two different disliked foods | -5 (variety softens the disgust slightly vs same-food) |
| Two of the same disliked food | -20 (extra disgusted) |
| Any plate with a non-smelly item | Raccoon delivers: *"None of this is even smelly. Think like a raccoon."* |

**Maximum possible score:** 4 raccoons × (30 + 30 + 20) = 320 points  
**Score of 0 or below:** Raccoons begin throwing food at the player

### 10.3 Score Tiers

| Score | Tier | Raccoon verdict |
|---|---|---|
| 260–320 | Garbage Gourmet | *"We will allow you to serve us again."* |
| 180–259 | Decent Dumpster Dive | *"Some of this was good. Some of it was an insult. We'll average it out."* |
| 100–179 | Tolerated | *"You tried. The fish helped. The rest did not."* |
| 0–99 | Questionable Palate | *"Were you even trying? There was a perfectly good rotting cabbage right there."* |
| Below 0 | Food Fight | Food begins flying. Splat leads the charge. |

---

## 11. Internal RADlab Metrics

**Preference inference accuracy:**  
After the session, compare Phase 1 sniff data to Phase 2 plate choices. For each raccoon:

- Did the player observe a *like* reaction and then place that food?
- Did the player observe a *dislike* reaction and avoid that food?
- Did the player use the sniff data at all, or did they plate randomly?

```
inference_score = (informed_correct_plates) / (total_plates_where_sniff_data_existed)
```

This measures whether the player updated their behaviour based on olfactory feedback — a genuine perceptual learning signal.

**Sniff strategy:**
- `sniff_variety`: how many different food types were used in Phase 1 (1–4)
- `repeated_food_sniffs`: how many raccoons received the same food type
- `optimal_sniff_strategy`: boolean — did player distribute sniffs across all 4 food types?

---

## 12. Mindfulness Pause

**Prompt:**
> *Before you go —*
> *Stop and imagine each food you picked up tonight.*
> *The cheese. The fish. The rotting vegetables. The grubs.*
> *Can you smell them now, just by thinking about them?*
> *That's your brain doing something remarkable.*

**Hidden rewards:**

| Wait time | What happens | Bonus |
|---|---|---|
| 5s | Continue button appears | — |
| 30s | Raccoons push back from the table and mime sniffing the air together, noses twitching in sync | +20 points |
| 60s | Raccoons and scene glow softly; Splat falls off chair in slow motion bathed in warm light | +40 points |

---

## 13. Visual Design

**Scene palette:**
- Background: deep blue-grey alley (`#0c1018`), brick texture barely visible
- Moonlight from above: narrow shaft of cool blue-white light hitting the table
- Table: dark wood, slightly sticky-looking, warm amber candle glow
- Trash pile: chaotic, colourful in a grimy way — muted greens, browns, greys with occasional bright distractor (red balloon, yellow bottle)
- Smell waves: per food type — cheese (amber/yellow, slow), fish (blue-grey, sharp), veg (green, curling), grubs (brown, low to ground)

**Raccoon designs:**
- Each character is visually distinct, consistent with their archetype
- Expressions are expressive and large — this is a reaction-driven game
- Reaction animations are big and comedic — no subtlety in Phase 1/2 reactions

**Plating UI:**
- Plates are visible on the table throughout Phase 2
- Plate slots glow faintly when a food item is being held (hover affordance)
- Placed items show as small icons on the plate

---

## 14. Audio Design

| Event | Sound |
|---|---|
| Scene ambient | Alley ambience — distant traffic, cat, wind |
| Object pickup | Rummaging, crinkling |
| Trash can tip | Metal clatter, contents spilling |
| Sniff assignment | Raccoon sniff sound (quick inhale) |
| Like reaction | Excited chittering, fork spinning |
| Dislike reaction | Retching, grumble |
| Non-smelly irritation | Unimpressed tsk, plate tap |
| Dinner is served | Tiny fanfare, cutlery clink |
| Food fight (below 0) | Splat of food, chaos, laughter |
| Mindfulness 30s | Communal raccoon sniffing, nose twitches |
| Mindfulness 60s | Warm resonant tone, Splat chair fall (slow motion thud) |

---

## 15. Supabase Data Schema

**`game_sessions` row:**
```json
{
  "user_id": "uuid or anonymous_id",
  "game_id": "raccoon_trash",
  "session_number": 2,
  "completed": true,
  "final_score": 210,
  "score_tier": "Decent Dumpster Dive",
  "preference_combos_assigned": {
    "reginald": "B",
    "deb": "F",
    "nana_blanche": "C",
    "splat": "E"
  },
  "mindfulness_duration_ms": 33000,
  "mindfulness_bonus_reached": "30s",
  "created_at": "timestamp"
}
```

**`trials` rows (one per plate item, 8 total):**
```json
{
  "session_id": "uuid",
  "raccoon_id": "reginald",
  "plate_slot": 1,
  "food_placed": "cheese",
  "food_outcome": "liked",
  "sniff_data_available": true,
  "sniff_food_tested": "fish",
  "sniff_reaction_observed": "dislike",
  "points_earned": 30
}
```

**`performance` row:**
```json
{
  "session_id": "uuid",
  "inference_score": 0.75,
  "sniff_variety": 3,
  "repeated_food_sniffs": 1,
  "optimal_sniff_strategy": false,
  "liked_foods_placed": 5,
  "disliked_foods_placed": 2,
  "nonsmelly_foods_placed": 1,
  "variety_bonuses_earned": 2,
  "food_fight_triggered": false
}
```

---

## 16. Open Questions (Deferred)

- Whether a subtle memory aid (small icon recap of Phase 1 reactions, togglable) should be offered — currently no log is shown, which is harder and more interesting but may frustrate some players
- Food fight animation scope — how elaborate should the chaos be? Could be a simple flying food overlay or a full scene-destruction moment
- Whether Splat's chair-fall should happen at random intervals during Phase 2 as ambient comedy, independent of the mindfulness pause
- Mobile adaptation — drag-and-drop vs tap-to-pick-up-tap-to-place on touch screens
- Whether non-smelly distractor objects should include any items that hint at raccoon preferences as red herrings (e.g. a clean cheese wrapper near Reginald — suggests cheese but gives no smell information)

---

*Spec version 1.0 — Sensory Safari / Raccoon Trash Pile*  
*Ready for implementation*
