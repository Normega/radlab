# Psychometric effects of reverse-keyed / negatively worded items in Likert self-report scales

Scope note: compiled 2026-10-10 for a decision about adding a subset of reverse-keyed items to a new 34-item, 6-point (no midpoint, per-item "Prefer not to answer") agree-disagree scale headed for EFA then CFA. Numbers marked "(full text read)" were read from the primary paper's own text. Numbers taken only from abstracts, publisher pages or secondary summaries are marked that way. Terminology: *regular* = keyed in the construct direction; *reversed / reverse-keyed* = must be recoded; *negated* = contains a negation particle ("not"); *polar opposite* = uses an antonym core concept ("quiet" vs "talkative"). These are separate dimensions: "not quiet" is negated **and** polar-opposite but **not** reversed.

## 1. Taxonomy: negation vs polar-opposite vs reversal, and which causes most trouble

### Takeaway
The field now separates three things: *reversal* (keying direction), *negation* (a "not"), and *polar-opposite core concept* (an antonym). Contrary to the common advice to "use antonyms rather than negations," the only study that estimates all three separately (Baumgartner, Weijters & Pieters 2018) found the **largest** misresponse for polar-opposite items. Randomized experiments that hold content fixed (Zhang et al. 2016; Suárez-Álvarez et al. 2018) show that the problem is **mixing** directions, not reversed wording as such: all-reversed versions fit a single factor about as well as all-regular versions.

