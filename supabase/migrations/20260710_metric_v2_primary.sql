-- WP-L5b: participant-facing ranking switches to metric v2 (mean Δstress),
-- per Liliana's methods document (§4.3: "average within-session improvement in
-- perceived stress ... mean of the daily pre- to post-session difference
-- scores") — confirmed by Norm 2026-07-10. The feedback UI foregrounds the
-- stress delta and shows raw means (enjoyment/helpfulness /6) as secondary
-- info; z-scores are never shown to participants.
--
-- v1 (within-person z-blend of stress relief + appraisal) is still computed
-- and stored in every snapshot (computed.*.composite_v1 and ranking entries)
-- for exploratory analysis — only the ordering and the metric_version label
-- change. Tie-breaks: mean Δstress → mean helpfulness → seeded hash.

create or replace function get_liliana_midpoint_summary(p_mark_shown boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile  uuid := auth.uid();
  v_lp       liliana_participants%rowtype;
  v_row      liliana_midpoint_feedback%rowtype;
  v_computed jsonb;
  v_ranking  jsonb;
  v_group    text;
begin
  if v_profile is null then
    raise exception 'get_liliana_midpoint_summary: not authenticated';
  end if;

  select * into v_lp from liliana_participants where profile_id = v_profile;
  if not found then
    raise exception 'get_liliana_midpoint_summary: no liliana_participants row for this user';
  end if;

  select * into v_row from liliana_midpoint_feedback where participant_id = v_lp.id;

  if not found then
    with sess as (
      select condition, delta_stress, appraisal, helpful
      from liliana_session_metrics
      where participant_id = v_lp.id
        and phase = 'phase1'
        and condition is not null
        and completed
        and delta_stress is not null
        and appraisal is not null
    ),
    stats as (
      select
        avg(delta_stress)         as mean_d,
        stddev_samp(delta_stress) as sd_d,
        avg(appraisal)            as mean_a,
        stddev_samp(appraisal)    as sd_a
      from sess
    ),
    scored as (
      select
        s.condition, s.delta_stress, s.appraisal, s.helpful,
        ( (case when st.sd_d > 0 then (s.delta_stress - st.mean_d) / st.sd_d else 0 end)
        + (case when st.sd_a > 0 then (s.appraisal    - st.mean_a) / st.sd_a else 0 end) ) / 2.0 as quality
      from sess s cross join stats st
    ),
    conds as (
      select
        c.condition,
        count(sc.condition)      as n,
        avg(sc.delta_stress)     as mean_delta_stress,
        avg(sc.appraisal)        as mean_appraisal,
        avg(sc.helpful)          as mean_helpful,
        avg(sc.quality)          as composite_v1,
        avg(sc.delta_stress)     as composite_v2
      from (values ('non_reactivity'), ('reappraisal'), ('self_compassion')) as c(condition)
      left join scored sc on sc.condition = c.condition
      group by c.condition
    ),
    ranked as (
      select *,
        -- v2 primary: mean within-session stress improvement
        row_number() over (
          order by composite_v2 desc nulls last,
                   mean_helpful desc nulls last,
                   md5(v_lp.profile_id::text || ':' || condition)
        ) as rnk
      from conds
    )
    select
      jsonb_object_agg(condition, jsonb_build_object(
        'n',                 n,
        'mean_delta_stress', round(mean_delta_stress, 3),
        'mean_appraisal',    round(mean_appraisal, 3),
        'mean_helpful',      round(mean_helpful, 3),
        'composite_v1',      round(composite_v1, 4),
        'composite_v2',      round(composite_v2, 4),
        'low_n',             (n < 2)
      )),
      jsonb_agg(jsonb_build_object(
        'rank',              rnk,
        'condition',         condition,
        'n',                 n,
        'mean_delta_stress', round(mean_delta_stress, 3),
        'mean_appraisal',    round(mean_appraisal, 3),
        'composite_v1',      round(composite_v1, 4),
        'composite_v2',      round(composite_v2, 4),
        'low_n',             (n < 2)
      ) order by rnk)
    into v_computed, v_ranking
    from ranked;

    select value #>> '{}' into v_group
      from participant_assignments
      where study_id = v_lp.study_id
        and participant_id = v_profile
        and node_id = 'midpoint_group';

    insert into liliana_midpoint_feedback
      (participant_id, profile_id, study_id, midpoint_group, metric_version, computed, ranking)
    values
      (v_lp.id, v_profile, v_lp.study_id, v_group, 2, v_computed, v_ranking)
    on conflict (participant_id) do nothing;

    select * into v_row from liliana_midpoint_feedback where participant_id = v_lp.id;
  end if;

  if v_row.midpoint_group is null then
    select value #>> '{}' into v_group
      from participant_assignments
      where study_id = v_lp.study_id
        and participant_id = v_profile
        and node_id = 'midpoint_group';
    if v_group is not null then
      update liliana_midpoint_feedback set midpoint_group = v_group where id = v_row.id;
      v_row.midpoint_group := v_group;
    end if;
  end if;

  if p_mark_shown and v_row.shown_at is null then
    update liliana_midpoint_feedback set shown_at = now() where id = v_row.id;
    v_row.shown_at := now();
  end if;

  return to_jsonb(v_row);
end;
$$;

revoke execute on function get_liliana_midpoint_summary(boolean) from public, anon;
grant  execute on function get_liliana_midpoint_summary(boolean) to authenticated;
