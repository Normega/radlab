-- 5-4-3-2-1 grounding exercise — require every box the prompt asks for.
--
-- `non-reactivity-phase2-day2`'s five `multi_response` steps each name an exact
-- number ("write down 3 things I can hear") and render that many input boxes,
-- but none set `min_required`. `InterventionPage` gates on `min_required ?? 1`,
-- so one filled box advanced the screen: the exercise whose entire content is
-- the descending count of five, four, three, two, one was asking for one, one,
-- one, one, one.
--
-- The requirement had been written down — as `"_note": "… all required before
-- Next unlocks"` — but `_note` is invisible to the renderer. All 19 such notes
-- were stripped corpus-wide in `20260817_strip_intervention_note_fields.sql`;
-- this migration is the other half, putting the one real requirement among them
-- into a key the code actually reads. Norm, 2026-08-17: "if it asks for 3,
-- let's get 3."
--
-- SCOPE IS DELIBERATELY THIS ONE MODULE. The other two `multi_response` steps
-- in the corpus (`reappraisal-phase2-day5` / `-day6`) read "List **all** of
-- your automatic thoughts regarding the stressful situation" with `count: 3`
-- and `min_required: 1` already set. There, 3 is a *ceiling* on how many
-- thoughts someone might have, not a quota — forcing three would make
-- participants invent thoughts they do not hold, which corrupts the measure
-- rather than tightening it. `count` means "how many boxes to draw"; whether
-- it is also a floor depends on whether the prompt names a number, which is a
-- judgement no migration should try to infer. Hence the explicit module id
-- rather than a corpus-wide `min_required = count`.

do $$
declare
  v_module text := 'non-reactivity-phase2-day2';
  v_steps  jsonb;
  v_new    jsonb;
  v_def    jsonb;
  i        int;
  v_step   jsonb;
  v_fixed  int := 0;
begin
  select definition into v_def from intervention_modules where module_id = v_module;
  if v_def is null then
    raise exception 'grounding count: module % not found', v_module;
  end if;

  v_steps := v_def -> 'steps';
  v_new   := '[]'::jsonb;

  for i in 0 .. jsonb_array_length(v_steps) - 1 loop
    v_step := v_steps -> i;

    if (v_step ->> 'type') = 'multi_response' then
      if (v_step ->> 'count') is null then
        raise exception 'grounding count: step % has no count to require', i;
      end if;
      -- Only fill an absent minimum. An explicit `min_required` is somebody's
      -- deliberate decision and must not be overwritten by this sweep.
      if (v_step ->> 'min_required') is null then
        v_step  := v_step || jsonb_build_object('min_required', (v_step ->> 'count')::int);
        v_fixed := v_fixed + 1;
      end if;
    end if;

    v_new := v_new || jsonb_build_array(v_step);
  end loop;

  update intervention_modules
     set definition = jsonb_set(v_def, '{steps}', v_new)
   where module_id = v_module;

  raise notice 'grounding count: % step(s) now require their full count', v_fixed;
end $$;
