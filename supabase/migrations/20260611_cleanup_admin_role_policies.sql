-- L1: Remove dead 'admin' role references from RLS policies.
-- The profiles.role CHECK constraint only allows 'lab', 'participant', 'public';
-- 'admin' can never be assigned, so all IN ('lab','admin') checks had a dead branch.
-- Replacement: use my_role() = 'lab' for lab-access tables, and
-- my_role() = 'lab' OR is_super_admin() where the policy intent was elevated access.

-- ── intervention_modules ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "lab delete" ON public.intervention_modules;
DROP POLICY IF EXISTS "lab insert" ON public.intervention_modules;
DROP POLICY IF EXISTS "lab update" ON public.intervention_modules;
CREATE POLICY "lab delete" ON public.intervention_modules FOR DELETE TO authenticated USING (my_role() = 'lab');
CREATE POLICY "lab insert" ON public.intervention_modules FOR INSERT TO authenticated WITH CHECK (my_role() = 'lab');
CREATE POLICY "lab update" ON public.intervention_modules FOR UPDATE TO authenticated USING (my_role() = 'lab');

-- ── intervention_responses ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "lab all" ON public.intervention_responses;
CREATE POLICY "lab all" ON public.intervention_responses FOR ALL TO authenticated
  USING (my_role() = 'lab') WITH CHECK (my_role() = 'lab');

-- ── liliana_day_data ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "lab all" ON public.liliana_day_data;
CREATE POLICY "lab all" ON public.liliana_day_data FOR ALL TO authenticated
  USING (my_role() = 'lab') WITH CHECK (my_role() = 'lab');

-- ── liliana_participants ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "lab all" ON public.liliana_participants;
CREATE POLICY "lab all" ON public.liliana_participants FOR ALL TO authenticated
  USING (my_role() = 'lab') WITH CHECK (my_role() = 'lab');

-- ── study_audios ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "lab manage study_audios" ON public.study_audios;
CREATE POLICY "lab manage study_audios" ON public.study_audios FOR ALL TO authenticated
  USING (my_role() = 'lab') WITH CHECK (my_role() = 'lab');

-- ── study_videos ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "lab delete" ON public.study_videos;
DROP POLICY IF EXISTS "lab insert" ON public.study_videos;
DROP POLICY IF EXISTS "lab update" ON public.study_videos;
CREATE POLICY "lab delete" ON public.study_videos FOR DELETE TO authenticated USING (my_role() = 'lab');
CREATE POLICY "lab insert" ON public.study_videos FOR INSERT TO authenticated WITH CHECK (my_role() = 'lab');
CREATE POLICY "lab update" ON public.study_videos FOR UPDATE TO authenticated USING (my_role() = 'lab');

-- ── video_library ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "lab delete" ON public.video_library;
DROP POLICY IF EXISTS "lab insert" ON public.video_library;
DROP POLICY IF EXISTS "lab update" ON public.video_library;
CREATE POLICY "lab delete" ON public.video_library FOR DELETE TO authenticated USING (my_role() = 'lab');
CREATE POLICY "lab insert" ON public.video_library FOR INSERT TO authenticated WITH CHECK (my_role() = 'lab');
CREATE POLICY "lab update" ON public.video_library FOR UPDATE TO authenticated USING (my_role() = 'lab');

-- ── participant_compensation ──────────────────────────────────────────────────
-- Was using a direct profiles subquery instead of my_role(); clean up to match convention.
DROP POLICY IF EXISTS "lab full access" ON public.participant_compensation;
CREATE POLICY "lab full access" ON public.participant_compensation FOR ALL TO authenticated
  USING (my_role() = 'lab' OR is_super_admin())
  WITH CHECK (my_role() = 'lab' OR is_super_admin());

-- ── participant_video_sessions ────────────────────────────────────────────────
-- Was checking 'admin'/'researcher' roles (unassignable) + super_admin = true.
-- Consolidate to lab + is_super_admin().
DROP POLICY IF EXISTS "Admins and researchers can read all sessions" ON public.participant_video_sessions;
CREATE POLICY "lab read all video sessions" ON public.participant_video_sessions
  FOR SELECT TO authenticated
  USING (my_role() = 'lab' OR is_super_admin());

-- ── participant_video_events ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins and researchers can read all events" ON public.participant_video_events;
CREATE POLICY "lab read all video events" ON public.participant_video_events
  FOR SELECT TO authenticated
  USING (my_role() = 'lab' OR is_super_admin());
