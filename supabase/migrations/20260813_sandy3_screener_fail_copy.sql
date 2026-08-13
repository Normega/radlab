-- Sandy Study 3 — screen-out copy names the study description as the reason
--
-- The screen-out page previously said only "Based on your answers you are not
-- eligible for this study". That states a verdict without a reference point, so
-- the return request reads as a judgement about the participant.
--
-- The five criteria are published in the Prolific listing (see prereg §3.2 —
-- deliberately not implemented as custom prescreening, because a Prolific
-- prescreener is itself a paid study with its own completion path). Pointing the
-- screen-out back at that listing makes the return a stated rule the participant
-- could have checked in advance, rather than something decided about them here.
--
-- Targeted `jsonb_set` on the fail body only; every other field of the
-- definition is left exactly as applied by 20260811_sandy3_screener.sql.

WITH new_body AS (
  SELECT to_jsonb(
    'Your answers indicate that you do not meet the eligibility criteria set out in the study description, so please <strong>return your submission on Prolific</strong>. Returning it costs you nothing and does not affect your approval rating.<br><br>If any of these questions raised something you would like to talk to someone about, the resources below are free and confidential.'::text
  ) AS body
)
UPDATE screeners sc
SET definition = jsonb_set(
      sc.definition,
      '{phase1,fail_message,body}',
      (SELECT body FROM new_body),
      false
    )
WHERE sc.slug = 'perfectionism-effort-v1';

-- Re-sync the denormalised copy the participant flow actually reads.
UPDATE studies s
SET screener = sc.definition
FROM screeners sc
WHERE sc.slug = 'perfectionism-effort-v1'
  AND s.screener_id = sc.id;
