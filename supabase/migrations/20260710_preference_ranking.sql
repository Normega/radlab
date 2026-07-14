-- WP-L5b: preference is a full #1–#3 ranking (methods doc Appendix 16),
-- captured by ALL midpoint groups and distinct from the choice act.
--
-- - liliana_midpoint_feedback gains preference_ranking (ordered jsonb array
--   of the three practice keys, rank 1 first). stated_preference = rank #1.
-- - record_practice_decision gains p_ranking. Choice groups pass their
--   ranking + their (possibly different) selection; the anti-preference group
--   passes the ranking and p_practice must equal rank #1 — assignment stays
--   a seeded 50/50 among the non-rank-1 arms ("2nd or 3rd preference with
--   equal probability").
--
-- Signature change (3-arg -> 4-arg with default) requires dropping the old
-- function first: CREATE OR REPLACE would create an ambiguous overload.

ALTER TABLE liliana_midpoint_feedback ADD COLUMN IF NOT EXISTS preference_ranking jsonb;

DROP FUNCTION IF EXISTS record_practice_decision(text, text, text);

create or replace function record_practice_decision(
  p_practice text,
  p_source   text,
  p_node_id  text  default null,
  p_ranking  jsonb default null
)
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
  v_node_id  text := p_node_id;
  v_n_nodes  int;
  v_n_arms   int;
  v_valid    boolean;
  v_existing participant_assignments%rowtype;
  v_seed     text;
  v_others   text[];
  v_pick     int;
  v_kind     text;
  v_final    text;
  v_pref     text;
begin
  if v_profile is null then
    raise exception 'record_practice_decision: not authenticated';
  end if;
  if p_source not in ('choice', 'anti_preference') then
    raise exception 'record_practice_decision: p_source must be ''choice'' or ''anti_preference''';
  end if;

  select * into v_lp from liliana_participants where profile_id = v_profile;
  if not found then
    raise exception 'record_practice_decision: no liliana_participants row for this user';
  end if;

  select * into v_snap from liliana_midpoint_feedback where participant_id = v_lp.id;
  if not found then
    raise exception 'record_practice_decision: no midpoint snapshot — call get_liliana_midpoint_summary first';
  end if;

  if v_snap.decided_at is not null then
    return jsonb_build_object(
      'practice',           v_snap.phase2_practice,
      'stated_preference',  v_snap.stated_preference,
      'preference_ranking', v_snap.preference_ranking,
      'source',             v_snap.phase2_source,
      'decided_at',         v_snap.decided_at,
      'already_decided',    true
    );
  end if;

  if v_snap.midpoint_group is not null then
    if p_source = 'choice' and v_snap.midpoint_group not in ('feedback_choice', 'control_choice') then
      raise exception 'record_practice_decision: group "%" does not choose', v_snap.midpoint_group;
    end if;
    if p_source = 'anti_preference' and v_snap.midpoint_group <> 'control_assigned' then
      raise exception 'record_practice_decision: group "%" is not preference-assigned', v_snap.midpoint_group;
    end if;
  end if;

  if v_node_id is null then
    select count(*) into v_n_nodes
      from studies s, jsonb_array_elements(s.design_graph -> 'nodes') elem
      where s.id = v_lp.study_id and elem ->> 'type' = 'randomize';
    if v_n_nodes <> 1 then
      raise exception 'record_practice_decision: % randomize nodes in the design — pass p_node_id explicitly', v_n_nodes;
    end if;
    select elem ->> 'id' into v_node_id
      from studies s, jsonb_array_elements(s.design_graph -> 'nodes') elem
      where s.id = v_lp.study_id and elem ->> 'type' = 'randomize';
  end if;

  select elem into v_node
    from studies s, jsonb_array_elements(s.design_graph -> 'nodes') elem
    where s.id = v_lp.study_id and elem ->> 'id' = v_node_id;
  if v_node is null or v_node ->> 'type' <> 'randomize' then
    raise exception 'record_practice_decision: "%" is not a randomize node in the study design', v_node_id;
  end if;

  select count(distinct arm ->> 'group') into v_n_arms
    from jsonb_array_elements(v_node -> 'arms') arm;

  -- Ranking validation: array of all the node's arms, no duplicates or gaps.
  if p_ranking is not null then
    if jsonb_typeof(p_ranking) <> 'array' or jsonb_array_length(p_ranking) <> v_n_arms then
      raise exception 'record_practice_decision: p_ranking must be an array of all % arms', v_n_arms;
    end if;
    select count(distinct r.value) = v_n_arms
       and bool_and(exists (
         select 1 from jsonb_array_elements(v_node -> 'arms') arm
         where arm ->> 'group' = r.value #>> '{}'
       ))
    into v_valid
    from jsonb_array_elements(p_ranking) r;
    if not v_valid then
      raise exception 'record_practice_decision: p_ranking must contain each arm of node "%" exactly once', v_node_id;
    end if;
    if p_source = 'anti_preference' and (p_ranking ->> 0) <> p_practice then
      raise exception 'record_practice_decision: anti-preference p_practice must equal the #1-ranked arm';
    end if;
  end if;

  -- p_practice (choice or stated preference) must be one of the node's arms.
  select exists (
    select 1 from jsonb_array_elements(v_node -> 'arms') arm
    where arm ->> 'group' = p_practice
  ) into v_valid;
  if not v_valid then
    raise exception 'record_practice_decision: practice "%" is not an arm of node "%"', p_practice, v_node_id;
  end if;

  if p_source = 'choice' then
    v_kind  := 'choice';
    v_final := p_practice;
  else
    select array_agg(distinct arm ->> 'group' order by arm ->> 'group') into v_others
      from jsonb_array_elements(v_node -> 'arms') arm
      where arm ->> 'group' <> p_practice;
    if v_others is null or array_length(v_others, 1) < 2 then
      raise exception 'record_practice_decision: node "%" needs at least 2 non-preferred arms for anti-preference assignment', v_node_id;
    end if;

    select coalesce(design_seed, v_lp.study_id::text) into v_seed
      from studies where id = v_lp.study_id;
    v_pick  := (('x' || substr(md5(v_seed || ':' || v_node_id || ':' || v_profile::text), 1, 6))::bit(24)::int)
               % array_length(v_others, 1);
    v_kind  := 'anti_preference';
    v_final := v_others[v_pick + 1];
  end if;

  insert into participant_assignments
    (participant_id, study_id, node_id, kind, value, draw_index)
  values
    (v_profile, v_lp.study_id, v_node_id, v_kind, to_jsonb(v_final), null)
  on conflict (study_id, participant_id, node_id) do nothing;

  select * into v_existing
    from participant_assignments
    where study_id = v_lp.study_id and participant_id = v_profile and node_id = v_node_id;
  v_final := v_existing.value #>> '{}';

  -- Stated preference = rank #1 when a ranking was captured; otherwise the
  -- participant's direct input (choice = their selection).
  v_pref := coalesce(p_ranking ->> 0, p_practice);

  update liliana_midpoint_feedback
    set phase2_practice    = v_final,
        stated_preference  = v_pref,
        preference_ranking = p_ranking,
        phase2_source      = p_source,
        decided_at         = now()
    where id = v_snap.id;

  update liliana_participants
    set midpoint_completed_at = coalesce(midpoint_completed_at, now())
    where id = v_lp.id;

  return jsonb_build_object(
    'practice',           v_final,
    'stated_preference',  v_pref,
    'preference_ranking', p_ranking,
    'source',             p_source,
    'decided_at',         now()
  );
end;
$$;

revoke execute on function record_practice_decision(text, text, text, jsonb) from public, anon;
grant  execute on function record_practice_decision(text, text, text, jsonb) to authenticated;
