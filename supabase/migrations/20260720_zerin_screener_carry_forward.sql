-- Zerin Langerian Mindfulness study: opt the screener into PHQ-8 carry-forward.
--
-- Background: the screener administers the PHQ-8 (pass band 5-9) pre-consent,
-- and the "Zerin Baseline" session then re-administered PHQ-8 as its first node
-- -- two identical PHQ-8s back-to-back in one sitting. With phase2.carry_forward
-- set, ScreenerPage marks the passed screener answers, SessionEntry flushes them
-- as the baseline PHQ-8 row, and the Baseline session's PHQ-8 node auto-skips
-- (QuestionnaireStepWrapper) instead of asking again. Passing participants now
-- take the PHQ-8 once; the post-study PHQ-8 (separate session) is unaffected.
--
-- Opt-in flag only: no schema change, no other study touched. The PHQ-8 node
-- stays in the Baseline template on purpose so the session remains self-contained.

-- Live study config (delivered to the client by get_session_by_token).
UPDATE studies
SET screener = jsonb_set(
      screener,
      '{phase2,carry_forward}',
      'true'::jsonb,
      true
    )
WHERE id = '6d3c38ce-d1da-42ea-9bb4-c9450054065f'
  AND screener->'phase2' IS NOT NULL;

-- Reusable library definition (kept in sync so future clones inherit the flag).
UPDATE screeners
SET definition = jsonb_set(
      definition,
      '{phase2,carry_forward}',
      'true'::jsonb,
      true
    )
WHERE slug = 'langerian-mindfulness-v1'
  AND definition->'phase2' IS NOT NULL;
