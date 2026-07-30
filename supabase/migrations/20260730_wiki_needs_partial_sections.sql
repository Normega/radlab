-- 20260730_wiki_needs_partial_sections.sql
-- TARGET: radlab-academic.
--
-- Refines the body-derived gap rule shipped earlier today in
-- 20260730_wiki_body_needs_and_replace.sql. That version defined a gap as "no
-- copy of this section holds prose", which silently lost the *partially* filled
-- case: a section with real content that still carries an explicit
-- `> **Needs research:** ...` marker was reported as complete.
--
-- Found while merging persistent-depressive-disorder. Its Epidemiology,
-- Etiology and Treatment sections each have genuine prose *and* a marker naming
-- what is still missing (onset-age distribution and cross-cultural prevalence;
-- genetic and neurobiological mechanisms; pooled effect sizes, since the source
-- is a study protocol with no outcomes yet). After the merge the page therefore
-- read `needs = {}` while its own body asked for research in three places —
-- and `reference_worklist`, which aims WP4, would not have targeted any of
-- them.
--
-- The rule now: **a section is a gap if it declares a Needs-research marker, or
-- if it has no prose at all.** The marker is the page's own statement about
-- itself and should win; an empty section with no marker is still a gap, so
-- nothing from the previous rule is lost.
--
-- This matches what the ingest prompt means by the marker — "for every section
-- the source does not support" — which is a sourcing gap, not a scientific
-- controversy. Genuine controversies belong in the Contested section, so a
-- marker is always a request for more reading rather than a standing caveat.
--
-- Verified as a shadow function against all 44 live pages first: exactly ONE
-- page changes (persistent-depressive-disorder, {} -> {epidemiology, etiology,
-- treatment}), and every other page is byte-identical under both rules. A
-- minimal, targeted correction rather than another reinterpretation.

create or replace function public.extract_page_needs(md text)
returns text[]
language plpgsql
immutable
as $$
declare
  body     text;
  ln       text;
  cur      text := null;
  prose    boolean := false;   -- section has content of its own
  marker   boolean := false;   -- section declares a Needs-research gap
  in_fence boolean := false;
  hits     jsonb := '{}'::jsonb;
  h        text;
  result   text[];
begin
  if md is null or md = '' then return '{}'::text[]; end if;

  body := regexp_replace(md, '^\s*---\r?\n.*?\r?\n---\r?\n?', '');

  foreach ln in array string_to_array(replace(body, chr(13), ''), chr(10))
  loop
    if ln ~ '^\s*(```|~~~)' then
      in_fence := not in_fence;
      continue;
    end if;
    if in_fence then continue; end if;

    -- Only H2 opens a section: H1 is the page title (no prose sits between it
    -- and the first H2, so treating it as a section reported every page's own
    -- title as a gap), and H3 belongs to the section above it.
    if ln ~ '^##[ \t]+\S' then
      if cur is not null then
        hits := jsonb_set(hits, array[cur],
          to_jsonb(coalesce((hits->>cur)::boolean, false) or marker or not prose));
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
    -- No heading of any level counts as prose.
    if ln ~ '^#{1,6}[ \t]+\S' then continue; end if;

    if cur is null then continue; end if;                       -- preamble
    if btrim(ln) = '' then continue; end if;
    if ln ~ '^\s*>\s*\*\*Needs research' then                   -- the marker
      marker := true;
      continue;
    end if;
    if ln ~ '^\s*>' then continue; end if;                      -- other quotes
    prose := true;
  end loop;

  if cur is not null then
    hits := jsonb_set(hits, array[cur],
      to_jsonb(coalesce((hits->>cur)::boolean, false) or marker or not prose));
  end if;

  select coalesce(array_agg(key order by key), '{}'::text[]) into result
  from jsonb_each_text(hits) where value = 'true';

  return result;
end;
$$;

comment on function public.extract_page_needs(text) is
  'Sections a page declares it lacks, derived from the body: an H2 that carries a `> **Needs research:**` marker, or that holds no prose at all. A partially filled section with a marker counts — the marker is the page''s own statement about itself. Deliberately NOT read from frontmatter, which a merged page loses.';

-- Re-derive. Safe: wiki_pages_snapshot and wiki_pages_touch both short-circuit
-- on unchanged content, so this writes no version snapshots and does not move
-- updated_at. Expected effect: exactly one page changes.
update public.wiki_pages set content = content where content is not null;

drop function if exists public.extract_page_needs_v3(text);
