-- purge_study_data: delete one study's participant data, keeping each account
-- that is still needed elsewhere. Norm's rule for the PSY240 class trial (Oct 9):
-- at the end of term, on his explicit direction, delete everything that belongs
-- to the study; then check each participant's account, and keep it if it is
-- present in any other table (another study, a class, game data), since it is
-- the link those rows need. Delete it only if it existed for this study alone.
-- The trial's consent promises deletion of its data by Jan 31, 2027.
--
--   select purge_study_data('<study id>');                       -- dry run: counts only
--   select purge_study_data('<study id>', '<the study''s name>'); -- deletes
--
-- What counts as the study's data, found from the schema rather than listed by
-- hand, so a table added later is not missed:
--   - every row whose foreign key points at one of the study's schedule rows,
--     enrollments, links or training records (liliana_participants);
--   - every row of a table that has a study_id AND a person column
--     (participant_id / profile_id / user_id) with this study's id.
-- The study's design (studies, study_sessions, templates, consent and debrief
-- forms, the cron jobs) has no person column and is untouched.
-- Order matters twice. Rows pointing AT the study's schedule rows, enrollments,
-- links and training records go first, by the ids collected up front, and those
-- four tables last: several FKs to participant_schedule are ON DELETE SET NULL
-- (CLAUDE.md rule 1), so deleting a schedule row first would quietly detach its
-- answers and leave them behind (the first draft did exactly that in a dry run).
-- Beyond that, a table blocked by a foreign key is retried on the next pass, each
-- delete in its own subtransaction, until a pass deletes nothing more.
--
-- Accounts: every person enrolled in the study is checked, after the study's
-- rows are gone, against every public column that refers to a person (FKs to
-- profiles or auth.users, and uuid columns named participant_id / profile_id /
-- user_id). Any remaining row keeps the account; otherwise profiles and
-- auth.users are deleted. Two account logs carry no study at all (message_log,
-- participant_activity_log): they do not keep an account on their own, and are
-- deleted with an account that goes.
--
-- A dry run does all of it inside a subtransaction that is then rolled back, and
-- returns the same report. The real run needs p_confirm = studies.name exactly.
-- Owner only: no grant to anon or authenticated, so no page can call it.

