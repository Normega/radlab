-- Liliana Study 3: the participants the Phase 1 adherence check withdrew
-- before the midpoint existed for them (2026-10-01..10-14) get the midpoint
-- after all (Norm, 2026-10-14) -- the same treatment
-- 20261014_liliana3_ac_p1_assess_then_withdraw.sql now gives everyone below
-- 10 of 12. 6 real participants (a 7th match is a test enrollment, excluded by
-- is_test); all consented and completed baseline, 4 did 3-9 daily sessions,
-- 2 (withdrawn that morning) did none.
--
-- Norm's decision, recorded as data on their rows (CLAUDE.md, hard gates rule
-- 4): the enrollment is reopened, with the original withdrawal kept in
-- `notes`, and a midpoint row is scheduled for 2026-10-15 marked
-- resend_note = 'reinstated_after_termination'. That mark is the only thing
-- that lets the midpoint email say "we wrote to let you know your
-- participation had ended" (send_message, emailTemplate assessOnlyIntro) --
-- these 6 were sent that termination email. It opens no gate:
-- schedule_row_block_reason only exempts 'baseline_catchup'.
--
-- Afterwards the ordinary path runs: the midpoint is sent at 06:00, ends with
-- the explanation and debrief (MidpointStep), and the next advance pass
-- withdraws them at the Phase 2 fork with the thank-you email. A missed
-- midpoint withdraws them again with the ordinary termination email.
--
-- Apply after 20261014_liliana3_ac_p1_assess_then_withdraw.sql.

-- resend_note is a closed vocabulary; the new value names a fact, not a pass.
ALTER TABLE participant_schedule DROP CONSTRAINT participant_schedule_resend_note_check;
ALTER TABLE participant_schedule ADD CONSTRAINT participant_schedule_resend_note_check
  CHECK (resend_note IS NULL OR resend_note IN ('baseline_catchup', 'reinstated_after_termination'));

WITH target AS (
  SELECT e.id, e.study_id, e.profile_id, e.withdrawal_reason, e.withdrawn_at
    FROM study_enrollments e
   WHERE e.study_id IN ('958150a9-7821-4daf-8d83-e9325369d91d', 'ee542d3b-c0da-4a5f-ac34-6b981f153298')
     AND e.status = 'withdrawn'
     AND e.withdrawal_reason LIKE 'Adherence check failed:%in phase1%'
     AND NOT COALESCE(e.is_test, false)
     AND e.withdrawn_at < '2026-10-15'
), reopened AS (
  UPDATE study_enrollments e
     SET status            = 'enrolled',
         notes             = concat_ws(E'\n', e.notes,
                               '2026-10-14: reinstated for the midpoint (Norm). Was withdrawn ' ||
                               to_char(t.withdrawn_at AT TIME ZONE 'America/Toronto', 'YYYY-MM-DD HH24:MI') ||
                               ': ' || t.withdrawal_reason),
         withdrawal_reason = NULL,
         withdrawn_at      = NULL
    FROM target t
   WHERE e.id = t.id
  RETURNING e.study_id, e.profile_id
), lp AS (
  UPDATE liliana_participants l
     SET dropped_out = false, dropout_reason = NULL
    FROM reopened r
   WHERE l.profile_id = r.profile_id AND l.study_id = r.study_id
  RETURNING l.id
)
INSERT INTO participant_schedule
  (participant_id, study_id, study_session_id, scheduled_date, send_time, status, study_day, resend_note)
SELECT r.profile_id, r.study_id, ss.id, DATE '2026-10-15',
       COALESCE(ss.send_time, TIME '06:00'), 'pending', ss.day_number, 'reinstated_after_termination'
  FROM reopened r
  JOIN study_sessions ss ON ss.study_id = r.study_id AND ss.node_key = 's_mid'
 WHERE NOT EXISTS (SELECT 1 FROM participant_schedule ps
                    WHERE ps.participant_id = r.profile_id AND ps.study_session_id = ss.id);
