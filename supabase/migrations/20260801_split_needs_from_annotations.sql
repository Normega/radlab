-- radlab-academic (qldgwpneygvgcvexlduz)
-- `needs` was conflating an empty section with a finished one that carries a caveat.
--
-- `extract_page_needs` scored a section as a gap on `marker OR not prose` — so a
-- section holding nothing but `> **Needs research:** …` and a section holding
-- 3,900 characters of prose *plus* one line noting a specific sub-gap came out
-- identical. They are not the same thing, and treating them alike inverts the
-- signal that drives `reference_worklist`.
--
-- Found 2026-08-01 on the four Lecture 8 reference runs. Of eleven flagged
-- sections across those pages, **exactly one was truly empty**
-- (`stimulant-use-disorder` → Contested). The other ten ran 1,764–3,980 chars
-- with 4–15 prose lines each. The result: `alcohol-use-disorder`, at 16,921
-- characters the most complete disorder page in the wiki, landed declaring four
-- gaps and went straight to the top of the worklist — the tool offering the most
-- finished page as the most-needing-work.
--
-- Corpus-wide at the time of writing: **89 truly-empty sections across 52 pages,
-- 27 annotated sections across 17 pages** — so roughly a quarter of everything
-- `needs` flagged was not a hole.
--
-- The distinction is load-bearing beyond tidiness, because the two map onto the
-- two priority lists in run plan §8.6 far better than the gap-*name* split that
-- section currently uses:
--
--   * an **empty** section is missing template — instructor work, core text;
--   * an **annotated** section is a scoped, specific ask ("this section says the
--     cross-cultural data is missing") — the best shape of student contribution
--     task in the corpus, and much better than "write Contested from scratch".
--
-- One parser, two views of it, so the definitions cannot drift apart.

-- ── 1. The shared parser ──
-- Returns {section-slug: {"prose": bool, "marker": bool}} for every H2.
-- Heading normalisation is byte-identical to the previous `extract_page_needs`
-- so existing values stay comparable.
CREATE OR REPLACE FUNCTION public.extract_page_sections(md text)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $function$
declare
  body     text;
  ln       text;
  cur      text := null;
  prose    boolean := false;
  marker   boolean := false;
  in_fence boolean := false;
  out      jsonb := '{}'::jsonb;
  h        text;
begin
  if md is null or md = '' then return '{}'::jsonb; end if;

  body := regexp_replace(md, '^\s*---\r?\n.*?\r?\n---\r?\n?', '');

  foreach ln in array string_to_array(replace(body, chr(13), ''), chr(10))
  loop
    if ln ~ '^\s*(```|~~~)' then
      in_fence := not in_fence;
      continue;
    end if;
    if in_fence then continue; end if;

    if ln ~ '^##[ \t]+\S' then
      if cur is not null then
        out := jsonb_set(out, array[cur], jsonb_build_object(
          'prose',  coalesce((out#>>array[cur,'prose'])::boolean,  false) or prose,
          'marker', coalesce((out#>>array[cur,'marker'])::boolean, false) or marker));
      end if;
      h   := btrim(regexp_replace(ln, '^##[ \t]+', ''));
      h   := lower(regexp_replace(h, '[*_`#]', '', 'g'));
      h   := regexp_replace(h, '[^a-z0-9 -]', '', 'g');
      h   := regexp_replace(btrim(h), '\s+', '-', 'g');
      cur := btrim(regexp_replace(h, '-+', '-', 'g'), '-');
      prose := false;
      marker := false;
      continue;
    end if;
    if ln ~ '^#{1,6}[ \t]+\S' then continue; end if;

    if cur is null then continue; end if;
    if btrim(ln) = '' then continue; end if;
    if ln ~ '^\s*>\s*\*\*Needs research' then
      marker := true;
      continue;
    end if;
    if ln ~ '^\s*>' then continue; end if;
    prose := true;
  end loop;

  if cur is not null then
    out := jsonb_set(out, array[cur], jsonb_build_object(
      'prose',  coalesce((out#>>array[cur,'prose'])::boolean,  false) or prose,
      'marker', coalesce((out#>>array[cur,'marker'])::boolean, false) or marker));
  end if;

  return out;
end;
$function$;

-- ── 2. `needs` — sections with NO prose at all. The real holes. ──
CREATE OR REPLACE FUNCTION public.extract_page_needs(md text)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $function$
  SELECT coalesce(array_agg(key ORDER BY key), '{}'::text[])
  FROM jsonb_each(public.extract_page_sections(md))
  WHERE (value->>'prose')::boolean IS NOT TRUE;
$function$;

-- ── 3. `annotations` — sections that HAVE prose and still flag a sub-gap. ──
CREATE OR REPLACE FUNCTION public.extract_page_annotations(md text)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $function$
  SELECT coalesce(array_agg(key ORDER BY key), '{}'::text[])
  FROM jsonb_each(public.extract_page_sections(md))
  WHERE (value->>'prose')::boolean IS TRUE
    AND (value->>'marker')::boolean IS TRUE;
$function$;

COMMENT ON FUNCTION public.extract_page_needs(text) IS
  'Sections that are empty placeholders — no prose at all. Instructor work: the template is missing. Was previously "marker OR no prose", which also caught finished sections carrying a caveat; see extract_page_annotations.';
COMMENT ON FUNCTION public.extract_page_annotations(text) IS
  'Sections that have real content AND still carry a "Needs research" line naming a specific sub-gap. Not holes — scoped follow-up work, and the best shape of student contribution task in the corpus.';

-- ── 4. Surface annotations alongside gaps ──
-- security_invoker is preserved deliberately: without it these views bypass the
-- roster gate (fixed 2026-07-26, see website.md §29a).
CREATE OR REPLACE VIEW public.wiki_gap_report
WITH (security_invoker = true) AS
SELECT d.course_id,
       d.slug,
       d.title,
       d.tier,
       d.lecture,
       d.dsm_chapter,
       CASE
         WHEN p.id IS NULL THEN 'no page yet'
         WHEN p.content IS NULL THEN 'shell only — nothing reviewed'
         WHEN cardinality(p.needs) = 0 THEN 'complete'
         ELSE 'gaps'
       END AS state,
       COALESCE(p.needs, '{}'::text[]) AS needs,
       p.status AS page_status,
       COALESCE(public.extract_page_annotations(p.content), '{}'::text[]) AS annotations
FROM disorders d
LEFT JOIN wiki_pages p
  ON p.course_id = d.course_id AND p.slug = d.slug;

CREATE OR REPLACE VIEW public.reference_worklist
WITH (security_invoker = true) AS
SELECT g.course_id,
       g.slug,
       g.title,
       g.tier,
       g.lecture,
       g.dsm_chapter,
       COALESCE(c.title, 'Foundations & course-wide') AS chapter_title,
       COALESCE(g.dsm_chapter, 99) AS chapter_sort,
       g.state,
       g.needs,
       cardinality(g.needs) AS gap_count,
       (SELECT count(*)
          FROM ingest_jobs j
         WHERE j.course_id = g.course_id
           AND j.source_type = 'reference'
           AND j.target_slug = g.slug
           AND j.status = 'done') AS reference_runs,
       -- New columns go at the END: CREATE OR REPLACE VIEW cannot reorder or
       -- rename existing ones, and `reference_runs` was previously last.
       g.annotations,
       cardinality(g.annotations) AS annotation_count
FROM wiki_gap_report g
LEFT JOIN dsm_chapters c ON c.number = g.dsm_chapter
WHERE g.state <> 'complete'
ORDER BY COALESCE(g.dsm_chapter, 99),
         CASE g.tier
           WHEN 'overview' THEN 0
           WHEN 'A' THEN 1
           WHEN 'foundation' THEN 2
           ELSE 3
         END,
         g.slug;

-- ── 5. Backfill ──
-- Only rows whose value actually changes, so `updated_at` is not churned across
-- the whole corpus. Safe against the trigger stack on wiki_pages:
-- `wiki_pages_snapshot` returns early when content/title/summary are unchanged,
-- so this mints no spurious versions, and `sync_wiki_links` is idempotent.
UPDATE public.wiki_pages
SET needs = public.extract_page_needs(content)
WHERE content IS NOT NULL
  AND needs IS DISTINCT FROM public.extract_page_needs(content);
