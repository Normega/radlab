# RADlab — Onboarding Redesign v1 · Developer Handoff & Navigation Spec

> **Purpose of this document.** A single-source-of-truth spec to accompany the Figma file, written to be read by (or fed into) an AI coding agent to implement the redesign on the live site. It contains: the design-system tokens, a screen-by-screen navigation map, the designer's rationale/notes, and integration warnings.
>
> **Read this first — how the Figma file is organized:**
> - **`New/Revised Screens`** — the source of truth for *visual design*. Build the screens to match these frames. (Contains "Notes" text blocks for each section — integrated below.)
> - **`Demo`** — the source of truth for *navigation / prototype wiring*. Use this to understand what every button does and where it goes. Do **not** treat the Demo frames as the visual target (some use placeholder screenshots).
> - **`Design System`** — Style Tile + Components (buttons, cards, inputs, etc.).
>
> **Figma file:** `https://www.figma.com/design/PA9HnpqCEwwc8DDm8gvzhC/RADlab---Onboarding-Redesign-v1`
> Deep-link any screen by appending `?node-id=<id>` (node IDs are listed per-screen below).

---

## 0. Target stack (implementation context)

This spec is written assuming the following stack. Where relevant, implementation notes are tailored to it.

- **Framework:** React + JavaScript
- **Styling:** CSS with Tailwind (+ font plugins)
- **Data / auth:** Supabase
- **Source / deploy:** GitHub → Vercel (custom domain)
- **AI-assisted dev:** Claude (JSON-based workflows scale well)

A machine-readable companion file — [`navigation-map.json`](navigation-map.json) — accompanies this doc. It encodes every screen, element, and route so you can feed it directly to an agent.

---

## 1. Design System / Tokens

These are the real values pulled from the Figma variable collection ("RADlab") and text styles. Use them verbatim — ideally wired into `tailwind.config.js` as theme tokens so screens stay consistent.

### 1.1 Color tokens

| Token name | Hex | Suggested Tailwind key | Usage |
|---|---|---|---|
| Background/Base | `#FCF0F5` | `bg-base` | Page background (soft pink) |
| Background/Surface | `#FFFFFF` | `bg-surface` | Cards, modals, input surfaces |
| Background/Tint | `#FBEAF3` | `bg-tint` | Subtle tinted fills / section blocks |
| Primary/Pink | `#F068A4` | `primary` | Primary CTA fill, active accents |
| Primary/Pink Dark | `#C04A82` | `primary-dark` | Hover/pressed, darker accents |
| Text/Main | `#1C1C1E` | `text-main` | Headings & body |
| Text/Secondary | `#6B6C70` | `text-secondary` | Supporting copy |
| Text/Muted | `#ABADB0` | `text-muted` | Placeholders, disabled text |

```js
// tailwind.config.js — theme.extend.colors
colors: {
  base:        '#FCF0F5',
  surface:     '#FFFFFF',
  tint:        '#FBEAF3',
  primary:     '#F068A4',
  'primary-dark': '#C04A82',
  'text-main':      '#1C1C1E',
  'text-secondary': '#6B6C70',
  'text-muted':     '#ABADB0',
}
```

> **Inactive/disabled buttons:** the designer used a **grayscale** version of the primary button for the "fields not filled out yet" state. See §4 note — you may either implement the grayscale→pink transition or keep the current live design for disabled states. Designer is explicitly flexible here.

### 1.2 Typography

Three families, each with a distinct role. All use 150% line-height and 0% letter-spacing in the file.

| Style role | Font family | Weight | Sizes in use | Tailwind/CSS notes |
|---|---|---|---|---|
| **Display** (headings) | **DM Serif Display** | Regular (400) | 36 / 28 / 20 | Serif — headlines & titles |
| **Body** (UI + copy) | **DM Sans** | Regular (400) & SemiBold (600) | 16 / 14 / 12 | Default UI/body text |
| **Utility** (labels/mono) | **Space Mono** | Regular (400) | 20 / 14 / 12 | Eyebrow labels, tags, stat/mono text |

