-- Quiz activity type (Phase 2, last of the five items). Norm chose a staged
-- reveal (Peer-Instruction style: distribution shown first, instructor taps
-- to reveal the correct answer as a separate step), so the correct-answer
-- key can never be shipped to a student client before that tap — it can't
-- live in checkins.config (which students already read directly today for
-- mood/pacing/prompt/question_box) or in any row students can SELECT at
-- all. It gets its own table with admin-only RLS, exposed to students only
-- through a SECURITY DEFINER RPC gated on checkins.quiz_revealed_at.

ALTER TABLE checkin_responses ADD COLUMN quiz_answers jsonb;
ALTER TABLE checkins ADD COLUMN quiz_revealed_at timestamptz;

CREATE TABLE checkin_quiz_keys (
  checkin_id uuid PRIMARY KEY REFERENCES checkins(id) ON DELETE CASCADE,
  answer_key jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE checkin_quiz_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "checkin_quiz_keys: admins all"
  ON checkin_quiz_keys FOR ALL
  TO authenticated
  USING (
    my_role() = 'lab' OR is_super_admin()
    OR EXISTS (
      SELECT 1 FROM checkins c JOIN lectures l ON l.id = c.lecture_id JOIN class_admins ca ON ca.class_id = l.class_id
      WHERE c.id = checkin_quiz_keys.checkin_id AND ca.user_id = auth.uid()
    )
  )
  WITH CHECK (
    my_role() = 'lab' OR is_super_admin()
    OR EXISTS (
      SELECT 1 FROM checkins c JOIN lectures l ON l.id = c.lecture_id JOIN class_admins ca ON ca.class_id = l.class_id
      WHERE c.id = checkin_quiz_keys.checkin_id AND ca.user_id = auth.uid()
    )
  );
-- No student-facing policy at all — deliberately zero direct read access.
-- The RPC below is the only path, and only once revealed.

-- Returns { items, revealed, counts, answer_key } for a checkin's quiz.
-- items/counts are always safe to return (no correct-answer info); counts
-- are aggregated server-side from raw per-student checkin_responses so no
-- individual student's answers are ever shipped to another student (unlike
-- the existing mood/pacing RPC, which does return raw per-row data — quiz
-- correctness is more sensitive than a mood tap, so this one aggregates).
-- answer_key is only populated once revealed, or always for admins (so the
-- console/remote can show it while composing/monitoring).
CREATE OR REPLACE FUNCTION public.get_checkin_quiz_results(p_checkin_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    my_role() = 'lab' OR is_super_admin()
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
$function$;

-- checkins isn't yet on the realtime publication (state changes go through
-- the lounge:{class_id} broadcast channel, not postgres_changes) — needed
-- here so ResultsView can pick up quiz_revealed_at flipping live without a
-- new broadcast event or extra prop plumbing down to a component that
-- doesn't otherwise know the class id.
ALTER PUBLICATION supabase_realtime ADD TABLE checkins;
