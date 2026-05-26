# RADlab Platform — Design & Architecture Decisions

> **Regulatory and Affective Dynamics Lab**  
> University of Toronto · PI: Professor Norman Farb, PhD  
> Last updated: 2026-05-26 (BreathBelt §20 updated: MLR calibration pipeline replacing percentile approach; fitBestModel — 6 model variants, best by Pearson R; useBeltConnection exposes mlrWeightsRef, filterState3Ref, syncQuality, calibReviewData, beginCalibCollection, redoCalibration, getPacerRadiusFnRef; BeltSyncRing retained for other games; SynchronyBar shown during trials; useStreamingBackup adds parallel File System Access API CSV backup; belt_mlr_migration.sql adds calib_model_label, calib_fit_r, calib_lag_ms to belt_sessions.)

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
    RADlab_Logo.svg           ← original (white+pink outline on transparent) — use on hub page; white dissolves into #FCF0F5
    RADlab_Logo_light.svg     ← dark #1c1c1e outline variant — use everywhere else in UI
    images/
      people/                 ← lab member photos (migrate from radlab.zone/images/people/)
      veggies/                ← Farm Joy 24 veggie sprite PNGs
  src/
    components/
      Nav.jsx                 ← games nav (auth-aware); NOT used on hub or lab pages
      Avatar/
        BaseAvatar.jsx        ← pure SVG avatar component (skinColor, eyeColor, size props)
        AvatarEditor.jsx      ← avatar editor UI with Supabase save/load
    data/                     ← static data files (no CMS)
      people.js               ← PI, grad students, alumni records — exports: pi, gradStudents, alumni
      research.js             ← lab description + researchAreas array — exports: labDescription, researchAreas
      publications.json       ← annotated bibliography (reverse chrono; annotation field nullable; 69 entries)
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
      BreathBelt/               ← respiratory detection thresholds (§20)
        BreathBelt.jsx
        constants.js
        breathUtils.js
        belt_schema.sql
        hooks/
          useBeltConnection.js
          useBeltSession.js
          useBeltQuestStaircases.js
          useTrialRunner.js
        components/
          BrowserWarning.jsx
          CalibrationScreen.jsx
          BaselineScreen.jsx
          FixedTrialsScreen.jsx
          StaircaseScreen.jsx
          BeltSyncRing.jsx
          SessionComplete.jsx
      FarmJoy/                  ← values clarification game (§19)
        FarmJoy.jsx
        constants.js
        data/
          values.js
          veggies.js
        hooks/
          useFarmJoySession.js
        components/
          FarmField.jsx         ← Round 1 background
          Greenhouse.jsx        ← Round 2 background
          FarmRow.jsx           ← Round 3 + Harvest background
          Veggie.jsx
          PullAnimation.jsx
          ValueCard.jsx
          SortBins.jsx
          FeedbackPrompt.jsx
          Intro.jsx
          HarvestSummary.jsx
    layouts/
      LabLayout.jsx           ← wraps all /lab/* routes; renders lab nav (About/People/Research/Publications/Contact)
    lib/
      supabase.js             ← supabase client singleton
    pages/
      Hub.jsx                 ← root splash page (/); logo + 3 cards (Come See, UTMaps, Our Lab); no nav links
      Landing.jsx             ← games landing page (moved from / to /games)
      Login.jsx               ← auth: sign in
      Signup.jsx              ← auth: create account
      Dashboard.jsx           ← protected: post-login home
      ProfilePage.jsx         ← user profile: avatar, points, unlock progress
      Games.jsx               ← public games listing (/games/list) — Pond Watch + Ebb & Flow cards
      lab/
        AboutPage.jsx         ← stub (content TBD)
        PeoplePage.jsx        ← reads people.js; PI featured card, grads grid, collapsible alumni section
        ResearchPage.jsx      ← reads research.js; lab description intro + research area cards
        PublicationsPage.jsx  ← reads publications.json; reverse chrono grouped by year; bold lab member names
        ContactPage.jsx       ← address + joining info (RA / grad / postdoc)
    App.jsx                   ← router + auth state
    main.jsx                  ← entry point
    index.css                 ← Tailwind + brand CSS tokens + font guardrails
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
| `/` | `Hub` | Public — splash with 3 cards; no nav links |
| `/games` | `Landing` | Public — games landing page (was `/`) |
| `/games/list` | `Games` | Public — game listing page |
| `/login` | `Login` | Public only (redirects to `/dashboard` if logged in) |
| `/signup` | `Signup` | Public only |
| `/dashboard` | `Dashboard` | Protected (redirects to `/login` if not logged in) |
| `/profile` | `ProfilePage` | Protected — avatar, points, unlock progress |
| `/profile/avatar` | `AvatarEditor` | Protected — avatar editor; redirected here on first login |
| `/games/first-contact` | `FirstContact` | Protected — mandatory onboarding sync game; also accessible as Deeper Contact standalone |
| `/games/pond-watch` | `PondWatch` | Protected |
| `/games/ebb-flow` | `EbbAndFlow` | Protected — redirects to `/games/first-contact` if `first_contact_complete === false` |
| `/games/farm-joy` | `FarmJoy` | Protected |
| `/games/breath-belt` | `BreathBelt` | Protected — lab-only guard internal to component |
| `/lab` | redirect → `/lab/people` | Public |
| `/lab/about` | `AboutPage` | Public — stub |
| `/lab/people` | `PeoplePage` | Public — reads from `src/data/people.js` |
| `/lab/research` | `ResearchPage` | Public — stub |
| `/lab/publications` | `PublicationsPage` | Public — reads from `src/data/publications.js` |
| `/lab/contact` | `ContactPage` | Public |
| `/study` | — | Participant tier (future) |
| `/admin` | — | Lab tier (future) |

**Nav behaviour — contextual by route prefix:**

- **Hub (`/`)**: logo only (links home); no nav links. Logo uses original `RADlab_Logo.svg` — white fill dissolves into `#FCF0F5` background, leaving pink + gray shapes.
- **Games (`/games/*`, `/login`, `/signup`, `/dashboard`, `/profile*`)**: `Nav.jsx` as-is — logo + Games + Dashboard + avatar circle. Logo uses `RADlab_Logo_light.svg`.
- **Lab (`/lab/*`)**: `LabLayout.jsx` renders its own nav — logo + About · People · Research · Publications · Contact. Logo uses `RADlab_Logo_light.svg`. Logo always links back to `/` (hub).

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

**Font size guardrails** (defined as CSS custom properties in `index.css` — never go below `--fs-min`):

| Token | rem | px | Usage |
|---|---|---|---|
| `--fs-min` | `0.75rem` | 12px | Absolute floor — WCAG minimum |
| `--fs-mono-sm` | `0.75rem` | 12px | Space Mono chips, tags, small labels |
| `--fs-mono-md` | `0.8125rem` | 13px | Space Mono nav links, CTAs, eyebrows |
| `--fs-body-sm` | `0.875rem` | 14px | Secondary DM Sans body text |
| `--fs-body` | `1rem` | 16px | Default body; iOS auto-zoom floor |
| `--fs-body-lg` | `1.125rem` | 18px | Comfortable long-form reading |

Space Mono reads small at any given size — prefer `--fs-mono-sm` or above for all labels.

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

**Hub + Lab pages (next Claude Code session):**
- [ ] Create `src/pages/Hub.jsx` — use `radlab_hub_mockup.html` as the visual reference (available in project files or regenerate from claude.ai conversation). Inline the RADlab_Logo.svg paths directly as `<svg>` at two sizes (nav: 42×36, hero: 66×56).
- [ ] Move `Landing.jsx` route from `/` to `/games` in `App.jsx`
- [ ] Add `/` → `Hub` route in `App.jsx`
- [ ] Create `src/layouts/LabLayout.jsx` — wraps `/lab/*` routes with lab nav (logo + About · People · Research · Publications · Contact). Logo links to `/`.
- [ ] Add `/lab`, `/lab/about`, `/lab/people`, `/lab/research`, `/lab/publications`, `/lab/contact` routes in `App.jsx` using `LabLayout` as wrapper
- [ ] Create `src/pages/lab/AboutPage.jsx` — stub with placeholder text
- [ ] Create `src/pages/lab/ResearchPage.jsx` — stub with placeholder text
- [ ] Create `src/pages/lab/PublicationsPage.jsx` — renders `src/data/publications.js`; reverse chrono; bold lab member names using `labMemberNames` array; annotation shown below citation if non-null
- [ ] Place downloaded files: `src/data/people.js`, `src/data/publications.js`, `src/pages/lab/PeoplePage.jsx`, `src/pages/lab/ContactPage.jsx`
- [ ] Add lab page CSS (from comment blocks in PeoplePage.jsx and ContactPage.jsx) to `index.css`
- [ ] Update `Nav.jsx` — ensure sign-out redirect goes to `/` (hub), not `/games`
- [ ] Migrate photos: download from `radlab.zone/images/people/` → `public/images/people/`; update photo paths in `src/data/people.js` to `/images/people/filename.jpg`

**Photo migration reference** (current filenames at radlab.zone/images/people/):
`norm2.jpg`, `thomas.jpg`, `john.jpg`, `sandy.jpg`, `liliana.jpg`, `zoey.jpg`, `geissy.png`, `phil.jpg`, `leanh.jpg`, `jordan.png`, `kyle.jpg`, `katie.jpg`, `yiyi.jpg`

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

**Farm Joy (next Claude Code session):**
- [ ] Run SQL: create `farm_joy_trials`, `farm_joy_performance`, `farm_joy_feedback`, `farm_joy_value_history` tables with RLS; add `farm_joy_sessions` and `farm_joy_last_core_values` columns to `profiles` (see §19)
- [ ] Drop `FarmField.jsx`, `Greenhouse.jsx`, `FarmRow.jsx` from claude.ai outputs into `src/games/FarmJoy/components/`
- [ ] Place 24 veggie PNGs in `public/images/veggies/` (filenames listed in §19)
- [ ] Build `src/games/FarmJoy/FarmJoy.jsx` per §19 state machine
- [ ] Create `src/games/FarmJoy/data/values.js` with the 38 value taxonomy
- [ ] Create `src/games/FarmJoy/data/veggies.js` with sprite list and value→veggie mapping helper
- [ ] Build remaining components: `Veggie.jsx`, `PullAnimation.jsx`, `ValueCard.jsx`, `SortBins.jsx`, `FeedbackPrompt.jsx`, `Intro.jsx`, `HarvestSummary.jsx`
- [ ] Create `src/games/FarmJoy/hooks/useFarmJoySession.js` for Supabase writes
- [ ] Add `/games/farm-joy` route in `App.jsx`
- [ ] Update `Games.jsx` with Farm Joy card (tagline and description in §19)

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

---

## 17. Still Water — Mood Check-in Game

### Overview

Still Water is a two-question mood check-in that reconstructs a position in the affective circumplex (valence × arousal) from two diagonal ratings. It is both a scientific instrument and a game — participants receive visual feedback in the form of an expressive avatar face that animates to reflect their composite state.

**Scientific paradigm**: Two bipolar ratings along the circumplex diagonals, decomposed into valence and arousal coordinates.
- Phase 1: Sad ↔ Excited (positive activation diagonal: x=t, y=t)
- Phase 2: Calm ↔ Tense (negative activation diagonal: x=−t, y=t)
- Composite: average of the two (x, y) pairs → nearest named sector + zone
- Ambivalence: Euclidean distance between the two rating vectors (large = emotionally mixed)

**Route**: `/games/still-water`
**Access**: Protected (logged-in users only)
**Game name slug**: `still_water`

### File structure

```
src/games/StillWater/
  StillWater.jsx          ← main game component (intro → phase1 → phase2 → reveal)
  expressionEngine.js     ← calcExpr() — FACS-based AU engine; exported for FaceRead reuse
  ExpressiveAvatar.jsx    ← SVG avatar with expression props; imports calcExpr
  WheelSVG.jsx            ← shared radial wheel; imported by StillWater and FaceRead
  constants.js            ← EMOTIONS array, INTENSITY_LABELS, coordinate helpers
```

### Shared components (used by FaceRead too)

| Export | File | Description |
|---|---|---|
| `calcExpr(valence, arousal, intensityT, pupilTier)` | `expressionEngine.js` | FACS AU engine — AU1/2/4/5/20/25/27/43/12/15 |
| `ExpressiveAvatar` | `ExpressiveAvatar.jsx` | SVG face; props: skinColor, eyeColor, size, valence, arousal, intensityT, pupilTier, glowColor |
| `WheelSVG` | `WheelSVG.jsx` | Radial wheel; props: activeIds, selection, hovered, onHover, onZoneClick, onNeutral, revealData |
| `EMOTIONS` | `constants.js` | 8-sector array with valence, arousal, pupilTier, colors, angles |
| `computeRating(phase, emotionId, zone)` | `constants.js` | Returns `{rating, x, y}` for a given diagonal phase + zone |
| `getCompositeLabel(cx, cy)` | `constants.js` | Maps (x, y) coords to nearest sector name |

### FACS expression engine — AU summary

| AU | Muscle | Signal | Formula |
|---|---|---|---|
| AU1 | Frontalis medialis | Inner brow up | `neg(v) × (1 − pos(a)×1.5) + surpriseBrow` |
| AU2 | Frontalis lateralis | Outer brow up | `pos(v) × (0.3 + pos(a)×0.7) + surpriseBrow×0.7` |
| AU4 | Corrugator supercilii | Brow knit/lower | `neg(v)×0.35 + neg(v)×pos(a)×0.75` |
| AU5 | Levator palpebrae | Lid raise / wide eyes | `pos(a)×0.85` |
| AU12 | Zygomaticus major | Smile (corners up) | `pos(v)` |
| AU15 | Depressor anguli | Frown (corners down) | `neg(v)×neg(a)×1.4` |
| AU20 | Risorius + platysma | Lip stretch (horizontal) | `neg(v)×pos(a)×1.4` |
| AU25 | Orbicularis oris | Lip part/gap | `neg(v)×pos(a)×1.1` |
| AU27 | Pterygoids | Jaw drop / O-mouth | `neg(v)×pos(a)×1.3` (threshold 0.28) |
| AU43 | Relaxed levator | Lid droop | `neg(a)×0.7` |

All AUs multiplied by `intensityT` before SVG transforms. Eyelid uses fixed-top anchor geometry (top anchored at y=83; only lash line moves downward). Brows track lash lift (lashLift coupling at ×0.8).

Pupil uses discrete 3×3 table (pupilTier × intensityZone), not continuous formula — pupillometry is primarily arousal-driven, not valence-driven.

### Supabase table — `stillwater_responses`

```sql
CREATE TABLE stillwater_responses (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at      timestamptz DEFAULT now(),
  participant_id  text,         -- from URL ?pid= or sessionStorage UUID
  pos_rating      int,          -- 1–7 (1=strong sad, 4=neutral, 7=strong excited)
  pos_x           float,        -- valence contribution from diagonal 1
  pos_y           float,        -- arousal contribution from diagonal 1
  neg_rating      int,          -- 1–7 (1=strong calm, 4=neutral, 7=strong tense)
  neg_x           float,
  neg_y           float,
  composite_x     float,        -- (pos_x + neg_x) / 2
  composite_y     float,        -- (pos_y + neg_y) / 2
  composite_label text,         -- nearest named sector
  ambivalence_x   float,        -- |pos_x − neg_x|
  ambivalence_y   float,        -- |pos_y − neg_y|
  ambivalence_mag float         -- Euclidean distance between the two rating vectors
);
ALTER TABLE stillwater_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon insert" ON stillwater_responses FOR INSERT TO anon WITH CHECK (true);
```

RLS allows anonymous insert. When integrated into the platform, add `user_id` FK → `profiles` and tighten to authenticated insert only.

### Game flow

1. **Intro screen** — illustrated diagonal diagram + two-step explanation (gold = axis 1, purple = axis 2)
2. **Phase 1** — Sad↔Excited sectors active only; live face updates on selection
3. **Phase 2** — Calm↔Tense sectors active only; live face updates on selection
4. **Reveal** — 0.6s pause → 1s ease-out animation: face transitions from neutral to composite; wheel highlights composite sector/zone; Supabase insert fires

### Scoring / points

Still Water is a check-in, not a scored game. Award **5 points** per completed check-in to `profiles.points`. No leaderboard. Track completion count in `profiles` (add `still_water_sessions` int column).

---

## 18. Face Read — Circumplex Identification Game

### Overview

Face Read presents a generated avatar face with a known emotional expression. The participant taps the area of the circumplex wheel that they think matches the face. Score is derived from the Euclidean distance between the tapped position and the correct position in (valence, arousal) space. Narrative framing: "A creature from the deep has surfaced. Can you read how it feels?"

**Route**: `/games/face-read`
**Access**: Protected
**Game name slug**: `face_read`

### Scientific paradigm

Inverse of Still Water: participant observes a face → maps to circumplex, rather than self-reports state → sees face. Measures:
- Circumplex reading accuracy (valence/arousal perception)
- Systematic biases (e.g. over-attribution of arousal, valence positivity bias)
- Learning curve across trials and sessions

### File structure

```
src/games/FaceRead/
  FaceRead.jsx            ← main game (intro → trial loop → session summary)
  useFaceReadSession.js   ← session state, trial generation, scoring, Supabase writes
```

Imports `ExpressiveAvatar`, `WheelSVG`, `EMOTIONS`, `calcExpr` from `../StillWater/`.

### Trial structure

**Per trial:**
1. Face is displayed at centre — neutral expression for 0.5s (preview)
2. Face animates to target expression over 0.8s (same easing as Still Water reveal)
3. Full wheel presented — all 25 zones clickable (8×3 + neutral)
4. Participant taps a zone
5. Feedback: correct zone glows green; tapped zone glows if different; score animates in
6. 1s pause → next trial

**Target generation:**
- Select a random emotion from EMOTIONS array (weighted toward all 8 equally)
- Select a random zone (0/1/2) — each weighted equally
- `intensityT = [1/3, 2/3, 1.0][zone]`
- Store `targetValence`, `targetArousal`, `targetIntensityT`, `targetSectorId`, `targetZone`

**Scoring:**
```js
// Circumflex coordinates for each zone within a sector:
// coord = emotion.valence * intensityT, emotion.arousal * intensityT
// Neutral = (0, 0)
// Distance: Euclidean in normalized (-1,+1) valence/arousal space
const MAX_DIST = 2 * Math.SQRT2;  // ≈ 2.828 — max possible distance
const dist = Math.sqrt((clickedX - targetX)**2 + (clickedY - targetY)**2);
const score = Math.round(Math.max(0, 100 * (1 - dist / MAX_DIST)));
```

Perfect hit = 100. Adjacent zone = ~85. Adjacent sector = ~60. Opposite corner = 0.

**Session length**: 10 trials. Configurable in `constants.js`.

**Session score**: mean of 10 trial scores (0–100).

### Feedback display

After each tap, show both face and wheel simultaneously:
- Correct zone: bright green glow `#1EA878`
- Tapped zone (if wrong): pink glow `#f068a4`
- Score badge animates in with the trial score
- Text: "Spot on!" (≥90), "Close!" (≥70), "Nearly!" (≥50), "Keep reading..." (<50)

### Session summary

After 10 trials, show:
- Mean accuracy score (large, prominent)
- Personal best and session count
- Breakdown: valence accuracy vs arousal accuracy (were they better at one dimension?)
- Leaderboard position (if public user)
- Points earned: `session_score / 10` rounded (max 10 points per session)

### Supabase schema additions

```sql
-- Add to game_sessions: no changes needed (game_name = 'face_read')

-- face_read_trials — one row per trial
CREATE TABLE face_read_trials (
  id                  uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id          uuid        REFERENCES game_sessions(id),
  user_id             uuid        REFERENCES profiles(id),
  trial_number        int,
  target_sector_id    int,        -- 0–7, index into EMOTIONS array
  target_sector_name  text,       -- 'Excited', 'Sad', etc.
  target_zone         int,        -- 0=mild, 1=moderate, 2=strong
  target_intensity_t  float,
  target_valence      float,
  target_arousal      float,
  clicked_sector_id   int,        -- null if neutral clicked
  clicked_zone        int,        -- null if neutral clicked
  clicked_valence     float,
  clicked_arousal     float,
  distance            float,      -- Euclidean in normalized space
  trial_score         int,        -- 0–100
  response_time_ms    int,        -- ms from face reveal to tap
  created_at          timestamptz DEFAULT now()
);

-- face_read_performance — one row per session
CREATE TABLE face_read_performance (
  id                  uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id          uuid        REFERENCES game_sessions(id),
  user_id             uuid        REFERENCES profiles(id),
  mean_score          float,      -- 0–100
  valence_accuracy    float,      -- mean |clicked_valence - target_valence| (lower = better)
  arousal_accuracy    float,      -- mean |clicked_arousal - target_arousal|
  trials_completed    int,
  created_at          timestamptz DEFAULT now()
);
```

RLS: users can insert and read only their own rows.

Add to `profiles`:
```sql
ALTER TABLE profiles ADD COLUMN face_read_sessions    int DEFAULT 0;
ALTER TABLE profiles ADD COLUMN face_read_best_score  float;
ALTER TABLE profiles ADD COLUMN face_read_total_score float DEFAULT 0;
```

### Game card copy

**Name**: Face Read  
**Tagline**: "A creature has surfaced. Can you read how it feels?"  
**Description**: Study a face and tap where it lands on the feeling map. Train your eye for emotion.  
**Illustration concept**: Avatar face emerging from water, wide-eyed, expression ambiguous  

---

### Decision

The platform root (`radlab.vercel.app`) is a **hub splash page** with three equal cards linking to:
1. **Come, See** — the games platform (`/games`)
2. **UTMaps** — knowledge translation project (external link or `/utmaps` TBD)
3. **Our Lab** — academic lab pages (`/lab/people`)

Lab pages and games pages share the same Vite/React codebase and Vercel deployment but use separate layouts and nav.

### Hub page (`src/pages/Hub.jsx`)

- Route: `/`
- No nav links — logo only in header (links back to `/`)
- Logo: inline the RADlab_Logo.svg paths directly as `<svg>` at two sizes (nav 42×36, hero 66×56). The white fill dissolves into `#FCF0F5`, showing only pink and gray shapes. Do NOT use `RADlab_Logo_light.svg` here.
- Three equal white cards, all light by default, flip to dark (`#1c1c1e`) on hover
- Visual reference: `radlab_hub_mockup.html` (generated in claude.ai session 2026-05-04)
- Sign-out from games must redirect to `/` (hub), not `/games`

### Lab layout (`src/layouts/LabLayout.jsx`)

Wraps all `/lab/*` routes. Renders:
- Sticky nav: logo (links to `/`) + links: About · People · Research · Publications · Contact
- Logo: `<img src="/RADlab_Logo_light.svg" height="34" alt="RADlab logo" />`
- Main content area (no Supabase auth — all public)
- Footer consistent with hub

### Lab data files

| File | Location | Purpose |
|---|---|---|
| `people.js` | `src/data/people.js` | PI, grad students, alumni — edit here to update people page |
| `publications.js` | `src/data/publications.js` | Annotated bibliography; reverse chrono; `annotation` field nullable |

### Lab pages

| Page | File | Status |
|---|---|---|
| About | `src/pages/lab/AboutPage.jsx` | Stub — content TBD |
| People | `src/pages/lab/PeoplePage.jsx` | Built — reads `people.js`; PI featured, grads grid, alumni collapsible |
| Research | `src/pages/lab/ResearchPage.jsx` | Stub — content TBD |
| Publications | `src/pages/lab/PublicationsPage.jsx` | Template built — reads `publications.js`; bold lab authors via `labMemberNames` |
| Contact | `src/pages/lab/ContactPage.jsx` | Built — address + RA/grad/postdoc joining sections |

### CSS additions for lab pages

Add to `index.css` — copy from comment blocks at bottom of `PeoplePage.jsx` and `ContactPage.jsx`:
- `.lab-page`, `.lab-section`, `.lab-section__heading` — shared layout
- `.person-card`, `.person-grid`, `.alumni-toggle` — people page
- `.contact-address`, `.contact-block`, `.contact-cta` — contact page
- All font sizes reference guardrail tokens (`--fs-mono-sm`, `--fs-body-sm`, etc.) — never hardcode below 12px

### Photo migration

Photos currently at `radlab.zone/images/people/`. Steps:
1. Download each from `https://www.radlab.zone/images/people/<filename>`
2. Place in `public/images/people/<filename>`
3. Update `photo` paths in `src/data/people.js` to `/images/people/<filename>`

Filenames: `norm2.jpg` `thomas.jpg` `john.jpg` `sandy.jpg` `liliana.jpg` `zoey.jpg` `geissy.png` `phil.jpg` `leanh.jpg` `jordan.png` `kyle.jpg` `katie.jpg` `yiyi.jpg` `jaafar.jpg`

---

## 19. Farm Joy: Values Clarification Game

### Overview

Farm Joy is a values clarification game in which the participant pulls plants from a soil grid, sorts the revealed value words into Plant or Compost bins, then narrows down across two further rounds to identify a small set of core values. The progression is sorting → greenhouse → planting → harvest. Each visit samples a fresh subset from a 38 value taxonomy, so repeated play allows a stable signal of personal values to emerge.

Narrative framing: the participant is deciding what kind of values they want to grow to bring joy to their life. They experiment with harvesting from many known sources of value to see what works best. Over time, with repeated visits, the values that matter most should emerge as a consistent signal.

**Route**: `/games/farm-joy`
**Access**: Protected
**Game name slug**: `farm_joy`

### Scientific paradigm

Values clarification through forced binary choice (Plant or Compost) followed by ipsative selection (pick 6, then pick 3). Lineage: ACT (Acceptance and Commitment Therapy) values clarification, motivational interviewing, and Schwartz's hierarchical ranking work. The 38 item taxonomy combines plain language items from VIA Character Strengths, Schwartz Refined Theory, and the Rokeach Values Survey, collapsed and standardized for accessibility.

Construct measured: subjective endorsement of named values, and stability of endorsement across repeated sessions. Per session output is the participant's selected hierarchy: 24 sampled → up to N planted → up to 6 in greenhouse → up to 3 final. Across sessions, the cumulative value history table tracks how often each value survives each round, building a probabilistic signal of stable personal values.

### Value taxonomy (38 items, 7 categories)

| Category | Count | Items |
|---|---|---|
| Cognitive/exploration | 3 | Curiosity, Creativity, Wisdom |
| Character/conduct | 7 | Integrity, Courage, Self-control, Responsibility, Humility, Perseverance, Authenticity |
| Relational | 8 | Kindness, Love, Family, Community, Friendship, Forgiveness, Gratitude, Loyalty |
| Moral/civic | 4 | Fairness, Peace, Tolerance, Service |
| Hedonic/openness | 7 | Freedom, Agency, Adventure, Fun, Humor, Beauty, Nature |
| Meaning/order | 5 | Hope, Spirituality, Tradition, Security, Presence |
| Wellbeing/self | 4 | Health, Achievement, Influence, Growth |

### Per-session sampling

Each session randomly samples 24 of the 38 values, stratified by category for breadth:

| Category | Pool | Sample |
|---|---|---|
| Cognitive/exploration | 3 | 3 |
| Character/conduct | 7 | 4 |
| Relational | 8 | 4 |
| Moral/civic | 4 | 3 |
| Hedonic/openness | 7 | 4 |
| Meaning/order | 5 | 3 |
| Wellbeing/self | 4 | 3 |
| **Total** | **38** | **24** |

Sampling is fresh each session (no memory of recent draws). The 24 sampled words are logged so retrospective analysis can adjust for exposure imbalance.

### Veggie sprites

24 PNG sprites in `public/images/veggies/`. Filenames: `beet.png`, `carrot.png`, `daikon.png`, `garlic.png`, `ginger.png`, `horseradish.png`, `kohlrabi.png`, `leek.png`, `onion.png`, `other1.png`, `other2.png`, `other3.png`, `other4.png`, `other5.png`, `other6.png`, `other7.png`, `parsnip.png`, `potato.png`, `potato_boots.png`, `radish.png`, `rutabaga.png`, `sweetpotato.png`, `taro.png`, `turmeric.png`.

Each session shuffles all 24 sprites and assigns one to each of the 24 sampled values — every veggie is unique per session (24 sprites for 24 values). Mapping is fixed within a session: the same value always uses the same veggie across rounds 1, 2, and 3.

### File structure

```
src/games/FarmJoy/
  FarmJoy.jsx                ← main FSM, owns session state
  constants.js               ← CFG, PHASE enum, sampling helpers
  data/
    values.js                ← 38 values across 7 categories
    veggies.js               ← 24 sprite names + value→veggie helper (1:1, no repeats)
  hooks/
    useFarmJoySession.js     ← Supabase writes, session lifecycle
  components/
    FarmField.jsx            ← Round 1 background (built; see §19 Status)
    Greenhouse.jsx           ← Round 2 background (built)
    FarmRow.jsx              ← Round 3 + Harvest background (built)
    Veggie.jsx               ← single sprite renderer
    PullAnimation.jsx        ← Mario-style yank animation overlay
    ValueCard.jsx            ← revealed value word, flips into veggie
    SortBins.jsx             ← Plant + Compost bins for round 1
    FeedbackPrompt.jsx       ← yes/no + 30 char text overlay
    Intro.jsx                ← landing screen with narrative
    HarvestSummary.jsx       ← final core values + closing copy
```

### Game flow (state machine)

```
INTRO
  ↓
ROUND_1_SORTING                          // 24 mounds in 4×6 grid
  ├── (zero plants) → ZERO_PLANT_FEEDBACK → SESSION_END
  └── (≥1 plant)    → ROUND_2_GREENHOUSE
ROUND_2_GREENHOUSE                       // up to 6 in 2×3 pots
  ↓ confirm
ROUND_3_PLANTING                         // up to 3 across 3 rows
  ↓ confirm
HARVEST                                  // chosen veggies multiply across rows
  ↓
SESSION_COMPLETE
```

Underfull feedback (Round 2 < 6, Round 3 < 3) renders as an overlay modal that pauses underlying state. Always optional, never blocks progression.

### Round 1: Sorting

- 24 mounds with green stalks in a 4×6 grid (FarmField component)
- Tap mound → pull animation → ValueCard reveal → tap Plant or Compost
- Each plant decision is a discrete trial with a recorded RT (mound tap to bin tap)
- After all 24 sorted: if zero plants, trigger zero-plant feedback overlay; else advance to Round 2

**Zero-plant feedback copy**:

> Sorry, we didn't plant any seeds you value this time. Each visit to the farm only shows you some of the options. Want to share what we missed that you'd have said 'yum' to?

Yes / No buttons. If Yes, single 30 char text input. Either path closes with: *"Thanks for visiting. Come back and play again soon."*

### Round 2: Greenhouse

- 6 terracotta pots in 2×3 grid (Greenhouse component)
- Planted values from Round 1 are visible at the bottom of the screen as veggies
- Tap a veggie to select; tap a pot to place. Tap a placed veggie to remove.
- Up to 6 can be in pots simultaneously
- If fewer than 6 plants exist from Round 1, pots autofill with all available
- Confirm advances to Round 3
- If pots underfull at confirm time, trigger underfull feedback overlay

**Underfull feedback copy**: *"What values would fill your bowl?"* (yes/no + 30 char text mechanics, same as zero-plant)

### Round 3: First Planting

- 3 row spots in 3 horizontal soil bands (FarmRow component, `cropsPerRow={[1,1,1]}`)
- Greenhouse veggies visible at top of screen
- Tap to select, tap a row to place
- Reset and re-pick allowed
- Up to 3 placements
- Confirm advances to Harvest
- If fewer than 3 placed at confirm time, trigger underfull feedback overlay

**Underfull feedback copy**: *"What values would fill your fork?"* (yes/no + 30 char text mechanics)

### Harvest

- FarmRow with `cropsPerRow={[6,6,6]}` (or `[6,6,0]` etc. if user only chose 1 or 2)
- Each chosen veggie animates outward from its planting position, multiplying across the row in stagger
- Final copy:

> Amazing, here's what you have selected as your core values. We hope you can find ways of realizing them today.

The chosen values are listed below the visual.

### Interactions

**Tap-to-confirm** throughout (no drag-and-drop). First tap selects (visual highlight), second tap places at destination. Reliable on mobile, accessible.

**Pull animation** (Round 1): Framer Motion or rAF, never CSS keyframes (Safari compatibility, consistent with platform pattern).

**Harvest multiplication**: Framer Motion stagger, originating veggie spawns duplicates outward across its row.

### Scoring / points

- 10 points for completing harvest
- 5 points for ending early at zero-plant feedback (showed up, deserves recognition)

### Supabase schema

#### `farm_joy_trials` (one row per value shown)

```sql
CREATE TABLE farm_joy_trials (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id      uuid REFERENCES game_sessions(id),
  user_id         uuid REFERENCES profiles(id),
  trial_number    int,             -- 1 to 24
  value_word      text,
  category        text,
  veggie          text,            -- sprite assigned this session
  round1_choice   text,            -- 'plant' | 'compost'
  round1_rt_ms    int,             -- mound tap to bin tap
  in_greenhouse   boolean,         -- chose for Round 2?
  in_final        boolean,         -- chose for Round 3 final?
  created_at      timestamptz DEFAULT now()
);
```

#### `farm_joy_performance` (one row per session)

```sql
CREATE TABLE farm_joy_performance (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id          uuid REFERENCES game_sessions(id),
  user_id             uuid REFERENCES profiles(id),
  values_sampled      jsonb,         -- 24 word array
  values_planted      jsonb,         -- yum list
  values_greenhouse   jsonb,         -- up to 6
  values_final        jsonb,         -- up to 3
  ended_early         boolean,       -- zero plants
  round1_duration_ms  int,
  round2_duration_ms  int,           -- null if ended early
  round3_duration_ms  int,           -- null if ended early
  created_at          timestamptz DEFAULT now()
);
```

#### `farm_joy_feedback` (one row per feedback event)

```sql
CREATE TABLE farm_joy_feedback (
  id                 uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id         uuid REFERENCES game_sessions(id),
  user_id            uuid REFERENCES profiles(id),
  round_triggered    int,             -- 1, 2, or 3
  user_responded     boolean,         -- yes / no to the prompt
  suggested_value    text,            -- max 30 chars
  values_sampled     jsonb,           -- the 24 they saw, for taxonomy gap analysis
  created_at         timestamptz DEFAULT now()
);
```

#### `farm_joy_value_history` (cumulative, one row per user × value)

```sql
CREATE TABLE farm_joy_value_history (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          uuid REFERENCES profiles(id),
  value_word       text,
  times_shown      int DEFAULT 0,
  times_planted    int DEFAULT 0,
  times_greenhouse int DEFAULT 0,
  times_final      int DEFAULT 0,
  updated_at       timestamptz DEFAULT now(),
  UNIQUE (user_id, value_word)
);
```

Upserted at session end with simple counter increments. Max 38 rows per user. Probabilities computed client-side: `P(plant|shown)`, `P(greenhouse|planted)`, `P(final|greenhouse)`, overall `P(final|shown)`. Future use: stable values panel on profile, smart sampling biased toward under-tested values, longitudinal trends.

#### Profile additions

```sql
ALTER TABLE profiles
  ADD COLUMN farm_joy_sessions int DEFAULT 0,
  ADD COLUMN farm_joy_last_core_values jsonb;
```

RLS on all four tables: users can insert and read only their own rows.

### Background components (already built)

`FarmField.jsx`, `Greenhouse.jsx`, and `FarmRow.jsx` are pure presentation components built ahead of architecture. Each uses viewBox 680×1020 (mobile-first portrait), shares the same color palette, and renders a static SVG with depth-illusion ridge/furrow shading. All three accept tap callbacks; they emit `{row, col}` events. They take no game state, just visual config.

**FarmField props**: `pulledMounds` (Set of `"row-col"` strings), `onMoundClick(row, col)`, `seed` (optional, deterministic stalk distribution), `className`. Stalk variants randomized per mount via mulberry32 PRNG. 5 stalk variants distributed across 24 mounds.

**Greenhouse props**: `onPotClick(row, col)`, `className`. Fixed 2×3 layout. Pot fill state lives in parent.

**FarmRow props**: `cropsPerRow` (array of 3 numbers), `onMoundClick(row, col)`, `className`. Mound x positions auto-distribute based on count via `moundXPositions()` helper. Same component handles planting state (`[1,1,1]`) and harvest (`[6,6,6]`).

Source files generated in claude.ai design conversation 2026-05-08, ready to drop into `src/games/FarmJoy/components/`.

### Game card copy

**Name**: Farm Joy
**Tagline**: "Plant the values that grow joy."
**Description**: A short visit to your value garden. Sort, narrow down, and harvest the values that matter most. Each visit deepens your sense of what you want to cultivate.
**Illustration concept**: Soil grid with green stalks, one mound mid-pull revealing a value card

### Status

Specced. Three background components built (FarmField, Greenhouse, FarmRow) and saved as React components. Main game FSM, value taxonomy data files, Supabase schema, and remaining components pending Claude Code handoff.

---

## 20. Breath Belt: Respiratory Interoception Thresholds

### Purpose

Breath Belt is a lab-only psychophysics study measuring how well participants can detect changes in their own breathing pace. It uses a Polar H10 chest belt (via Web Bluetooth) to record respiratory acceleration data, and a COM port trigger box to send synchronisation signals to the physio equipment. The study runs in Chrome/Edge only (Web Bluetooth requirement).

Access is gated internally by the component: only users with `profiles.role` of `'lab'` or `'admin'` can proceed past the browser check. All other users see an "Access restricted" screen.

Route: `/games/breath-belt`

### Phase flow

```
BROWSER_CHECK → BT_CONNECT → COM_CONNECT
→ SESSION_SETUP   (researcher enters session number)
→ CALIB_READY → CALIBRATING   (CalibrationScreen manages sub-states)
→ BASELINE_READY → BASELINE_RECORDING → BASELINE_COMPLETE   (120 s, COM triggers)
→ PHASE2_READY → PHASE2_RUNNING   (9 fixed trials)
→ PHASE2_COMPLETE → PHASE3_INTRO → PHASE3_RUNNING   (dual-QUEST until converged)
→ POST_BASELINE_READY → POST_BASELINE_RECORDING → POST_BASELINE_COMPLETE   (120 s, COM triggers)
→ SESSION_COMPLETE
```

### Hardware

- **Polar H10**: Bluetooth LE chest belt. Streams raw accelerometer (ACC) and heart rate (HR) data. ACC signal is used as a proxy for respiratory effort. Connected via Web Bluetooth in `useBeltConnection.js`.
- **COM trigger box**: Serial port connected via Web Serial API. Sends 1-byte codes to the physio recording system at trial start/end and at baseline start/end. Connected separately after BT.

### COM trigger vocabulary (codes 0–12)

All codes fit in a single byte (within the 2^32 constraint). Codes 1–9 are fired from `BreathBelt.jsx` at FSM transitions; codes 10–12 are fired from `useTrialRunner.js` within each trial.

| Code | Event | Fired from |
|------|-------|------------|
| 0 | Session end | `BreathBelt.jsx` — after `endSession()` resolves in post-baseline `onComplete` |
| 1 | Session start | `BreathBelt.jsx` — pre-baseline `onStart`, just before code 2 |
| 2 | Pre-baseline start | `BaselineScreen` — via `triggerStart='2'` prop on recording start |
| 3 | Pre-baseline end | `BaselineScreen` — via `triggerEnd='3'` prop on recording end |
| 4 | Phase 2 start | `BreathBelt.jsx` — `useEffect` watching `phase === PHASE2_RUNNING` |
| 5 | Phase 2 end | `BreathBelt.jsx` — `FixedTrialsScreen` `onComplete` handler |
| 6 | Phase 3 start | `BreathBelt.jsx` — `useEffect` watching `phase === PHASE3_RUNNING` |
| 7 | Phase 3 end | `BreathBelt.jsx` — `StaircaseScreen` `onComplete` handler |
| 8 | Post-baseline start | `BaselineScreen` — via `triggerStart='8'` prop on recording start |
| 9 | Post-baseline end | `BaselineScreen` — via `triggerEnd='9'` prop on recording end |
| 10 | Trial start | `useTrialRunner.js` — baseline breaths begin |
| 11 | Condition onset | `useTrialRunner.js` — breath 3 begins (baseline→condition boundary) |
| 12 | Trial end | `useTrialRunner.js` — after condition breaths complete |

Codes 10/11/12 are reused across Phase 2 and Phase 3. The preceding phase code (4 or 6) establishes context in the lab belt signal.

### Session setup (SESSION_SETUP)

After COM connects, the researcher enters a session number (1-indexed, incremented per lab visit by the same participant) before calibration begins. Stored in `belt_sessions.session_number`.

### Calibration

CalibrationScreen drives a 4-state flow (FIXATION → BREATHE → FITTING → REVIEW) using the MLR signal processing pipeline from `breathUtils.fitBestModel()`.

The pipeline evaluates 6 model variants (MLR × {wide-band, tight-band} × {plain, LP-smoothed} + PCA × {wide, tight}) and selects the one with the highest Pearson R against the cosine pacer reference. Requires ≥100 samples and fitR ≥ 0.4 to proceed; transitions to FAILED otherwise.

`useBeltConnection` now exposes:
- `mlrWeightsRef` — `{ bias, weights: [wx,wy,wz], modelLabel, lagMs, fitR }` after calibration (replaces `calibStateRef`)
- `filterState3Ref` — causal biquad state for live `processPacketMLR()` during trials
- `syncQuality` — rolling Pearson R (React state) between live belt predictions and current pacer, used by `SynchronyBar`
- `calibReviewData` — `{ pacerPts, beltPts, fitR, peakErrorMs, modelLabel, lagMs }` shown in `CalibReviewPanel`
- `beginCalibCollection(calibStartMs, breathPeriodMs)` — called by CalibrationScreen exactly when avatar animation begins (timestamp precision matters for model fitting)
- `redoCalibration()` — resets to FIXATION from REVIEW (renamed from `redoPhase2`)
- `getPacerRadiusFnRef` — fn ref set by trial screens before code 10; read by accel handler to log pacer radius per raw accel row

`BeltSyncRing` is retained for other games (Still Water etc.) where aesthetic warmth matters more than precise quantitative feedback. `SynchronyBar` (fixed bottom bar, rolling Pearson R with colour thresholds) is used during paced trials in BreathBelt.

`useStreamingBackup` provides parallel local CSV backup via the File System Access API (`showDirectoryPicker`). Non-Chrome or permission-denied sessions degrade gracefully (returns false). Files: `{participantId}_{ts}_{accel,hr,trials,quest}.csv`. `initBackup(participantId)` opens the directory picker during SESSION_SETUP; `flushAccel/flushHR` are called after each trial alongside Supabase writes; `appendTrial/appendQuest` are available for per-row backup.

Calibration metrics (`calib_model_label`, `calib_fit_r`, `calib_lag_ms`) are stored to `belt_sessions` (added by `belt_mlr_migration.sql`). The full weight vector is stored as `calib_state` JSON (existing column).

### Baselines — pre and post (120 s each)

Both baselines use the same `BaselineScreen` component with a generic `phase` prop (`'READY'`|`'RECORDING'`|`'COMPLETE'`). Parent FSM maps its states to this generic prop via `baselinePhaseMap()`.

- **Pre-session baseline** (`BASELINE_*`): 120 s free breathing before Phase 2. Code 1 (session start) fires in `onStart` just before recording; codes 2/3 fire at recording start/end via `BaselineScreen`. `breathUtils.estimateBreathPeriodMs()` runs on the collected samples; result stored in `belt_sessions.baseline_period_ms`.
- **Post-session baseline** (`POST_BASELINE_*`): 120 s free breathing after Phase 3. Codes 8/9 fire at recording start/end via `BaselineScreen`; code 0 (session end) fires after `endSession()` resolves. Result stored in `belt_sessions.post_baseline_period_ms`. `endSession()` is called here — all trial and session data flushed to Supabase on post-baseline completion.

Both baselines are 120 s (was 60 s) for matched pre/post comparison in the correspondence study.

### Phase 2 — Fixed trials

9 trials at pre-specified breath period deviations (faster/slower/same relative to baseline). AvatarBreathPacer (from EbbAndFlow) paces the avatar. The participant follows. No response is collected — these are familiarisation trials. Trial data is recorded to Supabase.

### Phase 3 — Dual-QUEST staircase

Interleaved faster/slower staircases using the QUEST+ algorithm. Each trial:
1. QUEST selects the next magnitude (log10 seconds deviation from baseline).
2. Avatar paces at that period. Participant follows.
3. 3AFC response: slower / same / faster.
4. Confidence rating (1–7, ConfidenceRating component).
5. Arousal rating (1–7, ArousalRating component).

Both staircases converge independently. Session ends when both converge. Quest state is stashed in `questStateRef` (a `useRef`) when Phase 3 completes, then written to Supabase inside the post-baseline `onComplete` handler. Convergence thresholds and SDs are displayed on the SessionComplete screen.

### Belt period estimates — correspondence study

`breathUtils.js` exports `estimateBreathPeriodMs(signal)`: accepts `{ t, value }[]` (wall-clock ms + 0–1 belt value). Uses 5-point peak detection with a 0.40 threshold and median inter-peak interval. Returns null if < 2 valid peaks detected.

`useTrialRunner` samples `breathValueRef` in two separate windows per trial as `{ t: Date.now(), value }`:
- **baseline window** (breaths 1–2 at BASE speed): `btBaselinePeriodMs`
- **condition window** (breaths 3–4 at condition speed): `btConditionPeriodMs`

Both are stored on `belt_trials` rows. Null is valid — do not drop the trial. `useTrialRunner` also sets `getPacerRadiusFnRef.current` at trial start (cleared to `() => NaN` at trial end), enabling per-sample pacer radius logging in the raw accel rows.

### Data

Supabase schema in `belt_schema.sql` (initial) + `belt_correspondence_migration.sql` (run second). Tables:

| Table | Contents |
|---|---|
| `belt_sessions` | One row per session: user_id, calib_state JSON, quest_state JSON, **session_number**, **baseline_period_ms**, **post_baseline_period_ms**, ***calib_model_label***, ***calib_fit_r***, ***calib_lag_ms*** |
| `belt_trials` | One row per trial: phase, trial_number, condition, breath_period_ms, log10_mag, response, correct, confidence, arousal, belt_sync_mean, **bt_baseline_period_ms**, **bt_condition_period_ms** |
| `belt_accel_raw` | Raw accelerometer rows (timestamps + xyz + pacer_radius) — stored in Supabase Storage as CSV |
| `belt_hr_raw` | Raw HR rows — stored in Supabase Storage as CSV |

**Bold** = added by `belt_correspondence_migration.sql`. ***Bold italic*** = added by `belt_mlr_migration.sql`.

### Source layout

```
src/games/BreathBelt/
  BreathBelt.jsx             ← main FSM; SynchronyBar shown during paced trials; backup.initBackup at SESSION_SETUP
  constants.js               ← BASE_BREATH_SPEED_S, BASELINE_DURATION_MS (120 s), POST_BASELINE_DURATION_MS (120 s), QUEST params
  breathUtils.js             ← full MLR pipeline: fitBestModel (6 variants), processPacketMLR, initFilterState3,
                               rollingPearsonR, estimateBreathPeriodMs, buildReviewEntry,
                               getPacerRadius, getPacerRadiusForTrial, meanOf
  belt_schema.sql            ← initial Supabase migration
  hooks/
    useBeltConnection.js     ← Web Bluetooth + Web Serial, MLR calibration pipeline;
                               exposes mlrWeightsRef, filterState3Ref, syncQuality, calibReviewData,
                               beginCalibCollection, redoCalibration, getPacerRadiusFnRef
    useBeltSession.js        ← Supabase session lifecycle; endSession accepts calib_model_label, calib_fit_r, calib_lag_ms
    useBeltQuestStaircases.js ← dual-QUEST state machine
    useTrialRunner.js        ← per-trial avatar pacing; sets getPacerRadiusFnRef for pacer radius logging; { t, value }[] samples
    useStreamingBackup.js    ← parallel local CSV backup via File System Access API (showDirectoryPicker)
  components/
    BrowserWarning.jsx       ← Chrome/Edge prompt
    CalibrationScreen.jsx    ← MLR 4-state calibration: FIXATION → BREATHE → FITTING → REVIEW
    CalibReviewPanel.jsx     ← calibration quality metrics + SignalGraph overlay (fit%, lag, peak timing, model)
    SignalGraph.jsx          ← SVG line chart: pacer (blue) vs belt model (amber)
    SynchronyBar.jsx         ← fixed bottom sync quality bar during paced trials (rolling Pearson R)
    BaselineScreen.jsx       ← reusable for pre and post baselines; props: phase ('READY'|'RECORDING'|'COMPLETE'), title, durationMs, phaseLabel, triggerStart, triggerEnd, onComplete(periodMs)
    FixedTrialsScreen.jsx    ← Phase 2: 9 fixed trials; records bt_baseline_period_ms + bt_condition_period_ms per trial
    StaircaseScreen.jsx      ← Phase 3: QUEST trials + 3AFC + ratings; records bt_* period columns
    BeltSyncRing.jsx         ← real-time belt signal ring — retained for other games (Still Water etc.)
    SessionComplete.jsx      ← shows session number, pre/post resting period, QUEST thresholds
```

### Convergence data flow

`quest.getConvergence()` is called in `StaircaseScreen` when both staircases converge and passed as the third argument to `onComplete(trials, questState, convergence)`. `BreathBelt.jsx` stores convergence in `convergenceRef.current` and quest state in `pendingQuestStateRef.current` (both `useRef`). `endSession()` is called inside the post-baseline `onComplete` callback, consuming `pendingQuestStateRef.current`.

### Schema migration

Run these migrations manually in the Supabase SQL editor in order:

1. `belt_schema.sql` — initial schema
2. `belt_correspondence_migration.sql` — adds `bt_baseline_period_ms`, `bt_condition_period_ms` to `belt_trials`; `session_number`, `baseline_period_ms`, `post_baseline_period_ms` to `belt_sessions`
3. `belt_mlr_migration.sql` — adds `calib_model_label`, `calib_fit_r`, `calib_lag_ms` to `belt_sessions`

All migrations use `ADD COLUMN IF NOT EXISTS` — safe to run on existing data.

### Status

Integrated. All source files updated at `src/games/BreathBelt/`. Route registered at `/games/breath-belt`. Run migrations in order: `belt_schema.sql`, `belt_correspondence_migration.sql`, `belt_mlr_migration.sql` — all require manual execution in the Supabase SQL editor before running in the lab. Requires Chrome or Edge with Web Bluetooth enabled.

---

## 21. Questionnaire System

### Overview

A global questionnaire library accessible at `/admin/questionnaires`. Lab members upload JSON definitions, preview them interactively, and lock them to prevent accidental edits. The same `QuestionnaireRenderer` component is used for both admin preview and live study delivery.

### Routes

All three routes are inside the `AdminRoute` / `AdminLayout` guard — `profiles.role === 'lab'` required.

| Route | Component | Purpose |
|---|---|---|
| `/admin/questionnaires` | `QuestionnairesPage` | Library list — all uploaded questionnaires |
| `/admin/questionnaires/new` | `QuestionnaireUpload` | Paste or file-upload a JSON definition |
| `/admin/questionnaires/:slug` | `QuestionnairePreview` | Full renderer preview + lock/edit controls |

### File structure

```
src/
  components/
    questionnaire/
      QuestionnaireRenderer.jsx   ← full player; used for preview and study delivery
      questionnaireUtils.js       ← buildSlides(), effectiveLabels(), validateDefinition()
      InstructionScreen.jsx       ← mandatory "Begin" screen before first item
      LikertItem.jsx              ← single Likert item + image label support
      ProgressLabel.jsx           ← sticky "Part N of M · Item X of Y" header
      ScaleChangeScreen.jsx       ← auto-inserted slide when scale changes between items
  pages/
    admin/
      QuestionnairesPage.jsx      ← library list
      QuestionnaireUpload.jsx     ← JSON upload + validation
      QuestionnairePreview.jsx    ← preview + lock/unlock + JSON editor overlay
questionnaires_schema.sql         ← Supabase migration (run manually in SQL editor)
```

### JSON schema

```json
{
  "slug": "panas",
  "name": "PANAS",
  "auto_advance": true,
  "instructions": "Rate each word to the extent you feel this way right now.",
  "scale_labels": [
    { "value": 1, "label": "Very slightly or not at all", "image": null },
    { "value": 5, "label": "Extremely", "image": null }
  ],
  "items": [
    {
      "id": "panas_1",
      "text": "Interested",
      "type": "likert",
      "scale_min": 1,
      "scale_max": 5,
      "subscale": "positive",
      "reverse_score": false,
      "required": true,
      "scale_labels_override": null
    }
  ],
  "scoring": {
    "subscales": {
      "positive": { "items": ["panas_1"], "method": "sum" }
    }
  }
}
```

**Key fields:**
- `slug` — unique identifier; used as the URL slug and the key in `questionnaire_responses`
- `name` — display name shown to participants
- `auto_advance` — `true` (default): advances immediately on selection; `false`: shows a Next button
- `instructions` — shown on the mandatory instruction screen before item 1
- `scale_labels` — questionnaire-level default scale labels; each entry: `{ value, label, image }`
- `items` — ordered array of Likert items
- `scale_labels_override` per item — overrides the questionnaire-level labels for that item only; enables mixed-scale questionnaires
- `scoring` — optional; subscale definitions with item lists and aggregation method

### Image labels

Set `"image"` on a scale label entry to a path relative to `/public/`, e.g. `"scale_images/vas_face_1.png"`. The `LikertItem` component renders the image at 36×36px beside the text label. If the file is not found, it falls back to a `?` placeholder — no hard failure.

### Auto-generated scale-change slides

`buildSlides()` in `questionnaireUtils.js` inserts a `ScaleChangeScreen` slide automatically whenever consecutive items have different effective labels (comparing by JSON string equality). This handles mixed-scale questionnaires (e.g., DERS items switching between 5-point frequency and 7-point agreement scales) without any explicit marking in the JSON.

### QuestionnaireRenderer

The player component. Builds a flat slide sequence (instruction → [scale_change →] item → …), manages fade transitions, back navigation (scale_change slides are skipped when going back), and response collection.

**Props:**
- `questionnaire` — full JSON definition
- `partNumber` / `totalParts` — for the sticky progress label (e.g. "Part 2 of 3")
- `onComplete(responses)` — called with `{ [itemId]: value }` map when all items answered
- `onBack` — optional; called if participant presses Back on the instruction screen
- `previewMode` — shows "Preview complete — N items answered." instead of calling `onComplete`

### locked flag

`locked: true` prevents the "Edit JSON" button from appearing in `QuestionnairePreview`. The lock toggle always works (a lab member can lock or unlock at any time). Locking does **not** block saves — it is a UI safety guard only, not a database constraint.

### Supabase table — `questionnaires`

Schema in `questionnaires_schema.sql` (project root — run manually in Supabase SQL editor).

RLS policies:
- Lab members (`profiles.role = 'lab'`): full read/write/delete
- All authenticated users: read-only (for study delivery)

### Status

Integrated. All source files placed. Routes registered inside the existing `AdminRoute`/`AdminLayout` guard. SQL schema at project root for manual migration.
