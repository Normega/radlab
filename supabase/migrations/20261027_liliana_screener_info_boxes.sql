-- Liliana Study 3: update the two pink info boxes on the pre-consent screener
-- (emotion-regulation-v1), at Liliana's request, 2026-10-27, approved by Norm.
--
-- The 2026-07-14 text had gone stale on two counts:
--   * it said the 10-of-12 minimum applies to *each* phase, but Phase 2 stopped
--     enforcing it on 2026-08-11; the real Phase 1 gates are 10 of 12 sessions
--     plus the midpoint within its 3-day window (days 14-16);
--   * it gave the de-identification date as November 1, 2026; it is now
--     March 1, 2027.
--
-- Participants see the copy in studies.screener (ScreenerPage reads
-- study.screener), not screeners.definition, so both are updated: the two live
-- Liliana studies' copies and the reusable screener row (also used by
-- "Liliana Study 3 - Live Test"). Only description.info_boxes changes; every
-- other key, including phase1, is left as it is.

WITH boxes AS (
  SELECT $b$[
    "<strong>Minimum participation requirement:</strong> If you miss a daily session, you will simply continue with the next scheduled session the following day. To continue to the second phase of the study, you must complete at least <strong>10 out of 12</strong> daily intervention and check-in sessions in the first phase, and complete the midpoint assessment within the 3 days it is available. If you do not, your participation will end after the first phase, and you will still receive compensation for the portion of the study you completed. There is no minimum number of sessions for the second phase.",
    "If you experience any discomfort at any point, please feel free to email the experimenter with your concerns. If your study participation is terminated — whether you choose to leave or your participation ends after the first phase — you will receive compensation for the portion completed up to the date of withdrawal.<br><br>You may request that your data be removed from the study up until your data are de-identified <strong>(anticipated March 1, 2027)</strong>. After this date, identifying information will have been permanently removed, and it will no longer be possible to withdraw your data."
  ]$b$::jsonb AS v
)
UPDATE screeners
SET definition = jsonb_set(definition, '{description,info_boxes}', boxes.v)
FROM boxes
WHERE slug = 'emotion-regulation-v1';

UPDATE studies s
SET screener = jsonb_set(s.screener, '{description,info_boxes}', sc.definition #> '{description,info_boxes}')
FROM screeners sc
WHERE sc.slug = 'emotion-regulation-v1'
  AND s.screener_id = sc.id
  AND s.screener ? 'description';
