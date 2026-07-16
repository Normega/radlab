# Design-System Drift Report — Phase 0

**Date:** 2026-07-16
**Branch:** `claude/onboarding-redesign-v1`
**Spec:** `resources/designhandoff/RADlab-Onboarding-Redesign-V1-Dev-Spec.md` §1 (verbatim source of truth), audited per `resources/designhandoff/CLAUDE-CODE-BRIEF.md` Phase 0.
**Status:** Report only — no fixes applied. This is the hard gate before Phase 1.

**Method:** scripted regex inventory over all 283 source files in `src/` plus `tailwind.config.js` and `index.html` (hex/rgb/hsl colors, Tailwind arbitrary values and utility classes, `font-size`/`fontSize`, `font-family`/`fontFamily`, `font-weight`/`fontWeight`, `border-radius`/`borderRadius`/`rounded-*`), followed by manual classification and file-level spot-checks of the shared chrome (`Nav.jsx`, `App.jsx`, `index.css`, auth pages, `WelcomeFlow`). Raw inventories with file/line/context for every occurrence are in `design-audit/data/*.csv`; aggregated counts in `design-audit/data/summary.txt`.

**Area buckets used throughout** (so game-internal art doesn't drown the signal):

| Bucket | Paths | Redesign-relevant? |
|---|---|---|
| platform-core | `src/pages/*` (non-admin), `src/components/*` (non-study) | **Yes — the redesign's surface** |
| onboarding-ripple | `src/ripple/*` | **Yes — becomes the new onboarding** |
| games | `src/games/*` | Chrome yes; internal art = sanctioned exception |
| study-infra | `src/components/study|questionnaire|vas|video|audio/*` | Participant-facing; separate decision (§7) |
| admin | `src/pages/admin/*`, `AdminLayout` | Internal tooling; lowest priority |
| lecture-lounge | `src/classroom/*` | Own partition; out of redesign scope |
| lab | `src/pages/lab/*`, `LabLayout` | Public but separate section |
| dev-keynote | `src/pages/dev|keynote/*` | Dev/demo only; ignore |

---

## 1. Baseline: the live token infrastructure

The good news first: the live site already has a token system (`src/index.css` `:root`), and **6 of the 8 new color tokens match it exactly**:

| New token | Hex | Live equivalent | Match |
|---|---|---|---|
| base | `#FCF0F5` | `--bg` | ✅ exact |
| surface | `#FFFFFF` | `--bgc` | ✅ exact |
| tint | `#FBEAF3` | `--bgp` | ✅ exact |
| primary | `#F068A4` | `--pk` (+ Tailwind `pk`) | ✅ exact |
| primary-dark | `#C04A82` | `--pkd` (+ Tailwind `pkd`) | ✅ exact |
| text-main | `#1C1C1E` | `--tx` | ✅ exact |
| text-secondary | `#6B6C70` | `--tx2` | ✅ exact |
| text-muted | `#ABADB0` | `--gy` (+ Tailwind `gy`) | ✅ exact — but see `--tx3` below |

**Live tokens with NO counterpart in the new 8** (Phase 1 must decide their fate — §8 Q1):

| Live token | Value | Uses (`var()`) | Note |
|---|---|---|---|
| `--tx3` | `#a8a9ad` | **383** — the single most-used variable in the codebase | Near-duplicate of text-muted `#ABADB0` (RGB distance 6, visually indistinguishable). Prime merge candidate. |
| `--bd` | `rgba(180,100,140,0.13)` | 331 | Default border. The new palette defines **no border colors**. |
| `--pkb` | `rgba(240,104,164,0.18)` | 84 | Subtle pink border (primary @ 18%). |
| `--bds` | `rgba(180,100,140,0.25)` | 61 | Strong border. |
| `--pkbs` | `rgba(240,104,164,0.35)` | 17 | Strong pink border. |
| `--gy` | `#abadb0` | 17 | Redundant with `--tx3` in practice; exactly equals new text-muted. |

Font-size guardrail tokens (`--fs-*`) also exist; three of six sit **inside** the new scale (12/14/16), two sit **outside** it (`--fs-mono-md` = 13px, `--fs-body-lg` = 18px) — see §3.

`tailwind.config.js` extends only `pk`/`pkd`/`gy` colors and the three font families. No named-Tailwind-palette classes (`bg-pink-500` etc.) are used anywhere — 0 matches. Styling is overwhelmingly inline `style={}` objects + CSS vars, not Tailwind utilities; that shapes the Phase 1 migration strategy (wiring tokens into `tailwind.config.js` alone won't touch most call sites).

---

## 2. Colors

**Inventory:** 2,493 hard-coded color occurrences (hex + rgb/rgba literals), **461 unique values**, across 193 files. Full data: `data/colors.csv` (per-occurrence, with nearest-token distance).

### 2.1 Hard-coded copies of the 8 tokens — 805 occurrences

These are exact token values written as literals instead of `var()`/theme references. Pure mechanical cleanup, zero visual change:

| Value | Token | Hard-coded count | Concentration |
|---|---|---|---|
| `#ffffff` | surface | 402 | everywhere (admin 122, games 105, study 85) |
| `#f068a4` | primary | 195 | PlatformPage 16, Drift 13, CheckinFlow 12 |
| `#1c1c1e` | text-main | 71 | games + platform |
| `#abadb0` | text-muted | 59 | BaseAvatarCreator, Drift, audio CSS |
| `#fcf0f5` | base | 40 | SessionEntry, ColorMax, audio CSS |
| `#6b6c70` | text-secondary | 19 | keynote, index.css |
| `#c04a82` | primary-dark | 16 | PlatformPage, builder nodes |
| `#fbeaf3` | tint | 3 | — |

### 2.2 Near-misses (off-by-a-hair duplicates of tokens)

Distinct values within small RGB distance of a token, in **non-game-art** code — these are the "off-by-one pinks" the designer predicted. Merge candidates (visual QA needed but low risk):

| Value | Nearest token (dist) | Count | Where |
|---|---|---|---|
| `#a8a9ad` (= `--tx3`) | text-muted (6) | 9 literal **+ 383 via `var(--tx3)`** | codebase-wide |
| `#1e1e1e` | text-main (3) | 11 | ColorMax |
| `#fae8f2` | tint (2) | 2 | ColorMax |
| `#fce7f3` | tint (3) | 1 | TrainingUpload |
| `#fdf2f8` | base (4) | 9 | study/admin chips |
| `#fef2f2` | base (4) | 5 | admin/WordMax error bg |
| `#1a1a1a` | text-main (5) | 1 | video CSS |
| `#fff3f3` | base (5) | 1 | ScreenerPage |
| `#fff0f0` | base (6) | 23 | ExperimentBuilder + study error tints |
| `#fcebeb` | tint (8) | 6 | Login/Signup/UserAdmin **error boxes** |
| `#faf5f8` | base (6) | 4 | BreathLab |
| `#fff5f5` | base (6) | 1 | ParticipantsAdminTab |
| `#f4ecf2` | tint (7) | 5 | Drift/FaceRead |
| `#1a1a18` | text-main (7) | 13 | study-infra |
| `#b0b2b4`, `#a9a9a9`, `#b0ada8` | text-muted (8–9) | 8 | PondWatch, avatar libs, VAS |
| `#f5f5f5`, `#fafafa`, `#f9f8f5`, `#faf7fb`, `#f6effb`, `#f8f6f2`, `#faf7f9` | base/surface (8–9) | 10 | scattered one-offs |

Also notable at slightly larger distances but clearly "brand pink family": `#b4648c` (25 uses — an older muted pink in keynote/lab/`index.css`), `#f09595`/`#a32d2d` (error-state pink/red on auth pages, 12 uses), `#e8d0e0` (18 uses, CheckinFlow/StillWater), `#f4a8cb` (Landing blob).

### 2.3 Whole off-palette design languages (not near-misses — decisions needed)

1. **Study-infra participant UI** (`InterventionPage`, `MidpointStep`, `ScreenerPage`, `DailyFarewellStep`…): a deliberate warm-gray + green system — `#639922` (48), `#2c2c2a` (35), `#5f5e5a` (31), `#e0ddd8` (27), `#888780` (19), `#faf9f7` (18), `#3b6d11` (17), `#1a1a18` (13)… roughly **250+ occurrences forming a coherent second palette**. This looks intentional (calmer, less "gamey" for research participants). Needs a ruling: exempt like game art, or migrate? (§8 Q4)
2. **Admin semantic/status colors:** `#ee0044` error (65), `#c0392b` (41), `#1ea878` success (21), `#e67e22` warn (22), `#15803d`, `#8b6000`, blues/purples for chips — ~200 occurrences. Root cause: **the 8-token palette has no success/error/warning/info colors**, so every surface invents its own. Phase 1 should either add semantic tokens or bless a set (§8 Q2).
3. **Game-internal art** (sanctioned exceptions per the brief): OwlBarn night palette (~80 unique), FarmJoy earth/veg tones (~40), PondWatch nature greens/blues (~30), StillWater mood spectrum, BreathBelt data-viz colors (`#e74c3c`/`#2ecc71`/`#f39c12`/`#3498db`), Ember fire math, ColorMax stimulus colors (the game *is* colors). **Avatar/Ripple skin+eye swatch palettes** (`BaseAvatar`, `BaseAvatarCreator`, `hairStyles.js`, `avatar-species.js`) are product data, not drift — the redesign explicitly reuses the live Ripple customizer.

### 2.4 Violation counts by area (non-token colors, occurrences)

| Area | Non-token occurrences | Assessment |
|---|---|---|
| games | ~700 | mostly sanctioned art; chrome bleed-through is modest |
| admin | ~450 | second palette + semantic colors; internal-only |
| study-infra | ~400 | coherent second palette; decision needed |
| platform-core | ~200 | avatar swatches (data) + real drift (error tints, Dashboard accents, Landing blob) |
| lecture-lounge | ~50 | small; separate partition |
| lab / dev-keynote | ~90 | lab stubs + demo decks |
| onboarding-ripple | ~40 | CheckinFlow wheel colors (mood-art) + a few near-miss pinks |

---

## 3. Font sizes

**Inventory:** 1,910 occurrences. After normalizing rem→px and unitless JSX values, **~60 distinct concrete sizes** (the designer found 18 in shipped CSS; the full source inventory is worse). Spec scale: **12 / 14 / 16 / 20 / 28 / 36 only.** Full data: `data/fontsizes.csv`.

### 3.1 The headline: 13px is the most-used font size in the codebase

| Size | Occurrences | In scale? | Notes |
|---|---|---|---|
| **13** | **353** (incl. 7 via `--fs-mono-md`) | ❌ | The de-facto site standard for nav links, CTAs, eyebrows — institutionalized by the `--fs-mono-md` guardrail. Biggest single migration question: 13→12 or 13→14 (§8 Q3). |
| 12 | 351 (incl. 31 via `--fs-mono-sm`) | ✅ | |
| 14 | 371 (incl. 66 via `--fs-body-sm`) | ✅ | |
| **11** | **215** | ❌ | Below the site's own 12px WCAG floor. Admin 106, platform-core 26 (PlatformPage 10), study 38. |
| 15 | 112 | ❌ | Auth inputs/buttons (`Login.jsx`), study, games. |
| 16 | 118 (incl. 52 via `--fs-body`) | ✅ | |
| **10** | 73 | ❌ | Below floor; admin chips mostly. |
| 20 | 39 | ✅ | |
| **9** | 35 | ❌ | Below floor; AvatarEditor labels, Dashboard micro-labels. |
| 28 | 32 | ✅ | |
| 22 | 30 | ❌ | Section titles wanting to be 20 or 28. |
| 18 | 31 (incl. 4 via `--fs-body-lg`) | ❌ | "Comfortable reading" size — guardrail-blessed, scale-illegal. |
| 26 | 22 | ❌ | |
| 24 | 19 | ❌ | |
| 17, 19, 21, 30, 32, 34, 40, 42, 48, 52, 56, 64, 120 | ~60 total | ❌ | Mostly game display numerals and hero sizes. |
| Fractional rem leftovers: 17.6, 15.2, 14.4, 13.6, 13.5, 12.8, 12.5, 11.2, 10.88, 10.5, 10.4, 9.92, 18.4, 22.4, 27.2 | ~40 total | ❌ | The predicted `0.7rem`/`1.1rem`-style drift; BreathBelt, audio/video CSS, lab pages, `index.css` itself (18.4px). |
| `clamp(...)` responsive expressions | ~44 | n/a | Nav wordmark, heroes, game titles. Legit technique; endpoints should land on scale steps. |
| 36 | 11 | ✅ | |

**Scale compliance: ~940 of 1,910 occurrences (49%)** land on the 6 steps (counting the three in-scale `--fs-*` vars). The About-page Large Hero exception (Dev Spec §1.2: per-screen CSS wins) is acknowledged and not counted as a violation.

**Conflict to resolve in Phase 1:** the live guardrail system (`--fs-min` floor, "16px iOS auto-zoom floor" for body, `--fs-mono-md`/`--fs-body-lg`) partially contradicts the new scale (13 and 18 are blessed; meanwhile 11/10/9px usage violates *both* systems, 323 occurrences). See §8 Q3.

---

## 4. Font families & weights

**Inventory:** 408 family + 462 weight occurrences. Full data: `data/fontfamilies.csv`, `data/fontweights.csv`. Spec: DM Serif Display 400, DM Sans 400/600, Space Mono 400.

### 4.1 🔴 Loaded weights don't match the spec — or the code

`index.css` loads: DM Serif Display 400 ✅ · Space Mono 400 **+ 700** · DM Sans 400 **+ 500** — **DM Sans 600 (SemiBold) is not loaded at all.**

Yet the code declares `font-weight: 600` **116 times**. Browsers silently substitute (synthesize faux-bold or snap to 500), so every "600" on the live site is not rendering the font the spec calls for. Conversely `font-weight: 500` is used 135 times (incl. 13 Tailwind `font-medium`) and **is** loaded — but 500 isn't in the spec's weight set.

| Declared weight | Count | Loaded? | In spec? |
|---|---|---|---|
| 500 | 135 | ✅ | ❌ |
| 600 | 116 | **❌** | ✅ |
| 700 | 100 | Space Mono only | ❌ (DM Sans 700 not loaded → faux bold) |
| 400 | 112 | ✅ | ✅ |
| 300 / 800 | 4 | ❌ | ❌ |

Phase 1 fix is cheap (add `@fontsource/dm-sans/600.css`, then rationalize 500/700 usage), but the 500-vs-600 mapping choice affects the whole UI's visual weight (§8 Q5).

### 4.2 Families — largely compliant

DM Sans (172), Space Mono (129 + 5 `var(--mono)`), DM Serif Display (32), `inherit` (40, fine). Violations (~25 occurrences):

- `system-ui`/`sans-serif` stacks: **`MidpointStep.jsx` (14)** — a recent study component that skipped the brand font entirely; OwlBarn (3), PondWatch (2), dev pages (4), `ContactSettingsModal`, `StudyFormPage`, `AssessmentLeadInStep` (1 each).
- bare `monospace`: keynote graphics (6).

---

## 5. Border radii

**Inventory:** 875 occurrences, 48 unique values. Rule: **clickable = 24px; eyebrow labels & cards/panels = 12px.** Full data: `data/radii.csv` (with a ±3-line clickability heuristic — treat per-row flags as indicative; the shared-chrome classification below is hand-verified).

### 5.1 Headline: nothing on the site uses 24px for buttons

`border-radius: 24` appears **3 times total** (avatar editor chrome + `Verified.jsx` card — none of them buttons). The current de-facto button radii on exactly the surfaces the redesign replaces:

| Element (hand-verified) | Current radius | Rule says |
|---|---|---|
| `Nav.jsx` `btnOutline` / `btnPrimary` (Sign out, Log in, **Join free**) | 9 | 24 |
| `PlatformPage` `btnPrimary` / `btnOutline` (all marketing CTAs) | 9 | 24 |
| `Login/Signup/ForgotPassword/ResetPassword` submit buttons | 12 | 24 |
| `WelcomeFlow` (onboarding) primary CTA + nav buttons | 12 / 10 | 24 |
| Auth inputs (`Login.jsx` `input`) | 9 | (FillableBox per Figma) |
| Auth card (`Login.jsx` `card`) | 20 | 12 |
| `PlatformPage` cards (`statPanel`, `gameCard`, `tierCard`, `steps`) | 16 / 14 | 12 |
| `PlatformPage` `gameBadge` / `keyPill` (eyebrow-label equivalents) | 5 / 6 | 12 |
| Dashboard cards | 16 | 12 |

### 5.2 Distribution (all 875)

| Radius | Count | Dominant use |
|---|---|---|
| 8 | 147 | admin panels/inputs |
| 10 | 143 | study cards, buttons |
| **12** | 131 | cards (✅ already rule-compliant where non-clickable: 118 of 131) |
| 50% | 70 | circles (avatars, dots — legitimately exempt) |
| 6, 7, 9, 11 | 124 | chips, admin, **Nav/Platform buttons** |
| 14, 16, 18, 20 | 112 | cards that should be 12 |
| 999 / `rounded-full` | 27 | pills (FarmJoy chrome, keynote) |
| 2–5 | 62 | tiny chips, bars |
| **24** | **3** | none of them buttons |
| corner-specific / percentage art values | ~25 | game art (owl bodies etc.) — exempt |

**Practical read:** radii drift is total, but the fix rides almost entirely on Phase 2 — once `Button/PrimaryCTA` (24px) and card/label primitives (12px) exist, every redesigned screen inherits compliance. The long tail (games chrome, admin) can migrate opportunistically. No blocker.

---

## 6. Header implementation

**Question:** is there one shared Header used on every route? **No — five header regimes plus headerless routes**, and the shared one is mounted per-page, not per-layout.

### 6.1 Structure

`src/components/Nav.jsx` is the closest thing to a shared header, but it is **imported and rendered individually in ~20 page/game files** (plus twice at App level for Pond Watch / Owl Barn) rather than via a layout route. There is no single mount point to swap — Phase 2's `Header` should be introduced as a layout wrapper, or the swap touches 20+ files.

### 6.2 Route × header matrix

| Routes | Header | Divergence from redesign rule (consistent header everywhere) |
|---|---|---|
| `/` (Landing) | **Bespoke inline `<nav>`**: logo + UofT logo only — no nav links, no auth actions | Diverges (though `/` is the marketing splash; redesign's About maps to `/platform`) |
| `/platform` (→ redesign's **AboutPage**) | Shared `Nav` | Guest variant shows **About · Log in · Join free** — redesign wants **Dashboard · Games · About** with Dashboard/Games preview-only for guests (⚠️ guardrail #1: guest preview pages not designed; do not invent) |
| `/login` `/signup` `/forgot-password` `/reset-password` | Shared `Nav` (hard-coded `session={null}`) | Shows guest links even if a session exists (PublicOnlyRoute mostly prevents that state) |
| `/verified` `/dashboard` `/games` `/profile` `/profile/avatar` `/checkin` `/study/:id/consent` | Shared `Nav` | ✅ consistent |
| **`/welcome` (WelcomeFlow — the current onboarding)** | **No header at all** | Redesign's onboarding screens *do* have the global header — direct conflict to resolve in Phase 4 |
| `/ripple/name` | No header | same as above |
| Games: first-contact, pond-watch, owl-barn, still-water, ebb-flow, drift, face-read | Shared `Nav` (mixed: 2 at App level, 5 internal) | ✅-ish, inconsistent mount point |
| Games: farm-joy, breath-belt, aptitude-suite, word-max, color-max | **No header** (immersive full-screen) | Divergent; arguably intentional per-game |
| `/lab/*` | `LabLayout` own nav (About/People/Research/Publications/Media/Contact) | Separate section, separate nav — presumably stays |
| `/admin/*` | `AdminLayout` sidebar | Internal; exempt |
| Lecture Lounge | `Nav` on student/console/remote/admin; none on projector `ClassScreen` | Own partition; exempt |
| `/s/:token`, `/unsubscribe/:token`, `/demo/*`, `/keynote`, `/dev/*` | None | Participant links / demos; intentional |

### 6.3 Spec-mapping note (route drift vs. documentation)

Live routes have moved since website.md §7 was written: `/` is now `Landing` (hub-style splash), `/platform` is the games marketing page (= the redesign's AboutPage target), `/games` is a **protected** `GamesPage`, and `Hub.jsx` is gone from routing. The Dev Spec's "radlab.zone/platform was not accessible from the nav" claim matches the live guest Nav (guest sees only About→`/`, Log in, Join free — there is indeed no persistent way back to `/platform`... except the guest "About" link pointing at `/`, not `/platform`). The redesign's nav fixes exactly this; no additional drift beyond what it already plans.

---

## 7. Summary — violations by category, ordered by estimated fix effort

| # | Category | Scope of violation | Est. effort | Notes |
|---|---|---|---|---|
| 1 | **Font loading vs spec** (DM Sans 600 missing; 500 loaded instead; Space Mono 700 extra) | 1 file to fix loading; 351 weight declarations to rationalize | **XS→S** | Highest impact-per-line in the audit. Do first in Phase 1. |
| 2 | **Hard-coded token-equivalent hexes** (805 occurrences of the exact 8 values) | 150+ files | **S–M** | Mechanical find→replace to `var()`/theme keys; zero visual change; can be scripted + eyeballed. |
| 3 | **Near-miss color merges** (§2.2, incl. `--tx3`→text-muted at 383 `var()` uses + 9 literals) | ~30 values, ~120 call sites (or 1 line if `--tx3`'s definition is changed to `#ABADB0`) | **S** | `--tx3` merge is a one-line change with site-wide subtle effect; rest are per-value swaps. |
| 4 | **Radii** (no 24px buttons anywhere; cards on 14/16/20; labels on 5/6) | ~500 non-compliant, but redesign surfaces ≈ 30 call sites | **S for redesign surfaces via Phase 2 primitives; L site-wide** | Don't chase the long tail; let `Button`/card primitives carry it. |
| 5 | **Header unification** | 20+ per-page `Nav` mounts; 5 regimes; onboarding+5 games headerless | **M** | Structural: introduce layout-level `Header` in Phase 2; guest Dashboard/Games preview is guardrail #1 (confirm scope first). |
| 6 | **Font-size scale** (49% compliant; 13px is the modal size; 323 sub-12px uses) | ~970 off-scale declarations codebase-wide; platform-core+onboarding ≈ 180 | **M for redesign surfaces; XL site-wide** | Needs the 13px ruling (§8 Q3) before any migration. |
| 7 | **Off-palette families** (`MidpointStep` system-ui ×14, misc ×11) | 8 files | **XS** | Trivial; fold into Phase 1. |
| 8 | **Semantic-color gap** (admin/status reds/greens/ambers, ~200 uses) | palette design decision + admin sweep | **M, gated on design decision** | Not a Phase-1 blocker if admin is exempted. |
| 9 | **Study-infra second palette** (~400 occurrences, coherent system) | decision needed | **0 or L depending on ruling** | Recommend: explicitly exempt for now (participant-facing studies mid-flight; §8 Q4). |
| 10 | Game-internal art | — | **0** | Sanctioned exception per brief. |

---

## 8. Open questions for the human gate (block Phase 1 where noted)

1. **Extra live tokens** (`--bd`, `--bds`, `--pkb`, `--pkbs` borders; `--tx3`): the 8-token palette defines no border colors. Keep them as sanctioned supplements, or derive Phase-1 border tokens from the 8 (e.g. primary at fixed alphas)? *(Blocks Phase 1 token wiring.)*
2. **Semantic colors** (success/error/warn): add tokens in Phase 1, or bless current per-surface choices and exempt admin? *(Blocks only admin cleanup, not the redesign.)*
3. **The 13px ruling**: 353 occurrences + a named guardrail token (`--fs-mono-md`) sit on 13px, mostly Space Mono labels/CTAs — the exact elements the redesign restyles anyway. Map 13→12 (risk: small-mono legibility, contradicts "Space Mono reads small" guidance) or 13→14 (risk: chunkier chrome)? Same question for 18px/`--fs-body-lg` (→16 or →20?). *(Blocks font-size migration; does NOT block token wiring.)*
4. **Study-infra palette** (InterventionPage/Screener/Midpoint warm-gray+green): intentional second design language for research participants, or drift to migrate after Liliana's study ships? Recommend: exempt now, note in website.md. 
5. **DM Sans 500 vs 600**: code says 500 (135×, loaded) and 600 (116×, *not* loaded). Spec says 400/600. Load 600 and migrate 500→600 (visibly bolder UI), or migrate 600→500 (contradicts spec)? Recommendation: load 600, migrate both to spec weights on redesigned surfaces, leave games/admin at 500 until touched. *(Blocks Phase 1 font wiring.)*
6. **Space Mono 700**: loaded and used (real font, not faux). Spec lists Space Mono 400 only. Keep or drop?
7. **Guest header preview** (guardrail #1, restated): current guest Nav has no Dashboard/Games entries; redesign adds them as preview-only, but no guest preview pages exist or are designed. Confirm: render nav items pointing where, exactly — login? scroll-to-signup? — before Phase 2 builds `Header (Guest)`.

---

## 9. Decisions — Phase 0 gate review (Norm, 2026-07-16)

The §8 questions were resolved in review. These rulings govern Phase 1+:

| # | Question | Ruling |
|---|---|---|
| 1 | Extra live tokens | **Keep the 4 border tokens** (`--bd`, `--bds`, `--pkb`, `--pkbs`) as sanctioned supplements. **Merge `--tx3` into text-muted** by redefining it to `#ABADB0` (one line; 383 call sites converge on the token). |
| 2 | Semantic colors | **Minimal set in Phase 1**: tokenize error tint/border/text from the current auth values (`#FCEBEB` / `#F09595` / `#A32D2D`). Admin status colors exempt until a later cleanup. |
| 3 | 13px | **13 → 14.** `--fs-mono-md` retires. Redesigned surfaces first; long tail as touched. |
| 3b | 18px | **18 → 16.** `--fs-body-lg` retires. Long-form contexts rely on 150% line-height. |
| 3c | Below-floor sizes (11/10/9px) | Floor to 12 on any touched surface (both the old guardrails and the new scale agree these are violations). Untouched files migrate opportunistically. |
| 5 | DM Sans weights | **Load 600; migrate ALL 500 → 600 in one pass** (Norm chose full migration over surface-by-surface). `font-weight: 700` in DM Sans contexts (currently faux-bold) also → 600. Drop the 500 file once no uses remain. Expect a uniform, site-wide bolding — visual QA accordingly. |
| 6 | Space Mono 700 | **Keep** for game/admin data readouts; **not used** on redesigned surfaces (spec: 400 only there). |
| 4 | Study-infra second palette | **Migrate — ASAP.** Liliana's pretest is *just starting* (July, earlier than the August plan), so the migration is pulled forward: it happens **immediately after Phase 1 tokens land**, before Phases 2–6, so the maximum share of pretest/recruitment runs on the new look. Participant-facing screens: `InterventionPage`, `MidpointStep`, `ScreenerPage`, `DailyFarewellStep`, VAS/questionnaire wrappers. |
| 7 | Guest header preview | **Visible, inert**: Dashboard/Games render muted and non-navigating for guests, optional "Join free to unlock" hint on click. No invented preview pages (guardrail #1 holds). |

**Revised sequencing consequence:** Phase 1 = tokens (colors + semantic error set + fonts incl. the 600 load + full weight migration + radii keys) → **Phase 1b = study-infra token migration (new, urgent)** → Phase 2 primitives → Phases 3–6 per the brief. Still one phase per review stop.

---

## Appendix: method limitations

- Regex inventory: template-literal colors (e.g. Ember's computed `rgba(...)` fire math) appear as raw strings in `colors.csv` (~15 rows); dynamic values can't be classified and are all game-internal.
- The `clickHeuristic` column in `radii.csv` scans ±3 lines for click affordances; it under-detects buttons styled via shared style objects. §5.1's table is hand-verified from the actual style definitions; trust it over the heuristic for chrome elements.
- SVG `fill`/`stroke` attributes inside JSX count as color occurrences (correct for drift purposes: avatar/game SVGs are the exemption bucket, and they dominate those rows).
- Occurrence ≠ rendered element (a style object used by N elements counts once); counts measure *source drift*, which is the thing Phase 1 edits.
