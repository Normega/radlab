# The Spellbook — build source

Source for the static site published at **`/spellbook/`**. See website.md §29e.

## Build

```bash
npm run spellbook:build      # → public/spellbook/index.html
```

The output is **committed** — Vercel does not run Python. Rebuild and commit the
output in the same change as any edit here, or the live site silently keeps
serving the old build.

## Never hand-edit `public/spellbook/index.html`

It is generated. Edit `template.html` (shell, CSS, app JS), `spells.py`
(chapters, needs filters, spell metadata, page transcripts, citation ids) or
`data/papers.json` (student prose and references), then rebuild.

## Content rules

- Student prose and references change only through documented scripts, never by
  hand. `data/papers.json` is canonical; the original student files are
  deliberately not in this repo.
- No evidence grading or star ratings. The book links to the research; it does
  not rank it.
- The crisis footer stays on every page.
- All nine students consented to publication (eight 2026-09-17, Noor Chaudhry
  2026-09-18).

## Citation maintenance

```bash
python3 tools/spellbook/crossref.py           # refresh data/crossref.json
python3 tools/spellbook/qa/verify_citations.py # in-text links vs references
npm run spellbook:build
```

`verify_citations.py` is expected to print this uncited set — these are
page-level sources, cited on the page rather than in a sentence:

| Paper | Uncited references |
|---|---|
| `restored-spirits` | Dean 2021, Hamburg 2014, Hill 2007, Lambert 2006, Utter 2017 |
| `metaphor-mirror` | Hu 2018, Wenzel 2017 |
| `nap-spell` | Dennison 2017, Liu 2019, Tamaki 2020 |
| all others (incl. `living-your-values`) | none |

`build.py` printing any `BAD ID` line means a page cites an id no reference
carries — fix before committing the output.

Crossref was last checked 2026-09-18: 100 of 101 DOIs resolve. Ng et al. 2019 is
a DataCite DOI and is expected to fail that check.

`crossref.py` is also the arbiter when a paper's own in-text year and reference
list disagree. That happened once, on import: Noor's text cited Berkout as 2022
and her reference list said 2021. Crossref shows online-first 2021, print 2022,
and the volume and issue she cited (15(1)) belong to the print year — so her
prose was right and the reference was wrong. Check the DOI before assuming the
prose is the error; online-first dates make this a common trap.

## `archive/` — do not rerun

Already applied, kept for provenance only. `build_data.py` and `extract.py` need
the original student files, which must not be committed; the two `fix_*.py`
scripts have been applied and will fail their own assertions if rerun.

## `qa/screens.py`

Playwright screenshots and console capture. Needs `pip install playwright &&
playwright install chromium`, and network access for Google Fonts:

```bash
python3 tools/spellbook/qa/screens.py https://dev.radlab.zone/spellbook/ ./shots
```

It aborts `fonts.googleapis.com` by default so screenshots are deterministic —
with that line in place the `ERR_FAILED` console lines are expected. Remove it
to capture real type (and to re-export `assets/card-cover.webp` from `.cover`).
