# Sense Foraging Scale, Study 2: confirmatory structure, validity and stability of the 20-item short form

**DRAFT, 2026-10-11, not filed.**

- OSF Preregistration (standard template).
- University of Toronto REB Protocol #00051180; the Study 2 amendment is not yet submitted.
- Decisions still marked **[Norm]** must be settled before filing.

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
- **Letting be:** leaving what is noticed unelaborated and unresolved; its positive pole is not needing to add meaning or to know what comes next.

From these results we fixed a 20-item short form: five items per factor, each factor mixing forward- and reverse-keyed items.

Study 2 tests that short form in a new sample:
1. **Structure:** whether the four-factor model with an agreement factor fits.
2. **Validity:** whether each factor relates to established measures as predicted, including measures it should *not* resemble.
3. **Incremental validity:** whether the factors explain wellbeing and stress beyond trait mindfulness and interoceptive awareness.
4. **Invariance:** whether the structure is equivalent across recruitment postings, countries and gender.
5. **Stability:** how stable scores are over two weeks, in an invited subsample.

### Hypotheses

Confirmatory hypotheses are numbered H1–H7. Their tests and decision rules are in Section 5.

- **H1 (structure).** The model with four correlated content factors and a random intercept fits the 20 items acceptably. The four factors are those in Section 4 (the short-form key). The random intercept is the agreement factor, with variance > 0. Study 1's item–factor assignments are kept, with no cross-loadings.
- **H2 (convergent validity).** Each factor correlates positively, at least moderately (r ≥ .30), with the established measure closest to it:
  - Access with FFMQ-15 Observing;
  - Access with MAIA-2 Attention Regulation;
  - Letting be with EQ Decentering;
  - Letting be with IUS-12 (negatively, r ≤ −.30);
  - Valuing and savouring with SBI Savoring the Moment.
- **H3 (discriminant validity).**
  - (a) Each factor's correlation with its convergent measure in H2 is below .80. Latent correlations count: the factor is not that measure.
  - (b) Valuing and savouring correlates more strongly with SBI Savoring the Moment than with BFI-2 Open-Mindedness. This tests whether the factor reflects valuing sensory engagement in particular, not a general appetite for experience.
  - (c) No factor correlates with either BIDR-16 subscale beyond |r| = .30.
- **H4 (criterion validity).**
  - Access and Valuing and savouring correlate positively with the number of past-week days on which the participant deliberately paused to take in their surroundings (`crit_pause_days`).
  - Letting be and Access correlate positively with noticing unexpected events before reacting (`crit_notice_first`).
- **H5 (incremental validity).** The four factors together explain variance in at least one of three outcomes: life satisfaction, PHQ-4 or PSS-4. This is variance beyond FFMQ-15, MAIA-2, age and gender (ΔR² > 0, p < .05).
- **H6 (known groups).** Dedicated practitioners score higher than people who have never practised regularly on Access and on Valuing and savouring (d ≥ 0.50). Dedicated means practising 3 or more times a week, for at least a year, with formal teacher-led training.
  - In Study 1, practitioners at least weekly scored higher than never-practitioners on Access (d = 0.72) and Valuing and savouring (d = 1.22), on factor scores with agreement removed. Understanding the modes and Letting be did not differ.
  - H6 tests whether this replicates under the stricter definition. Understanding the modes and Letting be are compared too, with no directional prediction.
- **H7 (stability).** Over 14–21 days, each factor score has a test–retest ICC(2,1) (absolute agreement) of at least .70.

## 2. Design plan

### Study type

Observational study: a single-session online survey, plus an optional follow-up session for a random subsample.

### Blinding

No blinding is involved. The debrief explains the aims.

### Study design

The main session takes about 20 minutes and runs in this order:
1. **Background questions:** the 13 questions from Study 1, unchanged.
2. **The short form:** the 20 items in one fixed order on 3 pages (7/7/6). The response scale is 1 Strongly disagree to 6 Strongly agree, with no midpoint, plus "Prefer not to answer".
3. **Twenty-four candidate items:** unscored, on the same scale, on 3 pages of 8 in a constrained random order per participant (items written for the same factor never adjacent; reversed items 3–4 a page, never first; opposite or look-alike pairs on different pages). Nineteen are new; five are Study 1 items with their wording unchanged.
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
   - a life-satisfaction slider.
5. **Debrief.**

