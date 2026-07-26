# Sensory Safari — Hub & Platform Master Spec
### Full Design Specification

---

## 1. Overview

The hub is the connective tissue of Sensory Safari — the space the player returns to between exhibits, where progression is visible, rank is reflected, and the world of the safari feels alive and responsive. It is not a menu screen; it is a place.

**Platform stack:** React + Vite, Tailwind CSS v3, Supabase (auth + database), Vercel  
**User tiers:** Anonymous (Night Visitor), Registered (full profile + persistent data), Admin/Lab  
**Public-facing:** Yes — open signup, no lab affiliation required  

---

## 2. First-Time Arrival Cinematic

Fires only on a user's very first visit (tracked via localStorage flag + Supabase session check). All subsequent visits land directly on the hub map.

### 2.1 Sequence

1. **Black screen.** Ambient night sounds begin — crickets, distant wind.
2. **Headlights appear** at the bottom of the screen, sweeping left to right as a bus rounds a bend.
3. **The bus pulls up** — a warm, slightly battered safari bus, moonlit. Engine rumble, air brakes hiss.
4. **Bus doors open** — a mechanical pneumatic sound, warm interior light spills out briefly.
5. **The player's view descends** from the bus steps to the ground — a brief first-person step-off moment.
6. **The hub map fades in** — top-down isometric, the safari park spreading out in moonlight.
7. **A small welcome card** appears centre screen:

> *"Welcome to the Night Safari.*
> *The animals are waiting.*
> *Try not to get captured."*

8. Card dismisses on click. Hub is now interactive.

**Audio throughout:** Engine idle → air brake hiss → door open → footstep on gravel → night ambience swells → card dismisses with a soft chime.

**Duration:** Approximately 8–10 seconds, non-skippable on first visit only.

---

## 3. Hub Map

### 3.1 Visual Style

Top-down slight isometric view of the safari park at night. Warm moonlight from upper-left. Paths connect all locations. The overall feel is a hand-illustrated park map brought to life — not a UI, a world.

**Palette:**
- Ground/paths: dark warm earth (`#1a1208`), path lines in faded amber (`#6b4f2a`)
- Moonlight: cool blue-white wash across open areas
- Building/exhibit structures: warm dark wood and stone, each with a distinct silhouette
- Active/completed locations: warm amber lantern glow at entrance
- Inactive locations: dim, slightly desaturated, no glow

### 3.2 Location Layout (Isometric Map)

Six locations arranged around a central path hub. Suggested arrangement:

```
        [Firefly Field]
              |
    [Bat Cave] — [Owl Barn]
         \       /
          [HUB]
         /       \
  [Opossum Hut] — [Raccoon Trash]
              |
         [Skunk Den]
```

Each location is represented by a small illustrated structure or environment visible in the isometric view — a dark cave mouth, a looming barn, a moonlit field, an alleyway, a rocky den, a luminous meadow.

The central hub point is a small lit signpost or park entrance gate — the arrival point of the bus.

### 3.3 Location States

Each location has four possible visual states:

| State | Visual | Condition |
|---|---|---|
| **Unvisited** | Dark, slightly foreboding, animal silhouettes suggesting danger or mystery | Default |
| **In progress** | Slightly warmer, entrance lit | Player has started but not completed |
| **Completed** | Warm lantern glow, happy animal visible at entrance or nearby | Exhibit finished at least once |
| **Mastered** | Glowing warmly, animal in a contented pose, small sparkle detail | Player has achieved top 2 rank tiers in that exhibit |

**Completed state animal details (per location):**
- **Bat Cave:** A bat perches above the entrance, wings folded, looking smug but tolerant
- **Owl Barn:** An owl sits on a fence post outside, rotating head slowly, imperiously peaceful
- **Opossum Hut:** Mama opossum sits in a rocking chair outside with all babies piled on her
- **Raccoon Trash Pile:** The four raccoons sit at a small outdoor table, cards and garbage everywhere, content
- **Skunk Den:** Mama skunk and all babies sit in a row in the moonlight, tails (white) held high
- **Firefly Field:** A bird's-eye view of the five animals gathered together, firefly jars glowing around them, the path to the field now illuminated

### 3.4 Firefly Field — Locked State

Before all 5 exhibits are complete:
- The path toward Firefly Field fades into darkness
- No fireflies visible along that path
- Clicking the dark area produces a gentle message: *"The fireflies are waiting — but they need to know you first."*
- No explicit lock icon — the darkness itself communicates inaccessibility

