-- Strip every `_note` field from intervention_modules step definitions.
--
-- WHY: `_note` reads like specification and is invisible to the renderer.
-- `InterventionPage` has never read the key. That gap has now cost two real
-- defects:
--
--   * Graduation Day (Phase 2 Day 12) — four intention follow-ups carried
--     "CONDITIONAL — only shown if Likert response is 2 or higher (not Never)".
--     Nothing gated them, so every participant answered "When will you
--     practice?" including those who had just said they never would.
--     (Fixed 2026-08-12 by `20260812_graduation_day_practice_gate.sql`, which
--     introduced a real `show_if` key.)
--   * Non-reactivity Phase 2 Day 2 — the 5-4-3-2-1 grounding exercise's five
--     `multi_response` steps each say "all required before Next unlocks", but
--     none sets `min_required`, and the renderer gates on `min_required ?? 1`.
--     One word per screen advances. Found 2026-08-16 auditing all 48 modules.
--
-- Norm's call (2026-08-17): remove the notes, and do NOT implement the
-- deviations they describe — every module keeps the standard measurement
-- experience. Concretely, and deliberately:
--
--   * The 5-4-3-2-1 steps stay at the default minimum of one filled box.
--     They are NOT tightened to `min_required = count`. Standard behaviour
--     beats a bespoke per-module rule that exists only in a comment.
--   * `reappraisal-phase2-day7`'s first slider stays REQUIRED. Its note said
--     "Next always enabled (slider interaction not required)", which was true
--     before NoDefaultSlider and is now deliberately false: an untouched
--     slider used to record a silent 4, and that pre/post pair was the case
--     that exposed it. The note described the old world.
--
-- Documentation belongs with the renderer, which is the only thing that
-- decides behaviour. The full inventory of what is deleted here (19 steps
-- across 6 modules) is preserved below so nothing is lost:
--
--   non-reactivity-phase2-day2   × 5  multi_response  "renders N numbered single-line input boxes, all required before Next unlocks"
--   reappraisal-phase2-day3      × 1  trigger_map     "6 expandable category tiles … at least 1 category must be filled"
--   reappraisal-phase2-day5      × 3  multi_response / thought_rating / thought_choice — dynamic chaining of entered thoughts
--   reappraisal-phase2-day6      × 4  as day5, plus training_response_multi "checkbox not radio, ≥1 selection"
--   reappraisal-phase2-day7      × 4  slider          "6-point labelled scale" (one adds the stale "Next always enabled")
--   self-compassion-phase2-day1  × 2  video           "Source path had double-l typo (lliliana/). Corrected to liliana/ — please verify."
--                                     training_response "single-select with open 'Other' … reveals a single-line text field"
--
-- Both self-compassion-day1 claims were checked before deleting and are
-- accurate/resolved: the option carries `has_text_field: true` with a
-- placeholder, and the video resolves to
-- `liliana/0356f6de_selfcompassion_phase2_day1_resampled.mp4` — zero of the 38
-- `video_library` rows hold a double-l path, so that standing "please verify"
-- is answered.
--
-- Renderer-safe by construction: `InterventionPage` reads `type` and the
-- per-type keys, never `_note`, so removing it cannot change what a
-- participant sees. No `min_required`, `show_if` or other behavioural key is
-- touched by this migration.

do $$
declare
  m       record;
  v_steps jsonb;
  v_new   jsonb;
  i       int;
  v_total int := 0;
begin
  for m in
    select module_id, definition from intervention_modules
     where definition -> 'steps' @? '$[*]._note'
  loop
    v_steps := m.definition -> 'steps';
    v_new   := '[]'::jsonb;

    for i in 0 .. jsonb_array_length(v_steps) - 1 loop
      if (v_steps -> i) ? '_note' then
        v_total := v_total + 1;
      end if;
      -- `- '_note'` on a non-holder is a harmless no-op, so every step is
      -- rebuilt the same way and order is preserved exactly.
      v_new := v_new || jsonb_build_array((v_steps -> i) - '_note');
    end loop;

    update intervention_modules
       set definition = jsonb_set(m.definition, '{steps}', v_new)
     where module_id = m.module_id;

    raise notice 'stripped _note from %', m.module_id;
  end loop;

  raise notice 'total _note fields removed: %', v_total;
end $$;
