-- 20260726_version_numbering_from_history.sql
-- TARGET: radlab-academic.
--
-- BUG: accepting a proposal failed with
--   duplicate key value violates unique constraint "wiki_page_versions_accepted_idx"
--
-- wiki_pages_touch() derived the next version number from wiki_pages.current_version
-- (old.current_version + 1, and no bump at all when the page had no body). The
-- snapshot trigger then wrote that number into wiki_page_versions. That only holds
-- while current_version and the version history agree — and they stopped agreeing
-- the moment a page's body was cleared for regeneration while its accepted
-- snapshots were kept on purpose:
--
--   persistent-depressive-disorder   snapshots: v1        current_version reset to 1
--   borderline-personality-disorder  snapshots: v1, v2    current_version reset to 1
--
-- Next accept computed version 1 again and collided with the snapshot already
-- there. The constraint did its job; the number was wrong.
--
-- FIX: derive the version from the history, which is the thing the unique index
-- is actually over — max(version) + 1 among that page's accepted snapshots. Now
-- current_version can be reset, back-filled or corrupted without the next accept
-- colliding: the numbering repairs itself on the next write.
--
-- Self-healing, so no data repair is needed. The two cleared pages will next
-- accept as v2 and v3 respectively, preserving their earlier snapshots.

create or replace function public.wiki_pages_touch()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.content is not null
     and (new.content is distinct from old.content
          or new.title   is distinct from old.title
          or new.summary is distinct from old.summary) then
    -- Next version = one past the highest accepted snapshot this page already
    -- has. Never derived from current_version, which is a cached count and can
    -- legitimately be out of step (a cleared body, a restore, a manual fix).
    select coalesce(max(v.version), 0) + 1
    into new.current_version
    from public.wiki_page_versions v
    where v.page_id = new.id and v.kind = 'accepted';

    new.updated_at := now();
  end if;

  if new.status = 'published' and old.status is distinct from 'published' then
    new.published_at := coalesce(new.published_at, now());
  end if;

  return new;
end;
$$;

-- Bring the cached counter back in line with history for any page where the two
-- have already diverged, so the UI stops showing a version number that does not
-- match the snapshots behind it.
update public.wiki_pages p
set current_version = greatest(
  1,
  coalesce((select max(v.version) from public.wiki_page_versions v
            where v.page_id = p.id and v.kind = 'accepted'), 0)
)
where p.current_version is distinct from greatest(
  1,
  coalesce((select max(v.version) from public.wiki_page_versions v
            where v.page_id = p.id and v.kind = 'accepted'), 0)
);