Every item except the two checks offers "Prefer not to answer". The exact materials are in the supplementary file *Study2_Measures.docx*.

**Follow-up.** About 14 days after their main session, about 200 randomly selected completers are invited through a Prolific custom allowlist. The window is 7 days and the target is about 150 completions. The follow-up repeats the 20-item short form only, in the same fixed order.

**Recruitment.** Two Prolific postings, as in Study 1:
- **General posting:** no practice screening.
- **Contemplative posting:** restricted with Prolific's screeners to people reporting regular meditation or mind-body practice, as in the approved protocol. **[Norm: list the exact Prolific filters used.]**

Both postings lead to the identical study, and the posting is recorded.

### Randomization

- The order of the validity measures is a seeded random permutation per participant (`shuffle_group`), stable on reload. Each participant's order is recorded.
- The short form is in one fixed order for everyone, the same order as in the course trial, so scores are comparable across uses.
- Follow-up invitations go to a simple random sample of eligible completers, drawn by script with a recorded seed.

## 3. Sampling plan

### Existing data

**Registration prior to creation of data.** No Study 2 data exist. The short form was selected from Study 1, which is a separate sample.

The short form is also the baseline and final measure of a separate course trial; those data are not used here.

### Data collection procedures

- **Participants:**
  - Prolific participants, 18 or older, fluent in English.
  - **Resident in the United States, United Kingdom, Canada, Australia, Ireland or New Zealand.** Both postings filter on this with Prolific's "current country of residence".
  - Study 1 set no country filter, and 69% of its sample lived elsewhere. The six countries are the ones the approved materials and the debrief's crisis resources cover.
- **Excluded from both postings:** Study 1 participants (Prolific exclusion list). The contemplative posting also excludes general-posting participants.
- **Platform:**
  - The RADlab research platform. Prolific IDs are held in a separate table and replaced by a random code in all study data.
  - The IDs are kept until the follow-up closes. They are deleted after the main and follow-up codes are linked.
- **Compensation:** USD 12 per hour, prorated: about USD 4.00 for the main session and about USD 0.60 for the follow-up. Payment does not depend on answers.

### Sample size

- **Main session:** 500 completers, 300 on the general posting and 200 on the contemplative posting.
- **Follow-up:** about 150 completers out of about 200 invited.

### Sample size rationale

- **CFA.**
  - Ordinal CFA of 20 items with four factors (five indicators each) and a random intercept.
  - Simulation work on ordinal CFA with 4–6 categories and five indicators per factor finds stable estimates and accurate fit statistics from N ≈ 300 (e.g. Forero, Maydeu-Olivares & Gallardo-Pujol, 2009).
  - 500 also supports multi-group models with groups of 200 or more.
- **Correlations.** With N = 500, a correlation of .30 has a 95% CI of about ±.08, enough to tell a moderate correlation from a small one.
  - H3b compares two dependent correlations. It has about 80% power to detect a difference of .10 when both correlations are near .40 and the two measures correlate .50 with each other.
- **Known groups.**
  - In Study 1, 34 of 500 participants met the dedicated-practitioner definition.
  - A screened contemplative posting of 200 should yield about 60–80, against about 150 never-practitioners.
  - With 60 and 150, power is 80% for d = 0.43, comfortably below the d ≥ 0.50 predicted from Study 1.
- **Stability.** With 150 retest pairs and a true ICC of .75, the 95% CI is about ±.08.

### Stopping rule

Places are fixed on Prolific in advance:
- **Main:** 300 general and 200 contemplative.
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
  - **Understanding the modes:** `sfc_2`, `sfc_3`, `sfc_7`, `sfc_8`, `sfc_9` (2, 3, 9 reversed), about recognising one's own mode in the moment.
  - **Letting be:** `sfc_5`, `sfc_6`, `sfc_10`–`sfc_14` (12, 13, 14 reversed). Quiet labelling and noticing pleasant or unpleasant count as part of the sensing mode, as the course teaches; only elaborating, explaining or acting on what is noticed counts against letting be.
  - **Valuing and savouring:** `sfc_4`, `sfc_15` (both reversed).
  - **Forage:** `sfc_16`–`sfc_20` (19, 20 reversed): the seeking itself, searching the senses for something without knowing where it will turn up. Study 1's discovery items measured valuing discovery and loaded with Valuing once agreement was modelled.
  - **Study 1 items, wording unchanged:** `sfc_21`–`sfc_23` (Study 1 items 6, 2, 14; Access) and `sfc_24`, `sfc_25` (items 25, 28; Valuing and savouring), so the more reliable 14-item Access + Valuing form found in Study 1 (Access 9, 7, 6, 2, 8, 14, 36R, 35R; Valuing 18, 12, 25, 27, 28, 44R) can be fitted in Study 2.
