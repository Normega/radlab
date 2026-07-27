# RADlab Platform — website.md
### Cross-conversation continuity document
*Last updated: Sensory Safari full design phase complete*

---

## Platform Overview

Web-based psychophysics game platform for the Regulatory and Affective Dynamics Lab (RADlab), University of Toronto. PI: Professor Norman Farb.

**Three user tiers:**
- Internal lab members (admin/dev access)
- Research participants (assigned study protocols, compensation tracking)
- General public (open signup, leaderboards, normative data)

**Stack:** React + Vite, Tailwind CSS v3, TanStack Query, Recharts, Supabase (PostgreSQL + Auth), Vercel  
**Design system:** Warm pinkish off-white background (`#FCF0F5`), white cards, pink accent (`#f068a4`), gray (`#abadb0`); DM Serif Display, Space Mono, DM Sans fonts  
**Logo:** Always use actual `RADlab_Logo.svg` / `RADlab_Logo_light.svg` — never redraw  

---

## Database Schema

**Core tables:** `profiles`, `studies`, `game_sessions`, `trials`, `performance`, `questionnaire_responses` (JSONB)

**Platform tables (new):** `anonymous_sessions`, `exhibit_bests`, `hub_state`

Key pattern: anonymous users get Supabase anonymous auth UUID on first visit. On registration, all session data migrates to their new account via `migrateAnonymousSession()`. No data is ever lost at signup.

---

## Games

### 1. Badge Inspector (complete)
Colour JND task, QUEST staircase, procedural avatars. Built as standalone HTML/JS file. Serves as template precedent for Safari architecture decisions.

### 2. Pond Watch (in progress)
Go/no-go reaction time task. Ducks = targets; herons/frogs/fish/ripples = non-targets. Built as `PondWatch.jsx` with five-phase state machine, `useRef`-based timing, SDT output (d′, criterion, hit rate, false alarm rate, median RT, RT SD, accuracy). Supabase wiring via `onSessionComplete` pending.

### 3. Sensory Safari (design complete, implementation pending)
See full spec files (all in outputs directory):
- `batcave_spec.md`
- `owlbarn_spec.md`
- `opossumhut_spec.md`
- `raccoontrash_spec.md`
- `skunkden_spec.md`
- `fireflyfield_spec.md`
- `hub_platform_spec.md`

---

## Sensory Safari — Architecture Summary

**Concept:** A night safari web game. Six exhibits, each targeting a different sensory modality through an engaging animal narrative. Scientific measurement is embedded in gameplay. Public-facing, also deployable for RADlab studies.

**Hub:** Top-down isometric illustrated park map. Bus arrival cinematic on first visit. Locations show animal states (distressed → happy) as exhibits are completed. Firefly Field unlocks only after all 5 primary exhibits complete.

**Exhibits (in order, all can be played in any order except Firefly Field):**

| # | Name | Sense | Core mechanic |
|---|---|---|---|
| 1 | Bat Cave | Hearing/Touch | Intercept sonar comms between bats, dodge left/right |
| 2 | Owl Barn | Hearing/Rhythm | Red light/green light, 3-tap vs 8-tap strategy |
| 3 | Opossum Hut | Touch | Custom cursor drag resistance + warmth gradient, sweep to reveal babies |
| 4 | Raccoon Trash Pile | Smell | Mastermind-style sniff test + plate composition dinner |
| 5 | Skunk Den | Taste | Fruit ID + flavour property sliders, tail whiteness restoration |
| 6 | Firefly Field | Sight + Integration | Sense invocation ceremony + sky memory painting |

**Curator Ranks (overall, requires registered account above Intern):**
Safari Volunteer → Intern Curator → Assistant Curator → Curator → Head Curator → Safari Director

**Mindfulness pauses:** Every exhibit has a post-game mindfulness moment. 5s minimum before continue appears. Hidden rewards at 30s and 60s (animals animate + point/time bonuses). Not telegraphed — discovered by waiting.

**Cross-game RADlab output:** `exhibit_bests` table + `performance` table per session. Six-dimensional sensory profile (hearing, sight, touch, smell, taste, integration) computed from normalised scores. `per_property_errors` in Skunk Den accumulates across sessions for gustatory JND profiling. `detection_threshold_estimate` in Opossum Hut accumulates for tactile sensitivity profiling.

---

## Sensory Safari — Key Design Decisions Locked

**Bat Cave:**
- Sonar speed scales across sessions (1000ms → 850ms → 700ms → 600ms floor)
- Dodge window fixed at 2000ms always
- 5 rounds, score = informed correct dodges weighted above lucky correct
- `intel_utilisation` metric: did catching sonar actually change behaviour?