After all 5 exhibits are complete:
- Firefly jars appear along the path, lighting it section by section (animation plays once)
- A bird's-eye view reveals the 5 animal characters gathered in the field, visible from the map
- Location becomes clickable

### 3.5 Location Tooltips

Hovering over any location reveals a tooltip:
- Location name
- Animal(s) inside
- Primary sense
- Personal best rank (if visited)
- "Play" / "Play Again" button

Tooltip appears with a soft fade, anchored to the location. On mobile: tap to reveal tooltip, second tap to enter.

### 3.6 Entering a Location

Click the tooltip "Play" button or double-click the location directly. A brief transition animation — the camera zooms gently toward the location and the screen fades to black — before the exhibit loads.

---

## 4. The Player Badge

A persistent badge sits in the bottom-right corner of the hub screen at all times.

### 4.1 Badge Components

- **Avatar silhouette:** Generic night safari silhouette for anonymous/unregistered users. Replaced by the player's custom avatar once an account is created (avatar system: separate conversation/implementation)
- **Rank label:** Current overall curator rank (see Section 6)
- **Name:** "Night Visitor" for anonymous users; display name for registered users
- **Profile link:** Tapping/clicking the badge opens the full profile screen

### 4.2 Anonymous User Badge State

For unregistered users:
- Generic silhouette in grey-blue
- Rank label reads "Intern Curator" (or current earned rank — but only Intern is achievable without an account)
- A small subtle prompt beneath the rank: *"Create an account to track your progress →"*
- This is not a modal or interruption — it sits quietly on the badge

---

## 5. Account System

### 5.1 User Tiers

| Tier | Auth state | Capabilities |
|---|---|---|
| **Anonymous** | No account, session ID only | Play all exhibits, earn scores, achieve Intern rank, no persistent cross-session data |
| **Registered** | Supabase email auth | Full profile, persistent scores, all rank tiers, mindfulness badges, cross-session data |
| **Admin/Lab** | Supabase role-based | Data export, participant management, study protocol assignment |

### 5.2 Anonymous Session Handling

Anonymous users receive a Supabase anonymous auth session on first visit. This generates a UUID that persists in localStorage.

Session data (game scores, trial data) is written to Supabase under this anonymous UUID. **If the user later creates an account, their anonymous session data is retroactively linked** to their new account via a session migration call on registration.

This means no data is ever lost at the moment of signup — the player's history travels with them.

### 5.3 Account Creation Touchpoints

Account creation is prompted (never forced) at the following moments:

1. **The badge** — persistent quiet prompt visible at all times on the hub
2. **Profile screen** — faded content with "Create an account to access your full data" overlay and CTA button
3. **Results screen** — after achieving any rank above Intern, a gentle prompt: *"You've earned [rank]. Create an account to keep it."*

Account creation never interrupts active gameplay. All prompts appear at natural pause points.

### 5.4 Registration Flow

Minimal friction:
- Email + password only (or OAuth if implemented later)
- Display name prompt (used on badge and certificate)
- No required demographics at signup — these can be collected optionally via questionnaire in the profile screen
- On successful registration: anonymous session data migrated, badge updates immediately

---

## 6. Curator Rank System

### 6.1 Overall Rank Calculation

The player's overall curator rank is calculated from their **best score in each exhibit**, converted to a normalised 0–100 scale per exhibit, then averaged.

```
exhibit_normalised_score = (best_score - floor_score) / (max_score - floor_score) × 100
overall_score = mean(all_attempted_exhibit_normalised_scores)
```

Unplayed exhibits are excluded from the average — rank reflects performance on what has been played, not penalised for what hasn't.

### 6.2 Rank Tiers

| Overall score | Rank | Description |
|---|---|---|
| 0–19 | Safari Volunteer | *"Enthusiastic. Largely harmless."* |
| 20–39 | Intern Curator | *"Getting there. The animals are cautiously optimistic."* |
| 40–59 | Assistant Curator | *"A reliable presence. The bats have stopped plotting against you."* |
| 60–79 | Curator | *"The animals respect you. Some of them, anyway."* |
| 80–94 | Head Curator | *"You understand this place. It understands you back."* |
| 95–100 | Safari Director | *"The night safari is yours. Try not to let it go to your head."* |

**Intern Curator is the maximum rank achievable without a registered account.** Players who earn above Intern while anonymous see their rank displayed but receive the account creation prompt on the results screen.

### 6.3 Rank Display

