-- WP3a live bug: a lab-role/super_admin account can get past ClassAdminRoute
-- (UI gate allows class_admins OR lab role/super_admin, mirroring the
-- "classes: admins update" RLS policy) but every write on lectures/checkins/
-- class_questions then silently fails, because those policies only ever
-- checked class_admins membership — never got the lab/super_admin OR clause
-- the classes table policy has. Console code didn't check {error} either, so
-- the failure was invisible (exactly the silent-RLS-failure mode CLAUDE.md
-- warns about). Reproduced live: INSERT into lectures as a lab-role account
-- with no class_admins row for that class → 42501 RLS violation.
--
-- Fix: widen every class-admin-scoped policy to accept lab role/super_admin
-- as an alternative to class_admins, consistent with the rest of the
-- platform's "lab role has broad access" convention (profiles: lab read all,
-- etc.) and with what the UI gate already promises.

DROP POLICY "lectures: admins all" ON lectures;
CREATE POLICY "lectures: admins all"
  ON lectures FOR ALL
  TO authenticated
  USING (
    my_role() = 'lab' OR is_super_admin()
    OR EXISTS (SELECT 1 FROM class_admins ca WHERE ca.class_id = lectures.class_id AND ca.user_id = auth.uid())
  )
  WITH CHECK (
    my_role() = 'lab' OR is_super_admin()
    OR EXISTS (SELECT 1 FROM class_admins ca WHERE ca.class_id = lectures.class_id AND ca.user_id = auth.uid())
  );

DROP POLICY "checkins: admins all" ON checkins;
CREATE POLICY "checkins: admins all"
  ON checkins FOR ALL
  TO authenticated
  USING (
    my_role() = 'lab' OR is_super_admin()
    OR EXISTS (
      SELECT 1 FROM lectures l JOIN class_admins ca ON ca.class_id = l.class_id
      WHERE l.id = checkins.lecture_id AND ca.user_id = auth.uid()
    )
  )
  WITH CHECK (
    my_role() = 'lab' OR is_super_admin()
    OR EXISTS (
      SELECT 1 FROM lectures l JOIN class_admins ca ON ca.class_id = l.class_id
      WHERE l.id = checkins.lecture_id AND ca.user_id = auth.uid()
    )
  );

DROP POLICY "checkin_responses: admins read all" ON checkin_responses;
CREATE POLICY "checkin_responses: admins read all"
  ON checkin_responses FOR SELECT
  TO authenticated
  USING (
    my_role() = 'lab' OR is_super_admin()
    OR EXISTS (
      SELECT 1 FROM checkins c JOIN lectures l ON l.id = c.lecture_id JOIN class_admins ca ON ca.class_id = l.class_id
      WHERE c.id = checkin_responses.checkin_id AND ca.user_id = auth.uid()
    )
  );

DROP POLICY "class_questions: admins read all" ON class_questions;
CREATE POLICY "class_questions: admins read all"
  ON class_questions FOR SELECT
  TO authenticated
  USING (
    my_role() = 'lab' OR is_super_admin()
    OR EXISTS (
      SELECT 1 FROM checkins c JOIN lectures l ON l.id = c.lecture_id JOIN class_admins ca ON ca.class_id = l.class_id
      WHERE c.id = class_questions.checkin_id AND ca.user_id = auth.uid()
    )
  );

DROP POLICY "class_questions: admins update" ON class_questions;
CREATE POLICY "class_questions: admins update"
  ON class_questions FOR UPDATE
  TO authenticated
  USING (
    my_role() = 'lab' OR is_super_admin()
    OR EXISTS (
      SELECT 1 FROM checkins c JOIN lectures l ON l.id = c.lecture_id JOIN class_admins ca ON ca.class_id = l.class_id
      WHERE c.id = class_questions.checkin_id AND ca.user_id = auth.uid()
    )
  )
  WITH CHECK (
    my_role() = 'lab' OR is_super_admin()
    OR EXISTS (
      SELECT 1 FROM checkins c JOIN lectures l ON l.id = c.lecture_id JOIN class_admins ca ON ca.class_id = l.class_id
      WHERE c.id = class_questions.checkin_id AND ca.user_id = auth.uid()
    )
  );

-- get_checkin_mood_results (WP5's results RPC) has the same gap for
-- completeness, even though nothing calls it yet.
CREATE OR REPLACE FUNCTION public.get_checkin_mood_results(p_checkin_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_allowed boolean;
  v_results jsonb;
BEGIN
  SELECT
    my_role() = 'lab' OR is_super_admin()
    OR EXISTS (
      SELECT 1 FROM checkins c JOIN lectures l ON l.id = c.lecture_id JOIN class_members cm ON cm.class_id = l.class_id
      WHERE c.id = p_checkin_id AND cm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM checkins c JOIN lectures l ON l.id = c.lecture_id JOIN class_admins ca ON ca.class_id = l.class_id
      WHERE c.id = p_checkin_id AND ca.user_id = auth.uid()
    )
  INTO v_allowed;

  IF NOT v_allowed THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  SELECT jsonb_agg(jsonb_build_object(
    'valence', mood->>'valence',
    'arousal', mood->>'arousal',
    'pacing', pacing,
    'is_self', profile_id = auth.uid()
  ))
  INTO v_results
  FROM checkin_responses
  WHERE checkin_id = p_checkin_id AND mood IS NOT NULL;

  RETURN COALESCE(v_results, '[]'::jsonb);
END;
$function$;
