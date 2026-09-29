-- radlab-academic. Sign-in by UTORid address.
--
-- U of T gives every student two addresses that reach one inbox: the name
-- address the registrar exports (charlesmary.obiorah@mail.utoronto.ca) and a
-- UTORid alias (obiorahc@mail.utoronto.ca). The roster matched only the first,
-- so a PSY309 student who typed the alias four times on 2026-09-29 was told
-- nothing and sent nothing, a week before a test that runs in the Lounge.
--
-- identity.roster gains `utorid` (the class-list CSV's UTORid column), and the
-- two roster lookups match `<utorid>@utoronto.ca` as well as the normalised
-- email. The sign-in email still goes to the roster address — the same inbox —
-- so the account and its email never change. An email match wins over a UTORid
-- match. roster_upsert() stores utorid from uploads (never clears it).
-- Backfill for PSY240 and PSY309 is data, run separately from the Sept 16 /
-- Sept 25 class lists.

alter table identity.roster add column if not exists utorid text;
create index if not exists roster_utorid_key
  on identity.roster ((lower(utorid) || '@utoronto.ca')) where utorid is not null;

create or replace function public.roster_find_by_key(p_match_key text)
 returns table(id uuid, full_name text, email text, status text, invite_count integer, last_invited_at timestamp with time zone)
 language sql
 security definer
 set search_path to 'public', 'identity'
as $function$
  select r.id, r.full_name, r.email, r.status, r.invite_count, r.last_invited_at
  from identity.roster r
  where (r.email_match_key = p_match_key
         or (r.utorid is not null and lower(r.utorid) || '@utoronto.ca' = p_match_key))
    and r.status <> 'dropped'
  order by (r.email_match_key = p_match_key) desc
  limit 1
$function$;

create or replace function public.roster_find_by_key_in_course(p_match_key text, p_course_code text)
 returns table(id uuid, full_name text, email text, status text, invite_count integer, last_invited_at timestamp with time zone)
 language sql
 security definer
 set search_path to 'public', 'identity'
as $function$
  select r.id, r.full_name, r.email, r.status, r.invite_count, r.last_invited_at
  from identity.roster r
  join public.courses c on c.id = r.course_id
  where (r.email_match_key = p_match_key
         or (r.utorid is not null and lower(r.utorid) || '@utoronto.ca' = p_match_key))
    and upper(c.code) = upper(btrim(p_course_code))
    and r.status <> 'dropped'
  order by
    (r.email_match_key = p_match_key) desc,
    substring(c.term from 1 for 4) desc,
    case upper(substring(c.term from 5 for 1))
      when 'F' then 3 when 'S' then 2 when 'W' then 1 else 0
    end desc
  limit 1
$function$;

create or replace function public.roster_upsert(p_course_id uuid, p_rows jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'identity'
as $function$
declare
  v_inserted int := 0;
  v_updated  int := 0;
  v_skipped  int := 0;
  r jsonb;
  v_email text; v_key text; v_name text; v_num text; v_utorid text;
  v_existing uuid;
  v_keys text[] := '{}';
  v_absent   jsonb := '[]'::jsonb;
  v_returned jsonb := '[]'::jsonb;
begin
  if not is_course_staff(p_course_id) then
    raise exception 'staff only';
  end if;

  for r in select * from jsonb_array_elements(p_rows) loop
    v_email  := btrim(coalesce(r->>'email',''));
    v_name   := btrim(coalesce(r->>'full_name',''));
    v_num    := nullif(btrim(coalesce(r->>'student_number','')),'');
    v_utorid := nullif(lower(btrim(coalesce(r->>'utorid',''))),'');
    v_key    := normalize_uoft_email(v_email);
    if v_email = '' or v_name = '' or v_key !~ '@' then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    v_keys := v_keys || v_key;

    select id into v_existing from identity.roster
    where course_id = p_course_id and email_match_key = v_key;

    if v_existing is null then
      insert into identity.roster (course_id, full_name, student_number, email, email_match_key, utorid)
      values (p_course_id, v_name, v_num, v_email, v_key, v_utorid);
      v_inserted := v_inserted + 1;
    else
      update identity.roster
      set full_name = v_name,
          student_number = coalesce(v_num, student_number),
          utorid = coalesce(v_utorid, utorid),
          email = v_email
      where id = v_existing;
      v_updated := v_updated + 1;
    end if;
  end loop;

  if array_length(v_keys, 1) > 0 then
    select coalesce(jsonb_agg(
             jsonb_build_object('id', id, 'full_name', full_name, 'email', email, 'status', status)
             order by full_name), '[]'::jsonb)
      into v_absent
      from identity.roster
     where course_id = p_course_id
       and status <> 'dropped'
       and role <> 'observer'
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
$function$;
