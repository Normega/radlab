-- Staff badge on the Question of the Week wall (Norm: "a little TA badge on
-- the wall, so the students can see the TAs are also engaged").
--
-- Each response gains a server-derived `staff` field: 'instructor' when the
-- author is the class's creator, 'ta' when they are any other class_admin,
-- null otherwise. Derived at read time from class_admins — nothing is stored
-- on the response, so promoting or removing a TA relabels their old posts
-- correctly, and a student cannot claim the badge.
--
-- Anonymity note: this is a deliberate, narrow carve-out from the wall's
-- no-identity rule — it reveals only "a staff member wrote this", never
-- which one, and staff opt in by holding the role. Student posts are
-- untouched: still avatar-only, still uncorrelatable across weeks.
create or replace function public.get_weekly_wall(p_checkin_id uuid)
returns jsonb
language plpgsql security definer
set search_path to 'public'
as $function$
DECLARE
  v_class_id    uuid;
  v_owner       uuid;
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
  SELECT l.class_id, cl.created_by, c.status, c.kind, c.config->>'prompt_text'
    INTO v_class_id, v_owner, v_status, v_kind, v_prompt
  FROM checkins c
  JOIN lectures l ON l.id = c.lecture_id
  JOIN classes cl ON cl.id = l.class_id
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
        'staff', sub.staff,
        'avatar', coalesce(sub.avatar, '{}'::jsonb)
      ) ORDER BY sub.created_at ASC), '[]'::jsonb)
    INTO v_responses
    FROM (
      -- avatar fields listed explicitly: to_jsonb(a.*) would carry the
      -- avatars row's stable id, which would let readers correlate one
      -- person's responses across weeks - the exact thing anonymity forbids.
      SELECT r.id, r.prompt_response, r.created_at, r.profile_id, r.wall_removed_at,
             CASE WHEN r.profile_id = v_owner THEN 'instructor'
                  WHEN sca.user_id IS NOT NULL THEN 'ta'
             END AS staff,
             CASE WHEN a.user_id IS NULL THEN NULL ELSE jsonb_build_object(
               'skin_color', a.skin_color, 'eye_color', a.eye_color,
               'species', a.species, 'aura', a.aura,
               'hair_style', a.hair_style, 'hair_color', a.hair_color
             ) END AS avatar
      FROM checkin_responses r
      LEFT JOIN avatars a ON a.user_id = r.profile_id
      LEFT JOIN class_admins sca
        ON sca.class_id = v_class_id AND sca.user_id = r.profile_id
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
$function$;
