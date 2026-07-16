# RADlab Onboarding Redesign v1 — Claude Code Brief

**Owner:** Norm Farb (RADlab, radlab.zone)
**Date:** 2026-07-16
**Companion files (same folder, read both before writing code):**
- `RADlab-Onboarding-Redesign-V1-Dev-Spec.md` — full design spec, tokens, navigation map, designer rationale
- `onboarding-redesign-v1-navigation-map.json` — machine-readable version of the same

**Figma source:** `https://www.figma.com/design/PA9HnpqCEwwc8DDm8gvzhC/RADlab---Onboarding-Redesign-v1`
Visual truth: `New/Revised Screens` page. Navigation truth: `Demo` page. Tokens: `Design System` page.

---

## Approved changes not yet in Figma

These decisions were made after the Figma file was finalized. The Figma file has NOT been updated. Where this brief conflicts with Figma, this brief wins.

1. **Hero headline (About page, both Guest and User variants):**
   - Figma reads: "How sharp is your mind?" (with "mind?" in pink)
   - Ship instead: **"Your mind, reflected"** with **"reflected"** in `#F068A4`
   - Same type treatment as the Figma hero (DM Serif Display, existing hero size and tracking). The line is much shorter than the original; keep it centered and confirm hero vertical spacing still looks balanced at 1440 and at mobile sizes.

---

## Phase 0 (do first): Design-system drift audit

Before changing any screens, audit the existing codebase against the consolidated design system and write the results to `design-audit/DRIFT-REPORT.md`. Do not fix anything in this phase; report only. The report is reviewed by a human before Phase 1.

Reference values (from Dev Spec section 1; verbatim source of truth):

- **Color tokens (8):** `#FCF0F5` base, `#FFFFFF` surface, `#FBEAF3` tint, `#F068A4` primary, `#C04A82` primary-dark, `#1C1C1E` text-main, `#6B6C70` text-secondary, `#ABADB0` text-muted
- **Type scale:** 12 / 14 / 16 / 20 / 28 / 36 px only. Families: DM Serif Display 400 (display), DM Sans 400/600 (body/UI), Space Mono 400 (utility). Line-height 150%, letter-spacing 0.
- **Radii rule:** clickable buttons = 24px; eyebrow labels and cards/panels = 12px. No other radii without justification.

Audit steps:

1. Inventory all color values (hex, rgb, hsl, Tailwind arbitrary values, CSS vars) across the codebase. List every value not in the 8 tokens, with file paths and usage counts. Flag near-misses (e.g. off-by-one pinks) separately from intentional exceptions (e.g. game-internal art).
2. Inventory all font-size declarations. Map each to the 6-step scale; list violators with file paths. Known context: the designer found 18 distinct sizes in shipped CSS (e.g. 17.6 vs 18.4, 12 vs 12.8), so expect a long list. The About page Large Hero is a sanctioned exception (per-screen CSS wins; see Dev Spec 1.2 caveat).
3. Inventory font families and weights. Flag anything other than DM Serif Display 400, DM Sans 400/600, Space Mono 400.
4. Inventory border-radius values. Classify each element as clickable or not; flag clickable elements not at 24px and labels/cards not at 12px.
5. Check header implementation: is there one shared Header component used on every route? List routes with divergent or missing headers.
6. Summarize: table of violation counts by category, ordered by estimated fix effort.

## Phase 1: Tokens

Wire colors, fonts, and radii into `tailwind.config.js` per Dev Spec 1.1-1.3 (suggested keys are given there). Migrate existing styles to tokens where the drift report shows near-miss duplicates.

## Phase 2: Primitive components

`Button/PrimaryCTA` (BgPink, BgWhite, Inactive), `Button/SecondaryCTA`, `ButtonNav`, `EyebrowLabel`, `FillableBox`, `Checkbox`, `NavigationIcon`, `Header` (Guest, User), `OnboardingNavigation`. Build responsive from the start (Dev Spec section 6).

**Reconcile before building:** this is a live site with an existing component library. For each component, check whether an equivalent exists; prefer extending it. If a Figma component conflicts with an existing one (props, structure, naming), STOP and flag the mismatch for a human decision. Do not silently duplicate or overwrite.

## Phase 3: Auth screens

Signup/Join, EmailConfirmation, Login. Per Dev Spec 3.2. Key rules:
- Inactive/Active button states = one page with real per-input validation, not two screens, not a single toggle (Dev Spec 3, DISSOLVE note)
- EmailConfirmation must show the actual entered email from Supabase auth state, never the `[email]` placeholder
- Exit button (top-left of box) = history back, not a hardcoded route
- All "sign in" copy becomes "log in"

## Phase 4: Onboarding flow

Welcome → Data → Demographics → Ripple → Finish, per Dev Spec 3.3. Key rules:
- Shared OnboardingNavigation: Previous bottom-left, Next bottom-right, Next gated by per-step validation
- Ripple step: use the EXISTING live Ripple customization component and CSS. The Figma frames use placeholder screenshots; do not rebuild from them.
- Finish CTA label binds to chosen Ripple name: "Check-in with [Name] →"
- Mobile: 1-10 scale and swatch rows are flagged responsive risks; see Dev Spec 6.3 and the open questions below

## Phase 5: About page

Header, hero (with the approved new headline above), games carousel (real game images, not placeholder screenshots), info/benefit sections, CTA banner, footer. Responsive stacking per Dev Spec 6.3.

## Phase 6: Wiring and QA

Wire Finish CTAs to check-in flow and Dashboard. QA against Dev Spec sections 3 (navigation map), 5 (integration checklist), and 6 (each breakpoint).

---

## Guardrails (do not proceed without human confirmation)

1. **Guest Dashboard/Games previews do not exist yet.** The consistent-header rule shows Dashboard and Games to guests as preview-only, but no guest versions of those screens are designed or built. Render the nav items; do NOT invent preview pages. Confirm scope before building anything there.
2. **Login success routing.** The Figma demo wires Login(Active) → Onboarding for prototype purposes. Real behavior: route via Supabase session (new user → onboarding, returning user → Dashboard). Confirm the exact session check before coding.
3. **Component conflicts** (Phase 2 rule): flag, do not overwrite.
4. **Never ship placeholder screenshots** (game cards, Ripple screens, `[email]`).
5. **Disabled-button style:** designer is flexible between grayscale→pink and the current live style. Pick whichever is less code churn and note the choice in the PR description.

## Open questions (answer before the relevant phase)

- 1-10 scale on mobile: wrap, horizontal scroll, or segmented control? (designer input needed, Phase 4)
- Ripple swatch rows on mobile: grid or horizontal scroll? (designer input needed, Phase 4)
- Mobile header: keep Join free / avatar outside the drawer? (Phase 2)

## Working conventions

- React + JavaScript, Tailwind, Supabase, GitHub → Vercel (Dev Spec section 0)
- One phase per PR/commit series; stop at the end of each phase for review
- Phase 0 drift report is a hard gate: no screen work until it is reviewed
