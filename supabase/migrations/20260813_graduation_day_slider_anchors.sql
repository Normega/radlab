-- Graduation Day (Phase 2, Day 12) — reword the likelihood slider's span.
--
-- Context: `20260812_graduation_day_practice_gate.sql` put this slider behind an
-- explicit yes/no ("Do you think you will use any of these practices in your
-- everyday life?"). That changed who sees it. It is now asked *only* of people
-- who have already answered Yes — so "Never" as the bottom anchor is no longer
-- a reachable answer for anyone who reaches the item, and asking someone who
-- just said Yes to rate themselves against "Never" reads as a contradiction.
--
-- Norm's call (2026-08-13): 1 becomes "Rarely" and the rest of the span is
-- worded to match, rather than leaving 2–5 unlabelled for participants to
-- interpolate.
--
--   1 Rarely   2 Occasionally   3 Sometimes   4 Often   5 Very often   6 Almost always
--
-- Vague quantifiers rather than concrete rates ("about once a week"): the item
-- asks how *likely* someone is to use the practices, not how often they will,
-- and short words tile under six ticks on a phone where rates would not.
-- Swapping the item to a frequency measure is a separate decision for Liliana.
--
-- `point_labels` is rendered by NoDefaultSlider (pointLabels prop) beneath each
-- tick; `min_label`/`max_label` are kept as the fallback for any renderer or
-- preview that predates that support, and are updated to match so the two can
-- never disagree.

do $$
declare
  m       record;
  v_steps jsonb;
  v_idx   int;
  v_step  jsonb;
  v_new   jsonb := jsonb_build_object(
    'point_labels', jsonb_build_array(
      'Rarely', 'Occasionally', 'Sometimes', 'Often', 'Very often', 'Almost always'
    ),
    'min_label', 'Rarely',
    'max_label', 'Almost always'
  );
begin
  for m in
    select module_id, definition from intervention_modules
     where phase = 'phase2' and lesson = 12
  loop
    v_steps := m.definition -> 'steps';

    -- Locate the slider by type, not by position: the gate migration already
    -- shifted its index once, and hardcoding 6 here would silently rewrite
    -- whatever lands there next time the module is edited.
    v_idx := null;
    for i in 0 .. jsonb_array_length(v_steps) - 1 loop
      if (v_steps -> i ->> 'type') = 'slider' then
        if v_idx is not null then
          raise exception 'Graduation Day anchors: % has more than one slider — refusing to guess', m.module_id;
        end if;
        v_idx := i;
      end if;
    end loop;

    if v_idx is null then
      raise exception 'Graduation Day anchors: % has no slider step', m.module_id;
    end if;

    v_step := v_steps -> v_idx;

    -- Sanity: the labels below assume a 1..6 scale.
    if (v_step ->> 'min') <> '1' or (v_step ->> 'max') <> '6' then
      raise exception 'Graduation Day anchors: % slider is %..%, not 1..6 — labels would misalign',
        m.module_id, v_step ->> 'min', v_step ->> 'max';
    end if;

    update intervention_modules
       set definition = jsonb_set(m.definition, array['steps', v_idx::text], v_step || v_new)
     where module_id = m.module_id;

    raise notice 'Graduation Day slider anchors applied: % (step %)', m.module_id, v_idx;
  end loop;
end $$;
