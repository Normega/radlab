# Item presentation format on smartphones vs PCs: one item per screen, scrolling lists, stacked layouts, and grids

Scope note: these notes cover experiments and large observational studies of mobile-web questionnaires. The question is how presentation format affects data quality on smartphones, with PC comparisons. Every number below was read in the source named next to it: the full text, the authors' slides, the publisher abstract (via OpenAlex/Crossref), or the authors' supplementary files. Where only an abstract was available, that is said explicitly. Several Sage/OUP full texts (Revilla & Couper 2018; Antoun et al. 2017; Vehovar et al. 2023; Stern et al. 2016; Tourangeau et al. 2018; Keusch & Yan 2017) were behind 403 walls. For those, effect sizes are given only where an abstract, the authors' slides, or a citing paper reported them.

Terminology used below:
- **Grid / matrix**: a table with items as rows and response options as column headers.
- **Item-by-item (IBI)**: each item carries its own labelled response options. It comes in two forms: **scrolling** (all items on one page, stacked vertically) and **paging** (one item per screen).
- **Stacked / "stem fix" / card**: the responsive-design collapse of a grid on a narrow screen. Each row becomes its own block with its own labelled options, on one scrolling page. This is IBI-scrolling.
- **Carousel**: one item visible at a time inside a single question, usually auto-advancing.
- **Accordion**: all items listed, but only the active item's options are expanded.

---

## Q1. Revilla & Couper (2018) and the related Revilla / Couper / Ochoa / Toninelli papers

### Takeaway
Revilla & Couper's 7-group Netquest experiment (n = 1,476) found few large differences between grids and vertical or horizontal item-by-item formats on either device. The biggest effect came from navigation design, not format: on smartphones, an always-visible "Next" button in item-by-item layouts produced substantially more item-missing data. The companion Revilla/Toninelli/Ochoa crossover experiment found that smartphone *optimisation* matters more than device as such. Non-optimised smartphone surveys failed the attention check more often, while optimised smartphone surveys matched PCs.

