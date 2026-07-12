-- Phase 2: participation matrix + CSV export, per website.md §29's original
-- design ("matrix of members x lectures, cell = check-ins responded that
-- day"; "CSV export: rows keyed to utoronto_email... unverified emails
-- flagged"). Lives on the per-class console, not the lab-wide admin page —
-- this is that instructor's own class roster.
--
-- profiles has no RLS policy letting a class admin read another student's
-- utoronto_email/utoronto_verified_at — only "own row" and "lab role read
-- all" exist. A class admin (who may not be lab staff at all) needs those
-- two fields for their own roster, but granting a broader profiles policy
-- would also expose unrelated data (game stats, avatar config, role). Same
-- pattern as list_class_admins/get_checkin_mood_results: a narrow
-- SECURITY DEFINER RPC that returns only what's needed, gated to
-- lab/super_admin/that class's admins.
CREATE OR REPLACE FUNCTION public.get_class_participation(p_class_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_allowed boolean;
  v_members jsonb;
  v_lectures jsonb;
  v_counts jsonb;
BEGIN
  SELECT
    my_role() = 'lab' OR is_super_admin()
    OR EXISTS (SELECT 1 FROM class_admins WHERE class_id = p_class_id AND user_id = auth.uid())
  INTO v_allowed;

  IF NOT v_allowed THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'user_id', cm.user_id,
    'utoronto_email', p.utoronto_email,
    'utoronto_verified_at', p.utoronto_verified_at
  ) ORDER BY COALESCE(p.utoronto_email, '~')), '[]'::jsonb)
  INTO v_members
  FROM class_members cm JOIN profiles p ON p.id = cm.user_id
  WHERE cm.class_id = p_class_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', l.id, 'number', l.number, 'title', l.title, 'lecture_date', l.lecture_date
  ) ORDER BY l.number NULLS LAST, l.lecture_date), '[]'::jsonb)
  INTO v_lectures
  FROM lectures l
  WHERE l.class_id = p_class_id;

  -- "count of check-ins responded to per lecture day" — checkin_responses
  -- grouped through checkins -> lectures, not one row per lecture.
  SELECT COALESCE(jsonb_agg(jsonb_build_object('user_id', x.profile_id, 'lecture_id', x.lecture_id, 'count', x.cnt)), '[]'::jsonb)
  INTO v_counts
  FROM (
    SELECT cr.profile_id, l.id AS lecture_id, count(*) AS cnt
    FROM checkin_responses cr
    JOIN checkins c ON c.id = cr.checkin_id
    JOIN lectures l ON l.id = c.lecture_id
    WHERE l.class_id = p_class_id
    GROUP BY cr.profile_id, l.id
  ) x;

  RETURN jsonb_build_object('members', v_members, 'lectures', v_lectures, 'counts', v_counts);
END;
$function$;
