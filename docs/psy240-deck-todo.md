# PSY240 deck work — running to-do

> Working list for the just-in-time lecture-prep strategy (started 2026-09-03). L1 and L2 have
> had their full pass (content incorporation from 2025 decks + illustrations + evaluation
> check against the syllabus). Each remaining lecture gets the same treatment the week or two
> before it runs. Cross items off as they land; the syllabus of record is
> `I:\My Drive\Teaching\Psy240abnormal\2026\PSY240H5F_2026_Fall_Syllabus_DRAFT.md`.

## The per-lecture JIT pass (repeat for each of L3–L12, in date order)

For each deck, roughly a week out:

1. **Content pass against the 2025 PPT** — the text dumps live in the session scratchpad but
   regenerate easily: `python-pptx` over
   `I:\My Drive\Teaching\Psy240abnormal\2025\Lectures\Psy240_Fall2025_LectureN.pptx`.
   The bulk relocated-vs-lost audit is done (see the "PSY240 Cut Audit" artifact and the
   restore commits `6a290dc`/`70a2692`); what remains per deck is judgement calls on
   *engagement* material the audit deliberately skipped (examples, images, stories).
2. **Illustrations** — the decks use inline SVG in a house palette
   (`#8B2E5C` plum · `#B5540F` orange · `#1F5C8B` blue · `#0F6B57` green · `#C92A2A` red ·
   greys `#868E96/#495057/#5C6773`; fills `#F7E9F0 #FBEDE0 #E7F0F7 #E3F3EE #F1F3F5 #FFF5F5`).
   Keep `viewBox` ≈ 640–660 wide, `role="img"` + `<title>/<desc>`, reveals via
   `<g class="hidden-until">`.
3. **Fill the QotW placeholder** — every deck now carries a generic "Question of the week is
   live" line plus an HTML comment `TODO(QotW)` marking where the actual question text goes
   (write it into the speaker notes; post it on the dashboard in class).
4. **Evaluation check** — quiz number, contribution deadlines, RCT beats, freeze dates against
   the syllabus table (all verified consistent as of 2026-09-03; re-check only if the syllabus
   moves).

## Per-lecture illustration + content candidates (from the 2025 decks and audit)

- **L3 (anxiety/OCD):** SVG worry loop for the new GAD slide, mirroring the panic-loop drawing
  (same three-node circle, different labels). 2025 deck's OFC–caudate circuit figure could
  become a simple SVG on the neurobiology slide.
- **L4 (trauma):** four-cluster PTSD diagram (quadrant SVG); ASD/PTSD timeline exists already.
  Consider one respectful case story for dissociative fugue (spoken, not slide).
- **L5 (mood/suicide):** specifier annotations drawn onto the polarity/duration grid SVG;
  the creativity–bipolar "poets" engagement beat from 2025 was cut — decide keep-dead or revive
  as one spoken minute.
- **L6 gap — midterm-day mini-deck does not exist.** Oct 14 runs 9:00 midterm → 10:45 RCT
  onboarding. The onboarding hour needs ~6 slides (welcome back, consent walk-through, account
  setup QR, baseline batteries, first guided session, what-happens-next). Nothing exists yet.
  **Highest-priority missing artifact.**
- **L7 (sex/gender):** spectatoring-loop SVG (panic-loop form); Joyal fantasy-norms one-liner
  is in the Guide if wanted in-room.
- **L8 (eating/sleep):** hypnogram SVG for the new REM/NREM line (90-min cycles, deep-NREM
  early / REM late — directly supports the parasomnia timing point).
- **L9 (substance):** opponent-process curve SVG (a-process/b-process over repeated use);
  **find a source for the on-slide "70% of deaths involve more than one substance" stat** —
  the one figure in all twelve decks the audit could not verify against the Guide.
- **L10 (neurodev/neurocog):** the three course-shapes drawing (sawtooth / slope / staircase)
  the notes already promise — make it a real SVG on the delirium-vs-dementia slide.
- **L11 (PD/law):** two-authorities diagram (parens patriae vs police power); NCRMD → Review
  Board flow SVG.
- **L12 (schizophrenia/reveal):** dopamine two-arrows SVG (blockers relieve / boosters provoke);
  the results slides get built the weekend before Dec 2 from the real analysis (deck already
  carries the placeholder box).

## Non-deck items carried from the audit

- **Guide holes deliberately left as claimable gaps** (good Amber targets, or quick authoring):
  Air Transat 236 study (PTSD memory), alcohol myopia, suicide contagion/media evidence,
  Kinsey/historical sexuality arc, dieting epidemiology and restraint theory, DSM historical
  arc (multiaxial → atheoretical turn), hostile attribution bias (conduct disorder),
  depersonalization mechanism, conversion-disorder vocabulary (la belle indifférence),
  disease conviction (illness anxiety).
- **Timing check:** L1 is now 31 sections (was 27) — do a dry-run timing pass before Sept 9;
  the break-2 note already names the gene–environment slide as the sanctioned drop.
- **Images beyond SVG:** 2025 decks used textbook art (Kurelek's *The Maze*, Genain sisters,
  brain scans). Reusing publisher images needs a rights check; the SVG-only policy stands
  until decided otherwise.
- **QotW mechanics:** confirm in the Lounge admin that a Question of the Week can be posted
  per-week and that the wall opens/closes as the syllabus describes (answer visible after
  posting own response).
- **Syllabus placeholders `[?1]`** (room, Quercus URL, TA names) still open in the draft —
  the L1 deck does not depend on them, but the syllabus must be finalized before Sept 9.
