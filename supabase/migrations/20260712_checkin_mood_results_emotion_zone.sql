-- ResultsView positioned dots by literal valence/arousal, but WheelSVG draws
-- each emotion's wedge at a fixed angular slot (8 equal 45deg segments) that
-- does NOT correspond to that emotion's actual (valence, arousal) — e.g.
-- Alert's wedge points straight up on the wheel, but its stored valence/
-- arousal would plot up-and-to-the-left. Dots need emotion_id + zone (which
-- wedge/ring was actually tapped) so the frontend can position them using
-- the exact same angle+zone geometry WheelSVG uses to draw the background,
-- instead of a value that visually disagrees with it. A neutral tap is
-- identified by emotion_id being null — CheckinRunner never actually stores
-- a separate "neutral" flag on the mood JSON, so there's no field for it here.
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
$function$;
