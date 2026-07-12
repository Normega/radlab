# Ripple — Wellness Buddy v2 Design Brief

> Authored 2026-07-12 from a planning session with Norm. Sources: the 2021 SSHRC Insight Grant
> ("From Mindfulness to Meaning Online", Farb), the retired CRA/Firebase Wellness Buddy codebase
> (context only — nothing is ported), and the current platform state (website.md). This brief is
> the design authority for the build; the grant and old app are background, not requirements.

---

## 1. Concept and naming

**Ripple** is the user-facing name for the platform's companion character — the merged
avatar/buddy that serves as the default onboarding and login concierge for public-tier users.
"Wellness Buddy" remains the research-facing platform name (matching the grant), the same
layering the grant itself uses ("WB platform" vs. the character).

The name does the scientific work of the product. Mindfulness-to-Meaning Theory's active
ingredient is **decentering** — seeing your experience from a step outside itself. A companion
that is *separate from you but deeply reflective of you* is decentering made into a character:
it externalizes your inner state so you can look *at* it instead of *from* it. A ripple is
**caused by you but is not you** — exactly the relationship. It also extends the platform's
existing water motif (Still Water, Ebb & Flow, Pond Watch): a check-in is a stone dropped in
still water, and your Ripple is what your inner state looks like from the outside.

Onboarding voice line (candidate): *"When the water is still, you can see what's moving
underneath. This is your Ripple."*

Each user customizes and **names their own Ripple** (category noun, not a character name —
"meet your Ripple", "how's your Ripple today?"). Keep a name generator as a starting point
(the old app had one), with free-text override.

**Relationship model** (Norm, 2026-07-12): the Ripple is a **partner on the user's quest for
growth** — not a dependent to caretake, not a pet that needs you. This is a deliberate
divergence from the field's most commercially proven mechanic (Finch's caretaking inversion,
§3a): retention bets on identity ("this is me, made visible") rather than obligation. The
design guardrails in §5 are part of the locked design, not suggestions.

## 2. Decisions locked (Norm, 2026-07-12)

1. **Audience**: Ripple is the default onboarding/login experience for the **public stream**.
   Users start **opted in** and can customize interaction frequency or disable the buddy
   entirely. Lab members can opt in. Tier 2 study participants keep their controlled RA-driven
   flow untouched — but research comparing the buddy experience vs. control conditions in the
   research stream is planned (designed-for, not built now; §10).
