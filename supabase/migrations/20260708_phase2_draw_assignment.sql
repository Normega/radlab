-- Phase 2: extend draw_assignment to serve longitudinal randomize/counterbalance
-- fork nodes from design_graph, in addition to the existing single-shot
-- assignment_slots path. Additive only — no existing behavior changes for
-- callers that don't pass p_participant_id.
--
-- Two new capabilities:
--   1. p_participant_id: lets a service-role caller (the materializer, running
--      under the same admin client auto-enroll already uses) draw on behalf
--      of a specific participant, since the materializer has no auth.uid().
--      Single-shot client calls keep using auth.uid() exactly as before.
--   2. design_graph fallback: when a slot isn't in studies.assignment_slots,
--      look up a design_graph node by id. `randomize` nodes expand arms by
--      weight into a flat array (reuses the existing shuffle unchanged);
--      `counterbalance` nodes draw one full permutation of block_ids (the
--      same shuffle-and-pick-one code balances across permutations for free).

-- CREATE OR REPLACE matches on the parameter list, not the function name —
-- adding a third parameter would otherwise create an ambiguous overload
-- alongside the existing 2-arg function rather than replacing it (PostgREST
-- calls by named args, so a 2-arg call would then match both signatures).
drop function if exists draw_assignment(uuid, text);

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

  select count(*) into v_draw_index
    from participant_assignments
    where study_id = p_study_id and node_id = p_slot_key;

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
