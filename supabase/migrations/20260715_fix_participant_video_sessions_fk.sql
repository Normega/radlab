-- participant_video_sessions.video_id had its FK pointing at study_videos(id)
-- — an older, now-dead table (0 rows, referenced nowhere else live) that
-- predates video_library, the registry the entire video-step feature
-- (VideoStepWrapper.jsx, StudyVideoPlayer.tsx, 20260714_video_step.sql) was
-- actually built against. Every real video step's insert into
-- participant_video_sessions therefore violated this FK on every attempt
-- (100% failure rate, not a race) — surfaced to participants as a silent
-- blank video window (StudyVideoPlayer's mount effect catches the throw and
-- renders only its error overlay) and to the console as a 409 Conflict
-- (PostgREST maps 23503 foreign_key_violation to HTTP 409, same as a unique
-- violation — misleading, but confirmed via pg_constraint this table has no
-- unique constraint besides its own primary key, so it can only be the FK).
--
-- Found live 2026-07-15 testing the Baseline session's final step (the
-- "Introduction Video"). Fix: repoint the FK at video_library(id).

ALTER TABLE participant_video_sessions
  DROP CONSTRAINT participant_video_sessions_video_id_fkey;

ALTER TABLE participant_video_sessions
  ADD CONSTRAINT participant_video_sessions_video_id_fkey
  FOREIGN KEY (video_id) REFERENCES video_library(id) ON DELETE RESTRICT;
