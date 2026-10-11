# Sense Foraging Study 1: analysis pipeline (R)

The analysis pre-registered at **osf.io/48r2y** (`docs/markdowns/sense_foraging_study1_preregistration.md`): an exploratory factor analysis of item pool 6, with a model of the tendency to agree, and the rules that choose the short form.

## Data (never in this repo)

- **Pull:** `extract.sql`, run read-only through the Supabase CLI from the main checkout:
  `npx supabase db query --linked -o json -f <path>/extract.sql > F:/radlab_data/sf_study1/raw/extract_<date>.json`
- **What it pulls:** one row per questionnaire submission by a real participant, keyed by the random participant code. Prolific IDs and staff test runs are excluded.
- **Where it lives:** `SF1_DATA_DIR` (default `F:/radlab_data/sf_study1`), local and unsynced. Scripts write `derived/` and `output/<mode>/` there.

## Modes (`SF1_MODE`)

| Mode | What the items are | Use |
|---|---|---|
| `permuted` (default) | Real answers, each item shuffled across participants: distributions kept, correlations destroyed | Building and running the code without seeing structure, as the registration promises |
| `simulated` | Generated from a known 7-factor model with acquiescence (variance .10), cut to the real items' distributions | Proving the code recovers structure; `99_check_recovery.R` reports congruence with the truth |
| `real` | The answers | **Only after the registration is approved** |

Exclusions, attention checks, timing, posting and practice group are always the real values. Item-derived indices (longstring, inconsistency) are computed on whichever item matrix the mode uses.

## Steps (`run_all.R`, from the repo root)

1. **`01_prepare`:** one row per participant, applying the registered rules.
   - The first complete submission of each questionnaire is used.
   - Anyone failing both attention checks is excluded.
   - Flags: one check failed, < 2 s per item, longstring ≥ 15, inconsistency ≥ 7/14, > 9 declined, translation crash.
   - Saves raw (unrecoded) and keyed (reverse items recoded 7 − x) matrices, plus the participant flow.
2. **`02_items`:** distributions, floor and ceiling, missingness, and the near-duplicate pairs' polychoric correlations.
3. **`03_factor_number`:** parallel analysis (polychoric, principal-axis eigenvalues, 500 datasets, 95th percentile).
   - Then ordinal EFAs for k = PA − 1, PA, PA + 1, 7 and 11, each with fit, items per factor at ≥ .40, and a **method-factor check**.
   - The check flags a factor made mostly of reversed items, or one where positive and reversed items load with opposite signs.
   - In simulation, parallel analysis counts the tendency to agree as one extra factor, so expect PA to say k + 1. Choose k by the registered criteria and set `SF1_K`.
4. **`04_primary_model`:** ESEM on the unrecoded items (WLSMV), using `SF1_K` content factors.
   - Rotation: oblique, partially specified target.
   - Plus the random-intercept acquiescence factor (loadings 1, variance free, orthogonal to the content factors).
   - The same model without the random intercept is also fitted.
5. **`05_reliability`:** ordinal omega per factor and hierarchical omega.
6. **`06_item_selection`:** the short-form proposal, by the registered rules.
   - Items: primary ≥ .40 (preferred ≥ .50), secondary < .30, gap ≥ .20, ≤ 5% declined, one of each near-duplicate pair, 3–4 per factor.
   - Reversed pairs: r ≤ −.30, and the reversed item loading ≥ .40 on its partner's factor.
   - The PI makes the final call and reports every departure.
7. **`07_known_groups`:** current practitioners vs never-practitioners on factor scores, with posting as a covariate and Holm correction.
8. **`08_sensitivity`:** congruence with the primary solution for:
   - positive items only;
   - without flagged respondents;
   - without the translation-crash group;
   - siren's acquiescence-corrected EFA;
   - without the random intercept.

   It also reports position effects.

**Runtime:** about 15–20 minutes in all; the ordinal EFAs and ESEMs dominate.

**Validated** on simulated data (2026-10-11): the seven factors were recovered with Tucker congruence .96–.99, and the acquiescence variance as 0.096 (true 0.10).