create or replace function public.purge_study_data(p_study_id uuid, p_confirm text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_name      text;
  v_dry       boolean;
  v_sched     uuid[];
  v_enr       uuid[];
  v_links     uuid[];
  v_lp        uuid[];
  v_people    uuid[];
  v_tasks     jsonb := '[]'::jsonb;
  v_roots     text[] := array['participant_links', 'participant_schedule', 'liliana_participants', 'study_enrollments'];
  v_logs      text[] := array['message_log', 'participant_activity_log'];
  v_counts    jsonb := '{}'::jsonb;
  v_kept      jsonb := '{}'::jsonb;
  v_acc_del   int := 0;
  v_acc_kept  int := 0;
  v_pending   jsonb;
  v_next      jsonb;
  v_task      jsonb;
  v_n         int;
  v_pass      int := 0;
  v_progress  boolean;
  v_person    uuid;
  v_ref       record;
  v_hit       boolean;
  v_reason    text;
  v_report    jsonb;
begin
  select name into v_name from studies where id = p_study_id;
  if v_name is null then
    raise exception 'purge_study_data: no such study %', p_study_id;
  end if;
  v_dry := p_confirm is null;
  if not v_dry and p_confirm is distinct from v_name then
    raise exception 'purge_study_data: p_confirm must be the study''s name exactly (%)', v_name;
  end if;

  select coalesce(array_agg(id), '{}') into v_sched from participant_schedule where study_id = p_study_id;
  select coalesce(array_agg(id), '{}'), coalesce(array_agg(distinct profile_id), '{}') into v_enr, v_people
    from study_enrollments where study_id = p_study_id;
  select coalesce(array_agg(id), '{}') into v_links from participant_links where study_id = p_study_id;
  select coalesce(array_agg(id), '{}') into v_lp from liliana_participants where study_id = p_study_id;
  select coalesce(array_agg(distinct x), '{}') into v_people
    from unnest(v_people || array(select distinct participant_id from participant_schedule where study_id = p_study_id)) x
   where x is not null;

  -- the delete tasks: (schema, table, column, which id set)
  for v_ref in
    select n.nspname s, c.relname t, a.attname col,
           case k.confrelid
             when 'public.participant_schedule'::regclass then 'sched'
             when 'public.study_enrollments'::regclass    then 'enr'
             when 'public.participant_links'::regclass    then 'links'
             when 'public.liliana_participants'::regclass then 'lp'
           end as idset
      from pg_constraint k
      join pg_class c on c.oid = k.conrelid
      join pg_namespace n on n.oid = c.relnamespace
      join pg_attribute a on a.attrelid = k.conrelid and a.attnum = k.conkey[1]
     where k.contype = 'f' and array_length(k.conkey, 1) = 1 and n.nspname = 'public'
       and k.confrelid in ('public.participant_schedule'::regclass, 'public.study_enrollments'::regclass,
                           'public.participant_links'::regclass, 'public.liliana_participants'::regclass)
    union
    select n.nspname, c.relname, 'study_id', 'study'
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r'
       and exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'study_id' and not a.attisdropped)
       and exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname in ('participant_id', 'profile_id', 'user_id') and not a.attisdropped)
  loop
    v_tasks := v_tasks || jsonb_build_array(jsonb_build_object('s', v_ref.s, 't', v_ref.t, 'col', v_ref.col, 'idset', v_ref.idset,
      'prio', case when v_ref.t = any(v_roots) then 3 when v_ref.idset = 'study' then 2 else 1 end));
  end loop;
  -- children first, the four root tables last (see the header)
  select coalesce(jsonb_agg(x order by (x->>'prio')::int, x->>'t'), '[]') into v_tasks from jsonb_array_elements(v_tasks) x;

  begin
    -- delete, retrying tables blocked by a foreign key, until a pass makes no progress
    v_pending := v_tasks;
    loop
      v_pass := v_pass + 1;
      v_progress := false;
      v_next := '[]'::jsonb;
      for v_task in select * from jsonb_array_elements(v_pending) loop
        begin
          execute format('delete from %I.%I where %I = any($1)', v_task->>'s', v_task->>'t', v_task->>'col')
            using case v_task->>'idset'
                    when 'sched' then v_sched when 'enr' then v_enr when 'links' then v_links
                    when 'lp' then v_lp else array[p_study_id] end;
          get diagnostics v_n = row_count;
          if v_n > 0 then
            v_progress := true;
            v_counts := jsonb_set(v_counts, array[v_task->>'t'], to_jsonb(coalesce((v_counts->>(v_task->>'t'))::int, 0) + v_n));
          end if;
        exception when foreign_key_violation then
          v_next := v_next || jsonb_build_array(v_task);
        end;
      end loop;
      v_pending := v_next;
      exit when jsonb_array_length(v_pending) = 0 or (not v_progress and v_pass > 1) or v_pass >= 12;
    end loop;
    if jsonb_array_length(v_pending) > 0 then
      raise exception 'purge_study_data: still blocked after % passes: %', v_pass, v_pending;
    end if;

    -- accounts: keep any still referenced from another table
    foreach v_person in array v_people loop
      v_hit := false;
      for v_ref in
        select distinct n.nspname s, c.relname t, a.attname col
          from pg_attribute a
          join pg_class c on c.oid = a.attrelid
          join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and c.relkind = 'r' and not a.attisdropped and a.attnum > 0
           and c.relname <> 'profiles' and c.relname <> all(v_logs)
           and (exists (select 1 from pg_constraint k
                         where k.conrelid = c.oid and k.contype = 'f' and a.attnum = any(k.conkey)
                           and k.confrelid in ('public.profiles'::regclass, 'auth.users'::regclass))
                or (a.attname in ('participant_id', 'profile_id', 'user_id') and a.atttypid = 'uuid'::regtype))
      loop
        execute format('select exists (select 1 from %I.%I where %I = $1)', v_ref.s, v_ref.t, v_ref.col)
          into v_hit using v_person;
        if v_hit then
          v_reason := v_ref.t || '.' || v_ref.col;
          exit;
        end if;
      end loop;
      if v_hit then
        v_acc_kept := v_acc_kept + 1;
        v_kept := jsonb_set(v_kept, array[v_reason], to_jsonb(coalesce((v_kept->>v_reason)::int, 0) + 1));
      else
        delete from public.message_log where participant_id = v_person;
        delete from public.participant_activity_log where participant_id = v_person;
        delete from public.profiles where id = v_person;
        delete from auth.users where id = v_person;
        v_acc_del := v_acc_del + 1;
      end if;
    end loop;

    v_report := jsonb_build_object(
      'study', v_name, 'dry_run', v_dry, 'passes', v_pass,
      'rows_deleted', v_counts,
      'accounts_deleted', v_acc_del, 'accounts_kept', v_acc_kept, 'kept_because', v_kept);

    if v_dry then
      raise exception using errcode = 'P0001', message = 'purge_study_data dry run';
    end if;
  exception when sqlstate 'P0001' then
    if not v_dry or sqlerrm <> 'purge_study_data dry run' then
      raise;
    end if;
  end;

  return v_report;
end;
$function$;

revoke all on function public.purge_study_data(uuid, text) from public, anon, authenticated;
