-- Realtime postgres_changes drops UPDATE events it cannot authorize under
-- RLS, and with REPLICA IDENTITY DEFAULT (primary key only) the row's
-- columns aren't in the replication record for the RLS check — so a student
-- never received the check-in's status flip (Show results) or quiz reveal,
-- while INSERT-driven signals (the response counter) worked because inserts
-- carry the whole row. FULL puts every column in the WAL record so the
-- "members read live" policy can be evaluated on UPDATEs too.
-- (Norm, 2026-09-06: show results and show correct didn't reach students.)
alter table public.checkins replica identity full;
-- Same shape for question-box publishing: a class_questions row goes
-- status -> 'published' via UPDATE, and the screen/room consume it the same
-- realtime way.
alter table public.class_questions replica identity full;
