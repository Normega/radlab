-- 20260807_course_structure.sql
--
-- The 2026F course calendar as data, and the page -> lecture mapping that gives
-- students an axis to browse the Field Guide by week. Locked with Norm
-- 2026-08-07 (run plan §38 records the planning; this is Phase A).
--
-- Shape of the term: Wednesdays 09:00-12:00, first class 2026-09-09, reading
-- week 2026-10-28, final class 2026-12-02, centrally-scheduled final exam
-- 2026-12-10+. Twelve meetings: 11 content lectures + a midterm (week 6) with
-- zero slack. The RCT arc is pinned by "debrief 5 weeks after intro": intro at
-- the first post-midterm lecture (Oct 21), debrief in the final class (Dec 2),
-- with reading week as the analysis buffer.
--
-- Lecture numbering vs week numbering diverge after the midterm: lecture 6 is
-- week 7. `course_structure.week_no` counts calendar weeks (1-13 + an exam
-- row); `lecture_no` counts content lectures (1-11). Store both; never derive
-- one from the other.
--
-- Mapping decisions carried from the restructure (run plan §38 discussion):
--   * DSM ch. 15 reunited: ODD and conduct disorder move from the
--     developmental week to Externalizing (L8), joining IED/kleptomania/
--     pyromania and antisocial PD's chapter kin.
--   * Somatic symptom disorders move from the anxiety week to L4 with trauma
--     and dissociation (conversion/FND belongs beside dissociation).
--   * Suicide moves from the eating/sleep week to L5 with mood.
--   * Psychosis is the capstone (L11, final class) and hosts the RCT debrief,
--     mirroring the Fall 2025 pairing of psychosis with RCT initial results.
--   * No standalone methods lecture: the methods arc is distributed -- W2
--     survival kit, W7 RCT design intro, W12 debrief as appraisal capstone.
--
-- A page may serve two lectures (page_lectures is a join table). Exactly seven
-- pages are double-mapped, each for a taught-in-both reason recorded inline.
-- Exactly ONE draft page is unmapped by design: `elimination-disorders`, the
-- out-of-scope chapter overview (dsm_chapters.taught = false), whose page text
-- itself says it is not part of the course.

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------

create table if not exists course_structure (
  id           uuid primary key default gen_random_uuid(),
  course_id    uuid not null,
  week_no      int  not null,
  meeting_date date,
  kind         text not null check (kind in ('lecture','midterm','reading_week','exam')),
  lecture_no   int  check (lecture_no between 1 and 11),
  title        text not null,
  detail       text,
  note         text,
  unique (course_id, week_no)
);

create unique index if not exists course_structure_lecture_uq
  on course_structure (course_id, lecture_no) where lecture_no is not null;

create table if not exists page_lectures (
  page_id    uuid not null references wiki_pages(id) on delete cascade,
  course_id  uuid not null,
  lecture_no int  not null check (lecture_no between 1 and 11),
  primary key (page_id, lecture_no)
);

comment on table course_structure is
  '2026F meeting calendar: 11 content lectures + midterm + reading week + exam. Source of truth for the student-facing week view.';
comment on table page_lectures is
  'Which lecture(s) a wiki page belongs to. A page may serve two lectures; elimination-disorders is unmapped by design.';

-- ---------------------------------------------------------------------------
-- 2. RLS -- members read, staff manage (CLAUDE.md pattern: explicit policies
--    for authenticated, or the table silently blocks everything)
-- ---------------------------------------------------------------------------

alter table course_structure enable row level security;
alter table page_lectures    enable row level security;

create policy "members read course structure" on course_structure
  for select to authenticated using (is_course_member(course_id));
create policy "staff manage course structure" on course_structure
  for all to authenticated
  using (is_course_staff(course_id)) with check (is_course_staff(course_id));

create policy "members read page lectures" on page_lectures
  for select to authenticated using (is_course_member(course_id));
create policy "staff manage page lectures" on page_lectures
  for all to authenticated
  using (is_course_staff(course_id)) with check (is_course_staff(course_id));

-- ---------------------------------------------------------------------------
-- 3. The calendar
-- ---------------------------------------------------------------------------

insert into course_structure (course_id, week_no, meeting_date, kind, lecture_no, title, detail, note) values
('35e9842a-51a5-4f1e-aa5f-3a52f938196f', 1,  '2026-09-09', 'lecture', 1,
 'What is Abnormal? History and Models',
 'Defining abnormality; psychopathology as science; supernatural/biological/psychological traditions; psychoanalytic, humanistic, behavioural models; integrative approach; genetics, diathesis-stress, neuroscience background.',
 null),
