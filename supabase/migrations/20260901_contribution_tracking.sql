-- Contribution tracking (2026-09-01) — radlab-academic project.
--
-- One staff-gated RPC feeding /academic/:courseCode/tracking: every roster
-- row with its contribution pipeline counts. The counts mirror the real
-- lifecycle (claimed → submitted → accepted, send-back = back to claimed
-- with a staff note), so:
--   open_claims  = claimed, no note   (working, nothing submitted yet)
--   pending      = submitted          (waiting on staff review — "to be processed")
--   sent_back    = claimed, note set  (currently returned for revision)
--   approved     = accepted
-- sent_back is CURRENT state, not a lifetime counter — the schema keeps no
-- event history, so "how many times was this sent back" is unknowable today.
--
-- Lounge participation deliberately does NOT live here: it belongs to the
-- main project and the page fetches it separately via get_class_participation,
-- joining on utoronto email client-side. Two projects, two auth systems, one
-- table on screen.

CREATE OR REPLACE FUNCTION public.contribution_tracking(p_course_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, identity
AS $$
BEGIN
  IF NOT is_course_staff(p_course_id) THEN
    RAISE EXCEPTION 'staff only';
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'roster_id',   r.id,
      'full_name',   r.full_name,
      'email',       r.email,
      'status',      r.status,
      'person_id',   r.person_id,
      'open_claims', COALESCE(c.open_claims, 0),
      'pending',     COALESCE(c.pending, 0),
      'sent_back',   COALESCE(c.sent_back, 0),
      'approved',    COALESCE(c.approved, 0)
    ) ORDER BY r.full_name, r.email)
    FROM identity.roster r
    LEFT JOIN (
      SELECT gc.person_id,
        count(*) FILTER (WHERE gc.status = 'claimed'  AND gc.note IS NULL)     AS open_claims,
        count(*) FILTER (WHERE gc.status = 'submitted')                        AS pending,
        count(*) FILTER (WHERE gc.status = 'claimed'  AND gc.note IS NOT NULL) AS sent_back,
        count(*) FILTER (WHERE gc.status = 'accepted')                         AS approved
      FROM gap_claims gc
      GROUP BY gc.person_id
    ) c ON c.person_id = r.person_id
    WHERE r.course_id = p_course_id
  ), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.contribution_tracking(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contribution_tracking(uuid) TO authenticated;