### Cited Findings
- Weijters & Baumgartner (2012), "Misresponse to reversed and negated items in surveys: A review," *Journal of Marketing Research* 49(5), 737–747. Distinguishes reversed items from negated items. Lists the benefits (acquiescence control, disruption of nonsubstantive responding, broader construct coverage) and the costs (low reliability, complex factor structures). Advocates continued but cautious use. Based on a review plus data on 1,330 items from scales published in *JMR* and *JCR* — [Penn State Pure](https://pure.psu.edu/en/publications/misresponse-to-reversed-and-negated-items-in-surveys-a-review/) (abstract only; the per-item counts from the 1,330-item audit were not retrieved).
- Baumgartner, Weijters & Pieters (2018), "Misresponse to survey questions: A conceptual framework and empirical test of the effects of reversals, negations, and polar opposite core concepts," *JMR* 55(6), 869–883. The framework separates reversal misresponse, negation misresponse and polar-opposite misresponse. There are two broad causes: lack of motivation ("inattention") and lack of ability ("difficulty"). Study 2 used eye tracking. The authors conclude that "difficulty rather than inattention may be a more potent cause of misresponse than has traditionally been acknowledged" — [Tilburg Univ. record](https://research.tilburguniversity.edu/en/publications/misresponse-to-survey-questions-a-conceptual-framework-and-empiri/).
- Effect sizes from Baumgartner's 2018 presentation of the same work (extraversion items: talkative / not talkative / quiet / not quiet, with outgoing, sociable and full-of-energy as reference items). Estimated misresponse effects on loadings, with 95% CIs: **negation MR −.17 [−.58, .24]; polar-opposite MR −.55 [−.97, −.15]; reversal MR −.26 [−.68, .15]**. Only the polar-opposite effect excludes zero. Eye tracking showed some respondents looked longer at negated, polar-opposite or reversed items and still misresponded ("MR due to difficulty") — [Baumgartner, Univ. Vienna talk slides 2018](https://wiwi.univie.ac.at/fileadmin/user_upload/f_wiwi/News/Events/2018/Baumgartner.pdf) (slide text read). Caveat: these are slide figures from one illustrative item set, not the full published tables.
- Zhang, Noor & Savalei (2016), *PLoS ONE* 11(6): e0157795, 18-item Need for Cognition, N = 1,266 UBC undergraduates randomized to 4 versions (full text read). One-factor CFA fit:

  | Version | n | CFI | RMSEA | α |
  |---|---|---|---|---|
  | Original, mixed | 312 | .70 | .12 | .88 |
  | All positive | 316 | .89 | .10 | .95 |
  | All reversed, polar-opposite ("Reverse-I") | 320 | .89 | .09 | .94 |
  | All reversed, mix of polar-opposite and negated ("Reverse-II") | 318 | .86 | .09 | .91 |

  In Reverse-II, a method factor on the **polar-opposite** items fit considerably better than one factor. The authors conclude that both the number and the type of reversed items affect factor structure — [PMC4909292](https://pmc.ncbi.nlm.nih.gov/articles/PMC4909292/).
- Suárez-Álvarez et al. (2018), *Psicothema* 30(2), 149–158. Repeated-measures design: N = 374 adults (18–73) each took a regular, a reversed and a combined form of a 20-item, 5-point self-efficacy test, at least a week apart. The reversed items were 4 negations and 16 antonyms. No pattern of discrimination loss was found by reversal strategy (negation vs antonym) (full text read) — [Psicothema PDF](https://www.psicothema.com/pdf/4463.pdf).
- Barnette (2000), *Educational and Psychological Measurement* 60(3), 361–370, "Effects of stem and Likert response option reversals on survey internal consistency: If you feel the need, there is a better alternative to using those negatively worded stems." Compared negated stems against reversing the *response-option order* and recommended the latter — [GESIS record](https://data.gesis.org/gesiskg/resource/zis-Barnette2000Effects) (title and bibliographic data only; alpha values not retrieved).
- Elek, Cígler, Grüning & Ježek (2025), *Frontiers in Psychology* 16:1684612. A review proposing a 2×2 taxonomy (regular "I am tall" / negation "I am not tall" / antonym "I am short" / negated antonym "I am not short"). Notes that negations are more cognitively demanding (more eye revisits). Concludes that "clear guidelines for scale development cannot be provided" until the linguistic properties of items (markedness, bounded vs unbounded antonyms) are studied — [PMC12581211](https://pmc.ncbi.nlm.nih.gov/articles/PMC12581211/).
- Steinmann (IEA white paper, 2024): if mixed wording is used anyway, use "antonyms that unambiguously express opposite statements." Also observes that many "negatively worded" large-scale-assessment items are not true antonyms of the regular items (e.g., "Mathematics makes me nervous" vs "My teacher tells me I am good at mathematics") — [IEA white paper](https://www.iea.nl/sites/default/files/2024-04/To-Mix-or-Not-to-Mix-Positively-and-Negatively-Worded-Items.pdf).

### Inferences
- The "use antonyms, not negations" heuristic is not well supported. The best separated estimate (BWP 2018) and Zhang et al.'s Reverse-II result both point to polar-opposite items as at least as troublesome as negations. Reconciling them with Steinmann's advice: the polar-opposite items that cause trouble are probably **not true contradictories**. "Quiet" is not the logical negation of "talkative," so a mid-trait respondent can sensibly agree with both. An antonym that is a genuine contradictory of a regular item is likely safer.
- Avoid negated polar-opposites ("I am not unhappy"): they require double processing and are logically weaker.
- In all three randomized studies (Zhang 2016; Suárez-Álvarez 2018; Zeng et al. 2024, §4), single-direction forms fit better than mixed forms. So the cost comes mainly from **mixing**, not from reversed wording per se.

### Gaps
- No meta-analytic effect size compares negated vs polar-opposite misresponse. BWP 2018's full tables (both studies) were not retrieved; the slide figures are one illustration.
- Schriesheim's work (e.g., Schriesheim & Hill 1981; Schriesheim, Eisenbach & Hill 1991) on negated vs "polar opposite" vs regular items was not retrieved and is unverified here.
- Barnette (2000) alpha values by condition were not retrieved.

## 2. Misresponse: how common it is, who misresponds, and how scale format matters

### Takeaway
Misresponse to reversed items is common. About 20% of responses on average in Swain et al. (2008). Respondent-level estimates of "inconsistent responders" run from 1% to 36% across samples (mostly 4–20% in adult and adolescent data). It is predicted mainly by lower reading or cognitive ability and age (children), secondarily by low conscientiousness or inattention. It depends strongly on response format. **Most relevant here:** in the one experiment that varied it (Weijters, Cabooter & Schillewaert 2010), even-numbered scales **without a midpoint** showed far higher measured misresponse (57–65% of respondents on a reversed pair) than 5- or 7-point scales with a midpoint (10–38%). That is the format this lab plans to use.

### Cited Findings
- **Swain, Weathers & Niedrich (2008)**, *JMR* 45(1), 116–131. Misresponse defined as a response on the same side of the neutral point for a reversed and a non-reversed item. It averaged **about 20%**. Results support an "item verification difficulty" account: misresponse rises with the number of cognitive operations needed to compare the item with one's belief, and is especially high when a respondent's true state must be expressed by disagreeing with a negated item — [LSU repository](https://repository.lsu.edu/marketing_pubs/36) (abstract level).
- **Weijters, Cabooter & Schillewaert (2010)**, *International Journal of Research in Marketing* 27(3), 236–247 (working-paper full text read).
  - **Design.** Belgian online-panel men, N = 1,207, ages 15–65 (median 49). Eight randomized formats: 4, 5, 6 or 7 categories × endpoints-only vs fully labelled.
  - **MR measure.** Score 1 if a respondent was on the same side of the scale for both items of a reversed pair (Swain et al. definition). Three reversed item pairs about a GPS brand.
  - **Table 3, % of respondents misresponding (average over the 3 pairs):**

    | Labelling | 4-pt | 5-pt | 6-pt | 7-pt |
    |---|---|---|---|---|
    | All labelled | 61.8% | 10.5% | 56.6% | 14.9% |
    | Endpoints only | 57.3% | 22.8% | 64.5% | 38.4% |

    Grand average 40.8%. The experimental factors explained 45.2% of variance in the latent MR factor (vs 11.3% for acquiescence and 15.3% for extreme responding).
  - **Format effects.**
    - Full labelling lowers MR.
    - Adding a midpoint lowers MR, and more so when fully labelled.
    - Adding gradations raises MR only when just the endpoints are labelled.
    - MR was mostly "negative": 39% agreed with neither item vs 2% with both.
  - **Recommendations.** "Avoid scales without a midpoint, unless particular, relevant reasons present themselves." Use 5-point fully labelled scales for general-population samples. If reversed items must be used with endpoint-labelled formats, disperse them among buffer items and model a method factor — [Vlerick working paper 2010/07 PDF](https://public.vlerick.com/Publications/74eb09c8-6aa9-e011-8a89-005056a635ed.pdf); [IJRM record](https://ideas.repec.org/a/eee/ijrema/v27y2010i3p236-247.html).
  - **Caveat (my reading of their method).** With a midpoint, a neutral answer can never count as MR. Without one, a genuinely ambivalent respondent is forced to one side on both items and is mechanically counted as a misresponder. Part of the even-scale MR is therefore a measurement artefact of the MR definition. But it is also exactly what will show up as inconsistency in a no-midpoint scale's factor structure. The item pairs were also loose opposites ("I love this brand" / "I find this a very bad brand").
- **Kam, Meyer & Sun (2021)**, "Why do people agree with both regular and reversed items? A logical response perspective," *Assessment*. Differential responding to regular vs reversed items was **highest at mid-trait levels** and fell toward the extremes (quadratic, trait × method interaction). For people near the middle of a trait it is logical to agree, or disagree, with both an item and its loose opposite, and this alone can make a unidimensional construct look two-dimensional — summarized in [Elek et al. 2025 review, PMC12581211](https://pmc.ncbi.nlm.nih.gov/articles/PMC12581211/) and search-result abstracts (primary not read).
- **Prevalence across studies.** Different methods flag **1% to 36%** of respondents as answering items with opposite meanings too similarly (children, adolescents and adults; citing Arias et al. 2020; Bulut & Bulut 2022; Chen et al. 2024; García-Batista et al. 2021; Hong et al. 2020; Steedle et al. 2019; Steinmann et al. 2022, 2024; Swain et al. 2008) — [Steinmann, IEA white paper 2024](https://www.iea.nl/sites/default/files/2024-04/To-Mix-or-Not-to-Mix-Positively-and-Negatively-Worded-Items.pdf).
  - Steinmann, Strietholt & Braeken (2022), *Psychological Methods* 27(4), 667–702. A constrained factor-mixture model found **7–20%** of respondents in the inconsistent class across datasets — [CEMO/UiO record](https://uv.uio.no/cemo/om/aktuelt/publikasjoner/2021/a-constrained-factor-mixture-analysis-model-for-co.html).
  - PIRLS/TIMSS 2011 fourth-graders: from 2% (Sweden) to 36% (Honduras). TIMSS 2019: from 1% (Lithuania, grade 8) to 21% (South Africa, grade 4). Shares were significantly larger in grade 4 than grade 8 across 38 countries, and countries' shares correlated strongly and negatively with mean achievement — [IEA white paper](https://www.iea.nl/sites/default/files/2024-04/To-Mix-or-Not-to-Mix-Positively-and-Negatively-Worded-Items.pdf).
  - Arias et al. (2020), *Behavior Research Methods* 52(6), 2489–2505. A factor-mixture model flagged **4.4–10%** of respondents as careless/insufficient-effort across scales and samples — [USAL record](https://produccioncientifica.usal.es/documentos/60055ebb68c34960007088fc).
- **Predictors.**
  - Steinmann, Chen & Braeken (2024; *Assessment in Education*) entered mathematics achievement, age, home language and gender as simultaneous predictors. **Achievement was the strongest predictor** of inconsistency.
  - Chen, Steinmann & Braeken (2024; *Personality and Individual Differences* 222, 112573) entered cognitive and reading measures plus the Big Five together. **Low reading comprehension was the strongest predictor**, followed by low conscientiousness.
  - Steinmann, Strietholt & Braeken (2022) found no conscientiousness association.
  - All three summarized in the [IEA white paper](https://www.iea.nl/sites/default/files/2024-04/To-Mix-or-Not-to-Mix-Positively-and-Negatively-Worded-Items.pdf).
- **Gnambs & Schroeders**, "Cognitive abilities explain wording effects in the Rosenberg Self-Esteem Scale," *Assessment* (online 2017, DOI 10.1177/1073191117746503; print 2020). N = 12,437 German students in a representative assessment. A bifactor model with a negative-wording factor fit best. Local SEM showed **unidimensionality increased and negative-wording variance decreased with higher reading competence and reasoning**. The authors interpret the wording effect as a response-style artefact tied to cognitive ability — [Univ. Kassel KOBRA](https://kobra.uni-kassel.de/handle/123456789/12439).
- **Marsh (1996)**, *Journal of Personality and Social Psychology* 70(4), 810–819. The positive/negative self-esteem factors were **most distinct among children with poor reading scores**, which supports a method-effect (verbal ability) account — [ACU Research Bank](https://acuresearchbank.acu.edu.au/item/86x04/positive-and-negative-global-self-esteem-a-substantively-meaningful-distinction-or-artifactors).
- **Suárez-Álvarez et al. (2018)** report that verbal skills influenced responses to the mixed form (full text read; conclusion "e) verbal skills influence examinees' responses") — [Psicothema PDF](https://www.psicothema.com/pdf/4463.pdf).
- **Acquiescence by population.** Acquiescence is more pronounced in children, adolescents and lower-education samples — [Kreitchmann et al. 2019, Frontiers in Psychology, PMC6803422](https://pmc.ncbi.nlm.nih.gov/articles/PMC6803422).

### Inferences
- For a **6-point, no-midpoint, agree–disagree** scale, the best available experiment predicts **substantially elevated misresponse** to reversed items relative to formats with a midpoint. Full labelling of all six categories is the format lever that most reduces it: 56.6% vs 64.5% at 6 points in WCS 2010, a modest gain. That study's 6-point MR rates are probably inflated by the MR definition, so treat them as an upper bound, not a prevalence estimate.
- Kam et al.'s logical-response finding interacts with the no-midpoint design. Mid-trait respondents who cannot choose "neither" are pushed onto one side of both a regular item and its loose opposite. This is a plausible mechanism for a wording factor even in attentive, able respondents.
- "Prefer not to answer" is not a midpoint substitute. If mid-trait respondents use it as a hidden "neutral," missingness may concentrate on reversed items. That should be checked in the pilot.
- For adult online samples, expect roughly 5–15% inconsistent responders. Expect more if the sample includes non-native English speakers or lower-literacy respondents.

### Gaps
- No study found that experimentally manipulates the **6-point** format specifically with true antonym pairs on a psychological (not marketing-brand) scale.
- No primary evidence was found specifically on non-native speakers beyond the "home language" predictor in Steinmann et al. 2024, and its effect size was not retrieved.
- Swain et al.'s per-condition misresponse rates and age/education predictors were not retrieved (abstract only).
- No evidence was found on whether a per-item "Prefer not to answer" option changes misresponse.

## 3. Method factors: do reversed items form spurious factors? Trait or artefact?

### Takeaway
Small fractions of inconsistent respondents are enough to produce a "reversed-items" factor: about 10% in Schmitt & Stults (1985) and Woods (2006). Removing them can make the wording factor practically disappear (Arias et al. 2020). The wording factor is real variance, but its correlates are mostly response-process variables: reading ability, carelessness, acquiescence and mid-trait logical responding. Personality correlates exist (DiStefano & Motl) and the effect shows some cross-scale stability. Kam argues the effect is scale-specific. The meta-analytic Rosenberg evidence puts specific wording factors at under 15% of common variance. The weight of evidence treats it as a **method artefact to be modelled, not a substantive dimension to be interpreted**.

### Cited Findings
- **Schmitt & Stults (1985)**, *Applied Psychological Measurement* 9(4), 367–373. Across three different correlation matrices, "when only 10% of the respondents are careless in this fashion, a clearly definable negative factor is generated" — [UMN Conservancy record](https://conservancy.umn.edu/items/84818ada-669f-4a82-a5dd-556e31cb25f6).
- **Woods (2006)**, *Journal of Psychopathology and Behavioral Assessment* 28(3), 186–191. In simulations, if at least about **10%** of participants respond carelessly to reverse-worded items, researchers are likely to reject a one-factor model for a truly unidimensional scale — [DOI 10.1007/s10862-005-9004-7](https://dx.doi.org/10.1007/s10862-005-9004-7).
- **Arias et al. (2020)**, *BRM* 52(6), 2489–2505. In full samples all theoretical models fit unacceptably and needed extra wording factors. After removing the 4.4–10% careless cases, all models fit satisfactorily and "the wording factors practically disappeared" — [USAL record](https://produccioncientifica.usal.es/documentos/60055ebb68c34960007088fc).
- **Kam & Meyer (2015)**, *Organizational Research Methods* 18(3), 512–541. Online survey of employees (N = 666) on job satisfaction/dissatisfaction. Careless responding and acquiescence together altered the apparent dimensionality, producing spurious satisfaction vs dissatisfaction factors — [ResearchGate record](https://www.researchgate.net/publication/276856947_How_Careless_Responding_and_Acquiescence_Response_Bias_Can_Influence_Construct_Dimensionality_The_Case_of_Job_Satisfaction) (abstract level; exact fit changes not retrieved).
- **Kam (2018)**, "Why do we still have an impoverished understanding of the item wording effect? An empirical examination," *Sociological Methods & Research* 47(3), 574–597. Argues the wording effect is **scale-specific**, so findings about its nature generalize poorly across measures — [IDEAS/RePEc](https://ideas.repec.org/a/sae/somere/v47y2018i3p574-597.html).
- **Marsh (1996)**, *JPSP* 70(4), 810–819. Positive and negative self-esteem "factors" are better explained as a method effect linked to reading ability — [ACU Research Bank](https://acuresearchbank.acu.edu.au/item/86x04/positive-and-negative-global-self-esteem-a-substantively-meaningful-distinction-or-artifactors).
- **DiStefano & Motl (2006)**, *Structural Equation Modeling* 13(3), 440–464. N = 757 adults. Negative-wording method effects appeared on both the RSE and the Social Physique Anxiety Scale and were **significantly correlated across the two scales**, consistent with a response style. A companion paper (DiStefano & Motl 2009, *Personality and Individual Differences*) linked the method effect to personality measures (social desirability, evaluation by others, self-regulation) — [Illinois Experts](https://experts.illinois.edu/en/publications/personality-correlates-of-method-effects-due-to-negatively-worded/).
- **Gnambs, Scharl & Schroeders (2018)**, *Zeitschrift für Psychologie* 226(1), 14–29. Meta-analytic SEM of the RSES, 113 samples, N = 140,671. A bifactor model with positive- and negative-wording specific factors fit best, but **the specific factors accounted for less than 15% of explained common variance**. General-factor loadings were lower in less individualistic countries — [metaSEM documentation (Gnambs18)](https://search.r-project.org/CRAN/refmans/metaSEM/html/Gnambs18.html).
- **Weijters, Baumgartner & Schillewaert (2013)**, "Reversed item bias: An integrative model," *Psychological Methods* 18(3), 320–334 (accepted-manuscript full text read).
  - **Design.** Models acquiescence, careless responding and confirmation bias. Study 1: UK online panel, N = 306, 4 self-esteem items. Study 2: MTurk, N = 595, LOT-R.
  - **Variance attribution.** The method variance from acquiescence, carelessness (instructed-manipulation-check failure) and the residual inconsistency factor, relative to substantive variance, was **.13 (Study 1) and .14 (Study 2)**. The construct contributed about **7–8× more** variance than inconsistency bias.
  - **Item arrangement.** In the grouped-massed arrangement (reversed items after a block of regular items), carelessness was the second-largest variance source after the trait. Dispersing items reduced systematic inconsistency bias but raised random error.
  - **Recommendations.**
    - Disperse items among buffers. If they must be grouped, use **balanced** scales and **alternate** keying.
    - Avoid unbalanced scales where "a few reversed items are included among many regular items," and do not place reversed items after a long run of regular items.
    - Removing reversed items does not remove the biases; it makes them "completely confounded with content variance."
  - Source — [Ghent University accepted manuscript](https://backoffice.biblio.ugent.be/download/4099670/6801377).
- **Suárez-Álvarez et al. (2018)**, combined form (full text read). The one-factor CFA was poor (CFI = .746, TLI = .716, RMSEA = .067, SRMR = .088), versus CFI .903 for the regular form and .911 for the reversed form. A two-factor model (regular, reversed) improved fit to CFI = .942, RMSEA = .032 — [Psicothema PDF](https://www.psicothema.com/pdf/4463.pdf).
- **Steinmann (2024).** Even small shares of inconsistent respondents can lead to **overestimated dimensionality**. However, such effects "were however not found in all studies" (Hong et al. 2020; Steedle et al. 2019) — [IEA white paper](https://www.iea.nl/sites/default/files/2024-04/To-Mix-or-Not-to-Mix-Positively-and-Negatively-Worded-Items.pdf).

### Inferences
- For an EFA→CFA pipeline, adding a minority of reverse-keyed items to a 34-item scale is likely to produce a **reversed-item factor in EFA**. The thresholds (about 10% inconsistent responders) are within the normal range for online adult samples. In the worst case, that factor gets retained and named as a substantive subdimension.
- If reversed items are included, the CFA plan should prespecify a wording/method factor: a bifactor-S, CTC(M−1), or random-intercept acquiescence model. The EFA plan should prespecify how a factor made up only of reversed items will be handled. Inconsistent-responder screening (factor mixture or attention checks) should be decided before data collection.
- An **unbalanced** design ("a subset" of reversed items) is the case WBS 2013 specifically warn against. It gives weaker acquiescence cancellation than a balanced scale while still introducing the inconsistency problem.

### Gaps
- Kam & Meyer (2015) exact fit statistics and the share of careless respondents were not retrieved.
- Kam (2016, *EPM*, "Further considerations in using items with diverse content to measure acquiescence") and Kam (2023) on response difficulty vs item extremity were not reviewed in full.
- DiStefano & Motl effect sizes (method-factor variance, personality correlations) were not retrieved.
- Horan, DiStefano & Motl (2003) on the longitudinal stability of wording effects was not retrieved.

## 4. Reliability and validity costs

### Takeaway
Within-person and randomized-between-person experiments consistently show that mixed forms have **lower internal consistency, weaker loadings and discrimination, less explained common variance, and worse unidimensional fit** than single-direction forms of the same content. Typical drops in α are 0.04–0.07, larger in some samples. IRT discrimination falls and the general-factor share falls sharply. Mean scores can shift between forms. Direct evidence on **criterion validity** is thinner and mixed.

### Cited Findings
- **Suárez-Álvarez et al. (2018)**, N = 374, within-person (full text read).
  - Cronbach's α: **regular .932, reversed .921, combined .879**. The combined form was significantly lower than both (p < .001). Regular vs reversed did not differ (p = .074).
  - CFA explained variance: **48.19% regular, 46.89% reversed, 35.87% combined**.
  - Mean IRT discrimination: a = 1.86 regular, 1.71 reversed, **1.36 combined**. Discrimination indices dropped by .26–.30 in combined vs regular for 14 items.
  - Score variance was reduced in the combined form, and mean scores differed significantly across forms (η² > .10). The reversed form gave the highest mean self-efficacy.
  - Authors' conclusion: mixing compromises reliability and unidimensionality. Researchers face a trade-off between potential acquiescence bias in single-direction forms and these losses in mixed forms.
  - Source — [Psicothema PDF](https://www.psicothema.com/pdf/4463.pdf).
- **Zhang, Noor & Savalei (2016)**: α .88 mixed vs .95 all-positive vs .94 all-polar-opposite-reversed (full text via Europe PMC) — [PMC4909292](https://pmc.ncbi.nlm.nih.gov/articles/PMC4909292/).
- **Zeng, Jeon & Wen (2024)**, *Frontiers in Psychology*. 20-item, 4-point (no midpoint) Undergraduate Learning Burnout scale. N = 1,096 Chinese undergraduates randomized to 4 versions:
  - Reliability (GLB): **.65** original (8 positive / 12 negative); **.73** original-reverse (12 positive / 8 negative); **.92** all positive; **.93** all negative.
  - ECV of the general factor: **.25** and **.41** for the two mixed versions, both far below .70.
  - Mean IRT discrimination: positive items 1.60 vs negatively worded items in the original version −0.51.
  - Latent trait means did not differ across versions.
  - Source — [PMC11486723](https://pmc.ncbi.nlm.nih.gov/articles/PMC11486723/).
- **van Sonderen, Sanderman & Coyne (2013)**, "Ineffectiveness of reverse wording of questionnaire items: Let's learn from cows in the rain," *PLoS ONE* 8(7): e68967. MFI-20, N = 700 IBD patients.
  - α was .95 across all 20 items, .90 for the 10 positive items and .91 for the 10 negative items.
  - Large within-subscale discrepancies (≥3 points on a 5-point scale) occurred in 1.9–13.9% of respondents. Oppositely worded same-content pairs were no more consistent than same-direction pairs (Spearman ρ .38–.76).
  - The authors conclude reverse wording did not prevent response bias and that scores were contaminated by inattention and confusion. They recommend all items "formulated in the same direction."
  - Source — [PMC3729568](https://pmc.ncbi.nlm.nih.gov/articles/PMC3729568/).
- **Sliter & Zickar (2014)**, *EPM*. Negatively worded personality items showed higher difficulty, lower discrimination and "almost no information" in IRT — summarized in [Zeng et al. 2024, PMC11486723](https://pmc.ncbi.nlm.nih.gov/articles/PMC11486723/) (secondary; primary not read).
- **Elek et al. (2025)** estimate that "up to 10% of systematic covariances across items in mixed-format scales may be related to reversals" — [PMC12581211](https://pmc.ncbi.nlm.nih.gov/articles/PMC12581211/) (review-level estimate).
- **Measurement invariance.** Steinmann (2024) argues that because inconsistency concentrates in lower-ability groups and countries, mixed-worded scales can create invariance problems across ability levels and countries — [IEA white paper](https://www.iea.nl/sites/default/files/2024-04/To-Mix-or-Not-to-Mix-Positively-and-Negatively-Worded-Items.pdf). Gnambs et al. (2018) found general-factor loadings on the RSES were not invariant between individualistic and less individualistic countries — [metaSEM Gnambs18](https://search.r-project.org/CRAN/refmans/metaSEM/html/Gnambs18.html).
- **Criterion validity.**
  - Weijters et al. (2010, Study 2, N = 226 UK) found endpoint-labelled 5-point scales gave **higher** criterion validity (attitude→intention R²) than fully labelled ones. That is a format effect, not a reversal effect — [Vlerick WP PDF](https://public.vlerick.com/Publications/74eb09c8-6aa9-e011-8a89-005056a635ed.pdf).
  - Hernández-Dorado, Vigil-Colet, Lorenzo-Seva & Ferrando (2021), *Psicothema* 33(4), 639–646. In **unbalanced** scales left uncorrected, "attenuated empirical validity coefficients inevitably appeared" from acquiescence. In balanced scales, corrected and uncorrected scores were close and gave unbiased validity estimates — [Psicothema](https://www.psicothema.com/pii?pii=4713).

### Inferences
- The consistent pattern is: mixed < either pure form, and pure regular ≈ pure reversed. So the reliability cost is driven by **direction-switching** (inconsistency), not by reversed content being worse.
- A large fall in ECV, as in Zeng et al., is the most damaging cost for a scale meant to yield a single total or a clean multi-factor structure. It undermines the CFA stage.
- There is a validity counterweight: in an all-regular scale, acquiescence inflates inter-item correlations and α. Part of the "higher reliability" of single-direction forms may be shared acquiescence, not trait (see §5).

### Gaps
- **No formal meta-analysis** was found that pools the reliability or validity cost of mixed vs single-direction scales across instruments. The closest are Gnambs et al. 2018 (RSES-specific MASEM) and narrative reviews.
- Salazar (2015, "The dilemma of combining positive and negative items in scales," *Psicothema*) and Conrad et al. (2004) were not retrieved; their findings are unverified here.
- Few studies directly compare criterion correlations of mixed vs single-direction versions of the same scale. Suárez-Álvarez et al. report correlations but the specific values were not extracted.

## 5. Demonstrated benefits: does including reversed items reduce acquiescence or catch careless respondents?

### Takeaway
The benefits are real but conditional:
- **Acquiescence cancellation needs balance.** Hernández-Dorado et al. 2021 show balanced scales give unbiased validity while unbalanced, uncorrected scales attenuate it. A "subset" of reversed items gives only partial cancellation.
- **Reversed items make method variance detectable and modellable** (WBS 2013: removing them leaves biases "completely confounded with content").
- **Their value as a careless-responder screen is real but confounded.** Many flagged "inconsistent" respondents are low-ability or mid-trait respondents, not careless ones (Steinmann 2024; Kam et al. 2021).
- No study found shows that adding reversed items **prevents** careless responding.

### Cited Findings
- **Hernández-Dorado et al. (2021)**, *Psicothema* 33(4).
  - Balanced scales cancel acquiescence. When full balance is achieved, acquiescence is not expected to affect external validity, and corrected and uncorrected scores were close.
  - With unbalanced scales and no correction, validity coefficients were attenuated.
  - A sizable number of items and/or high content loadings reduced acquiescence's impact.
  - Source — [Psicothema](https://www.psicothema.com/pii?pii=4713).
- **Weijters, Baumgartner & Schillewaert (2013).**
  - Net acquiescence significantly drove inconsistency bias (β = .17, p < .01, Study 1) but contributed "a negligible amount" of observed variance.
  - Reversed items allow method effects to be detected and controlled. Single-direction scales leave them "completely confounded with content variance."
  - Source — [Ghent manuscript](https://backoffice.biblio.ugent.be/download/4099670/6801377).
- **Kreitchmann et al. (2019)**, *Frontiers in Psychology*. N = 558 Spanish undergraduates, Big Five Likert items.
  - Modelling acquiescence plus social desirability improved fit: RMSEA .051 → .038; M2 from 1312.38 to 1001.82.
  - The SDR factor appeared to absorb trait variance (Agreeableness).
  - Acquiescence "increases correlations among same-valenced items while decreasing opposite-valenced item correlations."
  - Source — [PMC6803422](https://pmc.ncbi.nlm.nih.gov/articles/PMC6803422).
- **Weijters & Baumgartner (2012)** list acquiescence control, disruption of nonsubstantive responding and broader construct coverage as the advantages of reversed items — [Penn State Pure](https://pure.psu.edu/en/publications/misresponse-to-reversed-and-negated-items-in-surveys-a-review/).
- **Screening value.** If inconsistency reflects carelessness, mixed wording "would make a problem visible" and allow data cleaning. If it reflects lack of skill, mixed wording "does not solve a problem but creates one." The evidence supports both mechanisms. Steinmann recommends **only positively worded items**, especially for low-ability populations. She notes that other carelessness detectors (fast response times, motivation) "might come with fewer risks," and that whether mixed wording actually *reduces* careless responding is untested — [IEA white paper](https://www.iea.nl/sites/default/files/2024-04/To-Mix-or-Not-to-Mix-Positively-and-Negatively-Worded-Items.pdf).
- **Arias et al. (2020)** show that the inconsistency between oppositely keyed items is precisely what a factor mixture model uses to detect careless respondents. It identified 4.4–10%, and removing them cleaned the factor structure. This is a demonstrated detection benefit that requires reversed items to exist — [USAL record](https://produccioncientifica.usal.es/documentos/60055ebb68c34960007088fc).
- **van Sonderen et al. (2013)** found reverse wording did not prevent bias; inattentive and confused respondents still produced inconsistent patterns — [PMC3729568](https://pmc.ncbi.nlm.nih.gov/articles/PMC3729568/).
- **Baumgartner (2018 slides).** Instructed-response "attention checks" were failed by 14–46% of respondents in Oppenheimer et al. (2009). Baumgartner recommends including dedicated satisficing measures (self-reported effort, response times, instructed-response items) — [Baumgartner slides](https://wiwi.univie.ac.at/fileadmin/user_upload/f_wiwi/News/Events/2018/Baumgartner.pdf).

### Inferences
- If the main goal is **acquiescence control**, a token subset of reversed items buys little. Cancellation scales with balance. A better option is a separate acquiescence measure: a set of heterogeneous unrelated items, or a few antonym pairs scored as an acquiescence index, which can be used for post-hoc correction without contaminating the target scale's structure.
- If the main goal is **careless-responder detection**, instructed-response items and response-time screening do the job without adding a wording factor to the EFA/CFA. A few reverse-keyed items can be added as a detection tool. A defensible design is to administer them but **exclude them from the scored scale and the factor analysis**, using them only for screening and acquiescence indexing.

### Gaps
- No experiment found that randomizes respondents to mixed vs single-direction forms and measures **carelessness itself** (e.g., response times, attention-check failure) as an outcome. Steinmann (2024) explicitly flags this as untested.
- No quantified estimate was found of how much a partially balanced scale (e.g., 6 of 34 reversed) reduces acquiescence bias in total scores.

## 6. Online panels, mobile respondents, and recent (2018–2026) evidence

### Takeaway
Several of the key experiments used online panels or MTurk (WCS 2010; WBS 2013; Kam & Meyer 2015), so the core findings already apply to online data. Recent work (2018–2025) has shifted toward factor-mixture detection of inconsistent responders, ability-based explanations, and logical/linguistic accounts. All of it strengthens the "mixing has costs" conclusion. No study was found that isolates mobile-device effects on reversed-item misresponse.

### Cited Findings
- **Online samples in core experiments.**
  - WCS 2010: Belgian internet panel, N = 1,207, 27% response rate — [Vlerick WP](https://public.vlerick.com/Publications/74eb09c8-6aa9-e011-8a89-005056a635ed.pdf).
  - WBS 2013: UK online panel, N = 306, and MTurk, N = 595 — [Ghent manuscript](https://backoffice.biblio.ugent.be/download/4099670/6801377).
  - Kam & Meyer 2015: online employee survey, N = 666 — [ResearchGate](https://www.researchgate.net/publication/276856947_How_Careless_Responding_and_Acquiescence_Response_Bias_Can_Influence_Construct_Dimensionality_The_Case_of_Job_Satisfaction).
- **Fleischer, Mead & Huang (2015)**, *Industrial and Organizational Psychology* 8(2), 196–202. Argue MTurk data require careful identification and removal of inattentive respondents, citing Schmitt & Stults (1985), Woods (2006) and Sliter & Zickar (2014) on negatively worded items — [Cambridge Core](https://www.cambridge.org/core/journals/industrial-and-organizational-psychology/article/abs/inattentive-responding-in-mturk-and-other-online-samples/A1C254881B31C67BB388A74409AFFE36).
- **Recent (2018–2025) primary work found**:
  - Suárez-Álvarez et al. 2018
  - Baumgartner, Weijters & Pieters 2018
  - Gnambs et al. 2018
  - Gnambs & Schroeders 2017/2020
  - Arias et al. 2020
  - Kam, Meyer & Sun 2021
  - Hernández-Dorado et al. 2021
  - Steinmann, Strietholt & Braeken 2022
  - Steinmann, Chen & Braeken 2024
  - Chen, Steinmann & Braeken 2024
  - Zeng, Jeon & Wen 2024
  - Elek et al. 2025 (review)

  All cited above.

### Inferences
- Prolific samples are generally more attentive than MTurk (from search-result summaries; not verified against a primary source here). That would lower the careless share of inconsistency but not the ability or logical-response shares.

### Gaps
- **Mobile.** No primary study was found on whether smartphone respondents misrespond more to reversed items. Searches returned none.
- **Prolific-specific evidence.** No primary study was found on reversed-item effects in Prolific samples specifically.
- **Unverified claim.** A search summary claimed that inattentive MTurk participants reduce loadings of negatively worded items by "20–30%" and produce "extremely low reliability" for scales with negatively worded items. Its primary source could not be identified, so it is not reported as a finding.
- **Not retrieved:**
  - Vigil-Colet et al. (2020, *Psicothema*, "To reverse or to not reverse Likert-type items: That is the question")
  - Bulut & Bulut (2022)
  - Chyung et al. (2018)
  - Józsa & Morgan (2017)
- **Contradicting evidence.** Hong et al. (2020) and Steedle et al. (2019) are reported as not finding dimensionality or reliability effects of inconsistent responders ([IEA white paper](https://www.iea.nl/sites/default/files/2024-04/To-Mix-or-Not-to-Mix-Positively-and-Negatively-Worded-Items.pdf)). Their details were not retrieved.
