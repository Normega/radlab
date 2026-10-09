-- ensure_liliana_participant found a participant's training record by account
-- alone (`where profile_id = auth.uid()`), while everything that reads the
-- record back -- the study export, handle_withdraw, processAdherenceWithdrawal,
-- the admin withdraw, materializeSchedule's phase-day count -- scopes it by
-- (profile_id, study_id). One account training in two studies would therefore
-- share one record: the second study's day data and responses would be written
-- under the first study's record, and drop out of the second study's export.
--
-- Found 2026-10-08 while building the PSY240 teaching trial, whose two control
-- arms run on the training step (classrct-* modules). A trial student in a
-- control arm who later joined Liliana Study 3 with the same account would have
-- had their Study 3 days filed under the trial. Nobody is affected today: all
-- 130 records are one per account, each in its own study, and the only account
-- with schedules in a second study trains in one of them (Zerin's study has no
-- training step).
--
-- Fix: when the schedule row names the study, look up (and create) that
-- study's record. Without a schedule row the lookup is unchanged: the
-- profile's study, else the account's earliest record. A unique index on
-- (profile_id, study_id) makes the create race-safe (there was no constraint,
-- so the old `on conflict do nothing` never fired). Existing data has no
-- duplicate pairs, so the index builds cleanly.

create unique index if not exists liliana_participants_profile_study_key
  on liliana_participants (profile_id, study_id);

create or replace function public.ensure_liliana_participant(p_schedule_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_profile  uuid := auth.uid();
  v_lp       liliana_participants%rowtype;
  v_study    uuid;
  v_day      int;
begin
  if v_profile is null then
    raise exception 'ensure_liliana_participant: not authenticated';
  end if;

  if p_schedule_id is not null then
    select study_id, study_day into v_study, v_day
      from participant_schedule
      where id = p_schedule_id and participant_id = v_profile;
  end if;

  if v_study is not null then
    -- the schedule row names the study: this study's record
    select * into v_lp from liliana_participants
      where profile_id = v_profile and study_id = v_study;
  else
    -- no schedule row: as before, the profile's study, else the earliest record
    select study_id into v_study from profiles where id = v_profile;
    select * into v_lp from liliana_participants
      where profile_id = v_profile
      order by (study_id is not distinct from v_study) desc, enrolled_at
      limit 1;
  end if;

  if v_lp.id is null then
    insert into liliana_participants (profile_id, study_id, phase, current_day)
    values (v_profile, v_study, 'phase1', coalesce(v_day, 1))
    on conflict (profile_id, study_id) do nothing;
    select * into v_lp from liliana_participants
      where profile_id = v_profile and study_id is not distinct from v_study;
  end if;

  v_day := coalesce(v_day, v_lp.current_day, 1);

  if coalesce(v_lp.current_day, 0) < v_day then
    update liliana_participants set current_day = v_day where id = v_lp.id;
  end if;

  return jsonb_build_object(
    'participant_id', v_lp.id,
    'study_day',      v_day,
    'phase',          v_lp.phase
  );
end;
$function$;
