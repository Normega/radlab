# RADlab Platform — Design & Architecture Decisions

> **Regulatory and Affective Dynamics Lab**  
> University of Toronto · PI: Professor Norman Farb, PhD  
> Last updated: 2026-04-27 (First Contact / Deeper Contact spec added as §10.3; QUEST+ psychometric function fix documented; session feedback screen spec added; schema + routes updated)

---

## 1. Platform Overview

**Goal**: A web platform that delivers psychophysics games and questionnaires to three distinct user populations, persists data to Supabase, and provides engaging performance feedback to drive sustained participation.

**Core value proposition to users**: The games are genuinely fun and funny. Performance feedback — personal progress, comparisons against peers, leaderboards — gives users a reason to return beyond compensation.

**Design principle**: Narrative disguise is essential. Each game wraps a rigorous perceptual test in an engaging fiction. Copy and UI should have personality — this is NOT a clinical portal. Fun > formal. Engaging > authoritative.

**Platform theme**: The overarching aesthetic is **awareness and attunement** — quiet, curious attention to subtle signals within and around the self. Games are framed around noticing, sensing, and detecting. The tone is contemplative but warm, never clinical. Nature imagery (ponds, breath, rhythm) serves the attunement theme rather than defining it.

---

## 2. User Tiers

Three distinct roles with different access, workflows, and UX:

### Tier 1 — Lab Members (Internal)
- Researchers, developers, RAs at RADlab
- Full admin access: create/edit studies, assign participants, view all data
- Can flag sessions as "test" to exclude from real data
- Invite-only signup via admin-generated link

### Tier 2 — Research Participants
- Recruited participants in formal studies
- Assigned a specific **study protocol** (ordered set of games + questionnaires)
- Compensation tracked in platform or externally
- Controlled experience: see only what's assigned, in assigned order
- Consent flow and demographics questionnaire at onboarding
- No leaderboard access (privacy)

### Tier 3 — Public / Crowd
- Anyone who signs up via open signup
- Full access to all public games
- Leaderboards, personal performance history, population comparisons
- Contributes to crowdsourced normative data
- Demographics questionnaire at signup

---

## 3. Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | React + Vite | |
| Styling | Tailwind CSS v3 + CSS custom properties | Brand tokens in `index.css` |
| Routing | React Router v6 | |
| Data fetching | TanStack Query | |
| Charts | Recharts | Dashboard, future |
| Backend/DB | Supabase | PostgreSQL + Auth + auto REST |
| Auth | Supabase Auth | Email/password; `display_name` in `user_metadata` |
| Hosting | Vercel | SPA rewrites via `vercel.json` |
| Fonts | Fontsource packages | DM Serif Display, Space Mono, DM Sans |

---

## 4. Project Structure

```
radlab/
  public/
    RADlab_Logo.svg           ← original (white outline, dark bg only)
    RADlab_Logo_light.svg     ← light bg variant (dark outline, use everywhere in UI)
  src/
    components/
      Nav.jsx                 ← shared nav, auth-aware
      Avatar/
        BaseAvatar.jsx        ← pure SVG avatar component (skinColor, eyeColor, size props)
        AvatarEditor.jsx      ← avatar editor UI with Supabase save/load
    games/
      PondWatch.jsx             ← go/no-go RT game
      EbbAndFlow/               ← interoceptive breath detection game
        EbbAndFlow.jsx
        useQuestStaircases.js
        useBreathCycle.js
        useButtonSync.js
        components/
          AvatarBreathPacer.jsx
          PsiAmpButton.jsx
          ResponseScreen.jsx
          WarmupScreen.jsx
          SessionStart.jsx
          SessionSummary.jsx
          SessionFeedback.jsx
          ModeSelector.jsx
          ContinuePrompt.jsx
        constants.js
      FirstContact/             ← onboarding sync game + standalone Deeper Contact
        FirstContact.jsx
        useBreathSync.js
        constants.js
        components/
          ContactAvatar.jsx
          SyncMeter.jsx
          BreathPrompt.jsx
          ContactComplete.jsx
    lib/
      supabase.js             ← supabase client singleton
    pages/
      Landing.jsx             ← public landing page (includes game previews)
      Login.jsx               ← auth: sign in
      Signup.jsx              ← auth: create account
      Dashboard.jsx           ← protected: post-login home
      ProfilePage.jsx         ← user profile: avatar, points, unlock progress
      Games.jsx               ← public games listing (/games) — Pond Watch + Ebb & Flow cards
    App.jsx                   ← router + auth state
    main.jsx                  ← entry point
    index.css                 ← Tailwind + brand CSS tokens
  .env.example                ← copy to .env.local, fill in Supabase keys
  vercel.json                 ← SPA rewrite rules
  tailwind.config.js
```

---

## 5. Supabase Project

- **Account name**: RADlab (linked to GitHub, PI: Norman Farb)
- **Auth**: Supabase Auth (email/password)
- **`display_name`** stored in `user_metadata` at signup
- **Client library**: `supabase-js` via `src/lib/supabase.js`
- **Keys**: `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` in `.env.local` (local) and Vercel env vars (production)
- **Email confirmation**: disable for development in Supabase dashboard → Authentication → Email

---

## 6. Database Schema