Named text styles from the file (`role/weight/size`):
`display/400/36`, `display/400/28`, `display/400/20` ·
`body/400/16`, `body/400/14`, `body/400/12`, `body/600/16`, `body/600/12` ·
`utility/400/20`, `utility/400/14`, `utility/400/12`

**Font loading:** all three are Google Fonts. With your font plugin, load: `DM Serif Display` (400), `DM Sans` (400, 600), `Space Mono` (400). Note DM Sans SemiBold = weight 600.

```js
// example: next/font or a font plugin
// DM Serif Display: 400
// DM Sans: 400, 600
// Space Mono: 400
```

> **⚠️ The scale above is a consolidation, not a complete inventory.** Some text on the new screens still uses sizes **outside** this consolidated scale — e.g. the **Large Hero** on the About page. These instances are rare but they do exist. **Use the actual CSS of each screen when developing**, rather than treating this style tile as a complete fit. (Pulling from the screen CSS is also likely to integrate more cleanly with the live version of the site.) In short: this scale is the default/reference; the per-screen CSS wins where they differ.

### 1.3 Shape / radii (important design-system rule)

The designer standardized clickable affordances by radius — **this is consistent across all new screens** and should be treated as a rule:

- **Buttons → `border-radius: 24px`** (all clickable buttons)
- **Eyebrow labels *and* cards → `border-radius: 12px`** (non-clickable tags/labels, and card/panel containers)

