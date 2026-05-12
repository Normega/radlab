# Claude Code Session: Lab Pages Build

Read `website.md` in full before starting. It is the canonical reference for all design decisions, tokens, and architecture. This prompt covers one focused task: building the lab-facing pages and wiring them into the hub.

---

## Context

The platform at `radlab.vercel.app` is a React + Vite + Tailwind CSS v3 app. The root route (`/`) currently renders `Landing.jsx` (the games landing). We are adding:

1. A hub page at `/` (move the current `/` to `/games`)
2. A lab section at `/lab/*` with five pages reading from static data files

All three data files are already in place in `src/data/`:
- `people.js` — exports `pi`, `gradStudents`, `alumni`
- `research.js` — exports `labDescription`, `researchAreas`
- `publications.json` — array of 69 publication objects

Photos are in `public/images/people/`. Research images are in `public/images/research/`.

---

## Design system

All components must use these tokens (already defined in `index.css`):

| Token | Value |
|---|---|
| Background | `#FCF0F5` |
| White cards | `#ffffff` |
| Pink accent | `#f068a4` |
| Gray | `#abadb0` |
| Dark | `#1c1c1e` |
| Heading font | DM Serif Display |
| Mono font | Space Mono |
| Body font | DM Sans |
| Min font size | 12px — never go below this, Space Mono labels are a known risk |

---

## Step 1 — Routing changes in App.jsx

- Move the current `/` route to `/games`
- Add `/` → `Hub` (to be created)
- Add routes for all lab pages wrapped in `LabLayout`:
  - `/lab` → redirect to `/lab/people`
  - `/lab/about` → `AboutPage`
  - `/lab/people` → `PeoplePage`
  - `/lab/research` → `ResearchPage`
  - `/lab/publications` → `PublicationsPage`
  - `/lab/contact` → `ContactPage`
- Update any sign-out redirect in `Nav.jsx` from `/` to `/` (hub) — confirm it already points to `/`

---

## Step 2 — Hub page (`src/pages/Hub.jsx`)

Route: `/`. No nav links. Logo only in header.

**Layout**: full-viewport, background `#FCF0F5`. Centered column. Logo at top, then a 2×2 card grid (or stacked on mobile) with three cards plus one placeholder.

**Logo**: Use `RADlab_Logo.svg` (the white+pink outline version from `public/`). Inline the SVG paths directly — do NOT use `<img>`. At hero size (66×56 logical units). The white fills dissolve into `#FCF0F5` leaving only the pink and gray shapes visible — this is intentional and correct.

**Cards** (all white, `border-radius: 12px`, subtle shadow, hover flips to `#1c1c1e` background with white text):

1. **Come, See** — "Perceptual games and research tasks" → links to `/games`
2. **Our Lab** — "People, research, and publications" → links to `/lab/people`
3. **UTMaps** — "Student wellbeing mapping project" → external link `https://utmaps.ca` (open in new tab)
4. Fourth slot — empty/placeholder for now, same card shape but muted/dashed border

---

## Step 3 — LabLayout (`src/layouts/LabLayout.jsx`)

Wraps all `/lab/*` routes. Renders:

- **Sticky nav**: `RADlab_Logo_light.svg` (dark `#1c1c1e` outline variant, `height="34"`) linking to `/` on the left. Nav links on the right: About · People · Research · Publications · Contact. Active link gets pink accent underline.
- **Main content area**: background `#FCF0F5`, padding appropriate for content
- **Footer**: "© RADlab · University of Toronto Mississauga"

---

## Step 4 — People page (`src/pages/lab/PeoplePage.jsx`)

Reads from `src/data/people.js` (imports `pi`, `gradStudents`, `alumni`).

**PI section**: Large featured card. Photo on left (circle crop, ~120px), name + credentials + role heading, bio paragraph, links as small buttons.

**Current Members section**: Heading "Current Members". Responsive grid (2-up on desktop, 1-up on mobile). Each card: photo (circle crop, ~80px), name, role, bio, links.

**Alumni section**: Heading "Alumni & Affiliated Researchers". Hidden by default behind a toggle button ("Show alumni ▾" / "Hide alumni ▴"). Same card layout as current members when revealed. Toggle uses local `useState`.

---

## Step 5 — Research page (`src/pages/lab/ResearchPage.jsx`)

Reads from `src/data/research.js` (imports `labDescription`, `researchAreas`).

**Intro**: `labDescription` text in a readable paragraph at the top.