- Badge in hub corner: rank label only
- Profile screen: full rank name, description, overall score, per-exhibit breakdown
- Results screen: rank update notification if rank has changed

---

## 7. Profile Screen

Accessible via the badge or a profile icon. Full-screen overlay on the hub.

### 7.1 Registered User Profile

**Sections:**

**Header:**
- Avatar (silhouette or custom once avatar system is built)
- Display name
- Overall rank + score
- Total time in safari (for fun)
- Member since date

**Exhibit Records:**
A card per exhibit showing:
- Best rank achieved in that exhibit
- Best score
- Number of sessions played
- Mindfulness badge (glow icon if 30s earned, enhanced glow if 60s earned)
- Sparkle detail if mastered

**Sensory Profile (RADlab data, player-facing summary):**
A simple radar/spider chart showing relative performance across the 6 sensory dimensions. Not raw data — a friendly visualisation of where their strengths lie.
- Framed as: *"Your sensory strengths"*
- Labels: Hearing, Sight, Touch, Smell, Taste, Integration (Firefly Field)

**Optional questionnaire section:**
- Invite to complete demographics and validated scales (PANAS, DERS, etc.) if study protocols require
- Framed as: *"Help us understand you better"*
- Never mandatory, clearly optional

### 7.2 Anonymous User Profile

Profile screen is visible but content is behind a soft fade overlay:
- Avatar area shows generic silhouette
- Exhibit records show placeholder cards
- Sensory profile shows empty radar chart
- Overlay text: *"Create an account to see your full profile and track your progress across sessions."*
- Large CTA button: *"Create Account"*
- Smaller link: *"Continue as Night Visitor"* (dismisses overlay, returns to hub)

---

## 8. Navigation Flow

```
FIRST VISIT
  └─> Bus cinematic
        └─> Hub map

RETURNING VISIT
  └─> Hub map (direct)

HUB MAP
  ├─> Location tooltip → Enter exhibit
  ├─> Badge → Profile screen
  │     ├─> Registered: full profile
  │     └─> Anonymous: faded profile + account CTA
  └─> [After all 5 exhibits complete] Firefly Field unlocks

EXHIBIT COMPLETE
  └─> Results screen
        ├─> Rank update notification
        ├─> Account CTA (if above Intern and anonymous)
        ├─> "Return to Safari" → Hub map
        └─> "Play Again" → Restart exhibit

HUB MAP (post-completion)
  └─> Completed locations show happy animals
      Firefly Field path lights up when all 5 done
```

---

## 9. Hub Ambient State

The hub is never completely static. Background ambient details:

- **Bat Cave:** Occasional bat silhouette flickers past the cave mouth
- **Owl Barn:** An owl shape rotates slowly in a high window
- **Opossum Hut:** Grass rustles occasionally
- **Raccoon Trash Pile:** A trash can lid rattles in the wind
- **Skunk Den:** Small glow from den entrance, occasional movement
- **Firefly Field (unlocked):** Slow firefly drifts visible on the path

None of these are interactive — purely atmospheric. They keep the hub feeling alive during navigation.

**Audio:** Night ambience loop — crickets, wind, distant animal calls. No music for now (separate design conversation). Audio fades out as exhibit loads, fades back in on return.

---

## 10. Supabase Data Architecture

### 10.1 Core Tables (existing schema, extended)

**`profiles`**
```sql
id uuid references auth.users primary key,
display_name text,
anonymous boolean default true,
created_at timestamptz,
avatar_params jsonb,        -- future: avatar generation parameters
overall_rank text,
overall_score float,
total_sessions int default 0,
total_time_ms bigint default 0
```

**`studies`** (for RADlab participant management — existing)
```sql
id uuid primary key,
name text,
protocol jsonb,
created_at timestamptz
```

**`game_sessions`** (existing, one row per exhibit play)
```sql
id uuid primary key,
user_id uuid references profiles,
game_id text,              -- 'bat_cave' | 'owl_barn' | 'opossum_hut' | 'raccoon_trash' | 'skunk_den' | 'firefly_field'
session_number int,
completed boolean,
final_score float,
rank_tier text,
mindfulness_duration_ms int,
mindfulness_bonus_reached text,
created_at timestamptz,
[game-specific fields per exhibit spec]
```

**`trials`** (existing, one row per trial within a session)
```sql
id uuid primary key,
session_id uuid references game_sessions,
[trial-specific fields per exhibit spec]
```