('35e9842a-51a5-4f1e-aa5f-3a52f938196f', 2,  '2026-09-16', 'lecture', 2,
 'Assessment, Diagnosis, and Research Foundations',
 'Reliability/validity, mental status exam, testing, neuroimaging; DSM/ICD, categorical vs dimensional, stigma; methods survival kit -- RCT logic, placebo/blinding, effect size, replication.',
 'Survival kit only; design taught properly at the W7 RCT intro, appraised at the W13 debrief.'),
('35e9842a-51a5-4f1e-aa5f-3a52f938196f', 3,  '2026-09-23', 'lecture', 3,
 'Anxiety and Obsessive-Compulsive Related Disorders',
 'Anxiety/fear/panic; triple vulnerability; GAD, panic/agoraphobia, phobias, social anxiety, separation anxiety, selective mutism; OCD, hoarding, BDD, trichotillomania, excoriation, tics.',
 null),
('35e9842a-51a5-4f1e-aa5f-3a52f938196f', 4,  '2026-09-30', 'lecture', 4,
 'Trauma, Dissociation, and Somatic Symptom Disorders',
 'PTSD, acute stress, adjustment, prolonged grief, RAD/DSED; dissociative amnesia, depersonalization-derealization, DID; somatic symptom, illness anxiety, conversion/FND, factitious.',
 'Somatic moved here from the anxiety week -- conversion/FND belongs beside dissociation.'),
('35e9842a-51a5-4f1e-aa5f-3a52f938196f', 5,  '2026-10-07', 'lecture', 5,
 'Mood Disorders and Suicide',
 'MDD, persistent depressive, PMDD, DMDD; bipolar I/II, cyclothymia; etiology and treatment incl. MBCT; suicide as its own block with Canadian statistics and crisis resources.',
 'Green Field Guide submission due this week -- before midterm crunch.'),
('35e9842a-51a5-4f1e-aa5f-3a52f938196f', 6,  '2026-10-14', 'midterm', null,
 'Midterm + RCT onboarding',
 'Midterm covers weeks 1-5: foundations plus the internalizing spectrum.',
 '9:00-10:30 test; break; 10:45-11:45 RCT onboarding -- consent, account setup, baseline measures, one guided session of the practice done together.'),
('35e9842a-51a5-4f1e-aa5f-3a52f938196f', 7,  '2026-10-21', 'lecture', 6,
 'Sex, Gender, and Paraphilic Disorders',
 'Sexual response cycle and dysfunctions; assessment; paraphilic disorders and the normal/abnormal question; Canadian sexual-assault law; gender dysphoria and gender-affirming care.',
 'RCT design intro (~45 min): randomization, control, blinding, pre-registration. Daily practice begins.'),
('35e9842a-51a5-4f1e-aa5f-3a52f938196f', 8,  '2026-10-28', 'reading_week', null,
 'Reading week -- no class',
 null,
 'RCT daily practice continues; highest-attrition window with no class touchpoint.'),
('35e9842a-51a5-4f1e-aa5f-3a52f938196f', 9,  '2026-11-04', 'lecture', 7,
 'Eating and Sleep-Wake Disorders',
 'Anorexia, bulimia, binge-eating, ARFID; sociocultural/biological/psychological causes; CBT-E, FBT; sleep architecture, insomnia, hypersomnolence, narcolepsy, apnea, circadian, parasomnias.',
 'RCT adherence check-in beat -- first class after reading week.'),
('35e9842a-51a5-4f1e-aa5f-3a52f938196f', 10, '2026-11-11', 'lecture', 8,
 'Externalizing: Substance Use and Impulse Control',
 'Levels of involvement, reward pathway; depressants, stimulants, opioids, hallucinogens; treatment incl. harm reduction; gambling; DSM ch. 15 reunited -- IED, kleptomania, pyromania, ODD, conduct disorder.',
 'Remembrance Day: moment of silence at 11:00 falls mid-lecture -- plan the break around it. Amber submission 1 due.'),
('35e9842a-51a5-4f1e-aa5f-3a52f938196f', 11, '2026-11-18', 'lecture', 9,
 'Neurodevelopmental and Neurocognitive Disorders',
 'Lifespan framing; attachment; ADHD, ODD/CD pointers back to L8; SLD, autism, intellectual developmental disorder; delirium, major/mild NCD and the aetiologies; caregiver-focused treatment.',
 null),