**Research areas**: Map over `researchAreas`. Each area renders as a card: image (if present), title as heading, description paragraph, links as small anchor buttons. Two-column grid on desktop, single column on mobile.

Image files referenced in `research.js` are at `public/images/research/`. If an image 404s, degrade gracefully (hide the `<img>`, do not break layout).

---

## Step 6 — Publications page (`src/pages/lab/PublicationsPage.jsx`)

Reads from `src/data/publications.json`.

**Layout**: Single column, grouped by year descending. Each year gets a heading. Within each year, entries are listed in the order they appear in the JSON.

**Each entry**: Render the `apa` field as the citation. Wrap any author name that appears in `labMemberNames` (array defined in this component) in `<strong>`. If `annotation` is non-empty, render it as a smaller paragraph below the citation. DOI becomes a linked `https://doi.org/...` at the end.

```js
const labMemberNames = [
  "Farb, N. A. S.", "Anderson, T.", "Eusebio, J.", "Luu, S.",
  "Wu, L. C.", "Zuo, Z.", "Wang, Y.", "Desormeau, P.",
  "Dinh-Williams, L.", "Walsh, K. M.", "Petranker, R."
];
```

Bold matching is substring-based on the `apa` string — wrap each match in `<strong>` using a simple string split/replace approach.

---

## Step 7 — Contact page (`src/pages/lab/ContactPage.jsx`)

Static content — no data file needed.

**Address block**:
> RADlab — Regulatory and Affective Dynamics Laboratory  
> Department of Psychology, University of Toronto Mississauga  
> 3359 Mississauga Road, Mississauga, ON L5L 1C6

**Joining the lab** — three subsections: Research Assistants, Graduate Students, Postdoctoral Fellows. Each with a short paragraph about how to get in touch (placeholder copy is fine — Norm will edit).

Email link: `norman.farb@utoronto.ca`

---

## Step 8 — About page (`src/pages/lab/AboutPage.jsx`)

Stub only. Render a `<main>` with a centered paragraph: "About page coming soon." No data file needed.

---

## CSS additions

Add the following utility classes to `index.css` for use across lab pages. All font sizes must use the existing guardrail tokens or explicit values ≥ 12px.

```css
/* Lab pages shared */
.lab-page { max-width: 900px; margin: 0 auto; padding: 2rem 1rem; }
.lab-section { margin-bottom: 3rem; }
.lab-section__heading {
  font-family: 'DM Serif Display', serif;
  font-size: 1.5rem;
  color: #1c1c1e;
  margin-bottom: 1.25rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #e8e0e4;
}

/* Person cards */
.person-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.25rem; }
.person-card { background: #fff; border-radius: 12px; padding: 1.25rem; display: flex; flex-direction: column; gap: 0.75rem; }
.person-card__photo { width: 80px; height: 80px; border-radius: 50%; object-fit: cover; }
.person-card__name { font-family: 'DM Serif Display', serif; font-size: 1.1rem; color: #1c1c1e; }
.person-card__role { font-size: 0.8rem; color: #abadb0; text-transform: uppercase; letter-spacing: 0.05em; }
.person-card__bio { font-size: 0.875rem; color: #444; line-height: 1.6; }
.person-card__links { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.person-card__link {
  font-size: 0.75rem; padding: 3px 10px; border-radius: 99px;
  border: 1px solid #f068a4; color: #f068a4; text-decoration: none;
}
.person-card__link:hover { background: #f068a4; color: #fff; }

/* Alumni toggle */
.alumni-toggle {
  background: none; border: 1px solid #abadb0; border-radius: 8px;
  padding: 6px 16px; font-size: 0.875rem; cursor: pointer; color: #1c1c1e;
  margin-bottom: 1rem;
}
.alumni-toggle:hover { border-color: #f068a4; color: #f068a4; }
```

---

## What NOT to touch

- `Nav.jsx` (games nav) — no changes except confirming sign-out redirect
- Any game components or Supabase logic
- `Landing.jsx` — just re-route it from `/` to `/games`
- `.env.local` or Supabase config

---

## Verification

After building, confirm:
- `/` renders the hub with three cards
- `/games` renders the existing landing page
- `/lab/people` renders PI + students + collapsed alumni
- `/lab/research` renders lab description + research area cards
- `/lab/publications` renders year-grouped entries with bold lab names
- `/lab/contact` renders address + joining sections
- Logo in hub dissolves correctly (white fills invisible on `#FCF0F5`)
- Logo in LabLayout uses the light variant (dark outline)
- No font below 12px anywhere