2. **Identity**: The buddy and the avatar are **one entity**. No separate user avatar — "the
   user is the user"; there is no virtual space to navigate. The Ripple is a reflection /
   extension of the user, rendered with FACS-coded expression (Still Water's engine). The
   existing avatar system (§13 of website.md) is absorbed into the Ripple: its appearance
   record, point-unlock economy, and header presence all become the Ripple's.
3. **Check-in instrument**: Still Water's circumplex core (two diagonal taps, ~15s) as the
   invariant daily measure, plus 1–2 **rotating items** per day for constructs that change
   slower than daily (life satisfaction, stress appraisal; later the grant's Aim 4
   decentering/reappraisal items). Priorities: minimize friction, maximize feedback value.
4. **LLM**: Not in v1; schema and architecture leave room. First platform LLM use lands in
   Lecture Lounge (constrained summarization); Ripple chat can follow once wellbeing-context
   safety framing and cost are worked out.
5. **Relationship model**: growth partner, not caretaking (see §1). The comparative review
   (§3a) and design guardrails (§5) were adopted 2026-07-12 as part of the locked design.

## 3. What carries forward from the sources

**From the grant** (phased, see §10): avatar customization at onboarding as the engagement hook
(Aim 1); normative "you're not alone" feedback paired with self-affirmation (Aim 2);
demographic-contextualized feedback separating systemic from individual variation (Aim 3);
per-check-in decentering + reappraisal items sampled without replacement from validated scales
(MPoD, ERQ, Stress Mindset) to test MMT as mechanism (Aim 4).

**From the old app, concepts only**: the check-in as a *conversation with a character* rather
than a form; greetings that acknowledge your last state and streak; streak-based continuity;
customized email reminders with tokenized unsubscribe. **Not** carried: client-side norm
computation iterating all profiles, cron-driven streak resets (streaks derive at write time
here), BigHeads rendering, the GPT-3.5 chatbot, Firestore data model.

**Old-app security note**: the retired repo contains a committed Firebase Admin service-account
key (`functions/serviceAccoutKey.json`, project `wellbeing-49fed`). If that project still
exists, revoke the key in Google Cloud IAM. Independent of this build, but do it.

### 3a. From the field — comparative review (2026-07-12)

**Finch** (the leading self-care companion app) is the closest reference. What it proves:
gentle, shame-free continuity works — the bird never dies, missed days cost nothing, no
leaderboards or competitive pressure, and this gentleness is widely cited as *why* it retains
anxious users. What we **borrow**: the tiny-goals loop (→ micro-intentions, §4.3), matched
activities (→ game suggestions, §4.3), and the no-punishment continuity stance (→ guardrail 2).
What we **reject**: its core caretaking inversion — the pet *needs* you, and self-care is
reframed as providing for it. Any resource the buddy needs from the user is a guilt lever,
and it conflicts with the growth-partner model (§1). Also rejected: social gifting between
users (moderation surface, privacy risk, off-mission for v1).

**Tamagotchi / Duolingo** are the cautionary patterns: engagement via neglect-guilt and
streak-loss anxiety respectively — engagement powered by negative affect, antithetical to a
wellbeing instrument. Nothing borrowed.

**AI-companion research** (2025–26: Harvard Business School dark-patterns study — 5 of 6
popular companion apps use emotionally manipulative tactics when users try to leave; Nature
Machine Intelligence and clinical literature on dysfunctional emotional dependence and
substitution for professional help) grounds guardrails 3, 5, and 8. Our users are students
and our companion is explicitly self-reflective, so the attachment surface exists even
pre-LLM.

**Named tension**: Finch works *because* caretaking creates gentle obligation; we refuse
obligation as a motivator on purpose. The research-stream comparison (§10) could eventually
test identity-based vs. obligation-based retention directly. Future sessions: do not
reintroduce neediness mechanics because they're proven elsewhere — the divergence is the point.

## 4. User experience

### 4.1 Signup → onboarding (public tier)

```
/signup → /welcome (new, replaces the bare avatar-guard redirect)
  1. Consent + minimal Terms of Service (versioned; §7 consents)
  2. Demographics questionnaire (existing questionnaire system, slug "demographics")
  3. Meet your Ripple — intro beat (voice line above), customize appearance
     (skin + eye at 0 points, same palettes as current avatar system)
  4. Name your Ripple (generator + free text)
  5. First check-in (condensed Still Water core; Ripple's face mirrors the composite)
  → /dashboard, profiles.onboarding_complete = true
```

Existing-user migration: users with an `avatars` row already have a Ripple appearance. On next
login they get a one-time "your avatar has become your Ripple — name it" beat; consent/ToS
step appears if their `consents` record predates the current version.

### 4.2 Login greeting + check-in prompt

On login (and on the first page load of a new local day), the Ripple greets the user: face
reflects their **last** check-in composite, text references streak/continuity and varies by
recency ("welcome back", "it's been a while" — templated, no LLM). Greeting copy is about the
**user**, never about the Ripple's feelings (guardrail 3). If today's check-in isn't done and
the user's cadence setting says prompt, the greeting offers it: one tap to start, one tap to
skip. Never a hard gate — skip always visible, never nagged twice in a day. Greetings may be
**semester-aware** ("it's midterm season — a lot of students are feeling it"): cheap,
normalizing, and previews Aim 2's normative framing before live norms exist.

### 4.3 Daily check-in (~20s)

1. **Circumplex core**: Still Water's two diagonal ratings (Sad↔Excited, Calm↔Tense), reusing
   `WheelSVG` / `computeRating` / `calcExpr` in a condensed variant (no intro screen for
   returning users). The Ripple's face is the live feedback surface — it takes on the
   composite expression at reveal.
2. **Rotating slot** (0–2 items): drawn by the item engine (§8) — a VAS or short scale item.
3. **Intention follow-up**: if the previous check-in recorded a micro-intention, the Ripple
   asks how it went (`did` / `partly` / `not today`) — every answer met equally warmly, no
   penalty, no comment on skipped days.
4. **Close**: templated self-affirming acknowledgement from the Ripple (equally warm for hard
   days — guardrail 1), +5 points (consistent with Still Water's §17 convention), streak
   update. Then two optional, skippable beats:
   - **Micro-intention** (the Finch tiny-goals borrow, and nearly verbatim grant Aim 2
     "self-care reflection and planning for the next 24 hours"): "one small thing for
     tomorrow?" — pick from a short list or type a few words.
   - **Game suggestion**: the platform-native "adventure" — the Ripple may suggest an existing
     game loosely matched to reported state ("feeling tense — a few breaths in Ebb & Flow?").
     Suggestion, never prescription; converts the buddy from check-in nag into a concierge to
     the whole platform.

Manual check-in is always available regardless of prompt settings (route below).

### 4.4 Customization & opt-out model

Settings live with the Ripple, not buried in account settings — editing your Ripple *is* the
interface (`/ripple`):

- **Appearance + name** (unlock-gated features per the existing point economy)
- **Prompt cadence**: every login · once daily (default) · weekly · never
- **Mood mirror in header**: the 36px header Ripple can reflect your last check-in expression.
  Default **off** (neutral face) — a mood-displaying header leaks affective state to anyone
  glancing at your screen. Opt-in.
- **Email reminders**: opt-in, time-of-day choice, tokenized unsubscribe (reuse the
  `/unsubscribe/:token` pattern from study enrollments). Later phase (§11 WP6).
- **Disable Ripple**: greeting and prompts stop; header shows the plain initial circle;
  check-ins remain manually accessible. Reversible from profile.

Opted-in by default; the model is *customize down*, not *sign up for*.

### 4.5 Feedback to the user

- **v1**: immediate (the face) + personal trends on the dashboard (valence/arousal/ambivalence
  and rotating-item trajectories over time — folds into roadmap P2 dashboard wiring).
- **Later (Aim 2)**: position relative to peers ("most students this week are also tense"),
  always paired with self-affirming framing; norms come from nightly aggregate jobs, never
  client-side scans (old-app lesson).
- **Later (Aim 3)**: demographic-contextualized decomposition, gated on subgroup n.

## 5. Design guardrails (locked 2026-07-12)

These are constraints on every WP, not a feature to schedule. The first is unique to this
platform: unlike Finch, the Ripple is also a research instrument.

1. **Mirror, don't judge — mood-valence neutrality of all rewards.** Points, streaks, unlocks,
   and the Ripple's warmth depend only on *completing* a check-in, never on *what is reported*.
   A buddy that is visibly happier/healthier when you report positive mood corrupts the data
   (incentivized positivity bias) and builds toxic positivity into the product. The face
   mirrors state without evaluating it; warmth lives in the acknowledgement copy and is equal
   on hard days.
2. **Non-punitive continuity.** The Ripple never dies, sickens, or sulks. Streaks are framed
   additively — total check-ins prominent, current streak secondary — never as something you
   "lose". No loss-aversion framing, no streak-repair mechanics.
3. **No neediness or guilt levers.** Greeting/prompt copy is about the user, never the buddy's
   feelings. "Good to see you" yes; "I missed you" / "I was lonely" never. The buddy has no
   needs the user must service (no hunger, energy, or mood-of-its-own meters).
4. **Notification ethics.** At most one prompt per day; skip is one tap; skipping is never
   commented on; no re-engagement messaging designed to induce guilt. Cadence settings (§4.4)
   are the mechanics — this is the copy policy.
5. **Crisis pathway + scope honesty.** A transparent, rule-based (not ML) pattern — e.g.
   sustained very-low-valence check-ins — gently surfaces real resources (U of T Navi, Telus
   Health Student Support, Good2Talk, 9-8-8). Consent states plainly: not a clinical tool,
   check-ins are not monitored by a person, here is where real support lives. **Launch gate**:
   needs an ethics pass and Norm's call on thresholds before public release (see §11, §12).
6. **Data dignity.** Mood is never public: no mood on leaderboards, header mood-mirror opt-in
   (§4.4), future norms rendered only above a minimum subgroup n, working export/delete-my-data
   path.
7. **Feedback after capture, never before.** Norms, trends, and the Ripple's reaction render
   only after a rating is committed — otherwise the display anchors the response.
8. **LLM-phase reserved conditions** (written now so future sessions inherit them): no tactics
   that prolong engagement when a user disengages; no claimed feelings that create obligation;
   crisis escalation designed *before* the chat feature ships; session boundaries. Grounded in
   the AI-companion dependence literature (§3a).

## 6. Ripple rendering — unifying the two avatar engines

The platform currently has two SVG faces: `BaseAvatar` (static, skin/eye, unlock slots) and
Still Water's `ExpressiveAvatar` (FACS AU engine via `calcExpr`, valence/arousal/intensity
props). **`ExpressiveAvatar` becomes the single Ripple renderer**:

- Extend it to accept the `avatars` appearance columns (ear/nose/mouth/hair/tail/accessory/
  aura/scar as they unlock) alongside its expression props.
- Neutral expression (v=0, a=0) replaces `BaseAvatar` everywhere it renders today (header,
  profile, leaderboards). `BaseAvatar` is deprecated after migration.
- The unlock economy (§13 thresholds) is unchanged — points now grow your Ripple.
- FaceRead and Still Water continue importing the same engine; changes must stay
  backward-compatible with their props.

## 7. Schema (Supabase; migrations in `supabase/migrations/`, RLS per CLAUDE.md patterns)

### `ripples` — identity + interaction state, one row per user

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `user_id` | uuid | FK → auth.users, UNIQUE |
| `name` | text | User-given Ripple name |
| `enabled` | bool | default true — master switch (§4.4) |
| `prompt_cadence` | text | `'every_login'` \| `'daily'` (default) \| `'weekly'` \| `'never'` |
| `mood_mirror_header` | bool | default false |
| `streak_current` | int | default 0 |
| `streak_best` | int | default 0 |
| `last_checkin_on` | date | local-day anchor for streak + prompt logic |
| `last_greeted_on` | date | prevents double-greeting in a day |
| `item_state` | jsonb | rotating-item engine state (§8) |
| `created_at` / `updated_at` | timestamptz | |

Streaks derive **at write time**: on check-in, if `last_checkin_on` = yesterday → increment,
= today → no-op, else → reset to 1. No cron, no scheduled resets (old-app lesson).

RLS: `user_id = auth.uid()` FOR ALL (own-rows pattern).

### `ripple_checkins` — one row per completed check-in

Circumplex columns mirror `stillwater_responses` (pos/neg rating, x/y, composite, ambivalence)
**plus**: `user_id` (FK, RLS anchor), `local_date` (unique with `user_id` — one scoring
check-in per day), `context` (`'onboarding'` \| `'login_prompt'` \| `'manual'`),
`items jsonb` (rotating-item responses: `[{item_id, bank_version, value}]`),
`intention text` (the user's optional "one small thing for tomorrow", §4.3),
`prev_intention_outcome text` (`'did'` \| `'partly'` \| `'not_today'` — the follow-up answer
about the *previous* check-in's intention, recorded on the current row).

`stillwater_responses` stays as-is for the standalone/anonymous game; the Ripple check-in is a
separate authenticated instrument. RLS: own rows FOR ALL to authenticated.

### `consents` — versioned consent/ToS records

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `user_id` | uuid | FK |
| `doc_type` | text | `'consent'` \| `'tos'` |
| `version` | text | e.g. `'2026-07-a'` |
| `agreed_at` | timestamptz | |

Append-only (INSERT + SELECT policies only; no UPDATE/DELETE for authenticated). Versioning is
what lets the research stream later re-consent under a study protocol.

Demographics reuse `questionnaire_responses` (slug `demographics`) — no new table.
`avatars` and `avatar_unlocks` are unchanged (appearance + economy). `profiles` needs no new
columns in v1 (`onboarding_complete` already exists; Ripple state lives in `ripples`).

**RLS reminder** (CLAUDE.md): every new table gets explicit authenticated policies in the same
migration — a policy-less RLS table silently blocks all writes. Add rows to the migration
manifest (`supabase/migrations/README.md`) on apply.

## 8. Rotating item engine

- **Item bank lives in code** (versioned JS module, `bank_version` recorded per response), not
  in a table — banks change by deploy, not at runtime, and this keeps authoring reviewable.
- v1 bank: life-satisfaction VAS, stress-appraisal VAS (confident↔overwhelmed). Aim 4 phase
  adds decentering (MPoD) and reappraisal (ERQ / Stress Mindset) item pools.
- **Sampling without replacement** per pool per user (grant's Aim 4 method): `ripples.item_state`
  holds `{pool_id: {remaining: [item_ids], cycle: n}}`; when a pool empties, reshuffle and
  increment `cycle`. Deterministic, testable, no server component.
- Scheduling: each pool declares a cadence (e.g. satisfaction every 3rd check-in, stress every
  2nd); the engine fills at most 2 slots per check-in, friction budget first.

## 9. Routes & code structure (per CLAUDE.md conventions)

```
/welcome            Onboarding flow (consent → demographics → meet/customize/name → first check-in)
/ripple             Ripple home: appearance, name, cadence, mood-mirror, disable, reminders
/checkin            Manual daily check-in (same component the login prompt opens)
src/ripple/         Product area: RippleAvatar (extended ExpressiveAvatar), Greeting,
                    CheckinFlow, itemEngine.js, useRipple() hook
```

- All three routes **lazy-loaded**; verify each lands in its own `dist/assets/` chunk.
- The route group wraps in `<ErrorBoundary label="Ripple">` — a greeting-system crash must
  never take down login or the dashboard (Lecture Lounge partitioning precedent).
- The greeting itself renders inside the logged-in layout (not a route), but its component
  tree is dynamically imported and error-bounded so the concierge is additive, not load-bearing.
- The `/profile/avatar` guard redirect is replaced by the `/welcome` flow for new public users.

## 10. Research hooks — designed for, not built now

- **Condition assignment**: a future `wb_condition` (profiles column or study-protocol field)
  distinguishing `ripple` vs. active-control (grant Aim 1b: games/distraction without
  reflection — the platform's existing games are a natural active control). The Ripple
  surface must be cleanly suppressible per-account from day one — the `ripples.enabled`
  switch doubles as the condition lever.
- **Instrument stability**: the circumplex core never varies by condition or cadence, so data
  pools across the public stream; `context` + `local_date` columns make engagement pattern
  analysis (grant Aim 1a: modelling wellbeing across the semester) possible without joins.
- **Aim 2/3 feedback experiments**: feedback rendering is a pure function of
  (own data, aggregate norms, framing variant) — variant selection can later be
  condition-driven without touching capture.
- **Aim 4**: the item engine's sampled pools are exactly the grant's method; adding the
  validated banks is content, not architecture.
- **Consent versioning** (§7) supports re-consenting public users into studies.

## 11. Phasing

| WP | Scope | Notes |
|---|---|---|
| WP1 | Schema migration (`ripples`, `ripple_checkins`, `consents` + RLS) · consent/ToS/demographics steps · `/welcome` flow skeleton | Closes roadmap "consent flow… for public-tier users" |
| WP2 | Ripple identity: ExpressiveAvatar unification, appearance+naming UI, header swap, existing-user migration beat | Deprecates BaseAvatar |
| WP3 | Check-in core: condensed Still Water flow, points, write-time streaks, `/checkin` | First data flows |
| WP4 | Login greeting + prompt cadence + `/ripple` settings + disable path + rotating item engine (v1 bank) + micro-intentions + game suggestions | Completes the concierge loop |
| WP5 | Dashboard feedback: personal trends (folds into roadmap P2 Recharts work) | |
| WP6 | Email reminders + unsubscribe · leaderboard/streak surfacing decision | |
| **Launch gate** | Crisis resource pathway + scope disclaimers (guardrail 5) — ethics pass + Norm's threshold call | Required before public release, whichever WP it lands after |
| Later | Aim 2 norms feedback → Aim 3 demographic contextualization → Aim 4 MMT banks → research-stream conditions → LLM chat | Each gated on the prior's data |

## 12. Open questions

1. **Greeting voice**: warm-clinical vs. playful-creaturely? Needs a copy pass with Norm
   before WP4; templates are cheap to swap.
2. **First Contact interplay**: First Contact remains the mandatory *games* onboarding
   (Ebb & Flow gate). Does `/welcome` precede it, absorb it, or stay orthogonal? Current
   assumption: orthogonal — `/welcome` gates the account, First Contact gates Ebb & Flow.
3. **Streaks on leaderboards**: surface check-in streaks publicly (old app did) or keep
   continuity private to the user? Privacy lean: private by default.
4. **Lab-member opt-in surface**: where does a lab user turn the Ripple on? (Probably a
   simple enable on `/profile`.)
5. **Ripple visual species**: does the FACS face stay humanoid, or do the ear/tail unlocks
   push it creaturely? (Existing unlock art direction already mixes freely — assume yes.)
6. **Crisis-pathway thresholds** (guardrail 5, launch gate): what pattern triggers the
   resource surface (e.g. N consecutive very-low-valence check-ins?), how often may it show,
   and what's the exact resource list + copy? Needs Norm + ethics review — the one guardrail
   with real design risk in both directions (paternalistic if too eager, negligent if absent).
