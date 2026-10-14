-- Liliana Study 3: the Phase 1 adherence check stops withdrawing before the
-- midpoint (Norm, 2026-10-14). Below 10 of 12, a participant now sits the
-- midpoint questionnaires, sees why they do not continue and the debrief, and
-- is withdrawn at the Phase 2 fork (on_fail 'assess_then_withdraw',
-- 20261014_assess_then_withdraw.sql).
--
-- Apply only AFTER the Edge Functions (check_schedule, auto-enroll,
-- send_message, materialize_participant_schedule) and the MidpointStep build
-- that understand the setting are live. Older code reads any value but
-- 'continue' as 'withdraw', so applying early fails closed (the old
-- behaviour), never open.
--
-- Both live studies (the SONA study and its paid route copy) and the Live Test
-- study. Phase 2's check (ac_p2: continue) is untouched.

UPDATE studies s
   SET design_graph = jsonb_set(
         s.design_graph, '{nodes}',
         (SELECT jsonb_agg(CASE WHEN n->>'id' = 'ac_p1'
                                THEN n || '{"on_fail": "assess_then_withdraw"}'::jsonb
                                ELSE n END
                           ORDER BY ord)
            FROM jsonb_array_elements(s.design_graph->'nodes') WITH ORDINALITY AS t(n, ord)))
 WHERE s.id IN ('958150a9-7821-4daf-8d83-e9325369d91d',   -- Liliana Study 3
                'ee542d3b-c0da-4a5f-ac34-6b981f153298',   -- Liliana Study 3 — Paid
                'bf080651-7967-48f6-ae7e-10d25ff123d4')   -- Liliana Study 3 — Live Test
   AND EXISTS (SELECT 1 FROM jsonb_array_elements(s.design_graph->'nodes') n
                WHERE n->>'id' = 'ac_p1' AND n->>'on_fail' = 'withdraw');