### `profiles`
Extended user record (one per auth user). Created by trigger on `auth.users` insert.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK, FK → `auth.users` |
| `role` | text | `"lab"`, `"participant"`, `"public"` |
| `display_name` | text | Shown on leaderboards |
| `study_id` | uuid | FK → `studies` (null for public users) |
| `created_at` | timestamptz | |
| `onboarding_complete` | bool | Has completed consent + demographics |
| `points` | integer | Accumulated points from games + onboarding; default 0 |
| `ebb_flow_game_mode` | text | `'beginner'` \| `'listener'` \| `'empath'`; default `'beginner'` |
| `ebb_flow_total_trials` | integer | Cumulative trial count across all sessions; default 0 |
| `ebb_flow_total_score` | integer | Cumulative score; default 0 |
| `ebb_flow_quest_state` | jsonb | Serialized 4-staircase QUEST+ posterior (~50–200 KB); null until first session |
| `ebb_flow_listener_unlocked_at` | timestamptz | Timestamp when Listener mode unlocked (≥50 trials) |
| `ebb_flow_empath_unlocked_at` | timestamptz | Timestamp when Empath mode unlocked (≥100 trials) |
| `ebb_flow_last_session_at` | timestamptz | Timestamp of most recent Ebb & Flow session |
| `first_contact_complete` | boolean | Has completed First Contact onboarding; default false |
| `first_contact_complete_at` | timestamptz | Timestamp of First Contact completion |
| `deeper_contact_best_sync` | numeric(4,3) | Best ever rolling sync mean from Deeper Contact sessions |
| `deeper_contact_last_sync` | numeric(4,3) | Most recent session sync mean — seeds aura intensity in Ebb & Flow |
| `deeper_contact_sessions` | integer | Total Deeper Contact sessions played; default 0 |

### `studies`
A curated protocol for participant recruitment.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `name` | text | e.g. `"Emotion Regulation Study 1"` |
| `created_by` | uuid | FK → `profiles` (lab member) |
| `protocol` | jsonb | Ordered array of game/questionnaire slugs |
| `active` | bool | |

### `game_sessions`
One row per play session.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `user_id` | uuid | FK → `profiles` |
| `game_name` | text | e.g. `"pond_watch"` |
| `study_id` | uuid | FK → `studies` (null for public) |
| `is_test` | bool | Lab-member test sessions excluded from analysis |
| `started_at` | timestamptz | |
| `ended_at` | timestamptz | |

### `trials`
One row per trial within a session.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `session_id` | uuid | FK → `game_sessions` |
| `game_name` | text | e.g. `'pond_watch'`, `'ebb_flow'` — indexed for fast filtering |
| `trial_number` | int | 1-indexed within session |
| `cumulative_trial_number` | int | Auto-set by Postgres trigger — counts up across all sessions and games per user |
| `stimulus_type` | text | e.g. `"duck"`, `"heron"` (Pond Watch); trial type for Ebb & Flow stored in `metrics` |
| `is_target` | bool | Go trial or not |
| `responded` | bool | Did participant respond |
| `reaction_time_ms` | int | null on no-response trials |
| `created_at` | timestamptz | DEFAULT NOW() — used for ordering within session |
| `metrics` | jsonb | Flexible per-game metrics (see §10.2 for Ebb & Flow fields) |

`cumulative_trial_number` is maintained by a `BEFORE INSERT` trigger (`trials_cumulative_trial_number`) that queries `MAX(cumulative_trial_number)` across all trials for the same user and increments by 1. Application code should never set this column — let the trigger handle it.

### `performance`
Session-level computed metrics. Flexible across games.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `session_id` | uuid | FK → `game_sessions` |
| `hit_rate` | float | |
| `false_alarm_rate` | float | |
| `d_prime` | float | SDT sensitivity |
| `criterion` | float | SDT response bias |
| `median_rt_ms` | float | Hits only |
| `rt_sd_ms` | float | RT variability |
| `accuracy` | float | |
| `threshold` | float | For adaptive staircase games |
| `slope` | float | Psychometric function slope |

### `questionnaire_responses`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `user_id` | uuid | FK → `profiles` |
| `questionnaire_slug` | text | e.g. `"demographics"`, `"panas"`, `"ders"` |
| `session_id` | uuid | FK → `game_sessions` (null if standalone) |
| `responses` | jsonb | `{question_id: response_value}` |
| `completed_at` | timestamptz | |

### `avatars`
One row per user. Created at onboarding with default skin + eye color. Unlockable slots are null until the user earns points and applies a feature.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `user_id` | uuid | FK → `auth.users`, UNIQUE |
| `skin_color` | text | Hex; default `#FDBCB4` |
| `eye_color` | text | Hex; default `#4A90D9` |
| `ear_type` | text | null = locked/not applied |
| `nose_type` | text | null = locked/not applied |
| `mouth_type` | text | null = locked/not applied |
| `hair_type` | text | null = locked/not applied |
| `hair_color` | text | null = locked/not applied |
| `tail_type` | text | null = locked/not applied |
| `accessory` | text | null = locked/not applied |
| `aura_type` | text | null = locked/not applied |
| `scar_type` | text | null = locked/not applied |
| `updated_at` | timestamptz | |

RLS: users can read and write only their own row.

