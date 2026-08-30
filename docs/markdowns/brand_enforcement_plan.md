# Brand enforcement plan

*2026-08-26. Companion to the `/brand` rebuild and the adoption of Gerold's expanded Figma
design system (`Brand_Aug26_2026.fig`, "RADLAB Official Design System"). The system is
documented at `/brand` and website.md §9; this file is about making it hold.*

## Why enforcement, not more documentation

The 2026-08-12 drift audit (`design-audit/DRIFT-REPORT-2026-08-12.md`) showed the pattern
plainly: every rule that is documented but not tooled **loses ground over time** (type scale
44% compliant and slipping, 13px up to 401 occurrences despite a migration ruling), while
every rule carried by a primitive or a token **gains ground** (weight 500 to zero, 24px radii
from 3 to 38 as the button primitives landed). The lesson: enforcement means putting the rule
somewhere code has to pass through — a token, a shared component, or a check — not writing it
down a third time.

## The adoption record (what we're enforcing)

Adopted 2026-08-26 from the Figma expansion:

- **Semantic colour layer** — Background/Text/Action/Icon/Overlay role names aliasing the
  existing eleven primitives. No new colours.
- **Named type styles** — Display/Hero 72 (sanctioned exception, one per site), Heading/1 36,
  Heading/2 28, Heading/4 20, Body/L±Emphasis 16, Body/M 14, Body/S±Emphasis 12,
  Label/XL(±Bold) 20, Label/L 14, Label/M 12.
- **Spacing scale** — 4/8/16/24/32/40/48/64, the only legal padding/gap values (`--sp-*`).
- **Effects** — one shadow (`--sh-hover`, 0/0/20 @ 12%), two overlays (`--ov-scrim`,
  `--ov-wash`).
- **Layout** — `--container-lg` 1120px (grids/data), `--container-sm` 840px (forms/prose),
  nav full-bleed; gutter ≥ 16px always; breakpoints ≥1280 / 768–1279 / <768.

Declined, settled rulings kept (Norm, 2026-08-26): Body/XS 10px (12px floor), radius/sm 8px
(radius encodes clickability: 24 clickable / 12 not / 50% avatars), Heading/3 + Body/XL
Emphasis 24px (six-step scale), opaque border aliases (borders stay translucent rgba).
Precedence unchanged: written spec > Figma; deliberate per-screen CSS > both.

## Phase 0 — tokens codified ✅ (this commit)

`index.css` `:root` now carries `--sp-4…64`, `--ov-scrim`, `--ov-wash`, `--sh-hover`,
`--container-lg/sm` alongside the existing colour/type tokens. `/brand` documents the merged
system and demonstrates every effect and container live. Rule for all future token changes:
**one commit updates `index.css`, `tailwind.config.js` (if keyed), `/brand`, and
website.md §9 together.** A token that exists in three of the four places is drift with a
head start.

## Phase 1 — measure on every build (the ratchet) ✅ (2026-08-26)

Implemented as `scripts/design-audit.mjs`:

- `npm run audit:design` — report with per-category counts and worst-offender files.
- `npm run audit:design:check` — compares against the committed
  `design-audit/baseline.json` and **fails only if a count exceeds the baseline** — a
  ratchet, not a wall. Existing debt doesn't block anyone; *new* debt does.
- `npm run audit:design:update` — re-commits the baseline lower after a migration lands,
  so the gain can't be given back.
- Categories: off-scale font-sizes (13px and sub-12 broken out), off-system radii,
  hard-coded token hexes, off-palette hexes, off-scale padding/gap/margin. Ratcheted scope
  is `src/` minus sanctioned content (games per the 2026-08-12 ruling, plus avatar colour
  palettes and talk-deck graphics — their colours are content, not UI).
- Baseline at adoption: 13px 326 · sub-12px 372 · other off-scale 228 · radii 579 ·
  token hexes 194 · off-palette 544 · spacing 1,712. Type-scale compliance 45%.
- `/brand`'s drift numbers now cite this script's output (dated), satisfying the
  "re-measure or delete" rule.

Still open from this phase: running `audit:design:check` in the Vercel build (warn-only
first, failing after a month). Until then it's a local/pre-promotion command.

## Phase 2 — shared primitives for the drift hotspots

Drift enters where every instance is hand-styled. Build-out order, by measured impact, using
the Figma expansion's eight component sections + revised Account/Games/Dashboard test screens
as reference:

1. **Header** — designed as one component; the live site mounts `Nav.jsx` per page in 20+
   files. The single biggest consolidation win.
2. **Status semantics decision, then a `StatusChip`** — the 82 genuinely off-palette
   occurrences are nearly all admin status tints that exist because the system defines no
   success/warning colours. This needs a *design* decision from Gerold (proposed: a green
   and an amber set built like the red one), then one primitive to carry it.
3. **Dropdown** — no shared select anywhere in the app.
4. **ToggleSwitch / ToggleSetting / SettingOptions** — `/account` ships its own today; the
   revised Account test screens are the reference.
5. **GameCard family** — the revised Games page redesign in the Figma is the target.
6. **Question (SingleSelect · Scale), InfoBox family, Icon, RADLabLogo** — opportunistic.

Each primitive lands in `src/components/ui/`, renders in every variant at `/dev/ui-kit`, and
its arrival is the moment to migrate the hand-styled instances it replaces (that's what moved
the radii numbers).

## Phase 3 — container migration (kills the column-shift)

Pages adopt the shared containers, one PR each on `dev` so each is reviewable live:

| Page | Today | Target |
|---|---|---|
| Games | 1024 | `--container-lg` 1120 |
| Dashboard | 1100 | `--container-lg` 1120 |
| About | 1200 | `--container-lg` 1120 |
| Talks | 960 | `--container-sm` 840 (prose) |
| Account / My Ripple / Onboarding | varies | `--container-sm` 840 |
| `/brand` | 900 | `--container-sm` 840 |

Landing is already its own settled composition (centered 1080 column, 2026-08-22) — leave it
unless Norm asks.

## Phase 4 — the two standing migrations

- **13px → 14px** ✅ (2026-08-27). 324 mechanical replacements via a codemod mirroring the
  audit's font-size regex, two batches (participant/student surfaces, then admin/lab).
  Site-scope 13px is zero and the ratchet holds it there. Type-scale compliance 45% → 64%.
- **Sub-12px cleanup** ✅ (2026-08-30). 332 replacements in three review batches
  (participant surfaces / academic / admin). Zero remaining, ratchet-locked. Two findings
  along the way, both now encoded in the audit: rem-valued sizes are converted (0.75rem = 12px
  was being miscounted as sub-12), and SVG <code>&lt;text&gt;</code> is skipped entirely —
  its sizes are viewBox coordinates that scale with the drawing (Dashboard's wheel and
  sparkline labels were false positives).
- **Next: other off-scale sizes** (257 — 15/17/18/22px and rem equivalents). The least
  mechanical slice: each needs a judgment call between neighbouring steps, so it migrates
  surface-by-surface, not by codemod.

## Cadence and governance

- **Re-measure before every promotion of `dev` to `main`** (the audit script makes this one
  command), and refresh `/brand`'s dated numbers whenever they move meaningfully.
- **Change process**: proposal lives in Figma → Norm rules → one commit updates tokens +
  `/brand` + website.md §9. The `/brand` page must keep obeying the system it documents.
- **For Gerold**: the four exclusions above with their reasons; the success/warning
  semantics gap is the most valuable next design task; the component sections and test
  screens in the Figma are now the working reference for Phase 2.
