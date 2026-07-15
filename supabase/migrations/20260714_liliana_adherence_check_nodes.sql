-- Insert the two adherence_check gate nodes into Liliana Study 3's live
-- design_graph: one between the Phase 1 counterbalance and the midpoint
-- timepoint, one between all three Phase 2 condition blocks and the final
-- timepoint (all three funnel into the same gate, matching how they
-- already funnel into the same t_final node today). Surgical jsonb edits
-- rather than rewriting the whole graph — avoids transcribing the large
-- `nodes` array (block_ids/arms/etc for every existing node) by hand.

UPDATE studies
SET design_graph = jsonb_set(
  jsonb_set(
    design_graph,
    '{nodes}',
    (design_graph->'nodes') || jsonb_build_array(
      jsonb_build_object(
        'id', 'ac_p1', 'type', 'adherence_check', 'label', 'Phase 1 Adherence Check',
        'phase', 'phase1', 'min_required', 10, 'of_total', 12
      ),
      jsonb_build_object(
        'id', 'ac_p2', 'type', 'adherence_check', 'label', 'Phase 2 Adherence Check',
        'phase', 'phase2', 'min_required', 10, 'of_total', 12
      )
    )
  ),
  '{edges}',
  (
    (
      SELECT jsonb_agg(e) FROM jsonb_array_elements(design_graph->'edges') e
      WHERE NOT (
        (e->>'from' = 'cb_p1'   AND e->>'to' = 't_mid') OR
        (e->>'from' = 'b_p2_nr' AND e->>'to' = 't_final') OR
        (e->>'from' = 'b_p2_ra' AND e->>'to' = 't_final') OR
        (e->>'from' = 'b_p2_sc' AND e->>'to' = 't_final')
      )
    )
    || jsonb_build_array(
      jsonb_build_object('from', 'cb_p1',   'to', 'ac_p1'),
      jsonb_build_object('from', 'ac_p1',   'to', 't_mid'),
      jsonb_build_object('from', 'b_p2_nr', 'to', 'ac_p2'),
      jsonb_build_object('from', 'b_p2_ra', 'to', 'ac_p2'),
      jsonb_build_object('from', 'b_p2_sc', 'to', 'ac_p2'),
      jsonb_build_object('from', 'ac_p2',   'to', 't_final')
    )
  )
)
WHERE id = 'dddddddd-0000-4000-8000-000000000001';
