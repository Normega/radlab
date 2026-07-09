-- WP-L3 (Liliana feedback spec, docs/markdowns/liliana_feedback_spec.md):
-- session-quality metrics view, midpoint feedback snapshot table, summary +
-- decision RPCs, and the draw_assignment cycle-count patch that keeps
-- participant choices from corrupting balanced draws.

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Choice rows in participant_assignments carry no draw index.
--    (unique (study_id, node_id, draw_index) treats NULLs as distinct, so
--    any number of choice rows coexist with drawn rows.)
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE participant_assignments ALTER COLUMN draw_index DROP NOT NULL;

-- kind gains 'choice' (participant-made decisions, vs drawn assignments).
-- Caught by live testing: the WP1 CHECK only allowed randomize/counterbalance.
ALTER TABLE participant_assignments DROP CONSTRAINT participant_assignments_kind_check;
ALTER TABLE participant_assignments ADD CONSTRAINT participant_assignments_kind_check
  CHECK (kind = ANY (ARRAY['randomize'::text, 'counterbalance'::text, 'choice'::text]));

-- Fix-up from WP-L1: the schedule FK had no ON DELETE action, which would
-- have blocked the existing study-delete cascade (participant_schedule rows
-- can't be removed while responses reference them). Keep the response, drop
-- the link.
ALTER TABLE vas_responses DROP CONSTRAINT vas_responses_schedule_id_fkey;
ALTER TABLE vas_responses ADD CONSTRAINT vas_responses_schedule_id_fkey
  FOREIGN KEY (schedule_id) REFERENCES participant_schedule(id) ON DELETE SET NULL;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. draw_assignment: cycle position counts only *drawn* rows.
--    A participant's recorded choice (kind='choice', draw_index null) at the
--    same fork node must not consume a permuted-block cycle position, or the
--    owl-placement draws for the control_assigned group lose their balance.
--    Only the count query changes; everything else is byte-identical to
--    20260708_phase2_draw_assignment.sql.
-- ────────────────────────────────────────────────────────────────────────────

create or replace function draw_assignment(p_study_id uuid, p_slot_key text, p_participant_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_participant uuid;
  v_existing    participant_assignments%rowtype;
  v_arms        jsonb;
  v_kind        text := 'randomize';
  v_node        jsonb;
  v_seed        text;
  v_draw_index  int;
  v_n           int;
  v_cycle       int;
  v_pos         int;
  v_indices     int[];
  v_i           int;
  v_j           int;
  v_tmp         int;
  v_value       jsonb;
begin
  if p_participant_id is not null then
    if auth.role() <> 'service_role' then
      raise exception 'draw_assignment: p_participant_id override requires service_role';
    end if;
    v_participant := p_participant_id;
  else
    v_participant := auth.uid();
    if v_participant is null then
      raise exception 'draw_assignment: not authenticated';
    end if;
  end if;

  -- Idempotency: return the existing assignment if one exists.
  select * into v_existing
    from participant_assignments
    where study_id = p_study_id
      and participant_id = v_participant
      and node_id = p_slot_key;
  if found then
    return jsonb_build_object('value', v_existing.value, 'draw_index', v_existing.draw_index);
  end if;

  -- Serialize concurrent draws on this (study, slot); draw_index counting
  -- below is only safe under this lock.
  perform pg_advisory_xact_lock(hashtextextended(p_study_id::text || ':' || p_slot_key, 0));

  -- Re-check after acquiring the lock (race window before it).
  select * into v_existing
    from participant_assignments
    where study_id = p_study_id
      and participant_id = v_participant
      and node_id = p_slot_key;
  if found then
    return jsonb_build_object('value', v_existing.value, 'draw_index', v_existing.draw_index);
  end if;

  select assignment_slots -> p_slot_key into v_arms
    from studies where id = p_study_id;

  -- Phase 2: slot not in assignment_slots (single-shot) — look it up as a
  -- design_graph node (longitudinal randomize/counterbalance).
  if v_arms is null then
    select elem into v_node
      from studies s, jsonb_array_elements(s.design_graph -> 'nodes') elem
      where s.id = p_study_id and elem ->> 'id' = p_slot_key;

    if v_node is null then
      raise exception 'draw_assignment: slot "%" not found in assignment_slots or design_graph', p_slot_key;
    end if;

    if v_node ->> 'type' = 'randomize' then
      v_kind := 'randomize';
      -- Expand each arm's group, repeated `weight` times (default 1), into a
      -- flat array — the existing shuffle-and-pick-one code below is unchanged.
      select jsonb_agg(arm -> 'group') into v_arms
        from jsonb_array_elements(v_node -> 'arms') arm,
             generate_series(1, coalesce((arm ->> 'weight')::int, 1));

    elsif v_node ->> 'type' = 'counterbalance' then
      v_kind := 'counterbalance';

      if jsonb_array_length(v_node -> 'block_ids') > 6 then
        raise exception 'draw_assignment: counterbalance "%" has more than 6 blocks (% ! permutations) — reduce block count', p_slot_key, jsonb_array_length(v_node -> 'block_ids');
      end if;

      -- One arm per full permutation of block_ids; picking one via the same
      -- shuffle-and-pick-one code balances assignment across permutations.
      with recursive perms as (
        select jsonb_build_array(elem) as perm, jsonb_build_array(elem) as used
          from jsonb_array_elements(v_node -> 'block_ids') elem
        union all
        select p.perm || elem, p.used || elem
          from perms p, jsonb_array_elements(v_node -> 'block_ids') elem
          where not (p.used @> jsonb_build_array(elem))
            and jsonb_array_length(p.perm) < jsonb_array_length(v_node -> 'block_ids')
      )
      select jsonb_agg(perm) into v_arms
        from perms
        where jsonb_array_length(perm) = jsonb_array_length(v_node -> 'block_ids');

    else
      raise exception 'draw_assignment: node "%" is not a randomize or counterbalance node', p_slot_key;
    end if;
  end if;

  if v_arms is null or jsonb_typeof(v_arms) <> 'array' or jsonb_array_length(v_arms) < 2 then
    raise exception 'draw_assignment: slot "%" has no valid arms (need a jsonb array of >= 2)', p_slot_key;
  end if;

  select coalesce(design_seed, p_study_id::text) into v_seed
    from studies where id = p_study_id;

  -- WP-L3: count only drawn rows. Decision rows (kind='choice') have a null
  -- draw_index and must not consume permuted-block cycle positions.
  select count(*) into v_draw_index
    from participant_assignments
    where study_id = p_study_id and node_id = p_slot_key
      and draw_index is not null;

  v_n     := jsonb_array_length(v_arms);
  v_cycle := v_draw_index / v_n;
  v_pos   := v_draw_index % v_n;

  -- Deterministic Fisher-Yates over arm indices 0..n-1, seeded from
  -- (seed, slot, cycle, step). 24 hex-derived bits per step keeps the cast
  -- positive; modulo bias over <= dozens of arms is negligible.
  v_indices := array(select generate_series(0, v_n - 1));
  for v_i in reverse v_n - 1 .. 1 loop
    v_j := (('x' || substr(md5(v_seed || ':' || p_slot_key || ':' || v_cycle || ':' || v_i), 1, 6))::bit(24)::int) % (v_i + 1);
    v_tmp                  := v_indices[v_i + 1];
    v_indices[v_i + 1]     := v_indices[v_j + 1];
    v_indices[v_j + 1]     := v_tmp;
  end loop;

  v_value := v_arms -> v_indices[v_pos + 1];

  -- Belt and braces: if another path inserted despite the lock, return theirs.
  begin
    insert into participant_assignments
      (participant_id, study_id, node_id, kind, value, draw_index)
    values
      (v_participant, p_study_id, p_slot_key, v_kind, v_value, v_draw_index);
  exception when unique_violation then
    select * into v_existing
      from participant_assignments
      where study_id = p_study_id
        and participant_id = v_participant
        and node_id = p_slot_key;
    if found then
      return jsonb_build_object('value', v_existing.value, 'draw_index', v_existing.draw_index);
    end if;
    raise;
  end;

  return jsonb_build_object('value', v_value, 'draw_index', v_draw_index);
end;
$$;

revoke execute on function draw_assignment(uuid, text, uuid) from public, anon;
grant  execute on function draw_assignment(uuid, text, uuid) to authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. liliana_session_metrics — one row per attempted training day, with the
--    six check-in ratings pivoted into columns plus derived delta_stress and
--    appraisal. Raw ingredients live in vas_responses; the metric definition
--    lives here and in the RPC, so it can change without a data migration.
--
--    Linkage: check-in responses carry (schedule_id, package_slug); the
--    schedule row's study_session -> session_template contains exactly one
--    training node, whose module_id matches liliana_day_data.module_id —
--    module is unique per participant-day in this design, so the pivot joins
--    by (profile, module) and is immune to any day-numbering drift between
--    participant_schedule.study_day and liliana_day_data.study_day.
--
--    security_invoker: lab sees everything; a participant querying directly
--    sees only their own day rows (and null ratings, since study_sessions is
--    lab-read — the participant-facing path is the SECURITY DEFINER RPC).
-- ────────────────────────────────────────────────────────────────────────────

create or replace view liliana_session_metrics
with (security_invoker = true) as
with mod_node as (
  select ss.id as study_session_id, max(stn.module_id) as module_id
  from study_sessions ss
  join session_template_nodes stn
    on stn.session_template_id = ss.session_template_id
   and stn.module_id is not null
  group by ss.id
),
latest as (
  -- newest response per (schedule, package, scale) — a reopened session
  -- re-answers its steps, appending rows
  select distinct on (vr.schedule_id, vr.package_slug, vr.scale_id)
    vr.user_id, vr.schedule_id, vr.package_slug, vs.slug as scale_slug, vr.value
  from vas_responses vr
  join vas_scales vs on vs.id = vr.scale_id
  where vr.schedule_id is not null
    and vr.package_slug in ('liliana_pre_intervention_ratings', 'liliana_post_intervention_ratings')
  order by vr.schedule_id, vr.package_slug, vr.scale_id, vr.responded_at desc
),
pivoted as (
  select
    l.user_id,
    mn.module_id,
    max(l.value) filter (where l.package_slug = 'liliana_pre_intervention_ratings'  and l.scale_slug = 'sleep')     as pre_sleep,
    max(l.value) filter (where l.package_slug = 'liliana_pre_intervention_ratings'  and l.scale_slug = 'stress')    as pre_stress,
    max(l.value) filter (where l.package_slug = 'liliana_post_intervention_ratings' and l.scale_slug = 'stress')    as post_stress,
    max(l.value) filter (where l.package_slug = 'liliana_post_intervention_ratings' and l.scale_slug = 'enjoyment') as enjoyment,
    max(l.value) filter (where l.package_slug = 'liliana_post_intervention_ratings' and l.scale_slug = 'helpful')   as helpful,
    max(l.value) filter (where l.package_slug = 'liliana_post_intervention_ratings' and l.scale_slug = 'effort')    as effort
  from latest l
  join participant_schedule ps on ps.id = l.schedule_id
  join mod_node mn on mn.study_session_id = ps.study_session_id
  group by l.user_id, mn.module_id
)
select
  lp.id                                as participant_id,
  lp.profile_id,
  lp.study_id,
  ldd.study_day,
  im.phase,
  im.condition,
  ldd.module_id,
  p.pre_sleep,
  p.pre_stress,
  p.post_stress,
  p.enjoyment,
  p.helpful,
  p.effort,
  (p.pre_stress - p.post_stress)       as delta_stress,
  (p.enjoyment + p.helpful) / 2.0      as appraisal,
  (ldd.completed_at is not null)       as completed,
  ldd.started_at,
  ldd.completed_at
from liliana_day_data ldd
join liliana_participants lp on lp.id = ldd.participant_id
left join intervention_modules im on im.module_id = ldd.module_id
left join pivoted p on p.user_id = lp.profile_id and p.module_id = ldd.module_id;

-- ────────────────────────────────────────────────────────────────────────────
-- 4. liliana_midpoint_feedback — immutable snapshot of what each participant's
--    midpoint summary contained (the feedback shown IS the manipulation, so
--    the exact numbers/ranking/metric version must be auditable). Written for
--    every participant regardless of midpoint group; shown_at is stamped only
--    when the feedback_choice group actually sees it.
-- ────────────────────────────────────────────────────────────────────────────

create table if not exists liliana_midpoint_feedback (
  id              uuid primary key default gen_random_uuid(),
  participant_id  uuid not null references liliana_participants(id) on delete cascade,
  profile_id      uuid not null,
  study_id        uuid,
  midpoint_group  text,
  metric_version  int  not null default 1,
  computed        jsonb not null,   -- per-condition: n, means, composite_v1/v2, low_n
  ranking         jsonb not null,   -- ordered [{rank, condition, ...}]
  created_at      timestamptz not null default now(),
  shown_at        timestamptz,      -- null for groups that never see the summary
  phase2_practice text,
  phase2_source   text check (phase2_source in ('choice', 'owl')),
  decided_at      timestamptz,
  unique (participant_id)
);

alter table liliana_midpoint_feedback enable row level security;

create policy "lab all"
  on liliana_midpoint_feedback
  for all
  to authenticated
  using (my_role() = 'lab')
  with check (my_role() = 'lab');

-- Participants read their own snapshot; all writes go through the
-- SECURITY DEFINER RPCs below (no participant INSERT/UPDATE policy).
create policy "own read"
  on liliana_midpoint_feedback
  for select
  to authenticated
  using (profile_id = auth.uid());

-- ────────────────────────────────────────────────────────────────────────────
-- 5. get_liliana_midpoint_summary — compute + snapshot (idempotent), return.
--    Metric v1: quality = (z(delta_stress) + z(appraisal)) / 2, z-scored
--    within-person over completed Phase 1 sessions; rank by mean quality per
--    condition. v2 (= mean delta_stress) is stored alongside for the pilot
--    bake-off. Ties break deterministically: v1 -> delta -> helpful -> seeded
--    hash. low_n flags conditions with < 2 usable sessions.
-- ────────────────────────────────────────────────────────────────────────────

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
        stddev_samp(appraisal)    as sd_a,
        count(*)                  as n_total
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
        row_number() over (
          order by composite_v1      desc nulls last,
                   mean_delta_stress desc nulls last,
                   mean_helpful      desc nulls last,
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
        'low_n',             (n < 2)
      ) order by rnk)
    into v_computed, v_ranking
    from ranked;

    -- midpoint group, if the 3-arm draw already happened
    select value #>> '{}' into v_group
      from participant_assignments
      where study_id = v_lp.study_id
        and participant_id = v_profile
        and node_id = 'midpoint_group';

    insert into liliana_midpoint_feedback
      (participant_id, profile_id, study_id, midpoint_group, metric_version, computed, ranking)
    values
      (v_lp.id, v_profile, v_lp.study_id, v_group, 1, v_computed, v_ranking)
    on conflict (participant_id) do nothing;

    select * into v_row from liliana_midpoint_feedback where participant_id = v_lp.id;
  end if;

  -- Backfill the group if it was drawn after the snapshot was created.
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

-- ────────────────────────────────────────────────────────────────────────────
-- 6. record_practice_decision — persist the Phase 2 practice decision.
--    'choice' (feedback_choice / control_choice groups): validates the arm
--    against the design_graph randomize node, writes the choice into
--    participant_assignments (kind='choice', draw_index null) so the existing
--    materializer routes Phase 2 with zero runtime changes.
--    'owl' (control_assigned group): the balanced draw at the fork node must
--    already exist (draw_assignment); this only stamps the snapshot.
--    Both paths: snapshot decided_at + liliana_participants.midpoint_completed_at.
--    Decisions are final — a second call returns the recorded decision.
-- ────────────────────────────────────────────────────────────────────────────

create or replace function record_practice_decision(p_node_id text, p_practice text, p_source text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile  uuid := auth.uid();
  v_lp       liliana_participants%rowtype;
  v_snap     liliana_midpoint_feedback%rowtype;
  v_node     jsonb;
  v_valid    boolean;
  v_existing participant_assignments%rowtype;
  v_final    text;
begin
  if v_profile is null then
    raise exception 'record_practice_decision: not authenticated';
  end if;
  if p_source not in ('choice', 'owl') then
    raise exception 'record_practice_decision: p_source must be ''choice'' or ''owl''';
  end if;

  select * into v_lp from liliana_participants where profile_id = v_profile;
  if not found then
    raise exception 'record_practice_decision: no liliana_participants row for this user';
  end if;

  select * into v_snap from liliana_midpoint_feedback where participant_id = v_lp.id;
  if not found then
    raise exception 'record_practice_decision: no midpoint snapshot — call get_liliana_midpoint_summary first';
  end if;

  -- Decisions are final.
  if v_snap.decided_at is not null then
    return jsonb_build_object(
      'practice', v_snap.phase2_practice,
      'source',   v_snap.phase2_source,
      'decided_at', v_snap.decided_at,
      'already_decided', true
    );
  end if;

  -- Group gating (when the 3-arm midpoint group is known).
  if v_snap.midpoint_group is not null then
    if p_source = 'choice' and v_snap.midpoint_group not in ('feedback_choice', 'control_choice') then
      raise exception 'record_practice_decision: group "%" does not choose', v_snap.midpoint_group;
    end if;
    if p_source = 'owl' and v_snap.midpoint_group <> 'control_assigned' then
      raise exception 'record_practice_decision: group "%" is not owl-assigned', v_snap.midpoint_group;
    end if;
  end if;

  if p_source = 'choice' then
    -- Arm must exist on the design_graph randomize node.
    select elem into v_node
      from studies s, jsonb_array_elements(s.design_graph -> 'nodes') elem
      where s.id = v_lp.study_id and elem ->> 'id' = p_node_id;
    if v_node is null or v_node ->> 'type' <> 'randomize' then
      raise exception 'record_practice_decision: "%" is not a randomize node in the study design', p_node_id;
    end if;
    select exists (
      select 1 from jsonb_array_elements(v_node -> 'arms') arm
      where arm ->> 'group' = p_practice
    ) into v_valid;
    if not v_valid then
      raise exception 'record_practice_decision: practice "%" is not an arm of node "%"', p_practice, p_node_id;
    end if;

    insert into participant_assignments
      (participant_id, study_id, node_id, kind, value, draw_index)
    values
      (v_profile, v_lp.study_id, p_node_id, 'choice', to_jsonb(p_practice), null)
    on conflict (study_id, participant_id, node_id) do nothing;

    select * into v_existing
      from participant_assignments
      where study_id = v_lp.study_id and participant_id = v_profile and node_id = p_node_id;
    v_final := v_existing.value #>> '{}';
  else
    -- owl: the balanced draw must already exist at the fork node.
    select * into v_existing
      from participant_assignments
      where study_id = v_lp.study_id and participant_id = v_profile and node_id = p_node_id;
    if not found then
      raise exception 'record_practice_decision: no assignment at node "%" — call draw_assignment first', p_node_id;
    end if;
    v_final := v_existing.value #>> '{}';
  end if;

  update liliana_midpoint_feedback
    set phase2_practice = v_final,
        phase2_source   = p_source,
        decided_at      = now()
    where id = v_snap.id;

  update liliana_participants
    set midpoint_completed_at = coalesce(midpoint_completed_at, now())
    where id = v_lp.id;

  return jsonb_build_object('practice', v_final, 'source', p_source, 'decided_at', now());
end;
$$;

revoke execute on function record_practice_decision(text, text, text) from public, anon;
grant  execute on function record_practice_decision(text, text, text) to authenticated;
