-- radlab-academic. One staff-facing record of every deadline extension a course
-- grants (Norm, 2026-10-09: "can we create an admin facing page to keep track of
-- extensions?").
--
-- Extensions were arriving by email from three directions (AccessAbility letters,
-- Special Consideration Requests, the instructor's own judgement) and living in
-- inboxes, a roster note, and ad-hoc claim expiry edits. Nothing answered "who has
-- an extension on Contribution 1, until when, and on what basis?" at marking time.
--
-- This table is the record, not the mechanism. It does not by itself move any
-- deadline: a claim's expires_at and a class test's extra minutes are still set
-- where they live (the claim, the Test tab). Lateness on contributions is judged
-- by staff, and this is what they consult.
--
-- Access: course staff only. Rows are read and written through definer RPCs
-- (list/save/delete) that check is_course_staff; the RLS policies below give the
-- same rule to direct table access, so a table with RLS on is never left with no
-- policy (CLAUDE.md).

CREATE TABLE IF NOT EXISTS public.deadline_extensions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id   uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  roster_id   uuid NOT NULL REFERENCES identity.roster(id) ON DELETE CASCADE,
  item        text NOT NULL CHECK (item IN ('contribution_1', 'contribution_2', 'contribution_3',
                                           'weekly_quiz', 'midterm', 'final_exam', 'other')),
  item_detail text,                       -- e.g. "Quiz 4", or what 'other' is
  new_due     timestamptz,                -- null = open-ended / to be set
  basis       text NOT NULL CHECK (basis IN ('accessibility', 'scr', 'instructor', 'other')),
  status      text NOT NULL DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'declined')),
  note        text,
  created_by  uuid REFERENCES identity.people(id) DEFAULT public.current_person_id(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid REFERENCES identity.people(id),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS deadline_extensions_course_idx ON public.deadline_extensions (course_id, item);

ALTER TABLE public.deadline_extensions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "course staff" ON public.deadline_extensions;
CREATE POLICY "course staff" ON public.deadline_extensions
  FOR ALL TO authenticated
  USING (public.is_course_staff(course_id))
  WITH CHECK (public.is_course_staff(course_id));

-- Every extension in the course, with the student's roster identity and the names
-- of who recorded / last changed it.
CREATE OR REPLACE FUNCTION public.list_deadline_extensions(p_course_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT is_course_staff(p_course_id) THEN RAISE EXCEPTION 'staff only'; END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', x.id, 'roster_id', x.roster_id, 'full_name', r.full_name, 'student_number', r.student_number,
      'email', r.email, 'item', x.item, 'item_detail', x.item_detail, 'new_due', x.new_due,
      'basis', x.basis, 'status', x.status, 'note', x.note,
      'created_at', x.created_at, 'created_by_name', cb.full_name,
      'updated_at', x.updated_at, 'updated_by_name', ub.full_name
    ) ORDER BY x.item, r.full_name)
    FROM deadline_extensions x
    JOIN identity.roster r ON r.id = x.roster_id
    LEFT JOIN identity.people cb ON cb.id = x.created_by
    LEFT JOIN identity.people ub ON ub.id = x.updated_by
    WHERE x.course_id = p_course_id
  ), '[]'::jsonb);
END $$;

-- Insert (p_id null) or update one extension. Returns its id.
CREATE OR REPLACE FUNCTION public.save_deadline_extension(
  p_course_id uuid, p_id uuid, p_roster_id uuid, p_item text, p_item_detail text,
  p_new_due timestamptz, p_basis text, p_status text, p_note text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT is_course_staff(p_course_id) THEN RAISE EXCEPTION 'staff only'; END IF;
  IF NOT EXISTS (SELECT 1 FROM identity.roster WHERE id = p_roster_id AND course_id = p_course_id) THEN
    RAISE EXCEPTION 'that student is not on this course''s roster';
  END IF;
  IF p_id IS NULL THEN
    INSERT INTO deadline_extensions (course_id, roster_id, item, item_detail, new_due, basis, status, note, created_by)
    VALUES (p_course_id, p_roster_id, p_item, nullif(btrim(p_item_detail), ''), p_new_due, p_basis,
            coalesce(p_status, 'approved'), nullif(btrim(p_note), ''), current_person_id())
    RETURNING id INTO v_id;
  ELSE
    UPDATE deadline_extensions SET roster_id = p_roster_id, item = p_item,
      item_detail = nullif(btrim(p_item_detail), ''), new_due = p_new_due, basis = p_basis,
      status = coalesce(p_status, status), note = nullif(btrim(p_note), ''),
      updated_by = current_person_id(), updated_at = now()
     WHERE id = p_id AND course_id = p_course_id
    RETURNING id INTO v_id;
    IF v_id IS NULL THEN RAISE EXCEPTION 'no such extension'; END IF;
  END IF;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.delete_deadline_extension(p_course_id uuid, p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT is_course_staff(p_course_id) THEN RAISE EXCEPTION 'staff only'; END IF;
  DELETE FROM deadline_extensions WHERE id = p_id AND course_id = p_course_id;
END $$;

REVOKE EXECUTE ON FUNCTION public.list_deadline_extensions(uuid) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.save_deadline_extension(uuid, uuid, uuid, text, text, timestamptz, text, text, text) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.delete_deadline_extension(uuid, uuid) FROM public, anon;

-- Seed: the PSY240 extensions granted before this page existed (all Toronto time).
INSERT INTO public.deadline_extensions (course_id, roster_id, item, new_due, basis, status, note, created_by)
SELECT r.course_id, r.id, s.item, s.new_due::timestamptz, s.basis, s.status, s.note, NULL
  FROM (VALUES
    ('1012217940', 'contribution_1', '2026-10-14 03:59:00+00', 'accessibility', 'approved',
     'Accessibility-related extension to Oct 13, 11:59 PM; her claims were extended to match (recorded 2026-09-30).'),
    ('1012534571', 'contribution_1', '2026-10-15 03:59:00+00', 'instructor', 'approved',
     'Claim (bipolar II, Canadian diagnostic delay) had expired Sep 30; reopened to Oct 14, 11:59 PM (2026-10-03).'),
    ('1009064879', 'contribution_1', '2026-10-16 03:59:00+00', 'instructor', 'approved',
     'Claim (kleptomania epidemiology) expired while she was writing; reopened to Oct 15, 11:59 PM and the gap raised to 3 slots (2026-10-08).'),
    ('1004470663', 'contribution_1', '2026-10-09 03:59:00+00', 'scr', 'pending',
     'SCR for a one-day extension (disability-related), approval pending. Submitted Oct 8, 7:50 PM, inside the extended day. DOI corrected by staff 2026-10-09.')
  ) AS s(student_number, item, new_due, basis, status, note)
  JOIN identity.roster r ON r.student_number = s.student_number
  JOIN public.courses c ON c.id = r.course_id AND lower(c.code) = 'psy240'
 WHERE NOT EXISTS (SELECT 1 FROM public.deadline_extensions x WHERE x.roster_id = r.id AND x.item = s.item);
