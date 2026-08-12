# Design-System Drift — re-audit, 2026-08-12

**Baseline:** `design-audit/DRIFT-REPORT.md` (Phase 0, 2026-07-16) and its §9 gate rulings.
**Spec:** `resources/designhandoff/RADlab-Onboarding-Redesign-V1-Dev-Spec.md` §1; live summary in `website.md` §9.
**Method:** same regex inventory over `src/` (now **337 files**, was 283) — hex/rgb literals, `font-size`/`fontSize`, `font-weight`, `font-family`, `border-radius`. Plus a second pass restricted to files **added or modified since the audit commit** (`5f4d5d0`), which is where drift *introduced after the ruling* shows up. Raw data regenerated; not committed (the July CSVs remain the archived baseline).

**Comparability caveat:** the scanner is a re-implementation, not the original script. Totals are within a few percent of July's and the deltas are real, but treat ±5% as noise.

---

## 1. What Phase 1 actually fixed (verified live in the tree)

| Ruling (July §9) | Status now |
|---|---|
| Load DM Sans 600; migrate **all** 500 → 600 | ✅ **Done.** `font-weight: 500` and `font-medium`: **0 occurrences** site-wide (was 135). `index.css` loads 400/600 only. |
| Merge `--tx3` into text-muted (`#ABADB0`) | ✅ Done — one line in `index.css`; the 365 remaining `var(--tx3)` call sites now resolve to the token. |
| Semantic error tokens | ✅ `--err-bg/--err-bd/--err-tx` exist and are mirrored in `tailwind.config.js` as `error-bg/error-border/error-text`. |
| Retire `--fs-mono-md` (13) and `--fs-body-lg` (18) | ✅ Redefined to 14/16. Residual alias uses: `--fs-mono-md` 7, `--fs-body-lg` 4. |
| Radii: 24px = buttons | ✅ **3 → 38 uses**, and the four `components/ui` button primitives carry it. |
| Study-infra palette migration (Phase 1b) | ✅ Largely done — `MidpointStep`'s 14 `system-ui` declarations are gone; study-infra non-token colours fell ~400 → **114**. |

That is a real, measurable improvement, and the token layer itself is now sound.

---

## 2. Where it has drifted since — the actionable list

### 2.1 🔴 13px is regrowing, post-ruling

The ruling was **13 → 14**. Instead:

| | July 16 | Aug 12 |
|---|---|---|
| `13px` declarations | 353 | **401** |
| below the 12px floor (11/10/9/8) | 323 | **372** |
| type-scale compliance | 49% | **44%** |

**20 files added since the audit introduce fresh 13px**, including all of Field Guide (`GapBrowser` 15, `WikiPage` 10, `ReviewQueue` 6), `InsightsWidget`, `SettingsPage`, `MyRipplePage`, `Talks`, `Diagnostics`, and the three new sense-foraging games. Off-scale sizes in *newly added* non-game files total **174**, dominated by 13px (72) and 11px (37).

Root cause is not disagreement with the ruling — it's that nothing carries it. The ruling lives in a markdown file; every new surface is hand-styled with inline `style={}` objects and 13px is what the surrounding code looks like. **This is the finding that matters**: without a mechanical guard the scale will keep eroding at roughly the rate new pages ship.

### 2.2 🟠 Sub-12px text is the accessibility one

372 declarations below the site's own WCAG floor, concentrated in **admin (158)**, study-infra (58), lecture-lounge (46). Worst files: `TrainingUpload` 15, `SessionBuilder` 12, `StudyDetail` 11, `WikiIndex` 10, `InsightsWidget` 10, `DataExportPage` 10, `VasPackageBuilder` 10. Admin is internal and exempt-ish, but `InsightsWidget` is on the participant dashboard and `InterventionPage` (8) is participant-facing.

### 2.3 🟠 No spacing scale exists — so "margins" cannot drift *from* anything

You asked about margins specifically. The spec defines colour, type and radii; **it defines no spacing or layout scale at all**. The visible consequence is that the main authenticated pages don't share a container:

| Page | max-width | padding |
|---|---|---|
| Dashboard | 1100 | `48px 32px` |
| Games | 1024 | `32px 24px 72px` |
| Platform (About) | 1200 | — |
| Talks | 960 | — |
| UI Kit | 900 | `32px 24px 80px` |

Navigating Dashboard → Games shifts the content column by 76px and the top padding by 16px. That is a genuine perceptible inconsistency, but it is a **spec gap, not a violation** — nothing to enforce until a container/spacing token is decided.

### 2.4 🟡 Colour: flat, not worse

803 hard-coded copies of the 8 tokens (was 805) — unchanged; still pure mechanical cleanup. Near-miss off-palette values in non-game code total **82 occurrences**, 68 of them in files touched since the audit — but they are almost entirely **admin status tints** (`#fff0f0` ×16, `#fff5f0` ×11, `#fdf2f8` ×6, `#fef2f2` ×4), i.e. the semantic-colour gap that §9 Q2 deliberately deferred for admin. Platform-core non-token colours: 235.

