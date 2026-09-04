-- The gap detector truncated asks at a wrapped line.
--
-- Annotations are written as blockquotes, and markdown allows a "lazy
-- continuation" — a wrapped second line with no '>' prefix still belongs to the
-- quote:
--
--   > **Needs research:** interrater reliability data for the MSE, no
--   standard published format or scoring, and no guidance on how findings
--   should be weighted against structured instruments.
--
-- The old pattern, ((?:[^\n\r]|\n>)+), crossed a newline ONLY when the next
-- line began with '>'. So the ask stopped dead at the wrap:
--   "…the source gives no interrater reliability or validity data for the MSE, no"
--
-- That text is IDENTITY — gaps are keyed on (page_id, md5(lower(ask))) — so a
-- truncated ask is a permanently mis-keyed gap, and the same cut recurs on
-- every new page whose annotation happens to wrap. Five were found by the
-- 2026-09-03 rewrite pass; the count on future pages would only grow.
--
-- The fix stops matching line shapes altogether: split the page into
-- blank-line separated blocks, take the block holding the marker, and read to
-- the end of it. Continuation lines are folded in whether or not they carry
-- '>'. Verified against mental-status-examination, which recovers its full
-- sentence.
--
-- NOT RE-RUN. Because the ask is identity, running populate_page_gaps() would
-- insert NEW gaps for the previously truncated ones and leave the old rows to
-- be retired — churning the board days before term, and the new rows would
-- arrive without the rewritten ask_display text students actually read. The
-- student-facing wording was already repaired by hand, so there is nothing
-- urgent to gain; the right moment is between terms.

create or replace function populate_page_gaps(p_course_id uuid)
returns table (inserted bigint, refreshed bigint)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_ins bigint := 0;
  v_ref bigint := 0;
begin
  with blocks as (
    -- Blank-line separated blocks. An annotation never spans one.
    select p.id as page_id, p.course_id, p.slug,
           regexp_split_to_table(p.content, E'\n[ \t]*\n') as blk
    from wiki_pages p
    where p.course_id = p_course_id and p.content is not null
  ),
  raw as (
    select page_id, course_id, slug,
           btrim(regexp_replace(
             regexp_replace(
               substring(blk from position('**Needs research:**' in blk) + 19),
               E'\n[ \t]*>?[ \t]*', ' ', 'g'),
             '\s+', ' ', 'g')) as body
    from blocks
    where position('**Needs research:**' in blk) > 0
  ),
  asks as (
    select page_id, course_id, slug,
           btrim(regexp_replace(unnest(string_to_array(body, ';')), '\s+', ' ', 'g')) as ask
    from raw
  ),
  cleaned as (
    select page_id, course_id, slug, ask
    from asks
    where length(ask) > 25          -- drop fragments that are not asks
  ),
  ins as (
    insert into page_gaps (course_id, page_id, slug, kind, ask, ask_hash, tier, difficulty)
    select c.course_id, c.page_id, c.slug, 'annotation', c.ask, md5(lower(c.ask)),
           d.tier,
           case
             when c.ask ~* '(dos(e|ing)|taper|titrat|consent|contraindicat|antidote|overdose|crisis|helpline|mandated report|civil commitment|sentencing|fitness to stand|withdrawal manage)'
               then 'red'
             when c.ask ~* '(prevalence|incidence|rates|Canadian|Ontario|provincial|newest source|epidemiolog|how many)'
               then 'green'
             else 'amber'
           end
    from cleaned c
    left join disorders d on d.slug = c.slug
    on conflict (page_id, ask_hash) do update set last_seen_at = now()
    returning (xmax = 0) as was_insert
  )
  select count(*) filter (where was_insert), count(*) filter (where not was_insert)
    into v_ins, v_ref from ins;

  -- empty sections, one gap each
  insert into page_gaps (course_id, page_id, slug, kind, section, ask, ask_hash, tier, difficulty)
  select p.course_id, p.id, p.slug, 'empty_section', k.key,
         'Write the ' || k.key || ' section of ' || p.slug || ' — it currently has a heading and no prose.',
         md5('empty_section:' || k.key),
         d.tier, 'amber'
  from wiki_pages p
  cross join lateral jsonb_each(extract_page_sections(p.content)) k
  left join disorders d on d.slug = p.slug
  where p.course_id = p_course_id
    and p.content is not null
    and not (k.value->>'prose')::boolean
  on conflict (page_id, ask_hash) do update set last_seen_at = now();

  return query select v_ins, v_ref;
end;
$fn$;
