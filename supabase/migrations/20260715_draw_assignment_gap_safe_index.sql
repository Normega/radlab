-- draw_assignment computed the next draw_index via COUNT(*) of existing rows
-- for (study_id, node_id). That's only correct if draw_index values are
-- dense/contiguous from 0 — which breaks permanently the moment ANY row for
-- that slot is ever deleted (a gap), since a later COUNT(*) recomputation
-- collides with an already-used index and raises unique_violation forever
-- after (the function's own unique_violation handler only covers the
-- caller's own already-existing row, not "a DIFFERENT participant already
-- holds this exact index" — it re-raises in that case).
--
-- Found live 2026-07-15: cleaning up a synthetic test participant on the new
-- "Liliana Study 3 - Live Test" study deleted their participant_assignments
-- row for the cb_p1 counterbalance (index 1 of 0,1,2,3), leaving indices
-- 0,2,3. The next real auto-enroll attempt computed COUNT=3, collided with
-- the existing index-3 row, and 500'd with "Failed to schedule this study
-- for the participant" -- which would have blocked every subsequent
-- enrollment on this slot, forever, not just the one attempt.
--
-- Fix: COALESCE(MAX(draw_index), -1) + 1 instead of COUNT(*). Identical
-- result in the normal (no-gap) case (dense 0..n-1 means count == max+1);
-- gap-safe going forward -- always produces a new, never-before-used index,
-- monotonically increasing, so a historical gap can never cause a
-- collision again. A single skipped slot shifts that one cycle's balance
-- bookkeeping by one position, which is a far smaller cost than a
-- permanently unrecoverable collision blocking every future participant.

CREATE OR REPLACE FUNCTION public.draw_assignment(p_study_id uuid, p_slot_key text, p_participant_id uuid DEFAULT NULL::uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  select * into v_existing
    from participant_assignments
    where study_id = p_study_id
      and participant_id = v_participant
      and node_id = p_slot_key;
  if found then
    return jsonb_build_object('value', v_existing.value, 'draw_index', v_existing.draw_index);
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_study_id::text || ':' || p_slot_key, 0));

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

  if v_arms is null then
    select elem into v_node
      from studies s, jsonb_array_elements(s.design_graph -> 'nodes') elem
      where s.id = p_study_id and elem ->> 'id' = p_slot_key;

    if v_node is null then
      raise exception 'draw_assignment: slot "%" not found in assignment_slots or design_graph', p_slot_key;
    end if;

    if v_node ->> 'type' = 'randomize' then
      v_kind := 'randomize';
      select jsonb_agg(arm -> 'group') into v_arms
        from jsonb_array_elements(v_node -> 'arms') arm,
             generate_series(1, coalesce((arm ->> 'weight')::int, 1));

    elsif v_node ->> 'type' = 'counterbalance' then
      v_kind := 'counterbalance';

      if jsonb_array_length(v_node -> 'block_ids') > 6 then
        raise exception 'draw_assignment: counterbalance "%" has more than 6 blocks (% ! permutations) — reduce block count', p_slot_key, jsonb_array_length(v_node -> 'block_ids');
      end if;

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

  select coalesce(max(draw_index), -1) + 1 into v_draw_index
    from participant_assignments
    where study_id = p_study_id and node_id = p_slot_key
      and draw_index is not null;

  v_n     := jsonb_array_length(v_arms);
  v_cycle := v_draw_index / v_n;
  v_pos   := v_draw_index % v_n;

  v_indices := array(select generate_series(0, v_n - 1));
  for v_i in reverse v_n - 1 .. 1 loop
    v_j := (('x' || substr(md5(v_seed || ':' || p_slot_key || ':' || v_cycle || ':' || v_i), 1, 6))::bit(24)::int) % (v_i + 1);
    v_tmp                  := v_indices[v_i + 1];
    v_indices[v_i + 1]     := v_indices[v_j + 1];
    v_indices[v_j + 1]     := v_tmp;
  end loop;

  v_value := v_arms -> v_indices[v_pos + 1];

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
$function$;
