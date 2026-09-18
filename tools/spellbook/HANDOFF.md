# Handoff: RADlab Spellbook on radlab.zone

Date: 2026-09-17
Owner: Norm Farb
Goal: Publish the finished Spellbook prototype on radlab.zone at `/spellbook/` and add a front page card that links to it.

## 1. What this is

- A static, single-file site compiling eight PSY440 student "spells" for wellbeing. Each spell links to the student's evidence paper and references.
- Routes are hash based (`#/`, `#/spell/<slug>/<page>`, `#/evidence`, `#/evidence/<slug>?ref=<id>`, `#/about`), so it runs as one HTML file with no router changes.
- Current live prototype: https://claude.ai/artifact/UEbLr6KqKfGUvD51vfG3Ro
- All eight students gave explicit consent to publish their work.
- Citations were checked against Crossref on 2026-09-17 (90 of 91 DOIs resolve; Ng et al. 2019 is a DataCite DOI and is expected to fail).

## 2. Package contents (this zip, `sb/`)

| Path | Purpose |
|---|---|
| `build.py` | Builds the site. `python3 build.py <output.html>` (default `dist/index.html`) |
| `template.html` | Page shell, CSS, and app JS. `__DATA__` is replaced at build time |
| `spells.py` | Chapters, needs filters, spell metadata, page transcripts, citation IDs |
| `data/papers.json` | Canonical student paper text and references (already cleaned) |
| `data/crossref.json` | Crossref metadata cache |
| `crossref.py` | Refreshes `data/crossref.json` from `papers.json` |
| `img/` | Spell page images (webp), embedded as data URIs at build |
| `assets/card-cover.webp` | Front page card image (rendered with fallback fonts; see 5.2) |
| `qa/verify_citations.py` | Checks every in-text citation link matches its reference |
| `qa/screens.py` | Playwright screenshots and console error capture |
| `archive/` | One-shot scripts already applied. Do not rerun (see 6) |
| `dist/index.html` | Current build, identical to the live prototype |

## 3. Mandatory status audit (report before editing anything)

1. `git pull` on `main`; confirm a clean tree.
2. Locate the front page component and its card pattern. Report file paths, the card component, and how cards are ordered.
3. Read `vercel.json`. Report the rewrite rules and the CSP directives for `script-src`, `style-src`, `font-src`, and `img-src`.
4. Locate `RADlab_Logo.svg` and `RADlab_Logo_light.svg` in the repo and report their public URLs.
5. Confirm nothing already exists at `public/spellbook/` or a `/spellbook` route.
6. List the current top-level section numbers in `website.md` (last known: §29 Lecture Lounge, §30 Key Learnings, §31 Roadmap).
7. Confirm the build is reproducible before any edits:
   `python3 tools/spellbook/build.py /tmp/check.html && sha256sum /tmp/check.html`
   Expected: `be27f4936203b6882de8594a6a7bcbcaf4b53e792e2efb0337914108c606826b`

## 4. Stop and ask

Stop and report to Norm if any of the following occur:

- The SPA rewrite in `vercel.json` would serve the React app for `/spellbook/` and cannot be fixed with a narrow exclusion.
- CSP blocks inline styles, Google Fonts (`fonts.googleapis.com`, `fonts.gstatic.com`), or `data:` images. Do not loosen CSP without approval.
- The front page has no card pattern, or card placement is not obvious.
- The logo files cannot be found.
- `website.md` numbering differs from item 3.6.
- Any change would alter student prose or references beyond what is listed here.

## 5. Tasks

### 5.1 Add the source and build output

1. Copy `sb/` to `tools/spellbook/`, excluding `dist/` and `__pycache__/`. Add both to `.gitignore`.
2. Output path is `public/spellbook/index.html`. Add an npm script:
   `"spellbook:build": "python3 tools/spellbook/build.py public/spellbook/index.html"`
3. Commit the built `public/spellbook/index.html`. Vercel does not run the Python build.
4. Rule: never hand-edit `public/spellbook/index.html`. Edit `template.html`, `spells.py`, or `data/`, then rebuild.

### 5.2 Template edits (in `template.html`, then rebuild)