- **FFMQ-15:** Observing, Describing, Acting with awareness, Nonjudging, Nonreactivity (3 items each).
- **MAIA-2:** eight subscales.
- **BIDR-16:**
  - Self-Deceptive Enhancement and Impression Management, 8 items each;
  - scored continuously (mean of 1–7) and, for sensitivity, dichotomously (Paulhus).
- **IUS-12:** total score, plus Prospective (7 items) and Inhibitory (5 items) anxiety.
- **SBI Savoring the Moment:** 8 items (SBI items 2, 5, 8, 11, 14, 17, 20, 23), mean score; items 2, 8, 14 and 20 are reverse-scored.
- **BFI-2 Open-Mindedness:** 12 items, with facets Intellectual Curiosity, Aesthetic Sensitivity and Creative Imagination.
- **EQ Decentering:** 11 items, 1–5.
- **PSS-4:** 0–16; items 2 and 3 reverse-scored.
- **PHQ-4:** 0–12, plus anxiety and depression subscales (0–6 each).
- **Life satisfaction:** a single slider item.
- **Past week:**
  - `crit_pause_days` (0–7);
  - `crit_notice_first` (1–5, with "nothing unexpected happened" set to missing);
  - `crit_outdoors` (0–4, ordinal).
- **Background questions:** as in Study 1.
- **Paradata:**
  - the presented order of the validity block;
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
- **Country group:** United Kingdom; United States and Canada; Australia, Ireland and New Zealand. Any group under 100 is merged with its nearest neighbour.
- **Scale scores:** mean of available items, after reverse-scoring, when at least 80% of the scale's items are answered.

## 5. Analysis plan

### Statistical models

All analyses use R with lavaan, semTools, psych and irr; versions will be reported. Short-form items are treated as ordinal (WLSMV, theta parameterization).

1. **H1, confirmatory model.**
   - **Model A:** four correlated factors, simple structure, plus a random-intercept factor:
     - loadings fixed at 1 on all 20 unrecoded items;
     - variance estimated;
     - uncorrelated with the content factors.
   - **Comparison models:** Model A without the random intercept, and a one-factor model with the random intercept.
   - **H1 is supported** when Model A has CFI ≥ .95, RMSEA ≤ .06 (upper 90% CI ≤ .08) and SRMR ≤ .08, and the random-intercept variance is > 0 (p < .05).
   - **Acceptable but not good** fit (CFI .90–.95, RMSEA ≤ .08) is reported as partial support.
   - Modification indices are reported; the model is not re-specified on their basis for the confirmatory test.
   - **Reliability:** ordinal ω for each factor.
2. **H2–H4, validity.**
   - **Primary analysis:**
     - start from Model A;
     - add each validity score in turn as an observed variable correlated with the four content factors and uncorrelated with the random intercept;
     - estimate the latent–observed correlations with 95% CIs.
   - **Secondary analysis:** correlations of observed short-form factor scores (means) with validity scores, Pearson with 95% CIs. They are reported in full as the validity matrix below.
   - **H2:** each listed correlation is in the predicted direction with a 95% CI lower bound above .30 in absolute value. The lower bound is .10 for "small" predictions.
   - **H3a:** the upper bound of each convergent correlation's 95% CI is below .80.
   - **H3b:** Valuing and savouring's correlation with SBI exceeds its correlation with BFI-2 Open-Mindedness. This is tested as a bootstrap difference in the latent model, with 2,000 resamples and a 95% CI excluding 0.
   - **H3c:** every 95% CI for the correlations with BIDR SDE and IM lies within ±.30.
   - **H4:** the listed correlations are positive, one-tailed α = .05, Holm-corrected across the four tests.
3. **H5, incremental validity.** For each outcome (life satisfaction, PHQ-4 total, PSS-4) there is a hierarchical regression on observed scores:
   - **Step 1:** age, gender, FFMQ-15 total and MAIA-2 total;
   - **Step 2:** the four short-form factor scores.
   - The ΔR² F-test is Holm-corrected across the three outcomes, and the standardized coefficients are reported.
   - A latent version, in which the outcome is regressed on the latent factors and the covariates, is reported alongside.
