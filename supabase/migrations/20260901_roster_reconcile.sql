-- Roster reconcile (ACADEMIC project): make add/drop churn a two-click job.
--
-- Norm, 2026-08-31: "there will be a lot of course enrollment and dropping in
-- the first few weeks". roster_upsert already made re-uploads graceful for the
-- ADDING side (idempotent on normalized email, never regresses status). This
-- adds the DROPPING side, which was fully manual:
--
--   * a student who vanished from the ACORN export just stayed on the roster,
--     invitable, at whatever status they had;
--   * a dropped student who re-enrolled reappeared in the CSV but stayed
--     'dropped' — and 'dropped' blocks magic-link sign-in, so from their side
--     the join link silently did not work.
--
-- 1. roster_upsert now ALSO returns the reconcile diff, computed against the
--    same upload in the same call (same normalization, no second round trip):
--      absent   — roster rows missing from this CSV, not already dropped
--                 (includes 'enrolled' rows: enrol-then-drop is exactly the
--                 case staff must see; the client badges them)
--      returned — 'dropped' rows present in this CSV
--    Additive keys on the existing return object; old clients ignore them.
--    An upload whose rows ALL failed validation returns an empty diff rather
--    than "everyone is absent" — a mis-mapped column must not offer a
--    drop-the-whole-roster button.
--
-- 2. roster_bulk_status applies one side of that diff in one statement.
--    Deliberately narrower than per-row roster_set_status:
--      * only 'dropped' (the absent side) or 'added' (the returned side) —
--        'enrolled' stays earned-by-clicking, 'invited'/'bounced' stay
--        per-row concerns;
--      * restore-to-added only touches rows currently 'dropped', so a stale
--        id list cannot regress an enrolled student;
--      * ids are scoped to the staff-checked course — ids from another course
--        simply do not match.

create or replace function public.roster_upsert(p_course_id uuid, p_rows jsonb)
returns jsonb language plpgsql security definer
set search_path to 'public', 'identity'
as $$
declare
  v_inserted int := 0;
  v_updated  int := 0;
  v_skipped  int := 0;
  r jsonb;
  v_email text; v_key text; v_name text; v_num text;
  v_existing uuid;
  v_keys text[] := '{}';
  v_absent   jsonb := '[]'::jsonb;
  v_returned jsonb := '[]'::jsonb;
begin
  if not is_course_staff(p_course_id) then
    raise exception 'staff only';
  end if;

  for r in select * from jsonb_array_elements(p_rows) loop
    v_email := btrim(coalesce(r->>'email',''));
    v_name  := btrim(coalesce(r->>'full_name',''));
    v_num   := nullif(btrim(coalesce(r->>'student_number','')),'');
    v_key   := normalize_uoft_email(v_email);
    if v_email = '' or v_name = '' or v_key !~ '@' then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    v_keys := v_keys || v_key;

    select id into v_existing from identity.roster
    where course_id = p_course_id and email_match_key = v_key;

    if v_existing is null then
      insert into identity.roster (course_id, full_name, student_number, email, email_match_key)
      values (p_course_id, v_name, v_num, v_email, v_key);
      v_inserted := v_inserted + 1;
    else
      update identity.roster
      set full_name = v_name,
          student_number = coalesce(v_num, student_number),
          email = v_email
      where id = v_existing;
      v_updated := v_updated + 1;
    end if;
  end loop;

  -- The reconcile diff. Only when at least one row validated: an upload where
  -- every row was skipped says nothing about who is absent.
  if array_length(v_keys, 1) > 0 then
    select coalesce(jsonb_agg(
             jsonb_build_object('id', id, 'full_name', full_name, 'email', email, 'status', status)
             order by full_name), '[]'::jsonb)
      into v_absent
      from identity.roster
     where course_id = p_course_id
       and status <> 'dropped'
       and not (email_match_key = any(v_keys));

    select coalesce(jsonb_agg(
             jsonb_build_object('id', id, 'full_name', full_name, 'email', email, 'status', status)
             order by full_name), '[]'::jsonb)
      into v_returned
      from identity.roster
     where course_id = p_course_id
       and status = 'dropped'
       and email_match_key = any(v_keys);
  end if;

  return jsonb_build_object(
    'inserted', v_inserted, 'updated', v_updated, 'skipped', v_skipped,
    'absent', v_absent, 'returned', v_returned
  );
end;
$$;

create or replace function public.roster_bulk_status(
  p_course_id uuid, p_ids uuid[], p_status text, p_note text default null
)
returns integer language plpgsql security definer
set search_path to 'public', 'identity'
as $$
declare
  v_n integer;
begin
  if not is_course_staff(p_course_id) then
    raise exception 'staff only';
  end if;
  if p_status not in ('added','dropped') then
    raise exception 'bulk status is for reconcile only: added or dropped';
  end if;

  update identity.roster
     set status = p_status,
         notes = case when p_note is null then notes
                      else coalesce(notes,'') || ' | ' || p_note end
   where course_id = p_course_id
     and id = any(p_ids)
     and status <> p_status
     -- restoring is only ever dropped → added; never touch other statuses
     and (p_status = 'dropped' or status = 'dropped');

  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- Same exposure pattern as the other roster_* functions.
revoke all on function public.roster_bulk_status(uuid, uuid[], text, text) from public, anon;
grant execute on function public.roster_bulk_status(uuid, uuid[], text, text) to authenticated;
