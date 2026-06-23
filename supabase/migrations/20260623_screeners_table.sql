-- Screeners library: reusable screener definitions that can be attached to studies.
-- Screener definitions are managed by lab staff and seeded via migrations.
-- Participants receive screener definitions via the get_session_by_token RPC (SECURITY DEFINER),
-- not by querying this table directly.

CREATE TABLE IF NOT EXISTS screeners (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text    NOT NULL UNIQUE,
  name        text    NOT NULL,
  description text,
  definition  jsonb   NOT NULL,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE studies
  ADD COLUMN IF NOT EXISTS screener_id uuid REFERENCES screeners(id);

-- RLS: lab members only (participants get definitions via the SECURITY DEFINER RPC)
ALTER TABLE screeners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lab manage screeners"
  ON screeners FOR ALL
  TO authenticated
  USING  (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'lab'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'lab'));

-- Seed: Liliana Wu's emotion regulation study screener
INSERT INTO screeners (slug, name, description, definition)
VALUES (
  'emotion-regulation-v1',
  'Emotion Regulation Study Screener',
  'Two-phase pre-consent screener for Liliana Wu''s emotion regulation study. Phase 1 checks six eligibility criteria; Phase 2 uses GAD-7 + PHQ-8 to confirm appropriate distress range.',
  $definition${
  "module_id": "emotion-regulation-screener-v1",
  "module_type": "screener",
  "version": "1.0",
  "title": "Pre-Consent Screener",
  "phase1": {
    "label": "Eligibility Criteria",
    "instruction": "Please indicate whether each of the following statements applies to you. You must answer Yes to all items to be eligible.",
    "pass_condition": "all_yes",
    "fail_action": "stop",
    "fail_message": {
      "heading": "Thank you for your interest — this study may not be the right fit for you at this time.",
      "body": "Based on your responses, you do not meet the eligibility criteria for this study. We appreciate your time and encourage you to explore the following campus and community mental health resources."
    },
    "items": [
      { "id": "p1_1", "text": "I can fluently read and write in English." },
      { "id": "p1_2", "text": "I have normal or corrected-to-normal vision." },
      { "id": "p1_3", "text": "I experience some level of emotional distress." },
      { "id": "p1_4", "text": "I do not currently have, and have not had in the past year, a diagnosis of a cognitive, mood, or substance use disorder." },
      { "id": "p1_5", "text": "I have daily access to email and an internet-connected web browser." },
      { "id": "p1_6", "text": "I am willing to complete brief online interventions and report on stress and mood for approximately 4 minutes per day over a 31-day period." }
    ]
  },
  "phase2": {
    "label": "Pre-Screening Measures",
    "instruction": "Please complete the following two brief questionnaires. Your responses help us determine whether this study is a good fit for you right now.",
    "questionnaires": [
      { "questionnaire_slug": "gad-7", "order": 1 },
      { "questionnaire_slug": "phq-8", "order": 2 }
    ],
    "scoring": {
      "gad7": {
        "none_mild": { "min": 0,  "max": 9  },
        "moderate":  { "min": 10, "max": 14 },
        "severe":    { "min": 15, "max": 21 }
      },
      "phq8": {
        "none_mild": { "min": 0,  "max": 9  },
        "moderate":  { "min": 10, "max": 19 },
        "severe":    { "min": 20, "max": 24 }
      },
      "pass_conditions": [
        "neither_score_is_severe",
        "at_least_one_score_is_moderate_or_above"
      ]
    },
    "outcomes": {
      "pass": {
        "heading": "You appear to be a good candidate for this study.",
        "body": "Based on your responses, you seem to be experiencing a level of emotional distress that this study is designed to support. Press Next to continue to the consent form and baseline survey.",
        "action": "continue"
      },
      "fail_low": {
        "heading": "You appear to be coping well with everyday demands.",
        "body": "This study is designed for people experiencing a moderate level of emotional distress, and your responses suggest that may not apply to you right now. Because of this, the study may not be the best fit at this time. We encourage you to check out the resources below if you ever feel you could use additional support.",
        "action": "stop"
      },
      "fail_high": {
        "heading": "It sounds like you may be going through a particularly difficult time.",
        "body": "We want to make sure you have the right level of support. Because this study is not a substitute for professional mental health care, we are not able to enroll participants who are currently experiencing high levels of distress. Please consider reaching out to one of the resources below — support is available.",
        "action": "stop"
      }
    }
  },
  "resources": [
    { "name": "UTM Health & Counselling Centre",       "contact": "utm.utoronto.ca/health-counselling" },
    { "name": "Good2Talk Student Helpline",             "contact": "1-866-925-5454 (24/7)" },
    { "name": "Distress Centres of Greater Toronto",   "contact": "416-408-4357" },
    { "name": "Crisis Services Canada",                "contact": "1-833-456-4566" }
  ]
}$definition$::jsonb
) ON CONFLICT (slug) DO NOTHING;
