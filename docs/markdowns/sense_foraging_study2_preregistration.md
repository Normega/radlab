# Sense Foraging Scale, Study 2: confirmatory structure, validity and stability of the 20-item short form

**DRAFT, revised 2026-10-12 after an independent review; not filed.**

- OSF Preregistration (standard template).
- University of Toronto REB Protocol #00051180; the Study 2 amendment is not yet submitted.
- Decisions still marked **[Norm]** must be settled before filing.
- **Before filing:** the analysis code (`study2/analysis/`) is run end to end on simulated and permuted data, as Study 1's was, and its commit is cited here. The code is the specification wherever this text is less precise.

**What changed in the 12 October revision** (Norm's decisions, 12 October, after the review):
- **The confirmatory model is now an ESEM.** It is target-rotated, uses Study 1's item key as the targets, and includes the agreement factor. The simple-structure CFA (Model A) is still fitted and reported. Fitted to Study 1's own data, the CFA already fails the fit criteria (Section 3, *Existing data*), so a CFA-only test was set up to fail on cross-loadings rather than on the structure.
- **Scoring.** The primary score is **Access + Valuing and savouring**: the mean of their 10 items, with the two subscales reported. Understanding the modes and Letting be are secondary. No 20-item total is scored: Study 1's general factor was overstated. ω_h is .54 for the pool and .50 for the 20 items, not the .70 and .66 first reported.
- **Letting be.** IUS-12 is no longer a convergent test for Letting be, because two of its items paraphrase IUS-12 items. A wording-factor model now tests whether Letting be is separable from reversed wording.
- **No practice screening on either posting,** as the approved protocol says.
- **N = 1,000,** up from 500. Each selection half is then the size of Study 1, and H6 keeps its power without screening.
- **No country filter** (Norm, later on 12 October): adults fluent in English anywhere, as Study 1 recruited in practice. Country is compared as the six countries named in the REB application against everywhere else.
- **Forage's curiosity neighbour** is the BFI-2 Intellectual Curiosity facet, already in the battery (Norm, 12 October). No separate curiosity measure is added.
- **H7 is per subscale.**
- **Specification errors fixed:** missing data, the agreement factor's item count, the attention-check rule for partial sessions, score definitions, the life-satisfaction format and the fit-index version.

## 1. Study information

### Title

Development of the Sense Foraging Scale, Study 2: confirmatory factor structure, construct validity, measurement invariance and two-week stability of the 20-item short form

### Authors

Norman Farb (principal investigator), University of Toronto. Co-investigators as listed on REB Protocol #00051180.

### Description

The Sense Foraging Scale measures how people move between two ways of paying attention:
- **the sensing mode:** taking in what is present through the senses, without needing to do anything with it;
- **the doing mode:** using what one knows to plan, solve, judge, fix or get something done.

**Study 1** (osf.io/48r2y; N = 500) used a 48-item pool. It found four correlated content factors and a random-intercept agreement (acquiescence) factor, which accounted for about 10% of item variance:
- **Access:** being able to move into the sensing mode;
- **Understanding the modes:** knowing the two modes and what pulls between them;
- **Valuing and savouring:** treating time in the sensing mode as worthwhile;
- **Letting be:** leaving what is noticed unelaborated and unresolved. Its positive pole is not needing to add meaning or to know what comes next. Six of its seven defining items in Study 1 were reverse-keyed, so it may be partly a wording factor; Study 2 tests this.

From these results we fixed a 20-item short form: five items per factor, each factor mixing forward- and reverse-keyed items. It is scored as two subscales and their combination:
- **Primary score:** Access + Valuing and savouring, the mean of 10 items.
  - In Study 1 (in-sample) its α was .81. Access alone was .81 and Valuing and savouring .69.
  - A one-factor model of the 10 items fitted far worse than two factors (latent r = .60). So the two are reported separately as well as combined.
- **Secondary scores:** Understanding the modes and Letting be. In Study 1, α was .54 and .59 and model-based ω was .50 and .52, too low to score individuals.

Study 2 tests that short form in a new sample:
1. **Structure:** whether the four-factor structure with an agreement factor holds.
2. **Validity:** whether each factor relates to established measures as predicted, including measures it should *not* resemble, and whether Access and Valuing are more than their nearest neighbours combined.
3. **Incremental validity:** whether Access and Valuing explain wellbeing and stress beyond trait mindfulness and interoceptive awareness.
4. **Invariance:** whether the structure is equivalent across recruitment postings, countries and gender.
5. **Stability:** how stable scores are over two weeks, in an invited subsample.

### Hypotheses

Confirmatory hypotheses are numbered H1–H7. Their tests and decision rules are in Section 5.

- **H1 (structure).** A model with four correlated content factors and a random intercept fits the 20 items acceptably.
  - The model is an ESEM with target rotation: each item is targeted to its Section 4 factor, and its other loadings are targeted to zero.
  - The random intercept is the agreement factor, with variance > 0.
  - Each factor is confirmed or not, by the rule in Section 5.
- **H2 (convergent validity).** Each factor correlates positively, at least moderately (r ≥ .30), with the established measure closest to it:
  - Access with FFMQ-15 Observing;
  - Access with MAIA-2 Attention Regulation;
  - Letting be with EQ Decentering;
  - Valuing and savouring with SBI Savoring the Moment.
- **H3 (discriminant validity).**
  - (a) Each convergent correlation in H2 is below .80. Latent correlations count: the factor is not that measure.
  - (b) Valuing and savouring correlates more strongly with SBI Savoring the Moment than with BFI-2 Open-Mindedness. This tests whether the factor reflects valuing sensory engagement in particular, not a general appetite for experience.
  - (c) No factor correlates with either BIDR-16 subscale beyond |r| = .30.
  - (d) **Neither Access nor Valuing and savouring is redundant with its neighbours taken together.** The multiple correlation of each latent factor with its neighbour set is below .80.
    - **Access's neighbours:** FFMQ-15 Observing, MAIA-2 Noticing, MAIA-2 Attention Regulation and EQ Decentering.
    - **Valuing and savouring's neighbours:** SBI Savoring the Moment, BFI-2 Aesthetic Sensitivity, MAIA-2 Body Listening and FFMQ-15 Observing.
- **H4 (criterion validity).**
  - Access and Valuing and savouring correlate positively with the number of past-week days on which the participant deliberately paused to take in their surroundings (`crit_pause_days`).
  - Letting be and Access correlate positively with noticing unexpected events before reacting (`crit_notice_first`).
- **H5 (incremental validity).** Access and Valuing and savouring together explain variance beyond age, gender, the five FFMQ-15 facets and the eight MAIA-2 subscales (ΔR² > 0, p < .05). The test holds if this is true for at least one of three outcomes: life satisfaction, PHQ-4 or PSS-4.
- **H6 (known groups).** Dedicated practitioners score higher than people who have never practised regularly on Access and on Valuing and savouring (d ≥ 0.50). Dedicated means practising 3 or more times a week, for at least a year, with formal teacher-led training.
  - In Study 1, practitioners at least weekly scored higher than never-practitioners on Access (d = 0.72) and Valuing and savouring (d = 1.22), on factor scores with agreement removed. Understanding the modes and Letting be did not differ.
  - The differences shrank by about a third to a half once spirituality and religiosity were controlled. Study 2 reports that adjustment as a pre-specified sensitivity analysis.
  - Understanding the modes and Letting be are compared too, with no directional prediction.
- **H7 (stability).** Over 14–21 days, the Access, Valuing and savouring, and Access + Valuing scores each have a test–retest ICC(2,1) (absolute agreement) of at least .70.
  - Understanding the modes and Letting be are reported descriptively, without a threshold. Their internal consistency in Study 1 (about .50–.60) caps their retest correlation below .70, whatever their stability.

## 2. Design plan

### Study type

Observational study: a single-session online survey, plus an optional follow-up session for a random subsample.

### Blinding

No blinding is involved. The debrief explains the aims.

### Study design

The main session takes about 20 minutes and runs in this order:
1. **Background questions:** the 13 questions from Study 1, unchanged.
2. **The short form:** the 20 items in one fixed order on 3 pages (7/7/6). The response scale is 1 Strongly disagree to 6 Strongly agree, with no midpoint, plus "Prefer not to answer".
3. **Twenty-four candidate items:**
   - unscored, on the same scale;
   - on 3 pages of 8, in a constrained random order per participant: items written for the same factor are never adjacent, reversed items are 3–4 a page and never first, and opposite or look-alike pairs are on different pages;
   - nineteen are new, and five are Study 1 items with their wording unchanged.
4. **The validity block,** in a random order for each participant:
   - FFMQ-15;
   - MAIA-2, including its instructed-response check;
   - BIDR-16;
   - PHQ-4;
   - IUS-12;
   - SBI Savoring the Moment (8 items);
   - BFI-2 Open-Mindedness (12 items, plus one instructed-response check);
   - Experiences Questionnaire Decentering (11 items);
   - PSS-4;
   - three past-week items;
   - a single life-satisfaction item: the approved wording on a six-point face scale, unhappy to delighted (this format is part of the amendment).
5. **Debrief.**

Every item except the two checks and the life-satisfaction item offers "Prefer not to answer". **[Norm: the platform's face-scale step has no "Prefer not to answer" yet; add one before launch, or say in the amendment that this one item has none.]** The exact materials are in the supplementary file *Study2_Measures.docx*.

**Follow-up.** About 14 days after their main session, about 200 randomly selected completers are invited through a Prolific custom allowlist. The window is 7 days and the target is about 150 completions. The follow-up repeats the 20-item short form only, in the same fixed order.

**Recruitment.** Two Prolific postings, as in Study 1 and as the approved protocol describes. They differ only in framing:
- **General posting:** a neutral, general-interest description.
- **Contemplative posting:** a description oriented toward contemplative or mind-body practice.
- **No one is screened on practice history** in either posting. Practice is measured in the background questions after consent.

Both postings lead to the identical study, and the posting is recorded.

### Randomization

- The order of the validity measures is a seeded random permutation per participant (`shuffle_group`), stable on reload. Each participant's order is recorded.
- The short form is in one fixed order for everyone, the same order as in the course trial, so scores are comparable across uses.
- The selection and holdout halves (Section 5, step 7) are drawn by script, stratified by posting, with a recorded seed.
- Follow-up invitations go to a simple random sample of eligible completers, drawn by script with a recorded seed.

## 3. Sampling plan

### Existing data

**Registration prior to creation of data.** No Study 2 data exist. The short form was selected from Study 1, which is a separate sample.

**What Study 1 already shows about these models.** The models below were fitted to Study 1's data, the same sample the 20 items were chosen from, so each fit is optimistic:

| Model | CFI | RMSEA (90% CI upper) | SRMR |
|---|---|---|---|
| 20 items, simple-structure CFA + random intercept (Model A) | .850 | .086 (.093) | .072 |
| 20 items, target-rotated ESEM + random intercept (the H1 model) | .969 | .047 (.055) | .028 |
| 10 Access + Valuing items, two-factor CFA + random intercept | .974 | .069 (.083) | .038 |
| 14-item Access + Valuing form, two-factor CFA + random intercept | .958 | .077 (.086) | .046 |

All are WLSMV with scaled indices. Model A's misfit comes from cross-loadings of about .20–.30 that it forces to zero. The ESEM's largest are:
- item 7 on Valuing (.23);
- item 22 on Valuing (.27);
- item 27 on Understanding (.28);
- item 44 on Understanding (.26);
- item 40 on Valuing (.29);
- item 46 on Access (.21).

The short form is also the baseline and final measure of a separate course trial; those data are not used here.

### Data collection procedures

- **Participants:**
  - Prolific participants, 18 or older, fluent in English (Prolific's "fluent languages" filter).
  - **No country filter.** The REB application named six countries (the United States, United Kingdom, Canada, Australia, Ireland and New Zealand), and the amendment removes that restriction.
  - Study 1 set no country filter either, and 69% of its sample lived outside the six. Their answers held together about as well: α was .81 against .82 for Access and .67 against .75 for Valuing and savouring.
  - The debrief lists crisis lines for the six countries and points everyone else to Find a Helpline (findahelpline.com).
- **Excluded from both postings:** Study 1 participants (Prolific exclusion list). The contemplative posting also excludes general-posting participants.
- **Platform:**
  - The RADlab research platform. Prolific IDs are held in a separate table and replaced by a random code in all study data.
  - The IDs are kept until the follow-up closes. They are deleted after the main and follow-up codes are linked.
- **Compensation:** USD 12 per hour, prorated: about USD 4.00 for the main session and about USD 0.60 for the follow-up. Payment does not depend on answers.

### Sample size

- **Main session:** 1,000 completers, 600 on the general posting and 400 on the contemplative posting.
- **Follow-up:** about 150 completers out of about 200 invited.

### Sample size rationale

- **Selection and holdout halves (step 7).**
  - Each half is about 500, the size of Study 1.
  - The ESEM's median loading SE in Study 1 was .043 at N = 488, so it is about .042 per half.
  - At that precision, a candidate whose true loading is .45 clears the ≥ .50 rule about 12% of the time, and one at .55 fails it about 12% of the time. With halves of 250, both would be about 20%.
- **Structure.** Simulation work on ordinal factor models with 4–6 categories and five indicators per factor finds stable estimates and accurate fit statistics from N ≈ 300 (e.g. Forero, Maydeu-Olivares & Gallardo-Pujol, 2009). 1,000 also supports multi-group models with groups of 300 or more.
- **Correlations.**
  - With N = 1,000, a correlation of .30 has a 95% CI of about ±.06.
  - H3b compares two dependent correlations. By simulation, it has about 93% power to detect .40 against .30 when the two measures correlate .50 with each other (68% at N = 500).
- **Known groups (H6).**
  - In Study 1, which was unscreened like Study 2, 34 of 500 participants met the dedicated definition and 143 had never practised regularly. At those rates, 1,000 gives about 68 against 286.
  - Power is then 80% for d = 0.38, and 93% for the predicted d = 0.50 at the Holm-adjusted α of .025.
- **Stability.** With 150 retest pairs and a true ICC of .75, the 95% CI is about ±.07.

### Stopping rule

Places are fixed on Prolific in advance:
- **Main:** 600 general and 400 contemplative.
- **Follow-up:** places equal to completions reached, invitations capped at 200, closing after 7 days.

There is no interim analysis, and excluded participants are not replaced.

## 4. Variables

### Manipulated variables

None. Posting is a recruitment condition, recorded and used as a grouping variable.

### Measured variables

- **Short form** (`sf6_*` ids from Study 1; R = reverse-keyed, stored unrecoded):

  | Factor | Items |
  |---|---|
  | Access | 35R, 36R, 9, 8, 7 |
  | Understanding the modes | 22, 3, 15, 31, 37R |
  | Valuing and savouring | 12, 18, 11, 27, 44R |
  | Letting be | 40R, 46R, 43R, 47R, 21 |

  - **Letting be is scored so that higher = more letting be.** Items 40, 46, 43 and 47 are worded against letting be and are recoded; item 21 is kept as is.
- **Candidates:** 24 items, each assigned a factor and keying a priori, stored in the questionnaire definition. Each item's presented position is recorded.
  - **Understanding the modes:** `sfc_2`, `sfc_3`, `sfc_7`, `sfc_8`, `sfc_9` (2, 3 and 9 reversed), about recognising one's own mode in the moment.
  - **Letting be:** `sfc_5`, `sfc_6`, `sfc_10`–`sfc_14` (12, 13 and 14 reversed).
    - Quiet labelling and noticing pleasant or unpleasant count as part of the sensing mode, as the course teaches. Only elaborating, explaining or acting on what is noticed counts against letting be.
    - Four positively worded items (`sfc_5`, `sfc_6`, `sfc_10`, `sfc_11`) give the factor a positive pole that Study 1 lacked.
  - **Valuing and savouring:** `sfc_4`, `sfc_15` (both reversed).
  - **Forage:** `sfc_16`–`sfc_20` (19 and 20 reversed). These cover the seeking itself: searching the senses for something without knowing where it will turn up. Study 1's discovery items measured valuing discovery and loaded with Valuing once agreement was modelled.
  - **Study 1 items, wording unchanged:**
    - `sfc_21`–`sfc_23` are Study 1 items 6, 2 and 14 (Access);
    - `sfc_24` and `sfc_25` are items 25 and 28 (Valuing and savouring).

    They let the 14-item Access + Valuing form found in Study 1 be fitted in Study 2: Access 9, 7, 6, 2, 8, 14, 36R, 35R and Valuing 18, 12, 25, 27, 28, 44R.
- **FFMQ-15:** Observing, Describing, Acting with awareness, Nonjudging, Nonreactivity (3 items each).
- **MAIA-2:** eight subscales, scored as subscales (the authors do not recommend a total).
- **BIDR-16:**
  - Self-Deceptive Enhancement and Impression Management, 8 items each;
  - scored continuously (mean of 1–7) and, for sensitivity, dichotomously (Paulhus).
- **IUS-12:** total score, plus Prospective (7 items) and Inhibitory (5 items) anxiety.
- **SBI Savoring the Moment:** 8 items (SBI items 2, 5, 8, 11, 14, 17, 20, 23), mean score; items 2, 8, 14 and 20 are reverse-scored.
- **BFI-2 Open-Mindedness:** 12 items, with facets Intellectual Curiosity, Aesthetic Sensitivity and Creative Imagination.
- **EQ Decentering:** 11 items, 1–5.
- **PSS-4:** 0–16; items 2 and 3 reverse-scored.
- **PHQ-4:** 0–12, plus anxiety and depression subscales (0–6 each).
- **Life satisfaction:** one item, six-point face scale, scored 1–6.
- **Past week:**
  - `crit_pause_days` (0–7);
  - `crit_notice_first` (1–5, with "nothing unexpected happened" set to missing);
  - `crit_outdoors` (0–4, ordinal).
- **Background questions:** as in Study 1.
- **Paradata:**
  - the presented order of the validity block and of the candidates;
  - seconds per questionnaire;
  - posting.

### Indices

- **Practice groups:**
  - **Dedicated:**
    - regular practice "Yes";
    - past-3-month frequency "3–5 times a week" or "Daily or near-daily";
    - total years ≥ 1;
    - teacher-led training "Yes".
  - **Never:** regular practice "No".
  - **Other** (everyone else): reported descriptively, and used in the frequency analysis.
- **Country group:** two groups from the background question on country of residence:
  - the six listed countries (United States, United Kingdom, Canada, Australia, Ireland, New Zealand);
  - everywhere else.

  In Study 1 these were 31% and 69%. If either group has fewer than 200 participants, country is not analysed.
- **Short-form scores (observed):** the mean of available items after reverse-scoring, when at least 80% of the scale's items are answered.
  - Access (5 items), Valuing and savouring (5), Access + Valuing (the mean of their 10 items: the primary score), Understanding the modes (5) and Letting be (5).
  - There is no 20-item total.
- **Short-form scores (latent):** the content factors of the H1 model, with agreement modelled.
- **Agreement index (descriptive):** each person's mean raw (unrecoded) answer over the reversed–partner item pairs available among the short form and candidates. The pairs are listed in the analysis code, with equal numbers of forward and reversed items. It is used only where a model-based agreement factor is not available.

## 5. Analysis plan

### Statistical models

All analyses use R with lavaan, semTools, psych and irr; versions will be reported.

**General settings:**
- Short-form and candidate items are treated as ordinal, with WLSMV and the theta parameterization.
- Missing responses use pairwise-available data (`missing = "pairwise"`, set explicitly in the code).
- Fit is judged on the **scaled** indices (`cfi.scaled`, `rmsea.scaled` and its CI, `srmr`); the robust versions are reported alongside.
- The random intercept has loadings fixed at 1 on every unrecoded item in the model, a free variance, and no correlation with the content factors.

1. **H1, structure.**
   - **Primary model:** an ESEM with four correlated content factors and the random intercept.
     - **Rotation:** oblique partially specified target rotation (lavaan `rotation = "pst"`, 30 random starts).
     - **Targets:** each item's Section 4 factor; all its other loadings are targeted to 0.
   - **H1 is supported** when the primary model has scaled CFI ≥ .95, RMSEA ≤ .06 (upper 90% CI ≤ .08) and SRMR ≤ .08, and the random-intercept variance is > 0 (p < .05). **Partial support** is CFI .90–.95 with RMSEA ≤ .08.
   - **Each factor is confirmed** when, in the primary model:
     - at least four of its five items load ≥ .40 on it, in their keyed direction;
     - none of its items loads more strongly on another factor.
   - **A factor is scored for individuals** only when it is confirmed and its model-based ordinal ω is ≥ .70. That ω uses the content loadings only, not the agreement factor.
   - **A factor not confirmed** is reported as such and is not scored in later work without revision.
   - **Also reported:**
     - Model A, the simple-structure CFA with the random intercept (Study 1 in-sample values are in Section 3);
     - the ESEM without the random intercept;
     - a one-factor model with the random intercept.

     Modification indices for Model A are reported, and nothing is re-specified on their basis.
   - **Letting be and wording (pre-specified, secondary).**
     - The primary ESEM is refitted with an added negative-wording factor. It loads on all 8 reversed short-form items, is orthogonal to everything else, and has free loadings.
     - If Letting be's loadings on 4 or more of its 5 items fall below .30 in this model, Letting be is reported as not separable from reversed wording.
     - With the candidates, the same test is run in step 7's model. There, Letting be's four new positive items are added to the factor.
2. **H2–H4, validity.**
   - **Primary analysis:**
     - start from the H1 model;
     - add each validity score in turn as an observed variable correlated with the four content factors and uncorrelated with the random intercept;
     - estimate the latent–observed correlations with 95% CIs.
   - **Secondary analysis:** correlations of observed short-form scores (Section 4) with validity scores, Pearson with 95% CIs. They are reported in full as the validity matrix below.
   - **H2:** each listed correlation is in the predicted direction with a 95% CI lower bound above .30 in absolute value.
   - **H3a:** the upper bound of each convergent correlation's 95% CI is below .80.
   - **H3b:** Valuing and savouring's correlation with SBI exceeds its correlation with BFI-2 Open-Mindedness. This is tested as a bootstrap difference in the latent model, with 2,000 resamples and a 95% CI excluding 0.
   - **H3c:** every 95% CI for the correlations with BIDR SDE and IM lies within ±.30.
   - **H3d:**
     - In the H1 model, with the neighbour scores (Section 1) added as observed variables, take the latent Access factor's correlations with its neighbours and theirs with each other.
     - Its multiple correlation with the set is R = √(r′Σ⁻¹r). The same is done for Valuing and savouring.
     - H3d is supported for a factor when the upper bound of a 2,000-resample bootstrap 95% CI for that multiple correlation is below .80.
   - **H4:** the listed correlations are positive, one-tailed α = .05, Holm-corrected across the four tests.
3. **H5, incremental validity.** For each outcome (life satisfaction, PHQ-4 total, PSS-4) there is a hierarchical regression on observed scores:
   - **Step 1:** age, gender, the five FFMQ-15 facets and the eight MAIA-2 subscales;
   - **Step 2:** Access and Valuing and savouring;
   - **Step 3 (secondary):** Understanding the modes and Letting be.
   - The Step 2 ΔR² F-test is Holm-corrected across the three outcomes. ΔR² and the standardized coefficients are reported. **[Norm: whether to require a minimum ΔR² of .02, as the review suggests.]**
   - A latent version is reported alongside. In it, the outcome is regressed on the latent factors, with agreement modelled, and on the covariates.
4. **Invariance.** This analysis is exploratory but specified in advance.
   - **Groups compared:**
     - posting;
     - gender (men vs women; other categories are too small);
     - country group.
   - **Model:** the four-factor CFA with the random intercept, for the 20 items, and the two-factor Access + Valuing model for its 10 items. ESEM invariance is reported if the CFA is not configurally acceptable.
   - **Steps,** following Wu and Estabrook (2016):
     - configural;
     - thresholds;
     - thresholds and loadings;
     - thresholds, loadings and intercepts.
   - The random-intercept loadings stay fixed at 1 in every group, and its variance is free across groups.
   - Non-invariance is a ΔCFI below −.010 with ΔRMSEA above .015 (Chen, 2007). Partial invariance is then examined item by item.
   - **Sparse categories:** a response category with fewer than 5 answers in any group is merged with its neighbour toward the scale's centre, for that item, in all groups.
   - **Over time:** longitudinal invariance between baseline and follow-up (the same steps, with the item residuals of the two occasions correlated) is fitted for Access + Valuing in the follow-up sample. The course trial depends on this for its change scores.
5. **H6, known groups.**
   - Compare dedicated practitioners with never-practitioners on each observed score (Section 4), using a linear model with posting as a covariate.
   - Report Cohen's d (the group coefficient over the pooled SD) with a 95% CI, Holm-corrected across Access and Valuing and savouring.
   - **H6 is supported** for a factor when the difference favours dedicated practitioners, p_Holm < .05, and d ≥ 0.50.
   - **Pre-specified sensitivity analyses,** reported beside the primary test:
     - (a) adding spirituality and religiosity as covariates;
     - (b) restricting dedicated practitioners to those who name meditation or yoga among their practices;
     - (c) the same comparison on latent scores with agreement modelled.
   - **Secondary:** a linear trend across frequency categories in all practising participants. The comparison is also repeated on latent means in the invariance model, if scalar invariance holds across practice groups.
6. **H7, stability.**
   - For each observed score: ICC(2,1), absolute agreement, with a 95% CI.
   - SEM = SD_baseline × √(1 − ICC).
   - MDC95 = 1.96 × √2 × SEM, reported in raw-score units.
   - **H7 is supported** for Access, Valuing and savouring, and Access + Valuing, each separately, when its ICC point estimate is ≥ .70. Understanding the modes and Letting be are reported with their ICCs and their baseline ω, without a threshold.
   - Also reported:
     - follow-up responders compared with non-responders on baseline scores;
     - the agreement index's stability, as an ICC.
7. **Candidate items (exploratory, selection rules fixed here).**
   - The sample is split at random into two halves, stratified by posting, with a recorded seed: a **selection half** and a **holdout half**. All other analyses use the full sample.
   - On the selection half, fit a target-rotated ESEM of 39 items with the random intercept on all 39 unrecoded items:
     - the 20 short-form items;
     - the 14 new non-Forage candidates;
     - the 5 Study 1 items.

     It has four content factors, and each candidate is targeted to its a-priori factor. The Forage items are analysed separately in step 9.
   - A candidate qualifies as a replacement when, on its intended factor:
     1. its primary loading is ≥ .50 and no other loading is ≥ .30;
     2. swapping it for the factor's weakest current item raises the factor's model-based ω;
     3. the factor keeps at least one item of each keying direction;
     4. its "Prefer not to answer" rate is ≤ 5%.
   - At most two items per factor are replaced, so the revised form keeps 5 items per factor (20 in all). Every replacement and the reason for it are reported.
   - **Sparse categories:** merged as in step 4, within the half.
   - **Bootstrap stability:** 200 resamples of the selection half are also run. Each replacement's selection rate is reported. A replacement selected in fewer than 60% of resamples is marked unstable.
8. **Revised form, if any (exploratory).**
   - Any form produced by step 7 is fitted on the **holdout half** only, by the H1 criteria and the per-factor rule. Its ω and its validity correlations are reported beside the fixed form's.
   - This is an internal check. The revised form's confirmation in an independent sample (the course's intake data or a third study) is planned separately.
   - The fixed 20-item form remains the instrument of record for the PSY240 trial.
9. **Forage (exploratory).** On the full sample:
   - (a) the five Forage items' α, mean inter-item correlation and correlation with the agreement index;
   - (b) whether they form a factor of their own in an ESEM with five content factors (Forage targeted) plus the random intercept, or load with Valuing and savouring or Access as Study 1's discovery items did;
   - (c) their correlations with the past-week item on deliberately pausing to take in one's surroundings, with practice frequency, with BFI-2 Intellectual Curiosity (general curiosity) and the rest of BFI-2 Open-Mindedness, and with SBI Savoring the Moment.
10. **The 14-item Access + Valuing form (exploratory).**
    - Fit the two-factor model (Access 8 items, Valuing and savouring 6) with the random intercept, by the H1 fit criteria.
    - Report its ordinal ω per factor, and its known-groups and validity correlations beside the fixed form's Access and Valuing subscales.
    - Its items were chosen on Study 1's data, so this is its first test in independent data. It is still provisional: five of its items sit in the candidate block, after the 20, not among them.
    - The five re-run items' loadings and means are compared with Study 1's.

### Predicted validity matrix

Correlations are between latent factors and observed scores. "Near zero" means |r| < .20. The **H** column marks cells that are confirmatory tests; all other cells are reported against these predictions, descriptively.

| Measure | Access | Understanding the modes | Valuing and savouring | Letting be | H |
|---|---|---|---|---|---|
| FFMQ Observing | + moderate (.30–.50) | + small | + moderate | + small | H2 (Access), H3d |
| FFMQ Describing | + small | + small | near zero | near zero | |
| FFMQ Acting with awareness | + small | near zero | near zero | + small | |
| FFMQ Nonjudging | + small | near zero | near zero | + small to moderate | |
| FFMQ Nonreactivity | + moderate | + small | + small | + moderate | |
| MAIA-2 Noticing | + moderate | + small | + small | near zero | H3d |
| MAIA-2 Attention Regulation | + moderate | + small | + small | + small | H2 (Access), H3d |
| MAIA-2 Not-Worrying, Not-Distracting | near zero | near zero | near zero | + small | |
| MAIA-2 Body Listening, Trusting | + small to moderate | + small | + moderate | near zero | H3d (Body Listening) |
| EQ Decentering | + moderate | + small to moderate | + small | + moderate | H2 (Letting be), H3d |
| IUS-12 | − small | near zero | near zero | − moderate (partly shared item content; not a test) | |
| SBI Savoring the Moment | + moderate | + small | + moderate to large | + small | H2, H3b, H3d |
| BFI-2 Open-Mindedness | + small | + small | + small (below SBI) | + small | H3b |
| BFI-2 Aesthetic Sensitivity | + small | + small | + moderate | + small | H3d |
| BIDR SDE | + small | near zero | near zero | + small | H3c (all \|r\| < .30) |
| BIDR IM | near zero | near zero | near zero | near zero | H3c |
| PHQ-4 | − small | near zero | near zero | − small | |
| PSS-4 | − small | near zero | near zero | − small to moderate | |
| Life satisfaction | + small | near zero | + small | + small | |
| Past week: pause days | + small to moderate | near zero | + small to moderate | near zero | H4 |
| Past week: notice first | + small | + small | near zero | + small to moderate | H4 |
| Past week: time outdoors | + small | near zero | + small | near zero | |

The random-intercept factor is expected to correlate positively with BIDR SDE and IM, because both are agreement-prone. Its correlations with every validity measure are reported; this is exploratory.

### Transformations

- Reverse-keyed items are recoded (7 − x) for observed scores and the stability analysis. They are left unrecoded in models with the random intercept.
- Validity scales are scored per their manuals. "Prefer not to answer" is missing.

### Inference criteria

Decision rules for H1–H7 are stated above. Two-tailed α = .05 applies unless stated, with Holm correction within each hypothesis family. All other analyses are exploratory and labelled as such.

### Data exclusion

- **Excluded:**
  - staff test enrollments;
  - sessions without a submitted short form;
  - participants who answered **both** instructed-response checks (MAIA-2 and BFI-2) and failed both.
- **Partial sessions:**
  - A check the participant never reached is not a failure.
  - A participant who submitted the short form but stopped before the validity block is kept for H1, invariance and steps 7–10.
  - Validity analyses (H2–H5) use participants who reached the end of the validity block.
  - H6 uses everyone with background answers and the short form.
- **Repeat submissions:** the first complete submission of each questionnaire is used. Flagged re-submissions are dropped by the platform's resubmission rule.
- **Flagged for sensitivity analyses, not excluded:**
  - failing one check, or failing the only check reached;
  - fewer than 2 seconds per item on the short form;
  - a longstring of 10 or more within the short form;
  - "Prefer not to answer" on more than 4 of the 20 items.
- **Follow-up:** completions outside 14–21 days are kept and flagged, and the ICC is reported with and without them.

### Missing data

"Prefer not to answer" and unanswered items are missing:
- **Factor models:** pairwise-available data (`missing = "pairwise"`). Study 1's code used lavaan's default, listwise deletion, and lost 12 of 500 participants, against a registered pairwise rule. Study 2 sets pairwise explicitly.
- **Latent scores:** not used as individual scores. Validity and known-groups tests on latent variables are estimated inside the model.
- **Observed scores:** require at least 80% of items.
- **Regressions:** use complete cases.

The amount of missing data per measure is reported.

### Exploratory analysis

- **Order effects:** does a validity measure's position in the shuffled block affect its mean or its correlation with the short form? The short form always comes first, so its own context is fixed; this is a limit of the design.
- **The bifactor alternative:** a general sense-foraging factor plus four specific factors, with the random intercept, fitted as a bifactor ESEM.
  - ω_h is computed from that model's loadings.
  - It is not computed with `psych::omega`. That function's default `flip = TRUE` re-reverses keyed items and inflated Study 1's reported ω_h from .54 to .70.
- **Latent means:** country and posting differences, where invariance permits.
- **Further outcomes:** `crit_outdoors` and life satisfaction with each factor.
- **The candidate items,** as in steps 7–10.

## 6. Other

- **Relation to the approved protocol.**
  - The REB application planned Study 2 with the full scale and about 450–500 participants, with no retest. The Study 2 amendment changes this:
    - it replaces the full scale with the 20-item short form from Study 1;
    - it raises the target to about 1,000;
    - it changes the life-satisfaction item's format to a six-point face scale, keeping the approved wording.
  - It also adds IUS-12, SBI, BFI-2 Open-Mindedness, EQ Decentering, PSS-4, three past-week items, 24 candidate items (19 new, 5 from Study 1) and the follow-up.
  - Recruitment keeps two postings that differ in framing only, with no screening on practice. The amendment removes the application's country-of-residence filter.
- **Licences.**
  - The PSS-4 is used under a Mapi Research Trust (ePROVIDE) licence for electronic administration.
  - The SBI is used with the author's permission. **[pending]**
  - The BFI-2 and the EQ are used under their published research-use terms.
- **Data sharing.** A de-identified dataset is shared as described in the consent form. The analysis code is in the project repository (Normega/sense-foraging-scale), to be made public at publication.
- **Open points from the review, not yet decided [Norm].** Each would change materials, so the amendment:
  - asking the past-week items again at the follow-up, about the intervening fortnight, so H4 has a forward-looking criterion;
  - adding 4–6 parallel items without "sensing mode" wording to the candidate block, to test whether the course's vocabulary carries variance of its own;
  - adding an instructed-response item to the candidate block, so there is a check before the validity block.

### References

- Chen, F. F. (2007). Sensitivity of goodness of fit indexes to lack of measurement invariance. *Structural Equation Modeling, 14*(3), 464–504.
- Forero, C. G., Maydeu-Olivares, A., & Gallardo-Pujol, D. (2009). Factor analysis with ordinal indicators: A Monte Carlo study comparing DWLS and ULS estimation. *Structural Equation Modeling, 16*(4), 625–641.
- Maydeu-Olivares, A., & Coffman, D. L. (2006). Random intercept item factor analysis. *Psychological Methods, 11*(4), 344–362.
- Wu, H., & Estabrook, R. (2016). Identification of confirmatory factor analysis models of different levels of invariance for ordered categorical outcomes. *Psychometrika, 81*(4), 1014–1045.
- Measure citations: see *Study2_Measures.docx*.
