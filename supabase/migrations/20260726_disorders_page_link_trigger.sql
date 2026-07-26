-- 20260726_disorders_page_link_trigger.sql
-- TARGET: radlab-academic.
--
-- disorders.page_id was populated by a one-off UPDATE in the WP3 seed
-- migration and never maintained. After the next two ingests it was already
-- wrong: 2 rows linked, 5 catalogue entries whose page now exists but whose
-- column still read null.
--
-- Harmless so far — every view joins catalogue to page on (course_id, slug),
-- not through this column, so wiki_gap_report and reference_worklist stayed
-- correct. But a denormalised pointer that only drifts is a trap for whoever
-- reads it next and assumes it means something.
--
-- Kept rather than dropped because it is a real FK a later UI can follow
-- without a slug round-trip; it just has to be maintained. Backfill + trigger
-- in both directions (a page appearing, and a catalogue row being seeded).

update public.disorders d
set page_id = p.id
from public.wiki_pages p
where p.course_id = d.course_id and p.slug = d.slug
  and d.page_id is distinct from p.id;

create or replace function public.link_disorder_page()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_table_name = 'wiki_pages' then
    update public.disorders d
    set page_id = new.id
    where d.course_id = new.course_id and d.slug = new.slug
      and d.page_id is distinct from new.id;
  else
    select p.id into new.page_id
    from public.wiki_pages p
    where p.course_id = new.course_id and p.slug = new.slug;
  end if;
  return new;
end;
$$;

create trigger wiki_pages_link_disorder_trg
  after insert or update of slug on public.wiki_pages
  for each row execute function public.link_disorder_page();

create trigger disorders_link_page_trg
  before insert or update of slug on public.disorders
  for each row execute function public.link_disorder_page();
