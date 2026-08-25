-- Composable-surveys integration, step 2b: seeds + picker category split.
--
-- ⚠ APPLY ORDER: this one is COUPLED to the frontend, unlike 2a. It creates
-- activities rows with NEW category values and recategorizes the existing
-- slider/package rows, so StepDispatcher and SessionBuilder must already
-- handle those categories when it runs. Apply at handoff step 4 time, after
-- the dispatcher/picker code is live on main — a live participant session
-- dispatching an activity whose category the deployed dispatcher doesn't know
-- renders "Unknown activity type".
--
-- Two things happen here:
--
-- 1. The four demo instances currently hardcoded on /admin/instruments/:slug
--    (AdoptedInstrumentPage's `static` library rows + proposedInstruments.jsx
--    demo content) become real composable_instruments rows, each with an
--    activities row so the session-builder picker's PENDING chips become
--    importable steps. Configs are in Dana's component-config contract shape
--    so they feed her components verbatim.
--
-- 2. The picker category split (handoff goal: mirror the admin sidebar, no
--    more combined "VAS & Sliders"): existing activities rows keyed
--    slider_* / vas_pkg_* under category 'vas' move to 'numeric_slider' /
--    'assessment'. Subcategory prefixes are untouched — VasStepWrapper keys
--    on those and keeps working; only the grouping label moves. New categories
--    for the new types: 'likert_slider', 'multiple_choice', 'open_list',
--    'hierarchy' (subcategory = the composable_instruments slug, no prefix —
--    the category already disambiguates).

-- ── Demo instances → real library rows ───────────────────────────────────────

INSERT INTO composable_instruments (slug, type, label, config) VALUES
(
  'demo_noticing_frequency',
  'likert_slider',
  'Noticing frequency (demo)',
  '{
    "question": "How often did you notice this feeling today?",
    "min": 1, "max": 6, "step": 1,
    "labels": [
      {"value": 1, "label": "Never"},
      {"value": 2, "label": "Rarely"},
      {"value": 3, "label": "Sometimes"},
      {"value": 4, "label": "Often"},
      {"value": 5, "label": "Very often"},
      {"value": 6, "label": "Almost always"}
    ]
  }'::jsonb
),
(
  'demo_target_grade',
  'multiple_choice',
  'Target grade (demo)',
  '{
    "question": "What final grade are you aiming to achieve in this course?",
    "required": true,
    "options": [
      {"id": "specific_grade", "label": "I am aiming for a specific final grade.",
       "response_type": "number", "placeholder": "85", "suffix": "%",
       "min": 0, "max": 100, "step": 1},
      {"id": "pass_only", "label": "I do not have a specific target grade, as long as I pass.",
       "response_type": "plain"}
    ]
  }'::jsonb
),
(
  'demo_outcome_attribution',
  'open_list',
  'Outcome attribution factors (demo)',
  '{
    "question": "What do you think caused this outcome? Please list all the factors that you think contributed, and indicate how much each factor contributed.",
    "required": true,
    "initial_boxes": 3,
    "max_words": 5,
    "example_placeholder": "Ex. I need better study strategies…",
    "minimum_required_responses": 1,
    "slider": {
      "question": "How much did this factor contribute?",
      "min": 0, "max": 100, "step": 1,
      "labels": [
        {"value": 0, "label": "Did not contribute"},
        {"value": 100, "label": "Contributed completely"}
      ]
    }
  }'::jsonb
),
(
  'demo_feedback_beliefs',
  'hierarchy',
  'Feedback belief hierarchy (demo)',
  '{
    "question": "How much did this feedback change your belief about…",
    "instruction": "Select all of the beliefs that changed. You can select more than one.",
    "allow_none_selected": true,
    "beliefs": [
      {"id": "skill_specific",    "depth": 0, "level": "Skill-specific",                  "text": "My understanding of the specific topic or skill assessed"},
      {"id": "strategy_specific", "depth": 1, "level": "Strategy-specific",               "text": "Whether my current study strategy works for this course"},
      {"id": "meta_strategy",     "depth": 2, "level": "Meta-strategy specific",          "text": "Whether my current strategy for managing my time, effort, and study process works for this course"},
      {"id": "course_efficacy",   "depth": 3, "level": "Course-specific · self-efficacy", "text": "My ability to succeed in this subject area"},
      {"id": "domain_efficacy",   "depth": 4, "level": "Domain-specific · self-efficacy", "text": "My ability to succeed in this domain"},
      {"id": "self_global",       "depth": 5, "level": "Self-global · self-efficacy",     "text": "My general competence / self-worth"}
    ],
    "slider": {
      "question": "Did this belief change in a positive or negative direction?",
      "min": -50, "max": 50, "step": 1,
      "labels": [
        {"value": -50, "label": "Negative change"},
        {"value": 0,   "label": "No directional change"},
        {"value": 50,  "label": "Positive change"}
      ]
    }
  }'::jsonb
)
ON CONFLICT (slug) DO NOTHING;

-- ── Picker rows for the new instruments ──────────────────────────────────────
-- (activities has a unique index on category+subcategory since 20260606, so
-- ON CONFLICT DO NOTHING is reliable.)

INSERT INTO activities (category, subcategory, label, description) VALUES
  ('likert_slider',   'demo_noticing_frequency',  'Likert Slider – Noticing frequency (demo)', 'Never → Almost always (1–6)'),
  ('multiple_choice', 'demo_target_grade',        'MC – Target grade (demo)',                  'Specific grade (number entry) vs pass-only'),
  ('open_list',       'demo_outcome_attribution', 'Open List – Outcome attribution (demo)',    'Free-listed factors, each with a contribution slider'),
  ('hierarchy',       'demo_feedback_beliefs',    'Hierarchy – Feedback beliefs (demo)',       'Six-level belief hierarchy with signed direction sliders')
ON CONFLICT (category, subcategory) DO NOTHING;

-- ── Split the combined "VAS & Sliders" category ──────────────────────────────
-- Plain vas_* rows stay category 'vas'.

UPDATE activities SET category = 'numeric_slider'
 WHERE category = 'vas' AND subcategory LIKE 'slider\_%';

UPDATE activities SET category = 'assessment'
 WHERE category = 'vas' AND subcategory LIKE 'vas\_pkg\_%';