('35e9842a-51a5-4f1e-aa5f-3a52f938196f', 12, '2026-11-25', 'lecture', 10,
 'Personality Disorders, Clinical Psychology and the Law',
 'PD definition, clusters A/B/C, five-factor mapping, gender bias; civil commitment, NCRMD, M''Naghten, fitness, duty to warn, Gladue and Indigenous over-incarceration, patients'' rights.',
 'Full three hours, no add-ons. RCT data collection ends ~Nov 25; analysis week follows.'),
('35e9842a-51a5-4f1e-aa5f-3a52f938196f', 13, '2026-12-02', 'lecture', 11,
 'Psychosis and Schizophrenia',
 'Positive/negative/disorganized symptoms; other psychotic disorders; four phases; genetics, dopamine, expressed emotion; antipsychotics, family therapy, CBT; the Rachel case as integrative review.',
 'Capstone. RCT debrief 30-60 min: design review, findings, limitations. Amber submission 2 due Nov 27 -- nothing due in exam period.'),
('35e9842a-51a5-4f1e-aa5f-3a52f938196f', 14, null, 'exam', null,
 'Final exam period',
 'Centrally scheduled by the university; Dec 10 or later.',
 null);

-- ---------------------------------------------------------------------------
-- 4. Page -> lecture mapping (259 of 260 drafts; elimination-disorders
--    unmapped by design)
-- ---------------------------------------------------------------------------

