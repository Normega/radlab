-- 20260810_correction_guards.sql
--
-- The staff correction path (WP6 Phase D, first half), designed with Norm
-- 2026-08-10. Decisions: corrections AUTO-APPLY with an audit feed (2-person
-- staff; countersigning would bottleneck), visibility is QUIET (no banner —
-- history on request), and claim-changes get a MECHANICAL TRIPWIRE with
-- magnitude tolerance (his spec: "a prevalence changing from 11% to 12%
-- shouldn't matter much, but going to 21% or down to 3% should — allow a few
-- points of variance but trip and require verified-against-source if it is
-- half an order of magnitude different").
--
-- Key discovery that shaped this: edit_page() ALREADY IS the correction path —
-- staff-gated, snapshot trigger keeps numbered history, the note lands on the
-- version row, and it carries no job_id so it can never pollute a page's
-- "Built from" list. What it lacked was guards. This migration hardens the
-- existing door rather than cutting a second one.
--
-- The conceptual rule the guards enforce (run plan §39 records the taxonomy):
-- a correction may change HOW the page says something (typo, grammar,
-- transcription fidelity, structure) — it must not change WHAT the page
-- claims. A changed claim needs a source, which means the ingest path, which
-- is exactly what the tripwire pushes toward.

-- ---------------------------------------------------------------------------
-- 1. numeric_shift_check(old, new): the tripwire
-- ---------------------------------------------------------------------------
-- Pairs numbers that vanished from the old body with numbers that appeared in
-- the new one, in document order (corrections are small edits — the i-th
-- removed number is overwhelmingly the i-th added one). Per pair:
--
--   |Δ| ≤ 3                      → pass  (a few points of variance are fine)
--   ratio ≥ √10 (~3.16)          → trip  (half an order of magnitude)
--   |Δ| ≥ 10                     → trip  (11% → 21% is a different claim even
--                                          though the ratio is only 1.9×)
--
-- Years (integers 1900–2099) are ignored so citation-year edits don't
-- false-positive. Unpaired additions/removals are reported but never trip —
-- deciding whether a NEW number is a new claim is the form's question, not a
-- regex's.

create or replace function public.numeric_shift_check(p_old text, p_new text)
returns jsonb
language plpgsql immutable
as $$
declare
  old_nums numeric[] := '{}';
  new_nums numeric[] := '{}';
  removed  numeric[] := '{}';
  added    numeric[] := '{}';
  m text;
  v numeric;
  i int; j int;
  pool numeric[];
  pairs jsonb := '[]'::jsonb;
  tripped boolean := false;
  a numeric; b numeric; d numeric; r numeric;
begin
  for m in select (regexp_matches(coalesce(p_old,''), '\d+(?:\.\d+)?', 'g'))[1] loop
    v := m::numeric;
    if not (v = trunc(v) and v between 1900 and 2099) then
      old_nums := old_nums || v;
    end if;
  end loop;
  for m in select (regexp_matches(coalesce(p_new,''), '\d+(?:\.\d+)?', 'g'))[1] loop
    v := m::numeric;
    if not (v = trunc(v) and v between 1900 and 2099) then
      new_nums := new_nums || v;
    end if;
  end loop;

  -- multiset difference, order-preserving: removed = old − new, added = new − old
  pool := new_nums;
  foreach v in array old_nums loop
    j := array_position(pool, v);
    if j is null then removed := removed || v; else pool := pool[:j-1] || pool[j+1:]; end if;
  end loop;
  pool := old_nums;
  foreach v in array new_nums loop
    j := array_position(pool, v);
    if j is null then added := added || v; else pool := pool[:j-1] || pool[j+1:]; end if;
  end loop;

  for i in 1 .. least(coalesce(array_length(removed,1),0), coalesce(array_length(added,1),0)) loop
    a := removed[i]; b := added[i];
    d := abs(a - b);
    if least(a, b) = 0 then r := null; else r := greatest(a, b) / least(a, b); end if;
    if d > 3 and (d >= 10 or r is null or r >= 3.16) then
      tripped := true;
      pairs := pairs || jsonb_build_object('from', a, 'to', b, 'diff', d, 'ratio', round(coalesce(r, 0), 2), 'trips', true);
    else
      pairs := pairs || jsonb_build_object('from', a, 'to', b, 'diff', d, 'ratio', round(coalesce(r, 0), 2), 'trips', false);
    end if;
  end loop;

  return jsonb_build_object(
    'tripped', tripped,
    'pairs', pairs,
    'unpaired_removed', to_jsonb(removed[least(coalesce(array_length(added,1),0),coalesce(array_length(removed,1),0))+1:]),
    'unpaired_added',   to_jsonb(added[least(coalesce(array_length(added,1),0),coalesce(array_length(removed,1),0))+1:]));
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. edit_page(), hardened. The old 3-arg signature is DROPPED — leaving it
--    would give PostgREST two overloads and make every named-arg rpc call
--    ambiguous.
-- ---------------------------------------------------------------------------

drop function if exists public.edit_page(uuid, text, text);

create or replace function public.edit_page(
  p_page_id uuid,
  p_content text,
  p_note text default null,
  p_verified text default null,
  p_allow_structure boolean default false
)
returns jsonb
language plpgsql security definer
set search_path to 'public', 'identity'
as $$
declare
  pg     public.wiki_pages%rowtype;
  editor uuid;
  vid    uuid;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  removed_sections text[];
  old_annotations int;
  new_annotations int;
  shift jsonb;
  pair jsonb;
  msg text;
begin
  editor := public.current_person_id();
  if editor is null then
    raise exception 'no identity for caller';
  end if;

  select * into pg from public.wiki_pages where id = p_page_id;
  if not found then
    raise exception 'no such page %', p_page_id;
  end if;

  if not public.is_course_staff(pg.course_id) then
    raise exception 'not a TA or instructor on this course';
  end if;

  if p_content is null or btrim(p_content) = '' then
    raise exception
      'refusing to blank %: a page with no body is a shell awaiting its first proposal. Use unpublish_page to take a page away from students.',
      pg.slug;
  end if;

  if pg.content is not distinct from p_content then
    raise exception 'no change to % — content is identical', pg.slug;
  end if;

  -- Guard 0: the note is the audit feed. Auto-apply without a reason recorded
  -- is how quiet edits become unexplainable a term later.
  if v_note is null then
    raise exception 'NOTE REQUIRED: say what changed and why — it is what the corrections feed shows.';
  end if;

  -- Guard 1: section-list guard. A replace that spans a heading can delete it
  -- while the length delta looks fine (this ate "## Contested" once). Removing
  -- a section is sometimes right — hence an explicit override, never a silent
  -- pass. Annotation lines are catalogued gaps (ask_hash), so removing one is
  -- also a structural act.
  select coalesce(array_agg(k), '{}') into removed_sections
  from (
    select jsonb_object_keys(public.extract_page_sections(pg.content)) as k
    except
    select jsonb_object_keys(public.extract_page_sections(p_content))
  ) s;

  old_annotations := coalesce(array_length(regexp_split_to_array(pg.content,  '> \*\*Needs research:'), 1), 1) - 1;
  new_annotations := coalesce(array_length(regexp_split_to_array(p_content,   '> \*\*Needs research:'), 1), 1) - 1;

  if not p_allow_structure then
    if array_length(removed_sections, 1) is not null then
      raise exception 'STRUCTURE: this edit removes section(s) [%] — if that is intended, tick "structure change intended" and save again.',
        array_to_string(removed_sections, ', ');
    end if;
    if new_annotations < old_annotations then
      raise exception 'STRUCTURE: this edit removes % "Needs research" annotation(s), which are catalogued gaps — if that is intended, tick "structure change intended" and save again.',
        old_annotations - new_annotations;
    end if;
  end if;

  -- Guard 2: the magnitude tripwire.
  shift := public.numeric_shift_check(pg.content, p_content);
  if (shift->>'tripped')::boolean and nullif(btrim(coalesce(p_verified, '')), '') is null then
    msg := '';
    for pair in select * from jsonb_array_elements(shift->'pairs') loop
      if (pair->>'trips')::boolean then
        msg := msg || format(' %s→%s (Δ%s, ×%s);', pair->>'from', pair->>'to', pair->>'diff', pair->>'ratio');
      end if;
    end loop;
    raise exception 'NUMERIC SHIFT:% a change this size is a different claim, not a typo. If the page misreported its source, fill in "verified against source" (say where you checked). If the claim itself is wrong, this is not a correction — ingest the better source instead.', msg;
  end if;
  if (shift->>'tripped')::boolean then
    v_note := v_note || ' · verified against source: ' || btrim(p_verified);
  end if;

  update public.wiki_pages
  set content    = p_content,
      updated_by = editor
  where id = p_page_id;

  select * into pg from public.wiki_pages where id = p_page_id;

  select id into vid
  from public.wiki_page_versions
  where page_id = p_page_id and kind = 'accepted' and version = pg.current_version
  order by created_at desc
  limit 1;

  if vid is not null then
    update public.wiki_page_versions
    set note = v_note,
        created_by = coalesce(created_by, editor)
    where id = vid;
  end if;

  return jsonb_build_object(
    'page_id',         pg.id,
    'slug',            pg.slug,
    'status',          pg.status,
    'current_version', pg.current_version,
    'version_id',      vid,
    'needs',           to_jsonb(pg.needs),
    'links_extracted', (select count(*) from public.wiki_links where source_page_id = pg.id),
    'note',            v_note,
    'numeric_shift',   shift
  );
end;
$$;

grant execute on function public.numeric_shift_check(text, text) to authenticated;
grant execute on function public.edit_page(uuid, text, text, text, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. corrections_feed: the audit trail auto-apply is traded against
-- ---------------------------------------------------------------------------
-- security_invoker: staff read all versions, members read accepted versions of
-- published pages — RLS decides, the view just shapes. job_id IS NULL is what
-- distinguishes a staff edit from a source-carrying accepted version.

create or replace view public.corrections_feed
with (security_invoker = true) as
select v.id as version_id,
       p.slug,
       p.title,
       v.version,
       v.note,
       v.created_at,
       coalesce(nullif(btrim(pe.full_name), ''), pe.email) as editor
from wiki_page_versions v
join wiki_pages p on p.id = v.page_id
left join identity.people pe on pe.id = v.created_by
where v.kind = 'accepted'
  and v.job_id is null
  and v.note is not null
order by v.created_at desc;
