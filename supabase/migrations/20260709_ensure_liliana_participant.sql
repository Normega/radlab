-- WP-L5 dry-run finding: nothing created liliana_participants rows for
-- participants enrolled through auto-enroll, and nothing ever advanced
-- liliana_participants.current_day — so TrainingStepWrapper would have
-- silently saved no day data (missing row), or attributed every day's data
-- to study_day 1 (static counter + UNIQUE(participant_id, study_day)).
--
-- Fix: ensure_liliana_participant(p_schedule_id) — SECURITY DEFINER, called
-- by TrainingStepWrapper at the start of every training step.
--   - Creates the liliana_participants row on first contact (study from the
--     schedule row, falling back to profiles.study_id).
--   - Derives the participant's day from participant_schedule.study_day (the
--     authoritative per-participant calendar), falling back to current_day.
--   - Keeps current_day in sync (monotonic) for anything else reading it.

create or replace function ensure_liliana_participant(p_schedule_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile  uuid := auth.uid();
  v_lp       liliana_participants%rowtype;
  v_study    uuid;
  v_day      int;
begin
  if v_profile is null then
    raise exception 'ensure_liliana_participant: not authenticated';
  end if;

  -- Day + study from the schedule row when given (authoritative).
  if p_schedule_id is not null then
    select study_id, study_day into v_study, v_day
      from participant_schedule
      where id = p_schedule_id and participant_id = v_profile;
  end if;

  if v_study is null then
    select study_id into v_study from profiles where id = v_profile;
  end if;

  select * into v_lp from liliana_participants where profile_id = v_profile;

  if not found then
    insert into liliana_participants (profile_id, study_id, phase, current_day)
    values (v_profile, v_study, 'phase1', coalesce(v_day, 1))
    on conflict do nothing;
    select * into v_lp from liliana_participants where profile_id = v_profile;
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
$$;

revoke execute on function ensure_liliana_participant(uuid) from public, anon;
grant  execute on function ensure_liliana_participant(uuid) to authenticated;
