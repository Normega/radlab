-- PSY309 2026F — second course on the academic project: "Field Guide to
-- Research Methods" (scope ratified 2026-08-25; scope doc:
-- https://claude.ai/code/artifact/13958177-0263-4da2-8601-bb99a48ff33b).
--
-- Seeds: the course row, the 14-row meeting calendar (12 meetings + reading
-- week + a no-final-exam marker), instructor enrollments for Norm's two
-- existing identities, and the 61-page catalogue as wiki_pages *shells*
-- (draft status, no body) with their page_lectures mapping.
--
-- Design notes:
-- * PSY309 catalogue authority is the shell pages themselves — unlike PSY240
--   there is no disorders-style taxonomy table; targets for reference-mode
--   ingest runs are named explicitly in the run plan.
-- * lecture_no counts CONTENT lectures 1–10 (test weeks and reading week
--   carry no lecture_no), which fits the existing 1–11 check constraints
--   unchanged.
-- * wiki_pages.type gains 'practical' for the five practical companions.
--   Everything else uses existing types ('concept', 'foundation').
-- * Shells are status 'draft': invisible to students under existing RLS,
--   link-resolvable for staff, awaiting a first proposal or fresh draft.

-- 1. Page type for practical companions -------------------------------------
ALTER TABLE wiki_pages DROP CONSTRAINT wiki_pages_type_check;
ALTER TABLE wiki_pages ADD CONSTRAINT wiki_pages_type_check
  CHECK (type = ANY (ARRAY['disorder','study','concept','treatment','debate',
                           'lecture','overview','foundation','practical']));

-- 2. Course, calendar, enrollments, catalogue --------------------------------
DO $$
DECLARE
  v_course uuid;
