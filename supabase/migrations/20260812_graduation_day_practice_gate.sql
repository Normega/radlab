-- Graduation Day (Phase 2, Day 12) — gate the intention follow-ups behind an
-- explicit yes/no.
--
-- Background: the four follow-up prompts (when / where / barrier / overcoming)
-- were authored with
--     "_note": "CONDITIONAL — only shown if Likert response is 2 or higher (not Never)."
-- `_note` is inert prose. InterventionPage never read it and navigation is
-- linear, so EVERY participant answered "When will you practice?" — including
-- anyone who had just answered "Never" on the likelihood slider. The intent was
-- in the data from the start; only the mechanism was missing.
--
-- This migration replaces the implicit Likert gate with an explicit one:
--
--   ...five open-ended reflections (unchanged)
--   NEW  training_response  key='will_practice'  Yes / No
--        slider   "How likely are you to use…"   show_if will_practice = Yes
--        when / where / barrier / overcoming     show_if will_practice = Yes
--        additional comments                     (always — common tail)
--        closing
--
-- The likelihood slider is kept but moves behind the gate: a participant who
-- says No never sees it, which also retires the "should 1 be 0/Never?" question
-- for that item — "never" is now the No branch, not a scale point.
--
-- `show_if` is implemented in src/components/study/InterventionPage.jsx and
-- references steps by authored `key`, never by position.

do $$
declare
  m         record;
  v_steps   jsonb;
  v_new     jsonb;
  v_cond    jsonb := jsonb_build_object('show_if', jsonb_build_object('key', 'will_practice', 'equals', 'Yes'));
  i         int;
begin
  for m in
    select module_id, definition from intervention_modules
     where phase = 'phase2' and lesson = 12
  loop
    v_steps := m.definition -> 'steps';

    -- Guard: this rewrite is positional, so refuse to run against a shape it
    -- wasn't written for rather than silently scrambling a module.
    if jsonb_array_length(v_steps) <> 12
       or (v_steps -> 5 ->> 'type') <> 'slider'
       or (v_steps -> 11 ->> 'type') <> 'closing'
    then
      raise exception 'Graduation Day gate: % has an unexpected step shape (len=%, step5=%, step11=%) — aborting',
        m.module_id, jsonb_array_length(v_steps), v_steps -> 5 ->> 'type', v_steps -> 11 ->> 'type';
    end if;

    -- Idempotence: skip a module that already carries the gate.
    if exists (
      select 1 from jsonb_array_elements(v_steps) s where s ->> 'key' = 'will_practice'
    ) then
      raise notice 'Graduation Day gate: % already gated, skipping', m.module_id;
      continue;
    end if;

    v_new := '[]'::jsonb;

    -- 0–4: the five open-ended reflections, untouched.
    for i in 0 .. 4 loop
      v_new := v_new || jsonb_build_array(v_steps -> i);
    end loop;

    -- 5: the new explicit gate.
    v_new := v_new || jsonb_build_array(jsonb_build_object(
      'type',    'training_response',
      'key',     'will_practice',
      'prompt',  'Do you think you will use any of these practices in your everyday life?',
      'options', jsonb_build_array('Yes', 'No')
    ));

    -- 6: the likelihood slider, now behind the gate.
    v_new := v_new || jsonb_build_array((v_steps -> 5) || v_cond);

    -- 7–10: the four intention follow-ups. `_note` is dropped — the condition
    -- it described is now real, and leaving stale prose next to live logic is
    -- exactly how this drifted in the first place.
    for i in 6 .. 9 loop
      v_new := v_new || jsonb_build_array(((v_steps -> i) - '_note') || v_cond);
    end loop;

    -- 11–12: additional comments + closing, both unconditional.
    v_new := v_new || jsonb_build_array(v_steps -> 10);
    v_new := v_new || jsonb_build_array(v_steps -> 11);

    update intervention_modules
       set definition = jsonb_set(m.definition, '{steps}', v_new)
     where module_id = m.module_id;

    raise notice 'Graduation Day gate applied: %', m.module_id;
  end loop;
end $$;