### Cited Findings
- **Citation:** Revilla, M., & Couper, M. P. (2018). Comparing grids with vertical and horizontal item-by-item formats for PCs and smartphones. *Social Science Computer Review*, 36(3), 349–368. https://doi.org/10.1177/0894439317715626 (online first 22 June 2017). — [Crossref record](https://api.crossref.org/works/10.1177/0894439317715626)
- **Design:** seven experimental groups (n = 1,476), fielded by Netquest (Spain) in 2016. Factors were device (PC or smartphone); format (grid, item-by-item vertical, item-by-item horizontal); and, on smartphones only, whether the "Next" button was always visible or appeared only after scrolling to the end of the page. — [Abstract via Crossref](https://api.crossref.org/works/10.1177/0894439317715626)
- **Outcomes:** completion time, lost focus, answer changes, screen orientation; item missing data, nonsubstantive responses, instructional manipulation check (IMC) failure, and nondifferentiation, across three question sets. — [Abstract](https://api.crossref.org/works/10.1177/0894439317715626)
- **Headline result (abstract):** "The most striking difference found is for the placement of the next button in the smartphone item-by-item conditions: When the button is always visible, item missing data are substantially higher." — [Abstract](https://api.crossref.org/works/10.1177/0894439317715626)
- **Secondary account (UNVERIFIED against the full text):** a search-engine summary attributes these further findings to Revilla & Couper (2018): no completion-time difference between grid and IBI on mobile, even for large grids (e.g., 10 items × 12 options); no difference in nonsubstantive answers when IBI items are horizontal; and, with vertical IBI, longer times but lower item nonresponse. I could not trace this to a primary page, so treat it as a lead to check in the article, not a finding. — [search summary listing candidate sources incl. Schaeffer & Dykema 2020, Annual Review of Sociology](https://www.annualreviews.org/content/journals/10.1146/annurev-soc-121919-054544)
- **Same sample, different paper:** Höhne, Revilla & Lenzner (2018) used the same Netquest N = 1,476 split-ballot (device × question format) to compare agree/disagree (A/D) and item-specific (IS) questions. IS questions took longer and gave better response quality than A/D on both PCs and smartphones, "irrespective of the device type and scale length". Citation: Höhne, J. K., Revilla, M., & Lenzner, T. (2018). *Methodology*, 14(3), 109–118. https://doi.org/10.1027/1614-2241/a000151 — [OpenAlex abstract](https://econtent.hogrefe.com/doi/10.1027/1614-2241/a000151)
- **Revilla, Toninelli & Ochoa (2017), grids vs item-by-item:** Revilla, M., Toninelli, D., & Ochoa, C. (2017). An experiment comparing grids and item-by-item formats in web surveys completed through PCs and smartphones. *Telematics and Informatics*, 34(1), 30–42. https://doi.org/10.1016/j.tele.2016.04.002. No abstract or full text was retrievable. Mavletova, Couper & Lebedev's ESRA 2017 slides summarise its mobile finding as "similar Cronbach's alpha coefficients and longer completion times in the grid than in the item-by-item format among mobile web respondents". — [Mavletova et al. ESRA 2017 slides, p. 3](https://hse.ru/data/2017/10/15/1159283029/Mavletova%20et%20al_Grids_item-by-item_ESRA_2017.pdf)
- **Revilla/Toninelli/Ochoa crossover (Netquest, Spain, Feb–Mar 2015):**
  - Panellists who had both devices were randomised in each of two waves to PC, smartphone-optimised (SO), or smartphone-non-optimised (SNO), giving 9 groups. Wave 1 had 1,800 completes (200 per group); 1,608 completed wave 2.
  - **IMC pass rates:** wave 1, SNO 81.6% vs SO 88.8% vs PC 89.0%; wave 2, SNO 76.7% vs SO 89.2% vs PC 84.5% (all p = 0.00 vs SNO).
  - **Grid nondifferentiation:** "In one grid, the nondifferentiation ... is higher for smartphones, but this depends on the questions studied."
  - **Completion times:** significantly longer median times on smartphones for grids, open questions, and order-by-click questions.
  - **Landscape use:** SNO 34.6% vs SO 9.9% (wave 1); 28.0% vs 11.6% (wave 2).
  - **Optimisation can backfire:** "The way the questionnaire is optimized for smaller screens is not always optimal in terms of data quality."
  - Citation: Revilla, M., Toninelli, D., & Ochoa, C. (2016). PCs versus smartphones in answering web surveys: does the device make a difference? *Survey Practice*, 9(4). https://doi.org/10.29115/SP-2016-0021 — [Survey Practice PDF](https://www.surveypractice.org/article/2804.pdf)
- **Toninelli & Revilla (2016) replication of Mavletova & Couper (2013):** a sensitive-topics PC vs smartphone experiment (3,317 panellists contacted in wave 1; 2,720 (82.0%) opened the survey). Citation: *Survey Research Methods*, 10(2), 153–169. doi:10.18148/srm/2016.v10i2.6274 — [SRM PDF](https://ojs.ub.uni-konstanz.de/srm/article/view/6274/6103)

### Inferences
- In Revilla & Couper, the layout of the *page* mattered more than grid vs item-by-item on phones. An always-visible Next button lets respondents advance before scrolling past every stacked item. For stacked/scrolling IBI pages, either put Next only at the end of the page or flag unanswered items.
- The Netquest results together suggest that *non-optimised* grids are the main harm on phones (horizontal scrolling and zooming, more attention-check failures). Once optimised, smartphone data quality approaches PC levels.

### Gaps
- I could not open Revilla & Couper (2018) or Revilla, Toninelli & Ochoa (2017), so the per-condition numbers are unverified: straightlining by format and device, item-missing rates with and without the visible Next button, times, and stated preferences. The user asked about "preferences"; no preference data from these papers was retrieved.

---

## Q2. Mavletova & Couper; de Bruijne & Wijnant; Antoun et al.; Lugtig & Toepoel; Couper, Antoun & Mavletova; Stern et al.; Struminskaya et al.; Keusch & Yan; Tourangeau et al.; Toepoel & Funke; and 2019–2026 work

### Takeaway
Across randomised and observational studies, grids produce more straightlining and lower validity than item-by-item formats on both devices, and the penalty is usually larger on phones (Stern et al. 2016; Mavletova et al. 2018; Liu & Cernat 2018; Vehovar et al. 2023). When respondents are randomly assigned to devices, smartphone data are roughly as good as PC data (Antoun et al. 2017; Tourangeau et al. 2018). Observational device gaps largely reflect self-selection (Lugtig & Toepoel 2016), but some studies disagree (Struminskaya et al. 2015). Phones reliably show higher breakoff, longer times, and shorter open answers. The newest work (CBS 2025; Schwerdtfeger, Weiß & Struminskaya 2026) finds that "mobile-first" layouts are as good as or better than desktop-first layouts.

### Cited Findings

**Mavletova & Couper (2014): scrolling vs paging on mobile**
- Russian opt-in panel; 2,110 respondents from 4,000 invitations (participation rate 52.8%); 7-minute survey on a mobile device. "The scrolling design leads to significantly faster completion times, lower (though not significantly lower) breakoff rates, fewer technical problems, and higher subjective ratings of the questionnaire." SMS invitations beat e-mail. Citation: Mavletova, A., & Couper, M. P. (2014). Mobile web survey design: scrolling versus paging, SMS versus e-mail invitations. *Journal of Survey Statistics and Methodology*, 2(4), 498–518. https://doi.org/10.1093/jssam/smu015 — [OpenAlex abstract / HSE listing](https://publications.hse.ru/en/view/100571784)

**Mavletova & Couper (2016): items per page on mobile**
- A 30-item questionnaire shown at 5, 15, or 30 items per page, crossed with and without skip logic.
  - **Breakoff:** 30 items per page cut breakoffs by "nearly one-third" vs 5 per page in the no-skip version (not significant).
  - **Time:** significantly lower completion times at 30 per page in both versions.
  - **Item nonresponse:** higher at 30 per page.
- Citation: Mavletova, A. M., & Couper, M. P. (2016). Grouping of items in mobile web questionnaires. *Field Methods*, 28(2), 170–193. https://doi.org/10.1177/1525822X15595151 — [HSE publication page](https://publications.hse.ru/en/view/133861417)

**Mavletova, Couper & Lebedev (2018): grid vs IBI, PC vs smartphone, crossover**
- **Citation:** *Social Science Computer Review*, 36(6), 647–668. https://doi.org/10.1177/0894439317735307 — [OpenAlex abstract](https://journals.sagepub.com/doi/abs/10.1177/0894439317735307)
- **Design:** two waves (Dec 2016; Jan–Feb 2017) in the OMI volunteer panel, Russia. 1,678 completes in wave 1 and 1,079 in wave 2; tablets excluded. 111 items, including 7 multi-item sets (49 items) on 4- to 7-point scales; all questions obligatory. The IBI format was **scrolling** (stacked). Smartphone grids were **not optimised**. — [ESRA 2017 slides](https://hse.ru/data/2017/10/15/1159283029/Mavletova%20et%20al_Grids_item-by-item_ESRA_2017.pdf)
- **Breakoff (wave 1):** grid 12.4% vs IBI 12.5% (no format effect); PC 10.0% vs smartphone 15.2% (p < .001); no format × device interaction. Wave 2: 4.2% vs 3.8% (format), 3.9% vs 4.1% (device). — [slides p. 10](https://hse.ru/data/2017/10/15/1159283029/Mavletova%20et%20al_Grids_item-by-item_ESRA_2017.pdf)
- **Completion time (wave 1):** grid 18.8 min vs IBI 20.9 min (t = 4.48, p < .001); PC 19.1 vs mobile 20.8 min. Mobile IBI was longest at 21.7 min (format × device F(3,1674) = 10.26, p < .001). The slide figure for the other three cells did not extract cleanly. — [slides p. 11](https://hse.ru/data/2017/10/15/1159283029/Mavletova%20et%20al_Grids_item-by-item_ESRA_2017.pdf)
- **Straightlining (negative binomial):** grid vs IBI OR = 1.34 [1.11–1.63] in wave 1 and 1.38 [1.09–1.73] in wave 2. PC vs mobile was not significant (OR = 1.14 and 0.87). No format × device interaction. — [slides p. 14](https://hse.ru/data/2017/10/15/1159283029/Mavletova%20et%20al_Grids_item-by-item_ESRA_2017.pdf)
- **Concurrent validity:** lower in grids across sets, e.g., correlations of .47 vs .60 and .43 vs .57 (Z = 3.74, p < .001). — [slides p. 12](https://hse.ru/data/2017/10/15/1159283029/Mavletova%20et%20al_Grids_item-by-item_ESRA_2017.pdf)
- **Test–retest reliability:** "Almost no differences between the question formats." — [slides p. 16](https://hse.ru/data/2017/10/15/1159283029/Mavletova%20et%20al_Grids_item-by-item_ESRA_2017.pdf)
- **Respondent burden:** grids lowered survey evaluation and raised reported technical difficulties, "substantial in the mobile web condition (but the condition was non-optimized)". — [slides pp. 17–18](https://hse.ru/data/2017/10/15/1159283029/Mavletova%20et%20al_Grids_item-by-item_ESRA_2017.pdf)
- **Authors' recommendation:** "In questions with 7 or more response options we recommend using an item-by-item format on both devices; otherwise, there may be differences in measurement equivalence between devices." — [slides p. 19](https://hse.ru/data/2017/10/15/1159283029/Mavletova%20et%20al_Grids_item-by-item_ESRA_2017.pdf)

**Stern, Sterrett & Bilgen (2016): grids on mobile, probability web survey**
- Respondents were assigned to one large grid, two small grids, or a single item per page. "Reductions in time associated with question grids were greater for surveys completed on mobile devices", and "the increases in nondifferentiation associated with question grids were greater for surveys completed on mobile devices." Citation: Stern, M. J., Sterrett, D., & Bilgen, I. (2016). The effects of grids on web surveys completed with mobile devices. *Social Currents*, 3(3), 217–233. https://doi.org/10.1177/2329496516657335 — [OpenAlex abstract](https://www.pollux-fid.de/r/cr-10.1177/2329496516657335). Effect sizes and N were not retrieved.

**Liu & Cernat (2018): matrix vs IBI by number of response options, SurveyMonkey**
- **Design:** 2 × 7 design (matrix vs IBI × 2, 3, 4, 5, 7, 9, 11 options). N = 5,644 (Dec 2015) from SurveyMonkey Audience, a nonprobability panel; 34% on mobile (phones + tablets, self-selected). Matrices were *not* reformatted for small screens; IBI was a scrolling page. — [SSCR PDF](https://journals.sagepub.com/doi/pdf/10.1177/0894439316674459)
- **Item nonresponse on mobile, IBI vs matrix:** 2.3% vs 16.8% (3 options, p = .03); 2.8% vs 29.9% (5 options, p = .01); 0.8% vs 8.8% (7 options, p < .01). On PC, differences were not significant. — [Table 1](https://journals.sagepub.com/doi/pdf/10.1177/0894439316674459)
- **Time:** similar across formats on both devices (~1.5–2.2 min). **Straightlining:** more in matrices overall (significant at 4 and 7 options), not significant on mobile. — [Tables 2–3](https://journals.sagepub.com/doi/pdf/10.1177/0894439316674459)
- **Invariance:** see Q5. Citation: Liu, M., & Cernat, A. (2018). Item-by-item versus matrix questions: a web survey experiment. *Social Science Computer Review*, 36(6), 690–706. https://doi.org/10.1177/0894439316674459

**de Bruijne & Wijnant (2013, 2014): Dutch panels**
- **2013, mobile layout used as the base design:** half of a panel got a mobile-designed survey and half a standard one. In Revilla et al.'s summary: similar response rates, almost no breakoffs, similar substantive answers, slightly longer times and lower satisfaction with the mobile layout. Citation: de Bruijne, M., & Wijnant, A. (2013). Can mobile web surveys be taken on computers? A discussion on a multi-device survey design. *Survey Practice*, 6(4). https://doi.org/10.29115/SP-2013-0019 — [Survey Practice](https://www.surveypractice.org/article/2886-can-mobile-web-surveys-be-taken-on-computers-a-discussion-on-a-multi-device-survey-design); [summary in Revilla et al. 2016](https://www.surveypractice.org/article/2804.pdf)
- **2014 POQ research note:** "a scrolling layout leads to a shorter completion time than a paging layout". The authors "suggest that caution be used with horizontal and long-answer scales as well as open-ended text answer fields in smartphone surveys." Citation: de Bruijne, M., & Wijnant, A. (2014). Improving response rates and questionnaire design for mobile web surveys. *Public Opinion Quarterly*, 78(4), 951–962. https://doi.org/10.1093/poq/nfu046 — [OpenAlex abstract](https://doi.org/10.1093/poq/nfu046)
- **2014 SSCR:** de Bruijne, M., & Wijnant, A. (2014). Mobile response in web panels. *Social Science Computer Review*, 32(6), 728–742. https://doi.org/10.1177/0894439314525918. This paper concerns who responds on which device, not format. — [OpenAlex](https://doi.org/10.1177/0894439314525918)
- **De Bruijne et al. (2015), as cited by Mavletova et al.:** longer completion times for mobile IBI paging than for PC grids. — [Mavletova et al. slides p. 3](https://hse.ru/data/2017/10/15/1159283029/Mavletova%20et%20al_Grids_item-by-item_ESRA_2017.pdf)

**Antoun, Couper & Conrad (2017): randomised crossover, LISS probability panel**
- n = 1,390 completed the questionnaire on both a smartphone and a PC, in random order. Respondents multitasked more and were more often around others on smartphones, "these factors had little impact on data quality". Respondents were "at least as likely to provide conscientious and thoughtful answers and to disclose sensitive information on smartphones as on PCs". The exception was difficulty moving "a small-sized slider handle and a date-picker wheel to the intended values". Citation: Antoun, C., Couper, M. P., & Conrad, F. G. (2017). Effects of mobile versus PC web on survey response quality: a crossover experiment in a probability web panel. *Public Opinion Quarterly*, 81(S1), 280–306. https://doi.org/10.1093/poq/nfw088 — [OpenAlex abstract / ISR page](https://api.isr.umich.edu/?p=215521)
- **Antoun's dissertation (same experiment):** "no evidence whatsoever of measurement effects"; non-coverage bias mattered for over a third of estimates. — Antoun, C. (2015), *Mobile Web Surveys: A First Look at Measurement, Nonresponse, and Coverage Errors*, PhD dissertation, University of Michigan (Deep Blue). Abstract read via the OpenAlex API; no stable item URL was retrieved, so this one is weakly sourced.

**Antoun, Katz, Argueta & Wang (2018): systematic review, 2007–2016**
- Designers should "optimize" questionnaires for smartphones, "fit question content to the width of smartphone screens to prevent horizontal scrolling", and "choose simpler types of questions (single-choice questions, multiple-choice questions, text-entry boxes) over more complicated types of questions (large grids, drop boxes, slider questions)." Five heuristics: readability, ease of selection, visibility across the page, simplicity of design elements, predictability across devices. Citation: *Social Science Computer Review*, 36(5), 557–574. https://doi.org/10.1177/0894439317727072 — [OpenAlex abstract](https://www.popcenter.umd.edu/mprc-associates/antoun/christopher-antoun-publications/articlereference.2019-03-29.9422701861)

**Lugtig & Toepoel (2016): LISS, observational, 6 waves**
- **Pooled device differences:**
  - Item missing on evaluation questions: PC 4.10% vs tablet 7.35% vs smartphone 12.18% (F(2,29198) = 68.65, η² = .005).
  - Primacy effect: 4.43% vs 4.82% vs 14.29%.
  - Straightlining: PC 10.02% vs tablet 8.12% vs smartphone 9.29%, i.e., PC respondents straightlined *more*.
  - "the effect sizes ... are generally small".
- **Within-person:** measurement error "do[es] not change with a switch in device", so device differences are attributed to self-selection.
- Citation: Lugtig, P., & Toepoel, V. (2016). The use of PCs, smartphones, and tablets in a probability-based panel survey: effects on survey measurement error. *Social Science Computer Review*, 34(1), 78–94. https://doi.org/10.1177/0894439315574248 — [Essex prepublication PDF](https://repository.essex.ac.uk/13552/1/Lugtig%20and%20Toepoel%20(prepublication).pdf)

**Struminskaya, Weyandt & Bosnjak (2015): GESIS Panel, 6 waves**
- Using Lugtig & Toepoel's indicators with multilevel models, mobile completion "is associated with a higher likelihood of measurement discrepancies". Smartphones were worse than tablets. Most differences "cannot be attributed to the respondent characteristics but are rather effects of mobile devices". **This conflicts with Lugtig & Toepoel's self-selection conclusion.** Citation: Struminskaya, B., Weyandt, K., & Bosnjak, M. (2015). The effects of questionnaire completion using mobile devices on data quality. Evidence from a probability-based general population panel. *methods, data, analyses*, 9(2), 261–292. https://doi.org/10.12758/mda.2015.014 — [OpenAlex abstract / SSOAR](https://www.ssoar.info/ssoar/handle/document/45667). Page range is from memory, not verified; OpenAlex lists issue 2 with first page 32, which looks wrong.

**Keusch & Yan (2017): iPhone owners**
- Three groups: PC; self-selected iPhone; asked to switch from PC to iPhone. "iPhone respondents had more missing data and took longer ... but they also showed less straightlining behavior. There are only minimal device differences on survey answers." Clement et al. (2020) report the figures as almost 10% of smartphone respondents skipping ≥1 question vs 3.6% on PC. Citation: Keusch, F., & Yan, T. (2017). Web versus mobile web: an experimental study of device effects and self-selection effects. *Social Science Computer Review*, 35(6), 751–769. https://doi.org/10.1177/0894439316675566 — [Crossref abstract](https://api.crossref.org/works/10.1177/0894439316675566); [Clement et al. 2020](https://surveyinsights.org/wp-content/uploads/2020/01/device-effects-on-survey-response-quality.pdf)

**Tourangeau, Sun, Yan, Maitland, Rivero & Williams (2018): device randomised after agreement**
- Field experiment in eight US counties: smartphone vs tablet vs laptop, with the device provided to respondents. Measures were completion time, missing data, straightlining, and reliability/validity of scales. "we find few effects of the type of device on data quality." Clement et al. quote p. 550: smartphone data "seem, by most standards, to be just as good". Citation: *Social Science Computer Review*, 36(5), 542–556. https://doi.org/10.1177/0894439317719438 — [OpenAlex abstract](https://doi.org/10.1177/0894439317719438); [quote via Clement et al.](https://surveyinsights.org/wp-content/uploads/2020/01/device-effects-on-survey-response-quality.pdf)

**Couper & Peterson (2017): why phones take longer**
- Secondary analysis of student surveys. Only about one-fifth of the smartphone time penalty is transmission time; "much of the time difference can be accounted for by the additional scrolling required on mobile devices, especially for grid questions." Citation: Couper, M. P., & Peterson, G. (2017). Why do web surveys take longer on smartphones? *Social Science Computer Review*, 35(3), 357–377. https://doi.org/10.1177/0894439316629932 — [OpenAlex abstract](https://doi.org/10.1177/0894439316629932)

**Couper, Antoun & Mavletova (2017): total survey error chapter**
- Across 13 studies, average breakoff was ~13% on mobile vs ~5% on PC (p. 140). Cited in Clement et al. (2020). Chapter in Biemer et al. (Eds.), *Total Survey Error in Practice* (Wiley); my recollection is pp. 133–154, unverified. — [Clement et al. 2020, citing p. 140](https://surveyinsights.org/wp-content/uploads/2020/01/device-effects-on-survey-response-quality.pdf)

**Toepoel & Funke (2018): sliders vs VAS vs buttons, PC/tablet/mobile**
- PC had the lowest item nonresponse, then mobile, then tablet. "Slider bars showed lower mean scores and more nonresponses than buttons"; drag-and-drop sliders "perform worse than visual analogue scales working with a point-and-click principle and buttons." Five-point scales had more nonresponse than 11-point scales, and 11-point scales were rated more positively. Citation: Toepoel, V., & Funke, F. (2018). Sliders, visual analogue scales, or buttons: influence of formats and scales in mobile and desktop surveys. *Mathematical Population Studies*, 25(2), 112–122. https://doi.org/10.1080/08898480.2018.1439245 — [OpenAlex abstract](https://www.tandfonline.com/doi/pdf/10.1080/08898480.2018.1439245)

**Early observational evidence (from Couper's 2013 NCRM slides)**
- McClain, Crawford & Dugan (2012), student survey (n > 100,000; 6.5% on mobile, non-optimised): higher straightlining on smartphones (significant for 6/6 grids), with responses skewed toward the left end of horizontal scales.
- Guidry (2012), NSSE (n > 530,000): lower item-missing on smartphones (0.53 vs 0.80).
- Stapleton (2011): with horizontal scales, mobile respondents chose left-most visible points more; there was no device difference with vertical scales or drop-downs.
- Peytchev & Hill (2010), n = 92: information requiring scrolling was used less.
- — [Couper, "Surveys on mobile devices", NCRM 2013 slides](https://www.ncrm.ac.uk/documents/Mick-Couper.pdf)

**2019–2026 work**
- **Vehovar, Couper & Čehovin (2023).** Grid vs four IBI alternatives (scrolling, unfolding, horizontal scrolling, paging) on PC and smartphone; n = 4,644; 10 response-quality indicators and 20 estimates. Conclusion: "item-by-item layouts (unfolding or scrolling) should be used instead of grids, not only on mobile devices but also on PCs." Citation: Alternative layouts for grid questions in PC and mobile web surveys: an experimental evaluation using response quality indicators and survey estimates. *Social Science Computer Review*, 41(6), 2122–2144. https://doi.org/10.1177/08944393221132644 — [Crossref abstract](https://api.crossref.org/works/10.1177/08944393221132644)
  - The authors' t-test supplement gives the five-layout average breakoff as 0.107 on PC and 0.194 on smartphones. The horizontal-scrolling layout had significantly *higher* item nonresponse on smartphones than the average (mean diff +0.013, t = 6.48). The supplement's tables extracted poorly, so treat per-layout values as approximate. — [Zenodo supplement](https://doi.org/10.5281/zenodo.6344783)
- **Giesen, Kompier & van den Brakel (2025), Statistics Netherlands (CBS).**
  - **Design:** smartphone-first field experiment, gross sample 12,000; 4,088 completes (34%); 41% completed on smartphone or other mobile. Four randomised grid designs: regular (classic table on PC, "stem fix" stacked on phone); stem fix on all screens; carousel with auto-advance; accordion.
  - **Grid design results:** of 55 quality indicators, grid design had 6 significant effects and none of 7 satisfaction indicators.
    - No-answer rate: accordion lowest (3.26% vs regular 5.19% and stem fix 4.47%).
    - Recency: carousel and accordion lower in some operationalisations.
    - Straightlining: more for carousel on one grid (0.13 vs 0.08–0.09).
    - Cronbach's alphas did not differ.
    - Conclusion: "different grid formats perform broadly similarly."
  - **Grid × device interaction:** for regular and accordion grids, straightlining on a mobile-use grid was higher on smartphones (0.30 and 0.29) than on PCs (0.19 and 0.17).
  - **Device:** breakoff 16% smartphone vs 10% PC; open answers 108 vs 177 characters.
  - The smartphone-first layout did not reduce smartphone breakoff.
  - Device was self-selected; layouts were randomised.
  - — [CBS discussion paper, Oct 2025](https://www.cbs.nl/-/media/_pdf/2025/42/experiment-smartphone-first-vragenlijstopmaak.pdf)
- **Schwerdtfeger, Weiß & Struminskaya (2026).** Randomised mobile-first vs desktop-first layout in a large German mixed-mode (online + paper) panel. Mobile-first "reduced item nonresponse across most modes and increased variation in responses, especially for matrix questions, without increasing breakoffs or satisficing". PC users had longer measured durations, but subjective experience was unaffected. Citation: Width is the limit – response behavior and data quality in a mobile-first survey. *International Journal of Market Research* (online 29 Aug 2026). https://doi.org/10.1177/14707853261483760 — [Crossref abstract](https://api.crossref.org/works/10.1177/14707853261483760)
- **Olson, Smyth & Phillips (2023/2024).** Nebraska probability mail + web survey. Item-by-item displays reduce straightlining vs grids, but respondents are "less likely to select the last two response categories in the item-by-item displays". Wide rectangular buttons and round radio buttons gave the same data quality. Smartphone and computer web respondents had more item nonresponse than mail. Citation: Display of battery items in web and mail surveys: grids versus item-by-item and radio versus wide buttons. *International Journal of Market Research*, 66(1), 27–45. https://doi.org/10.1177/14707853231210223 — [OpenAlex abstract](https://doi.org/10.1177/14707853231210223)
- **Décieux & Sischka (2024).** GERPS probability online survey (n = 4,888), mobile-optimised, propensity-weighted. Device differences were "mixed" and "smaller ... compared to previous studies"; higher dropout on mobile, especially smartphones, "remain[s] the major challenge". Citation: *SAGE Open*, 14(2). https://doi.org/10.1177/21582440241252116 — [OpenAlex abstract](https://journals.sagepub.com/doi/pdf/10.1177/21582440241252116)
- **Clement, Severin-Nielsen & Shamshiri-Petersen (2020).** ISSP 2018/2019 Denmark, cross-sectional probability samples, device self-chosen. "no evidence of systematic device effects on survey response quality"; small effects were not replicated across years and disappeared after selection controls. Citation: *Survey Methods: Insights from the Field*. doi:10.13094/SMIF-2020-00020 — [PDF](https://surveyinsights.org/wp-content/uploads/2020/01/device-effects-on-survey-response-quality.pdf)
- **Wang (2018), Gallup Panel dissertation.** Grids placed later in the survey brought more straightlining, item nonresponse, and breakoff. "The negative effects of grid questions on data quality were exacerbated when those same grid questions were presented on smartphones rather than on computers or tablets." — [OpenAlex abstract, UNL](https://digitalcommons.unl.edu/dissertations/AAI10841678)
- **Wenz (2017), ISER WP 2017-05.** Non-optimised UK survey. Small smartphones (< 4.0 in) had more breakoff (31.8% vs 15.4% large smartphones, 7.8% small tablets, 4.3% large tablets; χ²(3) = 23.3, p < .001). Straightlining in the grid was also higher (5.6% vs 2.6% large smartphones vs 1.2% large tablets; χ²(3) = 11.3, p < .05). — [ISER PDF](https://www.iser.essex.ac.uk/wp-content/uploads/files/working-papers/iser/2017-05.pdf)
- **Neuert, Roßmann & Silber (2023), eye-tracking.** Large grid vs two small grids vs 10 separate pages. No large overall processing differences, but more attention to stem and scale labels in item-by-item; in grids, respondents "often refer to surrounding items". Citation: *Journal of Official Statistics*, 39(1), 79–101. https://doi.org/10.2478/jos-2023-0004 — [OpenAlex abstract](https://sciendo.com/pdf/10.2478/jos-2023-0004). Device not stated in the abstract; likely PC lab.
- **Toepoel, Lugtig, Struminskaya, Elevelt & Haan (2020).** Chat-style "research messenger" vs responsive design, MTurk N = 1,728.
  - Dropout: 8.7% vs 7.2% (n.s.).
  - Time: 788 vs 732 s (p = .005).
  - Open answers: shorter (453 vs 570 characters).
  - No differences in evaluation.
  - Citation: *Survey Practice*, 13(1). https://doi.org/10.29115/SP-2020-0010 — [Survey Practice](https://www.surveypractice.org/article/14188-adapting-surveys-to-the-modern-world-comparing-a-research-messenger-design-to-a-regular-responsive-design-for-online-surveys)

### Inferences
- **Direction of format effects is consistent:** grids give more straightlining, lower validity, and (on phones) more item nonresponse than item-by-item. Item-by-item takes slightly longer.
- **Size is modest.** Typical straightlining odds ratios are about 1.3–1.4 (Mavletova et al.). The exception is unoptimised matrices on phones, where item nonresponse can jump to 10–30% (Liu & Cernat).
- **The PC-vs-phone gap in measurement quality is small under random assignment** (Antoun et al.; Tourangeau et al.). Phones reliably cost more breakoff (roughly 1.5–2× PC) and longer times.

### Gaps
- No primary full text retrieved for Stern et al. (2016) N/effect sizes, Antoun et al. (2017) per-indicator numbers, or Tourangeau et al. (2018) numeric results.
- The AAPOR (2014) task force report on mobile technologies was not retrieved this session, so its recommendations are not cited here.
- The Kantar ESRA 2017 grid experiment (Hanson: stacked scrolling vs paging vs dynamic grids on smartphones) is known only from a conference abstract: dynamic grids "performed positively regarding question timing and missing responses". — [ESRA 2017 session 36](https://europeansurveyresearch.org/conf2017/prog.php?sess=36). Burgdorf, Blom, Bruch, John & Keusch (ESRA 2017), on matrix vs single questions in a mobile-first switch, had no results in the abstract.

---

## Q3. On phones, do stacked / "card" layouts (each item with its own labelled options) behave like item-by-item or like grids?

### Takeaway
The evidence treats the stacked layout as item-by-item (scrolling). In almost every experiment, the "item-by-item" arm *is* a vertical stack of items with their own labels on one scrolling page. Those arms show lower straightlining and item nonresponse than grids, at a small time cost. Within item-by-item variants, scrolling-stacked, paging, carousel, and accordion perform broadly alike (CBS 2025; Vehovar et al. 2023 favour "unfolding or scrolling"). Navigation details matter more than the stack itself: where Next sits, and horizontal scrolling.

### Cited Findings
- **Mavletova et al. (2018):** the IBI condition was an "item-by-item **scrolling** format", i.e., stacked. It had lower straightlining (grid OR 1.34–1.38) and higher concurrent validity than grids on both devices. — [ESRA 2017 slides pp. 4, 14](https://hse.ru/data/2017/10/15/1159283029/Mavletova%20et%20al_Grids_item-by-item_ESRA_2017.pdf)
- **Liu & Cernat (2018):** IBI items were on one scrolling page. Mobile item nonresponse was far lower than for unadapted matrices (e.g., 2.8% vs 29.9% at 5 options). — [SSCR PDF](https://journals.sagepub.com/doi/pdf/10.1177/0894439316674459)
- **Richards, Powell, Murphy, Nguyen & Yu (2016):** responsive design rendered grids as a "stacked format" below 760 px. N = 14,613 web respondents in WTC Health Registry Wave 4; 11% on small devices.
  - Stacked (phones) had lower probability of missing ≥1 item and of skipping a whole grid (except the social-support grid).
  - Straightlining was "significantly more likely across all grids in the traditional format than the stacked format" (all 5 grids, p < .05).
  - Wave-to-wave consistency was equal.
  - **Caveat (authors'):** format was confounded with device; no random assignment.
  - Citation: Gridlocked: the impact of adapting survey grids for smartphones. *Survey Practice*, 9(3). https://doi.org/10.29115/SP-2016-0016 — [Survey Practice PDF](https://www.surveypractice.org/article/2810.pdf)
- **Revilla & Couper (2018):** stacked/vertical IBI on phones was sensitive to Next-button placement, with item-missing "substantially higher" when Next was always visible. — [Abstract](https://api.crossref.org/works/10.1177/0894439317715626)
- **Vehovar et al. (2023):** recommends "unfolding or scrolling" item-by-item over grids on both devices. The horizontal-scrolling IBI variant had higher smartphone item nonresponse (supplement). — [Crossref abstract](https://api.crossref.org/works/10.1177/08944393221132644); [Zenodo t-tests](https://doi.org/10.5281/zenodo.6344783)
- **CBS (2025):** stacked "stem fix" (with the stem pinned on top), carousel, and accordion vs regular (table on PC, stem fix on phone) gave "only a limited number of effects ... generally small and not consistent", with equal Cronbach's alphas. CBS forces scrolling to the bottom because "a 'next' button must be selected ... This ensures respondents always scroll down to the bottom of the screen." — [CBS 2025](https://www.cbs.nl/-/media/_pdf/2025/42/experiment-smartphone-first-vragenlijstopmaak.pdf)
- **Olson et al. (2023):** wide rectangular buttons (typical of mobile-optimised stacked items) vs round radio buttons made no difference to data quality. Item-by-item display reduced straightlining but lowered selection of the last two categories. — [OpenAlex abstract](https://doi.org/10.1177/14707853231210223)
- **Stefkovics & Kmetty (2022):** a question-order (priming) effect appeared only when items were on separate pages, not in a grid. The authors read this as deeper processing per item and warn that "mixing item-by-item and grids formats ... may introduce measurement inequivalence". Hungarian non-probability panel, 2019. Citation: *Measurement Instruments for the Social Sciences*, 4(1). https://doi.org/10.1186/s42409-022-00036-z — [OpenAlex abstract](https://measurementinstrumentssocialscience.biomedcentral.com/articles/10.1186/s42409-022-00036-z)
- **Neuert et al. (2023):** grid respondents "often refer to surrounding items", and IBI drew more attention to stem and labels. This is a mechanism for the higher straightlining and inter-item correlation seen in grids. — [JOS](https://sciendo.com/pdf/10.2478/jos-2023-0004)
- **Census Bureau NSCG usability (Nichols, Falcone & Figueroa, 2018; 30 participants):** phone users had to scroll horizontally in grids, so the design was switched mid-test to item-by-item for small screens. The report then recommended item-by-item radio-button design on mobile *and* PC, which was adopted for the 2017 NSCG. — [Census RSM 2018-07](https://www.census.gov/content/dam/Census/library/working-papers/2018/adrm/rsm2018-07.pdf)

### Inferences
- A responsive grid that collapses to stacked cards on phones is functionally item-by-item. The literature predicts it will straightline less, and have less missing data, than a desktop grid in the same survey.
- That creates a **within-survey format difference between devices** (grid on PC, stack on phone), which is a potential source of device non-equivalence. This is why CBS, Vehovar et al. and Schwerdtfeger et al. favour one uniform item-by-item design on all screens rather than device-specific rendering.
- Each stacked item needs its own visible option labels, and the stem should stay visible (pinned, or repeated). Neuert et al. and the CBS note that carousel/accordion stems "may have become invisible" support this.

### Gaps
- No study directly randomised "stacked cards on one scroll" vs "one item per screen (paging)" *for multi-item rating scales on phones* with psychometric outcomes. The closest are Vehovar et al. (full per-layout results not retrieved), Stern et al. (single item per page vs grids), and the CBS carousel vs stem-fix comparison.

---

## Q4. Breakoff, completion time, and respondent burden by format on phones; effects of screen length and scrolling

### Takeaway
On phones, breakoff runs about 1.5–2× PC levels regardless of format: 15.2% vs 10.0% (Mavletova et al.), 16% vs 10% (CBS), ~19% vs ~11% (Vehovar et al.), and ~13% vs ~5% across 13 studies (Couper et al.). Format itself barely moves breakoff. Grids are faster, but the time saved is concentrated on phones and paid for in straightlining. Fewer, longer scrolling pages are faster than paging and break off slightly less, but missing data rises when many items share one page.

### Cited Findings
- **Scrolling vs paging on mobile:** scrolling was significantly faster, with non-significantly lower breakoff, fewer technical problems, and better ratings (Mavletova & Couper 2014). — [HSE listing / abstract](https://publications.hse.ru/en/view/100571784). Scrolling was also faster than paging in de Bruijne & Wijnant (2014). — [POQ abstract](https://doi.org/10.1093/poq/nfu046)
- **Items per page on mobile:** 30 vs 5 items per page cut breakoffs by "nearly one-third" (n.s.) and lowered time significantly, but raised item nonresponse (Mavletova & Couper 2016). — [HSE](https://publications.hse.ru/en/view/133861417)
- **Grid vs IBI breakoff:** no format difference (12.4% vs 12.5%); device difference 15.2% vs 10.0% (Mavletova et al. 2018). — [slides p. 10](https://hse.ru/data/2017/10/15/1159283029/Mavletova%20et%20al_Grids_item-by-item_ESRA_2017.pdf)
- **Grid time savings are bigger on mobile,** and so is the nondifferentiation they bring (Stern et al. 2016). — [abstract](https://www.pollux-fid.de/r/cr-10.1177/2329496516657335)
- **Scrolling explains the phone time penalty:** about 1/5 of it is transmission; most is within-page scrolling, "especially for grid questions" (Couper & Peterson 2017). — [abstract](https://doi.org/10.1177/0894439316629932)
- **Grid time on phones may be longer, not shorter:** Revilla, Toninelli & Ochoa (2017), as summarised by Mavletova et al., found longer completion times in grids than IBI among mobile respondents. **This conflicts with Mavletova et al. and Stern et al.**, where grids were faster. A likely reason is non-optimised grids needing zoom and horizontal scrolling. — [Mavletova slides p. 3](https://hse.ru/data/2017/10/15/1159283029/Mavletova%20et%20al_Grids_item-by-item_ESRA_2017.pdf)
- **Subjective burden:** grids lowered evaluation and raised reported technical difficulties, with the effect "substantial" on non-optimised mobile; subjective length was rated longer for grids, strongly so on phones (Mavletova et al. 2018). — [slides pp. 17–18](https://hse.ru/data/2017/10/15/1159283029/Mavletova%20et%20al_Grids_item-by-item_ESRA_2017.pdf)
- **No satisfaction difference** across stem-fix, carousel, accordion and regular grids (CBS 2025: 0 of 7 satisfaction indicators). With stem fix, carousel or accordion, phone respondents finished *faster* than PC respondents (e.g., 17.4 vs 21.6 min for accordion). With the regular design there was no device difference (20.4 vs 20.7). — [CBS 2025](https://www.cbs.nl/-/media/_pdf/2025/42/experiment-smartphone-first-vragenlijstopmaak.pdf)
- **Mobile-first layout:** longer measured durations for PC users with no change in subjective experience, and no increase in breakoffs (Schwerdtfeger et al. 2026). — [Crossref](https://api.crossref.org/works/10.1177/14707853261483760)
- **Indiana University field experiments (Tharp, conference slides, n.d.; fielded 2014):**
  - Exp. 1 (n = 4,000 sampled; 7% smartphone), "mobile-first" design on smartphones: breakoff 29.8% → 20.7%; duration 8.84 → 7.2 min.
  - On desktops in Exp. 1: breakoff 6.7% → 7.2%; rated lower on "professional look".
  - Exp. 2 (n = 35,689 sampled; 16.3% smartphone), responsive design: smartphone breakoff 17.0% → 15.2%; desktop breakoff rose 5.4% → 6.8% (significant).
  - Most smartphone improvements were not significant.
  - — [Tharp, "The Impact of Mobile First and Responsive Web Designs" (IU ScholarWorks)](https://scholarworks.iu.edu/iuswrrest/api/core/bitstreams/49f23367-f647-4f63-8b3e-c537ceb2b105/content)
- **Screen size:** small smartphones (< 4 in) had 31.8% breakoff vs 15.4% for larger phones, in a non-optimised survey (Wenz 2017). — [ISER WP](https://www.iser.essex.ac.uk/wp-content/uploads/files/working-papers/iser/2017-05.pdf)
- **Grid position:** later grids brought more straightlining, item nonresponse and breakoff, worse on smartphones (Wang 2018). — [UNL dissertation abstract](https://digitalcommons.unl.edu/dissertations/AAI10841678)

### Inferences
- For a multi-item rating scale on phones, a single scrolling page of stacked items is the time- and breakoff-efficient choice. It should be paired with a Next button only at the bottom, or with unanswered-item prompts, to stop the item-missing rise that both long pages (Mavletova & Couper 2016) and always-visible Next buttons (Revilla & Couper 2018) produce.
- Optimising the layout can raise PC breakoff slightly (IU Exp. 2: 5.4% → 6.8%). Uniform mobile-first designs should be checked for desktop costs.

### Gaps
- No study separated breakoff caused by grid format from breakoff caused by survey length on phones with adequate power. Breakoff by format specifically on phones was usually not significant.

---

## Q5. Measurement equivalence (PC vs smartphone) for multi-item scales: factor structure and invariance tests

### Takeaway
Where invariance was formally tested, devices are largely equivalent, but layout and number of scale points can break equivalence. Mavletova et al. (2018) found metric/scalar equivalence across devices and formats for most scales, but not for a 7-point set. Liu & Cernat (2018) found matrix vs IBI equivalent below 7 options, with differences at 5, 9 and 11, and a leftward mean shift on mobile matrices. Menold & Toepoel (2022) found full comparability across devices and formats except continuous VAS, but lower reliability on phones and with 5-point scales. Within-person crossover designs (Antoun et al.; Lugtig & Toepoel) show little device effect on measurement.

### Cited Findings
- **Mavletova, Couper & Lebedev (2018), multigroup CFA across seven sets:**
  - Format, device, and format × device reached the strongest tested equivalence (configural → metric → scalar → latent means → residuals → latent variances/covariances) for 6 of 7 sets.
  - Exceptions: "Caution" (4-point) failed format × device at configural level in wave 1 and at covariances in wave 2. "Moral and rational trust" (7-point) failed format at residuals and format × device at residuals (wave 1) / latent means (wave 2).
  - Abstract: "a longer scale producing some differences in the measurement equivalence."
  - Test–retest: no format effect.
  - — [ESRA 2017 slides p. 15](https://hse.ru/data/2017/10/15/1159283029/Mavletova%20et%20al_Grids_item-by-item_ESRA_2017.pdf); [abstract](https://journals.sagepub.com/doi/abs/10.1177/0894439317735307)
- **Liu & Cernat (2018):**
  - Latent variables from matrix and IBI were "similar" for 2, 3, 4 and 7 categories, but differed significantly for 5, 9 and 11. "the matrix design has lower reliability (more random variance) than the single items."
  - At 9 and 11 categories there was a mean shift for mobile respondents, "with more responses to the left of the screen for the matrix design".
  - Recommendation: IBI for scales with 9 or more options.
  - **Caveat:** device was self-selected.
  - — [SSCR PDF, pp. 698–701](https://journals.sagepub.com/doi/pdf/10.1177/0894439316674459)
- **Menold & Toepoel (2022):** randomised experiment; N = 5,077 online-panel members; desktop vs tablet vs phone; six response formats; four numbers of scale points. An exact test of invariance gave "full data comparability for devices and formats, with the exception of continuous Visual Analog Scale (VAS), but limited comparability for different numbers of scale points." "VAS, use of mobile phones and five point scales consistently gained lower reliability." The authors recommend "technically less demanding implementations as well as a unified design for mixed-device surveys." Citation: Do different devices perform equally well with different numbers of scale points and response formats? A test of measurement invariance and reliability. *Sociological Methods & Research*, 53(2), 898–939. https://doi.org/10.1177/00491241221077237 — [OpenAlex abstract](https://doi.org/10.1177/00491241221077237)
- **Tourangeau et al. (2018):** the reliability and validity of scale responses showed "few effects of the type of device" under random assignment. — [abstract](https://doi.org/10.1177/0894439317719438)
- **CBS (2025):** Cronbach's alphas for the Brief Resilience Scale (.735–.789), Mental Health Index (.873–.875) and Survey Attitude Scale (.851–.869) were essentially identical across the four grid designs. Device main effects appeared on some scale means: smartphone users scored higher on life satisfaction (3.94 vs 3.87), extraversion (4.58 vs 4.19) and MHI (70.90 vs 68.84). These are likely composition effects, since device was self-selected. — [CBS 2025](https://www.cbs.nl/-/media/_pdf/2025/42/experiment-smartphone-first-vragenlijstopmaak.pdf)
- **Lugtig & Toepoel (2016):** within-person, measurement-error indicators did not change when respondents switched device; between-device gaps reflect self-selection. **Conflicts with Struminskaya et al. (2015)**, who attribute most gaps to the device. — [Lugtig & Toepoel prepub](https://repository.essex.ac.uk/13552/1/Lugtig%20and%20Toepoel%20(prepublication).pdf); [Struminskaya et al. abstract](https://www.ssoar.info/ssoar/handle/document/45667)
- **Antoun et al. (2017), crossover within person:** no loss of conscientious responding on smartphones, except slider and date-picker accuracy. — [abstract](https://api.isr.umich.edu/?p=215521)
- **Horizontal scale orientation:** mobile respondents favoured left-most visible points on horizontal scales (Stapleton 2011, in Couper's 2013 slides). McClain et al. (2012) found leftward skew on smartphones. This matches Liu & Cernat's leftward shift in mobile matrices. — [Couper NCRM 2013 slides](https://www.ncrm.ac.uk/documents/Mick-Couper.pdf)

### Inferences
- For multi-item rating scales, a consistent item-by-item, vertically stacked format used on *both* devices is the design most likely to preserve cross-device invariance. Rendering a grid on PC and a stack on phones is not.
- Long horizontal scales (7+, and especially 9–11 points) in grids are the main threat to equivalence on phones, through leftward truncation and scrolling. Vertical or stacked option lists avoid it.
- Equivalence should still be tested empirically per instrument (multigroup CFA by device), because the few non-invariant sets were not predictable from content alone.

### Gaps
- No retrieved study tested invariance of a clinical or psychological scale (e.g., PHQ/GAD-type 4-point items) specifically for grid on PC vs stacked on phone. The CBS alphas are the nearest evidence, and they are reliability, not invariance.
- Tourangeau et al. (2018) and Antoun et al. (2017) report reliability/validity only qualitatively in the abstracts; no coefficients were retrieved.