1. **Logo.** Replace the text placeholder `<span class="logo-slot" data-logo-slot>RAD<b>lab</b></span>` with the real logo files. Use `<picture>` so the white-outline `RADlab_Logo.svg` is used under `prefers-color-scheme: dark` and `RADlab_Logo_light.svg` otherwise. Never redraw the logo. Match the current slot height (about 1.5rem).
2. **Brand link.** Change the `.brand` link from `href="#/"` to `href="/"` and its `aria-label` to "radlab.zone home". The "The Spellbook" nav item stays `#/`.
3. **CSP (only if needed).** If `script-src` disallows inline scripts, change `build.py` to write three files: `index.html`, `spellbook-data.js` (`window.SB = ...`), and `spellbook.js` (the app script). Load them with `<script src>` in the same order. Do not add `unsafe-inline`.
4. **Card image.** Re-export `assets/card-cover.webp` with web fonts loaded. Run `qa/screens.py`-style capture of the `.cover` element without the font-blocking route, at device scale 2. Copy the result to `public/spellbook/card-cover.webp`.

### 5.3 Front page card

Use the existing card component and styles exactly.

- Title: The Spellbook
- Blurb: Eight evidence-based wellbeing spells, written and illustrated by PSY440 students. Each one links to the research behind it.
- Call to action: Open the book
- Image: `/spellbook/card-cover.webp` (alt: "Cover of The Spellbook")
- Link: `/spellbook/` as a plain `<a href>`, not a router `Link`, because the page is a static file outside the React app.
- Access: public, no sign-in.

### 5.4 Routing

- If the SPA rewrite catches `/spellbook/`, add a narrow exclusion so `/spellbook/` and its assets are served from `public/`.
- `/spellbook` (no trailing slash) must redirect to `/spellbook/`.

### 5.5 Documentation

Add a new `website.md` section before Key Learnings and renumber the sections after it, updating all cross-references. Preserve CRLF line endings. Content:

- Purpose: public wellbeing Spellbook compiled from consented PSY440 student work, with a linked evidence appendix.
- Location: source in `tools/spellbook/`, output in `public/spellbook/`, front page card.
- Build: `npm run spellbook:build`; output is committed.
- Content rules: student prose and references change only through documented scripts; no evidence grading or ratings; the crisis footer stays.
- Citation maintenance: run `crossref.py`, then `qa/verify_citations.py`, then rebuild.
- Provenance: `data/papers.json` is canonical. The original student files are not in the repo.

## 6. Do not

- Rerun anything in `archive/`. `build_data.py` and `extract.py` need the original student files, which must not be committed. The two `fix_*.py` scripts have already been applied and will fail their assertions.
- Commit student source PDFs or DOCX files.
- Add analytics, tracking, or sign-in to `/spellbook/`.
- Restyle the grimoire frame to match the RADlab surround. The mismatch is intentional.

## 7. Acceptance tests

1. Audit item 3.7 hash matches before any edits.
2. `python3 tools/spellbook/qa/verify_citations.py` prints exactly this set of uncited references (these are page-level sources, expected):
   - restored-spirits: Dean 2021, Hamburg 2014, Hill 2007, Lambert 2006, Utter 2017
   - metaphor-mirror: Hu 2018, Wenzel 2017
   - nap-spell: Dennison 2017, Liu 2019, Tamaki 2020
   - all other papers: none
3. `build.py` prints no `BAD ID` lines.
4. The front page shows the new card with its image. Clicking it opens `/spellbook/`.
5. A hard refresh loads each of these correctly on the Vercel preview:
   - `/spellbook/`
   - `/spellbook/#/spell/metaphor-mirror/2`
   - `/spellbook/#/evidence/nap-spell?ref=nap-spell-r6` (scrolls to and highlights Cousins et al. 2019b)
   - `/spellbook/#/evidence`
   - `/spellbook/#/about`
6. No console errors and no CSP violations on those routes. Run `qa/screens.py` against the preview URL with the font-blocking line removed. With it in place, the `ERR_FAILED` lines are expected.
7. The real logo renders in light and dark mode. The brand link goes to `/`.
8. At 390 px width, there is no horizontal scroll on the home, spell, and evidence views.
9. `npm run build` passes, and existing routes are unaffected.
10. The `website.md` section is added, numbering and cross-references are consistent, and CRLF is preserved.

Report the audit findings, then the test results with screenshots from item 6.