**Owl Barn:**
- Calibration measures player's 3-tap and 8-tap speed; clamps to (300ms–1000ms) and (above min, max 2500ms)
- Sin function (8 windows/cycle, ≥2 long windows per cycle) governs silence durations
- Hoot duration random 3–5 seconds (unpredictable onset)
- Adaptive: if < halfway after full cycle, both windows +100ms
- 10 steps, swoop = -2 steps (floor 0), lockout lasts through current hoot
- Primary metric: crossing time normalised to theoretical minimum
- Internal metric: adaptive strategy efficiency (long_window_8tap_rate, short_window_3tap_rate)

**Opossum Hut:**
- Custom cursor (lerp-based drag resistance) + warmth gradient, real cursor hidden
- 12 babies, salience gradient 1–12, locations randomised per session, salience randomly assigned to locations
- 3 sweeps to expose 60% (20% per sweep), 20% per second decay when cursor leaves zone (>20% screen width away)
- 4 animation frames (0/20/40/60%), reverse on close, flourish frame on find
- Scoring: base time + 40% penalty per missed baby
- Internal metric: detection_threshold_estimate (lowest salience reliably found)

**Raccoon Trash Pile:**
- 4 food types: cheese, rotting veg, fish, grubs
- 4 raccoon characters: Reginald Pemberton III, Deb, Nana Blanche, Splat
- 6 possible 2-like/2-dislike combos; 4 selected per session, no two raccoons share a combo
- Phase 1: one sniff per raccoon (same food can go to multiple raccoons), all react simultaneously
- Phase 2: 2 foods per plate, 8 placements total, freely adjustable until "Dinner Is Served"
- Scoring: liked +30, disliked -15, non-smelly -5; variety bonuses per plate
- Internal metric: inference_score (did sniff data predict plate choices?)

**Skunk Den:**
- 10-fruit pool, 7 per session (strawberry, lemon, grape, orange, green apple, watermelon, blueberry, peach, mango, blackberry)
- 8 slider properties, 5 active per session (sweetness, sourness, firmness, juiciness, bitterness, floral/aroma, skin thickness, astringency)
- True values drawn from ranges per session (Layer 3 replayability)
- Fruit ID: 30% of score, HSL hue distance for wrong fruit partial credit
- Sliders: 70% of score, equal weighting, tail whiteness = saturation gradient
- Internal metric: per_property_errors accumulates across sessions → gustatory JND profile

**Firefly Field (unlocks after all 5):**
- Phase 1: sense invocation ceremony, one character per exhibit, 5s minimum wait per sense
- Phase 2: 6×8 grid (48 sectors), 5 sense-coded jars, random sector assignment per session
- Jar peek: 2.5 second window, -5 points per repeat peek
- Correct sector: +10 points, wrong: -3 points (floor 0)
- Message assembles as firefly letterforms across sky: 8-line poem
- Completion: zookeeper certificate + final ceremony with all 5 animals

---

## Key Technical Learnings

- **`useRef`-based timing** essential for React game loops (avoids stale closure bugs)
- **QUEST adaptive staircases** standard difficulty mechanism; dual instances for directional conditions
- **Log-linear correction** for d′ at extreme hit/false alarm rates
- **Safari/iOS compatibility:** CSS keyframes with custom properties inside SVGs fail silently; inline style tags in SVG groups fail; hook ordering violations; `foreignObject` elements. Solutions: move animations to document head, replace SVG-embedded HTML with positioned overlay divs, pre-compile JSX
- **Custom cursor (lerp):** hide real cursor via `cursor: none`, chase real mouse position with lerp factor to simulate drag resistance. All interaction logic runs off custom cursor position
- **Canvas scratch-card reveal:** paint texture over hidden sprite, erase as custom cursor passes — used for opossum grass parting
- **HSL hue distance:** `min(|h1-h2|, 360-|h1-h2|)` for circular colour space comparison

---

## Implementation Queue (priority order)

1. **Bat Cave** — most self-contained, cleanest state machine, good platform test
2. **Hub map** — needed before multi-exhibit navigation works
3. **Account system** — anonymous migration, rank calculation
4. **Owl Barn** — calibration system, sin timing function
5. **Skunk Den** — slider UI is reusable component
6. **Raccoon Trash Pile** — mastermind logic, preference shuffling
7. **Opossum Hut** — custom cursor system, canvas reveal
8. **Firefly Field** — last, depends on all others

**Parallel design conversations still needed:**
- Avatar system (procedural generation, customisation)
- Music design (hub + per-exhibit themes)
- Leaderboards (public normative display)
- Mobile/tablet redesign

---

## Workflow Notes

- Each implementation conversation: upload relevant spec `.md` + this `website.md` at start
- New games follow pipeline: narrative concept → state machine → QUEST/adaptive logic → SDT metrics → Supabase wiring
- Always update this file after major architectural decisions
- Spec files are source of truth for exhibit design; this file is source of truth for platform architecture

---

*Version: post Sensory Safari full design phase*
*Next step: implement Bat Cave (start fresh conversation after Friday usage reset)*