### `avatar_unlocks`
Tracks which individual items each user has earned. Separate from `avatars` (which tracks what's currently equipped).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `user_id` | uuid | FK → `auth.users` |
| `feature` | text | e.g. `'ear_type'`, `'nose_type'`, `'hair_type'` |
| `item_id` | text | e.g. `'cat'`, `'fox'`, `'bun'` |
| `unlocked_at` | timestamptz | |
| — | — | UNIQUE on `(user_id, feature, item_id)` |

RLS: users can read only their own rows.

---

## 7. Site Routes

| Route | Component | Access |
|---|---|---|
| `/` | `Landing` | Public |
| `/login` | `Login` | Public only (redirects to `/dashboard` if logged in) |
| `/signup` | `Signup` | Public only |
| `/games` | `Games` | Public — game listing page; shows First Contact prominently if not yet complete |
| `/dashboard` | `Dashboard` | Protected (redirects to `/login` if not logged in) |
| `/profile` | `ProfilePage` | Protected — avatar, points, unlock progress |
| `/profile/avatar` | `AvatarEditor` | Protected — avatar editor; redirected here on first login |
| `/games/first-contact` | `FirstContact` | Protected — mandatory onboarding sync game; also accessible as Deeper Contact standalone |
| `/games/pond-watch` | `PondWatch` | Protected |
| `/games/ebb-flow` | `EbbAndFlow` | Protected — redirects to `/games/first-contact` if `first_contact_complete === false` |
| `/study` | — | Participant tier (future) |
| `/admin` | — | Lab tier (future) |

**Nav links (logged-in)**: Logo · Games (`/games`) · Dashboard · [avatar circle → `/profile`]  
**Nav links (logged-out)**: Logo · Games (`/games`) · Log in · Join free

**Onboarding guard**: Any attempt to access `/games/ebb-flow` while `first_contact_complete === false` redirects to `/games/first-contact` with message: *"Complete First Contact before beginning Ebb & Flow."*

---

## 8. Auth Flow

1. **Signup** (`/signup`) → `supabase.auth.signUp()` with `display_name` in `user_metadata`
2. Confirmation email sent (disable for dev in Supabase dashboard)
3. **Login** (`/login`) → `supabase.auth.signInWithPassword()`
4. Auth state listener in `App.jsx` catches session changes and re-renders
5. Role-based redirect (currently all users → `/dashboard`; future: check `profiles.role`)
6. **Sign out** → `supabase.auth.signOut()` → redirect to `/`

---

## 9. Design System

**Brand**: RADlab — Regulatory and Affective Dynamics Lab, University of Toronto

**Aesthetic**: Light mode. Warm pinkish off-white background. White cards. Pink accent. Inviting, not clinical. Playful copy, serious science underneath.

**Logo files** (never redraw — always use one of these two):
- `RADlab_Logo.svg` — original, white outline on `path1`. Dark backgrounds only.
- `RADlab_Logo_light.svg` — `path1` fill changed to `#1c1c1e` via `sed`. Light backgrounds. Use this everywhere in the UI.
- In React: `<img src="/RADlab_Logo_light.svg" height="34" alt="RADlab logo" />`

**Colour tokens** (defined as CSS custom properties in `index.css`):

| Token | Value | Usage |
|---|---|---|
| `--bg` | `#FCF0F5` | Page background |
| `--bgc` | `#ffffff` | Card background |
| `--bgp` | `#FBEAF3` | Pink-tinted section background |
| `--pk` | `#f068a4` | Primary accent — CTAs, highlights (from logo `path3`) |
| `--pkd` | `#c04a82` | Darker pink — hover states, text on pink bg |
| `--pkb` | `rgba(240,104,164,0.18)` | Subtle pink border |
| `--pkbs` | `rgba(240,104,164,0.35)` | Strong pink border |
| `--gy` | `#abadb0` | Gray — secondary elements (from logo `path5`) |
| `--tx` | `#1c1c1e` | Primary text |
| `--tx2` | `#6b6c70` | Secondary text |
| `--tx3` | `#a8a9ad` | Tertiary / labels |
| `--bd` | `rgba(180,100,140,0.13)` | Default border |
| `--bds` | `rgba(180,100,140,0.25)` | Strong border |

**Fonts**:
- `"DM Serif Display"` — headings, hero title, game titles
- `"Space Mono"` — data readouts, labels, monospace UI
- `"DM Sans"` — body, UI, buttons

**Tone**: Warm, a little funny, encouraging. Feedback feels like a supportive coach. Leaderboard copy is playful. Errors are charming.

---

## 10. Games

### 10.1 Pond Watch

**File**: `src/games/PondWatch.jsx`  
**Paradigm**: Go/No-Go reaction time  
**Narrative**: Wildlife monitor watching a pond. Duck → spacebar/tap. Heron/frog/fish/ripple → withhold.

**Trial structure**:
- 60 trials, ~5 min
- Target rate: 50%
- ITI: 1000–3000 ms random
- Stimulus duration: 800 ms
- Response window: 1000 ms from onset
- Per-trial feedback: hit / miss / false alarm / correct rejection

**State machine**: `instructions → countdown → [iti → stimulus → feedback] × 60 → results`

**Key decisions**:
- All timing via `useRef` — avoids stale closure bugs
- RT via `performance.now()` — sub-millisecond precision
- d′ log-linear correction — prevents ±Infinity at 0%/100%
- `onSessionComplete(data)` prop — Supabase push goes here (stubbed)

**Metrics**: `hit_rate`, `false_alarm_rate`, `d_prime`, `criterion`, `median_rt_ms`, `rt_sd_ms`, `accuracy`

**Status**: Built, not yet wired to Supabase or exposed as a live route.

---

### 10.2 Ebb & Flow

**Files**: `src/games/EbbAndFlow/` (see §4 for full structure)  
**Paradigm**: Interoceptive breath change detection — 4-breath adaptive staircase  
**Route**: `/games/ebb-flow`  
**Dependency**: `npm install jsquestplus` (MIT, Kuroki & Pronk 2022)

**Narrative / framing**: The participant's own avatar serves as the breath pacer. The participant breathes along with their avatar using the PSI-AMP attunement button (hold = inhale, release = exhale). On each trial the avatar's pace may subtly shift. The participant's job is to notice — to detect impermanence in the breath rhythm. The game is named after the cyclical, bidirectional nature of breath and change: things ebb and flow.

The term **PSI-AMP** (psionic amplifier) appears on the instruction screen as a narrative device — a tool for attuning your breath to your avatar's signal. The button face itself simply reads "inhale" when held.

**Scientific basis**: Orthogonal manipulation of change *magnitude* (how much the breathing pace shifts) and *salience* (how abruptly vs. gradually the shift is delivered). Enables independent measurement of interoceptive sensitivity, conscious detection, metacognitive accuracy, and subjective arousal. Based on Study 1 data (N=103, 3,192 trials) — see `fourbreathtask.md` for full empirical priors.

**Trial structure**:
- Warm-up: replaced by First Contact onboarding (see §10.3). Ebb & Flow uses a shortened 4-breath warm-up for returning players who have completed First Contact
- After warm-up: `GET_READY` screen — avatar frozen at neutral, text prompt, spacebar or "Begin" button to start
- Each trial: avatar resets to neutral synchronously then holds 1000ms before breath 1 begins
- 4 breaths per trial; breath 1 always baseline reference
- High salience: full change loads abruptly at breath 2→3
- Low salience: change amortised gradually across breaths 2, 3, 4
- Catch trials (25%): TotalChange = 1.0, no change
- After 4 breaths: combined response screen (3AFC + confidence slider + arousal slider)
- Session minimum: 10 trials; "keep going?" prompt every 10 thereafter
- Session ends automatically when all 4 QUEST+ posteriors converge (SD < 0.04)

**State machine**:
```
SESSION_START → WARMUP → GET_READY → [TRIAL_ITI → BREATH_SEQUENCE → RESPONSE] × n
                                                                         ↓ every 10 trials
                                                                   CONTINUE_PROMPT
                                                                         ↓ all converged
                                                                  STABILITY_COMPLETE
                                                                         ↓
                                                                  SESSION_COMPLETE
```

- `WARMUP`: PSI-AMP sync ring visible; auto-advances at rolling sync mean ≥ 0.80
- `GET_READY`: static screen; avatar frozen at neutral (rAF loop paused); spacebar or "Begin" advances
- `TRIAL_ITI`: 800ms pause; avatar breathing continues at baseline
- `BREATH_SEQUENCE`: on entry — rAF loop cancelled, `resetAvatarToNeutral()` called synchronously via direct `setAttribute`, 1000ms hold, then rAF restarts and breath cycle begins. This reset applies at warmup start too — standard start-of-trial behaviour.
- `RESPONSE`: PSI-AMP button inert; 3AFC + two placement sliders

**Four QUEST+ staircases** (one per condition):

| Key | Direction | Salience |
|-----|-----------|----------|
| `faster_high` | Acceleration | High (abrupt) |
| `faster_low` | Acceleration | Low (gradual) |
| `slower_high` | Deceleration | High (abrupt) |
| `slower_low` | Deceleration | Low (gradual) |

Trial type selected by highest posterior SD (most uncertain staircase gets next trial). QUEST+ configured for 3AFC with Weibull psychometric function. Priors: μ=0.20, σ=0.15, slope=5.70, lapse=0.02, guess=0.33. Full posterior serialized to `profiles.ebb_flow_quest_state` (JSONB) between sessions.

**Response screen** (all three required before Next unlocks):
- 3AFC: `[ Faster ] [ No change ] [ Slower ]`
- Confidence: placement slider (1–7); starts as dashed ghost thumb + horizontal dashed line; real thumb appears at exact tap position
- Arousal: same placement slider mechanic (1–7, calm/still → alert/activated)

**Avatar as breath pacer** (`AvatarBreathPacer.jsx`):
- Pulls `profiles.avatars` for logged-in users; default mid-range avatar for guests
- Avatar expands/contracts driven by `requestAnimationFrame` + `useRef` timing (no CSS keyframes — Safari compatibility)
- Four animated cues: scale (mode-dependent amplitude), eyelids, blush, brow lift
- All SVG attributes via `setAttribute` — never CSS animation on SVG elements

**Game modes** (scale amplitude of breathing animation):

| Mode | Amplitude | Unlock threshold |
|------|-----------|-----------------|
| Beginner | 25% | Default (0 trials) |
| Listener | 12% | 50 trials |
| Empath | 2% | 100 trials |

Mode buttons shown on session start screen — locked modes greyed out with lock icon and trial threshold shown. Unlock celebrated on session summary. User may stay on current mode; downgrading is valid.

**Scoring**:

| Event | Points |
|-------|--------|
| Correct detection, high salience | +10 |
| Correct detection, low salience | +20 |
| Correct catch rejection | +8 |
| False alarm on catch | −5 |
| Confidence calibrated (high+correct or low+wrong) | +5 bonus |

**Metrics stored** (in `trials.metrics` JSONB):
`trial_type`, `total_change`, `magnitude`, `log10_magnitude`, `salience`, `direction`, `response`, `correct`, `confidence`, `arousal`, `reaction_time_ms`, `breath_sync` (array of 4, with `press_phase`, `release_phase`, `sync_score` per breath), `trial_sync_mean`, `quest_posterior_mean`, `quest_posterior_sd`, `game_mode`, `scale_amplitude`

**`onSessionComplete` payload** includes: `trials[]`, `session_score`, `total_score`, `total_trials`, `quest_state` (4 serialized staircases), `game_mode`, `new_mode_unlocked`, `all_converged`, `session_sync_mean`

**Key implementation notes**:
- All breath timing via `useRef` — never `useState` (stale closure prevention, same pattern as Pond Watch)
- `pointerdown`/`pointerup` + `setPointerCapture` for PSI-AMP button (mouse + touch unified)
- QUEST+ stimulus in log10(magnitude) space; convert back to linear for breath duration computation
- **jsQuestPlus psychometric function**: use `getStimParams()` as a plain scalar (not array). Call `update(log10Mag, responseIndex)` with a plain scalar too — NOT `update([log10Mag], responseIndex)`. Wrapping in array causes NaN posterior.
- **Weibull P(correct) formula** (no `/20` divisor — slope is already in correct units for this parameterisation):
  ```js
  function pCorrect(stim, threshold, slope, guess, lapse) {
    const tmp = slope * (stim - threshold);
    return (1 - lapse) * (guess + (1 - guess) * (1 - Math.exp(-Math.pow(10, tmp)))) + lapse * guess;
  }
  ```
  Do NOT use `jsQuestPlus.weibull()` directly — that function returns P(incorrect), not P(correct).
- `psych_samples` must match function signature order: `[thresholdSamples, slopeSamples, guessSamples, lapseSamples]`
- Staircase restoration: pass `saved.normalized_posteriors` as `priors` to new jsQuestPlus constructor
- Avatar aura intensity in Ebb & Flow seeded from `profiles.deeper_contact_last_sync` — fixed ambient effect, does not update mid-session. Max opacity capped at 0.35.

**Session feedback** (`SessionFeedback.jsx`): shown after every 10 trials, replacing the old `ContinuePrompt`. Shows:
- Excitement sensitivity arc (amber, faster staircases combined) — certainty % = `(1 − SD/0.15) × 100`
- Calm sensitivity arc (blue, slower staircases combined) — same formula
- Connection to avatar: sync mean %, trend (strengthening/steady/fading), dual-line chart (faded trial-by-trial + solid trend)
- Change awareness: calibration of confidence vs accuracy — "You knew when you knew." / developing / still learning
- Focus card (conditional, only when `|excSD - calmSD| > 0.04`): real-world noticing suggestion
- Next session hook: points at less certain signal by name
- Buttons: "Take a break" / "Practice more"

**Full build spec**: `ebb-and-flow-spec.md` (generated 2026-04-25) — pass this to Claude Code as primary build instructions.

**UI entry points**:
- `Nav.jsx` — "Games" link (visible logged-in and logged-out) routes to `/games`
- `Landing.jsx` — Ebb & Flow preview card: *"Breathe with your avatar. Notice when something changes. A quiet game of awareness — each session takes about 5 minutes."*
- `Games.jsx` (`/games`) — listing page with one card per game; Ebb & Flow tagline: *"Breathe with your avatar and detect subtle shifts in rhythm."*; Pond Watch tagline: *"Watch the pond. Press when you spot a duck."*

**Status**: Built. QUEST+ staircases confirmed updating and persisting correctly across sessions. SessionFeedback implemented.

---

### 10.3 First Contact / Deeper Contact

**Files**: `src/games/FirstContact/`  
**Route**: `/games/first-contact`  
**Full build spec**: `first-contact-spec.md`

**Purpose**: Solves the cold-start usability problem of the Ebb & Flow warmup by giving participants a dedicated, narrative-rich environment to learn the PSI-AMP breath sync mechanic before they enter the detection task.

**Narrative**: You are making psychic contact with your avatar for the first time, summoning it into existence through breath synchronisation. As connection deepens, the avatar's features (eyes, brows, blush, mouth) fade in from ghost impressions to full visibility. On completion: *"Initial contact established. Your avatar is with you."*

**Two modes — same component, same route:**

| Mode | Trigger | Avatar state | Aura |
|------|---------|--------------|------|
| First Contact | `first_contact_complete === false` | Ghost features reveal with sync | None until ~80% |
| Deeper Contact | `first_contact_complete === true` | Full opacity always | Pulsing rings at sync intensity |

**Core mechanic**: Identical to Ebb & Flow PSI-AMP warmup. A circle/avatar pulses at 4 s/cycle. Hold button during expansion (inhale), release during contraction (exhale). `BreathPrompt` shows staggered "press → inhale" / "release → exhale" text. For returning players, prompts fade after 3 cycles.

**Rolling sync buffer** (`useBreathSync.js`): last 4 cycles only. Older cycles are evicted as new ones arrive. This prevents early fumbling from permanently blocking the 80% threshold — participants always have a fresh path to completion.

**Completion threshold**: rolling mean ≥ 0.80 after ≥ 4 cycles minimum.

**Avatar reveal** (`ContactAvatar.jsx`): 
- Ghost feature opacity: `0.08 + (syncLevel / 0.80) * (1 - 0.08)` — reaches 1.0 exactly at 80% sync
- Head ellipse always at full opacity
- All four breath animation cues active (scale 15%, eyelids, blush, brows) — fixed amplitude regardless of game mode

**Aura effect**: Three concentric rings behind avatar head, expanding outward like ripples on each breath cycle, staggered by 1/3 cycle. Ring opacity scales with `syncLevel`. In First Contact: `max opacity = 0.60`. In Ebb & Flow: `max opacity = 0.35` (ambient, less distracting). Colour: rgba(253, 188, 180, 0.5).

**`SyncMeter.jsx`**: Arc below avatar showing rolling sync mean. Amber < 50%, yellow-green 50–79%, green ≥ 80%. Pulses on each new cycle score. Flashes green on first completion.

**`BreathPrompt.jsx`** timing:

| Phase | Text | Style |
|-------|------|-------|
| 0.00–0.05 | "press" | Bold, amber |
| 0.05–0.50 | "inhale" | Regular, amber |
| 0.50–0.55 | "release" | Bold, blue |
| 0.55–1.00 | "exhale" | Regular, blue |

**State machine**: `INTRO → SYNCING → COMPLETE`

**Supabase writes on completion**:
```
first_contact_complete = true          (first time only)
first_contact_complete_at = now()      (first time only)
deeper_contact_best_sync = max(current, previous)
deeper_contact_last_sync = current rolling mean
deeper_contact_sessions += 1
```

**Games page cards**:
- If `first_contact_complete === false`: show "First Contact" card prominently at top, lock icon on Ebb & Flow card. Tagline: *"Begin here. Meet your avatar for the first time."*
- If `first_contact_complete === true`: show "Deeper Contact" card normally. Tagline: *"Return to strengthen your connection."*

**Onboarding guard**: `/games/ebb-flow` redirects to `/games/first-contact` if `first_contact_complete === false`.

**Aura in Ebb & Flow**: `AvatarBreathPacer.jsx` reads `deeper_contact_last_sync` from profile. If 0, aura invisible. Aura is a fixed ambient effect seeded at session load — does not update during the detection task.

**Status**: Specced. Not yet built. Build spec: `first-contact-spec.md`.

### Philosophy
Every user gets a cartoony humanoid avatar that evolves as they accumulate points. The base avatar (skin + eye color only) is chosen at onboarding. Feature categories unlock at point thresholds, giving users a persistent reason to return and play more games. The avatar appears in the site header and on leaderboards.

### Onboarding guard
After signup, `App.jsx` checks whether an `avatars` row exists for the user. If not, the user is redirected to `/profile/avatar` before accessing any other screen. This ensures every user has a base avatar before they see the dashboard.

### Navigation flow
```
Header avatar circle (36px, always visible when logged in)
  → click → /profile
              ├── large avatar preview (160px)
              ├── display name + role badge
              ├── points total + progress bar to next unlock
              ├── unlock tracker (upcoming features, greyed out)
              ├── activity summary (completed sessions count)
              └── "Edit Avatar" button → /profile/avatar
                    → AvatarEditor
                          └── Save → back to /profile
```

### Header avatar
- Renders `<BaseAvatar size={36} />` clipped to a circle in `Nav.jsx`
- Fetched via React Query key `['avatar', userId]`
- Falls back to a plain pink circle with the user's initial if no avatar row exists yet

### BaseAvatar component
**File**: `src/components/Avatar/BaseAvatar.jsx`  
**Props**: `skinColor` (hex), `eyeColor` (hex), `size` (px, default 200)  
**Renders**: Pure SVG, no UI chrome. Safe to use at any size — 36px in header, 160px on profile, 40px on leaderboards.

**SVG construction:**
- `viewBox="0 0 200 185"`
- Head: `<ellipse cx="100" cy="105" rx="64" ry="68" />`
- Left sclera: `<circle cx="76" cy="100" r="17" />`; right: `<circle cx="124" cy="100" r="17" />`
- Left eyelid (upper, skin-colored crescent): `M 60 91 Q 76 94 92 91 A 17 17 0 0 0 60 91 Z`
- Right eyelid: `M 108 91 Q 124 94 140 91 A 17 17 0 0 0 108 91 Z`
- The eyelid's bottom edge (Bézier) droops into the eye; its top edge follows the sclera arc — produces a calm, half-lidded expression
- Mouth: `M 82 145 Q 100 149 118 145` — wide, nearly flat, corners tilt slightly up
- Eyebrows derived from `darken(skinColor, 18)`; blush from `mix(skinColor, "#FF8FAB", 0.45)`
- No ears, nose, neck, or body in the base — those are unlock categories

### Color palettes
**Skin (16 swatches):**
Human: `#FFEEE8 #FDBCB4 #F5CBA7 #E8B08A #C68642 #8D5524 #4A2912`  
Fantasy: `#D4B8E0 #A8D8EA #B5EAD7 #FFD6A5 #C9B1D0 #8ECAE6 #95D5B2 #E8C1C1 #BDE0FE`

**Eyes (16 swatches):** Warm Brown `#6B4F3A`, Dark Brown `#3D2B1F`, Hazel `#8B7355`, Sky Blue `#4A90D9`, Deep Blue `#1C5FA0`, Forest `#4A8B5A`, Dark Green `#2D6A4F`, Purple `#7B4FCF`, Amber `#FFBF00`, Red `#CC2200`, Teal `#00897B`, Pink `#F06292`, Steel `#546E7A`, Violet `#8B008B`, Ember `#FF8C00`, Moss `#2E7D32`

### Unlock progression
| Points | Unlocks |
|---|---|
| 0 | Base avatar (skin + eye color) |
| 50 | Ears (human, cat, fox, rabbit, bear, dog, deer, wolf) |
| 100 | Nose styles |
| 150 | Hair type + hair color picker |
| 200 | Mouth styles |
| 300 | Auras / glows |
| 500 | Scars, marks, tattoos |

Species are expressed by mixing ear type + nose type + tail type freely — no species presets.

### AvatarEditor component
**File**: `src/components/Avatar/AvatarEditor.jsx`  
- On mount: `SELECT * FROM avatars WHERE user_id = auth.uid()` — pre-populates pickers if row exists
- On save: upsert into `avatars`; navigate to `/profile` on success
- Currently shows only skin + eye pickers (base avatar); unlock-gated feature pickers added later

### ProfilePage
**File**: `src/pages/ProfilePage.jsx`  
- Large avatar preview with "Edit Avatar" → `/profile/avatar`
- Display name + role badge from `profiles`
- Points total + progress bar to next unlock milestone
- Unlock tracker list (upcoming categories, greyed out with point threshold shown)
- Activity summary: count of completed `game_sessions`

---

## 12. Deployment

**Hosting**: Vercel  
**Repo**: GitHub (push from local, Vercel auto-deploys on push to `main`)  
**SPA routing**: `vercel.json` rewrites all paths to `index.html`

**Environment variables** (set in both `.env.local` and Vercel dashboard):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

**Deploy steps** (one-time):
1. Push repo to GitHub
2. Vercel → New Project → Import GitHub repo
3. Add env vars in Vercel dashboard
4. Deploy — subsequent pushes to `main` auto-deploy

**Windows note**: Use PowerShell commands one at a time (no `&&` chaining).

---

## 13. Open Next Steps

**First Contact / Deeper Contact (next Claude Code session):**
- [ ] Run SQL: add First Contact columns to `profiles` (see §6)
- [ ] Build `src/games/FirstContact/` per `first-contact-spec.md`
- [ ] Add `/games/first-contact` route in `App.jsx`
- [ ] Add onboarding guard — redirect `/games/ebb-flow` → `/games/first-contact` if not complete
- [ ] Update `Games.jsx` — conditional First Contact vs Deeper Contact card
- [ ] Add aura effect to `AvatarBreathPacer.jsx` (see spec §13)
- [ ] Add `deeper_contact_last_sync` load to Ebb & Flow session start

**Ebb & Flow — remaining:**
- [ ] Remove temporary `[QUEST]` console.log statements from `useQuestStaircases.js` and `EbbAndFlow.jsx`
- [ ] Run several more sessions to verify posterior distributions continue narrowing toward threshold
- [ ] Compute posterior SD from `normalized_posteriors` for convergence check — formula: `sqrt(sum(posterior[i] * (thresh[i] - mean)^2))`

**Ebb & Flow — completed:**
- [x] Built `src/games/EbbAndFlow/` per `ebb-and-flow-spec.md`
- [x] `npm install jsquest-plus` (package name on npm is `jsquest-plus` with hyphen)
- [x] GET_READY screen between warmup and first trial
- [x] `resetAvatarToNeutral()` — synchronous rAF cancel + setAttribute reset + 1000ms hold
- [x] Added `/games/ebb-flow` route in `App.jsx`
- [x] "Games" link in `Nav.jsx`; Ebb & Flow preview card on `Landing.jsx`; `Games.jsx` page
- [x] Supabase columns for Ebb & Flow added to `profiles`
- [x] `onSessionComplete` wired — total trials and points persisting across sessions
- [x] QUEST+ staircase serialization and cross-session restoration confirmed working
- [x] QUEST+ psychometric function fixed — correct Weibull P(correct) formula, scalar update() call
- [x] `trials` table: `game_name`, `cumulative_trial_number` (trigger), `created_at` added
- [x] `SessionFeedback.jsx` — post-10-trial feedback screen with sensitivity arcs, sync chart, change awareness, focus suggestion

**Avatar system:**
- [ ] Run SQL: create `avatars` + `avatar_unlocks` tables with RLS; add `points` column to `profiles`
- [ ] Create `src/components/Avatar/BaseAvatar.jsx` (pure SVG component)
- [ ] Create `src/components/Avatar/AvatarEditor.jsx` (editor UI with Supabase save/load)
- [ ] Create `src/pages/ProfilePage.jsx`
- [ ] Update `Nav.jsx` — add avatar circle (36px) linking to `/profile`
- [ ] Update `App.jsx` — add `/profile` and `/profile/avatar` routes + onboarding guard

**Supabase wiring:**
- [ ] Create remaining tables (`studies`, `performance`, `questionnaire_responses`)
- [ ] Enable RLS on all tables, write policies (`user_id = auth.uid()`)
- [ ] Add `profiles` trigger — auto-create profile row on auth signup
- [ ] Role-based post-login redirect

**Pond Watch:**
- [ ] Wire `onSessionComplete` to Supabase inserts
- [ ] Expose `/games/pond-watch` route and link from Dashboard + Games page

**Pages still to build:**
- [ ] Onboarding flow — consent + demographics
- [ ] `/study` — participant portal
- [ ] `/admin` — lab panel
- [ ] Dashboard performance charts (Recharts)
- [ ] Leaderboard page

**Polish:**
- [ ] Login/Signup responsive padding on mobile
- [ ] Dashboard responsive account info card

---

## 14. Responsive Design

**Core principle**: Minimise friction unless design requires user investment. Never add UI complexity (hamburgers, modals, extra taps) without a clear reason.

**Breakpoints** (standard Tailwind):
- `sm` 640px — large phone
- `md` 768px — tablet portrait
- `lg` 1024px — tablet landscape / small desktop
- `xl` 1280px — desktop

**Approach**: Tailwind responsive classes for layout (grids, padding, show/hide). `useBreakpoint()` hook only for structural component-level decisions.

**Nav on mobile**:
- Logged-out: logo + "Join free" button only (About and Log in dropped)
- Logged-in: logo + "Dashboard" link only
- No hamburger — not enough nav items to justify the friction

**Game cards on mobile**: illustration stacks above info (Option 1). Uses CSS `order` classes — `order-first` on mobile pulls illustration to top, `md:order-last` returns it to right column on desktop. Border flips from `border-b` (stacked) to `md:border-l` (side-by-side). When there are 4+ games, reconsider switching to compact thumbnail row layout.

**Layout collapse rules**:
- Hero: `lg:grid-cols-[1fr_min(340px,35%)]` → single column below `lg`
- Game card: `md:grid-cols-[1fr_200px]` → single column, illustration on top
- Steps: `md:grid-cols-3` → single column on mobile
- Tiers: `sm:grid-cols-2 lg:grid-cols-3` → 1 → 2 → 3 columns
- Dashboard game grid: `md:grid-cols-2` → single column on mobile
- Section padding: `24px` horizontal on all screen sizes (was 40px desktop only)

**Recommended: Claude Code for implementation, Claude.ai for design**

- Use **Claude.ai** (this chat) for architecture decisions, design mockups, and planning
- Use **Claude Code** for all file editing, running builds, and git operations — it works directly on the local filesystem with no download/upload friction

**Claude Code setup:**
```powershell
npm install -g @anthropic/claude-code
cd radlab
claude
```
Requires an Anthropic API key from `console.anthropic.com`.

**Git workflow (PowerShell — no `&&`):**
```powershell
git add .
git commit -m "your message"
git push
```
Vercel auto-deploys on every push to `main`.

**When sharing context with a new conversation**, paste in `website.md` — it contains everything needed to get up to speed. Individual changed files can be presented directly from Claude.ai rather than repacking the full tarball.

---

## 15. Key Learnings

- Safari/iOS: avoid `@keyframes` with custom properties inside SVGs, `foreignObject`, inline `<style>` in SVG groups. Move animations to document `<head>`. Use `setAttribute` + `requestAnimationFrame` for all SVG animation.
- Logo: use `RADlab_Logo.svg` (white outline) or `RADlab_Logo_light.svg` (dark outline) — never redraw. White outline sits directly on the pink nav background. Dark outline for any other light surface.
- `useRef`-based timing is the correct React pattern for RT measurement and breath timing. Never use `useState` for values read inside animation loops or timeouts.
- SVG attribute names in `setAttribute` must be hyphenated (`stop-color`, `stroke-width`, `flood-color`) — camelCase only works in CSS, not XML attributes. Gradients silently fall back to black if this is wrong.
- QUEST+ adaptive staircase (jsQuestPlus) for threshold tasks; SDT analysis for go/no-go (Pond Watch).
- **jsQuestPlus serialization**: save `normalized_posteriors` (not `pdfAll`, not `priors`) and `trial_count` per staircase. Restore by passing `saved.normalized_posteriors` as the `priors` argument to the new jsQuestPlus constructor — this seeds the new instance from the previous session's posterior. jsQuestPlus does not reconstruct `stim_list` on restore (so `stim_list.length` will be 0), but the posterior is correctly restored and `getStimParams()` will return the right next stimulus. Track `trial_count` separately in a `useRef` since jsQuestPlus doesn't restore it.
- **jsQuestPlus initialization timing**: the staircase hook must wait for the Supabase profile fetch to resolve before deciding whether to restore or initialize fresh. Use a `useEffect` that watches `savedState` and guards on `undefined` (still loading) vs `null` (confirmed no state). Initializing on mount before the fetch completes always produces fresh staircases regardless of saved data.
- **jsQuestPlus internal property**: trial count is `stim_list?.length` not `trialCount` — check the actual object shape rather than assuming property names.
- **Trials table schema**: always include `game_name` (indexed text column) and `cumulative_trial_number` (managed by a `BEFORE INSERT` Postgres trigger — never set from application code). Add `created_at TIMESTAMPTZ DEFAULT NOW()` for reliable ordering. The cumulative trigger queries `MAX(cumulative_trial_number)` across all trials joined to the same user via `game_sessions`, increments by 1, and sets it on the new row automatically.
- **Diagnosing staircase bugs**: if all staircases show identical posteriors after trials, check (1) whether `update()` is being called with the right response index (0/1/2 — never undefined), (2) whether the staircase key lookup is resolving correctly for all four conditions, (3) whether the `update()` call wraps the stimulus in an array (`staircase.update([log10Mag], responseIndex)`). A posterior identical to the prior after N trials means `update()` either wasn't called or received symmetric inputs that cancelled out.
- Supabase handles auth + DB — no custom backend needed.
- Windows PowerShell: no `&&` — run commands one at a time.
- For file updates: present individual changed files rather than repacking the full tarball.
- Avatar reset before each trial (including warmup start) must be synchronous: cancel `requestAnimationFrame`, call `resetAvatarToNeutral()` via direct `setAttribute` calls, then hold 1000ms via `useRef` timer before restarting the rAF loop. Any state-driven or `useEffect`-driven reset will be too slow — one or more frames will render before the reset takes effect.
- **jsQuestPlus psychometric function**: `getStimParams()` returns a plain scalar. `update()` takes a plain scalar too — `update(log10Mag, responseIndex)`, NOT `update([log10Mag], responseIndex)`. Wrapping in array causes NaN posterior silently.
- **jsQuestPlus Weibull P(correct)**: do NOT use `jsQuestPlus.weibull()` — that function returns P(incorrect). Implement P(correct) directly: `(1 - lapse) * (guess + (1 - guess) * (1 - Math.exp(-Math.pow(10, slope * (stim - threshold))))) + lapse * guess`. No `/20` divisor — slope 5.70 is already in the correct units for this parameterisation.
- **jsQuestPlus `psych_samples` order** must match the psychometric function's argument order exactly: `[thresholdSamples, slopeSamples, guessSamples, lapseSamples]`.
- **npm package name**: `jsquest-plus` (hyphenated) — not `jsquestplus`. Import as `import jsQuestPlus from 'jsquest-plus'`.
- **First Contact rolling buffer**: use a fixed-size 4-cycle buffer (`slice(-4)`) for sync scoring. Never use a cumulative mean — early poor cycles would permanently lower the score and make the 80% threshold unreachable.
- **Aura rings in SVG**: render ring circles *before* the head ellipse in SVG draw order so they appear behind the avatar, not on top of it.
- Platform theme is **awareness and attunement**, not water specifically. Game names should evoke noticing and change (Pond Watch, Ebb & Flow, First Contact, Deeper Contact) — contemplative and sensory rather than clinical.
