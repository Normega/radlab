-- Sandy Study 3 — pre-consent eligibility screener
--
-- Five yes/no criteria, all of which must be met. Unlike the Liliana and Zerin
-- screeners this one is PHASE 1 ONLY: there is no questionnaire-based second
-- phase, because eligibility here is a set of self-report criteria rather than a
-- distress-band gate. `ScreenerPage.jsx` gained support for phase-1-only
-- screeners in the same change that added this migration — without it, passing
-- phase 1 dead-ends on a "Continue to Pre-Screening" button with nothing behind
-- it.
--
-- Two deliberate copy decisions:
--   * Item 4 states 35 minutes and names the actual activities. The session's
--     measured median is 30.8 min (N=20 pilot) across three word tasks, a
--     colouring task and a questionnaire battery. An earlier draft said
--     "anagram tasks" and "20-minute", which would have under-stated the
--     commitment and contradicted the consent form.
--   * The fail screen tells participants to RETURN the submission on Prolific,
--     which is the actual affordance, and says returning does not affect their
--     approval rating — otherwise ineligible participants tend to abandon the
--     tab, which holds the slot open until it times out.
--
-- Idempotent: re-running updates the definition in place and re-points the study.

INSERT INTO screeners (slug, name, description, definition)
VALUES (
  'perfectionism-effort-v1',
  'Perfectionism and Effort Allocation Screener',
  'Single-phase pre-consent eligibility gate for Sandy Study 3 (Prolific). Five self-report criteria, all required. No questionnaire phase.',
  jsonb_build_object(
    'title',       'Pre-Consent Screener',
    'version',     '1.0',
    'module_id',   'perfectionism-effort-screener-v1',
    'module_type', 'screener',

    'description', jsonb_build_object(
      'part_label', 'Part A — about this study',
      'intro', jsonb_build_array(
        'Thank you for your interest. This study looks at how people divide their effort across several short thinking tasks, and how that relates to mood and to the standards people hold for their own performance.',
        'In this fully online session you will be asked to:'
      ),
      'steps', jsonb_build_array(
        'Answer five brief eligibility questions.',
        'If eligible, read and sign a consent form.',
        'Complete a set of word puzzles and a colouring activity <em>(about 15 minutes)</em>.',
        'Answer brief mood and effort ratings throughout, then a set of questionnaires <em>(about 15 minutes)</em>.',
        'Read a debriefing page explaining what the study was testing.'
      ),
      'info_boxes', jsonb_build_array(
        '<strong>Time and setup:</strong> about 35 minutes in one sitting, on a desktop or laptop with a mouse or trackpad. A phone or tablet will not work for the colouring activity.',
        'Participation is voluntary and you may stop at any time. If you stop partway through, or find you are not eligible, please return your submission on Prolific so the slot can be released.'
      )
    ),

    'phase1', jsonb_build_object(
      'label',          'Eligibility Criteria',
      'instruction',    'Please indicate whether each statement applies to you. You must answer Yes to all five to take part.',
      'pass_condition', 'all_yes',
      'fail_action',    'stop',
      'items', jsonb_build_array(
        jsonb_build_object('id', 'p1_english',  'text', 'I can fluently read and write in English.'),
        jsonb_build_object('id', 'p1_vision',   'text', 'I have normal or corrected-to-normal vision.'),
        jsonb_build_object('id', 'p1_capacity', 'text', 'I consider myself to be in good enough mental health to reflect briefly on my mood and stress levels.'),
        jsonb_build_object('id', 'p1_sitting',  'text', 'I am willing to complete the word puzzles and colouring activity in one 35-minute sitting.'),
        jsonb_build_object('id', 'p1_distress', 'text', 'I am not currently experiencing depression, anxiety, or effects of trauma severe enough that taking part would be upsetting to me or disruptive to my ability to function.')
      ),
      'fail_message', jsonb_build_object(
        'heading', 'Thank you for your interest — this study isn''t the right fit for you at this time.',
        'body',    'Based on your answers you are not eligible for this study, so please <strong>return your submission on Prolific</strong> rather than leaving it open. Returning it costs you nothing and does not affect your approval rating.<br><br>If any of these questions raised something you would like to talk to someone about, the resources below are free and confidential.'
      ),
      'pass_message', jsonb_build_object(
        'heading', 'You meet the eligibility criteria.',
        'body',    'Press Next to continue to the consent form and begin the session.'
      )
    ),

    'resources', jsonb_build_array(
      jsonb_build_object('name', 'Talk Suicide Canada',        'contact', '1-833-456-4566 (24/7)'),
      jsonb_build_object('name', 'Good2Talk Student Helpline', 'contact', '1-866-925-5454 (24/7)'),
      jsonb_build_object('name', 'Crisis Text Line',           'contact', 'Text HOME to 686868'),
      jsonb_build_object('name', 'Find a helpline (worldwide)','contact', 'findahelpline.com')
    )
  )
)
ON CONFLICT (slug) DO UPDATE
  SET name        = EXCLUDED.name,
      description = EXCLUDED.description,
      definition  = EXCLUDED.definition;

-- Attach to Sandy Study 3. `studies.screener` is a denormalised copy of the
-- definition read by ScreenerPage via get_session_by_token; `screener_id` is the
-- link back to the library row. Both are set, matching the Liliana/Zerin studies.
UPDATE studies s
SET screener_id = sc.id,
    screener    = sc.definition
FROM screeners sc
WHERE sc.slug = 'perfectionism-effort-v1'
  AND s.id    = 'f8cbf629-d477-4ada-ae47-23a59c602b13';
