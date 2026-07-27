# senseforaging.com — book pitch site brief

**Purpose**: A demo/pitch site for *The Sense Foraging Handbook* to show a literary agent. It presents the book concept and offers two live, no-login sense-foraging practices — **Delve** (visual) and **Tune** (auditory) — as proof of the "web companion" concept.

**Mockup**: `resources/senseforaging_mockup_v1.html` (this repo) — single-page visual mockup in radlab.zone style. Open it in a browser; it is the design target for the landing page.

---

## 1. Positioning & content

- Framed as the practical follow-up to *Better in Every Sense* (Farb & Segal) — "from why to how".
- Structure of the landing page (see mockup): ribbon (proposal preview) → nav → hero → The Book (Learn / Practice / Carry trio) → principles strip ("No account · No score · Nothing to complete") → The Web Companion with two demo cards → Authors → footer.
- Copy tone follows radlab.zone: playful but precise, serious science underneath. No login anywhere; no signup capture on v1.

## 2. Architecture recommendation

**Separate project** (new repo/directory, e.g. `F:\gits\senseforaging`), not a route inside radlab. Rationale: different domain, no auth, no Supabase runtime dependency, and the pitch site should be deployable/iterable without touching the lab platform.

- Vite + React, three routes: `/` (landing), `/delve`, `/tune`. Games are fullscreen; landing links to them.
- Static hosting (Cloudflare Pages / Netlify / Vercel — any is fine). Point Namecheap DNS at it: apex `A`/`ALIAS` + `www` CNAME per the host's docs. No server, no DB.

## 3. Extracting the games (verified against current code)

Source of truth in the radlab repo:

| | Delve | Tune |
|---|---|---|
| Component | `src/games/Delve/Delve.jsx` (486 lines) | `src/games/Tune/Tune.jsx` (542 lines) |
| Config | `src/games/Delve/constants.js` | `src/games/Tune/constants.js` (includes all 10 scene definitions) |
| Bundled assets | `assets/default-background.jpg` (302 KB fallback) | none in repo — 31 mp3s in Supabase Storage |

Key facts making extraction easy (verified 2026-07-26):

- **Both games already no-op all DB writes without a session** (`startSession` returns null without a userId; `saveSessionComplete` returns without a sessionId). The only thing making them login-required on radlab.zone is the `ProtectedRoute` wrapper in `App.jsx`, not the components.
- Neither reads profile/avatar/points/consent. No edge functions, no signed URLs.
- All media sit in the genuinely public `public-assets` bucket (anon-readable by URL).

Work items for the standalone port:

1. **Strip Supabase entirely** (recommended over stubbing): delete the `supabase` import and the `startSession`/`saveSessionComplete`/`fetchBackground` DB paths. `src/lib/supabase.js` throws at import time without env vars, so it must not be imported at all. Zero persistence on the demo site — sessions are ephemeral, which is also the honest thing for a pitch demo.
2. **Replace `Nav`** (used only on intro/summary screens, `Delve.jsx:447`, `Tune.jsx:498`) with a minimal senseforaging nav (wordmark + "← back"). The radlab `Nav` drags in react-query, avatars, and a `profiles` query — do not port it.
3. **Delve backgrounds**: anon RLS already blocks the `delve_backgrounds` read, so radlab's Delve falls back to the single bundled JPEG. For the demo, bundle 2–4 good background images locally and pick randomly — richer than prod, no DB needed.
4. **Tune audio**: download the 31 mp3s from the public bucket (`public-assets/tune-audio/<clipId>.mp3`; clip IDs are in `Tune/constants.js`) and serve them from the site's own `/public/audio/`. Change `audioPath()` to return local paths. This removes the Supabase client, sidesteps the unverified-CORS-for-`decodeAudioData` open item (website.md §21c), and makes the demo self-contained.
5. **Fonts**: install `@fontsource/dm-serif-display`, `@fontsource/dm-sans` (400/600), `@fontsource/space-mono` (400/700) — the game components hardcode these families but rely on the app shell to load them.
6. **Replace `react-router-dom` `<Link to="/games">`** on the summary screens with links back to `/`.
7. Keep the games' internal chrome untouched — intro/summary already use brand pink on `#FCF0F5` (Delve and Tune are sibling-identical after commit `0257672`).

## 4. Style conventions (must-follow, from radlab design system)

Tokens: bg `#FCF0F5`, card `#FFFFFF`, tint `#FBEAF3`, pink `#F068A4`, pink-dark `#C04A82`, text `#1C1C1E` / `#6B6C70` / `#ABADB0`. Borders: `rgba(240,104,164,0.18)` subtle / `rgba(180,100,140,0.13)` neutral.

Rules: light mode only; single pink accent in all chrome (free color only inside game stages); DM Serif Display (weight 400 only) for headings, DM Sans 400/600 for body/buttons, Space Mono uppercase + letter-spacing for labels/chips/CTAs; type scale 12/14/16/20/28/36 with clamp() heroes; radius 24px for clickable, 12px for cards; flat bordered cards, shadows only on hover-lift; CTAs end in `→`; hub-card hover inverts to near-black with `#f4a8cb` accents.

Wordmark: text, not image — `sense` in `#1C1C1E` + `foraging` in `#F068A4`, DM Serif Display 400. (Mirrors the RAD/lab two-tone pattern.)

## 5. Flags

- **BBC audio licensing (blocking for public launch, fine for private demo)**: Tune's 6 real-audio scenes use BBC RemArc clips, licensed for research/education/personal use. A book-marketing site is plausibly commercial use — before senseforaging.com is publicized (vs. privately shown to the agent), either get per-clip clearance or swap in cleared/CC0 recordings. The 4 all-synth scenes (Reverie, Sunroom, Aurora, Gamelan) have no such issue — a defensible v1 demo could ship synth scenes + a subset of cleared real scenes.
- **Safari < 18**: Delve's canvas haze (`ctx.filter`) doesn't blur on older Safari — scene renders sharp. Known limitation, documented in Delve constants; acceptable for a demo, worth a one-line graceful note if the agent uses an old Mac.
- Tune's 10-scene switcher bar is an internal-testing affordance; for the pitch demo consider defaulting to 2–3 strongest scenes with the switcher retained (it demos well — shows breadth).
- No analytics, no email capture on v1. If the agent conversation goes well, a "notify me" email capture would be the first addition.

## 6. Not in scope for v1

- Any login/auth, any database, any data retention.
- Chapter/sample content from the actual manuscript (placeholder copy is in the mockup).
- The other radlab games — this site is deliberately just the two sense-foraging practices.