### 2.5 🟡 Font families: values fine, structure fragile

Genuinely off-brand stacks are now down to ~10 (OwlBarn/PondWatch `system-ui`, BreathGuardian `ui-rounded`, two email-preview `srcDoc` iframes where `sans-serif` is correct, VideoTest). But the brand stacks are **re-declared as local `const MONO/SERIF/SANS` in ~40 separate files**, and they have already diverged in fallbacks (`'Space Mono', 'Courier New', monospace` vs `'Space Mono', monospace`). There is no shared export.

### 2.6 🟡 `font-weight: 800` — 8 uses, all `BreathGuardian.jsx`

Not loaded, not in the spec: the browser synthesises faux-bold. Game-internal, so low priority, but it's the only weight violation left in the tree.

### 2.7 🟡 Primitive adoption is narrow

`components/ui/*` (PrimaryCTA, SecondaryCTA, ButtonNav, EyebrowLabel, FillableBox, Checkbox, CredentialsBox, NavigationIcon, OnboardingNavigation) is imported by **9 files**: the four auth pages, Dashboard, GamesPage, PlatformPage, WelcomeFlow, UiKit. Everything built since — Field Guide, Talks, Settings, MyRipple, Workbench, the three new games' chrome — hand-rolls its buttons. Hence `borderRadius: 8` on the Nav account-menu items, `fontSize: 15` on the Nav avatar initial, and 27 fresh `24px` radii typed by hand in new files rather than inherited.

---

## 2.8 Where the system is written down — and the fourth surface

Four artefacts claim to describe the design system, and they disagreed:

| Surface | Holds |
|---|---|
| Figma `Design System` page (`0:1`) | Style Tile (palette + type) and a **Components** section of 24 components |
| `resources/designhandoff/…Dev-Spec.md` §1 | The written spec — tokens, type scale, radii rule |
| `website.md` §9 | Prose summary, kept current with the code |
| **`/brand`** | Was a press kit only: logos, palette, fonts |

`/brand` is the one people actually get sent, and it carried **neither the type scale, nor the radii rule, nor the border tokens** — the three things this audit measures against. Someone reading it as the spec would have had no way to know 13px was wrong or which border colour to use. It was also, itself, among the less compliant pages: 7 off-scale font sizes and 2 below the 12px floor, in the CSS block that styles the page documenting the floor.

**Resolved 2026-08-12** — `/brand` promoted to the full design-system page (§9 of `website.md` for what it now carries). It is scale-compliant, verified by rendering it headless and reading `getComputedStyle` on every element: all font sizes on the six steps, only 12px/24px/50% radii. Its *Implementation status* section carries §1–§2 of this report in short form, dated and sourced, so a reader sees the gap rather than an implied claim of compliance.

Two documentation conflicts surfaced while reconciling the four:

1. ~~The Figma Style Tile's **Body** table lists 12 / 14 / 12~~ — **resolved (Norm, 2026-08-12): the written spec is authoritative.** Where the Style Tile and the Dev Spec disagree, the spec wins; the tile's Body table (12 / 14 / 12, with its roles copied verbatim from the Display table) was an authoring slip and is corrected in the current Figma. The code and `/brand` already followed the spec's **16 / 14 / 12**, so nothing changes in implementation. Per-screen CSS still wins over both where a screen deliberately differs — the About-page Large Hero remains the standing exception.
2. The Dev Spec names three Figma pages — `New/Revised Screens`, `Demo`, `Design System` — and describes **`Demo` as the source of truth for navigation wiring**. The file now has two pages; `Demo` is gone. Any future reader following the spec to resolve a navigation question will find nothing there.

And the component gap, which is the structural cause of §2.7: **16 of the 24 Figma components have no shared implementation.** `Header` is one component in the design and 20+ per-page `Nav` mounts in code. `ToggleSwitch` / `ToggleSetting` / `SettingOptions` / `Dropdown` carry the highest node IDs in the file (2061–2071), i.e. they were added most recently, and they are precisely the vocabulary of a settings screen — yet `/settings` shipped hand-rolled, re-declaring the font stacks 19 times locally. Design is running ahead of code, and each unbuilt component is a licence to hand-style.

---

## 3. Recommended order

1. **Make the scale mechanical, not documentary.** A lint rule (or a `stylelint`/ESLint check on `fontSize:` literals not in `{12,14,16,20,28,36}` outside `src/games/`) would stop 2.1 dead. Everything else is cleanup; this is the only item that changes the trajectory.
2. **Export the font stacks once** (`src/lib/fonts.js` or three CSS vars) and delete the ~40 local copies as files are touched.
3. **Decide a spacing/container token** — even just "page container = 1100 / `48px 32px`" — so 2.3 becomes enforceable.
4. **Floor the sub-12px text on participant-facing surfaces** (`InsightsWidget`, `InterventionPage`, `ScreenerPage`); leave admin.
5. Opportunistic: 800 → 600 in BreathGuardian; admin semantic tints → tokens when admin gets its cleanup pass.

Nothing here is a blocker and nothing regressed in the token layer. The single real trend is 2.1.
