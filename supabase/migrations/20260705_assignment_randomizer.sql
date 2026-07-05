-- Assignment randomizer: shared draw primitive for condition assignment
-- Single-shot studies draw via RPC at session entry; longitudinal randomize
-- nodes (P2) will call the same function from the materializer/completion hook.
-- Spec: randomizer_spec.md / randomizer_implementation_brief.md

-- studies: named slots with arms, e.g. { "condition": ["A","B","C"] }
-- Used by single-shot studies only; longitudinal arms live in design_graph.
alter table studies
  add column if not exists assignment_slots jsonb;

-- One assignment per participant per slot: makes draws idempotent under
-- refresh and re-entry. WP0 verified no existing rows violate this.
create unique index if not exists participant_assignments_one_per_slot
  on participant_assignments (study_id, participant_id, node_id);

-- ── draw_assignment ──────────────────────────────────────────────────────────
-- Permuted-block draw. Deterministic from (seed, slot, cycle): each block of
-- n_arms draws is a full permutation of the arms, reshuffled every cycle so an
-- RA cannot predict the next arm. Arms are read server-side; the client can
-- neither supply nor alter them.

create or replace function draw_assignment(p_study_id uuid, p_slot_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_participant uuid;
  v_existing    participant_assignments%rowtype;
  v_arms        jsonb;
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
  v_participant := auth.uid();
  if v_participant is null then
    raise exception 'draw_assignment: not authenticated';
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

  -- P2 extension point: when v_arms is null, look up a design_graph randomize
  -- node whose id = p_slot_key and read its arms. Not implemented in P1.

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
      (v_participant, p_study_id, p_slot_key, 'randomize', v_value, v_draw_index);
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

revoke execute on function draw_assignment(uuid, text) from public, anon;
grant  execute on function draw_assignment(uuid, text) to authenticated;

-- ── assignment_balance ───────────────────────────────────────────────────────
-- Counts per (study, slot, arm) for pilot verification and the P2 balance
-- audit. security_invoker so the underlying table's RLS applies to the caller.

create or replace view assignment_balance
  with (security_invoker = true)
as
select study_id, node_id, value, count(*) as n
from participant_assignments
group by study_id, node_id, value
order by study_id, node_id, value;

-- ── Verification (run manually, do not commit results) ──────────────────────
-- The shuffle is pure SQL; this reproduces it standalone. For a 3-arm slot
-- with seed 'testseed', slot 'condition': cycles 0 and 1 each emit a full
-- permutation of {0,1,2} (balanced blocks), and re-running yields identical
-- output (determinism).
--
-- with params as (select 'testseed'::text as seed, 'condition'::text as slot, 3 as n),
-- draws as (select d as draw_index, d / (select n from params) as cycle, d % (select n from params) as pos
--           from generate_series(0, 5) d)
-- select draw_index, cycle, pos from draws;
--
-- Then for each cycle, apply the loop by hand or call draw_assignment six
-- times as six different participants and check assignment_balance shows
-- n = 2 for each of the three arms.