insert into page_lectures (page_id, course_id, lecture_no)
select p.id, '35e9842a-51a5-4f1e-aa5f-3a52f938196f', m.lecture_no
from (values
-- L1 What is Abnormal? History and Models
('what-is-abnormal',1),('historical-traditions',1),('models-of-psychopathology',1),
('integrative-model',1),('defense-mechanisms',1),('multicultural-psychology',1),
('hpa-axis',1),('observational-learning',1),('operant-conditioning',1),
('respondent-conditioning',1),('transference',1),('prevalence',1),
('person-centered-therapy',1),('psychodynamic-psychotherapy',1),
('little-albert-study',1),('student-support-resources',1),
('fundamentals-psychological-disorders-module1-abnormal-psychology',1),
-- L2 Assessment, Diagnosis, and Research Foundations
('clinical-assessment',2),('mental-status-examination',2),('diagnosis-and-classification',2),
('clinical-utility',2),('epidemiology',2),('research-methods',2),
('effect-size',2),('file-drawer-problem',2),('network-meta-analysis',2),
('equivalence-vs-superiority-testing',2),('individual-patient-data',2),
('single-subject-experimental-design',2),('expectancy-effect',2),('allegiance-effect',2),
('bona-fide-treatment',2),('dodo-bird-verdict',2),('empirically-supported-treatments',2),
('evidence-based-practice',2),('treatments-that-harm',2),('therapeutic-alliance',2),
('stigma-of-mental-illness',2),('psychopharmacology',2),('cognitive-behavioral-therapy',2),
('rational-emotive-therapy',2),('psychodynamic-psychotherapy',2), -- dbl: the model is L1, its evidence debate is L2
('fonagy-2015-effectiveness-psychodynamic-psychotherapies',2),
('shedler-2010-efficacy-psychodynamic-psychotherapy',2),
('empirical-support-for-psychodynamic-therapy',2),('medicalization-of-distress',2),
-- L3 Anxiety and Obsessive-Compulsive Related
('anxiety-disorders',3),('agoraphobia',3),('generalized-anxiety-disorder',3),
('panic-disorder',3),('social-anxiety-disorder',3),('specific-phobia',3),
('separation-anxiety-disorder',3),('selective-mutism',3),
('obsessive-compulsive-and-related-disorders',3),('obsessive-compulsive-disorder',3),
('body-dysmorphic-disorder',3),('hoarding-disorder',3),('trichotillomania',3),
('excoriation-disorder',3),('tic-disorders',3),
('anxiety-sensitivity',3),('fear-vs-anxiety',3),('eco-anxiety',3),
('obsessions-and-compulsions',3),('orbitofrontal-caudate-circuit',3),('muscle-dysmorphia',3),
('acceptance-and-commitment-therapy',3),('exposure-and-response-prevention',3),
('exposure-therapy',3),('relaxation-training',3),('systematic-desensitization',3),
('cbt-plus-medication-for-panic-disorder',3),
('little-albert-study',3), -- dbl: behavioural-model demo in L1, phobia acquisition here
('fundamentals-psychological-disorders-module7-anxiety-disorders',3),
('fundamentals-psychological-disorders-module9-ocd-related-disorders',3),
-- L4 Trauma, Dissociation, and Somatic Symptom
('trauma-and-stressor-related-disorders',4),('posttraumatic-stress-disorder',4),
('acute-stress-disorder',4),('adjustment-disorders',4),('prolonged-grief-disorder',4),
('reactive-attachment-disorder',4),('disinhibited-social-engagement-disorder',4),
('dissociative-disorders',4),('dissociative-amnesia',4),('dissociative-identity-disorder',4),
('depersonalization-derealization-disorder',4),
('somatic-symptom-and-related-disorders',4),('somatic-symptom-disorder',4),
('illness-anxiety-disorder',4),('functional-neurological-symptom-disorder',4),
('factitious-disorder',4),('psychological-factors-affecting-other-medical-conditions',4),
('dissociation',4),('central-sensitivity-syndrome',4),('primary-and-secondary-gain',4),
('stressor',4),
('biofeedback',4),('biopsychosocial-multidisciplinary-treatment',4),
('eye-movement-desensitization-and-reprocessing',4),('hypnosis',4),
('integration-and-final-fusion',4),('psychological-debriefing',4),
('trauma-focused-cognitive-behavioral-therapy',4),
('emdr-versus-trauma-focused-cbt',4),('sociocultural-iatrogenic-model-of-did',4),
('fundamentals-psychological-disorders-module5-trauma-stressor-disorders',4),
('fundamentals-psychological-disorders-module6-dissociative-disorders',4),
('fundamentals-psychological-disorders-module8-somatic-symptom-disorders',4),
-- L5 Mood Disorders and Suicide
('mood-disorders',5),('major-depressive-disorder',5),('persistent-depressive-disorder',5),
('premenstrual-dysphoric-disorder',5),('disruptive-mood-dysregulation-disorder',5),
('bipolar-i-disorder',5),('bipolar-ii-disorder',5),('cyclothymic-disorder',5),
('suicide-and-self-harm',5),
('attributional-style',5),('cognitive-triad',5),('learned-helplessness',5),
('monoamine-hypothesis',5),
('antidepressant-medications',5),('behavioral-activation',5),('cbasp',5),
('electroconvulsive-therapy',5),('emerging-treatment-strategies',5),
('interpersonal-therapy',5),('mindfulness-based-therapy',5),('mood-stabilizers',5),
('combination-vs-monotherapy-chronic-depression',5),('gender-differences-in-depression',5),
('schramm-2025-chronic-depression-nma-protocol',5),
('student-support-resources',5), -- dbl: introduced day one, central to the suicide block
('fundamentals-psychological-disorders-module4-mood-disorders',5),
-- L6 Sex, Gender, and Paraphilic
('sexual-dysfunctions',6),('erectile-disorder',6),('female-sexual-interest-arousal-disorder',6),
('male-hypoactive-sexual-desire-disorder',6),('ejaculation-and-orgasmic-disorders',6),
('genito-pelvic-pain-penetration-disorder',6),('gender-dysphoria',6),
('paraphilic-disorders',6),('exhibitionistic-disorder',6),('voyeuristic-disorder',6),
('fetishistic-disorder',6),('transvestic-disorder',6),
('sexual-sadism-and-masochism-disorders',6),('pedophilic-disorder',6),
-- L7 Eating and Sleep-Wake
('feeding-and-eating-disorders',7),('anorexia-nervosa',7),('bulimia-nervosa',7),
('binge-eating-disorder',7),('avoidant-restrictive-food-intake-disorder',7),
('sleep-wake-disorders',7),('insomnia-disorder',7),('hypersomnolence-disorder',7),
('narcolepsy',7),('obstructive-sleep-apnea-hypopnea',7),
('circadian-rhythm-sleep-wake-disorders',7),('parasomnias',7),
('binge-eating-and-compensatory-behavior',7),('transdiagnostic-model-of-eating-disorders',7),
('family-based-therapy',7),('eating-disorders-as-an-ocd-variant',7),
('fundamentals-psychological-disorders-module10-feeding-eating-disorders',7),
-- L8 Externalizing: Substance Use and Impulse Control (DSM ch. 15 reunited)
('substance-related-and-addictive-disorders',8),('substance-use-disorder',8),
('substance-intoxication',8),('substance-withdrawal',8),('alcohol-use-disorder',8),
('cannabis-related-disorders',8),('opioid-use-disorder',8),('stimulant-use-disorder',8),
('sedative-hypnotic-anxiolytic-related-disorders',8),('hallucinogen-related-disorders',8),
('inhalant-use-disorder',8),('caffeine-related-disorders',8),('tobacco-use-disorder',8),
('gambling-disorder',8),('internet-gaming-disorder',8),
('disruptive-impulse-control-and-conduct-disorders',8),('intermittent-explosive-disorder',8),
('kleptomania',8),('pyromania',8),('oppositional-defiant-disorder',8),('conduct-disorder',8),
('binge-drinking',8),('brain-reward-system',8),('thc-and-cannabinoid-receptors',8),
('tolerance',8),
('agonist-and-antagonist-medications',8),('aversion-therapy',8),
('community-reinforcement-approach',8),('contingency-management',8),('detoxification',8),
('relapse-prevention-training',8),('twelve-step-programs',8),
('cannabis-as-gateway-drug',8),('methadone-maintenance-substitution',8),
('fundamentals-psychological-disorders-module11-substance-related-addictive-disorders',8),
-- L9 Neurodevelopmental and Neurocognitive
('neurodevelopmental-disorders',9),('adhd',9),('autism-spectrum-disorder',9),
('intellectual-developmental-disorder',9),('specific-learning-disorder',9),
('communication-disorders',9),
('neurocognitive-disorders',9),('delirium',9),('major-neurocognitive-disorder',9),
('mild-neurocognitive-disorder',9),('neurocognitive-disorder-due-to-alzheimers-disease',9),
('vascular-neurocognitive-disorder',9),('frontotemporal-neurocognitive-disorder',9),
('neurocognitive-disorder-with-lewy-bodies',9),
('neurocognitive-disorder-due-to-traumatic-brain-injury',9),
('substance-medication-induced-neurocognitive-disorder',9),
('neurocognitive-disorder-other-aetiologies',9),
('beta-amyloid-and-neurofibrillary-tangles',9),('chronic-traumatic-encephalopathy',9),
('cognitive-domains',9),
('caregiver-support',9),('cholinesterase-inhibitors-and-memantine',9),('levodopa',9),
('dementia-versus-neurocognitive-disorder-terminology',9),('major-and-mild-ncd-as-one-continuum',9),
('tic-disorders',9),                          -- dbl: ch. 1 member, taught in the L3 OCD block
('reactive-attachment-disorder',9),           -- dbl: ch. 7 member, attachment block here
('disinhibited-social-engagement-disorder',9),-- dbl: same
('fundamentals-psychological-disorders-module14-neurocognitive-disorders',9),
-- L10 Personality Disorders, Clinical Psychology and the Law
('personality-disorders',10),('paranoid-personality-disorder',10),
('schizoid-personality-disorder',10),('schizotypal-personality-disorder',10),
('antisocial-personality-disorder',10),('borderline-personality-disorder',10),
('histrionic-personality-disorder',10),('narcissistic-personality-disorder',10),
('avoidant-personality-disorder',10),('dependent-personality-disorder',10),
('obsessive-compulsive-personality-disorder',10),
('personality-disorder-clusters',10),('shedler-westen-assessment-procedure',10),
('deinstitutionalization',10),('insanity-defense-standards',10),('law-and-ethics',10),
('tarasoff-duty-to-warn',10),
('dialectical-behavior-therapy',10),('mentalization-based-treatment',10),
('transference-focused-psychotherapy',10),
('categorical-vs-dimensional-personality-models',10),
-- L11 Psychosis and Schizophrenia
('psychosis-and-the-schizophrenia-spectrum',11),('schizophrenia',11),
('schizophreniform-disorder',11),('schizoaffective-disorder',11),
('delusional-disorder',11),('brief-psychotic-disorder',11),
('delusions',11),('expressed-emotion',11),('positive-and-negative-symptoms',11),
('psychosis',11),
('antipsychotic-medications',11),('family-interventions-for-schizophrenia',11),
('social-skills-training',11),
('schizotypal-personality-disorder',11), -- dbl: cluster A in L10, schizophrenia spectrum here
('fundamentals-psychological-disorders-module12-schizophrenia-spectrum',11)
) as m(slug, lecture_no)
join wiki_pages p on p.slug = m.slug and p.status = 'draft'
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 5. gaps_by_lecture -- the feed for the student gap browser (Phase B)
-- ---------------------------------------------------------------------------

create or replace view gaps_by_lecture
with (security_invoker = true) as
select cs.lecture_no, cs.week_no, cs.meeting_date, cs.title as lecture_title,
       g.id as gap_id, g.slug, g.section, g.ask, g.kind, g.tier,
       g.difficulty, g.capacity, g.status
from page_gaps g
join wiki_pages p       on p.id = g.page_id
join page_lectures pl   on pl.page_id = p.id
join course_structure cs on cs.course_id = pl.course_id and cs.lecture_no = pl.lecture_no
where g.status = 'open';
