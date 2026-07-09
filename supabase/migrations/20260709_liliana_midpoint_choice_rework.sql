-- WP-L4 backend rework (Liliana feedback spec): midpoint group mechanics
-- finalized by Norm 2026-07-09.
--
--   feedback_choice  — personalized Phase 1 feedback, then free choice
--   control_choice   — control display (no data), then free choice
--   control_assigned — control display, participant STATES a preference, then
--                      is assigned to one of the two NON-preferred practices
--                      with equal probability (never the preferred one).
--                      Owl frames it: growth happens outside the comfort zone.
--
-- Changes from the WP-L3 shape:
--   - snapshot gains stated_preference (recorded for ALL groups: choosers'
--     selection doubles as their preference)
--   - phase2_source 'owl' becomes 'anti_preference' (self-describing)
--   - participant_assignments.kind gains 'anti_preference'
--   - record_practice_decision reworked: anti-preference draw happens inside
--     the RPC (deterministic 50/50 from the study seed), and the fork node is
--     auto-detected from design_graph so the client never reads the graph
--
-- Plus: activities gains the 'midpoint' category + the liliana_midpoint
-- activity row, so the step is placeable in SessionBuilder.

-- ── snapshot: stated preference + source rename ────────────────────────────

ALTER TABLE liliana_midpoint_feedback ADD COLUMN IF NOT EXISTS stated_preference text;

ALTER TABLE liliana_midpoint_feedback DROP CONSTRAINT liliana_midpoint_feedback_phase2_source_check;
ALTER TABLE liliana_midpoint_feedback ADD CONSTRAINT liliana_midpoint_feedback_phase2_source_check
  CHECK (phase2_source IN ('choice', 'anti_preference'));

-- ── participant_assignments: anti_preference kind ───────────────────────────

ALTER TABLE participant_assignments DROP CONSTRAINT participant_assignments_kind_check;
ALTER TABLE participant_assignments ADD CONSTRAINT participant_assignments_kind_check
  CHECK (kind = ANY (ARRAY['randomize'::text, 'counterbalance'::text, 'choice'::text, 'anti_preference'::text]));

-- ── record_practice_decision v2 ─────────────────────────────────────────────
-- p_practice: the participant's input — their CHOICE (choice groups) or their
-- STATED PREFERENCE (control_assigned).
-- p_node_id: optional; when null the unique randomize node in design_graph is
-- used (error if zero or several).

DROP FUNCTION IF EXISTS record_practice_decision(text, text, text);

create or replace function record_practice_decision(p_practice text, p_source text, p_node_id text default null)
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
  v_valid    boolean;
  v_existing participant_assignments%rowtype;
  v_seed     text;
  v_others   text[];
  v_pick     int;
  v_kind     text;
  v_final    text;
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

  -- Decisions are final.
  if v_snap.decided_at is not null then
    return jsonb_build_object(
      'practice',          v_snap.phase2_practice,
      'stated_preference', v_snap.stated_preference,
      'source',            v_snap.phase2_source,
      'decided_at',        v_snap.decided_at,
      'already_decided',   true
    );
  end if;

  -- Group gating (when the 3-arm midpoint group is known).
  if v_snap.midpoint_group is not null then
    if p_source = 'choice' and v_snap.midpoint_group not in ('feedback_choice', 'control_choice') then
      raise exception 'record_practice_decision: group "%" does not choose', v_snap.midpoint_group;
    end if;
    if p_source = 'anti_preference' and v_snap.midpoint_group <> 'control_assigned' then
      raise exception 'record_practice_decision: group "%" is not preference-assigned', v_snap.midpoint_group;
    end if;
  end if;

  -- Resolve the Phase 2 fork node.
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
    -- Anti-preference: uniform pick among the non-preferred arms, seeded
    -- deterministically from (study seed, node, participant) for
    -- reproducibility. Never the stated preference.
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

  -- If an assignment already existed (re-entry race), it wins.
  select * into v_existing
    from participant_assignments
    where study_id = v_lp.study_id and participant_id = v_profile and node_id = v_node_id;
  v_final := v_existing.value #>> '{}';

  update liliana_midpoint_feedback
    set phase2_practice   = v_final,
        stated_preference = p_practice,
        phase2_source     = p_source,
        decided_at        = now()
    where id = v_snap.id;

  update liliana_participants
    set midpoint_completed_at = coalesce(midpoint_completed_at, now())
    where id = v_lp.id;

  return jsonb_build_object(
    'practice',          v_final,
    'stated_preference', p_practice,
    'source',            p_source,
    'decided_at',        now()
  );
end;
$$;

revoke execute on function record_practice_decision(text, text, text) from public, anon;
grant  execute on function record_practice_decision(text, text, text) to authenticated;

-- ── midpoint step placeable in SessionBuilder ───────────────────────────────

ALTER TABLE activities DROP CONSTRAINT activities_category_check;
ALTER TABLE activities ADD CONSTRAINT activities_category_check
  CHECK (category = ANY (ARRAY['form'::text, 'game'::text, 'questionnaire'::text, 'physio'::text, 'training'::text, 'vas'::text, 'display'::text, 'midpoint'::text]));

INSERT INTO activities (category, subcategory, label, description)
VALUES ('midpoint', 'liliana_midpoint', 'Midpoint Feedback & Choice',
        'Liliana Study 3: 3-arm midpoint step — feedback/control display, practice choice or anti-preference assignment')
ON CONFLICT (category, subcategory) DO NOTHING;
