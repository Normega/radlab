-- radlab-academic. A student's own reading history in the Field Guide
-- (Norm, 2026-09-22).
--
-- Feeds two student-facing views: the neighbourhood graph on every wiki page
-- (which of this page's neighbours have I opened?) and "My reading" on the
-- chapter map (which of this lecture's chapters have I opened least?).
--
-- PRIVATE TO THE STUDENT — a decision, not an omission. Staff get no policy,
-- no aggregate RPC, no tracking-page column. A reading log an instructor can
-- see turns browsing into something performed for the grade, which is the
-- opposite of what a study aid is for. If staff aggregates are ever wanted,
-- that is a new decision and a new notice to students, not a policy tweak.
--
-- One row per (person, page): a counter, not an event log. Nothing here is
-- research data (CLAUDE.md rule 5 governs participant response tables, and
-- this is not one), and a counter holds exactly what the two views need
-- without accumulating a timestamped trail of every page load.
--
-- Writes go only through record_page_visit(), which is where the reload
-- debounce and the membership check live. Students may read and delete their
-- own rows directly; there is no INSERT/UPDATE policy on purpose — no client
-- path writes the table, so this is not the silently-blocked shape the
-- platform's RLS rule warns about.

CREATE TABLE IF NOT EXISTS public.page_visits (
  person_id  uuid NOT NULL REFERENCES identity.people(id) ON DELETE CASCADE,
  page_id    uuid NOT NULL REFERENCES public.wiki_pages(id) ON DELETE CASCADE,
  course_id  uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  visits     int  NOT NULL DEFAULT 1 CHECK (visits > 0),
  first_at   timestamptz NOT NULL DEFAULT now(),
  -- The last COUNTED visit, not the last page load: the debounce compares
  -- against it, so a page left open and reloaded every ten minutes counts once.
  last_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (person_id, page_id)
);

CREATE INDEX IF NOT EXISTS page_visits_person_course
  ON public.page_visits (person_id, course_id);

ALTER TABLE public.page_visits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own rows read" ON public.page_visits;
CREATE POLICY "own rows read"
  ON public.page_visits FOR SELECT TO authenticated
  USING (person_id = public.current_person_id());

-- "Clear my reading history" on the chapter map.
DROP POLICY IF EXISTS "own rows delete" ON public.page_visits;
CREATE POLICY "own rows delete"
  ON public.page_visits FOR DELETE TO authenticated
  USING (person_id = public.current_person_id());

REVOKE ALL ON public.page_visits FROM anon;
-- Supabase's default privileges hand authenticated everything on a new public
-- table; RLS would refuse the writes anyway, but the grant should say the same.
REVOKE INSERT, UPDATE, TRUNCATE, REFERENCES, TRIGGER ON public.page_visits FROM authenticated;
GRANT SELECT, DELETE ON public.page_visits TO authenticated;

COMMENT ON TABLE public.page_visits IS
  'Per-student Field Guide reading counts. Private to the student by design: no staff policy or aggregate. Written only by record_page_visit().';

-- Count one visit. Returns the caller's visit count for the page (0 when
-- nothing was recorded: signed out, not a member, or a page they cannot see).
-- A load within 30 minutes of the last counted one refreshes nothing — a
-- reload, a back-button, or a tab restore is not a second reading.
CREATE OR REPLACE FUNCTION public.record_page_visit(p_page_id uuid)
RETURNS int
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
declare
  v_person uuid := current_person_id();
  v_course uuid;
  v_visits int;
begin
  if v_person is null then return 0; end if;

  -- Members only, and only pages they could have read: a published page, or
  -- any page for staff (who read drafts in review).
  select p.course_id into v_course
    from wiki_pages p
   where p.id = p_page_id
     and (p.status = 'published' or is_course_staff(p.course_id));
  if v_course is null or not is_course_member(v_course) then return 0; end if;

  insert into page_visits as v (person_id, page_id, course_id)
  values (v_person, p_page_id, v_course)
  on conflict (person_id, page_id) do update
     set visits  = v.visits + 1,
         last_at = now()
   where v.last_at < now() - interval '30 minutes'
  returning v.visits into v_visits;

  if v_visits is null then
    select visits into v_visits from page_visits
     where person_id = v_person and page_id = p_page_id;
  end if;
  return coalesce(v_visits, 0);
end $$;

REVOKE ALL ON FUNCTION public.record_page_visit(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.record_page_visit(uuid) TO authenticated;