4. **Invariance.** This analysis is exploratory but specified in advance. It compares groups by:
   - posting;
   - gender (men vs women; other categories are too small);
   - country group.

   Ordinal invariance follows Wu and Estabrook (2016):
   - configural;
   - thresholds;
   - thresholds and loadings;
   - thresholds, loadings and intercepts.

   The random-intercept loadings stay fixed at 1 in every group, and its variance is free across groups. Non-invariance is a ΔCFI below −.010 with ΔRMSEA above .015 (Chen, 2007). Partial invariance is then examined item by item.
5. **H6, known groups.**
   - Compare dedicated practitioners with never-practitioners on each factor score using a linear model with posting as a covariate.
   - Report Cohen's d with a 95% CI and Holm correction across the four factors.
   - **H6 is supported** for Access and for Valuing and savouring when the difference favours dedicated practitioners, p_Holm < .05, and d ≥ 0.50.
   - **Secondary:** a linear trend across frequency categories in all practising participants.
   - The known-groups comparison is repeated on latent means in the posting-invariant model, if scalar invariance holds across practice groups.
6. **H7, stability.**
   - For each factor score: ICC(2,1), absolute agreement, with a 95% CI.
   - SEM = SD_baseline × √(1 − ICC).
   - MDC95 = 1.96 × √2 × SEM, reported in raw-score units.
   - **H7 is supported** for a factor when its ICC point estimate is ≥ .70.
   - Also reported:
     - follow-up responders compared with non-responders on baseline scores;
     - the random-intercept factor's stability, as the ICC of person-mean agreement across all 20 unrecoded items.
7. **Candidate items (exploratory, selection rules fixed here).**
   - The sample is split at random into two halves, stratified by posting, with a recorded seed: a **selection half** and a **holdout half**. All other analyses use the full sample.
   - On the selection half: an ESEM of the 20 short-form items plus the 19 new candidates and the 5 Study 1 items, target-rotated toward the four factors (candidates targeted to their a-priori factor), with the random intercept on all 34 unrecoded items.
   - A candidate qualifies as a replacement when, on its intended factor:
     1. its primary loading is ≥ .50 and no other loading is ≥ .30;
     2. swapping it for the factor's weakest current item raises the factor's ordinal ω;
     3. the factor keeps at least one item of each keying direction;
     4. its "Prefer not to answer" rate is ≤ 5%.
   - At most two items per factor are replaced, so the revised form keeps 5 items per factor (20 in all). Every replacement and the reason for it are reported.
