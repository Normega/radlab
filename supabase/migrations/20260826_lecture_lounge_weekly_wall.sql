-- Question of the Week wall (2026-08-26)
--
-- A check-in gains a kind: 'live' (default — the in-class flow, unchanged) or
-- 'weekly' — an asynchronous prompt that stays open between lectures. Weekly
-- check-ins are EXCLUDED from the live surfaces (ClassRoom/ClassScreen state
-- restore, ClassRemote queue) and instead surface as a lobby card linking to
-- /class/:slug/wall/:checkinId — a wall of anonymous, avatar-embodied
-- responses.
--
-- Wall read model (decided with Norm 2026-08-26):
--   * answer-first: while the check-in is OPEN, a student sees the wall only
--     after their own response is in (prevents anchoring). After close, the
--     wall is readable by all class members (archive).
--   * no reactions, chronological order.
--   * moderation: post-first with staff removal (wall_removed_at) — responses
--     stay profile-linked in the DB (existing Lounge posture: anonymous in
--     every UI, attributable in the database).
--
-- Students still never gain SELECT on checkin_responses: the wall reads
-- through get_weekly_wall() (SECURITY DEFINER), which strips profile ids
-- server-side and enforces the gate above. Base-table RLS is unchanged.

ALTER TABLE checkins
  ADD COLUMN kind text NOT NULL DEFAULT 'live'
  CHECK (kind IN ('live', 'weekly'));

ALTER TABLE checkin_responses
  ADD COLUMN wall_removed_at timestamptz;

-- ── get_weekly_wall ─────────────────────────────────────────────────────
-- Returns jsonb:
-- { status, prompt_text, is_admin, can_view, count, my_response,
--   responses: [{ id, text, created_at, mine, removed, avatar: {…} }] | null }
-- `responses` is null (not []) when the caller may not view yet.
-- Admins additionally see removed responses (flagged) for moderation.
CREATE OR REPLACE FUNCTION public.get_weekly_wall(p_checkin_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_class_id    uuid;
  v_status      text;
  v_kind        text;
  v_prompt      text;
  v_is_admin    boolean;
  v_is_member   boolean;
  v_mine        text;
  v_can_view    boolean;
  v_count       integer;
  v_responses   jsonb;
BEGIN
  SELECT l.class_id, c.status, c.kind, c.config->>'prompt_text'
    INTO v_class_id, v_status, v_kind, v_prompt
  FROM checkins c JOIN lectures l ON l.id = c.lecture_id
  WHERE c.id = p_checkin_id;

  IF v_class_id IS NULL OR v_kind <> 'weekly' OR v_status = 'planned' THEN
    RAISE EXCEPTION 'wall not available';
  END IF;

  v_is_admin := EXISTS (
    SELECT 1 FROM class_admins ca
    WHERE ca.class_id = v_class_id AND ca.user_id = auth.uid());
  v_is_member := EXISTS (
    SELECT 1 FROM class_members cm
    WHERE cm.class_id = v_class_id AND cm.user_id = auth.uid());

  IF NOT (v_is_admin OR v_is_member) THEN
    RAISE EXCEPTION 'not a member of this class';
  END IF;

  SELECT r.prompt_response INTO v_mine
  FROM checkin_responses r
  WHERE r.checkin_id = p_checkin_id AND r.profile_id = auth.uid();

  -- answer-first while open; archive-open after close
  v_can_view := v_is_admin
    OR v_status <> 'open'
    OR (v_mine IS NOT NULL AND btrim(v_mine) <> '');

  SELECT count(*) INTO v_count
  FROM checkin_responses r
  WHERE r.checkin_id = p_checkin_id
    AND r.prompt_response IS NOT NULL AND btrim(r.prompt_response) <> ''
    AND r.wall_removed_at IS NULL;

  IF v_can_view THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id', sub.id,
        'text', sub.prompt_response,
        'created_at', sub.created_at,
        'mine', sub.profile_id = auth.uid(),
        'removed', sub.wall_removed_at IS NOT NULL,
        'avatar', coalesce(sub.avatar, '{}'::jsonb)
      ) ORDER BY sub.created_at ASC), '[]'::jsonb)
    INTO v_responses
    FROM (
      -- avatar fields listed explicitly: to_jsonb(a.*) would carry the
      -- avatars row's stable id, which would let readers correlate one
      -- person's responses across weeks — the exact thing anonymity forbids.
      SELECT r.id, r.prompt_response, r.created_at, r.profile_id, r.wall_removed_at,
             CASE WHEN a.user_id IS NULL THEN NULL ELSE jsonb_build_object(
               'skin_color', a.skin_color, 'eye_color', a.eye_color,
               'species', a.species, 'aura', a.aura,
               'hair_style', a.hair_style, 'hair_color', a.hair_color
             ) END AS avatar
      FROM checkin_responses r
      LEFT JOIN avatars a ON a.user_id = r.profile_id
      WHERE r.checkin_id = p_checkin_id
        AND r.prompt_response IS NOT NULL AND btrim(r.prompt_response) <> ''
        AND (r.wall_removed_at IS NULL OR v_is_admin)
    ) sub;
  ELSE
    v_responses := NULL;
  END IF;

  RETURN jsonb_build_object(
    'status', v_status,
    'prompt_text', v_prompt,
    'is_admin', v_is_admin,
    'can_view', v_can_view,
    'count', v_count,
    'my_response', v_mine,
    'responses', v_responses
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_weekly_wall(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_weekly_wall(uuid) TO authenticated;

-- ── remove_wall_response ────────────────────────────────────────────────
-- Staff moderation: hide a response from the wall (or restore it). Class
-- admins only; the row itself is never deleted (participation credit and
-- accountability both want it kept).
CREATE OR REPLACE FUNCTION public.remove_wall_response(p_response_id uuid, p_restore boolean DEFAULT false)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM checkin_responses r
    JOIN checkins c ON c.id = r.checkin_id
    JOIN lectures l ON l.id = c.lecture_id
    JOIN class_admins ca ON ca.class_id = l.class_id
    WHERE r.id = p_response_id AND ca.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'not an admin of this class';
  END IF;

  UPDATE checkin_responses
  SET wall_removed_at = CASE WHEN p_restore THEN NULL ELSE now() END
  WHERE id = p_response_id;
END;
$$;

REVOKE ALL ON FUNCTION public.remove_wall_response(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_wall_response(uuid, boolean) TO authenticated;
