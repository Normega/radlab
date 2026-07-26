# Handoff prompt for the senseforaging.com Claude Code instance

(Paste everything below this line as the first message in the new project directory.)

---

You are building **senseforaging.com** — a book pitch/demo site for *The Sense Foraging Handbook* (Farb & Segal), to be shown privately to a literary agent. It presents the book concept and offers two live, playable sense-foraging practices — **Delve** (visual) and **Tune** (auditory) — as proof of the book's "web companion" concept. **No login, no database, no analytics — fully static.**

Two files in this directory are your inputs:

1. `senseforaging_site_brief.md` — the authoritative brief: positioning, architecture, extraction plan, style rules, flags. Read it first and follow it.
2. `senseforaging_mockup_v1.html` — the approved visual design for the landing page. Open it in a browser. Reproduce it faithfully as the `/` route (structure, tokens, typography, hover behaviors), converting it to React components. Placeholder copy in it is fine to keep for now.

## Source material (read-only)

The two games live in the RADlab repo at `F:\gits\radlab_project\radlab`. **Do not modify that repo — copy from it only.**

- `src\games\Delve\Delve.jsx` + `src\games\Delve\constants.js` + `src\games\Delve\assets\default-background.jpg`
- `src\games\Tune\Tune.jsx` + `src\games\Tune\constants.js`
- Reference for chrome/style only (do not port them): `src\components\Nav.jsx`, `src\pages\Landing.jsx`, `src\index.css`, `tailwind.config.js`

## Build plan

1. **Scaffold**: Vite + React in this directory. Routes: `/` (landing, from the mockup), `/delve`, `/tune` (fullscreen games). Use react-router with lazy-loaded game routes. Install `@fontsource/dm-serif-display`, `@fontsource/dm-sans` (400 + 600), `@fontsource/space-mono` (400 + 700) and import them in the global CSS — the game components hardcode these font families but do not load them.
2. **Port the games** per the brief's §3, verbatim where possible. The critical changes, and the only ones you should make:
   - **Remove Supabase completely.** Delete the `supabase` import and the `startSession` / `saveSessionComplete` / `fetchBackground` code paths (both games already no-op these without a session — you are removing dead weight, not changing gameplay). Do NOT copy `src/lib/supabase.js`; it throws at import time without env vars.
   - **Replace `<Nav>`** (appears once on each game's intro screen and once on summary) with a minimal shared header: the `sense`/`foraging` two-tone wordmark linking to `/`. Do not port RADlab's Nav — it drags in react-query, avatar components, and a profiles query.
   - **Replace `<Link to="/games">`** on summary screens with a link to `/`.
   - **Delve backgrounds**: bundle the copied `default-background.jpg` plus (optionally) 1–3 more suitable CC0 landscape/nature images locally, picked at random per session. No DB reads.
   - **Tune audio**: the 31 clips are NOT in the radlab repo. Download them from radlab's public Supabase Storage bucket into `public/audio/`: read `VITE_SUPABASE_URL` from `F:\gits\radlab_project\radlab\.env.local`, then each clip is at `<VITE_SUPABASE_URL>/storage/v1/object/public/public-assets/tune-audio/<clipId>.mp3` — clip IDs are enumerable from `SCENES` in Tune's `constants.js`. Then change `audioPath()` to return local `/audio/<clipId>.mp3` paths and delete the storage-client usage. Verify all 31 files downloaded non-empty before moving on.
   - Touch nothing else inside the game loops, canvas engines, audio graph, or the intro/summary chrome — they are already on-brand and tuned. Do not "fix" the DPR clamp in Delve's constants (documented deliberate perf envelope).
3. **Landing page**: convert the mockup to React. Keep the proposal ribbon. Wire the two demo-card CTAs to `/delve` and `/tune`.
4. **Style discipline** (brief §4): light mode only; single pink accent `#F068A4` in all chrome; DM Serif Display weight-400 headings; Space Mono uppercase labels; radius 24px clickable / 12px cards; type scale 12/14/16/20/28/36; CTAs end in `→`.

## Verify before calling it done

- `npm run build` succeeds; each game route is its own chunk (not in the entry bundle).
- With devtools open and network offline-throttled to normal: `/` renders with correct fonts (serif headings, mono labels — if headings render as Georgia, the fontsource imports are wrong).
- `/delve`: haze resolves where the pointer rests, decays when it leaves; finish → summary shows duration and dwell stats; "again" restarts. No console errors, zero network calls to supabase.
- `/tune`: all 10 scenes load and play; resting near a voice brightens it while others duck; scene switcher works; finish → summary. Confirm audio loads from `/audio/`, not from supabase URLs.
- No route requires or mentions login anywhere.

## Flags to respect (do not resolve them yourself)

- **BBC audio licensing**: Tune's real-audio clips are cleared for research/education/personal use only. Fine for this private demo; the site must not be publicized/indexed until clips are cleared or replaced. Add `<meta name="robots" content="noindex">` for now.
- Deployment (static host + Namecheap DNS for senseforaging.com) is a later step — get it running locally first and report back before deploying anywhere.

Work autonomously through the build; report at the end with what's runnable (`npm run dev` URL and the three routes) and anything that deviated from the brief.