> Rationale (designer's note): differentiating the corner radii makes clickable buttons standardized and more obviously clickable, versus decorative labels and containers. The larger 24px radius is reserved for clickable buttons; the 12px radius is the shared radius for eyebrow labels and cards.

### 1.4 Component inventory (from Design System → Components)

These exist as Figma components/variants. Build them as reusable React components.

> **⚠️ Reconcile with existing components before building new ones.** This project is a redesign of a *live* site that already has its own component library. Several components below likely correspond to components that already exist in the developer's codebase (buttons, inputs, header, checkboxes, cards, the Ripple customizer, etc.). **Before generating a new component, check whether an equivalent already exists** — and if so, prefer extending/restyling the existing one over creating a duplicate. If a Figma component conflicts with an existing one (different props, structure, or naming), **flag the mismatch rather than silently overwriting** — surface it for a human decision on whether to adapt the redesign to the existing component or refactor the existing component to the new design. This keeps the redesign compatible with the live codebase and avoids fragmenting the component library.

| Component | Variants | Notes |
|---|---|---|
| `Header` | Guest, User | Global nav. Must be **consistent across the whole platform regardless of auth state** (see §2 note). |
| `Button/PrimaryCTA` | BgPink, BgWhite, Inactive | Primary action. 24px radius. Inactive = grayscale. |
| `Button/SecondaryCTA` | BgNoFill | Outline/text button. |
| `ButtonNav` | Active, Inactive | Nav-style button. |
| `EyebrowLabel` | BgPink, BgWhite, NoBg | 12px radius label/tag. |
| `NavigationIcon` | Close, Back | The exit/back affordance (top-left of auth boxes — see §3). |
| `OnboardingNavigation` | OnlyL, OnlyR, BothButtons | Prev (bottom-left) / Next (bottom-right) control bar. |
| `FillableBox` | Inactive, Active | Text input field. Has a background fill for contrast (see §4). |
| `Checkbox` | Active, Inactive | Consent checkboxes (Data step). |
| `Question` | SingleSelect, Scale | Demographics questions incl. 1–10 scale. |
| `CredentialsBox` | — | Login/signup form container. |
| `GameCard` | Default, first-contact, pond-watch, ebb-flow | Game preview cards (About page carousel). |
| `GamesCarousel` | Default | Horizontally-scrolling games preview. |
| `GameImage` | FirstContact, PondWatch, EbbFlow | ⚠️ Placeholder screenshots — see integration warnings. |
| `InfoCard` / `InfoBox` / `BenefitCard` / `OnboardingInfo` | — | Content/marketing cards. |
| `RADLabLogo` | Outlined, Default | Logo; links home. |
| `Icon` | Pattern, Pencil, Clock | Iconography. |

---

## 2. Global navigation & platform rules

Rules that apply platform-wide, drawn from the designer's notes:

1. **Consistent header everywhere.** The navigation header is the same regardless of account status. It shows **Dashboard** and **Games** *even for guests* (these are **preview-able but not interact-able** until an account exists), plus an **About** entry.
   - **⚠️ Not yet built:** there is currently **no Guest version of the Dashboard and Games screens** in the live version. Those guest-preview designs would be **planned/created only if this consistent-header approach is given the green light.** Until then, treat guest Dashboard/Games as a forward-looking intention, not an existing screen to wire up — don't block the redesign waiting on them, and confirm scope before building guest-preview states for those two pages.
2. **About page is now reachable from the nav.** Previously the landing/platform page (`radlab.zone/platform`) was not accessible from the nav — users had to go back to `radlab.zone` and re-enter. Keep About in the nav permanently (even post-signup) so users can revisit platform info anytime.
   - There are two About variants: **`AboutPage(Guest)`** and **`AboutPage(User)`** — same layout, header reflects auth state.
3. **Logo → home** (`radlab.zone/`) on every screen that has the header.
4. **Back buttons** in the Demo use Figma's native *BACK* action = "return to the previously visited screen," **not** a hardcoded route. Implement as browser/router back (or history-aware), not a fixed link.

---

## 3. Navigation Map — screen by screen

Derived from the **Demo** page prototype wiring (every clickable element traced to its destination). Transitions noted where the prototype uses a non-instant transition (e.g. `DISSOLVE`); these are usually state changes on the same screen, not route changes.

> **⚠️ Critical — how to read the `DISSOLVE` / Inactive→Active state swaps.** In the prototype, a single click that dissolves an "Inactive" screen into its "Active" counterpart is **shorthand**. It compresses two things into one click: the state of the page **when the user first arrives** (Inactive — required inputs empty, Next/continue button disabled) and the state of the page **once all required inputs are satisfied** (Active — button enabled). It does **not** mean "one click flips the whole page."
>
> **In the live build, these are the same page**, and reaching the Active state typically requires the user to **interact multiple times** on that one page — filling each field, checking each consent box, answering each question — before the enabled (Active) continue button appears. Implement each Inactive/Active pair as **one screen with real, per-input validation state**, not as two screens and not as a single toggle. The Active frame simply shows the "all requirements met" end-state; the Inactive frame shows the empty arrival state.

**Legend:** `NAVIGATE` = go to screen · `BACK` = history back · `SCROLL_TO` = in-page anchor scroll (not a route) · `(state)` = the same logical screen; Inactive is the empty arrival state, Active is the all-inputs-satisfied end-state. Reaching Active is gated by real per-input validation (usually several interactions), **not** a single click.

### 3.1 Marketing / Landing

**`radlab.zone/` (home)** — node `2001:1413`
- Body/preview click → **AboutPage(Guest)**

**`AboutPage(Guest)`** — node `2001:1372` (visual target: `New/Revised → 111:147`)
- Logo → `radlab.zone/`
- Nav button → scrolls to **Hero** section (`SCROLL_TO`, in-page)
- Secondary CTA → scrolls to **About** section (`SCROLL_TO`, in-page)
- Secondary CTA (header) → **Login(Inactive)**
- Primary CTA (×3 on page) → **Signup/Join(Inactive)**

**`AboutPage(User)`** — visual target `New/Revised → 170:514` (logged-in variant of About).

### 3.2 Auth — Signup & Login

All auth screens share the global header (Logo, nav icon → About) and a **top-left exit button** on the box that returns to About / the previous page.

**`Signup/Join(Inactive)`** — node `2001:1368` (visual: `153:321`)
- Fill fields → each field click swaps to **Signup/Join(Active)** (`state`, DISSOLVE)
- Secondary CTA → **Login(Inactive)**
- "AlternativeLink" (log in instead) → **Login(Inactive)**
- Logo → `radlab.zone/` · Nav icon → About

**`Signup/Join(Active)`** (fields filled) — node `2001:1365` (visual: `153:866`)
- Primary CTA → **Signup/EmailConfirmation**
- Secondary CTA / AlternativeLink → **Login(Inactive)**

**`Signup/EmailConfirmation`** — node `2001:1362` (visual: `153:560`)
- Primary CTA → **Login(Inactive)**
- Secondary CTA → **Login(Inactive)**
- ⚠️ Copy contains a literal `[email]` placeholder — the live version injects the real email the user entered. **Preserve the live behavior**, don't ship the placeholder.

**`Login(Inactive)`** — node `2001:1359` (visual: `153:742`)
- Fill fields → swaps to **Login(Active)** (`state`, DISSOLVE)
- Primary CTA → **Signup/Join(Inactive)** *(prototype wiring; verify intended real target on submit — likely Dashboard/onboarding on success)*
- AlternativeLink (sign up instead) → **Signup/Join(Inactive)**

**`Login(Active)`** (fields filled) — node `2001:1356` (visual: `170:769`)
- Primary CTA → **1. Onboarding/Welcome** *(demo routes new-user login into onboarding)*
- Nav icon → About · Logo → home

> **Auth note (designer):** buttons have an **inactive state** until required fields are filled. Tagline on signup changed to **"Free-to-play perception games"** (was "Free account no credit card needed"). All "sign in" copy standardized to **"log in"** (distinct from "sign up").

### 3.3 Onboarding (new 5-step structure)

**Flow:** Welcome → Step 1 Data → Step 2 Demographics → Step 3 Ripple → Finish → (into first Check-in or Dashboard).
Each step: **Next** button bottom-right, **Previous** button bottom-left. Inactive→Active states gate the Next button on required input.

**`1. Onboarding/Welcome`** — node `2001:1353` (visual: `170:990`)
- Eyebrow label reads **"RADLAB GAMES PLATFORM"**
- Primary CTA (Next) → **2. Onboarding/Data(Inactive)**

**`2. Onboarding/Data(Inactive)`** — node `2001:1349` (visual: `170:1201`) — Data Privacy / TOS, **Step 1 of 3**
- Consent checkbox(es) click → swaps to **Data(Active)** (`state`, DISSOLVE)
- Previous → BACK
- (Primary CTA inactive until consent given)
- Consent checkboxes are **right-aligned** to line up with the "Agree & continue" button.

**`2. Onboarding/Data(Active)`** — node `2001:1345` (visual: `187:1927`)
- Previous → **1. Onboarding/Welcome**
- Primary CTA (Agree & continue) → **3. Onboarding/Demographics(Inactive)**

**`3. Onboarding/Demographics(Inactive)`** — node `2001:1329` (visual: `187:1328`) — **Step 2 of 3**
- Answering questions (Box / Options / SingleSelect / Scale) → swaps to **Demographics(Active)** (`state`, DISSOLVE)
- Previous → BACK
- Fillable field boxes and the 1–10 single-select scale have a **background fill** for contrast against the page.

**`3. Onboarding/Demographics(Active)`** — node `2001:1313` (visual: `187:2428`)
- Previous → **2. Onboarding/Data(Active)**
- Primary CTA (Next) → **4. Onboarding/Ripple(Inactive)**

**`4. Onboarding/Ripple(Inactive)`** — node `2001:1291` (visual: `187:2611`) — Meet your Ripple, **Step 3 of 3**
- Customization/name interaction → swaps to **Ripple(Active)** (`state`, DISSOLVE)
- Previous → BACK
- (Next inactive until Ripple named)
- ⚠️ Ripple screens use **live-version screenshots as placeholders** — use the existing live CSS for Ripple avatar customization, not these images.

**`4. Onboarding/Ripple(Active)`** — node `2001:1269` (visual: `187:2743`)
- Previous → **3. Onboarding/Demographics(Active)**
- Primary CTA (Next) → **5. Onboarding/Finish**

**`5. Onboarding/Finish`** — node `2001:1256` (visual: `187:2837`) — success screen
- Primary CTA → **Checkin/q1** (label is dynamic: **"Check-in with [Name] →"**, using the Ripple's chosen name)
- Secondary CTA ("Go to Dashboard") / Previous → **Dashboard** (`(member) https://radlab.zone/dashboard`)

### 3.4 Post-onboarding Check-in loop

Optional check-in task (removed from mandatory onboarding, now offered at Finish and on the Dashboard).

**`Checkin/q1`** — node `2001:1426` → click → **Checkin/q2**
**`Checkin/q2`** — node `2001:1423` → click → **Checkin/result**
**`Checkin/result`** — node `2001:1420` → click → **Checkin/intention**
**`Checkin/intention`** — node `2001:1417` (end of loop)

**`Dashboard`** — `(member) https://radlab.zone/dashboard`, node `2005:2992` — member home. Onboarding Finish and the check-in flow resolve here.

### 3.5 Route map (flow overview)

```
radlab.zone/
   └─▶ AboutPage(Guest) ──┬─▶ Signup/Join ──▶ EmailConfirmation ──▶ Login
                          └─▶ Login ─────────▶ (success) ──▶ Onboarding

Onboarding:  Welcome ─▶ 1·Data ─▶ 2·Demographics ─▶ 3·Ripple ─▶ Finish
                (Prev ◀── at each step; Next gated by Active state)

Finish ─┬─▶ Check-in ( q1 ▶ q2 ▶ result ▶ intention )
        └─▶ Dashboard

Global header (all screens): Logo▶home · About · Dashboard* · Games*
   (* preview-only for guests)
```

---

## 4. Designer's Notes — verbatim rationale (integrated by section)

These are the notes authored on the `New/Revised Screens` page. They explain *why* changes were made — useful context for judgment calls during implementation.

### 4.1 New "About" Page

**Modifications**
- Navigation header made consistent throughout the entire platform (regardless of account status). It now features "Dashboard" and "Games" even when the guest has not signed up yet (these pages will be preview-able, but not interact-able until an account is made). It also now has an "About" page, which is how users access this page; previously the Landing Page (`radlab.zone/platform`) was not accessible from the nav bar — users had to go back to `radlab.zone` and press into the Games Platform to see it again. Keeping this "About" page (even after signup) lets users view platform info anytime via the nav bar.
- **Games preview:** condensed into a horizontally-scrolling carousel. Feel free to add game cards and/or make the carousel infinite when shipping.
- **Copy changes:** edits to better educate on what the platform is and its benefits; minor edits to CTA buttons and banners.

**Removed**
- **Latest Session box** — (1) took valuable space at the top where attention is highest; (2) its info (jargon/stats) may confuse new users lacking context.
- **Leaderboard** — (1) landing-page language should center on personal awareness; a leaderboard implies competition over contemplation; (2) currently shows "you normf" as active user in the live version, which may confuse; (3) it's a gamification tool — possibly better placed on the Dashboard (post-signup).
- **"Who's This For?" section** — reduces redundancy; explaining what the site offers already covers who it's for. Study participants and lab members already have that context.

**Design System**
- Differentiated corner radii: **buttons 24px**, **eyebrow labels 12px**, so clickable buttons are standardized and clearly clickable. Consistent across all new screens. *(Editor's note: the 12px radius also applies to cards/panels — see §1.3.)*

**Integration ⚠️**
- Game-card images (First Contact, Pond Watch, etc.) are **screenshots** from the platform. If pasting this screen's CSS into Claude, **use the original images**, not the placeholder screenshots.

### 4.2 Signup & Login

**Modifications**
- Introduced an **inactive state** for main buttons when fields aren't filled out.
- Changed signup tagline from "Free account no credit card needed" → **"Free-to-play perception games"**.
- Standardized copy: all "sign in" → **"log in"** (to differentiate from "sign up").
- Added an **exit button** at the top-left of the box on each screen. It should navigate back to the About page — or whatever page the user was on before starting the signup/login flow.

**Integration ⚠️**
- On `Signup/EmailConfirmation`, copy has the placeholder **`[email]`**. The live version grabs the previously-entered email — **preserve that**, don't use the placeholder.

### 4.3 Onboarding

**Modifications**
- Eyebrow label changed to **"RADLAB GAMES PLATFORM"** on the Welcome screen.
- Primary **"Next"** button (and related phrasing) always **bottom-right**; **"Previous"** button (when present) always **bottom-left**.
- Consent checkboxes on the Data step made **right-aligned** to line up with the "Agree & continue" button.
- Added a **background fill** for the fillable field boxes and the 1–10 single-select scale on Demographics, for more contrast against the background.
- **New onboarding structure:** Welcome → Step 1 of 3: Data Privacy / TOS → Step 2 of 3: Demographics → Step 3 of 3: Meet your Ripple → Finish.

**New structure — reasoning**
- **Removed Check-in from onboarding.** It made the flow too long; prior eyebrow labels ("Step 1 of 2", "Step 2 of 2") implied a shorter process than reality — they only covered data & demographics, but were then followed by "ALMOST THERE", "ONE LAST THING", and four more Still Water check-in screens before onboarding actually ended.
- **Combined the Ripple screens into one step** (avatar customization and naming were previously separate). The primary Next button on the Finish page stays **responsive to the Ripple's chosen name** (e.g. "Check-in with [Name] →").
- **Added a Success (Finish) page** to clearly signal onboarding is done. Its main CTA leads directly into the check-in task that was removed from the mandatory flow. The secondary CTA is **"Go to Dashboard"** (also featured at the top of the page for a check-in). Both paths strongly suggest a check-in without making it mandatory (which fatigues users).

**Integration ⚠️**
- The **Ripple screens largely use live-version screenshots** in this demo. If pasting this screen's CSS into Claude (or instructing your agent), **use the existing live CSS for the Ripple customization**, not the placeholder screenshots.
- There are **inactive/active states** per screen using a **grayscale inactive button** that becomes active when required fields are filled. Feel free to implement the grayscale→pink transition, or keep the current live design for these states.

---

## 5. Integration warnings — quick checklist

Consolidated so nothing gets missed when generating code:

- [ ] **Do not ship placeholder screenshots.** Game-card images (About) and the **Ripple customization** screens are live-site screenshots used as placeholders. Wire in the real components/images/CSS.
- [ ] **`[email]` placeholder** on EmailConfirmation must be replaced by the actual entered email (Supabase auth state).
- [ ] **Dynamic Ripple name** — Finish page CTA reads "Check-in with **[Name]** →"; bind to the user's chosen Ripple name.
- [ ] **Radii rule** — buttons 24px; eyebrow labels **and cards** 12px, everywhere.
- [ ] **Header consistency** — same header for guest and user; Dashboard/Games are preview-only (visible, not interactive) for guests.
- [ ] **Back = history back**, not a hardcoded route.
- [ ] **Login success target** — the demo wires Login→Signup and Login(Active)→Welcome for prototype clicking. Real behavior on successful auth should route to onboarding (new users) or Dashboard (returning users) via Supabase session — confirm before coding.
- [ ] **Disabled-button style** — designer is flexible: grayscale→pink or keep current live style.
- [ ] **Transitions / Inactive→Active** — `DISSOLVE` swaps are **shorthand for one page's arrival (empty) state vs. its all-inputs-satisfied state**, not page transitions and not a single toggle. Implement each Inactive/Active pair as **one screen with real per-input validation**; the live page usually needs **several interactions** before the Active continue button enables. Conditional state, not routing. (See §3 note.)

---

## 6. Responsive / mobile behavior

> **⚠️ Read this framing first.** The Figma file contains **desktop frames only (all 1440px wide)** — there is **no mobile artboard** in the file. Everything in this section is **recommended** responsive behavior inferred from the desktop layouts plus common-practice for a React + Tailwind build. It is **not** authored design intent. Where a layout decision is genuinely ambiguous on small screens (flagged below), get a quick call from the designer rather than letting the agent guess. If a mobile design is produced later, it supersedes this section.

### 6.1 Breakpoint strategy (Tailwind defaults)

Build **mobile-first**, then layer desktop up to the 1440px reference. Tailwind's default breakpoints are a fine target:

| Breakpoint | Min width | Treat as |
|---|---|---|
| (base) | 0 | Phone (design for ~375px first) |
| `sm` | 640px | Large phone |
| `md` | 768px | Tablet |
| `lg` | 1024px | Small laptop |
| `xl` | 1280px | Desktop |
| `2xl` | 1536px | The 1440px Figma frames sit around here |

Treat the Figma frames as the `xl`/`2xl` presentation and derive the smaller layouts down from them. Cap main content width (e.g. `max-w-[1200px] mx-auto`) so it doesn't sprawl on very wide screens.

### 6.2 Global rules for small screens

- **Type scale:** the display sizes (36/28/20) are tuned for desktop. Step them down on mobile — e.g. hero 36px → ~28px at `sm` and below; section titles 28px → ~22px. Body sizes (16/14/12) can stay. Use responsive utilities (`text-2xl sm:text-3xl xl:text-4xl`).
- **Touch targets:** minimum ~44×44px tappable area. The 24px-radius pill buttons are fine; watch the smaller affordances (checkboxes, the 1–10 scale, color swatches — see below).
- **Horizontal padding:** desktop uses generous left indentation. On mobile use a consistent gutter (e.g. `px-5`) and let content go full-width.
- **Primary/secondary CTAs:** consider full-width stacked buttons on mobile (`w-full`) instead of the desktop's right-aligned inline placement.

### 6.3 Per-screen responsive notes

**Global Header** — Desktop shows logo (left) + nav links (Dashboard, Games, About) + auth actions (Log in / Join free, or Sign out + avatar) on the right. On mobile:
- Collapse the nav links into a hamburger/drawer menu.
- Consider keeping the primary auth action (Join free / avatar) visible outside the drawer.
- Preserve the guest rule: Dashboard/Games appear but are preview-only (visually present, non-interactive) — the same applies inside the mobile menu.

**About page (Guest/User)** — long marketing page, the most layout-heavy screen:
- Hero headline ("How sharp is your mind?") scales down; keep the pink accent word.
- **Games carousel** already scrolls horizontally → this is naturally mobile-friendly (swipe). Keep it a horizontal scroll rather than stacking; make sure card width is a comfortable ~80–85% of viewport so the next card peeks.
- **"What is this"** (2-column: main text + de-identified/optional/not-clinical cards) → **stack to one column** on mobile.
- **"What you get out of it"** (3 benefit cards) → **stack to one column** (or 1-col at base, keep 3-col at `lg+`).
- Full-width pink CTA banner → keep full-bleed, reduce vertical padding.

**Auth screens (Signup/Join, EmailConfirmation, Login)** — a centered ~350px card on a pink background. These are already near mobile width, so they adapt cleanly:
- Card goes near-full-width with a gutter (`w-full max-w-[400px] mx-auto px-5`).
- Keep the top-left exit button tappable (44px).
- Header collapses per the global rule above.

**Onboarding — Welcome & Finish** — sparse, left-aligned content + button(s):
- Content full-width; consider anchoring the Next / dual CTAs to a full-width button (or bottom bar) on mobile.
- Finish's two CTAs (Go to Dashboard / Check-in with [Name]) → stack full-width, primary on top.

**Onboarding — Data (Step 1)** — two scrollable text panels (Research Participation, Terms of Use) + right-aligned consent checkboxes + Prev/Next:
- Panels stack fine.
- Keep each checkbox visually associated with its consent line; the desktop "right-aligned to the button" alignment can relax to inline-left on mobile if right-alignment crowds the text.

**Onboarding — Demographics (Step 2)** ⚠️ *main responsive risk*:
- Age / Gender fillable boxes → full-width inputs.
- Radio question → stack options vertically.
- **The 1–10 ladder scale** is the tricky part: ten numbered items in a single row **will overflow a phone**. Options, in order of preference: (a) let the row **wrap** to two lines; (b) make it a **horizontal-scroll** strip; (c) shrink to a compact segmented control. Ensure each number keeps a ~40px+ tap target. **Flag for designer** if unsure which they prefer.

**Onboarding — Ripple (Step 3)** ⚠️ *responsive risk + uses live screenshots*:
- The two swatch rows (skin tone ~15 swatches, eye color ~18 swatches) **will overflow** on mobile. Wrap them into a **grid** (e.g. 6–8 per row) or a horizontal-scroll strip; keep swatches ≥32px with adequate spacing for tapping.
- Avatar preview centers above the swatches; name field goes full-width.
- Remember: **use the live Ripple customization component/CSS**, not the placeholder screenshots — the live version may already have responsive behavior to reuse.

**Onboarding Prev/Next bar** — desktop places Previous bottom-left, Next bottom-right. On mobile keep that left/right split (it reads as back/forward), but ensure they don't collide on narrow widths — a fixed bottom bar with the two buttons at opposite ends works well and keeps Next reachable with a thumb.

**Check-in loop & Dashboard** — Dashboard is an existing live page; match its current responsive behavior rather than re-deriving it here.

### 6.4 Open questions for the designer

- 1–10 scale on mobile: wrap, scroll, or compact segmented control?
- Ripple swatch rows on mobile: grid or horizontal scroll?
- Should the mobile header keep Join free / avatar visible outside the drawer, or collapse everything?

---

## 7. Suggested implementation order

A pragmatic build sequence for an agent:

1. **Tokens first** — wire colors + fonts + radii into `tailwind.config.js`.
2. **Primitive components** — `Button/PrimaryCTA` (incl. Inactive), `Button/SecondaryCTA`, `EyebrowLabel`, `FillableBox`, `Checkbox`, `NavigationIcon`, `Header`. Build them responsive from the start (§6).
3. **Auth screens** — Signup/Join, EmailConfirmation, Login (with active/inactive gating + Supabase).
4. **Onboarding flow** — Welcome → Data → Demographics → Ripple → Finish, with a shared `OnboardingNavigation` (Prev/Next) and per-step validation gating Next. Handle the scale/swatch mobile cases (§6.3).
5. **About page** — header, hero, benefit cards, games carousel (use real game images), responsive stacking.
6. **Check-in loop + Dashboard hooks** — wire Finish's two CTAs.
7. **QA** against the navigation map (§3), integration checklist (§5), and responsive notes (§6) at each breakpoint.

---

*Generated from Figma file `PA9HnpqCEwwc8DDm8gvzhC` — navigation traced from the Demo page prototype, tokens/notes from the New/Revised Screens and Design System pages.*