**`performance`** (existing, one row per session — SDT/summary metrics)
```sql
id uuid primary key,
session_id uuid references game_sessions,
[performance-specific fields per exhibit spec]
```

**`questionnaire_responses`** (existing, JSONB)
```sql
id uuid primary key,
user_id uuid references profiles,
questionnaire_type text,   -- 'demographics' | 'PANAS' | 'DERS' etc.
responses jsonb,
created_at timestamptz
```

### 10.2 New Tables for Hub/Platform

**`anonymous_sessions`** (maps anonymous UUIDs to registered accounts on signup)
```sql
anonymous_id uuid primary key,
registered_user_id uuid references profiles,
migrated_at timestamptz
```

**`exhibit_bests`** (materialised best scores per user per exhibit — for fast hub rendering)
```sql
user_id uuid references profiles,
game_id text,
best_score float,
best_rank text,
sessions_played int,
mindfulness_30s_earned boolean,
mindfulness_60s_earned boolean,
mastered boolean,
last_played timestamptz,
primary key (user_id, game_id)
```

**`hub_state`** (tracks hub visual state per user)
```sql
user_id uuid references profiles primary key,
exhibits_completed text[],          -- array of completed game_ids
firefly_field_unlocked boolean default false,
first_visit_complete boolean default false,
last_active timestamptz
```

### 10.3 Anonymous Session Migration (on registration)

```javascript
async function migrateAnonymousSession(anonymousId, newUserId) {
  // Update all game_sessions
  await supabase
    .from('game_sessions')
    .update({ user_id: newUserId })
    .eq('user_id', anonymousId)

  // Update all trials (via session join — handled by cascade or explicit update)
  // Update exhibit_bests
  await supabase
    .from('exhibit_bests')
    .update({ user_id: newUserId })
    .eq('user_id', anonymousId)

  // Update hub_state
  await supabase
    .from('hub_state')
    .update({ user_id: newUserId })
    .eq('user_id', anonymousId)

  // Log migration
  await supabase
    .from('anonymous_sessions')
    .insert({ anonymous_id: anonymousId, registered_user_id: newUserId })
}
```

---

## 11. Cross-Game Sensory Profile

The sensory profile visible on the profile screen is computed from normalised performance scores across all six exhibits.

```javascript
const sensoryProfile = {
  hearing:     normalisedScore('bat_cave'),        // sonar catch rate + dodge accuracy
  sight:       normalisedScore('firefly_field'),   // sky painting accuracy
  touch:       normalisedScore('opossum_hut'),     // detection threshold + search efficiency
  smell:       normalisedScore('raccoon_trash'),   // inference score + plate accuracy
  taste:       normalisedScore('skunk_den'),       // mean whiteness + fruit ID accuracy
  integration: normalisedScore('owl_barn'),        // adaptive strategy efficiency
}
```

*Note: Owl Barn is filed under "integration" rather than pure hearing because the core skill is rhythm reading and strategy switching — a cross-modal timing ability.*

This profile is the RADlab's primary individual differences output: a six-dimensional sensory fingerprint per player, improving in resolution with each repeat session.

---

## 12. Music (TODO)

Background music for hub and each exhibit location is planned but requires its own design conversation. Placeholder: night ambience only.

**Known constraints for that conversation:**
- Music must not loop jarringly — needs seamless loop points
- Each exhibit should have a distinct musical identity that reinforces its sensory theme
- Hub music should feel like the connective tissue — referencing all six themes subtly
- Music and sound effects must be independently adjustable in settings

---

## 13. Settings

Accessible from a small gear icon on the hub (or profile screen). Minimal for now:

- Sound effects: on/off
- Spatial audio: on/off (enhancement layer for Bat Cave and Owl Barn)
- Reduce motion: on/off (disables non-essential animations throughout)
- Display name: editable (registered users only)

---

## 14. Open Questions (Deferred)

- Avatar system: procedural generation, customisation extent, animal hybrid vs. human-ish — separate conversation
- Music design: hub and per-exhibit themes — separate conversation
- Leaderboards: public normative data display — architecture straightforward but UI and privacy considerations need their own conversation
- Study protocol assignment: how lab members assign participants to specific exhibit sequences or questionnaire batteries — existing `studies` table handles the data; admin UI needed
- Mobile/tablet redesign: the hub map isometric view needs significant rethinking for small screens — defer until desktop version is stable
- Certificate sharing: downloadable/shareable image from the Firefly Field completion — requires image generation

---

*Spec version 1.0 — Sensory Safari / Hub & Platform*
*Ready for implementation*
