-- profiles.role = 'lab' stops meaning anything academic.
--
-- 'lab' is RADlab RESEARCH staff -- studies, participants, exports. The academic
-- partition reused the same flag as "staff of every course", so every research
-- assistant was an admin of every class, in the UI and in RLS.
--
-- Reported by a research assistant who is also an enrolled PSY240 student and
-- noticed he had academic admin he should not have. Impersonating his lab
-- account in rolled-back transactions, it could: read all 837 profiles and all
-- 171 checkin_responses; read checkin_quiz_keys for psy240 AND psy309 (the
-- in-class answer keys, for a course he is a student in); create, update and
-- DELETE any class; and INSERT itself into class_admins -- self-promotion to
-- instructor of his own course, which succeeded before being rolled back.
--
-- New rule, per Norm 2026-09-10: academic access is a class_admins row for THAT
-- class, or is_super_admin() across the board. Nobody legitimate loses access --
-- norman@ holds both, sandyluu7@ keeps psy309, butler@ keeps class1 -- and the
-- four lab accounts with no course role lose academic admin, which is the point.
--
-- Deliberately NOT changed (Norm's call, same conversation):
--   * profiles: lab read all / Lab admins read all avatars -- research-side
--     access to participant records, which is the role's actual job.
--   * get_user_id_by_email() -- gated on 'lab' but also used by RESEARCH admin
--     (src/pages/admin/StudyDetail.jsx); narrowing it would break participant
--     lookup, and it grants nothing beyond `profiles: lab read all` above.
-- The research-side policies on studies, participants and exports are untouched.

-- == Classroom RLS: drop the 'lab' disjunct, keep super-admin and class scope ==

ALTER POLICY "checkin_quiz_keys: admins all" ON checkin_quiz_keys
  USING (is_super_admin() OR EXISTS (
    SELECT 1 FROM checkins c JOIN lectures l ON l.id = c.lecture_id
      JOIN class_admins ca ON ca.class_id = l.class_id
    WHERE c.id = checkin_quiz_keys.checkin_id AND ca.user_id = (SELECT auth.uid())))
  WITH CHECK (is_super_admin() OR EXISTS (
    SELECT 1 FROM checkins c JOIN lectures l ON l.id = c.lecture_id
      JOIN class_admins ca ON ca.class_id = l.class_id
    WHERE c.id = checkin_quiz_keys.checkin_id AND ca.user_id = (SELECT auth.uid())));

ALTER POLICY "checkin_responses: admins read all" ON checkin_responses
  USING (is_super_admin() OR EXISTS (
    SELECT 1 FROM checkins c JOIN lectures l ON l.id = c.lecture_id
      JOIN class_admins ca ON ca.class_id = l.class_id
    WHERE c.id = checkin_responses.checkin_id AND ca.user_id = (SELECT auth.uid())));

ALTER POLICY "checkins: admins all" ON checkins
  USING (is_super_admin() OR EXISTS (
    SELECT 1 FROM lectures l JOIN class_admins ca ON ca.class_id = l.class_id
    WHERE l.id = checkins.lecture_id AND ca.user_id = (SELECT auth.uid())))
  WITH CHECK (is_super_admin() OR EXISTS (
    SELECT 1 FROM lectures l JOIN class_admins ca ON ca.class_id = l.class_id
    WHERE l.id = checkins.lecture_id AND ca.user_id = (SELECT auth.uid())));

ALTER POLICY "class_questions: admins read all" ON class_questions
  USING (is_super_admin() OR EXISTS (
    SELECT 1 FROM checkins c JOIN lectures l ON l.id = c.lecture_id
      JOIN class_admins ca ON ca.class_id = l.class_id
    WHERE c.id = class_questions.checkin_id AND ca.user_id = (SELECT auth.uid())));

ALTER POLICY "class_questions: admins update" ON class_questions
  USING (is_super_admin() OR EXISTS (
    SELECT 1 FROM checkins c JOIN lectures l ON l.id = c.lecture_id
      JOIN class_admins ca ON ca.class_id = l.class_id
    WHERE c.id = class_questions.checkin_id AND ca.user_id = (SELECT auth.uid())))
  WITH CHECK (is_super_admin() OR EXISTS (
    SELECT 1 FROM checkins c JOIN lectures l ON l.id = c.lecture_id
      JOIN class_admins ca ON ca.class_id = l.class_id
    WHERE c.id = class_questions.checkin_id AND ca.user_id = (SELECT auth.uid())));

ALTER POLICY "lectures: admins all" ON lectures
  USING (is_super_admin() OR EXISTS (
    SELECT 1 FROM class_admins ca
    WHERE ca.class_id = lectures.class_id AND ca.user_id = (SELECT auth.uid())))
  WITH CHECK (is_super_admin() OR EXISTS (
    SELECT 1 FROM class_admins ca
    WHERE ca.class_id = lectures.class_id AND ca.user_id = (SELECT auth.uid())));

ALTER POLICY "weekly_quizzes: admins read all" ON weekly_quizzes
  USING (is_super_admin() OR EXISTS (
    SELECT 1 FROM class_admins ca
    WHERE ca.class_id = weekly_quizzes.class_id AND ca.user_id = (SELECT auth.uid())));

-- Students still see votes on published questions in their own class.
ALTER POLICY "question_votes: members read" ON question_votes
  USING (is_super_admin() OR EXISTS (
    SELECT 1 FROM class_questions q JOIN checkins c ON c.id = q.checkin_id
      JOIN lectures l ON l.id = c.lecture_id
      JOIN class_admins ca ON ca.class_id = l.class_id
    WHERE q.id = question_votes.question_id AND ca.user_id = (SELECT auth.uid()))
    OR EXISTS (
    SELECT 1 FROM class_questions q JOIN checkins c ON c.id = q.checkin_id
      JOIN lectures l ON l.id = c.lecture_id
      JOIN class_members cm ON cm.class_id = l.class_id
    WHERE q.id = question_votes.question_id AND q.status = 'published'
      AND cm.user_id = (SELECT auth.uid())));

-- == Creating and deleting classes is across-the-board work: super admin only ==

ALTER POLICY "classes: admins update" ON classes
  USING (is_super_admin() OR EXISTS (
    SELECT 1 FROM class_admins ca
    WHERE ca.class_id = classes.id AND ca.user_id = (SELECT auth.uid())))
  WITH CHECK (is_super_admin() OR EXISTS (
    SELECT 1 FROM class_admins ca
    WHERE ca.class_id = classes.id AND ca.user_id = (SELECT auth.uid())));

ALTER POLICY "classes: lab admins create" ON classes WITH CHECK (is_super_admin());
ALTER POLICY "classes: lab admins create" ON classes RENAME TO "classes: super admin creates";
ALTER POLICY "classes: lab admins delete" ON classes USING (is_super_admin());
ALTER POLICY "classes: lab admins delete" ON classes RENAME TO "classes: super admin deletes";

-- == Course staff are appointed by the super admin, not by each other ==

ALTER POLICY "class_admins: lab manage" ON class_admins
  USING (is_super_admin()) WITH CHECK (is_super_admin());
ALTER POLICY "class_admins: lab manage" ON class_admins RENAME TO "class_admins: super admin manages";

ALTER POLICY "class_admins: own or lab read" ON class_admins
  USING (user_id = (SELECT auth.uid()) OR is_super_admin());
ALTER POLICY "class_admins: own or lab read" ON class_admins RENAME TO "class_admins: own or super admin read";

-- == SECURITY DEFINER functions bypass RLS, so their own guards need the same ==
-- Bodies are unchanged; only the guard loses its `my_role() = 'lab'` disjunct.

CREATE OR REPLACE FUNCTION public.get_class_participation(p_class_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE
  v_allowed boolean;
  v_members jsonb;
  v_lectures jsonb;
  v_counts jsonb;
BEGIN
  SELECT
    is_super_admin()
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
$fn$;

CREATE OR REPLACE FUNCTION public.get_checkin_mood_results(p_checkin_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE
  v_allowed boolean;
  v_results jsonb;
BEGIN
  SELECT
    is_super_admin()
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
    'emotion_id', mood->>'emotion_id',
    'zone', mood->>'zone',
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
$fn$;

-- v_is_admin also decides whether the ANSWER KEY comes back before the reveal,
-- which is the sharpest edge of the old rule.
CREATE OR REPLACE FUNCTION public.get_checkin_quiz_results(p_checkin_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE
  v_is_admin boolean;
  v_is_member boolean;
  v_config jsonb;
  v_revealed boolean;
  v_items jsonb;
  v_counts jsonb;
  v_key jsonb;
BEGIN
  SELECT
    is_super_admin()
    OR EXISTS (
      SELECT 1 FROM checkins c JOIN lectures l ON l.id = c.lecture_id JOIN class_admins ca ON ca.class_id = l.class_id
      WHERE c.id = p_checkin_id AND ca.user_id = auth.uid()
    )
  INTO v_is_admin;

  SELECT EXISTS (
    SELECT 1 FROM checkins c JOIN lectures l ON l.id = c.lecture_id JOIN class_members cm ON cm.class_id = l.class_id
    WHERE c.id = p_checkin_id AND cm.user_id = auth.uid()
  ) INTO v_is_member;

  IF NOT (v_is_admin OR v_is_member) THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  SELECT config, (quiz_revealed_at IS NOT NULL) INTO v_config, v_revealed
  FROM checkins WHERE id = p_checkin_id;

  v_items := COALESCE(v_config->'quiz_items', '[]'::jsonb);

  WITH answers AS (
    SELECT kv.key AS question_id, kv.value::int AS option_idx
    FROM checkin_responses cr, jsonb_each_text(cr.quiz_answers) AS kv(key, value)
    WHERE cr.checkin_id = p_checkin_id AND cr.quiz_answers IS NOT NULL
  ),
  counted AS (
    SELECT question_id, option_idx, count(*) AS n FROM answers GROUP BY question_id, option_idx
  ),
  items AS (
    SELECT (item->>'id') AS question_id, jsonb_array_length(item->'options') AS n_opts
    FROM jsonb_array_elements(v_items) AS item
  ),
  per_item AS (
    SELECT i.question_id,
      (SELECT jsonb_agg(COALESCE(c.n, 0) ORDER BY opt_idx)
       FROM generate_series(0, i.n_opts - 1) AS opt_idx
       LEFT JOIN counted c ON c.question_id = i.question_id AND c.option_idx = opt_idx
      ) AS counts_arr
    FROM items i
  )
  SELECT jsonb_object_agg(question_id, counts_arr) INTO v_counts FROM per_item;

  IF v_revealed OR v_is_admin THEN
    SELECT answer_key INTO v_key FROM checkin_quiz_keys WHERE checkin_id = p_checkin_id;
  END IF;

  RETURN jsonb_build_object(
    'items', v_items,
    'revealed', v_revealed,
    'counts', COALESCE(v_counts, '{}'::jsonb),
    'answer_key', v_key
  );
END;
$fn$;

CREATE OR REPLACE FUNCTION public.get_weekly_quiz_report(p_class_id uuid)
RETURNS TABLE(utoronto_email text, display_name text, week_no integer, completed_at timestamp with time zone, credit numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $fn$
begin
  if not (is_super_admin() or exists (
      select 1 from class_admins ca where ca.class_id = p_class_id and ca.user_id = auth.uid())) then
    raise exception 'staff only';
  end if;
  return query
  select p.utoronto_email, p.display_name, w.week_no, c.completed_at,
         case
           when c.completed_at is null then 0
           when c.completed_at <= w.due_at + interval '7 days' then 1.0
           when c.completed_at <= weekly_quiz_effective_close(w, cm.user_id) then 0.75
           else 0
         end::numeric
  from class_members cm
  join profiles p on p.id = cm.user_id
  cross join weekly_quizzes w
  left join weekly_quiz_completions c on c.quiz_id = w.id and c.profile_id = cm.user_id
  where cm.class_id = p_class_id and w.class_id = p_class_id
  order by p.utoronto_email nulls last, w.week_no;
end $fn$;

-- Class-scoped, so a co-admin may see their co-admins; no longer lab-wide.
CREATE OR REPLACE FUNCTION public.list_class_admins(p_class_id uuid)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path TO 'auth', 'public'
AS $fn$
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', ca.id, 'user_id', ca.user_id, 'email', u.email) ORDER BY u.email), '[]'::jsonb)
  FROM public.class_admins ca
  JOIN auth.users u ON u.id = ca.user_id
  WHERE ca.class_id = p_class_id
    AND (
      public.is_super_admin()
      OR EXISTS (SELECT 1 FROM public.class_admins me WHERE me.class_id = p_class_id AND me.user_id = auth.uid())
    );
$fn$;

-- == Assertion: no classroom policy or function still consults the lab role ==

DO $assert$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n
  FROM pg_class c JOIN pg_policy p ON p.polrelid = c.oid
  JOIN pg_namespace ns ON ns.oid = c.relnamespace AND ns.nspname = 'public'
  WHERE c.relname IN ('classes','class_admins','lectures','checkins','checkin_responses',
                      'class_questions','question_votes','checkin_quiz_keys','weekly_quizzes')
    AND (coalesce(pg_get_expr(p.polqual, p.polrelid),'') ||
         coalesce(pg_get_expr(p.polwithcheck, p.polrelid),'')) ILIKE '%''lab''%';
  IF n <> 0 THEN RAISE EXCEPTION 'classroom policies still referencing the lab role: %', n; END IF;

  SELECT count(*) INTO n
  FROM pg_proc pr JOIN pg_namespace ns ON ns.oid = pr.pronamespace AND ns.nspname = 'public'
  WHERE pr.proname IN ('get_class_participation','get_checkin_mood_results',
                       'get_checkin_quiz_results','get_weekly_quiz_report','list_class_admins')
    AND pg_get_functiondef(pr.oid) ILIKE '%''lab''%';
  IF n <> 0 THEN RAISE EXCEPTION 'classroom functions still referencing the lab role: %', n; END IF;
END $assert$;
