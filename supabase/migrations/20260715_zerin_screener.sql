-- Zerin Langerian Mindfulness study screener (library seed).
--
-- Single-instrument PHQ-8 eligibility gate (mild low mood, score 5-9), distinct
-- from Liliana's joint GAD-7 + PHQ-8 screener. Uses the generalized ScreenerPage:
--   * phase-2 questionnaire list of length 1
--   * phase-2 scoring mode 'range' (5-9 pass; below fail_low; above fail_high)
--   * a phase-1 distress safety item with pass_answer 'no' and an 'unsure' option
--     that passes through (recorded in screener_results.phase1_answers for follow-up).
-- Every non-pass outcome states that course credit is not available and points to
-- the SONA alternative task + support resources.
--
-- Seeded into the screeners library for browse/preview/reuse. Authoring the study
-- copies this definition into studies.screener (jsonb) — the runtime source.

insert into public.screeners (slug, name, description, definition) values (
  'langerian-mindfulness-v1',
  'Langerian Mindfulness Study Screener',
  'PHQ-8 single-instrument eligibility gate (mild low mood, score 5-9) for the Zerin Langerian Mindfulness email study. U of T + PSY100 gate with a distress safety item.',
  '{
    "title": "Pre-Consent Screener",
    "version": "1.0",
    "module_id": "langerian-mindfulness-screener-v1",
    "module_type": "screener",
    "phase1": {
      "label": "Eligibility Criteria",
      "instruction": "Please answer each question honestly. Your responses help us determine whether this study is a good fit for you right now.",
      "fail_action": "stop",
      "items": [
        { "id": "p1_uoft",     "text": "I am currently enrolled as a student at the University of Toronto." },
        { "id": "p1_psy100",   "text": "I am enrolled in PSY100 this term." },
        { "id": "p1_english",  "text": "I can fluently read and write in English." },
        { "id": "p1_vision",   "text": "I have normal or corrected-to-normal vision." },
        { "id": "p1_capacity", "text": "I feel able to take part in a study that involves brief mood-related reflections delivered three times per day over a three-week period." },
        { "id": "p1_emails",   "text": "I am able to receive and read three brief emails per day for three weeks." },
        { "id": "p1_surveys",  "text": "I am willing to complete two short online surveys, one before and one after the study." },
        { "id": "p1_distress", "text": "Do you anticipate that taking part would cause you excessive distress or significantly interfere with your daily functioning?", "pass_answer": "no", "unsure": true, "unsure_action": "continue" }
      ],
      "fail_message": {
        "heading": "Thank you for your interest. This study may not be the right fit for you at this time.",
        "body": "Based on your responses, you do not meet the eligibility criteria for this study, so you would not be able to receive course credit for it. An equivalent alternative task is available for credit through the SONA system. We appreciate your time, and encourage you to explore the resources below."
      }
    },
    "phase2": {
      "label": "Pre-Screening Measure",
      "instruction": "Please complete the following brief questionnaire. Your responses help us determine whether this study is a good fit for you right now.",
      "questionnaires": [ { "order": 1, "questionnaire_slug": "phq-8" } ],
      "scoring": { "mode": "range", "questionnaire_slug": "phq-8", "pass": { "min": 5, "max": 9 } },
      "outcomes": {
        "pass": {
          "action": "continue",
          "heading": "You appear to be a good candidate for this study.",
          "body": "Based on your responses, you seem to be experiencing the kind of mild low mood this study is designed to explore. Press Next to continue to the consent form and baseline measures."
        },
        "fail_low": {
          "action": "stop",
          "heading": "You appear to be coping well right now.",
          "body": "This study is designed for people currently experiencing mild low mood, and your responses suggest that may not apply to you right now. Because of this, you would not be eligible to take part, and would not receive course credit for this study. An equivalent alternative task is available for credit through the SONA system. We encourage you to explore the resources below if you ever feel you could use extra support."
        },
        "fail_high": {
          "action": "stop",
          "heading": "It sounds like you may be going through a particularly difficult time.",
          "body": "We want to make sure you have the right level of support. Because this study is not a substitute for professional mental health care, we are not able to enrol participants who are currently experiencing higher levels of distress, so you would not be eligible for course credit through this study. An equivalent alternative task is available for credit through the SONA system. Please consider reaching out to one of the resources below. Support is available."
        }
      }
    },
    "resources": [
      { "name": "U of T Telus Health Student Support", "contact": "1-844-451-9700 (24/7)" },
      { "name": "Good2Talk Student Helpline",          "contact": "1-866-925-5454 (24/7)" },
      { "name": "UTM Health & Counselling Centre",     "contact": "905-828-5255" },
      { "name": "Talk Suicide Canada",                 "contact": "1-833-456-4566" }
    ],
    "description": {
      "part_label": "Part A - About This Study",
      "intro": [
        "Thank you for your interest in this study. It examines how brief, daily email prompts may influence mood, mindfulness, and reaction time.",
        "In this fully online study, you will be asked to:"
      ],
      "steps": [
        "Complete this brief pre-screening questionnaire to determine eligibility.",
        "If eligible, complete an online consent form and a baseline assessment of mood, mindfulness, and a short reaction-time task <em>(about 15 minutes)</em>.",
        "Receive three brief emails per day for three weeks. Each links to a short check-in on this site <em>(about 2 minutes each)</em>.",
        "Complete a final assessment identical to the baseline, followed by a debriefing <em>(about 15 minutes)</em>."
      ],
      "info_boxes": [
        "<strong>Compensation:</strong> Participants receive SONA course credit equivalent to approximately 3 hours of participation. An equivalent alternative task is available for course credit through the SONA system for anyone who is not eligible or who chooses not to take part.",
        "You may withdraw at any time by emailing the research team or using the opt-out link in the daily emails. You may request that your data be removed until it is de-identified (anticipated November 2026); after that, individual records cannot be isolated or removed."
      ]
    }
  }'::jsonb
)
on conflict (slug) do update set
  name        = excluded.name,
  description = excluded.description,
  definition  = excluded.definition;