BEGIN
  INSERT INTO courses (code, name, term)
  VALUES ('PSY309', 'Field Guide to Research Methods', '2026F')
  RETURNING id INTO v_course;

  -- Meeting calendar (Tuesdays; mirrors the Lecture Lounge `lectures` rows on
  -- the main project, which remain the check-in system's own source of truth).
  INSERT INTO course_structure (course_id, week_no, meeting_date, kind, lecture_no, title, detail, note) VALUES
  (v_course, 1,  '2026-09-08', 'lecture',      1,    'Psychological Thinking',
     'Research vs experience; biases of intuition; sources of scientific information; reading empirical articles; journalism and disinformation.', NULL),
  (v_course, 2,  '2026-09-15', 'lecture',      2,    'Ethics and Measurement',
     'Ethics history; Belmont and APA principles; TCPS2 and the REB; variables and operationalization; three claims; four validities.',
     'Practical 1 due Fri Sep 18.'),
  (v_course, 3,  '2026-09-22', 'lecture',      3,    'Exploring Measurement',
     'Scales of measurement; reliability; measurement validity; survey questions; observational methods; sampling and generalization.', NULL),
  (v_course, 4,  '2026-09-29', 'lecture',      4,    'Research Design Theory',
     'Correlational research: bivariate correlation; interrogating associations; third variables and regression; moderation; mediation; longitudinal designs; pattern and parsimony.',
     'Practical 2 due Fri Oct 2.'),
  (v_course, 5,  '2026-10-06', 'midterm',      NULL, 'Test 1: Theory (in person)',
     'Covers weeks 1-4: claims, validities, ethics, measurement, correlational research.', NULL),
  (v_course, 6,  '2026-10-13', 'lecture',      5,    'Describing Data',
     'Describing data; effect sizes; confidence intervals and precision; power and error trade-offs; preregistration; simulating data in R.',
     'Practical 3 due Fri Oct 16.'),
  (v_course, 7,  '2026-10-20', 'lecture',      6,    'Research Designs',
     'Experiments: causal logic; IV/DV/control variables; confounds and selection effects; within vs between; internal validity threats; blinding and placebo; null results.', NULL),
  (v_course, 8,  '2026-10-27', 'reading_week', NULL, 'Reading week — no class', NULL, NULL),
  (v_course, 9,  '2026-11-03', 'lecture',      7,    'Advanced Designs',
     'Factorial designs; main effects and interactions; three-way designs; quasi-experiments; small-N designs.',
     'Practical 4 due Fri Nov 6.'),
  (v_course, 10, '2026-11-10', 'lecture',      8,    'Mixed Models',
     'Mixed designs and clinical trials; Simpson''s paradox; random effects; moderation vs mediation vs confounds.', NULL),
  (v_course, 11, '2026-11-17', 'midterm',      NULL, 'Test 2: Application (in person)',
     'Focus on weeks 6-10: experiments through mixed models; earlier material may reappear.', NULL),
  (v_course, 12, '2026-11-24', 'lecture',      9,    'Open Work / Open Science',
     'Replication; meta-analysis and the file drawer; questionable research practices; generalization and WEIRD; theory-testing vs generalization modes.',
     'Practical 5 due Fri Nov 27.'),
  (v_course, 13, '2026-12-01', 'lecture',      10,   'Open Work / Poster Review Day',
     'Communicating research: posters; the APA report in RMarkdown; peer review.',
     'Poster due Nov 30 at noon; peer review due Fri Dec 4.'),
  (v_course, 14, NULL,         'exam',         NULL, 'No final exam',
     'Final paper due the last day of classes (Dec 8). No exam-period assessment.', NULL);

  -- Instructor enrollments: both of Norm's existing identities.
  INSERT INTO enrollments (person_id, course_id, role, status)
  VALUES
    ('45db45f9-eebb-4d1b-991d-1829cdb71c2a', v_course, 'instructor', 'active'),
    ('b4abff8c-3741-4f06-b19e-4418d098b7db', v_course, 'instructor', 'active')
  ON CONFLICT (person_id, course_id) DO NOTHING;

  -- Catalogue: 61 shells + lecture mapping. Shell = draft page, no body.
  INSERT INTO wiki_pages (course_id, slug, type, title, status)
  SELECT v_course, s.slug, s.type, s.title, 'draft'
  FROM (VALUES
    -- Week 1 -> L1
    ('why-research-beats-intuition',          'concept',    'Why Research Beats Experience'),
    ('biases-of-intuition',                   'concept',    'Five Ways Intuition Misleads'),
    ('sources-of-scientific-information',     'concept',    'Where Science Lives'),
    ('reading-an-empirical-article',          'concept',    'How to Read an Empirical Article'),
    ('science-journalism-and-disinformation', 'concept',    'Journalism, Hype, and Disinformation'),
    -- Week 2 -> L2
    ('research-ethics-history',               'concept',    'Tuskegee, Milgram, and Why Rules Exist'),
    ('core-ethical-principles',               'concept',    'Belmont and the APA Principles'),
    ('tcps2-and-the-reb',                     'concept',    'TCPS2: Ethics in Canada, and Meeting Your REB'),
    ('animal-research-ethics',                'concept',    'Animal Research and the Three Rs'),
    ('variables-and-operationalization',      'foundation', 'Variables, Constructs, Operationalization'),
    ('three-claims',                          'foundation', 'Three Kinds of Claims'),
    ('four-validities',                       'foundation', 'The Four Validities'),
    -- Week 3 -> L3
    ('scales-of-measurement',                 'concept',    'Scales of Measurement'),
    ('types-of-measures',                     'concept',    'Self-Report, Observation, Physiology'),
    ('reliability',                           'concept',    'Reliability: Are Scores Consistent?'),
    ('measurement-validity',                  'concept',    'Measurement Validity'),
    ('writing-good-survey-questions',         'concept',    'Asking Questions People Can Answer'),
    ('observational-methods',                 'concept',    'Observing Behavior Without Distorting It'),
    ('sampling-and-generalization',           'concept',    'Samples, Populations, and Generalization'),
    -- Week 4 -> L4
    ('bivariate-correlation',                 'concept',    'Bivariate Correlation'),
    ('interrogating-associations',            'foundation', 'Interrogating an Association'),
    ('third-variables-and-regression',        'concept',    'Third Variables and Multiple Regression'),
    ('moderation',                            'concept',    'Moderation: For Whom, and When'),
    ('mediation',                             'concept',    'Mediation: Asking Why'),
    ('longitudinal-and-cross-lag-designs',    'concept',    'Longitudinal and Cross-Lag Designs'),
    ('pattern-and-parsimony',                 'concept',    'Pattern and Parsimony'),
    -- Week 6 -> L5
    ('describing-data',                       'concept',    'Describing Data'),
    ('effect-sizes',                          'concept',    'Effect Sizes: How Much?'),
    ('confidence-intervals-and-precision',    'concept',    'Confidence Intervals and Precision'),
    ('power-and-error-tradeoffs',             'concept',    'Power, Type I and II, Sensitivity vs Specificity'),
    ('preregistration',                       'concept',    'Preregistration (You''re Already Doing It)'),
    ('simulating-data-in-r',                  'concept',    'Simulating Data in R'),
    -- Week 7 -> L6
    ('logic-of-experiments',                  'foundation', 'The Logic of Experiments'),
    ('iv-dv-control-variables',               'concept',    'Independent, Dependent, Control'),
    ('confounds-and-selection-effects',       'concept',    'Confounds and Selection Effects'),
    ('within-vs-between-designs',             'concept',    'Within vs Between, and Order Effects'),
    ('internal-validity-threats',             'concept',    'The Threat Taxonomy'),
    ('blinding-placebo-demand',               'concept',    'Placebo, Demand, and Blinding'),
    ('interpreting-null-results',             'concept',    'When Nothing Happens: Null Results'),
    -- Week 8 -> L7
    ('factorial-designs',                     'concept',    'Factorial Designs'),
    ('main-effects-and-interactions',         'concept',    'Main Effects and Interactions'),
    ('three-way-designs',                     'concept',    'Three-Way Designs'),
    ('quasi-experiments',                     'concept',    'Quasi-Experiments'),
    ('small-n-designs',                       'concept',    'Small-N and Single-Case Designs'),
    -- Week 9 -> L8
    ('mixed-designs',                         'concept',    'Mixed Designs and Clinical Trials'),
    ('simpsons-paradox',                      'concept',    'Simpson''s Paradox'),
    ('random-effects-intuition',              'concept',    'Random Effects, Intuitively'),
    ('when-why-controlling-for',              'concept',    'Moderation, Mediation, Confounds: The Cheat Sheet'),
    -- Week 11 -> L9
    ('replication',                           'concept',    'Replication: Direct, Conceptual, Extended'),
    ('meta-analysis-and-file-drawer',         'concept',    'Meta-Analysis and the File Drawer'),
    ('questionable-research-practices',       'concept',    'p-Hacking, HARKing, and Their Antidotes'),
    ('generalization-and-weird',              'concept',    'WEIRD Samples and Ecological Validity'),
    ('theory-testing-vs-generalization',      'concept',    'Two Modes: Theory-Testing and Generalization'),
    -- Week 12 -> L10
    ('research-posters',                      'concept',    'Making a Research Poster That Lands'),
    ('writing-the-report',                    'concept',    'The APA Report in RMarkdown'),
    ('peer-review',                           'concept',    'How to Review a Peer'),
    -- Practicals track
    ('practical-1-companion',                 'practical',  'Practical 1: Topic and Literature Review'),
    ('practical-2-companion',                 'practical',  'Practical 2: Measurement'),
    ('practical-3-companion',                 'practical',  'Practical 3: Manipulations and Covariates'),
    ('practical-4-companion',                 'practical',  'Practical 4: Correlation Stats and Plots'),
    ('practical-5-companion',                 'practical',  'Practical 5: Causal Inference')
  ) AS s(slug, type, title);

  -- Page -> content-lecture mapping (practicals map to the lecture of the
  -- week they are due in).
  INSERT INTO page_lectures (page_id, course_id, lecture_no)
  SELECT p.id, v_course, m.lecture_no
  FROM wiki_pages p
  JOIN (VALUES
    ('why-research-beats-intuition',1),('biases-of-intuition',1),('sources-of-scientific-information',1),
    ('reading-an-empirical-article',1),('science-journalism-and-disinformation',1),
    ('research-ethics-history',2),('core-ethical-principles',2),('tcps2-and-the-reb',2),
    ('animal-research-ethics',2),('variables-and-operationalization',2),('three-claims',2),('four-validities',2),
    ('scales-of-measurement',3),('types-of-measures',3),('reliability',3),('measurement-validity',3),
    ('writing-good-survey-questions',3),('observational-methods',3),('sampling-and-generalization',3),
    ('bivariate-correlation',4),('interrogating-associations',4),('third-variables-and-regression',4),
    ('moderation',4),('mediation',4),('longitudinal-and-cross-lag-designs',4),('pattern-and-parsimony',4),
    ('describing-data',5),('effect-sizes',5),('confidence-intervals-and-precision',5),
    ('power-and-error-tradeoffs',5),('preregistration',5),('simulating-data-in-r',5),
    ('logic-of-experiments',6),('iv-dv-control-variables',6),('confounds-and-selection-effects',6),
    ('within-vs-between-designs',6),('internal-validity-threats',6),('blinding-placebo-demand',6),
    ('interpreting-null-results',6),
    ('factorial-designs',7),('main-effects-and-interactions',7),('three-way-designs',7),
    ('quasi-experiments',7),('small-n-designs',7),
    ('mixed-designs',8),('simpsons-paradox',8),('random-effects-intuition',8),('when-why-controlling-for',8),
    ('replication',9),('meta-analysis-and-file-drawer',9),('questionable-research-practices',9),
    ('generalization-and-weird',9),('theory-testing-vs-generalization',9),
    ('research-posters',10),('writing-the-report',10),('peer-review',10),
    ('practical-1-companion',2),('practical-2-companion',4),('practical-3-companion',5),
    ('practical-4-companion',7),('practical-5-companion',9)
  ) AS m(slug, lecture_no) ON m.slug = p.slug
  WHERE p.course_id = v_course;
END $$;
