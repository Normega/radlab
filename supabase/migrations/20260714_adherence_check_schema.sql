-- Adherence check: strongly-enforced >=N-of-M daily session requirement per
-- phase. A participant who falls short at the gate is withdrawn, their
-- active link revoked, and sent a termination email — none of which the
-- scheduler currently does for anyone, even the existing manual "Withdraw"
-- button in EnrollmentPanel.jsx/StudyDetail.jsx (confirmed live: it only
-- ever sets study_enrollments.status='withdrawn' with no schema-level
-- follow-through, and check_schedule/materializeSchedule never read that
-- field — a withdrawn participant keeps getting scheduled and emailed
-- today). This migration adds the columns; check_schedule.ts and
-- materializeSchedule.ts (deployed separately, not via SQL migration) do
-- the enforcement.

ALTER TABLE study_enrollments
  ADD COLUMN IF NOT EXISTS withdrawal_reason text,
  ADD COLUMN IF NOT EXISTS withdrawn_at timestamptz;

-- Hardens the field per its original documented intent (comment in
-- 20260602_study_admin_redesign.sql) — safe against live data, confirmed
-- via query that only 'completed'/'withdrawn'/'enrolled' currently exist.
ALTER TABLE study_enrollments
  ADD CONSTRAINT study_enrollments_status_check
  CHECK (status IN ('enrolled', 'in_progress', 'completed', 'withdrawn'));

-- message_log has always carried exactly one kind of message (the
-- session-link reminder). Adding a distinct "kind" now that a second,
-- structurally different message (adherence termination — no link) exists.
ALTER TABLE message_log
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'session_link';

ALTER TABLE message_log
  ADD CONSTRAINT message_log_kind_check
  CHECK (kind IN ('session_link', 'adherence_termination'));