8. **Revised form, if any (exploratory).** Any form produced by step 7 is fitted as Model A on the **holdout half** only, by the H1 criteria, and its ω and its validity correlations are reported beside the fixed form's. This is an internal check: the revised form's confirmation in an independent sample (the course's intake data or a third study) is planned separately. The fixed 20-item form remains the instrument of record for the PSY240 trial.
9. **Forage (exploratory).** On the full sample: (a) the five Forage items' α, mean inter-item correlation and correlation with the agreement index; (b) whether they form a factor of their own in an ESEM with five content factors plus the random intercept (Forage targeted), or load with Valuing and savouring or Access as Study 1's discovery items did; (c) their correlations with the past-week item on deliberately pausing to take in one's surroundings, with practice frequency, and with BFI-2 Open-Mindedness and SBI Savoring the Moment.
10. **The 14-item Access + Valuing form (exploratory).** The two-factor model (Access 8 items, Valuing and savouring 6) with the random intercept, by the H1 criteria; ordinal ω per factor; and its known-groups and validity correlations beside the fixed form's Access and Valuing subscales. Its items were chosen on Study 1's data, so this is its first test in independent data.

### Predicted validity matrix

Correlations are between latent factors and observed scores. "Near zero" means |r| < .20. The **H** column marks cells that are confirmatory tests; all other cells are reported against these predictions, descriptively.

| Measure | Access | Understanding the modes | Valuing and savouring | Letting be | H |
|---|---|---|---|---|---|
| FFMQ Observing | + moderate (.30–.50) | + small | + moderate | + small | H2 (Access) |
| FFMQ Describing | + small | + small | near zero | near zero | |
| FFMQ Acting with awareness | + small | near zero | near zero | + small | |
| FFMQ Nonjudging | + small | near zero | near zero | + small to moderate | |
| FFMQ Nonreactivity | + moderate | + small | + small | + moderate | |
| MAIA-2 Noticing | + moderate | + small | + small | near zero | |
| MAIA-2 Attention Regulation | + moderate | + small | + small | + small | H2 (Access) |
| MAIA-2 Not-Worrying, Not-Distracting | near zero | near zero | near zero | + small | |
| MAIA-2 Body Listening, Trusting | + small to moderate | + small | + moderate | near zero | |
| EQ Decentering | + moderate | + small to moderate | + small | + moderate | H2 (Letting be) |
| IUS-12 | − small | near zero | near zero | − moderate (≤ −.30) | H2 (Letting be) |
| SBI Savoring the Moment | + moderate | + small | + moderate to large | + small | H2, H3b |
| BFI-2 Open-Mindedness | + small | + small | + small (below SBI) | + small | H3b |
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

- Reverse-keyed items are recoded (7 − x) for scale scores, ω and the stability analysis, and left unrecoded in models with the random intercept.
- Validity scales are scored per their manuals. "Prefer not to answer" is missing.

### Inference criteria

Decision rules for H1–H7 are stated above. Two-tailed α = .05 applies unless stated, with Holm correction within each hypothesis family. All other analyses are exploratory and labelled as such.

### Data exclusion

- **Excluded:**
  - staff test enrollments;
  - sessions without a submitted short form;
  - participants failing **both** instructed-response checks (MAIA-2 and BFI-2).
- **Validity analyses** additionally require that the participant reached the end of the validity block. Partial sessions contribute to H1.
- **Repeat submissions:** the first complete submission of each questionnaire is used. Flagged re-submissions are dropped by the platform's resubmission rule.
- **Flagged for sensitivity analyses, not excluded:**
  - failing one check;
  - fewer than 2 seconds per item on the short form;
  - a longstring of 10 or more within the short form;
  - "Prefer not to answer" on more than 4 of the 20 items.
- **Follow-up:** completions outside 14–21 days are kept and flagged, and the ICC is reported with and without them.

### Missing data

"Prefer not to answer" and unanswered items are missing:
- **WLSMV** uses pairwise-available data.
- **Scale scores** require at least 80% of items.
- **Regressions** use complete cases.

The amount of missing data per measure is reported.

### Exploratory analysis

- Order effects: does a validity measure's position in the shuffled block affect its mean or its correlation with the short form?
- The bifactor alternative: a general sense-foraging factor plus four specific factors. Report ω_h, as in Study 1.
- Country and posting differences in latent means, where invariance permits.
- `crit_outdoors` and life satisfaction with each factor.
- The candidate items, as in steps 7–10.

## 6. Other

- **Relation to the approved protocol.**
  - The REB application planned Study 2 with the full scale. The Study 2 amendment replaces it with the 20-item short form from Study 1.
  - It also adds IUS-12, SBI, BFI-2 Open-Mindedness, EQ Decentering, PSS-4, three past-week items, 24 candidate items (19 new, 5 from Study 1) and the follow-up.
- **Licences.**
  - The PSS-4 is used under a Mapi Research Trust (ePROVIDE) licence for electronic administration.
  - The SBI is used with the author's permission. **[pending]**
  - The BFI-2 and the EQ are used under their published research-use terms.
- **Data sharing.** A de-identified dataset is shared as described in the consent form. The analysis code is in the project repository (Normega/sense-foraging-scale), to be made public at publication.

### References

- Chen, F. F. (2007). Sensitivity of goodness of fit indexes to lack of measurement invariance. *Structural Equation Modeling, 14*(3), 464–504.
- Forero, C. G., Maydeu-Olivares, A., & Gallardo-Pujol, D. (2009). Factor analysis with ordinal indicators: A Monte Carlo study comparing DWLS and ULS estimation. *Structural Equation Modeling, 16*(4), 625–641.
- Maydeu-Olivares, A., & Coffman, D. L. (2006). Random intercept item factor analysis. *Psychological Methods, 11*(4), 344–362.
- Wu, H., & Estabrook, R. (2016). Identification of confirmatory factor analysis models of different levels of invariance for ordered categorical outcomes. *Psychometrika, 81*(4), 1014–1045.
- Measure citations: see *Study2_Measures.docx*.
