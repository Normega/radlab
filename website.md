# RADlab Platform — Design & Architecture Decisions

> **Regulatory and Affective Dynamics Lab**  
> University of Toronto · PI: Professor Norman Farb, PhD  
> Last updated: 2026-07-06 (ISARP keynote: `/keynote` 23-slide click-through deck with Minimal/Reading toggle + speaker notes, BCAT figures wired + neuro-figure drop-in slots, links out to the two live demos — see §20 Keynote deck. Prior same-day: keynote opener `/demo/pacer-opener` and BreathBelt conference demo `/demo/breath-belt`. Prior update: 2026-07-05 (display elements §24a: block-based `displays` table, condition-gated blocks, `{{variable}}` interpolation from session step outputs, admin editor + Elements nav regroup. Same day: assignment randomizer implemented and pilot-verified: shared `draw_assignment` primitive, `assignment_slots` + StudyFormPage condition card, `useAssignment` hooks, SessionEntry draw gating, `seededRandom.js` utility — see §28 Shared assignment primitive. Prior update: 2026-07-02 (restructured into Parts I–IV: renumbered sections, restored lost §11/§16 headers, rewrote roadmap as §30, added §22 game stubs, §24 VAS stub; §28 Experiment Builder merged verbatim from commit 7a030c3 (renumbered from 26). Prior update: 2026-05-29 (BreathBelt §20: Biopac parallel-port triggers implemented — Biopac_Left/Biopac_Right now relay through a local parallel_server.py helper; trigger-device selector moved onto the connect screen; connectBiopac() + sendTestCascade() added; a 1–13 test cascade auto-fires on connect with an RA verify step. Earlier 2026-05-26 update: MLR calibration pipeline replacing percentile approach; fitBestModel — 6 model variants, best by Pearson R; useBeltConnection exposes mlrWeightsRef, filterState3Ref, syncQuality, calibReviewData, beginCalibCollection, redoCalibration, getPacerRadiusFnRef; BeltSyncRing retained for other games; SynchronyBar shown during trials; useStreamingBackup adds parallel File System Access API CSV backup; belt_mlr_migration.sql adds calib_model_label, calib_fit_r, calib_lag_ms to belt_sessions.))

---


---

# Part I — Platform Core

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
        belt_mlr_migration.sql
        belt_sync_metrics_migration.sql
        hooks/
          useBeltConnection.js
          useBeltSession.js
          useBeltQuestStaircases.js
          useTrialRunner.js
          useStreamingBackup.js
        components/
          BrowserWarning.jsx
          CalibrationScreen.jsx
          CalibReviewPanel.jsx
          SignalGraph.jsx
          SynchronyBar.jsx
          TrialSyncOverlay.jsx
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
| `metrics` | jsonb | Flexible per-game metrics (see §15 for Ebb & Flow fields) |

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

## 10. Responsive Design

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

## 11. Deployment

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


---

## 12. Hub & Lab Pages

> Header restored 2026-07-02; this block previously sat inside §18 without a section header.


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


---

## 13. Avatar System

> Header restored 2026-07-02; content was present but the `## 11` header line had been lost.

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


---

# Part II — Games

## 14. Pond Watch

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

## 15. Ebb & Flow

**Files**: `src/games/EbbAndFlow/` (see §4 for full structure)  
**Paradigm**: Interoceptive breath change detection — 4-breath adaptive staircase  
**Route**: `/games/ebb-flow`  
**Dependency**: `npm install jsquestplus` (MIT, Kuroki & Pronk 2022)

**Narrative / framing**: The participant's own avatar serves as the breath pacer. The participant breathes along with their avatar using the PSI-AMP attunement button (hold = inhale, release = exhale). On each trial the avatar's pace may subtly shift. The participant's job is to notice — to detect impermanence in the breath rhythm. The game is named after the cyclical, bidirectional nature of breath and change: things ebb and flow.

The term **PSI-AMP** (psionic amplifier) appears on the instruction screen as a narrative device — a tool for attuning your breath to your avatar's signal. The button face itself simply reads "inhale" when held.

**Scientific basis**: Orthogonal manipulation of change *magnitude* (how much the breathing pace shifts) and *salience* (how abruptly vs. gradually the shift is delivered). Enables independent measurement of interoceptive sensitivity, conscious detection, metacognitive accuracy, and subjective arousal. Based on Study 1 data (N=103, 3,192 trials) — see `fourbreathtask.md` for full empirical priors.

**Trial structure**:
- Warm-up: replaced by First Contact onboarding (see §16). Ebb & Flow uses a shortened 4-breath warm-up for returning players who have completed First Contact
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

## 16. First Contact / Deeper Contact

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

**Conference demo (2026-07)**: `src/games/BreathBelt/BreathBeltDemo.jsx` at `/demo/breath-belt` — unauthenticated, writes nothing (no Supabase, no CSV, no-op triggers, no COM/Biopac step). Flow: pairing → real MLR calibration with review panel → 3 paced trials with post-trial SignalGraph + sync chips → 2 hardcoded change-detection trials (speed up 4s→3s, then slow down 4s→5s) with 3AFC + confidence + arousal ratings and a reveal graph → summary. `?sim=1` rehearses without a belt (graphs show placeholders — sim produces no raw accel). Reuses `useBeltConnection`, `useTrialRunner`, `CalibrationScreen`, `SignalGraph`, shared rating scales.

**Keynote opener (2026-07)**: `src/games/BreathBelt/PacerOpenerDemo.jsx` at `/demo/pacer-opener` — the whole-room *opening* exercise (distinct from the instrumented closing demo above). No device, no Bluetooth, no data. A full-screen breathing circle (driven by the same `useBreathCycle` timing engine as the strap demo, so the two visually rhyme) runs one fixed BCAT trial: 2 baseline breaths at **5s (12 bpm — confirmed with Norm for a cold room, vs the paper's 15 bpm)** then 2 accelerated breaths at 3.5s (~30% faster, change onset breath 3). Then presenter-advanced polling screens (Did the pace change? / How confident? / Arousal?) polled by show of hands — no audience input captured — and a reveal ("the pace accelerated from breath 3"). Presenter controls: Begin · Advance · Reset, on-screen buttons **and** keyboard (Space/Enter/→/PageDown advance, R resets) for presentation clickers. Runs fully client-side once loaded; pre-load the page before going offline.

**Keynote deck (2026-07)**: `src/pages/keynote/Keynote.jsx` (+ `graphics.jsx`) at `/keynote` — 23-slide click-through single-page deck replacing PowerPoint, doubling as a permanent read-later resource. Click anywhere (or ←/→/Space) advances; no clicker dependency. **Minimal ↔ Reading density toggle** (top-right, persisted in localStorage) — Minimal for stage, Reading folds the spoken supporting text into each slide for standalone reading; built both ways so Norm can compare. Speaker-notes overlay (button or "N") holds figure sources + spoken-only content, off by default. The two live demos are **not embedded** — slides 4 (`/demo/pacer-opener`) and 22 (`/demo/breath-belt`) link out in a new tab; presenter returns and clicks on. Crests: `RADlab_Logo_light.svg` + `UofT_Logo.svg` (already in repo/in use — licensing settled). Figures: BCAT behavioral figures live in `public/keynote/` (`fig-staircase`, `fig-detection-curve`, `fig-arousal-gating` wired to slides 8/11/12; regime/mediation/confidence figures also copied for later use); neuroimaging figures **now wired** (extracted from `resources/ISRP20206figs/neuroslides.pptx`): `fig-eneuro-3` (whole-brain deactivation + MAIA scatter) slide 15, `fig-eneuro-4` (ACC sparing + DAN maps) slides 16–17, `fig-ejn-classifier` slide 19, `fig-brainsci-training` (converted from embedded TIFF via System.Drawing) slide 19. The Figure component still falls back to a captioned dashed placeholder if any file is missing. MAIA-J items table (pptx slide 1) intentionally not used — supplementary reference, not a result. Original SVG graphics built fresh in `graphics.jsx`: position icons (6), salience×magnitude schematic (9), hit/miss belt traces (13), two illustrative MAIA scatterplots rendered from reported correlations r=.260 / r=.071 (14), neural pathway flow (18), pacer-attention illustration (21). Figures preloaded on mount so click-through never stalls on stage.

Access is gated internally by the component: only users with `profiles.role` of `'lab'` or `'admin'` can proceed past the browser check. All other users see an "Access restricted" screen.

Route: `/games/breath-belt`

### Phase flow

```
BROWSER_CHECK → BT_CONNECT → COM_CONNECT
→ SESSION_SETUP   (researcher enters session number)
→ CALIB_READY → CALIBRATING   (CalibrationScreen manages sub-states)
→ BASELINE_READY → BASELINE_RECORDING → BASELINE_COMPLETE   (120 s, COM triggers)
→ PHASE2_READY → PHASE2_RUNNING   (9 fixed trials)
→ PHASE2_REVIEW → PHASE3_INTRO → PHASE3_RUNNING   (dual-QUEST until converged)
→ POST_BASELINE_READY → POST_BASELINE_RECORDING → POST_BASELINE_COMPLETE   (120 s, COM triggers)
→ SESSION_COMPLETE
```

### Hardware

- **Polar H10**: Bluetooth LE chest belt. Streams raw accelerometer (ACC) and heart rate (HR) data. ACC signal is used as a proxy for respiratory effort. Connected via Web Bluetooth in `useBeltConnection.js`.
- **Trigger device**: sends 1-byte event codes to the physio recording system at trial start/end and at baseline start/end. Connected separately after BT. Two transports are supported (chosen per session — see *Trigger devices & transports* below): the **AD_BBT** rig uses a Web Serial COM box; the **Biopac** rigs use a parallel-port card driven through a local helper server.

### Trigger vocabulary (codes 1–13)

All codes fit in a single byte. Codes 1–9 are fired from `BreathBelt.jsx` at FSM transitions; codes 10–12 are fired from `useTrialRunner.js` within each trial; code 13 is session end.

| Code | Event | Fired from |
|------|-------|------------|
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
| 13 | Session end | `BreathBelt.jsx` — after `endSession()` resolves in post-baseline `onComplete`, and on mid-session unmount |

Codes 10/11/12 are reused across Phase 2 and Phase 3. The preceding phase code (4 or 6) establishes context in the lab belt signal.

**Code 0 is the line-clear, not an event marker.** Every trigger pulses its value high for ~25 ms then writes 0 to clear the lines (on AD_BBT, `"00"` is the Black Box ToolKit clear command, so session end uses 13 to stay a distinct marker). The same 1→13 sequence is replayed as a connection test on connect (see below).

### Trigger devices & transports

Each testing rig uses different physio equipment, so the RA picks a **trigger device** on the connect screen (`COM_CONNECT`) — *before* connecting, since the device determines the transport. `TRIGGER_DEVICES` (in `constants.js`); default `AD_BBT`. The choice is persisted to `belt_sessions.trigger_device`.

| Device | Transport | Encoding |
|---|---|---|
| `AD_BBT` (default) | Web Serial COM box (Black Box ToolKit USB TTL Module) | 2-char uppercase hex per code, `"RR"` init on connect, `"00"` clear |
| `Biopac_Right` | Parallel-port card via local helper, port `0xD030` | code sent as-is (`shift: 1`) |
| `Biopac_Left` | Parallel-port card via local helper, port `0xDFF8` | code on the high nibble (`shift: 16`, i.e. `code × 16`) |

`sendTrigger(code)` branches on the selected device: AD_BBT writes hex over the serial writer; a Biopac device computes `code × shift` (clamped 0–255) and relays it to the parallel-port server. Both pulse the value high for 25 ms then write 0 to clear. A failed Biopac relay is logged (`console.error` with address + value) but never thrown — a missed trigger must not crash the session.

**Biopac parallel-port server** (`scripts/parallel_server.py`): the browser cannot drive a parallel port, so Biopac triggers go through a small local Flask helper (Windows-only; uses `inpoutx64.dll`/`inpout32.dll`). `constants.js` `BIOPAC_SERVER_URL = 'http://localhost:8765'`. Endpoints:
- `POST /send` — body `{ address, value }`; writes `value` to the parallel `address` via `Out32`. (Also accepts an optional `zero_delay` ms to self-clear; the browser instead sends an explicit `value: 0` after 25 ms.)
- `GET /status` — `{ ok: true, dll: <bool>, dll_name }`. `connectBiopac()` pings this and reports connected only when `ok && dll`; otherwise it surfaces a distinct message (DLL not loaded / not ready / offline) in the same `comState` status indicator used for the COM box.

**Connect flow** (`COM_CONNECT`): for AD_BBT the button reads *Connect to COM port* → `connectCOM()` (Web Serial port picker); for Biopac it reads *Check parallel server* → `connectBiopac()` (no port picker / writer / reader — just the status ping). On a successful connect the screen does **not** auto-advance: it auto-fires the 1–13 test cascade once (`sendTestCascade()`, ~250 ms between marks) so the RA can confirm all 13 marks land in the recording, then offers *Send test cascade again* and *Continue to session setup*. The cascade uses `sendTrigger`, so per-device encoding is automatic.

> **Mixed-content caveat:** the deployed app is https but the parallel server is `http://localhost:8765`. Opening BreathBelt from the production https URL makes the browser block the localhost call (server reads as "offline"). Run the Biopac rigs from the local dev server (`http://localhost:5173`) so the scheme matches. AD_BBT (Web Serial) is unaffected.

### Session setup (SESSION_SETUP)

After connecting (and the trigger-test cascade), the researcher enters a session number (1-indexed, incremented per lab visit by the same participant) before calibration begins. Stored in `belt_sessions.session_number`. The trigger device chosen on the connect screen is shown here read-only.

### Calibration

CalibrationScreen drives a 4-state flow (FIXATION → BREATHE → FITTING → REVIEW) using the MLR signal processing pipeline from `breathUtils.fitBestModel()`. The avatar IS the pacer — no `BeltSyncRing` is shown during calibration. `beginCalibCollection(calibStartMs, breathPeriodMs)` is invoked at the exact tick the avatar animation begins, so the pacer reference timestamps align with belt samples to within a frame.

The pipeline evaluates 6 model variants (MLR × {wide-band, tight-band} × {plain, LP-smoothed} + PCA × {wide, tight}) and selects the one with the highest Pearson R against the cosine pacer reference. Requires ≥100 samples and fitR ≥ 0.4 to proceed; transitions to FAILED otherwise.

`useBeltConnection` exposes:
- `mlrWeightsRef` — `{ bias, weights: [wx,wy,wz], modelLabel, lagMs, fitR }` after calibration (replaces `calibStateRef`)
- `filterState3Ref` — causal biquad state for live `processPacketMLR()` during trials
- `syncQuality` — rolling Pearson R (React state) between live belt predictions and current pacer, used by `SynchronyBar`
- `calibReviewData` — `{ pacerPts, beltPts, fitR, peakErrorMs, modelLabel, lagMs }` shown in `CalibReviewPanel`
- `beginCalibCollection(calibStartMs, breathPeriodMs)` — called by CalibrationScreen exactly when avatar animation begins (timestamp precision matters for model fitting)
- `redoCalibration()` — resets to FIXATION from REVIEW (renamed from `redoPhase2`)
- `getAndClearTrialSamples()` — returns the raw `{t,x,y,z}` collected during the most recent trial and clears the buffer. Called by `useTrialRunner` after code 12 to compute offline per-trial sync metrics.
- `getPacerRadiusFnRef` — fn ref set by trial screens before code 10; read by accel handler to log pacer radius per raw accel row

`BeltSyncRing` is retained for other games (Still Water etc.) where aesthetic warmth matters more than precise quantitative feedback. **No live synchrony feedback is rendered to the participant during paced breathing trials.** `SynchronyBar` (a rolling Pearson R bar) exists in the component tree but is no longer mounted by BreathBelt — research protocol calls for between-trial feedback only via `TrialSyncOverlay`. The underlying `syncQuality` / `rollingPearsonR` pipeline still runs internally (the `setPacerContext` swap at code 11 is still wired) so the bar can be re-enabled later without code changes.

### Per-trial sync feedback (TrialSyncOverlay)

After each trial, `useTrialRunner` runs an offline MLR pass over the trial's raw samples and returns `syncMetrics = { trialRBaseline, trialRCondition, peakErrorMs, pacerPts, beltPts }`. The parent screens render `TrialSyncOverlay` (fixed bottom-left, above the back button at `bottom: 80px`):

- **Phase 2** — `showGraph={true}`: SignalGraph (pacer blue + belt amber) + Base R + Cond R + Peak err. Full researcher QC.
- **Phase 3** — `showGraph={false}`: metrics only, no graph. The graph would reveal condition speed and break participant blinding. Additionally receives `convergence` prop → shows ↑ faster SD and ↓ slower SD rows, colour-coded by convergence threshold.

The overlay clears when the next trial starts (parent sets `syncData` to null).

**Props:** `visible` (default `true`) — pass `visible={false}` from either screen to hide the overlay for participant-facing sessions. Data collection and Supabase writes continue normally; only the render is suppressed.

### Avatar timing during trials

Between trials the avatar is frozen at neutral (`controlRef.current.resetToNeutral()` is called at trial end). Each new trial begins with a **500 ms fixation hold** (no animation, no signal collection) before `sendTrigger('10')` and the first paced breath, giving a clear stimulus boundary between trials.

### Streaming backup

`useStreamingBackup` provides parallel local CSV backup via the File System Access API (`showDirectoryPicker`). Non-Chrome or permission-denied sessions degrade gracefully (returns false). Files: `{participantId}_{ts}_{accel,hr,trials,quest}.csv`. `initBackup(participantId)` opens the directory picker during SESSION_SETUP; `flushAccel/flushHR` are called after each trial alongside Supabase writes via the `recordTrialWithBackup` wrapper in `BreathBelt.jsx`. The trials CSV header now includes `peak_error_ms`, `trial_r_baseline`, and `trial_r_condition`; `appendTrial/appendQuest` are available for per-row backup.

Calibration metrics (`calib_model_label`, `calib_fit_r`, `calib_lag_ms`) are part of the `mlrWeightsRef` JSON stored to `belt_sessions.calib_state`; the separate scalar columns added by `belt_mlr_migration.sql` are available as queryable shortcuts (currently populated from the JSON downstream).

### Baselines — pre and post (120 s each)

Both baselines use the same `BaselineScreen` component with a generic `phase` prop (`'READY'`|`'RECORDING'`|`'COMPLETE'`). Parent FSM maps its states to this generic prop via `baselinePhaseMap()`.

- **Pre-session baseline** (`BASELINE_*`): 120 s free breathing before Phase 2. Code 1 (session start) fires in `onStart` just before recording; codes 2/3 fire at recording start/end via `BaselineScreen`. `breathUtils.estimateBreathPeriodMs()` runs on the collected samples; result stored in `belt_sessions.baseline_period_ms`.
- **Post-session baseline** (`POST_BASELINE_*`): 120 s free breathing after Phase 3. Codes 8/9 fire at recording start/end via `BaselineScreen`; code 0 (session end) fires after `endSession()` resolves. Result stored in `belt_sessions.post_baseline_period_ms`. `endSession()` is called here — all trial and session data flushed to Supabase on post-baseline completion.

Both baselines are 120 s (was 60 s) for matched pre/post comparison in the correspondence study.

### Phase 2 — Fixed trials

9 trials at pre-specified breath period deviations (faster/slower/same relative to baseline). AvatarBreathPacer (from EbbAndFlow) paces the avatar. The participant follows. No response is collected — these are familiarisation trials. Trial data is recorded to Supabase.

After all 9 trials complete, `FixedTrialsScreen.onComplete(trialsData, trialGraphs)` is called — `trialGraphs` is an array of `{ trialNumber, condition, pacerPts, beltPts, peakErrorMs }` accumulated per trial. `BreathBelt.jsx` stores this in `trialGraphsRef.current` and transitions to `PHASE2_REVIEW`.

**Phase 2 review (`PHASE2_REVIEW`):** `Phase2ReviewScreen` shows a 3×3 grid of `SignalGraph` thumbnails — one per trial, labelled by trial number and condition (colour-coded: faster blue, slower purple, same grey). The researcher can assess signal quality across all 9 trials before continuing to the staircase. Replaces the old `PHASE2_COMPLETE` interstitial screen.

### Phase 3 — Dual-QUEST staircase

Interleaved faster/slower staircases using the QUEST+ algorithm.

**Block structure:** trials are generated in blocks of 5 — `[dominant×2, other×2, same×1]` shuffled. Dominant = the staircase with the higher posterior SD (highest uncertainty). SAME catch trials run at BASE speed; the staircase is not updated on SAME responses. `same_context` records which staircase was dominant when the block was built (for SDT false-alarm-by-direction analysis).

Each trial:
1. QUEST selects the next magnitude (log10 seconds deviation from baseline).
2. Avatar paces at that period. Participant follows.
3. 3AFC response: slower / same / faster.
4. Confidence rating (1–7, ConfidenceRating component).
5. Arousal rating (1–7, ArousalRating component).

Both staircases converge independently. Session ends when both converge. Quest state is stashed in `questStateRef` (a `useRef`) when Phase 3 completes, then written to Supabase inside the post-baseline `onComplete` handler. Convergence thresholds and SDs are displayed on the SessionComplete screen.

**Phase 3 screen:** staircase SD values are no longer shown in the centre of the screen. They appear instead in `TrialSyncOverlay` (bottom-left) via the `convergence` prop — colour-coded green/amber/red by threshold (SD < 0.10 / 0.20 / above).

### Belt period estimates — correspondence study

`breathUtils.js` exports `estimateBreathPeriodMs(signal, minPeriodMs=2000, maxPeriodMs=8000)`: accepts `{ t, value }[]`. Uses 5-point peak detection with a 0.40 normalised threshold and median inter-peak interval. Returns null if < 2 valid peaks detected, signal is flat (max−min < 1e-6), or no intervals fall within [minPeriodMs, maxPeriodMs].

`useTrialRunner` collects raw `breathValue` numbers during two windows per trial, then converts to `{ t: i*40, value }` (synthetic relative timestamps, not wall-clock) before calling `estimateBreathPeriodMs`. Both calls pass **`minPeriodMs=1500`** — not the free-breathing default of 2000 — because at the fast extreme of the QUEST staircase the condition breath period approaches 2000 ms, making the inter-peak interval barely pass the 2000 ms gate; 1500 ms avoids false nulls from timing jitter without accepting noise (genuine breath peaks are always ≥ 1500 ms apart at the staircase range used).

- **baseline window** (breaths 1–2 at BASE speed): `btBaselinePeriodMs`
- **condition window** (breaths 3–4 at condition speed): `btConditionPeriodMs`

`BaselineScreen` (pre/post 120 s windows) uses wall-clock `{ t: Date.now(), value }` samples and calls `estimateBreathPeriodMs` with the default `minPeriodMs=2000`. Session-level baseline fields are null if the MLR model is not yet calibrated when recording begins (flat `breathValueRef` → max−min < 1e-6).

Both trial fields are stored on `belt_trials` rows. Null is valid — do not drop the trial. `useTrialRunner` also sets `getPacerRadiusFnRef.current` at trial start (cleared to `() => NaN` at trial end), enabling per-sample pacer radius logging in the raw accel rows.

### Data

Supabase schema in `belt_schema.sql` (initial) + `belt_correspondence_migration.sql` (run second). Tables:

| Table | Contents |
|---|---|
| `belt_sessions` | One row per session: user_id, calib_state JSON, quest_state JSON, storage_path, **session_number**, **baseline_period_ms**, **post_baseline_period_ms**, ***calib_model_label***, ***calib_fit_r***, ***calib_lag_ms*** |
| `belt_trials` | One row per trial: phase, trial_number, condition, breath_period_ms, log10_mag, ††proportion_mag††, response, correct, *****same_context*****, confidence, arousal, belt_sync_mean, **bt_baseline_period_ms**, **bt_condition_period_ms**, ****trial_r_baseline****, ****trial_r_condition****, ****peak_error_ms**** |

**Bold** = added by `belt_correspondence_migration.sql`. ***Bold italic*** = added by `belt_mlr_migration.sql` (now populated by `useBeltSession.endSession` from `calibState` JSON). ****Bold underline**** = added by `belt_sync_metrics_migration.sql`. *****Bold italic underline***** = added by inline `ALTER TABLE` (same_context — for SAME catch trial SDT analysis). ††proportion_mag†† = added by `belt_proportion_migration.sql` — signed proportion change in breath period: `(breath_period_ms − 4000) / 4000`; negative = faster, positive = slower, zero = same; always non-null, computable from `breath_period_ms` alone.

Raw signals are uploaded to the `belt-sessions` Storage bucket as two CSVs per session:

| Storage key | Columns |
|---|---|
| `{user_id}/{session_id}_accel.csv` | `phase, trial, packet_timestamp, sample_index, x, y, z, pacer_radius` |
| `{user_id}/{session_id}_hr.csv`    | `phase, trial, timestamp, heart_rate` |

`belt_sessions.storage_path` holds the base prefix (`{user_id}/{session_id}`) — suffix with `_accel.csv` / `_hr.csv` to reach the blobs. The naming matches the local backup convention written by `useStreamingBackup` (`{participant_id}_{ts}_accel.csv` etc.).

**Storage RLS:** the `belt-sessions` bucket requires an RLS policy on `storage.objects` — without it, authenticated uploads are silently blocked. Policy applied June 2026:
```sql
CREATE POLICY "own belt session data" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'belt-sessions' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'belt-sessions' AND (storage.foldername(name))[1] = auth.uid()::text);
```
If the bucket is ever recreated or the project is migrated, this policy must be re-applied.

### Source layout

```
src/games/BreathBelt/
  BreathBelt.jsx             ← main FSM; backup.initBackup at SESSION_SETUP;
                               recordTrialWithBackup wraps session.recordTrial + flushAccel/HR;
                               accepts studyMode/userId/studyId/onSessionComplete for in-study use
  constants.js               ← BASE_BREATH_SPEED_S, BASELINE_DURATION_MS (120 s), POST_BASELINE_DURATION_MS (120 s), QUEST params,
                               TRIGGER_DEVICES (AD_BBT + Biopac_Left/Right with address/shift), DEFAULT_TRIGGER_DEVICE, BIOPAC_SERVER_URL
  breathUtils.js             ← full MLR pipeline: fitBestModel (6 variants), processPacketMLR, initFilterState3,
                               rollingPearsonR, estimateBreathPeriodMs, buildReviewEntry,
                               medianPeakTimingError, computeMLRPredictions, pearsonRArrays,
                               getPacerRadius, getPacerRadiusForTrial, meanOf
  belt_schema.sql                    ← initial Supabase migration
  belt_mlr_migration.sql             ← adds calib_model_label/calib_fit_r/calib_lag_ms to belt_sessions
  belt_sync_metrics_migration.sql    ← adds trial_r_baseline/trial_r_condition/peak_error_ms to belt_trials
  belt_proportion_migration.sql      ← adds proportion_mag to belt_trials
  hooks/
    useBeltConnection.js     ← Web Bluetooth + Web Serial + Biopac parallel-port server, MLR calibration pipeline;
                               sendTrigger branches per device (AD_BBT hex / Biopac code×shift); connectCOM + connectBiopac;
                               sendTestCascade (1–13 connect check) + testRunning; exposes mlrWeightsRef, filterState3Ref,
                               syncQuality, calibReviewData, beginCalibCollection, redoCalibration, getAndClearTrialSamples,
                               getPacerRadiusFnRef
    useBeltSession.js        ← Supabase session lifecycle; uploads accel + HR as two CSVs to belt-sessions Storage;
                               flattens calibState.modelLabel/fitR/lagMs into the scalar columns on belt_sessions
    useBeltQuestStaircases.js ← dual-QUEST state machine; block-based trial generation [dominant×2, other×2, same×1];
                               recordResponse returns {correct, responseIndex}; SAME trials skip staircase update
    useTrialRunner.js        ← per-trial avatar pacing: 500 ms fixation hold, resetToNeutral at trial end,
                               returns syncMetrics { trialRBaseline, trialRCondition, peakErrorMs, pacerPts, beltPts }
    useStreamingBackup.js    ← parallel local CSV backup via File System Access API (showDirectoryPicker);
                               trials CSV header includes peak_error_ms, trial_r_baseline, trial_r_condition
  components/
    BrowserWarning.jsx       ← Chrome/Edge prompt
    CalibrationScreen.jsx    ← MLR 4-state calibration: FIXATION → BREATHE → FITTING → REVIEW
    CalibReviewPanel.jsx     ← calibration quality metrics + SignalGraph overlay (fit%, lag, peak timing, model)
    SignalGraph.jsx          ← SVG line chart: pacer (blue) vs belt model (amber)
    SynchronyBar.jsx         ← rolling Pearson R bar; NOT currently mounted (kept for future use)
    TrialSyncOverlay.jsx     ← fixed bottom-left post-trial overlay; Phase 2 shows SignalGraph + Base R + Cond R + peak err;
                               Phase 3 shows metrics only (no graph — preserves condition blinding) + staircase SDs via convergence prop;
                               visible prop (default true) — pass false to hide overlay without affecting data collection
    BaselineScreen.jsx       ← reusable for pre and post baselines; props: phase ('READY'|'RECORDING'|'COMPLETE'), title, durationMs, phaseLabel, triggerStart, triggerEnd, onComplete(periodMs)
    FixedTrialsScreen.jsx    ← Phase 2: 9 fixed trials; renders TrialSyncOverlay (with graph) between trials only;
                               records bt_baseline_period_ms, bt_condition_period_ms, trial_r_baseline, trial_r_condition, peak_error_ms;
                               onComplete(trialsData, trialGraphs) — trialGraphs: [{trialNumber, condition, pacerPts, beltPts, peakErrorMs}]
    Phase2ReviewScreen.jsx   ← 3×3 grid of SignalGraph thumbnails shown after Phase 2; props: trialGraphs, onContinue
    StaircaseScreen.jsx      ← Phase 3: QUEST trials + 3AFC + ratings; block-based SAME catch trials (1 per 5-trial block);
                               renders TrialSyncOverlay (no graph) with convergence prop; records same_context for SAME trials
    BeltSyncRing.jsx         ← real-time belt signal ring — retained for other games (Still Water etc.); not used in BreathBelt trials
    SessionComplete.jsx      ← shows session number, pre/post resting period, QUEST thresholds
```

Outside the game tree: `scripts/parallel_server.py` — the localhost:8765 Flask helper that relays Biopac parallel-port writes (Windows-only; needs `inpoutx64.dll`/`inpout32.dll` alongside it). Run it on the Biopac rigs before a session.

### Convergence data flow

`quest.getConvergence()` is called in `StaircaseScreen` when both staircases converge and passed as the third argument to `onComplete(trials, questState, convergence)`. `BreathBelt.jsx` stores convergence in `convergenceRef.current` and quest state in `pendingQuestStateRef.current` (both `useRef`). `endSession()` is called inside the post-baseline `onComplete` callback, consuming `pendingQuestStateRef.current`.

### Schema migration

Run these migrations manually in the Supabase SQL editor in order:

1. `belt_schema.sql` — initial schema
2. `belt_correspondence_migration.sql` — adds `bt_baseline_period_ms`, `bt_condition_period_ms` to `belt_trials`; `session_number`, `baseline_period_ms`, `post_baseline_period_ms` to `belt_sessions`
3. `belt_mlr_migration.sql` — adds `calib_model_label`, `calib_fit_r`, `calib_lag_ms` to `belt_sessions`
4. `belt_sync_metrics_migration.sql` — adds `trial_r_baseline`, `trial_r_condition`, `peak_error_ms` to `belt_trials`
5. Inline — `ADD COLUMN IF NOT EXISTS same_context text` on `belt_trials` (run June 2026; adds SAME catch trial SDT context column)
6. Inline — `ALTER COLUMN breath_period_ms TYPE double precision` on `belt_trials` (run June 2026; QUEST-derived periods are floats, original integer type caused insert failures)
7. `belt_proportion_migration.sql` — adds `proportion_mag` to `belt_trials` (run June 2026; applied via Supabase MCP)

All migrations use `ADD COLUMN IF NOT EXISTS` — safe to run on existing data.

### Status

Integrated. All source files updated at `src/games/BreathBelt/`. Route registered at `/games/breath-belt`. Run migrations in order: `belt_schema.sql`, `belt_correspondence_migration.sql`, `belt_mlr_migration.sql`, `belt_sync_metrics_migration.sql` — all require manual execution in the Supabase SQL editor before running in the lab. Requires Chrome or Edge with Web Bluetooth enabled.

All three trigger devices are implemented: AD_BBT (Web Serial) is production-verified; Biopac_Left and Biopac_Right (parallel-port via `scripts/parallel_server.py`) have been verified on the parallel port. The Biopac rigs must run `parallel_server.py` (with its inpout DLL) and be opened from the local dev server (`http://localhost:5173`) to avoid the https mixed-content block.

---

## 21. WordMax

**Route**: `/games/word-max`
**Slug**: `word_max`
**Access**: Protected
**Duration**: 5 minutes shared across 5 sets
**Status**: Built

### Overview

Five sets of 10 letters. Submit one valid English word per set using only those letters (each only as many times as it appears). Points = word length. A shared 5-minute countdown runs across all 5 sets — spending too long hunting for a long word risks running out of time for later sets. Core perfectionism measure: dwell time per set vs. time remaining at submission.

**Key behavioural measures**: time spent per set, word length chosen vs. time remaining, whether the participant times out before completing all 5 sets.

### Dictionary

Fetched at game load from `https://raw.githubusercontent.com/dwyl/english-words/master/words_alpha.txt` (370k words). Stored in a module-level `Set` (ref, not state). Start button hidden until fetch resolves. 4–10 letter words only.

### Letter tile behaviour

10 tiles rendered in shuffled display order. Tiles fade to 18% opacity as letters are consumed by the typed input (greedy left-to-right match against display order). Tiles restore on delete. Shuffle re-randomises display order and re-applies fade state.

### Word input

All character keypresses intercepted in `onKeyDown` — uppercase enforced manually with `setSelectionRange` to preserve cursor position. Letters not remaining in the pool (computed from prefix before cursor) are blocked at keydown. Enter submits.

### Schema

Table: `word_max_sessions`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `user_id` | uuid | FK → auth.users |
| `created_at` | timestamptz | |
| `completed` | boolean | true if all 5 sets submitted |
| `timed_out` | boolean | true if timer expired before completion |
| `total_score` | int | sum of word lengths |
| `sets_completed` | int | number of sets with a submitted word |
| `duration_ms` | int | actual elapsed ms at session end |
| `set_results` | jsonb | array of 5 `{set_id, letters, word, score, dwell_ms}` objects; word/score null for timed-out sets |

Migration: `supabase/migrations/20260609_lexical_sessions.sql` (creates `word_max_sessions`)

### File structure

```
src/games/LexicalPerfectionism/
  LexicalPerfectionism.jsx    ← orchestration, timer, Supabase write
  constants.js                ← SESSION_DURATION_MS, NUM_SETS, MIN_WORD_LENGTH, DICTIONARY_URL, colour thresholds
  data/
    letterSets.js             ← 25 verified sets + sampleSets()
  hooks/
    useGameTimer.js           ← ref-based countdown; start/stop; onExpire callback
    useLetterSet.js           ← displayLetters, shuffle, getUsedIndices, remainingPool, isDrawable
  components/
    LetterTiles.jsx           ← 10 tiles with opacity fade on use
    WordInput.jsx             ← controlled uppercase input with keydown letter-blocking
    SetResults.jsx            ← completed set rows (letters / word / pts)
    SessionComplete.jsx       ← end screen: score summary + per-set breakdown
```

---


---

## 22. Additional Games (documentation pending)

Built and routed but not yet documented here. Each needs a full section on paradigm, flow, and schema.

- **ColorMax** (`src/games/ColorMax/`) — canvas-based color game (companion to WordMax); paradigm writeup pending.
- **Drift** (`src/games/Drift/`) — emotion-based game reusing Still Water EMOTIONS and the First Contact ContactAvatar; writeup pending.
- **Owl Barn** (`src/games/OwlBarn.jsx` + `useOwlAudio.js`) — audio-based game; writeup pending.
- **Aptitude Suite** (`src/games/AptitudeSuite/`) — multi-task cognitive battery with task-switching metrics; has its own `schema.sql`; writeup pending.


---

# Part III — Measurement & Study Infrastructure

## 23. Questionnaire System

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

---


---

## 24. VAS Scale System (documentation pending)

Visual analogue scale infrastructure is built and in use but undocumented here.

- Components: `src/components/vas/`
- Admin pages: `VasLibraryPage`, `VasUploadPage`, `VasPreviewPage`, `VasPackageBuilder`, `SliderCreatePage`
- Scales built: confidence, life-satisfaction, task-satisfaction; emoji anchor assets in Supabase storage
- Authoring workflow: `vas-scale` skill (claude.ai)

## 24a. Display Elements (2026-07-05)

Participant-facing content pages placeable as session steps: instructions, condition-specific text, performance feedback. Built for Sandy study 3 (predicted vs. observed percentile after Aptitude Suite); the long-term host for what instruction screens currently do in game code.

**Architecture — block-based from day one, text-only for now.** `displays` table (`slug`, `name`, `blocks` jsonb, RLS: authenticated read / lab write via `my_role()`). `blocks` is an ordered array of `{ type: 'text', text, showIf }`; video/audio/interactive block types are additive later (new `type` values), no schema change. Migration `20260705_displays.sql` (applied). Long-term, displays absorb the Training Module system — see §26 Convergence plan (Liliana stays on `intervention_modules`; Sense Foraging course authors as displays).

**Element integration** follows the VAS pattern: one `activities` row per display (`category = 'display'`, `subcategory = slug`), so displays appear in SessionBuilder's picker (new "Displays" group) and flow through `session_template_nodes` / `get_session_by_token` with zero server changes. StepDispatcher v4 dispatches `category === 'display'` to `DisplayStepWrapper`.

**Condition-dependent content**: per-block `showIf: { slot, in: [arms] }` filters against the participant's assignments from `draw_assignment` (§28 Shared assignment primitive). One display serves all conditions.

**Variable interpolation**: `{{path}}` placeholders resolve from the session context — `{{condition}}` (any slot key), `{{slider.<slug>.value}}`, `{{vas.<slug>.value}}`, `{{game.<slug>.<key>}}`. SessionEntry v6 accumulates step outputs from each step's `onComplete` payload (games/sliders/VAS already reported these; previously discarded). Unresolved variables render as "—". The context is in-memory only: a mid-session reload restarts the flow (accepted; restart-from-top is the current session model).

**Variable manifest**: `src/lib/elementOutputs.js` declares what each game reports (`aptitude_suite`: scores + percentiles + `avg_pct`; `word_max`, `color_max`; `still_water`/`breath_belt`: none). Sliders/VAS always produce `value`. The display editor's variable picker reads this manifest plus live slider/VAS slugs — keep the manifest updated when a game's `onSessionComplete` payload changes.

**Admin**: `/admin/displays` (list) + `/admin/displays/new|:id` (editor: name, auto-slug locked after create, text blocks with per-block showIf inputs, variable pill picker). AdminLayout nav regrouped: Sessions/Studies top-level, then an **Elements** section (Games, Screeners, Questionnaires, Rating Scales, Displays, Videos, Audio), then Training/Compensation/Export.

**Sandy study 3 wiring**: session = `slider_predicted_efficacy` → Aptitude Suite → display referencing `{{slider.predicted_efficacy.value}}` and `{{game.aptitude_suite.avg_pct}}`, with condition-gated blocks.

**Dependency checker (2026-07-05)**: `src/lib/displayDeps.js` (pure: `extractDeps`, `itemProduces`, `checkSequence`). Three layers, all warnings non-blocking (unmet variables render "—" at runtime, never crash):
- *SessionBuilder*: display nodes show amber warnings per unmet variable — `missing` (no producer in session), `after` (producer ordered later), `badkey` (game exists but output name wrong, checked against `GAME_OUTPUTS`); slot expectations shown as an info line. Removing a node that later displays depend on prompts a confirm listing exactly which variables break. Display blocks and package contents fetched lazily only when such nodes are present; checks are pure client-side list scans on every edit.
- *StudyFormPage v4*: warns when a display in the study's sessions (via `study_sessions` → `session_template_nodes`) expects a condition slot the study doesn't define — the randomizer half of the check.
- *Package fix*: VAS/slider steps inside `vas_pkg_*` packages previously reported only `{ package_slug, responses_count }` — item values never reached the session context. Packages now report `item_values: [{type, slug, value}]` and SessionEntry v7 files each under its own `slider.`/`vas.` key, so packaging is transparent to variable availability (and to the checker, which resolves package contents to typed slugs).

## 25. Video Library (Admin)

**Routes**: `/admin/videos`, `/admin/videos/new`
**Access**: Lab/admin only
**Status**: Built (June 2026)

### Overview

Standalone video file registry for managing video assets used in study sessions. Separate from `study_videos` (which ties videos to specific study tasks). Videos are uploaded to the `videos` Supabase Storage bucket; the library table stores metadata and provides folder-based organisation in the admin UI.

### Supabase

**Storage bucket**: `videos` (already existed). Storage RLS: authenticated users can read (for signed URLs); lab/admin can upload and delete. See `supabase/migrations/20260526_videos_bucket_storage_policies.sql`.

**Table**: `video_library`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `title` | text | Display name |
| `description` | text | nullable |
| `folder` | text | Logical folder for UI grouping; default `'General'` |
| `storage_path` | text | UNIQUE — path within `videos` bucket, e.g. `general/abc123_intro.mp4` |
| `file_name` | text | Original filename |
| `duration_secs` | int | nullable — read from browser before upload |
| `file_size_bytes` | bigint | |
| `mime_type` | text | |
| `created_by` | uuid | FK → profiles |
| `created_at` | timestamptz | |

RLS: authenticated read; lab/admin insert/update/delete.

**Note**: `study_videos` (which ties videos to `study_tasks`) was also missing INSERT/UPDATE/DELETE RLS policies — these were added in the same migration (`20260609_video_library.sql`).

### VideoLibrary page

- Folder tabs (pill-style): "All" + one tab per unique folder with count badge
- In "All" view: videos grouped under folder headings
- Each row: video icon, title, folder · duration · size · date, storage path in `Space Mono`
- **▶ Preview** button — opens a dark modal overlay with `StudyVideoPlayer` in `preview` mode (no session data recorded)
- **Copy path** button — copies `storage_path` to clipboard (useful when configuring study tasks)
- Inline delete confirmation

### VideoUpload page

- Drag-and-drop zone or click-to-browse; auto-reads video duration and resolution from browser via `URL.createObjectURL`
- **Encoding pre-flight check** — validates against `encode_study_clip.ps1` spec before upload:
  - Container: must be `.mp4` (hard block)
  - Resolution: must be `1280 × 720` (hard block)
  - Approx. bitrate: warns if > 5 Mbps (suggests un-encoded raw footage)
  - "Upload anyway" override available for both hard and soft failures
- Title auto-populated from filename (snake_case → Title Case), editable
- Folder picker: dropdown of existing folders + "+ New folder…" option
- Storage path format: `{folder_slug}/{8-char-uid}_{sanitized_filename}.mp4`
- Progress bar via `onUploadProgress` callback on Supabase storage upload
- On success: inserts `video_library` row; navigates back to library

### StudyVideoPlayer — preview prop

`StudyVideoPlayer` gained a `preview?: boolean` prop (default `false`). When `true`:
- Skips `createVideoSession` — no `participant_video_sessions` row created
- Skips all `logVideoEvent` calls
- Skips `complete_video_session` RPC
- `participantId`, `videoId`, `onComplete` become optional

Used by the VideoLibrary preview modal and the Training module demo modal.

### File structure

```
src/pages/admin/
  VideoLibrary.jsx    ← list + folder tabs + preview modal + delete
  VideoUpload.jsx     ← drag-drop + pre-flight check + upload
src/components/video/
  StudyVideoPlayer.tsx  ← preview prop added
  StudyVideoPlayer.css
```

---

## 26. Training Module System

**Routes**: `/admin/training`, `/admin/training/new`
**Access**: Lab/admin (importer); participant (renderer via StudySessionRunner)
**Status**: Built (June 2026)

### Overview

Intervention training is a first-class step type in the study session flow, distinct from games, questionnaires, and videos. Lab staff import JSON-defined training modules; the session runner renders them as a guided step-by-step participant experience. Built for Liliana's 31-day longitudinal study (Study 3).

### JSON module schema

```json
{
  "module_id": "non-reactivity-phase1-day1",
  "condition": "non_reactivity | reappraisal | self_compassion",
  "phase": "phase1 | phase2",
  "lesson": 1,
  "title": "string",
  "subtitle": "string (optional)",
  "lead_in":  { "owl": "owl_nonreactivity", "text": "string" },
  "steps": [
    { "type": "video",           "video_id": "filename.mp4", "label": "string" },
    { "type": "text",            "content": [{ "tag": "p|h3", "text": "string" }] },
    { "type": "prompt_response", "prompt": "string", "example": "string|null",
      "example_label": "string|null", "size": "single_line|short|long" },
    { "type": "closing",         "content": [{ "tag": "p", "text": "string" }] }
  ],
  "lead_out": { "owl": "owl_love", "text": "string" }
}
```

Screen sequence delivered to participant: `lead_in → steps[] → lead_out`

### Owl assets

10 transparent PNGs stored at `public/assets/owls/{key}.png`. Valid keys:

| Key | Key | Key |
|---|---|---|
| `owl_waving` | `owl_excited` | `owl_nonreactivity` |
| `owl_reappraisal` | `owl_selfcompassion` | `owl_love` |
| `owl_happy` | `owl_crying` | `owl_still` |
| `owl_thinking` | | |

### Database

**`intervention_modules`** — library of imported JSON modules.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `module_id` | text | UNIQUE slug, e.g. `non-reactivity-phase1-day1` |
| `condition` | text | `non_reactivity`, `reappraisal`, `self_compassion` |
| `phase` | text | `phase1`, `phase2` |
| `lesson` | int | Day number within phase |
| `title` | text | |
| `subtitle` | text | nullable |
| `definition` | jsonb | Full parsed JSON module |
| `created_by` | uuid | FK → profiles |
| `created_at` | timestamptz | |

RLS: authenticated read; lab/admin write.

**`session_template_nodes`** gained a `module_id text` column (FK → `intervention_modules.module_id`) for training steps.

**`liliana_participants`** — study-specific participant table for Liliana's Study 3.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `profile_id` | uuid | FK → profiles |
| `study_id` | uuid | FK → studies |
| `condition` | text | Assigned condition arm |
| `randomization_arm` | text | nullable until assigned |
| `phase` | text | `phase1`, `phase2`; default `phase1` |
| `current_day` | int | Advances each completed session; default 1 |
| `midpoint_completed_at` | timestamptz | null = not done; gates Phase 2 access |
| `dropped_out` | bool | default false |
| `dropout_reason` | text | nullable |
| `enrolled_at` | timestamptz | |

RLS: lab/admin all; participant can SELECT own row.

**`liliana_day_data`** — one row per participant per day; created on first session attempt.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `participant_id` | uuid | FK → liliana_participants |
| `study_day` | int | 1–31 |
| `session_name` | text | e.g. `"Phase 1 · Day 3"` |
| `started_at` | timestamptz | Stamped on first open (re-entry preserves original) |
| `completed_at` | timestamptz | Stamped when "Complete Practice" clicked; null = abandoned |
| `data` | jsonb | Variable per-day content: pre/post check-ins, watch flags, etc. |
| — | — | UNIQUE on `(participant_id, study_day)` |

**`intervention_responses`** — per-prompt free-text answers, saved as participant advances.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `participant_id` | uuid | FK → liliana_participants |
| `day_data_id` | uuid | FK → liliana_day_data — links response to the session row |
| `schedule_id` | uuid | nullable — FK → participant_schedule |
| `module_id` | text | Which module was being delivered |
| `study_day` | int | |
| `response_index` | int | 0-based index of this `prompt_response` step within `steps[]` |
| `response_text` | text | |
| `created_at` | timestamptz | |

`day_data_id` allows joining responses to their session row directly. Day row is always created before any prompt step is reachable, so the FK is always satisfiable.

### Design system (InterventionPage)

Distinct visual theme from the main platform — matches the longitudinal study's own design spec:

| Token | Value |
|---|---|
| Background | `#f5f4f0` |
| Page surface | `#ffffff`, max-width 640px |
| Text primary | `#1a1a18` |
| Text secondary | `#5f5e5a`, `#888780` |
| Border | `#ebe8e3`, `#e0ddd8` |
| Surface | `#f0ede8`, `#faf9f7` |
| Done / accent | `#639922` |
| Active step | `#2c2c2a` |
| Complete button | `#3b6d11` |
| Font | system-ui stack |

### InterventionPage rendering rules

**Progress bar** (5 steps, always in this state on the training page):
Welcome ✓ → Check-in ✓ → **Practice** (active) → Check-in (upcoming) → Farewell (upcoming)

**Step pips**: one dot per screen (lead_in + steps[] + lead_out). Done = `#639922`, current = `#2c2c2a`, upcoming = `#ddd`.

**Next button gate per step type**:
| Type | Gate |
|---|---|
| `lead_in`, `lead_out`, `text`, `closing` | Always enabled |
| `video` | Disabled until 90% of video watched (`StudyVideoPlayer.onComplete`) |
| `prompt_response` | Disabled until ≥ 1 character entered |

In `demoMode` (admin preview), the video gate is lifted — Next is enabled immediately.

**Final step** ("Complete Practice"): green button (`#3b6d11`); stamps `completed_at` on `liliana_day_data` row, then calls `onComplete()`.

**Video steps**: use `StudyVideoPlayer` with `preview={true}` (no `participant_video_sessions` row) and `storagePath = liliana/{video_id}`.

**Storage path convention**: training videos must be uploaded to the `videos` bucket with a `liliana/` prefix, e.g. `videos/liliana/1d103c49_nonreactivity_phase1_day1_resampled.mp4`. The `liliana/` folder does not auto-create — the prefix is simply part of the object name.

### Session runner integration

`training` is a first-class category in `StepDispatcher`. Nodes with `module_id` set are normalized by `StudySessionRunner.normalizeNode()` to `{ category: 'training', subcategory: module_id }`. The step label is hidden for training steps (full-screen experience, same as games).

`TrainingStepWrapper` (mounted by `StepDispatcher`):
1. Fetches module definition from `intervention_modules`
2. Looks up `liliana_participants` row by `profile_id`
3. Creates (or fetches) the `liliana_day_data` row for this day — **first attempt stamps `started_at`; re-entry gets existing row, preserving original timestamp**
4. Passes `module`, `participantId`, `dayDataId`, `scheduleId`, `studyDay` to `InterventionPage`

Sim mode (`isSimMode=true`) skips all DB calls and renders a stub module.

### Admin pages

**TrainingLibrary** (`/admin/training`):
- Modules grouped by condition (Non-Reactivity / Reappraisal / Self-Compassion)
- Each row shows: phase/day badge, title, step type chips, `module_id`, import date
- Video steps show full bucket path (`videos/liliana/filename.mp4`) for upload reference
- **▶ Demo** button — opens full-screen modal rendering the complete module in `demoMode` (no DB writes, video Next gate lifted)
- Inline delete

**TrainingUpload** (`/admin/training/new`):
- JSON file picker or paste
- Schema validation: required fields, condition/phase/owl key enums, step structure
- **Video existence check** (async, runs after schema validates): pings `videos/liliana/` prefix in bucket for each `video` step; shows found/not-found per file with exact bucket path
- Import button gated until check completes; "Import anyway" override available for missing videos — file names remain visible so they can be matched later
- Module preview: condition, phase, lesson, owl keys, step breakdown with colour-coded type chips

### SessionBuilder integration

Training modules appear in the "Training Modules" section of the activity picker. Adding one sets `module_id` on the `session_template_nodes` row (with `activity_id` and `questionnaire_id` null). Training nodes are restored correctly on session edit.

### Migrations

```
supabase/migrations/20260609_training_infrastructure.sql  — 4 tables + module_id column
supabase/migrations/20260609_intervention_responses_day_fk.sql — day_data_id FK
```

### File structure

```
public/assets/owls/
  owl_waving.png  owl_excited.png  owl_nonreactivity.png  owl_reappraisal.png
  owl_selfcompassion.png  owl_love.png  owl_happy.png  owl_crying.png
  owl_still.png  owl_thinking.png

src/components/study/
  InterventionPage.jsx     ← participant renderer; demoMode prop
  TrainingStepWrapper.jsx  ← fetches module + participant row + creates day row

src/pages/admin/
  TrainingLibrary.jsx  ← module list + demo modal
  TrainingUpload.jsx   ← JSON import + schema validation + video existence check
```

### Key learnings

- Study-specific participant tables (`liliana_participants`) are the right call for longitudinal studies with typed study-specific variables. DDL required at study launch — can't be provisioned via a client INSERT. Pattern to reuse: dedicated table per major longitudinal study, shared `participants` + JSONB metadata for simpler studies.
- `liliana_day_data.started_at` is stamped on first attempt; `completed_at` remains null for abandoned sessions. Use `completed_at IS NULL` to find drop-offs.
- `midpoint_completed_at` on `liliana_participants` is a hard gate for Phase 2 — explicit nullable timestamp is cleaner than inferring completion from day data presence.
- Training videos must be uploaded with the `liliana/` prefix in the object name — Supabase Storage has no real directories; the slash is just part of the path string.

### Convergence plan with Display Elements (decided 2026-07-05)

Training modules and display elements (§24a) are two parallel block-based content systems (`intervention_modules.definition.steps` vs `displays.blocks`). Decision: converge on displays — but **not for Liliana**.

- **Liliana stays frozen on `intervention_modules`** through her study. Her 34 modules are authored, working, and wired into study-specific data capture (`liliana_participants`, `liliana_day_data`). Rebuilding the delivery vehicle before the August pretest is timeline risk for zero participant benefit. Legacy by appointment, not neglect.
- **Display block types grow by real demand**, additive to the shipped schema: video and audio blocks next (assets + admin libraries already exist), then a `prompt_response`-style response block with a general `display_responses` table. Response capture is the hard design (her modules *collect* data into study-specific tables; displays currently only *show* it) — it gets its own pass, not a deadline-driven one.
- **Step-type census of her content** (what parity actually requires): `prompt_response` 92, `video` 37, `text` 18, `closing` 8, `multi_response` 7, `slider` 7, `audio` 5, `training_response` 6; long tail of bespoke interactives (`thought_rating`, `thought_choice`, `word_select`, `body_diagram`, `trigger_map`, `quality_explorer`, `timer`). Text + video + audio + response blocks ≈ 85% of usage; bespoke widgets get ported only if a future study needs them.
- **Sense Foraging course (P3) is the convergence point**: authored as displays from day one. New curricula never touch `intervention_modules`.
- **After Liliana's study completes**, retire `intervention_modules` / `TrainingStepWrapper` / `InterventionPage`; do not migrate live participants.
- When building the video/audio display blocks, spec their shape against her `video`/`audio` step shapes so a future `definition.steps` → `blocks` converter is mostly mechanical.

## 27. In-Person Study System

### Overview

Extends the study protocol system with an `in_person` delivery mode. A lab RA enrolls participants on-site using an external participant ID, runs a full session (consent → tasks → questionnaires → debrief) on a single screen, and can resume from the last completed step if the session crashes mid-run. The RA's lab account remains authenticated throughout; participants use a silently-created Supabase profile.

> Note: the `online_longitudinal` delivery mode has moved off this protocol model onto the node-graph Experiment Builder (§28). `in_person` and `online_single` stay here. Parts of this section's schema notes predate the live DB; §28 records the verified current schema.

---

### Routes

All inside the existing `AdminRoute` / `AdminLayout` guard (`profiles.role === 'lab'` required).

| Route | Component | Purpose |
|---|---|---|
| `/admin/studies` | `StudiesPage` | Study list with delivery mode badges |
| `/admin/studies/new` | `StudyFormPage` | Create study |
| `/admin/studies/:id/edit` | `StudyFormPage` | Edit study |
| `/admin/studies/:id` | `StudyDetailPage` | Study detail + enrollment panel |
| `/admin/studies/:id/session/:enrollmentId` | `StudySessionRunner` | Full-screen session runner |

---

### File structure

```
src/
  pages/
    admin/
      StudiesPage.jsx           ← study list; In-Person badge on relevant studies
      StudyDetailPage.jsx       ← study detail + enrollment panel
      StudyFormPage.jsx         ← create/edit form; fields conditional on delivery_mode
      StudySessionRunner.jsx    ← full-screen step runner; crash-recoverable
  components/
    study/
      ProtocolBuilder.jsx       ← drag-to-reorder typed step list
      EnrollmentPanel.jsx       ← enrolled participants list + inline enroll form
      StepDispatcher.jsx        ← routes protocol step to correct component
      ConsentStep.jsx           ← consent screen (text from studies.study_consent_text)
      DebriefStep.jsx           ← debrief screen + session complete handoff
      QuestionnaireStepWrapper.jsx  ← fetches questionnaire by slug; wraps QuestionnaireRenderer
      GameStepWrapper.jsx       ← loads game component by slug; passes studyMode props
  lib/
    createParticipantAccount.js ← silent Supabase account creation (secondary client)
inperson_study_migration.sql    ← run manually in Supabase SQL editor
```

---

### Schema

#### `studies` table additions

| Column | Type | Notes |
|---|---|---|
| `delivery_mode` | text | `'remote'` \| `'in_person'`; DEFAULT `'remote'` |
| `study_consent_text` | text | Nullable; consent body shown in ConsentStep |

`protocol` column format changed from bare slug strings to typed step objects:
```json
[
  { "type": "consent",        "slug": "consent" },
  { "type": "game",           "slug": "breath_belt" },
  { "type": "questionnaire",  "slug": "panas" },
  { "type": "debrief",        "slug": "debrief" }
]
```
Valid `type` values: `consent`, `game`, `questionnaire`, `debrief`. Consent and debrief slugs are fixed; game slugs are platform game keys; questionnaire slugs match `questionnaires.slug`.

#### `study_enrollments` table (new)

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `study_id` | uuid | FK → `studies` |
| `participant_id` | text | RA-provided external ID |
| `user_id` | uuid | FK → `profiles` (silent account); set after account creation |
| `enrolled_by` | uuid | FK → `profiles` (lab member who enrolled) |
| `enrolled_at` | timestamptz | DEFAULT now() |
| `status` | text | `'enrolled'` \| `'in_progress'` \| `'completed'` \| `'withdrawn'` |
| `current_step` | int | Index into protocol array; DEFAULT 0 |
| `completed_steps` | jsonb | Array of `{step, slug, type, completed_at, ...summary}`; DEFAULT `[]` |
| `started_at` | timestamptz | Set on first step completion |
| `completed_at` | timestamptz | Set when `current_step >= protocol.length` |
| `notes` | text | Optional RA notes |

UNIQUE constraint: `(study_id, participant_id)` — prevents double-enrollment.

RLS: lab members full access; participants read own row via `user_id`.

---

### Silent participant account creation

`createParticipantAccount(participantId, studyId)` in `src/lib/createParticipantAccount.js`:

- Creates a **secondary** Supabase client (anon key) so the RA's primary session is not disturbed
- Calls `signUp()` with synthetic email `p-{participantId}@radlab.internal` and a random UUID password (never stored or shown)
- After signup, updates the auto-created `profiles` row to `role = 'participant'`, `study_id = studyId` via the primary (RA-authenticated) client
- Returns `{ userId, error }`

Production path: move to a Supabase Edge Function with service role key. For lab use, secondary anon client + RLS is sufficient.

Required RLS policy (in migration):
```sql
CREATE POLICY "lab_can_update_participant_profiles" ON profiles
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'lab'))
  WITH CHECK (role = 'participant');
```

---

### Study creation form (`StudyFormPage`)

Fields always shown: study name, delivery mode (radio: Remote / In-Person), protocol builder, active toggle.

Fields hidden when `delivery_mode = 'in_person'`: reminder settings, enrollment email, messaging options.

Protocol validation: warns (does not block) if consent or debrief step is missing.

---

### Protocol builder (`ProtocolBuilder`)

Each step is `{ type, slug }`. UI per step: type selector (consent / game / questionnaire / debrief), slug selector (fixed for consent/debrief; game list for game; locked questionnaires dropdown for questionnaire), remove button, reorder controls.

Consent step is visually locked to position 0 if present; debrief to the last position.

---

### Enrollment flow (`StudyDetailPage`)

1. RA opens study detail page; sees enrolled participants table with status badges
2. "Enroll New Participant" opens inline form: enter external participant ID → "Enroll & Begin Session"
3. `createParticipantAccount()` called → `study_enrollments` row inserted → navigate to session runner
4. Duplicate participant ID shows inline error (UNIQUE constraint)

Enrollment table actions per row:
- **Resume** (status `in_progress`): navigate to session runner
- **Reset to beginning**: `current_step = 0`, `completed_steps = []`, `status = 'enrolled'` — does not delete game/questionnaire data rows
- **Reset to step N**: set `current_step = N` — choose from completed steps by name
- **Mark withdrawn**: set `status = 'withdrawn'`

All reset actions require a confirm dialog.

---

### Session runner (`StudySessionRunner`)

On mount: fetches enrollment row (including `studies.protocol` and `studies.name`). Reads `current_step` and resumes from there — crash recovery is automatic on any reload of the same URL.

State machine: `LOADING → RUNNING_STEP → SAVING → RUNNING_STEP → ... → COMPLETE`

`SAVING` state (between steps): writes `current_step + 1`, appends to `completed_steps`, updates `status`. Spinner shown to prevent accidental advance.

UI during steps: full-screen, no admin chrome. Thin progress bar at top with step label ("Step 2 of 4 — Questionnaire"). Only persistent UI element visible to participant.

Final screen (after last step): "Session Complete — Participant [ID] has finished all steps." with a "Return to Study" link for the RA.

---

### Step types

| Type | Component | Notes |
|---|---|---|
| `consent` | `ConsentStep` | Static text from `studies.study_consent_text` (placeholder if null) + checkbox + "I Agree" button |
| `questionnaire` | `QuestionnaireStepWrapper` | Fetches by slug; wraps `QuestionnaireRenderer`; writes to `questionnaire_responses` on complete |
| `game` | `GameStepWrapper` | Dispatches to game component by slug; passes `studyMode`, `userId`, `studyId`; receives `onSessionComplete` |
| `debrief` | `DebriefStep` | Static text (placeholder) + "Complete Session" button |

Currently supported game slugs in `GameStepWrapper`: `breath_belt`.

`BreathBelt.jsx` access guard updated to allow `studyMode === true` in addition to `role === 'lab'`.

---

### Migration

Run `inperson_study_migration.sql` in Supabase SQL editor. Includes:
- `ALTER TABLE studies ADD COLUMN delivery_mode`
- `ALTER TABLE studies ADD COLUMN study_consent_text`
- `UPDATE studies SET protocol = '[]'` (resets all existing test data)
- `CREATE TABLE study_enrollments` with RLS
- RLS policy for lab members to update participant profiles

---

### Status

Specced. Build brief: `INPERSON_STUDY_BRIEF.md`.

---


---

## 28. Experiment Builder (Longitudinal Study Redesign)

Replaces the longitudinal study planner with a node-graph design tool for `online_longitudinal` studies. Full detail in `experiment_builder_spec.md` and `phase1_implementation_brief.md`; this section records the durable decisions.

### Scope

- New builder owns `online_longitudinal` only. `in_person` and `online_single` stay on `StudyFormPage`. Balanced condition assignment for single-shot studies runs through the shared `draw_assignment` primitive (see Shared assignment primitive below); per-trial randomization (stimulus order, jitter, item sampling) stays in study code via `src/utils/seededRandom.js`, seed logged with results.
- `delivery_mode`: `online_longitudinal` is the only value routing to the builder. Legacy `remote` and `online_single` are treated as equivalent single-shot and stay on `StudyFormPage`; existing rows are not migrated. If a CHECK constraint limits the column, extend it to allow the new value. Mixed in-person plus online longitudinal sessions are deferred (a per-session delivery flag can be added later without reshaping the graph).
- Route: `ExperimentBuilder` at `/admin/studies/new` and `/admin/studies/:id/design` when `delivery_mode = 'online_longitudinal'`.

### Confirmed live schema (ground truth, 2026-06)

Two parallel runtime models existed on paper; a live column check settled which is real.

- `participant_schedule`: `id, participant_id, study_id, study_session_id, scheduled_date, send_time, status, link_id, attempts, completed_at, created_at`.
- `participant_links`: `id, schedule_id, participant_id, study_id, token, status, expires_at, created_at`.
- Runtime is study_sessions-centric: `participant_schedule.study_session_id -> study_sessions`. auto-enroll and SessionEntry run on this path.
- The deployed `check_schedule` and `send_message` reference a non-existent schema (`scheduled_for`, `protocol_id`, `day_contact_id`, `session_template_id`, `study_day`, `schedule_instance_id`). They are dead code for an unbuilt flow, rewritten rather than patched.
- `message_log` exists; `participant_consent` does not and is not revived. Email opt-out lives on `study_enrollments` (alongside `consent_date`). Unsubscribe tokens live separately in `participant_unsubscribe_tokens`.

### Canonical model going forward

- `studies` + `design_graph` jsonb is the source of truth. Retire `study_protocols` / `protocol_study_days` / `protocol_day_contacts` and `src/pages/admin/ProtocolBuilder.jsx`.
- Keep `study_sessions` (compiled session-slot catalog, one row per graph session node, new `node_key`), `participant_schedule`, `participant_links`, and `session_templates` / `session_template_nodes` / SessionBuilder (untouched).
- Email and reminder settings consolidate onto `studies`; the `study_protocols` duplicate is retired.
- Identifier convention: the profiles UUID is `participant_id` in the runtime/email tables (`participant_schedule`, `participant_links`, `message_log`, `participant_unsubscribe_tokens`, `participant_assignments`) and `profile_id` in `study_enrollments`. The RA-facing text id is `external_id`, only on `study_enrollments`. Never name a text external-id column `participant_id`.

### Graph model (`design_graph`)

Stored as `{ nodes, edges }`. Rendered with React Flow (`@xyflow/react`, MIT, client-side, no telemetry). Node types:

- `timepoint`: `day_offset` (int days from day 1, day 1 = 0), `time_of_day` (null inherits baseline). First is baseline.
- `session`: `session_template_id`, `link_expires_hours`, `label`. References a `session_templates` row; its internal steps are `session_template_nodes`, edited by SessionBuilder.
- `block`: named ordered group of session ids; copy/paste-able; within-block order fixed.
- `randomize` (P2): between-subjects fork; balanced without replacement.
- `counterbalance` (P2): within-subjects order permutation; full permutation set, order randomized; within-block order preserved.

Both fork operations compose in either order, at any timepoint.

### Resolution and materialization

- Rule: resolve each fork when the participant reaches it. Materialize greedily from t0, stop at the first randomize not yet reached.
- Randomize at t0 resolves at enrollment (full schedule materializes immediately). Randomize mid-study (e.g. Liliana midpoint) resolves at that point, so balance is among those who actually reach it.
- Enrollment is a bulk insert of all pre-fork `participant_schedule` rows. First session `unlocked` + link issued; later sessions `pending` with `scheduled_date`, the cron issues each link just in time. This replaces auto-enroll's single-row insert; the materializer is the enrollment flow the cron was waiting for.
- Completion hook (P2) advances across a fork by drawing the balanced slot and bulk-creating the next branch. `complete_session_by_token` only marks done, it does not advance.
- One live link per participant: issuing a new link revokes any prior active links for that participant.

### Balanced draws (P2)

- Fixed `design_seed` per study makes draws reproducible.
- `draw_index` = participants already past the node (live count), so no participant total is declared; the sequence wraps forever by modulo. More participants than orders starts a new cycle; fewer means each order is used at most once.
- Reshuffle each cycle from `seed + node_id + cycle_number` (permuted-block randomization; an RA cannot predict the next arm).
- `participant_assignments` records every draw (group label or block order) for end-of-study audit within each group.

### Shared assignment primitive (2026-07)

Single-shot studies and longitudinal randomize nodes share one draw implementation rather than duplicating balance logic.

- `draw_assignment(study_id, slot_key)`: Postgres function, SECURITY DEFINER, participant from `auth.uid()`. Owns permuted-block draws (seed + slot + cycle, per Balanced draws above), concurrency (advisory lock on study + slot), idempotency (one assignment per participant per slot, returned on re-entry), and the audit write to `participant_assignments` (`node_id` doubles as the slot key, `kind = 'randomize'`).
- Arms live server-side, never passed by the client: `studies.assignment_slots` jsonb (`{ "condition": ["A","B"] }`) for single-shot; `design_graph` randomize nodes for longitudinal (P2 extension point inside the function).
- `design_seed` null falls back to `study_id::text`, so single-shot studies need no setup.
- Callers: single-shot draws at SessionEntry via `useAssignment` hook when `assignment_slots` is non-empty, assignments passed into the step flow; longitudinal (P2) calls the same function from the materializer/completion-hook with arms from the graph.
- StudyFormPage gains a Condition assignment section for non-longitudinal modes: named slots, comma-entry arms (min 2). A slot locks (read-only) once its first assignment exists; lock triggers on first draw, not launch. Escape hatch is duplicating the study, which carries slots but no assignments. New slots can always be added.
- `assignment_balance` view (counts per study, slot, arm) serves pilot verification now and the P2 balance audit.
- Anonymous participants work: token exchange yields an authenticated session, so `auth.uid()` resolves.
- Pilot: Sandy study 3 (Sandy Luu). Full detail in `randomizer_spec.md` and `randomizer_implementation_brief.md`.

**Implemented and pilot-verified 2026-07-05 (WP1–WP5 complete).**
- Migrations (both applied): `20260705_assignment_randomizer.sql` (`assignment_slots`, one-per-slot unique index, `draw_assignment`, `assignment_balance` view with `security_invoker`); `20260705_session_token_assignment_slots.sql` (`get_session_by_token` returns `assignment_slots` in the study object).
- Implementation detail: the Fisher-Yates swap index derives from 24 hash bits (`bit(24)::int`), not 32 — a 32-bit cast can go negative in Postgres and corrupt the modulo. Negligible bias at realistic arm counts.
- Client: `src/hooks/useAssignment.js` (`useAssignment` single-slot, `useAssignments` multi-slot via `useQueries`; both accept a `client` option for SessionEntry's isolated participant client). SessionEntry v5: draws fire only at `state === 'running'` (after screener + consent, so no rows for participants who never pass those gates), block the step flow with loading/error cards, never proceed unassigned. StepDispatcher v3 threads `assignments` (`{ [slotKey]: arm }`) to GameStepWrapper; the display element will consume the same prop.
- StudyFormPage v3: Condition assignment card (non-longitudinal modes) — named slots, comma-separated arms (min 2), validated on save; slot renders read-only once any draw exists (lock queried from `participant_assignments` counts).
- `src/utils/seededRandom.js`: mulberry32 + FNV-1a `hashStringToInt` + `seededShuffle`/`seededPick` for per-trial randomization. FarmJoy's inline mulberry32 copies left for opportunistic consolidation.
- Pilot result: 3 draws on Sandy study 3 (`condition: [control, treatment]`, seed = study id fallback) matched the pre-computed permutations exactly — cycle 0 `treatment, control`, cycle 1 opens `control`; balance even per completed block; link reopen returned the same arm with no new row; slot locked on the form.
- Known behavior kept as-is: reopening a session link restarts the step flow from step 1 (`currentIndex` is client state only; each redone step re-writes its responses). Mid-session resume + persisted step outputs deferred to the display element build or later.

### Liliana flow

baseline -> counterbalanced Phase 1 (3 blocks, days 1-4 order preserved within each) -> midpoint assessment -> randomize into groups -> Phase 2 diverges by group.

### Email and contact settings

- Nested popout (`ContactSettingsModal`) inside the builder, not the first screen. Writes to `studies`: `reminders_enabled`, `reminder_interval_hours` (default 24), `reminder_max`, `allow_restart`, `max_attempts`, `email_subject`, `email_body`. Reuses the existing template-variable editor and iframe preview.
- Cron rewrite: `check_schedule` and `send_message` rebuilt against the live schema. Settings read from `studies` by `study_id`, link expiry from `study_sessions.link_expires_hours` via `study_session_id`, email opt-out from `study_enrollments.email_reminders`, logging to `message_log`. The 15-minute cron does the date+time due-check in code (lab tz America/Toronto); `scheduled_date` + `send_time` stay the source columns.

### Phasing

- P1: additive migration; builder shell (timepoint, session, block) with React Flow; compile graph -> `study_sessions`; linear materializer wired into auto-enroll; contact popout; cron rewrite. Checkpoint after authoring, before runtime.
- P2: randomize + counterbalance + forks + balanced draws + assignment writes + completion-hook advance.
- P3: sample-flow generator and test run.

### Phase 1 migration (additive, nothing dropped)

- `studies`: `design_graph jsonb`, `design_seed text`, `design_version int`, `max_attempts int`, `reminder_interval_hours int default 24`.
- `participant_schedule`: `study_day int`.
- `study_sessions`: `node_key text`.
- new `participant_assignments` (written from P2); `email_reminders` opt-out added to `study_enrollments`.
- `study_protocols` family orphaned in P1, dropped in a follow-up migration once the cron rewrite is verified.

### Key decisions and learnings

- integrate-don't-regenerate, reinforced: the deployed cron functions had drifted from the live DB, visible only via a live column check. Verify schema against the database, not reconstructed DDL or function code.
- Resolve-each-fork-when-reached dissolves the eager-vs-lazy dilemma: it satisfies both full-schedule-at-enrollment (randomize-first) and point-of-divergence balance (mid-study forks).
- A multi-day materializer had to be built regardless (auto-enroll only ever created the first row), so lazy forks cost almost nothing extra.
- Keep `scheduled_date` + `send_time`; do not add `scheduled_for` as a source column (a generated timestamptz is not immutable across time zones).

### Phase 1 implementation — WP1–WP4 complete (2026-06-24)

**WP1 — Migration** (`supabase/migrations/20260624_experiment_builder.sql`, applied)
- `studies`: added `design_graph jsonb`, `design_seed text`, `design_version int default 1`, `max_attempts int default 1`; `reminder_interval_hours` already existed — altered to `SET DEFAULT 24`
- `participant_schedule`: added `study_day int`
- `study_sessions`: added `node_key text`
- New table `participant_assignments (id, study_id, participant_id, node_id, group_label, block_order jsonb, draw_index int, created_at)` — written from P2 balanced-draw logic; RLS: lab ALL, participant SELECT own via `participant_id = auth.uid()`
- `study_enrollments`: added `email_reminders bool default true`, `email_unsubscribed_at timestamptz`

**WP2 — ProtocolBuilder retired**: `src/pages/admin/ProtocolBuilder.jsx` deleted. `study_protocols` was empty; no data migration needed. `study_protocols` / `protocol_study_days` / `protocol_day_contacts` left in DB — to be dropped in a follow-up migration once WP6 cron rewrite is verified.

**WP3 — StudyFormPage + routing**
- `App.jsx`: added `ExperimentBuilder` import and route `/admin/studies/:id/design`
- `StudyFormPage`: selects `design_graph` for lock check; `onSuccess` redirects longitudinal → `/:id/design`, others → `/:id`; delivery-mode radios lock when `existing.design_graph` is set; email/reminder block hidden for longitudinal; hint text added; `useEffect` redirects `/admin/studies/:id/edit` → `/:id/design` for existing longitudinal studies

**WP4 — ExperimentBuilder shell**

*`src/lib/experimentGraph.js`* — pure graph helpers (no React):
- `newId()`, `topLevelNodes()`, `entryNode()`, `chainOrder()`, `validate()`, `addNode()`, `updateNode()`, `removeNode()`, `addSessionToBlock()`, `removeSessionFromBlock()`, `duplicateBlock()`, `toSlots()`
- `toSlots()` walks the chain; timepoints set `currentOffset`/`currentTime`; session nodes produce one slot at `dayNumber = offset + 1`; block children produce consecutive slots at `dayNumber = offset + i + 1`
- `validate()` checks: single entry, starts with timepoint, baseline offset = 0, at least one session, all sessions have template, block children exist, single outgoing edge per non-block node

*`src/components/study/builder/nodes/`*:
- `TimepointNode.jsx` — pink border, shows day label + send time, locked badge
- `SessionNode.jsx` — gray border, shows template name (red if missing) + link expiry, locked badge
- `BlockNode.jsx` — pink-tinted, renders children as list with `Day +i` labels, "+ Add session" and "Duplicate block" buttons (callbacks via `data` props), locked badge

*`src/pages/admin/ExperimentBuilder.jsx`* — main builder page:
- Loads study + `design_graph` from DB; bootstraps baseline timepoint for new studies
- `hasEnrollments` flag blocks structural edits and recompile
- `graphToRfNodes()` / `graphToRfEdges()`: converts internal graph → RF nodes/edges; positions stored in `_positions` meta field on the graph, not in graph structure proper
- `onNodesChange` syncs position changes only; `nodesConnectable={false}` prevents drag-to-connect
- `compileStudySessions()`: calls `toSlots()` then delete-and-reinsert `study_sessions`
- `EditPanel`: different fields per node type (timepoint: dayOffset + time; session: template picker + expiry; block: child count info)
- Save: validates, writes `design_graph` + `_positions` + `design_version`, compiles, invalidates queries
- Header: inline study name edit, save button, locked/error/saved badges
- Toolbar: "+ Timepoint", "+ Session", "+ Block" (hidden when locked)

### Status

WP1–WP4 complete; build passes. Pending:
- **WP5**: `supabase/functions/_shared/materializeSchedule.ts` + wire into `auto-enroll/index.ts`
- **WP6**: Rewrite `check_schedule/index.ts` and `send_message/index.ts` against live schema; verify `/unsubscribe/:token` writes `study_enrollments.email_reminders = false`; lab timezone `America/Toronto`
- **WP7**: `src/components/study/builder/ContactSettingsModal.jsx`
- Follow-up: drop `study_protocols` / `protocol_study_days` / `protocol_day_contacts` once WP6 verified
- P2: randomize + counterbalance + forks + balanced draws

---

# Part IV — Operations

## 29. Key Learnings

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

---

## 30. Roadmap

> Rewritten 2026-07-02 against actual codebase state; replaces the stale "Open Next Steps." Completed history lives in git.

### P0 — Liliana's longitudinal study (pretest August, recruit September)

- [x] Experiment Builder Phase 1 WP1-WP4: authoring shell, `experimentGraph.js`, migration, `ProtocolBuilder` removed (commit 7a030c3, 2026-06)
- [ ] Experiment Builder Phase 1 WP5-WP7: materializer + auto-enroll wiring, cron rewrite against live schema, contact settings modal (see §28 Status)
- [ ] Experiment Builder Phase 2: randomize/counterbalance nodes, seeded draws, React Flow fork UI, materializer extension, completion-hook advance, balance audit view (per `phase2_implementation_brief.md`)
- [ ] Verify multi-session return flow: `profile_id` continuity across participant links
- [ ] Verify reminder cron end-to-end: due-check, Resend delivery, opt-out honored
- [ ] Author Liliana's study in the builder; full dry run via SONA/Prolific link flow including completion redirect
- [ ] Data export check for all her measures
- [ ] August: pilot pass and fix list; September: recruitment live, support mode

### P1 — Onboarding v2 + Wellness Buddy integration

- [ ] Consent flow, minimal terms of service, and demographics for public-tier users
- [ ] Login mood check-in: brief, playful avatar greeting on each login (current avatar system; candidate: lightweight Still Water variant). Default on; skippable.
- [ ] Opt-in contact mechanism for public users
- [ ] Port Wellness Buddy concepts (daily check-in framing, streak/continuity ideas) into the platform; the old CRA/Firebase avatar system is not migrated

### P2 — Dashboard wiring

- [ ] Audit which games write to `game_sessions`/`trials`/`performance` (Pond Watch `onSessionComplete` still unwired)
- [ ] Per-game stat cards + Recharts trend charts on Dashboard
- [ ] Leaderboard page (public tier)

### P3 — Sense Foraging Foundations course (late summer)

- [ ] Curriculum development first; delivery as a self-paced study via Training Modules (§26) + Experiment Builder (§28), with games interleaved as practice

### P4 — Classroom dashboard adoption

- [ ] Decide after course design settles: link out as-is / port to Supabase / API sync. Deferred.

### Housekeeping

- [ ] Rewrite `README.md` (still Vite template boilerplate); repo About URL still points to radlab.vercel.app
- [ ] Remove remaining `[QUEST]` console.logs (4 in EbbAndFlow)
- [ ] Document ColorMax, Drift, Owl Barn, Aptitude Suite (stubs at §22); document VAS system (§24)
- [ ] Refresh §7 route table (`/study`, `/admin` marked "future" but role-based redirect and admin pages exist)
- [ ] Login/Signup mobile padding; Dashboard account card responsiveness
- [ ] BreathBelt: verify LabChart comment mapping for code 13
