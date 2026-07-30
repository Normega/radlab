-- 20260730_wiki_body_needs_and_replace.sql
-- TARGET: radlab-academic.
--
-- Two fixes to the gap mechanism, both surfaced by the WP2 reader making the
-- duplicated disorder skeletons on major-depressive-disorder (three copies)
-- and persistent-depressive-disorder (two) visible for the first time.
--
-- ── 1. `needs` is derived from the BODY, not the frontmatter ─────────────
--
-- extract_page_needs() parsed the frontmatter `needs: [...]` list, taking the
-- FIRST match in the document. Meanwhile the review UI's merge pre-fill
-- deliberately strips an addendum's frontmatter (correctly -- two YAML blocks
-- in one file is invalid). So `needs` froze at the first source's assessment
-- while the content kept growing, and it was wrong on live data:
--
--   major-depressive-disorder       declared 4 gaps, all four filled further down
--   persistent-depressive-disorder  declared 1 gap, filled
--
-- That is not cosmetic. reference_worklist reads `needs`, and reference_worklist
-- is what aims WP4's content sprint: as it stood the sprint would have spent
-- runs filling gaps that were already closed, while missing gaps that appeared
-- after a page's first pass. Wrong in both directions.
--
-- The rule now: **a section is a gap when no copy of it contains prose.**
-- Concretely, walk the body; H2 opens a section (H1 is the page title and H3 is
-- a subheading inside one); a line counts as prose unless it is blank, a
-- heading, or a blockquote -- the `> **Needs research:**` marker being the only
-- blockquote this wiki uses. A section name is reported when every occurrence
-- of it is placeholder-only.
--
-- Three properties this buys:
--   * Self-correcting. Fill a section and the gap clears; empty one and it
--     reappears. No dependence on the model updating frontmatter it no longer
--     controls after a merge.
--   * It catches the model's own omissions. Dry-run on all 44 live pages found
--     cyclothymic-disorder missing `etiology` and
--     disruptive-mood-dysregulation-disorder missing `epidemiology` -- both
--     have written `> **Needs research:**` placeholders that were never listed
--     in frontmatter.
--   * Page-type agnostic. Overview and foundation pages use their own headings
--     and get the same treatment, which is what the reference prompt already
--     promises them.
--
-- Verified before applying: of 44 pages with content, 40 are unchanged and the
-- 4 that move are exactly the four corrections above. The model's `sources:`
-- frontmatter stays useful for provenance; only the gap list stops depending
-- on it.
--
-- ── 2. A third proposal action: `replace` ───────────────────────────────
--
-- The duplication had a root cause upstream: the prompt requires all six H2
-- sections on a disorder page and forbids dropping one, while an `update` is
-- specified as "only the new information to merge". Both rules at once mean
-- every update to a disorder page emits a full skeleton, which the merge
-- pre-fill then appends -- one skeleton per accepted update.
--
-- WP4 is ~15 paper-mode runs followed by targeted reference runs on the Tier A
-- pages that still declare gaps: dozens of updates against existing disorder
-- pages. Left alone this recurs on essentially all 46 of them.
--
-- Reference mode now emits a COMPLETE page with action `replace` when its
-- target already has content -- it already names its target and receives the
-- current body, so "rewrite this page with the gaps filled" is both simpler and
-- produces coherent prose rather than two stitched voices. `replace` is a
-- distinct action rather than a heuristic on content shape because the
-- semantics genuinely differ: accepting it overwrites rather than appends, and
-- the review UI must not pre-merge it. Paper-mode updates stay deltas.
--
-- review_proposal() needs no change: its delta guard fires only on
-- action='update' with no existing body, and a `replace` carrying a whole page
-- is exactly what that guard exists to insist on.

-- ── Gap derivation ──────────────────────────────────────────────────────

create or replace function public.extract_page_needs(md text)
returns text[]
language plpgsql
immutable
as $$
declare
  body     text;
  ln       text;
  cur      text := null;
  prose    boolean := false;
  in_fence boolean := false;
  hits     jsonb := '{}'::jsonb;   -- section slug -> has prose anywhere
  h        text;
  result   text[];
begin
  if md is null or md = '' then return '{}'::text[]; end if;

  body := regexp_replace(md, '^\s*---\r?\n.*?\r?\n---\r?\n?', '');

  foreach ln in array string_to_array(replace(body, chr(13), ''), chr(10))
  loop
    -- Fenced blocks are skipped so a commented-out heading inside one cannot
    -- open a phantom section.
    if ln ~ '^\s*(```|~~~)' then
      in_fence := not in_fence;
      continue;
    end if;
    if in_fence then continue; end if;

    -- Only H2 opens a section. H1 is the page title -- no prose sits between it
    -- and the first H2, so treating it as a section reported every page's own
    -- title as a gap. H3 belongs to the section above it.
    if ln ~ '^##[ \t]+\S' then
      if cur is not null then
        hits := jsonb_set(hits, array[cur],
                  to_jsonb(coalesce((hits->>cur)::boolean, false) or prose));
      end if;
      h   := btrim(regexp_replace(ln, '^##[ \t]+', ''));
      h   := lower(regexp_replace(h, '[*_`#]', '', 'g'));
      h   := regexp_replace(h, '[^a-z0-9 -]', '', 'g');
      h   := regexp_replace(btrim(h), '\s+', '-', 'g');
      cur := btrim(regexp_replace(h, '-+', '-', 'g'), '-');
      prose := false;
      continue;
    end if;
    -- No heading of any level counts as prose.
    if ln ~ '^#{1,6}[ \t]+\S' then continue; end if;

    if cur is null then continue; end if;          -- preamble before any H2
    if btrim(ln) = '' then continue; end if;
    if ln ~ '^\s*>' then continue; end if;         -- the gap marker
    prose := true;
  end loop;

  if cur is not null then
    hits := jsonb_set(hits, array[cur],
              to_jsonb(coalesce((hits->>cur)::boolean, false) or prose));
  end if;

  select coalesce(array_agg(key order by key), '{}'::text[]) into result
  from jsonb_each_text(hits) where value = 'false';

  return result;
end;
$$;

comment on function public.extract_page_needs(text) is
  'Sections a page declares it lacks, derived from the body: an H2 whose every occurrence holds nothing but a `> **Needs research:**` marker. Deliberately NOT read from frontmatter -- a merged page loses the addendum frontmatter, which froze the old gap list at the first source''s assessment.';

-- ── Recompute for existing pages ────────────────────────────────────────
-- set_page_needs fires BEFORE UPDATE OF content, so touching content with its
-- own value re-derives the list. Safe: wiki_pages_snapshot and wiki_pages_touch
-- both short-circuit when content/title/summary are unchanged, so this creates
-- no version snapshots, no version bump, and leaves updated_at alone.
-- sync_wiki_links does re-run, and is idempotent.

update public.wiki_pages set content = content where content is not null;

-- ── The `replace` action ────────────────────────────────────────────────

alter table public.wiki_page_versions
  drop constraint if exists wiki_page_versions_action_check;

alter table public.wiki_page_versions
  add constraint wiki_page_versions_action_check
  check (action is null or action in ('new', 'update', 'replace'));

comment on column public.wiki_page_versions.action is
  'new = a page that did not exist. update = a DELTA, only the new information, appended on accept. replace = a complete page that overwrites the current body (reference mode against a target that already has content). The distinction is load-bearing: the review UI pre-merges an update and must not pre-merge a replace.';

drop function if exists public.extract_page_needs_v2(text);
